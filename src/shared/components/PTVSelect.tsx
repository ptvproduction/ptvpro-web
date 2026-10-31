import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface PTVSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  disabled?: boolean;
  description?: string;
  isAction?: boolean;
  onAction?: () => void;
  hasSeparatorBefore?: boolean;
}

export interface PTVSelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: PTVSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  clearable?: boolean;
  onClear?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  usePortal?: boolean;
}

export function PTVSelect<T extends string = string>({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  disabled = false,
  error = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  clearable = false,
  onClear,
  searchable = false,
  searchPlaceholder = 'Cari...',
  size = 'md',
  ariaLabel,
  usePortal = true,
}: PTVSelectProps<T>) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [portalCoords, setPortalCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filtered options if searchable
  const filteredOptions = searchable && searchQuery.trim() !== ''
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  // Reposition floating menu based on viewport collision
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip up if space below is under 220px and above is larger
    const nextPlacement = spaceBelow < 220 && spaceAbove > spaceBelow ? 'top' : 'bottom';
    setPlacement(nextPlacement);

    if (usePortal) {
      const top = nextPlacement === 'bottom'
        ? rect.bottom + 5
        : rect.top - 5;
      
      // Ensure dropdown does not overflow viewport bounds
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const width = Math.min(rect.width, Math.max(260, viewportW - 24));
      const left = Math.max(12, Math.min(rect.left, viewportW - width - 12));

      setPortalCoords({
        top,
        left,
        width,
      });
    }
  }, [usePortal]);

  // Open & Close handlers
  const handleOpen = useCallback(() => {
    if (disabled) return;
    window.dispatchEvent(new CustomEvent('ptv-select-open', { detail: selectId }));
    updatePosition();
    setIsOpen(true);
    setSearchQuery('');

    // Pre-highlight current selected option or first non-disabled option
    const selIdx = filteredOptions.findIndex((opt) => opt.value === value);
    if (selIdx >= 0) {
      setHighlightedIndex(selIdx);
    } else {
      const firstEnabled = filteredOptions.findIndex((opt) => !opt.disabled);
      setHighlightedIndex(firstEnabled >= 0 ? firstEnabled : 0);
    }
  }, [disabled, updatePosition, filteredOptions, value]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, []);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [isOpen, handleClose, handleOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        handleClose();
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    const handleOtherSelectOpen = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail !== selectId) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    document.addEventListener('click', handlePointerDownOutside);
    window.addEventListener('ptv-select-open', handleOtherSelectOpen);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('click', handlePointerDownOutside);
      window.removeEventListener('ptv-select-open', handleOtherSelectOpen);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, handleClose, updatePosition]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
    const targetItem = items[highlightedIndex];
    if (targetItem) {
      targetItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  // Select an option
  const handleSelect = (option: PTVSelectOption<T>) => {
    if (option.disabled) return;
    if (option.isAction && option.onAction) {
      option.onAction();
      handleClose();
      return;
    }
    onChange(option.value);
    handleClose();
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next].disabled) {
            next++;
          }
          return next < filteredOptions.length ? next : prev;
        });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt);
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        handleClose();
        break;
      }
    }
  };

  // Clear button click
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange('' as T);
    }
    handleClose();
  };

  // Floating menu JSX
  const menuContent = (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      className={`ptv-select-menu placement-${placement} ${usePortal ? 'ptv-select-menu-portal' : ''} ${menuClassName}`}
      style={
        usePortal && portalCoords
          ? {
              top: placement === 'bottom' ? `${portalCoords.top}px` : undefined,
              bottom: placement === 'top' ? `${window.innerHeight - portalCoords.top}px` : undefined,
              left: `${portalCoords.left}px`,
              width: `${portalCoords.width}px`,
            }
          : undefined
      }
      onKeyDown={handleKeyDown}
    >
      {searchable && (
        <div className="ptv-select-search-wrap">
          <input
            ref={searchInputRef}
            type="text"
            className="ptv-select-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      <ul className="ptv-select-list" role="presentation">
        {filteredOptions.length === 0 ? (
          <li className="ptv-select-empty" role="presentation">
            Tidak ada opsi yang cocok
          </li>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === highlightedIndex;
            return (
              <React.Fragment key={opt.value}>
                {opt.hasSeparatorBefore && (
                  <li className="ptv-select-separator" role="separator" />
                )}
                <li
                  id={`${selectId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  className={`ptv-select-item ${isSelected ? 'is-selected' : ''} ${
                    isFocused ? 'is-focused' : ''
                  } ${opt.disabled ? 'is-disabled' : ''} ${opt.isAction ? 'is-action' : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                >
                  <div className="ptv-select-item-content">
                    {opt.icon && (
                      opt.iconBg || opt.iconColor ? (
                        <span
                          className="ptv-select-icon-box"
                          style={{
                            backgroundColor: opt.iconBg || 'transparent',
                            color: opt.iconColor || 'inherit',
                          }}
                        >
                          <i className={opt.icon} />
                        </span>
                      ) : (
                        <i className={`${opt.icon} ptv-select-icon-lead`} />
                      )
                    )}
                    <div>
                      <div className="ptv-select-item-text">{opt.label}</div>
                      {opt.description && (
                        <div className="ptv-select-item-desc">{opt.description}</div>
                      )}
                    </div>
                  </div>
                  {isSelected && !opt.isAction && (
                    <i className="fa-solid fa-check ptv-select-check-icon" aria-hidden="true" />
                  )}
                </li>
              </React.Fragment>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={`ptv-select-wrapper ptv-select-${size} ${className}`}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`ptv-select-trigger ${isOpen ? 'is-open' : ''} ${
          error ? 'is-error' : ''
        } ${triggerClassName}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="ptv-select-value">
          {selectedOption?.icon && (
            selectedOption.iconBg || selectedOption.iconColor ? (
              <span
                className="ptv-select-icon-box"
                style={{
                  backgroundColor: selectedOption.iconBg || 'transparent',
                  color: selectedOption.iconColor || 'inherit',
                }}
              >
                <i className={selectedOption.icon} />
              </span>
            ) : (
              <i className={`${selectedOption.icon} ptv-select-icon-lead`} />
            )
          )}
          {selectedOption ? (
            <span className="ptv-select-text-label">{selectedOption.label}</span>
          ) : (
            <span className="ptv-select-placeholder">{placeholder}</span>
          )}
        </span>

        <span className="ptv-select-actions">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              className="ptv-select-clear-btn"
              onClick={handleClear}
              aria-label="Hapus pilihan"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
          <i
            className="fa-solid fa-chevron-down ptv-select-chevron"
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen && (usePortal ? createPortal(menuContent, document.body) : menuContent)}
    </div>
  );
}
