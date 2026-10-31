import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppCapability } from '../src/core/policy/capabilities';

export const SYSTEM_CONFIG_KEY = 'system_position_capability_mapping';
export const SYSTEM_CONFIG_PTV_ID = 'PTV-CONFIG-01';

export interface PositionCapabilityMappingItem {
  position: string;
  capabilities: AppCapability[];
  description?: string;
  updated_at?: string;
}

/**
 * Normalizes Record<string, AppCapability[]> or any legacy structure to PositionCapabilityMappingItem[].
 */
export function formatPositionMappingsAsArray(
  dict: Record<string, AppCapability[]> | PositionCapabilityMappingItem[] | null | undefined
): PositionCapabilityMappingItem[] {
  if (!dict) return [];
  if (Array.isArray(dict)) {
    return dict.filter(item => item && typeof item.position === 'string' && Array.isArray(item.capabilities));
  }
  return Object.entries(dict).map(([pos, caps]) => ({
    position: pos,
    capabilities: Array.isArray(caps) ? caps : [],
    description: `Izin bawaan untuk jabatan ${pos}`,
  }));
}

/**
 * Normalizes PositionCapabilityMappingItem[] or Record<string, AppCapability[]> to Record<string, AppCapability[]>.
 */
export function formatPositionMappingsAsRecord(
  input: Record<string, AppCapability[]> | PositionCapabilityMappingItem[] | null | undefined
): Record<string, AppCapability[]> {
  if (!input) return { ...DEFAULT_POSITION_CAPABILITIES };
  if (Array.isArray(input)) {
    const res: Record<string, AppCapability[]> = {};
    for (const item of input) {
      if (item && item.position) {
        res[item.position] = Array.isArray(item.capabilities) ? item.capabilities : [];
      }
    }
    return res;
  }
  return { ...input };
}

/**
 * Standard default mappings from Organizational Positions to AppCapabilities.
 * These can be modified from Manajemen Akun UI without editing code.
 */
