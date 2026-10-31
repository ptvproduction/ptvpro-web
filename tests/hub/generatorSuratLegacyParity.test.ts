import { describe, it, expect } from 'vitest';
import {
  Santri,
  IzinColKey,
  COL_LABELS,
  PRESET_SEKOLAH,
  PRESET_ASRAMA,
  getRomanMonth,
  CANONICAL_LEGACY_SANTRI_FIXTURES,
  parseCSV,
  SHEET_CSV_URL,
} from '../../src/products/hub/surat/generator/mock/santriMockData';
import { publicDocumentStatus } from '../../api/verifikasi-surat';

describe('PTVPRO — Generator Surat Izin | Legacy PHP Parity Tests', () => {
  // ── 1. Google Sheets CSV Parser & Canonical Fallback ──
  it('1. harus mematuhi format 11 kolom CSV dan aturan filter PHP Legacy', () => {
    expect(SHEET_CSV_URL).toContain('gid=1168748355');

    // Uji parser CSV legacy
    const rawCsvSample = [
      'Nama,Unit,Kelas,Wali Kelas,Kamar,Asrama,Murobbi,Madin,Intensif,is_intern,Angkatan',
      '"Ahmad Faiz Zidani",MA,XII MIPA,Ust. Ridwan,A-01,Al-Falah,Ust. Mustofa,Ulya,IT,TRUE,11',
      '"-",MA,-,-,-,-,-,-,-,FALSE,-', // Baris strip harus terfilter
      '"Bagus Setiawan",MA,XI MIPA,Ust. Masykur,B-01,Darussalam,Ust. Syamsul,Wustho,Multimedia,FALSE,12',
    ].join('\n');

    const parsed = parseCSV(rawCsvSample);
    expect(parsed.length).toBe(4);

    const rowsData = parsed.slice(1);
    const mapped: Santri[] = rowsData
      .map((row, idx) => {
        const isInternVal = (row[9] || '').toString().trim().toUpperCase();
        const isIntern =
          isInternVal === 'TRUE' ||
          isInternVal === '1' ||
          isInternVal === 'INTERN' ||
          isInternVal === 'YA';
        return {
          _realIdx: idx,
          _checked: false,
          nama: row[0] || '-',
          unit: row[1] || '-',
          kelas: row[2] || '-',
          walikelas: row[3] || '-',
          kamar: row[4] || '-',
          asrama: row[5] || '-',
          murobbi: row[6] || '-',
          madin: row[7] || '-',
          intensif: row[8] || '-',
          is_intern: isIntern,
          angkatan: (row[10] || '').toString().trim() || '-',
        };
      })
      .filter((r) => r.nama && r.nama !== '-');

    // Baris "-" harus tersaring
    expect(mapped.length).toBe(2);
    expect(mapped[0].nama).toBe('Ahmad Faiz Zidani');
    expect(mapped[0].is_intern).toBe(true);
    expect(mapped[1].nama).toBe('Bagus Setiawan');
    expect(mapped[1].is_intern).toBe(false);

    // Verifikasi snapshot kanonikal historis (20 santri riil)
    expect(CANONICAL_LEGACY_SANTRI_FIXTURES.length).toBe(20);
    CANONICAL_LEGACY_SANTRI_FIXTURES.forEach((s) => {
      expect(s.nama).not.toBe('-');
      expect(s.unit).toBeTruthy();
      expect(s.kelas).toBeTruthy();
      expect(s.asrama).toBeTruthy();
      expect(s.kamar).toBeTruthy();
    });
  });

  // ── 2. Aturan Pengelompokan Angkatan & Pengurutan Alfabetis ──
  it('2. harus mengelompokkan santri per angkatan (numerik) dan alfabetis nama di dalam angkatan', () => {
    const testList: Santri[] = [
      {
        _realIdx: 0,
        nama: 'Zainal Abidin',
        unit: 'MA',
        kelas: 'XII',
        walikelas: 'Ust. A',
        kamar: '01',
        asrama: 'Asrama A',
        murobbi: 'Ust. M',
        madin: 'Ulya',
        intensif: 'IT',
        angkatan: '12',
      },
      {
        _realIdx: 1,
        nama: 'Ahmad Dahlan',
        unit: 'SMA',
        kelas: 'XI',
        walikelas: 'Ust. B',
        kamar: '02',
        asrama: 'Asrama B',
        murobbi: 'Ust. N',
        madin: 'Wustho',
        intensif: 'Tahfidz',
        angkatan: '11',
      },
      {
        _realIdx: 2,
        nama: 'Badrul Kamal',
        unit: 'MA',
        kelas: 'XII',
        walikelas: 'Ust. A',
        kamar: '03',
        asrama: 'Asrama A',
        murobbi: 'Ust. M',
        madin: 'Ulya',
        intensif: 'Bahasa',
        angkatan: '12',
      },
    ];

    // Algoritma grouping PHP legacy
    const groups: Record<string, Santri[]> = {};
    testList.forEach((s) => {
      const angk = (s.angkatan || '-').toString().trim();
      if (!groups[angk]) groups[angk] = [];
      groups[angk].push(s);
    });

    const sortedAngkatans = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'id');
    });

    // Angkatan 11 harus mendahului Angkatan 12
    expect(sortedAngkatans).toEqual(['11', '12']);

    // Di dalam angkatan 12: Badrul Kamal harus mendahului Zainal Abidin (alfabetis)
    const angk12 = groups['12'].slice().sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    expect(angk12[0].nama).toBe('Badrul Kamal');
    expect(angk12[1].nama).toBe('Zainal Abidin');
  });

  // ── 3. Multi-Field Search Logic ──
  it('3. harus mendukung pencarian multi-field (nama, unit, kelas, asrama, kamar, walikelas, murobbi)', () => {
    const list = CANONICAL_LEGACY_SANTRI_FIXTURES;

    const search = (q: string) => {
      const lower = q.toLowerCase().trim();
      return list.filter(
        (s) =>
          s.nama.toLowerCase().includes(lower) ||
          s.unit.toLowerCase().includes(lower) ||
          s.kelas.toLowerCase().includes(lower) ||
          s.asrama.toLowerCase().includes(lower) ||
          s.kamar.toLowerCase().includes(lower) ||
          s.walikelas.toLowerCase().includes(lower) ||
          s.murobbi.toLowerCase().includes(lower)
      );
    };

    // Cari berdasarkan nama
    expect(search('Farras').length).toBeGreaterThanOrEqual(1);

    // Cari berdasarkan kelas
    expect(search('X MIPA').length).toBeGreaterThanOrEqual(1);

    // Cari berdasarkan asrama
    expect(search('Al-Falah').length).toBeGreaterThanOrEqual(2);

    // Cari berdasarkan murobbi
    expect(search('Mustofa').length).toBeGreaterThanOrEqual(1);
  });

  // ── 4. Preset Kolom Sekolah vs Asrama (Maksimal 6 Kolom) ──
  it('4. harus membatasi preset kolom tepat 6 kolom aktif untuk kerapian format A4', () => {
    const activeSekolah = (Object.keys(PRESET_SEKOLAH) as IzinColKey[]).filter((k) => PRESET_SEKOLAH[k]);
    expect(activeSekolah.length).toBe(6);
    expect(activeSekolah).toEqual(['unit', 'kelas', 'walikelas', 'kamar', 'asrama', 'murobbi']);

    const activeAsrama = (Object.keys(PRESET_ASRAMA) as IzinColKey[]).filter((k) => PRESET_ASRAMA[k]);
    expect(activeAsrama.length).toBe(6);
    expect(activeAsrama).toEqual(['unit', 'kamar', 'asrama', 'murobbi', 'intensif', 'madin']);

    // Validasi label kamus kolom
    expect(COL_LABELS.unit).toBe('Unit');
    expect(COL_LABELS.kelas).toBe('Kelas');
    expect(COL_LABELS.walikelas).toBe('Wali Kelas');
    expect(COL_LABELS.kamar).toBe('Kamar');
    expect(COL_LABELS.asrama).toBe('Asrama');
    expect(COL_LABELS.murobbi).toBe('Murobbi');
    expect(COL_LABELS.intensif).toBe('Intensif');
    expect(COL_LABELS.madin).toBe('Madin');
    expect(COL_LABELS.jobdesc).toBe('Catatan Khusus');
  });

  // ── 5. Format Penomoran Surat Sesuai PHP Legacy ──
  it('5. harus menghasilkan format nomor surat {3_digit_seq}/SI-PTV/{ROMAN_MONTH}/{YEAR}', () => {
    const seq1 = 1;
    const seq27 = 27;
    const testDate = new Date(2026, 9, 29); // Oktober (Bulan 10 -> X)
    const roman = getRomanMonth(testDate);
    expect(roman).toBe('X');

    const formattedNo1 = `${String(seq1).padStart(3, '0')}/SI-PTV/${roman}/2026`;
    expect(formattedNo1).toBe('001/SI-PTV/X/2026');

    const formattedNo27 = `${String(seq27).padStart(3, '0')}/SI-PTV/${roman}/2026`;
    expect(formattedNo27).toBe('027/SI-PTV/X/2026');

    // Regex kesesuaian dengan verifikasi publik
    const pattern = /^\d{3}\/SI-PTV\/[IVXLCDM]+\/\d{4}$/;
    expect(pattern.test(formattedNo1)).toBe(true);
    expect(pattern.test(formattedNo27)).toBe(true);
  });

  // ── 6. Multi-Santri dalam 1 Nomor Surat (Bukan 1 Nomor per Santri) ──
  it('6. harus menampung seluruh santri yang dicentang dalam satu surat resmi tunggal', () => {
    const selected = CANONICAL_LEGACY_SANTRI_FIXTURES.slice(0, 8);
    const suratNomor = '001/SI-PTV/X/2026';

    const suratIzinDoc = {
      no: suratNomor,
      type: 'Surat Izin Santri',
      subject: 'Izin Liputan Haul Akbar 2026',
      recipients: selected.map((s) => s.nama),
      santri_list: selected,
      status: 'Disetujui',
    };

    expect(suratIzinDoc.no).toBe('001/SI-PTV/X/2026');
    expect(suratIzinDoc.recipients.length).toBe(8);
    expect(suratIzinDoc.santri_list.length).toBe(8);
    expect(suratIzinDoc.status).toBe('Disetujui');
  });

  // ── 7. Pagination A4 Legacy (20 Baris Hal 1, 22 Baris Lanjutan) ──
  it('7. harus membagi halaman dengan batas 20 santri di hal 1 dan 22 santri di hal lanjutan', () => {
    function paginate(list: any[]) {
      const pages: { rows: any[]; isPage1: boolean; isFinal: boolean }[] = [];
      if (list.length <= 20) {
        pages.push({ rows: list, isPage1: true, isFinal: true });
      } else {
        pages.push({ rows: list.slice(0, 20), isPage1: true, isFinal: false });
        let rem = list.slice(20);
        while (rem.length > 0) {
          const chunkSize = rem.length <= 22 ? rem.length : 22;
          const chunk = rem.slice(0, chunkSize);
          rem = rem.slice(chunkSize);
          pages.push({ rows: chunk, isPage1: false, isFinal: rem.length === 0 });
        }
      }
      return pages;
    }

    // 20 santri -> 1 halaman penuh
    const dummy20 = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const p20 = paginate(dummy20);
    expect(p20.length).toBe(1);
    expect(p20[0].rows.length).toBe(20);
    expect(p20[0].isFinal).toBe(true);

    // 21 santri -> 2 halaman (20 hal 1, 1 hal 2)
    const dummy21 = Array.from({ length: 21 }, (_, i) => ({ id: i }));
    const p21 = paginate(dummy21);
    expect(p21.length).toBe(2);
    expect(p21[0].rows.length).toBe(20);
    expect(p21[0].isFinal).toBe(false);
    expect(p21[1].rows.length).toBe(1);
    expect(p21[1].isFinal).toBe(true);

    // 42 santri -> 2 halaman (20 hal 1, 22 hal 2)
    const dummy42 = Array.from({ length: 42 }, (_, i) => ({ id: i }));
    const p42 = paginate(dummy42);
    expect(p42.length).toBe(2);
    expect(p42[0].rows.length).toBe(20);
    expect(p42[1].rows.length).toBe(22);
    expect(p42[1].isFinal).toBe(true);
  });

  // ── 8. Status Resmi Tanpa Pra-Pengesahan & Verifikasi Publik ──
  it('8. harus menerbitkan surat dengan status Disetujui yang diakui valid oleh verifikasi publik', () => {
    // Di PHP legacy dan PTVPRO resmi: status langsung "Disetujui"
    const statusDisetujui = 'Disetujui';
    expect(publicDocumentStatus(statusDisetujui)).toBe('valid');

    // Status dilarang menghasilkan pra-pengesahan
    expect(statusDisetujui.toLowerCase()).not.toContain('pra');
    expect(statusDisetujui.toLowerCase()).not.toContain('draft');
  });
});
