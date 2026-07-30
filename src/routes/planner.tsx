import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/app/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore, docTotals, fmtMoney, type Doc, type PayMethod } from "@/lib/store";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isToday, isTomorrow, parseISO,
  startOfMonth, startOfWeek,
} from "date-fns";
import { useMemo, useState, useRef, useCallback } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, ChevronDown, GripVertical, Check, X, CalendarDays, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatePicker } from "@/components/app/DatePicker";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { flushSync } from "@/lib/sync";
import { createContext, useContext } from "react";
import { PlannerMap, type PlannerMapJob } from "@/components/app/PlannerMap";

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
  other:     { label: "Other",      dot: "bg-sky-500",     card: "bg-sky-500/10",     border: "border-sky-500" },
};

const MATERIAL_HEX: Record<MaterialKey, string> = {
  furniture: "#f59e0b",
  rubble:    "#78716c",
  garden:    "#10b981",
  sandstone: "#eab308",
  grass:     "#84cc16",
  other:     "#0ea5e9",
};

function buildMapJobs(jobs: Doc[], from: Date): PlannerMapJob[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(format(addDays(from, i), "yyyy-MM-dd"));
  const seen = new Set<string>();
  const out: PlannerMapJob[] = [];
  for (const iso of days) {
    for (const d of jobs) {
      if (!coversDay(d, iso)) continue;
      // one pin per job on its start day within the window
      const startIso = d.scheduledDate || paidDate(d);
      const showIso = (startIso && days.includes(startIso)) ? startIso : iso;
      const key = d.id + ":" + showIso;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const cat = jobMaterialCategory(d);
      out.push({
        id: d.id,
        date: showIso,
        color: MATERIAL_HEX[cat],
        category: MATERIALS[cat].label,
        customer: d.customer?.name || "Job",
        number: d.number,
        fromAddress: d.fromAddress,
        toAddress: d.toAddress,
        fromCoords: d.fromCoords,
        toCoords: d.toCoords,
        stopCoords: (d.stops ?? []).map((s) => s.coords).filter(Boolean) as Array<{ lat: number; lng: number }>,
      });
    }
  }
  return out;
}

function jobMaterialCategory(doc: Doc): MaterialKey {
  if (doc.jobCategory && (doc.jobCategory as string) in MATERIALS) {
    return doc.jobCategory as MaterialKey;
  }
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
  return <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Unpaid" />;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const paidDate = (doc: Doc) => {
  if (doc.status !== "paid" || !doc.paidAt) return undefined;
  return format(new Date(doc.paidAt), "yyyy-MM-dd");
};
const plannerDate = (doc: Doc) => doc.scheduledDate || paidDate(doc);
// A job covers this ISO day if it's the planner date, or the day falls within
// [scheduledDate, scheduledEndDate] for multi-day jobs.
const coversDay = (doc: Doc, iso: string) => {
  const start = doc.scheduledDate;
  const end = doc.scheduledEndDate;
  if (start && end && end >= start) return iso >= start && iso <= end;
  return plannerDate(doc) === iso;
};
// For multi-day jobs, return where `iso` falls within the span.
const spanInfo = (doc: Doc, iso?: string) => {
  if (!iso || !doc.scheduledDate || !doc.scheduledEndDate) return null;
  if (doc.scheduledEndDate <= doc.scheduledDate) return null;
  const start = parseISO(doc.scheduledDate);
  const end = parseISO(doc.scheduledEndDate);
  const cur = parseISO(iso);
  const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const idx = Math.round((cur.getTime() - start.getTime()) / 86400000) + 1;
  if (idx < 1 || idx > total) return null;
  return { idx, total, isFirst: idx === 1, isLast: idx === total };
};

type View = "agenda" | "week" | "month";


