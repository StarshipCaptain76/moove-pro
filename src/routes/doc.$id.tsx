import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { openWhatsApp } from "@/lib/whatsapp";
import { buildShareMessage, shareSubject } from "@/lib/share-message";
import { sendEmailWithPdf } from "@/lib/send-email";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore, newId, docTotals, fmtMoney, type LineItem, type PayMethod, type DocStatus } from "@/lib/store";
import { downloadPdf } from "@/lib/pdf";
import { Trash2, Plus, MessageCircle, Mail, Download, Check, ArrowLeft, Truck, Calendar as CalendarIcon, Route as RouteIcon, Recycle, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CustomerCombobox } from "@/components/app/CustomerCombobox";
import { ContactImportButton } from "@/components/app/ContactImportButton";
import { AddressAutocomplete } from "@/components/app/AddressAutocomplete";
import { CatalogPicker } from "@/components/app/CatalogPicker";
import { InlineTumbler } from "@/components/app/InlineTumbler";
import { DatePicker } from "@/components/app/DatePicker";
import { Slider } from "@/components/ui/slider";
import { useServerFn } from "@tanstack/react-start";
import { routeDistance } from "@/lib/maps.functions";
import { flushSync } from "@/lib/sync";
const nn = (v: number) => (isFinite(v) && v > 0 ? v : 0);


const DISPOSAL_SITE = {
  address: "Melkhoutfontein Dumpsite, Stilbaai, South Africa",
  coords: { lat: -34.321459, lng: 21.437664 },
};

export const Route = createFileRoute("/doc/$id")({ component: DocPage });

function DocPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { docs, company, banking, billing, catalog, customers, upsertDoc, deleteDoc, nextDocNumber } = useStore();
  const doc = docs.find((d) => d.id === id);
  const distanceFn = useServerFn(routeDistance);
  const [calcing, setCalcing] = useState(false);

  // Only surface customers explicitly added in the app — never the ones
  // embedded on historical/imported docs.
  const allCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.name?.trim())
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

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
    const msg = buildShareMessage(doc, company, banking, billing);
    if (channel === "wa") {
      if (!doc.customer.phone) return toast.error("Add customer phone");
      const ok = openWhatsApp(doc.customer.phone, msg);
      if (!ok) return toast.error("Invalid phone number");
    } else {
      if (!doc.customer.email) return toast.error("Add customer email");
      try {
        await sendEmailWithPdf(doc, company, banking, billing, msg, shareSubject(doc, company));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Email failed");
        return;
      }
    }
    if (doc.status === "draft") update({ status: "sent" });
  };

  const convert = () => {
    const invNum = nextDocNumber("invoice");
    upsertDoc({ ...doc, type: "invoice", number: invNum, status: "accepted", archived: false, scheduledDate: doc.scheduledDate ?? new Date().toISOString().slice(0, 10) });
    void flushSync();
    toast.success(`Converted to invoice ${invNum}`);
  };

  const markPaid = (m: PayMethod) => {
    update({ status: "paid", archived: false, paymentMethod: m, paidAt: new Date().toISOString(), scheduledDate: doc.scheduledDate ?? new Date().toISOString().slice(0, 10) });
    void flushSync();
    toast.success(`Marked paid (${m.toUpperCase()})`);
  };

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/" })}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-display text-4xl tracking-wide">{doc.type === "quote" ? "QUOTE" : "INVOICE"} {doc.number}</h1>
        {doc.type === "invoice" && (
          <span className={`text-xs uppercase font-bold px-2 py-1 rounded ${doc.status === "paid" ? "bg-green-600 text-white" : "bg-muted"}`}>{doc.status}</span>
        )}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => { deleteDoc(doc.id); nav({ to: "/" }); }}><Trash2 className="h-4 w-4" /></Button>
      </div>

      {doc.type === "quote" && (
        <QuoteStatusStepper
          status={doc.status}
          onSet={(s: DocStatus) => update({ status: s })}
          onConvert={convert}
        />
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Customer</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label>Name</Label>
                  <ContactImportButton
                    onPick={(c) =>
                      upsertDoc({ ...doc, customer: { ...doc.customer, ...c } })
                    }
                  />
                </div>
                <CustomerCombobox
                  value={doc.customer.name}
                  customers={allCustomers}
                  onType={(name) => updateCust({ name })}
                  onPick={(c) => upsertDoc({ ...doc, customer: { ...c } })}
                />
              </div>
              <div><Label>Phone</Label><Input value={doc.customer.phone} onChange={(e) => updateCust({ phone: e.target.value })} placeholder="0821234567" /></div>
              <div><Label>Email</Label><Input value={doc.customer.email} onChange={(e) => updateCust({ email: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Customer address</Label>
                <AddressAutocomplete
                  value={doc.customer.address ?? ""}
                  placeholder="Street, city"
                  onChange={(v) => updateCust({ address: v.address })}
                />
              </div>
              <div className="col-span-2">
                <Label>VAT / Tax number</Label>
                <Input
                  value={doc.customer.taxNumber ?? ""}
                  onChange={(e) => updateCust({ taxNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="col-span-2">
                <Label>From address</Label>
                <AddressAutocomplete
                  value={doc.fromAddress ?? ""}
                  placeholder="Search address…"
                  onChange={(v) => update({ fromAddress: v.address, fromCoords: v.coords })}
                />
              </div>
              <div className="col-span-2">
                <Label>To address</Label>
                <AddressAutocomplete
                  value={doc.toAddress ?? ""}
                  placeholder="Search address…"
                  onChange={(v) => update({ toAddress: v.address, toCoords: v.coords })}
                  extraButton={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() =>
                        update({ toAddress: DISPOSAL_SITE.address, toCoords: DISPOSAL_SITE.coords })
                      }
                    >
                      <Recycle className="h-4 w-4 mr-1" /> Disposal
                    </Button>
                  }
                />
              </div>
              <div className="col-span-2 flex items-center gap-2 text-sm">
                <Button type="button" size="sm" variant="secondary" onClick={calcDistance} disabled={calcing}>
                  <RouteIcon className="h-4 w-4 mr-1" /> {calcing ? "Calculating…" : "Calculate distance"}
                </Button>
                {doc.distanceKm ? (
                  <span className="text-muted-foreground">{doc.distanceKm} km</span>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Line items</h2>
              <div className="flex gap-2">
                <CatalogPicker
                  catalog={catalog}
                  currency={billing.currency}
                  onPick={(c) => addItem({ description: c.name, price: c.price, unit: c.unit, qty: 1 })}
                />
                <Button size="sm" variant="outline" onClick={() => addKm()}><Truck className="h-4 w-4 mr-1" /> KM</Button>
                <Button size="sm" variant="outline" onClick={() => addItem({})}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              {doc.items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
              {doc.items.map((it, i) => (
                <div key={it.id} className="space-y-1.5 border rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={it.description}
                      placeholder={it.isDistance ? "Transport (km)" : "Description"}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      className="flex-1"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        Qty ({it.unit})
                      </div>
                      <InlineTumbler
                        value={it.qty}
                        onChange={(v) => updateItem(i, { qty: nn(v) })}
                        step={1}
                        min={0}
                        label="Quantity"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        Price ({billing.currency})
                      </div>
                      <InlineTumbler
                        value={it.price}
                        onChange={(v) => updateItem(i, { price: nn(v) })}
                        step={10}
                        fineStep={1}
                        min={0}
                        prefix={`${billing.currency} `}
                        label="Price"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <Label>Notes</Label>
            <Textarea value={doc.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Terms, thanks, etc." />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm space-y-1.5">
              <Row label="Subtotal" v={fmtMoney(t.subtotal, billing.currency)} />
              {billing.vatPct > 0 && <Row label={`VAT ${billing.vatPct}%`} v={fmtMoney(t.vat, billing.currency)} />}
              <Row label="Total" v={fmtMoney(t.total, billing.currency)} bold />
              <div className="pt-2 mt-2 border-t">
                <div className="flex items-center justify-between mb-1">
                  <Label>Deposit</Label>
                  <span className="font-display text-xl tabular-nums">{doc.depositPct}%</span>
                </div>
                <Slider
                  value={[doc.depositPct]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => update({ depositPct: v })}
                  className="py-2"
                />
              </div>
              <Row label="Deposit" v={fmtMoney(t.deposit, billing.currency)} />
              <Row label="Balance" v={fmtMoney(t.balance, billing.currency)} bold />
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={doc.depositPaid} onChange={(e) => update({ depositPaid: e.target.checked })} />
                Deposit paid
              </label>
            </div>
          </Card>

          <Card className="p-4">
            <Label className="flex items-center gap-1 mb-1"><CalendarIcon className="h-3.5 w-3.5" /> Scheduled date</Label>
            <DatePicker value={doc.scheduledDate} onChange={(iso) => update({ scheduledDate: iso })} clearable />
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={!!doc.scheduledEndDate}
                disabled={!doc.scheduledDate}
                onChange={(e) =>
                  update({
                    scheduledEndDate: e.target.checked
                      ? doc.scheduledEndDate ?? doc.scheduledDate
                      : undefined,
                  })
                }
              />
              Multi-day job
            </label>
            {doc.scheduledEndDate && (
              <div className="mt-2">
                <Label className="flex items-center gap-1 mb-1"><CalendarIcon className="h-3.5 w-3.5" /> End date</Label>
                <DatePicker
                  value={doc.scheduledEndDate}
                  onChange={(iso) => update({ scheduledEndDate: iso })}
                  clearable
                />
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-semibold text-sm">Send</h3>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => send("wa")}>
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={() => send("email")}>
              <Mail className="h-4 w-4 mr-2" /> Email
            </Button>
            <Button variant="outline" className="w-full" onClick={() => downloadPdf(doc, company, banking, billing)}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-semibold text-sm">Actions</h3>
            {doc.type === "quote" && (
              <Button variant="secondary" className="w-full" onClick={convert}>
                <Check className="h-4 w-4 mr-2" /> Accept → Invoice
              </Button>
            )}
            {doc.type === "invoice" && doc.status !== "paid" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">Mark paid</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Payment method</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cash","eft","card"] as PayMethod[]).map((m) => (
                      <Button key={m} onClick={() => markPaid(m)} className="uppercase">{m}</Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, v, bold }: { label: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span>{label}</span><span>{v}</span>
    </div>
  );
}