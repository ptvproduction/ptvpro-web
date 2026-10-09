import React, { useState } from 'react';
import { usePeminjamanList, useAvailableUnits } from './usePeminjaman';
import { useSessionStore } from '@core/session';
import { Card, Button, Badge, LoadingState, ErrorState, EmptyState, Input } from '@shared/components';
import { ArrowLeftRight, Plus, Search, Filter, Calendar, Clock, CheckCircle, X, CheckSquare, Square } from 'lucide-react';
import { KondisiKembali, CheckoutLoanDTO } from './types';

export const PeminjamanPage: React.FC = () => {
  const { user, can } = useSessionStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'dipinjam' | 'dikembalikan' | 'terlambat'>('all');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [returnTargetTx, setReturnTargetTx] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<KondisiKembali>('bagus');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  // Checkout Form State
  const [borrowerName, setBorrowerName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [eventName, setEventName] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const { data, isLoading, isError, error, refetch, checkout, returnLoan } = usePeminjamanList({
    search: search.trim() || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const { availableUnits, isLoading: isLoadingUnits, reload: reloadUnits } = useAvailableUnits();

  const canCheckout = can('loans.checkout');
  const canManageLoan = can('loans.manage') || can('loans.checkout');

  const handleOpenCheckout = () => {
    setBorrowerName(user?.full_name ? `${user.full_name} (${user.division})` : '');
    setPurpose('');
    // Default tenggat kembali: besok
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDueDate(tomorrow.toISOString().split('T')[0]);
    setEventName('');
    setSelectedUnitIds([]);
    setCheckoutError('');
    reloadUnits();
    setIsCheckoutModalOpen(true);
  };

  const toggleSelectUnit = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnitIds.length === 0) {
      setCheckoutError('Pilih minimal satu unit alat untuk dipinjam.');
      return;
    }
    if (!borrowerName.trim()) {
      setCheckoutError('Nama peminjam wajib diisi.');
      return;
    }
    if (!purpose.trim()) {
      setCheckoutError('Keperluan peminjaman wajib diisi.');
      return;
    }

    try {
      setCheckoutSubmitting(true);
      setCheckoutError('');
      const dto: CheckoutLoanDTO = {
        borrower_name: borrowerName.trim(),
        purpose: purpose.trim(),
        due_date: dueDate,
        event_name: eventName.trim() || undefined,
        unit_ids: selectedUnitIds,
      };
      await checkout(dto, user?.id, user?.full_name);
      setIsCheckoutModalOpen(false);
      reloadUnits();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal memproses peminjaman.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetTx) return;

    try {
      setSubmittingReturn(true);
      setReturnError('');
      await returnLoan({
        transaction_id: returnTargetTx,
        condition_status: returnCondition,
        notes: returnNotes.trim() || undefined,
      }, user?.id, user?.full_name);
      setReturnTargetTx(null);
      setReturnNotes('');
      reloadUnits();
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Gagal memproses pengembalian alat.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Halaman */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ArrowLeftRight size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sirkulasi Peminjaman Alat
            </h2>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Pencatatan checkout multi-unit, batas pengembalian, status QC kondisi, dan riwayat sirkulasi studio.
          </p>
        </div>

        {canCheckout && (
          <Button variant="primary" size="md" onClick={handleOpenCheckout}>
            <Plus size={16} />
            Checkout Peminjaman Baru
          </Button>
        )}
      </div>

      {/* Filter dan Pencarian */}
      <Card style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px', backgroundColor: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-card-border)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari No Transaksi (TRX-xxx), nama peminjam, atau nama alat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--bg-card-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.75rem',
                fontSize: 'var(--text-xs)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Status</option>
              <option value="dipinjam">Sedang Dipinjam</option>
              <option value="terlambat">Lewat Tenggat</option>
              <option value="dikembalikan">Sudah Kembali</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabel Sirkulasi Peminjaman */}
      {isLoading ? (
        <LoadingState message="Memuat daftar sirkulasi peminjaman..." />
      ) : isError ? (
        <ErrorState
          title="Gagal Memuat Peminjaman"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data.'}
          onRetry={() => refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Tidak Ada Catatan Peminjaman"
          description="Belum ada transaksi peminjaman yang sesuai dengan filter saat ini."
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--bg-card-border)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>TRANSAKSI & UNIT</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>PEMINJAM & KEPERLUAN</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>JADWAL PINJAM</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {data.map((loan, idx) => (
                  <tr
                    key={loan.id}
                    style={{
                      borderBottom: idx === data.length - 1 ? 'none' : '1px solid var(--bg-card-border)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: 'var(--text-xs)' }}>
                        {loan.transaction_id}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                        {loan.nama_alat}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Barcode: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{loan.kode_unit}</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {loan.peminjam_nama}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {loan.keperluan}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>Pinjam: {loan.tanggal_pinjam}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: loan.status === 'terlambat' ? 'var(--status-danger)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                        <Clock size={13} />
                        <span>Tenggat: {loan.tenggat_kembali}</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        {loan.status === 'dipinjam' && (
                          <Badge variant="warning">Sedang Dipinjam</Badge>
                        )}
                        {loan.status === 'terlambat' && (
                          <Badge variant="danger">Lewat Tenggat</Badge>
                        )}
                        {loan.status === 'dikembalikan' && (
                          <Badge variant="success">Dikembalikan ({loan.kondisi_kembali || 'bagus'})</Badge>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {loan.status !== 'dikembalikan' && canManageLoan ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setReturnTargetTx(loan.transaction_id);
                            setReturnCondition('bagus');
                            setReturnNotes('');
                            setReturnError('');
                          }}
                        >
                          <CheckCircle size={14} />
                          Kembalikan
                        </Button>
                      ) : loan.status === 'dikembalikan' ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          Selesai &bull; {loan.tanggal_kembali}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Checkout Peminjaman */}
      {isCheckoutModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Formulir Checkout Peminjaman Unit
              </h3>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {checkoutError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-danger-bg)', color: '#fca5a5', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {checkoutError}
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Nama Peminjam / Kru"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  placeholder="Misal: Ahmad (Technical)"
                  required
                />
                <Input
                  label="Tenggat Pengembalian"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Keperluan Peminjaman"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Misal: Liputan Wisuda Akbar Santri 2026"
                required
              />

              <Input
                label="Nama Acara / Program (Opsional)"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Misal: Wisuda Akbar BSH"
              />

              {/* Pemilihan Unit Alat Tersedia */}
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                  Pilih Unit Alat yang Tersedia ({selectedUnitIds.length} unit dipilih):
                </label>

                {isLoadingUnits ? (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Memuat unit siap pinjam...</div>
                ) : availableUnits.length === 0 ? (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Tidak ada unit fisik yang berstatus 'tersedia' saat ini.
                  </div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--bg-card-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', backgroundColor: 'var(--bg-primary)' }}>
                    {availableUnits.map(({ unit, item }) => {
                      const isSelected = selectedUnitIds.includes(unit.id);
                      return (
                        <div
                          key={unit.id}
                          onClick={() => toggleSelectUnit(unit.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'rgba(72, 202, 228, 0.15)' : 'var(--bg-card)',
                            border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--bg-card-border)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {isSelected ? (
                              <CheckSquare size={16} style={{ color: 'var(--accent-cyan)' }} />
                            ) : (
                              <Square size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                            <div>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.nama_alat}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Barcode: <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{unit.kode_unit}</span> &bull; Lokasi: {unit.lokasi_penyimpanan || '-'}
                              </div>
                            </div>
                          </div>
                          <Badge variant="info">{item.kategori}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <Button type="button" variant="secondary" onClick={() => setIsCheckoutModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={checkoutSubmitting || selectedUnitIds.length === 0}>
                  {checkoutSubmitting ? 'Memproses Checkout...' : `Konfirmasi Pinjam (${selectedUnitIds.length} Unit)`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pengembalian Alat */}
      {returnTargetTx && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  {returnTargetTx}
                </span>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Konfirmasi Pengembalian Alat
                </h3>
              </div>
              <button
                onClick={() => setReturnTargetTx(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {returnError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-danger-bg)', color: '#fca5a5', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', marginBottom: '1rem' }}>
                {returnError}
              </div>
            )}

            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Kondisi Fisik Saat Kembali (QC)
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as KondisiKembali)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-card-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.55rem 0.75rem',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                >
                  <option value="bagus">Bagus (Siap Dipinjam Kembali)</option>
                  <option value="perlu_servis">Perlu Servis / Pembersihan</option>
                  <option value="rusak">Rusak (Perlu Perbaikan / Masuk Lapor Masalah)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Catatan Pengembalian & Kelengkapan
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Misal: Tutup lensa lengkap, baterai terisi penuh..."
                  rows={3}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-card-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.55rem 0.75rem',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <Button type="button" variant="secondary" onClick={() => setReturnTargetTx(null)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={submittingReturn}>
                  {submittingReturn ? 'Menyimpan...' : 'Proses Pengembalian'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
