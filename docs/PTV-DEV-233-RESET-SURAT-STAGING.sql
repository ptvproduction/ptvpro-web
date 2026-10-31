-- ==============================================================================
-- PTVPRO HUB — PTV-DEV-233: RESET TERARAH SELURUH DATA SURAT STAGING & LIFECYCLE
-- Target Database: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- PERINGATAN: DILARANG MENJALANKAN DI PRODUCTION (jthzuhkblxcaohiuypqq)!
-- ==============================================================================

BEGIN;

-- 1. TABEL AUDIT PENGHAPUSAN SURAT (Internal Deletion Audit Log)
-- Mencatat jejak forensik penghapusan surat tanpa menjadikannya surat aktif.
CREATE TABLE IF NOT EXISTS public.ptv_letter_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL,
    doc_type VARCHAR(10) NOT NULL,
    nomor_surat VARCHAR(64) NOT NULL,
    deleted_by TEXT,
    actor_id UUID,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptv_letter_del_audit_doc ON public.ptv_letter_deletion_audit(doc_id);
CREATE INDEX IF NOT EXISTS idx_ptv_letter_del_audit_no ON public.ptv_letter_deletion_audit(nomor_surat);

ALTER TABLE public.ptv_letter_deletion_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ptv_letter_deletion_audit TO service_role;
GRANT SELECT ON public.ptv_letter_deletion_audit TO authenticated;

-- 2. PENYESUAIAN TRIGGER & HAK AKSES REGISTRY PENOMORAN
-- Izinkan service_role menghapus nomor yang dilepaskan ketika surat dihapus secara sah.
DROP TRIGGER IF EXISTS ptv_letter_registry_immutable ON public.ptv_issued_letter_registry;

CREATE OR REPLACE FUNCTION public.ptv_letter_registry_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Cegah modifikasi UPDATE pada nomor terdaftar
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'LETTER_REGISTRY_IMMUTABLE_NO_UPDATE';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER ptv_letter_registry_guard
BEFORE UPDATE ON public.ptv_issued_letter_registry
FOR EACH ROW EXECUTE FUNCTION public.ptv_letter_registry_guard();

GRANT SELECT, INSERT, DELETE ON public.ptv_issued_letter_registry TO service_role;

-- 3. RPC PENGHAPUSAN SURAT & PELEPASAN NOMOR SECARA ATOMIK
CREATE OR REPLACE FUNCTION public.rpc_delete_letter_and_release(
    p_doc_id UUID,
    p_doc_type TEXT,
    p_actor_id UUID,
    p_actor_name TEXT,
    p_reason TEXT DEFAULT NULL
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

    -- Catat ke audit log
    IF v_nomor_surat IS NOT NULL AND v_nomor_surat NOT LIKE 'DRAFT%' THEN
        INSERT INTO public.ptv_letter_deletion_audit(doc_id, doc_type, nomor_surat, deleted_by, actor_id, reason)
        VALUES (p_doc_id, p_doc_type, v_nomor_surat, p_actor_name, p_actor_id, p_reason);

        -- Lepaskan nomor dari registry penomoran agar nomor urut dapat dipakai ulang
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

-- 4. KOSONGKAN DATA SURAT STAGING LAMA (SURAT IZIN, TUGAS, BARANG, REGISTRY & LOGS)
-- Membersihkan data testing dan draft lama tanpa merusak akun, kru, inventaris, atau keuangan.
TRUNCATE TABLE public.ptv_surat_izin CASCADE;
TRUNCATE TABLE public.ptv_surat_tugas CASCADE;
TRUNCATE TABLE public.ptv_surat_barang CASCADE;
TRUNCATE TABLE public.ptv_issued_letter_registry CASCADE;

-- Kosongkan log peninjauan surat jika tabel sudah dibuat
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_surat_verifikasi_logs') THEN
        EXECUTE 'TRUNCATE TABLE public.ptv_surat_verifikasi_logs CASCADE;';
    END IF;
END $$;

COMMIT;

-- ==============================================================================
-- HASIL AKHIR:
-- 1. Seluruh data surat staging (SI, ST, SBB, dan registry penomoran) telah bersih.
-- 2. Penomoran surat baru akan dimulai dari kondisi kosong (001/{TYPE}-PTV/{ROMAN}/{YEAR}).
-- 3. Aksi hapus surat kini didukung oleh rpc_delete_letter_and_release dengan pencatatan audit.
-- ==============================================================================
