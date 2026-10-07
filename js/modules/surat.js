// ============================================================
// js/modules/surat.js — Modul Surat Resmi & Dokumen Studio PTV
// Terhubung langsung ke Supabase: ptv_surat_tugas, ptv_surat_barang, ptv_surat_izin
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _allDocs       = [];
let _activeType    = 'semua'; // 'semua' | 'tugas' | 'barang' | 'izin'
let _activeStatus  = 'semua';
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
    const [stRes, sbbRes, siRes] = await Promise.all([
      sb.from('ptv_surat_tugas').select('*').order('created_at', { ascending: false }),
      sb.from('ptv_surat_barang').select('*').order('created_at', { ascending: false }),
      sb.from('ptv_surat_izin').select('*').order('created_at', { ascending: false }),
    ]);

    const docs = [];
    (stRes.data || []).forEach(d => docs.push({ ...d, _docType: 'tugas', _docPrefix: 'ST' }));
    (sbbRes.data || []).forEach(d => docs.push({ ...d, _docType: 'barang', _docPrefix: 'SBB' }));
    (siRes.data || []).forEach(d => docs.push({ ...d, _docType: 'izin', _docPrefix: 'SI' }));

    docs.sort((a, b) => new Date(b.created_at || b.tanggal_mulai) - new Date(a.created_at || a.tanggal_mulai));
    _allDocs = docs;
  } catch (err) {
    console.error('[SURAT] Fatal load error:', err);
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
        ${[1,2,3].map(() => `<div class="skeleton glass-card" style="height:120px;"></div>`).join('')}
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
            { key: 'semua',  label: 'Semua Surat' },
            { key: 'tugas',  label: 'Surat Tugas' },
            { key: 'barang', label: 'Surat Jalan / Barang' },
            { key: 'izin',   label: 'Surat Izin Kru' },
          ].map(f => `
            <button
              class="btn btn-sm ${f.key === _activeType ? 'btn-primary' : 'btn-ghost'}"
              data-type="${f.key}"
              style="font-size:12.5px;padding:6px 14px;"
            >${f.label}</button>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:440px;min-width:240px;justify-content:flex-end;">
          <!-- Search -->
          <div style="position:relative;flex:1;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ptv-text-dim);font-size:13px;"></i>
            <input
              id="searchDoc"
              type="text"
              class="input-field"
              placeholder="Cari perihal, nomor surat, nama..."
              value="${_searchQuery}"
              style="padding-left:36px;font-size:13px;height:38px;"
            >
          </div>

          <!-- Buat Surat Button -->
          <button id="btnBuatSurat" class="btn btn-primary btn-sm" style="white-space:nowrap;gap:6px;height:38px;">
            <i class="fa-solid fa-file-circle-plus"></i> Buat Surat
          </button>
        </div>
      </div>

      <!-- Document List -->
      <div id="docListContainer" style="display:flex;flex-direction:column;gap:12px;">
        ${filtered.length > 0 ? filtered.map(d => _docCardHTML(d)).join('') : _emptyHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── STATS CARDS ───────────────────────────────────────────
function _statsCardsHTML() {
  const tugasCount  = _allDocs.filter(d => d._docType === 'tugas').length;
  const barangCount = _allDocs.filter(d => d._docType === 'barang').length;
  const izinCount   = _allDocs.filter(d => d._docType === 'izin').length;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Surat Tugas</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-blue);">
            <i class="fa-solid fa-file-lines" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-blue);">${tugasCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">berkas</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Surat Jalan Alat</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-cyan);">
            <i class="fa-solid fa-truck-ramp-box" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-cyan);">${barangCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">berkas</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Izin Kru / Santri</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(197,163,90,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-gold);">
            <i class="fa-solid fa-user-clock" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-gold);">${izinCount} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">berkas</span></div>
      </div>

      <div class="glass-card" style="padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Arsip Surat</span>
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;color:var(--ptv-green);">
            <i class="fa-solid fa-stamp" style="font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--ptv-green);">${_allDocs.length} <span style="font-size:13px;font-weight:500;color:var(--ptv-text-dim);">dokumen</span></div>
      </div>
    </div>`;
}

