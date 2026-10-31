import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrewMember, CrewCategory } from '@products/hub/kru/types';
import type { FinanceSemester, KasKruFeeHistoryEntry, KasKruRecord } from './kasKruTypes';
import type { PiutangRecord, PiutangPayment } from './piutangTypes';
import type { FinanceOperationalSettings } from './financeSettingsTypes';

export const KAS_KRU_TARIFF_CONFIG_ROW_ID = 'finance_kas_kru_tariff_config';

export interface PersistedKasKruTariffConfig {
  monthlyFeesBySemester: Record<string, Record<string, string>>;
  feeHistory: KasKruFeeHistoryEntry[];
  updatedAt?: string;
}

type RowQuery = { range: (start: number, end: number) => PromiseLike<{ data: any[] | null; error: unknown }> };

async function readAllRows(query: RowQuery) {
  const rows: any[] = [];
  for (let start = 0; ; start += 500) {
    const page = await query.range(start, start + 499);
    if (page.error) throw page.error;
    if (!page.data) throw new Error('read_failed');
    rows.push(...page.data);
    if (page.data.length < 500) return rows;
  }
}

const STAGING_SEMESTER_HISTORICAL_FEES: Record<string, Record<string, string>> = {
  // Semester Ganjil 2026/2027 (dari ptv_kas_periode Dasbor PTV)
  '2941ab08-a7f9-4f35-9539-93131fbe5685': {
    '2026-09': '2000000', // Rp 20.000
    '2026-10': '2000000', // Rp 20.000
    '2026-11': '5000000', // Rp 50.000
  },
  // Semester Genap 2025/2026 (dari ptv_kas_periode Dasbor PTV)
  '7061bf68-5d8b-4e9c-a61d-485a790d0a7e': {
    '2026-06': '2000000', // Rp 20.000
    '2026-07': '2500000', // Rp 25.000
    '2026-08': '2500000', // Rp 25.000
  },
};

/**
 * Pemetaan terverifikasi UUID transaksi canonical (ptv_finance_transactions.id)
 * ke UUID identitas resmi (canonical_identity.id) berdasarkan relasi ptv_finance_source_references
 * dan ptv_kas_kru.kru_id pada Dasbor PTV.
 */
