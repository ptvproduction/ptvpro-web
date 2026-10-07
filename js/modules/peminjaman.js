// ============================================================
// js/modules/peminjaman.js — Modul Peminjaman & Pengembalian Alat
// Terhubung langsung ke Supabase: ptv_peminjaman, ptv_inventaris, ptv_inventaris_unit
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allLoans       = [];
let _allInv         = [];
let _allUnits       = [];
let _allCrews       = [];
let _allEvents      = [];
let _activeFilter   = 'semua'; // 'semua' | 'aktif' | 'selesai' | 'terlambat'
let _searchQuery    = '';

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
    const [loansRes, invRes, unitsRes, crewsRes, eventsRes] = await Promise.all([
      sb.from('ptv_peminjaman')
        .select('id, aset_id, jumlah, keperluan, status, catatan, tanggal_pinjam, tanggal_kembali, created_at')
        .order('created_at', { ascending: false }),
      sb.from('ptv_inventaris')
        .select('id, kode, nama, kategori, foto_url')
        .order('nama', { ascending: true }),
      sb.from('ptv_inventaris_unit')
        .select('id, inventaris_id, nomor_unit, kode_unit, status_kondisi, status_peminjaman')
        .order('nomor_unit', { ascending: true }),
      sb.from('ptv_kru')
        .select('id, nama, divisi, jabatan, ptv_id')
        .order('nama', { ascending: true }),
      sb.from('ptv_acara')
        .select('id, nama_acara, tanggal')
        .order('tanggal', { ascending: false })
        .limit(25),
    ]);

    if (loansRes.error) console.error('[PEMINJAMAN] Load loans error:', loansRes.error);
    if (invRes.error) console.error('[PEMINJAMAN] Load inv error:', invRes.error);
    if (unitsRes.error) console.error('[PEMINJAMAN] Load units error:', unitsRes.error);

    _allLoans  = loansRes.data  || [];
    _allInv    = invRes.data    || [];
    _allUnits  = unitsRes.data  || [];
    _allCrews  = crewsRes.data  || [];
    _allEvents = eventsRes.data || [];
  } catch (err) {
    console.error('[PEMINJAMAN] Fatal load error:', err);
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
            { key: 'semua',     label: 'Semua Transaksi' },
            { key: 'aktif',     label: 'Sedang Dipinjam' },
            { key: 'terlambat', label: 'Lewat Tenggat' },
            { key: 'selesai',   label: 'Selesai' },
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
              id="searchLoan"
              type="text"
              class="input-field"
              placeholder="Cari peminjam, alat, atau keperluan..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          <!-- Tambah Pinjaman Button -->
          <button id="btnPinjamBaru" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;">
            <i class="fa-solid fa-plus"></i> Pinjam Alat
          </button>
        </div>
      </div>

      <!-- List Peminjaman -->
      <div id="loanListContainer" style="display:flex;flex-direction:column;gap:14px;">
        ${filtered.length > 0 ? filtered.map(l => _loanCardHTML(l)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── STATS CARDS ───────────────────────────────────────────
function _statsCardsHTML() {
  const now = new Date();
  now.setHours(0,0,0,0);

  let activeCount = 0;
  let activeUnitsCount = 0;
  let overdueCount = 0;
  let finishedCount = 0;

  _allLoans.forEach(l => {
    const isReturned = (l.status === 'dikembalikan' || l.status === 'returned');
    if (isReturned) {
      finishedCount++;
    } else {
      activeCount++;
      const meta = _parseMeta(l.catatan);
      if (meta && Array.isArray(meta.units) && meta.units.length > 0) {
        const retUnits = meta.returned_units || [];
        activeUnitsCount += Math.max(0, meta.units.length - retUnits.length);
      } else {
        activeUnitsCount += Math.max(1, parseInt(l.jumlah || 1));
      }

      if (l.tanggal_kembali) {
        const d = new Date(l.tanggal_kembali);
        d.setHours(0,0,0,0);
        if (d < now) overdueCount++;
      }
    }
  });

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Pinjaman Aktif</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-hand-holding-hand" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-text);">${activeCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">transaksi</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Unit Di Lapangan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-cyan);">
            <i class="fa-solid fa-box-open" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-cyan);">${activeUnitsCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">unit alat</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Lewat Tenggat</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-red);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:${overdueCount > 0 ? 'var(--ptv-red)' : 'var(--ptv-text)'};">${overdueCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">perlu ditagih</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Selesai Dikembalikan</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-green);">
            <i class="fa-solid fa-circle-check" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-green);">${finishedCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">riwayat</span></div>
      </div>
    </div>`;
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const now = new Date();
  now.setHours(0,0,0,0);
  const q = _searchQuery.toLowerCase().trim();

  return _allLoans.filter(l => {
    const isReturned = (l.status === 'dikembalikan' || l.status === 'returned');
    const isOverdue = !isReturned && l.tanggal_kembali && new Date(l.tanggal_kembali).setHours(0,0,0,0) < now;

    if (_activeFilter === 'aktif' && isReturned) return false;
    if (_activeFilter === 'selesai' && !isReturned) return false;
    if (_activeFilter === 'terlambat' && !isOverdue) return false;

    if (q) {
      const matchKep = (l.keperluan || '').toLowerCase().includes(q);
      const matchCat = (l.catatan || '').toLowerCase().includes(q);
      if (!matchKep && !matchCat) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _loanCardHTML(loan) {
  const isReturned = (loan.status === 'dikembalikan' || loan.status === 'returned');
  const now = new Date();
  now.setHours(0,0,0,0);
  const isOverdue  = !isReturned && loan.tanggal_kembali && new Date(loan.tanggal_kembali).setHours(0,0,0,0) < now;

  const meta = _parseMeta(loan.catatan);
  const borrower = meta?.borrower_name || meta?.user || (loan.keperluan ? loan.keperluan.split('—')[0].trim() : 'Kru PTV');
  const purpose  = meta?.purpose || (loan.keperluan ? (loan.keperluan.split('—')[1] || loan.keperluan).trim() : 'Peminjaman Studio');
  const init     = borrower.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const unitsBorrowed = _extractLoanUnits(loan, meta);

  let badgeColor = 'var(--ptv-blue)';
  let badgeBg    = 'rgba(59,130,246,0.12)';
  let badgeText  = 'Sedang Dipinjam';
  let badgeIcon  = 'clock';

  if (isReturned) {
    badgeColor = 'var(--ptv-green)';
    badgeBg    = 'rgba(16,185,129,0.12)';
    badgeText  = 'Dikembalikan';
    badgeIcon  = 'circle-check';
  } else if (isOverdue) {
    badgeColor = 'var(--ptv-red)';
    badgeBg    = 'rgba(239,68,68,0.15)';
    badgeText  = 'Terlambat!';
    badgeIcon  = 'triangle-exclamation';
  }

  return `
    <div class="glass-card" style="padding:22px;border-left:4px solid ${badgeColor};">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        <!-- Peminjam Info -->
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--ptv-blue),var(--ptv-cyan));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0;">
            ${init || 'KR'}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:15px;font-weight:800;">${borrower}</span>
              ${meta?.code ? `<span class="badge" style="font-size:10.5px;background:rgba(255,255,255,0.06);color:var(--ptv-text-dim);">${meta.code}</span>` : ''}
            </div>
            <div style="font-size:12.5px;color:var(--ptv-text-soft);margin-top:2px;">
              <i class="fa-solid fa-bullseye" style="color:var(--ptv-cyan);margin-right:4px;"></i>${purpose}
            </div>
          </div>
        </div>

        <!-- Status & Actions -->
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:11.5px;font-weight:700;background:${badgeBg};color:${badgeColor};">
            <i class="fa-solid fa-${badgeIcon}"></i> ${badgeText}
          </span>
          ${!isReturned ? `
            <button class="btn btn-sm btn-primary btnReturnAll" data-loan-id="${loan.id}" style="font-size:12px;gap:6px;">
              <i class="fa-solid fa-rotate-left"></i> Kembalikan Semua
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Date Details -->
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--ptv-text-dim);margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <span><i class="fa-solid fa-calendar-arrow-up" style="color:var(--ptv-blue);margin-right:5px;"></i>Pinjam: <strong style="color:var(--ptv-text-soft);">${_fmtDate(loan.tanggal_pinjam)}</strong></span>
        <span><i class="fa-solid fa-calendar-check" style="color:${isOverdue ? 'var(--ptv-red)' : 'var(--ptv-cyan)'};margin-right:5px;"></i>Batas Kembali: <strong style="color:${isOverdue ? 'var(--ptv-red)' : 'var(--ptv-text-soft)'};">${_fmtDate(loan.tanggal_kembali)}</strong></span>
      </div>

      <!-- Units List -->
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ptv-text-dim);letter-spacing:0.05em;">
          <i class="fa-solid fa-boxes-stacked" style="margin-right:5px;"></i>Unit Alat Dipinjam (${unitsBorrowed.length} unit):
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;">
          ${unitsBorrowed.map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);border-radius:8px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <i class="fa-solid fa-barcode" style="color:var(--ptv-blue);font-size:12px;flex-shrink:0;"></i>
                <div style="min-width:0;">
                  <div style="font-size:12.5px;font-weight:700;color:var(--ptv-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${u.code || u.unit_code || 'INV-???'}
                  </div>
                  <div style="font-size:11px;color:var(--ptv-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${u.name || 'Alat Studio'}
                  </div>
                </div>
              </div>
              <div style="flex-shrink:0;">
                ${u.isReturned || isReturned ? `
                  <span class="badge" style="background:rgba(16,185,129,0.12);color:var(--ptv-green);font-size:10px;">
                    <i class="fa-solid fa-check"></i> Kembali
                  </span>
                ` : `
                  <button class="btn btn-ghost btn-sm btnReturnSingleUnit" data-loan-id="${loan.id}" data-unit-id="${u.unit_id || ''}" data-unit-code="${u.code || u.unit_code || ''}" style="font-size:10.5px;padding:3px 8px;color:var(--ptv-cyan);" title="Kembalikan unit ini saja">
                    <i class="fa-solid fa-arrow-turn-down-left"></i> Kembali
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
}

