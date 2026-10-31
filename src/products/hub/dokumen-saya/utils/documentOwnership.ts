import type { PtvDocument } from '../mock/docsMockData';

export interface DocumentIdentity {
  name?: string;
  username?: string;
  ptv_id?: string;
  account_id?: string;
  identity_id?: string;
  isExecOrAdmin?: boolean;
}

export function filterUserDocuments(docs: PtvDocument[], user: DocumentIdentity): PtvDocument[] {
  // Paritas PHP Legacy L22757: Eksekutif & Administrasi melihat seluruh dokumen resmi
  if (user.isExecOrAdmin) {
    return docs;
  }

  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const rawIdentifiers = [user.name, user.username, user.ptv_id, user.account_id, user.identity_id]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalize);

  const identifiers = new Set(rawIdentifiers);

  const matches = (value?: string | null) => {
    if (!value || typeof value !== 'string') return false;
    const norm = normalize(value);
    if (identifiers.has(norm)) return true;
    for (const id of rawIdentifiers) {
      if (id.length >= 3 && (norm.includes(id) || id.includes(norm))) {
        return true;
      }
    }
    return false;
  };

  return docs.filter((doc) => {
    // 1. Direct fields: owner, pembawa, penanggung_jawab, diajukan_oleh
    if ([doc.owner, doc.pembawa, doc.penanggung_jawab, doc.diajukan_oleh].some(matches)) {
      return true;
    }
    // 2. Recipients array
    if (Array.isArray(doc.recipients) && doc.recipients.some(matches)) {
      return true;
    }
    // 3. Santri list array
    if (Array.isArray(doc.santri_list)) {
      const hasSantri = doc.santri_list.some((s: any) => {
        const sName = typeof s === 'string' ? s : (s?.nama || s?.name || '');
        return matches(sName);
      });
      if (hasSantri) return true;
    }
    return false;
  });
}
