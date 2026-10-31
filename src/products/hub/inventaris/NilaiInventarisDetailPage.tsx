import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService } from './inventarisService';
import { ItemInventaris } from './types';
import { formatRupiah, formatDateIndo, getCatCompanionClass, getCatIconClass } from './NilaiInventarisPage';
import { PTVSelect, DocDetailSkeleton } from '@shared/components';
import { resolveInventoryPhotoUrl } from './utils/inventoryPhotoUtils';

export const NilaiInventarisDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useSessionStore();

  const [item, setItem] = useState<ItemInventaris | null>(null);
  const [loading, setLoading] = useState(true);

  // Role permissions
  const canView = can('inventory.valuation.view');
  const canManage = can('inventory.valuation.manage') || can('inventory.create');
  const canDelete = can('inventory.delete');

  // Modal edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nilai_perolehan: '',
    nilai_residu: '',
    nilai_tercatat: '',
    tanggal_perolehan: '',
    sumber_perolehan: 'Yayasan',
    vendor: '',
    nomor_invoice: '',
    status: 'Aktif' as 'Aktif' | 'Belum Dicatat' | 'Dihapuskan',
    catatan: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const it = await inventarisService.getInventarisById(id);
      setItem(it);
      if (it?.nilai_inventaris) {
        const v = it.nilai_inventaris;
        setEditForm({
          nilai_perolehan: String(v.nilai_perolehan),
          nilai_residu: v.nilai_residu ? String(v.nilai_residu) : '',
          nilai_tercatat: v.nilai_tercatat ? String(v.nilai_tercatat) : '',
          tanggal_perolehan: v.tanggal_perolehan,
          sumber_perolehan: v.sumber_perolehan,
          vendor: v.vendor || '',
          nomor_invoice: v.nomor_invoice || '',
          status: v.status,
          catatan: v.catatan || '',
        });
      } else if (it) {
        setEditForm({
          nilai_perolehan: '',
          nilai_residu: '',
          nilai_tercatat: '',
          tanggal_perolehan: new Date().toISOString().split('T')[0],
          sumber_perolehan: it.sumber_perolehan || 'Yayasan',
          vendor: '',
          nomor_invoice: '',
          status: 'Aktif',
          catatan: '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [id]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const nilaiNum = parseFloat(editForm.nilai_perolehan.replace(/[^0-9.]/g, '')) || 0;
    if (nilaiNum <= 0) {
      alert('Mohon masukkan nilai perolehan yang valid.');
      return;
    }

    setSubmitting(true);
    try {
      await inventarisService.updateNilaiInventaris(item.id, {
        nilai_perolehan: nilaiNum,
        nilai_residu: editForm.nilai_residu ? parseFloat(editForm.nilai_residu.replace(/[^0-9.]/g, '')) : undefined,
        nilai_tercatat: editForm.nilai_tercatat ? parseFloat(editForm.nilai_tercatat.replace(/[^0-9.]/g, '')) : undefined,
        tanggal_perolehan: editForm.tanggal_perolehan,
        sumber_perolehan: editForm.sumber_perolehan,
        vendor: editForm.vendor,
        nomor_invoice: editForm.nomor_invoice,
        status: editForm.status,
        catatan: editForm.catatan,
      });
      setIsEditOpen(false);
      await loadItem();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNilai = async () => {
    if (!item) return;
    if (!confirm(`Hapus catatan nilai finansial untuk "${item.nama_alat}"? Data alat fisik tetap ada.`)) {
      return;
    }
    await inventarisService.deleteNilaiInventaris(item.id);
    await loadItem();
  };

  if (!canView) {
    return (
      <div className="page subview-fade">
        <div style={{ background: '#fff', border: '1.5px solid #fee2e2', borderRadius: 'var(--ptv-curve-xl)', padding: '32px 24px', textAlign: 'center', maxWidth: '560px', margin: '40px auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Akses Terbatas</h3>
          <p style={{ color: '#64748b', fontSize: '13.5px' }}>Anda tidak memiliki hak akses untuk melihat rincian nilai inventaris.</p>
          <button className="btn pri" onClick={() => navigate('/hub/beranda')}>Kembali ke Beranda</button>
        </div>
      </div>
    );
  }

  if (loading && !item) {
    return (
      <div className="page" style={{ maxWidth: '1060px', margin: '0 auto', padding: '16px' }}>
        <DocDetailSkeleton />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Alat inventaris tidak ditemukan</h3>
        <button className="btn sm pri" onClick={() => navigate('/hub/inventaris/nilai')}>
          Kembali ke Daftar Nilai
        </button>
      </div>
    );
  }

  const v = item.nilai_inventaris;
  const hasVal = Boolean(v && v.nilai_perolehan > 0);
  const totalUnits = item.total_unit;
  const availUnits = item.unit_tersedia;
  const nilaiPerolehan = hasVal && v ? formatRupiah(v.nilai_perolehan) : 'Belum Dicatat';
  const nilaiResidu = v && v.nilai_residu ? formatRupiah(v.nilai_residu) : 'Rp 0';
  const nilaiTercatat = v && v.nilai_tercatat ? formatRupiah(v.nilai_tercatat) : nilaiPerolehan;
  const tglPerolehan = v?.tanggal_perolehan ? formatDateIndo(v.tanggal_perolehan) : '—';
  const sumberDana = v?.sumber_perolehan || item.sumber_perolehan || 'Yayasan';
  const vendorName = v?.vendor || '—';
  const noInvoice = v?.nomor_invoice || '—';
  const statusAset = v?.status || (hasVal ? 'Aktif' : 'Belum Dicatat');
  const catatanVal = v?.catatan || '—';
  const pencatat = v?.created_by_name || 'Staff PTV';
  const tglCatat = v?.created_at ? formatDateIndo(v.created_at) : '—';
  const tglUpdate = v?.updated_at ? formatDateIndo(v.updated_at) : '—';
  const locName = item.units[0]?.lokasi_penyimpanan || 'Studio PTV';

  return (
    <div className="page subview-fade ptv-nilai-detail-page" style={{ paddingTop: '4px' }}>
      {/* Simulation Banner Notice */}
      <div className="ptv-nilai-notice-banner">
        <i className="fa-solid fa-circle-info ptv-nilai-notice-icon" />
        <span className="ptv-nilai-notice-text">
          <strong>Data Simulasi Finansial:</strong> Nilai perolehan dan catatan valuasi di bawah ini merupakan data simulasi untuk keperluan verifikasi antarmuka dan operasional sistem, bukan nilai buku riil aset Progresif TV.
        </span>
      </div>

      {/* ── Breadcrumb / Header Navigation ── */}
      <div className="ptv-nilai-detail-header">
        <div className="ptv-nilai-detail-header-left">
          <button
            type="button"
            className="ptv-nilai-btn-catalog"
            onClick={() => navigate(-1)}
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Kembali</span>
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.25 }}>
              Detail Nilai Inventaris
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.kode} &bull; {item.nama_alat}
            </div>
          </div>
        </div>

        <div className="ptv-nilai-detail-actions">
          <button
            type="button"
            className="ptv-nilai-btn-detail"
            onClick={() => navigate(`/hub/inventaris/${item.id}`)}
          >
            <i className="fa-solid fa-box" />
            <span>Detail Fisik Alat</span>
          </button>

          {canManage && (
            <button
              type="button"
              className="ptv-nilai-btn-edit"
              onClick={() => setIsEditOpen(true)}
            >
              <i className={`fa-solid ${hasVal ? 'fa-pen-to-square' : 'fa-plus'}`} />
              <span>{hasVal ? 'Ubah Nilai' : 'Catat Nilai'}</span>
            </button>
          )}

          {canDelete && hasVal && (
            <button
              type="button"
              className="ptv-nilai-btn-del"
              onClick={handleDeleteNilai}
              aria-label="Hapus catatan nilai finansial"
            >
              <i className="fa-regular fa-trash-can" />
              <span>Hapus</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Grid 1:1 Legacy ── */}
      <div className="ptv-nilai-detail-grid">
        {/* Left Column: Valuation Dossier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ptv-nilai-detail-card">
            {/* Header Box */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line-2, #f1f5f9)', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--ptv-curve-md)', background: 'var(--ok-bg, #ecfdf5)', color: 'var(--ok, #059669)', border: '1px solid var(--ok-border, #a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  <i className="fa-solid fa-receipt" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: 0, lineHeight: 1.25 }}>
                    Informasi Valuasi &amp; Pembelian
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                    Rincian finansial peralatan PTV
                  </span>
                </div>
              </div>
              <span className={`chip ${hasVal ? 'ok' : 'warn'}`} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 10px', flexShrink: 0 }}>
                {statusAset}
              </span>
            </div>

            {/* Price Highlight Banner */}
            <div className="ptv-nilai-detail-price-box">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Nilai Inventaris
              </span>
              <div className="ptv-nilai-detail-price-val" style={{ color: hasVal ? 'var(--ptv-kpi-total-val-fg)' : 'var(--muted)' }}>
                {nilaiPerolehan}
              </div>
              {hasVal && v && totalUnits > 1 && (
                <div className="ptv-nilai-unit-calc-summary">
                  <span>Harga 1 Unit: <b>{formatRupiah(Math.round(v.nilai_perolehan / totalUnits))}</b></span>
                  <span className="dot-separator" style={{ color: '#86efac' }}>&bull;</span>
                  <span>Jumlah: <b>{totalUnits} Unit</b></span>
                  <span className="dot-separator" style={{ color: '#86efac' }}>&bull;</span>
                  <span>Total: <b>{nilaiPerolehan}</b></span>
                </div>
              )}
            </div>

            {/* Metadata Grid (2x2) */}
            <div className="ptv-nilai-detail-meta-grid">
              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-regular fa-calendar" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Tanggal Perolehan
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {tglPerolehan}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Sumber Pendanaan
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {sumberDana}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-store" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Vendor / Toko
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {vendorName}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-receipt" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Nomor Invoice
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {noInvoice}
                </span>
              </div>
            </div>

            {/* Meta Grid 2: Residu & Buku */}
            <div className="ptv-nilai-detail-meta-grid" style={{ marginTop: '10px' }}>
              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Nilai Residu
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {nilaiResidu}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Nilai Buku / Tercatat
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  {nilaiTercatat}
                </span>
              </div>
            </div>

            {/* Catatan Administratif */}
            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                Catatan Administratif
              </span>
              <div style={{ background: 'var(--bg-2, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 'var(--ptv-curve-md)', padding: '10px 12px', fontSize: '12.5px', color: 'var(--ink, #334155)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {catatanVal}
              </div>
            </div>

            {/* Audit Trail */}
            <div style={{ borderTop: '1px solid var(--line-2, #f1f5f9)', paddingTop: '12px', fontSize: '11.5px', color: 'var(--muted, #94a3b8)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <i className="fa-solid fa-user-pen" style={{ marginRight: '4px' }} />
                Dicatat oleh: <b style={{ color: 'var(--ink, #64748b)' }}>{pencatat}</b>
              </div>
              <div>
                <i className="fa-regular fa-clock" style={{ marginRight: '4px' }} />
                Waktu catat: {tglCatat}
              </div>
              {tglUpdate !== '—' && (
                <div>
                  <i className="fa-solid fa-rotate" style={{ marginRight: '4px' }} />
                  Terakhir diubah: {tglUpdate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Physical Asset Profile & Registered Units */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Asset Overview Card */}
          <div className="ptv-nilai-detail-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                className={`ptv-nilai-thumb ${getCatCompanionClass(item.kategori)}`}
                data-cat={item.kategori.toLowerCase()}
                style={{ width: '64px', height: '64px', borderRadius: 'var(--ptv-curve-lg)', overflow: 'hidden' }}
              >
                {(() => {
                  const resolvedPhoto = resolveInventoryPhotoUrl(item.foto_url);
                  return (
                    <>
                      {resolvedPhoto ? (
                        <img
                          src={resolvedPhoto}
                          alt={item.nama_alat}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: resolvedPhoto ? 'none' : 'flex',
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '26px',
                        }}
                      >
                        <i className={`fa-solid ${getCatIconClass(item.kategori)}`} />
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'inline-block', padding: '1px 8px', background: 'var(--bg-2, #f1f5f9)', color: 'var(--ink, #334155)', border: '1px solid var(--line-2, #cbd5e1)', borderRadius: 'var(--ptv-curve-xs)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px' }}>
                  {item.kode}
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '0 0 4px 0', lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {item.nama_alat}
                </h2>
                <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: '4px' }}>
                  <i className="fa-solid fa-location-dot" style={{ color: 'var(--muted)', marginRight: '4px' }} />
                  {locName} &bull; {item.kategori}
                </div>
              </div>
            </div>

            {item.spesifikasi && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line-2, #f1f5f9)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                  Spesifikasi Fisik Alat
                </span>
                <p style={{ fontSize: '12.5px', color: 'var(--ink, #475569)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {item.spesifikasi}
                </p>
              </div>
            )}
          </div>

          {/* Physical Units List */}
          <div className="ptv-nilai-detail-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--ptv-curve-sm)', background: 'var(--b-050, #eff6ff)', color: 'var(--b-600, #2563eb)', border: '1px solid var(--b-200, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  <i className="fa-solid fa-boxes-stacked" />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Unit Fisik Terdaftar ({totalUnits})
                </h3>
              </div>
              <span className="chip ok" style={{ fontSize: '10.5px', fontWeight: 700, flexShrink: 0 }}>
                {availUnits} Tersedia
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {item.units.map((u, idx) => {
                const isAvail = u.status_peminjaman === 'tersedia';
                const isDamaged = u.kondisi === 'rusak' || u.status_peminjaman === 'maintenance';
                const statusChip = isAvail ? 'ok' : isDamaged ? 'dang' : 'warn';
                const statusLabel = isAvail ? 'Tersedia' : isDamaged ? 'Maintenance' : 'Dipinjam';

                return (
                  <div
                    key={u.id}
                    style={{ background: 'var(--bg-2, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 'var(--ptv-curve-md)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isAvail ? '#22c55e' : isDamaged ? '#ef4444' : '#f59e0b',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Unit {idx + 1 < 10 ? `0${idx + 1}` : idx + 1} ({u.kode_unit})
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted, #64748b)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          SN: {u.nomor_seri || '—'} &bull; Kondisi: <b>{u.kondisi}</b>
                        </div>
                      </div>
                    </div>
                    <span className={`chip ${statusChip}`} style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 700, flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Edit / Catat Nilai ── */}
      {isEditOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="ptv-nilai-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditOpen(false);
          }}
        >
          <form onSubmit={handleSaveEdit} className="ptv-nilai-modal-card">
            {/* Modal Header */}
            <div className="ptv-nilai-modal-header">
              <div>
                <h3 className="ptv-nilai-modal-title">
                  {hasVal ? 'Ubah Catatan Nilai' : 'Catat Nilai Inventaris'}
                </h3>
                <span className="ptv-nilai-modal-sub">
                  {item.kode} &bull; {item.nama_alat}
                </span>
              </div>
              <button
                type="button"
                className="ptv-nilai-modal-close-btn"
                onClick={() => setIsEditOpen(false)}
                aria-label="Tutup modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="ptv-nilai-modal-body">
              <div className="ptv-nilai-form-group">
                <label className="ptv-nilai-form-label">
                  <span>Total Nilai Perolehan (Rp)</span>
                  <span className="req">*</span>
                </label>
                <input
                  type="number"
                  className="ptv-nilai-form-input"
                  required
                  placeholder="Contoh: 58000000"
                  value={editForm.nilai_perolehan}
                  onChange={(e) => setEditForm({ ...editForm, nilai_perolehan: e.target.value })}
                />
                <span className="ptv-nilai-form-hint">
                  Format Rupiah: {editForm.nilai_perolehan ? formatRupiah(editForm.nilai_perolehan) : 'Rp 0'}
                </span>
              </div>

              <div className="ptv-nilai-form-row-2col">
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">
                    <span>Tanggal Perolehan</span>
                    <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    className="ptv-nilai-form-input"
                    required
                    value={editForm.tanggal_perolehan}
                    onChange={(e) => setEditForm({ ...editForm, tanggal_perolehan: e.target.value })}
                  />
                </div>
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">
                    <span>Sumber Dana</span>
                    <span className="req">*</span>
                  </label>
                  <PTVSelect
                    value={editForm.sumber_perolehan}
                    onChange={(val) => setEditForm({ ...editForm, sumber_perolehan: val })}
                    options={[
                      { value: 'Yayasan', label: 'Yayasan' },
                      { value: 'Kas PTV', label: 'Kas PTV' },
                      { value: 'Hibah Alumni', label: 'Hibah Alumni' },
                      { value: 'Donasi', label: 'Donasi' },
                    ]}
                    ariaLabel="Sumber Dana Perolehan"
                  />
                </div>
              </div>

              <div className="ptv-nilai-form-row-2col">
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">Vendor / Toko</label>
                  <input
                    type="text"
                    className="ptv-nilai-form-input"
                    placeholder="Contoh: JPC Kemang"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                  />
                </div>
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">Nomor Invoice</label>
                  <input
                    type="text"
                    className="ptv-nilai-form-input"
                    placeholder="Contoh: INV/2024/001"
                    value={editForm.nomor_invoice}
                    onChange={(e) => setEditForm({ ...editForm, nomor_invoice: e.target.value })}
                  />
                </div>
              </div>

              <div className="ptv-nilai-form-group">
                <label className="ptv-nilai-form-label">Catatan Administratif</label>
                <textarea
                  className="ptv-nilai-form-textarea"
                  rows={2}
                  placeholder="Catatan kondisi atau keperluan pembelian..."
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="ptv-nilai-modal-footer">
              <button
                type="button"
                className="ptv-nilai-btn-cancel-modal"
                onClick={() => setIsEditOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="ptv-nilai-btn-submit-modal"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Catatan Nilai</span>
                )}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};
