import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, User } from 'lucide-react';
import type { CrewMember } from '@products/hub/kru/types';

interface SearchableCrewSelectProps {
  crewMembers: CrewMember[];
  selectedPtvId: string;
  onSelect: (ptvId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SearchableCrewSelect({
  crewMembers,
  selectedPtvId,
  onSelect,
  label = 'Pilih Kru PTVPRO',
  placeholder = 'Cari nama kru atau PTV-ID...',
  required = false,
  disabled = false,
}: SearchableCrewSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCrew = useMemo(() => {
    return crewMembers.find(c => c.ptv_id === selectedPtvId);
  }, [crewMembers, selectedPtvId]);

  const filteredCrew = useMemo(() => {
    if (!search.trim()) return crewMembers;
    const q = search.toLowerCase();
    return crewMembers.filter(
      c =>
        c.full_name.toLowerCase().includes(q) ||
        c.ptv_id.toLowerCase().includes(q) ||
        (c.division || '').toLowerCase().includes(q)
    );
  }, [crewMembers, search]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (ptvId: string) => {
    onSelect(ptvId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="searchable-crew-select-container" ref={containerRef}>
      {label && (
        <label className="finance-field-label">
          {label} {required && <span style={{ color: 'var(--fin-red-dark)' }}>*</span>}
        </label>
      )}

      <button
        type="button"
        className={`searchable-crew-trigger ${isOpen ? 'open' : ''} ${selectedCrew ? 'selected' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedCrew ? (
          <div className="trigger-crew-info">
            {selectedCrew.foto_url ? (
              <img src={selectedCrew.foto_url} alt="" className="trigger-crew-avatar" />
            ) : (
              <span className="trigger-crew-placeholder">
                {selectedCrew.full_name.charAt(0)}
              </span>
            )}
            <div className="trigger-crew-text">
              <strong className="trigger-crew-name">{selectedCrew.full_name}</strong>
              <span className="trigger-crew-meta">
                <code>{selectedCrew.ptv_id}</code> · {selectedCrew.division || 'Kru'}
              </span>
            </div>
          </div>
        ) : (
          <span className="trigger-placeholder-text">
            <User size={15} style={{ marginRight: '6px', opacity: 0.5 }} />
            {placeholder}
          </span>
        )}
        <ChevronDown size={16} className={`trigger-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="searchable-crew-dropdown" role="listbox">
          <div className="search-input-wrapper">
            <Search size={14} className="dropdown-search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              className="dropdown-search-input"
              placeholder="Ketik untuk memfilter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setIsOpen(false);
                if (e.key === 'Enter' && filteredCrew[0]) {
                  e.preventDefault();
                  handleSelect(filteredCrew[0].ptv_id);
                }
              }}
            />
          </div>

          <div className="searchable-crew-list">
            {filteredCrew.length > 0 ? (
              filteredCrew.map(crew => {
                const isSelected = crew.ptv_id === selectedPtvId;
                return (
                  <button
                    key={crew.id || crew.ptv_id}
                    type="button"
                    className={`crew-option-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(crew.ptv_id)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="crew-option-left">
                      {crew.foto_url ? (
                        <img src={crew.foto_url} alt="" className="option-avatar" />
                      ) : (
                        <span className="option-placeholder">{crew.full_name.charAt(0)}</span>
                      )}
                      <div>
                        <div className="option-name">{crew.full_name}</div>
                        <div className="option-sub">
                          <code>{crew.ptv_id}</code> · {crew.division || 'Kru'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="option-check-icon" />}
                  </button>
                );
              })
            ) : (
              <div className="crew-empty-search">
                Tidak ada kru yang cocok dengan &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
