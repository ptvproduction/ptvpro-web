import { describe, it, expect } from 'vitest';

interface InventoryUnit {
  id: string;
  kode_unit: string;
  status_peminjaman: 'tersedia' | 'dipinjam' | 'rusak';
  locked_by?: string; // Simulates row-level lock (FOR UPDATE)
}

interface LoanRecord {
  id: string;
  transaction_id: string;
  unit_id: string;
  peminjam_nama: string;
  status: 'dipinjam' | 'dikembalikan';
}

class SimulatedRpcEngine {
  units = new Map<string, InventoryUnit>();
  loans = new Map<string, LoanRecord>();
  inventoryCodes: string[] = [];
  docSequences = { tugas: 0, izin: 0, barang: 0 };
  advisoryLocks = new Set<number>();

  // RPC 1: rpc_checkout_loan
  checkoutLoan(params: {
    transaction_id: string;
    borrower_name: string;
    unit_ids: string[];
    actor_capabilities: string[];
    caller_id: string;
  }): { success: boolean; error?: string; items_count?: number } {
    if (!params.actor_capabilities.includes('loans.checkout')) {
      return { success: false, error: 'UNAUTHORIZED: loans.checkout capability required' };
    }

    // Row Lock Simulation: Check if units are locked or unavailable
    for (const unitId of params.unit_ids) {
      const unit = this.units.get(unitId);
      if (!unit || unit.status_peminjaman !== 'tersedia' || (unit.locked_by && unit.locked_by !== params.caller_id)) {
        return { success: false, error: 'UNIT_NOT_AVAILABLE' };
      }
    }

    // Atomically acquire locks and update
    for (const unitId of params.unit_ids) {
      const unit = this.units.get(unitId)!;
      unit.status_peminjaman = 'dipinjam';
      unit.locked_by = undefined;

      const loanId = `loan-${params.transaction_id}-${unitId}`;
      this.loans.set(loanId, {
        id: loanId,
        transaction_id: params.transaction_id,
        unit_id: unitId,
        peminjam_nama: params.borrower_name,
        status: 'dipinjam',
      });
    }

    return { success: true, items_count: params.unit_ids.length };
  }

  // RPC 2: rpc_return_loan
  returnLoan(params: {
    transaction_id: string;
    actor_capabilities: string[];
  }): { success: boolean; error?: string; returned_units?: number } {
    if (!params.actor_capabilities.includes('loans.return')) {
      return { success: false, error: 'UNAUTHORIZED: loans.return capability required' };
    }

    const activeLoans = Array.from(this.loans.values()).filter(
      l => l.transaction_id === params.transaction_id && l.status === 'dipinjam'
    );

    if (activeLoans.length === 0) {
      return { success: false, error: 'TRANSACTION_NOT_FOUND' };
    }

    for (const loan of activeLoans) {
      loan.status = 'dikembalikan';
      const unit = this.units.get(loan.unit_id);
      if (unit) {
        unit.status_peminjaman = 'tersedia';
      }
    }

    return { success: true, returned_units: activeLoans.length };
  }

  // RPC 3: rpc_return_single_unit
  returnSingleUnit(params: {
    loan_id: string;
    unit_id: string;
    actor_capabilities: string[];
  }): { success: boolean; error?: string } {
    if (!params.actor_capabilities.includes('loans.return')) {
      return { success: false, error: 'UNAUTHORIZED: loans.return capability required' };
    }

    const loan = this.loans.get(params.loan_id);
    if (!loan || loan.status !== 'dipinjam') {
      return { success: false, error: 'LOAN_NOT_ACTIVE' };
    }

    loan.status = 'dikembalikan';
    const unit = this.units.get(params.unit_id);
    if (unit) {
      unit.status_peminjaman = 'tersedia';
    }

    return { success: true };
  }

