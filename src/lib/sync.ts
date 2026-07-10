import { supabase } from "@/integrations/supabase/client";
import {
  useStore,
  DEFAULT_EXPENSE_CATEGORIES,
  type Doc,
  type Customer,
  type CatalogItem,
  type Expense,
  type Company,
  type Banking,
  type BillingSettings,
  type Density,
} from "./store";

type Status = "idle" | "loading" | "syncing" | "synced" | "error";
type Listener = (s: { status: Status; authed: boolean; error?: string }) => void;

const state: {
  status: Status;
  userId: string | null;
  error?: string;
  loading: boolean;
  pending: number;
} = {
  status: "idle",
  userId: null,
  loading: false,
  pending: 0,
};
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) =>
    l({ status: state.status, authed: !!state.userId, error: state.error }),
  );
}
export function subscribeSync(l: Listener) {
  listeners.add(l);
  l({ status: state.status, authed: !!state.userId, error: state.error });
  return () => listeners.delete(l);
}

export function isAuthed() {
  return !!state.userId;
}

// Suppress push while we're hydrating the store from the cloud.
let suppressPush = false;

function runningTask(): Status {
  if (state.loading) return "loading";
  if (state.pending > 0) return "syncing";
  return "synced";
}

async function withPush<T>(fn: () => Promise<T>): Promise<T | void> {
  if (suppressPush || !state.userId) return;
  state.pending += 1;
  state.status = "syncing";
  emit();
  try {
    const out = await fn();
    state.error = undefined;
    return out;
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
    // Re-emit and continue — surface via SyncBadge, don't crash the UI.
    console.error("[sync push]", e);
    emit();
  } finally {
    state.pending -= 1;
    if (state.status !== "error") state.status = runningTask();
    emit();
  }
}

// ============ per-entity push functions ============

export function pushCompanyProfile() {
  const s = useStore.getState();
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("company_profile").upsert({
      owner_user_id: uid,
      company: s.company as unknown as never,
      banking: s.banking as unknown as never,
      billing: s.billing as unknown as never,
      density: s.density,
    });
    if (error) throw error;
  });
}

export function pushCatalogItem(c: CatalogItem) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("catalog_items").upsert({
      id: c.id,
      owner_user_id: uid,
      name: c.name,
      price: c.price,
      unit: c.unit,
    });
    if (error) throw error;
  });
}

export function deleteCatalogItemRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushCustomer(c: Customer) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("customers").upsert({
      id: c.id,
      owner_user_id: uid,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address ?? null,
    });
    if (error) throw error;
  });
}

export function deleteCustomerRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushDoc(d: Doc) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("docs").upsert({
      id: d.id,
      owner_user_id: uid,
      number: d.number,
      type: d.type,
      status: d.status,
      created_at: d.createdAt,
      scheduled_date: d.scheduledDate ?? null,
      day_order: d.dayOrder ?? null,
      archived: !!d.archived,
      customer: d.customer as unknown as never,
      items: d.items as unknown as never,
      notes: d.notes ?? null,
      deposit_pct: d.depositPct,
      deposit_paid: !!d.depositPaid,
      payment_method: d.paymentMethod ?? null,
      paid_at: d.paidAt ?? null,
      from_address: d.fromAddress ?? null,
      to_address: d.toAddress ?? null,
      from_coords: (d.fromCoords ?? null) as unknown as never,
      to_coords: (d.toCoords ?? null) as unknown as never,
      distance_km: d.distanceKm ?? null,
    });
    if (error) throw error;
  });
}

export function deleteDocRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("docs").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushExpense(e: Expense) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase.from("expenses").upsert({
      id: e.id,
      owner_user_id: uid,
      date: e.date,
      category: e.category,
      vendor: e.vendor,
      description: e.description ?? null,
      amount: e.amount,
      vat_amount: e.vatAmount ?? null,
      payment_method: e.paymentMethod ?? null,
      notes: e.notes ?? null,
      receipt_image: e.receiptImage ?? null,
      linked_doc_id: e.linkedDocId ?? null,
      created_at: e.createdAt,
    });
    if (error) throw error;
  });
}

