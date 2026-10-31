import { describe, it, expect } from 'vitest';
import { mapDbStatusToDocStatus } from '../../api/_routes/dokumen';
import { determineDocumentStatus } from '../../api/_routes/verifikasi-surat';
import { calculateNextLetterNumber } from '../../src/products/hub/dokumen-saya/utils/letterNumbering';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

describe('PTV-DEV-233 / BUG-010: Merger Dokumen Saya & Surat Arsip Lifecycle', () => {
  describe('1. Status Mapping & Unified Lifecycle Parity', () => {
    it('1.1 Memetakan status database ke status dokumen terpadu secara akurat', () => {
      // Berlaku (ACC)
      expect(mapDbStatusToDocStatus('disetujui')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('valid')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('aktif')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('approved')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('acc')).toBe('Disetujui');

      // Diarsipkan
      expect(mapDbStatusToDocStatus('diarsipkan')).toBe('Diarsipkan');
      expect(mapDbStatusToDocStatus('archived')).toBe('Diarsipkan');

      // Dibatalkan / Ditolak
      expect(mapDbStatusToDocStatus('ditolak')).toBe('Ditolak');
      expect(mapDbStatusToDocStatus('dibatalkan')).toBe('Ditolak');
      expect(mapDbStatusToDocStatus('batal')).toBe('Ditolak');
      expect(mapDbStatusToDocStatus('rejected')).toBe('Ditolak');

      // Draft / Menunggu
      expect(mapDbStatusToDocStatus('menunggu')).toBe('Menunggu');
      expect(mapDbStatusToDocStatus('draft')).toBe('Menunggu');
      expect(mapDbStatusToDocStatus('revisi')).toBe('Revisi');
      expect(mapDbStatusToDocStatus(null)).toBe('Menunggu');
    });

    it('1.2 Verifikasi publik menolak dokumen yang telah diarsipkan', () => {
      // Status 'diarsipkan' harus menghasilkan 'tidak_valid' pada verifikasi publik
      expect(determineDocumentStatus('diarsipkan')).toBe('tidak_valid');
      expect(determineDocumentStatus('archived')).toBe('tidak_valid');

      // Status disetujui masih dalam masa aktif harus 'valid'
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      expect(determineDocumentStatus('disetujui', tomorrow)).toBe('valid');
      expect(determineDocumentStatus('berlaku', tomorrow)).toBe('valid');
    });
  });

  describe('2. Penomoran Surat dari Kondisi Kosong (Reset Staging)', () => {
    it('2.1 Penomoran surat baru dimulai dari urutan 001 setelah reset registry', () => {
      const cleanDocs: PtvDocument[] = [];
      const nextSI = calculateNextLetterNumber(cleanDocs, 'SI', '2026-10-30');

      expect(nextSI.sequence).toBe(1);
      expect(nextSI.nomor_surat).toBe('001/SI-PTV/X/2026');
      expect(nextSI.year).toBe('2026');
      expect(nextSI.roman_month).toBe('X');
    });

    it('2.2 Penomoran Surat Tugas (ST) dan Surat Bawa Barang (SBB) juga mulai dari 001', () => {
      const cleanDocs: PtvDocument[] = [];
      const nextST = calculateNextLetterNumber(cleanDocs, 'ST', '2026-10-30');
      const nextSBB = calculateNextLetterNumber(cleanDocs, 'SBB', '2026-10-30');

      expect(nextST.sequence).toBe(1);
      expect(nextST.nomor_surat).toBe('001/ST-PTV/X/2026');

      expect(nextSBB.sequence).toBe(1);
      expect(nextSBB.nomor_surat).toBe('001/SBB-PTV/X/2026');
    });

    it('2.3 Alokasi nomor berikutnya naik secara konsisten mengikuti urutan terpakai', () => {
      const existing: Array<{ no: string }> = [
        { no: '001/SI-PTV/X/2026' },
        { no: '002/SI-PTV/X/2026' },
      ];
      const nextSI = calculateNextLetterNumber(existing, 'SI', '2026-10-30');

      expect(nextSI.sequence).toBe(3);
      expect(nextSI.nomor_surat).toBe('003/SI-PTV/X/2026');
    });

    it('2.4 Ketika surat dihapus dari daftar dokumen aktif, nomor yang dilepas dapat dialokasikan ulang', () => {
      // Misal dokumen 002 dihapus dari sistem
      const docsAfterDelete: Array<{ no: string }> = [
        { no: '001/SI-PTV/X/2026' },
      ];
      // Karena 002 tidak lagi terpakai di daftar aktif, alokasi berikutnya menjadi 002
      const nextCandidate = calculateNextLetterNumber(docsAfterDelete, 'SI', '2026-10-30');
      expect(nextCandidate.sequence).toBe(2);
      expect(nextCandidate.nomor_surat).toBe('002/SI-PTV/X/2026');
    });
  });

  describe('3. Pembedaan Aksi Arsipkan vs Hapus Surat', () => {
    it('3.1 Arsipkan surat mempertahankan nomor resmi sebagai terpakai', () => {
      const archivedDoc: PtvDocument = {
        id: 'doc-archived-01',
        no: '001/SI-PTV/X/2026',
        subject: 'Izin Santri Haul',
        type: 'Surat Izin Santri',
        date: '2026-10-15',
        owner: 'Zidnal Falah',
        status: 'Diarsipkan',
        created_at: '2026-10-15T08:00:00Z',
      };

      // Surat diarsipkan tetap ada di list
      const activeList = [archivedDoc];
      const next = calculateNextLetterNumber(activeList, 'SI', '2026-10-30');

      // Nomor 001 tidak boleh dialokasikan ulang, berikutnya harus 002
      expect(next.sequence).toBe(2);
      expect(next.nomor_surat).toBe('002/SI-PTV/X/2026');
    });

    it('3.2 Surat yang diarsipkan memiliki status publik tidak valid', () => {
      const statusPublik = determineDocumentStatus('diarsipkan');
      expect(statusPublik).toBe('tidak_valid');
    });
  });
});