// ── EXTRACT LOAN UNITS HELPER ─────────────────────────────
function _extractLoanUnits(loan, meta) {
  const result = [];
  const returnedUnits = meta?.returned_units || [];

  if (meta && Array.isArray(meta.units) && meta.units.length > 0) {
    meta.units.forEach(u => {
      const code = u.unit_code || u.code || '';
      const unitObj = _allUnits.find(un => un.kode_unit === code || un.id === u.unit_id);
      let invName = 'Alat Studio';
      if (unitObj) {
        const invObj = _allInv.find(i => i.id === unitObj.inventaris_id);
        if (invObj) invName = invObj.nama;
      }
      result.push({
        unit_id:    u.unit_id || (unitObj ? unitObj.id : null),
        code:       code,
        name:       u.name || invName,
        isReturned: returnedUnits.includes(code) || (loan.status === 'dikembalikan'),
      });
    });
  } else if (meta && Array.isArray(meta.equipment_ids) && meta.equipment_ids.length > 0) {
    meta.equipment_ids.forEach(eid => {
      const unitObj = _allUnits.find(un => un.id === eid || un.kode_unit === eid);
      if (unitObj) {
        const invObj = _allInv.find(i => i.id === unitObj.inventaris_id);
        result.push({
          unit_id:    unitObj.id,
          code:       unitObj.kode_unit,
          name:       invObj ? invObj.nama : 'Alat Studio',
          isReturned: returnedUnits.includes(unitObj.kode_unit) || (loan.status === 'dikembalikan'),
        });
      } else {
        const invObj = _allInv.find(i => i.id === eid);
        result.push({
          unit_id:    null,
          code:       invObj ? invObj.kode : 'INV-???',
          name:       invObj ? invObj.nama : 'Alat Studio',
          isReturned: loan.status === 'dikembalikan',
        });
      }
    });
  } else if (loan.aset_id) {
    const invObj = _allInv.find(i => i.id === loan.aset_id);
    result.push({
      unit_id:    null,
      code:       invObj ? invObj.kode : 'INV-???',
      name:       invObj ? invObj.nama : 'Alat Studio',
      isReturned: loan.status === 'dikembalikan',
    });
  } else {
    result.push({
      unit_id:    null,
      code:       'INV-001-01',
      name:       'Peralatan Studio',
      isReturned: loan.status === 'dikembalikan',
    });
  }

  return result;
}

