// ============================================================
// js/modules/keuangan.js — Modul Keuangan Studio & Kas Kru
// Terhubung langsung ke Supabase: ptv_pemasukan, ptv_pengeluaran, ptv_kas_kru, ptv_kas_periode
// ATURAN: DILARANG mengirim nilai untuk kolom 'sisa' pada ptv_kas_kru (GENERATED ALWAYS).
// ============================================================
import { getSupabase } from '/js/supabase.js';
import { currentCrew, isExec } from '/js/auth.js';

// ── STATE ──────────────────────────────────────────────────
let _incomes        = [];
let _expenses       = [];
let _kasKru         = [];
let _kasPeriodes    = [];
let _activeTab      = 'bukukas'; // 'bukukas' | 'iuran'
let _txFilter       = 'semua';   // 'semua' | 'masuk' | 'keluar'
let _activePeriode  = '';

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
    const [incRes, expRes, kkRes, kpRes] = await Promise.all([
      sb.from('ptv_pemasukan')
        .select('*')
        .order('tanggal', { ascending: false }),
      sb.from('ptv_pengeluaran')
        .select('*')
        .order('tanggal', { ascending: false }),
      sb.from('ptv_kas_kru')
        .select('*')
        .order('kru_nama', { ascending: true }),
      sb.from('ptv_kas_periode')
        .select('*')
        .order('periode_bulan', { ascending: false }),
    ]);

    _incomes     = incRes.data || [];
    _expenses    = expRes.data || [];
    _kasKru      = kkRes.data  || [];
    _kasPeriodes = kpRes.data  || [];

    if (!_activePeriode && _kasPeriodes.length > 0) {
      _activePeriode = _kasPeriodes[0].periode_bulan;
    } else if (!_activePeriode) {
      const now = new Date();
      _activePeriode = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
  } catch (err) {
    console.error('[KEUANGAN] Fatal load error:', err);
  }
}

// ── SKELETON ──────────────────────────────────────────────
function _renderSkeleton(container) {
  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px;">
        ${[1,2,3,4].map(() => `<div class="skeleton glass-card" style="height:96px;"></div>`).join('')}
      </div>
      <div class="skeleton" style="height:44px;margin-bottom:20px;border-radius:10px;"></div>
      <div class="skeleton glass-card" style="height:320px;"></div>
    </div>`;
}

// ── RENDER VIEW ───────────────────────────────────────────
function _renderView(container) {
  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <!-- Summary Cards -->
      ${_summaryCardsHTML()}

      <!-- Tabs Navigation -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;border-bottom:1px solid var(--ptv-border-soft);padding-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm ${_activeTab === 'bukukas' ? 'btn-primary' : 'btn-ghost'} tabBtn" data-tab="bukukas" style="gap:6px;">
            <i class="fa-solid fa-book-journal-whills"></i> Buku Kas Studio
          </button>
          <button class="btn btn-sm ${_activeTab === 'iuran' ? 'btn-primary' : 'btn-ghost'} tabBtn" data-tab="iuran" style="gap:6px;">
            <i class="fa-solid fa-users-viewfinder"></i> Matriks Iuran Kru
          </button>
        </div>

        <div>
          ${_activeTab === 'bukukas' ? `
            <button id="btnTambahTx" class="btn btn-primary btn-sm" style="gap:6px;">
              <i class="fa-solid fa-plus"></i> Catat Transaksi
            </button>
          ` : `
            ${isExec() ? `
              <button id="btnBukaPeriode" class="btn btn-primary btn-sm" style="gap:6px;">
                <i class="fa-solid fa-calendar-plus"></i> Buka Periode Kas
              </button>
            ` : ''}
          `}
        </div>
      </div>

      <!-- Tab Content -->
      <div id="tabContent">
        ${_activeTab === 'bukukas' ? _bukuKasHTML() : _iuranKruHTML()}
      </div>
    </div>`;

  _attachEvents(container);
}

