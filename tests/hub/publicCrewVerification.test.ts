import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyCrewOnServer } from '../../src/products/verification/publicCrewService';

describe('Public Crew Verification Service (verifyCrewOnServer)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mengembalikan identitas kru terverifikasi dari backend', async () => {
    const mockData = {
      is_found: true,
      crew_id: 'PTV-001',
      full_name: 'Ahmad Executive',
      position: 'Ketua Umum',
      division: 'Leadership',
      angkatan: '2024',
      status_kru: 'Aktif',
      foto_url: 'https://example.com/avatar.jpg',
      active_assignment: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);

    const res = await verifyCrewOnServer('PTV-001');
    expect(res.is_found).toBe(true);
    expect(res.crew_id).toBe('PTV-001');
    expect(res.full_name).toBe('Ahmad Executive');
    expect(res.status_kru).toBe('Aktif');
    expect(res.foto_url).toBe('https://example.com/avatar.jpg');
  });

  it('menangani respon kru tidak terdaftar secara fail-safe', async () => {
    const mockData = {
      is_found: false,
      crew_id: 'PTV-999',
      full_name: 'Identitas Kru Tidak Terdaftar',
      position: '-',
      division: '-',
      angkatan: '-',
      status_kru: 'Nonaktif',
      active_assignment: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);

    const res = await verifyCrewOnServer('PTV-999');
    expect(res.is_found).toBe(false);
    expect(res.full_name).toBe('Identitas Kru Tidak Terdaftar');
    expect(res.status_kru).toBe('Nonaktif');
  });

  it('tidak mengekspos credential atau data privat kru', async () => {
    const mockData = {
      is_found: true,
      crew_id: 'PTV-001',
      full_name: 'Ahmad Executive',
      position: 'Ketua Umum',
      division: 'Leadership',
      angkatan: '2024',
      status_kru: 'Aktif',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);

    const res = await verifyCrewOnServer('PTV-001') as any;
    expect(res.email).toBeUndefined();
    expect(res.phone).toBeUndefined();
    expect(res.password).toBeUndefined();
    expect(res.tokens).toBeUndefined();
    expect(res.capabilities).toBeUndefined();
  });
});
