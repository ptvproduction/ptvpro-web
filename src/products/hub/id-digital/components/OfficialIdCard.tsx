import React, { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { RealQrCode, generateQrCodeDataUrl } from '@shared/utils';
import { buildOfficialCrewVerificationUrl } from '../../../verification/verificationService';
import { PTV_ID_CARD_LOGO_URL, PTV_ID_CARD_LOGO_BASE64 } from '../idDigitalAssets';

export interface OfficialIdCardProps {
  fullName: string;
  ptvId: string;
  position: string;
  division: string;
  status: string;
  fotoUrl?: string | null;
  onOpenVerifModal?: () => void;
  showActions?: boolean;
}

export const OfficialIdCard: React.FC<OfficialIdCardProps> = ({
  fullName,
  ptvId,
  position,
  division,
  status,
  fotoUrl,
  onOpenVerifModal,
  showActions = true,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);

  useEffect(() => {
    setPhotoLoadError(false);
  }, [fotoUrl]);

  const cleanName = fullName || 'KRU PROGRESIF';
  const cleanId = ptvId || 'PTV-000';
  const cleanPos = position || 'Kru Operasional';
  const cleanDiv = division || 'Technical';
  const cleanStatus = status || 'Aktif';

  const inits = cleanName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const crewVerificationUrl = buildOfficialCrewVerificationUrl(cleanId);

  const renderQrCodeSvg = (size = 52) => {
    return (
      <RealQrCode
        payload={crewVerificationUrl}
        size={size}
        margin={2}
        color="#0B2A4A"
        bgColor="#ffffff"
        ariaLabel={`QR Code Verifikasi Resmi ${cleanName}`}
      />
    );
  };

  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const loadImageAsync = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  };

  const handleDownloadPng = async () => {
    setIsDownloading(true);
    try {
      // 1. Prioritaskan toPng dari node DOM aktual agar hasil download identik 100% dengan preview
      if (cardRef.current) {
        if (typeof document !== 'undefined' && document.fonts) {
          try {
            await document.fonts.ready;
          } catch {
            // ignore font ready wait
          }
        }

        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 3, // Resolusi Retina tajam 1080x1680
          cacheBust: true,
          quality: 1.0,
          style: {
            transform: 'none',
            boxShadow: 'none',
            margin: '0',
          },
        });

        const link = document.createElement('a');
        link.download = `ID-Card-${cleanId}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
        return;
      }
    } catch (toPngErr) {
      console.warn('[OfficialIdCard] toPng capture fallback to canvas:', toPngErr);
    }

    // 2. Fallback Canvas manual rendering jika DOM capture gagal
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = 720;
      canvas.height = 1120; // Exact 2x Retina portrait 360x560

      // 1. Sudut Melengkung Luar (Clip)
      ctx.save();
      drawRoundRect(ctx, 0, 0, 720, 1120, 48);
      ctx.clip();

      // 2. Background Gradient Navy R03
      const grad = ctx.createLinearGradient(0, 0, 720, 1120);
      grad.addColorStop(0, '#071F48');
      grad.addColorStop(0.42, '#0A2E70');
      grad.addColorStop(1, '#051636');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 720, 1120);

      // 3. Ambient SVG Wave Curves
      ctx.save();
      const waveGrad1 = ctx.createLinearGradient(0, 0, 720, 1120);
      waveGrad1.addColorStop(0, 'rgba(30, 64, 175, 0.45)');
      waveGrad1.addColorStop(1, 'rgba(14, 47, 114, 0.1)');
      ctx.fillStyle = waveGrad1;
      ctx.beginPath();
      ctx.moveTo(-40, 160);
      ctx.bezierCurveTo(120, 80, 280, 260, 480, 180);
      ctx.bezierCurveTo(620, 120, 700, 220, 760, 190);
      ctx.lineTo(760, -40);
      ctx.lineTo(-40, -40);
      ctx.closePath();
      ctx.fill();

      const waveGrad2 = ctx.createLinearGradient(720, 0, 0, 1120);
      waveGrad2.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
      waveGrad2.addColorStop(1, 'rgba(29, 78, 216, 0.05)');
      ctx.fillStyle = waveGrad2;
      ctx.beginPath();
      ctx.moveTo(-60, 440);
      ctx.bezierCurveTo(100, 340, 240, 500, 440, 400);
      ctx.bezierCurveTo(580, 330, 660, 430, 780, 380);
      ctx.lineTo(780, -40);
      ctx.lineTo(-60, -40);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = waveGrad1;
      ctx.beginPath();
      ctx.moveTo(-40, 880);
      ctx.bezierCurveTo(140, 820, 260, 960, 460, 860);
      ctx.bezierCurveTo(600, 790, 680, 880, 760, 840);
      ctx.lineTo(760, 1160);
      ctx.lineTo(-40, 1160);
      ctx.closePath();
      ctx.fill();

      // Ambient Wave lines
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-20, 280);
      ctx.bezierCurveTo(180, 220, 320, 420, 540, 320);
      ctx.bezierCurveTo(660, 260, 720, 340, 780, 310);
      ctx.stroke();
      ctx.restore();

      // 4. Logo Progresif TV di Kiri Atas
      let logoImg: HTMLImageElement | null = null;
      try {
        logoImg = await loadImageAsync(PTV_ID_CARD_LOGO_URL);
      } catch {
        try {
          logoImg = await loadImageAsync(PTV_ID_CARD_LOGO_BASE64);
        } catch {
          logoImg = null;
        }
      }

      if (logoImg && logoImg.naturalWidth && logoImg.naturalHeight) {
        const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
        const targetHeight = 52;
        const targetWidth = Math.min(380, Math.round(targetHeight * logoAspectRatio));
        ctx.drawImage(logoImg, 44, 46, targetWidth, targetHeight);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('PROGRESIF TV', 44, 82);
      }

      // Label "KARTU IDENTITAS RESMI"
      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 16px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '0.12em';
      ctx.fillText('KARTU IDENTITAS RESMI', 44, 118);

      // 5. QR Code Box di Kanan Atas
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#FFFFFF';
      drawRoundRect(ctx, 556, 44, 120, 120, 24);
      ctx.fill();
      ctx.restore();

      // Render QR Code SVG di dalam box
      try {
        const qrDataUrl = await generateQrCodeDataUrl(crewVerificationUrl, {
          width: 312,
          margin: 1,
          color: '#0B2A4A',
          bgColor: '#FFFFFF',
        });
        const qrImg = await loadImageAsync(qrDataUrl);
        ctx.drawImage(qrImg, 564, 52, 104, 104);
      } catch (err) {
        console.warn('[OfficialIdCard] Canvas QR failed:', err);
      }

      // 6. Frame Foto Portrait di Tengah (Aspek Rasio 1 / 1.08)
      const frameX = 44;
      const frameY = 184;
      const frameW = 632;
      const frameH = 682;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 12;
      drawRoundRect(ctx, frameX, frameY, frameW, frameH, 32);
      ctx.clip();

      let photoImg: HTMLImageElement | null = null;
      if (fotoUrl && !photoLoadError) {
        try {
          photoImg = await loadImageAsync(fotoUrl);
        } catch {
          photoImg = null;
        }
      }

      if (photoImg && photoImg.naturalWidth && photoImg.naturalHeight) {
        const nw = photoImg.naturalWidth;
        const nh = photoImg.naturalHeight;
        const targetRatio = 1 / 1.08;
        const sourceRatio = nw / nh;
        let sw: number;
        let sh: number;
        let sx: number;
        let sy: number;

        if (sourceRatio > targetRatio) {
          sh = nh;
          sw = nh * targetRatio;
          sx = (nw - sw) / 2;
          sy = 0;
        } else {
          sw = nw;
          sh = nw / targetRatio;
          sx = 0;
          sy = Math.max(0, (nh - sh) * 0.2); // Posisi wajah 20% atas agar tidak terpotong
        }

        ctx.drawImage(photoImg, sx, sy, sw, sh, frameX, frameY, frameW, frameH);
      } else {
        const fbGrad = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
        fbGrad.addColorStop(0, '#1D4ED8');
        fbGrad.addColorStop(1, '#0A2F72');
        ctx.fillStyle = fbGrad;
        ctx.fillRect(frameX, frameY, frameW, frameH);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 112px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(inits, frameX + frameW / 2, frameY + frameH / 2);
      }
      ctx.restore();

      // Border frame foto tipis elegan
      ctx.save();
      drawRoundRect(ctx, frameX, frameY, frameW, frameH, 32);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.stroke();
      ctx.restore();

      // 7. Nama Anggota (Center, Bold, Uppercase)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanName.toUpperCase(), 360, 896);

      // 8. Credentials Grid Box (Translucent Glassmorphism)
      const gridX = 44;
      const gridY = 926;
      const gridW = 632;
      const gridH = 114;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      drawRoundRect(ctx, gridX, gridY, gridW, gridH, 24);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
      ctx.restore();

      // Kolom 1 (Kiri)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // KRU NO.
      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 16px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('KRU NO.', 72, 954);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(cleanId, 72, 982);

      // DIVISI
      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 16px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('DIVISI', 72, 1008);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(cleanDiv.toUpperCase(), 72, 1032);

      // Kolom 2 (Kanan)
      // POSITION
      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 16px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('POSITION', 380, 954);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(cleanPos.toUpperCase(), 380, 982);

      // STATUS
      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 16px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('STATUS', 380, 1008);

      ctx.fillStyle = cleanStatus === 'Aktif' ? '#4ADE80' : '#F87171';
      ctx.font = 'bold 22px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(cleanStatus.toUpperCase(), 380, 1032);

      // 9. Footer Strip PROGRESIF TV & Periode Berlaku
      const footerY = 1046;
      ctx.fillStyle = 'rgba(4, 18, 42, 0.85)';
      ctx.fillRect(0, footerY, 720, 74);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(720, footerY);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '0.12em';
      ctx.fillText('PROGRESIF TV', 44, 1090);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#93C5FD';
      ctx.font = 'bold 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.fillText('2026–2027', 676, 1090);

      // 10. Border Luar Kartu Stroke
      ctx.restore();
      ctx.save();
      drawRoundRect(ctx, 1.5, 1.5, 717, 1117, 48);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.stroke();
      ctx.restore();

      const link = document.createElement('a');
      link.download = `ID-Card-${cleanId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Failed to generate official ID card PNG', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="idcard-holder-wrap" style={{ margin: '0 auto', maxWidth: '360px', width: '100%' }}>
      {/* KTA Vertical Card (360x560) */}
      <div className="idcard" ref={cardRef}>
        {/* Ambient SVG Waves Background */}
        <div className="idcard-bg-layer" aria-hidden="true">
          <svg
            className="idcard-bg-waves"
            viewBox="0 0 360 560"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              d="M-20 80C60 40 140 130 240 90C310 60 350 110 380 95V-20H-20V80Z"
              fill="url(#officialWaveGrad1)"
              opacity="0.35"
            />
            <path
              d="M-30 220C50 170 120 250 220 200C290 165 330 215 390 190V-20H-30V220Z"
              fill="url(#officialWaveGrad2)"
              opacity="0.2"
            />
            <path
              d="M-20 440C70 410 130 480 230 430C300 395 340 440 380 420V580H-20V440Z"
              fill="url(#officialWaveGrad1)"
              opacity="0.25"
            />
            <path
              d="M-10 140C90 110 160 210 270 160C330 130 360 170 390 155"
              stroke="rgba(147, 197, 253, 0.2)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M-20 380C80 340 150 430 260 380C320 350 350 390 380 375"
              stroke="rgba(147, 197, 253, 0.15)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="officialWaveGrad1" x1="0" y1="0" x2="360" y2="560" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1E40AF" stopOpacity="0.6" />
                <stop offset="1" stopColor="#0E2F72" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="officialWaveGrad2" x1="360" y1="0" x2="0" y2="560" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" stopOpacity="0.4" />
                <stop offset="1" stopColor="#1D4ED8" stopOpacity="0.05" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Card Body */}
        <div className="idcard-body">
          {/* Top Bar: Brand left, QR right */}
          <div className="idcard-top-bar">
            <div className="idcard-brand-box">
              <img
                src={PTV_ID_CARD_LOGO_URL}
                alt="Progresif TV Production"
                className="idcard-logo-img"
                crossOrigin="anonymous"
              />
              <div className="idcard-brand-label">KARTU IDENTITAS RESMI</div>
            </div>
            <div className="idcard-qr-box">{renderQrCodeSvg()}</div>
          </div>

          {/* Center Photo Frame (Aspek Rasio 1 / 1.08 Proporsional) */}
          <div className="idcard-photo-frame">
            {fotoUrl && !photoLoadError ? (
              <img
                src={fotoUrl}
                alt={cleanName}
                className="idcard-photo-img"
                onError={() => setPhotoLoadError(true)}
              />
            ) : (
              <div className="idcard-photo-fallback">{inits}</div>
            )}
          </div>

          {/* Crew Name */}
          <div className="idcard-identity-block">
            <div className="idcard-person-name">{cleanName}</div>
          </div>

          {/* Credentials 4-Grid */}
          <div className="idcard-creds-grid">
            <div className="idcard-cred-item">
              <div className="idcard-cred-lbl">KRU NO.</div>
              <div className="idcard-cred-val idcard-cred-kruno">{cleanId}</div>
            </div>
            <div className="idcard-cred-item">
              <div className="idcard-cred-lbl">POSITION</div>
              <div className="idcard-cred-val">{cleanPos}</div>
            </div>
            <div className="idcard-cred-item">
              <div className="idcard-cred-lbl">DIVISI</div>
              <div className="idcard-cred-val">{cleanDiv}</div>
            </div>
            <div className="idcard-cred-item">
              <div className="idcard-cred-lbl">STATUS</div>
              <div
                className="idcard-cred-val"
                style={{ color: cleanStatus === 'Aktif' ? '#4ade80' : '#f87171' }}
              >
                {cleanStatus}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Strip */}
        <div className="idcard-footer-strip">
          <div className="idcard-footer-brand">PROGRESIF TV</div>
          <div className="idcard-footer-expiry">2026–2027</div>
        </div>
      </div>

      {/* Action Buttons Below Card */}
      {showActions && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            width: '100%',
            maxWidth: '360px',
            margin: '26px auto 0',
            position: 'relative',
            zIndex: 2,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="set-btn-pri"
            onClick={handleDownloadPng}
            disabled={isDownloading}
            style={{
              flex: 1,
              minHeight: '38px',
              borderRadius: 'var(--ptv-curve-pill, 9999px)',
              fontWeight: 600,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i
              className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}
              style={{ marginRight: '6px' }}
            />
            {isDownloading ? 'Memproses...' : 'Unduh Kartu PNG'}
          </button>
          {onOpenVerifModal && (
            <button
              type="button"
              className="set-btn-sec"
              onClick={onOpenVerifModal}
              style={{
                minHeight: '38px',
                borderRadius: 'var(--ptv-curve-pill, 9999px)',
                fontWeight: 600,
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
              }}
            >
              <i className="fa-solid fa-qrcode" style={{ marginRight: '6px' }} />
              Verifikasi
            </button>
          )}
        </div>
      )}
    </div>
  );
};
