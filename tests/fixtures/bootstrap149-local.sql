-- SYNTHETIC LOCAL TEST DATABASE ONLY. Never run against Supabase/cloud or an existing business database.
CREATE TABLE public.bootstrap149_test_fixture(marker text PRIMARY KEY CHECK(marker='SYNTHETIC_ONLY'));
INSERT INTO public.bootstrap149_test_fixture VALUES('SYNTHETIC_ONLY');
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'sub','')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE public.canonical_identity(id uuid PRIMARY KEY,ptv_id text NOT NULL UNIQUE,full_name text,avatar_url text,metadata jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.user_account(id uuid PRIMARY KEY,identity_id uuid UNIQUE NOT NULL REFERENCES public.canonical_identity(id),auth_user_id uuid UNIQUE,username text UNIQUE,status_akun text NOT NULL,lockout_until timestamptz,tokens_valid_after timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.organization_division(id text PRIMARY KEY);
CREATE TABLE public.organization_membership(id uuid PRIMARY KEY,identity_id uuid NOT NULL REFERENCES public.canonical_identity(id),organization_id text,division_id text,position_title text,cohort int,status_organisasi text,is_current boolean,updated_at timestamptz DEFAULT now());
CREATE TABLE public.access_profile(id text PRIMARY KEY,name text);
CREATE TABLE public.capability_registry(key text PRIMARY KEY,is_mutation boolean NOT NULL,is_sensitive boolean NOT NULL);
CREATE TABLE public.profile_capabilities(profile_id text REFERENCES public.access_profile(id),capability_key text REFERENCES public.capability_registry(key),PRIMARY KEY(profile_id,capability_key));
CREATE TABLE public.account_profiles(account_id uuid REFERENCES public.user_account(id),profile_id text REFERENCES public.access_profile(id),assigned_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,profile_id));
CREATE TABLE public.account_capability_overrides(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,account_id uuid REFERENCES public.user_account(id),capability_key text,override_type text,reason text,granted_by uuid REFERENCES public.canonical_identity(id),created_at timestamptz DEFAULT now());
CREATE TABLE public.auth_credentials(account_id uuid PRIMARY KEY REFERENCES public.user_account(id),oauth_provider text,oauth_subject_id text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.auth_audit_log(id bigserial PRIMARY KEY,actor_id uuid REFERENCES public.canonical_identity(id),event_type varchar(64) NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.legacy_archive_kru(archive_id uuid PRIMARY KEY,source_key text UNIQUE,production_id text,ptv_id text,full_name text,jabatan text,divisi text,angkatan text,status text,photo_url text,telepon_masked text,email_masked text,canonical_identity_id uuid,reconciliation_status text,metadata_json jsonb,imported_at timestamptz);
INSERT INTO public.access_profile VALUES('root_executive','Synthetic Root'),('eksekutif','Synthetic Recovery'),('crew','Synthetic Person');
INSERT INTO public.capability_registry VALUES('hub.access',false,false),('crew.permissions.manage',true,true),('crew.view',false,false);
INSERT INTO public.profile_capabilities SELECT 'root_executive',key FROM public.capability_registry;
INSERT INTO public.profile_capabilities VALUES('eksekutif','hub.access'),('eksekutif','crew.permissions.manage'),('crew','hub.access');
INSERT INTO public.canonical_identity(id,ptv_id,full_name) VALUES
 ('10000000-0000-4000-8000-000000000001','PTV-901','Synthetic Root Candidate'),
 ('10000000-0000-4000-8000-000000000002','PTV-902','Synthetic Recovery Candidate'),
 ('10000000-0000-4000-8000-000000000003','PTV-903','Synthetic Third Person');
INSERT INTO public.user_account(id,identity_id,auth_user_id,username,status_akun)
 SELECT ('00000000-0000-4000-8000-00000000000'||n)::uuid,('10000000-0000-4000-8000-00000000000'||n)::uuid,('20000000-0000-4000-8000-00000000000'||n)::uuid,'synthetic-'||n,'active' FROM generate_series(1,3)n;
INSERT INTO public.organization_membership SELECT ('30000000-0000-4000-8000-00000000000'||n)::uuid,('10000000-0000-4000-8000-00000000000'||n)::uuid,'ptv_studio','technical','Synthetic Position',1,'active',true,now() FROM generate_series(1,3)n;
INSERT INTO public.account_profiles(account_id,profile_id) VALUES('00000000-0000-4000-8000-000000000001','crew'),('00000000-0000-4000-8000-000000000002','eksekutif'),('00000000-0000-4000-8000-000000000003','crew');
INSERT INTO public.auth_credentials SELECT ('00000000-0000-4000-8000-00000000000'||n)::uuid,'google','SYNTHETIC-NOT-A-REAL-SUBJECT-'||n,clock_timestamp()-interval '5 minutes' FROM generate_series(1,2)n;
INSERT INTO public.auth_audit_log(actor_id,event_type,metadata)
 SELECT a.identity_id,'portal_login_verified',jsonb_build_object('account_id',a.id,'proof_version',1,'credential_version',c.updated_at,'login_route','vercel_google','session_iat',floor(extract(epoch FROM now()))) FROM public.user_account a JOIN public.auth_credentials c ON c.account_id=a.id ORDER BY a.id;
ALTER TABLE public.user_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_capability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY block_client_credentials ON public.auth_credentials FOR ALL TO public USING(false);
GRANT ALL ON public.user_account,public.account_profiles,public.account_capability_overrides,public.auth_credentials,public.auth_audit_log TO anon,authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
