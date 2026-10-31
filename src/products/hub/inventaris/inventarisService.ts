import { ptvCache } from '@core/cache/ptvCache';
import {
  ItemInventaris,
  InventarisUnit,
  InventarisFilterParams,
  CreateInventarisDTO,
  UpdateInventarisDTO,
  NilaiInventarisRecord,
  KondisiUnit,
  StatusPeminjamanUnit,
  INVENTORY_CATEGORIES,
  InventoryCategory,
} from './types';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';
import { inventoryPortalRequest, usesInventoryPortal } from './services/inventoryPortalClient';

export { INVENTORY_CATEGORIES, type InventoryCategory };

export interface AvailableUnitItem {
  unit: InventarisUnit;
  item: ItemInventaris;
}

export interface NilaiFilterParams {
  q?: string;
  status?: string;
  cat?: string;
  source?: string;
  sortBy?: 'default' | 'val_desc' | 'val_asc' | 'date_desc' | 'name_asc';
}

export function applyNilaiInventarisFilters(items: ItemInventaris[], filters?: NilaiFilterParams): ItemInventaris[] {
  let rows = items.map((item) => {
    const unit_tersedia = item.units.filter(
      (u) => u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus'
    ).length;
    return {
      ...item,
      total_unit: item.units.length,
      unit_tersedia,
    };
  });

  // 1. Filter Kategori
  if (filters?.cat && filters.cat !== 'semua') {
    const targetCat = filters.cat.trim().toLowerCase();
    rows = rows.filter((x) => x.kategori.trim().toLowerCase() === targetCat);
  }

  // 2. Filter Status Nilai
  if (filters?.status && filters.status !== 'semua') {
    const stNorm = filters.status.trim().toLowerCase();
    if (['belum dicatat', 'belum_dicatat', 'belum_bernilai', 'unrecorded'].includes(stNorm)) {
      rows = rows.filter((x) => !x.nilai_inventaris || !(x.nilai_inventaris.nilai_perolehan > 0));
    } else if (stNorm === 'aktif') {
      rows = rows.filter(
        (x) =>
          Boolean(x.nilai_inventaris &&
          x.nilai_inventaris.nilai_perolehan > 0 &&
          x.nilai_inventaris.status.toLowerCase() === 'aktif')
      );
    } else {
      rows = rows.filter(
        (x) =>
          Boolean(x.nilai_inventaris &&
          x.nilai_inventaris.nilai_perolehan > 0 &&
          x.nilai_inventaris.status.toLowerCase() === stNorm)
      );
    }
  }

  // 3. Filter Sumber Dana
  if (filters?.source && filters.source !== 'semua') {
    const normSource = filters.source.trim().toLowerCase();
    rows = rows.filter((x) => {
      const s = x.nilai_inventaris?.sumber_perolehan || x.sumber_perolehan || 'Yayasan';
      return s.trim().toLowerCase() === normSource;
    });
  }

  // 4. Multi-token Search
  if (filters?.q && filters.q.trim()) {
    const tokens = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    rows = rows.filter((x) => {
      const v = x.nilai_inventaris;
      const invCode = x.kode;
      const unitCodes = x.units.map((u) => `${u.kode_unit} ${u.nomor_seri || ''} ${u.nama_unit || ''}`).join(' ');
      const text = [
        x.nama_alat,
        x.spesifikasi || '',
        x.kategori,
        invCode,
        unitCodes,
        v?.vendor || '',
        v?.nomor_invoice || '',
        v?.sumber_perolehan || x.sumber_perolehan || '',
        x.units[0]?.lokasi_penyimpanan || '',
      ].join(' ').toLowerCase();
      return tokens.every((tok) => text.includes(tok));
    });
  }

  // 5. Sorting
  const sortBy = filters?.sortBy || 'default';
  if (sortBy === 'val_desc') {
    rows.sort(
      (a, b) =>
        (b.nilai_inventaris?.nilai_perolehan || 0) -
          (a.nilai_inventaris?.nilai_perolehan || 0) ||
        a.nama_alat.localeCompare(b.nama_alat, 'id')
    );
  } else if (sortBy === 'val_asc') {
    rows.sort(
      (a, b) =>
        (a.nilai_inventaris?.nilai_perolehan || 0) -
          (b.nilai_inventaris?.nilai_perolehan || 0) ||
        a.nama_alat.localeCompare(b.nama_alat, 'id')
    );
  } else if (sortBy === 'date_desc') {
    rows.sort((a, b) => {
      const da = a.nilai_inventaris?.tanggal_perolehan || '';
      const db = b.nilai_inventaris?.tanggal_perolehan || '';
      if (!da && !db) return a.nama_alat.localeCompare(b.nama_alat, 'id');
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da) || a.nama_alat.localeCompare(b.nama_alat, 'id');
    });
  } else if (sortBy === 'name_asc') {
    rows.sort((a, b) => a.nama_alat.localeCompare(b.nama_alat, 'id'));
  }

  return rows;
}

/**
 * Test fixture exclusion guard:
 * Menyaring fixture pengujian spesifik `INV-977` (ID `ff39f521-a6aa-42ba-aa93-33b6c49941f6`)
 * agar tidak muncul dalam katalog/detail operasional, tanpa menyembunyikan item sah lain
 * yang mengandung kata 'STAGING' secara membabi buta.
 */
export const EXCLUDED_INVENTORY_FIXTURE_IDS = new Set([
  'ff39f521-a6aa-42ba-aa93-33b6c49941f6',
]);
export const EXCLUDED_INVENTORY_FIXTURE_CODES = new Set([
  'INV-977',
]);

export function isInventoryTestFixture(item: { id?: string; kode?: string; nama_alat?: string } | string | null | undefined): boolean {
  if (!item) return false;
  if (typeof item === 'string') {
    const clean = item.trim().toUpperCase();
    return EXCLUDED_INVENTORY_FIXTURE_IDS.has(item) || EXCLUDED_INVENTORY_FIXTURE_CODES.has(clean);
  }
  if (item.id && EXCLUDED_INVENTORY_FIXTURE_IDS.has(item.id)) return true;
  if (item.kode && EXCLUDED_INVENTORY_FIXTURE_CODES.has(item.kode.trim().toUpperCase())) return true;
  if (item.nama_alat) {
    const cleanName = item.nama_alat.trim().toLowerCase();
    if (cleanName === 'uji-staging — inventaris' || cleanName === 'uji-staging - inventaris') return true;
  }
  return false;
}

export interface IInventarisService {
  getInventarisList(filters?: InventarisFilterParams): Promise<ItemInventaris[]>;
  getInventarisById(id: string): Promise<ItemInventaris | null>;
  getAvailableUnits(): Promise<AvailableUnitItem[]>;
  getNextAvailableCode(): Promise<string>;
  createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris>;
  updateInventaris(dto: UpdateInventarisDTO): Promise<ItemInventaris>;
  uploadPhoto(file: File): Promise<string>;
  updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean>;
  getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]>;
  updateNilaiInventaris(assetId: string, data: Partial<NilaiInventarisRecord>): Promise<ItemInventaris>;
  deleteNilaiInventaris(assetId: string): Promise<boolean>;
  deleteInventaris(assetId: string, reason: string): Promise<boolean>;
}

/**
 * Normalizes any legacy, staging, or production category string into one of the 17 canonical categories.
 * Preserves legacy dashboard mapping from page-dasbor.php and ptv-dashboard-data-bridge.php.
 */
export function normalizeInventoryCategory(cat?: string | null): string {
  if (!cat) return 'Lainnya';
  const c = String(cat).trim();
  const lower = c.toLowerCase();
  if (lower === 'kamera' || lower === 'camera' || lower.startsWith('kamera')) return 'Kamera';
  if (lower === 'lensa' || lower === 'lens' || lower.startsWith('lensa')) return 'Lensa';
  if (lower.includes('tripod') || lower.includes('rig') || lower.includes('gimbal') || lower.includes('monopod') || lower.includes('stabilizer')) return 'Tripod';
  if (lower.includes('baterai') || lower.includes('battery') || lower.includes('batere') || lower.includes('powerbank') || lower.includes('v-mount') || lower.includes('vmount')) return 'Baterai & Power';
  if (lower.includes('smartphone') || lower.includes('tablet') || lower.includes('ipad') || lower.includes('iphone') || lower.includes('android') || lower.includes('hp')) return 'Smartphone / Tablet';
  if (lower.includes('komputer') || lower.includes('laptop') || lower.includes('pc') || lower.includes('macbook')) return 'Komputer / Laptop';
  if (lower === 'audio' || lower === 'mic' || lower === 'sound' || lower.startsWith('audio') || lower.startsWith('mic') || lower.includes('microphone') || lower.includes('headphone')) return 'Audio';
  if (lower.includes('light') || lower.includes('lampu') || lower.includes('lighting') || lower.includes('softbox') || lower.includes('led')) return 'Lighting';
  if (lower.includes('stream') || lower.includes('live') || lower.includes('switcher') || lower.includes('atem') || lower.includes('capture') || lower.includes('broadcast')) return 'Streaming / Live Production';
  if (lower.includes('kabel') || lower.includes('adapter') || lower.includes('cable') || lower.includes('hdmi') || lower.includes('type c') || lower.includes('charger')) return 'Kabel & Adapter';
  if (lower.includes('dry cabinet') || lower.includes('cabinet') || lower.includes('dry box')) return 'Dry Cabinet';
  if (lower.includes('smart tv') || lower.includes(' tv') || lower === 'tv' || lower.includes('televisi')) return 'TV / Smart TV';
  if (lower.includes('storage') || lower.includes('ssd') || lower.includes('hdd') || lower.includes('harddisk') || lower.includes('sd card') || lower.includes('cfexpress') || lower.includes('memory') || lower.includes('flashdisk')) return 'Storage';
  if (lower.includes('peralatan') || lower.includes('perkakas') || lower.includes('tool') || lower.includes('obeng') || lower.includes('tang') || lower.includes('solder')) return 'Peralatan & Perkakas';
  if (lower.includes('atk') || lower.includes('kertas') || lower.includes('alat tulis') || lower.includes('spidol') || lower.includes('pulpen')) return 'ATK';
  if (lower.includes('jaringan') || lower.includes('network') || lower.includes('router') || lower.includes('mikrotik') || lower.includes('switch hub') || lower.includes('access point') || lower.includes('wifi') || lower.includes('ethernet') || lower.includes('lan')) return 'Pengaturan Jaringan';
  return 'Lainnya';
}

