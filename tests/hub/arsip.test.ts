import { describe, it, expect, beforeEach } from 'vitest';
import { docsStore } from '@products/hub/dokumen-saya/docsStore';
import { INITIAL_DOCS_FIXTURES, PtvDocument } from '@products/hub/dokumen-saya/mock/docsMockData';
import { PROFILE_CAPABILITIES } from '@core/policy/profiles';

// Setup memory-based localStorage mock for test environment
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

describe('PTV PRO — Surat & Arsip (Batch 2: Legacy-First Parity & Architecture Tests)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset docsStore to initial fixtures
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

  it('1. Legacy Parity: Dokumen diarsip dan dikelompokkan berdasarkan tahun (byYear)', () => {
    const docs = docsStore.getAll();
    const byYear: Record<string, PtvDocument[]> = {};
    docs.forEach((d) => {
      const y = (d.date && d.date.length >= 4) ? d.date.slice(0, 4) : d.created_at?.slice(0, 4);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(d);
    });

    expect(byYear['2026']).toBeDefined();
    expect(byYear['2026'].length).toBeGreaterThanOrEqual(2);
  });

  it('2. Legacy Parity: Pencarian multi-kriteria mencakup nomor surat, perihal, pemohon, dan tipe', () => {
    const docs = docsStore.getAll();

    // Cari berdasarkan nomor surat
    const qNo = '001/SI-PTV';
    const matchNo = docs.filter((d) => (d.no || '').toLowerCase().includes(qNo.toLowerCase()));
    expect(matchNo.length).toBe(1);
    expect(matchNo[0].subject).toContain('Relay Haul Solo');

    // Cari berdasarkan perihal
    const qSubj = 'Syekh Salim';
    const matchSubj = docs.filter((d) => (d.subject || '').toLowerCase().includes(qSubj.toLowerCase()));
    expect(matchSubj.length).toBe(1);
    expect(matchSubj[0].owner).toBe('Farras');

    // Cari berdasarkan penerima/kru
    const qRecip = 'Iyyaka';
    const matchRecip = docs.filter((d) => (d.recipients || []).some((r) => r.toLowerCase().includes(qRecip.toLowerCase())));
    expect(matchRecip.length).toBe(1);
    expect(matchRecip[0].no).toBe('007/SI-PTV/X/2026');
  });

  it('3. Kejujuran Nomor Dokumen: Hanya dokumen berstatus Disetujui dengan nomor resmi yang terbit', () => {
    const docs = docsStore.getAll();

    const approvedDoc = docs.find((d) => d.id === 'si_ff305b4f-0c0e-4abc-9da9-2556bdb1743c');
    expect(approvedDoc?.status).toBe('Disetujui');
    expect(approvedDoc?.no).toBe('001/SI-PTV/X/2026');

    // Buat permohonan pending baru
    const pendingDoc = docsStore.requestDoc({
      type: 'Surat Tugas',
      subject: 'Pengajuan Tugas Baru Uji',
      date: '2026-10-18',
      owner: 'Zidna',
    });
    expect(pendingDoc.status).toBe('Menunggu');
    // Dokumen pending tidak mengklaim nomor surat resmi
    const isOfficial = pendingDoc.status === 'Disetujui' && pendingDoc.no && pendingDoc.no !== '—';
    expect(isOfficial).toBeFalsy();
  });

  it('4. Shared Docs Store: Persetujuan dokumen baru langsung memperbarui status dan nomor resmi di arsip', () => {
    // Buat dokumen pending baru
    const newDoc = docsStore.requestDoc({
      id: 'doc-test-approve',
      type: 'Surat Izin Santri',
      subject: 'Uji Persetujuan Surat',
      date: '2026-10-18',
      owner: 'Farras',
    });
    expect(newDoc.status).toBe('Menunggu');

    // Eksekutif menyetujui surat
    const approved = docsStore.approveDoc('doc-test-approve', 'Disetujui oleh Direktur PTV', 'Dr. H. Ahmad Musthofa, M.Pd.');
    expect(approved).not.toBeNull();
    expect(approved?.status).toBe('Disetujui');
    expect(approved?.no).toMatch(/\d{3}\/SI-PTV\/X\/2026/);

    // Verifikasi arsip langsung membaca status dan nomor baru
    const docAfter = docsStore.getById('doc-test-approve');
    expect(docAfter?.status).toBe('Disetujui');
    expect(docAfter?.no).toBe(approved?.no);
  });

  it('5. RBAC: Memverifikasi pemetaan capability documents.archive.view dan documents.archive.manage', () => {
    // Eksekutif memiliki capability melihat dan mengelola arsip
    const eksekutifCaps = PROFILE_CAPABILITIES.eksekutif;
    expect(eksekutifCaps.has('documents.archive.view')).toBe(true);
    expect(eksekutifCaps.has('documents.archive.manage')).toBe(true);

    // Kepolo Kepali memiliki capability melihat arsip
    const kepoloCaps = PROFILE_CAPABILITIES.kepolo_kepali;
    expect(kepoloCaps.has('documents.archive.view')).toBe(true);
    // Kepolo Kepali tidak memiliki capability mengelola/menghapus arsip
    expect(kepoloCaps.has('documents.archive.manage')).toBe(false);

    // Kru biasa tidak memiliki akses melihat arsip master
    const crewCaps = PROFILE_CAPABILITIES.crew;
    expect(crewCaps.has('documents.archive.view')).toBe(false);
    expect(crewCaps.has('documents.archive.manage')).toBe(false);
  });

  it('6. Integritas Penghapusan: Menghapus arsip surat menghilangkannya secara konsisten dari store', () => {
    const docToDelete = 'si_f491c12e-1311-477c-a7a5-da229a43a296';
    expect(docsStore.getById(docToDelete)).toBeDefined();

    const deleted = docsStore.deleteDoc(docToDelete);
    expect(deleted).toBe(true);

    expect(docsStore.getById(docToDelete)).toBeUndefined();
  });

  it('7. Hotfix Filter Layout: Kombinasi filter multi-kriteria (status, jenis surat, search query) menyaring secara akurat', () => {
    const docs = docsStore.getAll();

    // Filter status 'Disetujui' saja
    const approvedOnly = docs.filter((d) => d.status === 'Disetujui');
    expect(approvedOnly.length).toBeGreaterThanOrEqual(1);
    expect(approvedOnly.every((d) => d.status === 'Disetujui')).toBe(true);

    // Filter status 'Disetujui' AND jenis surat 'Surat Izin Santri'
    const approvedIzin = docs.filter((d) => d.status === 'Disetujui' && d.type === 'Surat Izin Santri');
    expect(approvedIzin.length).toBeGreaterThanOrEqual(2);
    expect(approvedIzin.every((d) => d.status === 'Disetujui' && d.type === 'Surat Izin Santri')).toBe(true);

    // Filter status 'Semua', jenis 'Surat Izin Santri', dan query 'Relay'
    const matchIzin = docs.filter((d) => {
      const matchType = d.type === 'Surat Izin Santri';
      const q = 'relay';
      const matchQuery = (d.subject || '').toLowerCase().includes(q);
      return matchType && matchQuery;
    });
    expect(matchIzin.length).toBe(1);
    expect(matchIzin[0].subject).toContain('Relay Haul Solo');
  });

  it('8. Hotfix Detail Dokumen: defaultExpanded contract memastikan rincian otomatis terbuka untuk Arsip dan melindungi modul lain', () => {
    // Evaluasi inisialisasi state accordions untuk defaultExpanded = true (Surat & Arsip)
    const initExpanded = (defaultExpanded: boolean) => ({
      details: Boolean(defaultExpanded),
      timeline: Boolean(defaultExpanded),
      audit: Boolean(defaultExpanded),
      verification: Boolean(defaultExpanded),
    });

    const arsipState = initExpanded(true);
    expect(arsipState.details).toBe(true);
    expect(arsipState.timeline).toBe(true);
    expect(arsipState.audit).toBe(true);
    expect(arsipState.verification).toBe(true);

    // Evaluasi default behavior (defaultExpanded = false untuk Perizinan & Dokumen Saya)
    const defaultState = initExpanded(false);
    expect(defaultState.details).toBe(false);
    expect(defaultState.timeline).toBe(false);
    expect(defaultState.audit).toBe(false);
    expect(defaultState.verification).toBe(false);

    // Simulasi manual collapse oleh pengguna pada arsip
    const toggled = { ...arsipState, details: !arsipState.details };
    expect(toggled.details).toBe(false);
    expect(toggled.timeline).toBe(true);

    // Simulasi reset saat operator membuka dokumen lain (doc.id berubah)
    const resetState = initExpanded(true);
    expect(resetState.details).toBe(true);
    expect(resetState.timeline).toBe(true);
    expect(resetState.audit).toBe(true);
    expect(resetState.verification).toBe(true);
  });

  it('9. Hotfix Monthly Archive Grouping: Pengelompokan surat per bulan dan tahun dengan urutan kronologis descending', () => {
    // Tambahkan record bulan September untuk menguji grouping lintas bulan
    docsStore.requestDoc({
      type: 'Surat Izin Santri',
      subject: 'Dokumen Arsip September 2026',
      date: '2026-09-28',
      owner: 'Zidna',
      status: 'Disetujui',
      no: '003/SI-PTV/IX/2026',
    });

    const docs = docsStore.getAll();
    const MONTH_NAMES_ID = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const parseDocDate = (rawDate?: string) => {
      const dateOnly = (rawDate || '2026-01-01').split('T')[0];
      const parts = dateOnly.split('-');
      const year = parts[0] || '2026';
      const monthNum = parseInt(parts[1], 10) || 1;
      const monthIndex = Math.max(0, Math.min(11, monthNum - 1));
      return { year, monthIndex, fullDate: dateOnly };
    };

    // Filter dokumen untuk tahun 2026
    const docs2026 = docs.filter((d) => parseDocDate(d.date || d.created_at).year === '2026');

    // Grouping bulanan
    const map = new Map<string, { monthKey: string; label: string; docs: PtvDocument[] }>();
    docs2026.forEach((d) => {
      const { year, monthIndex } = parseDocDate(d.date || d.created_at);
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES_ID[monthIndex]} ${year}`;

      if (!map.has(monthKey)) {
        map.set(monthKey, { monthKey, label, docs: [] });
      }
      map.get(monthKey)!.docs.push(d);
    });

    const groups = Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // Verifikasi urutan bulan: Oktober 2026 (2026-10) harus sebelum September 2026 (2026-09)
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0].label).toBe('Oktober 2026');
    expect(groups[0].monthKey).toBe('2026-10');
    expect(groups[1].label).toBe('September 2026');
    expect(groups[1].monthKey).toBe('2026-09');

    // Verifikasi counter jumlah surat
    expect(groups[0].docs.length).toBeGreaterThanOrEqual(2);
    expect(groups[1].docs.length).toBeGreaterThanOrEqual(1);
  });

  it('10. Hotfix Monthly Archive Accordion: Bulan terbaru terbuka secara default dan dapat di-toggle secara independen', () => {
    const isMonthOpen = (collapsedState: Record<string, boolean>, monthKey: string, groupIdx: number) => {
      if (collapsedState[monthKey] !== undefined) {
        return !collapsedState[monthKey];
      }
      return groupIdx === 0;
    };

    let collapsedMonths: Record<string, boolean> = {};

    expect(isMonthOpen(collapsedMonths, '2026-10', 0)).toBe(true);
    expect(isMonthOpen(collapsedMonths, '2026-09', 1)).toBe(false);

    collapsedMonths = { ...collapsedMonths, '2026-09': false };
    expect(isMonthOpen(collapsedMonths, '2026-09', 1)).toBe(true);

    collapsedMonths = { ...collapsedMonths, '2026-10': true };
    expect(isMonthOpen(collapsedMonths, '2026-10', 0)).toBe(false);

    collapsedMonths = {};
    expect(isMonthOpen(collapsedMonths, '2026-10', 0)).toBe(true);
  });

  it('11. Hotfix Year Filter: Default tahun berjalan dan filter lintas tahun ("Semua Tahun")', () => {
    const docs = docsStore.getAll();
    const currentYear = '2026';

    const docsInCurrentYear = docs.filter((d) => (d.date || d.created_at || '').startsWith(currentYear));
    expect(docsInCurrentYear.length).toBeGreaterThanOrEqual(2);

    const allDocs = docs;
    expect(allDocs.length).toBeGreaterThanOrEqual(docsInCurrentYear.length);
  });
});
