import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, type Doc, type Expense } from "@/lib/store";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, Legend, CartesianGrid, LineChart, Line, ComposedChart,
} from "recharts";
import {
  format, parseISO, differenceInCalendarDays, eachDayOfInterval,
  eachMonthOfInterval, eachYearOfInterval, startOfMonth, startOfYear,
  isWithinInterval, endOfDay, startOfDay,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { RangePicker, resolveRange, previousRange, type RangeValue } from "@/components/app/RangePicker";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Revenue & Reports — MOOVE" },
      { name: "description", content: "Revenue, expenses, cash flow and customer reports with flexible date ranges." },
    ],
  }),
  component: ResultsPage,
});

const COLORS = ["#E11D2E", "#0A0A0A", "#6B6B6B", "#F5A623", "#16A34A", "#2563EB", "#7C3AED", "#0891B2"];
const STORAGE_KEY = "moove-report-range";

function inRange(dateStr: string | undefined, from: Date, to: Date) {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start: startOfDay(from), end: endOfDay(to) });
  } catch { return false; }
}

function ResultsPage() {
  const { docs, billing, expenses } = useStore();

  const [range, setRange] = useState<RangeValue>({ preset: "this-month" });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRange(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(range)); } catch { /* noop */ }
  }, [range]);

  const { from, to, label } = useMemo(() => resolveRange(range), [range]);
  const prev = useMemo(() => previousRange(from, to), [from, to]);
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);

  const paidAll = useMemo(() => docs.filter((d) => d.status === "paid" && d.paidAt), [docs]);
  const paid = useMemo(() => paidAll.filter((d) => inRange(d.paidAt, from, to)), [paidAll, from, to]);
  const paidPrev = useMemo(() => paidAll.filter((d) => inRange(d.paidAt, prev.from, prev.to)), [paidAll, prev.from, prev.to]);
  const exp = useMemo(() => expenses.filter((e) => inRange(e.date, from, to)), [expenses, from, to]);
  const expPrev = useMemo(() => expenses.filter((e) => inRange(e.date, prev.from, prev.to)), [expenses, prev.from, prev.to]);

  const sumRev = (arr: Doc[]) => arr.reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0);
  const sumExp = (arr: Expense[]) => arr.reduce((s, e) => s + (e.amount || 0), 0);

  // "Owner draw" / personal-use categories — treated as salary the owner takes
  // out of the business rather than a cost of doing business. Gross profit
  // excludes these; the trend chart overlays them on top of revenue.
  const isSalaryCat = (c: string) => {
    const n = (c || "").toLowerCase();
    return /salary|wage|owner|drawing|food|grocer|restaur|entertain|personal|househ|leisure/.test(n);
  };
  const sumSalary = (arr: Expense[]) => arr.filter((e) => isSalaryCat(e.category)).reduce((s, e) => s + (e.amount || 0), 0);

  const revenue = sumRev(paid);
  const revenuePrev = sumRev(paidPrev);
  const totalExp = sumExp(exp);
  const totalExpPrev = sumExp(expPrev);
  const salary = sumSalary(exp);
  const salaryPrev = sumSalary(expPrev);
  const grossProfit = revenue - (totalExp - salary);
  const grossProfitPrev = revenuePrev - (totalExpPrev - salaryPrev);
  const net = revenue - totalExp;
  const netPrev = revenuePrev - totalExpPrev;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  const marginPrev = revenuePrev > 0 ? ((revenuePrev - totalExpPrev) / revenuePrev) * 100 : 0;
  const paidCount = paid.length;
  const paidCountPrev = paidPrev.length;
  const avg = paidCount ? revenue / paidCount : 0;
  const avgPrev = paidCountPrev ? revenuePrev / paidCountPrev : 0;

  const now = new Date();
  const outstanding = docs
    .filter((d) => d.type === "invoice" && d.status !== "paid" && d.status !== "cancelled")
    .reduce((s, d) => s + docTotals(d, billing.vatPct).balance, 0);
  const overdueCount = docs.filter(
    (d) => d.type === "invoice" && d.status !== "paid" && d.status !== "cancelled"
      && d.scheduledDate && parseISO(d.scheduledDate) < now,
  ).length;

  // Bucket selection
  const bucket: "day" | "month" | "year" = days <= 62 ? "day" : days <= 550 ? "month" : "year";
  const buckets = useMemo(() => {
    if (bucket === "day") return eachDayOfInterval({ start: from, end: to });
    if (bucket === "month") return eachMonthOfInterval({ start: startOfMonth(from), end: to });
    return eachYearOfInterval({ start: startOfYear(from), end: to });
  }, [bucket, from, to]);
  const bucketKey = (d: Date) =>
    bucket === "day" ? format(d, "yyyy-MM-dd")
    : bucket === "month" ? format(d, "yyyy-MM")
    : format(d, "yyyy");
  const bucketLabel = (d: Date) =>
    bucket === "day" ? format(d, "d MMM")
    : bucket === "month" ? format(d, "MMM yy")
    : format(d, "yyyy");

  const cashflow = useMemo(() => buckets.map((b) => {
    const key = bucketKey(b);
    const r = paid.filter((d) => d.paidAt?.startsWith(key)).reduce((s, d) => s + docTotals(d, billing.vatPct).total, 0);
    const e = exp.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + (x.amount || 0), 0);
    const s = exp.filter((x) => x.date.startsWith(key) && isSalaryCat(x.category)).reduce((a, x) => a + (x.amount || 0), 0);
    return { label: bucketLabel(b), Revenue: Math.round(r), Expenses: Math.round(e), Salary: Math.round(s), Net: Math.round(r - e) };
  }), [buckets, paid, exp, billing.vatPct, bucket]);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = { cash: 0, eft: 0, card: 0 };
    paid.forEach((d) => {
      const t = docTotals(d, billing.vatPct).total;
      if (d.paymentMethod) m[d.paymentMethod] += t;
    });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [paid, billing.vatPct]);

  const byService = useMemo(() => {
    const m: Record<string, number> = {};
    paid.forEach((d) => d.items.forEach((it) => {
      m[it.description || "Other"] = (m[it.description || "Other"] ?? 0) + it.qty * it.price;
    }));
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [paid]);
  const svcTotal = byService.reduce((s, x) => s + x.value, 0);

  const expByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    exp.forEach((e) => { m[e.category] = (m[e.category] ?? 0) + (e.amount || 0); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [exp]);

  const topCustomers = useMemo(() => {
    const m: Record<string, { name: string; total: number; jobs: number }> = {};
    paid.forEach((d) => {
      const key = d.customer.name || "—";
      const t = docTotals(d, billing.vatPct).total;
      if (!m[key]) m[key] = { name: key, total: 0, jobs: 0 };
      m[key].total += t;
      m[key].jobs += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [paid, billing.vatPct]);

  const exportCsv = () => {
    const cur = billing.currency;
    const esc = (s: unknown) => {
      const str = String(s ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines: string[] = [];
    lines.push(`Revenue & Reports — ${label}`);
    lines.push(`Currency,${cur}`);
    lines.push("");
    lines.push("Summary");
    lines.push("Metric,Value");
    lines.push(`Revenue,${revenue.toFixed(2)}`);
    lines.push(`Expenses,${totalExp.toFixed(2)}`);
    lines.push(`Net Profit,${net.toFixed(2)}`);
    lines.push(`Margin %,${margin.toFixed(1)}`);
    lines.push(`Invoices Paid,${paidCount}`);
    lines.push(`Avg Invoice,${avg.toFixed(2)}`);
    lines.push("");
    lines.push("Paid Invoices");
    lines.push("Number,Date Paid,Customer,Method,Total");
    paid.forEach((d) => lines.push([
      d.number, d.paidAt, d.customer.name, d.paymentMethod ?? "",
      docTotals(d, billing.vatPct).total.toFixed(2),
    ].map(esc).join(",")));
    lines.push("");
    lines.push("Expenses");
    lines.push("Date,Category,Vendor,Description,Amount");
    exp.forEach((e) => lines.push([e.date, e.category, e.vendor, e.description ?? "", (e.amount || 0).toFixed(2)].map(esc).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moove-report-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-display">Revenue & Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label} · {format(from, "d MMM yy")} – {format(to, "d MMM yy")} · vs previous {days === 1 ? "day" : `${days} days`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="shrink-0">
          <Download className="h-4 w-4 mr-1.5" /> CSV
        </Button>
      </div>

      <Card className="p-2 mb-3">
        <RangePicker value={range} onChange={setRange} />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3">
        <Stat label="Revenue" v={fmtMoney(revenue, billing.currency)} delta={delta(revenue, revenuePrev)} />
        <Stat label="Expenses" v={fmtMoney(totalExp, billing.currency)} delta={delta(totalExp, totalExpPrev)} invert />
        <Stat label="Gross Profit" v={fmtMoney(grossProfit, billing.currency)} delta={delta(grossProfit, grossProfitPrev)} sub="excl. salary/personal" />
        <Stat label="Net Profit" v={fmtMoney(net, billing.currency)} delta={delta(net, netPrev)} />
        <Stat label="Margin" v={`${margin.toFixed(1)}%`} delta={delta(margin, marginPrev, true)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <Stat label="Invoices Paid" v={String(paidCount)} delta={delta(paidCount, paidCountPrev, true)} />
        <Stat label="Avg Invoice" v={fmtMoney(avg, billing.currency)} delta={delta(avg, avgPrev)} />
        <Stat label="Outstanding" v={fmtMoney(outstanding, billing.currency)} sub="as of today" />
        <Stat label="Overdue" v={String(overdueCount)} sub="unpaid, past date" />
      </div>

      <div className="space-y-3">
        <ChartCard title={`Revenue trend (${bucket === "day" ? "daily" : bucket === "month" ? "monthly" : "yearly"})`}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={cashflow} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#E11D2E" />
              <Line dataKey="Salary" stroke="#0A0A0A" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cash flow (Revenue vs Expenses)">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={cashflow} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#16A34A" />
              <Bar dataKey="Expenses" fill="#E11D2E" />
              <Line dataKey="Net" stroke="#0A0A0A" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {byMethod.length > 0 && (
          <ChartCard title="Revenue by payment method">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={70} label={(e) => e.name}>
                  {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v, billing.currency)} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {byService.length > 0 && (
          <ChartCard title="Top services">
            <ul className="space-y-2">
              {byService.map((s, i) => {
                const pct = svcTotal > 0 ? (s.value / svcTotal) * 100 : 0;
                return (
                  <li key={s.name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="truncate pr-2">{s.name}</span>
                      <span className="tabular-nums font-semibold shrink-0">{fmtMoney(s.value, billing.currency)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </ChartCard>
        )}

        {topCustomers.length > 0 && (
          <ChartCard title="Top customers">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  <th className="font-medium py-1">Customer</th>
                  <th className="font-medium py-1 text-right">Jobs</th>
                  <th className="font-medium py-1 text-right">Avg</th>
                  <th className="font-medium py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="py-1.5 truncate max-w-[40vw]">{c.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.jobs}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(c.total / c.jobs, billing.currency)}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">{fmtMoney(c.total, billing.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        )}

        {expByCategory.length > 0 && (
          <ChartCard title="Expenses by category">
            <ul className="space-y-2">
              {expByCategory.map((e, i) => {
                const pct = totalExp > 0 ? (e.value / totalExp) * 100 : 0;
                return (
                  <li key={e.name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="truncate pr-2">{e.name}</span>
                      <span className="tabular-nums font-semibold shrink-0">{fmtMoney(e.value, billing.currency)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </ChartCard>
        )}

        {paid.length === 0 && exp.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No data in this period. Try a different range.
          </Card>
        )}
      </div>
    </Shell>
  );
}

function delta(cur: number, prev: number, isCount = false) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return { pct: null as number | null, up: cur > 0, raw: cur, isCount };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct, up: cur >= prev, raw: cur - prev, isCount };
}

function Stat({
  label, v, delta, sub, invert,
}: {
  label: string; v: string;
  delta?: { pct: number | null; up: boolean; raw: number; isCount: boolean } | null;
  sub?: string; invert?: boolean;
}) {
  const good = delta ? (invert ? !delta.up : delta.up) : false;
  return (
    <Card className="p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl sm:text-2xl font-display mt-1 truncate">{v}</div>
      {delta && (
        <div className={`text-[10px] mt-1 flex items-center gap-0.5 ${good ? "text-green-600" : "text-red-600"}`}>
          {delta.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta.pct == null ? "new" : `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(0)}%`}
        </div>
      )}
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="p-3 sm:p-4"><h3 className="font-semibold text-sm mb-2">{title}</h3>{children}</Card>;
}