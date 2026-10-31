import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ItemInventaris } from '../types';
import { resolveInventoryPhotoUrl } from '../utils/inventoryPhotoUtils';
import {
  inventorySafetyCheckService,
  InventorySafetyCheckReport,
} from '../services/inventorySafetyCheckService';
import { inventarisService } from '../inventarisService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface SmartDeleteInventarisModalProps {
  isOpen: boolean;
  asset: ItemInventaris;
  onClose: () => void;
  onSuccess: () => void;
}

export const SmartDeleteInventarisModal: React.FC<SmartDeleteInventarisModalProps> = ({
  isOpen,
  asset,
  onClose,
  onSuccess,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'smart-delete-inventaris-modal',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<InventorySafetyCheckReport | null>(null);

  // Form state for Condition A
  const [reason, setReason] = useState<'Duplikat' | 'Kesalahan Input' | 'Lainnya'>('Duplikat');
  const [otherReason, setOtherReason] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Run safety check on open or asset change
  useEffect(() => {
    if (!isOpen) {
      setLoading(true);
      setError(null);
      setReport(null);
      setConfirmationCode('');
      setDeleteError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    inventorySafetyCheckService
      .inspectAssetSafety(asset)
      .then((rep) => {
        if (isMounted) {
          setReport(rep);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Pemeriksaan keamanan integritas data gagal.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, asset]);

  if (!isOpen) return null;

  const totalUnits = asset.units?.length || asset.total_unit || 1;
  const resolvedPhoto = resolveInventoryPhotoUrl(asset.foto_url);

  const isExactCodeMatched = confirmationCode.trim() === asset.kode.trim();
  const isReasonValid = reason !== 'Lainnya' || otherReason.trim().length > 0;
  const isConditionAValid = report?.condition === 'A' && isExactCodeMatched && isReasonValid;

  const handleExecuteDelete = async () => {
    if (!isConditionAValid) return;

    setIsDeleting(true);
    setDeleteError(null);

    const fullReason = reason === 'Lainnya' ? `Lainnya: ${otherReason.trim()}` : reason;

    try {
      await inventarisService.deleteInventaris(asset.id, fullReason);
      setIsDeleting(false);
      onSuccess();
    } catch (err: any) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Gagal menghapus data inventaris.');
    }
  };

  return createPortal(
    <div className="sdel-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sdelModalTitle">
      <div className="sdel-modal-backdrop" onClick={onClose} />
      <div ref={modalRef} className="sdel-modal-card">
        {/* Modal Header */}
        <div className="sdel-modal-header">
          <div className="sdel-modal-header-icon">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div className="sdel-modal-header-text">
            <h3 id="sdelModalTitle" className="sdel-modal-title">Hapus / Arsipkan Inventaris</h3>
            <p className="sdel-modal-sub">
              Pemeriksaan keamanan relasi, sirkulasi peminjaman, dan integritas data
            </p>
          </div>
          <button
            type="button"
            className="sdel-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup Modal"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="sdel-modal-body">
          {/* 1. Asset Identity Card */}
          <div className="sdel-asset-identity-card">
            <div className="sdel-asset-thumb">
              {resolvedPhoto ? (
                <img src={resolvedPhoto} alt={asset.nama_alat} />
              ) : (
                <div className="sdel-asset-thumb-fallback">
                  <i className="fa-solid fa-box" />
                </div>
              )}
            </div>
            <div className="sdel-asset-info">
              <div className="sdel-asset-tags">
                <span className="sdel-chip code">{asset.kode}</span>
                <span className="sdel-chip cat">{asset.kategori}</span>
                <span className="sdel-chip units">{totalUnits} Unit Fisik</span>
              </div>
              <h4 className="sdel-asset-name">{asset.nama_alat}</h4>
              <p className="sdel-asset-sub">
                Lokasi: {asset.units[0]?.lokasi_penyimpanan || asset.lokasi_penyimpanan || 'Studio PTV'} &bull; Sumber: {asset.sumber_perolehan || 'Yayasan'}
              </p>
            </div>
          </div>

          {/* 2. Automated Safety Inspection Section */}
          <div className="sdel-section-title-wrap">
            <i className="fa-solid fa-microscope" />
            <span>Hasil Pemeriksaan Otomatis Keamanan Data</span>
          </div>

          {loading ? (
            <div className="sdel-loading-box">
              <i className="fa-solid fa-circle-notch fa-spin" />
              <div className="sdel-loading-text">
                <h5>Memeriksa Keterkaitan Relasi &amp; Dependensi Aset...</h5>
                <p>Memvalidasi status sirkulasi peminjaman, log kerusakan fisik, arsip surat izin, dan buku valuasi akuntansi.</p>
              </div>
            </div>
          ) : error ? (
            <div className="sdel-error-box">
              <div className="sdel-error-content">
                <i className="fa-solid fa-triangle-exclamation" />
                <div>
                  <h5>Pemeriksaan Keamanan Gagal (Fail-Closed)</h5>
                  <p>{error}</p>
                  <p className="sdel-fail-closed-notice">
                    Demi melindungi integritas data, seluruh tindakan destruktif diblokir secara otomatis ketika verifikasi tidak lengkap.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="sdel-btn-retry"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  inventorySafetyCheckService
                    .inspectAssetSafety(asset)
                    .then((rep) => {
                      setReport(rep);
                      setLoading(false);
                    })
                    .catch((err: any) => {
                      setError(err.message || 'Pemeriksaan gagal.');
                      setLoading(false);
                    });
                }}
              >
                <i className="fa-solid fa-rotate-right" /> Coba Periksa Ulang
              </button>
            </div>
          ) : report ? (
            <>
              {/* Inspection Matrix Grid */}
              <div className="sdel-matrix-grid">
                <div className={`sdel-matrix-item ${report.borrowedUnits > 0 ? 'is-danger' : 'is-ok'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Unit Fisik</span>
                    <i className={`fa-solid ${report.borrowedUnits > 0 ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.availableUnits}/{report.totalUnits} Tersedia
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.borrowedUnits > 0 ? `${report.borrowedUnits} unit berstatus dipinjam` : 'Semua unit bebas'}
                  </div>
                </div>

                <div className={`sdel-matrix-item ${report.activeLoans.length > 0 ? 'is-danger' : 'is-ok'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Peminjaman Aktif</span>
                    <i className={`fa-solid ${report.activeLoans.length > 0 ? 'fa-hand-holding' : 'fa-circle-check'}`} />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.activeLoans.length} Sirkulasi Aktif
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.activeLoans.length > 0 ? 'Belum dikembalikan' : 'Nihil transaksi berjalan'}
                  </div>
                </div>

                <div className={`sdel-matrix-item ${report.historicalLoans.length > 0 ? 'is-info' : 'is-muted'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Riwayat Peminjaman</span>
                    <i className="fa-solid fa-clock-rotate-left" />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.historicalLoans.length} Transaksi Selesai
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.historicalLoans.length > 0 ? 'Memiliki jejak histori' : 'Belum pernah dipinjam'}
                  </div>
                </div>

                <div className={`sdel-matrix-item ${report.activeDamageReports.length > 0 ? 'is-danger' : 'is-ok'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Laporan Kerusakan</span>
                    <i className={`fa-solid ${report.activeDamageReports.length > 0 ? 'fa-wrench' : 'fa-circle-check'}`} />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.activeDamageReports.length} Laporan Aktif
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.activeDamageReports.length > 0 ? 'Sedang dalam penanganan QC' : `${report.historicalDamageReports.length} riwayat selesai`}
                  </div>
                </div>

                <div className={`sdel-matrix-item ${report.activeDocuments.length > 0 ? 'is-danger' : 'is-ok'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Surat &amp; Dokumen</span>
                    <i className={`fa-solid ${report.activeDocuments.length > 0 ? 'fa-file-signature' : 'fa-circle-check'}`} />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.activeDocuments.length} Pengajuan Aktif
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.activeDocuments.length > 0 ? 'Menunggu persetujuan dinas' : `${report.relatedDocuments.length} arsip surat dinas`}
                  </div>
                </div>

                <div className={`sdel-matrix-item ${report.hasValuationRecord ? 'is-info' : 'is-muted'}`}>
                  <div className="sdel-matrix-head">
                    <span className="sdel-matrix-label">Nilai Akuntansi</span>
                    <i className="fa-solid fa-file-invoice-dollar" />
                  </div>
                  <div className="sdel-matrix-val">
                    {report.hasValuationRecord ? `Rp ${report.valuationAmount.toLocaleString('id-ID')}` : 'Belum Dicatat'}
                  </div>
                  <div className="sdel-matrix-sub">
                    {report.hasValuationRecord ? 'Buku aset yayasan' : 'Nihil nilai tercatat'}
                  </div>
                </div>
              </div>

              {/* 3. Condition-Specific Assessment & Actions */}
              {report.condition === 'C' && (
                <div className="sdel-cond-panel cond-c">
                  <div className="sdel-cond-head">
                    <div className="sdel-cond-icon">
                      <i className="fa-solid fa-ban" />
                    </div>
                    <div>
                      <h4 className="sdel-cond-title">{report.summaryHeading}</h4>
                      <p className="sdel-cond-desc">{report.summaryMessage}</p>
                    </div>
                  </div>

                  <div className="sdel-blockers-list">
                    <h5 className="sdel-blockers-title">Aktivitas yang Wajib Diselesaikan Terlebih Dahulu:</h5>
                    {report.activeBlockers.map((b, idx) => (
                      <div key={idx} className="sdel-blocker-row">
                        <i className="fa-solid fa-circle-exclamation" />
                        <div>
                          <strong>{b.title}</strong>
                          <p>{b.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sdel-guidance-box">
                    <i className="fa-solid fa-circle-info" />
                    <span>{report.resolutionGuidance}</span>
                  </div>
                </div>
              )}

              {report.condition === 'B' && (
                <div className="sdel-cond-panel cond-b">
                  <div className="sdel-cond-head">
                    <div className="sdel-cond-icon">
                      <i className="fa-solid fa-box-archive" />
                    </div>
                    <div>
                      <h4 className="sdel-cond-title">{report.summaryHeading}</h4>
                      <p className="sdel-cond-desc">{report.summaryMessage}</p>
                    </div>
                  </div>

                  <div className="sdel-archive-recommendation">
                    <h5 className="sdel-rec-title">
                      <i className="fa-solid fa-lightbulb" /> Rekomendasi Solusi: Arsipkan Inventaris
                    </h5>
                    <p className="sdel-rec-body">
                      Dengan mengarsipkan alat ini:
                    </p>
                    <ul className="sdel-rec-points">
                      <li>
                        <i className="fa-solid fa-check" />
                        <span>Aset disembunyikan dari katalog aktif operasional kru sehari-hari.</span>
                      </li>
                      <li>
                        <i className="fa-solid fa-check" />
                        <span>Identitas fisik alat, kode barcode unit, dan nomor seri tetap tersimpan aman.</span>
                      </li>
                      <li>
                        <i className="fa-solid fa-check" />
                        <span>Seluruh jejak histori transaksi peminjaman, surat dinas, dan nilai valuasi tetap terjaga untuk audit.</span>
                      </li>
                      <li>
                        <i className="fa-solid fa-check" />
                        <span>Aset dapat dipulihkan kembali ke katalog aktif oleh akun pengelola berwenang.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Backend Readiness Notice */}
                  <div className="sdel-backend-notice">
                    <div className="sdel-backend-notice-icon">
                      <i className="fa-solid fa-code-branch" />
                    </div>
                    <div className="sdel-backend-notice-text">
                      <strong>Status Kesiapan Backend Schema (Supabase)</strong>
                      <p>
                        Skema tabel database <code>ptv_inventaris</code> saat ini belum memiliki kolom status arsip (misalnya: <code>is_archived BOOLEAN DEFAULT FALSE</code>). Sesuai aturan operasional, tombol pengarsipan dinonaktifkan secara aman dan kebutuhan migrasi dilaporkan untuk persetujuan operator.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {report.condition === 'A' && (
                <div className="sdel-cond-panel cond-a">
                  <div className="sdel-cond-head">
                    <div className="sdel-cond-icon">
                      <i className="fa-solid fa-circle-check" />
                    </div>
                    <div>
                      <h4 className="sdel-cond-title">{report.summaryHeading}</h4>
                      <p className="sdel-cond-desc">{report.summaryMessage}</p>
                    </div>
                  </div>

                  {/* Confirmation Input Form */}
                  <div className="sdel-confirm-form">
                    <div className="sdel-form-field">
                      <label htmlFor="sdelReasonSelect">Alasan Penghapusan Aset <span className="req">*</span></label>
                      <select
                        id="sdelReasonSelect"
                        className="sdel-select"
                        value={reason}
                        onChange={(e) => setReason(e.target.value as any)}
                      >
                        <option value="Duplikat">Data Terdaftar Ganda / Duplikat</option>
                        <option value="Kesalahan Input">Kesalahan Input Saat Pendaftaran Baru</option>
                        <option value="Lainnya">Alasan Administratif Lainnya</option>
                      </select>
                    </div>

                    {reason === 'Lainnya' && (
                      <div className="sdel-form-field">
                        <label htmlFor="sdelOtherReason">Rincian Alasan Tambahan <span className="req">*</span></label>
                        <textarea
                          id="sdelOtherReason"
                          className="sdel-textarea"
                          rows={2}
                          placeholder="Jelaskan alasan administratif penghapusan aset ini..."
                          value={otherReason}
                          onChange={(e) => setOtherReason(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="sdel-form-field">
                      <label htmlFor="sdelCodeInput">
                        Ketik Kode Inventaris <code className="sdel-code-badge">{asset.kode}</code> untuk Konfirmasi:
                      </label>
                      <input
                        id="sdelCodeInput"
                        type="text"
                        className={`sdel-input ${isExactCodeMatched ? 'is-valid' : confirmationCode ? 'is-invalid' : ''}`}
                        placeholder={`Ketik "${asset.kode}" secara persis`}
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value)}
                        autoComplete="off"
                        spellCheck="false"
                      />
                      {confirmationCode && (
                        <div className={`sdel-code-hint ${isExactCodeMatched ? 'match' : 'mismatch'}`}>
                          <i className={`fa-solid ${isExactCodeMatched ? 'fa-check' : 'fa-xmark'}`} />
                          <span>
                            {isExactCodeMatched
                              ? 'Kode inventaris cocok secara persis.'
                              : 'Kode inventaris belum cocok. Penulisan peka huruf besar/kecil (case-sensitive).'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="sdel-danger-warning-banner">
                      <i className="fa-solid fa-triangle-exclamation" />
                      <div>
                        <strong>Peringatan Tindakan Permanen:</strong>
                        <p>
                          Tindakan ini tidak dapat dibatalkan. Seluruh data master aset dan {totalUnits} unit fisik terkait akan dihapus secara permanen dari basis data.
                        </p>
                      </div>
                    </div>

                    {deleteError && (
                      <div className="sdel-error-alert">
                        <i className="fa-solid fa-circle-exclamation" />
                        <span>{deleteError}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="sdel-modal-footer">
          <button
            type="button"
            className="sdel-btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Batal
          </button>

          {report?.condition === 'C' && (
            <button
              type="button"
              className="sdel-btn-action is-blocked"
              disabled
              title="Aset memiliki aktivitas peminjaman atau penanganan aktif yang wajib diselesaikan terlebih dahulu"
            >
              <i className="fa-solid fa-ban" />
              <span>Aksi Diblokir (Selesaikan Aktivitas Aktif)</span>
            </button>
          )}

          {report?.condition === 'B' && (
            <button
              type="button"
              className="sdel-btn-action is-archive-disabled"
              disabled
              title="Memerlukan migrasi penambahan kolom status arsip di Supabase sebelum dapat dieksekusi"
            >
              <i className="fa-solid fa-box-archive" />
              <span>Arsipkan Inventaris (Menunggu Migrasi Schema)</span>
            </button>
          )}

          {report?.condition === 'A' && (
            <button
              type="button"
              id="btnConfirmHardDelete"
              className={`sdel-btn-action is-danger ${!isConditionAValid || isDeleting ? 'is-disabled' : ''}`}
              disabled={!isConditionAValid || isDeleting}
              onClick={handleExecuteDelete}
            >
              {isDeleting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  <span>Memproses Penghapusan...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash-can" />
                  <span>Hapus Inventaris Permanen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