export const CANONICAL_KAS_TX_IDENTITY_UUID_MAP: Record<string, string> = {
  '6537834f-84dd-4c12-b5ac-ac75f71b138b': 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c', // PTV-030 Muhammad Isa (2026-08)
  'b480e722-19ba-43a8-826a-294a97d53e50': '29dc4b45-9465-4d90-9cb3-051438f067b7', // PTV-031 Nasshar Rasikh Arsyadiano (2026-08)
  '8d3b0abd-d572-4f09-a041-01f6a21353b1': '22d7d714-f163-46d5-b691-46455eb8a28a', // PTV-024 Fathur Rahmanhadi Saputra (2026-09)
  'de2f987c-1f5c-46eb-b0e8-b11e80029d1f': '23f8a9cf-cb4e-4543-8207-7aef92692ead', // PTV-003 Muhammad Farras Zaidan Mubarok (2026-09 Rp20rb)
  '4ce4203c-5f70-480d-95b0-35f82be96bf0': '0200ce68-10bb-45a3-8422-49ec5ce376ef', // PTV-020 Aqil Afzal Al Farisi (2026-07 reversed)
  '7eed7ec6-ea6a-4120-9b14-51044170190b': '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', // PTV-016 Muhammad Izzur Fauzil Adhim (2026-09 reversed)
  '2d6dd948-0b23-4449-a3ca-f4f8013d4e67': '29dc4b45-9465-4d90-9cb3-051438f067b7', // PTV-031 Nasshar Rasikh Arsyadiano (2026-07)
  '21e929a6-63cc-410a-a069-45ae2356bafe': '23f8a9cf-cb4e-4543-8207-7aef92692ead', // PTV-003 Muhammad Farras Zaidan Mubarok (2026-09 Rp25rb lama)
  '6f008e5e-3459-4fd8-8fb7-523851e9f1db': '29dc4b45-9465-4d90-9cb3-051438f067b7', // PTV-031 Nasshar Rasikh Arsyadiano (2026-09)
  'f6296cf8-4a44-49ee-8704-c0a674e0d031': 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c', // PTV-030 Muhammad Isa (2026-09)
  '2a3c2006-5385-499e-ace1-8434cf1f6185': '22d7d714-f163-46d5-b691-46455eb8a28a', // PTV-024 Fathur Rahmanhadi Saputra (2026-07)
  'd9223341-e615-4761-9fc9-59743d13ca71': '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', // PTV-027 Malik Gundhaya Wiriarsa (2026-07)
  '18afb321-4b1d-4155-bc44-f1cb01b2d762': '13db53b8-517a-44d5-b6db-b1eb204cf442', // PTV-026 Iyyaka Fahabil Farhan (2026-08)
  '17ab54a7-637f-4ae6-95ea-e80f42dc1796': '13db53b8-517a-44d5-b6db-b1eb204cf442', // PTV-026 Iyyaka Fahabil Farhan (2026-07)
  '01ab3de0-384a-4915-897d-686ebae00dd4': '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', // PTV-016 Muhammad Izzur Fauzil Adhim (2026-07)
  '1ef3e9ee-3fc2-4f81-a63e-5fbe9c2491ba': '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', // PTV-016 Muhammad Izzur Fauzil Adhim (2026-08)
  '307a3d97-ffb7-4004-9225-9d9ab11aa2cd': '73ee2fcd-f736-4258-b4cf-9e1745546c4c', // PTV-028 Muhammad Daghfal Faizullah (2026-09)
  'dd9ddb46-78ec-486d-b0d7-3af56b38bfd5': '22d7d714-f163-46d5-b691-46455eb8a28a', // PTV-024 Fathur Rahmanhadi Saputra (2026-10)
  'ae1b218c-d6b5-4ecc-aead-98a4202573ba': '23f8a9cf-cb4e-4543-8207-7aef92692ead', // PTV-003 Muhammad Farras Zaidan Mubarok (2026-08)
  '5addea41-63f9-4d98-8ab7-2d0bbdb28f7c': '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', // PTV-027 Malik Gundhaya Wiriarsa (2026-09 Rp20rb)
  'f133f8ef-1804-4ee2-980b-6f1918861948': 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c', // PTV-030 Muhammad Isa (2026-07)
  '32acc12a-1121-4969-b4a4-43578fc132d1': '02cade6b-16df-426a-b7b7-a59c60581187', // PTV-002 Rafa Putra Rouf (2026-07)
  'dd58f7d8-ece1-4d3a-99a3-14b1cc3f3014': '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', // PTV-027 Malik Gundhaya Wiriarsa (2026-08)
  'd15eee01-0299-47fa-b5cb-0a6bcb25fcf0': '23f8a9cf-cb4e-4543-8207-7aef92692ead', // PTV-003 Muhammad Farras Zaidan Mubarok (2026-07)
  '729a42f4-7dfb-458d-88ab-a77db47bd9ac': '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', // PTV-027 Malik Gundhaya Wiriarsa (2026-09 Rp25rb lama)
  'c00113cd-0d69-41cd-8636-b67a54297145': '22d7d714-f163-46d5-b691-46455eb8a28a', // PTV-024 Fathur Rahmanhadi Saputra (2026-08)
  '2ed7625a-7634-42ac-bb65-e4ec0cdb9cc3': '02cade6b-16df-426a-b7b7-a59c60581187', // PTV-002 Rafa Putra Rouf (2026-09)
  'f90de314-82c0-40e6-a30a-e671c3814841': '02cade6b-16df-426a-b7b7-a59c60581187', // PTV-002 Rafa Putra Rouf (2026-08)
  '065778e2-6422-4378-a6f3-7f1ee6536be8': '73ee2fcd-f736-4258-b4cf-9e1745546c4c', // PTV-028 Muhammad Daghfal Faizullah (2026-07)
  '080be20b-4fa2-456e-aa06-b5d9a22a8f8b': '73ee2fcd-f736-4258-b4cf-9e1745546c4c', // PTV-028 Muhammad Daghfal Faizullah (2026-08)
  'a595abcc-d761-40e5-abf3-e0670a848f24': 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', // PTV-032 Rex Ruizhi Gajendra (2026-10)
  '955a4e65-7a48-404d-86da-a6bf0dccd3ba': 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', // PTV-032 Rex Ruizhi Gajendra (2026-08)
  'c1518f9f-6c4f-43ba-8a51-600b2243695d': 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', // PTV-032 Rex Ruizhi Gajendra (2026-07)
  '3fc1a854-8a3f-4db1-a3d0-152353191903': 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', // PTV-032 Rex Ruizhi Gajendra (2026-09)
  'd4b26581-0273-4782-987f-15c48618d0db': '29dc4b45-9465-4d90-9cb3-051438f067b7', // PTV-031 Nasshar Rasikh Arsyadiano (2026-10 reversed)
  '76412403-6a0d-45f8-97ba-35617a4fd997': '13db53b8-517a-44d5-b6db-b1eb204cf442', // PTV-026 Iyyaka Fahabil Farhan (2026-09 reversed)
  'e99e1015-f5b5-444b-86c6-929b0e9c5ce0': '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', // PTV-027 Malik Gundhaya Wiriarsa (2026-10)
  'cfb29351-b4d4-47f9-b3eb-41b37d0d61d2': '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', // PTV-016 Muhammad Izzur Fauzil Adhim (2026-10)
  'e5e32537-a432-476a-9203-324de4b1f527': '0f97447d-bc24-48e0-948d-e36b1f53049d', // PTV-023 Farsya Naufal Rahmandika (2026-08)
  '1b4cc2ac-563a-4669-8bbf-55164fd1c6d1': '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', // PTV-016 Muhammad Izzur Fauzil Adhim (2026-09)
  '9fc18040-2d23-42be-b02c-8c59f0da1b6d': '0f97447d-bc24-48e0-948d-e36b1f53049d', // PTV-023 Farsya Naufal Rahmandika (2026-07)
  '4a79468f-6894-480a-8a10-9768fd4b1346': 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c', // PTV-006 Arham Putra Nur Baasith (2026-07 reversed)
  '6545ac5f-9f40-4622-ac78-864a49313c1f': 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c', // PTV-006 Arham Putra Nur Baasith (2026-07)
  'f470938a-3fdb-4b37-ba12-1cac6c26eb42': 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c', // PTV-006 Arham Putra Nur Baasith (2026-08)
  'c3f93d1a-dbf3-4d45-93e9-7eacdf4eccee': '23265396-401c-409a-a0d1-09dbc95507ca', // PTV-033 Taqiu Rabbani Fadillah (2026-09)
  'c2544e87-0b8a-409d-87da-fe8f62454605': '23265396-401c-409a-a0d1-09dbc95507ca', // PTV-033 Taqiu Rabbani Fadillah (2026-10)
  '22f45d76-f4e6-4439-ba7e-0f63927f2291': '23265396-401c-409a-a0d1-09dbc95507ca', // PTV-033 Taqiu Rabbani Fadillah (2026-07)
  'efb7f62f-a97e-4ade-823e-fc6bfa6af03c': '0fef4539-8fe1-424e-b215-74d917c14be3', // PTV-018 Niki Santri (2026-07 reversed)
};

