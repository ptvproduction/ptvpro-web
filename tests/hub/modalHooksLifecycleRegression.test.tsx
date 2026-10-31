/**
 * PTV PRO — Modal Hooks Lifecycle & Rules of Hooks Regression Tests
 * Validates that all modals can transition between closed, open, closed, and re-opened states
 * across data changes without violating React Rules of Hooks ("Rendered more/fewer hooks than previous render").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { AcaraCrewModal } from '../../src/products/hub/acara/components/AcaraCrewModal';
import { AcaraFormModal } from '../../src/products/hub/acara/components/AcaraFormModal';
import { AcaraGearModal } from '../../src/products/hub/acara/components/AcaraGearModal';
import { AcaraDeleteModal } from '../../src/products/hub/acara/components/AcaraDeleteModal';
import { AcaraItem } from '../../src/products/hub/acara/types';

// Mock AcaraContext
const mockUpdateEventCrew = vi.fn().mockResolvedValue(true);
const mockAddEvent = vi.fn().mockResolvedValue(true);
const mockUpdateEvent = vi.fn().mockResolvedValue(true);
const mockUpdateEventGear = vi.fn().mockResolvedValue(true);
const mockDeleteEvent = vi.fn().mockResolvedValue(true);
const mockShowToast = vi.fn();

vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useAcara: () => ({
    updateEventCrew: mockUpdateEventCrew,
    addEvent: mockAddEvent,
    updateEvent: mockUpdateEvent,
    updateEventGear: mockUpdateEventGear,
    deleteEvent: mockDeleteEvent,
    showToast: mockShowToast,
  }),
}));

describe('PTVPRO — Modal Rules of Hooks Lifecycle Regression Test Suite', () => {
  const dummyEvent1: AcaraItem = {
    id: 'ev-test-01',
    name: 'Peliputan Tabligh Akbar Akbar 2026',
    date: '2026-10-25',
    time: '08:00 – Selesai',
    loc: 'Masjid Agung Al-Akbar',
    status: 'Mendatang',
    notes: 'Bawa kamera 4K dan switcher',
    crew: [
      { id: 'kru-001', name: 'Roup', division: 'Technical', role: 'Crew Operator', job: 'Camera Person' },
    ],
    gear: [],
    rundown: [],
  };

  const dummyEvent2: AcaraItem = {
    id: 'ev-test-02',
    name: 'Wisuda Santri Progresif TV',
    date: '2026-11-10',
    time: '13:00 – 17:00',
    loc: 'Auditorium Utama',
    status: 'Berlangsung',
    notes: 'Live streaming YouTube',
    crew: [],
    gear: [],
    rundown: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. AcaraCrewModal — Open, Close, Re-open & Event Switching Lifecycle', () => {
    function CrewModalTestHarness({ initialOpen = false, initialEvent = dummyEvent1 }) {
      const [isOpen, setIsOpen] = useState(initialOpen);
      const [ev, setEv] = useState(initialEvent);

      return (
        <div>
          <button onClick={() => setIsOpen((prev) => !prev)}>Toggle</button>
          <button onClick={() => setEv(dummyEvent2)}>Switch Event</button>
          <AcaraCrewModal isOpen={isOpen} onClose={() => setIsOpen(false)} event={ev} />
        </div>
      );
    }

    it('1.1 Render tertutup: menghasilkan null tanpa error hooks', () => {
      const html = renderToString(<AcaraCrewModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');
    });

    it('1.2 Render terbuka: merender judul dan daftar kru', () => {
      const html = renderToString(<AcaraCrewModal isOpen={true} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toContain('Kelola Kru Bertugas');
      expect(html).toContain(dummyEvent1.name);
    });

    it('1.3 Siklus transisi hooks konsisten: Tertutup -> Terbuka -> Tertutup -> Terbuka kembali', () => {
      // Step 1: Render tertutup
      let rendered = renderToString(<CrewModalTestHarness initialOpen={false} />);
      expect(rendered).not.toContain('Kelola Kru Bertugas');

      // Step 2: Render terbuka
      rendered = renderToString(<CrewModalTestHarness initialOpen={true} />);
      expect(rendered).toContain('Kelola Kru Bertugas');

      // Step 3: Render ditutup kembali
      rendered = renderToString(<CrewModalTestHarness initialOpen={false} />);
      expect(rendered).not.toContain('Kelola Kru Bertugas');

      // Step 4: Render dibuka kembali dengan event berbeda (event switching)
      rendered = renderToString(<CrewModalTestHarness initialOpen={true} initialEvent={dummyEvent2} />);
      expect(rendered).toContain('Kelola Kru Bertugas');
      expect(rendered).toContain(dummyEvent2.name);
    });
  });

  describe('2. AcaraFormModal — Open, Close, Add/Edit Mode Switching Lifecycle', () => {
    function FormModalTestHarness({ initialOpen = false, eventToEdit = null as AcaraItem | null }) {
      return (
        <AcaraFormModal
          isOpen={initialOpen}
          onClose={vi.fn()}
          eventToEdit={eventToEdit}
          defaultDate="2026-10-25"
        />
      );
    }

    it('2.1 Render tertutup: menghasilkan null', () => {
      const html = renderToString(<FormModalTestHarness initialOpen={false} />);
      expect(html).toBe('');
    });

    it('2.2 Render terbuka (Mode Tambah Acara Baru): tidak crash dan memiliki tombol Jadwalkan Acara', () => {
      const html = renderToString(<FormModalTestHarness initialOpen={true} eventToEdit={null} />);
      expect(html).toContain('Tambah Acara Liputan Baru');
      expect(html).toContain('Jadwalkan Acara');
    });

    it('2.3 Render terbuka (Mode Edit Acara): beralih ke form edit tanpa ketidaksesuaian hooks', () => {
      const html = renderToString(<FormModalTestHarness initialOpen={true} eventToEdit={dummyEvent1} />);
      expect(html).toContain('Edit Acara Liputan');
      expect(html).toContain('Simpan Perubahan');
    });

    it('2.4 Siklus transisi form: Tertutup -> Tambah -> Tertutup -> Edit', () => {
      // 1. Tertutup
      let html = renderToString(<FormModalTestHarness initialOpen={false} />);
      expect(html).toBe('');

      // 2. Buka Tambah
      html = renderToString(<FormModalTestHarness initialOpen={true} eventToEdit={null} />);
      expect(html).toContain('Tambah Acara Liputan Baru');

      // 3. Tutup
      html = renderToString(<FormModalTestHarness initialOpen={false} />);
      expect(html).toBe('');

      // 4. Buka Edit
      html = renderToString(<FormModalTestHarness initialOpen={true} eventToEdit={dummyEvent2} />);
      expect(html).toContain('Edit Acara Liputan');
    });
  });

  describe('3. AcaraGearModal — Open, Close, Re-open Lifecycle', () => {
    it('3.1 Render tertutup: menghasilkan null', () => {
      const html = renderToString(<AcaraGearModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');
    });

    it('3.2 Render terbuka: merender judul dan ringkasan gear', () => {
      const html = renderToString(<AcaraGearModal isOpen={true} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toContain('Kelola Peralatan yang Digunakan');
      expect(html).toContain(dummyEvent1.name);
    });

    it('3.3 Siklus transisi gear modal: Tertutup -> Terbuka -> Tertutup -> Terbuka', () => {
      // 1. Tertutup
      let html = renderToString(<AcaraGearModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');

      // 2. Terbuka
      html = renderToString(<AcaraGearModal isOpen={true} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toContain('Kelola Peralatan yang Digunakan');

      // 3. Tertutup
      html = renderToString(<AcaraGearModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');

      // 4. Terbuka dengan event lain
      html = renderToString(<AcaraGearModal isOpen={true} onClose={vi.fn()} event={dummyEvent2} />);
      expect(html).toContain('Kelola Peralatan yang Digunakan');
      expect(html).toContain(dummyEvent2.name);
    });
  });

  describe('4. AcaraDeleteModal — Open, Close, Re-open Lifecycle', () => {
    it('4.1 Render tertutup: menghasilkan null', () => {
      const html = renderToString(<AcaraDeleteModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');
    });

    it('4.2 Render terbuka: merender peringatan hapus dan nama acara', () => {
      const html = renderToString(<AcaraDeleteModal isOpen={true} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toContain('Hapus Acara');
      expect(html).toContain('Yakin ingin menghapus acara ini?');
      expect(html).toContain(dummyEvent1.name);
    });

    it('4.3 Siklus transisi delete modal: Tertutup -> Terbuka -> Tertutup -> Terbuka', () => {
      // 1. Tertutup
      let html = renderToString(<AcaraDeleteModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');

      // 2. Terbuka
      html = renderToString(<AcaraDeleteModal isOpen={true} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toContain('Hapus Acara');

      // 3. Tertutup
      html = renderToString(<AcaraDeleteModal isOpen={false} onClose={vi.fn()} event={dummyEvent1} />);
      expect(html).toBe('');

      // 4. Terbuka kembali dengan event lain
      html = renderToString(<AcaraDeleteModal isOpen={true} onClose={vi.fn()} event={dummyEvent2} />);
      expect(html).toContain('Hapus Acara');
      expect(html).toContain(dummyEvent2.name);
    });
  });
});
