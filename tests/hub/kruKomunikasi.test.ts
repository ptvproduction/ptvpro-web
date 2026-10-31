import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_CREW_FIXTURES,
} from '@products/hub/kru/mock/crewMockData';
import {
  groupCrewByAngkatan,
  crewStore,
} from '@products/hub/kru/kruStore';
import { CrewMember } from '@products/hub/kru/types';
import {
  getCrewPermissionContext,
  getCrewEffectiveCapabilities,
  getAccessibleModulesForCrew,
  getAccessProfileSummary,
  mapRoleToAccessProfile,
  mapAccessProfileToRole,
} from '@products/hub/kru/utils/crewPermissions';
import { hasCapability, PROFILE_CAPABILITIES } from '@core/policy';
import {
  INITIAL_DOCS_FIXTURES,
} from '@products/hub/dokumen-saya/mock/docsMockData';
import {
  docsStore,
} from '@products/hub/dokumen-saya/docsStore';
import {
  INITIAL_EXTERNAL_CONTACTS,
  ExternalContact,
} from '@products/hub/kontak-eksternal/mock/kontakEksternalMockData';
import {
  externalContactsStore,
} from '@products/hub/kontak-eksternal/kontakEksternalStore';
import {
  INITIAL_INTERNAL_CONTACTS,
} from '@products/hub/kontak/mock/internalContactMockData';
import {
  internalContactStore,
} from '@products/hub/kontak/internalContactStore';

// Setup memory-based localStorage mock if running in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('Modul Kru & Komunikasi — Shared Crew Store & Data Separation', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
  });

  it('harus memuat fixtures awal dengan data kru yang valid dan lengkap', () => {
    expect(INITIAL_CREW_FIXTURES.length).toBeGreaterThanOrEqual(10);
    const zidna = INITIAL_CREW_FIXTURES.find((c) => c.ptv_id === 'PTV-001');
    expect(zidna).toBeDefined();
    expect(zidna?.full_name).toBe('M. Zidna Ilma Roup');
    expect(zidna?.status_kru).toBe('Aktif');
    expect(zidna?.status_akun).toBe('Aktif');
  });

  it('harus membedakan status keanggotaan kru dan status akun portal secara tegas', () => {
    // Cari alumni yang nonaktif di organisasi tetapi akunnya masih aktif/ada
    const alumni = INITIAL_CREW_FIXTURES.find((c) => c.status_kru === 'Nonaktif');
    expect(alumni).toBeDefined();
    expect(alumni?.status_kru).toBe('Nonaktif');
    // Akun portal terpisah dari keanggotaan
    expect(['Aktif', 'Nonaktif', 'Belum Ada Akun']).toContain(alumni?.status_akun);
  });

  it('harus mengelompokkan kru berdasarkan angkatan dengan helper groupCrewByAngkatan', () => {
    const groups = groupCrewByAngkatan(INITIAL_CREW_FIXTURES);
    expect(groups.length).toBeGreaterThan(0);
    
    // Pastikan grup memiliki label dan anggota
    for (const g of groups) {
      expect(g.label).toBeDefined();
      expect(g.members.length).toBeGreaterThan(0);
    }

    // Anggota angkatan 10 harus terkumpul bersama
    const angkatan10Group = groups.find((g) => g.label.includes('10'));
    expect(angkatan10Group).toBeDefined();
    expect(angkatan10Group?.members.some((m) => m.ptv_id === 'PTV-001')).toBe(true);
  });

  it('harus menghasilkan saran ID PTV berikutnya secara otomatis', () => {
    const nextId = crewStore.getSuggestedNextPtvId();
    expect(nextId).toMatch(/^PTV-\d{3}$/);
  });

  it('harus dapat menambah kru baru, toggle status, dan mutasi tersimpan di store', () => {
    const initialCount = crewStore.getAll().length;

    const newCrew: Omit<CrewMember, 'id'> = {
      ptv_id: 'PTV-999',
      full_name: 'Kru Testing Baru',
      username: 'testingkru',
      role: 'kru',
      category: 'Kru',
      division: 'Production',
      position: 'Cameraman',
      angkatan: '12',
      status_kru: 'Aktif',
      status_akun: 'Belum Ada Akun',
    };

    const added = crewStore.addCrew(newCrew);
    expect(added.id).toBeDefined();
    expect(crewStore.getAll().length).toBe(initialCount + 1);

    // Toggle status keanggotaan
    crewStore.toggleCrewStatus(added.id);
    const toggled = crewStore.getById(added.id);
    expect(toggled?.status_kru).toBe('Nonaktif');

    // Aktivasi akun
    crewStore.activateAccount(added.id);
    const activated = crewStore.getById(added.id);
    expect(activated?.status_akun).toBe('Aktif');

    // Tautkan OAuth Email
    crewStore.updateOAuthEmail(added.id, 'kru.testing@gmail.com');
    const withOauth = crewStore.getById(added.id);
    expect(withOauth?.oauth_email).toBe('kru.testing@gmail.com');

    // Hapus kru
    crewStore.deleteCrew(added.id);
    expect(crewStore.getAll().length).toBe(initialCount);
  });
});

