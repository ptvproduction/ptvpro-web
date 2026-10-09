import { describe, it, expect } from 'vitest';

interface LegacyRow {
  id: number;
  crew_id: string;
  nama: string;
  username: string;
  password_hash: string | null;
  oauth_email: string | null;
  telepon: string | null;
  no_wa: string | null;
  email: string | null;
  divisi: string | null;
  jabatan: string;
  angkatan: number | null;
  status: 'aktif' | 'alumni' | 'nonaktif';
  role: string;
}

interface CanonicalStore {
  identities: Map<string, { id: string; ptv_id: string; full_name: string; legacy_id: number }>;
  contacts: Map<string, { phone: string | null; whatsapp: string | null; email_personal: string | null }>;
  accounts: Map<string, { id: string; identity_id: string; username: string; status_akun: 'active' | 'inactive' }>;
  credentials: Map<string, { password_hash: string | null; oauth_email: string | null }>;
  memberships: Map<string, { identity_id: string; division_id: string; position_title: string; cohort: number | null; status_organisasi: 'active' | 'inactive' | 'archived' }>;
  profiles: Map<string, string[]>;
}

function createCanonicalStore(): CanonicalStore {
  return {
    identities: new Map(),
    contacts: new Map(),
    accounts: new Map(),
    credentials: new Map(),
    memberships: new Map(),
    profiles: new Map(),
  };
}

// Simulates ptv_kru_legacy_compat SELECT view
function viewSelectLegacy(store: CanonicalStore, ptv_id: string): LegacyRow | null {
  const identity = store.identities.get(ptv_id);
  if (!identity) return null;

  const contact = store.contacts.get(identity.id) || { phone: null, whatsapp: null, email_personal: null };
  const account = Array.from(store.accounts.values()).find(a => a.identity_id === identity.id);
  const membership = store.memberships.get(identity.id);
  const creds = account ? store.credentials.get(account.id) : null;
  const userProfiles = account ? store.profiles.get(account.id) || ['crew'] : ['crew'];

  let legacyStatus: 'aktif' | 'alumni' | 'nonaktif' = 'nonaktif';
  if (membership?.status_organisasi === 'active' && account?.status_akun === 'active') {
    legacyStatus = 'aktif';
  } else if (membership?.status_organisasi === 'inactive' && account?.status_akun === 'active') {
    legacyStatus = 'alumni';
  }

  return {
    id: identity.legacy_id,
    crew_id: identity.ptv_id,
    nama: identity.full_name,
    username: account?.username || '',
    password_hash: creds?.password_hash || null,
    oauth_email: creds?.oauth_email || null,
    telepon: contact.phone,
    no_wa: contact.whatsapp,
    email: contact.email_personal,
    divisi: membership?.division_id || null,
    jabatan: membership?.position_title || 'Anggota Divisi',
    angkatan: membership?.cohort || null,
    status: legacyStatus,
    role: userProfiles[0] || 'crew',
  };
}

// Simulates INSTEAD OF UPDATE trigger on view
function viewUpdateLegacy(store: CanonicalStore, crew_id: string, updates: Partial<LegacyRow>): boolean {
  const identity = store.identities.get(crew_id);
  if (!identity) return false;

  // 1. Update identity
  if (updates.nama) identity.full_name = updates.nama;

  // 2. Update contact
  const contact = store.contacts.get(identity.id) || { phone: null, whatsapp: null, email_personal: null };
  if (updates.telepon !== undefined) contact.phone = updates.telepon;
  if (updates.no_wa !== undefined) contact.whatsapp = updates.no_wa;
  if (updates.email !== undefined) contact.email_personal = updates.email;
  store.contacts.set(identity.id, contact);

  // 3. Update account & credentials
  const account = Array.from(store.accounts.values()).find(a => a.identity_id === identity.id);
  if (account) {
    if (updates.username) account.username = updates.username;

    // Status mapping translation
    if (updates.status === 'aktif') {
      account.status_akun = 'active';
    } else if (updates.status === 'alumni') {
      account.status_akun = 'active';
    } else if (updates.status === 'nonaktif') {
      account.status_akun = 'inactive';
    }

    if (updates.role) {
      const canonicalRole = updates.role === 'admin' ? 'eksekutif' : updates.role;
      store.profiles.set(account.id, [canonicalRole]);
    }
  }

  // 4. Update membership
  const membership = store.memberships.get(identity.id);
  if (membership) {
    if (updates.divisi !== undefined && updates.divisi !== null) membership.division_id = updates.divisi;
    if (updates.jabatan) membership.position_title = updates.jabatan;
    if (updates.status === 'aktif') {
      membership.status_organisasi = 'active';
    } else if (updates.status === 'alumni' || updates.status === 'nonaktif') {
      membership.status_organisasi = 'inactive';
    }
  }

  return true;
}

