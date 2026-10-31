import { useState, useEffect } from 'react';
import {
  PeriodeKas,
  KasKruRecord,
  PemasukanRecord,
  PengeluaranRecord,
  KeuanganSummary,
  MyKasSummary,
  MyUnpaidItem,
  MyPaidItem,
  PaymentMethod,
  PemasukanKategori,
  PengeluaranKategori,
} from './types';
import {
  INITIAL_PERIODE_FIXTURES,
  INITIAL_KAS_KRU_FIXTURES,
  INITIAL_PEMASUKAN_FIXTURES,
  INITIAL_PENGELUARAN_FIXTURES,
} from './fixtures';
import { crewStore } from '@products/hub/kru/kruStore';
import { isOperationalCrew } from '@products/hub/kru/types';

const STORAGE_KEY = 'ptv_shared_keuangan_v2';

export function fmtRupiah(n: number | string | undefined | null): string {
  const num = Number(n || 0);
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function fmtPeriodeBulan(ym: string): string {
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const mIdx = parseInt(parts[1], 10) - 1;
  return `${months[mIdx] || parts[1]} ${parts[0]}`;
}

export function fmtPeriodeBulanShort(ym: string): string {
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const mIdx = parseInt(parts[1], 10) - 1;
  return months[mIdx] || parts[1];
}

export function fmtNominalShort(n: number | string | undefined | null): string {
  const num = Number(n || 0);
  if (num >= 1000000) {
    const jt = num / 1000000;
    return (Number.isInteger(jt) ? jt : jt.toFixed(1)) + ' jt';
  }
  if (num >= 1000) {
    const k = num / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
  }
  return String(num);
}

interface KeuanganStoragePayload {
  periode: PeriodeKas[];
  kas_kru: KasKruRecord[];
  pemasukan: PemasukanRecord[];
  pengeluaran: PengeluaranRecord[];
}

class KeuanganStore {
  private periode: PeriodeKas[] = [];
  private kasKru: KasKruRecord[] = [];
  private pemasukan: PemasukanRecord[] = [];
  private pengeluaran: PengeluaranRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as KeuanganStoragePayload;
          if (parsed && Array.isArray(parsed.periode)) {
            this.periode = parsed.periode;
            this.kasKru = parsed.kas_kru || [];
            this.pemasukan = parsed.pemasukan || [];
            this.pengeluaran = parsed.pengeluaran || [];
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load keuangan store from localStorage', e);
    }

    this.periode = [...INITIAL_PERIODE_FIXTURES];
    this.kasKru = [...INITIAL_KAS_KRU_FIXTURES];
    this.pemasukan = [...INITIAL_PEMASUKAN_FIXTURES];
    this.pengeluaran = [...INITIAL_PENGELUARAN_FIXTURES];
  }

  private save() {
    try {
      if (typeof window !== 'undefined') {
        const payload: KeuanganStoragePayload = {
          periode: this.periode,
          kas_kru: this.kasKru,
          pemasukan: this.pemasukan,
          pengeluaran: this.pengeluaran,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (e) {
      console.warn('Failed to save keuangan store to localStorage', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getPeriodeList(): PeriodeKas[] {
    return this.periode
      .filter((p) => {
        if (!p.periode_bulan || p.periode_bulan < '2026-07') return false;
        if (p.is_active === false || p.status === 'nonaktif' || (p.keterangan || '').includes('[NONAKTIF]')) return false;
        return true;
      })
      .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan));
  }

  public getAllKasKru(): KasKruRecord[] {
    return [...this.kasKru];
  }

  public getAllPemasukan(includeVoid = false): PemasukanRecord[] {
    if (includeVoid) return [...this.pemasukan];
    return this.pemasukan.filter((p) => p.status !== 'void');
  }

  public getAllPengeluaran(includeVoid = false): PengeluaranRecord[] {
    if (includeVoid) return [...this.pengeluaran];
    return this.pengeluaran.filter((p) => p.status !== 'void');
  }

  public getSummary(): KeuanganSummary {
    const activePemasukan = this.getAllPemasukan(false);
    const activePengeluaran = this.getAllPengeluaran(false);
    const validPeriods = this.getPeriodeList();
    const operationalCrew = crewStore.getAll().filter(isOperationalCrew);

    const totalPemasukan = activePemasukan.reduce((acc, p) => acc + (Number(p.nominal) || 0), 0);
    const totalPengeluaran = activePengeluaran.reduce((acc, p) => acc + (Number(p.nominal) || 0), 0);
    const saldoKas = totalPemasukan - totalPengeluaran;

    // Total Kas Terkumpul (dari Kas Kru yang lunas)
    const totalKasTerkumpul = this.kasKru
      .filter((k) => k.status === 'Lunas')
      .reduce((acc, k) => acc + (Number(k.dibayar) || 0), 0);

    // Total Tunggakan Kas across all operational crew
    let totalTunggakanKas = 0;
    operationalCrew.forEach((c) => {
      const cJoinYM = c.join_date ? c.join_date.slice(0, 7) : '2026-07';
      validPeriods.forEach((p) => {
        if (cJoinYM > p.periode_bulan) return;
        const status = this.getKruPaymentStatus(c.id, c.ptv_id, c.full_name, p.periode_bulan);
        if (!status.isPaid) {
          totalTunggakanKas += status.sisa;
        }
      });
    });

    return {
      totalPemasukan,
      totalPengeluaran,
      saldoKas,
      totalKasTerkumpul,
      totalTunggakanKas,
    };
  }

  public getKruPaymentStatus(
    crewId?: string,
    ptvId?: string,
    crewName?: string,
    periodeBulan?: string
  ): { isPaid: boolean; record: KasKruRecord | null; dibayar: number; nominal: number; sisa: number } {
    if (!periodeBulan) {
      return { isPaid: false, record: null, dibayar: 0, nominal: 25000, sisa: 25000 };
    }

    const pObj = this.periode.find((p) => p.periode_bulan === periodeBulan);
    const nominal = Number(
      pObj?.nominal || (periodeBulan === '2026-07' || periodeBulan === '2026-08' ? 25000 : 20000)
    );

    const normPtv = (ptvId || '').trim().toUpperCase();
    const normId = (crewId || '').trim().toLowerCase();
    const normName = (crewName || '').trim().toLowerCase();

    const kasRec = this.kasKru.find((k) => {
      if (k.periode_bulan !== periodeBulan) return false;
      if (normPtv && (k.kru_ptv_id || '').toUpperCase() === normPtv) return true;
      if (normId && (k.kru_id || '').toLowerCase() === normId) return true;
      if (normName && (k.kru_nama || '').toLowerCase() === normName) return true;
      return false;
    });

    if (kasRec && (kasRec.status === 'Lunas' || kasRec.dibayar >= nominal || (kasRec.dibayar > 0 && kasRec.sisa === 0))) {
      return {
        isPaid: true,
        record: kasRec,
        dibayar: kasRec.dibayar || nominal,
        nominal,
        sisa: 0,
      };
    }

    const dibayar = Number(kasRec?.dibayar || 0);
    const sisa = Math.max(0, nominal - dibayar);

    return {
      isPaid: false,
      record: kasRec || null,
      dibayar,
      nominal,
      sisa,
    };
  }

  public getMyKasData(
    userPtvId?: string,
    userCrewId?: string,
    userName?: string
  ): MyKasSummary {
    const allCrew = crewStore.getAll();
    const normPtv = (userPtvId || '').trim().toUpperCase();
    const normId = (userCrewId || '').trim().toLowerCase();
    const normName = (userName || '').trim().toLowerCase();

    const matchedCrew = allCrew.find((c) => {
      if (normPtv && c.ptv_id.toUpperCase() === normPtv) return true;
      if (normId && c.id.toLowerCase() === normId) return true;
      if (normName && c.full_name.toLowerCase() === normName) return true;
      return false;
    });

    const crewInfo = {
      id: matchedCrew?.id || userCrewId || 'c-self',
      ptvId: matchedCrew?.ptv_id || userPtvId || 'PTV-YOU',
      name: matchedCrew?.full_name || userName || 'Kru PTV',
      division: matchedCrew?.division || 'Technical',
      position: matchedCrew?.position || 'Crew Operator',
      photo: matchedCrew?.foto_url,
    };

    const validPeriods = this.getPeriodeList();
    const joinYM = matchedCrew?.join_date ? matchedCrew.join_date.slice(0, 7) : '2026-07';

    const unpaidPeriods: MyUnpaidItem[] = [];
    const paidPeriods: MyPaidItem[] = [];
    let totalTunggakan = 0;
    let totalDibayar = 0;
    let totalTagihan = 0;

    validPeriods.forEach((p) => {
      const st = this.getKruPaymentStatus(crewInfo.id, crewInfo.ptvId, crewInfo.name, p.periode_bulan);
      if (joinYM > p.periode_bulan && !st.isPaid) return; // Belum bergabung dan tidak ada pembayaran
      totalTagihan += st.nominal;

      if (st.isPaid) {
        paidPeriods.push({
          periode_bulan: p.periode_bulan,
          label: fmtPeriodeBulan(p.periode_bulan),
          nominal: st.nominal,
          dibayar: st.dibayar,
          tanggal_bayar: st.record?.tanggal_bayar || '2026-08-01',
          dicatat_oleh_nama: st.record?.dicatat_oleh_nama || 'Admin Keuangan',
          metode_bayar: st.record?.metode_bayar || 'Tunai',
        });
        totalDibayar += st.dibayar;
      } else {
        unpaidPeriods.push({
          periode_bulan: p.periode_bulan,
          label: fmtPeriodeBulan(p.periode_bulan),
          nominal: st.nominal,
          dibayar: st.dibayar,
          sisa: st.sisa,
        });
        totalTunggakan += st.sisa;
        totalDibayar += st.dibayar;
      }
    });

    paidPeriods.sort((a, b) => b.periode_bulan.localeCompare(a.periode_bulan));
    unpaidPeriods.sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan));

    return {
      crew: crewInfo,
      unpaidPeriods,
      paidPeriods,
      totalTunggakan,
      totalDibayar,
      totalTagihan,
      isLunasSemua: unpaidPeriods.length === 0,
    };
  }

  // --- MUTATIONS ---

  public tandaiKasLunas(
    crewId: string,
    crewPtvId: string,
    crewNama: string,
    periodeBulan: string,
    dicatatOlehNama: string,
    dicatatOlehId?: string,
    metodeBayar: PaymentMethod = 'Tunai',
    customDate?: string
  ) {
    const pObj = this.periode.find((p) => p.periode_bulan === periodeBulan);
    const nominal = Number(pObj?.nominal || (periodeBulan === '2026-07' ? 20000 : 25000));
    const now = customDate || new Date().toISOString().slice(0, 10);

    const normPtv = crewPtvId.trim().toUpperCase();
    const existingIndex = this.kasKru.findIndex((k) => {
      if (k.periode_bulan !== periodeBulan) return false;
      if (normPtv && (k.kru_ptv_id || '').toUpperCase() === normPtv) return true;
      if (crewId && (k.kru_id || '').toLowerCase() === crewId.toLowerCase()) return true;
      return false;
    });

    const kasRecordId = existingIndex >= 0 ? this.kasKru[existingIndex].id : `kas-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newRecord: KasKruRecord = {
      id: kasRecordId,
      kru_id: crewId,
      kru_ptv_id: crewPtvId,
      kru_nama: crewNama,
      periode_bulan: periodeBulan,
      nominal,
      dibayar: nominal,
      sisa: 0,
      status: 'Lunas',
      tanggal_bayar: now,
      dicatat_oleh_id: dicatatOlehId,
      dicatat_oleh_nama: dicatatOlehNama,
      metode_bayar: metodeBayar,
    };

    if (existingIndex >= 0) {
      this.kasKru[existingIndex] = newRecord;
    } else {
      this.kasKru.push(newRecord);
    }

    // Maintain single-entry ledger in pemasukan
    const pemIndex = this.pemasukan.findIndex((p) => p.kas_kru_id === kasRecordId);
    const pemasukanRecord: PemasukanRecord = {
      id: pemIndex >= 0 ? this.pemasukan[pemIndex].id : `pem-kas-${Date.now()}`,
      tanggal: now,
      sumber: `Iuran Kas ${fmtPeriodeBulan(periodeBulan)} — ${crewNama}`,
      kategori: 'Iuran Kas',
      nominal,
      keterangan: `Iuran kas kru bulanan periode ${fmtPeriodeBulan(periodeBulan)}`,
      dicatat_oleh_nama: dicatatOlehNama,
      status: 'posted',
      kru_id: crewId,
      kru_nama: crewNama,
      kas_kru_id: kasRecordId,
    };

    if (pemIndex >= 0) {
      this.pemasukan[pemIndex] = pemasukanRecord;
    } else {
      this.pemasukan.unshift(pemasukanRecord);
    }

    this.save();
  }

  public undoKasLunas(crewId: string, crewPtvId: string, periodeBulan: string) {
    const normPtv = crewPtvId.trim().toUpperCase();
    const kasIndex = this.kasKru.findIndex((k) => {
      if (k.periode_bulan !== periodeBulan) return false;
      if (normPtv && (k.kru_ptv_id || '').toUpperCase() === normPtv) return true;
      if (crewId && (k.kru_id || '').toLowerCase() === crewId.toLowerCase()) return true;
      return false;
    });

    if (kasIndex >= 0) {
      const rec = this.kasKru[kasIndex];
      const nominal = rec.nominal;
      this.kasKru[kasIndex] = {
        ...rec,
        dibayar: 0,
        sisa: nominal,
        status: 'Belum Lunas',
        tanggal_bayar: undefined,
      };

      // Void the corresponding pemasukan ledger transaction
      const pemIndex = this.pemasukan.findIndex((p) => p.kas_kru_id === rec.id);
      if (pemIndex >= 0) {
        this.pemasukan[pemIndex] = {
          ...this.pemasukan[pemIndex],
          status: 'void',
        };
      }

      this.save();
    }
  }

  public tambahPemasukan(
    data: {
      tanggal: string;
      sumber: string;
      kategori: PemasukanKategori;
      nominal: number;
      keterangan: string;
      bukti_url?: string;
    },
    recordedByName: string
  ): PemasukanRecord {
    const newRecord: PemasukanRecord = {
      id: `pem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tanggal: data.tanggal,
      sumber: data.sumber.trim(),
      kategori: data.kategori,
      nominal: Math.round(Number(data.nominal) || 0),
      keterangan: data.keterangan.trim(),
      bukti_url: data.bukti_url?.trim(),
      dicatat_oleh_nama: recordedByName,
      status: 'posted',
    };
    this.pemasukan.unshift(newRecord);
    this.save();
    return newRecord;
  }

  public updatePemasukan(
    id: string,
    data: {
      tanggal: string;
      sumber: string;
      kategori: PemasukanKategori;
      nominal: number;
      keterangan: string;
      bukti_url?: string;
    }
  ): boolean {
    const idx = this.pemasukan.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.pemasukan[idx] = {
      ...this.pemasukan[idx],
      tanggal: data.tanggal,
      sumber: data.sumber.trim(),
      kategori: data.kategori,
      nominal: Math.round(Number(data.nominal) || 0),
      keterangan: data.keterangan.trim(),
      bukti_url: data.bukti_url?.trim(),
    };
    this.save();
    return true;
  }

  public voidPemasukan(id: string): boolean {
    const idx = this.pemasukan.findIndex((p) => p.id === id);
    if (idx < 0) return false;

    const item = this.pemasukan[idx];
    this.pemasukan[idx] = { ...item, status: 'void' };

    // If it was linked to a kas_kru, revert kas_kru record
    if (item.kas_kru_id) {
      const kIdx = this.kasKru.findIndex((k) => k.id === item.kas_kru_id);
      if (kIdx >= 0) {
        this.kasKru[kIdx] = {
          ...this.kasKru[kIdx],
          status: 'Belum Lunas',
          dibayar: 0,
          sisa: this.kasKru[kIdx].nominal,
          tanggal_bayar: undefined,
        };
      }
    }

    this.save();
    return true;
  }

  public tambahPengeluaran(
    data: {
      tanggal: string;
      keperluan: string;
      kategori: PengeluaranKategori;
      nominal: number;
      keterangan: string;
      bukti_url?: string;
    },
    recordedByName: string
  ): PengeluaranRecord {
    const newRecord: PengeluaranRecord = {
      id: `pen-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tanggal: data.tanggal,
      keperluan: data.keperluan.trim(),
      kategori: data.kategori,
      nominal: Math.round(Number(data.nominal) || 0),
      keterangan: data.keterangan.trim(),
      bukti_url: data.bukti_url?.trim(),
      dicatat_oleh_nama: recordedByName,
      status: 'posted',
    };
    this.pengeluaran.unshift(newRecord);
    this.save();
    return newRecord;
  }

  public updatePengeluaran(
    id: string,
    data: {
      tanggal: string;
      keperluan: string;
      kategori: PengeluaranKategori;
      nominal: number;
      keterangan: string;
      bukti_url?: string;
    }
  ): boolean {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.pengeluaran[idx] = {
      ...this.pengeluaran[idx],
      tanggal: data.tanggal,
      keperluan: data.keperluan.trim(),
      kategori: data.kategori,
      nominal: Math.round(Number(data.nominal) || 0),
      keterangan: data.keterangan.trim(),
      bukti_url: data.bukti_url?.trim(),
    };
    this.save();
    return true;
  }

  public voidPengeluaran(id: string): boolean {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.pengeluaran[idx] = { ...this.pengeluaran[idx], status: 'void' };
    this.save();
    return true;
  }

  public getAllPeriodes(): PeriodeKas[] {
    return [...this.periode].sort((a, b) => b.periode_bulan.localeCompare(a.periode_bulan));
  }

  public getPeriodePaymentStats(periodeBulan: string): { paidCount: number; totalPaid: number } {
    const cleanYm = (periodeBulan || '').trim();
    const records = this.kasKru.filter(
      (k) => k.periode_bulan === cleanYm && (k.status === 'Lunas' || Number(k.dibayar) > 0)
    );
    const paidCount = records.length;
    const totalPaid = records.reduce((acc, k) => acc + (Number(k.dibayar) || 0), 0);
    return { paidCount, totalPaid };
  }

  public updatePeriodeNominal(periodeBulan: string, nominal: number): boolean {
    const idx = this.periode.findIndex((p) => p.periode_bulan === periodeBulan);
    if (idx < 0) return false;
    this.periode[idx] = {
      ...this.periode[idx],
      nominal: Math.round(Number(nominal) || 0),
    };
    this.save();
    return true;
  }

  public tambahPeriode(periodeBulan: string, nominal: number, keterangan?: string): boolean {
    const exists = this.periode.some((p) => p.periode_bulan === periodeBulan);
    if (exists) return false;
    this.periode.push({
      periode_bulan: periodeBulan,
      nominal: Math.round(Number(nominal) || 0),
      keterangan: keterangan || fmtPeriodeBulan(periodeBulan),
      status: 'aktif',
      is_active: true,
    });
    this.save();
    return true;
  }

  public saveOrUpdatePeriode(data: {
    periode_bulan: string;
    nominal: number;
    keterangan?: string;
    status?: 'aktif' | 'nonaktif';
  }): boolean {
    const cleanYm = data.periode_bulan.trim();
    if (!cleanYm) return false;
    const nominal = Math.round(Number(data.nominal) || 0);
    const idx = this.periode.findIndex((p) => p.periode_bulan === cleanYm);

    if (idx >= 0) {
      this.periode[idx] = {
        ...this.periode[idx],
        nominal,
        keterangan: data.keterangan !== undefined ? data.keterangan.trim() : this.periode[idx].keterangan,
        status: data.status || this.periode[idx].status || 'aktif',
        is_active: (data.status || this.periode[idx].status || 'aktif') === 'aktif',
      };
    } else {
      this.periode.push({
        periode_bulan: cleanYm,
        nominal,
        keterangan: data.keterangan?.trim() || fmtPeriodeBulan(cleanYm),
        status: data.status || 'aktif',
        is_active: (data.status || 'aktif') === 'aktif',
      });
    }
    this.save();
    return true;
  }

  public hapusPeriode(periodeBulan: string): { deleted: boolean; deactivated: boolean; message: string } {
    const cleanYm = (periodeBulan || '').trim();
    const idx = this.periode.findIndex((p) => p.periode_bulan === cleanYm);
    if (idx < 0) {
      return { deleted: false, deactivated: false, message: 'Periode tidak ditemukan.' };
    }

    const hasPayments = this.kasKru.some(
      (k) => k.periode_bulan === cleanYm && (k.status === 'Lunas' || Number(k.dibayar) > 0)
    );

    if (hasPayments) {
      // Deactivate to protect recorded payment history
      this.periode[idx] = {
        ...this.periode[idx],
        status: 'nonaktif',
        is_active: false,
      };
      this.save();
      return {
        deleted: false,
        deactivated: true,
        message: `Periode ${cleanYm} telah dinonaktifkan dari tagihan aktif untuk melindungi catatan pembayaran historis kru.`,
      };
    }

    this.periode.splice(idx, 1);
    this.save();
    return {
      deleted: true,
      deactivated: false,
      message: `Periode ${cleanYm} berhasil dihapus.`,
    };
  }

  public togglePeriodeStatus(periodeBulan: string): boolean {
    const idx = this.periode.findIndex((p) => p.periode_bulan === periodeBulan);
    if (idx < 0) return false;
    const nextStatus = this.periode[idx].status === 'aktif' ? 'nonaktif' : 'aktif';
    this.periode[idx] = {
      ...this.periode[idx],
      status: nextStatus,
      is_active: nextStatus === 'aktif',
    };
    this.save();
    return true;
  }

  public resetToFixtures() {
    crewStore.resetToFixtures();
    this.periode = [...INITIAL_PERIODE_FIXTURES];
    this.kasKru = [...INITIAL_KAS_KRU_FIXTURES];
    this.pemasukan = [...INITIAL_PEMASUKAN_FIXTURES];
    this.pengeluaran = [...INITIAL_PENGELUARAN_FIXTURES];
    this.save();
  }
}

export const keuanganStore = new KeuanganStore();

export function useKeuanganStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return keuanganStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return keuanganStore;
}
