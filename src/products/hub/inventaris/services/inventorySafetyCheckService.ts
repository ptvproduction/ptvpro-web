import { ItemInventaris } from '../types';
import { isUnitAvailable } from '../inventarisService';
import { peminjamanService } from '../../peminjaman/peminjamanService';
import { PeminjamanRecord } from '../../peminjaman/types';
import { damageReportService } from '../../lapor-kerusakan/damageReportService';
import { DamageReportItem } from '../../lapor-kerusakan/types';
import { dokumenService } from '../../dokumen-saya/dokumenService';
import { PtvDocument } from '../../dokumen-saya/mock/docsMockData';

export type InventorySafetyCondition = 'A' | 'B' | 'C';

export interface ActiveBlockerInfo {
  type: 'loan' | 'damage' | 'document' | 'unit_status';
  title: string;
  detail: string;
  meta?: string;
}

export interface HistoricalRecordInfo {
  type: 'loan_history' | 'damage_history' | 'document_history' | 'valuation';
  title: string;
  count: number;
  summary: string;
}

export interface InventorySafetyCheckReport {
  assetId: string;
  assetKode: string;
  assetNama: string;
  kategori: string;
  totalUnits: number;
  availableUnits: number;
  borrowedUnits: number;

  // Active Blockers (Condition C)
  activeLoans: PeminjamanRecord[];
  activeDamageReports: DamageReportItem[];
  activeDocuments: PtvDocument[];
  activeBlockers: ActiveBlockerInfo[];

  // Historical Records (Condition B)
  historicalLoans: PeminjamanRecord[];
  historicalDamageReports: DamageReportItem[];
  relatedDocuments: PtvDocument[];
  hasValuationRecord: boolean;
  valuationAmount: number;
  historicalRecords: HistoricalRecordInfo[];

  // Evaluated Condition
  condition: InventorySafetyCondition;
  summaryHeading: string;
  summaryMessage: string;
  resolutionGuidance?: string;
}