// ── FILTER DATA ───────────────────────────────────────────
function _applyFilter() {
  const q = _searchQuery.toLowerCase().trim();

  return _allDocs.filter(d => {
    if (_activeType !== 'semua' && d._docType !== _activeType) return false;

    if (q) {
      const perihal = (d.nama_kegiatan || d.keperluan || d.jenis_kegiatan || '').toLowerCase();
      const nomor   = (d.nomor_surat || '').toLowerCase();
      const person  = (d.penanggung_jawab || d.pembawa || d.nama_santri || '').toLowerCase();
      if (!perihal.includes(q) && !nomor.includes(q) && !person.includes(q)) return false;
    }
    return true;
  });
}

// ── CARD HTML ─────────────────────────────────────────────
function _docCardHTML(d) {
  const title  = d.nama_kegiatan || d.keperluan || d.jenis_kegiatan || 'Surat Operasional';
  const person = d.penanggung_jawab || d.pembawa || d.nama_santri || 'Kru PTV';
  const nomor  = d.nomor_surat || 'Belum Bernomor Resmi';
  const stRaw  = (d.status || 'Disetujui').toLowerCase();

  let typeBadgeColor = 'var(--ptv-blue)';
  let typeLabel = 'Surat Tugas';
  if (d._docType === 'barang') {
    typeBadgeColor = 'var(--ptv-cyan)';
    typeLabel = 'Surat Jalan';
  } else if (d._docType === 'izin') {
    typeBadgeColor = 'var(--ptv-gold)';
    typeLabel = 'Surat Izin';
  }

  const isApproved = stRaw === 'disetujui' || stRaw === 'approved' || !d.status;

  return `
    <div class="glass-card" style="padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-left:3px solid ${typeBadgeColor};">
      <div style="display:flex;align-items:center;gap:14px;min-width:0;">
        <div style="width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);display:flex;align-items:center;justify-content:center;color:${typeBadgeColor};font-size:16px;flex-shrink:0;">
          <i class="fa-solid fa-${d._docType === 'barang' ? 'truck-ramp-box' : (d._docType === 'izin' ? 'user-clock' : 'file-signature')}"></i>
        </div>

        <div style="min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
            <span class="badge" style="background:rgba(255,255,255,0.05);color:${typeBadgeColor};font-size:10.5px;">${typeLabel}</span>
            <span style="font-size:12px;font-weight:700;color:var(--ptv-cyan);">${nomor}</span>
          </div>

          <h3 style="font-size:15px;font-weight:800;color:var(--ptv-text);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${title}
          </h3>

          <div style="display:flex;gap:12px;align-items:center;font-size:12px;color:var(--ptv-text-dim);margin-top:4px;flex-wrap:wrap;">
            <span><i class="fa-solid fa-user" style="color:var(--ptv-blue);margin-right:4px;"></i>${person}</span>
            <span>•</span>
            <span><i class="fa-solid fa-calendar" style="color:var(--ptv-cyan);margin-right:4px;"></i>${_fmtDate(d.tanggal_mulai)} ${d.tanggal_selesai ? ' s/d ' + _fmtDate(d.tanggal_selesai) : ''}</span>
          </div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <span class="badge" style="background:${isApproved ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'};color:${isApproved ? 'var(--ptv-green)' : 'var(--ptv-yellow)'};font-size:11px;">
          ${isApproved ? 'Resmi / Disetujui' : 'Menunggu'}
        </span>

        <button class="btn btn-ghost btn-sm btnCetakSurat" data-id="${d.id}" data-type="${d._docType}" style="font-size:12px;gap:5px;" title="Cetak Surat">
          <i class="fa-solid fa-print"></i> Cetak
        </button>
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
      <i class="fa-solid fa-folder-open" style="font-size:36px;margin-bottom:14px;display:block;color:var(--ptv-blue);opacity:0.7;"></i>
      <strong style="font-size:15px;color:var(--ptv-text);">Tidak Ada Dokumen Surat</strong>
      <p style="font-size:13px;margin-top:6px;max-width:380px;margin-left:auto;margin-right:auto;">
        Belum ada berkas surat resmi yang sesuai dengan filter ini.
      </p>
    </div>`;
}

