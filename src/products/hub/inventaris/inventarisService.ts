import { ItemInventaris, InventarisUnit, InventarisFilterParams, CreateInventarisDTO } from './types';

export interface IInventarisService {
  getInventarisList(filters?: InventarisFilterParams): Promise<ItemInventaris[]>;
  getInventarisById(id: string): Promise<ItemInventaris | null>;
  getAvailableUnits(): Promise<{ unit: InventarisUnit; item: ItemInventaris }[]>;
  createInventaris(dto: CreateInventarisDTO): Promise<ItemInventaris>;
  updateUnitStatus(unitId: string, status: InventarisUnit['status_peminjaman'], kondisi?: InventarisUnit['kondisi']): Promise<boolean>;
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
      created_at: '2026-01-10T08:00:00Z',
      updated_at: '2026-01-10T08:00:00Z',
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
      created_at: '2026-01-10T08:00:00Z',
      updated_at: '2026-01-10T08:00:00Z',
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
      created_at: '2026-01-12T08:00:00Z',
      updated_at: '2026-01-12T08:00:00Z',
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
      created_at: '2026-01-15T08:00:00Z',
      updated_at: '2026-01-15T08:00:00Z',
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
      created_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T08:00:00Z',
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
}

export const inventarisService = LocalInventarisService.getInstance();
