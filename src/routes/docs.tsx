import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { ChevronRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/docs")({
  component: DocsListPage,
  validateSearch: (search: Record<string, unknown>) => ({
    type: search.type === "quote" || search.type === "invoice" ? search.type : undefined,
    status: search.status === "unpaid" ? search.status : undefined,
  }),
});

function DocsListPage() {
  const { docs, billing } = useStore();
  const { type, status } = useSearch({ from: "/docs" });

  let title: string;
  if (status === "unpaid") title = "Outstanding invoices";
  else if (type === "quote") title = "Quotes";
  else if (type === "invoice") title = "Invoices";
  else title = "Quotes & Invoices";

  const filtered = docs
    .filter((d) => {
      if (type && d.type !== type) return false;
      if (status === "unpaid") return d.type === "invoice" && d.status !== "paid";
      return d.type === "quote" || d.type === "invoice";
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl">{title}</h1>
      </div>

      <Card className="p-3 sm:p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No {status === "unpaid" ? "outstanding invoices" : type ?? "quotes or invoices"} found.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((d) => (
              <DocRow key={d.id} doc={d} currency={billing.currency} vat={billing.vatPct} />
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function DocRow({ doc, currency, vat }: { doc: Doc; currency: string; vat: number }) {
  const t = docTotals(doc, vat);
  return (
    <li>
      <Link
        to="/doc/$id"
        params={{ id: doc.id }}
        className="flex items-center gap-2 py-3 -mx-1 px-1 active:bg-muted rounded"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={cn(
                "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                doc.type === "invoice"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {doc.type}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{doc.number}</span>
            {doc.status === "paid" && <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />}
            {doc.type === "invoice" && doc.status !== "paid" && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">unpaid</span>
            )}
          </div>

          <div className="font-medium truncate">{doc.customer.name || "—"}</div>
          <div className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "d MMM yyyy")}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{fmtMoney(t.total, currency)}</div>
          {doc.scheduledDate && <div className="text-[10px] text-muted-foreground">{format(new Date(doc.scheduledDate), "d MMM")}</div>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}
