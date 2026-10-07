// ============================================================
// js/modules/acara.js — Modul Acara & Kalender PTV Pro
// Terhubung langsung ke Supabase: ptv_acara, ptv_acara_rundown
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ────────────────────────────────────────────────────
let _allAcara = [];
let _activeFilter = 'semua';
let _searchQuery  = '';
let _viewMode     = 'list'; // 'list' | 'detail'
let _detailId     = null;

// ── ENTRY POINT ──────────────────────────────────────────────
export async function render(container, fullHash) {
  // Cek jika ada sub-route: #acara:UUID
  const parts = fullHash.split(':');
  if (parts.length >= 2 && parts[1]) {
    _viewMode  = 'detail';
    _detailId  = parts[1];
  } else {
    _viewMode  = 'list';
    _detailId  = null;
  }

  _renderSkeleton(container);
  await _loadAcara();

  if (_viewMode === 'detail' && _detailId) {
    _renderDetail(container, _detailId);
  } else {
    _renderList(container);
  }
}

// ── LOAD DATA ────────────────────────────────────────────────
async function _loadAcara() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ptv_acara')
    .select('id, nama_acara, tanggal, jam_mulai, jam_selesai, lokasi, status, deskripsi, kru_bertugas, alat_digunakan, foto_url, created_at')
    .order('tanggal', { ascending: false });

  if (error) { console.error('[ACARA] Load error:', error); return; }
  _allAcara = data || [];
}

// ── STATUS CONFIG ─────────────────────────────────────────────
const STATUS_CFG = {
  'Terjadwal':  { color: 'var(--ptv-blue)',   icon: 'clock',           bg: 'rgba(59,130,246,0.12)'  },
  'Berlangsung':{ color: 'var(--ptv-green)',  icon: 'circle-dot',      bg: 'rgba(16,185,129,0.12)'  },
  'Selesai':    { color: 'var(--ptv-text-dim)', icon: 'circle-check',  bg: 'rgba(255,255,255,0.05)' },
  'Dibatalkan': { color: 'var(--ptv-red)',    icon: 'ban',             bg: 'rgba(239,68,68,0.08)'   },
};

