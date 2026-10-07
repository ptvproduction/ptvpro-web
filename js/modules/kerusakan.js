// ============================================================
// js/modules/kerusakan.js — Modul Lapor Kerusakan & QC Alat
// Terhubung langsung ke Supabase: ptv_lapor_masalah, ptv_inventaris, ptv_inventaris_unit
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allDamages    = [];
let _allInv        = [];
let _allUnits      = [];
let _activeFilter  = 'semua'; // 'semua' | 'baru' | 'proses' | 'selesai'
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
    const [damRes, invRes, unitsRes] = await Promise.all([
      sb.from('ptv_lapor_masalah')
        .select('*')
        .order('created_at', { ascending: false }),
      sb.from('ptv_inventaris')
        .select('id, kode, nama, kategori, foto_url')
        .order('nama', { ascending: true }),
      sb.from('ptv_inventaris_unit')
        .select('id, inventaris_id, nomor_unit, kode_unit, status_kondisi')
        .order('nomor_unit', { ascending: true }),
    ]);

    if (damRes.error) console.error('[KERUSAKAN] Load damages error:', damRes.error);
    _allDamages = damRes.data || [];
    _allInv     = invRes.data || [];
    _allUnits   = unitsRes.data || [];
  } catch (err) {
    console.error('[KERUSAKAN] Fatal error:', err);
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
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${[1,2,3].map(() => `<div class="skeleton glass-card" style="height:140px;"></div>`).join('')}
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
            { key: 'semua',   label: 'Semua Laporan' },
            { key: 'baru',    label: 'Tiket Baru' },
            { key: 'proses',  label: 'Dalam Perbaikan' },
            { key: 'selesai', label: 'QC Selesai' },
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
              id="searchDamage"
              type="text"
              class="input-field"
              placeholder="Cari kendala, alat, atau pelapor..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          <!-- Tambah Laporan Button -->
          <button id="btnLaporBaru" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;background:var(--ptv-red);border-color:var(--ptv-red);">
            <i class="fa-solid fa-triangle-exclamation"></i> Lapor Kendala
          </button>
        </div>
      </div>

      <!-- List Tiket -->
      <div id="damageListContainer" style="display:flex;flex-direction:column;gap:14px;">
        ${filtered.length > 0 ? filtered.map(d => _damageCardHTML(d)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── STATS CARDS ───────────────────────────────────────────
function _statsCardsHTML() {
  let baruCount = 0;
  let prosesCount = 0;
  let selesaiCount = 0;

  _allDamages.forEach(d => {
    const st = (d.status || 'Baru').toLowerCase();
    if (st === 'baru') baruCount++;
    else if (st === 'proses' || st === 'dalam perbaikan') prosesCount++;
    else if (st === 'selesai') selesaiCount++;
  });

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Tiket Baru</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-red);">
            <i class="fa-solid fa-bell" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:${baruCount > 0 ? 'var(--ptv-red)' : 'var(--ptv-text)'};">${baruCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">perlu respon</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Dalam Perbaikan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-yellow);">
            <i class="fa-solid fa-wrench" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-yellow);">${prosesCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">alat di-servis</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Selesai QC</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-green);">
            <i class="fa-solid fa-circle-check" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-green);">${selesaiCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">sudah normal</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Laporan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-clipboard-list" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-text);">${_allDamages.length} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">arsip tiket</span></div>
      </div>
    </div>`;
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const q = _searchQuery.toLowerCase().trim();

  return _allDamages.filter(d => {
    const st = (d.status || 'Baru').toLowerCase();
    if (_activeFilter === 'baru' && st !== 'baru') return false;
    if (_activeFilter === 'proses' && st !== 'proses' && st !== 'dalam perbaikan') return false;
    if (_activeFilter === 'selesai' && st !== 'selesai') return false;

    if (q) {
      const m1 = (d.masalah || '').toLowerCase().includes(q);
      const m2 = (d.nama_alat || '').toLowerCase().includes(q);
      const m3 = (d.pelapor_nama || '').toLowerCase().includes(q);
      const m4 = (d.unit_code || '').toLowerCase().includes(q);
      if (!m1 && !m2 && !m3 && !m4) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _damageCardHTML(d) {
  const st = (d.status || 'Baru').toLowerCase();
  let badgeColor = 'var(--ptv-red)';
  let badgeBg    = 'rgba(239,68,68,0.12)';
  let badgeText  = 'Laporan Baru';
  let badgeIcon  = 'triangle-exclamation';

  if (st === 'proses' || st === 'dalam perbaikan') {
    badgeColor = 'var(--ptv-yellow)';
    badgeBg    = 'rgba(245,158,11,0.12)';
    badgeText  = 'Dalam Perbaikan';
    badgeIcon  = 'wrench';
  } else if (st === 'selesai') {
    badgeColor = 'var(--ptv-green)';
    badgeBg    = 'rgba(16,185,129,0.12)';
    badgeText  = 'QC Selesai';
    badgeIcon  = 'circle-check';
  } else if (st === 'ditolak') {
    badgeColor = 'var(--ptv-text-dim)';
    badgeBg    = 'rgba(255,255,255,0.06)';
    badgeText  = 'Ditolak';
    badgeIcon  = 'ban';
  }

  // Parse keterangan meta jika ada
  let cleanDesc = d.keterangan || '';
  try {
    cleanDesc = cleanDesc.replace(/<!--\s*PTV_META:.*?-->/s, '').trim();
  } catch {}

  return `
    <div class="glass-card" style="padding:22px;border-left:4px solid ${badgeColor};">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;color:var(--ptv-red);font-size:16px;flex-shrink:0;">
            <i class="fa-solid fa-wrench"></i>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:16px;font-weight:800;color:var(--ptv-text);">${d.nama_alat || 'Alat Studio'}</span>
              ${d.unit_code ? `<span class="badge" style="background:rgba(59,130,246,0.15);color:var(--ptv-cyan);font-size:11px;">${d.unit_code}</span>` : ''}
            </div>
            <div style="font-size:13.5px;font-weight:600;color:var(--ptv-text-soft);margin-top:2px;">
              ${d.masalah || 'Kendala operasional'}
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:11.5px;font-weight:700;background:${badgeBg};color:${badgeColor};">
            <i class="fa-solid fa-${badgeIcon}"></i> ${badgeText}
          </span>
          ${isExec() || st !== 'selesai' ? `
            <button class="btn btn-sm btn-ghost btnOpenQC" data-id="${d.id}" style="font-size:12px;gap:5px;">
              <i class="fa-solid fa-clipboard-check"></i> ${st === 'selesai' ? 'Detail QC' : 'Proses QC'}
            </button>
          ` : ''}
        </div>
      </div>

      ${cleanDesc ? `<p style="font-size:13px;color:var(--ptv-text-soft);line-height:1.6;margin-bottom:14px;background:rgba(255,255,255,0.02);padding:10px 14px;border-radius:8px;border:1px solid var(--ptv-border-soft);">${cleanDesc}</p>` : ''}

      <!-- Metadata footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ptv-text-dim);border-top:1px solid var(--ptv-border-soft);padding-top:12px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span><i class="fa-solid fa-user" style="margin-right:5px;color:var(--ptv-blue);"></i>Pelapor: <strong style="color:var(--ptv-text-soft);">${d.pelapor_nama || 'Kru PTV'}</strong>${d.pelapor_kontak ? ` (${d.pelapor_kontak})` : ''}</span>
          <span><i class="fa-solid fa-calendar" style="margin-right:5px;color:var(--ptv-cyan);"></i>${_fmtDate(d.created_at)}</span>
        </div>

        ${d.qc_by ? `
          <div style="display:flex;align-items:center;gap:6px;color:var(--ptv-green);">
            <i class="fa-solid fa-shield-check"></i>
            <span>QC oleh <strong>${d.qc_by}</strong> (${_fmtDate(d.qc_date)})</span>
          </div>
        ` : ''}
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
    <div class="glass-card" style="text-align:center;padding:56px 24px;color:var(--ptv-text-dim);">
      <i class="fa-solid fa-circle-check" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-green);opacity:0.7;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Tidak Ada Tiket Kendala</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Seluruh peralatan studio terpantau siap pakai tanpa kendala aktif.
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

  const sInput = container.querySelector('#searchDamage');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const listEl = container.querySelector('#damageListContainer');
      if (listEl) {
        listEl.innerHTML = filtered.length > 0 ? filtered.map(d => _damageCardHTML(d)).join('') : _emptyHTML();
        _attachCardEvents(container);
      }
    });
  }

  container.querySelector('#btnLaporBaru')?.addEventListener('click', () => {
    _openLaporModal(container);
  });

  _attachCardEvents(container);
}

