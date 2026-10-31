-- ============================================================================
-- PTVPRO HUB — BUG-011 HOTFIX: PENOMORAN SURAT GAP-FILLING & RELEASE REGISTRY
-- File: docs/PTV-DEV-236-LETTER-NUMBERING-GAP-FILLING.sql
-- Target: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- Sifat: Idempotent, Non-Destructive, Gap-Filling Compatible
-- ============================================================================

BEGIN;

-- 1. Pastikan Grants pada Registry Mengizinkan INSERT, SELECT, dan DELETE bagi service_role
GRANT SELECT, INSERT, DELETE ON public.ptv_issued_letter_registry TO service_role;

-- 2. Trigger Guard pada Registry: Blokir UPDATE, tetapi Izinkan DELETE untuk Pelepasan Nomor
DROP TRIGGER IF EXISTS ptv_letter_registry_immutable ON public.ptv_issued_letter_registry;
DROP TRIGGER IF EXISTS ptv_letter_registry_guard ON public.ptv_issued_letter_registry;

CREATE OR REPLACE FUNCTION public.ptv_letter_registry_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'LETTER_REGISTRY_IMMUTABLE_NO_UPDATE';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER ptv_letter_registry_guard
BEFORE UPDATE ON public.ptv_issued_letter_registry
FOR EACH ROW EXECUTE FUNCTION public.ptv_letter_registry_guard();

-- 3. Fungsi Preview Nomor Surat dengan Strategi Gap-Filling (Memprioritaskan Nomor yang Dilepaskan)
CREATE OR REPLACE FUNCTION public.ptv_letter_preview(p_type text, p_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE 
  seq int; 
  roman text; 
  yr int;
  max_seq int;
BEGIN
  IF p_type NOT IN ('SI','ST','SBB') OR p_type IS NULL OR p_date IS NULL THEN 
    RAISE EXCEPTION 'INVALID_LETTER_PARAMETERS'; 
  END IF;
  
  yr := extract(year FROM p_date)::int;
  
  -- Cari urutan tertinggi saat ini di registry
  SELECT coalesce(max(seq_number), 0) INTO max_seq 
  FROM public.ptv_issued_letter_registry 
  WHERE doc_type = p_type AND year_period = yr;
  
  -- Gap-Filling: Cari angka terkecil >= 1 yang belum terdaftar di ptv_issued_letter_registry
  SELECT coalesce(
    (
      SELECT s.n
      FROM generate_series(1, max_seq + 1) AS s(n)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ptv_issued_letter_registry r
        WHERE r.doc_type = p_type AND r.year_period = yr AND r.seq_number = s.n
      )
      ORDER BY s.n ASC
      LIMIT 1
    ),
    1
  ) INTO seq;

  IF seq > 999999 THEN 
    RAISE EXCEPTION 'LETTER_YEAR_CAPACITY_EXHAUSTED'; 
  END IF;

  roman := (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month FROM p_date)::int];
  
  RETURN jsonb_build_object(
    'nomor_surat', lpad(seq::text, greatest(3, length(seq::text)), '0') || '/' || p_type || '-PTV/' || roman || '/' || yr,
    'sequence', seq,
    'year', yr::text,
    'roman_month', roman,
    'is_vacant', (seq <= max_seq)
  );
END $$;

-- 4. Trigger Guard Penomoran: Menghapus Blokir High-Water Mark; Mengizinkan Nomor Kosong/Dilepaskan
CREATE OR REPLACE FUNCTION public.ptv_guard_letter_number() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE 
  kind text := TG_ARGV[0]; 
  parts text[]; 
  candidate jsonb; 
  yr int; 
  seq int; 
  effective_date date;
