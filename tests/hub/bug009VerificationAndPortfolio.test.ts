import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  determineDocumentStatus,
  VALID_INSTANSI_LIST,
} from '../../api/verifikasi-surat';
import { crewPortfolioService } from '../../src/products/hub/kru/services/crewPortfolioService';

describe('BUG-009: Public Verification Redesign & Crew Portfolio', () => {
  describe('1. Logika Status Dokumen Resmi & Kedaluwarsa', () => {
    it('harus memvalidasi dokumen yang disetujui dengan tanggal masih berlaku', () => {
      const futureDate = '2099-12-31';
      expect(determineDocumentStatus('disetujui', futureDate)).toBe('valid');
      expect(determineDocumentStatus('aktif', futureDate)).toBe('valid');
      expect(determineDocumentStatus('valid', futureDate)).toBe('valid');
    });

    it('harus menandai status kedaluwarsa jika tanggal selesai telah lewat', () => {
      const pastDate = '2020-01-01';
      expect(determineDocumentStatus('disetujui', pastDate)).toBe('kedaluwarsa');
      expect(determineDocumentStatus('aktif', pastDate)).toBe('kedaluwarsa');
    });

    it('harus menandai status tidak valid untuk dokumen yang ditolak atau dibatalkan', () => {
      expect(determineDocumentStatus('ditolak')).toBe('tidak_valid');
      expect(determineDocumentStatus('dibatalkan')).toBe('tidak_valid');
      expect(determineDocumentStatus('batal')).toBe('tidak_valid');
      expect(determineDocumentStatus('dicabut')).toBe('tidak_valid');
    });

    it('harus menandai status menunggu untuk dokumen dalam proses persetujuan', () => {
      expect(determineDocumentStatus('menunggu')).toBe('menunggu');
      expect(determineDocumentStatus('pending')).toBe('menunggu');
    });
  });

  describe('2. Daftar 14 Instansi Resmi Pemeriksa Dokumen', () => {
    it('harus memuat 14 pilihan instansi resmi sesuai spesifikasi', () => {
      const expected = [
        'PTV',
        'SD',
        'SMP',
        'IIS SMP',
        'SMA',
        'MADIN',
        'ASRAMA',
        'SPI',
        'MI',
        'MTs',
        'MA',
        'RIBATH',
        'YAYASAN',
        'NDALEM',
      ];
      expect(VALID_INSTANSI_LIST.length).toBe(14);
      expected.forEach((inst) => {
        expect(VALID_INSTANSI_LIST).toContain(inst);
      });
    });
  });

  describe('3. Crew Portfolio Client Service Contract', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('harus mengambil portofolio publik berdasarkan ptvId', async () => {
      const mockItems = [
        {
          id: 'pf_1',
          ptv_id: 'PTV-001',
          tanggal: '2026-10-25',
          platform: 'YouTube',
          jenis_kontribusi: 'Editing',
          judul: 'Highlight Haul PPBS 2026',
        },
      ];

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, items: mockItems }),
      } as any);

      const items = await crewPortfolioService.getCrewPortfolio('PTV-001');
      expect(items).toHaveLength(1);
      expect(items[0].judul).toBe('Highlight Haul PPBS 2026');
      expect(items[0].platform).toBe('YouTube');
    });

    it('harus menangani respon kosong atau error secara aman dengan array kosong', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as any);

      const items = await crewPortfolioService.getCrewPortfolio('PTV-999');
      expect(items).toEqual([]);
    });

    it('harus memvalidasi pengiriman payload savePortfolioItem', async () => {
      const savedMock = {
        id: 'pf_new',
        ptv_id: 'PTV-001',
        tanggal: '2026-10-30',
        platform: 'Instagram',
        jenis_kontribusi: 'Kamera',
        judul: 'Liputan Live Streaming',
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, item: savedMock }),
      } as any);

      const result = await crewPortfolioService.savePortfolioItem(savedMock);
      expect(result.id).toBe('pf_new');
      expect(result.judul).toBe('Liputan Live Streaming');
    });
  });
});