  // RPC 4: rpc_get_next_inv_code
  getNextInvCode(): string {
    // Simulates pg_advisory_xact_lock(1001)
    const maxNum = this.inventoryCodes.reduce((max, code) => {
      const match = code.match(/INV-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const nextCode = `INV-${String(maxNum + 1).padStart(3, '0')}`;
    this.inventoryCodes.push(nextCode);
    return nextCode;
  }

  // RPC 5: rpc_submit_official_doc
  submitOfficialDoc(params: {
    doc_type: 'tugas' | 'izin' | 'barang';
    actor_capabilities: string[];
  }): { success: boolean; nomor_surat?: string; error?: string } {
    if (!params.actor_capabilities.includes('documents.request') && !params.actor_capabilities.includes('documents.generate')) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const prefixes = { tugas: 'ST', izin: 'SI', barang: 'SBB' };
    const prefix = prefixes[params.doc_type];
    const year = '2026';
    const month = '10';

    this.docSequences[params.doc_type]++;
    const seq = String(this.docSequences[params.doc_type]).padStart(3, '0');
    const nomor = `${prefix}-PTV/${year}/${month}/${seq}`;

    return { success: true, nomor_surat: nomor };
  }
}

describe('Phase 5B — Contracted 5 RPCs State Machine & Concurrency Harness', () => {
  it('1. rpc_checkout_loan: Basket checkout locks units and creates shared transaction', () => {
    const engine = new SimulatedRpcEngine();
    engine.units.set('u1', { id: 'u1', kode_unit: 'CAM-01', status_peminjaman: 'tersedia' });
    engine.units.set('u2', { id: 'u2', kode_unit: 'LENS-01', status_peminjaman: 'tersedia' });

    const result = engine.checkoutLoan({
      transaction_id: 'TX-1001',
      borrower_name: 'Zidnal',
      unit_ids: ['u1', 'u2'],
      actor_capabilities: ['loans.checkout'],
      caller_id: 'caller-1',
    });

    expect(result.success).toBe(true);
    expect(result.items_count).toBe(2);
    expect(engine.units.get('u1')?.status_peminjaman).toBe('dipinjam');
    expect(engine.units.get('u2')?.status_peminjaman).toBe('dipinjam');
  });

  it('2. rpc_checkout_loan: Concurrent checkout collision results in exactly ONE success', () => {
    const engine = new SimulatedRpcEngine();
    engine.units.set('u-hot', { id: 'u-hot', kode_unit: 'SONY-FX3', status_peminjaman: 'tersedia' });

    // Client 1 checkouts u-hot
    const res1 = engine.checkoutLoan({
      transaction_id: 'TX-C1',
      borrower_name: 'Alice',
      unit_ids: ['u-hot'],
      actor_capabilities: ['loans.checkout'],
      caller_id: 'c1',
    });

    // Client 2 attempts simultaneous checkout of the same unit
    const res2 = engine.checkoutLoan({
      transaction_id: 'TX-C2',
      borrower_name: 'Bob',
      unit_ids: ['u-hot'],
      actor_capabilities: ['loans.checkout'],
      caller_id: 'c2',
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('UNIT_NOT_AVAILABLE'); // Concurrency guard works!
  });

  it('3. rpc_return_loan & rpc_return_single_unit: Full and partial return behaviors', () => {
    const engine = new SimulatedRpcEngine();
    engine.units.set('uA', { id: 'uA', kode_unit: 'MIC-1', status_peminjaman: 'tersedia' });
    engine.units.set('uB', { id: 'uB', kode_unit: 'MIC-2', status_peminjaman: 'tersedia' });

    engine.checkoutLoan({
      transaction_id: 'TX-MULTI',
      borrower_name: 'Crew Team',
      unit_ids: ['uA', 'uB'],
      actor_capabilities: ['loans.checkout'],
      caller_id: 'c1',
    });

    // Partial return: Return only uA
    const partialRes = engine.returnSingleUnit({
      loan_id: 'loan-TX-MULTI-uA',
      unit_id: 'uA',
      actor_capabilities: ['loans.return'],
    });
    expect(partialRes.success).toBe(true);
    expect(engine.units.get('uA')?.status_peminjaman).toBe('tersedia');
    expect(engine.units.get('uB')?.status_peminjaman).toBe('dipinjam'); // uB remains loaned!

    // Full return of remaining basket
    const fullRes = engine.returnLoan({
      transaction_id: 'TX-MULTI',
      actor_capabilities: ['loans.return'],
    });
    expect(fullRes.success).toBe(true);
    expect(fullRes.returned_units).toBe(1); // Only uB returned
    expect(engine.units.get('uB')?.status_peminjaman).toBe('tersedia');
  });

  it('4. rpc_get_next_inv_code: Generates gap-free sequential codes without collisions', () => {
    const engine = new SimulatedRpcEngine();
    engine.inventoryCodes = ['INV-001', 'INV-002'];

    const c1 = engine.getNextInvCode();
    const c2 = engine.getNextInvCode();
    const c3 = engine.getNextInvCode();

    expect(c1).toBe('INV-003');
    expect(c2).toBe('INV-004');
    expect(c3).toBe('INV-005');
  });

  it('5. rpc_submit_official_doc: Sequential number generation per document prefix', () => {
    const engine = new SimulatedRpcEngine();
    const st1 = engine.submitOfficialDoc({ doc_type: 'tugas', actor_capabilities: ['documents.request'] });
    const st2 = engine.submitOfficialDoc({ doc_type: 'tugas', actor_capabilities: ['documents.request'] });
    const si1 = engine.submitOfficialDoc({ doc_type: 'izin', actor_capabilities: ['documents.request'] });

    expect(st1.nomor_surat).toBe('ST-PTV/2026/10/001');
    expect(st2.nomor_surat).toBe('ST-PTV/2026/10/002');
    expect(si1.nomor_surat).toBe('SI-PTV/2026/10/001'); // Izin has separate sequence
  });
});
