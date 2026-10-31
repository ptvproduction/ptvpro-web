import { readFileSync } from 'node:fs';
export const financePdfTestAssets = {
  font: new Uint8Array(readFileSync('public/assets/fonts/plus-jakarta-sans/PlusJakartaSans-PdfRegular.ttf')),
  boldFont: new Uint8Array(readFileSync('public/assets/fonts/plus-jakarta-sans/PlusJakartaSans-PdfBold.ttf')),
  logoPng: new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')),
};
