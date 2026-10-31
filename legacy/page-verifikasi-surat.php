<?php
/**
 * Template Name: Verifikasi Surat Resmi PTV
 * Description: Public Verification Portal Resmi Progresif TV - Pesantren Progresif Bumi Shalawat
 */

// Disable caching for real-time verification accuracy
nocache_headers();

global $wpdb;

$nomor_query = trim((string)sanitize_text_field($_GET['nomor'] ?? ($_POST['nomor'] ?? '')));
if (empty($nomor_query)) {
    $req_path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $site_path = trim((string)parse_url(home_url(), PHP_URL_PATH), '/');
    $trimmed_path = trim((string)$req_path, '/');
    if ($site_path && str_starts_with($trimmed_path, $site_path)) {
        $trimmed_path = trim(substr($trimmed_path, strlen($site_path)), '/');
    }
    if (preg_match('#^verifikasi-surat/(.+)$#i', $trimmed_path, $m)) {
        $nomor_query = urldecode(trim($m[1], '/'));
    }
}
$nomor_query_clean = preg_replace('/\s+/', ' ', $nomor_query);

$doc_found = null;

if (!empty($nomor_query_clean)) {
    // 1. CARI DI SUPABASE ptv_surat_izin (SI-PTV) — SINGLE SOURCE OF TRUTH
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_rows = PTV_Supabase::select('ptv_surat_izin', '?nomor_surat=ilike.' . urlencode($nomor_query_clean) . '&limit=1');
        if (is_array($sb_rows) && !empty($sb_rows)) {
            $row = $sb_rows[0];
            $santri_list = [];
            $raw_santri = $row['santri_list'] ?? null;
            if (is_array($raw_santri)) {
                $santri_list = $raw_santri;
            } elseif (is_string($raw_santri) && !empty($raw_santri)) {
                $dec = json_decode($raw_santri, true);
                if (is_array($dec)) {
                    $santri_list = $dec;
                }
            }
            if (empty($santri_list) && !empty($row['alasan'])) {
                $dec = json_decode($row['alasan'], true);
                if (is_array($dec)) {
                    $santri_list = $dec;
                }
            }

            $first_santri = '';
            if (!empty($santri_list) && is_array($santri_list)) {
                $f = $santri_list[0];
                $first_santri = is_array($f) ? ($f['nama'] ?? '') : (string)$f;
            }

            $tgl_mulai   = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
            $tgl_selesai = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
            $tgl_terbit  = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
            $raw_st      = strtolower(trim((string)($row['status'] ?? 'menunggu')));
            $is_valid    = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

            $penerbit_str = (string)(($row['disetujui_oleh'] ?? '') ?: (($row['diajukan_oleh'] ?? '') ?: 'Eksekutif Progresif TV'));
            $pembawa_str  = (string)(($row['nama_santri'] ?? '') ?: $first_santri);

            $doc_found = [
                'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                'jenis_surat'    => 'Surat Izin Resmi Santri',
                'label_kegiatan' => 'Nama Kegiatan',
                'kegiatan'       => (string)(($row['jenis_kegiatan'] ?? '') ?: 'Izin Santri Resmi'),
                'lokasi'         => '',
                'pembawa'        => $pembawa_str,
                'tanggal_terbit' => $tgl_terbit,
                'tanggal_mulai'  => $tgl_mulai,
                'tanggal_selesai'=> $tgl_selesai,
                'penerbit'       => $penerbit_str,
                'raw_status'     => $raw_st,
                'is_valid'       => $is_valid,
                'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                'status_desc'    => $is_valid ? 'Surat resmi ini terdaftar secara sah dan otentik dalam sistem basis data arsip Progresif TV.' : 'Dokumen terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif sehingga belum dapat digunakan sebagai izin resmi.',
                'santri_list'    => $santri_list,
                'kru_list'       => [],
                'barang_list'    => [],
                'created_at'     => $row['created_at'] ?? '',
            ];
        }
    }

    // 2. JIKA NOMOR SURAT MERUPAKAN SURAT IZIN (SI-PTV) TAPI TIDAK ADA DI SUPABASE, JANGAN AMBIL DARI WP
    $is_si_query = str_contains($nomor_query_clean, 'SI-PTV') || str_contains($nomor_query_clean, '/SI/');

    if (!$doc_found && !$is_si_query) {
        // Cari di Supabase ptv_surat_tugas (ST-PTV)
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_st = PTV_Supabase::select('ptv_surat_tugas', '?nomor_surat=ilike.' . urlencode($nomor_query_clean) . '&limit=1');
            if (is_array($sb_st) && !empty($sb_st)) {
                $row = $sb_st[0];
                $row_catatan  = (string)($row['catatan'] ?? '');
                $row_pj       = (string)($row['penanggung_jawab'] ?? '');
                $tgl_mulai    = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
                $tgl_selesai  = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
                $tgl_terbit   = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
                $raw_st       = strtolower(trim((string)($row['status'] ?? 'menunggu')));
                $is_valid     = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

                $kru_list = [];
                if (!empty($row_catatan) && preg_match('/<!-- PTV_KRU:(.*?)-->/s', $row_catatan, $m_kru)) {
                    $dec_kru = json_decode(trim($m_kru[1]), true);
                    if (is_array($dec_kru) && !empty($dec_kru)) {
                        $kru_list = $dec_kru;
                    }
                }
                if (empty($kru_list) && !empty($row['kru_assigned'])) {
                    $dec_ka = json_decode($row['kru_assigned'], true);
                    if (is_array($dec_ka)) {
                        $kru_list = $dec_ka;
                    }
                }
                if (empty($kru_list) && !empty($row_pj)) {
                    $kru_list[] = [
                        'nama'    => $row_pj,
                        'peran'   => 'Penanggung Jawab Tugas',
                        'catatan' => $row_catatan ?: '-'
                    ];
                }

                $doc_found = [
                    'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                    'jenis_surat'    => 'Surat Tugas Resmi Kru',
                    'label_kegiatan' => 'Nama Kegiatan / Penugasan',
                    'kegiatan'       => (string)(($row['nama_kegiatan'] ?? '') ?: 'Penugasan Kru'),
                    'lokasi'         => (string)(($row['lokasi'] ?? '') ?: 'Area Operasional PTV'),
                    'pembawa'        => $row_pj,
                    'tanggal_terbit' => $tgl_terbit,
                    'tanggal_mulai'  => $tgl_mulai,
                    'tanggal_selesai'=> $tgl_selesai,
                    'penerbit'       => (string)(($row['disetujui_oleh'] ?? '') ?: ($row_pj ?: 'Pimpinan Progresif TV')),
                    'raw_status'     => $raw_st,
                    'is_valid'       => $is_valid,
                    'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                    'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                    'status_desc'    => $is_valid ? 'Surat Tugas ini sah terdaftar dalam basis data operasional Progresif TV untuk kegiatan liputan/penugasan resmi.' : 'Surat Tugas terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif.',
                    'santri_list'    => [],
                    'kru_list'       => $kru_list,
                    'barang_list'    => [],
                    'created_at'     => $row['created_at'] ?? '',
                ];
            }
        }

        // Cari di Supabase ptv_surat_barang (SBB-PTV)
        if (!$doc_found && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_sbb = PTV_Supabase::select('ptv_surat_barang', '?nomor_surat=ilike.' . urlencode($nomor_query_clean) . '&limit=1');
            if (is_array($sb_sbb) && !empty($sb_sbb)) {
                $row = $sb_sbb[0];
                $row_catatan   = (string)($row['catatan'] ?? '');
                $row_keperluan = (string)(($row['keperluan'] ?? '') ?: 'Izin Membawa Peralatan');
                $row_pembawa   = (string)(($row['pembawa'] ?? '') ?: 'Kru PTV');
                $row_disetujui = (string)(($row['disetujui_oleh'] ?? '') ?: 'Pimpinan / Eksekutif Progresif TV');

                $tgl_mulai   = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
                $tgl_selesai = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
                $tgl_terbit  = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
                $raw_st      = strtolower(trim((string)($row['status'] ?? 'menunggu')));
                $is_valid    = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

                $barang_list = [];
                $raw_daftar  = (string)($row['daftar_barang'] ?? '');
                if (!empty($raw_daftar)) {
                    $dec = json_decode($raw_daftar, true);
                    if (is_array($dec)) {
                        $barang_list = $dec;
                    } else {
                        $barang_list = [['nama' => $raw_daftar, 'catatan' => $row_catatan ?: '-']];
                    }
                } else {
                    $barang_list = [['nama' => $row_keperluan, 'catatan' => $row_catatan ?: '-']];
                }

                $doc_found = [
                    'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                    'jenis_surat'    => 'Surat Izin Membawa Barang',
                    'label_kegiatan' => 'Keperluan Membawa Peralatan',
                    'kegiatan'       => $row_keperluan,
                    'lokasi'         => '',
                    'pembawa'        => $row_pembawa,
                    'tanggal_terbit' => $tgl_terbit,
                    'tanggal_mulai'  => $tgl_mulai,
                    'tanggal_selesai'=> $tgl_selesai,
                    'penerbit'       => $row_disetujui,
                    'raw_status'     => $raw_st,
                    'is_valid'       => $is_valid,
                    'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                    'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                    'status_desc'    => $is_valid ? 'Surat Izin Membawa Barang ini sah terdaftar dalam basis data operasional Progresif TV untuk izin sirkulasi peralatan inventaris.' : 'Dokumen terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif.',
                    'santri_list'    => [],
                    'kru_list'       => [],
                    'barang_list'    => $barang_list,
                    'created_at'     => $row['created_at'] ?? '',
                ];
            }
        }
    }

    // Fallback: CARI DI WPDB DATABASE MIRROR jika belum ditemukan di Supabase
    if (!$doc_found) {
        $table_si = $wpdb->prefix . 'ptv_surat_izin';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_si}'") === $table_si) {
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table_si} WHERE nomor_surat = %s LIMIT 1", $nomor_query_clean), ARRAY_A);
            if ($row) {
                $santri_list = [];
                $raw_santri = $row['santri_list'] ?? null;
                if (is_string($raw_santri) && !empty($raw_santri)) {
                    $dec = json_decode($raw_santri, true);
                    if (is_array($dec)) $santri_list = $dec;
                }
                $first_santri = '';
                if (!empty($santri_list) && is_array($santri_list)) {
                    $f = $santri_list[0];
                    $first_santri = is_array($f) ? ($f['nama'] ?? '') : (string)$f;
                }
                $tgl_mulai   = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
                $tgl_selesai = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
                $tgl_terbit  = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
                $raw_st      = strtolower(trim((string)($row['status'] ?? 'menunggu')));
                $is_valid    = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

                $doc_found = [
                    'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                    'jenis_surat'    => 'Surat Izin Resmi Santri',
                    'label_kegiatan' => 'Nama Kegiatan',
                    'kegiatan'       => (string)(($row['jenis_kegiatan'] ?? '') ?: 'Izin Santri Resmi'),
                    'lokasi'         => '',
                    'pembawa'        => (string)(($row['nama_santri'] ?? '') ?: $first_santri),
                    'tanggal_terbit' => $tgl_terbit,
                    'tanggal_mulai'  => $tgl_mulai,
                    'tanggal_selesai'=> $tgl_selesai,
                    'penerbit'       => (string)(($row['disetujui_oleh'] ?? '') ?: 'Eksekutif Progresif TV'),
                    'raw_status'     => $raw_st,
                    'is_valid'       => $is_valid,
                    'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                    'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                    'status_desc'    => $is_valid ? 'Surat resmi ini terdaftar secara sah dan otentik dalam sistem basis data arsip Progresif TV.' : 'Dokumen terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif sehingga belum dapat digunakan sebagai izin resmi.',
                    'santri_list'    => $santri_list,
                    'kru_list'       => [],
                    'barang_list'    => [],
                    'created_at'     => $row['created_at'] ?? '',
                ];
            }
        }
    }

    if (!$doc_found) {
        $table_st = $wpdb->prefix . 'ptv_surat_tugas';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_st}'") === $table_st) {
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table_st} WHERE nomor_surat = %s LIMIT 1", $nomor_query_clean), ARRAY_A);
            if ($row) {
                $row_catatan  = (string)($row['catatan'] ?? '');
                $row_pj       = (string)($row['penanggung_jawab'] ?? '');
                $tgl_mulai    = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
                $tgl_selesai  = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
                $tgl_terbit   = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
                $raw_st       = strtolower(trim((string)($row['status'] ?? 'menunggu')));
                $is_valid     = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

                $kru_list = [];
                if (!empty($row_catatan) && preg_match('/<!-- PTV_KRU:(.*?)-->/s', $row_catatan, $m_kru)) {
                    $dec_kru = json_decode(trim($m_kru[1]), true);
                    if (is_array($dec_kru)) $kru_list = $dec_kru;
                }
                if (empty($kru_list) && !empty($row['kru_assigned'])) {
                    $dec_ka = json_decode($row['kru_assigned'], true);
                    if (is_array($dec_ka)) $kru_list = $dec_ka;
                }
                if (empty($kru_list) && !empty($row_pj)) {
                    $kru_list[] = [
                        'nama'    => $row_pj,
                        'peran'   => 'Penanggung Jawab Tugas',
                        'catatan' => $row_catatan ?: '-'
                    ];
                }

                $doc_found = [
                    'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                    'jenis_surat'    => 'Surat Tugas Resmi Kru',
                    'label_kegiatan' => 'Nama Kegiatan / Penugasan',
                    'kegiatan'       => (string)(($row['nama_kegiatan'] ?? '') ?: 'Penugasan Kru'),
                    'lokasi'         => (string)(($row['lokasi'] ?? '') ?: 'Area Operasional PTV'),
                    'pembawa'        => $row_pj,
                    'tanggal_terbit' => $tgl_terbit,
                    'tanggal_mulai'  => $tgl_mulai,
                    'tanggal_selesai'=> $tgl_selesai,
                    'penerbit'       => (string)(($row['disetujui_oleh'] ?? '') ?: ($row_pj ?: 'Pimpinan Progresif TV')),
                    'raw_status'     => $raw_st,
                    'is_valid'       => $is_valid,
                    'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                    'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                    'status_desc'    => $is_valid ? 'Surat Tugas ini sah terdaftar dalam basis data operasional Progresif TV untuk kegiatan liputan/penugasan resmi.' : 'Surat Tugas terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif.',
                    'santri_list'    => [],
                    'kru_list'       => $kru_list,
                    'barang_list'    => [],
                    'created_at'     => $row['created_at'] ?? '',
                ];
            }
        }
    }

    if (!$doc_found) {
        $table_sbb = $wpdb->prefix . 'ptv_surat_barang';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_sbb}'") === $table_sbb) {
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table_sbb} WHERE nomor_surat = %s LIMIT 1", $nomor_query_clean), ARRAY_A);
            if ($row) {
                $row_catatan   = (string)($row['catatan'] ?? '');
                $row_keperluan = (string)(($row['keperluan'] ?? '') ?: 'Izin Membawa Peralatan');
                $row_pembawa   = (string)(($row['pembawa'] ?? '') ?: 'Kru PTV');
                $row_disetujui = (string)(($row['disetujui_oleh'] ?? '') ?: 'Pimpinan / Eksekutif Progresif TV');

                $tgl_mulai   = !empty($row['tanggal_mulai']) ? substr($row['tanggal_mulai'], 0, 10) : '';
                $tgl_selesai = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : '';
                $tgl_terbit  = !empty($row['created_at']) ? substr($row['created_at'], 0, 10) : $tgl_mulai;
                $raw_st      = strtolower(trim((string)($row['status'] ?? 'menunggu')));
                $is_valid    = in_array($raw_st, ['disetujui', 'valid', 'aktif'], true);

                $barang_list = [];
                $raw_daftar  = (string)($row['daftar_barang'] ?? '');
                if (!empty($raw_daftar)) {
                    $dec = json_decode($raw_daftar, true);
                    if (is_array($dec)) {
                        $barang_list = $dec;
                    } else {
                        $barang_list = [['nama' => $raw_daftar, 'catatan' => $row_catatan ?: '-']];
                    }
                } else {
                    $barang_list = [['nama' => $row_keperluan, 'catatan' => $row_catatan ?: '-']];
                }

                $doc_found = [
                    'nomor_surat'    => (string)($row['nomor_surat'] ?? ''),
                    'jenis_surat'    => 'Surat Izin Membawa Barang',
                    'label_kegiatan' => 'Keperluan Membawa Peralatan',
                    'kegiatan'       => $row_keperluan,
                    'lokasi'         => '',
                    'pembawa'        => $row_pembawa,
                    'tanggal_terbit' => $tgl_terbit,
                    'tanggal_mulai'  => $tgl_mulai,
                    'tanggal_selesai'=> $tgl_selesai,
                    'penerbit'       => $row_disetujui,
                    'raw_status'     => $raw_st,
                    'is_valid'       => $is_valid,
                    'status_title'   => $is_valid ? 'DOKUMEN VALID' : ($raw_st === 'revisi' ? 'PERLU REVISI' : ($raw_st === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PENGESAHAN')),
                    'status_label'   => $is_valid ? 'DOKUMEN RESMI TERDAFTAR & VALID' : ($raw_st === 'revisi' ? 'SURAT MEMERLUKAN REVISI' : ($raw_st === 'ditolak' ? 'SURAT DITOLAK' : 'SURAT DALAM PROSES (BELUM DISAHKAN)')),
                    'status_desc'    => $is_valid ? 'Surat Izin Membawa Barang ini sah terdaftar dalam basis data operasional Progresif TV untuk izin sirkulasi peralatan inventaris.' : 'Dokumen terdata dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif.',
                    'santri_list'    => [],
                    'kru_list'       => [],
                    'barang_list'    => $barang_list,
                    'created_at'     => $row['created_at'] ?? '',
                ];
            }
        }
    }
}

