import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { NoteCategoryKey, NOTE_CATEGORIES } from '../types';

export interface NoteCategoryDropdownProps {
  value: NoteCategoryKey;
  onChange: (category: NoteCategoryKey) => void;
  disabled?: boolean;
}

export const NoteCategoryDropdown: React.FC<NoteCategoryDropdownProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const listboxId = `${idPrefix}-cat-listbox`;

  const categoryList = Object.values(NOTE_CATEGORIES);
  const currentCat = NOTE_CATEGORIES[value] || NOTE_CATEGORIES.orange;

  // Update dynamic floating coordinates
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const estimatedMenuHeight = 320; // 5 opsi * ~58px + padding
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'bottom' | 'top' = 'bottom';
    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    }

    const margin = 12;
    const maxWidth = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - maxWidth - margin));

    setCoords({
      top: placement === 'bottom' ? rect.bottom + 6 : rect.top - 6,
      left,
      width: maxWidth,
      placement
    });
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    const currentIdx = categoryList.findIndex(c => c.key === value);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  const handleSelect = (categoryKey: NoteCategoryKey) => {
    onChange(categoryKey);
    handleClose();
    triggerRef.current?.focus();
  };

  // Posisi dinamis mengikuti scroll dan resize window
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Click outside listener (Mousedown & Touchstart)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      handleClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Escape listener with Capture Phase to prevent modal close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Mencegah modal ikut tertutup
        handleClose();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % categoryList.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + categoryList.length) % categoryList.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < categoryList.length) {
          handleSelect(categoryList[highlightedIndex].key);
        }
      } else if (e.key === 'Tab') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [isOpen, highlightedIndex, categoryList]);

  // Scroll item terpilih ke dalam view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>('.note-dropdown-item');
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  return (
    <div className="note-custom-dropdown">
      <button
        ref={triggerRef}
        type="button"
        id={`${idPrefix}-trigger`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label="Kategori Warna Catatan"
        disabled={disabled}
        className={`note-dropdown-trigger ${isOpen ? 'is-active' : ''}`}
        style={{
          backgroundColor: currentCat.bg,
          color: currentCat.text
        }}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
          <span
            className="note-dropdown-trigger-icon"
            style={{
              backgroundColor: currentCat.pillBg,
              color: currentCat.pillText
            }}
          >
            <i className={`fa-solid ${currentCat.icon}`}></i>
          </span>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>
              {currentCat.label}
            </div>
            <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '1px' }}>
              Contoh: {currentCat.example}
            </div>
          </div>
        </div>
        <i
          className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}
          style={{ fontSize: '13px', opacity: 0.85, transition: 'transform 0.2s ease' }}
          aria-hidden="true"
        ></i>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label="Pilihan Kategori Warna Catatan"
          className={`note-dropdown-portal-menu placement-${coords.placement}`}
          style={{
            position: 'fixed',
            top: coords.placement === 'bottom' ? `${coords.top}px` : undefined,
            bottom: coords.placement === 'top' ? `${window.innerHeight - coords.top}px` : undefined,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 1100
          }}
        >
          {categoryList.map((cat, idx) => {
            const isSelected = value === cat.key;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={cat.key}
                id={`${idPrefix}-opt-${cat.key}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={`note-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                style={{
                  backgroundColor: cat.bg,
                  color: cat.text
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(cat.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="note-dropdown-item-icon"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: cat.pillBg,
                      color: cat.pillText,
                      fontSize: '11px',
                      flexShrink: 0
                    }}
                  >
                    <i className={`fa-solid ${cat.icon}`}></i>
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{cat.label}</span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: 'var(--r-full, 999px)',
                          background: cat.pillBg,
                          color: cat.pillText,
                          fontWeight: 700
                        }}
                      >
                        {cat.short}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', lineHeight: 1.3 }}>
                      {cat.example}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <span
                    className="note-dropdown-check-badge"
                    style={{
                      color: cat.text,
                      fontSize: '13px',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      marginLeft: '8px'
                    }}
                  >
                    <i className="fa-solid fa-check"></i>
                  </span>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
