import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { mapDbRowToAcaraItem } from '../../src/products/hub/acara/acaraService';
import { parseAcaraDbRow as mapServer } from '../../api/acara';
import { ACARA_COLORS, normalizeAcaraColor } from '../../src/products/hub/acara/utils/acaraColors';
import { AcaraCard } from '../../src/products/hub/acara/components/AcaraCard';
import { resolveOfficialDomain } from '../../src/products/verification/verificationService';

describe('Warna acara dan kartu agenda bersama', () => {
  const raw = { id: 'event-test', nama_acara: 'Agenda Uji', tanggal: '2026-12-01', status: 'aktif', created_at: '', updated_at: '',
    deskripsi: '<!-- PTV_META: {"display_color":"toska","sessions":[],"dresscode":"Batik"} -->\nCatatan tetap' };
  it('memulihkan warna dari metadata database di klien dan server tanpa kehilangan catatan', () => {
    for (const mapper of [mapDbRowToAcaraItem, mapServer]) {
      expect(mapper(raw)).toMatchObject({ display_color: 'toska', notes: 'Catatan tetap', dresscode: 'Batik' });
      expect(mapper({ ...raw, deskripsi: 'Catatan lama' }).display_color).toBe('biru');
    }
  });
  it('menyediakan sembilan preset dan default aman untuk warna asing', () => {
    expect(new Set(ACARA_COLORS.map((item) => item.value)).size).toBe(9);
    expect(normalizeAcaraColor('url(javascript:test)')).toBe('biru');
  });
  it('memakai aksen dan metadata yang sama pada kartu compact dan daftar', () => {
    const event = mapDbRowToAcaraItem(raw);
    for (const compact of [true, false]) {
      const html = renderToStaticMarkup(<MemoryRouter><AcaraCard event={event} compact={compact} /></MemoryRouter>);
      expect(html).toContain('--acara-accent:#0F766E');
      expect(html).toContain('Agenda Uji');
      expect(html).toContain('acara-badge-hijri');
      expect(html).not.toContain('acara-badge-weton');
    }
  });
  it('menolak localhost dan domain di luar domain resmi untuk QR', () => {
    expect(resolveOfficialDomain('http://localhost:5174')).toBe('https://ptvpro.com');
    expect(resolveOfficialDomain('https://ptvpro.com.evil.test')).toBe('https://ptvpro.com');
    expect(resolveOfficialDomain('https://www.ptvpro.com/path')).toBe('https://www.ptvpro.com');
  });
});
