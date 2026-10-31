import { ptvCache } from '@core/cache/ptvCache';
import { useState, useEffect } from 'react';
import { PtvDocument, INITIAL_DOCS_FIXTURES } from './mock/docsMockData';
import { notificationService } from '../shell/notificationService';
import { calculateNextLetterNumber } from './utils/letterNumbering';

const STORAGE_KEY = 'ptv_shared_docs_store_v2';

class DocsStore {
  private docs: PtvDocument[] = [];
  private listeners: Set<() => void> = new Set();

  private scope = ptvCache.getScopeToken();

  constructor() {
    this.load();
    ptvCache.subscribe(() => {
      const scope = ptvCache.getScopeToken();
      if (scope === this.scope) return;
      this.scope = scope;
      this.docs = [];
      this.load();
      this.notify();
    });
  }

  private storageKey() {
    return `${STORAGE_KEY}_${this.scope.replace(/:\d+$/, '')}`;
  }


  private load() {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(this.storageKey());
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            this.docs = parsed;
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load docs from localStorage', e);
    }
    this.docs = import.meta.env.MODE === 'test' || import.meta.env.VITE_AUTH_BACKEND === 'mock' ? [...INITIAL_DOCS_FIXTURES] : [];
  }

  public setLiveDocs(liveDocs: PtvDocument[]) {
    if (Array.isArray(liveDocs)) {
      this.docs = [...liveDocs];
      this.save();
    }
  }

  private save() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.storageKey(), JSON.stringify(this.docs));
      }
    } catch (e) {
      console.warn('Failed to save docs to localStorage', e);
    }
    this.notify();
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

  public getAll(): PtvDocument[] {
    return [...this.docs];
  }

  public getById(id: string): PtvDocument | undefined {
    return this.docs.find((d) => d.id === id);
  }

  public addLiveDoc(doc: PtvDocument): PtvDocument {
    this.docs = [doc, ...this.docs.filter((d) => d.id !== doc.id)];
    this.save();
    return doc;
  }

  public requestDoc(
    data: Omit<PtvDocument, 'id' | 'created_at' | 'status' | 'no'> & {
      id?: string;
      status?: PtvDocument['status'];
      no?: string;
    }
  ): PtvDocument {
    const nowIso = new Date().toISOString();
    const newId = data.id || `doc-${Date.now().toString().slice(-4)}`;
    const status = data.status || 'Menunggu';
    const isApproved = status === 'Disetujui';
    const officialNo = isApproved ? (data.no || '—') : '—';
    const newDoc: PtvDocument = {
      ...data,
      id: newId,
      no: officialNo,
      status,
      created_at: nowIso,
      status_history: [
        ...(data.status_history || []),
        {
          status,
          timestamp: nowIso,
          actor: data.owner || 'Pemohon',
          note: isApproved ? 'Penerbitan dokumen disetujui langsung' : `Pengajuan ${data.type || 'dokumen'} baru`,
        },
      ],
    };

    this.docs.unshift(newDoc);
    this.save();
    return newDoc;
  }

  public approveDoc(id: string, note?: string, actor?: string): PtvDocument | null {
    const doc = this.getById(id);
    if (!doc) return null;

    let officialNo = doc.no;
    // Idempotent: jika sudah memiliki nomor resmi yang sah, jangan ubah atau terbitkan nomor baru
    if (!officialNo || officialNo === '—' || officialNo.includes('Menunggu') || officialNo.startsWith('DRAFT')) {
      const effectiveDate = doc.date || doc.start_date || new Date().toISOString().slice(0, 10);
      let typeTag: 'SI' | 'ST' | 'SBB' = 'ST';
      if (doc.type.includes('Barang')) typeTag = 'SBB';
      else if (doc.type.includes('Izin')) typeTag = 'SI';

      const allocated = calculateNextLetterNumber(this.docs, typeTag, effectiveDate);
      officialNo = allocated.nomor_surat;
    }

    const nowIso = new Date().toISOString();
    const history = doc.status_history ? [...doc.status_history] : [];
    history.push({
      status: 'Disetujui',
      timestamp: nowIso,
      actor: actor || 'Pimpinan Eksekutif PTV',
      note: note || 'Disetujui & nomor surat resmi diterbitkan',
    });

    const updated = this.updateDoc(id, {
      status: 'Disetujui',
      no: officialNo,
      approved_at: nowIso,
      updated_at: nowIso,
      review_note: note || undefined,
      status_history: history,
    });

    if (updated) {
      notificationService.notifyDocApproved({
        id: updated.id,
        no: updated.no,
        title: updated.subject,
        applicant_ptv_id: updated.diajukan_oleh || updated.owner,
        type: updated.type,
      });
    }

    return updated;
  }

  public requestRevision(id: string, reviewNote: string, actor?: string): PtvDocument | null {
    const doc = this.getById(id);
    if (!doc) return null;

    const nowIso = new Date().toISOString();
    const history = doc.status_history ? [...doc.status_history] : [];
    history.push({
      status: 'Revisi',
      timestamp: nowIso,
      actor: actor || 'Pimpinan Eksekutif PTV',
      note: reviewNote,
    });

    return this.updateDoc(id, {
      status: 'Revisi',
      review_note: reviewNote,
      updated_at: nowIso,
      status_history: history,
    });
  }

  public resubmitDoc(id: string, updates: Partial<PtvDocument>, actor?: string): PtvDocument | null {
    const doc = this.getById(id);
    if (!doc) return null;

    const nowIso = new Date().toISOString();
    const history = doc.status_history ? [...doc.status_history] : [];
    history.push({
      status: 'Menunggu',
      timestamp: nowIso,
      actor: actor || doc.owner || 'Pemohon',
      note: 'Pengajuan telah diperbaiki dan diajukan ulang untuk review',
    });

    return this.updateDoc(id, {
      ...updates,
      status: 'Menunggu',
      updated_at: nowIso,
      status_history: history,
    });
  }

  public rejectDoc(id: string, reviewNote?: string, actor?: string): PtvDocument | null {
    const doc = this.getById(id);
    if (!doc) return null;

    const nowIso = new Date().toISOString();
    const history = doc.status_history ? [...doc.status_history] : [];
    history.push({
      status: 'Ditolak',
      timestamp: nowIso,
      actor: actor || 'Pimpinan Eksekutif PTV',
      note: reviewNote || 'Pengajuan perizinan ditolak',
    });

    return this.updateDoc(id, {
      status: 'Ditolak',
      review_note: reviewNote,
      updated_at: nowIso,
      status_history: history,
    });
  }

  public deleteDoc(id: string): boolean {
    const initialLen = this.docs.length;
    this.docs = this.docs.filter((d) => d.id !== id);
    if (this.docs.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public updateDoc(id: string, updates: Partial<PtvDocument>): PtvDocument | null {
    const idx = this.docs.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.docs[idx] = {
      ...this.docs[idx],
      ...updates,
    };
    this.save();
    return this.docs[idx];
  }
}

export const docsStore = new DocsStore();

export function useDocsStore() {
  const [docs, setDocs] = useState<PtvDocument[]>(() => docsStore.getAll());

  useEffect(() => {
    return docsStore.subscribe(() => {
      setDocs(docsStore.getAll());
    });
  }, []);

  return {
    docs,
    getById: (id: string) => docsStore.getById(id),
    requestDoc: (
      data: Omit<PtvDocument, 'id' | 'created_at' | 'status' | 'no'> & {
        id?: string;
        status?: PtvDocument['status'];
        no?: string;
      }
    ) => docsStore.requestDoc(data),
    approveDoc: (id: string, note?: string, actor?: string) => docsStore.approveDoc(id, note, actor),
    requestRevision: (id: string, note: string, actor?: string) => docsStore.requestRevision(id, note, actor),
    resubmitDoc: (id: string, updates: Partial<PtvDocument>, actor?: string) => docsStore.resubmitDoc(id, updates, actor),
    rejectDoc: (id: string, note?: string, actor?: string) => docsStore.rejectDoc(id, note, actor),
    deleteDoc: (id: string) => docsStore.deleteDoc(id),
    updateDoc: (id: string, updates: Partial<PtvDocument>) => docsStore.updateDoc(id, updates),
    setLiveDocs: (liveDocs: PtvDocument[]) => docsStore.setLiveDocs(liveDocs),
    addLiveDoc: (doc: PtvDocument) => docsStore.addLiveDoc(doc),
  };
}

