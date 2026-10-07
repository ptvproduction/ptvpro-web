// ============================================================
// js/modules/inventaris.js — Modul Inventaris Alat PTV Pro
// Terhubung ke Supabase: ptv_inventaris, ptv_inventaris_unit
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { isExec } from '/js/auth.js';

// ── STATE ────────────────────────────────────────────────────
let _allInv        = [];
let _allUnits      = [];
let _searchQuery   = '';
let _activeKategori= 'semua';
let _viewMode      = 'list'; // 'list' | 'detail'
let _detailId      = null;

// ── KATEGORI ─────────────────────────────────────────────────
const KATEGORI_LIST = ['Kamera', 'Lensa', 'Audio', 'Lighting', 'Rigging', 'Aksesoris', 'Lainnya'];
const KATEGORI_ICON = {
  'Kamera':    'camera',
  'Lensa':     'circle',
  'Audio':     'microphone',
  'Lighting':  'lightbulb',
  'Rigging':   'wrench',
  'Aksesoris': 'puzzle-piece',
  'Lainnya':   'box-archive',
};

// ── ENTRY POINT ──────────────────────────────────────────────
export async function render(container, fullHash) {
  const parts = fullHash.split(':');
  if (parts.length >= 2 && parts[1]) {
    _viewMode  = 'detail';
    _detailId  = parts[1];
  } else {
    _viewMode  = 'list';
    _detailId  = null;
  }
  _renderSkeleton(container);
  await _loadData();

  if (_viewMode === 'detail' && _detailId) {
    _renderDetail(container, _detailId);
  } else {
    _renderList(container);
  }
}

// ── LOAD DATA ────────────────────────────────────────────────
async function _loadData() {
  const sb = getSupabase();
  const [{ data: inv }, { data: units }] = await Promise.all([
    sb.from('ptv_inventaris')
      .select('id, kode, nama, kategori, jumlah, keterangan, lokasi, foto_url, created_at')
      .order('kode', { ascending: true }),
    sb.from('ptv_inventaris_unit')
      .select('id, inventaris_id, nomor_unit, kode_unit, status_kondisi, status_peminjaman, keterangan'),
  ]);
  _allInv   = inv   || [];
  _allUnits = units || [];
}

// ── SKELETON ─────────────────────────────────────────────────
function _renderSkeleton(container) {
  container.innerHTML = `
    <div style="max-width:1050px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;margin-bottom:22px;">
        <div class="skeleton" style="width:150px;height:26px;border-radius:8px;"></div>
        <div class="skeleton" style="width:120px;height:36px;border-radius:8px;"></div>
      </div>
      <div class="skeleton" style="width:100%;height:44px;border-radius:10px;margin-bottom:14px;"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">
        ${[1,2,3,4,5,6].map(() => `<div class="skeleton glass-card" style="height:130px;border-radius:14px;"></div>`).join('')}
      </div>
    </div>`;
}

