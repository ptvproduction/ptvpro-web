import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { useCrewStore } from '@products/hub/kru/kruStore';
import {
  useKeuanganStore,
  fmtRupiah,
  fmtPeriodeBulan,
} from './keuanganStore';
import {
  KeuanganTab,
  PemasukanRecord,
  PengeluaranRecord,
  PaymentMethod,
} from './types';
import { CrewMember, isOperationalCrew } from '@products/hub/kru/types';
import { TandaiLunasModal } from './components/TandaiLunasModal';
import { CatatPemasukanModal } from './components/CatatPemasukanModal';
import { CatatPengeluaranModal } from './components/CatatPengeluaranModal';
import { EditTransaksiModal } from './components/EditTransaksiModal';
import { PengaturanIuranKasModal } from './components/PengaturanIuranKasModal';
import { ImageLightboxModal } from '@shared/components/ImageLightboxModal';
import '@/styles/keuangan.css';
import './keuangan-legacy-r03.css';

export const KeuanganPage: React.FC = () => {
  const { user, can } = useSessionStore();
  const crewStoreInstance = useCrewStore();
  const keuangan = useKeuanganStore();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Permissions
  const canManage = can('finance.manage');
  const canOperate = can('finance.operator') || canManage;
  const canViewGlobal = can('finance.view') || canManage;
  const canViewOwn = can('finance.view_own') || canViewGlobal;

  // Active Tab & Search
  const [activeTab, setActiveTab] = useState<KeuanganTab>(
    tabParam === 'pemasukan' || tabParam === 'pengeluaran' ? tabParam : 'kas_kru'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isTandaiLunasOpen, setIsTandaiLunasOpen] = useState(false);
  const [selectedCrewForLunas, setSelectedCrewForLunas] = useState<{
    id: string;
    ptvId: string;
    nama: string;
    periodeBulan: string;
    nominal: number;
  } | null>(null);

  const [isPemasukanOpen, setIsPemasukanOpen] = useState(false);
  const [isPengeluaranOpen, setIsPengeluaranOpen] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editType, setEditType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [editPemasukanItem, setEditPemasukanItem] = useState<PemasukanRecord | null>(null);
  const [editPengeluaranItem, setEditPengeluaranItem] = useState<PengeluaranRecord | null>(null);

  // Settings modal state
  const [isPengaturanOpen, setIsPengaturanOpen] = useState(false);
  const [pengaturanSelectedMonth, setPengaturanSelectedMonth] = useState<string | undefined>(undefined);

  // Lightbox for receipts
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>('');

  // Extract first name for personalized legacy banner
  const userFirstName = useMemo(() => {
    if (!user?.full_name) return 'Kru';
    const first = user.full_name.trim().split(/\s+/)[0];
    return first || 'Kru';
  }, [user]);

  // Personal Kas data
  const myKas = useMemo(() => {
    return keuangan.getMyKasData(user?.ptv_id, user?.id, user?.full_name);
  }, [keuangan, user]);

  // Overall calculations
  const summary = useMemo(() => keuangan.getSummary(), [keuangan]);
  const validPeriods = useMemo(() => keuangan.getPeriodeList(), [keuangan]);

  // Operational crew list for Kas Kru Matrix (excluding Pembina/Pengarah per legacy rules)
  const operationalCrew = useMemo(() => {
    const list: CrewMember[] = crewStoreInstance.members.filter(isOperationalCrew);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.ptv_id.toLowerCase().includes(q) ||
        c.division.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q)
    );
  }, [crewStoreInstance.members, searchQuery]);

  // Pemasukan list grouped by month
  const pemasukanGroups = useMemo(() => {
    let list = keuangan.getAllPemasukan(false);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.sumber.toLowerCase().includes(q) ||
          p.kategori.toLowerCase().includes(q) ||
          p.keterangan.toLowerCase().includes(q) ||
          (p.kru_nama && p.kru_nama.toLowerCase().includes(q)) ||
          String(p.nominal).includes(q)
      );
    }

    const groups: Record<
      string,
      { ym: string; label: string; items: PemasukanRecord[]; total: number }
    > = {};

    list.forEach((item) => {
      const ym = item.tanggal && item.tanggal.length >= 7 ? item.tanggal.slice(0, 7) : 'Lainnya';
      if (!groups[ym]) {
        groups[ym] = {
          ym,
          label: ym === 'Lainnya' ? 'Tanpa Tanggal' : fmtPeriodeBulan(ym),
          items: [],
          total: 0,
        };
      }
      groups[ym].items.push(item);
      groups[ym].total += Number(item.nominal) || 0;
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((k) => groups[k]);
  }, [keuangan, searchQuery]);

  // Pengeluaran list grouped by month
  const pengeluaranGroups = useMemo(() => {
    let list = keuangan.getAllPengeluaran(false);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.keperluan.toLowerCase().includes(q) ||
          p.kategori.toLowerCase().includes(q) ||
          p.keterangan.toLowerCase().includes(q) ||
          String(p.nominal).includes(q)
      );
    }

    const groups: Record<
      string,
      { ym: string; label: string; items: PengeluaranRecord[]; total: number }
    > = {};

    list.forEach((item) => {
      const ym = item.tanggal && item.tanggal.length >= 7 ? item.tanggal.slice(0, 7) : 'Lainnya';
      if (!groups[ym]) {
        groups[ym] = {
          ym,
          label: ym === 'Lainnya' ? 'Tanpa Tanggal' : fmtPeriodeBulan(ym),
          items: [],
          total: 0,
        };
      }
      groups[ym].items.push(item);
      groups[ym].total += Number(item.nominal) || 0;
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((k) => groups[k]);
  }, [keuangan, searchQuery]);

  // Access Denied gate if neither view_own nor view
  if (!canViewOwn && !canViewGlobal) {
    return (
      <div className="fin-page-container">
        <div className="card pad text-center" style={{ padding: '48px 24px', maxWidth: '480px', margin: '40px auto' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
            }}
          >
            <i className="fa-solid fa-lock" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: 'var(--ink)' }}>
            Akses Terbatas: Khusus Kru Aktif
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--ink3)', lineHeight: 1.6, margin: '0 0 24px' }}>
            Halaman Keuangan dan pembukuan kas studio PTV hanya dapat diakses oleh Kru Aktif dan Eksekutif. Posisi penasihat atau pembina tidak memiliki otorisasi melihat modul ini.
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // EXPERIENCE 1: KRU BIASA (READ-ONLY "KAS SAYA")
  // ------------------------------------------------------------
  if (!canViewGlobal && canViewOwn) {
    return (
      <div className="fin-page-container" data-testid="kas-saya-view">
        {/* Top Legacy Reminder Banner */}
        {myKas.totalTunggakan > 0 ? (
          <div className="fin-legacy-reminder-banner" data-testid="kas-tunggakan-banner">
            <div className="fin-reminder-left">
              <div className="fin-reminder-pill">
                <span className="fin-dot-red" />
                <span>Kas kamu belum lunas</span>
              </div>
              <h2 className="fin-reminder-title">
                Hayooo {userFirstName} <span role="img" aria-label="eyes">👀</span>
              </h2>
              <p className="fin-reminder-desc">
                Kamu belum bayar kas sebesar <strong style={{ color: '#dc2626', fontWeight: 800 }}>{fmtRupiah(myKas.totalTunggakan)}</strong>.
              </p>
              <div className="fin-reminder-unpaid-tags">
                {myKas.unpaidPeriods.map((p) => (
                  <span key={p.periode_bulan} className="fin-unpaid-tag">
                    <span className="fin-dot-red" />
                    <span>{p.label}</span>
                    <strong style={{ color: '#dc2626' }}>{fmtRupiah(p.nominal)}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="fin-reminder-right">
              <div>
                <div className="fin-reminder-label">TOTAL TUNGGAKAN PRIBADI</div>
                <div className="fin-reminder-total">{fmtRupiah(myKas.totalTunggakan)}</div>
                <div className="fin-reminder-count">{myKas.unpaidPeriods.length} periode belum lunas</div>
              </div>
              <div className="fin-reminder-cta">Ayo ndang dilunasi.</div>
            </div>
          </div>
        ) : (
          <div className="fin-legacy-reminder-banner lunas" data-testid="kas-lunas-banner">
            <div className="fin-reminder-left">
              <div className="fin-reminder-pill ok">
                <span className="fin-dot-green" />
                <span>Kas kamu sudah lunas</span>
              </div>
              <h2 className="fin-reminder-title">
                Mantap {userFirstName}! <span role="img" aria-label="party">🎉</span>
              </h2>
              <p className="fin-reminder-desc">
                Semua tagihan kas pribadi kamu sudah lunas tercatat. Terima kasih atas kontribusi aktifmu!
              </p>
            </div>
            <div className="fin-reminder-right">
              <div>
                <div className="fin-reminder-label">TOTAL TUNGGAKAN PRIBADI</div>
                <div className="fin-reminder-total ok">Rp 0</div>
                <div className="fin-reminder-count">Semua periode lunas</div>
              </div>
              <div className="fin-reminder-cta ok">Terima kasih banyak!</div>
            </div>
          </div>
        )}

        {/* Hero Banner Kas Saya */}
        <div className="fin-my-hero-card">
          <div className="fin-my-hero-left">
            <div className="fin-my-avatar">
              {myKas.crew.photo ? (
                <img src={myKas.crew.photo} alt={myKas.crew.name} />
              ) : (
                myKas.crew.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="fin-my-title">Kas Saya — {myKas.crew.name}</h1>
              <div className="fin-my-meta">
                <span className="fin-my-badge">{myKas.crew.ptvId}</span>
                <span>•</span>
                <span>{myKas.crew.position}</span>
                <span>•</span>
                <span>{myKas.crew.division}</span>
              </div>
            </div>
          </div>
          <div>
            {myKas.isLunasSemua ? (
              <span className="fin-my-status-pill ok">
                <i className="fa-solid fa-circle-check" />
                <span>Lunas Semua Periode</span>
              </span>
            ) : (
              <span className="fin-my-status-pill warn">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>Ada Tunggakan Kas</span>
              </span>
            )}
          </div>
        </div>

        {/* Bento Ringkasan Pribadi */}
        <div className="fin-overview-grid">
          <div className="fin-metric-card">
            <div className="fin-metric-header">
              <span className="fin-metric-title">Total Tagihan Kas</span>
              <div className="fin-metric-icon saldo">
                <i className="fa-solid fa-calendar-check" />
              </div>
            </div>
            <div className="fin-metric-val saldo-val">{fmtRupiah(myKas.totalTagihan)}</div>
            <div className="fin-metric-desc">Periode Juli 2026 s/d sekarang</div>
          </div>

          <div className="fin-metric-card">
            <div className="fin-metric-header">
              <span className="fin-metric-title">Sudah Dibayar</span>
              <div className="fin-metric-icon pem">
                <i className="fa-solid fa-circle-check" />
              </div>
            </div>
            <div className="fin-metric-val pem-val">{fmtRupiah(myKas.totalDibayar)}</div>
            <div className="fin-metric-desc">{myKas.paidPeriods.length} bulan tercatat lunas</div>
          </div>

          <div className="fin-metric-card">
            <div className="fin-metric-header">
              <span className="fin-metric-title">Total Tunggakan</span>
              <div className="fin-metric-icon tunggakan">
                <i className="fa-solid fa-clock" />
              </div>
            </div>
            <div className="fin-metric-val tunggakan-val">{fmtRupiah(myKas.totalTunggakan)}</div>
            <div className="fin-metric-desc">
              {myKas.unpaidPeriods.length > 0 ? `${myKas.unpaidPeriods.length} bulan belum lunas` : 'Tidak ada tunggakan'}
            </div>
          </div>
        </div>

        {/* Pengingat Iuran jika ada tunggakan */}
        {myKas.unpaidPeriods.length > 0 && (
          <div className="fin-alert-card" data-testid="kas-reminder-card">
            <div className="fin-alert-icon">
              <i className="fa-solid fa-bell" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="fin-alert-title">Pengingat Pembayaran Iuran Kas Studio</div>
              <div className="fin-alert-text">
                Anda memiliki tunggakan iuran sebesar <strong>{fmtRupiah(myKas.totalTunggakan)}</strong> untuk periode{' '}
                {myKas.unpaidPeriods.map((p) => p.label).join(', ')}. Pembayaran dapat diserahkan langsung secara tunai ke Bendahara Kasir PTV (Farsya PTV-023) atau via transfer QRIS studio.
              </div>
            </div>
          </div>
        )}

        {/* Riwayat Pembayaran Pribadi */}
        <div className="fin-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 750, margin: 0, color: 'var(--ink)' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--ptv-green)', marginRight: '8px' }} />
              Riwayat Pembayaran Kas Saya
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', background: 'rgba(5, 150, 105, 0.1)', padding: '3px 10px', borderRadius: '9999px' }}>
              {myKas.paidPeriods.length} Pembayaran
            </span>
          </div>

          <div className="fin-table-scroll">
            <table className="fin-matrix-table">
              <thead>
                <tr>
                  <th>Periode Kas</th>
                  <th>Nominal Iuran</th>
                  <th>Tanggal Bayar</th>
                  <th>Metode</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Dicatat Oleh</th>
                </tr>
              </thead>
              <tbody>
                {myKas.paidPeriods.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--ink3)' }}>
                      Belum ada riwayat pembayaran yang tercatat.
                    </td>
                  </tr>
                ) : (
                  myKas.paidPeriods.map((item) => (
                    <tr key={item.periode_bulan}>
                      <td style={{ fontWeight: 750, color: 'var(--ink)' }}>{item.label}</td>
                      <td style={{ fontWeight: 800, color: '#059669' }}>{fmtRupiah(item.dibayar)}</td>
                      <td style={{ color: 'var(--ink2)' }}>{item.tanggal_bayar || '—'}</td>
                      <td>
                        <span className="fin-kru-id-badge">{item.metode_bayar || 'Tunai'}</span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#059669', background: 'rgba(5, 150, 105, 0.1)', padding: '2px 8px', borderRadius: '9999px' }}>
                          <i className="fa-solid fa-check" />
                          Lunas
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)', fontSize: '12px' }}>
                        {item.dicatat_oleh_nama}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // EXPERIENCE 2: PENGGUNA BERWENANG (ADMIN / OPERATOR KAS)
  // ------------------------------------------------------------

  // Toggle quick payment for kas kru
  const handleQuickKasToggle = (
    c: { id: string; ptv_id: string; nama_lengkap: string },
    p: { periode_bulan: string; nominal: number },
    isPaid: boolean
  ) => {
    if (!canOperate) return;

    if (isPaid) {
      if (window.confirm(`Batalkan pelunasan iuran ${p.periode_bulan} untuk ${c.nama_lengkap}?`)) {
        keuangan.undoKasLunas(c.id, c.ptv_id, p.periode_bulan);
      }
    } else {
      setSelectedCrewForLunas({
        id: c.id,
        ptvId: c.ptv_id,
        nama: c.nama_lengkap,
        periodeBulan: p.periode_bulan,
        nominal: p.nominal,
      });
      setIsTandaiLunasOpen(true);
    }
  };

  const handleConfirmLunas = (data: {
    crewId: string;
    crewPtvId: string;
    crewNama: string;
    periodeBulan: string;
    metodeBayar: PaymentMethod;
    tanggalBayar: string;
  }) => {
    keuangan.tandaiKasLunas(
      data.crewId,
      data.crewPtvId,
      data.crewNama,
      data.periodeBulan,
      user?.full_name || 'Admin Keuangan',
      user?.id,
      data.metodeBayar,
      data.tanggalBayar
    );
  };

  const handleOpenEditPemasukan = (item: PemasukanRecord) => {
    if (!canManage) return;
    setEditType('pemasukan');
    setEditPemasukanItem(item);
    setIsEditModalOpen(true);
  };

  const handleOpenEditPengeluaran = (item: PengeluaranRecord) => {
    if (!canManage) return;
    setEditType('pengeluaran');
    setEditPengeluaranItem(item);
    setIsEditModalOpen(true);
  };

  const handleVoidPemasukan = (id: string, sumber: string) => {
    if (!canManage) return;
    if (window.confirm(`Batalkan transaksi pemasukan "${sumber}" (VOID)? Transaksi akan dinonaktifkan dari saldo kas.`)) {
      keuangan.voidPemasukan(id);
    }
  };

  const handleVoidPengeluaran = (id: string, keperluan: string) => {
    if (!canManage) return;
    if (window.confirm(`Batalkan transaksi pengeluaran "${keperluan}" (VOID)? Transaksi akan dinonaktifkan dari saldo kas.`)) {
      keuangan.voidPengeluaran(id);
    }
  };

  return (
    <div className="fin-page-container" data-testid="keuangan-admin-view">
      {/* 1. Top Legacy Reminder Banner (Banner Pengingat Tunggakan Kas Pribadi) */}
      {myKas.totalTunggakan > 0 ? (
        <div className="fin-legacy-reminder-banner" data-testid="kas-tunggakan-banner">
          <div className="fin-reminder-left">
            <div className="fin-reminder-pill">
              <span className="fin-dot-red" />
              <span>Kas kamu belum lunas</span>
            </div>
            <h2 className="fin-reminder-title">
              Hayooo {userFirstName} <span role="img" aria-label="eyes">👀</span>
            </h2>
            <p className="fin-reminder-desc">
              Kamu belum bayar kas sebesar <strong style={{ color: '#dc2626', fontWeight: 800 }}>{fmtRupiah(myKas.totalTunggakan)}</strong>.
            </p>
            <div className="fin-reminder-unpaid-tags">
              {myKas.unpaidPeriods.map((p) => (
                <span key={p.periode_bulan} className="fin-unpaid-tag">
                  <span className="fin-dot-red" />
                  <span>{p.label}</span>
                  <strong style={{ color: '#dc2626' }}>{fmtRupiah(p.nominal)}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="fin-reminder-right">
            <div>
              <div className="fin-reminder-label">TOTAL TUNGGAKAN PRIBADI</div>
              <div className="fin-reminder-total">{fmtRupiah(myKas.totalTunggakan)}</div>
              <div className="fin-reminder-count">{myKas.unpaidPeriods.length} periode belum lunas</div>
            </div>
            <div className="fin-reminder-cta">Ayo ndang dilunasi.</div>
          </div>
        </div>
      ) : (
        <div className="fin-legacy-reminder-banner lunas" data-testid="kas-lunas-banner">
          <div className="fin-reminder-left">
            <div className="fin-reminder-pill ok">
              <span className="fin-dot-green" />
              <span>Kas kamu sudah lunas</span>
            </div>
            <h2 className="fin-reminder-title">
              Mantap {userFirstName}! <span role="img" aria-label="party">🎉</span>
            </h2>
            <p className="fin-reminder-desc">
              Semua tagihan kas pribadi kamu sudah lunas tercatat. Terima kasih atas kontribusi aktifmu!
            </p>
          </div>
          <div className="fin-reminder-right">
            <div>
              <div className="fin-reminder-label">TOTAL TUNGGAKAN PRIBADI</div>
              <div className="fin-reminder-total ok">Rp 0</div>
              <div className="fin-reminder-count">Semua periode lunas</div>
            </div>
            <div className="fin-reminder-cta ok">Terima kasih banyak!</div>
          </div>
        </div>
      )}

      {/* 2. Empat Kartu Ringkasan Keuangan (Four Summary Cards) */}
      <div className="fin-legacy-bento-grid">
        <div className="fin-legacy-card" data-testid="card-saldo">
          <div className="fin-legacy-card-top">
            <span className="fin-legacy-card-title">Saldo Kas PTV</span>
            <div className="fin-legacy-card-icon saldo">
              <i className="fa-solid fa-wallet" />
            </div>
          </div>
          <div className="fin-legacy-card-val">{fmtRupiah(summary.saldoKas)}</div>
          <div className="fin-legacy-card-sub">Pemasukan dikurangi pengeluaran</div>
        </div>

        <div className="fin-legacy-card" data-testid="card-pemasukan">
          <div className="fin-legacy-card-top">
            <span className="fin-legacy-card-title">Total Pemasukan</span>
            <div className="fin-legacy-card-icon pem">
              <i className="fa-solid fa-arrow-down" />
            </div>
          </div>
          <div className="fin-legacy-card-val pem-val">+ {fmtRupiah(summary.totalPemasukan)}</div>
          <div className="fin-legacy-card-sub">{keuangan.getAllPemasukan(false).length} transaksi pemasukan</div>
        </div>

        <div className="fin-legacy-card" data-testid="card-pengeluaran">
          <div className="fin-legacy-card-top">
            <span className="fin-legacy-card-title">Total Pengeluaran</span>
            <div className="fin-legacy-card-icon pen">
              <i className="fa-solid fa-arrow-up" />
            </div>
          </div>
          <div className="fin-legacy-card-val pen-val">- {fmtRupiah(summary.totalPengeluaran)}</div>
          <div className="fin-legacy-card-sub">{keuangan.getAllPengeluaran(false).length} transaksi belanja</div>
        </div>

        <div className="fin-legacy-card" data-testid="card-tunggakan">
          <div className="fin-legacy-card-top">
            <span className="fin-legacy-card-title">Tunggakan Pribadi</span>
            <div className="fin-legacy-card-icon tunggakan">
              <i className="fa-solid fa-hand-holding-dollar" />
            </div>
          </div>
          <div className="fin-legacy-card-val tunggakan-val">{fmtRupiah(myKas.totalTunggakan)}</div>
          <div className="fin-legacy-card-sub">
            {myKas.unpaidPeriods.length > 0 ? `${myKas.unpaidPeriods.length} periode belum lunas` : 'Semua periode lunas'}
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation Row */}
      <div className="fin-legacy-nav-row">
        <div className="fin-legacy-tab-group">
          <button
            type="button"
            className={`fin-legacy-tab-btn ${activeTab === 'kas_kru' ? 'active' : ''}`}
            onClick={() => setActiveTab('kas_kru')}
          >
            <i className="fa-solid fa-book-bookmark" />
            <span>Iuran Kas Kru</span>
          </button>
          <button
            type="button"
            className={`fin-legacy-tab-btn ${activeTab === 'pemasukan' ? 'active' : ''}`}
            onClick={() => setActiveTab('pemasukan')}
          >
            <i className="fa-solid fa-arrow-down" />
            <span>Pemasukan Kas</span>
          </button>
          <button
            type="button"
            className={`fin-legacy-tab-btn ${activeTab === 'pengeluaran' ? 'active' : ''}`}
            onClick={() => setActiveTab('pengeluaran')}
          >
            <i className="fa-solid fa-arrow-up" />
            <span>Pengeluaran Kas</span>
          </button>
        </div>

        {canOperate && (
          <button
            type="button"
            className="fin-legacy-settings-btn"
            onClick={() => {
              setPengaturanSelectedMonth(undefined);
              setIsPengaturanOpen(true);
            }}
          >
            <i className="fa-solid fa-gear" />
            <span>Pengaturan Iuran Kas</span>
          </button>
        )}
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="fin-legacy-filter-bar">
        <div className="fin-legacy-search-box">
          <i className="fa-solid fa-magnifying-glass fin-legacy-search-icon" />
          <input
            type="text"
            className="fin-legacy-search-input"
            placeholder={
              activeTab === 'kas_kru'
                ? 'Cari nama kru, PTV-ID, atau divisi...'
                : activeTab === 'pemasukan'
                ? 'Cari sumber, kategori, atau keterangan pemasukan...'
                : 'Cari keperluan, kategori, atau keterangan belanja...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="fin-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Bersihkan pencarian"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        <div className="fin-legacy-filter-actions">
          {activeTab === 'kas_kru' && (
            <>
              <span className="fin-legacy-pill-kru">
                <i className="fa-solid fa-user-check" />
                <span>Kru Aktif ({operationalCrew.length})</span>
              </span>

              {canOperate && (
                <button
                  type="button"
                  className="fin-legacy-settings-btn"
                  onClick={() => {
                    setPengaturanSelectedMonth(undefined);
                    setIsPengaturanOpen(true);
                  }}
                >
                  <i className="fa-solid fa-gear" />
                  <span>Pengaturan Iuran Kas</span>
                </button>
              )}
            </>
          )}

          {activeTab === 'pemasukan' && canOperate && (
            <button
              type="button"
              className="fin-btn-primary green"
              onClick={() => setIsPemasukanOpen(true)}
            >
              <i className="fa-solid fa-plus" />
              <span>Catat Pemasukan</span>
            </button>
          )}

          {activeTab === 'pengeluaran' && canOperate && (
            <button
              type="button"
              className="fin-btn-primary red"
              onClick={() => setIsPengeluaranOpen(true)}
            >
              <i className="fa-solid fa-plus" />
              <span>Catat Pengeluaran</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Tab 1: Kas Kru Matrix */}
      {activeTab === 'kas_kru' && (
        <>
          <div className="fin-legacy-table-card">
            <div className="fin-table-scroll">
              <table className="fin-legacy-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>KRU PTV</th>
                    {validPeriods.map((p) => (
                      <th key={p.periode_bulan} className="center" style={{ minWidth: '110px' }}>
                        <div className="fin-legacy-month-title">{fmtPeriodeBulan(p.periode_bulan)}</div>
                        {canOperate ? (
                          <button
                            type="button"
                            className="fin-legacy-month-nominal"
                            onClick={() => {
                              setPengaturanSelectedMonth(p.periode_bulan);
                              setIsPengaturanOpen(true);
                            }}
                            title={`Ubah nominal ${fmtPeriodeBulan(p.periode_bulan)}`}
                          >
                            <span>{fmtRupiah(p.nominal)}</span>
                            <i className="fa-solid fa-pen" style={{ fontSize: '10px' }} />
                          </button>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#0e4f40', fontWeight: 700 }}>
                            {fmtRupiah(p.nominal)}
                          </div>
                        )}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', minWidth: '140px' }}>TOTAL TUNGGAKAN</th>
                  </tr>
                </thead>
                <tbody>
                  {operationalCrew.length === 0 ? (
                    <tr>
                      <td colSpan={validPeriods.length + 2} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        Tidak ada kru yang cocok dengan pencarian "{searchQuery}".
                      </td>
                    </tr>
                  ) : (
                    operationalCrew.map((c: CrewMember) => {
                      const joinYM = c.join_date ? c.join_date.slice(0, 7) : '2026-07';
                      let totalKruTunggakan = 0;

                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="fin-legacy-kru-cell">
                              <div className="fin-legacy-avatar">
                                {c.foto_url ? (
                                  <img src={c.foto_url} alt={c.full_name} />
                                ) : (
                                  c.full_name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="fin-legacy-kru-info">
                                <div className="fin-legacy-kru-name-line">
                                  <span className="fin-legacy-kru-name">{c.full_name}</span>
                                  <span className="fin-legacy-badge-aktif">Aktif</span>
                                </div>
                                <div className="fin-legacy-kru-role">
                                  {c.position || 'Kru'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {validPeriods.map((p) => {
                            const st = keuangan.getKruPaymentStatus(c.id, c.ptv_id, c.full_name, p.periode_bulan);
                            if (joinYM > p.periode_bulan && !st.isPaid) {
                              return (
                                <td key={p.periode_bulan} style={{ textAlign: 'center', color: '#94a3b8' }} title="Belum bergabung pada periode ini">
                                  —
                                </td>
                              );
                            }

                            if (!st.isPaid) {
                              totalKruTunggakan += st.sisa;
                            }

                            if (canOperate) {
                              return (
                                <td key={p.periode_bulan} style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className={`fin-legacy-circle-btn ${st.isPaid ? 'paid' : ''}`}
                                    onClick={() =>
                                      handleQuickKasToggle(
                                        { id: c.id, ptv_id: c.ptv_id, nama_lengkap: c.full_name },
                                        p,
                                        st.isPaid
                                      )
                                    }
                                    title={
                                      st.isPaid
                                        ? `Lunas (${st.record?.tanggal_bayar || 'Tercatat'}) — Klik untuk batalkan`
                                        : `Tandai lunas: ${c.full_name} (${fmtPeriodeBulan(p.periode_bulan)})`
                                    }
                                    aria-label={st.isPaid ? 'Lunas' : 'Belum Lunas'}
                                  >
                                    {st.isPaid ? (
                                      <>
                                        <i className="fa-solid fa-check ic-check" />
                                        <i className="fa-solid fa-rotate-left ic-undo" />
                                      </>
                                    ) : null}
                                  </button>
                                </td>
                              );
                            }

                            return (
                              <td key={p.periode_bulan} style={{ textAlign: 'center' }}>
                                <span
                                  className={`fin-legacy-circle-btn ${st.isPaid ? 'paid' : ''}`}
                                  style={{ cursor: 'default' }}
                                >
                                  {st.isPaid && <i className="fa-solid fa-check" />}
                                </span>
                              </td>
                            );
                          })}

                          <td style={{ textAlign: 'right' }}>
                            {totalKruTunggakan === 0 ? (
                              <span className="fin-legacy-total-tunggakan lunas">
                                <i className="fa-solid fa-check-double" style={{ marginRight: '4px' }} />
                                Lunas Semua
                              </span>
                            ) : (
                              <span className="fin-legacy-total-tunggakan">
                                {fmtRupiah(totalKruTunggakan)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riwayat Kas Saya untuk Admin jika terdaftar sebagai kru */}
          {myKas.paidPeriods.length > 0 && (
            <div className="fin-table-card" style={{ marginTop: '24px' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 750, color: 'var(--ink)' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--ptv-green)', marginRight: '8px' }} />
                  Riwayat Iuran Kas Pribadi Saya ({myKas.crew.name})
                </h4>
                <span className="fin-kru-id-badge">{myKas.paidPeriods.length} Bulan Lunas</span>
              </div>
              <div className="fin-table-scroll">
                <table className="fin-matrix-table">
                  <thead>
                    <tr>
                      <th>Periode</th>
                      <th>Nominal</th>
                      <th>Tanggal Pembayaran</th>
                      <th>Metode</th>
                      <th style={{ textAlign: 'right' }}>Dicatat Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myKas.paidPeriods.map((p) => (
                      <tr key={p.periode_bulan}>
                        <td style={{ fontWeight: 750 }}>{p.label}</td>
                        <td style={{ fontWeight: 800, color: '#059669' }}>{fmtRupiah(p.dibayar)}</td>
                        <td>{p.tanggal_bayar}</td>
                        <td>
                          <span className="fin-kru-id-badge">{p.metode_bayar || 'Tunai'}</span>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>{p.dicatat_oleh_nama}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. Tab 2: Pemasukan */}
      {activeTab === 'pemasukan' && (
        <div>
          {pemasukanGroups.length === 0 ? (
            <div className="fin-table-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--ink3)' }}>
              <i className="fa-solid fa-arrow-down" style={{ fontSize: '28px', opacity: 0.4, display: 'block', marginBottom: '12px' }} />
              Belum ada catatan transaksi pemasukan.
            </div>
          ) : (
            pemasukanGroups.map((g) => (
              <div key={g.ym} className="fin-month-section">
                <div className="fin-month-header">
                  <div className="fin-month-title-wrap">
                    <div className="fin-month-icon pem">
                      <i className="fa-solid fa-calendar-days" />
                    </div>
                    <div>
                      <div className="fin-month-title">{g.label}</div>
                      <div className="fin-month-count">{g.items.length} transaksi kas masuk</div>
                    </div>
                  </div>
                  <div className="fin-month-chip pem">
                    <span>Total Bulan Ini:</span>
                    <span className="val">+ {fmtRupiah(g.total)}</span>
                  </div>
                </div>

                <div className="fin-table-card fin-month-card-body">
                  <div className="fin-table-scroll">
                    <table className="fin-matrix-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Sumber & Kategori</th>
                          <th className="fin-td-center">Bukti</th>
                          <th>Nominal</th>
                          <th>Keterangan</th>
                          <th>Dicatat Oleh</th>
                          {canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((item) => (
                          <tr key={item.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 650, color: 'var(--ink2)' }}>
                              {item.tanggal}
                            </td>
                            <td>
                              <div style={{ fontWeight: 750, color: 'var(--ink)' }}>{item.sumber}</div>
                              <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="fin-kru-id-badge">{item.kategori}</span>
                                {item.kru_nama && (
                                  <span style={{ fontSize: '11px', color: 'var(--ptv-green)', fontWeight: 650 }}>
                                    <i className="fa-solid fa-user" style={{ marginRight: '3px' }} />
                                    {item.kru_nama}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="fin-td-center">
                              {item.bukti_url ? (
                                <button
                                  type="button"
                                  className="fin-thumb-box"
                                  onClick={() => {
                                    setLightboxUrl(item.bukti_url || null);
                                    setLightboxCaption(`Bukti: ${item.sumber} (+${fmtRupiah(item.nominal)})`);
                                  }}
                                  title="Lihat Bukti Foto"
                                >
                                  <img src={item.bukti_url} alt="Bukti" />
                                </button>
                              ) : (
                                <div className="fin-thumb-empty" title="Tidak ada bukti">
                                  <i className="fa-solid fa-camera" />
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 850, color: '#059669', fontSize: '14px' }}>
                              + {fmtRupiah(item.nominal)}
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--ink2)', maxWidth: '280px' }}>
                              {item.keterangan || '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--ink3)' }}>
                              {item.dicatat_oleh_nama}
                            </td>
                            {canManage && (
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {!item.kas_kru_id && (
                                    <button
                                      type="button"
                                      className="fin-btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                      onClick={() => handleOpenEditPemasukan(item)}
                                      title="Edit Pemasukan"
                                    >
                                      <i className="fa-solid fa-pen-to-square" style={{ color: '#059669' }} />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="fin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}
                                    onClick={() => handleVoidPemasukan(item.id, item.sumber)}
                                    title="Batalkan Transaksi (VOID)"
                                  >
                                    <i className="fa-solid fa-ban" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. Tab 3: Pengeluaran */}
      {activeTab === 'pengeluaran' && (
        <div>
          {pengeluaranGroups.length === 0 ? (
            <div className="fin-table-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--ink3)' }}>
              <i className="fa-solid fa-arrow-up" style={{ fontSize: '28px', opacity: 0.4, display: 'block', marginBottom: '12px' }} />
              Belum ada catatan transaksi pengeluaran.
            </div>
          ) : (
            pengeluaranGroups.map((g) => (
              <div key={g.ym} className="fin-month-section">
                <div className="fin-month-header">
                  <div className="fin-month-title-wrap">
                    <div className="fin-month-icon pen">
                      <i className="fa-solid fa-calendar-days" />
                    </div>
                    <div>
                      <div className="fin-month-title">{g.label}</div>
                      <div className="fin-month-count">{g.items.length} transaksi belanja studio</div>
                    </div>
                  </div>
                  <div className="fin-month-chip pen">
                    <span>Total Bulan Ini:</span>
                    <span className="val">- {fmtRupiah(g.total)}</span>
                  </div>
                </div>

                <div className="fin-table-card fin-month-card-body">
                  <div className="fin-table-scroll">
                    <table className="fin-matrix-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Keperluan & Kategori</th>
                          <th className="fin-td-center">Bukti</th>
                          <th>Nominal</th>
                          <th>Keterangan</th>
                          <th>Dicatat Oleh</th>
                          {canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((item) => (
                          <tr key={item.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 650, color: 'var(--ink2)' }}>
                              {item.tanggal}
                            </td>
                            <td>
                              <div style={{ fontWeight: 750, color: 'var(--ink)' }}>{item.keperluan}</div>
                              <div style={{ marginTop: '2px' }}>
                                <span className="fin-kru-id-badge">{item.kategori}</span>
                              </div>
                            </td>
                            <td className="fin-td-center">
                              {item.bukti_url ? (
                                <button
                                  type="button"
                                  className="fin-thumb-box"
                                  onClick={() => {
                                    setLightboxUrl(item.bukti_url || null);
                                    setLightboxCaption(`Bukti: ${item.keperluan} (-${fmtRupiah(item.nominal)})`);
                                  }}
                                  title="Lihat Bukti Foto"
                                >
                                  <img src={item.bukti_url} alt="Bukti" />
                                </button>
                              ) : (
                                <div className="fin-thumb-empty" title="Tidak ada bukti">
                                  <i className="fa-solid fa-camera" />
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 850, color: '#dc2626', fontSize: '14px' }}>
                              - {fmtRupiah(item.nominal)}
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--ink2)', maxWidth: '280px' }}>
                              {item.keterangan || '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--ink3)' }}>
                              {item.dicatat_oleh_nama}
                            </td>
                            {canManage && (
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="fin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => handleOpenEditPengeluaran(item)}
                                    title="Edit Pengeluaran"
                                  >
                                    <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--ptv-green)' }} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="fin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}
                                    onClick={() => handleVoidPengeluaran(item.id, item.keperluan)}
                                    title="Batalkan Transaksi (VOID)"
                                  >
                                    <i className="fa-solid fa-ban" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {selectedCrewForLunas && (
        <TandaiLunasModal
          isOpen={isTandaiLunasOpen}
          onClose={() => {
            setIsTandaiLunasOpen(false);
            setSelectedCrewForLunas(null);
          }}
          crewName={selectedCrewForLunas.nama}
          crewPtvId={selectedCrewForLunas.ptvId}
          crewId={selectedCrewForLunas.id}
          periodeBulan={selectedCrewForLunas.periodeBulan}
          nominal={selectedCrewForLunas.nominal}
          onConfirm={handleConfirmLunas}
        />
      )}

      <CatatPemasukanModal
        isOpen={isPemasukanOpen}
        onClose={() => setIsPemasukanOpen(false)}
        onSave={(data) => {
          keuangan.tambahPemasukan(data, user?.full_name || 'Admin Keuangan');
        }}
      />

      <CatatPengeluaranModal
        isOpen={isPengeluaranOpen}
        onClose={() => setIsPengeluaranOpen(false)}
        onSave={(data) => {
          keuangan.tambahPengeluaran(data, user?.full_name || 'Admin Keuangan');
        }}
      />

      <EditTransaksiModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditPemasukanItem(null);
          setEditPengeluaranItem(null);
        }}
        type={editType}
        pemasukanItem={editPemasukanItem}
        pengeluaranItem={editPengeluaranItem}
        onSavePemasukan={(id, data) => {
          keuangan.updatePemasukan(id, data);
        }}
        onSavePengeluaran={(id, data) => {
          keuangan.updatePengeluaran(id, data);
        }}
      />

      {lightboxUrl && (
        <ImageLightboxModal
          isOpen={Boolean(lightboxUrl)}
          imageUrl={lightboxUrl}
          altText="Bukti Transaksi"
          title="Bukti Transaksi Keuangan"
          caption={lightboxCaption}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      <PengaturanIuranKasModal
        isOpen={isPengaturanOpen}
        onClose={() => {
          setIsPengaturanOpen(false);
          setPengaturanSelectedMonth(undefined);
        }}
        initialMonth={pengaturanSelectedMonth}
      />
    </div>
  );
};