describe('Modul Dokumen Saya — Persuratan Resmi & Timeline Verifikasi', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('harus memuat fixtures dokumen resmi dengan nomor dan status', () => {
    expect(INITIAL_DOCS_FIXTURES.length).toBeGreaterThan(0);
    const docWithOfficialNo = INITIAL_DOCS_FIXTURES.find((d) => d.status === 'Disetujui');
    expect(docWithOfficialNo).toBeDefined();
    expect(docWithOfficialNo?.no).toMatch(/(ST|SI)-PTV/);
  });

  it('harus menyetujui dokumen dan menerbitkan nomor resmi jika belum ada', () => {
    const pendingDoc = docsStore.getAll().find((d) => d.status === 'Menunggu');
    if (pendingDoc) {
      docsStore.approveDoc(pendingDoc.id);
      const approved = docsStore.getById(pendingDoc.id);
      expect(approved?.status).toBe('Disetujui');
      expect(approved?.no).toMatch(/PTV/);
    }
  });

  it('harus dapat menolak dan menghapus dokumen', () => {
    const allDocs = docsStore.getAll();
    const initialCount = allDocs.length;
    const docToReject = allDocs[0];
    expect(docToReject).toBeDefined();

    const rejected = docsStore.rejectDoc(docToReject.id);
    expect(rejected?.status).toBe('Ditolak');

    docsStore.deleteDoc(docToReject.id);
    expect(docsStore.getAll().length).toBe(initialCount - 1);
  });
});

describe('Modul Kontak Eksternal — Direktori Lembaga & Filtering Counter', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('harus memuat fixtures kontak eksternal mencakup berbagai lembaga', () => {
    expect(INITIAL_EXTERNAL_CONTACTS.length).toBeGreaterThanOrEqual(5);
    const lembagas = new Set(INITIAL_EXTERNAL_CONTACTS.map((c) => c.lembaga));
    expect(lembagas.has('Pondok')).toBe(true);
    expect(lembagas.has('Sekolah')).toBe(true);
    expect(lembagas.has('Yayasan')).toBe(true);
    expect(lembagas.has('Mitra')).toBe(true);
  });

  it('harus dapat melakukan penambahan, pembaruan, dan penghapusan kontak eksternal', () => {
    const initialCount = externalContactsStore.getAll().length;

    const newContact: Omit<ExternalContact, 'id'> = {
      nama: 'Ustadz Ahmad Fauzi',
      lembaga: 'Pondok',
      kategori: 'Pengasuh',
      jabatan: 'Koordinator Dakwah',
      organisasi: 'PP. Sunan Drajat',
      nomor_telepon: '081234567899',
      whatsapp: '081234567899',
      email: 'fauzi@drajat.id',
      alamat: 'Lamongan',
      catatan: 'Kontak koordinasi ceramah',
      status: 'Aktif',
    };

    const added = externalContactsStore.addContact(newContact);
    expect(added.id).toBeDefined();
    expect(externalContactsStore.getAll().length).toBe(initialCount + 1);

    // Update kontak
    externalContactsStore.updateContact(added.id, { jabatan: 'Ketua Majelis Taklim' });
    const updated = externalContactsStore.getById(added.id);
    expect(updated?.jabatan).toBe('Ketua Majelis Taklim');

    // Delete kontak
    externalContactsStore.deleteContact(added.id);
    expect(externalContactsStore.getAll().length).toBe(initialCount);
  });
});

