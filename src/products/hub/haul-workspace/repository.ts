import { type Actor, type Person, type WorkItem, type WorkspaceState, type ViewSettings, type Edition, getAssignmentPersonIds } from './types';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const STORAGE_KEY = 'ptv.haul.isolated.v1';
function participants(item: WorkItem) {
  const asgnPeople = (item.crewAssignments || []).flatMap(a => getAssignmentPersonIds(a));
  return [...new Set([item.picId, ...item.memberIds, ...asgnPeople].filter(Boolean))];
}
export function conflictPairs(items: WorkItem[]) {
  const sessions = items.filter(i => i.kind === 'session' && !i.archived && i.start && i.end);
  return sessions.flatMap((a, index) => sessions.slice(index + 1).flatMap(b => {
    const people = participants(a).filter(id => participants(b).includes(id));
    return people.length && a.start < b.end && b.start < a.end ? [{ a: a.id, b: b.id, people }] : [];
  }));
}
export function selectItems(state: WorkspaceState, view: ViewSettings) {
  return state.items.filter(i => i.editionId === state.edition.id && i.archived === view.archived && (!view.kind || i.kind === view.kind) && (!view.status || i.status === view.status) && (!view.person || participants(i).includes(view.person)) && `${i.title} ${i.brief} ${i.location}`.toLocaleLowerCase('id').includes(view.search.toLocaleLowerCase('id'))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (view.sort === 'title' ? a.title.localeCompare(b.title, 'id') : view.sort === 'priority' ? ['Mendesak', 'Tinggi', 'Normal'].indexOf(a.priority) - ['Mendesak', 'Tinggi', 'Normal'].indexOf(b.priority) : (a.start || a.end || '9999').localeCompare(b.start || b.end || '9999') || a.order - b.order));
}
export class MockWorkspaceRepository {
  private state: WorkspaceState;
  constructor(seed: WorkspaceState, private people: Person[], private storage?: StoragePort) {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as WorkspaceState;
      if (parsed.version !== 1 || !Array.isArray(parsed.items) || !parsed.edition || !Array.isArray(parsed.editions) || !Array.isArray(parsed.audit) || !parsed.views) throw new Error('Data lokal tidak cocok. Ekspor data sebelum memulihkan penyimpanan.');
      this.state = parsed;
    } else this.state = structuredClone(seed);
  }
  snapshot() { return structuredClone(this.state); }
  private persist(next: WorkspaceState) { this.storage?.setItem(STORAGE_KEY, JSON.stringify(next)); this.state = next; return this.snapshot(); }
  private log(next: WorkspaceState, actor: Actor, itemId: string, action: string) { next.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actorId: actor.id, itemId, action }); }
  save(item: WorkItem, actor: Actor) {
    const old = this.state.items.find(i => i.id === item.id);
    if (old && (old.kind !== item.kind || old.editionId !== item.editionId)) throw new Error('Jenis dan edisi pekerjaan tidak dapat diubah.');
    if (old && old.revision !== item.revision) throw new Error('Data berubah. Buka ulang detail sebelum menyimpan.');
    if (actor.role !== 'coordinator') {
      if (!old || old.archived) throw new Error('Hanya koordinator dapat mengatur pekerjaan baru atau mengarsipkan.');
      // Hak edit kolaboratif: Semua kru dapat memperbarui task, konten, atau catatan kerja
      if (old.kind !== 'task' && old.kind !== 'content' && old.kind !== 'note' && !participants(old).includes(actor.personId)) {
        throw new Error('Hanya koordinator dapat mengatur acara, project, dan struktur utama.');
      }
      const allowed = new Set(['status', 'resultUrl', 'brief', 'references', 'approval']);
      for (const key of Object.keys(item) as (keyof WorkItem)[]) {
        if (!allowed.has(key) && JSON.stringify(item[key]) !== JSON.stringify(old[key])) {
          throw new Error('Kru hanya boleh mengubah status, lokasi file, keterangan, catatan, dan progres.');
        }
      }
      if (item.approval !== old.approval && item.approval !== 'Menunggu') throw new Error('Approval hanya boleh diputuskan koordinator.');
    }
    if (!item.title.trim()) throw new Error('Judul wajib diisi.');
    if (item.editionId !== this.state.edition.id) throw new Error('Edisi tidak cocok.');
    for (const id of participants(item)) if (!this.people.some(p => p.id === id)) throw new Error('Kru tidak ditemukan pada master personel.');
    if (!Number.isFinite(item.order)) throw new Error('Urutan tidak valid.');
    for (const value of [item.start, item.end, item.publishAt].filter(Boolean)) if (!Number.isFinite(Date.parse(value))) throw new Error('Tanggal tidak valid.');
    if (item.start && item.end && item.start > item.end) throw new Error('Waktu selesai harus setelah mulai.');
    if (item.kind === 'session' && (!item.start || !item.end || item.start >= item.end || item.eventIds.length !== 1)) throw new Error('Rundown wajib memiliki satu acara dan rentang waktu yang valid.');
    if (item.resultUrl && item.resultUrl.length > 1000) throw new Error('Lokasi file terlalu panjang.');
    const ref = (id: string, kind?: string) => this.state.items.some(i => i.id === id && i.id !== item.id && i.editionId === item.editionId && !i.archived && (!kind || i.kind === kind));
    if (item.eventIds.some(id => !ref(id, 'event')) || (item.projectId && !ref(item.projectId, 'project')) || (item.parentId && !ref(item.parentId, 'task')) || item.dependencyIds.some(id => !ref(id, 'task'))) throw new Error('Relasi tidak valid atau sudah diarsipkan.');
    const nextItems = this.state.items.filter(i => i.id !== item.id).concat(item);
    const reaches = (id: string, target: string, seen = new Set<string>()): boolean => {
      if (id === target) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const node = nextItems.find(i => i.id === id);
      return Boolean(node && [...node.dependencyIds, node.parentId].filter(Boolean).some(x => reaches(x, target, seen)));
    };
    if ([...item.dependencyIds, item.parentId].filter(Boolean).some(id => reaches(id, item.id))) throw new Error('Dependency atau subtugas membentuk siklus.');
    if (item.status === 'Selesai' && item.dependencyIds.some(id => nextItems.find(i => i.id === id)?.status !== 'Selesai')) throw new Error('Selesaikan dependency terlebih dahulu.');
    if (item.archived && this.state.items.some(i => !i.archived && i.id !== item.id && [...i.eventIds, i.projectId, i.parentId, ...i.dependencyIds].includes(item.id))) throw new Error('Arsipkan atau pindahkan pekerjaan terkait terlebih dahulu.');
    if (!item.archived && conflictPairs(nextItems).some(c => c.a === item.id || c.b === item.id)) throw new Error('Bentrok penugasan kru. Ubah waktu atau personel.');
    const next = this.snapshot();
    next.items = next.items.filter(i => i.id !== item.id).concat({ ...item, title: item.title.trim(), revision: item.revision + 1 });
    this.log(next, actor, item.id, old ? item.archived !== old.archived ? item.archived ? 'Diarsipkan' : 'Dipulihkan' : 'Diperbarui' : 'Ditambahkan');
    return this.persist(next);
  }
  saveEdition(edition: Edition, actor: Actor) {
    if (actor.role !== 'coordinator') throw new Error('Hanya koordinator dapat mengatur edisi.');
    if (!edition.title.trim() || !edition.start || !edition.end || edition.start > edition.end || !Number.isFinite(Date.parse(edition.start)) || !Number.isFinite(Date.parse(edition.end))) throw new Error('Judul dan periode edisi wajib valid.');
    const next = this.snapshot(); next.edition = { ...edition }; next.editions = next.editions.filter(e => e.id !== edition.id).concat(edition); this.log(next, actor, edition.id, 'Edisi diperbarui'); return this.persist(next);
  }
  selectEdition(id: string) { const next = this.snapshot(); const edition = next.editions.find(e => e.id === id); if (!edition) throw new Error('Edisi tidak ditemukan.'); next.edition = edition; return this.persist(next); }
  saveView(view: ViewSettings, actor: Actor) {
    if (!view.name.trim()) throw new Error('Nama tampilan wajib diisi.');
    const next = this.snapshot(); next.views[actor.id] = [...(next.views[actor.id] || []).filter(v => v.name !== view.name), view]; return this.persist(next);
  }
}
