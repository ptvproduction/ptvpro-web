import { PeminjamanRecord, PeminjamanFilterParams, CheckoutLoanDTO, ReturnLoanDTO, KondisiKembali } from './types';
import { inventarisService } from '../inventaris/inventarisService';

export interface IPeminjamanService {
  getPeminjamanList(filters?: PeminjamanFilterParams): Promise<PeminjamanRecord[]>;
  checkoutLoan(dto: CheckoutLoanDTO, actorId?: string, actorNama?: string): Promise<{ success: boolean; transaction_id: string; message: string }>;
  returnLoan(dto: ReturnLoanDTO, actorId?: string, actorNama?: string): Promise<{ success: boolean; message: string }>;
  returnSingleLoan(loanId: string, conditionStatus?: KondisiKembali, notes?: string, actorId?: string, actorNama?: string): Promise<{ success: boolean; message: string }>;
}

/**
 * Local development repository for Peminjaman & Pengembalian module.
 * Emulates PostgreSQL RPC transactions (rpc_checkout_loan & rpc_return_loan).
 */
const INITIAL_LOAN_RECORDS: PeminjamanRecord[] = [
    {
      id: 'loan-001',
      transaction_id: 'TRX-202610-001',
      unit_id: 'unit-fx3-02',
      kode_unit: 'INV-001-U02',
      nama_alat: 'Sony FX3 Cinema Line Full-Frame Camera',
      kategori: 'Kamera',
      peminjam_nama: 'Zidna Santri (Technical)',
      keperluan: 'Liputan Pengajian Rutin Ahad Pagi Masjid Jami',
      tanggal_pinjam: '2026-10-08',
      tenggat_kembali: '2026-10-10',
      status: 'dipinjam',
      actor_id: '00000000-0000-0000-0000-000000000003',
      actor_nama: 'Farid Technical',
      created_at: '2026-10-08T09:15:00Z',
    },
    {
      id: 'loan-002',
      transaction_id: 'TRX-202610-002',
      unit_id: 'unit-dji-01',
      kode_unit: 'INV-005-U01',
      nama_alat: 'DJI RS 3 Pro Gimbal Stabilizer Combo',
      kategori: 'Stabilizer',
      peminjam_nama: 'Ust. Nurul Huda (Panitia Haul)',
      keperluan: 'Dokumentasi Teaser Video Sambutan Haul Akbar 2026',
      tanggal_pinjam: '2026-10-05',
      tenggat_kembali: '2026-10-07',
      status: 'terlambat',
      actor_id: '00000000-0000-0000-0000-000000000002',
      actor_nama: 'Ahmad Executive',
      created_at: '2026-10-05T14:30:00Z',
    },
    {
      id: 'loan-003',
      transaction_id: 'TRX-202610-003',
      unit_id: 'unit-rode-01',
      kode_unit: 'INV-003-U01',
      nama_alat: 'Rode Wireless PRO Dual Microphone System',
      kategori: 'Audio',
      peminjam_nama: 'Farsya Crew Finance',
      keperluan: 'Podcast Santri Berkisah Episode 14',
      tanggal_pinjam: '2026-10-01',
      tenggat_kembali: '2026-10-02',
      tanggal_kembali: '2026-10-02',
      status: 'dikembalikan',
      kondisi_kembali: 'bagus',
      catatan: 'Kembali lengkap dengan receiver, 2 mic, dan kabel jack 3.5mm.',
      actor_id: '00000000-0000-0000-0000-000000000003',
      actor_nama: 'Farid Technical',
      created_at: '2026-10-01T10:00:00Z',
    },
  ];

export class LocalPeminjamanService implements IPeminjamanService {
  private static instance: LocalPeminjamanService;
  private records: PeminjamanRecord[];

  constructor() {
    this.records = JSON.parse(JSON.stringify(INITIAL_LOAN_RECORDS));
  }

  public reset(): void {
    this.records = JSON.parse(JSON.stringify(INITIAL_LOAN_RECORDS));
  }

  async getAvailableUnits() {
    return inventarisService.getAvailableUnits();
  }

  public static getInstance(): LocalPeminjamanService {
    if (!LocalPeminjamanService.instance) {
      LocalPeminjamanService.instance = new LocalPeminjamanService();
    }
    return LocalPeminjamanService.instance;
  }

