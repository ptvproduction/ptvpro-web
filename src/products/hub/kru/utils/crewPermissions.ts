import {
  AppCapability,
  ALL_CAPABILITIES,
  AccessProfile,
  ACCESS_PROFILE_LABELS,
  PROFILE_CAPABILITIES,
  hasCapability,
  PermissionContext,
  AccountStatus,
  OrganizationStatus,
} from '@core/policy';
import { CrewMember, CrewRole } from '../types';

export interface ModuleCapabilityGroup {
  moduleId: string;
  moduleName: string;
  icon: string;
  capabilities: {
    capability: AppCapability;
    actionLabel: string;
    description: string;
  }[];
}

export const MODULE_CAPABILITY_GROUPS: ModuleCapabilityGroup[] = [
  {
    moduleId: 'inventory',
    moduleName: 'Inventaris',
    icon: 'fa-solid fa-boxes-stacked',
    capabilities: [
      { capability: 'inventory.view', actionLabel: 'Lihat Katalog', description: 'Melihat daftar master alat dan status ketersediaan' },
      { capability: 'inventory.create', actionLabel: 'Tambah Alat', description: 'Menambahkan master aset dan unit alat baru' },
      { capability: 'inventory.edit', actionLabel: 'Edit Alat', description: 'Memperbarui data teknis dan spesifikasi alat' },
      { capability: 'inventory.delete', actionLabel: 'Hapus Alat', description: 'Menghapus alat dari sistem inventaris' },
      { capability: 'inventory.units.manage', actionLabel: 'Kelola Unit Fisik', description: 'Mengubah status dan kondisi unit individual' },
      { capability: 'inventory.valuation.view', actionLabel: 'Lihat Nilai Aset', description: 'Melihat estimasi valuasi aset inventaris' },
      { capability: 'inventory.valuation.manage', actionLabel: 'Kelola Valuasi', description: 'Memperbarui harga perolehan dan nilai depresiasi' },
    ],
  },
  {
    moduleId: 'loans',
    moduleName: 'Peminjaman',
    icon: 'fa-solid fa-hand-holding-box',
    capabilities: [
      { capability: 'loans.view', actionLabel: 'Lihat Sirkulasi', description: 'Melihat transaksi peminjaman aktif dan riwayat' },
      { capability: 'loans.checkout', actionLabel: 'Pinjam Alat', description: 'Melakukan peminjaman alat untuk operasional' },
      { capability: 'loans.return', actionLabel: 'Kembalikan Alat', description: 'Memproses pengembalian unit alat' },
      { capability: 'loans.manage', actionLabel: 'Kelola Transaksi', description: 'Otorisasi pengembalian terlambat dan pembatalan' },
    ],
  },
  {
    moduleId: 'damage',
    moduleName: 'Lapor Kerusakan',
    icon: 'fa-solid fa-screwdriver-wrench',
    capabilities: [
      { capability: 'damage.view', actionLabel: 'Lihat Laporan', description: 'Melihat log kerusakan dan status perbaikan' },
      { capability: 'damage.report', actionLabel: 'Buat Laporan', description: 'Melaporkan kerusakan alat lapangan' },
      { capability: 'damage.qc.approve', actionLabel: 'QC & Approval', description: 'Menyetujui penyelesaian perbaikan unit' },
    ],
  },
  {
    moduleId: 'lostfound',
    moduleName: 'Lost & Found',
    icon: 'fa-solid fa-box-archive',
    capabilities: [
      { capability: 'lostfound.view', actionLabel: 'Lihat Barang', description: 'Melihat daftar temuan dan barang hilang' },
      { capability: 'lostfound.report', actionLabel: 'Lapor Temuan', description: 'Mendaftarkan barang hilang atau tertinggal' },
      { capability: 'lostfound.manage', actionLabel: 'Klaim & Arsip', description: 'Memproses verifikasi klaim kepemilikan' },
    ],
  },
  {
    moduleId: 'crew',
    moduleName: 'Manajemen Kru',
    icon: 'fa-solid fa-users',
    capabilities: [
      { capability: 'crew.view', actionLabel: 'Lihat Direktori Kru', description: 'Melihat profil dan riwayat anggota PTV' },
      { capability: 'crew.create', actionLabel: 'Tambah Personel', description: 'Mendaftarkan kru baru ke direktori' },
      { capability: 'crew.edit', actionLabel: 'Edit Profil Kru', description: 'Mengubah identitas dan jabatan kru' },
      { capability: 'crew.status.manage', actionLabel: 'Kelola Status', description: 'Mengubah status keanggotaan dan akun portal' },
      { capability: 'crew.permissions.manage', actionLabel: 'Kelola Hak Akses', description: 'Mengatur profil akses dan override izin' },
    ],
  },
  {
    moduleId: 'id',
    moduleName: 'ID Digital',
    icon: 'fa-solid fa-id-card',
    capabilities: [
      { capability: 'id.view', actionLabel: 'Lihat KTA Digital', description: 'Melihat kartu identitas kru' },
      { capability: 'id.export', actionLabel: 'Unduh KTA (PNG)', description: 'Mengekspor kartu identitas resolusi tinggi' },
    ],
  },
  {
    moduleId: 'documents',
    moduleName: 'Dokumen Saya',
    icon: 'fa-solid fa-file-signature',
    capabilities: [
      { capability: 'documents.view', actionLabel: 'Lihat Surat', description: 'Melihat surat tugas dan surat izin santri' },
      { capability: 'documents.request', actionLabel: 'Ajukan Surat', description: 'Membuat draf pengajuan persuratan baru' },
      { capability: 'documents.generate', actionLabel: 'Generate PDF', description: 'Menerbitkan nomor surat dan unduh PDF' },
      { capability: 'documents.approve', actionLabel: 'Pengesahan (ACC)', description: 'Menyetujui atau menolak permohonan surat' },
      { capability: 'documents.archive.view', actionLabel: 'Lihat Arsip', description: 'Mengakses arsip surat dinas yang lalu' },
      { capability: 'documents.archive.manage', actionLabel: 'Kelola Arsip', description: 'Mengelola retensi dan status arsip surat' },
    ],
  },
  {
    moduleId: 'events_calendar',
    moduleName: 'Acara & Kalender',
    icon: 'fa-solid fa-calendar-days',
    capabilities: [
      { capability: 'events.view', actionLabel: 'Lihat Acara', description: 'Melihat jadwal liputan dan siaran acara' },
      { capability: 'events.create', actionLabel: 'Buat Acara', description: 'Mendaftarkan jadwal liputan baru' },
      { capability: 'events.edit', actionLabel: 'Edit Acara', description: 'Memperbarui rundown dan kru bertugas' },
      { capability: 'events.delete', actionLabel: 'Hapus Acara', description: 'Membatalkan atau menghapus acara' },
      { capability: 'events.rundown.manage', actionLabel: 'Kelola Rundown', description: 'Menyusun segmen waktu siaran rinci' },
      { capability: 'calendar.view', actionLabel: 'Lihat Kalender', description: 'Melihat agenda bulanan dan momentum' },
    ],
  },
  {
    moduleId: 'notes',
    moduleName: 'Catatan Bersama',
    icon: 'fa-solid fa-book-open',
    capabilities: [
      { capability: 'notes.view', actionLabel: 'Lihat Notulensi', description: 'Membaca catatan rapat dan ide konten' },
      { capability: 'notes.create', actionLabel: 'Buat Catatan', description: 'Menulis notulensi rapat baru' },
      { capability: 'notes.manage', actionLabel: 'Kelola Notulensi', description: 'Mengedit dan menghapus catatan tim' },
    ],
  },
  {
    moduleId: 'contacts',
    moduleName: 'Kontak',
    icon: 'fa-solid fa-address-book',
    capabilities: [
      { capability: 'contacts.internal.view', actionLabel: 'Kontak Internal', description: 'Melihat direktori koordinasi lembaga' },
      { capability: 'contacts.external.view', actionLabel: 'Kontak Eksternal', description: 'Melihat kontak mitra dan vendor luar' },
      { capability: 'contacts.external.manage', actionLabel: 'Kelola Kontak Eksternal', description: 'Menambah dan mengedit relasi lembaga' },
    ],
  },
  {
    moduleId: 'broadcast',
    moduleName: 'Broadcast & Proyek',
    icon: 'fa-solid fa-tower-broadcast',
    capabilities: [
      { capability: 'broadcast.view', actionLabel: 'Monitor Siaran', description: 'Melihat status OB Van dan live streaming' },
      { capability: 'broadcast.dispatch', actionLabel: 'Dispatch Siaran', description: 'Mengendalikan rute sinyal siaran langsung' },
      { capability: 'projecthaul.view', actionLabel: 'Lihat Proyek', description: 'Melihat daftar proyek produksi video' },
      { capability: 'projecthaul.manage', actionLabel: 'Kelola Proyek', description: 'Mengatur timeline dan anggaran proyek' },
    ],
  },
  {
    moduleId: 'finance',
    moduleName: 'Keuangan',
    icon: 'fa-solid fa-money-bill-wave',
    capabilities: [
      { capability: 'finance.view_own', actionLabel: 'Lihat Kas Saya', description: 'Melihat status iuran dan riwayat pembayaran kas pribadi' },
      { capability: 'finance.view', actionLabel: 'Lihat Laporan Keuangan', description: 'Melihat neraca kas operasional studio' },
      { capability: 'finance.manage', actionLabel: 'Kelola Transaksi', description: 'Otorisasi pencairan dana dan kas besar' },
      { capability: 'finance.operator', actionLabel: 'Operator Kas Kecil', description: 'Pencatatan pengeluaran harian studio' },
    ],
  },
  {
    moduleId: 'system',
    moduleName: 'Sistem & Audit',
    icon: 'fa-solid fa-sliders',
    capabilities: [
      { capability: 'settings.personal', actionLabel: 'Preferensi Pribadi', description: 'Mengatur tema dan profil pengguna' },
      { capability: 'settings.system', actionLabel: 'Pengaturan Sistem', description: 'Mengubah konfigurasi studio global' },
      { capability: 'audit.logs.view', actionLabel: 'Lihat Audit Log', description: 'Melihat log rekam jejak aktivitas sistem' },
    ],
  },
];

