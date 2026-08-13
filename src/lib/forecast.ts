import { addDays, differenceInCalendarDays, subYears } from "date-fns";

/** Same calendar window shifted back N years. */
export function sameRangeYearsAgo(from: Date, to: Date, years = 1) {
  return { from: subYears(from, years), to: subYears(to, years) };
}

export type Confidence = "high" | "medium" | "low";

export interface ForecastResult {
  projected: number;
  toDate: number;
  /** Blended share of the period expected to be complete by now (0..1]. */
  completion: number;
  confidence: Confidence;
  /** Human label for how the projection was derived. */
  basis: string;
  yearsUsed: number;
}

/**
 * Project a still-running period's total from its to-date figure, using the
 * shape of the same calendar period in prior years.
 *
 * For each prior year we measure what fraction of that period's total had
 * landed by the equivalent elapsed day. Those fractions are blended with an
 * exponential recency weight, plus a flat linear pro-rata term so a single
 * sparse prior year can never dominate.
 */
export function weightedForecast(opts: {
  from: Date;
  to: Date;
  today: Date;
  /** Total of the metric within [start, end] (inclusive, calendar days). */
  sumInWindow: (start: Date, end: Date) => number;
  maxYears?: number;
}): ForecastResult {
  const { from, to, today, sumInWindow, maxYears = 3 } = opts;
  const totalDays = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(1, differenceInCalendarDays(today, from) + 1),
  );
  const linear = elapsedDays / totalDays;
  const toDate = sumInWindow(from, today < to ? today : to);

  const weighted: { f: number; w: number }[] = [];
  for (let k = 1; k <= maxYears; k++) {
    const py = sameRangeYearsAgo(from, to, k);
    const total = sumInWindow(py.from, py.to);
    if (total <= 0) continue;
    const partial = sumInWindow(py.from, addDays(py.from, elapsedDays - 1));
    const f = partial / total;
    if (!isFinite(f) || f <= 0) continue;
    weighted.push({ f: Math.min(1, f), w: Math.pow(0.5, k - 1) });
  }

  // Flat pro-rata always participates as a stabiliser.
  weighted.push({ f: linear, w: 0.6 });

  const wSum = weighted.reduce((s, x) => s + x.w, 0);
  const completion = Math.min(1, Math.max(0.02, weighted.reduce((s, x) => s + x.f * x.w, 0) / wSum));

  const yearsUsed = weighted.length - 1;
  const confidence: Confidence =
    yearsUsed >= 2 && linear >= 0.25 ? "high"
    : yearsUsed >= 1 ? "medium"
    : "low";

  return {
    projected: completion > 0 ? toDate / completion : toDate,
    toDate,
    completion,
    confidence,
    yearsUsed,
    basis: yearsUsed > 0
      ? `seasonal, ${yearsUsed} prior year${yearsUsed > 1 ? "s" : ""}`
      : "linear pace, no history",
  };
}
