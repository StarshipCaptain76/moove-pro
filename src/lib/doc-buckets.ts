import { differenceInCalendarDays } from "date-fns";
import type { Doc } from "./store";

export type BucketKey =
  | "inv-draft"
  | "inv-unpaid"
  | "inv-overdue"
  | "inv-paid"
  | "quote-draft"
  | "quote-awaiting"
  | "quote-accepted"
  | "quote-declined";

const daysOld = (iso?: string) => (iso ? differenceInCalendarDays(new Date(), new Date(iso)) : 0);

const isThisMonth = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export const bucketMatch: Record<BucketKey, (d: Doc) => boolean> = {
  "inv-draft":     (d) => d.type === "invoice" && d.status === "draft",
  "inv-unpaid":    (d) => d.type === "invoice" && (d.status === "sent" || d.status === "accepted") && daysOld(d.createdAt) <= 14,
  "inv-overdue":   (d) => d.type === "invoice" && (d.status === "sent" || d.status === "accepted") && daysOld(d.createdAt) > 14,
  "inv-paid":      (d) => d.type === "invoice" && d.status === "paid" && isThisMonth(d.paidAt ?? d.updatedAt),
  "quote-draft":   (d) => d.type === "quote" && d.status === "draft" && !d.archived,
  "quote-awaiting":(d) => d.type === "quote" && d.status === "sent" && !d.archived,
  "quote-accepted":(d) => d.type === "quote" && d.status === "accepted",
  "quote-declined":(d) => d.type === "quote" && (d.status === "cancelled" || ((d.status === "draft" || d.status === "sent") && daysOld(d.createdAt) > 10)),
};

export const bucketLabel: Record<BucketKey, string> = {
  "inv-draft": "Draft",
  "inv-unpaid": "Unpaid",
  "inv-overdue": "Overdue",
  "inv-paid": "Paid",
  "quote-draft": "Draft",
  "quote-awaiting": "Awaiting acceptance",
  "quote-accepted": "Accepted",
  "quote-declined": "Declined",
};

export const bucketTitle: Record<BucketKey, string> = {
  "inv-draft": "Draft invoices",
  "inv-unpaid": "Unpaid invoices",
  "inv-overdue": "Overdue invoices",
  "inv-paid": "Paid invoices this month",
  "quote-draft": "Draft quotes",
  "quote-awaiting": "Quotes awaiting acceptance",
  "quote-accepted": "Accepted quotes",
  "quote-declined": "Declined quotes",
};

// Tailwind bg + text classes for the count badge
export const bucketBadge: Record<BucketKey, string> = {
  "inv-draft":       "bg-amber-500 text-white",
  "inv-unpaid":      "bg-blue-500 text-white",
  "inv-overdue":     "bg-red-500 text-white",
  "inv-paid":        "bg-emerald-500 text-white",
  "quote-draft":     "bg-amber-500 text-white",
  "quote-awaiting":  "bg-blue-500 text-white",
  "quote-accepted":  "bg-emerald-500 text-white",
  "quote-declined":  "bg-red-500 text-white",
};

export const invoiceBuckets: BucketKey[] = ["inv-draft", "inv-unpaid", "inv-overdue", "inv-paid"];
export const quoteBuckets: BucketKey[] = ["quote-draft", "quote-awaiting", "quote-accepted", "quote-declined"];

export function isBucketKey(v: unknown): v is BucketKey {
  return typeof v === "string" && v in bucketMatch;
}