  async getPeminjamanList(filters?: PeminjamanFilterParams): Promise<PeminjamanRecord[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    let result = [...this.records];

    if (filters?.status && filters.status !== 'all') {
      result = result.filter((r) => r.status === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.transaction_id.toLowerCase().includes(q) ||
          r.peminjam_nama.toLowerCase().includes(q) ||
          r.nama_alat.toLowerCase().includes(q) ||
          r.kode_unit.toLowerCase().includes(q) ||
          r.keperluan.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async checkoutLoan(dto: CheckoutLoanDTO, actorId?: string, actorNama?: string): Promise<{ success: boolean; transaction_id: string; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (!dto.unit_ids || dto.unit_ids.length === 0) {
      throw new Error('Pilih minimal satu unit alat untuk dipinjam.');
    }
    if (!dto.borrower_name.trim()) {
      throw new Error('Nama peminjam wajib diisi.');
    }
    if (!dto.purpose.trim()) {
      throw new Error('Keperluan peminjaman wajib diisi.');
    }
    if (!dto.due_date) {
      throw new Error('Tenggat pengembalian wajib ditentukan.');
    }

    const today = new Date().toISOString().split('T')[0];
    if (dto.due_date < today) {
      throw new Error('Tenggat kembali tidak boleh lebih awal dari tanggal hari ini.');
    }

    const txSuffix = Math.floor(100 + Math.random() * 900);
    const datePrefix = today.replace(/-/g, '').slice(0, 6);
    const transaction_id = `TRX-${datePrefix}-${txSuffix}`;

    for (const unitId of dto.unit_ids) {
      const availableUnits = await inventarisService.getAvailableUnits();
      const match = availableUnits.find((u) => u.unit.id === unitId);

      if (!match) {
        throw new Error(`Unit ${unitId} tidak lagi tersedia atau sedang dipinjam.`);
      }

      await inventarisService.updateUnitStatus(unitId, 'dipinjam');

      const record: PeminjamanRecord = {
        id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        transaction_id,
        unit_id: match.unit.id,
        kode_unit: match.unit.kode_unit,
        nama_alat: match.item.nama_alat,
        kategori: match.item.kategori,
        peminjam_nama: dto.borrower_name.trim(),
        keperluan: dto.purpose.trim(),
        tanggal_pinjam: today,
        tenggat_kembali: dto.due_date,
        status: 'dipinjam',
        actor_id: actorId,
        actor_nama: actorNama || 'Operator Technical',
        created_at: new Date().toISOString(),
      };

      this.records.unshift(record);
    }

    return {
      success: true,
      transaction_id,
      message: `Peminjaman ${dto.unit_ids.length} unit berhasil diproses dengan nomor transaksi ${transaction_id}.`,
    };
  }

  async returnLoan(dto: ReturnLoanDTO, actorId?: string, actorNama?: string): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 150));

    const loans = this.records.filter((r) => r.transaction_id === dto.transaction_id && r.status !== 'dikembalikan');

    if (loans.length === 0) {
      throw new Error(`Transaksi ${dto.transaction_id} tidak ditemukan atau seluruh unit sudah dikembalikan.`);
    }

    const today = new Date().toISOString().split('T')[0];

    for (const loan of loans) {
      loan.status = 'dikembalikan';
      loan.tanggal_kembali = today;
      loan.kondisi_kembali = dto.condition_status;
      if (dto.notes) loan.catatan = dto.notes;
      if (actorId) loan.actor_id = actorId;
      if (actorNama) loan.actor_nama = actorNama;

      const newUnitStatus = dto.condition_status === 'bagus' ? 'tersedia' : 'maintenance';
      await inventarisService.updateUnitStatus(loan.unit_id, newUnitStatus, dto.condition_status);
    }

    return {
      success: true,
      message: `Pengembalian untuk transaksi ${dto.transaction_id} (${loans.length} unit) berhasil dicatat dengan kondisi '${dto.condition_status}'.`,
    };
  }

  async returnSingleLoan(loanId: string, conditionStatus: KondisiKembali = 'bagus', notes?: string, actorId?: string, actorNama?: string): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const loan = this.records.find((r) => r.id === loanId && r.status !== 'dikembalikan');
    if (!loan) {
      throw new Error(`Data peminjaman unit tidak ditemukan atau sudah dikembalikan.`);
    }

    const today = new Date().toISOString().split('T')[0];
    loan.status = 'dikembalikan';
    loan.tanggal_kembali = today;
    loan.kondisi_kembali = conditionStatus;
    if (notes) loan.catatan = notes;
    if (actorId) loan.actor_id = actorId;
    if (actorNama) loan.actor_nama = actorNama;

    const newUnitStatus = conditionStatus === 'bagus' ? 'tersedia' : 'maintenance';
    await inventarisService.updateUnitStatus(loan.unit_id, newUnitStatus, conditionStatus);

    return {
      success: true,
      message: `Unit '${loan.kode_unit}' (${loan.nama_alat}) berhasil dikembalikan dengan kondisi '${conditionStatus}'.`,
    };
  }
}

export const peminjamanService = LocalPeminjamanService.getInstance();
