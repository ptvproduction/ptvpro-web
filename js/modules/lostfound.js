// ============================================================
// js/modules/lostfound.js — Modul Pelacakan Lost & Found
// Terhubung langsung ke Supabase: ptv_lost_found
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allLost       = [];
let _activeFilter  = 'semua'; // 'semua' | 'dicari' | 'ditemukan' | 'dikembalikan'
let _searchQuery   = '';

// ── ENTRY POINT ───────────────────────────────────────────
export async function render(container, fullHash) {
  _renderSkeleton(container);
  await _loadData();
  _renderView(container);
}

// ── LOAD DATA ─────────────────────────────────────────────
async function _loadData() {
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('ptv_lost_found')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('[LOSTFOUND] Load error:', error);
    _allLost = data || [];
  } catch (err) {
    console.error('[LOSTFOUND] Fatal error:', err);
  }
}

// ── SKELETON ──────────────────────────────────────────────
function _renderSkeleton(container) {
  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
        ${[1,2,3,4].map(() => `<div class="skeleton glass-card" style="height:90px;"></div>`).join('')}
      </div>
      <div class="skeleton" style="height:44px;margin-bottom:20px;border-radius:10px;"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
        ${[1,2,3,4].map(() => `<div class="skeleton glass-card" style="height:180px;"></div>`).join('')}
      </div>
    </div>`;
}

// ── RENDER VIEW ───────────────────────────────────────────
function _renderView(container) {
  const filtered = _applyFilter();

  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <!-- Stats Cards -->
      ${_statsCardsHTML()}

      <!-- Action Bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${[
            { key: 'semua',        label: 'Semua Barang' },
            { key: 'dicari',       label: 'Masih Dicari' },
            { key: 'ditemukan',    label: 'Ditemukan' },
            { key: 'dikembalikan', label: 'Dikembalikan' },
          ].map(f => `
            <button
              class="btn btn-sm ${f.key === _activeFilter ? 'btn-primary' : 'btn-ghost'}"
              data-filter="${f.key}"
              style="font-size:12.5px;padding:6px 14px;"
            >${f.label}</button>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:440px;min-width:240px;justify-content:flex-end;">
          <!-- Search -->
          <div style="position:relative;flex:1;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
            <input
              id="searchLost"
              type="text"
              class="input-field"
              placeholder="Cari barang, lokasi, atau pelapor..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          <!-- Tambah Laporan Button -->
          <button id="btnLostBaru" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;">
            <i class="fa-solid fa-plus"></i> Lapor Barang
          </button>
        </div>
      </div>

      <!-- Grid Cards -->
      <div id="lostListContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
        ${filtered.length > 0 ? filtered.map(l => _lostCardHTML(l)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── STATS CARDS ───────────────────────────────────────────
function _statsCardsHTML() {
  let dicariCount = 0;
  let ditemukanCount = 0;
  let selesaiCount = 0;

  _allLost.forEach(l => {
    const st = (l.status || 'dicari').toLowerCase();
    if (st === 'dicari') dicariCount++;
    else if (st === 'ditemukan') ditemukanCount++;
    else if (st === 'dikembalikan') selesaiCount++;
  });

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Masih Dicari</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-red);">
            <i class="fa-solid fa-magnifying-glass" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:${dicariCount > 0 ? 'var(--ptv-red)' : 'var(--ptv-text)'};">${dicariCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">barang hilang</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Ditemukan (Klaim)</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-yellow);">
            <i class="fa-solid fa-hand-holding-box" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-yellow);">${ditemukanCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">belum diambil</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Telah Dikembalikan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-green);">
            <i class="fa-solid fa-circle-check" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-green);">${selesaiCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">sudah diklaim</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Laporan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-box-open" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-text);">${_allLost.length} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">item tercatat</span></div>
      </div>
    </div>`;
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const q = _searchQuery.toLowerCase().trim();

  return _allLost.filter(l => {
    const st = (l.status || 'dicari').toLowerCase();
    if (_activeFilter === 'dicari' && st !== 'dicari') return false;
    if (_activeFilter === 'ditemukan' && st !== 'ditemukan') return false;
    if (_activeFilter === 'dikembalikan' && st !== 'dikembalikan') return false;

    if (q) {
      const m1 = (l.nama_barang || '').toLowerCase().includes(q);
      const m2 = (l.lokasi || '').toLowerCase().includes(q);
      const m3 = (l.keterangan || '').toLowerCase().includes(q);
      const m4 = (l.pelapor_nama || '').toLowerCase().includes(q);
      if (!m1 && !m2 && !m3 && !m4) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _lostCardHTML(l) {
  const isTemuan = (l.tipe === 'penemuan' || l.tipe === 'ditemukan');
  const st = (l.status || 'dicari').toLowerCase();

  let statusBadge = '';
  if (st === 'dicari') {
    statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--ptv-red);font-size:11px;"><i class="fa-solid fa-magnifying-glass"></i> Masih Dicari</span>`;
  } else if (st === 'ditemukan') {
    statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.15);color:var(--ptv-yellow);font-size:11px;"><i class="fa-solid fa-box"></i> Ditemukan</span>`;
  } else {
    statusBadge = `<span class="badge" style="background:rgba(16,185,129,0.15);color:var(--ptv-green);font-size:11px;"><i class="fa-solid fa-circle-check"></i> Selesai Diklaim</span>`;
  }

  const tipeBadge = isTemuan ?
    `<span class="badge" style="background:rgba(6,182,212,0.15);color:var(--ptv-cyan);font-size:11px;"><i class="fa-solid fa-hand-holding-heart"></i> Barang Temuan</span>` :
    `<span class="badge" style="background:rgba(239,68,68,0.12);color:var(--ptv-red);font-size:11px;"><i class="fa-solid fa-circle-question"></i> Barang Hilang</span>`;

  return `
    <div class="glass-card" style="padding:20px;display:flex;flex-direction:column;justify-content:space-between;border-top:3px solid ${isTemuan ? 'var(--ptv-cyan)' : 'var(--ptv-red)'};">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
          ${tipeBadge}
          ${statusBadge}
        </div>

        <h3 style="font-size:16px;font-weight:800;color:var(--ptv-text);margin-bottom:6px;">${l.nama_barang || 'Barang Tanpa Nama'}</h3>

        <div style="font-size:12.5px;color:var(--ptv-text-soft);display:flex;align-items:center;gap:6px;margin-bottom:10px;">
          <i class="fa-solid fa-location-dot" style="color:var(--ptv-blue);"></i>
          <span>${l.lokasi || 'Area Studio PTV'}</span>
        </div>

        ${l.keterangan ? `
          <p style="font-size:12.5px;color:var(--ptv-text-soft);line-height:1.6;margin-bottom:14px;background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--ptv-border-soft);">
            ${l.keterangan}
          </p>
        ` : ''}
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--ptv-text-dim);border-top:1px solid var(--ptv-border-soft);padding-top:10px;margin-bottom:12px;">
          <span>Pelapor: <strong style="color:var(--ptv-text-soft);">${l.pelapor_nama || 'Kru'}</strong></span>
          <span>${_fmtDate(l.created_at)}</span>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          ${st === 'dicari' ? `
            <button class="btn btn-ghost btn-sm btnUpdateLost" data-id="${l.id}" data-status="ditemukan" style="font-size:11.5px;color:var(--ptv-yellow);">
              <i class="fa-solid fa-check"></i> Sudah Ditemukan
            </button>
          ` : ''}

          ${st === 'ditemukan' ? `
            <button class="btn btn-primary btn-sm btnUpdateLost" data-id="${l.id}" data-status="dikembalikan" style="font-size:11.5px;">
              <i class="fa-solid fa-handshake"></i> Klaim & Kembalikan
            </button>
          ` : ''}

          ${isExec() ? `
            <button class="btn btn-ghost btn-sm btnDeleteLost" data-id="${l.id}" style="font-size:11px;color:var(--ptv-red);padding:4px 8px;" title="Hapus Laporan">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
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
      <i class="fa-solid fa-box-open" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-cyan);opacity:0.7;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Tidak Ada Laporan Lost & Found</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Belum ada laporan barang hilang maupun barang temuan yang cocok.
      </p>
    </div>`;
}

// ── EVENTS ────────────────────────────────────────────────
function _attachEvents(container) {
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;
      _renderView(container);
    });
  });

  const sInput = container.querySelector('#searchLost');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const listEl = container.querySelector('#lostListContainer');
      if (listEl) {
        listEl.innerHTML = filtered.length > 0 ? filtered.map(l => _lostCardHTML(l)).join('') : _emptyHTML();
        _attachCardEvents(container);
      }
    });
  }

  container.querySelector('#btnLostBaru')?.addEventListener('click', () => {
    _openLostModal(container);
  });

  _attachCardEvents(container);
}

function _attachCardEvents(container) {
  container.querySelectorAll('.btnUpdateLost').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const newStatus = btn.dataset.status;
      if (!confirm(`Ubah status laporan barang ini menjadi "${newStatus}"?`)) return;

      const sb = getSupabase();
      try {
        const { error } = await sb
          .from('ptv_lost_found')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        if (window.toast) window.toast(`Status barang diubah menjadi ${newStatus}!`, 'success');
        await _loadData();
        _renderView(container);
      } catch (err) {
        console.error('[LOSTFOUND] Update error:', err);
        alert('Gagal mengupdate status: ' + (err.message || err));
      }
    });
  });

  container.querySelectorAll('.btnDeleteLost').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Hapus laporan Lost & Found ini secara permanen?')) return;

      const sb = getSupabase();
      try {
        const { error } = await sb.from('ptv_lost_found').delete().eq('id', id);
        if (error) throw error;
        if (window.toast) window.toast('Laporan berhasil dihapus.', 'info');
        await _loadData();
        _renderView(container);
      } catch (err) {
        console.error('[LOSTFOUND] Delete error:', err);
        alert('Gagal menghapus: ' + (err.message || err));
      }
    });
  });
}

// ── MODAL FORM LOST & FOUND ───────────────────────────────
function _openLostModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'lostModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--ptv-border-soft);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-cyan);">
            <i class="fa-solid fa-box-open" style="font-size:16px;"></i>
          </div>
          <div>
            <h3 style="font-size:17px;font-weight:800;margin:0;">Lapor Lost & Found</h3>
            <span style="font-size:12px;color:var(--ptv-text-soft);">Catat barang hilang atau barang temuan di studio</span>
          </div>
        </div>
        <button id="closeLostModal" class="btn btn-ghost btn-sm" style="font-size:16px;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="lostForm">
        <!-- Tipe Laporan -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jenis Laporan <span style="color:var(--ptv-red);">*</span></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);border-radius:8px;cursor:pointer;">
              <input type="radio" name="tipeLost" value="kehilangan" checked style="accent-color:var(--ptv-red);">
              <span style="font-size:13px;font-weight:600;color:var(--ptv-red);"><i class="fa-solid fa-circle-question" style="margin-right:6px;"></i>Barang Hilang</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);border-radius:8px;cursor:pointer;">
              <input type="radio" name="tipeLost" value="penemuan" style="accent-color:var(--ptv-cyan);">
              <span style="font-size:13px;font-weight:600;color:var(--ptv-cyan);"><i class="fa-solid fa-hand-holding-heart" style="margin-right:6px;"></i>Barang Temuan</span>
            </label>
          </div>
        </div>

        <!-- Nama Barang -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama / Identitas Barang <span style="color:var(--ptv-red);">*</span></label>
          <input id="fNamaBarang" type="text" class="input-field" placeholder="Contoh: Dompet Hitam / Flashdisk Sandisk 64GB / Tutup Lensa Sony" required>
        </div>

        <!-- Lokasi -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Lokasi Terkait</label>
          <input id="fLokasi" type="text" class="input-field" placeholder="Contoh: Meja Editor / Lapangan Utama / Ruang Podcast">
        </div>

        <!-- Keterangan Ciri-ciri -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Ciri-ciri Khusus / Keterangan</label>
          <textarea id="fKetLost" class="input-field" rows="3" placeholder="Warna, stiker, merk, perkiraan jam kejadian..."></textarea>
        </div>

        <!-- Pelapor & Kontak -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Pelapor</label>
            <input id="fPelaporLost" type="text" class="input-field" value="${currentCrew?.name || 'Kru PTV'}" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kontak WhatsApp</label>
            <input id="fKontakLost" type="text" class="input-field" placeholder="08xxxxxxxx">
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelLost" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSubmitLost" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Simpan Laporan
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeLostModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelLost')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#lostForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipeVal    = overlay.querySelector('input[name="tipeLost"]:checked').value;
    const namaVal    = overlay.querySelector('#fNamaBarang').value.trim();
    const lokasiVal  = overlay.querySelector('#fLokasi').value.trim();
    const ketVal     = overlay.querySelector('#fKetLost').value.trim();
    const pelaporVal = overlay.querySelector('#fPelaporLost').value.trim();
    const kontakVal  = overlay.querySelector('#fKontakLost').value.trim();
    const submitBtn  = overlay.querySelector('#btnSubmitLost');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    try {
      const payload = {
        tipe:           tipeVal,
        nama_barang:    namaVal,
        lokasi:         lokasiVal,
        keterangan:     ketVal,
        pelapor_nama:   pelaporVal,
        pelapor_kontak: kontakVal,
        status:         tipeVal === 'penemuan' ? 'ditemukan' : 'dicari',
      };

      const { error } = await sb.from('ptv_lost_found').insert(payload);
      if (error) throw error;

      overlay.remove();
      if (window.toast) window.toast('Laporan Lost & Found berhasil disimpan!', 'success');

      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[LOSTFOUND] Submit error:', err);
      alert('Gagal menyimpan laporan: ' + (err.message || err));
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Laporan';
    }
  });
}
