export const ACARA_COLORS = [
  { value: 'biru', label: 'Biru', color: '#1273E6' },
  { value: 'ungu', label: 'Ungu', color: '#7C3AED' },
  { value: 'hijau', label: 'Hijau', color: '#15803D' },
  { value: 'oranye', label: 'Oranye', color: '#C2410C' },
  { value: 'kuning', label: 'Kuning', color: '#A16207' },
  { value: 'pink', label: 'Pink', color: '#BE185D' },
  { value: 'merah', label: 'Merah', color: '#DC2626' },
  { value: 'toska', label: 'Toska', color: '#0F766E' },
  { value: 'abu-abu', label: 'Abu-abu', color: '#64748B' },
] as const;

export type AcaraColor = typeof ACARA_COLORS[number]['value'];

export function normalizeAcaraColor(value: unknown): AcaraColor {
  return ACARA_COLORS.find((preset) => preset.value === value)?.value ?? 'biru';
}

export function acaraColorStyle(value: unknown) {
  const preset = ACARA_COLORS.find((item) => item.value === normalizeAcaraColor(value))!;
  return { '--acara-accent': preset.color } as import('react').CSSProperties;
}