function _attachCardEvents(container) {
  container.querySelectorAll('.btnOpenQC').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      _openQCModal(id, container);
    });
  });
}

// ── MODAL FORM LAPOR KERUSAKAN ────────────────────────────
function _openLaporModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'laporModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--ptv-border-soft);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-red);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:16px;"></i>
          </div>
          <div>
            <h3 style="font-size:17px;font-weight:800;margin:0;">Lapor Kendala / Kerusakan Alat</h3>
            <span style="font-size:12px;color:var(--ptv-text-soft);">Sampaikan kendala agar tim QC segera menindaklanjuti</span>
          </div>
        </div>
        <button id="closeLaporModal" class="btn btn-ghost btn-sm" style="font-size:16px;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="laporForm">
        <!-- Pilih Alat -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Pilih Alat Studio <span style="color:var(--ptv-red);">*</span></label>
          <select id="fAlatId" class="input-field" required>
            <option value="">-- Pilih Alat --</option>
            ${_allInv.map(i => `<option value="${i.id}">${i.nama} (${i.kode})</option>`).join('')}
          </select>
        </div>

        <!-- Pilih Unit (Dinamis) -->
        <div style="margin-bottom:14px;" id="unitSelectWrapper">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Unit Individual (Opsional)</label>
          <select id="fUnitCode" class="input-field">
            <option value="">-- Pilih Unit (Jika Ada) --</option>
          </select>
        </div>

        <!-- Masalah -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kendala Utama <span style="color:var(--ptv-red);">*</span></label>
          <input id="fMasalah" type="text" class="input-field" placeholder="Contoh: Layar monitor flicker / Kabel HDMI putus" required>
        </div>

        <!-- Keterangan Detail -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kronologi / Keterangan Tambahan</label>
          <textarea id="fKeterangan" class="input-field" rows="3" placeholder="Jelaskan detail kendala saat digunakan di lapangan..."></textarea>
        </div>

        <!-- Pelapor & Kontak -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Pelapor</label>
            <input id="fPelapor" type="text" class="input-field" value="${currentCrew?.name || 'Kru PTV'}" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kontak WhatsApp</label>
            <input id="fKontak" type="text" class="input-field" placeholder="08xxxxxxxx">
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelLapor" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSubmitLapor" class="btn btn-primary btn-sm" style="background:var(--ptv-red);border-color:var(--ptv-red);padding:8px 20px;">
            <i class="fa-solid fa-paper-plane"></i> Kirim Laporan
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  // Dinamis ganti unit
  const alatSel = overlay.querySelector('#fAlatId');
  const unitSel = overlay.querySelector('#fUnitCode');

  alatSel?.addEventListener('change', () => {
    const selectedAlatId = alatSel.value;
    const units = _allUnits.filter(u => u.inventaris_id === selectedAlatId);
    if (units.length > 0) {
      unitSel.innerHTML = '<option value="">-- Pilih Unit --</option>' +
        units.map(u => `<option value="${u.kode_unit}" data-unit-id="${u.id}" data-unit-no="${u.nomor_unit}">${u.kode_unit} (Unit ${u.nomor_unit} - ${u.status_kondisi || 'Baik'})</option>`).join('');
    } else {
      unitSel.innerHTML = '<option value="">-- Tidak ada unit individual --</option>';
    }
  });

  overlay.querySelector('#closeLaporModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelLapor')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#laporForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _handleLaporSubmit(overlay, container);
  });
}

