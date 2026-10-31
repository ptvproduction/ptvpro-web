import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { lifecycleClient } from './auth/_utils/portalLifecycle';
import { resolveLiveAccess, LiveAccessUnavailableError } from './auth/_utils/liveAccess';
import type { AppCapability } from '../src/core/policy';

const uuid = z.string().uuid();
const text = z.string().trim().max(5000);
const optionalText = text.nullish();
const createMaster = z.object({ id: uuid, request_id: uuid.optional(), kode: z.string().trim().regex(/^INV-\d+$/i),
  nama_alat: z.string().trim().min(1).max(255), kategori: z.string().trim().min(1).max(64), spesifikasi: optionalText,
  foto_url: optionalText, harga_beli: z.number().finite().nonnegative().nullable().optional(), sumber_perolehan: optionalText }).strict();
const createUnit = z.object({ kode_unit: text, nomor_seri: optionalText, kondisi: z.enum(['bagus', 'rusak', 'perlu_servis']),
  status_peminjaman: z.enum(['tersedia', 'maintenance']), lokasi_penyimpanan: optionalText }).strict();
const editMaster = z.object({ id: uuid, nama_alat: z.string().trim().min(1).max(255), kategori: text,
  spesifikasi: optionalText, sumber_perolehan: optionalText, lokasi_penyimpanan: optionalText, foto_url: optionalText,
  expected_updated_at: z.string().datetime({ offset: true }).optional() }).strict();
const editUnit = z.object({ id: uuid, kode_unit: text, nama_unit: optionalText, nomor_seri: optionalText,
  kondisi: z.enum(['bagus', 'rusak', 'perlu_servis']), lokasi_penyimpanan: optionalText }).strict();
const valuation = z.object({ nilai_perolehan: z.number().finite().nonnegative().optional(), nilai_tercatat: z.number().finite().nonnegative().optional(),
  tanggal_perolehan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), catatan: text.optional(),
  id: text.optional(), inventaris_id: uuid.optional(), nilai_residu: z.number().finite().nonnegative().optional(),
  sumber_perolehan: text.optional(), vendor: text.optional(), nomor_invoice: text.optional(), status: z.enum(['Aktif', 'Belum Dicatat', 'Dihapuskan']).optional(),
  dokumen_url: z.string().url().optional(), created_by_name: text.optional(), created_at: text.optional(), updated_at: text.optional() }).strict();
const readCapabilities: Record<string, AppCapability> = { list: 'inventory.view', detail: 'inventory.view',
  valuations: 'inventory.valuation.view', 'next-code': 'inventory.create', diagnostics: 'inventory.view' };
const writeCapabilities: Record<string, AppCapability> = { create: 'inventory.create', update: 'inventory.edit',
  upload: 'inventory.create', 'unit-status': 'inventory.units.manage', 'valuation-save': 'inventory.valuation.manage', 'valuation-delete': 'inventory.valuation.manage' };

