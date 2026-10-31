import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useKeuanganStore, fmtRupiah, fmtPeriodeBulan } from '../keuanganStore';
import { PeriodeKas } from '../types';

interface PengaturanIuranKasModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
}

export const PengaturanIuranKasModal: React.FC<PengaturanIuranKasModalProps> = ({
  isOpen,
  onClose,
  initialMonth,
}) => {
  const keuangan = useKeuanganStore();
  const formRef = useRef<HTMLDivElement>(null);

  // Form states
  const [formMonth, setFormMonth] = useState<string>('2026-10');
  const [formNominal, setFormNominal] = useState<string>('25000');
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Load all periods (including non-active ones)
  const allPeriods: PeriodeKas[] = useMemo(() => {
    return keuangan.getAllPeriodes();
  }, [keuangan]);

  // Handle modal open or initial month change
  useEffect(() => {
    if (isOpen) {
      setFeedbackMsg(null);
      if (initialMonth) {
        const found = allPeriods.find((p) => p.periode_bulan === initialMonth);
        if (found) {
          setFormMonth(found.periode_bulan);
          setFormNominal(String(found.nominal));
          setFormKeterangan(found.keterangan || '');
          return;
        }
      }

      // Default to next upcoming month or latest
      if (allPeriods.length > 0) {
        const latest = allPeriods[0].periode_bulan;
        const [y, m] = latest.split('-').map(Number);
        const nextY = m === 12 ? y + 1 : y;
        const nextM = m === 12 ? 1 : m + 1;
        const nextYm = `${nextY}-${String(nextM).padStart(2, '0')}`;
        setFormMonth(nextYm);
        setFormNominal('25000');
        setFormKeterangan(`Iuran Kas Bulan ${fmtPeriodeBulan(nextYm)}`);
      } else {
        setFormMonth('2026-10');
        setFormNominal('25000');
        setFormKeterangan('');
      }
    }
  }, [isOpen, initialMonth, allPeriods]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanYm = formMonth.trim();
    if (!cleanYm || !/^\d{4}-\d{2}$/.test(cleanYm)) {
      alert('Format bulan & tahun periode tidak valid (gunakan format YYYY-MM).');
      return;
    }

    const nominalNum = parseInt(formNominal.replace(/\D/g, ''), 10);
    if (isNaN(nominalNum) || nominalNum <= 0) {
      alert('Nominal iuran harus angka positif yang valid.');
      return;
    }

    const isExisting = allPeriods.some((p) => p.periode_bulan === cleanYm);

    keuangan.saveOrUpdatePeriode({
      periode_bulan: cleanYm,
      nominal: nominalNum,
      keterangan: formKeterangan.trim() || fmtPeriodeBulan(cleanYm),
      status: 'aktif',
    });

    setFeedbackMsg({
      text: isExisting
        ? `Konfigurasi periode ${fmtPeriodeBulan(cleanYm)} (${fmtRupiah(nominalNum)}) berhasil diperbarui!`
        : `Periode baru ${fmtPeriodeBulan(cleanYm)} (${fmtRupiah(nominalNum)}) berhasil disimpan dan ditagihkan!`,
      type: 'success',
    });

    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3000);
  };

  const handleEditClick = (p: PeriodeKas) => {
    setFormMonth(p.periode_bulan);
    setFormNominal(String(p.nominal));
    setFormKeterangan(p.keterangan || '');
    setFeedbackMsg({
      text: `Memuat periode ${fmtPeriodeBulan(p.periode_bulan)} ke form konfigurasi.`,
      type: 'success',
    });
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleHapusClick = (p: PeriodeKas) => {
    const stats = keuangan.getPeriodePaymentStats(p.periode_bulan);
    if (stats.paidCount > 0) {
      const confirmDeactivate = window.confirm(
        `Periode ${fmtPeriodeBulan(p.periode_bulan)} sudah memiliki ${stats.paidCount} pembayaran kas kru tercatat (${fmtRupiah(stats.totalPaid)}).\n\n` +
        `Untuk melindungi integritas pembukuan kas studio, periode ini akan dinonaktifkan (tidak lagi ditagihkan ke kru) alih-alih dihapus permanen.\n\n` +
        `Lanjutkan penonaktifan periode?`
      );
      if (confirmDeactivate) {
        const res = keuangan.hapusPeriode(p.periode_bulan);
        setFeedbackMsg({ text: res.message, type: 'warn' });
      }
    } else {
      const confirmDelete = window.confirm(
        `Hapus periode iuran ${fmtPeriodeBulan(p.periode_bulan)} (${p.periode_bulan})?`
      );
      if (confirmDelete) {
        const res = keuangan.hapusPeriode(p.periode_bulan);
        setFeedbackMsg({ text: res.message, type: 'success' });
      }
    }
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="fin-modal-card"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-l)',
          background: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header (Sticky) */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Pengaturan Tarif & Periode Iuran Kas
          </h2>
          <button
            type="button"
            className="fin-modal-close"
            onClick={onClose}
            aria-label="Tutup modal"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* 2. Modal Body (Scrollable) */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Notification feedback */}
          {feedbackMsg && (
            <div
              style={{
                background: feedbackMsg.type === 'warn' ? '#fffbeb' : '#dcfce7',
                border: feedbackMsg.type === 'warn' ? '1px solid #fde68a' : '1px solid #bbf7d0',
                color: feedbackMsg.type === 'warn' ? '#b45309' : '#15803d',
                padding: '10px 14px',
                borderRadius: 'var(--radius-s)',
                marginBottom: '16px',
                fontSize: '12.5px',
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className={`fa-solid ${feedbackMsg.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Info Card Banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-m)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ color: '#0e4f40', fontSize: '15px', marginTop: '1px', flexShrink: 0 }}>
              <i className="fa-solid fa-circle-info" />
            </div>
            <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.55 }}>
              Periode kas dimulai resmi dari <strong>Juli 2026 (2026-07)</strong>. Setiap periode dapat memiliki nominal berbeda. Perubahan tersimpan langsung dan otomatis memutakhirkan tagihan kru.
            </div>
          </div>

          {/* Form Card: Tambah / Konfigurasi Periode Baru */}
          <div
            ref={formRef}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-m)',
              padding: '18px 20px',
              background: '#ffffff',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                color: '#0f172a',
                fontSize: '14px',
                fontWeight: 750,
              }}
            >
              <i className="fa-solid fa-calendar-plus" style={{ color: '#0e4f40' }} />
              <span>Tambah / Konfigurasi Periode Baru</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Bulan & Tahun Periode *
                  </label>
                  <input
                    type="month"
                    value={formMonth}
                    onChange={(e) => setFormMonth(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-s)',
                      fontSize: '13px',
                      fontWeight: 650,
                      color: '#0f172a',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Nominal Iuran (Rp) *
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={formNominal}
                    onChange={(e) => setFormNominal(e.target.value)}
                    required
                    placeholder="25000"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-s)',
                      fontSize: '14px',
                      fontWeight: 750,
                      color: '#0f172a',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Contoh: Iuran Kas Bulan Oktober 2026..."
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-s)',
                    fontSize: '13px',
                    color: '#0f172a',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    background: '#0e4f40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-m)',
                    padding: '10px 22px',
                    fontSize: '13px',
                    fontWeight: 750,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(14, 79, 64, 0.2)',
                  }}
                >
                  <i className="fa-solid fa-floppy-disk" />
                  <span>Simpan Periode Iuran</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section: Daftar Periode Iuran */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 750, color: '#0f172a' }}>
                Daftar Periode Iuran ({allPeriods.length})
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Periode nonaktif tidak ditagihkan ke kru
              </span>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-m)',
                overflow: 'hidden',
                background: '#ffffff',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 750, color: '#1e293b' }}>
                        Periode
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 750, color: '#1e293b' }}>
                        Tarif
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 750, color: '#1e293b' }}>
                        Status Pembayaran
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 750, color: '#1e293b' }}>
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPeriods.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                          Belum ada periode kas terdaftar.
                        </td>
                      </tr>
                    ) : (
                      allPeriods.map((p) => {
                        const stats = keuangan.getPeriodePaymentStats(p.periode_bulan);
                        const isAktif = p.status !== 'nonaktif' && p.is_active !== false;

                        return (
                          <tr
                            key={p.periode_bulan}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: formMonth === p.periode_bulan ? 'rgba(14, 79, 64, 0.03)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 750, color: '#0f172a', fontSize: '13.5px' }}>
                                  {fmtPeriodeBulan(p.periode_bulan)}
                                </span>
                                {isAktif ? (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 750,
                                      color: '#15803d',
                                      background: '#dcfce7',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                    }}
                                  >
                                    Aktif
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 750,
                                      color: '#64748b',
                                      background: '#f1f5f9',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                    }}
                                  >
                                    Nonaktif
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Kode: {p.periode_bulan}
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>Rp</div>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0e4f40' }}>
                                {p.nominal.toLocaleString('id-ID')}
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '12.5px',
                                  fontWeight: 750,
                                  color: '#059669',
                                }}
                              >
                                <i className="fa-solid fa-receipt" style={{ fontSize: '13px' }} />
                                <span>
                                  {stats.paidCount} kru ({fmtRupiah(stats.totalPaid)})
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(p)}
                                  title={`Edit konfigurasi ${p.periode_bulan}`}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 'var(--radius-s)',
                                    padding: '5px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <i className="fa-solid fa-pen" style={{ fontSize: '10px' }} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHapusClick(p)}
                                  title={`Hapus periode ${p.periode_bulan}`}
                                  style={{
                                    background: '#fff5f5',
                                    border: '1px solid #fee2e2',
                                    borderRadius: 'var(--radius-s)',
                                    padding: '5px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#dc2626',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <i className="fa-solid fa-trash-can" style={{ fontSize: '10px' }} />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Modal Footer (Sticky) */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-m)',
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 750,
              color: '#1e293b',
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