const DIVISION_DISPLAY_MAP: Record<string, string> = {
  editor: 'Editor',
  layouter: 'Layouter',
  technical: 'Technical',
  engagements: 'Engagement',
};

const EXCLUDED_TEST_PTV_IDS = new Set([
  'PTV-STG-ADM',
  'PTV-STG-KRU',
  'PTV-TEST-171',
  'PTV-017', // Kru Testing Integrasi (testkru_1790141364)
]);

/**
 * Membaca daftar kru kanonikal langsung dari `canonical_identity` dan `organization_membership`
 * pada Supabase staging.
 */
export async function fetchCanonicalCrewRosterWithClient(
  supabase: SupabaseClient,
  ptvId?: string
): Promise<CrewMember[]> {
  let identQuery = supabase.from('canonical_identity').select('id, ptv_id, full_name, metadata').order('ptv_id');
  if (ptvId) {
    identQuery = identQuery.eq('ptv_id', ptvId);
  }
  const [identRows, memRows] = await Promise.all([
    readAllRows(identQuery),
    readAllRows(
      supabase
        .from('organization_membership')
        .select('identity_id, division_id, position_title, cohort, status_organisasi, period_start, is_current')
        .eq('organization_id', 'ptv_studio')
        .order('id')
    ),
  ]);

  const membershipByIdentityId = new Map<string, any>();
  for (const m of memRows) {
    if (!membershipByIdentityId.has(m.identity_id) || m.is_current) {
      membershipByIdentityId.set(m.identity_id, m);
    }
  }

  const roster: CrewMember[] = [];

  for (const ident of identRows) {
    const code = String(ident.ptv_id || '').trim();
    if (!code || EXCLUDED_TEST_PTV_IDS.has(code)) continue;
    if (ident.metadata?.target === 'hub_test') continue;

    const mem = membershipByIdentityId.get(ident.id);
    if (!mem) continue;

    const divId = String(mem.division_id || '').toLowerCase().trim();
    const posTitle = String(mem.position_title || 'Kru').trim();
    const cohortNum = Number(mem.cohort ?? 0);
    const isOrgActive = mem.status_organisasi === 'active';

    // Kategorisasi keanggotaan dari organization_membership & canonical_identity
    let category: CrewCategory = 'Kru';
    if (!divId) {
      const lowerPos = posTitle.toLowerCase();
      if (lowerPos.includes('pembina')) {
        category = 'Pembina';
      } else if (lowerPos.includes('pengarah') || lowerPos.includes('pengasuh')) {
        category = 'Pengarah';
      } else {
        // Akun tanpa divisi operasional dan bukan pembina/pengarah
        continue;
      }
    } else if (cohortNum <= 0) {
      // Akun non-angkatan (mis. Media Santri Putri cohort 0) bukan peserta wajib kas kru reguler
      continue;
    }

    roster.push({
      id: ident.id, // UUID canonical_identity.id
      ptv_id: code,
      full_name: String(ident.full_name || '').trim(),
      username: code.toLowerCase(),
      role: 'kru',
      category,
      division: DIVISION_DISPLAY_MAP[divId] || (category !== 'Kru' ? category : 'Technical'),
      position: posTitle,
      angkatan: cohortNum > 0 ? cohortNum : '-',
      join_date: mem.period_start ? String(mem.period_start).slice(0, 10) : undefined,
      status_kru: isOrgActive ? 'Aktif' : 'Nonaktif',
      status_akun: isOrgActive ? 'Aktif' : 'Nonaktif',
      status_organisasi: mem.status_organisasi,
    });
  }

  return roster;
}

