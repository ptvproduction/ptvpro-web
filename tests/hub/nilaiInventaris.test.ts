import { describe, it, expect, beforeEach } from 'vitest';
import { inventarisService } from '../../src/products/hub/inventaris/inventarisService';

describe('Nilai Inventaris Service & Financial Simulation Tests', () => {
  beforeEach(() => {
    (inventarisService as any).reset();
  });

  it('1. Should return baseline items with consistent simulation valuation metadata', async () => {
    const items = await inventarisService.getNilaiInventarisList();
    expect(items.length).toBe(5);

    // Sum total valuation
    const totalVal = items.reduce((acc, it) => acc + (it.nilai_inventaris?.nilai_perolehan || 0), 0);
    // 116m (FX3) + 67m (24-70) + 22.5m (Rode) + 14m (Amaran) = 219.500.000
    expect(totalVal).toBe(219500000);

    const itemsWithValue = items.filter((it) => (it.nilai_inventaris?.nilai_perolehan || 0) > 0);
    expect(itemsWithValue.length).toBe(4);

    const unrecorded = items.filter((it) => !it.nilai_inventaris || !(it.nilai_inventaris.nilai_perolehan > 0));
    expect(unrecorded.length).toBe(1);
    expect(unrecorded[0].kode).toBe('INV-005'); // DJI RS 3 Pro

    const coverage = Math.round((itemsWithValue.length / items.length) * 100);
    expect(coverage).toBe(80);

    const avg = Math.round(totalVal / itemsWithValue.length);
    expect(avg).toBe(54875000);
  });

  it('2. Should filter by category accurately', async () => {
    const kameraItems = await inventarisService.getNilaiInventarisList({ cat: 'Kamera' });
    expect(kameraItems.length).toBe(1);
    expect(kameraItems[0].kode).toBe('INV-001');
    expect(kameraItems[0].nilai_inventaris?.nilai_perolehan).toBe(116000000);

    const audioItems = await inventarisService.getNilaiInventarisList({ cat: 'Audio' });
    expect(audioItems.length).toBe(1);
    expect(audioItems[0].kode).toBe('INV-003');
    expect(audioItems[0].nilai_inventaris?.nilai_perolehan).toBe(22500000);
  });

  it('3. Should filter by status (Aktif vs Belum Dicatat)', async () => {
    const aktifItems = await inventarisService.getNilaiInventarisList({ status: 'Aktif' });
    expect(aktifItems.length).toBe(4);

    const belumDicatatItems = await inventarisService.getNilaiInventarisList({ status: 'Belum Dicatat' });
    expect(belumDicatatItems.length).toBe(1);
    expect(belumDicatatItems[0].kode).toBe('INV-005');
  });

  it('4. Should filter by source of funds (Sumber Dana)', async () => {
    const yayasanItems = await inventarisService.getNilaiInventarisList({ source: 'Yayasan' });
    // FX3, 24-70, and RS 3 Pro have Yayasan as source
    expect(yayasanItems.length).toBe(3);

    const kasItems = await inventarisService.getNilaiInventarisList({ source: 'Kas PTV' });
    expect(kasItems.length).toBe(1);
    expect(kasItems[0].kode).toBe('INV-003');

    const hibahItems = await inventarisService.getNilaiInventarisList({ source: 'Hibah Alumni' });
    expect(hibahItems.length).toBe(1);
    expect(hibahItems[0].kode).toBe('INV-004');
  });

  it('5. Should support multi-token search across name, code, vendor, and invoice', async () => {
    const searchByVendor = await inventarisService.getNilaiInventarisList({ q: 'Kemang' });
    expect(searchByVendor.length).toBe(1);
    expect(searchByVendor[0].kode).toBe('INV-003');

    const searchByInvoice = await inventarisService.getNilaiInventarisList({ q: 'FN/2024' });
    expect(searchByInvoice.length).toBe(1);
    expect(searchByInvoice[0].kode).toBe('INV-001');

    const searchByCodeAndName = await inventarisService.getNilaiInventarisList({ q: 'INV-002 Sony' });
    expect(searchByCodeAndName.length).toBe(1);
    expect(searchByCodeAndName[0].kode).toBe('INV-002');
  });

  it('6. Should update valuation record dynamically and update totals', async () => {
    const updated = await inventarisService.updateNilaiInventaris('inv-005', {
      nilai_perolehan: 12000000,
      sumber_perolehan: 'Kas PTV',
      vendor: 'DJI Official Store',
      nomor_invoice: 'DJI-INV-2024',
      status: 'Aktif',
    });

    expect(updated.nilai_inventaris?.nilai_perolehan).toBe(12000000);
    expect(updated.nilai_inventaris?.status).toBe('Aktif');

    const all = await inventarisService.getNilaiInventarisList();
    const newTotal = all.reduce((acc, it) => acc + (it.nilai_inventaris?.nilai_perolehan || 0), 0);
    expect(newTotal).toBe(219500000 + 12000000);

    const withVal = all.filter((it) => (it.nilai_inventaris?.nilai_perolehan || 0) > 0);
    expect(withVal.length).toBe(5);
  });

  it('7. Should delete valuation record and revert to Belum Dicatat', async () => {
    const success = await inventarisService.deleteNilaiInventaris('inv-004');
    expect(success).toBe(true);

    const item = await inventarisService.getInventarisById('inv-004');
    expect(item?.nilai_inventaris).toBeUndefined();

    const unrecorded = await inventarisService.getNilaiInventarisList({ status: 'Belum Dicatat' });
    // Now inv-004 and inv-005 are unrecorded
    expect(unrecorded.length).toBe(2);
  });
});
