import { ptvCache } from '@core/cache/ptvCache';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import { usesInventoryPortal } from '../inventaris/services/inventoryPortalClient';
import type { IPeminjamanService } from './peminjamanService';
import type { CheckoutLoanDTO, ReturnLoanDTO, KondisiKembali, PeminjamanFilterParams, PeminjamanRecord } from './types';

export class StagingPeminjamanService implements IPeminjamanService {
  private pendingCheckout: { payload: string; transactionId: string } | null = null;

  private client() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!isSupabaseConfigured() || !url || new URL(url).hostname !== 'swadgljnyelsjstqqxbm.supabase.co') {
      throw new Error('Penyimpanan peminjaman hanya diizinkan pada Supabase Staging yang terkonfigurasi.');
    }
    return getSupabaseClient();
  }

  async getPeminjamanList(filters?: PeminjamanFilterParams): Promise<PeminjamanRecord[]> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch('/api/peminjaman', { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
          if (!response.ok) throw new Error(`Gagal memuat peminjaman (HTTP ${response.status}).`);
          const contentType = response.headers?.get?.('content-type');
          if (contentType && !contentType.includes('application/json')) throw new Error('Respon server bukan format JSON yang valid.');
          const body = await response.json();
          if (body.success !== true || !Array.isArray(body.loans)) throw new Error('Respons peminjaman tidak valid.');
          return body.loans as PeminjamanRecord[];
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Waktu memuat peminjaman habis. Silakan coba lagi.'));
          }, 15000);
        }),
      ]);
      return result.filter((row) =>
        (!filters?.status || filters.status === 'all' || row.status === filters.status) &&
        (!filters?.search || [row.transaction_id, row.peminjam_nama, row.nama_alat, row.kode_unit, row.keperluan]
          .some((value) => value.toLowerCase().includes(filters.search!.toLowerCase()))));
    } finally {
      clearTimeout(timer);
    }
  }

  private async rpc(name: string, args: Record<string, unknown>) {
    const cookieBackend = usesInventoryPortal() || import.meta.env.VITE_AUTH_BACKEND === 'vercel';
    const client = cookieBackend ? null : this.client();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = cookieBackend
        ? (async () => {
            const response = await fetch('/api/peminjaman', {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operation: name, args }), signal: controller.signal,
            });
            const data = await response.json();
            return response.ok ? { data, error: null } : { data: null, error: { message: data.error || `HTTP ${response.status}` } };
          })()
        : client!.rpc(name, args).abortSignal(controller.signal);
      const result = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Konfirmasi penyimpanan belum diterima. Muat ulang daftar sebelum mencoba lagi agar tidak menggandakan data.'));
          }, 15000);
        }),
      ]);
      if (result.error) throw new Error(`Penyimpanan ditolak backend: ${result.error.message}`);
      if (result.data?.success !== true) throw new Error('Backend belum mengonfirmasi penyimpanan. Periksa daftar sebelum mencoba lagi.');
      if (args.p_transaction_id && result.data.transaction_id !== args.p_transaction_id) {
        throw new Error('Konfirmasi transaksi backend tidak cocok. Periksa daftar sebelum mencoba lagi.');
      }
      if (args.p_loan_row_id && (result.data.loan_id !== args.p_loan_row_id || result.data.unit_id !== args.p_unit_id)) {
        throw new Error('Konfirmasi unit backend tidak cocok. Periksa daftar sebelum mencoba lagi.');
      }
      ptvCache.invalidate('inventaris_catalog_list');
      ptvCache.invalidate('peminjaman_loans_list');
      ptvCache.invalidate('beranda_aggregated_data');
      return result.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async checkoutLoan(dto: CheckoutLoanDTO) {
    if (!dto.unit_ids.length || new Set(dto.unit_ids).size !== dto.unit_ids.length) throw new Error('Pilih unit alat tanpa duplikasi.');
    if (!dto.borrower_name.trim() || !dto.purpose.trim()) throw new Error('Nama peminjam dan keperluan wajib diisi.');
    const today = new Date().toISOString().slice(0, 10);
    if (!dto.due_date || dto.due_date < today) throw new Error('Tenggat kembali tidak boleh lebih awal dari hari ini.');
    const payload = JSON.stringify(dto);
    if (!this.pendingCheckout || this.pendingCheckout.payload !== payload) {
      this.pendingCheckout = { payload, transactionId: `TRX-${crypto.randomUUID()}` };
    }
    const transaction_id = this.pendingCheckout.transactionId;
    await this.rpc('rpc_checkout_loan', {
      p_transaction_id: transaction_id, p_borrower_name: dto.borrower_name.trim(),
      p_purpose: dto.purpose.trim(), p_out_date: today, p_due_date: dto.due_date,
      p_event_name: dto.event_name || null, p_unit_ids: dto.unit_ids,
    });
    this.pendingCheckout = null;
    return { success: true, transaction_id, message: 'Peminjaman dikonfirmasi backend.' };
  }

  async returnLoan(dto: ReturnLoanDTO) {
    await this.rpc('rpc_return_loan', {
      p_transaction_id: dto.transaction_id, p_back_date: new Date().toISOString().slice(0, 10),
      p_condition_status: dto.condition_status, p_notes: dto.notes || null,
    });
    return { success: true, message: 'Pengembalian dikonfirmasi backend.' };
  }

  async returnSingleLoan(loanId: string, conditionStatus: KondisiKembali = 'bagus', notes?: string) {
    const cookieBackend = usesInventoryPortal() || import.meta.env.VITE_AUTH_BACKEND === 'vercel';
    if (notes?.trim() && !cookieBackend) throw new Error('Catatan per-unit memerlukan adapter server Hub. Tidak ada catatan yang dibuang.');
    const loan = (await this.getPeminjamanList()).find((row) => row.id === loanId && !row.is_historical);
    if (!loan) throw new Error('Peminjaman aktif tidak ditemukan; data arsip tidak dapat diubah melalui alur ini.');
    if (loan.status === 'dikembalikan') throw new Error('Unit sudah dikembalikan. Muat ulang daftar sebelum melanjutkan.');
    await this.rpc('rpc_return_single_unit', {
      p_loan_row_id: loan.id, p_unit_id: loan.unit_id, p_condition_status: conditionStatus,
      ...(cookieBackend ? { p_notes: notes?.trim() || null } : {}),
    });
    return { success: true, message: 'Pengembalian unit dikonfirmasi backend.' };
  }
}