function PlannerPage() {
  const { docs, upsertDoc, billing } = useStore();
  const [view, setView] = useState<View>("agenda");
  const [weekStart, setWeekStart] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [agendaStart, setAgendaStart] = useState(() => new Date());
  const [showUnsched, setShowUnsched] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [actionDoc, setActionDoc] = useState<Doc | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const openActions = (d: Doc) => { setActionDoc(d); setMoveMode(false); };

  // Show accepted/paid jobs, plus any invoice that isn't cancelled — a draft
  // or sent invoice scheduled for a day is still real work on the calendar.
  const jobs = useMemo(
    () =>
      docs.filter(
        (d) =>
          d.status === "accepted" ||
          d.status === "paid" ||
          (d.type === "invoice" && d.status !== "cancelled") ||
          (d.type === "job" && d.status !== "cancelled"),
      ),
    [docs],
  );
  const byDay = (iso: string) =>
    jobs.filter((d) => coversDay(d, iso)).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
  // Paid docs without a scheduled date are historical / closed jobs — don't
  // surface them as "unscheduled". Only accepted jobs still need scheduling.
  const unscheduled = jobs.filter(
    (d) => !d.archived && !d.scheduledDate && d.status !== "paid" && (d.status === "accepted" || d.type === "invoice" || d.type === "job"),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const doc = jobs.find((d) => d.id === id);
    if (!doc) return;
    if (overId === "unscheduled") {
      upsertDoc({ ...doc, scheduledDate: undefined, scheduledEndDate: undefined });
    } else {
      // Preserve multi-day span: shift end date by the same delta as start.
      let newEnd: string | undefined = doc.scheduledEndDate;
      if (doc.scheduledDate && doc.scheduledEndDate) {
        const start = parseISO(doc.scheduledDate);
        const end = parseISO(doc.scheduledEndDate);
        const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
        newEnd = format(addDays(parseISO(overId), spanDays), "yyyy-MM-dd");
      }
      upsertDoc({ ...doc, scheduledDate: overId, scheduledEndDate: newEnd, dayOrder: byDay(overId).length });
    }
  };

  // Agenda: next 30 days that have jobs, plus today
  const agendaDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 60; i++) days.push(addDays(agendaStart, i));
    return days.filter((d, i) => i === 0 || byDay(format(d, "yyyy-MM-dd")).length > 0);
  }, [jobs, agendaStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let d = monthGridStart; d <= monthGridEnd; d = addDays(d, 1)) monthDays.push(d);

  const closeActions = () => { setActionDoc(null); setMoveMode(false); };
  const markPaid = (m: PayMethod) => {
    if (!actionDoc) return;
    upsertDoc({ ...actionDoc, status: "paid", archived: false, paymentMethod: m, paidAt: new Date().toISOString(), scheduledDate: actionDoc.scheduledDate ?? todayIso() });
    void flushSync();
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

  const swipe = useSwipe({
    onLeft: () => {
      if (view === "agenda") setAgendaStart(addDays(agendaStart, 1));
      else if (view === "week") setWeekStart(addDays(weekStart, 7));
      else setMonthAnchor(addMonths(monthAnchor, 1));
    },
    onRight: () => {
      if (view === "agenda") setAgendaStart(addDays(agendaStart, -1));
      else if (view === "week") setWeekStart(addDays(weekStart, -7));
      else setMonthAnchor(addMonths(monthAnchor, -1));
    },
  });

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
      {view !== "agenda" ? (
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
              ? setWeekStart(new Date())
              : setMonthAnchor(startOfMonth(new Date()))
          }>Today</Button>
        </div>
      ) : (
        format(agendaStart, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
          <div className="flex items-center gap-2 mb-3">
            <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => setAgendaStart(addDays(agendaStart, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-medium text-sm flex-1 text-center">from {format(agendaStart, "d MMM")}</div>
            <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => setAgendaStart(addDays(agendaStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="secondary" className="h-10" onClick={() => setAgendaStart(new Date())}>Today</Button>
          </div>
        )
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
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="mb-2 w-full text-xs px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
                >
                  Archive all as historical
                </button>
                <div className="grid gap-2">
                  {unscheduled.map((d) => <JobCard key={d.id} doc={d} currency={billing.currency} vat={billing.vatPct} />)}
                </div>
              </DropZone>
            )}
          </div>
        )}

        <Legend />

        <div {...swipe} style={{ touchAction: "pan-y" }}>
        {view === "agenda" && (
          <div className="space-y-4">
            <PlannerMap
              jobs={buildMapJobs(jobs, agendaStart)}
              onOpen={(id) => { const d = jobs.find((x) => x.id === id); if (d) openActions(d); }}
            />
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
        </div>
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
     <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>Archive unscheduled jobs?</AlertDialogTitle>
           <AlertDialogDescription>
             Archive all {unscheduled.length} unscheduled job{unscheduled.length === 1 ? "" : "s"}? They will be hidden from the planner.
           </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel>Cancel</AlertDialogCancel>
           <AlertDialogAction
             onClick={() => {
               unscheduled.forEach((d) => upsertDoc({ ...d, archived: true }));
               void flushSync();
             }}
           >
             Archive
           </AlertDialogAction>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
    </Shell>
  );
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    clear();
    timer.current = setTimeout(() => { fired.current = true; onLongPress(); timer.current = null; }, ms);
  }, [onLongPress, ms]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > 64) clear();
  }, []);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); fired.current = true; onLongPress(); }, [onLongPress]);
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  }, []);
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu,
    onClickCapture,
  };
}

