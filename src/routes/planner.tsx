import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, type Doc, type PayMethod } from "@/lib/store";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isToday, isTomorrow,
  startOfMonth, startOfWeek,
} from "date-fns";
import { useMemo, useState, useRef, useCallback } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, ChevronDown, GripVertical, Check, X, CalendarDays, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DatePicker } from "@/components/app/DatePicker";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext } from "react";

const JobActionsCtx = createContext<((d: Doc) => void) | null>(null);
function usePlannerActions() {
  return useContext(JobActionsCtx) ?? (() => {});
}

export const Route = createFileRoute("/planner")({ component: PlannerPage });

type MaterialKey = "furniture" | "rubble" | "garden" | "sandstone" | "grass" | "other";
const MATERIALS: Record<MaterialKey, { label: string; dot: string; card: string; border: string }> = {
  furniture: { label: "Furniture",  dot: "bg-amber-500",   card: "bg-amber-500/10",   border: "border-amber-500" },
  rubble:    { label: "Rubble",     dot: "bg-stone-500",   card: "bg-stone-500/10",   border: "border-stone-500" },
  garden:    { label: "Garden",     dot: "bg-emerald-500", card: "bg-emerald-500/10", border: "border-emerald-500" },
  sandstone: { label: "Sand/Stone", dot: "bg-yellow-500",  card: "bg-yellow-500/10",  border: "border-yellow-500" },
  grass:     { label: "Grass",      dot: "bg-lime-500",    card: "bg-lime-500/10",    border: "border-lime-500" },
  other:     { label: "Other",      dot: "bg-slate-400",   card: "bg-secondary",      border: "border-slate-400" },
};

function jobMaterialCategory(doc: Doc): MaterialKey {
  const text = doc.items.map((i) => i.description.toLowerCase()).join(" ");
  if (/furniture/.test(text)) return "furniture";
  if (/rubble/.test(text)) return "rubble";
  if (/garden/.test(text)) return "garden";
  if (/sand|stone/.test(text)) return "sandstone";
  if (/grass/.test(text)) return "grass";
  return "other";
}


const SUMMARY_KEYWORDS = [
  "rubble", "garden", "furniture", "sand", "grass", "tree", "rock", "brick", "soil", "concrete",
  "tiles", "wood", "general", "appliances", "boxes", "rubbish", "waste", "removal", "labour", "packing",
];

function jobSummary(doc: Doc): string {
  const found = new Set<string>();
  doc.items.forEach((item) => {
    const text = item.description.toLowerCase();
    SUMMARY_KEYWORDS.forEach((kw) => {
      if (text.includes(kw)) found.add(kw.charAt(0).toUpperCase() + kw.slice(1));
    });
  });
  return Array.from(found).slice(0, 3).join(", ") || "Job";
}

function PaymentIndicator({ doc }: { doc: Doc }) {
  if (doc.status === "paid") return <span className="h-2 w-2 rounded-full bg-green-500" title="Paid" />;
  return <span className="text-[10px] uppercase font-bold px-1 py-0.5 rounded bg-red-500 text-white leading-none">unpaid</span>;
}

type View = "agenda" | "week" | "month";


