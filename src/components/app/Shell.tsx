import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import logoAsset from "@/assets/moove-logo.png.asset.json";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, BarChart3, Settings,
  Cloud, CloudOff, Plus, FileText, Receipt, Wallet, LogIn, LogOut, User,
} from "lucide-react";
import { initSync, subscribeSync } from "@/lib/sync";
import { useStore, newId, type Doc } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/results", label: "Results", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-secondary text-secondary-foreground border-b-4 border-primary pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 flex items-center gap-3 h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={logoAsset.url} alt="MOOVE" className="h-8 sm:h-10 w-auto bg-white rounded p-1" />
            <span className="font-display text-2xl sm:text-3xl tracking-wider truncate">MOOVE</span>
          </Link>
          <nav className="hidden md:flex gap-1 ml-auto items-center">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={cn(
                    "px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto md:ml-0"><SyncBadge /></div>
          <AuthButton />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}

function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [newOpen, setNewOpen] = useState(false);
  const nav = useNavigate();
  const { billing, upsertDoc, nextDocNumber } = useStore();

  const create = (type: "quote" | "invoice") => {
    const id = newId();
    const d: Doc = {
      id,
      number: nextDocNumber(type),
      type,
      status: "draft",
      createdAt: new Date().toISOString(),
      customer: { id: newId(), name: "", phone: "", email: "" },
      items: [],
      depositPct: billing.defaultDepositPct,
      depositPaid: false,
    };
    upsertDoc(d);
    setNewOpen(false);
    nav({ to: "/doc/$id", params: { id } });
  };

  const tabs = [
    { to: "/", label: "Home", icon: LayoutDashboard },
    { to: "/planner", label: "Planner", icon: Calendar },
    { fab: true },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-secondary text-secondary-foreground border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 h-16 max-w-md mx-auto">
          {tabs.map((t, i) => {
            if ("fab" in t) {
              return (
                <li key="fab" className="relative">
                  <button
                    onClick={() => setNewOpen(true)}
                    aria-label="Create new"
                    className="absolute left-1/2 -translate-x-1/2 -top-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Plus className="h-7 w-7" />
                  </button>
                </li>
              );
            }
            const active = t.to === "/" ? path === "/" : path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-secondary-foreground/70",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-3xl tracking-wide">CREATE NEW</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 mt-4 pb-[env(safe-area-inset-bottom)]">
            <Button size="lg" className="h-16 text-lg justify-start" onClick={() => create("quote")}>
              <FileText className="h-6 w-6 mr-3" />
              <div className="text-left">
                <div className="font-bold">New Quote</div>
                <div className="text-xs opacity-80 font-normal">Send an estimate</div>
              </div>
            </Button>
            <Button size="lg" variant="secondary" className="h-16 text-lg justify-start" onClick={() => create("invoice")}>
              <Receipt className="h-6 w-6 mr-3" />
              <div className="text-left">
                <div className="font-bold">New Invoice</div>
                <div className="text-xs opacity-80 font-normal">Bill a customer directly</div>
              </div>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SyncBadge() {
  const [s, setS] = useState<{ status: string; authed: boolean; error?: string }>({
    status: "idle",
    authed: false,
  });
  useEffect(() => {
    initSync();
    const unsub = subscribeSync(setS);
    return () => {
      unsub();
    };
  }, []);
  const Icon = s.status === "error" ? CloudOff : Cloud;
  const statusClass =
    s.status === "synced"
      ? "bg-green-500/20 text-green-500"
      : s.status === "error"
        ? "bg-destructive/20 text-destructive"
        : s.status === "loading" || s.status === "syncing"
          ? "bg-amber-500/20 text-amber-500"
          : "bg-white/10";
  const label = s.error
    ? s.error
    : s.status === "loading"
      ? "Loading…"
      : s.status === "syncing"
        ? "Saving…"
        : s.authed
          ? "Synced"
          : "Sign in to sync";
  return (
    <span
      title={label}
      className={cn(
        "px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium",
        statusClass,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}


function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!email) {
    return (
      <Link
        to="/auth"
        className="ml-1 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20"
        title="Sign in"
      >
        <LogIn className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        toast.success("Signed out");
        navigate({ to: "/auth" });
      }}
      title={`Signed in as ${email} — click to sign out`}
      className="ml-1 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20"
    >
      <User className="h-3.5 w-3.5" />
      <span>{email === "moove@mweb.co.za" ? "Dylan" : email}</span>
      <LogOut className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}