export class InventorySafetyCheckService {
  /**
   * Run full safety and relational integrity audit for a specific asset.
   * Connects to canonical services (peminjamanService, damageReportService, dokumenService).
   */
  async inspectAssetSafety(asset: ItemInventaris): Promise<InventorySafetyCheckReport> {
    if (!asset || !asset.id) {
      throw new Error('Data aset inventaris tidak valid untuk pemeriksaan keamanan.');
    }

    const validUnitIds = new Set<string>();
    const validUnitCodes = new Set<string>();

    if (asset.id) validUnitIds.add(String(asset.id).trim().toLowerCase());
    if (asset.kode) validUnitCodes.add(String(asset.kode).trim().toLowerCase());

    const units = Array.isArray(asset.units) ? asset.units : [];
    for (const u of units) {
      if (u.id) validUnitIds.add(String(u.id).trim().toLowerCase());
      if (u.kode_unit) validUnitCodes.add(String(u.kode_unit).trim().toLowerCase());
    }

    const cleanAssetName = (asset.nama_alat || '').trim().toLowerCase();
    const cleanAssetCode = (asset.kode || '').trim().toLowerCase();

    // 1. Fetch Loans & Circulation
    let allLoans: PeminjamanRecord[] = [];
    try {
      allLoans = await peminjamanService.getPeminjamanList();
    } catch (err: any) {
      console.warn('[InventorySafetyCheck] Failed to fetch loans:', err.message);
      throw new Error(`Gagal memeriksa riwayat sirkulasi peminjaman: ${err.message}`);
    }

    const matchedLoans = allLoans.filter((l) => {
      const uId = (l.unit_id || '').trim().toLowerCase();
      const uCode = (l.kode_unit || '').trim().toLowerCase();
      const iName = (l.nama_alat || '').trim().toLowerCase();

      if (uId && validUnitIds.has(uId)) return true;
      if (uCode && validUnitCodes.has(uCode)) return true;
      if (cleanAssetName && iName === cleanAssetName) return true;
      return false;
    });

    const activeLoans: PeminjamanRecord[] = [];
    const historicalLoans: PeminjamanRecord[] = [];

    matchedLoans.forEach((l) => {
      const status = (l.status || '').toLowerCase().trim();
      const isReturned = status === 'dikembalikan' || Boolean(l.tanggal_kembali);
      if (isReturned) {
        historicalLoans.push(l);
      } else {
        activeLoans.push(l);
      }
    });

    // 2. Fetch Damage Reports
    let allDamageReports: DamageReportItem[] = [];
    try {
      allDamageReports = await damageReportService.getReports().catch(() => []);
    } catch (err: any) {
      console.warn('[InventorySafetyCheck] Damage reports warning:', err?.message);
      // Non-fatal fallback to empty
      allDamageReports = [];
    }

    const matchedDamage = allDamageReports.filter((d) => {
      const aId = (d.assetId || '').trim().toLowerCase();
      const uId = (d.unitId || '').trim().toLowerCase();
      const uCode = (d.unitCode || '').trim().toLowerCase();
      const aName = (d.assetName || '').trim().toLowerCase();

      if (aId && validUnitIds.has(aId)) return true;
      if (uId && validUnitIds.has(uId)) return true;
      if (uCode && validUnitCodes.has(uCode)) return true;
      if (cleanAssetName && aName === cleanAssetName) return true;
      return false;
    });

    const activeDamageReports: DamageReportItem[] = [];
    const historicalDamageReports: DamageReportItem[] = [];

    matchedDamage.forEach((d) => {
      const st = (d.status || '').trim();
      if (st === 'Selesai' || st === 'Rusak Total') {
        historicalDamageReports.push(d);
      } else {
        activeDamageReports.push(d);
      }
    });

    // 3. Fetch Related Documents (Surat Izin Bawa Barang, Surat Tugas, etc.)
    let allDocs: PtvDocument[] = [];
    try {
      const [archiveRes, myRes] = await Promise.all([
        dokumenService.getDocuments('archive', true).catch(() => ({ documents: [] })),
        dokumenService.getDocuments('my', true).catch(() => ({ documents: [] })),
      ]);
      const map = new Map<string, PtvDocument>();
      [...archiveRes.documents, ...myRes.documents].forEach((doc) => {
        if (doc && doc.id) map.set(doc.id, doc);
      });
      allDocs = Array.from(map.values());
    } catch (err: any) {
      console.warn('[InventorySafetyCheck] Docs warning:', err?.message);
      allDocs = [];
    }

    const matchedDocs = allDocs.filter((doc) => {
      const items = Array.isArray(doc.items) ? doc.items : [];
      const hasItemMatch = items.some((it) => {
        const itStr = String(it || '').trim().toLowerCase();
        if (itStr.includes(cleanAssetCode)) return true;
        if (cleanAssetName && itStr.includes(cleanAssetName)) return true;
        for (const c of validUnitCodes) {
          if (c && itStr.includes(c)) return true;
        }
        return false;
      });

      if (hasItemMatch) return true;
      const subj = (doc.subject || '').toLowerCase();
      if (subj.includes(cleanAssetCode)) return true;
      return false;
    });

    const activeDocuments: PtvDocument[] = [];
    const relatedDocuments: PtvDocument[] = [];

    matchedDocs.forEach((doc) => {
      const st = (doc.status || '').toLowerCase().trim();
      if (st === 'menunggu' || st === 'revisi') {
        activeDocuments.push(doc);
      } else {
        relatedDocuments.push(doc);
      }
    });

    // 4. Physical Units Status Check
    const totalUnits = units.length || asset.total_unit || 1;
    const availableUnits = units.filter((u) => isUnitAvailable(u.status_peminjaman, u.kondisi)).length;
    const borrowedUnits = units.filter((u) => (u.status_peminjaman || '').toLowerCase() === 'dipinjam').length;

    // 5. Valuation / Accounting Check
    const valuationAmount = Number(
      asset.nilai_inventaris?.nilai_perolehan ||
      asset.nilai_inventaris?.nilai_tercatat ||
      asset.harga_beli ||
      0
    );
    const hasValuationRecord = Boolean(
      asset.nilai_inventaris &&
      (valuationAmount > 0 || asset.nilai_inventaris.id)
    );

    // 6. Assemble Active Blockers (Condition C)
    const activeBlockers: ActiveBlockerInfo[] = [];

    if (borrowedUnits > 0 || activeLoans.length > 0) {
      activeBlockers.push({
        type: 'loan',
        title: `${activeLoans.length || borrowedUnits} Unit Sedang Dipinjam`,
        detail: activeLoans.length > 0
          ? activeLoans.map((l) => `${l.peminjam_nama} (${l.kode_unit || 'Unit'} - Tenggat: ${l.tenggat_kembali || '—'})`).join(', ')
          : `${borrowedUnits} unit fisik terdata dengan status peminjaman aktif di sistem.`,
      });
    }

    if (activeDamageReports.length > 0) {
      activeBlockers.push({
        type: 'damage',
        title: `${activeDamageReports.length} Laporan Kerusakan Sedang Diproses`,
        detail: activeDamageReports.map((d) => `${d.title} (${d.status})`).join(', '),
      });
    }

    if (activeDocuments.length > 0) {
      activeBlockers.push({
        type: 'document',
        title: `${activeDocuments.length} Pengajuan Surat / Dokumen Aktif`,
        detail: activeDocuments.map((d) => `${docLabel(d)} (${d.status})`).join(', '),
      });
    }

    // 7. Assemble Historical Records (Condition B)
    const historicalRecords: HistoricalRecordInfo[] = [];

    if (historicalLoans.length > 0) {
      historicalRecords.push({
        type: 'loan_history',
        title: 'Riwayat Peminjaman Selesai',
        count: historicalLoans.length,
        summary: `Terdapat ${historicalLoans.length} transaksi peminjaman dan pengembalian yang telah diselesaikan.`,
      });
    }

    if (historicalDamageReports.length > 0) {
      historicalRecords.push({
        type: 'damage_history',
        title: 'Log Riwayat Perbaikan & Kerusakan',
        count: historicalDamageReports.length,
        summary: `Terdapat ${historicalDamageReports.length} rekam jejak pemeriksaan QC dan perbaikan unit.`,
      });
    }

    if (relatedDocuments.length > 0) {
      historicalRecords.push({
        type: 'document_history',
        title: 'Arsip Surat & Dokumen Resmi',
        count: relatedDocuments.length,
        summary: `Tercatat pada ${relatedDocuments.length} surat tugas atau izin membawa barang dinas.`,
      });
    }

    if (hasValuationRecord) {
      historicalRecords.push({
        type: 'valuation',
        title: 'Pencatatan Valuasi Keuangan Lembaga',
        count: 1,
        summary: `Memiliki data nilai perolehan akuntansi resmi (Rp ${valuationAmount.toLocaleString('id-ID')}).`,
      });
    }

    // 8. Determine Safety Condition
    let condition: InventorySafetyCondition = 'A';
    let summaryHeading = 'Aman Dihapus Permanen';
    let summaryMessage = 'Aset tidak memiliki peminjaman aktif, tidak ada rekam jejak transaksi peminjaman, tidak ada dokumen terkait, dan tidak memiliki dependensi yang harus dipertahankan.';
    let resolutionGuidance: string | undefined = undefined;

    if (activeBlockers.length > 0) {
      condition = 'C';
      summaryHeading = 'Tindakan Destruktif Diblokir: Aset Memiliki Aktivitas Aktif';
      summaryMessage = `Aset "${asset.nama_alat}" tidak dapat dihapus atau diarsipkan saat ini karena masih memiliki ${activeBlockers.length} jenis aktivitas operasional yang berjalan.`;
      resolutionGuidance = 'Selesaikan seluruh proses sirkulasi (kembalikan unit yang dipinjam, tuntaskan proses QC laporan kerusakan, dan selesaikan pengajuan surat) sebelum mengubah status aset ini.';
    } else if (historicalRecords.length > 0) {
      condition = 'B';
      summaryHeading = 'Aset Memiliki Rekam Jejak Historis (Penghapusan Permanen Ditolak)';
      summaryMessage = `Aset "${asset.nama_alat}" tidak sedang dipinjam, tetapi memiliki ${historicalRecords.length} kategori data historis. Menghapus aset ini secara permanen akan merusak integritas log sirkulasi dan jejak audit lembaga.`;
      resolutionGuidance = 'Gunakan opsi "Arsipkan Inventaris". Aset akan disembunyikan dari katalog operasional aktif tanpa menghilangkan identitas fisik, barcode unit, dan jejak histori peminjaman.';
    }

    return {
      assetId: asset.id,
      assetKode: asset.kode,
      assetNama: asset.nama_alat,
      kategori: asset.kategori,
      totalUnits,
      availableUnits,
      borrowedUnits,

      activeLoans,
      activeDamageReports,
      activeDocuments,
      activeBlockers,

      historicalLoans,
      historicalDamageReports,
      relatedDocuments,
      hasValuationRecord,
      valuationAmount,
      historicalRecords,

      condition,
      summaryHeading,
      summaryMessage,
      resolutionGuidance,
    };
  }
}

function docLabel(doc: PtvDocument): string {
  return doc.no && doc.no !== '—' ? `${doc.no} - ${doc.type}` : doc.subject || doc.type || 'Dokumen';
}

export const inventorySafetyCheckService = new InventorySafetyCheckService();
