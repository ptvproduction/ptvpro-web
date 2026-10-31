import { submitCategoryCreate } from './financeCanonicalService';
import { assertFinanceFixtureRuntime } from './financeRuntimeSafety';
import type { CanonicalCategory, FinancePocket } from './financeCanonical';
import type { FinanceOperationalSettings, QrisUploadPayload } from './financeSettingsTypes';

const STORAGE_SETTINGS_KEY = 'ptv_finance_v2_operational_settings';
const STORAGE_CUSTOM_CATEGORIES_KEY = 'ptv_finance_v2_custom_categories';

export const DEFAULT_FINANCE_SETTINGS: FinanceOperationalSettings = {
  defaultMonthlyFeeMinor: '2500000', // Rp 25.000,00
  feeDueDay: 10,
  defaultLoanDueDays: 30,
  treasurerName: 'Bendahara Studio',
  treasurerPtvId: 'PTV-000',
  treasurerPhone: '+62 822-1234-5678',
  officialBankPocketId: null,
  officialQrisPocketId: null,
};

let memorySettings: FinanceOperationalSettings | null = null;
let memoryCustomCategories: CanonicalCategory[] | null = null;

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

export function getStoredFinanceSettings(): FinanceOperationalSettings {
  assertFinanceFixtureRuntime();
  const storage = getStorage();
  if (!storage) return memorySettings || DEFAULT_FINANCE_SETTINGS;
  try {
    const raw = storage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return memorySettings || DEFAULT_FINANCE_SETTINGS;
    return { ...DEFAULT_FINANCE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return memorySettings || DEFAULT_FINANCE_SETTINGS;
  }
}

export function saveFinanceSettings(settings: FinanceOperationalSettings): void {
  memorySettings = settings;
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
}

export async function saveFinanceSettingsCloud(settings: FinanceOperationalSettings): Promise<void> {
  saveFinanceSettings(settings);
  const response = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_finance_settings',
      settings,
    }),
  });
  const body = await response.json();
  if (!response.ok || body.success !== true) {
    throw new Error(body.error || 'Perubahan pengaturan gagal disimpan di Staging.');
  }
}

export function getCustomCategories(): CanonicalCategory[] {
  assertFinanceFixtureRuntime();
  const storage = getStorage();
  if (!storage) return memoryCustomCategories || [];
  try {
    const raw = storage.getItem(STORAGE_CUSTOM_CATEGORIES_KEY);
    if (!raw) return memoryCustomCategories || [];
    return JSON.parse(raw);
  } catch {
    return memoryCustomCategories || [];
  }
}

export function saveCustomCategories(cats: CanonicalCategory[]): void {
  memoryCustomCategories = cats;
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_CUSTOM_CATEGORIES_KEY, JSON.stringify(cats));
}

/**
 * Buat kategori canonical baru dengan validasi nama unik dan pemanggilan endpoint /api/finance
 */
export async function createCanonicalCategory(
  name: string,
  kind: 'income' | 'expense',
  existingCategories: CanonicalCategory[] = []
): Promise<CanonicalCategory> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Nama kategori wajib diisi.');

  const duplicate = existingCategories.find(
    c => c.name.toLowerCase() === cleanName.toLowerCase() && c.kind === kind
  );
  if (duplicate) {
    throw new Error(`Kategori '${cleanName}' untuk jenis '${kind}' sudah ada.`);
  }

  const body = await submitCategoryCreate(cleanName, kind);
  if (!body.category) throw new Error('Respons kategori dari server tidak valid.');
  return {
    id: body.category.id,
    name: body.category.name,
    kind: body.category.kind,
    isActive: body.category.is_active,
  };
}

async function persistCategoryChange(payload: Record<string, string>): Promise<void> {
  const response = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || body.success !== true) {
    throw new Error(body.error || 'Perubahan kategori gagal disimpan di Staging.');
  }
}

export const SYSTEM_PROTECTED_CATEGORIES = new Set([
  'iuran kas kru',
  'pencairan piutang',
  'pengembalian pokok piutang',
  'pendapatan bunga piutang',
]);

export function isSystemCategory(name: string): boolean {
  return SYSTEM_PROTECTED_CATEGORIES.has(name.toLowerCase().trim());
}

/**
 * Edit nama kategori canonical dengan proteksi kategori sistem
 */