// ── SUMMARY CARDS ─────────────────────────────────────────
function _summaryCardsHTML() {
  const totalMasuk  = _incomes.reduce((acc, i) => acc + (parseFloat(i.jumlah) || 0), 0);
  const totalKeluar = _expenses.reduce((acc, e) => acc + (parseFloat(e.jumlah) || 0), 0);
  const saldoKas    = totalMasuk - totalKeluar;

  // Kas Kru periode aktif
  const kruInPeriode = _kasKru.filter(k => k.periode_bulan === _activePeriode);
  const tagihanPeriode = kruInPeriode.reduce((acc, k) => acc + (parseFloat(k.tagihan) || 0), 0);
  const dibayarPeriode = kruInPeriode.reduce((acc, k) => acc + (parseFloat(k.dibayar) || 0), 0);
  const lunasCount     = kruInPeriode.filter(k => (k.status === 'Lunas' || (k.dibayar >= k.tagihan && k.tagihan > 0))).length;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:24px;">
      <!-- Saldo Kas -->
      <div class="glass-card" style="padding:18px 20px;border-left:4px solid var(--ptv-cyan);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Saldo Bersih Kas</span>
          <i class="fa-solid fa-wallet" style="color:var(--ptv-cyan);font-size:16px;"></i>
        </div>
        <div style="font-size:22px;font-weight:800;color:${saldoKas >= 0 ? 'var(--ptv-cyan)' : 'var(--ptv-red)'};">
          ${_fmtRupiah(saldoKas)}
        </div>
      </div>

      <!-- Total Pemasukan -->
      <div class="glass-card" style="padding:18px 20px;border-left:4px solid var(--ptv-green);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Pemasukan</span>
          <i class="fa-solid fa-arrow-down-left" style="color:var(--ptv-green);font-size:16px;"></i>
        </div>
        <div style="font-size:22px;font-weight:800;color:var(--ptv-green);">
          ${_fmtRupiah(totalMasuk)}
        </div>
      </div>

      <!-- Total Pengeluaran -->
      <div class="glass-card" style="padding:18px 20px;border-left:4px solid var(--ptv-red);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Total Pengeluaran</span>
          <i class="fa-solid fa-arrow-up-right" style="color:var(--ptv-red);font-size:16px;"></i>
        </div>
        <div style="font-size:22px;font-weight:800;color:var(--ptv-red);">
          ${_fmtRupiah(totalKeluar)}
        </div>
      </div>

      <!-- Iuran Kas Bulan Ini -->
      <div class="glass-card" style="padding:18px 20px;border-left:4px solid var(--ptv-gold);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;">Iuran Kru (${_activePeriode})</span>
          <i class="fa-solid fa-coins" style="color:var(--ptv-gold);font-size:16px;"></i>
        </div>
        <div style="font-size:22px;font-weight:800;color:var(--ptv-gold);">
          ${_fmtRupiah(dibayarPeriode)} <span style="font-size:12.5px;font-weight:500;color:var(--ptv-text-dim);">/ ${lunasCount} lunas</span>
        </div>
      </div>
    </div>`;
}

// ── BUKU KAS TAB ──────────────────────────────────────────
function _bukuKasHTML() {
  // Gabungkan transaksi dan sort berdasarkan tanggal desc
  let txList = [];
  _incomes.forEach(i => txList.push({ ...i, _type: 'masuk' }));
  _expenses.forEach(e => txList.push({ ...e, _type: 'keluar' }));

  txList.sort((a, b) => new Date(b.tanggal || b.created_at) - new Date(a.tanggal || a.created_at));

  if (_txFilter === 'masuk') txList = txList.filter(t => t._type === 'masuk');
  else if (_txFilter === 'keluar') txList = txList.filter(t => t._type === 'keluar');

  return `
    <div>
      <!-- Filter Bar -->
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        ${[
          { key: 'semua',  label: 'Semua Arus Kas' },
          { key: 'masuk',  label: 'Pemasukan (+)' },
          { key: 'keluar', label: 'Pengeluaran (-)' },
        ].map(f => `
          <button class="btn btn-sm ${_txFilter === f.key ? 'btn-primary' : 'btn-ghost'} btnFilterTx" data-tx="${f.key}" style="font-size:12px;">
            ${f.label}
          </button>
        `).join('')}
      </div>

      <!-- Transaction List -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${txList.length > 0 ? txList.map(tx => {
          const isMasuk = tx._type === 'masuk';
          return `
            <div class="glass-card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-left:3px solid ${isMasuk ? 'var(--ptv-green)' : 'var(--ptv-red)'};">
              <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                <div style="width:36px;height:36px;border-radius:10px;background:${isMasuk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};display:flex;align-items:center;justify-content:center;color:${isMasuk ? 'var(--ptv-green)' : 'var(--ptv-red)'};font-size:14px;flex-shrink:0;">
                  <i class="fa-solid fa-${isMasuk ? 'arrow-down' : 'arrow-up'}"></i>
                </div>
                <div style="min-width:0;">
                  <div style="font-size:14.5px;font-weight:700;color:var(--ptv-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${tx.keterangan || (isMasuk ? 'Pemasukan Kas' : 'Pengeluaran Kas')}
                  </div>
                  <div style="font-size:11.5px;color:var(--ptv-text-dim);display:flex;gap:8px;align-items:center;margin-top:2px;">
                    <span class="badge" style="font-size:10px;background:rgba(255,255,255,0.05);color:var(--ptv-text-soft);">${tx.kategori || 'Umum'}</span>
                    <span>•</span>
                    <span>${_fmtDate(tx.tanggal)}</span>
                  </div>
                </div>
              </div>

              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:16px;font-weight:800;color:${isMasuk ? 'var(--ptv-green)' : 'var(--ptv-red)'};">
                  ${isMasuk ? '+' : '-'} ${_fmtRupiah(tx.jumlah)}
                </div>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="glass-card" style="text-align:center;padding:48px 20px;color:var(--ptv-text-dim);">
            Belum ada transaksi pada kategori ini.
          </div>
        `}
      </div>
    </div>`;
}

// ── IURAN KRU TAB ─────────────────────────────────────────
function _iuranKruHTML() {
  const kruInPeriode = _kasKru.filter(k => k.periode_bulan === _activePeriode);

  return `
    <div>
      <!-- Periode Picker -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:13px;font-weight:700;color:var(--ptv-text-soft);">Pilih Periode:</span>
          <select id="selPeriode" class="input-field" style="width:160px;height:36px;font-size:13px;">
            ${_kasPeriodes.map(p => `
              <option value="${p.periode_bulan}" ${p.periode_bulan === _activePeriode ? 'selected' : ''}>
                ${p.periode_bulan}
              </option>
            `).join('')}
          </select>
        </div>

        <span style="font-size:12.5px;color:var(--ptv-text-dim);">
          Total <strong>${kruInPeriode.length}</strong> kru terdaftar pada periode ini
        </span>
      </div>

      <!-- Table Kas Kru -->
      <div class="glass-card" style="overflow-x:auto;padding:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid var(--ptv-border-soft);color:var(--ptv-text-dim);font-size:11.5px;text-transform:uppercase;">
              <th style="padding:10px 14px;">Nama Kru</th>
              <th style="padding:10px 14px;">ID PTV</th>
              <th style="padding:10px 14px;">Tagihan</th>
              <th style="padding:10px 14px;">Dibayar</th>
              <th style="padding:10px 14px;">Status</th>
              <th style="padding:10px 14px;text-align:right;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${kruInPeriode.length > 0 ? kruInPeriode.map(k => {
              const isLunas = (k.status === 'Lunas' || (k.dibayar >= k.tagihan && k.tagihan > 0));
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                  <td style="padding:12px 14px;font-weight:700;color:var(--ptv-text);">${k.kru_nama}</td>
                  <td style="padding:12px 14px;color:var(--ptv-cyan);font-weight:600;">${k.kru_ptv_id || '-'}</td>
                  <td style="padding:12px 14px;color:var(--ptv-text-soft);">${_fmtRupiah(k.tagihan)}</td>
                  <td style="padding:12px 14px;color:${isLunas ? 'var(--ptv-green)' : 'var(--ptv-yellow)'};font-weight:700;">${_fmtRupiah(k.dibayar)}</td>
                  <td style="padding:12px 14px;">
                    <span class="badge" style="background:${isLunas ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${isLunas ? 'var(--ptv-green)' : 'var(--ptv-red)'};font-size:11px;">
                      ${isLunas ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </td>
                  <td style="padding:12px 14px;text-align:right;">
                    ${!isLunas && isExec() ? `
                      <button class="btn btn-primary btn-sm btnOneClickLunas" data-id="${k.id}" data-tagihan="${k.tagihan}" style="font-size:11px;padding:4px 10px;">
                        <i class="fa-solid fa-check"></i> Lunas
                      </button>
                    ` : (isLunas ? `<i class="fa-solid fa-circle-check" style="color:var(--ptv-green);font-size:14px;"></i>` : '-')}
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="6" style="padding:32px;text-align:center;color:var(--ptv-text-dim);">
                  Belum ada data iuran pada periode ${_activePeriode}.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _fmtRupiah(val) {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

function _fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

// ── EVENTS ────────────────────────────────────────────────
function _attachEvents(container) {
  // Tabs Switch
  container.querySelectorAll('.tabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      _renderView(container);
    });
  });

  // Filter Tx
  container.querySelectorAll('.btnFilterTx').forEach(btn => {
    btn.addEventListener('click', () => {
      _txFilter = btn.dataset.tx;
      _renderView(container);
    });
  });

  // Periode Change
  const selP = container.querySelector('#selPeriode');
  selP?.addEventListener('change', () => {
    _activePeriode = selP.value;
    _renderView(container);
  });

  // Tambah Transaksi
  container.querySelector('#btnTambahTx')?.addEventListener('click', () => {
    _openTxModal(container);
  });

  // Buka Periode
  container.querySelector('#btnBukaPeriode')?.addEventListener('click', () => {
    _openPeriodeModal(container);
  });

  // One-Click Lunas
  container.querySelectorAll('.btnOneClickLunas').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const tagihan = parseFloat(btn.dataset.tagihan) || 0;
      if (!confirm('Tandai iuran kas kru ini sebagai LUNAS?')) return;

      const sb = getSupabase();
      try {
        // PERINGATAN: DILARANG mengirim kolom 'sisa' karena GENERATED ALWAYS AS STORED
        const { error } = await sb
          .from('ptv_kas_kru')
          .update({
            dibayar: tagihan,
            status: 'Lunas',
            tanggal_bayar: new Date().toISOString().split('T')[0],
            metode: 'Tunai',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
        if (window.toast) window.toast('Status kas berhasil ditandai Lunas!', 'success');
        await _loadData();
        _renderView(container);
      } catch (err) {
        console.error('[KEUANGAN] Lunas error:', err);
        alert('Gagal menandai lunas: ' + (err.message || err));
      }
    });
  });
}