// ── LIST VIEW ─────────────────────────────────────────────────
function _renderList(container) {
  const filtered = _applyFilter();

  // Hitung ketersediaan per inventaris
  const availMap = {};
  _allInv.forEach(inv => {
    const units = _allUnits.filter(u => u.inventaris_id === inv.id);
    const tersedia = units.filter(u => u.status_peminjaman === 'Tersedia' && u.status_kondisi === 'Baik').length;
    availMap[inv.id] = { total: units.length, tersedia };
  });

  container.innerHTML = `
    <div style="max-width:1050px;margin:0 auto;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap;">
        <div>
          <h2 style="font-size:20px;margin-bottom:2px;">Inventaris Alat</h2>
          <p class="text-muted text-sm">${_allInv.length} jenis alat, ${_allUnits.length} unit fisik</p>
        </div>
        ${isExec() ? `
        <button class="btn btn-primary btn-sm" id="btnTambahAlat">
          <i class="fa-solid fa-plus"></i> Tambah Alat
        </button>` : ''}
      </div>

      <!-- Search -->
      <div style="position:relative;margin-bottom:14px;">
        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
        <input
          id="invSearch"
          type="search"
          class="input-field"
          placeholder="Cari nama alat, kode INV-XXX..."
          value="${_searchQuery}"
          style="padding-left:38px;"
        >
      </div>

      <!-- Filter Kategori -->
      <div style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;">
        <button class="btn btn-sm ${_activeKategori==='semua'?'btn-primary':'btn-ghost'} kchip" data-kat="semua">
          Semua (${_allInv.length})
        </button>
        ${KATEGORI_LIST.map(kat => {
          const cnt = _allInv.filter(i => i.kategori === kat).length;
          if (cnt === 0) return '';
          return `<button class="btn btn-sm ${_activeKategori===kat?'btn-primary':'btn-ghost'} kchip" data-kat="${kat}">
            <i class="fa-solid fa-${KATEGORI_ICON[kat]||'box'}" style="font-size:11px;"></i> ${kat} (${cnt})
          </button>`;
        }).join('')}
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">
        ${_statsCards()}
      </div>

      <!-- Grid Inventaris -->
      <div id="invGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">
        ${filtered.length > 0
          ? filtered.map(inv => _invCardHTML(inv, availMap[inv.id] || { total:0, tersedia:0 })).join('')
          : _emptyHTML()}
      </div>
    </div>`;

  // Events
  container.querySelector('#invSearch')?.addEventListener('input', e => {
    _searchQuery = e.target.value;
    document.getElementById('invGrid').innerHTML = (() => {
      const f = _applyFilter();
      return f.length > 0 ? f.map(inv => _invCardHTML(inv, (() => {
        const units = _allUnits.filter(u => u.inventaris_id === inv.id);
        return { total: units.length, tersedia: units.filter(u => u.status_peminjaman==='Tersedia' && u.status_kondisi==='Baik').length };
      })())).join('') : _emptyHTML();
    })();
  });

  container.querySelectorAll('.kchip').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeKategori = btn.dataset.kat;
      _renderList(container);
    });
  });

  container.querySelectorAll('[data-inv-id]').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = '#inventaris:' + card.dataset.invId;
    });
  });

  container.querySelector('#btnTambahAlat')?.addEventListener('click', () => _openAlatForm(container));
}

// ── FILTER ───────────────────────────────────────────────────
function _applyFilter() {
  return _allInv.filter(inv => {
    const matchKat = _activeKategori === 'semua' || inv.kategori === _activeKategori;
    const q = _searchQuery.toLowerCase();
    const matchSearch = !q ||
      (inv.nama  || '').toLowerCase().includes(q) ||
      (inv.kode  || '').toLowerCase().includes(q) ||
      (inv.kategori || '').toLowerCase().includes(q);
    return matchKat && matchSearch;
  });
}

// ── STATS CARDS ───────────────────────────────────────────────
function _statsCards() {
  const totalUnit = _allUnits.length;
  const tersedia  = _allUnits.filter(u => u.status_peminjaman === 'Tersedia').length;
  const dipinjam  = _allUnits.filter(u => u.status_peminjaman === 'Dipinjam').length;
  const rusak     = _allUnits.filter(u => u.status_kondisi !== 'Baik').length;

  return [
    { label:'Total Unit',   val: totalUnit, icon:'boxes-stacked', color:'var(--ptv-blue)'   },
    { label:'Tersedia',     val: tersedia,  icon:'circle-check',  color:'var(--ptv-green)'  },
    { label:'Dipinjam',     val: dipinjam,  icon:'handshake',     color:'var(--ptv-yellow)' },
    { label:'Perlu Cek',    val: rusak,     icon:'triangle-exclamation', color:'var(--ptv-red)' },
  ].map(s => `
    <div class="glass-card" style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;border-radius:9px;background:${s.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-${s.icon}" style="color:${s.color};font-size:14px;"></i>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;line-height:1;">${s.val}</div>
        <div class="text-muted text-xs">${s.label}</div>
      </div>
    </div>`).join('');
}

