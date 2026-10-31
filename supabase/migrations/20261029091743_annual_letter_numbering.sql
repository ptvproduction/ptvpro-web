-- Review before applying remotely. No historical document is updated by this migration.
-- Supersedes the unexecuted gap-filling proposal; do not apply that proposal afterwards.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public.ptv_surat_izin, public.ptv_surat_tugas, public.ptv_surat_barang IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.ptv_issued_letter_registry (
  doc_type varchar(10) NOT NULL CHECK (doc_type IN ('SI','ST','SBB')),
  year_period int NOT NULL,
  seq_number int NOT NULL CHECK (seq_number BETWEEN 1 AND 999999),
  nomor_surat varchar(64) NOT NULL,
  source varchar(32) NOT NULL DEFAULT 'issued',
  doc_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, year_period, seq_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptv_issued_letter_registry_no ON public.ptv_issued_letter_registry(nomor_surat);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptv_letter_registry_document ON public.ptv_issued_letter_registry(doc_type,doc_id) WHERE doc_id IS NOT NULL;
ALTER TABLE public.ptv_issued_letter_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ptv_issued_letter_registry FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.ptv_issued_letter_registry TO service_role;

-- Backfill all retained numbers, irrespective of document status; conflicts abort the transaction.
DO $$
DECLARE r record; parts text[]; prior public.ptv_issued_letter_registry;
BEGIN
  FOR r IN
    SELECT 'SI' AS kind,id,nomor_surat FROM public.ptv_surat_izin
    UNION ALL SELECT 'ST',id,nomor_surat FROM public.ptv_surat_tugas
    UNION ALL SELECT 'SBB',id,nomor_surat FROM public.ptv_surat_barang
  LOOP
    IF r.nomor_surat IS NULL OR btrim(r.nomor_surat) IN ('','—','-') OR r.nomor_surat LIKE 'DRAFT%' THEN CONTINUE; END IF;
    parts := regexp_match(r.nomor_surat, '^([0-9]{1,6})/' || r.kind || '-PTV/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/([0-9]{4})$');
    IF parts IS NULL OR parts[1]::int < 1 THEN RAISE EXCEPTION 'LETTER_HISTORY_FORMAT_REVIEW_REQUIRED'; END IF;
    SELECT * INTO prior FROM public.ptv_issued_letter_registry WHERE doc_type=r.kind AND year_period=parts[3]::int AND seq_number=parts[1]::int;
    IF FOUND THEN
      IF prior.nomor_surat IS DISTINCT FROM r.nomor_surat OR (prior.doc_id IS NOT NULL AND prior.doc_id IS DISTINCT FROM r.id) THEN
        RAISE EXCEPTION 'LETTER_HISTORY_CONFLICT_REVIEW_REQUIRED';
      END IF;
    ELSE
      INSERT INTO public.ptv_issued_letter_registry(doc_type,year_period,seq_number,nomor_surat,doc_id)
      VALUES(r.kind,parts[3]::int,parts[1]::int,r.nomor_surat,r.id);
    END IF;
  END LOOP;
  -- Existing operator-approved SI reservations; retained even if their documents are deleted.
  INSERT INTO public.ptv_issued_letter_registry(doc_type,year_period,seq_number,nomor_surat,source)
  VALUES ('SI',2026,1,'001/SI-PTV/X/2026','historical_reserved'),
         ('SI',2026,7,'007/SI-PTV/X/2026','historical_reserved'),
         ('SI',2026,9,'009/SI-PTV/X/2026','historical_reserved')
  ON CONFLICT (doc_type,year_period,seq_number) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.ptv_letter_registry_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'LETTER_REGISTRY_IMMUTABLE'; END $$;
DROP TRIGGER IF EXISTS ptv_letter_registry_immutable ON public.ptv_issued_letter_registry;
CREATE TRIGGER ptv_letter_registry_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.ptv_issued_letter_registry
FOR EACH STATEMENT EXECUTE FUNCTION public.ptv_letter_registry_immutable();

CREATE OR REPLACE FUNCTION public.ptv_letter_preview(p_type text,p_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE seq int; roman text; yr int;
BEGIN
  IF p_type NOT IN ('SI','ST','SBB') OR p_type IS NULL OR p_date IS NULL THEN RAISE EXCEPTION 'INVALID_LETTER_PARAMETERS'; END IF;
  yr := extract(year FROM p_date)::int;
  SELECT coalesce(max(seq_number),0)+1 INTO seq FROM public.ptv_issued_letter_registry WHERE doc_type=p_type AND year_period=yr;
  IF seq > 999999 THEN RAISE EXCEPTION 'LETTER_YEAR_CAPACITY_EXHAUSTED'; END IF;
  roman := (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month FROM p_date)::int];
  RETURN jsonb_build_object('nomor_surat',lpad(seq::text,greatest(3,length(seq::text)),'0') || '/' || p_type || '-PTV/' || roman || '/' || yr,
    'sequence',seq,'year',yr::text,'roman_month',roman,'is_vacant',false);
END $$;

CREATE OR REPLACE FUNCTION public.ptv_guard_letter_number() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE kind text := TG_ARGV[0]; parts text[]; candidate jsonb; yr int; seq int; highest int; effective_date date;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'LETTER_ID_IMMUTABLE'; END IF;
    IF OLD.nomor_surat IS NOT NULL AND OLD.nomor_surat ~ '^[0-9]+/' THEN
      IF OLD.nomor_surat IS DISTINCT FROM NEW.nomor_surat THEN RAISE EXCEPTION 'LETTER_NUMBER_IMMUTABLE'; END IF;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.nomor_surat IS NULL OR btrim(NEW.nomor_surat) IN ('','—','-') OR NEW.nomor_surat LIKE 'DRAFT%' THEN
    IF kind <> 'SI' OR lower(NEW.status) NOT IN ('disetujui','approved','acc','valid','aktif') THEN RETURN NEW; END IF;
    effective_date := (to_jsonb(NEW)->>'tanggal_mulai')::date;
    IF effective_date IS NULL THEN RAISE EXCEPTION 'LETTER_DATE_REQUIRED'; END IF;
    yr := extract(year FROM effective_date)::int;
    PERFORM pg_advisory_xact_lock(hashtext('ptv-letter:' || kind),yr);
    candidate := public.ptv_letter_preview(kind,effective_date);
    NEW.nomor_surat := candidate->>'nomor_surat';
  END IF;
  parts := regexp_match(NEW.nomor_surat,'^([0-9]{1,6})/' || kind || '-PTV/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/([0-9]{4})$');
  IF parts IS NULL OR parts[1]::int < 1 THEN RAISE EXCEPTION 'INVALID_LETTER_NUMBER'; END IF;
  yr := parts[3]::int; seq := parts[1]::int;
  PERFORM pg_advisory_xact_lock(hashtext('ptv-letter:' || kind),yr);
  SELECT coalesce(max(seq_number),0) INTO highest FROM public.ptv_issued_letter_registry WHERE doc_type=kind AND year_period=yr;
  IF seq <= highest THEN RAISE EXCEPTION 'LETTER_NUMBER_ALREADY_ALLOCATED_OR_BELOW_HIGH_WATER'; END IF;
  INSERT INTO public.ptv_issued_letter_registry(doc_type,year_period,seq_number,nomor_surat,doc_id)
  VALUES(kind,yr,seq,NEW.nomor_surat,NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_izin;
CREATE TRIGGER ptv_guard_letter_number BEFORE INSERT OR UPDATE ON public.ptv_surat_izin FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('SI');
DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_tugas;
CREATE TRIGGER ptv_guard_letter_number BEFORE INSERT OR UPDATE ON public.ptv_surat_tugas FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('ST');
DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_barang;
CREATE TRIGGER ptv_guard_letter_number BEFORE INSERT OR UPDATE ON public.ptv_surat_barang FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('SBB');

CREATE OR REPLACE FUNCTION public.issue_ptv_surat_izin_atomic(p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.ptv_surat_izin; request_id uuid := (p_document->>'id')::uuid; prior_request jsonb;
BEGIN
  IF request_id IS NULL THEN RAISE EXCEPTION 'LETTER_REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  SELECT * INTO saved FROM public.ptv_surat_izin WHERE id=request_id;
  IF FOUND THEN
    prior_request := saved.metadata->'issuance_request';
    IF prior_request IS DISTINCT FROM p_document THEN RAISE EXCEPTION 'LETTER_REQUEST_CONFLICT'; END IF;
    RETURN to_jsonb(saved);
  END IF;
  IF EXISTS(SELECT 1 FROM public.ptv_issued_letter_registry WHERE doc_type='SI' AND doc_id=request_id) THEN RAISE EXCEPTION 'LETTER_REQUEST_DELETED'; END IF;
  IF jsonb_typeof(p_document->'santri_list') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SANTRI_OBJECTS_REQUIRED'; END IF;
  IF jsonb_array_length(p_document->'santri_list')=0 OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_document->'santri_list') s WHERE jsonb_typeof(s)<>'object' OR coalesce(btrim(s->>'nama'),'')=''
  ) THEN RAISE EXCEPTION 'SANTRI_OBJECTS_REQUIRED'; END IF;
  IF (p_document->>'tanggal_selesai')::date < (p_document->>'tanggal_mulai')::date THEN RAISE EXCEPTION 'INVALID_LETTER_DATE_RANGE'; END IF;
  INSERT INTO public.ptv_surat_izin(id,nomor_surat,nama_pemohon,alasan,tanggal_mulai,tanggal_selesai,
    disetujui_oleh,status,diajukan_oleh,santri_list,qr_token,metadata,jenis_surat,penanggung_jawab)
  VALUES(request_id,NULL,p_document->>'nama_pemohon',p_document->>'alasan',(p_document->>'tanggal_mulai')::date,
    (p_document->>'tanggal_selesai')::date,(p_document->>'disetujui_oleh')::uuid,'disetujui',(p_document->>'diajukan_oleh')::uuid,
    p_document->'santri_list','qr_' || replace(request_id::text,'-',''),
    coalesce(p_document->'metadata','{}'::jsonb) || jsonb_build_object('issuance_request',p_document),
    'Surat Izin Santri',p_document->>'penanggung_jawab') RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;

CREATE OR REPLACE FUNCTION public.approve_ptv_surat_izin_atomic(p_doc_id uuid,p_identity_id uuid,p_issuer text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.ptv_surat_izin;
BEGIN
  SELECT * INTO saved FROM public.ptv_surat_izin WHERE id=p_doc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LETTER_NOT_FOUND'; END IF;
  IF lower(saved.status)='disetujui' THEN RETURN to_jsonb(saved); END IF;
  UPDATE public.ptv_surat_izin SET status='disetujui',disetujui_oleh=p_identity_id,
    penanggung_jawab=p_issuer,review_note=p_note,updated_at=now() WHERE id=p_doc_id RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;

REVOKE ALL ON FUNCTION public.approve_ptv_surat_izin_atomic(uuid,uuid,text,text), public.issue_ptv_surat_izin_atomic(jsonb), public.ptv_letter_preview(text,date),
  public.ptv_guard_letter_number(), public.ptv_letter_registry_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ptv_surat_izin_atomic(uuid,uuid,text,text), public.issue_ptv_surat_izin_atomic(jsonb), public.ptv_letter_preview(text,date),
  public.ptv_guard_letter_number(), public.ptv_letter_registry_immutable() TO service_role;
COMMIT;
