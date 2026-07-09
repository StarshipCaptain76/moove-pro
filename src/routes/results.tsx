import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { useStore, docTotals, fmtMoney } from "@/lib/store";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { format, subMonths } from "date-fns";
import { useMemo } from "react";

export const Route = createFileRoute("/results")({ component: ResultsPage });

const COLORS = ["#E11D2E", "#0A0A0A", "#6B6B6B", "#F5A623", "#16A34A"];

function ResultsPage() {
  const { docs, billing } = useStore();
  const paid = docs.filter((d) => d.status === "paid" && d.paidAt);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = { cash: 0, eft: 0, card: 0 };
    paid.forEach((d) => {
      const t = docTotals(d, billing.vatPct).total;
      if (d.paymentMethod) m[d.paymentMethod] += t;
    });
    return Object.entries(m).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [paid, billing.vatPct]);

  const byService = useMemo(() => {
    const m: Record<string, number> = {};
    paid.forEach((d) => d.items.forEach((it) => {
      m[it.description || "Other"] = (m[it.description || "Other"] ?? 0) + it.qty * it.price;
    }));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [paid]);

  const mom = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      const key = format(d, "yyyy-MM");
      const rev = paid.filter((x) => x.paidAt?.startsWith(key)).reduce((s, x) => s + docTotals(x, billing.vatPct).total, 0);
      return { month: format(d, "MMM"), revenue: Math.round(rev) };
    });
    return arr;
  }, [paid, billing.vatPct]);

  const yoy = useMemo(() => {
    const thisY = new Date().getFullYear();
    const arr = Array.from({ length: 12 }, (_, i) => {
      const monthLabel = format(new Date(thisY, i, 1), "MMM");
      const cur = paid.filter((x) => x.paidAt?.startsWith(`${thisY}-${String(i+1).padStart(2,"0")}`)).reduce((s,x)=>s+docTotals(x,billing.vatPct).total,0);
      const prev = paid.filter((x) => x.paidAt?.startsWith(`${thisY-1}-${String(i+1).padStart(2,"0")}`)).reduce((s,x)=>s+docTotals(x,billing.vatPct).total,0);
      return { month: monthLabel, [String(thisY)]: Math.round(cur), [String(thisY-1)]: Math.round(prev) };
    });
    return arr;
  }, [paid, billing.vatPct]);

  const totalRev = paid.reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0);
  const outstanding = docs.filter((d) => d.type === "invoice" && d.status !== "paid").reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0);

  return (
    <Shell>
      <h1 className="font-display text-5xl tracking-wide mb-6">RESULTS</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Revenue" v={fmtMoney(totalRev, billing.currency)} />
        <Stat label="Outstanding" v={fmtMoney(outstanding, billing.currency)} />
        <Stat label="Jobs Paid" v={String(paid.length)} />
        <Stat label="Quotes" v={String(docs.filter(d=>d.type==="quote").length)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Revenue by Payment Method">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={90} label>
                {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue by Service">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byService} dataKey="value" nameKey="name" outerRadius={90} label>
                {byService.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Month-over-Month Revenue (12 mo)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={mom}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
            <Bar dataKey="revenue" fill="#E11D2E" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="h-4" />
      <ChartCard title="Year-over-Year Comparison">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={yoy}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
            <Legend />
            <Bar dataKey={String(new Date().getFullYear() - 1)} fill="#6B6B6B" />
            <Bar dataKey={String(new Date().getFullYear())} fill="#E11D2E" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </Shell>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{v}</div></Card>;
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="p-4"><h3 className="font-semibold mb-3">{title}</h3>{children}</Card>;
}