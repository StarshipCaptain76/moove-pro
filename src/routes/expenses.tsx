import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore, newId, fmtMoney, type Expense, type PayMethod } from "@/lib/store";
import { categoryColor } from "@/lib/utils";
import { ReceiptCapture } from "@/components/app/ReceiptCapture";
import { parseReceipt } from "@/lib/expenses.functions";
import { DatePicker } from "@/components/app/DatePicker";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, X, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from "date-fns";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const { expenses, billing } = useStore();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<Expense | null>(null);

  const monthExpenses = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return expenses
      .filter((e) => {
        const d = parseISO(e.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, month]);

  const total = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + (e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        color: categoryColor(category).border,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const grouped = useMemo(() => {
    const g = new Map<string, Expense[]>();
    monthExpenses.forEach((e) => {
      const arr = g.get(e.date) ?? [];
      arr.push(e);
      g.set(e.date, arr);
    });
    return Array.from(g.entries());
  }, [monthExpenses]);

  const newExpense = () => {
    setEditing({
      id: newId(),
      createdAt: new Date().toISOString(),
      date: format(new Date(), "yyyy-MM-dd"),
      category: "Other",
      vendor: "",
      amount: 0,
    });
  };

  return (
    <Shell>
      <div className="flex items-center justify-end mb-3">
        <Button size="sm" onClick={newExpense} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <Card className="p-3 mb-3 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="font-display text-xl tracking-wider">{format(month, "MMMM yyyy")}</div>
          <div className="text-xs text-muted-foreground">
            {monthExpenses.length} items · {fmtMoney(total, billing.currency)}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </Card>

      {monthExpenses.length > 0 && mounted && (
        <Card className="p-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-28 w-28 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryTotals}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="95%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {categoryTotals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmtMoney(value, billing.currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="font-display text-[11px] tracking-wide leading-tight text-center">
                  {fmtMoney(total, billing.currency)}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 max-h-28 overflow-y-auto pr-1 space-y-1">
              {categoryTotals.map((c) => {
                const pct = total ? ((c.amount / total) * 100).toFixed(0) : "0";
                return (
                  <div key={c.category} className="flex items-center gap-1.5 text-xs min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 truncate">{c.category}</span>
                    <span className="text-muted-foreground w-7 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No expenses this month. Tap + to snap a slip.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-1">
                {format(parseISO(date), "EEE d MMM")}
              </div>
              <Card className="divide-y">
                {items.map((e) => {
                  const catColor = categoryColor(e.category);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setEditing(e)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 border-l-4 border-transparent"
                      style={{ borderLeftColor: catColor.border }}
                    >
                      {e.receiptImage ? (
                        <img
                          src={e.receiptImage}
                          alt=""
                          className="h-12 w-12 rounded object-cover border shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{e.vendor || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] mr-1"
                            style={{ backgroundColor: catColor.bg, color: catColor.text }}
                          >
                            {e.category}
                          </span>
                          {e.description}
                        </div>
                      </div>
                      <div className="font-semibold shrink-0">
                        {fmtMoney(e.amount, billing.currency)}
                      </div>
                    </button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add button (mobile) */}
      <button
        onClick={newExpense}
        aria-label="Add expense"
        className="sm:hidden fixed right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-7 w-7" />
      </button>

      <ExpenseSheet expense={editing} onClose={() => setEditing(null)} />
    </Shell>
  );
}

function ExpenseSheet({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { upsertExpense, deleteExpense, expenseCategories } = useStore();
  const [draft, setDraft] = useState<Expense | null>(expense);
  const [parsing, setParsing] = useState(false);

  // Reset draft when a different expense is opened
  if (expense && (!draft || draft.id !== expense.id)) {
    setDraft(expense);
  }
  if (!expense || !draft) return null;

  const set = (patch: Partial<Expense>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleCapture = async (dataUrl: string) => {
    set({ receiptImage: dataUrl });
    setParsing(true);
    try {
      const r = await parseReceipt({
        data: { imageDataUrl: dataUrl, categories: expenseCategories },
      });
      set({
        date: r.date || draft.date,
        vendor: r.vendor || draft.vendor,
        amount: r.total ?? draft.amount,
        vatAmount: r.vat ?? draft.vatAmount,
        category: r.category || draft.category,
        description: r.description || draft.description,
        paymentMethod: (r.paymentMethod as PayMethod | null) ?? draft.paymentMethod,
      });
      toast.success("Slip read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read slip");
    } finally {
      setParsing(false);
    }
  };

  const save = () => {
    if (!draft.vendor && !draft.amount) {
      toast.error("Add a vendor or amount");
      return;
    }
    upsertExpense(draft);
    toast.success("Saved");
    onClose();
  };

  return (
    <Sheet open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-wide">EXPENSE</SheetTitle>
        </SheetHeader>

        <div className="grid gap-3 mt-3 pb-[env(safe-area-inset-bottom)]">
          {draft.receiptImage ? (
            <div className="relative">
              <img
                src={draft.receiptImage}
                alt="Receipt"
                className="w-full max-h-64 object-contain rounded border bg-muted"
              />
              <button
                type="button"
                onClick={() => set({ receiptImage: undefined })}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
              {parsing && (
                <div className="absolute inset-0 rounded bg-black/50 text-white flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <div className="text-sm">Reading slip…</div>
                </div>
              )}
            </div>
          ) : (
            <ReceiptCapture onCapture={handleCapture} disabled={parsing} />
          )}

          {parsing && !draft.receiptImage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading slip…
            </div>
          )}

          {draft.receiptImage && !parsing && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI-filled — check fields below
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <DatePicker value={draft.date} onChange={(iso) => set({ date: iso })} />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <InlineTumbler
                value={draft.amount || 0}
                onChange={(v) => set({ amount: v })}
                step={10}
                fineStep={1}
                min={0}
                label="Amount"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="h-11 w-full border rounded-md px-2 bg-background"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Vendor</Label>
            <Input
              className="h-11"
              value={draft.vendor}
              onChange={(e) => set({ vendor: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              className="h-11"
              value={draft.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">VAT (optional)</Label>
              <InlineTumbler
                value={draft.vatAmount ?? 0}
                onChange={(v) => set({ vatAmount: v > 0 ? v : undefined })}
                step={1}
                min={0}
                label="VAT amount"
              />
            </div>
            <div>
              <Label className="text-xs">Paid with</Label>
              <select
                className="h-11 w-full border rounded-md px-2 bg-background"
                value={draft.paymentMethod ?? ""}
                onChange={(e) =>
                  set({ paymentMethod: (e.target.value || undefined) as PayMethod | undefined })
                }
              >
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="eft">EFT</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                deleteExpense(draft.id);
                toast.success("Deleted");
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={parsing}>
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
