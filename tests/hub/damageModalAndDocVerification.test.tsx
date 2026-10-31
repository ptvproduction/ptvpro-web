import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { DocDetailDrawer } from '../../src/products/hub/dokumen-saya/components/DocDetailDrawer';
import { DamageReportModal } from '../../src/products/hub/lapor-kerusakan/components/DamageReportModal';
import { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

describe('Fix 1: Modal Lapor Masalah & Kerusakan Layout Structure', () => {
  it('renders modal with correct form wrapping header, scrollable body, and action footer', () => {
    const html = renderToStaticMarkup(
      <DamageReportModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    // Modal card and form wrapper
    expect(html).toContain('class="damage-modal-card damage-live-form"');
    expect(html).toContain('class="damage-modal-form"');

    // Header inside form
    expect(html).toContain('class="damage-modal-header"');
    expect(html).toContain('Lapor Masalah &amp; Kerusakan Alat');

    // Scrollable body
    expect(html).toContain('class="damage-modal-body"');

    // Form fields including reporter contact
    expect(html).toContain('id="damage-reporter"');
    expect(html).toContain('id="damage-contact"');
    expect(html).toContain('WhatsApp Pelapor');

    // Footer actions
    expect(html).toContain('class="damage-modal-footer"');
    expect(html).toContain('Batal');
    expect(html).toContain('Kirim Laporan');

    // Verify footer is placed outside damage-modal-body
    const bodyIndex = html.indexOf('class="damage-modal-body"');
    const contactIndex = html.indexOf('id="damage-contact"');
    const footerIndex = html.indexOf('class="damage-modal-footer"');

    expect(bodyIndex).toBeLessThan(contactIndex);
    expect(contactIndex).toBeLessThan(footerIndex);
  });

  it('verifies lapor-kerusakan.css layout styles ensure non-overlapping footer and true scroll body', () => {
    const cssPath = path.resolve(process.cwd(), 'src/products/hub/lapor-kerusakan/lapor-kerusakan.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    // Form flex structure
    expect(css).toContain('.damage-modal-form');
    expect(css).toContain('flex: 1 1 auto;');
    expect(css).toContain('min-height: 0;');

    // Scrollable body bounds
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('overscroll-behavior: contain;');

    // Footer static positioning (not sticky inside body)
    expect(css).toContain('position: static;');
    expect(css).toContain('flex-shrink: 0;');

    // Viewport and safe area responsive rules
    expect(css).toContain('calc(100dvh - 32px)');
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
  });
});

describe('Fix 2: Tombol Buka Verifikasi Points Directly to /verifikasi-surat', () => {
  const doc: PtvDocument = {
    id: 'si_test_verif',
    no: '007/SI-PTV/X/2026',
    subject: 'Surat Izin Santri Riset',
    type: 'Surat Izin Santri',
    date: '2026-10-21',
    owner: 'Operator Test',
    status: 'Disetujui',
    created_at: '2026-10-21',
  };

  it('points Buka Verifikasi button directly to /verifikasi-surat without document number in path', () => {
    const html = renderToStaticMarkup(
      <DocDetailDrawer
        doc={doc}
        onClose={() => {}}
        canApprove={false}
        onApprove={() => {}}
        onReject={() => {}}
        onDelete={() => {}}
        defaultExpanded={true}
      />
    );

    // Anchor has href="/verifikasi-surat"
    expect(html).toContain('href="/verifikasi-surat"');
    expect(html).toContain('Buka Verifikasi');

    // Anchor must NOT append doc.no to path
    expect(html).not.toContain('href="/verifikasi-surat/007');
    expect(html).not.toContain('href="https://ptvpro.com/verifikasi-surat/007');

    // Physical QR still preserves full official verification payload
    expect(html).toContain('https://ptvpro.com/verifikasi-surat/007%2FSI-PTV%2FX%2F2026');
    expect(html).toContain('Nomor Surat: 007/SI-PTV/X/2026');
  });
});
