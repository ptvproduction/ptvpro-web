// ============================================================
// js/modules/catatan.js — Modul Catatan Bersama & Notulensi
// Terhubung langsung ke Supabase: ptv_catatan
// ATURAN: Autosave NONAKTIF. Simpan hanya via tombol 'Simpan Catatan'.
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allNotes      = [];
let _activeCategory= 'semua';
let _searchQuery   = '';
let _viewMode      = 'list'; // 'list' | 'detail'
let _detailNoteId  = null;

const CATEGORIES = ['Semua', 'Rapat', 'Produksi', 'Operasional', 'Teknis', 'Pengumuman'];

// ── ENTRY POINT ───────────────────────────────────────────
export async function render(container, fullHash) {
  const parts = fullHash.split(':');
  if (parts.length >= 2 && parts[1]) {
    _viewMode = 'detail';
    _detailNoteId = parts[1];
  } else {
    _viewMode = 'list';
    _detailNoteId = null;
  }

  _renderSkeleton(container);
  await _loadData();

  if (_viewMode === 'detail' && _detailNoteId) {
    _renderDetail(container, _detailNoteId);
  } else {
    _renderList(container);
  }
}

// ── LOAD DATA ─────────────────────────────────────────────
async function _loadData() {
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('ptv_catatan')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) console.error('[CATATAN] Load error:', error);
    _allNotes = data || [];
  } catch (err) {
    console.error('[CATATAN] Fatal load error:', err);
  }
}

// ── SKELETON ──────────────────────────────────────────────
function _renderSkeleton(container) {
  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        ${[1,2,3,4].map(() => `<div class="skeleton" style="width:90px;height:34px;border-radius:99px;"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
        ${[1,2,3,4,5,6].map(() => `<div class="skeleton glass-card" style="height:190px;"></div>`).join('')}
      </div>
    </div>`;
}

// ── RENDER LIST ───────────────────────────────────────────
function _renderList(container) {
  const filtered = _applyFilter();

  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <!-- Action Bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap;">
        <!-- Category Pills -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${CATEGORIES.map(cat => {
            const key = cat.toLowerCase();
            const isActive = _activeCategory === key;
            return `
              <button
                class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}"
                data-category="${key}"
                style="font-size:12.5px;padding:6px 14px;border-radius:99px;"
              >${cat}</button>
            `;
          }).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:440px;min-width:240px;justify-content:flex-end;">
          <!-- Search -->
          <div style="position:relative;flex:1;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
            <input
              id="searchNote"
              type="text"
              class="input-field"
              placeholder="Cari catatan atau notulensi..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          <!-- Tambah Catatan Button -->
          <button id="btnTambahCatatan" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;">
            <i class="fa-solid fa-pen-to-square"></i> Tulis Catatan
          </button>
        </div>
      </div>

      <!-- Grid Cards -->
      <div id="notesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
        ${filtered.length > 0 ? filtered.map(n => _noteCardHTML(n)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachListEvents(container);
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const q = _searchQuery.toLowerCase().trim();

  return _allNotes.filter(n => {
    const cat = (n.kategori || 'umum').toLowerCase();
    if (_activeCategory !== 'semua' && cat !== _activeCategory) return false;

    if (q) {
      const matchJudul = (n.judul || '').toLowerCase().includes(q);
      const matchIsi   = (n.isi || '').toLowerCase().includes(q);
      const matchAuthor= (n.created_by_name || '').toLowerCase().includes(q);
      if (!matchJudul && !matchIsi && !matchAuthor) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _noteCardHTML(n) {
  // Buang tag HTML untuk snippet
  let plainText = (n.isi || '').replace(/<[^>]+>/g, ' ').trim();
  if (plainText.length > 130) plainText = plainText.substring(0, 130) + '...';

  const isPinned = !!n.is_pinned;
  const author = n.created_by_name || 'Kru PTV';
  const cat = n.kategori || 'Umum';

  return `
    <div
      class="glass-card noteCard"
      data-id="${n.id}"
      style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;position:relative;border-top:3px solid ${isPinned ? 'var(--ptv-gold)' : 'var(--ptv-blue)'};transition:transform .15s ease, border-color .15s ease;"
    >
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
          <span class="badge" style="background:rgba(59,130,246,0.12);color:var(--ptv-blue);font-size:11px;">
            ${cat}
          </span>
          ${isPinned ? `
            <span style="font-size:11px;font-weight:700;color:var(--ptv-gold);display:flex;align-items:center;gap:4px;">
              <i class="fa-solid fa-thumbtack"></i> Disematkan
            </span>
          ` : ''}
        </div>

        <h3 style="font-size:16px;font-weight:800;color:var(--ptv-text);margin-bottom:8px;line-height:1.4;">
          ${n.judul || 'Tanpa Judul'}
        </h3>

        <p style="font-size:13px;color:var(--ptv-text-soft);line-height:1.6;margin-bottom:16px;">
          ${plainText || 'Tidak ada teks pratinjau.'}
        </p>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--ptv-text-dim);border-top:1px solid var(--ptv-border-soft);padding-top:10px;">
        <span style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-user" style="color:var(--ptv-cyan);"></i>
          <strong style="color:var(--ptv-text-soft);">${author}</strong>
        </span>
        <span>${_fmtDate(n.updated_at || n.created_at)}</span>
      </div>
    </div>`;
}

function _fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function _emptyHTML() {
  return `
    <div class="glass-card" style="grid-column:1/-1;text-align:center;padding:56px 24px;color:var(--ptv-text-dim);">
      <i class="fa-solid fa-book-open" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-blue);opacity:0.7;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Belum Ada Catatan</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Buat catatan bersama atau notulensi rapat pertama Anda sekarang.
      </p>
    </div>`;
}

// ── LIST EVENTS ───────────────────────────────────────────
function _attachListEvents(container) {
  container.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeCategory = btn.dataset.category;
      _renderList(container);
    });
  });

  const sInput = container.querySelector('#searchNote');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const grid = container.querySelector('#notesGrid');
      if (grid) {
        grid.innerHTML = filtered.length > 0 ? filtered.map(n => _noteCardHTML(n)).join('') : _emptyHTML();
        _attachCardClickEvents(container);
      }
    });
  }

  container.querySelector('#btnTambahCatatan')?.addEventListener('click', () => {
    _openNoteEditor(null, container);
  });

  _attachCardClickEvents(container);
}

function _attachCardClickEvents(container) {
  container.querySelectorAll('.noteCard').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      window.location.hash = '#catatan:' + id;
    });
  });
}

