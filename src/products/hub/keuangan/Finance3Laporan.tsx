import { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, Calendar, PieChart, Wallet, Users } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import type { FinanceOperationalData } from './financeOperationalData';
import { isTestTransaction, TEST_POCKET_IDS } from './financeCanonical';
import { generateLaporan, getDateRangeFromPreset, type LaporanFilter } from './laporanService';
import { exportLaporanXLSX, exportLaporanPDF } from './exportUtils';

interface Finance3LaporanProps {
  data: FinanceSnapshot;
  operationalData?: FinanceOperationalData | null;
  operationalLoading?: boolean;
  operationalError?: string;
  onRetryOperational?: () => void;
}

export function Finance3Laporan(props: Finance3LaporanProps) {
  if (props.operationalError) return <div className="finance3-card" role="alert">Laporan belum dapat dimuat. {props.operationalError} <button onClick={props.onRetryOperational}>Coba Lagi</button></div>;
  if (props.operationalLoading || !props.operationalData) return <div className="finance3-card" role="status">Memuat data laporan keuangan…</div>;
  if (props.data.canonical.state !== 'available') return <div className="finance3-card" role="alert">Data ledger laporan belum tersedia.</div>;
  return <Finance3LaporanContent data={props.data} operationalData={props.operationalData} />;
}

