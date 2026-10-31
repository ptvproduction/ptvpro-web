import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Memory storage polyfill for Vitest Node environment
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0,
  } as Storage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    localStorage: globalThis.localStorage,
  };
}

import { portalManagementService } from '../../src/products/hub/portal-management/services/portalManagementService';
import { LivingStatusContent } from '../../src/products/living-portal/status/LivingStatusPage';
import { HelpDialogModal } from '../../src/products/living-portal/components/HelpDialogModal';
import { routes } from '../../src/app/router';
import type { PortalSnapshot } from '../../src/products/living-portal/portalSnapshot';

describe('Portal Management & Status Service Integration', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Reset baseline data
    const services = await portalManagementService.getServices();
    // Pastikan ter-seed seluruh layanan resmi (6 layanan)
    expect(services.length).toBeGreaterThanOrEqual(6);
  });

  it('1. Mengambil layanan default dan memfilter draft vs public', async () => {
    const publicData = await portalManagementService.getPublicPortalData();
    const previewData = await portalManagementService.getPreviewPortalData();
    expect(previewData.services.length).toBeGreaterThanOrEqual(publicData.services.length);

    // Data publik harus hanya berisi yang is_published === true
    expect(publicData.services.every((s) => s.isPublished)).toBe(true);

    // Ambil service pertama dan jadikan draft
    const firstService = publicData.services[0];
    await portalManagementService.saveService(
      {
        id: firstService.id,
        name: { id: 'Layanan Terubah di Draft', en: 'Draft Service Name' },
      },
      true, // asDraft
      { id: 'user-test', name: 'Tester' }
    );

    // Cek bahwa di public masih data asli sebelum publish
    const publicDataAfterDraft = await portalManagementService.getPublicPortalData();
    const publicTarget = publicDataAfterDraft.services.find((s) => s.id === firstService.id);
    expect(publicTarget?.name.id).not.toBe('Layanan Terubah di Draft');

    // Cek bahwa di preview sudah menampilkan draft
    const previewDataAfterDraft = await portalManagementService.getPreviewPortalData();
    const previewTarget = previewDataAfterDraft.services.find((s) => s.id === firstService.id);
    expect(previewTarget?.name.id).toBe('Layanan Terubah di Draft');
  });

  it('2. Mempublikasikan draft layanan ke publik dengan audit log', async () => {
    const services = await portalManagementService.getServices();
    const target = services[0];

    // Simpan perubahan sebagai draft
    await portalManagementService.saveService(
      {
        id: target.id,
        desc: { id: 'Deskripsi baru yang siap dipublish', en: 'New published description' },
      },
      true,
      { id: 'user-test', name: 'Tester' }
    );

    // Publish seluruh draft
    const result = await portalManagementService.publishAllDrafts({ id: 'user-test', name: 'Tester' });
    expect(result.publishedCount).toBeGreaterThanOrEqual(1);

    // Periksa bahwa data publik sekarang terupdate
    const publicData = await portalManagementService.getPublicPortalData();
    const publishedService = publicData.services.find((s) => s.id === target.id);
    expect(publishedService?.desc.id).toBe('Deskripsi baru yang siap dipublish');
    expect(publishedService?.hasDraft).toBe(false);

    // Periksa audit log tercatat
    const auditLogs = await portalManagementService.getAuditLogs();
    expect(auditLogs.some((l) => l.action === 'publish')).toBe(true);
  });

  it('3. Mengubah status operasional layanan dan memperbarui catatan pembaruan', async () => {
    const services = await portalManagementService.getServices();
    const target = services[0];

    await portalManagementService.updateServiceStatus(
      target.id,
      'incident',
      'Sedang terjadi kendala CDN video',
      { id: 'operator-test', name: 'Operator Test' }
    );

    const updatedServices = await portalManagementService.getServices();
    const updated = updatedServices.find((s) => s.id === target.id);
    expect(updated?.st).toBe('incident');
    expect(updated?.statusNote).toBe('Sedang terjadi kendala CDN video');

    const auditLogs = await portalManagementService.getAuditLogs();
    expect(auditLogs.some((l) => l.action === 'status_change' && l.entityId === target.id)).toBe(true);
  });

  it('4. CRUD Pengumuman publik', async () => {
    const newAnnouncement = await portalManagementService.saveAnnouncement(
      {
        title: { id: 'Pemeliharaan Terjadwal Lebaran', en: 'Scheduled Maintenance' },
        body: { id: 'Server akan dioptimasi pada pukul 02:00 WIB', en: 'Server will be optimized' },
        type: 'warning',
        format: 'text',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        isActive: true,
        priority: 1,
      },
      false, // langsung publish
      { id: 'user-test', name: 'Tester' }
    );

    expect(newAnnouncement.id).toBeDefined();

    const publicData = await portalManagementService.getPublicPortalData();
    expect(publicData.announcements.some((a) => a.id === newAnnouncement.id)).toBe(true);

    // Update pengumuman
    await portalManagementService.saveAnnouncement(
      {
        id: newAnnouncement.id,
        title: { id: 'Pemeliharaan Terjadwal Lebaran Diperbarui', en: 'Updated Maintenance' },
      },
      false,
      { id: 'user-test', name: 'Tester' }
    );

    const announcements = await portalManagementService.getAnnouncements();
    const updated = announcements.find((a) => a.id === newAnnouncement.id);
    expect(updated?.title.id).toBe('Pemeliharaan Terjadwal Lebaran Diperbarui');
  });
});

