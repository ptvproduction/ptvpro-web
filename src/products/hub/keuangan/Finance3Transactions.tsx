import { useState, useMemo } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import { cleanTransactionTitle, isMigratedTransaction, isTestTransaction, TEST_POCKET_IDS, type CanonicalTransaction } from './financeCanonical';

interface Finance3TransactionsProps {
  data: FinanceSnapshot;
  onOpenCatat: (type: 'income' | 'expense' | 'transfer') => void;
  onSelectTransaction: (tx: CanonicalTransaction) => void;
}

export function Finance3Transactions({
  data,
  onOpenCatat,
  onSelectTransaction,
}: Finance3TransactionsProps) {
  const transactions = useMemo(
    () => (data.canonical.state === 'available' ? data.canonical.transactions || [] : []).filter(t => !isTestTransaction(t)),
    [data.canonical]
  );
  const categories = data.canonical.state === 'available' ? data.canonical.categories || [] : [];
  const pockets = (data.canonical.state === 'available' ? data.canonical.pockets || [] : []).filter(
    p => !TEST_POCKET_IDS.has(p.id)
  );

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense' | 'transfer' | 'reversed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pocketFilter, setPocketFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Kind & Status Filter
      if (kindFilter === 'income' && (tx.kind !== 'income' || tx.status === 'reversed')) return false;
      if (kindFilter === 'expense' && (tx.kind !== 'expense' || tx.status === 'reversed')) return false;
      if (kindFilter === 'transfer' && (tx.kind !== 'transfer' || tx.status === 'reversed')) return false;
      if (kindFilter === 'reversed' && tx.status !== 'reversed') return false;

      // Category Filter
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;

      // Pocket Filter
      if (pocketFilter !== 'all' && !tx.allocations?.some(a => a.pocketId === pocketFilter)) return false;

      // Period Filter
      if (periodFilter === 'this_month') {
        if (!tx.occurredOn?.startsWith('2026-10')) return false;
      } else if (periodFilter === 'last_month') {
        if (!tx.occurredOn?.startsWith('2026-09')) return false;
      } else if (periodFilter === 'this_year') {
        if (!tx.occurredOn?.startsWith('2026')) return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const desc = (tx.description || '').toLowerCase();
        const date = (tx.occurredOn || '').toLowerCase();
        const amt = String((Number(tx.amountMinor) || 0) / 100);
        if (!desc.includes(q) && !date.includes(q) && !amt.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, search, kindFilter, categoryFilter, pocketFilter, periodFilter]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c.name]));
  }, [categories]);

  const pocketMap = useMemo(() => {
    return new Map(pockets.map(p => [p.id, p.name]));
  }, [pockets]);

  return (
    <div className="finance3-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header */}
      <div className="finance3-card-header" style={{ marginBottom: '8px' }}>
        <div>
          <h2 className="finance3-card-title">
            <ArrowUpDown size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Buku Riwayat Transaksi
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #6e8cae)' }}>
            Menampilkan {filteredTransactions.length} dari {transactions.length} total transaksi tercatat.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            shape="pill"
            variant="primary"
            onClick={() => onOpenCatat('income')}
            style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
          >
            <ArrowDownLeft size={14} /> + Pemasukan
          </Button>
          <Button
            size="sm"
            shape="pill"
            variant="primary"
            onClick={() => onOpenCatat('expense')}
            style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
          >
            <ArrowUpRight size={14} /> - Pengeluaran
          </Button>
          <Button
            size="sm"
            shape="pill"
            variant="secondary"
            onClick={() => onOpenCatat('transfer')}
          >
            <ArrowLeftRight size={14} /> ⇄ Transfer Kantong
          </Button>
        </div>
      </div>

      {/* Toolbar: Search, Chips & Dropdowns */}
      <div className="finance3-toolbar">
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted, #6e8cae)',
            }}
          />
          <input
            type="text"
            className="finance3-search-input"
            placeholder="Cari transaksi, nominal, keperluan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Kind Filters */}
        <div className="finance3-filter-group">
          <button
            type="button"
            className={`finance3-filter-chip ${kindFilter === 'all' ? 'active' : ''}`}
            onClick={() => setKindFilter('all')}
          >
            Semua
          </button>
          <button
            type="button"
            className={`finance3-filter-chip ${kindFilter === 'income' ? 'active' : ''}`}
            onClick={() => setKindFilter('income')}
          >
            Pemasukan (+)
          </button>
          <button
            type="button"
            className={`finance3-filter-chip ${kindFilter === 'expense' ? 'active' : ''}`}
            onClick={() => setKindFilter('expense')}
          >
            Pengeluaran (-)
          </button>
          <button
            type="button"
            className={`finance3-filter-chip ${kindFilter === 'transfer' ? 'active' : ''}`}
            onClick={() => setKindFilter('transfer')}
          >
            Transfer (⇄)
          </button>
          <button
            type="button"
            className={`finance3-filter-chip ${kindFilter === 'reversed' ? 'active' : ''}`}
            onClick={() => setKindFilter('reversed')}
          >
            Dibatalkan (Void)
          </button>
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select
            aria-label="Filter Kantong"
            className="finance3-select"
            style={{ minWidth: '140px', padding: '8px 12px', fontSize: '13px' }}
            value={pocketFilter}
            onChange={e => setPocketFilter(e.target.value)}
          >
            <option value="all">Semua Kantong</option>
            {pockets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Kategori"
            className="finance3-select"
            style={{ minWidth: '140px', padding: '8px 12px', fontSize: '13px' }}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Waktu"
            className="finance3-select"
            style={{ minWidth: '130px', padding: '8px 12px', fontSize: '13px' }}
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value)}
          >
            <option value="all">Semua Waktu</option>
            <option value="this_month">Bulan Ini (Okt)</option>
            <option value="last_month">Bulan Lalu (Sep)</option>
            <option value="this_year">Tahun 2026</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="finance3-table-wrapper">
        <table className="finance3-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Tanggal</th>
              <th>Deskripsi & Sumber</th>
              <th style={{ width: '150px' }}>Kantong Kas</th>
              <th style={{ width: '150px' }}>Kategori</th>
              <th style={{ width: '140px', textAlign: 'right' }}>Nominal</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '36px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted, #6e8cae)' }}>
                  Tidak ada transaksi yang sesuai dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filteredTransactions.map(tx => {
                const isInc = tx.kind === 'income';
                const isTrf = tx.kind === 'transfer';
                const isRev = tx.status === 'reversed';
                const amt = (Number(tx.amountMinor) || 0) / 100;
                const isLegacy = isMigratedTransaction(tx);
                const firstPocketId = tx.allocations?.[0]?.pocketId || '';
                const pocketLabel = pocketMap.get(firstPocketId) || 'Kas Utama Studio';

                return (
                  <tr key={tx.id} className="clickable" onClick={() => onSelectTransaction(tx)}>
                    <td style={{ color: 'var(--muted, #6e8cae)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {tx.occurredOn}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{cleanTransactionTitle(tx.description)}</span>
                        {isLegacy && (
                          <span className="finance3-badge legacy" title="Data operasional Dasbor PTV terekonsiliasi">
                            Migrasi
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--ink-2, #38587a)', fontSize: '12.5px', fontWeight: 600 }}>
                      {pocketLabel}
                    </td>
                    <td style={{ color: 'var(--ink-2, #38587a)', fontSize: '13px' }}>
                      {isTrf ? 'Transfer Kantong' : categoryMap.get(tx.categoryId || '') || (isInc ? 'Pemasukan Kas' : 'Pengeluaran Kas')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`finance3-tx-amount ${isRev ? 'reversed' : isInc ? 'income' : 'expense'}`}>
                        {isTrf ? '⇄ ' : isInc ? '+ ' : '- '}Rp {amt.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`finance3-badge ${isRev ? 'reversed' : 'posted'}`}>
                        {isRev ? 'Void' : 'Posted'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted, #6e8cae)', textAlign: 'right' }}>
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
