import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * DokumenSayaPage
 * @deprecated Telah digabungkan ke modul Surat & Arsip (/hub/arsip) pada PTV-DEV-233 (BUG-010).
 * Mengarahkan seluruh akses lama secara aman ke /hub/arsip.
 */
export const DokumenSayaPage: React.FC = () => {
  return <Navigate to="/hub/arsip" replace />;
};

export default DokumenSayaPage;
