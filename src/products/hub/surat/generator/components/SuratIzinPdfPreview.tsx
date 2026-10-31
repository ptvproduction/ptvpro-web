import { useLayoutEffect, useRef, useState } from 'react';
import { RealQrCode } from '@shared/utils';
import { buildOfficialDocVerificationUrl } from '../../../../verification/verificationService';
import {
  Santri,
  IzinColKey,
  COL_LABELS,
} from '../mock/santriMockData';

export const OFFICIAL_KOP_LOGO_URL = '/assets/images/BS-X-PTV.webp';

export interface SuratIzinPdfPreviewProps {
  selectedSantri: Santri[];
  activeCols: IzinColKey[];
  kegiatan: string;
  tanggalMulai: string;
  tanggalSelesai?: string;
  hasEndDate: boolean;
  nomorSurat: string;
  showDikeluarkan: boolean;
  customDikeluarkan: string;
}

export const SuratIzinPdfPreview: React.FC<SuratIzinPdfPreviewProps> = ({
  selectedSantri,
  activeCols,
  kegiatan,
  tanggalMulai,
  tanggalSelesai,
  hasEndDate,
  nomorSurat,
  showDikeluarkan,
  customDikeluarkan,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const layoutKey = JSON.stringify([selectedSantri, activeCols, kegiatan, tanggalMulai, tanggalSelesai, hasEndDate, nomorSurat, showDikeluarkan, customDikeluarkan]);
  const [layout, setLayout] = useState<{ key: string; counts: number[] } | null>(null);
  const initialCounts: number[] = [];
  for (let rest = selectedSantri.length; rest > 0;) {
    const size = Math.min(rest, initialCounts.length ? 22 : 20);
    initialCounts.push(size); rest -= size;
  }
  const counts = layout?.key === layoutKey ? layout.counts : initialCounts;
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const sheets = Array.from(area.querySelectorAll<HTMLElement>('.izin-pdf-page'));
      for (let index = 0; index < sheets.length; index++) {
        const sheet = sheets[index];
        const content = sheet.querySelector<HTMLElement>('[data-page-content]')!;
        const box = sheet.getBoundingClientRect();
        const scale = box.height / 1122;
        if (content.getBoundingClientRect().bottom > box.bottom - 34 * scale + 0.5) {
          area.dataset.pdfLayout = 'pending';
          if (counts[index] <= 1) { area.dataset.pdfLayout = 'error'; return; }
          const overflow = content.getBoundingClientRect().bottom - (box.bottom - 34 * scale);
          const rows = Array.from(sheet.querySelectorAll('tbody tr')).slice(-counts[index]);
          let move = 0; let freed = 0;
          while (move < counts[index] - 1 && freed < overflow) {
            freed += rows[rows.length - 1 - move].getBoundingClientRect().height;
            move++;
          }
          const next = [...counts]; next[index] -= Math.max(1, move);
          if (next[index + 1] === undefined) next.push(Math.max(1, move)); else next[index + 1] += Math.max(1, move);
          for (let j = index + 1; j < next.length; j++) {
            if (next[j] > 22) {
              const excess = next[j] - 22; next[j] = 22;
              if (next[j + 1] === undefined) next.push(excess); else next[j + 1] += excess;
            }
          }
          setLayout({ key: layoutKey, counts: next });
          return;
        }
      }
      area.dataset.pdfLayout = 'ready';
    };
    const observer = new ResizeObserver(measure);
    area.querySelectorAll('[data-page-content]').forEach((node) => observer.observe(node));
    measure();
    void document.fonts.ready.then(measure);
    return () => { alive = false; observer.disconnect(); };
  }, [layoutKey, counts]);

  // Format Tanggal Indonesia
  const formatTanggalIndo = (val?: string) => {
    if (!val) return '—';
    const parts = val.split('-');
    if (parts.length !== 3) return val;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return val;
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const startFmt = formatTanggalIndo(tanggalMulai);
  const endFmt = hasEndDate && tanggalSelesai ? formatTanggalIndo(tanggalSelesai) : '';
  const rangeText =
    hasEndDate && endFmt && startFmt !== endFmt
      ? `${startFmt} s.d. ${endFmt}`
      : startFmt || '—';

  // 1. EMPTY STATE (0 Santri Terpilih)
  if (!selectedSantri.length) {
    return (
      <div
        className="gen-empty-preview bg-white"
        style={{
          width: '794px',
          minWidth: '794px',
          maxWidth: '794px',
          minHeight: '480px',
          padding: '64px 36px',
          background: '#ffffff',
          border: '1.5px dashed #cbd5e1',
          boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: '#fef2f2',
            border: '2.5px solid #fecaca',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '20px',
            boxShadow: '0 4px 14px rgba(239,68,68,0.12)',
          }}
        >
          <i
            className="fa-solid fa-xmark"
            style={{ fontSize: '42px', color: '#ef4444', fontWeight: 900 }}
          />
        </div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '8px',
            letterSpacing: '-0.01em',
          }}
        >
          Tidak Ada Kru / Santri Terpilih
        </div>
        <p
          style={{
            fontSize: '13.5px',
            color: '#64748b',
            maxWidth: '440px',
            lineHeight: 1.6,
            margin: '0 0 20px',
          }}
        >
          Pratinjau dokumen dan tombol unduh surat izin dinonaktifkan. Silakan
          centang minimal <b>1 kru / santri</b> pada tabel di atas untuk memuat
          pratinjau dan menerbitkan surat izin.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#be123c',
          }}
        >
          <i className="fa-solid fa-circle-exclamation" />
          <span>Syarat: Minimal 1 Kru Terpilih</span>
        </div>
      </div>
    );
  }

  let startIdx = 0;
  const pages = counts.map((count, index) => {
    const page = { rows: selectedSantri.slice(startIdx, startIdx + count), startIdx,
      isPage1: index === 0, isFinal: index === counts.length - 1 };
    startIdx += count;
    return page;
  });

  const totalPageCount = pages.length;

  // Official public verification URL for document
  const docVerificationUrl = buildOfficialDocVerificationUrl(nomorSurat || 'PTV-SURAT-IZIN');

  // Render Real Scannable QR Code SVG Terisolasi
  const renderQrCodeSvg = (size = 66) => {
    return (
      <RealQrCode
        payload={docVerificationUrl}
        size={size}
        margin={4}
        color="#000000"
        bgColor="#ffffff"
        ariaLabel="QR Code Verifikasi Dokumen Resmi"
      />
    );
  };

  return (
    <div
      ref={areaRef}
      data-pdf-layout="pending"
      id="izinPrintArea"
      className="gen-print-area"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '28px',
        width: '794px',
        minWidth: '794px',
      }}
    >
      {pages.map((pg, pIdx) => {
        const pageNum = pIdx + 1;
        const isLastPage = pIdx === totalPageCount - 1;

        return (
          <div
            key={`page-${pageNum}`}
            className="izin-pdf-page paper-preview bg-white"
            data-page={pageNum}
            style={{
              width: '794px',
              minWidth: '794px',
              maxWidth: '794px',
              height: '1122px',
              minHeight: '1122px',
              maxHeight: '1122px',
              padding: '34px 38px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow:
                '0 10px 30px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)',
              fontFamily:
                "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#0f172a',
              boxSizing: 'border-box',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              pageBreakAfter: !isLastPage ? 'always' : 'auto',
              breakAfter: !isLastPage ? 'page' : 'auto',
            }}
          >
            <div data-page-content style={{ width: '100%', position: 'relative' }}>
              {/* ── KOP SURAT HEADER (HALAMAN 1 vs LANJUTAN) ── */}
              {pg.isPage1 ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '3.5px double #0e4f40',
                      paddingBottom: '10px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={OFFICIAL_KOP_LOGO_URL}
                        alt="Logo Progresif TV"
                        style={{
                          height: '48px',
                          width: 'auto',
                          maxWidth: '180px',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                        onError={(e) => {
                          // Fallback to avoid broken image frame if official asset is pending upload
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 900,
                          color: '#0e4f40',
                          letterSpacing: '0.02em',
                          lineHeight: 1.1,
                          margin: '0 0 2px 0',
                        }}
                      >
                        PROGRESIF TV
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#1e293b',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          marginBottom: '3px',
                        }}
                      >
                        OFFICIAL MEDIA BROADCASTER
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#64748b',
                          fontWeight: 500,
                          lineHeight: 1.3,
                        }}
                      >
                        Jl. Kyai Dasuki No.1, Lebo, Kecamatan Sidoarjo,
                        Kabupaten Sidoarjo, Jawa Timur 61223
                      </div>
                    </div>
                  </div>

                  {/* Judul & Nomor Surat */}
                  <div style={{ textAlign: 'center', margin: '12px 0 10px' }}>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#0f172a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      SURAT IZIN SANTRI PROGRESIF TV
                    </div>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#475569',
                        marginTop: '3px',
                      }}
                    >
                      Nomor: <span>{nomorSurat || '—'}</span>
                    </div>
                  </div>

                  {/* Metadata Table */}
                  <table className="gen-pdf-meta-table">
                    <tbody>
                      <tr>
                        <td
                          style={{
                            padding: '5px 12px',
                            width: '28%',
                            fontWeight: 600,
                            color: '#475569',
                            borderBottom: '1px solid #e2e8f0',
                          }}
                        >
                          Nama Kegiatan
                        </td>
                        <td
                          style={{
                            padding: '5px 12px',
                            fontWeight: 700,
                            color: '#0f172a',
                            borderBottom: '1px solid #e2e8f0',
                          }}
                        >
                          {kegiatan || '—'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '5px 12px',
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          Diizinkan Tanggal
                        </td>
                        <td
                          style={{
                            padding: '5px 12px',
                            fontWeight: 700,
                            color: '#0e4f40',
                          }}
                        >
                          {rangeText}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : (
                /* Header Halaman Lanjutan */
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #0e4f40',
                    paddingBottom: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <img
                      src="/assets/images/ptv-logo-white.webp"
                      alt="Logo Progresif TV"
                      style={{
                        height: '24px',
                        width: 'auto',
                        maxWidth: '90px',
                        objectFit: 'contain',
                        filter: 'brightness(0) saturate(100%) invert(22%) sepia(45%) saturate(1400%) hue-rotate(125deg) brightness(90%) contrast(95%)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#0e4f40',
                        textTransform: 'uppercase',
                      }}
                    >
                      PROGRESIF TV · SURAT IZIN SANTRI (LANJUTAN)
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#64748b',
                    }}
                  >
                    Nomor: {nomorSurat}
                  </div>
                </div>
              )}

              {/* ── TABEL SANTRI CHUNK ── */}
              <div style={{ marginTop: '4px' }}>
                <table className="gen-pdf-santri-table">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#0e4f40',
                        color: '#ffffff',
                        fontWeight: 800,
                        textAlign: 'center',
                        letterSpacing: '0.03em',
                      }}
                    >
                      <th
                        style={{
                          padding: '7px 6px',
                          borderRight: '1px solid rgba(255,255,255,0.15)',
                          width: '32px',
                          textAlign: 'center',
                          fontSize: '10px',
                        }}
                      >
                        NO
                      </th>
                      <th
                        style={{
                          padding: '7px 10px',
                          borderRight: activeCols.length
                            ? '1px solid rgba(255,255,255,0.15)'
                            : 'none',
                          textAlign: 'left',
                          minWidth: '130px',
                          fontSize: '10px',
                        }}
                      >
                        NAMA SANTRI
                      </th>
                      {activeCols.map((colKey, colIdx) => {
                        const isLast = colIdx === activeCols.length - 1;
                        return (
                          <th
                            key={colKey}
                            style={{
                              padding: '7px 8px',
                              borderRight: isLast
                                ? 'none'
                                : '1px solid rgba(255,255,255,0.15)',
                              textAlign: 'center',
                              fontSize: '10px',
                            }}
                          >
                            {(COL_LABELS[colKey] || colKey).toUpperCase()}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pg.rows.map((r, idx) => {
                      const absoluteNum = pg.startIdx + idx + 1;
                      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                      return (
                        <tr
                          key={r.nama + idx}
                          style={{
                            backgroundColor: bg,
                            color: '#1e293b',
                          }}
                        >
                          <td
                            style={{
                              padding: '6px 6px',
                              borderTop: '1px solid #cbd5e1',
                              borderRight: '1px solid #cbd5e1',
                              textAlign: 'center',
                              fontWeight: 600,
                              color: '#64748b',
                              verticalAlign: 'middle',
                            }}
                          >
                            {absoluteNum}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              borderTop: '1px solid #cbd5e1',
                              borderRight: activeCols.length
                                ? '1px solid #cbd5e1'
                                : undefined,
                              fontWeight: 700,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              verticalAlign: 'middle',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{r.nama || '—'}</span>
                              {r.is_intern && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '9999px',
                                    marginLeft: '5px',
                                    verticalAlign: 'middle',
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Intern
                                </span>
                              )}
                            </span>
                            {!activeCols.includes('jobdesc') &&
                              r.jobdesc_enabled &&
                              r.jobdesc && (
                                <div
                                  style={{
                                    fontSize: '9px',
                                    color: '#0e4f40',
                                    fontWeight: 700,
                                    marginTop: '2px',
                                  }}
                                >
                                  Catatan: {r.jobdesc}
                                </div>
                              )}
                          </td>
                          {activeCols.map((colKey, colIdx) => {
                            const isLast = colIdx === activeCols.length - 1;
                            const val =
                              colKey === 'jobdesc'
                                ? r.jobdesc_enabled && r.jobdesc
                                  ? r.jobdesc
                                  : '—'
                                : (r[colKey] as string) || '—';
                            const isJob = colKey === 'jobdesc';

                            return (
                              <td
                                key={colKey}
                                style={{
                                  padding: '6px 8px',
                                  borderTop: '1px solid #cbd5e1',
                                  borderRight: isLast
                                    ? undefined
                                    : '1px solid #cbd5e1',
                                  textAlign: 'center',
                                  fontWeight: isJob ? 700 : 500,
                                  color: isJob ? '#0e4f40' : '#334155',
                                  verticalAlign: 'middle',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── BLOK KEABSAHAN DI AKHIR TABEL (HANYA PADA HALAMAN TERAKHIR) ── */}
              {pg.isFinal && (
                <div
                  style={{
                    marginTop: '14px',
                    borderTop: '1.5px solid #0e4f40',
                    paddingTop: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      gap: '20px',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        fontSize: '8.5px',
                        color: '#64748b',
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '10.5px',
                          color: '#0e4f40',
                          marginBottom: '2px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        Dokumen Resmi Surat Izin Santri Progresif TV
                      </div>
                      <div
                        style={{
                          color: '#475569',
                          fontSize: '9px',
                          lineHeight: 1.4,
                        }}
                      >
                        Dokumen ini diterbitkan secara sah melalui Sistem
                        Digital Progresif TV dan berlaku resmi tanpa tanda tangan
                        basah.
                      </div>
                      <div
                        style={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          marginTop: '2px',
                        }}
                      >
                        Pindai QR code di samping untuk memverifikasi keabsahan
                        dokumen di portal resmi Progresif TV.
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        textAlign: 'right',
                        flexShrink: 0,
                        minWidth: 0,
                        maxWidth: '52%',
                      }}
                    >
                      {showDikeluarkan && (
                        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          <div
                            style={{
                              fontSize: '10.5px',
                              color: '#475569',
                              marginBottom: '2px',
                            }}
                          >
                            Dikeluarkan oleh:
                          </div>
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 800,
                              color: '#0f172a',
                            }}
                          >
                            {customDikeluarkan || 'Eksekutif'}
                          </div>
                          <div
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              color: '#0e4f40',
                              marginTop: '2px',
                            }}
                          >
                            PROGRESIF TV
                          </div>
                        </div>
                      )}
                      <div className="gen-pdf-qr-box">
                        {renderQrCodeSvg(66)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Nomor Halaman Badge di Kanan Bawah */}
            {totalPageCount > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  right: '36px',
                  fontSize: '9px',
                  color: '#94a3b8',
                  fontWeight: 600,
                }}
              >
                Halaman {pageNum} dari {totalPageCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
