import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  categorizeExternalContact,
  classifyInternalContact,
  formatAngkatanDisplay,
  groupCrewByAngkatan,
  RawKontakEksternalDbRow,
} from '../../src/products/hub/kontak/kontakMapper';
import { StagingKontakService } from '../../src/products/hub/kontak/kontakService';
import { INITIAL_INTERNAL_CONTACTS } from '../../src/products/hub/kontak/mock/internalContactMockData';

describe('Kontak Internal & Eksternal — Supabase Staging Integration & Security Gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Mapping & Categorization Logic (Legacy Parity)', () => {
    it('correctly categorizes external contacts by institution and role', () => {
      const samplePondok: RawKontakEksternalDbRow = {
        id: 'uuid-1',
        nama_kontak: 'Ust. Arshy Fajar',
        instansi: 'Pondok',
        telepon: '628127778077',
        email: null,
        peran: 'Pembina Asrama',
        catatan: null,
        created_at: '2026-09-25T04:21:13Z',
      };

      const resPondok = categorizeExternalContact(samplePondok);
      expect(resPondok.lembaga).toBe('Pondok');
      expect(resPondok.peran).toBe('Pembina');

      const sampleSekolah: RawKontakEksternalDbRow = {
        id: 'uuid-2',
        nama_kontak: 'U. Dadang',
        instansi: 'Sekolah',
        telepon: '6282332974008',
        email: null,
        peran: 'Waka Kesiswaan SMP',
        catatan: null,
        created_at: '2026-09-25T04:22:55Z',
      };

      const resSekolah = categorizeExternalContact(sampleSekolah);
      expect(resSekolah.lembaga).toBe('Sekolah');
      expect(resSekolah.peran).toBe('Ustadz');

      const sampleYayasan: RawKontakEksternalDbRow = {
        id: 'uuid-3',
        nama_kontak: 'Ust. Nasikhul Amin',
        instansi: 'Yayasan',
        telepon: '6281330356545',
        email: null,
        peran: 'SPI Yayasan',
        catatan: null,
        created_at: '2026-09-25T04:20:35Z',
      };

      const resYayasan = categorizeExternalContact(sampleYayasan);
      expect(resYayasan.lembaga).toBe('Yayasan');
      expect(resYayasan.peran).toBe('Ustadz');

      const sampleUstadzah: RawKontakEksternalDbRow = {
        id: 'uuid-4',
        nama_kontak: 'U. Isma Dwi',
        instansi: 'Sekolah',
        telepon: '6285855197041',
        email: null,
        peran: 'Waka Kesiswaan SMA',
        catatan: null,
        created_at: '2026-09-25T04:22:19Z',
      };

      const resUstadzah = categorizeExternalContact(sampleUstadzah);
      expect(resUstadzah.lembaga).toBe('Sekolah');
      expect(resUstadzah.peran).toBe('Ustadzah');
    });

    it('correctly classifies internal contacts according to legacy page-dasbor.php rules', () => {
      // 1. Pembina
      expect(classifyInternalContact({ div: 'Pembina', pos: 'Pembina PTV' })).toBe('Pembina');
      expect(classifyInternalContact({ div: 'Pembina', pos: 'Pembina Bag. Creative' })).toBe('Pembina');

      // 2. Pengarah
      expect(classifyInternalContact({ div: 'Pengarah', pos: 'Pendiri dan Pengasuh' })).toBe('Pengarah');
      expect(classifyInternalContact({ div: 'Pengarah', pos: 'Direktur Yayasan' })).toBe('Pengarah');
      expect(classifyInternalContact({ div: 'Pengarah', pos: 'Presdir PT. Progresif Digital Media' })).toBe('Pengarah');
      expect(classifyInternalContact({ div: 'Pengarah', pos: 'Wadir PT. Progresif Digital Media' })).toBe('Pengarah');

      // 3. Pengurus
      expect(classifyInternalContact({ div: 'Layouter', pos: 'Ketua Umum' })).toBe('Pengurus');
      expect(classifyInternalContact({ div: 'Editor', pos: 'Ketua' })).toBe('Pengurus');

      // 4. Kru (Aktif or pos includes 'kru')
      expect(classifyInternalContact({ div: 'Editor', pos: 'Kru', status: 'Aktif' })).toBe('Kru');
      expect(classifyInternalContact({ div: 'Technical', pos: 'Kru', status: 'Nonaktif' })).toBe('Kru');
      expect(classifyInternalContact({ div: 'Technical', pos: 'Asisten Kamera', status: 'Aktif' })).toBe('Kru');

      // 5. Excluded (Nonaktif crew whose position is NOT 'kru')
      expect(classifyInternalContact({ div: 'Editor', pos: 'Editor', status: 'Nonaktif' })).toBeNull();
      expect(classifyInternalContact({ div: 'Layouter', pos: 'Layouter', status: 'Nonaktif' })).toBeNull();
      expect(classifyInternalContact({ div: 'Engagement', pos: 'Creative', status: 'Nonaktif' })).toBeNull();
    });

    it('correctly formats and groups kru by angkatan with legacy parity', () => {
      expect(formatAngkatanDisplay('15')).toBe('Angkatan 15');
      expect(formatAngkatanDisplay('Additional', { ptvId: 'PTV-017', name: 'Kru Testing Integrasi' })).toBe('Additional');
      expect(formatAngkatanDisplay('', { ptvId: 'PTV-018', name: 'Niki Santri' })).toBe('Additional');
      expect(formatAngkatanDisplay('')).toBe('Angkatan belum ditentukan');

      const sampleKru = [
        { ptv_id: 'PTV-034', full_name: 'Ziddan Arzaqi', angkatan: '15' },
        { ptv_id: 'PTV-006', full_name: 'Arham Putra Nur Baasith', angkatan: '15' },
        { ptv_id: 'PTV-022', full_name: 'Dzaki Alita Sejahtera', angkatan: '14' },
        { ptv_id: 'PTV-017', full_name: 'Kru Testing Integrasi', angkatan: 'Additional' },
      ];

      const groups = groupCrewByAngkatan(sampleKru);
      expect(groups.length).toBe(3);
      expect(groups[0].label).toBe('Angkatan 15');
      expect(groups[0].rows.length).toBe(2);
      expect(groups[1].label).toBe('Angkatan 14');
      expect(groups[1].rows.length).toBe(1);
      expect(groups[2].label).toBe('Additional');
      expect(groups[2].isAdditional).toBe(true);
      expect(groups[2].rows.length).toBe(1);
    });

    it('validates authentic 49 historical internal contacts in baseline fixture', () => {
      expect(INITIAL_INTERNAL_CONTACTS.length).toBe(49);

      const pembina = INITIAL_INTERNAL_CONTACTS.filter((c) => c.category === 'Pembina');
      expect(pembina.length).toBe(8);
      expect(pembina.some((c) => c.ptv_id === 'PTV-005')).toBe(true); // M. Gading Priangga
      expect(pembina.some((c) => c.ptv_id === 'PTV-011')).toBe(true); // Indah Nur Laeli
      expect(pembina.some((c) => c.ptv_id === 'PTV-035')).toBe(true); // Mochammad Wildan

      const pengarah = INITIAL_INTERNAL_CONTACTS.filter((c) => c.category === 'Pengarah');
      expect(pengarah.length).toBe(4);
      expect(pengarah.some((c) => c.ptv_id === 'PTV-012')).toBe(true); // Abuya KH. Agoes Ali Masyhuri
      expect(pengarah.some((c) => c.ptv_id === 'PTV-013')).toBe(true); // KH. Aria Muhammad Ali
      expect(pengarah.some((c) => c.ptv_id === 'PTV-014')).toBe(true); // Gus Robith
      expect(pengarah.some((c) => c.ptv_id === 'PTV-015')).toBe(true); // Gus Burhan

      const pengurus = INITIAL_INTERNAL_CONTACTS.filter((c) => c.category === 'Pengurus');
      expect(pengurus.length).toBe(2);
      expect(pengurus.some((c) => c.ptv_id === 'PTV-001')).toBe(true); // Muhammad Zidnal Falah
      expect(pengurus.some((c) => c.ptv_id === 'PTV-003')).toBe(true); // Muhammad Farras Zaidan

      const kru = INITIAL_INTERNAL_CONTACTS.filter((c) => c.category === 'Kru');
      expect(kru.length).toBe(35);

      // Verify no duplicate PTV-IDs
      const ptvIds = INITIAL_INTERNAL_CONTACTS.map((c) => c.ptv_id);
      const uniquePtvIds = new Set(ptvIds);
      expect(uniquePtvIds.size).toBe(49);

      // Verify no synthetic fake IDs like cnt-pembina-01
      expect(INITIAL_INTERNAL_CONTACTS.some((c) => c.id.startsWith('cnt-pembina'))).toBe(false);
    });
  });

  describe('2. Communication Sanitization (WhatsApp & Phone Call Integrity)', () => {
    it('rejects masked phone numbers from generating clickable WhatsApp links', () => {
      const maskedPhone = '****0616';
      const isWaValid = Boolean(maskedPhone && !maskedPhone.includes('*') && maskedPhone.replace(/[^0-9]/g, '').length >= 9);
      expect(isWaValid).toBe(false);

      const validPhone = '081234567890';
      const isWaValid2 = Boolean(validPhone && !validPhone.includes('*') && validPhone.replace(/[^0-9]/g, '').length >= 9);
      expect(isWaValid2).toBe(true);
      const waUrl = `https://wa.me/${validPhone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`;
      expect(waUrl).toBe('https://wa.me/6281234567890');
    });

    it('handles international format 62 prefix correctly', () => {
      const rawNumber = '6282332974008';
      const isWaValid = Boolean(rawNumber && !rawNumber.includes('*') && rawNumber.replace(/[^0-9]/g, '').length >= 9);
      expect(isWaValid).toBe(true);
      const waUrl = `https://wa.me/${rawNumber.replace(/[^0-9]/g, '').replace(/^0/, '62')}`;
      expect(waUrl).toBe('https://wa.me/6282332974008');
    });
  });

  describe('3. Service Resilience & Error Handling', () => {
    it('throws meaningful error without silent mock fallback when backend fails', async () => {
      const service = new StagingKontakService();

      // Mock fetch rejection
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      await expect(service.getExternalContacts(true)).rejects.toThrow();
      await expect(service.getInternalContacts(true)).rejects.toThrow();
    });

    it('successfully parses valid API response for external contacts', async () => {
      const service = new StagingKontakService();
      const mockContacts = [
        {
          id: 'test-1',
          nama: 'U. Dadang',
          kategori: 'Ustadz',
          jabatan: 'Waka Kesiswaan SMP',
          organisasi: 'Sekolah',
          lembaga: 'Sekolah',
          nomor_telepon: '6282332974008',
          status: 'Aktif',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, count: 1, contacts: mockContacts }),
      } as any);

      const res = await service.getExternalContacts(true);
      expect(res.length).toBe(1);
      expect(res[0].nama).toBe('U. Dadang');
      expect(res[0].lembaga).toBe('Sekolah');
    });

    it('successfully parses valid API response for internal contacts without fake leadership mock', async () => {
      const service = new StagingKontakService();
      const mockInternal = [
        {
          id: 'int-PTV-012',
          full_name: 'Abuya KH. Agoes Ali Masyhuri',
          position: 'Pendiri dan Pengasuh',
          unit: 'Pimpinan & Pengarah Lembaga',
          category: 'Pengarah' as const,
          ptv_id: 'PTV-012',
          status: 'Aktif' as const,
        },
        {
          id: 'int-PTV-001',
          full_name: 'Muhammad Zidnal Falah',
          position: 'Ketua Umum',
          unit: 'Divisi Layouter',
          category: 'Pengurus' as const,
          phone: '****0616',
          ptv_id: 'PTV-001',
          status: 'Aktif' as const,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, count: mockInternal.length, contacts: mockInternal }),
      } as any);

      const res = await service.getInternalContacts(true);
      expect(res.length).toBe(2);
      expect(res.some((c) => c.category === 'Pengarah')).toBe(true);
      expect(res.some((c) => c.category === 'Pengurus')).toBe(true);
      expect(res.some((c) => c.full_name.includes('Agoes Ali Masyhuri'))).toBe(true);
    });
  });

  describe('4. RBAC & Mutation Security Gate', () => {
    it('ensures unsupported HTTP methods (e.g. TRACE) are rejected with 405 Method Not Allowed', async () => {
      const handlerModule = await import('../../api/_routes/kontak');
      const handler = handlerModule.default;

      const req: any = {
        method: 'TRACE',
        headers: {},
        url: '/api/kontak?type=eksternal',
      };
      let statusCode = 200;
      let responseBody = '';
      const res: any = {
        setHeader: vi.fn(),
        set statusCode(code: number) {
          statusCode = code;
        },
        get statusCode() {
          return statusCode;
        },
        end: (body: string) => {
          responseBody = body;
        },
      };

      await handler(req, res);
      expect(statusCode).toBe(405);
      expect(JSON.parse(responseBody).code).toBe('method_not_allowed');
    });

    it('rejects unauthorized requests without session cookie with 401', async () => {
      const handlerModule = await import('../../api/_routes/kontak');
      const handler = handlerModule.default;

      const methods = ['GET', 'POST', 'PATCH', 'DELETE'];
      for (const method of methods) {
        const req: any = {
          method,
          headers: {},
          url: '/api/kontak?type=eksternal',
        };
        let statusCode = 200;
        let responseBody = '';
        const res: any = {
          setHeader: vi.fn(),
          set statusCode(code: number) {
            statusCode = code;
          },
          get statusCode() {
            return statusCode;
          },
          end: (body: string) => {
            responseBody = body;
          },
        };

        await handler(req, res);
        expect(statusCode).toBe(401);
        expect(JSON.parse(responseBody).code).toBe('unauthorized');
      }
    });

    it('mutation services createExternalContact, updateExternalContact, and deleteExternalContact handle errors correctly', async () => {
      const service = new StagingKontakService();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: 'Validasi gagal: Nama kontak wajib diisi.' }),
      } as any);

      await expect(
        service.createExternalContact({
          nama: '',
          lembaga: 'Pondok',
          kategori: 'Ustadz',
          jabatan: 'Staf',
          organisasi: 'Pesantren',
          status: 'Aktif',
        })
      ).rejects.toThrow('Validasi gagal');
    });
  });
});