// ── PARSE META HELPER ─────────────────────────────────────
function _parseMeta(notes) {
  if (!notes) return null;
  try {
    const m = notes.match(/<!--\s*PTV_META:\s*({.*?})\s*-->/s);
    if (m && m[1]) return JSON.parse(m[1]);
  } catch {}
  return null;
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
      <i class="fa-solid fa-box-archive" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-blue);opacity:0.6;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Tidak Ada Transaksi Peminjaman</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Belum ada transaksi peminjaman yang cocok dengan filter atau kata kunci ini.
      </p>
    </div>`;
}

// ── EVENT LISTENERS ───────────────────────────────────────
function _attachEvents(container) {
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;
      _renderView(container);
    });
  });

  const sInput = container.querySelector('#searchLoan');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const listEl = container.querySelector('#loanListContainer');
      if (listEl) {
        listEl.innerHTML = filtered.length > 0 ? filtered.map(l => _loanCardHTML(l)).join('') : _emptyHTML();
        _attachCardEvents(container);
      }
    });
  }

  container.querySelector('#btnPinjamBaru')?.addEventListener('click', () => {
    _openPinjamModal(container);
  });

  _attachCardEvents(container);
}

function _attachCardEvents(container) {
  container.querySelectorAll('.btnReturnAll').forEach(btn => {
    btn.addEventListener('click', async () => {
      const loanId = btn.dataset.loanId;
      if (!confirm('Pastikan seluruh alat dalam transaksi ini telah diperiksa fisik dan kembali lengkap ke studio. Lanjutkan?')) return;
      await _returnFullLoan(loanId, container);
    });
  });

  container.querySelectorAll('.btnReturnSingleUnit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const loanId   = btn.dataset.loanId;
      const unitCode = btn.dataset.unitCode;
      const unitId   = btn.dataset.unitId;
      if (!confirm(`Tandai unit ${unitCode} sebagai telah dikembalikan ke studio?`)) return;
      await _returnSingleUnit(loanId, unitCode, unitId, container);
    });
  });
}

// ── PENGEMBALIAN SEMUA TRANSAKSI ──────────────────────────
async function _returnFullLoan(loanId, container) {
  const sb = getSupabase();
  const loan = _allLoans.find(l => l.id === loanId);
  if (!loan) return;

  try {
    const meta = _parseMeta(loan.catatan) || {};
    meta.status = 'returned';
    const newCatatan = loan.catatan ? loan.catatan.replace(/<!--\s*PTV_META:\s*({.*?})\s*-->/s, `<!-- PTV_META: ${JSON.stringify(meta)} -->`) : `<!-- PTV_META: ${JSON.stringify(meta)} -->`;

    const { error: loanErr } = await sb
      .from('ptv_peminjaman')
      .update({
        status: 'dikembalikan',
        tanggal_kembali: new Date().toISOString().split('T')[0],
        catatan: newCatatan,
      })
      .eq('id', loanId);

    if (loanErr) throw loanErr;

    const units = _extractLoanUnits(loan, meta);
    const unitCodes = units.map(u => u.code).filter(Boolean);

    if (unitCodes.length > 0) {
      await sb
        .from('ptv_inventaris_unit')
        .update({ status_peminjaman: 'Tersedia' })
        .in('kode_unit', unitCodes);
    }

    if (window.toast) window.toast('Peminjaman berhasil dikembalikan seluruhnya!', 'success');
    await _loadData();
    _renderView(container);
  } catch (err) {
    console.error('[PEMINJAMAN] Return all error:', err);
    alert('Gagal memproses pengembalian: ' + (err.message || err));
  }
}

// ── PENGEMBALIAN PARSIAL PER UNIT ─────────────────────────
async function _returnSingleUnit(loanId, unitCode, unitId, container) {
  const sb = getSupabase();
  const loan = _allLoans.find(l => l.id === loanId);
  if (!loan) return;

  try {
    const meta = _parseMeta(loan.catatan) || {};
    meta.returned_units = meta.returned_units || [];
    if (!meta.returned_units.includes(unitCode)) {
      meta.returned_units.push(unitCode);
    }

    const allUnits = _extractLoanUnits(loan, meta);
    const allReturned = allUnits.every(u => meta.returned_units.includes(u.code));

    if (allReturned) meta.status = 'returned';

    const newCatatan = loan.catatan ? loan.catatan.replace(/<!--\s*PTV_META:\s*({.*?})\s*-->/s, `<!-- PTV_META: ${JSON.stringify(meta)} -->`) : `<!-- PTV_META: ${JSON.stringify(meta)} -->`;

    const updatePayload = { catatan: newCatatan };
    if (allReturned) {
      updatePayload.status = 'dikembalikan';
      updatePayload.tanggal_kembali = new Date().toISOString().split('T')[0];
    }

    const { error: loanErr } = await sb
      .from('ptv_peminjaman')
      .update(updatePayload)
      .eq('id', loanId);

    if (loanErr) throw loanErr;

    if (unitCode) {
      await sb
        .from('ptv_inventaris_unit')
        .update({ status_peminjaman: 'Tersedia' })
        .eq('kode_unit', unitCode);
    }

    if (window.toast) {
      window.toast(`Unit ${unitCode} berhasil dikembalikan!${allReturned ? ' Seluruh peminjaman kini selesai.' : ''}`, 'success');
    }

    await _loadData();
    _renderView(container);
  } catch (err) {
    console.error('[PEMINJAMAN] Return single unit error:', err);
    alert('Gagal memproses pengembalian unit: ' + (err.message || err));
  }
}

// ── MODAL PINJAM ALAT BARU ────────────────────────────────
function _openPinjamModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'pinjamModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  const availableUnits = _allUnits.filter(u => {
    return (u.status_peminjaman === 'Tersedia' || !u.status_peminjaman) &&
           (u.status_kondisi !== 'Rusak Berat' && u.status_kondisi !== 'Maintenance');
  });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:680px;max-height:92vh;overflow-y:auto;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--ptv-border-soft);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-hand-holding-hand" style="font-size:16px;"></i>
          </div>
          <div>
            <h3 style="font-size:17px;font-weight:800;margin:0;">Formulir Peminjaman Alat</h3>
            <span style="font-size:12px;color:var(--ptv-text-soft);">Pilih kru peminjam, keperluan, dan centang unit alat yang dibawa</span>
          </div>
        </div>
        <button id="closePinjamModal" class="btn btn-ghost btn-sm" style="font-size:16px;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="pinjamForm">
        <!-- Peminjam & Acara -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Peminjam <span style="color:var(--ptv-red);">*</span></label>
            ${isExec() ? `
              <select id="fPeminjam" class="input-field" required>
                ${_allCrews.map(c => `
                  <option value="${c.nama}" ${c.id === currentCrew?.id ? 'selected' : ''}>
                    ${c.nama} (${c.divisi || 'Kru'})
                  </option>
                `).join('')}
              </select>
            ` : `
              <input id="fPeminjam" type="text" class="input-field" value="${currentCrew?.name || 'Kru PTV'}" readonly style="opacity:0.85;cursor:not-allowed;">
            `}
          </div>

          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Terkait Acara (Opsional)</label>
            <select id="fAcara" class="input-field">
              <option value="">-- Tidak Terkait Acara Khusus --</option>
              ${_allEvents.map(e => `<option value="${e.id}">${e.nama_acara} (${_fmtDate(e.tanggal)})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Keperluan -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Keperluan Penggunaan <span style="color:var(--ptv-red);">*</span></label>
          <input id="fKeperluan" type="text" class="input-field" placeholder="Contoh: Liputan Kajian Akbar / Podcast Studio" required>
        </div>

        <!-- Tanggal Pinjam & Kembali -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Tanggal Pinjam <span style="color:var(--ptv-red);">*</span></label>
            <input id="fTglPinjam" type="date" class="input-field" value="${today}" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Estimasi Selesai / Kembali <span style="color:var(--ptv-red);">*</span></label>
            <input id="fTglKembali" type="date" class="input-field" value="${tomorrow}" required>
          </div>
        </div>

        <!-- Unit Picker Section -->
        <div style="margin-bottom:20px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <label style="font-size:13px;font-weight:700;color:var(--ptv-text);">
              Pilih Unit Alat Tersedia <span style="color:var(--ptv-red);">*</span>
            </label>
            <span id="selectedUnitsCount" style="font-size:12px;font-weight:700;color:var(--ptv-cyan);">0 unit dipilih</span>
          </div>

          <!-- Filter & Search Unit -->
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input id="searchUnitPicker" type="text" class="input-field" placeholder="Cari nama alat / barcode unit..." style="font-size:12.5px;height:36px;">
          </div>

          <!-- Unit Checklist Container -->
          <div id="unitChecklist" style="max-height:220px;overflow-y:auto;background:rgba(0,0,0,0.25);border:1px solid var(--ptv-border-soft);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;">
            ${_renderUnitChecklistItems(availableUnits, '')}
          </div>
        </div>

        <!-- Submit Button -->
        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelPinjam" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSubmitPinjam" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Simpan Peminjaman
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const uSearch = overlay.querySelector('#searchUnitPicker');
  uSearch?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const listEl = overlay.querySelector('#unitChecklist');
    if (listEl) {
      listEl.innerHTML = _renderUnitChecklistItems(availableUnits, q);
      _attachUnitCheckboxListeners(overlay);
    }
  });

  _attachUnitCheckboxListeners(overlay);

  overlay.querySelector('#closePinjamModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelPinjam')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#pinjamForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _handlePinjamSubmit(overlay, container);
  });
}

