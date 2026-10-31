import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Ban, Edit3, Loader2, AlertCircle, Calendar, Tag, Wallet, ShieldCheck, FileText, Check } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { CanonicalTransaction, FinancePocket, CanonicalCategory } from '../financeCanonical';
import { cleanTransactionTitle, isMigratedTransaction } from '../financeCanonical';
import { submitTransactionUpdate, submitTransactionVoid } from '../financeCanonicalService';

interface TransactionDetailDrawerProps {
  transaction: CanonicalTransaction | null;
  onClose: () => void;
  onSuccess: () => void;
  canManage: boolean;
  categories: CanonicalCategory[];
  pockets: FinancePocket[];
}

export function TransactionDetailDrawer({
  transaction,
  onClose,
  onSuccess,
  canManage,
  categories,
  pockets,
}: TransactionDetailDrawerProps) {
  const [isVoiding, setIsVoiding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOccurredOn, setEditOccurredOn] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  useEffect(() => {
    if (transaction) {
      document.body.style.overflow = 'hidden';
      setIsVoiding(false);
      setIsEditing(false);
      setVoidReason('');
      setEditDescription(transaction.description || '');
      setEditOccurredOn(transaction.occurredOn || '');
      setEditCategoryId(transaction.categoryId || '');
      setEditNotes(transaction.notes || '');
      setError('');
      setSuccessInfo('');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [transaction]);

  if (!transaction) return null;

  const isIncome = transaction.kind === 'income';
  const isTransfer = transaction.kind === 'transfer';
  const isReversed = transaction.status === 'reversed';
  const nominal = (Number(transaction.amountMinor) || 0) / 100;

  const category = categories.find(c => c.id === transaction.categoryId);
  const pocketMap = new Map(pockets.map(p => [p.id, p]));
  const allocations = transaction.allocations || [];

  const isLegacy = isMigratedTransaction(transaction);

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      setError('Alasan pembatalan transaksi wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await submitTransactionVoid(transaction.id, voidReason.trim());
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDescription.trim()) {
      setError('Deskripsi transaksi wajib diisi.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await submitTransactionUpdate(transaction.id, {
        description: editDescription.trim(),
        occurredOn: editOccurredOn,
        categoryId: isTransfer ? undefined : editCategoryId || undefined,
        notes: editNotes.trim() || undefined,
      });
      setSuccessInfo('Metadata transaksi berhasil diperbarui.');
      setIsEditing(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui metadata transaksi.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="finance3-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="finance3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: isTransfer ? '#edf4ff' : isIncome ? '#e1f5ee' : '#fde8e6',
                color: isTransfer ? '#0b5fbf' : isIncome ? '#0f7a5a' : '#b02b23',
              }}
            >
              {isTransfer ? <ArrowLeftRight size={16} /> : isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <h3>Rincian & Mutasi Transaksi</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="finance3-tab-btn"
            style={{ padding: '4px 8px', minWidth: 'auto' }}
            aria-label="Tutup rincian"
          >
            <X size={18} />
          </button>
        </div>

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

          {successInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--ptv-curve-md, 12px)',
                background: 'var(--ok-bg, #e1f5ee)',
                color: 'var(--ok, #0f7a5a)',
                fontSize: '13px',
              }}
            >
              <Check size={16} />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Nominal Hero */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--ptv-curve-md, 12px)',
              background: 'var(--surface-2, #f8fafd)',
              border: '1px solid var(--line-2, rgba(11, 42, 74, 0.06))',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #6e8cae)' }}>
                {isTransfer ? 'TRANSFER DANA ANTARKANTONG' : isIncome ? 'TOTAL PEMASUKAN' : 'TOTAL PENGELUARAN'}
              </span>
              <span className={`finance3-badge ${isReversed ? 'reversed' : 'posted'}`}>
                {isReversed ? 'Dibatalkan (VOID)' : 'Berhasil Diposting'}
              </span>
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: isReversed ? 'var(--muted, #6e8cae)' : isTransfer ? '#0b5fbf' : isIncome ? '#059669' : '#dc2626',
                textDecoration: isReversed ? 'line-through' : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isTransfer ? '⇄ ' : isIncome ? '+ ' : '- '}Rp {nominal.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Details List */}
          {!isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2, rgba(11,42,74,0.05))', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Tanggal Transaksi
                </span>
                <span style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{transaction.occurredOn}</span>
              </div>

              {!isTransfer && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2, rgba(11,42,74,0.05))', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} /> Kategori Pos
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>
                    {category?.name || (isIncome ? 'Pemasukan Kas' : 'Pengeluaran Kas')}
                  </span>
                </div>
              )}

              {/* Rincian Alokasi Kantong */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid var(--line-2, rgba(11,42,74,0.05))', paddingBottom: '10px' }}>
                <span style={{ color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={14} /> Alokasi Mutasi Kantong ({allocations.length || 1} pos)
                </span>
                {allocations.length === 0 ? (
                  <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)', paddingLeft: '20px' }}>
                    Kas Utama Studio ({isIncome ? 'Masuk' : 'Keluar'} Rp {nominal.toLocaleString('id-ID')})
                  </div>
                ) : (
                  allocations.map((alloc, idx) => {
                    const p = pocketMap.get(alloc.pocketId);
                    const amt = (Number(alloc.amountMinor) || 0) / 100;
                    const isIn = alloc.direction === 'in';
                    return (
                      <div
                        key={`${alloc.pocketId}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'var(--surface-2, #f8fafd)',
                          fontSize: '12.5px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>
                          {p?.name || 'Kas Utama Studio'}{' '}
                          <span style={{ color: isIn ? '#059669' : '#dc2626', fontWeight: 700 }}>
                            ({isIn ? 'Dana Masuk' : 'Dana Keluar'})
                          </span>
                        </span>
                        <span style={{ fontWeight: 700, color: isIn ? '#059669' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                          {isIn ? '+ ' : '- '}Rp {amt.toLocaleString('id-ID')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2, rgba(11,42,74,0.05))', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} /> Asal Sumber Data
                </span>
                <span>
                  {isLegacy ? (
                    <span className="finance3-badge legacy">
                      Migrasi ({transaction.sourceReferences?.map(s => `${s.kind}#${s.id}`).join(', ') || 'Terekonsiliasi'})
                    </span>
                  ) : (
                    <span className="finance3-badge posted">PTVPRO Hub Canonical</span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Deskripsi & Keterangan
                </span>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--ptv-curve-md, 12px)',
                    background: 'var(--surface-2, #f8fafd)',
                    border: '1px solid var(--line-2, rgba(11, 42, 74, 0.05))',
                    color: 'var(--ink, #0b2a4a)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.45,
                  }}
                >
                  {cleanTransactionTitle(transaction.description)}
                  {transaction.notes ? `\nCatatan: ${transaction.notes}` : ''}
                </div>
              </div>

              {transaction.auditReference && (
                <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)', marginTop: '4px' }}>
                  Audit Ref: <code>{transaction.auditReference}</code>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  background: '#edf4ff',
                  color: '#0b5fbf',
                  fontSize: '12px',
                }}
              >
                Nominal dan alokasi kantong bersifat tetap demi integritas buku besar. Untuk koreksi nominal, batalkan (VOID) transaksi ini dan buat pencatatan baru.
              </div>

              <div className="finance3-form-field">
                <label className="finance3-form-label">Deskripsi Transaksi *</label>
                <input
                  type="text"
                  className="finance3-input"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="finance3-form-field">
                  <label className="finance3-form-label">Tanggal Transaksi *</label>
                  <input
                    type="date"
                    className="finance3-input"
                    value={editOccurredOn}
                    onChange={e => setEditOccurredOn(e.target.value)}
                    required
                  />
                </div>

                {!isTransfer && (
                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Kategori Pos</label>
                    <select
                      className="finance3-select"
                      value={editCategoryId}
                      onChange={e => setEditCategoryId(e.target.value)}
                    >
                      {categories
                        .filter(c => c.kind === transaction.kind && c.isActive)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="finance3-form-field">
                <label className="finance3-form-label">Catatan Audit Tambahan</label>
                <input
                  type="text"
                  className="finance3-input"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button type="button" variant="secondary" size="sm" shape="pill" onClick={() => setIsEditing(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm" shape="pill" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Simpan Perubahan Metadata'}
                </Button>
              </div>
            </form>
          )}

          {/* Form Batalkan / VOID (Jika diaktifkan) */}
          {isVoiding && (
            <form onSubmit={handleVoid} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  background: 'var(--warn-bg, #fcf0d6)',
                  color: 'var(--warn, #9a6b08)',
                  fontSize: '12px',
                  lineHeight: 1.4,
                }}
              >
                <b>Perhatian:</b> Pembatalan transaksi (VOID) bersifat permanen dan akan membalikkan saldo kas secara otomatis melalui RPC atomik PostgreSQL. Histori audit tetap tersimpan.
              </div>

              <div className="finance3-form-field">
                <label className="finance3-form-label">Alasan Pembatalan Transaksi *</label>
                <input
                  type="text"
                  className="finance3-input"
                  placeholder="Misal: Salah input nominal, double entry..."
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button type="button" variant="secondary" size="sm" shape="pill" onClick={() => setIsVoiding(false)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  shape="pill"
                  disabled={loading}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Konfirmasi Batalkan'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="finance3-modal-footer">
          {canManage && !isReversed && !isVoiding && !isEditing && (
            <>
              <Button
                type="button"
                variant="secondary"
                shape="pill"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={14} /> Edit Metadata
              </Button>
              <Button
                type="button"
                variant="secondary"
                shape="pill"
                onClick={() => setIsVoiding(true)}
                style={{ color: '#dc2626' }}
              >
                <Ban size={15} /> Batalkan Transaksi (VOID)
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" shape="pill" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
