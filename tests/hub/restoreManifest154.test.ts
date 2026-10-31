import { describe,expect,it } from 'vitest';
import { compareRestoreManifests } from '../../scripts/lib/restore-manifest-154.mjs';
const original={constraints:[{table:'synthetic',name:'check_kind',validated:true,definition:"CHECK (((kind)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))"}],
  functions:[{signature:'synthetic()',owner:'postgres',definer:true,acl:'authenticated=X/postgres',definition_sha256:'synthetic'}],
  roles:[{role:'postgres',superuser:false,bypass_rls:true}],data:[{table_name:'synthetic',row_count:2,data_sha256:'synthetic'}],
  schemas:[{name:'public',acl:'postgres=UC/postgres'}],tables:[{name:'synthetic'}],indexes:[],policies:[],triggers:[],memberships:null,default_acl:null,sequences:[{name:'synthetic_seq',acl:'postgres=rwU/postgres'}]};
const restored=()=>({...structuredClone(original),constraints:[{...original.constraints[0],definition:"CHECK (((kind)::text = ANY (ARRAY[('income'::character varying)::text, ('expense'::character varying)::text])))"}]});
describe('154 restore comparison keeps security and data differences visible',()=>{
  it('accepts only the reviewed varchar-array cast redistribution',()=>{
    expect(compareRestoreManifests(original,restored())).toEqual({equal:true,changedSections:[],reviewedCastReformats:1});
    expect(original.constraints[0].definition).toContain('::text[]');
  });
  it('does not treat changed allowed values as formatting',()=>{
    const altered=restored();altered.constraints[0].definition=altered.constraints[0].definition.replace('expense','transfer');
    expect(compareRestoreManifests(original,altered).equal).toBe(false);
  });
  it('does not ignore constraint validation status',()=>{
    const altered=restored();altered.constraints[0].validated=false;
    expect(compareRestoreManifests(original,altered).changedSections).toContain('constraints');
  });
  it.each(['owner','acl','definition_sha256'])('detects function %s changes',field=>{
    const altered=restored();Object.assign(altered.functions[0],{[field]:'different'});
    expect(compareRestoreManifests(original,altered).changedSections).toContain('functions');
  });
  it('detects unauthorized superuser promotion',()=>{
    const altered=restored();altered.roles[0].superuser=true;
    expect(compareRestoreManifests(original,altered).changedSections).toContain('roles');
  });
  it('detects schema CREATE privilege changes',()=>{
    const altered=restored();altered.schemas[0].acl='authenticated=UC/postgres';
    expect(compareRestoreManifests(original,altered).changedSections).toContain('schemas');
  });
  it('detects sequence privilege changes',()=>{
    const altered=restored();altered.sequences[0].acl='authenticated=rwU/postgres';
    expect(compareRestoreManifests(original,altered).changedSections).toContain('sequences');
  });
  it('detects data changes and missing manifest sections',()=>{
    const altered=restored();altered.data[0].row_count=3;
    expect(compareRestoreManifests(original,altered).changedSections).toContain('data');
    expect(()=>compareRestoreManifests(original,{})).toThrow('Incomplete');
    expect(()=>compareRestoreManifests({},{})).toThrow('Incomplete');
  });
});
