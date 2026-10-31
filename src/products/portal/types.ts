export type Locale = 'id' | 'en';

export interface LocalizedString {
  id: string;
  en: string;
}

export type ServiceAccessType = 'own' | 'login' | 'crew' | 'open';
export type ServiceStatus = 'ok' | 'incident' | 'maint' | 'soon';
export type ServiceCategory = 'yayasan' | 'ptv' | 'season';

export interface CategoryConfig {
  id: ServiceCategory;
  n: LocalizedString;
  d: LocalizedString;
}

export interface PortalService {
  id: string;
  cat: ServiceCategory;
  ic: string;
  st: ServiceStatus;
  ac: ServiceAccessType;
  n: LocalizedString;
  d: LocalizedString;
  url?: string;
  isExternal?: boolean;
  hub?: boolean;
  pub?: number;
  seasonal?: boolean;
  seasonalActive?: boolean;
  featuredPriority?: number;
}

export interface FeaturedHighlight {
  svc: string;
  b: LocalizedString;
  p?: LocalizedString;
  d: LocalizedString;
  c: LocalizedString;
}

export interface PortalAnnouncement {
  id: string;
  format: 'text' | 'poster' | 'both';
  title: LocalizedString;
  body: LocalizedString;
  ctaText: LocalizedString;
  posterSrc?: string;
  active: boolean;
}

export interface WhatsAppTopicOption {
  id: number;
  label: LocalizedString;
}

export type PortalView = 'home' | 'status' | 'soon' | 'maint';
