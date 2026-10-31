import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Session Authentication Gate
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Sesi login diperlukan untuk mengunggah foto profil.' }));
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Sesi login telah kedaluwarsa.' }));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Konfigurasi storage backend belum lengkap.' }));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });

  try {
    // Parse JSON payload containing base64 data and metadata
    let parsed: any;
    const existingBody = (req as any).body;
    if (existingBody !== undefined) {
      if (typeof existingBody === 'object' && existingBody !== null) {
        parsed = existingBody;
      } else if (typeof existingBody === 'string') {
        parsed = JSON.parse(existingBody || '{}');
      } else if (Buffer.isBuffer(existingBody)) {
        parsed = JSON.parse(existingBody.toString('utf8') || '{}');
      }
    }
    if (!parsed) {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
        if (bodyStr.length > 10 * 1024 * 1024) {
          throw new Error('Ukuran file foto maksimal 10MB.');
        }
      });

      await new Promise<void>((resolve, reject) => {
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      parsed = JSON.parse(bodyStr || '{}');
    }
    const { data: base64Data, ptv_id: ptvId } = parsed;

    if (!base64Data || typeof base64Data !== 'string') {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Data foto base64 wajib disertakan.' }));
      return;
    }

    // Extract mime type and raw base64 buffer
    const match = base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let rawBase64 = base64Data;
    let extension = 'jpg';

    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
      if (mimeType.includes('png')) extension = 'png';
      else if (mimeType.includes('webp')) extension = 'webp';
      else if (mimeType.includes('gif')) extension = 'gif';
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(mimeType)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.' }));
      return;
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Ukuran file foto maksimal 10MB.' }));
      return;
    }
    const cleanId = (ptvId || session.ptv_id || 'crew').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fileName = `avatars/crew_${cleanId}_${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('inventory')
      .upload(fileName, buffer, {
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error('[UploadAvatar] Upload error:', uploadError);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: `Gagal menyimpan foto ke storage: ${uploadError.message}` }));
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('inventory').getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl;

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        url: publicUrl,
        message: 'Foto profil berhasil disimpan secara permanen di storage studio.',
      })
    );
  } catch (err: any) {
    console.error('[UploadAvatar] Exception:', err);
    res.statusCode = 400;
    res.end(JSON.stringify({ error: err?.message || 'Gagal memproses unggahan foto.' }));
  }
}
