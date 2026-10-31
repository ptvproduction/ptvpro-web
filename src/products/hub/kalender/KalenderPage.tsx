import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '@/styles/kalender.css';
import { useModalScrollLock } from '@/shared/hooks/useModalScrollLock';
import { AcaraKalenderHeader } from '@/shared/components/AcaraKalenderHeader';
import { SkeletonBase } from '@/shared/components';
import {
  CalendarLayer,
  CalendarEvent,
  ContentPlannerItem,
  CreatePlannerDTO
} from './types';
import {
  MONTHS,
  DOW,
  formatIsoDate,
  formatHumanDateIndo,
  getHijriInfo,
  getWetonInfo,
  getHijriMonthHeader,
  toArabicIndicDigits,
  generateMonthGridCells,
  isPlannerActiveInMonth,
  matchPlannerRule,
  padZero
} from './utils/calendarDateUtils';
import { useOptionalAcara } from '@products/hub/acara/context/AcaraContext';
import { acaraService } from '@products/hub/acara/acaraService';
import { toCapitalEachWord } from '@products/hub/acara/components/AcaraFormModal';
import { kalenderService } from './kalenderService';
import { KalenderPdfViewer } from './components/KalenderPdfViewer';
import { exportKalenderBulanPdf, exportKalenderAkademikFallbackPdf } from './utils/kalenderPdfExport';
import { useNavigate } from 'react-router-dom';
import { useInstantData } from '@shared/hooks/useInstantData';

const RECURRENCE_OPTIONS = [
  { value: 'sekali_tayang', label: 'Sekali Tayang (Tanggal Pasti Masehi)' },
  { value: 'tanggal_hijriah', label: 'Tanggal Pasti Hijriah (Berulang Tiap Tahun)' },
  { value: 'bulan_hijriah', label: 'Sepanjang Bulan Hijriah (Tanggal Belum Ditentukan)' },
  { value: 'bagian_bulan_hijriah', label: 'Bagian Bulan Hijriah (Awal / Tengah / Akhir)' },
  { value: 'tanggal_masehi_tahunan', label: 'Tanggal Masehi Tahunan (Tiap Tanggal & Bulan)' },
  { value: 'bulan_masehi', label: 'Sepanjang Bulan Masehi (Tahunan)' },
  { value: 'setiap_bulan', label: 'Setiap Bulan (Tanggal Tertentu)' },
  { value: 'hari_mingguan', label: 'Hari Mingguan Rutin (Tiap Pekan)' },
  { value: 'hari_weton', label: 'Hari Weton Jawa (Siklus 35 Hari)' },
];

const PLANNER_CATEGORIES = [
  'Event Hijriyah',
  'Event Masehi',
  'Momentum Nasional',
  'Program Khusus',
  'Lainnya',
];

const HIJRI_MONTH_OPTIONS = [
  'Muharram',
  'Shafar',
  'Rabiul Awal',
  'Rabiul Akhir',
  'Jumadil Awal',
  'Jumadil Akhir',
  'Rajab',
  "Sya'ban",
  'Ramadhan',
  'Syawal',
  "Dzulqo'dah",
  'Dzulhijjah',
];

const PASARAN_OPTIONS = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
const DOW_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const getMomentumCategoryBadge = (kategori: string, bulanHijriah?: string, subkategori?: string) => {
  const catLower = (kategori || '').toLowerCase();
  if (catLower.includes('pondok') || catLower.includes('pesantren')) {
    return {
      type: 'pondok',
      bg: 'rgba(5, 150, 105, 0.08)',
      color: '#059669',
      border: '1px solid rgba(5, 150, 105, 0.2)',
      label: kategori || 'Event Pondok',
      subLabel: bulanHijriah || subkategori
    };
  }
  if (catLower.includes('hijri') || bulanHijriah) {
    return {
      type: 'hijriah',
      bg: 'rgba(217, 119, 6, 0.08)',
      color: '#b45309',
      border: '1px solid rgba(217, 119, 6, 0.2)',
      label: bulanHijriah || kategori || 'Event Hijriyah',
      subLabel: bulanHijriah ? (kategori && kategori !== 'Event Hijriyah' ? kategori : subkategori) : subkategori
    };
  }
  if (catLower.includes('masehi') || catLower.includes('nasional')) {
    return {
      type: 'masehi',
      bg: 'rgba(37, 99, 235, 0.08)',
      color: '#1d4ed8',
      border: '1px solid rgba(37, 99, 235, 0.2)',
      label: kategori || 'Event Masehi',
      subLabel: subkategori
    };
  }
  return {
    type: 'program',
    bg: 'rgba(109, 40, 217, 0.08)',
    color: '#6d28d9',
    border: '1px solid rgba(109, 40, 217, 0.2)',
    label: kategori || 'Program Khusus',
    subLabel: subkategori
  };
};

