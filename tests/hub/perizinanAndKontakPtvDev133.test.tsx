import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KontakInternalDetailDrawer } from '../../src/products/hub/kontak/components/KontakInternalDetailDrawer';
import { InternalContact } from '../../src/products/hub/kontak/types';
import { AjukanTugasModal } from '../../src/products/hub/perizinan/components/AjukanTugasModal';
import { AjukanBarangModal } from '../../src/products/hub/perizinan/components/AjukanBarangModal';
import fs from 'fs';
import path from 'path';

// Mock session and kru store
vi.mock('@core/session', () => ({
  useSessionStore: () => ({
    user: {
      full_name: 'M. Zidna Ilma Roup',
      email: 'zidna@progresiftv.id',
    },
  }),
}));

const mockCrewData = {
  members: [
    {
      id: 'crew-01',
      ptv_id: 'PTV-001',
      full_name: 'Ahmad Operasional',
      role: 'kru',
      category: 'Kru',
      division: 'Kamera',
      position: 'Camera Person',
      status_kru: 'Aktif',
      foto_url: 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/kru/ahmad.jpg',
    },
    {
      id: 'crew-02',
      ptv_id: 'PTV-002',
      full_name: 'Budi Nonaktif',
      role: 'kru',
      category: 'Kru',
      division: 'Lighting',
      position: 'Lighting Grip',
      status_kru: 'Nonaktif',
    },
    {
      id: 'crew-03',
      ptv_id: 'PTV-003',
      full_name: 'KH. Pengarah Kehormatan',
      role: 'eksekutif',
      category: 'Pengarah',
      division: 'Pengarah',
      position: 'Dewan Pengarah',
      status_kru: 'Aktif',
    },
    {
      id: 'crew-04',
      ptv_id: 'PTV-004',
      full_name: 'Dr. Pembina Utama',
      role: 'eksekutif',
      category: 'Pembina',
      division: 'Pembina',
      position: 'Dewan Pembina',
      status_kru: 'Aktif',
    },
  ],
  getCurrentUser: () => ({
    full_name: 'M. Zidna Ilma Roup',
  }),
};

vi.mock('@products/hub/kru/kruStore', () => ({
  useCrewStore: () => mockCrewData,
}));

vi.mock('../../src/products/hub/kru/kruStore', () => ({
  useCrewStore: () => mockCrewData,
}));

describe('PTV-DEV-133: Kontak Internal, Surat Tugas, & Izin Bawa Barang Refinements', () => {
  describe('1. Detail Kontak Internal — Pengarah & Pembina', () => {
    it('does NOT render Divisi Kerja or Angkatan for Pengarah and Pembina categories', () => {
      const pengarahContact: InternalContact = {
        id: 'c-01',
        full_name: 'KH. Abdullah Pengarah',
        position: 'Dewan Pengarah PTV',
        unit: 'Pondok Pesantren',
        category: 'Pengarah',
        divisi: 'Pengarah',
        angkatan: 'Pengarah',
        status: 'Aktif',
      };

      const htmlPengarah = renderToString(
        <KontakInternalDetailDrawer
          contact={pengarahContact}
          onClose={() => {}}
        />
      );

      expect(htmlPengarah).not.toContain('Divisi Kerja');
      expect(htmlPengarah).not.toContain('Angkatan Pengarah');
      expect(htmlPengarah).toContain('KH. Abdullah Pengarah');
      expect(htmlPengarah).toContain('Dewan Pengarah PTV');

      const pembinaContact: InternalContact = {
        id: 'c-02',
        full_name: 'Drs. H. Mulyadi Pembina',
        position: 'Dewan Pembina Studio',
        unit: 'Yayasan Progresif',
        category: 'Pembina',
        divisi: 'Pembina',
        angkatan: '1',
        status: 'Aktif',
      };

      const htmlPembina = renderToString(
        <KontakInternalDetailDrawer
          contact={pembinaContact}
          onClose={() => {}}
        />
      );

      expect(htmlPembina).not.toContain('Divisi Kerja');
      expect(htmlPembina).not.toContain('Angkatan 1');
      expect(htmlPembina).toContain('Drs. H. Mulyadi Pembina');
    });

    it('Renders Divisi Kerja and Angkatan normally for operational Kru and Pengurus', () => {
      const operationalCrew: InternalContact = {
        id: 'c-03',
        full_name: 'Muhammad Dimas Prayoga',
        position: 'Camera Person Utama',
        unit: 'Studio PTV',
        category: 'Kru',
        divisi: 'Kamera & Visual',
        angkatan: '11',
        status: 'Aktif',
      };

      const html = renderToString(
        <KontakInternalDetailDrawer
          contact={operationalCrew}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Divisi Kerja');
      expect(html).toContain('Kamera &amp; Visual');
      expect(html).toContain('Angkatan');
      expect(html).toContain('11');
      expect(html).toContain('Muhammad Dimas Prayoga');
    });
  });

  describe('2. Pengajuan Surat Tugas — Personel Kru & Acara Staging', () => {
    it('filters crew list to active operational crew only and renders profile photo with fallback', () => {
      const html = renderToString(
        <AjukanTugasModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={() => {}}
        />
      );

      // Active operational crew is rendered
      expect(html).toContain('Ahmad Operasional');
      expect(html).toContain('PTV-001');

      // Inactive crew is excluded
      expect(html).not.toContain('Budi Nonaktif');

      // Non-operational categories (Pengarah, Pembina) are excluded
      expect(html).not.toContain('KH. Pengarah Kehormatan');
      expect(html).not.toContain('Dr. Pembina Utama');

      // Real photo url is rendered
      expect(html).toContain('https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/kru/ahmad.jpg');
    });

    it('verifies AjukanTugasModal source imports live acaraService instead of mock fixtures', () => {
      const srcPath = path.resolve(
        process.cwd(),
        'src/products/hub/perizinan/components/AjukanTugasModal.tsx'
      );
      const src = fs.readFileSync(srcPath, 'utf-8');

      expect(src).toContain('acaraService.getEvents()');
      expect(src).not.toContain('INITIAL_ACARA_FIXTURES');
    });
  });

  describe('3. Pengajuan Izin Bawa Barang — Foto Inventaris & Acara Staging', () => {
    it('verifies AjukanBarangModal source includes live Staging acara and inventory photo resolver', () => {
      const srcPath = path.resolve(
        process.cwd(),
        'src/products/hub/perizinan/components/AjukanBarangModal.tsx'
      );
      const src = fs.readFileSync(srcPath, 'utf-8');

      expect(src).toContain('acaraService.getEvents()');
      expect(src).toContain('resolveInventoryPhotoUrl');
      expect(src).toContain('Terkait Acara / Agenda Kegiatan');
      expect(src).toContain('event: customEventName.trim() || undefined');
      expect(src).toContain('event_id: selectedEventId || undefined');
    });

    it('renders AjukanBarangModal with event selection and inventory container', () => {
      const html = renderToString(
        <AjukanBarangModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={() => {}}
        />
      );

      expect(html).toContain('Terkait Acara / Agenda Kegiatan');
      expect(html).toContain('Atau ketik nama acara bebas...');
      expect(html).toContain('Perihal / Keperluan Membawa Alat');
      expect(html).toContain('Cari alat berdasarkan nama, kode unit, kategori...');
    });
  });
});
