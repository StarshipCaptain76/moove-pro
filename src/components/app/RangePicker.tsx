import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "./DatePicker";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  subMonths, subYears, format, parseISO, differenceInCalendarDays, addDays,
} from "date-fns";

export type RangePreset =
  | "this-month" | "last-month" | "this-quarter" | "ytd"
  | "last-12m" | "this-year" | "last-year" | "all" | "custom";

export interface RangeValue {
  preset: RangePreset;
  from?: string; // yyyy-MM-dd
  to?: string;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "ytd", label: "YTD" },
  { key: "last-12m", label: "Last 12 mo" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
  { key: "all", label: "All time" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function resolveRange(v: RangeValue): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (v.preset) {
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") };
    case "last-month": {
      const d = subMonths(now, 1);
      return { from: startOfMonth(d), to: endOfMonth(d), label: format(d, "MMMM yyyy") };
    }
    case "this-quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now), label: `Q${Math.floor(now.getMonth()/3)+1} ${now.getFullYear()}` };
    case "ytd":
      return { from: startOfYear(now), to: now, label: `YTD ${now.getFullYear()}` };
    case "last-12m":
      return { from: addDays(subMonths(now, 12), 1), to: now, label: "Last 12 months" };
    case "this-year":
      return { from: startOfYear(now), to: endOfYear(now), label: `${now.getFullYear()}` };
    case "last-year": {
      const d = subYears(now, 1);
      return { from: startOfYear(d), to: endOfYear(d), label: `${d.getFullYear()}` };
    }
    case "all":
      return { from: new Date(2000, 0, 1), to: now, label: "All time" };
    case "custom": {
      const from = v.from ? parseISO(v.from) : startOfMonth(now);
      const to = v.to ? parseISO(v.to) : now;
      return { from, to, label: `${format(from, "d MMM yy")} – ${format(to, "d MMM yy")}` };
    }
  }
}

/** Same-length window immediately before the given range. */
export function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const resolved = useMemo(() => resolveRange(value), [value]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange({ preset: p.key })}
          className={cn(
            "px-2.5 h-8 rounded-full text-xs border transition-colors",
            value.preset === p.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted",
          )}
        >
          {p.label}
        </button>
      ))}
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "px-2.5 h-8 rounded-full text-xs border transition-colors",
              value.preset === "custom"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted",
            )}
          >
            {value.preset === "custom" ? resolved.label : "Custom…"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3 space-y-2">
          <div className="text-xs font-medium">From</div>
          <DatePicker
            value={value.from ?? iso(resolved.from)}
            onChange={(f) => onChange({ preset: "custom", from: f, to: value.to ?? iso(resolved.to) })}
          />
          <div className="text-xs font-medium">To</div>
          <DatePicker
            value={value.to ?? iso(resolved.to)}
            onChange={(t) => onChange({ preset: "custom", from: value.from ?? iso(resolved.from), to: t })}
          />
          <Button size="sm" className="w-full" onClick={() => setCustomOpen(false)}>Done</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}