// ── DETAIL VIEW ───────────────────────────────────────────
function _renderDetail(container, id) {
  const note = _allNotes.find(n => n.id === id);
  if (!note) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--ptv-text-dim);">Catatan tidak ditemukan.<br><a href="#catatan" class="btn btn-ghost btn-sm" style="margin-top:12px;">Kembali</a></div>`;
    return;
  }

  const isOwner = note.created_by_id === currentCrew?.id || note.created_by_name === currentCrew?.name;
  const canEdit = isOwner || isExec();

  container.innerHTML = `
    <div style="max-width:840px;margin:0 auto;">
      <!-- Back & Actions -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <button id="btnBackToNotes" class="btn btn-ghost btn-sm" style="gap:6px;">
          <i class="fa-solid fa-arrow-left"></i> Semua Catatan
        </button>

        <div style="display:flex;gap:8px;">
          <button id="btnTogglePin" class="btn btn-ghost btn-sm" style="gap:6px;color:${note.is_pinned ? 'var(--ptv-gold)' : 'var(--ptv-text-dim)'};">
            <i class="fa-solid fa-thumbtack"></i> ${note.is_pinned ? 'Lepas Sematan' : 'Sematkan'}
          </button>
          ${canEdit ? `
            <button id="btnEditNote" class="btn btn-ghost btn-sm" style="gap:6px;color:var(--ptv-blue);">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button id="btnDeleteNote" class="btn btn-ghost btn-sm" style="gap:6px;color:var(--ptv-red);">
              <i class="fa-solid fa-trash"></i> Hapus
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Note Document Card -->
      <div class="glass-card" style="padding:36px;border-top:4px solid ${note.is_pinned ? 'var(--ptv-gold)' : 'var(--ptv-blue)'};">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span class="badge" style="background:rgba(59,130,246,0.15);color:var(--ptv-blue);font-size:11.5px;">
            ${note.kategori || 'Umum'}
          </span>
          ${note.is_pinned ? `
            <span class="badge" style="background:rgba(197,163,90,0.15);color:var(--ptv-gold);font-size:11.5px;">
              <i class="fa-solid fa-thumbtack" style="margin-right:4px;"></i>Disematkan
            </span>
          ` : ''}
        </div>

        <h1 style="font-size:24px;font-weight:800;color:var(--ptv-text);margin-bottom:14px;line-height:1.35;">
          ${note.judul || 'Tanpa Judul'}
        </h1>

        <div style="display:flex;align-items:center;gap:16px;font-size:12.5px;color:var(--ptv-text-dim);border-bottom:1px solid var(--ptv-border-soft);padding-bottom:18px;margin-bottom:24px;">
          <span>Ditulis oleh: <strong style="color:var(--ptv-text-soft);">${note.created_by_name || 'Kru PTV'}</strong></span>
          <span>•</span>
          <span>Diperbarui: ${_fmtDate(note.updated_at || note.created_at)}</span>
        </div>

        <!-- Note Content Body -->
        <div id="noteContentBody" style="font-size:14.5px;line-height:1.8;color:var(--ptv-text);min-height:160px;">
          ${note.isi || '<p class="text-muted">Tidak ada isi catatan.</p>'}
        </div>
      </div>
    </div>`;

  container.querySelector('#btnBackToNotes')?.addEventListener('click', () => {
    window.location.hash = '#catatan';
  });

  container.querySelector('#btnTogglePin')?.addEventListener('click', async () => {
    const sb = getSupabase();
    try {
      const { error } = await sb
        .from('ptv_catatan')
        .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      if (window.toast) window.toast(note.is_pinned ? 'Sematan dilepas' : 'Catatan disematkan di atas!', 'info');
      await _loadData();
      _renderDetail(container, id);
    } catch (err) {
      alert('Gagal mengubah pin: ' + (err.message || err));
    }
  });

  container.querySelector('#btnEditNote')?.addEventListener('click', () => {
    _openNoteEditor(note, container);
  });

  container.querySelector('#btnDeleteNote')?.addEventListener('click', async () => {
    if (!confirm('Hapus catatan ini secara permanen?')) return;
    const sb = getSupabase();
    try {
      const { error } = await sb.from('ptv_catatan').delete().eq('id', id);
      if (error) throw error;
      if (window.toast) window.toast('Catatan berhasil dihapus.', 'info');
      window.location.hash = '#catatan';
    } catch (err) {
      alert('Gagal menghapus catatan: ' + (err.message || err));
    }
  });
}

// ── MODAL NOTE EDITOR (AUTOSAVE NONAKTIF) ─────────────────
function _openNoteEditor(existingNote, container) {
  const isEdit = !!existingNote;
  const overlay = document.createElement('div');
  overlay.id = 'noteEditorModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:760px;max-height:92vh;display:flex;flex-direction:column;padding:28px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-pen-nib" style="font-size:16px;"></i>
          </div>
          <div>
            <h3 style="font-size:17px;font-weight:800;margin:0;">${isEdit ? 'Edit Catatan' : 'Tulis Catatan Bersama'}</h3>
            <span style="font-size:11.5px;color:var(--ptv-yellow);"><i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i>Autosave nonaktif. Klik 'Simpan Catatan' untuk menyimpan.</span>
          </div>
        </div>
        <button id="closeEditorModal" class="btn btn-ghost btn-sm" style="font-size:16px;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Form Inputs -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Judul Catatan <span style="color:var(--ptv-red);">*</span></label>
          <input id="fJudulNote" type="text" class="input-field" placeholder="Judul rapat / catatan produksi..." value="${existingNote?.judul || ''}" required>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kategori</label>
          <select id="fKategoriNote" class="input-field">
            ${CATEGORIES.filter(c => c !== 'Semua').map(c => `
              <option value="${c}" ${(existingNote?.kategori || 'Rapat') === c ? 'selected' : ''}>${c}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Editor Toolbar -->
      <div style="display:flex;gap:4px;background:rgba(255,255,255,0.03);padding:6px;border-radius:8px 8px 0 0;border:1px solid var(--ptv-border-soft);border-bottom:none;">
        <button type="button" class="btn btn-ghost btn-sm btnTool" data-cmd="bold" title="Tebal" style="padding:4px 10px;"><i class="fa-solid fa-bold"></i></button>
        <button type="button" class="btn btn-ghost btn-sm btnTool" data-cmd="italic" title="Miring" style="padding:4px 10px;"><i class="fa-solid fa-italic"></i></button>
        <button type="button" class="btn btn-ghost btn-sm btnTool" data-cmd="insertUnorderedList" title="Daftar Poin" style="padding:4px 10px;"><i class="fa-solid fa-list-ul"></i></button>
        <button type="button" class="btn btn-ghost btn-sm btnTool" data-cmd="insertOrderedList" title="Daftar Nomor" style="padding:4px 10px;"><i class="fa-solid fa-list-ol"></i></button>
      </div>

      <!-- Contenteditable Area -->
      <div
        id="editorContent"
        contenteditable="true"
        style="flex:1;min-height:220px;max-height:360px;overflow-y:auto;background:rgba(0,0,0,0.25);border:1px solid var(--ptv-border-soft);border-radius:0 0 8px 8px;padding:14px;font-size:14px;line-height:1.7;color:var(--ptv-text);outline:none;"
      >${existingNote?.isi || ''}</div>

      <!-- Actions -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--ptv-border-soft);padding-top:14px;">
        <span id="unsavedStatus" style="font-size:12px;color:var(--ptv-text-dim);">
          <i class="fa-solid fa-circle-dot" style="font-size:8px;margin-right:4px;"></i>Siap diedit
        </span>

        <div style="display:flex;gap:10px;">
          <button type="button" id="btnCancelEditor" class="btn btn-ghost btn-sm">Batal</button>
          <button type="button" id="btnSaveNote" class="btn btn-primary btn-sm" style="padding:8px 22px;">
            <i class="fa-solid fa-floppy-disk"></i> Simpan Catatan
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const editor = overlay.querySelector('#editorContent');
  const statusEl = overlay.querySelector('#unsavedStatus');

  editor.addEventListener('input', () => {
    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--ptv-yellow);"><i class="fa-solid fa-pen" style="margin-right:4px;"></i>Ada perubahan belum disimpan</span>';
    }
  });

  // Formatting tools
  overlay.querySelectorAll('.btnTool').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    });
  });

  overlay.querySelector('#closeEditorModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelEditor')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnSaveNote')?.addEventListener('click', async () => {
    const judulVal = overlay.querySelector('#fJudulNote').value.trim();
    const katVal   = overlay.querySelector('#fKategoriNote').value;
    const isiVal   = editor.innerHTML.trim();
    const saveBtn  = overlay.querySelector('#btnSaveNote');

    if (!judulVal) {
      alert('Judul catatan wajib diisi!');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    try {
      if (isEdit) {
        const { error } = await sb
          .from('ptv_catatan')
          .update({
            judul: judulVal,
            kategori: katVal,
            isi: isiVal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingNote.id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('ptv_catatan')
          .insert({
            judul: judulVal,
            kategori: katVal,
            isi: isiVal,
            created_by_name: currentCrew?.name || 'Kru PTV',
            created_by_id: currentCrew?.id || null,
            is_pinned: false,
          });
        if (error) throw error;
      }

      overlay.remove();
      if (window.toast) window.toast('Catatan berhasil disimpan!', 'success');
      await _loadData();
      if (isEdit) {
        _renderDetail(container, existingNote.id);
      } else {
        _renderList(container);
      }
    } catch (err) {
      console.error('[CATATAN] Save error:', err);
      alert('Gagal menyimpan catatan: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Catatan';
    }
  });
}