// Simulates INSTEAD OF INSERT trigger on view
function viewInsertLegacy(store: CanonicalStore, newRow: LegacyRow): { success: boolean; error?: string } {
  // Check uniqueness constraints
  if (store.identities.has(newRow.crew_id)) {
    return { success: false, error: 'DUPLICATE_PTV_ID' };
  }
  const existingUsername = Array.from(store.accounts.values()).find(
    a => a.username.toLowerCase() === newRow.username.toLowerCase()
  );
  if (existingUsername) {
    return { success: false, error: 'DUPLICATE_USERNAME' };
  }

  const identityId = 'id-' + newRow.crew_id;
  const accountId = 'acc-' + newRow.crew_id;

  // Insert identity
  store.identities.set(newRow.crew_id, {
    id: identityId,
    ptv_id: newRow.crew_id,
    full_name: newRow.nama,
    legacy_id: newRow.id,
  });

  // Insert contact
  store.contacts.set(identityId, {
    phone: newRow.telepon,
    whatsapp: newRow.no_wa,
    email_personal: newRow.email,
  });

  // Insert account
  store.accounts.set(accountId, {
    id: accountId,
    identity_id: identityId,
    username: newRow.username,
    status_akun: newRow.status === 'nonaktif' ? 'inactive' : 'active',
  });

  // Insert credentials
  store.credentials.set(accountId, {
    password_hash: newRow.password_hash,
    oauth_email: newRow.oauth_email,
  });

  // Insert membership
  store.memberships.set(identityId, {
    identity_id: identityId,
    division_id: newRow.divisi || 'technical',
    position_title: newRow.jabatan,
    cohort: newRow.angkatan,
    status_organisasi: newRow.status === 'aktif' ? 'active' : 'inactive',
  });

  // Assign profile
  const profileId = newRow.role === 'admin' ? 'eksekutif' : newRow.role;
  store.profiles.set(accountId, [profileId]);

  return { success: true };
}

describe('Phase 5B — Legacy Compatibility View Harness (ptv_kru_legacy_compat)', () => {
  it('1. SELECT translation joins canonical tables into legacy 1:1 format', () => {
    const store = createCanonicalStore();
    viewInsertLegacy(store, {
      id: 101,
      crew_id: 'PTV-025',
      nama: 'Ahmad Farid',
      username: 'farid',
      password_hash: '$2y$10$abcdef',
      oauth_email: 'farid@progresiftv.id',
      telepon: '08123456789',
      no_wa: '08123456789',
      email: 'farid@personal.com',
      divisi: 'technical',
      jabatan: 'Ketua Technical',
      angkatan: 2024,
      status: 'aktif',
      role: 'eksekutif',
    });

    const legacyView = viewSelectLegacy(store, 'PTV-025');
    expect(legacyView).not.toBeNull();
    expect(legacyView?.crew_id).toBe('PTV-025');
    expect(legacyView?.nama).toBe('Ahmad Farid');
    expect(legacyView?.username).toBe('farid');
    expect(legacyView?.status).toBe('aktif');
    expect(legacyView?.role).toBe('eksekutif');
    expect(legacyView?.telepon).toBe('08123456789');
  });

  it('2. INSTEAD OF UPDATE trigger distributes writes cleanly across normalized tables', () => {
    const store = createCanonicalStore();
    viewInsertLegacy(store, {
      id: 102,
      crew_id: 'PTV-030',
      nama: 'Budi Santoso',
      username: 'budi',
      password_hash: '$2y$10$hash',
      oauth_email: null,
      telepon: '08111',
      no_wa: '08111',
      email: 'budi@test.com',
      divisi: 'editor',
      jabatan: 'Anggota Divisi',
      angkatan: 2023,
      status: 'aktif',
      role: 'crew',
    });

    // Execute update from legacy perspective
    const ok = viewUpdateLegacy(store, 'PTV-030', {
      nama: 'Budi Santoso S.Kom',
      telepon: '089999999',
      status: 'alumni', // transition to alumni
    });
    expect(ok).toBe(true);

    // Verify canonical state
    const identity = store.identities.get('PTV-030');
    expect(identity?.full_name).toBe('Budi Santoso S.Kom');

    const contact = store.contacts.get(identity!.id);
    expect(contact?.phone).toBe('089999999');

    // Alumni status check: account remains active, org becomes inactive!
    const account = Array.from(store.accounts.values()).find(a => a.identity_id === identity!.id);
    const membership = store.memberships.get(identity!.id);
    expect(account?.status_akun).toBe('active');
    expect(membership?.status_organisasi).toBe('inactive');

    // View returns 'alumni'
    const updatedView = viewSelectLegacy(store, 'PTV-030');
    expect(updatedView?.status).toBe('alumni');
  });

  it('3. INSTEAD OF INSERT trigger rejects duplicates and rolls back cleanly', () => {
    const store = createCanonicalStore();
    const result1 = viewInsertLegacy(store, {
      id: 201,
      crew_id: 'PTV-099',
      nama: 'Original Crew',
      username: 'orig',
      password_hash: null,
      oauth_email: null,
      telepon: null,
      no_wa: null,
      email: null,
      divisi: 'technical',
      jabatan: 'Anggota',
      angkatan: 2024,
      status: 'aktif',
      role: 'crew',
    });
    expect(result1.success).toBe(true);

    // Duplicate PTV ID attempt
    const result2 = viewInsertLegacy(store, {
      id: 202,
      crew_id: 'PTV-099', // DUPLICATE!
      nama: 'Imposter Crew',
      username: 'imposter',
      password_hash: null,
      oauth_email: null,
      telepon: null,
      no_wa: null,
      email: null,
      divisi: 'technical',
      jabatan: 'Anggota',
      angkatan: 2024,
      status: 'aktif',
      role: 'crew',
    });
    expect(result2.success).toBe(false);
    expect(result2.error).toBe('DUPLICATE_PTV_ID');

    // Duplicate Username attempt
    const result3 = viewInsertLegacy(store, {
      id: 203,
      crew_id: 'PTV-100',
      nama: 'Another Crew',
      username: 'orig', // DUPLICATE USERNAME!
      password_hash: null,
      oauth_email: null,
      telepon: null,
      no_wa: null,
      email: null,
      divisi: 'technical',
      jabatan: 'Anggota',
      angkatan: 2024,
      status: 'aktif',
      role: 'crew',
    });
    expect(result3.success).toBe(false);
    expect(result3.error).toBe('DUPLICATE_USERNAME');
  });
});
