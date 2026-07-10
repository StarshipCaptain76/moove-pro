import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { ChevronRight, FileText, Truck } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { docs, billing, company, upsertDoc } = useStore();

  // Auto-archive: quotes older than 10 days that are still draft/sent.
  useEffect(() => {
    const now = new Date();
    docs.forEach((d) => {
      if (
        d.type === "quote" &&
        !d.archived &&
        (d.status === "draft" || d.status === "sent") &&
        differenceInCalendarDays(now, new Date(d.createdAt)) > 10
      ) {
        upsertDoc({ ...d, archived: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = docs.filter((d) => !d.archived);
  // Hide legacy archived quotes created before this cutoff — only quotes
  // archived from today onward appear in the archived list.
  const ARCHIVED_CUTOFF = "2026-07-10";
  const archived = docs.filter(
    (d) => d.archived && (d.createdAt ?? "") >= ARCHIVED_CUTOFF,
  );
  const [showArchived, setShowArchived] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const jobDate = (d: Doc) => d.scheduledDate || (d.status === "paid" && d.paidAt ? format(new Date(d.paidAt), "yyyy-MM-dd") : undefined);
  const todayJobs = docs.filter((d) => jobDate(d) === today && d.status !== "cancelled");

  const thisMonth = format(new Date(), "yyyy-MM");
  const inThisMonth = (d: (typeof docs)[number]) => (d.createdAt ?? "").startsWith(thisMonth);
  const stats = {
    quotes: docs.filter((d) => d.type === "quote" && inThisMonth(d)).length,
    invoices: docs.filter((d) => d.type === "invoice" && inThisMonth(d)).length,
    outstanding: docs
      .filter((d) => d.type === "invoice" && d.status !== "paid")
      .reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0),
    paidThisMonth: docs
      .filter((d) => {
        if (d.status !== "paid") return false;
        const stamp = d.paidAt ?? d.createdAt;
        return stamp?.startsWith(thisMonth);
      })
      .reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0),
  };

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, billing.currency)} accent />
        <Stat label="Paid (month)" value={fmtMoney(stats.paidThisMonth, billing.currency)} />
        <Stat label="Quotes (month)" value={String(stats.quotes)} to="/docs" search={{ type: "quote" }} />
        <Stat label="Invoices (month)" value={String(stats.invoices)} to="/docs" search={{ type: "invoice" }} />
      </div>

      <Card className="p-3 sm:p-4">
        <Tabs defaultValue="today">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="today"><Truck className="h-4 w-4 mr-1.5" />Today ({todayJobs.length})</TabsTrigger>
            <TabsTrigger value="recent"><FileText className="h-4 w-4 mr-1.5" />Recent ({visible.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-0">
            {todayJobs.length === 0 ? (
              <Empty>No jobs scheduled today.</Empty>
            ) : (
              <List docs={todayJobs} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
          <TabsContent value="recent" className="mt-0">
            {visible.length === 0 ? (
              <Empty>Tap + to create your first quote or invoice.</Empty>
            ) : (
              <List docs={visible.slice(0, 15)} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {archived.length > 0 && (
        <div className="mt-4">
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} archived quotes ({archived.length})
          </button>
          {showArchived && (
            <Card className="p-3 mt-2">
              <ul className="divide-y">
                {archived.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-2">
                    <Link
                      to="/doc/$id"
                      params={{ id: d.id }}
                      className="min-w-0 flex-1"
                    >
                      <div className="text-xs font-mono text-muted-foreground">{d.number}</div>
                      <div className="font-medium truncate">{d.customer.name || "—"}</div>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => upsertDoc({ ...d, archived: false })}
                    >
                      Unarchive
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}

function Stat({ label, value, accent, to, search }: { label: string; value: string; accent?: boolean; to?: string; search?: Record<string, unknown> }) {
  const body = (
    <>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display mt-1 leading-none ${accent ? "text-primary" : ""} text-xl sm:text-2xl truncate`}>{value}</div>
    </>
  );
  return (
    <Card className={cn("p-3 sm:p-4", accent ? "border-primary/30 bg-primary/5" : "", to && "hover:bg-accent/50 transition-colors")}>
      {to ? (
        <Link to={to} search={search} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{children}</p>;
}

function List({ docs, currency, vat }: { docs: Doc[]; currency: string; vat: number }) {
  return (
    <ul className="divide-y">
      {docs.map((d) => {
        const t = docTotals(d, vat);
        return (
          <li key={d.id}>
            <Link
              to="/doc/$id"
              params={{ id: d.id }}
              className="flex items-center gap-2 py-3 -mx-1 px-1 active:bg-muted rounded"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${d.type === "invoice" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d.type}</span>
                  <span className="text-xs font-mono text-muted-foreground">{d.number}</span>
                  {d.status === "paid" && <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />}
                  {d.type === "invoice" && d.status !== "paid" && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">unpaid</span>}
                </div>

                <div className="font-medium truncate">{d.customer.name || "—"}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{fmtMoney(t.total, currency)}</div>
                {d.scheduledDate && <div className="text-[10px] text-muted-foreground">{format(new Date(d.scheduledDate), "d MMM")}</div>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
