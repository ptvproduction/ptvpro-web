// ============================================================
// js/modules/kru.js — Modul Data Kru & ID Digital PTV Pro
// Terhubung langsung ke Supabase: ptv_kru
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allCrews      = [];
let _activeDivisi  = 'semua';
let _searchQuery   = '';

const DIVISI_LIST = ['Semua', 'Produksi', 'Penyiaran', 'Teknis & IT', 'Eksekutif', 'Dokumentasi', 'Desain'];

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
      .from('ptv_kru')
      .select('*')
      .order('nama', { ascending: true });

    if (error) console.error('[KRU] Load error:', error);
    _allCrews = data || [];
  } catch (err) {
    console.error('[KRU] Fatal load error:', err);
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
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${[1,2,3,4,5,6].map(() => `<div class="skeleton glass-card" style="height:190px;"></div>`).join('')}
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
          ${DIVISI_LIST.map(div => {
            const key = div.toLowerCase();
            const isActive = _activeDivisi === key;
            return `
              <button
                class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}"
                data-divisi="${key}"
                style="font-size:12.5px;padding:6px 14px;border-radius:99px;"
              >${div}</button>
            `;
          }).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:440px;min-width:240px;justify-content:flex-end;">
          <!-- Search -->
          <div style="position:relative;flex:1;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
            <input
              id="searchCrew"
              type="text"
              class="input-field"
              placeholder="Cari nama, ID PTV, atau jabatan..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          ${isExec() ? `
            <button id="btnTambahKru" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;">
              <i class="fa-solid fa-user-plus"></i> Tambah Kru
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Crew Grid -->
      <div id="crewGridContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${filtered.length > 0 ? filtered.map(c => _crewCardHTML(c)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── STATS CARDS ───────────────────────────────────────────
function _statsCardsHTML() {
  const aktifCount = _allCrews.filter(c => (c.status || '').toLowerCase() === 'aktif').length;
  const execCount  = _allCrews.filter(c => (c.role || '').toLowerCase() === 'eksekutif').length;
  const divSet     = new Set(_allCrews.map(c => c.divisi).filter(Boolean));

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Kru Aktif</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-green);">
            <i class="fa-solid fa-users" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-green);">${aktifCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">orang</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Tim Eksekutif</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-user-tie" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-blue);">${execCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">pengurus</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Jumlah Divisi</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-cyan);">
            <i class="fa-solid fa-sitemap" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-cyan);">${divSet.size} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">divisi kerja</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Anggota</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(197,163,90,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-gold);">
            <i class="fa-solid fa-address-book" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-gold);">${_allCrews.length} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">terdata</span></div>
      </div>
    </div>`;
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const q = _searchQuery.toLowerCase().trim();

  return _allCrews.filter(c => {
    const div = (c.divisi || '').toLowerCase();
    if (_activeDivisi !== 'semua' && !div.includes(_activeDivisi)) return false;

    if (q) {
      const matchNama = (c.nama || '').toLowerCase().includes(q);
      const matchPtv  = (c.crew_id || c.ptv_id || '').toLowerCase().includes(q);
      const matchJab  = (c.jabatan || '').toLowerCase().includes(q);
      const matchMail = (c.email || '').toLowerCase().includes(q);
      if (!matchNama && !matchPtv && !matchJab && !matchMail) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _crewCardHTML(c) {
  const init = (c.nama || 'Kru').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const isAktif = (c.status || '').toLowerCase() === 'aktif';
  const roleName = c.role || 'Kru Operasional';

  return `
    <div class="glass-card" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;position:relative;border-top:3px solid ${c.role === 'Eksekutif' ? 'var(--ptv-gold)' : 'var(--ptv-blue)'};">
      <div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
          <!-- Avatar -->
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--ptv-blue),var(--ptv-indigo));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;flex-shrink:0;box-shadow:0 0 12px rgba(59,130,246,0.3);">
            ${init}
          </div>

          <div style="min-width:0;">
            <h3 style="font-size:15px;font-weight:800;color:var(--ptv-text);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${c.nama}
            </h3>
            <div style="font-size:12px;font-weight:600;color:var(--ptv-cyan);margin-top:2px;">
              ${c.crew_id || c.ptv_id || 'ID Pending'}
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--ptv-text-soft);margin-bottom:14px;background:rgba(255,255,255,0.02);padding:10px 12px;border-radius:8px;border:1px solid var(--ptv-border-soft);">
          <div><i class="fa-solid fa-briefcase" style="width:16px;color:var(--ptv-blue);"></i> ${c.jabatan || 'Anggota'}</div>
          <div><i class="fa-solid fa-sitemap" style="width:16px;color:var(--ptv-cyan);"></i> Divisi ${c.divisi || 'Umum'}</div>
          ${c.nomor_wa ? `<div><i class="fa-brands fa-whatsapp" style="width:16px;color:var(--ptv-green);"></i> ${c.nomor_wa}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--ptv-border-soft);padding-top:10px;font-size:11.5px;">
        <span class="badge" style="background:${isAktif ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};color:${isAktif ? 'var(--ptv-green)' : 'var(--ptv-red)'};font-size:10px;">
          ${isAktif ? 'Aktif' : 'Nonaktif'}
        </span>

        <span style="color:var(--ptv-text-dim);font-weight:600;">
          ${roleName}
        </span>
      </div>
    </div>`;
}

