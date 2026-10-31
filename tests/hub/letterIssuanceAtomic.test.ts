import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import handler, { mapSuratIzinToDoc } from '../../api/dokumen';
import publicHandler from '../../api/verifikasi-surat';
import { signSessionToken } from '../../api/auth/_utils/crypto';
import { getSuratIzinDocumentProps } from '../../src/products/hub/surat/generator/suratIzinDocument';
import { StagingDokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), caps: ['hub.access','documents.generate','documents.archive.view'] }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock('../../api/auth/_utils/identity', () => ({
  verifyAccountStatusLive: async () => true,
  refreshLiveSession: async () => mocks.caps,
}));

const identity = '10000000-0000-4000-8000-000000000001';
const requestId = '20000000-0000-4000-8000-000000000001';
const santri = [{ nama: 'Synthetic A', kelas: 'X', asrama: 'Synthetic', jobdesc: 'Camera', is_intern: true }];
const row = {
  id: requestId, nomor_surat: '012/SI-PTV/X/2026', status: 'disetujui', nama_pemohon: 'Synthetic operator',
  alasan: 'Synthetic request', tanggal_mulai: '2026-10-29', tanggal_selesai: '2026-10-29',
  disetujui_oleh: identity, diajukan_oleh: identity, created_at: '2026-10-29T00:00:00Z',
  santri_list: santri, metadata: { activePreset: 'asrama' }, penanggung_jawab: 'Synthetic issuer',
};
let cookie = '';
async function call(body: unknown, url = '/api/dokumen?action=create', method = 'POST', target = handler) {
  let output: any;
  const req: any = { method, url, headers: { cookie }, on: (event: string, fn: (input?: string) => void) => {
    if (event === 'data') fn(JSON.stringify(body));
    if (event === 'end') fn();
  } };
  const res: any = { statusCode: 200, setHeader: vi.fn(), end: (value: string) => { output = JSON.parse(value); } };
  await target(req,res);
  return { status: res.statusCode, body: output };
}

describe('Penerbitan SI memakai nomor final RPC', () => {
  beforeEach(() => {
    const secret = randomUUID() + randomUUID();
    vi.stubEnv('AUTH_SECRET',secret);
    vi.stubEnv('SUPABASE_URL','https://example.invalid');
    vi.stubEnv('VITE_SUPABASE_URL','https://example.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic');
    cookie = 'ptv_hub_session=' + signSessionToken({
      account_id: '30000000-0000-4000-8000-000000000001', identity_id: identity,
      full_name: 'Synthetic operator', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600,
    } as any,secret);
    mocks.caps = ['hub.access','documents.generate','documents.archive.view'];
    mocks.rpc.mockResolvedValue({data:row,error:null});
    mocks.from.mockImplementation(() => ({ select: () => ({ order: async () => ({ data: [],error:null }) }) }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('mengabaikan nomor klien dan mempertahankan objek santri serta identitas FK', async () => {
    const result = await call({type:'Surat Izin Santri',status:'Disetujui',subject:'Synthetic request',
      date:'2026-10-29',request_id:requestId,no:'001/SI-PTV/X/2026',recipients:['name only'],santri_list:santri,metadata:row.metadata});
    expect(result.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('issue_ptv_surat_izin_atomic',{p_document:expect.objectContaining({
      id:requestId,santri_list:santri,diajukan_oleh:identity,disetujui_oleh:identity,metadata:expect.objectContaining(row.metadata),
    })});
    expect(mocks.rpc.mock.calls[0][1].p_document).not.toHaveProperty('nomor_surat');
    expect(result.body.document.no).toBe(row.nomor_surat);
    expect(result.body.document.santri_list).toEqual(santri);
  });
  it('gagal tertutup saat RPC belum dipasang; tidak fallback insert', async () => {
    mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
    const result = await call({type:'SI',status:'Disetujui',date:'2026-10-29',santri_list:santri});
    expect(result.status).toBe(503);
    expect(result.body.success).not.toBe(true);
    expect(mocks.from).toHaveBeenCalledTimes(3);
  });
  it('requires the main login and creation permission without an extra code', async () => {
    cookie = '';
    expect((await call({ type:'SI', status:'Disetujui', santri_list:santri })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not issue a number for an authenticated user without creation rights', async () => {
    mocks.caps = ['hub.access','documents.view'];
    expect((await call({ type:'SI', status:'Disetujui', santri_list:santri })).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('preview mengambil nomor resmi server tanpa status perkiraan', async () => {
    mocks.rpc.mockResolvedValue({data:{nomor_surat:row.nomor_surat,sequence:12,year:'2026',roman_month:'X'},error:null});
    const result = await call(null,'/api/dokumen?mode=vacant_check&type=SI&date=2026-10-29','GET');
    expect(result.body.data).toMatchObject({nomor_surat:row.nomor_surat,next_sequence:12,is_vacant:true,is_official:true});
  });
  it('service tidak menerbitkan SI lokal ketika server gagal', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:'Atomic issuance unavailable'})}));
    await expect(new StagingDokumenService().createDocument({type:'Surat Izin Santri',subject:'Synthetic',santri_list:santri})).rejects.toThrow('Atomic issuance unavailable');
  });
  it('nomor PDF, arsip hasil mapping, dan verifikasi publik identik', async () => {
    const doc = mapSuratIzinToDoc(row);
    expect(doc.no).toBe(row.nomor_surat);
    expect(doc.metadata).toEqual(row.metadata);
    expect(getSuratIzinDocumentProps(doc).nomorSurat).toBe(row.nomor_surat);
    mocks.from.mockImplementation(() => ({select: () => ({eq: (_field: string,no: string) => ({limit: async () => ({data:no===row.nomor_surat?[row]:[],error:null})})})}));
    const result = await call(null,`/api/verifikasi-surat?nomor=${encodeURIComponent(doc.no)}`,'GET',publicHandler);
    expect(result.body).toEqual({found:true,nomor_surat:row.nomor_surat,status:'valid'});
  });
});
