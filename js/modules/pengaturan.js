// ============================================================
// js/modules/pengaturan.js — Modul Pengaturan Akun & Sistem PTV Pro
// ============================================================
import { currentCrew, signOut } from '/js/auth.js';
import { SUPABASE_URL } from '/js/config.js';

export async function render(container, fullHash) {
  const crew = currentCrew || { name: 'Kru PTV', email: 'kru@ptvpro.com', role: 'Kru', divisi: 'Operasional' };

  container.innerHTML = `
    <div style="max-width:840px;margin:0 auto;">
      <!-- Profil Card -->
      <div class="glass-card" style="padding:28px;margin-bottom:20px;border-left:4px solid var(--ptv-blue);">
        <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px;">
          <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--ptv-blue),var(--ptv-cyan));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff;box-shadow:0 0 16px rgba(59,130,246,0.35);">
            ${(crew.name || 'KR').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div>
            <h2 style="font-size:18px;font-weight:800;margin:0;color:var(--ptv-text);">${crew.name}</h2>
            <div style="font-size:13px;color:var(--ptv-cyan);font-weight:600;margin-top:2px;">${crew.crew_id || crew.ptv_id || 'Kru Studio'} • ${crew.role || 'Kru'}</div>
            <div style="font-size:12px;color:var(--ptv-text-dim);margin-top:2px;">${crew.email || '-'}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;background:rgba(255,255,255,0.02);padding:14px;border-radius:10px;border:1px solid var(--ptv-border-soft);font-size:13px;">
          <div>
            <span style="color:var(--ptv-text-dim);display:block;font-size:11.5px;">Divisi Studio</span>
            <strong style="color:var(--ptv-text-soft);">${crew.divisi || 'Umum'}</strong>
          </div>
          <div>
            <span style="color:var(--ptv-text-dim);display:block;font-size:11.5px;">Jabatan Utama</span>
            <strong style="color:var(--ptv-text-soft);">${crew.jabatan || 'Anggota'}</strong>
          </div>
          <div>
            <span style="color:var(--ptv-text-dim);display:block;font-size:11.5px;">Hak Akses Sistem</span>
            <strong style="color:var(--ptv-green);">${crew.role === 'Eksekutif' ? 'Hak Penuh (Eksekutif)' : 'Operasional Kru'}</strong>
          </div>
        </div>
      </div>

      <!-- Pengaturan Notifikasi & Audio -->
      <div class="glass-card" style="padding:24px;margin-bottom:20px;">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-bell" style="color:var(--ptv-cyan);"></i>Notifikasi & Audio Chime
        </h3>
        <p style="font-size:13px;color:var(--ptv-text-soft);line-height:1.6;margin-bottom:16px;">
          Uji coba suara chime realtime yang diputar saat ada peminjaman baru, kendala alat, atau pengumuman darurat.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnTestChime" class="btn btn-ghost btn-sm" style="gap:6px;">
            <i class="fa-solid fa-volume-high"></i> Uji Audio Chime
          </button>
          <button id="btnTogglePush" class="btn btn-ghost btn-sm" style="gap:6px;">
            <i class="fa-solid fa-paper-plane"></i> Minta Izin Web Push
          </button>
        </div>
      </div>

      <!-- Info Cloud & Vercel -->
      <div class="glass-card" style="padding:24px;margin-bottom:20px;">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-cloud" style="color:var(--ptv-blue);"></i>Koneksi Cloud & Arsitektur
        </h3>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid var(--ptv-border-soft);">
            <span style="color:var(--ptv-text-dim);">Database Supabase</span>
            <strong style="color:var(--ptv-text-soft);font-family:monospace;">${SUPABASE_URL}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid var(--ptv-border-soft);">
            <span style="color:var(--ptv-text-dim);">Hosting & CDN</span>
            <strong style="color:var(--ptv-green);">Vercel Global Edge Network (ptvpro.com)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid var(--ptv-border-soft);">
            <span style="color:var(--ptv-text-dim);">Teknologi Frontend</span>
            <strong style="color:var(--ptv-text-soft);">Vanilla HTML5 / Modern Modular ES6 / Azure CSS</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--ptv-text-dim);">Versi Dasbor</span>
            <strong style="color:var(--ptv-gold);">PTV Pro v1.0 Standalone (Zero-WordPress)</strong>
          </div>
        </div>
      </div>

      <!-- Logout Card -->
      <div class="glass-card" style="padding:20px;border-left:4px solid var(--ptv-red);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div>
          <div style="font-size:14.5px;font-weight:700;color:var(--ptv-text);">Keluar dari Sesi Dasbor</div>
          <div style="font-size:12.5px;color:var(--ptv-text-dim);margin-top:2px;">Sesi autentikasi Anda akan dihapus dari peramban ini.</div>
        </div>
        <button id="btnLogoutSetting" class="btn btn-ghost btn-sm" style="color:var(--ptv-red);gap:6px;">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Keluar Sekarang
        </button>
      </div>
    </div>`;

  // Events
  container.querySelector('#btnTestChime')?.addEventListener('click', () => {
    try {
      const audio = new Audio('/assets/sound/chime.mp3');
      audio.play().catch(() => {
        if (window.toast) window.toast('File audio chime diputar.', 'info');
      });
      if (window.toast) window.toast('Memutar sampel audio notifikasi...', 'info');
    } catch {
      if (window.toast) window.toast('Gagal memutar audio.', 'warning');
    }
  });

  container.querySelector('#btnTogglePush')?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert('Peramban ini tidak mendukung notifikasi push web.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (window.toast) {
      window.toast(perm === 'granted' ? 'Izin notifikasi diberikan!' : 'Izin notifikasi ditolak.', perm === 'granted' ? 'success' : 'warning');
    }
  });

  container.querySelector('#btnLogoutSetting')?.addEventListener('click', async () => {
    if (!confirm('Yakin ingin keluar dari dasbor PTV Pro?')) return;
    await signOut();
  });
}