describe('Modul Kontak Internal — Koreksi Arsitektur & Pemisahan Kontak vs Anggota Kru', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
    internalContactStore.resetToFixtures();
  });

  it('Skenario 1: Seorang kiai (KH. Agoes Ali Masyhuri) muncul di Kontak Internal murni sebagai kontak tanpa akun portal', () => {
    expect(INITIAL_INTERNAL_CONTACTS.length).toBeGreaterThanOrEqual(5);
    const contacts = internalContactStore.getAll();
    const gusAli = contacts.find((c) => c.full_name.includes('Agoes Ali Masyhuri'));
    expect(gusAli).toBeDefined();
    expect(['Pembina', 'Pengarah']).toContain(gusAli?.category);
    expect(gusAli?.position).toContain('Pengasuh');
    expect(gusAli?.unit).toContain('Pesantren');
    // Murni kontak: tidak memiliki tautan crew_id ke akun portal
    expect(gusAli?.crew_id).toBeUndefined();
    // Tidak ada username atau properti akun portal
    expect((gusAli as any).username).toBeUndefined();
    expect((gusAli as any).role).toBeUndefined();
    expect((gusAli as any).status_akun).toBeUndefined();
  });

  it('Skenario 2: Kiai tersebut tidak muncul sebagai anggota operasional PTV di Manajemen Kru', () => {
    const crewMembers = crewStore.getAll();
    const gusAliDiKru = crewMembers.find((c) => c.full_name.includes('Agoes Ali Masyhuri'));
    expect(gusAliDiKru).toBeUndefined();

    // Pastikan tidak ada akun login atau PTV ID untuk figur pengasuh di data kru
    const usernames = crewMembers.map((c) => c.username);
    expect(usernames).not.toContain('gus_ali');
  });

  it('Skenario 3: Anggota operasional PTV (M. Zidna Ilma Roup) muncul di Manajemen Kru dan Kontak Internal', () => {
    const crewMembers = crewStore.getAll();
    const zidnaKru = crewMembers.find((c) => c.ptv_id === 'PTV-001');
    expect(zidnaKru).toBeDefined();
    expect(zidnaKru?.full_name).toBe('M. Zidna Ilma Roup');

    const contacts = internalContactStore.getAll();
    const zidnaKontak = contacts.find((c) => c.crew_id === zidnaKru?.id);
    expect(zidnaKontak).toBeDefined();
    expect(zidnaKontak?.full_name).toBe('M. Zidna Ilma Roup');
    expect(zidnaKontak?.category).toBe('Pengurus');
  });

  it('Skenario 4: Perubahan nama kru di Manajemen Kru otomatis tercermin pada kontak terkait di Kontak Internal', () => {
    const zidnaKru = crewStore.getAll().find((c) => c.ptv_id === 'PTV-001');
    expect(zidnaKru).toBeDefined();

    // Ubah nama di Crew Store
    crewStore.updateCrew(zidnaKru!.id, { full_name: 'M. Zidna Ilma Roup, S.Kom.' });

    // Periksa apakah nama di Kontak Internal otomatis ikut tersinkronisasi
    const contacts = internalContactStore.getAll();
    const updatedKontak = contacts.find((c) => c.crew_id === zidnaKru!.id);
    expect(updatedKontak?.full_name).toBe('M. Zidna Ilma Roup, S.Kom.');
  });

  it('Skenario 5: Kontak Internal murni direktori komunikasi dan tidak menyediakan form/metode mutasi akun portal', () => {
    // internalContactStore tidak mengekspos metode manajemen akun seperti activateAccount, toggleCrewStatus, deleteCrew
    expect((internalContactStore as any).activateAccount).toBeUndefined();
    expect((internalContactStore as any).toggleCrewStatus).toBeUndefined();
    expect((internalContactStore as any).updateOAuthEmail).toBeUndefined();
  });

  it('Skenario 6: Manajemen Kru tetap memiliki fitur pengelolaan keanggotaan dan akun', () => {
    const kru = crewStore.getAll()[0];
    expect(crewStore.toggleCrewStatus).toBeDefined();
    expect(crewStore.activateAccount).toBeDefined();
    expect(crewStore.updateOAuthEmail).toBeDefined();
    expect(crewStore.deleteCrew).toBeDefined();

    // Kru operasional memiliki atribut keanggotaan lengkap
    expect(kru.ptv_id).toBeDefined();
    expect(kru.role).toBeDefined();
    expect(kru.status_kru).toBeDefined();
    expect(kru.status_akun).toBeDefined();
  });
});

