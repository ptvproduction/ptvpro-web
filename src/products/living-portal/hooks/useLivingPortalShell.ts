import { useEffect } from 'react';

/**
 * Isolasi dokumen untuk halaman portal publik: kelas root, perlindungan tema dari sisa
 * data-theme="dark" milik Hub, dan judul halaman. Dipasang sejak layar inisialisasi supaya
 * latar belakang konsisten sebelum dan sesudah data siap.
 */
export function useLivingPortalShell(title?: string) {
  useEffect(() => {
    document.documentElement.classList.add('living-portal-active');
    document.body.classList.add('living-portal-active');

    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      document.documentElement.setAttribute('data-theme-hub-backup', 'dark');
      document.documentElement.removeAttribute('data-theme');
    }

    const prevTitle = document.title;
    if (title) document.title = title;

    return () => {
      document.documentElement.classList.remove('living-portal-active');
      document.body.classList.remove('living-portal-active');
      const backupTheme = document.documentElement.getAttribute('data-theme-hub-backup');
      if (backupTheme) {
        document.documentElement.setAttribute('data-theme', backupTheme);
        document.documentElement.removeAttribute('data-theme-hub-backup');
      }
      if (title) document.title = prevTitle;
    };
  }, [title]);
}
