import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PtvDocument } from '../dokumen-saya/mock/docsMockData';
import { DocDetailDrawer } from '../dokumen-saya/components/DocDetailDrawer';
import { useSessionStore } from '@core/session';
import { dokumenService } from '../dokumen-saya/dokumenService';
import { useInstantData } from '@/shared/hooks/useInstantData';
import { filterUserDocuments } from '../dokumen-saya/utils/documentOwnership';
import { downloadOfficialDocPdf } from '../dokumen-saya/utils/docPdfPrinter';
import '@/styles/arsip.css';

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export interface MonthlyArchiveGroup {
  monthKey: string;      // "2026-10"
  monthName: string;     // "Oktober"
  year: string;          // "2026"
  label: string;         // "Oktober 2026"
  docs: PtvDocument[];
}

export function parseDocDate(rawDate?: string): { year: string; monthIndex: number; fullDate: string } {
  if (!rawDate) {
    const now = new Date();
    return {
      year: now.getFullYear().toString(),
      monthIndex: now.getMonth(),
      fullDate: '',
    };
  }
  const dateOnly = rawDate.split('T')[0];
  const parts = dateOnly.split('-');
  const year = parts[0] || '2026';
  const monthNum = parseInt(parts[1], 10) || 1;
  const monthIndex = Math.max(0, Math.min(11, monthNum - 1));
  return { year, monthIndex, fullDate: dateOnly };
}

