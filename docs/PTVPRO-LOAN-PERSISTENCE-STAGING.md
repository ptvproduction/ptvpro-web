# Persistensi Peminjaman & Pengembalian Staging — PTV-DEV-108

ACC zidnal pada 21 Oktober 2026 mencakup adapter backend/RPC atomik, catatan per-unit, SQL/RLS minimum dan fixture baru untuk uji cloud. Production, auth global, migrasi lama, data historis, deployment/commit dan penghapusan fixture tidak dikerjakan.

## Implementasi

Runtime diverifikasi: mode staging, auth=vercel, inventaris=supabase, host swadgljnyelsjstqqxbm.supabase.co. API menerima POST pada route peminjaman existing; cookie diperiksa dengan mekanisme signature/expiry existing. Identitas account dan waktu penerbitan cookie ditentukan server, bukan payload. Request JSON harus same-origin; operasi dan field RPC di-whitelist.

Migration connector **loan_persistence_server_adapter** diterapkan pada project **ptvpro-staging / swadgljnyelsjstqqxbm**, kemudian fungsi/grant dibaca ulang. Tidak mengubah tabel atau policy RLS; RLS ptv_peminjaman tetap aktif. Public RPC server memakai SECURITY INVOKER, hanya service_role dapat mengeksekusi. Implementasi SECURITY DEFINER berada di schema privat dengan search_path tetap dan verifikasi role caller. Izin anon/authenticated terhadap RPC server tetap ditolak; tidak ada service-role key di frontend.

Authorize memeriksa akun aktif, tokens_valid_after, capability loans.view/checkout/return dari profil/override riil (deny menang), serta satu keanggotaan Studio aktif untuk mutasi. Tidak mengganti auth global/struktur RBAC. Core transaksi diturunkan dari tiga fungsi live yang diperiksa: validasi, row lock terurut, perubahan loan+unit dan audit existing dipertahankan. Server checkout memeriksa kondisi bagus, menolak null/duplikasi unit, serta merekonsiliasi transaction ID yang sama hanya untuk actor/payload/unit yang sama.

Catatan per-unit disimpan atomik bersama tanggal/status pengembalian dan status unit; tidak mengembalikan unit lain atau membuat UPDATE catatan terpisah. UI memperlihatkan catatan yang dibaca dari API setelah refresh. Jalur catatan baru ditargetkan pada runtime cookie Vercel; mode Supabase Auth lama tetap menolak catatan per-unit yang tidak didukung RPC lama.

## Fixture yang dibuat — jangan hapus otomatis

| Jenis | ID / kode |
| --- | --- |
| Master inventaris | cd528e73-90db-4442-b474-4d4ac0f1cccd — UJI-108-20261021 |
| Unit U01 | f6818397-a8c8-4c7e-9a96-ca2e36d1c732 — UJI-108-20261021-U01 |
| Unit U02 | f051767d-2db3-469d-93df-6eda1c09bbd8 — UJI-108-20261021-U02 |
| Pinjaman U01 | 32900fa6-2877-4945-bbb6-b9b8c6220dd8 |
| Pinjaman U02 | d10598de-ee4c-4f8e-b91d-f5024b088e7d |
| Transaksi | TRX-9d5bd6f1-6117-4df1-b9db-359eb95a47e9 |

Fixture adalah alat non-operasional bertanda uji dengan dua unit baru; tidak menggunakan/mengubah alat historis. Kedua pinjaman sekarang dikembalikan, kedua unit tersedia dan kondisi bagus. Record dan audit log tidak dihapus. Cleanup memerlukan persetujuan terpisah.

## Bukti aktual dan batas

