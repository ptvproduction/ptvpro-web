/**
 * SEO & Analytics Fixture Data
 * Direct 1:1 port of PHP Legacy pgSeo (page-dasbor.php L26007–L26031)
 */

export interface SeoKpi {
  id: string;
  title: string;
  value: string;
  icon: string;
  trend?: string;
  trendType?: 'positive' | 'neutral' | 'negative';
}

export interface SeoBarData {
  day: string;
  label: string;
  visits: number;
}

export interface SeoKeyword {
  id: string;
  keyword: string;
  position: number;
  clicks: number;
}

export const SEO_KPIS: SeoKpi[] = [
  {
    id: 'visits-30d',
    title: 'Kunjungan 30 hari',
    value: '12.4rb',
    icon: 'fa-solid fa-chart-line',
    trend: '+14% vs periode lalu',
    trendType: 'positive',
  },
  {
    id: 'ctr',
    title: 'CTR rata-rata',
    value: '3.2%',
    icon: 'fa-solid fa-arrow-pointer',
    trend: '+0.4% rata-rata Google',
    trendType: 'positive',
  },
  {
    id: 'indexed-articles',
    title: 'Artikel terindeks',
    value: '18',
    icon: 'fa-solid fa-newspaper',
    trend: 'Terdaftar Google Search',
    trendType: 'neutral',
  },
  {
    id: 'load-time',
    title: 'Waktu muat',
    value: '2.1s',
    icon: 'fa-solid fa-bolt',
    trend: 'Optimal (LCP < 2.5s)',
    trendType: 'positive',
  },
];

/**
 * Weekly Visits Chart Data (Senin–Minggu)
 * Ported from: [['Sen',42],['Sel',58],['Rab',49],['Kam',73],['Jum',88],['Sab',64],['Min',55]]
 */
export const SEO_WEEKLY_VISITS: SeoBarData[] = [
  { day: 'Sen', label: 'Senin', visits: 42 },
  { day: 'Sel', label: 'Selasa', visits: 58 },
  { day: 'Rab', label: 'Rabu', visits: 49 },
  { day: 'Kam', label: 'Kamis', visits: 73 },
  { day: 'Jum', label: 'Jumat', visits: 88 },
  { day: 'Sab', label: 'Sabtu', visits: 64 },
  { day: 'Min', label: 'Minggu', visits: 55 },
];

/**
 * Top Search Keywords
 * Ported from: [['pesantren progresif','1',480],['ptv progresif tv','2',310],['haflah akhirussanah','5',180],['wisuda tahfidz','7',120]]
 */
export const SEO_TOP_KEYWORDS: SeoKeyword[] = [
  { id: 'kw-1', keyword: 'pesantren progresif', position: 1, clicks: 480 },
  { id: 'kw-2', keyword: 'ptv progresif tv', position: 2, clicks: 310 },
  { id: 'kw-3', keyword: 'haflah akhirussanah', position: 5, clicks: 180 },
  { id: 'kw-4', keyword: 'wisuda tahfidz', position: 7, clicks: 120 },
];
