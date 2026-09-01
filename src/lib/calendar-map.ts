// Pure mapping helpers between MOOVE docs and Google Calendar events.
// No server-only imports here so this stays unit-testable / client-safe.

export const CAL_TZ = "Africa/Johannesburg";
export const DOC_PROP = "mooveDocId";

export interface DocRow {
  id: string;
  number: string;
  type: string;
  status: string;
  archived: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_end_date: string | null;
  customer: { name?: string; phone?: string; email?: string; address?: string } | null;
  items: Array<{ description?: string; qty?: number; price?: number }> | null;
  notes: string | null;
  from_address: string | null;
  to_address: string | null;
  stops: Array<{ address?: string }> | null;
  distance_km: number | string | null;
  job_category: string | null;
  gcal_event_id: string | null;
  gcal_calendar_id?: string | null;
  gcal_synced_at: string | null;
  updated_at: string;
}

export interface GEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  etag?: string;
  eventType?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function docTotal(row: DocRow) {
  return (row.items ?? []).reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0,
  );
}

export function routeLine(row: DocRow) {
  const parts = [
    row.from_address,
    ...(row.stops ?? []).map((s) => s?.address).filter(Boolean),
    row.to_address,
  ].filter((x): x is string => !!x && !!x.trim());
  return parts.join(" → ");
}

/** True when the doc should exist as an event on the calendar. */
export function shouldSync(row: DocRow) {
  if (!row.scheduled_date) return false;
  if (row.archived) return false;
  if (row.status === "cancelled") return false;
  return row.type === "job" || row.type === "invoice" || row.type === "quote";
}

function addHours(dateTime: string, hours: number) {
  const [d, t] = dateTime.split("T");
  const [h, m] = t.split(":").map(Number);
  const base = new Date(Date.UTC(
    Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), h, m,
  ));
  base.setUTCHours(base.getUTCHours() + hours);
  return base.toISOString().slice(0, 16);
}

export function docToEvent(row: DocRow, appOrigin: string): Record<string, unknown> {
  const name = row.customer?.name?.trim() || "No name";
  const typeLabel =
    row.type === "job" ? (row.job_category ? `Job · ${row.job_category}` : "Job")
    : row.type === "invoice" ? "Invoice"
    : "Quote";
  const summary = `${row.number} — ${name}`;

  const descLines: string[] = [`${typeLabel} ${row.number}`];
  if (row.customer?.phone) descLines.push(`Phone: ${row.customer.phone}`);
  if (row.customer?.email) descLines.push(`Email: ${row.customer.email}`);
  const route = routeLine(row);
  if (route) descLines.push(`Route: ${route}`);
  if (row.distance_km) descLines.push(`Distance: ${Number(row.distance_km)} km`);
  const total = docTotal(row);
  if (total > 0) descLines.push(`Total: R ${total.toFixed(2)}`);
  if (row.notes) descLines.push("", row.notes);
  descLines.push("", `${appOrigin}/doc/${row.id}`);

  const start = row.scheduled_date!;
  const multiDay = !!row.scheduled_end_date && row.scheduled_end_date > start;

  let times: Record<string, unknown>;
  if (multiDay) {
    times = {
      start: { date: start },
      end: { date: addDays(row.scheduled_end_date!, 1) },
    };
  } else if (row.scheduled_time) {
    const from = `${start}T${row.scheduled_time}`;
    times = {
      start: { dateTime: `${from}:00`, timeZone: CAL_TZ },
      end: { dateTime: `${addHours(from, 2)}:00`, timeZone: CAL_TZ },
    };
  } else {
    times = { start: { date: start }, end: { date: addDays(start, 1) } };
  }

  return {
    summary,
    description: descLines.join("\n"),
    location: route || row.customer?.address || undefined,
    ...times,
    extendedProperties: { private: { [DOC_PROP]: row.id } },
  };
}

const META_LINE = /^(Job( · .*)?|Invoice|Quote) [A-Z]+-?\d+$|^(Phone|Email|Route|Distance|Total):/;
const APP_LINK = /^https?:\/\/\S+\/doc\/\S+$/;

/**
 * Pull the user-written notes back out of a description we generated ourselves.
 * Returns null when the description carries nothing but generated metadata.
 */
export function extractNotes(description?: string | null): string | null {
  if (!description) return null;
  const lines = description.split("\n");
  const generated = lines.some((l) => APP_LINK.test(l.trim())) || META_LINE.test(lines[0].trim());
  if (!generated) return description;
  const kept = lines.filter((l) => {
    const t = l.trim();
    return !!t && !META_LINE.test(t) && !APP_LINK.test(t);
  });
  const out = kept.join("\n").trim();
  return out || null;
}

/** Extract the doc-shaped fields from an inbound Google event. */
export function eventToDocFields(ev: GEvent) {
  const summary = (ev.summary ?? "Untitled").trim();
  // "INV-123 — Name" style titles keep just the name portion.
  const name = summary.includes(" — ") ? summary.split(" — ").slice(1).join(" — ") : summary;

  const startDate = ev.start?.date ?? ev.start?.dateTime?.slice(0, 10) ?? null;
  const time = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : null;

  let endDate: string | null = null;
  if (ev.end?.date && startDate) {
    const exclusive = ev.end.date;
    const inclusive = addDays(exclusive, -1);
    endDate = inclusive > startDate ? inclusive : null;
  } else if (ev.end?.dateTime && startDate) {
    const d = ev.end.dateTime.slice(0, 10);
    endDate = d > startDate ? d : null;
  }

  return {
    name: name.trim() || "Untitled",
    scheduled_date: startDate,
    scheduled_time: time,
    scheduled_end_date: endDate,
    address: ev.location ?? null,
    notes: extractNotes(ev.description),
  };
}

