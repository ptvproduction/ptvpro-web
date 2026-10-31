import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet,
  QrCode,
  ArrowLeftRight,
  Plus,
  Edit3,
  Archive,
  Copy,
  Check,
  Maximize2,
  Download,
  Banknote,
  ArrowDownLeft,
  AlertCircle,
  Loader2,
  ShieldCheck,
  X,
  Search,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowUp,
  ArrowRight,
  CreditCard,
  FileText,
  ChevronRight,
  SlidersHorizontal,
  Link2,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import {
  officialQrisPath,
  cleanTransactionTitle,
  isMigratedTransaction,
  isTestTransaction,
  TEST_POCKET_IDS,
  type FinancePocket,
  type CanonicalTransaction,
  type PocketForm,
} from './financeCanonical';
import {
  submitPocketCreate,
  submitPocketUpdate,
  submitPocketArchive,
} from './financeCanonicalService';
import { attachQrisToPocket } from './financeSettingsService';

export type PocketThemeId =
  | 'ivory'
  | 'obsidian'
  | 'cerulean'
  | 'lavender'
  | 'sky'
  | 'emerald';

export interface PocketThemeOption {
  id: PocketThemeId;
  label: string;
  swatch: string;
}

export const POCKET_THEME_OPTIONS: PocketThemeOption[] = [
  { id: 'ivory', label: 'Ivory Utama', swatch: '#f8f6ef' },
  { id: 'obsidian', label: 'Obsidian Bank', swatch: '#1c2026' },
  { id: 'cerulean', label: 'Cerulean Teal', swatch: '#00a8cc' },
  { id: 'lavender', label: 'Lavender Studio', swatch: '#dcd6f7' },
  { id: 'sky', label: 'Sky Operasional', swatch: '#d8eefe' },
  { id: 'emerald', label: 'Emerald Kas', swatch: '#d4f5e4' },
];

const POCKET_THEME_STORAGE_KEY = 'ptv_finance3_pocket_themes_v1';

function loadStoredPocketThemes(): Record<string, PocketThemeId> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(POCKET_THEME_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredPocketTheme(pocketId: string, theme: PocketThemeId) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const existing = loadStoredPocketThemes();
    existing[pocketId] = theme;
    window.localStorage.setItem(POCKET_THEME_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage quota errors
  }
}

export function resolvePocketTheme(
  pocket: FinancePocket,
  index: number,
  customThemes: Record<string, PocketThemeId>
): PocketThemeId {
  if (customThemes[pocket.id]) {
    return customThemes[pocket.id];
  }
  const lowerName = pocket.name.toLowerCase();
  if (pocket.kind === 'cash' || lowerName.includes('utama')) {
    return 'ivory';
  }
  if (pocket.kind === 'bank') {
    return index === 1 ? 'obsidian' : index % 2 === 0 ? 'cerulean' : 'lavender';
  }
  if (lowerName.includes('sangu') || lowerName.includes('produksi')) {
    return 'lavender';
  }
  if (pocket.kind === 'ewallet' || pocket.qris || lowerName.includes('tabungan') || lowerName.includes('qris')) {
    return 'cerulean';
  }
  const fallbackOrder: PocketThemeId[] = ['ivory', 'obsidian', 'cerulean', 'lavender', 'sky', 'emerald'];
  return fallbackOrder[index % fallbackOrder.length];
}

function formatIndonesianShortDate(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const months: Record<string, string> = {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'Mei',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Agu',
    '09': 'Sep',
    '10': 'Okt',
    '11': 'Nov',
    '12': 'Des',
  };
  return `${ parseInt(day, 10) || day } ${months[month] || month} ${year}`;
}

