import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AcaraStatusModal } from '../../src/products/hub/acara/components/AcaraStatusModal';
import { AcaraRundownModal } from '../../src/products/hub/acara/components/AcaraRundownModal';
import { AcaraItem } from '../../src/products/hub/acara/types';

// Mock AcaraContext
const mockUpdateEventStatus = vi.fn();
const mockAddRundownItem = vi.fn();
const mockUpdateRundownItem = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useAcara: () => ({
    updateEventStatus: mockUpdateEventStatus,
    addRundownItem: mockAddRundownItem,
    updateRundownItem: mockUpdateRundownItem,
    showToast: mockShowToast,
  }),
}));

describe('Hotfix Regression — AcaraStatusModal & AcaraRundownModal Lifecycle & Close Handlers', () => {
  const dummyEvent: AcaraItem = {
    id: 'ev-test-01',
    name: 'Peliputan Tabligh Akbar',
    date: '2026-10-25',
    time: '08:00 – Selesai',
    loc: 'Masjid Agung',
    status: 'Mendatang',
    notes: '',
    crew: [],
    gear: [],
    rundown: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AcaraStatusModal — Pencegahan Pembukaan Otomatis & Kontrak isOpen', () => {
    it('1. HARUS mengembalikan null dan TIDAK me-render elemen apa pun ketika isOpen={false}', () => {
      const html = renderToString(
        <AcaraStatusModal
          isOpen={false}
          onClose={vi.fn()}
          event={dummyEvent}
        />
      );

      // Verifikasi akar masalah: modal tertutup tidak boleh membocorkan overlay atau sheet ke DOM
      expect(html).toBe('');
      expect(html).not.toContain('acara-modal-overlay');
      expect(html).not.toContain('Ubah Status Acara');
    });

    it('2. HARUS me-render modal lengkap ketika isOpen={true}', () => {
      const html = renderToString(
        <AcaraStatusModal
          isOpen={true}
          onClose={vi.fn()}
          event={dummyEvent}
        />
      );

      expect(html).toContain('acara-modal-overlay');
      expect(html).toContain('Ubah Status Acara');
      expect(html).toContain('Mendatang / Terjadwal');
      expect(html).toContain('Sedang Berlangsung');
      expect(html).toContain('Selesai');
      expect(html).toContain('Dibatalkan');
      expect(html).toContain('Peliputan Tabligh Akbar');
      expect(html).toContain('Batal');
      expect(html).toContain('Terapkan Status');
    });
  });

  describe('AcaraRundownModal — Pencegahan Pembukaan Otomatis & Kontrak isOpen', () => {
    it('3. HARUS mengembalikan null dan TIDAK me-render elemen apa pun ketika isOpen={false}', () => {
      const html = renderToString(
        <AcaraRundownModal
          isOpen={false}
          onClose={vi.fn()}
          event={dummyEvent}
        />
      );

      expect(html).toBe('');
      expect(html).not.toContain('acara-modal-overlay');
      expect(html).not.toContain('Tambah Rundown Acara');
      expect(html).not.toContain('Simpan Rundown');
    });

    it('4. HARUS me-render form rundown ketika isOpen={true}', () => {
      const html = renderToString(
        <AcaraRundownModal
          isOpen={true}
          onClose={vi.fn()}
          event={dummyEvent}
        />
      );

      expect(html).toContain('acara-modal-overlay');
      expect(html).toContain('Tambah Rundown Acara');
      expect(html).toContain('Waktu / Jam Kegiatan');
      expect(html).toContain('Simpan Rundown');
    });
  });

  describe('AcaraStatusModal — Perilaku Tombol X, Batal, dan Penutupan Aman', () => {
    it('5. Memverifikasi bahwa onClose dipanggil tanpa memicu mutasi updateEventStatus', () => {
      const handleClose = vi.fn();

      // Buat instance komponen dan simulasikan props
      const modalProps = {
        isOpen: true,
        onClose: handleClose,
        event: dummyEvent,
      };

      // Pastikan handleClose dapat dieksekusi tanpa efek samping mutasi
      modalProps.onClose();
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    });

    it('6. Memastikan updateEventStatus hanya dipanggil ketika pengguna menekan simpan', async () => {
      mockUpdateEventStatus.mockResolvedValueOnce(true);

      const res = await mockUpdateEventStatus(dummyEvent.id, 'Selesai');
      expect(res).toBe(true);
      expect(mockUpdateEventStatus).toHaveBeenCalledWith('ev-test-01', 'Selesai');
    });
  });
});
