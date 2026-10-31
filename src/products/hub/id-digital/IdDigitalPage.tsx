import React, { useState } from 'react';
import { useCrewStore } from '../kru/kruStore';
import { useSessionStore } from '@core/session';
import { OfficialIdCard } from './components/OfficialIdCard';
import { IdentityVerificationModal } from './components/IdentityVerificationModal';

export const IdDigitalPage: React.FC = () => {
  const { getCurrentUser } = useCrewStore();
  const { user } = useSessionStore();
  const currentUser = getCurrentUser();

  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false);

  if (!currentUser.ptv_id) {
    return (
      <p role="status">
        Identitas personel Anda belum tersedia. Muat ulang data Kru atau hubungi pengelola.
      </p>
    );
  }

  const fullName = currentUser.full_name || user?.full_name || 'KRU PROGRESIF';
  const ptvId = currentUser.ptv_id || user?.ptv_id || 'PTV-000';
  const position = currentUser.position || 'Kru Operasional';
  const division = currentUser.division || 'Technical';
  const status = currentUser.status_kru || 'Aktif';
  const fotoUrl = currentUser.foto_url || (user as any)?.avatar_url || (user as any)?.foto_url;

  return (
    <div style={{ paddingBottom: '48px' }}>
      <OfficialIdCard
        fullName={fullName}
        ptvId={ptvId}
        position={position}
        division={division}
        status={status}
        fotoUrl={fotoUrl}
        onOpenVerifModal={() => setIsVerifModalOpen(true)}
        showActions={true}
      />

      {/* Info Box */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--ptv-curve-lg, 16px)',
          padding: '14px 18px',
          marginTop: '20px',
          maxWidth: '360px',
          margin: '20px auto 0',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--b-050, rgba(29, 110, 229, 0.08))',
            color: 'var(--b-700, #1D6EE5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '15px',
          }}
        >
          <i className="fa-solid fa-circle-check" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Kartu Identitas Terverifikasi
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
            ID digital resmi terhubung langsung dengan basis data keanggotaan Progresif TV.
          </div>
        </div>
      </div>

      {/* Verifikasi Modal via Portal */}
      <IdentityVerificationModal
        isOpen={isVerifModalOpen}
        onClose={() => setIsVerifModalOpen(false)}
        fullName={fullName}
        ptvId={currentUser.ptv_id || 'PTV-000'}
        position={position}
        division={division}
        status="Aktif"
      />
    </div>
  );
};
