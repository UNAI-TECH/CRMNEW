-- ============================================================================
-- Migration 011: Employee Leave Balances, Leave Requests & Dealership Notifications
-- Safe & idempotent: dynamically matches public.tenants(id) type (TEXT or UUID)
-- and adds JSONB leave columns on public.employees alongside normalized tables.
-- ============================================================================

-- 1. Add leave_balance and leave_history columns to public.employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS leave_balance JSONB NOT NULL DEFAULT '{"casual":{"total":12,"used":0},"sick":{"total":7,"used":0},"paid":{"total":18,"used":0}}'::jsonb,
  ADD COLUMN IF NOT EXISTS leave_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Create tenant-scoped employee_leave_requests and dealership_notifications tables
DO $$
DECLARE
  v_tenant_id_type TEXT;
  v_employee_id_type TEXT;
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

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_employee_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.employees'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF v_employee_id_type IS NULL THEN
    v_employee_id_type := 'text';
  END IF;

  IF to_regclass('public.employee_leave_requests') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.employee_leave_requests (
        id TEXT PRIMARY KEY,
        tenant_id %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        employee_id %s NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        employee_name TEXT NOT NULL DEFAULT '''',
        employee_user_id TEXT NOT NULL DEFAULT '''',
        employee_department TEXT NOT NULL DEFAULT ''Sales'',
        leave_type TEXT NOT NULL CHECK (leave_type IN (''casual'', ''sick'', ''paid'', ''emergency'')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days INTEGER NOT NULL DEFAULT 1,
        reason TEXT NOT NULL DEFAULT '''',
        applied_on TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, ''YYYY-MM-DD''),
        status TEXT NOT NULL DEFAULT ''pending'' CHECK (status IN (''pending'', ''approved'', ''rejected'')),
        approved_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );',
      v_tenant_id_type,
      v_employee_id_type
    );
  END IF;

  IF to_regclass('public.dealership_notifications') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.dealership_notifications (
        id TEXT PRIMARY KEY,
        tenant_id %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        recipient_role TEXT NOT NULL DEFAULT ''admin'',
        recipient_employee_id TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '''',
        category TEXT NOT NULL DEFAULT ''leave_request'',
        link_href TEXT,
        priority TEXT NOT NULL DEFAULT ''normal'',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT ''{}''::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );',
      v_tenant_id_type
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emp_leave_requests_tenant_emp
  ON public.employee_leave_requests (tenant_id, employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dealership_notifs_tenant_created
  ON public.dealership_notifications (tenant_id, created_at DESC);

ALTER TABLE public.employee_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealership_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emp_leave_requests_select ON public.employee_leave_requests;
CREATE POLICY emp_leave_requests_select ON public.employee_leave_requests
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id::text));

DROP POLICY IF EXISTS emp_leave_requests_modify ON public.employee_leave_requests;
CREATE POLICY emp_leave_requests_modify ON public.employee_leave_requests
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id::text))
  WITH CHECK (public.is_tenant_member(tenant_id::text));

DROP POLICY IF EXISTS dealership_notifs_select ON public.dealership_notifications;
CREATE POLICY dealership_notifs_select ON public.dealership_notifications
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id::text));

DROP POLICY IF EXISTS dealership_notifs_modify ON public.dealership_notifications;
CREATE POLICY dealership_notifs_modify ON public.dealership_notifications
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id::text))
  WITH CHECK (public.is_tenant_member(tenant_id::text));