export function inventoryRequestId(accountId: string, requestId: string, secret: string) {
  const hex = createHmac('sha256', secret).update(`inventory:${accountId}:${requestId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function inventoryImageType(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = bytes.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

class InventoryError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

async function readBody(req: IncomingMessage & { body?: unknown }, limit: number): Promise<Buffer> {
  if (Number(req.headers['content-length']) > limit) throw new InventoryError(413, 'Ukuran permintaan melebihi batas.');
  if (req.body !== undefined) {
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (data.length > limit) throw new InventoryError(413, 'Ukuran permintaan melebihi batas.');
    return data;
  }
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += data.length;
    if (length > limit) throw new InventoryError(413, 'Ukuran permintaan melebihi batas.');
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return send(405, { error: 'Metode tidak diizinkan.' });
  const secret = process.env.AUTH_SECRET || '';
  const token = parseCookies(req.headers.cookie).ptv_hub_session;
  const session = token && secret ? verifySessionToken(token, secret) : null;
  if (!session) return send(401, { error: 'Sesi Portal diperlukan.' });
  try {
    if (req.method === 'POST' && (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host
      || req.headers['sec-fetch-site'] === 'cross-site')) throw new InventoryError(403, 'Asal permintaan tidak diizinkan.');
    let db: ReturnType<typeof lifecycleClient>;
    try { db = lifecycleClient(); } catch { throw new InventoryError(503, 'Inventaris hanya tersedia pada Staging terverifikasi.'); }
    const live = await resolveLiveAccess(db, session);
    const url = new URL(req.url || '/', 'http://localhost');
    let action = url.searchParams.get('action') || 'list';
    let payload: unknown = {};
    if (req.method === 'GET') payload = JSON.parse(url.searchParams.get('payload') || '{}');
    else if (action !== 'upload') {
      if (!req.headers['content-type']?.includes('application/json')) throw new InventoryError(415, 'Permintaan harus JSON.');
      const body = z.object({ action: z.string(), payload: z.unknown() }).strict().parse(JSON.parse((await readBody(req, 256 * 1024)).toString('utf8')));
      action = body.action; payload = body.payload;
    }
    const registry = req.method === 'GET' ? readCapabilities : writeCapabilities;
    if (!Object.hasOwn(registry, action)) throw new InventoryError(400, 'Operasi Inventaris tidak dikenal.');
    const permitted = action === 'upload' ? live.can('inventory.create') || live.can('inventory.edit') : live.can(registry[action]);
    if (!permitted) throw new InventoryError(403, 'Capability operasi Inventaris tidak mencukupi.', '42501');
    const audit = async (phase: string, entity?: string) => {
      const result = await db.from('auth_audit_log').insert({ actor_id: live.identity.id, event_type: `inventory_${action.replaceAll('-', '_')}_${phase}`,
        metadata: { account_id: live.account.id, ...(entity ? { entity_id: entity } : {}) } });
      if (result.error) throw new InventoryError(503, 'Konfirmasi audit belum tersedia. Periksa hasil sebelum mencoba lagi.');
    };
    const check = <T>(result: { data: T; error: unknown }): T => {
      const code = result.error && typeof result.error === 'object' && 'code' in result.error ? String(result.error.code) : undefined;
      if (result.error) throw new InventoryError(code === '42501' ? 403 : code === '23505' || code === '40001' ? 409 : 503,
        'Operasi belum dikonfirmasi database. Muat ulang sebelum mencoba lagi.', code);
      return result.data;
    };
    const visibleValues = live.can('inventory.valuation.view') || live.can('inventory.valuation.manage');
    const columns = `id,kode,nama_alat,kategori,spesifikasi,foto_url,sumber_perolehan,created_at,updated_at,units:ptv_inventaris_unit(id,inventaris_id,kode_unit,nama_unit,nomor_seri,kondisi,status_peminjaman,lokasi_penyimpanan,created_at,updated_at)${visibleValues ? ',harga_beli,nilai:ptv_nilai_inventaris(id,inventaris_id,nilai_perolehan,nilai_buku_saat_ini,tanggal_valuasi,catatan_akuntansi,updated_at,vendor,nomor_invoice,sumber_perolehan,status,nilai_residu,dokumen_url,created_by_name,catatan)' : ''}`;
    if (req.method === 'GET') {
      let data: unknown;
      if (action === 'detail') {
        const { id } = z.object({ id: text.min(1) }).strict().parse(payload);
        const field = uuid.safeParse(id).success ? 'id' : 'kode';
        data = check(await db.from('ptv_inventaris').select(columns).eq(field, id).maybeSingle());
      } else if (action === 'next-code') {
        const rows = check(await db.from('ptv_inventaris').select('kode'));
        const used = new Set((rows || []).map(row => Number(/^INV-(\d+)$/i.exec(row.kode || '')?.[1])));
        let n = 1; while (used.has(n)) n++;
        data = `INV-${String(n).padStart(3, '0')}`;
      } else if (action === 'diagnostics') {
        check(await db.from('ptv_inventaris').select('id').limit(1));
        check(await db.from('ptv_inventaris_unit').select('id').limit(1));
        const bucket = check(await db.storage.getBucket('inventory'));
        data = { bucketExists: !!bucket, canCreate: live.can('inventory.create') };
      } else {
        const { search } = z.object({ search: z.string().max(200).optional() }).strict().parse(payload);
        let rows = (check(await db.from('ptv_inventaris').select(columns).order('created_at', { ascending: false })) || []) as unknown as Record<string, unknown>[];
        if (search?.trim()) { const q = search.trim().toLowerCase(); rows = rows.filter(row => [row.nama_alat, row.kode, row.kategori, row.spesifikasi].some(value => String(value || '').toLowerCase().includes(q))); }
        data = rows;
      }
      return send(200, { success: true, data });
    }
    if (action === 'unit-status') throw new InventoryError(409, 'Status unit harus diubah melalui transaksi peminjaman/pengembalian atau QC kerusakan atomik.');
    if (action === 'upload') {
      const bytes = await readBody(req, 4 * 1024 * 1024);
      const mime = inventoryImageType(bytes);
      if (!mime || req.headers['content-type']?.split(';')[0] !== mime) throw new InventoryError(415, 'Isi berkas tidak sesuai format gambar yang diizinkan.');
      const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
      const path = `catalog/portal/${live.account.id}/${randomUUID()}.${ext[mime]}`;
      await audit('requested');
      check(await db.storage.from('inventory').upload(path, bytes, { contentType: mime, upsert: false, cacheControl: '3600' }));
      await audit('confirmed', path);
      return send(200, { success: true, data: db.storage.from('inventory').getPublicUrl(path).data.publicUrl });
    }
    if (action === 'create' || action === 'update') {
      const args = action === 'create'
        ? z.object({ p_master: createMaster, p_units: z.array(createUnit).min(1).max(200) }).strict().parse(payload)
        : z.object({ p_master: editMaster, p_units: z.array(editUnit).max(200) }).strict().parse(payload);
      const master = args.p_master;
      const photo = master.foto_url;
      if (photo) {
        const baseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
        const ownPrefix = `${baseUrl}/storage/v1/object/public/inventory/catalog/portal/${live.account.id}/`;
        const ownPath = photo.startsWith(ownPrefix) && /^[\da-f-]+\.(jpg|png|webp|gif|heic|heif)$/.test(photo.slice(ownPrefix.length));
        if (!ownPath) {
          const existing = action === 'update' ? check(await db.from('ptv_inventaris').select('foto_url').eq('id', master.id).maybeSingle()) : null;
          if (!existing || existing.foto_url !== photo) throw new InventoryError(403, 'Foto harus berasal dari unggahan akun ini atau foto existing alat.');
        }
      }
      if (action === 'create') {
        if (args.p_units.some(unit => 'status_peminjaman' in unit && unit.kondisi !== 'bagus' && unit.status_peminjaman !== 'maintenance')) {
          throw new InventoryError(400, 'Unit rusak atau perlu servis harus berstatus maintenance.');
        }
        master.id = inventoryRequestId(live.account.id, master.id, secret);
        // request_id is only a transport key; the RPC uses the actor-scoped master ID.
        if ('request_id' in master) master.request_id = master.id;
      }
      await audit('requested', master.id);
      const data = check(await db.rpc(action === 'create' ? 'rpc_create_inventaris' : 'rpc_update_inventaris', args));
      if (!data || data.id !== master.id) throw new InventoryError(503, 'Konfirmasi identitas alat tidak cocok.');
      await audit('confirmed', master.id);
      return send(200, { success: true, data });
    }
    const values = action === 'valuation-save'
      ? z.object({ assetId: uuid, data: valuation }).strict().parse(payload)
      : z.object({ assetId: uuid }).strict().parse(payload);
    const item = check(await db.from('ptv_inventaris').select('id').eq('id', values.assetId).maybeSingle());
    if (!item) throw new InventoryError(404, 'Alat tidak ditemukan.');
    await audit('requested', item.id);
    let data: unknown;
    if ('data' in values) {
      const value = valuation.parse(values.data);
      if (value.dokumen_url && !value.dokumen_url.startsWith('https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/')) {
        throw new InventoryError(400, 'Lampiran valuasi harus berasal dari Storage Staging.');
      }
      data = check(await db.from('ptv_nilai_inventaris').upsert({ inventaris_id: item.id,
        nilai_perolehan: value.nilai_perolehan ?? 0, nilai_buku_saat_ini: value.nilai_tercatat ?? value.nilai_perolehan ?? 0,
        tanggal_valuasi: value.tanggal_perolehan || new Date().toISOString().slice(0, 10), catatan_akuntansi: value.catatan || null,
        ...Object.fromEntries(['vendor', 'nomor_invoice', 'sumber_perolehan', 'status', 'nilai_residu', 'dokumen_url']
          .filter(field => value[field as keyof typeof value] !== undefined).map(field => [field, value[field as keyof typeof value]])),
        updated_at: new Date().toISOString() }, { onConflict: 'inventaris_id' }).select('id').single());
      if (!data) throw new InventoryError(503, 'Nilai belum dikonfirmasi tersimpan.');
    } else {
      const removed = check(await db.from('ptv_nilai_inventaris').delete().eq('inventaris_id', item.id).select('id'));
      data = (removed || []).length > 0;
    }
    await audit('confirmed', item.id);
    return send(200, { success: true, data });
  } catch (error) {
    if (error instanceof InventoryError) return send(error.status, { error: error.message, code: error.code });
    if (error instanceof LiveAccessUnavailableError) return send(503, { error: 'Verifikasi akses sementara tidak tersedia.' });
    if (error instanceof Error && error.message === 'forbidden') return send(403, { error: 'Sesi atau akses telah dicabut.' });
    return send(400, { error: 'Permintaan Inventaris tidak valid.' });
  }
}
