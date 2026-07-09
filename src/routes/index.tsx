import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore, newId, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { Plus, FileText, Truck } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const nav = useNavigate();
  const { docs, billing, company, nextDocNumber, upsertDoc } = useStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayJobs = docs.filter((d) => d.scheduledDate === today);

  const newQuote = () => {
    const id = newId();
    const d: Doc = {
      id,
      number: nextDocNumber("quote"),
      type: "quote",
      status: "draft",
      createdAt: new Date().toISOString(),
      customer: { id: newId(), name: "", phone: "", email: "" },
      items: [],
      depositPct: billing.defaultDepositPct,
      depositPaid: false,
    };
    upsertDoc(d);
    nav({ to: "/doc/$id", params: { id } });
  };

  const stats = {
    quotes: docs.filter((d) => d.type === "quote").length,
    invoices: docs.filter((d) => d.type === "invoice").length,
    outstanding: docs
      .filter((d) => d.type === "invoice" && d.status !== "paid")
      .reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0),
    paidThisMonth: docs
      .filter((d) => d.status === "paid" && d.paidAt && d.paidAt.startsWith(format(new Date(), "yyyy-MM")))
      .reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0),
  };

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-5xl tracking-wide">DASHBOARD</h1>
          <p className="text-muted-foreground">Welcome back to {company.name}</p>
        </div>
        <Button size="lg" onClick={newQuote} className="h-14 px-8 text-lg font-semibold">
          <Plus className="mr-2 h-5 w-5" /> New Quote
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Quotes" value={String(stats.quotes)} />
        <Stat label="Invoices" value={String(stats.invoices)} />
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, billing.currency)} />
        <Stat label="Paid (month)" value={fmtMoney(stats.paidThisMonth, billing.currency)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> TODAY'S JOBS</h2>
          {todayJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs scheduled today.</p>
          ) : (
            <ul className="space-y-2">
              {todayJobs.map((d) => (
                <li key={d.id}>
                  <Link to="/doc/$id" params={{ id: d.id }} className="flex justify-between p-2 rounded hover:bg-muted">
                    <span>{d.customer.name || "—"}</span>
                    <span className="text-muted-foreground">{d.number}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> RECENT</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet. Tap New Quote to start.</p>
          ) : (
            <ul className="space-y-2">
              {docs.slice(0, 8).map((d) => {
                const t = docTotals(d, billing.vatPct);
                return (
                  <li key={d.id}>
                    <Link to="/doc/$id" params={{ id: d.id }} className="flex justify-between p-2 rounded hover:bg-muted text-sm">
                      <span className="flex gap-2 items-center">
                        <span className={`text-xs uppercase font-bold px-1.5 py-0.5 rounded ${d.type === "invoice" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d.type}</span>
                        <span className="font-medium">{d.number}</span>
                        <span className="text-muted-foreground">{d.customer.name || "—"}</span>
                      </span>
                      <span>{fmtMoney(t.total, billing.currency)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-display mt-1">{value}</div>
    </Card>
  );
}
