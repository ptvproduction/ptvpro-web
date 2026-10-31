import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MockWorkspaceRepository, selectItems, conflictPairs } from './repository';
import type { WorkspaceRepository } from './adapter';
import {
  defaultView,
  emptyItem,
  getAssignmentPersonIds,
  kinds,
  labels,
  type Actor,
  type CrewAssignment,
  type Edition,
  type Kind,
  type Person,
  type Status,
  type ViewMode,
  type WorkItem,
} from './types';
import { getPpbsTemplateItems } from './fixtures';
import { useModalScrollLock } from '../../../shared/hooks/useModalScrollLock';
import { ContinuousModalSurface } from '../../../design-system/components/ContinuousModalSurface';
import './workspace.css';

const modes: ViewMode[] = ['Calendar', 'By Project', 'By Person', 'By Event', 'List'];

const dateLabel = (value: string) => {
  if (!value) return 'Belum dijadwalkan';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: value.includes('T') ? '2-digit' : undefined,
      minute: value.includes('T') ? '2-digit' : undefined,
    }).format(new Date(value));
  } catch {
    return value;
  }
};

function getItemTagClass(item: WorkItem): string {
  if (item.kind === 'event') return 'hh-tag-event';
  const format = (item.format || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  if (format.includes('story') || title.includes('story')) return 'hh-tag-story';
  if (format.includes('reels') || title.includes('reels') || title.includes('video')) return 'hh-tag-reels';
  if (format.includes('feed') || title.includes('feed') || title.includes('quotes')) return 'hh-tag-feed';
  return 'hh-tag-event';
}

function Dialog({
  title,
  close,
  children,
  maxWidth = '680px',
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalScrollLock({ isOpen: true, onClose: close, modalRef: ref });

  return createPortal(
    <div className="hh-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <ContinuousModalSurface
        ref={ref}
        role="dialog"
        tabIndex={-1}
        ariaLabel={title}
        className="hh-dialog"
        maxWidth={maxWidth}
        contentPadding="0"
        style={{ color: 'inherit' }}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" className="hh-btn" onClick={close} aria-label="Tutup detail">
            Tutup
          </button>
        </header>
        {children}
      </ContinuousModalSurface>
    </div>,
    document.body
  );
}

/**
 * PTV-DEV-207: Interactive Status Picker for quick collaborative updates
 */
function StatusPicker({
  status,
  onSelect,
}: {
  status: Status;
  onSelect: (s: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="hh-status-picker-wrap" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={`hh-status-btn hh-${status.toLowerCase()}`}
        onClick={() => setOpen(o => !o)}
        title="Klik untuk ubah status langsung"
      >
        <span className="hh-status-dot" />
        <span>{status === 'Rencana' ? 'Assigned' : status === 'Dikerjakan' ? 'In Progress' : status === 'Selesai' ? 'Done' : status}</span>
        <i className="fa-solid fa-chevron-down" style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }} />
      </button>

      {open && (
        <div className="hh-status-popover">
          {(['Rencana', 'Dikerjakan', 'Review', 'Selesai'] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`hh-status-opt ${status === s ? 'active' : ''}`}
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
            >
              <span className={`hh-status-dot hh-${s.toLowerCase()}`} />
              <span>{s === 'Rencana' ? 'Assigned / Rencana' : s === 'Dikerjakan' ? 'In Progress / Dikerjakan' : s === 'Selesai' ? 'Done / Selesai' : 'Review'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * PTV-DEV-207: File Location cell supporting Google Drive, Figma, folder path, or text
 */
function FileCell({
  item,
  onEdit,
}: {
  item: WorkItem;
  onEdit: () => void;
}) {
  const url = item.resultUrl ? item.resultUrl.trim() : '';
  const isHttp = /^https?:\/\//i.test(url);
  const isDrive = url.includes('drive.google.com') || url.includes('/drive/');

  if (!url) {
    return (
      <button
        type="button"
        className="hh-file-btn-add"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Isi link Google Drive atau lokasi berkas"
      >
        + Isi lokasi file
      </button>
    );
  }

  return (
    <div className="hh-file-cell" onClick={e => e.stopPropagation()}>
      {isHttp ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hh-file-pill"
          title={url}
        >
          <i className={isDrive ? "fa-brands fa-google-drive" : "fa-solid fa-arrow-up-right-from-square"} />
          <span>{isDrive ? 'Google Drive' : 'Buka File ↗'}</span>
        </a>
      ) : (
        <span className="hh-file-text" title={url}>
          <i className="fa-regular fa-folder" />
          <span>{url}</span>
        </span>
      )}
      <button
        type="button"
        className="hh-file-edit-btn"
        onClick={onEdit}
        title="Ubah lokasi file"
      >
        <i className="fa-solid fa-pencil" />
      </button>
    </div>
  );
}

/**
 * PTV-DEV-207: Notion-Style Task Side Peek
 */
function TaskSidePeek({
  item,
  people,
  activePeople,
  actor,
  save,
  close,
  onArchive,
}: {
  item: WorkItem;
  people: Person[];
  activePeople: Person[];
  actor: Actor;
  save: (item: WorkItem) => void;
  close: () => void;
  onArchive?: () => void;
}) {
  const [draft, setDraft] = useState<WorkItem>({ ...item });
  const [feedback, setFeedback] = useState<string>('');
  const isCoordinator = actor.role === 'coordinator';

  const personName = (id: string) => people.find(p => p.id === id)?.name || 'Belum ditugaskan';

  const handleSave = () => {
    try {
      save(draft);
      setFeedback('Perubahan tersimpan!');
      setTimeout(() => setFeedback(''), 2500);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan.');
    }
  };

  const isHttp = /^https?:\/\//i.test(draft.resultUrl || '');
  const isDrive = (draft.resultUrl || '').includes('drive.google.com');

  return createPortal(
    <div
      className="hh-side-peek-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="hh-side-peek" role="dialog" aria-label={`Task: ${draft.title}`}>
        <header className="hh-peek-header">
          <div className="hh-peek-header-left">
            <span className="hh-peek-kind-tag">Task</span>
            <span className={`hh-status hh-${draft.status.toLowerCase()}`}>
              {draft.status === 'Rencana' ? 'Assigned' : draft.status}
            </span>
          </div>
          <div className="hh-peek-header-actions">
            {isHttp && (
              <a
                href={draft.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hh-btn hh-btn-sm"
                title="Buka lokasi file di tab baru"
              >
                <i className={isDrive ? "fa-brands fa-google-drive" : "fa-solid fa-arrow-up-right-from-square"} />
                <span>Buka Link ↗</span>
              </a>
            )}
            <button
              type="button"
              className="hh-peek-close-btn"
              onClick={close}
              aria-label="Tutup panel"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="hh-peek-body">
          {isCoordinator ? (
            <input
              className="hh-peek-title-input"
              value={draft.title}
              placeholder="Judul task..."
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />
          ) : (
            <h2 className="hh-peek-title-static">{draft.title}</h2>
          )}

          <div className="hh-peek-props-table">
            {/* Status */}
            <div className="hh-peek-prop-row">
              <span className="hh-peek-prop-label">
                <i className="fa-regular fa-circle-dot" /> Status
              </span>
              <div className="hh-peek-prop-val">
                <select
                  className="hh-peek-select"
                  value={draft.status}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value as any }))}
                >
                  <option value="Rencana">Assigned / Rencana</option>
                  <option value="Dikerjakan">In Progress / Dikerjakan</option>
                  <option value="Review">Review</option>
                  <option value="Selesai">Done / Selesai</option>
                </select>
              </div>
            </div>

            {/* Batas Penyelesaian */}
            <div className="hh-peek-prop-row">
              <span className="hh-peek-prop-label">
                <i className="fa-regular fa-calendar" /> Batas Penyelesaian
              </span>
              <div className="hh-peek-prop-val">
                {isCoordinator ? (
                  <input
                    type="datetime-local"
                    className="hh-peek-input"
                    value={draft.end}
                    onChange={e => setDraft(d => ({ ...d, end: e.target.value }))}
                  />
                ) : (
                  <span className="hh-peek-static-val">{dateLabel(draft.end)}</span>
                )}
              </div>
            </div>

            {/* Kru Bertugas */}
            <div className="hh-peek-prop-row">
              <span className="hh-peek-prop-label">
                <i className="fa-regular fa-user" /> Kru Bertugas
              </span>
              <div className="hh-peek-prop-val">
                {isCoordinator ? (
                  <select
                    className="hh-peek-select"
                    value={draft.picId}
                    onChange={e => setDraft(d => ({ ...d, picId: e.target.value }))}
                  >
                    <option value="">Belum ditugaskan</option>
                    {activePeople.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="hh-person-pill">
                    <span className="hh-avatar-circle">{personName(draft.picId).slice(0, 1)}</span>
                    <span>{personName(draft.picId)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lokasi File / Link Hasil */}
            <div className="hh-peek-prop-row" style={{ alignItems: 'flex-start' }}>
              <span className="hh-peek-prop-label" style={{ marginTop: 8 }}>
                <i className="fa-solid fa-folder-open" /> Lokasi File / Link Hasil
              </span>
              <div className="hh-peek-prop-val">
                <input
                  type="text"
                  className="hh-peek-input"
                  placeholder="Link Google Drive, file/desain, atau folder kerja..."
                  value={draft.resultUrl}
                  onChange={e => setDraft(d => ({ ...d, resultUrl: e.target.value }))}
                />
                <span className="hh-peek-hint">
                  Dapat diisi link Google Drive, Figma, Canva, atau path folder server.
                </span>
              </div>
            </div>

            {/* Approval */}
            <div className="hh-peek-prop-row">
              <span className="hh-peek-prop-label">
                <i className="fa-solid fa-stamp" /> Approval
              </span>
              <div className="hh-peek-prop-val">
                {isCoordinator ? (
                  <select
                    className="hh-peek-select"
                    value={draft.approval}
                    onChange={e => setDraft(d => ({ ...d, approval: e.target.value as any }))}
                  >
                    <option value="Belum diajukan">Belum diajukan</option>
                    <option value="Menunggu">Menunggu</option>
                    <option value="Disetujui">Disetujui</option>
                    <option value="Revisi">Revisi</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="hh-event-badge">{draft.approval}</span>
                    {draft.approval !== 'Menunggu' && draft.approval !== 'Disetujui' && (
                      <button
                        type="button"
                        className="hh-btn hh-btn-sm"
                        onClick={() => setDraft(d => ({ ...d, approval: 'Menunggu' }))}
                      >
                        Ajukan Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Penjelasan Pekerjaan */}
          <div className="hh-peek-section">
            <label className="hh-peek-section-lbl">Penjelasan Pekerjaan</label>
            <textarea
              className="hh-peek-textarea"
              rows={3}
              placeholder="Penjelasan ringkas pekerjaan..."
              value={draft.brief}
              onChange={e => setDraft(d => ({ ...d, brief: e.target.value }))}
            />
          </div>

          {/* Catatan */}
          <div className="hh-peek-section">
            <label className="hh-peek-section-lbl">Catatan & Referensi Tim</label>
            <textarea
              className="hh-peek-textarea"
              rows={3}
              placeholder="Catatan tambahan, link aset, atau catatan revisi..."
              value={draft.references}
              onChange={e => setDraft(d => ({ ...d, references: e.target.value }))}
            />
          </div>
        </div>

        <footer className="hh-peek-footer">
          <div>
            {feedback && <span className="hh-save-feedback">{feedback}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCoordinator && onArchive && (
              <button
                type="button"
                className="hh-btn hh-btn-danger"
                onClick={onArchive}
              >
                Arsipkan
              </button>
            )}
            <button type="button" className="hh-btn" onClick={close}>
              Tutup
            </button>
            <button
              type="button"
              className="hh-btn hh-btn-primary"
              onClick={handleSave}
            >
              Simpan Perubahan
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

/**
 * PTV-DEV-209: Searchable Multi-Crew Selector with Active Crew Checkboxes & Inactive History Retention
 */
function CrewMultiSelect({
  selectedIds,
  activePeople,
  allPeople = [],
  onChange,
  disabled = false,
  placeholder = 'Pilih kru aktif...',
}: {
  selectedIds: string[];
  activePeople: Person[];
  allPeople?: Person[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const activeIdsSet = useMemo(() => new Set(activePeople.map(p => p.id)), [activePeople]);

  const filteredActive = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activePeople;
    return activePeople.filter(p => p.name.toLowerCase().includes(q));
  }, [activePeople, search]);

  const inactiveSelected = useMemo(() => {
    const q = search.trim().toLowerCase();
    return selectedIds
      .filter(id => !activeIdsSet.has(id))
      .map(id => {
        const found = allPeople.find(p => p.id === id);
        return found || { id, name: `Kru (${id.slice(0, 6)})` };
      })
      .filter(p => !q || p.name.toLowerCase().includes(q));
  }, [selectedIds, activeIdsSet, allPeople, search]);

  const toggleCrew = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeCrew = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter(x => x !== id));
  };

  const getName = (id: string) => {
    const p = activePeople.find(x => x.id === id) || allPeople.find(x => x.id === id);
    return p ? p.name : id;
  };

  return (
    <div className="hh-crew-multiselect" ref={containerRef}>
      <div
        className={`hh-crew-chips-box ${isOpen ? 'is-open' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen(prev => !prev);
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Pilih kru bertugas"
        onKeyDown={e => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
      >
        {selectedIds.length === 0 ? (
          <span className="hh-crew-placeholder">{placeholder}</span>
        ) : (
          selectedIds.map(id => (
            <span key={id} className="hh-crew-chip">
              <span>{getName(id)}</span>
              {!activeIdsSet.has(id) && (
                <span className="hh-crew-inactive-tag">Histori</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  className="hh-crew-chip-remove"
                  onClick={e => removeCrew(e, id)}
                  aria-label={`Hapus ${getName(id)}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {isOpen && !disabled && (
        <div className="hh-crew-popover" role="listbox">
          <input
            type="search"
            className="hh-crew-search-input"
            placeholder="Cari nama kru aktif..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            onClick={e => e.stopPropagation()}
            aria-label="Cari nama kru"
          />
          <ul className="hh-crew-options-list">
            {filteredActive.map(p => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="hh-crew-option-item"
                  onClick={() => toggleCrew(p.id)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-label={p.name}
                  />
                  <span>{p.name}</span>
                </li>
              );
            })}
            {inactiveSelected.map(p => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="hh-crew-option-item"
                  onClick={() => toggleCrew(p.id)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-label={p.name}
                  />
                  <span>{p.name}</span>
                  <span className="hh-crew-inactive-tag">Histori</span>
                </li>
              );
            })}
            {filteredActive.length === 0 && inactiveSelected.length === 0 && (
              <li style={{ padding: '12px', fontSize: '12px', color: 'var(--hh-muted)', textAlign: 'center' }}>
                Kru tidak ditemukan
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * PTV-DEV-209: Notion-Style Session Side Peek with Multi-Position, Multi-Crew Assignment & Technical Notes
 */
function SessionSidePeek({
  session,
  activePeople,
  allPeople = [],
  actor,
  save,
  close,
  onDelete,
}: {
  session: WorkItem;
  activePeople: Person[];
  allPeople?: Person[];
  actor: Actor;
  save: (item: WorkItem) => void;
  close: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<WorkItem>(structuredClone(session));
  const [assignments, setAssignments] = useState<CrewAssignment[]>(() => {
    if (session.crewAssignments && session.crewAssignments.length > 0) {
      return session.crewAssignments.map(a => ({
        id: a.id || crypto.randomUUID(),
        position: a.position || 'Kru Bertugas',
        personIds: getAssignmentPersonIds(a),
        notes: a.notes || '',
      }));
    }
    const asgns: CrewAssignment[] = [];
    if (session.picId) {
      asgns.push({
        id: crypto.randomUUID(),
        position: session.position || 'Koordinator Sesi',
        personIds: [session.picId],
        notes: '',
      });
    }
    if (session.memberIds && session.memberIds.length > 0) {
      asgns.push({
        id: crypto.randomUUID(),
        position: 'Kru Lapangan',
        personIds: [...session.memberIds],
        notes: '',
      });
    }
    return asgns;
  });

  const [feedback, setFeedback] = useState<string>('');
  const isCoordinator = actor.role === 'coordinator';

  const personName = (id: string) => {
    const p = activePeople.find(x => x.id === id) || allPeople.find(x => x.id === id);
    return p ? p.name : 'Kru belum dipilih';
  };

  const handleSave = () => {
    try {
      const allPeopleInSession = assignments.flatMap(a => getAssignmentPersonIds(a));
      const primaryPic = allPeopleInSession[0] || draft.picId || '';
      const otherMembers = [...new Set(allPeopleInSession.slice(1))];

      save({
        ...draft,
        picId: primaryPic,
        memberIds: otherMembers,
        crewAssignments: assignments.map(a => ({
          id: a.id,
          position: a.position.trim() || 'Kru Bertugas',
          personIds: getAssignmentPersonIds(a),
          notes: a.notes?.trim() || '',
        })),
      });
      setFeedback('Penugasan sesi tersimpan!');
      setTimeout(() => setFeedback(''), 2500);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan.');
    }
  };

  const addAssignment = (positionTitle: string = 'Kamera Utama') => {
    setAssignments(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        position: positionTitle,
        personIds: [],
        notes: '',
      },
    ]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const updateAssignmentPos = (index: number, position: string) => {
    setAssignments(prev => {
      const next = [...prev];
      next[index] = { ...next[index], position };
      return next;
    });
  };

  const updateAssignmentCrew = (index: number, personIds: string[]) => {
    setAssignments(prev => {
      const next = [...prev];
      next[index] = { ...next[index], personIds };
      return next;
    });
  };

  const updateAssignmentNotes = (index: number, notes: string) => {
    setAssignments(prev => {
      const next = [...prev];
      next[index] = { ...next[index], notes };
      return next;
    });
  };

  const presets = [
    'Kamera Utama',
    'Kamera Wing',
    'Kamera Close Up',
    'vMix Switching',
    'Audio Master',
    'Floor Director',
    'Floor Crew',
    'Fotografi',
    'Video Dokumentasi',
    'Live Report',
    'Koordinator Lapangan',
  ];

  return createPortal(
    <div
      className="hh-side-peek-overlay"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="hh-side-peek" role="dialog" aria-label={`Sesi: ${draft.title}`}>
        <header className="hh-peek-header">
          <div className="hh-peek-header-left">
            <span className="hh-peek-kind-tag" style={{ background: 'var(--hh-primary-light)', color: 'var(--hh-primary)' }}>
              Sesi Rundown
            </span>
          </div>
          <div className="hh-peek-header-actions">
            <button
              type="button"
              className="hh-peek-close-btn"
              onClick={close}
              aria-label="Tutup panel"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="hh-peek-body">
          {/* Bagian 1: Informasi Sesi */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">1. Informasi Sesi</h4>
            {isCoordinator ? (
              <input
                className="hh-peek-title-input"
                value={draft.title}
                placeholder="Judul / Agenda Sesi..."
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                aria-label="Judul Sesi"
              />
            ) : (
              <h2 className="hh-peek-title-static">{draft.title}</h2>
            )}

            <div className="hh-peek-props-table">
              {/* Jam Mulai */}
              <div className="hh-peek-prop-row">
                <span className="hh-peek-prop-label">
                  <i className="fa-regular fa-clock" /> Jam Mulai
                </span>
                <div className="hh-peek-prop-val">
                  {isCoordinator ? (
                    <input
                      type="datetime-local"
                      className="hh-peek-input"
                      value={draft.start}
                      onChange={e => setDraft(d => ({ ...d, start: e.target.value }))}
                      aria-label="Jam Mulai"
                    />
                  ) : (
                    <span className="hh-peek-static-val">{dateLabel(draft.start)}</span>
                  )}
                </div>
              </div>

              {/* Jam Selesai */}
              <div className="hh-peek-prop-row">
                <span className="hh-peek-prop-label">
                  <i className="fa-regular fa-clock" /> Jam Selesai
                </span>
                <div className="hh-peek-prop-val">
                  {isCoordinator ? (
                    <input
                      type="datetime-local"
                      className="hh-peek-input"
                      value={draft.end}
                      onChange={e => setDraft(d => ({ ...d, end: e.target.value }))}
                      aria-label="Jam Selesai"
                    />
                  ) : (
                    <span className="hh-peek-static-val">{dateLabel(draft.end)}</span>
                  )}
                </div>
              </div>

              {/* Lokasi / Stage */}
              <div className="hh-peek-prop-row">
                <span className="hh-peek-prop-label">
                  <i className="fa-solid fa-location-dot" /> Lokasi / Stage
                </span>
                <div className="hh-peek-prop-val">
                  {isCoordinator ? (
                    <input
                      type="text"
                      className="hh-peek-input"
                      value={draft.location}
                      placeholder="Panggung Utama / Aula Timur..."
                      onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                      aria-label="Lokasi Sesi"
                    />
                  ) : (
                    <span className="hh-peek-static-val">{draft.location || 'Lokasi Acara'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bagian 2: Kebutuhan Produksi & Penjelasan */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">2. Kebutuhan Produksi &amp; Penjelasan</h4>
            <div className="hh-peek-section">
              <label className="hh-peek-section-lbl">Catatan Sesi &amp; Brief Teknis</label>
              {isCoordinator ? (
                <textarea
                  className="hh-peek-textarea"
                  rows={2}
                  value={draft.brief}
                  placeholder="Petunjuk teknis rundown, format live, atau instruksi panggung..."
                  onChange={e => setDraft(d => ({ ...d, brief: e.target.value }))}
                  aria-label="Catatan Sesi"
                />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--hh-text)' }}>
                  {draft.brief || 'Tidak ada catatan khusus.'}
                </p>
              )}
            </div>
          </div>

          {/* Bagian 3: Penugasan Kru Multi-Posisi & Multi-Personel */}
          <div className="hh-form-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 className="hh-form-section-title">3. Penugasan Kru Multi-Posisi</h4>
              <span className="hh-event-badge" style={{ fontWeight: 600 }}>
                {assignments.length} Posisi Kerja
              </span>
            </div>

            {isCoordinator && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--hh-muted)', display: 'block', marginBottom: 6 }}>
                  + Pilihan Cepat Posisi:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {presets.map(pos => (
                    <button
                      key={pos}
                      type="button"
                      className="hh-chip"
                      style={{ fontSize: 11, padding: '3px 9px' }}
                      onClick={() => addAssignment(pos)}
                    >
                      + {pos}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="hh-chip"
                    style={{ fontSize: 11, padding: '3px 9px', background: 'var(--hh-primary-light)', color: 'var(--hh-primary)' }}
                    onClick={() => addAssignment('Posisi Baru')}
                  >
                    + Posisi Lain...
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assignments.map((asgn, idx) => {
                const crewIds = getAssignmentPersonIds(asgn);
                return (
                  <div
                    key={asgn.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'var(--hh-surface-subtle)',
                      borderRadius: 8,
                      border: '1px solid var(--hh-border)',
                    }}
                  >
                    {isCoordinator ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <input
                            type="text"
                            className="hh-inline-input"
                            style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
                            value={asgn.position}
                            placeholder="Nama Posisi (misal: Kamera Wing)"
                            onChange={e => updateAssignmentPos(idx, e.target.value)}
                            aria-label={`Nama Posisi ${idx + 1}`}
                          />
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px', fontSize: 13 }}
                            onClick={() => removeAssignment(idx)}
                            title="Hapus posisi ini"
                            aria-label="Hapus posisi"
                          >
                            ✕ Hapus
                          </button>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--hh-muted)', display: 'block', marginBottom: 4 }}>
                            Kru Bertugas (Multi-select aktif):
                          </label>
                          <CrewMultiSelect
                            selectedIds={crewIds}
                            activePeople={activePeople}
                            allPeople={allPeople}
                            onChange={ids => updateAssignmentCrew(idx, ids)}
                            placeholder="Pilih kru aktif untuk posisi ini..."
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            className="hh-inline-input"
                            style={{ width: '100%', fontSize: 12 }}
                            value={asgn.notes || ''}
                            placeholder="Catatan / instruksi teknis posisi (opsional)..."
                            onChange={e => updateAssignmentNotes(idx, e.target.value)}
                            aria-label={`Catatan teknis ${asgn.position}`}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--hh-text)' }}>
                            {asgn.position}
                          </span>
                          {asgn.notes && (
                            <span style={{ fontSize: 11, color: 'var(--hh-muted)', fontStyle: 'italic' }}>
                              {asgn.notes}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {crewIds.map(cId => (
                            <div key={cId} className="hh-person-pill">
                              <span className="hh-avatar-circle mini">{personName(cId).slice(0, 1)}</span>
                              <span>{personName(cId)}</span>
                            </div>
                          ))}
                          {!crewIds.length && (
                            <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>Belum ada kru bertugas</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!assignments.length && (
                <p style={{ fontSize: 12, color: 'var(--hh-muted)', margin: 0, padding: '16px 0', textAlign: 'center' }}>
                  Belum ada posisi penugasan kru untuk sesi ini.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="hh-peek-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {feedback && <span className="hh-save-feedback">✓ {feedback}</span>}
            {isCoordinator && (
              <button
                type="button"
                className="hh-btn hh-btn-primary"
                onClick={handleSave}
              >
                Simpan Sesi &amp; Penugasan
              </button>
            )}
            <button
              type="button"
              className="hh-btn"
              onClick={close}
            >
              {isCoordinator ? 'Selesai' : 'Tutup'}
            </button>
          </div>
          {isCoordinator && onDelete && (
            <button
              type="button"
              className="hh-btn hh-btn-danger hh-btn-sm"
              onClick={onDelete}
            >
              Hapus Sesi
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}

function ItemEditor({
  item,
  all,
  people,
  actor,
  save,
  close,
}: {
  item: WorkItem;
  all: WorkItem[];
  people: Person[];
  actor: Actor;
  save: (item: WorkItem) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState<WorkItem>(structuredClone(item));
  const [error, setError] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const editable =
    actor.role === 'coordinator' ||
    item.picId === actor.personId ||
    item.memberIds.includes(actor.personId);

  const availableEvents = all.filter(i => i.kind === 'event' && !i.archived);
  const availableProjects = all.filter(i => i.kind === 'project' && !i.archived);
  const availableTasks = all.filter(
    i => i.kind === 'task' && !i.archived && i.id !== item.id
  );

  const activePeople = useMemo(() => people.filter(p => !p.name.includes('(Nonaktif)')), [people]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      save(draft);
      close();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog title={`Kelola ${labels[draft.kind]}`} close={close}>
      <form onSubmit={onSubmit}>
        <div className="hh-dialog-body">
          {error && (
            <p role="alert" style={{ color: '#dc2626', margin: 0, fontSize: 13, fontWeight: 500 }}>
              {error}
            </p>
          )}

          {/* 1. INFORMASI DASAR */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">1. Informasi Dasar</h4>
            <div className="hh-field">
              <label htmlFor="item-title">Judul {labels[draft.kind]}</label>
              <input
                id="item-title"
                aria-label="Judul"
                value={draft.title}
                disabled={!editable || (actor.role !== 'coordinator' && Boolean(item.revision))}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                required
              />
            </div>

            {draft.kind !== 'event' && (
              <div className="hh-field">
                <label htmlFor="item-event">Acara Terkait</label>
                <select
                  id="item-event"
                  aria-label="Acara terkait"
                  value={draft.eventIds[0] || ''}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      eventIds: e.target.value ? [e.target.value] : [],
                    }))
                  }
                >
                  <option value="">Lintas acara / Umum</option>
                  {availableEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {draft.kind === 'task' && (
              <div className="hh-field">
                <label htmlFor="item-project">Kelompok Project / Garapan</label>
                <select
                  id="item-project"
                  aria-label="Kelompok Project"
                  value={draft.projectId}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e => setDraft(d => ({ ...d, projectId: e.target.value }))}
                >
                  <option value="">Tanpa project langsung</option>
                  {availableProjects.map(pr => (
                    <option key={pr.id} value={pr.id}>
                      {pr.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. PENJELASAN PEKERJAAN */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">2. Penjelasan Pekerjaan</h4>
            <div className="hh-field">
              <label htmlFor="item-brief">Penjelasan Pekerjaan / Brief</label>
              <textarea
                id="item-brief"
                aria-label="Brief / Caption"
                rows={3}
                placeholder="Deskripsi detail kebutuhan pekerjaan atau brief produksi..."
                value={draft.brief}
                disabled={!editable || (actor.role !== 'coordinator' && Boolean(item.revision))}
                onChange={e => setDraft(d => ({ ...d, brief: e.target.value }))}
              />
            </div>
          </div>

          {/* 3. KRU BERTUGAS & STATUS */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">3. Kru Bertugas &amp; Status</h4>
            <div className="hh-field-row">
              <div className="hh-field">
                <label htmlFor="item-pic">Kru Bertugas (PIC Utama)</label>
                <select
                  id="item-pic"
                  aria-label="PIC utama"
                  value={draft.picId}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e => setDraft(d => ({ ...d, picId: e.target.value }))}
                >
                  <option value="">Belum ditugaskan</option>
                  {activePeople.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hh-field">
                <label htmlFor="item-status">Status Pekerjaan</label>
                <select
                  id="item-status"
                  aria-label="Status"
                  value={draft.status}
                  disabled={!editable}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value as WorkItem['status'] }))}
                >
                  {['Rencana', 'Dikerjakan', 'Review', 'Selesai'].map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {draft.kind === 'task' && (
              <div className="hh-field">
                <label htmlFor="item-member">Kru Pendukung</label>
                <select
                  id="item-member"
                  aria-label="Anggota kru"
                  value={draft.memberIds[0] || ''}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      memberIds: e.target.value ? [e.target.value] : [],
                    }))
                  }
                >
                  <option value="">Tanpa kru pendamping</option>
                  {activePeople.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="hh-field">
              <label htmlFor="item-result">Lokasi File / Link Hasil</label>
              <input
                id="item-result"
                type="text"
                aria-label="Tautan hasil / berkas"
                placeholder="Link Google Drive, Figma, Canva, atau folder server..."
                value={draft.resultUrl}
                disabled={!editable}
                onChange={e => setDraft(d => ({ ...d, resultUrl: e.target.value }))}
              />
            </div>
          </div>

          {/* 4. BATAS PENYELESAIAN & JADWAL */}
          <div className="hh-form-section">
            <h4 className="hh-form-section-title">4. Batas Penyelesaian &amp; Jadwal</h4>
            <div className="hh-field-row">
              <div className="hh-field">
                <label htmlFor="item-start">Waktu Mulai</label>
                <input
                  id="item-start"
                  type="datetime-local"
                  aria-label="Mulai"
                  value={draft.start}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e => setDraft(d => ({ ...d, start: e.target.value }))}
                />
              </div>

              <div className="hh-field">
                <label htmlFor="item-end">Batas Penyelesaian</label>
                <input
                  id="item-end"
                  type="datetime-local"
                  aria-label="Selesai / deadline"
                  value={draft.end}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e => setDraft(d => ({ ...d, end: e.target.value }))}
                />
              </div>
            </div>

            {draft.kind === 'session' && (
              <div className="hh-field">
                <label htmlFor="item-position">Posisi / Kebutuhan Liputan</label>
                <input
                  id="item-position"
                  aria-label="Posisi / kebutuhan liputan"
                  value={draft.position}
                  disabled={actor.role !== 'coordinator'}
                  onChange={e => setDraft(d => ({ ...d, position: e.target.value }))}
                />
              </div>
            )}

            {draft.kind === 'content' && (
              <>
                <div className="hh-field-row">
                  <div className="hh-field">
                    <label htmlFor="item-format">Format Konten</label>
                    <input
                      id="item-format"
                      aria-label="Format"
                      value={draft.format}
                      disabled={actor.role !== 'coordinator'}
                      onChange={e => setDraft(d => ({ ...d, format: e.target.value }))}
                    />
                  </div>
                  <div className="hh-field">
                    <label htmlFor="item-platform">Platform Publikasi</label>
                    <input
                      id="item-platform"
                      aria-label="Platform"
                      value={draft.platform}
                      disabled={actor.role !== 'coordinator'}
                      onChange={e => setDraft(d => ({ ...d, platform: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="hh-field">
                  <label htmlFor="item-publish">Jadwal Tayang</label>
                  <input
                    id="item-publish"
                    type="datetime-local"
                    aria-label="Jadwal tayang"
                    value={draft.publishAt}
                    disabled={actor.role !== 'coordinator'}
                    onChange={e => setDraft(d => ({ ...d, publishAt: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* 5. PENGATURAN LANJUTAN (COLLAPSIBLE) */}
          <div className="hh-collapsible-section">
            <button
              type="button"
              className="hh-collapsible-toggle"
              onClick={() => setIsAdvancedOpen(prev => !prev)}
              aria-expanded={isAdvancedOpen}
            >
              <span>{isAdvancedOpen ? '▼ Sembunyikan Pengaturan Lanjutan' : '▶ Pengaturan Lanjutan (Subtugas, Dependency, Approval, Pin, Arsip)'}</span>
              <span style={{ fontSize: 11, color: 'var(--hh-muted)' }}>{isAdvancedOpen ? 'Tutup' : 'Buka'}</span>
            </button>

            {isAdvancedOpen && (
              <div className="hh-collapsible-content">
                {draft.kind === 'task' && (
                  <>
                    <div className="hh-field-row">
                      <div className="hh-field">
                        <label htmlFor="item-parent">Task Induk (Subtugas)</label>
                        <select
                          id="item-parent"
                          aria-label="Task induk (subtugas)"
                          value={draft.parentId}
                          disabled={actor.role !== 'coordinator'}
                          onChange={e => setDraft(d => ({ ...d, parentId: e.target.value }))}
                        >
                          <option value="">Bukan subtugas</option>
                          {availableTasks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="hh-field">
                        <label htmlFor="item-dep">Menunggu Pekerjaan Lain</label>
                        <select
                          id="item-dep"
                          aria-label="Menunggu task"
                          value={draft.dependencyIds[0] || ''}
                          disabled={actor.role !== 'coordinator'}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              dependencyIds: e.target.value ? [e.target.value] : [],
                            }))
                          }
                        >
                          <option value="">Tanpa dependency</option>
                          {availableTasks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="hh-field-row">
                  <div className="hh-field">
                    <label htmlFor="item-order">Nomor Urutan</label>
                    <input
                      id="item-order"
                      type="number"
                      aria-label="Urutan"
                      value={draft.order}
                      disabled={actor.role !== 'coordinator'}
                      onChange={e => setDraft(d => ({ ...d, order: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="hh-field">
                    <label htmlFor="item-approval">Status Approval</label>
                    <select
                      id="item-approval"
                      aria-label="Approval"
                      value={draft.approval}
                      disabled={!editable}
                      onChange={e => setDraft(d => ({ ...d, approval: e.target.value as WorkItem['approval'] }))}
                    >
                      {actor.role === 'coordinator' ? (
                        ['Belum diajukan', 'Menunggu', 'Disetujui', 'Revisi'].map(a => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value={draft.approval}>{draft.approval}</option>
                          <option value="Menunggu">Ajukan Review (Menunggu)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      aria-label="Pin informasi penting"
                      checked={draft.pinned}
                      disabled={actor.role !== 'coordinator'}
                      onChange={e => setDraft(d => ({ ...d, pinned: e.target.checked }))}
                    />
                    Pin informasi penting
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      aria-label="Arsipkan"
                      checked={draft.archived}
                      disabled={actor.role !== 'coordinator'}
                      onChange={e => setDraft(d => ({ ...d, archived: e.target.checked }))}
                    />
                    Arsipkan
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer>
          <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
            {draft.revision ? `Revisi ${draft.revision}` : 'Item Baru'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="hh-btn" onClick={close}>
              Batal
            </button>
            <button type="submit" className="hh-btn hh-btn-primary" disabled={!editable}>
              Simpan perubahan
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}

function EditionEditor({
  edition,
  save,
  close,
}: {
  edition: Edition;
  save: (edition: Edition) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState<Edition>(structuredClone(edition));
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      save(draft);
      close();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog title="Atur Edisi Tahunan" close={close} maxWidth="500px">
      <form onSubmit={onSubmit}>
        <div className="hh-dialog-body">
          {error && (
            <p role="alert" style={{ color: '#dc2626', margin: 0, fontSize: 13 }}>
              {error}
            </p>
          )}
          <div className="hh-field">
            <label htmlFor="edition-title">Nama edisi</label>
            <input
              id="edition-title"
              aria-label="Nama edisi"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Haul & Harlah PPBS 2027"
              required
            />
          </div>
          <div className="hh-field-row">
            <div className="hh-field">
              <label htmlFor="edition-start">Tanggal mulai</label>
              <input
                id="edition-start"
                type="date"
                aria-label="Tanggal mulai"
                value={draft.start}
                onChange={e => setDraft(d => ({ ...d, start: e.target.value }))}
                required
              />
            </div>
            <div className="hh-field">
              <label htmlFor="edition-end">Tanggal selesai</label>
              <input
                id="edition-end"
                type="date"
                aria-label="Tanggal selesai"
                value={draft.end}
                onChange={e => setDraft(d => ({ ...d, end: e.target.value }))}
                required
              />
            </div>
          </div>
        </div>
        <footer>
          <button type="button" className="hh-btn" onClick={close}>
            Batal
          </button>
          <button type="submit" className="hh-btn hh-btn-primary">
            Simpan edisi
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function HaulWorkspace({
  repository,
  people,
  actor,
}: {
  repository: MockWorkspaceRepository | WorkspaceRepository;
  people: Person[];
  actor: Actor;
}) {
  const [state, setState] = useState(() => repository.snapshot());
  const [view, setView] = useState({ ...defaultView });
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [sidePeekItem, setSidePeekItem] = useState<WorkItem | null>(null);
  const [sessionSidePeekItem, setSessionSidePeekItem] = useState<WorkItem | null>(null);
  const [activeEventPageId, setActiveEventPageId] = useState<string | null>(null);
  const [editingEdition, setEditingEdition] = useState<Edition | null>(null);
  const [message, setMessage] = useState('');
  const [viewName, setViewName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'pending'>('all');

  // PTV-DEV-208: Inline task creation state & active crew filter
  const [inlineCreatingGroupId, setInlineCreatingGroupId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineDeadline, setInlineDeadline] = useState('');
  const [inlinePicId, setInlinePicId] = useState('');

  const activePeople = useMemo(() => {
    return people.filter(p => !p.name.includes('(Nonaktif)'));
  }, [people]);

  // Real calendar state
  const initialDate = useMemo(() => {
    const parsed = Date.parse(state.edition.start);
    return Number.isFinite(parsed) ? new Date(parsed) : new Date();
  }, [state.edition.start]);

  const [calYear, setCalYear] = useState(() => initialDate.getFullYear());
  const [calMonth, setCalMonth] = useState(() => initialDate.getMonth()); // 0-indexed

  const closeEditor = useCallback(() => setSelected(null), []);
  const closeSidePeek = useCallback(() => setSidePeekItem(null), []);
  const closeSessionSidePeek = useCallback(() => setSessionSidePeekItem(null), []);
  const closeEdition = useCallback(() => setEditingEdition(null), []);

  const urgentTasks = useMemo(() => {
    return state.items
      .filter(i => i.kind === 'task' && !i.archived && i.status !== 'Selesai')
      .sort((a, b) => {
        const pScore = (p: string) => (p === 'Mendesak' ? 3 : p === 'Tinggi' ? 2 : 1);
        return pScore(b.priority) - pScore(a.priority) || (a.end || '9999').localeCompare(b.end || '9999');
      })
      .slice(0, 6);
  }, [state.items]);

  const upcomingSessions = useMemo(() => {
    return state.items
      .filter(i => i.kind === 'session' && !i.archived)
      .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'))
      .slice(0, 4);
  }, [state.items]);

  const run = (action: () => ReturnType<MockWorkspaceRepository['snapshot']>) => {
    try {
      setState(action());
      setMessage('Tersimpan di perangkat ini.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const handleLoadPpbsTemplate = () => {
    try {
      const templateItems = getPpbsTemplateItems(state.edition.id);
      let latestState = state;
      for (const item of templateItems) {
        if (!latestState.items.some(i => i.id === item.id)) {
          latestState = repository.save(item, actor);
        }
      }
      setState(latestState);
      setMessage(`Berhasil memuat ${templateItems.length} garapan & rangkaian PPBS.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const baseItems = selectItems(state, view);

  const items = useMemo(() => {
    return baseItems.filter(item => {
      if (quickFilter === 'mine') {
        return item.picId === actor.personId || item.memberIds.includes(actor.personId);
      }
      if (quickFilter === 'pending') {
        return item.status !== 'Selesai';
      }
      return true;
    });
  }, [baseItems, quickFilter, actor.personId]);

  const events = state.items
    .filter(i => i.editionId === state.edition.id && i.kind === 'event' && !i.archived)
    .sort((a, b) => a.order - b.order);

  const activeEvent = useMemo(
    () => events.find(e => e.id === activeEventPageId) || null,
    [events, activeEventPageId]
  );

  const personName = (id: string) => people.find(p => p.id === id)?.name || 'Belum ditugaskan';
  const titleOf = (id: string) => state.items.find(i => i.id === id)?.title || 'Tanpa project';

  // Group items by view mode
  const groups = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of items) {
      const keys =
        view.mode === 'By Person'
          ? [...new Set([item.picId, ...item.memberIds].filter(Boolean))].map(personName)
          : view.mode === 'By Event'
          ? item.eventIds.length
            ? item.eventIds.map(titleOf)
            : item.kind === 'event'
            ? [item.title]
            : ['Lintas acara']
          : view.mode === 'By Project'
          ? [item.kind === 'project' ? item.title : titleOf(item.projectId)]
          : ['Semua pekerjaan'];

      for (const key of keys.length ? keys : ['Belum ditugaskan']) {
        map.set(key, [...(map.get(key) || []), item]);
      }
    }
    return map;
  }, [items, view.mode, state.items]);

  const conflicts = useMemo(() => conflictPairs(state.items), [state.items]);

  const getEventColorTheme = (index: number) => {
    const themes = ['theme-emerald', 'theme-amber', 'theme-indigo', 'theme-teal', 'theme-rose'];
    return themes[index % themes.length];
  };

  const totalTasks = state.items.filter(i => i.kind === 'task' && !i.archived).length;
  const completedTasks = state.items.filter(i => i.kind === 'task' && !i.archived && i.status === 'Selesai').length;
  const inProgressTasks = state.items.filter(i => i.kind === 'task' && !i.archived && i.status === 'Dikerjakan').length;
  const reviewTasks = state.items.filter(i => i.kind === 'task' && !i.archived && i.status === 'Review').length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Real Calendar Days Calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday as first day of week (0: Monday, 6: Sunday)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { dateStr: string; dayNum: number; isOutside: boolean; isToday: boolean }[] = [];

    // Prev month padding
    const prevMonthLastDay = new Date(calYear, calMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(calYear, calMonth - 1, d);
      const dateStr = prevDate.toISOString().slice(0, 10);
      days.push({ dateStr, dayNum: d, isOutside: true, isToday: false });
    }

    // Current month days
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isOutside: false, isToday: dateStr === todayStr });
    }

    // Next month padding to fill complete rows of 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(calYear, calMonth + 1, d);
        const dateStr = nextDate.toISOString().slice(0, 10);
        days.push({ dateStr, dayNum: d, isOutside: true, isToday: false });
      }
    }

    return days;
  }, [calYear, calMonth]);

  const calMonthName = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
      new Date(calYear, calMonth, 1)
    );
  }, [calYear, calMonth]);

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(y => y + 1);
    } else {
      setCalMonth(m => m + 1);
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(y => y - 1);
    } else {
      setCalMonth(m => m - 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  };

  return (
    <section className="hh-workspace">
      {/* ── MINIMAL HEADER ── */}
      <header className="hh-header">
        <div className="hh-header-left">
          <nav className="hh-breadcrumb" aria-label="Breadcrumb">
            PTV Hub &nbsp;/&nbsp;
            {activeEvent ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveEventPageId(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  Haul & Harlah
                </button>
                &nbsp;/&nbsp; <strong>{activeEvent.title}</strong>
              </>
            ) : (
              <strong>Haul & Harlah</strong>
            )}
          </nav>
          <div className="hh-title-row">
            <h1>Haul & Harlah</h1>
            <span className="hh-period-subtitle">
              {state.edition.title} · {dateLabel(state.edition.start)} – {dateLabel(state.edition.end)}
            </span>
          </div>
        </div>

        <div className="hh-header-actions">
          <label className="hh-edition-select-wrap">
            Edisi
            <select
              aria-label="Edisi"
              value={state.edition.id}
              onChange={e => run(() => repository.selectEdition(e.target.value))}
            >
              {state.editions.map(ed => (
                <option key={ed.id} value={ed.id}>
                  {ed.title}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="hh-btn" onClick={() => setShowHistory(s => !s)}>
            Riwayat
          </button>

          {actor.role === 'coordinator' && (
            <>
              <button
                type="button"
                className="hh-btn"
                onClick={() => setEditingEdition({ ...state.edition })}
              >
                Atur edisi
              </button>
              <button
                type="button"
                className="hh-btn"
                onClick={() =>
                  setEditingEdition({
                    id: crypto.randomUUID(),
                    title: '',
                    start: '',
                    end: '',
                  })
                }
              >
                + Edisi
              </button>
              <button
                type="button"
                className="hh-btn"
                onClick={handleLoadPpbsTemplate}
                title="Muat rangkaian & kelompok pekerjaan nyata PPBS"
              >
                + Paket PPBS
              </button>
            </>
          )}
        </div>
      </header>

      <span className="hh-simulasi-badge">
        {('getBackendNotice' in repository && repository.getBackendNotice()) ||
          'Mode simulasi lokal · data tersimpan pada browser ini'}
      </span>

      {message && (
        <p role="status" style={{ fontSize: 13, color: 'var(--hh-primary)', margin: '0 0 16px', fontWeight: 500 }}>
          {message}
        </p>
      )}

      {conflicts.length > 0 && (
        <p role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, margin: '0 0 20px' }}>
          Terdapat {conflicts.length} bentrok jadwal kru antar sesi. Buka sesi rundown untuk menyesuaikan jam.
        </p>
      )}

      {/* ── JIKA MEMBUKA HALAMAN LENGKAP ACARA (NOTION DATABASE PAGE) ── */}
      {activeEvent ? (
        <article className="hh-event-full-page">
          <div className="hh-event-page-topbar">
            <button
              type="button"
              className="hh-back-link"
              onClick={() => setActiveEventPageId(null)}
            >
              ← Kembali ke Ruang Kerja
            </button>
            {actor.role === 'coordinator' && (
              <button
                type="button"
                className="hh-btn"
                onClick={() => setSelected(activeEvent)}
              >
                Edit Detail Acara
              </button>
            )}
          </div>

          <div className="hh-event-page-header">
            <h1>{activeEvent.title}</h1>
            <div className="hh-event-properties">
              <div className="hh-prop-item">
                <span>Lokasi</span>
                <strong>{activeEvent.location || 'Aula / Panggung PPBS'}</strong>
              </div>
              <div className="hh-prop-item">
                <span>Waktu Rangkaian</span>
                <strong>
                  {dateLabel(activeEvent.start)} – {dateLabel(activeEvent.end)}
                </strong>
              </div>
              <div className="hh-prop-item">
                <span>Status</span>
                <span className={`hh-status hh-${activeEvent.status.toLowerCase()}`}>
                  {activeEvent.status}
                </span>
              </div>
              <div className="hh-prop-item" style={{ gridColumn: 'span 2' }}>
                <span>Catatan Ringkas / Brief</span>
                <p style={{ margin: 0, color: 'var(--hh-muted)', fontSize: 12 }}>
                  {activeEvent.brief || 'Tidak ada catatan brief.'}
                </p>
              </div>
            </div>
          </div>

          {/* DYNAMIC DATABASE-STYLE WORK MANAGEMENT GROUPS FOR THIS EVENT */}
          <section className="hh-event-groups">
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
              Kelompok Garapan & Pekerjaan
            </h2>

            {(() => {
              // Get projects linked to this event
              const linkedProjects = state.items.filter(
                i => i.kind === 'project' && !i.archived && i.eventIds.includes(activeEvent.id)
              );

              // Tasks directly on this event without project or on these projects
              const groupsToRender = linkedProjects.length
                ? linkedProjects.map(pr => ({
                    project: pr,
                    tasks: state.items.filter(
                      i => i.kind === 'task' && !i.archived && i.projectId === pr.id
                    ),
                  }))
                : [
                    {
                      project: null,
                      tasks: state.items.filter(
                        i => i.kind === 'task' && !i.archived && i.eventIds.includes(activeEvent.id)
                      ),
                    },
                  ];

              return groupsToRender.map(({ project, tasks }) => (
                <div className="hh-db-group" key={project ? project.id : 'unassigned'}>
                  <div className="hh-db-group-header">
                    <div className="hh-db-group-title">
                      <span>{project ? project.title : 'Pekerjaan Langsung'}</span>
                      <span className="hh-count-badge">{tasks.length}</span>
                    </div>
                    {project && (
                      <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
                        PIC: {personName(project.picId)}
                      </span>
                    )}
                  </div>

                  <div className="hh-table-wrap">
                    <table className="hh-table">
                      <thead>
                        <tr>
                          <th style={{ width: 140 }}>Status</th>
                          <th style={{ width: 140 }}>Deadline</th>
                          <th>Nama Task</th>
                          <th style={{ width: 170 }}>Person</th>
                          <th style={{ width: 180 }}>Lokasi File</th>
                          <th>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(task => (
                          <tr
                            key={task.id}
                            className="hh-row"
                            onClick={() => setSidePeekItem(task)}
                          >
                            <td>
                              <StatusPicker
                                status={task.status}
                                onSelect={s => run(() => repository.save({ ...task, status: s }, actor))}
                              />
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--hh-muted)', whiteSpace: 'nowrap' }}>
                              {dateLabel(task.end)}
                            </td>
                            <td>
                              <div className="hh-task-title" style={{ fontWeight: 600 }}>
                                {task.pinned && <span className="hh-pin-indicator">★</span>}
                                {task.title}
                              </div>
                            </td>
                            <td>
                              <div className="hh-person-pill">
                                <span className="hh-avatar-circle">
                                  {personName(task.picId).slice(0, 1)}
                                </span>
                                <span>{personName(task.picId)}</span>
                              </div>
                            </td>
                            <td>
                              <FileCell
                                item={task}
                                onEdit={() => setSidePeekItem(task)}
                              />
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
                              {task.brief || '-'}
                            </td>
                          </tr>
                        ))}
                        {/* PTV-DEV-208: Inline task creation row (No modal!) */}
                        {inlineCreatingGroupId === (project ? project.id : 'unassigned') && (
                          <tr className="hh-inline-add-row-tr" style={{ background: 'var(--hh-surface-subtle)' }}>
                            <td>
                              <span className="hh-status hh-rencana" style={{ fontSize: 11 }}>Baru</span>
                            </td>
                            <td>
                              <input
                                type="date"
                                className="hh-inline-input"
                                value={inlineDeadline}
                                onChange={e => setInlineDeadline(e.target.value)}
                                aria-label="Deadline"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="hh-inline-input"
                                style={{ width: '95%' }}
                                placeholder="Nama pekerjaan / task..."
                                value={inlineTitle}
                                onChange={e => setInlineTitle(e.target.value)}
                                autoFocus
                                aria-label="Nama Task"
                              />
                            </td>
                            <td>
                              <select
                                className="hh-inline-input"
                                value={inlinePicId}
                                onChange={e => setInlinePicId(e.target.value)}
                                aria-label="Pilih Kru"
                              >
                                <option value="">Pilih Kru Aktif...</option>
                                {activePeople.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td colSpan={2}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="hh-inline-btn-save"
                                  onClick={() => {
                                    if (!inlineTitle.trim()) return;
                                    const newTask = emptyItem('task', state.edition.id);
                                    newTask.title = inlineTitle.trim();
                                    newTask.eventIds = [activeEvent.id];
                                    if (project) newTask.projectId = project.id;
                                    newTask.picId = inlinePicId;
                                    newTask.end = inlineDeadline;
                                    run(() => repository.save(newTask, actor));
                                    setInlineTitle('');
                                    setInlineDeadline('');
                                    setInlinePicId('');
                                    setInlineCreatingGroupId(null);
                                  }}
                                >
                                  Simpan ✓
                                </button>
                                <button
                                  type="button"
                                  className="hh-inline-btn-cancel"
                                  onClick={() => {
                                    setInlineCreatingGroupId(null);
                                    setInlineTitle('');
                                  }}
                                >
                                  Batal ×
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {!tasks.length && !inlineCreatingGroupId && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--hh-muted)', padding: '20px 0' }}>
                              Belum ada task pada kelompok ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {actor.role === 'coordinator' && (
                    <button
                      type="button"
                      className="hh-add-row-btn"
                      onClick={() => {
                        setInlineCreatingGroupId(project ? project.id : 'unassigned');
                        setInlineTitle('');
                        setInlineDeadline('');
                        setInlinePicId('');
                      }}
                    >
                      + Tambah pekerjaan baru (inline)
                    </button>
                  )}
                </div>
              ));
            })()}

            {/* RUNDOWN & SESI PENUGASAN KRU TABLE (PTV-DEV-208 MULTI-POSITION) */}
            <div className="hh-db-group" style={{ marginTop: 28 }}>
              <div className="hh-db-group-header">
                <div className="hh-db-group-title">
                  <span>Rundown &amp; Penugasan Kru Liputan</span>
                  <span className="hh-count-badge">
                    {state.items.filter(i => i.kind === 'session' && !i.archived && i.eventIds.includes(activeEvent.id)).length}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
                  Multi-posisi liputan (Kamera, vMix, Audio, Foto, Live Report)
                </span>
              </div>

              <div className="hh-table-wrap">
                <table className="hh-table">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>Waktu</th>
                      <th style={{ width: 230 }}>Sesi / Agenda</th>
                      <th style={{ width: 180 }}>Lokasi &amp; Kebutuhan</th>
                      <th>Penugasan Kru &amp; Posisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.items
                      .filter(i => i.kind === 'session' && !i.archived && i.eventIds.includes(activeEvent.id))
                      .map(session => {
                        const assignments: CrewAssignment[] = (session.crewAssignments && session.crewAssignments.length > 0)
                          ? session.crewAssignments
                          : [
                              ...(session.picId ? [{ position: session.position || 'Koordinator Sesi', personIds: [session.picId] }] : []),
                              ...session.memberIds.map(mId => ({ position: 'Kru Pendukung', personIds: [mId] })),
                            ];

                        return (
                          <tr
                            key={session.id}
                            className="hh-row"
                            onClick={() => setSessionSidePeekItem(session)}
                            title="Klik untuk detail & penugasan kru"
                          >
                            <td className="hh-session-time">
                              <i className="fa-regular fa-clock" style={{ marginRight: 6, color: 'var(--hh-primary)' }} />
                              {dateLabel(session.start)} – {session.end ? session.end.split('T')[1] || dateLabel(session.end) : ''}
                            </td>
                            <td>
                              <strong style={{ color: 'var(--hh-text)' }}>{session.title}</strong>
                              {session.brief && (
                                <div style={{ fontSize: 12, color: 'var(--hh-muted)', marginTop: 2 }}>{session.brief}</div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{session.location || 'Lokasi Acara'}</div>
                              {session.format && (
                                <span className="hh-event-badge" style={{ marginTop: 4, display: 'inline-block' }}>
                                  {session.format}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="hh-rundown-roster-stack">
                                {assignments.map((asgn, i) => {
                                  const crewIds = getAssignmentPersonIds(asgn);
                                  return (
                                    <div key={i} className="hh-roster-group">
                                      <div className="hh-roster-group-header">
                                        <span className="hh-roster-pos-badge">
                                          <i className="fa-solid fa-video" style={{ fontSize: 10, color: 'var(--hh-primary)' }} />
                                          {asgn.position}
                                        </span>
                                        {asgn.notes && (
                                          <span className="hh-roster-notes-tag" title={asgn.notes}>
                                            {asgn.notes}
                                          </span>
                                        )}
                                      </div>
                                      <div className="hh-roster-crew-pills">
                                        {crewIds.map(cId => (
                                          <span key={cId} className="hh-roster-crew-pill">
                                            <span className="hh-avatar-circle mini">
                                              {personName(cId).slice(0, 1)}
                                            </span>
                                            <span>{personName(cId)}</span>
                                          </span>
                                        ))}
                                        {!crewIds.length && (
                                          <span style={{ fontSize: 11, color: 'var(--hh-muted)', fontStyle: 'italic' }}>
                                            Belum ada kru bertugas
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {!assignments.length && (
                                  <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>Belum ada kru bertugas</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {!state.items.filter(i => i.kind === 'session' && !i.archived && i.eventIds.includes(activeEvent.id)).length && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--hh-muted)', padding: '24px 0' }}>
                          Belum ada sesi rundown untuk acara ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {actor.role === 'coordinator' && (
                <button
                  type="button"
                  className="hh-add-row-btn"
                  onClick={() => {
                    const newSession = emptyItem('session', state.edition.id);
                    newSession.eventIds = [activeEvent.id];
                    newSession.title = `Sesi Baru - ${activeEvent.title}`;
                    setSessionSidePeekItem(newSession);
                  }}
                >
                  + Tambah sesi rundown &amp; penugasan kru
                </button>
              )}
            </div>

            {/* CATATAN PENTING & REFERENSI ACARA */}
            {(() => {
              const eventNotes = state.items.filter(
                i => i.kind === 'note' && !i.archived && i.eventIds.includes(activeEvent.id)
              );

              return (
                <div className="hh-db-group" style={{ marginTop: 28 }}>
                  <div className="hh-db-group-header">
                    <div className="hh-db-group-title">
                      <span>Catatan Penting &amp; Referensi Acara</span>
                      <span className="hh-count-badge">{eventNotes.length}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    {eventNotes.map(note => (
                      <div
                        key={note.id}
                        style={{
                          background: 'var(--hh-surface-subtle)',
                          border: '1px solid var(--hh-border-subtle)',
                          borderRadius: 'var(--hh-radius)',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <i className="fa-solid fa-note-sticky" style={{ color: 'var(--hh-primary)' }} />
                          {note.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--hh-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {note.brief}
                        </p>
                      </div>
                    ))}
                    {!eventNotes.length && (
                      <p style={{ fontSize: 12, color: 'var(--hh-muted)', gridColumn: '1 / -1' }}>
                        Belum ada catatan khusus untuk acara ini.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        </article>
      ) : (
        <>
          {/* ── QUICK SUMMARY ORIENTATION BAR (PTV-DEV-207) ── */}
          <section className="hh-summary-bar" aria-label="Ringkasan pekerjaan">
            <div className="hh-summary-card">
              <div className="hh-summary-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <i className="fa-solid fa-list-check" />
              </div>
              <div className="hh-summary-meta">
                <div className="hh-summary-val">{completedTasks} / {totalTasks} Selesai</div>
                <div className="hh-summary-lbl">Progres Total ({progressPct}%)</div>
                <div className="hh-summary-prog-track">
                  <div className="hh-summary-prog-fill" style={{ width: `${progressPct}%`, background: '#10b981' }} />
                </div>
              </div>
            </div>

            <div className="hh-summary-card">
              <div className="hh-summary-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <i className="fa-solid fa-bolt" />
              </div>
              <div className="hh-summary-meta">
                <div className="hh-summary-val">{inProgressTasks} Pekerjaan</div>
                <div className="hh-summary-lbl">Sedang Dikerjakan Kru</div>
              </div>
            </div>

            <div className="hh-summary-card">
              <div className="hh-summary-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                <i className="fa-solid fa-clock-rotate-left" />
              </div>
              <div className="hh-summary-meta">
                <div className="hh-summary-val">{reviewTasks} Pekerjaan</div>
                <div className="hh-summary-lbl">Menunggu Review Koordinator</div>
              </div>
            </div>
          </section>

          {/* ── RANGKAIAN ACARA (BAGIAN UTAMA) ── */}
          <section className="hh-events-section">
            <div className="hh-section-title-wrap">
              <h2 className="hh-section-title">Rangkaian Acara Utama</h2>
              <span style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
                Klik kartu acara untuk membuka ruang kerja dan manajemen tugas lengkap
              </span>
            </div>

            <div className="hh-events-grid" aria-label="Rangkaian acara">
              {events.map((event, idx) => {
                const theme = getEventColorTheme(idx);
                const evProjects = state.items.filter(
                  i => i.kind === 'project' && !i.archived && i.eventIds.includes(event.id)
                );
                const evTasks = state.items.filter(
                  i => i.kind === 'task' && !i.archived && i.eventIds.includes(event.id)
                );
                const evDone = evTasks.filter(t => t.status === 'Selesai').length;
                const evPct = evTasks.length > 0 ? Math.round((evDone / evTasks.length) * 100) : 0;
                const evSessions = state.items.filter(
                  i => i.kind === 'session' && !i.archived && i.eventIds.includes(event.id)
                );

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`hh-event-card hh-event ${theme}`}
                    onClick={() => setActiveEventPageId(event.id)}
                  >
                    <div>
                      <div className="hh-event-card-top">
                        <span className="hh-event-card-date">
                          <i className="fa-regular fa-calendar" style={{ marginRight: 5 }} />
                          {dateLabel(event.start)}
                        </span>
                        <span className={`hh-status hh-${event.status.toLowerCase()}`}>
                          {event.status}
                        </span>
                      </div>
                      <h3>{event.title}</h3>
                      <p>{event.brief || event.location || 'Agenda rangkaian resmi.'}</p>
                    </div>

                    {evTasks.length > 0 && (
                      <div className="hh-card-prog-wrap">
                        <div className="hh-card-prog-lbl">
                          <span>{evDone} dari {evTasks.length} task selesai</span>
                          <span>{evPct}%</span>
                        </div>
                        <div className="hh-card-prog-track">
                          <div className="hh-card-prog-fill" style={{ width: `${evPct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="hh-event-card-meta">
                      <span className="hh-event-badge">{evProjects.length} kelompok</span>
                      <span className="hh-event-badge">{evTasks.length} task</span>
                      <span className="hh-event-badge">{evSessions.length} sesi</span>
                      <span className="hh-event-open-btn">
                        Buka Ruang Kerja Acara →
                      </span>
                    </div>
                  </button>
                );
              })}
              {!events.length && (
                <p style={{ color: 'var(--hh-muted)', fontSize: 13 }}>
                  Belum ada acara dalam edisi ini. Gunakan tombol + Tambah di toolbar untuk membuat acara baru.
                </p>
              )}
            </div>
          </section>

          {/* ── BERANDA FAST ORIENTATION (PTV-DEV-208) ── */}
          <section className="hh-home-grid" aria-label="Orientasi Cepat">
            {/* KOLOM KIRI: TUGAS MENDESAK */}
            <div className="hh-home-col">
              <div className="hh-home-col-header">
                <div className="hh-home-col-title">
                  <i className="fa-solid fa-fire" style={{ color: '#dc2626' }} />
                  <span>Tugas Mendesak &amp; Perhatian</span>
                </div>
                <span className="hh-event-badge" style={{ background: '#fef2f2', color: '#991b1b', fontWeight: 600 }}>
                  {urgentTasks.length} Pekerjaan
                </span>
              </div>

              <div className="hh-urgent-list">
                {urgentTasks.map(task => {
                  const ev = events.find(e => task.eventIds.includes(e.id));
                  return (
                    <div key={task.id} className="hh-urgent-item">
                      <div className="hh-urgent-main">
                        <StatusPicker
                          status={task.status}
                          onSelect={s => run(() => repository.save({ ...task, status: s }, actor))}
                        />
                        <span
                          className="hh-urgent-title"
                          title={task.title}
                          onClick={() => setSidePeekItem(task)}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="hh-urgent-meta">
                        {ev && (
                          <span className="hh-event-badge" style={{ fontSize: 10 }}>
                            {ev.title.slice(0, 16)}...
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--hh-text)', fontWeight: 500 }}>
                          {personName(task.picId)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--hh-muted)' }}>
                          {dateLabel(task.end)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!urgentTasks.length && (
                  <p style={{ color: 'var(--hh-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0', margin: 0 }}>
                    Semua tugas mendesak telah selesai dikerjakan! 🎉
                  </p>
                )}
              </div>
            </div>

            {/* KOLOM KANAN: KEGIATAN & SESI TERDEKAT */}
            <div className="hh-home-col">
              <div className="hh-home-col-header">
                <div className="hh-home-col-title">
                  <i className="fa-solid fa-calendar-check" style={{ color: 'var(--hh-primary)' }} />
                  <span>Kegiatan &amp; Sesi Terdekat</span>
                </div>
                <span className="hh-event-badge" style={{ background: 'var(--hh-primary-light)', color: 'var(--hh-primary)', fontWeight: 600 }}>
                  {upcomingSessions.length} Sesi
                </span>
              </div>

              <div className="hh-upcoming-list">
                {upcomingSessions.map(sess => {
                  const ev = events.find(e => sess.eventIds.includes(e.id));
                  const assignments: CrewAssignment[] = (sess.crewAssignments && sess.crewAssignments.length > 0)
                    ? sess.crewAssignments
                    : [
                        ...(sess.picId ? [{ position: sess.position || 'Koordinator Sesi', personIds: [sess.picId] }] : []),
                        ...sess.memberIds.map(mId => ({ position: 'Kru Pendukung', personIds: [mId] }))
                      ];

                  const allRosterPills = assignments.flatMap((asgn, i) => {
                    const crewIds = getAssignmentPersonIds(asgn);
                    return crewIds.map(cId => ({
                      key: `${i}-${cId}`,
                      position: asgn.position,
                      name: personName(cId),
                    }));
                  });

                  return (
                    <div key={sess.id} className="hh-upcoming-card">
                      <div className="hh-upcoming-top">
                        <span className="hh-upcoming-time">
                          <i className="fa-regular fa-clock" style={{ marginRight: 5 }} />
                          {dateLabel(sess.start)} – {dateLabel(sess.end)}
                        </span>
                        {ev && (
                          <span className="hh-event-badge" style={{ fontWeight: 600 }}>
                            {ev.title}
                          </span>
                        )}
                      </div>
                      <div className="hh-upcoming-title">{sess.title}</div>
                      <div className="hh-upcoming-loc">
                        <i className="fa-solid fa-location-dot" style={{ marginRight: 4 }} />
                        {sess.location || 'Lokasi Acara'}
                      </div>
                      <div className="hh-rundown-roster" style={{ marginTop: 4 }}>
                        {allRosterPills.map(item => (
                          <div key={item.key} className="hh-roster-pill" style={{ padding: '2px 8px', fontSize: 11 }}>
                            <span className="hh-roster-pos">{item.position}:</span>
                            <span className="hh-roster-name">{item.name}</span>
                          </div>
                        ))}
                        {!allRosterPills.length && (
                          <span style={{ fontSize: 11, color: 'var(--hh-muted)' }}>Belum ada kru</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!upcomingSessions.length && (
                  <p style={{ color: 'var(--hh-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0', margin: 0 }}>
                    Belum ada jadwal sesi terdekat dalam edisi ini.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── RUANG KERJA UTAMA (DATABASE-STYLE WORK MANAGEMENT) ── */}
          <section className="hh-workspace-surface">
            {/* HORIZONTAL VIEW SWITCHER */}
            <div className="hh-views-tabbar" role="group" aria-label="Tampilan pekerjaan">
              {modes.map(mode => (
                <button
                  key={mode}
                  type="button"
                  className="hh-view-tab"
                  aria-pressed={view.mode === mode}
                  onClick={() => setView(v => ({ ...v, mode }))}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* FILTER & TOOLBAR */}
            <div className="hh-toolbar">
              <div className="hh-toolbar-left">
                {/* QUICK CHIPS */}
                <div className="hh-chip-group">
                  <button
                    type="button"
                    className={`hh-chip ${quickFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('all')}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    className={`hh-chip ${quickFilter === 'mine' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('mine')}
                  >
                    Tugas saya
                  </button>
                  <button
                    type="button"
                    className={`hh-chip ${quickFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('pending')}
                  >
                    Belum selesai
                  </button>
                </div>

                {/* SEARCH */}
                <label className="hh-search-label">
                  <input
                    type="search"
                    className="hh-search-input"
                    aria-label="Cari pekerjaan"
                    placeholder="Cari pekerjaan..."
                    value={view.search}
                    onChange={e => setView(v => ({ ...v, search: e.target.value }))}
                  />
                </label>

                {/* FILTERS */}
                <label className="hh-control-select">
                  Jenis
                  <select
                    aria-label="Jenis"
                    value={view.kind}
                    onChange={e => setView(v => ({ ...v, kind: e.target.value as Kind | '' }))}
                  >
                    <option value="">Semua jenis</option>
                    {kinds.map(k => (
                      <option key={k} value={k}>
                        {labels[k]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="hh-control-select">
                  Status
                  <select
                    aria-label="Status"
                    value={view.status}
                    onChange={e => setView(v => ({ ...v, status: e.target.value }))}
                  >
                    <option value="">Semua status</option>
                    {['Rencana', 'Dikerjakan', 'Review', 'Selesai'].map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="hh-control-select">
                  Kru
                  <select
                    aria-label="Kru"
                    value={view.person}
                    onChange={e => setView(v => ({ ...v, person: e.target.value }))}
                  >
                    <option value="">Semua kru</option>
                    {activePeople.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="hh-control-select">
                  Urutkan
                  <select
                    aria-label="Urutkan"
                    value={view.sort}
                    onChange={e => setView(v => ({ ...v, sort: e.target.value as typeof v.sort }))}
                  >
                    <option value="date">Jadwal</option>
                    <option value="title">Judul</option>
                    <option value="priority">Prioritas</option>
                  </select>
                </label>
              </div>

              <div className="hh-toolbar-right">
                {actor.role === 'coordinator' && (
                  <label className="hh-control-select" style={{ fontWeight: 600, color: 'var(--hh-primary)' }}>
                    + Tambah
                    <select
                      aria-label="Tambah pekerjaan"
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          setSelected(emptyItem(e.target.value as Kind, state.edition.id));
                        }
                      }}
                    >
                      <option value="">Pilih jenis...</option>
                      {kinds.map(k => (
                        <option key={k} value={k}>
                          + {labels[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {/* SAVED VIEWS & ARCHIVE CONTROLS */}
            <div className="hh-secondary-bar">
              <div className="hh-secondary-bar-left">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    aria-label="Lihat arsip"
                    checked={view.archived}
                    onChange={e => setView(v => ({ ...v, archived: e.target.checked }))}
                  />
                  Lihat arsip
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Tampilan tersimpan
                  <select
                    aria-label="Tampilan tersimpan"
                    value=""
                    onChange={e => {
                      const saved = state.views[actor.id]?.find(v => v.name === e.target.value);
                      if (saved) setView({ ...saved });
                    }}
                  >
                    <option value="">Pilih tampilan...</option>
                    {(state.views[actor.id] || []).map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="hh-secondary-bar-right">
                <input
                  aria-label="Nama tampilan baru"
                  placeholder="Nama tampilan baru"
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--hh-border)',
                  }}
                />
                <button
                  type="button"
                  className="hh-btn"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => run(() => repository.saveView({ ...view, name: viewName }, actor))}
                >
                  Simpan tampilan
                </button>
              </div>
            </div>

            {/* VIEW CONTENT: REAL CALENDAR VS NOTION GROUPED TABLES */}
            {view.mode === 'Calendar' ? (
              <div className="hh-cal-wrapper">
                <div className="hh-cal-header-bar">
                  <div className="hh-cal-nav">
                    <h3>{calMonthName}</h3>
                    <button type="button" className="hh-btn" onClick={prevMonth} aria-label="Bulan sebelumnya">
                      ‹
                    </button>
                    <button type="button" className="hh-btn" onClick={goToday}>
                      Hari Ini
                    </button>
                    <button type="button" className="hh-btn" onClick={nextMonth} aria-label="Bulan berikutnya">
                      ›
                    </button>
                  </div>

                  <div className="hh-cal-legend">
                    <span>
                      <span className="hh-cal-legend-dot" style={{ background: '#166534' }} />
                      Story
                    </span>
                    <span>
                      <span className="hh-cal-legend-dot" style={{ background: '#1e40af' }} />
                      Reels
                    </span>
                    <span>
                      <span className="hh-cal-legend-dot" style={{ background: '#92400e' }} />
                      Feed
                    </span>
                    <span>
                      <span className="hh-cal-legend-dot" style={{ background: '#7c3aed' }} />
                      Acara
                    </span>
                  </div>
                </div>

                <div className="hh-cal-grid">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(dayName => (
                    <div key={dayName} className="hh-cal-dayhead">
                      {dayName}
                    </div>
                  ))}

                  {calendarDays.map(({ dateStr, dayNum, isOutside, isToday }) => {
                    const dayItems = items.filter(
                      i =>
                        (i.start || i.end).slice(0, 10) === dateStr ||
                        i.publishAt.slice(0, 10) === dateStr
                    );

                    return (
                      <div
                        key={dateStr}
                        className={`hh-day ${isOutside ? 'hh-day-outside' : ''}`}
                      >
                        <div className="hh-day-top">
                          <span className={`hh-day-num ${isToday ? 'active-today' : ''}`}>
                            {dayNum}
                          </span>
                          {dayItems.length > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--hh-muted)' }}>
                              {dayItems.length}
                            </span>
                          )}
                        </div>

                        {dayItems.map(item => {
                          const tagClass = getItemTagClass(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`hh-cal-item ${tagClass}`}
                              onClick={() => setSelected(item)}
                              title={`${item.title} (${personName(item.picId)})`}
                            >
                              <strong>{item.title}</strong>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="hh-groups-container hh-groups">
                {Array.from(groups.entries()).map(([groupTitle, groupItems]) => (
                  <div className="hh-db-group" key={groupTitle}>
                    <div className="hh-db-group-header">
                      <div className="hh-db-group-title">
                        <span>{groupTitle}</span>
                        <span className="hh-count-badge">{groupItems.length}</span>
                      </div>
                    </div>

                    <div className="hh-table-wrap">
                      <table className="hh-table">
                        <thead>
                          <tr>
                            <th style={{ width: 140 }}>Status</th>
                            <th style={{ width: 140 }}>Deadline</th>
                            <th>Pekerjaan</th>
                            <th style={{ width: 170 }}>PIC &amp; Kru</th>
                            <th style={{ width: 180 }}>Lokasi File</th>
                            <th>Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupItems.map(item => (
                            <tr
                              key={item.id}
                              className="hh-row"
                              onClick={() => item.kind === 'task' ? setSidePeekItem(item) : setSelected(item)}
                            >
                              <td>
                                {item.kind === 'task' ? (
                                  <StatusPicker
                                    status={item.status}
                                    onSelect={s => run(() => repository.save({ ...item, status: s }, actor))}
                                  />
                                ) : (
                                  <span className={`hh-status hh-${item.status.toLowerCase()}`}>
                                    {item.status}
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--hh-muted)', whiteSpace: 'nowrap' }}>
                                {dateLabel(item.publishAt || item.start || item.end)}
                              </td>
                              <td>
                                <div className="hh-task-title" style={{ fontWeight: 600 }}>
                                  {item.pinned && <span className="hh-pin-indicator">★</span>}
                                  <span>{item.title}</span>
                                </div>
                              </td>
                              <td>
                                <div className="hh-person-pill">
                                  <span className="hh-avatar-circle">
                                    {personName(item.picId).slice(0, 1)}
                                  </span>
                                  <span>{personName(item.picId)}</span>
                                </div>
                              </td>
                              <td>
                                {item.kind === 'task' ? (
                                  <FileCell
                                    item={item}
                                    onEdit={() => setSidePeekItem(item)}
                                  />
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--hh-muted)' }}>-</span>
                                )}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--hh-muted)' }}>
                                {item.brief || '-'}
                              </td>
                            </tr>
                          ))}
                          {!groupItems.length && (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--hh-muted)', padding: '20px 0' }}>
                                Tidak ada pekerjaan dalam kelompok ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── NOTION-STYLE TASK SIDE PEEK (PTV-DEV-207) ── */}
      {sidePeekItem && (
        <TaskSidePeek
          item={sidePeekItem}
          people={people}
          activePeople={activePeople}
          actor={actor}
          save={item => {
            run(() => repository.save(item, actor));
            setSidePeekItem({ ...item });
          }}
          close={closeSidePeek}
          onArchive={actor.role === 'coordinator' ? () => {
            run(() => repository.save({ ...sidePeekItem, archived: true }, actor));
            closeSidePeek();
          } : undefined}
        />
      )}

      {/* ── NOTION-STYLE SESSION SIDE PEEK (PTV-DEV-208 MULTI-POSITION) ── */}
      {sessionSidePeekItem && (
        <SessionSidePeek
          session={sessionSidePeekItem}
          activePeople={activePeople}
          allPeople={people}
          actor={actor}
          save={item => {
            run(() => repository.save(item, actor));
            setSessionSidePeekItem(null);
          }}
          close={closeSessionSidePeek}
          onDelete={actor.role === 'coordinator' && sessionSidePeekItem.id ? () => {
            run(() => repository.save({ ...sessionSidePeekItem, archived: true }, actor));
            closeSessionSidePeek();
          } : undefined}
        />
      )}

      {/* ── MODAL ITEM EDITOR (CREATE / EDIT ALL KINDS) ── */}
      {selected && (
        <ItemEditor
          item={selected}
          all={state.items}
          people={people}
          actor={actor}
          save={item => run(() => repository.save(item, actor))}
          close={closeEditor}
        />
      )}

      {/* ── MODAL EDITION EDITOR ── */}
      {editingEdition && (
        <EditionEditor
          edition={editingEdition}
          save={ed => run(() => repository.saveEdition(ed, actor))}
          close={closeEdition}
        />
      )}

      {/* ── MODAL AUDIT HISTORY ── */}
      {showHistory && (
        <Dialog title="Riwayat Aktivitas & Perubahan" close={() => setShowHistory(false)}>
          <div className="hh-dialog-body hh-history">
            {state.audit.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--hh-border-subtle)',
                  fontSize: 12,
                }}
              >
                <strong>{log.action}</strong>
                <div style={{ color: 'var(--hh-muted)', fontSize: 11 }}>
                  Oleh: {log.actorId} · {new Date(log.at).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
            {!state.audit.length && (
              <p style={{ color: 'var(--hh-muted)', fontSize: 13 }}>Belum ada log riwayat tersimpan.</p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
