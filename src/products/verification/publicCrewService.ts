import type { PublicCrewVerificationResult } from './types';

/**
 * Memanggil Serverless API publik /api/verifikasi-kru
 * Mengambil data identitas publik resmi kru tanpa membutuhkan sesi login internal.
 */
export async function verifyCrewOnServer(
  crewIdOrQuery: string,
  signal?: AbortSignal
): Promise<PublicCrewVerificationResult> {
  const clean = crewIdOrQuery.trim();
  if (!clean) {
    return {
      crew_id: '',
      full_name: '',
      position: '',
      division: '',
      angkatan: '',
      status_kru: 'Nonaktif',
      is_found: false,
      is_simulated: false,
      active_assignment: null,
    };
  }

  const query = new URLSearchParams({ q: clean });
  try {
    const response = await fetch(`/api/verifikasi-kru?${query.toString()}`, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      throw new Error(body?.error || 'Verifikasi identitas belum dapat dipastikan. Coba lagi atau hubungi pengelola.');
    }

    return {
      crew_id: body.crew_id || clean,
      full_name: body.full_name || 'Identitas Kru Tidak Terdaftar',
      position: body.position || '-',
      division: body.division || '-',
      angkatan: body.angkatan || '-',
      status_kru: body.status_kru || 'Nonaktif',
      foto_url: body.foto_url,
      is_found: Boolean(body.is_found),
      is_simulated: false,
      active_assignment: body.active_assignment || null,
    };
  } catch (err: any) {
    if (signal?.aborted) throw err;
    return {
      crew_id: clean,
      full_name: 'Identitas Kru Tidak Terdaftar',
      position: '-',
      division: '-',
      angkatan: '-',
      status_kru: 'Nonaktif',
      is_found: false,
      is_simulated: false,
      active_assignment: null,
    };
  }
}
