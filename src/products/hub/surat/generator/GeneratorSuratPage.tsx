import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { dokumenService } from '../../dokumen-saya/dokumenService';
import { printOfficialPdf, type OfficialPdfDownload } from '../../dokumen-saya/utils/docPdfPrinter';
import { createSuratIzinPublisher } from './suratIzinPublication';
import { PrintCopyOffer } from './components/PrintCopyDialog';
import {
  Santri,
  IzinColKey,
  COL_LABELS,
  PRESET_SEKOLAH,
  PRESET_ASRAMA,
  getRomanMonth,
  CANONICAL_LEGACY_SANTRI_FIXTURES,
  SHEET_CSV_URL,
  parseCSV,
} from './mock/santriMockData';
import { SuratIzinPdfPreview } from './components/SuratIzinPdfPreview';
import '../../../../styles/generatorSurat.css';

export const GeneratorSuratPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, user, can } = useSessionStore();

  // 1. RBAC Check (Legacy fidelity: Eksekutif & Administrasi only. In dev verification route, allow showcase preview)
  const isDevPreview = location.pathname.startsWith('/dev-');
  const canGenerate = can('documents.generate') || isDevPreview;

  // Today Date (Local without UTC shift)
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // State Parameter Dokumen
  const [kegiatan, setKegiatan] = useState('Izin Liputan & Produksi Santri');
  const [tanggalMulai, setTanggalMulai] = useState(getTodayStr());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [tanggalSelesai, setTanggalSelesai] = useState(getTodayStr());

  // State Pengesahan
  const [showDikeluarkan, setShowDikeluarkan] = useState(true);
  const [customDikeluarkan, setCustomDikeluarkan] = useState(
    user?.full_name || session?.user?.full_name || 'Pimpinan Eksekutif PTV'
  );

  // State Kolom & Preset
  const [colsConfig, setColsConfig] = useState<Record<IzinColKey, boolean>>({
    ...PRESET_SEKOLAH,
  });
  const [activePreset, setActivePreset] = useState<'sekolah' | 'asrama' | 'custom'>('sekolah');

  // State Data Santri (Default: Canonical Legacy Data 20 santri riil dari Spreadsheet)
  const [santriList, setSantriList] = useState<Santri[]>(() =>
    CANONICAL_LEGACY_SANTRI_FIXTURES.map((s, idx) => ({
      ...s,
      _realIdx: idx,
      _checked: idx < 5, // Default pilih 5 santri awal agar preview langsung hidup
    }))
  );
  const [isLoadingSantri, setIsLoadingSantri] = useState(false);

  // State Filter & Pencarian
  const [selectedAngkatan, setSelectedAngkatan] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State Zoom Preview
  const [zoom, setZoom] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.95
  );

  const [isPublishing, setIsPublishing] = useState(false);
  const [printCopy, setPrintCopy] = useState<OfficialPdfDownload | null>(null);
  const publisher = useRef(createSuratIzinPublisher());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sequence Number & Vacancy State
  const [simSeq, setSimSeq] = useState(1);
  const [serverNomorSurat, setServerNomorSurat] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const publishInFlight = useRef(false);
  const [isCheckingVacant, setIsCheckingVacant] = useState(false);

  // Synchronize next vacant sequence number from authoritative documents
  useEffect(() => {
    let isCancelled = false;
    setIsCheckingVacant(true);
    setPreviewAvailable(false);
    dokumenService
      .getNextVacantNomorSurat('SI', tanggalMulai)
      .then((res) => {
        if (!isCancelled && res.sequence) {
          setSimSeq(res.sequence);
          if (res.nomor_surat) {
            setServerNomorSurat(res.nomor_surat);
          }
          setPreviewAvailable(true);
        }
      })
      .catch((err) => {
        console.warn('[GeneratorSurat] Gagal memverifikasi nomor surat resmi:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsCheckingVacant(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [tanggalMulai, previewVersion]);

  const romanMonth = useMemo(() => {
    if (!tanggalMulai) return getRomanMonth();
    const parts = tanggalMulai.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return getRomanMonth(new Date(y, m - 1, 1));
    }
    return getRomanMonth();
  }, [tanggalMulai]);

  const yearStr = useMemo(() => {
    if (!tanggalMulai) return new Date().getFullYear().toString();
    return tanggalMulai.split('-')[0] || new Date().getFullYear().toString();
  }, [tanggalMulai]);

  const nomorSurat = useMemo(() => {
    if (serverNomorSurat) return serverNomorSurat;
    const padded = String(simSeq).padStart(3, '0');
    return `${padded}/SI-PTV/${romanMonth}/${yearStr}`;
  }, [serverNomorSurat, simSeq, romanMonth, yearStr]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Kolom Aktif Array (Filtered Keys)
  const activeCols = useMemo(() => {
    return (Object.keys(colsConfig) as IzinColKey[]).filter((k) => colsConfig[k]);
  }, [colsConfig]);

  // Handle Preset Changes
  const applyPreset = (preset: 'sekolah' | 'asrama') => {
    setActivePreset(preset);
    if (preset === 'sekolah') {
      setColsConfig({ ...PRESET_SEKOLAH });
    } else {
      setColsConfig({ ...PRESET_ASRAMA });
    }
    showToast(`Preset ${preset === 'sekolah' ? 'Sekolah' : 'Asrama'} diterapkan.`);
  };

  // Handle Individual Column Toggle with Max 6 Limit
  const toggleColumn = (key: IzinColKey) => {
    const isCurrentlyChecked = !!colsConfig[key];
    if (!isCurrentlyChecked && activeCols.length >= 6) {
      alert('Maksimal memilih 6 kolom aktif untuk menjaga kerapian PDF A4!');
      return;
    }
    setColsConfig((prev) => ({
      ...prev,
      [key]: !isCurrentlyChecked,
    }));
    setActivePreset('custom');
  };

  // Filtered Santri List
  const filteredSantri = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return santriList.filter((s) => {
      const matchQuery =
        !q ||
        s.nama.toLowerCase().includes(q) ||
        s.unit.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q) ||
        s.asrama.toLowerCase().includes(q) ||
        s.kamar.toLowerCase().includes(q) ||
        s.walikelas.toLowerCase().includes(q) ||
        s.murobbi.toLowerCase().includes(q);

      const matchAngkatan =
        !selectedAngkatan || s.angkatan === selectedAngkatan;

      return matchQuery && matchAngkatan;
    });
  }, [santriList, searchQuery, selectedAngkatan]);

  // Grouped Santri per Angkatan & Alfabetis (Paritas PHP Legacy L34393-L34415)
  const groupedSantri = useMemo(() => {
    const groups: Record<string, Santri[]> = {};
    filteredSantri.forEach((s) => {
      const angk = (s.angkatan || '-').toString().trim();
      if (!groups[angk]) groups[angk] = [];
      groups[angk].push(s);
    });

    const sortedAngkKeys = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'id');
    });

    return sortedAngkKeys.map((angk) => {
      const students = groups[angk].slice().sort((a, b) =>
        (a.nama || '').localeCompare(b.nama || '', 'id')
      );
      return {
        angkatan: angk,
        label: /^angkatan/i.test(angk) ? angk : angk === '-' ? 'Lainnya' : `Angkatan ${angk}`,
        students,
      };
    });
  }, [filteredSantri]);

  // Selected Santri List
  const selectedSantri = useMemo(() => {
    return santriList.filter((s) => s._checked);
  }, [santriList]);

  // Angkatan Counter Map
  const angkatanCounts = useMemo(() => {
    const map: Record<string, number> = {};
    santriList.forEach((s) => {
      map[s.angkatan] = (map[s.angkatan] || 0) + 1;
    });
    return map;
  }, [santriList]);

  const sortedAngkatans = useMemo(() => {
    return Object.keys(angkatanCounts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [angkatanCounts]);

  // Handle Select / Deselect All Filtered
  const isAllFilteredSelected =
    filteredSantri.length > 0 && filteredSantri.every((s) => s._checked);

  const toggleSelectAllFiltered = () => {
    const targetState = !isAllFilteredSelected;
    const filteredIndexes = new Set(filteredSantri.map((s) => s._realIdx));
    setSantriList((prev) =>
      prev.map((s) => {
        if (filteredIndexes.has(s._realIdx)) {
          return { ...s, _checked: targetState };
        }
        return s;
      })
    );
  };

  // Handle Single Student Toggle
  const toggleStudentCheck = (realIdx: number) => {
    setSantriList((prev) =>
      prev.map((s) => {
        if (s._realIdx === realIdx) {
          return { ...s, _checked: !s._checked };
        }
        return s;
      })
    );
  };

  // Handle Student Note / Jobdesc
  const toggleStudentJobdesc = (realIdx: number) => {
    setSantriList((prev) =>
      prev.map((s) => {
        if (s._realIdx === realIdx) {
          const nextEnabled = !s.jobdesc_enabled;
          return {
            ...s,
            jobdesc_enabled: nextEnabled,
            _checked: nextEnabled ? true : s._checked, // Jika beri catatan khusus, otomatis centang
          };
        }
        return s;
      })
    );
  };

  const updateStudentJobdesc = (realIdx: number, val: string) => {
    setSantriList((prev) =>
      prev.map((s) => {
        if (s._realIdx === realIdx) {
          return { ...s, jobdesc: val };
        }
        return s;
      })
    );
  };

  // Muat Data Santri dari Google Spreadsheet (Paritas Penuh PHP Legacy page-dasbor.php L34588)
  const loadGoogleSheetsData = async (forceRefresh = false) => {
    setIsLoadingSantri(true);
    const csvUrl = SHEET_CSV_URL + (forceRefresh ? `&t=${Date.now()}` : '');
    try {
      const res = await fetch(csvUrl, { cache: 'no-store' });
      if (res.ok) {
        const csvText = await res.text();
        const parsed = parseCSV(csvText);
        if (parsed && parsed.length > 1) {
          const rowsData = parsed.slice(1);
          const mappedSantri: Santri[] = rowsData
            .map((row, idx) => {
              const isInternVal = (row[9] || '').toString().trim().toUpperCase();
              const isIntern =
                isInternVal === 'TRUE' ||
                isInternVal === '1' ||
                isInternVal === 'INTERN' ||
                isInternVal === 'YA';
              return {
                _realIdx: idx,
                _checked: idx < 5,
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
                jobdesc_enabled: false,
                jobdesc: '',
              };
            })
            .filter((r) => r.nama && r.nama !== '-');

          if (mappedSantri.length > 0) {
            setSantriList(mappedSantri);
            showToast(`Data santri berhasil dimuat dari spreadsheet (${mappedSantri.length} santri).`);
            setIsLoadingSantri(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[GeneratorSurat] Gagal fetch Google Sheets, menggunakan fallback kanonikal:', e);
    }

    // Fallback kanonikal jika offline atau fetch terhambat
    setSantriList(
      CANONICAL_LEGACY_SANTRI_FIXTURES.map((s, idx) => ({
        ...s,
        _realIdx: idx,
        _checked: idx < 5,
      }))
    );
    showToast(`Data santri dimuat dari cache historis resmi (${CANONICAL_LEGACY_SANTRI_FIXTURES.length} santri).`);
    setIsLoadingSantri(false);
  };

  // Muat data spreadsheet otomatis pada saat inisialisasi halaman (Paritas PHP Legacy L35676)
  useEffect(() => {
    loadGoogleSheetsData(false);
  }, []);

  const handleConfirmPublish = async () => {
    if (!can('documents.generate') || publishInFlight.current || printCopy) return;
    if (!selectedSantri.length || !kegiatan.trim() || !tanggalMulai || (hasEndDate && tanggalSelesai < tanggalMulai)) {
      showToast('Lengkapi kegiatan, tanggal yang valid, dan pilih minimal satu santri.');
      return;
    }
    publishInFlight.current = true;
    setIsPublishing(true);
    const finalIssuer = showDikeluarkan
      ? customDikeluarkan.trim() || 'Eksekutif PTV'
      : 'Progresif TV';

    try {
      // Persist to Supabase cloud table ptv_surat_izin via dokumenService (Official Approved status)
      const payload = {
        type: 'Surat Izin Santri',
        subject: kegiatan,
        date: tanggalMulai,
        start_date: tanggalMulai,
        end_date: hasEndDate ? tanggalSelesai : tanggalMulai,
        penanggung_jawab: finalIssuer,
        recipients: selectedSantri.map((s) => s.nama),
        santri_list: selectedSantri.map((s) => ({ ...s })),
        metadata: { colsConfig, activeCols, activePreset, showDikeluarkan, customDikeluarkan },
        notes: 'Penerbitan surat izin santri melalui generator resmi Progresif TV',
        status: 'Disetujui',
      };
      const result = await publisher.current(payload);
      setPreviewVersion((version) => version + 1);
      setPrintCopy(result.pdf);
      showToast(`Surat ${result.doc.no} resmi diterbitkan dan masuk ke Surat & Arsip.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Penerbitan atau unduhan PDF gagal.');
    } finally {
      publishInFlight.current = false;
      setIsPublishing(false);
    }
  };

  // Viewport Container Ref for Pan & Zoom
  const viewportRef = useRef<HTMLDivElement>(null);

  // Restricted Access Fallback
  if (!canGenerate) {
    return (
      <div className="gen-surat-root" style={{ paddingTop: '40px' }}>
        <div className="gen-access-restricted-card">
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 18px',
              fontSize: '26px',
            }}
          >
            <i className="fa-solid fa-shield-halved" />
          </div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--ink)',
              margin: '0 0 10px',
            }}
          >
            Akses Khusus Eksekutif & Administrasi
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            Fitur Generator Surat Izin Resmi khusus untuk peran <b>Eksekutif</b> dan{' '}
            <b>Administrasi</b>. Pengajuan operasional lainnya dapat diproses melalui
            modul perizinan.
          </p>
          <button
            type="button"
            className="gen-preset-btn active"
            onClick={() => navigate('/hub/beranda')}
            style={{
              padding: '10px 24px',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fa-solid fa-arrow-left" />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gen-surat-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="gen-toast-box">
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="gen-header">
        <h1 className="gen-header-title">Generator Surat Izin</h1>
        <p className="gen-header-subtitle">
          Penerbitan Surat Izin Santri Resmi Progresif TV
        </p>
      </div>

      {/* ── PANEL 1: PARAMETER SURAT ── */}
      <div className="gen-panel-card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Nama Kegiatan */}
          <div>
            <label className="gen-panel-label" htmlFor="genKegiatanInput">
              Nama Kegiatan <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="genKegiatanInput"
              type="text"
              className="gen-input"
              value={kegiatan}
              onChange={(e) => setKegiatan(e.target.value)}
              placeholder="Ketik nama kegiatan izin..."
            />
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="gen-panel-label" htmlFor="genTanggalMulaiInput">
              Tanggal Mulai <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="genTanggalMulaiInput"
              type="date"
              className="gen-input"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
            />
            <div style={{ marginTop: '10px' }}>
              <label className="gen-checkbox-label">
                <input
                  type="checkbox"
                  checked={hasEndDate}
                  onChange={(e) => setHasEndDate(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--pri, #1273E6)',
                    cursor: 'pointer',
                  }}
                />
                <span>Sampai tanggal tertentu (Rentang Hari)</span>
              </label>
            </div>
          </div>

          {/* Tanggal Selesai (Opsional) */}
          {hasEndDate && (
            <div>
              <label className="gen-panel-label" htmlFor="genTanggalSelesaiInput">Tanggal Selesai</label>
              <input
                id="genTanggalSelesaiInput"
                type="date"
                className="gen-input"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Baris Bawah Parameter: Nomor Surat & Pengesahan */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--line-2, #f1f5f9)',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Nomor preview belum dicadangkan; nomor final berasal dari server. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--ink-2, #475569)',
              }}
            >
              Nomor Surat:
            </span>
            <span className="gen-nomor-badge">
              {isCheckingVacant ? 'Memverifikasi nomor...' : (previewAvailable ? nomorSurat : 'Belum tersedia')}
            </span>
          </div>

          {/* Opsi Pengesahan */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div className="gen-dikeluarkan-wrap">
              <label className="gen-checkbox-label" style={{ margin: 0, gap: '6px' }}>
                <input
                  type="checkbox"
                  checked={showDikeluarkan}
                  onChange={(e) => setShowDikeluarkan(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--pri, #1273E6)',
                    cursor: 'pointer',
                  }}
                />
                <span>Dikeluarkan:</span>
              </label>

              {showDikeluarkan ? (
                <input
                  type="text"
                  value={customDikeluarkan}
                  onChange={(e) => setCustomDikeluarkan(e.target.value)}
                  placeholder="Nama penerbit/eksekutif..."
                  className="gen-dikeluarkan-input"
                />
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                  (Progresif TV)
                </span>
              )}
            </div>

            {/* Refresh Santri Data Button (Paritas PHP Legacy) */}
            <button
              type="button"
              onClick={() => loadGoogleSheetsData(true)}
              title="Perbarui Data Santri dari Spreadsheet"
              className="gen-refresh-btn"
              disabled={isLoadingSantri}
            >
              <i
                className={`fa-solid fa-arrows-rotate ${
                  isLoadingSantri ? 'fa-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── PANEL 2: PENGATURAN KOLOM & FILTER SANTRI ── */}
      <div className="gen-panel-card">
        {/* Preset Kolom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ink-2, #475569)',
            }}
          >
            Preset Kolom:
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`gen-preset-btn ${activePreset === 'sekolah' ? 'active' : ''}`}
              onClick={() => applyPreset('sekolah')}
            >
              Preset Sekolah
            </button>
            <button
              type="button"
              className={`gen-preset-btn ${activePreset === 'asrama' ? 'active' : ''}`}
              onClick={() => applyPreset('asrama')}
            >
              Preset Asrama
            </button>
          </div>
          <span className="gen-col-count-badge">
            {activeCols.length} Kolom Aktif (Maks 6)
          </span>
        </div>

        {/* Kolom Toggles Box */}
        <div className="gen-col-toggles-box">
          {(Object.keys(COL_LABELS) as IzinColKey[]).map((colKey) => {
            const isChecked = !!colsConfig[colKey];
            return (
              <label
                key={colKey}
                className={`gen-col-pill ${isChecked ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleColumn(colKey)}
                  style={{
                    width: '14px',
                    height: '14px',
                    accentColor: '#059669',
                    cursor: 'pointer',
                  }}
                />
                <span>{COL_LABELS[colKey]}</span>
              </label>
            );
          })}
        </div>

        {/* Angkatan Filter Chips Bar */}
        <div className="gen-angkatan-bar" style={{ marginBottom: '18px' }}>
          <button
            type="button"
            className={`gen-angkatan-chip ${!selectedAngkatan ? 'active' : ''}`}
            onClick={() => setSelectedAngkatan('')}
          >
            Semua ({santriList.length})
          </button>
          {sortedAngkatans.map((angk) => {
            const count = angkatanCounts[angk] || 0;
            const isActive = selectedAngkatan === angk;
            return (
              <button
                key={angk}
                type="button"
                className={`gen-angkatan-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedAngkatan(angk)}
              >
                Angkatan {angk} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Bar & Multi-Select Header Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Live Search */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              minWidth: '240px',
              maxWidth: '420px',
            }}
          >
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="gen-input"
              style={{ paddingLeft: '38px', paddingRight: '36px' }}
              placeholder="Cari santri, unit, kelas, asrama, kamar..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Select All & Selection Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="gen-checkbox-label" style={{ fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={toggleSelectAllFiltered}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--pri, #1273E6)',
                  cursor: 'pointer',
                }}
              />
              <span>
                Pilih Semua ({filteredSantri.length})
              </span>
            </label>

            <span className="gen-sel-count-badge">
              {selectedSantri.length} Terpilih
            </span>
          </div>
        </div>
      </div>

      {/* ── PANEL 3: TABEL DATA SANTRI ── */}
      <div className="gen-panel-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '12px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--line-2, #f1f5f9)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              Daftar Santri Terkelompok
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)' }}>
              • Dikelompokkan per angkatan &amp; alfabetis
            </span>
          </div>
        </div>

        <div className="gen-table-wrap">
          <table className="gen-table" id="gridIzin">
            <thead>
              <tr>
                <th style={{ width: '46px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>Nama Santri</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Unit</th>
                <th style={{ textAlign: 'center', minWidth: '110px' }}>Kelas</th>
                <th style={{ minWidth: '150px' }}>Wali Kelas</th>
                <th style={{ textAlign: 'center', minWidth: '130px' }}>Kamar</th>
                <th style={{ textAlign: 'center', minWidth: '120px' }}>Asrama</th>
                <th style={{ minWidth: '150px' }}>Murobbi</th>
                <th style={{ textAlign: 'center', minWidth: '90px' }}>Madin</th>
                <th style={{ textAlign: 'center', minWidth: '100px' }}>Intensif</th>
                <th style={{ textAlign: 'center', minWidth: '180px' }}>
                  Catatan Khusus
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSantri.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      textAlign: 'center',
                      padding: '36px',
                      color: '#64748b',
                    }}
                  >
                    <i
                      className="fa-solid fa-user-slash"
                      style={{
                        fontSize: '24px',
                        color: '#94a3b8',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    />
                    Tidak ada data santri ditemukan.
                  </td>
                </tr>
              ) : (
                groupedSantri.map((group: any) => (
                  <React.Fragment key={group.angkatan}>
                    {/* Baris Pemisah Kelompok Angkatan (Paritas PHP Legacy L34416-L34426) */}
                    <tr
                      style={{
                        background: '#f1f5f9',
                        borderTop: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <td colSpan={11} style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <i
                            className="fa-solid fa-layer-group"
                            style={{ color: '#1e478f', fontSize: '13px' }}
                          />
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              color: '#1e293b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {group.label}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#475569',
                              background: '#e2e8f0',
                              padding: '2px 10px',
                              borderRadius: '9999px',
                            }}
                          >
                            {group.students.length} Santri
                          </span>
                        </div>
                      </td>
                    </tr>

                    {group.students.map((row: Santri) => {
                      const isChecked = !!row._checked;

                      return (
                        <tr
                          key={row.nama + row._realIdx}
                          className={isChecked ? 'is-selected' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (
                              target.closest('.gen-stop-click') ||
                              target.tagName === 'INPUT' ||
                              target.tagName === 'LABEL'
                            ) {
                              return;
                            }
                            toggleStudentCheck(row._realIdx);
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleStudentCheck(row._realIdx)}
                              style={{
                                width: '18px',
                                height: '18px',
                                accentColor: '#1e478f',
                                cursor: 'pointer',
                              }}
                            />
                          </td>
                          <td className="gen-santri-nama">
                            <span>{row.nama}</span>
                            {row.is_intern && (
                              <span
                                style={{
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                background: '#dcfce7',
                                color: '#166534',
                                fontSize: '10px',
                                fontWeight: 800,
                                marginLeft: '6px',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              Intern
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="gen-unit-badge">
                            {row.unit}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {row.kelas}
                        </td>
                        <td>{row.walikelas}</td>
                        <td style={{ textAlign: 'center' }}>{row.kamar}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="gen-asrama-badge">
                            {row.asrama}
                          </span>
                        </td>
                        <td>{row.murobbi}</td>
                        <td style={{ textAlign: 'center' }}>{row.madin}</td>
                        <td style={{ textAlign: 'center' }}>{row.intensif}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div
                            className="gen-stop-click"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <label className="gen-catatan-toggle">
                              <input
                                type="checkbox"
                                checked={!!row.jobdesc_enabled}
                                onChange={() => toggleStudentJobdesc(row._realIdx)}
                                style={{ accentColor: '#1e478f' }}
                              />
                              Catatan
                            </label>
                            {row.jobdesc_enabled && (
                              <input
                                type="text"
                                value={row.jobdesc || ''}
                                onChange={(e) =>
                                  updateStudentJobdesc(row._realIdx, e.target.value)
                                }
                                placeholder="Isi catatan..."
                                className="gen-catatan-input"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* ── PANEL 4: PRATINJAU SURAT (VIEWER) & UNDUH PDF ── */}
      <div className="gen-pdf-box">
        {/* PDF Top Bar */}
        <div className="gen-pdf-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="gen-pdf-icon-wrap">
              <i className="fa-solid fa-file-pdf" />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Pratinjau Dokumen Resmi
                </span>
                {isCheckingVacant ? (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: '#f1f5f9',
                      color: '#64748b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className="fa-solid fa-spinner fa-spin" /> Cek Nomor...
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--ink, #1e293b)',
                      fontFamily: 'monospace',
                      background: 'var(--surface-2, #f1f5f9)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--line, #cbd5e1)',
                    }}
                  >
                    {nomorSurat}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                Format Standar Cetak A4 — Progresif TV
              </p>
            </div>
          </div>

          {/* Zoom Controls & Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Zoom Controls */}
            <div className="gen-zoom-group">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.4, prev - 0.15))}
                title="Perkecil (-)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#475569',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-minus" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoom(window.innerWidth < 768 ? 0.65 : 0.95)
                }
                title="Reset Ukuran Zoom"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(1.8, prev + 0.15))}
                title="Perbesar (+)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#475569',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-plus" />
              </button>
            </div>

            {/* Tombol Unduh PDF Resmi */}
            <button
              type="button"
              id="izinPdfBtn"
              onClick={handleConfirmPublish}
              disabled={selectedSantri.length === 0 || isPublishing || Boolean(printCopy) || !can('documents.generate')}
              className="gen-pdf-download-btn"
              style={{
                cursor: selectedSantri.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedSantri.length === 0 ? 0.5 : 1,
                background: selectedSantri.length === 0 ? '#94a3b8' : '#059669',
                boxShadow:
                  selectedSantri.length === 0
                    ? 'none'
                    : '0 4px 12px rgba(5,150,105,0.25)',
              }}
            >
              <i className="fa-solid fa-file-arrow-down" />
              {isPublishing ? 'Menyiapkan PDF…' : 'Buat & Unduh PDF'}
            </button>
          </div>
        </div>

        {/* Viewport Canvas Paper */}
        <div className="gen-pdf-viewport" ref={viewportRef}>
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <SuratIzinPdfPreview
              selectedSantri={selectedSantri}
              activeCols={activeCols}
              kegiatan={kegiatan}
              tanggalMulai={tanggalMulai}
              tanggalSelesai={tanggalSelesai}
              hasEndDate={hasEndDate}
              nomorSurat={nomorSurat}
              showDikeluarkan={showDikeluarkan}
              customDikeluarkan={customDikeluarkan}
            />
          </div>
        </div>
      </div>

      {printCopy && <PrintCopyOffer onClose={() => setPrintCopy(null)} onPrint={() => {
        try {
          printOfficialPdf(printCopy);
          setPrintCopy(null);
        } catch (error) {
          setPrintCopy(null);
          alert(error instanceof Error ? error.message : 'Gagal membuka cetak salinan.');
        }
      }} />}
    </div>
  );
};
