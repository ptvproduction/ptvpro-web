import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { ItemInventaris, InventarisUnit } from './types';

export interface ScanMatchResult {
  matched: boolean;
  asset?: ItemInventaris;
  unit?: InventarisUnit;
  unitIndex?: number;
  message: string;
}

interface Props {
  onClose: () => void;
  onScan: (value: string, match?: ScanMatchResult) => void;
  catalogItems?: ItemInventaris[];
  title?: string;
}

interface NativeBarcodeDetector {
  detect: (video: HTMLVideoElement | ImageBitmapSource) => Promise<{ rawValue: string }[]>;
}

export function matchInventoryCode(code: string, items: ItemInventaris[]): ScanMatchResult {
  const clean = code.trim().toLowerCase();
  if (!clean) return { matched: false, message: 'Kode kosong.' };

  // 1. Cek kecocokan kode unit persis (misal: INV-001-U01 atau UUID unit)
  for (const item of items) {
    for (let i = 0; i < item.units.length; i++) {
      const u = item.units[i];
      if (
        u.kode_unit.toLowerCase() === clean ||
        u.id.toLowerCase() === clean ||
        (u.nomor_seri && u.nomor_seri.toLowerCase() === clean)
      ) {
        return {
          matched: true,
          asset: item,
          unit: u,
          unitIndex: i + 1,
          message: `Ditemukan ${item.nama_alat} — Unit ${i + 1} (${u.kode_unit})`,
        };
      }
    }
  }

  // 2. Cek kecocokan kode alat induk (misal: INV-001 atau UUID alat)
  for (const item of items) {
    if (item.kode.toLowerCase() === clean || item.id.toLowerCase() === clean) {
      return {
        matched: true,
        asset: item,
        message: `Ditemukan alat: ${item.nama_alat} (${item.kode})`,
      };
    }
  }

  // 3. Cek kecocokan parsial kode unit di bagian akhir
  for (const item of items) {
    for (let i = 0; i < item.units.length; i++) {
      const u = item.units[i];
      if (u.kode_unit.toLowerCase().endsWith(clean) || clean.endsWith(u.kode_unit.toLowerCase())) {
        return {
          matched: true,
          asset: item,
          unit: u,
          unitIndex: i + 1,
          message: `Ditemukan ${item.nama_alat} — Unit ${i + 1} (${u.kode_unit})`,
        };
      }
    }
  }

  return {
    matched: false,
    message: `Kode "${code}" tidak ditemukan pada katalog inventaris studio.`,
  };
}

