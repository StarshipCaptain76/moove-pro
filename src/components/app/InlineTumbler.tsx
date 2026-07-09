import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Inline horizontal tumbler — swipe left/right to change the value.
 * Tap the number to edit exactly. Long-press to toggle fine step.
 * Values are clamped to min = 0.
 */
export function InlineTumbler({
  value,
  onChange,
  step = 1,
  fineStep,
  min = 0,
  max,
  prefix,
  suffix,
  format,
  className,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  fineStep?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
  label?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [fine, setFine] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const startX = useRef(0);
  const startVal = useRef(value);
  const lastVal = useRef(value);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStep = fineStep && fine ? fineStep : step;

  const clamp = (n: number) => {
    let v = Math.max(min, n);
    if (max != null) v = Math.min(max, v);
    // round to step precision
    const inv = 1 / activeStep;
    return Math.round(v * inv) / inv;
  };

  const fmt = (n: number) => (format ? format(n) : `${prefix ?? ""}${n}${suffix ?? ""}`);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startVal.current = value;
    lastVal.current = value;
    setDragging(true);
    longPress.current = setTimeout(() => setFine((v) => !v), 450);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6 && longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
    // 16px per step
    const delta = Math.trunc(dx / 16) * activeStep;
    const next = clamp(startVal.current + delta);
    if (next !== lastVal.current) {
      lastVal.current = next;
      onChange(next);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(3);
    }
  };
  const onPointerUp = () => {
    setDragging(false);
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  useEffect(() => {
    if (editing) setDraft(String(value));
  }, [editing, value]);

  const commitEdit = () => {
    const n = Number(draft);
    onChange(clamp(isFinite(n) ? n : min));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1) => onChange(clamp(value + dir * activeStep));

  return (
    <>
      <div
        className={cn(
          "relative select-none touch-none rounded-md border bg-background h-11 flex items-center overflow-hidden",
          dragging && "ring-2 ring-primary/60",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="h-full px-2 text-muted-foreground hover:text-foreground text-lg"
          aria-label="Decrease"
        >
          −
        </button>
        <div
          className="flex-1 h-full flex items-center justify-center relative cursor-ew-resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => !dragging && setEditing(true)}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground absolute top-0.5">
            {fine ? "fine" : ""}
          </div>
          <div className="font-semibold tabular-nums text-base">{fmt(value)}</div>
          {/* tick marks */}
          <div className="absolute inset-x-2 bottom-0.5 h-1 flex justify-between opacity-40 pointer-events-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className={cn("w-px", i === 4 ? "h-1 bg-primary" : "h-0.5 bg-muted-foreground")} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => nudge(1)}
          className="h-full px-2 text-muted-foreground hover:text-foreground text-lg"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      <Sheet open={editing} onOpenChange={(o) => (o ? setEditing(true) : commitEdit())}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{label ?? "Enter value"}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 mt-3 pb-[env(safe-area-inset-bottom)]">
            <Input
              autoFocus
              type="number"
              inputMode="decimal"
              min={min}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitEdit()}
              className="h-14 text-2xl text-center"
            />
            <Button onClick={commitEdit} className="h-12">
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}