import React, { useState, useMemo } from 'react';
import { AccessAuditLogItem } from './accessContract';

interface AccessAuditHistoryTabProps {
  history: AccessAuditLogItem[];
  canViewHistory: boolean;
}

export const AccessAuditHistoryTab: React.FC<AccessAuditHistoryTabProps> = ({
  history,
  canViewHistory,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredHistory = useMemo(() => {
    let list = history || [];
    if (filterType !== 'all') {
      list = list.filter((item) => {
        if (filterType === 'reset_password') return item.event_type.includes('reset_password');
        if (filterType === 'position_mapping') return item.event_type.includes('position_mapping');
        if (filterType === 'account_update') return !item.event_type.includes('reset_password') && !item.event_type.includes('position_mapping');
        return true;
      });
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((item) => {
      const matchText = `${item.event_type} ${item.actor_name || ''} ${item.target_name || ''} ${item.target_username || ''} ${item.target_ptv_id || ''} ${item.target_position || ''} ${item.reason || ''} ${item.source || ''}`.toLowerCase();
      return matchText.includes(q);
    });
  }, [history, filterType, search]);

  if (!canViewHistory) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }} />
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--ink)' }}>Akses Audit Terbatas</h3>
        <p style={{ margin: 0, fontSize: '13px' }}>
          Anda memerlukan izin <code>audit.logs.view</code> untuk melihat log riwayat perubahan akses.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header and filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--line, rgba(11, 42, 74, 0.12))',
          borderRadius: 'var(--ptv-curve-lg, 18px)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--b-600, #2563eb)' }} />
            Log Riwayat Perubahan Hak Akses & Keamanan
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
            Audit kepatuhan komprehensif mencatat setiap perubahan izin khusus, pemetaan jabatan, reset password, dan pelaksana.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Semua Aktivitas' },
            { id: 'account_update', label: 'Izin Akun' },
            { id: 'position_mapping', label: 'Mapping Jabatan' },
            { id: 'reset_password', label: 'Reset Password' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              style={{
                border: 'none',
                background: filterType === tab.id ? 'var(--b-600, #2563eb)' : 'var(--bg, #f1f5f9)',
                color: filterType === tab.id ? '#ffffff' : 'var(--ink-2)',
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-pill, 9999px)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 16px',
          minHeight: '40px',
          borderRadius: 'var(--ptv-curve-pill, 9999px)',
          border: '1px solid var(--line, rgba(11, 42, 74, 0.15))',
          background: 'var(--surface, #ffffff)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)', fontSize: '13px' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari berdasarkan nama pelaksana, target kru, username, jabatan, atau alasan..."
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '13px',
            color: 'var(--ink)',
            width: '100%',
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Audit List */}
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--ptv-curve-lg, 18px)',
          border: '1px solid var(--line, rgba(11, 42, 74, 0.12))',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
            Entri Audit ({filteredHistory.length})
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
            Disimpan permanen di PostgreSQL Staging
          </span>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)', fontSize: '13px' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>Tidak ada riwayat aktivitas yang sesuai filter pencarian.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredHistory.map((item, idx) => {
              const isResetPw = item.event_type.includes('reset_password');
              const isMapping = item.event_type.includes('position_mapping');
              const dateStr = new Date(item.created_at).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx === filteredHistory.length - 1 ? 'none' : '1px solid var(--line-2, rgba(11, 42, 74, 0.06))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--ptv-curve-pill, 9999px)',
                          background: isResetPw
                            ? 'rgba(239, 68, 68, 0.1)'
                            : isMapping
                            ? 'rgba(124, 58, 237, 0.1)'
                            : 'rgba(59, 142, 247, 0.1)',
                          color: isResetPw
                            ? 'var(--danger, #ef4444)'
                            : isMapping
                            ? '#7c3aed'
                            : 'var(--b-700, #1d4ed8)',
                        }}
                      >
                        {isResetPw
                          ? 'Reset Password'
                          : isMapping
                          ? 'Mapping Jabatan'
                          : 'Pembaruan Akses'}
                      </span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                        {item.target_name || item.target_username ? (
                          <>
                            Target: {item.target_name || `@${item.target_username}`}{' '}
                            {item.target_ptv_id && (
                              <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '12px' }}>
                                ({item.target_ptv_id})
                              </span>
                            )}
                          </>
                        ) : (
                          'Konfigurasi Jabatan Organisasi'
                        )}
                      </strong>
                      {item.target_position && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--ptv-curve-pill, 9999px)',
                            background: 'var(--bg, #f1f5f9)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          {item.target_position}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {dateStr}
                    </div>
                  </div>

                  {/* Details / Reasons */}
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
                    {item.reason && (
                      <div>
                        <strong>Alasan:</strong> {item.reason}
                      </div>
                    )}
                    {item.changes && (
                      <div style={{ marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                        {item.changes.before && (
                          <div style={{ color: 'var(--muted)' }}>
                            <span style={{ fontWeight: 600 }}>Sebelum:</span>{' '}
                            {item.changes.before.profiles?.join(', ') || 'Default'}{' '}
                            {item.changes.before.allowed?.length ? `(+${item.changes.before.allowed.length} izin)` : ''}
                          </div>
                        )}
                        {item.changes.after && (
                          <div style={{ color: 'var(--b-600)' }}>
                            <span style={{ fontWeight: 600 }}>Sesudah:</span>{' '}
                            {item.changes.after.profiles?.join(', ') || 'Default'}{' '}
                            {item.changes.after.allowed?.length ? `(+${item.changes.after.allowed.length} izin)` : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actor / Source metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    <div>
                      <i className="fa-solid fa-user-shield" style={{ marginRight: '4px' }} />
                      Pelaksana: <strong>{item.actor_name || item.actor_id || 'Sistem ROOT'}</strong>
                    </div>
                    {item.source && (
                      <div>
                        <i className="fa-solid fa-server" style={{ marginRight: '4px' }} />
                        Sumber: {item.source}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
