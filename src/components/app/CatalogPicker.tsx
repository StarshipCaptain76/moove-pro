import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Plus, ChevronsUpDown } from "lucide-react";
import type { CatalogItem } from "@/lib/store";
import { fmtMoney } from "@/lib/store";

interface Props {
  catalog: CatalogItem[];
  currency: string;
  onPick: (c: CatalogItem) => void;
  triggerClassName?: string;
  usage?: Record<string, number>;
}

export function CatalogPicker({ catalog, currency, onPick, triggerClassName, usage }: Props) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => {
      const use = (c: CatalogItem) => usage?.[c.name.trim().toLowerCase()] ?? 0;
      return [...catalog].sort((a, b) => {
        const ua = use(a), ub = use(b);
        if (ua !== ub) return ub - ua;
        return a.name.localeCompare(b.name);
      });
    },
    [catalog, usage],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <Plus className="h-4 w-4 mr-1" /> Catalog <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search catalog…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {sorted.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                >
                  <div className="flex-1">
                    <div>{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtMoney(c.price, currency)} / {c.unit}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