// Resolusi logo PTV secara dinamis melalui /wp-content
$upload_dir = wp_upload_dir();
$ptv_logo_url = '';
if (file_exists($upload_dir['basedir'] . '/2026/09/LOGO-NON-RESMI.webp')) {
    $ptv_logo_url = '/wp-content/uploads/2026/09/LOGO-NON-RESMI.webp';
} elseif (file_exists($upload_dir['basedir'] . '/LOGO-NON-RESMI.webp')) {
    $ptv_logo_url = '/wp-content/uploads/LOGO-NON-RESMI.webp';
} else {
    $ptv_logo_url = '/wp-content/uploads/2026/09/LOGO-NON-RESMI.webp';
}
$logo_url = $ptv_logo_url;

// Logo Resmi Kop Surat (BS-X-PTV.webp) melalui /wp-content
$bs_file = WP_CONTENT_DIR . '/uploads/BS-X-PTV.webp';
$bs_logo_data = file_exists($bs_file) ? ('data:image/webp;base64,' . base64_encode(file_get_contents($bs_file))) : '';
$bs_logo_url  = '/wp-content/uploads/BS-X-PTV.webp';

if (!function_exists('ptv_format_id_date')) {
function ptv_format_id_date($date_str) {
    if (empty($date_str)) return '-';
    if (str_contains($date_str, 's.d.') || str_contains($date_str, '–')) {
        return $date_str;
    }
    $parts = explode('-', $date_str);
    if (count($parts) !== 3) return $date_str;
    $y = (int)$parts[0];
    $m = (int)$parts[1];
    $d = (int)$parts[2];
    if (!$y || !$m || !$d) return $date_str;

    $bulan = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
    ];
    $hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    $timestamp = mktime(0, 0, 0, $m, $d, $y);
    $hari_nama = $hari[(int)date('w', $timestamp)];
    $bln_nama  = $bulan[$m] ?? '';

    return sprintf('%s, %02d %s %d', $hari_nama, $d, $bln_nama, $y);
}
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Surat Resmi — Progresif TV</title>
    <meta name="description" content="Layanan publik verifikasi keaslian dan status dokumen/surat izin resmi yang diterbitkan oleh Progresif TV Pesantren Progresif Bumi Shalawat.">
    <link rel="preconnect" href="https://fonts.cdnfonts.com">
    <link href="https://fonts.cdnfonts.com/css/sf-pro-display" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    
    <style>
        :root {
            --b-900: #072A52;
            --b-800: #0A3C74;
            --b-700: #0B5FBF;
            --b-600: #1273E6;
            --b-500: #3B8EF7;
            --b-100: #DCEBFF;
            --b-050: #EDF4FF;

            --ptv-green: #0e4f40;
            --ptv-green-light: #166554;
            --ptv-green-bg: #E1F5EE;

            --bg: #F8FAFD;
            --surface: #FFFFFF;
            --ink: #0B2A4A;
            --ink-2: #38587A;
            --muted: #6E8CAE;
            --line: rgba(11, 42, 74, 0.10);
            --line-2: rgba(11, 42, 74, 0.055);

            --ok: #0F7A5A;
            --ok-bg: #E1F5EE;
            --dang: #B02B23;
            --dang-bg: #FDE8E6;

            --shadow-s: 0 1px 2px rgba(11,60,116,.05), 0 3px 10px rgba(11,60,116,.05);
            --shadow-m: 0 4px 12px rgba(11,60,116,.07), 0 18px 40px rgba(11,60,116,.10);
            --shadow-l: 0 10px 30px rgba(11,60,116,.12), 0 25px 60px rgba(11,60,116,.08);

            --r-s: 12px;
            --r-m: 18px;
            --r-l: 24px;
            --r-full: 9999px;

            --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            font-family: var(--font);
            color: var(--ink);
            background: var(--bg);
            min-height: 100vh;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        html, body, button, input, select, textarea, table, th, td, code, kbd, a, div, span, p, h1, h2, h3, h4, h5, h6 {
            font-family: var(--font) !important;
        }

        /* Ambient light & patterned grid - match Dashboard atmosphere */
        body::before {
            content: "";
            position: fixed;
            inset: 0;
            height: 100%;
            z-index: -2;
            pointer-events: none;
            background:
                radial-gradient(ellipse 65% 45% at 15% 10%, rgba(216,233,254,0.55) 0%, transparent 60%),
                radial-gradient(ellipse 55% 40% at 85% 15%, rgba(225,245,238,0.65) 0%, transparent 55%),
                linear-gradient(180deg, #F8FAFD 0%, #F1F6FE 50%, #EDF4FD 100%);
        }

        body::after {
            content: "";
            position: fixed;
            inset: 0;
            height: 100%;
            z-index: -1;
            pointer-events: none;
            background-image:
                linear-gradient(to right, rgba(0,55,138,0.025) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,55,138,0.025) 1px, transparent 1px);
            background-size: 28px 28px;
            -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 95%);
            mask-image: radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 95%);
            opacity: 0.7;
        }

        /* Top Navbar */
        .top-navbar {
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--line);
            position: sticky;
            top: 0;
            z-index: 50;
            box-shadow: 0 1px 3px rgba(11, 42, 74, 0.03);
        }

        .navbar-inner {
            max-width: 980px;
            margin: 0 auto;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

                .brand-logo-link {
            display: inline-flex;
            align-items: center;
            line-height: 0;
            text-decoration: none;
            padding: 0;
            background: none;
            border: none;
            box-shadow: none;
            transition: transform .15s cubic-bezier(.34,1.56,.64,1), opacity .15s;
            touch-action: manipulation;
        }

        .brand-logo-link:active {
            transform: scale(.96);
            opacity: .85;
        }

        @media(hover:hover) {
            .brand-logo-link:hover {
                opacity: .88;
            }
        }

        .brand-logo-gradient {
            display: block;
            width: 160px;
            height: 32px;
            background: var(--ptv-green, #0e4f40);
            -webkit-mask-image: var(--logo-url);
            mask-image: var(--logo-url);
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
            -webkit-mask-size: contain;
            mask-size: contain;
            -webkit-mask-position: left center;
            mask-position: left center;
            transition: background .2s ease;
        }

        .brand-logo-link:hover .brand-logo-gradient {
            background: var(--ptv-green-light, #166554);
        }

        @media (max-width: 480px) {
            .brand-logo-gradient {
                width: 135px;
                height: 27px;
            }
        }

        .header-status-text {
            font-size: 13px;
            font-weight: 600;
            color: var(--ink-2);
            letter-spacing: -0.01em;
        }

        /* Container */
        .portal-container {
            max-width: 860px;
            width: 100%;
            margin: 32px auto 48px;
            padding: 0 20px;
            flex: 1;
        }

        /* Hero Header */
        .portal-hero {
            text-align: center;
            margin-bottom: 28px;
        }

        .portal-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 18px;
            background: rgba(14, 79, 64, 0.08);
            border: 1px solid rgba(14, 79, 64, 0.16);
            border-radius: var(--r-full);
            color: var(--ptv-green);
            font-size: 11.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .portal-title {
            font-size: 28px;
            font-weight: 900;
            color: var(--b-900);
            letter-spacing: -0.03em;
            line-height: 1.2;
            margin-bottom: 8px;
        }

        .portal-desc {
            font-size: 14px;
            color: var(--ink-2);
            max-width: 580px;
            margin: 0 auto;
            line-height: 1.55;
        }

        /* Search Card */
        .search-card {
            background: var(--surface);
            border-radius: var(--r-m);
            border: 1px solid var(--line);
            padding: 20px 24px;
            box-shadow: var(--shadow-m);
            margin-bottom: 30px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-card:focus-within {
            border-color: var(--b-600);
            box-shadow: 0 8px 24px rgba(18, 115, 230, 0.12);
        }

        .search-form-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
            margin-bottom: 10px;
        }

        .search-box-wrap {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        @media (min-width: 640px) {
            .search-box-wrap {
                flex-direction: row;
            }
        }

        .search-input-field {
            flex: 1;
            padding: 12px 18px;
            background: #F8FAFD;
            border: 1.5px solid var(--line);
            border-radius: var(--r-s);
            font-size: 15px;
            font-weight: 700;
            color: var(--ink);
            font-family: inherit;
            outline: none;
            transition: all 0.15s ease;
        }

        .search-input-field:focus {
            background: #ffffff;
            border-color: var(--b-600);
            box-shadow: 0 0 0 3px rgba(18, 115, 230, 0.15);
        }

        .search-submit-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
            background: var(--ptv-green);
            color: #ffffff;
            border: none;
            border-radius: var(--r-s);
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 4px 12px rgba(14, 79, 64, 0.25);
            white-space: nowrap;
        }

        .search-submit-btn:hover {
            background: var(--ptv-green-light);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(14, 79, 64, 0.35);
        }

        /* Verification Result: VALID */
        .card-cert {
            background: var(--surface);
            border-radius: var(--r-l);
            border: 1px solid var(--line);
            box-shadow: var(--shadow-l);
            overflow: hidden;
            animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .cert-header {
            background: linear-gradient(135deg, #0e4f40 0%, #155d4c 50%, #072a52 100%);
            color: #ffffff;
            padding: 28px 24px;
            position: relative;
            overflow: hidden;
        }

        .cert-header::after {
            content: "";
            position: absolute;
            right: -20px;
            bottom: -30px;
            width: 160px;
            height: 160px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 50%;
            pointer-events: none;
        }

        .cert-badge-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .cert-valid-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.35);
            border-radius: var(--r-full);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .cert-title {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -0.02em;
            margin-bottom: 4px;
        }

        .cert-subtitle {
            font-size: 13.5px;
            opacity: 0.9;
        }

        /* Document Number Hero Display */
        .doc-no-banner {
            padding: 16px 24px;
            background: #F1F6FE;
            border-bottom: 1px solid var(--line);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .doc-no-label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
        }

        .doc-no-value {
            font-family: "SF Pro Display", "SF Pro Text", "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.02em;
            font-size: 18px;
            font-weight: 800;
            color: var(--b-800);
            background: #ffffff;
            border: 1px solid var(--b-100);
            padding: 6px 16px;
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(11, 42, 74, 0.06);
        }

        /* Detail Grid */
        .cert-body {
            padding: 28px 24px;
        }

        .detail-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-bottom: 28px;
        }

        @media (min-width: 640px) {
            .detail-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .detail-item {
            background: #F8FAFD;
            border: 1px solid var(--line);
            border-radius: var(--r-s);
            padding: 14px 18px;
            display: flex;
            gap: 14px;
            align-items: flex-start;
        }

        .detail-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #ffffff;
            border: 1px solid var(--line);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--ptv-green);
            font-size: 16px;
            flex-shrink: 0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .detail-content {
            flex: 1;
            min-width: 0;
        }

        .detail-label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
            margin-bottom: 2px;
        }

        .detail-val {
            font-size: 14.5px;
            font-weight: 700;
            color: var(--ink);
            word-break: break-word;
        }

        /* Santri Roster Table */
        .roster-card {
            margin-top: 24px;
            border-top: 1px solid var(--line);
            padding-top: 24px;
        }

        .roster-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .roster-title {
            font-size: 13.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--ink);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .roster-count {
            padding: 4px 12px;
            background: var(--b-050);
            border: 1px solid var(--b-100);
            border-radius: var(--r-full);
            color: var(--b-700);
            font-size: 12px;
            font-weight: 800;
        }

        .roster-table-container {
            overflow-x: auto;
            border: 1px solid var(--line);
            border-radius: var(--r-s);
            background: #ffffff;
        }

        .roster-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }

        .roster-table th {
            background: #F8FAFD;
            color: var(--ink-2);
            padding: 11px 14px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid var(--line);
        }

        .roster-table td {
            padding: 11px 14px;
            border-bottom: 1px solid var(--line-2);
            color: var(--ink);
        }

        .roster-table tr:last-child td {
            border-bottom: none;
        }

        .roster-table tr:hover {
            background: #F8FAFD;
        }

        /* Security Seal Callout */
        .seal-callout {
            margin-top: 28px;
            padding: 18px 20px;
            background: #F1F6FE;
            border: 1px solid var(--b-100);
            border-radius: var(--r-m);
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .seal-callout i {
            font-size: 26px;
            color: var(--ptv-green);
            flex-shrink: 0;
        }

        .seal-text {
            font-size: 12px;
            line-height: 1.5;
            color: var(--ink-2);
        }

        .seal-text strong {
            color: var(--ink);
        }

        /* Verification Result: NOT FOUND */
        .card-error {
            background: var(--surface);
            border-radius: var(--r-l);
            border: 1px solid rgba(176, 43, 35, 0.15);
            box-shadow: var(--shadow-m);
            overflow: hidden;
            animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .error-header {
            background: linear-gradient(135deg, #B02B23 0%, #871913 100%);
            color: #ffffff;
            padding: 28px 24px;
            text-align: center;
        }

        .error-icon-box {
            width: 58px;
            height: 58px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            margin: 0 auto 14px;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .error-body {
            padding: 32px 24px;
            text-align: center;
        }

        .error-no-pill {
            display: inline-block;
            font-family: "SF Pro Display", "SF Pro Text", "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.02em;
            font-size: 16px;
            font-weight: 800;
            color: var(--dang);
            background: var(--dang-bg);
            border: 1px solid #fca5a5;
            padding: 6px 18px;
            border-radius: var(--r-full);
            margin: 12px 0 16px;
        }

        /* Default Feature Cards */
        .features-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 10px;
        }

        @media (min-width: 640px) {
            .features-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }

        .feature-item {
            background: var(--surface);
            border-radius: var(--r-m);
            border: 1px solid var(--line);
            padding: 22px 20px;
            text-align: center;
            box-shadow: var(--shadow-s);
        }

        .feature-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: var(--b-050);
            color: var(--b-700);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            margin: 0 auto 12px;
        }

        .feature-title {
            font-size: 14px;
            font-weight: 800;
            color: var(--ink);
            margin-bottom: 6px;
        }

        .feature-desc {
            font-size: 12px;
            color: var(--muted);
            line-height: 1.5;
        }

        /* Site Footer */
        .site-footer {
            margin-top: auto;
            background: var(--surface);
            border-top: 1px solid var(--line);
            padding: 24px 20px;
            text-align: center;
            font-size: 12px;
            color: var(--muted);
        }

        .footer-logo {
            font-weight: 900;
            color: var(--ptv-green);
            letter-spacing: 0.05em;
        }



        .btn-download-cert {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 18px;
            background: var(--ptv-green);
            color: #ffffff;
            border: none;
            border-radius: var(--r-s);
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(14, 79, 64, 0.2);
            transition: all 0.15s ease;
            text-decoration: none;
        }

        .btn-download-cert:hover {
            background: var(--ptv-green-light);
            transform: translateY(-1px);
            box-shadow: 0 5px 14px rgba(14, 79, 64, 0.3);
        }
    </style>
</head>
<body>

    <!-- Top Navigation -->
    <nav class="top-navbar">
        <div class="navbar-inner">
            <a href="<?php echo esc_url(home_url('/')); ?>" class="brand-logo-link" aria-label="Progresif TV">
                <span class="brand-logo-gradient" style="--logo-url: url('<?php echo esc_url($ptv_logo_url); ?>');" role="img" aria-label="Progresif TV"></span>
            </a>
            <span class="header-status-text">Arsip Digital Resmi</span>
        </div>
    </nav>

    <!-- Main Container -->
    <main class="portal-container">

        <!-- Hero Section -->
        <header class="portal-hero">
            <div class="portal-badge">
                <i class="fa-solid fa-award"></i> Public Verification Portal
            </div>
            <h1 class="portal-title">Verifikasi Dokumen & Surat Resmi</h1>
            <p class="portal-desc">
                Portal pemeriksaan publik keabsahan dokumen resmi yang diterbitkan oleh Sistem Manajemen Progresif TV Pesantren Progresif Bumi Shalawat.
            </p>
        </header>

        <!-- Search Bar -->
        <section class="search-card">
            <form action="<?php echo esc_url(home_url('/verifikasi-surat/')); ?>" method="GET">
                <label for="nomor" class="search-form-label">
                    <i class="fa-solid fa-magnifying-glass"></i> Cari atau Masukkan Nomor Surat
                </label>
                <div class="search-box-wrap">
                    <input 
                        type="text" 
                        id="nomor" 
                        name="nomor" 
                        class="search-input-field" 
                        placeholder="Contoh: 001/SI-PTV/IX/<?php echo date('Y'); ?>" 
                        value="<?php echo esc_attr($nomor_query); ?>" 
                        required 
                        autocomplete="off"
                    >
                    <button type="submit" class="search-submit-btn">
                        <i class="fa-solid fa-check-double"></i> Verifikasi Dokumen
                    </button>
                </div>
            </form>
        </section>

        <!-- Result Display -->
        <?php if (!empty($nomor_query_clean)): ?>
            <?php if ($doc_found): ?>
                <!-- VALID DOCUMENT CERTIFICATE -->
                <article class="card-cert">
                    <div class="cert-header">
                        <div class="cert-badge-row">
                            <span class="cert-valid-chip">
                                <i class="fa-solid fa-circle-check"></i> Dokumen Sah & Terdaftar
                            </span>
                        </div>
                        <h2 class="cert-title">STATUS: DOKUMEN VALID</h2>
                        <p class="cert-subtitle">Surat resmi ini terdaftar secara sah dan otentik dalam sistem basis data arsip Progresif TV.</p>
                    </div>

                    <!-- Prominent Number Display -->
                    <div class="doc-no-banner">
                        <div>
                            <div class="doc-no-label">Nomor Surat Resmi</div>
                            <div class="doc-no-value"><?php echo esc_html($doc_found['nomor_surat']); ?></div>
                        </div>
                        <?php if ($doc_found['is_valid']): ?>
                        <div>
                            <button type="button" id="btnPageDownloadPdf" onclick="ptvDownloadSuratPdf()" class="btn-download-cert">
                                <i class="fa-solid fa-file-arrow-down"></i> Unduh Salinan PDF
                            </button>
                        </div>
                        <?php endif; ?>
                    </div>

                    <div class="cert-body">
                        <!-- Key Metadata Details -->
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-icon"><i class="fa-solid fa-file-signature"></i></div>
                                <div class="detail-content">
                                    <div class="detail-label">Jenis Surat</div>
                                    <div class="detail-val"><?php echo esc_html($doc_found['jenis_surat']); ?></div>
                                </div>
                            </div>

                            <div class="detail-item">
                                <div class="detail-icon" style="color:var(--b-700);"><i class="fa-solid fa-bullhorn"></i></div>
                                <div class="detail-content">
                                    <div class="detail-label">Perihal / Kegiatan</div>
                                    <div class="detail-val" style="color:var(--ptv-green); font-weight:800;"><?php echo esc_html($doc_found['kegiatan']); ?></div>
                                </div>
                            </div>

                            <div class="detail-item">
                                <div class="detail-icon"><i class="fa-solid fa-calendar-day"></i></div>
                                <div class="detail-content">
                                    <div class="detail-label">Tanggal Izin Berlaku</div>
                                    <div class="detail-val">
                                        <?php 
                                            $tgl_start_fmt = ptv_format_id_date($doc_found['tanggal_mulai']);
                                            $tgl_end_fmt   = ptv_format_id_date($doc_found['tanggal_selesai']);
                                            if (!empty($doc_found['tanggal_selesai']) && $doc_found['tanggal_mulai'] !== $doc_found['tanggal_selesai']) {
                                                echo esc_html($tgl_start_fmt . ' s.d. ' . $tgl_end_fmt);
                                            } else {
                                                echo esc_html($tgl_start_fmt);
                                            }
                                        ?>
                                    </div>
                                </div>
                            </div>

                            <div class="detail-item">
                                <div class="detail-icon"><i class="fa-solid fa-user-check"></i></div>
                                <div class="detail-content">
                                    <div class="detail-label">Akun Penerbit Dokumen</div>
                                    <div class="detail-val"><?php echo esc_html($doc_found['penerbit']); ?></div>
                                </div>
                            </div>
                        </div>

                        <!-- Contextual Roster / Details Table -->
                        <?php if (!empty($doc_found['santri_list'])): ?>
                            <div class="roster-card">
                                <div class="roster-header">
                                    <div class="roster-title">
                                        <i class="fa-solid fa-users text-slate-400"></i> Daftar Santri Yang Tercantum
                                    </div>
                                    <span class="roster-count"><?php echo count($doc_found['santri_list']); ?> Santri</span>
                                </div>
                                <div class="roster-table-container">
                                    <table class="roster-table">
                                        <thead>
                                            <tr>
                                                <th style="width: 36px; text-align: center;">#</th>
                                                <th>Nama Santri</th>
                                                <th>Unit</th>
                                                <th>Kelas</th>
                                                <th>Angkatan</th>
                                                <th>Catatan Khusus</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($doc_found['santri_list'] as $idx => $s): 
                                                $nama  = is_array($s) ? ($s['nama'] ?? '-') : (is_string($s) ? $s : '-');
                                                $unit  = is_array($s) ? ($s['unit'] ?? '-') : '-';
                                                $kelas = is_array($s) ? ($s['kelas'] ?? '-') : '-';
                                                $angk  = is_array($s) ? ($s['angkatan'] ?? '-') : '-';
                                                $job   = is_array($s) ? ($s['jobdesc'] ?? ($s['catatan'] ?? '-')) : '-';
                                            ?>
                                                <tr>
                                                    <td style="text-align: center; color: var(--muted); font-weight: 700;"><?php echo ($idx + 1); ?></td>
                                                    <td style="font-weight: 700; color: var(--ink);"><?php echo esc_html($nama); ?></td>
                                                    <td><?php echo esc_html($unit); ?></td>
                                                    <td><?php echo esc_html($kelas); ?></td>
                                                    <td><?php echo esc_html($angk); ?></td>
                                                    <td style="color: var(--ink-2); font-size: 12.5px;"><?php echo esc_html($job ?: '-'); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        <?php elseif (!empty($doc_found['kru_list'])): ?>
                            <div class="roster-card">
                                <div class="roster-header">
                                    <div class="roster-title">
                                        <i class="fa-solid fa-id-badge text-slate-400"></i> Personel Kru Yang Ditugaskan
                                    </div>
                                    <span class="roster-count"><?php echo count($doc_found['kru_list']); ?> Personel</span>
                                </div>
                                <div class="roster-table-container">
                                    <table class="roster-table">
                                        <thead>
                                            <tr>
                                                <th style="width: 36px; text-align: center;">#</th>
                                                <th>Nama Kru</th>
                                                <th>Peran / Jabatan</th>
                                                <th>Instruksi / Catatan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($doc_found['kru_list'] as $idx => $k): ?>
                                                <tr>
                                                    <td style="text-align: center; color: var(--muted); font-weight: 700;"><?php echo ($idx + 1); ?></td>
                                                    <td style="font-weight: 700; color: var(--ink);"><?php echo esc_html($k['nama']); ?></td>
                                                    <td><span class="chip" style="font-size:11.5px; font-weight:700;"><?php echo esc_html($k['peran']); ?></span></td>
                                                    <td style="color: var(--ink-2); font-size: 12.5px;"><?php echo esc_html($k['catatan']); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        <?php elseif (!empty($doc_found['barang_list'])): ?>
                            <div class="roster-card">
                                <div class="roster-header">
                                    <div class="roster-title">
                                        <i class="fa-solid fa-boxes-packing text-slate-400"></i> Daftar Peralatan / Inventaris Yang Dibawa
                                    </div>
                                    <span class="roster-count"><?php echo count($doc_found['barang_list']); ?> Item</span>
                                </div>
                                <div class="roster-table-container">
                                    <table class="roster-table">
                                        <thead>
                                            <tr>
                                                <th style="width: 36px; text-align: center;">#</th>
                                                <th>Nama Peralatan / Barang</th>
                                                <th>Keterangan / Kondisi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($doc_found['barang_list'] as $idx => $b): 
                                                $b_nama = is_array($b) ? ($b['nama'] ?? ($b['item'] ?? '-')) : (string)$b;
                                                $b_note = is_array($b) ? ($b['catatan'] ?? ($b['notes'] ?? '-')) : '-';
                                            ?>
                                                <tr>
                                                    <td style="text-align: center; color: var(--muted); font-weight: 700;"><?php echo ($idx + 1); ?></td>
                                                    <td style="font-weight: 700; color: var(--ink);"><?php echo esc_html($b_nama); ?></td>
                                                    <td style="color: var(--ink-2); font-size: 12.5px;"><?php echo esc_html($b_note); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        <?php endif; ?>

                        <!-- Institutional Seal Callout -->
                        <div class="seal-callout">
                            <i class="fa-solid fa-certificate"></i>
                            <div class="seal-text">
                                <strong>PENGESAHAN ELEKTRONIK RESMI:</strong> Dokumen ini diverifikasi langsung dari basis data operasional Progresif TV. Dokumen sah secara institusional tanpa memerlukan tanda tangan basah tambahan.
                            </div>
                        </div>
                    </div>
                </article>

            <?php else: ?>
                <!-- DOCUMENT NOT FOUND -->
                <article class="card-error">
                    <div class="error-header">
                        <div class="error-icon-box">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 4px;">DOKUMEN TIDAK DITEMUKAN</h2>
                        <p style="font-size: 13.5px; opacity: 0.9;">Nomor surat tidak dapat diverifikasi dalam pangkalan data resmi.</p>
                    </div>

                    <div class="error-body">
                        <p style="font-size: 13.5px; color: var(--muted);">Pencarian untuk nomor surat:</p>
                        <div class="error-no-pill"><?php echo esc_html($nomor_query); ?></div>
                        <p style="font-size: 13px; color: var(--ink-2); max-width: 480px; margin: 0 auto 20px; line-height: 1.6;">
                            Pastikan format nomor surat telah diketik secara lengkap sesuai yang tertera pada lembar dokumen fisik atau hasil scan kode QR (contoh: <code>001/SI-PTV/IX/<?php echo date('Y'); ?></code>).
                        </p>
                        <a href="<?php echo esc_url(home_url('/verifikasi-surat/')); ?>" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; background: #F1F6FE; color: var(--b-800); border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; border: 1px solid var(--b-100);">
                            <i class="fa-solid fa-rotate-left"></i> Ulangi Pencarian
                        </a>
                    </div>
                </article>
            <?php endif; ?>

        <?php else: ?>
            <!-- Default Idle Guide Cards -->
            <div class="features-grid">
                <div class="feature-item">
                    <div class="feature-icon"><i class="fa-solid fa-qrcode"></i></div>
                    <div class="feature-title">Pindai Kode QR</div>
                    <div class="feature-desc">Gunakan kamera smartphone apa saja (iPhone / Android) langsung ke kode QR pengesahan pada surat resmi.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-icon" style="background:#E1F5EE;color:#0F7A5A;"><i class="fa-solid fa-server"></i></div>
                    <div class="feature-title">Verifikasi Real-Time</div>
                    <div class="feature-desc">Sistem memverifikasi status dokumen secara langsung ke basis data arsip resmi Progresif TV.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-icon" style="background:#FFF7ED;color:#C2410C;"><i class="fa-solid fa-file-shield"></i></div>
                    <div class="feature-title">Validitas Terjamin</div>
                    <div class="feature-desc">Rincian nama santri, tanggal perizinan, dan akun penerbit ditampilkan transparan untuk menjamin keaslian.</div>
                </div>
            </div>
        <?php endif; ?>

    </main>

    <!-- Footer -->
    <footer class="site-footer">
        <div>&copy; <?php echo date('Y'); ?> <span class="footer-logo">PROGRESIF TV</span> — Official Media Broadcaster Pesantren Progresif Bumi Shalawat</div>
        <div style="margin-top: 4px; font-size: 11px;">Jl. Kyai Dasuki No. 01, Lebo, Sidoarjo, Jawa Timur | Email: redaksi@progresiftv.id</div>
    </footer>



    <?php if ($doc_found && !empty($doc_found['is_valid'])): ?>
    <!-- Offscreen Formal A4 Printable Document Template for PDF Generation -->
    <div style="position:fixed; left:-9999px; top:0; z-index:-1000; pointer-events:none; opacity:0;">
        <div id="officialVerifPrintArea" style="width:794px; min-width:794px; max-width:794px; min-height:1123px; padding:36px 42px; background:#ffffff; color:#0f172a; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; box-sizing:border-box;">
            <!-- Official Kop Header (Acuan Lama) -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3.5px double #0e4f40; padding-bottom:12px; margin-bottom:18px;">
                <div>
                    <img src="<?php echo esc_attr($bs_logo_data ?: $bs_logo_url); ?>" alt="Logo Bumi Shalawat & Progresif TV" style="height:52px; width:auto; object-fit:contain; display:block;">
                </div>
                <div style="text-align:right;">
                    <div style="font-size:22px; font-weight:900; color:#0e4f40; letter-spacing:0.02em; line-height:1.1; margin:0 0 2px 0;">PROGRESIF TV</div>
                    <div style="font-size:10.5px; font-weight:800; color:#1e293b; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:4px;">OFFICIAL MEDIA BROADCASTER</div>
                    <div style="font-size:9.5px; color:#64748b; font-weight:500; line-height:1.3;">
                        Jl. Kyai Dasuki No.1, Lebo, Kecamatan Sidoarjo, Kabupaten Sidoarjo, Jawa Timur 61223
                    </div>
                </div>
            </div>

            <!-- Document Title & Number -->
            <div style="text-align:center; margin:18px 0 14px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px;">
                    <?php echo esc_html(strtoupper($doc_found['jenis_surat'])); ?>
                </div>
                <div style="font-size:11px; font-weight:700; color:#475569; margin-top:5px;">
                    Nomor: <span><?php echo esc_html($doc_found['nomor_surat']); ?></span>
                </div>
            </div>

            <!-- Subkop Metadata -->
            <table style="width:100%; font-size:11px; color:#334155; margin:12px 0 20px; border-collapse:collapse; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                <tbody>
                    <tr>
                        <td style="padding:9px 16px; width:32%; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;"><?php echo esc_html($doc_found['label_kegiatan'] ?? 'Nama Kegiatan'); ?></td>
                        <td style="padding:9px 16px; font-weight:700; color:#0f172a; border-bottom:1px solid #e2e8f0;"><?php echo esc_html($doc_found['kegiatan'] ?: '-'); ?></td>
                    </tr>
                    <tr>
                        <td style="padding:9px 16px; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Tanggal Berlaku</td>
                        <td style="padding:9px 16px; font-weight:700; color:#0e4f40; border-bottom:1px solid #e2e8f0;">
                            <?php 
                                $t_start = ptv_format_id_date($doc_found['tanggal_mulai']);
                                $t_end   = ptv_format_id_date($doc_found['tanggal_selesai']);
                                echo esc_html(!empty($doc_found['tanggal_selesai']) && $doc_found['tanggal_mulai'] !== $doc_found['tanggal_selesai'] ? ($t_start . ' s.d. ' . $t_end) : $t_start);
                            ?>
                        </td>
                    </tr>
                    <?php if (!empty($doc_found['lokasi'])): ?>
                    <tr>
                        <td style="padding:9px 16px; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Lokasi / Penugasan</td>
                        <td style="padding:9px 16px; font-weight:700; color:#0f172a; border-bottom:1px solid #e2e8f0;"><?php echo esc_html($doc_found['lokasi']); ?></td>
                    </tr>
                    <?php endif; ?>
                    <?php if (!empty($doc_found['pembawa'])): ?>
                    <tr>
                        <td style="padding:9px 16px; font-weight:600; color:#475569;">Penanggung Jawab / Pembawa</td>
                        <td style="padding:9px 16px; font-weight:700; color:#0f172a;"><?php echo esc_html($doc_found['pembawa']); ?></td>
                    </tr>
                    <?php endif; ?>
                </tbody>
            </table>

            <!-- Roster / Table Details -->
            <div style="margin-bottom:24px;">
                <?php if (!empty($doc_found['santri_list'])): ?>
                    <p style="font-size:11.5px; color:#334155; line-height:1.6; margin:0 0 10px; font-weight:500;">
                        Dengan ini memberikan izin resmi kepada santri-santri yang tercantum pada daftar di bawah ini untuk mengikuti kegiatan sebagaimana tersebut di atas:
                    </p>
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background-color:#0e4f40; color:#ffffff; font-weight:700; text-align:center;">
                                <th style="padding:8px 6px; border:1px solid #0e4f40; width:32px; text-align:center;">NO</th>
                                <th style="padding:8px 12px; border:1px solid #0e4f40; text-align:left; min-width:150px;">NAMA SANTRI</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">UNIT</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">KELAS</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">ANGKATAN</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">CATATAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($doc_found['santri_list'] as $i => $s): 
                                $bg = ($i % 2 === 0) ? '#ffffff' : '#f8fafc';
                                $nama = is_array($s) ? ($s['nama'] ?? '-') : (is_string($s) ? $s : '-');
                                $unit = is_array($s) ? ($s['unit'] ?? '-') : '-';
                                $kelas = is_array($s) ? ($s['kelas'] ?? '-') : '-';
                                $angk = is_array($s) ? ($s['angkatan'] ?? '-') : '-';
                                $cat = is_array($s) ? ($s['jobdesc'] ?? ($s['catatan'] ?? '-')) : '-';
                            ?>
                                <tr style="background-color:<?php echo $bg; ?>; color:#1e293b; page-break-inside:avoid;">
                                    <td style="padding:7px 6px; border:1px solid #cbd5e1; text-align:center; font-weight:500; color:#64748b;"><?php echo ($i+1); ?></td>
                                    <td style="padding:7px 12px; border:1px solid #cbd5e1; font-weight:700; color:#0f172a; white-space:nowrap;"><?php echo esc_html($nama); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;"><?php echo esc_html($unit); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;"><?php echo esc_html($kelas); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;"><?php echo esc_html($angk); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center; color:#0e4f40; font-weight:600;"><?php echo esc_html($cat); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php elseif (!empty($doc_found['kru_list'])): ?>
                    <p style="font-size:11.5px; color:#334155; line-height:1.6; margin:0 0 10px; font-weight:500;">
                        Pimpinan Progresif TV dengan ini memberikan penugasan operasional resmi kepada nama-nama kru di bawah ini untuk melaksanakan tugas dan tanggung jawab pada kegiatan tersebut:
                    </p>
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background-color:#0e4f40; color:#ffffff; font-weight:700; text-align:center;">
                                <th style="padding:8px 6px; border:1px solid #0e4f40; width:32px; text-align:center;">NO</th>
                                <th style="padding:8px 12px; border:1px solid #0e4f40; text-align:left; min-width:160px;">NAMA KRU</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">PERAN / JABATAN</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">CATATAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($doc_found['kru_list'] as $i => $k): 
                                $bg = ($i % 2 === 0) ? '#ffffff' : '#f8fafc';
                            ?>
                                <tr style="background-color:<?php echo $bg; ?>; color:#1e293b; page-break-inside:avoid;">
                                    <td style="padding:7px 6px; border:1px solid #cbd5e1; text-align:center; color:#64748b;"><?php echo ($i+1); ?></td>
                                    <td style="padding:7px 12px; border:1px solid #cbd5e1; font-weight:700; color:#0f172a;"><?php echo esc_html($k['nama']); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center; font-weight:700; color:#0e4f40;"><?php echo esc_html($k['peran']); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;"><?php echo esc_html($k['catatan']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php elseif (!empty($doc_found['barang_list'])): ?>
                    <p style="font-size:11.5px; color:#334155; line-height:1.6; margin:0 0 10px; font-weight:500;">
                        Dengan ini memberikan izin operasional resmi untuk membawa dan mempergunakan peralatan/inventaris Progresif TV di bawah ini sesuai peruntukan:
                    </p>
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background-color:#0e4f40; color:#ffffff; font-weight:700; text-align:center;">
                                <th style="padding:8px 6px; border:1px solid #0e4f40; width:32px; text-align:center;">NO</th>
                                <th style="padding:8px 12px; border:1px solid #0e4f40; text-align:left; min-width:200px;">NAMA PERALATAN / BARANG</th>
                                <th style="padding:8px 8px; border:1px solid #0e4f40; text-align:center;">KETERANGAN / KONDISI</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($doc_found['barang_list'] as $i => $b): 
                                $bg = ($i % 2 === 0) ? '#ffffff' : '#f8fafc';
                                $b_nama = is_array($b) ? ($b['nama'] ?? ($b['item'] ?? '-')) : (string)$b;
                                $b_note = is_array($b) ? ($b['catatan'] ?? ($b['notes'] ?? '-')) : '-';
                            ?>
                                <tr style="background-color:<?php echo $bg; ?>; color:#1e293b; page-break-inside:avoid;">
                                    <td style="padding:7px 6px; border:1px solid #cbd5e1; text-align:center; color:#64748b;"><?php echo ($i+1); ?></td>
                                    <td style="padding:7px 12px; border:1px solid #cbd5e1; font-weight:700; color:#0f172a;"><?php echo esc_html($b_nama); ?></td>
                                    <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;"><?php echo esc_html($b_note); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>

            <!-- Official Footer & Stamp QR -->
            <div style="border-top:1px solid #cbd5e1; padding-top:16px; margin-top:24px; page-break-inside:avoid;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:20px;">
                    <div style="flex:1; font-size:9.5px; color:#64748b; line-height:1.5;">
                        <div style="color:#94a3b8; font-size:10px; margin-bottom:4px;">
                            This document was automatically issued and verified by the Progresif TV Digital System.
                        </div>
                        <div style="font-size:8.5px; color:#94a3b8;">
                            Dokumen ini sah secara elektronik dan terdaftar di portal resmi <code><?php echo esc_html(home_url('/verifikasi-surat/')); ?></code>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:14px; text-align:right; flex-shrink:0;">
                        <?php if (!empty($doc_found['penerbit']) && strcasecmp(trim($doc_found['penerbit']), 'Progresif TV') !== 0): ?>
                        <div>
                            <div style="font-size:11px; color:#475569; margin-bottom:2px;">Disahkan oleh:</div>
                            <div style="font-size:13px; font-weight:800; color:#0f172a;"><?php echo esc_html($doc_found['penerbit']); ?></div>
                            <div style="font-size:9px; font-weight:800; color:#0e4f40; margin-top:2px;">PROGRESIF TV</div>
                        </div>
                        <?php endif; ?>
                        <div id="printQrSlot" style="padding:4px; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; display:inline-block;">
                            <!-- QR rendered by JS -->
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
    <?php endif; ?>

    <script src="<?php echo esc_url(get_template_directory_uri() . '/js/qrcode.min.js'); ?>"></script>
    <script>
    function qrSVG(text, size, opts) {
        size = size || 110;
        const margin = (opts && typeof opts.margin === 'number') ? opts.margin : 4;
        try {
            if (typeof qrcode === 'function') {
                const qr = qrcode(0, 'M');
                qr.addData(String(text || ''), 'Byte');
                qr.make();
                const count = qr.getModuleCount();
                const cellSize = 4;
                const totalDim = (count + margin * 2) * cellSize;
                let d = '';
                for (let r = 0; r < count; r++) {
                    for (let c = 0; c < count; c++) {
                        if (qr.isDark(r, c)) {
                            const x = (c + margin) * cellSize;
                            const y = (r + margin) * cellSize;
                            d += `M${x} ${y}h${cellSize}v${cellSize}h-${cellSize}z `;
                        }
                    }
                }
                return `<svg class="qr" width="${size}" height="${size}" viewBox="0 0 ${totalDim} ${totalDim}" shape-rendering="crispEdges" aria-label="Kode QR Resmi" style="display:block;background:#ffffff;border-radius:2px;"><rect width="${totalDim}" height="${totalDim}" fill="#ffffff"/><path d="${d.trim()}" fill="#000000"/></svg>`;
            }
        } catch(err) {
            console.error('Failed to generate QR Code:', err);
        }
        return `<div style="width:${size}px;height:${size}px;background:#fff;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b;">QR Error</div>`;
    }

    async function ensureHtml2Pdf() {
        if (typeof window.html2pdf !== 'undefined') return true;
        return new Promise(function(resolve) {
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            s.onload = function() { resolve(true); };
            s.onerror = function() {
                var s2 = document.createElement('script');
                s2.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
                s2.onload = function() { resolve(true); };
                s2.onerror = function() { resolve(false); };
                document.head.appendChild(s2);
            };
            document.head.appendChild(s);
        });
    }

    async function ptvDownloadSuratPdf() {
        var isValidDoc = <?php echo (!empty($doc_found['is_valid'])) ? 'true' : 'false'; ?>;
        if (!isValidDoc) {
            alert('Dokumen ini belum disahkan atau belum berstatus resmi. Unduhan PDF resmi tidak tersedia.');
            return;
        }

        var btnPage = document.getElementById('btnPageDownloadPdf');
        var origPage = btnPage ? btnPage.innerHTML : '';

        if (btnPage) { btnPage.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses PDF...'; btnPage.disabled = true; }

        try {
            var isReady = await ensureHtml2Pdf();
            if (!isReady || typeof window.html2pdf === 'undefined') {
                alert('Modul PDF generator sedang dimuat. Silakan coba klik lagi dalam beberapa detik.');
                return;
            }

            var target = document.getElementById('officialVerifPrintArea');
            if (!target) {
                alert('Elemen template cetak resmi tidak ditemukan.');
                return;
            }

            // Generate verified QR code
            var qrSlot = document.getElementById('printQrSlot');
            if (qrSlot) {
                var vUrl = <?php echo wp_json_encode(home_url('/verifikasi-surat/?nomor=' . urlencode($doc_found['nomor_surat'] ?? ''))); ?>;
                qrSlot.innerHTML = qrSVG(vUrl, 68);
            }

            var docNo = <?php echo wp_json_encode($doc_found['nomor_surat'] ?? 'Surat_Resmi'); ?>;
            var cleanDocName = docNo.replace(/[^a-zA-Z0-9_-]/g, '_');

            var opt = {
                margin: 0,
                filename: `Surat-Resmi-PTV_${cleanDocName}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await window.html2pdf().set(opt).from(target).save();

        } catch(err) {
            console.error('PDF Download Error:', err);
            alert('Terjadi kesalahan teknis saat mengunduh PDF.');
        } finally {
            if (btnPage) { btnPage.innerHTML = origPage; btnPage.disabled = false; }
        }
    }
    window.ptvDownloadSuratPdf = ptvDownloadSuratPdf;

    // Auto populate QR in print template on load if present
    document.addEventListener('DOMContentLoaded', function() {
        var qrSlot = document.getElementById('printQrSlot');
        if (qrSlot) {
            var vUrl = <?php echo wp_json_encode(home_url('/verifikasi-surat/?nomor=' . urlencode($doc_found['nomor_surat'] ?? ''))); ?>;
            qrSlot.innerHTML = qrSVG(vUrl, 68);
        }
        if (window.location.search.includes('download=1')) {
            setTimeout(function() {
                if (typeof ptvDownloadSuratPdf === 'function') {
                    ptvDownloadSuratPdf();
                }
            }, 500);
        }
    });
    </script>
</body>
</html>
