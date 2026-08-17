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
import { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "@/lib/store";
import historical from "@/data/historical.json";
import bankImport from "@/data/bank-import-2026.json";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { Slider } from "@/components/ui/slider";
import { WheelSelect } from "@/components/app/WheelSelect";
import { notificationStatus, requestNotificationPermission } from "@/lib/reminders";
import { useServerFn } from "@tanstack/react-start";
import {
  listCalendars,
  getCalendarSettings,
  saveCalendarSettings,
  syncCalendar,
} from "@/lib/calendar.functions";
import { refreshSync } from "@/lib/sync";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const s = useStore();
  return (
    <Shell>
      <Tabs defaultValue="company">
        <TabsList className="mb-4 w-full grid grid-cols-8">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="appearance">Display</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="grid gap-4 max-w-2xl">
          <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl">
            {(["name","tagline","address","phone","email"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k}</Label>
                <Input className="h-11" value={s.company[k] ?? ""} onChange={(e) => s.setCompany({ ...s.company, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
          </div>
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
            <TumblerField label="Rate per KM" v={s.billing.ratePerKm} on={(v) => s.setBilling({ ...s.billing, ratePerKm: v })} step={1} fineStep={0.5} prefix={`${s.billing.currency} `} />
            <TumblerField label="Base callout fee" v={s.billing.baseCallout} on={(v) => s.setBilling({ ...s.billing, baseCallout: v })} step={50} fineStep={10} prefix={`${s.billing.currency} `} />
            <PctSlider label="Default deposit" v={s.billing.defaultDepositPct} on={(v) => s.setBilling({ ...s.billing, defaultDepositPct: v })} />
            <PctSlider label="VAT" v={s.billing.vatPct} on={(v) => s.setBilling({ ...s.billing, vatPct: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quote prefix</Label><Input className="h-11" value={s.billing.quotePrefix} onChange={(e) => s.setBilling({ ...s.billing, quotePrefix: e.target.value })} /></div>
              <div><Label>Invoice prefix</Label><Input className="h-11" value={s.billing.invoicePrefix} onChange={(e) => s.setBilling({ ...s.billing, invoicePrefix: e.target.value })} /></div>
              <TumblerField label="Next quote #" v={s.billing.nextQuoteNo} on={(v) => s.setBilling({ ...s.billing, nextQuoteNo: v })} step={1} />
              <TumblerField label="Next invoice #" v={s.billing.nextInvoiceNo} on={(v) => s.setBilling({ ...s.billing, nextInvoiceNo: v })} step={1} />
            </div>
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
          <RemindersEditor />
        </TabsContent>

        <TabsContent value="calendar">
          <GoogleCalendarCard />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceEditor />
        </TabsContent>

        <TabsContent value="data">
          <DataEditor />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function DataEditor() {
  return <DataEditorInner />;
}

function GoogleCalendarCard() {
  const load = useServerFn(getCalendarSettings);
  const listFn = useServerFn(listCalendars);
  const saveFn = useServerFn(saveCalendarSettings);
  const syncFn = useServerFn(syncCalendar);

  const [cals, setCals] = useState<Array<{ id: string; name: string; primary: boolean }>>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await load();
        if (!alive) return;
        setCalendarId(s.calendarId);
        setExtraIds(s.sources.map((x) => x.id).filter((id) => id !== s.calendarId));
        setEnabled(s.enabled);
        setLastSync(s.lastSyncAt);
        const list = await listFn();
        if (!alive) return;
        setCals(list);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [load, listFn]);

  const persist = async (next: {
    calendarId: string | null;
    enabled: boolean;
    extraIds: string[];
  }) => {
    setBusy(true);
    try {
      await saveFn({
        data: {
          calendarId: next.calendarId,
          calendarName: cals.find((c) => c.id === next.calendarId)?.name ?? null,
          enabled: next.enabled,
          sources: next.extraIds.map((id) => ({
            id,
            name: cals.find((c) => c.id === id)?.name ?? id,
          })),
        },
      });
      toast.success("Calendar settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    setBusy(true);
    try {
      const r = await syncFn({ data: { origin: window.location.origin } });
      if (r.skipped) {
        toast.message("Sync is off — pick a calendar and switch it on.");
      } else {
        toast.success(
          `Synced: ${r.pushed} sent, ${r.created} imported, ${r.updated} updated${r.remaining ? `, ${r.remaining} queued` : ""}`,
        );
        setLastSync(new Date().toISOString());
        await refreshSync();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 grid gap-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Google Calendar</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Scheduled jobs, invoices and quotes are written to the main calendar. New appointments on
        any of the calendars you tick come back as job cards.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-2">
        <Label>Main calendar (jobs are written here)</Label>
        <Select
          value={calendarId ?? undefined}
          onValueChange={(v) => {
            setCalendarId(v);
            const extras = extraIds.filter((id) => id !== v);
            setExtraIds(extras);
            void persist({ calendarId: v, enabled, extraIds: extras });
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder={cals.length ? "Choose a calendar" : "Loading calendars…"} />
          </SelectTrigger>
          <SelectContent>
            {cals.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.primary ? " (primary)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Also read appointments from</Label>
        <div className="grid gap-1.5 rounded-md border p-3">
          {cals.filter((c) => c.id !== calendarId).length === 0 && (
            <p className="text-sm text-muted-foreground">No other calendars available.</p>
          )}
          {cals
            .filter((c) => c.id !== calendarId)
            .map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extraIds.includes(c.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...extraIds, c.id]
                      : extraIds.filter((id) => id !== c.id);
                    setExtraIds(next);
                    void persist({ calendarId, enabled, extraIds: next });
                  }}
                />
                {c.name}
                {c.primary ? " (primary)" : ""}
              </label>
            ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!calendarId}
          onChange={(e) => {
            setEnabled(e.target.checked);
            void persist({ calendarId, enabled: e.target.checked, extraIds });
          }}
        />
        Two-way sync enabled
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={runSync} disabled={busy || !calendarId} className="w-fit">
          <RefreshCw className={busy ? "animate-spin" : ""} /> Sync now
        </Button>
        <span className="text-xs text-muted-foreground">
          {lastSync ? `Last synced ${new Date(lastSync).toLocaleString()}` : "Not synced yet"}
        </span>
      </div>
    </Card>
  );
}

const LEAD_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120];

function RemindersEditor() {
  const { billing, setBilling } = useStore();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => setPerm(notificationStatus()), []);
  const enabled = !!billing.remindersEnabled;
  const lead = billing.reminderLeadMin ?? 30;
  return (
    <Card className="p-4 sm:p-6 grid gap-3 max-w-2xl mt-4">
      <h3 className="font-semibold">Job reminders</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={async (e) => {
            const on = e.target.checked;
            setBilling({ ...billing, remindersEnabled: on });
            if (on) setPerm(await requestNotificationPermission());
          }}
        />
        Notify me before a scheduled job starts
      </label>

      <div>
        <Label className="mb-1 block">Warn me this long before</Label>
        <div className="flex items-center gap-3">
          <WheelSelect
            values={LEAD_OPTIONS}
            value={lead}
            onChange={(v) => setBilling({ ...billing, reminderLeadMin: Number(v) })}
            render={(v) => `${v} min`}
            ariaLabel="Reminder lead time"
            className="max-w-[140px]"
          />
          <p className="text-xs text-muted-foreground flex-1">
            Roll to choose. Jobs with a start time will alert {lead} minutes before.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          Device notifications: {perm === "granted" ? "allowed" : perm === "denied" ? "blocked in browser settings" : perm === "unsupported" ? "not supported" : "not enabled"}
        </span>
        {perm !== "granted" && perm !== "unsupported" && (
          <Button size="sm" variant="outline" onClick={async () => setPerm(await requestNotificationPermission())}>
            Enable notifications
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Reminders fire while MOOVE is open on this device (add it to your home screen for best results).
      </p>
    </Card>
  );
}

function DataEditorInner() {
  const { expenses, docs, importHistorical, clearHistorical } = useStore();
  const histExp = expenses.filter((e) => e.id.startsWith("hist-")).length;
  const histDocs = docs.filter((d) => d.id.startsWith("hist-")).length;
  const bankExp = expenses.filter((e) => e.id.startsWith("bank-")).length;
  const bankDocs = docs.filter((d) => d.id.startsWith("bank-")).length;
  const [confirming, setConfirming] = useState(false);

  const doImport = () => {
    const r = importHistorical(historical as Parameters<typeof importHistorical>[0]);
    toast.success(`Imported ${r.expenses} expenses, ${r.docs} invoices`);
  };
  const doBankImport = () => {
    const r = importHistorical(bankImport as Parameters<typeof importHistorical>[0]);
    toast.success(`Imported ${r.expenses} bank expenses, ${r.docs} bank invoices`);
  };
  const doClear = () => {
    const r = clearHistorical();
    toast.success(`Removed ${r.expenses} expenses, ${r.docs} invoices`);
    setConfirming(false);
  };

  return (
    <div className="max-w-2xl grid gap-4">
    <Card className="p-4 sm:p-6 max-w-2xl grid gap-4">
      <div>
        <div className="font-semibold mb-1">Historical data (MOOVE Staat)</div>
        <p className="text-xs text-muted-foreground">
          Import Dec 2024 – Aug 2025 ledger from the MOOVE bookkeeping sheet.
          Includes {(historical as any).expenses.length} expenses and{" "}
          {(historical as any).docs.length} paid invoices. Re-running the import is safe —
          existing entries are skipped by ID.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border p-2">
          <div className="text-xs text-muted-foreground">Imported expenses</div>
          <div className="font-display text-2xl">{histExp}</div>
        </div>
        <div className="rounded border p-2">
          <div className="text-xs text-muted-foreground">Imported invoices</div>
          <div className="font-display text-2xl">{histDocs}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={doImport}>Import historical data</Button>
        {confirming ? (
          <>
            <Button variant="destructive" onClick={doClear}>Confirm clear</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)} disabled={histExp + histDocs === 0}>
            Clear all imported data
          </Button>
        )}
      </div>
    </Card>
    <Card className="p-4 sm:p-6 grid gap-4">
      <div>
        <div className="font-semibold mb-1">Bank statements (May – Jul 2026)</div>
        <p className="text-xs text-muted-foreground">
          Import {bankImport.expenses.length} expense lines and {bankImport.docs.length} paid
          invoices from the FNB Business Zero account. Income is allocated across services
          using the same-month prior-year mix (with 3-month trailing fallback).
          Re-running is safe — entries dedupe by ID.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border p-2">
          <div className="text-xs text-muted-foreground">Bank expenses in store</div>
          <div className="font-display text-2xl">{bankExp}</div>
        </div>
        <div className="rounded border p-2">
          <div className="text-xs text-muted-foreground">Bank invoices in store</div>
          <div className="font-display text-2xl">{bankDocs}</div>
        </div>
      </div>
      <div>
        <Button onClick={doBankImport}>Import bank statements</Button>
      </div>
    </Card>
    </div>
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

function TumblerField({
  label, v, on, step, fineStep, prefix,
}: { label: string; v: number; on: (n: number) => void; step: number; fineStep?: number; prefix?: string }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <InlineTumbler value={v} onChange={on} step={step} fineStep={fineStep} min={0} prefix={prefix} label={label} />
    </div>
  );
}

function PctSlider({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        <span className="font-display text-lg tabular-nums">{v}%</span>
      </div>
      <Slider value={[v]} min={0} max={100} step={1} onValueChange={([n]) => on(n)} className="py-2" />
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