export const ArsipPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, user } = useSessionStore();

  const isExecOrAdmin = Boolean(user) && (can('documents.approve') || can('documents.archive.manage'));
  const canManageArchive = Boolean(user) && can('documents.archive.manage');
  const canViewArchive = Boolean(user) && (can('documents.archive.view') || can('documents.approve') || canManageArchive || can('documents.view'));
  const canApprove = can('documents.approve') || !user;

  const {
    data: liveDocs,
    isLoading,
    error: loadError,
    refetch: fetchLiveArchive,
  } = useInstantData<PtvDocument[]>({
    key: 'dokumen_arsip_list',
    fetcher: async () => {
      const res = await dokumenService.getDocuments('archive', true);
      return res.documents;
    },
    initialData: [],
    ttlMs: 5 * 60 * 1000,
  });

  const currentYear = useMemo(() => new Date().getFullYear().toString(), []);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Draft' | 'Berlaku' | 'Diarsipkan' | 'Dibatalkan'>('Semua');
  const [typeFilter, setTypeFilter] = useState<string>('Semua');
  const [creatorFilter, setCreatorFilter] = useState<string>('Semua');
  const [yearFilter, setYearFilter] = useState<string>(currentYear);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Accordion state per bulan: key is monthKey (e.g. "2026-10")
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedMonths({});
  }, [searchQuery, scopeFilter, statusFilter, typeFilter, creatorFilter, yearFilter, dateFrom, dateTo]);

  // Drawer & Toast State
  const [selectedDoc, setSelectedDoc] = useState<PtvDocument | null>(() => {
    const initialDocId = searchParams.get('doc');
    if (initialDocId) {
      return (liveDocs || []).find((d) => d.id === initialDocId) || null;
    }
    return null;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const docId = searchParams.get('doc');
    if (docId) {
      const found = (liveDocs || []).find((d) => d.id === docId);
      if (found) setSelectedDoc(found);
    }
  }, [searchParams, liveDocs]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Distinct Filter Options
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    (liveDocs || []).forEach((d) => {
      if (d.type) set.add(d.type);
    });
    return Array.from(set);
  }, [liveDocs]);

  const availableCreators = useMemo(() => {
    const set = new Set<string>();
    (liveDocs || []).forEach((d) => {
      const c = d.diajukan_oleh || d.owner || d.penanggung_jawab;
      if (c && typeof c === 'string' && c.trim().length > 0) {
        set.add(c.trim());
      }
    });
    return Array.from(set).sort();
  }, [liveDocs]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add(currentYear);
    (liveDocs || []).forEach((d) => {
      const { year } = parseDocDate(d.date || d.created_at);
      if (year) set.add(year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [liveDocs, currentYear]);

  // Multi-criteria Filtering & Search
  const filteredDocs = useMemo(() => {
    let result = liveDocs || [];

    // 1. Scope filter ('all' vs 'my')
    if (scopeFilter === 'my' && user) {
      result = filterUserDocuments(result, {
        name: user.full_name,
        username: user.username,
        ptv_id: user.ptv_id,
        isExecOrAdmin,
      });
    }

    // 2. Search Query (Nomor surat, perihal, nama pihak terkait)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) =>
        (d.no || '').toLowerCase().includes(q) ||
        (d.subject || '').toLowerCase().includes(q) ||
        (d.type || '').toLowerCase().includes(q) ||
        (d.owner || '').toLowerCase().includes(q) ||
        (d.pembawa || '').toLowerCase().includes(q) ||
        (d.penanggung_jawab || '').toLowerCase().includes(q) ||
        (d.diajukan_oleh || '').toLowerCase().includes(q) ||
        (d.event || '').toLowerCase().includes(q) ||
        (d.recipients && d.recipients.some((r) => r.toLowerCase().includes(q))) ||
        (d.santri_list && d.santri_list.some((s: any) => (typeof s === 'string' ? s : s?.nama || '').toLowerCase().includes(q))) ||
        (d.items && d.items.some((it) => (typeof it === 'string' ? it : '').toLowerCase().includes(q)))
      );
    }

    // 3. Status filter
    if (statusFilter !== 'Semua') {
      const s = statusFilter.toLowerCase();
      if (s === 'draft') {
        result = result.filter((d) => ['menunggu', 'draft', 'revisi'].includes(d.status.toLowerCase()));
      } else if (s === 'berlaku') {
        result = result.filter((d) => ['disetujui', 'berlaku', 'aktif', 'valid'].includes(d.status.toLowerCase()));
      } else if (s === 'diarsipkan') {
        result = result.filter((d) => ['diarsipkan', 'archived'].includes(d.status.toLowerCase()));
      } else if (s === 'dibatalkan') {
        result = result.filter((d) => ['ditolak', 'dibatalkan', 'batal'].includes(d.status.toLowerCase()));
      } else {
        result = result.filter((d) => d.status === statusFilter);
      }
    }

    // 4. Type filter
    if (typeFilter !== 'Semua') {
      result = result.filter((d) => d.type === typeFilter);
    }

    // 5. Creator filter
    if (creatorFilter !== 'Semua') {
      result = result.filter((d) =>
        (d.diajukan_oleh || '').toLowerCase() === creatorFilter.toLowerCase() ||
        (d.owner || '').toLowerCase() === creatorFilter.toLowerCase() ||
        (d.penanggung_jawab || '').toLowerCase() === creatorFilter.toLowerCase()
      );
    }

    // 6. Year filter
    if (yearFilter !== 'Semua') {
      result = result.filter((d) => {
        const { year } = parseDocDate(d.date || d.created_at);
        return year === yearFilter;
      });
    }

    // 7. Date Range filter
    if (dateFrom) {
      result = result.filter((d) => (d.date || d.created_at?.slice(0, 10) || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((d) => (d.date || d.created_at?.slice(0, 10) || '') <= dateTo);
    }

    return result;
  }, [liveDocs, scopeFilter, searchQuery, statusFilter, typeFilter, creatorFilter, yearFilter, dateFrom, dateTo, user]);

  // Monthly Grouping
  const groupedByMonth = useMemo<MonthlyArchiveGroup[]>(() => {
    const map = new Map<string, MonthlyArchiveGroup>();

    filteredDocs.forEach((d) => {
      const rawDate = d.date || d.created_at;
      const { year, monthIndex } = parseDocDate(rawDate);
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthName = MONTH_NAMES_ID[monthIndex];
      const label = `${monthName} ${year}`;

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          monthName,
          year,
          label,
          docs: [],
        });
      }
      map.get(monthKey)!.docs.push(d);
    });

    const sortedGroups = Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    sortedGroups.forEach((group) => {
      group.docs.sort((a, b) => {
        const dateA = a.date || a.created_at || '';
        const dateB = b.date || b.created_at || '';
        const cmp = dateB.localeCompare(dateA);
        if (cmp !== 0) return cmp;
        return (b.id || '').localeCompare(a.id || '');
      });
    });

    return sortedGroups;
  }, [filteredDocs]);

  const isMonthOpen = (monthKey: string, groupIdx: number): boolean => {
    if (collapsedMonths[monthKey] !== undefined) {
      return !collapsedMonths[monthKey];
    }
    return groupIdx === 0;
  };

  const toggleMonth = (monthKey: string, groupIdx: number) => {
    setCollapsedMonths((prev) => {
      const currentlyOpen = prev[monthKey] !== undefined ? !prev[monthKey] : groupIdx === 0;
      return {
        ...prev,
        [monthKey]: currentlyOpen,
      };
    });
  };

  // Stats calculation
  const totalCount = (liveDocs || []).length;
  const berlakuCount = useMemo(() => (liveDocs || []).filter((d) => ['disetujui', 'berlaku', 'aktif', 'valid'].includes(d.status.toLowerCase())).length, [liveDocs]);
  const draftCount = useMemo(() => (liveDocs || []).filter((d) => ['menunggu', 'draft', 'revisi'].includes(d.status.toLowerCase())).length, [liveDocs]);
  const diarsipkanCount = useMemo(() => (liveDocs || []).filter((d) => ['diarsipkan', 'archived'].includes(d.status.toLowerCase())).length, [liveDocs]);

  // Handlers
  const handleApprove = async (id: string, note?: string) => {
    try {
      const updated = await dokumenService.updateDocStatus(id, 'disetujui', note);
      setSelectedDoc(updated);
      await fetchLiveArchive();
      showToast('Persetujuan surat tersimpan.');
    } catch (err: any) {
      showToast(err.message || 'Persetujuan gagal disimpan.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await dokumenService.updateDocStatus(id, 'ditolak');
      setSelectedDoc(updated);
      await fetchLiveArchive();
      showToast('Penolakan surat tersimpan.');
    } catch (err: any) {
      showToast(err.message || 'Penolakan gagal disimpan.');
    }
  };

  const handleArchive = async (id: string, note?: string) => {
    try {
      const updated = await dokumenService.archiveDocument(id, note);
      setSelectedDoc(updated);
      await fetchLiveArchive();
      showToast('Surat resmi berhasil diarsipkan.');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengarsipkan surat.');
    }
  };

  const handleDelete = async (id: string, reason?: string) => {
    try {
      await dokumenService.deleteDocument(id, reason);
      setSelectedDoc(null);
      await fetchLiveArchive();
      showToast('Surat berhasil dihapus dan nomor resmi dilepaskan.');
    } catch (err: any) {
      showToast(err.message || 'Penghapusan gagal disimpan.');
    }
  };

  const handleQuickDownload = async (e: React.MouseEvent, doc: PtvDocument) => {
    e.stopPropagation();
    try {
      await downloadOfficialDocPdf(doc);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh PDF surat.');
    }
  };

  const isFilterActive =
    searchQuery.trim() !== '' ||
    scopeFilter !== 'all' ||
    statusFilter !== 'Semua' ||
    typeFilter !== 'Semua' ||
    creatorFilter !== 'Semua' ||
    yearFilter !== currentYear ||
    dateFrom !== '' ||
    dateTo !== '';

  const resetFilters = () => {
    setSearchQuery('');
    setScopeFilter('all');
    setStatusFilter('Semua');
    setTypeFilter('Semua');
    setCreatorFilter('Semua');
    setYearFilter(currentYear);
    setDateFrom('');
    setDateTo('');
  };

  const getStatusBadgeInfo = (status: string) => {
    const s = (status || '').toLowerCase();
    if (['diarsipkan', 'archived'].includes(s)) {
      return { label: 'Diarsipkan', className: 'status-archived', color: '#b45309', bg: '#fef3c7', border: '#fde68a' };
    }
    if (['disetujui', 'berlaku', 'aktif', 'valid'].includes(s)) {
      return { label: 'Berlaku (ACC)', className: 'status-approved', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' };
    }
    if (['ditolak', 'dibatalkan', 'batal'].includes(s)) {
      return { label: 'Dibatalkan', className: 'status-rejected', color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' };
    }
    return { label: 'Draft / Menunggu', className: 'status-pending', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' };
  };

  if (!canViewArchive) {
    return (
      <div className="arsip-page">
        <div style={{ textAlign: 'center', padding: '64px 20px', background: 'var(--surface)', borderRadius: 'var(--ptv-curve-xl)', border: '1px solid var(--line-2)' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '42px', color: '#dc2626', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', marginBottom: '8px' }}>
            Akses Terbatas: Surat &amp; Arsip
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--muted)', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            Modul Surat &amp; Arsip memerlukan izin akses dokumen terverifikasi sesuai kebijakan institusi Progresif TV.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="arsip-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--ink, #0b2a4a)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--ptv-curve-pill)',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--ok, #10b981)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <header className="arsip-hero ptv-page-header">
        <div className="arsip-title-group ptv-page-header-main">
          <h1 className="arsip-title ptv-page-title">Surat &amp; Arsip</h1>
          <p className="arsip-desc ptv-page-subtitle">
            Pusat repositori, penerbitan, dan arsip digital resmi surat izin, surat tugas, dan surat barang Progresif TV.
          </p>
        </div>
      </header>

      {/* Stats Summary Grid */}
      <div className="arsip-stats-grid">
        <div className="arsip-stat-card">
          <div className="arsip-stat-icon blue">
            <i className="fa-solid fa-box-archive" />
          </div>
          <div>
            <div className="arsip-stat-val">{totalCount}</div>
            <div className="arsip-stat-label">Total Surat Terdaftar</div>
          </div>
        </div>

        <div className="arsip-stat-card">
          <div className="arsip-stat-icon green">
            <i className="fa-solid fa-circle-check" />
          </div>
          <div>
            <div className="arsip-stat-val">{berlakuCount}</div>
            <div className="arsip-stat-label">Surat Berlaku (Aktif)</div>
          </div>
        </div>

        <div className="arsip-stat-card">
          <div className="arsip-stat-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
            <i className="fa-regular fa-clock" />
          </div>
          <div>
            <div className="arsip-stat-val">{draftCount}</div>
            <div className="arsip-stat-label">Draft / Menunggu</div>
          </div>
        </div>

        <div className="arsip-stat-card">
          <div className="arsip-stat-icon amber">
            <i className="fa-solid fa-folder-closed" />
          </div>
          <div>
            <div className="arsip-stat-val">{diarsipkanCount}</div>
            <div className="arsip-stat-label">Diarsipkan (Tidak Berlaku)</div>
          </div>
        </div>
      </div>

      {/* Search & Controls Card */}
      <div className="arsip-controls-card">
        {/* Tier 1: SEARCH & SCOPE TOGGLE */}
        <div className="arsip-control-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <label htmlFor="arsipQ" className="arsip-control-label" style={{ margin: 0 }}>
              <i className="fa-solid fa-magnifying-glass" /> Pencarian Surat
            </label>

            {/* Scope Pill Toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-sunken, #f1f5f9)', padding: '3px', borderRadius: 'var(--ptv-curve-pill)' }}>
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                style={{
                  border: 'none',
                  background: scopeFilter === 'all' ? 'var(--surface, #ffffff)' : 'transparent',
                  color: scopeFilter === 'all' ? 'var(--ink, #0b2a4a)' : 'var(--muted, #64748b)',
                  fontWeight: scopeFilter === 'all' ? 700 : 500,
                  fontSize: '11.5px',
                  padding: '4px 12px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  cursor: 'pointer',
                  boxShadow: scopeFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Semua Surat
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('my')}
                style={{
                  border: 'none',
                  background: scopeFilter === 'my' ? 'var(--surface, #ffffff)' : 'transparent',
                  color: scopeFilter === 'my' ? 'var(--ink, #0b2a4a)' : 'var(--muted, #64748b)',
                  fontWeight: scopeFilter === 'my' ? 700 : 500,
                  fontSize: '11.5px',
                  padding: '4px 12px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  cursor: 'pointer',
                  boxShadow: scopeFilter === 'my' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Surat Saya
              </button>
            </div>
          </div>

          <div className="arsip-search-wrap">
            <i className="fa-solid fa-magnifying-glass arsip-search-icon" />
            <input
              id="arsipQ"
              type="text"
              className="arsip-search-input"
              placeholder="Cari nomor surat, perihal, nama santri, pemohon, atau penerbit…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="arsip-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: STATUS FILTER CHIPS */}
        <div className="arsip-control-section">
          <div className="arsip-control-label">
            <i className="fa-solid fa-filter" /> Status Surat
          </div>
          <div className="arsip-filter-scroll-container">
            <div className="arsip-filter-chips">
              {(['Semua', 'Draft', 'Berlaku', 'Diarsipkan', 'Dibatalkan'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`arsip-chip ${statusFilter === st ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'Semua' ? 'Semua Status' : st === 'Berlaku' ? 'Berlaku (ACC)' : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier 3: PARAMETER FILTER GRID */}
        <div className="arsip-control-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="arsip-select-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {/* Jenis Dokumen */}
            <div className="arsip-select-item">
              <label htmlFor="arsipTypeFilter" className="arsip-control-label">
                <i className="fa-solid fa-file-lines" /> Jenis Dokumen
              </label>
              <div className="arsip-select-wrap">
                <select
                  id="arsipTypeFilter"
                  className="arsip-select-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="Semua">Semua Jenis Dokumen</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down arsip-select-arrow" />
              </div>
            </div>

            {/* Pembuat / Penerbit */}
            <div className="arsip-select-item">
              <label htmlFor="arsipCreatorFilter" className="arsip-control-label">
                <i className="fa-solid fa-user-pen" /> Pembuat / Penerbit
              </label>
              <div className="arsip-select-wrap">
                <select
                  id="arsipCreatorFilter"
                  className="arsip-select-filter"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                >
                  <option value="Semua">Semua Pihak Terlibat</option>
                  {availableCreators.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down arsip-select-arrow" />
              </div>
            </div>

            {/* Rentang Tanggal Mulai */}
            <div className="arsip-select-item">
              <label htmlFor="arsipDateFrom" className="arsip-control-label">
                <i className="fa-regular fa-calendar" /> Dari Tanggal
              </label>
              <div className="arsip-select-wrap">
                <input
                  id="arsipDateFrom"
                  type="date"
                  className="arsip-select-filter"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ paddingRight: '12px' }}
                />
              </div>
            </div>

            {/* Rentang Tanggal Selesai */}
            <div className="arsip-select-item">
              <label htmlFor="arsipDateTo" className="arsip-control-label">
                <i className="fa-regular fa-calendar-check" /> Sampai Tanggal
              </label>
              <div className="arsip-select-wrap">
                <input
                  id="arsipDateTo"
                  type="date"
                  className="arsip-select-filter"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ paddingRight: '12px' }}
                />
              </div>
            </div>

            {/* Tahun */}
            <div className="arsip-select-item">
              <label htmlFor="arsipYearFilter" className="arsip-control-label">
                <i className="fa-solid fa-calendar-days" /> Tahun
              </label>
              <div className="arsip-select-wrap">
                <select
                  id="arsipYearFilter"
                  className="arsip-select-filter"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="Semua">Semua Tahun</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>Tahun {y}</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down arsip-select-arrow" />
              </div>
            </div>
          </div>

          {/* Reset Action */}
          {isFilterActive && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                }}
              >
                <i className="fa-solid fa-rotate-left" />
                Reset Semua Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner with Retry */}
      {loadError && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--ptv-curve-lg, 16px)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626', fontSize: '16px' }} />
            <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>{loadError}</span>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => fetchLiveArchive()}
            style={{ fontSize: '12px', padding: '6px 12px', minHeight: '32px', borderRadius: 'var(--ptv-curve-pill)' }}
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Monthly Accordion Sections */}
      {isLoading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }} />
          <p style={{ fontSize: '13.5px', margin: 0 }}>Menyinkronkan repositori Surat &amp; Arsip...</p>
        </div>
      ) : groupedByMonth.length === 0 ? (
        <div className="arsip-empty-card arsip-empty-state">
          <div className="arsip-empty-icon">
            <i className="fa-solid fa-folder-open" />
          </div>
          <h3 className="arsip-empty-title">Tidak Ada Surat Ditemukan</h3>
          <p className="arsip-empty-desc">
            {isFilterActive
              ? 'Tidak ada dokumen yang cocok dengan kriteria filter atau pencarian saat ini.'
              : 'Belum ada dokumen surat yang terdaftar di repositori Surat & Arsip.'}
          </p>
          {isFilterActive && (
            <button
              type="button"
              className="btn pri"
              onClick={resetFilters}
              style={{ marginTop: '12px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="arsip-groups-container">
          {groupedByMonth.map((group, groupIdx) => {
            const isOpen = isMonthOpen(group.monthKey, groupIdx);
            return (
              <section key={group.monthKey} className="arsip-month-section">
                <button
                  type="button"
                  className="arsip-month-header"
                  onClick={() => toggleMonth(group.monthKey, groupIdx)}
                  aria-expanded={isOpen}
                >
                  <span className="arsip-month-title">
                    <i className="fa-solid fa-calendar-check arsip-month-icon" />
                    <span>{group.label}</span>
                  </span>
                  <span className="arsip-month-count">{group.docs.length} surat</span>
                  <div className="arsip-month-rule" />
                  <span className="arsip-month-toggle">
                    <span>{isOpen ? 'Tutup' : 'Buka'}</span>
                    <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} arsip-month-chevron`} />
                  </span>
                </button>

                {isOpen && (
                  <div className="arsip-items-stack arsip-doc-list">
                    {group.docs.map((doc) => {
                      const badge = getStatusBadgeInfo(doc.status);
                      const hasOfficialNo =
                        (doc.status === 'Disetujui' || doc.status === 'Berlaku' || doc.status === 'Diarsipkan') &&
                        doc.no &&
                        doc.no !== '—' &&
                        !doc.no.includes('Menunggu');

                      return (
                        <article
                          key={doc.id}
                          className="arsip-item-card arsip-doc-row"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setSearchParams({ doc: doc.id });
                          }}
                        >
                          {/* Visual Icon */}
                          <div className={`arsip-item-ic arsip-doc-icon ${doc.type.includes('Izin') ? 'blue' : doc.type.includes('Tugas') ? 'indigo' : 'teal'}`}>
                            <i className={doc.type.includes('Izin') ? 'fa-solid fa-id-badge' : doc.type.includes('Tugas') ? 'fa-solid fa-clipboard-list' : 'fa-solid fa-box'} />
                          </div>

                          {/* Content */}
                          <div className="arsip-item-body arsip-doc-body">
                            <div className="arsip-item-topline arsip-doc-meta-top">
                              <span className={`arsip-item-no ${hasOfficialNo ? 'official' : 'draft'} arsip-doc-number`}>{doc.no || 'DRAFT'}</span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--ptv-curve-pill)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: badge.color,
                                  background: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                }}
                              >
                                {badge.label}
                              </span>
                              <span className="arsip-item-type-badge arsip-doc-type-badge">{doc.type}</span>
                            </div>

                            <h3 className="arsip-item-subject arsip-doc-subject">{doc.subject}</h3>

                            <div className="arsip-item-meta arsip-doc-meta-bottom">
                              <span className="arsip-meta-item">
                                <i className="fa-regular fa-calendar" /> {doc.date || doc.created_at?.slice(0, 10)}
                              </span>
                              <span className="arsip-meta-item">
                                <i className="fa-solid fa-user-pen" /> {doc.diajukan_oleh || doc.owner || '—'}
                              </span>
                              {doc.santri_list && Array.isArray(doc.santri_list) && doc.santri_list.length > 0 && (
                                <span className="arsip-meta-item">
                                  <i className="fa-solid fa-users" /> {doc.santri_list.length} santri
                                </span>
                              )}
                              {doc.items && Array.isArray(doc.items) && doc.items.length > 0 && (
                                <span className="arsip-meta-item">
                                  <i className="fa-solid fa-boxes-stacked" /> {doc.items.length} alat
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Primary PDF & Secondary Rincian */}
                          <div className="arsip-item-right arsip-doc-actions">
                            {hasOfficialNo && (
                              <button
                                type="button"
                                className="arsip-doc-btn arsip-doc-btn-primary arsip-pdf-btn"
                                onClick={(e) => handleQuickDownload(e, doc)}
                                title="Unduh PDF Resmi"
                                aria-label={`Unduh PDF surat ${doc.no || doc.subject}`}
                              >
                                <i className="fa-solid fa-download" />
                                <span>PDF</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="arsip-doc-btn arsip-doc-btn-secondary arsip-doc-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoc(doc);
                                setSearchParams({ doc: doc.id });
                              }}
                              title="Lihat Rincian Dokumen"
                              aria-label={`Buka rincian surat ${doc.no || doc.subject}`}
                            >
                              <span>Rincian</span>
                              <i className="fa-solid fa-chevron-right" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Document Detail Drawer Modal */}
      <DocDetailDrawer
        doc={selectedDoc}
        onClose={() => {
          setSelectedDoc(null);
          setSearchParams({});
        }}
        canApprove={canApprove}
        canManageArchive={canManageArchive}
        onApprove={handleApprove}
        onReject={handleReject}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </div>
  );
};
