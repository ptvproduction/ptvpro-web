import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { getFontEmbedCSS, toSvg } from 'html-to-image';
import type { PtvDocument } from '../../dokumen-saya/mock/docsMockData';
import { buildCapturedA4Pdf, type CapturedPdfPage } from '../../dokumen-saya/utils/pdfSerialization';
import { getSuratIzinDocumentProps } from './suratIzinDocument';
import { SuratIzinPdfPreview } from './components/SuratIzinPdfPreview';
import '../../../../styles/generatorSurat.css';

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const captureStyles = [
  'display','position','top','right','bottom','left','width','height','min-width','max-width','min-height','max-height',
  'box-sizing','margin','padding','border-radius','border-collapse','border-spacing','table-layout','vertical-align',
  'font-family','font-size','font-weight','font-style','font-stretch','font-synthesis','font-feature-settings',
  'line-height','letter-spacing','word-spacing','text-align','text-transform','white-space','overflow-wrap','word-break',
  'color','background-color','opacity','visibility','overflow','z-index','filter','object-fit','object-position',
  'flex-grow','flex-shrink','flex-basis','flex-direction','flex-wrap','justify-content','align-items','align-self','gap',
  'fill','stroke','stroke-width','shape-rendering','-webkit-font-smoothing',
  ...['top','right','bottom','left'].flatMap((side) => ['width','style','color'].map((part) => `border-${side}-${part}`)),
];

export async function captureSuratIzinPages(doc: PtvDocument, includePreviews = false): Promise<{ pages: CapturedPdfPage[]; previews: string[] }> {
  const props = getSuratIzinDocumentProps(doc);
  if (!props.selectedSantri.length) throw new Error('Data santri surat tidak tersedia.');
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;background:white;color-scheme:light;';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<SuratIzinPdfPreview {...props} />));
    for (const weight of [400, 500, 600, 700, 800]) {
      const loaded = await document.fonts.load(`${weight} 12px "PTV Surat Plus Jakarta Sans"`);
      if (!loaded.length || loaded.some((face) => face.status !== 'loaded')) {
        throw new Error('Font Plus Jakarta Sans gagal dimuat. Coba unduh PDF kembali.');
      }
    }
    await document.fonts.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map(async (img) => {
      await img.decode();
      if (!img.naturalWidth) throw new Error('Gambar kop surat gagal dimuat.');
    }));
    let stable = 0;
    for (let i = 0; i < 120 && stable < 3; i++) {
      await frame();
      const area = host.querySelector<HTMLElement>('[data-pdf-layout]');
      if (area?.dataset.pdfLayout === 'error') throw new Error('Baris surat terlalu tinggi untuk halaman A4.');
      stable = area?.dataset.pdfLayout === 'ready' ? stable + 1 : 0;
    }
    if (stable < 3) throw new Error('Tata letak surat belum stabil.');
    const fontEmbedCSS = await getFontEmbedCSS(host, { preferredFontFormat: 'truetype' });
    if (!fontEmbedCSS.includes('base64,')) throw new Error('Font dokumen gagal disertakan pada renderer PDF.');
    const pages: CapturedPdfPage[] = [];
    const previews: string[] = [];
    for (const page of Array.from(host.querySelectorAll<HTMLElement>('.izin-pdf-page'))) {
      const elements = [page, ...Array.from(page.querySelectorAll<HTMLElement>('*'))];
      const fontSizes = elements.map((element, index) => {
        element.setAttribute('data-pdf-node', String(index));
        return getComputedStyle(element).fontSize;
      });
      const svgUrl = await toSvg(page, { width: 794, height: 1122,
        backgroundColor: '#ffffff', fontEmbedCSS, includeStyleProperties: captureStyles, style: { boxShadow: 'none' } });
      const svg = new DOMParser().parseFromString(decodeURIComponent(svgUrl.slice(svgUrl.indexOf(',') + 1)), 'image/svg+xml');
      // html-to-image floors font sizes; restore the actual preview metrics before rasterization.
      svg.querySelectorAll<HTMLElement>('[data-pdf-node]').forEach((element) => {
        element.style.fontSize = fontSizes[Number(element.dataset.pdfNode)];
        element.removeAttribute('data-pdf-node');
      });
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 794 * 3; canvas.height = 1122 * 3;
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = new Uint8Array(canvas.width * canvas.height * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4) { rgb[j++] = rgba[i]; rgb[j++] = rgba[i + 1]; rgb[j++] = rgba[i + 2]; }
      const compressed = new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'));
      pages.push({ width: canvas.width, height: canvas.height,
        rgbDeflated: new Uint8Array(await new Response(compressed).arrayBuffer()), text: page.innerText });
      if (includePreviews) previews.push(canvas.toDataURL('image/png'));
    }
    return { pages, previews };
  } finally { root.unmount(); host.remove(); }
}

export async function buildSuratIzinPdfBytes(doc: PtvDocument): Promise<Uint8Array<ArrayBuffer>> {
  return buildCapturedA4Pdf((await captureSuratIzinPages(doc)).pages);
}