function useSwipe({ onLeft, onRight, threshold = 50 }: { onLeft: () => void; onRight: () => void; threshold?: number }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) onLeft(); else onRight();
  };
  return { onTouchStart, onTouchEnd };
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
          docs.map((d) => <AgendaJob key={d.id} doc={d} iso={iso} currency={currency} vat={vat} />)
        )}
      </div>
    </div>
  );
}

function AgendaJob({ doc, iso, currency, vat }: { doc: Doc; iso?: string; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const t = docTotals(doc, vat);
  const c = MATERIALS[jobMaterialCategory(doc)];
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  const span = spanInfo(doc, iso);
  return (
    <div ref={setNodeRef} style={style} className={cn(
      "flex items-stretch rounded-lg border-l-4 bg-background border overflow-hidden",
      c.border, isDragging && "opacity-50",
      span && !span.isFirst && "rounded-l-none border-l-4 border-dashed",
      span && !span.isLast && "rounded-r-none",
    )} {...lp}>
      <button {...listeners} {...attributes} className="px-2 flex items-center text-muted-foreground touch-none cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to="/doc/$id" params={{ id: doc.id }} className={cn("flex-1 min-w-0 flex items-center justify-between py-2 pr-3 gap-2", c.card)}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            {doc.scheduledTime && (
              <span className="shrink-0 tabular-nums text-[11px] font-bold rounded bg-background/70 border px-1 py-px">{doc.scheduledTime}</span>
            )}
            <span className="truncate">{doc.customer.name || "—"}</span>
            <PaymentIndicator doc={doc} />
            {span && (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full border border-current/30 bg-background/60 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
                <Link2 className="h-3 w-3" />
                Day {span.idx}/{span.total}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{doc.number}{doc.fromAddress ? ` - ${doc.fromAddress}` : ""}</div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase truncate min-w-0">{c.label}</div>
            <div className="text-[11px] font-semibold tabular-nums shrink-0 text-right">{fmtMoney(t.total, currency)}</div>
          </div>
          {jobMaterialCategory(doc) === "other" && doc.notes && (
            <div className="text-[11px] opacity-80 line-clamp-2 whitespace-pre-wrap">{doc.notes}</div>
          )}
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
          docs.map((d) => <JobCard key={d.id} doc={d} iso={iso} currency={currency} vat={vat} />)
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
        {docs.slice(0, 3).map((d) => <MiniJob key={d.id} doc={d} iso={iso} />)}
        {docs.length > 3 && <div className="text-[9px] text-muted-foreground">+{docs.length - 3}</div>}
      </div>
    </div>
  );
}

function MiniJob({ doc, iso }: { doc: Doc; iso?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const c = MATERIALS[jobMaterialCategory(doc)];
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  const span = spanInfo(doc, iso);
  return (
    <Link to="/doc/$id" params={{ id: doc.id }}>
      <div ref={setNodeRef} style={style} {...listeners} {...attributes} {...lp}
        className={cn(
          "rounded px-1 py-0.5 truncate border-l-2 cursor-grab text-[10px] flex items-center gap-1",
          c.card, c.border, isDragging && "opacity-50",
          span && !span.isFirst && "rounded-l-none border-l-0 border-dashed",
          span && !span.isLast && "rounded-r-none",
        )}
        title={`${doc.scheduledTime ? `${doc.scheduledTime} · ` : ""}${doc.customer.name || "—"} · ${doc.number}${span ? ` · Day ${span.idx} of ${span.total}` : ""} · ${jobSummary(doc)}`}>
        <PaymentIndicator doc={doc} />
        {doc.scheduledTime && (!span || span.isFirst) && (
          <span className="shrink-0 tabular-nums font-bold text-[9px] leading-none rounded bg-background/70 border px-0.5 py-px">{doc.scheduledTime}</span>
        )}
        {span && <Link2 className="h-2.5 w-2.5 shrink-0 opacity-70" />}
        {doc.customer.name || doc.number}
        {span && <span className="ml-auto shrink-0 opacity-70 tabular-nums">{span.idx}/{span.total}</span>}
      </div>
    </Link>
  );

}

function JobCard({ doc, iso, currency, vat }: { doc: Doc; iso?: string; currency: string; vat: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: doc.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const t = docTotals(doc, vat);
  const c = MATERIALS[jobMaterialCategory(doc)];
  const invoiceAddress = `${doc.number}${doc.fromAddress ? ` - ${doc.fromAddress}` : ""}`;
  const open = usePlannerActions();
  const lp = useLongPress(() => open(doc));
  const span = spanInfo(doc, iso);
  return (
    <Link to="/doc/$id" params={{ id: doc.id }} className="block">
      <div ref={setNodeRef} style={style} {...listeners} {...attributes} {...lp}
        className={cn(
          "rounded p-2 text-xs cursor-grab border-l-4 min-w-0 space-y-0.5",
          c.card, c.border, isDragging && "opacity-50",
          span && !span.isFirst && "rounded-l-none border-l-4 border-dashed",
          span && !span.isLast && "rounded-r-none",
        )}>
        <div className="font-semibold truncate flex items-center gap-1.5">
          {doc.scheduledTime && (
            <span className="shrink-0 tabular-nums text-[10px] font-bold rounded bg-background/70 border px-1">{doc.scheduledTime}</span>
          )}
          <span className="truncate">{doc.customer.name || "—"}</span>
          {span && (
            <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full border border-current/30 bg-background/60 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
              <Link2 className="h-3 w-3" />
              Day {span.idx}/{span.total}
            </span>
          )}
        </div>
        <div className="opacity-80 truncate">{invoiceAddress}</div>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="font-semibold uppercase truncate min-w-0">{c.label}</div>
          <div className="font-semibold tabular-nums shrink-0 text-right">{fmtMoney(t.total, currency)}</div>
        </div>
        {jobMaterialCategory(doc) === "other" && doc.notes && (
          <div className="opacity-80 line-clamp-2 whitespace-pre-wrap mt-0.5">{doc.notes}</div>
        )}
      </div>
    </Link>
  );
}


function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <Card ref={setNodeRef} className={cn("p-3", isOver && "ring-2 ring-primary", className)}>{children}</Card>;
}