export function deleteExpenseRow(id: string) {
  if (!state.userId) return;
  void withPush(async () => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  });
}

export function pushExpenseCategory(name: string) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase
      .from("expense_categories")
      .upsert({ owner_user_id: uid, name }, { onConflict: "owner_user_id,name" });
    if (error) throw error;
  });
}

export function deleteExpenseCategoryRow(name: string) {
  const uid = state.userId;
  if (!uid) return;
  void withPush(async () => {
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("owner_user_id", uid)
      .eq("name", name);
    if (error) throw error;
  });
}

export async function renameExpenseCategoryRow(oldName: string, newName: string) {
  const uid = state.userId;
  if (!uid) return;
  await withPush(async () => {
    // Insert new (if not exists), delete old.
    const { error: insErr } = await supabase
      .from("expense_categories")
      .upsert({ owner_user_id: uid, name: newName }, { onConflict: "owner_user_id,name" });
    if (insErr) throw insErr;
    const { error: delErr } = await supabase
      .from("expense_categories")
      .delete()
      .eq("owner_user_id", uid)
      .eq("name", oldName);
    if (delErr) throw delErr;
  });
}

// Called by the store after mutating actions.
export function pushMany(docs: Doc[], expenses: Expense[], catalog: CatalogItem[], categories: string[]) {
  docs.forEach(pushDoc);
  expenses.forEach(pushExpense);
  catalog.forEach(pushCatalogItem);
  categories.forEach(pushExpenseCategory);
}

// ============ initial load ============

