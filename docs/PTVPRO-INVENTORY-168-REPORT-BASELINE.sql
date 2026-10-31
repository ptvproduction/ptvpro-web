-- Read-only snapshot of Cloud Staging source for isolated rehearsal. Do not execute on cloud.
-- prosrc MD5: 050ec0fe8d7414999c6654e9e7c41ee9. No credentials or operational rows.
CREATE OR REPLACE FUNCTION ptv_report_private.write_report(p_module text, p_action text, p_id uuid, p_payload jsonb, p_account_id uuid, p_session_iat bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  actor uuid; actor_name text; member_count integer; account_id uuid; owner_key text;
  required_cap text; row_data jsonb; old_meta jsonb; unit_row public.ptv_inventaris_unit%ROWTYPE;
  status_text text; photo text; fingerprint text; target_unit uuid;
BEGIN
  IF (auth.uid() IS NULL AND p_account_id IS NULL) OR p_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated session and report ID required' USING ERRCODE='42501';
  END IF;
  IF p_account_id IS NOT NULL AND coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Server-only report operation' USING ERRCODE='42501';
  END IF;
  IF p_module NOT IN ('lostfound','damage') OR p_module IS NULL
    OR p_action NOT IN ('create','update','delete') OR p_action IS NULL
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid report operation' USING ERRCODE='22023';
  END IF;
  SELECT ua.id, ua.identity_id, ci.full_name INTO account_id, actor, actor_name
    FROM public.user_account ua JOIN public.canonical_identity ci ON ci.id=ua.identity_id
    WHERE ((p_account_id IS NULL AND ua.auth_user_id=auth.uid()) OR (p_account_id IS NOT NULL AND ua.id=p_account_id)) AND ua.status_akun='active';
  IF actor IS NULL THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  owner_key := CASE WHEN p_account_id IS NULL THEN auth.uid()::text ELSE 'account:'||account_id::text END;
  SELECT count(*) INTO member_count FROM public.organization_membership
    WHERE identity_id=actor AND organization_id='ptv_studio' AND is_current;
  IF member_count <> 1 OR NOT EXISTS (SELECT 1 FROM public.organization_membership
    WHERE identity_id=actor AND organization_id='ptv_studio' AND is_current AND status_organisasi='active') THEN
    RAISE EXCEPTION 'Active unique studio membership required' USING ERRCODE='42501';
  END IF;
  required_cap := CASE WHEN p_module='lostfound' THEN
    CASE WHEN p_action='create' THEN 'lostfound.report' ELSE 'lostfound.manage' END
    ELSE CASE WHEN p_action='create' THEN 'damage.report' ELSE 'damage.qc.approve' END END;
  IF (CASE WHEN p_account_id IS NULL THEN public.has_capability(required_cap) ELSE ptv_report_private.can_report(account_id,required_cap,p_session_iat) END) IS NOT TRUE OR
    (CASE WHEN p_account_id IS NULL THEN public.has_capability(CASE WHEN p_module='lostfound' THEN 'lostfound.view' ELSE 'damage.view' END)
      ELSE ptv_report_private.can_report(account_id,CASE WHEN p_module='lostfound' THEN 'lostfound.view' ELSE 'damage.view' END,p_session_iat) END) IS NOT TRUE THEN
    RAISE EXCEPTION 'Report capability required: %', required_cap USING ERRCODE='42501';
  END IF;
  IF octet_length(p_payload::text) > 3000000 THEN
    RAISE EXCEPTION 'Report payload too large' USING ERRCODE='22023';
  END IF;
  photo := nullif(p_payload->>'photoUrl','');
  IF photo IS NOT NULL AND photo !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
    AND photo !~ '^https://swadgljnyelsjstqqxbm[.]supabase[.]co/storage/v1/object/public/' THEN
    RAISE EXCEPTION 'Unsupported report photo' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ptv-report:'||p_module||':'||p_id::text));
  fingerprint := md5(p_payload::text);
  IF p_module='lostfound' THEN
    SELECT to_jsonb(r), r.report_metadata INTO row_data, old_meta FROM public.ptv_lost_found r WHERE id=p_id FOR UPDATE;
  ELSE
    SELECT to_jsonb(r), r.report_metadata INTO row_data, old_meta FROM public.ptv_lapor_masalah r WHERE id=p_id FOR UPDATE;
  END IF;
  IF p_action='create' AND row_data IS NOT NULL THEN
    IF old_meta->>'owner_auth_id'=owner_key AND old_meta->>'create_fingerprint'=fingerprint THEN
      RETURN jsonb_build_object('success',true,'id',p_id,'replayed',true);
    END IF;
    RAISE EXCEPTION 'Report ID already exists with different payload or owner' USING ERRCODE='23505';
  END IF;
  IF p_action <> 'create' AND row_data IS NULL THEN
    RAISE EXCEPTION 'Canonical report not found; historical records cannot be changed' USING ERRCODE='P0002';
  END IF;
  IF p_action='create' AND (coalesce(btrim(p_payload->>'title'),'')='' OR length(p_payload->>'title')>255) THEN
    RAISE EXCEPTION 'Report title required (maximum 255 characters)' USING ERRCODE='22023';
  END IF;

  IF p_module='lostfound' THEN
    IF p_action='create' THEN
      IF coalesce(p_payload->>'type','') NOT IN ('hilang','temuan')
        OR coalesce(btrim(p_payload->>'location'),'')='' THEN
        RAISE EXCEPTION 'Report type and location required' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.ptv_lost_found(id,nama_barang,lokasi_ditemukan,deskripsi,foto_url,status,ditemukan_oleh,report_metadata)
      VALUES(p_id,p_payload->>'title',p_payload->>'location',p_payload->>'description',photo,
        CASE WHEN p_payload->>'type'='hilang' THEN 'hilang' ELSE 'diamankan' END,actor_name,
        jsonb_build_object('owner_auth_id',owner_key,'category',p_payload->>'category',
          'date',(p_payload->>'date')::date,'type',p_payload->>'type','reporterContact',p_payload->>'reporterContact',
          'create_fingerprint',fingerprint));
    ELSIF p_action='update' THEN
      status_text := p_payload->>'status';
      IF coalesce(status_text,'') NOT IN ('Dicari','Ditemukan','Dikembalikan') THEN
        RAISE EXCEPTION 'Invalid Lost & Found status' USING ERRCODE='22023';
      END IF;
      UPDATE public.ptv_lost_found SET status=status_text,
        diklaim_oleh=CASE WHEN status_text='Dikembalikan' THEN actor_name ELSE NULL END,
        tanggal_klaim=CASE WHEN status_text='Dikembalikan' THEN CURRENT_DATE ELSE NULL END WHERE id=p_id;
    ELSE
      DELETE FROM public.ptv_lost_found WHERE id=p_id;
    END IF;
  ELSE
    IF p_action='create' THEN
      target_unit := (p_payload->>'unitId')::uuid;
    ELSE
      target_unit := (row_data->>'unit_id')::uuid;
    END IF;
    SELECT * INTO unit_row FROM public.ptv_inventaris_unit WHERE id=target_unit FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Physical unit not found' USING ERRCODE='23503'; END IF;
    IF p_action='create' THEN
      IF unit_row.inventaris_id IS DISTINCT FROM (p_payload->>'assetId')::uuid THEN
        RAISE EXCEPTION 'Unit does not belong to selected inventory' USING ERRCODE='22023';
      END IF;
      IF coalesce(p_payload->>'severity','') NOT IN ('Ringan','Sedang','Berat') THEN
        RAISE EXCEPTION 'Invalid damage severity' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.ptv_lapor_masalah(id,unit_id,pelapor_id,pelapor_nama,deskripsi_kerusakan,status_qc,report_metadata)
        VALUES(p_id,target_unit,actor,actor_name,p_payload->>'description','dilaporkan',
          jsonb_build_object('owner_auth_id',owner_key,'title',p_payload->>'title','severity',p_payload->>'severity',
            'reporterContact',p_payload->>'reporterContact','photoUrl',photo,'create_fingerprint',fingerprint));
      UPDATE public.ptv_inventaris_unit SET kondisi='rusak',
        status_peminjaman=CASE WHEN status_peminjaman='tersedia' THEN 'rusak' ELSE status_peminjaman END,
        updated_at=now() WHERE id=target_unit;
    ELSIF p_action='update' THEN
      IF row_data->>'status_qc'='Selesai' THEN RAISE EXCEPTION 'Completed QC report is locked' USING ERRCODE='42501'; END IF;
      status_text := p_payload->>'status';
      IF coalesce(status_text,'') NOT IN ('Baru','Sedang Dicek','Dalam Perbaikan','Selesai','Rusak Total') THEN
        RAISE EXCEPTION 'Invalid QC status' USING ERRCODE='22023';
      END IF;
      UPDATE public.ptv_lapor_masalah SET status_qc=status_text,
        qc_approved_by=actor, qc_approved_at=CASE WHEN status_text='Selesai' THEN now() ELSE NULL END,
        updated_at=now(), report_metadata=report_metadata||jsonb_build_object('qcNotes',p_payload->>'qcNotes','qcBy',actor_name,'qcDate',CURRENT_DATE)
        WHERE id=p_id;
      IF status_text='Selesai' AND NOT EXISTS (SELECT 1 FROM public.ptv_lapor_masalah
        WHERE unit_id=target_unit AND id<>p_id AND status_qc NOT IN ('Selesai','selesai')) THEN
        UPDATE public.ptv_inventaris_unit SET kondisi='bagus',
          status_peminjaman=CASE WHEN status_peminjaman IN ('rusak','maintenance') THEN 'tersedia' ELSE status_peminjaman END,
          updated_at=now() WHERE id=target_unit;
      ELSE
        UPDATE public.ptv_inventaris_unit SET kondisi='rusak',
          status_peminjaman=CASE WHEN status_peminjaman='tersedia' THEN 'rusak' ELSE status_peminjaman END,
          updated_at=now() WHERE id=target_unit;
      END IF;
    ELSE
      DELETE FROM public.ptv_lapor_masalah WHERE id=p_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'id',p_id);
END
$function$
