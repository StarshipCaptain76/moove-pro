import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useStore, newId, docTotals, fmtMoney, type LineItem, type PayMethod } from "@/lib/store";
import { downloadPdf } from "@/lib/pdf";
import {
  Trash2, Plus, MessageCircle, Mail, Download, Check, ArrowLeft,
  Truck, Calendar as CalendarIcon, Route as RouteIcon, Recycle,
  MoreVertical, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CustomerCombobox } from "@/components/app/CustomerCombobox";
import { AddressAutocomplete } from "@/components/app/AddressAutocomplete";
import { CatalogPicker } from "@/components/app/CatalogPicker";
import { DatePicker } from "@/components/app/DatePicker";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { Slider } from "@/components/ui/slider";
import { useServerFn } from "@tanstack/react-start";
import { routeDistance } from "@/lib/maps.functions";

const DISPOSAL_SITE = {
  address: "Melkhoutfontein Dumpsite, Stilbaai, South Africa",
  coords: { lat: -34.321459, lng: 21.437664 },
};

export const Route = createFileRoute("/doc/")({ component: DocPage });

function DocPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { docs, company, banking, billing, catalog, customers, upsertDoc, deleteDoc, nextDocNumber } = useStore();
  const doc = docs.find((d) => d.id === id);
  const distanceFn = useServerFn(routeDistance);
  const [calcing, setCalcing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  if (!doc) {
    return (
      <Shell>
        <p>Document not found. <Link to="/" className="text-primary underline">Go back</Link></p>
      </Shell>
    );
  }

  const t = docTotals(doc, billing.vatPct);
  const update = (patch: Partial<typeof doc>) => upsertDoc({ ...doc, ...patch });
  const updateCust = (patch: Partial<typeof doc.customer>) =>
    upsertDoc({ ...doc, customer: { ...doc.customer, ...patch } });
  const updateItem = (i: number, patch: Partial<LineItem>) => {
    const items = doc.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    upsertDoc({ ...doc, items });
  };
  const addItem = (it: Partial<LineItem>) =>
    upsertDoc({ ...doc, items: [...doc.items, { id: newId(), description: "", qty: 1, price: 0, unit: "each", ...it }] });
  const removeItem = (i: number) => upsertDoc({ ...doc, items: doc.items.filter((_, idx) => idx !== i) });

  const addKm = (km = 10) =>
    addItem({ description: "Transport (per km)", price: billing.ratePerKm, unit: "km", qty: km, isDistance: true });

  const calcDistance = async () => {
    if (!doc.fromAddress || !doc.toAddress) return toast.error("Set both addresses first");
    setCalcing(true);
    try {
      const r = await distanceFn({
        data: {
          from: { address: doc.fromAddress, ...(doc.fromCoords ?? {}) },
          to: { address: doc.toAddress, ...(doc.toCoords ?? {}) },
        },
      });
      if (!r.km) return toast.error("No route found");
      const existingIdx = doc.items.findIndex((i) => i.isDistance);
      if (existingIdx >= 0) {
        updateItem(existingIdx, { qty: r.km, price: billing.ratePerKm, description: `Transport (${r.km} km)` });
      } else {
        addItem({ description: `Transport (${r.km} km)`, price: billing.ratePerKm, unit: "km", qty: r.km, isDistance: true });
      }
      upsertDoc({ ...doc, distanceKm: r.km });
      toast.success(`Distance: ${r.km} km`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Route failed");
    } finally {
      setCalcing(false);
    }
  };

  const send = async (channel: "wa" | "email") => {
    if (!doc.customer.name) return toast.error("Add customer name first");
    try { await downloadPdf(doc, company, banking, billing); } catch { /* ignore */ }
    const msg = `Hi ${doc.customer.name},\n\nHere is your ${doc.type} ${doc.number} from ${company.name}.\nTotal: ${fmtMoney(t.total, billing.currency)}\nDeposit (${doc.depositPct}%): ${fmtMoney(t.deposit, billing.currency)}\n\nBanking:\n${banking.bank} • Acc ${banking.accountNumber} • Branch ${banking.branchCode}\nRef: ${doc.number}\n\nThanks!\n${company.name}`;
    if (channel === "wa") {
      const phone = doc.customer.phone.replace(/[^\d]/g, "");
      if (!phone) return toast.error("Add customer phone");
      const p = phone.startsWith("0") ? "27" + phone.slice(1) : phone;
      window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      if (!doc.customer.email) return toast.error("Add customer email");
      window.location.href = `mailto:${doc.customer.email}?subject=${encodeURIComponent(`${doc.type === "quote" ? "Quote" : "Invoice"} ${doc.number} from ${company.name}`)}&body=${encodeURIComponent(msg)}`;
    }
    if (doc.status === "draft") update({ status: "sent" });
  };

  const convert = () => {
    const invNum = nextDocNumber("invoice");
    upsertDoc({ ...doc, type: "invoice", number: invNum, status: "accepted", scheduledDate: doc.scheduledDate ?? new Date().toISOString().slice(0, 10) });
    toast.success(`Converted to invoice ${invNum}`);
  };

  const markPaid = (m: PayMethod) => {
    update({ status: "paid", paymentMethod: m, paidAt: new Date().toISOString() });
    setPayOpen(false);
    toast.success(`Marked paid (${m.toUpperCase()})`);
  };

  const statusColor =
    doc.status === "paid" ? "bg-green-600 text-white"
    : doc.status === "sent" ? "bg-amber-500 text-white"
    : doc.status === "accepted" ? "bg-blue-600 text-white"
    : "bg-muted text-muted-foreground";

  return (
    <Shell>
      {/* Sticky doc header */}
      <div className="-mx-3 sm:-mx-4 -mt-4 sm:-mt-6 mb-4 px-3 sm:px-4 py-2 sticky top-14 sm:top-16 z-30 bg-background/95 backdrop-blur border-b flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => nav({ to: "/" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold">{doc.type}</span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColor}`}>{doc.status}</span>
          </div>
          <div className="font-mono text-sm font-semibold truncate">{doc.number}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"><MoreVertical className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {doc.type === "quote" && (
              <DropdownMenuItem onClick={convert}>
                <Check className="h-4 w-4 mr-2" /> Accept → Invoice
              </DropdownMenuItem>
            )}
            {doc.type === "invoice" && doc.status !== "paid" && (
              <DropdownMenuItem onClick={() => setPayOpen(true)}>
                <Check className="h-4 w-4 mr-2" /> Mark paid
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => downloadPdf(doc, company, banking, billing)}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => { deleteDoc(doc.id); nav({ to: "/" }); }}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3 pb-24 md:pb-3">
        {/* Customer */}
        <Card className="p-3 sm:p-4 space-y-3">
          <h2 className="font-semibold text-sm">Customer</h2>
          <div>
            <Label className="text-xs">Name</Label>
            <CustomerCombobox
              value={doc.customer.name}
              customers={customers}
              onType={(name) => updateCust({ name })}
              onPick={(c) => upsertDoc({ ...doc, customer: { ...c } })}
            />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input type="tel" inputMode="tel" className="h-11" value={doc.customer.phone}
              onChange={(e) => updateCust({ phone: e.target.value })} placeholder="0821234567" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" inputMode="email" className="h-11" value={doc.customer.email}
              onChange={(e) => updateCust({ email: e.target.value })} />
          </div>
        </Card>

        {/* Route */}
        <Card className="p-3 sm:p-4 space-y-3">
          <h2 className="font-semibold text-sm">Route</h2>
          <div>
            <Label className="text-xs">From</Label>
            <AddressAutocomplete
              value={doc.fromAddress ?? ""}
              placeholder="Pickup address…"
              onChange={(v) => update({ fromAddress: v.address, fromCoords: v.coords })}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <AddressAutocomplete
              value={doc.toAddress ?? ""}
              placeholder="Destination…"
              onChange={(v) => update({ toAddress: v.address, toCoords: v.coords })}
            />
            <button
              type="button"
              onClick={() => update({ toAddress: DISPOSAL_SITE.address, toCoords: DISPOSAL_SITE.coords })}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 active:scale-95 transition"
            >
              <Recycle className="h-3.5 w-3.5" /> Disposal site
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={calcDistance} disabled={calcing} className="h-11 flex-1">
              <RouteIcon className="h-4 w-4 mr-1.5" /> {calcing ? "Calculating…" : "Calculate distance"}
            </Button>
            {doc.distanceKm ? (
              <span className="text-sm font-mono px-3 py-2 rounded bg-muted">{doc.distanceKm} km</span>
            ) : null}
          </div>
        </Card>

        {/* Line items */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Line items</h2>
            <span className="text-xs text-muted-foreground">{doc.items.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <CatalogPicker
              catalog={catalog}
              currency={billing.currency}
              onPick={(c) => addItem({ description: c.name, price: c.price, unit: c.unit, qty: 1 })}
              triggerClassName="h-11 w-full"
            />
            <Button variant="outline" className="h-11" onClick={() => addKm()}><Truck className="h-4 w-4 mr-1" /> KM</Button>
            <Button variant="outline" className="h-11" onClick={() => addItem({})}><Plus className="h-4 w-4 mr-1" /> Blank</Button>
          </div>
          <div className="space-y-2">
            {doc.items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items yet.</p>}
            {doc.items.map((it, i) => (
              <div key={it.id} className="rounded-lg border bg-background p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <Input
                    className="h-10 flex-1"
                    value={it.description}
                    placeholder={it.isDistance ? "Transport (km)" : "Description"}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive"
                    onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <InlineTumbler
                    value={it.qty}
                    onChange={(v) => updateItem(i, { qty: Math.max(0, v) })}
                    step={1}
                    min={0}
                    label="Quantity"
                  />
                  <InlineTumbler
                    value={it.price}
                    onChange={(v) => updateItem(i, { price: Math.max(0, v) })}
                    step={10}
                    fineStep={1}
                    min={0}
                    prefix={`${billing.currency} `}
                    label="Price"
                  />
                </div>
                <div className="text-right text-xs text-muted-foreground font-mono">
                  = {fmtMoney(it.qty * it.price, billing.currency)} · {it.unit}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Totals + deposit */}
        <Card className="p-3 sm:p-4 space-y-3">
          <h2 className="font-semibold text-sm">Total</h2>
          <div className="text-sm space-y-1">
            <Row label="Subtotal" v={fmtMoney(t.subtotal, billing.currency)} />
            {billing.vatPct > 0 && <Row label={`VAT ${billing.vatPct}%`} v={fmtMoney(t.vat, billing.currency)} />}
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="font-bold">Total</span>
              <span className="font-display text-2xl text-primary">{fmtMoney(t.total, billing.currency)}</span>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Deposit</Label>
              <span className="font-display text-lg tabular-nums">{doc.depositPct}%</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => update({ depositPct: pct })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border",
                    doc.depositPct === pct
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border",
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <Slider
              value={[doc.depositPct]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => update({ depositPct: v })}
              className="py-3"
            />
            <div className="flex justify-between text-sm mt-2">
              <span>Deposit</span>
              <span className="font-semibold">{fmtMoney(t.deposit, billing.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Balance</span>
              <span className="font-semibold">{fmtMoney(t.balance, billing.currency)}</span>
            </div>
            <label className="flex items-center justify-between gap-2 pt-3 border-t mt-3">
              <span className="text-sm font-medium">Deposit paid</span>
              <Switch checked={doc.depositPaid} onCheckedChange={(v) => update({ depositPaid: v })} />
            </label>
          </div>
        </Card>

        {/* Schedule */}
        <Card className="p-3 sm:p-4 space-y-2">
          <Label className="text-xs flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Scheduled date</Label>
          <DatePicker value={doc.scheduledDate} onChange={(iso) => update({ scheduledDate: iso })} clearable />
        </Card>

        {/* Notes */}
        <Card className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold"
          >
            <span>Notes {doc.notes ? <span className="text-xs text-muted-foreground font-normal">· added</span> : null}</span>
            {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {notesOpen && (
            <Textarea
              className="mt-3"
              value={doc.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Terms, thanks, etc."
            />
          )}
        </Card>
      </div>

      {/* Sticky bottom send bar */}
      <div
        className="fixed bottom-16 md:bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t px-3 py-2 md:relative md:border-0 md:bg-transparent md:px-0 md:py-0 md:mt-4"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-6xl mx-auto flex gap-2">
          <Button
            className="h-12 flex-1 bg-green-600 hover:bg-green-700 text-white text-base"
            onClick={() => send("wa")}
          >
            <MessageCircle className="h-5 w-5 mr-2" /> WhatsApp
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => send("email")}>
            <Mail className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => downloadPdf(doc, company, banking, billing)}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mark paid sheet */}
      <Sheet open={payOpen} onOpenChange={setPayOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-display text-3xl tracking-wide">MARK PAID</SheetTitle></SheetHeader>
          <div className="grid gap-2 mt-4 pb-[env(safe-area-inset-bottom)]">
            {(["cash","eft","card"] as PayMethod[]).map((m) => (
              <Button key={m} className="h-14 text-lg uppercase" onClick={() => markPaid(m)}>{m}</Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </Shell>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{v}</span></div>;
}

function ScheduledDatePicker({ value, onChange }: { value?: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full h-11 justify-start text-left font-normal", !selected && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "EEE, d MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => { if (!d) return; onChange(format(d, "yyyy-MM-dd")); setOpen(false); }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
