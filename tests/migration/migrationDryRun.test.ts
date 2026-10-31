import { describe, it, expect } from 'vitest';

interface LegacyCrewFixture {
  id: number;
  crew_id: string;
  nama: string;
  username: string;
  password_hash: string | null;
  oauth_email: string | null;
  telepon: string | null;
  email: string | null;
  divisi: string | null;
  jabatan: string | null;
  status: string;
  role: string;
}

interface ValidationIssue {
  fixtureId: number;
  crew_id: string;
  field: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

interface DryRunReport {
  totalProcessed: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

function executeMigrationDryRun(fixtures: LegacyCrewFixture[]): DryRunReport {
  const seenPtvIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenOAuth = new Set<string>();
  const issues: ValidationIssue[] = [];
  let validCount = 0;

  const validDivisions = new Set(['technical', 'editor', 'layouter', 'creative', 'engagements']);
  const validRoles = new Set(['admin', 'eksekutif', 'kepolo', 'kepolo_kepali', 'crew', 'pembina']);

  for (const item of fixtures) {
    let itemHasError = false;

    // 1. PTV ID Format check
    if (!/^PTV-\d{3,}$/i.test(item.crew_id) && item.crew_id !== 'PTV-ROOT') {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'crew_id',
        severity: 'ERROR',
        code: 'MALFORMED_PTV_ID',
        message: `PTV ID '${item.crew_id}' does not match standard pattern PTV-xxx`,
      });
      itemHasError = true;
    }

    // 2. Duplicate PTV ID
    if (seenPtvIds.has(item.crew_id.toUpperCase())) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'crew_id',
        severity: 'ERROR',
        code: 'DUPLICATE_PTV_ID',
        message: `Duplicate PTV ID '${item.crew_id}' detected`,
      });
      itemHasError = true;
    } else {
      seenPtvIds.add(item.crew_id.toUpperCase());
    }

    // 3. Duplicate Username
    const lowerUsername = item.username.toLowerCase();
    if (seenUsernames.has(lowerUsername)) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'username',
        severity: 'ERROR',
        code: 'DUPLICATE_USERNAME',
        message: `Duplicate username '${item.username}' detected`,
      });
      itemHasError = true;
    } else {
      seenUsernames.add(lowerUsername);
    }

    // 4. Password Hash Inspection (ND-001)
    if (!item.password_hash) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'password_hash',
        severity: 'WARNING',
        code: 'MISSING_PASSWORD_HASH',
        message: 'Password hash is empty; account requires administrative provisioning',
      });
    } else if (!item.password_hash.startsWith('$2y$') && !item.password_hash.startsWith('$2b$')) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'password_hash',
        severity: 'WARNING',
        code: 'LEGACY_HASH_NEEDS_REHASH',
        message: 'Password hash is not standard Bcrypt; flagged for automatic rehash on login',
      });
    }

    // 5. Duplicate OAuth Email
    if (item.oauth_email) {
      const lowerOauth = item.oauth_email.toLowerCase();
      if (seenOAuth.has(lowerOauth)) {
        issues.push({
          fixtureId: item.id,
          crew_id: item.crew_id,
          field: 'oauth_email',
          severity: 'ERROR',
          code: 'DUPLICATE_OAUTH',
          message: `OAuth identity '${item.oauth_email}' already linked to another account`,
        });
        itemHasError = true;
      } else {
        seenOAuth.add(lowerOauth);
      }
    }

    // 6. Contact warnings
    if (!item.telepon) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'telepon',
        severity: 'WARNING',
        code: 'MISSING_PHONE',
        message: 'Personal telephone number is missing in legacy record',
      });
    }
    if (!item.email) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'email',
        severity: 'WARNING',
        code: 'MISSING_EMAIL',
        message: 'Personal email is missing in legacy record',
      });
    }

    // 7. Unknown Role
    if (!validRoles.has(item.role.toLowerCase())) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'role',
        severity: 'ERROR',
        code: 'UNKNOWN_ROLE',
        message: `Unknown legacy role '${item.role}' cannot be mapped to canonical access profile`,
      });
      itemHasError = true;
    }

    // 8. Unknown Division
    if (item.divisi && !validDivisions.has(item.divisi.toLowerCase())) {
      issues.push({
        fixtureId: item.id,
        crew_id: item.crew_id,
        field: 'divisi',
        severity: 'WARNING',
        code: 'UNKNOWN_DIVISION',
        message: `Legacy division '${item.divisi}' mapped to default technical division`,
      });
    }

    if (!itemHasError) {
      validCount++;
    }
  }

  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;

  return {
    totalProcessed: fixtures.length,
    validCount,
    errorCount,
    warningCount,
    issues,
  };
}

