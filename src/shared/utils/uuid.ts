/**
 * Universal Safe UUID Generator
 *
 * Mengatasi ketiadaan `window.crypto.randomUUID` pada konteks non-HTTPS (misalnya
 * pengujian lokal via IP LAN di HP) atau browser/webview lama dengan fallback
 * ke `crypto.getRandomValues` dan implementasi RFC4122 v4 berbasis Math.random.
 */

export function safeRandomUuid(): string {
  // 1. Coba crypto.randomUUID bawaan jika tersedia di secure context
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Abaikan dan lanjut ke fallback jika melempar error
    }
  }

  // 2. Fallback menggunakan crypto.getRandomValues
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set versi ke 0100 (v4)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set varian ke 10xx (RFC 4122)
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Abaikan dan lanjut ke fallback 3
    }
  }

  // 3. Fallback matematika murni (RFC4122 v4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
