import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, type Doc } from "@/lib/store";
import { addDays, format, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/planner")({ component: PlannerPage });

function PlannerPage() {
  const { docs, upsertDoc, billing } = useStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
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

  return (
    <Shell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl tracking-wide">PLANNER</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium w-40 text-center">{format(weekStart, "d MMM")} — {format(addDays(weekStart, 6), "d MMM yyyy")}</div>
          <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-7 gap-2 mb-4">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            return <DayCol key={iso} date={d} iso={iso} docs={byDay(iso)} currency={billing.currency} vat={billing.vatPct} />;
          })}
        </div>
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

function JobCard({ doc, currency, vat }: { doc: Doc; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const t = docTotals(doc, vat);
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`rounded p-2 text-xs cursor-grab bg-secondary text-secondary-foreground border-l-4 border-primary ${isDragging ? "opacity-50" : ""}`}>
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