- UI Chrome pada localhost:5174 membuat peminjaman dua unit; SQL readback memperlihatkan dua canonical loan dan dua status unit dipinjam. Refresh penuh tetap menampilkan transaksi.
- Pengembalian U01 melalui modal per-unit dengan catatan **UJI-CATATAN-PER-UNIT-108: U01 lengkap; U02 tetap dipinjam.** dikonfirmasi backend. Readback: U01 dikembalikan/tersedia, catatan berawalan Kembali tersimpan; U02 tetap dipinjam, catatan NULL. Refresh UI menunjukkan hasil parsial serta catatan.
- Pengembalian sisa transaksi mengubah U02 saja; catatan **UJI-KEMBALI-SISA-108: U02 lengkap; catatan U01 harus tetap.** tersimpan. Catatan U01 tidak tertimpa. Sesudah refresh, tab Selesai menampilkan kedua catatan dan semua alat kembali.
- Operator mengonfirmasi logout/login ulang ke Staging. Tab uji kemudian di-refresh dengan sesi baru; API dan UI kembali memperlihatkan transaksi selesai dan kedua catatan. Kredensial tidak dibaca oleh agen.
- Replay checkout dengan transaction ID/payload/actor sama mengembalikan success=true,replayed=true; tidak membuat baris tambahan atau meminjam unit kembali. Percobaan checkout satu unit valid+UUID tidak ada ditolak seluruhnya; tidak ada pinjaman/status unit parsial.
- Uji sesi stale (iat=0 pada account dengan tokens_valid_after) ditolak oleh otorisasi live. Grant anon/authenticated pada RPC server ditolak, service_role diizinkan. Security advisors diperiksa; tidak ada temuan yang menyebut objek loan baru. Bukan klaim seluruh project bebas temuan.
- Uji live akun aktif tanpa loans.return tidak dapat dijalankan: kandidat yang memenuhi kriteria tidak tersedia; percobaan berhenti sebelum mutasi. Penolakan capability diuji pada kontrak API lokal dan logika DB diperiksa; tidak membuat akun atau mengubah role/override untuk memaksakan pengujian.
- Arsip peminjaman tetap 41 baris. Fingerprint pascauji: 13f8f6224fe1d2f6b7934d4785f13ffd; tidak mengklaim perbandingan fingerprint sebelum/sesudah karena baseline fingerprint awal tidak diambil. Tidak ada DML terhadap arsip/historical record.
- 77/77 tes terfokus pada lima file lulus; typecheck, lint dan build lulus. Build tetap memberi warning chunk >500 kB.
- Screenshot bukti sesudah login ulang: .gemini/scratch/persistence-108-returned.png. Ini uji integrasi nyata Staging dan API lokal, bukan deployment domain resmi.

## SQL yang diterapkan

Dieksekusi melalui apply_migration pada project ref Staging terverifikasi, bukan rerun migrasi lama. CLI Supabase tidak tersedia lokal; tidak diinstal dan tidak membuat nama timestamp migration secara manual.

