import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { docsStore } from '@products/hub/dokumen-saya/docsStore';
import { PtvDocument } from '@products/hub/dokumen-saya/mock/docsMockData';
import { useCrewStore } from '@products/hub/kru/kruStore';
import { useSessionStore } from '@core/session';
import { DocDetailDrawer } from '@products/hub/dokumen-saya/components/DocDetailDrawer';
import { dokumenService } from '@products/hub/dokumen-saya/dokumenService';
import { AjukanTugasModal } from './components/AjukanTugasModal';
import { AjukanBarangModal } from './components/AjukanBarangModal';
import { PerbaikiPengajuanModal } from './components/PerbaikiPengajuanModal';
import { ReviewActionModal } from './components/ReviewActionModal';
import { CardListSkeleton } from '@/shared/components';
import '@/styles/perizinan.css';
import { loadPerizinan } from './loadPerizinan';

type FilterType = 'Semua' | 'Izin Tugas' | 'Izin Bawa Barang';

export const PerizinanPage: React.FC = () => {
  const { can, user } = useSessionStore();
  const { getCurrentUser } = useCrewStore();
  const currentUser = getCurrentUser();

  const [liveDocs, setLivePerizinanDocs] = useState<PtvDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestRef = useRef<{ id: number; controller?: AbortController }>({ id: 0 });

  const fetchLivePerizinan = useCallback(async () => {
    requestRef.current.controller?.abort();
    const id = ++requestRef.current.id;
    const controller = new AbortController();
    requestRef.current.controller = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await loadPerizinan(controller.signal);
      if (id !== requestRef.current.id || controller.signal.aborted) return;
      setLivePerizinanDocs(res.documents);
      setHasLoaded(true);
      docsStore.setLiveDocs(res.documents);
    } catch (err: any) {
      if (id !== requestRef.current.id || controller.signal.aborted) return;
      setLoadError(err.message || 'Gagal memuat daftar perizinan.');
    } finally {
      if (id === requestRef.current.id && !controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasLoaded(false);
    fetchLivePerizinan();
    return () => { requestRef.current.id++; requestRef.current.controller?.abort(); };
  }, [fetchLivePerizinan, user?.id]);

  // Approver check: capability documents.approve or root executive / eksekutif
  const canApprove =
    can('documents.approve') ||
    Boolean(user?.assigned_profiles?.includes('eksekutif')) ||
    Boolean(user?.assigned_profiles?.includes('root_executive')) ||
    !user;

  // Filter out Izin Santri (handled in Generator Surat Izin)
  const effectiveDocs = liveDocs;
  const perizinanRows = useMemo(() => {
    return effectiveDocs.filter(
      (d) =>
        d.type !== 'Surat Izin' &&
        d.type !== 'Izin Santri' &&
        d.type !== 'Surat Izin Santri' &&
        d.type !== 'Surat Izin Resmi'
    );
  }, [effectiveDocs]);

  // Ownership filtering: Approvers see all, regular crew see documents involving them
  const isUserInDoc = (d: PtvDocument): boolean => {
    if (canApprove) return true;

    const myName = (currentUser.full_name || '').toLowerCase().trim();
    const myUsername = (currentUser.username || '').toLowerCase().trim();

    if (d.owner && (d.owner.toLowerCase() === myName || d.owner.toLowerCase().includes(myName))) return true;
    if (d.pembawa && (d.pembawa.toLowerCase() === myName || d.pembawa.toLowerCase().includes(myName))) return true;
    if (d.penanggung_jawab && (d.penanggung_jawab.toLowerCase() === myName || d.penanggung_jawab.toLowerCase().includes(myName))) return true;
    if (d.diajukan_oleh && (d.diajukan_oleh.toLowerCase() === myName || d.diajukan_oleh.toLowerCase() === myUsername)) return true;

    if (Array.isArray(d.recipients)) {
      return d.recipients.some((r) => {
        const rName = r.toLowerCase().trim();
        return rName === myName || rName.includes(myName) || myName.includes(rName);
      });
    }

    return false;
  };

  const userPerizinanRows = useMemo(() => {
    return perizinanRows.filter(isUserInDoc);
  }, [perizinanRows, canApprove, currentUser]);

  const [activeFilter, setActiveFilter] = useState<FilterType>('Semua');
  const [selectedDoc, setSelectedDoc] = useState<PtvDocument | null>(null);

  // Modals state
  const [isTugasModalOpen, setIsTugasModalOpen] = useState(false);
  const [isBarangModalOpen, setIsBarangModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PtvDocument | null>(null);
  const [reviewActionState, setReviewActionState] = useState<{
    isOpen: boolean;
    type: 'revisi' | 'tolak' | null;
    docId: string | null;
    docTitle: string;
  }>({
    isOpen: false,
    type: null,
    docId: null,
    docTitle: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Counts calculation
  const countSemua = userPerizinanRows.length;
  const countTugas = userPerizinanRows.filter(
    (d) => d.type === 'Surat Tugas' || d.type === 'Surat Tugas Resmi'
  ).length;
  const countBarang = userPerizinanRows.filter(
    (d) => d.type === 'Izin Membawa Barang' || d.type === 'Surat Bawa Barang'
  ).length;

  const pendingCount = useMemo(() => {
    return userPerizinanRows.filter((d) => d.status === 'Menunggu').length;
  }, [userPerizinanRows]);

  const filteredDocs = useMemo(() => {
    let rows = userPerizinanRows;
    if (activeFilter === 'Izin Tugas') {
      rows = rows.filter(
        (d) => d.type === 'Surat Tugas' || d.type === 'Surat Tugas Resmi'
      );
    } else if (activeFilter === 'Izin Bawa Barang') {
      rows = rows.filter(
        (d) => d.type === 'Izin Membawa Barang' || d.type === 'Surat Bawa Barang'
      );
    }
    return [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [userPerizinanRows, activeFilter]);

  // Submission handlers with live persistent backend integration
  const handleCreateTugas = async (data: {
    subject: string;
    event?: string;
    event_id?: string;
    start_date: string;
    end_date: string;
    penanggung_jawab: string;
    recipients: string[];
    notes?: string;
  }) => {
    try {
      const newDoc = await dokumenService.createDocument({
        type: 'Surat Tugas',
        subject: data.subject,
        date: data.start_date,
        start_date: data.start_date,
        end_date: data.end_date,
        pembawa: data.recipients[0] || currentUser.full_name,
        penanggung_jawab: data.penanggung_jawab,
        recipients: data.recipients,
        event: data.event,
        event_id: data.event_id,
        notes: data.notes,
        source: data.event_id ? 'acara' : undefined,
      });

      setLivePerizinanDocs((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      setIsTugasModalOpen(false);
      showToast(`Surat Tugas "${newDoc.subject}" berhasil diajukan.`);
    } catch (err: any) {
      console.error('[handleCreateTugas Error]:', err);
      showToast(`Gagal mengajukan surat tugas: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  const handleCreateBarang = async (data: {
    subject: string;
    event?: string;
    event_id?: string;
    start_date: string;
    end_date: string;
    pembawa: string;
    penanggung_jawab: string;
    items: string[];
    unit_ids: string[];
    notes?: string;
  }) => {
    try {
      const newDoc = await dokumenService.createDocument({
        type: 'Izin Membawa Barang',
        subject: data.subject,
        date: data.start_date,
        start_date: data.start_date,
        end_date: data.end_date,
        pembawa: data.pembawa,
        penanggung_jawab: data.penanggung_jawab,
        items: data.items,
        unit_ids: data.unit_ids,
        recipients: [data.pembawa],
        event: data.event,
        event_id: data.event_id,
        notes: data.notes,
        source: data.event_id ? 'acara' : undefined,
      });

      setLivePerizinanDocs((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      setIsBarangModalOpen(false);
      showToast(`Izin Membawa Barang "${newDoc.subject}" berhasil diajukan.`);
    } catch (err: any) {
      console.error('[handleCreateBarang Error]:', err);
      showToast(`Gagal mengajukan izin bawa barang: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  const handleApprove = async (id: string, note?: string) => {
    try {
      const updated = await dokumenService.updateDocStatus(id, 'disetujui', note);
      setLivePerizinanDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setSelectedDoc(updated);
      showToast(`Surat "${updated.subject}" berhasil disetujui. Nomor resmi: ${updated.no}`);
    } catch (err: any) {
      console.error('[handleApprove Error]:', err);
      showToast(`Gagal menyetujui dokumen: ${err.message || 'Akses ditolak'}`);
    }
  };

  const handleOpenReviewAction = (id: string, type: 'revisi' | 'tolak') => {
    const targetDoc = userPerizinanRows.find((d) => d.id === id);
    if (!targetDoc) return;
    setReviewActionState({
      isOpen: true,
      type,
      docId: id,
      docTitle: targetDoc.subject,
    });
  };

  const handleConfirmReviewAction = async (note: string) => {
    if (!reviewActionState.docId || !reviewActionState.type) return;

    const id = reviewActionState.docId;
    const actionType = reviewActionState.type;
    const statusParam = actionType === 'revisi' ? 'revisi' : 'ditolak';

    try {
      const updated = await dokumenService.updateDocStatus(id, statusParam, note);
      setLivePerizinanDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setSelectedDoc(updated);
      showToast(
        actionType === 'revisi'
          ? `Permintaan revisi berhasil dikirim untuk "${updated.subject}".`
          : `Dokumen "${updated.subject}" ditolak.`
      );
    } catch (err: any) {
      console.error('[handleConfirmReviewAction Error]:', err);
      showToast(`Gagal memperbarui status: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setReviewActionState({ isOpen: false, type: null, docId: null, docTitle: '' });
    }
  };

  const handleResubmit = (docToEdit: PtvDocument) => {
    setSelectedDoc(null);
    setEditingDoc(docToEdit);
  };

  const handleConfirmResubmit = async (id: string, updates: Partial<PtvDocument>) => {
    try {
      const updated = await dokumenService.updateDocStatus(id, 'menunggu', 'Pengajuan diajukan ulang', updates);
      setLivePerizinanDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setEditingDoc(null);
      setSelectedDoc(updated);
      showToast(`Pengajuan "${updated.subject}" telah diperbarui dan diajukan ulang.`);
    } catch (err: any) {
      console.error('[handleConfirmResubmit Error]:', err);
      showToast(`Gagal mengajukan ulang: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dokumenService.deleteDocument(id);
      setLivePerizinanDocs((prev) => prev.filter((d) => d.id !== id));
      showToast('Dokumen perizinan berhasil dihapus.');
      setSelectedDoc(null);
    } catch (err: any) {
      console.error('[handleDelete Error]:', err);
      showToast(`Gagal menghapus dokumen: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  return (
    <div className="prz-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--ink, #0b2a4a)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--ptv-curve-pill, 9999px)',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: '#4ade80' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {loadError && !isLoading && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--ptv-curve-sm)',
            padding: '12px 16px',
            marginBottom: '16px',
            color: 'var(--ink)',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span role="alert">
            <strong>Gagal memuat perizinan</strong><br />
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }} />
            {loadError}
          </span>
          <button
            type="button"
            onClick={fetchLivePerizinan}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--ptv-curve-xs)',
              padding: '8px 14px',
              minHeight: '44px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Header Halaman (R03 Consistent Context) */}
      <div className="prz-page-header">
        <div>
          <h1 className="prz-page-title">Pengajuan Perizinan</h1>
          <p className="prz-page-subtitle">
            Pusat pengajuan izin penugasan liputan kru, izin bawa peralatan studio, dan pemantauan status pengesahan
          </p>
        </div>
      </div>

      {/* Two Bento CTA Cards */}
      <div className="prz-bento-grid">
        <button
          type="button"
          className="prz-bento-card tugas"
          onClick={() => setIsTugasModalOpen(true)}
          title="Ajukan Izin Tugas Baru"
        >
          <span className="prz-bento-ic blue">
            <i className="fa-solid fa-file-signature" />
          </span>
          <span className="prz-bento-body">
            <span className="prz-bento-title">Izin Tugas</span>
            <span className="prz-bento-desc">Permohonan penugasan liputan kru</span>
          </span>
          <i className="fa-solid fa-chevron-right prz-bento-arrow" />
        </button>

        <button
          type="button"
          className="prz-bento-card barang"
          onClick={() => setIsBarangModalOpen(true)}
          title="Ajukan Izin Bawa Barang Baru"
        >
          <span className="prz-bento-ic purple">
            <i className="fa-solid fa-boxes-packing" />
          </span>
          <span className="prz-bento-body">
            <span className="prz-bento-title">Izin Bawa Barang</span>
            <span className="prz-bento-desc">Izin membawa inventaris keluar</span>
          </span>
          <i className="fa-solid fa-chevron-right prz-bento-arrow" />
        </button>
      </div>

      {/* Review Summary Banner for Approvers */}
      {canApprove && !isLoading && !loadError && pendingCount > 0 && (
        <div className="prz-summary-banner">
          <span className="prz-summary-ic">
            <i className="fa-solid fa-circle-info" />
          </span>
          <p className="prz-summary-text">
            {pendingCount} pengajuan perizinan menunggu review dan pengesahan kamu.
          </p>
        </div>
      )}

      {/* Filter Chips Bar & Refresh Action */}
      <div className="prz-filters-bar">
        <div className="prz-filters-track">
          {(
            [
              ['Semua', countSemua],
              ['Izin Tugas', countTugas],
              ['Izin Bawa Barang', countBarang],
            ] as const
          ).map(([label, cnt]) => {
            const isActive = activeFilter === label;
            return (
              <button
                key={label}
                type="button"
                className={`prz-filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => setActiveFilter(label as FilterType)}
              >
                <span>{label}</span>
                <span className="prz-chip-count" aria-label={isLoading || loadError || !hasLoaded ? 'Jumlah belum tersedia' : undefined}>
                  {isLoading || loadError || !hasLoaded ? '—' : cnt}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="prz-refresh-btn"
          onClick={fetchLivePerizinan}
          disabled={isLoading}
          title="Segarkan daftar perizinan"
        >
          <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`} style={{ fontSize: '11.5px' }} />
          <span className="only-desktop">Segarkan</span>
        </button>
      </div>

      {/* Document Grid */}
      {isLoading && liveDocs.length === 0 ? (
        <CardListSkeleton count={4} />
      ) : loadError ? null : filteredDocs.length > 0 ? (
        <div className="prz-doc-grid">
          {filteredDocs.map((doc) => {
            const isBarang =
              doc.type === 'Izin Membawa Barang' || doc.type === 'Surat Bawa Barang';

            const isApproved = doc.status === 'Disetujui';
            const isRevision = doc.status === 'Revisi';
            const isRejected = doc.status === 'Ditolak';

            const statusClass = isApproved
              ? 'approved'
              : isRevision
              ? 'revision'
              : isRejected
              ? 'rejected'
              : 'pending';

            const statusIcon = isApproved
              ? 'fa-solid fa-circle-check'
              : isRevision
              ? 'fa-solid fa-pen-to-square'
              : isRejected
              ? 'fa-solid fa-circle-xmark'
              : 'fa-regular fa-clock';

            const crewCount = doc.recipients?.length || 0;
            const unitCount = doc.unit_ids?.length || (doc.items?.length || 0);

            return (
              <div
                key={doc.id}
                className="prz-doc-card"
                onClick={() => setSelectedDoc(doc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDoc(doc);
                  }
                }}
              >
                {/* Category Icon */}
                <div className={`prz-cat-icon ${isBarang ? 'barang' : 'tugas'}`}>
                  <i
                    className={isBarang ? 'fa-solid fa-boxes-packing' : 'fa-solid fa-file-signature'}
                  />
                </div>

                {/* Card Main Area */}
                <div className="prz-card-main">
                  {/* Top: Category Tag + Status Badge */}
                  <div className="prz-card-top">
                    <span className={`prz-card-type-tag ${isBarang ? 'barang' : 'tugas'}`}>
                      {isBarang ? 'Izin Bawa Barang' : 'Izin Tugas'}
                    </span>
                    <span className={`prz-status-badge ${statusClass}`}>
                      <i className={statusIcon} style={{ fontSize: '9px' }} />
                      <span>{doc.status}</span>
                    </span>
                  </div>

                  {/* Title / Perihal */}
                  <h3 className="prz-card-title" title={doc.subject}>
                    {doc.subject}
                  </h3>

                  {/* Secondary Info: Tanggal · Pemohon */}
                  <div className="prz-card-meta">
                    <span>{doc.date}</span>
                    <span>&middot;</span>
                    <span>{doc.owner}</span>
                  </div>

                  {/* Bottom: Summary Count Metric + Revision Hint + Chevron */}
                  <div className="prz-card-bottom">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {isBarang ? (
                        <span className="prz-card-metric purple">
                          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '10px' }} />
                          <span>{unitCount} unit peralatan</span>
                        </span>
                      ) : (
                        <span className="prz-card-metric blue">
                          <i className="fa-solid fa-users" style={{ fontSize: '10px' }} />
                          <span>{crewCount} kru ditugaskan</span>
                        </span>
                      )}

                      {isRevision && (
                        <span className="prz-card-revision-pill" title="Terdapat catatan perbaikan dari pimpinan">
                          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '9.5px' }} />
                          <span>Perlu Revisi</span>
                        </span>
                      )}
                    </div>

                    <i className="fa-solid fa-chevron-right prz-card-chevron" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line-2, #e2e8f0)',
            borderRadius: 'var(--r-xl, 20px)',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--muted, #64748b)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--bg-2, #f1f5f9)',
              color: 'var(--ink-3, #94a3b8)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px',
              fontSize: '22px',
            }}
          >
            <i className="fa-solid fa-folder-open" />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
            {activeFilter === 'Semua' ? 'Belum ada perizinan' : `Belum ada ${activeFilter.toLowerCase()}`}
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
            {activeFilter === 'Semua'
              ? 'Pengajuan izin tugas dan izin membawa barang akan muncul di sini.'
              : `Tidak ada perizinan di kategori ${activeFilter}.`}
          </p>
        </div>
      )}

      {/* Detail Drawer */}
      <DocDetailDrawer
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        canApprove={canApprove}
        onApprove={(id) => handleApprove(id)}
        onRequestRevision={(id) => handleOpenReviewAction(id, 'revisi')}
        onReject={(id) => handleOpenReviewAction(id, 'tolak')}
        onResubmit={handleResubmit}
        onDelete={handleDelete}
      />

      {/* Ajukan Tugas Modal */}
      <AjukanTugasModal
        isOpen={isTugasModalOpen}
        onClose={() => setIsTugasModalOpen(false)}
        onSubmit={handleCreateTugas}
      />

      {/* Ajukan Barang Modal */}
      <AjukanBarangModal
        isOpen={isBarangModalOpen}
        onClose={() => setIsBarangModalOpen(false)}
        onSubmit={handleCreateBarang}
      />

      {/* Perbaiki Pengajuan Modal */}
      <PerbaikiPengajuanModal
        doc={editingDoc}
        isOpen={Boolean(editingDoc)}
        onClose={() => setEditingDoc(null)}
        onSubmit={handleConfirmResubmit}
      />

      {/* Review Action Modal (Mandatory Note for Revision & Rejection) */}
      <ReviewActionModal
        isOpen={reviewActionState.isOpen}
        actionType={reviewActionState.type}
        docTitle={reviewActionState.docTitle}
        onClose={() => setReviewActionState({ isOpen: false, type: null, docId: null, docTitle: '' })}
        onConfirm={handleConfirmReviewAction}
      />
    </div>
  );
};
