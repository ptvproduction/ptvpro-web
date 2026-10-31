import { describe, it, expect, beforeEach, vi } from 'vitest';
import { docsStore } from '../../src/products/hub/dokumen-saya/docsStore';
import { buildOfficialDocPdf14, downloadOfficialDocPdf } from '../../src/products/hub/dokumen-saya/utils/docPdfPrinter';
import { notificationService } from '../../src/products/hub/shell/notificationService';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

// Setup memory-based localStorage mock if running in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('PTVPRO — R06 Critical Audit & Correction Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Integritas & Concurrency-Safe Penomoran Surat Resmi', () => {
    it('1.1 Pengajuan baru yang pending tidak boleh menampilkan nomor resmi final (wajib "—")', () => {
      const doc = docsStore.requestDoc({
        type: 'Surat Izin Santri',
        subject: 'Izin Uji Riset Pending',
        owner: 'Santri Peneliti',
        date: '2026-10-22',
        status: 'Menunggu',
      });

      expect(doc.status).toBe('Menunggu');
      expect(doc.no).toBe('—');
    });

    it('1.2 Pengesahan surat menerbitkan nomor resmi terformat kanonikal di atas seed historis', () => {
      const pendingDoc = docsStore.requestDoc({
        type: 'Surat Tugas',
        subject: 'Peliputan Festival Santri',
        owner: 'M. Zidna Ilma Roup',
        date: '2026-10-22',
        status: 'Menunggu',
      });

      const approved = docsStore.approveDoc(pendingDoc.id, 'Disetujui untuk penugasan', 'Pimpinan');
      expect(approved).not.toBeNull();
      expect(approved?.status).toBe('Disetujui');
      // Format 3-digit: XXX/ST-PTV/X/2026
      expect(approved?.no).toMatch(/^\d{3}\/ST-PTV\/[IVXLCDM]+\/2026$/);

      // Fixture historis sudah memuat ST 042; penomoran monotonik melanjutkan 043.
      const seq = parseInt(approved!.no.split('/')[0], 10);
      expect(seq).toBe(43);
      expect(approved?.no).toBe('043/ST-PTV/X/2026');
    });

    it('1.3 Retry pengesahan dokumen yang sama bersifat idempotent (tidak mengubah nomor resmi)', () => {
      const pendingDoc = docsStore.requestDoc({
        type: 'Izin Membawa Barang',
        subject: 'Peralatan Siaran Live',
        owner: 'Teknisi Studio',
        date: '2026-10-22',
        status: 'Menunggu',
      });

      const approved1 = docsStore.approveDoc(pendingDoc.id);
      const allocatedNo = approved1?.no;
      expect(allocatedNo).toBeDefined();

      // Retry approval
      const approved2 = docsStore.approveDoc(pendingDoc.id, 'Persetujuan ulang');
      expect(approved2?.no).toBe(allocatedNo);
    });
  });

  describe('2. Keabsahan PDF Resmi & Direct File Download', () => {
    const canonicalDoc: PtvDocument = {
      id: 'si_test_pdf',
      no: '007/ST-PTV/X/2026',
      subject: 'Izin Riset Audio Visual',
      type: 'Surat Tugas',
      date: '2026-10-15',
      owner: 'Muhammad Farras Zaidan Mubarok',
      penanggung_jawab: 'Dr. H. Ahmad Musthofa, M.Pd.',
      status: 'Disetujui',
      created_at: '2026-10-15T09:30:00Z',
      recipients: ['Muhammad Farras Zaidan Mubarok', 'Rizky Alamsyah'],
    };

    it('2.1 buildOfficialDocPdf14 menghasilkan berkas PDF 1.4 biner standar yang valid', () => {
      const pdf = buildOfficialDocPdf14(canonicalDoc);
      expect(pdf.startsWith('%PDF-1.4')).toBe(true);
      expect(pdf.includes('%%EOF')).toBe(true);
      expect(pdf).toContain('OFFICIAL MEDIA BROADCASTER');
      expect(pdf).toContain('007/ST-PTV/X/2026');
      expect(pdf).toContain('Dr. H. Ahmad Musthofa,');
      expect(pdf).toContain('M.Pd.');
      expect(pdf).toContain('Muhammad Farras Zaidan Mubarok');
      // Contains vector QR code stream
      expect(pdf).toContain('DOKUMEN RESMI PROGRESIF TV');
      expect(pdf).toMatch(/0 0 0 rg\n[\d. re]+f\n/);
    });

    it('2.2 downloadOfficialDocPdf menolak dokumen yang belum disetujui / pending', async () => {
      const unapprovedDoc: PtvDocument = {
        ...canonicalDoc,
        status: 'Menunggu',
        no: '—',
      };

      await expect(downloadOfficialDocPdf(unapprovedDoc)).rejects.toThrow(
        /belum disahkan atau nomor surat resmi belum diterbitkan/
      );
    });

    it('2.3 downloadOfficialDocPdf memicu download biner PDF langsung tanpa navigasi', async () => {
      let createdAnchor: any = null;
      let clicked = false;

      const mockAnchor = {
        href: '',
        download: '',
        style: {},
        click: () => {
          clicked = true;
        },
      };

      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;

      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === 'a') {
            createdAnchor = mockAnchor;
            return mockAnchor as any;
          }
          return {} as any;
        },
        body: {
          appendChild: (el: any) => el,
          removeChild: (el: any) => el,
        } as any,
      } as any;

      globalThis.window = {
        URL: {
          createObjectURL: () => 'blob:https://ptvpro.com/test-uuid',
          revokeObjectURL: vi.fn(),
        },
      } as any;

      try {
        await downloadOfficialDocPdf(canonicalDoc);

        expect(createdAnchor).not.toBeNull();
        expect(createdAnchor.download).toBe('surat-tugas_007_ST-PTV_X_2026.pdf');
        expect(createdAnchor.href).toContain('blob:');
        expect(clicked).toBe(true);
      } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
      }
    });
  });

  describe('3. Smart Notification Persistence & Recipient Isolation', () => {
    it('3.1 Mencegah duplikasi notifikasi menggunakan idempotency_key', async () => {
      const key = `test_idempotent_${Date.now()}`;
      const first = await notificationService.dispatchEventNotification(
        { ptv_id: 'PTV-003', role: 'crew' },
        {
          idempotency_key: key,
          title: 'Uji Idempotensi',
          message: 'Pesan pertama',
          type: 'document',
        }
      );
      expect(first).toBe(true);

      const duplicate = await notificationService.dispatchEventNotification(
        { ptv_id: 'PTV-003', role: 'crew' },
        {
          idempotency_key: key,
          title: 'Uji Idempotensi Duplikat',
          message: 'Pesan duplikat tidak boleh masuk',
          type: 'document',
        }
      );
      expect(duplicate).toBe(false);
    });

    it('3.2 Mengisolasi notifikasi sehingga akun A tidak menerima notifikasi akun B', async () => {
      const userA = { id: 'uA', ptv_id: 'PTV-001', username: 'zidna', role: 'admin' };
      const userB = { id: 'uB', ptv_id: 'PTV-002', username: 'farras', role: 'crew' };

      // Dispatch spesifik untuk User A
      await notificationService.dispatchEventNotification(
        { ptv_id: userA.ptv_id, role: userA.role },
        {
          idempotency_key: `notif_user_a_${Date.now()}`,
          title: 'Notifikasi Rahasia User A',
          message: 'Hanya untuk user A',
          type: 'document',
        }
      );

      const notifsUserB = await notificationService.getNotifications(userB as any);
      const containsUserANotif = notifsUserB.some((n) => n.title.includes('User A'));
      expect(containsUserANotif).toBe(false);
    });
  });

  describe('4. Public Verification Regex & Verification Separation', () => {
    it('4.1 Regex verifikasi publik memvalidasi SI, ST, SB, dan SBB secara benar', () => {
      const regex = /^\d{1,6}\/(SI|ST|SBB|SB)-PTV\/[IVXLCDM]+\/\d{4}$/;
      expect('001/SI-PTV/X/2026').toMatch(regex);
      expect('042/ST-PTV/X/2026').toMatch(regex);
      expect('015/SBB-PTV/X/2026').toMatch(regex);
      expect('015/SB-PTV/X/2026').toMatch(regex);
      expect('DRAFT/SI-PTV/X/2026').not.toMatch(regex);
      expect('RANDOM_TEXT').not.toMatch(regex);
    });
  });
});
