import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './types';
import { hasCapability, type AppCapability, type PermissionContext, type AccessProfile } from '../../../../src/core/policy';
import { sessionNeedsRegistry, portalSessionValid } from './portalLifecycle';
import { getPositionCapabilityMappings, resolvePositionCapabilities } from '../../positionMapping';

export class LiveAccessUnavailableError extends Error {
  constructor() { super('forbidden'); this.name = 'LiveAccessUnavailableError'; }
}

export async function resolveLiveAccess(db: SupabaseClient, session: Pick<SessionPayload, 'account_id' | 'iat'> & Partial<SessionPayload>, options: { issuingSession?: boolean } = {}) {
  if (sessionNeedsRegistry(session) && !options.issuingSession) {
    try { if (!await portalSessionValid(db, session as SessionPayload)) throw new Error('forbidden'); }
    catch (error) { if (error instanceof Error && error.message === 'forbidden') throw error; throw new LiveAccessUnavailableError(); }
  }
  const account = await db.from('user_account').select('id,identity_id,username,status_akun,lockout_until,tokens_valid_after,updated_at').eq('id', session.account_id).single();
  if (account.error && account.error.code !== 'PGRST116') throw new LiveAccessUnavailableError();
  const row = account.data;
  if (session.identity_id !== undefined && session.identity_id !== row?.identity_id) throw new Error('forbidden');
  if (account.error || !row || row.status_akun !== 'active' || !Number.isFinite(session.iat)
    || session.iat <= 0 || session.iat * 1000 > Date.now()
    || (row.lockout_until && (!Number.isFinite(Date.parse(row.lockout_until)) || Date.parse(row.lockout_until) > Date.now()))
    || (row.tokens_valid_after && (!Number.isFinite(Date.parse(row.tokens_valid_after)) || session.iat * 1000 < Date.parse(row.tokens_valid_after)))) throw new Error('forbidden');
  
  const [identity, membership, profiles, overrides, positionMappings] = await Promise.all([
    db.from('canonical_identity').select('id,ptv_id,full_name,avatar_url').eq('id', row.identity_id).single(),
    db.from('organization_membership').select('division_id,position_title,status_organisasi').eq('identity_id', row.identity_id).eq('organization_id', 'ptv_studio').eq('is_current', true),
    db.from('account_profiles').select('profile_id').eq('account_id', row.id),
    db.from('account_capability_overrides').select('capability_key,override_type').eq('account_id', row.id),
    getPositionCapabilityMappings(db),
  ]);
  
  if (identity.error || membership.error || profiles.error || overrides.error) throw new LiveAccessUnavailableError();
  if (!identity.data || membership.data?.length !== 1) throw new Error('forbidden');
  if (!['active', 'inactive', 'archived'].includes(membership.data[0].status_organisasi)) throw new Error('forbidden');
  
  const assigned = (profiles.data || []).map(p => p.profile_id as AccessProfile);
  const grants = assigned.length ? await db.from('profile_capabilities').select('capability_key').in('profile_id', assigned) : { data: [], error: null };
  if (grants.error) throw new LiveAccessUnavailableError();
  
  const allow = (overrides.data || []).filter(o => o.override_type === 'allow').map(o => o.capability_key as AppCapability);
  const deny = (overrides.data || []).filter(o => o.override_type === 'deny').map(o => o.capability_key as AppCapability);
  
  // Jabatan Organisasi determines organization-based permissions
  const positionTitle = membership.data[0].position_title || '';
  const positionCaps = resolvePositionCapabilities(positionTitle, positionMappings);
  const profileCaps = (grants.data || []).map(g => g.capability_key as AppCapability);
  
  // Combine profile grants + position grants
  const combinedCapabilities = [...new Set([...profileCaps, ...positionCaps])];

  // Root protection: Root always has all capabilities
  const isRoot = assigned.includes('root_executive');
  let finalCapabilities = combinedCapabilities;
  if (isRoot) {
    const registry = await db.from('capability_registry').select('key');
    if (!registry.error && registry.data) {
      finalCapabilities = registry.data.map(r => r.key as AppCapability);
    }
  }

  const context: PermissionContext = {
    status_akun: row.status_akun,
    status_organisasi: membership.data[0].status_organisasi,
    assigned_profiles: assigned,
    allowed_overrides: allow,
    denied_overrides: isRoot ? [] : deny,
    capabilities: finalCapabilities,
    capabilities_verified_live: true,
  };
  
  if (!hasCapability(context, 'hub.access')) throw new Error('forbidden');
  return {
    account: row,
    identity: identity.data,
    membership: membership.data[0],
    profiles: assigned,
    context,
    can: (cap: AppCapability) => hasCapability(context, cap),
  };
}
