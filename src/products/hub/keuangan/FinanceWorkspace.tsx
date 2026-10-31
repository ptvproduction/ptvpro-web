import { ZodError } from 'zod';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Building2,
  CreditCard,
  Banknote,
  Search,
  AlertCircle,
  ShieldCheck,
  Tag,
  SlidersHorizontal,
  RotateCcw,
  CalendarDays,
  PenSquare,
  Ban,
  Camera,
} from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { ContinuousModalSurface } from '@/design-system/components/ContinuousModalSurface';
import '@/styles/keuangan.css';
import { EditTransaksiModal } from './components/EditTransaksiModal';
import { BatalkanTransaksiModal } from './components/BatalkanTransaksiModal';
import { ImageLightboxModal } from '@shared/components/ImageLightboxModal';
import { fmtPeriodeBulan } from './keuanganStore';
import type { FinanceEntry, FinanceSnapshot } from './financeFoundation';
import {
  formatMinor,
  isTestTransaction,
  officialQrisPath,
  rupiahToMinor,
  type CanonicalCategory,
  type CanonicalTransaction,
  type FinancePocket,
  type PocketForm,
} from './financeCanonical';
import {
  prepareFinanceOperation,
  preparePocketChange,
  submitFinanceOperation,
  submitPocketArchive,
  submitPocketCreate,
  submitPocketUpdate,
  submitTransactionUpdate,
  submitTransactionVoid,
} from './financeCanonicalService';

export const locked = 'Penyimpanan hanya dapat dilakukan oleh pengguna dengan hak pengelolaan (Bendahara / Eksekutif / Root).';
export const kinds = { cash: 'Tunai', bank: 'Bank', ewallet: 'E-wallet' } as const;

export function FinanceDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dialogId = useMemo(() => `finance-dlg-${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`, [title]);
  useModalScrollLock({ isOpen: true, onClose, modalRef: ref, id: dialogId });
  return createPortal(
    <div
      className="finance-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <ContinuousModalSurface
        ref={ref}
        radius={28}
        maxWidth={760}
        contentPadding="0"
        clipContent={true}
        fillColor="var(--surface)"
        shadow={false}
        className="finance-dialog"
        ariaLabel={title}
      >
        <div className="finance-dialog-content finance-foundation">
          <header className="finance-heading">
            <h2>{title}</h2>
            <Button type="button" shape="pill" size="sm" variant="secondary" onClick={onClose}>Tutup</Button>
          </header>
          {children}
        </div>
      </ContinuousModalSurface>
    </div>,
    document.body
  );
}

function LockedSave({ label = 'Simpan' }: { label?: string }) {
  return (
    <footer className="finance-form-footer">
      <p>{locked}</p>
      <Button shape="pill" disabled title={locked}>{label}</Button>
    </footer>
  );
}