export function InventoryScanDialog({ onClose, onScan, catalogItems, title = 'Pindai Barcode / QR Alat' }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const active = useRef(true);
  const frameId = useRef<number>(0);
  const lastScanTime = useRef<number>(0);

  const [code, setCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('Gunakan kamera untuk memindai barcode/QR, atau masukkan kode manual.');
  const [feedbackType, setFeedbackType] = useState<'info' | 'error' | 'success'>('info');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [selectedFacingMode, setSelectedFacingMode] = useState<'environment' | 'user'>('environment');

  useModalScrollLock({ isOpen: true, onClose, modalRef });

  const stopCamera = useCallback(() => {
    if (frameId.current) {
      cancelAnimationFrame(frameId.current);
      frameId.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        streamRef.current?.removeTrack(track);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  }, []);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  // Cek apakah perangkat memiliki lebih dari 1 kamera
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      }).catch(() => {
        // Abaikan jika tidak diizinkan enumerate
      });
    }
  }, []);

  const handleProcessCode = useCallback((scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed) return;

    if (catalogItems && catalogItems.length > 0) {
      const match = matchInventoryCode(trimmed, catalogItems);
      if (match.matched) {
        setFeedbackType('success');
        setStatusMessage(match.message);
        stopCamera();
        setTimeout(() => {
          onScan(trimmed, match);
        }, 350);
      } else {
        setFeedbackType('error');
        setStatusMessage(match.message);
      }
    } else {
      // Jika katalog tidak disediakan, teruskan langsung
      setFeedbackType('success');
      setStatusMessage(`Kode terdeteksi: ${trimmed}`);
      stopCamera();
      setTimeout(() => {
        onScan(trimmed);
      }, 300);
    }
  }, [catalogItems, onScan, stopCamera]);

  const startCamera = async (facing: 'environment' | 'user' = selectedFacingMode) => {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setFeedbackType('error');
      setStatusMessage('Pemindaian kamera memerlukan koneksi aman (HTTPS atau localhost).');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedbackType('error');
      setStatusMessage('Peramban ini tidak mendukung akses kamera. Masukkan kode secara manual pada formulir di bawah.');
      return;
    }

    stopCamera();
    setCameraLoading(true);
    setFeedbackType('info');
    setStatusMessage('Menghubungkan ke kamera perangkat...');

    try {
      let stream: MediaStream;
      try {
        // Coba prioritaskan kamera yang dipilih
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback ke kamera default apapun yang tersedia
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (!active.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // Wajib untuk iOS Safari
      await video.play();

      if (!active.current) {
        stopCamera();
        return;
      }

      setIsCameraActive(true);
      setCameraLoading(false);
      setFeedbackType('info');
      setStatusMessage('Arahkan kamera ke barcode unit atau QR code inventaris.');

      // Inisialisasi Native BarcodeDetector jika didukung browser
      const NativeDetector = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => NativeBarcodeDetector }).BarcodeDetector;
      let nativeDetector: NativeBarcodeDetector | null = null;
      if (NativeDetector) {
        try {
          nativeDetector = new NativeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
        } catch {
          nativeDetector = null;
        }
      }

      // Siapkan offscreen canvas untuk jsQR
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanLoop = async () => {
        if (!active.current || !streamRef.current) return;

        const now = Date.now();
        // Throttle pemindaian setiap ~90ms agar hemat baterai dan CPU
        if (now - lastScanTime.current >= 90 && video.readyState >= 2) {
          lastScanTime.current = now;

          let detectedValue = '';

          // 1. Coba Native BarcodeDetector (sangat cepat pada Chrome/Android)
          if (nativeDetector) {
            try {
              const results = await nativeDetector.detect(video);
              if (results && results.length > 0 && results[0]?.rawValue?.trim()) {
                detectedValue = results[0].rawValue.trim();
              }
            } catch {
              // Abaikan kegagalan frame, lanjutkan ke jsQR
            }
          }

          // 2. Fallback / tandem ke jsQR (100% kompatibel iOS Safari, Android, desktop webcam)
          if (!detectedValue && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qrResult = jsQR(imgData.data, canvas.width, canvas.height, {
                inversionAttempts: 'dontInvert',
              });
              if (qrResult && qrResult.data && qrResult.data.trim()) {
                detectedValue = qrResult.data.trim();
              }
            } catch {
              // Abaikan error canvas read
            }
          }

          if (detectedValue) {
            handleProcessCode(detectedValue);
            return; // Berhenti jika kode ditemukan
          }
        }

        if (active.current) {
          frameId.current = requestAnimationFrame(scanLoop);
        }
      };

      frameId.current = requestAnimationFrame(scanLoop);
    } catch (err: unknown) {
      stopCamera();
      if (!active.current) return;

      const error = err as Error;
      setFeedbackType('error');
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatusMessage('Izin kamera ditolak. Silakan izinkan akses kamera di setelan browser atau gunakan input manual.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setStatusMessage('Kamera tidak ditemukan pada perangkat ini. Silakan gunakan input manual.');
      } else {
        setStatusMessage(`Kamera belum dapat dibuka (${error.message || 'Error'}). Silakan gunakan input manual di bawah.`);
      }
    }
  };

  const toggleFacingMode = () => {
    const nextMode = selectedFacingMode === 'environment' ? 'user' : 'environment';
    setSelectedFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  return createPortal(
    <div className="ptv-hub-root inventory-scan-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="inventory-scan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-scan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} style={{ color: 'var(--b-600)' }} />
            <h2 id="inventory-scan-title">{title}</h2>
          </div>
          <button
            type="button"
            className="loan-modal-close-btn"
            aria-label="Tutup pemindaian"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '12px 0',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md, 10px)',
            fontSize: '13px',
            lineHeight: 1.45,
            background:
              feedbackType === 'error'
                ? '#fff1f2'
                : feedbackType === 'success'
                ? '#ecfdf5'
                : 'var(--bg-2, rgba(11, 42, 74, 0.04))',
            color:
              feedbackType === 'error'
                ? '#be123c'
                : feedbackType === 'success'
                ? '#047857'
                : 'var(--ink-2, #475569)',
            border: `1px solid ${
              feedbackType === 'error'
                ? '#fecdd3'
                : feedbackType === 'success'
                ? '#a7f3d0'
                : 'var(--line-2, #e2e8f0)'
            }`,
          }}
        >
          {feedbackType === 'error' && <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
          {feedbackType === 'success' && <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
          <div>{statusMessage}</div>
        </div>

        {/* Video Preview Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: 'var(--radius-md, 12px)',
            overflow: 'hidden',
            background: '#000000',
            minHeight: isCameraActive ? '200px' : '0px',
            display: isCameraActive ? 'block' : 'none',
            marginBottom: '12px',
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Pratinjau kamera pemindai"
            style={{
              width: '100%',
              maxHeight: '260px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Reticle / Target Scanner Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '65%',
                height: '65%',
                border: '2px dashed rgba(255, 255, 255, 0.85)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
              }}
            />
          </div>
        </div>

        {/* Action Buttons for Camera */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {!isCameraActive ? (
            <button
              type="button"
              className="btn"
              disabled={cameraLoading}
              onClick={() => startCamera()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flex: 1,
                minHeight: '44px',
                fontWeight: 650,
                borderRadius: 'var(--radius-md, 12px)',
              }}
            >
              <Camera size={18} />
              <span>{cameraLoading ? 'Membuka Kamera...' : 'Aktifkan Kamera'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={stopCamera}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md, 12px)',
                }}
              >
                Hentikan Kamera
              </button>
              {hasMultipleCameras && (
                <button
                  type="button"
                  className="btn"
                  title="Ganti Kamera Depan/Belakang"
                  onClick={toggleFacingMode}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md, 12px)',
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Manual Input Form */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) {
              handleProcessCode(code.trim());
            }
          }}
        >
          <label htmlFor="inventory-scan-code" style={{ fontSize: '13px', fontWeight: 650, color: 'var(--ink)' }}>
            Kode inventaris atau unit fisik
          </label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <input
              id="inventory-scan-code"
              className="loan-form-input"
              value={code}
              autoFocus
              required
              onChange={(event) => setCode(event.target.value)}
              placeholder="Contoh: INV-001 atau INV-001-U01"
              style={{ flex: 1, minHeight: '44px' }}
            />
            <button
              type="submit"
              className="btn pri"
              style={{ minHeight: '44px', paddingInline: '18px', fontWeight: 650, flexShrink: 0 }}
            >
              Cari Kode
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