export async function editCanonicalCategory(
  categoryId: string,
  newName: string,
  categories: CanonicalCategory[]
): Promise<CanonicalCategory[]> {
  const cleanName = newName.trim();
  if (!cleanName) throw new Error('Nama kategori wajib diisi.');

  const target = categories.find(c => c.id === categoryId);
  if (!target) throw new Error('Kategori tidak ditemukan.');

  if (isSystemCategory(target.name)) {
    throw new Error(`Kategori sistem '${target.name}' dilindungi dan tidak dapat diubah namanya.`);
  }

  const duplicate = categories.find(
    c => c.id !== categoryId && c.name.toLowerCase() === cleanName.toLowerCase() && c.kind === target.kind
  );
  if (duplicate) {
    throw new Error(`Kategori '${cleanName}' untuk jenis '${target.kind}' sudah ada.`);
  }

  await persistCategoryChange({ action: 'update_category', id: categoryId, name: cleanName });
  return categories.map(c => c.id === categoryId ? { ...c, name: cleanName } : c);
}

/**
 * Arsipkan kategori (sembunyikan dari pilihan transaksi baru, tetap tampak di laporan historis)
 */
export async function archiveCanonicalCategory(
  categoryId: string,
  categories: CanonicalCategory[]
): Promise<CanonicalCategory[]> {
  const target = categories.find(c => c.id === categoryId);
  if (!target) throw new Error('Kategori tidak ditemukan.');

  if (isSystemCategory(target.name)) {
    throw new Error(`Kategori sistem '${target.name}' dilindungi dan tidak dapat diarsipkan.`);
  }

  await persistCategoryChange({ action: 'archive_category', id: categoryId });
  return categories.map(c => c.id === categoryId ? { ...c, isActive: false } : c);
}

/**
 * Pulihkan kategori terarsip menjadi aktif kembali
 */
export async function restoreCanonicalCategory(
  categoryId: string,
  categories: CanonicalCategory[]
): Promise<CanonicalCategory[]> {
  const target = categories.find(c => c.id === categoryId);
  if (!target) throw new Error('Kategori tidak ditemukan.');

  await persistCategoryChange({ action: 'restore_category', id: categoryId });
  return categories.map(c => c.id === categoryId ? { ...c, isActive: true } : c);
}

/**
 * Non-aktifkan atau aktifkan kategori (soft-archive, non-destruktif)
 */
export function toggleCategoryActive(
  categoryId: string,
  isActive: boolean,
  categories: CanonicalCategory[]
): CanonicalCategory[] {
  const target = categories.find(c => c.id === categoryId);
  if (target && !isActive && isSystemCategory(target.name)) {
    throw new Error(`Kategori sistem '${target.name}' dilindungi dan tidak dapat dinonaktifkan.`);
  }

  const updated = categories.map(c => {
    if (c.id === categoryId) {
      return { ...c, isActive };
    }
    return c;
  });

  const stored = getCustomCategories();
  const customUpdated = stored.map(c => c.id === categoryId ? { ...c, isActive } : c);
  if (!customUpdated.some(c => c.id === categoryId) && target) {
    customUpdated.push({ ...target, isActive });
  }
  saveCustomCategories(customUpdated);
  return updated;
}

/**
 * Menyimpan metadata QRIS resmi pada Kantong tertentu
 */
export function attachQrisToPocket(
  payload: QrisUploadPayload,
  pockets: FinancePocket[]
): FinancePocket[] {
  const target = pockets.find(p => p.id === payload.pocketId);
  if (!target) throw new Error('Kantong target tidak ditemukan.');
  if (target.kind === 'cash') throw new Error('Kantong tunai tidak dapat dipasangi QRIS.');

  if (!payload.merchantName.trim() || !payload.nmid.trim()) {
    throw new Error('Nama merchant dan NMID QRIS wajib diisi.');
  }

  const updatedPockets = pockets.map(p => {
    if (p.id !== payload.pocketId) return p;
    return {
      ...p,
      qris: {
        assetPath: payload.assetPath,
        merchantName: payload.merchantName.trim(),
        nmid: payload.nmid.trim(),
        verifiedAt: payload.verifiedAt || new Date().toISOString(),
      },
    };
  });

  return updatedPockets;
}