/**
 * Memetakan CrewRole standar ke AccessProfile kanonik
 */
export function mapRoleToAccessProfile(role: CrewRole): AccessProfile {
  switch (role) {
    case 'eksekutif':
      return 'eksekutif';
    case 'administrasi':
      return 'kepolo_kepali';
    case 'kru':
    default:
      return 'crew';
  }
}

/**
 * Memetakan AccessProfile kanonik kembali ke CrewRole tampilan
 */
export function mapAccessProfileToRole(profile: AccessProfile): CrewRole {
  switch (profile) {
    case 'root_executive':
    case 'eksekutif':
      return 'eksekutif';
    case 'kepolo_kepali':
      return 'administrasi';
    case 'pembina':
    case 'crew':
    default:
      return 'kru';
  }
}

/**
 * Menghasilkan PermissionContext resmi dari model CrewMember
 */
export function getCrewPermissionContext(crew: CrewMember): PermissionContext {
  const status_akun: AccountStatus = crew.status_akun === 'Aktif' ? 'active' : 'inactive';
  const status_organisasi: OrganizationStatus =
    crew.status_organisasi || (crew.status_kru === 'Aktif' ? 'active' : 'inactive');

  const assigned_profiles: readonly AccessProfile[] =
    crew.assigned_profiles && crew.assigned_profiles.length > 0
      ? crew.assigned_profiles
      : [mapRoleToAccessProfile(crew.role)];

  return {
    status_akun,
    status_organisasi,
    assigned_profiles,
    allowed_overrides: crew.allowed_overrides || [],
    denied_overrides: crew.denied_overrides || [],
  };
}