```sql
CREATE SCHEMA ptv_loan_private;
REVOKE ALL ON SCHEMA ptv_loan_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ptv_loan_private TO service_role;
CREATE FUNCTION ptv_loan_private.authorize(p_account_id uuid,p_session_iat bigint,p_cap text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
DECLARE actor uuid; valid_after timestamptz; count_current integer;
BEGIN
 IF coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','') <> 'service_role' OR p_cap IS NULL OR p_cap NOT IN ('loans.view','loans.checkout','loans.return') THEN
 RAISE EXCEPTION 'Server-only loan authorization required' USING ERRCODE='42501'; END IF;
 SELECT identity_id,tokens_valid_after INTO actor,valid_after FROM public.user_account WHERE id=p_account_id AND status_akun='active';
 IF actor IS NULL OR p_session_iat IS NULL OR (valid_after IS NOT NULL AND p_session_iat < extract(epoch FROM valid_after)::bigint) THEN
 RAISE EXCEPTION 'Active unrevoked Hub session required' USING ERRCODE='42501'; END IF;
 IF p_cap <> 'loans.view' THEN
 SELECT count(*) INTO count_current FROM public.organization_membership WHERE identity_id=actor AND organization_id='ptv_studio' AND is_current;
 IF count_current<>1 OR NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id=actor AND organization_id='ptv_studio' AND is_current AND status_organisasi='active') THEN
 RAISE EXCEPTION 'Unique active studio membership required' USING ERRCODE='42501'; END IF; END IF;
 IF EXISTS (SELECT 1 FROM public.account_capability_overrides WHERE account_id=p_account_id AND capability_key=p_cap AND override_type='deny')
 OR NOT (EXISTS (SELECT 1 FROM public.account_capability_overrides WHERE account_id=p_account_id AND capability_key=p_cap AND override_type='allow')
 OR EXISTS (SELECT 1 FROM public.account_profiles ap JOIN public.profile_capabilities pc ON pc.profile_id=ap.profile_id WHERE ap.account_id=p_account_id AND pc.capability_key=p_cap)) THEN
 RAISE EXCEPTION 'Required loan capability: %',p_cap USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION ptv_loan_private.authorize(uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ptv_loan_private.authorize(uuid,bigint,text) TO service_role;

CREATE FUNCTION ptv_loan_private.checkout_loan(p_account_id uuid,p_session_iat bigint,p_transaction_id text,p_borrower_name text,p_purpose text,p_out_date date,p_due_date date,p_event_name text,p_unit_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $body$
DECLARE
    v_verified_identity_id UUID;
    v_deduped_unit_ids UUID[];
    v_unit_id UUID;
    v_count INT := 0;
BEGIN
 v_verified_identity_id := ptv_loan_private.authorize(p_account_id,p_session_iat,'loans.checkout');
-- 6. Validasi Input Parameter Dasar
    IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Transaction ID cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_borrower_name IS NULL OR btrim(p_borrower_name) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Borrower name cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_purpose IS NULL OR btrim(p_purpose) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Purpose cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_out_date IS NULL OR p_due_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Checkout date and due date are required' USING ERRCODE = '22023';
    END IF;

    IF p_due_date < p_out_date THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Due date cannot be earlier than checkout date' USING ERRCODE = '22023';
    END IF;

    -- 7. Validasi Array Unit
    IF p_unit_ids IS NULL OR cardinality(p_unit_ids) = 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Unit list cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF array_position(p_unit_ids,NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Unit IDs cannot contain null elements' USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(DISTINCT u) INTO v_deduped_unit_ids FROM unnest(p_unit_ids) u;
    IF cardinality(v_deduped_unit_ids) != cardinality(p_unit_ids) THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Duplicate unit IDs detected in checkout basket' USING ERRCODE = '22023';
    END IF;

    -- 8. Advisory Lock untuk Serialisasi Transaksi Checkout
    PERFORM pg_advisory_xact_lock(hashtext(p_transaction_id));

 IF EXISTS (SELECT 1 FROM public.ptv_peminjaman WHERE transaction_id=p_transaction_id) THEN
 IF (SELECT count(*)=cardinality(v_deduped_unit_ids) AND count(DISTINCT unit_id)=cardinality(v_deduped_unit_ids)
 AND bool_and(unit_id=ANY(v_deduped_unit_ids) AND actor_id=v_verified_identity_id AND peminjam_nama=p_borrower_name AND keperluan=p_purpose AND tanggal_pinjam=p_out_date AND tenggat_kembali=p_due_date) FROM public.ptv_peminjaman WHERE transaction_id=p_transaction_id) IS TRUE THEN
 RETURN jsonb_build_object('success',true,'transaction_id',p_transaction_id,'replayed',true); END IF;
 RAISE EXCEPTION 'Duplicate transaction with different owner or payload' USING ERRCODE='23505'; END IF;

    -- 9. Penguncian Concurrency Deterministik (ORDER BY id Mencegah Deadlock)
    PERFORM id FROM public.ptv_inventaris_unit 
    WHERE id = ANY(v_deduped_unit_ids) AND status_peminjaman = 'tersedia' AND kondisi='bagus' 
    ORDER BY id 
    FOR UPDATE;

    IF (SELECT count(*) FROM public.ptv_inventaris_unit WHERE id = ANY(v_deduped_unit_ids) AND status_peminjaman = 'tersedia' AND kondisi='bagus') != cardinality(v_deduped_unit_ids) THEN
        RAISE EXCEPTION 'UNIT_NOT_AVAILABLE: One or more selected units are already loaned, damaged, or missing' 
            USING ERRCODE = 'P0001';
    END IF;

    -- 10. Mutasi Atomik (actor_id SELALU menggunakan identitas terverifikasi sesi)
    FOREACH v_unit_id IN ARRAY v_deduped_unit_ids LOOP
        INSERT INTO public.ptv_peminjaman (
            transaction_id, unit_id, peminjam_nama, keperluan, 
            tanggal_pinjam, tenggat_kembali, status, actor_id
        ) VALUES (
            p_transaction_id, v_unit_id, p_borrower_name, p_purpose,
            p_out_date, p_due_date, 'dipinjam', v_verified_identity_id
        );

        UPDATE public.ptv_inventaris_unit 
        SET status_peminjaman = 'dipinjam', updated_at = now()
        WHERE id = v_unit_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'items_count', v_count,
        'verified_actor_id', v_verified_identity_id
    );
END;

$body$;
 REVOKE ALL ON FUNCTION ptv_loan_private.checkout_loan(uuid,bigint,text,text,text,date,date,text,uuid[]) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION ptv_loan_private.checkout_loan(uuid,bigint,text,text,text,date,date,text,uuid[]) TO service_role;
 CREATE FUNCTION public.rpc_checkout_loan_server(p_account_id uuid,p_session_iat bigint,p_transaction_id text,p_borrower_name text,p_purpose text,p_out_date date,p_due_date date,p_event_name text,p_unit_ids uuid[]) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_loan_private.checkout_loan(p_account_id,p_session_iat,p_transaction_id,p_borrower_name,p_purpose,p_out_date,p_due_date,p_event_name,p_unit_ids); $$;
 REVOKE ALL ON FUNCTION public.rpc_checkout_loan_server(uuid,bigint,text,text,text,date,date,text,uuid[]) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan_server(uuid,bigint,text,text,text,date,date,text,uuid[]) TO service_role;

CREATE FUNCTION ptv_loan_private.return_loan(p_account_id uuid,p_session_iat bigint,p_transaction_id text,p_back_date date,p_condition_status text,p_notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $body$
DECLARE
    v_verified_identity_id UUID;
    v_unit_ids UUID[];
BEGIN
 v_verified_identity_id := ptv_loan_private.authorize(p_account_id,p_session_iat,'loans.return');
-- 6. Validasi Input Parameter
    IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Transaction ID cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_back_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Return date cannot be null' USING ERRCODE = '22023';
    END IF;

    IF p_condition_status IS NULL OR p_condition_status NOT IN ('bagus', 'rusak', 'perlu_servis') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid condition status (%). Allowed values: bagus, rusak, perlu_servis', 
            COALESCE(p_condition_status, 'null') USING ERRCODE = '22023';
    END IF;

    -- 7. Penguncian Baris Peminjaman Aktif FOR UPDATE
    SELECT array_agg(unit_id ORDER BY unit_id) INTO v_unit_ids
    FROM (
        SELECT unit_id
        FROM public.ptv_peminjaman
        WHERE transaction_id = p_transaction_id AND status = 'dipinjam'
        ORDER BY unit_id
        FOR UPDATE
    ) sub_loans;

    IF v_unit_ids IS NULL OR cardinality(v_unit_ids) = 0 THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No active loans found for transaction %', p_transaction_id 
            USING ERRCODE = 'P0001';
    END IF;

    -- 8. Penguncian Unit Terkait dalam Urutan Deterministik
    PERFORM id FROM public.ptv_inventaris_unit
    WHERE id = ANY(v_unit_ids)
    ORDER BY id
    FOR UPDATE;

    -- 9. Mutasi Atomik Pengembalian Transaksi Penuh
    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = p_back_date,
        kondisi_kembali = p_condition_status,
        catatan = CASE 
            WHEN p_notes IS NOT NULL AND btrim(p_notes) != '' THEN 
                COALESCE(catatan, '') || ' | Kembali: ' || btrim(p_notes)
            ELSE catatan 
        END
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE 
            WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' 
            ELSE 'tersedia' 
        END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = ANY(v_unit_ids);

    -- 10. Pencatatan Audit Log Forensik
    INSERT INTO public.auth_audit_log (
        actor_id, event_type, metadata
    ) VALUES (
        v_verified_identity_id, 
        'loan.return.full', 
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'returned_units_count', cardinality(v_unit_ids),
            'condition_status', p_condition_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_units', cardinality(v_unit_ids),
        'processed_by', v_verified_identity_id
    );
END;

$body$;
 REVOKE ALL ON FUNCTION ptv_loan_private.return_loan(uuid,bigint,text,date,text,text) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION ptv_loan_private.return_loan(uuid,bigint,text,date,text,text) TO service_role;
 CREATE FUNCTION public.rpc_return_loan_server(p_account_id uuid,p_session_iat bigint,p_transaction_id text,p_back_date date,p_condition_status text,p_notes text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_loan_private.return_loan(p_account_id,p_session_iat,p_transaction_id,p_back_date,p_condition_status,p_notes); $$;
 REVOKE ALL ON FUNCTION public.rpc_return_loan_server(uuid,bigint,text,date,text,text) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION public.rpc_return_loan_server(uuid,bigint,text,date,text,text) TO service_role;

CREATE FUNCTION ptv_loan_private.return_single_unit(p_account_id uuid,p_session_iat bigint,p_loan_row_id uuid,p_unit_id uuid,p_condition_status text,p_notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $body$
DECLARE
    v_verified_identity_id UUID;
    v_unit_code TEXT;
    v_tx_id TEXT;
BEGIN
 v_verified_identity_id := ptv_loan_private.authorize(p_account_id,p_session_iat,'loans.return');
-- 6. Validasi Input Parameter
    IF p_loan_row_id IS NULL OR p_unit_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Loan row ID and Unit ID are required' USING ERRCODE = '22023';
    END IF;

    IF p_condition_status IS NULL OR p_condition_status NOT IN ('bagus', 'rusak', 'perlu_servis') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid condition status (%). Allowed values: bagus, rusak, perlu_servis', 
            COALESCE(p_condition_status, 'null') USING ERRCODE = '22023';
    END IF;

    -- 7. Penguncian Baris Peminjaman Spesifik FOR UPDATE
    SELECT transaction_id INTO v_tx_id
    FROM public.ptv_peminjaman
    WHERE id = p_loan_row_id AND unit_id = p_unit_id AND status = 'dipinjam'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOAN_NOT_ACTIVE: Specified loan row % is not active or already returned', 
            p_loan_row_id USING ERRCODE = 'P0001';
    END IF;

    -- 8. Penguncian Unit Spesifik FOR UPDATE
    SELECT kode_unit INTO v_unit_code
    FROM public.ptv_inventaris_unit
    WHERE id = p_unit_id
    FOR UPDATE;

    -- 9. Mutasi Atomik Pengembalian Parsial
    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = CURRENT_DATE,
        kondisi_kembali = p_condition_status,
 catatan=CASE WHEN p_notes IS NOT NULL AND btrim(p_notes)<>'' THEN concat_ws(' | ',nullif(catatan,''),'Kembali: '||btrim(p_notes)) ELSE catatan END
    WHERE id = p_loan_row_id AND unit_id = p_unit_id;

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE 
            WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' 
            ELSE 'tersedia' 
        END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = p_unit_id;

    -- 10. Pencatatan Audit Log Forensik
    INSERT INTO public.auth_audit_log (
        actor_id, event_type, metadata
    ) VALUES (
        v_verified_identity_id, 
        'loan.return.single', 
        jsonb_build_object(
            'loan_row_id', p_loan_row_id,
            'unit_id', p_unit_id,
            'kode_unit', v_unit_code,
            'transaction_id', v_tx_id,
            'condition_status', p_condition_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_row_id,
        'unit_id', p_unit_id,
        'kode_unit', v_unit_code,
        'unit_code', v_unit_code,
        'status', 'dikembalikan',
        'processed_by', v_verified_identity_id
    );
END;

$body$;
 REVOKE ALL ON FUNCTION ptv_loan_private.return_single_unit(uuid,bigint,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION ptv_loan_private.return_single_unit(uuid,bigint,uuid,uuid,text,text) TO service_role;
 CREATE FUNCTION public.rpc_return_single_unit_server(p_account_id uuid,p_session_iat bigint,p_loan_row_id uuid,p_unit_id uuid,p_condition_status text,p_notes text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_loan_private.return_single_unit(p_account_id,p_session_iat,p_loan_row_id,p_unit_id,p_condition_status,p_notes); $$;
 REVOKE ALL ON FUNCTION public.rpc_return_single_unit_server(uuid,bigint,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit_server(uuid,bigint,uuid,uuid,text,text) TO service_role;
CREATE FUNCTION public.rpc_loans_can_read_server(p_account_id uuid,p_session_iat bigint) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_loan_private.authorize(p_account_id,p_session_iat,'loans.view') IS NOT NULL; $$;
REVOKE ALL ON FUNCTION public.rpc_loans_can_read_server(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_loans_can_read_server(uuid,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
```



## Audit awal finishing 149 — 25 Oktober 2026

Audit terbatas api/peminjaman.ts, api/loanPersistence.ts, stagingPeminjamanService dan tes server persistence; tidak audit ulang seluruh Inventaris. Gate live dan adapter cookie memakai actor dari sesi, allowlist RPC/argumen, konfirmasi success backend, serta menolak fallback sukses. Bukti ini dari source dan mock, bukan uji cloud baru.

Quick fix lokal: batas payload 64KB berlaku juga untuk req.body object yang sudah diproses framework; body array ditolak. Regression test memastikan payload besar tidak memanggil RPC. Tidak mengubah identitas, histori arsip atau desain.

Prioritas berikut: (1) uji nyata ownership/divisi/capability pada server RPC dan RLS; (2) dua checkout unit yang sama bersamaan, retry idempotent, audit failure rollback; (3) pengembalian parsial dan catatan/unit/status setelah refresh; (4) daftar arsip Legacy dengan kru_id NULL tetap tidak ditebak lewat nama. Belum READY dan belum dilakukan mutasi cloud.