function _renderUnitChecklistItems(availableUnits, query) {
  const filtered = availableUnits.filter(u => {
    if (!query) return true;
    const inv = _allInv.find(i => i.id === u.inventaris_id);
    const invName = (inv?.nama || '').toLowerCase();
    const code = (u.kode_unit || '').toLowerCase();
    return invName.includes(query) || code.includes(query);
  });

  if (filtered.length === 0) {
    return `<div style="text-align:center;padding:16px;font-size:12.5px;color:var(--ptv-text-dim);">Tidak ada unit tersedia yang cocok.</div>`;
  }

  return filtered.map(u => {
    const inv = _allInv.find(i => i.id === u.inventaris_id);
    const invName = inv?.nama || 'Alat Studio';
    const kat = inv?.kategori || 'Studio';

    return `
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--ptv-border-soft);border-radius:8px;cursor:pointer;transition:background .15s ease;">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <input type="checkbox" class="unitCheck" value="${u.id}" data-code="${u.kode_unit}" data-name="${invName}" style="accent-color:var(--ptv-blue);width:16px;height:16px;cursor:pointer;">
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--ptv-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${invName}</div>
            <div style="font-size:11px;color:var(--ptv-text-dim);display:flex;gap:6px;align-items:center;">
              <span style="color:var(--ptv-cyan);font-weight:600;">${u.kode_unit}</span>
              <span>•</span>
              <span>Unit ${u.nomor_unit}</span>
              <span>•</span>
              <span>${kat}</span>
            </div>
          </div>
        </div>
        <span class="badge" style="background:rgba(16,185,129,0.12);color:var(--ptv-green);font-size:10px;">${u.status_kondisi || 'Baik'}</span>
      </label>
    `;
  }).join('');
}