// ── EVENTS ────────────────────────────────────────────────
function _attachEvents(container) {
  container.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeType = btn.dataset.type;
      _renderView(container);
    });
  });

  const sInput = container.querySelector('#searchDoc');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      const filtered = _applyFilter();
      const listEl = container.querySelector('#docListContainer');
      if (listEl) {
        listEl.innerHTML = filtered.length > 0 ? filtered.map(d => _docCardHTML(d)).join('') : _emptyHTML();
        _attachCardEvents(container);
      }
    });
  }

  container.querySelector('#btnBuatSurat')?.addEventListener('click', () => {
    _openBuatSuratModal(container);
  });

  _attachCardEvents(container);
}

function _attachCardEvents(container) {
  container.querySelectorAll('.btnCetakSurat').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const doc = _allDocs.find(d => d.id === id);
      if (doc) _printPreview(doc);
    });
  });
}

// ── CETAK PREVIEW ─────────────────────────────────────────
function _printPreview(doc) {
  const win = window.open('', '_blank');
  const title = doc.nama_kegiatan || doc.keperluan || doc.jenis_kegiatan || 'Surat Resmi PTV';
  const person = doc.penanggung_jawab || doc.pembawa || doc.nama_santri || 'Kru PTV';
  const nomor = doc.nomor_surat || 'NOMOR: ST/PTV/' + Date.now();

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px 60px; line-height: 1.6; color: #111; }
        .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 12px; margin-bottom: 24px; }
        .kop h2 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
        .kop p { margin: 2px 0; font-size: 13px; color: #444; }
        .title { text-align: center; margin-bottom: 24px; }
        .title h3 { margin: 0; text-decoration: underline; font-size: 16px; text-transform: uppercase; }
        .title p { margin: 4px 0; font-size: 13px; }
        .content { font-size: 14px; margin-bottom: 32px; text-align: justify; }
        .ttd { display: flex; justify-content: space-between; margin-top: 60px; }
        .ttd-box { text-align: center; width: 200px; }
      </style>
    </head>
    <body>
      <div class="kop">
        <h2>PROGRESIF TV (PTV) STUDIO</h2>
        <p>Pesantren Progresif Bumi Shalawat — Sidoarjo, Jawa Timur</p>
        <p>Email: tvprogresif@gmail.com | Website: ptvpro.com</p>
      </div>

      <div class="title">
        <h3>SURAT OPERASIONAL RESMI</h3>
        <p>${nomor}</p>
      </div>

      <div class="content">
        <p>Dengan ini menerangkan bahwa:</p>
        <table style="width:100%;margin-bottom:16px;">
          <tr><td style="width:180px;"><strong>Nama Petugas / Kru</strong></td><td>: ${person}</td></tr>
          <tr><td><strong>Keperluan / Kegiatan</strong></td><td>: ${title}</td></tr>
          <tr><td><strong>Waktu Pelaksanaan</strong></td><td>: ${_fmtDate(doc.tanggal_mulai)} s/d ${_fmtDate(doc.tanggal_selesai)}</td></tr>
          ${doc.lokasi ? `<tr><td><strong>Lokasi Tugas</strong></td><td>: ${doc.lokasi}</td></tr>` : ''}
        </table>
        <p>Diberikan tugas dan izin operasional resmi studio Progresif TV dalam rangka kegiatan peliputan/dokumentasi. Mohon pihak terkait dapat memberikan bantuan dan kerjasama yang diperlukan.</p>
      </div>

      <div class="ttd">
        <div class="ttd-box">
          <p>Petugas Pelaksana,</p>
          <div style="height:60px;"></div>
          <p><strong>${person}</strong></p>
        </div>
        <div class="ttd-box">
          <p>Pimpinan Studio PTV,</p>
          <div style="height:60px;"></div>
          <p><strong>Direktur Operasional</strong></p>
        </div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  win.document.close();
}

