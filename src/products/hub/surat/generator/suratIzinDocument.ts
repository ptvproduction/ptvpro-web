import type { PtvDocument } from '../../dokumen-saya/mock/docsMockData';
import { COL_LABELS, PRESET_ASRAMA, PRESET_SEKOLAH, type IzinColKey, type Santri } from './mock/santriMockData';

export function isSuratIzinDocument(doc: Pick<PtvDocument, 'type'>): boolean {
  return doc.type === 'SI' || (/izin/i.test(doc.type) && !/barang/i.test(doc.type));
}

export function getSuratIzinDocumentProps(doc: PtvDocument) {
  const metadata = doc.metadata || {};
  const config = metadata.colsConfig as Partial<Record<IzinColKey, boolean>> | undefined;
  const preset = metadata.activePreset === 'asrama' ? PRESET_ASRAMA : PRESET_SEKOLAH;
  const keys = Object.keys(COL_LABELS) as IzinColKey[];
  const explicit = Array.isArray(metadata.activeCols)
    ? metadata.activeCols.filter((key): key is IzinColKey => typeof key === 'string' && keys.includes(key as IzinColKey))
    : null;
  // JSONB does not retain object key order; older records use the selected preset's canonical order.
  const activeCols = explicit ? [...new Set(explicit)] : (Object.keys(preset) as IzinColKey[]).filter((key) => (config || preset)[key]);
  const rows = doc.santri_list?.length ? doc.santri_list : doc.recipients || [];
  const selectedSantri: Santri[] = rows.map((value, index) => {
    const row = typeof value === 'string' ? { nama: value } : value;
    const fields = Object.fromEntries(keys.map((key) => [key, String(row[key] ?? '—')]));
    return { ...row, ...fields, nama: String(row.nama || '—'), _realIdx: index,
      angkatan: String(row.angkatan || '—'), is_intern: row.is_intern === true,
      jobdesc_enabled: row.jobdesc_enabled === true } as Santri;
  });
  return {
    selectedSantri, activeCols, kegiatan: doc.subject,
    tanggalMulai: doc.start_date || doc.date, tanggalSelesai: doc.end_date,
    hasEndDate: Boolean(doc.end_date && doc.end_date !== (doc.start_date || doc.date)),
    nomorSurat: doc.no, showDikeluarkan: metadata.showDikeluarkan !== false,
    customDikeluarkan: doc.penanggung_jawab || String(metadata.customDikeluarkan || 'Eksekutif'),
  };
}