/**
 * Menghitung daftar capabilities efektif yang aktif bagi kru
 */
export function getCrewEffectiveCapabilities(crew: CrewMember): AppCapability[] {
  const ctx = getCrewPermissionContext(crew);
  return ALL_CAPABILITIES.filter((cap) => hasCapability(ctx, cap));
}

/**
 * Menghitung modul-modul yang dapat diakses oleh kru berdasarkan capabilities efektif
 */
export function getAccessibleModulesForCrew(crew: CrewMember): {
  moduleId: string;
  moduleName: string;
  icon: string;
  allowedCount: number;
  totalCount: number;
}[] {
  const effectiveCaps = new Set(getCrewEffectiveCapabilities(crew));

  return MODULE_CAPABILITY_GROUPS.map((group) => {
    const allowed = group.capabilities.filter((c) => effectiveCaps.has(c.capability)).length;
    return {
      moduleId: group.moduleId,
      moduleName: group.moduleName,
      icon: group.icon,
      allowedCount: allowed,
      totalCount: group.capabilities.length,
    };
  });
}

/**
 * Mendapatkan ringkasan profil akses utama
 */
export function getAccessProfileSummary(profile: AccessProfile): {
  label: string;
  description: string;
  defaultCapabilityCount: number;
} {
  const label = ACCESS_PROFILE_LABELS[profile] || profile;
  const caps = PROFILE_CAPABILITIES[profile];
  const defaultCapabilityCount = caps ? caps.size : 0;

  let description = '';
  switch (profile) {
    case 'root_executive':
      description = 'Akses master tanpa batas ke seluruh modul operasional, finansial, dan audit sistem.';
      break;
    case 'eksekutif':
      description = 'Otoritas tertinggi pimpinan harian: kelola kru, izin, persuratan, inventaris, dan finansial.';
      break;
    case 'kepolo_kepali':
      description = 'Koordinator divisi / administrasi: inventaris, peminjaman, surat, dan operasional harian.';
      break;
    case 'crew':
      description = 'Kru operasional lapangan: peminjaman alat, laporan kerusakan, lost & found, dan draf surat.';
      break;
    case 'pembina':
      description = 'Akses monitoring dan pendampingan: observasi inventaris, jadwal liputan, dan siaran.';
      break;
  }

  return { label, description, defaultCapabilityCount };
}
