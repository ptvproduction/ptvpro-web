import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2, AlertCircle, QrCode, Building2, Banknote } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { officialQrisPath, type CanonicalCategory, type FinancePocket } from '../financeCanonical';
import { submitFinanceOperation } from '../financeCanonicalService';
import { safeRandomUuid } from '@shared/utils/uuid';

interface CatatTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'income' | 'expense' | 'transfer';
  initialPocketId?: string;
  initialPaymentMethod?: 'cash' | 'transfer' | 'qris';
  initialDescription?: string;
  initialNominal?: number;
  categories: CanonicalCategory[];
  pockets: FinancePocket[];
}

export function CatatTransaksiModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'income',
  initialPocketId,
  initialPaymentMethod = 'cash',
  initialDescription = '',
  initialNominal,
  categories,
  pockets,
}: CatatTransaksiModalProps) {
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initialType);
  const [nominal, setNominal] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [pocketId, setPocketId] = useState('');
  const [fromPocketId, setFromPocketId] = useState('');
  const [toPocketId, setToPocketId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>(initialPaymentMethod);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setType(initialType);
      setPaymentMethod(initialPaymentMethod);
      setError('');
      setNominal(initialNominal && initialNominal > 0 ? initialNominal.toLocaleString('id-ID') : '');
      setDescription(initialDescription || '');
      setNotes('');
      const active = pockets.filter(p => !p.archived);
      const main = (initialPocketId ? active.find(p => p.id === initialPocketId) : null)
        || active.find(p => p.name.includes('Kas Utama'))
        || active[0];
      if (main) {
        setPocketId(main.id);
        setFromPocketId(main.id);
      }
      const secondPocket = active.find(p => p.id !== main?.id) || active[0];
      if (secondPocket) {
        setToPocketId(secondPocket.id);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialType, initialPocketId, initialPaymentMethod, initialDescription, initialNominal, pockets]);

  // Set default category according to type
  useEffect(() => {
    if (type === 'transfer') return;
    const validCats = categories.filter(c => c.kind === type && c.isActive);
    if (validCats.length > 0 && (!categoryId || !validCats.some(c => c.id === categoryId))) {
      setCategoryId(validCats[0].id);
    }
  }, [type, categories, categoryId]);

  if (!isOpen) return null;

  const validCategories = type === 'transfer' ? [] : categories.filter(c => c.kind === type && c.isActive);
  const activePockets = pockets.filter(p => !p.archived);
  const qrisPocket = activePockets.find(p => officialQrisPath(p)) || activePockets.find(p => p.qris) || null;
  const qrisPath = qrisPocket ? officialQrisPath(qrisPocket) || qrisPocket.qris?.assetPath || null : null;

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setNominal('');
      return;
    }
    const val = parseInt(raw, 10);
    setNominal(val.toLocaleString('id-ID'));
  };

  const getCleanNominal = (): number => {
    return parseInt(nominal.replace(/\D/g, ''), 10) || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = getCleanNominal();
    if (amount <= 0) {
      setError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }

    if (type !== 'transfer' && !categoryId) {
      setError('Pilih kategori transaksi.');
      return;
    }

    if (type === 'transfer') {
      if (!fromPocketId || !toPocketId) {
        setError('Pilih kantong asal dan kantong tujuan transfer.');
        return;
      }
      if (fromPocketId === toPocketId) {
        setError('Kantong asal dan kantong tujuan transfer tidak boleh sama.');
        return;
      }
    } else if (!pocketId) {
      setError('Pilih kantong kas transaksi.');
      return;
    }

    if (!description.trim()) {
      setError('Keterangan atau sumber transaksi wajib diisi.');
      return;
    }

    const amountMinor = String(BigInt(amount) * 100n);
    const idempotencyKey = safeRandomUuid();

    const methodBadge = paymentMethod === 'qris' ? '[QRIS]' : paymentMethod === 'transfer' ? '[Transfer]' : '';
    const baseDesc = description.trim();
    const fullDescParts = [
      methodBadge && !baseDesc.toLowerCase().includes(paymentMethod) ? `${baseDesc} ${methodBadge}` : baseDesc,
      notes.trim(),
    ].filter(Boolean);

    const cmd = type === 'transfer'
      ? {
          version: 2 as const,
          idempotencyKey,
          operation: 'transfer' as const,
          occurredOn,
          description: fullDescParts.join(' — '),
          currency: 'IDR' as const,
          amountMinor,
          incoming: [{ pocketId: toPocketId, amountMinor }],
          outgoing: [{ pocketId: fromPocketId, amountMinor }],
        }
      : {
          version: 2 as const,
          idempotencyKey,
          operation: type,
          occurredOn,
          description: fullDescParts.join(' — '),
          currency: 'IDR' as const,
          amountMinor,
          categoryId,
          incoming: type === 'income' ? [{ pocketId, amountMinor }] : [],
          outgoing: type === 'expense' ? [{ pocketId, amountMinor }] : [],
        };

    try {
      setLoading(true);
      await submitFinanceOperation(cmd, pockets);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="finance3-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="finance3-modal-surface" onClick={e => e.stopPropagation()}>
        <div className="finance3-modal-header">
          <h3>
            {type === 'income'
              ? 'Catat Pemasukan Kas'
              : type === 'expense'
                ? 'Catat Pengeluaran Kas'
                : 'Transfer Dana Antarkantong'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="finance3-tab-btn"
            style={{ padding: '4px 8px', minWidth: 'auto' }}
            aria-label="Tutup modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="finance3-modal-body">
            {error && (
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
                <span>{error}</span>
              </div>
            )}

            {/* Segmented Type Switcher */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`finance3-tab-btn ${type === 'income' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '10px',
                  background: type === 'income' ? '#e1f5ee' : 'var(--surface-2, #f1f5f9)',
                  color: type === 'income' ? '#0f7a5a' : 'var(--muted, #6e8cae)',
                  border: type === 'income' ? '1px solid #10b981' : '1px solid transparent',
                }}
              >
                <ArrowDownLeft size={16} /> Pemasukan (+)
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`finance3-tab-btn ${type === 'expense' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '10px',
                  background: type === 'expense' ? '#fde8e6' : 'var(--surface-2, #f1f5f9)',
                  color: type === 'expense' ? '#b02b23' : 'var(--muted, #6e8cae)',
                  border: type === 'expense' ? '1px solid #ef4444' : '1px solid transparent',
                }}
              >
                <ArrowUpRight size={16} /> Pengeluaran (-)
              </button>
              <button
                type="button"
                onClick={() => setType('transfer')}
                className={`finance3-tab-btn ${type === 'transfer' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '10px',
                  background: type === 'transfer' ? '#edf4ff' : 'var(--surface-2, #f1f5f9)',
                  color: type === 'transfer' ? '#0b5fbf' : 'var(--muted, #6e8cae)',
                  border: type === 'transfer' ? '1px solid #0b5fbf' : '1px solid transparent',
                }}
              >
                <ArrowLeftRight size={16} /> Transfer Kantong (⇄)
              </button>
            </div>

            {/* Nominal */}
            <div className="finance3-form-field">
              <label className="finance3-form-label">Nominal (Rp) *</label>
              <input
                type="text"
                inputMode="numeric"
                className="finance3-input"
                placeholder="0"
                value={nominal}
                onChange={handleNominalChange}
                required
                autoFocus
                style={{ fontSize: '18px', fontWeight: 700 }}
              />
            </div>

            {/* Metode Pembayaran (Untuk Pemasukan & Pengeluaran) */}
            {type !== 'transfer' && (
              <div className="finance3-form-field">
                <label className="finance3-form-label">Metode Pembayaran / Kanal Dana</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`finance3-filter-chip ${paymentMethod === 'cash' ? 'active' : ''}`}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote size={14} /> Tunai (Cash)
                  </button>
                  <button
                    type="button"
                    className={`finance3-filter-chip ${paymentMethod === 'transfer' ? 'active' : ''}`}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('transfer')}
                  >
                    <Building2 size={14} /> Transfer Bank
                  </button>
                  <button
                    type="button"
                    className={`finance3-filter-chip ${paymentMethod === 'qris' ? 'active' : ''}`}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('qris')}
                  >
                    <QrCode size={14} /> QRIS Studio
                  </button>
                </div>

                {paymentMethod === 'qris' && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '10px 12px',
                      borderRadius: 'var(--ptv-curve-md, 12px)',
                      background: '#edf4ff',
                      border: '1px solid #dcebff',
                      fontSize: '12px',
                      color: '#0b2a4a',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0b5fbf', marginBottom: '2px' }}>
                      Verifikasi Manual Penerimaan QRIS
                    </div>
                    <div>
                      Menampilkan kode QRIS tidak mengonfirmasi pembayaran secara otomatis. Pastikan dana telah benar-benar masuk ke mutasi rekening/merchant{' '}
                      <b>{qrisPocket?.qris?.merchantName || 'Studio PTV'}</b> sebelum menyimpan transaksi ini.
                    </div>
                    {qrisPath && (
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#0f7a5a', fontWeight: 600 }}>
                        NMID Terdaftar: {qrisPocket?.qris?.nmid}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Kategori & Tanggal (2 Kolom) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {type !== 'transfer' && (
                <div className="finance3-form-field">
                  <label className="finance3-form-label">Kategori *</label>
                  <select
                    className="finance3-select"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    required
                  >
                    {validCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="finance3-form-field">
                <label className="finance3-form-label">Tanggal Transaksi *</label>
                <input
                  type="date"
                  className="finance3-input"
                  value={occurredOn}
                  onChange={e => setOccurredOn(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Kantong Kas: Single atau Asal -> Tujuan */}
            {type === 'transfer' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div className="finance3-form-field">
                  <label className="finance3-form-label">Kantong Sumber (Keluar) *</label>
                  <select
                    className="finance3-select"
                    value={fromPocketId}
                    onChange={e => setFromPocketId(e.target.value)}
                    required
                  >
                    {activePockets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="finance3-form-field">
                  <label className="finance3-form-label">Kantong Tujuan (Masuk) *</label>
                  <select
                    className="finance3-select"
                    value={toPocketId}
                    onChange={e => setToPocketId(e.target.value)}
                    required
                  >
                    {activePockets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="finance3-form-field">
                <label className="finance3-form-label">
                  {type === 'income' ? 'Kantong Kas Penerima *' : 'Kantong Kas Sumber *'}
                </label>
                <select
                  className="finance3-select"
                  value={pocketId}
                  onChange={e => setPocketId(e.target.value)}
                  required
                >
                  {activePockets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Saldo: Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Deskripsi / Sumber */}
            <div className="finance3-form-field">
              <label className="finance3-form-label">
                {type === 'income'
                  ? 'Sumber / Dari Siapa *'
                  : type === 'expense'
                    ? 'Keperluan Belanja / Pembayaran *'
                    : 'Keterangan Pemindahan Dana *'}
              </label>
              <input
                type="text"
                className="finance3-input"
                placeholder={
                  type === 'income'
                    ? 'Contoh: Iuran Kas Kru, Jasa Liputan...'
                    : type === 'expense'
                      ? 'Contoh: Beli Galon Cleo, Tinta Printer...'
                      : 'Contoh: Setor tunai kas studio ke rekening bank...'
                }
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Catatan / Keterangan Tambahan */}
            <div className="finance3-form-field">
              <label className="finance3-form-label">Catatan Tambahan (Opsional)</label>
              <textarea
                className="finance3-textarea"
                rows={2}
                placeholder="Rincian tambahan, nomor referensi bukti, atau keterangan..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="finance3-modal-footer">
            <Button type="button" variant="secondary" shape="pill" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              shape="pill"
              disabled={loading}
              style={{
                background: type === 'income' ? '#059669' : type === 'expense' ? '#dc2626' : '#0b5fbf',
                borderColor: type === 'income' ? '#059669' : type === 'expense' ? '#dc2626' : '#0b5fbf',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                `Simpan ${type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer'}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
