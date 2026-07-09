import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { ChevronRight, FileText, Truck } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { docs, billing, company } = useStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayJobs = docs.filter((d) => d.scheduledDate === today);

  const stats = {
    quotes: docs.filter((d) => d.type === "quote").length,
    invoices: docs.filter((d) => d.type === "invoice").length,
    outstanding: docs
      .filter((d) => d.type === "invoice" && d.status !== "paid")
      .reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0),
    paidThisMonth: docs
      .filter((d) => d.status === "paid" && d.paidAt?.startsWith(format(new Date(), "yyyy-MM")))
      .reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0),
  };

  return (
    <Shell>
      <div className="mb-4">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide leading-none">DASHBOARD</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back to {company.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, billing.currency)} accent />
        <Stat label="Paid (month)" value={fmtMoney(stats.paidThisMonth, billing.currency)} />
        <Stat label="Quotes" value={String(stats.quotes)} />
        <Stat label="Invoices" value={String(stats.invoices)} />
      </div>

      <Card className="p-3 sm:p-4">
        <Tabs defaultValue="today">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="today"><Truck className="h-4 w-4 mr-1.5" />Today ({todayJobs.length})</TabsTrigger>
            <TabsTrigger value="recent"><FileText className="h-4 w-4 mr-1.5" />Recent</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-0">
            {todayJobs.length === 0 ? (
              <Empty>No jobs scheduled today.</Empty>
            ) : (
              <List docs={todayJobs} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
          <TabsContent value="recent" className="mt-0">
            {docs.length === 0 ? (
              <Empty>Tap + to create your first quote or invoice.</Empty>
            ) : (
              <List docs={docs.slice(0, 15)} currency={billing.currency} vat={billing.vatPct} />
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={`p-3 sm:p-4 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display mt-1 leading-none ${accent ? "text-primary" : ""} text-xl sm:text-2xl truncate`}>{value}</div>
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
                  {d.status === "paid" && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-green-600 text-white">paid</span>}
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