async function _handleLaporSubmit(modalOverlay, container) {
  const alatSel = modalOverlay.querySelector('#fAlatId');
  const unitSel = modalOverlay.querySelector('#fUnitCode');
  const masalahEl = modalOverlay.querySelector('#fMasalah');
  const ketEl     = modalOverlay.querySelector('#fKeterangan');
  const pelaporEl = modalOverlay.querySelector('#fPelapor');
  const kontakEl  = modalOverlay.querySelector('#fKontak');
  const submitBtn = modalOverlay.querySelector('#btnSubmitLapor');

  const alatId = alatSel.value;
  const invObj = _allInv.find(i => i.id === alatId);
  const namaAlat = invObj ? invObj.nama : 'Alat Studio';
  const unitCode = unitSel.value || '';
  const selectedUnitOpt = unitSel.options[unitSel.selectedIndex];
  const unitId = selectedUnitOpt?.dataset?.unitId || null;
  const unitNo = selectedUnitOpt?.dataset?.unitNo ? parseInt(selectedUnitOpt.dataset.unitNo) : 1;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';

  const sb = getSupabase();
  try {
    const payload = {
      alat_id:        alatId,
      nama_alat:      unitCode ? `${namaAlat} — ${unitCode}` : namaAlat,
      masalah:        masalahEl.value.trim(),
      keterangan:     `${ketEl.value.trim()}\n<!-- PTV_META: ${JSON.stringify({ unit_no: unitNo, unit_code: unitCode })} -->`,
      pelapor_nama:   pelaporEl.value.trim(),
      pelapor_kontak: kontakEl.value.trim(),
      status:         'Baru',
      unit_no:        unitNo,
      unit_code:      unitCode || null,
      inventaris_id:  alatId,
      inventaris_unit_id: unitId,
    };

    const { error: insErr } = await sb.from('ptv_lapor_masalah').insert(payload);
    if (insErr) throw insErr;

    // Tandai unit fisik sebagai Rusak di ptv_inventaris_unit jika ada
    if (unitCode) {
      await sb
        .from('ptv_inventaris_unit')
        .update({ status_kondisi: 'Rusak Ringan' })
        .eq('kode_unit', unitCode);
    }

    modalOverlay.remove();
    if (window.toast) window.toast('Laporan kerusakan berhasil dikirim ke tim QC!', 'success');

    await _loadData();
    _renderView(container);
  } catch (err) {
    console.error('[KERUSAKAN] Submit error:', err);
    alert('Gagal mengirim laporan: ' + (err.message || err));
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Laporan';
  }
}

