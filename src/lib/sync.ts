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
      tax_number: c.taxNumber ?? null,
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
      scheduled_end_date: d.scheduledEndDate ?? null,
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

const CLOUD_PAGE_SIZE = 1000;

async function fetchOwnedRows<T>(
  table: "catalog_items" | "customers" | "docs" | "expenses" | "expense_categories",
  uid: string,
  orderColumn = "id",
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("owner_user_id", uid)
      .order(orderColumn)
      .range(from, from + CLOUD_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < CLOUD_PAGE_SIZE) break;
    from += CLOUD_PAGE_SIZE;
  }

  return rows;
}

async function loadAll() {
  const uid = state.userId;
  if (!uid) return;
  if (state.loading) return;

  state.loading = true;
  state.status = "loading";
  emit();

  try {
    const [profileRes, catRows, customerRows, docRows, expenseRows, categoryRows] = await Promise.all([
      supabase.from("company_profile").select("*").eq("owner_user_id", uid).maybeSingle(),
      fetchOwnedRows<{
        id: string;
        name: string;
        price: number | string;
        unit: CatalogItem["unit"];
      }>("catalog_items", uid),
      fetchOwnedRows<{
        id: string;
        name: string;
        phone: string;
        email: string;
        address: string | null;
        tax_number: string | null;
      }>("customers", uid),
      fetchOwnedRows<{
        id: string;
        number: string;
        type: Doc["type"];
        status: Doc["status"];
        created_at: string;
        scheduled_date: string | null;
        day_order: number | null;
        archived: boolean;
        customer: unknown;
        items: unknown;
        notes: string | null;
        deposit_pct: number | string;
        deposit_paid: boolean;
        payment_method: Doc["paymentMethod"] | null;
        paid_at: string | null;
        from_address: string | null;
        to_address: string | null;
        from_coords: unknown;
        to_coords: unknown;
        distance_km: number | string | null;
      }>("docs", uid),
      fetchOwnedRows<{
        id: string;
        created_at: string;
        date: string;
        category: string;
        vendor: string;
        description: string | null;
        amount: number | string;
        vat_amount: number | string | null;
        payment_method: Expense["paymentMethod"] | null;
        notes: string | null;
        receipt_image: string | null;
        linked_doc_id: string | null;
      }>("expenses", uid),
      fetchOwnedRows<{ name: string }>("expense_categories", uid, "name"),
    ]);
    if (profileRes.error) throw profileRes.error;

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

      const catalog: CatalogItem[] = catRows.map((r) => ({
        id: r.id,
        name: r.name,
        price: Number(r.price),
        unit: r.unit as CatalogItem["unit"],
      }));

      const customers: Customer[] = customerRows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        address: r.address ?? undefined,
        taxNumber: r.tax_number ?? undefined,
      }));

      const docs: Doc[] = docRows.map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type as Doc["type"],
        status: r.status as Doc["status"],
        createdAt: r.created_at,
        scheduledDate: r.scheduled_date ?? undefined,
        scheduledEndDate: (r as { scheduled_end_date?: string | null }).scheduled_end_date ?? undefined,
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

      const expenses: Expense[] = expenseRows.map((r) => ({
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

      const remoteCategoryNames = categoryRows.map((r) => r.name);
      const expenseCategories = remoteCategoryNames.length
        ? remoteCategoryNames
        : DEFAULT_EXPENSE_CATEGORIES;

      // Merge cloud with any pre-existing local (anonymous) data so we never
      // wipe records the user created before signing in, or the previous
      // signed-in session's persisted store. Cloud wins on id collisions.
      const mergeById = <T extends { id: string }>(cloud: T[], local: T[]): T[] => {
        const map = new Map<string, T>();
        for (const l of local) map.set(l.id, l);
        for (const c of cloud) map.set(c.id, c);
        return Array.from(map.values());
      };

      const mergedCatalog = mergeById(catalog, prev.catalog ?? []);
      const mergedCustomers = mergeById(customers, prev.customers ?? []);
      const mergedDocs = mergeById(docs, prev.docs ?? []);
      const mergedExpenses = mergeById(expenses, prev.expenses ?? []);

      useStore.setState({
        company,
        banking,
        billing,
        density,
        catalog: mergedCatalog,
        customers: mergedCustomers,
        docs: mergedDocs,
        expenses: mergedExpenses,
        expenseCategories,
      });

      // Push any local-only rows up to the cloud so the merge persists.
      const cloudIds = {
        catalog: new Set(catalog.map((x) => x.id)),
        customers: new Set(customers.map((x) => x.id)),
        docs: new Set(docs.map((x) => x.id)),
        expenses: new Set(expenses.map((x) => x.id)),
      };
      const localOnlyCatalog = (prev.catalog ?? []).filter((x) => !cloudIds.catalog.has(x.id));
      const localOnlyCustomers = (prev.customers ?? []).filter((x) => !cloudIds.customers.has(x.id));
      const localOnlyDocs = (prev.docs ?? []).filter((x) => !cloudIds.docs.has(x.id));
      const localOnlyExpenses = (prev.expenses ?? []).filter((x) => !cloudIds.expenses.has(x.id));
      const localOnlyCategories = (prev.expenseCategories ?? []).filter(
        (n) => !remoteCategoryNames.includes(n),
      );
      // Defer push out of the suppression window.
      setTimeout(() => {
        localOnlyCatalog.forEach(pushCatalogItem);
        localOnlyCustomers.forEach(pushCustomer);
        localOnlyDocs.forEach(pushDoc);
        localOnlyExpenses.forEach(pushExpense);
        localOnlyCategories.forEach(pushExpenseCategory);
      }, 0);
    } finally {
      suppressPush = false;
    }

    // Seed defaults for a brand-new user.
    if (!profileRes.data) pushCompanyProfile();
    if (!categoryRows.length) DEFAULT_EXPENSE_CATEGORIES.forEach(pushExpenseCategory);
  } finally {
    state.loading = false;
    state.status = runningTask();
    emit();
  }
}

async function waitForPersistHydration() {
  const persistApi = (useStore as unknown as {
    persist?: {
      hasHydrated: () => boolean;
      onFinishHydration: (cb: () => void) => () => void;
      rehydrate: () => Promise<void> | void;
    };
  }).persist;

  if (!persistApi || persistApi.hasHydrated()) return;

  await new Promise<void>((resolve) => {
    const unsub = persistApi.onFinishHydration(() => {
      unsub();
      resolve();
    });
    // Kick a rehydrate in case one isn't in flight (idempotent).
    void persistApi.rehydrate();
  });
}

export async function refreshSync() {
  if (typeof window === "undefined") return;

  await waitForPersistHydration();

  if (!state.userId) {
    const { data: userRes } = await supabase.auth.getUser();
    state.userId = userRes.user?.id ?? null;
    emit();
  }

  if (state.userId) await loadAll();
}

let started = false;
export async function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Wait for the zustand `persist` middleware to finish rehydrating from
  // localStorage before we read/merge state. Otherwise loadAll() runs first,
  // writes cloud data into the store, and then a late rehydrate overwrites
  // it with the stale (or empty) persisted snapshot — making just-loaded
  // records "disappear" moments after they render.
  await waitForPersistHydration();

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
  if (state.userId) await refreshSync();
}

// Legacy helpers kept as no-ops so we don't break any straggling import.
export function getShareLink(): string | null {
  return null;
}
export function flushSync(): Promise<void> {
  return Promise.resolve();
}