import { useState, useEffect } from 'react';
import { CrewMember, CrewAngkatanGroup, CrewRole } from './types';
import { AccessProfile, AppCapability } from '@core/policy';
import { getKruService } from './kruService';
import { useSessionStore } from '@core/session';
import { INITIAL_CREW_FIXTURES } from './mock/crewMockData';
import { ptvCache } from '@core/cache/ptvCache';

export function formatAngkatanDisplay(ang: string | number | undefined, c?: { full_name?: string; name?: string; ptv_id?: string }): string {
  const cName = ((c && (c.full_name || c.name)) || '').toLowerCase();
  const cPid = ((c && c.ptv_id) || '').toUpperCase();
  const raw = String(ang || '').trim();

  if (raw.toLowerCase() === 'additional' || cPid === 'PTV-017' || cPid === 'PTV-018' || cName.includes('kru testing') || cName.includes('niki santri')) {
    return 'Additional';
  }
  if (!raw || raw.toLowerCase() === 'tidak diketahui') {
    return 'Angkatan belum ditentukan';
  }
  const lower = raw.toLowerCase();
  if (lower === 'internship') return 'Internship';
  if (lower === 'pembina') return 'Pembina';
  if (lower === 'pengarah') return 'Pengarah';
  if (lower.startsWith('angkatan')) return raw;
  return 'Angkatan ' + raw;
}

