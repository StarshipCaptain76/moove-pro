import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Customer } from "@/lib/store";

interface Props {
  value: string;
  customers: Customer[];
  onType: (name: string) => void;
  onPick: (c: Customer) => void;
}

export function CustomerCombobox({ value, customers, onType, onPick }: Props) {
  const [open, setOpen] = useState(false);
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
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => {
            onType(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Customer name — search past customers"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[--radix-popover-trigger-width] p-1"
      >
        {matches.map((c) => (
          <button
            key={c.id}
            type="button"
            className="w-full text-left px-2 py-1.5 hover:bg-accent rounded text-sm"
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
      </PopoverContent>
    </Popover>
  );
}
