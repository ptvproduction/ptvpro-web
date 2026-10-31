import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PortalInitScreen } from '../../src/products/living-portal/components/PortalInitScreen';
import {
  loadPortalSnapshot,
  requestPortalSnapshot,
  PortalSnapshotError,
} from '../../src/products/living-portal/portalSnapshot';

describe('Portal Loading Lifecycle & Zero Content Flash', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. PortalInitScreen renders indeterminate loading state without fake percentage or generic AI slop', () => {
    const html = renderToString(<PortalInitScreen status="initializing" />);
    expect(html).toContain('lp-init');
    expect(html).toContain('lp-init-track');
    expect(html).toContain('lp-init-bar');
    expect(html).toContain('Menyiapkan portal layanan');
    expect(html).not.toContain('%');
    expect(html).not.toContain('Loading...');
  });

  it('2. PortalInitScreen renders slow-network notice when isSlow is true', () => {
    const html = renderToString(<PortalInitScreen status="initializing" isSlow={true} />);
    expect(html).toContain('Koneksi terasa lambat. Portal masih disiapkan.');
    expect(html).not.toContain('%');
  });

  it('3. PortalInitScreen renders error state with clean explanation and Coba Lagi button', () => {
    const html = renderToString(
      <PortalInitScreen
        status="error"
        errorMessage="Koneksi server terputus."
        onRetry={() => {}}
      />
    );
    expect(html).toContain('Portal belum dapat dimuat');
    expect(html).toContain('Koneksi server terputus.');
    expect(html).toContain('Coba Lagi');
  });

  it('4. loadPortalSnapshot fails cleanly without returning hardcoded mock catalog disguised as live data', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(loadPortalSnapshot()).rejects.toThrow(PortalSnapshotError);
  });

  it('5. loadPortalSnapshot aggregates services, announcements, and settings concurrently', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('entity=services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            services: [
              {
                id: 'svc-ptv-hub',
                name: { id: 'PTV Hub', en: 'PTV Hub' },
                desc: { id: 'Pusat operasional', en: 'Ops Center' },
                cat: 'ptv',
                href: '/hub',
                icon: 'hub',
                st: 'ok',
                pub: 1,
                sortOrder: 1,
                isActive: true,
                isPublished: true,
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes('entity=announcements')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            announcements: [],
          }),
        } as unknown as Response;
      }
      if (url.includes('entity=settings')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            settings: {
              heroTitle: { line1: 'Layanan Resmi', line2: 'Progresif TV' },
              heroDesc: 'Portal terpusat ekosistem digital.',
              isPublished: true,
            },
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const snapshot = await loadPortalSnapshot();
    expect(snapshot.services).toHaveLength(1);
    expect(snapshot.services[0].id).toBe('svc-ptv-hub');
    expect(snapshot.settings.heroTitle.line1).toBe('Layanan Resmi');
  });

  it('6. requestPortalSnapshot deduplicates concurrent in-flight requests', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      return {
        ok: true,
        json: async () => {
          if (url.includes('entity=services')) return { success: true, services: [] };
          if (url.includes('entity=announcements')) return { success: true, announcements: [] };
          return {
            success: true,
            settings: {
              heroTitle: { line1: 'A', line2: 'B' },
              heroDesc: 'C',
              isPublished: true,
            },
          };
        },
      } as unknown as Response;
    });

    const [p1, p2] = await Promise.all([
      requestPortalSnapshot(),
      requestPortalSnapshot(),
    ]);

    expect(p1).toBe(p2);
    // 3 entities fetched once instead of 6
    expect(callCount).toBe(3);
  });

  it('rejects unpublished settings instead of exposing them as the public portal', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url.includes('entity=services')
        ? { success: true, services: [] }
        : url.includes('entity=announcements')
          ? { success: true, announcements: [] }
          : { success: true, settings: { heroTitle: { line1: 'Draft', line2: 'Portal' }, heroDesc: 'Draft', isPublished: false } },
    }));
    await expect(loadPortalSnapshot()).rejects.toThrow('Konfigurasi portal published belum tersedia.');
  });
});
