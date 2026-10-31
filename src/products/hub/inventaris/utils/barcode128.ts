/**
 * PTVPRO — Linear Barcode 1D (Code 128 Subtype B Generator & Independent Decoder)
 * Sesuai standar ISO/IEC 15417 untuk pemindaian scanner barcode optik laboratorium fisik.
 */

// Tabel 107 pola modul Code 128 (panjang bar/space 6 modul untuk 0-105, 7 modul untuk STOP 106)
export const C128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export interface Code128ModuleData {
  text: string;
  codes: number[];
  checkSum: number;
  barStr: string;
  totalModules: number;
}

/**
 * Menghitung urutan modul dan checksum Code 128 Subtipe B
 */
export function getCode128Modules(rawCode: string): Code128ModuleData {
  const text = String(rawCode || 'INV-000').trim().toUpperCase();
  let checkSum = 104;
  const codes: number[] = [104]; // Start B

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // ASCII printable 32 s.d. 126
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
    checkSum += val * (i + 1);
  }

  const checkVal = checkSum % 103;
  codes.push(checkVal);
  codes.push(106); // Stop

  let barStr = '';
  for (const c of codes) {
    barStr += C128_PATTERNS[c] || '212222';
  }

  let totalModules = 0;
  for (let i = 0; i < barStr.length; i++) {
    totalModules += parseInt(barStr[i], 10);
  }

  return { text, codes, checkSum: checkVal, barStr, totalModules };
}

export interface BarcodeSVGOptions {
  width?: number;
  height?: number;
  barHeight?: number;
  fontSize?: number;
  showText?: boolean;
}

/**
 * Menghasilkan SVG Barcode Code 128 yang presisi dan terbaca scanner
 */
export function barcode128SVG(code: string, opts: BarcodeSVGOptions = {}): string {
  const { text, barStr, totalModules } = getCode128Modules(code);
  const width = opts.width || 240;
  const showText = opts.showText !== false;
  const fontSize = opts.fontSize || 11;
  const quietZone = 14;
  const totalWidth = totalModules + (quietZone * 2);

  const topPad = 4;
  let barHeight = opts.barHeight || 36;
  if (opts.height) {
    barHeight = showText ? Math.max(22, opts.height - (fontSize + 18)) : Math.max(24, opts.height - 8);
  }

  let x = quietZone;
  let rects = '';
  for (let i = 0; i < barStr.length; i++) {
    const w = parseInt(barStr[i], 10);
    const isBar = (i % 2 === 0);
    if (isBar) {
      rects += `<rect x="${x}" y="${topPad}" width="${w}" height="${barHeight}" fill="#0f172a"/>`;
    }
    x += w;
  }

  const gap = 8;
  const textBaselineY = topPad + barHeight + gap + (fontSize * 0.9);
  const totalHeight = showText ? Math.ceil(textBaselineY + 4) : (topPad + barHeight + topPad);

  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const textSvg = showText
    ? `<text x="${totalWidth / 2}" y="${textBaselineY.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${fontSize}" font-weight="700" style="letter-spacing: 2px;" fill="#0f172a">${escapedText}</text>`
    : '';

  return `<svg class="barcode-128" viewBox="0 0 ${totalWidth} ${totalHeight}" style="width:${width}px;height:auto;max-width:100%;color:#0f172a;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Barcode ${escapedText}">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>
    ${rects}
    ${textSvg}
  </svg>`;
}

/**
 * Independent Code 128 Decoder
 * Memvalidasi dan mendecode pola bar modular Code 128 kembali ke string ASCII aslinya,
 * memverifikasi Checksum modulo 103, Start B, dan Stop symbol secara matematis.
 */
export function decodeCode128Barcode(barStr: string): {
  code: string;
  isValid: boolean;
  checksumValid: boolean;
  rawCodes: number[];
} {
  // Bangun peta inversi pattern -> code
  const patternMap = new Map<string, number>();
  C128_PATTERNS.forEach((pat, idx) => {
    patternMap.set(pat, idx);
  });

  const rawCodes: number[] = [];
  let curIdx = 0;

  // Baca symbol demi symbol
  while (curIdx < barStr.length) {
    // Karakter STOP (106) memiliki panjang 7 digit modul pattern (2331112)
    const isStopCandidate = (curIdx + 7 === barStr.length);
    const chunkLen = isStopCandidate ? 7 : 6;
    const chunk = barStr.slice(curIdx, curIdx + chunkLen);
    const codeVal = patternMap.get(chunk);

    if (codeVal === undefined) {
      return { code: '', isValid: false, checksumValid: false, rawCodes };
    }

    rawCodes.push(codeVal);
    curIdx += chunkLen;
  }

  // Validasi struktur minimal: Start (1), Data (>=0), Checksum (1), Stop (1) -> min 3 symbols
  if (rawCodes.length < 3) {
    return { code: '', isValid: false, checksumValid: false, rawCodes };
  }

  const startCode = rawCodes[0];
  const stopCode = rawCodes[rawCodes.length - 1];
  const receivedChecksum = rawCodes[rawCodes.length - 2];

  if (startCode !== 104 || stopCode !== 106) {
    return { code: '', isValid: false, checksumValid: false, rawCodes };
  }

  // Hitung ulang checksum
  let calcChecksum = 104;
  const dataCodes = rawCodes.slice(1, rawCodes.length - 2);
  for (let i = 0; i < dataCodes.length; i++) {
    calcChecksum += dataCodes[i] * (i + 1);
  }
  const expectedChecksum = calcChecksum % 103;
  const checksumValid = (expectedChecksum === receivedChecksum);

  // Decode karakter data ASCII (Code 128 B: val + 32)
  const decodedChars = dataCodes.map(val => String.fromCharCode(val + 32)).join('');

  return {
    code: decodedChars,
    isValid: checksumValid,
    checksumValid,
    rawCodes
  };
}

/**
 * Format penomoran unit inventaris sesuai standar PHP Legacy:
 * format: ${invCode}-${String(unitNo).padStart(2, '0')} (contoh: INV-788-01)
 */
export function getUnitBarcodeCode(invCode?: string, unitNumber?: number, explicitCode?: string): string {
  if (explicitCode && explicitCode.trim()) {
    return explicitCode.trim().toUpperCase();
  }
  const cleanInv = (invCode || 'INV-000').trim().toUpperCase();
  const uNo = Number(unitNumber) || 1;
  return `${cleanInv}-${String(uNo).padStart(2, '0')}`;
}

/**
 * Cek apakah unit merupakan varian kolaborasi Niksan
 */
export function isNiksanUnit(unit?: { nama_unit?: string; kode_unit?: string } | string | null): boolean {
  if (!unit) return false;
  if (typeof unit === 'string') {
    return unit.toLowerCase().includes('niksan');
  }
  const name = (unit.nama_unit || '').toLowerCase();
  const code = (unit.kode_unit || '').toLowerCase();
  return name.includes('niksan') || code.includes('niksan');
}
