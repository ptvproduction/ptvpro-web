/**
 * PTVPRO — Global QR Code Standardization Utility
 * Standardized QR Code generation engine utilizing official 'qrcode' library.
 * Fully scannable by physical mobile optical scanners and independent QR decoders (jsqr).
 */

import React, { useMemo } from 'react';
import QRCode from 'qrcode';

export interface QrCodeOptions {
  size?: number;
  margin?: number;
  color?: string;
  bgColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface RealQrCodeProps extends QrCodeOptions {
  payload: string;
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

/**
 * Menghasilkan SVG Data Matrix murni secara sinkron dari payload QR
 */
export function getQrMatrix(
  text: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
) {
  if (!text || text.trim() === '') {
    return null;
  }
  try {
    return QRCode.create(text, { errorCorrectionLevel });
  } catch (err) {
    console.warn('[RealQrCode] Failed to create QR matrix:', err);
    return null;
  }
}

/**
 * Komponen React QR Code Resmi PTVPRO
 * Menghasilkan SVG murni dengan modul presisi tinggi dan quiet-zone memadai
 */
export const RealQrCode: React.FC<RealQrCodeProps> = ({
  payload,
  size = 64,
  margin = 2,
  color = '#0B2A4A',
  bgColor = '#ffffff',
  errorCorrectionLevel = 'M',
  className,
  ariaLabel = 'Kode QR Verifikasi Resmi',
  style,
}) => {
  const qr = useMemo(
    () => getQrMatrix(payload, errorCorrectionLevel),
    [payload, errorCorrectionLevel]
  );

  if (!qr) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bgColor,
          border: '1px dashed #cbd5e1',
          borderRadius: '6px',
          color: '#94a3b8',
          fontSize: '10px',
          ...style,
        }}
        aria-label="QR Code tidak tersedia"
      >
        Invalid QR
      </div>
    );
  }

  const moduleCount = qr.modules.size;
  const totalViewBox = moduleCount + margin * 2;

  // Build horizontal run-length path for crisp vector rendering
  let path = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.modules.get(r, c)) {
        path += `M${c + margin} ${r + margin}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      data-payload={payload}
      style={{
        display: 'block',
        borderRadius: '6px',
        overflow: 'hidden',
        background: bgColor,
        ...style,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <rect width={totalViewBox} height={totalViewBox} fill={bgColor} />
      <path fill={color} d={path} />
    </svg>
  );
};

/**
 * Menghasilkan data URL PNG (300+ DPI resolusi cetak)
 */
export async function generateQrCodeDataUrl(
  text: string,
  options?: QrCodeOptions & { width?: number }
): Promise<string> {
  const width = options?.width || 512;
  const margin = options?.margin ?? 2;
  const dark = options?.color || '#0B2A4A';
  const light = options?.bgColor || '#ffffff';
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'M';

  return QRCode.toDataURL(text, {
    width,
    margin,
    color: { dark, light },
    errorCorrectionLevel,
  });
}

/**
 * Menghasilkan string SVG mandiri untuk ekspor dokumen/surat
 */
export async function generateQrCodeSvgString(
  text: string,
  options?: QrCodeOptions
): Promise<string> {
  const margin = options?.margin ?? 2;
  const dark = options?.color || '#0B2A4A';
  const light = options?.bgColor || '#ffffff';
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'M';

  return QRCode.toString(text, {
    type: 'svg',
    margin,
    color: { dark, light },
    errorCorrectionLevel,
  });
}
