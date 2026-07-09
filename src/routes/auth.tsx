import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureDylanUser } from "@/lib/setup.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoAsset from "@/assets/moove-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [{ title: "Sign in — MOOVE" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const ensure = useServerFn(ensureDylanUser);
  const [email, setEmail] = useState("dylan@moove.local");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If already signed in, bounce to home.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let attempt = await supabase.auth.signInWithPassword({ email, password });
      if (attempt.error && /invalid/i.test(attempt.error.message)) {
        // First-ever sign-in for the seeded account: create it, then retry.
        await ensure();
        attempt = await supabase.auth.signInWithPassword({ email, password });
      }
      if (attempt.error) throw attempt.error;
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100svh] grid place-items-center bg-background text-foreground p-4">
      <Card className="w-full max-w-sm p-6 grid gap-4">
        <div className="flex items-center gap-3">
          <img src={logoAsset.url} alt="MOOVE" className="h-10 w-auto bg-white rounded p-1" />
          <div>
            <div className="font-display text-2xl tracking-wider">MOOVE</div>
            <div className="text-xs text-muted-foreground">Sign in to sync everywhere</div>
          </div>
        </div>
        <form onSubmit={signIn} className="grid gap-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              className="h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Signing in on preview and the published site with the same account keeps both in sync automatically.
        </p>
      </Card>
    </div>
  );
}
