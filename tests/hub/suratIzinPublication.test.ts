import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSuratIzinPublisher } from '../../src/products/hub/surat/generator/suratIzinPublication';
import { printOfficialPdf, startOfficialDocPdfDownload } from '../../src/products/hub/dokumen-saya/utils/docPdfPrinter';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

const payload = { type: 'Surat Izin Santri', subject: 'Uji lokal', santri_list: [{ nama: 'Santri Uji', kelas: 'XI' }] };
const doc: PtvDocument = { ...payload, id: 'synthetic', no: '014/SI-PTV/X/2026', date: '2026-10-29', owner: 'Uji', status: 'Disetujui', created_at: '' };
const pdf = { blob: new Blob(['same final PDF']), fileName: '014.pdf' };
const dependencies = () => ({ create: vi.fn().mockResolvedValue(doc), prepare: vi.fn().mockResolvedValue(pdf), download: vi.fn() });

describe('Surat Izin publish, download and print copy', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('uses one server document and one PDF for repeated download of the same form', async () => {
    const deps = dependencies(); const publish = createSuratIzinPublisher(deps);
    const first = await publish(payload); const retry = await publish(payload);
    expect(deps.create).toHaveBeenCalledOnce(); expect(deps.prepare).toHaveBeenCalledWith(doc);
    expect(deps.prepare).toHaveBeenCalledOnce(); expect(deps.download).toHaveBeenCalledTimes(2);
    expect(first.pdf).toBe(retry.pdf); expect(first.pdf.blob).toBe(pdf.blob);
  });
  it('keeps the same idempotency key after an unconfirmed server response', async () => {
    const deps = dependencies(); deps.create.mockRejectedValueOnce(new Error('timeout'));
    const publish = createSuratIzinPublisher(deps);
    await expect(publish(payload)).rejects.toThrow('belum dikonfirmasi');
    expect(deps.download).not.toHaveBeenCalled(); await publish(payload);
    expect(deps.create.mock.calls[0][0].request_id).toBe(deps.create.mock.calls[1][0].request_id);
  });
  it('retries PDF failure without another issuance and reports the saved number', async () => {
    const deps = dependencies(); deps.prepare.mockRejectedValueOnce(new Error('font load'));
    const publish = createSuratIzinPublisher(deps);
    await expect(publish(payload)).rejects.toThrow('014/SI-PTV/X/2026 sudah tersimpan');
    expect(deps.download).not.toHaveBeenCalled(); await publish(payload);
    expect(deps.create).toHaveBeenCalledOnce();
  });
  it('does not report success on download failure and retries the identical PDF', async () => {
    const deps = dependencies(); deps.download.mockImplementationOnce(() => { throw new Error('blocked'); });
    const publish = createSuratIzinPublisher(deps);
    await expect(publish(payload)).rejects.toThrow('unduhan gagal'); await publish(payload);
    expect(deps.create).toHaveBeenCalledOnce(); expect(deps.prepare).toHaveBeenCalledOnce();
    expect(deps.download.mock.calls.map(([value]) => value)).toEqual([pdf, pdf]);
  });
  it('rejects overlapping submission and allocates a new request only after data changes', async () => {
    const deps = dependencies(); let done!: (value: PtvDocument) => void;
    deps.create.mockReturnValueOnce(new Promise((resolve) => { done = resolve; }));
    const publish = createSuratIzinPublisher(deps); const active = publish(payload);
    await expect(publish(payload)).rejects.toThrow('sedang diproses'); done(doc); await active;
    await publish({ ...payload, subject: 'Kegiatan berbeda' });
    expect(deps.create.mock.calls[0][0].request_id).not.toBe(deps.create.mock.calls[1][0].request_id);
  });
  it('opens native printing with the exact downloaded Blob, without a service call', () => {
    vi.useFakeTimers(); const print = vi.fn(); let loaded!: () => void;
    const viewer = { closed: false, focus: vi.fn(), print, addEventListener: vi.fn((_name, fn) => { loaded = fn; }) };
    const createObjectURL = vi.fn().mockReturnValue('blob:final'); const revokeObjectURL = vi.fn();
    vi.stubGlobal('window', { open: vi.fn().mockReturnValue(viewer), URL: { createObjectURL, revokeObjectURL }, setInterval, clearInterval });
    printOfficialPdf(pdf); expect(createObjectURL).toHaveBeenCalledWith(pdf.blob);
    expect(window.open).toHaveBeenCalledWith('blob:final', '_blank'); expect(print).not.toHaveBeenCalled();
    loaded(); expect(print).toHaveBeenCalledOnce(); viewer.closed = true; vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:final');
  });
  it('reports blocked print popup and revokes its URL', () => {
    const revokeObjectURL = vi.fn(); vi.stubGlobal('window', { open: () => null, URL: { createObjectURL: () => 'blob:blocked', revokeObjectURL } });
    expect(() => printOfficialPdf(pdf)).toThrow('diblokir'); expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked');
  });
  it('propagates download errors and always releases the object URL', () => {
    vi.useFakeTimers(); const revokeObjectURL = vi.fn();
    vi.stubGlobal('window', { URL: { createObjectURL: () => 'blob:download', revokeObjectURL } });
    const removeChild = vi.fn(); vi.stubGlobal('document', { body: { appendChild: vi.fn(), removeChild }, createElement: () => ({ style: {}, click: () => { throw new Error('download failed'); } }) });
    expect(() => startOfficialDocPdfDownload(pdf)).toThrow('download failed');
    expect(removeChild).toHaveBeenCalledOnce(); vi.runAllTimers(); expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });
});