function _statusBadge(status) {
  const cfg = STATUS_CFG[status] || { color: 'var(--ptv-text-dim)', icon: 'circle-question', bg: 'rgba(255,255,255,0.05)' };
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.color};">
    <i class="fa-solid fa-${cfg.icon}" style="font-size:10px;"></i>${status || 'N/A'}
  </span>`;
}

function _fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function _fmtTime(t) {
  if (!t) return '';
  return t.slice(0, 5); // "HH:MM"
}

// ── SKELETON ─────────────────────────────────────────────────
function _renderSkeleton(container) {
  container.innerHTML = `
    <div style="max-width:1000px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <div class="skeleton" style="width:140px;height:26px;border-radius:8px;"></div>
        <div class="skeleton" style="width:120px;height:36px;border-radius:8px;"></div>
      </div>
      <div class="skeleton" style="width:100%;height:44px;border-radius:10px;margin-bottom:16px;"></div>
      ${[1,2,3].map(() => `<div class="skeleton glass-card" style="height:90px;margin-bottom:12px;border-radius:14px;"></div>`).join('')}
    </div>`;
}

// ── LIST VIEW ─────────────────────────────────────────────────
function _renderList(container) {
  const filtered = _applyFilter();

  container.innerHTML = `
    <div style="max-width:1000px;margin:0 auto;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap;">
        <div>
          <h2 style="font-size:20px;margin-bottom:2px;">Acara & Kalender</h2>
          <p class="text-muted text-sm">${_allAcara.length} acara tercatat</p>
        </div>
        ${isExec() ? `
        <button class="btn btn-primary btn-sm" id="btnTambahAcara">
          <i class="fa-solid fa-plus"></i> Tambah Acara
        </button>` : ''}
      </div>

      <!-- Search -->
      <div style="position:relative;margin-bottom:14px;">
        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
        <input
          id="acaraSearch"
          type="search"
          class="input-field"
          placeholder="Cari nama acara, lokasi..."
          value="${_searchQuery}"
          style="padding-left:38px;"
        >
      </div>

      <!-- Filter Chips -->
      <div style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;">
        ${['semua','Terjadwal','Berlangsung','Selesai','Dibatalkan'].map(f => `
          <button class="btn btn-sm ${_activeFilter===f?'btn-primary':'btn-ghost'} fchip" data-filter="${f}">
            ${f === 'semua' ? 'Semua ('+_allAcara.length+')' : f}
          </button>`).join('')}
      </div>

      <!-- List -->
      <div id="acaraList">
        ${filtered.length > 0 ? filtered.map(a => _cardHTML(a)).join('') : _emptyHTML()}
      </div>
    </div>`;

  // Events
  container.querySelector('#acaraSearch')?.addEventListener('input', (e) => {
    _searchQuery = e.target.value;
    document.getElementById('acaraList').innerHTML =
      _applyFilter().length > 0 ? _applyFilter().map(a => _cardHTML(a)).join('') : _emptyHTML();
  });

  container.querySelectorAll('.fchip').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;
      _renderList(container);
    });
  });

  container.querySelectorAll('[data-acara-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.acaraId;
      window.location.hash = '#acara:' + id;
    });
  });

  container.querySelector('#btnTambahAcara')?.addEventListener('click', () => _openAcaraForm(container));
}

// ── FILTER ───────────────────────────────────────────────────
function _applyFilter() {
  return _allAcara.filter(a => {
    const matchStatus = _activeFilter === 'semua' || a.status === _activeFilter;
    const q = _searchQuery.toLowerCase();
    const matchSearch = !q ||
      (a.nama_acara || '').toLowerCase().includes(q) ||
      (a.lokasi     || '').toLowerCase().includes(q) ||
      (a.deskripsi  || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });
}

// ── CARD HTML ─────────────────────────────────────────────────
function _cardHTML(a) {
  const cfg = STATUS_CFG[a.status] || STATUS_CFG['Selesai'];
  const jamStr = a.jam_mulai ? `<span><i class="fa-solid fa-clock" style="color:var(--ptv-blue);"></i> ${_fmtTime(a.jam_mulai)}${a.jam_selesai?' — '+_fmtTime(a.jam_selesai):''}</span>` : '';

  let kruCount = 0;
  try { kruCount = Array.isArray(a.kru_bertugas) ? a.kru_bertugas.length : (JSON.parse(a.kru_bertugas)||[]).length; } catch {}

  return `
    <div
      class="glass-card"
      data-acara-id="${a.id}"
      style="padding:16px 20px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:16px;border-left:3px solid ${cfg.color};"
    >
      <!-- Tanggal kolom -->
      <div style="text-align:center;min-width:48px;flex-shrink:0;">
        <div style="font-size:20px;font-weight:800;line-height:1;color:${cfg.color};">
          ${a.tanggal ? new Date(a.tanggal).getDate() : '—'}
        </div>
        <div style="font-size:10px;color:var(--ptv-text-dim);font-weight:600;text-transform:uppercase;">
          ${a.tanggal ? new Date(a.tanggal).toLocaleDateString('id-ID',{month:'short'}) : ''}
        </div>
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.nama_acara || 'Tanpa Nama'}</span>
          ${_statusBadge(a.status)}
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ptv-text-soft);">
          ${a.lokasi ? `<span><i class="fa-solid fa-location-dot" style="color:var(--ptv-blue);margin-right:4px;"></i>${a.lokasi}</span>` : ''}
          ${jamStr}
          ${kruCount > 0 ? `<span><i class="fa-solid fa-users" style="color:var(--ptv-cyan);margin-right:4px;"></i>${kruCount} kru</span>` : ''}
        </div>
      </div>

      <i class="fa-solid fa-chevron-right" style="color:var(--ptv-text-dim);font-size:12px;flex-shrink:0;"></i>
    </div>`;
}

function _emptyHTML() {
  return `<div style="text-align:center;padding:48px 24px;color:var(--ptv-text-dim);">
    <i class="fa-solid fa-calendar-xmark" style="font-size:36px;margin-bottom:12px;display:block;"></i>
    Tidak ada acara yang ditemukan.
  </div>`;
}

// ── DETAIL VIEW ───────────────────────────────────────────────
async function _renderDetail(container, id) {
  const acara = _allAcara.find(a => a.id === id);
  if (!acara) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--ptv-text-dim);">Acara tidak ditemukan.</div>`;
    return;
  }

  const sb = getSupabase();
  const { data: rundown } = await sb
    .from('ptv_acara_rundown')
    .select('id, jam, kegiatan, keterangan')
    .eq('acara_id', id)
    .order('jam', { ascending: true });

  let kru = [];
  try { kru = Array.isArray(acara.kru_bertugas) ? acara.kru_bertugas : JSON.parse(acara.kru_bertugas || '[]'); } catch {}
  let alat = [];
  try { alat = Array.isArray(acara.alat_digunakan) ? acara.alat_digunakan : JSON.parse(acara.alat_digunakan || '[]'); } catch {}

  container.innerHTML = `
    <div style="max-width:820px;margin:0 auto;">
      <!-- Back -->
      <button class="btn btn-ghost btn-sm" id="backToList" style="margin-bottom:20px;">
        <i class="fa-solid fa-arrow-left"></i> Semua Acara
      </button>

      <!-- Hero Card -->
      <div class="glass-card" style="padding:28px;margin-bottom:16px;border-left:4px solid ${(STATUS_CFG[acara.status]||{}).color || 'var(--ptv-blue)'};">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            ${_statusBadge(acara.status)}
            <h1 style="font-size:20px;font-weight:800;margin-top:8px;margin-bottom:4px;">${acara.nama_acara || 'Tanpa Nama'}</h1>
          </div>
          ${isExec() ? `
          <button class="btn btn-ghost btn-sm" id="btnEditAcara" data-id="${acara.id}">
            <i class="fa-solid fa-pen"></i> Edit
          </button>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-size:13.5px;">
          <div class="flex items-center gap-2" style="color:var(--ptv-text-soft);">
            <i class="fa-solid fa-calendar" style="color:var(--ptv-blue);width:16px;text-align:center;"></i>
            <span>${_fmtDate(acara.tanggal)}</span>
          </div>
          ${acara.jam_mulai ? `
          <div class="flex items-center gap-2" style="color:var(--ptv-text-soft);">
            <i class="fa-solid fa-clock" style="color:var(--ptv-blue);width:16px;text-align:center;"></i>
            <span>${_fmtTime(acara.jam_mulai)}${acara.jam_selesai?' — '+_fmtTime(acara.jam_selesai):''} WIB</span>
          </div>` : ''}
          ${acara.lokasi ? `
          <div class="flex items-center gap-2" style="color:var(--ptv-text-soft);">
            <i class="fa-solid fa-location-dot" style="color:var(--ptv-blue);width:16px;text-align:center;"></i>
            <span>${acara.lokasi}</span>
          </div>` : ''}
        </div>

        ${acara.deskripsi ? `<p style="margin-top:16px;font-size:14px;line-height:1.7;color:var(--ptv-text-soft);border-top:1px solid var(--ptv-border-soft);padding-top:14px;">${acara.deskripsi}</p>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Kru Bertugas -->
        <div class="glass-card" style="padding:20px;">
          <div style="font-size:12px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;">
            <i class="fa-solid fa-users" style="color:var(--ptv-blue);margin-right:6px;"></i>Kru Bertugas
          </div>
          ${kru.length > 0 ? kru.map(k => {
            const nm   = typeof k === 'string' ? k : (k.name || k.nama || '—');
            const job  = typeof k === 'object' ? (k.job || k.tugas || '') : '';
            const init = nm.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--ptv-border-soft);">
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ptv-blue),var(--ptv-indigo));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0;">${init}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;">${nm}</div>
                  ${job ? `<div class="text-xs text-muted">${job}</div>` : ''}
                </div>
              </div>`;
          }).join('') : `<div class="text-muted text-sm" style="text-align:center;padding:12px 0;">Belum ada kru ditugaskan.</div>`}
        </div>

        <!-- Alat Digunakan -->
        <div class="glass-card" style="padding:20px;">
          <div style="font-size:12px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;">
            <i class="fa-solid fa-box-archive" style="color:var(--ptv-cyan);margin-right:6px;"></i>Alat Digunakan
          </div>
          ${alat.length > 0 ? alat.map(al => {
            const nm   = typeof al === 'string' ? al : (al.nama || al.name || '—');
            const kode = typeof al === 'object' ? (al.kode_unit || al.kode || '') : '';
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--ptv-border-soft);">
                <i class="fa-solid fa-box" style="color:var(--ptv-cyan);font-size:14px;flex-shrink:0;"></i>
                <div>
                  <div style="font-size:13px;font-weight:600;">${nm}</div>
                  ${kode ? `<div class="badge badge-blue" style="font-size:10px;margin-top:2px;">${kode}</div>` : ''}
                </div>
              </div>`;
          }).join('') : `<div class="text-muted text-sm" style="text-align:center;padding:12px 0;">Belum ada alat dicatat.</div>`}
        </div>
      </div>

      <!-- Rundown -->
      <div class="glass-card" style="padding:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;">
          <i class="fa-solid fa-list-ol" style="color:var(--ptv-gold);margin-right:6px;"></i>Rundown Acara
        </div>
        ${rundown && rundown.length > 0 ?
          `<div>
            ${rundown.map((r, i) => `
              <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--ptv-border-soft);">
                <div style="min-width:54px;font-size:13px;font-weight:700;color:var(--ptv-gold);flex-shrink:0;">${r.jam || '—'}</div>
                <div>
                  <div style="font-size:13.5px;font-weight:600;">${r.kegiatan || '—'}</div>
                  ${r.keterangan ? `<div class="text-muted text-xs" style="margin-top:2px;">${r.keterangan}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>` :
          `<div class="text-muted text-sm" style="text-align:center;padding:16px 0;">Rundown belum disusun.</div>`
        }
      </div>
    </div>`;

  container.querySelector('#backToList')?.addEventListener('click', () => {
    window.location.hash = '#acara';
  });
}

// ── FORM TAMBAH ACARA (Eksekutif Only) ───────────────────────
function _openAcaraForm(container) {
  // Modal overlay sederhana
  const overlay = document.createElement('div');
  overlay.id = 'acaraModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <h3 style="font-size:17px;font-weight:800;">+ Tambah Acara</h3>
        <button id="closeAcaraModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="acaraForm">
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Acara <span style="color:var(--ptv-red);">*</span></label>
          <input id="fNamaAcara" type="text" class="input-field" placeholder="Haul Akbar 2027" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Tanggal <span style="color:var(--ptv-red);">*</span></label>
            <input id="fTanggal" type="date" class="input-field" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Status</label>
            <select id="fStatus" class="input-field">
              <option value="Terjadwal">Terjadwal</option>
              <option value="Berlangsung">Berlangsung</option>
              <option value="Selesai">Selesai</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jam Mulai</label>
            <input id="fJamMulai" type="time" class="input-field">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jam Selesai</label>
            <input id="fJamSelesai" type="time" class="input-field">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Lokasi</label>
          <input id="fLokasi" type="text" class="input-field" placeholder="Studio PTV / Lapangan Pondok">
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Deskripsi</label>
          <textarea id="fDeskripsi" class="input-field" rows="3" placeholder="Keterangan singkat acara..." style="resize:vertical;"></textarea>
        </div>
        <div id="acaraFormError" style="display:none;color:var(--ptv-red);font-size:13px;margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.3);"></div>
        <button type="submit" class="btn btn-primary w-full" id="acaraSubmitBtn">
          <i class="fa-solid fa-plus"></i> Simpan Acara
        </button>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeAcaraModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#acaraForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl  = overlay.querySelector('#acaraFormError');
    const btnEl  = overlay.querySelector('#acaraSubmitBtn');
    errEl.style.display = 'none';
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Menyimpan...';

    const payload = {
      nama_acara:  overlay.querySelector('#fNamaAcara').value.trim(),
      tanggal:     overlay.querySelector('#fTanggal').value || null,
      status:      overlay.querySelector('#fStatus').value,
      jam_mulai:   overlay.querySelector('#fJamMulai').value || null,
      jam_selesai: overlay.querySelector('#fJamSelesai').value || null,
      lokasi:      overlay.querySelector('#fLokasi').value.trim() || null,
      deskripsi:   overlay.querySelector('#fDeskripsi').value.trim() || null,
    };

    const { data, error } = await getSupabase().from('ptv_acara').insert([payload]).select().single();
    if (error) {
      errEl.textContent = 'Gagal menyimpan: ' + error.message;
      errEl.style.display = 'block';
      btnEl.disabled = false;
      btnEl.innerHTML = '<i class="fa-solid fa-plus"></i> Simpan Acara';
      return;
    }

    window.toast('Acara berhasil ditambahkan!', 'success');
    overlay.remove();
    _allAcara.unshift(data);
    _renderList(container);
  });
}
