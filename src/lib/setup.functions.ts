import { createServerFn } from "@tanstack/react-start";

// Idempotent: creates the Dylan Potgieter user if missing; else no-op.
export const ensureDylanUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "dylan@moove.local";
  const password = "Dylan@1999";

  // Check if user exists (list is paginated but with one user it's fine).
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw new Error(listErr.message);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) return { ok: true, created: false };

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Dylan Potgieter" },
  });
  if (error) throw new Error(error.message);
  return { ok: true, created: true };
});
