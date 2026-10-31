-- TEST HARNESS: Verifikasi DDL, Constraints, RLS, & RPC Finance 2.0 (v2)
-- TARGET: PostgreSQL 17 Staging (swadgljnyelsjstqqxbm)
-- STATUS: Dijalankan SETELAH ACC operator dalam transaksi ROLLBACK (tidak meninggalkan jejak fixture live)
--
-- Jalankan skrip ini dalam satu blok transaksi yang otomatis di-ROLLBACK di akhir skrip
-- untuk membuktikan seluruh invariants berjalan tanpa mencemari database Staging.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_test_identity UUID := gen_random_uuid();
  v_test_account UUID := gen_random_uuid();
  v_test_session_iat BIGINT := extract(epoch FROM now())::BIGINT;
  v_test_profile UUID := gen_random_uuid();

  v_test_pocket_cash UUID := gen_random_uuid();
  v_test_pocket_bank UUID := gen_random_uuid();
  v_test_category_income UUID := gen_random_uuid();
  v_test_category_expense UUID := gen_random_uuid();

  v_tx_id UUID;
  v_res JSONB;
  v_balance_cash BIGINT;
  v_balance_bank BIGINT;
  v_err_caught BOOLEAN := false;
  v_idemp_key UUID := gen_random_uuid();