export function groupCrewByAngkatan(crewList: CrewMember[]): CrewAngkatanGroup[] {
  const groups: Record<string, CrewMember[]> = {};

  (crewList || []).forEach((c) => {
    if (!c) return;
    const label = formatAngkatanDisplay(c.angkatan, c);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });

  // Urutkan angkatan secara descending persis legacy page-dasbor.php L22129-22140
  const sortedLabels = Object.keys(groups).sort((a, b) => {
    if (a === 'Angkatan belum ditentukan') return 1;
    if (b === 'Angkatan belum ditentukan') return -1;
    if (a === 'Additional') return 1;
    if (b === 'Additional') return -1;
    if (a === 'Internship') return 1;
    if (b === 'Internship') return -1;
    if (a === 'Pembina') return 1;
    if (b === 'Pembina') return -1;
    if (a === 'Pengarah') return 1;
    if (b === 'Pengarah') return -1;

    const numA = parseInt(a.replace(/[^\d]/g, ''), 10);
    const numB = parseInt(b.replace(/[^\d]/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return a.localeCompare(b, 'id');
  });

  return sortedLabels.map((label) => {
    let icon = 'fa-solid fa-graduation-cap';
    if (label === 'Additional') {
      icon = 'fa-solid fa-user-plus';
    } else if (label === 'Internship') {
      icon = 'fa-solid fa-user-clock';
    } else if (label === 'Pembina' || label === 'Pengarah') {
      icon = 'fa-solid fa-user-tie';
    } else if (label === 'Angkatan belum ditentukan') {
      icon = 'fa-solid fa-circle-question';
    }

    return {
      label,
      icon,
      members: groups[label] || [],
    };
  });
}

class CrewStore {
  private assertTestHarness(): void {
    if (import.meta.env.MODE !== 'test') throw new Error('Mutasi lokal dinonaktifkan. Gunakan layanan backend Kru atau Manajemen Akses.');
  }
  private members: CrewMember[] = [];
  private loading = false;
  private initialized = false;
  private error: string | null = null;
  private listeners: Set<() => void> = new Set();

  private scope = ptvCache.getScopeToken();
  private requestId = 0;

  constructor() {
    this.members = ptvCache.get<CrewMember[]>('crew_members_list')?.data || [];
    ptvCache.subscribe(() => {
      const scope = ptvCache.getScopeToken();
      if (scope === this.scope) return;
      this.scope = scope;
      ++this.requestId;
      this.members = [];
      this.error = null;
      this.notify();
      void this.init(true);
    });
    void this.init();
  }

  public async init(_forceRefresh = false) {
    const scope = ptvCache.getScopeToken();
    const requestId = ++this.requestId;
    this.loading = this.members.length === 0;
    this.error = null;
    this.notify();
    try {
      const list = await getKruService().getCrewList();
      if (scope !== ptvCache.getScopeToken() || requestId !== this.requestId) return;
      this.members = list;
      ptvCache.set('crew_members_list', list, 30 * 60 * 1000);
    } catch (err: any) {
      if (scope !== ptvCache.getScopeToken() || requestId !== this.requestId) return;
      this.members = [];
      this.error = err.message || 'Gagal memuat data kru.';
    } finally {
      if (scope === ptvCache.getScopeToken() && requestId === this.requestId) {
        this.loading = false;
        this.notify();
      }
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getAll(): CrewMember[] {
    return [...this.members];
  }

  public getById(id: string): CrewMember | undefined {
    return this.members.find((m) => m.id === id || m.ptv_id === id);
  }

  public isLoading(): boolean {
    return this.loading;
  }

  public getError(): string | null {
    return this.error;
  }

  public getCurrentUser(): CrewMember {
    // Check current logged-in user from useSessionStore if available
    try {
      const sessionUser = useSessionStore.getState().user;
      const targetPtvId = sessionUser?.ptv_id || (sessionUser as any)?.identity?.ptv_id;
      if (targetPtvId) {
        const found = this.members.find(
          (m) => m.ptv_id.toLowerCase() === targetPtvId.toLowerCase()
        );
        if (found) return found;
      }
    } catch {
      // Ignore if session store not ready
    }

    return { id: '', ptv_id: '', full_name: '', username: '', role: 'kru', category: 'Kru', division: '', position: '', angkatan: '', status_kru: 'Nonaktif', status_akun: 'Belum Ada Akun' };
  }

  public async refresh(): Promise<void> {
    await this.init(true);
  }

  // Legacy in-memory harness; runtime writes must use the authenticated backend service.
  public addCrew(data: Omit<CrewMember, 'id'>): CrewMember {
    this.assertTestHarness();
    const newId = `crw-${Date.now().toString(36)}`;
    const newMember: CrewMember = {
      ...data,
      id: newId,
      join_date: data.join_date || new Date().toISOString().substring(0, 10),
    };
    this.members = [newMember, ...this.members];
    this.notify();
    return newMember;
  }

  public updateCrew(id: string, updates: Partial<CrewMember>): CrewMember | null {
    this.assertTestHarness();
    const idx = this.members.findIndex((m) => m.id === id || m.ptv_id === id);
    if (idx === -1) return null;
    this.members[idx] = {
      ...this.members[idx],
      ...updates,
    };
    this.notify();
    return this.members[idx];
  }

  public toggleCrewStatus(id: string): CrewMember | null {
    const member = this.getById(id);
    if (!member) return null;
    const nextStatus = member.status_kru === 'Aktif' ? 'Nonaktif' : 'Aktif';
    return this.updateCrew(id, { status_kru: nextStatus });
  }

  public activateAccount(id: string): CrewMember | null {
    const member = this.getById(id);
    if (!member) return null;
    const username = member.username || member.full_name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.updateCrew(id, {
      username: username || `kru_${member.ptv_id.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      status_akun: 'Aktif',
    });
  }

  public updateOAuthEmail(id: string, email: string): CrewMember | null {
    if (!email) {
      return this.updateCrew(id, {
        oauth_email: undefined,
        oauth_uid: undefined,
        oauth_provider: undefined,
      });
    }
    return this.updateCrew(id, {
      oauth_email: email,
      oauth_uid: `goog-uid-${id}`,
      oauth_provider: 'google',
    });
  }

  public deleteCrew(id: string): boolean {
    this.assertTestHarness();
    const initialLen = this.members.length;
    this.members = this.members.filter((m) => m.id !== id && m.ptv_id !== id);
    if (this.members.length !== initialLen) {
      this.notify();
      return true;
    }
    return false;
  }

  public updateCrewPermissions(
    id: string,
    updates: {
      assigned_profiles: readonly AccessProfile[];
      allowed_overrides: readonly AppCapability[];
      denied_overrides: readonly AppCapability[];
      role?: CrewRole;
    }
  ): CrewMember | null {
    const member = this.getById(id);
    if (!member) return null;

    return this.updateCrew(id, {
      assigned_profiles: updates.assigned_profiles,
      allowed_overrides: updates.allowed_overrides,
      denied_overrides: updates.denied_overrides,
      role: updates.role || member.role,
    });
  }

  public getSuggestedNextPtvId(): string {
    const numbers = this.members
      .map((m) => {
        const match = m.ptv_id.match(/PTV-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `PTV-${String(max + 1).padStart(3, '0')}`;
  }

  public isInitialized(): boolean { return this.initialized; }

  public resetToFixtures(): void {
    this.assertTestHarness();
    this.members = [...INITIAL_CREW_FIXTURES];
    this.loading = false;
    this.error = null;
    this.notify();
  }
}

export const crewStore = new CrewStore();

export function useCrewStore() {
  const [members, setMembers] = useState<CrewMember[]>(crewStore.getAll());
  const [loading, setLoading] = useState<boolean>(crewStore.isLoading());
  const [error, setError] = useState<string | null>(crewStore.getError());

  useEffect(() => {
    // Initial fetch if store not yet populated
    if (members.length === 0 && !crewStore.isLoading()) {
      crewStore.init();
    }

    const unsubscribe = crewStore.subscribe(() => {
      setMembers(crewStore.getAll());
      setLoading(crewStore.isLoading());
      setError(crewStore.getError());
    });
    return unsubscribe;
  }, [members.length]);

  return {
    members,
    loading,
    error,
    refreshCrew: () => crewStore.refresh(),
    getCurrentUser: () => crewStore.getCurrentUser(),
    getById: (id: string) => crewStore.getById(id),
    addCrew: (data: Omit<CrewMember, 'id'>) => crewStore.addCrew(data),
    updateCrew: (id: string, updates: Partial<CrewMember>) => crewStore.updateCrew(id, updates),
    toggleCrewStatus: (id: string) => crewStore.toggleCrewStatus(id),
    activateAccount: (id: string) => crewStore.activateAccount(id),
    updateOAuthEmail: (id: string, email: string) => crewStore.updateOAuthEmail(id, email),
    deleteCrew: (id: string) => crewStore.deleteCrew(id),
    updateCrewPermissions: (
      id: string,
      updates: {
        assigned_profiles: readonly AccessProfile[];
        allowed_overrides: readonly AppCapability[];
        denied_overrides: readonly AppCapability[];
        role?: CrewRole;
      }
    ) => crewStore.updateCrewPermissions(id, updates),
    getSuggestedNextPtvId: () => crewStore.getSuggestedNextPtvId(),
  };
}