function _emptyHTML() {
  return `
    <div class="glass-card" style="grid-column:1/-1;text-align:center;padding:56px 24px;color:var(--ptv-text-dim);">
      <i class="fa-solid fa-users-slash" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-blue);opacity:0.7;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Tidak Ada Kru Ditemukan</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Periksa kembali filter divisi atau kata kunci pencarian Anda.
      </p>
    </div>`;
}

// ── EVENTS ────────────────────────────────────────────────
function _attachEvents(container) {
  container.querySelectorAll('[data-divisi]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeDivisi = btn.dataset.divisi;
      _renderView(container);
    });
  });

  const sInput = container.querySelector('#searchCrew');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const grid = container.querySelector('#crewGridContainer');
      if (grid) {
        grid.innerHTML = filtered.length > 0 ? filtered.map(c => _crewCardHTML(c)).join('') : _emptyHTML();
      }
    });
  }

  container.querySelector('#btnTambahKru')?.addEventListener('click', () => {
    _openCrewModal(container);
  });
}

// ── MODAL TAMBAH KRU (Eksekutif) ──────────────────────────
function _openCrewModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'crewModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:520px;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <h3 style="font-size:17px;font-weight:800;margin:0;">Tambah Data Kru Baru</h3>
        <button id="closeCrewModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="crewForm">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Lengkap <span style="color:var(--ptv-red);">*</span></label>
          <input id="fNamaKru" type="text" class="input-field" placeholder="Nama santri / kru..." required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">ID PTV (Format PTV-XXX)</label>
            <input id="fPtvId" type="text" class="input-field" placeholder="PTV-035">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Divisi <span style="color:var(--ptv-red);">*</span></label>
            <select id="fDivisiKru" class="input-field">
              <option value="Produksi">Produksi</option>
              <option value="Penyiaran">Penyiaran</option>
              <option value="Teknis & IT">Teknis & IT</option>
              <option value="Dokumentasi">Dokumentasi</option>
              <option value="Desain">Desain</option>
              <option value="Eksekutif">Eksekutif</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jabatan / Jobdesk</label>
            <input id="fJabatanKru" type="text" class="input-field" placeholder="Kameramen / Switcher">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nomor WhatsApp</label>
            <input id="fWaKru" type="text" class="input-field" placeholder="08xxxxxxxx">
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelCrew" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSaveCrew" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Simpan Data Kru
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeCrewModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelCrew')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#crewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama    = overlay.querySelector('#fNamaKru').value.trim();
    const ptvId   = overlay.querySelector('#fPtvId').value.trim();
    const divisi  = overlay.querySelector('#fDivisiKru').value;
    const jabatan = overlay.querySelector('#fJabatanKru').value.trim();
    const wa      = overlay.querySelector('#fWaKru').value.trim();
    const saveBtn = overlay.querySelector('#btnSaveCrew');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    try {
      const { error } = await sb.from('ptv_kru').insert({
        nama:      nama,
        crew_id:   ptvId || null,
        divisi:    divisi,
        jabatan:   jabatan || 'Anggota',
        nomor_wa:  wa || null,
        status:    'Aktif',
        role:      divisi === 'Eksekutif' ? 'Eksekutif' : 'Kru',
      });

      if (error) throw error;
      overlay.remove();
      if (window.toast) window.toast('Kru baru berhasil didaftarkan!', 'success');
      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[KRU] Insert error:', err);
      alert('Gagal menyimpan kru: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Data Kru';
    }
  });
}
