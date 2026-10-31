import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { canDeleteInventory } from '../../src/products/hub/inventaris/utils/inventoryPermissions';
import { AuthUser } from '../../src/core/auth';
import { ItemInventaris } from '../../src/products/hub/inventaris/types';
import { InventorySafetyCheckService } from '../../src/products/hub/inventaris/services/inventorySafetyCheckService';
import { LocalInventarisService, SupabaseInventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { peminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';
import { damageReportService } from '../../src/products/hub/lapor-kerusakan/damageReportService';
import { dokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';

describe('Smart Delete & Arsip Inventaris — Comprehensive Quality Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. HAK AKSES & CAPABILITY POLICY
  // ─────────────────────────────────────────────────────────────
  describe('1. Hak Akses & Capability Policy (inventory.delete)', () => {
    const mockCanFalse = vi.fn().mockReturnValue(false);
    const mockCanTrue = vi.fn().mockReturnValue(true);

    it('1.1 Allows Root / Super Admin profile (root_executive)', () => {
      const user: AuthUser = {
        id: 'u-root-1',
        ptv_id: 'PTV-001',
        full_name: 'Super Admin',
        username: 'root',
        organization: 'PTV',
        division: 'Pimpinan',
        position: 'Root Administrator',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['root_executive'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(user, mockCanTrue)).toBe(true);
      expect(canDeleteInventory(user, mockCanFalse)).toBe(true); // Profile fallback
    });

    it('1.2 Allows Eksekutif profile (eksekutif)', () => {
      const user: AuthUser = {
        id: 'u-exec-1',
        ptv_id: 'PTV-002',
        full_name: 'Pimpinan Eksekutif',
        username: 'eksekutif',
        organization: 'PTV',
        division: 'Pimpinan',
        position: 'Direktur',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(user, mockCanTrue)).toBe(true);
      expect(canDeleteInventory(user, mockCanFalse)).toBe(true);
    });

    it('1.3 Allows Administrasi role (kepolo_kepali or administrasi role/position)', () => {
      const adminUser: AuthUser = {
        id: 'u-adm-1',
        ptv_id: 'PTV-003',
        full_name: 'Staf Administrasi',
        username: 'admin_studio',
        organization: 'PTV',
        division: 'Administrasi',
        position: 'Kepala Administrasi Studio',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['kepolo_kepali'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(adminUser, mockCanFalse)).toBe(true);

      const adminByRoleUser = {
        ...adminUser,
        assigned_profiles: ['crew'] as const,
        role: 'administrasi',
      } as unknown as AuthUser;
      expect(canDeleteInventory(adminByRoleUser, mockCanFalse)).toBe(true);
    });

    it('1.4 Strictly denies Kru biasa without mutation permission', () => {
      const crewUser: AuthUser = {
        id: 'u-crew-1',
        ptv_id: 'PTV-010',
        full_name: 'Kru Lapangan',
        username: 'kru1',
        organization: 'PTV',
        division: 'Produksi',
        position: 'Kamera Operator',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(crewUser, mockCanFalse)).toBe(false);
    });

    it('1.5 Strictly denies Pembina and Pengarah by default', () => {
      const pembinaUser: AuthUser = {
        id: 'u-pem-1',
        ptv_id: 'PTV-099',
        full_name: 'Pembina Organisasi',
        username: 'pembina',
        organization: 'PTV',
        division: 'Penasihat',
        position: 'Pembina Utama',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['pembina'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(pembinaUser, mockCanFalse)).toBe(false);
    });

    it('1.6 Fail-Closed: Strictly blocks inactive or archived accounts', () => {
      const inactiveUser: AuthUser = {
        id: 'u-inact-1',
        ptv_id: 'PTV-001',
        full_name: 'Former Admin',
        username: 'inactive_admin',
        organization: 'PTV',
        division: 'Administrasi',
        position: 'Admin',
        status_akun: 'inactive',
        status_organisasi: 'active',
        assigned_profiles: ['root_executive'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(canDeleteInventory(inactiveUser, mockCanTrue)).toBe(false);

      const archivedOrgUser: AuthUser = {
        ...inactiveUser,
        status_akun: 'active',
        status_organisasi: 'archived',
      };
      expect(canDeleteInventory(archivedOrgUser, mockCanTrue)).toBe(false);
    });

    it('1.7 Fail-Closed: Explicit user deny_override takes precedence over profile', () => {
      const deniedUser: AuthUser = {
        id: 'u-denied-1',
        ptv_id: 'PTV-002',
        full_name: 'Restricted Executive',
        username: 'exec_restricted',
        organization: 'PTV',
        division: 'Pimpinan',
        position: 'Eksekutif',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: ['inventory.delete'],
      };

      expect(canDeleteInventory(deniedUser, mockCanTrue)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. AUTOMATED SAFETY CHECK SERVICE
  // ─────────────────────────────────────────────────────────────
  describe('2. Automated Safety Check Service (Condition C, B, A)', () => {
    const safetyService = new InventorySafetyCheckService();

    const sampleAsset: ItemInventaris = {
      id: 'inv-test-500',
      kode: 'CAM-500',
      nama_alat: 'Sony FX3 Cinema Camera',
      kategori: 'Kamera',
      total_unit: 2,
      unit_tersedia: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      units: [
        {
          id: 'u-500-1',
          inventaris_id: 'inv-test-500',
          kode_unit: 'CAM-500-U01',
          nama_unit: 'Unit 1',
          kondisi: 'bagus',
          status_peminjaman: 'tersedia',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-500-2',
          inventaris_id: 'inv-test-500',
          kode_unit: 'CAM-500-U02',
          nama_unit: 'Unit 2',
          kondisi: 'bagus',
          status_peminjaman: 'tersedia',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    };

    it('2.1 Kondisi C: Blocks destruction when units are actively borrowed', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([
        {
          id: 'loan-1',
          transaction_id: 'tr-1',
          unit_id: 'u-500-1',
          kode_unit: 'CAM-500-U01',
          nama_alat: 'Sony FX3 Cinema Camera',
          kategori: 'Kamera',
          peminjam_nama: 'Ahmad Kru',
          keperluan: 'Liputan Acara Maulid',
          tanggal_pinjam: '2026-10-20',
          tenggat_kembali: '2026-10-22',
          status: 'dipinjam',
          created_at: '2026-10-20T10:00:00Z',
        },
      ]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({ documents: [], stats: {} as any });

      const report = await safetyService.inspectAssetSafety(sampleAsset);

      expect(report.condition).toBe('C');
      expect(report.activeLoans.length).toBe(1);
      expect(report.activeBlockers.length).toBeGreaterThan(0);
      expect(report.activeBlockers[0].title).toContain('Unit Sedang Dipinjam');
      expect(report.resolutionGuidance).toBeDefined();
    });

    it('2.2 Kondisi C: Blocks destruction when active damage report is in progress', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([
        {
          id: 'dmg-1',
          assetId: 'inv-test-500',
          assetName: 'Sony FX3 Cinema Camera',
          assetCategory: 'Kamera',
          unitNumber: 1,
          unitCode: 'CAM-500-U01',
          title: 'Sensor Kotor',
          description: 'Bintik hitam pada bukaan f/8',
          severity: 'Sedang',
          reporterName: 'Budi',
          reportedAt: '2026-10-21',
          status: 'Sedang Dicek',
        },
      ]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({ documents: [], stats: {} as any });

      const report = await safetyService.inspectAssetSafety(sampleAsset);

      expect(report.condition).toBe('C');
      expect(report.activeDamageReports.length).toBe(1);
      expect(report.activeBlockers.some((b) => b.type === 'damage')).toBe(true);
    });

    it('2.3 Kondisi C: Blocks destruction when active document request is pending', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({
        documents: [
          {
            id: 'doc-1',
            no: '001/SBB/X/2026',
            subject: 'Surat Bawa Barang: CAM-500',
            type: 'Izin Membawa Barang',
            date: '2026-10-21',
            owner: 'Pimpinan',
            recipients: ['Ahmad'],
            items: ['CAM-500-U01'],
            status: 'Menunggu',
            created_at: '2026-10-21T08:00:00Z',
          },
        ],
        stats: {} as any,
      });

      const report = await safetyService.inspectAssetSafety(sampleAsset);

      expect(report.condition).toBe('C');
      expect(report.activeDocuments.length).toBe(1);
      expect(report.activeBlockers.some((b) => b.type === 'document')).toBe(true);
    });

    it('2.4 Kondisi B: Disallows hard delete and recommends archive when completed history exists', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([
        {
          id: 'loan-hist-1',
          transaction_id: 'tr-old',
          unit_id: 'u-500-1',
          kode_unit: 'CAM-500-U01',
          nama_alat: 'Sony FX3 Cinema Camera',
          kategori: 'Kamera',
          peminjam_nama: 'Fauzan Kru',
          keperluan: 'Proyek Haul 2025',
          tanggal_pinjam: '2025-05-10',
          tenggat_kembali: '2025-05-12',
          tanggal_kembali: '2025-05-12',
          status: 'dikembalikan',
          created_at: '2025-05-10T10:00:00Z',
        },
      ]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({ documents: [], stats: {} as any });

      const report = await safetyService.inspectAssetSafety(sampleAsset);

      expect(report.condition).toBe('B');
      expect(report.historicalLoans.length).toBe(1);
      expect(report.activeLoans.length).toBe(0);
      expect(report.summaryHeading).toContain('Memiliki Rekam Jejak Historis');
      expect(report.resolutionGuidance).toContain('Arsipkan Inventaris');
    });

    it('2.5 Kondisi B: Disallows hard delete when institutional valuation records exist', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({ documents: [], stats: {} as any });

      const assetWithValuation: ItemInventaris = {
        ...sampleAsset,
        nilai_inventaris: {
          id: 'val-500',
          inventaris_id: 'inv-test-500',
          nilai_perolehan: 35000000,
          nilai_tercatat: 28000000,
          tanggal_perolehan: '2024-01-15',
          sumber_perolehan: 'Yayasan',
          status: 'Aktif',
          catatan: 'Pembelian unit kamera bioskop',
        },
      };

      const report = await safetyService.inspectAssetSafety(assetWithValuation);

      expect(report.condition).toBe('B');
      expect(report.hasValuationRecord).toBe(true);
      expect(report.valuationAmount).toBe(35000000);
      expect(report.historicalRecords.some((r) => r.type === 'valuation')).toBe(true);
    });

    it('2.6 Kondisi A: Permits permanent deletion confirmation when asset is pristine and unreferenced', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockResolvedValueOnce([]);
      vi.spyOn(damageReportService, 'getReports').mockResolvedValueOnce([]);
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({ documents: [], stats: {} as any });

      const cleanAsset: ItemInventaris = {
        id: 'inv-clean-999',
        kode: 'TST-999',
        nama_alat: 'Kabel Dummy Input Salah',
        kategori: 'Kabel & Adapter',
        total_unit: 1,
        unit_tersedia: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        units: [
          {
            id: 'u-999-1',
            inventaris_id: 'inv-clean-999',
            kode_unit: 'TST-999-U01',
            nama_unit: 'Unit 1',
            kondisi: 'bagus',
            status_peminjaman: 'tersedia',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      };

      const report = await safetyService.inspectAssetSafety(cleanAsset);

      expect(report.condition).toBe('A');
      expect(report.activeBlockers.length).toBe(0);
      expect(report.historicalRecords.length).toBe(0);
      expect(report.summaryHeading).toContain('Aman Dihapus Permanen');
    });

    it('2.7 Fail-Closed: Throws clear error if dependency query fails', async () => {
      vi.spyOn(peminjamanService, 'getPeminjamanList').mockRejectedValueOnce(
        new Error('Network connectivity lost')
      );

      await expect(safetyService.inspectAssetSafety(sampleAsset)).rejects.toThrow(
        /Gagal memeriksa riwayat sirkulasi peminjaman/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SERVICE REPOSITORY EXECUTION & GUARDRAILS
  // ─────────────────────────────────────────────────────────────
  describe('3. Repository Deletion & Guardrails', () => {
    it('3.1 LocalInventarisService: Safely deletes and records audit trail', async () => {
      const localService = LocalInventarisService.getInstance();
      const testItem = await localService.createInventaris({
        kode: 'TST-DEL-01',
        nama_alat: 'Test Item to Delete',
        kategori: 'Lainnya',
        jumlah_unit: 1,
        lokasi_penyimpanan: 'Studio PTV',
      });

      expect(await localService.getInventarisById(testItem.id)).toBeDefined();

      const success = await localService.deleteInventaris(testItem.id, 'Duplikat input data');
      expect(success).toBe(true);

      const deleted = await localService.getInventarisById(testItem.id);
      expect(deleted).toBeNull();
    });

    it('3.2 SupabaseInventarisService: Enforces strict guardrail against destructive staging mutations', async () => {
      const supabaseService = SupabaseInventarisService.getInstance();

      await expect(
        supabaseService.deleteInventaris('some-uuid', 'Duplikat')
      ).rejects.toThrow(
        /Eksekusi Hard Delete Supabase Memerlukan Persetujuan Operator/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. DESIGN & COMPONENT HYGIENE CHECKS
  // ─────────────────────────────────────────────────────────────
  describe('4. Design & Component Architecture Verification', () => {
    const rootDir = process.cwd();
    const inventarisCss = fs.readFileSync(path.join(rootDir, 'src/styles/inventaris.css'), 'utf-8');
    const alatDetailPage = fs.readFileSync(path.join(rootDir, 'src/products/hub/inventaris/AlatDetailPage.tsx'), 'utf-8');
    const modalComponent = fs.readFileSync(path.join(rootDir, 'src/products/hub/inventaris/components/SmartDeleteInventarisModal.tsx'), 'utf-8');

    it('4.1 inventaris.css contains danger zone card and outline button styling', () => {
      expect(inventarisCss).toContain('.prod-danger-zone-card');
      expect(inventarisCss).toContain('.btn-danger-outline');
      expect(inventarisCss).toContain('border: 1.5px solid var(--dang');
      expect(inventarisCss).toContain('color: var(--dang');
    });

    it('4.2 inventaris.css contains comprehensive smart delete modal styles and dark mode', () => {
      expect(inventarisCss).toContain('.sdel-modal-card');
      expect(inventarisCss).toContain('.sdel-modal-overlay');
      expect(inventarisCss).toContain('.sdel-matrix-grid');
      expect(inventarisCss).toContain('.sdel-cond-panel.cond-c');
      expect(inventarisCss).toContain('.sdel-cond-panel.cond-b');
      expect(inventarisCss).toContain('.sdel-cond-panel.cond-a');
      expect(inventarisCss).toContain('[data-theme="dark"] .sdel-modal-card');
      expect(inventarisCss).toContain('[data-theme="dark"] .prod-danger-zone-card');
    });

    it('4.3 AlatDetailPage integrates permission check and renders danger zone at the bottom', () => {
      expect(alatDetailPage).toContain('canDeleteInventory');
      expect(alatDetailPage).toContain('SmartDeleteInventarisModal');
      expect(alatDetailPage).toContain('id="btnSmartDeleteAsset"');
      expect(alatDetailPage).toContain('className="btn-danger-outline"');
      expect(alatDetailPage).toContain('canDelete && (');
    });

    it('4.4 SmartDeleteInventarisModal implements exact code match, reason dropdown, and multi-tier assessment', () => {
      expect(modalComponent).toContain('isExactCodeMatched');
      expect(modalComponent).toContain('confirmationCode.trim() === asset.kode.trim()');
      expect(modalComponent).toContain('Duplikat');
      expect(modalComponent).toContain('Kesalahan Input');
      expect(modalComponent).toContain('Lainnya');
      expect(modalComponent).toContain('Status Kesiapan Backend Schema (Supabase)');
      expect(modalComponent).toContain('sdel-cond-panel cond-c');
      expect(modalComponent).toContain('sdel-cond-panel cond-b');
      expect(modalComponent).toContain('sdel-cond-panel cond-a');
    });
  });
});
