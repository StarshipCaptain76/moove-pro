import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ITEM_H = 40;

/**
 * Vertical snap-scroll wheel. Pick a value by rolling — never by typing.
 */
export function WheelSelect({
  values,
  value,
  onChange,
  render,
  className,
  ariaLabel,
}: {
  values: (string | number)[];
  value: string | number;
  onChange: (v: never) => void;
  render?: (v: string | number) => string;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = Math.max(0, values.indexOf(value));

  // Keep the wheel aligned when the value changes from outside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
  }, [idx]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      if (values[i] !== value) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(3);
        onChange(values[i] as never);
      }
    }, 90);
  };

  return (
    <div className={cn("relative h-[200px] flex-1 select-none", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 rounded-md bg-primary/10 border border-primary/30" />
      <div
        ref={ref}
        role="listbox"
        aria-label={ariaLabel}
        onScroll={onScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar touch-pan-y"
        style={{ scrollbarWidth: "none" }}
      >
        <div style={{ height: ITEM_H * 2 }} />
        {values.map((v) => (
          <div
            key={String(v)}
            className={cn(
              "snap-center flex items-center justify-center tabular-nums transition-all",
              v === value ? "text-foreground font-semibold text-xl" : "text-muted-foreground text-base opacity-60",
            )}
            style={{ height: ITEM_H }}
          >
            {render ? render(v) : v}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}
