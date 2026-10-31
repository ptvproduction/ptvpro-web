import { dokumenService } from '../dokumen-saya/dokumenService';

export const PERIZINAN_TIMEOUT_MS = 15000;

export async function loadPerizinan(signal: AbortSignal, timeoutMs = PERIZINAN_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => { reject(new DOMException('Request dibatalkan', 'AbortError')); controller.abort(); };
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new Error('Pengambilan perizinan melewati batas waktu. Silakan coba lagi.'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    if (signal.aborted) return await deadline;
    return await Promise.race([
      dokumenService.getDocuments('my', true, { signal: controller.signal, apiOnly: true }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