describe('Modul Kru & Komunikasi — Role & Permission Management (RBAC)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
  });

  it('1. Default Permissions: Eksekutif memiliki bundel akses komprehensif dari profiles resmi', () => {
    const eksekutifProfile = PROFILE_CAPABILITIES['eksekutif'];
    expect(eksekutifProfile).toBeDefined();
    expect(eksekutifProfile.has('crew.permissions.manage')).toBe(true);
    expect(eksekutifProfile.has('crew.view')).toBe(true);
    expect(eksekutifProfile.has('inventory.create')).toBe(true);
    expect(eksekutifProfile.has('documents.approve')).toBe(true);
    expect(eksekutifProfile.has('finance.manage')).toBe(true);

    const eksekutifMember = INITIAL_CREW_FIXTURES.find((c) => c.role === 'eksekutif');
    expect(eksekutifMember).toBeDefined();
    const effectiveCaps = getCrewEffectiveCapabilities(eksekutifMember!);
    expect(effectiveCaps).toContain('crew.permissions.manage');
    expect(effectiveCaps).toContain('inventory.create');
  });

  it('2. Default Permissions: Administrasi (Kepolo/Kepali) berhak inventaris & persuratan, tetapi TIDAK mengelola hak akses', () => {
    const kepoloProfile = PROFILE_CAPABILITIES['kepolo_kepali'];
    expect(kepoloProfile.has('inventory.edit')).toBe(true);
    expect(kepoloProfile.has('documents.generate')).toBe(true);
    expect(kepoloProfile.has('crew.permissions.manage')).toBe(false);

    const adminMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[1],
      role: 'administrasi',
      assigned_profiles: ['kepolo_kepali'],
      status_akun: 'Aktif',
      status_kru: 'Aktif',
      allowed_overrides: [],
      denied_overrides: [],
    };

    const effective = getCrewEffectiveCapabilities(adminMember);
    expect(effective).toContain('inventory.edit');
    expect(effective).not.toContain('crew.permissions.manage');
  });

  it('3. Default Permissions: Kru biasa hanya memiliki izin operasional dasar', () => {
    const crewProfile = PROFILE_CAPABILITIES['crew'];
    expect(crewProfile.has('loans.checkout')).toBe(true);
    expect(crewProfile.has('damage.report')).toBe(true);
    expect(crewProfile.has('inventory.create')).toBe(false);
    expect(crewProfile.has('crew.permissions.manage')).toBe(false);

    const kruMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[2],
      role: 'kru',
      assigned_profiles: ['crew'],
      status_akun: 'Aktif',
      status_kru: 'Aktif',
      allowed_overrides: [],
      denied_overrides: [],
    };

    const effective = getCrewEffectiveCapabilities(kruMember);
    expect(effective).toContain('loans.checkout');
    expect(effective).not.toContain('inventory.create');
    expect(effective).not.toContain('crew.permissions.manage');
  });

  it('4. Custom Permissions: allowed_overrides memberikan izin tambahan melampaui role bawaan', () => {
    const kruMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[2],
      role: 'kru',
      assigned_profiles: ['crew'],
      status_akun: 'Aktif',
      status_kru: 'Aktif',
      allowed_overrides: ['inventory.create', 'events.create'],
      denied_overrides: [],
    };

    const effective = getCrewEffectiveCapabilities(kruMember);
    // Bawaan role crew tidak punya inventory.create, tetapi karena override allow menjadi aktif
    expect(effective).toContain('inventory.create');
    expect(effective).toContain('events.create');
  });

  it('5. Custom Permissions: denied_overrides mencabut izin meskipun ada di profil bawaan (Prioritas Tertinggi)', () => {
    const eksekutifMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[0],
      role: 'eksekutif',
      assigned_profiles: ['eksekutif'],
      status_akun: 'Aktif',
      status_kru: 'Aktif',
      allowed_overrides: [],
      denied_overrides: ['finance.manage', 'inventory.delete'],
    };

    const effective = getCrewEffectiveCapabilities(eksekutifMember);
    // Eksekutif default punya finance.manage, tetapi denied_overrides mengalahkannya
    expect(effective).not.toContain('finance.manage');
    expect(effective).not.toContain('inventory.delete');
    expect(effective).toContain('inventory.create'); // Sisa izin lain tetap aktif
  });

  it('6. Perubahan Role & Assignment via crewStore.updateCrewPermissions tersimpan secara reaktif', () => {
    const target = crewStore.getAll()[3];
    expect(target).toBeDefined();

    // Promosikan kru menjadi administrasi dengan override izin
    const updated = crewStore.updateCrewPermissions(target.id, {
      role: 'administrasi',
      assigned_profiles: ['kepolo_kepali'],
      allowed_overrides: ['inventory.valuation.view'],
      denied_overrides: ['loans.manage'],
    });

    expect(updated).toBeDefined();
    expect(updated?.role).toBe('administrasi');
    expect(updated?.assigned_profiles).toContain('kepolo_kepali');
    expect(updated?.allowed_overrides).toContain('inventory.valuation.view');
    expect(updated?.denied_overrides).toContain('loans.manage');

    // Periksa pengambilan ulang dari store
    const refetched = crewStore.getAll().find((c) => c.id === target.id);
    expect(refetched?.role).toBe('administrasi');
    expect(refetched?.allowed_overrides).toContain('inventory.valuation.view');
  });

  it('7. Effective Permission Calculation & Modul Terbuka terhitung presisi', () => {
    const zidna = crewStore.getAll().find((c) => c.ptv_id === 'PTV-001');
    expect(zidna).toBeDefined();

    const modules = getAccessibleModulesForCrew(zidna!);
    expect(modules.length).toBeGreaterThanOrEqual(10);
    const inventarisModule = modules.find((m) => m.moduleId === 'inventory');
    expect(inventarisModule).toBeDefined();
    expect(inventarisModule!.allowedCount).toBeGreaterThan(0);
  });

  it('8. Fail-Closed: Akun dengan status Nonaktif atau Belum Ada Akun menolak SELURUH hak akses', () => {
    const nonaktifMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[0],
      status_akun: 'Nonaktif',
      role: 'eksekutif',
      assigned_profiles: ['eksekutif'],
      allowed_overrides: ['inventory.create'],
    };

    const effective = getCrewEffectiveCapabilities(nonaktifMember);
    expect(effective.length).toBe(0); // FAIL-CLOSED: 0 capabilities aktif

    const ctx = getCrewPermissionContext(nonaktifMember);
    expect(hasCapability(ctx, 'inventory.view')).toBe(false);
    expect(hasCapability(ctx, 'crew.view')).toBe(false);
  });

  it('9. Status Kru Nonaktif di Organisasi membatasi mutasi menjadi read-only (Mutation Blocked)', () => {
    const alumniMember: CrewMember = {
      ...INITIAL_CREW_FIXTURES[0],
      status_akun: 'Aktif',
      status_kru: 'Nonaktif',
      status_organisasi: 'inactive',
      role: 'eksekutif',
      assigned_profiles: ['eksekutif'],
    };

    const ctx = getCrewPermissionContext(alumniMember);
    // Read-only diizinkan
    expect(hasCapability(ctx, 'inventory.view')).toBe(true);
    expect(hasCapability(ctx, 'crew.view')).toBe(true);
    // Mutasi ditolak untuk status organisasi inactive
    expect(hasCapability(ctx, 'inventory.create')).toBe(false);
    expect(hasCapability(ctx, 'inventory.edit')).toBe(false);
    expect(hasCapability(ctx, 'crew.create')).toBe(false);
  });

  it('10. Kontak tanpa akun tidak mendapatkan permissions', () => {
    // Personel yang belum memiliki akun
    const guestCrew: CrewMember = {
      ...INITIAL_CREW_FIXTURES[0],
      username: '',
      status_akun: 'Belum Ada Akun',
    };

    const effective = getCrewEffectiveCapabilities(guestCrew);
    expect(effective.length).toBe(0);
  });

  it('11. Mapping Role <-> AccessProfile konsisten dan tidak ambigu', () => {
    expect(mapRoleToAccessProfile('eksekutif')).toBe('eksekutif');
    expect(mapRoleToAccessProfile('administrasi')).toBe('kepolo_kepali');
    expect(mapRoleToAccessProfile('kru')).toBe('crew');

    expect(mapAccessProfileToRole('eksekutif')).toBe('eksekutif');
    expect(mapAccessProfileToRole('root_executive')).toBe('eksekutif');
    expect(mapAccessProfileToRole('kepolo_kepali')).toBe('administrasi');
    expect(mapAccessProfileToRole('crew')).toBe('kru');
    expect(mapAccessProfileToRole('pembina')).toBe('kru');

    const summary = getAccessProfileSummary('eksekutif');
    expect(summary.label).toBe('Eksekutif');
    expect(summary.defaultCapabilityCount).toBeGreaterThan(30);
  });
});


