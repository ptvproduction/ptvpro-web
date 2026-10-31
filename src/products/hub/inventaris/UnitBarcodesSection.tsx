import React, { useState } from 'react';
import { ItemInventaris, InventarisUnit } from './types';
import { barcode128SVG, getUnitBarcodeCode, isNiksanUnit } from './utils/barcode128';
import {
  exportUnitBarcodePNG,
  exportAllUnitBarcodesPNG,
  printUnitBarcode,
  printAllUnitBarcodes,
  PTV_LOGO_PATH,
  normalizeBarcodeBranding,
} from './utils/barcodeExportUtils';

interface UnitBarcodesSectionProps {
  asset: ItemInventaris;
}

export const UnitBarcodesSection: React.FC<UnitBarcodesSectionProps> = ({ asset }) => {
  const [exportingAll, setExportingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  // Urutkan unit secara konsisten dan deterministik berdasarkan kode_unit (A-Z natural sort)
  const sortedUnits: InventarisUnit[] = React.useMemo(() => {
    if (!asset.units || asset.units.length === 0) return [];
    return [...asset.units].sort((a, b) => {
      const codeA = a.kode_unit || '';
      const codeB = b.kode_unit || '';
      return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' });
    });
  }, [asset.units]);

  const total = sortedUnits.length || asset.total_unit || 0;

  // Siapkan data unit untuk aksi massal
  const unitsPayload = React.useMemo(() => {
    return sortedUnits.map((u, idx) => {
      const unitCode = getUnitBarcodeCode(asset.kode, idx + 1, u.kode_unit);
      const unitName = u.nama_unit?.trim() || `Unit ${idx + 1}`;
      const isNik = isNiksanUnit(u);
      return { unitCode, unitName, isNiksan: isNik };
    });
  }, [sortedUnits, asset.kode]);

  const handlePrintSingle = (unitCode: string, unitName: string, isNik: boolean) => {
    try {
      printUnitBarcode(asset.nama_alat, unitCode, unitName, isNik);
    } catch (e: any) {
      showToast('Gagal mencetak: ' + (e?.message || e));
    }
  };

  const handleExportSingle = async (unitCode: string, isNik: boolean) => {
    try {
      showToast(`Menyiapkan ekspor PNG ${unitCode}...`);
      await exportUnitBarcodePNG(unitCode, isNik);
      showToast(`Barcode ${unitCode} berhasil diekspor sebagai PNG.`);
    } catch (e: any) {
      showToast('Gagal mengekspor PNG: ' + (e?.message || e));
    }
  };

  const handlePrintAll = () => {
    if (unitsPayload.length === 0) return;
    try {
      printAllUnitBarcodes(asset.nama_alat, asset.kode, unitsPayload);
    } catch (e: any) {
      showToast('Gagal mencetak semua: ' + (e?.message || e));
    }
  };

  const handleExportAll = async () => {
    if (unitsPayload.length === 0 || exportingAll) return;
    setExportingAll(true);
    showToast(`Mengekspor seluruh ${unitsPayload.length} barcode unit (PNG)...`);
    try {
      await exportAllUnitBarcodesPNG(
        unitsPayload.map((u) => ({ unitCode: u.unitCode, isNiksan: u.isNiksan })),
        (curr, tot) => {
          showToast(`Mengekspor barcode PNG ${curr}/${tot}...`);
        }
      );
      showToast(`Selesai mengekspor seluruh ${unitsPayload.length} barcode unit (PNG).`);
    } catch (e: any) {
      showToast('Gagal mengekspor semua barcode: ' + (e?.message || e));
    } finally {
      setExportingAll(false);
    }
  };

  if (total === 0) {
    return (
      <div className="prod-section-card">
        <div className="prod-section-header">
          <div className="prod-section-title-wrap">
            <div className="prod-section-icon-badge indigo">
              <i className="fa-solid fa-barcode" />
            </div>
            <div>
              <h3 className="prod-section-title">
                <span>Label Barcode Unit</span>
                <span className="prod-section-count-chip">0 Unit</span>
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 550, marginTop: '2px' }}>
                Standar Code 128 untuk pemindaian scanner barcode fisik laboratorium
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', opacity: 0.6 }} />
          Belum ada unit fisik terdaftar untuk alat ini.
        </div>
      </div>
    );
  }

  return (
    <div className="prod-section-card" id="unitBarcodesSection">
      {/* ── SECTION HEADER ── */}
      <div className="prod-section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="prod-section-title-wrap">
          <div className="prod-section-icon-badge indigo">
            <i className="fa-solid fa-barcode" />
          </div>
          <div>
            <h3 className="prod-section-title">
              <span>Label Barcode Unit</span>
              <span className="prod-section-count-chip">{`${total} Unit Terdaftar`}</span>
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 550, marginTop: '2px' }}>
              Standar Code 128 untuk pemindaian scanner barcode fisik laboratorium
            </div>
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="prod-section-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm"
            id="btnPrintAllBarcodes"
            onClick={handlePrintAll}
            style={{
              fontSize: '11.5px',
              padding: '5px 14px',
              fontWeight: 650,
              borderRadius: 'var(--ptv-curve-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--surface-2)',
              border: '1.5px solid var(--line-2)',
              color: 'var(--ink)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
            title={`Cetak Seluruh ${total} Label Barcode`}
          >
            <i className="fa-solid fa-print" style={{ color: 'var(--b-600)' }} />
            <span>Cetak Semua</span>
          </button>
          <button
            type="button"
            className="btn sm"
            id="btnExportAllBarcodes"
            onClick={handleExportAll}
            disabled={exportingAll}
            style={{
              fontSize: '11.5px',
              padding: '5px 14px',
              fontWeight: 650,
              borderRadius: 'var(--ptv-curve-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--surface-2)',
              border: '1.5px solid var(--line-2)',
              color: 'var(--ink)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              cursor: exportingAll ? 'wait' : 'pointer',
              opacity: exportingAll ? 0.7 : 1,
            }}
            title={`Ekspor Seluruh ${total} Barcode PNG`}
          >
            <i className={`fa-solid ${exportingAll ? 'fa-spinner fa-spin' : 'fa-download'}`} style={{ color: 'var(--sky, #0284c7)' }} />
            <span>{exportingAll ? 'Mengekspor...' : 'Ekspor Semua (PNG)'}</span>
          </button>
        </div>
      </div>

      {/* Floating inline toast for feedback */}
      {toastMessage && (
        <div
          style={{
            margin: '10px 0 14px',
            padding: '8px 14px',
            background: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
            borderRadius: 'var(--ptv-curve-sm)',
            color: 'var(--info)',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-info" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── UNIT BARCODES GRID ── */}
      <div
        className="unit-barcodes-grid"
        id="unitBarcodesGrid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
          marginTop: '16px',
        }}
      >
        {sortedUnits.map((u, idx) => {
          const unitCode = getUnitBarcodeCode(asset.kode, idx + 1, u.kode_unit);
          const unitDisplayName = u.nama_unit?.trim() || `Unit ${idx + 1}`;
          const isNik = isNiksanUnit(u);
          const svgMarkup = barcode128SVG(unitCode, { width: isNik ? 220 : 210, showText: true });

          return (
            <div key={u.id || unitCode} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Unit name tag above the card */}
              <div
                className="barcode-label-unit-tag"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  padding: '4px 4px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isNik ? '#f59e0b' : '#3b82f6',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span className="barcode-label-unit-name" style={{ marginLeft: 0 }}>
                    {unitDisplayName}
                  </span>
                </div>
                <span className="barcode-label-unit-code">{unitCode}</span>
              </div>

              {/* Shipping Label Card */}
              {isNik ? (
                <div className="barcode-label-card is-niksan">
                  {/* Area Atas: Header Branding NIKSAN */}
                  <div className="barcode-collab-header" style={{ justifyContent: 'center' }}>
                    <div className="barcode-collab-logo-box">
                      <span className="barcode-collab-fallback">{normalizeBarcodeBranding('NIKSAN', isNik)}</span>
                    </div>
                  </div>
                  {/* Area Tengah: Barcode dengan ruang yang cukup */}
                  <div
                    className="barcode-collab-body"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                  {/* Area Bawah: Footer Bar NIKSAN */}
                  <div className="barcode-label-footer">
                    <span>NIKSAN</span>
                  </div>
                </div>
              ) : (
                <div className="barcode-label-card">
                  {/* Kiri: Logo penuh setinggi card */}
                  <div className="barcode-label-logo-col">
                    <img
                      src={PTV_LOGO_PATH}
                      alt="Progresif TV"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).outerHTML = "<span style='font-size:11px;font-weight:900;color:#0f172a;'>PTV</span>";
                      }}
                    />
                  </div>
                  {/* Kanan: Atas barcode, bawah nama perusahaan */}
                  <div className="barcode-label-right">
                    {/* Kanan-atas: barcode */}
                    <div
                      className="barcode-label-barcode"
                      dangerouslySetInnerHTML={{ __html: svgMarkup }}
                    />
                    {/* Kanan-bawah: PROGRESIF TV */}
                    <div className="barcode-label-footer">
                      <span>PROGRESIF TV</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tombol aksi di bawah card */}
              <div className="barcode-label-actions">
                <button
                  type="button"
                  className="barcode-label-btn"
                  onClick={() => handlePrintSingle(unitCode, unitDisplayName, isNik)}
                  title={`Cetak Label ${unitCode}`}
                >
                  <i className="fa-solid fa-print" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  className="barcode-label-btn"
                  onClick={() => handleExportSingle(unitCode, isNik)}
                  title={`Ekspor Barcode PNG ${unitCode}`}
                >
                  <i className="fa-solid fa-download" />
                  <span>Ekspor PNG</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