export const DEFAULT_POSITION_CAPABILITIES: Record<string, AppCapability[]> = {
  'Ketua Umum': [
    'hub.access',
    'events.view',
    'events.create',
    'events.edit',
    'events.delete',
    'events.rundown.manage',
    'calendar.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.delete',
    'inventory.units.manage',
    'inventory.valuation.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'loans.manage',
    'damage.view',
    'damage.report',
    'damage.qc.approve',
    'lostfound.view',
    'lostfound.report',
    'lostfound.manage',
    'crew.view',
    'crew.create',
    'crew.edit',
    'crew.status.manage',
    'crew.permissions.manage',
    'id.view',
    'id.export',
    'documents.view',
    'documents.request',
    'documents.generate',
    'documents.approve',
    'documents.archive.view',
    'documents.archive.manage',
    'finance.view',
    'finance.manage',
    'contacts.internal.view',
    'contacts.external.view',
    'contacts.external.manage',
    'broadcast.view',
    'broadcast.dispatch',
    'projecthaul.view',
    'projecthaul.manage',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
    'settings.system',
    'audit.logs.view',
  ],
  'Ketua': [
    'hub.access',
    'events.view',
    'events.create',
    'events.edit',
    'events.rundown.manage',
    'calendar.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'loans.manage',
    'damage.view',
    'damage.report',
    'crew.view',
    'crew.create',
    'crew.edit',
    'documents.view',
    'documents.request',
    'documents.generate',
    'documents.approve',
    'finance.view',
    'contacts.internal.view',
    'broadcast.view',
    'broadcast.dispatch',
    'projecthaul.view',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
  ],
  'Ketua Divisi': [
    'hub.access',
    'events.view',
    'events.create',
    'events.edit',
    'events.rundown.manage',
    'calendar.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'loans.manage',
    'damage.view',
    'damage.report',
    'crew.view',
    'crew.edit',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'broadcast.dispatch',
    'projecthaul.view',
    'projecthaul.manage',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
  ],
  'Sekretaris & Bendahara': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'crew.view',
    'id.view',
    'id.export',
    'documents.view',
    'documents.request',
    'documents.generate',
    'documents.approve',
    'documents.archive.view',
    'documents.archive.manage',
    'finance.view',
    'finance.manage',
    'finance.operator',
    'finance.view_own',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
  ],
  'Bendahara': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'crew.view',
    'documents.view',
    'finance.view',
    'finance.manage',
    'finance.operator',
    'finance.view_own',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Sekretaris': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'crew.view',
    'documents.view',
    'documents.request',
    'documents.generate',
    'documents.approve',
    'documents.archive.view',
    'documents.archive.manage',
    'contacts.internal.view',
    'broadcast.view',
    'broadcast.dispatch',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
  ],
  'Koor Operasional': [
    'hub.access',
    'events.view',
    'events.create',
    'events.edit',
    'events.rundown.manage',
    'calendar.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.units.manage',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'loans.manage',
    'damage.view',
    'damage.report',
    'damage.qc.approve',
    'lostfound.view',
    'lostfound.report',
    'lostfound.manage',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'broadcast.dispatch',
    'projecthaul.view',
    'projecthaul.manage',
    'notes.view',
    'notes.create',
    'notes.manage',
    'settings.personal',
  ],
  'Editor': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'damage.view',
    'damage.report',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Layouter': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'damage.view',
    'damage.report',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Technical': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.units.manage',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'loans.manage',
    'damage.view',
    'damage.report',
    'damage.qc.approve',
    'lostfound.view',
    'lostfound.report',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Creative': [
    'hub.access',
    'events.view',
    'events.create',
    'events.edit',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'projecthaul.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Engagement': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'crew.view',
    'documents.view',
    'contacts.internal.view',
    'contacts.external.view',
    'broadcast.view',
    'broadcast.dispatch',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Kru Operasional': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'damage.view',
    'damage.report',
    'lostfound.view',
    'lostfound.report',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Kru': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'loans.checkout',
    'loans.return',
    'damage.view',
    'damage.report',
    'lostfound.view',
    'lostfound.report',
    'crew.view',
    'documents.view',
    'documents.request',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'notes.create',
    'settings.personal',
  ],
  'Pembina PTV': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'crew.view',
    'documents.view',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'settings.personal',
  ],
  'Pembina': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'crew.view',
    'documents.view',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'settings.personal',
  ],
  'Pengarah': [
    'hub.access',
    'events.view',
    'calendar.view',
    'inventory.view',
    'loans.view',
    'crew.view',
    'documents.view',
    'contacts.internal.view',
    'broadcast.view',
    'notes.view',
    'settings.personal',
  ],
};

let cachedMappings: Record<string, AppCapability[]> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Loads the active position-to-capabilities mapping from the database.
 * Falls back to default mappings if no custom mapping is saved.
 */
export async function getPositionCapabilityMappings(
  db: SupabaseClient
): Promise<Record<string, AppCapability[]>> {
  const now = Date.now();
  if (cachedMappings && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMappings;
  }

  try {
    // 1. Primary official configuration table: ptv_portal_settings
    const { data: portalRow, error: portalErr } = await db
      .from('ptv_portal_settings')
      .select('draft_payload')
      .eq('id', 'position_capability_mappings')
      .maybeSingle();

    if (!portalErr && portalRow?.draft_payload?.position_mappings) {
      const customMappings = portalRow.draft_payload.position_mappings as Record<string, AppCapability[]>;
      cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...customMappings };
      lastCacheTime = now;
      return cachedMappings;
    }

    // 2. Fallback check for transition
    const { data: row, error } = await db
      .from('legacy_archive_kru')
      .select('metadata_json')
      .eq('source_key', SYSTEM_CONFIG_KEY)
      .maybeSingle();

    if (!error && row?.metadata_json?.position_mappings) {
      const customMappings = row.metadata_json.position_mappings as Record<string, AppCapability[]>;
      cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...customMappings };
      lastCacheTime = now;
      return cachedMappings;
    }
  } catch (err) {
    console.warn('[PositionMapping] Failed to load custom mapping, using defaults:', err);
  }

  cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES };
  lastCacheTime = now;
  return cachedMappings;
}

