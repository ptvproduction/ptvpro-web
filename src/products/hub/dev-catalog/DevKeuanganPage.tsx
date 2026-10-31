import React, { useEffect, useState } from 'react';
import { useSessionStore } from '@core/session';
import { LOCAL_DEV_MOCK_USERS } from '@core/auth/authService';
import { FinancePage } from '../keuangan/FinancePage';
import { useSearchParams } from 'react-router-dom';

export const DevKeuanganPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get('role') || 'eksekutif';
  const initialKey =
    roleParam === 'crew'
      ? 'PTV-025'
      : roleParam === 'operator'
      ? 'PTV-023'
      : roleParam === 'pembina'
      ? 'PTV-PEMBINA'
      : 'PTV-001';

  const [selectedUserKey, setSelectedUserKey] = useState<string>(initialKey);

  // Synchronously configure session before child render
  const targetUser = LOCAL_DEV_MOCK_USERS[selectedUserKey] || LOCAL_DEV_MOCK_USERS['PTV-001'];
  const currentStoreUser = useSessionStore.getState().user;
  if (!currentStoreUser || currentStoreUser.ptv_id !== targetUser.ptv_id) {
    useSessionStore.setState({
      user: targetUser,
      session: {
        access_token: 'dev-mock-token',
        expires_at: Date.now() + 86400000,
        user: targetUser,
      },
      isLoading: false,
    });
  }

  useEffect(() => {
    const applyMockUser = () => {
      const mockUser = LOCAL_DEV_MOCK_USERS[selectedUserKey] || LOCAL_DEV_MOCK_USERS['PTV-001'];
      useSessionStore.setState({
        user: mockUser,
        session: {
          access_token: 'dev-mock-token',
          expires_at: Date.now() + 86400000,
          user: mockUser,
        },
        isLoading: false,
      });
    };

    applyMockUser();
    const timer = setTimeout(applyMockUser, 150);

    const unsub = useSessionStore.subscribe((state) => {
      if (!state.user && selectedUserKey !== 'PTV-PEMBINA') {
        applyMockUser();
      }
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [selectedUserKey]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas, #f8fafc)', paddingBottom: '60px' }}>
      {/* Dev Switcher Bar */}
      <div
        style={{
          background: '#0f172a',
          color: '#f8fafc',
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '13px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.04em', color: '#38bdf8' }}>
            PTV PRO KEUANGAN SHOWCASE
          </span>
          <span style={{ color: '#94a3b8' }}>| Simulasi Identitas & RBAC:</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedUserKey('PTV-001');
              setSearchParams({ role: 'eksekutif' });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              background: selectedUserKey === 'PTV-001' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
              color: selectedUserKey === 'PTV-001' ? '#0f172a' : '#f8fafc',
            }}
          >
            Eksekutif (Full Keuangan)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedUserKey('PTV-023');
              setSearchParams({ role: 'operator' });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              background: selectedUserKey === 'PTV-023' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
              color: selectedUserKey === 'PTV-023' ? '#0f172a' : '#f8fafc',
            }}
          >
            Operator Keuangan (PTV-023)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedUserKey('PTV-025');
              setSearchParams({ role: 'crew' });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              background: selectedUserKey === 'PTV-025' ? '#10b981' : 'rgba(255,255,255,0.1)',
              color: selectedUserKey === 'PTV-025' ? '#0f172a' : '#f8fafc',
            }}
          >
            Kru Biasa: Zidna (Kas Saya)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedUserKey('PTV-PEMBINA');
              setSearchParams({ role: 'pembina' });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              background: selectedUserKey === 'PTV-PEMBINA' ? '#ef4444' : 'rgba(255,255,255,0.1)',
              color: selectedUserKey === 'PTV-PEMBINA' ? '#ffffff' : '#f8fafc',
            }}
          >
            Pembina (Terkunci)
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        <FinancePage initialData={DEV_MOCK_SNAPSHOT} />
      </div>
    </div>
  );
};

