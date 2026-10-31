export const PLATFORMS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'Website',
  'Live Event',
  'Internal',
  'Lainnya',
] as const;

export const KONTRIBUSI_TYPES = [
  'Kamera',
  'Editing',
  'Desain Grafis',
  'Dokumentasi',
  'Live Streaming',
  'Switcher',
  'Floor Director',
  'Penulisan',
  'Publikasi',
  'Lainnya',
] as const;

export interface PortfolioItem {
  id: string;
  identity_id?: string;
  ptv_id: string;
  tanggal: string;
  platform: string;
  jenis_kontribusi: string;
  judul: string;
  link_karya?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export const crewPortfolioService = {
  async getCrewPortfolio(ptvId: string): Promise<PortfolioItem[]> {
    try {
      const res = await fetch(`/api/portofolio?ptv_id=${encodeURIComponent(ptvId)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  },

  async getMyPortfolio(): Promise<PortfolioItem[]> {
    try {
      const res = await fetch('/api/portofolio?mine=true', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  },

  async savePortfolioItem(item: Partial<PortfolioItem>): Promise<PortfolioItem> {
    const res = await fetch('/api/portofolio', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(item),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.error || 'Gagal menyimpan portofolio karya.');
    }
    return body.item;
  },

  async deletePortfolioItem(id: string): Promise<void> {
    const res = await fetch(`/api/portofolio?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.error || 'Gagal menghapus portofolio.');
    }
  },
};
