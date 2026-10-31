import { useState, useEffect } from 'react';
import { ExternalContact } from './mock/kontakEksternalMockData';
import { ptvCache } from '@/core/cache/ptvCache';

const CACHE_KEY = 'kontak_eksternal_partners';

class ExternalContactsStore {
  private contacts: ExternalContact[] = ptvCache.get<ExternalContact[]>(CACHE_KEY)?.data || [];
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getAll(): ExternalContact[] {
    return [...this.contacts];
  }

  public setLiveContacts(items: ExternalContact[]) {
    this.contacts = [...items];
    ptvCache.set(CACHE_KEY, this.contacts, 5 * 60 * 1000);
    this.notify();
  }

  public getById(id: string): ExternalContact | undefined {
    return this.contacts.find((c) => c.id === id);
  }

  public addContact(data: Omit<ExternalContact, 'id'>): ExternalContact {
    const newId = `ke-${Date.now().toString(36)}`;
    const newContact: ExternalContact = {
      ...data,
      id: newId,
    };
    this.contacts = [newContact, ...this.contacts];
    ptvCache.set(CACHE_KEY, this.contacts, 5 * 60 * 1000);
    this.notify();
    return newContact;
  }

  public updateContact(id: string, updates: Partial<ExternalContact>): ExternalContact | null {
    const idx = this.contacts.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.contacts[idx] = {
      ...this.contacts[idx],
      ...updates,
    };
    ptvCache.set(CACHE_KEY, this.contacts, 5 * 60 * 1000);
    this.notify();
    return this.contacts[idx];
  }

  public deleteContact(id: string): boolean {
    const initialLen = this.contacts.length;
    this.contacts = this.contacts.filter((c) => c.id !== id);
    if (this.contacts.length !== initialLen) {
      ptvCache.set(CACHE_KEY, this.contacts, 5 * 60 * 1000);
      this.notify();
      return true;
    }
    return false;
  }
}

export const externalContactsStore = new ExternalContactsStore();

export function useExternalContactsStore() {
  const [contacts, setContacts] = useState<ExternalContact[]>(() => externalContactsStore.getAll());

  useEffect(() => {
    return externalContactsStore.subscribe(() => {
      setContacts(externalContactsStore.getAll());
    });
  }, []);

  return {
    contacts,
    getById: (id: string) => externalContactsStore.getById(id),
    addContact: (data: Omit<ExternalContact, 'id'>) => externalContactsStore.addContact(data),
    updateContact: (id: string, updates: Partial<ExternalContact>) =>
      externalContactsStore.updateContact(id, updates),
    deleteContact: (id: string) => externalContactsStore.deleteContact(id),
  };
}