async function loadAll() {
  const uid = state.userId;
  if (!uid) return;

  state.loading = true;
  state.status = "loading";
  emit();

  try {
    // Copy any legacy workspace blob into per-row tables (idempotent).
    await supabase.rpc("migrate_workspace_blob");

    const [profileRes, catRes, custRes, docsRes, expRes, catCatRes] = await Promise.all([
      supabase.from("company_profile").select("*").eq("owner_user_id", uid).maybeSingle(),
      supabase.from("catalog_items").select("*").eq("owner_user_id", uid),
      supabase.from("customers").select("*").eq("owner_user_id", uid),
      supabase.from("docs").select("*").eq("owner_user_id", uid),
      supabase.from("expenses").select("*").eq("owner_user_id", uid),
      supabase.from("expense_categories").select("*").eq("owner_user_id", uid),
    ]);
    for (const r of [profileRes, catRes, custRes, docsRes, expRes, catCatRes]) {
      if (r.error) throw r.error;
    }

    suppressPush = true;
    try {
      const prev = useStore.getState();
      const profileRow = profileRes.data;
      const company = (profileRow?.company as Company | null) && Object.keys(profileRow!.company as object).length
        ? (profileRow!.company as unknown as Company)
        : prev.company;
      const banking = (profileRow?.banking as Banking | null) && Object.keys(profileRow!.banking as object).length
        ? (profileRow!.banking as unknown as Banking)
        : prev.banking;
      const billing = (profileRow?.billing as BillingSettings | null) && Object.keys(profileRow!.billing as object).length
        ? (profileRow!.billing as unknown as BillingSettings)
        : prev.billing;
      const density = (profileRow?.density as Density | undefined) ?? prev.density;

      const catalog: CatalogItem[] = (catRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        price: Number(r.price),
        unit: r.unit as CatalogItem["unit"],
      }));

      const customers: Customer[] = (custRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        address: r.address ?? undefined,
      }));

      const docs: Doc[] = (docsRes.data ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type as Doc["type"],
        status: r.status as Doc["status"],
        createdAt: r.created_at,
        scheduledDate: r.scheduled_date ?? undefined,
        dayOrder: r.day_order ?? undefined,
        archived: r.archived,
        customer: r.customer as unknown as Customer,
        items: (r.items as unknown as Doc["items"]) ?? [],
        notes: r.notes ?? undefined,
        depositPct: Number(r.deposit_pct),
        depositPaid: r.deposit_paid,
        paymentMethod: (r.payment_method as Doc["paymentMethod"]) ?? undefined,
        paidAt: r.paid_at ?? undefined,
        fromAddress: r.from_address ?? undefined,
        toAddress: r.to_address ?? undefined,
        fromCoords: (r.from_coords as Doc["fromCoords"]) ?? undefined,
        toCoords: (r.to_coords as Doc["toCoords"]) ?? undefined,
        distanceKm: r.distance_km != null ? Number(r.distance_km) : undefined,
      }));

      const expenses: Expense[] = (expRes.data ?? []).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        date: r.date,
        category: r.category,
        vendor: r.vendor,
        description: r.description ?? undefined,
        amount: Number(r.amount),
        vatAmount: r.vat_amount != null ? Number(r.vat_amount) : undefined,
        paymentMethod: (r.payment_method as Expense["paymentMethod"]) ?? undefined,
        notes: r.notes ?? undefined,
        receiptImage: r.receipt_image ?? undefined,
        linkedDocId: r.linked_doc_id ?? undefined,
      }));

      const remoteCategoryNames = (catCatRes.data ?? []).map((r) => r.name);
      const expenseCategories = remoteCategoryNames.length
        ? remoteCategoryNames
        : DEFAULT_EXPENSE_CATEGORIES;

      useStore.setState({
        company,
        banking,
        billing,
        density,
        catalog,
        customers,
        docs,
        expenses,
        expenseCategories,
      });
    } finally {
      suppressPush = false;
    }

    // Seed defaults for a brand-new user.
    if (!profileRes.data) pushCompanyProfile();
    if (!(catCatRes.data ?? []).length) DEFAULT_EXPENSE_CATEGORIES.forEach(pushExpenseCategory);
  } finally {
    state.loading = false;
    state.status = runningTask();
    emit();
  }
}

let started = false;
export async function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const newUid = session?.user.id ?? null;
    if (newUid === state.userId) return;
    state.userId = newUid;
    emit();
    if (newUid) void loadAll();
  });

  const { data: userRes } = await supabase.auth.getUser();
  state.userId = userRes.user?.id ?? null;
  emit();
  if (state.userId) await loadAll();
}

// Legacy helpers kept as no-ops so we don't break any straggling import.
export function getShareLink(): string | null {
  return null;
}
export function flushSync(): Promise<void> {
  return Promise.resolve();
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

function markDirty() {
  if (typeof window !== "undefined") localStorage.setItem(LS_DIRTY_KEY, "1");
}
function clearDirty() {
  if (typeof window !== "undefined") localStorage.removeItem(LS_DIRTY_KEY);
}
function isDirty(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_DIRTY_KEY) === "1";
}

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
    clearDirty();
  }
  emit();
}

function schedulePush() {
  if (suppressPush) return;
  markDirty();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 600);
}

// Force an immediate push, bypassing the 600ms debounce. Use for critical
// actions (mark paid, convert to invoice) so the write can't be lost to a
// navigation or reload happening within the debounce window.
export async function flushSync() {
  if (suppressPush) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  markDirty();
  try {
    await push();
  } catch {
    // Errors are surfaced via the SyncBadge state; swallow here so callers
    // don't need to handle it inline.
  }
}

function shouldPreserveLocalDoc(doc: Doc): boolean {
  if (!doc.archived) return true;
  const today = new Date().toISOString().slice(0, 10);
  return doc.scheduledDate === today || (doc.status === "paid" && !!doc.paidAt?.startsWith(today));
}

