import fs from 'fs';
import path from 'path';

const sqlFile = 'C:/Users/zidna/Local Sites/ptvrebuild/app/sql/local.sql';
if (!fs.existsSync(sqlFile)) {
  console.error('File not found:', sqlFile);
  process.exit(1);
}

const content = fs.readFileSync(sqlFile, 'utf8');

// Parse postmeta
console.log('Parsing legacy crew metadata from local.sql...');
const postMetaRegex = /\(([0-9]+),([0-9]+),'([^']+)','([^']+)'\)/g;

const posts = new Map(); // postId -> { meta: {} }

let match;
while ((match = postMetaRegex.exec(content)) !== null) {
  const [_, metaId, postId, key, val] = match;
  if (!posts.has(postId)) {
    posts.set(postId, {});
  }
  posts.get(postId)[key] = val;
}

const crewList = [];
for (const [postId, meta] of posts.entries()) {
  if (meta.ptv_kru_crew_id && /^PTV-\d{3}$/.test(meta.ptv_kru_crew_id)) {
    crewList.push({
      legacy_post_id: postId,
      ptv_id: meta.ptv_kru_crew_id,
      username: meta.ptv_kru_username || `kru_${meta.ptv_kru_crew_id.toLowerCase().replace('-', '_')}`,
      divisi: meta.ptv_kru_divisi || 'Operasional',
      role: meta.ptv_kru_role || 'crew',
      status: meta.ptv_kru_status || 'aktif',
      jabatan: meta.ptv_kru_jabatan || meta.ptv_role || 'Kru',
      angkatan: meta.ptv_angkatan || '8',
      allowed_email: meta.ptv_kru_allowed_emails || null,
      photo_url: meta.ptv_photo_url || null
    });
  }
}

// Sort by ptv_id
crewList.sort((a, b) => a.ptv_id.localeCompare(b.ptv_id));

console.log(`Successfully extracted ${crewList.length} legacy crew members!`);
console.log('Sample parsed crew:', crewList.slice(0, 5));

fs.writeFileSync('src/legacy-parsed-crew.json', JSON.stringify(crewList, null, 2), 'utf8');
console.log('Saved parsed crew to src/legacy-parsed-crew.json');
