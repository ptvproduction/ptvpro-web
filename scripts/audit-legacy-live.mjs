import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

async function auditLegacyFull() {
  const fileStream = fs.createReadStream('C:/Users/zidna/Local Sites/ptvrebuild/app/sql/local.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let url = '', key = '';
  for await (const line of rl) {
    const m1 = line.match(/'ptv_supabase_url',\s*'([^']+)'/);
    const m2 = line.match(/'ptv_supabase_service_key',\s*'([^']+)'/);
    if (m1) url = m1[1];
    if (m2) key = m2[1];
    if (url && key) break;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Audit Storage Buckets
  const { data: buckets, error: errB } = await sb.storage.listBuckets();
  console.log('--- STORAGE BUCKETS IN LEGACY ---');
  if (errB) console.log('Error listing buckets:', errB.message);
  else {
    console.log('Buckets count:', buckets.length);
    for (const b of buckets) {
      console.log(' - Bucket:', b.name, 'Public:', b.public);
      const { data: files } = await sb.storage.from(b.name).list('', { limit: 10 });
      if (files) console.log('   Sample files in ' + b.name + ':', files.map(f => f.name));
    }
  }

  // 2. Audit All Candidate Tables
  const candidateTables = [
    'ptv_surat_izin', 'ptv_surat_tugas', 'ptv_surat_barang',
    'ptv_catatan', 'ptv_pengumuman', 'ptv_acara',
    'ptv_lapor_masalah', 'ptv_lost_found',
    'ptv_tugas', 'ptv_riwayat_tugas', 'ptv_izin',
    'ptv_ebook', 'ptv_portfolio', 'ptv_galeri', 'ptv_konten',
    'ptv_pendaftar', 'ptv_update', 'ptv_request_aset',
    'ptv_kas_kru', 'ptv_kas_periode', 'ptv_keuangan', 'ptv_pemasukan', 'ptv_pengeluaran'
  ];

  console.log('\n--- CANDIDATE TABLES ROW COUNTS IN LEGACY ---');
  for (const t of candidateTables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(` - ${t}: ${count} rows`);
    }
  }

  // 3. Detail ptv_surat_izin in Legacy
  const { data: izinList } = await sb.from('ptv_surat_izin').select('*').order('created_at', { ascending: true });
  console.log('\n--- ALL ptv_surat_izin IN LEGACY ---');
  // 4. Detail ptv_ebook
  const { data: ebooks } = await sb.from('ptv_ebook').select('*').limit(3);
  console.log('\n--- SAMPLE ptv_ebook IN LEGACY ---');
  if (ebooks && ebooks.length > 0) {
    console.log('Columns:', Object.keys(ebooks[0]));
    console.log(ebooks);
  }

  // 5. Detail ptv_catatan
  const { data: catatan } = await sb.from('ptv_catatan').select('*').limit(5);
  console.log('\n--- SAMPLE ptv_catatan IN LEGACY ---');
  if (catatan && catatan.length > 0) {
    console.log('Columns:', Object.keys(catatan[0]));
    console.log(catatan.map(c => ({ id: c.id, judul: c.judul, tags: c.tags, created_at: c.created_at })));
  }
}

auditLegacyFull().catch(console.error);
