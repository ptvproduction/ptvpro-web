import { getSupabaseClient, isSupabaseConfigured } from '../../../../core/supabase/client';
import { INITIAL_SERVICES } from '../../../portal/services/portalCatalog';
import {
  PortalManagedService,
  PortalManagedAnnouncement,
  PortalSettings,
  PortalAuditLog,
  ServiceStatus,
} from '../types';

const STORAGE_KEY_SERVICES = 'ptv_portal_mgmt_services_v1';
const STORAGE_KEY_ANNOUNCEMENTS = 'ptv_portal_mgmt_announcements_v1';
const STORAGE_KEY_SETTINGS = 'ptv_portal_mgmt_settings_v1';
const STORAGE_KEY_AUDIT_LOGS = 'ptv_portal_mgmt_audit_logs_v1';

const DEFAULT_SETTINGS: PortalSettings = {
  id: 'global',
  heroTitle: {
    line1: 'Semua layanan.',
    line2: 'Satu tempat.',
  },
  heroDesc:
    'Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV — mulai dari ruang operasional kru hingga layanan verifikasi publik.',
  helpWaNumber: '62895325884964',
  footerSignature: 'Dibangun oleh santri. Didedikasikan untuk sesama.',
  footerCopyright: '© 2026 Progresif TV Production.',
  isPublished: true,
  hasDraft: false,
};

const DEFAULT_ANNOUNCEMENTS: PortalManagedAnnouncement[] = [];

function buildInitialManagedServices(): PortalManagedService[] {
  return INITIAL_SERVICES.map((s, index) => ({
    id: s.id,
    name: { ...s.n },
    desc: { ...s.d },
    cat: s.cat,
    href: s.url || '/hub',
    icon: s.ic || 'globe',
    url: s.url,
    ic: s.ic,
    ac: s.ac,
    n: s.n,
    d: s.d,
    st: s.st,
    statusNote: s.st === 'incident' ? 'Gangguan pada server upstream' : s.st === 'maint' ? 'Pemeliharaan rutin terjadwal' : '',
    statusUpdatedAt: '2026-10-25T12:00:00.000Z',
    pub: (s.pub === 0 ? 0 : 1) as 0 | 1,
    isSeasonal: s.id === 'maj',
    seasonalStart: s.id === 'maj' ? '2026-01-01' : undefined,
    seasonalEnd: s.id === 'maj' ? '2026-12-31' : undefined,
    sortOrder: index,
    isActive: true,
    isPublished: true,
    hasDraft: false,
    updatedAt: '2026-10-25T12:00:00.000Z',
  }));
}

