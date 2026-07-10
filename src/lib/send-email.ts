import { pdfFile } from "@/lib/pdf";
import type { Doc, Company, Banking, BillingSettings } from "@/lib/store";
import { toast } from "sonner";

export async function sendEmailWithPdf(
  doc: Doc,
  company: Company,
  banking: Banking,
  billing: BillingSettings,
  message: string,
  subject: string,
): Promise<void> {
  const to = doc.customer.email;
  const file = await pdfFile(doc, company, banking, billing);

  // Prefer native share (mobile) so the PDF is a real attachment.
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav && "canShare" in nav && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: subject, text: message });
      return;
    } catch {
      // fall through to mailto fallback
    }
  }

  // Desktop fallback: download the PDF and open a mailto draft.
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  toast.message("PDF downloaded", { description: "Attach it to the email draft." });
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}