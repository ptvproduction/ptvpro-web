import { useNavigate } from 'react-router-dom';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCrewStore, crewStore, groupCrewByAngkatan } from './kruStore';
import { CrewMember, LoginHistoryItem } from './types';
import { useSessionStore } from '@core/session';
import { getKruService } from './kruService';
import { KruDetailDrawer } from './components/KruDetailDrawer';
import { KruFormModal } from './components/KruFormModal';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { TableSkeleton, PageHeaderSkeleton, showToast } from '@shared/components';

export const KruPage: React.FC = () => {
  const navigate = useNavigate();
  const { can, user } = useSessionStore();
  const isRoot = user?.username === 'jid' || (user?.assigned_profiles?.includes('root_executive') ?? false);
  const {
    members,
    loading,
    error,
    refreshCrew,
    getSuggestedNextPtvId,
  } = useCrewStore();

  // Role permissions
  const canManage = can('crew.create');

  // Filters state - Default Kru Aktif
  const [activeTab, setActiveTab] = useState<'Aktif' | 'Nonaktif' | 'Pengasuh' | 'Pengarah' | 'Pembina' | 'Semua'>('Aktif');
  const [search, setSearch] = useState('');
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);
  const [isLoginHistoryOpen, setIsLoginHistoryOpen] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loginHistoryModalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: isLoginHistoryOpen,
    onClose: () => setIsLoginHistoryOpen(false),
    modalRef: loginHistoryModalRef,
  });

  useEffect(() => {
    if (isLoginHistoryOpen) {
      setLoadingHistory(true);
      getKruService()
        .getLoginHistory()
        .then((items) => setLoginHistory(items))
        .catch(() => setLoginHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [isLoginHistoryOpen]);

  // Search query & filter
  const q = search.trim().toLowerCase();
  const matchQ = (c: CrewMember) =>
    !q ||
    c.full_name.toLowerCase().includes(q) ||
    c.position.toLowerCase().includes(q) ||
    c.division.toLowerCase().includes(q) ||
    (c.ptv_id && c.ptv_id.toLowerCase().includes(q)) ||
    (c.username && c.username.toLowerCase().includes(q));

  // Filtered members list in strict hierarchy: 1. PENGASUH -> 2. PENGARAH -> 3. PEMBINA -> 4. KRU
  const pengasuhCrew = useMemo(
    () => members.filter((c) => (c.category === 'Pengasuh' || /pengasuh/i.test(c.position)) && matchQ(c)),
    [members, q]
  );
  const pengarahCrew = useMemo(
    () =>
      members.filter(
        (c) =>
          (c.category === 'Pengarah' || /pengarah/i.test(c.position)) &&
          c.category !== 'Pengasuh' &&
          !/pengasuh/i.test(c.position) &&
          matchQ(c)
      ),
    [members, q]
  );
  const pembinaCrew = useMemo(
    () =>
      members.filter(
        (c) =>
          (c.category === 'Pembina' || /pembina/i.test(c.position)) &&
          c.category !== 'Pengasuh' &&
          c.category !== 'Pengarah' &&
          !/pengasuh|pengarah/i.test(c.position) &&
          matchQ(c)
      ),
    [members, q]
  );
  const aktifCrew = useMemo(
    () =>
      members.filter(
        (c) =>
          c.category === 'Kru' &&
          c.status_kru === 'Aktif' &&
          !/pengasuh|pengarah|pembina/i.test(c.position) &&
          matchQ(c)
      ),
    [members, q]
  );
  const nonaktifCrew = useMemo(
    () =>
      members.filter(
        (c) =>
          c.category === 'Kru' &&
          c.status_kru !== 'Aktif' &&
          !/pengasuh|pengarah|pembina/i.test(c.position) &&
          matchQ(c)
      ),
    [members, q]
  );

  const pengasuhTotal = members.filter((c) => c.category === 'Pengasuh' || /pengasuh/i.test(c.position)).length;
  const pengarahTotal = members.filter(
    (c) =>
      (c.category === 'Pengarah' || /pengarah/i.test(c.position)) &&
      c.category !== 'Pengasuh' &&
      !/pengasuh/i.test(c.position)
  ).length;
  const pembinaTotal = members.filter(
    (c) =>
      (c.category === 'Pembina' || /pembina/i.test(c.position)) &&
      c.category !== 'Pengasuh' &&
      c.category !== 'Pengarah' &&
      !/pengasuh|pengarah/i.test(c.position)
  ).length;
  const aktifTotal = members.filter(
    (c) => c.category === 'Kru' && c.status_kru === 'Aktif' && !/pengasuh|pengarah|pembina/i.test(c.position)
  ).length;
  const nonaktifTotal = members.filter(
    (c) => c.category === 'Kru' && c.status_kru !== 'Aktif' && !/pengasuh|pengarah|pembina/i.test(c.position)
  ).length;

  // Action handlers
  const handleOpenAdd = () => {
    setEditingCrew(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (crew: CrewMember) => {
    setSelectedCrew(null);
    setEditingCrew(crew);
    setIsFormOpen(true);
  };

  const handleToggleAccountStatus = async (id: string, currentAccountStatus: string) => {
    const service = getKruService();
    try {
      const res = await service.toggleAccountStatus(id, currentAccountStatus);
      await refreshCrew();
      showToast(res.message || 'Status akun berhasil diperbarui di Staging.');
      // Update selected crew if still open
      const updated = crewStore.getById(id);
      if (updated) {
        setSelectedCrew(updated);
      }
    } catch (err: any) {
      showToast(`Gagal mengubah status akun: ${err.message}`);
    }
  };

  const handleSaveForm = async (data: Omit<CrewMember, 'id'>) => {
    const service = getKruService();
    if (editingCrew) {
      const updated = await service.updateCrew(editingCrew.id, data);
      await refreshCrew();
      showToast(`Data profil kru ${data.full_name} berhasil diperbarui.`);
      if (selectedCrew?.id === editingCrew.id && updated) {
        setSelectedCrew(updated);
      }
    } else {
      const created = await service.createCrew(data);
      await refreshCrew();
      showToast(`Kru ${created.full_name} (${created.ptv_id}) berhasil didaftarkan.`);
    }
    setIsFormOpen(false);
  };

  const handleToggleStatus = async (id: string) => {
    const service = getKruService();
    const current = crewStore.getById(id);
    if (!current) return;
    const nextStatus = current.status_kru === 'Aktif' ? 'Nonaktif' : 'Aktif';
    try {
      const updated = await service.updateCrew(id, { status_kru: nextStatus, version: current.version });
      await refreshCrew();
      showToast(`Status keanggotaan ${updated.full_name} kini: ${updated.status_kru} (Tersimpan di Staging)`);
      setSelectedCrew(updated);
    } catch (err: any) {
      showToast(`Gagal mengubah status: ${err.message}`);
    }
  };

  // Helper render list anggota per angkatan
  const renderAngkatanGroup = (list: CrewMember[]) => {
    const groups = groupCrewByAngkatan(list);
    if (groups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
          <i className="fa-solid fa-users-slash" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '13px' }}>Tidak ada data kru di kategori ini.</p>
        </div>
      );
    }

    return groups.map((g) => (
      <div key={g.label} className="kru-group-section">
        <div className="kru-group-heading">
          <div className="kru-group-heading-left">
            <i className={g.icon || 'fa-solid fa-graduation-cap'} />
            <span className="kru-group-heading-title">{g.label}</span>
          </div>
          <span className="kru-group-heading-count">
            {g.members.length} Kru
          </span>
        </div>

        <div className="kru-group-container">
          {g.members.map((c) => {
            const inits = c.full_name
              .split(' ')
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <button
                key={c.id}
                type="button"
                className="kru-row-item"
                onClick={() => setSelectedCrew(c)}
              >
                <div className="kru-row-left">
                  {c.foto_url ? (
                    <img
                      src={c.foto_url}
                      alt={c.full_name}
                      className="kru-row-avatar-img"
                    />
                  ) : (
                    <div className="kru-row-avatar-fallback">
                      {inits}
                    </div>
                  )}
                  <div className="kru-row-body">
                    <span className="kru-row-name">{c.full_name}</span>
                    <span className="kru-row-sub">
                      {c.position} &middot; {c.division} &bull; <span className="font-mono">{c.ptv_id}</span>
                    </span>
                  </div>
                </div>
                <span
                  className={`kru-row-badge ${c.status_kru === 'Aktif' ? 'is-active' : 'is-inactive'}`}
                >
                  {c.status_kru}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ));
  };

  // Helper render list anggota secara langsung (untuk Pengasuh, Pengarah, Pembina tanpa subkelompok angkatan)
  const renderDirectCrewList = (list: CrewMember[]) => {
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
          <i className="fa-solid fa-users-slash" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '13px' }}>Tidak ada data di kategori ini.</p>
        </div>
      );
    }

    return (
      <div className="kru-group-container">
        {list.map((c) => {
          const inits = c.full_name
            .split(' ')
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <button
              key={c.id}
              type="button"
              className="kru-row-item"
              onClick={() => setSelectedCrew(c)}
            >
              <div className="kru-row-left">
                {c.foto_url ? (
                  <img
                    src={c.foto_url}
                    alt={c.full_name}
                    className="kru-row-avatar-img"
                  />
                ) : (
                  <div className="kru-row-avatar-fallback">
                    {inits}
                  </div>
                )}
                <div className="kru-row-body">
                  <span className="kru-row-name">{c.full_name}</span>
                  <span className="kru-row-sub">
                    {c.position} &middot; {c.division} &bull; <span className="font-mono">{c.ptv_id}</span>
                  </span>
                </div>
              </div>
              <span
                className={`kru-row-badge ${c.status_kru === 'Aktif' ? 'is-active' : 'is-inactive'}`}
              >
                {c.status_kru}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (loading && members.length === 0) {
    return (
      <div style={{ maxWidth: '1060px', margin: '0 auto', width: '100%' }}>
        <PageHeaderSkeleton hasAction={canManage} />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error && members.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            padding: '28px',
            background: 'var(--surface)',
            border: '1px solid var(--dang-border)',
            borderRadius: 'var(--ptv-curve-xl)',
            boxShadow: 'var(--shadow-m)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--dang-bg)',
              color: 'var(--dang)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
            Gagal Memuat Data Kru
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
            {error}
          </p>
          <button
            type="button"
            className="btn sm pri"
            onClick={refreshCrew}
            style={{ minHeight: '40px', padding: '0 20px', borderRadius: 'var(--ptv-curve-pill)' }}
          >
            <i className="fa-solid fa-rotate-right" /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Standard R03 Page Header */}
      <header className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Manajemen Kru</h1>
          <p className="ptv-page-subtitle">
            Direktori pengurus, pengasuh, dewan pengarah, pembina, dan anggota kru aktif per angkatan.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => setIsLoginHistoryOpen(true)}
              title="Riwayat Login"
              hidden={!can('audit.logs.view')}
              style={{
                minHeight: '38px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontWeight: 600,
                fontSize: '12.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="fa-solid fa-clock-rotate-left" />
              <span>Riwayat Login</span>
            </button>
            <button
              type="button"
              className="btn sm pri"
              onClick={handleOpenAdd}
              style={{
                minHeight: '38px',
                padding: '0 16px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontWeight: 600,
                fontSize: '12.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="fa-solid fa-plus" />
              <span>Tambah Kru</span>
            </button>
          </div>
        )}
      </header>

      {/* Searchbar */}
      <div className="kk-searchbar" style={{ marginBottom: '14px' }}>
        <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Cari nama, ID PTV, username, jabatan, divisi..."
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

      {/* Header Row: Filter Tabs (Urutan: Kru Aktif -> Kru Nonaktif -> Pengasuh -> Pengarah -> Pembina -> Semua) */}
      <div className="kk-header-row">
        <div className="kk-filters-scroll">
          {(
            [
              ['Aktif', 'Kru Aktif', aktifTotal],
              ['Nonaktif', 'Kru Nonaktif', nonaktifTotal],
              ['Pengasuh', 'Pengasuh', pengasuhTotal],
              ['Pengarah', 'Pengarah', pengarahTotal],
              ['Pembina', 'Pembina', pembinaTotal],
              ['Semua', 'Semua', members.length],
            ] as const
          ).map(([k, label, count]) => (
            <button
              key={k}
              type="button"
              className={`kk-filter-pill ${activeTab === k ? 'active' : ''}`}
              onClick={() => setActiveTab(k)}
            >
              <span>{label}</span>
              <span className="cnt">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bento Stat Counters */}
      <div className="kk-stat-grid">
        <div className="kk-stat-card">
          <span className="num">{aktifTotal}</span>
          <span className="lbl">Kru Aktif</span>
        </div>
        <div className="kk-stat-card">
          <span className="num">{pengasuhTotal}</span>
          <span className="lbl">Pengasuh</span>
        </div>
        <div className="kk-stat-card">
          <span className="num">{pengarahTotal}</span>
          <span className="lbl">Pengarah</span>
        </div>
        <div className="kk-stat-card">
          <span className="num">{pembinaTotal}</span>
          <span className="lbl">Pembina</span>
        </div>
      </div>

      {/* Main Content Sections based on Filter */}
      <div style={{ marginTop: '20px' }}>
        {activeTab === 'Aktif' && (
          <div>
            <div className="kru-section-header" style={{ marginBottom: '10px' }}>
              <h2 className="kru-section-title">KRU AKTIF</h2>
              <span className="kru-section-count">
                {aktifCrew.length} Kru
              </span>
            </div>
            {renderAngkatanGroup(aktifCrew)}
          </div>
        )}

        {activeTab === 'Nonaktif' && (
          <div>
            <div className="kru-section-header" style={{ marginBottom: '10px' }}>
              <h2 className="kru-section-title">KRU NONAKTIF</h2>
              <span className="kru-section-count is-muted">
                {nonaktifCrew.length} Kru
              </span>
            </div>
            {renderAngkatanGroup(nonaktifCrew)}
          </div>
        )}

        {activeTab === 'Pengasuh' && (
          <div>
            <div className="kru-section-header" style={{ marginBottom: '10px' }}>
              <h2 className="kru-section-title">PENGASUH</h2>
            </div>
            {renderDirectCrewList(pengasuhCrew)}
          </div>
        )}

        {activeTab === 'Pengarah' && (
          <div>
            <div className="kru-section-header" style={{ marginBottom: '10px' }}>
              <h2 className="kru-section-title">PENGARAH</h2>
            </div>
            {renderDirectCrewList(pengarahCrew)}
          </div>
        )}

        {activeTab === 'Pembina' && (
          <div>
            <div className="kru-section-header" style={{ marginBottom: '10px' }}>
              <h2 className="kru-section-title">PEMBINA</h2>
            </div>
            {renderDirectCrewList(pembinaCrew)}
          </div>
        )}

        {activeTab === 'Semua' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* 1. PENGASUH */}
            {pengasuhCrew.length > 0 && (
              <div>
                <div className="kru-section-header" style={{ marginBottom: '10px' }}>
                  <h2 className="kru-section-title">PENGASUH</h2>
                </div>
                {renderDirectCrewList(pengasuhCrew)}
              </div>
            )}

            {/* 2. PENGARAH */}
            {pengarahCrew.length > 0 && (
              <div>
                <div className="kru-section-header" style={{ marginBottom: '10px' }}>
                  <h2 className="kru-section-title">PENGARAH</h2>
                </div>
                {renderDirectCrewList(pengarahCrew)}
              </div>
            )}

            {/* 3. PEMBINA */}
            {pembinaCrew.length > 0 && (
              <div>
                <div className="kru-section-header" style={{ marginBottom: '10px' }}>
                  <h2 className="kru-section-title">PEMBINA</h2>
                </div>
                {renderDirectCrewList(pembinaCrew)}
              </div>
            )}

            {/* 4. KRU AKTIF (Termasuk Ketua & Seluruh Pimpinan) */}
            {aktifCrew.length > 0 && (
              <div>
                <div className="kru-section-header" style={{ marginBottom: '10px' }}>
                  <h2 className="kru-section-title">KRU AKTIF</h2>
                  <span className="kru-section-count">
                    {aktifCrew.length} Kru
                  </span>
                </div>
                {renderAngkatanGroup(aktifCrew)}
              </div>
            )}

            {/* 5. KRU NONAKTIF */}
            {nonaktifCrew.length > 0 && (
              <div>
                <div className="kru-section-header" style={{ marginBottom: '10px' }}>
                  <h2 className="kru-section-title">KRU NONAKTIF</h2>
                  <span className="kru-section-count is-muted">
                    {nonaktifCrew.length} Kru
                  </span>
                </div>
                {renderAngkatanGroup(nonaktifCrew)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Detail Kru */}
      <KruDetailDrawer
        crew={selectedCrew}
        onClose={() => setSelectedCrew(null)}
        canManage={can('crew.edit')}
        canManageStatus={can('crew.status.manage')}
        canManageAccess={can('crew.permissions.manage')}
        isRoot={isRoot}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onToggleAccountStatus={handleToggleAccountStatus}
        onManagePermissions={(crew) => navigate(`/hub/akses?ptv=${encodeURIComponent(crew.ptv_id)}`)}
        onCrewUpdated={async (updated) => {
          await refreshCrew();
          setSelectedCrew(updated);
        }}
      />

      {/* Modal Form Tambah / Edit */}
      <KruFormModal
        isOpen={isFormOpen}
        isEdit={Boolean(editingCrew)}
        initialData={editingCrew}
        suggestedPtvId={getSuggestedNextPtvId()}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveForm}
      />

      {isLoginHistoryOpen && (
        <div
          className="kk-drawer-overlay"
          onClick={() => setIsLoginHistoryOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loginHistoryModalTitle"
        >
          <div
            ref={loginHistoryModalRef}
            tabIndex={-1}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '24px',
              maxWidth: '520px',
              width: '92%',
              margin: 'auto',
              boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-2)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 id="loginHistoryModalTitle" style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--b-600)' }} />
                Riwayat Login Terakhir
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsLoginHistoryOpen(false)}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                <i
                  className="fa-solid fa-spinner fa-spin"
                  style={{ fontSize: '24px', color: 'var(--b-600)', marginBottom: '8px' }}
                />
                <p style={{ margin: 0, fontSize: '13px' }}>Memuat riwayat login...</p>
              </div>
            ) : loginHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                <i
                  className="fa-solid fa-clock-rotate-left"
                  style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.35 }}
                />
                <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  Belum Ada Riwayat Login
                </h4>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
                  Belum ada riwayat aktivitas login yang tercatat untuk personel ini.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loginHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--ptv-curve-sm)',
                      background: 'var(--surface-sunken, #f8fafc)',
                      border: '1px solid var(--line-2)',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b>{item.ptv_id || item.username || 'Kru'}</b>
                      <span
                        style={{
                          fontSize: '10.5px',
                          color: item.status === 'success' || item.status === 'Berhasil' ? 'var(--ok)' : 'var(--warn)',
                          fontWeight: 600,
                        }}
                      >
                        {item.status || 'Tercatat'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                      @{item.username} &bull; {new Date(item.login_at).toLocaleString('id-ID')}
                    </div>
                    {item.ip_address && (
                      <div style={{ fontSize: '10.5px', color: 'var(--ink-2)', marginTop: '2px', fontFamily: 'monospace' }}>
                        IP: {item.ip_address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