// ── MODAL TAMBAH TRANSAKSI ────────────────────────────────
function _openTxModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'txModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  const today = new Date().toISOString().split('T')[0];

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:520px;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <h3 style="font-size:17px;font-weight:800;margin:0;">Catat Transaksi Buku Kas</h3>
        <button id="closeTxModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="txForm">
        <!-- Jenis Transaksi -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Jenis Transaksi</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);border-radius:8px;cursor:pointer;">
              <input type="radio" name="jenisTx" value="masuk" checked style="accent-color:var(--ptv-green);">
              <span style="font-size:13px;font-weight:700;color:var(--ptv-green);"><i class="fa-solid fa-arrow-down" style="margin-right:6px;"></i>Pemasukan</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--ptv-border-soft);border-radius:8px;cursor:pointer;">
              <input type="radio" name="jenisTx" value="keluar" style="accent-color:var(--ptv-red);">
              <span style="font-size:13px;font-weight:700;color:var(--ptv-red);"><i class="fa-solid fa-arrow-up" style="margin-right:6px;"></i>Pengeluaran</span>
            </label>
          </div>
        </div>

        <!-- Jumlah Nominal -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Nominal (Rp) <span style="color:var(--ptv-red);">*</span></label>
          <input id="fJumlahTx" type="number" class="input-field" placeholder="100000" min="1000" required>
        </div>

        <!-- Keterangan -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Keterangan <span style="color:var(--ptv-red);">*</span></label>
          <input id="fKetTx" type="text" class="input-field" placeholder="Contoh: Pembelian Baterai Eneloop / Honor Liputan" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Kategori</label>
            <select id="fKatTx" class="input-field">
              <option value="Operasional">Operasional</option>
              <option value="Produksi">Produksi</option>
              <option value="Perlengkapan">Perlengkapan</option>
              <option value="Konsumsi">Konsumsi</option>
              <option value="Donasi / Sponsor">Donasi / Sponsor</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Tanggal</label>
            <input id="fTglTx" type="date" class="input-field" value="${today}" required>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelTx" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSaveTx" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Simpan Transaksi
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeTxModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelTx')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#txForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jenis   = overlay.querySelector('input[name="jenisTx"]:checked').value;
    const jumlah  = parseFloat(overlay.querySelector('#fJumlahTx').value);
    const ket     = overlay.querySelector('#fKetTx').value.trim();
    const kat     = overlay.querySelector('#fKatTx').value;
    const tgl     = overlay.querySelector('#fTglTx').value;
    const saveBtn = overlay.querySelector('#btnSaveTx');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    const sb = getSupabase();
    const targetTable = jenis === 'masuk' ? 'ptv_pemasukan' : 'ptv_pengeluaran';

    try {
      const { error } = await sb
        .from(targetTable)
        .insert({
          jumlah:     jumlah,
          keterangan: ket,
          kategori:   kat,
          tanggal:    tgl,
        });

      if (error) throw error;
      overlay.remove();
      if (window.toast) window.toast('Transaksi berhasil dicatat ke buku kas!', 'success');
      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[KEUANGAN] Tx error:', err);
      alert('Gagal mencatat transaksi: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Transaksi';
    }
  });
}

