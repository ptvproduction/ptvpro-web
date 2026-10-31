import { MemoryRouter } from 'react-router-dom';
import { crewStore } from '../../src/products/hub/kru/kruStore';
import { useSessionStore } from '@core/session';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KruPage } from '../../src/products/hub/kru/KruPage';
import { INITIAL_CREW_FIXTURES as CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/mock/crewMockData';
import { groupCrewByAngkatan } from '../../src/products/hub/kru/kruStore';

describe('PTVPRO — Manajemen Kru Flat Grouped List Redesign Regression Tests', () => {
  beforeEach(() => { crewStore.resetToFixtures(); useSessionStore.setState({ user: { id: 'unit-actor', status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['eksekutif'], allowed_overrides: [], denied_overrides: [] } as never }); });
  it('1. harus merender filter tabs, bento stats, dan tombol aksi', () => {
    const html = renderToString(<MemoryRouter><KruPage /></MemoryRouter>);

    // Filter pills
    expect(html).toContain('Kru Aktif');
    expect(html).toContain('Kru Nonaktif');
    expect(html).toContain('Pengarah');
    expect(html).toContain('Pembina');
    expect(html).toContain('Semua');

    // Bento stat cards
    expect(html).toContain('kk-stat-grid');
    expect(html).toContain('kk-stat-card');
    expect(html).toContain('Riwayat Login');
    expect(html).toContain('Tambah Kru');
  });

  it('2. harus merender struktur flat grouped list by angkatan: heading di luar container dan satu container rounded per angkatan', () => {
    const html = renderToString(<MemoryRouter><KruPage /></MemoryRouter>);

    // Class semantik baru
    expect(html).toContain('kru-group-section');
    expect(html).toContain('kru-group-heading');
    expect(html).toContain('kru-group-heading-title');
    expect(html).toContain('kru-group-heading-count');
    expect(html).toContain('kru-group-container');
    expect(html).toContain('kru-row-item');

    // Pastikan tidak lagi menggunakan struktur nested card (kk-group-card / kk-list-item) pada rendering angkatan
    expect(html).not.toContain('kk-group-card');
    expect(html).not.toContain('kk-list-item');
  });

  it('3. setiap baris anggota harus memuat avatar di kiri, nama/jabatan/divisi di tengah, dan status badge di kanan', () => {
    const html = renderToString(<MemoryRouter><KruPage /></MemoryRouter>);

    expect(html).toContain('kru-row-left');
    expect(html).toContain('kru-row-body');
    expect(html).toContain('kru-row-name');
    expect(html).toContain('kru-row-sub');
    expect(html).toContain('kru-row-badge');
    expect(html).toContain('is-active');

    // Memuat nama salah satu kru aktif dari data staging
    const sampleActive = CANONICAL_STAGING_CREW_FIXTURES.find((c) => c.status_kru === 'Aktif' && c.category === 'Kru');
    expect(sampleActive).toBeDefined();
    if (sampleActive) {
      expect(html).toContain(sampleActive.full_name);
      expect(html).toContain(sampleActive.ptv_id);
    }
  });

  it('4. helper groupCrewByAngkatan harus mengelompokkan kru secara deterministik', () => {
    const groups = groupCrewByAngkatan(CANONICAL_STAGING_CREW_FIXTURES);
    expect(groups.length).toBeGreaterThan(0);

    for (const g of groups) {
      expect(g.label).toBeTruthy();
      expect(g.members.length).toBeGreaterThan(0);
    }
  });

  it('5. heading kelompok angkatan harus memuat label angkatan dan jumlah anggota', () => {
    const html = renderToString(<MemoryRouter><KruPage /></MemoryRouter>);

    // Memuat label angkatan (misal Angkatan 10, Angkatan 11, Angkatan 12, dst)
    expect(html).toMatch(/Angkatan \d+/);
    expect(html).toMatch(/\d+(<!-- -->)?\s*Kru/);
  });
});
