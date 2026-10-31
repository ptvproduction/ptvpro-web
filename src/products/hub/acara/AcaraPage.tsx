/**
 * PTV PRO — Modul Acara
 * Halaman Utama: Daftar Agenda Acara Liputan & Produksi Studio
 * Porting pgAcara & getAcaraContent (page-dasbor.php L15434–15476)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAcara } from './context/AcaraContext';
import { AcaraCard } from './components/AcaraCard';
import { AcaraFormModal } from './components/AcaraFormModal';
import { AcaraFilter } from './types';
import { formatIsoDate } from './utils/acaraDateUtils';
import { useSessionStore } from '@core/session';
import { AcaraKalenderHeader } from '@/shared/components/AcaraKalenderHeader';
import { CardListSkeleton } from '@/shared/components';
import { Plus, Search, Inbox } from 'lucide-react';

export const AcaraPage: React.FC = () => {
  const { events, isLoading, error, refreshEvents } = useAcara();
  const { session } = useSessionStore();

  const [activeFilter, setActiveFilter] = useState<AcaraFilter>(() => {
    try {
      const saved = sessionStorage.getItem('ptv_acara_filter_v1');
      if (saved === 'semua' || saved === 'mendatang' || saved === 'saya' || saved === 'selesai') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'semua';
  });

  const [search, setSearch] = useState(() => {
    try {
      return sessionStorage.getItem('ptv_acara_search_v1') || '';
    } catch {
      return '';
    }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('ptv_acara_filter_v1', activeFilter);
    } catch {
      // ignore
    }
  }, [activeFilter]);

  useEffect(() => {
    try {
      sessionStorage.setItem('ptv_acara_search_v1', search);
    } catch {
      // ignore
    }
  }, [search]);

  // Operator / user yang aktif untuk filter 'Saya'
  const currentUserName = session?.user?.full_name || session?.user?.username || 'Roup';

  const todayStr = useMemo(() => formatIsoDate(new Date()), []);

  // Filter & Search Logic sesuai spesifikasi legacy (L15436–15440)
  const filteredEvents = useMemo(() => {
    let rows = [...events].sort((a, b) => b.date.localeCompare(a.date));

    if (activeFilter === 'mendatang') {
      rows = rows
        .filter((e) => e.date >= todayStr && e.status !== 'Selesai' && e.status !== 'Dibatalkan')
        .reverse();
    } else if (activeFilter === 'selesai') {
      rows = rows.filter(
        (e) => e.status === 'Selesai' || (e.status !== 'Dibatalkan' && e.date < todayStr)
      );
    } else if (activeFilter === 'saya') {
      rows = rows.filter((e) => {
        const crewNames = (e.crew || []).map((c) => c.name.toLowerCase());
        const userLower = currentUserName.toLowerCase();
        // Cocokkan nama operator aktif atau nama panggilan
        return crewNames.some((cn) => cn.includes(userLower) || userLower.includes(cn));
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.loc.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    return rows;
  }, [events, activeFilter, todayStr, currentUserName, search]);

  const filterLabels: { key: AcaraFilter; label: string }[] = [
    { key: 'semua', label: 'Semua' },
    { key: 'mendatang', label: 'Mendatang' },
    { key: 'saya', label: 'Saya' },
    { key: 'selesai', label: 'Selesai' }
  ];

  return (
    <div className="acara-kal-view-transition">
      {/* 1. Shared Unified Header Component */}
      <AcaraKalenderHeader />

      {/* 2. Action & Filter Bar (Row Terpisah dari Shared Header) */}
      <div className="acara-action-bar">
        <div className="acara-filter-chips">
          {filterLabels.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`acara-fchip ${activeFilter === f.key ? 'on' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
              {f.key === 'saya' && (
                <span
                  style={{
                    marginLeft: '5px',
                    fontSize: '11px',
                    opacity: 0.85
                  }}
                >
                  ({currentUserName})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="acara-action-controls">
          <div className="acara-search-box">
            <Search size={15} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              className="acara-search-input"
              placeholder="Cari acara, lokasi, instruksi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className="acara-btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            aria-label="Tambah Acara Liputan Baru"
          >
            <Plus size={15} />
            <span>Acara Baru</span>
          </button>
        </div>
      </div>

      {/* 3. Daftar Acara / Loading / Error / Empty State */}
      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : error ? (
        <div className="acara-empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.04)' }}>
          <div className="acara-empty-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Inbox size={28} />
          </div>
          <h3 className="acara-empty-title" style={{ color: '#dc2626' }}>Gagal Memuat Acara</h3>
          <p className="acara-empty-desc" style={{ color: '#b91c1c' }}>{error}</p>
          <button
            type="button"
            className="acara-btn-primary"
            onClick={() => refreshEvents()}
            style={{ marginTop: '12px' }}
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="acara-list">
          {filteredEvents.map((event) => (
            <AcaraCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="acara-empty-state">
          <div className="acara-empty-icon">
            <Inbox size={28} />
          </div>
          <h3 className="acara-empty-title">Belum ada acara pada filter ini</h3>
          <p className="acara-empty-desc">
            {search
              ? `Tidak ditemukan acara dengan kata kunci "${search}".`
              : activeFilter === 'saya'
              ? `Belum ada agenda liputan yang menugaskan ${currentUserName}.`
              : 'Belum ada agenda acara yang dijadwalkan pada kategori ini.'}
          </p>
          <button
            type="button"
            className="acara-btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ marginTop: '8px' }}
          >
            <Plus size={16} /> Jadwalkan Acara Pertama
          </button>
        </div>
      )}

      {/* 4. Modal Tambah Acara */}
      <AcaraFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