// ── MODAL QUALITY CHECK & UPDATE STATUS ───────────────────
function _openQCModal(reportId, container) {
  const damage = _allDamages.find(d => d.id === reportId);
  if (!damage) return;

  const overlay = document.createElement('div');
  overlay.id = 'qcModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:520px;padding:26px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <h3 style="font-size:16px;font-weight:800;margin:0;">
          <i class="fa-solid fa-shield-check" style="color:var(--ptv-green);margin-right:8px;"></i>Pemeriksaan QC & Status
        </h3>
        <button id="closeQCModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="background:rgba(255,255,255,0.02);padding:12px;border-radius:8px;border:1px solid var(--ptv-border-soft);margin-bottom:16px;font-size:13px;">
        <div style="font-weight:700;color:var(--ptv-text);">${damage.nama_alat}</div>
        <div style="color:var(--ptv-text-soft);margin-top:2px;">${damage.masalah}</div>
      </div>

      <form id="qcForm">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Status Penanganan</label>
          <select id="fQCStatus" class="input-field">
            <option value="Baru" ${damage.status === 'Baru' ? 'selected' : ''}>Baru (Menunggu Tindakan)</option>
            <option value="Dalam Perbaikan" ${damage.status === 'Dalam Perbaikan' || damage.status === 'Proses' ? 'selected' : ''}>Dalam Perbaikan (Servis/Vendor)</option>
            <option value="Selesai" ${damage.status === 'Selesai' ? 'selected' : ''}>Selesai (Sudah Normal & Siap Pakai)</option>
            <option value="Ditolak" ${damage.status === 'Ditolak' ? 'selected' : ''}>Ditolak (Tidak Ditemukan Kerusakan)</option>
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Petugas QC</label>
          <input id="fQCBy" type="text" class="input-field" value="${damage.qc_by || currentCrew?.name || 'Petugas QC PTV'}" required>
        </div>

        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Catatan Hasil Pemeriksaan QC</label>
          <textarea id="fQCNotes" class="input-field" rows="3" placeholder="Contoh: Sensor sudah dibersihkan, shutter normal...">${damage.qc_notes || ''}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelQC" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSaveQC" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Simpan Hasil QC
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeQCModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelQC')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#qcForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const stVal    = overlay.querySelector('#fQCStatus').value;
    const qcByVal  = overlay.querySelector('#fQCBy').value.trim();
    const notesVal = overlay.querySelector('#fQCNotes').value.trim();
    const saveBtn  = overlay.querySelector('#btnSaveQC');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    try {
      const { error: updErr } = await sb
        .from('ptv_lapor_masalah')
        .update({
          status:   stVal,
          qc_by:    qcByVal,
          qc_date:  new Date().toISOString().split('T')[0],
          qc_notes: notesVal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (updErr) throw updErr;

      // Jika statusnya 'Selesai', kembalikan status kondisi unit ke 'Baik'
      if (stVal === 'Selesai' && damage.unit_code) {
        await sb
          .from('ptv_inventaris_unit')
          .update({ status_kondisi: 'Baik' })
          .eq('kode_unit', damage.unit_code);
      }

      overlay.remove();
      if (window.toast) window.toast('Hasil Quality Check berhasil diperbarui!', 'success');

      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[KERUSAKAN] QC update error:', err);
      alert('Gagal menyimpan QC: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Hasil QC';
    }
  });
}
