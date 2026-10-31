import type { CrewMember, CrewFilterParams, CrewStats, LoginHistoryItem } from './types';
import type { AcaraCrewMember } from '@products/hub/acara/types';

export interface CreatedAccountCredentials {
  username: string;
  temporary_password: string;
  full_name: string;
  ptv_id: string;
  must_change_password: boolean;
}

export interface IKruService {
  getCrewList(filters?: CrewFilterParams, forceRefresh?: boolean): Promise<CrewMember[]>;
  getCrewByPtvId(ptvId: string): Promise<CrewMember | null>;
  getStats(): Promise<CrewStats>;
  getLoginHistory(): Promise<LoginHistoryItem[]>;
  getActiveCrewCandidates(): Promise<AcaraCrewMember[]>;
  createCrew(data: Omit<CrewMember, 'id'>): Promise<CrewMember>;
  updateCrew(id: string, updates: Partial<CrewMember>): Promise<CrewMember>;
  createAccountByRoot(crewId: string): Promise<{ success: boolean; message: string; credentials: CreatedAccountCredentials; crew: CrewMember }>;
  toggleAccountStatus(crewId: string, currentAccountStatus?: string): Promise<{ success: boolean; message: string; crew: CrewMember; status_akun: string }>;
  resetPasswordByRoot(crewId: string, newPassword: string, reason?: string): Promise<{ success: boolean; message: string }>;
  updateUsernameByRoot(crewId: string, newUsername: string): Promise<{ success: boolean; message: string; crew: CrewMember; username: string }>;
  uploadAvatar(base64Data: string, ptvId?: string): Promise<string>;
}

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || `Permintaan Kru gagal (HTTP ${res.status}).`);
  return body;
}

export function personnelFields(data: Partial<CrewMember>) {
  const keys = [
    'version',
    'ptv_id',
    'full_name',
    'category',
    'division',
    'position',
    'angkatan',
    'nim',
    'jurusan',
    'birth_date',
    'tanggal_lahir',
    'address',
    'alamat',
    'phone',
    'email',
    'foto_url',
    'status_kru',
  ] as const;
  return Object.fromEntries(keys.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
}

export class StagingKruService implements IKruService {
  async fetchFromBackend(_forceRefresh = false): Promise<{ crew: CrewMember[]; stats: CrewStats }> {
    const body = await request('/api/kru');
    return {
      crew: body.crew || [],
      stats: body.stats || {
        total: (body.crew || []).length,
        aktif: (body.crew || []).filter((c: CrewMember) => c.status_kru === 'Aktif').length,
        nonaktif: (body.crew || []).filter((c: CrewMember) => c.status_kru === 'Nonaktif').length,
      },
    };
  }

  async getCrewList(filters?: CrewFilterParams, forceRefresh = false): Promise<CrewMember[]> {
    const { crew } = await this.fetchFromBackend(forceRefresh);
    if (!filters) return crew;
    return crew.filter((m) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = m.full_name?.toLowerCase().includes(q);
        const matchPtvId = m.ptv_id?.toLowerCase().includes(q);
        const matchUsername = m.username?.toLowerCase().includes(q);
        if (!matchName && !matchPtvId && !matchUsername) return false;
      }
      if (filters.division && filters.division !== 'Semua' && m.division !== filters.division) return false;
      if (filters.categoryTab && filters.categoryTab !== 'Semua') {
        if (filters.categoryTab === 'Aktif' || filters.categoryTab === 'Nonaktif') {
          if (m.status_kru !== filters.categoryTab) return false;
        } else {
          if (m.category !== filters.categoryTab) return false;
        }
      }
      return true;
    });
  }

  async getCrewByPtvId(ptvId: string): Promise<CrewMember | null> {
    const list = await this.getCrewList();
    return list.find((m) => m.ptv_id.toLowerCase() === ptvId.toLowerCase()) || null;
  }

  async getStats(): Promise<CrewStats> {
    const { stats } = await this.fetchFromBackend();
    return stats;
  }

  async getLoginHistory(): Promise<LoginHistoryItem[]> {
    try {
      const body = await request('/api/kru?view=login_history');
      return body.history || [];
    } catch {
      return [];
    }
  }

  async getActiveCrewCandidates(): Promise<AcaraCrewMember[]> {
    const list = await this.getCrewList();
    return list
      .filter((m) => m.status_kru === 'Aktif')
      .map((m) => ({
        id: m.id,
        ptv_id: m.ptv_id,
        name: m.full_name,
        job: m.position || m.division || 'Kru',
        role: m.position || m.division || 'Kru',
        division: m.division || 'Umum',
        photo: m.foto_url,
      }));
  }

  async createCrew(data: Omit<CrewMember, 'id'>): Promise<CrewMember> {
    return (await request('/api/kru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personnelFields(data)),
    })).crew;
  }

  async updateCrew(id: string, updates: Partial<CrewMember>): Promise<CrewMember> {
    return (await request(`/api/kru?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personnelFields(updates)),
    })).crew;
  }

  async createAccountByRoot(crewId: string): Promise<{ success: boolean; message: string; credentials: CreatedAccountCredentials; crew: CrewMember }> {
    return await request(`/api/kru?id=${encodeURIComponent(crewId)}&action=create_account`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_account', id: crewId }),
    });
  }

  async toggleAccountStatus(crewId: string, currentAccountStatus?: string) {
    const nextStatus = currentAccountStatus === 'Aktif' ? 'inactive' : 'active';
    return await request(`/api/kru?id=${encodeURIComponent(crewId)}&action=toggle_account`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_account', id: crewId, status_akun: nextStatus }),
    });
  }

  async resetPasswordByRoot(crewId: string, newPassword: string, reason?: string) {
    return await request(`/api/kru?id=${encodeURIComponent(crewId)}&action=reset_password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', id: crewId, newPassword, reason }),
    });
  }

  async updateUsernameByRoot(crewId: string, newUsername: string) {
    return await request(`/api/kru?id=${encodeURIComponent(crewId)}&action=update_username`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_username', id: crewId, username: newUsername }),
    });
  }

  async uploadAvatar(base64Data: string, ptvId?: string): Promise<string> {
    const body = await request('/api/upload-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64Data, ptv_id: ptvId }),
    });
    return body.url;
  }
}

let instance: IKruService | null = null;
export function getKruService(): IKruService {
  return instance ||= new StagingKruService();
}
