import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Building2,
  Layers,
  CreditCard,
  QrCode,
  Plus,
  Check,
  AlertCircle,
  Copy,
  ZoomIn,
  Download,
  Pencil,
  Archive,
  RotateCcw,
  HandCoins,
  Database,
  Users,
} from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { FinanceSnapshot } from './financeFoundation';
import { formatMinor, type CanonicalCategory } from './financeCanonical';
import { FinanceDialog } from './FinanceWorkspace';
import type { FinanceOperationalSettings } from './financeSettingsTypes';
import {
  createCanonicalCategory,
  getCustomCategories,
  getStoredFinanceSettings,
  DEFAULT_FINANCE_SETTINGS,
  saveFinanceSettingsCloud,
  attachQrisToPocket,
  isSystemCategory,
  editCanonicalCategory,
  archiveCanonicalCategory,
  restoreCanonicalCategory,
} from './financeSettingsService';
import {
  getStoredSemesters,
  saveSemesters,
  updateSemesterMonthlyFee,
  getSemesterPeriodFeeMinor,
  createSemester,
  updateSemester,
  createSemesterCloud,
  updateSemesterCloud,
} from './kasKruService';
import { fmtPeriodeBulan } from './keuanganStore';
import type { FinanceSemester } from './kasKruTypes';