export function PocketFormView({
  pocket,
  canManage = false,
  onSuccess,
  onClose,
}: {
  pocket?: FinancePocket;
  canManage?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  const [form, setForm] = useState<PocketForm>(pocket || { name: '', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const field = (key: keyof PocketForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      preparePocketChange({ name: form.name, kind: form.kind, provider: form.provider, accountNumber: form.accountNumber, accountHolder: form.accountHolder }, pocket);
      if (!canManage) {
        setError('Rincian formulir sesuai. Penyimpanan hanya dapat dilakukan oleh pengelola.');
        return;
      }
      setSubmitting(true);
      if (pocket) {
        await submitPocketUpdate(pocket.id, form, pocket);
        setSuccessMsg('Perubahan Kantong berhasil disimpan.');
      } else {
        await submitPocketCreate(form);
        setSuccessMsg('Kantong baru berhasil ditambahkan.');
      }
      onSuccess?.();
      setTimeout(() => onClose?.(), 800);
    } catch (err: unknown) {
      setError(err instanceof ZodError ? err.issues[0].message : err instanceof Error ? err.message : 'Isian belum sesuai.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="finance-form" onSubmit={handleSubmit}>
      {!canManage && <p className="finance-notice">Formulir persiapan · {locked}</p>}
      <Input standard="r03" label="Nama Kantong" value={form.name} onChange={e => field('name', e.target.value)} required maxLength={80} />
      <label>
        Jenis Kantong
        <select value={form.kind} onChange={e => setForm(prev => ({ ...prev, kind: e.target.value as PocketForm['kind'], provider: '', accountNumber: '', accountHolder: '' }))}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {form.kind !== 'cash' && (
        <fieldset>
          <legend>Rekening & Akun</legend>
          <div className="finance-form-grid">
            <Input standard="r03" label={form.kind === 'bank' ? 'Nama bank' : 'Penyedia e-wallet'} value={form.provider} onChange={e => field('provider', e.target.value)} required />
            <Input standard="r03" label="Nomor rekening / akun" value={form.accountNumber} onChange={e => field('accountNumber', e.target.value)} required />
            <Input standard="r03" label="Atas nama" value={form.accountHolder} onChange={e => field('accountHolder', e.target.value)} required />
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend>QRIS resmi</legend>
        <p>Gunakan aset merchant yang diverifikasi pengelola. QRIS tidak dibuat dari nomor rekening.</p>
        <Button shape="pill" variant="secondary" disabled title="Menunggu penyimpanan aset dan verifikasi QRIS">Unggah QRIS resmi</Button>
      </fieldset>
      {error && <p role="status" className="finance-error">{error}</p>}
      {successMsg && <p role="status" className="finance-success">{successMsg}</p>}
      {canManage ? (
        <footer className="finance-form-footer">
          <Button shape="pill" variant="secondary" type="submit" disabled={submitting}>Periksa isian</Button>
          <Button shape="pill" variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan...' : pocket ? 'Simpan perubahan' : 'Simpan Kantong'}
          </Button>
        </footer>
      ) : (
        <>
          <Button shape="pill" variant="secondary" type="submit">Periksa isian</Button>
          <LockedSave label={pocket ? 'Simpan perubahan' : 'Simpan Kantong'} />
        </>
      )}
    </form>
  );
}

export function PocketWorkspace({ data, onSuccess }: { data: FinanceSnapshot; onSuccess?: () => void }) {
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState<'active' | 'archived' | 'all'>('active');
  const [selected, setSelected] = useState<FinancePocket | null>(null);
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const [archive, setArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const close = useCallback(() => {
    setSelected(null);
    setForm(null);
    setArchive(false);
    setArchiveError('');
  }, []);

  const handleArchiveSubmit = async () => {
    if (!selected) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await submitPocketArchive(selected);
      close();
      onSuccess?.();
    } catch (err: unknown) {
      setArchiveError(err instanceof Error ? err.message : 'Gagal mengarsipkan Kantong.');
    } finally {
      setArchiving(false);
    }
  };

  const pockets = data.canonical.state === 'available' ? data.canonical.pockets : null;
  const visible = (pockets || []).filter(p =>
    (statusTab === 'all' || p.archived === (statusTab === 'archived')) &&
    `${p.name} ${p.provider}`.toLowerCase().includes(query.toLowerCase())
  );

  const getPocketIcon = (kind: FinancePocket['kind']) => {
    switch (kind) {
      case 'bank': return <Building2 size={20} />;
      case 'ewallet': return <CreditCard size={20} />;
      case 'cash':
      default: return <Banknote size={20} />;
    }
  };

  const getPocketBadgeClass = (kind: FinancePocket['kind']) => {
    switch (kind) {
      case 'bank': return 'badge-bank';
      case 'ewallet': return 'badge-ewallet';
      case 'cash':
      default: return 'badge-cash';
    }
  };

  return (
    <div className="finance-workspace-wrap">
      {/* HEADER & TOOLBAR MODERN */}
      <div className="finance-section-header">
        <div className="section-title-wrap">
          <Wallet size={22} className="section-icon" />
          <div>
            <h2>Daftar Kantong Keuangan</h2>
            <p>Kelola rekening bank, kas tunai, dan e-wallet resmi studio</p>
          </div>
        </div>
        {data.canManage && (
          <Button shape="pill" variant="primary" onClick={() => setForm('new')}>
            <Plus size={16} /> Tambah Kantong
          </Button>
        )}
      </div>

      <div className="finance-modern-toolbar">
        <div className="toolbar-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama Kantong atau penyedia..."
            className="toolbar-search-input"
          />
        </div>

        <div className="toolbar-status-pills">
          <button
            type="button"
            className={`status-pill ${statusTab === 'active' ? 'active' : ''}`}
            onClick={() => setStatusTab('active')}
          >
            Aktif ({(pockets || []).filter(p => !p.archived).length})
          </button>
          <button
            type="button"
            className={`status-pill ${statusTab === 'archived' ? 'active' : ''}`}
            onClick={() => setStatusTab('archived')}
          >
            Diarsipkan ({(pockets || []).filter(p => p.archived).length})
          </button>
          <button
            type="button"
            className={`status-pill ${statusTab === 'all' ? 'active' : ''}`}
            onClick={() => setStatusTab('all')}
          >
            Semua ({(pockets || []).length})
          </button>
        </div>
      </div>

      {!pockets ? (
        <Card standard="r03">
          <div className="finance-empty">
            <div className="finance-empty-icon"><AlertCircle size={32} /></div>
            <h3>Kantong belum terhubung</h3>
            <p>Daftar dan saldo akan tersedia setelah integrasi disetujui. Tidak ada saldo perkiraan yang ditampilkan.</p>
          </div>
        </Card>
      ) : !visible.length ? (
        <Card standard="r03">
          <div className="finance-empty">
            <div className="finance-empty-icon"><Search size={32} /></div>
            <h3>Belum ada Kantong yang sesuai</h3>
            <p>Sesuaikan pencarian atau status filter Kantong di atas.</p>
          </div>
        </Card>
      ) : (
        <div className="finance-pocket-modern-grid">
          {visible.map(p => (
            <div key={p.id} className={`finance-pocket-card card-${p.archived ? 'archived' : p.kind}`}>
              {/* Header */}
              <div className="pocket-card-top">
                <div className="pocket-identity">
                  <span className={`pocket-type-badge ${p.archived ? 'badge-archived' : getPocketBadgeClass(p.kind)}`}>
                    {getPocketIcon(p.kind)} {p.archived ? 'Diarsipkan' : kinds[p.kind]}
                  </span>
                  <h3 className="pocket-name">{p.name}</h3>
                </div>
                <span className={`pocket-status-pill ${p.archived ? 'archived' : 'active'}`}>
                  {p.archived ? 'Arsip' : 'Aktif'}
                </span>
              </div>

              {/* Panel Saldo Terbuku Khusus */}
              <div className={`pocket-balance-panel panel-${p.archived ? 'archived' : p.kind}`}>
                <div className="pocket-balance-header">
                  <span className="pocket-balance-label">Saldo Terbuku</span>
                  {p.id === '60e8d033-2794-4219-a960-c56bedca0111' && (
                    <span className="pocket-reconstruction-tag" title="Saldo hasil rekonstruksi pembukuan historis">
                      Rekonstruksi
                    </span>
                  )}
                </div>
                <div className="pocket-balance-amount">{formatMinor(p.balanceMinor)}</div>
              </div>

              {/* Footer */}
              <div className="pocket-card-bottom">
                <span className="pocket-provider-text">
                  {p.kind === 'cash' ? 'Kas Tunai Studio' : `${p.provider} • ${p.accountNumber || '—'}`}
                </span>
                <div className="pocket-card-actions">
                  <button
                    type="button"
                    className="pocket-btn-action"
                    onClick={() => setSelected(p)}
                  >
                    Rincian
                  </button>
                  {data.canManage && !p.archived && (
                    <button
                      type="button"
                      className="pocket-btn-action edit"
                      onClick={() => {
                        setSelected(p);
                        setForm('edit');
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(form || selected) && (
        <FinanceDialog
          title={form ? (form === 'new' ? 'Tambah Kantong Baru' : 'Edit Kantong') : archive ? 'Arsipkan Kantong' : 'Detail Kantong'}
          onClose={close}
        >
          {form ? (
            <PocketFormView
              pocket={form === 'edit' ? selected || undefined : undefined}
              canManage={data.canManage}
              onSuccess={onSuccess}
              onClose={close}
            />
          ) : archive ? (
            <div className="finance-form">
              <p>
                Anda akan mengarsipkan Kantong <strong>{selected?.name}</strong>.
                Kantong yang diarsipkan tidak dapat digunakan untuk transaksi baru.
              </p>
              {selected?.balanceMinor !== '0' && selected?.balanceMinor !== null && (
                <div className="dialog-alert-box warning">
                  <AlertCircle size={18} />
                  <p>Hanya Kantong dengan saldo nol terverifikasi yang dapat diarsipkan.</p>
                </div>
              )}
              {archiveError && <p role="status" className="finance-error">{archiveError}</p>}
              <footer className="finance-form-footer">
                <Button shape="pill" variant="secondary" onClick={close}>Batal</Button>
                <Button
                  shape="pill"
                  variant="primary"
                  onClick={handleArchiveSubmit}
                  disabled={archiving || selected?.balanceMinor !== '0'}
                >
                  {archiving ? 'Mengarsipkan...' : 'Konfirmasi Arsip'}
                </Button>
              </footer>
            </div>
          ) : selected && (
            <div className="finance-dialog-detail">
              <div className="dialog-pocket-hero">
                <span className={`pocket-type-badge ${selected.archived ? 'badge-archived' : getPocketBadgeClass(selected.kind)}`}>
                  {getPocketIcon(selected.kind)} {kinds[selected.kind]}
                </span>
                <h2>{selected.name}</h2>
                <div className="dialog-hero-balance">{formatMinor(selected.balanceMinor)}</div>
              </div>

              <dl className="finance-detail-table">
                <div><dt>Jenis Kantong</dt><dd>{kinds[selected.kind]}</dd></div>
                <div><dt>Penyedia / Bank</dt><dd>{selected.provider || 'Kas Tunai Studio'}</dd></div>
                <div><dt>Nomor Rekening</dt><dd>{selected.accountNumber || '—'}</dd></div>
                <div><dt>Atas Nama</dt><dd>{selected.accountHolder || '—'}</dd></div>
                <div><dt>Status</dt><dd>{selected.archived ? 'Diarsipkan' : 'Aktif'}</dd></div>
                <div><dt>Versi Record</dt><dd>v{selected.version}</dd></div>
              </dl>

              {officialQrisPath(selected) ? (
                <figure className="finance-qris-wrap">
                  <img className="finance-qris" src={officialQrisPath(selected)!} alt={`QRIS resmi ${selected.qris!.merchantName}`} />
                  <figcaption>{selected.qris!.merchantName} · NMID {selected.qris!.nmid}</figcaption>
                </figure>
              ) : (
                <p className="finance-footnote">Belum ada QRIS resmi terverifikasi untuk Kantong ini.</p>
              )}

              {data.canManage && !selected.archived && (
                <div className="dialog-actions-row">
                  <Button shape="pill" variant="secondary" onClick={() => setForm('edit')}>
                    Edit Kantong
                  </Button>
                  <Button shape="pill" variant="ghost" onClick={() => setArchive(true)}>
                    Arsipkan
                  </Button>
                </div>
              )}
            </div>
          )}
        </FinanceDialog>
      )}
    </div>
  );
}

type Line = { key: string; pocketId: string; rupiah: string };

export function TransactionForm({
  operation,
  pockets,
  categories,
  canManage = false,
  writesEnabled = true,
  onSuccess,
  onClose,
}: {
  operation: 'income' | 'expense' | 'transfer';
  pockets: FinancePocket[] | null;
  categories?: CanonicalCategory[];
  canManage?: boolean;
  writesEnabled?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [singleIncomingPocket, setSingleIncomingPocket] = useState('');
  const [singleOutgoingPocket, setSingleOutgoingPocket] = useState('');
  const [incoming, setIncoming] = useState<Line[]>([{ key: crypto.randomUUID(), pocketId: '', rupiah: '' }]);
  const [outgoing, setOutgoing] = useState<Line[]>([{ key: crypto.randomUUID(), pocketId: '', rupiah: '' }]);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableCategories = (categories || []).filter(c => c.kind === (operation === 'income' ? 'income' : 'expense'));

  const lines = (direction: 'incoming' | 'outgoing') => {
    const rows = direction === 'incoming' ? incoming : outgoing;
    const update = direction === 'incoming' ? setIncoming : setOutgoing;
    return (
      <fieldset>
        <legend>{direction === 'incoming' ? 'Kantong Tujuan (+ Masuk)' : 'Kantong Asal (- Keluar)'}</legend>
        {rows.map((line, index) => (
          <div key={line.key} className="finance-allocation">
            <div className="finance-field alloc-pocket-field">
              <label htmlFor={`${line.key}-pocket`} className="finance-field-label">
                Kantong {index + 1}
              </label>
              <select
                id={`${line.key}-pocket`}
                className="finance-select"
                value={line.pocketId}
                disabled={!pockets?.length}
                onChange={e => update(prev => prev.map(row => (row.key === line.key ? { ...row, pocketId: e.target.value } : row)))}
                required
              >
                <option value="">{pockets ? 'Pilih Kantong' : 'Kantong belum terhubung'}</option>
                {(pockets || []).filter(p => !p.archived).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({formatMinor(p.balanceMinor)})</option>
                ))}
              </select>
            </div>
            <div className="alloc-amount-field">
              <Input
                standard="r03"
                id={`${line.key}-amount`}
                label="Nominal Alokasi (Rp)"
                inputMode="decimal"
                value={line.rupiah}
                onChange={e => update(prev => prev.map(row => (row.key === line.key ? { ...row, rupiah: e.target.value } : row)))}
                required
              />
            </div>
            <Button
              shape="pill"
              size="sm"
              variant="ghost"
              type="button"
              className="alloc-delete-btn"
              aria-label={`Hapus alokasi ${index + 1}`}
              disabled={rows.length === 1}
              onClick={() => update(prev => prev.filter(row => row.key !== line.key))}
            >
              Hapus
            </Button>
          </div>
        ))}
        <div className="alloc-add-row">
          <Button
            shape="pill"
            size="sm"
            variant="secondary"
            type="button"
            disabled={rows.length >= 20}
            onClick={() => update(prev => [...prev, { key: crypto.randomUUID(), pocketId: '', rupiah: '' }])}
          >
            + Tambah Alokasi Kantong
          </Button>
        </div>
      </fieldset>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    try {
      if (!pockets) throw new Error('Saldo dan Kantong belum terhubung; alokasi belum dapat diverifikasi.');
      const amtMinor = rupiahToMinor(amount);
      const map = (rows: Line[]) => rows.map(line => ({ pocketId: line.pocketId, amountMinor: rupiahToMinor(line.rupiah) }));
      
      let incomingAllocations: { pocketId: string; amountMinor: string }[] = [];
      let outgoingAllocations: { pocketId: string; amountMinor: string }[] = [];

      if (!isSplit) {
        if (operation === 'income') {
          if (!singleIncomingPocket) throw new Error('Silakan pilih Kantong Tujuan Penerimaan.');
          incomingAllocations = [{ pocketId: singleIncomingPocket, amountMinor: amtMinor }];
        } else if (operation === 'expense') {
          if (!singleOutgoingPocket) throw new Error('Silakan pilih Kantong Asal Sumber Dana.');
          outgoingAllocations = [{ pocketId: singleOutgoingPocket, amountMinor: amtMinor }];
        } else if (operation === 'transfer') {
          if (!singleOutgoingPocket) throw new Error('Silakan pilih Kantong Asal Pengiriman.');
          if (!singleIncomingPocket) throw new Error('Silakan pilih Kantong Tujuan Penerima.');
          if (singleOutgoingPocket === singleIncomingPocket) throw new Error('Kantong asal dan tujuan transfer tidak boleh sama.');
          outgoingAllocations = [{ pocketId: singleOutgoingPocket, amountMinor: amtMinor }];
          incomingAllocations = [{ pocketId: singleIncomingPocket, amountMinor: amtMinor }];
        }
      } else {
        incomingAllocations = operation === 'expense' ? [] : map(incoming);
        outgoingAllocations = operation === 'income' ? [] : map(outgoing);
      }

      const commandPayload = {
        version: 2 as const,
        idempotencyKey: key,
        operation,
        currency: 'IDR' as const,
        occurredOn: date,
        description,
        amountMinor: amtMinor,
        ...(operation === 'transfer' ? {} : { categoryId: category }),
        incoming: incomingAllocations,
        outgoing: outgoingAllocations,
      };

      await prepareFinanceOperation(commandPayload, pockets);

      if (!canManage) {
        setMessage('Alokasi sesuai untuk ditinjau. Penyimpanan memerlukan hak pengelola.');
        return;
      }

      setSubmitting(true);
      await submitFinanceOperation(commandPayload, pockets);
      setMessage('Transaksi berhasil disimpan ke pembukuan Staging!');
      onSuccess?.();
      setTimeout(() => onClose?.(), 800);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Isian belum sesuai.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="finance-form" onSubmit={handleSubmit}>
      {!canManage && <p className="finance-notice">Formulir persiapan · {locked}</p>}
      <div className="finance-form-grid">
        <Input standard="r03" label="Tanggal transaksi" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <div>
          <Input standard="r03" label="Total nominal (Rp)" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required hint="Tanpa pemisah ribuan; desimal memakai koma." />
          <div className="finance-quick-amounts" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {['25000', '50000', '100000', '250000', '500000'].map(val => (
              <button
                key={val}
                type="button"
                className="finance-quick-chip"
                onClick={() => setAmount(val)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface-muted, rgba(0,0,0,0.03))',
                  cursor: 'pointer',
                  color: 'var(--ink)'
                }}
              >
                + Rp {(parseInt(val, 10)).toLocaleString('id-ID')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Input standard="r03" label="Keterangan transaksi" value={description} onChange={e => setDescription(e.target.value)} required maxLength={1000} />
      {operation !== 'transfer' && (
        <div className="finance-field">
          <label htmlFor="tx-category-select" className="finance-field-label">
            Kategori Transaksi
          </label>
          <select
            id="tx-category-select"
            className="finance-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
          >
            <option value="">{availableCategories.length ? 'Pilih Kategori Canonical' : 'Kategori belum tersedia'}</option>
            {availableCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {!isSplit ? (
        operation === 'transfer' ? (
          <div className="finance-transfer-visual-card" style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--ptv-curve-lg, 16px)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxSizing: 'border-box'
          }}>
            <div className="finance-field">
              <label htmlFor="single-out-pocket" className="finance-field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>1. Dari Kantong Asal (Sumber Dana)</span>
                {singleOutgoingPocket && (() => {
                  const p = pockets?.find(item => item.id === singleOutgoingPocket);
                  return p ? <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>Saldo: <strong>{formatMinor(p.balanceMinor)}</strong></span> : null;
                })()}
              </label>
              <select
                id="single-out-pocket"
                className="finance-select"
                value={singleOutgoingPocket}
                onChange={e => setSingleOutgoingPocket(e.target.value)}
                required
              >
                <option value="">Pilih Kantong Asal Pengiriman</option>
                {(pockets || []).filter(p => !p.archived).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({formatMinor(p.balanceMinor)})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--brand-600, #0c57b5)', padding: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--line-2)' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--brand-50, #f0f7ff)', padding: '3px 10px', borderRadius: '12px' }}>
                Transfer Internal PTVPRO
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line-2)' }} />
            </div>

            <div className="finance-field">
              <label htmlFor="single-in-pocket" className="finance-field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>2. Ke Kantong Tujuan (Penerima)</span>
                {singleIncomingPocket && (() => {
                  const p = pockets?.find(item => item.id === singleIncomingPocket);
                  return p ? <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>Saldo Saat Ini: <strong>{formatMinor(p.balanceMinor)}</strong></span> : null;
                })()}
              </label>
              <select
                id="single-in-pocket"
                className="finance-select"
                value={singleIncomingPocket}
                onChange={e => setSingleIncomingPocket(e.target.value)}
                required
              >
                <option value="">Pilih Kantong Penerima Transfer</option>
                {(pockets || []).filter(p => !p.archived && p.id !== singleOutgoingPocket).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({formatMinor(p.balanceMinor)})</option>
                ))}
              </select>
            </div>

            {singleOutgoingPocket && singleIncomingPocket && amount && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--ptv-curve-md, 12px)',
                padding: '10px 14px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)' }}>
                  <span>Pindah Dana:</span>
                  <strong>{formatMinor(rupiahToMinor(amount))}</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Total saldo pembukuan studio tetap utuh (zero drift). Mutasi dicatat berpasangan pada ledger resmi.
                </div>
              </div>
            )}
          </div>
        ) : (
          <fieldset className="finance-single-pocket-fieldset">
            <legend>Kantong Kas / Rekening</legend>
            {operation !== 'income' && (
              <div className="finance-field" style={{ marginBottom: 0 }}>
                <label htmlFor="single-out-pocket" className="finance-field-label">
                  Kantong Sumber Dana (Keluar)
                </label>
                <select
                  id="single-out-pocket"
                  className="finance-select"
                  value={singleOutgoingPocket}
                  onChange={e => setSingleOutgoingPocket(e.target.value)}
                  required
                >
                  <option value="">Pilih Kantong Kas / Bank</option>
                  {(pockets || []).filter(p => !p.archived).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatMinor(p.balanceMinor)})</option>
                  ))}
                </select>
              </div>
            )}
            {operation !== 'expense' && (
              <div className="finance-field">
                <label htmlFor="single-in-pocket" className="finance-field-label">
                  Kantong Tujuan Penerimaan (Masuk)
                </label>
                <select
                  id="single-in-pocket"
                  className="finance-select"
                  value={singleIncomingPocket}
                  onChange={e => setSingleIncomingPocket(e.target.value)}
                  required
                >
                  <option value="">Pilih Kantong Kas / Bank</option>
                  {(pockets || []).filter(p => !p.archived).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatMinor(p.balanceMinor)})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="finance-toggle-split-link"
                onClick={() => setIsSplit(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ptv-green)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'underline'
                }}
              >
                + Bagi alokasi ke beberapa kantong (split)
              </button>
            </div>
          </fieldset>
        )
      ) : (
        <div className="finance-split-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 650 }}>Mode Split Multi-Kantong Aktif</span>
            <button
              type="button"
              onClick={() => setIsSplit(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink2)',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ← Kembali ke 1 Kantong
            </button>
          </div>
          {operation !== 'income' && lines('outgoing')}
          {operation !== 'expense' && lines('incoming')}
        </div>
      )}
      <p className="finance-footnote">Alokasi multi-Kantong wajib seimbang dengan total nominal transaksi. Transfer internal tidak menambah atau mengurangi saldo buku utama.</p>
      {message && <p role="status" className="finance-success">{message}</p>}
      {errorMsg && <p role="status" className="finance-error">{errorMsg}</p>}
      <footer className="finance-form-footer">
        {canManage ? (
          <div className="finance-form-actions">
            {!writesEnabled && (
              <p className="finance-notice" style={{ color: '#d97706', fontSize: '12px', margin: '0 8px 0 0' }}>
                Mode pemeliharaan aktif: penyimpanan ditahan sementara.
              </p>
            )}
            <Button shape="pill" variant="secondary" type="submit" disabled={submitting}>
              Periksa Alokasi
            </Button>
            <Button shape="pill" variant="primary" type="submit" disabled={submitting || !writesEnabled} title={!writesEnabled ? 'Penyimpanan ditahan selama mode pemeliharaan (write-freeze).' : undefined}>
              {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </Button>
          </div>
        ) : (
          <div className="finance-form-actions">
            <Button shape="pill" variant="secondary" type="submit">
              Periksa Alokasi
            </Button>
            <LockedSave label="Simpan Transaksi" />
          </div>
        )}
      </footer>
    </form>
  );
}

function isAutomatedModuleTx(
  description: string,
  categoryId?: string,
  categories?: CanonicalCategory[],
  sourceReferences?: { kind: string; id: string }[]
): boolean {
  const catName = categories?.find(c => c.id === categoryId)?.name.toLowerCase().trim() || '';
  const desc = description.toLowerCase();
  if (['iuran kas kru', 'pencairan piutang', 'pengembalian pokok piutang', 'pendapatan bunga piutang'].includes(catName)) {
    return true;
  }
  if (sourceReferences && sourceReferences.some(s => s.kind.includes('kas') || s.kind.includes('piutang'))) {
    return true;
  }
  if (
    desc.startsWith('iuran kas') ||
    desc.startsWith('pencairan piutang') ||
    desc.startsWith('pengembalian pokok') ||
    desc.startsWith('pengembalian piutang') ||
    desc.startsWith('bunga piutang')
  ) {
    return true;
  }
  return false;
}

interface TxDisplayItem {
  id: string;
  isCanonical: boolean;
  date: string;
  description: string;
  categoryName: string;
  categoryId?: string;
  proofUrl?: string;
  amountMinor: string;
  amountNumber: number;
  kind: 'income' | 'expense' | 'transfer';
  status: 'posted' | 'reversed';
  notes?: string;
  recordedBy?: string;
  isAutomated: boolean;
  isTest: boolean;
  rawCanonical?: CanonicalTransaction;
  rawLegacy?: FinanceEntry;
}

export function TransactionWorkspace({
  data,
  initialKind,
  onSuccess,
}: {
  data: FinanceSnapshot;
  initialKind?: string | null;
  onSuccess?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'semua' | 'pemasukan' | 'pengeluaran' | 'transfer'>(
    initialKind === 'pemasukan' || initialKind === 'pengeluaran' ? initialKind : 'semua'
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pocketId, setPocketId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeTestTxs, setIncludeTestTxs] = useState(false);
  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  const [operation, setOperation] = useState<'income' | 'expense' | 'transfer' | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // New action modal states
  const [editingItem, setEditingItem] = useState<TxDisplayItem | null>(null);
  const [voidingItem, setVoidingItem] = useState<TxDisplayItem | null>(null);
  const [isVoidSubmitting, setIsVoidSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>('');
  const [automatedWarning, setAutomatedWarning] = useState<string | null>(null);

  const hasActiveFilters = Boolean(pocketId || categoryId || from || to || kind === 'transfer');

  const close = useCallback(() => {
    setSelectedCanonical(null);
    setOperation(null);
    setAutomatedWarning(null);
  }, []);

  const pockets = data.canonical.state === 'available' ? data.canonical.pockets : null;
  const transactions = data.canonical.state === 'available' ? data.canonical.transactions : null;
  const categories = data.canonical.state === 'available' ? data.canonical.categories : undefined;

  const selectedCategoryName = categories?.find(c => c.id === categoryId)?.name.toLowerCase().trim() || '';

  const filter = (label: string, date: string, value: string) => {
    const qNorm = query.trim().toLowerCase();
    const matchQ = !qNorm || label.toLowerCase().includes(qNorm);
    const matchFrom = !from || (date && date >= from);
    const matchTo = !to || (date && date <= to);
    const matchKind = kind === 'semua' ? true : kind === value;
    return matchQ && matchFrom && matchTo && matchKind;
  };

  const linkedSources = new Set(
    (transactions || []).flatMap(entry => (entry.sourceReferences || []).map(source => `${source.kind.replace(/^ptv_/, '')}-${source.id}`))
  );

  const legacy = data.entries.filter(e => {
    if (linkedSources.has(`${e.kind}-${e.id}`)) return false;
    if (pocketId) return false;
    const isLegacyTest = `${e.label} ${e.description || ''}`.toLowerCase().includes('uji coba');
    if (!includeTestTxs && isLegacyTest) return false;
    const matchTextAndDate = filter(`${e.label} ${e.description || ''}`, e.date || '', e.kind);
    const matchCategory = !categoryId || (selectedCategoryName && `${e.label} ${e.description || ''}`.toLowerCase().includes(selectedCategoryName));
    return matchTextAndDate && matchCategory;
  });

  const canonical = (transactions || []).filter(e => {
    const isTest = isTestTransaction(e);
    if (!includeTestTxs && isTest) return false;
    const matchText = filter(e.description, e.occurredOn, e.kind === 'income' ? 'pemasukan' : e.kind === 'expense' ? 'pengeluaran' : 'transfer');
    const matchPocket = !pocketId || e.allocations.some(a => a.pocketId === pocketId);
    const matchCategory = !categoryId || e.categoryId === categoryId || (selectedCategoryName && e.description.toLowerCase().includes(selectedCategoryName));
    return matchText && matchPocket && matchCategory;
  });

  const detail = transactions?.find(e => e.id === selectedCanonical);
  const testTxsCount = (transactions || []).filter(t => isTestTransaction(t)).length;

  const isFiltered = Boolean(query || kind !== 'semua' || pocketId || categoryId || from || to || includeTestTxs);
  const totalResults = canonical.length + legacy.length;

  const resetFilters = () => {
    setQuery('');
    setKind('semua');
    setFrom('');
    setTo('');
    setPocketId('');
    setCategoryId('');
    setIncludeTestTxs(false);
  };

  // Build unified items for monthly grouping table
  const allDisplayItems: TxDisplayItem[] = useMemo(() => {
    const items: TxDisplayItem[] = [];

    for (const c of canonical) {
      const cat = categories?.find(cat => cat.id === c.categoryId);
      const catName = cat?.name || (c.kind === 'transfer' ? 'Transfer Kantong' : 'Umum');
      const isAuto = isAutomatedModuleTx(c.description, c.categoryId, categories, c.sourceReferences);
      const isTest = isTestTransaction(c);
      const recBy = c.recordedBy || 'Bendahara';

      items.push({
        id: c.id,
        isCanonical: true,
        date: c.occurredOn,
        description: c.description,
        categoryName: catName,
        categoryId: c.categoryId,
        proofUrl: c.proofUrl,
        amountMinor: c.amountMinor,
        amountNumber: Number(BigInt(c.amountMinor)) / 100,
        kind: c.kind,
        status: c.status,
        notes: c.notes,
        recordedBy: recBy,
        isAutomated: isAuto,
        isTest,
        rawCanonical: c,
      });
    }

    for (const l of legacy) {
      const isAuto = l.label.toLowerCase().includes('iuran kas') || (l.description || '').toLowerCase().includes('iuran kas');
      items.push({
        id: `legacy-${l.kind}-${l.id}`,
        isCanonical: false,
        date: l.date || '',
        description: l.label,
        categoryName: l.kind === 'pemasukan' ? 'Pemasukan Sumber' : 'Pengeluaran Sumber',
        proofUrl: undefined,
        amountMinor: (Math.round(l.amount * 100)).toString(),
        amountNumber: l.amount,
        kind: l.kind === 'pemasukan' ? 'income' : 'expense',
        status: 'posted',
        notes: l.description,
        recordedBy: 'Buku Utama',
        isAutomated: isAuto,
        isTest: false,
        rawLegacy: l,
      });
    }

    // Sort descending by date
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return items;
  }, [canonical, legacy, categories]);

  // Group by month
  const monthGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        ym: string;
        label: string;
        items: TxDisplayItem[];
        totalExpenseMinor: bigint;
        totalIncomeMinor: bigint;
      }
    > = {};

    for (const item of allDisplayItems) {
      const ym = item.date && item.date.length >= 7 ? item.date.slice(0, 7) : 'Lainnya';
      if (!groups[ym]) {
        groups[ym] = {
          ym,
          label: ym === 'Lainnya' ? 'Tanpa Tanggal' : fmtPeriodeBulan(ym),
          items: [],
          totalExpenseMinor: 0n,
          totalIncomeMinor: 0n,
        };
      }
      groups[ym].items.push(item);
      if (item.status !== 'reversed') {
        if (item.kind === 'expense') {
          groups[ym].totalExpenseMinor += BigInt(item.amountMinor);
        } else if (item.kind === 'income') {
          groups[ym].totalIncomeMinor += BigInt(item.amountMinor);
        }
      }
    }

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(k => groups[k]);
  }, [allDisplayItems]);

  const handleActionEdit = (item: TxDisplayItem) => {
    if (item.isAutomated) {
      setAutomatedWarning(
        `Transaksi "${item.description}" dibuat secara otomatis oleh sistem (Kas Kru / Piutang). Untuk menjaga integritas buku besar dan rekonsiliasi, koreksi harus dilakukan melalui modul asalnya.`
      );
      return;
    }
    setEditingItem(item);
  };

  const handleActionVoid = (item: TxDisplayItem) => {
    if (item.isAutomated) {
      setAutomatedWarning(
        `Transaksi "${item.description}" dibuat secara otomatis oleh sistem (Kas Kru / Piutang). Pembatalan atau reversal harus dilakukan melalui modul asalnya.`
      );
      return;
    }
    setVoidingItem(item);
  };

  const handleSaveEditSubmit = async (
    id: string,
    form: {
      tanggal: string;
      keperluan?: string;
      sumber?: string;
      kategori?: string;
      keterangan: string;
      bukti_url?: string;
      categoryId?: string;
    }
  ) => {
    try {
      await submitTransactionUpdate(id, {
        description: form.keperluan || form.sumber || '',
        occurredOn: form.tanggal,
        categoryId: form.categoryId,
        notes: form.keterangan,
        proofUrl: form.bukti_url,
      });
      setEditingItem(null);
      onSuccess?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memperbarui transaksi');
    }
  };

  const handleConfirmVoidSubmit = async (reason: string) => {
    if (!voidingItem) return;
    try {
      setIsVoidSubmitting(true);
      await submitTransactionVoid(voidingItem.id, reason);
      setVoidingItem(null);
      onSuccess?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membatalkan transaksi');
    } finally {
      setIsVoidSubmitting(false);
    }
  };

  if (data.scope === 'own') {
    return (
      <Card standard="r03">
        <div className="finance-access-card">
          <div className="finance-access-icon"><ShieldCheck size={32} /></div>
          <h2>Akses Terbatas: Mode Kru</h2>
          <p>Transaksi pembukuan studio dibatasi untuk hak kelola Eksekutif dan Bendahara. Data kas pribadi Anda tersedia di Kas Kru.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="finance-workspace-wrap">
      {/* QUICK ACTION BAR */}
      {data.canManage && (
        <div className="finance-quick-actions">
          <button
            type="button"
            className="finance-action-btn action-income"
            onClick={() => setOperation('income')}
          >
            <ArrowDownLeft size={16} /> Catat Pemasukan
          </button>
          <button
            type="button"
            className="finance-action-btn action-expense"
            onClick={() => setOperation('expense')}
          >
            <ArrowUpRight size={16} /> Catat Pengeluaran
          </button>
          <button
            type="button"
            className="finance-action-btn action-transfer"
            onClick={() => setOperation('transfer')}
          >
            <ArrowLeftRight size={16} /> Pindah Kantong
          </button>
        </div>
      )}

      {/* TOOLBAR FILTER & PENCARIAN SESUAI STANDAR R03 */}
      <div className="finance-toolbar-card">
        <div className="toolbar-row-top">
          <div className="toolbar-search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari transaksi berdasarkan keterangan atau sumber..."
              className="toolbar-search-input"
            />
          </div>

          {/* FILTER PILL UTAMA: SEMUA, PEMASUKAN, PENGELUARAN */}
          <div className="toolbar-type-pills">
            {(['semua', 'pemasukan', 'pengeluaran'] as const).map(tabKey => (
              <button
                key={tabKey}
                type="button"
                className={`filter-pill ${kind === tabKey ? 'active' : ''}`}
                onClick={() => setKind(tabKey)}
                title={tabKey === 'semua' ? 'Semua Jenis' : undefined}
              >
                {tabKey === 'semua' ? (
                  <>Semua<span className="sr-only"> Jenis</span></>
                ) : tabKey === 'pemasukan' ? (
                  'Pemasukan'
                ) : (
                  'Pengeluaran'
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`toolbar-filter-toggle-mobile ${(showFilters || hasActiveFilters) ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            aria-expanded={showFilters || hasActiveFilters}
            aria-label="Filter lanjutan tanggal, kategori, dan kantong"
          >
            <SlidersHorizontal size={13} />
            <span>Filter Lanjutan{hasActiveFilters ? ' (Aktif)' : ''}</span>
          </button>
        </div>

        <div className={`toolbar-row-filters ${(showFilters || hasActiveFilters) ? 'mobile-expanded' : 'mobile-collapsed'}`}>
          <label className="toolbar-filter-select">
            <ArrowLeftRight size={14} />
            <select
              value={kind === 'transfer' ? 'transfer' : ''}
              onChange={e => {
                if (e.target.value === 'transfer') setKind('transfer');
                else if (kind === 'transfer') setKind('semua');
              }}
            >
              <option value="">Semua Aliran (Termasuk Transfer)</option>
              <option value="transfer">Hanya Transfer Antar-Kantong</option>
            </select>
          </label>

          <label className="toolbar-filter-select">
            <Wallet size={14} />
            <select value={pocketId} onChange={e => setPocketId(e.target.value)} disabled={!pockets}>
              <option value="">Semua Kantong</option>
              {(pockets || []).filter(p => !p.archived).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {categories && categories.length > 0 && (
            <label className="toolbar-filter-select">
              <Tag size={14} />
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">Semua Kategori</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="toolbar-date-range">
            <label>
              <span>Dari:</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </label>
            <label>
              <span>Sampai:</span>
              <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
            </label>
          </div>

          {/* Toggle Audit Mutasi Pengujian */}
          {testTxsCount > 0 && data.canManage && (
            <button
              type="button"
              className={`toolbar-toggle-test-btn ${includeTestTxs ? 'active' : ''}`}
              onClick={() => setIncludeTestTxs(!includeTestTxs)}
              title="Tampilkan transaksi dummy pengujian PTV-DEV-117 yang terisolasi"
            >
              <ShieldCheck size={14} />
              <span>{includeTestTxs ? 'Sembunyikan' : 'Termasuk'} Mutasi Uji ({testTxsCount})</span>
            </button>
          )}
        </div>

        {isFiltered && (
          <div className="finance-filter-summary-row">
            <span className="finance-filter-count-badge">
              Menampilkan <b>{totalResults}</b> transaksi yang cocok
            </span>
            <button
              type="button"
              className="finance-btn-reset-filter"
              onClick={resetFilters}
            >
              <RotateCcw size={12} /> Reset Filter
            </button>
          </div>
        )}
      </div>

      {from && to && from > to && (
        <div className="dialog-alert-box warning">
          <AlertCircle size={16} />
          <p>Tanggal akhir harus sama atau setelah tanggal awal.</p>
        </div>
      )}

      {!transactions && (
        <p className="finance-notice">Menampilkan catatan pembukuan historis. Data terhubung langsung dengan buku utama.</p>
      )}

      {/* TABEL PENGELUARAN / PEMASUKAN BERDASARKAN SISTEM LAMA (LOCKED INSTRUKSI OPERATOR) */}
      {monthGroups.length > 0 ? (
        <div className="finance-monthly-groups-wrap">
          {monthGroups.map(group => {
            const isOnlyIncome = kind === 'pemasukan';
            return (
              <div key={group.ym} className="fin-month-section">
                <div className="fin-month-header">
                  <div className="fin-month-title-wrap">
                    <div className={`fin-month-icon ${isOnlyIncome ? 'pem' : 'pen'}`}>
                      <CalendarDays size={16} />
                    </div>
                    <div>
                      <div className="fin-month-title">{group.label}</div>
                      <div className="fin-month-count">{group.items.length} transaksi pembukuan</div>
                    </div>
                  </div>
                  <div className={`fin-month-chip ${isOnlyIncome ? 'pem' : 'pen'}`}>
                    <span>{isOnlyIncome ? 'Total Pemasukan:' : 'Total Pengeluaran:'}</span>
                    <span className="val">
                      {isOnlyIncome
                        ? `+ ${formatMinor(group.totalIncomeMinor.toString())}`
                        : `- ${formatMinor(group.totalExpenseMinor.toString())}`}
                    </span>
                  </div>
                </div>

                <div className="fin-table-card fin-month-card-body">
                  <div className="fin-table-scroll">
                    <table className="fin-matrix-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Keperluan &amp; Kategori</th>
                          <th className="fin-td-center">Bukti</th>
                          <th>Nominal</th>
                          <th>Keterangan</th>
                          <th>Dicatat Oleh</th>
                          {data.canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => (
                          <tr key={item.id} className={item.status === 'reversed' ? 'row-reversed' : ''}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 650, color: 'var(--ink2)' }}>
                              {item.date || '—'}
                            </td>
                            <td>
                              <div style={{ fontWeight: 750, color: 'var(--ink)' }}>
                                {item.description}
                                {item.isTest && (
                                  <span className="tx-badge-test" style={{ marginLeft: 6 }}>[UJI COBA]</span>
                                )}
                                {item.status === 'reversed' ? (
                                  <span className="tx-badge-reversed" style={{ marginLeft: 6 }}>Dibatalkan</span>
                                ) : (
                                  <span className="tx-badge-posted sr-only">Posted</span>
                                )}
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <span className="fin-kru-id-badge">{item.categoryName}</span>
                              </div>
                            </td>
                            <td className="fin-td-center">
                              {item.proofUrl ? (
                                <button
                                  type="button"
                                  className="fin-thumb-box"
                                  onClick={() => {
                                    setLightboxUrl(item.proofUrl || null);
                                    setLightboxCaption(`Bukti: ${item.description} (${formatMinor(item.amountMinor)})`);
                                  }}
                                  title="Lihat Bukti Foto"
                                >
                                  <img src={item.proofUrl} alt="Bukti" />
                                </button>
                              ) : (
                                <div className="fin-thumb-empty" title="Tidak ada bukti">
                                  <Camera size={14} />
                                </div>
                              )}
                            </td>
                            <td
                              className="tx-amount"
                              style={{
                                whiteSpace: 'nowrap',
                                fontWeight: 850,
                                color:
                                  item.status === 'reversed'
                                    ? 'var(--ink3)'
                                    : item.kind === 'expense'
                                    ? '#dc2626'
                                    : item.kind === 'income'
                                    ? '#059669'
                                    : 'var(--ptv-green)',
                                fontSize: '14px',
                                textDecoration: item.status === 'reversed' ? 'line-through' : 'none',
                              }}
                            >
                              {item.kind === 'expense'
                                ? `- ${formatMinor(item.amountMinor)}`
                                : item.kind === 'income'
                                ? `+ ${formatMinor(item.amountMinor)}`
                                : formatMinor(item.amountMinor)}
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--ink2)', maxWidth: '280px' }}>
                              {item.notes || '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--ink3)' }}>
                              {item.recordedBy || 'Sistem'}
                            </td>
                            {data.canManage && (
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="fin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => handleActionEdit(item)}
                                    title={item.isAutomated ? 'Transaksi otomatis: dikelola via modul asal' : 'Edit Transaksi'}
                                  >
                                    <PenSquare size={13} style={{ color: 'var(--ptv-green)' }} />
                                    <span>Edit</span>
                                  </button>
                                  {item.status !== 'reversed' && (
                                    <button
                                      type="button"
                                      className="fin-btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}
                                      onClick={() => handleActionVoid(item)}
                                      title={item.isAutomated ? 'Transaksi otomatis: batalkan via modul asal' : 'Batalkan Transaksi (VOID)'}
                                    >
                                      <Ban size={13} />
                                      <span>Batalkan</span>
                                    </button>
                                  )}
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
            );
          })}
        </div>
      ) : (
        <Card standard="r03">
          <div className="finance-empty">
            <div className="finance-empty-icon"><Search size={32} /></div>
            <h3>Tidak ada transaksi yang cocok</h3>
            <p>Sesuaikan kata kunci pencarian, jenis transaksi, kantong, kategori, atau rentang tanggal.</p>
            {isFiltered && (
              <button
                type="button"
                className="finance-btn-reset-filter"
                onClick={resetFilters}
                style={{ margin: '14px auto 0', display: 'inline-flex' }}
              >
                <RotateCcw size={13} /> Reset Semua Filter
              </button>
            )}
          </div>
        </Card>
      )}

      {/* MODAL EDIT TRANSAKSI (B4) */}
      {editingItem && (
        <EditTransaksiModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          type={editingItem.kind === 'income' ? 'pemasukan' : 'pengeluaran'}
          pemasukanItem={
            editingItem.kind === 'income'
              ? {
                  id: editingItem.id,
                  tanggal: editingItem.date,
                  sumber: editingItem.description,
                  kategori: (editingItem.categoryName as any) || 'Lainnya',
                  nominal: editingItem.amountNumber,
                  keterangan: editingItem.notes || '',
                  bukti_url: editingItem.proofUrl,
                  dicatat_oleh_nama: editingItem.recordedBy || 'Bendahara',
                  status: 'posted',
                }
              : null
          }
          pengeluaranItem={
            editingItem.kind === 'expense'
              ? {
                  id: editingItem.id,
                  tanggal: editingItem.date,
                  keperluan: editingItem.description,
                  kategori: (editingItem.categoryName as any) || 'Lainnya',
                  nominal: editingItem.amountNumber,
                  keterangan: editingItem.notes || '',
                  bukti_url: editingItem.proofUrl,
                  dicatat_oleh_nama: editingItem.recordedBy || 'Bendahara',
                  status: 'posted',
                }
              : null
          }
          canonicalCategories={categories || []}
          onSavePemasukan={(id, form) => handleSaveEditSubmit(id, form)}
          onSavePengeluaran={(id, form) => handleSaveEditSubmit(id, form)}
        />
      )}

      {/* MODAL BATALKAN TRANSAKSI / REVERSAL (B5) */}
      {voidingItem && (
        <BatalkanTransaksiModal
          isOpen={!!voidingItem}
          onClose={() => setVoidingItem(null)}
          title={voidingItem.description}
          type={voidingItem.kind === 'income' ? 'pemasukan' : voidingItem.kind === 'expense' ? 'pengeluaran' : 'transfer'}
          nominalMinor={voidingItem.amountMinor}
          isSubmitting={isVoidSubmitting}
          onConfirm={handleConfirmVoidSubmit}
        />
      )}

      {/* LIGHTBOX BUKTI NOTA / STRUK (B3) */}
      {lightboxUrl && (
        <ImageLightboxModal
          isOpen={!!lightboxUrl}
          onClose={() => setLightboxUrl(null)}
          imageUrl={lightboxUrl}
          title={lightboxCaption}
          altText={lightboxCaption || 'Bukti Transaksi'}
        />
      )}

      {/* DIALOG PROTEKSI TRANSAKSI OTOMATIS */}
      {automatedWarning && (
        <FinanceDialog title="Transaksi Terikat Modul Otomatis" onClose={() => setAutomatedWarning(null)}>
          <div className="finance-dialog-detail">
            <div className="dialog-alert-box warning" style={{ margin: '10px 0 16px' }}>
              <ShieldCheck size={20} />
              <p>{automatedWarning}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button shape="pill" variant="primary" onClick={() => setAutomatedWarning(null)}>
                Saya Mengerti
              </Button>
            </div>
          </div>
        </FinanceDialog>
      )}

      {/* MODAL DIALOG TRANSAKSI (CREATE BARU) */}
      {operation && (
        <FinanceDialog
          title={
            operation === 'income'
              ? 'Catat Pemasukan Baru'
              : operation === 'expense'
              ? 'Catat Pengeluaran Baru'
              : 'Pindah Kantong'
          }
          onClose={close}
        >
          <TransactionForm
            operation={operation}
            pockets={pockets}
            categories={categories}
            canManage={data.canManage}
            writesEnabled={data.writesEnabled}
            onSuccess={onSuccess}
            onClose={close}
          />
        </FinanceDialog>
      )}

      {/* DETAIL VIEW FALLBACK JIKA DIPERLUKAN */}
      {detail && (
        <FinanceDialog title="Detail Transaksi Pembukuan" onClose={close}>
          <div className="finance-dialog-detail">
            <div className="dialog-tx-hero">
              <span
                className={`tx-type-badge ${
                  detail.status === 'reversed'
                    ? 'badge-reversed'
                    : detail.kind === 'income'
                    ? 'badge-income'
                    : detail.kind === 'expense'
                    ? 'badge-expense'
                    : 'badge-transfer'
                }`}
              >
                {detail.status === 'reversed'
                  ? 'Dibatalkan (Reversed)'
                  : detail.kind === 'income'
                  ? 'Pemasukan'
                  : detail.kind === 'expense'
                  ? 'Pengeluaran'
                  : 'Pindah Kantong'}
              </span>
              <h2>{detail.description}</h2>
              <div
                className={`dialog-hero-amount ${
                  detail.status === 'reversed'
                    ? 'amount-reversed'
                    : detail.kind === 'income'
                    ? 'amount-income'
                    : detail.kind === 'expense'
                    ? 'amount-expense'
                    : 'amount-transfer'
                }`}
              >
                {formatMinor(detail.amountMinor)}
              </div>
              <p className="dialog-hero-meta">
                Tanggal: <strong>{detail.occurredOn}</strong> · Status: <strong>{detail.status}</strong>
              </p>
            </div>

            {detail.status === 'reversed' && (
              <div className="dialog-alert-box warning">
                <AlertCircle size={18} />
                <p>
                  Transaksi ini berstatus <strong>reversed (dibatalkan)</strong> pada catatan historis.
                  Nominal ini tidak memutasi saldo kas dan tidak dihitung dalam pemasukan aktif.
                </p>
              </div>
            )}

            <h3>Alokasi Kantong ({detail.allocations.length})</h3>
            <ul className="dialog-allocations-list">
              {detail.allocations.map(a => {
                const p = pockets?.find(pk => pk.id === a.pocketId);
                return (
                  <li key={`${a.direction}-${a.pocketId}`}>
                    <div className="alloc-info">
                      <strong>{p ? p.name : 'Kantong tidak ditemukan'}</strong>
                      <span className={`alloc-dir-pill ${a.direction}`}>
                        {a.direction === 'in' ? 'Masuk (+)' : 'Keluar (-)'}
                      </span>
                    </div>
                    <strong className="alloc-amount">{formatMinor(a.amountMinor)}</strong>
                  </li>
                );
              })}
            </ul>

            <div className="dialog-audit-box">
              <p><strong>Referensi Audit:</strong> <code>{detail.auditReference}</code></p>
              {detail.sourceReferences && detail.sourceReferences.length > 0 && (
                <p>
                  <strong>Referensi Sumber:</strong>{' '}
                  <code>{detail.sourceReferences.map(s => `${s.kind} #${s.id}`).join(', ')}</code>
                </p>
              )}
            </div>
          </div>
        </FinanceDialog>
      )}
    </div>
  );
}
