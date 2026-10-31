import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useInternalContactStore, internalContactStore } from './internalContactStore';
import { InternalContact } from './types';
import { KontakInternalDetailDrawer } from './components/KontakInternalDetailDrawer';
import { groupCrewByAngkatan } from './kontakMapper';
import { kontakService } from './kontakService';
import { CardListSkeleton } from '@/shared/components';

export const KontakInternalPage: React.FC = () => {
  const { contacts } = useInternalContactStore();

  const [filter, setFilter] = useState<'Semua' | 'Ketua' | 'Pengasuh' | 'Pembina' | 'Pengarah' | 'Pengurus' | 'Kru'>('Semua');
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<InternalContact | null>(null);

  // Live Staging Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStagingInternalContacts = useCallback(async (force = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const liveData = await kontakService.getInternalContacts(force);
      internalContactStore.setLiveContacts(liveData);
    } catch (err: any) {
      console.warn('[KontakInternalPage] Failed to load Staging internal contacts:', err.message);
      setLoadError(err.message || 'Gagal memuat kontak internal. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStagingInternalContacts();
  }, [loadStagingInternalContacts]);

  // Filtering & Search
  const q = search.trim().toLowerCase();
  const matchQ = (c: InternalContact) =>
    !q ||
    c.full_name.toLowerCase().includes(q) ||
    c.position.toLowerCase().includes(q) ||
    c.unit.toLowerCase().includes(q) ||
    (c.ptv_id && c.ptv_id.toLowerCase().includes(q)) ||
    (c.notes && c.notes.toLowerCase().includes(q));

  const pengasuhRows = useMemo(() => contacts.filter((c) => /pengasuh/i.test(c.position) && matchQ(c)), [contacts, q]);
  const ketuaRows = useMemo(() => contacts.filter((c) => /ketua/i.test(c.position) && !/pengasuh/i.test(c.position) && matchQ(c)), [contacts, q]);
  const pembinaRows = useMemo(() => contacts.filter((c) => c.category === 'Pembina' && !/pengasuh|ketua/i.test(c.position) && matchQ(c)), [contacts, q]);
  const pengarahRows = useMemo(() => contacts.filter((c) => c.category === 'Pengarah' && !/pengasuh|ketua/i.test(c.position) && matchQ(c)), [contacts, q]);
  const pengurusRows = useMemo(() => contacts.filter((c) => c.category === 'Pengurus' && !/pengasuh|ketua/i.test(c.position) && matchQ(c)), [contacts, q]);
  const kruRows = useMemo(() => contacts.filter((c) => c.category === 'Kru' && !/pengasuh|ketua/i.test(c.position) && matchQ(c)), [contacts, q]);

  const allCategories = [
    { key: 'Pengasuh', title: 'Pengasuh', desc: 'Pengasuh Pesantren & Figur Kehormatan Lembaga', rows: pengasuhRows, total: contacts.filter((c) => /pengasuh/i.test(c.position)).length },
    { key: 'Pengarah', title: 'Pengarah', desc: 'Pimpinan & Pengarah Lembaga', rows: pengarahRows, total: contacts.filter((c) => c.category === 'Pengarah' && !/pengasuh|ketua/i.test(c.position)).length },
    { key: 'Pembina', title: 'Pembina', desc: 'Dewan Pembina PTV', rows: pembinaRows, total: contacts.filter((c) => c.category === 'Pembina' && !/pengasuh|ketua/i.test(c.position)).length },
    { key: 'Ketua', title: 'Ketua & Pimpinan', desc: 'Ketua Umum & Pimpinan Harian Lembaga', rows: ketuaRows, total: contacts.filter((c) => /ketua/i.test(c.position) && !/pengasuh/i.test(c.position)).length },
    { key: 'Pengurus', title: 'Pengurus', desc: 'Pengurus & Pimpinan Harian PTV', rows: pengurusRows, total: contacts.filter((c) => c.category === 'Pengurus' && !/pengasuh|ketua/i.test(c.position)).length },
    { key: 'Kru', title: 'Kru', desc: 'Anggota & Kru Operasional PTV', rows: kruRows, total: contacts.filter((c) => c.category === 'Kru' && !/pengasuh|ketua/i.test(c.position)).length },
  ];

  const totalAll = allCategories.reduce((sum, cat) => sum + cat.total, 0);

  const visibleCategories =
    filter === 'Semua'
      ? allCategories.filter((c) => c.rows.length > 0)
      : allCategories.filter((c) => c.key === filter);

  // Grouping kru berdasarkan angkatan (Legacy Parity)
  const groupedKruRows = useMemo(() => {
    return groupCrewByAngkatan(kruRows);
  }, [kruRows]);

  const getCategoryGradient = (cat: string) => {
    switch (cat) {
      case 'Ketua':
        return 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)';
      case 'Pengasuh':
        return 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
      case 'Pembina':
        return 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)';
      case 'Pengarah':
        return 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)';
      case 'Pengurus':
        return 'linear-gradient(135deg, #047857 0%, #10b981 100%)';
      default:
        return 'linear-gradient(135deg, var(--b-700) 0%, var(--b-500) 100%)';
    }
  };

  const renderContactRow = (c: InternalContact) => {
    const inits = c.full_name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const isWaValid = Boolean(c.phone && !c.phone.includes('*') && c.phone.replace(/[^0-9]/g, '').length >= 9);
    const waLink = isWaValid
      ? `https://wa.me/${c.phone!.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
      : null;

    return (
      <div
        key={c.id}
        className="kk-list-item"
        onClick={() => setSelectedContact(c)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {c.foto_url ? (
            <>
              <img
                src={c.foto_url}
                alt={c.full_name}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'grid';
                }}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  display: 'none',
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: getCategoryGradient(c.category),
                  color: '#fff',
                  placeItems: 'center',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {inits}
              </div>
            </>
          ) : (
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: getCategoryGradient(c.category),
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '12.5px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {inits}
            </div>
          )}
          <div className="kk-list-item-body">
            <span className="kk-list-item-name">{c.full_name}</span>
            <span className="kk-list-item-sub">
              {c.position} &middot; {c.unit}
            </span>
          </div>
        </div>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn sm kk-whatsapp-btn"
          >
            <i className="fa-brands fa-whatsapp" style={{ fontSize: '13px' }} />
            <span className="only-desktop">Chat</span>
          </a>
        )}
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header Bar */}
      <header className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Kontak Internal</h1>
          <p className="ptv-page-subtitle">
            Nomor yang bisa dihubungi untuk koordinasi internal, figur lembaga, dan urusan operasional kru PTV.
          </p>
        </div>
      </header>

      {/* Searchbar */}
      <div className="kk-searchbar" style={{ marginBottom: '14px' }}>
        <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Cari nama, jabatan, lembaga..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Filter Tabs dengan Counters */}
      <div className="kk-filters-scroll" style={{ marginBottom: '18px' }}>
        {[
          ['Semua', 'Semua', totalAll],
          ['Pengasuh', 'Pengasuh', allCategories[0].total],
          ['Pengarah', 'Pengarah', allCategories[1].total],
          ['Pembina', 'Pembina', allCategories[2].total],
          ['Ketua', 'Ketua', allCategories[3].total],
          ['Pengurus', 'Pengurus', allCategories[4].total],
          ['Kru', 'Kru', allCategories[5].total],
        ].map(([k, label, cnt]) => (
          <button
            key={k}
            type="button"
            className={`kk-filter-pill ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k as any)}
          >
            <span>{label}</span>
            <span className="cnt">{cnt}</span>
          </button>
        ))}
      </div>

      {/* Error Retry Banner */}
      {loadError && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            background: 'var(--warn-bg, #fffbeb)',
            border: '1px solid var(--warn-border, #fef3c7)',
            borderRadius: 'var(--ptv-curve-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warn, #d97706)' }} />
            <span style={{ fontSize: '13px', color: 'var(--ink, #0b2a4a)' }}>{loadError}</span>
          </div>
          <button
            type="button"
            className="btn sm"
            onClick={() => loadStagingInternalContacts(true)}
            style={{ borderRadius: 'var(--ptv-curve-pill)', padding: '4px 12px', fontSize: '12px' }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '4px' }} />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Daftar Kategori Hierarkis */}
      <div>
        {isLoading && contacts.length === 0 ? (
          <CardListSkeleton count={4} />
        ) : visibleCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
            <i className="fa-solid fa-phone-slash" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {q ? 'Tidak ada kontak internal yang cocok dengan pencarian.' : 'Belum ada kontak di kategori ini.'}
            </p>
          </div>
        ) : (
          visibleCategories.map((cat) => (
            <div key={cat.key} className="kontak-category-section">
              <div className="kontak-category-header">
                <div className="kontak-category-title-wrap">
                  <h2 className="kontak-category-title">{cat.title}</h2>
                  <span className="kontak-category-count">
                    {cat.rows.length}
                  </span>
                </div>
                {cat.desc && (
                  <span className="kontak-category-desc only-desktop">
                    {cat.desc}
                  </span>
                )}
              </div>

              {cat.key === 'Kru' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groupedKruRows.map((g) => (
                    <div key={g.label} className="kontak-angkatan-group">
                      <div className="kontak-angkatan-header">
                        <i
                          className={g.icon || 'fa-solid fa-graduation-cap'}
                          style={{
                            fontSize: '11px',
                            color: g.isAdditional ? '#2563eb' : 'var(--b-500)',
                          }}
                        />
                        <span>{g.label}</span>
                        <span className="kontak-angkatan-count">
                          {g.rows.length}
                        </span>
                      </div>
                      <div className="kontak-cards-stack">
                        {g.rows.map(renderContactRow)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="kontak-cards-stack">
                  {cat.rows.map(renderContactRow)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Drawer Detail Kontak Internal (Murni Direktori Komunikasi) */}
      <KontakInternalDetailDrawer
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
};
