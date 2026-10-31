import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Locale, PortalService, PortalView } from './types';
import {
  DEFAULT_ANNOUNCEMENT,
  FEATURED_HIGHLIGHTS,
  INITIAL_SERVICES,
  PORTAL_CATEGORIES,
} from './services/portalCatalog';
import { PortalHeader } from './components/PortalHeader';
import { PortalHero } from './components/PortalHero';
import { FeaturedCarousel } from './components/FeaturedCarousel';
import { ServiceSearch } from './components/ServiceSearch';
import { CategoryFilterChips } from './components/CategoryFilterChips';
import { ServiceCategorySection } from './components/ServiceCategorySection';
import { ServiceStatusView } from './components/ServiceStatusView';
import { ComingSoonView } from './components/ComingSoonView';
import { MaintenanceView } from './components/MaintenanceView';
import { AnnouncementModal } from './components/AnnouncementModal';
import { WhatsAppHelpModal } from './components/WhatsAppHelpModal';
import { PortalFooter } from './components/PortalFooter';
import { portalManagementService } from '../hub/portal-management/services/portalManagementService';
import { PortalSettings } from '../hub/portal-management/types';
import './styles/portal.css';

interface PortalPageProps {
  initialView?: PortalView;
}

const STORAGE_LANG_KEY = 'ptvpro_portal_lang';
const STORAGE_ANN_KEY = 'ptvpro_announcement_closed_v1';

export const PortalPage: React.FC<PortalPageProps> = ({ initialView = 'home' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Isolasi html dan body background dari dashboard.css
  useEffect(() => {
    document.documentElement.classList.add('portal-page-active');
    document.body.classList.add('portal-page-active');
    return () => {
      document.documentElement.classList.remove('portal-page-active');
      document.body.classList.remove('portal-page-active');
    };
  }, []);

  // State bahasa
  const [lang, setLangState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'id' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'id';
  });

  const setLang = (nextLang: Locale) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, nextLang);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLang;
    }
  };

  // State view
  const [view, setView] = useState<PortalView>(() => {
    const queryView = searchParams.get('view');
    if (queryView === 'status' || queryView === 'maint') return queryView;
    return initialView;
  });

  const [selectedSoonService, setSelectedSoonService] = useState<PortalService | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnnouncement, setShowAnnouncement] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_ANN_KEY);
    } catch {
      return true;
    }
  });

  // Services catalog
  const [services] = useState<PortalService[]>(INITIAL_SERVICES);
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await portalManagementService.getPublicPortalData();
        if (data.settings) setPortalSettings(data.settings);
      } catch {
        // fallback
      }
    };
    loadSettings();
  }, []);

  // Sync html lang
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // Hitung gangguan publik
  const hasIssues = services.some(
    (s) => s.pub !== 0 && (s.st === 'incident' || s.st === 'maint')
  );

  const handleScrollToServices = () => {
    if (view !== 'home') {
      setView('home');
    }
    setTimeout(() => {
      const el = document.getElementById('layanan');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleOpenService = (service: PortalService) => {
    if (service.st === 'soon') {
      setSelectedSoonService(service);
      setView('soon');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (service.isExternal && service.url) {
      window.open(service.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (service.url) {
      navigate(service.url);
    }
  };

  const handleSelectFeatured = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      handleOpenService(service);
    }
  };

  const handleCloseAnnouncement = () => {
    setShowAnnouncement(false);
    try {
      localStorage.setItem(STORAGE_ANN_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleScrollToCategory = (catId: string) => {
    const el = document.getElementById(`c-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Dapatkan nama halaman aktif untuk WhatsApp Help context
  const getPageContextName = () => {
    if (view === 'status') return lang === 'id' ? 'Status Layanan' : 'Service Status';
    if (view === 'maint') return lang === 'id' ? 'Pemeliharaan' : 'Maintenance';
    if (view === 'soon' && selectedSoonService) return selectedSoonService.n[lang];
    return lang === 'id' ? 'Beranda Portal' : 'Portal Home';
  };

  return (
    <div className="ptvpro-portal">
      <PortalHeader
        lang={lang}
        setLang={setLang}
        view={view}
        setView={(v) => {
          setView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        hasIssues={hasIssues}
        onNavigateServices={handleScrollToServices}
      />
      {view === 'home' && (
        <div className="top">
          <PortalHero lang={lang} />
        </div>
      )}

      {view === 'maint' ? (
        <MaintenanceView
          lang={lang}
          onNavigateHub={() => navigate('/hub')}
        />
      ) : view === 'status' ? (
        <ServiceStatusView
          services={services}
          lang={lang}
          onBack={() => {
            setView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : view === 'soon' && selectedSoonService ? (
        <ComingSoonView
          service={selectedSoonService}
          lang={lang}
          onBack={() => {
            setView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <main id="layanan" className="wrap">
          <FeaturedCarousel
            highlights={FEATURED_HIGHLIGHTS}
            services={services}
            lang={lang}
            onSelectService={handleSelectFeatured}
          />

          <div className="tools">
            <ServiceSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              lang={lang}
            />
            <CategoryFilterChips
              categories={PORTAL_CATEGORIES}
              lang={lang}
              onSelectCategory={handleScrollToCategory}
            />
          </div>

          <ServiceCategorySection
            categories={PORTAL_CATEGORIES}
            services={services}
            lang={lang}
            query={searchQuery}
            onClearQuery={() => setSearchQuery('')}
            onOpenService={handleOpenService}
          />
        </main>
      )}

      <PortalFooter
        lang={lang}
        footerCopyright={portalSettings?.footerCopyright}
        onNavigateStatus={() => {
          setView('status');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {showAnnouncement && DEFAULT_ANNOUNCEMENT.active && (
        <AnnouncementModal
          announcement={DEFAULT_ANNOUNCEMENT}
          lang={lang}
          onClose={handleCloseAnnouncement}
          onViewServices={handleScrollToServices}
        />
      )}

      <WhatsAppHelpModal
        lang={lang}
        currentPageName={getPageContextName()}
        helpWaNumber={portalSettings?.helpWaNumber}
      />
    </div>
  );
};
