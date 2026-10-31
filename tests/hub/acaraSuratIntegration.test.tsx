import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleDokumenApiRequest } from '../../api/_routes/dokumen';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import { docsStore } from '../../src/products/hub/dokumen-saya/docsStore';
import { dokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';

describe('Integrasi Surat Tugas & Izin Pengeluaran Barang dari Detail Acara', () => {
  const authSecret = process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || 'ptvpro-secret-key-at-least-32-chars-long-123456';

  // Sesi pimpinan / eksekutif dengan hak approve
  const execSessionToken = signSessionToken(
    {
      account_id: '11111111-2222-3333-4444-555555555555',
      identity_id: 'ident-exec-1',
      username: 'zidna',
      full_name: 'M. Zidna Ilma Roup',
      ptv_id: 'PTV-001',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['eksekutif', 'admin'],
      capabilities: ['documents.approve', 'documents.archive.manage', 'events.manage'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    authSecret
  );

  // Sesi kru biasa tanpa hak approve dokumen
  const crewSessionToken = signSessionToken(
    {
      account_id: '99999999-8888-7777-6666-555555555555',
      identity_id: 'ident-crew-1',
      username: 'dimas',
      full_name: 'Muhammad Dimas Prayoga',
      ptv_id: 'PTV-015',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['kru'],
      capabilities: ['events.view', 'documents.request', 'gear.use'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    authSecret
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Validasi Keamanan Backend Auto-Approval (api/dokumen.ts)', () => {
    it('menyetujui otomatis (Disetujui) Izin Pengeluaran Barang dari Detail Acara jika diterbitkan oleh pejabat berwenang', async () => {
      const res = await handleDokumenApiRequest({
        method: 'POST',
        url: '/api/dokumen?action=create',
        headers: {
          cookie: `ptv_hub_session=${execSessionToken}`,
        },
        body: {
          type: 'Izin Membawa Barang',
          subject: 'Surat Izin Membawa Peralatan: Haul Solo 2026',
          start_date: '2026-10-25',
          end_date: '2026-10-25',
          pembawa: 'Muhammad Dimas Prayoga',
          penanggung_jawab: 'M. Zidna Ilma Roup',
          items: ['Sony FX3 (CAM-01)', 'Tripod Sachtler Ace'],
          unit_ids: ['u-cam-01', 'u-trp-01'],
          source: 'acara',
          event_id: 'acara-haul-solo-2026',
          event: 'Haul Solo 2026',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.auto_approved).toBe(true);
      expect(res.body.document.status).toBe('Disetujui');
      expect(res.body.document.no).toMatch(/^\d{3}\/SBB-PTV\/[A-Z]+\/2026$/);
      expect(res.body.document.event_id).toBe('acara-haul-solo-2026');
      expect(res.body.document.approved_at).toBeDefined();

      // Memastikan audit status history tercatat lengkap
      const history = res.body.document.status_history;
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].status).toBe('Menunggu');
      expect(history[1].status).toBe('Disetujui');
      expect(history[1].actor).toContain('Zidna');
    });

    it('TIDAK menyetujui otomatis jika dibuat oleh kru biasa walaupun memiliki source=acara', async () => {
      const res = await handleDokumenApiRequest({
        method: 'POST',
        url: '/api/dokumen?action=create',
        headers: {
          cookie: `ptv_hub_session=${crewSessionToken}`,
        },
        body: {
          type: 'Izin Membawa Barang',
          subject: 'Permohonan Bawa Alat Liputan',
          start_date: '2026-10-25',
          end_date: '2026-10-25',
          pembawa: 'Muhammad Dimas Prayoga',
          items: ['Sony A7 IV'],
          source: 'acara',
          event_id: 'acara-haul-solo-2026',
          event: 'Haul Solo 2026',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.auto_approved).toBe(false);
      expect(res.body.document.status).toBe('Menunggu');
      expect(res.body.document.no).toBe('—');
      expect(res.body.document.approved_at).toBeUndefined();
    });

    it('Izin Barang dari jalur biasa (source !== acara) tetap berstatus Menunggu review', async () => {
      const res = await handleDokumenApiRequest({
        method: 'POST',
        url: '/api/dokumen?action=create',
        headers: {
          cookie: `ptv_hub_session=${crewSessionToken}`,
        },
        body: {
          type: 'Izin Membawa Barang',
          subject: 'Pengajuan Mandiri Alat Kantor',
          start_date: '2026-10-28',
          pembawa: 'Muhammad Dimas Prayoga',
          items: ['Laptop Dell XPS'],
          source: 'perizinan', // bukan acara
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('Menunggu');
      expect(res.body.document.no).toBe('—');
    });

    it('menerbitkan Surat Tugas resmi berstatus Disetujui jika dibuat oleh pemegang wewenang eksekutif', async () => {
      const res = await handleDokumenApiRequest({
        method: 'POST',
        url: '/api/dokumen?action=create',
        headers: {
          cookie: `ptv_hub_session=${execSessionToken}`,
        },
        body: {
          type: 'Surat Tugas',
          subject: 'Surat Tugas Peliputan Haul Akbar',
          start_date: '2026-10-25',
          penanggung_jawab: 'M. Zidna Ilma Roup',
          recipients: ['Dimas', 'Farras', 'Rizal'],
          source: 'acara',
          event_id: 'acara-haul-solo-2026',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('Disetujui');
      expect(res.body.document.no).toMatch(/^\d{3}\/ST-PTV\/[A-Z]+\/2026$/);
      expect(res.body.document.recipients).toEqual(['Dimas', 'Farras', 'Rizal']);
    });

    it('menolak method HTTP selain GET dan POST', async () => {
      const res = await handleDokumenApiRequest({
        method: 'DELETE',
        headers: {
          cookie: `ptv_hub_session=${execSessionToken}`,
        },
      });

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('method_not_allowed');
    });
  });

  describe('2. Client Service & Local Store Integration (dokumenService & docsStore)', () => {
    it('dapat membuat dan menyimpan dokumen terhubung dengan event_id ke docsStore', async () => {
      const created = await dokumenService.createDocument({
        type: 'Izin Membawa Barang',
        subject: 'Izin Bawa Kamera Liputan Acara Pengajian',
        date: '2026-10-29',
        pembawa: 'Zidna',
        items: ['Sony A7S III (CAM-02)'],
        unit_ids: ['u-cam-02'],
        source: 'acara',
        event_id: 'ev-pengajian-123',
        event: 'Pengajian Rutin Ahad Pagi',
      });

      expect(created).toBeDefined();
      expect(created.event_id).toBe('ev-pengajian-123');
      expect(created.status).toBe('Disetujui');
      expect(created.no).toMatch(/^\d{3}\/SBB-PTV\/[A-Z]+\/2026$/);

      // Verifikasi tersimpan di docsStore
      const foundInStore = docsStore.getById(created.id);
      expect(foundInStore).toBeDefined();
      expect(foundInStore?.subject).toBe(created.subject);
      expect(foundInStore?.event_id).toBe('ev-pengajian-123');
    });

    it('mampu mencegah nomor surat duplikat pada penerbitan berturut-turut', async () => {
      const doc1 = await dokumenService.createDocument({
        type: 'Surat Tugas',
        subject: 'Penugasan Kru 1',
        start_date: '2026-10-25',
        recipients: ['Kru A'],
        source: 'acara',
        event_id: 'ev-test-1',
      });

      const doc2 = await dokumenService.createDocument({
        type: 'Surat Tugas',
        subject: 'Penugasan Kru 2',
        start_date: '2026-10-25',
        recipients: ['Kru B'],
        source: 'acara',
        event_id: 'ev-test-2',
      });

      expect(doc1.no).not.toBe('—');
      expect(doc2.no).not.toBe('—');
      expect(doc1.no).not.toBe(doc2.no);
    });
  });

  describe('3. Prefill Form & UI Components (AjukanTugasModal & AjukanBarangModal)', () => {
    it('3.1 AjukanTugasModal mengisi otomatis perihal, tanggal, dan kru dari event', async () => {
      const { AjukanTugasModal } = await import('../../src/products/hub/perizinan/components/AjukanTugasModal');
      const { renderToString } = await import('react-dom/server');

      const html = renderToString(
        <AjukanTugasModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            eventId: 'ev-haul-solo-01',
            eventName: 'Siaran Langsung Haul Solo',
            date: '2026-10-25',
            loc: 'Pasar Kliwon, Solo',
            crew: ['M. Zidna Ilma Roup', 'Muhammad Dimas Prayoga'],
          }}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Siaran Langsung Haul Solo');
      expect(html).toContain('2026-10-25');
      expect(html).toContain('Kirim Pengajuan Surat Tugas');
      expect(html).not.toContain('Fitur administrasi');
    });

    it('3.2 AjukanBarangModal mengisi otomatis perihal, tanggal, dan unit alat yang dialokasikan', async () => {
      const { AjukanBarangModal } = await import('../../src/products/hub/perizinan/components/AjukanBarangModal');
      const { renderToString } = await import('react-dom/server');

      const html = renderToString(
        <AjukanBarangModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            eventId: 'ev-haul-solo-01',
            eventName: 'Siaran Langsung Haul Solo',
            date: '2026-10-25',
            loc: 'Pasar Kliwon, Solo',
            pembawa: 'Dimas Prayoga',
            gearAllocations: [
              {
                name: 'Sony FX3 Cinema Line',
                code: 'CAM-01',
                units: [{ unit: 1, code: 'CAM-01' }],
              },
            ],
          }}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Siaran Langsung Haul Solo');
      expect(html).toContain('2026-10-25');
      expect(html).toContain('Kirim Pengajuan Izin Barang');
      expect(html).not.toContain('Fitur administrasi');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
