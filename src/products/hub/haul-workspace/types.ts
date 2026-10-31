export const kinds = ['event', 'project', 'task', 'session', 'content', 'note', 'reminder'] as const;
export type Kind = typeof kinds[number];
export type Status = 'Rencana' | 'Dikerjakan' | 'Review' | 'Selesai';
export interface Person { id: string; name: string }
export interface Actor { id: string; personId: string; role: 'coordinator' | 'crew' }
export interface Edition { id: string; title: string; start: string; end: string }

export interface CrewAssignment {
  id?: string;
  position: string;
  personIds?: string[];
  personId?: string;
  notes?: string;
}

export function getAssignmentPersonIds(asgn: CrewAssignment): string[] {
  if (Array.isArray(asgn.personIds) && asgn.personIds.length > 0) {
    return asgn.personIds;
  }
  if (asgn.personId) {
    return [asgn.personId];
  }
  return [];
}

export interface WorkItem {
  id: string; editionId: string; kind: Kind; title: string; brief: string;
  eventIds: string[]; projectId: string; parentId: string; dependencyIds: string[];
  picId: string; memberIds: string[]; priority: 'Normal' | 'Tinggi' | 'Mendesak';
  status: Status; start: string; end: string; location: string; position: string;
  format: string; platform: string; publishAt: string; resultUrl: string;
  references: string; approval: 'Belum diajukan' | 'Menunggu' | 'Disetujui' | 'Revisi';
  pinned: boolean; archived: boolean; order: number; revision: number;
  crewAssignments?: CrewAssignment[];
}
export type ViewMode = 'List' | 'Calendar' | 'By Project' | 'By Person' | 'By Event';
export interface ViewSettings { name: string; mode: ViewMode; kind: Kind | ''; search: string; status: string; person: string; sort: 'date' | 'title' | 'priority'; archived: boolean }
export interface AuditEntry { id: string; at: string; actorId: string; itemId: string; action: string }
export interface WorkspaceState { version: 1; edition: Edition; editions: Edition[]; items: WorkItem[]; audit: AuditEntry[]; views: Record<string, ViewSettings[]> }
export const labels: Record<Kind, string> = { event: 'Acara', project: 'Project', task: 'Task', session: 'Rundown', content: 'Konten', note: 'Catatan', reminder: 'Reminder' };
export const defaultView: ViewSettings = { name: '', mode: 'List', kind: '', search: '', status: '', person: '', sort: 'date', archived: false };
export function emptyItem(kind: Kind, editionId: string): WorkItem {
  return {
    id: crypto.randomUUID(), editionId, kind, title: '', brief: '', eventIds: [], projectId: '', parentId: '',
    dependencyIds: [], picId: '', memberIds: [], priority: 'Normal', status: 'Rencana', start: '', end: '',
    location: '', position: '', format: '', platform: '', publishAt: '', resultUrl: '', references: '',
    approval: 'Belum diajukan', pinned: false, archived: false, order: 0, revision: 0, crewAssignments: [],
  };
}