BEGIN
  RAISE NOTICE '=== MEMULAI TEST HARNESS FINANCE 2.0 (ROLLBACK ISOLATED) ===';

  -- --------------------------------------------------------------------------
  -- 0. FIXTURE OTORISASI UJI (TERISOLASI DALAM ROLLBACK)
  -- --------------------------------------------------------------------------
  -- Buat user account uji aktif
  INSERT INTO public.user_account (id, identity_id, status_akun, created_at)
  VALUES (v_test_account, v_test_identity, 'active', now());

  -- Buat keanggotaan ptv_studio aktif
  INSERT INTO public.organization_membership (
    identity_id, organization_id, status_organisasi, is_current, joined_at
  ) VALUES (
    v_test_identity, 'ptv_studio', 'active', true, now()
  );

  -- Berikan capability finance.manage via profile uji
  INSERT INTO public.account_profiles (account_id, profile_id)
  VALUES (v_test_account, v_test_profile);

  INSERT INTO public.profile_capabilities (profile_id, capability_key)
  VALUES (v_test_profile, 'finance.manage');

  RAISE NOTICE '[PASS] Fixture otorisasi Hub terpasang dalam transaksi uji';

  -- --------------------------------------------------------------------------
  -- 1. UJI ANTI-SPOOFING & OTORISASI
  -- --------------------------------------------------------------------------
  -- 1a. Akun fiktif/tidak ada (harus ditolak)
  v_err_caught := false;
  BEGIN
    PERFORM ptv_finance_private.authorize(gen_random_uuid(), v_test_session_iat, 'finance.manage');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Akun tidak dikenal tidak ditolak!'; END IF;

  -- 1b. Sesi kedaluwarsa / stale session (session_iat lampau sebelum tokens_valid_after)
  UPDATE public.user_account
     SET tokens_valid_after = now() + INTERVAL '1 hour'
   WHERE id = v_test_account;

  v_err_caught := false;
  BEGIN
    PERFORM ptv_finance_private.authorize(v_test_account, v_test_session_iat, 'finance.manage');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Sesi stale tidak ditolak!'; END IF;

  -- Kembalikan tokens_valid_after normal
  UPDATE public.user_account
     SET tokens_valid_after = NULL
   WHERE id = v_test_account;

  -- 1c. Otorisasi sah menghasilkan identity_id yang tepat
  IF ptv_finance_private.authorize(v_test_account, v_test_session_iat, 'finance.manage') <> v_test_identity THEN
    RAISE EXCEPTION 'GAGAL: Identity yang diverifikasi tidak cocok!';
  END IF;

  RAISE NOTICE '[PASS] Anti-spoofing dan verifikasi session otorisasi terverifikasi';

  -- --------------------------------------------------------------------------
  -- 2. UJI CONSTRAINT KANTONG
  -- --------------------------------------------------------------------------
  -- 2a. Kantong cash sah (tanpa provider/rekening)
  INSERT INTO public.ptv_finance_pockets (id, name, kind, balance_minor)
  VALUES (v_test_pocket_cash, 'Kas Utama Uji', 'cash', 0);

  -- 2b. Uji kegagalan: Kantong cash dengan nomor rekening (harus ditolak)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.ptv_finance_pockets (name, kind, provider, account_number, account_holder)
    VALUES ('Kas Ilegal', 'cash', 'BCA', '12345678', 'PT Test');
  EXCEPTION WHEN check_violation THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Kantong cash dengan rekening tidak ditolak!'; END IF;

  -- 2c. Kantong bank sah (dengan provider, rekening, atas nama)
  INSERT INTO public.ptv_finance_pockets (id, name, kind, provider, account_number, account_holder, balance_minor)
  VALUES (v_test_pocket_bank, 'Rekening Operasional Uji', 'bank', 'BSI', '7123456789', 'Yayasan PTV', 0);

  -- 2d. Uji kegagalan: Saldo negatif (harus ditolak)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.ptv_finance_pockets (name, kind, balance_minor)
    VALUES ('Kas Negatif', 'cash', -100);
  EXCEPTION WHEN check_violation THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Saldo negatif tidak ditolak!'; END IF;

  -- 2e. Uji kegagalan: Arsip kantong dengan saldo > 0 (harus ditolak)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.ptv_finance_pockets (name, kind, balance_minor, archived)
    VALUES ('Kas Terarsip Ada Saldo', 'cash', 500000, true);
  EXCEPTION WHEN check_violation THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Arsip kantong bersaldo tidak ditolak!'; END IF;

  RAISE NOTICE '[PASS] Constraint ptv_finance_pockets terverifikasi';

  -- --------------------------------------------------------------------------
  -- 3. UJI CONSTRAINT KATEGORI
  -- --------------------------------------------------------------------------
  INSERT INTO public.ptv_finance_categories (id, name, kind, is_active)
  VALUES (v_test_category_income, 'Donasi Proyek Uji', 'income', true);

  INSERT INTO public.ptv_finance_categories (id, name, kind, is_active)
  VALUES (v_test_category_expense, 'Konsumsi Uji', 'expense', true);

  -- Duplikasi nama dan kind kategori (harus ditolak)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.ptv_finance_categories (name, kind)
    VALUES ('Donasi Proyek Uji', 'income');
  EXCEPTION WHEN unique_violation THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: Duplikasi kategori tidak ditolak!'; END IF;

  RAISE NOTICE '[PASS] Constraint ptv_finance_categories terverifikasi';

  -- --------------------------------------------------------------------------
  -- 4. UJI TRIGGER IMMUTABILITY AUDIT LOG
  -- --------------------------------------------------------------------------
  INSERT INTO public.ptv_finance_audit_log (entity_type, entity_id, action, payload)
  VALUES ('pocket', v_test_pocket_cash, 'create', '{"test": true}'::JSONB);

  v_err_caught := false;
  BEGIN
    UPDATE public.ptv_finance_audit_log SET action = 'tampered' WHERE entity_id = v_test_pocket_cash;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: UPDATE audit log tidak dicegah!'; END IF;

  v_err_caught := false;
  BEGIN
    DELETE FROM public.ptv_finance_audit_log WHERE entity_id = v_test_pocket_cash;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'GAGAL: DELETE audit log tidak dicegah!'; END IF;

  RAISE NOTICE '[PASS] Immutability trigger ptv_finance_audit_log terverifikasi';

  -- --------------------------------------------------------------------------
  -- 5. UJI RPC: PEMASUKAN MULTI-KANTONG (INCOME)
  -- --------------------------------------------------------------------------
  v_res := public.rpc_post_finance_transaction_server(
    v_test_account,
    v_test_session_iat,
    jsonb_build_object(
      'version', 2,
      'idempotencyKey', gen_random_uuid(),
      'operation', 'income',
      'occurredOn', '2026-10-21',
      'description', 'Pemasukan Donasi Terbagi Dua Kantong',
      'currency', 'IDR',
      'amountMinor', 10000000, -- Rp 100.000,00
      'categoryId', v_test_category_income,
      'incoming', jsonb_build_array(
        jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 4000000), -- Rp 40.000
        jsonb_build_object('pocketId', v_test_pocket_bank, 'amountMinor', 6000000)  -- Rp 60.000
      ),
      'outgoing', '[]'::JSONB
    )
  );

  IF (v_res->>'success')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'GAGAL: RPC pemasukan gagal: %', v_res;
  END IF;

  -- Verifikasi saldo kantong bertambah
  SELECT balance_minor INTO v_balance_cash FROM public.ptv_finance_pockets WHERE id = v_test_pocket_cash;
  SELECT balance_minor INTO v_balance_bank FROM public.ptv_finance_pockets WHERE id = v_test_pocket_bank;

  IF v_balance_cash <> 4000000 OR v_balance_bank <> 6000000 THEN
    RAISE EXCEPTION 'GAGAL: Saldo setelah pemasukan tidak cocok! Cash: %, Bank: %', v_balance_cash, v_balance_bank;
  END IF;

  RAISE NOTICE '[PASS] RPC pemasukan multi-kantong berhasil dan saldo bertambah tepat';

  -- --------------------------------------------------------------------------
  -- 6. UJI RPC: TRANSFER INTERNAL ANTAR-KANTONG
  -- --------------------------------------------------------------------------
  v_res := public.rpc_post_finance_transaction_server(
    v_test_account,
    v_test_session_iat,
    jsonb_build_object(
      'version', 2,
      'idempotencyKey', gen_random_uuid(),
      'operation', 'transfer',
      'occurredOn', '2026-10-21',
      'description', 'Transfer Kas ke Bank',
      'currency', 'IDR',
      'amountMinor', 2000000, -- Rp 20.000
      'incoming', jsonb_build_array(
        jsonb_build_object('pocketId', v_test_pocket_bank, 'amountMinor', 2000000)
      ),
      'outgoing', jsonb_build_array(
        jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 2000000)
      )
    )
  );

  IF (v_res->>'success')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'GAGAL: RPC transfer gagal: %', v_res;
  END IF;

  SELECT balance_minor INTO v_balance_cash FROM public.ptv_finance_pockets WHERE id = v_test_pocket_cash;
  SELECT balance_minor INTO v_balance_bank FROM public.ptv_finance_pockets WHERE id = v_test_pocket_bank;

  IF v_balance_cash <> 2000000 OR v_balance_bank <> 8000000 THEN
    RAISE EXCEPTION 'GAGAL: Saldo setelah transfer tidak cocok! Cash: %, Bank: %', v_balance_cash, v_balance_bank;
  END IF;

  RAISE NOTICE '[PASS] RPC transfer internal berhasil dan saldo berpindah tepat';

  -- --------------------------------------------------------------------------
  -- 7. UJI RPC: SALDO TIDAK MENCUKUPI (HARUS DITOLAK)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.rpc_post_finance_transaction_server(
      v_test_account,
      v_test_session_iat,
      jsonb_build_object(
        'version', 2,
        'idempotencyKey', gen_random_uuid(),
        'operation', 'expense',
        'occurredOn', '2026-10-21',
        'description', 'Pengeluaran Melampaui Saldo Kas',
        'currency', 'IDR',
        'amountMinor', 5000000, -- Mencoba menarik Rp 50.000 padahal saldo cash hanya Rp 20.000
        'categoryId', v_test_category_expense,
        'incoming', '[]'::JSONB,
        'outgoing', jsonb_build_array(
          jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 5000000)
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'GAGAL: Pengeluaran melampaui saldo tidak ditolak!';
  END IF;

  RAISE NOTICE '[PASS] Penolakan saldo tidak mencukupi terverifikasi';

  -- --------------------------------------------------------------------------
  -- 8. UJI RPC: IDEMPOTENT REPLAY vs BENTURAN KEY BERBEDA PAYLOAD
  -- --------------------------------------------------------------------------
  DECLARE
    v_first_res JSONB;
    v_replay_res JSONB;
  BEGIN
    -- Pemanggilan pertama
    v_first_res := public.rpc_post_finance_transaction_server(
      v_test_account,
      v_test_session_iat,
      jsonb_build_object(
        'version', 2,
        'idempotencyKey', v_idemp_key,
        'operation', 'expense',
        'occurredOn', '2026-10-21',
        'description', 'Beli Snack Uji Idempotensi',
        'currency', 'IDR',
        'amountMinor', 1000000,
        'categoryId', v_test_category_expense,
        'incoming', '[]'::JSONB,
        'outgoing', jsonb_build_array(
          jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 1000000)
        )
      )
    );

    -- Pemanggilan kedua: Identik persis => HARUS idempotent replay
    v_replay_res := public.rpc_post_finance_transaction_server(
      v_test_account,
      v_test_session_iat,
      jsonb_build_object(
        'version', 2,
        'idempotencyKey', v_idemp_key,
        'operation', 'expense',
        'occurredOn', '2026-10-21',
        'description', 'Beli Snack Uji Idempotensi',
        'currency', 'IDR',
        'amountMinor', 1000000,
        'categoryId', v_test_category_expense,
        'incoming', '[]'::JSONB,
        'outgoing', jsonb_build_array(
          jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 1000000)
        )
      )
    );

    IF (v_replay_res->>'idempotent_replay')::BOOLEAN IS NOT TRUE THEN
      RAISE EXCEPTION 'GAGAL: Idempotent replay tidak terdeteksi pada pemanggilan kedua: %', v_replay_res;
    END IF;

    -- Pastikan saldo hanya terpotong 1 kali (dari Rp 20.000 menjadi Rp 10.000)
    SELECT balance_minor INTO v_balance_cash FROM public.ptv_finance_pockets WHERE id = v_test_pocket_cash;
    IF v_balance_cash <> 1000000 THEN
      RAISE EXCEPTION 'GAGAL: Saldo terpotong ganda pada idempotent replay! Cash: %', v_balance_cash;
    END IF;

    -- Pemanggilan ketiga: Key SAMA namun payload BERBEDA (nominal Rp 5000 bukannya Rp 10000) => HARUS DITOLAK
    v_err_caught := false;
    BEGIN
      PERFORM public.rpc_post_finance_transaction_server(
        v_test_account,
        v_test_session_iat,
        jsonb_build_object(
          'version', 2,
          'idempotencyKey', v_idemp_key,
          'operation', 'expense',
          'occurredOn', '2026-10-21',
          'description', 'Beli Snack Uji Idempotensi Berbeda Nominal',
          'currency', 'IDR',
          'amountMinor', 500000, -- Berbeda!
          'categoryId', v_test_category_expense,
          'incoming', '[]'::JSONB,
          'outgoing', jsonb_build_array(
            jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 500000)
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_err_caught := true;
    END;

    IF NOT v_err_caught THEN
      RAISE EXCEPTION 'GAGAL: Idempotency collision dengan payload berbeda tidak ditolak!';
    END IF;
  END;

  RAISE NOTICE '[PASS] Idempotent replay terverifikasi dan benturan key berbeda payload berhasil ditolak';

  -- --------------------------------------------------------------------------
  -- 5. UJI ANTI-DUPLIKASI ALOKASI (SELF-TRANSFER / KANTONG BERULANG)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.rpc_post_finance_transaction_server(
      v_test_account,
      v_test_session_iat,
      jsonb_build_object(
        'version', 2,
        'idempotencyKey', gen_random_uuid(),
        'operation', 'transfer',
        'occurredOn', '2026-10-21',
        'description', 'Uji Self-Transfer ke Kantong Sama',
        'currency', 'IDR',
        'amountMinor', 100000,
        'incoming', jsonb_build_array(
          jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 100000)
        ),
        'outgoing', jsonb_build_array(
          jsonb_build_object('pocketId', v_test_pocket_cash, 'amountMinor', 100000)
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'GAGAL: Self-transfer dengan kantong asal dan tujuan sama tidak ditolak!';
  END IF;

  RAISE NOTICE '[PASS] Transaksi dengan kantong berulang / self-transfer berhasil ditolak';

  RAISE NOTICE '=== SEMUA UJI VERIFIKASI SELESAI DENGAN SUKSES ===';
END $$;

-- ROLLBACK WAJIB: Bersihkan seluruh fixture pengujian secara bersih
ROLLBACK;
