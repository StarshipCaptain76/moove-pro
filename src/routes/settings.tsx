import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore, newId, type Unit } from "@/lib/store";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const s = useStore();
  return (
    <Shell>
      <h1 className="font-display text-5xl tracking-wide mb-6">SETTINGS</h1>
      <Tabs defaultValue="company">
        <TabsList className="mb-4">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card className="p-6 grid gap-3 max-w-2xl">
            {(["name","tagline","address","phone","email"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k}</Label>
                <Input value={s.company[k] ?? ""} onChange={(e) => s.setCompany({ ...s.company, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
          <Card className="p-6 grid gap-3 max-w-2xl">
            {(["accountName","accountNumber","bank","branchCode","branchName","swiftCode"] as const).map((k) => (
              <div key={k}>
                <Label>{k}</Label>
                <Input value={s.banking[k]} onChange={(e) => s.setBanking({ ...s.banking, [k]: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <Card className="p-6 max-w-3xl">
            <div className="space-y-2">
              {s.catalog.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-center">
                  <Input value={c.name} onChange={(e) => s.upsertCatalog({ ...c, name: e.target.value })} />
                  <Input type="number" value={c.price} onChange={(e) => s.upsertCatalog({ ...c, price: Number(e.target.value) })} />
                  <select className="h-9 border rounded px-2 bg-background" value={c.unit} onChange={(e) => s.upsertCatalog({ ...c, unit: e.target.value as Unit })}>
                    <option value="each">each</option><option value="hour">hour</option><option value="km">km</option><option value="job">job</option>
                  </select>
                  <Button size="icon" variant="ghost" onClick={() => s.deleteCatalog(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => s.upsertCatalog({ id: newId(), name: "New item", price: 0, unit: "each" })}>
                <Plus className="h-4 w-4 mr-2" /> Add item
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="p-6 grid gap-3 max-w-2xl">
            <NumField label="Rate per KM" v={s.billing.ratePerKm} on={(v) => s.setBilling({ ...s.billing, ratePerKm: v })} />
            <NumField label="Base callout fee" v={s.billing.baseCallout} on={(v) => s.setBilling({ ...s.billing, baseCallout: v })} />
            <NumField label="Default deposit %" v={s.billing.defaultDepositPct} on={(v) => s.setBilling({ ...s.billing, defaultDepositPct: v })} />
            <NumField label="VAT %" v={s.billing.vatPct} on={(v) => s.setBilling({ ...s.billing, vatPct: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quote prefix</Label><Input value={s.billing.quotePrefix} onChange={(e) => s.setBilling({ ...s.billing, quotePrefix: e.target.value })} /></div>
              <div><Label>Invoice prefix</Label><Input value={s.billing.invoicePrefix} onChange={(e) => s.setBilling({ ...s.billing, invoicePrefix: e.target.value })} /></div>
              <NumField label="Next quote #" v={s.billing.nextQuoteNo} on={(v) => s.setBilling({ ...s.billing, nextQuoteNo: v })} />
              <NumField label="Next invoice #" v={s.billing.nextInvoiceNo} on={(v) => s.setBilling({ ...s.billing, nextInvoiceNo: v })} />
            </div>
            <Button onClick={() => toast.success("Saved")} className="w-fit">Save</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={v} onChange={(e) => on(Number(e.target.value))} />
    </div>
  );
}