/**
 * 3-level hierarchical sort algorithm matching sortInventoryItems() from legacy page-dasbor.php:
 * Level 1: Category canonical order (1 to 17)
 * Level 2: Equipment Name (natural A-Z, locale-sensitive)
 * Level 3: Equipment Code (A-Z tie-breaker)
 */
export function sortInventoryItems<T extends { nama_alat?: string; kode?: string; kategori?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const catOrder: Record<string, number> = {};
  INVENTORY_CATEGORIES.forEach((cat, idx) => {
    catOrder[cat] = idx + 1;
  });

  return items.slice().sort((a, b) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // LEVEL 1: Category Order
    const catA = normalizeInventoryCategory(a.kategori);
    const catB = normalizeInventoryCategory(b.kategori);
    const ordA = catOrder[catA] ?? 999;
    const ordB = catOrder[catB] ?? 999;
    if (ordA !== ordB) return ordA - ordB;

    if (catA !== catB) {
      const cmpCat = String(catA || '').localeCompare(String(catB || ''), 'id', { sensitivity: 'base', numeric: true });
      if (cmpCat !== 0) return cmpCat;
    }

    // LEVEL 2: Name A-Z within Category
    const nameA = String(a.nama_alat || '').trim();
    const nameB = String(b.nama_alat || '').trim();
    const cmpName = nameA.localeCompare(nameB, 'id', { sensitivity: 'base', numeric: true });
    if (cmpName !== 0) return cmpName;

    // LEVEL 3: Code A-Z
    const codeA = String(a.kode || '').trim();
    const codeB = String(b.kode || '').trim();
    return codeA.localeCompare(codeB, 'id', { sensitivity: 'base', numeric: true });
  });
}


/**
 * Normalizes any legacy, staging, or production condition string into a typed KondisiUnit.
 * Handles 'Baik' (Prod), 'bagus' (Staging), 'Rusak', 'Hilang', 'Butuh Servis', etc.
 */
export function normalizeKondisiUnit(cond?: string | null): KondisiUnit {
  // Fail-safe: jika kondisi tidak ada/null/kosong, jangan pernah anggap layak pinjam secara otomatis!
  if (!cond || !cond.trim()) return 'perlu_servis';
  const c = cond.toLowerCase().trim();
  if (c === 'baik' || c === 'bagus' || c === 'good') return 'bagus';
  if (c === 'rusak' || c === 'major_damage' || c === 'bad' || c === 'rusak berat') return 'rusak';
  if (c === 'hilang' || c === 'lost') return 'hilang';
  if (c.includes('servis') || c.includes('perbaikan') || c === 'perlu_servis' || c === 'minor_damage') return 'perlu_servis';
  // Fail-safe: jika string kondisi tidak dikenal, tandai perlu servis/inspeksi
  return 'perlu_servis';
}

/**
 * Checks whether a unit is available for loan based on BOTH condition and loan status.
 */
export function isUnitAvailable(status?: string | null, kondisi?: string | null): boolean {
  const normStatus = (status || 'tersedia').toLowerCase().trim();
  const normKondisi = normalizeKondisiUnit(kondisi);
  return normStatus === 'tersedia' && normKondisi === 'bagus';
}

/**
 * Computes descriptive operational status label based on unit breakdown.
 */
export function computeStatusOperasional(units: InventarisUnit[]): string {
  if (!units || units.length === 0) return 'Tidak Tersedia';
  const total = units.length;
  const avail = units.filter((u) => isUnitAvailable(u.status_peminjaman, u.kondisi)).length;
  const borrowed = units.filter((u) => (u.status_peminjaman || '').toLowerCase() === 'dipinjam').length;
  const damaged = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'rusak').length;
  const inService = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'perlu_servis').length;
  const lost = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'hilang').length;

  if (avail === total && total > 0) return 'Tersedia';
  if (avail > 0) return `${avail}/${total} Tersedia`;
  if (borrowed > 0) return borrowed === total ? 'Dipinjam' : `${borrowed} Dipinjam`;
  if (damaged > 0) return damaged === total ? 'Rusak' : `${damaged} Rusak`;
  if (inService > 0) return inService === total ? 'Butuh Servis' : `${inService} Servis`;
  if (lost > 0) return lost === total ? 'Hilang' : `${lost} Hilang`;
  return 'Tidak Tersedia';
}

/**
 * Local development repository for Inventaris module.
 * In-memory repository with authentic PTV studio equipment fixtures.
 */
