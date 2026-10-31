import { describe, it, expect, beforeEach } from 'vitest';
import { docsStore } from '@products/hub/dokumen-saya/docsStore';
import { INITIAL_DOCS_FIXTURES } from '@products/hub/dokumen-saya/mock/docsMockData';

// Setup memory-based localStorage mock if running in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('PTV PRO — Pengajuan Perizinan Workflow & Fidelity Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset docsStore to initial state
    const all = docsStore.getAll();
    all.forEach((d) => docsStore.deleteDoc(d.id));
    INITIAL_DOCS_FIXTURES.forEach((f) => {
      docsStore.requestDoc({
        id: f.id,
        type: f.type,
        subject: f.subject,
        date: f.date,
        start_date: f.start_date || f.date,
        end_date: f.end_date || f.date,
        owner: f.owner,
        pembawa: f.pembawa,
        penanggung_jawab: f.penanggung_jawab,
        diajukan_oleh: f.diajukan_oleh,
        recipients: f.recipients,
        items: f.items,
        unit_ids: f.unit_ids,
        event: f.event,
        status: f.status,
        no: f.no,
        review_note: f.review_note,
        status_history: f.status_history,
      });
    });
  });

  it('1. Pengajuan Izin Tugas: berhasil membuat dokumen baru dengan status Menunggu', () => {
    const newTugas = docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Liputan Khusus Wisuda Santri Pesantren Bumi Shalawat',
      date: '2026-10-18',
      start_date: '2026-10-18',
      end_date: '2026-10-19',
      owner: 'M. Zidna Ilma Roup',
      penanggung_jawab: 'Dr. H. Ahmad Musthofa, M.Pd.',
      pembawa: 'M. Zidna Ilma Roup',
      recipients: ['M. Zidna Ilma Roup', 'Rizky Alamsyah'],
      event: 'Wisuda Santri 2026',
    });

    expect(newTugas).toBeDefined();
    expect(newTugas.id).toBeTruthy();
    expect(newTugas.status).toBe('Menunggu');
    expect(newTugas.no).toBe('—');
    expect(newTugas.recipients).toContain('M. Zidna Ilma Roup');
    expect(newTugas.recipients).toContain('Rizky Alamsyah');
    expect(newTugas.status_history).toBeDefined();
    expect(newTugas.status_history?.length).toBeGreaterThan(0);
    expect(newTugas.status_history?.[0].status).toBe('Menunggu');
  });

  it('2. Pengajuan Izin Bawa Barang: berhasil menyimpan rincian alat dan unit fisik spesifik', () => {
    const newBarang = docsStore.requestDoc({
      type: 'Izin Membawa Barang',
      subject: 'Izin Membawa Kamera Sony FX3 & Lensa 24-70mm Liputan Stadion',
      date: '2026-10-20',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
      owner: 'Muhammad Dimas Prayoga',
      pembawa: 'Muhammad Dimas Prayoga',
      penanggung_jawab: 'M. Zidna Ilma Roup',
      items: ['Sony FX3 Cinema Line (INV-001-U01)', 'Sony FE 24-70mm f/2.8 GM II (INV-002-U01)'],
      unit_ids: ['unit-fx3-01', 'unit-lens-01'],
      recipients: ['Muhammad Dimas Prayoga'],
    });

    expect(newBarang).toBeDefined();
    expect(newBarang.type).toBe('Izin Membawa Barang');
    expect(newBarang.items?.length).toBe(2);
    expect(newBarang.unit_ids?.length).toBe(2);
    expect(newBarang.status).toBe('Menunggu');
  });

  it('3. Persetujuan Dokumen: menerbitkan nomor simulasi resmi dan merekam approved_at', () => {
    const doc = docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Penugasan Liputan Santripreneur Expo 2026',
      date: '2026-10-22',
      owner: 'Rizky Alamsyah',
      penanggung_jawab: 'M. Zidna Ilma Roup',
      recipients: ['Rizky Alamsyah'],
    });

    expect(doc.status).toBe('Menunggu');
    expect(doc.no).toBe('—');

    const approved = docsStore.approveDoc(doc.id, 'Disetujui untuk penugasan liputan');
    expect(approved).not.toBeNull();
    expect(approved?.status).toBe('Disetujui');
    expect(approved?.no).toMatch(/\d{3}\/ST-PTV\/X\/\d{4}/);
    expect(approved?.approved_at).toBeDefined();
    expect(approved?.review_note).toBe('Disetujui untuk penugasan liputan');

    // Cek status history
    const lastHistory = approved?.status_history?.[approved.status_history.length - 1];
    expect(lastHistory?.status).toBe('Disetujui');
    expect(lastHistory?.actor).toBe('Pimpinan Eksekutif PTV');
  });

  it('4. Permintaan Revisi: merubah status menjadi Revisi dengan catatan review wajib', () => {
    const doc = docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Penugasan Dokumentasi Kajian Kitab Kuning',
      date: '2026-10-25',
      owner: 'Ilham Hidayatullah',
      recipients: ['Ilham Hidayatullah'],
    });

    const revisionNote = 'Mohon tambahkan 1 personil switcherman dan rincian mic wireless.';
    const revised = docsStore.requestRevision(doc.id, revisionNote, 'M. Zidna Ilma Roup');

    expect(revised).not.toBeNull();
    expect(revised?.status).toBe('Revisi');
    expect(revised?.review_note).toBe(revisionNote);

    const lastHistory = revised?.status_history?.[revised.status_history.length - 1];
    expect(lastHistory?.status).toBe('Revisi');
    expect(lastHistory?.actor).toBe('M. Zidna Ilma Roup');
    expect(lastHistory?.note).toBe(revisionNote);
  });

  it('5. Perbaikan & Pengajuan Ulang (Resubmit): mengembalikan status ke Menunggu untuk review ulang', () => {
    const doc = docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Penugasan Liputan Maulid Awal',
      date: '2026-10-26',
      owner: 'Bagus Setiawan',
      recipients: ['Bagus Setiawan'],
    });

    docsStore.requestRevision(doc.id, 'Tambahkan penanggung jawab lapangan.');

    // Applicant resubmits with updated information
    const resubmitted = docsStore.resubmitDoc(doc.id, {
      subject: 'Penugasan Liputan Maulid Revisi Final',
      penanggung_jawab: 'M. Zidna Ilma Roup',
      recipients: ['Bagus Setiawan', 'Muhammad Dimas Prayoga'],
    });

    expect(resubmitted).not.toBeNull();
    expect(resubmitted?.status).toBe('Menunggu');
    expect(resubmitted?.subject).toBe('Penugasan Liputan Maulid Revisi Final');
    expect(resubmitted?.penanggung_jawab).toBe('M. Zidna Ilma Roup');
    expect(resubmitted?.recipients?.length).toBe(2);

    const lastHistory = resubmitted?.status_history?.[resubmitted.status_history.length - 1];
    expect(lastHistory?.status).toBe('Menunggu');
    expect(lastHistory?.note).toContain('Pengajuan telah diperbaiki');
  });

  it('6. Penolakan Dokumen: merubah status menjadi Ditolak dengan alasan penolakan', () => {
    const doc = docsStore.requestDoc({
      type: 'Izin Membawa Barang',
      subject: 'Permohonan Peminjaman Kamera Pribadi',
      date: '2026-10-27',
      owner: 'Santri Anonim',
      items: ['Sony FX3'],
    });

    const rejected = docsStore.rejectDoc(doc.id, 'Peralatan studio tidak dapat digunakan untuk kepentingan non-institusional.');

    expect(rejected).not.toBeNull();
    expect(rejected?.status).toBe('Ditolak');
    expect(rejected?.review_note).toContain('non-institusional');

    const lastHistory = rejected?.status_history?.[rejected.status_history.length - 1];
    expect(lastHistory?.status).toBe('Ditolak');
  });

  it('7. Sinkronisasi Antar Modul: Dokumen yang dibuat di Perizinan muncul di getAll() shared store', () => {
    const initialCount = docsStore.getAll().length;

    docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Uji Sinkronisasi Lintas Modul Hub',
      date: '2026-10-28',
      owner: 'M. Zidna Ilma Roup',
      recipients: ['M. Zidna Ilma Roup'],
    });

    const newAll = docsStore.getAll();
    expect(newAll.length).toBe(initialCount + 1);
    expect(newAll[0].subject).toBe('Uji Sinkronisasi Lintas Modul Hub');
  });

  it('8. Pemfilteran Kategori Perizinan: Memisahkan Izin Tugas vs Izin Bawa Barang dan mengecualikan Surat Izin Santri', () => {
    const all = docsStore.getAll();

    // Saring surat izin santri
    const perizinanOnly = all.filter(
      (d) =>
        d.type !== 'Surat Izin' &&
        d.type !== 'Izin Santri' &&
        d.type !== 'Surat Izin Santri' &&
        d.type !== 'Surat Izin Resmi'
    );

    const tugasOnly = perizinanOnly.filter(
      (d) => d.type === 'Surat Tugas' || d.type === 'Surat Tugas Resmi'
    );

    const barangOnly = perizinanOnly.filter(
      (d) => d.type === 'Izin Membawa Barang' || d.type === 'Surat Bawa Barang'
    );

    expect(tugasOnly.every((d) => d.type.includes('Tugas'))).toBe(true);
    expect(barangOnly.every((d) => d.type.includes('Barang'))).toBe(true);
    expect(perizinanOnly.some((d) => d.type === 'Surat Izin Santri')).toBe(false);
  });
});