// ── MODAL BUKA PERIODE KAS KRU ───────────────────────────
function _openPeriodeModal(container) {
  const overlay = document.createElement('div');
  overlay.id = 'periodeModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);';

  const now = new Date();
  const defaultPeriode = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:480px;padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--ptv-border-soft);">
        <h3 style="font-size:16px;font-weight:800;margin:0;">Buka Periode Iuran Kas Kru</h3>
        <button id="closePeriodeModal" class="btn btn-ghost btn-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="periodeForm">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Periode Bulan (YYYY-MM)</label>
          <input id="fPeriodeBulan" type="text" class="input-field" value="${defaultPeriode}" placeholder="2026-10" required>
        </div>

        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--ptv-text-soft);margin-bottom:6px;">Target Nominal per Kru (Rp)</label>
          <input id="fNominalTagihan" type="number" class="input-field" value="20000" min="5000" step="5000" required>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ptv-border-soft);padding-top:16px;">
          <button type="button" id="btnCancelPeriode" class="btn btn-ghost btn-sm">Batal</button>
          <button type="submit" id="btnSavePeriode" class="btn btn-primary btn-sm" style="padding:8px 20px;">
            <i class="fa-solid fa-check"></i> Buka Periode
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#closePeriodeModal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnCancelPeriode')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#periodeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pBulan = overlay.querySelector('#fPeriodeBulan').value.trim();
    const nom    = parseFloat(overlay.querySelector('#fNominalTagihan').value) || 20000;
    const saveBtn= overlay.querySelector('#btnSavePeriode');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    const sb = getSupabase();
    try {
      // 1. Insert ke ptv_kas_periode
      await sb.from('ptv_kas_periode').insert({
        periode_bulan:   pBulan,
        nominal_tagihan: nom,
        status:          'Aktif',
      });

      // 2. Ambil list kru aktif dari ptv_kru
      const { data: crews } = await sb.from('ptv_kru').select('id, nama, ptv_id, status').eq('status', 'Aktif');

      if (crews && crews.length > 0) {
        // PERINGATAN: DILARANG mengirim nilai untuk kolom 'sisa' (GENERATED ALWAYS)
        const kasRows = crews.map(c => ({
          kru_id:        c.id,
          kru_nama:      c.nama,
          kru_ptv_id:    c.ptv_id,
          periode_bulan: pBulan,
          tagihan:       nom,
          dibayar:       0,
          status:        'Belum Bayar',
        }));

        await sb.from('ptv_kas_kru').insert(kasRows);
      }

      overlay.remove();
      _activePeriode = pBulan;
      if (window.toast) window.toast(`Periode kas ${pBulan} berhasil dibuka!`, 'success');
      await _loadData();
      _renderView(container);
    } catch (err) {
      console.error('[KEUANGAN] Periode error:', err);
      alert('Gagal membuka periode: ' + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Buka Periode';
    }
  });
}
