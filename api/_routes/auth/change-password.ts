import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { parseCookies } from './_utils/cookies';
import { verifySessionToken } from './_utils/crypto';
import { parseJsonBody } from './_utils/bodyParser';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Metode HTTP tidak diizinkan.' }));
    return;
  }

  // 1. Session verification via HttpOnly cookie
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Sesi kru aktif diperlukan untuk mengubah kata sandi.', code: 'unauthorized' }));
    return;
  }

  let session: any;
  try {
    session = verifySessionToken(sessionToken, authSecret);
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Sesi telah kedaluwarsa. Silakan login kembali.', code: 'session_expired' }));
    return;
  }

  // 2. Parse request body
  let body: any;
  try {
    body = await parseJsonBody(req, { maxBytes: 8192 });
  } catch (err: any) {
    res.statusCode = err.statusCode || 400;
    res.end(JSON.stringify({ error: err.message || 'Format JSON permintaan tidak valid.' }));
    return;
  }

  const oldPassword = typeof body.old_password === 'string' ? body.old_password : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

  // 3. Kebijakan minimal 4 karakter
  if (!newPassword || newPassword.length < 4) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Kata sandi baru minimal terdiri dari 4 karakter.' }));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Layanan autentikasi server belum siap.' }));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 4. Verifikasi kata sandi lama jika kredensial sudah ada di auth_credentials
    const { data: cred, error: credErr } = await supabase
      .from('auth_credentials')
      .select('password_hash')
      .eq('account_id', session.account_id)
      .maybeSingle();

    if (credErr) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Gagal memverifikasi kredensial akun.' }));
      return;
    }

    if (cred && cred.password_hash) {
      if (!oldPassword) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Kata sandi lama wajib diisi.' }));
        return;
      }
      const match = await bcrypt.compare(oldPassword, cred.password_hash);
      if (!match) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Kata sandi lama yang Anda masukkan tidak sesuai.' }));
        return;
      }
    }

    // 5. Generate bcrypt hash dengan cost 10
    const newHash = await bcrypt.hash(newPassword, 10);
    const nowIso = new Date().toISOString();

    // 6. Coba update via RPC admin_set_password jika tersedia
    let updated = false;
    try {
      const actorIdentityId = session.identity_id || session.account_id;
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_admin_set_password', {
        p_account_id: session.account_id,
        p_password_hash: newHash,
        p_actor_id: actorIdentityId,
      });
      if (!rpcErr && rpcRes?.success) {
        updated = true;
      } else if (rpcErr) {
        console.error('[ChangePassword RPC Error]:', rpcErr);
      }
    } catch {
      // Lanjut ke fallback upsert
    }

    // 7. Fallback langsung upsert ke auth_credentials
    if (!updated) {
      const { error: upsertErr } = await supabase.from('auth_credentials').upsert(
        {
          account_id: session.account_id,
          hash_algorithm: 'bcrypt',
          password_hash: newHash,
          needs_rehash: false,
          password_updated_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'account_id' }
      );

      if (upsertErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui kata sandi: ${upsertErr.message}` }));
        return;
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: 'Kata sandi akun Anda berhasil diperbarui.' }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Terjadi kesalahan sistem saat memperbarui kata sandi.' }));
  }
}
