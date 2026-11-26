-- ============================================================================
-- Migration 009: Employee Permanent Password Persistence & Auto-Sync
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Safe & idempotent: ensures permanent passwords entered by staff on
-- /emplogin are reliably persisted in public.employees & user_credentials.
-- ============================================================================

-- 1. Ensure all password & User ID columns exist on public.employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Ensure matching password tracking columns exist on public.user_credentials
ALTER TABLE public.user_credentials
  ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Fast lookup indexes for /emplogin User ID & email verification
CREATE INDEX IF NOT EXISTS idx_employees_lower_user_id
  ON public.employees (lower(trim(user_id)));

CREATE INDEX IF NOT EXISTS idx_employees_lower_email_auth
  ON public.employees (lower(trim(email)));

-- 4. Backfill any existing rows where password_hash is already populated
UPDATE public.employees
SET
  is_password_set = TRUE,
  password_set_at = COALESCE(password_set_at, NOW()),
  updated_at = NOW()
WHERE password_hash IS NOT NULL
  AND trim(password_hash) <> ''
  AND is_password_set IS FALSE;

UPDATE public.user_credentials
SET
  is_password_set = TRUE,
  password_set_at = COALESCE(password_set_at, NOW()),
  updated_at = NOW()
WHERE password_hash IS NOT NULL
  AND trim(password_hash) <> ''
  AND is_password_set IS FALSE;

-- 5. Automatic trigger to keep is_password_set & password_set_at synchronized
--    whenever password_hash is saved, updated, or reset in SQL
CREATE OR REPLACE FUNCTION public.sync_employee_password_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL AND trim(NEW.password_hash) <> '' THEN
    NEW.is_password_set := TRUE;
    IF TG_OP = 'INSERT' THEN
      NEW.password_set_at := COALESCE(NEW.password_set_at, NOW());
    ELSIF OLD.password_hash IS DISTINCT FROM NEW.password_hash
       OR COALESCE(OLD.is_password_set, FALSE) IS FALSE THEN
      NEW.password_set_at := NOW();
    END IF;
  ELSE
    NEW.password_hash := NULL;
    NEW.is_password_set := FALSE;
    NEW.password_set_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_password_state ON public.employees;
CREATE TRIGGER trg_sync_employee_password_state
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_password_state();

DROP TRIGGER IF EXISTS trg_sync_user_credentials_password_state ON public.user_credentials;
CREATE TRIGGER trg_sync_user_credentials_password_state
  BEFORE INSERT OR UPDATE ON public.user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_password_state();

-- 6. Atomic database helper function to save an employee's permanent password
--    Called exclusively by the server API (/api/employees/auth) via service_role
CREATE OR REPLACE FUNCTION public.save_employee_permanent_password(
  p_employee_id UUID DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_password_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  tenant_id UUID,
  user_id TEXT,
  is_password_set BOOLEAN,
  password_set_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_clean_user_id TEXT := lower(trim(COALESCE(p_user_id, '')));
  v_emp_id UUID;
  v_tenant_id UUID;
  v_user_id TEXT;
  v_is_set BOOLEAN;
  v_set_at TIMESTAMPTZ;
BEGIN
  IF p_password_hash IS NULL OR trim(p_password_hash) = '' THEN
    RAISE EXCEPTION 'Password hash cannot be empty';
  END IF;

  -- Update target employee row in public.employees
  UPDATE public.employees e
  SET
    password_hash = p_password_hash,
    is_password_set = TRUE,
    password_set_at = NOW(),
    user_id = COALESCE(NULLIF(trim(e.user_id), ''), NULLIF(trim(p_user_id), '')),
    updated_at = NOW()
  WHERE e.id = (
    SELECT emp.id
    FROM public.employees emp
    WHERE (
        (p_employee_id IS NOT NULL AND emp.id = p_employee_id)
        OR (
          p_employee_id IS NULL
          AND v_clean_user_id <> ''
          AND (lower(trim(emp.user_id)) = v_clean_user_id OR lower(trim(emp.email)) = v_clean_user_id)
        )
      )
      AND (p_tenant_id IS NULL OR emp.tenant_id = p_tenant_id)
    ORDER BY emp.created_at DESC
    LIMIT 1
  )
  RETURNING e.id, e.tenant_id, e.user_id, e.is_password_set, e.password_set_at
  INTO v_emp_id, v_tenant_id, v_user_id, v_is_set, v_set_at;

  -- Sync matching public.user_credentials record if present
  IF v_emp_id IS NOT NULL THEN
    UPDATE public.user_credentials uc
    SET
      password_hash = p_password_hash,
      is_password_set = TRUE,
      password_set_at = NOW(),
      updated_at = NOW()
    WHERE uc.id = v_emp_id
       OR (
         uc.tenant_id = v_tenant_id
         AND v_clean_user_id <> ''
         AND (lower(trim(uc.user_id)) = v_clean_user_id OR lower(trim(uc.email)) = v_clean_user_id)
       );

    RETURN QUERY SELECT v_emp_id, v_tenant_id, v_user_id, v_is_set, v_set_at;
    RETURN;
  END IF;

  -- Fallback: if employee only exists in public.user_credentials
  UPDATE public.user_credentials uc
  SET
    password_hash = p_password_hash,
    is_password_set = TRUE,
    password_set_at = NOW(),
    updated_at = NOW()
  WHERE uc.id = (
    SELECT cred.id
    FROM public.user_credentials cred
    WHERE (
        (p_employee_id IS NOT NULL AND cred.id = p_employee_id)
        OR (
          v_clean_user_id <> ''
          AND (lower(trim(cred.user_id)) = v_clean_user_id OR lower(trim(cred.email)) = v_clean_user_id)
        )
      )
      AND (p_tenant_id IS NULL OR cred.tenant_id = p_tenant_id)
    ORDER BY cred.created_at DESC
    LIMIT 1
  )
  RETURNING uc.id, uc.tenant_id, uc.user_id, uc.is_password_set, uc.password_set_at
  INTO v_emp_id, v_tenant_id, v_user_id, v_is_set, v_set_at;

  IF v_emp_id IS NOT NULL THEN
    RETURN QUERY SELECT v_emp_id, v_tenant_id, v_user_id, v_is_set, v_set_at;
  END IF;
END;
$$;

-- Restrict password persistence RPC strictly to backend service_role
REVOKE ALL ON FUNCTION public.save_employee_permanent_password(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_employee_permanent_password(UUID, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.save_employee_permanent_password(UUID, TEXT, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_employee_permanent_password(UUID, TEXT, UUID, TEXT) TO service_role;

