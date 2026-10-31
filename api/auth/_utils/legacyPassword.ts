import { compare } from 'bcryptjs';

/** Compatibility verifier only. Credential migration and live login remain separately gated. */
export async function verifyLegacyBcryptPassword(password: unknown, encoded: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72
    || typeof encoded !== 'string' || !/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(encoded)) return false;
  try {
    return await compare(password, encoded);
  } catch {
    return false;
  }
}
