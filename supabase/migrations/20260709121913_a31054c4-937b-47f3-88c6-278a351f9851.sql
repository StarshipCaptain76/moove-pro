
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.workspaces TO anon, authenticated;
GRANT ALL ON public.workspaces TO service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read workspaces by id"
  ON public.workspaces FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create a workspace"
  ON public.workspaces FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update workspaces"
  ON public.workspaces FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);
