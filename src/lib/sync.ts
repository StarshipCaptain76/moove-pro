import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

const LS_KEY = "moove-workspace-id";
const LS_TOKEN_KEY = "moove-workspace-token";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = "idle" | "loading" | "syncing" | "synced" | "error";
type Listener = (s: { status: Status; workspaceId: string | null; authed: boolean; error?: string }) => void;

const state: {
  status: Status;
  workspaceId: string | null;
  ownerToken: string | null;
  userId: string | null;
  error?: string;
} = {
  status: "idle",
  workspaceId: null,
  ownerToken: null,
  userId: null,
};
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) =>
    l({ status: state.status, workspaceId: state.workspaceId, authed: !!state.userId, error: state.error }),
  );
}
export function subscribeSync(l: Listener) {
  listeners.add(l);
  l({ status: state.status, workspaceId: state.workspaceId, authed: !!state.userId, error: state.error });
  return () => listeners.delete(l);
}

function getStoredWorkspace(): { id: string; token: string } | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(LS_KEY);
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (!id || !token || !UUID_RE.test(id) || !UUID_RE.test(token)) return null;
  return { id, token };
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
    const storedId = localStorage.getItem(LS_KEY);
    const storedToken = localStorage.getItem(LS_TOKEN_KEY);
    const differs =
      storedId && storedToken && (storedId !== fromUrl.id || storedToken !== fromUrl.token);
    if (differs) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          "Load workspace from this sync link? Your current local workspace will be replaced.",
        );
      if (!ok) {
        // Strip params and keep the local workspace.
        const url = new URL(window.location.href);
        url.searchParams.delete("w");
        url.searchParams.delete("t");
        window.history.replaceState({}, "", url.toString());
        return { id: storedId, token: storedToken };
      }
    }
    localStorage.setItem(LS_KEY, fromUrl.id);
    localStorage.setItem(LS_TOKEN_KEY, fromUrl.token);
    return { id: fromUrl.id, token: fromUrl.token };
  }
  if (fromUrl && !fromUrl.token) {
    // Incomplete link: don't overwrite anything and warn the user.
    toast.error("Sync link is missing its token. Copy a fresh link from Settings.");
    const url = new URL(window.location.href);
    url.searchParams.delete("w");
    window.history.replaceState({}, "", url.toString());
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
    expenses: s.expenses,
    expenseCategories: s.expenseCategories,
    density: s.density,
  };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let suppressPush = false;

async function push() {
  state.status = "syncing";
  emit();
  let error: { message: string } | null = null;
  if (state.userId) {
    const res = await supabase.rpc("save_my_workspace", { p_data: snapshot() as unknown as Json });
    error = res.error;
  } else if (state.workspaceId && state.ownerToken) {
    const res = await supabase.rpc("update_workspace", {
      p_id: state.workspaceId,
      p_token: state.ownerToken,
      p_data: snapshot() as unknown as Json,
    });
    error = res.error;
  } else {
    return;
  }
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

function applyCloudData(data: unknown) {
  if (!data || typeof data !== "object") return;
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
    ...(cloud.expenses && { expenses: cloud.expenses }),
    ...(cloud.expenseCategories && { expenseCategories: cloud.expenseCategories }),
    ...(cloud.density && { density: cloud.density }),
  }));
  suppressPush = false;
}

async function claimStoredWorkspaceForUser() {
  const stored = getStoredWorkspace();
  if (!stored) return;
  const { error } = await supabase.rpc("claim_workspace", {
    p_id: stored.id,
    p_token: stored.token,
  });
  if (error) throw error;
}

async function loadAuthedWorkspace() {
  await claimStoredWorkspaceForUser();
  const { data, error } = await supabase.rpc("get_my_workspace");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : (data as { id: string; data: unknown } | null);
  if (!row?.id) throw new Error("Could not load your workspace");
  state.workspaceId = row.id;
  state.ownerToken = null;
  // If local has data but cloud is empty, seed cloud with local snapshot (first migration).
  const cloud = (row as { data: unknown }).data;
  const cloudEmpty = !cloud || (typeof cloud === "object" && Object.keys(cloud as object).length === 0);
  const local = snapshot();
  const localHasContent =
    local.docs?.length ||
    local.catalog?.length ||
    local.customers?.length ||
    local.expenses?.length ||
    local.company?.name;
  if (cloudEmpty && localHasContent) {
    await supabase.rpc("save_my_workspace", { p_data: local as unknown as Json });
  } else {
    applyCloudData(cloud);
  }
}

let started = false;
export async function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  // React to sign-in / sign-out and re-init the sync source.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const newUid = session?.user.id ?? null;
    if (newUid === state.userId) return;
    state.userId = newUid;
    void reinitAfterAuth();
  });

  const { data: userRes } = await supabase.auth.getUser();
  state.userId = userRes.user?.id ?? null;

  state.status = "loading";
  emit();
  try {
    if (state.userId) {
      await loadAuthedWorkspace();
    } else {
      const { id, token } = await resolveWorkspace();
      state.workspaceId = id;
      state.ownerToken = token;
      const { data, error } = await supabase.rpc("get_workspace", { p_id: id, p_token: token });
      if (error) throw error;
      applyCloudData(data);
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

async function reinitAfterAuth() {
  state.status = "loading";
  emit();
  try {
    if (state.userId) {
      await loadAuthedWorkspace();
    } else {
      // Signed out: fall back to anonymous workspace stored locally.
      const stored = getStoredWorkspace();
      if (stored) {
        state.workspaceId = stored.id;
        state.ownerToken = stored.token;
        const { data } = await supabase.rpc("get_workspace", { p_id: stored.id, p_token: stored.token });
        applyCloudData(data);
      } else {
        state.workspaceId = null;
        state.ownerToken = null;
      }
    }
    state.status = "synced";
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
  }
  emit();
}

export function getShareLink(): string | null {
  if (state.userId) return null; // signed-in users sync via login, not link
  if (!state.workspaceId || !state.ownerToken || typeof window === "undefined") return null;
  const url = new URL(window.location.origin);
  url.searchParams.set("w", state.workspaceId);
  url.searchParams.set("t", state.ownerToken);
  return url.toString();
}