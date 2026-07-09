import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import logoAsset from "@/assets/moove-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, BarChart3, Settings, Cloud, CloudOff, Link2, Check } from "lucide-react";
import { initSync, subscribeSync, getShareLink } from "@/lib/sync";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/results", label: "Results", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-secondary text-secondary-foreground border-b-4 border-primary">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-6 h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="MOOVE" className="h-10 w-auto bg-white rounded p-1" />
            <span className="font-display text-3xl tracking-wider">MOOVE</span>
          </Link>
          <nav className="flex gap-1 ml-auto items-center">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
            <SyncBadge />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function SyncBadge() {
  const [s, setS] = useState<{ status: string; workspaceId: string | null; error?: string }>({
    status: "idle",
    workspaceId: null,
  });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    initSync();
    return subscribeSync(setS);
  }, []);
  const ok = s.status === "synced" || s.status === "syncing";
  const Icon = s.status === "error" ? CloudOff : Cloud;
  const copy = async () => {
    const link = getShareLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title={s.error || (s.workspaceId ? "Copy sync link" : "Connecting…")}
      className={cn(
        "ml-2 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
        ok ? "bg-white/10 hover:bg-white/20" : "bg-destructive/20 hover:bg-destructive/30",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">
        {s.status === "loading" && "Connecting…"}
        {s.status === "syncing" && "Syncing…"}
        {s.status === "synced" && "Synced"}
        {s.status === "error" && "Offline"}
        {s.status === "idle" && "…"}
      </span>
      {s.workspaceId && (copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />)}
    </button>
  );
}