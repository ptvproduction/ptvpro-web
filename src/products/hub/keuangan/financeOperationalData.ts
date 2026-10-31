import type { CrewMember } from '@products/hub/kru/types';
import type { FinanceSemester, KasKruFeeHistoryEntry, KasKruRecord } from './kasKruTypes';
import type { PiutangRecord } from './piutangTypes';

export interface FinanceOperationalData {
  source: 'staging';
  scope: 'global' | 'own';
  ownerPtvId: string;
  writesEnabled: false;
  semesters: FinanceSemester[];
  records: KasKruRecord[];
  loans: PiutangRecord[];
  feeDueDay: number;
  crewRoster?: CrewMember[];
  feeHistory?: KasKruFeeHistoryEntry[];
}

export async function loadFinanceOperational(signal: AbortSignal): Promise<FinanceOperationalData> {
  const response = await fetch('/api/finance?operational=1', {
    credentials: 'same-origin', cache: 'no-store', signal,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Gagal memuat data operasional keuangan.');
  if (body.source !== 'staging' || !['global', 'own'].includes(body.scope)
    || typeof body.ownerPtvId !== 'string' || body.writesEnabled !== false
    || !Array.isArray(body.semesters) || !Array.isArray(body.records) || !Array.isArray(body.loans)
    || !Number.isInteger(body.feeDueDay) || body.feeDueDay < 1 || body.feeDueDay > 31) {
    throw new Error('Respons operasional keuangan tidak valid.');
  }
  return body;
}
