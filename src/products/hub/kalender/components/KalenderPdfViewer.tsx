import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  KalenderPdfItemConfig,
  getKalenderPdfConfigs,
  updateKalenderPdfConfig,
  resetKalenderPdfConfigs
} from '../kalenderPdfConfig';
import { exportKalenderAkademikFallbackPdf } from '../utils/kalenderPdfExport';

interface KalenderPdfViewerProps {
  layer: 'pesantren' | 'sekolah';
  onBackToPtv: () => void;
}

export const KalenderPdfViewer: React.FC<KalenderPdfViewerProps> = ({ layer, onBackToPtv }) => {
  const [configs, setConfigs] = useState(getKalenderPdfConfigs());
  const cfg = configs[layer];

  const [zoom, setZoom] = useState<number>(100);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<KalenderPdfItemConfig>>({});
  const [pdfStatus, setPdfStatus] = useState<'checking' | 'available' | 'missing'>('checking');

  // Reload config whenever layer changes
  useEffect(() => {
    setConfigs(getKalenderPdfConfigs());
    setZoom(100);
  }, [layer]);

  // Check if PDF file exists on server
  useEffect(() => {
    let isCancelled = false;
    setPdfStatus('checking');

    const pdfUrl = cfg.relPath.startsWith('http')
      ? cfg.relPath
      : (typeof window !== 'undefined' ? window.location.origin : '') + cfg.relPath;

    fetch(pdfUrl, { method: 'HEAD' })
      .then((res) => {
        if (!isCancelled) {
          if (res.ok) {
            setPdfStatus('available');
          } else {
            setPdfStatus('missing');
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPdfStatus('missing');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [cfg.relPath]);

  const pdfUrl = cfg.relPath.startsWith('http')
    ? cfg.relPath
    : (typeof window !== 'undefined' ? window.location.origin : '') + cfg.relPath;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 50));
  const handleZoomReset = () => setZoom(100);

  const handleOpenEdit = () => {
    setEditForm({
      title: cfg.title,
      subtitle: cfg.subtitle,
      relPath: cfg.relPath,
      downloadName: cfg.downloadName,
      academicYear: cfg.academicYear,
      totalPages: cfg.totalPages,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateKalenderPdfConfig(layer, editForm);
    setConfigs(updated);
    setIsEditModalOpen(false);
  };

  const handleResetToDefault = () => {
    if (confirm('Kembalikan konfigurasi kalender ini ke setelan awal legacy?')) {
      const def = resetKalenderPdfConfigs();
      setConfigs(def);
      setIsEditModalOpen(false);
    }
  };

  return (
    <div
      id="calPdfViewerBox"
      className="kal-surface-card"
      style={{
        maxWidth: '1040px',
        margin: '0 auto',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--line-2, #e2e8f0)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
        borderRadius: 'var(--ptv-curve-xl, 16px)',
      }}
    >
      {/* ── TOP ACTION BAR (Paritas Penuh PHP Legacy page-dasbor.php L16710-16750) ── */}
      <div
        className="pdf-viewer-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          background: 'var(--surface, #ffffff)',
          borderBottom: '1px solid var(--line-2, #e2e8f0)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--ptv-curve-md, 10px)',
              background: cfg.iconBg,
              color: cfg.iconColor,
              display: 'inline-grid',
              placeItems: 'center',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            <i className={cfg.icon} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444', fontSize: '14px', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: 'var(--ink, #0f172a)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}
              >
                {cfg.title}
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: cfg.iconColor,
                  background: cfg.iconBg,
                  padding: '1px 8px',
                  borderRadius: '9999px',
                }}
              >
                {cfg.academicYear}
              </span>
            </div>
            <p
              style={{
                fontSize: '11.5px',
                color: 'var(--muted, #64748b)',
                margin: '2px 0 0',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cfg.subtitle}
            </p>
          </div>
        </div>

        {/* Right Controls: Zoom + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Zoom controls */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg, #f8fafc)',
              border: '1px solid var(--line-2, #e2e8f0)',
              borderRadius: 'var(--ptv-curve-md, 8px)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={handleZoomOut}
              title="Perkecil (-)"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-2, #475569)',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: 'var(--ptv-curve-sm)',
              }}
            >
              <i className="fa-solid fa-minus" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              title="Reset Zoom"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--ink, #0f172a)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '4px 8px',
                borderRadius: 'var(--ptv-curve-sm)',
              }}
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Perbesar (+)"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-2, #475569)',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: 'var(--ptv-curve-sm)',
              }}
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>

          {/* Manage Source Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            title="Kelola URL Dokumen Kalender"
            style={{
              cursor: 'pointer',
              border: '1px solid var(--line-2, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--ink-2, #334155)',
              padding: '6px 12px',
              borderRadius: 'var(--ptv-curve-md, 8px)',
              fontWeight: 650,
              fontSize: '11.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-pen-to-square" />
            <span>Kelola Sumber</span>
          </button>

          {/* Tab Baru */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka Dokumen di Tab Baru"
            style={{
              cursor: 'pointer',
              border: '1px solid var(--line-2, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--ink-2, #334155)',
              padding: '6px 12px',
              borderRadius: 'var(--ptv-curve-md, 8px)',
              fontWeight: 650,
              fontSize: '11.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
            }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square" />
            <span>Tab Baru</span>
          </a>

          {/* Unduh PDF */}
          <a
            href={pdfUrl}
            download={cfg.downloadName}
            onClick={(e) => {
              if (pdfStatus !== 'available') {
                e.preventDefault();
                exportKalenderAkademikFallbackPdf(layer);
              }
            }}
            title="Unduh Berkas PDF Resmi"
            style={{
              cursor: 'pointer',
              border: 'none',
              background: cfg.iconColor,
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 'var(--ptv-curve-md, 8px)',
              fontWeight: 700,
              fontSize: '11.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              boxShadow: `0 2px 8px ${cfg.iconBg}`,
            }}
          >
            <i className="fa-solid fa-file-arrow-down" />
            <span>Unduh PDF</span>
          </a>
        </div>
      </div>

      {/* ── VIEWPORT & DISPLAY LOGIC ── */}
      <div
        id="calPdfViewport"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '560px',
          height: '76vh',
          background: 'var(--bg, #f1f5f9)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: pdfStatus === 'available' ? 'flex-start' : 'center',
          padding: '24px 16px',
          boxSizing: 'border-box',
        }}
      >
        {pdfStatus === 'checking' && (
          <div style={{ textAlign: 'center', color: 'var(--muted, #64748b)', padding: '40px 20px' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: cfg.iconColor, marginBottom: '14px' }} />
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
              Memeriksa ketersediaan dokumen kalender resmi...
            </p>
          </div>
        )}

        {pdfStatus === 'available' && (
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              height: '100%',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <iframe
              src={pdfUrl}
              title={cfg.title}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '700px',
                border: 'none',
                borderRadius: 'var(--ptv-curve-md)',
                background: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
            />
          </div>
        )}

        {pdfStatus === 'missing' && (
          <div
            className="kal-pdf-empty-state"
            style={{
              maxWidth: '620px',
              width: '100%',
              background: 'var(--surface, #ffffff)',
              borderRadius: 'var(--ptv-curve-xl, 16px)',
              border: '1px solid var(--line-2, #e2e8f0)',
              padding: '36px 28px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: cfg.iconBg,
                color: cfg.iconColor,
                display: 'inline-grid',
                placeItems: 'center',
                fontSize: '24px',
                marginBottom: '16px',
              }}
            >
              <i className="fa-solid fa-file-circle-exclamation" />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--ink, #0f172a)' }}>
              Berkas PDF Belum Diunggah
            </h3>

            <p style={{ margin: '0 auto 20px', fontSize: '13px', color: 'var(--muted, #64748b)', lineHeight: 1.5, maxWidth: '480px' }}>
              Dokumen <strong>{cfg.title} ({cfg.academicYear})</strong> belum tersedia di lokasi penyimpanan server.
              Pengelola dapat mengunggah file baru atau memperbarui tautan sumber dokumen di bawah ini.
            </p>

            {/* Info Box */}
            <div
              style={{
                background: 'var(--bg, #f8fafc)',
                border: '1px solid var(--line-2, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-lg, 12px)',
                padding: '14px 18px',
                textAlign: 'left',
                fontSize: '12px',
                color: 'var(--ink-2, #334155)',
                margin: '0 auto 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div>
                <strong>Jalur Berkas yang Diharapkan:</strong>{' '}
                <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 'var(--ptv-curve-sm)', fontSize: '11px' }}>
                  {cfg.relPath}
                </code>
              </div>
              <div>
                <strong>Nama Unduhan Default:</strong> {cfg.downloadName}
              </div>
              <div>
                <strong>Tahun Ajaran:</strong> {cfg.academicYear} (Estimasi {cfg.totalPages} Halaman)
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => exportKalenderAkademikFallbackPdf(layer)}
                style={{
                  background: cfg.iconColor,
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 'var(--ptv-curve-md, 8px)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: `0 2px 8px ${cfg.iconBg}`,
                }}
              >
                <i className="fa-solid fa-file-arrow-down" />
                <span>Unduh Kalender PDF Resmi</span>
              </button>

              <button
                type="button"
                onClick={handleOpenEdit}
                style={{
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink-2, #334155)',
                  border: '1px solid var(--line-2, #cbd5e1)',
                  padding: '9px 16px',
                  borderRadius: 'var(--ptv-curve-md, 8px)',
                  fontWeight: 650,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-wrench" />
                <span>Ubah URL Sumber</span>
              </button>

              <button
                type="button"
                onClick={onBackToPtv}
                style={{
                  background: 'transparent',
                  color: 'var(--ink-2, #334155)',
                  border: '1px solid var(--line-2, #cbd5e1)',
                  padding: '9px 16px',
                  borderRadius: 'var(--ptv-curve-md, 8px)',
                  fontWeight: 650,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-calendar-days" />
                <span>Kembali ke Kalender PTV</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL KELOLA SUMBER PDF (RUNTIME CONFIG OVERRIDE) ── */}
      {isEditModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 10000,
            }}
            onClick={() => setIsEditModalOpen(false)}
          >
            <div
              className="kal-surface-card"
              style={{
                maxWidth: '520px',
                width: '100%',
                background: 'var(--surface, #ffffff)',
                borderRadius: 'var(--ptv-curve-xl, 16px)',
                padding: '24px',
                border: '1px solid var(--line-2, #e2e8f0)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--ptv-curve-md)',
                      background: cfg.iconBg,
                      color: cfg.iconColor,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '14px',
                    }}
                  >
                    <i className="fa-solid fa-sliders" />
                  </span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink, #0f172a)' }}>
                    Pengaturan Sumber PDF
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '5px' }}>
                    Judul Kalender
                  </label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="kal-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '5px' }}>
                    Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    value={editForm.academicYear || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, academicYear: e.target.value }))}
                    className="kal-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                    placeholder="Contoh: 2025/2026"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '5px' }}>
                    URL atau Jalur Berkas PDF
                  </label>
                  <input
                    type="text"
                    value={editForm.relPath || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, relPath: e.target.value }))}
                    className="kal-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                    placeholder="Contoh: /wp-content/uploads/KALENDER-2026.pdf atau https://..."
                    required
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Bisa berupa relative path publik (misal: <code>/kalender/dokumen.pdf</code>) atau URL cloud storage penuh.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '5px' }}>
                    Nama File Unduhan
                  </label>
                  <input
                    type="text"
                    value={editForm.downloadName || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, downloadName: e.target.value }))}
                    className="kal-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 650,
                    }}
                  >
                    Reset Default
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      style={{
                        padding: '8px 14px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--ptv-curve-md)',
                        fontSize: '12px',
                        fontWeight: 650,
                        cursor: 'pointer',
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '8px 16px',
                        background: '#0e4f40',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--ptv-curve-md)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
