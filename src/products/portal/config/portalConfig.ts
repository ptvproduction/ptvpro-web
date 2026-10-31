import { Locale } from '../types';

/**
 * Konfigurasi Resmi PTVPRO Public Portal (Design System R03)
 */
export const PORTAL_CONFIG = {
  /**
   * Nomor WhatsApp resmi layanan helpdesk PTVPRO.
   * Format: Nomor internasional tanpa tanda '+' dan tanpa spasi/pemisah (contoh: '6281234567890').
   * Jika kosong/belum disetel, sistem tidak akan mengarahkan ke nomor dummy dan
   * akan menampilkan panduan konfigurasi yang ramah pengguna.
   *
   * Dapat diatur langsung di sini atau via environment variable VITE_WHATSAPP_HELP_NUMBER.
   */
  whatsappNumber:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WHATSAPP_HELP_NUMBER
      ? String(import.meta.env.VITE_WHATSAPP_HELP_NUMBER).trim()
      : '') || '6285334340616',

  /**
   * Pesan pembuka standar yang sopan dan kontekstual.
   */
  defaultGreeting: {
    id: "Assalamu'alaikum, saya ingin bertanya mengenai layanan PTVPRO.",
    en: 'Hello, I would like to inquire about PTVPRO digital services.',
  },
};

/**
 * Membangun URL WhatsApp wa.me dengan format nomor internasional bersih dan pesan ter-encode.
 * Mengembalikan null jika nomor WhatsApp belum dikonfigurasi.
 */
export function buildWhatsAppHelpUrl(options: {
  number?: string;
  topic?: string;
  pageName?: string;
  lang?: Locale;
  customMessage?: string;
}): string | null {
  const rawNumber = options.number ?? PORTAL_CONFIG.whatsappNumber;
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');

  // Validasi: nomor internasional minimal 8 digit (misal 62xxxxxxxx)
  if (!cleanNumber || cleanNumber.length < 8) {
    return null;
  }

  const lang = options.lang || 'id';
  let messageText = options.customMessage;

  if (!messageText) {
    const baseGreeting = PORTAL_CONFIG.defaultGreeting[lang] || PORTAL_CONFIG.defaultGreeting.id;
    const details: string[] = [];
    if (options.topic) {
      details.push(lang === 'id' ? `Topik: ${options.topic}` : `Topic: ${options.topic}`);
    }
    if (options.pageName) {
      details.push(lang === 'id' ? `Halaman: ${options.pageName}` : `Page: ${options.pageName}`);
    }

    if (details.length > 0) {
      messageText = `${baseGreeting}\n(${details.join(' — ')})`;
    } else {
      messageText = baseGreeting;
    }
  }

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(messageText)}`;
}
