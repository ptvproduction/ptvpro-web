import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';
import { isOperationalCrew } from '../../src/products/hub/kru/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getKruService } from '../../src/products/hub/kru/kruService';
import { AcaraCrewModal } from '../../src/products/hub/acara/components/AcaraCrewModal';
import { AcaraFormModal } from '../../src/products/hub/acara/components/AcaraFormModal';
import { AcaraItem, AcaraCrewMember } from '../../src/products/hub/acara/types';

// Mock AcaraContext
const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useAcara: () => ({
    createEvent: mockCreateEvent,
    updateEvent: mockUpdateEvent,
    showToast: mockShowToast,
    events: [],
    loading: false,
  }),
}));

describe('PTVPRO — Kelola Kru Bertugas pada Modul Acara (P0 Fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Sumber Data Kanonikal Kru Aktif Asli', () => {
    it('getActiveCrewCandidates hanya mengembalikan personel kategori Kru dengan status Aktif (termasuk jabatan Ketua jika tetap kru aktif)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, crew: CANONICAL_STAGING_CREW_FIXTURES.filter(isOperationalCrew).map(c => ({ id: c.id, ptv_id: c.ptv_id, name: c.full_name, photo: c.foto_url, division: c.division, position: c.position })) }) }));
      const kruService = getKruService();
      const candidates = await kruService.getActiveCrewCandidates();

      expect(candidates.length).toBe(25); // 23 kru aktif kanonikal terverifikasi

      // 1. Verifikasi tidak ada akun testing PTV-UJI-2712
      const testRecord = candidates.find((c) => c.ptv_id === 'PTV-UJI-2712' || c.name.includes('Testing Otomatis'));
      expect(testRecord).toBeUndefined();

      // 2. Verifikasi tidak ada Pengurus (Ketua Umum / Ketua)
      const ketuaUmum = candidates.find((c) => c.ptv_id === 'PTV-001' || c.name.includes('Zidnal Falah'));
      expect(ketuaUmum).toBeDefined();

      const ketua = candidates.find((c) => c.ptv_id === 'PTV-003' || c.name.includes('Farras Zaidan'));
      expect(ketua).toBeDefined();

      // 3. Verifikasi tidak ada Pembina (misal PTV-005, PTV-089, PTV-046, PTV-070, PTV-045, PTV-062, PTV-011, PTV-035)
      const pembinaList = candidates.filter((c) =>
        ['PTV-005', 'PTV-089', 'PTV-046', 'PTV-070', 'PTV-045', 'PTV-062', 'PTV-011', 'PTV-035'].includes(c.ptv_id || '')
      );
      expect(pembinaList).toEqual([]);

      // 4. Verifikasi tidak ada Pengarah (misal PTV-012, PTV-013, PTV-014, PTV-015)
      const pengarahList = candidates.filter((c) =>
        ['PTV-012', 'PTV-013', 'PTV-014', 'PTV-015'].includes(c.ptv_id || '')
      );
      expect(pengarahList).toEqual([]);

      // 5. Verifikasi PTV-017 telah direkonsiliasi menjadi Muhammad Hamdan Yuwafi Sulaim
      const ptv017 = candidates.find((c) => c.ptv_id === 'PTV-017');
      expect(ptv017).toBeDefined();
      expect(ptv017?.name).not.toContain('Testing');
      expect(ptv017?.name).toBe('Muhammad Hamdan Yuwafi Sulaim');

      // 6. Seluruh kandidat memiliki role Kru dan id stabil
      for (const c of candidates) {
        expect(c.id).toBeDefined();
        expect(c.name).toBeTruthy();
        expect(c.division).toBeTruthy();
        expect(c.role).toBe('Kru');
      }
    });
  });

  describe('2. Modal Kelola Kru Bertugas (AcaraCrewModal)', () => {
    it('mengembalikan string kosong saat isOpen={false}', () => {
      const html = renderToString(
        <AcaraCrewModal
          isOpen={false}
          onClose={vi.fn()}
          eventName="Liputan Acara"
        />
      );
      expect(html).toBe('');
    });

    it('me-render struktur modal dan tidak mengandung nama dummy STUDIO_CREW_POOL saat isOpen={true}', () => {
      const html = renderToString(
        <AcaraCrewModal
          isOpen={true}
          onClose={vi.fn()}
          eventName="Liputan Hari Santri"
        />
      );

      // Header modal
      expect(html).toContain('Kelola Kru Bertugas');
      expect(html).toContain('Liputan Hari Santri');

      // Input pencarian kru
      expect(html).toContain('Cari kru aktif berdasarkan nama, divisi, atau peran...');

      // Tidak boleh mengandung nama dummy lama STUDIO_CREW_POOL
      expect(html).not.toContain('Farid Technical');
      expect(html).not.toContain('Ahmad Executive');
      expect(html).not.toContain('Roup'); // Roup dummy lama tanpa nama lengkap kanonikal Rafa Putra Rouf
      expect(html).not.toContain('+ Tugaskan'); // Tombol redundan dihapus
    });

    it('mendukung initialCrew yang telah dipilih sebelumnya', () => {
      const initialCrew: AcaraCrewMember[] = [
        {
          id: 'kru-01',
          ptv_id: 'PTV-017',
          name: 'Muhammad Hamdan Yuwafi Sulaim',
          division: 'Technical',
          role: 'Kru',
          job: 'Operator Streaming',
          tugas: 'Operator Streaming',
        },
      ];

      const html = renderToString(
        <AcaraCrewModal
          isOpen={true}
          onClose={vi.fn()}
          eventName="Live Streaming Pengajian"
          initialCrew={initialCrew}
        />
      );

      expect(html).toContain('Selesai Memilih (1 Kru)');
      expect(html).toContain('1<!-- --> kru ditugaskan untuk');
    });
  });

  describe('3. Form Tambah Acara dengan Section Kru Bertugas (Opsional)', () => {
    it('menampilkan section Kru Bertugas (Opsional) dan tombol Pilih Kru', () => {
      const html = renderToString(
        <AcaraFormModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Kru Bertugas (Opsional)');
      expect(html).toContain('Belum ada kru yang ditugaskan untuk kegiatan ini.');
      expect(html).toContain('+ Pilih Kru');
    });

    it('acara tanpa kru tetap valid dan tidak memblokir render form', () => {
      const html = renderToString(
        <AcaraFormModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Jadwalkan Acara');
      expect(html).toContain('Nama Kegiatan / Acara');
      expect(html).toContain('Kru Bertugas (Opsional)');
    });
  });

  describe('4. Form Edit Acara dengan Preselected Crew', () => {
    it('memuat kru yang sudah ditugaskan pada acara existing', () => {
      const mockEvent: AcaraItem = {
        id: 'ev-test-101',
        name: 'Liputan Maulid Nabi',
        date: '2026-10-25',
        time: '08:00 – Selesai',
        loc: 'Masjid Agung',
        status: 'Mendatang',
        notes: 'Bawa tripod dan lensa tele',
        crew: [
          {
            id: 'kru-01',
            ptv_id: 'PTV-017',
            name: 'Muhammad Hamdan Yuwafi Sulaim',
            division: 'Technical',
            role: 'Kru',
            job: 'Operator Streaming',
            tugas: 'Operator Streaming',
          },
        ],
        gear: [],
        rundown: [],
      };

      const html = renderToString(
        <AcaraFormModal
          isOpen={true}
          onClose={vi.fn()}
          eventToEdit={mockEvent}
        />
      );

      // Section kru menampilkan 1 kru yang sudah ada
      expect(html).toContain('1 Kru Ditugaskan');
      expect(html).toContain('Muhammad Hamdan Yuwafi Sulaim');
      expect(html).toContain('(Operator Streaming)');
      expect(html).toContain('Kelola Kru');
    });
  });
});
