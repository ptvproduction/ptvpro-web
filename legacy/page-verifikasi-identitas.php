<?php
/**
 * Template Name: Verifikasi Identitas Resmi Kru PTV
 * Description: Portal Publik Verifikasi Keabsahan Identitas Anggota & Kru Progresif TV
 * Desain: Terintegrasi dengan PTV Dashboard Design System (Azure / Slate Midnight Luxury)
 */

// Nonaktifkan cache untuk memastikan hasil verifikasi real-time dan akurat
nocache_headers();

global $wpdb;

// Helper normalisasi canonical PTV-ID (Smart ID: 1 -> PTV-001, 25 -> PTV-025, ptv-25 -> PTV-025)
if (!function_exists('ptv_normalize_crew_id')) {
    function ptv_normalize_crew_id($raw) {
        $raw = strtoupper(trim(preg_replace('/\s+/', '', (string)$raw)));
        if (empty($raw)) return '';
        
        // Buang duplikasi awalan PTV / PTV- (misal PTV-PTV-025, PTV-025, ptv-25, dll)
        $part = preg_replace('/^(PTV-?)+/i', '', $raw);
        if ($part === '') return '';
        
        // Jika angka saja: 1 -> PTV-001, 25 -> PTV-025, 881 -> PTV-881
        if (ctype_digit($part)) {
            return 'PTV-' . str_pad($part, 3, '0', STR_PAD_LEFT);
        }
        
        return 'PTV-' . $part;
    }
}

// 1. Ambil parameter ID PTV (crew_id, id, kru, q)
$id_query = trim((string)sanitize_text_field($_GET['id'] ?? ($_GET['crew_id'] ?? ($_GET['kru'] ?? ($_GET['q'] ?? '')))));
if (empty($id_query)) {
    $req_path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $site_path = trim((string)parse_url(home_url(), PHP_URL_PATH), '/');
    $trimmed_path = trim((string)$req_path, '/');
    if ($site_path && str_starts_with($trimmed_path, $site_path)) {
        $trimmed_path = trim(substr($trimmed_path, strlen($site_path)), '/');
    }
    if (preg_match('#^verifikasi-identitas/(.+)$#i', $trimmed_path, $m)) {
        $id_query = urldecode(trim($m[1], '/'));
    }
}

// Normalisasi canonical PTV-ID
$id_query_clean    = ptv_normalize_crew_id($id_query);
$display_input_num = !empty($id_query_clean) ? preg_replace('/^PTV-/i', '', $id_query_clean) : '';

if (!function_exists('ptv_normalize_person_name')) {
    function ptv_normalize_person_name($str) {
        $s = strtolower(trim((string)$str));
        $s = str_replace(["'", '`', '’', '.', ',', '-', '_'], '', $s);
        $s = preg_replace('/\s+/', ' ', $s);
        return trim($s);
    }
}

if (!function_exists('ptv_is_name_match')) {
    function ptv_is_name_match($name1, $name2) {
        $n1 = ptv_normalize_person_name($name1);
        $n2 = ptv_normalize_person_name($name2);
        if ($n1 === '' || $n2 === '') return false;
        if ($n1 === $n2) return true;

        // Direct containment if length >= 6 and matching word boundary
        if (strlen($n1) >= 6 && strlen($n2) >= 6) {
            if ($n1 === $n2) return true;
            if (preg_match('/\b' . preg_quote($n1, '/') . '\b/', $n2) || preg_match('/\b' . preg_quote($n2, '/') . '\b/', $n1)) {
                return true;
            }
        }

        // Levenshtein on full name for minor typos/transpositions (length >= 8)
        $len1 = strlen($n1);
        $len2 = strlen($n2);
        if ($len1 >= 8 && $len2 >= 8 && abs($len1 - $len2) <= 3) {
            if (levenshtein($n1, $n2) <= 3) return true;
        }

        // Word similarity with high threshold (>=85%) and first-word agreement
        $w1 = explode(' ', $n1);
        $w2 = explode(' ', $n2);
        if (count($w1) >= 2 && count($w2) >= 2) {
            if ($w1[0] === $w2[0] || (strlen($w1[0]) >= 4 && levenshtein($w1[0], $w2[0]) <= 1)) {
                similar_text($n1, $n2, $pct);
                if ($pct >= 85) return true;
            }
        }

        return false;
    }
}

if (!function_exists('ptv_is_crew_in_doc')) {
    function ptv_is_crew_in_doc($row, $kru_data) {
        if (empty($row) || empty($kru_data)) return false;
        $k_nama = $kru_data['nama'] ?? '';
        $k_cid  = $kru_data['crew_id'] ?? '';
        $k_uuid = $kru_data['id'] ?? '';

        // Direct person fields
        if (!empty($row['nama_santri']) && ptv_is_name_match($row['nama_santri'], $k_nama)) return true;
        if (!empty($row['penanggung_jawab']) && ptv_is_name_match($row['penanggung_jawab'], $k_nama)) return true;
        if (!empty($row['pembawa']) && ptv_is_name_match($row['pembawa'], $k_nama)) return true;
        if (!empty($row['diajukan_oleh']) && ptv_is_name_match($row['diajukan_oleh'], $k_nama)) return true;
        if (!empty($row['disetujui_oleh']) && ptv_is_name_match($row['disetujui_oleh'], $k_nama)) return true;

        // santri_list (JSON or array)
        if (!empty($row['santri_list'])) {
            $sl = is_string($row['santri_list']) ? json_decode($row['santri_list'], true) : $row['santri_list'];
            if (is_array($sl)) {
                foreach ($sl as $s) {
                    $s_name = is_array($s) ? ($s['nama'] ?? '') : (string)$s;
                    if (!empty($s_name) && ptv_is_name_match($s_name, $k_nama)) return true;
                    if (is_array($s)) {
                        if (!empty($k_cid) && !empty($s['crew_id']) && strcasecmp($s['crew_id'], $k_cid) === 0) return true;
                        if (!empty($k_uuid) && !empty($s['id']) && $s['id'] === $k_uuid) return true;
                    }
                }
            }
        }

        // kru_assigned (JSON or array or comma-separated string)
        if (!empty($row['kru_assigned'])) {
            $ka = is_string($row['kru_assigned']) ? json_decode($row['kru_assigned'], true) : $row['kru_assigned'];
            if (is_array($ka)) {
                foreach ($ka as $k) {
                    $kn = is_array($k) ? ($k['nama'] ?? '') : (string)$k;
                    if (!empty($kn) && ptv_is_name_match($kn, $k_nama)) return true;
                    if (is_array($k)) {
                        if (!empty($k_cid) && !empty($k['crew_id']) && strcasecmp($k['crew_id'], $k_cid) === 0) return true;
                        if (!empty($k_uuid) && !empty($k['id']) && $k['id'] === $k_uuid) return true;
                    }
                }
            } elseif (is_string($row['kru_assigned'])) {
                if (ptv_is_name_match($row['kru_assigned'], $k_nama)) return true;
            }
        }

        // Explicit crew_id identifier mentions
        if (!empty($k_cid)) {
            if (!empty($row['pembawa']) && stripos($row['pembawa'], $k_cid) !== false) return true;
            if (!empty($row['penanggung_jawab']) && stripos($row['penanggung_jawab'], $k_cid) !== false) return true;
            if (!empty($row['nama_santri']) && stripos($row['nama_santri'], $k_cid) !== false) return true;
        }

        return false;
    }
}

// 2. ATURAN: SOURCE OF TRUTH MURNI DARI SUPABASE ptv_kru
// Dilarang keras fallback ke CPT kru_ptv untuk data identitas publik.
$kru_data    = null;
$kru_found   = false;
$cpt_post_id = 0;

if (!empty($id_query_clean) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
    $sb_rows = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($id_query_clean) . '&limit=1');
    if (empty($sb_rows) || !isset($sb_rows[0]['id'])) {
        // Cari alternatif berdasarkan nama kru langsung jika input berupa nama
        $clean_search = trim(preg_replace('/[^a-zA-Z0-9 ]/', '', $id_query));
        if (!empty($clean_search)) {
            $sb_rows = PTV_Supabase::select('ptv_kru', '?nama=ilike.*' . urlencode($clean_search) . '*&limit=1');
        }
    }

    if (!empty($sb_rows) && is_array($sb_rows) && !empty($sb_rows[0]['id'])) {
        $kru_data  = $sb_rows[0];
        $kru_found = true;
        if (!empty($kru_data['crew_id'])) {
            $id_query_clean    = $kru_data['crew_id'];
            $display_input_num = preg_replace('/^PTV-/i', '', $id_query_clean);
        }

        // Ambil CPT post ID jika ada, HANYA untuk relasi riwayat surat/project WordPress lokal
        $posts = get_posts([
            'post_type'      => 'kru_ptv',
            'posts_per_page' => 1,
            'post_status'    => 'publish',
            'meta_query'     => [['key' => 'ptv_kru_crew_id', 'value' => $kru_data['crew_id'] ?? $id_query_clean]],
        ]);
        if (!empty($posts)) {
            $cpt_post_id = (int)$posts[0]->ID;
        }
    }
}

