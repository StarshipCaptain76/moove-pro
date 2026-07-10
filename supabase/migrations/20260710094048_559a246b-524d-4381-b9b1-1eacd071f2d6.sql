
-- Drop unused legacy workspace RPCs (blob-based storage replaced by per-row tables)
DROP FUNCTION IF EXISTS public.create_workspace(jsonb);
DROP FUNCTION IF EXISTS public.update_workspace(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_workspace(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_my_workspace();
DROP FUNCTION IF EXISTS public.save_my_workspace(jsonb);
DROP FUNCTION IF EXISTS public.claim_workspace(uuid, uuid);
DROP FUNCTION IF EXISTS public.migrate_workspace_blob();
DROP FUNCTION IF EXISTS public.next_doc_number(text);

-- Revoke EXECUTE from anon and authenticated on remaining SECURITY DEFINER function.
-- set_updated_at is a trigger function; PostgreSQL runs triggers regardless of EXECUTE grants,
-- so revoking public API access does not affect trigger behavior.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;