export async function fetchKasKruTariffConfigWithClient(supabase: SupabaseClient): Promise<PersistedKasKruTariffConfig> {
  try {
    const { data, error } = await supabase
      .from('ptv_portal_settings')
      .select('draft_payload, updated_at')
      .eq('id', KAS_KRU_TARIFF_CONFIG_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.draft_payload || typeof data.draft_payload !== 'object') {
      return { monthlyFeesBySemester: {}, feeHistory: [] };
    }
    const payload = data.draft_payload as Record<string, any>;
    const monthlyFeesBySemester =
      payload.monthlyFeesBySemester && typeof payload.monthlyFeesBySemester === 'object'
        ? payload.monthlyFeesBySemester
        : {};
    const feeHistory = Array.isArray(payload.feeHistory) ? payload.feeHistory : [];
    return {
      monthlyFeesBySemester,
      feeHistory,
      updatedAt: data.updated_at,
    };
  } catch {
    return { monthlyFeesBySemester: {}, feeHistory: [] };
  }
}

export async function fetchSemestersCloudWithClient(supabase: SupabaseClient): Promise<FinanceSemester[]> {
  const [data, tariffConfig] = await Promise.all([
    readAllRows(
      supabase
        .from('ptv_finance_semesters')
        .select('*')
        .order('start_date', { ascending: false })
        .order('id')
    ),
    fetchKasKruTariffConfigWithClient(supabase),
  ]);

  return (data || []).map(row => {
    const rawMonthlyFees = row.monthly_fees && typeof row.monthly_fees === 'object' ? row.monthly_fees : {};
    const fallbackFees = STAGING_SEMESTER_HISTORICAL_FEES[row.id] || {};
    const persistedFees = tariffConfig.monthlyFeesBySemester[row.id] || {};
    const mergedMonthlyFees: Record<string, string> = {
      ...fallbackFees,
      ...rawMonthlyFees,
      ...persistedFees,
    };
    return {
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      monthlyFeeMinor: String(row.monthly_fee_minor),
      monthlyFees: mergedMonthlyFees,
      isActive: Boolean(row.is_active),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
    };
  });
}

