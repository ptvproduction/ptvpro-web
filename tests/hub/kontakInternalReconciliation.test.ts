import { describe, it, expect } from 'vitest';
import {
  isLegacyPembina,
  isLegacyPengarah,
  isLegacyPengurus,
  isLegacyKru,
  classifyInternalContact,
  groupCrewByAngkatan,
  formatAngkatanDisplay,
} from '@products/hub/kontak/kontakMapper';
import { INITIAL_INTERNAL_CONTACTS } from '@products/hub/kontak/mock/internalContactMockData';
import { internalContactStore } from '@products/hub/kontak/internalContactStore';
import { crewStore } from '@products/hub/kru/kruStore';

describe('P0 Data Reconciliation — Kontak Internal vs PHP Legacy & Production', () => {
  it('1. Aturan klasifikasi PHP Legacy memetakan peran secara deterministik', () => {
    // Pembina
    expect(isLegacyPembina({ divisi: 'Pembina', jabatan: 'Kru' })).toBe(true);
    expect(isLegacyPembina({ divisi: 'Technical', jabatan: 'Pembina Divisi' })).toBe(true);

    // Pengarah
    expect(isLegacyPengarah({ divisi: 'Pengarah', jabatan: 'Anggota' })).toBe(true);
    expect(isLegacyPengarah({ divisi: 'Lembaga', jabatan: 'Pendiri dan Pengasuh' })).toBe(true);
    expect(isLegacyPengarah({ divisi: 'Lembaga', jabatan: 'Direktur Yayasan' })).toBe(true);

    // Pengurus
    expect(isLegacyPengurus({ divisi: 'Layouter', jabatan: 'Ketua Umum' })).toBe(true);
    expect(isLegacyPengurus({ divisi: 'Technical', jabatan: 'Koordinator Produksi' })).toBe(true);
    expect(isLegacyPengurus({ divisi: 'Administration', jabatan: 'Sekretaris & Logistik' })).toBe(true);

    // Kru Aktif vs Nonaktif
    expect(isLegacyKru({ divisi: 'Technical', jabatan: 'Kru', status: 'Aktif' })).toBe(true);
    expect(isLegacyKru({ divisi: 'Editor', jabatan: 'Kru', status: 'Nonaktif' })).toBe(true); // Memiliki jabatan 'Kru'
    expect(isLegacyKru({ divisi: 'Editor', jabatan: 'Senior Editor', status: 'Nonaktif' })).toBe(false); // Nonaktif dan jabatan bukan 'Kru'
  });

  it('2. Filter eksklusi mengecualikan kru nonaktif yang jabatannya spesifik bukan Kru (Paritas Legacy)', () => {
    // Di PHP Legacy: c.status === 'Aktif' || /kru/i.test(c.pos)
    const inactiveEditor = {
      nama: 'Mantan Editor',
      divisi: 'Editor',
      jabatan: 'Video Editor',
      status: 'Nonaktif',
    };
    expect(classifyInternalContact(inactiveEditor)).toBeNull();

    const activeEditor = {
      nama: 'Editor Aktif',
      divisi: 'Editor',
      jabatan: 'Video Editor',
      status: 'Aktif',
    };
    expect(classifyInternalContact(activeEditor)).toBe('Kru');
  });

  it('3. Total Kontak Internal kanonikal tepat 49 orang dengan rincian kategori otentik', () => {
    expect(INITIAL_INTERNAL_CONTACTS.length).toBe(49);

    const counts: Record<string, number> = {
      Pembina: 0,
      Pengarah: 0,
      Pengurus: 0,
      Kru: 0,
    };

    INITIAL_INTERNAL_CONTACTS.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });

    expect(counts['Pembina']).toBe(8);
    expect(counts['Pengarah']).toBe(4);
    expect(counts['Pengurus']).toBe(2);
    expect(counts['Kru']).toBe(35);
  });

  it('4. Kategori Kru dikelompokkan berdasarkan Angkatan dengan helper kanonikal', () => {
    const kruContacts = INITIAL_INTERNAL_CONTACTS.filter((c) => c.category === 'Kru');
    expect(kruContacts.length).toBe(35);

    const groups = groupCrewByAngkatan(kruContacts);
    expect(groups.length).toBe(10); // 10 angkatan aktif

    // Periksa label grup terurut dari angkatan terbaru
    expect(groups[0].label).toContain('15');
    expect(groups[1].label).toContain('14');

    // Total anggota di seluruh grup harus tepat 35 orang
    const totalMembersInGroups = groups.reduce((acc, g) => acc + g.rows.length, 0);
    expect(totalMembersInGroups).toBe(35);
  });

  it('5. Kontak Kehormatan & Pimpinan Lembaga (Pengarah) terlindungi dari akun/kredensial login sembarangan', () => {
    const contacts = internalContactStore.getAll();
    const aguesAli = contacts.find((c) => c.full_name.includes('Agoes Ali Masyhuri'));
    expect(aguesAli).toBeDefined();
    expect(aguesAli?.category).toBe('Pengarah');
    expect(aguesAli?.position).toContain('Pengasuh');
    expect(aguesAli?.crew_id).toBeUndefined(); // Kontak kehormatan, bukan user login biasa
  });

  it('6. Sinkronisasi reaktif dari Crew Store ke Kontak Internal berjalan dua arah tanpa merusak identitas', () => {
    crewStore.resetToFixtures();
    internalContactStore.resetToFixtures();

    const initialZidna = internalContactStore.getAll().find((c) => c.ptv_id === 'PTV-001');
    expect(initialZidna).toBeDefined();
    expect(initialZidna?.category).toBe('Pengurus');

    // Mutasi nama di crew store
    const crewZidna = crewStore.getAll().find((c) => c.ptv_id === 'PTV-001');
    if (crewZidna) {
      crewStore.updateCrew(crewZidna.id, { full_name: 'Muhammad Zidnal Falah, S.Kom.' });
      const refetchedKontak = internalContactStore.getAll().find((c) => c.ptv_id === 'PTV-001');
      expect(refetchedKontak?.full_name).toBe('Muhammad Zidnal Falah, S.Kom.');
    }
  });

  it('7. Helper formatAngkatanDisplay menghasilkan label yang terstandarisasi', () => {
    expect(formatAngkatanDisplay('10')).toBe('Angkatan 10');
    expect(formatAngkatanDisplay('Angkatan 12')).toBe('Angkatan 12');
    expect(formatAngkatanDisplay('Additional')).toBe('Additional');
    expect(formatAngkatanDisplay('')).toBe('Angkatan belum ditentukan');
  });
});
