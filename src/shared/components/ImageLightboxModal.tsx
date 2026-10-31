import React, { useRef } from "react";
import { X, ZoomIn } from "lucide-react";
import { useModalScrollLock } from "../hooks/useModalScrollLock";

interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl: string;
  altText: string;
  title?: string;
  caption?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  imageUrl,
  altText,
  title,
  caption,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(isOpen && imageUrl),
    onClose,
    modalRef,
    id: "ptv-image-lightbox-modal",
  });

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="ptv-lightbox-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Penampil Foto Layar Penuh"
    >
      <div ref={modalRef} className="ptv-lightbox-container" onClick={(e) => e.stopPropagation()}>
        <div className="ptv-lightbox-header">
          <div className="ptv-lightbox-title-box">
            <ZoomIn size={18} className="ptv-lightbox-icon" />
            <span className="ptv-lightbox-title">{title || "Detail Foto"}</span>
          </div>
          <button
            type="button"
            className="ptv-lightbox-close"
            onClick={onClose}
            aria-label="Tutup penampil foto"
          >
            <X size={20} />
          </button>
        </div>

        <div className="ptv-lightbox-body">
          <img
            src={imageUrl}
            alt={altText}
            className="ptv-lightbox-img"
          />
        </div>

        {caption && (
          <div className="ptv-lightbox-caption">
            <p>{caption}</p>
          </div>
        )}
      </div>
    </div>
  );
};
