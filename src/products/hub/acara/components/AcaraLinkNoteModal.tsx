/**
 * PTV PRO — Modul Acara
 * Modal Tautkan Notulensi Rapat ke Acara
 * Porting openLinkEventNoteModal (page-dasbor.php L18167–18260)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem } from '../types';
import { useAcara } from '../context/AcaraContext';
import { X, Search, Link as LinkIcon, Unlink, FileText, Check } from 'lucide-react';
import { formatHumanDateIndo } from '../utils/acaraDateUtils';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface AcaraLinkNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcaraItem;
}

export const AcaraLinkNoteModal: React.FC<AcaraLinkNoteModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const { notulensiList, linkNotulensi, unlinkNotulensi, getLinkedNotulensi } = useAcara();
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-link-note-modal',
  });

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const linkedNotes = useMemo(() => {
    return getLinkedNotulensi(event);
  }, [getLinkedNotulensi, event]);

  const linkedIdsSet = useMemo(() => {
    return new Set(linkedNotes.map((n) => n.id));
  }, [linkedNotes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notulensiList;
    return notulensiList.filter(
      (n) =>
        n.judul.toLowerCase().includes(q) ||
        (n.isi && n.isi.toLowerCase().includes(q)) ||
        (n.created_by_name && n.created_by_name.toLowerCase().includes(q))
    );
  }, [search, notulensiList]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-link-note-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '640px' }}>
        <div className="acara-modal-header">
          <div>
            <h3 className="acara-modal-title" id="acara-link-note-title">
              Tautkan Notulensi Rapat
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              Pilih hasil rapat untuk dihubungkan ke agenda {event.name}
            </p>
          </div>
          <button type="button" className="acara-modal-close-btn" onClick={onClose} aria-label="Tutup modal">
            <X size={18} />
          </button>
        </div>

        <div className="acara-modal-body">
          {/* Target Event Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--r-lg, 12px)',
              background: 'var(--surface-2, #f8fafc)',
              border: '1px solid var(--line, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 750, color: 'var(--b-600, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Acara Target
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--ink, #0f172a)' }}>{event.name}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
              {formatHumanDateIndo(event.date)} • {event.loc}
            </div>
          </div>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              background: 'var(--surface-2, #ffffff)',
              borderRadius: 'var(--r-lg, 12px)',
              border: '1.5px solid var(--line, #e2e8f0)'
            }}
          >
            <Search size={16} style={{ color: 'var(--muted, #94a3b8)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari judul atau isi notulensi rapat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                color: 'var(--ink, #0f172a)'
              }}
            />
          </div>

          {/* List Notulensi Rapat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredNotes.map((note) => {
              const isLinked = linkedIdsSet.has(note.id);
              const preview = note.isi
                ? note.isi.replace(/<[^>]+>/g, '').slice(0, 140) + '...'
                : '';

              return (
                <div
                  key={note.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--r-xl, 14px)',
                    border: isLinked ? '1.5px solid var(--b-600, #2563eb)' : '1.5px solid var(--line, #e2e8f0)',
                    background: isLinked ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2, #ffffff)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: isLinked ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 750,
                            padding: '2px 8px',
                            borderRadius: 'var(--r-full, 9999px)',
                            background: isLinked ? 'rgba(37, 99, 235, 0.2)' : 'var(--surface)',
                            color: 'var(--b-400, #1d4ed8)',
                            border: '1px solid var(--line, #bfdbfe)'
                          }}
                        >
                          <FileText size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {note.date ? formatHumanDateIndo(note.date) : 'Notulensi'}
                        </span>
                        {isLinked && (
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 750,
                              padding: '2px 8px',
                              borderRadius: 'var(--r-full, 9999px)',
                              background: 'var(--b-600, #2563eb)',
                              color: '#ffffff'
                            }}
                          >
                            ✓ Terkait Acara Ini
                          </span>
                        )}
                      </div>

                      <h4 style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 750, color: 'var(--ink, #0f172a)', lineHeight: 1.35 }}>
                        {note.judul}
                      </h4>

                      {preview && (
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #64748b)', lineHeight: 1.45 }}>
                          {preview}
                        </p>
                      )}

                      {note.created_by_name && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted, #94a3b8)' }}>
                          Dicatat oleh <strong style={{ color: 'var(--ink, #64748b)' }}>{note.created_by_name}</strong>
                        </div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {isLinked ? (
                        <button
                          type="button"
                          onClick={() => unlinkNotulensi(event.id, note.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            fontWeight: 650,
                            padding: '5px 12px',
                            borderRadius: 'var(--r-md, 8px)',
                            color: 'var(--dang, #dc2626)',
                            border: '1px solid var(--dang-border, #fecaca)',
                            background: 'var(--dang-bg, #fef2f2)',
                            cursor: 'pointer'
                          }}
                        >
                          <Unlink size={12} /> Lepas
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => linkNotulensi(event.id, note.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '5px 12px',
                            borderRadius: 'var(--r-md, 8px)',
                            color: '#ffffff',
                            border: 'none',
                            background: 'var(--b-600, #2563eb)',
                            cursor: 'pointer'
                          }}
                        >
                          <LinkIcon size={12} /> Pilih
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
                Tidak ada notulensi yang cocok dengan &quot;{search}&quot;.
              </div>
            )}
          </div>
        </div>

        <div className="acara-modal-footer">
          <button type="button" className="acara-btn-primary" onClick={onClose}>
            <Check size={16} /> Selesai
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
