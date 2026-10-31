import { Locale, ServiceAccessType } from '../../portal/types';

export type ServiceStatus = 'ok' | 'soon' | 'incident' | 'maint';
export type ServiceCategory = 'ptv' | 'yayasan' | 'season' | 'internal' | 'public' | 'archive' | 'system';

export interface PortalManagedService {
  id: string;
  name: Record<Locale, string>;
  desc: Record<Locale, string>;
  cat: ServiceCategory;
  href: string;
  icon: string;
  st: ServiceStatus;
  statusNote?: string;
  statusUpdatedAt?: string;
  pub: 0 | 1; // 1 = publik di launcher, 0 = internal/hidden
  isSeasonal?: boolean;
  seasonalStart?: string; // YYYY-MM-DD
  seasonalEnd?: string;   // YYYY-MM-DD
  sortOrder: number;
  isActive: boolean;
  isPublished: boolean;
  hasDraft?: boolean;
  draftPayload?: Partial<Omit<PortalManagedService, 'draftPayload'>>;
  updatedAt?: string;
  updatedBy?: string;

  // Compatibility fields for PortalService
  url?: string;
  ic?: string;
  ac?: ServiceAccessType;
  n?: Record<Locale, string>;
  d?: Record<Locale, string>;
}

export interface PortalManagedAnnouncement {
  id: string;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
  ctaText?: Record<Locale, string>;
  ctaHref?: string;
  format: 'text' | 'poster' | 'hybrid';
  posterSrc?: string;
  startDate?: string; // ISO string atau YYYY-MM-DD
  endDate?: string;   // ISO string atau YYYY-MM-DD
  type?: 'info' | 'warning' | 'broadcast';
  priority?: number;
  isActive: boolean;
  isPublished: boolean;
  hasDraft?: boolean;
  draftPayload?: Partial<Omit<PortalManagedAnnouncement, 'draftPayload'>>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PortalSettings {
  id: 'global';
  heroTitle: {
    line1: string;
    line2: string;
  };
  heroDesc: string;
  helpWaNumber: string;
  footerSignature: string;
  footerCopyright: string;
  isPublished: boolean;
  hasDraft?: boolean;
  draftPayload?: Partial<Omit<PortalSettings, 'draftPayload'>>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PortalAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'create' | 'edit' | 'delete' | 'publish' | 'reorder' | 'status_change';
  entityType: 'service' | 'announcement' | 'settings';
  entityId: string;
  details: string;
  timestamp: string;
}
