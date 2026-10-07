// ============================================================
// js/modules/beranda.js — Halaman Beranda Dasbor PTV
// ============================================================
import { currentCrew } from '/js/auth.js';
import { getSupabase } from '/js/supabase.js';

export async function render(container, hash) {
  const crew = currentCrew;
  const now = new Date();
  const greet = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam';
  const tanggal = now.toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <!-- Greeting -->
      <div style="margin-bottom:28px;">
        <h1 style="font-size:22px;font-weight:800;margin-bottom:4px;">
          ${greet}, ${(crew?.name || 'Kru').split(' ')[0]}! <span style="font-size:20px;">👋</span>
        </h1>
        <p style="color:var(--ptv-text-soft);font-size:13.5px;">${tanggal}</p>
      </div>

      <!-- Ringkasan Stats (Loading Skeleton) -->
      <div id="berandaStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px;">
        ${[1,2,3,4].map(() => `<div class="skeleton glass-card" style="height:88px;border-radius:var(--radius);"></div>`).join('')}
      </div>

      <!-- Acara Terdekat & Info -->
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start;">
        <div id="berandaAcara" class="glass-card" style="padding:20px;min-height:180px;">
          <div class="skeleton" style="width:40%;height:16px;margin-bottom:16px;border-radius:6px;"></div>
          <div class="skeleton" style="width:100%;height:60px;border-radius:10px;"></div>
        </div>
        <div id="berandaNotif" class="glass-card" style="padding:20px;min-height:180px;">
          <div class="skeleton" style="width:60%;height:16px;margin-bottom:16px;border-radius:6px;"></div>
          <div class="skeleton" style="width:100%;height:40px;border-radius:10px;margin-bottom:10px;"></div>
          <div class="skeleton" style="width:100%;height:40px;border-radius:10px;"></div>
        </div>
      </div>

      @media (max-width: 768px) {
        #berandaWrap { grid-template-columns: 1fr !important; }
      }
    </div>
  `;

  // Load data sesungguhnya
  await _loadBerandaData(crew);
}

async function _loadBerandaData(crew) {
  const supabase = getSupabase();

  // Ambil statistik ringkasan (paralel)
  const [
    { count: cntAcara },
    { count: cntPinjam },
    { count: cntInv },
    { count: cntKru },
  ] = await Promise.all([
    supabase.from('ptv_acara').select('*', { count:'exact', head:true }),
    supabase.from('ptv_peminjaman').select('*', { count:'exact', head:true }).eq('status', 'dipinjam'),
    supabase.from('ptv_inventaris').select('*', { count:'exact', head:true }),
    supabase.from('ptv_kru').select('*', { count:'exact', head:true }).eq('status', 'aktif'),
  ]);

  const stats = [
    { label:'Total Acara',       value: cntAcara  ?? '—', icon:'calendar-days', color:'var(--ptv-blue)' },
    { label:'Alat Dipinjam',     value: cntPinjam ?? '—', icon:'handshake',     color:'var(--ptv-yellow)' },
    { label:'Jenis Alat',        value: cntInv    ?? '—', icon:'box-archive',   color:'var(--ptv-cyan)' },
    { label:'Kru Aktif',         value: cntKru    ?? '—', icon:'users',         color:'var(--ptv-green)' },
  ];

  document.getElementById('berandaStats').innerHTML = stats.map(s => `
    <div class="glass-card" style="padding:18px 20px;display:flex;align-items:center;gap:14px;">
      <div style="width:40px;height:40px;border-radius:10px;background:${s.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-${s.icon}" style="color:${s.color};font-size:16px;"></i>
      </div>
      <div>
        <div style="font-size:24px;font-weight:800;line-height:1;">${s.value}</div>
        <div class="text-muted text-sm">${s.label}</div>
      </div>
    </div>
  `).join('');

  // Acara terdekat
  const { data: acaraList } = await supabase
    .from('ptv_acara')
    .select('id, nama_acara, tanggal, lokasi, status')
    .gte('tanggal', new Date().toISOString().split('T')[0])
    .order('tanggal', { ascending: true })
    .limit(3);

  const acaraEl = document.getElementById('berandaAcara');
  if (acaraList && acaraList.length > 0) {
    acaraEl.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px;">
        <i class="fa-solid fa-calendar-days" style="color:var(--ptv-blue);margin-right:6px;"></i>Acara Mendatang
      </div>
      ${acaraList.map(a => {
        const tgl = a.tanggal ? new Date(a.tanggal).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : '—';
        return `
          <div style="padding:12px 14px;background:rgba(59,130,246,0.06);border:1px solid var(--ptv-border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:background .15s;" onclick="location.hash='#acara'">
            <div style="font-weight:600;font-size:14px;margin-bottom:3px;">${a.nama_acara || 'Tanpa Nama'}</div>
            <div class="text-muted text-sm"><i class="fa-solid fa-calendar fa-fw"></i> ${tgl} &nbsp; <i class="fa-solid fa-location-dot fa-fw"></i> ${a.lokasi || '—'}</div>
          </div>`;
      }).join('')}
    `;
  } else {
    acaraEl.innerHTML = `<div style="color:var(--ptv-text-dim);font-size:13px;text-align:center;padding:24px 0;"><i class="fa-solid fa-calendar-xmark" style="font-size:28px;margin-bottom:8px;display:block;"></i>Tidak ada acara mendatang.</div>`;
  }

  // Notifikasi ringkas
  const notifEl = document.getElementById('berandaNotif');
  const { data: notifs } = await supabase
    .from('ptv_notifications')
    .select('id, title, message, created_at, is_read')
    .order('created_at', { ascending: false })
    .limit(4);

  if (notifs && notifs.length > 0) {
    notifEl.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--ptv-text-soft);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px;">
        <i class="fa-solid fa-bell" style="color:var(--ptv-blue);margin-right:6px;"></i>Notifikasi Terbaru
      </div>
      ${notifs.map(n => `
        <div style="padding:10px 12px;border-bottom:1px solid var(--ptv-border-soft);${!n.is_read ? 'background:rgba(59,130,246,0.04);border-radius:8px;' : ''}">
          <div style="font-size:13px;font-weight:600;">${n.title || ''}</div>
          <div class="text-muted text-xs" style="margin-top:2px;">${n.message || ''}</div>
        </div>
      `).join('')}
    `;
  } else {
    notifEl.innerHTML = `<div style="color:var(--ptv-text-dim);font-size:13px;text-align:center;padding:24px 0;"><i class="fa-solid fa-bell-slash" style="font-size:28px;margin-bottom:8px;display:block;"></i>Tidak ada notifikasi.</div>`;
  }
}
