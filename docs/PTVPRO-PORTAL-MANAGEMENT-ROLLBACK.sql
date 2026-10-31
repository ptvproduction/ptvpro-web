-- ==============================================================================
-- PTVPRO PORTAL MANAGEMENT SCHEMA ROLLBACK
-- Target: Supabase Staging (swadgljnyelsjstqqxbm)
-- Description: Rollback script for portal_services, portal_announcements,
--              portal_settings, and portal_audit_logs tables and policies.
-- ==============================================================================

BEGIN;

-- Drop trigger & function if exists
DROP TRIGGER IF EXISTS trg_portal_services_updated_at ON public.portal_services;
DROP TRIGGER IF EXISTS trg_portal_announcements_updated_at ON public.portal_announcements;
DROP TRIGGER IF EXISTS trg_portal_settings_updated_at ON public.portal_settings;
DROP FUNCTION IF EXISTS public.set_portal_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS "Public can view published services" ON public.portal_services;
DROP POLICY IF EXISTS "Staff can view all services" ON public.portal_services;
DROP POLICY IF EXISTS "Staff can modify services" ON public.portal_services;

DROP POLICY IF EXISTS "Public can view published announcements" ON public.portal_announcements;
DROP POLICY IF EXISTS "Staff can view all announcements" ON public.portal_announcements;
DROP POLICY IF EXISTS "Staff can modify announcements" ON public.portal_announcements;

DROP POLICY IF EXISTS "Public can view portal settings" ON public.portal_settings;
DROP POLICY IF EXISTS "Staff can modify portal settings" ON public.portal_settings;

DROP POLICY IF EXISTS "Staff can view audit logs" ON public.portal_audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.portal_audit_logs;

-- Drop tables in reverse order
DROP TABLE IF EXISTS public.portal_audit_logs CASCADE;
DROP TABLE IF EXISTS public.portal_settings CASCADE;
DROP TABLE IF EXISTS public.portal_announcements CASCADE;
DROP TABLE IF EXISTS public.portal_services CASCADE;

COMMIT;
