import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth,
  startOfMonth, startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/planner")({ component: PlannerPage });

type CategoryKey = "move" | "packing" | "storage" | "labour" | "disposal" | "other";
const CATEGORIES: Record<CategoryKey, { label: string; dot: string; card: string; border: string }> = {
  move:     { label: "Move",     dot: "bg-blue-500",   card: "bg-blue-500/10 text-blue-950 dark:text-blue-100",       border: "border-blue-500" },
  packing:  { label: "Packing",  dot: "bg-amber-500",  card: "bg-amber-500/10 text-amber-950 dark:text-amber-100",    border: "border-amber-500" },
  storage:  { label: "Storage",  dot: "bg-violet-500", card: "bg-violet-500/10 text-violet-950 dark:text-violet-100", border: "border-violet-500" },
  labour:   { label: "Labour",   dot: "bg-emerald-500",card: "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100", border: "border-emerald-500" },
  disposal: { label: "Disposal", dot: "bg-rose-500",   card: "bg-rose-500/10 text-rose-950 dark:text-rose-100",       border: "border-rose-500" },
  other:    { label: "Other",    dot: "bg-slate-400",  card: "bg-secondary text-secondary-foreground",                border: "border-slate-400" },
};

function jobCategory(doc: Doc): CategoryKey {
  const text = doc.items.map((i) => i.description.toLowerCase()).join(" ") + " " + (doc.toAddress ?? "").toLowerCase();
  if (/disposal|dump|melkhout/.test(text)) return "disposal";
  if (/pack/.test(text)) return "packing";
  if (/storage/.test(text)) return "storage";
  if (/labour|labor/.test(text)) return "labour";
  if (/move|moving|transport|relocat/.test(text)) return "move";
  return "other";
}

function PlannerPage() {
  const { docs, upsertDoc, billing } = useStore();
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const jobs = useMemo(() => docs.filter((d) => d.status === "accepted" || d.status === "paid"), [docs]);
  const byDay = (iso: string) =>
    jobs
      .filter((d) => d.scheduledDate === iso)
      .sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
  const unscheduled = jobs.filter((d) => !d.scheduledDate);

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const doc = jobs.find((d) => d.id === id);
    if (!doc) return;
    if (overId === "unscheduled") {
      upsertDoc({ ...doc, scheduledDate: undefined });
    } else {
      upsertDoc({ ...doc, scheduledDate: overId, dayOrder: byDay(overId).length });
    }
  };

  const monthGridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let d = monthGridStart; d <= monthGridEnd; d = addDays(d, 1)) monthDays.push(d);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl tracking-wide">PLANNER</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border overflow-hidden mr-2">
            <button onClick={() => setView("week")}  className={`px-3 py-1.5 text-sm ${view === "week"  ? "bg-primary text-primary-foreground" : "bg-background"}`}>Week</button>
            <button onClick={() => setView("month")} className={`px-3 py-1.5 text-sm ${view === "month" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Month</button>
          </div>
          {view === "week" ? (
            <>
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="font-medium w-48 text-center">{format(weekStart, "d MMM")} — {format(addDays(weekStart, 6), "d MMM yyyy")}</div>
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="outline" onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="font-medium w-40 text-center">{format(monthAnchor, "MMMM yyyy")}</div>
              <Button size="icon" variant="outline" onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => setMonthAnchor(startOfMonth(new Date()))}>Today</Button>
            </>
          )}
        </div>
      </div>

      <Legend />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {view === "week" ? (
          <div className="grid grid-cols-7 gap-2 mb-4">
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              return <DayCol key={iso} date={d} iso={iso} docs={byDay(iso)} currency={billing.currency} vat={billing.vatPct} />;
            })}
          </div>
        ) : (
          <div className="mb-4">
            <div className="grid grid-cols-7 gap-1 text-xs uppercase text-muted-foreground mb-1">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="px-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                return (
                  <MonthCell
                    key={iso}
                    date={d}
                    iso={iso}
                    inMonth={isSameMonth(d, monthAnchor)}
                    docs={byDay(iso)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <DropZone id="unscheduled">
          <h3 className="font-semibold text-sm mb-2">Unscheduled accepted jobs</h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
            {unscheduled.map((d) => <JobCard key={d.id} doc={d} currency={billing.currency} vat={billing.vatPct} />)}
          </div>
        </DropZone>
      </DndContext>
    </Shell>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
      {(Object.keys(CATEGORIES) as CategoryKey[]).map((k) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${CATEGORIES[k].dot}`} />
          <span>{CATEGORIES[k].label}</span>
        </div>
      ))}
    </div>
  );
}

function DayCol({ date, iso, docs, currency, vat }: { date: Date; iso: string; docs: Doc[]; currency: string; vat: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const isToday = format(new Date(), "yyyy-MM-dd") === iso;
  return (
    <div ref={setNodeRef} className={`rounded border min-h-64 p-2 ${isOver ? "border-primary bg-primary/5" : "border-border bg-card"} ${isToday ? "ring-2 ring-primary" : ""}`}>
      <div className="text-xs uppercase text-muted-foreground">{format(date, "EEE")}</div>
      <div className="font-display text-2xl mb-2">{format(date, "d")}</div>
      <div className="space-y-1.5">
        {docs.map((d) => <JobCard key={d.id} doc={d} currency={currency} vat={vat} />)}
      </div>
    </div>
  );
}

function MonthCell({ date, iso, inMonth, docs }: { date: Date; iso: string; inMonth: boolean; docs: Doc[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const isToday = format(new Date(), "yyyy-MM-dd") === iso;
  return (
    <div
      ref={setNodeRef}
      className={`rounded border min-h-24 p-1.5 text-xs ${inMonth ? "bg-card" : "bg-muted/40 opacity-60"} ${isOver ? "border-primary bg-primary/5" : "border-border"} ${isToday ? "ring-2 ring-primary" : ""}`}
    >
      <div className={`font-display text-lg leading-none mb-1 ${isToday ? "text-primary" : ""}`}>{format(date, "d")}</div>
      <div className="space-y-1">
        {docs.slice(0, 4).map((d) => <MiniJob key={d.id} doc={d} />)}
        {docs.length > 4 && <div className="text-[10px] text-muted-foreground">+{docs.length - 4} more</div>}
      </div>
    </div>
  );
}

function MiniJob({ doc }: { doc: Doc }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const c = CATEGORIES[jobCategory(doc)];
  return (
    <Link to="/doc/$id" params={{ id: doc.id }}>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`rounded px-1.5 py-0.5 truncate border-l-2 cursor-grab ${c.card} ${c.border} ${isDragging ? "opacity-50" : ""}`}
        title={`${doc.customer.name || "—"} · ${doc.number}`}
      >
        {doc.customer.name || doc.number}
      </div>
    </Link>
  );
}

function JobCard({ doc, currency, vat }: { doc: Doc; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const t = docTotals(doc, vat);
  const c = CATEGORIES[jobCategory(doc)];
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`rounded p-2 text-xs cursor-grab border-l-4 ${c.card} ${c.border} ${isDragging ? "opacity-50" : ""}`}>
      <div className="font-semibold truncate">{doc.customer.name || "—"}</div>
      <div className="opacity-80 truncate">{doc.number}</div>
      <div className="opacity-80">{fmtMoney(t.total, currency)}</div>
      <Link to="/doc/$id" params={{ id: doc.id }} className="text-primary underline text-[10px]">open</Link>
    </div>
  );
}

function DropZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <Card ref={setNodeRef} className={`p-3 ${isOver ? "ring-2 ring-primary" : ""}`}>{children}</Card>;
}