describe('Phase 5B — Migration Dry-Run & Reconciliation Harness', () => {
  const fixtures: LegacyCrewFixture[] = [
    // 1. Valid legacy crew
    {
      id: 1,
      crew_id: 'PTV-001',
      nama: 'Zidnal Falah',
      username: 'zidnal',
      password_hash: '$2y$10$abcdefghijklmnopqrstuvwxyz123456',
      oauth_email: 'zidnal@progresiftv.id',
      telepon: '081234567890',
      email: 'zidnal@gmail.com',
      divisi: 'technical',
      jabatan: 'Ketua Umum',
      status: 'aktif',
      role: 'eksekutif',
    },
    // 2. Duplicate crew_id
    {
      id: 2,
      crew_id: 'PTV-001', // DUPLICATE!
      nama: 'Zidnal Imposter',
      username: 'imposter1',
      password_hash: '$2y$10$abcdefghijklmnopqrstuvwxyz123456',
      oauth_email: null,
      telepon: '0811111111',
      email: 'imposter@test.com',
      divisi: 'technical',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 3. Duplicate username
    {
      id: 3,
      crew_id: 'PTV-002',
      nama: 'Second Crew',
      username: 'ZIDNAL', // DUPLICATE USERNAME (case insensitive)
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0822222222',
      email: 'second@test.com',
      divisi: 'editor',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 4. Inactive crew
    {
      id: 4,
      crew_id: 'PTV-003',
      nama: 'Inactive Person',
      username: 'inactive_user',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0833333333',
      email: 'inactive@test.com',
      divisi: 'editor',
      jabatan: 'Alumni',
      status: 'nonaktif',
      role: 'crew',
    },
    // 5. Archived-like legacy record
    {
      id: 5,
      crew_id: 'PTV-004',
      nama: 'Archived Alumni',
      username: 'alumni_2020',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0844444444',
      email: 'alumni@test.com',
      divisi: 'layouter',
      jabatan: 'Alumni',
      status: 'alumni',
      role: 'crew',
    },
    // 6. Missing phone
    {
      id: 6,
      crew_id: 'PTV-005',
      nama: 'No Phone Crew',
      username: 'nophone',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: null, // MISSING
      email: 'nophone@test.com',
      divisi: 'creative',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 7. Missing email
    {
      id: 7,
      crew_id: 'PTV-006',
      nama: 'No Email Crew',
      username: 'noemail',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0855555555',
      email: null, // MISSING
      divisi: 'creative',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 8. Invalid/legacy password hash (e.g. MD5 or old phpass)
    {
      id: 8,
      crew_id: 'PTV-007',
      nama: 'Old Hash Crew',
      username: 'oldhash',
      password_hash: '5f4dcc3b5aa765d61d8327deb882cf99', // MD5!
      oauth_email: null,
      telepon: '0866666666',
      email: 'oldhash@test.com',
      divisi: 'engagements',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 9. Unknown role
    {
      id: 9,
      crew_id: 'PTV-008',
      nama: 'Unknown Role Crew',
      username: 'weirdrole',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0877777777',
      email: 'weird@test.com',
      divisi: 'technical',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'super_admin_custom', // UNKNOWN!
    },
    // 10. Unknown division
    {
      id: 10,
      crew_id: 'PTV-009',
      nama: 'Unknown Div Crew',
      username: 'unknowndiv',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0888888888',
      email: 'unknowndiv@test.com',
      divisi: 'catering_dapur', // UNKNOWN DIVISION
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 11. Duplicate OAuth identity
    {
      id: 11,
      crew_id: 'PTV-010',
      nama: 'OAuth Collide Crew',
      username: 'oauth_collide',
      password_hash: '$2y$10$hash',
      oauth_email: 'zidnal@progresiftv.id', // DUPLICATE OAUTH with fixture 1!
      telepon: '0899999999',
      email: 'collide@test.com',
      divisi: 'technical',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
    // 12. Malformed PTV ID
    {
      id: 12,
      crew_id: 'KRU-INVALID-99', // MALFORMED PTV ID
      nama: 'Bad ID Crew',
      username: 'badid',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '0812121212',
      email: 'badid@test.com',
      divisi: 'technical',
      jabatan: 'Anggota',
      status: 'aktif',
      role: 'crew',
    },
  ];

  it('1. Dry run deterministically catches all 5 severe migration errors', () => {
    const report = executeMigrationDryRun(fixtures);

    expect(report.totalProcessed).toBe(12);

    // Errors caught:
    // - Fixture 2: DUPLICATE_PTV_ID
    // - Fixture 3: DUPLICATE_USERNAME
    // - Fixture 9: UNKNOWN_ROLE
    // - Fixture 11: DUPLICATE_OAUTH
    // - Fixture 12: MALFORMED_PTV_ID
    const errorCodes = report.issues.filter(i => i.severity === 'ERROR').map(i => i.code);
    expect(errorCodes).toContain('DUPLICATE_PTV_ID');
    expect(errorCodes).toContain('DUPLICATE_USERNAME');
    expect(errorCodes).toContain('UNKNOWN_ROLE');
    expect(errorCodes).toContain('DUPLICATE_OAUTH');
    expect(errorCodes).toContain('MALFORMED_PTV_ID');
    expect(report.errorCount).toBe(5);
  });

  it('2. Dry run identifies non-fatal warnings for data enhancement without blocking import', () => {
    const report = executeMigrationDryRun(fixtures);

    // Warnings caught:
    // - Missing phone (Fixture 6)
    // - Missing email (Fixture 7)
    // - Legacy hash flagged for auto-rehash (Fixture 8)
    // - Unknown division mapped to default (Fixture 10)
    const warningCodes = report.issues.filter(i => i.severity === 'WARNING').map(i => i.code);
    expect(warningCodes).toContain('MISSING_PHONE');
    expect(warningCodes).toContain('MISSING_EMAIL');
    expect(warningCodes).toContain('LEGACY_HASH_NEEDS_REHASH');
    expect(warningCodes).toContain('UNKNOWN_DIVISION');
  });

  it('3. Reconciliation metric: Clean records successfully pass dry-run gate', () => {
    const report = executeMigrationDryRun(fixtures);
    // 12 total - 5 with errors = 7 valid records can be migrated cleanly
    expect(report.validCount).toBe(7);
  });
});