function mergeCloudDocs(cloudDocs: Doc[], localDocs: Doc[]): { docs: Doc[]; preserved: boolean } {
  const byId = new Map(cloudDocs.map((doc) => [doc.id, doc]));
  let preserved = false;
  localDocs.forEach((localDoc) => {
    if (!shouldPreserveLocalDoc(localDoc)) return;
    const cloudDoc = byId.get(localDoc.id);
    if (!cloudDoc || (cloudDoc.archived && !localDoc.archived)) {
      byId.set(localDoc.id, localDoc);
      preserved = true;
    }
  });
  return { docs: Array.from(byId.values()), preserved };
}

function docsFromCloudData(data: unknown): Doc[] {
  if (!data || typeof data !== "object") return [];
  const docs = (data as Partial<ReturnType<typeof snapshot>>).docs;
  return Array.isArray(docs) ? docs : [];
}

function applyCloudData(data: unknown) {
  if (!data || typeof data !== "object") return;
  const cloud = data as Partial<ReturnType<typeof snapshot>>;
  let preservedLocalDocs = false;
  suppressPush = true;
  useStore.setState((prev) => ({
    ...prev,
    ...(cloud.company && { company: cloud.company }),
    ...(cloud.banking && { banking: cloud.banking }),
    ...(cloud.billing && { billing: cloud.billing }),
    ...(cloud.catalog && { catalog: cloud.catalog }),
    ...(cloud.customers && { customers: cloud.customers }),
    ...(cloud.docs && (() => {
      const merged = mergeCloudDocs(cloud.docs, prev.docs ?? []);
      preservedLocalDocs = merged.preserved;
      return { docs: merged.docs };
    })()),
    ...(cloud.expenses && { expenses: cloud.expenses }),
    ...(cloud.expenseCategories && { expenseCategories: cloud.expenseCategories }),
    ...(cloud.density && { density: cloud.density }),
  }));
  suppressPush = false;
  if (preservedLocalDocs) schedulePush();
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
  const stored = getStoredWorkspace();
  let storedData: unknown = null;
  if (stored) {
    try {
      const { data } = await supabase.rpc("get_workspace", { p_id: stored.id, p_token: stored.token });
      storedData = data;
    } catch {
      storedData = null;
    }
  }
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
  // Local has unpushed changes — keep local, push it instead of pulling cloud.
  if (isDirty() && localHasContent) {
    await supabase.rpc("save_my_workspace", { p_data: local as unknown as Json });
    clearDirty();
  } else if (cloudEmpty && localHasContent) {
    await supabase.rpc("save_my_workspace", { p_data: local as unknown as Json });
    clearDirty();
  } else {
    const storedDocs = docsFromCloudData(storedData);
    if (storedDocs.length && stored?.id !== row.id) {
      const cloudObject = cloud && typeof cloud === "object" ? cloud as Partial<ReturnType<typeof snapshot>> : {};
      const merged = mergeCloudDocs(cloudObject.docs ?? [], storedDocs);
      applyCloudData({ ...cloudObject, docs: merged.docs });
      if (merged.preserved) {
        await supabase.rpc("save_my_workspace", { p_data: snapshot() as unknown as Json });
        clearDirty();
      }
    } else {
      applyCloudData(cloud);
    }
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
      const local = snapshot();
      const localHasContent =
        local.docs?.length ||
        local.catalog?.length ||
        local.customers?.length ||
        local.expenses?.length ||
        local.company?.name;
      if (isDirty() && localHasContent) {
        // Unpushed local changes: push local instead of pulling stale cloud.
        const res = await supabase.rpc("update_workspace", {
          p_id: id,
          p_token: token,
          p_data: local as unknown as Json,
        });
        if (res.error) throw res.error;
        clearDirty();
      } else {
        const { data, error } = await supabase.rpc("get_workspace", { p_id: id, p_token: token });
        if (error) throw error;
        applyCloudData(data);
      }
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