import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  docToEvent,
  eventToDocFields,
  shouldSync,
  DOC_PROP,
  type DocRow,
  type GEvent,
} from "./calendar-map";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

const DOC_COLS =
  "id,number,type,status,archived,scheduled_date,scheduled_time,scheduled_end_date,customer,items,notes,from_address,to_address,stops,distance_km,job_category,gcal_event_id,gcal_synced_at,updated_at";

function gheaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const cal = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lov || !cal) throw new Error("Google Calendar connector not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": cal,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gcal<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  let last = { status: 0, body: "" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${GATEWAY}${path}`, {
      method: init.method ?? "GET",
      headers: gheaders(),
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    if (res.ok) {
      const text = await res.text();
      return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
    }
    last = { status: res.status, body: await res.text() };
    // Transient gateway/provider hiccups: back off and retry.
    if (res.status === 429 || res.status >= 500) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    break;
  }
  console.error(`[gcal] ${init.method ?? "GET"} ${path} failed [${last.status}]: ${last.body}`);
  return { ok: false, status: last.status, body: last.body };
}

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await gcal<{
      items?: Array<{ id: string; summary?: string; primary?: boolean; accessRole?: string }>;
    }>("/users/me/calendarList?minAccessRole=writer&maxResults=250");
    if (!r.ok) throw new Error(`Could not load calendars [${r.status}]: ${r.body}`);
    return (r.data.items ?? []).map((c) => ({
      id: c.id,
      name: c.summary ?? c.id,
      primary: !!c.primary,
    }));
  });

export const getCalendarSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_settings")
      .select("calendar_id,calendar_name,enabled,last_sync_at")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return {
      calendarId: data?.calendar_id ?? null,
      calendarName: data?.calendar_name ?? null,
      enabled: !!data?.enabled,
      lastSyncAt: data?.last_sync_at ?? null,
    };
  });

export const saveCalendarSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        calendarId: z.string().nullable().optional(),
        calendarName: z.string().nullable().optional(),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("calendar_settings").upsert(
      {
        owner_user_id: context.userId,
        calendar_id: data.calendarId ?? null,
        calendar_name: data.calendarName ?? null,
        enabled: data.enabled,
        // Changing calendars invalidates the incremental token.
        sync_token: null,
      },
      { onConflict: "owner_user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

const PUSH_LIMIT = 25;

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const uid = context.userId;
    const origin = data?.origin ?? "https://moove-pro.lovable.app";

    const { data: settings, error: sErr } = await supabase
      .from("calendar_settings")
      .select("*")
      .eq("owner_user_id", uid)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings?.enabled || !settings.calendar_id) {
      return { skipped: true, pushed: 0, removed: 0, updated: 0, created: 0, remaining: 0 };
    }
    const cal = encodeURIComponent(settings.calendar_id);

    const { data: docRows, error: dErr } = await supabase
      .from("docs")
      .select(DOC_COLS)
      .eq("owner_user_id", uid);
    if (dErr) throw dErr;
    const docs = (docRows ?? []) as unknown as DocRow[];

    // ---------- push ----------
    let pushed = 0;
    let removed = 0;
    let remaining = 0;
    const now = () => new Date().toISOString();

    for (const row of docs) {
      const wanted = shouldSync(row);
      const synced = row.gcal_synced_at ? new Date(row.gcal_synced_at).getTime() : 0;
      const dirty = new Date(row.updated_at).getTime() > synced;

      if (wanted && (!row.gcal_event_id || dirty)) {
        if (pushed >= PUSH_LIMIT) {
          remaining += 1;
          continue;
        }
        const body = docToEvent(row, origin);
        let res = row.gcal_event_id
          ? await gcal<GEvent>(`/calendars/${cal}/events/${encodeURIComponent(row.gcal_event_id)}`, {
              method: "PATCH",
              body,
            })
          : await gcal<GEvent>(`/calendars/${cal}/events`, { method: "POST", body });
        if (!res.ok && row.gcal_event_id && (res.status === 404 || res.status === 410)) {
          res = await gcal<GEvent>(`/calendars/${cal}/events`, { method: "POST", body });
        }
        if (!res.ok) continue;
        await supabase
          .from("docs")
          .update({
            gcal_event_id: res.data.id ?? row.gcal_event_id,
            gcal_etag: res.data.etag ?? null,
            gcal_synced_at: now(),
          })
          .eq("id", row.id)
          .eq("owner_user_id", uid);
        pushed += 1;
        await sleep(120);
      } else if (!wanted && row.gcal_event_id) {
        await gcal(`/calendars/${cal}/events/${encodeURIComponent(row.gcal_event_id)}`, {
          method: "DELETE",
        });
        await supabase
          .from("docs")
          .update({ gcal_event_id: null, gcal_etag: null, gcal_synced_at: now() })
          .eq("id", row.id)
          .eq("owner_user_id", uid);
        removed += 1;
      }
    }

    // ---------- pull ----------
    const listPath = (token?: string | null) => {
      const p = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "true",
        maxResults: "250",
      });
      if (token) p.set("syncToken", token);
      else {
        const from = new Date();
        from.setDate(from.getDate() - 30);
        p.set("timeMin", from.toISOString());
      }
      return `/calendars/${cal}/events?${p.toString()}`;
    };

    let list = await gcal<{ items?: GEvent[]; nextSyncToken?: string }>(
      listPath(settings.sync_token),
    );
    if (!list.ok && list.status === 410) list = await gcal(listPath(null));
    if (!list.ok) {
      // Push already succeeded — report partial success instead of failing the run.
      return {
        skipped: false,
        pushed,
        removed,
        created: 0,
        updated: 0,
        deleted: 0,
        remaining,
        error: `Could not read calendar [${list.status}]`,
      };
    }

    // Refresh docs (push may have set event ids).
    const { data: fresh } = await supabase
      .from("docs")
      .select(DOC_COLS)
      .eq("owner_user_id", uid);
    const byEvent = new Map<string, DocRow>();
    const byId = new Map<string, DocRow>();
    for (const r of ((fresh ?? []) as unknown as DocRow[])) {
      byId.set(r.id, r);
      if (r.gcal_event_id) byEvent.set(r.gcal_event_id, r);
    }

    // Job numbering comes from the company profile counter.
    const { data: profile } = await supabase
      .from("company_profile")
      .select("billing")
      .eq("owner_user_id", uid)
      .maybeSingle();
    const billing = ((profile?.billing ?? {}) as Record<string, unknown>);
    let nextJobNo = Number(billing.nextJobNo ?? 1) || 1;
    const jobPrefix = String(billing.jobPrefix ?? "JOB");

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const ev of list.data.items ?? []) {
      if (!ev.id) continue;
      const linkedId = ev.extendedProperties?.private?.[DOC_PROP];
      const match = byEvent.get(ev.id) ?? (linkedId ? byId.get(linkedId) : undefined);

      if (ev.status === "cancelled") {
        if (!match) continue;
        const isPlainJob = match.type === "job" && (match.items ?? []).length === 0;
        if (isPlainJob) {
          await supabase.from("docs").delete().eq("id", match.id).eq("owner_user_id", uid);
        } else {
          await supabase
            .from("docs")
            .update({ scheduled_date: null, gcal_event_id: null, gcal_synced_at: new Date().toISOString() })
            .eq("id", match.id)
            .eq("owner_user_id", uid);
        }
        deleted += 1;
        continue;
      }

      const f = eventToDocFields(ev);
      if (!f.scheduled_date) continue;

      if (match) {
        const evUpdated = ev.updated ? new Date(ev.updated).getTime() : 0;
        const docUpdated = new Date(match.updated_at).getTime();
        if (evUpdated <= docUpdated) continue; // app wins — it is newer
        await supabase
          .from("docs")
          .update({
            scheduled_date: f.scheduled_date,
            scheduled_time: f.scheduled_time,
            scheduled_end_date: f.scheduled_end_date,
            ...(match.type === "job"
              ? {
                  customer: { ...(match.customer ?? {}), name: f.name, address: f.address ?? undefined },
                  notes: f.notes,
                }
              : {}),
            gcal_event_id: ev.id,
            gcal_etag: ev.etag ?? null,
            gcal_synced_at: new Date().toISOString(),
          })
          .eq("id", match.id)
          .eq("owner_user_id", uid);
        updated += 1;
        continue;
      }

      // Unknown event -> create a Job card.
      const id = Math.random().toString(36).slice(2, 10);
      const number = `${jobPrefix}-${nextJobNo}`;
      nextJobNo += 1;
      const { error: insErr } = await supabase.from("docs").insert({
        id,
        owner_user_id: uid,
        number,
        type: "job",
        status: "draft",
        scheduled_date: f.scheduled_date,
        scheduled_time: f.scheduled_time,
        scheduled_end_date: f.scheduled_end_date,
        archived: false,
        customer: { id, name: f.name, phone: "", email: "", address: f.address ?? undefined },
        items: [],
        notes: f.notes,
        deposit_pct: 0,
        deposit_paid: false,
        job_category: "other",
        gcal_event_id: ev.id,
        gcal_etag: ev.etag ?? null,
        gcal_synced_at: new Date().toISOString(),
      });
      if (insErr) {
        console.error("[gcal] insert job failed", insErr);
        continue;
      }
      created += 1;
    }

    if (created > 0) {
      await supabase
        .from("company_profile")
        .update({ billing: { ...billing, nextJobNo } })
        .eq("owner_user_id", uid);
    }

    await supabase
      .from("calendar_settings")
      .update({
        sync_token: list.data.nextSyncToken ?? settings.sync_token,
        last_sync_at: new Date().toISOString(),
      })
      .eq("owner_user_id", uid);

    return { skipped: false, pushed, removed, created, updated, deleted, remaining };
  });
