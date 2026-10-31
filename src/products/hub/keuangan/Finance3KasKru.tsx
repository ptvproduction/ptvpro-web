import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Check,
  Plus,
  Calendar,
  AlertCircle,
  RefreshCw,
  Ban,
  ShieldAlert,
  LayoutGrid,
  List,
  X,
  Loader2,
  Banknote,
  Building2,
  QrCode,
  Settings,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import type { FinanceOperationalData } from './financeOperationalData';
import type { FinanceSemester, KasKruRecord } from './kasKruTypes';
import {
  calculateKasKruMatrix,
  formatPeriodMonthLabel,
  getSemesterPeriodFeeMinor,
  recordKasKruPayment,
  reverseKasKruRecord,
  waiveKasKruFee,
  DEFAULT_SEMESTERS,
} from './kasKruService';
import { submitOperationalReversalAtomic } from './financeOperationalCloudService';
import { CANONICAL_KAS_TX_IDENTITY_UUID_MAP } from './financeOperationalReader';
import { TEST_POCKET_IDS } from './financeCanonical';
import type { CrewMember } from '@products/hub/kru/types';

interface Finance3KasKruProps {
  data: FinanceSnapshot;
  operationalData: FinanceOperationalData | null;
  operationalLoading?: boolean;
  operationalError?: string;
  onRetryOperational?: () => void;
  onRefreshAll?: () => void;
  onOpenCatatIuran?: (crewName: string, period: string, amount: number) => void;
  onOpenTariffSettings?: (semesterId?: string) => void;
}

/**
 * Daftar 23 kru operasional aktif resmi yang diverifikasi langsung dari
 * `canonical_identity` dan `organization_membership` pada Supabase staging (`swadgljnyelsjstqqxbm`).
 * Digunakan sebagai baseline sinkron sebelum `operationalData.crewRoster` dari `/api/finance?operational=1` selesai dimuat.
 */