function getApiUrl(endpoint: string): string | null {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}${endpoint}`;
  }
  return null;
}

export class PortalManagementService {
  constructor() {
    this.initLocalStorage();
  }

  private initLocalStorage() {
    if (typeof window === 'undefined') return;

    // Rekonsiliasi non-destruktif Layanan
    const rawServices = localStorage.getItem(STORAGE_KEY_SERVICES);
    if (!rawServices) {
      localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(buildInitialManagedServices()));
    } else {
      try {
        let parsed: PortalManagedService[] = JSON.parse(rawServices);
        let modified = false;

        // 1. Rekonsiliasi PTV Hub jika tersimpan dengan pub: 0 dari seed lama
        const hubSvc = parsed.find((s) => s.id === 'hub');
        if (hubSvc && hubSvc.pub === 0) {
          hubSvc.pub = 1;
          hubSvc.isActive = true;
          hubSvc.isPublished = true;
          modified = true;
        }

        // 2. Rekonsiliasi nama Keabsahan Dokumen untuk id 'ltr'
        const ltrSvc = parsed.find((s) => s.id === 'ltr');
        if (ltrSvc && (ltrSvc.name?.id === 'Verifikasi Surat' || ltrSvc.n?.id === 'Verifikasi Surat')) {
          ltrSvc.name = { id: 'Keabsahan Dokumen', en: 'Document Verification' };
          ltrSvc.n = { id: 'Keabsahan Dokumen', en: 'Document Verification' };
          modified = true;
        }

        // 3. Pastikan keenam layanan resmi terdaftar
        const initial = buildInitialManagedServices();
        for (const initSvc of initial) {
          if (!parsed.some((p) => p.id === initSvc.id)) {
            parsed.push(initSvc);
            modified = true;
          }
        }

        if (modified) {
          localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(parsed));
        }
      } catch {
        localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(buildInitialManagedServices()));
      }
    }

    if (!localStorage.getItem(STORAGE_KEY_SETTINGS)) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }

    const rawAnnouncements = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS);
    if (!rawAnnouncements) {
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(DEFAULT_ANNOUNCEMENTS));
    }

    if (!localStorage.getItem(STORAGE_KEY_AUDIT_LOGS)) {
      const initialLogs: PortalAuditLog[] = [
        {
          id: `log-init-${Date.now()}`,
          userId: 'SYSTEM',
          userName: 'System Initializer',
          action: 'publish',
          entityType: 'settings',
          entityId: 'global',
          details: 'Inisialisasi sistem portal baseline',
          timestamp: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(initialLogs));
    }
  }

  // =========================================================================
  // Helper API Caller
  // =========================================================================
  private async postApi(payload: any): Promise<any> {
    const url = getApiUrl('/api/portal');
    if (!url || typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[PortalManagementService] API POST mutation error, proceeding with local fallback:', e);
    }
    return null;
  }

  // =========================================================================
  // Audit Log Recorder
  // =========================================================================
  public async logAction(
    action: PortalAuditLog['action'],
    entityType: PortalAuditLog['entityType'],
    entityId: string,
    details: string,
    user?: { id?: string; name?: string }
  ) {
    const log: PortalAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user?.id || 'SYSTEM',
      userName: user?.name || 'Operator Hub',
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
        const list: PortalAuditLog[] = raw ? JSON.parse(raw) : [];
        list.unshift(log);
        localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(list.slice(0, 100)));
      } catch {
        // ignore
      }
    }
  }

  public async getAuditLogs(): Promise<PortalAuditLog[]> {
    // 1. Coba fetch dari API server
    const apiUrl = getApiUrl('/api/portal?entity=audit_logs');
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, { credentials: 'same-origin' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.auditLogs)) {
            return body.auditLogs;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Direct Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_portal_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          return data.map((l: any) => ({
            id: l.id,
            userId: l.user_id,
            userName: l.user_name,
            action: l.action,
            entityType: l.entity_type,
            entityId: l.entity_id,
            details: l.details,
            timestamp: l.created_at,
          }));
        }
      } catch {
        // fallback
      }
    }

    // 3. Fallback localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
        if (raw) return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return [];
  }

  // =========================================================================
  // Services Management
  // =========================================================================
  public async getServices(includeDraft = false): Promise<PortalManagedService[]> {
    let items: PortalManagedService[] = [];

    // 1. Coba fetch dari server API
    const apiUrl = getApiUrl(`/api/portal?entity=services&includeDraft=${includeDraft}`);
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.services) && body.services.length > 0) {
            items = body.services;
            if (typeof window !== 'undefined' && !includeDraft) {
              localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(items));
            }
            return items;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Coba baca dari Supabase Client jika koneksi aktif
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_portal_services')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          items = data.map((row: any) => ({
            id: row.id,
            name: { id: row.name_id, en: row.name_en || row.name_id },
            desc: { id: row.desc_id, en: row.desc_en || row.desc_id },
            cat: row.cat,
            href: row.href,
            icon: row.icon,
            st: row.status,
            statusNote: row.status_note || undefined,
            statusUpdatedAt: row.status_updated_at || row.updated_at,
            pub: row.is_public ? 1 : 0,
            isSeasonal: Boolean(row.is_seasonal),
            seasonalStart: row.seasonal_start || undefined,
            seasonalEnd: row.seasonal_end || undefined,
            sortOrder: row.sort_order || 0,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: Boolean(row.draft_payload),
            draftPayload: row.draft_payload || undefined,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by,
          }));

          if (typeof window !== 'undefined' && !includeDraft) {
            localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(items));
          }
        }
      } catch {
        // Fallback to localStorage
      }
    }

    // 3. Fallback ke localStorage jika server/Supabase tidak merespons
    if (items.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SERVICES);
        if (raw) {
          items = JSON.parse(raw);
        } else {
          items = buildInitialManagedServices();
        }
      } catch {
        items = buildInitialManagedServices();
      }
    }

    if (items.length === 0) {
      items = buildInitialManagedServices();
    }

    items.sort((a, b) => a.sortOrder - b.sortOrder);

    if (includeDraft) {
      const merged = items.map((svc) => {
        if (svc.hasDraft && svc.draftPayload) {
          return {
            ...svc,
            ...svc.draftPayload,
            hasDraft: true,
            draftPayload: svc.draftPayload,
          };
        }
        return svc;
      });
      merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return merged;
    }

    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return items;
  }

  public async saveService(
    service: Partial<PortalManagedService> & { id: string },
    asDraft = true,
    user?: { id?: string; name?: string }
  ): Promise<PortalManagedService> {
    const services = await this.getServices(false);
    const existingIndex = services.findIndex((s) => s.id === service.id);

    let updated: PortalManagedService;

    if (existingIndex >= 0) {
      const existing = services[existingIndex];
      if (asDraft) {
        updated = {
          ...existing,
          hasDraft: true,
          draftPayload: {
            ...existing.draftPayload,
            ...service,
          },
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      } else {
        updated = {
          ...existing,
          ...service,
          hasDraft: false,
          draftPayload: undefined,
          isPublished: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      }
      services[existingIndex] = updated;
    } else {
      const newService: PortalManagedService = {
        id: service.id,
        name: service.name || { id: 'Layanan Baru', en: 'New Service' },
        desc: service.desc || { id: 'Deskripsi layanan', en: 'Service description' },
        cat: service.cat || 'public',
        href: service.href || '/hub',
        icon: service.icon || 'globe',
        st: service.st || 'ok',
        statusNote: service.statusNote,
        statusUpdatedAt: new Date().toISOString(),
        pub: service.pub ?? 1,
        isSeasonal: Boolean(service.isSeasonal),
        seasonalStart: service.seasonalStart,
        seasonalEnd: service.seasonalEnd,
        sortOrder: service.sortOrder ?? services.length,
        isActive: service.isActive ?? true,
        isPublished: !asDraft,
        hasDraft: asDraft,
        draftPayload: asDraft ? service : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Operator Hub',
      };
      updated = newService;
      services.push(updated);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
    }

    // Server API persistence
    await this.postApi({
      action: 'save_service',
      service,
      asDraft,
    });

    await this.logAction(
      existingIndex >= 0 ? 'edit' : 'create',
      'service',
      service.id,
      asDraft ? 'Menyimpan draft perubahan layanan' : 'Memperbarui layanan langsung',
      user
    );

    return updated;
  }

  public async publishService(serviceId: string, user?: { id?: string; name?: string }): Promise<void> {
    const services = await this.getServices(false);
    const idx = services.findIndex((s) => s.id === serviceId);
    if (idx !== -1) {
      const s = services[idx];
      if (s.hasDraft && s.draftPayload) {
        services[idx] = {
          ...s,
          ...s.draftPayload,
          hasDraft: false,
          draftPayload: undefined,
          isPublished: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      } else {
        services[idx].isPublished = true;
        services[idx].hasDraft = false;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
      }
    }

    await this.postApi({
      action: 'publish_service',
      serviceId,
    });

    await this.logAction('publish', 'service', serviceId, 'Memublikasikan draft layanan', user);
  }

  public async updateServiceStatus(
    serviceId: string,
    status: ServiceStatus,
    statusNote?: string,
    asDraftOrUser?: boolean | { id?: string; name?: string },
    userParam?: { id?: string; name?: string }
  ): Promise<void> {
    const asDraft = typeof asDraftOrUser === 'boolean' ? asDraftOrUser : false;
    const user = typeof asDraftOrUser === 'object' && asDraftOrUser !== null ? asDraftOrUser : userParam;

    const services = await this.getServices(true);
    const idx = services.findIndex((s) => s.id === serviceId);
    if (idx !== -1) {
      if (asDraft) {
        services[idx].hasDraft = true;
        services[idx].draftPayload = {
          ...(services[idx].draftPayload || {}),
          st: status,
          statusNote: statusNote,
        };
        services[idx].updatedAt = new Date().toISOString();
        services[idx].updatedBy = user?.name || 'Operator Hub';
      } else {
        services[idx].st = status;
        services[idx].statusNote = statusNote;
        services[idx].statusUpdatedAt = new Date().toISOString();
        services[idx].updatedAt = new Date().toISOString();
        services[idx].updatedBy = user?.name || 'Operator Hub';
        services[idx].hasDraft = false;
        services[idx].draftPayload = undefined;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
      }
    }

    await this.postApi({
      action: 'update_service_status',
      serviceId,
      status,
      statusNote,
      asDraft,
    });

    await this.logAction(
      asDraft ? 'edit' : 'status_change',
      'service',
      serviceId,
      asDraft
        ? `Menyimpan draft status "${status}" ${statusNote ? `(${statusNote})` : ''}`
        : `Mengubah status menjadi "${status}" ${statusNote ? `(${statusNote})` : ''}`,
      user
    );
  }

  public async reorderServices(
    orderList: { id: string; sortOrder: number }[],
    asDraftOrUser?: boolean | { id?: string; name?: string },
    userParam?: { id?: string; name?: string }
  ): Promise<void> {
    const asDraft = typeof asDraftOrUser === 'boolean' ? asDraftOrUser : false;
    const user = typeof asDraftOrUser === 'object' && asDraftOrUser !== null ? asDraftOrUser : userParam;

    const services = await this.getServices(true);
    for (const item of orderList) {
      const match = services.find((s) => s.id === item.id);
      if (match) {
        if (asDraft) {
          const isDifferent = match.sortOrder !== item.sortOrder;
          if (isDifferent || match.hasDraft) {
            match.hasDraft = true;
            match.draftPayload = {
              ...(match.draftPayload || {}),
              sortOrder: item.sortOrder,
            };
            match.sortOrder = item.sortOrder;
          }
        } else {
          match.sortOrder = item.sortOrder;
          match.hasDraft = false;
        }
      }
    }
    services.sort((a, b) => a.sortOrder - b.sortOrder);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
    }

    await this.postApi({
      action: 'reorder_services',
      orderList,
      asDraft,
    });

    await this.logAction(
      asDraft ? 'edit' : 'reorder',
      'service',
      'all',
      asDraft ? 'Menyimpan draft urutan layanan' : 'Mengubah urutan layanan',
      user
    );
  }

  public async deleteService(serviceId: string, user?: { id?: string; name?: string }): Promise<void> {
    const services = await this.getServices(false);
    const filtered = services.filter((s) => s.id !== serviceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(filtered));
    }

    await this.postApi({
      action: 'delete_service',
      serviceId,
    });

    await this.logAction('delete', 'service', serviceId, `Menghapus layanan ${serviceId}`, user);
  }

  // =========================================================================
  // Announcements Management (Pengumuman Portal)
  // =========================================================================
  public async getAnnouncements(includeDraft = false): Promise<PortalManagedAnnouncement[]> {
    let list: PortalManagedAnnouncement[] = [];

    // 1. Coba fetch dari API server
    const apiUrl = getApiUrl(`/api/portal?entity=announcements&includeDraft=${includeDraft}`);
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.announcements)) {
            list = body.announcements;
            if (typeof window !== 'undefined' && !includeDraft) {
              localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(list));
            }
            return list;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Direct Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_portal_announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          list = data.map((row: any) => ({
            id: row.id,
            title: { id: row.title_id, en: row.title_en || row.title_id },
            body: { id: row.body_id, en: row.body_en || row.body_id },
            ctaText: { id: row.cta_text_id || 'Lihat Layanan', en: row.cta_text_en || 'View Services' },
            ctaHref: row.cta_href || '#direktori-layanan',
            format: row.format || 'text',
            posterSrc: row.poster_src || undefined,
            type: row.type || 'info',
            priority: row.priority || 1,
            startDate: row.start_date || undefined,
            endDate: row.end_date || undefined,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: Boolean(row.draft_payload),
            draftPayload: row.draft_payload || undefined,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by,
          }));

          if (typeof window !== 'undefined' && !includeDraft) {
            localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(list));
          }
        }
      } catch {
        // fallback
      }
    }

    // 3. Fallback localStorage
    if (list.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS);
        if (raw) list = JSON.parse(raw);
        else list = DEFAULT_ANNOUNCEMENTS;
      } catch {
        list = DEFAULT_ANNOUNCEMENTS;
      }
    }

    if (includeDraft) {
      return list.map((a) => {
        if (a.hasDraft && a.draftPayload) {
          return {
            ...a,
            ...a.draftPayload,
            hasDraft: true,
            draftPayload: a.draftPayload,
          };
        }
        return a;
      });
    }

    return list;
  }

  public async saveAnnouncement(
    announcement: Partial<PortalManagedAnnouncement> & { id?: string },
    asDraft = true,
    user?: { id?: string; name?: string }
  ): Promise<PortalManagedAnnouncement> {
    const announcements = await this.getAnnouncements(false);
    const id = announcement.id || `ann-${Date.now()}`;
    const idx = announcements.findIndex((a) => a.id === id);

    let updated: PortalManagedAnnouncement;

    if (idx >= 0) {
      const existing = announcements[idx];
      if (asDraft) {
        updated = {
          ...existing,
          hasDraft: true,
          draftPayload: {
            ...existing.draftPayload,
            ...announcement,
          },
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      } else {
        // Enforce max 1 active published announcement locally as well
        if (announcement.isActive ?? true) {
          announcements.forEach((a) => {
            if (a.id !== id && a.isPublished) a.isActive = false;
          });
        }
        updated = {
          ...existing,
          ...announcement,
          hasDraft: false,
          draftPayload: undefined,
          isPublished: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      }
      announcements[idx] = updated;
    } else {
      if (!asDraft && (announcement.isActive ?? true)) {
        announcements.forEach((a) => {
          if (a.isPublished) a.isActive = false;
        });
      }
      updated = {
        id,
        title: announcement.title || { id: 'Pengumuman Baru', en: 'New Announcement' },
        body: announcement.body || { id: 'Isi pengumuman', en: 'Announcement body' },
        ctaText: announcement.ctaText || { id: 'Pelajari Selengkapnya', en: 'Learn More' },
        ctaHref: announcement.ctaHref || '#direktori-layanan',
        format: announcement.format || 'text',
        posterSrc: announcement.posterSrc,
        startDate: announcement.startDate || new Date().toISOString().split('T')[0],
        endDate: announcement.endDate,
        isActive: announcement.isActive ?? true,
        isPublished: !asDraft,
        hasDraft: asDraft,
        draftPayload: asDraft ? announcement : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Operator Hub',
      };
      announcements.unshift(updated);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements));
    }

    await this.postApi({
      action: 'save_announcement',
      announcement: { ...announcement, id },
      asDraft,
    });

    await this.logAction(
      idx >= 0 ? 'edit' : 'create',
      'announcement',
      id,
      asDraft ? 'Menyimpan draft pengumuman' : 'Menerbitkan pengumuman',
      user
    );

    return updated;
  }

  public async publishAnnouncement(id: string, user?: { id?: string; name?: string }): Promise<void> {
    const announcements = await this.getAnnouncements(false);
    const idx = announcements.findIndex((a) => a.id === id);
    if (idx !== -1) {
      // Deactivate other published announcements to enforce single active rule
      announcements.forEach((a) => {
        if (a.id !== id && a.isPublished) a.isActive = false;
      });

      const a = announcements[idx];
      if (a.hasDraft && a.draftPayload) {
        announcements[idx] = {
          ...a,
          ...a.draftPayload,
          hasDraft: false,
          draftPayload: undefined,
          isActive: true,
          isPublished: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Operator Hub',
        };
      } else {
        announcements[idx].isActive = true;
        announcements[idx].isPublished = true;
        announcements[idx].hasDraft = false;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements));
      }
    }

    await this.postApi({
      action: 'publish_announcement',
      id,
    });

    await this.logAction('publish', 'announcement', id, 'Memublikasikan pengumuman portal (maksimal 1 aktif)', user);
  }

  public async deleteAnnouncement(id: string, user?: { id?: string; name?: string }): Promise<void> {
    const announcements = await this.getAnnouncements(false);
    const filtered = announcements.filter((a) => a.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(filtered));
    }

    await this.postApi({
      action: 'delete_announcement',
      id,
    });

    await this.logAction('delete', 'announcement', id, `Menghapus pengumuman portal ${id}`, user);
  }

  // =========================================================================
  // Settings Management
  // =========================================================================
  public async getSettings(includeDraft = false): Promise<PortalSettings> {
    let settings = DEFAULT_SETTINGS;
    let isLoadedFromBackend = false;

    // 1. Coba fetch dari server API
    const apiUrl = getApiUrl(`/api/portal?entity=settings&includeDraft=${includeDraft}`);
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.settings) {
            settings = body.settings;
            isLoadedFromBackend = true;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
            }
            return settings;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Direct Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_portal_settings')
          .select('*')
          .eq('id', 'global')
          .maybeSingle();

        if (!error && data) {
          settings = {
            id: data.id,
            heroTitle: {
              line1: data.hero_title_1,
              line2: data.hero_title_2,
            },
            heroDesc: data.hero_desc,
            helpWaNumber: data.help_wa_number,
            footerSignature: data.footer_signature,
            footerCopyright: data.footer_copyright,
            isPublished: Boolean(data.is_published),
            hasDraft: Boolean(data.draft_payload),
            draftPayload: data.draft_payload || undefined,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
          };
          isLoadedFromBackend = true;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
          }
        }
      } catch {
        // fallback
      }
    }

    // 3. Fallback localStorage hanya bila backend gagal dijangkau
    if (!isLoadedFromBackend && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (raw) settings = JSON.parse(raw);
      } catch {
        settings = DEFAULT_SETTINGS;
      }
    }

    if (includeDraft && settings.hasDraft && settings.draftPayload) {
      return {
        ...settings,
        ...settings.draftPayload,
        hasDraft: true,
        draftPayload: settings.draftPayload,
      };
    }

    return settings;
  }

  public async saveSettings(
    payload: Partial<PortalSettings>,
    asDraft = true,
    user?: { id?: string; name?: string }
  ): Promise<PortalSettings> {
    const current = await this.getSettings(false);
    let updated: PortalSettings;

    if (asDraft) {
      updated = {
        ...current,
        hasDraft: true,
        draftPayload: {
          ...current.draftPayload,
          ...payload,
        },
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Operator Hub',
      };
    } else {
      updated = {
        ...current,
        ...payload,
        hasDraft: false,
        draftPayload: undefined,
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Operator Hub',
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    }

    await this.postApi({
      action: 'save_settings',
      settings: asDraft ? (updated.draftPayload || payload) : updated,
      asDraft,
    });

    await this.logAction(
      'edit',
      'settings',
      'global',
      asDraft ? 'Menyimpan draft pengaturan portal' : 'Memperbarui pengaturan portal',
      user
    );

    return updated;
  }

  public async publishSettings(user?: { id?: string; name?: string }): Promise<void> {
    const current = await this.getSettings(false);
    if (current.hasDraft && current.draftPayload) {
      const published: PortalSettings = {
        ...current,
        ...current.draftPayload,
        hasDraft: false,
        draftPayload: undefined,
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Operator Hub',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(published));
      }

      await this.postApi({
        action: 'save_settings',
        settings: published,
        asDraft: false,
      });

      await this.logAction('publish', 'settings', 'global', 'Memublikasikan pengaturan portal', user);
    }
  }

  // =========================================================================
  // Global Publish All
  // =========================================================================
  public async publishAllDrafts(user?: { id?: string; name?: string }): Promise<{ publishedCount: number }> {
    let count = 0;
    let localCount = 0;

    const res = await this.postApi({
      action: 'publish_all_drafts',
    });

    // Also sync local cache
    const services = await this.getServices(false);
    for (const s of services) {
      if (s.hasDraft && s.draftPayload) {
        Object.assign(s, s.draftPayload);
        s.hasDraft = false;
        s.draftPayload = undefined;
        s.isPublished = true;
        localCount++;
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
    }

    const announcements = await this.getAnnouncements(false);
    for (const a of announcements) {
      if (a.hasDraft && a.draftPayload) {
        Object.assign(a, a.draftPayload);
        a.hasDraft = false;
        a.draftPayload = undefined;
        a.isPublished = true;
        localCount++;
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements));
    }

    const settings = await this.getSettings(false);
    if (settings.hasDraft && settings.draftPayload) {
      Object.assign(settings, settings.draftPayload);
      settings.hasDraft = false;
      settings.draftPayload = undefined;
      settings.isPublished = true;
      localCount++;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      }
    }

    if (res && res.success) {
      count = res.publishedCount ?? localCount;
    } else {
      count = localCount;
    }

    if (count > 0) {
      await this.logAction('publish', 'settings', 'all', `Memublikasikan seluruh draft (${count} item)`, user);
    }

    return { publishedCount: count };
  }

  // =========================================================================
  // Public Reader & Preview Reader Helper
  // =========================================================================
  public async getPublicPortalData(): Promise<{
    services: PortalManagedService[];
    announcements: PortalManagedAnnouncement[];
    settings: PortalSettings;
  }> {
    const allServices = await this.getServices(false);
    const allAnnouncements = await this.getAnnouncements(false);
    const settings = await this.getSettings(false);

    const nowStr = new Date().toISOString().split('T')[0];

    // Filter hanya layanan aktif, published, dan memiliki hak tampil publik (pub !== 0)
    const publicServices = allServices.filter((s) => {
      if (!s.isActive || !s.isPublished || s.pub === 0) return false;
      if (s.isSeasonal) {
        if (s.seasonalStart && s.seasonalStart > nowStr) return false;
        if (s.seasonalEnd && s.seasonalEnd < nowStr) return false;
      }
      return true;
    });

    // Filter pengumuman yang sedang aktif periode berlakunya (maksimal 1 aktif pada satu waktu)
    const activeAnnouncements = allAnnouncements.filter((a) => {
      if (!a.isActive || !a.isPublished) return false;
      if (a.startDate && a.startDate > nowStr) return false;
      if (a.endDate && a.endDate < nowStr) return false;
      return true;
    });

    return {
      services: publicServices,
      announcements: activeAnnouncements.slice(0, 1), // Enforce max 1 active announcement
      settings,
    };
  }

  public async getPreviewPortalData(): Promise<{
    services: PortalManagedService[];
    announcements: PortalManagedAnnouncement[];
    settings: PortalSettings;
  }> {
    // Mode Preview menyertakan data draft
    const allServices = await this.getServices(true);
    const allAnnouncements = await this.getAnnouncements(true);
    const settings = await this.getSettings(true);

    const nowStr = new Date().toISOString().split('T')[0];

    const previewServices = allServices.filter((s) => {
      if (!s.isActive) return false;
      if (s.isSeasonal) {
        if (s.seasonalStart && s.seasonalStart > nowStr) return false;
        if (s.seasonalEnd && s.seasonalEnd < nowStr) return false;
      }
      return true;
    });

    return {
      services: previewServices,
      announcements: allAnnouncements.filter((a) => a.isActive),
      settings,
    };
  }
}

export const portalManagementService = new PortalManagementService();
