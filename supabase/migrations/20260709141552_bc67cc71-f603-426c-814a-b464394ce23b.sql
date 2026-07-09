
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_user_id_key
  ON public.workspaces(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Allow authenticated users to read/update/insert their own workspace directly.
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;

CREATE POLICY "Users can read own workspace"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert own workspace"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update own workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Load or create the current user's workspace; returns (id, data).
CREATE OR REPLACE FUNCTION public.get_my_workspace()
RETURNS TABLE(id uuid, data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_data jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT w.id, w.data INTO v_id, v_data
  FROM public.workspaces w
  WHERE w.owner_user_id = v_uid
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.workspaces(data, owner_user_id)
    VALUES ('{}'::jsonb, v_uid)
    RETURNING workspaces.id, workspaces.data INTO v_id, v_data;
  END IF;

  RETURN QUERY SELECT v_id, v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_workspace(p_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.workspaces
  SET data = p_data, updated_at = now()
  WHERE owner_user_id = v_uid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    INSERT INTO public.workspaces(data, owner_user_id)
    VALUES (p_data, v_uid);
  END IF;

  RETURN true;
END;
$$;

-- One-time claim: transfer an anonymous workspace (id + token) to the signed-in user.
CREATE OR REPLACE FUNCTION public.claim_workspace(p_id uuid, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If the user already has a workspace, drop it first (claim replaces).
  DELETE FROM public.workspaces WHERE owner_user_id = v_uid;

  UPDATE public.workspaces
  SET owner_user_id = v_uid
  WHERE id = p_id AND owner_token = p_token AND owner_user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_workspace() FROM public;
REVOKE ALL ON FUNCTION public.save_my_workspace(jsonb) FROM public;
REVOKE ALL ON FUNCTION public.claim_workspace(uuid, uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.get_my_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_workspace(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workspace(uuid, uuid) TO authenticated;
