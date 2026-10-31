import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useExternalContactsStore, externalContactsStore } from './kontakEksternalStore';
import { ExternalContact } from './mock/kontakEksternalMockData';
import { useSessionStore } from '@core/session';
import { KontakEksternalDetailDrawer } from './components/KontakEksternalDetailDrawer';
import { KontakEksternalFormModal } from './components/KontakEksternalFormModal';
import { kontakService } from '../kontak/kontakService';
import { CardListSkeleton } from '@/shared/components';

export const KontakEksternalPage: React.FC = () => {
  const { can, user } = useSessionStore();
  const { contacts } = useExternalContactsStore();

  const canManage = can('contacts.external.manage') || can('crew.create') || can('crew.view') || !user;

  const [lembagaFilter, setLembagaFilter] = useState<'Semua' | 'Pondok' | 'Sekolah' | 'Yayasan' | 'Mitra'>('Semua');
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<ExternalContact | null>(null);

  // Live Staging Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStagingContacts = useCallback(async (force = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const liveData = await kontakService.getExternalContacts(force);
      externalContactsStore.setLiveContacts(liveData);
    } catch (err: any) {
      console.warn('[KontakEksternalPage] Failed to load Staging external contacts:', err.message);
      setLoadError(err.message || 'Gagal memuat kontak eksternal. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStagingContacts();
  }, [loadStagingContacts]);

  // Modal form & delete state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ExternalContact | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ExternalContact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Dynamic counter tabs persis Legacy L23145-L23151
  const countLembaga = useMemo(() => {
    return {
      Semua: contacts.length,
      Pondok: contacts.filter((c) => c.lembaga === 'Pondok').length,
      Sekolah: contacts.filter((c) => c.lembaga === 'Sekolah').length,
      Yayasan: contacts.filter((c) => c.lembaga === 'Yayasan').length,
      Mitra: contacts.filter((c) => c.lembaga === 'Mitra').length,
    };
  }, [contacts]);

  // Search & Filter
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((k) => {
      // Lembaga filter
      if (lembagaFilter !== 'Semua' && k.lembaga !== lembagaFilter) {
        return false;
      }
      // Search query
      if (!q) return true;
      return (
        k.nama.toLowerCase().includes(q) ||
        k.jabatan.toLowerCase().includes(q) ||
        k.organisasi.toLowerCase().includes(q) ||
        k.kategori.toLowerCase().includes(q) ||
        (k.nomor_telepon && k.nomor_telepon.includes(q)) ||
        (k.whatsapp && k.whatsapp.includes(q))
      );
    });
  }, [contacts, lembagaFilter, search]);

  const handleOpenAdd = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: ExternalContact) => {
    setEditingContact(c);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (data: Omit<ExternalContact, 'id'>) => {
    if (editingContact) {
      const updated = await kontakService.updateExternalContact(editingContact.id, data);
      externalContactsStore.updateContact(editingContact.id, data);
      await loadStagingContacts(true);
      showToast(`Kontak "${data.nama}" berhasil diperbarui.`);
      if (selectedContact?.id === editingContact.id && updated) {
        setSelectedContact(updated);
      }
    } else {
      const created = await kontakService.createExternalContact(data);
      externalContactsStore.addContact(created);
      await loadStagingContacts(true);
      showToast(`Kontak "${created.nama}" berhasil ditambahkan.`);
    }
    setIsFormOpen(false);
  };

  const handleOpenDelete = (c: ExternalContact) => {
    setContactToDelete(c);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    setIsDeleting(true);
    try {
      await kontakService.deleteExternalContact(contactToDelete.id);
      externalContactsStore.deleteContact(contactToDelete.id);
      await loadStagingContacts(true);
      showToast(`Kontak "${contactToDelete.nama}" berhasil dihapus.`);
      setIsDeleteModalOpen(false);
      setContactToDelete(null);
      setSelectedContact(null);
    } catch (err: any) {
      showToast(`Gagal menghapus kontak: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--ink, #0b2a4a)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--ptv-curve-pill)',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Row: Title & Add Button */}
      <header className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Kontak Eksternal & Lembaga</h1>
          <p className="ptv-page-subtitle">
            Direktori resmi kontak Ustadz/ah, Pondok, Sekolah, Yayasan, dan Rekanan.
          </p>
        </div>
        {canManage && (
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
              flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-plus" />
            <span>Tambah Kontak</span>
          </button>
        )}
      </header>

      {/* Searchbar */}
      <div className="kk-searchbar" style={{ marginBottom: '14px' }}>
        <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Cari nama Ustadz/ah, jabatan, instansi..."
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

      {/* Filter Tabs Lembaga */}
      <div className="kk-filters-scroll" style={{ marginBottom: '18px' }}>
        {[
          ['Semua', 'Semua', countLembaga.Semua],
          ['Pondok', 'Pondok', countLembaga.Pondok],
          ['Sekolah', 'Sekolah', countLembaga.Sekolah],
          ['Yayasan', 'Yayasan', countLembaga.Yayasan],
          ['Mitra', 'Mitra & Vendor', countLembaga.Mitra],
        ].map(([k, label, cnt]) => (
          <button
            key={k}
            type="button"
            className={`kk-filter-pill ${lembagaFilter === k ? 'active' : ''}`}
            onClick={() => setLembagaFilter(k as any)}
          >
            <span>{label}</span>
            <span className="cnt">{cnt}</span>
          </button>
        ))}
      </div>

      {/* Error Retry Banner */}
      {loadError && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            background: 'var(--warn-bg, #fffbeb)',
            border: '1px solid var(--warn-border, #fef3c7)',
            borderRadius: 'var(--ptv-curve-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warn, #d97706)' }} />
            <span style={{ fontSize: '13px', color: 'var(--ink, #0b2a4a)' }}>{loadError}</span>
          </div>
          <button
            type="button"
            className="btn sm"
            onClick={() => loadStagingContacts(true)}
            style={{ borderRadius: 'var(--ptv-curve-pill)', padding: '4px 12px', fontSize: '12px' }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '4px' }} />
            Coba Lagi
          </button>
        </div>
      )}

      {/* List Kontak Eksternal */}
      <div>
        {isLoading && contacts.length === 0 ? (
          <CardListSkeleton count={4} />
        ) : filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
            <i className="fa-solid fa-address-book" style={{ fontSize: '36px', marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search ? 'Tidak ada kontak yang cocok dengan pencarian.' : 'Belum ada kontak terdaftar pada kategori ini.'}
            </p>
          </div>
        ) : (
          <div className="kk-list-stack">
            {filteredContacts.map((k) => {
              const inits = k.nama
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const waLink = k.whatsapp && !k.whatsapp.includes('*')
                ? `https://wa.me/${k.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
                : null;

              const isPondok = k.lembaga === 'Pondok';
              const isSekolah = k.lembaga === 'Sekolah';
              const isYayasan = k.lembaga === 'Yayasan';
              const badgeClass = isPondok ? 'pondok' : isSekolah ? 'sekolah' : isYayasan ? 'yayasan' : 'mitra';

              return (
                <div
                  key={k.id}
                  className="kk-list-item kk-kontak-row"
                  role="button"
                  tabIndex={0}
                  aria-label={`Buka detail kontak ${k.nama}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedContact(k);
                    }
                  }}
                  onClick={() => setSelectedContact(k)}
                  style={{ cursor: 'pointer', padding: '12px 16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    {k.foto_url ? (
                      <img
                        src={k.foto_url}
                        alt={k.nama}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {inits}
                      </div>
                    )}
                    <div className="kk-list-item-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="kk-list-item-name">{k.nama}</span>
                        <span className={`kk-category-badge ${badgeClass}`}>
                          {k.lembaga === 'Mitra' ? 'Mitra & Vendor' : k.lembaga}
                        </span>
                      </div>
                      <span className="kk-list-item-sub">
                        <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{k.jabatan}</span> &bull; {k.organisasi}{' '}
                        {k.nomor_telepon && <span className="font-mono">&bull; {k.nomor_telepon}</span>}
                      </span>
                    </div>
                  </div>

                  <div className="kk-kontak-actions">
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn sm kk-whatsapp-btn"
                        aria-label={`Kirim pesan WhatsApp ke ${k.nama}`}
                      >
                        <i className="fa-brands fa-whatsapp" style={{ fontSize: '13.5px' }} />
                        <span className="only-desktop">Chat</span>
                      </a>
                    )}
                    {k.nomor_telepon && (
                      <a
                        href={`tel:${k.nomor_telepon}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn sm kk-phone-btn"
                        aria-label={`Hubungi nomor telepon ${k.nama}`}
                        style={{
                          width: '34px',
                          height: '34px',
                          minWidth: '34px',
                          minHeight: '34px',
                          padding: 0,
                          borderRadius: 'var(--ptv-curve-pill)',
                        }}
                        title="Telepon"
                      >
                        <i className="fa-solid fa-phone" style={{ fontSize: '12px' }} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn sm kk-kontak-detail-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContact(k);
                      }}
                      style={{
                        minHeight: '34px',
                        height: '34px',
                        padding: '0 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: 'var(--ptv-curve-pill)',
                      }}
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <KontakEksternalDetailDrawer
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        canManage={canManage}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

      {/* Modal Form Tambah / Edit */}
      <KontakEksternalFormModal
        isOpen={isFormOpen}
        isEdit={Boolean(editingContact)}
        initialData={editingContact}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveForm}
      />

      {/* Modal Konfirmasi Hapus */}
      {isDeleteModalOpen && contactToDelete && (
        <div className="kk-drawer-overlay" onClick={() => setIsDeleteModalOpen(false)} role="dialog">
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
              margin: 'auto',
              boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#dc2626',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                  fontSize: '20px',
                }}
              >
                <i className="fa-solid fa-triangle-exclamation" />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                Hapus Kontak Relasi?
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.45 }}>
                Apakah Anda yakin ingin menghapus <b>{contactToDelete.nama}</b> ({contactToDelete.lembaga})?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ flex: 1, minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn dang"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{ flex: 1, minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)' }}
              >
                <i className={isDeleting ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-trash'} style={{ marginRight: '6px' }} />
                {isDeleting ? 'Menghapus dari Staging...' : 'Hapus Kontak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
