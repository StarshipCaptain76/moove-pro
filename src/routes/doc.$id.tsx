import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore, newId, docTotals, fmtMoney, type LineItem, type PayMethod } from "@/lib/store";
import { downloadPdf } from "@/lib/pdf";
import { Trash2, Plus, MessageCircle, Mail, Download, Check, ArrowLeft, Truck, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/doc/$id")({ component: DocPage });

function DocPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { docs, company, banking, billing, catalog, upsertDoc, deleteDoc, nextDocNumber } = useStore();
  const doc = docs.find((d) => d.id === id);

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

  const addFromCatalog = (catId: string) => {
    const c = catalog.find((x) => x.id === catId);
    if (!c) return;
    addItem({ description: c.name, price: c.price, unit: c.unit, qty: 1 });
  };

  const addKm = () => addItem({ description: "Transport (per km)", price: billing.ratePerKm, unit: "km", qty: 10, isDistance: true });

  const send = async (channel: "wa" | "email") => {
    if (!doc.customer.name) return toast.error("Add customer name first");
    try {
      await downloadPdf(doc, company, banking, billing);
    } catch {}
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
    toast.success(`Marked paid (${m.toUpperCase()})`);
  };

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/" })}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-display text-4xl tracking-wide">{doc.type === "quote" ? "QUOTE" : "INVOICE"} {doc.number}</h1>
        <span className={`text-xs uppercase font-bold px-2 py-1 rounded ${doc.status === "paid" ? "bg-green-600 text-white" : "bg-muted"}`}>{doc.status}</span>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => { deleteDoc(doc.id); nav({ to: "/" }); }}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Customer</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={doc.customer.name} onChange={(e) => updateCust({ name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={doc.customer.phone} onChange={(e) => updateCust({ phone: e.target.value })} placeholder="0821234567" /></div>
              <div><Label>Email</Label><Input value={doc.customer.email} onChange={(e) => updateCust({ email: e.target.value })} /></div>
              <div className="col-span-2"><Label>From address</Label><Input value={doc.fromAddress ?? ""} onChange={(e) => update({ fromAddress: e.target.value })} /></div>
              <div className="col-span-2"><Label>To address</Label><Input value={doc.toAddress ?? ""} onChange={(e) => update({ toAddress: e.target.value })} /></div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Line items</h2>
              <div className="flex gap-2">
                <select className="h-9 border rounded px-2 bg-background text-sm" onChange={(e) => { if (e.target.value) { addFromCatalog(e.target.value); e.target.value=""; } }} defaultValue="">
                  <option value="">+ From catalog…</option>
                  {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={addKm}><Truck className="h-4 w-4 mr-1" /> KM</Button>
                <Button size="sm" variant="outline" onClick={() => addItem({})}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              {doc.items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
              {doc.items.map((it, i) => (
                <div key={it.id} className="grid grid-cols-[1fr_70px_100px_40px] gap-2 items-center">
                  <Input value={it.description} placeholder={it.isDistance ? "Transport (km)" : "Description"} onChange={(e) => updateItem(i, { description: e.target.value })} />
                  <Input type="number" value={it.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" value={it.price} onChange={(e) => updateItem(i, { price: Number(e.target.value) })} />
                  <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
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
                <Label>Deposit %</Label>
                <Input type="number" value={doc.depositPct} onChange={(e) => update({ depositPct: Number(e.target.value) })} />
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
            <ScheduledDatePicker
              value={doc.scheduledDate}
              onChange={(iso) => update({ scheduledDate: iso })}
            />
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

function ScheduledDatePicker({ value, onChange }: { value?: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !selected && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "EEE, d MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}