function _attachUnitCheckboxListeners(overlay) {
  const checkboxes = overlay.querySelectorAll('.unitCheck');
  const counterEl  = overlay.querySelector('#selectedUnitsCount');

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checkedCount = overlay.querySelectorAll('.unitCheck:checked').length;
      if (counterEl) {
        counterEl.textContent = `${checkedCount} unit dipilih`;
        counterEl.style.color = checkedCount > 0 ? 'var(--ptv-cyan)' : 'var(--ptv-text-dim)';
      }
    });
  });
}

// ── HANDLE FORM SUBMIT ────────────────────────────────────
async function _handlePinjamSubmit(modalOverlay, container) {
  const peminjamEl = modalOverlay.querySelector('#fPeminjam');
  const acaraEl    = modalOverlay.querySelector('#fAcara');
  const keperluanEl= modalOverlay.querySelector('#fKeperluan');
  const tglPinjamEl= modalOverlay.querySelector('#fTglPinjam');
  const tglKembaliEl=modalOverlay.querySelector('#fTglKembali');
  const submitBtn  = modalOverlay.querySelector('#btnSubmitPinjam');

  const checkedBoxes = Array.from(modalOverlay.querySelectorAll('.unitCheck:checked'));
  if (checkedBoxes.length === 0) {
    alert('Harap pilih minimal 1 unit alat yang akan dipinjam!');
    return;
  }

  const borrowerName = peminjamEl.value.trim();
  const purpose      = keperluanEl.value.trim();
  const outDate      = tglPinjamEl.value;
  const dueDate      = tglKembaliEl.value;
  const eventId      = acaraEl.value || null;

  const selectedUnits = checkedBoxes.map(cb => ({
    unit_id:   cb.value,
    unit_code: cb.dataset.code,
    name:      cb.dataset.name,
  }));

  const code = 'PJM-' + Date.now().toString(36).toUpperCase().slice(-6);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  const sb = getSupabase();

  try {
    const meta = {
      code:            code,
      borrower_name:   borrowerName,
      user:            borrowerName,
      purpose:         purpose,
      borrowed_at:     outDate,
      expected_return: dueDate,
      event_id:        eventId,
      units:           selectedUnits,
      returned_units:  [],
      status:          'borrowed',
    };

    const firstUnitObj = _allUnits.find(u => u.id === selectedUnits[0]?.unit_id);
    const primaryAsetId = firstUnitObj ? firstUnitObj.inventaris_id : null;

    const { error: insertErr } = await sb
      .from('ptv_peminjaman')
      .insert({
        aset_id:         primaryAsetId,
        jumlah:          selectedUnits.length,
        keperluan:       `${borrowerName} — ${purpose}`,
        status:          'borrowed',
        catatan:         `Peminjaman alat via PTV Pro\n<!-- PTV_META: ${JSON.stringify(meta)} -->`,
        tanggal_pinjam:  outDate,
        tanggal_kembali: dueDate,
      });

    if (insertErr) throw insertErr;

    const unitCodes = selectedUnits.map(u => u.unit_code).filter(Boolean);
    if (unitCodes.length > 0) {
      await sb
        .from('ptv_inventaris_unit')
        .update({ status_peminjaman: 'Dipinjam' })
        .in('kode_unit', unitCodes);
    }

    modalOverlay.remove();
    if (window.toast) window.toast(`Peminjaman berhasil dicatat! (${selectedUnits.length} unit)`, 'success');

    await _loadData();
    _renderView(container);
  } catch (err) {
    console.error('[PEMINJAMAN] Submit error:', err);
    alert('Gagal mencatat peminjaman: ' + (err.message || err));
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Peminjaman';
  }
}
