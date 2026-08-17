import { syncCalendar } from "./calendar.functions";
import { refreshSync } from "./sync";
import { isAuthed } from "./sync";

let running = false;
let lastRun = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Run a two-way calendar sync, then refresh the local store. */
export async function runCalendarSync(opts: { minIntervalMs?: number } = {}) {
  if (typeof window === "undefined") return;
  if (running || !isAuthed()) return;
  const min = opts.minIntervalMs ?? 0;
  if (min && Date.now() - lastRun < min) return;

  running = true;
  try {
    const r = await syncCalendar({ data: { origin: window.location.origin } });
    lastRun = Date.now();
    if (!r.skipped && (r.created || r.updated || r.deleted)) await refreshSync();
    return r;
  } catch (e) {
    console.error("[calendar sync]", e);
  } finally {
    running = false;
  }
}

/** Debounced sync, used after documents change. */
export function scheduleCalendarSync(delay = 15000) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runCalendarSync();
  }, delay);
}
