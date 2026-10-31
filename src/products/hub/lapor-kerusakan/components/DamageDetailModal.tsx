import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Wrench,
  Trash2,
  Lock,
  ShieldCheck,
  ZoomIn,
  Info,
  CheckCircle2,
} from "lucide-react";
import { DamageReportItem, DamageStatus } from "../types";
import { ImageLightboxModal } from "../../../../shared/components";

interface DamageDetailModalProps {
  item: DamageReportItem | null;
  onClose: () => void;
  onUpdateQC: (id: string, qcStatus: DamageStatus, qcNotes: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isExecutive?: boolean;
}

export const DamageDetailModal: React.FC<DamageDetailModalProps> = ({
  item,
  onClose,
  onUpdateQC,
  onDelete,
  isExecutive = true,
}) => {
  const [qcStatus, setQcStatus] = useState<DamageStatus>(item?.status || "Sedang Dicek");
  const [qcNotes, setQcNotes] = useState(item?.qcNotes || "");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQcStatus(item?.status && item.status !== 'Baru' ? item.status : 'Sedang Dicek');
    setQcNotes(item?.qcNotes || '');
    setSaveError('');
  }, [item?.id, item?.status, item?.qcNotes]);

  if (!item) return null;

  const isLocked = item.qcLocked || item.status === "Selesai";
  const canDelete = isExecutive || item.isCurrentUser;

  const handleSaveQC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || saving) return;
    setSaving(true);
    try {
      await onUpdateQC(item.id, qcStatus, qcNotes);
      onClose();
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Perubahan belum tersimpan.'); }
    finally { setSaving(false); }
  };

  const getStatusBadgeClass = (status: DamageStatus) => {
    switch (status) {
      case "Baru":
        return "damage-status-badge status-baru";
      case "Sedang Dicek":
        return "damage-status-badge status-sedang-dicek";
      case "Dalam Perbaikan":
        return "damage-status-badge status-dalam-perbaikan";
      case "Selesai":
        return "damage-status-badge status-selesai";
      case "Rusak Total":
        return "damage-status-badge status-rusak-total";
      default:
        return "damage-status-badge";
    }
  };

  const statusBadgeClass = getStatusBadgeClass(item.status);

  const content = (
    <>
      <div className="damage-modal-backdrop" onClick={onClose}>
        <div
          className="damage-modal-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="dmgDetailTitle"
          aria-modal="true"
        >
          {/* Header */}
          {saveError && <p role="alert" style={{ padding: 16 }}>{saveError}</p>}
          <div className="damage-modal-header">
            <div>
              <h3 id="dmgDetailTitle" className="damage-modal-header-title">
                Laporan Kerusakan &amp; Quality Check
              </h3>
            </div>
            <button
              type="button"
              className="damage-modal-close"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="damage-modal-body">
            {/* Header Ringkasan Alat & Status (Legacy Style) */}
            <div className="damage-asset-banner">
              <div className="damage-asset-banner-thumb">
                {item.photoUrl ? (
                  <img
                    src={item.photoUrl}
                    alt={item.assetName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Wrench size={22} style={{ color: "var(--b-600, #2563eb)" }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="damage-asset-banner-title">{item.assetName}</div>
                <div className="damage-asset-banner-sub">
                  Unit Fisik: <b>{item.unitCode}</b> (#{item.unitNumber}) &bull; Kategori: {item.assetCategory}
                </div>
              </div>
              <span className={statusBadgeClass}>
                {item.status}
              </span>
            </div>

            {/* Rincian Identitas Pelapor & Alat (Legacy KV Card) */}
            <div className="damage-detail-kv-card">
              <div className="damage-kv-row">
                <span className="damage-kv-label">Pelapor</span>
                <span className="damage-kv-val">{item.reporterName}</span>
              </div>
              <div className="damage-kv-row">
                <span className="damage-kv-label">Tanggal Laporan</span>
                <span className="damage-kv-val">{item.reportedAt.split("T")[0]}</span>
              </div>
              <div className="damage-kv-row">
                <span className="damage-kv-label">Alat Terkait</span>
                <span className="damage-kv-val">{item.assetName}</span>
              </div>
              <div className="damage-kv-row">
                <span className="damage-kv-label">Unit Fisik</span>
                <span className="damage-kv-val">
                  {item.unitCode} (Unit #{item.unitNumber})
                </span>
              </div>
              <div className="damage-kv-row">
                <span className="damage-kv-label">Kendala / Masalah</span>
                <span className="damage-kv-val" style={{ color: "#dc2626" }}>
                  {item.title}
                </span>
              </div>
              {item.description && (
                <div style={{ paddingTop: 6, marginTop: 4 }}>
                  <span className="damage-kv-label" style={{ display: "block", marginBottom: 3 }}>
                    Kronologi &amp; Detail Masalah:
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--ink, #334155)",
                      lineHeight: 1.45,
                      background: "var(--surface, #ffffff)",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--line-2, rgba(15, 23, 42, 0.06))",
                    }}
                  >
                    {item.description}
                  </p>
                </div>
              )}
            </div>

            {/* Foto Bukti Kerusakan Fisik */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--ink, #0f172a)" }}>
                  Foto Bukti Kerusakan Fisik
                </span>
                {item.photoUrl && (
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--b-600, #2563eb)",
                      background: "var(--b-050, #eff6ff)",
                      border: "1px solid var(--b-200, #bfdbfe)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontWeight: 650,
                    }}
                  >
                    Tersedia Bukti
                  </span>
                )}
              </div>

              {item.photoUrl ? (
                <div
                  style={{
                    position: "relative",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--line, rgba(15, 23, 42, 0.12))",
                    cursor: "pointer",
                    maxHeight: 180,
                  }}
                  onClick={() => setIsLightboxOpen(true)}
                  title="Klik untuk memperbesar foto bukti"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsLightboxOpen(true);
                    }
                  }}
                >
                  <img
                    src={item.photoUrl}
                    alt={`Bukti kerusakan ${item.title}`}
                    style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      background: "rgba(0, 0, 0, 0.75)",
                      color: "#ffffff",
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <ZoomIn size={12} /> Perbesar Foto
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    background: "var(--surface-2, #f8fafc)",
                    border: "1px dashed var(--line, rgba(15, 23, 42, 0.12))",
                    borderRadius: 8,
                    fontSize: 11.5,
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <Info size={14} style={{ color: "var(--muted, #94a3b8)", flexShrink: 0 }} />
                  <span>Pelapor tidak menyertakan foto bukti fisik pada laporan ini.</span>
                </div>
              )}
            </div>

            {/* Quality Check (QC) Peralatan Section */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 750, color: "var(--ink, #0f172a)", marginBottom: 8 }}>
                Quality Check (QC) Peralatan
              </div>

              {isLocked ? (
                <div className="damage-qc-box-locked">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span className="damage-qc-locked-badge">
                      <ShieldCheck size={13} /> Sudah Diperiksa (Terkunci)
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ok, #166534)", fontWeight: 600 }}>
                      {item.qcDate || item.reportedAt.split("T")[0]}
                    </span>
                  </div>

                  <div className="damage-kv-row">
                    <span className="damage-kv-label">
                      Pemeriksa (QC)
                    </span>
                    <b className="damage-kv-val">
                      {item.qcBy || "Eksekutif PTV"}
                    </b>
                  </div>

                  <div className="damage-kv-row">
                    <span className="damage-kv-label">
                      Status Hasil QC
                    </span>
                    <b className="damage-kv-val">
                      {item.status}
                    </b>
                  </div>

                  {item.qcNotes && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--line-2, #bbf7d0)" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--ok, #166534)",
                          display: "block",
                          marginBottom: 3,
                        }}
                      >
                        Catatan Tindakan &amp; Servis:
                      </span>
                      <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink, #14532d)", lineHeight: 1.4 }}>
                        {item.qcNotes}
                      </p>
                    </div>
                  )}

                  {/* Locked Explanation Card (from Legacy PHP) */}
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      background: "var(--surface, #ffffff)",
                      borderRadius: 8,
                      border: "1px solid var(--line-2, #bbf7d0)",
                      fontSize: 11,
                      color: "var(--ok, #15803d)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Lock size={13} style={{ flexShrink: 0 }} />
                    <span>
                      Formulir QC terkunci permanen demi menjaga keabsahan riwayat pemeriksaan.
                    </span>
                  </div>
                </div>
              ) : isExecutive ? (
                /* Form Input Quality Check (Eksekutif) */
                <form
                  onSubmit={handleSaveQC}
                  style={{
                    background: "var(--surface-2, #ffffff)",
                    border: "1px solid var(--line, rgba(15, 23, 42, 0.1))",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div className="damage-form-field">
                    <label className="damage-form-label">
                      Hasil Pemeriksaan / Status Teknis
                    </label>
                    <select
                      className="damage-form-select"
                      value={qcStatus}
                      onChange={(e) => setQcStatus(e.target.value as DamageStatus)}
                    >
                      <option value="Sedang Dicek">
                        Sedang Dicek (Investigasi Teknisi)
                      </option>
                      <option value="Dalam Perbaikan">
                        Dalam Perbaikan (Servis/Ganti Sparepart)
                      </option>
                      <option value="Selesai">
                        Selesai / Siap Pakai (Normal)
                      </option>
                      <option value="Rusak Total">
                        Rusak Total / Afkir
                      </option>
                    </select>
                  </div>

                  <div className="damage-form-field">
                    <label className="damage-form-label">
                      Catatan Teknis / Tindakan Servis
                    </label>
                    <textarea
                      rows={3}
                      className="damage-form-textarea"
                      placeholder="Jelaskan hasil pengecekan, perbaikan yang dilakukan, atau komponen yang diganti..."
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit" disabled={saving}
                    className="damage-btn-cta"
                    style={{
                      background: "var(--b-600, #2563eb)",
                      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                      width: "100%",
                      justifyContent: "center",
                      marginTop: 6,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Simpan Hasil Quality Check</span>
                  </button>
                </form>
              ) : (
                <div
                  style={{
                    background: "var(--surface-2, #f8fafc)",
                    border: "1px dashed var(--line, #cbd5e1)",
                    borderRadius: 10,
                    padding: 12,
                    textAlign: "center",
                    fontSize: 11.5,
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <Lock size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Formulir Quality Check hanya dapat diakses dan diisi oleh pimpinan <b>Eksekutif</b>.
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="damage-modal-footer">
            {canDelete && (
              <button
                type="button"
                className="damage-btn-cta"
                style={{
                  background: "var(--dang-bg, #fee2e2)",
                  color: "var(--dang, #dc2626)",
                  boxShadow: "none",
                  border: "1px solid var(--dang-border, #fecaca)",
                  marginRight: "auto",
                }}
                onClick={async () => {
                  if (
                    window.confirm(
                      "Hapus laporan kerusakan ini? Tindakan ini tidak dapat dibatalkan."
                    )
                  ) {
                    try {
                      await onDelete(item.id);
                      onClose();
                    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Penghapusan belum tersimpan.'); }
                  }
                }}
              >
                <Trash2 size={13} />
                <span>Hapus Laporan</span>
              </button>
            )}
            <button
              type="button"
              className="damage-fchip"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {item.photoUrl && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          imageUrl={item.photoUrl}
          altText={`Foto Bukti Kerusakan: ${item.title}`}
          title={`Foto Bukti Kerusakan — ${item.unitCode}`}
          caption={`${item.assetName} • Dilaporkan oleh ${item.reporterName} (${item.reportedAt.split("T")[0]})`}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
};

