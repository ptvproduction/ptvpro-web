export const operationalFinanceHold = 'Kas Kru, Piutang, pembebasan, pengaturan dan laporan operasional belum diaktifkan: perbaikan atomisitas, privasi dan histori database menunggu ACC serta uji Staging.';

export function isFinanceFixtureRuntime(): boolean {
  if (typeof process !== 'undefined' && (process.env?.MODE === 'staging' || process.env?.VITE_APP_ENV === 'staging')) return false;
  return import.meta.env.MODE === 'test';
}

export function assertFinanceFixtureRuntime(): void {
  if (!isFinanceFixtureRuntime()) throw new Error(operationalFinanceHold);
}
