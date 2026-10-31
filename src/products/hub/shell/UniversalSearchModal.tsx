import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session/sessionStore';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';
import { usesInventoryPortal } from '../inventaris/services/inventoryPortalClient';
import { inventarisService } from '../inventaris/inventarisService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { crewStore } from '../kru/kruStore';
import { CrewMember } from '../kru/types';
import { AcaraItem } from '../acara/types';
import { INITIAL_ACARA_FIXTURES } from '../acara/mock/acaraMockData';
import { INITIAL_DOCS_FIXTURES, PtvDocument } from '../dokumen-saya/mock/docsMockData';
import { DEFAULT_ANNOUNCEMENTS } from '../broadcast/broadcastStore';
import { INITIAL_DAMAGE_REPORT_FIXTURES } from '../lapor-kerusakan/fixtures';
import { INITIAL_LOST_FOUND_FIXTURES } from '../lost-found/fixtures';
import { NoteItem } from '../catatan/types';
import { catatanService } from '../catatan/catatanService';
import { MOCK_NOTES } from '../catatan/mock/catatanMockData';

interface SearchResultItem {
  id: string;
  title: string;
  sub: string;
  path: string;
  icon: string;
  thumbnailUrl?: string;
}

interface SearchGroup {
  category: string;
  items: SearchResultItem[];
}

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  isMobile = false,
}) => {
  const navigate = useNavigate();
  const { can } = useSessionStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [dbInventaris, setDbInventaris] = useState<any[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: isMobile ? 'universal-search-mobile' : 'universal-search-desktop',
    isGlobal: true,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Load backend data if configured
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLiveSearchData = async () => {
      // 1. Fetch inventaris from staging/supabase
      if (usesInventoryPortal() || isSupabaseConfigured()) {
        try {
          const { data } = usesInventoryPortal() ? { data: await inventarisService.getInventarisList() } : await getSupabaseClient()
            .from('ptv_inventaris')
            .select('id, kode, nama_alat, kategori, spesifikasi, foto_url')
            .limit(200);
          if (isMounted && data) {
            setDbInventaris(data);
          }
        } catch {
          // ignore error
        }
      }

      // 2. Fetch notes
      try {
        const fetchedNotes = await catatanService.getNotes();
        if (isMounted && fetchedNotes && fetchedNotes.length > 0) {
          setNotes(fetchedNotes);
        } else if (isMounted) {
          setNotes(MOCK_NOTES);
        }
      } catch {
        if (isMounted) setNotes(MOCK_NOTES);
      }
    };

    fetchLiveSearchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Search indexing and filtering
  const searchGroups: SearchGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const hit = (val: unknown) => String(val || '').toLowerCase().includes(q);
    const groups: SearchGroup[] = [];

    // 1. Inventaris Alat (Capability: inventory.view)
    if (can('inventory.view')) {
      const matchedInv = dbInventaris
        .filter((x) => hit(x.nama_alat) || hit(x.kode) || hit(x.kategori) || hit(x.spesifikasi))
        .slice(0, 5)
        .map((x) => ({
          id: x.id,
          title: x.nama_alat,
          sub: `${x.kode || ''} · ${x.kategori || 'Alat'}`,
          path: `/hub/inventaris/${x.id}`,
          icon: 'fa-solid fa-boxes-stacked',
          thumbnailUrl: x.foto_url,
        }));

      if (matchedInv.length > 0) {
        groups.push({ category: 'Inventaris Alat', items: matchedInv });
      }
    }

    // 2. Kru (Capability: crew.view)
    if (can('crew.view')) {
      const allCrew: CrewMember[] = crewStore.getAll();
      const matchedCrew = allCrew
        .filter((c: CrewMember) => hit(c.full_name) || hit(c.division) || hit(c.ptv_id) || hit(c.phone))
        .slice(0, 5)
        .map((c: CrewMember) => ({
          id: c.id,
          title: c.full_name,
          sub: `${c.ptv_id || ''} · ${c.division || 'Kru PTV'}`,
          path: '/hub/kru',
          icon: 'fa-solid fa-users',
        }));

      if (matchedCrew.length > 0) {
        groups.push({ category: 'Kru', items: matchedCrew });
      }
    }

    // 3. Agenda Acara (Capability: events.view)
    if (can('events.view')) {
      let events: AcaraItem[] = INITIAL_ACARA_FIXTURES;
      try {
        const stored = localStorage.getItem('ptv_acara_state_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) events = parsed;
        }
      } catch {
        // use initial
      }

      const matchedEvents = events
        .filter((e) => hit(e.name) || hit(e.loc) || hit(e.notes))
        .slice(0, 5)
        .map((e) => ({
          id: e.id,
          title: e.name,
          sub: `${e.date || ''} · ${e.loc || ''}`,
          path: `/hub/acara/${e.id}`,
          icon: 'fa-solid fa-calendar-days',
        }));

      if (matchedEvents.length > 0) {
        groups.push({ category: 'Acara', items: matchedEvents });
      }
    }

    // 4. Catatan Bersama & Notulensi (Capability: notes.view)
    if (can('notes.view')) {
      const matchedNotes = notes
        .filter((n) => hit(n.judul) || hit(n.isi) || (Array.isArray(n.tags) && n.tags.some(hit)))
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          title: n.judul,
          sub: `${n.tipe === 'meeting_minutes' ? 'Notulensi Rapat' : 'Catatan Bersama'} · ${(n.tags || []).join(', ') || 'Umum'}`,
          path: '/hub/catatan',
          icon: 'fa-solid fa-note-sticky',
        }));

      if (matchedNotes.length > 0) {
        groups.push({ category: 'Catatan & Notulensi', items: matchedNotes });
      }
    }

    // 5. Surat & Dokumen (Capability: documents.view)
    if (can('documents.view')) {
      let docs: PtvDocument[] = INITIAL_DOCS_FIXTURES;
      try {
        const stored = localStorage.getItem('ptv_shared_docs_store_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) docs = parsed;
        }
      } catch {
        // use initial
      }

      const matchedDocs = docs
        .filter((d) => hit(d.subject) || hit(d.no) || hit(d.type) || (Array.isArray(d.recipients) && d.recipients.some(hit)))
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          title: d.subject,
          sub: `${d.no} · ${d.type}`,
          path: '/hub/dokumen',
          icon: 'fa-solid fa-file-lines',
        }));

      if (matchedDocs.length > 0) {
        groups.push({ category: 'Surat & Dokumen', items: matchedDocs });
      }
    }

    // 6. Broadcast & Pengumuman (Capability: hub.access)
    if (can('hub.access')) {
      let announcements = DEFAULT_ANNOUNCEMENTS;
      try {
        const stored = localStorage.getItem('ptv_broadcast_announcements_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) announcements = parsed;
        }
      } catch {
        // use default
      }

      const matchedBroadcast = announcements
        .filter((a) => hit(a.title) || hit(a.body) || hit(a.by))
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          title: a.title,
          sub: `${a.by} · ${a.date}`,
          path: '/hub/broadcast',
          icon: 'fa-solid fa-bullhorn',
        }));

      if (matchedBroadcast.length > 0) {
        groups.push({ category: 'Pengumuman', items: matchedBroadcast });
      }
    }

    // 7. Laporan Kerusakan (Capability: hub.access)
    if (can('hub.access')) {
      let damages = INITIAL_DAMAGE_REPORT_FIXTURES;
      try {
        const stored = localStorage.getItem('ptv_damage_reports_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) damages = parsed;
        }
      } catch {
        // use fixture
      }

      const matchedDamages = damages
        .filter((d) => hit(d.title) || hit(d.assetName) || hit(d.unitCode) || hit(d.description))
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          title: `${d.assetName} — ${d.title}`,
          sub: `${d.unitCode} · ${d.status}`,
          path: '/hub/kerusakan',
          icon: 'fa-solid fa-wrench',
        }));

      if (matchedDamages.length > 0) {
        groups.push({ category: 'Laporan Kerusakan', items: matchedDamages });
      }
    }

    // 8. Lost & Found (Capability: hub.access)
    if (can('hub.access')) {
      let losts = INITIAL_LOST_FOUND_FIXTURES;
      try {
        const stored = localStorage.getItem('ptv_lost_found_items_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) losts = parsed;
        }
      } catch {
        // use fixture
      }

      const matchedLost = losts
        .filter((l) => hit(l.title) || hit(l.location) || hit(l.description))
        .slice(0, 5)
        .map((l) => ({
          id: l.id,
          title: l.title,
          sub: `${l.location} · ${l.status}`,
          path: '/hub/lostfound',
          icon: 'fa-solid fa-magnifying-glass-location',
        }));

      if (matchedLost.length > 0) {
        groups.push({ category: 'Lost & Found', items: matchedLost });
      }
    }

    return groups;
  }, [query, dbInventaris, notes, can]);

  if (!isOpen) return null;

  const handleSelectResult = (path: string) => {
    onClose();
    navigate(path);
  };

  // Keyboard navigation inside input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // 1. MOBILE SEARCH OVERLAY (1:1 with legacy mobileSearchOverlay)
  if (isMobile) {
    return (
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        className="mobile-search-overlay on"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="mso-container">
          <div className="mso-header">
            <div className="mso-search-box">
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)', marginRight: '6px' }} />
              <input
                ref={inputRef}
                type="search"
                className="mso-input"
                placeholder="Cari kru, alat, acara, catatan, surat..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                autoCapitalize="none"
              />
              {query && (
                <button
                  type="button"
                  className="mso-clear-btn"
                  style={{ display: 'inline-flex' }}
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Hapus"
                >
                  &times;
                </button>
              )}
            </div>
            <button type="button" className="mso-close-btn" onClick={onClose}>
              Tutup
            </button>
          </div>

          <div className="mso-body" id="msoResults">
            {query.trim().length < 2 ? (
              <p className="hint mt12" style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--muted)' }}>
                Ketik minimal 2 huruf untuk mulai mencari.
                <br />
                Hasil pencarian live dikelompokkan per kategori.
              </p>
            ) : searchGroups.length === 0 ? (
              <div className="empty" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '30px', opacity: 0.35, marginBottom: '10px' }} />
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink)' }}>
                  Tidak ada hasil untuk &ldquo;{query}&rdquo;.
                  <br />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Coba kata kunci lain.</span>
                </p>
              </div>
            ) : (
              searchGroups.map((g) => (
                <div key={g.category} style={{ marginBottom: '14px' }}>
                  <p
                    style={{
                      margin: '14px 0 6px 4px',
                      fontSize: '11px',
                      fontWeight: 750,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    {g.category}
                  </p>
                  <div className="list">
                    {g.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="li"
                        style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                        onClick={() => handleSelectResult(item.path)}
                      >
                        {item.thumbnailUrl ? (
                          <span
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--ptv-curve-sm)',
                              overflow: 'hidden',
                              background: 'var(--bg-2, #f1f5f9)',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </span>
                        ) : (
                          <span className="li-ic">
                            <i className={item.icon} />
                          </span>
                        )}
                        <span className="li-body">
                          <span className="li-t trunc" style={{ fontWeight: 650 }}>
                            {item.title}
                          </span>
                          <span className="li-s trunc">{item.sub}</span>
                        </span>
                        <span className="chev">
                          <i className="fa-solid fa-chevron-right" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. DESKTOP SHEET SEARCH (1:1 with legacy openSheet('Pencarian', ...))
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <section
        ref={modalRef}
        className="sheet on"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '85vh', maxWidth: '640px', width: '100%' }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <h3>Pencarian</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="sheet-body" style={{ overflowY: 'auto', paddingBottom: '24px' }}>
          <div
            className="searchbar has-value"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 14px',
              height: '46px',
              borderRadius: 'var(--ptv-curve-pill)',
              border: '1.5px solid var(--b-500, #3b82f6)',
              background: 'var(--surface)',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
              marginBottom: '14px',
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)', fontSize: '15px' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Acara, alat, kru, surat, catatan…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '14.5px',
                color: 'var(--ink)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '2px',
                }}
                aria-label="Hapus"
              >
                &times;
              </button>
            )}
          </div>

          <div id="gres">
            {query.trim().length < 2 ? (
              <p className="hint mt12" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
                Ketik minimal 2 huruf. Hasil dikelompokkan per kategori.
              </p>
            ) : searchGroups.length === 0 ? (
              <div className="empty" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '32px', opacity: 0.35, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)' }}>
                  Tidak ada hasil untuk &ldquo;{query}&rdquo;.
                  <br />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Coba kata kunci lain.</span>
                </p>
              </div>
            ) : (
              searchGroups.map((g) => (
                <div key={g.category} style={{ marginBottom: '16px' }}>
                  <p
                    style={{
                      margin: '14px 0 6px 4px',
                      fontSize: '11px',
                      fontWeight: 750,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    {g.category}
                  </p>
                  <div className="list">
                    {g.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="li"
                        style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                        onClick={() => handleSelectResult(item.path)}
                      >
                        {item.thumbnailUrl ? (
                          <span
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: 'var(--ptv-curve-sm)',
                              overflow: 'hidden',
                              background: 'var(--bg-2, #f1f5f9)',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </span>
                        ) : (
                          <span className="li-ic">
                            <i className={item.icon} />
                          </span>
                        )}
                        <span className="li-body">
                          <span className="li-t trunc" style={{ fontWeight: 650 }}>
                            {item.title}
                          </span>
                          <span className="li-s trunc">{item.sub}</span>
                        </span>
                        <span className="chev">
                          <i className="fa-solid fa-chevron-right" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
};
