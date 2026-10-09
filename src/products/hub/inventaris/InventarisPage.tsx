import React, { useState } from 'react';
import { useInventarisList } from './useInventaris';
import { useSessionStore } from '@core/session';
import { Card, Button, Badge, LoadingState, ErrorState, EmptyState, Input } from '@shared/components';
import { Package, Plus, Search, Filter, QrCode, AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { ItemInventaris, CreateInventarisDTO } from './types';

export const InventarisPage: React.FC = () => {
  const { can } = useSessionStore();
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('all');
  const [status, setStatus] = useState<'all' | 'tersedia' | 'habis'>('all');
  const [selectedItem, setSelectedItem] = useState<ItemInventaris | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKategori, setFormKategori] = useState('Kamera');
  const [formSpesifikasi, setFormSpesifikasi] = useState('');
  const [formLokasi, setFormLokasi] = useState('Studio Lt 1');
  const [formJumlah, setFormJumlah] = useState('1');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const { data, isLoading, isError, error, refetch, createItem } = useInventarisList({
    search: search.trim() || undefined,
    kategori: kategori !== 'all' ? kategori : undefined,
    status: status !== 'all' ? status : undefined,
  });

  const canCreate = can('inventory.create');

  const handleOpenAdd = () => {
    const nextSuffix = (data.length + 1).toString().padStart(3, '0');
    setFormKode(`INV-${nextSuffix}`);
    setFormNama('');
    setFormKategori('Kamera');
    setFormSpesifikasi('');
    setFormLokasi('Studio Lt 1');
    setFormJumlah('1');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKode.trim() || !formNama.trim()) {
      setFormError('Kode dan Nama Alat wajib diisi.');
      return;
    }
    const jumlah = parseInt(formJumlah, 10);
    if (isNaN(jumlah) || jumlah < 1) {
      setFormError('Jumlah unit minimal 1.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');
      const dto: CreateInventarisDTO = {
        kode: formKode.trim().toUpperCase(),
        nama_alat: formNama.trim(),
        kategori: formKategori,
        spesifikasi: formSpesifikasi.trim() || undefined,
        lokasi_penyimpanan: formLokasi.trim() || undefined,
        jumlah_unit: jumlah,
      };
      await createItem(dto);
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan alat inventaris.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Halaman */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Package size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Katalog Inventaris Studio
            </h2>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Manajemen master alat broadcast, barcode unit fisik, dan ketersediaan operasional.
          </p>
        </div>

        {canCreate && (
          <Button variant="primary" size="md" onClick={handleOpenAdd}>
            <Plus size={16} />
            Tambah Alat Baru
          </Button>
        )}
      </div>

      {/* Filter dan Pencarian */}
      <Card style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px', backgroundColor: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-card-border)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari nama alat, kode INV, nomor seri, atau spesifikasi..."
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
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--bg-card-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.75rem',
                fontSize: 'var(--text-xs)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Kategori</option>
              <option value="Kamera">Kamera</option>
              <option value="Lensa">Lensa</option>
              <option value="Audio">Audio</option>
              <option value="Lighting">Lighting</option>
              <option value="Stabilizer">Stabilizer</option>
              <option value="Aksesoris">Aksesoris</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'tersedia' | 'habis')}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--bg-card-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.75rem',
                fontSize: 'var(--text-xs)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Status</option>
              <option value="tersedia">Unit Tersedia</option>
              <option value="habis">Semua Dipinjam</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Handling Tampilan Data */}
      {isLoading ? (
        <LoadingState message="Memuat katalog inventaris studio..." />
      ) : isError ? (
        <ErrorState
          title="Gagal Memuat Inventaris"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data.'}
          onRetry={() => refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Tidak Ada Alat Inventaris"
          description="Tidak ditemukan peralatan yang sesuai dengan kriteria filter pencarian."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {data.map((item) => (
            <Card
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedItem(item)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--accent-cyan)' }}>
                    {item.kode}
                  </span>
                  <Badge variant={item.unit_tersedia > 0 ? 'success' : 'danger'}>
                    {item.unit_tersedia > 0 ? `${item.unit_tersedia} dari ${item.total_unit} Tersedia` : 'Semua Dipinjam'}
                  </Badge>
                </div>

                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {item.nama_alat}
                </h3>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <Badge variant="info">{item.kategori}</Badge>
                </div>

                {item.spesifikasi && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.spesifikasi}
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--bg-card-border)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <QrCode size={14} />
                  <span>{item.units.length} Unit Barcode</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-xs)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  <span>Rincian Unit</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Detail & Unit Barcode */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--accent-cyan)' }}>
                  {selectedItem.kode}
                </span>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedItem.nama_alat}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {selectedItem.spesifikasi && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Spesifikasi:</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {selectedItem.spesifikasi}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={16} style={{ color: 'var(--accent-cyan)' }} />
                Daftar Fisik Unit ({selectedItem.units.length} Unit)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedItem.units.map((unit) => (
                  <div
                    key={unit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--bg-card-border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {unit.kode_unit}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        SN: {unit.nomor_seri || '-'} &bull; Lokasi: {unit.lokasi_penyimpanan || '-'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant={unit.kondisi === 'bagus' ? 'success' : 'warning'}>
                        {unit.kondisi.toUpperCase()}
                      </Badge>
                      <Badge variant={unit.status_peminjaman === 'tersedia' ? 'success' : unit.status_peminjaman === 'dipinjam' ? 'danger' : 'warning'}>
                        {unit.status_peminjaman === 'tersedia' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> Tersedia
                          </span>
                        ) : unit.status_peminjaman === 'dipinjam' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertCircle size={12} /> Dipinjam
                          </span>
                        ) : (
                          'Maintenance'
                        )}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedItem(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Alat */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tambah Alat Inventaris Baru
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-danger-bg)', color: '#fca5a5', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Kode Alat (INV-xxx)"
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value)}
                  placeholder="INV-006"
                  required
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Kategori
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--bg-card-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      padding: '0.55rem 0.75rem',
                      fontSize: 'var(--text-sm)',
                      outline: 'none',
                    }}
                  >
                    <option value="Kamera">Kamera</option>
                    <option value="Lensa">Lensa</option>
                    <option value="Audio">Audio</option>
                    <option value="Lighting">Lighting</option>
                    <option value="Stabilizer">Stabilizer</option>
                    <option value="Aksesoris">Aksesoris</option>
                  </select>
                </div>
              </div>

              <Input
                label="Nama Peralatan & Model"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                placeholder="Misal: Blackmagic Pocket Cinema 6K Pro"
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Spesifikasi & Rincian
                </label>
                <textarea
                  value={formSpesifikasi}
                  onChange={(e) => setFormSpesifikasi(e.target.value)}
                  placeholder="Karakteristik teknis, resolusi, kelengkapan bawaan..."
                  rows={3}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-card-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.55rem 0.75rem',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Lokasi Penyimpanan"
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="Lemari A1"
                />
                <Input
                  label="Jumlah Unit Awal"
                  type="number"
                  min="1"
                  max="50"
                  value={formJumlah}
                  onChange={(e) => setFormJumlah(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Alat'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