// 3. Ambil Seluruh Dokumen & Izin Aktif HARI INI (Real-time Live Scan dari Supabase & Mirror)
$today_ymd = current_time('Y-m-d');
if (!empty($_GET['tanggal'])) {
    $custom_tgl = sanitize_text_field($_GET['tanggal']);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $custom_tgl)) {
        $today_ymd = $custom_tgl;
    }
} elseif (!empty($_GET['date'])) {
    $custom_tgl = sanitize_text_field($_GET['date']);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $custom_tgl)) {
        $today_ymd = $custom_tgl;
    }
}

$surat_izin_aktif_hari_ini   = [];
$surat_barang_aktif_hari_ini = [];
$surat_tugas_aktif_hari_ini  = [];

if ($kru_found && $kru_data) {
    $kru_nama = trim((string)($kru_data['nama'] ?? ''));

    // ========================================================
    // A. CEK SURAT IZIN RESMI (SI) AKTIF HARI INI (SUPABASE + MIRROR)
    // ========================================================
    // 1. Supabase ptv_surat_izin (Realtime Single Source of Truth)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && !empty($kru_nama)) {
        $sb_izin = PTV_Supabase::select('ptv_surat_izin', '?select=id,nomor_surat,jenis_kegiatan,nama_santri,alasan,santri_list,tanggal_mulai,tanggal_selesai,status,diajukan_oleh,disetujui_oleh,created_at&tanggal_mulai=lte.' . $today_ymd . '&order=created_at.desc&limit=100');
        if (is_array($sb_izin)) {
            foreach ($sb_izin as $row) {
                $status = strtolower(trim((string)($row['status'] ?? '')));
                if ($status !== 'disetujui' && $status !== 'aktif') continue;

                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr((string)($row['tanggal_mulai'] ?? ''), 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr((string)$row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;

                // TENGGAT WAKTU: HANYA jika hari ini dalam rentang [tanggal_mulai s/d tanggal_selesai]
                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {

                        // Ambil daftar kru / santri yang terlibat & alasan personal santri
                        $alasan_kru = '';
                        $all_santri_names = [];
                        if (!empty($row['santri_list'])) {
                            $sl = is_string($row['santri_list']) ? json_decode($row['santri_list'], true) : $row['santri_list'];
                            if (is_array($sl)) {
                                foreach ($sl as $s) {
                                    $s_name = is_array($s) ? ($s['nama'] ?? '') : (string)$s;
                                    if (!empty($s_name)) {
                                        $all_santri_names[] = trim($s_name);
                                    }
                                    if (ptv_is_name_match($s_name, $kru_nama)) {
                                        if (is_array($s) && !empty($s['alasan'])) {
                                            $alasan_kru = $s['alasan'];
                                        }
                                    }
                                }
                            }
                        }
                        if (empty($all_santri_names) && !empty($row['nama_santri'])) {
                            $all_santri_names[] = trim($row['nama_santri']);
                        }

                        $surat_izin_aktif_hari_ini[$num] = [
                            'nomor'        => $num,
                            'jenis'        => 'Surat Izin Resmi Santri/Kru',
                            'kegiatan'     => $row['jenis_kegiatan'] ?? ($row['kegiatan'] ?? 'Izin Kegiatan Kedinasan'),
                            'alasan'       => $alasan_kru ?: ($row['alasan'] ?? ''),
                            'tanggal_m'    => $tgl_m,
                            'tanggal_s'    => $tgl_s,
                            'status'       => 'Izin Resmi Aktif',
                            'kru_terlibat' => array_values(array_unique($all_santri_names)),
                        ];
                    }
                }
            }
        }
    }

    // 2. WPDB ptv_surat_izin fallback / mirror
    $table_si = $wpdb->prefix . 'ptv_surat_izin';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_si}'") === $table_si && !empty($kru_nama)) {
        $si_rows = $wpdb->get_results("SELECT * FROM {$table_si} WHERE status IN ('disetujui', 'aktif') ORDER BY id DESC LIMIT 100", ARRAY_A);
        if (!empty($si_rows)) {
            foreach ($si_rows as $row) {
                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr($row['tanggal_mulai'] ?? '', 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;
                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {
                        if (!isset($surat_izin_aktif_hari_ini[$num])) {
                            $all_names = [];
                            if (!empty($row['santri_list'])) {
                                $sl = json_decode($row['santri_list'], true);
                                if (is_array($sl)) {
                                    foreach ($sl as $s) {
                                        $s_n = is_array($s) ? ($s['nama'] ?? '') : (string)$s;
                                        if (!empty($s_n)) $all_names[] = trim($s_n);
                                    }
                                }
                            }
                            if (empty($all_names) && !empty($row['nama_santri'])) {
                                $all_names[] = trim($row['nama_santri']);
                            }
                            $surat_izin_aktif_hari_ini[$num] = [
                                'nomor'        => $num,
                                'jenis'        => 'Surat Izin Resmi Santri/Kru',
                                'kegiatan'     => $row['jenis_kegiatan'] ?? 'Izin Kegiatan',
                                'alasan'       => $row['alasan'] ?? '',
                                'tanggal_m'    => $tgl_m,
                                'tanggal_s'    => $tgl_s,
                                'status'       => 'Izin Resmi Aktif',
                                'kru_terlibat' => array_values(array_unique($all_names)),
                            ];
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // B. CEK SURAT BAWA BARANG (SBB) AKTIF HARI INI
    // ========================================================
    // 1. Supabase ptv_surat_barang (Realtime Single Source of Truth)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && !empty($kru_nama)) {
        $sb_barang = PTV_Supabase::select('ptv_surat_barang', '?select=id,nomor_surat,keperluan,pembawa,penanggung_jawab,daftar_barang,catatan,tanggal_mulai,tanggal_selesai,status,created_at&tanggal_mulai=lte.' . $today_ymd . '&order=created_at.desc&limit=100');
        if (is_array($sb_barang)) {
            foreach ($sb_barang as $row) {
                $status = strtolower(trim((string)($row['status'] ?? '')));
                if ($status !== 'disetujui' && $status !== 'aktif') continue;

                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr((string)($row['tanggal_mulai'] ?? ''), 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr((string)$row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;

                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {

                        $raw_barang = $row['daftar_barang'] ?? $row['catatan'] ?? '';
                        $decoded = json_decode($raw_barang, true);
                        $barang_text = '';
                        $barang_items = [];
                        if (is_array($decoded)) {
                            $names = [];
                            foreach ($decoded as $item) {
                                $b_name = $item['nama'] ?? ($item['name'] ?? 'Peralatan PTV');
                                $b_note = $item['catatan'] ?? ($item['notes'] ?? '');
                                $names[] = $b_name;
                                $barang_items[] = ['nama' => $b_name, 'catatan' => $b_note];
                            }
                            $barang_text = implode(', ', $names);
                        } else {
                            $barang_text = $raw_barang;
                            if (!empty($raw_barang)) {
                                $barang_items[] = ['nama' => $raw_barang, 'catatan' => ''];
                            }
                        }

                        $pembawa_str = trim((string)($row['pembawa'] ?? ''));
                        $pj_str = trim((string)($row['penanggung_jawab'] ?? ''));
                        $kru_terlibat_sbb = array_values(array_unique(array_filter([$pembawa_str, $pj_str])));

                        $surat_barang_aktif_hari_ini[$num] = [
                            'nomor'        => $num,
                            'jenis'        => 'Surat Izin Membawa Barang',
                            'keperluan'    => $row['keperluan'] ?? 'Izin Membawa Peralatan',
                            'barang'       => $barang_text,
                            'barang_items' => $barang_items,
                            'kru_terlibat' => $kru_terlibat_sbb,
                            'pembawa'      => $pembawa_str,
                            'tanggal_m'    => $tgl_m,
                            'tanggal_s'    => $tgl_s,
                            'status'       => 'Izin Membawa Aktif',
                        ];
                    }
                }
            }
        }
    }

    // 2. WPDB ptv_surat_barang fallback / mirror
    $table_sb = $wpdb->prefix . 'ptv_surat_barang';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_sb}'") === $table_sb && !empty($kru_nama)) {
        $sb_rows = $wpdb->get_results("SELECT * FROM {$table_sb} WHERE status IN ('disetujui', 'aktif') ORDER BY id DESC LIMIT 100", ARRAY_A);
        if (!empty($sb_rows)) {
            foreach ($sb_rows as $row) {
                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr($row['tanggal_mulai'] ?? '', 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;
                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {
                        if (!isset($surat_barang_aktif_hari_ini[$num])) {
                            $raw_barang = $row['daftar_barang'] ?? $row['catatan'] ?? '';
                            $decoded = json_decode($raw_barang, true);
                            $barang_text = '';
                            $barang_items = [];
                            if (is_array($decoded)) {
                                $names = [];
                                foreach ($decoded as $item) {
                                    $b_name = $item['nama'] ?? ($item['name'] ?? 'Peralatan PTV');
                                    $b_note = $item['catatan'] ?? ($item['notes'] ?? '');
                                    $names[] = $b_name;
                                    $barang_items[] = ['nama' => $b_name, 'catatan' => $b_note];
                                }
                                $barang_text = implode(', ', $names);
                            } else {
                                $barang_text = $raw_barang;
                                if (!empty($raw_barang)) {
                                    $barang_items[] = ['nama' => $raw_barang, 'catatan' => ''];
                                }
                            }

                            $pembawa_str = trim((string)($row['pembawa'] ?? ''));
                            $pj_str = trim((string)($row['penanggung_jawab'] ?? ''));
                            $kru_terlibat_sbb = array_values(array_unique(array_filter([$pembawa_str, $pj_str])));

                            $surat_barang_aktif_hari_ini[$num] = [
                                'nomor'        => $num,
                                'jenis'        => 'Surat Izin Membawa Barang',
                                'keperluan'    => $row['keperluan'] ?? 'Izin Membawa Peralatan',
                                'barang'       => $barang_text,
                                'barang_items' => $barang_items,
                                'kru_terlibat' => $kru_terlibat_sbb,
                                'pembawa'      => $pembawa_str,
                                'tanggal_m'    => $tgl_m,
                                'tanggal_s'    => $tgl_s,
                                'status'       => 'Izin Membawa Aktif',
                            ];
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // C. CEK SURAT TUGAS (ST) AKTIF HARI INI
    // ========================================================
    // 1. Supabase ptv_surat_tugas (Realtime Single Source of Truth)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && !empty($kru_nama)) {
        $sb_tugas = PTV_Supabase::select('ptv_surat_tugas', '?select=id,nomor_surat,nama_kegiatan,lokasi,tanggal_mulai,tanggal_selesai,penanggung_jawab,kru_assigned,catatan,status,created_at&tanggal_mulai=lte.' . $today_ymd . '&order=created_at.desc&limit=100');
        if (is_array($sb_tugas)) {
            foreach ($sb_tugas as $row) {
                $status = strtolower(trim((string)($row['status'] ?? '')));
                if ($status !== 'disetujui' && $status !== 'aktif') continue;

                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr((string)($row['tanggal_mulai'] ?? ''), 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr((string)$row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;

                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {
                        $is_pj = (!empty($row['penanggung_jawab']) && ptv_is_name_match($row['penanggung_jawab'], $kru_nama));

                        // Parse kru assigned
                        $assigned_names = [];
                        $raw_kru = $row['kru_assigned'] ?? '';
                        $dec_kru = is_string($raw_kru) ? json_decode($raw_kru, true) : $raw_kru;
                        if (is_array($dec_kru)) {
                            foreach ($dec_kru as $k) {
                                $k_n = is_array($k) ? ($k['nama'] ?? ($k['name'] ?? '')) : (string)$k;
                                if (!empty($k_n)) $assigned_names[] = trim($k_n);
                            }
                        } elseif (!empty($raw_kru)) {
                            foreach (explode(',', $raw_kru) as $p) {
                                if (!empty(trim($p))) $assigned_names[] = trim($p);
                            }
                        }
                        if (!empty($row['penanggung_jawab']) && !in_array(trim($row['penanggung_jawab']), $assigned_names)) {
                            array_unshift($assigned_names, trim($row['penanggung_jawab']));
                        }

                        $surat_tugas_aktif_hari_ini[$num] = [
                            'nomor'            => $num,
                            'jenis'            => 'Surat Tugas Resmi',
                            'kegiatan'         => $row['nama_kegiatan'] ?? ($row['kegiatan'] ?? 'Penugasan Kru'),
                            'lokasi'           => $row['lokasi'] ?? 'Area Operasional PTV',
                            'tanggal_m'        => $tgl_m,
                            'tanggal_s'        => $tgl_s,
                            'penanggung_jawab' => $row['penanggung_jawab'] ?? '',
                            'kru_terlibat'     => array_values(array_unique($assigned_names)),
                            'peran'            => $is_pj ? 'Penanggung Jawab' : 'Tim Kru Bertugas',
                            'status'           => 'Sedang Bertugas',
                        ];
                    }
                }
            }
        }
    }

    // 2. WPDB ptv_surat_tugas fallback / mirror
    $table_st  = $wpdb->prefix . 'ptv_surat_tugas';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_st}'") === $table_st && !empty($kru_nama)) {
        $st_rows = $wpdb->get_results("SELECT id, nomor_surat, nama_kegiatan, lokasi, tanggal_mulai, tanggal_selesai, penanggung_jawab, catatan, status FROM {$table_st} WHERE status IN ('disetujui', 'aktif') ORDER BY id DESC LIMIT 100", ARRAY_A);
        if (!empty($st_rows)) {
            foreach ($st_rows as $row) {
                $num = trim((string)($row['nomor_surat'] ?? ''));
                if (empty($num) || $num === '—' || str_contains($num, 'Menunggu')) continue;

                $tgl_m = substr($row['tanggal_mulai'] ?? '', 0, 10);
                $tgl_s = !empty($row['tanggal_selesai']) ? substr($row['tanggal_selesai'], 0, 10) : $tgl_m;
                if (empty($tgl_s) || $tgl_s === '0000-00-00') $tgl_s = $tgl_m;
                if ($tgl_m <= $today_ymd && $today_ymd <= $tgl_s) {
                    if (ptv_is_crew_in_doc($row, $kru_data)) {
                        if (!isset($surat_tugas_aktif_hari_ini[$num])) {
                            $is_pj = (!empty($row['penanggung_jawab']) && ptv_is_name_match($row['penanggung_jawab'], $kru_nama));
                            $assigned_names = [];
                            if (!empty($row['catatan']) && preg_match('/<!-- PTV_KRU:(.*?)-->/s', $row['catatan'], $km)) {
                                $dec_k = json_decode($km[1], true);
                                if (is_array($dec_k)) {
                                    foreach ($dec_k as $k) {
                                        $k_n = is_array($k) ? ($k['nama'] ?? '') : (string)$k;
                                        if (!empty($k_n)) $assigned_names[] = trim($k_n);
                                    }
                                }
                            }
                            if (!empty($row['penanggung_jawab']) && !in_array(trim($row['penanggung_jawab']), $assigned_names)) {
                                array_unshift($assigned_names, trim($row['penanggung_jawab']));
                            }
                            $surat_tugas_aktif_hari_ini[$num] = [
                                'nomor'            => $num,
                                'jenis'            => 'Surat Tugas Resmi',
                                'kegiatan'         => $row['nama_kegiatan'] ?? 'Penugasan Kru',
                                'lokasi'           => $row['lokasi'] ?? 'Area Operasional PTV',
                                'tanggal_m'        => $tgl_m,
                                'tanggal_s'        => $tgl_s,
                                'penanggung_jawab' => $row['penanggung_jawab'] ?? '',
                                'kru_terlibat'     => array_values(array_unique($assigned_names)),
                                'peran'            => $is_pj ? 'Penanggung Jawab' : 'Tim Kru Bertugas',
                                'status'           => 'Sedang Bertugas',
                            ];
                        }
                    }
                }
            }
        }
    }
}

// Logo Resmi Progresif TV (Deep Midnight Navy Edition) - Selalu melalui /wp-content
$bs_webp_upload = WP_CONTENT_DIR . '/uploads/BS-X-PTV-BLUE.webp';
$bs_png_upload  = WP_CONTENT_DIR . '/uploads/BS-X-PTV-BLUE.png';

if (file_exists($bs_webp_upload)) {
    $bs_logo_base = '/wp-content/uploads/BS-X-PTV-BLUE.webp';
    $bs_version   = filemtime($bs_webp_upload);
} elseif (file_exists($bs_png_upload)) {
    $bs_logo_base = '/wp-content/uploads/BS-X-PTV-BLUE.png';
    $bs_version   = filemtime($bs_png_upload);
} else {
    $bs_logo_base = '/wp-content/uploads/BS-X-PTV-BLUE.webp';
    $bs_version   = time();
}
$bs_logo_url = $bs_logo_base . '?v=' . $bs_version;

if (!function_exists('ptv_verif_format_date')) {
    function ptv_verif_format_date($d) {
        if (empty($d)) return '-';
        $p = explode('-', substr($d, 0, 10));
        if (count($p) !== 3) return $d;
        $bulan = [1=>'Jan',2=>'Feb',3=>'Mar',4=>'Apr',5=>'Mei',6=>'Jun',7=>'Jul',8=>'Agu',9=>'Sep',10=>'Okt',11=>'Nov',12=>'Des'];
        return (int)$p[2] . ' ' . ($bulan[(int)$p[1]] ?? '') . ' ' . $p[0];
    }
}

if (!function_exists('ptv_format_tgl_indo')) {
    function ptv_format_tgl_indo($timestamp = null) {
        if (!$timestamp) $timestamp = current_time('timestamp');
        $hari = ['Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa', 'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu'];
        $bulan = [1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'];
        $day_en = date('l', $timestamp);
        $d = date('j', $timestamp);
        $m = (int)date('n', $timestamp);
        $y = date('Y', $timestamp);
        $hari_id = $hari[$day_en] ?? $day_en;
        $bulan_id = $bulan[$m] ?? date('F', $timestamp);
        return "$hari_id, $d $bulan_id $y";
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title><?php echo $kru_found ? esc_attr(($kru_data['nama'] ?? '') . ' (' . ($kru_data['crew_id'] ?? '') . ') — Verifikasi Identitas PTV') : 'Verifikasi Identitas PTV'; ?></title>
    <meta name="description" content="Portal Verifikasi Identitas Resmi Anggota & Kru Progresif TV Pesantren Progresif Bumi Shalawat.">
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo esc_url(get_template_directory_uri() . '/assets/icons/favicon-32x32.png'); ?>">
    
    <!-- PTV Dashboard Design System Typography -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.cdnfonts.com/css/sf-pro-display" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous">

    <style>
        /* ============================================================
           PTV OPERATIONS — DESIGN SYSTEM TOKENS (LIGHT LUXURY AESTHETIC)
           ============================================================ */
        :root {
            --b-900: #072A52;
            --b-800: #0A3C74;
            --b-700: #0B5FBF;
            --b-600: #1273E6;
            --b-500: #3B8EF7;
            --b-400: #6FB0FF;
            --b-300: #A7CEFF;
            --b-100: #DCEBFF;
            --b-050: #EDF4FF;

            --bg: #F8FAFD;
            --bg-2: #F1F5FA;
            --surface: #FFFFFF;
            --surface-2: #F6F9FD;
            --surface-card: #FFFFFF;
            --glass: rgba(255, 255, 255, 0.88);
            --ink: #0B2A4A;
            --ink-2: #38587A;
            --muted: #6E8CAE;
            --line: rgba(11, 42, 74, 0.10);
            --line-2: rgba(11, 42, 74, 0.055);

            --ok: #0F7A5A;
            --ok-bg: #E1F5EE;
            --ok-border: rgba(15, 122, 90, 0.22);
            --warn: #975A16;
            --warn-bg: #FEF3C7;
            --dang: #B02B23;
            --dang-bg: #FDE8E6;
            --dang-border: rgba(176, 43, 35, 0.22);

            --shadow-s: 0 1px 3px rgba(11, 42, 74, 0.04), 0 2px 6px rgba(11, 42, 74, 0.04);
            --shadow-m: 0 4px 14px rgba(11, 42, 74, 0.06), 0 14px 32px rgba(11, 42, 74, 0.05);
            --shadow-card: 0 4px 20px rgba(11, 60, 116, 0.06), 0 1px 3px rgba(11, 60, 116, 0.04);
            --shadow-blue: 0 10px 28px rgba(18, 115, 230, 0.28);

            --r-s: 12px;
            --r-m: 16px;
            --r-l: 22px;
            --r-full: 999px;

            --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            font-family: var(--font);
            color: var(--ink);
            background-color: var(--bg);
            min-height: 100vh;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
        }

        body::before {
            content: "";
            position: fixed;
            inset: 0;
            height: 100%;
            z-index: -2;
            pointer-events: none;
            background:
                radial-gradient(ellipse 70% 50% at 50% -5%, rgba(216, 233, 254, 0.7) 0%, transparent 65%),
                radial-gradient(ellipse 60% 45% at 90% 90%, rgba(220, 235, 255, 0.6) 0%, transparent 60%),
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
                linear-gradient(to right, rgba(0, 55, 138, 0.025) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 55, 138, 0.025) 1px, transparent 1px);
            background-size: 28px 28px;
            -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 95%);
            mask-image: radial-gradient(ellipse 85% 75% at 50% 35%, #000 35%, transparent 95%);
            opacity: 0.7;
        }

        .container {
            width: 100%;
            max-width: 520px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 32px 18px 64px;
            animation: fadeIn 0.28s ease both;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ── BRAND HEADER ── */
        .brand-header {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding-bottom: 2px;
        }
        .brand-logo-img {
            height: 46px;
            width: auto;
            object-fit: contain;
            filter: drop-shadow(0 2px 8px rgba(11, 42, 74, 0.08));
        }
        .brand-sub {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--muted);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .brand-sub::before, .brand-sub::after {
            content: "";
            width: 20px;
            height: 1px;
            background: var(--line);
        }

        /* ── VERIFIED STATUS PILL ── */
        .status-pill-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .verif-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 20px;
            border-radius: var(--r-full);
            font-size: 12px;
            font-weight: 750;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .verif-pill.ok {
            background: #EDF4FF;
            color: #0B5FBF;
            border: 1px solid rgba(18, 115, 230, 0.28);
            box-shadow: 0 2px 14px rgba(18, 115, 230, 0.14);
        }
        .verif-pill.bad {
            background: var(--dang-bg);
            color: var(--dang);
            border: 1px solid var(--dang-border);
            box-shadow: 0 2px 12px rgba(176, 43, 35, 0.12);
        }
        .dot-pulse {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #1273E6;
            box-shadow: 0 0 8px #1273E6;
            animation: pulseDot 2s infinite ease-in-out;
        }
        @keyframes pulseDot {
            0%, 100% { transform: scale(0.9); opacity: 0.85; }
            50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 12px #1273E6; }
        }

        /* ── KARTU IDENTITAS RESMI PROGRESIF TV (PORTRAIT DIGITAL BADGE) ── */
        .idcard-holder-wrap {
            max-width: 360px;
            width: 100%;
            margin: 0 auto;
            position: relative;
            font-family: 'SF Pro Display', 'SF Pro Text', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .idcard {
            position: relative;
            overflow: hidden;
            border-radius: 24px;
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: linear-gradient(165deg, #071F48 0%, #0A2E70 42%, #051636 100%);
            border: 1.5px solid rgba(96, 165, 250, 0.28);
            box-shadow: 0 24px 50px -10px rgba(2, 14, 38, 0.5), 0 8px 24px rgba(2, 14, 38, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2);
            color: #FFFFFF;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
        }
        .idcard:hover {
            transform: translateY(-2px);
            box-shadow: 0 28px 56px -10px rgba(2, 14, 38, 0.58), 0 12px 28px rgba(2, 14, 38, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.25);
        }

        /* Ambient SVG Wave Background */
        .idcard-bg-layer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 0;
        }
        .idcard-bg-waves {
            width: 100%;
            height: 100%;
            object-fit: fill;
            display: block;
        }

        /* Card Body */
        .idcard-body {
            padding: 20px 20px 16px;
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 1;
        }

        /* Top Bar: Brand & QR */
        .idcard-top-bar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
            min-height: 72px;
        }
        .idcard-brand-box {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .idcard-logo-img {
            display: block;
            max-width: 145px;
            height: 26px;
            width: auto;
            object-fit: contain;
        }
        .idcard-logo-white {
            display: block;
            max-width: 145px;
            height: 26px;
            width: auto;
            object-fit: contain;
        }
        .idcard-brand-label {
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.12em;
            color: #7DD3FC;
            text-transform: uppercase;
        }
        .idcard-qr-box {
            width: 72px;
            height: 72px;
            background: #FFFFFF;
            border-radius: 12px;
            padding: 4px;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .idcard-qr-box svg, .idcard-qr-box img {
            width: 64px;
            height: 64px;
            display: block;
        }

        /* Photo Frame */
        .idcard-photo-frame {
            width: 100%;
            aspect-ratio: 1 / 1.08;
            border-radius: 16px;
            overflow: hidden;
            background: #081B38;
            border: 2px solid rgba(255, 255, 255, 0.22);
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);
            position: relative;
            flex-shrink: 0;
        }
        .idcard-photo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 20%;
            display: block;
        }
        .idcard-photo-fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(145deg, #1D4ED8 0%, #0A2F72 100%);
            color: #FFFFFF;
            font-weight: 900;
            font-size: 42px;
            letter-spacing: 0.05em;
            font-family: inherit;
        }

        /* Crew Name */
        .idcard-identity-block {
            margin-top: 14px;
            margin-bottom: 12px;
        }
        .idcard-person-name {
            font-size: clamp(20px, 4.8vw, 23px);
            font-weight: 900;
            line-height: 1.15;
            letter-spacing: -0.025em;
            color: #FFFFFF;
            text-transform: uppercase;
            word-break: break-word;
            text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        /* Credentials Grid */
        .idcard-creds-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
        }
        .idcard-cred-item {
            min-width: 0;
        }
        .idcard-cred-lbl {
            font-size: 8.5px;
            font-weight: 800;
            color: #7DD3FC;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .idcard-cred-val {
            font-size: 13.5px;
            font-weight: 850;
            color: #FFFFFF;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            line-height: 1.25;
            word-break: break-word;
        }
        .idcard-cred-val.font-mono {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace;
            letter-spacing: 0.05em;
        }
        .idcard-status-dot {
            display: none !important;
        }

        /* Footer Strip */
        .idcard-footer-strip {
            background: rgba(4, 18, 42, 0.7);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            height: 38px;
            padding: 0 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            z-index: 1;
        }
        .idcard-footer-brand {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.12em;
            color: #FFFFFF;
            text-transform: uppercase;
        }
        .idcard-footer-expiry {
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #93C5FD;
            text-transform: uppercase;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace;
        }

        @media (max-width: 480px) {
            .idcard-holder-wrap {
                max-width: 100%;
            }
            .idcard {
                border-radius: 20px;
            }
            .idcard-body {
                padding: 16px 16px 14px;
            }
            .idcard-top-bar {
                margin-bottom: 12px;
                min-height: 64px;
            }
            .idcard-logo-white {
                width: 120px;
                height: 25px;
            }
            .idcard-qr-box {
                width: 64px;
                height: 64px;
                border-radius: 10px;
            }
            .idcard-qr-box svg, .idcard-qr-box img {
                width: 56px;
                height: 56px;
            }
            .idcard-photo-frame {
                border-radius: 14px;
            }
            .idcard-person-name {
                font-size: 19px;
            }
            .idcard-creds-grid {
                padding: 8px 10px;
                gap: 6px 10px;
            }
            .idcard-cred-val {
                font-size: 12.5px;
            }
            .idcard-footer-strip {
                height: 34px;
                padding: 0 16px;
            }
        }

        /* ── CARD SURFACES (LIGHT DASHBOARD LUXURY) ── */
        .card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: var(--r-l);
            box-shadow: var(--shadow-card);
            overflow: hidden;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .card.pad {
            padding: 22px 24px;
        }

        /* ── KEY-VALUE ROWS (PERSIS DASHBOARD .kv) ── */
        .kv {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 11px 0;
            border-bottom: 1px solid var(--line-2);
            font-size: 13.5px;
        }
        .kv:last-child {
            border-bottom: none;
            padding-bottom: 2px;
        }
        .kv span {
            color: var(--muted);
            font-weight: 500;
        }
        .kv b {
            color: var(--ink);
            font-weight: 650;
            text-align: right;
        }
        .kv b.num {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", monospace;
            letter-spacing: 0.02em;
        }

        /* ── CHIPS (SAMA DENGAN DASHBOARD) ── */
        .chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: var(--r-full);
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
        }
        .chip.ok {
            background: var(--ok-bg);
            color: var(--ok);
            border: 1px solid var(--ok-border);
        }
        .chip.blue {
            background: var(--b-050);
            color: var(--b-700);
            border: 1px solid var(--b-100);
        }
        .chip.muted {
            background: var(--bg-2);
            color: var(--muted);
            border: 1px solid var(--line);
        }

        /* ── SECTION TITLES ── */
        .sec-title {
            display: flex;
            align-items: center;
            gap: 9px;
            font-size: 13px;
            font-weight: 750;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: var(--ink-2);
            margin: 6px 0 12px;
            padding-left: 2px;
        }
        .sec-title i {
            font-size: 14px;
            color: var(--b-600);
        }

        /* ── LIST ITEMS (RIWAYAT PROJECT & SURAT) ── */
        .list-stack {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .item-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: var(--r-m);
            padding: 14px 18px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-shadow: var(--shadow-s);
            transition: all 0.2s ease;
        }
        .item-card:hover {
            border-color: var(--b-300);
            box-shadow: var(--shadow-m);
            transform: translateY(-1px);
        }
        .item-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        .item-title {
            font-size: 13.5px;
            font-weight: 700;
            color: var(--ink);
            line-height: 1.35;
        }
        .item-meta {
            font-size: 11.5px;
            color: var(--muted);
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .item-meta i {
            font-size: 11px;
            color: var(--b-600);
            margin-right: 3px;
        }
        .item-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11.5px;
            font-weight: 650;
            color: var(--b-600);
            text-decoration: none;
            margin-top: 4px;
            transition: color 0.16s;
        }
        .item-link:hover {
            color: var(--b-800);
            text-decoration: underline;
        }

        .empty-box {
            text-align: center;
            padding: 24px 16px;
            background: var(--surface);
            border: 1px dashed var(--line);
            border-radius: var(--r-m);
            color: var(--muted);
            font-size: 12.5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .empty-box i {
            font-size: 22px;
            color: var(--b-600);
            opacity: 0.7;
        }

        /* ── FAILED STATE ── */
        .failed-card {
            text-align: center;
            padding: 38px 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
        }
        .failed-icon-wrap {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: var(--dang-bg);
            color: var(--dang);
            border: 1px solid var(--dang-border);
            display: grid;
            place-items: center;
            font-size: 26px;
            box-shadow: 0 2px 14px rgba(176, 43, 35, 0.14);
        }
        .failed-h {
            font-size: 19px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: var(--ink);
        }
        .failed-p {
            font-size: 13px;
            color: var(--muted);
            line-height: 1.5;
            max-width: 380px;
        }

        /* ── SMART ID INPUT FORM (CLEAN SINGLE TEXT FIELD) ── */
        .smart-id-form {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            max-width: 380px;
            margin: 6px auto 0;
        }
        .smart-input-row {
            display: flex;
            gap: 8px;
            width: 100%;
        }
        .smart-input-field {
            flex: 1;
            min-width: 0;
            height: 44px;
            background: var(--surface);
            border: 1.5px solid var(--line);
            border-radius: var(--r-s);
            padding: 0 14px;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace;
            font-size: 14.5px;
            font-weight: 700;
            color: var(--ink);
            letter-spacing: 0.03em;
            outline: none;
            box-shadow: var(--shadow-s);
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .smart-input-field:focus {
            border-color: var(--b-500);
            box-shadow: 0 0 0 3px rgba(59, 142, 247, 0.16);
        }
        .smart-input-field::placeholder {
            color: var(--muted);
            font-weight: 500;
            font-family: var(--font);
            letter-spacing: 0.01em;
            opacity: 0.75;
        }
        .smart-btn-submit {
            height: 44px;
            padding: 0 18px;
            background: linear-gradient(150deg, var(--b-600), var(--b-700));
            color: #FFFFFF;
            border: none;
            border-radius: var(--r-s);
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            box-shadow: var(--shadow-blue);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: opacity 0.16s, transform 0.16s;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .smart-btn-submit:hover { opacity: 0.95; transform: translateY(-1px); }
        .smart-btn-submit:active { transform: translateY(0); }
        .smart-input-hint {
            font-size: 11px;
            color: var(--muted);
            text-align: center;
            line-height: 1.4;
        }
        .smart-input-hint code {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace;
            background: var(--bg-2);
            padding: 1.5px 5px;
            border-radius: 4px;
            font-weight: 750;
            color: var(--b-700);
            border: 1px solid var(--line-2);
        }

        /* ── FOOTER ── */
        .footer {
            text-align: center;
            padding-top: 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .footer-brand {
            font-size: 12px;
            font-weight: 750;
            color: var(--ink-2);
            letter-spacing: 0.04em;
        }
        .footer-sub {
            font-size: 11px;
            color: var(--muted);
            line-height: 1.4;
        }
    </style>
</head>
<body>

    <div class="container">

        <!-- 1. BRAND HEADER -->
        <header class="brand-header">
            <img src="<?php echo esc_url($bs_logo_url); ?>" alt="Progresif TV" class="brand-logo-img" onerror="this.onerror=null; this.src='/wp-content/uploads/BS-X-PTV-BLUE.png';">
            <span class="brand-sub">Sistem Verifikasi Digital Terpusat</span>
        </header>

        <?php if ($kru_found && $kru_data): 
            $nama_kru    = esc_html($kru_data['nama'] ?? 'Kru PTV');
            $ptv_id      = esc_html($kru_data['crew_id'] ?? '-');
            $divisi      = esc_html($kru_data['divisi'] ?? 'Technical');
            $jabatan     = esc_html($kru_data['jabatan'] ?? ($kru_data['posisi'] ?? 'Kru'));
            $status_kru  = ucfirst(strtolower((string)($kru_data['status'] ?? 'Aktif')));
            $angkatan    = esc_html($kru_data['angkatan'] ?? '');
            $nim         = esc_html($kru_data['nim'] ?? '');
            $jurusan     = esc_html($kru_data['jurusan'] ?? '');
            $foto_url    = esc_url($kru_data['foto_url'] ?? ($kru_data['photo'] ?? ''));
            $inits       = (function_exists('mb_strtoupper') && function_exists('mb_substr')) 
                ? mb_strtoupper(mb_substr($kru_data['nama'] ?? 'P', 0, 1)) 
                : strtoupper(substr((string)($kru_data['nama'] ?? 'P'), 0, 1));
        ?>

            <!-- 2. STATUS VERIFIKASI -->
            <div class="status-pill-wrap">
                <div class="verif-pill ok">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Identitas Terverifikasi</span>
                </div>
            </div>

            <!-- 3. REPLIKA KARTU KRU DIGITAL (IDENTIK DENGAN DASHBOARD) -->
            <?php 
                $card_logo_url = '/wp-content/uploads/2026/09/LOGO-NON-RESMI.webp';
                if (!file_exists(WP_CONTENT_DIR . '/uploads/2026/09/LOGO-NON-RESMI.webp') && file_exists(WP_CONTENT_DIR . '/uploads/LOGO-NON-RESMI.webp')) {
                    $card_logo_url = '/wp-content/uploads/LOGO-NON-RESMI.webp';
                }
                $qr_verif_url = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' . urlencode(home_url('/verifikasi-identitas/?id=' . urlencode($ptv_id)));
            ?>
            <div class="idcard-holder-wrap">
                <div class="idcard">
                    <!-- Ambient SVG Wave Background (Inspirasi Arah Visual Reference) -->
                    <div class="idcard-bg-layer" aria-hidden="true">
                        <svg class="idcard-bg-waves" viewBox="0 0 360 560" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                            <path d="M-20 80C60 40 140 130 240 90C310 60 350 110 380 95V-20H-20V80Z" fill="url(#pviWaveGrad1)" opacity="0.35"/>
                            <path d="M-30 220C50 170 120 250 220 200C290 165 330 215 390 190V-20H-30V220Z" fill="url(#pviWaveGrad2)" opacity="0.2"/>
                            <path d="M-20 440C70 410 130 480 230 430C300 395 340 440 380 420V580H-20V440Z" fill="url(#pviWaveGrad1)" opacity="0.25"/>
                            <path d="M-10 140C90 110 160 210 270 160C330 130 360 170 390 155" stroke="rgba(147, 197, 253, 0.18)" stroke-width="2.5" stroke-linecap="round"/>
                            <path d="M-20 380C80 340 150 430 260 380C320 350 350 390 380 375" stroke="rgba(147, 197, 253, 0.14)" stroke-width="2" stroke-linecap="round"/>
                            <path d="M-10 490C90 460 170 530 280 480C330 455 360 485 390 475" stroke="rgba(147, 197, 253, 0.12)" stroke-width="2" stroke-linecap="round"/>
                            <defs>
                                <linearGradient id="pviWaveGrad1" x1="0" y1="0" x2="360" y2="560" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#1E40AF" stop-opacity="0.6"/>
                                    <stop offset="1" stop-color="#0E2F72" stop-opacity="0.1"/>
                                </linearGradient>
                                <linearGradient id="pviWaveGrad2" x1="360" y1="0" x2="0" y2="560" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#3B82F6" stop-opacity="0.4"/>
                                    <stop offset="1" stop-color="#1D4ED8" stop-opacity="0.05"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <!-- Card Body -->
                    <div class="idcard-body">
                        <!-- Top Bar: Branding on Left, QR Code on Right -->
                        <div class="idcard-top-bar">
                            <div class="idcard-brand-box">
                                <img src="<?php echo esc_url($card_logo_url); ?>" alt="Progresif TV Production" class="idcard-logo-img" style="height:26px;width:auto;max-width:145px;object-fit:contain;display:block;margin-bottom:2px;">
                                <div class="idcard-brand-label">KARTU IDENTITAS RESMI</div>
                            </div>
                            <div class="idcard-qr-box">
                                <img src="<?php echo esc_url($qr_verif_url); ?>" alt="QR Code <?php echo $ptv_id; ?>" loading="lazy">
                            </div>
                        </div>

                        <!-- Center: Large Portrait Crew Photo -->
                        <div class="idcard-photo-frame">
                            <?php if (!empty($foto_url)): ?>
                                <img src="<?php echo $foto_url; ?>" alt="<?php echo $nama_kru; ?>" class="idcard-photo-img" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\'idcard-photo-fallback\'><?php echo $inits; ?></div>'">
                            <?php else: ?>
                                <div class="idcard-photo-fallback"><?php echo $inits; ?></div>
                            <?php endif; ?>
                        </div>

                        <!-- Crew Name -->
                        <div class="idcard-identity-block">
                            <div class="idcard-person-name"><?php echo $nama_kru; ?></div>
                        </div>

                        <!-- Credentials Grid -->
                        <div class="idcard-creds-grid">
                            <div class="idcard-cred-item">
                                <div class="idcard-cred-lbl">KRU NO.</div>
                                <div class="idcard-cred-val font-mono"><?php echo $ptv_id; ?></div>
                            </div>
                            <div class="idcard-cred-item">
                                <div class="idcard-cred-lbl">POSITION</div>
                                <div class="idcard-cred-val"><?php echo $jabatan; ?></div>
                            </div>
                            <div class="idcard-cred-item">
                                <div class="idcard-cred-lbl">DIVISI</div>
                                <div class="idcard-cred-val"><?php echo $divisi; ?></div>
                            </div>
                            <div class="idcard-cred-item">
                                <div class="idcard-cred-lbl">STATUS</div>
                                <div class="idcard-cred-val"><?php echo $status_kru; ?></div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Strip: PROGRESIF TV & 2026–2027 -->
                    <div class="idcard-footer-strip">
                        <div class="idcard-footer-brand">PROGRESIF TV</div>
                        <div class="idcard-footer-expiry">2026–2027</div>
                    </div>
                </div>
            </div>

            <!-- 4. RINCIAN IDENTITAS RESMI (NO SENSITIVE DATA) -->
            <div class="card pad">
                <div class="kv">
                    <span>ID PTV</span>
                    <b class="num"><span class="chip blue"><?php echo $ptv_id; ?></span></b>
                </div>
                <div class="kv">
                    <span>Nama Lengkap</span>
                    <b><?php echo $nama_kru; ?></b>
                </div>
                <div class="kv">
                    <span>Divisi</span>
                    <b><?php echo $divisi; ?></b>
                </div>
                <div class="kv">
                    <span>Jabatan / Peran</span>
                    <b><?php echo $jabatan; ?></b>
                </div>
                <?php if (!empty($angkatan)): ?>
                    <div class="kv">
                        <span>Angkatan</span>
                        <b>Angkatan <?php echo $angkatan; ?></b>
                    </div>
                <?php endif; ?>
                <?php if (!empty($nim)): ?>
                    <div class="kv">
                        <span>NIM / NISN</span>
                        <b class="num"><?php echo $nim; ?></b>
                    </div>
                <?php endif; ?>
                <?php if (!empty($jurusan)): ?>
                    <div class="kv">
                        <span>Jurusan</span>
                        <b><?php echo $jurusan; ?></b>
                    </div>
                <?php endif; ?>
                <div class="kv">
                    <span>Status Keanggotaan</span>
                    <b>
                        <span class="chip <?php echo ($status_kru === 'Aktif') ? 'ok' : 'muted'; ?>">
                            <?php echo $status_kru; ?>
                        </span>
                    </b>
                </div>
            </div>

            <!-- 5. STATUS PENUGASAN & PEMBAWAAN BARANG HARI INI (REAL-TIME LIVE SCAN) -->
            <div>
                <div class="sec-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="fa-solid fa-clipboard-check" style="color:var(--b-600);"></i>
                        <span>Status Penugasan Hari Ini</span>
                    </div>
                    <span style="font-size:11.5px;font-weight:700;color:var(--t-muted);text-transform:none;">
                        <?php echo ptv_verif_format_date($today_ymd); ?>
                    </span>
                </div>

                <?php 
                $has_active_activity = !empty($surat_izin_aktif_hari_ini) || !empty($surat_barang_aktif_hari_ini) || !empty($surat_tugas_aktif_hari_ini);
                ?>

                <?php if ($has_active_activity): ?>
                    <div class="list-stack">
                        <!-- 1. Surat Izin Resmi Aktif Hari Ini -->
                        <?php foreach ($surat_izin_aktif_hari_ini as $si): 
                            $surat_url = home_url('/verifikasi-surat/?nomor=' . urlencode($si['nomor']));
                            $tgl_display = ($si['tanggal_m'] === $si['tanggal_s']) 
                                ? ptv_verif_format_date($si['tanggal_m']) 
                                : ptv_verif_format_date($si['tanggal_m']) . ' s.d. ' . ptv_verif_format_date($si['tanggal_s']);
                            $kru_list = $si['kru_terlibat'] ?? [];
                        ?>
                            <div class="item-card" style="border:1px solid #bfdbfe;border-left:4px solid #1d4ed8;background:#eff6ff;border-radius:14px;padding:15px 16px;box-shadow:0 2px 10px rgba(37,99,235,0.06);">
                                <div class="item-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                    <span class="num font-bold" style="color:#1e3a8a;font-size:12.5px;font-family:monospace;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;">
                                        <i class="fa-solid fa-file-shield" style="color:#1d4ed8;"></i><?php echo esc_html($si['nomor']); ?>
                                    </span>
                                    <span class="chip" style="background:#dbeafe;color:#1e40af;font-size:10px;font-weight:800;border:1px solid #93c5fd;border-radius:9999px;padding:2.5px 9px;">
                                        SURAT IZIN RESMI
                                    </span>
                                </div>
                                <div class="item-title" style="font-size:15px;font-weight:800;color:#0f172a;margin-top:6px;line-height:1.35;">
                                    <div style="font-size:11px;font-weight:750;color:#1d4ed8;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                                        <i class="fa-solid fa-calendar-check" style="font-size:11px;"></i> Acara / Kegiatan Terkait
                                    </div>
                                    <?php echo esc_html($si['kegiatan']); ?>
                                </div>
                                <?php if (!empty($si['alasan']) && trim(strtolower($si['alasan'])) !== trim(strtolower($si['kegiatan']))): ?>
                                    <div style="font-size:12px;color:#334155;margin-top:5px;line-height:1.4;background:rgba(255,255,255,0.7);padding:6px 10px;border-radius:8px;border:1px solid #dbeafe;">
                                        <i class="fa-solid fa-circle-info" style="font-size:10.5px;color:#2563eb;margin-right:4px;"></i><?php echo esc_html($si['alasan']); ?>
                                    </div>
                                <?php endif; ?>

                                <!-- Kru / Santri Siapa Saja yang Terlibat -->
                                <?php if (!empty($kru_list)): ?>
                                    <div style="margin-top:10px;padding:10px 12px;background:#ffffff;border:1px solid #bfdbfe;border-radius:10px;box-shadow:0 1px 3px rgba(37,99,235,0.04);">
                                        <div style="font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:.03em;display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:7px;">
                                            <span style="display:inline-flex;align-items:center;gap:5px;">
                                                <i class="fa-solid fa-users" style="color:#2563eb;"></i> Kru & Santri Terlibat (<?php echo count($kru_list); ?>)
                                            </span>
                                        </div>
                                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                                            <?php foreach ($kru_list as $k_name): 
                                                $is_curr = ptv_is_name_match($k_name, $kru_nama);
                                            ?>
                                                <span style="font-size:11px;font-weight:<?php echo $is_curr ? '800' : '600'; ?>;background:<?php echo $is_curr ? '#dbeafe' : '#f8fafc'; ?>;color:<?php echo $is_curr ? '#1e3a8a' : '#334155'; ?>;border:1px solid <?php echo $is_curr ? '#93c5fd' : '#e2e8f0'; ?>;border-radius:6px;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;">
                                                    <?php if ($is_curr): ?><i class="fa-solid fa-user-check" style="color:#2563eb;font-size:10px;"></i><?php endif; ?>
                                                    <?php echo esc_html($k_name); ?>
                                                </span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <div class="item-meta" style="color:#475569;margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:12px;">
                                    <span style="display:inline-flex;align-items:center;gap:5px;">
                                        <i class="fa-regular fa-clock" style="color:#2563eb;"></i> <?php echo esc_html($tgl_display); ?>
                                    </span>
                                    <span style="display:inline-flex;align-items:center;gap:5px;color:#1d4ed8;font-weight:700;">
                                        <i class="fa-solid fa-check-double" style="color:#2563eb;"></i> Terverifikasi Sah
                                    </span>
                                </div>
                                <div style="margin-top:10px;">
                                    <a href="<?php echo esc_url($surat_url); ?>" target="_blank" class="item-link" style="color:#1d4ed8;font-weight:700;display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:12.5px;">
                                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> Cek Keabsahan Surat Izin &rarr;
                                    </a>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <!-- 2. Surat Tugas Resmi Aktif Hari Ini -->
                        <?php foreach ($surat_tugas_aktif_hari_ini as $ta): 
                            $surat_url = home_url('/verifikasi-surat/?nomor=' . urlencode($ta['nomor']));
                            $tgl_display = ($ta['tanggal_m'] === $ta['tanggal_s']) 
                                ? ptv_verif_format_date($ta['tanggal_m']) 
                                : ptv_verif_format_date($ta['tanggal_m']) . ' s.d. ' . ptv_verif_format_date($ta['tanggal_s']);
                            $kru_list = $ta['kru_terlibat'] ?? [];
                        ?>
                            <div class="item-card" style="border:1px solid #c7d2fe;border-left:4px solid #4f46e5;background:#eef2ff;border-radius:14px;padding:15px 16px;box-shadow:0 2px 10px rgba(79,70,229,0.06);">
                                <div class="item-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                    <span class="num font-bold" style="color:#312e81;font-size:12.5px;font-family:monospace;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;">
                                        <i class="fa-solid fa-circle-check" style="color:#4f46e5;"></i><?php echo esc_html($ta['nomor']); ?>
                                    </span>
                                    <span class="chip" style="background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:800;border:1px solid #c7d2fe;border-radius:9999px;padding:2.5px 9px;">
                                        SEDANG BERTUGAS
                                    </span>
                                </div>
                                <div class="item-title" style="font-size:15px;font-weight:800;color:#0f172a;margin-top:6px;line-height:1.35;">
                                    <div style="font-size:11px;font-weight:750;color:#4338ca;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                                        <i class="fa-solid fa-clapperboard" style="font-size:11px;"></i> Acara / Kegiatan Tugas
                                    </div>
                                    <?php echo esc_html($ta['kegiatan']); ?>
                                </div>

                                <!-- Kru Siapa Saja yang Ditugaskan -->
                                <?php if (!empty($kru_list)): ?>
                                    <div style="margin-top:10px;padding:10px 12px;background:#ffffff;border:1px solid #c7d2fe;border-radius:10px;box-shadow:0 1px 3px rgba(79,70,229,0.04);">
                                        <div style="font-size:11px;font-weight:800;color:#3730a3;text-transform:uppercase;letter-spacing:.03em;display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:7px;">
                                            <span style="display:inline-flex;align-items:center;gap:5px;">
                                                <i class="fa-solid fa-users-gear" style="color:#4f46e5;"></i> Tim Kru yang Bertugas (<?php echo count($kru_list); ?>)
                                            </span>
                                        </div>
                                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                                            <?php foreach ($kru_list as $k_name): 
                                                $is_curr = ptv_is_name_match($k_name, $kru_nama);
                                                $is_lead = (!empty($ta['penanggung_jawab']) && ptv_is_name_match($k_name, $ta['penanggung_jawab']));
                                            ?>
                                                <span style="font-size:11px;font-weight:<?php echo ($is_curr || $is_lead) ? '800' : '600'; ?>;background:<?php echo $is_curr ? '#e0e7ff' : ($is_lead ? '#fef3c7' : '#f8fafc'); ?>;color:<?php echo $is_curr ? '#312e81' : ($is_lead ? '#92400e' : '#334155'); ?>;border:1px solid <?php echo $is_curr ? '#a5b4fc' : ($is_lead ? '#fcd34d' : '#e2e8f0'); ?>;border-radius:6px;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;">
                                                    <?php if ($is_lead): ?><i class="fa-solid fa-star" style="color:#d97706;font-size:9.5px;" title="Penanggung Jawab"></i><?php elseif ($is_curr): ?><i class="fa-solid fa-user-check" style="color:#4f46e5;font-size:10px;"></i><?php endif; ?>
                                                    <?php echo esc_html($k_name); ?>
                                                    <?php if ($is_lead): ?><small style="font-size:9.5px;opacity:0.85;">(PJ)</small><?php endif; ?>
                                                </span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <div class="item-meta" style="color:#475569;margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:12px;">
                                    <span style="display:inline-flex;align-items:center;gap:5px;"><i class="fa-solid fa-location-dot" style="color:#4f46e5;"></i> <?php echo esc_html($ta['lokasi']); ?></span>
                                    <span style="display:inline-flex;align-items:center;gap:5px;"><i class="fa-solid fa-user-shield" style="color:#4f46e5;"></i> <?php echo esc_html($ta['peran']); ?></span>
                                    <span style="display:inline-flex;align-items:center;gap:5px;"><i class="fa-regular fa-clock" style="color:#4f46e5;"></i> <?php echo esc_html($tgl_display); ?></span>
                                </div>
                                <div style="margin-top:10px;">
                                    <a href="<?php echo esc_url($surat_url); ?>" target="_blank" class="item-link" style="color:#4f46e5;font-weight:700;display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:12.5px;">
                                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> Cek Surat Tugas Resmi &rarr;
                                    </a>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <!-- 3. Surat Bawa Barang (Izin Membawa Peralatan) Aktif Hari Ini -->
                        <?php foreach ($surat_barang_aktif_hari_ini as $ba): 
                            $surat_url = home_url('/verifikasi-surat/?nomor=' . urlencode($ba['nomor']));
                            $tgl_display = ($ba['tanggal_m'] === $ba['tanggal_s']) 
                                ? ptv_verif_format_date($ba['tanggal_m']) 
                                : ptv_verif_format_date($ba['tanggal_m']) . ' s.d. ' . ptv_verif_format_date($ba['tanggal_s']);
                            $barang_items = $ba['barang_items'] ?? [];
                            $kru_list = $ba['kru_terlibat'] ?? [];
                        ?>
                            <div class="item-card" style="border:1px solid #bae6fd;border-left:4px solid #0284c7;background:#f0f9ff;border-radius:14px;padding:15px 16px;box-shadow:0 2px 10px rgba(2,132,199,0.06);">
                                <div class="item-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                    <span class="num font-bold" style="color:#0369a1;font-size:12.5px;font-family:monospace;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;">
                                        <i class="fa-solid fa-box-open" style="color:#0284c7;"></i><?php echo esc_html($ba['nomor']); ?>
                                    </span>
                                    <span class="chip" style="background:#e0f2fe;color:#0369a1;font-size:10px;font-weight:800;border-radius:9999px;padding:2.5px 9px;border:1px solid #bae6fd;">
                                        IZIN BAWA BARANG
                                    </span>
                                </div>
                                <div class="item-title" style="font-size:15px;font-weight:800;color:#0f172a;margin-top:6px;line-height:1.35;">
                                    <div style="font-size:11px;font-weight:750;color:#0284c7;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
                                        <i class="fa-solid fa-bullhorn" style="font-size:11px;"></i> Acara / Keperluan Terkait
                                    </div>
                                    <?php echo esc_html($ba['keperluan']); ?>
                                </div>

                                <!-- Alat Apa Saja yang Dipinjamkan / Dibawa -->
                                <?php if (!empty($barang_items)): ?>
                                    <div style="margin-top:10px;padding:10px 12px;background:#ffffff;border:1px solid #bae6fd;border-radius:10px;box-shadow:0 1px 3px rgba(2,132,199,0.04);">
                                        <div style="font-size:11px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:.03em;display:flex;align-items:center;gap:5px;margin-bottom:7px;">
                                            <i class="fa-solid fa-boxes-stacked" style="color:#0284c7;"></i> Alat yang Dipinjamkan / Dibawa (<?php echo count($barang_items); ?>)
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:5px;">
                                            <?php foreach ($barang_items as $item): ?>
                                                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;padding:5px 9px;background:#f0f9ff;border:1px solid #e0f2fe;border-radius:6px;">
                                                    <span style="font-weight:750;color:#0c4a6e;font-family:monospace;display:inline-flex;align-items:center;gap:5px;">
                                                        <i class="fa-solid fa-cube" style="font-size:10px;color:#0284c7;"></i> <?php echo esc_html($item['nama']); ?>
                                                    </span>
                                                    <?php if (!empty($item['catatan'])): ?>
                                                        <span style="font-size:10.5px;color:#0369a1;opacity:0.85;"><?php echo esc_html($item['catatan']); ?></span>
                                                    <?php endif; ?>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php elseif (!empty($ba['barang'])): ?>
                                    <div style="margin-top:10px;padding:9px 12px;background:#ffffff;border:1px solid #bae6fd;border-radius:10px;">
                                        <div style="font-size:11px;font-weight:750;color:#0369a1;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
                                            <i class="fa-solid fa-list-check" style="color:#0284c7;"></i> Peralatan yang Dibawa:
                                        </div>
                                        <div style="font-family:monospace;font-size:11.5px;color:#0c4a6e;"><?php echo esc_html($ba['barang']); ?></div>
                                    </div>
                                <?php endif; ?>

                                <!-- Kru Pembawa / Terlibat -->
                                <?php if (!empty($kru_list)): ?>
                                    <div style="margin-top:9px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11.5px;color:#475569;">
                                        <span style="font-weight:700;color:#0369a1;display:inline-flex;align-items:center;gap:4px;">
                                            <i class="fa-solid fa-user-tag" style="font-size:11px;"></i> Pembawa / PJ:
                                        </span>
                                        <?php foreach ($kru_list as $k_name): 
                                            $is_curr = ptv_is_name_match($k_name, $kru_nama);
                                        ?>
                                            <span style="font-weight:<?php echo $is_curr ? '800' : '600'; ?>;background:<?php echo $is_curr ? '#e0f2fe' : '#f8fafc'; ?>;color:<?php echo $is_curr ? '#0369a1' : '#334155'; ?>;border:1px solid <?php echo $is_curr ? '#bae6fd' : '#e2e8f0'; ?>;border-radius:6px;padding:2px 8px;font-size:11px;display:inline-flex;align-items:center;gap:4px;">
                                                <?php if ($is_curr): ?><i class="fa-solid fa-user-check" style="color:#0284c7;font-size:9.5px;"></i><?php endif; ?>
                                                <?php echo esc_html($k_name); ?>
                                            </span>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endif; ?>

                                <div class="item-meta" style="color:#475569;margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:12px;">
                                    <span style="display:inline-flex;align-items:center;gap:5px;"><i class="fa-regular fa-clock" style="color:#0284c7;"></i> <?php echo esc_html($tgl_display); ?></span>
                                </div>
                                <div style="margin-top:10px;">
                                    <a href="<?php echo esc_url($surat_url); ?>" target="_blank" class="item-link" style="color:#0284c7;font-weight:700;display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:12.5px;">
                                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> Cek Surat Izin Barang Resmi &rarr;
                                    </a>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <div class="empty-box" style="padding:28px 20px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;">
                        <div style="width:44px;height:44px;border-radius:50%;background:#f1f5f9;color:#94a3b8;display:grid;place-items:center;margin:0 auto 10px;font-size:18px;">
                            <i class="fa-solid fa-calendar-xmark"></i>
                        </div>
                        <div style="font-size:13.5px;font-weight:800;color:#334155;margin-bottom:4px;">
                            Tidak Ada Jadwal Tugas Hari Ini
                        </div>
                        <p style="font-size:12px;color:#64748b;margin:0;max-width:360px;margin:0 auto;line-height:1.45;">
                            Pada hari ini (<b><?php echo ptv_format_tgl_indo(strtotime($today_ymd)); ?></b>), anggota tidak sedang ditugaskan dalam kegiatan atau membawa peralatan.
                        </p>
                    </div>
                <?php endif; ?>
            </div>

        <?php else: ?>

            <!-- STATUS: IDENTITAS TIDAK DITEMUKAN / FORM INPUT AWAL -->
            <div class="status-pill-wrap">
                <?php if (!empty($id_query_clean)): ?>
                    <div class="verif-pill bad">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Identitas Tidak Ditemukan</span>
                    </div>
                <?php else: ?>
                    <div class="verif-pill" style="background:var(--b-050);color:var(--b-700);border:1px solid var(--b-100)">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Portal Verifikasi Publik</span>
                    </div>
                <?php endif; ?>
            </div>

            <div class="card failed-card">
                <?php if (!empty($id_query_clean)): ?>
                    <div class="failed-icon-wrap">
                        <i class="fa-solid fa-user-xmark"></i>
                    </div>
                    <h1 class="failed-h">Data Anggota Tidak Ditemukan</h1>
                    <p class="failed-p">
                        Nomor ID <b><?php echo esc_html($id_query_clean); ?></b> tidak terdaftar dalam pangkalan data resmi Progresif TV atau status keanggotaan tidak aktif.
                    </p>
                <?php else: ?>
                    <div class="failed-icon-wrap" style="background:var(--b-050);color:var(--b-600);border-color:var(--b-100);box-shadow:0 2px 14px rgba(18,115,230,0.12)">
                        <i class="fa-solid fa-id-card-clip"></i>
                    </div>
                    <h1 class="failed-h">Verifikasi Identitas Kru</h1>
                    <p class="failed-p">
                        Silakan masukkan nomor ID PTV untuk memverifikasi keabsahan identitas dan status keanggotaan resmi kru.
                    </p>
                <?php endif; ?>

                <form action="<?php echo esc_url(home_url('/verifikasi-identitas/')); ?>" method="GET" class="smart-id-form verif-smart-form">
                    <div class="smart-input-row">
                        <input 
                            type="text" 
                            name="id"
                            class="smart-input-field smart-id-field" 
                            placeholder="Contoh: 001" 
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            value="<?php echo esc_attr($display_input_num); ?>"
                            aria-label="Nomor ID PTV"
                            required
                        >
                        <button type="submit" class="smart-btn-submit">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span>Periksa</span>
                        </button>
                    </div>
                    <div class="smart-input-hint">
                        Cukup ketik nomor kru (misal: <code>001</code> atau <code>25</code>) &bull; Otomatis dicari sebagai <code>PTV-001</code>
                    </div>
                </form>
            </div>

        <?php endif; ?>

        <?php if ($kru_found && $kru_data): ?>
            <!-- 7. CARI ANGGOTA LAIN -->
            <div class="card pad" style="margin-top:6px;">
                <div class="sec-title" style="margin:0 0 10px;justify-content:center">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <span>Periksa Identitas Anggota Lain</span>
                </div>
                <form action="<?php echo esc_url(home_url('/verifikasi-identitas/')); ?>" method="GET" class="smart-id-form verif-smart-form">
                    <div class="smart-input-row">
                        <input 
                            type="text" 
                            name="id"
                            class="smart-input-field smart-id-field" 
                            placeholder="Contoh: 001" 
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            aria-label="Nomor ID PTV"
                            required
                        >
                        <button type="submit" class="smart-btn-submit">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span>Periksa</span>
                        </button>
                    </div>
                    <div class="smart-input-hint">
                        Cukup ketik nomor kru (misal: <code>001</code> atau <code>25</code>) &bull; Otomatis dicari sebagai <code>PTV-001</code>
                    </div>
                </form>
            </div>
        <?php endif; ?>

        <!-- 8. FOOTER RESMI -->
        <footer class="footer">
            <div class="footer-brand">PROGRESIF TV</div>
            <div class="footer-sub">Pesantren Progresif Bumi Shalawat &bull; Sidoarjo, Jawa Timur</div>
            <div class="footer-sub" style="font-size:10px;color:rgba(127,154,186,.7);margin-top:2px">
                Sistem Verifikasi Digital Terpusat &bull; Keabsahan Dokumen & Identitas Resmi
            </div>
        </footer>

    </div>

    <!-- Smart ID Normalizer Script -->
    <script>
    (function() {
        function normalizePtvId(raw) {
            if (!raw) return '';
            var clean = String(raw).toUpperCase().replace(/\s+/g, '');
            var part = clean.replace(/^(PTV-?)+/i, '');
            if (!part) return '';
            if (/^\d+$/.test(part)) {
                part = part.padStart(3, '0');
            }
            return 'PTV-' + part;
        }

        var forms = document.querySelectorAll('.verif-smart-form');
        forms.forEach(function(form) {
            var input = form.querySelector('.smart-id-field');
            if (!input) return;

            form.addEventListener('submit', function(e) {
                var val = input.value.trim();
                if (!val) {
                    e.preventDefault();
                    input.focus();
                    return;
                }
                input.value = normalizePtvId(val);
            });
        });
    })();
    </script>

</body>
</html>
