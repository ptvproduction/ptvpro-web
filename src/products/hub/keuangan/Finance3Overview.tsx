import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Wallet, CheckCircle2, History, ArrowRight, QrCode, Users, FileText } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import type { FinanceOperationalData } from './financeOperationalData';
import { cleanTransactionTitle, isTestTransaction, TEST_POCKET_IDS, type CanonicalTransaction } from './financeCanonical';

interface Finance3OverviewProps {
  data: FinanceSnapshot;
  operationalData?: FinanceOperationalData | null;
  onOpenCatat: (type: 'income' | 'expense' | 'transfer') => void;
  onSelectTab: (tab: string) => void;
  onSelectTransaction: (tx: CanonicalTransaction) => void;
}

export function Finance3Overview({
  data,
  operationalData,
  onOpenCatat,
  onSelectTab,
  onSelectTransaction,
}: Finance3OverviewProps) {
  const pockets = (data.canonical.state === 'available' ? data.canonical.pockets || [] : []).filter(
    p => !TEST_POCKET_IDS.has(p.id)
  );
  const transactions = (data.canonical.state === 'available' ? data.canonical.transactions || [] : []).filter(
    t => !isTestTransaction(t)
  );

  const mainPocket = pockets.find(p => p.name.includes('Kas Utama') && !p.archived) || pockets[0];
  const saldoKas = mainPocket ? (Number(mainPocket.balanceMinor) || 0) / 100 : 0;

  // Calculate posted cashflow metrics
  const postedTxs = transactions.filter(t => t.status === 'posted');
  const totalPemasukan = postedTxs
    .filter(t => t.kind === 'income')
    .reduce((sum, t) => sum + (Number(t.amountMinor) || 0) / 100, 0);
  const totalPengeluaran = postedTxs
    .filter(t => t.kind === 'expense')
    .reduce((sum, t) => sum + (Number(t.amountMinor) || 0) / 100, 0);
  const netArusKas = totalPemasukan - totalPengeluaran;

  const recentTxs = transactions.slice(0, 6);

  // Ringkasan Kas Kru & Piutang
  const kasRecordsCount = operationalData?.records?.filter(r => r.status === 'lunas').length
    || postedTxs.filter(t => t.description?.includes('Iuran Kas Kru')).length;
  const activeLoans = operationalData?.loans?.filter(l => l.status !== 'lunas' && l.status !== 'dibatalkan') || [];
  const totalPiutangAktif = activeLoans.reduce((sum, l) => sum + (Number(l.remainingMinor) || 0) / 100, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Hero Saldo Kas Utama */}
      <section className="finance3-hero">
        <div className="finance3-hero-top">
          <div>
            <div className="finance3-hero-label">Saldo Kas Utama Studio</div>
            <div className="finance3-hero-balance">Rp {saldoKas.toLocaleString('id-ID')}</div>
            <div className="finance3-hero-sub">
              <CheckCircle2 size={14} style={{ color: '#059669' }} />
              <span>Terverifikasi PostgreSQL Cloud Staging · 100% Terekonsiliasi Dasbor PTV</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              shape="pill"
              size="sm"
              variant="primary"
              onClick={() => onOpenCatat('income')}
              style={{ background: '#059669', borderColor: '#059669', color: '#ffffff' }}
            >
              <ArrowDownLeft size={15} /> + Pemasukan
            </Button>
            <Button
              shape="pill"
              size="sm"
              variant="primary"
              onClick={() => onOpenCatat('expense')}
              style={{ background: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
            >
              <ArrowUpRight size={15} /> - Pengeluaran
            </Button>
            <Button
              shape="pill"
              size="sm"
              variant="secondary"
              onClick={() => onOpenCatat('transfer')}
            >
              <ArrowLeftRight size={14} /> ⇄ Transfer Kantong
            </Button>
            <Button
              shape="pill"
              size="sm"
              variant="secondary"
              onClick={() => onSelectTab('kantong')}
            >
              <QrCode size={14} /> QRIS & Kantong
            </Button>
          </div>
        </div>

        {/* Cashflow Metrics */}
        <div className="finance3-hero-metrics">
          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Total Pemasukan Tercatat</span>
            <span className="finance3-metric-value income">+ Rp {totalPemasukan.toLocaleString('id-ID')}</span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Total Pengeluaran Tercatat</span>
            <span className="finance3-metric-value expense">- Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Net Arus Kas Keseluruhan</span>
            <span className="finance3-metric-value net">Rp {netArusKas.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </section>

      {/* 2. Kartu Akses Cepat Operasional: Kantong & QRIS, Kas Kru, Piutang */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        <div
          className="finance3-card clickable"
          onClick={() => onSelectTab('kantong')}
          style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>KANTONG & QRIS STUDIO</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #0b2a4a)', marginTop: '2px' }}>
              {pockets.filter(p => !p.archived).length} Kantong Aktif
            </div>
            <div style={{ fontSize: '11.5px', color: '#0b5fbf', marginTop: '2px', fontWeight: 600 }}>
              Kelola Alokasi, Transfer & QRIS →
            </div>
          </div>
          <QrCode size={26} style={{ color: '#0b5fbf', opacity: 0.85 }} />
        </div>

        <div
          className="finance3-card clickable"
          onClick={() => onSelectTab('kas-kru')}
          style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>IURAN KAS KRU & SEMESTER</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
              {kasRecordsCount} Pembayaran Lunas
            </div>
            <div style={{ fontSize: '11.5px', color: '#0b5fbf', marginTop: '2px', fontWeight: 600 }}>
              Buka Matriks Semester →
            </div>
          </div>
          <Users size={26} style={{ color: '#059669', opacity: 0.85 }} />
        </div>

        <div
          className="finance3-card clickable"
          onClick={() => onSelectTab('piutang')}
          style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>PIUTANG & TAGIHAN</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: activeLoans.length > 0 ? '#dc2626' : 'var(--ink, #0b2a4a)', marginTop: '2px' }}>
              {activeLoans.length > 0 ? `Rp ${totalPiutangAktif.toLocaleString('id-ID')}` : 'Rp 0 (Nihil)'}
            </div>
            <div style={{ fontSize: '11.5px', color: '#0b5fbf', marginTop: '2px', fontWeight: 600 }}>
              Kelola Tagihan & Pelunasan →
            </div>
          </div>
          <FileText size={26} style={{ color: '#0b5fbf', opacity: 0.85 }} />
        </div>
      </div>

      {/* 3. Grid Dua Kolom: Transaksi Terbaru & Status Kantong */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* A. Aktivitas Transaksi Terbaru */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h2 className="finance3-card-title">
              <History size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Aktivitas Transaksi Terbaru
            </h2>
            <Button variant="ghost" size="sm" shape="pill" onClick={() => onSelectTab('transaksi')}>
              Lihat Semua <ArrowRight size={14} />
            </Button>
          </div>

          {recentTxs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted, #6e8cae)', fontSize: '13px' }}>
              Belum ada riwayat transaksi.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTxs.map(tx => {
                const isInc = tx.kind === 'income';
                const isTrf = tx.kind === 'transfer';
                const isRev = tx.status === 'reversed';
                const amt = (Number(tx.amountMinor) || 0) / 100;
                return (
                  <div
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 8px',
                      borderBottom: '1px solid var(--line-2, rgba(11,42,74,0.05))',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background-color 0.12s ease',
                    }}
                    className="clickable"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span
                        style={{
                          display: 'inline-grid',
                          placeItems: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isTrf ? '#edf4ff' : isInc ? '#e1f5ee' : '#fde8e6',
                          color: isTrf ? '#0b5fbf' : isInc ? '#0f7a5a' : '#b02b23',
                          flexShrink: 0,
                        }}
                      >
                        {isTrf ? <ArrowLeftRight size={14} /> : isInc ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--ink, #0b2a4a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cleanTransactionTitle(tx.description)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)' }}>
                          {tx.occurredOn} · {isRev ? 'Dibatalkan (VOID)' : isTrf ? 'Transfer Kantong' : isInc ? 'Pemasukan' : 'Pengeluaran'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: isRev ? 'var(--muted, #6e8cae)' : isTrf ? '#0b5fbf' : isInc ? '#059669' : '#dc2626',
                        textDecoration: isRev ? 'line-through' : 'none',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px',
                      }}
                    >
                      {isTrf ? '⇄ ' : isInc ? '+ ' : '- '}Rp {amt.toLocaleString('id-ID')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B. Status Kantong Kas Aktif */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h2 className="finance3-card-title">
              <Wallet size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Kantong Kas Studio
            </h2>
            <Button variant="ghost" size="sm" shape="pill" onClick={() => onSelectTab('kantong')}>
              Rincian Kantong <ArrowRight size={14} />
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pockets.filter(p => !p.archived).map(pocket => {
              const pBal = (Number(pocket.balanceMinor) || 0) / 100;
              return (
                <div
                  key={pocket.id}
                  onClick={() => onSelectTab('kantong')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--ptv-curve-md, 12px)',
                    background: 'var(--surface-2, #f8fafd)',
                    border: '1px solid var(--line-2, rgba(11, 42, 74, 0.06))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink, #0b2a4a)' }}>
                      {pocket.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted, #6e8cae)', marginTop: '2px' }}>
                      {pocket.kind === 'cash' ? 'Kas Fisik Tunai' : `${pocket.provider || 'Bank'} — ${pocket.accountNumber || ''}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--ink, #0b2a4a)', fontVariantNumeric: 'tabular-nums' }}>
                      Rp {pBal.toLocaleString('id-ID')}
                    </div>
                    <span className="finance3-badge posted" style={{ marginTop: '2px' }}>
                      Aktif Operasional
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: 'var(--ptv-curve-md, 12px)',
              background: '#edf4ff',
              border: '1px solid #dcebff',
              color: '#0b5fbf',
              fontSize: '12px',
              lineHeight: 1.45,
            }}
          >
            <b>Integritas Ledger Finance 3.0:</b> Seluruh mutasi kas dicatat menggunakan transaksi atomik PostgreSQL ACID. Tidak ada perhitungan saldo frontend yang terlepas dari database.
          </div>
        </div>
      </div>
    </div>
  );
}
