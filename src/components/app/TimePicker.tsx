import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WheelSelect } from "@/components/app/WheelSelect";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, "0");

export function formatTime(hhmm?: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Optional start time picker. Value is "HH:mm"; rollers only, no keyboard.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Set time (optional)",
  className,
}: {
  value?: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(8);
  const [m, setM] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (value) {
      const [vh, vm] = value.split(":").map(Number);
      setH(isFinite(vh) ? vh : 8);
      setM(isFinite(vm) ? Math.round(vm / 5) * 5 % 60 : 0);
    }
  }, [open, value]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("w-full h-11 justify-start text-left font-normal", !value && "text-muted-foreground", className)}
      >
        <Clock className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{value ? formatTime(value) : placeholder}</span>
        {value && (
          <X
            className="h-4 w-4 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Start time</SheetTitle>
          </SheetHeader>
          <div className="mt-2 flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
            <WheelSelect values={HOURS} value={h} onChange={(v) => setH(Number(v))} render={(v) => pad(Number(v))} ariaLabel="Hour" />
            <div className="text-xl font-semibold">:</div>
            <WheelSelect values={MINUTES} value={m} onChange={(v) => setM(Number(v))} render={(v) => pad(Number(v))} ariaLabel="Minute" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pb-[env(safe-area-inset-bottom)]">
            <Button
              variant="outline"
              onClick={() => {
                const now = new Date();
                setH(now.getHours());
                setM(Math.round(now.getMinutes() / 5) * 5 % 60);
              }}
            >
              Now
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                onChange(`${pad(h)}:${pad(m)}`);
                setOpen(false);
              }}
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
