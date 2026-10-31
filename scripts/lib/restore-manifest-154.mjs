// pg_dump17 can distribute a varchar[] -> text[] cast onto individual string literals.
// Preserve every literal, cast target and surrounding expression; do not normalize arbitrary SQL.
function canonicalConstraint(definition) {
  if(typeof definition!=='string') return definition;
  const literal="'(?:[^']|'')*'::character varying";
  return definition.replace(/\(\(ARRAY\[([^\]]+)\]\)::text\[\]\)/g,(match,items)=>{
    if(!new RegExp(`^${literal}(, ${literal})*$`).test(items)) return match;
    return `(ARRAY[${items.replace(new RegExp(literal,'g'),item=>`(${item})::text`)}])`;
  });
}
export function compareRestoreManifests(original,restored) {
  if(!original||!restored||Array.isArray(original)||Array.isArray(restored)||typeof original!=='object'||typeof restored!=='object')
    throw new Error('Two complete private restore manifest objects required.');
  const required=['data','schemas','tables','constraints','indexes','functions','policies','triggers','roles','memberships','default_acl','sequences'];
  for(const manifest of [original,restored]) {
    if(required.some(key=>!Object.hasOwn(manifest,key))||!Array.isArray(manifest.data)||!manifest.data.length
      ||!Array.isArray(manifest.tables)||manifest.tables.length!==manifest.data.length
      ||!Array.isArray(manifest.functions)||!manifest.functions.length||!Array.isArray(manifest.roles)||!manifest.roles.length)
      throw new Error('Incomplete restore manifest; coverage must be verified before comparison.');
  }
  const a=structuredClone(original),b=structuredClone(restored);
  let reviewedCastReformats=0;
  for(const x of a.constraints||[]) {
    const other=(b.constraints||[]).find(y=>y.table===x.table&&y.name===x.name);
    if(other&&x.definition!==other.definition&&canonicalConstraint(x.definition)===canonicalConstraint(other.definition)) reviewedCastReformats++;
  }
  for(const manifest of [a,b]) for(const constraint of manifest.constraints||[])
    constraint.definition=canonicalConstraint(constraint.definition);
  const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
  const changedSections=keys.filter(key=>JSON.stringify(a[key])!==JSON.stringify(b[key]));
  return {equal:changedSections.length===0,changedSections,reviewedCastReformats};
}
