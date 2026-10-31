import { describe, it, expect } from 'vitest';
import { INITIAL_LOST_FOUND_FIXTURES } from '@products/hub/lost-found/fixtures';
import { LostFoundItem, LostFoundFilterTab } from '@products/hub/lost-found/types';
import { INITIAL_DAMAGE_REPORT_FIXTURES, AVAILABLE_STUDIO_ASSETS } from '@products/hub/lapor-kerusakan/fixtures';
import { DamageReportItem, DamageFilterTab, DamageStatus } from '@products/hub/lapor-kerusakan/types';
import { SimulatedUnitCondition } from '@products/hub/lapor-kerusakan/DamageReportContext';

describe('Modul Lost & Found — Data Contract & Workflows', () => {
  it('harus memiliki fixtures awal dengan status dan tipe yang valid', () => {
    expect(INITIAL_LOST_FOUND_FIXTURES.length).toBeGreaterThanOrEqual(6);
    
    INITIAL_LOST_FOUND_FIXTURES.forEach((item) => {
      expect(['hilang', 'temuan']).toContain(item.type);
      expect(['Dicari', 'Ditemukan', 'Dikembalikan']).toContain(item.status);
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.reporterName).toBeTruthy();
      expect(item.reporterContact).toBeTruthy();
    });
  });

  it('harus memfilter daftar barang berdasarkan filter tab aktif', () => {
    const filterItems = (items: LostFoundItem[], tab: LostFoundFilterTab) => {
      if (tab === 'Semua') return items;
      return items.filter((item) => item.status === tab);
    };

    const all = filterItems(INITIAL_LOST_FOUND_FIXTURES, 'Semua');
    const dicari = filterItems(INITIAL_LOST_FOUND_FIXTURES, 'Dicari');
    const ditemukan = filterItems(INITIAL_LOST_FOUND_FIXTURES, 'Ditemukan');
    const dikembalikan = filterItems(INITIAL_LOST_FOUND_FIXTURES, 'Dikembalikan');

    expect(all.length).toBe(INITIAL_LOST_FOUND_FIXTURES.length);
    expect(dicari.every((i) => i.status === 'Dicari')).toBe(true);
    expect(ditemukan.every((i) => i.status === 'Ditemukan')).toBe(true);
    expect(dikembalikan.every((i) => i.status === 'Dikembalikan')).toBe(true);
  });

  it('harus mendukung pencarian teks bebas pada judul, deskripsi, lokasi, dan pelapor', () => {
    const search = (items: LostFoundItem[], q: string) => {
      const term = q.toLowerCase();
      return items.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.description.toLowerCase().includes(term) ||
          i.location.toLowerCase().includes(term) ||
          i.reporterName.toLowerCase().includes(term)
      );
    };

    const lensResults = search(INITIAL_LOST_FOUND_FIXTURES, 'Sony');
    expect(lensResults.length).toBeGreaterThanOrEqual(1);
    expect(lensResults[0].title).toContain('Sony');

    const studioResults = search(INITIAL_LOST_FOUND_FIXTURES, 'Studio');
    expect(studioResults.length).toBeGreaterThanOrEqual(1);
  });

  it('harus membentuk tautan WhatsApp dengan format wa.me yang valid dan pesan pre-filled', () => {
    const item = INITIAL_LOST_FOUND_FIXTURES[0];
    const cleanNumber = item.reporterContact.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(`Halo ${item.reporterName}, terkait barang "${item.title}" di PTV PRO...`)}`;

    expect(waUrl).toContain('https://wa.me/62');
    expect(waUrl).toContain(encodeURIComponent(item.title));
  });

  it('harus memvalidasi aturan permission: hanya pemilik atau eksekutif yang dapat menyelesaikan laporan', () => {
    const canManageReport = (item: LostFoundItem, isExecutive: boolean) => {
      return isExecutive || Boolean(item.isCurrentUser);
    };

    const myItem: LostFoundItem = {
      ...INITIAL_LOST_FOUND_FIXTURES[0],
      isCurrentUser: true,
    };
    const otherItem: LostFoundItem = {
      ...INITIAL_LOST_FOUND_FIXTURES[1],
      isCurrentUser: false,
    };

    expect(canManageReport(myItem, false)).toBe(true);
    expect(canManageReport(otherItem, false)).toBe(false);
    expect(canManageReport(otherItem, true)).toBe(true);
  });

  it('harus mengubah status menjadi Dikembalikan ketika diselesaikan', () => {
    let items = [...INITIAL_LOST_FOUND_FIXTURES];
    const targetId = items[0].id;

    items = items.map((i) => (i.id === targetId ? { ...i, status: 'Dikembalikan' as const } : i));

    const updated = items.find((i) => i.id === targetId);
    expect(updated?.status).toBe('Dikembalikan');
  });

  it('harus menghapus laporan dari list secara lokal', () => {
    let items = [...INITIAL_LOST_FOUND_FIXTURES];
    const targetId = items[0].id;
    const initialCount = items.length;

    items = items.filter((i) => i.id !== targetId);
    expect(items.length).toBe(initialCount - 1);
    expect(items.find((i) => i.id === targetId)).toBeUndefined();
  });
});

describe('Modul Lapor Kerusakan — Data Contract & Unit Integrity', () => {
  it('harus memiliki daftar asset studio yang valid dengan unit spesifik', () => {
    expect(AVAILABLE_STUDIO_ASSETS.length).toBeGreaterThanOrEqual(5);

    AVAILABLE_STUDIO_ASSETS.forEach((asset) => {
      expect(asset.id).toBeTruthy();
      expect(asset.name).toBeTruthy();
      expect(asset.units.length).toBeGreaterThanOrEqual(1);
      asset.units.forEach((u) => {
        expect(u.unitNumber).toBeGreaterThan(0);
        expect(u.unitCode).toContain(asset.id.toUpperCase());
      });
    });
  });

  it('harus memiliki fixtures laporan kerusakan awal yang konsisten', () => {
    expect(INITIAL_DAMAGE_REPORT_FIXTURES.length).toBeGreaterThanOrEqual(5);

    INITIAL_DAMAGE_REPORT_FIXTURES.forEach((rep) => {
      expect(rep.id).toBeTruthy();
      expect(rep.assetId).toBeTruthy();
      expect(rep.unitNumber).toBeGreaterThan(0);
      expect(['Baru', 'Sedang Dicek', 'Dalam Perbaikan', 'Selesai', 'Rusak Total']).toContain(rep.status);
      expect(['Ringan', 'Sedang', 'Berat']).toContain(rep.severity);
    });
  });

  it('harus mengubah kondisi unit fisik menjadi rusak saat laporan baru dibuat', () => {
    let unitConditions: SimulatedUnitCondition[] = [
      { assetId: 'inv-001', unitNumber: 1, unitCode: 'INV-001-U01', isDamaged: false },
      { assetId: 'inv-001', unitNumber: 2, unitCode: 'INV-001-U02', isDamaged: true },
    ];

    const markUnitDamaged = (conditions: SimulatedUnitCondition[], assetId: string, unitNumber: number, unitCode: string) => {
      const exists = conditions.some((u) => u.assetId === assetId && u.unitNumber === unitNumber);
      if (exists) {
        return conditions.map((u) => (u.assetId === assetId && u.unitNumber === unitNumber ? { ...u, isDamaged: true } : u));
      }
      return [...conditions, { assetId, unitNumber, unitCode, isDamaged: true }];
    };

    // Laporkan unit 1 rusak
    unitConditions = markUnitDamaged(unitConditions, 'inv-001', 1, 'INV-001-U01');
    const u1 = unitConditions.find((u) => u.assetId === 'inv-001' && u.unitNumber === 1);
    expect(u1?.isDamaged).toBe(true);
  });

  it('harus memulihkan kondisi unit fisik menjadi normal hanya jika status QC adalah Selesai', () => {
    let unitCondition: SimulatedUnitCondition = {
      assetId: 'inv-001',
      unitNumber: 2,
      unitCode: 'INV-001-U02',
      isDamaged: true,
    };

    const handleQC = (condition: SimulatedUnitCondition, qcStatus: DamageStatus): SimulatedUnitCondition => {
      if (qcStatus === 'Selesai') {
        return { ...condition, isDamaged: false };
      }
      return { ...condition, isDamaged: true };
    };

    // Sedang Dicek -> tetap rusak
    unitCondition = handleQC(unitCondition, 'Sedang Dicek');
    expect(unitCondition.isDamaged).toBe(true);

    // Dalam Perbaikan -> tetap rusak
    unitCondition = handleQC(unitCondition, 'Dalam Perbaikan');
    expect(unitCondition.isDamaged).toBe(true);

    // Rusak Total -> tetap rusak, TIDAK boleh pulih
    unitCondition = handleQC(unitCondition, 'Rusak Total');
    expect(unitCondition.isDamaged).toBe(true);

    // Selesai -> unit pulih
    unitCondition = handleQC(unitCondition, 'Selesai');
    expect(unitCondition.isDamaged).toBe(false);
  });

  it('harus mengunci form QC secara permanen jika status laporan mencapai Selesai', () => {
    const createUpdatedReport = (rep: DamageReportItem, qcStatus: DamageStatus, qcNotes: string): DamageReportItem => {
      const isCompleted = qcStatus === 'Selesai';
      return {
        ...rep,
        status: qcStatus,
        qcNotes,
        qcDate: '2026-10-16',
        qcBy: 'Roup (Eksekutif)',
        qcLocked: isCompleted,
      };
    };

    const initialRep = INITIAL_DAMAGE_REPORT_FIXTURES[0]; // status Baru
    const inProgressRep = createUpdatedReport(initialRep, 'Dalam Perbaikan', 'Komponen LCD diganti');
    expect(inProgressRep.qcLocked).toBe(false);

    const completedRep = createUpdatedReport(inProgressRep, 'Selesai', 'Selesai kalibrasi dan uji rekam');
    expect(completedRep.qcLocked).toBe(true);
    expect(completedRep.status).toBe('Selesai');
  });

  it('harus menghitung metrik ringkasan kartu statistik secara akurat', () => {
    const calculateStats = (reports: DamageReportItem[]) => {
      return {
        baru: reports.filter((r) => r.status === 'Baru').length,
        dicek: reports.filter((r) => r.status === 'Sedang Dicek').length,
        perbaikan: reports.filter((r) => r.status === 'Dalam Perbaikan').length,
        selesai: reports.filter((r) => r.status === 'Selesai').length,
        rusakTotal: reports.filter((r) => r.status === 'Rusak Total').length,
        total: reports.length,
      };
    };

    const stats = calculateStats(INITIAL_DAMAGE_REPORT_FIXTURES);
    expect(stats.total).toBe(INITIAL_DAMAGE_REPORT_FIXTURES.length);
    expect(stats.baru + stats.dicek + stats.perbaikan + stats.selesai + stats.rusakTotal).toBe(stats.total);
  });

  it('harus memfilter daftar kerusakan berdasarkan tab filter operasional', () => {
    const filterReports = (reports: DamageReportItem[], tab: DamageFilterTab) => {
      if (tab === 'Semua') return reports;
      if (tab === 'Perlu Tindakan') return reports.filter((r) => r.status === 'Baru' || r.status === 'Sedang Dicek');
      if (tab === 'Dalam Proses') return reports.filter((r) => r.status === 'Sedang Dicek' || r.status === 'Dalam Perbaikan');
      if (tab === 'Selesai') return reports.filter((r) => r.status === 'Selesai');
      return reports;
    };

    const tabs: DamageFilterTab[] = ['Semua', 'Perlu Tindakan', 'Dalam Proses', 'Selesai'];
    tabs.forEach((tab) => {
      const filtered = filterReports(INITIAL_DAMAGE_REPORT_FIXTURES, tab);
      if (tab === 'Semua') {
        expect(filtered.length).toBe(INITIAL_DAMAGE_REPORT_FIXTURES.length);
      } else if (tab === 'Perlu Tindakan') {
        expect(filtered.every((r) => r.status === 'Baru' || r.status === 'Sedang Dicek')).toBe(true);
      } else if (tab === 'Dalam Proses') {
        expect(filtered.every((r) => r.status === 'Sedang Dicek' || r.status === 'Dalam Perbaikan')).toBe(true);
      } else if (tab === 'Selesai') {
        expect(filtered.every((r) => r.status === 'Selesai')).toBe(true);
      }
    });
  });
});
