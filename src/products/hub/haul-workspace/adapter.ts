import {
  type Actor,
  type Edition,
  type Person,
  type ViewSettings,
  type WorkItem,
  type WorkspaceState,
} from './types';
import { MockWorkspaceRepository } from './repository';

export interface WorkspaceRepository {
  snapshot(): WorkspaceState;
  save(item: WorkItem, actor: Actor): WorkspaceState;
  saveEdition(edition: Edition, actor: Actor): WorkspaceState;
  selectEdition(id: string): WorkspaceState;
  saveView(view: ViewSettings, actor: Actor): WorkspaceState;
  isProduction(): boolean;
  getBackendNotice(): string | null;
}

/**
 * Repository terisolasi untuk simulasi dev/testing lokal dengan persistensi opsional.
 */
export class IsolatedMockRepository
  extends MockWorkspaceRepository
  implements WorkspaceRepository
{
  isProduction(): boolean {
    return false;
  }

  getBackendNotice(): string | null {
    return 'Mode simulasi terisolasi · Perubahan tersimpan di browser ini.';
  }
}

/**
 * Adapter production untuk runtime PTV Hub.
 * Memisahkan state operasional nyata dari localStorage browser.
 * Selama migrasi ptv_haul belum dieksekusi di Supabase, adapter ini
 * beroperasi secara in-memory read/preview aman dan mencegah klaim palsu integrasi cloud.
 */
export class ProductionDraftRepository implements WorkspaceRepository {
  private inMemoryStore: MockWorkspaceRepository;

  constructor(seed: WorkspaceState, people: Person[]) {
    // In-memory saja, DILARANG menulis ke localStorage browser sebagai data production!
    this.inMemoryStore = new MockWorkspaceRepository(seed, people);
  }

  isProduction(): boolean {
    return true;
  }

  getBackendNotice(): string | null {
    return 'Penyimpanan Database Cloud Tertunda — Skema ptv_haul menunggu migrasi staging Supabase. Workspace beroperasi dalam mode pratinjau aman tanpa mutasi database.';
  }

  snapshot(): WorkspaceState {
    return this.inMemoryStore.snapshot();
  }

  save(item: WorkItem, actor: Actor): WorkspaceState {
    return this.inMemoryStore.save(item, actor);
  }

  saveEdition(edition: Edition, actor: Actor): WorkspaceState {
    return this.inMemoryStore.saveEdition(edition, actor);
  }

  selectEdition(id: string): WorkspaceState {
    return this.inMemoryStore.selectEdition(id);
  }

  saveView(view: ViewSettings, actor: Actor): WorkspaceState {
    return this.inMemoryStore.saveView(view, actor);
  }
}