function PlannerPage() {
  const { docs, upsertDoc, billing } = useStore();
  const [view, setView] = useState<View>("agenda");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [showUnsched, setShowUnsched] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [actionDoc, setActionDoc] = useState<Doc | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const openActions = (d: Doc) => { setActionDoc(d); setMoveMode(false); };

  const jobs = useMemo(() => docs.filter((d) => d.status === "accepted" || d.status === "paid"), [docs]);
  const byDay = (iso: string) =>
    jobs.filter((d) => d.scheduledDate === iso).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
  // Paid docs without a scheduled date are historical / closed jobs — don't
  // surface them as "unscheduled". Only accepted jobs still need scheduling.
  const unscheduled = jobs.filter((d) => !d.scheduledDate && d.status === "accepted");

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const doc = jobs.find((d) => d.id === id);
    if (!doc) return;
    if (overId === "unscheduled") upsertDoc({ ...doc, scheduledDate: undefined });
    else upsertDoc({ ...doc, scheduledDate: overId, dayOrder: byDay(overId).length });
  };

  // Agenda: next 30 days that have jobs, plus today
  const agendaDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 60; i++) days.push(addDays(new Date(), i));
    return days.filter((d, i) => i === 0 || byDay(format(d, "yyyy-MM-dd")).length > 0);
  }, [jobs]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let d = monthGridStart; d <= monthGridEnd; d = addDays(d, 1)) monthDays.push(d);

  const closeActions = () => { setActionDoc(null); setMoveMode(false); };
  const markPaid = (m: PayMethod) => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, status: "paid", paymentMethod: m, paidAt: new Date().toISOString() });
    toast.success(`Marked paid (${m.toUpperCase()})`);
    closeActions();
  };
  const cancelJob = () => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, status: "cancelled" });
    toast.success("Job cancelled");
    closeActions();
  };
  const moveTo = (iso: string | undefined) => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, scheduledDate: iso, dayOrder: iso ? byDay(iso).length : undefined });
    toast.success(iso ? `Moved to ${iso}` : "Unscheduled");
    closeActions();
  };

  return (
    <Shell>
     <JobActionsCtx.Provider value={openActions}>
      {/* View switcher */}
      <div className="inline-flex rounded-lg border p-0.5 bg-muted mb-3 w-full sm:w-auto">
        {(["agenda", "week", "month"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors",
              view === v ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Navigation */}
      {view !== "agenda" && (
        <div className="flex items-center gap-2 mb-3">
          <Button size="icon" variant="outline" className="h-10 w-10" onClick={() =>
            view === "week" ? setWeekStart(addDays(weekStart, -7)) : setMonthAnchor(addMonths(monthAnchor, -1))
          }><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium text-sm flex-1 text-center">
            {view === "week"
              ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM")}`
              : format(monthAnchor, "MMMM yyyy")}
          </div>
          <Button size="icon" variant="outline" className="h-10 w-10" onClick={() =>
            view === "week" ? setWeekStart(addDays(weekStart, 7)) : setMonthAnchor(addMonths(monthAnchor, 1))
          }><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="secondary" className="h-10" onClick={() =>
            view === "week"
              ? setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
              : setMonthAnchor(startOfMonth(new Date()))
          }>Today</Button>
        </div>
      )}

      {/* Unscheduled pill */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {unscheduled.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowUnsched((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border bg-amber-500/10 border-amber-500/30 text-sm font-medium"
            >
              <span>{unscheduled.length} unscheduled job{unscheduled.length === 1 ? "" : "s"}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showUnsched && "rotate-180")} />
            </button>
            {showUnsched && (
              <DropZone id="unscheduled" className="mt-2">
                <div className="grid gap-2">
                  {unscheduled.map((d) => <JobCard key={d.id} doc={d} currency={billing.currency} vat={billing.vatPct} />)}
                </div>
              </DropZone>
            )}
          </div>
        )}

        <Legend />

        {view === "agenda" && (
          <div className="space-y-4">
            {agendaDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const dayJobs = byDay(iso);
              return <AgendaDay key={iso} date={d} iso={iso} docs={dayJobs} currency={billing.currency} vat={billing.vatPct} />;
            })}
          </div>
        )}

        {view === "week" && (
          <div className="space-y-2 md:grid md:grid-cols-7 md:gap-2 md:space-y-0">
            {weekDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              return (
                <DayCol key={iso} date={d} iso={iso} docs={byDay(iso)} currency={billing.currency} vat={billing.vatPct} />
              );
            })}
          </div>
        )}

        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-muted-foreground mb-1">
              {["M","T","W","T","F","S","S"].map((d, i) => <div key={i} className="text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                return <MonthCell key={iso} date={d} iso={iso} inMonth={isSameMonth(d, monthAnchor)} docs={byDay(iso)} />;
              })}
            </div>
          </div>
        )}
      </DndContext>

      <JobActionSheet
        doc={actionDoc}
        onClose={closeActions}
        moveMode={moveMode}
        onEnterMove={() => setMoveMode(true)}
        onMove={moveTo}
        onMarkPaid={markPaid}
        onCancel={cancelJob}
      />
     </JobActionsCtx.Provider>
    </Shell>
  );
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => { onLongPress(); timer.current = null; }, ms);
  }, [onLongPress, ms]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > 64) clear();
  }, []);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); onLongPress(); }, [onLongPress]);
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu,
  };
}

