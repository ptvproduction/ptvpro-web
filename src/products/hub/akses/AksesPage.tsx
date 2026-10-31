import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import type { AccessProfile, AppCapability } from '@core/policy';
import { Card, TableSkeleton, showToast } from '@shared/components';
import { useCrewStore } from '../kru/kruStore';
import { ManagePermissionsModal } from '../kru/components/ManagePermissionsModal';
import { MODULE_CAPABILITY_GROUPS } from '../kru/utils/crewPermissions';
import type { CrewMember } from '../kru/types';
import type { AccessAccount, AccessSnapshot, PositionCapabilityMapping } from './accessContract';
import { PositionMappingTab } from './PositionMappingTab';
import { AccessAuditHistoryTab } from './AccessAuditHistoryTab';
import './akses.css';

async function requestAccess(body?: unknown): Promise<AccessSnapshot> {
  const res = await fetch('/api/akses', {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat Manajemen Akun.');
  return data;
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AksesPage() {
  const { user, can } = useSessionStore();
  const { members: crewMembers } = useCrewStore();
  const [params] = useSearchParams();

  // Active Tab: 'accounts' | 'mappings' | 'history'
  const [activeTab, setActiveTab] = useState<'accounts' | 'mappings' | 'history'>('accounts');
  // Account Status Filter: 'all' | 'active' | 'inactive'
  const [accountFilter, setAccountFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [data, setData] = useState<AccessSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(params.get('ptv') || '');
  const [selected, setSelected] = useState<AccessAccount | null>(null);
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  const authorized = can('crew.permissions.manage');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setLoading(true);
    if (!authorized) {
      setLoading(false);
      return;
    }
    requestAccess()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorized, user?.id, retry]);

  const grants = useMemo(() => {
    const map: Record<string, Set<AppCapability>> = {};
    for (const row of data?.grants || []) {
      (map[row.profile_id] ||= new Set()).add(row.capability_key as AppCapability);
    }
    return map;
  }, [data]);

  const crew: CrewMember | null = selected
    ? {
        id: selected.id,
        ptv_id: selected.ptvId,
        full_name: selected.name,
        username: selected.username,
        role: 'kru',
        category: 'Kru',
        division: selected.division || '',
        position: selected.position || '',
        angkatan: '',
        status_kru: selected.organizationStatus === 'active' ? 'Aktif' : 'Nonaktif',
        status_akun: selected.status === 'active' ? 'Aktif' : 'Nonaktif',
        assigned_profiles: selected.profiles as AccessProfile[],
        allowed_overrides: selected.allowed as AppCapability[],
        denied_overrides: selected.denied as AppCapability[],
      }
    : null;

  const crewMap = useMemo(() => {
    const map = new Map<string, CrewMember>();
    for (const c of crewMembers) {
      if (c.ptv_id) map.set(c.ptv_id, c);
      if (c.id) map.set(c.id, c);
    }
    return map;
  }, [crewMembers]);

  const filteredAccounts = useMemo(() => {
    if (!data?.accounts) return [];
    let list = data.accounts;

    if (accountFilter === 'active') {
      list = list.filter((a) => a.status === 'active');
    } else if (accountFilter === 'inactive') {
      list = list.filter((a) => a.status === 'inactive');
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const matchText = `${a.name} ${a.ptvId || ''} ${a.username} ${a.position || ''}`.toLowerCase();
      return matchText.includes(q);
    });
  }, [data, accountFilter, query]);

  const handleSavePositionMappings = async (updatedMappings: PositionCapabilityMapping[]) => {
    setIsSavingMapping(true);
    try {
      const res = await fetch('/api/akses?action=save_position_mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ mappings: updatedMappings }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan mapping jabatan.');
      // Refresh local data & update current snapshot
      if (resData.positionMappings && data) {
        setData({
          ...data,
          positionMappings: resData.positionMappings,
        });
      } else {
        setRetry((v) => v + 1);
      }
      showToast('Pemetaan jabatan dan izin berhasil diperbarui di Staging.');
    } finally {
      setIsSavingMapping(false);
    }
  };

  if (!authorized) {
    return (
      <Card standard="r03">
        <p role="alert">Anda tidak memiliki izin mengelola akun dan hak akses sistem.</p>
      </Card>
    );
  }

  return (
    <div className="access-page">
      {/* R03 Page Header */}
      <header className="access-heading ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Manajemen Akun</h1>
          <p className="ptv-page-subtitle">
            Kelola akun portal login kru, hak akses organisasi berbasis jabatan, izin khusus granular, dan keamanan sistem.
          </p>
        </div>
        <button
          type="button"
          className="access-refresh-btn"
          onClick={() => setRetry((v) => v + 1)}
          disabled={loading}
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`} />
          <span>Muat ulang</span>
        </button>
      </header>

      {/* Segmented Control Tabs */}
      <div className="access-tabs-bar">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`access-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-users-gear" />
          <span className="access-tab-label-full">Daftar Akun Kru</span>
          <span className="access-tab-label-short">Akun</span>
          {data?.accounts && (
            <span className="access-tab-counter">
              {data.accounts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mappings')}
          className={`access-tab-btn ${activeTab === 'mappings' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-sitemap" />
          <span className="access-tab-label-full">Mapping Jabatan & Izin</span>
          <span className="access-tab-label-short">Jabatan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`access-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-clock-rotate-left" />
          <span className="access-tab-label-full">Riwayat Perubahan Akses</span>
          <span className="access-tab-label-short">Riwayat</span>
          {data?.history && (
            <span className="access-tab-counter">
              {data.history.length}
            </span>
          )}
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && !data ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className="access-state-card is-error" role="alert">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>{error}</span>
        </div>
      ) : activeTab === 'mappings' ? (
        <PositionMappingTab
          mappings={data?.positionMappings || []}
          onSaveMappings={handleSavePositionMappings}
          isSaving={isSavingMapping}
        />
      ) : activeTab === 'history' ? (
        <AccessAuditHistoryTab
          history={data?.history || []}
          canViewHistory={data?.canViewHistory ?? true}
        />
      ) : (
        /* Tab: Accounts List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Searchbar and filter pills */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Search Input */}
            <div className="access-searchbar" style={{ flex: '1 1 320px', maxWidth: '480px' }}>
              <i className="fa-solid fa-magnifying-glass access-search-icon" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama kru, ID PTV, username, atau jabatan..."
                aria-label="Cari akun"
              />
              {query && (
                <button
                  type="button"
                  className="access-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Bersihkan pencarian"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            {/* Filter Status Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {[
                { id: 'all', label: 'Semua Status' },
                { id: 'active', label: 'Akun Aktif' },
                { id: 'inactive', label: 'Akun Nonaktif' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setAccountFilter(pill.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: accountFilter === pill.id ? 'var(--b-600, #2563eb)' : 'var(--surface, #ffffff)',
                    color: accountFilter === pill.id ? '#ffffff' : 'var(--ink-2)',
                    boxShadow: accountFilter === pill.id ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: accountFilter === pill.id ? 'transparent' : 'var(--line, rgba(11, 42, 74, 0.12))',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account Rows Card */}
          <div className="access-list-card">
            <div className="access-list-header">
              <span className="access-list-title">Daftar Akun Pengguna</span>
              <span className="access-list-count">{filteredAccounts.length} akun</span>
            </div>

            <div className="access-list">
              {filteredAccounts.map((a) => {
                const isSelf = a.id === user?.id;
                const isTargetRoot = a.profiles.includes('root_executive');
                const isAccountActive = a.status === 'active';
                const overrideCount = (a.allowed?.length || 0) + (a.denied?.length || 0);
                const displayName = a.name || a.username;
                const matchedCrew = (a.ptvId ? crewMap.get(a.ptvId) : null) || crewMap.get(a.id);
                const photoUrl = matchedCrew?.foto_url || null;
                const positionDisplay = a.position || matchedCrew?.position || 'Anggota Kru';

                return (
                  <div className={`access-row ${!isAccountActive ? 'is-inactive' : ''}`} key={a.id}>
                    <div className="access-row-main">
                      <div className={`access-avatar ${isTargetRoot ? 'is-root' : !isAccountActive ? 'is-muted' : ''}`}>
                        {photoUrl ? (
                          <img src={photoUrl} alt={displayName} className="access-avatar-img" />
                        ) : (
                          getInitials(displayName)
                        )}
                      </div>
                      <div className="access-row-body">
                        <div className="access-name-line">
                          <strong className="access-name">{displayName}</strong>
                          <span className={`access-status-pill ${isAccountActive ? 'is-active' : 'is-inactive'}`}>
                            <span className="access-status-dot" />
                            {isAccountActive ? 'Akun Aktif' : 'Akun Nonaktif'}
                          </span>
                        </div>

                        {/* Position & Username */}
                        <div className="access-meta-line" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--b-700, #1d4ed8)', fontSize: '12px' }}>
                            {positionDisplay}
                          </span>
                          <span className="access-meta-sep">·</span>
                          {a.ptvId && <span className="access-ptv-id">{a.ptvId}</span>}
                          {a.ptvId && <span className="access-meta-sep">·</span>}
                          <span className="access-username">@{a.username}</span>
                        </div>

                        {/* Profiles & Overrides */}
                        <div className="access-profiles-line">
                          {a.profiles.length > 0 ? (
                            a.profiles.map((id) => {
                              const pName = data?.profiles.find((p) => p.id === id)?.name || id;
                              return (
                                <span
                                  key={id}
                                  className={`access-profile-chip ${id === 'root_executive' ? 'is-root' : ''}`}
                                >
                                  {pName}
                                </span>
                              );
                            })
                          ) : (
                            <span className="access-profile-chip is-empty">Tanpa profil</span>
                          )}
                          {overrideCount > 0 && (
                            <span className="access-override-chip">+{overrideCount} izin khusus</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="access-row-action" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Kelola Hak Akses */}
                      <button
                        type="button"
                        className={`access-manage-btn ${isSelf || isTargetRoot ? 'is-disabled' : ''}`}
                        disabled={isSelf || isTargetRoot}
                        onClick={() => setSelected(a)}
                      >
                        <i
                          className={`fa-solid ${
                            isSelf ? 'fa-user-check' : isTargetRoot ? 'fa-lock' : 'fa-sliders'
                          }`}
                        />
                        <span>
                          {isSelf ? 'Akun Anda' : isTargetRoot ? 'Root Dilindungi' : 'Kelola Akses'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {data && filteredAccounts.length === 0 && (
                <div className="access-empty">Tidak ada akun yang sesuai kriteria pencarian.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola Hak Akses Granular */}
      <ManagePermissionsModal
        key={selected?.id || 'closed'}
        isOpen={Boolean(selected)}
        crew={crew}
        currentUserId={user?.id}
        profileCatalog={data?.profiles as { id: AccessProfile; name: string }[]}
        profileGrants={grants}
        capabilityGroups={MODULE_CAPABILITY_GROUPS}
        onClose={() => setSelected(null)}
        onSave={async (id, updates) => {
          if (!selected) return;
          await requestAccess({
            accountId: id,
            expectedVersion: selected.version,
            profiles: updates.assigned_profiles,
            allowed: updates.allowed_overrides,
            denied: updates.denied_overrides,
            status: selected.status,
            reason: updates.reason,
            confirmed: updates.confirmed,
          });
          setRetry((v) => v + 1);
          setSelected(null);
          showToast(`Hak akses untuk ${selected.name} berhasil diperbarui di Staging.`);
        }}
      />
    </div>
  );
}
