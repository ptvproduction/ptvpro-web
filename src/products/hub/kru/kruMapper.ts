import { CrewMember, CrewRole, CrewCategory, CrewMembershipStatus, CrewAccountStatus } from './types';

export interface RawLegacyKruDbRow {
  archive_id: string;
  source_key: string;
  production_id: string;
  ptv_id: string;
  full_name: string;
  username: string | null;
  divisi: string | null;
  jabatan: string | null;
  angkatan: string | null;
  status: string | null;
  role: string | null;
  photo_url: string | null;
  email_masked: string | null;
  telepon_masked: string | null;
  canonical_identity_id: string | null;
  reconciliation_status: string | null;
  metadata_json: {
    nim?: string | null;
    jurusan?: string | null;
    birth_date?: string | null;
    tanggal_lahir?: string | null;
    address?: string | null;
    alamat?: string | null;
    oauth_uid?: string | null;
    avatar_url?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    wp_user_id?: string | null;
    role_legacy?: string | null;
    oauth_provider?: string | null;
    [key: string]: any;
  } | null;
  imported_at: string;
}

/**
 * Normalizes legacy database row into authoritative React CrewMember interface
 */
/**
 * Authoritative media URL sanitizer for kru avatars and portraits.
 * Corrects historic path discrepancies and strips broken synthetic media references.
 */
export function sanitizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  let clean = String(url).trim();
  if (clean.includes('/wp-content/uploads/2026/DSCN1421-scaled-e1763575335817.webp')) {
    clean = 'https://progresiftv.id/wp-content/uploads/DSCN1421-scaled-e1763575335817.webp';
  }
  if (clean.includes('Gemini_Generated_Image')) {
    return '';
  }
  return clean;
}
export function mapLegacyKruRowToCrewMember(row: RawLegacyKruDbRow, linkedAccountStatus: 'active' | 'inactive' | null = null): CrewMember {
  const divUpper = (row.divisi || '').trim().toLowerCase();
  const jabUpper = (row.jabatan || '').trim().toLowerCase();

  // Canonical category determination (matching legacy page-dasbor.php)
  let category: CrewCategory = 'Kru';
  if (
    divUpper === 'pengarah' ||
    jabUpper.includes('pengarah') ||
    jabUpper.includes('pendiri') ||
    jabUpper.includes('direktur yayasan') ||
    jabUpper.includes('presdir') ||
    jabUpper.includes('wadir')
  ) {
    category = 'Pengarah';
  } else if (divUpper === 'pembina' || jabUpper.includes('pembina')) {
    category = 'Pembina';
  } else {
    category = 'Kru';
  }

  if (['Kru', 'Pembina', 'Pengarah'].includes(row.metadata_json?.category || '')) category = row.metadata_json!.category as CrewCategory;

  // Membership status
  const status_kru: CrewMembershipStatus =
    (row.status || '').trim().toLowerCase() === 'aktif' ? 'Aktif' : 'Nonaktif';

  // A canonical personnel identity can exist without a login account.
  const status_akun: CrewAccountStatus = row.canonical_identity_id && linkedAccountStatus
    ? linkedAccountStatus === 'active' ? 'Aktif' : 'Nonaktif'
    : 'Belum Ada Akun';

  // Application access role
  let role: CrewRole = 'kru';
  const rawRole = (row.role || row.metadata_json?.role_legacy || '').toLowerCase();
  if (rawRole === 'eksekutif' || rawRole === 'executive') {
    role = 'eksekutif';
  } else if (rawRole === 'administrasi' || rawRole === 'admin') {
    role = 'administrasi';
  }

  // Avatar URL resolution (prioritizes photo_url, then metadata_json.avatar_url, fallback to standard avatar)
  const DEFAULT_AVATAR = 'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp';
  const rawFoto = row.photo_url || row.metadata_json?.avatar_url;
  const sanitizedFoto = sanitizeMediaUrl(rawFoto);
  const foto_url = sanitizedFoto || DEFAULT_AVATAR;

  const birth_date = row.metadata_json?.birth_date || row.metadata_json?.tanggal_lahir || undefined;
  const address = row.metadata_json?.address || row.metadata_json?.alamat || undefined;

  return {
    version: row.metadata_json?.updated_at || row.imported_at,
    personnel_link_pending: row.metadata_json?.phase1_link_pending === true,
    id: row.production_id || row.archive_id,
    ptv_id: row.ptv_id,
    full_name: row.full_name,
    username: row.username || (row.ptv_id ? row.ptv_id.toLowerCase().replace('-', '_') : ''),
    role,
    category,
    division: category==='Kru' ? row.divisi || 'Umum' : '',
    position: row.jabatan || 'Kru',
    angkatan: category==='Kru' ? row.angkatan || '' : '',
    assigned_profiles: row.metadata_json?.phase1_assigned_profiles,
    nim: row.metadata_json?.nim || undefined,
    jurusan: row.metadata_json?.jurusan || undefined,
    birth_date,
    tanggal_lahir: birth_date,
    address,
    alamat: address,
    phone: row.telepon_masked || undefined,
    email: row.email_masked || undefined,
    join_date: row.metadata_json?.created_at?.slice(0, 10) || row.imported_at?.slice(0, 10) || undefined,
    status_kru,
    status_akun,
    foto_url,
    oauth_uid: row.metadata_json?.oauth_uid || undefined,
    oauth_provider: (row.metadata_json?.oauth_provider as 'google') || undefined,
  };
}
