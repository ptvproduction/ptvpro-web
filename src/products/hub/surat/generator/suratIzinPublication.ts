import type { PtvDocument } from '../../dokumen-saya/mock/docsMockData';
import { dokumenService } from '../../dokumen-saya/dokumenService';
import { prepareOfficialDocPdf, startOfficialDocPdfDownload, type OfficialPdfDownload } from '../../dokumen-saya/utils/docPdfPrinter';

type Payload = Parameters<typeof dokumenService.createDocument>[0];

export function createSuratIzinPublisher(deps = {
  create: (payload: Payload) => dokumenService.createDocument(payload),
  prepare: prepareOfficialDocPdf,
  download: startOfficialDocPdfDownload,
}) {
  let current: { fingerprint: string; id: string; doc?: PtvDocument; pdf?: OfficialPdfDownload } | undefined;
  let running = false;
  return async (payload: Payload) => {
    if (running) throw new Error('Penerbitan sedang diproses.');
    running = true;
    try {
      const fingerprint = JSON.stringify(payload);
      if (current?.fingerprint !== fingerprint) current = { fingerprint, id: crypto.randomUUID() };
      // Keep both the request ID and saved document when PDF preparation/download fails.
      current.doc ??= await deps.create({ ...payload, request_id: current.id });
      current.pdf ??= await deps.prepare(current.doc);
      deps.download(current.pdf);
      return { doc: current.doc, pdf: current.pdf };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Terjadi kesalahan sistem.';
      throw new Error(current?.doc
        ? `Surat ${current.doc.no} sudah tersimpan, tetapi unduhan gagal. Coba lagi tanpa mengubah data untuk mengunduh nomor yang sama. ${reason}`
        : `Penerbitan belum dikonfirmasi. Coba lagi dengan data yang sama. ${reason}`);
    } finally { running = false; }
  };
}
