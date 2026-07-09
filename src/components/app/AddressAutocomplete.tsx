import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { toast } from "sonner";
import { placesAutocomplete, placeDetails } from "@/lib/maps.functions";

export interface AddressValue {
  address: string;
  coords?: { lat: number; lng: number };
}

interface Props {
  value: string;
  onChange: (v: AddressValue) => void;
  placeholder?: string;
  extraButton?: React.ReactNode;
}

export function AddressAutocomplete({ value, onChange, placeholder, extraButton }: Props) {
  const autocomplete = useServerFn(placesAutocomplete);
  const details = useServerFn(placeDetails);
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<{ placeId: string; main: string; secondary: string }>>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const search = (input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 3) {
      setItems([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await autocomplete({ data: { input } });
        setItems(r.map((x) => ({ placeId: x.placeId, main: x.main || x.text, secondary: x.secondary })));
        setOpen(true);
      } catch (e) {
        console.error(e);
        toast.error("Address search failed");
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const pick = async (placeId: string) => {
    setOpen(false);
    try {
      const d = await details({ data: { placeId } });
      const addr = d.address;
      setQ(addr);
      onChange({
        address: addr,
        coords: d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : undefined,
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not load address details");
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-1">
        <Input
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            onChange({ address: e.target.value });
            search(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
        />
        {q && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setQ("");
              onChange({ address: "" });
              setItems([]);
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
        {extraButton}
      </div>
      {open && q.trim().length > 0 && q.trim().length < 3 && (
        <div className="mt-1 text-xs text-muted-foreground">Type 3+ characters to search…</div>
      )}
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border rounded-md shadow-md max-h-72 overflow-auto">
          {loading && <div className="p-2 text-sm text-muted-foreground">Searching…</div>}
          {items.map((it) => (
            <button
              key={it.placeId}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
              onClick={() => pick(it.placeId)}
            >
              <div className="font-medium">{it.main}</div>
              {it.secondary && <div className="text-xs text-muted-foreground">{it.secondary}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
