import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@/shared/hooks/useModalScrollLock';
import { useSessionStore } from '@/core/session';
import { useCrewStore } from './kruStore';
import { crewPortfolioService, PortfolioItem, PLATFORMS, KONTRIBUSI_TYPES } from './services/crewPortfolioService';
import '@/styles/portofolio.css';

export const PortofolioSayaPage: React.FC = () => {
  const sessionUser = useSessionStore((s) => s.user);
  const { getCurrentUser } = useCrewStore();
  const currentUser = getCurrentUser();

  const effectivePtvId = currentUser.ptv_id || sessionUser?.ptv_id || sessionUser?.username || '';

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilterPlatform, setSelectedFilterPlatform] = useState<string>('all');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: isModalOpen,
    onClose: () => !isSubmitting && setIsModalOpen(false),
    modalRef,
  });

  // Form Fields
  const [formTanggal, setFormTanggal] = useState('');
  const [formPlatform, setFormPlatform] = useState('Instagram');
  const [formJenisKontribusi, setFormJenisKontribusi] = useState('Kamera');
  const [formJudul, setFormJudul] = useState('');
  const [formLinkKarya, setFormLinkKarya] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await crewPortfolioService.getMyPortfolio();
      setItems(data);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectivePtvId]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormPlatform('Instagram');
    setFormJenisKontribusi('Kamera');
    setFormJudul('');
    setFormLinkKarya('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormTanggal(item.tanggal || new Date().toISOString().split('T')[0]);
    setFormPlatform(item.platform || 'Instagram');
    setFormJenisKontribusi(item.jenis_kontribusi || 'Kamera');
    setFormJudul(item.judul || '');
    setFormLinkKarya(item.link_karya || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formJudul.trim() || formJudul.trim().length < 3) {
      setFormError('Judul atau deskripsi pekerjaan wajib diisi (minimal 3 karakter).');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await crewPortfolioService.savePortfolioItem({
        id: editingItem?.id,
        ptv_id: effectivePtvId,
        tanggal: formTanggal,
        platform: formPlatform,
        jenis_kontribusi: formJenisKontribusi,
        judul: formJudul.trim(),
        link_karya: formLinkKarya.trim() || undefined,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan karya portofolio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, judul: string) => {
    if (!window.confirm(`Yakin ingin menghapus karya "${judul}"?`)) return;
    try {
      await crewPortfolioService.deletePortfolioItem(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus karya.');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    const platformCount: Record<string, number> = {};
    const roleCount: Record<string, number> = {};

    items.forEach((i) => {
      platformCount[i.platform] = (platformCount[i.platform] || 0) + 1;
      roleCount[i.jenis_kontribusi] = (roleCount[i.jenis_kontribusi] || 0) + 1;
    });

    const topPlatform = Object.entries(platformCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return { total, topPlatform, topRole };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedFilterPlatform === 'all') return items;
    return items.filter((i) => i.platform === selectedFilterPlatform);
  }, [items, selectedFilterPlatform]);

  const getPlatformClass = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return 'instagram';
    if (p.includes('tiktok')) return 'tiktok';
    if (p.includes('youtube')) return 'youtube';
    if (p.includes('facebook')) return 'facebook';
    if (p.includes('website')) return 'website';
    if (p.includes('event')) return 'live-event';
    return '';
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return 'fa-brands fa-instagram';
    if (p.includes('tiktok')) return 'fa-brands fa-tiktok';
    if (p.includes('youtube')) return 'fa-brands fa-youtube';
    if (p.includes('facebook')) return 'fa-brands fa-facebook';
    if (p.includes('website')) return 'fa-solid fa-globe';
    if (p.includes('event')) return 'fa-solid fa-microphone-lines';
    return 'fa-solid fa-clapperboard';
  };

  return (
    <div className="ptv-pf-page-root">
      {/* Header Halaman */}
      <div className="ptv-pf-header-bar">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Portofolio &amp; Rekam Karya Saya</h1>
          <p className="ptv-page-subtitle">
            Catat dan kelola riwayat kontribusi produksi Anda di Progresif TV. Karya yang dicatat akan dipublikasikan pada halaman verifikasi identitas resmi Anda ({effectivePtvId}).
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="pm-btn-pill pm-btn-primary"
          style={{ height: '38px', padding: '0 18px', fontSize: '13px' }}
        >
          <i className="fa-solid fa-plus" />
          <span>Tambah Karya Baru</span>
        </button>
      </div>

      {/* Ringkasan Statistik */}
      <div className="ptv-pf-stats-grid">
        <div className="ptv-pf-stat-card">
          <div className="ptv-pf-stat-icon">
            <i className="fa-solid fa-film" />
          </div>
          <div className="ptv-pf-stat-info">
            <span className="ptv-pf-stat-val">{stats.total}</span>
            <span className="ptv-pf-stat-label">Total Karya Tercatat</span>
          </div>
        </div>

        <div className="ptv-pf-stat-card">
          <div className="ptv-pf-stat-icon" style={{ background: '#fdf2f8', color: '#db2777' }}>
            <i className="fa-solid fa-share-nodes" />
          </div>
          <div className="ptv-pf-stat-info">
            <span className="ptv-pf-stat-val" style={{ fontSize: '17px' }}>{stats.topPlatform}</span>
            <span className="ptv-pf-stat-label">Platform Terbanyak</span>
          </div>
        </div>

        <div className="ptv-pf-stat-card">
          <div className="ptv-pf-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <i className="fa-solid fa-video" />
          </div>
          <div className="ptv-pf-stat-info">
            <span className="ptv-pf-stat-val" style={{ fontSize: '17px' }}>{stats.topRole}</span>
            <span className="ptv-pf-stat-label">Peran Kontribusi Utama</span>
          </div>
        </div>
      </div>

      {/* Filter Platform */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            type="button"
            className={`pm-filter-pill ${selectedFilterPlatform === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilterPlatform('all')}
          >
            Semua ({items.length})
          </button>
          {PLATFORMS.map((plat) => {
            const count = items.filter((i) => i.platform === plat).length;
            if (count === 0) return null;
            return (
              <button
                key={plat}
                type="button"
                className={`pm-filter-pill ${selectedFilterPlatform === plat ? 'active' : ''}`}
                onClick={() => setSelectedFilterPlatform(plat)}
              >
                {plat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* List Portofolio */}
      {isLoading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '20px', marginBottom: '8px' }} />
          <p style={{ margin: 0 }}>Memuat daftar rekam karya...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="ptv-pf-empty-card">
          <div className="ptv-pf-empty-icon">
            <i className="fa-solid fa-camera-retro" />
          </div>
          <h3 className="ptv-pf-empty-title">Belum Ada Rekam Karya</h3>
          <p className="ptv-pf-empty-desc">
            {selectedFilterPlatform === 'all'
              ? 'Mulai catat kontribusi produksi, liputan, desain, atau editing yang pernah Anda kerjakan untuk membangun portofolio resmi Anda di Progresif TV.'
              : `Belum ada karya yang tercatat pada platform ${selectedFilterPlatform}.`}
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="pm-btn-pill pm-btn-primary"
            style={{ marginTop: '8px' }}
          >
            <i className="fa-solid fa-plus" />
            <span>Tambah Karya Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="ptv-pf-list-wrap">
          {filteredItems.map((item) => (
            <div key={item.id} className="ptv-pf-item-card">
              <div className="ptv-pf-item-main">
                <div className="ptv-pf-badges-row">
                  <span className={`ptv-pf-platform-badge ${getPlatformClass(item.platform)}`}>
                    <i className={getPlatformIcon(item.platform)} />
                    {item.platform}
                  </span>
                  <span className="ptv-pf-role-pill">
                    <i className="fa-solid fa-tag" style={{ fontSize: '10px' }} />
                    {item.jenis_kontribusi}
                  </span>
                  <span className="ptv-pf-date-pill">
                    <i className="fa-regular fa-calendar" />
                    {item.tanggal}
                  </span>
                </div>

                <h3 className="ptv-pf-item-title">{item.judul}</h3>

                {item.link_karya && (
                  <a
                    href={item.link_karya}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ptv-pf-item-link"
                  >
                    <span>Buka Tautan Karya</span>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10px' }} />
                  </a>
                )}
              </div>

              <div className="ptv-pf-item-actions">
                <button
                  type="button"
                  className="ptv-pf-icon-btn"
                  onClick={() => openEditModal(item)}
                  title="Edit karya"
                  aria-label="Edit karya"
                >
                  <i className="fa-solid fa-pen-to-square" />
                </button>
                <button
                  type="button"
                  className="ptv-pf-icon-btn delete"
                  onClick={() => handleDelete(item.id, item.judul)}
                  title="Hapus karya"
                  aria-label="Hapus karya"
                >
                  <i className="fa-regular fa-trash-can" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit Karya */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="ptv-pf-modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div ref={modalRef} className="ptv-pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ptv-pf-modal-header">
              <h3>{editingItem ? 'Edit Karya Portofolio' : 'Tambah Karya Baru'}</h3>
              <button
                type="button"
                className="ptv-pf-modal-close"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                aria-label="Tutup dialog"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="ptv-pf-modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className="ptv-pf-form-group">
                  <label className="ptv-pf-form-label" htmlFor="formTanggal">
                    Tanggal Produksi / Kegiatan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="formTanggal"
                    type="date"
                    className="ptv-pf-input"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="ptv-pf-form-group">
                    <label className="ptv-pf-form-label" htmlFor="formPlatform">
                      Platform Publikasi <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      id="formPlatform"
                      className="ptv-pf-select"
                      value={formPlatform}
                      onChange={(e) => setFormPlatform(e.target.value)}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ptv-pf-form-group">
                    <label className="ptv-pf-form-label" htmlFor="formJenisKontribusi">
                      Jenis Kontribusi <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      id="formJenisKontribusi"
                      className="ptv-pf-select"
                      value={formJenisKontribusi}
                      onChange={(e) => setFormJenisKontribusi(e.target.value)}
                    >
                      {KONTRIBUSI_TYPES.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ptv-pf-form-group">
                  <label className="ptv-pf-form-label" htmlFor="formJudul">
                    Judul atau Deskripsi Pekerjaan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    id="formJudul"
                    className="ptv-pf-textarea"
                    placeholder="Contoh: Liputan Kajian Akbar Haul PPBS 2026 / Teaser Video Ramadhan..."
                    value={formJudul}
                    onChange={(e) => setFormJudul(e.target.value)}
                    required
                  />
                </div>

                <div className="ptv-pf-form-group">
                  <label className="ptv-pf-form-label" htmlFor="formLinkKarya">
                    Link Karya (Opsional)
                  </label>
                  <input
                    id="formLinkKarya"
                    type="url"
                    className="ptv-pf-input"
                    placeholder="https://instagram.com/p/... atau https://youtu.be/..."
                    value={formLinkKarya}
                    onChange={(e) => setFormLinkKarya(e.target.value)}
                  />
                </div>
              </div>

              <div className="ptv-pf-modal-footer">
                <button
                  type="button"
                  className="pm-btn-pill pm-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="pm-btn-pill pm-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Simpan Perubahan' : 'Tambahkan Karya'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
