import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './auth/_utils/types';
import type { FinanceAccess } from './financeAccess';
import type { FinanceOperationalData } from '../src/products/hub/keuangan/financeOperationalData';
import {
  fetchSemestersCloudWithClient,
  fetchKasRecordsCloudWithClient,
  fetchLoansCloudWithClient,
  fetchCanonicalCrewRosterWithClient,
  fetchKasKruTariffConfigWithClient,
} from '../src/products/hub/keuangan/financeOperationalReader';

export async function readFinanceOperational(
  db: SupabaseClient, access: FinanceAccess, session: Pick<SessionPayload, 'account_id' | 'iat'>,
): Promise<FinanceOperationalData> {
  const scope = await db.rpc('rpc_finance_visible_transactions_server', {
    p_account_id: session.account_id, p_session_iat: session.iat, p_transaction_ids: [],
  });
  if (scope.error || scope.data?.identityId !== access.identityId
    || typeof scope.data.canManage !== 'boolean' || typeof scope.data.global !== 'boolean') throw new Error('forbidden');
  const manager = scope.data.canManage;
  if (!manager) {
    const [profiles, overrides] = await Promise.all([
      db.from('account_profiles').select('profile_id').eq('account_id', session.account_id),
      db.from('account_capability_overrides').select('capability_key,override_type').eq('account_id', session.account_id),
    ]);
    if (profiles.error || overrides.error || !profiles.data || !overrides.data) throw new Error('read_failed');
    const ids = profiles.data.map(p => p.profile_id);
    const grants = ids.length ? await db.from('profile_capabilities').select('capability_key').in('profile_id', ids) : { data: [], error: null };
    if (grants.error || !grants.data) throw new Error('read_failed');
    const ownOverrides = overrides.data.filter(o => o.capability_key === 'finance.view_own');
    if (ownOverrides.some(o => o.override_type === 'deny') || !(
      ids.some(id => ['crew', 'eksekutif', 'root_executive'].includes(id))
      || ownOverrides.some(o => o.override_type === 'allow')
      || grants.data.some(g => g.capability_key === 'finance.view_own')
    )) throw new Error('forbidden');
  }
  const identity = await db.from('canonical_identity').select('ptv_id').eq('id', access.identityId).single();
  if (identity.error || !identity.data?.ptv_id) throw new Error('read_failed');
  const ownerPtvId = identity.data.ptv_id;
  const [semesters, records, loans, crewRoster, tariffConfig, settings] = await Promise.all([
    fetchSemestersCloudWithClient(db),
    fetchKasRecordsCloudWithClient(db, undefined, manager ? undefined : ownerPtvId),
    fetchLoansCloudWithClient(db, manager ? undefined : ownerPtvId),
    fetchCanonicalCrewRosterWithClient(db, manager ? undefined : ownerPtvId),
    fetchKasKruTariffConfigWithClient(db),
    db.from('ptv_finance_settings').select('fee_due_day').eq('id', 'studio_default').maybeSingle(),
  ]);
  if (settings.error) throw new Error('read_failed');
  return {
    source: 'staging',
    scope: manager ? 'global' : 'own',
    ownerPtvId,
    writesEnabled: false,
    semesters,
    records,
    loans,
    feeDueDay: settings.data?.fee_due_day || 10,
    crewRoster,
    feeHistory: tariffConfig.feeHistory,
  };
}


export default function handler(_req: unknown, res: { status: (c: number) => { json: (d: unknown) => void } }) {
  if (res && typeof res.status === 'function') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
}
