import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService } from './inventarisService';
import { ItemInventaris } from './types';
import { formatRupiah, formatDateIndo } from './NilaiInventarisPage';
import { PTVSelect } from '@shared/components';

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
        <div style={{ background: '#fff', border: '1.5px solid #fee2e2', borderRadius: '18px', padding: '32px 24px', textAlign: 'center', maxWidth: '560px', margin: '40px auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Akses Terbatas</h3>
          <p style={{ color: '#64748b', fontSize: '13.5px' }}>Anda tidak memiliki hak akses untuk melihat rincian nilai inventaris.</p>
          <button className="btn pri" onClick={() => navigate('/hub/beranda')}>Kembali ke Beranda</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
        Memuat detail nilai inventaris...
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
      <div style={{ background: 'var(--b-050, #eff6ff)', border: '1px solid var(--b-200, #bfdbfe)', borderRadius: '12px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--b-600, #2563eb)', fontSize: '16px', flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', color: 'var(--b-800, #1e40af)', lineHeight: 1.4 }}>
          <strong>Data Simulasi Finansial:</strong> Nilai perolehan dan catatan valuasi di bawah ini merupakan data simulasi untuk keperluan verifikasi antarmuka dan operasional sistem, bukan nilai buku riil aset Progresif TV.
        </span>
      </div>

      {/* ── Breadcrumb / Header Navigation 1:1 Legacy ── */}
      <div className="ptv-nilai-detail-header">
        <div className="ptv-nilai-detail-header-left">
          <button
            type="button"
            className="btn sm"
            onClick={() => navigate('/hub/inventaris/nilai')}
            style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px', fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Kembali</span>
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: 0, lineHeight: 1.25 }}>
              Detail Nilai Inventaris
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.kode} &bull; {item.nama_alat}
            </div>
          </div>
        </div>

        <div className="ptv-nilai-detail-actions">
          <button
            type="button"
            className="btn sm"
            onClick={() => navigate(`/hub/inventaris/${item.id}`)}
            style={{ background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, color: '#1e293b', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-box" style={{ color: '#2563eb' }} />
            <span>Detail Fisik Alat</span>
          </button>

          {canManage && (
            <button
              type="button"
              className="btn sm pri"
              onClick={() => setIsEditOpen(true)}
              style={{
                borderRadius: '10px',
                padding: '6px 14px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: hasVal ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #059669, #10b981)',
              }}
            >
              <i className={`fa-solid ${hasVal ? 'fa-pen-to-square' : 'fa-plus'}`} />
              <span>{hasVal ? 'Ubah Nilai' : 'Catat Nilai'}</span>
            </button>
          )}

          {canDelete && hasVal && (
            <button
              type="button"
              className="btn sm"
              onClick={handleDeleteNilai}
              style={{ background: '#fff', border: '1.5px solid #fee2e2', color: '#dc2626', borderRadius: '10px', padding: '6px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  <i className="fa-solid fa-receipt" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: 0, lineHeight: 1.25 }}>
                    Informasi Valuasi &amp; Pembelian
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                    Rincian finansial peralatan PTV
                  </span>
                </div>
              </div>
              <span className={`chip ${hasVal ? 'ok' : 'warn'}`} style={{ fontSize: '11px', fontWeight: 750, padding: '2px 10px', flexShrink: 0 }}>
                {statusAset}
              </span>
            </div>

            {/* Price Highlight Banner */}
            <div className="ptv-nilai-detail-price-box">
              <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Nilai Inventaris
              </span>
              <div className="ptv-nilai-detail-price-val" style={{ color: hasVal ? '#047857' : '#94a3b8' }}>
                {nilaiPerolehan}
              </div>
              {hasVal && v && totalUnits > 1 && (
                <div style={{ marginTop: '8px', padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#166534', fontWeight: 700, flexWrap: 'wrap' }}>
                  <span>Harga 1 Unit: <b>{formatRupiah(Math.round(v.nilai_perolehan / totalUnits))}</b></span>
                  <span style={{ color: '#86efac' }}>&bull;</span>
                  <span>Jumlah: <b>{totalUnits} Unit</b></span>
                  <span style={{ color: '#86efac' }}>&bull;</span>
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
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
                  {tglPerolehan}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Sumber Pendanaan
                </span>
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
                  {sumberDana}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-store" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Vendor / Toko
                </span>
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
                  {vendorName}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  <i className="fa-solid fa-receipt" style={{ fontSize: '10px', marginRight: '4px' }} />
                  Nomor Invoice
                </span>
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
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
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
                  {nilaiResidu}
                </span>
              </div>

              <div className="ptv-nilai-detail-meta-cell">
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Nilai Buku / Tercatat
                </span>
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>
                  {nilaiTercatat}
                </span>
              </div>
            </div>

            {/* Catatan Administratif */}
            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                Catatan Administratif
              </span>
              <div style={{ background: 'var(--bg-2, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: 'var(--ink, #334155)', lineHeight: 1.4, wordBreak: 'break-word' }}>
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
              <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'var(--bg-2, #f8fafc)', border: '1.5px solid var(--line, #e2e8f0)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.foto_url ? (
                  <img src={item.foto_url} alt={item.nama_alat} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: '#64748b', fontSize: '26px' }}>
                    <i className="fa-solid fa-boxes-stacked" />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'inline-block', padding: '1px 8px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', marginBottom: '4px' }}>
                  {item.kode}
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: '0 0 4px 0', lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {item.nama_alat}
                </h2>
                <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: '4px' }}>
                  <i className="fa-solid fa-location-dot" style={{ color: '#ef4444', marginRight: '4px' }} />
                  {locName} &bull; {item.kategori}
                </div>
              </div>
            </div>

            {item.spesifikasi && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line-2, #f1f5f9)' }}>
                <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
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
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  <i className="fa-solid fa-boxes-stacked" />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Unit Fisik Terdaftar ({totalUnits})
                </h3>
              </div>
              <span className="chip ok" style={{ fontSize: '10.5px', fontWeight: 750, flexShrink: 0 }}>
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
                    style={{ background: 'var(--bg-2, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
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
                        <div style={{ fontSize: '12.5px', fontWeight: 750, color: 'var(--ink, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Unit {idx + 1 < 10 ? `0${idx + 1}` : idx + 1} ({u.kode_unit})
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted, #64748b)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          SN: {u.nomor_seri || '—'} &bull; Kondisi: <b>{u.kondisi}</b>
                        </div>
                      </div>
                    </div>
                    <span className={`chip ${statusChip}`} style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 750, flexShrink: 0 }}>
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
      {isEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--ink, #0f172a)' }}>
                  {hasVal ? 'Ubah Catatan Nilai' : 'Catat Nilai Inventaris'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                  {item.kode} &bull; {item.nama_alat}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted, #94a3b8)', fontSize: '16px' }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                  Total Nilai Perolehan (Rp) *
                </label>
                <input
                  type="number"
                  className="input"
                  required
                  placeholder="Contoh: 58000000"
                  value={editForm.nilai_perolehan}
                  onChange={(e) => setEditForm({ ...editForm, nilai_perolehan: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px', display: 'block' }}>
                  Format Rupiah: {editForm.nilai_perolehan ? formatRupiah(editForm.nilai_perolehan) : 'Rp 0'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Tanggal Perolehan *
                  </label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={editForm.tanggal_perolehan}
                    onChange={(e) => setEditForm({ ...editForm, tanggal_perolehan: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Sumber Dana *
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Vendor / Toko
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: JPC Kemang"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Nomor Invoice
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: INV/2024/001"
                    value={editForm.nomor_invoice}
                    onChange={(e) => setEditForm({ ...editForm, nomor_invoice: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                  Catatan Administratif
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Catatan kondisi atau keperluan pembelian..."
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', height: 'auto', padding: '8px' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setIsEditOpen(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: 700 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn sm pri"
                  style={{ borderRadius: '10px', padding: '8px 20px', fontWeight: 700 }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Catatan Nilai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
