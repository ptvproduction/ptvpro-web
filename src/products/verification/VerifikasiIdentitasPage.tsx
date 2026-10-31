import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { verifyCrew, resolveCrewVerificationQrUrl } from './verificationService';
import { crewStore } from '@products/hub/kru/kruStore';
import { crewPortfolioService, PortfolioItem } from '@products/hub/kru/services/crewPortfolioService';
import { LivingHeader } from '../living-portal/components/LivingHeader';
import { LauncherFooter } from '../living-portal/components/LauncherFooter';
import { HelpDialogModal } from '../living-portal/components/HelpDialogModal';
import { portalManagementService } from '../hub/portal-management/services/portalManagementService';
import { PortalSettings } from '../hub/portal-management/types';
import { RealQrCode } from '@shared/utils';
import '../living-portal/styles/livingPortal.css';
import '@/styles/publicVerification.css';
import '@/styles/portofolio.css';

export function VerifikasiIdentitasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Ekstrak parameter crew ID dari path atau query param
  const activeQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const qId =
      searchParams.get('id') ||
      searchParams.get('crew_id') ||
      searchParams.get('kru') ||
      searchParams.get('q');
    if (qId) return qId.trim();

    const pathSplat = params['*'] || params.crewId;
    if (pathSplat) return pathSplat.trim();

    const match = location.pathname.match(/^\/verifikasi-identitas\/(.+)$/);
    if (match && match[1]) {
      return match[1].trim();
    }

    return '';
  }, [location.search, location.pathname, params]);

  const [inputVal, setInputVal] = useState(activeQuery);
  const [photoError, setPhotoError] = useState(false);
  const [, setCrewVersion] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);

  // Portfolio State for Verified Crew
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioFilter, setPortfolioFilter] = useState('all');

  useEffect(() => {
    document.documentElement.classList.add('living-portal-active');
    document.body.classList.add('living-portal-active');
    document.title = 'Verifikasi Identitas Kru — Progresif TV';

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Pastikan crewStore terinisialisasi
    if (!crewStore.getAll().length) {
      crewStore.init();
    }
    const unsub = crewStore.subscribe(() => {
      setCrewVersion((v) => v + 1);
    });

    portalManagementService.getPublicPortalData().then((data) => {
      if (data?.settings) setPortalSettings(data.settings);
    }).catch(() => {});

    return () => {
      unsub();
      window.removeEventListener('scroll', handleScroll);
      document.documentElement.classList.remove('living-portal-active');
      document.body.classList.remove('living-portal-active');
    };
  }, []);

  useEffect(() => {
    setInputVal(activeQuery);
    setPhotoError(false);
    setPortfolioItems([]);
    setPortfolioFilter('all');

    if (!activeQuery) return;

    // Verifikasi kru & ambil portofolio jika ditemukan
    const res = verifyCrew(activeQuery);
    if (res?.is_found && res.crew_id) {
      setPortfolioLoading(true);
      crewPortfolioService.getCrewPortfolio(res.crew_id)
        .then((items) => setPortfolioItems(items))
        .catch(() => setPortfolioItems([]))
        .finally(() => setPortfolioLoading(false));
    }
  }, [activeQuery]);

  const result = useMemo(() => {
    if (!activeQuery) return null;
    return verifyCrew(activeQuery);
  }, [activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean) {
      navigate('/verifikasi-identitas');
      return;
    }
    navigate(`/verifikasi-identitas?id=${encodeURIComponent(clean)}`);
  };

  const initials = useMemo(() => {
    if (!result || !result.full_name) return 'PTV';
    return result.full_name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [result]);

  const filteredPortfolio = useMemo(() => {
    const list =
      portfolioFilter === 'all'
        ? portfolioItems
        : portfolioItems.filter((i) => i.platform === portfolioFilter);

    // Pertahankan urutan karya terbaru terlebih dahulu
    return [...list].sort((a, b) => {
      const dateA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const dateB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [portfolioItems, portfolioFilter]);

  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    portfolioItems.forEach((i) => set.add(i.platform));
    return Array.from(set);
  }, [portfolioItems]);

  const getPlatformClass = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return 'instagram';
    if (p.includes('tiktok')) return 'tiktok';
    if (p.includes('youtube')) return 'youtube';
    if (p.includes('facebook')) return 'facebook';
    if (p.includes('website')) return 'website';
    if (p.includes('event')) return 'live-event';
    return '';
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return 'fa-brands fa-instagram';
    if (p.includes('tiktok')) return 'fa-brands fa-tiktok';
    if (p.includes('youtube')) return 'fa-brands fa-youtube';
    if (p.includes('facebook')) return 'fa-brands fa-facebook';
    if (p.includes('website')) return 'fa-solid fa-globe';
    if (p.includes('event')) return 'fa-solid fa-microphone-lines';
    return 'fa-solid fa-clapperboard';
  };

  return (
    <div className="pub-living-wrapper">
      <LivingHeader
        isScrolled={isScrolled}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <main className="pub-living-main">
        {/* Formal Hero Header */}
        <section className="pub-formal-hero">
          <h1 className="pub-formal-title">Verifikasi Identitas Kru</h1>
          <p className="pub-formal-desc">
            Pemeriksaan keabsahan status keanggotaan, penugasan resmi, dan rekam portofolio kontribusi kru Progresif TV Pesantren Progresif Bumi Shalawat.
          </p>
        </section>

        {/* Search Bar */}
        <section className="pub-formal-search-card">
          <label htmlFor="crewSearchInput" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#64748b' }} />
            Cari Nomor PTV-ID atau Nama Kru
          </label>
          <form onSubmit={handleSearchSubmit} className="pub-formal-search-form">
            <input
              id="crewSearchInput"
              type="text"
              className="pub-formal-input"
              placeholder="Masukkan nomor PTV-ID (contoh: PTV-001) atau nama lengkap kru..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="pub-formal-submit-btn">
              <i className="fa-solid fa-user-check" />
              <span>Periksa Identitas</span>
            </button>
          </form>
        </section>

        {/* Verification Result Area */}
        {result ? (
          !result.is_found ? (
            <div className="pub-doc-result-card" style={{ padding: '48px 24px', textAlign: 'center', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '14px' }}>
                <i className="fa-solid fa-user-slash" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>
                Identitas Tidak Terdaftar
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b', maxWidth: '480px', lineHeight: 1.5 }}>
                Nomor identitas atau nama <code style={{ fontWeight: 700, color: '#0f172a' }}>{result.crew_id || activeQuery}</code> tidak tercatat dalam pangkalan data resmi kru Progresif TV.
              </p>
              <button
                type="button"
                className="pub-formal-submit-btn"
                onClick={() => {
                  setInputVal('');
                  navigate('/verifikasi-identitas');
                }}
              >
                <i className="fa-solid fa-arrows-rotate" />
                <span>Cari Kru Lain</span>
              </button>
            </div>
          ) : (
            /* DESKTOP 2-COLUMN SPLIT LAYOUT (KIRI: IDENTITAS, KANAN: PORTOFOLIO) */
            <div className="pub-crew-split-layout">
              {/* KOLOM KIRI: IDENTITAS RESMI KRU */}
              <div className="pub-crew-left-col">
                <div className="pub-crew-card">
                  <div className="pub-crew-card-hero">
                    <div className="pub-crew-photo-frame">
                      {result.foto_url && !photoError ? (
                        <img
                          src={result.foto_url}
                          alt={result.full_name}
                          className="pub-crew-photo"
                          onError={() => setPhotoError(true)}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#eff6ff', color: '#1273e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800 }}>
                          {initials}
                        </div>
                      )}
                    </div>

                    <h2 className="pub-crew-name">{result.full_name}</h2>
                    <div className="pub-crew-id-pill">
                      <i className="fa-solid fa-fingerprint" style={{ color: '#1273e6' }} />
                      <span>{result.crew_id}</span>
                    </div>
                  </div>

                  <div className="pub-crew-field-list">
                    <div className="pub-crew-field-row">
                      <span className="pub-crew-field-label">Status Keanggotaan</span>
                      <span
                        className={`pub-status-badge ${
                          result.status_kru === 'Aktif'
                            ? 'aktif'
                            : result.status_kru === 'Purna Kru'
                            ? 'purna'
                            : 'nonaktif'
                        }`}
                      >
                        <span className="pub-status-dot" />
                        <span className="pub-status-text">
                          {result.status_kru === 'Aktif'
                            ? 'Anggota Resmi Aktif'
                            : result.status_kru === 'Purna Kru'
                            ? 'Purna Kru / Alumni'
                            : 'Nonaktif'}
                        </span>
                      </span>
                    </div>

                    <div className="pub-crew-field-row">
                      <span className="pub-crew-field-label">Jabatan / Posisi</span>
                      <span className="pub-crew-field-val">{result.position || 'Kru Operasional'}</span>
                    </div>

                    <div className="pub-crew-field-row">
                      <span className="pub-crew-field-label">Divisi</span>
                      <span className="pub-crew-field-val">{result.division || 'Technical'}</span>
                    </div>

                    <div className="pub-crew-field-row">
                      <span className="pub-crew-field-label">Angkatan</span>
                      <span className="pub-crew-field-val">{result.angkatan || '—'}</span>
                    </div>

                    <div className="pub-crew-field-row">
                      <span className="pub-crew-field-label">Basis Verifikasi</span>
                      <span className="pub-crew-field-val" style={{ color: '#16a34a', fontSize: '12.5px' }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '5px' }} />
                        PTV Verification System
                      </span>
                    </div>
                  </div>

                  {/* QR Code Verifikasi */}
                  <div className="pub-crew-qr-box">
                    <RealQrCode
                      payload={resolveCrewVerificationQrUrl(result.crew_id)}
                      size={130}
                      margin={2}
                      color="#0B2A4A"
                      bgColor="#ffffff"
                      ariaLabel={`QR Code Verifikasi Resmi ${result.full_name}`}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      Pindai untuk memvalidasi identitas kru ini
                    </span>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: REKAM PORTOFOLIO & KONTRIBUSI KARYA */}
              <div
                className="pub-crew-right-col"
                tabIndex={0}
                role="region"
                aria-label="Daftar Portofolio dan Rekam Karya Kru"
              >
                <div className="pub-portfolio-header-card">
                  <div>
                    <h3 className="pub-portfolio-header-title">
                      <i className="fa-solid fa-clapperboard" style={{ color: '#1273e6', marginRight: '8px' }} />
                      Portofolio &amp; Rekam Karya Kru
                    </h3>
                    <p className="pub-portfolio-header-desc">
                      Catatan kontribusi produksi dan publikasi karya resmi oleh {result.full_name}.
                    </p>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0B2A4A', background: '#f1f5f9', padding: '4px 12px', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
                    {portfolioItems.length} Karya Tercatat
                  </span>
                </div>

                {/* Filter Platform */}
                {availablePlatforms.length > 1 && (
                  <div className="pub-portfolio-filter-row">
                    <button
                      type="button"
                      className={`pub-filter-pill ${portfolioFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setPortfolioFilter('all')}
                    >
                      Semua ({portfolioItems.length})
                    </button>
                    {availablePlatforms.map((plat) => (
                      <button
                        key={plat}
                        type="button"
                        className={`pub-filter-pill ${portfolioFilter === plat ? 'active' : ''}`}
                        onClick={() => setPortfolioFilter(plat)}
                      >
                        {plat} ({portfolioItems.filter((i) => i.platform === plat).length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Daftar Portofolio Kru — Satu Card Utama dengan Divider (R03) */}
                {portfolioLoading ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '20px', color: '#1273e6', marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Memuat rekam karya kru...</p>
                  </div>
                ) : filteredPortfolio.length === 0 ? (
                  <div className="ptv-pf-empty-card" style={{ background: '#ffffff' }}>
                    <div className="ptv-pf-empty-icon">
                      <i className="fa-solid fa-camera-retro" />
                    </div>
                    <h4 className="ptv-pf-empty-title">Belum Ada Rekam Karya Terpublikasi</h4>
                    <p className="ptv-pf-empty-desc">
                      Personel ini belum menambahkan riwayat kontribusi produksi ke dalam sistem portofolio PTV Hub.
                    </p>
                  </div>
                ) : (
                  <div className="pub-portfolio-unified-card">
                    {filteredPortfolio.map((item) => (
                      <div key={item.id} className="pub-portfolio-compact-row">
                        <div className="pub-portfolio-row-header">
                          <div className="pub-portfolio-row-badges">
                            <span className={`ptv-pf-platform-badge ${getPlatformClass(item.platform)}`}>
                              <i className={getPlatformIcon(item.platform)} />
                              {item.platform}
                            </span>
                            <span className="ptv-pf-role-pill">
                              <i className="fa-solid fa-tag" style={{ fontSize: '10px' }} />
                              {item.jenis_kontribusi}
                            </span>
                          </div>

                          {item.tanggal && (
                            <span className="pub-portfolio-row-date">
                              <i className="fa-regular fa-calendar" />
                              {item.tanggal}
                            </span>
                          )}
                        </div>

                        <h4 className="pub-portfolio-row-title">{item.judul}</h4>

                        {item.link_karya && (
                          <div className="pub-portfolio-row-actions">
                            <a
                              href={item.link_karya}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pub-portfolio-link-btn"
                            >
                              <span>Lihat Karya Publik</span>
                              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10.5px' }} />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#1273e6' }} />
                  <span>
                    Rekam kontribusi dicatat secara mandiri oleh personel bersangkutan melalui akun resmi PTV Hub.
                  </span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div style={{ padding: '60px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#1273e6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '14px' }}>
              <i className="fa-solid fa-id-card" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>Pemeriksaan Identitas Kru Resmi</h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
              Ketikkan nomor identitas kru (contoh: <code style={{ fontWeight: 600 }}>PTV-001</code>) atau nama lengkap personel pada kolom di atas, atau pindai QR Code pada Kartu Tanda Anggota (KTA) fisik / ID Digital.
            </p>
          </div>
        )}
      </main>

      <LauncherFooter
        onOpenHelp={() => setIsHelpOpen(true)}
        footerSignature={portalSettings?.footerSignature}
        footerCopyright={portalSettings?.footerCopyright}
      />

      <HelpDialogModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        helpWaNumber={portalSettings?.helpWaNumber}
      />
    </div>
  );
}
