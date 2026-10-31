import { useCallback, useEffect, useRef, useState } from 'react';
import { PortalLoadState, PortalSnapshotError, requestPortalSnapshot } from '../portalSnapshot';

/** Setelah jeda ini, layar inisialisasi menambahkan catatan koneksi lambat (bukan persentase progres). */
export const SLOW_NOTICE_DELAY_MS = 6_000;

function describeError(err: unknown): string {
  if (err instanceof PortalSnapshotError) {
    if (err.code === 'timeout') return 'Server terlalu lama menjawab.';
    if (err.code === 'network') {
      return typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'Perangkat Anda sedang offline.'
        : 'Koneksi ke server gagal.';
    }
    return 'Data portal belum dapat dibaca dari server.';
  }
  return 'Terjadi kesalahan saat menyiapkan portal.';
}

/**
 * Siklus hidup portal publik: initializing → ready | error.
 * Setiap pemuatan memakai id permintaan; hasil dari permintaan lama tidak pernah menimpa yang baru.
 */
export function usePortalSnapshot(options: { includeDraft?: boolean } = {}) {
  const includeDraft = options.includeDraft === true;
  const [state, setState] = useState<PortalLoadState>({ status: 'initializing' });
  const [isSlow, setIsSlow] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setState({ status: 'initializing' });
    setIsSlow(false);

    requestPortalSnapshot({ includeDraft })
      .then((snapshot) => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: 'ready', snapshot });
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: 'error', message: describeError(err) });
      });
  }, [includeDraft]);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current++;
    };
  }, [load]);

  useEffect(() => {
    if (state.status !== 'initializing') return;
    const timer = setTimeout(() => setIsSlow(true), SLOW_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  return { state, isSlow, retry: load };
}