export const KalenderPage: React.FC = () => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => formatIsoDate(today), [today]);

  // Hook konteks acara terpadu
  const acaraCtx = useOptionalAcara();
  const acaraEvents = acaraCtx?.events || [];
  const isAcaraLoading = acaraCtx?.isLoading ?? false;
  const acaraError = acaraCtx?.error ?? null;

  // State navigasi kalender
  const [activeLayer, setActiveLayer] = useState<CalendarLayer>('ptv');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedIso, setSelectedIso] = useState<string>(todayIso);

  // Sinkronisasi data acara riil Staging ke kalender tanpa silent fallback ke mock
  const mappedAcaraEvents = useMemo<CalendarEvent[]>(() => {
    if (!acaraEvents || acaraEvents.length === 0) {
      return [];
    }
    return acaraEvents.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      time: e.time,
      loc: e.loc,
      category: e.type === 'internal' ? 'Internal Studio' : 'Liputan Utama',
      crew: (e.crew || []).map((c: any) => (typeof c === 'string' ? c : c.name)),
      gear: (e.gear || []).map((g: any) =>
        typeof g === 'string' ? g : (g.code ? `${g.name} (${g.code})` : g.name)
      ),
      status: e.status || 'Dijadwalkan',
      notes: e.notes,
      doc: e.doc,
      sessions: e.sessions
    }));
  }, [acaraEvents]);

  const [events, setEvents] = useState<CalendarEvent[]>(() => mappedAcaraEvents);

  useEffect(() => {
    setEvents(mappedAcaraEvents);
  }, [mappedAcaraEvents]);

  // Instant-First Persistent Cache: Instant render on remount, background revalidation
  const {
    data: planners,
    isLoading: isPlannerLoading,
    error: plannerError,
    refetch: fetchPlanners,
  } = useInstantData<ContentPlannerItem[]>({
    key: 'kalender_planners_list',
    fetcher: () => kalenderService.getPlanners(),
    ttlMs: 15 * 60 * 1000,
    initialFallback: [],
  });

  // State modal interaksi & aksesibilitas
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddPlannerOpen, setIsAddPlannerOpen] = useState(false);
  const [activeDetailEvent, setActiveDetailEvent] = useState<CalendarEvent | null>(null);
  const [activeDetailPlanner, setActiveDetailPlanner] = useState<ContentPlannerItem | null>(null);

  const addEventModalRef = useRef<HTMLDivElement>(null);
  const addPlannerModalRef = useRef<HTMLDivElement>(null);
  const detailEventModalRef = useRef<HTMLDivElement>(null);
  const detailPlannerModalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: isAddEventOpen,
    onClose: () => setIsAddEventOpen(false),
    modalRef: addEventModalRef
  });

  useModalScrollLock({
    isOpen: isAddPlannerOpen,
    onClose: () => setIsAddPlannerOpen(false),
    modalRef: addPlannerModalRef
  });

  useModalScrollLock({
    isOpen: Boolean(activeDetailEvent),
    onClose: () => setActiveDetailEvent(null),
    modalRef: detailEventModalRef
  });

  useModalScrollLock({
    isOpen: Boolean(activeDetailPlanner),
    onClose: () => setActiveDetailPlanner(null),
    modalRef: detailPlannerModalRef
  });

  // Form input penambahan acara liputan (Persisten ke Supabase Staging)
  const [newEventName, setNewEventName] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('Liputan Utama');
  const [newEventTime, setNewEventTime] = useState('08:00 – Selesai');
  const [newEventLoc, setNewEventLoc] = useState('Studio PTV');
  const [isSubmittingNewEvent, setIsSubmittingNewEvent] = useState(false);
  const [newEventError, setNewEventError] = useState<string | null>(null);

  // State form Content Planner (Tambah / Edit)
  const [editingPlannerId, setEditingPlannerId] = useState<string | null>(null);
  const [plannerFormJudul, setPlannerFormJudul] = useState('');
  const [plannerFormKategori, setPlannerFormKategori] = useState('Event Hijriyah');
  const [plannerFormSubkategori, setPlannerFormSubkategori] = useState('');
  const [plannerFormRecurrenceType, setPlannerFormRecurrenceType] = useState('sekali_tayang');
  const [plannerFormTanggalMulai, setPlannerFormTanggalMulai] = useState(todayIso);
  const [plannerFormHDay, setPlannerFormHDay] = useState(1);
  const [plannerFormHMonth, setPlannerFormHMonth] = useState('Muharram');
  const [plannerFormSegment, setPlannerFormSegment] = useState('awal');
  const [plannerFormMDay, setPlannerFormMDay] = useState(1);
  const [plannerFormMMonth, setPlannerFormMMonth] = useState(1);
  const [plannerFormDow, setPlannerFormDow] = useState('Kamis');
  const [plannerFormPasaran, setPlannerFormPasaran] = useState('Legi');
  const [plannerFormDaftarKonten, setPlannerFormDaftarKonten] = useState('');
  const [plannerFormDeskripsi, setPlannerFormDeskripsi] = useState('');
  const [plannerFormReferensiUrl, setPlannerFormReferensiUrl] = useState('');
  const [isSubmittingPlanner, setIsSubmittingPlanner] = useState(false);
  const [plannerFormError, setPlannerFormError] = useState<string | null>(null);

  const openNewPlannerModal = (presetDate?: string) => {
    setEditingPlannerId(null);
    setPlannerFormJudul('');
    setPlannerFormKategori('Event Hijriyah');
    setPlannerFormSubkategori('');
    setPlannerFormRecurrenceType('sekali_tayang');
    setPlannerFormTanggalMulai(presetDate || selectedIso);
    setPlannerFormHDay(selectedHijri.day || 1);
    setPlannerFormHMonth(selectedHijri.monthName || 'Muharram');
    setPlannerFormSegment('awal');
    setPlannerFormMDay(today.getDate());
    setPlannerFormMMonth(today.getMonth() + 1);
    setPlannerFormDow(selectedWeton.day || 'Kamis');
    setPlannerFormPasaran(selectedWeton.pasaran || 'Legi');
    setPlannerFormDaftarKonten('');
    setPlannerFormDeskripsi('');
    setPlannerFormReferensiUrl('');
    setPlannerFormError(null);
    setIsAddPlannerOpen(true);
  };

  const openEditPlannerModal = (p: ContentPlannerItem) => {
    setEditingPlannerId(p.id);
    setPlannerFormJudul(p.judul_momentum);
    setPlannerFormKategori(p.kategori || 'Event Hijriyah');
    setPlannerFormSubkategori(p.subkategori || '');
    setPlannerFormRecurrenceType(p.recurrence_type || 'sekali_tayang');
    setPlannerFormTanggalMulai(p.tanggal_mulai || selectedIso);
    setPlannerFormHDay(p.tanggal_hijriah || 1);
    setPlannerFormHMonth(p.bulan_hijriah || 'Muharram');
    setPlannerFormSegment(p.recurrence_rule?.segment || 'awal');
    setPlannerFormMDay(p.tanggal_masehi || 1);
    setPlannerFormMMonth(p.bulan_masehi || 1);
    setPlannerFormDow(p.hari_mingguan || 'Kamis');
    setPlannerFormPasaran(p.hari_pasaran || 'Legi');
    setPlannerFormDaftarKonten((p.daftar_konten || []).join('\n'));
    setPlannerFormDeskripsi(p.deskripsi || '');
    setPlannerFormReferensiUrl(p.referensi_url || '');
    setPlannerFormError(null);
    setActiveDetailPlanner(null);
    setIsAddPlannerOpen(true);
  };

  const handleSavePlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannerFormJudul.trim()) {
      setPlannerFormError('Judul momentum / acara konten wajib diisi.');
      return;
    }

    setIsSubmittingPlanner(true);
    setPlannerFormError(null);

    try {
      const payload: CreatePlannerDTO = {
        judul_momentum: plannerFormJudul.trim(),
        kategori: plannerFormKategori,
        subkategori: plannerFormSubkategori.trim() || undefined,
        recurrence_type: plannerFormRecurrenceType,
        deskripsi: plannerFormDeskripsi.trim() || undefined,
        daftar_konten: plannerFormDaftarKonten.split('\n').map(s => s.trim()).filter(Boolean),
        referensi_url: plannerFormReferensiUrl.trim() || undefined,
      };

      if (plannerFormRecurrenceType === 'sekali_tayang') {
        payload.tanggal_mulai = plannerFormTanggalMulai;
      } else if (plannerFormRecurrenceType === 'tanggal_hijriah') {
        payload.bulan_hijriah = plannerFormHMonth;
        payload.tanggal_hijriah = Number(plannerFormHDay);
        payload.recurrence_rule = { day: Number(plannerFormHDay), month: plannerFormHMonth };
      } else if (plannerFormRecurrenceType === 'bulan_hijriah') {
        payload.bulan_hijriah = plannerFormHMonth;
        payload.tanggal_hijriah = null;
        payload.recurrence_rule = { month: plannerFormHMonth };
      } else if (plannerFormRecurrenceType === 'bagian_bulan_hijriah') {
        payload.bulan_hijriah = plannerFormHMonth;
        payload.tanggal_hijriah = null;
        payload.recurrence_rule = { segment: plannerFormSegment, month: plannerFormHMonth };
      } else if (plannerFormRecurrenceType === 'tanggal_masehi_tahunan') {
        payload.bulan_masehi = Number(plannerFormMMonth);
        payload.tanggal_masehi = Number(plannerFormMDay);
        payload.recurrence_rule = { day: Number(plannerFormMDay), month: Number(plannerFormMMonth) };
      } else if (plannerFormRecurrenceType === 'bulan_masehi') {
        payload.bulan_masehi = Number(plannerFormMMonth);
        payload.recurrence_rule = { month: Number(plannerFormMMonth) };
      } else if (plannerFormRecurrenceType === 'setiap_bulan') {
        payload.tanggal_masehi = Number(plannerFormMDay);
        payload.recurrence_rule = { day: Number(plannerFormMDay) };
      } else if (plannerFormRecurrenceType === 'hari_mingguan') {
        payload.hari_mingguan = plannerFormDow;
        payload.recurrence_rule = { dayOfWeek: plannerFormDow };
      } else if (plannerFormRecurrenceType === 'hari_weton') {
        payload.hari_mingguan = plannerFormDow;
        payload.hari_pasaran = plannerFormPasaran;
        payload.recurrence_rule = { dayOfWeek: plannerFormDow, pasaran: plannerFormPasaran };
      }

      if (editingPlannerId) {
        await kalenderService.updatePlanner(editingPlannerId, payload);
      } else {
        await kalenderService.createPlanner(payload);
      }

      await fetchPlanners();
      setIsAddPlannerOpen(false);
      setEditingPlannerId(null);
    } catch (err: any) {
      setPlannerFormError(err.message || 'Gagal menyimpan ide konten. Silakan coba lagi.');
    } finally {
      setIsSubmittingPlanner(false);
    }
  };

  const handleDeletePlanner = async (id: string, name: string) => {
    if (!window.confirm(`Hapus momentum "${name}" secara permanen?`)) {
      return;
    }
    try {
      await kalenderService.deletePlanner(id);
      await fetchPlanners();
      setActiveDetailPlanner(null);
    } catch (err: any) {
      alert(`Gagal menghapus momentum: ${err.message}`);
    }
  };

  // Navigasi bulan
  const handlePrevMonth = () => {
    setCursorDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCursorDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const freshToday = new Date();
    setCursorDate(new Date(freshToday.getFullYear(), freshToday.getMonth(), 1));
    setSelectedIso(formatIsoDate(freshToday));
  };

  const currentYear = cursorDate.getFullYear();
  const currentMonthIdx = cursorDate.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();

  // Grid sel tanggal
  const gridCells = useMemo(() => {
    return generateMonthGridCells(
      currentYear,
      currentMonthIdx,
      selectedIso,
      events,
      planners
    );
  }, [currentYear, currentMonthIdx, selectedIso, events, planners]);

  // Rentang bulan Hijriah di header
  const hijriMonthHeader = useMemo(() => {
    return getHijriMonthHeader(currentYear, currentMonthIdx);
  }, [currentYear, currentMonthIdx]);

  // Detail tanggal terpilih di sidebar
  const selectedHijri = useMemo(() => getHijriInfo(selectedIso), [selectedIso]);
  const selectedWeton = useMemo(() => getWetonInfo(selectedIso), [selectedIso]);
  const selectedEvents = useMemo(() => events.filter(e => e.date === selectedIso), [events, selectedIso]);

  // Momentum bulan berjalan
  // 1. Fleksibel sepanjang bulan
  const periodPlanners = useMemo(() => {
    return planners.filter(p => isPlannerActiveInMonth(p, currentYear, currentMonthIdx));
  }, [planners, currentYear, currentMonthIdx]);

  // 2. Tanggal pasti dalam bulan berjalan
  const exactDayPlanners = useMemo(() => {
    const list: { day: number; iso: string; planner: ContentPlannerItem }[] = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const cellIso = `${currentYear}-${padZero(currentMonthIdx + 1)}-${padZero(d)}`;
      const hInfo = getHijriInfo(cellIso);
      const wInfo = getWetonInfo(cellIso);
      for (const p of planners) {
        if (matchPlannerRule(p, cellIso, hInfo, wInfo)) {
          list.push({ day: d, iso: cellIso, planner: p });
        }
      }
    }
    list.sort((a, b) => a.day - b.day);
    return list;
  }, [planners, currentYear, currentMonthIdx, daysInCurrentMonth]);

  const totalMomentumCount = periodPlanners.length + exactDayPlanners.length;

  // Handler simpan acara baru ke Supabase Staging via shared Acara service
  const handleSaveNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    setIsSubmittingNewEvent(true);
    setNewEventError(null);

    try {
      const payload = {
        name: toCapitalEachWord(newEventName),
        date: selectedIso,
        time: newEventTime.trim() || '08:00 – Selesai',
        loc: newEventLoc.trim() || 'Studio PTV',
        type: newEventCategory === 'Internal Studio' ? 'internal' : 'liputan',
        status: 'Mendatang' as const,
        notes: ''
      };

      if (acaraCtx?.createEvent) {
        const created = await acaraCtx.createEvent(payload);
        if (!created) {
          throw new Error('Gagal menyimpan acara. Silakan coba lagi.');
        }
      } else {
        await acaraService.createEvent(payload);
      }

      if (acaraCtx?.refreshEvents) {
        await acaraCtx.refreshEvents();
      }

      setNewEventName('');
      setIsAddEventOpen(false);
    } catch (err: any) {
      setNewEventError(err.message || 'Gagal menyimpan acara kegiatan. Silakan coba lagi.');
    } finally {
      setIsSubmittingNewEvent(false);
    }
  };

  return (
    <div className="r03-kalender acara-kal-view-transition">
      {/* 1. Shared Unified Header Component */}
      <AcaraKalenderHeader />

      {/* 2. 3 Layer Nav Filters Bar (Pill Filter Bar with Horizontal Scroll Affordance) */}
      <div className="kal-filter-bar-wrap">
        <div className="kal-filter-bar">
          <button
            onClick={() => setActiveLayer('ptv')}
            className={`kal-nav-pill-btn ${activeLayer === 'ptv' ? 'active-ptv' : ''}`}
          >
            <i className="fa-solid fa-calendar-days" />
            <span>Kalender PTV</span>
          </button>

          <button
            onClick={() => setActiveLayer('pesantren')}
            className={`kal-nav-pill-btn ${activeLayer === 'pesantren' ? 'active-pesantren' : ''}`}
          >
            <i className="fa-solid fa-mosque" />
            <span>Kalender Pesantren</span>
          </button>

          <button
            onClick={() => setActiveLayer('sekolah')}
            className={`kal-nav-pill-btn ${activeLayer === 'sekolah' ? 'active-sekolah' : ''}`}
          >
            <i className="fa-solid fa-graduation-cap" />
            <span>Kalender Sekolah</span>
          </button>

          {/* Ekspor / Unduh Kalender PDF */}
          <button
            type="button"
            className="kal-nav-pill-btn kal-btn-export-pdf"
            style={{
              marginLeft: 'auto',
              background: 'var(--surface, #ffffff)',
              border: '1.5px solid var(--b-300, #93c5fd)',
              color: 'var(--b-700, #004ecc)',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onClick={() => {
              if (activeLayer === 'ptv') {
                exportKalenderBulanPdf(currentMonthIdx, currentYear, events, planners || []);
              } else {
                exportKalenderAkademikFallbackPdf(activeLayer);
              }
            }}
            title="Unduh Kalender Resmi dalam Format PDF"
          >
            <i className="fa-solid fa-file-arrow-down" style={{ color: '#ef4444' }} />
            <span>Unduh Kalender PDF</span>
          </button>
        </div>
        <div className="kal-filter-scroll-hint" aria-hidden="true" />
      </div>

      {/* LAYER 1: KALENDER PTV */}
      {activeLayer === 'ptv' && (
        <div className="kal-layout-grid">
          {/* KOLOM KIRI (60%): Kalender Bulanan di atas, Acara Liputan tepat di bawahnya */}
          <div className="kal-col-left">
            {/* 1. AREA KALENDER BULANAN (UTAMA) */}
            <div className="kal-grid-calendar-area">
              {/* CARD 1: GRID KALENDER PTV UTAMA */}
              <div className="cal-card-box kal-surface-card">
                {/* Clean Editorial Calendar Card Header (Mobile First Central Alignment) */}
                <div className="cal-editorial-header">
                  {/* Baris 1: [ < ]    Bulan Tahun    [ > ] */}
                  <div className="cal-editorial-nav-row cal-editorial-header-center">
                    <button
                      className="cal-editorial-nav-btn"
                      onClick={handlePrevMonth}
                      aria-label="Bulan Sebelumnya"
                      title="Bulan Sebelumnya"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <h2 className="cal-editorial-title">
                      {MONTHS[currentMonthIdx]} {currentYear}
                    </h2>
                    <button
                      className="cal-editorial-nav-btn"
                      onClick={handleNextMonth}
                      aria-label="Bulan Berikutnya"
                      title="Bulan Berikutnya"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>

                  {/* Baris 2: Rentang Bulan Hijriah Rapi & Terpusat */}
                  <div className="cal-editorial-hijri-range">
                    {hijriMonthHeader}
                  </div>

                  {/* Baris 3: Tombol Hari Ini Tepat di Tengah */}
                  <div className="cal-editorial-today-row">
                    <button
                      className="cal-editorial-today-btn"
                      onClick={handleGoToday}
                    >
                      Hari Ini
                    </button>
                  </div>
                </div>

                <div className="cal-editorial-divider" />

                {/* Day of Week Headers (AHAD - SABTU, Ahad berwarna merah) */}
                <div className="cal-dow-row">
                  {DOW.map((d, dIdx) => (
                    <div
                      key={d}
                      className={`cal-dow-col ${dIdx === 0 ? 'cal-dow-sunday' : ''}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="cal-days-grid">
                  {gridCells.map((c, idx) => {
                    const cellClasses = ['cal-day-cell'];
                    if (c.isOutOfMonth) cellClasses.push('out');
                    if (c.isToday) cellClasses.push('today');
                    if (c.isSelected) cellClasses.push('sel');
                    if (idx % 7 === 0) cellClasses.push('cal-cell-sunday');
                    if (idx === 0) cellClasses.push('cal-cell-corner-tl');
                    if (idx === 6) cellClasses.push('cal-cell-corner-tr');
                    if (idx === gridCells.length - 7) cellClasses.push('cal-cell-corner-bl');
                    if (idx === gridCells.length - 1) cellClasses.push('cal-cell-corner-br');

                    const dayEvents = c.events || [];

                    return (
                      <div
                        key={c.isoDate || `cell-${idx}`}
                        className={cellClasses.join(' ')}
                        onClick={() => setSelectedIso(c.isoDate)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedIso(c.isoDate);
                          }
                        }}
                        aria-label={`${c.isoDate} - ${c.hijri.full} - ${c.weton.full}`}
                      >
                        {/* Baris Atas: Masehi di Kiri Atas & Hijriah Arab di Kanan Atas */}
                        <div className="cal-cell-header-row">
                          <span className="cal-cell-masehi">
                            {c.dayNumber}
                          </span>
                          <span className="cal-cell-hijri calendar-hijri-number">
                            {toArabicIndicDigits(c.hijri.day)}
                          </span>
                        </div>

                        {/* Baris Bawah: Weton Jawa di Kiri Bawah & Titik Indikator di Kanan Bawah */}
                        <div className="cal-cell-sub-row">
                          <span className="cal-cell-weton">
                            {c.weton.pasaran}
                          </span>
                          <div className="cal-cell-dots">
                            {c.hasEvent && (
                              <span
                                className="cal-dot cal-dot-event"
                                title={`${dayEvents.length} acara`}
                              />
                            )}
                            {c.hasPlanner && (
                              <span
                                className="cal-dot cal-dot-planner"
                                title="Ada momentum / ide konten"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend Ringkas Bawah Grid */}
                <div className="cal-editorial-legend">
                  <span className="cal-legend-item">
                    <span className="cal-dot cal-dot-event" />
                    Ada Acara / Kegiatan
                  </span>
                  <span className="cal-legend-item">
                    <span className="cal-dot cal-dot-planner" />
                    Ada Momentum Konten
                  </span>
                  <span className="cal-legend-item">
                    <span className="cal-legend-swatch-sel" />
                    Tanggal Terpilih
                  </span>
                </div>
              </div>
            </div>

            {/* 2. AREA AGENDA ACARA LIPUTAN (DI BAWAH KALENDER LEBAR SEJAJAR) */}
            <div className="kal-grid-agenda-area">
              <div className="cal-card-box kal-surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header Banner Tanggal Terpilih */}
                <div className="kal-selected-banner">
                  <div className="kal-selected-meta-label">
                    Detail Tanggal Terpilih
                  </div>
                  <div className="kal-selected-title">
                    {selectedWeton.day}, {formatHumanDateIndo(selectedIso)}
                  </div>
                  <div className="kal-selected-sub">
                    <span>{selectedHijri.full}</span>
                    <span className="kal-selected-bullet">•</span>
                    <span>Weton {selectedWeton.pasaran}</span>
                  </div>
                </div>

              {/* Bagian Acara Liputan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px'
                  }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: 'var(--ptv-curve-sm)',
                      background: 'rgba(16,185,129,0.12)',
                      color: '#059669',
                      display: 'inline-grid',
                      placeItems: 'center',
                      fontSize: '11px'
                    }}>
                      <i className="fa-solid fa-video" />
                    </span>
                    Acara Liputan
                  </span>
                  {selectedEvents.length > 0 && (
                    <span
                      className="kal-badge-pill"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#047857'
                      }}
                    >
                      {selectedEvents.length} Acara
                    </span>
                  )}
                </div>

                {isAcaraLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <SkeletonBase width="100%" height="48px" radius="12px" />
                    <SkeletonBase width="100%" height="48px" radius="12px" />
                  </div>
                ) : acaraError ? (
                  <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--ptv-curve-lg)', color: '#991b1b', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }} />
                      <span>{acaraError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => acaraCtx?.refreshEvents()}
                      className="kal-btn"
                      style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', fontSize: '11.5px', alignSelf: 'flex-start' }}
                    >
                      <i className="fa-solid fa-rotate-right" /> Coba Lagi
                    </button>
                  </div>
                ) : selectedEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedEvents.map(e => (
                      <div
                        key={e.id}
                        onClick={() => setActiveDetailEvent(e)}
                        className="kal-event-item"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {e.category && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 'var(--ptv-curve-xs)',
                              background: 'rgba(16,185,129,0.08)',
                              color: '#047857',
                              marginBottom: '4px',
                              display: 'inline-block'
                            }}>
                              {e.category}
                            </span>
                          )}
                          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px' }}>
                            {e.name}
                          </h4>
                          <p style={{ fontSize: '11.5px', color: 'var(--ink-2)', margin: 0 }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: '4px' }} />
                            {e.time || 'WIB'} &bull; <i className="fa-solid fa-location-dot" style={{ margin: '0 3px 0 4px' }} />
                            {e.loc || 'Studio PTV'}
                          </p>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'var(--muted)', fontSize: '11px' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '20px 14px', background: 'var(--bg)', borderRadius: 'var(--ptv-curve-lg)', border: '1px dashed var(--line-2)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                      <i className="fa-regular fa-calendar-xmark" style={{ marginRight: '6px' }} />
                      Belum ada acara pada tanggal ini.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setIsAddEventOpen(true)}
                  className="kal-btn"
                  style={{
                    width: '100%',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px dashed #a7f3d0',
                    color: '#059669',
                    fontSize: '12.5px',
                    minHeight: '38px',
                    marginTop: '4px'
                  }}
                >
                  <i className="fa-solid fa-plus" />
                  <span>Tambah Acara Liputan</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (40%): Momentum & Ide Planner seluruh bulan aktif */}
        <div className="kal-col-right">
          {/* 3. AREA MOMENTUM & IDE KONTEN SELURUH BULAN */}
          <div className="kal-grid-momentum-area">
            {/* CARD 2: MOMENTUM & IDE KONTEN SELURUH BULAN */}
            <div className="cal-card-box kal-surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Header Panel Sederhana Sesuai Pola Acara Liputan */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px'
                }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: 'var(--ptv-curve-sm)',
                    background: 'rgba(37,99,235,0.1)',
                    color: '#2563eb',
                    display: 'inline-grid',
                    placeItems: 'center',
                    fontSize: '11px'
                  }}>
                    <i className="fa-solid fa-lightbulb" />
                  </span>
                  Momentum &amp; Ide Konten
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {totalMomentumCount > 0 && (
                    <span
                      className="kal-badge-pill"
                      style={{
                        background: 'rgba(37,99,235,0.1)',
                        color: '#2563eb'
                      }}
                    >
                      {totalMomentumCount} Momentum
                    </span>
                  )}
                  <button
                    onClick={() => openNewPlannerModal()}
                    className="kal-btn"
                    style={{
                      background: 'rgba(37,99,235,0.08)',
                      border: '1px dashed #93c5fd',
                      color: '#2563eb',
                      fontSize: '11.5px',
                      fontWeight: 650,
                      minHeight: '28px',
                      padding: '0 10px',
                      borderRadius: 'var(--ptv-curve-pill)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <i className="fa-solid fa-plus" />
                    <span>Tambah Ide</span>
                  </button>
                </div>
              </div>

              {/* Daftar Momentum */}
              {isPlannerLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonBase width="100%" height="56px" radius="14px" />
                  <SkeletonBase width="100%" height="56px" radius="14px" />
                </div>
              ) : plannerError ? (
                <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--ptv-curve-lg)', color: '#991b1b', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }} />
                    <span>{plannerError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchPlanners}
                    className="kal-btn"
                    style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', fontSize: '11.5px', alignSelf: 'flex-start' }}
                  >
                    <i className="fa-solid fa-rotate-right" /> Coba Lagi
                  </button>
                </div>
              ) : totalMomentumCount > 0 ? (
                <div className="kal-planner-list">
                  {/* Section 1: Fleksibel sepanjang bulan */}
                  {periodPlanners.length > 0 && (
                    <div className="kal-planner-section">
                      <div className="kal-planner-section-header">
                        <span className="kal-planner-section-title">
                          <i className="fa-regular fa-circle-dot" />
                          Momentum Sepanjang Bulan &amp; Periode
                        </span>
                        <span className="kal-planner-section-sub">({periodPlanners.length})</span>
                      </div>
                      <div className="kal-planner-items-wrap">
                        {periodPlanners.map(p => {
                          const badge = getMomentumCategoryBadge(p.kategori, p.bulan_hijriah, p.subkategori);
                          const descText = p.deskripsi || (p.daftar_konten && p.daftar_konten.join(' · '));
                          return (
                            <div
                              key={p.id}
                              onClick={() => setActiveDetailPlanner(p)}
                              className="kal-event-item"
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setActiveDetailPlanner(p);
                                }
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                  <span
                                    className={`kal-momentum-badge kal-badge-${badge.type}`}
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 650,
                                      padding: '2px 8px',
                                      borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                      background: badge.bg,
                                      color: badge.color,
                                      border: badge.border,
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    {badge.label}
                                  </span>
                                  {badge.subLabel && badge.subLabel !== badge.label && (
                                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                                      &bull; {badge.subLabel}
                                    </span>
                                  )}
                                </div>
                                <h4 style={{
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  color: 'var(--ink)',
                                  margin: '0 0 3px',
                                  lineHeight: 1.35,
                                  wordBreak: 'break-word'
                                }}>
                                  {p.judul_momentum}
                                </h4>
                                {descText && (
                                  <p style={{
                                    fontSize: '11.5px',
                                    color: 'var(--ink-2)',
                                    margin: 0,
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}>
                                    {descText}
                                  </p>
                                )}
                              </div>
                              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--muted)', fontSize: '11px', flexShrink: 0, marginLeft: '10px' }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Jadwal Tanggal Pasti */}
                  {exactDayPlanners.length > 0 && (
                    <div className="kal-planner-section" style={{ marginTop: periodPlanners.length > 0 ? '6px' : 0 }}>
                      <div className="kal-planner-section-header">
                        <span className="kal-planner-section-title">
                          <i className="fa-solid fa-calendar-check" />
                          Jadwal Tanggal Pasti
                        </span>
                        <span className="kal-planner-section-sub">({exactDayPlanners.length})</span>
                      </div>
                      <div className="kal-planner-items-wrap">
                        {exactDayPlanners.map(({ day, iso, planner: p }) => {
                          const badge = getMomentumCategoryBadge(p.kategori, p.bulan_hijriah, p.subkategori);
                          const descText = p.deskripsi || (p.daftar_konten && p.daftar_konten.join(' · '));
                          return (
                            <div
                              key={`${p.id}-${iso}`}
                              onClick={() => {
                                setSelectedIso(iso);
                                setActiveDetailPlanner(p);
                              }}
                              className="kal-event-item"
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedIso(iso);
                                  setActiveDetailPlanner(p);
                                }
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                  <span
                                    className={`kal-momentum-badge kal-badge-${badge.type}`}
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 650,
                                      padding: '2px 8px',
                                      borderRadius: 'var(--ptv-curve-pill, 9999px)',
                                      background: badge.bg,
                                      color: badge.color,
                                      border: badge.border,
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    {badge.label}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                                    &bull; {day} {MONTHS[currentMonthIdx]}
                                  </span>
                                  {badge.subLabel && badge.subLabel !== badge.label && (
                                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                                      &bull; {badge.subLabel}
                                    </span>
                                  )}
                                </div>
                                <h4 style={{
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  color: 'var(--ink)',
                                  margin: '0 0 3px',
                                  lineHeight: 1.35,
                                  wordBreak: 'break-word'
                                }}>
                                  {p.judul_momentum}
                                </h4>
                                {descText && (
                                  <p style={{
                                    fontSize: '11.5px',
                                    color: 'var(--ink-2)',
                                    margin: 0,
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}>
                                    {descText}
                                  </p>
                                )}
                              </div>
                              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--muted)', fontSize: '11px', flexShrink: 0, marginLeft: '10px' }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '20px 14px', background: 'var(--bg)', borderRadius: 'var(--ptv-curve-lg)', border: '1px dashed var(--line-2)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                    <i className="fa-regular fa-calendar-xmark" style={{ marginRight: '6px' }} />
                    Tidak ada ide atau momentum khusus di bulan <b>{MONTHS[currentMonthIdx]} {currentYear}</b>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* LAYER 2 & 3: KALENDER PESANTREN & KALENDER SEKOLAH (DOCUMENT VIEWER & RUNTIME OVERRIDE) */}
      {(activeLayer === 'pesantren' || activeLayer === 'sekolah') && (
        <KalenderPdfViewer
          layer={activeLayer}
          onBackToPtv={() => setActiveLayer('ptv')}
        />
      )}

      {/* MODAL SIMULASI: TAMBAH ACARA LIPUTAN (PORTAL FULLSCREEN) */}
      {isAddEventOpen &&
        createPortal(
          <div className="kal-modal-backdrop" onClick={() => setIsAddEventOpen(false)}>
            <div
              ref={addEventModalRef}
              className="kal-modal-card"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kal-add-event-title"
              tabIndex={-1}
            >
              <div className="kal-modal-header">
                <h3 id="kal-add-event-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                  Tambah Acara Liputan
                </h3>
                <button
                  type="button"
                  aria-label="Tutup dialog tambah acara"
                  onClick={() => setIsAddEventOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted)' }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveNewEvent} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="kal-modal-body">
                  {newEventError && (
                    <div style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 'var(--ptv-curve-md)',
                      color: '#991b1b',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }} />
                      <span>{newEventError}</span>
                    </div>
                  )}

                  <div style={{
                    padding: '10px 14px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--ptv-curve-md)',
                    color: '#166534',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-calendar-check" style={{ marginTop: '2px', flexShrink: 0, color: '#16a34a' }} />
                    <span>
                      <strong>Sinkronisasi Agenda:</strong> Kegiatan yang disimpan di sini otomatis terhubung dengan jadwal produksi dan daftar acara.
                    </span>
                  </div>

                  <div>
                    <label className="kal-form-label">Tanggal Liputan</label>
                    <input
                      type="text"
                      disabled
                      value={`${formatHumanDateIndo(selectedIso)} (${selectedHijri.short})`}
                      className="kal-form-input"
                      style={{ background: 'var(--bg)' }}
                    />
                  </div>

                  <div>
                    <label className="kal-form-label">Nama Acara Liputan</label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Liputan Upacara Peringatan Hari Santri"
                      value={newEventName}
                      onChange={e => setNewEventName(e.target.value)}
                      className="kal-form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="kal-form-label">Kategori</label>
                      <select
                        value={newEventCategory}
                        onChange={e => setNewEventCategory(e.target.value)}
                        className="kal-form-input"
                      >
                        <option value="Liputan Utama">Liputan Utama</option>
                        <option value="Program Reguler">Program Reguler</option>
                        <option value="Acara Khusus">Acara Khusus</option>
                        <option value="Kajian">Kajian</option>
                      </select>
                    </div>
                    <div>
                      <label className="kal-form-label">Waktu</label>
                      <input
                        type="text"
                        value={newEventTime}
                        onChange={e => setNewEventTime(e.target.value)}
                        className="kal-form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="kal-form-label">Lokasi</label>
                    <input
                      type="text"
                      value={newEventLoc}
                      onChange={e => setNewEventLoc(e.target.value)}
                      className="kal-form-input"
                    />
                  </div>
                </div>

                <div className="kal-modal-footer">
                  <button
                    type="button"
                    onClick={() => !isSubmittingNewEvent && setIsAddEventOpen(false)}
                    disabled={isSubmittingNewEvent}
                    className="kal-btn kal-btn-secondary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNewEvent}
                    className="kal-btn kal-btn-success"
                  >
                    {isSubmittingNewEvent ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" />
                        <span>Menyimpan perubahan...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check" />
                        <span>Simpan Acara Liputan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL TAMBAH & EDIT CONTENT PLANNER (PERSISTEN KE SUPABASE STAGING) */}
      {isAddPlannerOpen &&
        createPortal(
          <div className="kal-modal-backdrop" onClick={() => !isSubmittingPlanner && setIsAddPlannerOpen(false)}>
            <div
              ref={addPlannerModalRef}
              className="kal-modal-card"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kal-add-planner-title"
              tabIndex={-1}
            >
              <div className="kal-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--ptv-curve-sm)',
                    background: 'rgba(99,102,241,0.1)',
                    color: '#6366f1',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '13px'
                  }}>
                    <i className={editingPlannerId ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-lightbulb'} />
                  </span>
                  <h3 id="kal-add-planner-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                    {editingPlannerId ? 'Edit Momentum Content Planner' : 'Tambah Momentum Content Planner'}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Tutup dialog ide konten"
                  onClick={() => !isSubmittingPlanner && setIsAddPlannerOpen(false)}
                  disabled={isSubmittingPlanner}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted)' }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSavePlanner} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="kal-modal-body">
                  {plannerFormError && (
                    <div style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 'var(--ptv-curve-md)',
                      color: '#991b1b',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }} />
                      <span>{plannerFormError}</span>
                    </div>
                  )}

                  {/* KELOMPOK 1: INFORMASI MOMENTUM */}
                  <div style={{
                    padding: '14px',
                    background: 'var(--bg-2, rgba(0,0,0,0.02))',
                    border: '1px solid var(--line-2)',
                    borderRadius: 'var(--ptv-curve-lg, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--line-2)' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--ptv-curve-sm)',
                        background: 'rgba(99,102,241,0.12)',
                        color: '#6366f1',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        flexShrink: 0
                      }}>
                        <i className="fa-solid fa-circle-info" />
                      </span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>Informasi Momentum</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>Judul momentum dan klasifikasi kategori konten</p>
                      </div>
                    </div>

                    {/* Judul Momentum */}
                    <div>
                      <label className="kal-form-label">
                        Judul Momentum / Acara <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Haul Solo / Haul Ploso / Semarak Ramadhan"
                        value={plannerFormJudul}
                        onChange={e => setPlannerFormJudul(e.target.value)}
                        className="kal-form-input"
                      />
                    </div>

                    {/* Kategori & Subkategori */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="kal-form-label">Kategori</label>
                        <select
                          value={plannerFormKategori}
                          onChange={e => setPlannerFormKategori(e.target.value)}
                          className="kal-form-input"
                        >
                          {PLANNER_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="kal-form-label">Subkategori / Label</label>
                        <input
                          type="text"
                          placeholder="Contoh: Rabiul Akhir / Haul / Ramadhan"
                          value={plannerFormSubkategori}
                          onChange={e => setPlannerFormSubkategori(e.target.value)}
                          className="kal-form-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* KELOMPOK 2: PENJADWALAN */}
                  <div style={{
                    padding: '14px',
                    background: 'var(--bg-2, rgba(0,0,0,0.02))',
                    border: '1px solid var(--line-2)',
                    borderRadius: 'var(--ptv-curve-lg, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--line-2)' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--ptv-curve-sm)',
                        background: 'rgba(99,102,241,0.12)',
                        color: '#6366f1',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        flexShrink: 0
                      }}>
                        <i className="fa-solid fa-calendar-days" />
                      </span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>Penjadwalan</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>Pola pengulangan waktu dan tanggal aktif di kalender</p>
                      </div>
                    </div>

                    <div>
                      <label className="kal-form-label">Pola Waktu / Pengulangan Konten</label>
                      <select
                        value={plannerFormRecurrenceType}
                        onChange={e => setPlannerFormRecurrenceType(e.target.value)}
                        className="kal-form-input"
                      >
                        {RECURRENCE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dynamic Fields Per Recurrence Type */}
                    {plannerFormRecurrenceType === 'sekali_tayang' && (
                      <div>
                        <label className="kal-form-label">Tanggal Pelaksanaan Spesifik</label>
                        <input
                          type="date"
                          required
                          value={plannerFormTanggalMulai}
                          onChange={e => setPlannerFormTanggalMulai(e.target.value)}
                          className="kal-form-input"
                        />
                        <span className="kal-form-hint">Tanggal Pasti: Hanya berlaku pada satu tanggal tertentu (tidak berulang).</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'tanggal_hijriah' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="kal-form-label">Tanggal Hijriah (1–30)</label>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              required
                              value={plannerFormHDay}
                              onChange={e => setPlannerFormHDay(parseInt(e.target.value, 10) || 1)}
                              className="kal-form-input"
                            />
                          </div>
                          <div>
                            <label className="kal-form-label">Bulan Hijriah</label>
                            <select
                              value={plannerFormHMonth}
                              onChange={e => setPlannerFormHMonth(e.target.value)}
                              className="kal-form-input"
                            >
                              {HIJRI_MONTH_OPTIONS.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <span className="kal-form-hint">Tanggal Pasti: Kalender PTV akan mencocokkan konversi kalender Hijriah otomatis setiap tahun.</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'bulan_hijriah' && (
                      <div>
                        <label className="kal-form-label">Pilih Bulan Hijriah</label>
                        <select
                          value={plannerFormHMonth}
                          onChange={e => setPlannerFormHMonth(e.target.value)}
                          className="kal-form-input"
                        >
                          {HIJRI_MONTH_OPTIONS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--ptv-curve-sm)', fontSize: '11.5px', color: '#1e40af', lineHeight: 1.45 }}>
                          <i className="fa-solid fa-circle-info" style={{ marginRight: '5px' }} />
                          <b>Tanggal belum ditentukan:</b> Event ini aktif sepanjang bulan Hijriah yang dipilih. Tidak akan dipaksa menjadi tanggal 1 dan tetap muncul pada seluruh bulan kalender Masehi yang beririsan.
                        </div>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'bagian_bulan_hijriah' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="kal-form-label">Bagian Bulan</label>
                            <select
                              value={plannerFormSegment}
                              onChange={e => setPlannerFormSegment(e.target.value)}
                              className="kal-form-input"
                            >
                              <option value="awal">Awal Bulan (Tgl 1–10)</option>
                              <option value="pertengahan">Pertengahan Bulan (Tgl 11–20)</option>
                              <option value="akhir">Akhir Bulan (Tgl 21–Akhir)</option>
                              <option value="menjelang">Menjelang Akhir (Tgl 25–Akhir)</option>
                            </select>
                          </div>
                          <div>
                            <label className="kal-form-label">Bulan Hijriah</label>
                            <select
                              value={plannerFormHMonth}
                              onChange={e => setPlannerFormHMonth(e.target.value)}
                              className="kal-form-input"
                            >
                              {HIJRI_MONTH_OPTIONS.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <span className="kal-form-hint">Cocok untuk persiapan momentum seperti Awal Ramadhan, Menjelang Idul Fitri, dsb.</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'tanggal_masehi_tahunan' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="kal-form-label">Tanggal (1–31)</label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              required
                              value={plannerFormMDay}
                              onChange={e => setPlannerFormMDay(parseInt(e.target.value, 10) || 1)}
                              className="kal-form-input"
                            />
                          </div>
                          <div>
                            <label className="kal-form-label">Bulan Masehi</label>
                            <select
                              value={plannerFormMMonth}
                              onChange={e => setPlannerFormMMonth(parseInt(e.target.value, 10) || 1)}
                              className="kal-form-input"
                            >
                              {MONTHS.map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <span className="kal-form-hint">Berulang otomatis setiap tahun pada tanggal &amp; bulan Masehi yang sama (Tanggal Pasti).</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'bulan_masehi' && (
                      <div>
                        <label className="kal-form-label">Pilih Bulan Masehi</label>
                        <select
                          value={plannerFormMMonth}
                          onChange={e => setPlannerFormMMonth(parseInt(e.target.value, 10) || 1)}
                          className="kal-form-input"
                        >
                          {MONTHS.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                        <span className="kal-form-hint">Aktif sebagai momentum sepanjang bulan yang dipilih setiap tahunnya (Tanggal belum ditentukan).</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'setiap_bulan' && (
                      <div>
                        <label className="kal-form-label">Tanggal Setiap Bulan (1–31)</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          required
                          value={plannerFormMDay}
                          onChange={e => setPlannerFormMDay(parseInt(e.target.value, 10) || 1)}
                          className="kal-form-input"
                        />
                        <span className="kal-form-hint">Berulang otomatis setiap bulan pada tanggal yang ditentukan.</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'hari_mingguan' && (
                      <div>
                        <label className="kal-form-label">Pilih Hari Mingguan</label>
                        <select
                          value={plannerFormDow}
                          onChange={e => setPlannerFormDow(e.target.value)}
                          className="kal-form-input"
                        >
                          {DOW_OPTIONS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <span className="kal-form-hint">Berulang rutin setiap pekan pada hari yang ditentukan (misal: Setiap Kamis).</span>
                      </div>
                    )}

                    {plannerFormRecurrenceType === 'hari_weton' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="kal-form-label">Hari</label>
                            <select
                              value={plannerFormDow}
                              onChange={e => setPlannerFormDow(e.target.value)}
                              className="kal-form-input"
                            >
                              {DOW_OPTIONS.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="kal-form-label">Pasaran Jawa (Weton)</label>
                            <select
                              value={plannerFormPasaran}
                              onChange={e => setPlannerFormPasaran(e.target.value)}
                              className="kal-form-input"
                            >
                              {PASARAN_OPTIONS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <span className="kal-form-hint">Mengikuti siklus weton 35 hari sekali (misal: Kamis Legi, Jumat Kliwon).</span>
                      </div>
                    )}

                    {/* Preview Box */}
                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      border: '1px dashed var(--line-2)',
                      borderRadius: 'var(--ptv-curve-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <i className="fa-regular fa-clock" style={{ color: '#6366f1', fontSize: '13px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                        {(() => {
                          switch (plannerFormRecurrenceType) {
                            case 'sekali_tayang':
                              return plannerFormTanggalMulai ? `● Tanggal Pasti: ${plannerFormTanggalMulai}` : '● Tanggal Pasti: Silakan pilih tanggal pelaksanaan';
                            case 'tanggal_hijriah':
                              return `● ${plannerFormHDay} ${plannerFormHMonth} H — Tanggal Pasti (Setiap Tahun Hijriyah)`;
                            case 'bulan_hijriah':
                              return `○ Sepanjang ${plannerFormHMonth} — Tanggal Belum Ditentukan (Tampil di seluruh bulan kalender yang beririsan)`;
                            case 'bagian_bulan_hijriah': {
                              const segLabels: Record<string, string> = { awal: 'Awal Bulan (1–10)', pertengahan: 'Pertengahan Bulan (11–20)', akhir: 'Akhir Bulan (21–Akhir)', menjelang: 'Menjelang Akhir (25–Akhir)' };
                              return `◐ ${segLabels[plannerFormSegment] || 'Bagian'} ${plannerFormHMonth} — Momentum Periode`;
                            }
                            case 'tanggal_masehi_tahunan':
                              return `● Tiap ${plannerFormMDay} ${MONTHS[plannerFormMMonth - 1] || ''} (Tahunan Masehi)`;
                            case 'bulan_masehi':
                              return `○ Sepanjang bulan ${MONTHS[plannerFormMMonth - 1] || ''} (Tanggal Belum Ditentukan)`;
                            case 'setiap_bulan':
                              return `● Setiap tanggal ${plannerFormMDay} setiap bulan`;
                            case 'hari_mingguan':
                              return `● Setiap hari ${plannerFormDow} mingguan`;
                            case 'hari_weton':
                              return `● Setiap ${plannerFormDow} ${plannerFormPasaran} (Siklus Weton 35 Hari Sekali)`;
                            default:
                              return 'Pola pengulangan waktu';
                          }
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* KELOMPOK 3: PERENCANAAN KONTEN */}
                  <div style={{
                    padding: '14px',
                    background: 'var(--bg-2, rgba(0,0,0,0.02))',
                    border: '1px solid var(--line-2)',
                    borderRadius: 'var(--ptv-curve-lg, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--line-2)' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--ptv-curve-sm)',
                        background: 'rgba(99,102,241,0.12)',
                        color: '#6366f1',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        flexShrink: 0
                      }}>
                        <i className="fa-solid fa-photo-film" />
                      </span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>Perencanaan Konten</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>Format ide tayang, panduan/teks doa, dan link referensi</p>
                      </div>
                    </div>

                    {/* Daftar Ide / Format Konten */}
                    <div>
                      <label className="kal-form-label">
                        Daftar Ide / Format Konten (1 baris per item)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Contoh:&#10;Feed Ucapan Selamat&#10;Story Live Streaming&#10;Reels Cuplikan Mauidhoh"
                        value={plannerFormDaftarKonten}
                        onChange={e => setPlannerFormDaftarKonten(e.target.value)}
                        className="kal-form-input"
                        style={{ resize: 'vertical', lineHeight: 1.45 }}
                      />
                    </div>

                    {/* Catatan / Panduan / Teks Doa */}
                    <div>
                      <label className="kal-form-label">
                        Catatan / Panduan / Teks Doa
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Teks doa, biografi, rundown, atau amalan khusus..."
                        value={plannerFormDeskripsi}
                        onChange={e => setPlannerFormDeskripsi(e.target.value)}
                        className="kal-form-input"
                        style={{ resize: 'vertical', lineHeight: 1.45 }}
                      />
                    </div>

                    {/* Referensi URL */}
                    <div>
                      <label className="kal-form-label">
                        Referensi URL / Link Contoh (Pisahkan dengan baris baru)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="https://instagram.com/p/...&#10;https://drive.google.com/..."
                        value={plannerFormReferensiUrl}
                        onChange={e => setPlannerFormReferensiUrl(e.target.value)}
                        className="kal-form-input"
                        style={{ resize: 'vertical', lineHeight: 1.45 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="kal-modal-footer">
                  <button
                    type="button"
                    onClick={() => !isSubmittingPlanner && setIsAddPlannerOpen(false)}
                    disabled={isSubmittingPlanner}
                    className="kal-btn kal-btn-secondary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPlanner}
                    className="kal-btn kal-btn-primary"
                    style={{ background: '#6366f1' }}
                  >
                    {isSubmittingPlanner ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" />
                        <span>Menyimpan perubahan...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check" />
                        <span>{editingPlannerId ? 'Perbarui Ide Konten' : 'Simpan Ide Konten'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* DETAIL MODAL ACARA (PORTAL FULLSCREEN) */}
      {activeDetailEvent &&
        createPortal(
          <div className="kal-modal-backdrop" onClick={() => setActiveDetailEvent(null)}>
            <div
              ref={detailEventModalRef}
              className="kal-modal-card"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kal-detail-event-title"
              tabIndex={-1}
            >
              <div className="kal-modal-header">
                <span
                  className="kal-badge-pill"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    color: '#047857'
                  }}
                >
                  {activeDetailEvent.category || 'Liputan'}
                </span>
                <button
                  type="button"
                  aria-label="Tutup detail acara"
                  onClick={() => setActiveDetailEvent(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted)' }}
                >
                  &times;
                </button>
              </div>

              <div className="kal-modal-body">
                <h3 id="kal-detail-event-title" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
                  {activeDetailEvent.name}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--ink-2)', marginBottom: '8px' }}>
                  <div><i className="fa-regular fa-calendar" style={{ width: '18px', color: '#2563eb' }} /> Tanggal: <b>{formatHumanDateIndo(activeDetailEvent.date)}</b></div>
                  <div><i className="fa-regular fa-clock" style={{ width: '18px', color: '#059669' }} /> Jam: <b>{activeDetailEvent.time || 'WIB'}</b></div>
                  <div><i className="fa-solid fa-location-dot" style={{ width: '18px', color: '#dc2626' }} /> Lokasi: <b>{activeDetailEvent.loc || 'Studio PTV'}</b></div>
                  {activeDetailEvent.crew && activeDetailEvent.crew.length > 0 && (
                    <div><i className="fa-solid fa-users" style={{ width: '18px', color: '#7c3aed' }} /> Kru: {activeDetailEvent.crew.join(', ')}</div>
                  )}
                  {activeDetailEvent.gear && activeDetailEvent.gear.length > 0 && (
                    <div><i className="fa-solid fa-boxes-stacked" style={{ width: '18px', color: '#ea580c' }} /> Alat: {activeDetailEvent.gear.join(', ')}</div>
                  )}
                </div>

                {activeDetailEvent.sessions && activeDetailEvent.sessions.length > 0 && (
                  <div style={{ marginTop: '8px', marginBottom: '12px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--ptv-curve-md)', border: '1px solid var(--line-2)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-regular fa-clock" style={{ color: '#059669' }} />
                      Rincian Sesi ({activeDetailEvent.sessions.length} Sesi)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeDetailEvent.sessions.map((ses, idx) => (
                        <div key={ses.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {ses.label === 'Lainnya' ? (ses.custom_label || 'Sesi') : ses.label}
                          </span>
                          <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11.5px' }}>
                            {ses.start_time || '08:00'} – {ses.has_end_time && ses.end_time ? ses.end_time : 'Selesai'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeDetailEvent.notes && (
                  <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--ptv-curve-md)', fontSize: '12px', color: 'var(--ink)', border: '1px solid var(--line-2)' }}>
                    <strong>Catatan:</strong> {activeDetailEvent.notes}
                  </div>
                )}
              </div>

              <div className="kal-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDetailEvent(null);
                    navigate('/hub/acara');
                  }}
                  className="kal-btn kal-btn-secondary"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" />
                  <span>Buka di Modul Acara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailEvent(null)}
                  className="kal-btn kal-btn-primary"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* DETAIL MODAL MOMENTUM CONTENT PLANNER (PORTAL FULLSCREEN DENGAN EDIT & HAPUS) */}
      {activeDetailPlanner &&
        createPortal(
          <div className="kal-modal-backdrop" onClick={() => setActiveDetailPlanner(null)}>
            <div
              ref={detailPlannerModalRef}
              className="kal-modal-card"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kal-detail-planner-title"
              tabIndex={-1}
            >
              <div className="kal-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="kal-badge-pill"
                    style={{
                      background: 'rgba(37,99,235,0.1)',
                      color: '#2563eb'
                    }}
                  >
                    {activeDetailPlanner.kategori}
                  </span>
                  {activeDetailPlanner.subkategori && (
                    <span className="kal-badge-pill" style={{ background: 'var(--line-2)', color: 'var(--ink-2)' }}>
                      {activeDetailPlanner.subkategori}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Tutup detail momentum"
                  onClick={() => setActiveDetailPlanner(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted)' }}
                >
                  &times;
                </button>
              </div>

              <div className="kal-modal-body">
                <h3 id="kal-detail-planner-title" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
                  {activeDetailPlanner.judul_momentum}
                </h3>

                {/* Tanggal & Penjelasan Semantik Sesuai Legacy */}
                {activeDetailPlanner.recurrence_type === 'bulan_hijriah' || (activeDetailPlanner.bulan_hijriah && !activeDetailPlanner.tanggal_hijriah && !activeDetailPlanner.tanggal_mulai) ? (
                  <div style={{
                    padding: '10px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--ptv-curve-md)',
                    color: '#1e40af',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-circle-info" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      Dijadwalkan pada bulan <b>{activeDetailPlanner.bulan_hijriah} H</b>. Tanggal pelaksanaan belum ditentukan dan akan tampil pada setiap bulan kalender Masehi yang beririsan.
                    </span>
                  </div>
                ) : activeDetailPlanner.recurrence_type === 'bagian_bulan_hijriah' ? (
                  <div style={{
                    padding: '10px 14px',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: 'var(--ptv-curve-md)',
                    color: '#5b21b6',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <i className="fa-solid fa-layer-group" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      Dijadwalkan pada periode <b>{activeDetailPlanner.recurrence_rule?.segment || 'Awal'} {activeDetailPlanner.bulan_hijriah} H</b>.
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-regular fa-calendar-check" style={{ color: '#059669' }} />
                    <span>
                      Jadwal Tanggal Pasti: <b>{activeDetailPlanner.tanggal_mulai ? formatHumanDateIndo(activeDetailPlanner.tanggal_mulai) : (activeDetailPlanner.tanggal_hijriah ? `${activeDetailPlanner.tanggal_hijriah} ${activeDetailPlanner.bulan_hijriah} H` : 'Terjadwal')}</b>
                    </span>
                  </div>
                )}

                {/* Deskripsi / Catatan / Teks Doa */}
                {activeDetailPlanner.deskripsi && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '5px' }}>
                      Catatan, Doa &amp; Panduan:
                    </div>
                    <div style={{
                      padding: '12px 14px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line-2)',
                      borderRadius: 'var(--ptv-curve-md)',
                      fontSize: '12.5px',
                      color: 'var(--ink)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.55
                    }}>
                      {activeDetailPlanner.deskripsi}
                    </div>
                  </div>
                )}

                {/* Rincian Ide / Daftar Format Konten */}
                {activeDetailPlanner.daftar_konten && activeDetailPlanner.daftar_konten.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                      Daftar Ide / Format Konten ({activeDetailPlanner.daftar_konten.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeDetailPlanner.daftar_konten.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            background: 'var(--bg)',
                            borderRadius: 'var(--ptv-curve-md)',
                            border: '1px solid var(--line-2)',
                            fontSize: '12.5px',
                            color: 'var(--ink)'
                          }}
                        >
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#ede9fe',
                            color: '#7c3aed',
                            fontSize: '11px',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ lineHeight: 1.4 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Referensi URL & Link Inspirasi */}
                {activeDetailPlanner.referensi_url && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                      Referensi Publikasi &amp; Inspirasi:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeDetailPlanner.referensi_url.split(/[\n,]+/).map(u => u.trim()).filter(Boolean).map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: 'var(--bg)',
                            borderRadius: 'var(--ptv-curve-md)',
                            border: '1px solid var(--line-2)',
                            fontSize: '12px',
                            color: '#2563eb',
                            textDecoration: 'none',
                            wordBreak: 'break-all'
                          }}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '11px', flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="kal-modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => handleDeletePlanner(activeDetailPlanner.id, activeDetailPlanner.judul_momentum)}
                  className="kal-btn kal-btn-danger"
                  style={{ padding: '8px 14px' }}
                >
                  <i className="fa-solid fa-trash-can" />
                  <span>Hapus</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openEditPlannerModal(activeDetailPlanner)}
                    className="kal-btn kal-btn-secondary"
                  >
                    <i className="fa-solid fa-pen-to-square" />
                    <span>Edit Momentum</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailPlanner(null)}
                    className="kal-btn kal-btn-primary"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
