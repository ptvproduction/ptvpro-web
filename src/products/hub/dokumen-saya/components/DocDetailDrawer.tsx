import { createPortal } from 'react-dom';
import React, { useRef, useState, useEffect } from 'react';
import { PtvDocument } from '../mock/docsMockData';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { RealQrCode } from '@shared/utils';
import { buildOfficialDocVerificationUrl } from '@products/verification/verificationService';
import { downloadOfficialDocPdf } from '../utils/docPdfPrinter';

interface DocDetailDrawerProps {
  doc: PtvDocument | null;
  onClose: () => void;
  canApprove: boolean;
  canManageArchive?: boolean;
  onApprove: (id: string, note?: string) => void;
  onArchive?: (id: string, note?: string) => void;
  onRequestRevision?: (id: string) => void;
  onResubmit?: (doc: PtvDocument) => void;
  onReject: (id: string) => void;
  onDelete: (id: string, reason?: string) => void;
  defaultExpanded?: boolean;
}

export const DocDetailDrawer: React.FC<DocDetailDrawerProps> = ({
  doc,
  onClose,
  canApprove,
  canManageArchive = false,
  onApprove,
  onArchive,
  onRequestRevision,
  onResubmit,
  onReject,
  onDelete,
  defaultExpanded = false,
}) => {
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiveNote, setArchiveNote] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen: Boolean(doc),
    onClose,
    modalRef,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    details: Boolean(defaultExpanded),
    timeline: Boolean(defaultExpanded),
    audit: Boolean(defaultExpanded),
    verification: Boolean(defaultExpanded),
  }));

  const [isDownloading, setIsDownloading] = useState(false);

  // Reset expanded state based on document identity (doc?.id)
  useEffect(() => {
    if (doc) {
      setExpandedSections({
        details: Boolean(defaultExpanded),
        timeline: Boolean(defaultExpanded),
        audit: Boolean(defaultExpanded),
        verification: Boolean(defaultExpanded),
      });
    }
  }, [doc?.id, defaultExpanded]);

  if (!doc) return null;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isPending = doc.status === 'Menunggu' || doc.status === 'Draft';
  const isApproved = doc.status === 'Disetujui' || doc.status === 'Berlaku';
  const isArchived = doc.status === 'Diarsipkan';
  const isRejected = doc.status === 'Ditolak' || doc.status === 'Dibatalkan';
  const isRevision = doc.status === 'Revisi';
  const isBarang = doc.type === 'Izin Membawa Barang' || doc.type === 'Surat Bawa Barang';
  const hasOfficialNo = (isApproved || isArchived) && doc.no && doc.no !== '—' && !doc.no.includes('Menunggu');

  const statusClass = isArchived
    ? 'archived'
    : isApproved
    ? 'approved'
    : isRevision
    ? 'revision'
    : isRejected
    ? 'rejected'
    : 'pending';

  const statusIcon = isArchived
    ? 'fa-solid fa-box-archive'
    : isApproved
    ? 'fa-solid fa-circle-check'
    : isRevision
    ? 'fa-solid fa-pen-to-square'
    : isRejected
    ? 'fa-solid fa-circle-xmark'
    : 'fa-regular fa-clock';

  // Timeline calculation
  const reviewStatus = isApproved || isRejected || isRevision ? 'Selesai' : 'Sedang berjalan';
  const decisionStatus = isApproved ? 'Disetujui / ACC' : isRejected ? 'Ditolak' : isRevision ? 'Revisi' : 'Menunggu Keputusan';
  const archiveStatus = isApproved ? 'Diarsipkan' : 'Belum';

  const hasRecipients = Boolean(doc.recipients && doc.recipients.length > 0);
  const hasItems = Boolean(doc.items && doc.items.length > 0);
  const hasAuditHistory = Boolean(doc.status_history && doc.status_history.length > 0);

  const handleDownload = async () => {
    if (!hasOfficialNo) {
      alert(`Dokumen "${doc.subject}" belum disahkan atau nomor surat resmi belum diterbitkan.`);
      return;
    }

    try {
      setIsDownloading(true);
      await downloadOfficialDocPdf(doc);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses dokumen resmi untuk diunduh.');
    } finally {
      setIsDownloading(false);
    }
  };

  const cleanDocNumber = (num?: string) => {
    if (!num || num === '—') return '';
    return num.trim();
  };

  const content = (
    <div className="kk-drawer-overlay doc-detail-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div ref={modalRef} className="kk-drawer-content doc-detail-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="kk-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>Detail Dokumen</span>
            <span style={{ color: 'var(--line-2)' }}>•</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isBarang ? '#7c3aed' : '#2563eb' }}>
              {doc.type}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="kk-drawer-body">
          {/* Title & Official Number & Status Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '16.5px', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35 }}>
                {doc.subject}
              </h2>
              <div className="font-mono" style={{ fontSize: '12px', color: 'var(--b-600)', fontWeight: 700 }}>
                {hasOfficialNo ? doc.no : 'Belum diterbitkan (Menunggu ACC Eksekutif)'}
              </div>
            </div>
            <span className={`prz-status-badge ${statusClass}`} style={{ flexShrink: 0, marginTop: '2px' }}>
              <i className={statusIcon} style={{ fontSize: '9px' }} />
              <span>{doc.status}</span>
            </span>
          </div>

          {/* Review Note Display (Always visible directly if Revision or Rejected) */}
          {doc.review_note && (
            <div
              style={{
                background: isRevision ? '#fffbeb' : '#fef2f2',
                border: `1px solid ${isRevision ? '#fde68a' : '#fecaca'}`,
                borderRadius: 'var(--r-md, 12px)',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <i
                  className={isRevision ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-xmark'}
                  style={{ color: isRevision ? '#d97706' : '#dc2626', fontSize: '13px' }}
                />
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    color: isRevision ? '#b45309' : '#b91c1c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {isRevision ? 'Catatan Perbaikan / Revisi' : 'Alasan Penolakan'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: isRevision ? '#92400e' : '#7f1d1d', lineHeight: 1.45 }}>
                {doc.review_note}
              </p>
            </div>
          )}

          {/* Compact Status Summary Banner */}
          <div className={`prz-status-summary-card ${statusClass}`}>
            <div className="prz-status-summary-icon">
              <i className={statusIcon} />
            </div>
            <div className="prz-status-summary-text">
              <span className="prz-status-summary-title">
                {isApproved
                  ? 'Disetujui'
                  : isRevision
                  ? 'Perlu Revisi'
                  : isRejected
                  ? 'Ditolak'
                  : 'Menunggu Review'}
              </span>
              <span className="prz-status-summary-desc">
                {isApproved
                  ? 'Dokumen telah melalui proses peninjauan dan pengesahan resmi pimpinan.'
                  : isRevision
                  ? 'Pimpinan meminta perbaikan data pada permohonan ini.'
                  : isRejected
                  ? 'Permohonan perizinan ini tidak disetujui oleh pimpinan.'
                  : 'Dokumen sedang berada dalam antrean peninjauan pimpinan.'}
              </span>
            </div>
          </div>

          {/* Ringkasan Utama (Single Card) */}
          <div className="prz-detail-summary-card">
            <div className="prz-summary-row">
              <span className="k">Pemohon</span>
              <span className="v">{doc.owner}</span>
            </div>
            <div className="prz-summary-row">
              <span className="k">Tanggal Dokumen</span>
              <span className="v">
                {doc.start_date && doc.end_date && doc.start_date !== doc.end_date
                  ? `${doc.start_date} s.d. ${doc.end_date}`
                  : doc.date}
              </span>
            </div>
            {doc.penanggung_jawab && (
              <div className="prz-summary-row">
                <span className="k">Penanggung Jawab</span>
                <span className="v">{doc.penanggung_jawab}</span>
              </div>
            )}
            {doc.event && (
              <div className="prz-summary-row">
                <span className="k">Acara Terkait</span>
                <span className="v" style={{ color: 'var(--b-600)' }}>{doc.event}</span>
              </div>
            )}
            {hasRecipients && (
              <div className="prz-summary-row">
                <span className="k">Personel Kru</span>
                <span className="v count-pill blue">
                  <i className="fa-solid fa-users" style={{ fontSize: '10px' }} />
                  {doc.recipients!.length} kru ditugaskan
                </span>
              </div>
            )}
            {hasItems && (
              <div className="prz-summary-row">
                <span className="k">Peralatan</span>
                <span className="v count-pill purple">
                  <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '10px' }} />
                  {doc.items!.length} jenis peralatan
                </span>
              </div>
            )}
          </div>

          {/* Accordion Group (Informasi Tambahan R03) */}
          <div className="prz-accordion-group">
            {/* Accordion 1: Rincian Personel & Peralatan */}
            {(hasRecipients || hasItems) && (
              <div className="prz-accordion-item">
                <button
                  type="button"
                  className="prz-accordion-header"
                  onClick={() => toggleSection('details')}
                  aria-expanded={expandedSections.details}
                >
                  <span className="prz-accordion-title">
                    <i className="fa-solid fa-list-check" style={{ color: 'var(--b-600)' }} />
                    <span>Rincian Personel & Peralatan</span>
                  </span>
                  <i className={`fa-solid fa-chevron-down prz-accordion-arrow ${expandedSections.details ? 'open' : ''}`} />
                </button>
                {expandedSections.details && (
                  <div className="prz-accordion-content">
                    {hasRecipients && (
                      <div style={{ marginBottom: hasItems ? '12px' : 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Daftar Kru ({doc.recipients!.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {doc.recipients!.map((name, i) => (
                            <div key={i} className="prz-detail-crew-pill">
                              <i className="fa-regular fa-user" style={{ fontSize: '10px', color: 'var(--b-600)' }} />
                              <span>{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {hasItems && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Daftar Peralatan ({doc.items!.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {doc.items!.map((item, i) => (
                            <div key={i} className="prz-detail-item-pill">
                              <i className="fa-solid fa-boxes-packing" style={{ fontSize: '10px', color: 'var(--cat-lensa-fg, #a855f7)' }} />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Accordion 2: Alur Persetujuan & Timeline */}
            <div className="prz-accordion-item">
              <button
                type="button"
                className="prz-accordion-header"
                onClick={() => toggleSection('timeline')}
                aria-expanded={expandedSections.timeline}
              >
                <span className="prz-accordion-title">
                  <i className="fa-solid fa-timeline" style={{ color: 'var(--ok)' }} />
                  <span>Alur Persetujuan & Timeline</span>
                </span>
                <i className={`fa-solid fa-chevron-down prz-accordion-arrow ${expandedSections.timeline ? 'open' : ''}`} />
              </button>
              {expandedSections.timeline && (
                <div className="prz-accordion-content">
                  <div className="kk-timeline">
                    <div className="kk-tl-step done">
                      <span className="tl-title">1. Pengajuan</span>
                      <span className="tl-meta">Selesai diajukan</span>
                    </div>
                    <div className={`kk-tl-step ${reviewStatus === 'Selesai' ? 'done' : 'now'}`}>
                      <span className="tl-title">2. Review</span>
                      <span className="tl-meta">{reviewStatus}</span>
                    </div>
                    <div className={`kk-tl-step ${isApproved ? 'done' : (isPending ? '' : 'now')}`}>
                      <span className="tl-title">3. {decisionStatus}</span>
                      <span className="tl-meta">{isApproved ? 'ACC Sah' : doc.status}</span>
                    </div>
                    <div className={`kk-tl-step ${isApproved ? 'done' : ''}`}>
                      <span className="tl-title">4. Pengarsipan</span>
                      <span className="tl-meta">{archiveStatus}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Riwayat Jejak Audit */}
            {hasAuditHistory && (
              <div className="prz-accordion-item">
                <button
                  type="button"
                  className="prz-accordion-header"
                  onClick={() => toggleSection('audit')}
                  aria-expanded={expandedSections.audit}
                >
                  <span className="prz-accordion-title">
                    <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--warn)' }} />
                    <span>Riwayat Jejak Audit ({doc.status_history!.length})</span>
                  </span>
                  <i className={`fa-solid fa-chevron-down prz-accordion-arrow ${expandedSections.audit ? 'open' : ''}`} />
                </button>
                {expandedSections.audit && (
                  <div className="prz-accordion-content">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {doc.status_history!.map((h, idx) => (
                        <div key={idx} className="prz-audit-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{h.status}</span>
                            <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                              {h.timestamp ? new Date(h.timestamp).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </div>
                          {h.actor && <div style={{ color: 'var(--muted)', fontSize: '11px' }}>Oleh: {h.actor}</div>}
                          {h.note && <div style={{ color: 'var(--ink-2)', marginTop: '2px' }}>{h.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Accordion 4: Verifikasi & Keabsahan Dokumen */}
            <div className="prz-accordion-item">
              <button
                type="button"
                className="prz-accordion-header"
                onClick={() => toggleSection('verification')}
                aria-expanded={expandedSections.verification}
              >
                <span className="prz-accordion-title">
                  <i className="fa-solid fa-shield-halved" style={{ color: 'var(--b-700)' }} />
                  <span>Keabsahan & QR Verifikasi</span>
                </span>
                <i className={`fa-solid fa-chevron-down prz-accordion-arrow ${expandedSections.verification ? 'open' : ''}`} />
              </button>
              {expandedSections.verification && (
                <div className="prz-accordion-content">
                  {hasOfficialNo ? (
                    <div className="prz-qr-box">
                      <div className="prz-qr-icon-wrap">
                        <RealQrCode payload={buildOfficialDocVerificationUrl(doc.no)} size={112} margin={4}
                          color="#000000" bgColor="#ffffff" ariaLabel={`QR verifikasi surat ${doc.no}`} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ok)', marginBottom: '2px' }}>
                          Verifikasi Dokumen Resmi
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                          Pindai QR code ini untuk memeriksa keabsahan surat nomor <b>{doc.no}</b> pada portal publik.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)' }}>
                            Nomor Surat: {doc.no}
                          </span>
                          <a
                            href={`/verifikasi-surat?nomor=${encodeURIComponent(cleanDocNumber(doc.no))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="prz-btn-open-verification"
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: 'var(--b-600)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>Buka Verifikasi</span>
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10px' }} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="prz-verification-notice">
                      <span style={{ fontSize: '18px' }}>
                        {doc.status === 'Revisi' ? '⚠️' : doc.status === 'Ditolak' ? '❌' : '⏳'}
                      </span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                          {doc.status === 'Revisi'
                            ? 'Dokumen Memerlukan Revisi'
                            : doc.status === 'Ditolak'
                            ? 'Dokumen Ditolak'
                            : 'Menunggu Pengesahan Pimpinan'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          Nomor surat resmi dan QR verifikasi publik hanya diterbitkan untuk dokumen yang telah disetujui.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 5: Riwayat Pemeriksaan Dokumen Publik */}
            <div className="prz-accordion-item">
              <button
                type="button"
                className="prz-accordion-header"
                onClick={() => toggleSection('inspection_logs')}
                aria-expanded={expandedSections.inspection_logs}
              >
                <span className="prz-accordion-title">
                  <i className="fa-solid fa-user-check" style={{ color: 'var(--b-600)' }} />
                  <span>Riwayat Pemeriksaan Dokumen ({Array.isArray((doc.metadata as any)?.verifikasi_logs) ? (doc.metadata as any).verifikasi_logs.length : 0})</span>
                </span>
                <i className={`fa-solid fa-chevron-down prz-accordion-arrow ${expandedSections.inspection_logs ? 'open' : ''}`} />
              </button>
              {expandedSections.inspection_logs && (
                <div className="prz-accordion-content">
                  {Array.isArray((doc.metadata as any)?.verifikasi_logs) && (doc.metadata as any).verifikasi_logs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(doc.metadata as any).verifikasi_logs.map((log: any, idx: number) => {
                        const isSuccess = log.hasil === 'Berhasil' || log.status_dokumen === 'valid';
                        const waktuStr = log.accessed_at || log.waktu || log.metadata?.recorded_at;
                        return (
                          <div key={log.id || idx} className="prz-audit-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                                <i className="fa-solid fa-user-check" style={{ marginRight: '6px', color: 'var(--b-600)' }} />
                                {log.nama_pemeriksa || 'Pemeriksa Terdaftar'}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: isSuccess ? '#ecfdf5' : '#fef2f2',
                                    color: isSuccess ? '#065f46' : '#991b1b',
                                    border: `1px solid ${isSuccess ? '#a7f3d0' : '#fecaca'}`,
                                  }}
                                >
                                  {log.hasil || (isSuccess ? 'Berhasil' : 'Gagal')}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                  {waktuStr ? new Date(waktuStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--ink-2)', marginTop: '4px' }}>
                              <span>Instansi: <strong>{log.instansi || '—'}</strong></span>
                              {log.catatan && (
                                <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
                                  {log.catatan}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                      <i className="fa-regular fa-folder-open" style={{ marginRight: '6px' }} />
                      Belum ada catatan riwayat pemeriksaan publik untuk surat ini.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="kk-drawer-footer">
          {/* Action for Revisi: Resubmit button for applicant */}
          {isRevision && onResubmit && (
            <button
              type="button"
              className="btn pri"
              onClick={() => onResubmit(doc)}
              style={{
                width: '100%',
                minHeight: '40px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: '#d97706',
                borderColor: '#d97706',
              }}
            >
              <i className="fa-solid fa-pen-to-square" style={{ marginRight: '6px' }} />
              Perbaiki & Ajukan Ulang
            </button>
          )}

          {/* Approver actions */}
          {canApprove && (isPending || isRevision) ? (
            <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn pri"
                onClick={() => onApprove(doc.id)}
                style={{ flex: 2, minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)', minWidth: '130px' }}
              >
                <i className="fa-solid fa-check" style={{ marginRight: '6px' }} />
                Setujui Surat
              </button>
              {onRequestRevision && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => onRequestRevision(doc.id)}
                  style={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    color: '#d97706',
                    borderColor: 'rgba(217, 119, 6, 0.4)',
                    minWidth: '100px',
                  }}
                >
                  <i className="fa-solid fa-pen" style={{ marginRight: '4px' }} />
                  Revisi
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => onReject(doc.id)}
                style={{ minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)', color: '#dc2626', minWidth: '80px' }}
              >
                Tolak
              </button>
            </div>
          ) : !isRevision ? (
            <button
              type="button"
              className={`btn block ${hasOfficialNo ? 'pri' : ''}`}
              onClick={handleDownload}
              disabled={!hasOfficialNo || isDownloading}
              style={{
                width: '100%',
                height: '40px',
                minHeight: '40px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`} style={{ marginRight: '6px' }} />
              {isDownloading ? 'Menyiapkan PDF...' : hasOfficialNo ? 'Unduh PDF Resmi' : 'Menunggu Persetujuan'}
            </button>
          ) : null}

          {/* Aksi Arsipkan Surat (Surat Berlaku/Disetujui) */}
          {(canApprove || canManageArchive) && isApproved && onArchive && (
            <button
              type="button"
              className="btn"
              onClick={() => setShowArchiveConfirm(true)}
              style={{
                width: '100%',
                height: '40px',
                minHeight: '40px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontSize: '13px',
                fontWeight: 600,
                color: '#b45309',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                background: 'rgba(254, 243, 199, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fa-solid fa-box-archive" style={{ marginRight: '6px' }} />
              Arsipkan Surat Ini
            </button>
          )}

          {/* Aksi Hapus Surat (Semua status oleh Admin/Eksekutif, atau Draft) */}
          {(canApprove || canManageArchive || isPending) && (
            <button
              type="button"
              className="btn dang"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: '100%',
                height: '40px',
                minHeight: '40px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
              Hapus Surat Secara Permanen
            </button>
          )}

          {/* Modal Konfirmasi Arsipkan */}
          {showArchiveConfirm && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(11, 42, 74, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 100000,
                display: 'grid',
                placeItems: 'center',
                padding: '20px',
              }}
              onClick={() => setShowArchiveConfirm(false)}
            >
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  borderRadius: '20px',
                  padding: '24px',
                  maxWidth: '440px',
                  width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', fontSize: '18px' }}>
                    <i className="fa-solid fa-box-archive" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Arsipkan Surat?</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Nomor: {doc.no || '—'}</span>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 12px' }}>
                  Surat ini akan ditandai sebagai <strong>Diarsipkan / Tidak Berlaku</strong>. Dokumen dan nomor surat tetap tersimpan permanen di arsip sejarah dan <strong>tidak dapat dialokasikan ulang</strong> untuk surat baru.
                </p>
                <input
                  type="text"
                  placeholder="Catatan pengarsipan (opsional)..."
                  value={archiveNote}
                  onChange={(e) => setArchiveNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowArchiveConfirm(false)}
                    style={{ borderRadius: 'var(--ptv-curve-pill)', fontSize: '13px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      onArchive?.(doc.id, archiveNote);
                      setShowArchiveConfirm(false);
                    }}
                    style={{
                      borderRadius: 'var(--ptv-curve-pill)',
                      fontSize: '13px',
                      background: '#d97706',
                      borderColor: '#d97706',
                      color: '#ffffff',
                      fontWeight: 600,
                    }}
                  >
                    Ya, Arsipkan Surat
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Konfirmasi Hapus Permanen */}
          {showDeleteConfirm && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 100000,
                display: 'grid',
                placeItems: 'center',
                padding: '20px',
              }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  borderRadius: '20px',
                  padding: '24px',
                  maxWidth: '460px',
                  width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', fontSize: '19px' }}>
                    <i className="fa-solid fa-triangle-exclamation" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>Hapus Surat Permanen?</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Nomor: {doc.no || 'DRAFT'}</span>
                  </div>
                </div>
                <div style={{ padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3', marginBottom: '14px' }}>
                  <p style={{ fontSize: '12.5px', color: '#9f1239', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    <strong>PERINGATAN RESMI:</strong> Dokumen akan dihapus dari daftar operasional. Nomor surat resmi akan dilepaskan agar dapat digunakan kembali oleh surat baru. Validitas kode QR dan verifikasi publik surat ini akan dinonaktifkan.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Alasan penghapusan (opsional)..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #fca5a5',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ borderRadius: 'var(--ptv-curve-pill)', fontSize: '13px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn dang"
                    onClick={() => {
                      onDelete(doc.id, deleteReason);
                      setShowDeleteConfirm(false);
                    }}
                    style={{ borderRadius: 'var(--ptv-curve-pill)', fontSize: '13px', fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
                    Hapus Surat Permanen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};

