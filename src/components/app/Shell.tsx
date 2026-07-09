import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoAsset from "@/assets/moove-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, BarChart3, Settings } from "lucide-react";

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
          <nav className="flex gap-1 ml-auto">
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
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}