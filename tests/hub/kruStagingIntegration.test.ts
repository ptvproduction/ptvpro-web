import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';
import { groupCrewByAngkatan, formatAngkatanDisplay } from '../../src/products/hub/kru/kruStore';
import { handleKruApiRequest, mapLegacyKruRowToCrewMember } from '../../api/_routes/kru';
import { getCrewEffectiveCapabilities } from '../../src/products/hub/kru/utils/crewPermissions';
import { StagingKruService } from '../../src/products/hub/kru/kruService';

afterEach(() => vi.unstubAllGlobals());

describe('PTVPRO — Authoritative Staging Crew Integration & Regression Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, crew: CANONICAL_STAGING_CREW_FIXTURES, stats: { total: 92, aktif: 25, nonaktif: 55, pembina: 8, pengarah: 4 }, login_history: [] }) }));
  });

  describe('1. Data Mapping & Canonical Staging Fidelity', () => {
    it('harus memuat tepat 92 kru unik dari snapshot Supabase Staging legacy_archive_kru', () => {
      expect(CANONICAL_STAGING_CREW_FIXTURES.length).toBe(92);

      const idSet = new Set<string>();
      const ptvIdSet = new Set<string>();

      CANONICAL_STAGING_CREW_FIXTURES.forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.ptv_id).toBeTruthy();
        expect(c.full_name).toBeTruthy();
        expect(c.category).toBeTruthy();
        expect(['Aktif', 'Nonaktif']).toContain(c.status_kru);
        expect(['Belum Ada Akun', 'Aktif', 'Nonaktif']).toContain(c.status_akun);

        expect(idSet.has(c.id)).toBe(false);
        expect(ptvIdSet.has(c.ptv_id)).toBe(false);
        idSet.add(c.id);
        ptvIdSet.add(c.ptv_id);
      });
    });

    it('harus memetakan baris legacy WordPress ke CrewMember secara akurat lewat normalizer', () => {
      const mockRawRow = {
        archive_id: 'test-arch-001',
        source_key: 'wp_kru_test',
        production_id: 'test-uuid-001',
        ptv_id: 'PTV-088',
        full_name: 'Kru Lapangan Integrasi',
        username: 'kruin',
        divisi: 'Technical',
        jabatan: 'Koordinator Siaran',
        angkatan: '12',
        status: 'Aktif',
        role: 'kru',
        photo_url: 'https://progresiftv.id/uploads/avatar.webp',
        email_masked: 'kru@staging.test',
        telepon_masked: '081234567890',
        canonical_identity_id: null,
        reconciliation_status: 'canonical',
        metadata_json: {
          oauth_uid: 'goog-12345',
          created_at: '2026-04-29T10:00:00Z',
        },
        imported_at: '2026-10-18T10:00:00Z',
      };

      const mapped = mapLegacyKruRowToCrewMember(mockRawRow);
      expect(mapped.id).toBe('test-uuid-001');
      expect(mapped.ptv_id).toBe('PTV-088');
      expect(mapped.full_name).toBe('Kru Lapangan Integrasi');
      expect(mapped.position).toBe('Koordinator Siaran');
      expect(mapped.division).toBe('Technical');
      expect(mapped.angkatan).toBe('12');
      expect(mapped.category).toBe('Kru');
      expect(mapped.status_kru).toBe('Aktif');
      expect(mapped.status_akun).toBe('Belum Ada Akun');
      expect(mapped.foto_url).toBe('https://progresiftv.id/uploads/avatar.webp');
      expect(mapped.oauth_uid).toBe('goog-12345');
    });

    it('harus membedakan kategori Pembina dan Pengarah dari jabatan/divisi tanpa mengarang data', () => {
      const pembinaList = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => c.category === 'Pembina');
      const pengarahList = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => c.category === 'Pengarah');

      expect(pembinaList.length).toBe(8);
      expect(pengarahList.length).toBe(4);

      // Verifikasi pengarah mencakup Abuya KH. Agoes Ali Masyhuri (PTV-012)
      const abuYa = pengarahList.find((c) => c.ptv_id === 'PTV-012');
      expect(abuYa).toBeDefined();
      expect(abuYa?.full_name).toContain('Agoes Ali Masyhuri');
      expect(abuYa?.category).toBe('Pengarah');

      // Verifikasi pembina mencakup Pembina PTV (misal PTV-089 atau PTV-005)
      const pembinaSample = pembinaList.find((c) => c.ptv_id === 'PTV-089' || c.ptv_id === 'PTV-005');
      expect(pembinaSample).toBeDefined();
      expect(pembinaSample?.category).toBe('Pembina');
    });
  });

  describe('2. Filter & Statistik Staging', () => {
    it('harus menghasilkan total tepat 92 kru dengan breakdown: 25 Aktif, 55 Nonaktif, 8 Pembina, 4 Pengarah', () => {
      const aktifKru = CANONICAL_STAGING_CREW_FIXTURES.filter(
        (c) => c.category === 'Kru' && c.status_kru === 'Aktif'
      );
      const nonaktifKru = CANONICAL_STAGING_CREW_FIXTURES.filter(
        (c) => c.category === 'Kru' && c.status_kru === 'Nonaktif'
      );
      const pembina = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => c.category === 'Pembina');
      const pengarah = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => c.category === 'Pengarah');

      expect(aktifKru.length).toBe(25);
      expect(nonaktifKru.length).toBe(55);
      expect(pembina.length).toBe(8);
      expect(pengarah.length).toBe(4);

      const totalCalculated = aktifKru.length + nonaktifKru.length + pembina.length + pengarah.length;
      expect(totalCalculated).toBe(92);
      expect(totalCalculated).toBe(CANONICAL_STAGING_CREW_FIXTURES.length);
    });

    it('service getStats harus mengembalikan hitungan agregat yang identik', async () => {
      const service = new StagingKruService();
      const stats = await service.getStats();

      expect(stats.total).toBe(92);
      expect(stats.aktif).toBe(25);
      expect(stats.nonaktif).toBe(55);
      expect(stats.pembina).toBe(8);
      expect(stats.pengarah).toBe(4);
    });
  });

  describe('3. Pengelompokan Angkatan (Urutan Descending Persis Legacy PHP)', () => {
    it('harus mengurutkan angkatan angka secara descending (terbaru di atas) dan kategori khusus di bawah', () => {
      const groups = groupCrewByAngkatan(CANONICAL_STAGING_CREW_FIXTURES);
      expect(groups.length).toBeGreaterThan(0);

      const labels = groups.map((g) => g.label);

      // Angkatan numerik pertama harus angkatan tertinggi (Angkatan 15)
      const numericLabels = labels.filter((l) => /Angkatan \d+/.test(l));
      const numbers = numericLabels.map((l) => parseInt(l.replace(/[^\d]/g, ''), 10));

      for (let i = 0; i < numbers.length - 1; i++) {
        expect(numbers[i]).toBeGreaterThanOrEqual(numbers[i + 1]);
      }

      expect(numbers[0]).toBe(15);
      expect(numbers[numbers.length - 1]).toBe(3);

      // Kategori non-angka harus berada di bagian akhir
      const lastIndexNumeric = labels.reduce((max, l, idx) => (/Angkatan \d+/.test(l) ? idx : max), -1);
      const additionalIdx = labels.indexOf('Additional');
      const pembinaIdx = labels.indexOf('Pembina');
      const pengarahIdx = labels.indexOf('Pengarah');

      if (additionalIdx !== -1) expect(additionalIdx).toBeGreaterThan(lastIndexNumeric);
      if (pembinaIdx !== -1) expect(pembinaIdx).toBeGreaterThan(lastIndexNumeric);
      if (pengarahIdx !== -1) expect(pengarahIdx).toBeGreaterThan(lastIndexNumeric);
    });

    it('formatAngkatanDisplay harus menangani berbagai format legacy secara konsisten', () => {
      expect(formatAngkatanDisplay('12')).toBe('Angkatan 12');
      expect(formatAngkatanDisplay('Angkatan 10')).toBe('Angkatan 10');
      expect(formatAngkatanDisplay('Additional')).toBe('Additional');
      expect(formatAngkatanDisplay('Internship')).toBe('Internship');
      expect(formatAngkatanDisplay('Pembina')).toBe('Pembina');
      expect(formatAngkatanDisplay('Pengarah')).toBe('Pengarah');
      expect(formatAngkatanDisplay('')).toBe('Angkatan belum ditentukan');
      expect(formatAngkatanDisplay(undefined)).toBe('Angkatan belum ditentukan');
    });
  });

  describe('4. Relasi Kru & Akun Login (Pemisahan Tegas & Keamanan Fail-Closed)', () => {
    it('seluruh 92 kru migrasi harus berstatus "Belum Ada Akun" tanpa akun login otomatis', () => {
      const crewWithNoAccount = CANONICAL_STAGING_CREW_FIXTURES.filter(
        (c) => c.status_akun === 'Belum Ada Akun'
      );
      expect(crewWithNoAccount.length).toBe(92);
    });

    it('kru tanpa akun tetap memiliki profil organisasi lengkap tetapi hak akses ditolak fail-closed', () => {
      const sample = CANONICAL_STAGING_CREW_FIXTURES[0];
      expect(sample.full_name).toBeTruthy();
      expect(sample.position).toBeTruthy();
      expect(sample.status_kru).toBe('Aktif');
      expect(sample.status_akun).toBe('Belum Ada Akun');

      // Evaluasi capabilities harus kosong karena status_akun !== 'Aktif'
      const capabilities = getCrewEffectiveCapabilities(sample);
      expect(capabilities.length).toBe(0);
    });
  });

  describe('5. Foto Profil & Fallback Avatar Inisial', () => {
    it('harus membedakan kru yang memiliki foto URL asli dan kru yang butuh avatar inisial', () => {
      const withPhoto = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => Boolean(c.foto_url));
      const withoutPhoto = CANONICAL_STAGING_CREW_FIXTURES.filter((c) => !c.foto_url);

      expect(withPhoto.length).toBeGreaterThan(0);
      expect(withoutPhoto.length).toBeGreaterThan(0);

      // Verifikasi salah satu URL foto adalah webp asli WordPress migrasi
      const jid = CANONICAL_STAGING_CREW_FIXTURES.find((c) => c.ptv_id === 'PTV-001');
      expect(jid?.foto_url).toContain('https://progresiftv.id/wp-content/uploads/');

      // Kru tanpa foto harus menghasilkan inisial 2 karakter yang bersih
      const noPhotoSample = withoutPhoto[0];
      const initials = noPhotoSample.full_name
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
      expect(initials.length).toBeGreaterThanOrEqual(1);
      expect(initials.length).toBeLessThanOrEqual(2);
    });
  });

  describe('6. Server-Side API Security & RBAC Guard (api/kru.ts)', () => {
    it('harus menolak request dengan HTTP METHOD yang dilarang (seperti DELETE) dengan status 405 Method Not Allowed', async () => {
      const forbiddenMethods = ['DELETE', 'TRACE', 'CONNECT'];
      for (const method of forbiddenMethods) {
        const response = await handleKruApiRequest({
          method,
          headers: {},
        });
        expect(response.status).toBe(405);
        expect(response.body.code).toBe('method_not_allowed');
        expect(response.body.error).toContain('tidak didukung pada modul Manajemen Kru');
      }
    });

    it('harus menolak request tanpa autentikasi/cookie session dengan HTTP 401 Unauthorized', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH'];
      for (const method of methods) {
        const response = await handleKruApiRequest({
          method,
          headers: {}, // No session cookie
        });
        expect(response.status).toBe(401);
        expect(response.body.code).toBe('unauthorized');
        expect(response.body.error).toContain('Autentikasi sesi login');
      }
    });

    it('endpoint getLoginHistory harus mengembalikan status jujur database (kosong di staging)', async () => {
      const service = new StagingKruService();
      const history = await service.getLoginHistory();
      expect(Array.isArray(history)).toBe(true);
      // Di staging saat ini tabel ptv_login_history masih kosong (0 baris)
      expect(history.length).toBe(0);
    });

    it('service createCrew dan updateCrew melemparkan error jika backend mengembalikan error', async () => {
      const service = new StagingKruService();
      // Simulasi fetch gagal
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: 'Validasi gagal: Nama lengkap kru wajib diisi.' }),
      } as any);

      await expect(
        service.createCrew({
          full_name: '',
          ptv_id: 'PTV-999',
          username: 'invalid',
          role: 'kru',
          category: 'Kru',
          division: 'Technical',
          position: 'Kru',
          angkatan: '12',
          status_kru: 'Aktif',
          status_akun: 'Belum Ada Akun',
        })
      ).rejects.toThrow('Validasi gagal');
    });
  });
});
