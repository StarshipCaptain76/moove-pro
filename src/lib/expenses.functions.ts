import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Parse a receipt/slip image via Lovable AI Gateway (Gemini vision).
// Returns best-effort extracted fields; the client fills in gaps.
export const parseReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        imageDataUrl: z.string().min(32),
        categories: z.array(z.string()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const catList = data.categories.join(", ");
    const system =
      "You extract structured expense data from a photo of a receipt, slip or invoice. " +
      "Return ONLY a compact JSON object matching the requested schema. " +
      "Choose the single best category from the provided list; if none fit, use 'Other'. " +
      "Amounts are numbers only (no currency symbols). Use ISO date yyyy-mm-dd. " +
      "If a field is unknown, use null.";

    const userPrompt =
      `Allowed categories: ${catList}\n\n` +
      `Extract: date, vendor, total (grand total the customer paid), vat (tax portion if shown), ` +
      `category (from the allowed list), description (short: what was bought), ` +
      `paymentMethod (one of: cash, eft, card, or null).\n` +
      `Reply as JSON: {"date": "...", "vendor": "...", "total": 0, "vat": 0, "category": "...", "description": "...", "paymentMethod": "..."}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Top up in workspace billing.");
      throw new Error(`AI parse failed [${res.status}]: ${text.slice(0, 200)}`);
    }

    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // fall through with empty result
    }

    const asNum = (v: unknown): number | null => {
      if (typeof v === "number" && isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/[^0-9.-]/g, ""));
        return isFinite(n) ? n : null;
      }
      return null;
    };
    const asStr = (v: unknown): string | null =>
      typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null;

    const catRaw = asStr(parsed.category);
    const category =
      catRaw && data.categories.find((c) => c.toLowerCase() === catRaw.toLowerCase())
        ? data.categories.find((c) => c.toLowerCase() === catRaw.toLowerCase())!
        : "Other";

    const pmRaw = asStr(parsed.paymentMethod)?.toLowerCase();
    const paymentMethod =
      pmRaw === "cash" || pmRaw === "eft" || pmRaw === "card" ? (pmRaw as "cash" | "eft" | "card") : null;

    return {
      date: asStr(parsed.date),
      vendor: asStr(parsed.vendor),
      total: asNum(parsed.total),
      vat: asNum(parsed.vat),
      category,
      description: asStr(parsed.description),
      paymentMethod,
    };
  });