import { useState, useEffect } from 'react';
import { InternalContact } from './types';
import { INITIAL_INTERNAL_CONTACTS } from './mock/internalContactMockData';
import { useCrewStore, crewStore } from '../kru/kruStore';

const STORAGE_KEY = 'ptv_internal_contacts_store_v2';

function loadStoredContacts(): InternalContact[] {
  if (typeof window === 'undefined') return INITIAL_INTERNAL_CONTACTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContacts(items: InternalContact[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save internal contacts:', err);
  }
}

type InternalContactListener = (contacts: InternalContact[]) => void;

class InternalContactStoreManager {
  private contacts: InternalContact[] = loadStoredContacts();
  private listeners: Set<InternalContactListener> = new Set();

  constructor() {
    // Sinkronisasi otomatis saat crew store bermutasi
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'ptv_crew_store' || e.key === STORAGE_KEY) {
          this.notify();
        }
      });
    }
  }

  public subscribe(listener: InternalContactListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    const current = this.getAll();
    this.listeners.forEach((fn) => fn(current));
  }

  /**
   * Mengambil seluruh kontak dengan sinkronisasi reaktif ke Crew Master jika ada crew_id / ptv_id
   */
  public getAll(): InternalContact[] {
    const crewMembers = crewStore.getAll();
    const crewById = new Map(crewMembers.map((c) => [c.id, c]));
    const crewByPtvId = new Map(crewMembers.map((c) => [c.ptv_id, c]));

    return this.contacts.map((contact) => {
      const crew = (contact.crew_id ? crewById.get(contact.crew_id) : null) ||
                   (contact.ptv_id ? crewByPtvId.get(contact.ptv_id) : null);
      if (!crew) return contact;

      // Sinkronkan nama, posisi, telepon, email, foto dari data kru master
      return {
        ...contact,
        full_name: crew.full_name || contact.full_name,
        position: crew.position || contact.position,
        phone: crew.phone || contact.phone,
        email: crew.email || contact.email,
        foto_url: crew.foto_url || contact.foto_url,
      };
    });
  }

  public setLiveContacts(items: InternalContact[]): void {
    this.contacts = [...items];
    saveContacts(this.contacts);
    this.notify();
  }

  public resetToFixtures(): void {
    this.contacts = [...INITIAL_INTERNAL_CONTACTS];
    saveContacts(this.contacts);
    this.notify();
  }
}

export const internalContactStore = new InternalContactStoreManager();

export function useInternalContactStore() {
  const { members } = useCrewStore(); // Memicu re-render otomatis saat crewStore berubah
  const [contacts, setContacts] = useState<InternalContact[]>(() => internalContactStore.getAll());

  useEffect(() => {
    setContacts(internalContactStore.getAll());
    const unsubscribe = internalContactStore.subscribe((newContacts) => {
      setContacts(newContacts);
    });
    return unsubscribe;
  }, [members]);

  return {
    contacts,
    resetToFixtures: () => internalContactStore.resetToFixtures(),
  };
}
