CREATE OR REPLACE FUNCTION public.claim_workspace(p_id uuid, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_target_updated_at timestamptz;
  v_current_id uuid;
  v_current_updated_at timestamptz;
  v_current_data jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_user_id, updated_at INTO v_owner, v_target_updated_at
  FROM public.workspaces
  WHERE id = p_id AND owner_token = p_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_owner = v_uid THEN
    RETURN true;
  END IF;

  IF v_owner IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT id, updated_at, data INTO v_current_id, v_current_updated_at, v_current_data
  FROM public.workspaces
  WHERE owner_user_id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_current_id IS NOT NULL
    AND COALESCE(v_current_data, '{}'::jsonb) <> '{}'::jsonb
    AND v_current_updated_at > v_target_updated_at THEN
    RETURN false;
  END IF;

  DELETE FROM public.workspaces
  WHERE owner_user_id = v_uid
    AND id <> p_id;

  UPDATE public.workspaces
  SET owner_user_id = v_uid, updated_at = now()
  WHERE id = p_id
    AND owner_token = p_token
    AND owner_user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_workspace(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_workspace(uuid, uuid) TO authenticated;