/**
 * Saves position capabilities mapping to official database configuration (ptv_portal_settings).
 */
export async function savePositionCapabilityMappings(
  db: SupabaseClient,
  mappings: Record<string, AppCapability[]> | PositionCapabilityMappingItem[],
  actorAccountId: string
): Promise<boolean> {
  const normalizedRecord = formatPositionMappingsAsRecord(mappings);
  const meta = {
    position_mappings: normalizedRecord,
    updated_at: new Date().toISOString(),
    updated_by_account_id: actorAccountId,
  };

  // 1. Save to official configuration table: ptv_portal_settings
  const { error: portalError } = await db.from('ptv_portal_settings').upsert({
    id: 'position_capability_mappings',
    is_published: true,
    draft_payload: meta,
    updated_at: new Date().toISOString(),
  });

  if (portalError) {
    console.error('[PositionMapping] Failed to save mapping to ptv_portal_settings:', portalError);
    throw new Error(`Gagal menyimpan mapping jabatan ke tabel konfigurasi: ${portalError.message}`);
  }

  // 2. Optional sync to legacy_archive_kru during transition period
  try {
    const payload = {
      archive_id: '00000000-0000-0000-0000-000000000099',
      source_key: SYSTEM_CONFIG_KEY,
      production_id: '00000000-0000-0000-0000-000000000099',
      ptv_id: SYSTEM_CONFIG_PTV_ID,
      full_name: 'System Position Permissions Config',
      username: 'system_config',
      divisi: 'System',
      jabatan: 'Config',
      angkatan: '0',
      status: 'nonaktif',
      role: 'kru',
      metadata_json: meta,
      imported_at: new Date().toISOString(),
    };
    await db.from('legacy_archive_kru').upsert(payload);
  } catch {
    // Non-fatal if legacy table is cleaned or unavailable
  }

  cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...normalizedRecord };
  lastCacheTime = Date.now();
  return true;
}

/**
 * Resolves the capabilities assigned to a specific position title.
 */
export function resolvePositionCapabilities(
  positionTitle: string | null | undefined,
  mappings: Record<string, AppCapability[]>
): AppCapability[] {
  if (!positionTitle) return mappings['Kru Operasional'] || [];
  const trimmed = positionTitle.trim();

  // 1. Exact match
  if (mappings[trimmed]) {
    return mappings[trimmed];
  }

  // 2. Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, caps] of Object.entries(mappings)) {
    if (key.toLowerCase() === lower) {
      return caps;
    }
  }

  // 3. Substring heuristic matches
  if (/ketua\s*umum/i.test(trimmed)) return mappings['Ketua Umum'] || [];
  if (/ketua\s*divisi/i.test(trimmed)) return mappings['Ketua Divisi'] || [];
  if (/ketua/i.test(trimmed)) return mappings['Ketua'] || [];
  if (/bendahara/i.test(trimmed) && /sekretaris/i.test(trimmed)) return mappings['Sekretaris & Bendahara'] || [];
  if (/bendahara/i.test(trimmed)) return mappings['Bendahara'] || [];
  if (/sekretaris/i.test(trimmed)) return mappings['Sekretaris'] || [];
  if (/koor|direktur|director/i.test(trimmed)) return mappings['Koor Operasional'] || [];
  if (/editor/i.test(trimmed)) return mappings['Editor'] || [];
  if (/layout/i.test(trimmed)) return mappings['Layouter'] || [];
  if (/technic|hardware/i.test(trimmed)) return mappings['Technical'] || [];
  if (/creative|kreatif/i.test(trimmed)) return mappings['Creative'] || [];
  if (/engagement|medsos|humas/i.test(trimmed)) return mappings['Engagement'] || [];
  if (/pembina/i.test(trimmed)) return mappings['Pembina PTV'] || mappings['Pembina'] || [];
  if (/pengarah/i.test(trimmed)) return mappings['Pengarah'] || [];

  return mappings['Kru Operasional'] || [];
}


export default function handler(_req: unknown, res: { status: (c: number) => { json: (d: unknown) => void } }) {
  if (res && typeof res.status === 'function') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
}
