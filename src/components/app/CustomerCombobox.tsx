import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/store";

interface Props {
  value: string;
  customers: Customer[];
  onType: (name: string) => void;
  onPick: (c: Customer) => void;
}

export function CustomerCombobox({ value, customers, onType, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.toLowerCase().trim();
  const matches = q
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q),
        )
        .slice(0, 8)
    : customers.slice(0, 8);

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Customer name — search past customers"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border rounded-md shadow-md max-h-72 overflow-auto p-1">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-2 py-1.5 hover:bg-accent rounded text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {[c.phone, c.email].filter(Boolean).join(" • ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
