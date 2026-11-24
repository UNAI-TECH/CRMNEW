-- ============================================================================
-- Migration 007: Employee User ID and Direct Permanent Password Authentication
-- Supports manual User ID assignment, database verification, and permanent password storage
-- ============================================================================

-- 1. Add User ID, password hash, and workflow columns to public.employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS salary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salary_category TEXT DEFAULT 'Annual CTC',
  ADD COLUMN IF NOT EXISTS access_control JSONB,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Backfill user_id from email prefix if user_id is null
UPDATE public.employees
SET user_id = split_part(email, '@', 1)
WHERE user_id IS NULL AND email IS NOT NULL AND email <> '';

-- 3. Unique index per tenant on user_id (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tenant_user_id 
  ON public.employees (tenant_id, lower(trim(user_id))) 
  WHERE user_id IS NOT NULL AND trim(user_id) <> '';

-- 4. Fast lookup index on lower(trim(user_id))
CREATE INDEX IF NOT EXISTS idx_employees_lower_user_id 
  ON public.employees (lower(trim(user_id)));

-- 5. Fast lookup index on lower(trim(email))
CREATE INDEX IF NOT EXISTS idx_employees_lower_email_auth 
  ON public.employees (lower(trim(email)));

