import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { dialogManager } from '@shared/utils/dialogManager';

export function PrintCopyOffer(props: { onClose: () => void; onPrint: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const check = () => {
      if (!dialogManager.hasActiveDialog()) { setVisible(true); return true; }
      return false;
    };
    if (check()) return;
    const timer = window.setInterval(() => { if (check()) window.clearInterval(timer); }, 200);
    return () => window.clearInterval(timer);
  }, []);
  return visible ? <PrintCopyDialog {...props} /> : null;
}

export function PrintCopyDialog({ onClose, onPrint }: { onClose: () => void; onPrint: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalScrollLock({ isOpen: true, onClose, modalRef: ref, id: 'surat-izin-print-copy' });
  return createPortal(
    <div className="gen-print-overlay" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="gen-print-title"
        aria-describedby="gen-print-description" className="gen-print-dialog" onClick={(event) => event.stopPropagation()}>
        <h2 id="gen-print-title">PDF Berhasil Diunduh</h2>
        <p id="gen-print-description">Apakah Anda ingin mencetak salinannya?</p>
        <div className="gen-print-actions">
          <button type="button" className="gen-preset-btn" onClick={onClose}>Tidak, Terima Kasih</button>
          <button type="button" className="gen-print-confirm" onClick={onPrint}>Cetak Salinan</button>
        </div>
      </div>
    </div>, document.body,
  );
}
