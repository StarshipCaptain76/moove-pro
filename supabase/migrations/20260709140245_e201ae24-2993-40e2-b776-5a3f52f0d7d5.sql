
-- Add owner_token for anonymous workspace access control
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS owner_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create a workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Anyone can read workspaces by id" ON public.workspaces;
DROP POLICY IF EXISTS "Anyone can update workspaces" ON public.workspaces;

-- Deny all direct table access from anon/authenticated; force RPC use
REVOKE ALL ON public.workspaces FROM anon, authenticated;
GRANT ALL ON public.workspaces TO service_role;

-- No policies for anon/authenticated => no direct access. RLS remains enabled.

-- RPC: create a new workspace, returns id + token
CREATE OR REPLACE FUNCTION public.create_workspace(p_data jsonb)
RETURNS TABLE(id uuid, owner_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_token uuid;
BEGIN
  INSERT INTO public.workspaces(data)
  VALUES (COALESCE(p_data, '{}'::jsonb))
  RETURNING workspaces.id, workspaces.owner_token INTO v_id, v_token;
  RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- RPC: read a workspace, requires matching token
CREATE OR REPLACE FUNCTION public.get_workspace(p_id uuid, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_data jsonb;
BEGIN
  SELECT data INTO v_data
  FROM public.workspaces
  WHERE id = p_id AND owner_token = p_token;
  RETURN v_data;
END;
$$;

-- RPC: update workspace, requires matching token
CREATE OR REPLACE FUNCTION public.update_workspace(p_id uuid, p_token uuid, p_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.workspaces
  SET data = p_data, updated_at = now()
  WHERE id = p_id AND owner_token = p_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(jsonb) FROM public;
REVOKE ALL ON FUNCTION public.get_workspace(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.update_workspace(uuid, uuid, jsonb) FROM public;

GRANT EXECUTE ON FUNCTION public.create_workspace(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_workspace(uuid, uuid, jsonb) TO anon, authenticated;