export async function fetchKasRecordsCloudWithClient(supabase: SupabaseClient, semesterId?: string, ptvId?: string): Promise<KasKruRecord[]> {
  let query = supabase.from('ptv_finance_kas_records').select('*');
  if (semesterId) {
    query = query.eq('semester_id', semesterId);
  }
  if (ptvId) query = query.eq('ptv_id', ptvId);
  const data = await readAllRows(query.order('period', { ascending: true }).order('id'));

  const explicitRecords: KasKruRecord[] = (data || []).map(row => ({
    id: row.id,
    semesterId: row.semester_id,
    identityId: row.identity_id || null,
    ptvId: row.ptv_id,
    crewName: row.crew_name,
    period: row.period,
    amountMinor: String(row.amount_minor),
    paidAmountMinor: String(row.paid_amount_minor),
    status: row.status,
    paymentDate: row.payment_date,
    method: row.method,
    pocketId: row.pocket_id,
    transactionId: row.transaction_id,
    notes: row.notes,
    auditReference: row.audit_reference,
    reversalReason: row.reversal_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Reconcile with canonical ledger transactions from ptv_finance_transactions
  try {
    const [txRes, identRes, semRes] = await Promise.all([
      supabase
        .from('ptv_finance_transactions')
        .select('*')
        .or('description.ilike.%iuran%,description.ilike.%kas kru%,category_id.eq.e6852c70-5f57-436b-84e1-fc85752ad4dc')
        .order('occurred_on', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('canonical_identity').select('id, ptv_id, full_name, metadata'),
      supabase.from('ptv_finance_semesters').select('*'),
    ]);

    if (!txRes.error && txRes.data && !identRes.error && identRes.data) {
      const crewById = new Map<string, { id: string; ptv_id: string; full_name: string }>();
      const crewByPtvId = new Map<string, { id: string; ptv_id: string; full_name: string }>();
      const crewByName = new Map<string, { id: string; ptv_id: string; full_name: string }>();

      identRes.data.forEach((c: { id: string; full_name: string; ptv_id: string }) => {
        if (c.id) crewById.set(c.id, c);
        if (c.ptv_id) crewByPtvId.set(c.ptv_id.toUpperCase().trim(), c);
        if (c.full_name) crewByName.set(c.full_name.toLowerCase().trim(), c);
      });

      // Lengkapi identityId pada explicitRecords jika belum terisi
      for (const rec of explicitRecords) {
        if (!rec.identityId && rec.ptvId) {
          const matched = crewByPtvId.get(rec.ptvId.toUpperCase().trim());
          if (matched) {
            rec.identityId = matched.id;
            rec.crewName = matched.full_name;
          } else {
            rec.identityUnlinked = true;
          }
        }
      }

      const monthsMap: Record<string, string> = {
        januari: '01', februari: '02', maret: '03', april: '04',
        mei: '05', juni: '06', juli: '07', agustus: '08',
        september: '09', oktober: '10', november: '11', desember: '12',
      };

      const existingTxIds = new Set(explicitRecords.map(r => r.transactionId).filter(Boolean));

      for (const tx of txRes.data) {
        if (existingTxIds.has(tx.id)) continue;
        const desc: string = tx.description || '';
        if (desc.trim().startsWith('[TEST]')) continue;
        const isReversed = tx.status === 'reversed';
        const parts = desc.split('—').map((p: string) => p.trim());
        const monthRegex = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i;
        const periodIdx = parts.findIndex((p: string) => monthRegex.test(p));
        if (periodIdx >= 1) {
          const crewNamePart = parts[periodIdx - 1];
          const periodPart = parts[periodIdx];

          // 1. Resolusi berbasis UUID identitas resmi terlebih dahulu (CANONICAL_KAS_TX_IDENTITY_UUID_MAP)
          const mappedUuid = CANONICAL_KAS_TX_IDENTITY_UUID_MAP[tx.id];
          let crew = mappedUuid ? crewById.get(mappedUuid) : undefined;

          // 2. Fallback ke kode PTV-ID eksplisit pada deskripsi jika ada (mis. "(PTV-031)")
          if (!crew) {
            const ptvMatch = desc.match(/\b(PTV-\d{3})\b/i);
            if (ptvMatch) {
              crew = crewByPtvId.get(ptvMatch[1].toUpperCase());
            }
          }

          // 3. Fallback pencocokan nama pada canonical_identity
          if (!crew) {
            crew = crewByName.get(crewNamePart.toLowerCase().trim());
          }

          // Jangan pernah membuat nama contoh jika tidak ditemukan di canonical_identity
          const isUnlinked = !crew;
          const targetIdentityId = crew ? crew.id : null;
          const targetPtvId = crew ? crew.ptv_id : 'UNLINKED';
          if (ptvId && targetPtvId !== ptvId) continue;

          const mMatch = periodPart.toLowerCase().match(monthRegex);
          const monthStr = mMatch ? monthsMap[mMatch[1].toLowerCase()] : undefined;
          const yearStr = mMatch ? mMatch[2] : undefined;
          const period = (monthStr && yearStr) ? `${yearStr}-${monthStr}` : 'UNKNOWN';
          if (period === 'UNKNOWN') continue;

          // Match semester
          let semId = semRes.data?.[0]?.id || 'sem-2026-ganjil';
          if (semRes.data && Array.isArray(semRes.data)) {
            for (const sem of semRes.data) {
              const startYM = (sem.start_date || '').slice(0, 7);
              const endYM = (sem.end_date || '').slice(0, 7);
              if (period >= startYM && period <= endYM) {
                semId = sem.id;
                break;
              }
            }
          }

          if (semesterId && semId !== semesterId) continue;

          const lowerDesc = desc.toLowerCase();
          const detectedMethod: 'cash' | 'transfer' | 'qris' = lowerDesc.includes('qris')
            ? 'qris'
            : lowerDesc.includes('tunai')
              ? 'cash'
              : 'transfer';

          const existingActiveIdx = explicitRecords.findIndex(r =>
            (targetIdentityId && r.identityId === targetIdentityId && r.period === period) ||
            (!targetIdentityId && r.ptvId === targetPtvId && r.crewName === crewNamePart && r.period === period)
          );

          const candidate: KasKruRecord = {
            id: `tx-kaskru-${tx.id}`,
            semesterId: semId,
            identityId: targetIdentityId,
            identityUnlinked: isUnlinked,
            ptvId: targetPtvId,
            crewName: crew ? crew.full_name : `${crewNamePart} (Identitas Belum Terhubung)`,
            period,
            amountMinor: String(tx.amount_minor),
            paidAmountMinor: isReversed ? '0' : String(tx.amount_minor),
            status: isReversed ? 'belum' : 'lunas',
            paymentDate: tx.occurred_on ? String(tx.occurred_on).slice(0, 10) : null,
            method: detectedMethod,
            pocketId: tx.incoming?.[0]?.pocketId || '60e8d033-2794-4219-a960-c56bedca0111',
            transactionId: tx.id,
            notes: tx.description,
            auditReference: tx.audit_reference || undefined,
            reversalReason: isReversed ? (tx.reversal_reason || 'Dibatalkan') : undefined,
            createdAt: tx.created_at || new Date().toISOString(),
            updatedAt: tx.created_at || new Date().toISOString(),
          };

          if (existingActiveIdx >= 0) {
            const prevRec = explicitRecords[existingActiveIdx];
            const officialPeriodFee = STAGING_SEMESTER_HISTORICAL_FEES[semId]?.[period];
            if (prevRec.status === 'belum' && !isReversed) {
              explicitRecords[existingActiveIdx] = candidate;
            } else if (!isReversed && officialPeriodFee && candidate.amountMinor === officialPeriodFee && prevRec.amountMinor !== officialPeriodFee) {
              // Prioritaskan transaksi yang sesuai tarif resmi periode (rekonsiliasi perubahan tarif Sep 2026 Rp25rb -> Rp20rb)
              explicitRecords[existingActiveIdx] = candidate;
            }
          } else {
            explicitRecords.push(candidate);
          }
        }
      }
    }
  } catch (err: unknown) {
    console.warn('[financeOperationalReader] Rekonsiliasi transaksi kas kru dilewati:', err);
  }

  return explicitRecords;
}

export async function fetchLoansCloudWithClient(supabase: SupabaseClient, ptvId?: string): Promise<PiutangRecord[]> {
  let query = supabase.from('ptv_finance_loans').select('*');
  if (ptvId) query = query.eq('borrower_type', 'kru').eq('borrower_id', ptvId);
  const loans = await readAllRows(query.order('created_at', { ascending: false }).order('id'));
  const ids = loans.map(row => row.id);
  const payments: any[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const page = await readAllRows(supabase.from('ptv_finance_loan_payments').select('*')
      .in('loan_id', ids.slice(start, start + 100)).order('paid_on', { ascending: true }).order('id'));
    payments.push(...page);
  }

  const paymentsByLoanId = new Map<string, PiutangPayment[]>();
  for (const p of payments) {
    const list = paymentsByLoanId.get(p.loan_id) || [];
    list.push({
      id: p.id,
      loanId: p.loan_id,
      paidOn: p.paid_on,
      amountMinor: String(p.amount_minor),
      toPocketId: p.to_pocket_id,
      receiptTxId: p.receipt_tx_id,
      method: p.method,
      notes: p.notes,
      createdAt: p.created_at || new Date().toISOString(),
      status: p.status,
      reversalReason: p.reversal_reason,
    });
    paymentsByLoanId.set(p.loan_id, list);
  }

  return loans.map(row => ({
    id: row.id,
    borrowerType: row.borrower_type,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact,
    borrowerInstitution: row.borrower_institution,
    principalMinor: String(row.principal_minor),
    interestType: row.interest_type || 'none',
    interestRatePercent: Number(row.interest_rate_percent || 0),
    interestMinor: String(row.interest_minor || '0'),
    totalDueMinor: String(row.total_due_minor),
    totalPaidMinor: String(row.total_paid_minor),
    remainingMinor: String(row.remaining_minor),
    disbursedOn: row.disbursed_on,
    dueDate: row.due_date,
    disbursedFromPocketId: row.disbursed_from_pocket_id,
    disbursementTxId: row.disbursement_tx_id,
    status: row.status,
    purpose: row.purpose,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payments: paymentsByLoanId.get(row.id) || [],
  }));
}

export async function fetchFinanceSettingsCloudWithClient(supabase: SupabaseClient): Promise<FinanceOperationalSettings | null> {
  const { data, error } = await supabase
    .from('ptv_finance_settings')
    .select('*')
    .eq('id', 'studio_default')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    defaultMonthlyFeeMinor: String(data.default_monthly_fee_minor),
    feeDueDay: data.fee_due_day,
    defaultLoanDueDays: data.default_loan_due_days,
    treasurerName: data.treasurer_name,
    treasurerPtvId: data.treasurer_ptv_id,
    treasurerPhone: data.treasurer_phone,
    officialBankPocketId: data.official_bank_pocket_id,
    officialQrisPocketId: data.official_qris_pocket_id,
  };
}
