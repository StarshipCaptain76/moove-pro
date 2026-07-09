import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";
import type { Json } from "@/integrations/supabase/types";

const LS_KEY = "moove-workspace-id";
const LS_TOKEN_KEY = "moove-workspace-token";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = "idle" | "loading" | "syncing" | "synced" | "error";
type Listener = (s: { status: Status; workspaceId: string | null; error?: string }) => void;

const state: { status: Status; workspaceId: string | null; ownerToken: string | null; error?: string } = {
  status: "idle",
  workspaceId: null,
  ownerToken: null,
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

function readIdFromUrl(): { id: string; token: string | null } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("w");
  const token = params.get("t");
  if (!id || !UUID_RE.test(id)) return null;
  return { id, token: token && UUID_RE.test(token) ? token : null };
}

async function resolveWorkspace(): Promise<{ id: string; token: string }> {
  const fromUrl = readIdFromUrl();
  if (fromUrl && fromUrl.token) {
    localStorage.setItem(LS_KEY, fromUrl.id);
    localStorage.setItem(LS_TOKEN_KEY, fromUrl.token);
    return { id: fromUrl.id, token: fromUrl.token };
  }
  const stored = localStorage.getItem(LS_KEY);
  const storedToken = localStorage.getItem(LS_TOKEN_KEY);
  if (stored && UUID_RE.test(stored) && storedToken && UUID_RE.test(storedToken)) {
    return { id: stored, token: storedToken };
  }
  const { data, error } = await supabase.rpc("create_workspace", {
    p_data: snapshot() as unknown as Json,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.owner_token) throw new Error("Failed to create workspace");
  localStorage.setItem(LS_KEY, row.id);
  localStorage.setItem(LS_TOKEN_KEY, row.owner_token);
  return { id: row.id, token: row.owner_token };
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
  if (!state.workspaceId || !state.ownerToken) return;
  state.status = "syncing";
  emit();
  const { error } = await supabase.rpc("update_workspace", {
    p_id: state.workspaceId,
    p_token: state.ownerToken,
    p_data: snapshot() as unknown as Json,
  });
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
    const { id, token } = await resolveWorkspace();
    state.workspaceId = id;
    state.ownerToken = token;
    const { data, error } = await supabase.rpc("get_workspace", {
      p_id: id,
      p_token: token,
    });
    if (error) throw error;
    if (data && typeof data === "object") {
      const cloud = data as Partial<ReturnType<typeof snapshot>>;
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
      url.searchParams.delete("t");
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
  if (!state.workspaceId || !state.ownerToken || typeof window === "undefined") return null;
  const url = new URL(window.location.origin);
  url.searchParams.set("w", state.workspaceId);
  url.searchParams.set("t", state.ownerToken);
  return url.toString();
}