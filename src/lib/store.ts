import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Unit = "each" | "hour" | "km" | "job";
export type PayMethod = "cash" | "eft" | "card";
export type DocType = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "paid" | "cancelled";
export type Density = "compact" | "normal" | "comfortable";

export interface Expense {
  id: string;
  createdAt: string;
  date: string; // yyyy-mm-dd
  category: string;
  vendor: string;
  description?: string;
  amount: number;
  vatAmount?: number;
  paymentMethod?: PayMethod;
  notes?: string;
  receiptImage?: string; // data URL
  linkedDocId?: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Accommodation",
  "Advertising",
  "Asset Purchases",
  "Data/Airtime",
  "Diesel/Fuel",
  "Entertainment",
  "Food",
  "Grass Purchase",
  "Labour",
  "Maintenance",
  "Sand/Stone/Trailer Hire",
  "Toll Fee",
  "Truck Payment",
  "Other",
];

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  unit: Unit;
}

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  unit: Unit;
  isDistance?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
}

export interface Doc {
  id: string;
  number: string;
  type: DocType;
  status: DocStatus;
  createdAt: string;
  scheduledDate?: string; // ISO date (yyyy-mm-dd)
  dayOrder?: number;
  archived?: boolean;
  customer: Customer;
  items: LineItem[];
  notes?: string;
  depositPct: number;
  depositPaid: boolean;
  paymentMethod?: PayMethod;
  paidAt?: string;
  fromAddress?: string;
  toAddress?: string;
  fromCoords?: { lat: number; lng: number };
  toCoords?: { lat: number; lng: number };
  distanceKm?: number;
}

export interface Company {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  regNo?: string;
  vatNo?: string;
}

export interface Banking {
  accountName: string;
  accountNumber: string;
  bank: string;
  branchCode: string;
  branchName: string;
  swiftCode: string;
}

export interface BillingSettings {
  ratePerKm: number;
  baseCallout: number;
  defaultDepositPct: number;
  vatPct: number;
  quotePrefix: string;
  invoicePrefix: string;
  nextQuoteNo: number;
  nextInvoiceNo: number;
  currency: string;
}

