import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import '@/styles/catatan.css';
import {
  NoteItem,
  NoteType,
  NoteCategoryKey,
  NoteTypeFilter,
  NoteCategoryFilter,
  NOTE_CATEGORIES
} from './types';
import { catatanService } from './catatanService';
import { useModalScrollLock } from './hooks/useModalScrollLock';
import { sanitizeHtml, stripHtml } from './utils/htmlSanitizer';
import { NoteRichEditor } from './components/NoteRichEditor';
import { NoteCategoryDropdown } from './components/NoteCategoryDropdown';
import { CardListSkeleton } from '@/shared/components';
import { useInstantData } from '@/shared/hooks/useInstantData';

// Format waktu relatif Bahasa Indonesia
function formatTimeAgo(isoStr: string): string {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Format tanggal lengkap
function formatFullDate(isoStr: string): string {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Helper: Ekstraksi judul catatan dari isi rich text (Persis PHP Legacy L18124)
function extractTitleFromContent(html: string): string {
  if (!html) return 'Tanpa Judul';
  const clean = html.replace(/<!--\s*PTV_META:[\s\S]*?-->/g, '').trim();
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = clean;
    const heading = temp.querySelector('h1, h2, h3, h4');
    if (heading && heading.textContent?.trim()) {
      return heading.textContent.trim().substring(0, 90);
    }
    const text = (temp.textContent || temp.innerText || '').trim();
    if (!text) return 'Tanpa Judul';
    const firstLine = text.split('\n').map(l => l.trim()).filter(Boolean)[0];
    return (firstLine || 'Tanpa Judul').substring(0, 90);
  }
  const match = clean.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
  if (match && match[1]) {
    return match[1].replace(/<[^>]+>/g, '').trim().substring(0, 90) || 'Tanpa Judul';
  }
  const plain = clean.replace(/<[^>]+>/g, ' ').trim();
  return plain.split('\n')[0]?.trim().substring(0, 90) || 'Tanpa Judul';
}

export const CatatanPage: React.FC = () => {
  // State data utama dari Supabase Staging dengan Instant-First Cache
  const {
    data: notes,
    isLoading: loading,
    error,
    refetch: refetchNotes,
    mutate: setNotes,
  } = useInstantData<NoteItem[]>({
    key: 'catatan_kru_list',
    fetcher: () => catatanService.getNotes(),
    initialData: [],
    ttlMs: 5 * 60 * 1000,
  });

  // State navigasi dan filter
  const [typeFilter, setTypeFilter] = useState<NoteTypeFilter>('shared');
  const [categoryFilter, setCategoryFilter] = useState<NoteCategoryFilter>('semua');
  const [searchQuery, setSearchQuery] = useState('');

  // State modal
  const [detailNote, setDetailNote] = useState<NoteItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<NoteItem | null>(null);

  // Modal Refs & Background Scroll Lock + Accessibility Hooks
  const detailModalRef = useRef<HTMLDivElement>(null);
  const formModalRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(detailNote),
    onClose: () => setDetailNote(null),
    modalRef: detailModalRef,
    id: 'catatan-detail-modal',
  });

  useModalScrollLock({
    isOpen: isFormOpen,
    onClose: () => setIsFormOpen(false),
    modalRef: formModalRef,
    id: 'catatan-form-modal',
  });

  useModalScrollLock({
    isOpen: Boolean(deleteConfirmNote),
    onClose: () => setDeleteConfirmNote(null),
    modalRef: deleteModalRef,
    id: 'catatan-delete-confirm-modal',
  });

  // State form input
  const [formType, setFormType] = useState<NoteType>('shared');
  const [formCategory, setFormCategory] = useState<NoteCategoryKey>('orange');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Form metadata khusus notulensi rapat
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLoc, setMeetingLoc] = useState('');
  const [meetingAtt, setMeetingAtt] = useState('');
  const [meetingEventName, setMeetingEventName] = useState('');

  // State mutasi persistensi
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  // Perhitungan count tab
  const sharedCount = useMemo(() => notes.filter(n => n.tipe === 'shared').length, [notes]);
  const meetingCount = useMemo(() => notes.filter(n => n.tipe === 'meeting_minutes').length, [notes]);
  const allCount = notes.length;

  // Filter scoped berdasarkan jenis tab
  const typeScopedNotes = useMemo(() => {
    if (typeFilter === 'shared') return notes.filter(n => n.tipe === 'shared');
    if (typeFilter === 'meeting_minutes') return notes.filter(n => n.tipe === 'meeting_minutes');
    return notes;
  }, [notes, typeFilter]);

  // Filter pencarian dan kategori warna
  const filteredNotes = useMemo(() => {
    let result = typeScopedNotes;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter(n => {
        const titleMatch = (n.judul || '').toLowerCase().includes(q);
        const bodyMatch = stripHtml(n.isi || '').toLowerCase().includes(q);
        const authorMatch = (n.created_by_name || '').toLowerCase().includes(q);
        const tagsMatch = n.tags.some(t => t.toLowerCase().includes(q));
        const eventMatch = (n.meeting_meta?.event_name || '').toLowerCase().includes(q);
        return titleMatch || bodyMatch || authorMatch || tagsMatch || eventMatch;
      });
    }

    if (categoryFilter === 'pinned') {
      result = result.filter(n => n.is_pinned);
    } else if (categoryFilter !== 'semua') {
      result = result.filter(n => n.warna === categoryFilter);
    }

    return result;
  }, [typeScopedNotes, searchQuery, categoryFilter]);

  // Pemisahan catatan tersemat (pinned)
  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.is_pinned), [filteredNotes]);
  const regularNotes = useMemo(() => {
    if (categoryFilter === 'pinned') return [];
    return filteredNotes.filter(n => !n.is_pinned);
  }, [filteredNotes, categoryFilter]);

  // Buka form untuk membuat catatan baru
  const handleOpenCreate = (presetCategory: NoteCategoryKey = 'orange') => {
    setEditingNoteId(null);
    const defaultType = typeFilter === 'meeting_minutes' ? 'meeting_minutes' : 'shared';
    setFormType(defaultType);
    setFormCategory(presetCategory);
    setFormTitle('');

    // Initial HTML template
    if (defaultType === 'meeting_minutes') {
      const todayIso = new Date().toISOString().split('T')[0];
      setFormContent(`<h1>Notulensi Rapat</h1>
<p><strong>Hari / Tanggal:</strong> ${formatFullDate(todayIso)}<br>
<strong>Waktu:</strong> 09:00 - 11:30 WIB<br>
<strong>Tempat / Media:</strong> Studio PTV / Google Meet<br>
<strong>Peserta:</strong> Tim PTV</p>

<h2>1. Agenda Pembahasan</h2>
<p>• </p>

<h2>2. Pembahasan &amp; Keputusan Rapat</h2>
<p>• </p>

<h2>3. Tindak Lanjut (Action Items)</h2>
<p>• </p>`);
    } else {
      setFormContent('');
    }

    setFormTags([]);
    setFormTagInput('');
    setFormIsPinned(false);
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setMeetingTime('09:00 - 11:30 WIB');
    setMeetingLoc('Studio PTV / Google Meet');
    setMeetingAtt('Tim PTV');
    setMeetingEventName('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Buka form untuk mengedit catatan yang sudah ada (Legacy Parity)
  const handleOpenEdit = (note: NoteItem) => {
    setEditingNoteId(note.id);
    setFormType(note.tipe);
    setFormCategory(note.warna);
    setFormTitle(note.judul || '');

    let cleanBody = (note.isi || '').replace(/<!--\s*PTV_META:[\s\S]*?-->/g, '').trim();

    // Pastikan judul dan isi muncul utuh di editor
    if (cleanBody && !/<(p|h[1-6]|ul|ol|li|div|br)[^>]*>/i.test(cleanBody)) {
      if (note.judul && note.judul !== 'Tanpa Judul' && !cleanBody.startsWith(note.judul)) {
        cleanBody = `<h1>${note.judul}</h1><p>${cleanBody.replace(/\n/g, '<br>')}</p>`;
      } else {
        cleanBody = `<p>${cleanBody.replace(/\n/g, '<br>')}</p>`;
      }
    } else if (note.judul && note.judul !== 'Tanpa Judul') {
      const temp = typeof document !== 'undefined' ? document.createElement('div') : null;
      if (temp) {
        temp.innerHTML = cleanBody;
        const heading = temp.querySelector('h1, h2, h3');
        if (!heading || !heading.textContent?.trim().includes(note.judul.trim())) {
          cleanBody = `<h1>${note.judul}</h1>\n` + cleanBody;
        }
      }
    }

    setFormContent(cleanBody);
    setFormTags([...note.tags]);
    setFormTagInput('');
    setFormIsPinned(note.is_pinned);
    setMeetingDate(note.meeting_meta?.date || '');
    setMeetingTime(note.meeting_meta?.time || '');
    setMeetingLoc(note.meeting_meta?.loc || '');
    setMeetingAtt(note.meeting_meta?.att || '');
    setMeetingEventName(note.meeting_meta?.event_name || '');
    setFormError(null);
    setDetailNote(null);
    setIsFormOpen(true);
  };

  // Simpan catatan (Create / Update permanen ke Supabase Staging)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIsi = sanitizeHtml(formContent.trim());
    if (!stripHtml(cleanIsi).trim()) {
      setFormError('Isi catatan tidak boleh kosong.');
      return;
    }

    // Ekstrak judul dari isi editor (baris pertama / heading) atau fallback
    let finalTitle = extractTitleFromContent(cleanIsi);
    if (!finalTitle || finalTitle === 'Tanpa Judul') {
      finalTitle = formTitle.trim() || 'Tanpa Judul';
    }

    setIsSavingNote(true);
    setFormError(null);

    const meetingMeta = formType === 'meeting_minutes' ? {
      date: meetingDate || undefined,
      time: meetingTime || undefined,
      loc: meetingLoc || undefined,
      att: meetingAtt || undefined,
      event_name: meetingEventName || undefined
    } : undefined;

    try {
      if (editingNoteId) {
        const updated = await catatanService.updateNote(editingNoteId, {
          judul: finalTitle,
          isi: cleanIsi,
          warna: formCategory,
          tipe: formType,
          tags: formTags,
          is_pinned: formIsPinned,
          meeting_meta: meetingMeta,
        });

        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
        if (detailNote && detailNote.id === updated.id) {
          setDetailNote(updated);
        }
      } else {
        const created = await catatanService.createNote({
          judul: finalTitle,
          isi: cleanIsi,
          warna: formCategory,
          tipe: formType,
          tags: formTags,
          is_pinned: formIsPinned,
          meeting_meta: meetingMeta,
        });

        setNotes(prev => [created, ...prev]);
      }

      setIsFormOpen(false);
      setEditingNoteId(null);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan catatan. Silakan coba lagi.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Hapus catatan permanen dari Supabase Staging
  const handleConfirmDelete = async () => {
    if (!deleteConfirmNote) return;
    setIsDeletingNote(true);
    try {
      await catatanService.deleteNote(deleteConfirmNote.id);
      setNotes(prev => prev.filter(n => n.id !== deleteConfirmNote.id));
      setDeleteConfirmNote(null);
      setDetailNote(null);
    } catch (err: any) {
      alert(`Gagal menghapus catatan: ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsDeletingNote(false);
    }
  };

  // Toggle pin catatan permanen di Supabase Staging
  const handleTogglePin = async (noteId: string) => {
    const target = notes.find(n => n.id === noteId);
    if (!target) return;
    const nextPinned = !target.is_pinned;

    // Optimistic UI update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: nextPinned } : n));
    if (detailNote && detailNote.id === noteId) {
      setDetailNote({ ...detailNote, is_pinned: nextPinned });
    }

    try {
      const updated = await catatanService.togglePin(noteId, nextPinned);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      if (detailNote && detailNote.id === updated.id) {
        setDetailNote(updated);
      }
    } catch (err: any) {
      // Rollback jika gagal
      setNotes(prev => prev.map(n => n.id === noteId ? target : n));
      if (detailNote && detailNote.id === noteId) {
        setDetailNote(target);
      }
      alert(`Gagal memperbarui status pin: ${err.message}`);
    }
  };

  // Manajemen Tag Input
  const handleAddTag = (rawTag: string) => {
    const cleaned = rawTag.trim().replace(/^#+/, '').replace(/[,\s]+/g, '').toLowerCase();
    if (!cleaned) return;
    if (formTags.length >= 5) {
      alert('Maksimal 5 tag telah tercapai.');
      return;
    }
    if (!formTags.includes(cleaned)) {
      setFormTags(prev => [...prev, cleaned]);
    }
    setFormTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddTag(formTagInput);
    } else if (e.key === 'Backspace' && !formTagInput && formTags.length > 0) {
      setFormTags(prev => prev.slice(0, -1));
    }
  };

  // Sisipkan template notulensi rapat
  const insertMeetingTemplate = () => {
    const dVal = meetingDate ? formatFullDate(meetingDate) : 'Hari Ini';
    const tpl = `<h1>Notulensi Rapat: ${formTitle || 'Koordinasi Liputan'}</h1>
<p><strong>Hari / Tanggal:</strong> ${dVal}<br>
<strong>Waktu:</strong> ${meetingTime || '09:00 - 11:30 WIB'}<br>
<strong>Tempat / Media:</strong> ${meetingLoc || 'Studio PTV'}<br>
<strong>Peserta:</strong> ${meetingAtt || 'Tim PTV'}</p>

<h2>1. Agenda Pembahasan</h2>
<p>• </p>

<h2>2. Pembahasan &amp; Keputusan Rapat</h2>
<p>• </p>

<h2>3. Tindak Lanjut (Action Items) &amp; PIC</h2>
<p>• </p>`;
    setFormContent(tpl);
  };

  return (
    <div className="catatan-page">
      {/* Header Halaman */}
      <div className="catatan-header">
        <div className="catatan-header-titles">
          <h1 className="catatan-page-title">
            {typeFilter === 'meeting_minutes'
              ? 'Notulensi Rapat PTV'
              : typeFilter === 'semua'
              ? 'Semua Catatan & Notulensi'
              : 'Catatan Bersama'}
          </h1>
          <p className="catatan-page-subtitle">
            {typeFilter === 'meeting_minutes'
              ? 'Arsip dokumentasi hasil rapat, keputusan, serta tindak lanjut tim operasional PTV'
              : 'Papan catatan 5 warna untuk koordinasi, ide kreatif, SOP alat, dan agenda kru studio'}
          </p>
        </div>
        <div>
          <button
            type="button"
            className="catatan-btn-primary"
            onClick={() => handleOpenCreate('orange')}
          >
            <i className="fa-solid fa-plus"></i>
            <span>{typeFilter === 'meeting_minutes' ? 'Tambah Notulensi' : 'Tambah Catatan'}</span>
          </button>
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="note-type-segment">
        <button
          type="button"
          className={`note-type-btn ${typeFilter === 'shared' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('shared')}
        >
          <i className="fa-solid fa-note-sticky"></i>
          <span>Catatan Bersama</span>
          <span className="badge-count">{sharedCount}</span>
        </button>
        <button
          type="button"
          className={`note-type-btn ${typeFilter === 'meeting_minutes' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('meeting_minutes')}
        >
          <i className="fa-solid fa-handshake"></i>
          <span>Notulensi Rapat</span>
          <span className="badge-count">{meetingCount}</span>
        </button>
        <button
          type="button"
          className={`note-type-btn ${typeFilter === 'semua' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('semua')}
        >
          <i className="fa-solid fa-layer-group"></i>
          <span>Semua</span>
          <span className="badge-count">{allCount}</span>
        </button>
      </div>

      {/* Kolom Pencarian */}
      <div className="catatan-search-row">
        <div className="catatan-searchbar">
          <i className="fa-solid fa-magnifying-glass catatan-search-icon"></i>
          <input
            type="text"
            className="catatan-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              typeFilter === 'meeting_minutes'
                ? 'Cari judul notulensi, topik rapat, tanggal, atau nama kru...'
                : 'Cari judul catatan, isi, tag, atau nama kru...'
            }
          />
          {searchQuery && (
            <button
              type="button"
              className="catatan-search-clear"
              onClick={() => setSearchQuery('')}
              title="Bersihkan pencarian"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Baris Filter Pills Kategori Warna */}
      <div className="notes-filter-bar">
        <button
          type="button"
          className={`notes-filter-pill ${categoryFilter === 'semua' ? 'on' : ''}`}
          onClick={() => setCategoryFilter('semua')}
        >
          <span>Semua ({typeScopedNotes.length})</span>
        </button>

        <button
          type="button"
          className={`notes-filter-pill ${categoryFilter === 'pinned' ? 'on' : ''}`}
          onClick={() => setCategoryFilter('pinned')}
        >
          <i className="fa-solid fa-thumbtack" style={{ transform: 'rotate(-30deg)' }}></i>
          <span>Tersemat ({typeScopedNotes.filter(n => n.is_pinned).length})</span>
        </button>

        {Object.values(NOTE_CATEGORIES).map(cat => (
          <button
            key={cat.key}
            type="button"
            className={`notes-filter-pill ${categoryFilter === cat.key ? 'on' : ''}`}
            onClick={() => setCategoryFilter(cat.key)}
          >
            <span
              className="notes-filter-dot"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: cat.dot
              }}
            ></span>
            <span>{cat.short}</span>
          </button>
        ))}
      </div>

      {/* Kontainer Grid Catatan */}
      <div className="catatan-container">
        {loading && notes.length === 0 ? (
          <CardListSkeleton count={4} />
        ) : error ? (
          <div className="catatan-empty-state" style={{ borderColor: 'var(--dang-border, rgba(201,42,42,0.3))' }}>
            <div className="catatan-empty-icon" style={{ color: 'var(--dang, #C92A2A)' }}>
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div className="catatan-empty-title" style={{ color: 'var(--dang, #C92A2A)' }}>Gagal Memuat Catatan</div>
            <p className="catatan-empty-desc">{error}</p>
            <button
              type="button"
              className="btn pri"
              style={{ marginTop: '14px', borderRadius: '9999px', padding: '6px 16px' }}
              onClick={() => refetchNotes()}
            >
              Coba Muat Ulang
            </button>
          </div>
        ) : (
          <>
            {/* Bagian Catatan Tersemat (Pinned) */}
            {pinnedNotes.length > 0 && categoryFilter === 'semua' && (
              <div style={{ marginBottom: '28px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--muted)'
              }}
            >
              <i className="fa-solid fa-thumbtack" style={{ color: '#d97706', transform: 'rotate(-30deg)' }}></i>
              <span>{typeFilter === 'meeting_minutes' ? 'Notulensi Tersemat' : 'Catatan Tersemat'}</span>
            </div>
            <div className="notes-grid">
              {pinnedNotes.map(note => renderCard(note))}
            </div>
          </div>
        )}

        {/* Grid Khusus Saat Filter Tersemat Aktif */}
        {categoryFilter === 'pinned' && (
          <div className="notes-grid">
            {pinnedNotes.length === 0 ? (
              <div className="catatan-empty-state">
                <div className="catatan-empty-icon">
                  <i className="fa-solid fa-thumbtack" style={{ transform: 'rotate(-30deg)' }}></i>
                </div>
                <div className="catatan-empty-title">Belum Ada Catatan Tersemat</div>
                <p className="catatan-empty-desc">
                  Sematkan catatan atau notulensi penting agar selalu berada di posisi teratas papan kerja tim.
                </p>
              </div>
            ) : (
              pinnedNotes.map(note => renderCard(note))
            )}
          </div>
        )}

            {/* Grid Utama (Semua / Kategori Tertentu) */}
            {categoryFilter !== 'pinned' && (
              <div>
                {pinnedNotes.length > 0 && categoryFilter === 'semua' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--muted)'
                    }}
                  >
                    <span>{typeFilter === 'meeting_minutes' ? 'Semua Notulensi' : 'Semua Catatan'}</span>
                  </div>
                )}

                <div className="notes-grid">
                  {regularNotes.length === 0 ? (
                    <div className="catatan-empty-state">
                      <div className="catatan-empty-icon">
                        <i className={typeFilter === 'meeting_minutes' ? 'fa-solid fa-handshake' : 'fa-solid fa-note-sticky'}></i>
                      </div>
                      <div className="catatan-empty-title">
                        {searchQuery
                          ? 'Tidak Ada Catatan yang Cocok'
                          : categoryFilter !== 'semua'
                          ? `Belum Ada Catatan ${NOTE_CATEGORIES[categoryFilter]?.short || ''}`
                          : typeFilter === 'meeting_minutes'
                          ? 'Belum Ada Notulensi Rapat'
                          : 'Belum Ada Catatan'}
                      </div>
                      <p className="catatan-empty-desc">
                        {searchQuery
                          ? `Tidak ditemukan catatan atau notulensi dengan kata kunci "${searchQuery}".`
                          : categoryFilter !== 'semua'
                          ? `Belum ada catatan yang tersimpan dengan kategori warna ${NOTE_CATEGORIES[categoryFilter]?.label || ''}.`
                          : typeFilter === 'meeting_minutes'
                          ? 'Dokumentasi hasil rapat, keputusan resmi, dan tindak lanjut tim operasional akan tampil di sini.'
                          : 'Papan catatan masih kosong. Gunakan tombol Tambah Catatan di bagian atas untuk memulai.'}
                      </p>
                    </div>
                  ) : (
                    regularNotes.map(note => renderCard(note))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Detail Catatan */}
      {detailNote && typeof document !== 'undefined' && createPortal(
        <div className="catatan-modal-backdrop" onClick={() => setDetailNote(null)}>
          <div
            ref={detailModalRef}
            className="catatan-modal-card"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-detail-title"
            tabIndex={-1}
          >
            {/* Header Modal Detail (Simple Clean Header) */}
            <div className="catatan-modal-header">
              <h2 className="catatan-modal-title" style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                {detailNote.tipe === 'meeting_minutes' ? 'Notulensi Rapat' : 'Catatan Tim'}
              </h2>
              <button
                type="button"
                className="catatan-modal-close-btn"
                onClick={() => setDetailNote(null)}
                aria-label="Tutup detail catatan"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Isi Detail Catatan */}
            <div className="catatan-modal-body" style={{ padding: '20px' }}>
              {(() => {
                const cat = NOTE_CATEGORIES[detailNote.warna] || NOTE_CATEGORIES.orange;
                const isMeeting = detailNote.tipe === 'meeting_minutes';
                const metaObj = detailNote.meeting_meta;

                return (
                  <div
                    className="catatan-legacy-detail-card"
                    style={{
                      background: cat.bg,
                      color: cat.text,
                      padding: '26px 24px',
                      borderRadius: '22px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    {/* Header Dalam Card: Kategori Pill & Pin Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            background: cat.pillBg,
                            color: cat.pillText,
                            fontSize: '12px',
                            fontWeight: 800,
                            letterSpacing: '0.02em'
                          }}
                        >
                          <i className={`fa-solid ${cat.icon}`}></i>
                          <span>{cat.label}</span>
                        </span>
                        {isMeeting && (
                          <span
                            className="note-type-badge-pill"
                            style={{
                              padding: '4px 12px',
                              fontSize: '11.5px',
                              background: cat.pillBg,
                              color: cat.pillText,
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700
                            }}
                          >
                            <i className="fa-solid fa-handshake"></i>
                            <span>Notulensi Rapat</span>
                          </span>
                        )}
                      </div>
                      {detailNote.is_pinned && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            background: cat.pillBg,
                            color: cat.pillText
                          }}
                        >
                          <i className="fa-solid fa-thumbtack" style={{ fontSize: '11.5px', transform: 'rotate(-30deg)' }}></i>
                        </span>
                      )}
                    </div>

                    {/* Judul & Meta Penulis */}
                    <div>
                      <h2
                        id="note-detail-title"
                        style={{
                          margin: '0 0 8px',
                          fontSize: '24px',
                          fontWeight: 850,
                          color: cat.text,
                          lineHeight: 1.25,
                          letterSpacing: '-0.025em',
                          wordBreak: 'break-word'
                        }}
                      >
                        {detailNote.judul || 'Tanpa Judul'}
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12.5px',
                          color: cat.meta,
                          fontWeight: 650,
                          flexWrap: 'wrap'
                        }}
                      >
                        <span>Ditulis oleh <strong>{detailNote.created_by_name || 'Kru PTV'}</strong></span>
                        <span>•</span>
                        <span>{formatFullDate(detailNote.updated_at || detailNote.created_at)}</span>
                      </div>
                    </div>

                    {/* Detail Atribut Rapat jika ada */}
                    {isMeeting && metaObj && (metaObj.date || metaObj.time || metaObj.loc || metaObj.att || metaObj.event_name) && (
                      <div
                        style={{
                          background: cat.pillBg,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          fontSize: '13px',
                          lineHeight: 1.6,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '8px',
                          color: cat.text
                        }}
                      >
                        {metaObj.date && (
                          <div>
                            <span style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Tanggal:</span>
                            <strong>{formatFullDate(metaObj.date)}</strong>
                          </div>
                        )}
                        {metaObj.time && (
                          <div>
                            <span style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Waktu:</span>
                            <strong>{metaObj.time}</strong>
                          </div>
                        )}
                        {metaObj.loc && (
                          <div>
                            <span style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Tempat/Media:</span>
                            <strong>{metaObj.loc}</strong>
                          </div>
                        )}
                        {metaObj.att && (
                          <div>
                            <span style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Peserta:</span>
                            <strong>{metaObj.att}</strong>
                          </div>
                        )}
                        {metaObj.event_name && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Terkait Acara:</span>
                            <strong>{metaObj.event_name}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tag Metadata Chips */}
                    {detailNote.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {detailNote.tags.map(t => (
                          <span
                            key={t}
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 10px',
                              background: cat.pillBg,
                              color: cat.pillText,
                              borderRadius: '999px',
                              fontWeight: 700
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ height: '1px', background: cat.pillBg, margin: '2px 0' }}></div>

                    {/* Isi Catatan Rich Prose */}
                    <div
                      className="catatan-modal-prose"
                      style={{
                        fontSize: '14.5px',
                        lineHeight: 1.7,
                        color: cat.body,
                        wordBreak: 'break-word',
                        textAlign: 'left'
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(detailNote.isi) }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal Detail: Tombol Aksi */}
            <div className="catatan-modal-footer" style={{ justifyContent: 'space-between', padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="notes-filter-pill"
                  onClick={() => handleTogglePin(detailNote.id)}
                >
                  <i className="fa-solid fa-thumbtack" style={{ transform: detailNote.is_pinned ? 'none' : 'rotate(-30deg)' }}></i>
                  <span>{detailNote.is_pinned ? 'Lepas Sematan' : 'Sematkan'}</span>
                </button>
                <button
                  type="button"
                  className="notes-filter-pill"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={() => setDeleteConfirmNote(detailNote)}
                >
                  <i className="fa-solid fa-trash"></i>
                  <span>Hapus</span>
                </button>
              </div>
              <button
                type="button"
                className="catatan-btn-primary"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: '12px',
                  padding: '9px 18px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                }}
                onClick={() => handleOpenEdit(detailNote)}
              >
                <i className="fa-solid fa-pen-to-square"></i>
                <span>Edit {detailNote.tipe === 'meeting_minutes' ? 'Notulensi' : 'Catatan'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Form Tambah / Edit Catatan */}
      {isFormOpen && typeof document !== 'undefined' && createPortal(
        <div className="catatan-modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <div
            ref={formModalRef}
            className="catatan-modal-card"
            style={{ maxWidth: '620px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-form-title"
            tabIndex={-1}
          >
            <div className="catatan-modal-header">
              <h2 id="note-form-title" className="catatan-modal-title" style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                {editingNoteId
                  ? (formType === 'meeting_minutes' ? 'Edit Notulensi Rapat' : 'Edit Catatan Bersama')
                  : (formType === 'meeting_minutes' ? 'Tambah Notulensi Rapat' : 'Tambah Catatan Bersama')}
              </h2>
              <button
                type="button"
                className="catatan-modal-close-btn"
                onClick={() => setIsFormOpen(false)}
                aria-label="Tutup formulir catatan"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="catatan-modal-body" style={{ padding: '20px', gap: '18px' }}>
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--r-md, 8px)',
                    color: '#991b1b',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }}></i>
                    <span>{formError}</span>
                  </div>
                )}

                {/* Pilihan Jenis Catatan: Catatan Bersama vs Notulensi Rapat */}
                <div>
                  <label style={{
                    fontSize: '12.5px',
                    fontWeight: 750,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                    marginBottom: '8px'
                  }}>
                    Jenis Catatan
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: `1.5px solid ${formType === 'shared' ? '#2563eb' : 'var(--line-2, #e2e8f0)'}`,
                        background: formType === 'shared' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="form_note_type"
                        checked={formType === 'shared'}
                        onChange={() => setFormType('shared')}
                        style={{ accentColor: '#2563eb', width: '17px', height: '17px', marginTop: '2px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-note-sticky" style={{ color: '#2563eb', fontSize: '12px' }}></i>
                          <span>Catatan Bersama</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.35 }}>
                          SOP, ide, panduan operasional &amp; info tim
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: `1.5px solid ${formType === 'meeting_minutes' ? '#2563eb' : 'var(--line-2, #e2e8f0)'}`,
                        background: formType === 'meeting_minutes' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="form_note_type"
                        checked={formType === 'meeting_minutes'}
                        onChange={() => setFormType('meeting_minutes')}
                        style={{ accentColor: '#2563eb', width: '17px', height: '17px', marginTop: '2px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-handshake" style={{ color: '#2563eb', fontSize: '12px' }}></i>
                          <span>Notulensi Rapat</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.35 }}>
                          Hasil rapat, keputusan, tindak lanjut &amp; PIC
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Form Khusus Notulensi Rapat jika aktif */}
                {formType === 'meeting_minutes' && (
                  <div
                    style={{
                      background: 'rgba(37, 99, 235, 0.04)',
                      border: '1px solid rgba(37, 99, 235, 0.18)',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <i className="fa-solid fa-clipboard-user" style={{ marginRight: '5px' }}></i> Atribut Rapat
                      </span>
                      <button
                        type="button"
                        onClick={insertMeetingTemplate}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '4px' }}></i> Sisipkan Template
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Tanggal Rapat</label>
                        <input
                          type="date"
                          className="catatan-form-input sm"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Waktu Rapat</label>
                        <input
                          type="text"
                          className="catatan-form-input sm"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          placeholder="Misal: 09:00 - 11:30 WIB"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Tempat / Media</label>
                        <input
                          type="text"
                          className="catatan-form-input sm"
                          value={meetingLoc}
                          onChange={(e) => setMeetingLoc(e.target.value)}
                          placeholder="Misal: Studio PTV / Google Meet"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Peserta Rapat</label>
                        <input
                          type="text"
                          className="catatan-form-input sm"
                          value={meetingAtt}
                          onChange={(e) => setMeetingAtt(e.target.value)}
                          placeholder="Misal: Kru Produksi & Medsos"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Kategori Warna (5 Palet Resmi) */}
                <div>
                  <label style={{
                    fontSize: '12.5px',
                    fontWeight: 750,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                    marginBottom: '8px'
                  }}>
                    Pilih Kategori &amp; Warna Catatan
                  </label>
                  <NoteCategoryDropdown
                    value={formCategory}
                    onChange={(newCat) => setFormCategory(newCat)}
                  />
                </div>

                {/* Toolbar Format & Isi Catatan WYSIWYG */}
                <div>
                  <label style={{
                    fontSize: '12.5px',
                    fontWeight: 750,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Isi Catatan / Notulensi
                  </label>
                  <NoteRichEditor
                    key={editingNoteId || 'new-note'}
                    initialHtml={formContent}
                    onChange={(html) => setFormContent(html)}
                    placeholder="Tuliskan isi catatan atau notulensi di sini..."
                  />
                </div>

                {/* Tag Metadata Input (Maksimal 5) */}
                <div className="note-tag-wrapper">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{
                      fontSize: '12.5px',
                      fontWeight: 750,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      margin: 0
                    }}>
                      Tag Tambahan
                    </label>
                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: formTags.length >= 5 ? '#fef2f2' : 'var(--bg-2, #f1f5f9)',
                      color: formTags.length >= 5 ? '#dc2626' : 'var(--muted)'
                    }}>
                      {formTags.length}/5 Tag
                    </span>
                  </div>
                  <div className="note-tag-box" onClick={() => {
                    const inputEl = document.querySelector<HTMLInputElement>('.note-tag-input-field');
                    inputEl?.focus();
                  }}>
                    {formTags.map(t => (
                      <span key={t} className="note-tag-chip">
                        <span>#{t}</span>
                        <span
                          className="note-tag-chip-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(t);
                          }}
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </span>
                      </span>
                    ))}
                    {formTags.length < 5 ? (
                      <input
                        type="text"
                        className="note-tag-input-field"
                        value={formTagInput}
                        onChange={(e) => setFormTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder={formTags.length === 0 ? 'Ketik tag lalu tekan Enter atau Koma...' : 'Tambah tag...'}
                      />
                    ) : (
                      <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                        Batas 5 tag tercapai
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    Ketik tag lalu tekan Enter atau , (Maksimal 5 tag seperti Instagram)
                  </div>
                </div>

                {/* Checkbox Sematkan */}
                <div style={{ paddingTop: '4px' }}>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <span>
                      <i className="fa-solid fa-thumbtack" style={{ color: '#d97706', transform: 'rotate(-30deg)', marginRight: '6px' }}></i>
                      Sematkan di paling atas (Pinned)
                    </span>
                  </label>
                </div>
              </div>

              {/* Footer Modal Form (Full Width Action Button) */}
              <div className="catatan-modal-footer" style={{ padding: '16px 20px', background: 'var(--surface, #ffffff)' }}>
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="catatan-btn-primary block"
                  style={{
                    width: '100%',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '14px',
                    padding: '13px',
                    fontWeight: 750,
                    fontSize: '14.5px',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.28)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isSavingNote ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>{editingNoteId ? 'Perbarui Catatan' : 'Simpan Catatan'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirmNote && typeof document !== 'undefined' && createPortal(
        <div className="catatan-modal-backdrop" onClick={() => !isDeletingNote && setDeleteConfirmNote(null)}>
          <div
            ref={deleteModalRef}
            className="catatan-modal-card"
            style={{ maxWidth: '420px', padding: '24px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-delete-title"
            tabIndex={-1}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: 'var(--r-full, 999px)',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'grid',
                placeItems: 'center',
                fontSize: '22px',
                margin: '0 auto 14px'
              }}
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 id="note-delete-title" style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
              Hapus Catatan Ini?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus catatan <strong>&ldquo;{deleteConfirmNote.judul}&rdquo;</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="notes-filter-pill"
                disabled={isDeletingNote}
                onClick={() => setDeleteConfirmNote(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="catatan-btn-primary"
                style={{ background: '#dc2626' }}
                disabled={isDeletingNote}
                onClick={handleConfirmDelete}
              >
                {isDeletingNote ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  // Fungsi render satuan kartu docket
  function renderCard(note: NoteItem) {
    const cat = NOTE_CATEGORIES[note.warna] || NOTE_CATEGORIES.orange;
    const isMeeting = note.tipe === 'meeting_minutes';
    const cleanPreview = stripHtml(note.isi);

    return (
      <div
        key={note.id}
        className={`note-card-docket color-${cat.key}`}
        onClick={() => setDetailNote(note)}
        role="button"
        tabIndex={0}
      >
        {/* Header Kartu */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: 'var(--r-full, 999px)',
                backgroundColor: cat.pillBg,
                color: cat.pillText,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.02em'
              }}
            >
              <i className={`fa-solid ${cat.icon}`} style={{ fontSize: '10px' }}></i>
              <span>{cat.short}</span>
            </span>

            {isMeeting && (
              <span className="note-type-badge-pill" title="Notulensi Rapat">
                <i className="fa-solid fa-handshake" style={{ fontSize: '9.5px' }}></i>
                <span>Notulensi</span>
              </span>
            )}
          </div>

          {note.is_pinned && (
            <span
              className="note-pin-badge"
              style={{ backgroundColor: cat.pillBg, color: cat.pillText }}
              title="Catatan Tersemat"
            >
              <i className="fa-solid fa-thumbtack" style={{ transform: 'rotate(-30deg)' }}></i>
            </span>
          )}
        </div>

        {/* Body Kartu: Judul, Meta Rapat, dan Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '12px', marginBottom: '14px' }}>
          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '16.5px',
              fontWeight: 700,
              color: cat.text,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              letterSpacing: '-0.015em'
            }}
          >
            {note.judul || 'Tanpa Judul'}
          </h3>

          {isMeeting && note.meeting_meta && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: cat.meta,
                marginBottom: '6px',
                flexWrap: 'wrap'
              }}
            >
              {note.meeting_meta.date && (
                <span>
                  <i className="fa-solid fa-calendar" style={{ marginRight: '4px' }}></i>
                  {formatFullDate(note.meeting_meta.date)}
                </span>
              )}
              {note.meeting_meta.loc && (
                <span>
                  <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                  {note.meeting_meta.loc}
                </span>
              )}
            </div>
          )}

          <p
            style={{
              margin: 0,
              padding: 0,
              color: cat.body,
              fontSize: '13.5px',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
              textAlign: 'left'
            }}
          >
            {cleanPreview}
          </p>
        </div>

        {/* Footer Kartu: Penulis & Tombol Detail */}
        <div
          style={{
            paddingTop: '10px',
            borderTop: `1px solid ${cat.pillBg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: cat.meta }}>
              {formatTimeAgo(note.updated_at || note.created_at)}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: cat.meta,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              Oleh {note.created_by_name || 'Kru PTV'}
            </span>
          </div>

          <button
            type="button"
            className="note-card-action-btn"
            style={{ backgroundColor: cat.pillBg, color: cat.pillText }}
            title="Buka Detail Catatan"
            onClick={(e) => {
              e.stopPropagation();
              setDetailNote(note);
            }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
        </div>
      </div>
    );
  }
};
