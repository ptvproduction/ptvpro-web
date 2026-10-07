// ============================================================
// js/auth.js - Manajemen Sesi, Login, Logout & Role RBAC
// Menggunakan tabel public.ptv_kru Supabase Cloud secara langsung.
// Mendukung bcrypt PHP ($2y$) dan Google OAuth Whitelist.
// ============================================================
import { getSupabase } from './supabase.js';

// State session aktif
export let currentUser = null;
export let currentCrew = null;

function _normalizeCrew(c) {
  if (!c) return null;
  const primaryEmail = (c.oauth_email ? c.oauth_email.split(',')[0].trim() : '') ||
                       (c.username ? `${c.username}@progresiftv.id` : 'kru@progresiftv.id');
  return {
    ...c,
    name: c.nama || 'Kru PTV',
    email: primaryEmail,
    div: c.divisi || 'Operasional',
    pos: c.jabatan || 'Kru',
    avatar_url: c.foto_url || '',
  };
}

function _saveSession(user, crew) {
  try {
    localStorage.setItem('ptv_crew_session', JSON.stringify({
      user,
      crew,
      // Masa berlaku 3 hari (259.200 detik) persis seperti PHP session
      expires_at: Date.now() + 3 * 24 * 60 * 60 * 1000,
    }));
  } catch (err) {
    console.warn('[AUTH] Gagal menyimpan sesi ke localStorage:', err);
  }
}

// ── INISIALISASI AUTH ──
export async function initAuth({ onAuthenticated, onUnauthenticated }) {
  const supabase = getSupabase();

  // 1. Periksa Google OAuth Redirect dari Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user && session.user.email) {
      const googleEmail = session.user.email.toLowerCase().trim();
      console.info('[AUTH] Mendeteksi sesi Google SSO:', googleEmail);

      const { data: crewRows, error } = await supabase
        .from('ptv_kru')
        .select('id, nama, username, crew_id, role, divisi, jabatan, angkatan, foto_url, status, password_hash, oauth_email')
        .ilike('oauth_email', `%${googleEmail}%`);

      let matched = null;
      if (!error && crewRows && crewRows.length > 0) {
        for (const c of crewRows) {
          const emailList = (c.oauth_email || '').toLowerCase().split(',').map(s => s.trim());
          if (emailList.includes(googleEmail)) {
            matched = c;
            break;
          }
        }
      }

      if (matched && matched.status === 'aktif' && matched.role && matched.role !== '-') {
        currentCrew = _normalizeCrew(matched);
        currentUser = { id: matched.id, email: googleEmail };
        _saveSession(currentUser, currentCrew);
        onAuthenticated(currentUser, currentCrew);
        return;
      } else {
        await supabase.auth.signOut();
        alert('Email Google (' + googleEmail + ') belum terdaftar di whitelist kru aktif PTV.');
      }
    }
  } catch (err) {
    console.warn('[AUTH] Error memeriksa session Google:', err);
  }

  // 2. Periksa Persistent Local Storage Session (3 Hari)
  try {
    const cached = localStorage.getItem('ptv_crew_session');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.expires_at && parsed.expires_at > Date.now() && parsed.crew) {
        currentCrew = parsed.crew;
        currentUser = parsed.user || { id: parsed.crew.id, email: parsed.crew.email };
        onAuthenticated(currentUser, currentCrew);
        return;
      } else {
        localStorage.removeItem('ptv_crew_session');
      }
    }
  } catch (err) {
    localStorage.removeItem('ptv_crew_session');
  }

  // Tidak ada sesi aktif
  currentUser = null;
  currentCrew = null;
  onUnauthenticated();
}

