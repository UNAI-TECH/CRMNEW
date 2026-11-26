-- ============================================================================
-- Migration 010: Customizable Pipeline Stages & Custom Lead Fields
-- Allows dealerships to insert, reorder, rename, and customize pipeline
-- stages (including stages between Test Drive, Negotiation, and Converted)
-- and store custom intake/stage fields on leads in PostgreSQL.
-- Compatible with both TEXT and UUID public.tenants(id) schemas.
-- ============================================================================

-- 1. Allow custom stage keys on public.leads.status by replacing the rigid enum CHECK
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS %I;', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_non_empty;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_non_empty CHECK (status IS NOT NULL AND trim(status) <> '');

-- 2. Add custom_fields JSONB column on public.leads for custom stage & lead fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Dedicated tenant-scoped table for customized pipeline stage definitions & fields
--    Dynamically matches public.tenants(id) column type (TEXT or UUID)
DO $$
DECLARE
  v_tenant_id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_tenant_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.tenants'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF v_tenant_id_type IS NULL THEN
    v_tenant_id_type := 'text';
  END IF;

  IF to_regclass('public.dealership_pipeline_configs') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.dealership_pipeline_configs (
        tenant_id %s PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
        stages JSONB NOT NULL DEFAULT ''[]''::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );',
      v_tenant_id_type
    );
  END IF;
END $$;

ALTER TABLE public.dealership_pipeline_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_config_select ON public.dealership_pipeline_configs;
CREATE POLICY pipeline_config_select ON public.dealership_pipeline_configs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id::text));

DROP POLICY IF EXISTS pipeline_config_modify ON public.dealership_pipeline_configs;
CREATE POLICY pipeline_config_modify ON public.dealership_pipeline_configs
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id::text))
  WITH CHECK (public.is_tenant_member(tenant_id::text));