describe('LivingStatusPage & Route Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Route Configuration Check: /status-layanan, /preview/status-layanan, dan /hub/portal terdaftar', () => {
    const canonicalStatusRoute = routes.find((r) => r.path === '/status-layanan');
    expect(canonicalStatusRoute).toBeDefined();
    expect(React.isValidElement(canonicalStatusRoute?.element)).toBe(true);

    const statusRoute = routes.find((r) => r.path === '/preview/status-layanan');
    expect(statusRoute).toBeDefined();
    expect(React.isValidElement(statusRoute?.element)).toBe(true);

    const hubRoute = routes.find((r) => r.path === '/hub');
    expect(hubRoute).toBeDefined();
    const portalChild = hubRoute?.children?.find((c) => c.path === 'portal');
    expect(portalChild).toBeDefined();
  });

  it('2. Merender LivingStatusPage via renderToString tanpa crash (initial init screen & content)', async () => {
    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/status-layanan'],
    });

    const initHtml = renderToString(<RouterProvider router={memoryRouter} />);
    expect(initHtml).toContain('lp-init');
    expect(initHtml).toContain('Menyiapkan portal');

    const services = await portalManagementService.getServices();
    const settings = await portalManagementService.getSettings();
    const mockSnapshot: PortalSnapshot = {
      services,
      announcements: [],
      settings,
    };

    const contentRouter = createMemoryRouter(
      [
        {
          path: '/status-layanan',
          element: <LivingStatusContent snapshot={mockSnapshot} />,
        },
      ],
      { initialEntries: ['/status-layanan'] }
    );
    const html = renderToString(<RouterProvider router={contentRouter} />);
    expect(html).toContain('STATUS SISTEM &amp; LAYANAN PUBLIK');
    expect(html).toContain('Kondisi Layanan.');
    expect(html).toMatch(/Seluruh Layanan (Aktif )?Beroperasi Normal/);
    expect(html).toContain('Progresif TV');
  });

  it('3. Menampilkan status indikator gangguan pada HTML ketika ada status incident', async () => {
    const services = await portalManagementService.getServices();
    await portalManagementService.updateServiceStatus(
      services[0].id,
      'incident',
      'Kendala transmisi siaran',
      { id: 'operator-test', name: 'Operator Test' }
    );
    const updatedServices = await portalManagementService.getServices();
    const settings = await portalManagementService.getSettings();

    const mockSnapshot: PortalSnapshot = {
      services: updatedServices,
      announcements: [],
      settings,
    };

    const memoryRouter = createMemoryRouter(
      [
        {
          path: '/preview/status-layanan',
          element: <LivingStatusContent snapshot={mockSnapshot} isPreviewDraft={true} />,
        },
      ],
      { initialEntries: ['/preview/status-layanan'] }
    );

    const html = renderToString(<RouterProvider router={memoryRouter} />);
    expect(html).toContain('STATUS SISTEM &amp; LAYANAN PUBLIK');
    expect(html).toContain('Kondisi Layanan.');
    expect(html).toContain('Kendala transmisi siaran');
  });
});

describe('Modal Background Scroll Lock Behavior & Dialog Manager', () => {
  it('1. HelpDialogModal merender role="dialog" dan aria-modal="true"', () => {
    const html = renderToString(
      <HelpDialogModal isOpen={true} onClose={() => {}} />
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('PUSAT BANTUAN WHATSAPP');
    expect(html).toContain('Butuh bantuan?');
  });

  it('2. HelpDialogModal tidak merender elemen saat isOpen false', () => {
    const html = renderToString(
      <HelpDialogModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });
});