function Finance3LaporanContent({ data, operationalData }: Finance3LaporanProps & { operationalData: FinanceOperationalData }) {
  const [datePreset, setDatePreset] = useState<string>('bulan_ini');
  const [pocketFilter, setPocketFilter] = useState<string>('semua');
  const [exportError, setExportError] = useState('');

  const transactions = useMemo(
    () => (data.canonical.state === 'available' ? data.canonical.transactions || [] : []).filter(t => !isTestTransaction(t)),
    [data.canonical]
  );
  const categories = data.canonical.state === 'available' ? data.canonical.categories || [] : [];
  const pockets = (data.canonical.state === 'available' ? data.canonical.pockets || [] : []).filter(
    p => !TEST_POCKET_IDS.has(p.id)
  );

  const dateRange = useMemo(() => {
    const semester = operationalData.semesters.find(s => `semester:${s.id}` === datePreset);
    return semester ? { startDate: semester.startDate, endDate: semester.endDate } : getDateRangeFromPreset(datePreset as LaporanFilter['datePreset']);
  }, [datePreset, operationalData.semesters]);

  const filter: LaporanFilter = useMemo(() => ({
    datePreset: datePreset.startsWith('semester:') ? 'custom' : datePreset as LaporanFilter['datePreset'],
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    pocketId: pocketFilter,
    categoryId: 'semua',
    kind: 'semua',
    status: 'posted_only',
  }), [datePreset, dateRange, pocketFilter]);

  const calculation = useMemo(() => {
    try {
      const report = generateLaporan(transactions, pockets, categories, filter, operationalData);
      const semesters = operationalData.semesters.map(sem => {
        const recap = generateLaporan(transactions, pockets, categories, { ...filter, startDate: sem.startDate, endDate: sem.endDate }, operationalData);
        return { ...sem, inc: Number(recap.totalInflowMinor) / 100, exp: Number(recap.totalOutflowMinor) / 100,
          kasKruCount: operationalData.records.filter(r => r.semesterId === sem.id && r.period >= sem.startDate.slice(0, 7) && r.period <= sem.endDate.slice(0, 7) && r.status === 'lunas' && (filter.pocketId === 'semua' || r.pocketId === filter.pocketId)).length };
      });
      return { report, semesters, error: '' };
    } catch {
      return { report: null, semesters: [], error: 'Data laporan tidak dapat dihitung. Muat ulang data keuangan dan coba lagi.' };
    }
  }, [transactions, pockets, categories, filter, operationalData]);
  if (!calculation.report) return <div className="finance3-card" role="alert">{calculation.error}</div>;
  const laporanResult = calculation.report;

  const totalMasuk = (Number(laporanResult.totalInflowMinor) || 0) / 100;
  const totalKeluar = (Number(laporanResult.totalOutflowMinor) || 0) / 100;
  const surplusDefisit = totalMasuk - totalKeluar;
  const saldoAkhir = Number(laporanResult.totalBalanceMinor) / 100;

  const expenseBreakdown = laporanResult.categoryDistribution.filter(c => c.kind === 'expense');

  const incomeBreakdown = laporanResult.categoryDistribution.filter(c => c.kind === 'income');

  const handleExportXLSX = () => {
    try {
      setExportError('');
      exportLaporanXLSX(laporanResult, pockets, categories, { kasRecords: operationalData.records.filter(r => r.period >= filter.startDate.slice(0, 7) && r.period <= filter.endDate.slice(0, 7) && (filter.pocketId === 'semua' || r.pocketId === filter.pocketId)), loans: operationalData.loans });
    } catch { setExportError('Ekspor Excel gagal. Coba lagi.'); }
  };

  const handleExportPDF = async () => {
    try { setExportError(''); await exportLaporanPDF(laporanResult, pockets, categories); }
    catch { setExportError('Ekspor PDF gagal. Coba lagi.'); }
  };

  const semesterRecapRows = calculation.semesters;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {exportError && <div className="finance3-card" role="alert">{exportError}</div>}
      {/* 1. Header Toolbar Laporan */}
      <div className="finance3-card">
        <div className="finance3-card-header">
          <div>
            <h2 className="finance3-card-title">
              <FileSpreadsheet size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Laporan & Rekapitulasi Pembukuan
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #6e8cae)' }}>
              Rekapitulasi arus kas masuk, pengeluaran per kategori, rekap per kantong, dan rekap per semester PTV.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              aria-label="Filter Kantong Laporan"
              className="finance3-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
              value={pocketFilter}
              onChange={e => setPocketFilter(e.target.value)}
            >
              <option value="semua">Semua Kantong</option>
              {pockets.filter(p => !p.archived).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} style={{ color: 'var(--muted, #6e8cae)' }} />
              <select
                aria-label="Filter Periode Laporan"
                className="finance3-select"
                style={{ width: 'auto', padding: '6px 14px', fontSize: '13px', fontWeight: 600 }}
                value={datePreset}
                onChange={e => setDatePreset(e.target.value as any)}
              >
                <option value="bulan_ini">Bulan Ini</option>
                <option value="bulan_lalu">Bulan Lalu</option>
                <option value="triwulan">Triwulan Berjalan</option>
                <option value="tahun_ini">Tahun Ini</option>
                <option value="semua">Seluruh Riwayat Pembukuan</option>
                {operationalData.semesters.map(sem => <option key={sem.id} value={`semester:${sem.id}`}>{sem.name}</option>)}
              </select>
            </div>

            <Button
              shape="pill"
              size="sm"
              variant="secondary"
              onClick={handleExportXLSX}
              style={{ fontSize: '12.5px' }}
            >
              <Download size={14} /> Unduh Excel (.xlsx)
            </Button>
            <Button
              shape="pill"
              size="sm"
              variant="secondary"
              onClick={handleExportPDF}
              style={{ fontSize: '12.5px' }}
            >
              <Download size={14} /> Unduh PDF
            </Button>
          </div>
        </div>

        {/* 2. Ringkasan Posisi Kas (Statement Summary) */}
        <div className="finance3-hero-metrics" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="finance3-metric-pill"><span className="finance3-metric-label">Saldo Awal Periode</span><span className="finance3-metric-value">Rp {(Number(laporanResult.openingBalanceMinor) / 100).toLocaleString('id-ID')}</span></div>
          <div className="finance3-metric-pill"><span className="finance3-metric-label">Saldo Akhir Periode</span><span className="finance3-metric-value">Rp {(Number(laporanResult.closingBalanceMinor) / 100).toLocaleString('id-ID')}</span></div>
          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Arus Kas Bersih Periode</span>
            <span className="finance3-metric-value">Rp {surplusDefisit.toLocaleString('id-ID')}</span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Pemasukan Periode</span>
            <span className="finance3-metric-value income">+ Rp {totalMasuk.toLocaleString('id-ID')}</span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Pengeluaran Periode</span>
            <span className="finance3-metric-value expense">- Rp {totalKeluar.toLocaleString('id-ID')}</span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Saldo Kantong Saat Ini</span>
            <span className="finance3-metric-value net">Rp {saldoAkhir.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* 3. Rekap Per Kantong Keuangan & Rekap Per Semester */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Rekap Per Kantong */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h3 className="finance3-card-title">
              <Wallet size={17} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Rekapitulasi Per Kantong Keuangan
            </h3>
          </div>
          <div className="finance3-table-wrapper">
            <table className="finance3-table">
              <thead>
                <tr>
                  <th>Kantong</th>
                  <th style={{ textAlign: 'right' }}>Masuk</th>
                  <th style={{ textAlign: 'right' }}>Keluar</th>
                  <th style={{ textAlign: 'right' }}>Saldo Saat Ini</th>
                </tr>
              </thead>
              <tbody>
                {laporanResult.pocketBalances.map(({ pocket: p }) => {
                  const balRp = (Number(p.balanceMinor) || 0) / 100;
                  let inMinor = 0n;
                  let outMinor = 0n;
                  for (const tx of laporanResult.filteredTransactions) {
                    if (tx.status === 'reversed') continue;
                    for (const a of tx.allocations || []) {
                      if (a.pocketId === p.id) {
                        if (a.direction === 'in') inMinor += BigInt(a.amountMinor || '0');
                        else outMinor += BigInt(a.amountMinor || '0');
                      }
                    }
                  }
                  const inRp = Number(inMinor) / 100;
                  const outRp = Number(outMinor) / 100;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{p.name}</td>
                      <td style={{ textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        + Rp {inRp.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        - Rp {outRp.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--ink, #0b2a4a)', fontVariantNumeric: 'tabular-nums' }}>
                        Rp {balRp.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rekap Per Semester */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h3 className="finance3-card-title">
              <Users size={17} style={{ color: '#059669' }} /> Rekapitulasi Per Semester
            </h3>
          </div>
          <div className="finance3-table-wrapper">
            <table className="finance3-table">
              <thead>
                <tr>
                  <th>Periode Semester</th>
                  <th style={{ textAlign: 'center' }}>Iuran Lunas</th>
                  <th style={{ textAlign: 'right' }}>Pemasukan</th>
                  <th style={{ textAlign: 'right' }}>Pengeluaran</th>
                </tr>
              </thead>
              <tbody>
                {semesterRecapRows.length === 0 && <tr><td colSpan={4}>Belum ada data semester.</td></tr>}
                {semesterRecapRows.map(sem => (
                  <tr key={sem.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{sem.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)' }}>
                        {sem.startDate} s.d. {sem.endDate}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#0b5fbf' }}>
                      {sem.kasKruCount}x
                    </td>
                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      + Rp {sem.inc.toLocaleString('id-ID')}
                    </td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      - Rp {sem.exp.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Distribusi Pos Pengeluaran & Pemasukan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Pos Pengeluaran */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h3 className="finance3-card-title">
              <PieChart size={17} style={{ color: '#dc2626' }} /> Pos Pengeluaran Periode Ini
            </h3>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#dc2626' }}>
              Total: Rp {totalKeluar.toLocaleString('id-ID')}
            </span>
          </div>

          {expenseBreakdown.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted, #6e8cae)', fontSize: '13px' }}>
              Tidak ada pengeluaran pada periode ini.
            </div>
          ) : (
            <div className="finance3-table-wrapper">
              <table className="finance3-table">
                <thead>
                  <tr>
                    <th>Kategori Biaya</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Transaksi</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Nominal</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseBreakdown.map(item => {
                    const amt = (Number(item.amountMinor) || 0) / 100;
                    return (
                      <tr key={item.categoryId}>
                        <td style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{item.categoryName}</td>
                        <td style={{ textAlign: 'center', color: 'var(--muted, #6e8cae)' }}>{item.count}x</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                          Rp {amt.toLocaleString('id-ID')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>
                          {item.percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pos Pemasukan */}
        <div className="finance3-card">
          <div className="finance3-card-header">
            <h3 className="finance3-card-title">
              <PieChart size={17} style={{ color: '#059669' }} /> Pos Pemasukan Periode Ini
            </h3>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#059669' }}>
              Total: Rp {totalMasuk.toLocaleString('id-ID')}
            </span>
          </div>

          {incomeBreakdown.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted, #6e8cae)', fontSize: '13px' }}>
              Tidak ada pemasukan pada periode ini.
            </div>
          ) : (
            <div className="finance3-table-wrapper">
              <table className="finance3-table">
                <thead>
                  <tr>
                    <th>Sumber Pemasukan</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Transaksi</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Nominal</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeBreakdown.map(item => {
                    const amt = (Number(item.amountMinor) || 0) / 100;
                    return (
                      <tr key={item.categoryId}>
                        <td style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{item.categoryName}</td>
                        <td style={{ textAlign: 'center', color: 'var(--muted, #6e8cae)' }}>{item.count}x</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                          Rp {amt.toLocaleString('id-ID')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>
                          {item.percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
