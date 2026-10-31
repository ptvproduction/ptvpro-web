/**
 * Verification Product Boundary (Public Digital Credential & Letter Verifier)
 * Migrated from legacy/page-verifikasi-identitas.php & legacy/page-verifikasi-surat.php.
 * Zero-authentication required.
 */
export const VERIFICATION_PRODUCT_ID = 'verification';

export * from './types';
export * from './verificationService';
export * from './publicCrewService';
export * from './publicDocumentService';
export * from './KeabsahanDokumenPage';
export * from './VerifikasiIdentitasPage';
export * from './components/PublicVerificationHeader';
