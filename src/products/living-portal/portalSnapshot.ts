import type {
  PortalManagedService,
  PortalManagedAnnouncement,
  PortalSettings,
} from '../hub/portal-management/types';

/**
 * Satu snapshot data portal publik. Seluruh komponen publik membaca dari objek ini,
 * tidak ada komponen yang memuat atau menampilkan fallback sendiri.
 */
export interface PortalSnapshot {
  services: PortalManagedService[];
  announcements: PortalManagedAnnouncement[];
  settings: PortalSettings;
}

export type PortalLoadState =
  | { status: 'initializing' }
  | { status: 'ready'; snapshot: PortalSnapshot }
  | { status: 'error'; message: string };

export class PortalSnapshotError extends Error {
  constructor(
    message: string,
    readonly code: 'network' | 'timeout' | 'http' | 'invalid_payload'
  ) {
    super(message);
    this.name = 'PortalSnapshotError';
  }
}

export const PORTAL_REQUEST_TIMEOUT_MS = 20_000;

interface LoadOptions {
  /** Preview draft hanya berlaku bagi sesi pengelola; sesi publik tetap menerima data published. */
  includeDraft?: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function fetchPortalEntity(
  entity: 'services' | 'announcements' | 'settings',
  includeDraft: boolean,
  signal: AbortSignal
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`/api/portal?entity=${entity}&includeDraft=${includeDraft}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err) {
    if (signal.aborted) {
      throw new PortalSnapshotError('Permintaan data portal melewati batas waktu.', 'timeout');
    }
    throw new PortalSnapshotError('Koneksi ke server portal gagal.', 'network');
  }

  if (!response.ok) {
    throw new PortalSnapshotError(`Server portal menjawab ${response.status}.`, 'http');
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!body || body.success !== true) {
    throw new PortalSnapshotError('Respons data portal tidak valid.', 'invalid_payload');
  }
  return body;
}

function withinWindow(start: string | undefined, end: string | undefined, today: string): boolean {
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

/**
 * Memuat services, announcements, dan settings secara paralel lalu merakitnya menjadi satu
 * snapshot. Layanan dan konfigurasi wajib tersedia; pengumuman boleh kosong. Tidak membaca localStorage, tidak
 * memakai katalog hardcoded, dan tidak menulis cache.
 */
export async function loadPortalSnapshot(options: LoadOptions = {}): Promise<PortalSnapshot> {
  const includeDraft = options.includeDraft === true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PORTAL_REQUEST_TIMEOUT_MS);

  try {
    const [servicesBody, announcementsBody, settingsBody] = await Promise.all([
      fetchPortalEntity('services', includeDraft, controller.signal),
      fetchPortalEntity('announcements', includeDraft, controller.signal).catch(() => {
        // Pengumuman bersifat opsional; jangan gagalkan seluruh portal jika hanya pengumuman yang kosong/kendala
        return { success: true, announcements: [] };
      }),
      fetchPortalEntity('settings', includeDraft, controller.signal),
    ]);

    const rawServices = servicesBody.services;
    const rawAnnouncements = announcementsBody.announcements || [];
    const rawSettings = settingsBody.settings as PortalSettings | undefined;

    if (!Array.isArray(rawServices) || !Array.isArray(rawAnnouncements) || !rawSettings) {
      throw new PortalSnapshotError('Struktur data portal tidak lengkap.', 'invalid_payload');
    }
    if (!includeDraft && rawSettings.isPublished !== true) {
      throw new PortalSnapshotError('Konfigurasi portal published belum tersedia.', 'invalid_payload');
    }
    if (
      !isNonEmptyString(rawSettings.heroTitle?.line1) ||
      !isNonEmptyString(rawSettings.heroTitle?.line2) ||
      typeof rawSettings.heroDesc !== 'string'
    ) {
      throw new PortalSnapshotError('Konfigurasi portal belum lengkap.', 'invalid_payload');
    }

    const today = new Date().toISOString().split('T')[0];

    const services = (rawServices as PortalManagedService[])
      .filter((s) => {
        if (!s.isActive) return false;
        if (!includeDraft && (!s.isPublished || s.pub === 0)) return false;
        return !s.isSeasonal || withinWindow(s.seasonalStart, s.seasonalEnd, today);
      })
      .map((s) => (includeDraft ? s : { ...s, hasDraft: false, draftPayload: undefined }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const activeAnnouncements = (rawAnnouncements as PortalManagedAnnouncement[])
      .filter((a) => {
        if (!a.isActive) return false;
        if (includeDraft) return true;
        return a.isPublished && withinWindow(a.startDate, a.endDate, today);
      })
      .map((a) => (includeDraft ? a : { ...a, hasDraft: false, draftPayload: undefined }));

    return {
      services,
      announcements: includeDraft ? activeAnnouncements : activeAnnouncements.slice(0, 1),
      settings: includeDraft ? rawSettings : { ...rawSettings, hasDraft: false, draftPayload: undefined },
    };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

const inflight = new Map<string, Promise<PortalSnapshot>>();

/**
 * Permintaan yang sedang berjalan dipakai bersama (StrictMode, beberapa komponen). Hasil tidak
 * disimpan setelah selesai, sehingga setiap kunjungan dan setiap "Coba Lagi" membaca data terbaru.
 */
export function requestPortalSnapshot(options: LoadOptions = {}): Promise<PortalSnapshot> {
  const key = options.includeDraft ? 'draft' : 'published';
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loadPortalSnapshot(options).finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