// ── INV CARD ─────────────────────────────────────────────────
function _invCardHTML(inv, avail) {
  const icon   = KATEGORI_ICON[inv.kategori] || 'box-archive';
  const ratePct= avail.total > 0 ? Math.round((avail.tersedia / avail.total) * 100) : 0;
  const barCol = ratePct >= 70 ? 'var(--ptv-green)' : ratePct >= 30 ? 'var(--ptv-yellow)' : 'var(--ptv-red)';

  return `
    <div
      class="glass-card"
      data-inv-id="${inv.id}"
      style="padding:18px;cursor:pointer;position:relative;overflow:hidden;"
    >
      <!-- Kategori glow accent -->
      <div style="position:absolute;top:0;right:0;width:60px;height:60px;background:radial-gradient(circle,rgba(59,130,246,0.15),transparent 70%);pointer-events:none;"></div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        ${inv.foto_url
          ? `<img src="${inv.foto_url}" alt="${inv.nama}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;">`
          : `<div style="width:44px;height:44px;border-radius:10px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <i class="fa-solid fa-${icon}" style="color:var(--ptv-blue);font-size:18px;"></i>
             </div>`
        }
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${inv.nama}</div>
          <div class="badge badge-blue" style="font-size:10px;margin-top:3px;">${inv.kode}</div>
        </div>
      </div>

      <!-- Ketersediaan Bar -->
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ptv-text-soft);margin-bottom:4px;">
          <span>Ketersediaan</span>
          <span style="color:${barCol};font-weight:700;">${avail.tersedia} / ${avail.total} unit</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${ratePct}%;background:${barCol};border-radius:99px;transition:width .4s;"></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--ptv-text-dim);">
        <span><i class="fa-solid fa-location-dot" style="margin-right:3px;"></i>${inv.lokasi || 'Studio PTV'}</span>
        <span>${inv.kategori || 'Lainnya'}</span>
      </div>
    </div>`;
}

function _emptyHTML() {
  return `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ptv-text-dim);">
    <i class="fa-solid fa-box-open" style="font-size:36px;margin-bottom:12px;display:block;"></i>
    Tidak ada alat yang ditemukan.
  </div>`;
}