const INITIAL_INVENTARIS_ITEMS: ItemInventaris[] = [
  {
    id: 'inv-001',
    kode: 'INV-001',
    nama_alat: 'Sony FX3 Cinema Line Full-Frame Camera',
    kategori: 'Kamera',
    spesifikasi: 'Sensor 12.1MP Exmor R CMOS, 4K 120p, 10-bit 4:2:2, Dual Base ISO 800/12800',
    total_unit: 2,
    unit_tersedia: 1,
    sumber_perolehan: 'Yayasan',
    harga_beli: 116000000,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
    nilai_inventaris: {
      id: 'val-inv-001',
      inventaris_id: 'inv-001',
      nilai_perolehan: 116000000,
      nilai_residu: 20000000,
      nilai_tercatat: 102000000,
      tanggal_perolehan: '2024-02-15',
      sumber_perolehan: 'Yayasan',
      vendor: 'Focus Nusantara Official',
      nomor_invoice: 'INV/FN/2024/0281',
      status: 'Aktif',
      catatan: 'Simulasi Nilai: Pembelian 2 unit Sony FX3 Cinema Line untuk kebutuhan produksi multicam studio utama.',
      created_by_name: 'Administrator Studio',
      created_at: '2024-02-15T10:00:00Z',
      updated_at: '2024-02-15T10:00:00Z',
    },
    units: [
      {
        id: 'unit-fx3-01',
        inventaris_id: 'inv-001',
        kode_unit: 'INV-001-U01',
        nomor_seri: 'SN-FX3-88291',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Lemari Kamera A1',
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-01-10T08:00:00Z',
      },
      {
        id: 'unit-fx3-02',
        inventaris_id: 'inv-001',
        kode_unit: 'INV-001-U02',
        nomor_seri: 'SN-FX3-88292',
        kondisi: 'bagus',
        status_peminjaman: 'dipinjam',
        lokasi_penyimpanan: 'Lemari Kamera A1',
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-01-10T08:00:00Z',
      },
    ],
  },
  {
    id: 'inv-002',
    kode: 'INV-002',
    nama_alat: 'Sony FE 24-70mm f/2.8 GM II Lens',
    kategori: 'Lensa',
    spesifikasi: 'Standard Zoom G Master, Aperture f/2.8, Filter 82mm, E-Mount',
    total_unit: 2,
    unit_tersedia: 2,
    sumber_perolehan: 'Yayasan',
    harga_beli: 67000000,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
    nilai_inventaris: {
      id: 'val-inv-002',
      inventaris_id: 'inv-002',
      nilai_perolehan: 67000000,
      nilai_residu: 10000000,
      nilai_tercatat: 61000000,
      tanggal_perolehan: '2024-03-01',
      sumber_perolehan: 'Yayasan',
      vendor: 'Doss Camera & Gadget',
      nomor_invoice: 'DOSS-INV-99214',
      status: 'Aktif',
      catatan: 'Simulasi Nilai: 2 unit lensa zoom standar G Master untuk pasangan kamera studio.',
      created_by_name: 'Administrator Studio',
      created_at: '2024-03-01T11:30:00Z',
      updated_at: '2024-03-01T11:30:00Z',
    },
    units: [
      {
        id: 'unit-lens-01',
        inventaris_id: 'inv-002',
        kode_unit: 'INV-002-U01',
        nomor_seri: 'SN-GM-11204',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Dry Box Dry-1',
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-01-10T08:00:00Z',
      },
      {
        id: 'unit-lens-02',
        inventaris_id: 'inv-002',
        kode_unit: 'INV-002-U02',
        nomor_seri: 'SN-GM-11205',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Dry Box Dry-1',
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-01-10T08:00:00Z',
      },
    ],
  },
  {
    id: 'inv-003',
    kode: 'INV-003',
    nama_alat: 'Rode Wireless PRO Dual Microphone System',
    kategori: 'Audio',
    spesifikasi: '2x Transmitter, 1x Receiver, 32-bit Float on-board recording, GainAssist, Timecode',
    total_unit: 3,
    unit_tersedia: 2,
    sumber_perolehan: 'Kas PTV',
    harga_beli: 22500000,
    created_at: '2026-01-12T08:00:00Z',
    updated_at: '2026-01-12T08:00:00Z',
    nilai_inventaris: {
      id: 'val-inv-003',
      inventaris_id: 'inv-003',
      nilai_perolehan: 22500000,
      nilai_residu: 3000000,
      nilai_tercatat: 19500000,
      tanggal_perolehan: '2024-04-10',
      sumber_perolehan: 'Kas PTV',
      vendor: 'JPC Kemang',
      nomor_invoice: 'JPC-2024-04192',
      status: 'Aktif',
      catatan: 'Simulasi Nilai: Kit wireless mic 32-bit float untuk liputan lapangan dan podcast studio.',
      created_by_name: 'Kru Teknis PTV',
      created_at: '2024-04-10T14:15:00Z',
      updated_at: '2024-04-10T14:15:00Z',
    },
    units: [
      {
        id: 'unit-rode-01',
        inventaris_id: 'inv-003',
        kode_unit: 'INV-003-U01',
        nomor_seri: 'SN-RW-9011',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Tas Audio Kit 1',
        created_at: '2026-01-12T08:00:00Z',
        updated_at: '2026-01-12T08:00:00Z',
      },
      {
        id: 'unit-rode-02',
        inventaris_id: 'inv-003',
        kode_unit: 'INV-003-U02',
        nomor_seri: 'SN-RW-9012',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Tas Audio Kit 1',
        created_at: '2026-01-12T08:00:00Z',
        updated_at: '2026-01-12T08:00:00Z',
      },
      {
        id: 'unit-rode-03',
        inventaris_id: 'inv-003',
        kode_unit: 'INV-003-U03',
        nomor_seri: 'SN-RW-9013',
        kondisi: 'perlu_servis',
        status_peminjaman: 'maintenance',
        lokasi_penyimpanan: 'Meja QC Technical',
        created_at: '2026-01-12T08:00:00Z',
        updated_at: '2026-01-12T08:00:00Z',
      },
    ],
  },
  {
    id: 'inv-004',
    kode: 'INV-004',
    nama_alat: 'Aputure Amaran 200d S Daylight LED Video Light',
    kategori: 'Lighting',
    spesifikasi: '200W Point-Source LED, 5600K CCT, Bowens Mount, Sidus Link App Control',
    total_unit: 2,
    unit_tersedia: 2,
    sumber_perolehan: 'Hibah Alumni',
    harga_beli: 14000000,
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-01-15T08:00:00Z',
    nilai_inventaris: {
      id: 'val-inv-004',
      inventaris_id: 'inv-004',
      nilai_perolehan: 14000000,
      nilai_residu: 2000000,
      nilai_tercatat: 12800000,
      tanggal_perolehan: '2024-05-20',
      sumber_perolehan: 'Hibah Alumni',
      vendor: 'Bhinneka',
      nomor_invoice: 'BHN-881290',
      status: 'Aktif',
      catatan: 'Simulasi Nilai: Paket 2 unit continuous light 200W Bowens mount studio podcast.',
      created_by_name: 'Administrator Studio',
      created_at: '2024-05-20T09:00:00Z',
      updated_at: '2024-05-20T09:00:00Z',
    },
    units: [
      {
        id: 'unit-light-01',
        inventaris_id: 'inv-004',
        kode_unit: 'INV-004-U01',
        nomor_seri: 'SN-APU-4401',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Rak Lighting Studio Lt 2',
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      },
      {
        id: 'unit-light-02',
        inventaris_id: 'inv-004',
        kode_unit: 'INV-004-U02',
        nomor_seri: 'SN-APU-4402',
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: 'Rak Lighting Studio Lt 2',
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      },
    ],
  },
  {
    id: 'inv-005',
    kode: 'INV-005',
    nama_alat: 'DJI RS 3 Pro Gimbal Stabilizer Combo',
    kategori: 'Stabilizer',
    spesifikasi: 'Carbon Fiber Arms, 4.5kg Payload, Automated Axis Locks, LiDAR Focusing Support',
    total_unit: 1,
    unit_tersedia: 0,
    sumber_perolehan: 'Yayasan',
    harga_beli: 0,
    created_at: '2026-01-20T08:00:00Z',
    updated_at: '2026-01-20T08:00:00Z',
    // Nilai inventaris sengaja belum dicatat untuk menguji empty state / "Belum Dicatat" KPI
    units: [
      {
        id: 'unit-dji-01',
        inventaris_id: 'inv-005',
        kode_unit: 'INV-005-U01',
        nomor_seri: 'SN-DJI-7719',
        kondisi: 'bagus',
        status_peminjaman: 'dipinjam',
        lokasi_penyimpanan: 'Koper Hardcase Gimbal',
        created_at: '2026-01-20T08:00:00Z',
        updated_at: '2026-01-20T08:00:00Z',
      },
    ],
  },
];

/**
 * Mengompresi berkas foto pada sisi klien (browser canvas) sebelum disimpan ke penyimpanan lokal.
 * Menghasilkan Data URL berukuran ringkas (~20-50KB) dengan resolusi max 800px dan JPEG quality 0.8
 * untuk mengeliminasi risiko DOMException: QuotaExceededError (batas 5MB localStorage).
 */
export async function compressImageForLocalPersistence(file: File): Promise<string> {
  // Jika lingkungan non-browser (misal Node.js Vitest tanpa DOM Canvas), fallback ke reader standar
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Gagal membaca file foto'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Gagal membaca file foto'));
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => reject(new Error('Gagal membaca file foto'));
          reader.readAsDataURL(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      reject(new Error('Format file foto rusak atau tidak dapat dimuat'));
    };
    img.src = objectUrl;
  });
}

export class LocalInventarisService implements IInventarisService {
  private static instance: LocalInventarisService;
  private items: ItemInventaris[];
  private storageKey = 'ptv_local_inventaris_items';

  constructor() {
    this.items = this.loadFromStorage();
  }