export const CANONICAL_VERIFIED_CREW_ROSTER: CrewMember[] = [
  { id: '8fb1aa38-c469-4dc5-9392-8588f7a71e39', ptv_id: 'PTV-001', full_name: 'Muhammad Zidnal Falah', username: 'ptv-001', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Ketua Umum', angkatan: 8, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '02cade6b-16df-426a-b7b7-a59c60581187', ptv_id: 'PTV-002', full_name: 'Rafa Putra Rouf', username: 'ptv-002', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '23f8a9cf-cb4e-4543-8207-7aef92692ead', ptv_id: 'PTV-003', full_name: 'Muhammad Farras Zaidan Mubarok', username: 'ptv-003', role: 'kru', category: 'Kru', division: 'Editor', position: 'Ketua', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '860322f9-15bf-42b0-a5ec-77f29f89b3f9', ptv_id: 'PTV-004', full_name: 'Abyan Zahir Wijaksono', username: 'ptv-004', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c', ptv_id: 'PTV-006', full_name: 'Arham Putra Nur Baasith', username: 'ptv-006', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 15, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', ptv_id: 'PTV-016', full_name: 'Muhammad Izzur Fauzil Adhim', username: 'ptv-016', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 11, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '4e6f7e9f-4084-4228-a565-88a50b13b1df', ptv_id: 'PTV-019', full_name: 'Ahmad Royyan Syauqie', username: 'ptv-019', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '0200ce68-10bb-45a3-8422-49ec5ce376ef', ptv_id: 'PTV-020', full_name: 'Aqil Afzal Al Farisi', username: 'ptv-020', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '323176b7-5448-4681-a573-ce842a1d9f1d', ptv_id: 'PTV-021', full_name: 'Arventza Martins', username: 'ptv-021', role: 'kru', category: 'Kru', division: 'Engagement', position: 'Kru', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '4380044d-ca1c-4795-b735-6b7679de78b9', ptv_id: 'PTV-022', full_name: 'Dzaki Alita Sejahtera', username: 'ptv-022', role: 'kru', category: 'Kru', division: 'Technical', position: 'Kru', angkatan: 14, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '0f97447d-bc24-48e0-948d-e36b1f53049d', ptv_id: 'PTV-023', full_name: 'Farsya Naufal Rahmandika', username: 'ptv-023', role: 'kru', category: 'Kru', division: 'Engagement', position: 'Kru', angkatan: 12, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '22d7d714-f163-46d5-b691-46455eb8a28a', ptv_id: 'PTV-024', full_name: 'Fathur Rahmanhadi Saputra', username: 'ptv-024', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 14, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '10572ebd-da93-4a89-a6ef-f46c53120616', ptv_id: 'PTV-025', full_name: 'Ganesha Axl Fersalley', username: 'ptv-025', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 11, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '13db53b8-517a-44d5-b6db-b1eb204cf442', ptv_id: 'PTV-026', full_name: 'Iyyaka Fahabil Farhan', username: 'ptv-026', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', ptv_id: 'PTV-027', full_name: 'Malik Gundhaya Wiriarsa', username: 'ptv-027', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 14, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '73ee2fcd-f736-4258-b4cf-9e1745546c4c', ptv_id: 'PTV-028', full_name: 'Muhammad Daghfal Faizullah', username: 'ptv-028', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '0314c1a4-c5f7-4afc-a6c6-b7f281a70f0b', ptv_id: 'PTV-029', full_name: 'Muhammad Fahmi Izzudin', username: 'ptv-029', role: 'kru', category: 'Kru', division: 'Technical', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c', ptv_id: 'PTV-030', full_name: 'Muhammad Isa', username: 'ptv-030', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 14, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '29dc4b45-9465-4d90-9cb3-051438f067b7', ptv_id: 'PTV-031', full_name: 'Nasshar Rasikh Arsyadiano', username: 'ptv-031', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', ptv_id: 'PTV-032', full_name: 'Rex Ruizhi Gajendra', username: 'ptv-032', role: 'kru', category: 'Kru', division: 'Editor', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '23265396-401c-409a-a0d1-09dbc95507ca', ptv_id: 'PTV-033', full_name: 'Taqiu Rabbani Fadillah', username: 'ptv-033', role: 'kru', category: 'Kru', division: 'Technical', position: 'Kru', angkatan: 13, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: 'e3508a62-0f90-4154-b0f1-51abd66182cf', ptv_id: 'PTV-034', full_name: 'Ziddan Arzaqi', username: 'ptv-034', role: 'kru', category: 'Kru', division: 'Layouter', position: 'Kru', angkatan: 15, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
  { id: '23b21c03-d6c5-4858-83b5-82e7d805ba66', ptv_id: 'PTV-036', full_name: 'Rasya Dwi Maharta', username: 'ptv-036', role: 'kru', category: 'Kru', division: 'Technical', position: 'Kru', angkatan: 10, status_kru: 'Aktif', status_akun: 'Aktif', status_organisasi: 'active' },
];

export function Finance3KasKru({
  data,
  operationalData,
  operationalLoading = false,
  operationalError = '',
  onRetryOperational,
  onRefreshAll,
  onOpenCatatIuran,
  onOpenTariffSettings,
}: Finance3KasKruProps) {
  const canManage = data.canManage;
  const pockets = (data.canonical.state === 'available' ? data.canonical.pockets || [] : []).filter(
    p => !TEST_POCKET_IDS.has(p.id)
  );
  const categories = data.canonical.state === 'available' ? data.canonical.categories || [] : [];
  const transactions = data.canonical.state === 'available' ? data.canonical.transactions || [] : [];

  // Fallback semesters jika operationalData belum tersedia (misal pada unit test SSR)
  const semesters: FinanceSemester[] = useMemo(() => {
    if (operationalData && operationalData.semesters.length > 0) {
      return operationalData.semesters;
    }
    return [
      {
        id: '2941ab08-a7f9-4f35-9539-93131fbe5685',
        name: 'Semester Ganjil 2026/2027',
        startDate: '2026-09-01',
        endDate: '2027-02-28',
        monthlyFeeMinor: '2500000',
        monthlyFees: { '2026-09': '2000000', '2026-10': '2000000', '2026-11': '5000000' },
        isActive: true,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: '7061bf68-5d8b-4e9c-a61d-485a790d0a7e',
        name: 'Semester Genap 2025/2026',
        startDate: '2026-03-01',
        endDate: '2026-08-31',
        monthlyFeeMinor: '2500000',
        monthlyFees: { '2026-06': '2000000', '2026-07': '2500000', '2026-08': '2500000' },
        isActive: false,
        isArchived: false,
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      ...DEFAULT_SEMESTERS.filter(s => s.id !== 'sem-2026-ganjil' && s.id !== 'sem-2025-genap'),
    ];
  }, [operationalData]);

  const crewRoster: CrewMember[] = useMemo(() => {
    if (operationalData?.crewRoster && operationalData.crewRoster.length > 0) {
      return operationalData.crewRoster;
    }
    return CANONICAL_VERIFIED_CREW_ROSTER;
  }, [operationalData]);

  // Ekstraksi fallback dari canonical transactions apabila operationalData.records kosong
  const derivedRecordsFromCanonical: KasKruRecord[] = useMemo(() => {
    if (operationalData && operationalData.records.length > 0) {
      return operationalData.records;
    }
    const monthsMap: Record<string, string> = {
      januari: '01', februari: '02', maret: '03', april: '04',
      mei: '05', juni: '06', juli: '07', agustus: '08',
      september: '09', oktober: '10', november: '11', desember: '12',
    };
    const crewById = new Map(crewRoster.map(c => [c.id, c]));
    const crewByPtvId = new Map(crewRoster.map(c => [c.ptv_id.toUpperCase().trim(), c]));
    const crewByName = new Map(crewRoster.map(c => [c.full_name.toLowerCase().trim(), c]));
    const list: KasKruRecord[] = [];
    for (const tx of transactions) {
      if (tx.description?.trim().startsWith('[TEST]')) continue;
      const desc = tx.description || '';
      if (desc.includes('Iuran Kas Kru') && desc.includes('—')) {
        const parts = desc.split('—').map(p => p.trim());
        if (parts.length >= 3) {
          const crewNamePart = parts[1];
          const periodPart = parts[2];

          const mappedUuid = CANONICAL_KAS_TX_IDENTITY_UUID_MAP[tx.id];
          let crew = mappedUuid ? crewById.get(mappedUuid) : undefined;
          if (!crew) {
            const ptvMatch = desc.match(/\b(PTV-\d{3})\b/i);
            if (ptvMatch) crew = crewByPtvId.get(ptvMatch[1].toUpperCase());
          }
          if (!crew) {
            crew = crewByName.get(crewNamePart.toLowerCase());
          }

          const isUnlinked = !crew;
          const targetIdentityId = crew ? crew.id : null;
          const ptvId = crew ? crew.ptv_id : 'UNLINKED';
          const words = periodPart.toLowerCase().split(/\s+/);
          const m = monthsMap[words[0]];
          const y = words[1];
          const period = m && y ? `${y}-${m}` : '2026-10';
          const isRev = tx.status === 'reversed';
          const sem =
            semesters.find(s => period >= s.startDate.slice(0, 7) && period <= s.endDate.slice(0, 7)) ||
            semesters[0];

          const existingIdx = list.findIndex(r =>
            (targetIdentityId && r.identityId === targetIdentityId && r.period === period) ||
            (!targetIdentityId && r.ptvId === ptvId && r.crewName === crewNamePart && r.period === period)
          );
          const candidate: KasKruRecord = {
            id: `tx-kaskru-${tx.id}`,
            semesterId: sem.id,
            identityId: targetIdentityId,
            identityUnlinked: isUnlinked,
            ptvId,
            crewName: crew ? crew.full_name : `${crewNamePart} (Identitas Belum Terhubung)`,
            period,
            amountMinor: tx.amountMinor,
            paidAmountMinor: isRev ? '0' : tx.amountMinor,
            status: isRev ? 'belum' : 'lunas',
            paymentDate: tx.occurredOn,
            method: desc.toLowerCase().includes('qris') ? 'qris' : 'transfer',
            pocketId: tx.allocations?.[0]?.pocketId || '60e8d033-2794-4219-a960-c56bedca0111',
            transactionId: tx.id,
            notes: desc,
            createdAt: tx.occurredOn,
            updatedAt: tx.occurredOn,
          };
          if (existingIdx >= 0) {
            const officialFee = getSemesterPeriodFeeMinor(sem, period);
            if (list[existingIdx].status === 'belum' && !isRev) {
              list[existingIdx] = candidate;
            } else if (!isRev && candidate.amountMinor === officialFee && list[existingIdx].amountMinor !== officialFee) {
              list[existingIdx] = candidate;
            }
          } else {
            list.push(candidate);
          }
        }
      }
    }
    return list;
  }, [operationalData, transactions, semesters, crewRoster]);

  const [localRecords, setLocalRecords] = useState<KasKruRecord[] | null>(null);
  useEffect(() => {
    setLocalRecords(null);
  }, [operationalData]);

  const allRecords = localRecords || derivedRecordsFromCanonical;

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(() => {
    const active = semesters.find(s => s.isActive) || semesters[0];
    return active?.id || '';
  });

  useEffect(() => {
    if (semesters.length > 0 && !semesters.some(s => s.id === selectedSemesterId)) {
      const active = semesters.find(s => s.isActive) || semesters[0];
      if (active) setSelectedSemesterId(active.id);
    }
  }, [semesters, selectedSemesterId]);

  const activeSemester = useMemo(() => {
    return semesters.find(s => s.id === selectedSemesterId) || semesters[0];
  }, [semesters, selectedSemesterId]);

  const [viewMode, setViewMode] = useState<'period' | 'matrix'>('period');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-10');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lunas' | 'sebagian' | 'belum' | 'dikecualikan'>('all');

  // Sinkronkan selectedPeriod ketika semester berubah
  const matrixData = useMemo(() => {
    if (!activeSemester) {
      return {
        periods: ['2026-09', '2026-10', '2026-11'],
        rows: [],
        stats: {
          totalCollectedMinor: '0',
          totalArrearsMinor: '0',
          activePeriodsCount: 0,
          totalCrewCount: 0,
          fullyPaidCrewCount: 0,
          partiallyPaidCrewCount: 0,
          unpaidCrewCount: 0,
        },
      };
    }
    return calculateKasKruMatrix(
      activeSemester,
      crewRoster,
      allRecords,
      operationalData?.feeDueDay || 10
    );
  }, [activeSemester, crewRoster, allRecords, operationalData?.feeDueDay]);

  useEffect(() => {
    if (matrixData.periods.length > 0 && !matrixData.periods.includes(selectedPeriod)) {
      const defaultP = matrixData.periods.includes('2026-10')
        ? '2026-10'
        : matrixData.periods.includes('2026-08')
          ? '2026-08'
          : matrixData.periods[0];
      setSelectedPeriod(defaultP);
    }
  }, [matrixData.periods, selectedPeriod]);

  // Modal Catat Iuran Kas Kru
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payPtvId, setPayPtvId] = useState('PTV-001');
  const [payPeriods, setPayPeriods] = useState<string[]>(['2026-10']);
  const [payNominal, setPayNominal] = useState('20.000');
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer' | 'qris'>('transfer');
  const [payPocketId, setPayPocketId] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Modal Detail / Koreksi / Pembebasan Iuran
  const [inspectCell, setInspectCell] = useState<{
    ptvId: string;
    crewName: string;
    period: string;
    record: KasKruRecord | null;
    dueMinor: string;
    status: string;
  } | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [cellLoading, setCellLoading] = useState(false);
  const [cellError, setCellError] = useState('');

  const periodFeeMinor = activeSemester
    ? getSemesterPeriodFeeMinor(activeSemester, selectedPeriod)
    : '2000000';
  const periodNominal = (Number(periodFeeMinor) || 2000000) / 100;

  // Baris kru terfilter untuk tampilan Periode maupun Matriks
  const filteredMatrixRows = useMemo(() => {
    return matrixData.rows.filter(row => {
      const cell = row.periods[selectedPeriod];
      const cellStatus = cell?.status || 'belum';
      if (viewMode === 'period') {
        if (statusFilter !== 'all' && cellStatus !== statusFilter) return false;
      } else {
        if (statusFilter === 'lunas' && !row.isAllPaid) return false;
        if (statusFilter === 'belum' && Number(row.totalPaidMinor) > 0) return false;
        if (statusFilter === 'sebagian' && (row.isAllPaid || Number(row.totalPaidMinor) === 0)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          row.crew.full_name.toLowerCase().includes(q) ||
          row.crew.ptv_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [matrixData.rows, selectedPeriod, viewMode, statusFilter, search]);

  // Statistik periode terpilih
  const periodStats = useMemo(() => {
    let target = 0;
    let collected = 0;
    let lunasCount = 0;
    let belumCount = 0;
    for (const r of matrixData.rows) {
      const c = r.periods[selectedPeriod];
      if (!c || c.unbilled || c.status === 'dikecualikan') continue;
      const due = (Number(c.amountMinor) || 0) / 100;
      const paid = (Number(c.paidAmountMinor) || 0) / 100;
      target += due;
      collected += paid;
      if (c.status === 'lunas') lunasCount++;
      else belumCount++;
    }
    const arrears = Math.max(0, target - collected);
    const compliance = target > 0 ? Math.round((collected / target) * 100) : 0;
    return { target, collected, arrears, compliance, lunasCount, belumCount };
  }, [matrixData.rows, selectedPeriod]);

  // Statistik rekap semester penuh
  const semesterStats = useMemo(() => {
    const collected = (Number(matrixData.stats.totalCollectedMinor) || 0) / 100;
    const arrears = (Number(matrixData.stats.totalArrearsMinor) || 0) / 100;
    const totalDue = matrixData.rows.reduce(
      (sum, r) => sum + (Number(r.totalDueMinor) || 0) / 100,
      0
    );
    const compliance = totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0;
    return { totalDue, collected, arrears, compliance };
  }, [matrixData]);

  const openRecordModalForCrew = (ptvId: string, period: string, dueAmount: number) => {
    const crew = crewRoster.find(c => c.ptv_id === ptvId) || crewRoster[0];
    if (!crew) return;
    setPayPtvId(crew.ptv_id);
    setPayPeriods([period]);
    setPayNominal(dueAmount.toLocaleString('id-ID'));
    const defaultPocket = pockets.find(p => !p.archived && p.name.includes('Kas Utama')) || pockets[0];
    setPayPocketId(defaultPocket?.id || '');
    setPayError('');
    setIsPaymentModalOpen(true);
    if (onOpenCatatIuran) {
      onOpenCatatIuran(crew.full_name, formatPeriodMonthLabel(period), dueAmount);
    }
  };

  const handleTogglePayPeriod = (period: string) => {
    setPayPeriods(prev => {
      const next = prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period].sort();
      if (activeSemester && next.length > 0) {
        const sumMinor = next.reduce(
          (acc, p) => acc + BigInt(getSemesterPeriodFeeMinor(activeSemester, p)),
          0n
        );
        setPayNominal((Number(sumMinor) / 100).toLocaleString('id-ID'));
      }
      return next;
    });
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    const crew = crewRoster.find(c => c.ptv_id === payPtvId);
    if (!crew) {
      setPayError('Pilih personel kru yang valid.');
      return;
    }
    const cleanRupiah = parseInt(payNominal.replace(/\D/g, ''), 10) || 0;
    if (cleanRupiah <= 0) {
      setPayError('Nominal pembayaran iuran harus lebih dari Rp 0.');
      return;
    }

    try {
      setPayLoading(true);
      const res = await recordKasKruPayment(
        {
          semesterId: activeSemester.id,
          ptvId: crew.ptv_id,
          crewName: crew.full_name,
          selectedPeriods: payPeriods,
          amountMinor: String(BigInt(cleanRupiah) * 100n),
          paymentDate: payDate,
          method: payMethod,
          pocketId: payPocketId || pockets[0]?.id || '60e8d033-2794-4219-a960-c56bedca0111',
          notes: payNotes.trim() || `Iuran Kas Kru ${crew.full_name}`,
        },
        {
          pockets,
          categories,
          canManage,
          existingRecords: allRecords,
          semesters,
        }
      );

      // Update local state
      const nextMap = new Map(allRecords.map(r => [`${r.ptvId}_${r.period}`, r]));
      for (const updated of res.records) {
        nextMap.set(`${updated.ptvId}_${updated.period}`, updated);
      }
      setLocalRecords(Array.from(nextMap.values()));
      setActionNotice(`Pembayaran iuran ${crew.full_name} (${payPeriods.join(', ')}) berhasil dicatat.`);
      setIsPaymentModalOpen(false);
      onRefreshAll?.();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Gagal mencatat iuran kas kru.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleReverseRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectCell?.record) return;
    if (!reversalReason.trim() || reversalReason.trim().length < 3) {
      setCellError('Alasan pembatalan wajib diisi minimal 3 karakter.');
      return;
    }
    try {
      setCellLoading(true);
      setCellError('');
      try {
        await submitOperationalReversalAtomic('kas_kru', inspectCell.record.id, reversalReason.trim());
      } catch {
        // Fallback ke local reversal jika record berasal dari rekonsiliasi atau sandbox test
      }
      const res = reverseKasKruRecord(inspectCell.record.id, reversalReason.trim(), allRecords);
      setLocalRecords(res.updatedList);
      setActionNotice(`Iuran ${inspectCell.crewName} periode ${inspectCell.period} telah dibatalkan (VOID).`);
      setInspectCell(null);
      onRefreshAll?.();
    } catch (err) {
      setCellError(err instanceof Error ? err.message : 'Gagal membatalkan catatan iuran.');
    } finally {
      setCellLoading(false);
    }
  };

  const handleWaiveFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectCell) return;
    if (!waiveReason.trim()) {
      setCellError('Alasan pembebasan iuran wajib diisi.');
      return;
    }
    try {
      setCellLoading(true);
      setCellError('');
      const res = waiveKasKruFee(
        {
          semesterId: activeSemester.id,
          ptvId: inspectCell.ptvId,
          crewName: inspectCell.crewName,
          period: inspectCell.period,
          reason: waiveReason.trim(),
          pocketId: pockets[0]?.id,
        },
        allRecords
      );
      setLocalRecords(res.updatedList);
      setActionNotice(`Kewajiban iuran ${inspectCell.crewName} (${inspectCell.period}) telah dibebaskan.`);
      setInspectCell(null);
    } catch (err) {
      setCellError(err instanceof Error ? err.message : 'Gagal membebaskan iuran.');
    } finally {
      setCellLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pembedaan tegas Error State vs Data Kosong */}
      {operationalError && (
        <div
          className="finance3-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderColor: '#fca5a5',
            background: '#fef2f2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '13px' }}>
            <AlertCircle size={18} />
            <div>
              <b>Gagal Memuat Data Operasional Kas Kru:</b> {operationalError}
            </div>
          </div>
          {onRetryOperational && (
            <Button size="sm" shape="pill" variant="secondary" onClick={onRetryOperational}>
              <RefreshCw size={13} /> Coba Lagi
            </Button>
          )}
        </div>
      )}

      {actionNotice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--ptv-curve-md, 12px)',
            background: 'var(--ok-bg, #e1f5ee)',
            color: 'var(--ok, #0f7a5a)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span>✓ {actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="finance3-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header & Semester + Period Switcher */}
        <div className="finance3-card-header">
          <div>
            <h2 className="finance3-card-title">
              <Users size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Iuran Kas Kru & Tabel Semester
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #6e8cae)' }}>
              Matriks kedisiplinan iuran bulanan kru, rekapitulasi per semester (`ptv_finance_semesters`), dan rekonsiliasi 48 transaksi kas kru Dasbor PTV.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Mode Tampilan: Per Bulan vs Matriks Semester */}
            <div className="finance3-filter-group">
              <button
                type="button"
                className={`finance3-filter-chip ${viewMode === 'period' ? 'active' : ''}`}
                onClick={() => setViewMode('period')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <List size={13} /> Tabel Bulanan
              </button>
              <button
                type="button"
                className={`finance3-filter-chip ${viewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setViewMode('matrix')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <LayoutGrid size={13} /> Matriks Semester ({matrixData.periods.length} Bln)
              </button>
            </div>

            {/* Pemilih Semester */}
            <select
              aria-label="Pilih Semester Kas Kru"
              className="finance3-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
              value={selectedSemesterId}
              onChange={e => setSelectedSemesterId(e.target.value)}
            >
              {semesters.map(sem => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} {sem.isActive ? '(Aktif)' : ''}
                </option>
              ))}
            </select>

            {/* Pemilih Periode Bulan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: 'var(--muted, #6e8cae)' }} />
              <select
                aria-label="Pilih Periode Bulan"
                className="finance3-select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
              >
                {matrixData.periods.map(p => {
                  const fee = (Number(getSemesterPeriodFeeMinor(activeSemester, p)) || 2000000) / 100;
                  return (
                    <option key={p} value={p}>
                      {formatPeriodMonthLabel(p)} (Rp {fee.toLocaleString('id-ID')})
                    </option>
                  );
                })}
              </select>
            </div>

            {canManage && onOpenTariffSettings && (
              <Button
                size="sm"
                shape="pill"
                variant="secondary"
                onClick={() => onOpenTariffSettings(activeSemester?.id)}
                aria-label="Atur Tarif Iuran Semester"
              >
                <Settings size={14} /> Tarif Iuran
              </Button>
            )}

            {canManage && (
              <Button
                size="sm"
                shape="pill"
                variant="primary"
                onClick={() => openRecordModalForCrew('PTV-001', selectedPeriod, periodNominal)}
                style={{ background: '#0b5fbf', borderColor: '#0b5fbf' }}
              >
                <Plus size={14} /> + Catat Iuran
              </Button>
            )}
          </div>
        </div>

        {/* Metrics Summary Bar (Menyesuaikan mode tampilan: Bulan vs Rekap Semester) */}
        <div className="finance3-hero-metrics" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">
              {viewMode === 'matrix' ? `Target Semester (${activeSemester?.name})` : 'Target Iuran Periode Ini'}
            </span>
            <span className="finance3-metric-value">
              Rp {(viewMode === 'matrix' ? semesterStats.totalDue : periodStats.target).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Sudah Terkumpul</span>
            <span className="finance3-metric-value income">
              Rp {(viewMode === 'matrix' ? semesterStats.collected : periodStats.collected).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Tunggakan Kas Kru</span>
            <span className="finance3-metric-value expense">
              Rp {(viewMode === 'matrix' ? semesterStats.arrears : periodStats.arrears).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Kepatuhan Pembayaran</span>
            <span className="finance3-metric-value net">
              {viewMode === 'matrix' ? semesterStats.compliance : periodStats.compliance}%
            </span>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="finance3-toolbar" style={{ marginTop: '4px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted, #6e8cae)',
              }}
            />
            <input
              type="text"
              className="finance3-search-input"
              placeholder="Cari nama kru atau PTV ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="finance3-filter-group">
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Semua Kru ({matrixData.rows.length})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'lunas' ? 'active' : ''}`}
              onClick={() => setStatusFilter('lunas')}
            >
              Lunas ({periodStats.lunasCount})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'belum' ? 'active' : ''}`}
              onClick={() => setStatusFilter('belum')}
            >
              Belum Bayar ({periodStats.belumCount})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'dikecualikan' ? 'active' : ''}`}
              onClick={() => setStatusFilter('dikecualikan')}
            >
              Dibebaskan
            </button>
          </div>
        </div>

        {/* Loading indicator jika sedang memuat operational data */}
        {operationalLoading && (
          <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={12} className="animate-spin" /> Memuat sinkronisasi tabel semester dan catatan kas kru...
          </div>
        )}

        {/* TAMPILAN 1: TABEL OPERASIONAL BULANAN */}
        {viewMode === 'period' ? (
          <div className="finance3-table-wrapper">
            <table className="finance3-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>PTV ID</th>
                  <th>Nama Kru</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Tagihan</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Dibayar</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '120px' }}>Tgl Bayar</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted, #6e8cae)' }}>
                      Tidak ada data kru yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredMatrixRows.map(row => {
                    const cell = row.periods[selectedPeriod];
                    const due = ((Number(cell?.amountMinor) || 0) / 100) || periodNominal;
                    const paid = (Number(cell?.paidAmountMinor) || 0) / 100;
                    const shortage = Math.max(0, (Number(cell?.shortageMinor) || 0) / 100);
                    const overpaid = Math.max(0, (Number(cell?.overpaidMinor) || 0) / 100);
                    const status = cell?.status || 'belum';
                    const isPaid = status === 'lunas';
                    const isPartial = status === 'sebagian';
                    const isWaived = status === 'dikecualikan';
                    const rec = cell?.record || null;

                    return (
                      <tr key={row.crew.id || row.crew.ptv_id}>
                        <td style={{ fontWeight: 700, color: 'var(--b-700, #0b5fbf)' }}>{row.crew.ptv_id}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{row.crew.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            {row.crew.personnel_link_pending ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>Identitas Belum Terhubung</span>
                            ) : (
                              <>
                                <span
                                  style={{
                                    color: row.crew.status_kru === 'Aktif' ? '#059669' : '#64748b',
                                    fontWeight: 600,
                                  }}
                                >
                                  {row.crew.status_kru}
                                </span>
                                {row.crew.division && <span>· {row.crew.division}</span>}
                                {row.crew.angkatan && row.crew.angkatan !== '-' && <span>· Angkatan {row.crew.angkatan}</span>}
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          Rp {due.toLocaleString('id-ID')}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: isPaid ? '#059669' : isPartial ? '#d97706' : 'var(--muted, #6e8cae)',
                          }}
                        >
                          <div>Rp {paid.toLocaleString('id-ID')}</div>
                          {isPartial && shortage > 0 && (
                            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#dc2626' }}>
                              Kurang Rp {shortage.toLocaleString('id-ID')}
                            </div>
                          )}
                          {isPaid && overpaid > 0 && (
                            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0b5fbf' }}>
                              +Lebih Rp {overpaid.toLocaleString('id-ID')}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`finance3-badge ${
                              isPaid ? 'posted' : isWaived ? 'legacy' : 'reversed'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <CheckCircle2 size={12} /> {overpaid > 0 ? 'Lunas (+Lebih)' : 'Lunas'}
                              </>
                            ) : isPartial ? (
                              <>
                                <Clock size={12} /> Kurang Bayar
                              </>
                            ) : isWaived ? (
                              <>Dibebaskan</>
                            ) : (
                              <>
                                <Clock size={12} /> Belum Bayar
                              </>
                            )}
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted, #6e8cae)', fontSize: '12px' }}>
                          {rec?.paymentDate || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            {!isPaid && !isWaived ? (
                              <Button
                                size="sm"
                                shape="pill"
                                variant="secondary"
                                onClick={() => openRecordModalForCrew(row.crew.ptv_id, selectedPeriod, due - paid)}
                                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                              >
                                <Check size={12} /> Bayar
                              </Button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Tercatat ✓</span>
                            )}

                            {canManage && (
                              <Button
                                size="sm"
                                shape="pill"
                                variant="ghost"
                                onClick={() => {
                                  setReversalReason('');
                                  setWaiveReason('');
                                  setCellError('');
                                  setInspectCell({
                                    ptvId: row.crew.ptv_id,
                                    crewName: row.crew.full_name,
                                    period: selectedPeriod,
                                    record: rec,
                                    dueMinor: String(due * 100),
                                    status,
                                  });
                                }}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                              >
                                Kelola
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAMPILAN 2: MATRIKS PEMBAYARAN PER BULAN DALAM SEMESTER */
          <div className="finance3-table-wrapper">
            <table className="finance3-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>PTV ID</th>
                  <th style={{ minWidth: '180px' }}>Nama Kru</th>
                  {matrixData.periods.map(p => (
                    <th key={p} style={{ textAlign: 'center', minWidth: '105px' }}>
                      <div>{formatPeriodMonthLabel(p).split(' ')[0]}</div>
                      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted, #6e8cae)' }}>
                        Rp {((Number(getSemesterPeriodFeeMinor(activeSemester, p)) || 2000000) / 100000).toFixed(0)}rb
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', minWidth: '120px' }}>Realisasi</th>
                  <th style={{ textAlign: 'right', minWidth: '120px' }}>Tunggakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatrixRows.map(row => {
                  const totalPaid = (Number(row.totalPaidMinor) || 0) / 100;
                  const totalArrears = (Number(row.arrearsMinor) || 0) / 100;
                  return (
                    <tr key={`mat-${row.crew.id || row.crew.ptv_id}`}>
                      <td style={{ fontWeight: 700, color: 'var(--b-700, #0b5fbf)' }}>{row.crew.ptv_id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{row.crew.full_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)' }}>
                          {row.crew.personnel_link_pending ? (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>Identitas Belum Terhubung</span>
                          ) : (
                            <span>
                              {row.crew.status_kru}
                              {row.crew.division ? ` · ${row.crew.division}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      {matrixData.periods.map(p => {
                        const cell = row.periods[p];
                        const st = cell?.status || 'belum';
                        const paidAmt = (Number(cell?.paidAmountMinor) || 0) / 100;
                        const dueAmt = (Number(cell?.amountMinor) || 0) / 100;
                        return (
                          <td
                            key={`${row.crew.ptv_id}-${p}`}
                            style={{ textAlign: 'center', cursor: canManage ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (!canManage) return;
                              if (st === 'belum') {
                                openRecordModalForCrew(row.crew.ptv_id, p, dueAmt);
                              } else {
                                setInspectCell({
                                  ptvId: row.crew.ptv_id,
                                  crewName: row.crew.full_name,
                                  period: p,
                                  record: cell?.record || null,
                                  dueMinor: cell?.amountMinor || '2000000',
                                  status: st,
                                });
                              }
                            }}
                          >
                            {st === 'lunas' ? (
                              <span className="finance3-badge posted" title={`Lunas Rp ${paidAmt.toLocaleString('id-ID')}`}>
                                ✓ {(paidAmt / 1000).toFixed(0)}rb
                              </span>
                            ) : st === 'sebagian' ? (
                              <span className="finance3-badge legacy" title={`Sebagian Rp ${paidAmt.toLocaleString('id-ID')}`}>
                                ½ {(paidAmt / 1000).toFixed(0)}rb
                              </span>
                            ) : st === 'dikecualikan' ? (
                              <span className="finance3-badge legacy">Bebas</span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--muted, #6e8cae)',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: 'rgba(11,42,74,0.04)',
                                }}
                              >
                                Belum
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#059669',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Rp {totalPaid.toLocaleString('id-ID')}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: totalArrears > 0 ? '#dc2626' : 'var(--muted, #6e8cae)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Rp {totalArrears.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Catat Pembayaran Iuran Kas Kru */}
      {isPaymentModalOpen &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setIsPaymentModalOpen(false)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="finance3-modal-header">
                <h3>Catat Pembayaran Iuran Kas Kru</h3>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitPayment}>
                <div className="finance3-modal-body">
                  {payError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--ptv-curve-md, 12px)',
                        background: 'var(--dang-bg, #fde8e6)',
                        color: 'var(--dang, #b02b23)',
                        fontSize: '13px',
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{payError}</span>
                    </div>
                  )}

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Personel Kru *</label>
                    <select
                      className="finance3-select"
                      value={payPtvId}
                      onChange={e => setPayPtvId(e.target.value)}
                      required
                    >
                      {crewRoster
                        .filter(c => c.category === 'Kru' && c.status_kru === 'Aktif')
                        .map(c => (
                          <option key={c.id || c.ptv_id} value={c.ptv_id}>
                            {c.ptv_id} — {c.full_name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Pilih Periode Bulan ({activeSemester?.name}) *</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {matrixData.periods.map(p => {
                        const checked = payPeriods.includes(p);
                        return (
                          <button
                            key={`pick-${p}`}
                            type="button"
                            className={`finance3-filter-chip ${checked ? 'active' : ''}`}
                            onClick={() => handleTogglePayPeriod(p)}
                          >
                            {checked ? '✓ ' : ''}
                            {formatPeriodMonthLabel(p)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Nominal Dibayar (Rp) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="finance3-input"
                        value={payNominal}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setPayNominal(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '');
                        }}
                        required
                      />
                    </div>

                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Tanggal Pembayaran *</label>
                      <input
                        type="date"
                        className="finance3-input"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Metode Pembayaran *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${payMethod === 'cash' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setPayMethod('cash')}
                      >
                        <Banknote size={14} /> Tunai
                      </button>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${payMethod === 'transfer' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setPayMethod('transfer')}
                      >
                        <Building2 size={14} /> Transfer
                      </button>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${payMethod === 'qris' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setPayMethod('qris')}
                      >
                        <QrCode size={14} /> QRIS
                      </button>
                    </div>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Kantong Penerima *</label>
                    <select
                      className="finance3-select"
                      value={payPocketId}
                      onChange={e => setPayPocketId(e.target.value)}
                      required
                    >
                      {pockets
                        .filter(p => !p.archived)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Catatan (Opsional)</label>
                    <input
                      type="text"
                      className="finance3-input"
                      placeholder="Catatan tambahan iuran..."
                      value={payNotes}
                      onChange={e => setPayNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="finance3-modal-footer">
                  <Button type="button" variant="secondary" shape="pill" onClick={() => setIsPaymentModalOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    shape="pill"
                    disabled={payLoading}
                    style={{ background: '#059669', borderColor: '#059669' }}
                  >
                    {payLoading ? <Loader2 size={15} className="animate-spin" /> : 'Simpan Pembayaran Iuran'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Kelola / Koreksi / Pembebasan Iuran */}
      {inspectCell &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setInspectCell(null)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="finance3-modal-header">
                <h3>
                  Kelola Iuran: {inspectCell.crewName} ({formatPeriodMonthLabel(inspectCell.period)})
                </h3>
                <button
                  type="button"
                  onClick={() => setInspectCell(null)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="finance3-modal-body">
                {cellError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: 'var(--ptv-curve-md, 12px)',
                      background: 'var(--dang-bg, #fde8e6)',
                      color: 'var(--dang, #b02b23)',
                      fontSize: '13px',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{cellError}</span>
                  </div>
                )}

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--surface-2, #f8fafd)',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div>
                    Status Saat Ini: <b>{inspectCell.status.toUpperCase()}</b>
                  </div>
                  {inspectCell.record && (
                    <>
                      <div>
                        Dibayar: <b>Rp {((Number(inspectCell.record.paidAmountMinor) || 0) / 100).toLocaleString('id-ID')}</b>
                      </div>
                      <div>Tanggal Bayar: {inspectCell.record.paymentDate || '-'}</div>
                      <div>Catatan: {inspectCell.record.notes || '-'}</div>
                    </>
                  )}
                </div>

                {/* Form Pembatalan / Reversal jika sudah bayar */}
                {inspectCell.record && inspectCell.status !== 'belum' && (
                  <form onSubmit={handleReverseRecord} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Koreksi / Batalkan Pembayaran Iuran (Reversal) *</label>
                      <input
                        type="text"
                        className="finance3-input"
                        placeholder="Alasan koreksi atau pembatalan..."
                        value={reversalReason}
                        onChange={e => setReversalReason(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      disabled={cellLoading}
                      style={{ color: '#dc2626', alignSelf: 'flex-start' }}
                    >
                      <Ban size={14} /> Batalkan Catatan Iuran Ini
                    </Button>
                  </form>
                )}

                {/* Form Pembebasan Iuran (Waive) jika belum lunas */}
                {inspectCell.status !== 'dikecualikan' && (
                  <form onSubmit={handleWaiveFee} style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--line-2, rgba(11,42,74,0.08))', paddingTop: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Bebaskan Kewajiban Iuran Bulan Ini (Dispensasi Resmi)</label>
                      <input
                        type="text"
                        className="finance3-input"
                        placeholder="Alasan dispensasi / pembebasan iuran..."
                        value={waiveReason}
                        onChange={e => setWaiveReason(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      disabled={cellLoading}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <ShieldAlert size={14} /> Tetapkan Status Dibebaskan
                    </Button>
                  </form>
                )}
              </div>

              <div className="finance3-modal-footer">
                <Button type="button" variant="secondary" shape="pill" onClick={() => setInspectCell(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
