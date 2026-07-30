import { docTotals, fmtMoney, type Doc, type Company, type Banking, type BillingSettings } from "@/lib/store";

export function buildShareMessage(
  doc: Doc,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
): string {
  const t = docTotals(doc, billing.vatPct);
  const cur = billing.currency;
  const kind = doc.type === "quote" ? "quote" : "invoice";

  const lines: string[] = [];
  lines.push(`Hi ${doc.customer.name},`);
  lines.push("");
  lines.push(`Here is your ${kind} ${doc.number} from ${company.name}.`);

  if (doc.fromAddress || doc.toAddress) {
    lines.push("");
    lines.push("Route:");
    if (doc.fromAddress) lines.push(`From: ${doc.fromAddress}`);
    (doc.stops ?? []).forEach((s, i) => {
      if (s.address) lines.push(`Stop ${i + 1}: ${s.address}`);
    });
    if (doc.toAddress) lines.push(`To: ${doc.toAddress}`);
    if (doc.distanceKm) lines.push(`Distance: ${doc.distanceKm} km`);
  }

  if (doc.items.length) {
    lines.push("");
    lines.push("Items:");
    for (const it of doc.items) {
      const desc = it.description || (it.isDistance ? "Transport" : "Item");
      const lineTotal = it.qty * it.price;
      lines.push(`- ${it.qty} ${it.unit} × ${desc} @ ${fmtMoney(it.price, cur)} = ${fmtMoney(lineTotal, cur)}`);
    }
  }

  lines.push("");
  lines.push(`Subtotal: ${fmtMoney(t.subtotal, cur)}`);
  if (billing.vatPct > 0) lines.push(`VAT (${billing.vatPct}%): ${fmtMoney(t.vat, cur)}`);
  lines.push(`Total: ${fmtMoney(t.total, cur)}`);
  if (doc.depositPct > 0 && t.deposit > 0) {
    lines.push(`Deposit (${doc.depositPct}%): ${fmtMoney(t.deposit, cur)}`);
  }

  lines.push("");
  lines.push("Banking:");
  lines.push(`${banking.bank} • Acc ${banking.accountNumber} • Branch ${banking.branchCode}`);
  lines.push(`Ref: ${doc.number}`);
  lines.push("");
  lines.push("Thanks!");
  lines.push(company.name);

  return lines.join("\n");
}

export function shareSubject(doc: Doc, company: Company): string {
  return `${doc.type === "quote" ? "Quote" : "Invoice"} ${doc.number} from ${company.name}`;
}