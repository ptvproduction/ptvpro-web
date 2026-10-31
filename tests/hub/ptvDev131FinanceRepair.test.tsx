import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  calculateKasKruMatrix,
} from '../../src/products/hub/keuangan/kasKruService';
import { FinanceKasKruView } from '../../src/products/hub/keuangan/FinanceKasKruView';
import { FinanceSettingsView } from '../../src/products/hub/keuangan/FinanceSettingsView';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { FinanceSemester } from '../../src/products/hub/keuangan/kasKruTypes';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';
import type { CrewMember } from '../../src/products/hub/kru/types';
import { hasCapability, type PermissionContext } from '../../src/core/policy/policyEngine';
import { resolveFinanceAccess } from '../../api/financeAccess';

const mockSemester: FinanceSemester = {
  id: 'sem-2026-ganjil',
  name: 'Semester Ganjil 2026/2027',
  startDate: '2026-09-01',
  endDate: '2027-01-31',
  monthlyFeeMinor: '2500000',
  isActive: true,
  isArchived: false,
  createdAt: '2026-09-01T00:00:00Z',
};

const mockSnapshot: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 39, expense: 10, ledger: 0 },
  entries: [],
  kas: [],
  limited: false,
  writesEnabled: true,
  canonical: {
    state: 'available',
    pockets: [
      {
        id: '60e8d033-2794-4219-a960-c56bedca0111',
        name: 'Kas Utama Studio',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 50,
        balanceMinor: '52027600',
        qris: null,
      },
    ],
    categories: [
      { id: '22222222-2222-4222-8222-222222222222', name: 'Iuran Kru', kind: 'income', isActive: true },
    ],
    transactions: [],
  },
};

describe('PTV-DEV-131 — Finance 2.0 Mobile Layout Repair & Kas Kru UX', () => {
  it('Kas Kru View toolbar does NOT contain "Buat Semester" button', () => {
    const html = renderToStaticMarkup(
      <FinanceKasKruView
        data={mockSnapshot}
        onRefresh={() => {}}
      />
    );

    // Kas Kru view should NOT contain "Buat Semester" button
    expect(html).not.toContain('Buat Semester');
    // It should render Semester Ganjil label cleanly without monthly tariff suffix
    expect(html).toContain('Semester Ganjil 2026/2027 (Aktif)');
  });

  it('FinanceSettingsView contains semester management actions ("Buat Semester Baru" and "Edit Semester")', () => {
    const html = renderToStaticMarkup(
      <FinanceSettingsView
        data={mockSnapshot}
        canManage={true}
        onRefresh={() => {}}
      />
    );

    expect(html).toContain('Buat Semester Baru');
    expect(html).toContain('Edit Semester');
    expect(html).toContain('D2. Pengaturan Kas Kru — Semester &amp; Tarif Bulanan');
  });

  it('excludes Pembina and Pengarah categories from Kas Kru participant list and obligations', () => {
    const testCrewList: CrewMember[] = [
      ...CANONICAL_STAGING_CREW_FIXTURES,
      {
        id: 'pembina-special-1',
        ptv_id: 'PTV-901',
        full_name: 'Drs. Pembina Utama',
        username: 'pembina.utama',
        role: 'administrasi',
        category: 'Pembina',
        division: 'Pengarah',
        position: 'Pembina',
        angkatan: 2024,
        status_kru: 'Aktif',
        status_akun: 'Aktif',
        join_date: '2024-01-01',
      },
      {
        id: 'pengarah-special-2',
        ptv_id: 'PTV-902',
        full_name: 'Ir. Pengarah Khusus',
        username: 'pengarah.khusus',
        role: 'eksekutif',
        category: 'Pengarah',
        division: 'Pengarah',
        position: 'Pengarah',
        angkatan: 2024,
        status_kru: 'Aktif',
        status_akun: 'Aktif',
        join_date: '2024-01-01',
      },
    ];

    const matrix = calculateKasKruMatrix(mockSemester, testCrewList, []);

    // Matrix rows should ONLY have Kru category
    const pembinaRow = matrix.rows.find((r) => r.crew.id === 'pembina-special-1');
    const pengarahRow = matrix.rows.find((r) => r.crew.id === 'pengarah-special-2');

    expect(pembinaRow).toBeUndefined();
    expect(pengarahRow).toBeUndefined();

    // All rows in matrix must be category Kru
    matrix.rows.forEach((row) => {
      expect(row.crew.category).toBe('Kru');
    });
  });

  it('does NOT count future months as arrears before due date', () => {
    const futureSemester: FinanceSemester = {
      id: 'sem-future',
      name: 'Semester Masa Depan 2030',
      startDate: '2030-01-01',
      endDate: '2030-06-30',
      monthlyFeeMinor: '2500000',
      isActive: true,
      isArchived: false,
      createdAt: '2030-01-01T00:00:00Z',
    };

    const matrix = calculateKasKruMatrix(futureSemester, CANONICAL_STAGING_CREW_FIXTURES, []);

    // In a future semester, total arrears must be 0 because periods haven't passed
    expect(matrix.stats.totalArrearsMinor).toBe('0');
    matrix.rows.forEach((row) => {
      expect(row.arrearsMinor).toBe('0');
    });
  });
});

describe('PTV-DEV-131 — Multi-Layer Access Control Denying Pembina & Pengarah', () => {
  it('Policy Engine blocks all finance capabilities for Pembina category even with overrides', () => {
    const ctx: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew', 'eksekutif'],
      allowed_overrides: ['finance.view', 'finance.manage'],
      denied_overrides: [],
      category: 'Pembina',
    };

    expect(hasCapability(ctx, 'finance.view')).toBe(false);
    expect(hasCapability(ctx, 'finance.manage')).toBe(false);
    expect(hasCapability(ctx, 'finance.operator')).toBe(false);
  });

  it('Policy Engine blocks all finance capabilities for Pengarah category', () => {
    const ctx: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: ['finance.manage'],
      denied_overrides: [],
      category: 'Pengarah',
    };

    expect(hasCapability(ctx, 'finance.view')).toBe(false);
    expect(hasCapability(ctx, 'finance.manage')).toBe(false);
    expect(hasCapability(ctx, 'finance.operator')).toBe(false);
  });

  it('Policy Engine allows finance capabilities for active Kru member', () => {
    const ctx: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: ['finance.view'],
      denied_overrides: [],
      category: 'Kru',
    };

    expect(hasCapability(ctx, 'finance.view')).toBe(true);
  });

  it('resolveFinanceAccess throws forbidden error when identity links to category Pembina or Pengarah', async () => {
    const mockDb: any = {
      from: (table: string) => {
        const rows: Record<string, unknown> = {
          user_account: { identity_id: 'identity-test', status_akun: 'active' },
          canonical_identity: { ptv_id: 'PTV-TEST' },
          organization_membership: [{ status_organisasi: 'active' }],
          account_profiles: [{ profile_id: 'crew' }],
          account_capability_overrides: [],
          legacy_archive_kru: { jabatan: 'Pembina' },
        };
        const result = { data: rows[table], error: null };
        const chain: any = { then: (resolve: any) => resolve(result) };
        for (const method of ['select', 'eq', 'single', 'maybeSingle']) chain[method] = () => chain;
        return chain;
      },
    };

    const session: any = {
      account_id: 'acc-1',
      iat: Math.floor(Date.now() / 1000),
    };

    await expect(resolveFinanceAccess(mockDb, session)).rejects.toThrow('forbidden');
  });
});
