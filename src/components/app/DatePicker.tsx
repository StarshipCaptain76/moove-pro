import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * App-wide date picker. Wraps the shadcn Calendar in a Popover so users
 * never see a keyboard for date entry. Value is an ISO yyyy-MM-dd string.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
  className,
}: {
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-11 justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
          </span>
          {clearable && selected && (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}