const DEV_MOCK_SNAPSHOT: import('../keuangan/financeFoundation').FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 43, expense: 10, ledger: 53 },
  entries: [],
  kas: [
    { id: 'kas-1', period: '2026-10', amount: 30000, status: 'lunas' },
    { id: 'kas-2', period: '2026-09', amount: 25000, status: 'lunas' },
  ],
  limited: false,
  writesEnabled: true,
  canonical: {
    state: 'available',
    pockets: [
      {
        id: '60e8d033-2794-4219-a960-c56bedca0111',
        name: 'Kas Utama Studio',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 1,
        balanceMinor: '52027600',
        qris: null,
      },
      {
        id: 'b5f00000-0000-0000-0000-000000000001',
        name: 'Rekening BCA Operasional',
        kind: 'bank',
        provider: 'BCA',
        accountNumber: '8735019283',
        accountHolder: 'Progresif TV Studio',
        archived: false,
        version: 1,
        balanceMinor: '150000000',
        qris: {
          assetPath: '/assets/qris-ptv.png',
          merchantName: 'PROGRESIF TV STUDIO',
          nmid: 'ID1020304050607',
          verifiedAt: '2026-10-20T00:00:00Z',
        },
      },
      {
        id: 'c5f00000-0000-0000-0000-000000000002',
        name: 'Rekening Bank BSI',
        kind: 'bank',
        provider: 'BSI',
        accountNumber: '7123456789',
        accountHolder: 'Progresif TV Studio',
        archived: false,
        version: 1,
        balanceMinor: '75000000',
        qris: null,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        occurredOn: '2026-10-20',
        description: 'Jasa Live Streaming Acara Maulid',
        kind: 'income',
        amountMinor: '150000000',
        status: 'posted',
        auditReference: 'AUDIT-001',
        categoryId: 'cat-1',
        allocations: [{ pocketId: 'b5f00000-0000-0000-0000-000000000001', amountMinor: '150000000', direction: 'in' }],
        sourceReferences: [],
        recordedBy: 'Bendahara',
        notes: 'Pelunasan transfer BCA',
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      },
      {
        id: 'tx-2',
        occurredOn: '2026-10-18',
        description: 'Konsumsi Rapat Kru Produksi',
        kind: 'expense',
        amountMinor: '12500000',
        status: 'posted',
        auditReference: 'AUDIT-002',
        categoryId: 'cat-2',
        allocations: [{ pocketId: '60e8d033-2794-4219-a960-c56bedca0111', amountMinor: '12500000', direction: 'out' }],
        sourceReferences: [],
        recordedBy: 'Bendahara',
        notes: 'Nota warung makan',
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      },
      {
        id: 'tx-3',
        occurredOn: '2026-10-15',
        description: 'Pembelian Baterai & Gaffer Tape',
        kind: 'expense',
        amountMinor: '8500000',
        status: 'posted',
        auditReference: 'AUDIT-003',
        categoryId: 'cat-3',
        allocations: [{ pocketId: '60e8d033-2794-4219-a960-c56bedca0111', amountMinor: '8500000', direction: 'out' }],
        sourceReferences: [],
        recordedBy: 'Operator',
        notes: 'Toko elektronik',
      },
    ],
    categories: [
      { id: 'cat-1', name: 'Jasa Video & Streaming', kind: 'income', isActive: true },
      { id: 'cat-2', name: 'Konsumsi Kru', kind: 'expense', isActive: true },
      { id: 'cat-3', name: 'Perlengkapan Studio', kind: 'expense', isActive: true },
      { id: 'cat-4', name: 'Iuran Kas Kru', kind: 'income', isActive: true },
      { id: 'cat-5', name: 'Pencairan Piutang', kind: 'expense', isActive: true },
      { id: 'cat-6', name: 'Pengembalian Pokok Piutang', kind: 'income', isActive: true },
      { id: 'cat-7', name: 'Pendapatan Bunga Piutang', kind: 'income', isActive: true },
    ],
  },
};
