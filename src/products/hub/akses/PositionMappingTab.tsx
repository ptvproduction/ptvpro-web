import React, { useState, useMemo } from 'react';
import { PositionCapabilityMapping } from './accessContract';
import { MODULE_CAPABILITY_GROUPS } from '../kru/utils/crewPermissions';
import { showToast } from '@shared/components';

interface PositionMappingTabProps {
  mappings: PositionCapabilityMapping[];
  onSaveMappings: (updatedMappings: PositionCapabilityMapping[]) => Promise<void>;
  isSaving: boolean;
}

function normalizePositionMappings(input: any): PositionCapabilityMapping[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((item) => item && typeof item.position === 'string');
  }
  if (typeof input === 'object') {
    return Object.entries(input).map(([pos, caps]) => ({
      position: pos,
      capabilities: Array.isArray(caps) ? caps : [],
      description: `Izin bawaan untuk jabatan ${pos}`,
    }));
  }
  return [];
}

export const PositionMappingTab: React.FC<PositionMappingTabProps> = ({
  mappings,
  onSaveMappings,
  isSaving,
}) => {
  const safeInitialMappings = useMemo(() => normalizePositionMappings(mappings), [mappings]);

  // Current selected position
  const [selectedPosition, setSelectedPosition] = useState<string>(
    safeInitialMappings[0]?.position || 'Ketua Umum'
  );
  // Mobile step state: 'picker' (list of positions) or 'details' (permissions checklist)
  const [mobileView, setMobileView] = useState<'picker' | 'details'>('details');

  // Search filter for permissions
  const [searchQuery, setSearchQuery] = useState('');
  // Local state copy of mappings for live editing
  const [localMappings, setLocalMappings] = useState<PositionCapabilityMapping[]>(safeInitialMappings);

  // Sync if prop mappings change externally
  React.useEffect(() => {
    const normalized = normalizePositionMappings(mappings);
    setLocalMappings(normalized);
    if ((!selectedPosition || !normalized.some((m) => m.position === selectedPosition)) && normalized.length > 0) {
      setSelectedPosition(normalized[0].position);
    }
  }, [mappings]);

  const activeMapping = useMemo(() => {
    const list = Array.isArray(localMappings) ? localMappings : [];
    return (
      list.find((m) => m && m.position === selectedPosition) || {
        position: selectedPosition,
        capabilities: [],
        description: `Izin bawaan untuk jabatan ${selectedPosition}`,
      }
    );
  }, [localMappings, selectedPosition]);

  const activeCapabilitySet = useMemo(() => {
    return new Set(activeMapping.capabilities || []);
  }, [activeMapping]);

  const handleSelectPosition = (pos: string) => {
    setSelectedPosition(pos);
    setMobileView('details'); // On mobile, automatically show the permissions editor
  };

  const handleToggleCapability = (capKey: string) => {
    const nextSet = new Set(activeCapabilitySet);
    if (nextSet.has(capKey)) {
      nextSet.delete(capKey);
    } else {
      nextSet.add(capKey);
    }

    const currentList = Array.isArray(localMappings) ? localMappings : [];
    const updated = currentList.map((m) => {
      if (m.position === selectedPosition) {
        return {
          ...m,
          capabilities: Array.from(nextSet),
          updated_at: new Date().toISOString(),
        };
      }
      return m;
    });

    if (!currentList.some((m) => m.position === selectedPosition)) {
      updated.push({
        position: selectedPosition,
        capabilities: Array.from(nextSet),
        description: `Izin bawaan untuk jabatan ${selectedPosition}`,
        updated_at: new Date().toISOString(),
      });
    }

    setLocalMappings(updated);
  };

  const handleToggleModuleAll = (moduleCapKeys: string[]) => {
    const nextSet = new Set(activeCapabilitySet);
    const allSelected = moduleCapKeys.every((k) => nextSet.has(k));

    if (allSelected) {
      moduleCapKeys.forEach((k) => nextSet.delete(k));
    } else {
      moduleCapKeys.forEach((k) => nextSet.add(k));
    }

    const currentList = Array.isArray(localMappings) ? localMappings : [];
    const updated = currentList.map((m) => {
      if (m.position === selectedPosition) {
        return {
          ...m,
          capabilities: Array.from(nextSet),
          updated_at: new Date().toISOString(),
        };
      }
      return m;
    });

    if (!currentList.some((m) => m.position === selectedPosition)) {
      updated.push({
        position: selectedPosition,
        capabilities: Array.from(nextSet),
        description: `Izin bawaan untuk jabatan ${selectedPosition}`,
        updated_at: new Date().toISOString(),
      });
    }

    setLocalMappings(updated);
  };

  const handleSave = async () => {
    try {
      await onSaveMappings(localMappings);
      showToast(`Mapping izin untuk ${selectedPosition} berhasil disimpan ke Staging.`);
    } catch (err: any) {
      showToast({ title: 'Gagal Menyimpan', desc: err.message, icon: 'alert' });
    }
  };

  // Filter modules and capabilities based on search
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MODULE_CAPABILITY_GROUPS;

    return MODULE_CAPABILITY_GROUPS.map((group) => {
      const matchedCaps = group.capabilities.filter((c) => {
        return (
          c.actionLabel.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.capability.toLowerCase().includes(q)
        );
      });
      return {
        ...group,
        capabilities: matchedCaps,
      };
    }).filter((group) => group.capabilities.length > 0);
  }, [searchQuery]);

  return (
    <div className="position-mapping-container">
      {/* Header bar / description */}
      <div className="position-mapping-header-card">
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
            <i className="fa-solid fa-sitemap" style={{ marginRight: '8px', color: 'var(--b-600, #2563eb)' }} />
            Konfigurasi Izin Berbasis Jabatan Organisasi
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
            Setiap kru yang menjabat otomatis mendapatkan izin dasar di bawah ini. Ketika jabatan berganti di Manajemen Kru, izin lama otomatis dicabut dan izin baru diterapkan secara real-time.
          </p>
        </div>

        <button
          type="button"
          className="btn sm pri position-mapping-save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk" />
              <span>Simpan Mapping</span>
            </>
          )}
        </button>
      </div>

      {/* Mobile Step Switcher Bar (Tampil hanya di layar kecil / mobile) */}
      <div className="position-mapping-mobile-nav">
        <button
          type="button"
          className={`position-mapping-mobile-tab-btn ${mobileView === 'picker' ? 'is-active' : ''}`}
          onClick={() => setMobileView('picker')}
        >
          <i className="fa-solid fa-user-tag" />
          <span>Pilih Jabatan</span>
        </button>
        <button
          type="button"
          className={`position-mapping-mobile-tab-btn ${mobileView === 'details' ? 'is-active' : ''}`}
          onClick={() => setMobileView('details')}
        >
          <i className="fa-solid fa-sliders" />
          <span>Izin: {selectedPosition}</span>
        </button>
      </div>

      {/* Main mapping layout: Desktop 2-column grid, Mobile responsive step view */}
      <div className="position-mapping-grid">
        {/* Left Column: List of positions */}
        <div
          className={`position-mapping-col-left ${mobileView === 'picker' ? 'mobile-show' : 'mobile-hide'}`}
        >
          <div style={{ padding: '4px 8px 8px', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
            Daftar Jabatan ({(Array.isArray(localMappings) ? localMappings : []).length})
          </div>

          {(Array.isArray(localMappings) ? localMappings : []).map((m) => {
            if (!m || !m.position) return null;
            const isSelected = m.position === selectedPosition;
            const capCount = Array.isArray(m.capabilities) ? m.capabilities.length : 0;

            return (
              <button
                key={m.position}
                type="button"
                onClick={() => handleSelectPosition(m.position)}
                className={`position-mapping-item-btn ${isSelected ? 'is-selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <i
                    className="fa-solid fa-user-tag"
                    style={{
                      fontSize: '12px',
                      color: isSelected ? 'var(--b-600)' : 'var(--muted)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.position}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                    background: isSelected ? 'var(--b-500)' : 'var(--line-2, rgba(11, 42, 74, 0.08))',
                    color: isSelected ? '#ffffff' : 'var(--muted)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {capCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Column: Capabilities Search & Checklist */}
        <div
          className={`position-mapping-col-right ${mobileView === 'details' ? 'mobile-show' : 'mobile-hide'}`}
        >
          {/* Active position summary + search bar */}
          <div className="position-mapping-active-bar">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                  {selectedPosition}
                </h3>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                    background: 'rgba(59, 142, 247, 0.1)',
                    color: 'var(--b-700, #1d4ed8)',
                  }}
                >
                  {activeMapping.capabilities.length} Izin Aktif
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                {activeMapping.description || `Izin bawaan untuk ${selectedPosition}`}
              </p>
            </div>

            {/* Search capability */}
            <div className="position-mapping-searchbar">
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)', fontSize: '12px' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari izin / modul / kode..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {/* Module capability checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            {filteredGroups.map((group) => {
              const groupCapKeys = group.capabilities.map((c) => c.capability);
              const groupSelectedCount = groupCapKeys.filter((k) => activeCapabilitySet.has(k)).length;
              const isAllSelected = groupCapKeys.length > 0 && groupSelectedCount === groupCapKeys.length;

              return (
                <div key={group.moduleId} className="position-mapping-module-card">
                  {/* Module header */}
                  <div className="position-mapping-module-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                      <i className={group.icon} style={{ color: 'var(--b-600, #2563eb)', fontSize: '14px' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                        {group.moduleName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                        ({groupSelectedCount}/{groupCapKeys.length})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleModuleAll(groupCapKeys)}
                      className="position-mapping-module-toggle-btn"
                    >
                      {isAllSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  </div>

                  {/* Capabilities list */}
                  <div className="position-mapping-caps-grid">
                    {group.capabilities.map((c) => {
                      const isChecked = activeCapabilitySet.has(c.capability);

                      return (
                        <label
                          key={c.capability}
                          className={`position-mapping-cap-item ${isChecked ? 'is-checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCapability(c.capability)}
                            style={{
                              marginTop: '3px',
                              accentColor: 'var(--b-600, #2563eb)',
                              cursor: 'pointer',
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
                              {c.actionLabel}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.3 }}>
                              {c.description}
                            </div>
                            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-2)', opacity: 0.6, marginTop: '2px', wordBreak: 'break-all' }}>
                              {c.capability}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredGroups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '13px' }}>
                Tidak ada izin yang sesuai kata kunci pencarian "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
