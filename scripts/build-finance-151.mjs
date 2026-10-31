import console from 'node:console';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const corePath = 'docs/PTVPRO-FINANCE-TRANSACTION-RPC-DRAFT.sql';
const oldPath = 'docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql';
const sourcePath = 'docs/PTVPRO-FINANCE-151-HARDENING-SOURCE.sql';
const core = readFileSync(corePath, 'utf8');
const old = readFileSync(oldPath, 'utf8');
const source = readFileSync(sourcePath, 'utf8');
function definition(text, name) {
  const start = text.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  const end = text.indexOf('$$;', start);
  if (start < 0 || end < start) throw new Error(`Missing SQL dependency ${name}`);
  return text.slice(start, end + 3);
}
function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`SQL dependency changed near ${from.slice(0, 50)}`);
  return text.replace(from, to);
}
let post = definition(core, 'ptv_finance_private.post_transaction');
post = replaceOnce(post, '  -- 2. Validasi Struktur Payload Dasar', "  PERFORM pg_advisory_xact_lock(151,1);\n  -- 2. Validasi Struktur Payload Dasar");
post = replaceOnce(post, 'IF v_version <> 2 THEN', 'IF v_version IS DISTINCT FROM 2 THEN');
post = replaceOnce(post, "IF v_operation NOT IN ('income', 'expense', 'transfer') THEN", "IF v_operation IS NULL OR v_operation NOT IN ('income', 'expense', 'transfer') THEN");
post = replaceOnce(post, "v_command_hash := encode(sha256(convert_to(v_canonical_hash_input, 'UTF8')), 'hex');", "v_command_hash := encode(sha256(convert_to(v_canonical_hash_input || CASE WHEN p_command ? '_operational' THEN '|' || (p_command->'_operational')::text ELSE '' END, 'UTF8')), 'hex');");
post = replaceOnce(post, '    created_by, created_at\n', '    created_by, created_at, operational_envelope\n');
post = replaceOnce(post, '    v_verified_actor_id, now()\n', "    v_verified_actor_id, now(), coalesce(p_command->'_operational',jsonb_build_object('kind','general','account',p_account_id))\n");
let disburse = definition(old, 'ptv_finance_private.disburse_loan_atomic');
disburse = replaceOnce(disburse, '  IF p_loan_payload IS NULL', `  p_command:=ptv_finance_private.operational_command(p_account_id,p_command,'loan_disbursement',p_loan_payload);
  v_tx_result:=ptv_finance_private.operational_replay(p_account_id,p_command);
  IF v_tx_result IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'transaction',v_tx_result); END IF;
  IF p_loan_payload->>'borrowerType' IS NULL OR p_loan_payload->>'borrowerType' NOT IN('kru','eksternal')
    OR nullif(trim(p_loan_payload->>'borrowerName'),'') IS NULL OR nullif(trim(p_loan_payload->>'borrowerContact'),'') IS NULL
    OR nullif(trim(p_loan_payload->>'purpose'),'') IS NULL THEN RAISE EXCEPTION 'invalid borrower details'; END IF;
  IF p_loan_payload->>'borrowerType'='kru' AND NOT EXISTS(SELECT 1 FROM public.canonical_identity ci
    WHERE ci.ptv_id=p_loan_payload->>'borrowerId' AND ptv_finance_private.personnel_category(ci.id)='Kru'
    AND (SELECT count(*) FROM public.organization_membership m WHERE m.identity_id=ci.id AND m.organization_id='ptv_studio' AND m.is_current)=1
    AND EXISTS(SELECT 1 FROM public.organization_membership m WHERE m.identity_id=ci.id AND m.organization_id='ptv_studio' AND m.is_current AND m.status_organisasi='active'))
    THEN RAISE EXCEPTION 'verified internal borrower required'; END IF;
  IF p_loan_payload->>'interestType' IS NULL OR p_loan_payload->>'interestType' NOT IN('none','flat')
    OR coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<0
    OR coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<>round(coalesce((p_loan_payload->>'interestRatePercent')::numeric,0),2)
    OR (p_loan_payload->>'interestType'='none' AND coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<>0)
    OR (p_loan_payload->>'borrowerType'='eksternal' AND nullif(p_loan_payload->>'borrowerId','') IS NOT NULL)
    THEN RAISE EXCEPTION 'invalid interest terms or external borrower identity'; END IF;
  IF p_loan_payload IS NULL`);
disburse = replaceOnce(disburse, '  -- 1. Eksekusi pengeluaran dana kas via canonical ledger', `  IF p_command->>'operation' IS DISTINCT FROM 'expense' OR (p_command->>'amountMinor')::bigint IS DISTINCT FROM v_principal
    OR p_command->>'occurredOn' IS DISTINCT FROM p_loan_payload->>'disbursedOn' OR jsonb_array_length(p_command->'outgoing')<>1
    OR p_command->'outgoing'->0->>'pocketId' IS DISTINCT FROM p_loan_payload->>'disbursedFromPocketId'
    OR (p_loan_payload->>'interestMinor')::bigint IS DISTINCT FROM v_interest_minor OR (p_loan_payload->>'totalDueMinor')::bigint IS DISTINCT FROM v_total_due
    OR ((p_loan_payload->>'dueDate')::date < (p_loan_payload->>'disbursedOn')::date)
    THEN RAISE EXCEPTION 'disbursement command does not match contract'; END IF;
  -- 1. Eksekusi pengeluaran dana kas via canonical ledger`);
const wrappers = ['rpc_record_kas_kru_payment_atomic', 'rpc_disburse_loan_atomic', 'rpc_record_loan_payment_atomic', 'rpc_reverse_operational_record_atomic', 'rpc_void_finance_transaction_atomic']
  .map(name => definition(old, `public.${name}`)).join('\n');
const adminPath = 'docs/PTVPRO-FINANCE-151-ADMIN-RPC.sql';
const admin = readFileSync(adminPath, 'utf8');
const policy = readFileSync('docs/PTVPRO-FINANCE-151-POLICIES.sql', 'utf8');
let output = source.replace('-- CORE_POST_TRANSACTION_151', () => post).replace('-- LOAN_DISBURSEMENT_151', () => disburse).replace('-- WRAPPERS_AND_POLICIES_151', () => wrappers + '\n' + policy + '\n' + admin);
const hashes = [corePath, oldPath, sourcePath, 'docs/PTVPRO-FINANCE-151-POLICIES.sql', adminPath].map(path => `${path}: ${createHash('sha256').update(readFileSync(path)).digest('hex')}`).join('\n-- ');
output = `-- GENERATED REVIEW PROPOSAL ONLY; no database client.\n-- ${hashes}\n` + output;
writeFileSync('docs/PTVPRO-FINANCE-151-STAGING-PROPOSAL.sql', output);
console.log('Finance 151 review proposal built; no SQL executed.');
