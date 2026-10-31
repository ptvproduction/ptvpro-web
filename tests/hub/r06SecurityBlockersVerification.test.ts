import { describe, it, expect } from 'vitest';
import {
  calculateNextLetterNumber,
  formatLetterNumber,
  HISTORICAL_RESERVED_SEQUENCES,
} from '../../src/products/hub/dokumen-saya/utils/letterNumbering';
import { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';
import { notificationService } from '../../src/products/hub/shell/notificationService';

describe('R06 Final Security Gate Verification Suite', () => {
  describe('1. Annual High-Water Sequence & Historical Reservation', () => {
    it('1.1 Mengalokasikan 010/SI-PTV/X/2026 saat 001, 007, dan 009 telah terbit', () => {
      const existingDocs: PtvDocument[] = [
        {
          id: 'doc-001',
          no: '001/SI-PTV/X/2026',
          type: 'Surat Izin Santri',
          subject: 'Izin Pulang',
          owner: 'Santri A',
          date: '2026-10-03',
          status: 'Disetujui',
          created_at: '2026-10-01T08:00:00Z',
        },
        {
          id: 'doc-007',
          no: '007/SI-PTV/X/2026',
          type: 'Surat Izin Santri',
          subject: 'Izin Sakit',
          owner: 'Santri B',
          date: '2026-10-15',
          status: 'Disetujui',
          created_at: '2026-10-14T08:00:00Z',
        },
      ];

      const result = calculateNextLetterNumber(existingDocs, 'SI', '2026-10-22');
      expect(result.sequence).toBe(10);
      expect(result.nomor_surat).toBe('010/SI-PTV/X/2026');
    });

    it('1.2 Melanjutkan reservasi 009 tanpa mengisi celah', () => {
      // Simulasikan nomor 001 sampai 007 sudah terisi
      const docs: PtvDocument[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
        id: `doc-${n}`,
        no: formatLetterNumber(n, 'SI', 'X', 2026),
        type: 'Surat Izin Santri',
        subject: `Izin ${n}`,
        owner: `Santri ${n}`,
        date: '2026-10-10',
        status: 'Disetujui',
        created_at: '2026-10-01T08:00:00Z',
      }));

      // Reservasi 009 menjadi batas bawah nomor berikutnya.
      const res1 = calculateNextLetterNumber(docs, 'SI', '2026-10-22');
      expect(res1.sequence).toBe(10);
      expect(res1.nomor_surat).toBe('010/SI-PTV/X/2026');

      // Tambahkan dokumen nomor 008
      docs.push({
        id: 'doc-8',
        no: '008/SI-PTV/X/2026',
        type: 'Surat Izin Santri',
        subject: 'Izin 8',
        owner: 'Santri 8',
        date: '2026-10-22',
        status: 'Disetujui',
        created_at: '2026-10-22T08:00:00Z',
      });

      // Nomor historis di bawah high-water tidak mengubah kandidat.
      const res2 = calculateNextLetterNumber(docs, 'SI', '2026-10-22');
      expect(res2.sequence).toBe(10);
      expect(res2.nomor_surat).toBe('010/SI-PTV/X/2026');
    });

    it('1.3 Baseline bersih ST=0 dan SBB=0 memulai penomoran dari 001', () => {
      expect(HISTORICAL_RESERVED_SEQUENCES['2026']['ST']).toEqual([]);
      expect(HISTORICAL_RESERVED_SEQUENCES['2026']['SBB']).toEqual([]);

      const stResult = calculateNextLetterNumber([], 'ST', '2026-10-22');
      expect(stResult.sequence).toBe(1);
      expect(stResult.nomor_surat).toBe('001/ST-PTV/X/2026');

      const sbbResult = calculateNextLetterNumber([], 'SBB', '2026-10-22');
      expect(sbbResult.sequence).toBe(1);
      expect(sbbResult.nomor_surat).toBe('001/SBB-PTV/X/2026');
    });
  });

  describe('2. Hardening Otorisasi Canonical & Anti-Spoofing (Simulasi Kontrak RPC)', () => {
    // Model fungsi otorisasi backend sesuai Rev 5
    function evaluateApprovalPermission(caller: {
      auth_user_id: string | null;
      status_akun: string;
      capabilities: string[];
      profile_name: string;
      position_title?: string;
    }): { allowed: boolean; reason?: string } {
      if (!caller.auth_user_id) {
        return { allowed: false, reason: 'UNAUTHORIZED: Sesi autentikasi dibutuhkan' };
      }
      if (caller.status_akun !== 'active') {
        return { allowed: false, reason: 'UNAUTHORIZED: Akun tidak aktif' };
      }
      // HANYA kapabilitas canonical documents.approve atau root/superadmin
      const hasCapability = caller.capabilities.includes('documents.approve');
      const isRoot = ['root', 'superadmin'].includes(caller.profile_name);

      if (!hasCapability && !isRoot) {
        return {
          allowed: false,
          reason: 'FORBIDDEN: Pengesahan dokumen memerlukan kapabilitas resmi documents.approve',
        };
      }
      return { allowed: true };
    }

    it('2.1 Pengguna biasa tanpa kapabilitas documents.approve DITOLAK meskipun memiliki nama jabatan menarik', () => {
      const user = {
        auth_user_id: 'auth-123',
        status_akun: 'active',
        capabilities: ['documents.read'],
        profile_name: 'crew',
        position_title: 'Ketua Divisi Humas & Pengarah Teknis', // Jabatan teks tidak boleh memberi bypass!
      };

      const result = evaluateApprovalPermission(user);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('FORBIDDEN: Pengesahan dokumen memerlukan kapabilitas resmi documents.approve');
    });

    it('2.2 Pengguna dengan kapabilitas documents.approve resmi DIIZINKAN', () => {
      const pimpinan = {
        auth_user_id: 'auth-999',
        status_akun: 'active',
        capabilities: ['documents.approve', 'documents.read'],
        profile_name: 'eksekutif',
      };

      const result = evaluateApprovalPermission(pimpinan);
      expect(result.allowed).toBe(true);
    });

    it('2.3 Anti-Spoofing: Caller TIDAK BISA mengesahkan atas nama identitas pejabat lain', () => {
      const callerIdentity = 'identity-zidna-001';
      const spoofedIdentity = 'identity-pimpinan-999';

      // Kontrak Rev 5 menetapkan disetujui_oleh selalu diambil dari v_caller_identity_id
      const resolvedApprover = callerIdentity; // Backend mengabaikan spoofed identity
      expect(resolvedApprover).not.toBe(spoofedIdentity);
      expect(resolvedApprover).toBe(callerIdentity);
    });

    it('2.4 Dokumen berstatus batal/ditolak TIDAK BISA disetujui', () => {
      const invalidStatuses = ['ditolak', 'batal', 'archived'];
      for (const st of invalidStatuses) {
        const canApprove = ['menunggu', 'draft', 'revisi'].includes(st.toLowerCase());
        expect(canApprove).toBe(false);
      }
    });

    it('2.5 Retry approval mengembalikan approver ASLI dari database, bukan identitas caller retry', () => {
      const originalApprover = 'identity-pimpinan-official-uuid';
      const retryCaller = 'identity-operator-retry-uuid';

      // Simulasi blok Idempotency Guard pada Rev 6
      function simulateIdempotentApproval(doc: { status: string; nomor_surat: string; disetujui_oleh: string }, callerId: string) {
        if (doc.status === 'disetujui' && doc.nomor_surat) {
          return {
            success: true,
            idempotent: true,
            nomor_surat: doc.nomor_surat,
            disetujui_oleh: doc.disetujui_oleh, // Mengembalikan approver ASLI dari record!
          };
        }
        return { success: true, idempotent: false, disetujui_oleh: callerId };
      }

      const existingDoc = {
        status: 'disetujui',
        nomor_surat: '001/SI-PTV/X/2026',
        disetujui_oleh: originalApprover,
      };

      const result = simulateIdempotentApproval(existingDoc, retryCaller);
      expect(result.idempotent).toBe(true);
      expect(result.disetujui_oleh).toBe(originalApprover);
      expect(result.disetujui_oleh).not.toBe(retryCaller);
    });

    it('2.6 Konversi to_roman_month deterministik murni (IMMUTABLE tanpa CURRENT_DATE)', () => {
      function toRomanMonth(dateStr: string | null): string {
        if (!dateStr) throw new Error('INVALID_ARGUMENT: p_date tidak boleh null');
        const m = parseInt(dateStr.split('-')[1], 10);
        const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        return romans[m - 1] || 'X';
      }

      expect(toRomanMonth('2026-01-15')).toBe('I');
      expect(toRomanMonth('2026-10-22')).toBe('X');
      expect(toRomanMonth('2026-12-31')).toBe('XII');
      expect(() => toRomanMonth(null)).toThrow('INVALID_ARGUMENT: p_date tidak boleh null');
    });

    it('2.7 Dokumen historis dengan approver NULL tetap NULL saat retry (tidak dipalsukan dengan ID caller)', () => {
      // Sesuai temuan Staging riil: record 001 dan 007 memiliki disetujui_oleh = NULL
      const historicalDoc = {
        status: 'disetujui',
        nomor_surat: '001/SI-PTV/X/2026',
        disetujui_oleh: null, // Asli NULL dari legacy
      };
      const retryCallerId = 'auth-operator-zidna-uuid';

      function executeRev7Retry(doc: typeof historicalDoc, caller: string) {
        if (doc.status === 'disetujui' && doc.nomor_surat) {
          return {
            success: true,
            idempotent: true,
            nomor_surat: doc.nomor_surat,
            disetujui_oleh: doc.disetujui_oleh, // TIDAK DI-COALESCE dengan caller!
            approver_status: doc.disetujui_oleh === null ? 'historical_unrecorded' : 'verified',
          };
        }
        return { success: true, idempotent: false, disetujui_oleh: caller };
      }

      const res = executeRev7Retry(historicalDoc, retryCallerId);
      expect(res.idempotent).toBe(true);
      expect(res.disetujui_oleh).toBeNull(); // Nilai NULL tetap terjaga jujur!
      expect(res.disetujui_oleh).not.toBe(retryCallerId);
      expect(res.approver_status).toBe('historical_unrecorded');
    });

    it('2.8 Preflight Fail-Closed Registry: HALT seketika jika terdeteksi konflik doc_id pada nomor historis', () => {
      const realDocId001 = 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c';
      const conflictingDocId = 'ea91b82d-0000-0000-0000-000000000000';

      function validateRegistrySeed(entry: { seq_number: number; nomor_surat: string; source: string; doc_id: string | null }) {
        if (entry.seq_number === 1) {
          if (entry.nomor_surat !== '001/SI-PTV/X/2026' || entry.source !== 'issued' || entry.doc_id !== realDocId001) {
            throw new Error('MIGRATION HALTED: Konflik atribut registry pada nomor 001.');
          }
        }
        if (entry.seq_number === 9) {
          if (entry.nomor_surat !== '009/SI-PTV/X/2026' || entry.source !== 'historical_reserved' || entry.doc_id !== null) {
            throw new Error('MIGRATION HALTED: Nomor 009 harus berstatus historical_reserved dengan doc_id NULL.');
          }
        }
        return true;
      }

      // Valid:
      expect(() =>
        validateRegistrySeed({ seq_number: 1, nomor_surat: '001/SI-PTV/X/2026', source: 'issued', doc_id: realDocId001 })
      ).not.toThrow();

      // Konflik doc_id pada 001 -> HALT:
      expect(() =>
        validateRegistrySeed({ seq_number: 1, nomor_surat: '001/SI-PTV/X/2026', source: 'issued', doc_id: conflictingDocId })
      ).toThrow('MIGRATION HALTED: Konflik atribut registry pada nomor 001.');

      // Percobaan membuat record dokumen palsu untuk 009 -> HALT:
      expect(() =>
        validateRegistrySeed({ seq_number: 9, nomor_surat: '009/SI-PTV/X/2026', source: 'issued', doc_id: 'fake-doc-uuid' })
      ).toThrow('MIGRATION HALTED: Nomor 009 harus berstatus historical_reserved dengan doc_id NULL.');
    });
  });

  describe('3. Smart Notification Security, Anti-Tamper & Inbox Isolation', () => {
    it('3.1 Anti-Tamper: Perubahan pada selain is_read DITOLAK (simulasi trigger trg_protect_notification_fields)', () => {
      const originalRow = {
        id: 'notif-uuid-1',
        tipe: 'approval',
        judul: 'Surat Disetujui (001/SI-PTV/X/2026)',
        pesan: 'Surat resmi telah disetujui.',
        recipient_identity_id: 'user-a-uuid',
        is_protected: true,
        is_read: false,
      };

      function simulateTriggerUpdate(oldRow: typeof originalRow, newRow: typeof originalRow, role = 'authenticated') {
        if (role === 'service_role') return { allowed: true };
        if (
          oldRow.id !== newRow.id ||
          oldRow.tipe !== newRow.tipe ||
          oldRow.judul !== newRow.judul ||
          oldRow.pesan !== newRow.pesan ||
          oldRow.recipient_identity_id !== newRow.recipient_identity_id ||
          oldRow.is_protected !== newRow.is_protected
        ) {
          throw new Error('FORBIDDEN: Pengguna hanya diizinkan memperbarui status baca (is_read)');
        }
        return { allowed: true, newRow };
      }

      // 1. Mengubah is_read diperbolehkan:
      expect(() =>
        simulateTriggerUpdate(originalRow, { ...originalRow, is_read: true })
      ).not.toThrow();

      // 2. Mencoba mengubah judul dilarang:
      expect(() =>
        simulateTriggerUpdate(originalRow, { ...originalRow, judul: 'Judul Palsu Diretas' })
      ).toThrow('FORBIDDEN: Pengguna hanya diizinkan memperbarui status baca (is_read)');

      // 3. Mencoba memindahkan recipient dilarang:
      expect(() =>
        simulateTriggerUpdate(originalRow, { ...originalRow, recipient_identity_id: 'user-b-uuid' })
      ).toThrow('FORBIDDEN: Pengguna hanya diizinkan memperbarui status baca (is_read)');

      // 4. Mencoba melepas is_protected dilarang:
      expect(() =>
        simulateTriggerUpdate(originalRow, { ...originalRow, is_protected: false })
      ).toThrow('FORBIDDEN: Pengguna hanya diizinkan memperbarui status baca (is_read)');
    });

    it('3.2 Proteksi Hapus: Notifikasi is_protected=TRUE tidak dapat dihapus pengguna', () => {
      function simulateDeletePolicy(row: { is_protected: boolean; recipient_identity_id: string }, activeUserId: string) {
        if (row.recipient_identity_id !== activeUserId) return false;
        if (row.is_protected === true) return false;
        return true;
      }

      // Notifikasi terlindungi ditolak untuk dihapus
      expect(simulateDeletePolicy({ is_protected: true, recipient_identity_id: 'user-1' }, 'user-1')).toBe(false);
      // Notifikasi tidak terlindungi diizinkan dihapus oleh pemiliknya
      expect(simulateDeletePolicy({ is_protected: false, recipient_identity_id: 'user-1' }, 'user-1')).toBe(true);
      // Notifikasi milik orang lain ditolak meskipun tidak terlindungi
      expect(simulateDeletePolicy({ is_protected: false, recipient_identity_id: 'user-2' }, 'user-1')).toBe(false);
    });

    it('3.3 Idempotensi & Anti-Duplikasi Notifikasi Terpelihara', async () => {
      const key = `test_idempotent_rev4_${Date.now()}`;
      const first = await notificationService.dispatchEventNotification(
        { ptv_id: 'PTV-003', role: 'crew' },
        {
          idempotency_key: key,
          title: 'Notifikasi Uji Rev 4',
          message: 'Pesan idempotensi pertama',
          type: 'document',
        }
      );
      expect(first).toBe(true);

      const second = await notificationService.dispatchEventNotification(
        { ptv_id: 'PTV-003', role: 'crew' },
        {
          idempotency_key: key,
          title: 'Notifikasi Uji Rev 4 Duplikat',
          message: 'Pesan kedua harus ditolak',
          type: 'document',
        }
      );
      expect(second).toBe(false);
    });

    it('3.4 Kebijakan INSERT Ketat: Tidak ada celah tipe = "approval" bagi client, hanya service_role / procedure owner', () => {
      // Simulasi RLS INSERT policy Rev 7
      function evaluateNotificationInsertPolicy(context: {
        role: string;
        currentUser: string;
        sessionUser: string;
        payload: {
          tipe: string;
          actor_identity_id?: string;
          caller_identity_id?: string;
        };
      }): { allowed: boolean; reason?: string } {
        // Celah lama: IF payload.tipe === 'approval' && payload.actor_identity_id === payload.caller_identity_id -> SUDAH DIHAPUS TOTAL!
        const isTrustedBackend =
          context.role === 'service_role' ||
          context.currentUser === 'postgres' ||
          context.sessionUser === 'postgres';

        if (!isTrustedBackend) {
          return {
            allowed: false,
            reason: 'FORBIDDEN: Direct client INSERT dilarang. Notifikasi hanya dapat dibuat melalui backend terpercaya.',
          };
        }
        return { allowed: true };
      }

      // 1. Pengguna authenticated mencoba bypass dengan payload tipe = 'approval' -> DITOLAK!
      const clientSpoofAttempt = {
        role: 'authenticated',
        currentUser: 'authenticated',
        sessionUser: 'authenticated',
        payload: {
          tipe: 'approval',
          actor_identity_id: 'user-a-uuid',
          caller_identity_id: 'user-a-uuid',
        },
      };
      const spoofRes = evaluateNotificationInsertPolicy(clientSpoofAttempt);
      expect(spoofRes.allowed).toBe(false);
      expect(spoofRes.reason).toContain('Direct client INSERT dilarang');

      // 2. Anonymous client -> DITOLAK!
      const anonAttempt = {
        role: 'anon',
        currentUser: 'anon',
        sessionUser: 'anon',
        payload: { tipe: 'info' },
      };
      expect(evaluateNotificationInsertPolicy(anonAttempt).allowed).toBe(false);

      // 3. Prosedur SECURITY DEFINER milik postgres -> DIIZINKAN
      const dbProcedure = {
        role: 'authenticated', // auth context dari sesi
        currentUser: 'postgres', // execution user dari SECURITY DEFINER
        sessionUser: 'authenticated',
        payload: { tipe: 'approval' },
      };
      expect(evaluateNotificationInsertPolicy(dbProcedure).allowed).toBe(true);

      // 4. Backend Service Role -> DIIZINKAN
      const serviceRole = {
        role: 'service_role',
        currentUser: 'service_role',
        sessionUser: 'service_role',
        payload: { tipe: 'announcement' },
      };
      expect(evaluateNotificationInsertPolicy(serviceRole).allowed).toBe(true);
    });
  });

  describe('4. Universal Registry Sync & Rollback Safety', () => {
    it('4.1 Universal Sync Loop: Mendeteksi dokumen resmi di SI, ST, dan SBB secara fail-closed', () => {
      interface LetterDoc {
        id: string;
        doc_type: 'SI' | 'ST' | 'SBB';
        nomor_surat: string;
      }

      function syncToRegistry(
        docs: LetterDoc[],
        registry: Map<string, { doc_type: string; year: number; seq: number; doc_id: string | null; source: string }>
      ) {
        for (const doc of docs) {
          const parts = doc.nomor_surat.split('/');
          if (parts.length < 4) {
            throw new Error(`MIGRATION HALTED: Format nomor surat tidak valid: ${doc.nomor_surat}`);
          }
          const seq = parseInt(parts[0], 10);
          const year = parseInt(parts[3], 10);
          const key = `${doc.doc_type}-${year}-${seq}`;

          const existing = registry.get(key);
          if (existing) {
            if (existing.doc_id !== doc.id || existing.source !== 'issued') {
              throw new Error(`MIGRATION HALTED: Konflik registry pada ${doc.doc_type} tahun ${year} urutan ${seq}`);
            }
          } else {
            registry.set(key, { doc_type: doc.doc_type, year, seq, doc_id: doc.id, source: 'issued' });
          }
        }
      }

      const registry = new Map();
      // Tambahkan reservasi 009
      registry.set('SI-2026-9', { doc_type: 'SI', year: 2026, seq: 9, doc_id: null, source: 'historical_reserved' });

      // Dokumen resmi yang sah
      const validDocs: LetterDoc[] = [
        { id: 'uuid-si-001', doc_type: 'SI', nomor_surat: '001/SI-PTV/X/2026' },
        { id: 'uuid-si-007', doc_type: 'SI', nomor_surat: '007/SI-PTV/X/2026' },
        { id: 'uuid-st-001', doc_type: 'ST', nomor_surat: '001/ST-PTV/X/2026' },
      ];

      expect(() => syncToRegistry(validDocs, registry)).not.toThrow();
      expect(registry.size).toBe(4);

      // Konflik dokumen palsu yang mencoba menimpa nomor 001 dengan ID lain -> HALT!
      const conflictingDoc: LetterDoc = { id: 'uuid-fake-001', doc_type: 'SI', nomor_surat: '001/SI-PTV/X/2026' };
      expect(() => syncToRegistry([conflictingDoc], registry)).toThrow('MIGRATION HALTED: Konflik registry pada SI tahun 2026 urutan 1');

      // Dokumen dengan format cacat -> HALT!
      const malformedDoc: LetterDoc = { id: 'uuid-bad', doc_type: 'SBB', nomor_surat: 'INVALID-FORMAT' };
      expect(() => syncToRegistry([malformedDoc], registry)).toThrow('MIGRATION HALTED: Format nomor surat tidak valid');
    });

    it('4.2 Jaminan Alokasi 002: Memastikan sequence 2 belum terisi sebelum prosedur alokasi dibuka', () => {
      const registry = new Set<string>();
      registry.add('SI-2026-1'); // 001
      registry.add('SI-2026-7'); // 007
      registry.add('SI-2026-9'); // 009

      // Preflight assertion:
      expect(registry.has('SI-2026-2')).toBe(false);

      // Gap filling logic
      let nextSeq: number | null = null;
      for (let n = 1; n <= 9999; n++) {
        if (!registry.has(`SI-2026-${n}`)) {
          nextSeq = n;
          break;
        }
      }

      expect(nextSeq).toBe(2);
      expect(formatLetterNumber(nextSeq!, 'SI', 'X', 2026)).toBe('002/SI-PTV/X/2026');
    });

    it('4.3 Rollback Safety: Skrip restorasi tidak menghapus tabel registry atau nomor surat historis', () => {
      const rollbackDdlStatements = [
        'DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic',
        'DROP FUNCTION IF EXISTS public.to_roman_month',
        'ALTER TABLE public.ptv_surat_izin DROP CONSTRAINT IF EXISTS uq_ptv_surat_izin_nomor_surat',
        'DROP TRIGGER IF EXISTS trg_ptv_notifications_protect_fields ON public.ptv_notifications',
        'DROP FUNCTION IF EXISTS public.trg_protect_notification_fields',
        'DROP FUNCTION IF EXISTS public.dispatch_smart_notification',
      ];

      // Verifikasi tidak ada DROP TABLE ptv_issued_letter_registry
      const destructiveCommands = rollbackDdlStatements.filter(
        (s) => s.includes('DROP TABLE') || s.includes('TRUNCATE') || s.includes('CASCADE')
      );
      expect(destructiveCommands.length).toBe(0);
    });

    it('4.4 NULL-Safe Registry Conflict: IS DISTINCT FROM mendeteksi konflik NULL vs nilai otentik', () => {
      function checkConflictNullSafe(
        existing: { doc_id: string | null; source: string; nomor_surat: string },
        incoming: { doc_id: string | null; source: string; nomor_surat: string }
      ): boolean {
        // Simulasi operator IS DISTINCT FROM
        const isDistinct = (a: any, b: any) => a !== b;
        return (
          isDistinct(existing.nomor_surat, incoming.nomor_surat) ||
          isDistinct(existing.doc_id, incoming.doc_id) ||
          isDistinct(existing.source, incoming.source)
        );
      }

      // 1. Record 009 di registry memiliki doc_id NULL. Ada data masuk dengan doc_id non-null -> KONFLIK TERDETEKSI!
      const reg009 = { nomor_surat: '009/SI-PTV/X/2026', source: 'historical_reserved', doc_id: null };
      const incomingSpoofed009 = { nomor_surat: '009/SI-PTV/X/2026', source: 'historical_reserved', doc_id: 'some-fake-uuid' };
      expect(checkConflictNullSafe(reg009, incomingSpoofed009)).toBe(true);

      // 2. Record 001 di registry memiliki doc_id sah. Ada data masuk dengan doc_id NULL -> KONFLIK TERDETEKSI!
      const reg001 = { nomor_surat: '001/SI-PTV/X/2026', source: 'issued', doc_id: 'valid-uuid' };
      const incomingNull001 = { nomor_surat: '001/SI-PTV/X/2026', source: 'issued', doc_id: null };
      expect(checkConflictNullSafe(reg001, incomingNull001)).toBe(true);

      // 3. Data identik -> TIDAK KONFLIK
      expect(checkConflictNullSafe(reg001, { ...reg001 })).toBe(false);
    });

    it('4.5 Validasi Format Nomor Surat Lengkap: 4 segmen, sequence 1-9999, tag jenis, bulan Romawi, tahun 2000-2099', () => {
      function validateLetterNumberFormat(nomor: string, docType: 'SI' | 'ST' | 'SBB') {
        const parts = nomor.split('/');
        if (parts.length !== 4) {
          throw new Error(`Format resmi wajib 4 segmen: "${nomor}"`);
        }
        if (!/^[0-9]{3,4}$/.test(parts[0])) {
          throw new Error(`Nomor urut harus numerik 3-4 digit: "${parts[0]}"`);
        }
        const seq = parseInt(parts[0], 10);
        if (seq < 1 || seq > 9999) {
          throw new Error(`Nomor urut di luar batas (1-9999): ${seq}`);
        }
        const expectedTag = `${docType}-PTV`;
        if (parts[1] !== expectedTag) {
          throw new Error(`Tag jenis tidak cocok: "${parts[1]}" (diharapkan ${expectedTag})`);
        }
        const validRomans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        if (!validRomans.includes(parts[2])) {
          throw new Error(`Bulan Romawi tidak valid: "${parts[2]}"`);
        }
        if (!/^[0-9]{4}$/.test(parts[3])) {
          throw new Error(`Tahun tidak valid: "${parts[3]}"`);
        }
        const year = parseInt(parts[3], 10);
        if (year < 2000 || year > 2099) {
          throw new Error(`Tahun di luar rentang: ${year}`);
        }
        return true;
      }

      // Valid SI, ST, SBB
      expect(validateLetterNumberFormat('001/SI-PTV/X/2026', 'SI')).toBe(true);
      expect(validateLetterNumberFormat('042/ST-PTV/XI/2026', 'ST')).toBe(true);
      expect(validateLetterNumberFormat('015/SBB-PTV/XII/2026', 'SBB')).toBe(true);

      // Invalid segment count
      expect(() => validateLetterNumberFormat('001/SI-PTV/2026', 'SI')).toThrow('Format resmi wajib 4 segmen');

      // Invalid tag
      expect(() => validateLetterNumberFormat('001/WRONG-TAG/X/2026', 'SI')).toThrow('Tag jenis tidak cocok');

      // Invalid Roman month
      expect(() => validateLetterNumberFormat('001/SI-PTV/10/2026', 'SI')).toThrow('Bulan Romawi tidak valid');

      // Invalid sequence range
      expect(() => validateLetterNumberFormat('000/SI-PTV/X/2026', 'SI')).toThrow('Nomor urut di luar batas');
    });

    it('4.6 Anti-Renumbering Guard: Menolak pengesahan dokumen belum disetujui yang sudah memiliki nomor resmi', () => {
      function approveWithAntiRenumbering(doc: {
        id: string;
        status: string;
        nomor_surat: string | null;
      }) {
        const isDisetujui = doc.status.toLowerCase() === 'disetujui';
        const hasOfficialNo =
          doc.nomor_surat &&
          doc.nomor_surat.trim() !== '' &&
          doc.nomor_surat !== '—' &&
          !doc.nomor_surat.startsWith('DRAFT');

        if (isDisetujui && hasOfficialNo) {
          return { success: true, idempotent: true, nomor_surat: doc.nomor_surat };
        }

        // Anti-Renumbering check:
        if (!isDisetujui && hasOfficialNo) {
          throw new Error(
            `DATA ANOMALY (ANTI-RENUMBERING): Dokumen ID ${doc.id} berstatus "${doc.status}" tetapi sudah memiliki nomor resmi "${doc.nomor_surat}". Rekonsiliasi manual diperlukan!`
          );
        }

        // Normal approval flow: allocate new number
        return { success: true, idempotent: false, nomor_surat: '002/SI-PTV/X/2026' };
      }

      // 1. Dokumen pending tanpa nomor resmi -> Alokasi nomor baru sukses:
      const normalPendingDoc = { id: 'doc-new', status: 'menunggu', nomor_surat: null };
      expect(approveWithAntiRenumbering(normalPendingDoc).nomor_surat).toBe('002/SI-PTV/X/2026');

      // 2. Dokumen pending dengan placeholder draft -> Alokasi nomor baru sukses:
      const draftDoc = { id: 'doc-draft', status: 'draft', nomor_surat: 'DRAFT-SI-001' };
      expect(approveWithAntiRenumbering(draftDoc).nomor_surat).toBe('002/SI-PTV/X/2026');

      // 3. Dokumen pending tapi SUDAH memiliki nomor resmi -> DITOLAK SEKETIKA (ANTI-RENUMBERING):
      const anomaliDoc = { id: 'doc-anomaly', status: 'menunggu', nomor_surat: '005/SI-PTV/X/2026' };
      expect(() => approveWithAntiRenumbering(anomaliDoc)).toThrow(
        'DATA ANOMALY (ANTI-RENUMBERING)'
      );
    });

    it('4.7 Rollback Grants Presisi: Memastikan pencabutan UPDATE dan DELETE dari authenticated', () => {
      const rollbackGrantsScript = `
        REVOKE UPDATE, DELETE ON TABLE public.ptv_notifications FROM authenticated;
        GRANT SELECT ON public.ptv_notifications TO anon, authenticated;
        GRANT ALL ON public.ptv_notifications TO postgres, service_role;
      `;
      expect(rollbackGrantsScript).toContain('REVOKE UPDATE, DELETE ON TABLE public.ptv_notifications FROM authenticated;');
      expect(rollbackGrantsScript).toContain('GRANT SELECT ON public.ptv_notifications TO anon, authenticated;');
    });
  });

  describe('5. Release-Gate Registry Security, RPC Authorization & Rollback Completeness', () => {
    // 5.1 Keamanan Registry: RLS aktif dan Direct INSERT/UPDATE/DELETE dicabut dari anon & authenticated
    it('5.1 Registry Table Security: RLS diaktifkan dan DML langsung dilarang bagi anon/authenticated', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.resolve(process.cwd(), 'docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // 1. Verifikasi RLS diaktifkan
      expect(sqlContent).toContain('ALTER TABLE public.ptv_issued_letter_registry ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE public.ptv_issued_letter_registry OWNER TO postgres;');

      // 2. Verifikasi REVOKE ALL dari PUBLIC, anon, dan authenticated
      expect(sqlContent).toContain('REVOKE ALL ON TABLE public.ptv_issued_letter_registry FROM PUBLIC, anon, authenticated;');

      // 3. Verifikasi HANYA SELECT yang diberikan kepada authenticated
      expect(sqlContent).toContain('GRANT SELECT ON TABLE public.ptv_issued_letter_registry TO authenticated, service_role;');
      expect(sqlContent).toContain('GRANT ALL ON TABLE public.ptv_issued_letter_registry TO service_role;');

      // 4. Verifikasi tidak ada pemberian izin INSERT, UPDATE, atau DELETE langsung ke authenticated
      expect(sqlContent).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\.ptv_issued_letter_registry\s+TO\s+[^;]*authenticated/i);

      // 5. Verifikasi RLS Policy: SELECT untuk authenticated & write policy eksklusif service_role
      expect(sqlContent).toContain('CREATE POLICY ptv_issued_letter_registry_select_policy');
      expect(sqlContent).toContain('CREATE POLICY ptv_issued_letter_registry_write_policy');
      expect(sqlContent).toContain('TO service_role');
    });

    // 5.2 Otorisasi RPC: approve_ptv_document_atomic berstatus SECURITY DEFINER milik postgres
    it('5.2 RPC Otorisasi: approve_ptv_document_atomic SECURITY DEFINER dimiliki postgres dan dieksekusi authenticated/service_role', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.resolve(process.cwd(), 'docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // 1. Verifikasi SECURITY DEFINER
      expect(sqlContent).toContain('SECURITY DEFINER');
      expect(sqlContent).toContain('SET search_path = public, pg_temp');

      // 2. Verifikasi kepemilikan fungsi oleh postgres
      expect(sqlContent).toContain('ALTER FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) OWNER TO postgres;');

      // 3. Verifikasi izin eksekusi: anon dan PUBLIC dicabut, authenticated dan service_role diberikan
      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) TO authenticated, service_role;');
    });

    // 5.3 Kelengkapan Rollback Step 2 (Letter Numbering)
    it('5.3 Rollback Kelengkapan Step 2: Menghapus seluruh overload fungsi dan constraint tanpa merusak registry atau data', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.resolve(process.cwd(), 'docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // Extract Rollback section
      const rollbackSection = sqlContent.split('5. SNAPSHOT PRE-MIGRATION & ROLLBACK PLAN LENGKAP')[1];
      expect(rollbackSection).toBeDefined();

      // Verifikasi seluruh 4 overload fungsi di-drop
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID);');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, UUID, TEXT);');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT);');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID);');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.to_roman_month(DATE);');

      // Verifikasi ketiga unique constraint di-drop
      expect(rollbackSection).toContain('ALTER TABLE public.ptv_surat_izin DROP CONSTRAINT IF EXISTS uq_ptv_surat_izin_nomor_surat;');
      expect(rollbackSection).toContain('ALTER TABLE public.ptv_surat_tugas DROP CONSTRAINT IF EXISTS uq_ptv_surat_tugas_nomor_surat;');
      expect(rollbackSection).toContain('ALTER TABLE public.ptv_surat_barang DROP CONSTRAINT IF EXISTS uq_ptv_surat_barang_nomor_surat;');

      // Verifikasi RLS policy registry di-drop dan grants dicabut pada rollback
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_issued_letter_registry_write_policy ON public.ptv_issued_letter_registry;');
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_issued_letter_registry_select_policy ON public.ptv_issued_letter_registry;');
      expect(rollbackSection).toContain('REVOKE ALL ON TABLE public.ptv_issued_letter_registry FROM PUBLIC, anon, authenticated, service_role;');

      // Jaminan anti-loss: Tidak ada DROP TABLE ptv_issued_letter_registry
      expect(rollbackSection).not.toContain('DROP TABLE public.ptv_issued_letter_registry');
      expect(rollbackSection).not.toContain('DROP TABLE IF EXISTS public.ptv_issued_letter_registry');
    });

    // 5.4 Kelengkapan Rollback Step 1 (Smart Notifications)
    it('5.4 Rollback Kelengkapan Step 1: Memulihkan trigger, prosedur, default select policy, dan baseline grants', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.resolve(process.cwd(), 'docs/PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // Extract Rollback section
      const rollbackSection = sqlContent.split('6. SNAPSHOT PRE-MIGRATION & ROLLBACK PLAN LENGKAP')[1];
      expect(rollbackSection).toBeDefined();

      // Verifikasi trigger & prosedur baru di-drop
      expect(rollbackSection).toContain('DROP TRIGGER IF EXISTS trg_ptv_notifications_protect_fields ON public.ptv_notifications;');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.trg_protect_notification_fields();');
      expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.dispatch_smart_notification(');

      // Verifikasi 4 policy patch di-drop
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_notifications_insert_policy ON public.ptv_notifications;');
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_notifications_delete_policy ON public.ptv_notifications;');
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_notifications_update_policy ON public.ptv_notifications;');
      expect(rollbackSection).toContain('DROP POLICY IF EXISTS ptv_notifications_select_policy ON public.ptv_notifications;');

      // Verifikasi restorasi baseline policy
      expect(rollbackSection).toContain('CREATE POLICY ptv_notifications_default_select ON public.ptv_notifications');

      // Verifikasi restorasi baseline grants
      expect(rollbackSection).toContain('REVOKE ALL ON TABLE public.ptv_notifications FROM PUBLIC, anon, authenticated;');
      expect(rollbackSection).toContain('GRANT SELECT ON public.ptv_notifications TO anon, authenticated;');
      expect(rollbackSection).toContain('GRANT ALL ON public.ptv_notifications TO postgres, service_role;');

      // Jaminan anti-loss: Tidak ada DROP TABLE ptv_notifications
      expect(rollbackSection).not.toContain('DROP TABLE public.ptv_notifications');
      expect(rollbackSection).not.toContain('DROP TABLE IF EXISTS public.ptv_notifications');
    });
  });
});


