import { describe, it, expect } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import handler from '../../api/finance';
import { signSessionToken } from '../../api/auth/_utils/crypto';

function loadEnvFile(file: string): Record<string, string> {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

describe('Finance 3.0 Real Staging HTTP Handler Verification', () => {
  const env = { ...loadEnvFile('.env.staging'), ...loadEnvFile('.env.staging.local') };
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }

  it('GET /api/finance pengurus aktif (jid/zidnal) mengembalikan HTTP 200 dengan snapshot canonical lengkap', async () => {
    const secret = process.env.AUTH_SECRET;
    expect(secret).toBeDefined();

    const token = signSessionToken({
      account_id: 'c08952de-a8ff-48e0-8182-ac0bb7ac6767',
      identity_id: '8fb1aa38-c469-4dc5-9392-8588f7a71e39',
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as any, secret!);

    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      url: '/api/finance',
      headers: { cookie: `ptv_hub_session=${token}` },
      [Symbol.asyncIterator]: async function* () {},
    }) as unknown as IncomingMessage;

    let statusCode = 0;
    let responseData = '';
    const headers: Record<string, string> = {};

    const res = {
      get statusCode() { return statusCode; },
      set statusCode(val: number) { statusCode = val; },
      setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      end(data?: string) { if (data) responseData = data; },
    } as unknown as ServerResponse;

    await handler(req, res);

    expect(statusCode).toBe(200);
    const parsed = JSON.parse(responseData);
    expect(parsed.source).toBe('staging');
    expect(parsed.canManage).toBe(true);
    expect(parsed.canonical).toBeDefined();
    expect(parsed.canonical.state).toBe('available');

    // Verifikasi saldo kas utama Rp 593.276
    const pockets = parsed.canonical.pockets;
    expect(Array.isArray(pockets)).toBe(true);
    const kasUtama = pockets.find((p: any) => p.name.toLowerCase().includes('kas utama'));
    expect(kasUtama).toBeDefined();
    expect(Number(kasUtama.balanceMinor)).toBe(59327600); // 59327600 minor = Rp 593.276

    // Verifikasi transaksi tidak kosong dan terbaca utuh
    expect(Array.isArray(parsed.canonical.transactions)).toBe(true);
    expect(parsed.canonical.transactions.length).toBeGreaterThanOrEqual(70);
  }, 15000);

  it('GET /api/finance?operational=1 mengembalikan HTTP 200 dengan semesters, records (48 kas kru terekonsiliasi), dan loans', async () => {
    const secret = process.env.AUTH_SECRET;
    expect(secret).toBeDefined();

    const token = signSessionToken({
      account_id: 'c08952de-a8ff-48e0-8182-ac0bb7ac6767',
      identity_id: '8fb1aa38-c469-4dc5-9392-8588f7a71e39',
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as any, secret!);

    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      url: '/api/finance?operational=1',
      headers: { cookie: `ptv_hub_session=${token}` },
      [Symbol.asyncIterator]: async function* () {},
    }) as unknown as IncomingMessage;

    let statusCode = 0;
    let responseData = '';
    const headers: Record<string, string> = {};

    const res = {
      get statusCode() { return statusCode; },
      set statusCode(val: number) { statusCode = val; },
      setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      end(data?: string) { if (data) responseData = data; },
    } as unknown as ServerResponse;

    await handler(req, res);

    expect(statusCode).toBe(200);
    const parsed = JSON.parse(responseData);
    expect(parsed.source).toBe('staging');
    expect(parsed.scope).toBe('global');
    expect(Array.isArray(parsed.semesters)).toBe(true);
    expect(parsed.semesters.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(parsed.records)).toBe(true);
    const activeLunasRecords = parsed.records.filter((r: any) => r.status === 'lunas');
    expect(activeLunasRecords.length).toBe(40);
    // Semua 40 pembayaran lunas wajib terhubung ke UUID canonical_identity.id yang valid dan totalnya Rp 925.000
    for (const rec of activeLunasRecords) {
      expect(typeof rec.identityId).toBe('string');
      expect(rec.identityId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(rec.identityUnlinked).toBeFalsy();
      expect(rec.ptvId).toMatch(/^PTV-\d{3}$/);
    }
    const totalPaidRupiah = activeLunasRecords.reduce((acc: number, r: any) => acc + Number(r.paidAmountMinor) / 100, 0);
    expect(totalPaidRupiah).toBe(925000);

    // Verifikasi crewRoster berasal dari canonical_identity + organization_membership (23 kru operasional aktif)
    expect(Array.isArray(parsed.crewRoster)).toBe(true);
    const activeOperationalCrew = parsed.crewRoster.filter((c: any) => c.category === 'Kru' && c.status_kru === 'Aktif');
    expect(activeOperationalCrew.length).toBe(23);
    const rosterNames = activeOperationalCrew.map((c: any) => c.full_name);
    expect(rosterNames).toContain('Nasshar Rasikh Arsyadiano');
    expect(rosterNames).toContain('Rex Ruizhi Gajendra');
    expect(rosterNames).toContain('Taqiu Rabbani Fadillah');
    expect(rosterNames).toContain('Ahmad Royyan Syauqie');
    expect(rosterNames).toContain('Ziddan Arzaqi');
    expect(rosterNames).not.toContain('Muhammad Zaki');
    expect(rosterNames).not.toContain('Nadhif Syarafana');
    expect(rosterNames).not.toContain('Niki Santri');

    expect(Array.isArray(parsed.loans)).toBe(true);
  }, 15000);

  it('Finance3KasKru merender 23 kru operasional resmi dengan nama asli, ID PTV, status keanggotaan, dan 0 nama dummy', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { Finance3KasKru, CANONICAL_VERIFIED_CREW_ROSTER } = await import('../../src/products/hub/keuangan/Finance3KasKru');

    expect(CANONICAL_VERIFIED_CREW_ROSTER.length).toBe(23);

    const html = renderToStaticMarkup(
      React.createElement(Finance3KasKru, {
        data: {
          source: 'staging',
          canManage: true,
          canonical: {
            state: 'available',
            pockets: [],
            categories: [],
            transactions: [],
          },
        } as any,
        operationalData: {
          source: 'staging',
          scope: 'global',
          ownerPtvId: 'PTV-001',
          writesEnabled: false,
          semesters: [
            {
              id: '2941ab08-a7f9-4f35-9539-93131fbe5685',
              name: 'Semester Ganjil 2026/2027',
              startDate: '2026-09-01',
              endDate: '2027-02-28',
              monthlyFeeMinor: '2500000',
              monthlyFees: { '2026-09': '2000000', '2026-10': '2000000', '2026-11': '5000000' },
              isActive: true,
              isArchived: false,
              createdAt: '2026-09-01T00:00:00.000Z',
            },
          ],
          records: [
            {
              id: 'tx-kaskru-6f008e5e',
              semesterId: '2941ab08-a7f9-4f35-9539-93131fbe5685',
              identityId: '29dc4b45-9465-4d90-9cb3-051438f067b7',
              ptvId: 'PTV-031',
              crewName: 'Nasshar Rasikh Arsyadiano',
              period: '2026-10',
              amountMinor: '2000000',
              paidAmountMinor: '2000000',
              status: 'lunas',
              paymentDate: '2026-10-02',
              method: 'transfer',
              pocketId: '60e8d033-2794-4219-a960-c56bedca0111',
              transactionId: '6f008e5e-3459-4fd8-8fb7-523851e9f1db',
              createdAt: '2026-10-02T00:00:00.000Z',
              updatedAt: '2026-10-02T00:00:00.000Z',
            },
          ],
          loans: [],
          feeDueDay: 10,
          crewRoster: CANONICAL_VERIFIED_CREW_ROSTER,
        },
      })
    );

    expect(html).toContain('Semua Kru (23)');
    expect(html).toContain('PTV-031');
    expect(html).toContain('Nasshar Rasikh Arsyadiano');
    expect(html).toContain('PTV-032');
    expect(html).toContain('Rex Ruizhi Gajendra');
    expect(html).toContain('PTV-033');
    expect(html).toContain('Taqiu Rabbani Fadillah');
    expect(html).toContain('PTV-019');
    expect(html).toContain('Ahmad Royyan Syauqie');
    expect(html).toContain('PTV-034');
    expect(html).toContain('Ziddan Arzaqi');
    expect(html).toContain('Aktif');
    expect(html).not.toContain('Muhammad Zaki');
    expect(html).not.toContain('Nadhif Syarafana');
    expect(html).not.toContain('Niki Santri');
  });

  it('POST /api/finance action=update_semester_period_fee menolak akses non-pengelola (403) dan menyimpan permanen untuk pengelola dengan histori lengkap', async () => {
    const secret = process.env.AUTH_SECRET!;
    const semesterId = '2941ab08-a7f9-4f35-9539-93131fbe5685';

    // 1. Pengguna kru biasa tanpa finance.manage (Rex PTV-032) -> wajib ditolak 403
    const crewToken = signSessionToken({
      account_id: '9e31e9f3-5a68-4f11-86d7-6fc2f20c8d6e',
      identity_id: 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8',
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as any, secret);

    const callPost = async (token: string, bodyObj: Record<string, any>) => {
      const payloadStr = JSON.stringify(bodyObj);
      const req = Object.assign(new EventEmitter(), {
        method: 'POST',
        url: '/api/finance',
        headers: {
          cookie: `ptv_hub_session=${token}`,
          'content-type': 'application/json',
          host: 'localhost:5174',
          origin: 'http://localhost:5174',
        },
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(payloadStr, 'utf8');
        },
      }) as unknown as IncomingMessage;

      let status = 200;
      let resBody = '';
      const res = {
        set statusCode(code: number) { status = code; },
        get statusCode() { return status; },
        setHeader() { return this; },
        end(chunk?: string) { resBody = chunk || ''; return this; },
      } as unknown as ServerResponse;

      await handler(req, res);
      return { status, body: resBody ? JSON.parse(resBody) : {} };
    };

    const callGetOperational = async (token: string) => {
      const req = Object.assign(new EventEmitter(), {
        method: 'GET',
        url: '/api/finance?operational=1',
        headers: { cookie: `ptv_hub_session=${token}` },
        [Symbol.asyncIterator]: async function* () {},
      }) as unknown as IncomingMessage;

      let status = 200;
      let resBody = '';
      const res = {
        set statusCode(code: number) { status = code; },
        get statusCode() { return status; },
        setHeader() { return this; },
        end(chunk?: string) { resBody = chunk || ''; return this; },
      } as unknown as ServerResponse;

      await handler(req, res);
      return { status, body: resBody ? JSON.parse(resBody) : {} };
    };

    const denied = await callPost(crewToken, {
      action: 'update_semester_period_fee',
      semesterId,
      period: '2026-10',
      newFeeMinor: '3000000',
    });
    expect(denied.status).toBe(403);

    // 2. Pengelola keuangan (Muhammad Zidnal Falah PTV-001) mengubah tarif 2026-10 ke Rp 30.000 (3000000 minor)
    const adminToken = signSessionToken({
      account_id: 'c08952de-a8ff-48e0-8182-ac0bb7ac6767',
      identity_id: '8fb1aa38-c469-4dc5-9392-8588f7a71e39',
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as any, secret);

    const updateRes = await callPost(adminToken, {
      action: 'update_semester_period_fee',
      semesterId,
      period: '2026-10',
      newFeeMinor: '3000000',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.semester.monthlyFees['2026-10']).toBe('3000000');
    expect(updateRes.body.semester.monthlyFees['2026-09']).toBe('2000000'); // Bulan lain tetap utuh!
    expect(updateRes.body.historyEntry).toMatchObject({
      semesterId,
      period: '2026-10',
      previousFeeMinor: '2000000',
      newFeeMinor: '3000000',
      changedByPtvId: 'PTV-001',
      changedByName: 'Muhammad Zidnal Falah',
    });

    // 3. Verifikasi GET /api/finance?operational=1 setelah refresh membaca tarif terbaru dari Supabase staging
    const refreshed = await callGetOperational(adminToken);
    expect(refreshed.status).toBe(200);
    const activeSemAfterUpdate = refreshed.body.semesters.find((s: any) => s.id === semesterId);
    expect(activeSemAfterUpdate.monthlyFees['2026-10']).toBe('3000000');
    expect(Array.isArray(refreshed.body.feeHistory)).toBe(true);
    expect(refreshed.body.feeHistory[0].newFeeMinor).toBe('3000000');

    // 4. Verifikasi perhitungan matriks kas kru dengan tarif baru Rp 30.000 tanpa mengubah pembayaran tercatat
    const { calculateKasKruMatrix } = await import('../../src/products/hub/keuangan/kasKruService');
    const matrix = calculateKasKruMatrix(
      activeSemAfterUpdate,
      refreshed.body.crewRoster,
      refreshed.body.records,
      refreshed.body.feeDueDay
    );
    // Malik (PTV-027) membayar Rp 20.000 pada 2026-10. Saat tarif naik menjadi Rp 30.000:
    // - paidAmountMinor tetap 2000000 (Rp 20.000) — pembayaran tercatat TIDAK diubah!
    // - status menjadi 'sebagian' (kurang bayar) dengan shortageMinor = 1000000 (Rp 10.000)
    const malikRow = matrix.rows.find(r => r.crew.ptv_id === 'PTV-027')!;
    expect(malikRow.periods['2026-10'].paidAmountMinor).toBe('2000000');
    expect(malikRow.periods['2026-10'].amountMinor).toBe('3000000');
    expect(malikRow.periods['2026-10'].status).toBe('sebagian');
    expect(malikRow.periods['2026-10'].shortageMinor).toBe('1000000');

    // 5. Uji penurunan tarif 2026-10 menjadi Rp 15.000 (1500000 minor) -> kelebihan bayar (overpaidMinor)
    const lowerRes = await callPost(adminToken, {
      action: 'update_semester_period_fee',
      semesterId,
      period: '2026-10',
      newFeeMinor: '1500000',
    });
    expect(lowerRes.status).toBe(200);
    const matrixLower = calculateKasKruMatrix(
      lowerRes.body.semester,
      refreshed.body.crewRoster,
      refreshed.body.records,
      refreshed.body.feeDueDay
    );
    const malikLower = matrixLower.rows.find(r => r.crew.ptv_id === 'PTV-027')!;
    expect(malikLower.periods['2026-10'].paidAmountMinor).toBe('2000000'); // Tetap Rp 20.000
    expect(malikLower.periods['2026-10'].status).toBe('lunas');
    expect(malikLower.periods['2026-10'].overpaidMinor).toBe('500000'); // Kelebihan bayar Rp 5.000

    // 6. Kembalikan tarif 2026-10 ke nilai operasional resmi Rp 20.000 (2000000 minor)
    const restoreRes = await callPost(adminToken, {
      action: 'update_semester_period_fee',
      semesterId,
      period: '2026-10',
      newFeeMinor: '2000000',
    });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.semester.monthlyFees['2026-10']).toBe('2000000');
    expect(restoreRes.body.feeHistory.length).toBeGreaterThanOrEqual(3);
  }, 25000);
});
