import { Link, useLocation } from 'react-router-dom';

export function PublicVerificationHeader() {
  const location = useLocation();
  const isDocActive = location.pathname.startsWith('/verifikasi-surat');
  const isIdActive = location.pathname.startsWith('/verifikasi-identitas');

  return (
    <header className="pub-top-header">
      <div className="pub-header-content">
        <Link to="/" className="pub-brand-link" aria-label="Kembali ke Beranda PTVPRO">
          <img
            src="/assets/images/ptv-logo-white.webp"
            alt="Progresif TV"
            className="pub-brand-logo-img"
          />
        </Link>

        <nav className="pub-nav-tabs" aria-label="Navigasi Verifikasi Publik">
          <Link
            to="/verifikasi-surat"
            className={`pub-nav-pill ${isDocActive ? 'active' : ''}`}
          >
            <i className="fa-solid fa-file-shield" style={{ marginRight: '6px' }} />
            Surat Resmi
          </Link>
          <Link
            to="/verifikasi-identitas"
            className={`pub-nav-pill ${isIdActive ? 'active' : ''}`}
          >
            <i className="fa-solid fa-id-badge" style={{ marginRight: '6px' }} />
            Identitas Kru
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicVerificationFooter() {
  return (
    <footer className="pub-footer">
      <div className="pub-footer-brand">
        Progresif TV • Pesantren Progresif Bumi Shalawat
      </div>
      <div className="pub-footer-sub">
        Layanan Resmi Verifikasi Dokumen & Identitas Digital • Bebas Akses Tanpa Login
      </div>
    </footer>
  );
}
