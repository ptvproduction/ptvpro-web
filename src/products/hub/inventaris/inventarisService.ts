import { ItemInventaris, InventarisUnit, InventarisFilterParams, CreateInventarisDTO, NilaiInventarisRecord } from './types';

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

export interface IInventarisService {
  getInventarisList(filters?: InventarisFilterParams): Promise<ItemInventaris[]>;
  getInventarisById(id: string): Promise<ItemInventaris | null>;
  getAvailableUnits(): Promise<AvailableUnitItem[]>;
  createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris>;
  updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean>;
  getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]>;
  updateNilaiInventaris(assetId: string, data: Partial<NilaiInventarisRecord>): Promise<ItemInventaris>;
  deleteNilaiInventaris(assetId: string): Promise<boolean>;
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

export class LocalInventarisService implements IInventarisService {
  private static instance: LocalInventarisService;
  private items: ItemInventaris[];

  constructor() {
    this.items = JSON.parse(JSON.stringify(INITIAL_INVENTARIS_ITEMS));
  }

  public reset(): void {
    this.items = JSON.parse(JSON.stringify(INITIAL_INVENTARIS_ITEMS));
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

    if (filters?.kategori && filters.kategori !== 'all') {
      result = result.filter(
        (i) => i.kategori.toLowerCase() === filters.kategori?.toLowerCase()
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
          i.spesifikasi?.toLowerCase().includes(q) ||
          i.units.some((u) => u.kode_unit.toLowerCase().includes(q) || u.nomor_seri?.toLowerCase().includes(q))
      );
    }

    return result;
  }

  async getInventarisById(id: string): Promise<ItemInventaris | null> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const item = this.items.find((i) => i.id === id || i.kode === id);
    if (!item) return null;
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

  async createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!dto.kode || !dto.kode.trim() || !dto.nama_alat || !dto.nama_alat.trim()) {
      throw new Error('Kode alat dan Nama alat wajib diisi.');
    }

    const id = `inv-${Date.now().toString().slice(-4)}`;
    const count = dto.jumlah_unit > 0 ? dto.jumlah_unit : 1;

    const units: InventarisUnit[] = [];
    for (let i = 1; i <= count; i++) {
      const unitNum = i < 10 ? `0${i}` : `${i}`;
      units.push({
        id: `unit-${id}-${unitNum}`,
        inventaris_id: id,
        kode_unit: `${dto.kode}-U${unitNum}`,
        kondisi: 'bagus',
        status_peminjaman: 'tersedia',
        lokasi_penyimpanan: dto.lokasi_penyimpanan || 'Studio Lt 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const newItem: ItemInventaris = {
      id,
      kode: dto.kode.toUpperCase(),
      nama_alat: dto.nama_alat,
      kategori: dto.kategori,
      spesifikasi: dto.spesifikasi,
      total_unit: units.length,
      unit_tersedia: units.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      units,
    };

    this.items.unshift(newItem);
    return newItem;
  }

  async updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean> {
    for (const item of this.items) {
      const unit = item.units.find((u) => u.id === unitId || u.kode_unit === unitId);
      if (unit) {
        unit.status_peminjaman = status;
        if (kondisi) unit.kondisi = kondisi;
        unit.updated_at = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  async getNilaiInventarisList(filters?: NilaiFilterParams): Promise<ItemInventaris[]> {
    await new Promise((resolve) => setTimeout(resolve, 60));

    let rows = this.items.map((item) => {
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
      const targetCat = filters.cat.toLowerCase();
      rows = rows.filter((x) => x.kategori.toLowerCase() === targetCat);
    }

    // 2. Filter Status Nilai
    if (filters?.status && filters.status !== 'semua') {
      const stNorm = filters.status.trim().toLowerCase();
      if (['belum dicatat', 'belum_dicatat', 'belum_bernilai', 'unrecorded'].includes(stNorm)) {
        rows = rows.filter((x) => !x.nilai_inventaris || !(x.nilai_inventaris.nilai_perolehan > 0));
      } else if (stNorm === 'aktif') {
        rows = rows.filter(
          (x) =>
            x.nilai_inventaris &&
            x.nilai_inventaris.nilai_perolehan > 0 &&
            x.nilai_inventaris.status.toLowerCase() === 'aktif'
        );
      } else {
        rows = rows.filter(
          (x) =>
            x.nilai_inventaris &&
            x.nilai_inventaris.nilai_perolehan > 0 &&
            x.nilai_inventaris.status.toLowerCase() === stNorm
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
        const unitCodes = x.units.map((u) => `${u.kode_unit} ${u.nomor_seri || ''}`).join(' ');
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

    return { ...item };
  }

  async deleteNilaiInventaris(assetId: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const item = this.items.find((i) => i.id === assetId || i.kode === assetId);
    if (!item) return false;

    delete item.nilai_inventaris;
    item.harga_beli = 0;
    item.updated_at = new Date().toISOString();
    return true;
  }
}

export const inventarisService = LocalInventarisService.getInstance();