// ── MODAL FORM BUAT SURAT BARU ────────────────────────────
function _openBuatSuratModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'suratModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  const today = new Date().toISOString().split('T')[0];

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:540px;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <h3 style="font-size:17px;font-weight:800;margin:0;">Buat Surat Resmi Studio</h3>
        <button id="closeSuratModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="suratForm">
        <!-- Jenis Surat -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jenis Dokumen Surat</label>
          <select id="fJenisSurat" class="input-field">
            <option value="tugas">Surat Tugas Peliputan / Operasional</option>
            <option value="barang">Surat Jalan / Bawa Peralatan Keluar</option>
            <option value="izin">Surat Izin Santri / Kru</option>
          </select>
        </div>

        <!-- Perihal -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nama Kegiatan / Perihal <span style="color:var(--ptv-red);">*</span></label>
          <input id="fPerihalSurat" type="text" class="input-field" placeholder="Contoh: Peliputan Daurah Ilmiah Nasional" required>
        </div>

        <!-- Nama Person / Penanggung Jawab -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Penanggung Jawab / Nama Petugas <span style="color:var(--ptv-red);">*</span></label>
          <input id="fNamaPerson" type="text" class="input-field" value="${currentCrew?.name || 'Kru PTV'}" required>
        </div>

        <!-- Tanggal -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Tanggal Mulai</label>
            <input id="fTglMulai" type="date" class="input-field" value="${today}" required>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Tanggal Selesai</label>
            <input id="fTglSelesai" type="date" class="input-field" value="${today}" required>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelSurat" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSaveSurat" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Terbitkan Surat
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeSuratModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelSurat')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#suratForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jenis   = overlay.querySelector('#fJenisSurat').value;
    const perihal = overlay.querySelector('#fPerihalSurat').value.trim();
    const person  = overlay.querySelector('#fNamaPerson').value.trim();
    const tgl1    = overlay.querySelector('#fTglMulai').value;
    const tgl2    = overlay.querySelector('#fTglSelesai').value;
    const saveBtn = overlay.querySelector('#btnSaveSurat');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    const docCode = 'PTV/' + jenis.toUpperCase() + '/' + new Date().getFullYear() + '/' + Date.now().toString(36).toUpperCase().slice(-4);

    try {
      if (jenis === 'tugas') {
        await sb.from('ptv_surat_tugas').insert({
          nomor_surat:      docCode,
          nama_kegiatan:    perihal,
          penanggung_jawab: person,
          tanggal_mulai:    tgl1,
          tanggal_selesai:  tgl2,
          status:           'Disetujui',
        });
      } else if (jenis === 'barang') {
        await sb.from('ptv_surat_barang').insert({
          nomor_surat:     docCode,
          keperluan:       perihal,
          pembawa:         person,
          tanggal_mulai:   tgl1,
          tanggal_selesai: tgl2,
          status:          'Disetujui',
        });
      } else {
        await sb.from('ptv_surat_izin').insert({
          nomor_surat:     docCode,
          jenis_kegiatan:  perihal,
          nama_santri:     person,
          tanggal_mulai:   tgl1,
          tanggal_selesai: tgl2,
          status:          'Disetujui',
        });
      }

      overlay.remove();
      if (window.toast) window.toast('Surat resmi berhasil diterbitkan!', 'success');
      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[SURAT] Insert error:', err);
      alert('Gagal membuat surat: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Terbitkan Surat';
    }
  });
}
