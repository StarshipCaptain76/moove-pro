import { toast } from "sonner";
import { useStore, type Doc } from "@/lib/store";

const FIRED_KEY = "moove-fired-reminders";

function firedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const parsed = raw ? (JSON.parse(raw) as { day: string; ids: string[] }) : null;
    if (!parsed || parsed.day !== new Date().toDateString()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const s = firedSet();
  s.add(id);
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ day: new Date().toDateString(), ids: [...s] }));
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function notificationStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function notify(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: title + body });
      return;
    } catch {
      /* fall through to toast */
    }
  }
  toast(title, { description: body, duration: 15000 });
}

function docLabel(d: Doc) {
  const bits = [d.type === "job" ? d.jobCategory ?? "Job" : d.type, d.number].filter(Boolean);
  const where = d.fromAddress || d.customer?.address || d.toAddress;
  return [bits.join(" · "), where].filter(Boolean).join(" — ");
}

function checkOnce() {
  const s = useStore.getState();
  if (!s.billing.remindersEnabled) return;
  const lead = s.billing.reminderLeadMin ?? 30;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const fired = firedSet();

  s.docs.forEach((d) => {
    if (d.archived || d.status === "cancelled") return;
    if (!d.scheduledDate || !d.scheduledTime) return;
    if (d.scheduledDate !== todayIso) return;
    if (fired.has(d.id)) return;
    const [h, m] = d.scheduledTime.split(":").map(Number);
    const due = new Date(now);
    due.setHours(h, m, 0, 0);
    const minsAway = (due.getTime() - now.getTime()) / 60000;
    if (minsAway > lead || minsAway < -5) return;
    markFired(d.id);
    const when = minsAway <= 0 ? "now" : `in ${Math.round(minsAway)} min`;
    notify(`${d.customer?.name || "Job"} — ${when}`, `${d.scheduledTime} · ${docLabel(d)}`);
  });
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Starts the in-app reminder loop. Safe to call more than once. */
export function startReminders() {
  if (typeof window === "undefined" || timer) return () => {};
  checkOnce();
  timer = setInterval(checkOnce, 30000);
  const onFocus = () => checkOnce();
  window.addEventListener("focus", onFocus);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    window.removeEventListener("focus", onFocus);
  };
}
