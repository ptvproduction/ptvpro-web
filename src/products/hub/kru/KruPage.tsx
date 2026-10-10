import React, { useState } from 'react';
import { useKruList } from './useKru';
import { useSessionStore } from '@core/session';
import { Card, Button, Badge, LoadingState, ErrorState, EmptyState, PTVSelect } from '@shared/components';
import { Users, UserPlus, Search, Filter } from 'lucide-react';

export const KruPage: React.FC = () => {
  const { can } = useSessionStore();
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('all');

  const { data, isLoading, isError, error, refetch } = useKruList({
    search: search.trim() || undefined,
    division: division !== 'all' ? division : undefined,
  });

  const canCreateCrew = can('crew.create');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Users size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Direktori Kru Studio
            </h2>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Manajemen personel, status akun, dan hak akses institusional PTV.
          </p>
        </div>

        {canCreateCrew && (
          <Button variant="primary" size="md" onClick={() => alert('Wizard Tambah Kru disiapkan untuk vertical slice berikutnya.')}>
            <UserPlus size={16} />
            Tambah Kru
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px', backgroundColor: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-card-border)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari nama, PTV ID, atau posisi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <PTVSelect
              value={division}
              onChange={(val) => setDivision(val)}
              options={[
                { value: 'all', label: 'Semua Divisi' },
                { value: 'Leadership', label: 'Leadership' },
                { value: 'Technical', label: 'Technical' },
                { value: 'Editor', label: 'Editor' },
                { value: 'Layouter', label: 'Layouter' },
                { value: 'Master Control', label: 'Master Control' },
              ]}
              ariaLabel="Filter Divisi Kru"
              size="sm"
              className="kru-division-select"
            />
          </div>
        </div>
      </Card>

      {/* Content State Handling */}
      {isLoading ? (
        <LoadingState message="Memuat daftar kru studio..." />
      ) : isError ? (
        <ErrorState
          title="Gagal Memuat Kru"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data.'}
          onRetry={() => refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Tidak Ada Data Kru"
          description="Tidak ditemukan kru yang sesuai dengan filter pencarian."
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--bg-card-border)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>PTV ID</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>NAMA LENGKAP</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>DIVISI & JABATAN</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>ANGKATAN</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>PROFILE AKSES</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.map((kru, idx) => (
                  <tr
                    key={kru.id}
                    style={{
                      borderBottom: idx === data.length - 1 ? 'none' : '1px solid var(--bg-card-border)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {kru.ptv_id}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {kru.full_name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{kru.position}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{kru.division}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {kru.angkatan || '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <Badge variant="info">{kru.assigned_profiles[0]}</Badge>
                        {kru.allowed_overrides.map((override) => (
                          <Badge key={override} variant="success">
                            +{override}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {kru.status_akun === 'inactive' ? (
                          <Badge variant="danger">Akun Nonaktif</Badge>
                        ) : kru.status_organisasi === 'inactive' ? (
                          <Badge variant="warning">Alumni (Read-Only)</Badge>
                        ) : (
                          <Badge variant="success">Aktif</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