// ── LOGIN KREDENSIAL (EMAIL / USERNAME / CREW-ID & PASSWORD) ──
export async function signInWithCredentials(identifier, password) {
  const supabase = getSupabase();
  const cleanId = (identifier || '').trim().toLowerCase();

  if (!cleanId || !password) {
    throw new Error('Email / Username dan Password wajib diisi!');
  }

  const fields = 'id, nama, username, crew_id, role, divisi, jabatan, angkatan, foto_url, status, password_hash, oauth_email';
  let row = null;
  const isEmail = cleanId.includes('@');

  if (isEmail) {
    // Jalur Email: cari via kolom oauth_email di ptv_kru
    const { data, error } = await supabase
      .from('ptv_kru')
      .select(fields)
      .ilike('oauth_email', `%${cleanId}%`)
      .limit(10);

    if (!error && data && data.length > 0) {
      for (const c of data) {
        const emailList = (c.oauth_email || '').toLowerCase().split(',').map(s => s.trim());
        if (emailList.includes(cleanId)) {
          row = c;
          break;
        }
      }
    }
  } else {
    // Jalur Username / Crew ID / Nama
    // 1. Username
    const { data: uData } = await supabase
      .from('ptv_kru')
      .select(fields)
      .ilike('username', cleanId)
      .limit(1);

    if (uData && uData.length > 0) {
      row = uData[0];
    } else {
      // 2. Crew ID (e.g. PTV-001)
      const { data: cData } = await supabase
        .from('ptv_kru')
        .select(fields)
        .ilike('crew_id', cleanId)
        .limit(1);

      if (cData && cData.length > 0) {
        row = cData[0];
      } else if (cleanId.length >= 3) {
        // 3. Nama Kru
        const { data: nData } = await supabase
          .from('ptv_kru')
          .select(fields)
          .ilike('nama', `%${cleanId}%`)
          .limit(1);

        if (nData && nData.length > 0) {
          row = nData[0];
        }
      }
    }
  }

  // Validasi akun
  if (!row || row.status !== 'aktif' || !row.role || row.role === '-') {
    throw new Error('Akun tidak ditemukan!');
  }

  // Verifikasi hash Bcrypt ($2y$ atau $2a$)
  const passHash = (row.password_hash || '').trim();
  if (!passHash || (!passHash.startsWith('$2y$') && !passHash.startsWith('$2a$'))) {
    throw new Error('Akun tidak ditemukan!');
  }

  // Gunakan bcryptjs (dcodeIO.bcrypt atau bcrypt global)
  const bcryptLib = (typeof window !== 'undefined' && (window.dcodeIO?.bcrypt || window.bcrypt)) || null;
  if (!bcryptLib) {
    throw new Error('Modul keamanan belum siap, silakan refresh halaman.');
  }

  // Kompatibilitas $2y$ (PHP) ke $2a$ (JavaScript)
  const convertedHash = passHash.replace(/^\$2y\$/, '$2a$');
  const isMatch = bcryptLib.compareSync(password, convertedHash);

  if (!isMatch) {
    throw new Error('Akun tidak ditemukan!');
  }

  // Otentikasi sukses
  const normalized = _normalizeCrew(row);
  currentCrew = normalized;
  currentUser = { id: row.id, email: normalized.email };
  _saveSession(currentUser, currentCrew);

  console.info('[AUTH] Login berhasil:', currentCrew.name, '|', currentCrew.role);
  return { user: currentUser, crew: currentCrew };
}

// ── ALIAS UNTUK KOMPATIBILITAS ──
export const signInWithEmail = signInWithCredentials;

// ── LOGIN GOOGLE SSO ──
export async function signInWithGoogle() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

// ── LOGOUT ──
export async function signOut() {
  const supabase = getSupabase();
  try {
    await supabase.auth.signOut();
  } catch (e) {}
  localStorage.removeItem('ptv_crew_session');
  currentUser = null;
  currentCrew = null;
  window.location.reload();
}

// ── RBAC HELPERS ──
export function hasRole(...roles) {
  if (!currentCrew) return false;
  return roles.includes(currentCrew.role);
}

export function isExec() {
  return hasRole('eksekutif', 'admin');
}

export function isBendahara() {
  return currentCrew?.crew_id === 'PTV-023' || hasRole('bendahara');
}