  private loadFromStorage(): ItemInventaris[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // fallback
    }
    return JSON.parse(JSON.stringify(INITIAL_INVENTARIS_ITEMS));
  }

  public saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.items));
      }
    } catch (err: any) {
      // Tangani QuotaExceededError secara terarah
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        err?.message?.toLowerCase().includes('quota') ||
        err?.message?.toLowerCase().includes('storage');

      if (isQuota && typeof window !== 'undefined' && window.localStorage) {
        console.warn('[LocalInventarisService] QuotaExceededError terdeteksi. Menjalankan fallback pelindung master data...');
        try {
          // Buang data foto besar pada item lama agar seluruh master data dan unit fisik TETAP TERSIMPAN
          const safeItems = this.items.map((item, idx) => {
            if (idx > 3 && item.foto_url && item.foto_url.startsWith('data:')) {
              return { ...item, foto_url: undefined };
            }
            return item;
          });
          window.localStorage.setItem(this.storageKey, JSON.stringify(safeItems));
        } catch {
          // Jika masih gagal, simpan seluruh metadata teks master + units tanpa foto
          try {
            const textOnlyItems = this.items.map((item) => ({ ...item, foto_url: undefined }));
            window.localStorage.setItem(this.storageKey, JSON.stringify(textOnlyItems));
          } catch (fatalErr) {
            console.error('[LocalInventarisService] Gagal menyimpan data lokal setelah optimasi:', fatalErr);
          }
        }
      }
    }
  }

  public reset(): void {
    this.items = JSON.parse(JSON.stringify(INITIAL_INVENTARIS_ITEMS));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch {
      // ignore
    }
  }

  public static getInstance(): LocalInventarisService {
    if (!LocalInventarisService.instance) {
      LocalInventarisService.instance = new LocalInventarisService();
    }
    return LocalInventarisService.instance;
  }

  async getInventarisList(filters?: InventarisFilterParams): Promise<ItemInventaris[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    let result = this.items.map((item) => {
      const unit_tersedia = item.units.filter(
        (u) => u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus'
      ).length;
      return {
        ...item,
        total_unit: item.units.length,
        unit_tersedia,
      };
    });

    if (filters?.kategori && filters.kategori !== 'all' && filters.kategori !== 'semua') {
      result = result.filter(
        (i) =>
          normalizeInventoryCategory(i.kategori).toLowerCase() === filters.kategori?.toLowerCase() ||
          i.kategori.toLowerCase() === filters.kategori?.toLowerCase()
      );
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'tersedia') {
        result = result.filter((i) => i.unit_tersedia > 0);
      } else if (filters.status === 'habis') {
        result = result.filter((i) => i.unit_tersedia === 0);
      }
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.nama_alat.toLowerCase().includes(q) ||
          i.kode.toLowerCase().includes(q) ||
          i.kategori.toLowerCase().includes(q) ||
          normalizeInventoryCategory(i.kategori).toLowerCase().includes(q) ||
          i.spesifikasi?.toLowerCase().includes(q) ||
          i.units.some((u) => u.kode_unit.toLowerCase().includes(q) || u.nomor_seri?.toLowerCase().includes(q))
      );
    }

    result = result.filter((i) => !isInventoryTestFixture(i));

    return sortInventoryItems(result);
  }

  async getInventarisById(id: string): Promise<ItemInventaris | null> {
    if (isInventoryTestFixture(id)) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const item = this.items.find((i) => i.id === id || i.kode === id);
    if (!item || isInventoryTestFixture(item)) return null;
    return {
      ...item,
      total_unit: item.units.length,
      unit_tersedia: item.units.filter((u) => u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus').length,
    };
  }

  async getAvailableUnits(): Promise<{ unit: InventarisUnit; item: ItemInventaris }[]> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const available: { unit: InventarisUnit; item: ItemInventaris }[] = [];

    for (const item of this.items) {
      for (const unit of item.units) {
        if (unit.status_peminjaman === 'tersedia' && unit.kondisi === 'bagus') {
          available.push({ unit, item });
        }
      }
    }

    return available;
  }

  async getNextAvailableCode(): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const usedNumbers = new Set<number>();
    for (const it of this.items) {
      const m = String(it.kode || '').trim().match(/^INV-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > 0) {
          usedNumbers.add(n);
        }
      }
    }
    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    return `INV-${String(candidate).padStart(3, '0')}`;
  }

  async createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!dto.kode || !dto.kode.trim() || !dto.nama_alat || !dto.nama_alat.trim()) {
      throw new Error('Kode alat dan Nama alat wajib diisi.');
    }

    const trimmedCode = dto.kode.trim().toUpperCase();

    // Validasi penanganan kode duplikat
    const isDuplicate = this.items.some((i) => i.kode.toUpperCase() === trimmedCode);
    if (isDuplicate) {
      throw new Error(`Kode inventaris "${trimmedCode}" sudah digunakan oleh alat lain.`);
    }

    const id = `inv-${Date.now().toString().slice(-4)}`;
    const count = dto.jumlah_unit > 0 ? dto.jumlah_unit : 1;

    const normalizeKondisi = (cond?: string): KondisiUnit => {
      if (!cond) return 'bagus';
      const c = cond.toLowerCase().trim();
      if (c === 'rusak' || c === 'major_damage' || c === 'bad' || c === 'rusak berat') {
        return 'rusak';
      }
      if (c === 'butuh servis' || c === 'perlu_servis' || c === 'servis' || c === 'minor_damage' || c === 'perlu perbaikan') {
        return 'perlu_servis';
      }
      return 'bagus';
    };

    const isGlobalBorrowed = dto.status_operasional?.toLowerCase() === 'dipinjam';
    const isGlobalDamaged = dto.status_operasional?.toLowerCase().includes('rusak') || dto.status_operasional?.toLowerCase().includes('servis');
    const isGlobalLost = dto.status_operasional?.toLowerCase() === 'hilang';

    const units: InventarisUnit[] = [];
    for (let i = 1; i <= count; i++) {
      const unitNum = i < 10 ? `0${i}` : `${i}`;
      const customUnit = dto.unit_items && dto.unit_items[i - 1];
      const kondisiVal: KondisiUnit = normalizeKondisi(customUnit?.kondisi);

      let statusVal: StatusPeminjamanUnit = 'tersedia';
      if (kondisiVal === 'rusak' || kondisiVal === 'perlu_servis') {
        statusVal = 'maintenance';
      }
      if (isGlobalBorrowed) {
        statusVal = 'dipinjam';
      } else if (isGlobalDamaged || isGlobalLost) {
        statusVal = 'maintenance';
      }

      units.push({
        id: `unit-${id}-${unitNum}`,
        inventaris_id: id,
        kode_unit: `${trimmedCode}-U${unitNum}`,
        nama_unit: customUnit?.nama_unit?.trim() || `Unit ${unitNum}`,
        nomor_seri: customUnit?.nomor_seri && customUnit.nomor_seri.trim() ? customUnit.nomor_seri.trim() : undefined,
        kondisi: kondisiVal,
        status_peminjaman: statusVal,
        lokasi_penyimpanan: customUnit?.lokasi_penyimpanan || dto.lokasi_penyimpanan || 'Studio PTV',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const unit_tersedia = units.filter((u) => u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus').length;

    const newItem: ItemInventaris = {
      id,
      kode: trimmedCode,
      nama_alat: dto.nama_alat.trim(),
      kategori: dto.kategori,
      brand: dto.brand?.trim() || undefined,
      model: dto.model?.trim() || undefined,
      spesifikasi: dto.spesifikasi?.trim() || undefined,
      lokasi_penyimpanan: dto.lokasi_penyimpanan?.trim() || 'Studio PTV',
      sumber_perolehan: dto.sumber_perolehan?.trim() || 'Yayasan',
      foto_url: dto.foto_url?.trim() || undefined,
      satuan: dto.satuan?.trim() || 'unit',
      status_operasional: dto.status_operasional?.trim() || 'Tersedia',
      total_unit: units.length,
      unit_tersedia,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      units,
    };

    this.items.unshift(newItem);
    this.saveToStorage();
    return newItem;
  }

  async updateInventaris(dto: UpdateInventarisDTO): Promise<ItemInventaris> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (!dto.nama_alat || !dto.nama_alat.trim()) {
      throw new Error('Nama alat wajib diisi.');
    }

    const idx = this.items.findIndex((x) => x.id === dto.id);
    if (idx === -1) {
      throw new Error(`Alat inventaris dengan id "${dto.id}" tidak ditemukan.`);
    }

    const current = this.items[idx];

    // Anti-cross-asset validation
    for (const u of dto.units) {
      const belongs = current.units.some((existing) => existing.id === u.id || existing.kode_unit === u.kode_unit);
      if (!belongs) {
        throw new Error(`Unit "${u.kode_unit || u.id}" bukan merupakan bagian dari alat ini.`);
      }
    }

    const updatedUnits: InventarisUnit[] = current.units.map((u) => {
      const incoming = dto.units.find((inc) => inc.id === u.id || inc.kode_unit === u.kode_unit);
      if (!incoming) return u;
      return {
        ...u,
        nama_unit: incoming.nama_unit?.trim() || u.nama_unit,
        nomor_seri: incoming.nomor_seri && incoming.nomor_seri.trim() ? incoming.nomor_seri.trim() : undefined,
        kondisi: incoming.kondisi || u.kondisi,
        lokasi_penyimpanan: incoming.lokasi_penyimpanan?.trim() || dto.lokasi_penyimpanan?.trim() || u.lokasi_penyimpanan,
        updated_at: new Date().toISOString(),
      };
    });

    const availCount = updatedUnits.filter((u) => u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus').length;

    const updatedItem: ItemInventaris = {
      ...current,
      nama_alat: dto.nama_alat.trim(),
      kategori: dto.kategori || current.kategori,
      brand: dto.brand?.trim() || current.brand,
      model: dto.model?.trim() || current.model,
      spesifikasi: dto.spesifikasi?.trim() || current.spesifikasi,
      sumber_perolehan: dto.sumber_perolehan?.trim() || current.sumber_perolehan,
      lokasi_penyimpanan: dto.lokasi_penyimpanan?.trim() || current.lokasi_penyimpanan,
      satuan: dto.satuan?.trim() || current.satuan,
      foto_url: dto.foto_url !== undefined ? (dto.foto_url || undefined) : current.foto_url,
      units: updatedUnits,
      unit_tersedia: availCount,
      updated_at: new Date().toISOString(),
    };

    this.items[idx] = updatedItem;
    this.saveToStorage();
    return updatedItem;
  }

  async uploadPhoto(file: File): Promise<string> {
    // 1. Validation size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('Ukuran file foto terlalu besar (Maksimal 15MB).');
    }
    // 2. Validate format
    const validExtensions = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const isImage = file.type ? file.type.startsWith('image/') : validExtensions.test(file.name);
    if (!isImage && !validExtensions.test(file.name)) {
      throw new Error('Format file tidak didukung. Harap pilih foto (JPG, PNG, WEBP, atau HEIC).');
    }

    // 3. Kompresi gambar client-side untuk mencegah QuotaExceededError pada penyimpanan browser lokal
    return compressImageForLocalPersistence(file);
  }

  async updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean> {
    for (const item of this.items) {
      const unit = item.units.find((u) => u.id === unitId || u.kode_unit === unitId);
      if (unit) {
        unit.status_peminjaman = status;
        if (kondisi) unit.kondisi = kondisi;
        unit.updated_at = new Date().toISOString();
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  async getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return applyNilaiInventarisFilters(this.items, filters);
  }

  async updateNilaiInventaris(assetId: string, data: Partial<NilaiInventarisRecord>): Promise<ItemInventaris> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const item = this.items.find((i) => i.id === assetId || i.kode === assetId);
    if (!item) {
      throw new Error(`Alat inventaris dengan id ${assetId} tidak ditemukan.`);
    }

    const current = item.nilai_inventaris;
    const updatedRecord: NilaiInventarisRecord = {
      id: current?.id || `val-${item.id}`,
      inventaris_id: item.id,
      nilai_perolehan: data.nilai_perolehan !== undefined ? Number(data.nilai_perolehan) : (current?.nilai_perolehan || 0),
      nilai_residu: data.nilai_residu !== undefined ? Number(data.nilai_residu) : current?.nilai_residu,
      nilai_tercatat: data.nilai_tercatat !== undefined ? Number(data.nilai_tercatat) : current?.nilai_tercatat,
      tanggal_perolehan: data.tanggal_perolehan || current?.tanggal_perolehan || new Date().toISOString().split('T')[0],
      sumber_perolehan: data.sumber_perolehan || current?.sumber_perolehan || item.sumber_perolehan || 'Yayasan',
      vendor: data.vendor !== undefined ? data.vendor : current?.vendor,
      nomor_invoice: data.nomor_invoice !== undefined ? data.nomor_invoice : current?.nomor_invoice,
      status: data.status || current?.status || 'Aktif',
      catatan: data.catatan !== undefined ? data.catatan : current?.catatan,
      dokumen_url: data.dokumen_url !== undefined ? data.dokumen_url : current?.dokumen_url,
      created_by_name: current?.created_by_name || 'Administrator Studio',
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    item.nilai_inventaris = updatedRecord;
    item.harga_beli = updatedRecord.nilai_perolehan;
    item.sumber_perolehan = updatedRecord.sumber_perolehan;
    item.updated_at = new Date().toISOString();
    this.saveToStorage();

    return { ...item };
  }

  async deleteNilaiInventaris(assetId: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const item = this.items.find((i) => i.id === assetId || i.kode === assetId);
    if (!item) return false;

    delete item.nilai_inventaris;
    item.harga_beli = 0;
    item.updated_at = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  async deleteInventaris(assetId: string, reason: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const idx = this.items.findIndex((i) => i.id === assetId || i.kode === assetId);
    if (idx === -1) return false;

    const [deletedItem] = this.items.splice(idx, 1);
    this.saveToStorage();

    // Record audit trail in local storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const logs = JSON.parse(window.localStorage.getItem('ptv_inventaris_audit_log') || '[]');
        logs.unshift({
          id: `audit-${Date.now()}`,
          action: 'DELETE_INVENTARIS',
          asset_id: deletedItem.id,
          asset_code: deletedItem.kode,
          asset_name: deletedItem.nama_alat,
          reason,
          timestamp: new Date().toISOString(),
        });
        window.localStorage.setItem('ptv_inventaris_audit_log', JSON.stringify(logs.slice(0, 100)));
      }
    } catch {
      // ignore
    }

    return true;
  }
}

/**
 * Supabase Cloud Live Repository for Inventaris module.
 * Integrates directly with Supabase Cloud schema (ptv_inventaris & ptv_inventaris_unit).
 * Adheres strictly to the authoritative DDL and contracted RPC rpc_get_next_inv_code.
 */
export class SupabaseInventarisService implements IInventarisService {
  private static instance: SupabaseInventarisService;
  private storageBucket = 'inventory'; // Target bucket (Phase 5D specification)

  private client() { return getSupabaseClient(); }

  public static getInstance(): SupabaseInventarisService {
    if (!SupabaseInventarisService.instance) {
      SupabaseInventarisService.instance = new SupabaseInventarisService();
    }
    return SupabaseInventarisService.instance;
  }

  async getInventarisList(filters?: InventarisFilterParams, valuationOnly = false): Promise<ItemInventaris[]> {
    const supabase = usesInventoryPortal() ? null : this.client();
    let query = supabase
      ?.from('ptv_inventaris')
      .select(`
        id,
        kode,
        nama_alat,
        kategori,
        spesifikasi,
        foto_url,
        harga_beli,
        sumber_perolehan,
        created_at,
        updated_at,
        units:ptv_inventaris_unit(
          id,
          inventaris_id,
          kode_unit,
          nama_unit,
          nomor_seri,
          kondisi,
          status_peminjaman,
          lokasi_penyimpanan,
          created_at,
          updated_at
        ),
        nilai:ptv_nilai_inventaris(
          id,
          inventaris_id,
          nilai_perolehan,
          nilai_buku_saat_ini,
          tanggal_valuasi,
          catatan_akuntansi,
          updated_at
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.search && query) {
      const q = filters.search.trim();
      query = query.or(`nama_alat.ilike.%${q}%,kode.ilike.%${q}%,kategori.ilike.%${q}%,spesifikasi.ilike.%${q}%`);
    }

    const { data, error } = usesInventoryPortal()
      ? await inventoryPortalRequest(valuationOnly ? 'valuations' : 'list', { search: filters?.search }, true)
      : await query!;
    if (error) {
      console.warn('[SupabaseInventarisService] Error fetching items:', error.message);
      throw new Error(`Gagal memuat data inventaris dari database: ${error.message}`);
    }

    if (!data) return [];

    const mapped: ItemInventaris[] = data.map((row: any) => {
      const units: InventarisUnit[] = (row.units || [])
        .map((u: any, idx: number) => ({
          id: u.id,
          inventaris_id: u.inventaris_id,
          kode_unit: u.kode_unit,
          nama_unit: u.nama_unit?.trim() || (u.kode_unit ? `Unit ${parseInt(u.kode_unit.split('-U')[1], 10) || idx + 1}` : `Unit ${idx + 1}`),
          nomor_seri: u.nomor_seri && u.nomor_seri.trim() ? u.nomor_seri.trim() : undefined,
          kondisi: normalizeKondisiUnit(u.kondisi),
          status_peminjaman: (u.status_peminjaman || 'tersedia').toLowerCase() as StatusPeminjamanUnit,
          lokasi_penyimpanan: u.lokasi_penyimpanan || 'Studio PTV',
          created_at: u.created_at,
          updated_at: u.updated_at,
        }))
        .sort((a: InventarisUnit, b: InventarisUnit) => {
          const codeA = a.kode_unit || '';
          const codeB = b.kode_unit || '';
          return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' });
        });

      const unit_tersedia = units.filter(
        (u) => isUnitAvailable(u.status_peminjaman, u.kondisi)
      ).length;

      const nilaiRecord = Array.isArray(row.nilai) ? row.nilai[0] : row.nilai;
      const nilai_inventaris: NilaiInventarisRecord | undefined = nilaiRecord
        ? {
            id: nilaiRecord.id,
            inventaris_id: row.id,
            nilai_perolehan: Number(nilaiRecord.nilai_perolehan || 0),
            nilai_tercatat: Number(nilaiRecord.nilai_buku_saat_ini || 0),
            tanggal_perolehan: nilaiRecord.tanggal_valuasi || row.created_at?.split('T')[0],
            sumber_perolehan: nilaiRecord.sumber_perolehan || row.sumber_perolehan || 'Yayasan',
            status: nilaiRecord.status || 'Aktif',
            nilai_residu: nilaiRecord.nilai_residu == null ? undefined : Number(nilaiRecord.nilai_residu),
            vendor: nilaiRecord.vendor || undefined,
            nomor_invoice: nilaiRecord.nomor_invoice || undefined,
            dokumen_url: nilaiRecord.dokumen_url || undefined,
            created_by_name: nilaiRecord.created_by_name || undefined,
            catatan: nilaiRecord.catatan_akuntansi ?? nilaiRecord.catatan ?? '',
            created_at: row.created_at,
            updated_at: nilaiRecord.updated_at || row.updated_at,
          }
        : undefined;

      return {
        id: row.id,
        kode: row.kode,
        nama_alat: row.nama_alat,
        kategori: row.kategori,
        spesifikasi: row.spesifikasi || undefined,
        lokasi_penyimpanan: units[0]?.lokasi_penyimpanan || 'Studio PTV',
        sumber_perolehan: row.sumber_perolehan || 'Yayasan',
        foto_url: row.foto_url || undefined,
        satuan: 'unit',
        status_operasional: computeStatusOperasional(units),
        total_unit: units.length,
        unit_tersedia,
        harga_beli: row.harga_beli ? Number(row.harga_beli) : undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        units,
        nilai_inventaris,
      };
    });

    let results = mapped;

    if (filters?.kategori && filters.kategori !== 'all' && filters.kategori !== 'semua') {
      results = results.filter(
        (i) =>
          normalizeInventoryCategory(i.kategori).toLowerCase() === filters.kategori?.toLowerCase() ||
          i.kategori.toLowerCase() === filters.kategori?.toLowerCase()
      );
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'tersedia') {
        results = results.filter((i) => i.unit_tersedia > 0);
      } else if (filters.status === 'habis') {
        results = results.filter((i) => i.unit_tersedia === 0);
      }
    }

    results = results.filter((i) => !isInventoryTestFixture(i));

    return sortInventoryItems(results);

  }

  async getInventarisById(id: string): Promise<ItemInventaris | null> {
    if (isInventoryTestFixture(id)) return null;
    const supabase = usesInventoryPortal() ? null : this.client();
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase
        ?.from('ptv_inventaris')
        .select(`
          id,
          kode,
          nama_alat,
          kategori,
          spesifikasi,
          foto_url,
          harga_beli,
          sumber_perolehan,
          created_at,
          updated_at,
          units:ptv_inventaris_unit(
            id,
            inventaris_id,
            kode_unit,
            nama_unit,
            nomor_seri,
            kondisi,
            status_peminjaman,
            lokasi_penyimpanan,
            created_at,
            updated_at
          ),
          nilai:ptv_nilai_inventaris(
            id,
            inventaris_id,
            nilai_perolehan,
            nilai_buku_saat_ini,
            tanggal_valuasi,
            catatan_akuntansi,
            updated_at
          )
        `);

      if (query && isUuid) {
        query = query.eq('id', id);
      } else if (query) {
        query = query.eq('kode', id);
      }

      const { data, error } = usesInventoryPortal()
        ? await inventoryPortalRequest('detail', { id }, true)
        : await query!.maybeSingle();
      if (usesInventoryPortal() && error) throw new Error(error.message);
      if (!error && data) {
        if (isInventoryTestFixture({ id: data.id, kode: data.kode })) {
          return null;
        }
        const units: InventarisUnit[] = (data.units || [])
          .map((u: any, idx: number) => ({
            id: u.id,
            inventaris_id: u.inventaris_id,
            kode_unit: u.kode_unit,
            nama_unit: u.nama_unit?.trim() || (u.kode_unit ? `Unit ${parseInt(u.kode_unit.split('-U')[1], 10) || idx + 1}` : `Unit ${idx + 1}`),
            nomor_seri: u.nomor_seri && u.nomor_seri.trim() ? u.nomor_seri.trim() : undefined,
            kondisi: normalizeKondisiUnit(u.kondisi),
            status_peminjaman: (u.status_peminjaman || 'tersedia').toLowerCase() as StatusPeminjamanUnit,
            lokasi_penyimpanan: u.lokasi_penyimpanan || 'Studio PTV',
            created_at: u.created_at,
            updated_at: u.updated_at,
          }))
          .sort((a: InventarisUnit, b: InventarisUnit) => {
            const codeA = a.kode_unit || '';
            const codeB = b.kode_unit || '';
            return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' });
          });

        const unit_tersedia = units.filter(
          (u) => isUnitAvailable(u.status_peminjaman, u.kondisi)
        ).length;

        const nilaiRecord = Array.isArray(data.nilai) ? data.nilai[0] : data.nilai;
        const nilai_inventaris: NilaiInventarisRecord | undefined = nilaiRecord
          ? {
              id: nilaiRecord.id,
              inventaris_id: data.id,
              nilai_perolehan: Number(nilaiRecord.nilai_perolehan || 0),
              nilai_tercatat: Number(nilaiRecord.nilai_buku_saat_ini || 0),
              tanggal_perolehan: nilaiRecord.tanggal_valuasi || data.created_at?.split('T')[0],
              sumber_perolehan: nilaiRecord.sumber_perolehan || data.sumber_perolehan || 'Yayasan',
              status: nilaiRecord.status || 'Aktif',
              nilai_residu: nilaiRecord.nilai_residu == null ? undefined : Number(nilaiRecord.nilai_residu),
              vendor: nilaiRecord.vendor || undefined,
              nomor_invoice: nilaiRecord.nomor_invoice || undefined,
              dokumen_url: nilaiRecord.dokumen_url || undefined,
              created_by_name: nilaiRecord.created_by_name || undefined,
              catatan: nilaiRecord.catatan_akuntansi ?? nilaiRecord.catatan ?? '',
              created_at: data.created_at,
              updated_at: nilaiRecord.updated_at || data.updated_at,
            }
          : undefined;

        return {
          id: data.id,
          kode: data.kode,
          nama_alat: data.nama_alat,
          kategori: data.kategori,
          spesifikasi: data.spesifikasi || undefined,
          lokasi_penyimpanan: units[0]?.lokasi_penyimpanan || 'Studio PTV',
          sumber_perolehan: data.sumber_perolehan || 'Yayasan',
          foto_url: data.foto_url || undefined,
          satuan: 'unit',
          status_operasional: computeStatusOperasional(units),
          total_unit: units.length,
          unit_tersedia,
          harga_beli: data.harga_beli ? Number(data.harga_beli) : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
          units,
          nilai_inventaris,
        };
      }
    } catch (error) {
      if (usesInventoryPortal()) throw error;
      // fallback to list search
    }

    const list = await this.getInventarisList();
    return list.find((i) => (i.id === id || i.kode === id) && !isInventoryTestFixture(i)) || null;
  }

  async getAvailableUnits(): Promise<AvailableUnitItem[]> {
    const list = await this.getInventarisList();
    const available: AvailableUnitItem[] = [];
    for (const item of list) {
      for (const unit of item.units) {
        if (isUnitAvailable(unit.status_peminjaman, unit.kondisi)) {
          available.push({ unit, item });
        }
      }
    }
    return available;
  }

  async getNextAvailableCode(): Promise<string> {
    if (usesInventoryPortal()) {
      const result = await inventoryPortalRequest('next-code', {}, true);
      if (result.error) throw new Error(result.error.message);
      return result.data as string;
    }
    const supabase = this.client();
    try {
      // 1. Try contracted RPC
      const { data, error } = await supabase.rpc('rpc_get_next_inv_code');
      if (!error && data && typeof data === 'string') {
        return data;
      }
    } catch {
      // fallback
    }

    // 2. Fallback: Query highest existing code from database
    const { data: rows } = await supabase
      .from('ptv_inventaris')
      .select('kode');

    const usedNumbers = new Set<number>();
    if (rows) {
      for (const r of rows) {
        const m = String(r.kode || '').trim().match(/^INV-(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > 0) usedNumbers.add(n);
        }
      }
    }

    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    return `INV-${String(candidate).padStart(3, '0')}`;
  }

  async createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris> {
    if (!dto.kode || !dto.kode.trim() || !dto.nama_alat || !dto.nama_alat.trim()) {
      throw new Error('Kode alat dan Nama alat wajib diisi.');
    }

    const trimmedCode = dto.kode.trim().toUpperCase();
    const supabase = usesInventoryPortal() ? null : this.client();

    // 1. Validasi awal duplikasi kode lokal sebelum request
    const { data: existing, error: existingErr } = usesInventoryPortal() ? { data: null, error: null } : await supabase!
      .from('ptv_inventaris')
      .select('id')
      .eq('kode', trimmedCode)
      .maybeSingle();

    if (existingErr && existingErr.code === '42501') {
      throw new Error('Akses Ditolak Database (RLS): Operasi simpan membutuhkan sesi terautentikasi dengan hak inventory.create.');
    }

    if (existing) {
      throw new Error(`Kode inventaris "${trimmedCode}" sudah digunakan oleh alat lain di database.`);
    }

    const generateFallbackUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

    const idempotencyKey =
      dto.idempotency_key ||
      dto.request_id ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : generateFallbackUUID());

    // 2. Siapkan master item row
    const masterInsert: Record<string, any> = {
      kode: trimmedCode,
      nama_alat: dto.nama_alat.trim(),
      kategori: dto.kategori,
      spesifikasi: dto.spesifikasi?.trim() || null,
      foto_url: dto.foto_url?.trim() || null,
      harga_beli: dto.harga_beli || null,
      sumber_perolehan: dto.sumber_perolehan?.trim() || 'Yayasan',
    };
    if (idempotencyKey) {
      masterInsert.id = idempotencyKey;
      masterInsert.request_id = idempotencyKey;
    }

    // 3. Siapkan unit payloads
    const count = dto.jumlah_unit > 0 ? dto.jumlah_unit : 1;
    const unitsPayloadBase: Array<{
      kode_unit: string;
      nomor_seri: string | null;
      kondisi: string;
      status_peminjaman: string;
      lokasi_penyimpanan: string;
    }> = [];

    for (let i = 1; i <= count; i++) {
      const unitNum = i < 10 ? `0${i}` : `${i}`;
      const customUnit = dto.unit_items && dto.unit_items[i - 1];

      let kondisiVal = 'bagus';
      if (customUnit?.kondisi) {
        const c = customUnit.kondisi.toLowerCase().trim();
        if (c.includes('rusak')) kondisiVal = 'rusak';
        else if (c.includes('servis')) kondisiVal = 'perlu_servis';
      }

      let statusVal = 'tersedia';
      if (kondisiVal !== 'bagus' || dto.status_operasional?.toLowerCase().includes('rusak')) {
        statusVal = 'maintenance';
      } else if (dto.status_operasional?.toLowerCase() === 'dipinjam') {
        statusVal = 'dipinjam';
      }

      unitsPayloadBase.push({
        kode_unit: `${trimmedCode}-U${unitNum}`,
        nomor_seri: customUnit?.nomor_seri?.trim() || null,
        kondisi: kondisiVal,
        status_peminjaman: statusVal,
        lokasi_penyimpanan: customUnit?.lokasi_penyimpanan?.trim() || dto.lokasi_penyimpanan?.trim() || 'Studio PTV',
      });
    }

    // Helper untuk membersihkan foto baru milik operasi ini jika transaksi simpan gagal definitif
    const cleanupOrphanPhoto = async () => {
      // Portal uploads are immutable and may already be referenced by a committed retry.
      if (usesInventoryPortal()) return;
      if (dto.foto_url && dto.foto_url.includes(`/storage/v1/object/public/${this.storageBucket}/`)) {
        try {
          const parts = dto.foto_url.split(`/storage/v1/object/public/${this.storageBucket}/`);
          if (parts[1]) {
            const fPath = parts[1];
            const { error: removeErr } = await supabase!.storage.from(this.storageBucket).remove([fPath]);
            if (removeErr) {
              console.warn(`[SupabaseInventarisService] Gagal membersihkan foto sementara (${fPath}):`, removeErr.message);
            }
          }
        } catch (cleanupErr) {
          console.warn('[SupabaseInventarisService] Error saat membersihkan foto:', cleanupErr);
        }
      }
    };

    // Helper untuk memeriksa apakah error terindikasi timeout atau gangguan jaringan
    const isTimeoutOrNetworkError = (e: any): boolean => {
      if (!e) return false;
      const msg = (e.message || '').toLowerCase();
      const code = e.code || '';
      return (
        msg.includes('timeout') ||
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('abort') ||
        msg.includes('koneksi database timeout') ||
        msg.includes('koneksi database terputus') ||
        code === '57014' ||
        code === 'PGRST000' ||
        code === 'PGRST001' ||
        code === '504'
      );
    };

    // Helper rekonsiliasi deterministik berbasis ID pengajuan / idempotency key
    const tryReconcileById = async (id: string): Promise<ItemInventaris | null> => {
      try {
        if (usesInventoryPortal()) return null; // Retry the actor-scoped atomic RPC; never infer success by ID alone.
        const { data: reconciled } = await supabase!
          .from('ptv_inventaris')
          .select('id, kode, foto_url')
          .eq('id', id)
          .maybeSingle();

        if (reconciled && reconciled.id) {
          const fetched = await this.getInventarisById(reconciled.id);
          if (fetched) return fetched;
        }
      } catch (reconErr) {
        console.warn('[SupabaseInventarisService] Gagal menjalankan rekonsiliasi ID:', reconErr);
      }
      return null;
    };

    // 4. Eksekusi RPC Database Atomik Tunggal (rpc_create_inventaris)
    // Sesuai aturan: Pembuatan master dan units WAJIB 100% atomik. Dilarang fallback 2-step.
    try {
      const args = {
        p_master: masterInsert,
        p_units: unitsPayloadBase,
      };
      const { data: rpcData, error: rpcError } = usesInventoryPortal()
        ? await inventoryPortalRequest('create', args)
        : await supabase!.rpc('rpc_create_inventaris', args);

      if (!rpcError && rpcData) {
        const createdId = typeof rpcData === 'string' ? rpcData : (rpcData as any).id;
        const fetched = await this.getInventarisById(createdId);
        if (fetched) return fetched;
        throw new Error('Alat berhasil disimpan di database tetapi gagal dimuat kembali.');
      }

      if (rpcError) {
        // A. Penanganan Timeout / Koneksi Terputus dengan Rekonsiliasi Database Sebelum Hapus Foto
        if (isTimeoutOrNetworkError(rpcError)) {
          if (idempotencyKey) {
            const reconciled = await tryReconcileById(idempotencyKey);
            if (reconciled) return reconciled;
          }

          // PENTING (Aturan 1): Jika respons timeout dan hasil pencarian masih kosong,
          // status transaksi di database TETAP BELUM DIKETAHUI.
          // DILARANG LANGSUNG MENGHAPUS FOTO atau menganggap gagal definitif!
          throw new Error(
            `Koneksi database timeout/terputus (${rpcError.message}). ` +
            `Status pengajuan inventaris di database belum dapat dipastikan. ` +
            `Foto dan data aman tersimpan sementara. Silakan coba kembali (retry) untuk memverifikasi pengajuan.`
          );
        }

        // B. Function RPC Belum Terpasang (PGRST202 / 42883)
        const isRpcMissing =
          rpcError.code === '42883' ||
          rpcError.code === 'PGRST202' ||
          (rpcError.message?.toLowerCase().includes('function') && rpcError.message?.toLowerCase().includes('does not exist'));

        if (isRpcMissing) {
          await cleanupOrphanPhoto();
          throw new Error(
            'Database Konfigurasi Belum Siap: Function RPC "rpc_create_inventaris" belum diterapkan di database Supabase staging. ' +
            'Silakan minta DBA/Admin menjalankan migrasi "docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql". ' +
            'Fallback non-atomik dilarang demi integritas data master dan unit.'
          );
        }

        // C. RLS Permission Violation / Ownership (42501)
        if (rpcError.code === '42501') {
          await cleanupOrphanPhoto();
          if (rpcError.message?.includes('kepemilikan akun lain') || rpcError.message?.includes('FORBIDDEN')) {
            throw new Error(`Akses Ditolak Database: ${rpcError.message}`);
          }
          throw new Error('Akses Ditolak Database (RLS): Operasi simpan membutuhkan sesi terautentikasi dengan hak inventory.create.');
        }

        // D. Unique Constraint / Duplikasi Kode / Idempotency Conflict (23505)
        if (rpcError.code === '23505') {
          await cleanupOrphanPhoto();
          if (rpcError.message?.includes('IDEMPOTENCY_CONFLICT')) {
            throw new Error(`Konflik Idempotensi: ${rpcError.message}`);
          }
          throw new Error(`Kode inventaris "${trimmedCode}" sudah digunakan di database (konflik unik/konkurensi).`);
        }

        // E. Error Umum Database Lainnya
        await cleanupOrphanPhoto();
        throw new Error(`Gagal menyimpan alat ke database (RPC Error: ${rpcError.message})`);
      }
    } catch (err: any) {
      if (isTimeoutOrNetworkError(err)) {
        if (idempotencyKey) {
          const reconciled = await tryReconcileById(idempotencyKey);
          if (reconciled) return reconciled;
        }

        // Pertahankan foto dan lempar error status belum diketahui
        throw new Error(
          `Koneksi database timeout/terputus (${err.message || 'Network error'}). ` +
          `Status pengajuan inventaris di database belum dapat dipastikan. ` +
          `Foto dan data aman tersimpan sementara. Silakan coba kembali (retry) untuk memverifikasi pengajuan.`
        );
      }

      if (err.message && (
        err.message.includes('Akses Ditolak') ||
        err.message.includes('sudah digunakan') ||
        err.message.includes('Database Konfigurasi Belum Siap') ||
        err.message.includes('Status pengajuan inventaris di database belum dapat dipastikan') ||
        err.message.includes('Gagal menyimpan alat')
      )) {
        throw err;
      }

      await cleanupOrphanPhoto();
      throw err;
    }

    throw new Error('Gagal memproses pembuatan inventaris secara atomik.');
  }

  async updateInventaris(dto: UpdateInventarisDTO): Promise<ItemInventaris> {
    if (!dto.id || !dto.id.trim()) {
      throw new Error('ID master alat wajib ada untuk operasi edit.');
    }
    if (!dto.nama_alat || !dto.nama_alat.trim()) {
      throw new Error('Nama alat tidak boleh kosong.');
    }

    const supabase = usesInventoryPortal() ? null : this.client();

    const masterPayload: Record<string, any> = {
      id: dto.id,
      nama_alat: dto.nama_alat.trim(),
      kategori: dto.kategori,
      spesifikasi: dto.spesifikasi?.trim() || null,
      sumber_perolehan: dto.sumber_perolehan?.trim() || null,
      lokasi_penyimpanan: dto.lokasi_penyimpanan?.trim() || null,
    };
    if (dto.foto_url !== undefined) {
      masterPayload.foto_url = dto.foto_url?.trim() || null;
    }
    if (dto.expected_updated_at) {
      masterPayload.expected_updated_at = dto.expected_updated_at;
    }

    const unitsPayload = (dto.units || []).map((u) => ({
      id: u.id,
      kode_unit: u.kode_unit,
      nama_unit: u.nama_unit?.trim() || null,
      nomor_seri: u.nomor_seri && u.nomor_seri.trim() ? u.nomor_seri.trim() : null,
      kondisi: u.kondisi || 'bagus',
      lokasi_penyimpanan: u.lokasi_penyimpanan?.trim() || dto.lokasi_penyimpanan?.trim() || null,
    }));

    const args = {
      p_master: masterPayload,
      p_units: unitsPayload,
    };
    const { error: rpcError } = usesInventoryPortal()
      ? await inventoryPortalRequest('update', args)
      : await supabase!.rpc('rpc_update_inventaris', args);

    if (rpcError) {
      if (rpcError.code === '42501') {
        throw new Error(`Akses Ditolak Database (RLS): ${rpcError.message}`);
      }
      if (rpcError.code === '40001' || rpcError.message?.includes('CONCURRENCY_CONFLICT')) {
        throw new Error('Konflik Konkurensi: Data alat telah diubah oleh pengguna lain. Silakan muat ulang halaman sebelum menyimpan perubahan.');
      }
      if (rpcError.code === '42883' || rpcError.code === 'PGRST202') {
        throw new Error(
          'Database Konfigurasi Belum Siap: Function RPC "rpc_update_inventaris" belum diterapkan di database Supabase staging. ' +
          'Silakan minta Administrator menjalankan migrasi "docs/PTV-PRO-STAGING-INVENTARIS-EDIT-PATCH.sql".'
        );
      }
      throw new Error(`Gagal memperbarui alat: ${rpcError.message}`);
    }

    const fetched = await this.getInventarisById(dto.id);
    if (fetched) return fetched;
    throw new Error('Alat berhasil diperbarui di database tetapi gagal dimuat kembali.');
  }

  async uploadPhoto(file: File): Promise<string> {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('Ukuran file foto terlalu besar (Maksimal 15MB).');
    }
    const validExtensions = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const isImage = file.type ? file.type.startsWith('image/') : validExtensions.test(file.name);
    if (!isImage && !validExtensions.test(file.name)) {
      throw new Error('Format file tidak didukung. Harap pilih foto (JPG, PNG, WEBP, atau HEIC).');
    }

    if (usesInventoryPortal()) {
      let upload: Blob = file;
      if (file.size > 4 * 1024 * 1024) {
        const compressed = await compressImageForLocalPersistence(file);
        upload = await (await fetch(compressed)).blob();
      }
      if (upload.size > 4 * 1024 * 1024) throw new Error('Foto belum dapat dipadatkan untuk unggahan. Pilih foto yang lebih kecil.');
      const response = await fetch('/api/inventaris?action=upload', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': upload.type },
        body: upload, signal: AbortSignal.timeout(30000),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true || typeof body.data !== 'string') throw new Error(body.error || 'Unggahan belum dikonfirmasi server.');
      return body.data;
    }
    const supabase = this.client();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `catalog/${fileName}`;

    // Target bucket terverifikasi secara eksplisit (strictly this.storageBucket = 'inventory')
    // Dilarang mencoba fallback ke bucket public lain ketika upload gagal.
    const targetBucket = this.storageBucket;
    const uploadRes = await supabase.storage
      .from(targetBucket)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadRes.error) {
      throw new Error(
        `Gagal mengunggah foto ke penyimpanan cloud (${uploadRes.error.message}). ` +
        `Pastikan storage bucket "${this.storageBucket}" telah dibuat dan kebijakan akses write telah diizinkan.`
      );
    }

    const { data: pubData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
    if (!pubData || !pubData.publicUrl) {
      throw new Error('Gagal memperoleh URL publik foto dari Supabase Storage.');
    }

    return pubData.publicUrl;
  }

  async updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean> {
    if (usesInventoryPortal()) {
      const result = await inventoryPortalRequest('unit-status', { unitId, status, kondisi });
      if (result.error) throw new Error(result.error.message);
      return result.data === true;
    }
    const supabase = this.client();
    const updatePayload: Record<string, any> = { status_peminjaman: status, updated_at: new Date().toISOString() };
    if (kondisi) updatePayload.kondisi = kondisi;

    const { error } = await supabase
      .from('ptv_inventaris_unit')
      .update(updatePayload)
      .eq('id', unitId);

    return !error;
  }

  async getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]> {
    const items = await this.getInventarisList(undefined, true);
    return applyNilaiInventarisFilters(items, filters);
  }

  async updateNilaiInventaris(assetId: string, data: Partial<NilaiInventarisRecord>): Promise<ItemInventaris> {
    if (usesInventoryPortal()) {
      const result = await inventoryPortalRequest('valuation-save', { assetId, data });
      if (result.error) throw new Error(result.error.message);
      const item = await this.getInventarisById(assetId);
      if (!item) throw new Error('Nilai tersimpan tetapi alat belum dapat dimuat ulang.');
      return item;
    }
    const supabase = this.client();
    const item = await this.getInventarisById(assetId);
    if (!item) throw new Error(`Alat dengan id ${assetId} tidak ditemukan.`);

    const payload = {
      inventaris_id: item.id,
      nilai_perolehan: data.nilai_perolehan || 0,
      nilai_buku_saat_ini: data.nilai_tercatat || data.nilai_perolehan || 0,
      tanggal_valuasi: data.tanggal_perolehan || new Date().toISOString().split('T')[0],
      catatan_akuntansi: data.catatan || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('ptv_nilai_inventaris').upsert(payload, { onConflict: 'inventaris_id' });
    if (error) throw new Error('Nilai inventaris belum tersimpan. Periksa izin akses dan coba lagi.');
    return (await this.getInventarisById(assetId)) as ItemInventaris;
  }

  async deleteNilaiInventaris(assetId: string): Promise<boolean> {
    if (usesInventoryPortal()) {
      const result = await inventoryPortalRequest('valuation-delete', { assetId });
      if (result.error) throw new Error(result.error.message);
      return result.data === true;
    }
    const supabase = this.client();
    const item = await this.getInventarisById(assetId);
    if (!item) return false;

    const { error } = await supabase.from('ptv_nilai_inventaris').delete().eq('inventaris_id', item.id);
    return !error;
  }

  async deleteInventaris(_assetId: string, _reason: string): Promise<boolean> {
    // Guardrail: Do NOT mutate staging database or perform destructive deletion without operator approval
    throw new Error(
      'Eksekusi Hard Delete Supabase Memerlukan Persetujuan Operator: Function RPC "rpc_delete_inventaris" dan trigger audit trail belum diaktifkan di database staging demi melindungi integritas relasi. Silakan ajukan persetujuan migrasi.'
    );
  }
}

export interface IntegrationDiagnostics {
  activeBackend: 'local' | 'supabase';
  supabaseConfigured: boolean;
  supabaseUrl: string;
  authSessionType: 'mock_local' | 'gotrue_jwt' | 'portal_cookie' | 'none';
  tables: {
    ptv_inventaris: boolean;
    ptv_inventaris_unit: boolean;
  };
  storage: {
    bucketTarget: string;
    bucketExists: boolean;
    missingRequirementNotice?: string;
  };
  rlsWritePermission: {
    hasPermission: boolean;
    notice?: string;
  };
}

/**
 * Unified Inventaris Service Manager
 * Provides dynamic adapter switching between local browser persistence and live Supabase Cloud.
 */
export class InventarisServiceManager implements IInventarisService {
  private static instance: InventarisServiceManager;
  private localService: LocalInventarisService;
  private supabaseService: SupabaseInventarisService;
  private mode: 'local' | 'supabase' = 'local';

  constructor() {
    this.localService = LocalInventarisService.getInstance();
    this.supabaseService = SupabaseInventarisService.getInstance();
    if (usesInventoryPortal()) {
      this.mode = 'supabase';
      return;
    }

    // 1. Prioritaskan env variabel eksplisit VITE_INVENTARIS_BACKEND jika ditentukan
    const explicitBackend = import.meta.env.VITE_INVENTARIS_BACKEND;
    if (explicitBackend === 'supabase' || explicitBackend === 'local') {
      this.mode = explicitBackend;
    } else {
      // 2. Cek preferensi runtime yang tersimpan di localStorage browser
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedBackend = window.localStorage.getItem('ptv_inventaris_backend');
        if (savedBackend === 'supabase' || savedBackend === 'local') {
          this.mode = savedBackend;
          return;
        }
      }

      const isStagingOrProd = import.meta.env.VITE_APP_ENV === 'staging' || import.meta.env.VITE_APP_ENV === 'production';
      if (isStagingOrProd && isSupabaseConfigured()) {
        this.mode = 'supabase';
      } else {
        this.mode = 'local';
      }
    }
  }

  public static getInstance(): InventarisServiceManager {
    if (!InventarisServiceManager.instance) {
      InventarisServiceManager.instance = new InventarisServiceManager();
    }
    return InventarisServiceManager.instance;
  }

  public getActiveBackend(): 'local' | 'supabase' {
    return this.mode;
  }

  public isLiveMode(): boolean {
    return this.mode === 'supabase';
  }

  public setBackendAdapter(mode: 'local' | 'supabase'): void {
    if (usesInventoryPortal() && mode === 'local') throw new Error('Sesi Portal tidak dapat dialihkan ke Inventaris mock.');
    this.mode = mode;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('ptv_inventaris_backend', mode);
      }
    } catch {
      // ignore
    }
  }

  public reset(): void {
    this.localService.reset();
  }

  private get activeService(): IInventarisService {
    return this.mode === 'supabase' ? this.supabaseService : this.localService;
  }

  async getInventarisList(filters?: InventarisFilterParams): Promise<ItemInventaris[]> {
    return this.activeService.getInventarisList(filters);
  }

  async getInventarisById(id: string): Promise<ItemInventaris | null> {
    return this.activeService.getInventarisById(id);
  }

  async getAvailableUnits(): Promise<AvailableUnitItem[]> {
    return this.activeService.getAvailableUnits();
  }

  async getNextAvailableCode(): Promise<string> {
    return this.activeService.getNextAvailableCode();
  }

  async createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris> {
    const result = await this.activeService.createInventaris(dto);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async updateInventaris(dto: UpdateInventarisDTO): Promise<ItemInventaris> {
    const result = await this.activeService.updateInventaris(dto);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async uploadPhoto(file: File): Promise<string> {
    return this.activeService.uploadPhoto(file);
  }

  async updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean> {
    const result = await this.activeService.updateUnitStatus(unitId, status, kondisi);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]> {
    return this.activeService.getNilaiInventarisList(filters);
  }

  async updateNilaiInventaris(assetId: string, data: Partial<NilaiInventarisRecord>): Promise<ItemInventaris> {
    const result = await this.activeService.updateNilaiInventaris(assetId, data);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async deleteNilaiInventaris(assetId: string): Promise<boolean> {
    const result = await this.activeService.deleteNilaiInventaris(assetId);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async deleteInventaris(assetId: string, reason: string): Promise<boolean> {
    const result = await this.activeService.deleteInventaris(assetId, reason);
    ptvCache.invalidate('inventaris_catalog_list');
    ptvCache.invalidate('beranda_aggregated_data');
    return result;
  }

  async getIntegrationDiagnostics(): Promise<IntegrationDiagnostics> {
    if (usesInventoryPortal()) {
      const result = await inventoryPortalRequest('diagnostics', {}, true);
      if (result.error) throw new Error(result.error.message);
      return { activeBackend: 'supabase', supabaseConfigured: true, supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        authSessionType: 'portal_cookie', tables: { ptv_inventaris: true, ptv_inventaris_unit: true },
        storage: { bucketTarget: 'inventory', bucketExists: result.data.bucketExists },
        rlsWritePermission: { hasPermission: result.data.canCreate, notice: 'Otorisasi dilakukan server berdasarkan sesi Portal dan capability live.' } };
    }
    const isConfigured = isSupabaseConfigured();
    const supabase = getSupabaseClient();

    let bucketExists = false;
    let tablesOk = false;

    if (isConfigured) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        bucketExists = Array.isArray(buckets) && buckets.some((b) => b.name === 'inventory' || b.name === 'ptvpro-media-public');
      } catch {
        bucketExists = false;
      }

      try {
        const { error } = await supabase.from('ptv_inventaris').select('id').limit(1);
        tablesOk = !error;
      } catch {
        tablesOk = false;
      }
    }

    return {
      activeBackend: this.mode,
      supabaseConfigured: isConfigured,
      supabaseUrl: isConfigured ? (import.meta.env.VITE_SUPABASE_URL || '') : 'http://localhost:54321',
      authSessionType: 'mock_local',
      tables: {
        ptv_inventaris: tablesOk,
        ptv_inventaris_unit: tablesOk,
      },
      storage: {
        bucketTarget: 'inventory',
        bucketExists,
        missingRequirementNotice: bucketExists
          ? undefined
          : 'Storage bucket "inventory" belum dibuat di Supabase Staging. Unggahan foto menggunakan buffer Base64 sementara.',
      },
      rlsWritePermission: {
        hasPermission: false,
        notice: 'Operasi INSERT ptv_inventaris memerlukan peran authenticated dengan kapabilitas inventory.create. Klien anonim diblokir oleh RLS (HTTP 401 code 42501).',
      },
    };
  }
}

export const localInventarisService = LocalInventarisService.getInstance();
export const supabaseInventarisService = SupabaseInventarisService.getInstance();
export const inventarisService = InventarisServiceManager.getInstance();
