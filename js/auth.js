// ============================================================
// js/auth.js — Manajemen Sesi, Login, Logout & Role RBAC
// Menggantikan WordPress session + PHP bridge sepenuhnya.
// ============================================================
import { getSupabase } from './supabase.js';

// State session aktif
export let currentUser = null;
export let currentCrew = null;

// ─── INISIALISASI ────────────────────────────────────────────
export async function initAuth({ onAuthenticated, onUnauthenticated }) {
  const supabase = getSupabase();

  // Cek sesi yang sudah ada (dari localStorage Supabase SDK)
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await _handleSession(session, onAuthenticated);
  } else {
    onUnauthenticated();
  }

  // Dengarkan perubahan auth state (login, logout, token refresh)
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await _handleSession(session, onAuthenticated);
    } else {
      currentUser = null;
      currentCrew = null;
      onUnauthenticated();
    }
  });
}

// ─── PROSES SESSION ──────────────────────────────────────────
async function _handleSession(session, onAuthenticated) {
  currentUser = session.user;
  // Ambil profil kru dari tabel ptv_kru berdasarkan email user login
  const supabase = getSupabase();
  const email = currentUser.email || '';
  const { data: crew, error } = await supabase
    .from('ptv_kru')
    .select('id, name, email, div, pos, role, avatar_url, is_active')
    .or(`email.eq.${email},sb_id.eq.${currentUser.id}`)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !crew) {
    console.error('[AUTH] Kru tidak ditemukan atau tidak aktif:', error);
    await signOut();
    return;
  }

  currentCrew = crew;
  console.info('[AUTH] Login berhasil:', crew.name, '|', crew.role);
  onAuthenticated(currentUser, currentCrew);
}

// ─── LOGIN EMAIL & PASSWORD ───────────────────────────────────
export async function signInWithEmail(email, password) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

// ─── LOGIN GOOGLE SSO ─────────────────────────────────────────
export async function signInWithGoogle() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

// ─── LOGOUT ───────────────────────────────────────────────────
export async function signOut() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  currentUser = null;
  currentCrew = null;
}

// ─── CEK ROLE HELPER ─────────────────────────────────────────
export function hasRole(...roles) {
  if (!currentCrew) return false;
  return roles.includes(currentCrew.role);
}

export function isExec() {
  return hasRole('eksekutif', 'admin');
}

export function isBendahara() {
  return currentCrew?.id === 'PTV-023' || hasRole('bendahara');
}
