import jsPDF from "jspdf";
import type { Doc, Company, Banking, BillingSettings } from "./store";
import { docTotals, fmtMoney } from "./store";
import logoAsset from "@/assets/moove-logo.png.asset.json";

async function loadImage(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function generatePdf(
  doc: Doc,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  const RED: [number, number, number] = [225, 29, 46];

  // header red bar
  pdf.setFillColor(...RED);
  pdf.rect(0, 0, W, 4, "F");

  try {
    const logo = await loadImage(logoAsset.url);
    pdf.addImage(logo, "PNG", M, 8, 30, 26);
  } catch {
    // skip
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(20, 20, 20);
  pdf.text(doc.type === "quote" ? "QUOTE" : "TAX INVOICE", W - M, 20, { align: "right" });
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`No: ${doc.number}`, W - M, 27, { align: "right" });
  pdf.text(`Date: ${new Date(doc.createdAt).toLocaleDateString("en-ZA")}`, W - M, 32, { align: "right" });

  // company block
  let y = 42;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(company.name, M, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const cLines = [company.tagline, company.address, company.phone, company.email].filter(Boolean);
  cLines.forEach((l, i) => pdf.text(l, M, y + 5 + i * 4));

  // customer block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("BILL TO", W / 2, y);
  pdf.setFont("helvetica", "normal");
  const custLines = [doc.customer.name, doc.customer.phone, doc.customer.email, doc.customer.address].filter(Boolean) as string[];
  custLines.forEach((l, i) => pdf.text(l, W / 2, y + 5 + i * 4));

  y = 78;
  // items table
  pdf.setFillColor(20, 20, 20);
  pdf.rect(M, y, W - 2 * M, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DESCRIPTION", M + 2, y + 5.5);
  pdf.text("QTY", W - M - 55, y + 5.5, { align: "right" });
  pdf.text("PRICE", W - M - 30, y + 5.5, { align: "right" });
  pdf.text("TOTAL", W - M - 2, y + 5.5, { align: "right" });
  y += 8;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "normal");

  for (const item of doc.items) {
    const lineTotal = item.qty * item.price;
    const descLines = pdf.splitTextToSize(item.description, W - 2 * M - 65);
    const rowH = Math.max(6, descLines.length * 4 + 2);
    pdf.text(descLines, M + 2, y + 4);
    pdf.text(`${item.qty} ${item.unit}`, W - M - 55, y + 4, { align: "right" });
    pdf.text(fmtMoney(item.price, billing.currency), W - M - 30, y + 4, { align: "right" });
    pdf.text(fmtMoney(lineTotal, billing.currency), W - M - 2, y + 4, { align: "right" });
    y += rowH;
    pdf.setDrawColor(230, 230, 230);
    pdf.line(M, y, W - M, y);
  }

  const t = docTotals(doc, billing.vatPct);
  y += 4;
  const rx = W - M - 60;
  const drawTot = (label: string, val: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, rx, y);
    pdf.text(val, W - M - 2, y, { align: "right" });
    y += 5;
  };
  drawTot("Subtotal", fmtMoney(t.subtotal, billing.currency));
  if (billing.vatPct > 0) drawTot(`VAT (${billing.vatPct}%)`, fmtMoney(t.vat, billing.currency));
  pdf.setFillColor(...RED);
  pdf.rect(rx - 2, y - 3.5, W - M - rx + 4, 7, "F");
  pdf.setTextColor(255, 255, 255);
  drawTot("TOTAL", fmtMoney(t.total, billing.currency), true);
  pdf.setTextColor(20, 20, 20);
  y += 2;
  drawTot(`Deposit (${doc.depositPct}%)`, fmtMoney(t.deposit, billing.currency));
  drawTot("Balance Due", fmtMoney(t.balance, billing.currency), true);

  // banking block
  y = Math.max(y + 10, 235);
  pdf.setFillColor(245, 245, 245);
  pdf.rect(M, y, W - 2 * M, 40, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BANKING DETAILS", M + 3, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const b = [
    `Account Name: ${banking.accountName}`,
    `Bank: ${banking.bank}`,
    `Account Number: ${banking.accountNumber}`,
    `Branch Code: ${banking.branchCode}`,
    `Branch: ${banking.branchName}`,
    `Swift: ${banking.swiftCode}`,
  ];
  b.forEach((l, i) => pdf.text(l, M + 3 + (i % 2) * 90, y + 13 + Math.floor(i / 2) * 5));

  if (doc.notes) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.text(doc.notes, M, y + 46);
  }

  pdf.setFillColor(...RED);
  pdf.rect(0, 293, W, 4, "F");

  return pdf;
}

export async function downloadPdf(doc: Doc, company: Company, banking: Banking, billing: BillingSettings) {
  const pdf = await generatePdf(doc, company, banking, billing);
  pdf.save(`${doc.number}-${doc.customer.name || "customer"}.pdf`);
}

export async function pdfBlobUrl(doc: Doc, company: Company, banking: Banking, billing: BillingSettings) {
  const pdf = await generatePdf(doc, company, banking, billing);
  const blob = pdf.output("blob");
  return URL.createObjectURL(blob);
}