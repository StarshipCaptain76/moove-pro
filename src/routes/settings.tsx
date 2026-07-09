import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, newId, type Unit, type Density } from "@/lib/store";
import { Trash2, Plus, Search, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const s = useStore();
  return (
    <Shell>
      <Tabs defaultValue="company">
        <TabsList className="mb-4 w-full grid grid-cols-6">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="appearance">Display</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl">
            {(["name","tagline","address","phone","email"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k}</Label>
                <Input className="h-11" value={s.company[k] ?? ""} onChange={(e) => s.setCompany({ ...s.company, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
          <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl">
            {(["accountName","accountNumber","bank","branchCode","branchName","swiftCode"] as const).map((k) => (
              <div key={k}>
                <Label>{k}</Label>
                <Input className="h-11" value={s.banking[k]} onChange={(e) => s.setBanking({ ...s.banking, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogEditor />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpenseCategoriesEditor />
        </TabsContent>

        <TabsContent value="billing">
          <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl">
            <NumField label="Rate per KM" v={s.billing.ratePerKm} on={(v) => s.setBilling({ ...s.billing, ratePerKm: v })} />
            <NumField label="Base callout fee" v={s.billing.baseCallout} on={(v) => s.setBilling({ ...s.billing, baseCallout: v })} />
            <NumField label="Default deposit %" v={s.billing.defaultDepositPct} on={(v) => s.setBilling({ ...s.billing, defaultDepositPct: v })} />
            <NumField label="VAT %" v={s.billing.vatPct} on={(v) => s.setBilling({ ...s.billing, vatPct: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quote prefix</Label><Input className="h-11" value={s.billing.quotePrefix} onChange={(e) => s.setBilling({ ...s.billing, quotePrefix: e.target.value })} /></div>
              <div><Label>Invoice prefix</Label><Input className="h-11" value={s.billing.invoicePrefix} onChange={(e) => s.setBilling({ ...s.billing, invoicePrefix: e.target.value })} /></div>
              <NumField label="Next quote #" v={s.billing.nextQuoteNo} on={(v) => s.setBilling({ ...s.billing, nextQuoteNo: v })} />
              <NumField label="Next invoice #" v={s.billing.nextInvoiceNo} on={(v) => s.setBilling({ ...s.billing, nextInvoiceNo: v })} />
            </div>
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceEditor />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function AppearanceEditor() {
  const { density, setDensity } = useStore();
  const opts: { v: Density; label: string; desc: string }[] = [
    { v: "compact", label: "Compact", desc: "Maximum info on screen" },
    { v: "normal", label: "Normal", desc: "Balanced default" },
    { v: "comfortable", label: "Comfortable", desc: "Larger text, easier to tap" },
  ];
  return (
    <Card className="p-4 sm:p-6 max-w-2xl">
      <Label className="mb-2 block">Display density</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Adjusts font size and spacing across the whole app.
      </p>
      <div className="grid gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setDensity(o.v)}
            className={
              "text-left border rounded-md p-3 transition-colors " +
              (density === o.v
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-muted/50")
            }
          >
            <div className="font-semibold">{o.label}</div>
            <div className="text-xs text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ExpenseCategoriesEditor() {
  const { expenseCategories, addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } = useStore();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const sorted = useMemo(
    () => [...expenseCategories].sort((a, b) => a.localeCompare(b)),
    [expenseCategories],
  );

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    addExpenseCategory(n);
    setNewName("");
  };

  return (
    <Card className="p-4 sm:p-6 max-w-2xl">
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="New category…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="h-11"
        />
        <Button onClick={add} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <ul className="divide-y rounded-md border">
        {sorted.map((c) => {
          const isEdit = editing === c;
          return (
            <li key={c} className="flex items-center gap-2 px-3 py-2 bg-card">
              {isEdit ? (
                <>
                  <Input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameExpenseCategory(c, editVal);
                        setEditing(null);
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-10"
                  />
                  <Button size="icon" variant="ghost" onClick={() => { renameExpenseCategory(c, editVal); setEditing(null); }}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 text-left font-medium"
                    onClick={() => { setEditing(c); setEditVal(c); }}
                  >
                    {c}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteExpenseCategory(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" inputMode="decimal" className="h-11" value={v} onChange={(e) => on(Number(e.target.value))} />
    </div>
  );
}

function CatalogEditor() {
  const { catalog, billing, upsertCatalog, deleteCatalog } = useStore();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...catalog]
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase().trim()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, q],
  );

  const addNew = () => {
    const id = newId();
    upsertCatalog({ id, name: "New item", price: 0, unit: "each" });
    setOpenId(id);
    setQ("");
  };

  return (
    <Card className="p-4 sm:p-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search catalog…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={addNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add item
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {catalog.length === 0 ? "No items yet." : "No matches."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sorted.map((c) => {
            const open = openId === c.id;
            return (
              <li key={c.id} className="bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtMoney(c.price, billing.currency)} <span className="opacity-60">/ {c.unit}</span>
                    </div>
                  </div>
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t bg-muted/20">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => upsertCatalog({ ...c, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Price ({billing.currency})</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={c.price}
                          onChange={(e) => upsertCatalog({ ...c, price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <select
                          className="h-10 w-full border rounded-md px-2 bg-background text-sm"
                          value={c.unit}
                          onChange={(e) => upsertCatalog({ ...c, unit: e.target.value as Unit })}
                        >
                          <option value="each">each</option>
                          <option value="hour">hour</option>
                          <option value="km">km</option>
                          <option value="job">job</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        deleteCatalog(c.id);
                        setOpenId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}