function getInitialsFromTitle(title: string): string {
  const cleaned = cleanTransactionTitle(title).replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'TX';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

interface Finance3PocketsProps {
  data: FinanceSnapshot;
  canManage: boolean;
  initialPocketId?: string;
  onOpenCatat: (
    type: 'income' | 'expense' | 'transfer',
    options?: {
      pocketId?: string;
      paymentMethod?: 'cash' | 'transfer' | 'qris';
      description?: string;
    }
  ) => void;
  onSelectTransaction: (tx: CanonicalTransaction) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export function Finance3Pockets({
  data,
  canManage,
  initialPocketId,
  onOpenCatat,
  onSelectTransaction,
  onOpenSettings,
  onRefresh,
}: Finance3PocketsProps) {
  const rawPockets = data.canonical.state === 'available' ? data.canonical.pockets || [] : [];
  const rawTransactions = data.canonical.state === 'available' ? data.canonical.transactions || [] : [];
  const categories = data.canonical.state === 'available' ? data.canonical.categories || [] : [];

  const [localPockets, setLocalPockets] = useState<FinancePocket[] | null>(null);
  const pockets = useMemo(
    () => (localPockets || rawPockets).filter(p => !TEST_POCKET_IDS.has(p.id)),
    [localPockets, rawPockets]
  );
  const transactions = useMemo(
    () => rawTransactions.filter(t => !isTestTransaction(t)),
    [rawTransactions]
  );

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Daftar Kantong vs Rincian Kantong state
  const [activePocketId, setActivePocketId] = useState<string | null>(initialPocketId || null);
  useEffect(() => {
    if (initialPocketId) {
      setActivePocketId(initialPocketId);
    }
  }, [initialPocketId]);

  // Daftar Kantong search, category filter & balance visibility
  const [pocketSearch, setPocketSearch] = useState('');
  const [pocketFilter, setPocketFilter] = useState<'all' | 'cash' | 'bank' | 'ewallet' | 'archived'>('all');
  const [hideBalances, setHideBalances] = useState(false);

  // Rincian Kantong transaction search & mutation filter
  const [detailSearch, setDetailSearch] = useState('');
  const [detailMutationFilter, setDetailMutationFilter] = useState<'all' | 'in' | 'out' | 'transfer' | 'reversed'>('all');
  const [showDetailFilterBar, setShowDetailFilterBar] = useState(false);

  // Custom theme state per pocket
  const [customThemes, setCustomThemes] = useState<Record<string, PocketThemeId>>(() =>
    loadStoredPocketThemes()
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomQrisPath, setZoomQrisPath] = useState<string | null>(null);

  // Pocket Create / Edit Modal
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<FinancePocket | null>(null);
  const [pocketName, setPocketName] = useState('');
  const [pocketKind, setPocketKind] = useState<'cash' | 'bank' | 'ewallet'>('bank');
  const [pocketProvider, setPocketProvider] = useState('');
  const [pocketAccNumber, setPocketAccNumber] = useState('');
  const [pocketAccHolder, setPocketAccHolder] = useState('');
  const [pocketThemeChoice, setPocketThemeChoice] = useState<PocketThemeId>('cerulean');
  const [pocketLoading, setPocketLoading] = useState(false);
  const [pocketError, setPocketError] = useState('');
  const [pocketNotice, setPocketNotice] = useState('');

  // QRIS Config Modal
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisTargetPocketId, setQrisTargetPocketId] = useState('');
  const [qrisMerchantName, setQrisMerchantName] = useState('PTVPRO Studio Pondok');
  const [qrisNmid, setQrisNmid] = useState('ID1024319901827');
  const [qrisAssetPath, setQrisAssetPath] = useState('/finance-assets/qris/ptv-official-qris.png');
  const [qrisError, setQrisError] = useState('');

  const activePockets = useMemo(() => pockets.filter(p => !p.archived), [pockets]);
  const archivedPockets = useMemo(() => pockets.filter(p => p.archived), [pockets]);

  // Filtered pockets for Daftar Kantong grid
  const filteredPockets = useMemo(() => {
    const q = pocketSearch.trim().toLowerCase();
    return pockets.filter(p => {
      if (pocketFilter === 'archived') {
        if (!p.archived) return false;
      } else {
        if (p.archived) return false;
        if (pocketFilter === 'cash' && p.kind !== 'cash') return false;
        if (pocketFilter === 'bank' && p.kind !== 'bank') return false;
        if (pocketFilter === 'ewallet' && p.kind !== 'ewallet' && !p.qris && !officialQrisPath(p)) return false;
      }

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.provider || '').toLowerCase().includes(q) ||
        (p.accountNumber || '').toLowerCase().includes(q) ||
        (p.accountHolder || '').toLowerCase().includes(q) ||
        p.kind.toLowerCase().includes(q)
      );
    });
  }, [pockets, pocketFilter, pocketSearch]);

  // Hitung total masuk & keluar per kantong dari ptv_finance_allocations
  const pocketStatsMap = useMemo(() => {
    const map = new Map<string, { inMinor: bigint; outMinor: bigint; txCount: number }>();
    for (const p of pockets) {
      map.set(p.id, { inMinor: 0n, outMinor: 0n, txCount: 0 });
    }
    for (const tx of transactions) {
      if (tx.status === 'reversed') continue;
      for (const alloc of tx.allocations || []) {
        const entry = map.get(alloc.pocketId) || { inMinor: 0n, outMinor: 0n, txCount: 0 };
        const amt = BigInt(alloc.amountMinor || '0');
        if (alloc.direction === 'in') {
          entry.inMinor += amt;
        } else {
          entry.outMinor += amt;
        }
        entry.txCount += 1;
        map.set(alloc.pocketId, entry);
      }
    }
    return map;
  }, [pockets, transactions]);

  const totalSaldoSeluruhKantong = useMemo(() => {
    return activePockets.reduce((sum, p) => sum + (Number(p.balanceMinor) || 0) / 100, 0);
  }, [activePockets]);

  const qrisPocket = useMemo(() => {
    return (
      activePockets.find(p => officialQrisPath(p)) ||
      activePockets.find(p => p.qris) ||
      activePockets.find(p => p.kind !== 'cash') ||
      activePockets[0] ||
      null
    );
  }, [activePockets]);

  const qrisVerifiedPath = qrisPocket
    ? officialQrisPath(qrisPocket) || qrisPocket.qris?.assetPath || null
    : null;

  // Currently opened pocket for Halaman Rincian Kantong
  const activePocket = useMemo(
    () => (activePocketId ? pockets.find(p => p.id === activePocketId) || null : null),
    [activePocketId, pockets]
  );

  const activePocketIndex = useMemo(
    () => (activePocket ? Math.max(0, pockets.findIndex(p => p.id === activePocket.id)) : 0),
    [activePocket, pockets]
  );

  // Riwayat mutasi khusus kantong yang sedang dibuka di Halaman Rincian Kantong
  const activePocketMutations = useMemo(() => {
    if (!activePocket) return [];
    const q = detailSearch.trim().toLowerCase();

    return transactions.filter(tx => {
      const alloc = (tx.allocations || []).find(a => a.pocketId === activePocket.id);
      if (!alloc) return false;

      if (detailMutationFilter === 'reversed') {
        if (tx.status !== 'reversed') return false;
      } else if (detailMutationFilter === 'transfer') {
        if (tx.kind !== 'transfer' || tx.status === 'reversed') return false;
      } else if (detailMutationFilter === 'in') {
        if (alloc.direction !== 'in' || tx.status === 'reversed') return false;
      } else if (detailMutationFilter === 'out') {
        if (alloc.direction !== 'out' || tx.status === 'reversed') return false;
      }

      if (!q) return true;
      const catName = tx.categoryId ? categoryNameMap.get(tx.categoryId) || '' : '';
      return (
        tx.description.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q) ||
        tx.occurredOn.toLowerCase().includes(q) ||
        (tx.auditReference || '').toLowerCase().includes(q)
      );
    });
  }, [activePocket, transactions, detailSearch, detailMutationFilter, categoryNameMap]);

  const handleCopyAccount = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openCreatePocketModal = () => {
    setEditingPocket(null);
    setPocketName('');
    setPocketKind('bank');
    setPocketProvider('');
    setPocketAccNumber('');
    setPocketAccHolder('');
    setPocketThemeChoice('cerulean');
    setPocketError('');
    setIsPocketModalOpen(true);
  };

  const openEditPocketModal = (pocket: FinancePocket) => {
    const idx = Math.max(0, pockets.findIndex(p => p.id === pocket.id));
    setEditingPocket(pocket);
    setPocketName(pocket.name);
    setPocketKind(pocket.kind);
    setPocketProvider(pocket.provider || '');
    setPocketAccNumber(pocket.accountNumber || '');
    setPocketAccHolder(pocket.accountHolder || '');
    setPocketThemeChoice(resolvePocketTheme(pocket, idx, customThemes));
    setPocketError('');
    setIsPocketModalOpen(true);
  };

  const handleSubmitPocket = async (e: React.FormEvent) => {
    e.preventDefault();
    setPocketError('');
    const form: PocketForm = {
      name: pocketName.trim(),
      kind: pocketKind,
      provider: pocketKind === 'cash' ? '' : pocketProvider.trim(),
      accountNumber: pocketKind === 'cash' ? '' : pocketAccNumber.trim(),
      accountHolder: pocketKind === 'cash' ? '' : pocketAccHolder.trim(),
    };

    try {
      setPocketLoading(true);
      if (editingPocket) {
        await submitPocketUpdate(editingPocket.id, form, editingPocket);
        saveStoredPocketTheme(editingPocket.id, pocketThemeChoice);
        setCustomThemes(prev => ({ ...prev, [editingPocket.id]: pocketThemeChoice }));
        setPocketNotice(`Kantong '${form.name}' berhasil diperbarui.`);
      } else {
        const created = await submitPocketCreate(form);
        if (created && typeof created === 'object' && 'id' in created && typeof created.id === 'string') {
          saveStoredPocketTheme(created.id, pocketThemeChoice);
          setCustomThemes(prev => ({ ...prev, [created.id as string]: pocketThemeChoice }));
        }
        setPocketNotice(`Kantong baru '${form.name}' berhasil ditambahkan.`);
      }
      setIsPocketModalOpen(false);
      onRefresh();
    } catch (err) {
      setPocketError(err instanceof Error ? err.message : 'Gagal menyimpan data kantong.');
    } finally {
      setPocketLoading(false);
    }
  };

  const handleArchivePocket = async (pocket: FinancePocket) => {
    try {
      setPocketError('');
      await submitPocketArchive(pocket);
      setPocketNotice(`Kantong '${pocket.name}' telah diarsipkan.`);
      if (activePocketId === pocket.id) {
        setActivePocketId(null);
      }
      onRefresh();
    } catch (err) {
      setPocketNotice('');
      setPocketError(err instanceof Error ? err.message : 'Gagal mengarsipkan kantong.');
    }
  };

  const openConfigureQrisModal = (preferredPocketId?: string) => {
    const defaultTarget =
      (preferredPocketId && activePockets.find(p => p.id === preferredPocketId)) ||
      activePockets.find(p => p.kind !== 'cash') ||
      activePockets[0];
    setQrisTargetPocketId(defaultTarget?.id || '');
    setQrisMerchantName(qrisPocket?.qris?.merchantName || 'PTVPRO Studio Pondok');
    setQrisNmid(qrisPocket?.qris?.nmid || 'ID1024319901827');
    setQrisAssetPath(qrisPocket?.qris?.assetPath || '/finance-assets/qris/ptv-official-qris.png');
    setQrisError('');
    setIsQrisModalOpen(true);
  };

  const handleSaveQris = (e: React.FormEvent) => {
    e.preventDefault();
    setQrisError('');
    try {
      const updated = attachQrisToPocket(
        {
          pocketId: qrisTargetPocketId,
          merchantName: qrisMerchantName,
          nmid: qrisNmid,
          assetPath: qrisAssetPath,
          verifiedAt: new Date().toISOString(),
        },
        pockets
      );
      setLocalPockets(updated);
      setIsQrisModalOpen(false);
      setPocketNotice('Konfigurasi QRIS resmi studio berhasil diperbarui.');
    } catch (err) {
      setQrisError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi QRIS.');
    }
  };

  const formatBalanceDisplay = (amountRp: number) => {
    if (hideBalances) return 'Rp •••••••';
    return `Rp${amountRp.toLocaleString('id-ID')}`;
  };

  return (
    <div className="f3-pockets-shell">
      {pocketNotice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--ptv-curve-md, 12px)',
            background: 'var(--ok-bg, #e1f5ee)',
            color: 'var(--ok, #0f7a5a)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span>✓ {pocketNotice}</span>
          <button
            type="button"
            onClick={() => setPocketNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pocketError && !isPocketModalOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: 'var(--ptv-curve-md, 12px)',
            background: 'var(--dang-bg, #fde8e6)',
            color: 'var(--dang, #b02b23)',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} />
          <span>{pocketError}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODE A: HALAMAN DAFTAR KANTONG (activePocket === null)
          ════════════════════════════════════════════════════════════════════ */}
      {!activePocket ? (
        <>
          {/* 1. Header Kantong */}
          <div className="f3-pockets-header">
            <div className="f3-pockets-title-group">
              <h2 className="f3-pockets-main-title">Kantong</h2>
              <p className="f3-pockets-subtitle">
                Kantong Keuangan & Alokasi Kas · Klik kartu kantong untuk membuka Rincian Kantong
              </p>
            </div>

            <div className="f3-pockets-header-actions">
              {canManage && (
                <button
                  type="button"
                  className="f3-icon-circle-btn"
                  title="Transfer Dana Antarkantong"
                  aria-label="Transfer Dana Antarkantong"
                  onClick={() => onOpenCatat('transfer')}
                >
                  <ArrowLeftRight size={18} />
                </button>
              )}
              <button
                type="button"
                className="f3-icon-circle-btn"
                title="Lihat QRIS Resmi Studio"
                aria-label="Lihat QRIS Resmi Studio"
                onClick={() =>
                  setZoomQrisPath(
                    qrisPocket?.qris?.assetPath || '/finance-assets/qris/ptv-official-qris.png'
                  )
                }
              >
                <QrCode size={18} />
              </button>
              {canManage && (
                <button
                  type="button"
                  className="f3-icon-circle-btn"
                  title="Pengaturan Keuangan & Kantong"
                  aria-label="Pengaturan Keuangan & Kantong"
                  onClick={onOpenSettings}
                >
                  <SlidersHorizontal size={18} />
                </button>
              )}
            </div>
          </div>

          {/* 2. Kolom Pencarian Kantong */}
          <div className="f3-pocket-search-wrap">
            <Search size={18} className="f3-pocket-search-icon" />
            <input
              type="text"
              className="f3-pocket-search-input"
              placeholder="Cari Kantong"
              aria-label="Cari Kantong"
              value={pocketSearch}
              onChange={e => setPocketSearch(e.target.value)}
            />
            {pocketSearch && (
              <button
                type="button"
                className="f3-pocket-search-clear"
                onClick={() => setPocketSearch('')}
                aria-label="Bersihkan pencarian kantong"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 3. Baris Filter Kategori/Status + Aksi Tambah Kantong */}
          <div className="f3-pocket-filter-row">
            <div className="f3-pocket-chips" role="tablist" aria-label="Filter Kategori Kantong">
              <button
                type="button"
                className={`f3-pocket-chip ${pocketFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPocketFilter('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`f3-pocket-chip ${pocketFilter === 'cash' ? 'active' : ''}`}
                onClick={() => setPocketFilter('cash')}
              >
                Kantong Utama
              </button>
              <button
                type="button"
                className={`f3-pocket-chip ${pocketFilter === 'bank' ? 'active' : ''}`}
                onClick={() => setPocketFilter('bank')}
              >
                Rekening Bank
              </button>
              <button
                type="button"
                className={`f3-pocket-chip ${pocketFilter === 'ewallet' ? 'active' : ''}`}
                onClick={() => setPocketFilter('ewallet')}
              >
                QRIS & Digital
              </button>
              {archivedPockets.length > 0 && (
                <button
                  type="button"
                  className={`f3-pocket-chip ${pocketFilter === 'archived' ? 'active' : ''}`}
                  onClick={() => setPocketFilter('archived')}
                >
                  Arsip ({archivedPockets.length})
                </button>
              )}
            </div>

            {canManage && (
              <button
                type="button"
                className="f3-pocket-add-trigger"
                onClick={openCreatePocketModal}
                title="Tambah Kantong Baru"
                aria-label="Tambah Kantong Baru"
              >
                <Plus size={18} />
                <span>Kantong</span>
              </button>
            )}
          </div>

          {/* 4. Ringkasan Total Saldo Seluruh Kantong ("Aset Studio") */}
          <div className="f3-pocket-asset-bar">
            <div className="f3-pocket-asset-left">
              <span>Total Saldo Kantong</span>
              <span
                className="f3-pocket-asset-info-dot"
                title="Akumulasi saldo seluruh kantong operasional aktif dari ledger canonical PTV"
              >
                i
              </span>
            </div>

            <div className="f3-pocket-asset-right">
              <span className="f3-pocket-asset-amount">
                {hideBalances
                  ? 'Rp •••••••'
                  : `Rp ${totalSaldoSeluruhKantong.toLocaleString('id-ID')}`}
              </span>
              <button
                type="button"
                className="f3-pocket-eye-btn"
                onClick={() => setHideBalances(v => !v)}
                aria-label={hideBalances ? 'Tampilkan nominal saldo' : 'Sembunyikan nominal saldo'}
                title={hideBalances ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              >
                {hideBalances ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 5. Grid Kartu Kantong Berwarna */}
          {filteredPockets.length === 0 ? (
            <div
              className="finance3-card"
              style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted, #6e8cae)' }}
            >
              <Wallet size={28} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink, #0b2a4a)' }}>
                Kantong tidak ditemukan
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                Tidak ada kantong yang cocok dengan kata kunci atau filter yang dipilih.
              </div>
            </div>
          ) : (
            <div className="f3-pocket-grid">
              {filteredPockets.map((pocket) => {
                const globalIndex = Math.max(0, pockets.findIndex(p => p.id === pocket.id));
                const theme = resolvePocketTheme(pocket, globalIndex, customThemes);
                const bal = (Number(pocket.balanceMinor) || 0) / 100;
                const hasQris = !!(officialQrisPath(pocket) || pocket.qris);
                const subtitle =
                  pocket.kind === 'cash'
                    ? 'Kantong Utama · Kas Tunai'
                    : pocket.accountNumber
                    ? `${pocket.provider || 'Bank'} · ${pocket.accountNumber}`
                    : `${pocket.provider || 'Kantong Non-Tunai'}`;

                return (
                  <div
                    key={pocket.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buka Rincian Kantong ${pocket.name}`}
                    className={`f3-pocket-card theme-${theme}`}
                    onClick={() => {
                      setActivePocketId(pocket.id);
                      setDetailSearch('');
                      setDetailMutationFilter('all');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActivePocketId(pocket.id);
                      }
                    }}
                  >
                    <div className="f3-pocket-card-top">
                      <div className="f3-pocket-emblem">
                        {pocket.kind === 'cash' ? (
                          <Banknote size={24} />
                        ) : pocket.kind === 'bank' ? (
                          <CreditCard size={22} />
                        ) : (
                          <QrCode size={22} />
                        )}
                      </div>

                      {pocket.archived ? (
                        <span className="f3-pocket-card-tag">Arsip</span>
                      ) : hasQris ? (
                        <span className="f3-pocket-card-tag">QRIS</span>
                      ) : null}
                    </div>

                    <div className="f3-pocket-card-body">
                      <div className="f3-pocket-card-name" title={pocket.name}>
                        {pocket.name}
                      </div>
                      <div className="f3-pocket-card-balance">
                        {formatBalanceDisplay(bal)}
                      </div>
                      <div className="f3-pocket-card-meta" title={subtitle}>
                        {subtitle}
                      </div>
                    </div>

                    <FileText size={26} className="f3-pocket-card-watermark" />
                  </div>
                );
              })}
            </div>
          )}

          {/* 6. Panel QRIS & Metode Pembayaran Resmi Studio */}
          <div className="finance3-card">
            <div className="finance3-card-header">
              <div>
                <h3 className="finance3-card-title">
                  <QrCode size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> QRIS & Metode Pembayaran Resmi Studio
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #6e8cae)' }}>
                  Informasi pembayaran resmi untuk iuran kas kru, pelunasan piutang, dan penerimaan kas studio.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {canManage && (
                  <>
                    <Button
                      size="sm"
                      shape="pill"
                      variant="primary"
                      onClick={() => onOpenCatat('transfer')}
                      style={{ background: '#0b5fbf', borderColor: '#0b5fbf', color: '#ffffff' }}
                    >
                      <ArrowLeftRight size={14} /> Transfer Dana Antarkantong
                    </Button>
                    <Button
                      size="sm"
                      shape="pill"
                      variant="primary"
                      onClick={() =>
                        onOpenCatat('income', {
                          pocketId: qrisPocket?.id,
                          paymentMethod: 'qris',
                          description: 'Penerimaan Kas via QRIS',
                        })
                      }
                      style={{ background: '#059669', borderColor: '#059669', color: '#ffffff' }}
                    >
                      <ArrowDownLeft size={14} /> + Catat Penerimaan QRIS
                    </Button>
                    <Button size="sm" shape="pill" variant="secondary" onClick={() => openConfigureQrisModal()}>
                      <QrCode size={14} /> Konfigurasi QRIS
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'var(--surface-2, #f8fafd)',
                  border: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {qrisPocket?.qris ? (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1px solid rgba(11,42,74,0.12)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: '6px',
                        flexShrink: 0,
                      }}
                    >
                      <QrCode size={56} style={{ color: '#0b2a4a' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink, #0b2a4a)' }}>
                        {qrisPocket.qris.merchantName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)', marginTop: '2px' }}>
                        NMID: <code>{qrisPocket.qris.nmid}</code>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)', marginTop: '2px' }}>
                        Terhubung ke: <b>{qrisPocket.name}</b>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <Button
                          size="sm"
                          shape="pill"
                          variant="secondary"
                          onClick={() =>
                            setZoomQrisPath(
                              qrisPocket.qris?.assetPath || '/finance-assets/qris/ptv-official-qris.png'
                            )
                          }
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        >
                          <Maximize2 size={12} /> Perbesar QRIS
                        </Button>
                        <a
                          href={qrisPocket.qris.assetPath}
                          download="QRIS-PTV-Studio.png"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: '#edf4ff',
                            color: '#0b5fbf',
                            textDecoration: 'none',
                          }}
                        >
                          <Download size={12} /> Unduh QR
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: 'var(--muted, #6e8cae)', lineHeight: 1.5 }}>
                    Kode QRIS resmi dapat dihubungkan ke kantong bank atau e-wallet studio ({qrisVerifiedPath || 'siap dikonfigurasi'}).
                  </div>
                )}

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#edf4ff',
                    border: '1px solid #dcebff',
                    color: '#0b5fbf',
                    fontSize: '12px',
                    lineHeight: 1.45,
                  }}
                >
                  <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                  <b>Prinsip Konfirmasi Pembayaran:</b> Menampilkan QRIS tidak dianggap otomatis terkonfirmasi. Setiap pembayaran QRIS atau Transfer dicatat setelah dana diverifikasi masuk ke mutasi kantong.
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ════════════════════════════════════════════════════════════════════
           MODE B: HALAMAN RINCIAN KANTONG (activePocket !== null)
           Mengikuti struktur visual Rincian Kantong referensi:
           - Header Rincian Kantong + tombol Kembali
           - Identitas visual & Nomor rekening + salin
           - Nama kantong & Saldo besar sebagai fokus utama
           - 3 Aksi Cepat Bulat: Tambah Uang, Pindahkan Uang, Transfer & Bayar
           - Kartu akses QRIS & Rincian Alokasi
           - Sheet Riwayat Transaksi Kantong (Cari Transaksi, Filter, Daftar Mutasi)
           ════════════════════════════════════════════════════════════════════ */
        (() => {
          const detailTheme = resolvePocketTheme(activePocket, activePocketIndex, customThemes);
          const bal = (Number(activePocket.balanceMinor) || 0) / 100;
          const stats = pocketStatsMap.get(activePocket.id) || { inMinor: 0n, outMinor: 0n, txCount: 0 };
          const totalIn = Number(stats.inMinor) / 100;
          const totalOut = Number(stats.outMinor) / 100;
          const isZeroBalance = activePocket.balanceMinor !== null && /^0+$/.test(activePocket.balanceMinor);
          const accountLabel =
            activePocket.kind === 'cash'
              ? 'KAS TUNAI FISIK STUDIO'
              : `${activePocket.provider || 'BANK'} · ${activePocket.accountNumber || '-'}`;

          return (
            <div className="f3-pocket-detail-view">
              {/* Bagian Atas: Hero Berwarna Sesuai Kantong */}
              <div className={`f3-pocket-detail-hero theme-${detailTheme}`}>
                {/* Top Navigation Bar */}
                <div className="f3-pocket-detail-topbar">
                  <button
                    type="button"
                    className="f3-pocket-back-btn"
                    onClick={() => setActivePocketId(null)}
                    aria-label="Kembali ke daftar Kantong"
                  >
                    <ArrowLeft size={20} />
                    <span>Rincian Kantong</span>
                  </button>

                  <div className="f3-pocket-topbar-right">
                    {canManage && !activePocket.archived && (
                      <button
                        type="button"
                        className="f3-pocket-pill-cta"
                        onClick={() => openEditPocketModal(activePocket)}
                      >
                        <Edit3 size={13} />
                        <span>Kelola</span>
                      </button>
                    )}

                    {canManage && !activePocket.archived && isZeroBalance && (
                      <button
                        type="button"
                        className="f3-icon-circle-btn"
                        title="Arsipkan Kantong Bersaldo Nol"
                        aria-label="Arsipkan Kantong"
                        onClick={() => handleArchivePocket(activePocket)}
                      >
                        <Archive size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Identitas Visual Besar, Nomor Rekening & Saldo Fokus Utama */}
                <div className="f3-pocket-detail-identity">
                  <div className="f3-pocket-hero-emblem">
                    {activePocket.kind === 'cash' ? (
                      <Banknote size={28} />
                    ) : activePocket.kind === 'bank' ? (
                      <CreditCard size={28} />
                    ) : (
                      <QrCode size={28} />
                    )}
                  </div>

                  <button
                    type="button"
                    className="f3-pocket-account-pill"
                    onClick={() =>
                      handleCopyAccount(
                        activePocket.id,
                        activePocket.accountNumber || activePocket.name
                      )
                    }
                    title="Salin nomor rekening atau identitas kantong"
                  >
                    <span>{accountLabel}</span>
                    {copiedId === activePocket.id ? (
                      <>
                        <Check size={13} />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>

                  <h2 className="f3-pocket-detail-name">{activePocket.name}</h2>
                  <p className="f3-pocket-detail-balance">{formatBalanceDisplay(bal)}</p>
                </div>

                {/* 3 Aksi Cepat Berikon Bulat (Tambah Uang, Pindahkan Uang, Transfer & Bayar) */}
                <div className="f3-pocket-quick-actions" role="group" aria-label="Aksi Cepat Kantong">
                  <button
                    type="button"
                    className="f3-pocket-quick-item"
                    onClick={() =>
                      onOpenCatat('income', {
                        pocketId: activePocket.id,
                        paymentMethod: activePocket.kind === 'cash' ? 'cash' : 'transfer',
                      })
                    }
                  >
                    <span className="f3-pocket-quick-circle">
                      <Plus size={24} />
                    </span>
                    <span className="f3-pocket-quick-label">Tambah Uang</span>
                  </button>

                  <button
                    type="button"
                    className="f3-pocket-quick-item"
                    onClick={() =>
                      onOpenCatat('transfer', {
                        pocketId: activePocket.id,
                        paymentMethod: 'transfer',
                      })
                    }
                  >
                    <span className="f3-pocket-quick-circle">
                      <ArrowUp size={24} />
                    </span>
                    <span className="f3-pocket-quick-label">Pindahkan Uang</span>
                  </button>

                  <button
                    type="button"
                    className="f3-pocket-quick-item"
                    onClick={() =>
                      onOpenCatat('expense', {
                        pocketId: activePocket.id,
                        paymentMethod: activePocket.kind === 'cash' ? 'cash' : 'transfer',
                      })
                    }
                  >
                    <span className="f3-pocket-quick-circle">
                      <ArrowRight size={24} />
                    </span>
                    <span className="f3-pocket-quick-label">Transfer & Bayar</span>
                  </button>
                </div>

                {/* 2 Kartu Akses Cepat di Bawah Tombol Aksi */}
                <div className="f3-pocket-hero-cards">
                  {/* Card 1: QRIS Resmi / Kanal Pembayaran */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="f3-pocket-hero-card"
                    onClick={() => {
                      if (activePocket.qris || officialQrisPath(activePocket)) {
                        setZoomQrisPath(
                          activePocket.qris?.assetPath ||
                            officialQrisPath(activePocket) ||
                            '/finance-assets/qris/ptv-official-qris.png'
                        );
                      } else if (canManage) {
                        openConfigureQrisModal(activePocket.id);
                      } else {
                        setZoomQrisPath('/finance-assets/qris/ptv-official-qris.png');
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setZoomQrisPath('/finance-assets/qris/ptv-official-qris.png');
                      }
                    }}
                  >
                    <div className="f3-pocket-hero-card-left">
                      <div className="f3-pocket-hero-card-icon">
                        <QrCode size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>
                          {activePocket.qris
                            ? `QRIS Terhubung · ${activePocket.qris.merchantName}`
                            : 'Hubungkan atau Tampilkan QRIS Studio'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)' }}>
                          {activePocket.qris
                            ? `NMID: ${activePocket.qris.nmid} · Klik untuk perbesar kode QR`
                            : 'Gunakan QRIS resmi untuk penerimaan kas terverifikasi'}
                        </div>
                      </div>
                    </div>
                    <Link2 size={18} style={{ color: 'var(--muted, #6e8cae)', flexShrink: 0 }} />
                  </div>

                  {/* Card 2: Ringkasan Alokasi Masuk & Keluar Kantong */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="f3-pocket-hero-card"
                    onClick={() => {
                      if (canManage && !activePocket.archived) {
                        openEditPocketModal(activePocket);
                      }
                    }}
                  >
                    <div className="f3-pocket-hero-card-left">
                      <div
                        className="f3-pocket-hero-card-icon"
                        style={{ background: '#e0f2fe', color: '#0284c7' }}
                      >
                        <Wallet size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>
                          Ringkasan Alokasi · {stats.txCount} Mutasi Tercatat
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)' }}>
                          Masuk:{' '}
                          <b style={{ color: '#059669' }}>+Rp{totalIn.toLocaleString('id-ID')}</b> ·
                          Keluar:{' '}
                          <b style={{ color: '#dc2626' }}>-Rp{totalOut.toLocaleString('id-ID')}</b>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--muted, #6e8cae)', flexShrink: 0 }} />
                  </div>
                </div>
              </div>

              {/* Bagian Bawah: Sheet Putih Riwayat Transaksi Kantong */}
              <div className="f3-pocket-detail-sheet">
                {/* Baris Pencarian Transaksi & Tombol Filter */}
                <div className="f3-pocket-sheet-search-row">
                  <div className="f3-pocket-search-wrap">
                    <Search size={18} className="f3-pocket-search-icon" />
                    <input
                      type="text"
                      className="f3-pocket-search-input"
                      placeholder="Cari Transaksi"
                      aria-label="Cari Transaksi Kantong"
                      value={detailSearch}
                      onChange={e => setDetailSearch(e.target.value)}
                    />
                    {detailSearch && (
                      <button
                        type="button"
                        className="f3-pocket-search-clear"
                        onClick={() => setDetailSearch('')}
                        aria-label="Bersihkan pencarian transaksi"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="f3-icon-circle-btn"
                    onClick={() => setShowDetailFilterBar(v => !v)}
                    aria-label="Saring mutasi kantong"
                    title="Filter Mutasi"
                    style={
                      detailMutationFilter !== 'all' || showDetailFilterBar
                        ? { borderColor: '#0b5fbf', color: '#0b5fbf', background: '#edf4ff' }
                        : undefined
                    }
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>

                {/* Pill Filter Mutasi */}
                <div className="f3-pocket-chips" role="tablist" aria-label="Filter Jenis Mutasi Kantong">
                  <button
                    type="button"
                    className={`f3-pocket-chip ${detailMutationFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setDetailMutationFilter('all')}
                  >
                    Semua Mutasi
                  </button>
                  <button
                    type="button"
                    className={`f3-pocket-chip ${detailMutationFilter === 'in' ? 'active' : ''}`}
                    onClick={() => setDetailMutationFilter('in')}
                  >
                    Uang Masuk (+)
                  </button>
                  <button
                    type="button"
                    className={`f3-pocket-chip ${detailMutationFilter === 'out' ? 'active' : ''}`}
                    onClick={() => setDetailMutationFilter('out')}
                  >
                    Uang Keluar (-)
                  </button>
                  <button
                    type="button"
                    className={`f3-pocket-chip ${detailMutationFilter === 'transfer' ? 'active' : ''}`}
                    onClick={() => setDetailMutationFilter('transfer')}
                  >
                    Transfer Internal
                  </button>
                  <button
                    type="button"
                    className={`f3-pocket-chip ${detailMutationFilter === 'reversed' ? 'active' : ''}`}
                    onClick={() => setDetailMutationFilter('reversed')}
                  >
                    Void / Batal
                  </button>
                </div>

                {/* Header Seksi Waktu & Status */}
                <div className="f3-pocket-sheet-header">
                  <span className="f3-pocket-sheet-period">RIWAYAT TRANSAKSI KANTONG</span>
                  <span className="f3-pocket-sheet-updated">
                    Diperbarui Hari ini · {activePocketMutations.length} mutasi
                  </span>
                </div>

                {/* Daftar Riwayat Transaksi Berdasarkan Waktu */}
                {activePocketMutations.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: 'var(--muted, #6e8cae)',
                      fontSize: '13.5px',
                    }}
                  >
                    Belum ada transaksi pada kantong <b>{activePocket.name}</b> yang sesuai filter.
                  </div>
                ) : (
                  <div className="f3-pocket-tx-list">
                    {activePocketMutations.map(tx => {
                      const isRev = tx.status === 'reversed';
                      const alloc =
                        (tx.allocations || []).find(a => a.pocketId === activePocket.id) ||
                        (tx.allocations || [])[0];
                      const isIn = alloc ? alloc.direction === 'in' : tx.kind === 'income';
                      const amt = (Number(alloc?.amountMinor || tx.amountMinor) || 0) / 100;
                      const catLabel =
                        tx.kind === 'transfer'
                          ? 'Transfer Kantong'
                          : (tx.categoryId && categoryNameMap.get(tx.categoryId)) ||
                            (isIn ? 'Pemasukan Kas' : 'Pengeluaran Kas');
                      const cleanTitle = cleanTransactionTitle(tx.description);
                      const initials = getInitialsFromTitle(cleanTitle);
                      const isLegacy = isMigratedTransaction(tx);

                      return (
                        <div
                          key={`detail-mut-${tx.id}`}
                          role="button"
                          tabIndex={0}
                          className="f3-pocket-tx-item"
                          onClick={() => onSelectTransaction(tx)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectTransaction(tx);
                            }
                          }}
                        >
                          <div className="f3-pocket-tx-left">
                            <div
                              className={`f3-pocket-tx-avatar ${
                                isRev ? 'reversed' : isIn ? 'in' : 'out'
                              }`}
                            >
                              {tx.kind === 'transfer' ? (
                                <ArrowLeftRight size={18} />
                              ) : isIn ? (
                                <ArrowDownLeft size={18} />
                              ) : (
                                initials
                              )}
                            </div>

                            <div className="f3-pocket-tx-info">
                              <div className="f3-pocket-tx-title" title={cleanTitle}>
                                {cleanTitle}
                              </div>
                              <div className="f3-pocket-tx-sub">
                                <span>{formatIndonesianShortDate(tx.occurredOn)}</span>
                                {isLegacy && (
                                  <span className="finance3-badge legacy" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                    Migrasi
                                  </span>
                                )}
                                {isRev && (
                                  <span className="finance3-badge reversed" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                    Void
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="f3-pocket-tx-right">
                            <div
                              className={`f3-pocket-tx-nominal ${
                                isRev ? 'reversed' : isIn ? 'in' : 'out'
                              }`}
                            >
                              {isIn ? '+' : '-'}Rp{amt.toLocaleString('id-ID')}
                            </div>
                            <div className="f3-pocket-tx-cat">{catLabel}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Modal Tambah / Edit Kantong */}
      {isPocketModalOpen &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setIsPocketModalOpen(false)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="finance3-modal-header">
                <h3>{editingPocket ? `Edit Kantong: ${editingPocket.name}` : 'Tambah Kantong Keuangan Baru'}</h3>
                <button
                  type="button"
                  onClick={() => setIsPocketModalOpen(false)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitPocket}>
                <div className="finance3-modal-body">
                  {pocketError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--ptv-curve-md, 12px)',
                        background: 'var(--dang-bg, #fde8e6)',
                        color: 'var(--dang, #b02b23)',
                        fontSize: '13px',
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{pocketError}</span>
                    </div>
                  )}

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Nama Kantong Keuangan *</label>
                    <input
                      type="text"
                      className="finance3-input"
                      placeholder="Contoh: Rekening BSI Operasional, Kas Cadangan..."
                      value={pocketName}
                      onChange={e => setPocketName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Jenis Kantong *</label>
                    <select
                      className="finance3-select"
                      value={pocketKind}
                      onChange={e => setPocketKind(e.target.value as 'cash' | 'bank' | 'ewallet')}
                    >
                      <option value="cash">Kas Tunai Fisik (Cash)</option>
                      <option value="bank">Rekening Bank</option>
                      <option value="ewallet">Dompet Digital (E-Wallet / QRIS)</option>
                    </select>
                  </div>

                  {pocketKind !== 'cash' && (
                    <>
                      <div className="finance3-form-field">
                        <label className="finance3-form-label">Nama Bank / Penyedia Layanan *</label>
                        <input
                          type="text"
                          className="finance3-input"
                          placeholder="Contoh: BSI, Bank Mandiri, GoPay..."
                          value={pocketProvider}
                          onChange={e => setPocketProvider(e.target.value)}
                          required
                        />
                      </div>

                      <div className="finance3-form-field">
                        <label className="finance3-form-label">Nomor Rekening / Nomor Akun *</label>
                        <input
                          type="text"
                          className="finance3-input"
                          placeholder="Contoh: 7192837465"
                          value={pocketAccNumber}
                          onChange={e => setPocketAccNumber(e.target.value)}
                          required
                        />
                      </div>

                      <div className="finance3-form-field">
                        <label className="finance3-form-label">Nama Pemilik Rekening (Atas Nama) *</label>
                        <input
                          type="text"
                          className="finance3-input"
                          placeholder="Contoh: PTV Studio Pondok"
                          value={pocketAccHolder}
                          onChange={e => setPocketAccHolder(e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* Pemilih Warna Kartu Kantong */}
                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Warna Identitas Kartu Kantong</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {POCKET_THEME_OPTIONS.map(opt => {
                        const selected = pocketThemeChoice === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPocketThemeChoice(opt.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: selected
                                ? '2px solid #0b5fbf'
                                : '1px solid var(--line, rgba(11, 42, 74, 0.14))',
                              background: selected ? '#edf4ff' : 'var(--surface, #ffffff)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: selected ? 700 : 500,
                              color: 'var(--ink, #0b2a4a)',
                            }}
                          >
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '999px',
                                background: opt.swatch,
                                border: '1px solid rgba(0,0,0,0.15)',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="finance3-modal-footer">
                  <Button type="button" variant="secondary" shape="pill" onClick={() => setIsPocketModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" shape="pill" disabled={pocketLoading}>
                    {pocketLoading ? <Loader2 size={15} className="animate-spin" /> : 'Simpan Kantong'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Konfigurasi QRIS */}
      {isQrisModalOpen &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setIsQrisModalOpen(false)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="finance3-modal-header">
                <h3>Konfigurasi QRIS Resmi Studio</h3>
                <button
                  type="button"
                  onClick={() => setIsQrisModalOpen(false)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveQris}>
                <div className="finance3-modal-body">
                  {qrisError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--ptv-curve-md, 12px)',
                        background: 'var(--dang-bg, #fde8e6)',
                        color: 'var(--dang, #b02b23)',
                        fontSize: '13px',
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{qrisError}</span>
                    </div>
                  )}

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Kantong Non-Tunai Tujuan QRIS *</label>
                    <select
                      className="finance3-select"
                      value={qrisTargetPocketId}
                      onChange={e => setQrisTargetPocketId(e.target.value)}
                      required
                    >
                      {activePockets.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.kind === 'cash' ? 'Tunai - Tidak didukung QRIS' : p.provider || p.kind})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Nama Merchant QRIS *</label>
                    <input
                      type="text"
                      className="finance3-input"
                      value={qrisMerchantName}
                      onChange={e => setQrisMerchantName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">NMID (National Merchant ID) *</label>
                    <input
                      type="text"
                      className="finance3-input"
                      value={qrisNmid}
                      onChange={e => setQrisNmid(e.target.value)}
                      required
                    />
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Path Aset QRIS Resmi *</label>
                    <input
                      type="text"
                      className="finance3-input"
                      value={qrisAssetPath}
                      onChange={e => setQrisAssetPath(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="finance3-modal-footer">
                  <Button type="button" variant="secondary" shape="pill" onClick={() => setIsQrisModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" shape="pill">
                    Simpan Konfigurasi QRIS
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Zoom QRIS */}
      {zoomQrisPath &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setZoomQrisPath(null)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="finance3-modal-header">
                <h3>QRIS Resmi Studio PTV</h3>
                <button
                  type="button"
                  onClick={() => setZoomQrisPath(null)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="finance3-modal-body" style={{ alignItems: 'center' }}>
                <div
                  style={{
                    width: '220px',
                    height: '220px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    border: '2px solid #0b2a4a',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto',
                  }}
                >
                  <QrCode size={156} style={{ color: '#0b2a4a' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink, #0b2a4a)' }}>
                  {qrisPocket?.qris?.merchantName || 'PTVPRO Studio'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)' }}>
                  NMID: {qrisPocket?.qris?.nmid}
                </div>
              </div>
              <div className="finance3-modal-footer">
                <Button type="button" variant="secondary" shape="pill" onClick={() => setZoomQrisPath(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
