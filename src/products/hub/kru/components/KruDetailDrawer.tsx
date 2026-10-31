import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CrewMember } from '../types';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { getKruService } from '../kruService';
import { showToast } from '@shared/components';
import { ResetPasswordDrawerModal } from './ResetPasswordDrawerModal';
import { CreateAccountSuccessModal } from './CreateAccountSuccessModal';
import { CreatedAccountCredentials } from '../kruService';

interface KruDetailDrawerProps {
  crew: CrewMember | null;
  onClose: () => void;
  canManage: boolean;
  canManageStatus?: boolean;
  canManageAccess?: boolean;
  isRoot?: boolean;
  onEdit: (crew: CrewMember) => void;
  onToggleStatus: (id: string) => void;
  onToggleAccountStatus?: (id: string, currentStatus: string) => void;
  onManagePermissions?: (crew: CrewMember) => void;
  onCrewUpdated?: (updatedCrew: CrewMember) => void;
}

export const KruDetailDrawer: React.FC<KruDetailDrawerProps> = ({
  crew,
  onClose,
  canManage,
  onEdit,
  onToggleStatus,
  onToggleAccountStatus,
  canManageStatus,
  canManageAccess,
  onManagePermissions,
  isRoot,
  onCrewUpdated,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen: Boolean(crew),
    onClose,
    modalRef,
  });

  const [localCrew, setLocalCrew] = useState<CrewMember | null>(crew);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // State Buat Akun (PTV-DEV-227)
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedAccountCredentials | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    setLocalCrew(crew);
    setIsEditingUsername(false);
    setUsernameError(null);
  }, [crew]);

  if (!crew || !localCrew) return null;

  const initials = localCrew.full_name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isCrewActive = localCrew.status_kru === 'Aktif';
  const hasAccount = localCrew.status_akun !== 'Belum Ada Akun';
  const isAccountActive = localCrew.status_akun === 'Aktif';

  const birthDateDisplay = localCrew.birth_date || localCrew.tanggal_lahir || localCrew.jurusan || '—';
  const addressDisplay = localCrew.address || localCrew.alamat || localCrew.nim || '—';

  const handleCreateAccount = async () => {
    if (!isRoot) return;
    try {
      setCreatingAccount(true);
      const res = await getKruService().createAccountByRoot(localCrew.id);
      setCreatedCredentials(res.credentials);
      setIsSuccessModalOpen(true);
      if (res.crew) {
        setLocalCrew(res.crew);
        onCrewUpdated?.(res.crew);
      }
      showToast({
        title: 'Akun Berhasil Dibuat',
        desc: `Akun login @${res.credentials.username} siap digunakan.`,
        icon: 'check',
      });
    } catch (err: any) {
      showToast({
        title: 'Gagal Membuat Akun',
        desc: err.message || 'Terjadi kesalahan saat membuat akun.',
        icon: 'warn',
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleStartEditUsername = () => {
    setUsernameInput(localCrew.username || localCrew.ptv_id.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    setUsernameError(null);
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    const clean = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!clean || clean.length < 3 || clean.length > 30) {
      setUsernameError('Username harus berupa 3–30 karakter alfanumerik, titik, atau garis bawah.');
      return;
    }

    try {
      setSavingUsername(true);
      setUsernameError(null);
      const res = await getKruService().updateUsernameByRoot(localCrew.id, clean);

      showToast({
        title: 'Username Diperbarui',
        desc: res.message || `Username berhasil diubah menjadi @${clean}.`,
        icon: 'check',
      });

      const updated: CrewMember = { ...localCrew, username: clean };
      setLocalCrew(updated);
      setIsEditingUsername(false);
      onCrewUpdated?.(updated);
    } catch (err: any) {
      setUsernameError(err.message || 'Gagal memperbarui username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const drawerContent = (
    <div
      className="kk-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kruDrawerTitle"
    >
      <div ref={modalRef} className="kk-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header Drawer */}
        <div className="kk-drawer-header">
          <div className="kk-drawer-header-meta">
            <span className="kk-drawer-header-label">Detail Profil Personel</span>
            <span className="kk-drawer-header-sep">•</span>
            <span className="kk-drawer-header-id">{localCrew.ptv_id}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="kk-drawer-body">
          {/* Identity Hero Card */}
          <div className="kk-profile-hero">
            {localCrew.foto_url ? (
              <img
                src={localCrew.foto_url}
                alt={localCrew.full_name}
                className="kk-profile-avatar-img"
              />
            ) : (
              <div className="kk-profile-avatar-fallback">
                {initials}
              </div>
            )}
            <div className="kk-profile-hero-info">
              <div className="kk-profile-title-row">
                <h2 id="kruDrawerTitle" className="kk-profile-name">
                  {localCrew.full_name}
                </h2>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span className={`kk-profile-status-pill ${isCrewActive ? 'is-active' : 'is-inactive'}`} title="Status Keaktifan Personel">
                    <span className="kk-profile-status-dot" />
                    Kru {localCrew.status_kru}
                  </span>
                  <span
                    className={`kk-profile-status-pill ${
                      hasAccount
                        ? isAccountActive
                          ? 'is-active'
                          : 'is-inactive'
                        : ''
                    }`}
                    style={!hasAccount ? { background: 'var(--surface-sunken)', color: 'var(--muted)', borderColor: 'var(--line-2)' } : undefined}
                    title="Status Akun Login"
                  >
                    <span className="kk-profile-status-dot" style={!hasAccount ? { background: 'var(--muted)' } : undefined} />
                    {hasAccount ? (isAccountActive ? 'Akun Aktif' : 'Akun Nonaktif') : 'Belum Ada Akun'}
                  </span>
                </div>
              </div>
              <div className="kk-profile-role-line">
                <span style={{ fontWeight: 600 }}>{localCrew.position}</span>
                {localCrew.category === 'Kru' && localCrew.division && (
                  <>
                    <span className="kk-profile-role-sep">&middot;</span>
                    <span className="kk-profile-division">{localCrew.division}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Data Keanggotaan & Identitas */}
          <div className="kk-kv-card">
            <div className="kk-kv-section-title">
              <i className="fa-solid fa-id-badge" />
              <span>Data Keanggotaan & Identitas</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">ID PTV</span>
              <span className="v font-mono" style={{ color: 'var(--b-600)', fontWeight: 700 }}>
                {localCrew.ptv_id || '—'}
              </span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Kategori</span>
              <span className="v">{localCrew.category}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Jabatan Organisasi</span>
              <span className="v" style={{ fontWeight: 600 }}>{localCrew.position || '—'}</span>
            </div>
            {localCrew.category === 'Kru' && localCrew.division && (
              <div className="kk-kv-row">
                <span className="k">Divisi Kerja</span>
                <span className="v">{localCrew.division}</span>
              </div>
            )}
            {localCrew.category === 'Kru' && (
              <div className="kk-kv-row">
                <span className="k">Angkatan</span>
                <span className="v">{localCrew.angkatan ? `Angkatan ${localCrew.angkatan}` : '—'}</span>
              </div>
            )}
            <div className="kk-kv-row">
              <span className="k">Tanggal Lahir</span>
              <span className="v font-mono">{birthDateDisplay}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Alamat Domisili</span>
              <span className="v" style={{ maxWidth: '65%', textAlign: 'right' }}>{addressDisplay}</span>
            </div>
            {localCrew.phone && (
              <div className="kk-kv-row">
                <span className="k">WhatsApp</span>
                <span className="v font-mono">{localCrew.phone}</span>
              </div>
            )}
            {localCrew.email && (
              <div className="kk-kv-row">
                <span className="k">Email</span>
                <span className="v" style={{ fontSize: '12px' }}>
                  {localCrew.email}
                </span>
              </div>
            )}
            {localCrew.join_date && (
              <div className="kk-kv-row">
                <span className="k">Bergabung</span>
                <span className="v">{localCrew.join_date}</span>
              </div>
            )}
          </div>

          {/* Section 2: Akun & Keamanan */}
          <div className="kk-kv-card kk-account-relation-card">
            <div className="kk-account-relation-head">
              <div className="kk-kv-section-title" style={{ marginBottom: 0 }}>
                <i className="fa-solid fa-shield-halved" />
                <span>Akun & Keamanan</span>
              </div>
              {canManageAccess && (
                <button
                  type="button"
                  className="kk-account-access-btn"
                  onClick={() => onManagePermissions?.(localCrew)}
                >
                  <i className="fa-solid fa-sliders" />
                  <span>Buka Manajemen Akun</span>
                </button>
              )}
            </div>

            <p className="kk-account-relation-desc" style={{ margin: '8px 0 12px' }}>
              Status personel dan akun login bersifat independen. Kru purna atau nonaktif tetap dapat masuk ke sistem selama status akunnya aktif.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Row Status Akun */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--ptv-curve-sm, 10px)',
                  border: '1px solid var(--line-2)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Status Akun Login</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: hasAccount
                          ? isAccountActive
                            ? 'var(--ok, #16a34a)'
                            : 'var(--warn, #d97706)'
                          : 'var(--muted)',
                      }}
                    />
                    <strong style={{ fontSize: '13px', color: hasAccount ? (isAccountActive ? 'var(--ok, #16a34a)' : 'var(--warn, #d97706)') : 'var(--muted)' }}>
                      {hasAccount ? (isAccountActive ? 'Akun Aktif' : 'Akun Nonaktif') : 'Belum Memiliki Akun'}
                    </strong>
                  </div>
                </div>

                {hasAccount && canManageStatus && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onToggleAccountStatus?.(localCrew.id, localCrew.status_akun)}
                    style={{
                      fontSize: '12px',
                      padding: '5px 12px',
                      borderRadius: 'var(--ptv-curve-pill)',
                      fontWeight: 600,
                      borderColor: isAccountActive ? 'var(--dang-border, rgba(239, 68, 68, 0.4))' : 'var(--ok-border, rgba(34, 197, 94, 0.4))',
                      color: isAccountActive ? 'var(--dang, #dc2626)' : 'var(--ok, #16a34a)',
                      background: isAccountActive ? 'var(--dang-bg, rgba(239, 68, 68, 0.08))' : 'var(--ok-bg, rgba(34, 197, 94, 0.08))',
                    }}
                  >
                    <i className={`fa-solid ${isAccountActive ? 'fa-user-lock' : 'fa-user-check'}`} style={{ marginRight: '6px' }} />
                    <span>{isAccountActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}</span>
                  </button>
                )}

                {!hasAccount && isRoot && (
                  <button
                    type="button"
                    className="btn pri"
                    onClick={handleCreateAccount}
                    disabled={creatingAccount}
                    style={{
                      fontSize: '12px',
                      padding: '5px 13px',
                      borderRadius: 'var(--ptv-curve-pill)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {creatingAccount ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" />
                        <span>Membuat Akun...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-user-plus" />
                        <span>+ Buat Akun</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Row Username Sistem */}
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--ptv-curve-sm, 10px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Username Login</span>
                    {!isEditingUsername && (
                      <strong className="font-mono" style={{ fontSize: '13px', color: hasAccount ? 'var(--ink)' : 'var(--muted)', display: 'block', marginTop: '2px' }}>
                        {hasAccount ? `@${localCrew.username}` : '(Belum dibuat)'}
                      </strong>
                    )}
                  </div>

                  {!isEditingUsername && isRoot && hasAccount && (
                    <button
                      type="button"
                      className="btn is-secondary"
                      onClick={handleStartEditUsername}
                      style={{
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: 'var(--ptv-curve-pill)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Ubah Username (Khusus ROOT)"
                    >
                      <i className="fa-solid fa-pen" style={{ fontSize: '10px' }} />
                      <span>Ubah</span>
                    </button>
                  )}
                </div>

                {isEditingUsername && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className="font-mono" style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600 }}>@</span>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                        placeholder="username_baru"
                        disabled={savingUsername}
                        maxLength={30}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 'var(--ptv-curve-sm, 8px)',
                          border: '1px solid var(--line-2)',
                          background: 'var(--surface)',
                          fontSize: '12.5px',
                          color: 'var(--ink)',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        className="btn is-secondary"
                        onClick={() => {
                          setIsEditingUsername(false);
                          setUsernameError(null);
                        }}
                        disabled={savingUsername}
                        style={{ fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--ptv-curve-pill)' }}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        className="btn pri"
                        onClick={handleSaveUsername}
                        disabled={savingUsername || !usernameInput.trim()}
                        style={{ fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--ptv-curve-pill)' }}
                      >
                        {savingUsername ? <i className="fa-solid fa-spinner fa-spin" /> : 'Simpan'}
                      </button>
                    </div>
                    {usernameError && (
                      <span style={{ fontSize: '11px', color: 'var(--danger, #ef4444)', display: 'block', marginTop: '4px' }}>
                        {usernameError}
                      </span>
                    )}
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                      Gunakan 3–30 karakter alfanumerik, titik, atau garis bawah.
                    </span>
                  </div>
                )}
              </div>

              {/* Row Reset Password (Khusus ROOT) */}
              {isRoot && hasAccount && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--ptv-curve-sm, 10px)',
                    border: '1px solid var(--line-2)',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Keamanan Kata Sandi</span>
                    <span style={{ fontSize: '12px', color: 'var(--ink)', fontWeight: 500 }}>
                      Atur Ulang Password (ROOT)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setIsResetPasswordOpen(true)}
                    style={{
                      fontSize: '12px',
                      padding: '5px 12px',
                      borderRadius: 'var(--ptv-curve-pill)',
                      fontWeight: 600,
                      borderColor: 'var(--line-2)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fa-solid fa-key" style={{ color: 'var(--danger, #ef4444)', fontSize: '11px' }} />
                    <span>Reset Password</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="kk-drawer-footer">
          {canManage && (
            <button
              type="button"
              className="btn pri kk-drawer-action-btn"
              onClick={() => onEdit(localCrew)}
            >
              <i className="fa-solid fa-pen-to-square" />
              <span>Edit Kru</span>
            </button>
          )}
          {canManageStatus && (
            <button
              type="button"
              className="btn kk-drawer-action-btn is-secondary"
              onClick={() => onToggleStatus(localCrew.id)}
            >
              <i className={`fa-solid ${isCrewActive ? 'fa-user-slash' : 'fa-user-check'}`} />
              <span>{isCrewActive ? 'Nonaktifkan Kru' : 'Aktifkan Kru'}</span>
            </button>
          )}
          {localCrew.phone && (
            <a
              href={`https://wa.me/${localCrew.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn kk-whatsapp-btn-full"
            >
              <i className="fa-brands fa-whatsapp" style={{ fontSize: '14px' }} />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      </div>

      {/* Modal Atur Ulang Password (Khusus ROOT) */}
      {isResetPasswordOpen && (
        <ResetPasswordDrawerModal
          isOpen={isResetPasswordOpen}
          onClose={() => setIsResetPasswordOpen(false)}
          crew={localCrew}
        />
      )}

      {/* Modal Kredensial Akun Baru (Khusus ROOT, PTV-DEV-227) */}
      {isSuccessModalOpen && createdCredentials && (
        <CreateAccountSuccessModal
          isOpen={isSuccessModalOpen}
          onClose={() => {
            setIsSuccessModalOpen(false);
            setCreatedCredentials(null);
          }}
          credentials={createdCredentials}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
};