// ── DETAIL VIEW ───────────────────────────────────────────────
function _renderDetail(container, id) {
  const inv = _allInv.find(i => i.id === id);
  if (!inv) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--ptv-text-dim);">Alat tidak ditemukan.</div>`;
    return;
  }
  const units = _allUnits.filter(u => u.inventaris_id === id);
  const icon  = KATEGORI_ICON[inv.kategori] || 'box-archive';

  const KONDISI_BADGE = {
    'Baik':         ['var(--ptv-green)',  'circle-check'],
    'Rusak Ringan': ['var(--ptv-yellow)', 'triangle-exclamation'],
    'Rusak Berat':  ['var(--ptv-red)',    'circle-xmark'],
    'Maintenance':  ['var(--ptv-orange)', 'wrench'],
  };
  const PINJAM_BADGE = {
    'Tersedia': ['var(--ptv-green)',  'circle-check'],
    'Dipinjam': ['var(--ptv-yellow)', 'handshake'],
  };

  container.innerHTML = `
    <div style="max-width:820px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="backToInv" style="margin-bottom:20px;">
        <i class="fa-solid fa-arrow-left"></i> Inventaris
      </button>

      <!-- Info Alat -->
      <div class="glass-card" style="padding:24px;margin-bottom:16px;display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
        ${inv.foto_url
          ? `<img src="${inv.foto_url}" alt="${inv.nama}" style="width:90px;height:90px;border-radius:14px;object-fit:cover;flex-shrink:0;">`
          : `<div style="width:90px;height:90px;border-radius:14px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <i class="fa-solid fa-${icon}" style="color:var(--ptv-blue);font-size:32px;"></i>
             </div>`
        }
        <div style="flex:1;min-width:0;">
          <div class="badge badge-blue" style="margin-bottom:8px;">${inv.kode}</div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:6px;">${inv.nama}</h2>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--ptv-text-soft);">
            <span><i class="fa-solid fa-tag" style="color:var(--ptv-blue);margin-right:4px;"></i>${inv.kategori || 'Lainnya'}</span>
            <span><i class="fa-solid fa-location-dot" style="color:var(--ptv-blue);margin-right:4px;"></i>${inv.lokasi || 'Studio PTV'}</span>
            <span><i class="fa-solid fa-boxes-stacked" style="color:var(--ptv-cyan);margin-right:4px;"></i>${units.length} unit fisik</span>
          </div>
          ${inv.keterangan ? `<p style="margin-top:10px;font-size:13.5px;color:var(--ptv-text-soft);line-height:1.6;">${inv.keterangan}</p>` : ''}
        </div>
        ${isExec() ? `
        <button class="btn btn-ghost btn-sm" id="btnEditAlat"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
      </div>

      <!-- Daftar Unit Fisik -->
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.06em;">
            <i class="fa-solid fa-barcode" style="color:var(--ptv-cyan);margin-right:6px;"></i>Unit Fisik
          </div>
          ${isExec() ? `<button class="btn btn-ghost btn-sm" id="btnTambahUnit"><i class="fa-solid fa-plus"></i> + Unit</button>` : ''}
        </div>

        ${units.length > 0 ? `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
            <thead>
              <tr style="border-bottom:1px solid var(--ptv-border-soft);">
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.05em;">#</th>
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.05em;">Kode Barcode</th>
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.05em;">Kondisi</th>
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.05em;">Status</th>
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--ptv-text-dim);text-transform:uppercase;letter-spacing:.05em;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${units.map(u => {
                const [kondisiColor, kondisiIcon] = KONDISI_BADGE[u.status_kondisi] || ['var(--ptv-text-dim)', 'circle-question'];
                const [pinjamColor, pinjamIcon]   = PINJAM_BADGE[u.status_peminjaman] || ['var(--ptv-text-dim)', 'circle-question'];
                return `
                  <tr style="border-bottom:1px solid var(--ptv-border-soft);transition:background .12s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
                    <td style="padding:10px;font-weight:700;color:var(--ptv-text-dim);">${u.nomor_unit}</td>
                    <td style="padding:10px;">
                      <span style="font-family:monospace;font-size:13px;background:rgba(59,130,246,0.1);color:var(--ptv-blue);padding:2px 8px;border-radius:6px;font-weight:700;">${u.kode_unit}</span>
                    </td>
                    <td style="padding:10px;">
                      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${kondisiColor};font-weight:600;">
                        <i class="fa-solid fa-${kondisiIcon}" style="font-size:11px;"></i>${u.status_kondisi || 'Baik'}
                      </span>
                    </td>
                    <td style="padding:10px;">
                      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${pinjamColor};font-weight:600;">
                        <i class="fa-solid fa-${pinjamIcon}" style="font-size:11px;"></i>${u.status_peminjaman || 'Tersedia'}
                      </span>
                    </td>
                    <td style="padding:10px;color:var(--ptv-text-dim);">${u.keterangan || '—'}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : `
        <div style="text-align:center;padding:24px;color:var(--ptv-text-dim);">
          <i class="fa-solid fa-box-open" style="font-size:28px;margin-bottom:8px;display:block;"></i>
          Belum ada unit fisik terdaftar.
        </div>`}
      </div>
    </div>`;

  container.querySelector('#backToInv')?.addEventListener('click', () => {
    window.location.hash = '#inventaris';
  });

  container.querySelector('#btnTambahUnit')?.addEventListener('click', () => {
    _openUnitForm(container, inv);
  });
}

// ── FORM TAMBAH ALAT ─────────────────────────────────────────
function _openAlatForm(container) {
  const nextKode = 'INV-' + String(_allInv.length + 1).padStart(3, '0');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:480px;padding:28px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <h3 style="font-size:17px;font-weight:800;">+ Tambah Alat</h3>
        <button id="closeAlatModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="alatForm">
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kode Inventaris <span style="color:var(--ptv-red);">*</span></label>
          <input id="fKode" type="text" class="input-field" value="${nextKode}" required placeholder="INV-001">
          <div style="font-size:11px;color:var(--ptv-text-dim);margin-top:4px;">Format: INV-XXX (otomatis, bisa diubah)</div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Alat <span style="color:var(--ptv-red);">*</span></label>
          <input id="fNama" type="text" class="input-field" placeholder="Sony Alpha 7 IV" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kategori</label>
            <select id="fKategori" class="input-field">
              ${KATEGORI_LIST.map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Lokasi</label>
            <input id="fLokasi" type="text" class="input-field" value="Studio PTV" placeholder="Studio PTV">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Keterangan</label>
          <textarea id="fKeterangan" class="input-field" rows="2" placeholder="Spesifikasi atau catatan singkat..." style="resize:vertical;"></textarea>
        </div>
        <div id="alatFormErr" style="display:none;color:var(--ptv-red);font-size:13px;margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.3);"></div>
        <button type="submit" class="btn btn-primary w-full" id="alatSubmitBtn">
          <i class="fa-solid fa-plus"></i> Simpan Alat
        </button>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#closeAlatModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#alatForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = overlay.querySelector('#alatFormErr');
    const btnEl = overlay.querySelector('#alatSubmitBtn');
    errEl.style.display = 'none';
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Menyimpan...';

    const { data, error } = await getSupabase().from('ptv_inventaris').insert([{
      kode:       overlay.querySelector('#fKode').value.trim().toUpperCase(),
      nama:       overlay.querySelector('#fNama').value.trim(),
      kategori:   overlay.querySelector('#fKategori').value,
      lokasi:     overlay.querySelector('#fLokasi').value.trim() || 'Studio PTV',
      keterangan: overlay.querySelector('#fKeterangan').value.trim() || null,
    }]).select().single();

    if (error) {
      errEl.textContent = 'Gagal: ' + (error.message.includes('unique') ? 'Kode sudah digunakan.' : error.message);
      errEl.style.display = 'block';
      btnEl.disabled = false;
      btnEl.innerHTML = '<i class="fa-solid fa-plus"></i> Simpan Alat';
      return;
    }

    window.toast('Alat berhasil ditambahkan!', 'success');
    overlay.remove();
    _allInv.push(data);
    _renderList(container);
  });
}

// ── FORM TAMBAH UNIT ─────────────────────────────────────────
function _openUnitForm(container, inv) {
  const existingUnits = _allUnits.filter(u => u.inventaris_id === inv.id);
  const nextNo  = existingUnits.length + 1;
  const nextKodeUnit = `${inv.kode}-${String(nextNo).padStart(2, '0')}`;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:420px;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h3 style="font-size:17px;font-weight:800;">+ Tambah Unit Fisik</h3>
        <button id="closeUnitModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p style="font-size:13px;color:var(--ptv-text-soft);margin-bottom:16px;">
        Alat: <strong style="color:var(--ptv-text);">${inv.nama}</strong> (${inv.kode})
      </p>
      <form id="unitForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">No. Unit</label>
            <input id="fNomorUnit" type="number" class="input-field" value="${nextNo}" min="1" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kode Barcode</label>
            <input id="fKodeUnit" type="text" class="input-field" value="${nextKodeUnit}" required placeholder="INV-001-01">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kondisi</label>
            <select id="fKondisi" class="input-field">
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Status</label>
            <select id="fStatusUnit" class="input-field">
              <option value="Tersedia">Tersedia</option>
              <option value="Dipinjam">Dipinjam</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Keterangan</label>
          <input id="fKetUnit" type="text" class="input-field" placeholder="Serial number, kondisi khusus...">
        </div>
        <div id="unitFormErr" style="display:none;color:var(--ptv-red);font-size:13px;margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.3);"></div>
        <button type="submit" class="btn btn-primary w-full" id="unitSubmitBtn">
          <i class="fa-solid fa-barcode"></i> Tambah Unit
        </button>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#closeUnitModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#unitForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = overlay.querySelector('#unitFormErr');
    const btnEl = overlay.querySelector('#unitSubmitBtn');
    errEl.style.display = 'none';
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Menyimpan...';

    const { data, error } = await getSupabase().from('ptv_inventaris_unit').insert([{
      inventaris_id:    inv.id,
      nomor_unit:       parseInt(overlay.querySelector('#fNomorUnit').value),
      kode_unit:        overlay.querySelector('#fKodeUnit').value.trim().toUpperCase(),
      status_kondisi:   overlay.querySelector('#fKondisi').value,
      status_peminjaman:overlay.querySelector('#fStatusUnit').value,
      keterangan:       overlay.querySelector('#fKetUnit').value.trim() || null,
    }]).select().single();

    if (error) {
      errEl.textContent = 'Gagal: ' + (error.message.includes('unique') ? 'Kode unit sudah ada.' : error.message);
      errEl.style.display = 'block';
      btnEl.disabled = false;
      btnEl.innerHTML = '<i class="fa-solid fa-barcode"></i> Tambah Unit';
      return;
    }

    window.toast(`Unit ${data.kode_unit} berhasil ditambahkan!`, 'success');
    overlay.remove();
    _allUnits.push(data);
    _renderDetail(container, inv.id);
  });
}