function JobActionSheet({
  doc, onClose, moveMode, onEnterMove, onMove, onMarkPaid, onCancel,
}: {
  doc: Doc | null;
  onClose: () => void;
  moveMode: boolean;
  onEnterMove: () => void;
  onMove: (iso: string | undefined) => void;
  onMarkPaid: (m: PayMethod) => void;
  onCancel: () => void;
}) {
  const nav = useNavigate();
  return (
    <Sheet open={!!doc} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {doc?.customer.name || "—"}
            <div className="text-xs font-normal text-muted-foreground mt-0.5">
              {doc?.number} · {doc?.scheduledDate ?? "unscheduled"}
            </div>
          </SheetTitle>
        </SheetHeader>
        {!moveMode ? (
          <div className="mt-4 space-y-2">
            {doc?.status !== "paid" && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Record payment</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash","eft","card"] as PayMethod[]).map((m) => (
                    <Button key={m} className="h-11 uppercase" onClick={() => onMarkPaid(m)}>
                      <Check className="h-4 w-4 mr-1.5" /> {m}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Button variant="secondary" className="w-full h-11" onClick={onEnterMove}>
              <CalendarDays className="h-4 w-4 mr-2" /> Move to another day
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={() => { if (doc) nav({ to: "/doc/$id", params: { id: doc.id } }); onClose(); }}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open job
            </Button>
            <Button variant="destructive" className="w-full h-11" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" /> Cancel job
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">Pick a new date</div>
            <DatePicker value={doc?.scheduledDate} onChange={(iso) => onMove(iso)} clearable />
            <Button variant="ghost" className="w-full" onClick={() => onMove(undefined)}>
              Move to unscheduled
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[10px] text-muted-foreground">
      {(Object.keys(MATERIALS) as MaterialKey[]).map((k) => (
        <div key={k} className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${MATERIALS[k].dot}`} />
          <span>{MATERIALS[k].label}</span>
        </div>
      ))}
    </div>

  );
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, d MMM");
}

function AgendaDay({ date, iso, docs, currency, vat }: { date: Date; iso: string; docs: Doc[]; currency: string; vat: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  return (
    <div ref={setNodeRef} className={cn(
      "rounded-lg border transition-colors",
      isOver && "border-primary bg-primary/5",
      today && "border-primary/50",
    )}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <div>
          <div className={cn("font-semibold text-sm", today && "text-primary")}>{dayLabel(date)}</div>
          <div className="text-[10px] text-muted-foreground uppercase">{format(date, "d MMM yyyy")}</div>
        </div>
        <span className="text-xs text-muted-foreground">{docs.length} job{docs.length === 1 ? "" : "s"}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[3rem]">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No jobs</p>
        ) : (
          docs.map((d) => <AgendaJob key={d.id} doc={d} currency={currency} vat={vat} />)
        )}
      </div>
    </div>
  );
}

function AgendaJob({ doc, currency, vat }: { doc: Doc; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const t = docTotals(doc, vat);
  const c = MATERIALS[jobMaterialCategory(doc)];
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <div ref={setNodeRef} style={style} className={cn(
      "flex items-stretch rounded-lg border-l-4 bg-background border overflow-hidden",
      c.border, isDragging && "opacity-50",
    )} {...lp}>
      <button {...listeners} {...attributes} className="px-2 flex items-center text-muted-foreground touch-none cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to="/doc/$id" params={{ id: doc.id }} className={cn("flex-1 flex items-center justify-between py-2 pr-3 gap-2", c.card)}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{doc.customer.name || "—"}</div>
          <div className="text-[11px] text-muted-foreground truncate">{doc.number} · {doc.fromAddress || "no address"}</div>
          <div className="text-[11px] font-medium truncate">{jobSummary(doc)}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-sm font-mono font-semibold">{fmtMoney(t.total, currency)}</div>
          <PaymentIndicator doc={doc} />
        </div>
      </Link>
    </div>
  );
}

function DayCol({ date, iso, docs, currency, vat }: { date: Date; iso: string; docs: Doc[]; currency: string; vat: number }) {

  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border overflow-hidden md:min-h-64",
        isOver ? "border-primary bg-primary/5" : "border-border bg-card",
        today && "ring-2 ring-primary",
        isWeekend && !today && "bg-muted/30",
      )}
    >
      {/* Header — horizontal on mobile, stacked on desktop */}
      <div
        className={cn(
          "flex items-baseline gap-2 px-3 py-2 border-b bg-muted/40 md:flex-col md:items-start md:gap-0 md:bg-transparent md:border-b-0 md:pb-1",
          today && "text-primary",
        )}
      >
        <span className="text-xs uppercase font-semibold tracking-wide">{format(date, "EEE")}</span>
        <span className="font-display text-2xl leading-none md:mt-0.5">{format(date, "d")}</span>
        <span className="text-[10px] uppercase text-muted-foreground md:hidden">{format(date, "MMM")}</span>
        <span className="ml-auto text-[11px] text-muted-foreground md:hidden">
          {docs.length === 0 ? "no jobs" : `${docs.length} job${docs.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="p-2 space-y-1.5 min-h-[3rem]">
        {docs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-1.5 md:py-3">—</p>
        ) : (
          docs.map((d) => <JobCard key={d.id} doc={d} currency={currency} vat={vat} />)
        )}
      </div>
    </div>
  );
}

function MonthCell({ date, iso, inMonth, docs }: { date: Date; iso: string; inMonth: boolean; docs: Doc[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const today = isToday(date);
  return (
    <div ref={setNodeRef} className={cn(
      "rounded border min-h-16 sm:min-h-24 p-1 text-xs",
      inMonth ? "bg-card" : "bg-muted/40 opacity-60",
      isOver ? "border-primary bg-primary/5" : "border-border",
      today && "ring-2 ring-primary",
    )}>
      <div className={cn("font-display text-sm sm:text-lg leading-none mb-1", today && "text-primary")}>{format(date, "d")}</div>
      <div className="space-y-0.5">
        {docs.slice(0, 3).map((d) => <MiniJob key={d.id} doc={d} />)}
        {docs.length > 3 && <div className="text-[9px] text-muted-foreground">+{docs.length - 3}</div>}
      </div>
    </div>
  );
}

function MiniJob({ doc }: { doc: Doc }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const c = CATEGORIES[jobCategory(doc)];
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <Link to="/doc/$id" params={{ id: doc.id }}>
      <div ref={setNodeRef} style={style} {...listeners} {...attributes} {...lp}
        className={cn("rounded px-1 py-0.5 truncate border-l-2 cursor-grab text-[10px] flex items-center gap-1", c.card, c.border, isDragging && "opacity-50")}
        title={`${doc.customer.name || "—"} · ${doc.number} · ${jobSummary(doc)}`}>
        <PaymentIndicator doc={doc} />
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
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} {...lp}
      className={cn("rounded p-2 text-xs cursor-grab border-l-4", c.card, c.border, isDragging && "opacity-50")}>
      <div className="font-semibold truncate">{doc.customer.name || "—"}</div>
      <div className="opacity-80 truncate">{jobSummary(doc)}</div>
      <div className="flex items-center justify-between gap-1">
        <div className="opacity-80">{fmtMoney(t.total, currency)}</div>
        <PaymentIndicator doc={doc} />
      </div>
      <Link to="/doc/$id" params={{ id: doc.id }} className="text-primary underline text-[10px]">open</Link>
    </div>
  );
}


function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <Card ref={setNodeRef} className={cn("p-3", isOver && "ring-2 ring-primary", className)}>{children}</Card>;
}
