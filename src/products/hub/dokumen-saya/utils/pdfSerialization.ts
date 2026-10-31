export function serializePdfObjects(objects: string[]): string {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    if (!objects[id]) throw new Error('Objek PDF tidak lengkap.');
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const startxref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) out += String(offset).padStart(10, '0') + ' 00000 n \n';
  return out + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
}

export function pdfBinaryBytes(binary: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(binary, (char) => {
    const byte = char.charCodeAt(0);
    if (byte > 255) throw new Error('PDF mengandung karakter yang belum diserialisasi menjadi byte.');
    return byte;
  });
}

export interface CapturedPdfPage {
  width: number;
  height: number;
  rgbDeflated: Uint8Array;
  text: string;
}

const binaryString = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return chunks.join('');
};

export function buildCapturedA4Pdf(pages: CapturedPdfPage[]): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw new Error('Dokumen PDF tidak memiliki halaman.');
  const objects = ['', '', ''];
  const add = (body: string) => { objects.push(body); return objects.length - 1; };
  const stream = (data: string, extra = '') => `<< /Length ${data.length}${extra} >>\nstream\n${data}\nendstream`;
  const chars = [...new Set(Array.from(pages.map((page) => page.text).join('')))];
  const encoding = new Map<string, { font: number; code: string }>();
  const fonts: number[] = [];
  for (let offset = 0; offset < chars.length; offset += 255) {
    const group = chars.slice(offset, offset + 255);
    const mappings = group.map((char, index) => {
      const code = (index + 1).toString(16).padStart(2, '0');
      encoding.set(char, { font: fonts.length, code });
      const unicode = char.split('').map((unit) => unit.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      return `<${code}> <${unicode}>`;
    });
    let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /PtvUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n';
    for (let i = 0; i < mappings.length; i += 100) {
      const block = mappings.slice(i, i + 100);
      cmap += `${block.length} beginbfchar\n${block.join('\n')}\nendbfchar\n`;
    }
    cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    const cmapId = add(stream(cmap));
    fonts.push(add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode ${cmapId} 0 R >>`));
  }
  const kids = pages.map((page) => {
    const image = binaryString(page.rgbDeflated);
    const imageId = add(stream(image, ` /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`));
    // Invisible Unicode text preserves search/copy; the visible image comes only from the approved template.
    let text = 'BT\n3 Tr\n1 0 0 1 1 1 Tm\n';
    let current = -1;
    let run = '';
    for (const char of Array.from(page.text)) {
      const mapped = encoding.get(char)!;
      if (mapped.font !== current) {
        if (run) text += `<${run}> Tj\n`;
        text += `/T${mapped.font} 0.1 Tf\n`;
        current = mapped.font; run = '';
      }
      run += mapped.code;
    }
    if (run) text += `<${run}> Tj\n`;
    text += 'ET';
    const contentId = add(stream(`q\n595.28 0 0 841.89 0 0 cm\n/PageImage Do\nQ\n${text}`));
    return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /PageImage ${imageId} 0 R >> /Font << ${fonts.map((id, index) => `/T${index} ${id} 0 R`).join(' ')} >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] >>`;
  return pdfBinaryBytes(serializePdfObjects(objects));
}