BEGIN
  -- A. Proteksi Update Dokumen
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id IS DISTINCT FROM NEW.id THEN 
      RAISE EXCEPTION 'LETTER_ID_IMMUTABLE'; 
    END IF;
    IF OLD.nomor_surat IS NOT NULL AND OLD.nomor_surat ~ '^[0-9]+/' THEN
      IF OLD.nomor_surat IS DISTINCT FROM NEW.nomor_surat THEN 
        RAISE EXCEPTION 'LETTER_NUMBER_IMMUTABLE'; 
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  -- B. Auto-Generate Nomor jika Belum Ada / Draft
  IF NEW.nomor_surat IS NULL OR btrim(NEW.nomor_surat) IN ('','—','-') OR NEW.nomor_surat LIKE 'DRAFT%' THEN
    IF kind <> 'SI' OR lower(NEW.status) NOT IN ('disetujui','approved','acc','valid','aktif') THEN 
      RETURN NEW; 
    END IF;
    effective_date := (to_jsonb(NEW)->>'tanggal_mulai')::date;
    IF effective_date IS NULL THEN 
      RAISE EXCEPTION 'LETTER_DATE_REQUIRED'; 
    END IF;
    yr := extract(year FROM effective_date)::int;
    PERFORM pg_advisory_xact_lock(hashtext('ptv-letter:' || kind), yr);
    candidate := public.ptv_letter_preview(kind, effective_date);
    NEW.nomor_surat := candidate->>'nomor_surat';
  END IF;

  -- C. Validasi Format Nomor Surat
  parts := regexp_match(NEW.nomor_surat, '^([0-9]{1,6})/' || kind || '-PTV/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/([0-9]{4})$');
  IF parts IS NULL OR parts[1]::int < 1 THEN 
    RAISE EXCEPTION 'INVALID_LETTER_NUMBER: %', NEW.nomor_surat; 
  END IF;

  yr := parts[3]::int; 
  seq := parts[1]::int;
  
  -- Kunci Konkurensi Atomik per Jenis Surat & Tahun
  PERFORM pg_advisory_xact_lock(hashtext('ptv-letter:' || kind), yr);

  -- D. Validasi Duplikasi: Tolak jika Nomor Sedang Terdaftar untuk Dokumen Lain
  IF EXISTS (
    SELECT 1 FROM public.ptv_issued_letter_registry
    WHERE doc_type = kind AND year_period = yr AND seq_number = seq
      AND (doc_id IS NULL OR doc_id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'LETTER_NUMBER_ALREADY_ALLOCATED: Nomor surat % sedang terdaftar pada dokumen lain.', NEW.nomor_surat
      USING ERRCODE = '23505';
  END IF;

  -- E. Daftarkan Nomor Resmi ke Registry Penomoran
  INSERT INTO public.ptv_issued_letter_registry(doc_type, year_period, seq_number, nomor_surat, doc_id)
  VALUES(kind, yr, seq, NEW.nomor_surat, NEW.id)
  ON CONFLICT (doc_type, year_period, seq_number) DO UPDATE
    SET nomor_surat = EXCLUDED.nomor_surat, doc_id = EXCLUDED.doc_id, created_at = now();

  RETURN NEW;
END $$;

-- 5. Pasang Ulang Trigger pada Seluruh Tabel Surat Resmi
DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_izin;
CREATE TRIGGER ptv_guard_letter_number 
BEFORE INSERT OR UPDATE ON public.ptv_surat_izin 
FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('SI');

DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_tugas;
CREATE TRIGGER ptv_guard_letter_number 
BEFORE INSERT OR UPDATE ON public.ptv_surat_tugas 
FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('ST');

DROP TRIGGER IF EXISTS ptv_guard_letter_number ON public.ptv_surat_barang;
CREATE TRIGGER ptv_guard_letter_number 
BEFORE INSERT OR UPDATE ON public.ptv_surat_barang 
FOR EACH ROW EXECUTE FUNCTION public.ptv_guard_letter_number('SBB');

-- 6. RPC Atomik Penghapusan Surat & Pelepasan Nomor Resmi
CREATE OR REPLACE FUNCTION public.rpc_delete_letter_and_release(
    p_doc_id UUID,
    p_doc_type TEXT,
    p_actor_id UUID DEFAULT NULL,
    p_actor_name TEXT DEFAULT 'Pengelola Arsip PTV',
    p_reason TEXT DEFAULT 'Penghapusan resmi via Surat & Arsip'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_target_table TEXT;
    v_nomor_surat TEXT;
    v_existing RECORD;
BEGIN
    IF p_doc_type = 'SI' THEN
        v_target_table := 'ptv_surat_izin';
        SELECT id, nomor_surat INTO v_existing FROM public.ptv_surat_izin WHERE id = p_doc_id;
    ELSIF p_doc_type = 'ST' THEN
        v_target_table := 'ptv_surat_tugas';
        SELECT id, nomor_surat INTO v_existing FROM public.ptv_surat_tugas WHERE id = p_doc_id;
    ELSIF p_doc_type = 'SBB' THEN
        v_target_table := 'ptv_surat_barang';
        SELECT id, nomor_surat INTO v_existing FROM public.ptv_surat_barang WHERE id = p_doc_id;
    ELSE
        RAISE EXCEPTION 'INVALID_DOC_TYPE: %', p_doc_type;
    END IF;

    IF v_existing IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dokumen tidak ditemukan.');
    END IF;

    v_nomor_surat := v_existing.nomor_surat;

    -- Catat ke audit log penghapusan
    IF v_nomor_surat IS NOT NULL AND v_nomor_surat NOT LIKE 'DRAFT%' AND v_nomor_surat NOT IN ('', '—', '-') THEN
        INSERT INTO public.ptv_letter_deletion_audit(doc_id, doc_type, nomor_surat, deleted_by, actor_id, reason)
        VALUES (p_doc_id, p_doc_type, v_nomor_surat, p_actor_name, p_actor_id, p_reason);

        -- Lepaskan nomor dari registry penomoran agar nomor urut dapat dipakai ulang (Gap-Filling)
        DELETE FROM public.ptv_issued_letter_registry
        WHERE doc_type = p_doc_type AND (doc_id = p_doc_id OR nomor_surat = v_nomor_surat);
    END IF;

    -- Hapus dokumen dari tabel operasional
    IF p_doc_type = 'SI' THEN
        DELETE FROM public.ptv_surat_izin WHERE id = p_doc_id;
    ELSIF p_doc_type = 'ST' THEN
        DELETE FROM public.ptv_surat_tugas WHERE id = p_doc_id;
    ELSIF p_doc_type = 'SBB' THEN
        DELETE FROM public.ptv_surat_barang WHERE id = p_doc_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'doc_id', p_doc_id,
        'released_number', v_nomor_surat,
        'message', 'Surat berhasil dihapus dan nomor resmi dilepaskan.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_letter_and_release(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_letter_and_release(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

COMMIT;