interface State {
  company: Company;
  banking: Banking;
  billing: BillingSettings;
  catalog: CatalogItem[];
  customers: Customer[];
  docs: Doc[];
  expenses: Expense[];
  expenseCategories: string[];
  density: Density;
  upsertDoc: (d: Doc) => void;
  deleteDoc: (id: string) => void;
  upsertCatalog: (c: CatalogItem) => void;
  deleteCatalog: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  setCompany: (c: Company) => void;
  setBanking: (b: Banking) => void;
  setBilling: (b: BillingSettings) => void;
  nextDocNumber: (t: DocType) => string;
  upsertExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addExpenseCategory: (name: string) => void;
  renameExpenseCategory: (oldName: string, newName: string) => void;
  deleteExpenseCategory: (name: string) => void;
  setDensity: (d: Density) => void;
  importHistorical: (p: {
    expenses: Expense[];
    docs: Doc[];
    newExpenseCategories: string[];
    newCatalogItems: CatalogItem[];
    maxInvoiceNo: number;
  }) => { expenses: number; docs: number };
  clearHistorical: () => { expenses: number; docs: number };
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      company: {
        name: "MOOVE",
        tagline: "Moving Company",
        address: "Stilbaai, Western Cape, South Africa",
        phone: "",
        email: "",
      },
      banking: {
        accountName: "MOOVE",
        accountNumber: "63216547993",
        bank: "FNB",
        branchCode: "250655",
        branchName: "FNB Remote Banking",
        swiftCode: "FIRNZAJJ",
      },
      billing: {
        ratePerKm: 15,
        baseCallout: 500,
        defaultDepositPct: 50,
        vatPct: 0,
        quotePrefix: "Q",
        invoicePrefix: "INV",
        nextQuoteNo: 1001,
        nextInvoiceNo: 1001,
        currency: "R",
      },
      catalog: [
        { id: uid(), name: "Local Move (up to 3 rooms)", price: 3500, unit: "job" },
        { id: uid(), name: "Packing Service (per hour)", price: 250, unit: "hour" },
        { id: uid(), name: "Extra Labour (per hour)", price: 180, unit: "hour" },
        { id: uid(), name: "Storage (per month)", price: 800, unit: "each" },
      ],
      customers: [],
      docs: [],
      expenses: [],
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      density: "normal" as Density,
      upsertDoc: (d) =>
        set((s) => ({
          docs: s.docs.some((x) => x.id === d.id)
            ? s.docs.map((x) => (x.id === d.id ? d : x))
            : [d, ...s.docs],
          customers: d.customer.name
            ? s.customers.some((c) => c.id === d.customer.id)
              ? s.customers.map((c) => (c.id === d.customer.id ? d.customer : c))
              : [...s.customers, d.customer]
            : s.customers,
        })),
      deleteDoc: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
      upsertCatalog: (c) =>
        set((s) => ({
          catalog: s.catalog.some((x) => x.id === c.id)
            ? s.catalog.map((x) => (x.id === c.id ? c : x))
            : [...s.catalog, c],
        })),
      deleteCatalog: (id) => set((s) => ({ catalog: s.catalog.filter((c) => c.id !== id) })),
      upsertCustomer: (c) =>
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id)
            ? s.customers.map((x) => (x.id === c.id ? c : x))
            : [...s.customers, c],
        })),
      setCompany: (c) => set({ company: c }),
      setBanking: (b) => set({ banking: b }),
      setBilling: (b) => set({ billing: b }),
      nextDocNumber: (t) => {
        const b = get().billing;
        if (t === "quote") {
          const n = b.nextQuoteNo;
          set({ billing: { ...b, nextQuoteNo: n + 1 } });
          return `${b.quotePrefix}-${n}`;
        }
        const n = b.nextInvoiceNo;
        set({ billing: { ...b, nextInvoiceNo: n + 1 } });
        return `${b.invoicePrefix}-${n}`;
      },
      upsertExpense: (e) =>
        set((s) => ({
          expenses: s.expenses.some((x) => x.id === e.id)
            ? s.expenses.map((x) => (x.id === e.id ? e : x))
            : [e, ...s.expenses],
        })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      addExpenseCategory: (name) =>
        set((s) => {
          const n = name.trim();
          if (!n || s.expenseCategories.some((c) => c.toLowerCase() === n.toLowerCase())) return {} as Partial<State>;
          return { expenseCategories: [...s.expenseCategories, n] };
        }),
      renameExpenseCategory: (oldName, newName) =>
        set((s) => {
          const n = newName.trim();
          if (!n) return {} as Partial<State>;
          return {
            expenseCategories: s.expenseCategories.map((c) => (c === oldName ? n : c)),
            expenses: s.expenses.map((e) => (e.category === oldName ? { ...e, category: n } : e)),
          };
        }),
      deleteExpenseCategory: (name) =>
        set((s) => ({
          expenseCategories: s.expenseCategories.filter((c) => c !== name),
          expenses: s.expenses.map((e) => (e.category === name ? { ...e, category: "Other" } : e)),
        })),
      setDensity: (d) => set({ density: d }),
      importHistorical: (p) => {
        const s = get();
        const existingExp = new Set(s.expenses.map((e) => e.id));
        const existingDoc = new Set(s.docs.map((d) => d.id));
        const newExp = p.expenses.filter((e) => !existingExp.has(e.id));
        const newDocs = p.docs.filter((d) => !existingDoc.has(d.id));
        const catNames = new Set(s.expenseCategories);
        for (const c of p.newExpenseCategories) catNames.add(c);
        const catalogNames = new Set(s.catalog.map((c) => c.name.toLowerCase()));
        const addedCatalog = p.newCatalogItems.filter(
          (c) => !catalogNames.has(c.name.toLowerCase()),
        );
        set({
          expenses: [...newExp, ...s.expenses],
          docs: [...newDocs, ...s.docs],
          expenseCategories: Array.from(catNames),
          catalog: [...s.catalog, ...addedCatalog],
          billing: {
            ...s.billing,
            nextInvoiceNo: Math.max(s.billing.nextInvoiceNo, p.maxInvoiceNo + 1),
          },
        });
        return { expenses: newExp.length, docs: newDocs.length };
      },
      clearHistorical: () => {
        const s = get();
        const expBefore = s.expenses.length;
        const docBefore = s.docs.length;
        const isImported = (id: string) => id.startsWith("hist-") || id.startsWith("bank-");
        const expenses = s.expenses.filter((e) => !isImported(e.id));
        const docs = s.docs.filter((d) => !isImported(d.id));
        const catalog = s.catalog.filter((c) => !c.id.startsWith("hist-cat-"));
        set({ expenses, docs, catalog });
        return { expenses: expBefore - expenses.length, docs: docBefore - docs.length };
      },
    }),
    { name: "moove-store-v1" },
  ),
);

export const newId = uid;

export function docTotals(d: Doc, vatPct: number) {
  const subtotal = d.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + vat;
  const deposit = total * (d.depositPct / 100);
  const balance = total - (d.depositPaid ? deposit : 0);
  return { subtotal, vat, total, deposit, balance };
}

export function fmtMoney(n: number, cur = "R") {
  return `${cur} ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}