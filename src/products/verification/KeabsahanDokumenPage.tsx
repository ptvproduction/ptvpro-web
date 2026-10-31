import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { cleanDocNumber } from './verificationService';
import {
  verifyDocumentOnServer,
  unlockSantriListOnServer,
  DocumentVerificationDetails,
  DocumentVerificationLogItem,
  ReviewerUnlockResponse,
  VALID_INSTANSI_LIST,
  ValidInstansi,
} from './publicDocumentService';
import { LivingHeader } from '../living-portal/components/LivingHeader';
import { LauncherFooter } from '../living-portal/components/LauncherFooter';
import { HelpDialogModal } from '../living-portal/components/HelpDialogModal';
import { portalManagementService } from '../hub/portal-management/services/portalManagementService';
import { PortalSettings } from '../hub/portal-management/types';
import '../living-portal/styles/livingPortal.css';
import '@/styles/publicVerification.css';

export function KeabsahanDokumenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Ambil nomor surat dan query params dari URL (?nomor= atau ?q= atau path splat, serta id/token)
  const { activeNomor, activeId, activeToken } = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const qNomor = searchParams.get('nomor') || searchParams.get('q');
    const qId = searchParams.get('id') || undefined;
    const qToken = searchParams.get('token') || undefined;
    let clean = '';
    if (qNomor) clean = cleanDocNumber(qNomor.trim());
    else {
      const pathSplat = params['*'];
      if (pathSplat) clean = cleanDocNumber(pathSplat.trim());
    }
    return { activeNomor: clean, activeId: qId, activeToken: qToken };
  }, [location.search, params]);

  const [inputVal, setInputVal] = useState(activeNomor);
  const [result, setResult] = useState<DocumentVerificationDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);

  // Santri Privacy Gate State
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerInstansi, setReviewerInstansi] = useState<ValidInstansi>('PTV');
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockedData, setUnlockedData] = useState<ReviewerUnlockResponse | null>(null);
  const [historyLogs, setHistoryLogs] = useState<DocumentVerificationLogItem[]>([]);

  useEffect(() => {
    // Sinkronkan class root
    document.documentElement.classList.add('living-portal-active');
    document.body.classList.add('living-portal-active');

    // Title browser
    document.title = 'Keabsahan Dokumen Resmi — Progresif TV';

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Load portal settings untuk footer & helpdesk
    portalManagementService.getPublicPortalData().then((data) => {
      if (data?.settings) setPortalSettings(data.settings);
    }).catch(() => {});

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.documentElement.classList.remove('living-portal-active');
      document.body.classList.remove('living-portal-active');
    };
  }, []);

  useEffect(() => {
    setInputVal(activeNomor);
    setResult(null);
    setError('');
    setUnlockedData(null);
    setUnlockError('');
    setHistoryLogs([]);

    if (!activeNomor) return;

    const controller = new AbortController();
    setLoading(true);

    verifyDocumentOnServer(activeNomor, activeId, activeToken, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
          setHistoryLogs(data.riwayat_pemeriksaan || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Verifikasi server belum dapat dipastikan. Silakan coba lagi.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeNomor, activeId, activeToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanDocNumber(inputVal.trim());
    if (!clean) {
      navigate('/keabsahan-dokumen');
      return;
    }
    navigate(`/keabsahan-dokumen?nomor=${encodeURIComponent(clean)}`);
  };

  const handleUnlockSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result?.nomor_surat) return;
    if (!reviewerName.trim() || reviewerName.trim().length < 2) {
      setUnlockError('Nama lengkap pemeriksa wajib diisi (minimal 2 karakter).');
      return;
    }

    setUnlockLoading(true);
    setUnlockError('');
    try {
      const res = await unlockSantriListOnServer(result.nomor_surat, reviewerName.trim(), reviewerInstansi);
      setUnlockedData(res);
      if ((res as any).riwayat_pemeriksaan_item) {
        const newItem = (res as any).riwayat_pemeriksaan_item;
        setHistoryLogs((prev) => [newItem, ...prev.filter((p) => p.id !== newItem.id)]);
      } else if (res.riwayat_pemeriksaan && Array.isArray(res.riwayat_pemeriksaan)) {
        setHistoryLogs(res.riwayat_pemeriksaan);
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Gagal membuka rincian santri.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const formatDateIndo = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTimeIndo = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return `${date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="pub-living-wrapper">
      {/* Official Living Header */}
      <LivingHeader
        isScrolled={isScrolled}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <main className="pub-living-main">
        {/* Formal Hero Header */}
        <section className="pub-formal-hero">
          <div className="pub-formal-eyebrow">
            <i className="fa-solid fa-stamp" />
            Lembaga Pers &amp; Penyiaran Santri · Progresif TV
          </div>
          <h1 className="pub-formal-title">Keabsahan Dokumen Resmi</h1>
          <p className="pub-formal-desc">
            Pusat verifikasi legalitas nomor surat dinas, surat izin santri, penugasan kru, dan peminjaman inventaris resmi Pesantren Progresif Bumi Shalawat.
          </p>
        </section>

        {/* Formal Search Bar */}
        <section className="pub-formal-search-card">
          <label htmlFor="searchDocInput" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#64748b' }} />
            Masukkan Nomor Surat Resmi
          </label>
          <form onSubmit={handleSearchSubmit} className="pub-formal-search-form">
            <input
              id="searchDocInput"
              type="text"
              className="pub-formal-input"
              placeholder="Contoh: 001/SI-PTV/X/2026 atau 002/ST-PTV/X/2026..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="pub-formal-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-shield-check" />
                  <span>Verifikasi Dokumen</span>
                </>
              )}
            </button>
          </form>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            * Nomor surat tertera pada kop surat resmi, tepat di bawah judul dokumen atau pada label kode QR.
          </span>
        </section>

        {/* Verification Result Area */}
        {loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '28px', color: '#1273e6', marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Memeriksa Basis Data Server</h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>Menghubungkan ke pangkalan data terverifikasi Progresif TV...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', textAlign: 'center' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '28px', color: '#dc2626', marginBottom: '10px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#991b1b' }}>Verifikasi Belum Dapat Dilakukan</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#7f1d1d' }}>{error}</p>
            <button
              type="button"
              className="pub-formal-submit-btn"
              onClick={() => navigate(0)}
              style={{ margin: '0 auto' }}
            >
              <i className="fa-solid fa-arrows-rotate" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {!loading && !error && result && (
          !result.found ? (
            <div className="pub-doc-result-card" style={{ padding: '48px 24px', textAlign: 'center', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '14px' }}>
                <i className="fa-solid fa-file-circle-xmark" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>
                Dokumen Tidak Terdaftar
              </h2>
              <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#64748b', maxWidth: '480px', lineHeight: 1.5 }}>
                Nomor surat <code style={{ fontWeight: 700, color: '#0f172a' }}>{result.nomor_surat || activeNomor}</code> tidak ditemukan dalam pangkalan data resmi Progresif TV.
              </p>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', maxWidth: '460px' }}>
                Pastikan nomor surat dimasukkan secara lengkap beserta kode divisi dan tahun. Jika Anda memegang dokumen fisik dengan nomor ini, hubungi kontak resmi sekretariat PTV.
              </p>
            </div>
          ) : (
            <div className="pub-doc-result-card">
              {/* Status Header */}
              <div className={`pub-status-header ${result.status || 'valid'}`}>
                <div className="pub-status-big-icon">
                  {result.status === 'valid' && <i className="fa-solid fa-circle-check" />}
                  {result.status === 'kedaluwarsa' && <i className="fa-solid fa-clock-rotate-left" />}
                  {result.status === 'tidak_valid' && <i className="fa-solid fa-circle-xmark" />}
                  {result.status === 'menunggu' && <i className="fa-solid fa-hourglass-half" />}
                </div>

                <h2 className="pub-status-badge-title">
                  {result.status === 'valid' && 'DOKUMEN VALID & TERDAFTAR'}
                  {result.status === 'kedaluwarsa' && 'MASA BERLAKU TELAH BERAKHIR (KEDALUWARSA)'}
                  {result.status === 'tidak_valid' && (
                    result.raw_status === 'diarsipkan'
                      ? 'DOKUMEN DIARSIPKAN (TIDAK BERLAKU)'
                      : 'DOKUMEN TIDAK BERLAKU / DIBATALKAN'
                  )}
                  {result.status === 'menunggu' && 'DOKUMEN MENUNGGU PENGESAHAN'}
                </h2>

                <p className="pub-status-subtitle">
                  {result.status === 'valid' && 'Dokumen dinas ini terverifikasi secara langsung dan berstatus aktif tercatat dalam sistem Progresif TV.'}
                  {result.status === 'kedaluwarsa' && 'Dokumen ini resmi saat diterbitkan, namun masa tanggal izin telah melewati batas berakhir yang ditentukan.'}
                  {result.status === 'tidak_valid' && (
                    result.raw_status === 'diarsipkan'
                      ? 'Dokumen ini tercatat dalam repositori arsip resmi namun telah berstatus diarsipkan dan tidak lagi berlaku sebagai izin operasional aktif.'
                      : 'Dokumen ini telah dicabut, ditolak, atau dibatalkan keabsahannya oleh pihak yang berwenang.'
                  )}
                  {result.status === 'menunggu' && 'Dokumen masih dalam antrean persetujuan dan belum dapat digunakan sebagai izin aktif.'}
                </p>
              </div>

              {/* Metadata Details Grid */}
              <div className="pub-meta-details-wrap">
                <div className="pub-meta-grid">
                  <div className="pub-meta-item">
                    <span className="pub-meta-label">Nomor Dokumen Resmi</span>
                    <span className="pub-meta-val" style={{ fontFamily: 'monospace', color: '#0B2A4A' }}>
                      {result.nomor_surat}
                    </span>
                  </div>

                  <div className="pub-meta-item">
                    <span className="pub-meta-label">Jenis Dokumen</span>
                    <span className="pub-meta-val">{result.jenis_surat || 'Surat Dinas Resmi'}</span>
                  </div>

                  <div className="pub-meta-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="pub-meta-label">Perihal / Keperluan</span>
                    <span className="pub-meta-val" style={{ fontWeight: 600 }}>{result.perihal || '—'}</span>
                  </div>

                  <div className="pub-meta-item">
                    <span className="pub-meta-label">Tanggal Penerbitan Dokumen</span>
                    <span className="pub-meta-val">{formatDateIndo(result.tanggal_terbit)}</span>
                  </div>

                  <div className="pub-meta-item">
                    <span className="pub-meta-label">Masa Berlaku Izin / Kegiatan</span>
                    <span className="pub-meta-val">
                      {result.tanggal_mulai && result.tanggal_selesai
                        ? `${formatDateIndo(result.tanggal_mulai)} s/d ${formatDateIndo(result.tanggal_selesai)}`
                        : result.tanggal_mulai
                        ? formatDateIndo(result.tanggal_mulai)
                        : '—'}
                    </span>
                  </div>

                  <div className="pub-meta-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="pub-meta-label">Pihak Penerbit / Penanggung Jawab</span>
                    <span className="pub-meta-val">{result.penanggung_jawab || 'Pimpinan Eksekutif PTV'}</span>
                  </div>
                </div>

                {/* Detail Nama Santri (Gated by Reviewer Form) */}
                {result.has_santri_list && (
                  <div className="pub-santri-gate-box">
                    <div className="pub-gate-header">
                      <div className="pub-gate-icon">
                        <i className="fa-solid fa-user-lock" />
                      </div>
                      <div>
                        <h4 className="pub-gate-title">
                          Daftar Santri Terkait ({result.santri_count || 0} Santri)
                        </h4>
                        <p className="pub-gate-desc">
                          Demi perlindungan privasi santri, rincian nama santri disembunyikan. Petugas pemeriksa (pos jaga, asrama, madrasah, atau pengurus) wajib mencatatkan identitas pemeriksaan di bawah ini untuk membuka daftar santri.
                        </p>
                      </div>
                    </div>

                    {!unlockedData ? (
                      <form onSubmit={handleUnlockSantri} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {unlockError && (
                          <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px' }}>
                            {unlockError}
                          </div>
                        )}

                        <div className="pub-gate-form">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="pemeriksaName" style={{ fontSize: '12px', fontWeight: 600, color: '#44403c' }}>
                              Nama Lengkap Pemeriksa <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              id="pemeriksaName"
                              type="text"
                              className="pub-formal-input"
                              placeholder="Nama Anda (contoh: Ust. Ahmad Fauzi)..."
                              value={reviewerName}
                              onChange={(e) => setReviewerName(e.target.value)}
                              required
                              style={{ height: '42px', background: '#ffffff' }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="pemeriksaInstansi" style={{ fontSize: '12px', fontWeight: 600, color: '#44403c' }}>
                              Instansi / Unit <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select
                              id="pemeriksaInstansi"
                              className="pub-formal-input"
                              value={reviewerInstansi}
                              onChange={(e) => setReviewerInstansi(e.target.value as ValidInstansi)}
                              style={{ height: '42px', background: '#ffffff' }}
                            >
                              {VALID_INSTANSI_LIST.map((inst) => (
                                <option key={inst} value={inst}>
                                  {inst}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="pub-formal-submit-btn"
                            disabled={unlockLoading}
                            style={{ height: '42px', background: '#0e4f40' }}
                          >
                            {unlockLoading ? (
                              <>
                                <i className="fa-solid fa-spinner fa-spin" />
                                <span>Mencatat...</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-unlock-keyhole" />
                                <span>Buka Rincian Santri</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="pub-unlocked-banner">
                          <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '16px' }} />
                          <div>
                            Daftar santri dibuka dan dicatat oleh <strong>{unlockedData.pemeriksa.nama}</strong> ({unlockedData.pemeriksa.instansi}) pada{' '}
                            {new Date(unlockedData.pemeriksa.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB.
                          </div>
                        </div>

                        <div className="pub-santri-table-wrap">
                          <table className="pub-santri-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}>No</th>
                                <th>Nama Santri</th>
                                <th>Kelas</th>
                                <th>Asrama / Kamar</th>
                                <th>Keterangan / Keperluan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unlockedData.santri_list.map((s, idx) => (
                                <tr key={s.id || idx}>
                                  <td style={{ fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                                  <td style={{ fontWeight: 700, color: '#0B2A4A' }}>{s.nama}</td>
                                  <td>{s.kelas || '—'}</td>
                                  <td>
                                    {s.asrama ? `${s.asrama}${s.kamar ? ` / ${s.kamar}` : ''}` : '—'}
                                  </td>
                                  <td style={{ color: '#475569' }}>{s.keperluan || s.catatan || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Riwayat Pemeriksaan Dokumen Resmi (Pusat Audit Keabsahan) */}
                <div className="pub-inspection-history-box">
                  <div className="pub-history-header-row">
                    <div className="pub-history-icon-circle">
                      <i className="fa-solid fa-clock-rotate-left" />
                    </div>
                    <div>
                      <h4 className="pub-history-box-title">
                        Riwayat Pemeriksaan Dokumen ({historyLogs.length})
                      </h4>
                      <p className="pub-history-box-desc">
                        Rekam jejak akses dan audit resmi dokumen oleh pos pemeriksaan, asrama, madrasah, dan sekretariat.
                      </p>
                    </div>
                  </div>

                  {historyLogs.length > 0 ? (
                    <div className="pub-history-list">
                      {historyLogs.map((log, idx) => {
                        const isSuccess = log.hasil === 'Berhasil' || log.status_dokumen === 'valid';
                        return (
                          <div key={log.id || idx} className="pub-history-item">
                            <div className="pub-history-item-top">
                              <div className="pub-history-examiner">
                                <i className="fa-solid fa-user-check" style={{ color: '#0B2A4A' }} />
                                <span className="pub-history-examiner-name">{log.nama_pemeriksa}</span>
                                <span className="pub-history-instansi-badge">{log.instansi}</span>
                              </div>
                              <div className="pub-history-meta">
                                <span className={`pub-history-status-badge ${isSuccess ? 'success' : 'failed'}`}>
                                  <i className={`fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ marginRight: '4px' }} />
                                  {log.hasil || (isSuccess ? 'Berhasil' : 'Gagal')}
                                </span>
                                <span className="pub-history-time">
                                  {formatDateTimeIndo(log.waktu)}
                                </span>
                              </div>
                            </div>
                            {log.catatan && (
                              <div className="pub-history-note">
                                <i className="fa-solid fa-circle-info" style={{ fontSize: '11px', marginRight: '6px', color: '#64748b' }} />
                                {log.catatan}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pub-history-empty">
                      <i className="fa-regular fa-folder-open" style={{ fontSize: '20px', marginBottom: '6px', display: 'block', color: '#94a3b8' }} />
                      Belum ada catatan riwayat pemeriksaan publik untuk surat ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Official Living Footer */}
      <LauncherFooter
        onOpenHelp={() => setIsHelpOpen(true)}
        footerSignature={portalSettings?.footerSignature}
        footerCopyright={portalSettings?.footerCopyright}
      />

      {/* Official Help Dialog Modal */}
      <HelpDialogModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        helpWaNumber={portalSettings?.helpWaNumber}
      />
    </div>
  );
}
