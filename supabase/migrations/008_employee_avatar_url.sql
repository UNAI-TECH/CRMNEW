-- ============================================================================
-- Migration 008: Employee Avatar URL Support
-- Supports custom profile photos and avatars for staff and employees
-- ============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.employees.avatar_url IS 'Base64 data URI or CDN URL for staff profile portrait photo';

