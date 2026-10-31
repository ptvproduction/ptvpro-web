import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './auth/_utils/types';
import { sessionNeedsRegistry, portalSessionValid } from './auth/_utils/portalLifecycle';

export interface FinanceAccess { identityId: string; ptvId?: string; canManage: boolean; global: boolean }

interface CachedFinanceAccess {
  access: FinanceAccess;
  expiresAt: number;
}
const financeAccessCache = new Map<string, CachedFinanceAccess>();

export function clearFinanceAccessCache(accountId?: string) {
  if (accountId) financeAccessCache.delete(accountId);
  else financeAccessCache.clear();
}
export async function resolveFinanceAccess(db: SupabaseClient, session: SessionPayload): Promise<FinanceAccess> {
  const cacheKey = `${session.account_id}:${session.iat}`;
  const cached = financeAccessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.access;
  }
  if (sessionNeedsRegistry(session) && !await portalSessionValid(db, session)) throw new Error('forbidden');
  const account = await db.from('user_account').select('identity_id,status_akun,tokens_valid_after,lockout_until').eq('id', session.account_id).single();
  if (account.error || !account.data || account.data.status_akun !== 'active'
    || !Number.isFinite(session.iat) || session.iat <= 0 || session.iat * 1000 > Date.now() || !account.data.identity_id
    || (account.data.lockout_until && (!Number.isFinite(Date.parse(account.data.lockout_until)) || Date.parse(account.data.lockout_until) > Date.now()))
    || (account.data.tokens_valid_after && (!Number.isFinite(Date.parse(account.data.tokens_valid_after)) || session.iat * 1000 < Date.parse(account.data.tokens_valid_after)))) throw new Error('forbidden');
  const identityId = account.data.identity_id as string;
  const [members, profiles, overrides, identityRec] = await Promise.all([
    db.from('organization_membership').select('status_organisasi').eq('identity_id', identityId).eq('organization_id', 'ptv_studio').eq('is_current', true),
    db.from('account_profiles').select('profile_id').eq('account_id', session.account_id),
    db.from('account_capability_overrides').select('capability_key,override_type').eq('account_id', session.account_id),
    db.from('canonical_identity').select('ptv_id').eq('id', identityId).single(),
  ]);
  if (members.error || profiles.error || overrides.error || members.data?.length !== 1
    || members.data[0].status_organisasi !== 'active') throw new Error('forbidden');
  const ids = (profiles.data || []).map(p => p.profile_id);

  // ATURAN I: Kategori personel Pembina atau Pengarah dilarang keras mengakses Keuangan
  if (identityRec.error || !identityRec.data) throw new Error('forbidden');
  if (ids.includes('pembina') || ids.includes('pengarah')) throw new Error('forbidden');
  if (identityRec.data?.ptv_id) {
    const crewRes = await db.from('legacy_archive_kru').select('jabatan').eq('ptv_id', identityRec.data.ptv_id).maybeSingle();
    if (crewRes.error) throw new Error('forbidden');
    const position = (crewRes.data?.jabatan || '').toLowerCase().trim();
    if (position.startsWith('pembina') || position.startsWith('pengarah')) {
      throw new Error('forbidden');
    }
  }

  const grants = ids.length ? await db.from('profile_capabilities').select('capability_key').in('profile_id', ids) : { data: [], error: null };
  if (grants.error) throw new Error('forbidden');
  const allow = new Set((grants.data || []).map(c => c.capability_key));
  const deny = new Set((overrides.data || []).filter(c => c.override_type === 'deny').map(c => c.capability_key));
  for (const row of overrides.data || []) if (row.override_type === 'allow') allow.add(row.capability_key);
  const can = (cap: string) => allow.has(cap) && !deny.has(cap);
  if (!can('hub.access')) throw new Error('forbidden');
  // Bendahara is delegated through the existing finance.manage capability, not a new global profile.
  const canManage = can('finance.manage');
  const global = canManage || can('finance.view') || can('finance.operator');
  const own = !deny.has('finance.view_own') && (ids.includes('crew') || ids.includes('eksekutif') || ids.includes('root_executive') || can('finance.view_own'));
  if (!global && !own) throw new Error('forbidden');
  const ptvId = identityRec.data?.ptv_id || undefined;
  const access: FinanceAccess = { identityId, ptvId, canManage, global };
  financeAccessCache.set(cacheKey, { access, expiresAt: Date.now() + 20_000 });
  return access;
}

