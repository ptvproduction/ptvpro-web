-- DRAFT ONLY. Not executed against PostgreSQL, Supabase, staging, or production.
-- Deliberately rolls back. DBA must review auth bridge, grants and invariants first.
BEGIN;
DO $$ BEGIN
  IF current_setting('ptv.haul_draft_approved', true) IS DISTINCT FROM 'reviewed-locally' THEN
    RAISE EXCEPTION 'Draft blocked: explicit local DBA review required';
  END IF;
  IF to_regclass('public.canonical_identity') IS NULL OR to_regclass('public.user_account') IS NULL
    OR to_regprocedure('public.has_capability(text)') IS NULL THEN
    RAISE EXCEPTION 'Hub identity and capability prerequisites missing';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS ptv_haul;
REVOKE ALL ON SCHEMA ptv_haul FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA ptv_haul TO authenticated;
CREATE TABLE IF NOT EXISTS ptv_haul.edition (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title))>0),
 starts_on date NOT NULL, ends_on date NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Jakarta' CHECK(timezone='Asia/Jakarta'),
 config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(config)='object'), archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_on>=starts_on)
);
CREATE TABLE IF NOT EXISTS ptv_haul.event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(trim(title))>0), brief text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '',
 starts_at timestamptz, ends_at timestamptz, sort_order integer NOT NULL DEFAULT 0, archived_at timestamptz,
 UNIQUE(edition_id,id), CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS ptv_haul.project (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(trim(title))>0), brief text NOT NULL DEFAULT '',
 pic_id uuid REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'Rencana' CHECK(status IN ('Rencana','Dikerjakan','Review','Selesai')),
 deadline timestamptz, archived_at timestamptz, UNIQUE(edition_id,id)
);
CREATE TABLE IF NOT EXISTS ptv_haul.project_event (
 edition_id uuid NOT NULL, project_id uuid NOT NULL, event_id uuid NOT NULL, PRIMARY KEY(project_id,event_id),
 FOREIGN KEY(edition_id,project_id) REFERENCES ptv_haul.project(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.task (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 project_id uuid, parent_id uuid, title text NOT NULL CHECK(length(trim(title))>0), brief text NOT NULL DEFAULT '',
 pic_id uuid REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
 priority text NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Normal','Tinggi','Mendesak')),
 status text NOT NULL DEFAULT 'Rencana' CHECK(status IN ('Rencana','Dikerjakan','Review','Selesai')),
 deadline timestamptz, reference_text text NOT NULL DEFAULT '', result_url text CHECK(result_url IS NULL OR result_url ~* '^https?://'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), archived_at timestamptz, UNIQUE(edition_id,id),
 FOREIGN KEY(edition_id,project_id) REFERENCES ptv_haul.project(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,parent_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT,
 CHECK(parent_id IS DISTINCT FROM id)
);
CREATE TABLE IF NOT EXISTS ptv_haul.task_event (
 edition_id uuid NOT NULL, task_id uuid NOT NULL, event_id uuid NOT NULL, PRIMARY KEY(task_id,event_id),
 FOREIGN KEY(edition_id,task_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.task_member (
 task_id uuid NOT NULL REFERENCES ptv_haul.task(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT, PRIMARY KEY(task_id,person_id)
);
CREATE TABLE IF NOT EXISTS ptv_haul.task_dependency (
 edition_id uuid NOT NULL, task_id uuid NOT NULL, depends_on uuid NOT NULL, PRIMARY KEY(task_id,depends_on), CHECK(task_id<>depends_on),
 FOREIGN KEY(edition_id,task_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,depends_on) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.task_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES ptv_haul.task(id) ON DELETE RESTRICT,
 requested_by uuid NOT NULL REFERENCES public.user_account(id) ON DELETE RESTRICT,
 decided_by uuid REFERENCES public.user_account(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('Menunggu','Disetujui','Revisi')), note text NOT NULL DEFAULT '',
 requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 CHECK((state='Menunggu' AND decided_by IS NULL AND decided_at IS NULL) OR (state<>'Menunggu' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS haul_one_pending_approval ON ptv_haul.task_approval(task_id) WHERE state='Menunggu';
CREATE TABLE IF NOT EXISTS ptv_haul.session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL, event_id uuid NOT NULL,
 title text NOT NULL CHECK(length(trim(title))>0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 location text NOT NULL DEFAULT '', technical_notes text NOT NULL DEFAULT '', coverage text NOT NULL DEFAULT '',
 archived_at timestamptz, UNIQUE(edition_id,id), CHECK(ends_at>starts_at),
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.assignment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES ptv_haul.session(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
 position text NOT NULL CHECK(length(trim(position))>0), UNIQUE(session_id,person_id,position)
);
CREATE INDEX IF NOT EXISTS haul_assignment_person ON ptv_haul.assignment(person_id,session_id);
CREATE TABLE IF NOT EXISTS ptv_haul.content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 project_id uuid, task_id uuid, title text NOT NULL CHECK(length(trim(title))>0), format text NOT NULL DEFAULT '',
 platform text NOT NULL DEFAULT '', pic_id uuid REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
 deadline timestamptz, publish_at timestamptz, caption text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'Rencana' CHECK(status IN ('Rencana','Dikerjakan','Review','Selesai')),
 result_url text CHECK(result_url IS NULL OR result_url ~* '^https?://'), archived_at timestamptz, UNIQUE(edition_id,id),
 FOREIGN KEY(edition_id,project_id) REFERENCES ptv_haul.project(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,task_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.content_event (
 edition_id uuid NOT NULL, content_id uuid NOT NULL, event_id uuid NOT NULL, PRIMARY KEY(content_id,event_id),
 FOREIGN KEY(edition_id,content_id) REFERENCES ptv_haul.content(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.note (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 event_id uuid, project_id uuid, task_id uuid, title text NOT NULL CHECK(length(trim(title))>0), body text NOT NULL DEFAULT '',
 pinned boolean NOT NULL DEFAULT false, archived_at timestamptz,
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,project_id) REFERENCES ptv_haul.project(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,task_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.reminder (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 event_id uuid, project_id uuid, task_id uuid, content_id uuid, session_id uuid,
 title text NOT NULL CHECK(length(trim(title))>0), remind_at timestamptz NOT NULL,
 recipient_id uuid REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
 acknowledged_at timestamptz, archived_at timestamptz,
 FOREIGN KEY(edition_id,event_id) REFERENCES ptv_haul.event(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,project_id) REFERENCES ptv_haul.project(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,task_id) REFERENCES ptv_haul.task(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,content_id) REFERENCES ptv_haul.content(edition_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,session_id) REFERENCES ptv_haul.session(edition_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ptv_haul.saved_view (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.user_account(id) ON DELETE RESTRICT,
 edition_id uuid NOT NULL REFERENCES ptv_haul.edition(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(trim(name))>0), settings jsonb NOT NULL CHECK(jsonb_typeof(settings)='object'), UNIQUE(account_id,edition_id,name)
);
CREATE TABLE IF NOT EXISTS ptv_haul.audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_account_id uuid REFERENCES public.user_account(id) ON DELETE RESTRICT,
 table_name text NOT NULL, row_id uuid NOT NULL, operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
 changed_fields text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS haul_event_schedule ON ptv_haul.event(edition_id,starts_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_task_deadline ON ptv_haul.task(edition_id,deadline) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_task_pic ON ptv_haul.task(pic_id,status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_content_publish ON ptv_haul.content(edition_id,publish_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_session_window ON ptv_haul.session(starts_at,ends_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_reminder_due ON ptv_haul.reminder(remind_at) WHERE acknowledged_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS haul_audit_row ON ptv_haul.audit_log(table_name,row_id,occurred_at DESC);
CREATE OR REPLACE FUNCTION ptv_haul.current_account() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
 SET search_path=pg_catalog,public,auth AS $$
 SELECT id FROM public.user_account WHERE auth_user_id=auth.uid() AND status_akun='active'
 AND public.has_capability('projecthaul.view')
$$;
REVOKE ALL ON FUNCTION ptv_haul.current_account() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ptv_haul.current_account() TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['edition','event','project','project_event','task','task_event','task_member','task_dependency','task_approval','session','assignment','content','content_event','note','reminder','saved_view','audit_log'] LOOP
  EXECUTE format('ALTER TABLE ptv_haul.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE ptv_haul.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ptv_haul.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON ptv_haul.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS haul_read ON ptv_haul.%I',t);
  IF t='saved_view' THEN
   EXECUTE format('CREATE POLICY haul_read ON ptv_haul.%I FOR SELECT TO authenticated USING (account_id=ptv_haul.current_account())',t);
  ELSE
   EXECUTE format('CREATE POLICY haul_read ON ptv_haul.%I FOR SELECT TO authenticated USING (public.has_capability(''projecthaul.view''))',t);
  END IF;
 END LOOP;
END $$;
-- No browser writes granted, including coordinator. API/RPC integration remains blocked.
-- Required before enabling writes: cycle checks across parent/dependency edges;
-- serializable crew conflict enforcement for assignments AND session rescheduling;
-- optimistic revisions; append-only server audit; identity bridge for cookie sessions;
-- crew patch allowlist, explicit coordinator approvals, archive relation guards.
-- Application-only validation is never sufficient for cloud writes.

CREATE TABLE IF NOT EXISTS ptv_haul.project_member (
 project_id uuid NOT NULL REFERENCES ptv_haul.project(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT, PRIMARY KEY(project_id,person_id)
);
ALTER TABLE ptv_haul.project_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_haul.project_member FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ptv_haul.project_member FROM PUBLIC,anon,authenticated;
GRANT SELECT ON ptv_haul.project_member TO authenticated;
DROP POLICY IF EXISTS haul_read ON ptv_haul.project_member;
CREATE POLICY haul_read ON ptv_haul.project_member FOR SELECT TO authenticated USING(public.has_capability('projecthaul.view'));

ROLLBACK;
