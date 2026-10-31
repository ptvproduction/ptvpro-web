export const VALID_INSTANSI_LIST = [
  'PTV',
  'SD',
  'SMP',
  'IIS SMP',
  'SMA',
  'MADIN',
  'ASRAMA',
  'SPI',
  'MI',
  'MTs',
  'MA',
  'RIBATH',
  'YAYASAN',
  'NDALEM',
] as const;

export type ValidInstansi = typeof VALID_INSTANSI_LIST[number];

export interface SantriDetailItem {
  id?: string;
  nama: string;
  kelas?: string;
  asrama?: string;
  kamar?: string;
  keperluan?: string;
  nis?: string;
  catatan?: string;
}

export interface DocumentVerificationLogItem {
  id?: string;
  nomor_surat?: string;
  nama_pemeriksa: string;
  instansi: string;
  waktu: string;
  hasil?: 'Berhasil' | 'Gagal' | string;
  status_dokumen?: string;
  catatan?: string;
}

export interface DocumentVerificationDetails {
  found: boolean;
  nomor_surat?: string;
  status?: 'valid' | 'tidak_valid' | 'kedaluwarsa' | 'menunggu';
  raw_status?: string;
  jenis_surat?: string;
  perihal?: string;
  tanggal_terbit?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  penanggung_jawab?: string;
  diajukan_oleh?: string;
  has_santri_list?: boolean;
  santri_count?: number;
  id?: string;
  riwayat_pemeriksaan?: DocumentVerificationLogItem[];
}

export interface ReviewerUnlockResponse {
  success: boolean;
  pemeriksa: {
    id?: string;
    nama: string;
    instansi: string;
    waktu: string;
    hasil?: string;
    status_dokumen?: string;
  };
  santri_list: SantriDetailItem[];
  riwayat_pemeriksaan?: DocumentVerificationLogItem[];
}

export async function verifyDocumentOnServer(
  nomor: string,
  docId?: string,
  qrToken?: string,
  signal?: AbortSignal
): Promise<DocumentVerificationDetails> {
  const query = new URLSearchParams({ nomor });
  if (docId) query.set('id', docId);
  if (qrToken) query.set('token', qrToken);
  const response = await fetch(`/api/verifikasi-surat?${query.toString()}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body.found !== 'boolean') {
    throw new Error(body?.error || 'Verifikasi server belum dapat dipastikan. Coba lagi atau hubungi pengelola.');
  }

  if (body.found && body.nomor_surat && body.nomor_surat !== nomor) {
    throw new Error('Nomor dokumen tidak cocok dengan hasil verifikasi.');
  }

  return body;
}

export async function unlockSantriListOnServer(
  nomorSurat: string,
  namaPemeriksa: string,
  instansi: string
): Promise<ReviewerUnlockResponse> {
  const response = await fetch('/api/verifikasi-surat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      nomor_surat: nomorSurat,
      nama_pemeriksa: namaPemeriksa,
      instansi,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !body.success) {
    throw new Error(body?.error || 'Gagal membuka rincian santri. Pastikan data terisi lengkap.');
  }

  return body;
}
