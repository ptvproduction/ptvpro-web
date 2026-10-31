import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CrewMember } from '../types';
import { AccessProfile, AppCapability, PROFILE_CAPABILITIES } from '@core/policy';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import {
  MODULE_CAPABILITY_GROUPS,
  mapRoleToAccessProfile,
  mapAccessProfileToRole,
  getAccessProfileSummary,
} from '../utils/crewPermissions';

interface ManagePermissionsModalProps {
  isOpen?: boolean;
  crew: CrewMember | null;
  currentUserId?: string;
  onClose: () => void;
  profileCatalog?: { id: AccessProfile; name: string }[];
  profileGrants?: Record<string, ReadonlySet<AppCapability>>;
  capabilityGroups?: typeof MODULE_CAPABILITY_GROUPS;
  onSave: (
    crewId: string,
    updates: {
      assigned_profiles: readonly AccessProfile[];
      allowed_overrides: readonly AppCapability[];
      denied_overrides: readonly AppCapability[];
      role: CrewMember['role'];
      status?: 'active' | 'inactive';
      reason?: string;
      confirmed?: boolean;
    }
  ) => void | Promise<void>;
}

export const ManagePermissionsModal: React.FC<ManagePermissionsModalProps> = ({
  isOpen = true,
  crew,
  currentUserId,
  onClose,
  onSave,
  profileCatalog,
  profileGrants,
  capabilityGroups,
}) => {
  const [saving, setSaving] = useState(false);
  const closeWhenIdle = () => {
    if (!saving) onClose();
  };
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(isOpen && crew),
    onClose: closeWhenIdle,
    modalRef,
  });

  const initialProfile: AccessProfile = useMemo(() => {
    if (!crew) return 'crew';
    if (crew.assigned_profiles && crew.assigned_profiles.length > 0) {
      return crew.assigned_profiles[0];
    }
    return mapRoleToAccessProfile(crew.role);
  }, [crew]);

  const [selectedProfile, setSelectedProfile] = useState<AccessProfile>(initialProfile);
  const [allowedOverrides, setAllowedOverrides] = useState<AppCapability[]>(() =>
    crew?.allowed_overrides ? [...crew.allowed_overrides] : []
  );
  const [deniedOverrides, setDeniedOverrides] = useState<AppCapability[]>(() =>
    crew?.denied_overrides ? [...crew.denied_overrides] : []
  );
  const [activeTab, setActiveTab] = useState<'profile' | 'modules' | 'summary'>('profile');
  const [confirmEscalation, setConfirmEscalation] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>(
    crew?.status_akun === 'Aktif' ? 'active' : 'inactive'
  );

  React.useEffect(() => {
    if (crew) {
      const p =
        crew.assigned_profiles && crew.assigned_profiles.length > 0
          ? crew.assigned_profiles[0]
          : mapRoleToAccessProfile(crew.role);
      setSelectedProfile(p);
      setAllowedOverrides(crew.allowed_overrides ? [...crew.allowed_overrides] : []);
      setDeniedOverrides(crew.denied_overrides ? [...crew.denied_overrides] : []);
      setActiveTab('profile');
      setConfirmEscalation(false);
      setSaveError('');
      setReason('');
      setStatus(crew.status_akun === 'Aktif' ? 'active' : 'inactive');
    }
  }, [crew]);

  if (!crew) return null;

  const isSelf = currentUserId && (currentUserId === crew.id || currentUserId === crew.ptv_id);

  const AVAILABLE_PROFILES: AccessProfile[] = profileCatalog
    ? profileCatalog.map((p) => p.id).filter((p) => p !== 'root_executive')
    : ['eksekutif', 'kepolo_kepali', 'crew', 'pembina'];

  const profileCaps = profileGrants || PROFILE_CAPABILITIES;
  const baseProfileCaps = profileCaps[selectedProfile] || new Set<AppCapability>();
  const retainedProfiles = (crew.assigned_profiles || []).slice(1);
  const effective = (
    profiles: readonly AccessProfile[],
    allow: readonly AppCapability[],
    deny: readonly AppCapability[]
  ) => {
    const caps = new Set<AppCapability>(allow);
    for (const profile of profiles) for (const cap of profileCaps[profile] || []) caps.add(cap);
    for (const cap of deny) caps.delete(cap);
    return caps;
  };
  const beforeCaps = effective(
    crew.assigned_profiles || [initialProfile],
    crew.allowed_overrides || [],
    crew.denied_overrides || []
  );
  const nextCaps = effective([selectedProfile, ...retainedProfiles], allowedOverrides, deniedOverrides);

  const getCapabilityOverrideStatus = (cap: AppCapability): 'default' | 'allow' | 'deny' => {
    if (deniedOverrides.includes(cap)) return 'deny';
    if (allowedOverrides.includes(cap)) return 'allow';
    return 'default';
  };

  const setCapabilityOverride = (cap: AppCapability, mode: 'default' | 'allow' | 'deny') => {
    setConfirmEscalation(false);
    setAllowedOverrides((prev) => prev.filter((c) => c !== cap));
    setDeniedOverrides((prev) => prev.filter((c) => c !== cap));

    if (mode === 'allow') {
      setAllowedOverrides((prev) => [...prev, cap]);
    } else if (mode === 'deny') {
      setDeniedOverrides((prev) => [...prev, cap]);
    }
  };

  const isProfileChanged = selectedProfile !== initialProfile;
  const isEscalation = [...nextCaps].some((cap) => !beforeCaps.has(cap));

  const handleSave = async () => {
    if (isSelf || saving) return;
    if (!confirmEscalation || reason.trim().length < 5) {
      setActiveTab('summary');
      setSaveError('Isi alasan minimal 5 karakter dan konfirmasi perubahan.');
      return;
    }
    setSaving(false);
    setSaving(true);
    setSaveError('');
    try {
      await onSave(crew.id, {
        assigned_profiles: [...new Set([selectedProfile, ...retainedProfiles])],
        allowed_overrides: allowedOverrides,
        denied_overrides: deniedOverrides,
        role: mapAccessProfileToRole(selectedProfile),
        status,
        reason: reason.trim(),
        confirmed: true,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Gagal menyimpan akses.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !crew) return null;

  const modalContent = (
    <div
      className="kk-drawer-overlay"
      onClick={closeWhenIdle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="managePermissionsModalTitle"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--ptv-curve-2xl, 22px)',
          maxWidth: '620px',
          width: '100%',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 20px',
            borderBottom: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <div>
            <h2
              id="managePermissionsModalTitle"
              style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em' }}
            >
              Kelola Hak Akses: {crew.full_name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {crew.ptv_id} &bull; @{crew.username || 'tanpa_username'}
              {crew.position ? <> &bull; {crew.position}</> : null}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeWhenIdle}
            aria-label="Tutup"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Proteksi Self Escalation Warning */}
        {isSelf && (
          <div
            style={{
              flexShrink: 0,
              padding: '10px 20px',
              background: 'var(--dang-bg)',
              color: 'var(--dang)',
              fontSize: '12.5px',
              borderBottom: '1px solid var(--dang-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fa-solid fa-shield-halved" />
            <span>
              <b>Proteksi Fail-Closed:</b> Anda tidak dapat mengubah role atau permission Anda sendiri (No Self-Escalation).
            </span>
          </div>
        )}

        {/* Navigasi Tab Segmented R03 */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            borderBottom: '1px solid var(--line-2)',
            background: 'var(--surface)',
            padding: '8px 16px',
            overflowX: 'auto',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {[
            { id: 'profile', label: '1. Profil Akses', icon: 'fa-solid fa-user-shield' },
            { id: 'modules', label: '2. Izin Granular', icon: 'fa-solid fa-list-check' },
            { id: 'summary', label: '3. Ringkasan & Simpan', icon: 'fa-solid fa-clipboard-check' },
          ].map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  minHeight: '34px',
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: 'var(--ptv-curve-pill, 9999px)',
                  background: isTabActive ? 'var(--surface)' : 'transparent',
                  fontSize: '12.5px',
                  fontWeight: isTabActive ? 600 : 500,
                  color: isTabActive ? 'var(--b-700, #0B5FBF)' : 'var(--ink-2)',
                  boxShadow: isTabActive ? '0 1px 3px rgba(11, 42, 74, 0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <i className={tab.icon} style={{ fontSize: '12px' }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '18px 20px' }}>
          {/* TAB 1: PROFIL AKSES UTAMA */}
          {activeTab === 'profile' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.45 }}>
                Pilih profil hak akses kanonik untuk menentukan bundel perizinan dasar pengguna sesuai standar RBAC PTV PRO:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {AVAILABLE_PROFILES.map((p) => {
                  const summary = getAccessProfileSummary(p);
                  const isSelected = selectedProfile === p;

                  return (
                    <div
                      key={p}
                      onClick={() => {
                        setSelectedProfile(p);
                        setConfirmEscalation(false);
                      }}
                      style={{
                        padding: '13px 16px',
                        borderRadius: 'var(--ptv-curve-lg, 16px)',
                        border: `1.5px solid ${isSelected ? 'var(--b-600)' : 'var(--line)'}`,
                        background: isSelected ? 'var(--b-050)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <input
                        type="radio"
                        name="accessProfile"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedProfile(p);
                          setConfirmEscalation(false);
                        }}
                        style={{ marginTop: '3px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '3px',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: isSelected ? 'var(--b-700)' : 'var(--ink)',
                            }}
                          >
                            {summary.label}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--ptv-curve-pill)',
                              background: isSelected ? 'var(--b-600)' : 'var(--bg-2)',
                              color: isSelected ? '#ffffff' : 'var(--muted)',
                            }}
                          >
                            {profileGrants ? profileGrants[p]?.size || 0 : summary.defaultCapabilityCount} Izin Bawaan
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                          {summary.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: '16px',
                  padding: '11px 14px',
                  borderRadius: 'var(--ptv-curve-md)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  lineHeight: 1.45,
                }}
              >
                <i className="fa-solid fa-circle-info" style={{ marginRight: '6px', color: 'var(--b-600)' }} />
                Profil akses menentukan kapabilitas awal. Anda dapat memberikan izin khusus tambahan (allow override) atau mencabut izin spesifik (deny override) pada tab berikutnya.
              </div>
            </div>
          )}

          {/* TAB 2: IZIN MODUL GRANULAR */}
          {activeTab === 'modules' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.45 }}>
                Sesuaikan izin tindakan secara granular. Aturan Deny Override memiliki prioritas tertinggi di atas profil bawaan.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(capabilityGroups || MODULE_CAPABILITY_GROUPS).map((group) => {
                  return (
                    <div
                      key={group.moduleId}
                      style={{
                        borderRadius: 'var(--ptv-curve-lg, 16px)',
                        border: '1px solid var(--line)',
                        overflow: 'hidden',
                        background: 'var(--surface)',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 16px',
                          background: 'var(--bg, #f8fafc)',
                          borderBottom: '1px solid var(--line-2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <i className={group.icon} style={{ color: 'var(--b-600)', fontSize: '13px' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                          {group.moduleName}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {group.capabilities.map((cap) => {
                          const status = getCapabilityOverrideStatus(cap.capability);
                          const isBaseAllowed = baseProfileCaps.has(cap.capability);
                          const isEffective =
                            status === 'deny' ? false : status === 'allow' ? true : isBaseAllowed;

                          return (
                            <div
                              key={cap.capability}
                              style={{
                                padding: '10px 16px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--line-2)',
                                gap: '12px',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                                    {cap.actionLabel}
                                  </span>
                                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                    ({cap.capability})
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      padding: '1px 7px',
                                      borderRadius: 'var(--ptv-curve-pill)',
                                      background: isEffective ? 'var(--ok-bg)' : 'var(--bg-2)',
                                      color: isEffective ? 'var(--ok)' : 'var(--muted)',
                                    }}
                                  >
                                    {isEffective ? 'Aktif' : 'Off'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {cap.description}
                                </div>
                              </div>

                              {/* Toggle 3 Pilihan: Default, Allow, Deny */}
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: 'var(--bg-2, #f1f5f9)',
                                  border: '1px solid var(--line-2)',
                                  borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                  padding: '2px',
                                  gap: '2px',
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setCapabilityOverride(cap.capability, 'default')}
                                  style={{
                                    padding: '4px 9px',
                                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                    fontSize: '11px',
                                    fontWeight: status === 'default' ? 600 : 500,
                                    border: 'none',
                                    background: status === 'default' ? 'var(--surface)' : 'transparent',
                                    color: status === 'default' ? 'var(--ink)' : 'var(--muted)',
                                    boxShadow: status === 'default' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={`Bawaan profil (${isBaseAllowed ? 'Aktif' : 'Nonaktif'})`}
                                >
                                  Default
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCapabilityOverride(cap.capability, 'allow')}
                                  style={{
                                    padding: '4px 9px',
                                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                    fontSize: '11px',
                                    fontWeight: status === 'allow' ? 600 : 500,
                                    border: 'none',
                                    background: status === 'allow' ? 'var(--ok-bg)' : 'transparent',
                                    color: status === 'allow' ? 'var(--ok)' : 'var(--muted)',
                                    boxShadow: status === 'allow' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Paksa Izinkan"
                                >
                                  + Izinkan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCapabilityOverride(cap.capability, 'deny')}
                                  style={{
                                    padding: '4px 9px',
                                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                    fontSize: '11px',
                                    fontWeight: status === 'deny' ? 600 : 500,
                                    border: 'none',
                                    background: status === 'deny' ? 'var(--dang-bg)' : 'transparent',
                                    color: status === 'deny' ? 'var(--dang)' : 'var(--muted)',
                                    boxShadow: status === 'deny' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Paksa Tolak (Deny Override)"
                                >
                                  &times; Tolak
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RINGKASAN PERUBAHAN & KONFIRMASI */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Informasi Status Akun (Read-Only) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  background: 'var(--surface-sunken, #f8fafc)',
                  border: '1px solid var(--line-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Status Akun Portal
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {crew.status_akun === 'Aktif' ? 'Akun Aktif' : crew.status_akun === 'Nonaktif' ? 'Akun Nonaktif' : 'Belum Ada Akun'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11.5px', color: 'var(--muted)', maxWidth: '200px', lineHeight: 1.3 }}>
                  Aktivasi / nonaktivasi akun dikelola dari <strong>Manajemen Kru</strong>.
                </div>
              </div>

              <div className="field">
                <label>
                  Alasan perubahan hak akses
                  <textarea
                    className="input"
                    style={{ marginTop: '6px', minHeight: '84px' }}
                    placeholder="Jelaskan alasan perubahan profil atau izin khusus..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                  />
                </label>
              </div>

              {retainedProfiles.length > 0 && (
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-2)' }}>
                  Profil tambahan dipertahankan: {retainedProfiles.join(', ')}
                </p>
              )}

              <div className="kk-kv-card">
                <div className="kk-kv-row">
                  <span className="k">Profil Akses Sebelumnya</span>
                  <span className="v">{getAccessProfileSummary(initialProfile).label}</span>
                </div>
                <div className="kk-kv-row">
                  <span className="k">Profil Akses Baru</span>
                  <span className="v" style={{ color: isProfileChanged ? 'var(--b-600)' : 'var(--ink)' }}>
                    {getAccessProfileSummary(selectedProfile).label}
                    {isProfileChanged && ' (Berubah)'}
                  </span>
                </div>
                <div className="kk-kv-row">
                  <span className="k">Override Diizinkan (+Allow)</span>
                  <span
                    className="v font-mono"
                    style={{ color: allowedOverrides.length > 0 ? 'var(--ok)' : 'var(--muted)' }}
                  >
                    {allowedOverrides.length > 0 ? `${allowedOverrides.length} izin khusus` : 'Tidak ada'}
                  </span>
                </div>
                <div className="kk-kv-row">
                  <span className="k">Override Ditolak (-Deny)</span>
                  <span
                    className="v font-mono"
                    style={{ color: deniedOverrides.length > 0 ? 'var(--dang)' : 'var(--muted)' }}
                  >
                    {deniedOverrides.length > 0 ? `${deniedOverrides.length} izin dicabut` : 'Tidak ada'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '13px 16px',
                  borderRadius: 'var(--ptv-curve-lg, 16px)',
                  background: 'var(--warn-bg)',
                  border: '1px solid var(--warn-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--warn)',
                    fontWeight: 600,
                    fontSize: '13px',
                    marginBottom: '4px',
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>{isEscalation ? 'Peningkatan kewenangan' : 'Konfirmasi perubahan akses'}</span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                  Tinjau profil <b>{getAccessProfileSummary(selectedProfile).label}</b> dan setiap override. Deny tetap mengalahkan allow; perubahan akan mencabut sesi lama akun tujuan.
                </p>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmEscalation}
                    onChange={(e) => setConfirmEscalation(e.target.checked)}
                  />
                  <span>Saya mengonfirmasi pemberian hak akses istimewa ini secara sadar.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {saveError && (
          <p role="alert" style={{ margin: 0, padding: '8px 20px', fontSize: '12.5px', color: 'var(--dang)' }}>
            {saveError}
          </p>
        )}

        {/* Footer Modal */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 20px',
            borderTop: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--surface)',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={closeWhenIdle}
            style={{ minHeight: '38px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 600 }}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn pri"
            onClick={handleSave}
            disabled={Boolean(isSelf) || saving || (isEscalation && !confirmEscalation && activeTab === 'summary')}
            style={{ minHeight: '38px', borderRadius: 'var(--ptv-curve-pill)', padding: '0 18px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }} />
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
