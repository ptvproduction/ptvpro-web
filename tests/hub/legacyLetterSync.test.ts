import { describe, it, expect } from 'vitest';
import {
  mapLegacySuratIzin,
  mapLegacySuratTugas,
  mapLegacySuratBarang,
  mapLegacyCatatan,
  mapLegacyPengumuman,
  mapLegacyEbook,
  normalizeDocumentStatus,
  detectLetterConflict,
  calculateDynamicNextSequence,
  executeLetterSync,
} from '../../scripts/sync-legacy-letters.mjs';

describe('PTVPRO — Comprehensive Legacy to Staging Surat & Arsip Synchronization Engine', () => {
  // Mock canonical identities
  const mockIdentityMap = new Map<string, string>([
    ['d00893ac-3d6b-4da8-b12f-2353cea729aa', 'd00893ac-3d6b-4da8-b12f-2353cea729aa'],
    ['staging admin eksekutif', 'd00893ac-3d6b-4da8-b12f-2353cea729aa'],
    ['ptv-stg-adm', 'd00893ac-3d6b-4da8-b12f-2353cea729aa'],
    ['b93d89c8-457f-4bad-a99b-edbb06af0482', 'b93d89c8-457f-4bad-a99b-edbb06af0482'],
    ['staging kru lapangan', 'b93d89c8-457f-4bad-a99b-edbb06af0482'],
    ['ptv-stg-kru', 'b93d89c8-457f-4bad-a99b-edbb06af0482'],
    ['rafa putra rouf', '02a5c9a7-961e-450f-b2b7-a89e90088cb3'],
    ['ptv-002', '02a5c9a7-961e-450f-b2b7-a89e90088cb3'],
    ['muhammad zidnal falah', '11111111-aaaa-bbbb-cccc-000000000001'],
    ['ptv-001', '11111111-aaaa-bbbb-cccc-000000000001'],
  ]);

  // 1. Backfill Mapping Tests (Surat Izin, Tugas, Barang)
  describe('1. Backfill Mapping Persuratan (SI, ST, SBB)', () => {
    it('1.1 Surat Izin: Memetakan struktur legacy ke canonical Staging dengan santri_list utuh', () => {
      const legacyRow = {
        id: 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
        nomor_surat: '001/SI-PTV/X/2026',
        nama_santri: 'Muhammad Farras Zaidan Mubarok',
        alasan: 'Izin Sekolah - Relay Haul Solo',
        tanggal_mulai: '2026-10-03',
        tanggal_selesai: '2026-10-03',
        diajukan_oleh: 'Progresif TV',
        disetujui_oleh: 'Rafa Putra Rouf',
        status: 'disetujui',
        created_at: '2026-10-02T19:48:17.097499+00:00',
        santri_list: [
          {
            nama: 'Muhammad Farras Zaidan Mubarok',
            unit: 'SMA',
            kamar: 'Imam Maturidi',
            kelas: 'XI C2',
          },
        ],
      };

      const { canonicalRow, provenance } = mapLegacySuratIzin(legacyRow, mockIdentityMap);

      expect(canonicalRow.id).toBe('ff305b4f-0c0e-4abc-9da9-2556bdb1743c');
      expect(canonicalRow.nomor_surat).toBe('001/SI-PTV/X/2026');
      expect(canonicalRow.nama_pemohon).toBe('Muhammad Farras Zaidan Mubarok');
      expect(canonicalRow.alasan).toBe('Izin Sekolah - Relay Haul Solo');
      expect(canonicalRow.status).toBe('disetujui');
      expect(canonicalRow.santri_list).toHaveLength(1);
      expect(canonicalRow.santri_list[0].nama).toBe('Muhammad Farras Zaidan Mubarok');

      // Identity verification
      expect(canonicalRow.disetujui_oleh).toBe('02a5c9a7-961e-450f-b2b7-a89e90088cb3');
      expect(provenance.disetujui_unmapped).toBe(false);

      // Progresif TV tidak terpetakan -> NULL (Zero Fabrication)
      expect(canonicalRow.diajukan_oleh).toBeNull();
      expect(provenance.diajukan_unmapped).toBe(true);
      expect(provenance.original_diajukan_oleh).toBe('Progresif TV');
    });

    it('1.2 Surat Izin Baru Live: Memetakan 009/SI-PTV/X/2026 dan 011/SI-PTV/X/2026 secara akurat', () => {
      const row009 = {
        id: 'df6e9e3b-ef6a-4359-a1df-9cb10f2294e7',
        nomor_surat: '009/SI-PTV/X/2026',
        nama_santri: 'Muhammad Izzur Fauzil Adhim',
        jenis_kegiatan: 'Ngaji Syeikh Nabil',
        tanggal_mulai: '2026-10-21',
        tanggal_selesai: '2026-10-21',
        status: 'disetujui',
        diajukan_oleh: 'Progresif TV',
        disetujui_oleh: 'Progresif TV',
        created_at: '2026-10-21T11:46:18.419244+00:00',
      };

      const { canonicalRow, provenance } = mapLegacySuratIzin(row009, mockIdentityMap);
      expect(canonicalRow.id).toBe('df6e9e3b-ef6a-4359-a1df-9cb10f2294e7');
      expect(canonicalRow.nomor_surat).toBe('009/SI-PTV/X/2026');
      expect(canonicalRow.nama_pemohon).toBe('Muhammad Izzur Fauzil Adhim');
      expect(canonicalRow.alasan).toBe('Ngaji Syeikh Nabil');
      expect(canonicalRow.status).toBe('disetujui');
      expect(canonicalRow.diajukan_oleh).toBeNull();
      expect(canonicalRow.disetujui_oleh).toBeNull();
      expect(provenance.diajukan_unmapped).toBe(true);
      expect(provenance.disetujui_unmapped).toBe(true);
    });

    it('1.3 Surat Tugas: Memetakan perihal, kru_terlibat, dan tanggal_tugas', () => {
      const legacyRow = {
        id: '11111111-2222-3333-4444-555555555555',
        nomor_surat: '001/ST-PTV/X/2026',
        nama_kegiatan: 'Liputan Pengajian Akbar',
        tanggal_mulai: '2026-10-25',
        kru_assigned: JSON.stringify(['Ahmad', 'Budi', 'Chandra']),
        diajukan_oleh: 'Staging Kru Lapangan',
        disetujui_oleh: 'Staging Admin Eksekutif',
        status: 'disetujui',
        created_at: '2026-10-24T10:00:00Z',
      };

      const { canonicalRow, provenance } = mapLegacySuratTugas(legacyRow, mockIdentityMap);

      expect(canonicalRow.id).toBe('11111111-2222-3333-4444-555555555555');
      expect(canonicalRow.nomor_surat).toBe('001/ST-PTV/X/2026');
      expect(canonicalRow.perihal).toBe('Liputan Pengajian Akbar');
      expect(canonicalRow.tanggal_tugas).toBe('2026-10-25');
      expect(canonicalRow.kru_terlibat).toEqual(['Ahmad', 'Budi', 'Chandra']);
      expect(canonicalRow.diajukan_oleh).toBe('b93d89c8-457f-4bad-a99b-edbb06af0482');
      expect(canonicalRow.disetujui_oleh).toBe('d00893ac-3d6b-4da8-b12f-2353cea729aa');
      expect(provenance.diajukan_unmapped).toBe(false);
      expect(provenance.disetujui_unmapped).toBe(false);
    });

    it('1.4 Surat Barang: Memetakan nama_pembawa, tujuan_lokasi, dan daftar_barang', () => {
      const legacyRow = {
        id: '66666666-7777-8888-9999-000000000000',
        nomor_surat: '001/SBB-PTV/X/2026',
        pembawa: 'Ahmad Muzakki',
        keperluan: 'Liputan Lapangan Stadion',
        daftar_barang: JSON.stringify([{ nama: 'Sony FX3', qty: 1 }, { nama: 'Tripod Libec', qty: 1 }]),
        diajukan_oleh: 'Ahmad Muzakki',
        disetujui_oleh: null,
        status: 'menunggu',
        created_at: '2026-10-24T12:00:00Z',
      };

      const { canonicalRow, provenance } = mapLegacySuratBarang(legacyRow, mockIdentityMap);

      expect(canonicalRow.id).toBe('66666666-7777-8888-9999-000000000000');
      expect(canonicalRow.nomor_surat).toBe('001/SBB-PTV/X/2026');
      expect(canonicalRow.nama_pembawa).toBe('Ahmad Muzakki');
      expect(canonicalRow.tujuan_lokasi).toBe('Liputan Lapangan Stadion');
      expect(canonicalRow.daftar_barang).toHaveLength(2);
      expect(canonicalRow.status).toBe('menunggu');
      expect(canonicalRow.diajukan_oleh).toBeNull();
      expect(provenance.diajukan_unmapped).toBe(true);
    });
  });

  // 2. Mapping Arsip Catatan, Pengumuman, dan E-Book
  describe('2. Mapping Arsip Dokumen (Catatan, Pengumuman, E-Book)', () => {
    it('2.1 Catatan: Memetakan judul, warna, is_pinned, tags, dan author', () => {
      const row = {
        id: '3f2a114a-2819-456c-af28-497c9385e44f',
        judul: 'Nama Lengkap Keluarga Ndalem',
        isi: '<p>Catatan penting silsilah ndalem</p>',
        warna: 'orange',
        is_pinned: true,
        tags: ['ndalem', 'gus', 'ning'],
        created_by_id: 'PTV-001',
        created_by_name: 'Muhammad Zidnal Falah',
        created_at: '2026-09-23T13:06:33+00:00',
        updated_at: '2026-09-27T18:07:27+00:00',
      };

      const { canonicalRow, provenance } = mapLegacyCatatan(row, mockIdentityMap);

      expect(canonicalRow.id).toBe('3f2a114a-2819-456c-af28-497c9385e44f');
      expect(canonicalRow.judul).toBe('Nama Lengkap Keluarga Ndalem');
      expect(canonicalRow.warna).toBe('orange');
      expect(canonicalRow.is_pinned).toBe(true);
      expect(canonicalRow.tags).toEqual(['ndalem', 'gus', 'ning']);
      expect(canonicalRow.created_by_id).toBe('PTV-001');
      expect(canonicalRow.created_by_name).toBe('Muhammad Zidnal Falah');
      expect(provenance.author_unmapped).toBe(false);
    });

    it('2.2 Pengumuman: Memetakan target divisi, prioritas, status, dan konten', () => {
      const row = {
        id: 'b5194a18-f80f-46a7-b6f1-298bf57f3bfa',
        judul: 'Dasbor sudah bisa digunakan!',
        konten: 'Silakan login dengan kredensial masing-masing.',
        target_divisi: 'Semua',
        prioritas: 'Penting',
        status: 'aktif',
        created_at: '2026-09-23T13:22:58.637775+00:00',
      };

      const { canonicalRow, provenance } = mapLegacyPengumuman(row);

      expect(canonicalRow.id).toBe('b5194a18-f80f-46a7-b6f1-298bf57f3bfa');
      expect(canonicalRow.judul).toBe('Dasbor sudah bisa digunakan!');
      expect(canonicalRow.target_divisi).toBe('Semua');
      expect(canonicalRow.status).toBe('aktif');
      expect(provenance.table).toBe('ptv_pengumuman');
    });

    it('2.3 E-Book: Mempreservasi link PDF WordPress Uploads & Google Drive', () => {
      const wpRow = {
        id: '5c1529d2-edab-4990-aa96-0ecd4872d963',
        judul: 'Buku Pintar Qurban ala Madzhab Syafi’i',
        penulis: 'Agus H. Syaikhul Islam Ali, Lc., M.Sosio.',
        file_url: 'https://progresiftv.id/wp-content/uploads/E-BOOK-GUS-SYAIKHUL@Buku-Pintar-Qurban-ala-Madzhab-Syafii.pdf',
        cover_url: 'https://progresiftv.id/wp-content/uploads/Coverbuku-1.png',
        created_at: '2026-05-13T17:03:19+00:00',
      };

      const driveRow = {
        id: '3c2ac1b1-34fa-4913-a88c-54c1011d7c94',
        judul: 'Awas Hadis Palsu: Keutamaan Sholat Tarawih',
        penulis: 'Agus H. Syaikhul Islam Ali, Lc., M.Sosio.',
        file_url: 'https://drive.google.com/file/d/1bjpQ5LYiBjTUawIQgAvjxAl-c1iU5pSM/preview',
        cover_url: null,
        created_at: '2026-05-14T06:02:16+00:00',
      };

      const resWp = mapLegacyEbook(wpRow);
      expect(resWp.canonicalRow.file_url).toContain('wp-content/uploads');
      expect(resWp.provenance.storage_type).toBe('wordpress_uploads');
      expect(resWp.provenance.has_valid_pdf_link).toBe(true);

      const resDrive = mapLegacyEbook(driveRow);
      expect(resDrive.canonicalRow.file_url).toContain('drive.google.com');
      expect(resDrive.provenance.storage_type).toBe('google_drive');
      expect(resDrive.provenance.has_valid_pdf_link).toBe(true);
    });
  });

  // 3. Normalisasi Status & Penanganan Pembatalan
  describe('3. Normalisasi Status & Penanganan Dokumen Batal', () => {
    it('3.1 Memetakan status batal / dibatalkan menjadi ditolak secara aman', () => {
      expect(normalizeDocumentStatus('dibatalkan')).toBe('ditolak');
      expect(normalizeDocumentStatus('batal')).toBe('ditolak');
      expect(normalizeDocumentStatus('cancelled')).toBe('ditolak');
      expect(normalizeDocumentStatus('disetujui')).toBe('disetujui');
      expect(normalizeDocumentStatus('approved')).toBe('disetujui');
      expect(normalizeDocumentStatus('revisi')).toBe('revisi');
      expect(normalizeDocumentStatus('menunggu')).toBe('menunggu');
    });

    it('3.2 Surat izin berstatus batal terdeteksi di provenance dan status ditolak', () => {
      const rowBatal = {
        id: '99999999-0000-0000-0000-000000000000',
        nomor_surat: '099/SI-PTV/X/2026',
        nama_santri: 'Santri Batal',
        status: 'dibatalkan',
      };
      const { canonicalRow, provenance } = mapLegacySuratIzin(rowBatal, mockIdentityMap);
      expect(canonicalRow.status).toBe('ditolak');
      expect(provenance.is_cancelled).toBe(true);
    });
  });

  // 4. Dynamic Gap-Filling Sequence (R06 Rev 11)
  describe('4. Dynamic Gap-Filling Calculation (R06 Rev 11)', () => {
    it('4.1 Diberikan nomor terbit [001, 007, 009, 011], nomor urut berikutnya adalah 002', () => {
      const issued = [
        '001/SI-PTV/X/2026',
        '007/SI-PTV/X/2026',
        '009/SI-PTV/X/2026',
        '011/SI-PTV/X/2026',
      ];
      const nextSeq = calculateDynamicNextSequence(issued, 'SI', 2026);
      expect(nextSeq).toBe(2);
    });

    it('4.2 Mengisi celah secara sekuensial jika nomor di awal sudah terisi', () => {
      const issued = [
        '001/SI-PTV/X/2026',
        '002/SI-PTV/X/2026',
        '003/SI-PTV/X/2026',
        '007/SI-PTV/X/2026',
      ];
      const nextSeq = calculateDynamicNextSequence(issued, 'SI', 2026);
      expect(nextSeq).toBe(4);
    });
  });

  // 5. Anti-Conflict & Safe Retention Policy
  describe('5. Anti-Conflict & Safe Retention Policy', () => {
    it('5.1 Mendeteksi tabrakan nomor jika dokumen staging lain menggunakan nomor sama', () => {
      const incoming = {
        id: 'incoming-uuid-1',
        nomor_surat: '001/SI-PTV/X/2026',
      };
      const existingStaging = [
        { id: 'different-staging-uuid', nomor_surat: '001/SI-PTV/X/2026' },
      ];

      const conflict = detectLetterConflict(incoming, existingStaging, new Set());
      expect(conflict).not.toBeNull();
      expect(conflict?.type).toBe('DUPLICATE_NUMBER_COLLISION');
    });

    it('5.2 Mengizinkan id yang sama (idempotent update)', () => {
      const incoming = {
        id: 'same-uuid',
        nomor_surat: '001/SI-PTV/X/2026',
      };
      const existingStaging = [
        { id: 'same-uuid', nomor_surat: '001/SI-PTV/X/2026' },
      ];

      const conflict = detectLetterConflict(incoming, existingStaging, new Set());
      expect(conflict).toBeNull();
    });
  });

  // 6. Pipeline End-to-End Simulation
  describe('6. Comprehensive Pipeline End-to-End Dry-Run', () => {
    it('6.1 Menjalankan executeLetterSync dengan dataset mock lengkap mencakup seluruh Surat & Arsip', async () => {
      const mockLegacy = {
        ptv_surat_izin: [
          {
            id: 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
            nomor_surat: '001/SI-PTV/X/2026',
            nama_santri: 'Farras',
            status: 'disetujui',
            created_at: '2026-10-02T19:48:17Z',
          },
          {
            id: 'df6e9e3b-ef6a-4359-a1df-9cb10f2294e7',
            nomor_surat: '009/SI-PTV/X/2026',
            nama_santri: 'Fauzil Adhim',
            status: 'disetujui',
            created_at: '2026-10-21T11:46:18Z',
          },
        ],
        ptv_surat_tugas: [],
        ptv_surat_barang: [],
        ptv_catatan: [
          {
            id: 'cat-1',
            judul: 'Catatan Rapat',
            isi: '<p>Hasil rapat</p>',
            warna: 'orange',
            is_pinned: true,
            tags: ['rapat'],
            created_at: '2026-10-10T10:00:00Z',
          },
        ],
        ptv_pengumuman: [
          {
            id: 'ann-1',
            judul: 'Pengumuman Resmi',
            konten: 'Pesan broadcast',
            created_at: '2026-10-10T10:00:00Z',
          },
        ],
        ptv_ebook: [
          {
            id: 'eb-1',
            judul: 'Buku Pintar Qurban',
            file_url: 'https://progresiftv.id/wp-content/uploads/buku.pdf',
            created_at: '2026-05-13T10:00:00Z',
          },
        ],
      };

      const mockStaging = {
        ptv_surat_izin: [
          {
            id: 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
            nomor_surat: '001/SI-PTV/X/2026',
            status: 'disetujui',
          },
        ],
        ptv_surat_tugas: [],
        ptv_surat_barang: [],
        ptv_catatan: [],
        ptv_pengumuman: [],
        canonical_identity: [],
      };

      const summary = await executeLetterSync({
        mode: 'backfill',
        isDryRun: true,
        sourceMode: 'bundle',
        customLegacyData: mockLegacy,
        customStagingData: mockStaging,
        checkpointFile: 'reports/test-checkpoint.json',
        reconciliationFile: 'reports/test-reconciliation.json',
        archiveManifestFile: 'reports/test-archive-manifest.json',
      });

      expect(summary.counts.legacy_total).toBe(5); // 2 izin + 1 catatan + 1 pengumuman + 1 ebook
      expect(summary.tables.ptv_surat_izin.total).toBe(2);
      expect(summary.tables.ptv_surat_izin.ready).toBe(1); // 009 ready
      expect(summary.counts.skipped_unchanged).toBe(1); // 001 already in staging
      expect(summary.tables.ptv_catatan.ready).toBe(1);
      expect(summary.tables.ptv_pengumuman.ready).toBe(1);
      expect(summary.tables.ptv_ebook.total).toBe(1);
      expect(summary.next_sequences.SI).toBe(2); // Dynamic gap-filling next is 002
    });
  });
});
