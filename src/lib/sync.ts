import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";
import type { Json } from "@/integrations/supabase/types";

const LS_KEY = "moove-workspace-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = "idle" | "loading" | "syncing" | "synced" | "error";
type Listener = (s: { status: Status; workspaceId: string | null; error?: string }) => void;

const state: { status: Status; workspaceId: string | null; error?: string } = {
  status: "idle",
  workspaceId: null,
};
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l({ ...state }));
}
export function subscribeSync(l: Listener) {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

function readIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("w");
  return p && UUID_RE.test(p) ? p : null;
}

async function resolveWorkspaceId(): Promise<string> {
  const fromUrl = readIdFromUrl();
  if (fromUrl) {
    localStorage.setItem(LS_KEY, fromUrl);
    return fromUrl;
  }
  const stored = localStorage.getItem(LS_KEY);
  if (stored && UUID_RE.test(stored)) return stored;
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ data: snapshot() as unknown as Json })
    .select("id")
    .single();
  if (error) throw error;
  localStorage.setItem(LS_KEY, data.id);
  return data.id;
}

function snapshot() {
  const s = useStore.getState();
  return {
    company: s.company,
    banking: s.banking,
    billing: s.billing,
    catalog: s.catalog,
    customers: s.customers,
    docs: s.docs,
  };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let suppressPush = false;

async function push() {
  if (!state.workspaceId) return;
  state.status = "syncing";
  emit();
  const { error } = await supabase
    .from("workspaces")
    .update({ data: snapshot() as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", state.workspaceId);
  if (error) {
    state.status = "error";
    state.error = error.message;
  } else {
    state.status = "synced";
    state.error = undefined;
  }
  emit();
}

function schedulePush() {
  if (suppressPush) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 600);
}

let started = false;
export async function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  state.status = "loading";
  emit();
  try {
    const id = await resolveWorkspaceId();
    state.workspaceId = id;
    const { data, error } = await supabase
      .from("workspaces")
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data?.data && typeof data.data === "object") {
      const cloud = data.data as Partial<ReturnType<typeof snapshot>>;
      suppressPush = true;
      useStore.setState((prev) => ({
        ...prev,
        ...(cloud.company && { company: cloud.company }),
        ...(cloud.banking && { banking: cloud.banking }),
        ...(cloud.billing && { billing: cloud.billing }),
        ...(cloud.catalog && { catalog: cloud.catalog }),
        ...(cloud.customers && { customers: cloud.customers }),
        ...(cloud.docs && { docs: cloud.docs }),
      }));
      suppressPush = false;
    }
    state.status = "synced";
    emit();
    // Clean workspace id from URL to keep it tidy
    if (readIdFromUrl()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("w");
      window.history.replaceState({}, "", url.toString());
    }
    // Subscribe to changes and push
    useStore.subscribe(() => schedulePush());
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
    emit();
  }
}

export function getShareLink(): string | null {
  if (!state.workspaceId || typeof window === "undefined") return null;
  const url = new URL(window.location.origin);
  url.searchParams.set("w", state.workspaceId);
  return url.toString();
}