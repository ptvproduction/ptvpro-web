import {describe,it,expect} from 'vitest';
import {Buffer} from 'node:buffer';
// @ts-expect-error Local PostgreSQL administrative transport, not a web module.
import {binaryCopyFrame,splitBinarySql,transportContextSafe,buildBinaryTransportSql} from '../../scripts/lib/legacy25-binary-transport.mjs';

describe('Legacy25 metadata-free COPY transport',()=>{
 const context={plan_duration:'10000',plan_nested:'off',plan_parameters:'0',audit_classes:'none',audit_parameters:'off',debug_parse:'off',debug_plan:'off',debug_rewritten:'off'};
 it('encodes one UTF8 bytea field in PostgreSQL binary COPY framing',()=>{const text='Synthetic é';const b=binaryCopyFrame(text);expect(b.subarray(0,11).toString('hex')).toBe('5047434f50590aff0d0a00');expect(b.readInt16BE(19)).toBe(1);expect(b.readInt32BE(21)).toBe(Buffer.byteLength(text));expect(b.subarray(25,-2).toString('utf8')).toBe(text);expect(b.readInt16BE(b.length-2)).toBe(-1);});
 it('rejects empty or excessive copy data',()=>{expect(()=>binaryCopyFrame('')).toThrow();expect(()=>binaryCopyFrame('x'.repeat(1048577))).toThrow();});
 it('keeps plan capture active with only parameter redaction',()=>expect(transportContextSafe(context)).toBe(true));
 it('rejects unlimited auto_explain parameter capture',()=>expect(transportContextSafe({...context,plan_parameters:'-1'})).toBe(false));
 it('rejects nested plan capture for the reviewed transport',()=>expect(transportContextSafe({...context,plan_nested:'on'})).toBe(false));
 it('preserves audit rather than silently disabling parameter logging',()=>expect(transportContextSafe({...context,audit_classes:'write',audit_parameters:'on'})).toBe(false));
 it('removes private literal from SQL without modifying the legacy business body',()=>{const data=JSON.stringify({name:"Synthetic O'Reilly $old$"}).replaceAll("'","''");const sql=buildBinaryTransportSql(`BEGIN;\nDO $old$\nDECLARE\n m jsonb := '${data}'::jsonb;\nBEGIN\n PERFORM 1;\nEND $old$;\nCOMMIT;`,{manifestSha:'a'.repeat(64),triggerDigest:'b'.repeat(64),surfaceDigest:'c'.repeat(64),baselineTables:['public.canonical_identity','public.user_account','public.organization_membership','public.account_profiles','public.auth_audit_log']});expect(sql).not.toContain("Synthetic O'Reilly");expect(sql).not.toContain('"name"');expect(sql).toContain('PERFORM 1;');expect(sql).toContain('WHEN OTHERS');expect(splitBinarySql(sql).copy).toBe('COPY pg_temp.ptv_legacy25_input(payload) FROM STDIN WITH (FORMAT binary);');});
 it('rejects arbitrary COPY commands or missing transaction sections',()=>expect(()=>splitBinarySql('COPY public.x FROM PROGRAM')).toThrow());
});
