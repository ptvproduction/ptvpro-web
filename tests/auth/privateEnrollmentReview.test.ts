import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
// @ts-expect-error Local administrative module, never imported by browser runtime.
import {validateEnrollmentReview} from '../../scripts/lib/private-enrollment.mjs';

const review=()=>{const id=randomUUID();return{project_ref:'swadgljnyelsjstqqxbm',scope:'ENROLL_INACTIVE_ACCOUNT_ONLY',operation_id:randomUUID(),account_id:randomUUID(),identity_id:id,source_uuid:id,ptv_id:'PTV-099',username:'synthetic',security_surface_sha256:'a'.repeat(64),expected_account_version:'2026-10-26T00:00:00Z',approval_reference:'SYNTHETIC-REVIEW',privacy_logging_approved:true,owner_verified:true,owner_evidence_reference:'SYNTHETIC-OWNER',recovery_evidence_reference:'SYNTHETIC-RECOVERY',owner_verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()};};
const password='SYNTHETIC-only-test-password';
describe('private enrollment review validation',()=>{
 it('accepts a complete inactive-only review without creating any credential',()=>expect(validateEnrollmentReview(review(),password)).toMatch(/^[0-9a-f]{64}$/));
 it('rejects a different project',()=>expect(()=>validateEnrollmentReview({...review(),project_ref:'production'},password)).toThrow());
 it('rejects activation/bootstrap scope',()=>expect(()=>validateEnrollmentReview({...review(),scope:'BOOTSTRAP_ROOT'},password)).toThrow());
 it('requires owner attestation rather than a name or username match',()=>expect(()=>validateEnrollmentReview({...review(),owner_verified:false},password)).toThrow());
 it('requires independent recovery evidence',()=>{const m=review();m.recovery_evidence_reference=m.owner_evidence_reference;expect(()=>validateEnrollmentReview(m,password)).toThrow();});
 it('requires separate authorization for temporary logging privacy',()=>expect(()=>validateEnrollmentReview({...review(),privacy_logging_approved:false},password)).toThrow());
 it('requires a pinned reviewed executable surface',()=>expect(()=>validateEnrollmentReview({...review(),security_surface_sha256:''},password)).toThrow());
 it('rejects expired approval',()=>expect(()=>validateEnrollmentReview({...review(),expires_at:'2000-01-01T00:00:00Z'},password)).toThrow());
 it('rejects identity/source mismatch',()=>expect(()=>validateEnrollmentReview({...review(),source_uuid:randomUUID()},password)).toThrow());
 it('rejects a password exceeding the bcrypt UTF8 byte limit',()=>expect(()=>validateEnrollmentReview(review(),'🌙'.repeat(20))).toThrow());
});
