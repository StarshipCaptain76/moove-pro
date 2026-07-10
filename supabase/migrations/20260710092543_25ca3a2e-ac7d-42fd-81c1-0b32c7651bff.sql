
-- updated_at trigger helper (reuse across tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- company_profile: one row per user
-- =====================================================================
CREATE TABLE public.company_profile (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company jsonb NOT NULL DEFAULT '{}'::jsonb,
  banking jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing jsonb NOT NULL DEFAULT '{}'::jsonb,
  density text NOT NULL DEFAULT 'normal',
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profile TO authenticated;
GRANT ALL ON public.company_profile TO service_role;
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_profile" ON public.company_profile
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER company_profile_updated_at BEFORE UPDATE ON public.company_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- catalog_items
-- =====================================================================
CREATE TABLE public.catalog_items (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'each',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalog_items_owner_idx ON public.catalog_items(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own catalog_items" ON public.catalog_items
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER catalog_items_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- customers
-- =====================================================================
CREATE TABLE public.customers (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_owner_idx ON public.customers(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers" ON public.customers
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- docs (quotes + invoices; line items live on the row as jsonb)
-- =====================================================================
CREATE TABLE public.docs (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number text NOT NULL,
  type text NOT NULL CHECK (type IN ('quote','invoice')),
  status text NOT NULL DEFAULT 'draft',
  scheduled_date date,
  day_order int,
  archived boolean NOT NULL DEFAULT false,
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  deposit_pct numeric NOT NULL DEFAULT 0,
  deposit_paid boolean NOT NULL DEFAULT false,
  payment_method text,
  paid_at timestamptz,
  from_address text,
  to_address text,
  from_coords jsonb,
  to_coords jsonb,
  distance_km numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX docs_owner_idx ON public.docs(owner_user_id);
CREATE INDEX docs_owner_type_idx ON public.docs(owner_user_id, type);
CREATE INDEX docs_owner_scheduled_idx ON public.docs(owner_user_id, scheduled_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated;
GRANT ALL ON public.docs TO service_role;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.docs
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER docs_updated_at BEFORE UPDATE ON public.docs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- expenses
-- =====================================================================
CREATE TABLE public.expenses (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  vendor text NOT NULL DEFAULT '',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric,
  payment_method text,
  notes text,
  receipt_image text,
  linked_doc_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_owner_idx ON public.expenses(owner_user_id);
CREATE INDEX expenses_owner_date_idx ON public.expenses(owner_user_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- expense_categories
-- =====================================================================
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);
CREATE INDEX expense_categories_owner_idx ON public.expense_categories(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expense_categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- next_doc_number: atomic counter increment on company_profile.billing
-- =====================================================================
CREATE OR REPLACE FUNCTION public.next_doc_number(p_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_billing jsonb;
  v_prefix text;
  v_next_key text;
  v_n int;
  v_result text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_type NOT IN ('quote','invoice') THEN RAISE EXCEPTION 'Invalid type %', p_type; END IF;

  -- Ensure a row exists for this user, then lock it.
  INSERT INTO public.company_profile(owner_user_id)
  VALUES (v_uid)
  ON CONFLICT (owner_user_id) DO NOTHING;

  SELECT billing INTO v_billing
  FROM public.company_profile
  WHERE owner_user_id = v_uid
  FOR UPDATE;

  IF p_type = 'quote' THEN
    v_prefix := COALESCE(v_billing->>'quotePrefix', 'Q');
    v_next_key := 'nextQuoteNo';
  ELSE
    v_prefix := COALESCE(v_billing->>'invoicePrefix', 'INV');
    v_next_key := 'nextInvoiceNo';
  END IF;

  v_n := COALESCE(NULLIF(v_billing->>v_next_key, '')::int, 1001);
  v_result := v_prefix || '-' || v_n;

  v_billing := jsonb_set(v_billing, ARRAY[v_next_key], to_jsonb(v_n + 1), true);
  UPDATE public.company_profile
  SET billing = v_billing, updated_at = now()
  WHERE owner_user_id = v_uid;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO authenticated;

-- =====================================================================
-- migrate_workspace_blob: one-time copy from workspaces.data → tables
-- =====================================================================
CREATE OR REPLACE FUNCTION public.migrate_workspace_blob()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_blob jsonb;
  v_profile_migrated timestamptz;
  v_item jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT migrated_at INTO v_profile_migrated
  FROM public.company_profile
  WHERE owner_user_id = v_uid;

  IF v_profile_migrated IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT data INTO v_blob
  FROM public.workspaces
  WHERE owner_user_id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_blob IS NULL OR v_blob = '{}'::jsonb THEN
    -- Nothing to migrate, but still mark the profile as migrated.
    INSERT INTO public.company_profile(owner_user_id, migrated_at)
    VALUES (v_uid, now())
    ON CONFLICT (owner_user_id) DO UPDATE SET migrated_at = now();
    RETURN true;
  END IF;

  -- company_profile
  INSERT INTO public.company_profile(owner_user_id, company, banking, billing, density, migrated_at)
  VALUES (
    v_uid,
    COALESCE(v_blob->'company', '{}'::jsonb),
    COALESCE(v_blob->'banking', '{}'::jsonb),
    COALESCE(v_blob->'billing', '{}'::jsonb),
    COALESCE(v_blob->>'density', 'normal'),
    now()
  )
  ON CONFLICT (owner_user_id) DO UPDATE SET
    company = EXCLUDED.company,
    banking = EXCLUDED.banking,
    billing = EXCLUDED.billing,
    density = EXCLUDED.density,
    migrated_at = now();

  -- catalog_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_blob->'catalog', '[]'::jsonb)) LOOP
    INSERT INTO public.catalog_items(id, owner_user_id, name, price, unit)
    VALUES (
      COALESCE(v_item->>'id', gen_random_uuid()::text),
      v_uid,
      COALESCE(v_item->>'name', ''),
      COALESCE(NULLIF(v_item->>'price','')::numeric, 0),
      COALESCE(v_item->>'unit', 'each')
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- customers
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_blob->'customers', '[]'::jsonb)) LOOP
    INSERT INTO public.customers(id, owner_user_id, name, phone, email, address)
    VALUES (
      COALESCE(v_item->>'id', gen_random_uuid()::text),
      v_uid,
      COALESCE(v_item->>'name', ''),
      COALESCE(v_item->>'phone', ''),
      COALESCE(v_item->>'email', ''),
      v_item->>'address'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- docs
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_blob->'docs', '[]'::jsonb)) LOOP
    INSERT INTO public.docs(
      id, owner_user_id, number, type, status, created_at, scheduled_date, day_order,
      archived, customer, items, notes, deposit_pct, deposit_paid, payment_method, paid_at,
      from_address, to_address, from_coords, to_coords, distance_km
    ) VALUES (
      COALESCE(v_item->>'id', gen_random_uuid()::text),
      v_uid,
      COALESCE(v_item->>'number', ''),
      COALESCE(v_item->>'type', 'quote'),
      COALESCE(v_item->>'status', 'draft'),
      COALESCE(NULLIF(v_item->>'createdAt','')::timestamptz, now()),
      NULLIF(v_item->>'scheduledDate','')::date,
      NULLIF(v_item->>'dayOrder','')::int,
      COALESCE((v_item->>'archived')::boolean, false),
      COALESCE(v_item->'customer', '{}'::jsonb),
      COALESCE(v_item->'items', '[]'::jsonb),
      v_item->>'notes',
      COALESCE(NULLIF(v_item->>'depositPct','')::numeric, 0),
      COALESCE((v_item->>'depositPaid')::boolean, false),
      v_item->>'paymentMethod',
      NULLIF(v_item->>'paidAt','')::timestamptz,
      v_item->>'fromAddress',
      v_item->>'toAddress',
      v_item->'fromCoords',
      v_item->'toCoords',
      NULLIF(v_item->>'distanceKm','')::numeric
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- expenses
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_blob->'expenses', '[]'::jsonb)) LOOP
    INSERT INTO public.expenses(
      id, owner_user_id, date, category, vendor, description, amount, vat_amount,
      payment_method, notes, receipt_image, linked_doc_id, created_at
    ) VALUES (
      COALESCE(v_item->>'id', gen_random_uuid()::text),
      v_uid,
      COALESCE(NULLIF(v_item->>'date','')::date, current_date),
      COALESCE(v_item->>'category', 'Other'),
      COALESCE(v_item->>'vendor', ''),
      v_item->>'description',
      COALESCE(NULLIF(v_item->>'amount','')::numeric, 0),
      NULLIF(v_item->>'vatAmount','')::numeric,
      v_item->>'paymentMethod',
      v_item->>'notes',
      v_item->>'receiptImage',
      v_item->>'linkedDocId',
      COALESCE(NULLIF(v_item->>'createdAt','')::timestamptz, now())
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- expense_categories
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_blob->'expenseCategories', '[]'::jsonb)) LOOP
    INSERT INTO public.expense_categories(owner_user_id, name)
    VALUES (v_uid, v_item#>>'{}')
    ON CONFLICT (owner_user_id, name) DO NOTHING;
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_workspace_blob() TO authenticated;