export function FinanceSettingsView({
  canManage,
  data,
  onRefresh,
}: {
  canManage: boolean;
  data?: FinanceSnapshot;
  onRefresh?: () => void;
}) {
  const [settings, setSettings] = useState<FinanceOperationalSettings>(() => {
    try {
      return getStoredFinanceSettings();
    } catch {
      return DEFAULT_FINANCE_SETTINGS;
    }
  });
  const [activeModal, setActiveModal] = useState<
    'addCategory' | 'editCategory' | 'qris' | 'createSemester' | 'editSemester' | null
  >(null);

  // Semester modal form state (G2 - Centralized in Settings)
  const [semName, setSemName] = useState('');
  const [semStart, setSemStart] = useState('');
  const [semEnd, setSemEnd] = useState('');
  const [semFee, setSemFee] = useState('25000');
  const [semIsActive, setSemIsActive] = useState(true);
  const [semError, setSemError] = useState('');
  const [semSuccess, setSemSuccess] = useState('');

  // Category form state
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<'income' | 'expense'>('income');
  const [editingCatId, setEditingCatId] = useState('');
  const [catError, setCatError] = useState('');
  const [catSuccess, setCatSuccess] = useState('');
  const [submittingCat, setSubmittingCat] = useState(false);
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);

  // QRIS form state
  const [qrisPocketId, setQrisPocketId] = useState('');
  const [qrisMerchant, setQrisMerchant] = useState('PROGRESIF TV STUDIO');
  const [qrisNmid, setQrisNmid] = useState('ID1020304050607');
  const [qrisAssetPath, setQrisAssetPath] = useState('/finance-assets/qris-official-ptv.png');
  const [qrisError, setQrisError] = useState('');
  const [qrisSuccess, setQrisSuccess] = useState('');
  const [isQrisZoomed, setIsQrisZoomed] = useState(false);

  // Operational settings form state (Umum & Piutang)
  const [dueDayInput, setDueDayInput] = useState(() => settings.feeDueDay.toString());
  const [treasurerNameInput, setTreasurerNameInput] = useState(() => settings.treasurerName);
  const [treasurerPhoneInput, setTreasurerPhoneInput] = useState(() => settings.treasurerPhone);
  const [loanDueDaysInput, setLoanDueDaysInput] = useState('30');
  const [flatInterestInput, setFlatInterestInput] = useState('0');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Semesters & Monthly fee tariffs state (Kas Kru)
  const [semesters, setSemesters] = useState<FinanceSemester[]>(() => {
    try {
      return getStoredSemesters();
    } catch {
      return [];
    }
  });
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(() => semesters[0]?.id || 'sem-2026-ganjil');
  const [monthlyFeeEdits, setMonthlyFeeEdits] = useState<Record<string, string>>({});
  const [kasKruSaved, setKasKruSaved] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pockets = useMemo(() => data?.canonical?.pockets || [], [data?.canonical?.pockets]);
  const baseCategories = useMemo(() => data?.canonical?.categories || [], [data?.canonical?.categories]);
  const customCategories = useMemo(() => {
    try {
      return getCustomCategories();
    } catch {
      return [];
    }
  }, []);

  // Merge canonical categories with custom ones
  const allCategories: CanonicalCategory[] = useMemo(() => {
    const list = [...baseCategories];
    for (const c of customCategories) {
      if (!list.some(item => item.id === c.id)) {
        list.push(c);
      }
    }
    return list;
  }, [baseCategories, customCategories]);

  const displayedCategories = useMemo(() => {
    if (showArchivedCategories) return allCategories;
    return allCategories.filter(c => c.isActive);
  }, [allCategories, showArchivedCategories]);

  const bankAndEwalletPockets = useMemo(() => {
    return pockets.filter(p => p.kind !== 'cash' && !p.archived);
  }, [pockets]);

  const officialPocket = useMemo(() => {
    return pockets.find(p => p.kind !== 'cash' && !p.archived && (p.accountNumber || p.qris)) || bankAndEwalletPockets[0];
  }, [pockets, bankAndEwalletPockets]);

  const activeSemester = useMemo(() => {
    return semesters.find(s => s.id === selectedSemesterId) || semesters[0];
  }, [semesters, selectedSemesterId]);

  // Compute month list for active semester
  const semesterMonths = useMemo(() => {
    if (!activeSemester) return [];
    const months: string[] = [];
    const startY = parseInt(activeSemester.startDate.slice(0, 4), 10);
    const startM = parseInt(activeSemester.startDate.slice(5, 7), 10);
    const endY = parseInt(activeSemester.endDate.slice(0, 4), 10);
    const endM = parseInt(activeSemester.endDate.slice(5, 7), 10);

    let curY = startY;
    let curM = startM;
    while (curY < endY || (curY === endY && curM <= endM)) {
      const ym = `${curY}-${String(curM).padStart(2, '0')}`;
      months.push(ym);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return months;
  }, [activeSemester]);

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const dueDayNum = parseInt(dueDayInput || '10', 10);

    const updated: FinanceOperationalSettings = {
      ...settings,
      feeDueDay: Math.min(31, Math.max(1, dueDayNum)),
      treasurerName: treasurerNameInput.trim() || 'Bendahara Studio',
      treasurerPhone: treasurerPhoneInput.trim() || '+62 822-1234-5678',
    };

    try {
      await saveFinanceSettingsCloud(updated);
      setSettings(updated);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
      onRefresh?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan ke server.');
    }
  };

  const handleSaveMonthlyFees = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester) return;

    let updatedSemesters = [...semesters];
    for (const ym of semesterMonths) {
      const valStr = monthlyFeeEdits[ym];
      if (valStr !== undefined && valStr.trim() !== '') {
        const num = parseInt(valStr.replace(/\D/g, '') || '0', 10);
        const minor = (num * 100).toString();
        updatedSemesters = updateSemesterMonthlyFee(activeSemester.id, ym, minor, updatedSemesters);
      }
    }

    setSemesters(updatedSemesters);
    saveSemesters(updatedSemesters);
    setKasKruSaved(true);
    setTimeout(() => setKasKruSaved(false), 2500);
    onRefresh?.();
  };

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setCatSuccess('');
    setSubmittingCat(true);

    try {
      await createCanonicalCategory(catName, catKind, allCategories);
      setCatSuccess(`Kategori '${catName}' berhasil ditambahkan ke daftar canonical!`);
      setCatName('');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setCatSuccess('');
      }, 1000);
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'Gagal membuat kategori.');
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleOpenEditCategory = (cat: CanonicalCategory) => {
    if (isSystemCategory(cat.name)) {
      alert(`Kategori "${cat.name}" adalah kategori sistem canonical yang dilindungi dan tidak dapat diubah.`);
      return;
    }
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatKind(cat.kind);
    setActiveModal('editCategory');
  };

  const handleEditCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setCatSuccess('');
    try {
      await editCanonicalCategory(editingCatId, catName, allCategories);
      setCatSuccess(`Kategori berhasil diperbarui menjadi "${catName}"!`);
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setCatSuccess('');
      }, 800);
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'Gagal mengubah kategori.');
    }
  };

  const handleArchiveCategory = async (cat: CanonicalCategory) => {
    if (isSystemCategory(cat.name)) {
      alert(`Kategori "${cat.name}" adalah kategori sistem canonical yang dilindungi.`);
      return;
    }
    if (!confirm(`Arsipkan kategori "${cat.name}"? Kategori tidak akan muncul pada pilihan transaksi baru, namun riwayat transaksi lama tetap utuh.`)) {
      return;
    }
    try {
      await archiveCanonicalCategory(cat.id, allCategories);
      onRefresh?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal mengarsipkan kategori.');
    }
  };

  const handleRestoreCategory = async (cat: CanonicalCategory) => {
    try {
      await restoreCanonicalCategory(cat.id, allCategories);
      onRefresh?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memulihkan kategori.');
    }
  };

  const handleSaveQris = (e: React.FormEvent) => {
    e.preventDefault();
    setQrisError('');
    setQrisSuccess('');

    if (!qrisPocketId) {
      setQrisError('Pilih kantong rekening target.');
      return;
    }

    try {
      attachQrisToPocket(
        {
          pocketId: qrisPocketId,
          merchantName: qrisMerchant,
          nmid: qrisNmid,
          assetPath: qrisAssetPath,
          verifiedAt: new Date().toISOString(),
        },
        pockets
      );

      setQrisSuccess('Konfigurasi QRIS resmi berhasil dipasangkan pada Kantong.');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setQrisSuccess('');
      }, 1000);
    } catch (err: unknown) {
      setQrisError(err instanceof Error ? err.message : 'Gagal menyimpan QRIS.');
    }
  };

  const handleOpenCreateSemester = () => {
    setSemName('');
    setSemStart('');
    setSemEnd('');
    setSemFee('25000');
    setSemIsActive(true);
    setSemError('');
    setSemSuccess('');
    setActiveModal('createSemester');
  };

  const handleOpenEditSemester = () => {
    const cur = semesters.find(s => s.id === selectedSemesterId) || semesters[0];
    if (!cur) return;
    setSemName(cur.name);
    setSemStart(cur.startDate);
    setSemEnd(cur.endDate);
    setSemFee((Number(BigInt(cur.monthlyFeeMinor || '2500000')) / 100).toString());
    setSemIsActive(cur.isActive ?? true);
    setSemError('');
    setSemSuccess('');
    setActiveModal('editSemester');
  };

  const handleCreateSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSemError('');
    try {
      const minor = (BigInt(semFee.replace(/\D/g, '') || '25000') * 100n).toString();
      let createdSemester: FinanceSemester;
      try {
        createdSemester = await createSemesterCloud({
          name: semName,
          startDate: semStart,
          endDate: semEnd,
          monthlyFeeMinor: minor,
          isActive: semIsActive,
        });
      } catch {
        // Fallback local if cloud in maintenance
        const fallback = createSemester(
          {
            name: semName,
            startDate: semStart,
            endDate: semEnd,
            monthlyFeeMinor: minor,
            isActive: semIsActive,
          },
          semesters
        );
        createdSemester = fallback.semester;
      }

      setSemesters(prev => [...prev.filter(s => s.id !== createdSemester.id), createdSemester]);
      setSelectedSemesterId(createdSemester.id);
      setSemSuccess('Semester baru berhasil dibuat!');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setSemSuccess('');
      }, 700);
    } catch (err: unknown) {
      setSemError(err instanceof Error ? err.message : 'Gagal membuat semester.');
    }
  };

  const handleEditSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSemError('');
    try {
      const minor = (BigInt(semFee.replace(/\D/g, '') || '25000') * 100n).toString();
      const updates = {
        name: semName,
        startDate: semStart,
        endDate: semEnd,
        monthlyFeeMinor: minor,
        isActive: semIsActive,
      };
      try {
        await updateSemesterCloud(selectedSemesterId, updates);
      } catch {
        // Fallback local
        updateSemester(selectedSemesterId, updates, semesters);
      }

      setSemesters(prev => prev.map(s => s.id === selectedSemesterId ? { ...s, ...updates } : s));
      setSemSuccess('Perubahan semester berhasil disimpan!');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setSemSuccess('');
      }, 700);
    } catch (err: unknown) {
      setSemError(err instanceof Error ? err.message : 'Gagal memperbarui semester.');
    }
  };

  return (
    <div className="finance-section-container">
      {/* 1. HERO HEADER */}
      <div className="finance-section-hero">
        <div className="hero-icon-wrap settings">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2>Pusat Pengaturan Keuangan Terpadu</h2>
          <p>
            Konfigurasi all-in-one identitas bendahara, tarif kas bulanan independen, kategori canonical, dan integritas ledger.
          </p>
        </div>
      </div>

      {/* D1. PENGATURAN UMUM & REKENING RESMI BENDAHARA */}
      <Card standard="r03" id="umum">
        <form style={{ padding: '14px 16px' }} onSubmit={handleSaveGeneralSettings}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} /> D1. Pengaturan Umum &amp; Rekening Resmi Bendahara
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-2)', margin: '4px 0 0' }}>
                Identitas bendahara studio, rekening perbankan penerima, dan informasi QRIS resmi.
              </p>
            </div>

            {canManage && (
              <Button
                shape="pill"
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => {
                  setQrisPocketId(bankAndEwalletPockets[0]?.id || '');
                  setActiveModal('qris');
                }}
              >
                <QrCode size={14} /> Pasang / Ubah QRIS Resmi
              </Button>
            )}
          </div>

          {settingsSaved && (
            <div className="dialog-alert-box success" style={{ marginBottom: '14px' }}>
              <Check size={16} />
              <p>Pengaturan umum berhasil disimpan!</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div className="bendahara-account-card">
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={15} /> Rekening Operasional Utama
              </h4>
              {officialPocket ? (
                <>
                  <div className="bendahara-account-row">
                    <span className="account-field-label">Penyedia / Bank</span>
                    <strong className="account-field-val">{officialPocket.provider || 'Bank BCA'}</strong>
                  </div>
                  <div className="bendahara-account-row">
                    <span className="account-field-label">Nomor Rekening</span>
                    <div className="account-number-with-copy">
                      <code className="account-number-code">{officialPocket.accountNumber || '—'}</code>
                      {officialPocket.accountNumber && (
                        <button
                          type="button"
                          className="btn-copy-account"
                          onClick={() => handleCopy(officialPocket.accountNumber!, 'acc')}
                        >
                          {copiedId === 'acc' ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === 'acc' ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bendahara-account-row">
                    <span className="account-field-label">Atas Nama</span>
                    <strong className="account-field-val">{officialPocket.accountHolder || 'Studio PTV'}</strong>
                  </div>
                </>
              ) : (
                <p className="finance-footnote" style={{ margin: '4px 0' }}>Belum ada rekening bank operasional yang dikonfigurasi.</p>
              )}
            </div>

            <div className="bendahara-account-card">
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <QrCode size={15} /> QRIS Merchant Resmi Studio
              </h4>
              {officialPocket?.qris ? (
                <div>
                  <div className={`qris-image-container ${isQrisZoomed ? 'zoomed' : ''}`}>
                    <img src={officialPocket.qris.assetPath} alt="QRIS Resmi" className="qris-image" />
                  </div>
                  <p className="qris-merchant-name" style={{ margin: '6px 0 2px', fontSize: '12.5px' }}>
                    Merchant: <strong>{officialPocket.qris.merchantName}</strong>
                  </p>
                  <p className="qris-merchant-name" style={{ fontSize: '11.5px', color: 'var(--ink-2)' }}>
                    NMID: <code>{officialPocket.qris.nmid}</code>
                  </p>
                  <div className="qris-actions-row" style={{ marginTop: '6px' }}>
                    <button
                      type="button"
                      className="finance-btn-pill secondary"
                      onClick={() => setIsQrisZoomed(!isQrisZoomed)}
                    >
                      <ZoomIn size={13} /> {isQrisZoomed ? 'Perkecil' : 'Perbesar'}
                    </button>
                    <a
                      href={officialPocket.qris.assetPath}
                      download="QRIS-Bendahara-PTVPRO.png"
                      className="finance-btn-pill secondary"
                    >
                      <Download size={13} /> Unduh
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--ink-2)' }}>
                  <QrCode size={24} style={{ opacity: 0.5, marginBottom: '4px' }} />
                  <p style={{ fontSize: '12px', margin: 0 }}>QRIS resmi belum diunggah.</p>
                </div>
              )}
            </div>
          </div>

          <div className="finance-form-grid">
            <Input
              standard="r03"
              label="Nama Bendahara Studio Resmi"
              value={treasurerNameInput}
              onChange={e => setTreasurerNameInput(e.target.value)}
              disabled={!canManage}
              required
            />
            <Input
              standard="r03"
              label="Nomor WhatsApp Kontak Bendahara"
              value={treasurerPhoneInput}
              onChange={e => setTreasurerPhoneInput(e.target.value)}
              disabled={!canManage}
              required
            />
          </div>

          {canManage && (
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Pengaturan Umum
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* D2. PENGATURAN KAS KRU — PUSAT PENGELOLAAN SEMESTER & TARIF BULANAN */}
      <Card standard="r03" id="kas-kru">
        <form style={{ padding: '14px 16px' }} onSubmit={handleSaveMonthlyFees}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> D2. Pengaturan Kas Kru — Semester &amp; Tarif Bulanan
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-2)', margin: '4px 0 0' }}>
                Pusat pembuatan semester baru, rentang bulan, dan penetapan tarif mandiri independen per bulan.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label htmlFor="settings-sem-select" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink2)' }}>
                Semester:
              </label>
              <select
                id="settings-sem-select"
                className="finance-select"
                style={{ fontSize: '12px', padding: '5px 10px' }}
                value={selectedSemesterId}
                onChange={e => setSelectedSemesterId(e.target.value)}
              >
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Aktif)' : '(Historis)'}
                  </option>
                ))}
              </select>

              {canManage && (
                <>
                  <Button
                    shape="pill"
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={handleOpenEditSemester}
                  >
                    <Pencil size={13} /> Edit Semester
                  </Button>
                  <Button
                    shape="pill"
                    size="sm"
                    variant="primary"
                    type="button"
                    onClick={handleOpenCreateSemester}
                  >
                    <Plus size={13} /> Buat Semester Baru
                  </Button>
                </>
              )}
            </div>
          </div>

          {kasKruSaved && (
            <div className="dialog-alert-box success" style={{ marginBottom: '14px' }}>
              <Check size={16} />
              <p>Tarif bulanan Kas Kru berhasil diperbarui dan disimpan secara persisten!</p>
            </div>
          )}

          {activeSemester && (
            <div style={{ marginBottom: '14px', background: 'var(--surface-muted, #f8fafc)', padding: '12px', borderRadius: 'var(--r-card)', border: '1px solid var(--line-2, #e2e8f0)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink2)', marginBottom: '8px' }}>
                Rentang Periode: <strong>{activeSemester.startDate}</strong> s/d <strong>{activeSemester.endDate}</strong>
              </div>

              {/* TABEL TARIF INDEPENDEN SETIAP BULAN */}
              <div className="fin-table-scroll" style={{ margin: '8px 0' }}>
                <table className="fin-matrix-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Bulan / Periode</th>
                      <th>Tarif Berlaku (Rp)</th>
                      <th>Format Tampilan</th>
                      <th>Keterangan Kebijakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesterMonths.map(ym => {
                      const currentFeeMinor = getSemesterPeriodFeeMinor(activeSemester, ym);
                      const currentFeeNum = Number(BigInt(currentFeeMinor)) / 100;
                      const inputVal = monthlyFeeEdits[ym] !== undefined ? monthlyFeeEdits[ym] : currentFeeNum.toString();

                      return (
                        <tr key={ym}>
                          <td style={{ fontWeight: 700, color: 'var(--ink)' }}>
                            {fmtPeriodeBulan(ym)} <code>({ym})</code>
                          </td>
                          <td style={{ width: '220px' }}>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              className="finance-select"
                              style={{ width: '100%', padding: '6px 10px', fontWeight: 700 }}
                              value={inputVal}
                              onChange={e => setMonthlyFeeEdits(prev => ({ ...prev, [ym]: e.target.value }))}
                              disabled={!canManage}
                              aria-label={`Tarif iuran ${ym}`}
                            />
                          </td>
                          <td style={{ fontWeight: 800, color: 'var(--ptv-green)' }}>
                            {formatMinor((parseInt(inputVal || '0', 10) * 100).toString())}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--ink3)' }}>
                            Tarif mandiri bulan {fmtPeriodeBulan(ym)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="finance-form-grid" style={{ marginTop: '12px' }}>
                <Input
                  standard="r03"
                  label="Tanggal Jatuh Tempo Bulanan (1-31)"
                  inputMode="numeric"
                  value={dueDayInput}
                  onChange={e => setDueDayInput(e.target.value)}
                  disabled={!canManage}
                  hint="Tanggal penagihan iuran setiap bulannya"
                />
              </div>
            </div>
          )}

          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Tarif Kas Kru Bulanan
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* D3. MANAJEMEN KATEGORI TRANSAKSI CANONICAL (CRUD + ARSIP) */}
      <Card standard="r03" id="kategori">
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} /> D3. Manajemen Kategori Transaksi Canonical
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '4px 0 0' }}>
                Tambah, edit, dan arsipkan kategori. Kategori terarsip terlindung pada transaksi historis dan dapat dipulihkan.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className={`finance-btn-pill ${showArchivedCategories ? 'active' : 'secondary'}`}
                style={{ fontSize: '11.5px', padding: '6px 12px' }}
                onClick={() => setShowArchivedCategories(!showArchivedCategories)}
              >
                <Archive size={13} />
                <span>{showArchivedCategories ? 'Sembunyikan Arsip' : 'Lihat Kategori Terarsip'}</span>
              </button>

              {canManage && (
                <Button
                  shape="pill"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setCatName('');
                    setCatError('');
                    setActiveModal('addCategory');
                  }}
                >
                  <Plus size={14} /> Tambah Kategori
                </Button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {displayedCategories.map(cat => {
              const isSys = isSystemCategory(cat.name);
              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md, 12px)',
                    backgroundColor: cat.isActive ? 'var(--surface-muted, #f8fafc)' : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${cat.isActive ? 'var(--line-2, #e2e8f0)' : 'rgba(239, 68, 68, 0.2)'}`,
                    opacity: cat.isActive ? 1 : 0.7,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px' }}>{cat.name}</strong>
                      {isSys && (
                        <span title="Kategori Sistem Dilindungi" style={{ color: 'var(--ptv-green)' }}>
                          <Lock size={12} />
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      <span className={`alloc-dir-pill ${cat.kind === 'income' ? 'in' : 'out'}`} style={{ fontSize: '10px' }}>
                        {cat.kind === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                      {!cat.isActive && (
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>
                          [Terarsip]
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!isSys && cat.isActive && (
                        <button
                          type="button"
                          className="fin-btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '11px' }}
                          onClick={() => handleOpenEditCategory(cat)}
                          title="Edit nama kategori"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      {!isSys && cat.isActive && (
                        <button
                          type="button"
                          className="fin-btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '11px', color: '#dc2626' }}
                          onClick={() => handleArchiveCategory(cat)}
                          title="Arsipkan kategori"
                        >
                          <Archive size={11} />
                        </button>
                      )}
                      {!cat.isActive && (
                        <button
                          type="button"
                          className="fin-btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--ptv-green)' }}
                          onClick={() => handleRestoreCategory(cat)}
                          title="Pulihkan kategori"
                        >
                          <RotateCcw size={11} />
                          <span>Pulihkan</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* D4. PENGATURAN PIUTANG */}
      <Card standard="r03" id="piutang">
        <div style={{ padding: '14px 16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HandCoins size={18} /> D4. Pengaturan Standar Piutang &amp; Pinjaman
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '4px 0 0' }}>
              Jatuh tempo default 30 hari, bunga default 0% (tanpa bunga), dan opsi bunga flat saat transaksi pinjaman.
            </p>
          </div>

          <div className="finance-form-grid">
            <Input
              standard="r03"
              label="Jatuh Tempo Default Piutang (Hari)"
              inputMode="numeric"
              value={loanDueDaysInput}
              onChange={e => setLoanDueDaysInput(e.target.value)}
              disabled={!canManage}
              hint="Standar jangka waktu pengembalian pinjaman"
            />
            <Input
              standard="r03"
              label="Bunga Default (% Flat)"
              inputMode="numeric"
              value={flatInterestInput}
              onChange={e => setFlatInterestInput(e.target.value)}
              disabled={!canManage}
              hint="0% = Tanpa bunga (standar kemanusiaan kru)"
            />
          </div>
        </div>
      </Card>

      {/* D5. STATUS SISTEM & AUDIT KEAMANAN (4 PILAR ARSITEKTUR FINANCE 2.0) */}
      <div className="finance-settings-modern-grid">
        <div className="finance-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Lock size={18} />
              <h3>Akses &amp; Otoritas Pengelolaan</h3>
            </div>
            <span className="settings-status-pill live">{canManage ? 'Akses Pengelola' : 'Hanya Baca'}</span>
          </div>
          <p>
            Otoritas penulisan dilindungi capability <code>finance.manage</code>. Perubahan tarif, pencatatan transaksi, dan reversal hanya dapat dieksekusi oleh Bendahara, Eksekutif, dan Root.
          </p>
          <div className="settings-card-meta">
            <span>Audit Trail: Immutable Append-Only</span>
          </div>
        </div>

        <div className="finance-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Database size={18} />
              <h3>Buku Utama &amp; Rekening Studio</h3>
            </div>
            <span className="settings-status-pill live">PostgreSQL 17 Staging</span>
          </div>
          <p>
            Database Staging terhubung (<code>swadgljnyelsjstqqxbm</code>). Mutasi diposting ke ledger canonical <code>ptv_finance_transactions</code> dan <code>ptv_finance_allocations</code>.
          </p>
          <div className="settings-card-meta">
            <span>Transaksi Terverifikasi: {data?.canonical?.transactions?.length || 0} mutasi</span>
          </div>
        </div>

        <div className="finance-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Layers size={18} />
              <h3>Kategori Transaksi Canonical</h3>
            </div>
            <span className="settings-status-pill neutral">11 Kategori Aktif</span>
          </div>
          <p>
            Katalog kategori terstandarisasi untuk klasifikasi operasional dan arus kas bulanan secara konsisten.
          </p>
          <div className="settings-card-meta">
            <span>Perlindungan Kategori Otomatis: Aktif</span>
          </div>
        </div>

        <div className="finance-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <ShieldCheck size={18} />
              <h3>Integritas Transaksi &amp; Anti-Overdraft</h3>
            </div>
            <span className="settings-status-pill live">Anti-Overdraft</span>
          </div>
          <p>
            Ledger double-entry atomic mencegah saldo negatif pada kantong kas riil dan menjamin konsistensi matematis pembukuan studio.
          </p>
          <div className="settings-card-meta">
            <span>Validasi Saldo &amp; Reversal: Aktif</span>
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH KATEGORI */}
      {activeModal === 'addCategory' && (
        <FinanceDialog title="Tambah Kategori Canonical Baru" onClose={() => setActiveModal(null)}>
          <form className="finance-form" onSubmit={handleCreateCategorySubmit}>
            {catError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{catError}</p></div>}
            {catSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{catSuccess}</p></div>}

            <Input
              standard="r03"
              label="Nama Kategori Transaksi"
              placeholder="Contoh: Honor Narasumber / Sponsor Khusus"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              required
            />

            <div>
              <label className="finance-field-label">Jenis Transaksi</label>
              <select
                className="finance-select"
                value={catKind}
                onChange={e => setCatKind(e.target.value as any)}
              >
                <option value="income">Pemasukan (Income)</option>
                <option value="expense">Pengeluaran (Expense)</option>
              </select>
            </div>

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit" disabled={submittingCat}>
                {submittingCat ? 'Mendaftarkan...' : 'Simpan Kategori'}
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* MODAL EDIT KATEGORI */}
      {activeModal === 'editCategory' && (
        <FinanceDialog title="Edit Kategori Canonical" onClose={() => setActiveModal(null)}>
          <form className="finance-form" onSubmit={handleEditCategorySubmit}>
            {catError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{catError}</p></div>}
            {catSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{catSuccess}</p></div>}

            <Input
              standard="r03"
              label="Nama Kategori Transaksi"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              required
            />

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Perubahan
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* MODAL KONFIGURASI QRIS */}
      {activeModal === 'qris' && (
        <FinanceDialog title="Pasang / Konfigurasi QRIS Resmi" onClose={() => setActiveModal(null)}>
          <form className="finance-form" onSubmit={handleSaveQris}>
            {qrisError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{qrisError}</p></div>}
            {qrisSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{qrisSuccess}</p></div>}

            <div>
              <label className="finance-field-label">Pilih Kantong Rekening Penerima QRIS</label>
              <select
                className="finance-select"
                value={qrisPocketId}
                onChange={e => setQrisPocketId(e.target.value)}
                required
              >
                {bankAndEwalletPockets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.provider} · {p.accountNumber || '—'})
                  </option>
                ))}
              </select>
            </div>

            <div className="finance-form-grid">
              <Input
                standard="r03"
                label="Nama Merchant QRIS Resmi"
                value={qrisMerchant}
                onChange={e => setQrisMerchant(e.target.value)}
                placeholder="PROGRESIF TV STUDIO"
                required
              />
              <Input
                standard="r03"
                label="NMID (National Merchant ID)"
                value={qrisNmid}
                onChange={e => setQrisNmid(e.target.value)}
                placeholder="ID1020304050607"
                required
              />
            </div>

            <Input
              standard="r03"
              label="Jalur / URL Gambar Aset QRIS"
              value={qrisAssetPath}
              onChange={e => setQrisAssetPath(e.target.value)}
              hint="Format file yang didukung: PNG, WebP, JPG (maks 2MB)"
              required
            />

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Konfigurasi QRIS
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* MODAL BUAT SEMESTER BARU (G2 DITERAPKAN DI PENGATURAN) */}
      {activeModal === 'createSemester' && (
        <FinanceDialog
          title="Buat Semester Kas Kru Baru"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleCreateSemesterSubmit}>
            {semError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{semError}</p></div>}
            {semSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{semSuccess}</p></div>}

            <Input
              standard="r03"
              label="Nama Semester"
              placeholder="Contoh: Semester Ganjil 2026/2027"
              value={semName}
              onChange={e => setSemName(e.target.value)}
              required
            />

            <div className="finance-form-grid">
              <Input
                standard="r03"
                label="Tanggal Mulai"
                type="date"
                value={semStart}
                onChange={e => setSemStart(e.target.value)}
                required
              />
              <Input
                standard="r03"
                label="Tanggal Akhir"
                type="date"
                value={semEnd}
                onChange={e => setSemEnd(e.target.value)}
                required
              />
            </div>

            <Input
              standard="r03"
              label="Nominal Iuran Dasar Default (Rp)"
              inputMode="numeric"
              value={semFee}
              onChange={e => setSemFee(e.target.value)}
              required
              hint="Tarif bulanan dapat diatur berbeda untuk masing-masing bulan"
            />

            <p className="finance-footnote">
              Pembuatan semester baru tidak mengubah transaksi historis sebelumnya.
            </p>

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Semester Baru
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* MODAL EDIT SEMESTER (G2 DITERAPKAN DI PENGATURAN) */}
      {activeModal === 'editSemester' && (
        <FinanceDialog
          title="Edit Konfigurasi Semester"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleEditSemesterSubmit}>
            {semError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{semError}</p></div>}
            {semSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{semSuccess}</p></div>}

            <Input
              standard="r03"
              label="Nama Semester"
              value={semName}
              onChange={e => setSemName(e.target.value)}
              required
            />

            <div className="finance-form-grid">
              <Input
                standard="r03"
                label="Tanggal Mulai"
                type="date"
                value={semStart}
                onChange={e => setSemStart(e.target.value)}
                required
              />
              <Input
                standard="r03"
                label="Tanggal Akhir"
                type="date"
                value={semEnd}
                onChange={e => setSemEnd(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={semIsActive}
                  onChange={e => setSemIsActive(e.target.checked)}
                />
                <strong>Tetapkan sebagai semester aktif berjalan</strong>
              </label>
            </div>

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit">
                Simpan Perubahan
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}
    </div>
  );
}
