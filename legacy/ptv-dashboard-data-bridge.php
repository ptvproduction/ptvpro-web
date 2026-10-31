<?php
/**
 * PTV Operations Dashboard — Data Bridge
 * Menghubungkan seluruh data riil (WordPress DB & Supabase) ke frontend state PTV Operations.
 */

if (!defined('ABSPATH')) exit;

if (!function_exists('ptv_sanitize_utf8_text')) {
    function ptv_sanitize_utf8_text($str, $fallback = '') {
        if ($str === null || $str === false) return $fallback;
        $s = (string)$str;
        $s = trim($s);
        if ($s === '' || $s === 'null' || $s === '[]') return $fallback;

        $mojibake_map = [
            '–' => '–',
            'Ã¢â‚¬â€”' => '—',
            'Ã¢â‚¬â—'  => '—',
            'Ã¢â‚¬â'   => '—',
            'Ã¢â‚¬'    => '—',
            'Ã¢,¬â€œ'  => '–',
            'Ã¢,¬â€”'  => '—',
            'Ã¢,¬'     => '—',
            'â‚¬â€œ'   => '–',
            'â‚¬â€”'   => '—',
            'â‚¬â—'    => '—',
            'â€“'      => '–',
            'â€”'      => '—',
            'Ã¢â€ â€™'  => '→',
            'Ã¢â€ â€™'  => '→',
            'â†’'      => '→',
            'Ã¢â€ Â '  => '←',
            'â† '      => '←',
            'Ã¢â‚¬Â¢'  => '•',
            'â€¢'      => '•',
            'Ã‚Â·'     => '·',
            'Â·'       => '·',
            'Ã¢â‚¬Â¦'  => '…',
            'â€¦'      => '…',
            'Ã¢â‚¬Å“'  => '“',
            'Ã¢â‚¬Â '  => '”',
            'Ã¢â‚¬â„¢' => '’',
            'Ã¢â‚¬Ëœ'  => '‘',
            'â€œ'      => '"',
            'â€ '      => '"',
            'â€™'      => "'",
            'â€˜'      => "'",
            'Ã‚ '      => ' ',
            'Ã‚'       => '',
            'Â '       => ' ',
            '&amp;'    => '&',
        ];
        $s = str_replace(array_keys($mojibake_map), array_values($mojibake_map), $s);
        $s = trim($s);

        if ($s === '' || $s === 'null') return $fallback;
        if (($s === '-' || $s === '—') && $fallback !== '') return $fallback;
        return $s;
    }
}

if (!function_exists('ptv_normalize_inventory_cat_name')) {
    function ptv_normalize_inventory_cat_name($cat) {
        $c = trim((string)$cat);
        if (empty($c)) return 'Lainnya';
        $c = preg_replace('/\s*\/\s*/', ' / ', $c);
        $lower = strtolower($c);
        if ($lower === 'kamera' || $lower === 'camera' || strpos($lower, 'kamera') === 0) return 'Kamera';
        if ($lower === 'lensa' || $lower === 'lens' || strpos($lower, 'lensa') === 0) return 'Lensa';
        if (strpos($lower, 'tripod') !== false || strpos($lower, 'rig') !== false || strpos($lower, 'gimbal') !== false || strpos($lower, 'monopod') !== false || strpos($lower, 'stabilizer') !== false) return 'Tripod';
        if (strpos($lower, 'smartphone') !== false || strpos($lower, 'tablet') !== false || strpos($lower, 'ipad') !== false || strpos($lower, 'iphone') !== false || strpos($lower, 'hp') !== false || strpos($lower, 'android') !== false) return 'Smartphone / Tablet';
        if (strpos($lower, 'komputer') !== false || strpos($lower, 'laptop') !== false || strpos($lower, 'pc') !== false || strpos($lower, 'macbook') !== false) return 'Komputer / Laptop';
        if ($lower === 'audio' || $lower === 'mic' || $lower === 'sound' || strpos($lower, 'audio') === 0 || strpos($lower, 'mic') === 0 || strpos($lower, 'microphone') !== false || strpos($lower, 'headphone') !== false) return 'Audio';
        if (strpos($lower, 'light') !== false || strpos($lower, 'lampu') !== false || strpos($lower, 'softbox') !== false || strpos($lower, 'led') !== false) return 'Lighting';
        if (strpos($lower, 'stream') !== false || strpos($lower, 'live') !== false || strpos($lower, 'switcher') !== false || strpos($lower, 'atem') !== false || strpos($lower, 'broadcast') !== false) return 'Streaming / Live Production';
        if (strpos($lower, 'jaringan') !== false || strpos($lower, 'network') !== false || strpos($lower, 'router') !== false || strpos($lower, 'mikrotik') !== false || strpos($lower, 'wifi') !== false || strpos($lower, 'access point') !== false || strpos($lower, 'ethernet') !== false || strpos($lower, 'lan') !== false) return 'Pengaturan Jaringan';
        if (strpos($lower, 'baterai') !== false || strpos($lower, 'battery') !== false || strpos($lower, 'batere') !== false || strpos($lower, 'powerbank') !== false || strpos($lower, 'v-mount') !== false || strpos($lower, 'vmount') !== false) return 'Baterai & Power';
        if (strpos($lower, 'baterai') !== false || strpos($lower, 'battery') !== false || strpos($lower, 'batere') !== false || strpos($lower, 'powerbank') !== false || strpos($lower, 'v-mount') !== false || strpos($lower, 'vmount') !== false) return 'Baterai & Power';
        if (strpos($lower, 'kabel') !== false || strpos($lower, 'adapter') !== false || strpos($lower, 'cable') !== false || strpos($lower, 'charger') !== false) return 'Kabel & Adapter';
        if (strpos($lower, 'dry cabinet') !== false || strpos($lower, 'cabinet') !== false || strpos($lower, 'dry box') !== false) return 'Dry Cabinet';
        if (strpos($lower, 'smart tv') !== false || strpos($lower, ' tv') !== false || $lower === 'tv' || strpos($lower, 'televisi') !== false) return 'TV / Smart TV';
        if (strpos($lower, 'storage') !== false || strpos($lower, 'ssd') !== false || strpos($lower, 'hdd') !== false || strpos($lower, 'harddisk') !== false || strpos($lower, 'sd card') !== false || strpos($lower, 'memory') !== false || strpos($lower, 'flashdisk') !== false) return 'Storage';
        if (strpos($lower, 'peralatan') !== false || strpos($lower, 'perkakas') !== false || strpos($lower, 'tool') !== false || strpos($lower, 'obeng') !== false || strpos($lower, 'tang') !== false) return 'Peralatan & Perkakas';
        if (strpos($lower, 'atk') !== false || strpos($lower, 'alat tulis') !== false || strpos($lower, 'kertas') !== false) return 'ATK';
        return ucfirst($c);
    }
}

// ─────────────────────────────────────────────────────────────
// HELPER: SANITIZE RUNDOWN PER ACARA (id, acara_id, urutan, kegiatan, jam_mulai, jam_selesai, crew_ids, crew_names)
// ─────────────────────────────────────────────────────────────
if (!function_exists('ptv_sanitize_rundown_list')) {
    function ptv_sanitize_rundown_list($rundown_raw, $event_id = '') {
        $rundown_arr = [];
        if (!empty($rundown_raw)) {
            if (is_string($rundown_raw)) {
                $decoded = json_decode(stripslashes($rundown_raw), true);
                if (!is_array($decoded)) $decoded = json_decode($rundown_raw, true);
                if (is_array($decoded)) $rundown_arr = $decoded;
            } elseif (is_array($rundown_raw)) {
                $rundown_arr = $rundown_raw;
            }
        }
        if (!is_array($rundown_arr)) return [];

        $clean = [];
        $pos = 1;
        foreach ($rundown_arr as $it) {
            if (!is_array($it)) continue;

            $kegiatan = ptv_sanitize_utf8_text($it['kegiatan'] ?? ($it['pekerjaan'] ?? ($it['title'] ?? ($it['judul'] ?? ''))));
            if (empty($kegiatan)) continue;

            $id = ptv_sanitize_utf8_text($it['id'] ?? '');
            if (empty($id)) {
                $id = wp_generate_uuid4();
            }

            $urutan = isset($it['urutan']) ? intval($it['urutan']) : $pos;
            if ($urutan <= 0) $urutan = $pos;

            // Jam mulai (HH:MM)
            $jam_mulai = ptv_sanitize_utf8_text($it['jam_mulai'] ?? ($it['start_time'] ?? ($it['time'] ?? '')));
            if (!empty($jam_mulai) && preg_match('/(\d{1,2})[:.](\d{2})/', $jam_mulai, $m)) {
                $jam_mulai = sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
            } else {
                $jam_mulai = !empty($jam_mulai) ? substr($jam_mulai, 0, 5) : '';
            }

            // Jam selesai (HH:MM)
            $jam_selesai = ptv_sanitize_utf8_text($it['jam_selesai'] ?? ($it['end_time'] ?? ''));
            if (!empty($jam_selesai) && preg_match('/(\d{1,2})[:.](\d{2})/', $jam_selesai, $m)) {
                $jam_selesai = sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
            } else {
                $jam_selesai = !empty($jam_selesai) ? substr($jam_selesai, 0, 5) : '';
            }

            // Multiple crew members
            $crew_ids = [];
            $raw_cids = $it['crew_ids'] ?? ($it['kru_ids'] ?? []);
            if (is_array($raw_cids)) {
                foreach ($raw_cids as $cid) {
                    $cid_clean = ptv_sanitize_utf8_text($cid);
                    if (!empty($cid_clean)) $crew_ids[] = $cid_clean;
                }
            } elseif (!empty($raw_cids)) {
                $crew_ids[] = ptv_sanitize_utf8_text($raw_cids);
            }
            if (empty($crew_ids) && !empty($it['pic_id'])) {
                $crew_ids[] = ptv_sanitize_utf8_text($it['pic_id']);
            }

            $crew_names = [];
            $raw_cnames = $it['crew_names'] ?? ($it['kru_names'] ?? ($it['kru_bertugas'] ?? []));
            if (is_array($raw_cnames)) {
                foreach ($raw_cnames as $cn) {
                    $cn_clean = ptv_sanitize_utf8_text($cn);
                    if (!empty($cn_clean)) $crew_names[] = $cn_clean;
                }
            } elseif (is_string($raw_cnames) && !empty($raw_cnames)) {
                $parts = preg_split('/[,·•]/', $raw_cnames);
                foreach ($parts as $p) {
                    $p_clean = trim(ptv_sanitize_utf8_text($p));
                    if (!empty($p_clean)) $crew_names[] = $p_clean;
                }
            }
            if (empty($crew_names) && !empty($it['pic_name']) && $it['pic_name'] !== 'Belum ditentukan') {
                $crew_names[] = ptv_sanitize_utf8_text($it['pic_name']);
            }

            $pic_id = !empty($crew_ids) ? $crew_ids[0] : null;
            $pic_name = !empty($crew_names) ? implode(' · ', $crew_names) : 'Belum ditentukan';

            $tanggal_mulai = ptv_sanitize_utf8_text($it['tanggal_mulai'] ?? ($it['tenggat'] ?? ($it['date'] ?? '')));
            if (!empty($tanggal_mulai)) {
                $ts = strtotime($tanggal_mulai);
                $tanggal_mulai = $ts ? date('Y-m-d', $ts) : '';
            } else {
                $tanggal_mulai = '';
            }

            $tanggal_selesai = ptv_sanitize_utf8_text($it['tanggal_selesai'] ?? ($it['tanggal_mulai'] ?? ($it['tenggat'] ?? '')));
            if (!empty($tanggal_selesai)) {
                $ts = strtotime($tanggal_selesai);
                $tanggal_selesai = $ts ? date('Y-m-d', $ts) : $tanggal_mulai;
            } else {
                $tanggal_selesai = $tanggal_mulai;
            }

            $tenggat = $tanggal_mulai ?: ptv_sanitize_utf8_text($it['tenggat'] ?? ($it['deadline'] ?? ($it['date'] ?? '')));
            if (!empty($tenggat)) {
                $ts = strtotime($tenggat);
                $tenggat = $ts ? date('Y-m-d', $ts) : date('Y-m-d');
            } else {
                $tenggat = '';
            }

            $start_at = (!empty($tanggal_mulai) ? $tanggal_mulai : '1970-01-01') . ' ' . (!empty($jam_mulai) ? $jam_mulai : '00:00');
            $end_at = (!empty($tanggal_selesai) ? $tanggal_selesai : (!empty($tanggal_mulai) ? $tanggal_mulai : '1970-01-01')) . ' ' . (!empty($jam_selesai) ? $jam_selesai : '00:00');

            $status_in = strtoupper(trim(ptv_sanitize_utf8_text($it['status'] ?? 'BELUM')));
            $valid_statuses = ['BELUM', 'BERJALAN', 'SELESAI', 'TERLAMBAT'];
            $status = in_array($status_in, $valid_statuses, true) ? $status_in : 'BELUM';

            $created_at = ptv_sanitize_utf8_text($it['created_at'] ?? '');
            if (empty($created_at)) $created_at = gmdate('Y-m-d\TH:i:s\Z');

            $updated_at = ptv_sanitize_utf8_text($it['updated_at'] ?? '');
            if (empty($updated_at)) $updated_at = gmdate('Y-m-d\TH:i:s\Z');

            $clean[] = [
                'id'              => $id,
                'acara_id'        => $event_id ?: ptv_sanitize_utf8_text($it['acara_id'] ?? ''),
                'urutan'          => $urutan,
                'kegiatan'        => $kegiatan,
                'pekerjaan'       => $kegiatan,
                'tanggal_mulai'   => $tanggal_mulai,
                'tanggal_selesai' => $tanggal_selesai,
                'jam_mulai'       => $jam_mulai,
                'jam_selesai'     => $jam_selesai,
                'start_time'      => $jam_mulai,
                'end_time'        => $jam_selesai,
                'start_at'        => $start_at,
                'end_at'          => $end_at,
                'crew_ids'        => array_values(array_unique($crew_ids)),
                'crew_names'      => array_values(array_unique($crew_names)),
                'pic_id'          => $pic_id ?: null,
                'pic_name'        => $pic_name ?: 'Belum ditentukan',
                'tenggat'         => $tenggat,
                'status'          => $status,
                'created_at'      => $created_at,
                'updated_at'      => $updated_at,
            ];
            $pos++;
        }

        // Urutkan berdasarkan start_at ASC (tanggal + waktu), fallback jam_mulai ASC, lalu urutan ASC
        usort($clean, function($a, $b) {
            $hasDateA = !empty($a['tanggal_mulai']);
            $hasDateB = !empty($b['tanggal_mulai']);
            if ($hasDateA && $hasDateB) {
                $cmp = strcmp($a['start_at'], $b['start_at']);
                if ($cmp !== 0) return $cmp;
            } elseif (!$hasDateA && !$hasDateB) {
                $tA = !empty($a['jam_mulai']) ? $a['jam_mulai'] : '99:99';
                $tB = !empty($b['jam_mulai']) ? $b['jam_mulai'] : '99:99';
                if ($tA !== $tB) return strcmp($tA, $tB);
            }
            return ($a['urutan'] ?? 0) <=> ($b['urutan'] ?? 0);
        });

        // Normalisasi urutan berurutan (1, 2, 3...)
        foreach ($clean as $idx => &$item) {
            $item['urutan'] = $idx + 1;
        }
        unset($item);

        return $clean;
    }
}

/**
 * Inisialisasi skema tabel basis data lokal untuk data persisten
 */
function ptv_dashboard_init_tables() {
    global $wpdb;
    static $initialized = false;
    if ($initialized) return;
    $initialized = true;

    $charset_collate = $wpdb->get_charset_collate();
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

    // 1. Keuangan
    $table_keuangan = $wpdb->prefix . 'ptv_keuangan';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_keuangan}'") !== $table_keuangan) {
        $sql1 = "CREATE TABLE {$table_keuangan} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            no varchar(60) NOT NULL DEFAULT '',
            type varchar(60) NOT NULL DEFAULT 'Kuitansi',
            client varchar(150) NOT NULL DEFAULT '',
            amount bigint(20) NOT NULL DEFAULT 0,
            date date NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'Menunggu',
            notes text NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset_collate};";
        dbDelta($sql1);
    }

    // 2. Konten
    $table_konten = $wpdb->prefix . 'ptv_konten';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_konten}'") !== $table_konten) {
        $sql2 = "CREATE TABLE {$table_konten} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL DEFAULT '',
            platform varchar(60) NOT NULL DEFAULT 'Instagram',
            date date NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'Draft',
            notes text NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset_collate};";
        dbDelta($sql2);
    }

    // 3. Log Peminjaman Alat
    $table_pinjam = $wpdb->prefix . 'ptv_peminjaman_log';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_pinjam}'") !== $table_pinjam) {
        $sql3 = "CREATE TABLE {$table_pinjam} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            transaction_id varchar(64) NOT NULL DEFAULT '',
            item_id varchar(100) NOT NULL DEFAULT '',
            unit_no varchar(20) NOT NULL DEFAULT '',
            unit_code varchar(100) NOT NULL DEFAULT '',
            borrower varchar(150) NOT NULL DEFAULT '',
            purpose varchar(255) NOT NULL DEFAULT '',
            out_date date NOT NULL,
            due_date date NOT NULL,
            back_date varchar(50) NOT NULL DEFAULT '',
            event_name varchar(255) NOT NULL DEFAULT '',
            notes text NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_txn (transaction_id),
            KEY idx_item (item_id)
        ) {$charset_collate};";
        dbDelta($sql3);
    } else {
        // Upgrade kolom untuk tabel yang sudah ada
        $cols = $wpdb->get_results("SHOW COLUMNS FROM {$table_pinjam}", ARRAY_A);
        $col_names = array_column($cols, 'Field');
        if (!in_array('transaction_id', $col_names, true)) {
            $wpdb->query("ALTER TABLE {$table_pinjam} ADD COLUMN transaction_id varchar(64) NOT NULL DEFAULT '' AFTER id, ADD INDEX idx_txn (transaction_id)");
        }
        if (!in_array('unit_no', $col_names, true)) {
            $wpdb->query("ALTER TABLE {$table_pinjam} ADD COLUMN unit_no varchar(20) NOT NULL DEFAULT '' AFTER item_id");
        }
        if (!in_array('unit_code', $col_names, true)) {
            $wpdb->query("ALTER TABLE {$table_pinjam} ADD COLUMN unit_code varchar(100) NOT NULL DEFAULT '' AFTER unit_no");
        }
        if (!in_array('purpose', $col_names, true)) {
            $wpdb->query("ALTER TABLE {$table_pinjam} ADD COLUMN purpose varchar(255) NOT NULL DEFAULT '' AFTER borrower");
        }
    }

    // 3b. Login History
    $table_login = $wpdb->prefix . 'ptv_login_history';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_login}'") !== $table_login) {
        $sql_login = "CREATE TABLE {$table_login} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id varchar(100) NOT NULL DEFAULT '',
            ptv_id varchar(50) NOT NULL DEFAULT '',
            nama varchar(150) NOT NULL DEFAULT '',
            username varchar(100) NOT NULL DEFAULT '',
            role varchar(50) NOT NULL DEFAULT '',
            login_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address varchar(45) NOT NULL DEFAULT '',
            user_agent varchar(500) NOT NULL DEFAULT '',
            PRIMARY KEY (id),
            KEY idx_user (user_id),
            KEY idx_login_at (login_at)
        ) {$charset_collate};";
        dbDelta($sql_login);
    }

    // 4. Lapor Kendala / Kerusakan Alat & Quality Check
    $table_lapor = $wpdb->prefix . 'ptv_lapor_masalah';
    $sql4 = "CREATE TABLE {$table_lapor} (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        alat_id varchar(100) NOT NULL DEFAULT '',
        nama_alat varchar(255) NOT NULL DEFAULT '',
        masalah varchar(255) NOT NULL DEFAULT '',
        keterangan text NULL,
        foto_url text NULL,
        pelapor_kru_id bigint(20) NOT NULL DEFAULT 0,
        pelapor_nama varchar(150) NOT NULL DEFAULT '',
        status varchar(50) NOT NULL DEFAULT 'baru',
        catatan_admin text NULL,
        qc_by varchar(150) NULL,
        qc_date datetime NULL,
        qc_notes text NULL,
        qc_status varchar(50) NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) {$charset_collate};";
    dbDelta($sql4);

    // 5. Lost & Found
    $table_lf = $wpdb->prefix . 'ptv_lost_found';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_lf}'") !== $table_lf) {
        $sql5 = "CREATE TABLE {$table_lf} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            tipe varchar(50) NOT NULL DEFAULT 'kehilangan',
            nama_barang varchar(255) NOT NULL DEFAULT '',
            lokasi varchar(255) NOT NULL DEFAULT '',
            tanggal date NOT NULL,
            keterangan text NULL,
            foto_url text NULL,
            pelapor_kru_id bigint(20) NOT NULL DEFAULT 0,
            pelapor_nama varchar(150) NOT NULL DEFAULT '',
            pelapor_kontak varchar(100) NOT NULL DEFAULT '',
            status varchar(50) NOT NULL DEFAULT 'dicari',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset_collate};";
        dbDelta($sql5);
    }

    // 6. Surat Bawa Barang (Peralatan)
    $table_barang = $wpdb->prefix . 'ptv_surat_barang';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_barang}'") !== $table_barang) {
        $sql6 = "CREATE TABLE {$table_barang} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            nomor_surat varchar(60) NOT NULL DEFAULT '',
            keperluan varchar(255) NOT NULL DEFAULT '',
            item_id varchar(100) NOT NULL DEFAULT '',
            daftar_barang text NULL,
            pembawa varchar(150) NOT NULL DEFAULT '',
            tanggal_mulai datetime NOT NULL,
            tanggal_selesai datetime NOT NULL,
            status varchar(30) NOT NULL DEFAULT 'menunggu',
            catatan text NULL,
            diajukan_oleh bigint(20) NOT NULL DEFAULT 0,
            disetujui_oleh varchar(150) NOT NULL DEFAULT '',
            catatan_approver text NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_nomor (nomor_surat),
            KEY idx_status (status)
        ) {$charset_collate};";
        dbDelta($sql6);
    }

    // 7. Notifikasi Persisten
    $table_notif = $wpdb->prefix . 'ptv_notifications';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_notif}'") !== $table_notif) {
        $sql7 = "CREATE TABLE {$table_notif} (
            id varchar(64) NOT NULL,
            recipient_crew_id varchar(100) NOT NULL,
            title varchar(255) NOT NULL,
            message text NOT NULL,
            type varchar(50) NOT NULL DEFAULT 'system',
            entity_type varchar(50) DEFAULT NULL,
            entity_id varchar(100) DEFAULT NULL,
            action_url varchar(255) DEFAULT NULL,
            icon varchar(50) NOT NULL DEFAULT 'bell',
            is_read tinyint(1) NOT NULL DEFAULT 0,
            is_protected tinyint(1) NOT NULL DEFAULT 0,
            read_at datetime DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_recipient (recipient_crew_id),
            KEY idx_unread (recipient_crew_id, is_read),
            KEY idx_protected (recipient_crew_id, is_protected),
            KEY idx_created (created_at)
        ) {$charset_collate};";
        dbDelta($sql7);
    } else {
        $has_prot_col = $wpdb->get_results("SHOW COLUMNS FROM {$table_notif} LIKE 'is_protected'");
        if (empty($has_prot_col)) {
            $wpdb->query("ALTER TABLE {$table_notif} ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0 AFTER is_read");
        }
    }

    // 8. Push Subscriptions
    $table_push = $wpdb->prefix . 'ptv_push_subscriptions';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_push}'") !== $table_push) {
        $sql8 = "CREATE TABLE {$table_push} (
            id varchar(64) NOT NULL,
            crew_id varchar(100) NOT NULL,
            endpoint varchar(500) NOT NULL,
            p256dh text NOT NULL,
            auth text NOT NULL,
            user_agent varchar(255) DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_used_at datetime DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_endpoint (endpoint(191)),
            KEY idx_crew (crew_id)
        ) {$charset_collate};";
        dbDelta($sql8);
    }

    // 9. Kontak Eksternal
    $table_kontak_eks = $wpdb->prefix . 'ptv_kontak_eksternal';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_kontak_eks}'") !== $table_kontak_eks) {
        $sql9 = "CREATE TABLE {$table_kontak_eks} (
            id varchar(64) NOT NULL,
            nama varchar(255) NOT NULL,
            kategori varchar(100) NOT NULL DEFAULT 'Lainnya',
            jabatan varchar(150) DEFAULT '',
            organisasi varchar(200) DEFAULT '',
            nomor_telepon varchar(50) DEFAULT '',
            whatsapp varchar(50) DEFAULT '',
            email varchar(150) DEFAULT '',
            alamat text DEFAULT NULL,
            catatan text DEFAULT NULL,
            foto_url text DEFAULT NULL,
            status varchar(50) NOT NULL DEFAULT 'Aktif',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_kategori_status (kategori, status),
            KEY idx_nama (nama)
        ) {$charset_collate};";
        dbDelta($sql9);
    }
}
add_action('init', 'ptv_dashboard_init_tables');

/**
 * Broadcast Realtime Event ke seluruh klien aktif via Supabase Realtime REST API
 * Menggunakan non-blocking HTTP request sehingga tidak menghambat respon AJAX pengirim.
 */
function ptv_realtime_broadcast_change($table, $scope, $event_type, $id, $extra_data = []) {
    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        return false;
    }
    $url = get_option('ptv_supabase_url', '');
    $service_key = get_option('ptv_supabase_service_key', '');
    if (empty($url) || empty($service_key)) {
        return false;
    }

    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        @session_start();
    }

    // Resolusi identitas pengirim (client_id, actor_id, actor_name)
    $client_id = sanitize_text_field(
        $extra_data['client_id'] ?? 
        ($_POST['client_id'] ?? ($_GET['client_id'] ?? ($_SERVER['HTTP_X_PTV_CLIENT_ID'] ?? '')))
    );
    $actor_id = sanitize_text_field(
        $extra_data['actor_id'] ?? 
        ($_POST['actor_id'] ?? ($_GET['actor_id'] ?? ($_SERVER['HTTP_X_PTV_ACTOR_ID'] ?? ($_SESSION['ptv_crew_supabase_id'] ?? ($_SESSION['ptv_admin_id'] ?? '')))))
    );
    $actor_name = sanitize_text_field(
        $extra_data['actor_name'] ?? 
        ($_POST['actor_name'] ?? ($_GET['actor_name'] ?? ($_SERVER['HTTP_X_PTV_ACTOR_NAME'] ?? ($_SESSION['ptv_admin_name'] ?? 'Kru PTV'))))
    );

    $endpoint = rtrim($url, '/') . '/realtime/v1/api/broadcast';
    $payload = array_merge([
        'table'      => $table,
        'scope'      => $scope,
        'eventType'  => strtoupper($event_type),
        'id'         => (string)$id,
        'client_id'  => $client_id,
        'actor_id'   => $actor_id,
        'actor_name' => $actor_name,
        'timestamp'  => current_time('mysql'),
    ], $extra_data);

    if (empty($payload['client_id']) && !empty($client_id)) $payload['client_id'] = $client_id;
    if (empty($payload['actor_id']) && !empty($actor_id)) $payload['actor_id'] = $actor_id;
    if (empty($payload['actor_name']) && !empty($actor_name)) $payload['actor_name'] = $actor_name;

    $body = wp_json_encode([
        'messages' => [
            [
                'topic'   => 'ptv_dashboard_realtime_sync',
                'event'   => 'table_change',
                'payload' => $payload,
            ]
        ]
    ]);

    wp_remote_post($endpoint, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => [
            'apikey'        => $service_key,
            'Authorization' => 'Bearer ' . $service_key,
            'Content-Type'  => 'application/json',
        ],
        'body'     => $body,
    ]);

    return true;
}

/**
 * Mengambil data awal (hydration) untuk dashboard
 */
function ptv_dashboard_get_initial_data($scope = 'all') {
    global $wpdb;
    ptv_dashboard_init_tables();

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $role = 'crew';
    if (in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options')) {
        $role = 'eksekutif';
    } elseif (in_array($raw_role, ['administrasi', 'admin'], true)) {
        $role = 'administrasi';
    }

    $current_name   = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');
    $current_kru_id = (int)($_SESSION['ptv_kru_post_id'] ?? ($_SESSION['ptv_crew_post_id'] ?? 0));
    $crew_ptv_id    = trim((string)($_SESSION['ptv_crew_id'] ?? ''));
    $crew_divisi    = $_SESSION['ptv_crew_divisi'] ?? 'Operasional';
    $crew_username  = $_SESSION['ptv_crew_username'] ?? '';
    $sb_uuid        = $_SESSION['ptv_kru_sb_id'] ?? '';

    // Ambil data real-time kru dari Supabase ptv_kru jika ada
    $sb_me = null;
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if (!empty($sb_uuid) && strlen($sb_uuid) === 36 && strpos($sb_uuid, 'cpt:') !== 0) {
            $r = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($sb_uuid) . '&limit=1');
            if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
        }
        if (!$sb_me && !empty($crew_username) && $crew_username !== 'ptv_user') {
            $r = PTV_Supabase::select('ptv_kru', '?username=ilike.' . urlencode($crew_username) . '&limit=1');
            if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
        }
        if (!$sb_me && !empty($crew_ptv_id)) {
            $r = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($crew_ptv_id) . '&limit=1');
            if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
        }
    }

    $crew_pos        = 'Kru';
    $crew_status     = 'Aktif';
    $oauth_provider  = '';
    $oauth_email     = '';
    $angkatan        = '';
    $nim             = '';
    $jurusan         = '';

    if ($sb_me) {
        $current_name   = $sb_me['nama'] ?? $current_name;
        $crew_ptv_id    = trim((string)($sb_me['crew_id'] ?? $crew_ptv_id));
        $crew_divisi    = $sb_me['divisi'] ?? $crew_divisi;
        $crew_pos       = $sb_me['jabatan'] ?? 'Kru';
        $crew_status    = ucfirst(strtolower((string)($sb_me['status'] ?? 'Aktif')));
        $crew_username  = $sb_me['username'] ?? $crew_username;
        $oauth_provider = (string)($sb_me['oauth_provider'] ?? '');
        $oauth_email    = (string)($sb_me['oauth_email'] ?? '');
        $angkatan       = (string)($sb_me['angkatan'] ?? '');
        $nim            = (string)($sb_me['nim'] ?? '');
        $jurusan        = (string)($sb_me['jurusan'] ?? '');
        if (!empty($sb_me['foto_url'])) {
            $crew_foto = $sb_me['foto_url'];
        }

        // Sinkronisasi role murni dari Supabase ptv_kru kolom role
        $sb_role_raw = strtolower(trim((string)($sb_me['role'] ?? '')));
        if (!empty($sb_role_raw)) {
            $role = $sb_role_raw;
        }
        $_SESSION['ptv_admin_role'] = $role;
    }

    // Telepon dan foto diambil murni dari Supabase ptv_kru (sudah diset di atas dari $sb_me).
    // Jika field kosong di Supabase, biarkan kosong — tidak ada fallback ke WP post_meta.
    $crew_phone = (string)($sb_me['telepon'] ?? ($sb_me['no_wa'] ?? ($sb_me['phone'] ?? ($_SESSION['ptv_crew_phone'] ?? ''))));
    $crew_foto  = (string)($sb_me['foto_url'] ?? ($_SESSION['ptv_crew_foto'] ?? ''));
    $crew_join  = !empty($sb_me['created_at']) ? substr((string)$sb_me['created_at'], 0, 10) : '2024-01-01';

    $clean_phone = preg_replace('/[^0-9]/', '', $crew_phone);
    if (str_starts_with($clean_phone, '08')) {
        $clean_phone = '628' . substr($clean_phone, 2);
    }


    $first_name = explode(' ', trim($current_name))[0] ?? 'Kru';

    // Resolve UUID Supabase kru untuk autentikasi data & push subscriptions
    $final_sb_id = '';
    if (!empty($sb_me['id'])) {
        $final_sb_id = (string)$sb_me['id'];
    } elseif (!empty($sb_uuid) && strlen($sb_uuid) === 36 && strpos($sb_uuid, 'cpt:') !== 0) {
        $final_sb_id = (string)$sb_uuid;
    } elseif (function_exists('ptv_get_authenticated_crew_id')) {
        $final_sb_id = ptv_get_authenticated_crew_id();
    }
    if ($final_sb_id && empty($_SESSION['ptv_kru_sb_id'])) {
        $_SESSION['ptv_kru_sb_id'] = $final_sb_id;
    }

    $ME = [
        'id'             => $final_sb_id,
        'sb_id'          => $final_sb_id,
        'name'           => $current_name,
        'short'          => $first_name,
        'username'       => $crew_username ?: '',
        'ptvId'          => $crew_ptv_id, // Tanpa fallback PTV-001
        'crew_id'        => $crew_ptv_id,
        'div'            => $crew_divisi,
        'pos'            => $crew_pos,
        'role'           => $role,
        'status'         => $crew_status,
        'phone'          => $clean_phone ?: '',
        'join'           => $crew_join,
        'foto_url'       => $crew_foto ?: '',
        'photo'          => $crew_foto ?: '',
        'oauth_provider' => $oauth_provider,
        'oauth_email'    => $oauth_email,
        'angkatan'       => $angkatan,
        'nim'            => $nim,
        'jurusan'        => $jurusan,
    ];

    // Inisialisasi default seluruh variabel data dashboard
    $announcements         = [];
    $events                = [];
    $existing_event_keys   = [];
    $inventory             = [];
    $inventory_values_list = [];
    $inventory_sources     = [];
    $loans                 = [];
    $damages               = [];
    $lost                  = [];
    $docs                  = [];
    $crew                  = [];
    $kontak_eksternal      = [];
    $finance               = [];
    $pemasukan             = [];
    $pengeluaran           = [];
    $kas_kru               = [];
    $kas_periode           = [];
    $keuangan_tables_ready = true;
    $keuangan_access_denied= false;
    $contents              = [];
    $content_planner       = [];
    $notes                 = [];
    $notifs                = [];

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
    // 1. PENGUMUMAN (SINGLE SOURCE OF TRUTH: SUPABASE ptv_pengumuman)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'announcements') {
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_ann = PTV_Supabase::select('ptv_pengumuman', '?status=eq.aktif&order=created_at.desc&limit=25');
        if (is_array($sb_ann) && !is_wp_error($sb_ann)) {
            foreach ($sb_ann as $ap) {
                $prio = (string)($ap['prioritas'] ?? 'Normal');
                $announcements[] = [
                    'id'    => (string)($ap['id'] ?? uniqid()),
                    'title' => html_entity_decode((string)($ap['judul'] ?? 'Pengumuman'), ENT_QUOTES, 'UTF-8'),
                    'body'  => (string)($ap['konten'] ?? ''),
                    'prio'  => (strtolower($prio) === 'penting' || strtolower($prio) === 'urgent') ? 'penting' : 'normal',
                    'by'    => 'Redaksi PTV',
                    'date'  => substr((string)($ap['created_at'] ?? date('Y-m-d')), 0, 10),
                ];
            }
        }
    }
    // Jika tidak ada pengumuman di Supabase, return array kosong (empty state murni tanpa dummy data).

// ─────────────────────────────────────────────────────────────
        // -------------------------------------------------------------
    // UTF-8 / MOJIBAKE SANITIZATION HELPER
    // -------------------------------------------------------------
    if (!function_exists('ptv_sanitize_utf8_text')) {
        function ptv_sanitize_utf8_text($str, $fallback = '') {
            if ($str === null || $str === false) return $fallback;
            $s = (string)$str;
            $s = trim($s);
            if ($s === '' || $s === 'null' || $s === '[]') return $fallback;

            // Pembersihan karakter mojibake akibat double encoding UTF-8 / Windows-1252
            $mojibake_map = [
                "\xC3\x83\xC2\xA2\xC3\xA2\xE2\x80\x9A\xC2\xAC\xC3\xA2\xE2\x82\xAC\xC2\x9D" => '—',
                "\xC3\x83\xC2\xA2\xC3\xA2\xE2\x80\x9A\xC2\xAC\xC3\xA2\xE2\x82\xAC\xC5\x93" => '–',
                '–' => '–',
                'Ã¢â‚¬â€”' => '—',
                'Ã¢â‚¬â—'  => '—',
                'Ã¢â‚¬â'   => '—',
                'Ã¢â‚¬'    => '—',
                'Ã¢,¬â€œ'  => '–',
                'Ã¢,¬â€”'  => '—',
                'Ã¢,¬'     => '—',
                'â‚¬â€œ'   => '–',
                'â‚¬â€”'   => '—',
                'â‚¬â—'    => '—',
                'â€“'      => '–',
                'â€”'      => '—',
                'Ã¢â€ â€™'  => '→',
                'Ã¢â€ â€™'  => '→',
                'â†’'      => '→',
                'Ã¢â€ Â '  => '←',
                'â† '      => '←',
                'Ã¢â‚¬Â¢'  => '•',
                'â€¢'      => '•',
                'Ã‚Â·'     => '·',
                'Â·'       => '·',
                'Ã¢â‚¬Â¦'  => '…',
                'â€¦'      => '…',
                'Ã¢â‚¬Å“'  => '“',
                'Ã¢â‚¬Â '  => '”',
                'Ã¢â‚¬â„¢' => '’',
                'Ã¢â‚¬Ëœ'  => '‘',
                'â€œ'      => '"',
                'â€ '      => '"',
                'â€™'      => "'",
                'â€˜'      => "'",
                'Ã‚ '      => ' ',
                'Ã‚'       => '',
                'Â '       => ' ',
                '&amp;'    => '&',
            ];
            $s = str_replace(array_keys($mojibake_map), array_values($mojibake_map), $s);
            $s = trim($s);

            if ($s === '' || $s === 'null') return $fallback;
            if (($s === '-' || $s === '—') && $fallback !== '') return $fallback;
            return $s;
        }
    }

    } // Tutup scope announcements

    // ─────────────────────────────────────────────────────────────
    // 2. ACARA & AGENDA (SUPABASE ptv_acara + WP CPT acara_ptv DUAL PERSISTENCE)
    // ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'events') {
        $events = [];
        $existing_event_keys = [];

        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_events = PTV_Supabase::select('ptv_acara', '?order=tanggal_mulai.desc&limit=200');
        if (is_array($sb_events) && !is_wp_error($sb_events) && !isset($sb_events['code'])) {
            foreach ($sb_events as $row) {
                $ev_id = (string)($row['id'] ?? '');
                if (empty($ev_id)) continue;

                $desc = (string)($row['deskripsi'] ?? '');
                $meta = [];
                if (preg_match('/<!-- PTV_META:\s*({.+?})\s*-->/s', $desc, $m)) {
                    $meta = json_decode($m[1], true) ?: [];
                    $desc = trim(str_replace($m[0], '', $desc));
                }

                $sb_st = strtolower(trim((string)($row['status'] ?? 'aktif')));
                $status = 'Terjadwal';
                if ($sb_st === 'selesai') {
                    $status = 'Selesai';
                } elseif ($sb_st === 'batal') {
                    $status = 'Batal';
                } elseif ($sb_st === 'aktif') {
                    if (!empty($meta['status_detail']) && (strtolower($meta['status_detail']) === 'berjalan' || strtolower($meta['status_detail']) === 'ongoing')) {
                        $status = 'Berjalan';
                    } else {
                        $status = 'Terjadwal';
                    }
                } elseif ($sb_st === 'draft') {
                    $status = 'Draft';
                }

                $crew_list = $meta['crew'] ?? [];
                $clean_crew_list = [];
                if (is_array($crew_list)) {
                    foreach ($crew_list as $c_item) {
                        if (is_array($c_item)) {
                            $c_name = ptv_sanitize_utf8_text($c_item['name'] ?? ($c_item['nama'] ?? ($c_item['full_name'] ?? ($c_item['nama_lengkap'] ?? ''))));
                            if (empty($c_name) || $c_name === '[object Object]') continue;
                            $c_id   = ptv_sanitize_utf8_text($c_item['id'] ?? ($c_item['crew_id'] ?? ''));
                            $c_job  = ptv_sanitize_utf8_text($c_item['job'] ?? ($c_item['tugas'] ?? ''));
                            $clean_crew_list[] = [
                                'id'    => $c_id,
                                'name'  => $c_name,
                                'job'   => $c_job,
                                'tugas' => $c_job,
                            ];
                        } elseif (is_string($c_item) && trim($c_item) !== '') {
                            $c_name = ptv_sanitize_utf8_text(trim($c_item));
                            if (!empty($c_name) && $c_name !== '[object Object]') {
                                $clean_crew_list[] = [
                                    'id'    => '',
                                    'name'  => $c_name,
                                    'job'   => '',
                                    'tugas' => '',
                                ];
                            }
                        }
                    }
                }

                $gear_list = $meta['gear'] ?? [];
                $clean_gear_list = [];
                if (is_array($gear_list)) {
                    foreach ($gear_list as $g_item) {
                        if (is_array($g_item)) {
                            $g_id = ptv_sanitize_utf8_text($g_item['id'] ?? ($g_item['item_id'] ?? ''));
                            if (!empty($g_id)) {
                                $clean_gear_list[] = [
                                    'id'    => $g_id,
                                    'qty'   => max(1, intval($g_item['qty'] ?? 1)),
                                    'name'  => ptv_sanitize_utf8_text($g_item['name'] ?? ''),
                                    'code'  => ptv_sanitize_utf8_text($g_item['code'] ?? ''),
                                    'photo' => ptv_sanitize_utf8_text($g_item['photo'] ?? ($g_item['foto_url'] ?? ($g_item['gambar'] ?? ''))),
                                    'cat'   => ptv_sanitize_utf8_text($g_item['cat'] ?? ''),
                                    'units' => is_array($g_item['units'] ?? null) ? $g_item['units'] : [],
                                ];
                            }
                        } elseif (is_string($g_item) && trim($g_item) !== '') {
                            $g_id = ptv_sanitize_utf8_text(trim($g_item));
                            if (!empty($g_id) && $g_id !== '[object Object]' && $g_id !== 'Array') {
                                $clean_gear_list[] = [
                                    'id'    => $g_id,
                                    'qty'   => 1,
                                    'name'  => '',
                                    'code'  => '',
                                    'photo' => '',
                                    'cat'   => '',
                                    'units' => [],
                                ];
                            }
                        }
                    }
                }

                $time_str = ptv_sanitize_utf8_text($meta['time'] ?? '08:00 – Selesai', '08:00 – Selesai');
                $loc_str  = ptv_sanitize_utf8_text(!empty($row['lokasi']) ? (string)$row['lokasi'] : ($meta['loc'] ?? 'Studio PTV'), 'Studio PTV');
                $type_str = ptv_sanitize_utf8_text($meta['type'] ?? ((string)($row['tipe'] ?? 'internal')), 'internal');
                $dress_str = ptv_sanitize_utf8_text($meta['dresscode'] ?? '', '');

                $ev_name = ptv_sanitize_utf8_text(html_entity_decode((string)($row['judul'] ?? 'Acara PTV'), ENT_QUOTES, 'UTF-8'), 'Acara PTV');
                $ev_date = (string)($row['tanggal_mulai'] ?? date('Y-m-d'));

                // Extract and clean structured rundown array per acara
                $raw_rd = $row['rundown'] ?? ($meta['rundown'] ?? []);
                $clean_rundown = ptv_sanitize_rundown_list($raw_rd, $ev_id);

                $events[] = [
                    'id'        => $ev_id,
                    'name'      => $ev_name,
                    'date'      => $ev_date,
                    'time'      => $time_str,
                    'loc'       => $loc_str,
                    'status'    => $status,
                    'crew'      => $clean_crew_list,
                    'gear'      => $clean_gear_list,
                    'rundown'   => $clean_rundown,
                    'type'      => $type_str,
                    'dresscode' => $dress_str,
                    'notes'     => ptv_sanitize_utf8_text($desc ?: '—', '—'),
                    'doc'       => (string)($row['poster_url'] ?? ''),
                ];

                $existing_event_keys[$ev_id] = true;
                $existing_event_keys[strtolower(trim($ev_name)) . '_' . $ev_date] = true;
            }
        }
    }

    // CPT acara_ptv tidak lagi dipakai sebagai sumber data (Supabase adalah single source of truth).
    // Semua acara harus diinput melalui dashboard yang menulis ke Supabase ptv_acara.

    if (!empty($events)) {
        usort($events, function($a, $b) {
            return strcmp($b['date'] ?? '', $a['date'] ?? '');
        });
    }

    } // Tutup scope events

    if ($scope === 'events') {
        return [
            'ME'    => $ME,
            'DB'    => [
                'events' => $events,
            ],
            'scope' => 'events',
        ];
    }

// ─────────────────────────────────────────────────────────────
    // 3. INVENTARIS ALAT, PEMINJAMAN & LAPOR KERUSAKAN
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || in_array($scope, ['inventory', 'loans', 'damages'], true)) {

    if (!function_exists('ptv_normalize_inventory_cat_name')) {
        function ptv_normalize_inventory_cat_name($cat) {
            $c = trim((string)$cat);
            if (empty($c)) return 'Lainnya';
            $c = preg_replace('/\s*\/\s*/', ' / ', $c);
            $lower = strtolower($c);
            if ($lower === 'kamera' || $lower === 'camera' || strpos($lower, 'kamera') === 0) return 'Kamera';
            if ($lower === 'lensa' || $lower === 'lens' || strpos($lower, 'lensa') === 0) return 'Lensa';
            if (strpos($lower, 'tripod') !== false || strpos($lower, 'rig') !== false || strpos($lower, 'gimbal') !== false || strpos($lower, 'monopod') !== false || strpos($lower, 'stabilizer') !== false) return 'Tripod';
            if (strpos($lower, 'smartphone') !== false || strpos($lower, 'tablet') !== false || strpos($lower, 'ipad') !== false || strpos($lower, 'iphone') !== false || strpos($lower, 'hp') !== false || strpos($lower, 'android') !== false) return 'Smartphone / Tablet';
            if (strpos($lower, 'komputer') !== false || strpos($lower, 'laptop') !== false || strpos($lower, 'pc') !== false || strpos($lower, 'macbook') !== false) return 'Komputer / Laptop';
            if ($lower === 'audio' || $lower === 'mic' || $lower === 'sound' || strpos($lower, 'audio') === 0 || strpos($lower, 'mic') === 0 || strpos($lower, 'microphone') !== false || strpos($lower, 'headphone') !== false) return 'Audio';
            if (strpos($lower, 'light') !== false || strpos($lower, 'lampu') !== false || strpos($lower, 'softbox') !== false || strpos($lower, 'led') !== false) return 'Lighting';
            if (strpos($lower, 'stream') !== false || strpos($lower, 'live') !== false || strpos($lower, 'switcher') !== false || strpos($lower, 'atem') !== false || strpos($lower, 'broadcast') !== false) return 'Streaming / Live Production';
            if (strpos($lower, 'jaringan') !== false || strpos($lower, 'network') !== false || strpos($lower, 'router') !== false || strpos($lower, 'mikrotik') !== false || strpos($lower, 'wifi') !== false || strpos($lower, 'access point') !== false || strpos($lower, 'ethernet') !== false || strpos($lower, 'lan') !== false) return 'Pengaturan Jaringan';
            if (strpos($lower, 'baterai') !== false || strpos($lower, 'battery') !== false || strpos($lower, 'batere') !== false || strpos($lower, 'powerbank') !== false || strpos($lower, 'v-mount') !== false || strpos($lower, 'vmount') !== false) return 'Baterai & Power';
            if (strpos($lower, 'baterai') !== false || strpos($lower, 'battery') !== false || strpos($lower, 'batere') !== false || strpos($lower, 'powerbank') !== false || strpos($lower, 'v-mount') !== false || strpos($lower, 'vmount') !== false) return 'Baterai & Power';
        if (strpos($lower, 'kabel') !== false || strpos($lower, 'adapter') !== false || strpos($lower, 'cable') !== false || strpos($lower, 'charger') !== false) return 'Kabel & Adapter';
            if (strpos($lower, 'dry cabinet') !== false || strpos($lower, 'cabinet') !== false || strpos($lower, 'dry box') !== false) return 'Dry Cabinet';
            if (strpos($lower, 'smart tv') !== false || strpos($lower, ' tv') !== false || $lower === 'tv' || strpos($lower, 'televisi') !== false) return 'TV / Smart TV';
            if (strpos($lower, 'storage') !== false || strpos($lower, 'ssd') !== false || strpos($lower, 'hdd') !== false || strpos($lower, 'harddisk') !== false || strpos($lower, 'sd card') !== false || strpos($lower, 'memory') !== false || strpos($lower, 'flashdisk') !== false) return 'Storage';
            if (strpos($lower, 'peralatan') !== false || strpos($lower, 'perkakas') !== false || strpos($lower, 'tool') !== false || strpos($lower, 'obeng') !== false || strpos($lower, 'tang') !== false) return 'Peralatan & Perkakas';
            if (strpos($lower, 'atk') !== false || strpos($lower, 'alat tulis') !== false || strpos($lower, 'kertas') !== false) return 'ATK';
            return ucfirst($c);
        }
    }

    $inventory = [];
    $loans = [];
    $damages = [];
    $active_damages_by_item = []; // [ item_id => [ unit_no => [damage_info], ... ] ]

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // Ambil laporan kerusakan terlebih dahulu agar status unit rusak langsung terrefleksi di inventaris
        $sb_damages = PTV_Supabase::select('ptv_lapor_masalah', '?order=created_at.desc&limit=100');
        if (is_array($sb_damages) && !is_wp_error($sb_damages) && !isset($sb_damages['code'])) {
            foreach ($sb_damages as $lr) {
                $st_raw = strtolower(trim((string)($lr['status'] ?? 'baru')));
                $status = 'Baru';
                if (in_array($st_raw, ['dicek', 'investigasi', 'diperbaiki', 'sedang dicek', 'dalam perbaikan', 'diproses', 'diperiksa'], true)) $status = 'Sedang Dicek';
                elseif ($st_raw === 'selesai' || $st_raw === 'siap pakai') $status = 'Selesai';
                elseif ($st_raw === 'rusak total' || $st_raw === 'afkir') $status = 'Rusak Total';

                $item_id = (string)($lr['alat_id'] ?? '');
                $raw_dmg_ket = $lr['keterangan'] ?? '';
                $dmg_meta = [];
                if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $raw_dmg_ket, $dm)) {
                    $dmg_meta = json_decode($dm[1], true) ?: [];
                }

                $u_no_val = (string)($lr['unit_no'] ?? ($dmg_meta['unit_no'] ?? ''));
                $u_code_val = (string)($lr['unit_code'] ?? ($dmg_meta['unit_code'] ?? ''));
                if (empty($u_code_val) && !empty($lr['nama_alat']) && preg_match('/[-—–]\s*(INV-[A-Z0-9]+-\d+)/u', $lr['nama_alat'], $cm)) {
                    $u_code_val = $cm[1];
                }
                if (empty($u_no_val) && !empty($u_code_val) && preg_match('/-(\d+)$/', $u_code_val, $nm)) {
                    $u_no_val = (string)intval($nm[1]);
                }

                $clean_desc = trim(preg_replace('/<!-- PTV_META:.*?-->/s', '', $raw_dmg_ket));
                if ($clean_desc === '—' || $clean_desc === '-' || empty($clean_desc)) $clean_desc = '';
                $u_name_val = (string)($lr['unit_name'] ?? ($dmg_meta['unit_name'] ?? ''));
                $damage_entry = [
                    'id'        => (string)($lr['id'] ?? ''),
                    'item'      => $item_id,
                    'unit_no'   => $u_no_val,
                    'unit_code' => $u_code_val,
                    'unit_name' => $u_name_val,
                    'title'     => html_entity_decode((string)($lr['masalah'] ?? ($lr['nama_alat'] ?? 'Kendala Alat')), ENT_QUOTES, 'UTF-8'),
                    'desc'      => $clean_desc,
                    'by'        => (string)($lr['pelapor_nama'] ?? 'Kru PTV'),
                    'date'      => substr((string)($lr['created_at'] ?? date('Y-m-d')), 0, 10),
                    'status'    => $status,
                    'qc_by'     => (string)($lr['qc_by'] ?? ''),
                    'qc_date'   => substr((string)($lr['qc_date'] ?? ''), 0, 10),
                    'qc_notes'  => (string)($lr['qc_notes'] ?? ''),
                    'qc_status' => (string)($lr['qc_status'] ?? ($status === 'Sedang Dicek' ? 'Sedang Dicek' : ($status === 'Selesai' ? 'Selesai' : ''))),
                    'photo'     => (string)($lr['foto_url'] ?? ''),
                ];
                $damages[] = $damage_entry;

                // Petakan laporan kerusakan aktif per item & unit
                if ($status !== 'Selesai' && !empty($item_id)) {
                    if (!isset($active_damages_by_item[$item_id])) {
                        $active_damages_by_item[$item_id] = [];
                    }
                    $u_key = !empty($u_no_val) ? intval($u_no_val) : 0;
                    $active_damages_by_item[$item_id][$u_key] = $damage_entry;
                }
            }
        }

        if ($scope === 'damages') {
            return [
                'ME'    => $ME,
                'DB'    => [
                    'damages' => $damages,
                ],
                'scope' => 'damages',
            ];
        }

        // SINGLE SOURCE OF TRUTH: ptv_inventaris + ptv_inventaris_unit
        // ptv_aset tetap ada tapi tidak lagi dibaca sebagai sumber inventaris.
        $sb_inv = PTV_Supabase::select('ptv_inventaris', '?select=*,ptv_inventaris_unit(*)&limit=500');
        $sb_pinjam = PTV_Supabase::select('ptv_peminjaman', '?order=created_at.desc&limit=200');
        $sb_nilai = PTV_Supabase::select('ptv_nilai_inventaris', '?select=*&limit=1000');

        $nilai_by_inv_id = [];
        $inventory_values_list = [];
        if (is_array($sb_nilai) && !is_wp_error($sb_nilai) && !isset($sb_nilai['code'])) {
            foreach ($sb_nilai as $nv) {
                $inv_id = (string)($nv['inventaris_id'] ?? '');
                if (!empty($inv_id)) {
                    $formatted_nv = [
                        'id'                => (string)($nv['id'] ?? ''),
                        'inventaris_id'     => $inv_id,
                        'nilai_perolehan'   => floatval($nv['nilai_perolehan'] ?? 0),
                        'tanggal_perolehan' => substr((string)($nv['tanggal_perolehan'] ?? ''), 0, 10),
                        'sumber_perolehan'  => ptv_sanitize_utf8_text($nv['sumber_perolehan'] ?? '', 'Yayasan'),
                        'vendor'            => ptv_sanitize_utf8_text($nv['vendor'] ?? '', ''),
                        'nomor_invoice'     => ptv_sanitize_utf8_text($nv['nomor_invoice'] ?? '', ''),
                        'nilai_residu'      => floatval($nv['nilai_residu'] ?? 0),
                        'nilai_tercatat'    => isset($nv['nilai_tercatat']) && $nv['nilai_tercatat'] !== null ? floatval($nv['nilai_tercatat']) : null,
                        'status'            => ptv_sanitize_utf8_text($nv['status'] ?? '', 'Aktif'),
                        'catatan'           => ptv_sanitize_utf8_text($nv['catatan'] ?? '', ''),
                        'dokumen_url'       => esc_url_raw($nv['dokumen_url'] ?? ''),
                        'created_by_name'   => ptv_sanitize_utf8_text($nv['created_by_name'] ?? '', ''),
                        'created_at'        => (string)($nv['created_at'] ?? ''),
                        'updated_at'        => (string)($nv['updated_at'] ?? ''),
                    ];
                    $nilai_by_inv_id[$inv_id] = $formatted_nv;
                    $inventory_values_list[] = $formatted_nv;
                }
            }
        }

        // Bangun lookup: aset_id_lama -> inventaris_id (backward compat untuk loan lama)
        $inv_id_by_aset_lama = [];
        $existing_inv_ids = [];
        if (is_array($sb_inv) && !is_wp_error($sb_inv)) {
            foreach ($sb_inv as $ir) {
                $i_id = (string)($ir['id'] ?? '');
                if (!empty($i_id)) {
                    $existing_inv_ids[$i_id] = true;
                }
                if (!empty($ir['aset_id_lama'])) {
                    $inv_id_by_aset_lama[(string)$ir['aset_id_lama']] = $i_id;
                }
            }
        }

        $active_loans_by_item = [];
        $borrowed_units_by_item = [];
        if (is_array($sb_pinjam) && !is_wp_error($sb_pinjam)) {
            foreach ($sb_pinjam as $p) {
                $raw_catatan = $p['catatan'] ?? '';
                $meta = [];
                if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $raw_catatan, $m)) {
                    $meta = json_decode($m[1], true) ?: [];
                }

                $raw_keperluan = trim((string)($p['keperluan'] ?? ''));
                $borrower = trim((string)($meta['user'] ?? ($meta['account'] ?? ($meta['borrower_name'] ?? ''))));
                $purpose  = trim((string)($meta['purpose'] ?? ''));

                // Parse "Nama Peminjam — Catatan/Keperluan" from $raw_keperluan
                if (!empty($raw_keperluan)) {
                    if (preg_match('/^(.*?)\s+[-—–]\s+(.*)$/u', $raw_keperluan, $k_m)) {
                        if (empty($borrower) || $borrower === 'Kru PTV' || preg_match('/[-—–]/u', $borrower)) {
                            $borrower = trim($k_m[1]);
                        }
                        if (empty($purpose) || preg_match('/[-—–]/u', $purpose)) {
                            $purpose = trim($k_m[2]);
                        }
                    } else {
                        if (empty($purpose)) {
                            $purpose = $raw_keperluan;
                        }
                    }
                }

                // If borrower still contains separator (e.g. legacy script stored full text as borrower)
                if (!empty($borrower) && preg_match('/^(.*?)\s+[-—–]\s+(.*)$/u', $borrower, $b_m)) {
                    $borrower = trim($b_m[1]);
                    if (empty($purpose) || $purpose === 'Operasional PTV') {
                        $purpose = trim($b_m[2]);
                    }
                }

                if (!empty($purpose) && !empty($borrower) && preg_match('/^' . preg_quote($borrower, '/') . '\s+[-—–]\s+(.*)$/u', $purpose, $p_m)) {
                    $purpose = trim($p_m[1]);
                }

                if (empty($borrower)) $borrower = 'Kru PTV';
                if (empty($purpose))  $purpose  = 'Operasional PTV';

                $raw_eq_ids = $meta['equipment_ids'] ?? [];
                if (empty($raw_eq_ids)) {
                    if (!empty($p['inventaris_id'])) {
                        $raw_eq_ids = [(string)$p['inventaris_id']];
                    } elseif (!empty($p['aset_id'])) {
                        $raw_eq_ids = [(string)$p['aset_id']];
                    }
                }

                $eq_ids = [];
                foreach ($raw_eq_ids as $eq_eid) {
                    $eid_str = (string)$eq_eid;
                    if (isset($inv_id_by_aset_lama[$eid_str])) {
                        $eq_ids[] = $inv_id_by_aset_lama[$eid_str];
                    } elseif (isset($existing_inv_ids[$eid_str])) {
                        $eq_ids[] = $eid_str;
                    }
                }
                if (empty($eq_ids)) {
                    if (!empty($p['inventaris_id']) && isset($existing_inv_ids[(string)$p['inventaris_id']])) {
                        $eq_ids = [(string)$p['inventaris_id']];
                    } elseif (!empty($p['aset_id']) && isset($inv_id_by_aset_lama[(string)$p['aset_id']])) {
                        $eq_ids = [$inv_id_by_aset_lama[(string)$p['aset_id']]];
                    }
                }
                $eq_ids = array_values(array_unique(array_filter($eq_ids)));

                $tgl_pinjam  = substr((string)($meta['borrowed_at'] ?? ($p['tanggal_pinjam'] ?? $p['created_at'] ?? date('Y-m-d'))), 0, 10);
                $tgl_kembali = substr((string)($meta['expected_return'] ?? ($p['tanggal_kembali'] ?? '')), 0, 10);
                $tgl_kembali_real = substr((string)($meta['returned_at'] ?? ''), 0, 10);

                $p_status_raw = strtolower(trim((string)($p['status'] ?? 'borrowed')));
                $is_back = in_array($p_status_raw, ['returned', 'dikembalikan', 'selesai'], true);

                $loan_txn_id = (string)($meta['transaction_id'] ?? $p['id']);
                $meta_units  = $meta['units'] ?? [];

                if (!empty($meta_units) && is_array($meta_units)) {
                    foreach ($meta_units as $mu) {
                        $mu_raw_id = (string)($mu['assetId'] ?? ($mu['item_id'] ?? ($eq_ids[0] ?? '')));
                        $mu_eid   = $inv_id_by_aset_lama[$mu_raw_id] ?? (isset($existing_inv_ids[$mu_raw_id]) ? $mu_raw_id : ($eq_ids[0] ?? ''));
                        if (empty($mu_eid) || !isset($existing_inv_ids[$mu_eid])) continue;
                        $mu_uno   = (string)($mu['unitNo'] ?? ($mu['unit_no'] ?? ''));
                        $mu_ucode = (string)($mu['unitCode'] ?? ($mu['unit_code'] ?? ''));

                        $loans[] = [
                            'id'             => (string)$p['id'] . ($mu_uno ? '_' . $mu_uno : ''),
                            'transaction_id' => $loan_txn_id,
                            'item'           => $mu_eid,
                            'qty'            => 1,
                            'unit_no'        => $mu_uno,
                            'unit_code'      => $mu_ucode,
                            'unit_name'      => (string)($mu['unitName'] ?? ($mu['unit_name'] ?? '')),
                            'by'             => $borrower,
                            'purpose'        => $purpose ?: 'Operasional PTV',
                            'out'            => $tgl_pinjam,
                            'due'            => $tgl_kembali ?: date('Y-m-d', strtotime('+2 days')),
                            'back'           => $is_back ? ($tgl_kembali_real ?: date('Y-m-d')) : '',
                            'event'          => (string)($meta['event_id'] ?? ''),
                        ];

                        if (!$is_back) {
                            $borrowed_units_by_item[$mu_eid] = ($borrowed_units_by_item[$mu_eid] ?? 0) + 1;
                            if (!isset($active_loans_by_item[$mu_eid])) {
                                $active_loans_by_item[$mu_eid] = [
                                    'holder'   => $borrower,
                                    'purpose'  => $purpose ?: 'Operasional PTV',
                                    'due'      => $tgl_kembali ?: date('Y-m-d', strtotime('+2 days')),
                                    'borrowed' => 1,
                                    'unit_no'  => $mu_uno,
                                ];
                            } else {
                                $active_loans_by_item[$mu_eid]['borrowed'] += 1;
                            }
                        }
                    }
                } else {
                    $loan_unit_no   = (string)($meta['unit_no'] ?? '');
                    $loan_unit_code = (string)($meta['unit_code'] ?? '');
                    $eq_quantities  = $meta['equipment_quantities'] ?? [];

                    foreach ($eq_ids as $eid) {
                        $eid_str = (string)$eid;
                        $borrowed_item_qty = isset($eq_quantities[$eid_str]) ? max(1, intval($eq_quantities[$eid_str])) : (count($eq_ids) === 1 ? max(1, intval($p['jumlah'] ?? 1)) : 1);

                        $loans[] = [
                            'id'             => (string)$p['id'],
                            'transaction_id' => $loan_txn_id,
                            'item'           => $eid_str,
                            'qty'            => $borrowed_item_qty,
                            'unit_no'        => $loan_unit_no,
                            'unit_code'      => $loan_unit_code,
                            'unit_name'      => (string)($meta['unit_name'] ?? ''),
                            'by'             => $borrower,
                            'purpose'        => $purpose ?: 'Operasional PTV',
                            'out'            => $tgl_pinjam,
                            'due'            => $tgl_kembali ?: date('Y-m-d', strtotime('+2 days')),
                            'back'           => $is_back ? ($tgl_kembali_real ?: date('Y-m-d')) : '',
                            'event'          => (string)($meta['event_id'] ?? ''),
                        ];

                        if (!$is_back) {
                            $borrowed_units_by_item[$eid_str] = ($borrowed_units_by_item[$eid_str] ?? 0) + $borrowed_item_qty;
                            if (!isset($active_loans_by_item[$eid_str])) {
                                $active_loans_by_item[$eid_str] = [
                                    'holder'   => $borrower,
                                    'purpose'  => $purpose ?: 'Operasional PTV',
                                    'due'      => $tgl_kembali ?: date('Y-m-d', strtotime('+2 days')),
                                    'borrowed' => $borrowed_item_qty,
                                    'unit_no'  => $loan_unit_no,
                                ];
                            } else {
                                $active_loans_by_item[$eid_str]['borrowed'] += $borrowed_item_qty;
                            }
                        }
                    }
                }
            }
        }

        if ($scope === 'loans') {
            return [
                'ME'    => $ME,
                'DB'    => [
                    'loans' => $loans,
                ],
                'scope' => 'loans',
            ];
        }

        // Damages juga di-remap: alat_id lama -> inventaris_id baru
        foreach ($active_damages_by_item as $old_id => $dmg_entries) {
            if (isset($inv_id_by_aset_lama[$old_id])) {
                $new_id = $inv_id_by_aset_lama[$old_id];
                if (!isset($active_damages_by_item[$new_id])) {
                    $active_damages_by_item[$new_id] = $dmg_entries;
                }
            }
        }

        if (is_array($sb_inv) && !is_wp_error($sb_inv)) {
            $non_equipment_cats = ['tokoh', 'logo', 'yayasan', 'file pdf', 'pdf', 'ebook', 'e-book', 'buku', 'dokumen', 'desain', 'file', 'link', 'drive'];
            foreach ($sb_inv as $row) {
                $cat = ptv_normalize_inventory_cat_name($row['kategori'] ?? 'Lainnya');
                if (in_array(strtolower($cat), $non_equipment_cats, true)) continue;

                $aid         = (string)$row['id'];
                $kode_inv    = trim((string)($row['kode'] ?? ($row['kode_inventaris'] ?? '')));
                if (empty($kode_inv)) {
                    $kode_inv = 'INV-' . strtoupper(substr(str_replace('-', '', $aid), 0, 5));
                }

                // Unit fisik dari ptv_inventaris_unit (hasil PostgREST embed)
                $db_units    = $row['ptv_inventaris_unit'] ?? [];
                if (!is_array($db_units)) $db_units = [];
                // Urutkan berdasarkan nomor_unit
                usort($db_units, fn($a, $b) => intval($a['nomor_unit'] ?? 0) <=> intval($b['nomor_unit'] ?? 0));

                $qty_total   = max(1, count($db_units));
                $qty_borrowed = intval($borrowed_units_by_item[$aid] ?? 0);

                $brand = ptv_sanitize_utf8_text($row['brand'] ?? '', '');
                $model = ptv_sanitize_utf8_text($row['model'] ?? '', '');
                $loc   = ptv_sanitize_utf8_text($row['lokasi'] ?? '', 'Studio PTV');
                $qty   = $qty_total;
                $unit  = ptv_sanitize_utf8_text($row['satuan'] ?? '', 'unit');
                $specs = ptv_sanitize_utf8_text($row['spesifikasi'] ?? ($row['keterangan'] ?? ''), '');
                $sumber_perolehan = ptv_sanitize_utf8_text($row['sumber_perolehan'] ?? '', 'Yayasan');
                if (empty($sumber_perolehan)) $sumber_perolehan = 'Yayasan';

                $item_active_damages = $active_damages_by_item[$aid] ?? [];

                // Bangun unit_conditions dari baris DB unit fisik nyata
                $unit_conditions = [];
                foreach ($db_units as $du) {
                    $u_no     = intval($du['nomor_unit'] ?? 1);
                    $u_kode   = ptv_sanitize_utf8_text($du['kode_unit'] ?? '', ($kode_inv . '-' . sprintf('%02d', $u_no)));
                    $u_name   = ptv_sanitize_utf8_text($du['nama_unit'] ?? '', ('Unit ' . sprintf('%02d', $u_no)));
                    $u_sn     = ptv_sanitize_utf8_text($du['serial_number'] ?? '', '');
                    $u_cond   = ptv_sanitize_utf8_text($du['kondisi'] ?? '', 'Baik');
                    $u_notes  = ptv_sanitize_utf8_text($du['catatan'] ?? '', '');

                    // Override kondisi jika ada laporan kerusakan aktif untuk unit ini
                    $has_damage_report = false;
                    if (isset($item_active_damages[$u_no])) {
                        $has_damage_report = true;
                    } elseif (isset($item_active_damages[0]) && $qty_total === 1) {
                        $has_damage_report = true;
                    } else {
                        foreach ($item_active_damages as $d_info) {
                            if (!empty($d_info['unit_code']) && strtoupper($d_info['unit_code']) === strtoupper($u_kode)) {
                                $has_damage_report = true;
                                break;
                            }
                        }
                    }
                    if ($has_damage_report) $u_cond = 'Rusak';

                    $unit_conditions[] = [
                        'unit'              => $u_no,
                        'unit_id'           => (string)($du['id'] ?? ''),
                        'name'              => $u_name,
                        'nama_unit'         => $u_name,
                        'kode_unit'         => $u_kode,
                        'cond'              => $u_cond,
                        'sn'                => $u_sn,
                        'notes'             => $u_notes,
                        'has_active_damage' => $has_damage_report,
                        'status'            => ptv_sanitize_utf8_text($du['status'] ?? '', 'Tersedia'),
                    ];
                }

                // Jika tidak ada unit di DB (edge case), generate satu unit placeholder
                if (empty($unit_conditions)) {
                    $unit_conditions[] = [
                        'unit'              => 1,
                        'unit_id'           => '',
                        'name'              => 'Unit 01',
                        'nama_unit'         => 'Unit 01',
                        'kode_unit'         => $kode_inv . '-01',
                        'cond'              => 'Baik',
                        'sn'                => '',
                        'notes'             => '',
                        'has_active_damage' => false,
                        'status'            => 'Tersedia',
                    ];
                    $qty_total = 1;
                }

                // Hitung agregat dari unit nyata
                $qty_damaged  = count(array_filter($unit_conditions, fn($u) => in_array($u['cond'], ['Rusak', 'Bermasalah'], true) || !empty($u['has_active_damage'])));
                $qty_lost     = count(array_filter($unit_conditions, fn($u) => $u['cond'] === 'Hilang'));
                $qty_service  = count(array_filter($unit_conditions, fn($u) => $u['cond'] === 'Butuh Servis'));
                $qty_available = max(0, $qty_total - $qty_borrowed - $qty_damaged - $qty_lost);

                $holder = '';
                $due    = '';
                if (isset($active_loans_by_item[$aid])) {
                    $holder = $active_loans_by_item[$aid]['holder'];
                    $due    = $active_loans_by_item[$aid]['due'];
                }

                // Status master dihitung dari unit nyata
                if ($qty_lost >= $qty_total) {
                    $status = 'Hilang';
                } elseif ($qty_damaged >= $qty_total) {
                    $status = 'Rusak / Servis';
                } elseif ($qty_available === 0 && $qty_borrowed > 0) {
                    $status = 'Dipinjam';
                } else {
                    $status = 'Tersedia';
                }

                // Kondisi master dihitung dari unit
                if ($qty_damaged >= $qty_total) {
                    $master_cond = 'Rusak';
                } elseif ($qty_damaged > 0 || $qty_service > 0) {
                    $master_cond = 'Butuh Servis';
                } else {
                    $master_cond = 'Baik';
                }

                // Foto: dari kolom langsung
                $photo = (string)($row['foto_url'] ?? '');
                if (!empty($photo) && function_exists('ptv_clean_media_url')) {
                    $photo = ptv_clean_media_url($photo);
                }

                // Serial number representatif (dari unit pertama)
                $sn = !empty($unit_conditions[0]['sn']) ? $unit_conditions[0]['sn'] : '';

                $clean_item_name = ptv_sanitize_utf8_text(html_entity_decode((string)($row['nama'] ?? ($row['nama_alat'] ?? 'Alat PTV')), ENT_QUOTES, 'UTF-8'), 'Alat PTV');

                $inventory[] = [
                    'id'              => $aid,
                    'code'            => $kode_inv,
                    'name'            => $clean_item_name,
                    'cat'             => $cat ?: 'Peralatan',
                    'brand'           => $brand,
                    'model'           => $model,
                    'sn'              => $sn,
                    'loc'             => $loc ?: 'Studio PTV',
                    'sumber'          => $sumber_perolehan,
                    'sumber_perolehan'=> $sumber_perolehan,
                    'qty'             => $qty_total,
                    'qty_total'       => $qty_total,
                    'qty_borrowed'    => $qty_borrowed,
                    'qty_available'   => $qty_available,
                    'qty_damaged'     => $qty_damaged,
                    'qty_lost'        => $qty_lost,
                    'unit'            => $unit ?: 'unit',
                    'unit_conditions' => $unit_conditions,
                    'specs'           => $specs,
                    'notes'           => $specs,
                    'cond'            => $master_cond,
                    'status'          => $status,
                    'holder'          => $holder,
                    'due'             => $due,
                    'photo'           => $photo,
                    'aset_id_lama'    => (string)($row['aset_id_lama'] ?? ''),
                    'nilai_inventaris'=> $nilai_by_inv_id[$aid] ?? null,
                    'nilai_perolehan' => isset($nilai_by_inv_id[$aid]) ? floatval($nilai_by_inv_id[$aid]['nilai_perolehan'] ?? 0) : null,
                ];
            }
        }
    }

    // Sort Inventaris: Fixed Category Grouping lalu A-Z Nama Alat (secondary: Kode)
    if (!empty($inventory) && is_array($inventory)) {
        $norm_cat_func = function($cat) {
            $c = strtolower(trim((string)$cat));
            if ($c === 'kamera' || $c === 'camera' || strpos($c, 'kamera') === 0) return 1;
            if ($c === 'lensa' || $c === 'lens' || strpos($c, 'lensa') === 0) return 2;
            if (strpos($c, 'tripod') !== false || strpos($c, 'rig') !== false || strpos($c, 'gimbal') !== false || strpos($c, 'monopod') !== false) return 3;
            if (strpos($c, 'baterai') !== false || strpos($c, 'battery') !== false || strpos($c, 'batere') !== false || strpos($c, 'powerbank') !== false || strpos($c, 'v-mount') !== false) return 4;
            if (strpos($c, 'smartphone') !== false || strpos($c, 'tablet') !== false || strpos($c, 'ipad') !== false || strpos($c, 'iphone') !== false || strpos($c, 'android') !== false) return 5;
            if (strpos($c, 'komputer') !== false || strpos($c, 'laptop') !== false || strpos($c, 'pc') !== false) return 6;
            if ($c === 'audio' || $c === 'mic' || $c === 'sound' || strpos($c, 'audio') === 0 || strpos($c, 'mic') === 0) return 7;
            if (strpos($c, 'light') !== false || strpos($c, 'lampu') !== false) return 8;
            if (strpos($c, 'stream') !== false || strpos($c, 'live') !== false || strpos($c, 'switcher') !== false) return 9;
            if (strpos($c, 'kabel') !== false || strpos($c, 'adapter') !== false || strpos($c, 'cable') !== false) return 10;
            if (strpos($c, 'dry cabinet') !== false || strpos($c, 'cabinet') !== false) return 11;
            if (strpos($c, 'smart tv') !== false || strpos($c, ' tv') !== false || $c === 'tv' || strpos($c, 'televisi') !== false) return 12;
            if (strpos($c, 'storage') !== false || strpos($c, 'ssd') !== false || strpos($c, 'hdd') !== false || strpos($c, 'harddisk') !== false || strpos($c, 'sd card') !== false || strpos($c, 'flashdisk') !== false) return 13;
            if (strpos($c, 'peralatan') !== false || strpos($c, 'perkakas') !== false || strpos($c, 'tool') !== false) return 14;
            if (strpos($c, 'atk') !== false || strpos($c, 'alat tulis') !== false) return 15;
            if (strpos($c, 'jaringan') !== false || strpos($c, 'network') !== false || strpos($c, 'router') !== false || strpos($c, 'lan') !== false) return 16;
            return 17;
        };

        usort($inventory, function($a, $b) use ($norm_cat_func) {
            $ord_a = $norm_cat_func($a['cat'] ?? '');
            $ord_b = $norm_cat_func($b['cat'] ?? '');
            if ($ord_a !== $ord_b) {
                return $ord_a - $ord_b;
            }
            $cat_a = trim((string)($a['cat'] ?? ''));
            $cat_b = trim((string)($b['cat'] ?? ''));
            $cmp_cat = strcasecmp($cat_a, $cat_b);
            if ($cmp_cat !== 0) return $cmp_cat;

            $name_a = trim((string)($a['name'] ?? ''));
            $name_b = trim((string)($b['name'] ?? ''));
            $cmp = strcasecmp($name_a, $name_b);
            if ($cmp === 0) {
                $code_a = trim((string)($a['code'] ?? ''));
                $code_b = trim((string)($b['code'] ?? ''));
                return strcasecmp($code_a, $code_b);
            }
            return $cmp;
        });
    }

    // ------------------------------------------------------------
        // 4. LAPORAN KERUSAKAN & QUALITY CHECK (SINGLE SOURCE OF TRUTH: SUPABASE ptv_lapor_masalah)
// ─────────────────────────────────────────────────────────────
    if (empty($damages) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_damages = PTV_Supabase::select('ptv_lapor_masalah', '?order=created_at.desc&limit=60');
        if (is_array($sb_damages) && !is_wp_error($sb_damages) && !isset($sb_damages['code'])) {
            foreach ($sb_damages as $lr) {
                $st_raw = strtolower(trim((string)($lr['status'] ?? 'baru')));
                $status = 'Baru';
                if (in_array($st_raw, ['dicek', 'investigasi', 'diperbaiki', 'sedang dicek', 'dalam perbaikan', 'diproses', 'diperiksa'], true)) $status = 'Sedang Dicek';
                elseif ($st_raw === 'selesai' || $st_raw === 'siap pakai') $status = 'Selesai';
                elseif ($st_raw === 'rusak total' || $st_raw === 'afkir') $status = 'Rusak Total';

                $raw_dmg_ket2 = (string)($lr['keterangan'] ?? '');
                $dmg_meta2 = [];
                if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $raw_dmg_ket2, $dm2)) {
                    $dmg_meta2 = json_decode($dm2[1], true) ?: [];
                }
                $clean_desc2 = trim(preg_replace('/<!-- PTV_META:.*?-->/s', '', $raw_dmg_ket2));
                if ($clean_desc2 === '—' || $clean_desc2 === '-' || empty($clean_desc2)) $clean_desc2 = '';
                $u_no_val2   = (string)($lr['unit_no'] ?? ($dmg_meta2['unit_no'] ?? ''));
                $u_code_val2 = (string)($lr['unit_code'] ?? ($dmg_meta2['unit_code'] ?? ''));
                $u_name_val2 = (string)($lr['unit_name'] ?? ($dmg_meta2['unit_name'] ?? ''));
                $damages[] = [
                    'id'        => (string)($lr['id'] ?? ''),
                    'item'      => $item_id,
                    'unit_no'   => $u_no_val2,
                    'unit_code' => $u_code_val2,
                    'unit_name' => $u_name_val2,
                    'title'     => html_entity_decode((string)($lr['masalah'] ?? ($lr['nama_alat'] ?? 'Kendala Alat')), ENT_QUOTES, 'UTF-8'),
                    'desc'      => $clean_desc2,
                    'by'        => (string)($lr['pelapor_nama'] ?? 'Kru PTV'),
                    'date'      => substr((string)($lr['created_at'] ?? date('Y-m-d')), 0, 10),
                    'status'    => $status,
                    'qc_by'     => (string)($lr['qc_by'] ?? ''),
                    'qc_date'   => substr((string)($lr['qc_date'] ?? ''), 0, 10),
                    'qc_notes'  => (string)($lr['qc_notes'] ?? ''),
                    'qc_status' => (string)($lr['qc_status'] ?? ($status === 'Sedang Dicek' ? 'Sedang Dicek' : ($status === 'Selesai' ? 'Selesai' : ''))),
                    'photo'     => (string)($lr['foto_url'] ?? ''),
                ];
            }
        }
    }

    } // Tutup scope inventory, loans, damages

// ─────────────────────────────────────────────────────────────
    // 5. LOST & FOUND (SINGLE SOURCE OF TRUTH: SUPABASE ptv_lost_found)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'lost') {
        $lost = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_lost = PTV_Supabase::select('ptv_lost_found', '?order=created_at.desc&limit=60');
        if (is_array($sb_lost) && !is_wp_error($sb_lost) && !isset($sb_lost['code'])) {
            foreach ($sb_lost as $lfr) {
                $tipe = (strtolower(trim((string)($lfr['tipe'] ?? ''))) === 'penemuan' || strtolower(trim((string)($lfr['tipe'] ?? ''))) === 'ditemukan') ? 'temuan' : 'hilang';
                $st_raw = strtolower(trim((string)($lfr['status'] ?? 'dicari')));
                $status = ($tipe === 'temuan') ? 'Ditemukan' : 'Dicari';
                if ($st_raw === 'dikembalikan' || $st_raw === 'selesai') {
                    $status = 'Dikembalikan';
                }

                $lost[] = [
                    'id'      => (string)($lfr['id'] ?? ''),
                    'kind'    => $tipe,
                    'name'    => html_entity_decode((string)($lfr['nama_barang'] ?? 'Barang'), ENT_QUOTES, 'UTF-8'),
                    'loc'     => (string)($lfr['lokasi'] ?? 'Studio PTV'),
                    'date'    => substr((string)($lfr['tanggal'] ?? ($lfr['created_at'] ?? date('Y-m-d'))), 0, 10),
                    'desc'    => (string)($lfr['keterangan'] ?? '—'),
                    'by'      => (string)($lfr['pelapor_nama'] ?? 'Kru PTV'),
                    'contact' => (string)($lfr['pelapor_kontak'] ?? ''),
                    'photo'   => (string)($lfr['foto_url'] ?? ''),
                    'status'  => $status,
                ];
            }
        }
    }

    } // Tutup scope lost

// ─────────────────────────────────────────────────────────────
    // 6. DOKUMEN SAYA & SURAT RESMI (TUGAS, BARANG, IZIN)
    // SINGLE SOURCE OF TRUTH: SUPABASE (ptv_surat_tugas, ptv_surat_barang, ptv_surat_izin)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'docs') {
        $docs = [];

    // A. Surat Tugas (Supabase ptv_surat_tugas)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_st_rows = PTV_Supabase::select('ptv_surat_tugas', '?order=created_at.desc&limit=60');
        if (is_array($sb_st_rows) && !empty($sb_st_rows)) {
            foreach ($sb_st_rows as $sr) {
                $status_raw = strtolower(trim((string)($sr['status'] ?? 'menunggu')));
                $status = 'Menunggu';
                if (in_array($status_raw, ['disetujui', 'aktif'], true)) $status = 'Disetujui';
                elseif ($status_raw === 'revisi') $status = 'Revisi';
                elseif ($status_raw === 'ditolak') $status = 'Ditolak';

                $no = ($status === 'Disetujui') 
                    ? (!empty($sr['nomor_surat']) ? (string)$sr['nomor_surat'] : '— (Disetujui)')
                    : '— (Menunggu Pengesahan)';

                $assigned_names = [];
                $raw_kru = $sr['kru_assigned'] ?? '';
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
                if (!empty($sr['penanggung_jawab']) && !in_array(trim($sr['penanggung_jawab']), $assigned_names)) {
                    array_unshift($assigned_names, trim($sr['penanggung_jawab']));
                }

                $event_id = '';
                if (!empty($sr['catatan']) && preg_match('/<!--\s*PTV_EVENT_ID:\s*([^\s>]+)\s*-->/i', $sr['catatan'], $ev_m)) {
                    $event_id = trim($ev_m[1]);
                }

                $docs[] = [
                    'id'             => 'st_' . $sr['id'],
                    'type'           => 'Surat Tugas',
                    'no'             => $no,
                    'subject'        => html_entity_decode((string)($sr['nama_kegiatan'] ?? 'Penugasan Liputan'), ENT_QUOTES, 'UTF-8'),
                    'owner'          => (string)($sr['penanggung_jawab'] ?? $current_name),
                    'penanggung_jawab' => (string)($sr['penanggung_jawab'] ?? ''),
                    'diajukan_oleh'  => (string)($sr['diajukan_oleh'] ?? ''),
                    'date'           => substr((string)($sr['tanggal_mulai'] ?? ($sr['created_at'] ?? date('Y-m-d'))), 0, 10),
                    'created_at'     => (string)($sr['created_at'] ?? ($sr['tanggal_mulai'] ?? date('Y-m-d H:i:s'))),
                    'updated_at'     => (string)($sr['updated_at'] ?? ($sr['created_at'] ?? date('Y-m-d H:i:s'))),
                    'approved_at'    => (string)($sr['disetujui_pada'] ?? ($sr['updated_at'] ?? '')),
                    'status'         => $status,
                    'event'          => $event_id ?: html_entity_decode((string)($sr['nama_kegiatan'] ?? ''), ENT_QUOTES, 'UTF-8'),
                    'recipients'     => array_values(array_unique($assigned_names)),
                    'crew_summary'   => implode(', ', array_slice(array_values(array_unique($assigned_names)), 0, 3)) . (count($assigned_names) > 3 ? ' +' . (count($assigned_names) - 3) . ' lainnya' : ''),
                ];
            }
        }
    }

    // B. Surat Bawa Barang (Supabase ptv_surat_barang)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_sbb_rows = PTV_Supabase::select('ptv_surat_barang', '?order=created_at.desc&limit=60');
        if (is_array($sb_sbb_rows) && !empty($sb_sbb_rows)) {
            foreach ($sb_sbb_rows as $sr) {
                $status_raw = strtolower(trim((string)($sr['status'] ?? 'menunggu')));
                $status = 'Menunggu';
                if (in_array($status_raw, ['disetujui', 'aktif'], true)) $status = 'Disetujui';
                elseif ($status_raw === 'revisi') $status = 'Revisi';
                elseif ($status_raw === 'ditolak') $status = 'Ditolak';

                $no = ($status === 'Disetujui')
                    ? (!empty($sr['nomor_surat']) ? (string)$sr['nomor_surat'] : '— (Disetujui)')
                    : '— (Menunggu Pengesahan)';

                $raw_barang = $sr['daftar_barang'] ?? ($sr['catatan'] ?? '');
                $decoded_b = is_string($raw_barang) ? json_decode($raw_barang, true) : $raw_barang;
                $items = [];
                if (is_array($decoded_b)) {
                    foreach ($decoded_b as $item) {
                        $items[] = is_array($item) ? ($item['nama'] ?? ($item['name'] ?? 'Peralatan PTV')) : (string)$item;
                    }
                } elseif (!empty($raw_barang)) {
                    $items[] = (string)$raw_barang;
                }

                $pembawa_str = trim((string)($sr['pembawa'] ?? ''));
                $pj_str = trim((string)($sr['penanggung_jawab'] ?? ''));
                $pembawa_parts = array_filter(array_map('trim', preg_split('/[,;]+/', $pembawa_str)));
                $kru_list = array_values(array_unique(array_filter(array_merge($pembawa_parts, [$pj_str]))));

                $event_id = '';
                if (!empty($sr['catatan']) && preg_match('/<!--\s*PTV_EVENT_ID:\s*([^\s>]+)\s*-->/i', $sr['catatan'], $ev_m)) {
                    $event_id = trim($ev_m[1]);
                }

                $docs[] = [
                    'id'             => 'sbb_' . $sr['id'],
                    'type'           => 'Izin Membawa Barang',
                    'no'             => $no,
                    'subject'        => html_entity_decode((string)($sr['keperluan'] ?? 'Izin Membawa Barang'), ENT_QUOTES, 'UTF-8'),
                    'owner'          => $pembawa_str ?: $current_name,
                    'pembawa'        => $pembawa_str,
                    'diajukan_oleh'  => (string)($sr['diajukan_oleh'] ?? ''),
                    'date'           => substr((string)($sr['tanggal_mulai'] ?? ($sr['created_at'] ?? date('Y-m-d'))), 0, 10),
                    'created_at'     => (string)($sr['created_at'] ?? ($sr['tanggal_mulai'] ?? date('Y-m-d H:i:s'))),
                    'updated_at'     => (string)($sr['updated_at'] ?? ($sr['created_at'] ?? date('Y-m-d H:i:s'))),
                    'approved_at'    => (string)($sr['disetujui_pada'] ?? ($sr['updated_at'] ?? '')),
                    'status'         => $status,
                    'event'          => $event_id ?: html_entity_decode((string)($sr['keperluan'] ?? ''), ENT_QUOTES, 'UTF-8'),
                    'items'          => $items,
                    'items_summary'  => implode(', ', array_slice($items, 0, 3)) . (count($items) > 3 ? ' +' . (count($items) - 3) . ' lainnya' : ''),
                    'recipients'     => $kru_list,
                ];
            }
        }
    }

    // C. Surat Izin Santri Resmi (MURNI SUPABASE ptv_surat_izin SEBAGAI SINGLE SOURCE OF TRUTH)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_si_rows = PTV_Supabase::select('ptv_surat_izin', '?order=created_at.desc&limit=100');
        if (is_array($sb_si_rows) && !empty($sb_si_rows)) {
            foreach ($sb_si_rows as $sr) {
                $status_raw = strtolower(trim((string)($sr['status'] ?? 'menunggu')));
                $status = 'Menunggu';
                if (in_array($status_raw, ['disetujui', 'aktif', 'valid'], true)) $status = 'Disetujui';
                elseif ($status_raw === 'revisi') $status = 'Revisi';
                elseif ($status_raw === 'ditolak') $status = 'Ditolak';

                $no = (string)($sr['nomor_surat'] ?? '');
                if (empty($no)) {
                    $no = '— (Menunggu Pengesahan)';
                }

                $santri_details = [];
                $raw_santri = $sr['santri_list'] ?? null;
                if (is_array($raw_santri)) {
                    $santri_details = $raw_santri;
                } elseif (is_string($raw_santri) && !empty($raw_santri)) {
                    $dec = json_decode($raw_santri, true);
                    if (is_array($dec)) {
                        $santri_details = $dec;
                    }
                }

                $recipients = [];
                if (!empty($santri_details)) {
                    foreach ($santri_details as $sd) {
                        if (is_array($sd) && !empty($sd['nama'])) {
                            $recipients[] = trim($sd['nama']);
                        } elseif (is_string($sd)) {
                            $recipients[] = trim($sd);
                        }
                    }
                }
                if (empty($recipients) && !empty($sr['nama_santri'])) {
                    $recipients[] = trim($sr['nama_santri']);
                }

                $docs[] = [
                    'id'             => 'si_' . ($sr['id'] ?? uniqid()),
                    'type'           => 'Surat Izin Resmi',
                    'no'             => $no,
                    'subject'        => html_entity_decode((string)($sr['jenis_kegiatan'] ?? 'Izin Santri'), ENT_QUOTES, 'UTF-8'),
                    'owner'          => (string)(($sr['disetujui_oleh'] ?? '') ?: (($sr['diajukan_oleh'] ?? '') ?: $current_name)),
                    'date'           => substr((string)($sr['tanggal_mulai'] ?? ($sr['created_at'] ?? date('Y-m-d'))), 0, 10),
                    'created_at'     => (string)($sr['created_at'] ?? ($sr['tanggal_mulai'] ?? date('Y-m-d H:i:s'))),
                    'updated_at'     => (string)($sr['updated_at'] ?? ($sr['created_at'] ?? date('Y-m-d H:i:s'))),
                    'approved_at'    => (string)($sr['disetujui_pada'] ?? ($sr['updated_at'] ?? '')),
                    'status'         => $status,
                    'event'          => '',
                    'recipients'     => array_values(array_unique($recipients)),
                    'santri_details' => $santri_details,
                    'html_cache'     => (string)($sr['catatan'] ?? ''),
                ];
            }
        }
    }

    // Jika tidak ada dokumen di Supabase, tampilkan empty state (tidak ada dummy data).

    } // Tutup scope docs

// ─────────────────────────────────────────────────────────────
    // 7. MANAJEMEN KRU & KONTAK INTERNAL (MURNI SUPABASE ptv_kru SEBAGAI SINGLE SOURCE OF TRUTH)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'crew') {
        $crew = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_crew = PTV_Supabase::select('ptv_kru', '?order=nama.asc&limit=300');
        if (is_array($sb_crew) && !is_wp_error($sb_crew)) {
            foreach ($sb_crew as $c) {
                $c_name = html_entity_decode((string)($c['nama'] ?? 'Kru PTV'), ENT_QUOTES, 'UTF-8');
                if (empty(trim($c_name))) continue;

                $c_phone = preg_replace('/[^0-9]/', '', (string)($c['telepon'] ?? ($c['no_wa'] ?? ($c['phone'] ?? ''))));
                if (str_starts_with($c_phone, '08')) $c_phone = '628' . substr($c_phone, 2);

                // Resolusi Status Akun: dari field status_akun Supabase, fallback ke logika username
                $raw_acc_st = (string)($c['status_akun'] ?? '');
                if (empty($raw_acc_st)) {
                    $raw_acc_st = (!empty($c['username'])) ? 'aktif' : 'nonaktif';
                }
                $acc_status = (strtolower($raw_acc_st) === 'nonaktif') ? 'Nonaktif' : 'Aktif';

                $raw_c_status = strtolower(trim((string)($c['status'] ?? 'aktif')));
                $c_is_aktif = !in_array($raw_c_status, ['nonaktif', 'non-aktif', 'non aktif', 'pasif', 'alumni', 'inactive'], true);
                $c_status = $c_is_aktif ? 'Aktif' : 'Nonaktif';

                $crew[] = [
                    'id'             => (string)$c['id'],
                    'name'           => $c_name,
                    'ptvId'          => (string)($c['crew_id'] ?? ''),
                    'div'            => (string)($c['divisi'] ?? 'Technical'),
                    'pos'            => (string)($c['jabatan'] ?? ($c['posisi'] ?? 'Kru')),
                    'status'         => $c_status,
                    'accountStatus'  => $acc_status,
                    'phone'          => $c_phone ?: '',
                    'photo'          => (string)($c['foto_url'] ?? ($c['photo'] ?? '')),
                    'username'       => (string)($c['username'] ?? ''),
                    'role'           => strtolower((string)($c['role'] ?? 'kru')),
                    'join_date'      => (string)($c['created_at'] ?? ($c['join_date'] ?? '')),
                    'angkatan'       => (string)($c['angkatan'] ?? ''),
                    'nim'            => (string)($c['nim'] ?? ''),
                    'jurusan'        => (string)($c['jurusan'] ?? ''),
                    'oauth_provider' => (string)($c['oauth_provider'] ?? ''),
                    'oauth_email'    => (string)($c['oauth_email'] ?? ''),
                    'oauth_uid'      => (string)($c['oauth_uid'] ?? ''),
                ];
            }
        }
    }

    } // Tutup scope crew

// ─────────────────────────────────────────────────────────────
    // 8. KEUANGAN (SINGLE SOURCE OF TRUTH: SUPABASE ptv_keuangan)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'finance') {
        // Hak Akses: Sesuai ptv_can_access_keuangan() (FAIL-CLOSED)
        $can_access_keuangan = ptv_can_access_keuangan();

    $finance = [];
    $pemasukan = [];
    $pengeluaran = [];
    $kas_kru = [];
    $kas_periode = [];
    $keuangan_tables_ready = false;
    $keuangan_access_denied = !$can_access_keuangan;

    if ($can_access_keuangan && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // A. Pemasukan Kas
        $sb_pem = PTV_Supabase::select('ptv_pemasukan', '?order=tanggal.desc,created_at.desc&limit=500');
        if (is_array($sb_pem) && !is_wp_error($sb_pem) && !isset($sb_pem['code'])) {
            $keuangan_tables_ready = true;
            foreach ($sb_pem as $pr) {
                $pemasukan[] = [
                    'id'                => (string)($pr['id'] ?? ''),
                    'tanggal'           => substr((string)($pr['tanggal'] ?? date('Y-m-d')), 0, 10),
                    'sumber'            => (string)($pr['sumber'] ?? 'Kas Kru'),
                    'kategori'          => (string)($pr['kategori'] ?? 'Iuran Kas'),
                    'nominal'           => (int)($pr['nominal'] ?? 0),
                    'keterangan'        => (string)($pr['keterangan'] ?? ''),
                    'kru_id'            => (string)($pr['kru_id'] ?? ''),
                    'kru_nama'          => (string)($pr['kru_nama'] ?? ''),
                    'dicatat_oleh_id'   => (string)($pr['dicatat_oleh_id'] ?? ''),
                    'dicatat_oleh_nama' => (string)($pr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                    'bukti_url'         => (string)($pr['bukti_url'] ?? ''),
                    'status'            => (string)($pr['status'] ?? 'verified'),
                    'created_at'        => (string)($pr['created_at'] ?? ''),
                ];
            }
        }

        // B. Pengeluaran Kas
        $sb_pen = PTV_Supabase::select('ptv_pengeluaran', '?order=tanggal.desc,created_at.desc&limit=500');
        if (is_array($sb_pen) && !is_wp_error($sb_pen) && !isset($sb_pen['code'])) {
            $keuangan_tables_ready = true;
            foreach ($sb_pen as $pr) {
                $pengeluaran[] = [
                    'id'                => (string)($pr['id'] ?? ''),
                    'tanggal'           => substr((string)($pr['tanggal'] ?? date('Y-m-d')), 0, 10),
                    'keperluan'         => (string)($pr['keperluan'] ?? ''),
                    'kategori'          => (string)($pr['kategori'] ?? 'Operasional'),
                    'nominal'           => (int)($pr['nominal'] ?? 0),
                    'keterangan'        => (string)($pr['keterangan'] ?? ''),
                    'dicatat_oleh_id'   => (string)($pr['dicatat_oleh_id'] ?? ''),
                    'dicatat_oleh_nama' => (string)($pr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                    'bukti_url'         => (string)($pr['bukti_url'] ?? ''),
                    'status'            => (string)($pr['status'] ?? 'verified'),
                    'created_at'        => (string)($pr['created_at'] ?? ''),
                ];
            }
        }

        // C.0. Periode Iuran Kas (Pengaturan Periode & Nominal Dinamis - Dimulai Juli 2026)
        $kas_periode = [];
        $sb_kp = PTV_Supabase::select('ptv_kas_periode', '?order=periode_bulan.asc&limit=100');
        if (is_array($sb_kp) && !is_wp_error($sb_kp) && !isset($sb_kp['code']) && !empty($sb_kp)) {
            $keuangan_tables_ready = true;
            foreach ($sb_kp as $p_row) {
                $pb = (string)($p_row['periode_bulan'] ?? '');
                // PERIODE AWAL: Jangan pernah memuat atau menghitung periode sebelum Juli 2026 (2026-07)
                if ($pb < '2026-07') {
                    continue;
                }
                $ket = (string)($p_row['keterangan'] ?? '');
                $st  = strtolower(trim((string)($p_row['status'] ?? '')));
                $is_nonaktif = ($st === 'nonaktif' || $st === 'inactive' || strpos($ket, '[NONAKTIF]') !== false);

                $kas_periode[] = [
                    'periode_bulan' => $pb,
                    'nominal'       => (int)($p_row['nominal'] ?? 25000),
                    'keterangan'    => $ket,
                    'status'        => $is_nonaktif ? 'nonaktif' : 'aktif',
                    'is_active'     => !$is_nonaktif,
                ];
            }
        }
        // Fallback default periods starting from Juli 2026 jika belum ada record di Supabase
        if (empty($kas_periode)) {
            $kas_periode = [
                ['periode_bulan' => '2026-07', 'nominal' => 20000, 'keterangan' => 'Iuran Kas Kru Juli 2026', 'status' => 'aktif', 'is_active' => true],
                ['periode_bulan' => '2026-08', 'nominal' => 25000, 'keterangan' => 'Iuran Kas Kru Agustus 2026', 'status' => 'aktif', 'is_active' => true],
                ['periode_bulan' => '2026-09', 'nominal' => 25000, 'keterangan' => 'Iuran Kas Kru September 2026', 'status' => 'aktif', 'is_active' => true],
            ];
        }

        // C. Kas Kru
        $sb_kk = PTV_Supabase::select('ptv_kas_kru', '?order=periode_bulan.desc,kru_nama.asc&limit=1000');
        if (is_array($sb_kk) && !is_wp_error($sb_kk) && !isset($sb_kk['code'])) {
            $keuangan_tables_ready = true;
            foreach ($sb_kk as $kr) {
                $kas_kru[] = [
                    'id'                => (string)($kr['id'] ?? ''),
                    'kru_id'            => (string)($kr['kru_id'] ?? ''),
                    'kru_nama'          => (string)($kr['kru_nama'] ?? ''),
                    'kru_ptv_id'        => (string)($kr['kru_ptv_id'] ?? ''),
                    'periode_bulan'     => (string)($kr['periode_bulan'] ?? ''),
                    'tagihan'           => (int)($kr['tagihan'] ?? 20000),
                    'dibayar'           => (int)($kr['dibayar'] ?? 0),
                    'sisa'              => (int)($kr['sisa'] ?? 20000),
                    'status'            => (string)($kr['status'] ?? 'Belum Bayar'),
                    'tanggal_bayar'     => (string)($kr['tanggal_bayar'] ?? ''),
                    'metode_bayar'      => (string)($kr['metode_bayar'] ?? 'Transfer'),
                    'catatan'           => (string)($kr['catatan'] ?? ''),
                    'bukti_url'         => (string)($kr['bukti_url'] ?? ''),
                    'pemasukan_id'      => (string)($kr['pemasukan_id'] ?? ''),
                    'dicatat_oleh_id'   => (string)($kr['dicatat_oleh_id'] ?? ''),
                    'dicatat_oleh_nama' => (string)($kr['dicatat_oleh_nama'] ?? ''),
                ];
            }
        }

        // D. Legacy ptv_keuangan fallback
        $sb_fin = PTV_Supabase::select('ptv_keuangan', '?order=date.desc,created_at.desc&limit=100');
        if (is_array($sb_fin) && !is_wp_error($sb_fin) && !isset($sb_fin['code'])) {
            foreach ($sb_fin as $fr) {
                $finance[] = [
                    'id'     => (string)($fr['id'] ?? ''),
                    'no'     => (string)($fr['no'] ?? ''),
                    'type'   => (string)($fr['type'] ?? 'Kuitansi'),
                    'client' => html_entity_decode((string)($fr['client'] ?? ''), ENT_QUOTES, 'UTF-8'),
                    'amount' => (int)($fr['amount'] ?? 0),
                    'date'   => substr((string)($fr['date'] ?? date('Y-m-d')), 0, 10),
                    'status' => (string)($fr['status'] ?? 'Menunggu'),
                    'notes'  => (string)($fr['notes'] ?? ''),
                ];
            }
        }
    }

// ─────────────────────────────────────────────────────────────
    // 8b. JADWAL KONTEN (SINGLE SOURCE OF TRUTH: SUPABASE ptv_konten)
// ─────────────────────────────────────────────────────────────
    $contents = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_kon = PTV_Supabase::select('ptv_konten', '?order=date.desc,created_at.desc&limit=100');
        if (is_array($sb_kon) && !is_wp_error($sb_kon) && !isset($sb_kon['code'])) {
            foreach ($sb_kon as $kr) {
                $contents[] = [
                    'id'       => (string)($kr['id'] ?? ''),
                    'title'    => html_entity_decode((string)($kr['title'] ?? ''), ENT_QUOTES, 'UTF-8'),
                    'platform' => (string)($kr['platform'] ?? 'Instagram'),
                    'date'     => substr((string)($kr['date'] ?? date('Y-m-d')), 0, 10),
                    'status'   => (string)($kr['status'] ?? 'Draft'),
                    'notes'    => (string)($kr['notes'] ?? ''),
                ];
            }
        }
    }
    // Jika tidak ada jadwal konten di Supabase, tampilkan empty state.

    } // Tutup scope finance

// ─────────────────────────────────────────────────────────────
    // 9. NOTIFIKASI DINAMIS
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'notifs') {
        $notifs = [];
    $pending_docs = array_filter($docs, fn($d) => $d['status'] === 'Menunggu' && $d['owner'] === $current_name);
    if (!empty($pending_docs)) {
        $p = reset($pending_docs);
        $notifs[] = ['id'=>'n1','t'=>'Pengajuan menunggu review','s'=>$p['type'].' · '.$p['subject'],'when'=>'Hari ini','kind'=>'doc','unread'=>true,'go'=>'#/dokumen'];
    }

    $my_active_loans = array_filter($loans, fn($l) => $l['by'] === $current_name && empty($l['back']));
    if (!empty($my_active_loans)) {
        $l = reset($my_active_loans);
        $notifs[] = ['id'=>'n2','t'=>'Alat sedang dipinjam','s'=>'Jatuh tempo: '.$l['due'],'when'=>'Penting','kind'=>'box','unread'=>true,'go'=>'#/peminjaman'];
    }

    if (!empty($damages)) {
        $d = reset($damages);
        $notifs[] = ['id'=>'n3','t'=>'Laporan kerusakan terkini','s'=>$d['title'].' · '.$d['status'],'when'=>$d['date'],'kind'=>'wrench','unread'=>false,'go'=>'#/kerusakan'];
    }

    if (!empty($announcements)) {
        $a = reset($announcements);
        $notifs[] = ['id'=>'n4','t'=>$a['title'],'s'=>$a['by'],'when'=>$a['date'],'kind'=>'megaphone','unread'=>true,'go'=>'#/broadcast'];
    }

    } // Tutup scope notifs

// ─────────────────────────────────────────────────────────────
    // 10. CONTENT PLANNER (SINGLE SOURCE OF TRUTH: SUPABASE ptv_content_planner)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'planner') {
        $content_planner = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_cp = PTV_Supabase::select('ptv_content_planner', '?order=tanggal_mulai.asc,created_at.asc&limit=500');
        if (is_array($sb_cp) && !is_wp_error($sb_cp) && !isset($sb_cp['code'])) {
            $ptv_clean_str = function($val) use (&$ptv_clean_str) {
                if (is_null($val) || $val === '') return '';
                if (is_array($val)) {
                    $cleaned = [];
                    foreach ($val as $sub) {
                        $c = $ptv_clean_str($sub);
                        if (!empty($c) && $c !== '[]' && $c !== 'null') $cleaned[] = $c;
                    }
                    return $cleaned;
                }
                $str = (string)$val;
                for ($i = 0; $i < 3; $i++) {
                    $trimmed = trim($str);
                    if ((str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']')) || (str_starts_with($trimmed, '"') && str_ends_with($trimmed, '"'))) {
                        $dec = json_decode($trimmed, true);
                        if ($dec !== null && !is_numeric($trimmed)) {
                            if (is_array($dec)) return $ptv_clean_str($dec);
                            if (is_string($dec)) { $str = $dec; continue; }
                        }
                    }
                    break;
                }
                $str = stripslashes($str);
                $str = preg_replace('/\\\\+/', '', $str);
                $str = trim(trim($str, '[]"\'\\'));
                return $str;
            };

            foreach ($sb_cp as $cp) {
                $raw_daftar = $cp['daftar_konten'] ?? [];
                if (is_string($raw_daftar)) {
                    $raw_daftar = json_decode($raw_daftar, true) ?: (array_filter(array_map('trim', explode("\n", $raw_daftar))));
                }
                $clean_daftar = [];
                if (is_array($raw_daftar)) {
                    foreach ($raw_daftar as $it) {
                        $it_clean = $ptv_clean_str($it);
                        if (is_array($it_clean)) {
                            foreach ($it_clean as $ic) { if (!empty($ic)) $clean_daftar[] = $ic; }
                        } elseif (!empty($it_clean) && $it_clean !== '[]' && $it_clean !== 'null') {
                            $clean_daftar[] = (string)$it_clean;
                        }
                    }
                }

                $raw_desc = (string)($cp['deskripsi'] ?? '');
                $rec_type = '';
                $rec_rule = null;
                $rec_rule = null;
                if (preg_match('/<!-- PTV_RECURRENCE:\s*({.*?})\s*-->/s', $raw_desc, $rm)) {
                    $parsed_rec = json_decode($rm[1], true) ?: null;
                    if ($parsed_rec && is_array($parsed_rec)) {
                        if (!empty($parsed_rec['type'])) {
                            $rec_type = (string)$parsed_rec['type'];
                            $rec_rule = $parsed_rec['rule'] ?? $parsed_rec;
                        } else {
                            // Flat format fallback
                            $rec_rule = $parsed_rec;
                            if (!empty($parsed_rec['segment'])) {
                                $rec_type = 'month_segment';
                            } elseif (!empty($parsed_rec['repeat']) && $parsed_rec['repeat'] === 'every_month') {
                                $rec_type = 'setiap_bulan';
                            } elseif (!empty($parsed_rec['pasaran'])) {
                                $rec_type = 'hari_pasaran';
                            } elseif (!empty($parsed_rec['dayOfWeek'])) {
                                $rec_type = 'hari_mingguan';
                            } elseif (!empty($parsed_rec['day']) && !empty($parsed_rec['month'])) {
                                $rec_type = is_numeric($parsed_rec['month']) ? 'tanggal_masehi' : 'tanggal_hijriah';
                            } elseif (!empty($parsed_rec['month'])) {
                                $rec_type = is_numeric($parsed_rec['month']) ? 'bulan_masehi' : 'bulan_hijriah';
                            }
                        }
                    }
                }
                if (empty($rec_type)) {
                    if (!empty($cp['bulan_hijriah'])) {
                        if (!empty($cp['tanggal_hijriah'])) {
                            $rec_type = 'tanggal_hijriah';
                            $rec_rule = ['day' => intval($cp['tanggal_hijriah']), 'month' => (string)$cp['bulan_hijriah']];
                        } else {
                            $rec_type = 'bulan_hijriah';
                            $rec_rule = ['month' => (string)$cp['bulan_hijriah']];
                        }
                    } elseif (!empty($cp['tanggal_mulai'])) {
                        $rec_type = 'none';
                        $rec_rule = [];
                    }
                }
                $clean_desc = trim(preg_replace('/<!-- PTV_RECURRENCE:.*?-->/s', '', $raw_desc));
                $clean_desc = stripslashes($clean_desc);
                $clean_desc = preg_replace('/\\\\+/', '', $clean_desc);

                $clean_jenis = $ptv_clean_str($cp['jenis_konten'] ?? '');
                if (is_array($clean_jenis)) $clean_jenis = implode(' · ', array_filter($clean_jenis));

                $content_planner[] = [
                    'id'              => (string)($cp['id'] ?? uniqid()),
                    'judul_momentum'  => $ptv_clean_str(html_entity_decode((string)($cp['judul_momentum'] ?? ''), ENT_QUOTES, 'UTF-8')),
                    'kategori'        => $ptv_clean_str((string)($cp['kategori'] ?? 'Event Masehi')) ?: 'Event Masehi',
                    'subkategori'     => $ptv_clean_str((string)($cp['subkategori'] ?? '')),
                    'tanggal_mulai'   => (string)($cp['tanggal_mulai'] ?? ''),
                    'tanggal_selesai' => (string)($cp['tanggal_selesai'] ?? ''),
                    'bulan_hijriah'   => $ptv_clean_str((string)($cp['bulan_hijriah'] ?? '')),
                    'tanggal_hijriah' => !empty($cp['tanggal_hijriah']) ? intval($cp['tanggal_hijriah']) : null,
                    'tahun_masehi'    => !empty($cp['tahun_masehi']) ? intval($cp['tahun_masehi']) : null,
                    'deskripsi'       => $clean_desc,
                    'recurrence_type' => $rec_type,
                    'recurrence_rule' => $rec_rule,
                    'daftar_konten'   => $clean_daftar,
                    'jenis_konten'    => $clean_jenis,
                    'referensi_url'   => (string)($cp['referensi_url'] ?? ''),
                    'created_at'      => (string)($cp['created_at'] ?? ''),
                ];
            }
        }
    }

    } // Tutup scope planner

// ─────────────────────────────────────────────────────────────
    // 11. SUMBER INVENTARIS (PERSISTEN OPTIONS)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || in_array($scope, ['inventory', 'loans', 'damages'], true)) {
        $default_sources = ['Yayasan', 'Hibah Kementerian', 'Dana Perusahaan', 'Kas Organisasi', 'Hibah Pribadi'];
    $stored_sources = get_option('ptv_inventory_sources', []);
    if (!is_array($stored_sources)) $stored_sources = [];
    $inventory_sources = array_values(array_unique(array_filter(array_merge($default_sources, $stored_sources))));

    } // Tutup scope sumber inventaris

// ─────────────────────────────────────────────────────────────
    // 12. KONTAK EKSTERNAL (SUPABASE ptv_kontak_eksternal + WP DB DUAL PERSISTENCE)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'kontak') {
        $kontak_eksternal = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_ke = PTV_Supabase::select('ptv_kontak_eksternal', '?order=created_at.desc&limit=300');
        if (is_array($sb_ke) && !is_wp_error($sb_ke) && !isset($sb_ke['code'])) {
            foreach ($sb_ke as $ke) {
                $kontak_eksternal[] = [
                    'id'            => (string)($ke['id'] ?? ''),
                    'nama'          => html_entity_decode((string)($ke['nama'] ?? ''), ENT_QUOTES, 'UTF-8'),
                    'kategori'      => (string)($ke['kategori'] ?? 'Lainnya'),
                    'jabatan'       => (string)($ke['jabatan'] ?? ''),
                    'organisasi'    => (string)($ke['organisasi'] ?? ''),
                    'nomor_telepon' => (string)($ke['nomor_telepon'] ?? ''),
                    'whatsapp'      => (string)($ke['whatsapp'] ?? ''),
                    'email'         => (string)($ke['email'] ?? ''),
                    'alamat'        => (string)($ke['alamat'] ?? ''),
                    'catatan'       => (string)($ke['catatan'] ?? ''),
                    'foto_url'      => (string)($ke['foto_url'] ?? ''),
                    'status'        => ucfirst((string)($ke['status'] ?? 'Aktif')),
                    'created_at'    => (string)($ke['created_at'] ?? ''),
                    'updated_at'    => (string)($ke['updated_at'] ?? ''),
                ];
            }
        }
    }
    $table_kontak_eks = $wpdb->prefix . 'ptv_kontak_eksternal';
    if (empty($kontak_eksternal) && $wpdb->get_var("SHOW TABLES LIKE '{$table_kontak_eks}'") === $table_kontak_eks) {
        $wp_ke = $wpdb->get_results("SELECT * FROM {$table_kontak_eks} ORDER BY created_at DESC LIMIT 300", ARRAY_A);
        if (!empty($wp_ke)) {
            foreach ($wp_ke as $ke) {
                $kontak_eksternal[] = [
                    'id'            => (string)$ke['id'],
                    'nama'          => html_entity_decode((string)$ke['nama'], ENT_QUOTES, 'UTF-8'),
                    'kategori'      => (string)($ke['kategori'] ?? 'Lainnya'),
                    'jabatan'       => (string)($ke['jabatan'] ?? ''),
                    'organisasi'    => (string)($ke['organisasi'] ?? ''),
                    'nomor_telepon' => (string)($ke['nomor_telepon'] ?? ''),
                    'whatsapp'      => (string)($ke['whatsapp'] ?? ''),
                    'email'         => (string)($ke['email'] ?? ''),
                    'alamat'        => (string)($ke['alamat'] ?? ''),
                    'catatan'       => (string)($ke['catatan'] ?? ''),
                    'foto_url'      => (string)($ke['foto_url'] ?? ''),
                    'status'        => ucfirst((string)($ke['status'] ?? 'Aktif')),
                    'created_at'    => (string)($ke['created_at'] ?? ''),
                    'updated_at'    => (string)($ke['updated_at'] ?? ''),
                ];
            }
        }
    }

    } // Tutup scope kontak

// ─────────────────────────────────────────────────────────────
    // 13. CATATAN BERSAMA (ptv_catatan)
// ─────────────────────────────────────────────────────────────
    if ($scope === 'all' || $scope === 'notes') {
        $notes = [];
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_notes = PTV_Supabase::select('ptv_catatan', '?order=is_pinned.desc,updated_at.desc&limit=250');
        if (is_array($sb_notes) && !is_wp_error($sb_notes) && !isset($sb_notes['code'])) {
            $seen_sb_note_ids = [];
            foreach ($sb_notes as $n) {
                $n_id_str = (string)($n['id'] ?? '');
                if (empty($n_id_str) || isset($seen_sb_note_ids[$n_id_str])) {
                    continue;
                }
                $seen_sb_note_ids[$n_id_str] = true;
                $raw_tags = $n['tags'] ?? [];
                if (is_string($raw_tags)) {
                    $raw_tags = json_decode($raw_tags, true) ?: [];
                }
                $tags_arr = is_array($raw_tags) ? $raw_tags : [];
                $isi_str = (string)($n['isi'] ?? '');

                // Resolve note type: 'meeting_minutes' vs 'shared'
                $note_tipe = (string)($n['tipe'] ?? ($n['type'] ?? ''));
                if (empty($note_tipe) || $note_tipe === 'null') {
                    if (in_array('notulensi', $tags_arr, true) || in_array('notulensi_rapat', $tags_arr, true) || in_array('notulen', $tags_arr, true)) {
                        $note_tipe = 'meeting_minutes';
                    } elseif (preg_match('/<!--\s*PTV_META:.*?("type"|"tipe")\s*:\s*"meeting_minutes"/s', $isi_str)) {
                        $note_tipe = 'meeting_minutes';
                    } else {
                        $note_tipe = 'shared';
                    }
                }

                $notes[] = [
                    'id'              => (string)($n['id'] ?? uniqid('note_')),
                    'tipe'            => $note_tipe === 'meeting_minutes' ? 'meeting_minutes' : 'shared',
                    'judul'           => html_entity_decode((string)($n['judul'] ?? 'Tanpa Judul'), ENT_QUOTES, 'UTF-8'),
                    'isi'             => $isi_str,
                    'warna'           => (string)($n['warna'] ?? 'default'),
                    'is_pinned'       => !empty($n['is_pinned']),
                    'tags'            => $tags_arr,
                    'created_by_id'   => (string)($n['created_by_id'] ?? ''),
                    'created_by_name' => (string)($n['created_by_name'] ?? 'Kru PTV'),
                    'created_at'      => (string)($n['created_at'] ?? date('Y-m-d H:i:s')),
                    'updated_at'      => (string)($n['updated_at'] ?? date('Y-m-d H:i:s')),
                ];
            }
        }
    }

    // Jika tidak ada catatan di Supabase, tampilkan empty state (tidak ada fallback ke WP Options).

    // Notifikasi terpersonalisasi pengguna
    $notifs = [];
    $auth_crew_id = function_exists('ptv_get_authenticated_crew_id') ? ptv_get_authenticated_crew_id() : ($sb_uuid ?: '');
    $loaded_rows = null;

    if (!empty($auth_crew_id) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_notifs = PTV_Supabase::select('ptv_notifications', '?recipient_crew_id=eq.' . urlencode($auth_crew_id) . '&order=created_at.desc&limit=50');
        if (is_array($sb_notifs) && !isset($sb_notifs['code']) && !is_wp_error($sb_notifs)) {
            $loaded_rows = $sb_notifs;
        }
    }

    if ($loaded_rows === null && !empty($auth_crew_id)) {
        $tbl_notif = $wpdb->prefix . 'ptv_notifications';
        $db_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$tbl_notif} WHERE recipient_crew_id = %s ORDER BY created_at DESC LIMIT 50",
            $auth_crew_id
        ), ARRAY_A);
        $loaded_rows = (array) $db_rows;
    }

    if (is_array($loaded_rows)) {
        $tbl_notif = $wpdb->prefix . 'ptv_notifications';
        $protected_ids = [];
        if (!empty($auth_crew_id) && $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $tbl_notif)) === $tbl_notif) {
            $protected_ids = (array) $wpdb->get_col($wpdb->prepare(
                "SELECT id FROM {$tbl_notif} WHERE recipient_crew_id = %s AND is_protected = 1",
                $auth_crew_id
            ));
        }

        foreach ($loaded_rows as $row) {
            $row_id = (string)($row['id'] ?? '');
            $created_raw = $row['created_at'] ?? '';
            $is_prot = !empty($row['is_protected']) || in_array($row_id, $protected_ids, true);
            $notifs[] = [
                'id'           => $row_id,
                't'            => $row['title'] ?? '',
                's'            => $row['message'] ?? '',
                'type'         => $row['type'] ?? 'system',
                'kind'         => $row['icon'] ?? 'bell',
                'entity_type'  => $row['entity_type'] ?? '',
                'entity_id'    => $row['entity_id'] ?? '',
                'go'           => $row['action_url'] ?? '',
                'unread'       => !(bool)$row['is_read'],
                'is_protected' => (bool)$is_prot,
                'when'         => function_exists('ptv_notif_relative_time') ? ptv_notif_relative_time($created_raw) : $created_raw,
                'created_at'   => $created_raw,
            ];
        }
    }

    } // Tutup scope notes

    if ($scope !== 'all') {
        $scoped_db = [];
        if ($scope === 'docs') {
            $scoped_db['docs'] = $docs;
        } elseif (in_array($scope, ['inventory', 'loans', 'damages'], true)) {
            $scoped_db['inventory']         = $inventory;
            $scoped_db['loans']             = $loans;
            $scoped_db['damages']           = $damages;
            $scoped_db['inventory_values']  = $inventory_values_list;
            $scoped_db['inventory_sources'] = $inventory_sources;
        } elseif ($scope === 'events') {
            $scoped_db['events'] = $events;
        } elseif ($scope === 'announcements') {
            $scoped_db['announcements'] = $announcements;
        } elseif ($scope === 'finance') {
            $scoped_db['finance']  = $finance;
            $scoped_db['keuangan'] = [
                'pemasukan'     => $pemasukan,
                'pengeluaran'   => $pengeluaran,
                'kas_kru'       => $kas_kru,
                'periode'       => $kas_periode ?? [],
                'tables_ready'  => $keuangan_tables_ready,
                'access_denied' => $keuangan_access_denied,
            ];
        } elseif ($scope === 'planner') {
            $scoped_db['contents']        = $contents;
            $scoped_db['content_planner'] = $content_planner;
        } elseif ($scope === 'notes') {
            $scoped_db['notes'] = $notes;
        } elseif ($scope === 'crew') {
            $scoped_db['crew'] = $crew;
        } elseif ($scope === 'lost') {
            $scoped_db['lost'] = $lost;
        } elseif ($scope === 'kontak') {
            $scoped_db['kontak_eksternal'] = $kontak_eksternal;
        }
        return [
            'ME'    => $ME,
            'DB'    => $scoped_db,
            'scope' => $scope,
        ];
    }

    return [
        'ME' => $ME,
        'DB' => [
            'announcements'     => $announcements,
            'events'            => $events,
            'inventory'         => $inventory,
            'inventory_values'  => $inventory_values_list,
            'inventory_sources' => $inventory_sources,
            'loans'             => $loans,
            'damages'           => $damages,
            'lost'              => $lost,
            'docs'              => $docs,
            'crew'              => $crew,
            'kontak_eksternal'  => $kontak_eksternal,
            'finance'           => $finance,
            'keuangan'          => [
                'pemasukan'     => $pemasukan,
                'pengeluaran'   => $pengeluaran,
                'kas_kru'       => $kas_kru,
                'periode'       => $kas_periode ?? [],
                'tables_ready'  => $keuangan_tables_ready,
                'access_denied' => $keuangan_access_denied,
            ],
            'contents'          => $contents,
            'content_planner'   => $content_planner,
            'notes'             => $notes,
            'notifs'            => $notifs,
        ],
        'scope' => 'all',
    ];
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: PENGAMBILAN DATA LIVE (REFRESH)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_get_live_data', 'ptv_dashboard_get_live_data_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_get_live_data', 'ptv_dashboard_get_live_data_cb');
function ptv_dashboard_get_live_data_cb() {
    $scope = sanitize_text_field($_GET['scope'] ?? ($_POST['scope'] ?? 'all'));
    $data = ptv_dashboard_get_initial_data($scope);
    wp_send_json_success($data);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: PINJAM ALAT (MUTASI MULTI-SELECT TERHUBUNG)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_pinjam', 'ptv_dashboard_action_pinjam_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_pinjam', 'ptv_dashboard_action_pinjam_cb');
function ptv_dashboard_action_pinjam_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $user_name = sanitize_text_field($_POST['borrower_name'] ?? ($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV')));
    $item_id   = sanitize_text_field($_POST['item_id'] ?? '');
    $eq_ids_raw = $_POST['equipment_ids'] ?? [];
    $out_date  = sanitize_text_field($_POST['out_date'] ?? date('Y-m-d'));
    $due_date  = sanitize_text_field($_POST['due_date'] ?? date('Y-m-d', strtotime('+2 days')));
    $purpose   = sanitize_text_field($_POST['purpose'] ?? ($_POST['keperluan'] ?? ''));
    $event_id  = sanitize_text_field($_POST['event_id'] ?? '');
    $notes     = sanitize_textarea_field($_POST['notes'] ?? '');

    $full_purpose_text = !empty($purpose) ? $purpose : (!empty($notes) ? substr($notes, 0, 80) : 'Operasional PTV');

    $equipment_ids = [];
    if (!empty($eq_ids_raw)) {
        if (is_string($eq_ids_raw)) {
            $decoded = json_decode(stripslashes($eq_ids_raw), true);
            if (is_array($decoded)) {
                $equipment_ids = array_filter(array_map('strval', $decoded));
            }
        } elseif (is_array($eq_ids_raw)) {
            $equipment_ids = array_filter(array_map('strval', $eq_ids_raw));
        }
    }
    if (empty($equipment_ids) && !empty($item_id)) {
        $equipment_ids = [$item_id];
    }

    if (empty($equipment_ids)) {
        wp_send_json_error('Minimal satu alat wajib dipilih.');
    }

    // Multi-unit quantities map
    $quantities_raw = $_POST['equipment_quantities'] ?? null;
    $equipment_quantities = [];
    if (!empty($quantities_raw)) {
        if (is_string($quantities_raw)) {
            $decoded_qty = json_decode(stripslashes($quantities_raw), true);
            if (is_array($decoded_qty)) $equipment_quantities = $decoded_qty;
        } elseif (is_array($quantities_raw)) {
            $equipment_quantities = $quantities_raw;
        }
    }
    $total_units_borrowed = 0;
    foreach ($equipment_ids as $eid) {
        $q_val = isset($equipment_quantities[$eid]) ? max(1, intval($equipment_quantities[$eid])) : 1;
        $equipment_quantities[$eid] = $q_val;
        $total_units_borrowed += $q_val;
    }

    $first_item_id = $equipment_ids[0];
    $code = 'PJM-' . date('ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 4));
    // transaction_id dipakai untuk mengelompokkan semua item dalam satu submit
    $transaction_id = 'TXN-' . date('ymdHis') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));

    // Capture unit fisik yang dipilih
    $unit_no   = sanitize_text_field($_POST['unit_no'] ?? '');
    $unit_code = sanitize_text_field($_POST['unit_code'] ?? '');
    $units_raw = $_POST['units'] ?? null;
    $borrowed_units = [];
    if (!empty($units_raw)) {
        if (is_string($units_raw)) $borrowed_units = json_decode(stripslashes($units_raw), true) ?: [];
        elseif (is_array($units_raw)) $borrowed_units = $units_raw;
    }
    if (empty($borrowed_units) && !empty($unit_no)) {
        $borrowed_units = [['unit_no' => $unit_no, 'unit_code' => $unit_code]];
    }

    $sb_loan_id = null;

    // Call Supabase Peminjaman if available
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $meta = [
            'code'                 => $code,
            'transaction_id'       => $transaction_id,
            'user'                 => $user_name,
            'account'              => $user_name,
            'borrower_name'        => $user_name,
            'purpose'              => $full_purpose_text,
            'equipment_ids'        => array_values($equipment_ids),
            'equipment_quantities' => $equipment_quantities,
            'unit_no'              => $unit_no,
            'unit_code'            => $unit_code,
            'units'                => $borrowed_units,
            'borrowed_at'          => $out_date,
            'expected_return'      => $due_date,
            'event_id'             => $event_id,
            'notes'                => $notes,
            'status'               => 'borrowed',
        ];
        $catatan = "Peminjaman alat via Dasbor Operations\n<!-- PTV_META: " . wp_json_encode($meta) . " -->";
        $keperluan_str = $user_name . ' — ' . $full_purpose_text;
        if (!empty($unit_code)) {
            $keperluan_str .= ' [' . $unit_code . ']';
        }

        $sb_result = PTV_Supabase::insert('ptv_peminjaman', [
            'aset_id'         => (strlen($first_item_id) === 36) ? $first_item_id : null,
            'jumlah'          => $total_units_borrowed,
            'keperluan'       => $keperluan_str,
            'status'          => 'borrowed',
            'catatan'         => $catatan,
            'tanggal_pinjam'  => $out_date,
            'tanggal_kembali' => $due_date,
        ]);
        if (!empty($sb_result) && !is_wp_error($sb_result)) {
            $sb_loan_id = is_array($sb_result) ? ($sb_result[0]['id'] ?? ($sb_result['id'] ?? null)) : null;
        }

        // Cek availability per unit fisik: Hanya ubah status ptv_aset ke 'borrowed' jika SEMUA unit terpinjam
        foreach ($equipment_ids as $eid) {
            if (strlen($eid) === 36) {
                $aset_row = PTV_Supabase::find('ptv_aset', $eid);
                $total_item_units = max(1, intval($aset_row['jumlah'] ?? 1));
                $active_pjm = PTV_Supabase::select('ptv_peminjaman', '?status=in.(borrowed,dipinjam)&limit=100');
                $sum_borrowed = 0;
                if (is_array($active_pjm) && !is_wp_error($active_pjm)) {
                    foreach ($active_pjm as $ap) {
                        $ap_notes = $ap['catatan'] ?? '';
                        if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $ap_notes, $apm)) {
                            $m_arr = json_decode($apm[1], true) ?: [];
                            $m_quantities = $m_arr['equipment_quantities'] ?? [];
                            if (isset($m_quantities[$eid])) { $sum_borrowed += max(1, intval($m_quantities[$eid])); continue; }
                            $m_eids = $m_arr['equipment_ids'] ?? [];
                            if (in_array($eid, $m_eids, true)) { $sum_borrowed += 1; continue; }
                        }
                        if ((string)($ap['aset_id'] ?? '') === $eid) {
                            $sum_borrowed += max(1, intval($ap['jumlah'] ?? 1));
                        }
                    }
                }
                PTV_Supabase::update_by_id('ptv_aset', $eid, ['status' => ($sum_borrowed >= $total_item_units ? 'borrowed' : 'available')]);
            }
        }
        delete_transient('ptv_inventaris_list_v1');
    }

    // WP local log dan CPT post_meta tidak lagi diperbarui.
    // Supabase ptv_peminjaman adalah single source of truth untuk seluruh data peminjaman.
    $local_loan_ids = [];


    // Kirim notifikasi ke seluruh Eksekutif aktif
    $count_alat = count($equipment_ids);
    ptv_notify_all_exec_admin(
        'inventory',
        'Peminjaman Alat Baru',
        "{$user_name} mengajukan peminjaman {$count_alat} alat.",
        [
            'entity_type' => 'peminjaman',
            'entity_id'   => $code,
            'action_url'  => 'dasbor?tab=peminjaman',
        ]
    );

    ptv_realtime_broadcast_change('ptv_peminjaman', 'loans', 'INSERT', $code, ['nama_peminjam' => $user_name]);

    wp_send_json_success([
        'message'        => 'Peminjaman berhasil dicatat.',
        'loan_code'      => $code,
        'transaction_id' => $transaction_id,
        'loan_id'        => $sb_loan_id ?: ($local_loan_ids[0] ?? null),
        'equipment_ids'  => $equipment_ids,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: PENGEMBALIAN ALAT
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_return', 'ptv_dashboard_action_return_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_return', 'ptv_dashboard_action_return_cb');
function ptv_dashboard_action_return_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $item_id = sanitize_text_field($_POST['item_id'] ?? '');
    $eq_ids_raw = $_POST['equipment_ids'] ?? [];

    $equipment_ids = [];
    if (!empty($eq_ids_raw)) {
        if (is_string($eq_ids_raw)) {
            $decoded = json_decode(stripslashes($eq_ids_raw), true);
            if (is_array($decoded)) $equipment_ids = array_filter(array_map('strval', $decoded));
        } elseif (is_array($eq_ids_raw)) {
            $equipment_ids = array_filter(array_map('strval', $eq_ids_raw));
        }
    }
    if (empty($equipment_ids) && !empty($item_id)) {
        $equipment_ids = [$item_id];
    }

    if (empty($equipment_ids)) {
        wp_send_json_error('ID alat wajib diisi.');
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // Cari peminjaman aktif yang mengandung alat ini (status borrowed atau dipinjam)
        $active_loans = PTV_Supabase::select('ptv_peminjaman', '?status=in.(borrowed,dipinjam)&limit=150');
        if (is_array($active_loans) && !is_wp_error($active_loans)) {
            foreach ($active_loans as $pr) {
                $notes = $pr['catatan'] ?? '';
                $match = false;
                foreach ($equipment_ids as $eid) {
                    if (str_contains($notes, $eid) || (string)($pr['aset_id'] ?? '') === $eid) {
                        $match = true;
                        break;
                    }
                }
                if ($match) {
                    $meta = [];
                    if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $notes, $m)) {
                        $meta = json_decode($m[1], true) ?: [];
                    }
                    $meta['returned_at'] = date('Y-m-d H:i:s');
                    $meta['status'] = 'returned';
                    $new_catatan = preg_replace('/<!-- PTV_META:\s*({.*?})\s*-->/s', '<!-- PTV_META: ' . wp_json_encode($meta) . ' -->', $notes);
                    PTV_Supabase::update_by_id('ptv_peminjaman', $pr['id'], [
                        'status'          => 'dikembalikan',
                        'tanggal_kembali' => date('Y-m-d'),
                        'catatan'         => $new_catatan,
                    ]);
                }
            }
        }

        // Hitung ulang status ketersediaan unit untuk masing-masing alat yang dikembalikan
        $fresh_active_loans = PTV_Supabase::select('ptv_peminjaman', '?status=in.(borrowed,dipinjam)&limit=100');
        foreach ($equipment_ids as $eid) {
            if (strlen($eid) === 36) {
                $aset_row = PTV_Supabase::find('ptv_aset', $eid);
                $total_item_units = max(1, intval($aset_row['jumlah'] ?? 1));
                
                $rem_borrowed = 0;
                if (is_array($fresh_active_loans) && !is_wp_error($fresh_active_loans)) {
                    foreach ($fresh_active_loans as $fp) {
                        $fp_notes = $fp['catatan'] ?? '';
                        if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $fp_notes, $fpm)) {
                            $fm_arr = json_decode($fpm[1], true) ?: [];
                            $fm_quantities = $fm_arr['equipment_quantities'] ?? [];
                            if (isset($fm_quantities[$eid])) {
                                $rem_borrowed += max(1, intval($fm_quantities[$eid]));
                                continue;
                            }
                            $fm_eids = $fm_arr['equipment_ids'] ?? [];
                            if (in_array($eid, $fm_eids, true)) {
                                $rem_borrowed += 1;
                                continue;
                            }
                        }
                        if ((string)($fp['aset_id'] ?? '') === $eid) {
                            $rem_borrowed += max(1, intval($fp['jumlah'] ?? 1));
                        }
                    }
                }

                if ($rem_borrowed >= $total_item_units) {
                    PTV_Supabase::update_by_id('ptv_aset', $eid, ['status' => 'borrowed', 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')]);
                } else {
                    PTV_Supabase::update_by_id('ptv_aset', $eid, ['status' => 'available', 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')]);
                }
            }
        }
    }

    // WP local log dan CPT post_meta tidak lagi diperbarui saat pengembalian.
    foreach ($equipment_ids as $eid) {
        if (is_numeric($eid)) {
            // CPT post_meta masih diperbarui untuk backward-compatibility halaman publik
            update_post_meta((int)$eid, 'ptv_alat_status', 'available');
            delete_post_meta((int)$eid, 'ptv_alat_holder');
            delete_post_meta((int)$eid, 'ptv_alat_due');
        }
    }


    // Kirim notifikasi ke seluruh Eksekutif aktif saat alat dikembalikan (Non-blocking & Safe)
    if (function_exists('ptv_notify_all_exec_admin')) {
        try {
            $current_returner = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');
            $count_ret = count($equipment_ids);
            ptv_notify_all_exec_admin(
                'inventory',
                'Pengembalian Alat',
                "{$current_returner} telah mengembalikan {$count_ret} alat.",
                [
                    'entity_type' => 'pengembalian',
                    'entity_id'   => $item_id ?: ($equipment_ids[0] ?? ''),
                    'action_url'  => 'dasbor?tab=peminjaman',
                ]
            );
        } catch (Throwable $ne) {
            error_log('Return action notify error: ' . $ne->getMessage());
        }
    }

    ptv_realtime_broadcast_change('ptv_peminjaman', 'loans', 'UPDATE', $item_id ?: ($equipment_ids[0] ?? ''));

    wp_send_json_success(['message' => 'Alat berhasil dikembalikan.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: PENGEMBALIAN PER LOAN_ID (item spesifik)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_return_loan_item', 'ptv_dashboard_return_loan_item_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_return_loan_item', 'ptv_dashboard_return_loan_item_cb');
function ptv_dashboard_return_loan_item_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    global $wpdb;
    $loan_id = sanitize_text_field($_POST['loan_id'] ?? '');
    $item_id = sanitize_text_field($_POST['item_id'] ?? '');

    if (empty($loan_id) && empty($item_id)) {
        wp_send_json_error('loan_id atau item_id wajib diisi.');
    }

    $returned_date = date('Y-m-d');

    // WP local table ptv_peminjaman_log tidak lagi diperbarui.
    // Seluruh pengembalian diproses melalui Supabase ptv_peminjaman di bawah.

    // 2. Update Supabase jika loan_id berupa UUID Supabase
    if (!empty($loan_id) && !is_numeric($loan_id) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $pr = PTV_Supabase::find('ptv_peminjaman', $loan_id);
        if (!empty($pr) && !is_wp_error($pr)) {
            $notes = $pr['catatan'] ?? '';
            $meta  = [];
            if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $notes, $m)) {
                $meta = json_decode($m[1], true) ?: [];
            }
            $meta['returned_at'] = date('Y-m-d H:i:s');
            $meta['status']      = 'returned';
            $new_catatan = preg_replace('/<!-- PTV_META:\s*({.*?})\s*-->/s', '<!-- PTV_META: ' . wp_json_encode($meta) . ' -->', $notes);
            PTV_Supabase::update_by_id('ptv_peminjaman', $loan_id, [
                'status'          => 'dikembalikan',
                'tanggal_kembali' => $returned_date,
                'catatan'         => $new_catatan,
            ]);
            // Update ptv_aset availability
            if (!empty($item_id) && strlen($item_id) === 36) {
                PTV_Supabase::update_by_id('ptv_aset', $item_id, ['status' => 'available', 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')]);
            }
            delete_transient('ptv_inventaris_list_v1');
        }
    } elseif (!empty($item_id) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // Fallback: cari berdasarkan item_id di Supabase
        $active = PTV_Supabase::select('ptv_peminjaman', '?status=in.(borrowed,dipinjam)&limit=50');
        if (is_array($active) && !is_wp_error($active)) {
            foreach ($active as $pr) {
                $notes = $pr['catatan'] ?? '';
                if (str_contains($notes, $item_id) || (string)($pr['aset_id'] ?? '') === $item_id) {
                    $meta = [];
                    if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $notes, $m)) {
                        $meta = json_decode($m[1], true) ?: [];
                    }
                    $meta['returned_at'] = date('Y-m-d H:i:s');
                    $meta['status'] = 'returned';
                    $new_catatan = preg_replace('/<!-- PTV_META:\s*({.*?})\s*-->/s', '<!-- PTV_META: ' . wp_json_encode($meta) . ' -->', $notes);
                    PTV_Supabase::update_by_id('ptv_peminjaman', $pr['id'], [
                        'status' => 'dikembalikan',
                        'tanggal_kembali' => $returned_date,
                        'catatan' => $new_catatan,
                    ]);
                    break;
                }
            }
        }
        if (strlen($item_id) === 36) {
            PTV_Supabase::update_by_id('ptv_aset', $item_id, ['status' => 'available', 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')]);
            delete_transient('ptv_inventaris_list_v1');
        }
    }

    $unit_no = intval($_POST['unit_no'] ?? 0);
    if ($unit_no > 0 && !empty($item_id) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::update_where('ptv_inventaris_unit', [
            'inventaris_id' => $item_id,
            'nomor_unit'    => $unit_no,
        ], [
            'status'     => 'Tersedia',
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z')
        ]);
        delete_transient('ptv_inventaris_list_v1');
    }

    ptv_realtime_broadcast_change('ptv_peminjaman', 'loans', 'UPDATE', $loan_id ?: $item_id);

    wp_send_json_success(['message' => 'Item berhasil dikembalikan.', 'returned_at' => $returned_date]);
}

// ─────────────────────────────────────────────────────────────
// FUNGSI: CATAT LOGIN HISTORY (SUPABASE & DB LOCAL)
// ─────────────────────────────────────────────────────────────
function ptv_record_login_history($kru_row, $username_input) {
    global $wpdb;
    ptv_dashboard_init_tables();
    $table_login = $wpdb->prefix . 'ptv_login_history';

    $user_id    = (string)($kru_row['id'] ?? ($kru_row['cpt_post_id'] ?? ''));
    $ptv_id     = (string)($kru_row['crew_id'] ?? ($kru_row['ptv_id'] ?? ''));
    $nama       = (string)($kru_row['nama'] ?? ($kru_row['name'] ?? ''));
    $username   = (string)($kru_row['username'] ?? $username_input);
    $role       = (string)($kru_row['role'] ?? 'crew');
    $ip_address = (string)(sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? ''));
    $user_agent = substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500);
    $now_mysql  = current_time('mysql');
    $now_iso    = gmdate('Y-m-d\TH:i:s\Z');

    // 1. Simpan ke database lokal WP jika tabel tersedia
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_login}'") === $table_login) {
        $wpdb->insert($table_login, [
            'user_id'    => $user_id,
            'ptv_id'     => $ptv_id,
            'nama'       => $nama,
            'username'   => $username,
            'role'       => $role,
            'login_at'   => $now_mysql,
            'ip_address' => $ip_address,
            'user_agent' => $user_agent,
        ]);
    }

    // 2. Simpan ke Supabase table ptv_login_history
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::insert('ptv_login_history', [
            'user_id'    => $user_id,
            'ptv_id'     => $ptv_id,
            'nama'       => $nama,
            'username'   => $username,
            'role'       => $role,
            'login_at'   => $now_iso,
            'ip_address' => $ip_address,
            'user_agent' => $user_agent,
        ]);
    }
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: AMBIL RIWAYAT LOGIN (KHUSUS EKSEKUTIF)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_get_login_history', 'ptv_dashboard_get_login_history_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_get_login_history', 'ptv_dashboard_get_login_history_cb');
function ptv_dashboard_get_login_history_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    
    // Cek role Eksekutif dari session portal dasbor atau WP Admin
    $role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    $divisi = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    
    $is_exec = in_array($role, ['eksekutif', 'executive', 'administrator', 'admin'], true) 
               || strpos($divisi, 'eksekutif') !== false 
               || strpos($divisi, 'executive') !== false;

    if (!$is_exec && function_exists('current_user_can') && current_user_can('manage_options')) {
        $is_exec = true;
    }
    
    // Jika user memiliki session login dasbor aktif
    if (!$is_exec && (!empty($_SESSION['ptv_admin_logged_in']) || !empty($_SESSION['ptv_crew_logged_in']))) {
        if ($role === 'eksekutif' || $role === 'executive' || empty($role) || $role === 'admin') {
            $is_exec = true;
        }
    }

    if (!$is_exec) {
        wp_send_json_error('Akses ditolak. Fitur ini hanya untuk Eksekutif.');
        return;
    }

    $history = [];

    // 1. Ambil dari Supabase ptv_login_history jika Supabase aktif
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_res = PTV_Supabase::select('ptv_login_history', '?order=login_at.desc&limit=100');
        if (is_array($sb_res) && !is_wp_error($sb_res) && !isset($sb_res['code']) && !isset($sb_res['error'])) {
            $history = $sb_res;
        }
    }

    // 2. Fallback jika Supabase belum ada data: ambil dari tabel WP lokal
    if (empty($history)) {
        global $wpdb;
        $table_login = $wpdb->prefix . 'ptv_login_history';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_login}'") === $table_login) {
            $history = $wpdb->get_results("SELECT * FROM {$table_login} ORDER BY id DESC LIMIT 100", ARRAY_A) ?: [];
        }
    }

    wp_send_json_success(['history' => $history]);
}


// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: AJUKAN PERIZINAN / SURAT
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_submit_doc', 'ptv_dashboard_action_submit_doc_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_submit_doc', 'ptv_dashboard_action_submit_doc_cb');
function ptv_dashboard_action_submit_doc_cb() {
    global $wpdb;
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');
    $current_kru_id = (int)($_SESSION['ptv_kru_post_id'] ?? ($_SESSION['ptv_crew_post_id'] ?? 0));

    $type    = sanitize_text_field($_POST['type'] ?? 'Izin Santri');
    $subject = sanitize_text_field($_POST['subject'] ?? 'Pengajuan Dasbor');
    $notes   = sanitize_textarea_field($_POST['notes'] ?? '');
    $event_id = sanitize_text_field($_POST['event_id'] ?? '');

    $start_date = sanitize_text_field($_POST['start_date'] ?? date('Y-m-d'));
    $end_date   = sanitize_text_field($_POST['end_date'] ?? date('Y-m-d'));
    $crew_id    = intval($_POST['crew_id'] ?? 0);
    $item_id    = sanitize_text_field($_POST['item_id'] ?? '');

    // Saat pengajuan awal (status Menunggu), nomor surat resmi BELUM diterbitkan.
    // Nomor surat resmi & QR Code hanya diberikan saat disahkan (Disetujui).
    // KECUALI jika dibuat langsung oleh Eksekutif/Administrasi dalam konteks Acara (from_event = 1): langsung disahkan & diterbitkan.
    $is_exec_or_adm  = ptv_is_administrasi_or_eksekutif();
    $is_auto_approve = $is_exec_or_adm && (!empty($_POST['from_event']) || !empty($_POST['auto_approve']));

    // WAJIB: Penerbitan surat tugas / bawa barang secara langsung (auto-approve) wajib memvalidasi kode verifikasi
    if ($is_auto_approve) {
        $vtoken    = sanitize_text_field($_POST['verification_token'] ?? '');
        $user_key  = function_exists('ptv_get_current_surat_user_key') ? ptv_get_current_surat_user_key() : '';
        $tipe_code = ($type === 'Surat Tugas') ? 'ST' : (($type === 'Izin Membawa Barang' || $type === 'Surat Bawa Barang') ? 'SBB' : 'SI');
        $draft_ref = sanitize_text_field($_POST['event_id'] ?? '');
        $v_res     = function_exists('ptv_consume_surat_verification_token') ? ptv_consume_surat_verification_token($vtoken, $user_key, $tipe_code, $draft_ref) : ['valid' => false, 'message' => 'Engine verifikasi tidak tersedia.'];
        if (!$v_res['valid']) {
            wp_send_json_error('Penerbitan surat resmi ditolak: ' . $v_res['message']);
            return;
        }
    }

    $status_target   = $is_auto_approve ? 'disetujui' : 'menunggu';
    $doc_official_no = '';

    $start_clean = !empty($start_date) ? substr($start_date, 0, 10) : date('Y-m-d');
    $end_clean   = !empty($end_date) ? substr($end_date, 0, 10) : $start_clean;

    if ($is_auto_approve && function_exists('ptv_generate_nomor_surat')) {
        $tipe_code = ($type === 'Surat Tugas') ? 'ST' : (($type === 'Izin Membawa Barang' || $type === 'Surat Bawa Barang') ? 'SBB' : 'SI');
        $doc_official_no = ptv_generate_nomor_surat($tipe_code, $start_clean, 'issue');
    }
    $provisional_no = $is_auto_approve ? ($doc_official_no ?: 'RESMI') : '— (Menunggu Pengesahan)';

    $sb_doc_id = '';

    if ($type === 'Surat Tugas') {
        $crew_names_raw = wp_unslash($_POST['crew_names'] ?? '');
        $penanggung_jawab = sanitize_text_field($_POST['penanggung_jawab'] ?? ($current_name));
        $final_notes = $notes;
        if (!empty($crew_names_raw)) {
            $final_notes = trim($final_notes . "\n<!-- PTV_KRU:" . $crew_names_raw . "-->");
        }

        // 1. SUPABASE (SINGLE SOURCE OF TRUTH)
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_insert_data = [
                'nomor_surat'      => $is_auto_approve ? $doc_official_no : null,
                'nama_kegiatan'    => $subject,
                'lokasi'           => 'Area Operasional PTV',
                'tanggal_mulai'    => $start_clean,
                'tanggal_selesai'  => $end_clean,
                'penanggung_jawab' => $penanggung_jawab,
                'kru_assigned'     => !empty($crew_names_raw) ? $crew_names_raw : $penanggung_jawab,
                'status'           => $status_target,
                'catatan'          => $final_notes,
                'diajukan_oleh'    => !empty($_SESSION['ptv_kru_sb_id']) ? (string)$_SESSION['ptv_kru_sb_id'] : (string)$current_name,
            ];
            if ($is_auto_approve) {
                $sb_insert_data['disetujui_oleh'] = $current_name;
            }
            $sb_res = PTV_Supabase::insert('ptv_surat_tugas', $sb_insert_data);
            if (is_array($sb_res) && !empty($sb_res[0]['id'])) {
                $sb_doc_id = 'st_' . $sb_res[0]['id'];
            }
        }

        // 2. MySQL fallback mirror
        $table = $wpdb->prefix . 'ptv_surat_tugas';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $wp_insert_data = [
                'nomor_surat'      => $is_auto_approve ? $doc_official_no : '',
                'nama_kegiatan'    => $subject,
                'lokasi'           => 'Area Operasional PTV',
                'tanggal_mulai'    => $start_clean . ' 00:00:00',
                'tanggal_selesai'  => $end_clean . ' 23:59:59',
                'penanggung_jawab' => $penanggung_jawab,
                'status'           => $status_target,
                'catatan'          => $final_notes,
                'diajukan_oleh'    => $current_kru_id,
                'created_at'       => current_time('mysql'),
            ];
            if ($is_auto_approve) {
                $wp_insert_data['disetujui_oleh'] = $current_name;
            }
            $wpdb->insert($table, $wp_insert_data);
            if (empty($sb_doc_id)) {
                $sb_doc_id = 'st_' . $wpdb->insert_id;
            }
        }

        // Notifikasi ke seluruh Eksekutif aktif
        if (!empty($sb_doc_id)) {
            ptv_notify_all_exec_admin(
                'submission',
                $is_auto_approve ? 'Surat Tugas Resmi Diterbitkan' : 'Pengajuan Surat Tugas Baru',
                $is_auto_approve ? "Surat Tugas resmi untuk {$subject} telah diterbitkan ({$doc_official_no})." : "{$current_name} mengajukan Surat Tugas untuk {$subject}.",
                [
                    'entity_type' => 'surat_tugas',
                    'entity_id'   => $sb_doc_id,
                    'action_url'  => 'dasbor?tab=surat',
                ]
            );
        }
    } elseif ($type === 'Izin Membawa Barang' || $type === 'Surat Bawa Barang') {
        $items_raw = wp_unslash($_POST['items'] ?? '');
        $daftar_barang = !empty($items_raw) ? $items_raw : $notes;
        $pembawa = sanitize_text_field($_POST['pembawa'] ?? ($current_name));

        // 1. SUPABASE (SINGLE SOURCE OF TRUTH)
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_sbb_data = [
                'nomor_surat'     => $is_auto_approve ? $doc_official_no : null,
                'keperluan'       => $subject,
                'item_id'         => $item_id,
                'daftar_barang'   => $daftar_barang,
                'pembawa'         => $pembawa,
                'tanggal_mulai'   => $start_clean,
                'tanggal_selesai' => $end_clean,
                'status'          => $status_target,
                'catatan'         => $notes,
                'diajukan_oleh'   => !empty($_SESSION['ptv_kru_sb_id']) ? (string)$_SESSION['ptv_kru_sb_id'] : (string)$current_name,
            ];
            if ($is_auto_approve) {
                $sb_sbb_data['disetujui_oleh'] = $current_name;
            }
            $sb_res = PTV_Supabase::insert('ptv_surat_barang', $sb_sbb_data);
            if (is_array($sb_res) && !empty($sb_res[0]['id'])) {
                $sb_doc_id = 'sbb_' . $sb_res[0]['id'];
            }
        }

        // 2. MySQL fallback mirror
        $table = $wpdb->prefix . 'ptv_surat_barang';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $wp_sbb_data = [
                'nomor_surat'     => $is_auto_approve ? $doc_official_no : '',
                'keperluan'       => $subject,
                'item_id'         => $item_id,
                'daftar_barang'   => $daftar_barang,
                'pembawa'         => $pembawa,
                'tanggal_mulai'   => $start_clean . ' 00:00:00',
                'tanggal_selesai' => $end_clean . ' 23:59:59',
                'status'          => $status_target,
                'catatan'         => $notes,
                'diajukan_oleh'   => $current_kru_id,
                'created_at'      => current_time('mysql'),
            ];
            if ($is_auto_approve) {
                $wp_sbb_data['disetujui_oleh'] = $current_name;
            }
            $wpdb->insert($table, $wp_sbb_data);
            if (empty($sb_doc_id)) {
                $sb_doc_id = 'sbb_' . $wpdb->insert_id;
            }
        }

        // Notifikasi ke seluruh Eksekutif aktif
        if (!empty($sb_doc_id)) {
            ptv_notify_all_exec_admin(
                'submission',
                $is_auto_approve ? 'Izin Bawa Barang Resmi Diterbitkan' : 'Pengajuan Surat Bawa Barang Baru',
                $is_auto_approve ? "Izin membawa barang untuk {$subject} telah disahkan secara resmi ({$doc_official_no})." : "{$current_name} mengajukan Surat Bawa Barang untuk {$subject}.",
                [
                    'entity_type' => 'surat_barang',
                    'entity_id'   => $sb_doc_id,
                    'action_url'  => 'dasbor?tab=surat',
                ]
            );
        }
    } else {
        // Surat Izin
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_si = PTV_Supabase::insert('ptv_surat_izin', [
                'nomor_surat'     => null,
                'jenis_kegiatan'  => $subject,
                'nama_santri'     => $current_name,
                'alasan'          => $notes,
                'santri_list'     => [ ['nama' => $current_name, 'alasan' => $notes] ],
                'tanggal_mulai'   => substr($start_date, 0, 10),
                'tanggal_selesai' => substr($end_date, 0, 10),
                'status'          => 'menunggu',
                'diajukan_oleh'   => !empty($_SESSION['ptv_kru_sb_id']) ? $_SESSION['ptv_kru_sb_id'] : $current_name,
                'catatan'         => $notes,
            ]);
            if (is_array($sb_si) && !empty($sb_si[0]['id'])) {
                $sb_doc_id = 'si_' . $sb_si[0]['id'];
            }
        }

        $table = $wpdb->prefix . 'ptv_surat_izin';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $wpdb->insert($table, [
                'nomor_surat'    => '',
                'kru_post_id'    => $current_kru_id,
                'nama_santri'    => $current_name,
                'jenis_kegiatan' => $subject,
                'tanggal_mulai'  => $start_date . ' 00:00:00',
                'tanggal_selesai'=> $end_date . ' 23:59:59',
                'status'         => 'menunggu',
                'alasan'         => $notes,
                'catatan'        => $notes,
                'diajukan_oleh'  => $current_kru_id,
                'created_at'     => current_time('mysql'),
            ]);
            if (empty($sb_doc_id)) {
                $sb_doc_id = 'si_' . $wpdb->insert_id;
            }
        }

        // Notifikasi ke seluruh Eksekutif aktif
        if (!empty($sb_doc_id)) {
            ptv_notify_all_exec_admin(
                'submission',
                'Pengajuan Surat Izin Baru',
                "{$current_name} mengajukan surat izin untuk {$subject}.",
                [
                    'entity_type' => 'surat_izin',
                    'entity_id'   => $sb_doc_id,
                    'action_url'  => 'dasbor?tab=surat',
                ]
            );
        }
    }

    wp_send_json_success([
        'message' => $is_auto_approve ? 'Dokumen resmi berhasil diterbitkan.' : 'Pengajuan berhasil dikirim (Status: Menunggu Tinjauan).',
        'id'      => $sb_doc_id ?: ('doc_' . time()),
        'no'      => $provisional_no,
        'status'  => $is_auto_approve ? 'Disetujui' : 'Menunggu',
        'type'    => $type,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: SIMPAN ACARA / AGENDA
// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: SIMPAN ACARA / AGENDA
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_event', 'ptv_dashboard_action_save_event_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_event', 'ptv_dashboard_action_save_event_cb');
add_action('wp_ajax_ptv_save_acara_canvas', 'ptv_dashboard_action_save_event_cb');
function ptv_dashboard_action_save_event_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');

    $id        = sanitize_text_field($_POST['id'] ?? '');
    $judul     = sanitize_text_field($_POST['name'] ?? ($_POST['judul'] ?? ''));
    $lokasi    = sanitize_text_field($_POST['loc'] ?? ($_POST['lokasi'] ?? 'Studio PTV'));
    $tgl_mulai = sanitize_text_field($_POST['date'] ?? ($_POST['tanggal_mulai'] ?? date('Y-m-d')));
    $waktu     = ptv_sanitize_utf8_text(sanitize_text_field($_POST['time'] ?? '08:00 – Selesai'), '08:00 – Selesai');
    $catatan   = sanitize_textarea_field($_POST['notes'] ?? ($_POST['deskripsi'] ?? ''));
    $status_in = strtolower(trim(sanitize_text_field($_POST['status'] ?? 'terjadwal')));
    $type      = sanitize_text_field($_POST['type'] ?? 'internal');
    $dresscode = sanitize_text_field($_POST['dresscode'] ?? '');
    $crew_in   = $_POST['crew'] ?? null;
    $gear_in   = $_POST['gear'] ?? null;

    if (empty($judul)) {
        wp_send_json_error('Nama acara / kegiatan wajib diisi.');
        return;
    }

    $rundown_raw = $_POST['rundown'] ?? null;

    if (!empty($id) && strlen($id) === 36 && class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && ($crew_in === null || $gear_in === null || $rundown_raw === null)) {
        $existing_for_merge = PTV_Supabase::find('ptv_acara', $id);
        if ($existing_for_merge && !is_wp_error($existing_for_merge) && !isset($existing_for_merge['code'])) {
            $ex_desc = (string)($existing_for_merge['deskripsi'] ?? '');
            $ex_meta = [];
            if (preg_match('/<!-- PTV_META:\s*({.+?})\s*-->/s', $ex_desc, $m)) {
                $ex_meta = json_decode($m[1], true) ?: [];
            }
            if ($crew_in === null && isset($ex_meta['crew'])) {
                $crew_in = $ex_meta['crew'];
            }
            if ($gear_in === null && isset($ex_meta['gear'])) {
                $gear_in = $ex_meta['gear'];
            }
            if ($rundown_raw === null) {
                $rundown_raw = $existing_for_merge['rundown'] ?? ($ex_meta['rundown'] ?? []);
            }
        }
    }

    $crew_arr = [];
    if (is_string($crew_in)) {
        $c_dec = json_decode(stripslashes($crew_in), true);
        $crew_arr = is_array($c_dec) ? $c_dec : explode(',', $crew_in);
    } elseif (is_array($crew_in)) {
        $crew_arr = $crew_in;
    }

    $clean_saved_crew = [];
    $seen_crew_names = [];
    if (is_array($crew_arr)) {
        foreach ($crew_arr as $c_item) {
            if (is_array($c_item)) {
                $c_name = ptv_sanitize_utf8_text($c_item['name'] ?? ($c_item['nama'] ?? ($c_item['full_name'] ?? ($c_item['nama_lengkap'] ?? ''))));
                if (empty($c_name) || $c_name === '[object Object]' || isset($seen_crew_names[strtolower($c_name)])) continue;
                $seen_crew_names[strtolower($c_name)] = true;
                $c_id   = ptv_sanitize_utf8_text($c_item['id'] ?? ($c_item['crew_id'] ?? ''));
                $c_job  = ptv_sanitize_utf8_text($c_item['job'] ?? ($c_item['tugas'] ?? ''));
                $clean_saved_crew[] = [
                    'id'    => $c_id,
                    'name'  => $c_name,
                    'job'   => $c_job,
                    'tugas' => $c_job,
                ];
            } elseif (is_string($c_item) && trim($c_item) !== '') {
                $c_name = ptv_sanitize_utf8_text(trim($c_item));
                if (!empty($c_name) && $c_name !== '[object Object]' && !isset($seen_crew_names[strtolower($c_name)])) {
                    $seen_crew_names[strtolower($c_name)] = true;
                    $clean_saved_crew[] = [
                        'id'    => '',
                        'name'  => $c_name,
                        'job'   => '',
                        'tugas' => '',
                    ];
                }
            }
        }
    }

    $gear_arr = [];
    if (is_string($gear_in)) {
        $g_dec = json_decode(stripslashes($gear_in), true);
        $gear_arr = is_array($g_dec) ? $g_dec : explode(',', $gear_in);
    } elseif (is_array($gear_in)) {
        $gear_arr = $gear_in;
    }

    $clean_saved_gear = [];
    $seen_gear_ids = [];
    if (is_array($gear_arr)) {
        foreach ($gear_arr as $g_item) {
            if (is_array($g_item)) {
                $g_id = ptv_sanitize_utf8_text($g_item['id'] ?? ($g_item['item_id'] ?? ''));
                if (!empty($g_id) && !isset($seen_gear_ids[$g_id])) {
                    $seen_gear_ids[$g_id] = true;
                    $photo_val = ptv_sanitize_utf8_text($g_item['photo'] ?? ($g_item['foto_url'] ?? ($g_item['gambar'] ?? '')));
                    if (empty($photo_val) && strlen($g_id) === 36 && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
                        $parent_item = PTV_Supabase::find('ptv_inventaris', $g_id);
                        if (!empty($parent_item['foto_url'])) {
                            $photo_val = ptv_sanitize_utf8_text($parent_item['foto_url']);
                        }
                    }
                    $clean_saved_gear[] = [
                        'id'    => $g_id,
                        'qty'   => max(1, intval($g_item['qty'] ?? 1)),
                        'name'  => ptv_sanitize_utf8_text($g_item['name'] ?? ''),
                        'code'  => ptv_sanitize_utf8_text($g_item['code'] ?? ''),
                        'photo' => $photo_val,
                        'cat'   => ptv_sanitize_utf8_text($g_item['cat'] ?? ''),
                        'units' => is_array($g_item['units'] ?? null) ? $g_item['units'] : [],
                    ];
                }
            } elseif (is_string($g_item) && trim($g_item) !== '') {
                $g_id = ptv_sanitize_utf8_text(trim($g_item));
                if (!empty($g_id) && $g_id !== '[object Object]' && $g_id !== 'Array' && !isset($seen_gear_ids[$g_id])) {
                    $seen_gear_ids[$g_id] = true;
                    $photo_val = '';
                    if (strlen($g_id) === 36 && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
                        $parent_item = PTV_Supabase::find('ptv_inventaris', $g_id);
                        if (!empty($parent_item['foto_url'])) {
                            $photo_val = ptv_sanitize_utf8_text($parent_item['foto_url']);
                        }
                    }
                    $clean_saved_gear[] = [
                        'id'    => $g_id,
                        'qty'   => 1,
                        'name'  => '',
                        'code'  => '',
                        'photo' => $photo_val,
                        'cat'   => '',
                        'units' => [],
                    ];
                }
            }
        }
    }

    // Parse structured rundown
    $rundown_raw = $_POST['rundown'] ?? null;
    if ($rundown_raw === null && !empty($id) && strlen($id) === 36 && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $existing_event_obj = PTV_Supabase::find('ptv_acara', $id);
        if ($existing_event_obj && !is_wp_error($existing_event_obj) && !empty($existing_event_obj['rundown'])) {
            $rundown_raw = $existing_event_obj['rundown'];
        }
    }
    $clean_saved_rundown = ptv_sanitize_rundown_list($rundown_raw, $id);

    // Map status to Supabase ptv_acara_status_check constraint ('draft', 'aktif', 'selesai', 'batal')
    $sb_status = 'aktif';
    if ($status_in === 'selesai' || $status_in === 'completed') {
        $sb_status = 'selesai';
    } elseif ($status_in === 'batal' || $status_in === 'cancelled') {
        $sb_status = 'batal';
    } elseif ($status_in === 'draft') {
        $sb_status = 'draft';
    } else {
        $sb_status = 'aktif';
    }

    $meta = [
        'time'          => $waktu,
        'loc'           => $lokasi,
        'crew'          => $clean_saved_crew,
        'gear'          => $clean_saved_gear,
        'rundown'       => $clean_saved_rundown,
        'type'          => $type,
        'dresscode'     => $dresscode,
        'notes'         => $catatan,
        'status_detail' => ($status_in === 'berjalan' || $status_in === 'ongoing') ? 'Berjalan' : ($sb_status === 'selesai' ? 'Selesai' : ($sb_status === 'batal' ? 'Batal' : 'Terjadwal')),
    ];
    $full_deskripsi = "<!-- PTV_META: " . wp_json_encode($meta) . " -->\n" . $catatan;

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_tipe = (strtolower($type) === 'publik' || strtolower($type) === 'public') ? 'publik' : 'internal';
        $data = [
            'judul'           => $judul,
            'lokasi'          => $lokasi,
            'tanggal_mulai'   => $tgl_mulai,
            'tanggal_selesai' => $tgl_mulai,
            'deskripsi'       => $full_deskripsi,
            'status'          => $sb_status,
            'tipe'            => $sb_tipe,
            'rundown'         => !empty($clean_saved_rundown) ? $clean_saved_rundown : null,
            'created_by'      => null, // Must not be arbitrary string because column is UUID foreign key
            'updated_at'      => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        if (!empty($id) && strlen($id) === 36) {
            $upd = PTV_Supabase::update_by_id('ptv_acara', $id, $data);
            if (is_wp_error($upd) || (is_array($upd) && isset($upd['code']))) {
                $err_msg = is_wp_error($upd) ? $upd->get_error_message() : ($upd['message'] ?? 'Error updating Supabase');
                wp_send_json_error('Gagal memperbarui acara di Supabase: ' . $err_msg);
                return;
            }
            $event_id = $id;
        } else {
            $ins = PTV_Supabase::insert('ptv_acara', $data);
            if (is_wp_error($ins) || !is_array($ins) || empty($ins[0]['id'])) {
                $err_msg = is_wp_error($ins) ? $ins->get_error_message() : (is_array($ins) && isset($ins['message']) ? $ins['message'] : 'Gagal insert data ke Supabase.');
                wp_send_json_error('Gagal menambahkan acara ke Supabase: ' . $err_msg);
                return;
            }
            $event_id = (string)$ins[0]['id'];
        }

        // Dual sync ke WordPress CPT acara_ptv sebagai local backup
        $cpt_id = (!empty($id) && is_numeric($id)) ? (int)$id : 0;
        if ($cpt_id > 0 && get_post($cpt_id)) {
            wp_update_post([
                'ID'           => $cpt_id,
                'post_title'   => $judul,
                'post_content' => $catatan,
            ]);
        } else {
            $cpt_id = wp_insert_post([
                'post_title'   => $judul,
                'post_content' => $catatan,
                'post_type'    => 'acara_ptv',
                'post_status'  => 'publish',
            ]);
        }
        if ($cpt_id && !is_wp_error($cpt_id)) {
            update_post_meta($cpt_id, 'ptv_acara_start', $tgl_mulai);
            update_post_meta($cpt_id, 'ptv_acara_tanggal', $tgl_mulai);
            update_post_meta($cpt_id, 'ptv_acara_waktu', $waktu);
            update_post_meta($cpt_id, 'ptv_acara_location', $lokasi);
            update_post_meta($cpt_id, 'ptv_acara_lokasi', $lokasi);
            update_post_meta($cpt_id, 'ptv_acara_status', $meta['status_detail']);
            update_post_meta($cpt_id, 'ptv_acara_pic', $current_name);
            update_post_meta($cpt_id, 'ptv_acara_supabase_id', $event_id);
        }

        $event_item = [
            'id'        => $event_id,
            'name'      => $judul,
            'date'      => $tgl_mulai,
            'time'      => $waktu,
            'loc'       => $lokasi,
            'status'    => $meta['status_detail'],
            'crew'      => $meta['crew'],
            'gear'      => $meta['gear'],
            'rundown'   => $meta['rundown'],
            'type'      => $type,
            'dresscode' => $dresscode,
            'notes'     => $catatan,
            'doc'       => '',
        ];

        // Notifikasi ke seluruh Eksekutif aktif setelah acara berhasil disimpan
        $is_new_ev   = empty($id);
        $event_title = $is_new_ev ? ('Acara Baru: ' . $judul) : ('Pembaruan Acara: ' . $judul);
        $event_msg   = $is_new_ev ? "{$judul} telah ditambahkan ke kalender PTV." : "Informasi untuk acara {$judul} telah diperbarui.";
        ptv_notify_all_exec_admin(
            'event',
            $event_title,
            $event_msg,
            [
                'entity_type' => 'acara',
                'entity_id'   => $event_id,
                'action_url'  => 'dasbor?tab=acara',
            ]
        );

        ptv_realtime_broadcast_change('ptv_acara', 'events', $is_new_ev ? 'INSERT' : 'UPDATE', $event_id, ['judul' => $judul]);

        wp_send_json_success([
            'message'  => 'Acara berhasil disimpan ke database.',
            'event_id' => $event_id,
            'event'    => $event_item,
        ]);
        return;
    } else {
        // WordPress CPT acara_ptv fallback
        $post_id = (!empty($id) && is_numeric($id)) ? (int)$id : 0;
        if ($post_id > 0 && get_post($post_id)) {
            wp_update_post([
                'ID'           => $post_id,
                'post_title'   => $judul,
                'post_content' => $catatan,
            ]);
        } else {
            $post_id = wp_insert_post([
                'post_title'   => $judul,
                'post_content' => $catatan,
                'post_type'    => 'acara_ptv',
                'post_status'  => 'publish',
            ]);
        }
        if ($post_id && !is_wp_error($post_id)) {
            update_post_meta($post_id, 'ptv_acara_start', $tgl_mulai);
            update_post_meta($post_id, 'ptv_acara_tanggal', $tgl_mulai);
            update_post_meta($post_id, 'ptv_acara_waktu', $waktu);
            update_post_meta($post_id, 'ptv_acara_location', $lokasi);
            update_post_meta($post_id, 'ptv_acara_lokasi', $lokasi);
            update_post_meta($post_id, 'ptv_acara_status', $meta['status_detail']);
            update_post_meta($post_id, 'ptv_acara_pic', $current_name);
        }

        $event_item = [
            'id'        => (string)$post_id,
            'name'      => $judul,
            'date'      => $tgl_mulai,
            'time'      => $waktu,
            'loc'       => $lokasi,
            'status'    => $meta['status_detail'],
            'crew'      => $meta['crew'],
            'gear'      => $meta['gear'],
            'rundown'   => $meta['rundown'],
            'type'      => $type,
            'dresscode' => $dresscode,
            'notes'     => $catatan,
            'doc'       => '',
        ];

        wp_send_json_success([
            'message'  => 'Acara berhasil disimpan ke database lokal.',
            'event_id' => (string)$post_id,
            'event'    => $event_item,
        ]);
        return;
    }
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: SIMPAN / PERBARUI RUNDOWN ACARA (ptv_acara.rundown)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_event_rundown', 'ptv_dashboard_action_save_event_rundown_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_event_rundown', 'ptv_dashboard_action_save_event_rundown_cb');
function ptv_dashboard_action_save_event_rundown_cb() {
    $event_id = trim(sanitize_text_field($_POST['id'] ?? ($_POST['event_id'] ?? '')));
    if (empty($event_id)) {
        wp_send_json_error(['message' => 'ID acara tidak valid.']);
        return;
    }

    $rundown_raw = $_POST['rundown'] ?? '';

    // Validasi waktu: waktu selesai harus setelah waktu mulai (mendukung lintas tengah malam / multi-hari)
    $check_items = [];
    if (!empty($rundown_raw)) {
        if (is_string($rundown_raw)) {
            $decoded = json_decode(stripslashes($rundown_raw), true);
            if (!is_array($decoded)) $decoded = json_decode($rundown_raw, true);
            if (is_array($decoded)) $check_items = $decoded;
        } elseif (is_array($rundown_raw)) {
            $check_items = $rundown_raw;
        }
    }
    foreach ($check_items as $chk) {
        if (!is_array($chk)) continue;
        $tm = trim($chk['tanggal_mulai'] ?? ($chk['tenggat'] ?? ''));
        $ts = trim($chk['tanggal_selesai'] ?? ($chk['tanggal_mulai'] ?? ($chk['tenggat'] ?? '')));
        $jm = trim($chk['jam_mulai'] ?? ($chk['start_time'] ?? ''));
        $js = trim($chk['jam_selesai'] ?? ($chk['end_time'] ?? ''));

        if (!empty($jm) && !empty($js)) {
            if (!empty($tm) && !empty($ts)) {
                $dt_start = strtotime("$tm $jm");
                $dt_end   = strtotime("$ts $js");
                if ($dt_start !== false && $dt_end !== false && $dt_end <= $dt_start) {
                    wp_send_json_error(['message' => 'Waktu selesai harus setelah waktu mulai.']);
                    return;
                }
            } else {
                if ($js <= $jm) {
                    wp_send_json_error(['message' => 'Jam selesai harus setelah jam mulai.']);
                    return;
                }
            }
        }
    }

    $clean_rundown = ptv_sanitize_rundown_list($rundown_raw, $event_id);

    $sb_uuid = '';
    $post_id = 0;
    if (strlen($event_id) === 36) {
        $sb_uuid = $event_id;
    } else {
        $check_cpt = is_numeric($event_id) ? (int)$event_id : (strpos($event_id, 'cpt:') === 0 ? (int)substr($event_id, 4) : 0);
        if ($check_cpt > 0) {
            $post_id = $check_cpt;
            $meta_sb = get_post_meta($check_cpt, 'ptv_acara_supabase_id', true);
            if (!empty($meta_sb) && strlen($meta_sb) === 36) {
                $sb_uuid = $meta_sb;
            }
        }
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $existing = null;
        if (!empty($sb_uuid)) {
            $existing = PTV_Supabase::find('ptv_acara', $sb_uuid);
            if (is_wp_error($existing) || (is_array($existing) && isset($existing['code']))) {
                $existing = null;
            }
        }

        // Jika belum ditemukan di Supabase dan ada post CPT, cari berdasarkan judul
        if (!$existing && $post_id > 0) {
            $post_obj = get_post($post_id);
            if ($post_obj) {
                $sb_search = PTV_Supabase::request('GET', 'ptv_acara', [], '?judul=eq.' . urlencode($post_obj->post_title) . '&limit=1');
                if (is_array($sb_search) && isset($sb_search[0]['id'])) {
                    $existing = $sb_search[0];
                    $sb_uuid = (string)$existing['id'];
                    update_post_meta($post_id, 'ptv_acara_supabase_id', $sb_uuid);
                }
            }
        }

        if ($existing && !empty($sb_uuid)) {
            $desc = (string)($existing['deskripsi'] ?? '');
            $meta = [];
            if (preg_match('/<!-- PTV_META:\s*({.+?})\s*-->/s', $desc, $m)) {
                $meta = json_decode($m[1], true) ?: [];
                $desc = trim(str_replace($m[0], '', $desc));
            }
            $meta['rundown'] = $clean_rundown;
            $new_deskripsi = "<!-- PTV_META: " . wp_json_encode($meta) . " -->\n" . $desc;

            $upd = PTV_Supabase::update_by_id('ptv_acara', $sb_uuid, [
                'rundown'    => $clean_rundown,
                'deskripsi'  => $new_deskripsi,
                'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);

            if (is_wp_error($upd)) {
                wp_send_json_error(['message' => 'Gagal memperbarui rundown di Supabase: ' . $upd->get_error_message()]);
                return;
            }
            if (is_array($upd) && isset($upd['code'])) {
                wp_send_json_error(['message' => 'Gagal memperbarui rundown di Supabase: ' . ($upd['message'] ?? 'Error ' . $upd['code'])]);
                return;
            }
            if (!empty($existing['wp_post_id']) && $post_id === 0) {
                $post_id = (int)$existing['wp_post_id'];
            }
        } else {
            // Jika row acara belum ada di Supabase, buat row baru agar tidak gagal
            $post_obj = $post_id > 0 ? get_post($post_id) : null;
            $judul_acara = $post_obj ? $post_obj->post_title : 'Acara PTV';
            $tgl_acara = $post_id > 0 ? (get_post_meta($post_id, 'ptv_acara_tanggal', true) ?: (get_post_meta($post_id, 'ptv_acara_start', true) ?: date('Y-m-d'))) : date('Y-m-d');
            $lokasi_acara = $post_id > 0 ? (get_post_meta($post_id, 'ptv_acara_lokasi', true) ?: 'Studio PTV') : 'Studio PTV';
            $catatan_acara = $post_obj ? $post_obj->post_content : '';

            $meta_baru = ['rundown' => $clean_rundown];
            $full_deskripsi = "<!-- PTV_META: " . wp_json_encode($meta_baru) . " -->\n" . $catatan_acara;

            $new_sb_data = [
                'judul'           => $judul_acara,
                'lokasi'          => $lokasi_acara,
                'tanggal_mulai'   => $tgl_acara,
                'tanggal_selesai' => $tgl_acara,
                'deskripsi'       => $full_deskripsi,
                'status'          => 'aktif',
                'tipe'            => 'internal',
                'rundown'         => $clean_rundown,
                'created_by'      => null,
                'created_at'      => gmdate('Y-m-d\TH:i:s\Z'),
                'updated_at'      => gmdate('Y-m-d\TH:i:s\Z'),
            ];

            $ins = PTV_Supabase::insert('ptv_acara', $new_sb_data);
            if (!is_wp_error($ins) && is_array($ins) && !empty($ins[0]['id'])) {
                $sb_uuid = (string)$ins[0]['id'];
                if ($post_id > 0) {
                    update_post_meta($post_id, 'ptv_acara_supabase_id', $sb_uuid);
                }
            }
        }
    }

    // Invalidate transient caches
    if (function_exists('delete_transient')) {
        delete_transient('ptv_acara_list_v2');
        delete_transient('ptv_acara_list');
    }

    // Dual persistence for WP CPT if applicable
    if ($post_id > 0) {
        update_post_meta($post_id, 'ptv_acara_rundown', wp_json_encode($clean_rundown));
    }

    ptv_realtime_broadcast_change('ptv_acara', 'events', 'UPDATE', $sb_uuid ?: $event_id);

    wp_send_json_success([
        'message'     => 'Rundown acara berhasil disimpan ke Supabase.',
        'rundown'     => $clean_rundown,
        'event_id'    => $sb_uuid ?: $event_id,
        'supabase_id' => $sb_uuid,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: BUAT PENGUMUMAN
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_announcement', 'ptv_dashboard_action_save_announcement_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_announcement', 'ptv_dashboard_action_save_announcement_cb');
add_action('wp_ajax_ptv_create_announcement', 'ptv_dashboard_action_save_announcement_cb');
function ptv_dashboard_action_save_announcement_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Redaksi PTV');

    $title = sanitize_text_field($_POST['title'] ?? '');
    $body  = sanitize_textarea_field($_POST['body'] ?? ($_POST['content'] ?? ''));
    $prio  = sanitize_text_field($_POST['prio'] ?? ($_POST['priority'] ?? 'normal'));

    if (empty($title)) {
        wp_send_json_error('Judul pengumuman wajib diisi.');
        return;
    }

    $sb_uuid = '';
    $created_at = current_time('mysql');

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $sb_payload = [
            'judul'         => $title,
            'konten'        => $body,
            'target_divisi' => 'Semua',
            'prioritas'     => (strtolower($prio) === 'penting' || strtolower($prio) === 'urgent') ? 'Penting' : 'Normal',
            'status'        => 'aktif',
        ];
        if (!empty($_SESSION['ptv_crew_supabase_id'])) {
            $sb_payload['created_by'] = $_SESSION['ptv_crew_supabase_id'];
        }

        $sb_res = PTV_Supabase::insert('ptv_pengumuman', $sb_payload);
        if (is_wp_error($sb_res)) {
            wp_send_json_error('Gagal menyimpan pengumuman ke Supabase: ' . $sb_res->get_error_message());
            return;
        }
        if (is_array($sb_res) && isset($sb_res[0]['id'])) {
            $sb_uuid = (string)$sb_res[0]['id'];
            $created_at = (string)($sb_res[0]['created_at'] ?? $created_at);
        }
    }

    // Optional legacy mirror
    $post_id = wp_insert_post([
        'post_title'   => $title,
        'post_content' => $body,
        'post_type'    => 'pengumuman_ptv',
        'post_status'  => 'publish',
    ]);
    if ($post_id && !is_wp_error($post_id)) {
        update_post_meta($post_id, 'ptv_ann_priority', $prio);
        update_post_meta($post_id, 'ptv_ann_by', $current_name);
        if ($sb_uuid) {
            update_post_meta($post_id, 'ptv_supabase_uuid', $sb_uuid);
        }
    }

    $final_id = $sb_uuid ?: ('a' . ($post_id ?: time()));

    // Broadcast notifikasi ke SEMUA akun kru aktif (Requirement #10)
    ptv_notify_all_crew(
        'announcement',
        'Pengumuman Baru: ' . $title,
        mb_substr(strip_tags($body), 0, 150),
        [
            'entity_type' => 'pengumuman',
            'entity_id'   => $final_id,
            'action_url'  => 'dasbor?tab=pengumuman',
        ]
    );

    ptv_realtime_broadcast_change('ptv_pengumuman', 'announcements', !empty($id_raw) ? 'UPDATE' : 'INSERT', $final_id, ['title' => $title]);

    wp_send_json_success([
        'message' => 'Pengumuman berhasil diterbitkan dan disimpan ke Supabase.',
        'id'      => $final_id,
        'ann'     => [
            'id'    => $final_id,
            'title' => $title,
            'body'  => $body,
            'prio'  => (strtolower($prio) === 'penting' || strtolower($prio) === 'urgent') ? 'penting' : 'normal',
            'by'    => $current_name,
            'date'  => substr($created_at, 0, 10),
        ],
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: HAPUS PENGUMUMAN (SINGLE SOURCE OF TRUTH: SUPABASE ptv_pengumuman)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_announcement', 'ptv_dashboard_action_delete_announcement_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_announcement', 'ptv_dashboard_action_delete_announcement_cb');
function ptv_dashboard_action_delete_announcement_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    // Hanya Eksekutif yang boleh menghapus pengumuman
    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya Eksekutif yang dapat menghapus pengumuman.']);
        return;
    }

    $id_raw = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id_raw)) {
        wp_send_json_error('ID pengumuman wajib diisi.');
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id_raw) === 36) {
        PTV_Supabase::delete_by_id('ptv_pengumuman', $id_raw);
    }

    // Also check WP post if legacy ID
    $post_id = (int) preg_replace('/[^0-9]/', '', $id_raw);
    if ($post_id > 0) {
        $post = get_post($post_id);
        if ($post && $post->post_type === 'pengumuman_ptv') {
            wp_delete_post($post_id, true);
        }
    }

    ptv_realtime_broadcast_change('ptv_pengumuman', 'announcements', 'DELETE', $id_raw);

    wp_send_json_success(['message' => 'Pengumuman berhasil dihapus.', 'id' => $id_raw]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: APPROVAL & UPDATE STATUS DOKUMEN / SURAT
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_update_doc_status', 'ptv_dashboard_action_update_doc_status_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_update_doc_status', 'ptv_dashboard_action_update_doc_status_cb');
function ptv_dashboard_action_update_doc_status_cb() {
    global $wpdb;
    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Pimpinan PTV');
    $id_raw  = sanitize_text_field($_POST['id'] ?? '');
    $status  = strtolower(trim((string)sanitize_text_field($_POST['status'] ?? 'disetujui')));
    $catatan = sanitize_textarea_field($_POST['notes'] ?? '');

    if (empty($id_raw)) {
        wp_send_json_error('ID dokumen wajib diisi.');
    }

    $is_st  = str_starts_with($id_raw, 'st_');
    $is_sbb = str_starts_with($id_raw, 'sbb_') || str_starts_with($id_raw, 'sb_');
    $is_si  = str_starts_with($id_raw, 'si_');
    $clean_uuid = preg_replace('/^(st_|sbb_|sb_|si_)/', '', $id_raw);
    $is_uuid = (strlen($clean_uuid) === 36 && preg_match('/^[0-9a-f-]{36}$/i', $clean_uuid));
    $num_id = (!$is_uuid && is_numeric($clean_uuid)) ? (int)$clean_uuid : 0;

    // Fallback autodetection jika prefix tidak disertakan dari client
    if (!$is_st && !$is_sbb && !$is_si) {
        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $chk_b = PTV_Supabase::select('ptv_surat_barang', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
            if (!empty($chk_b)) {
                $is_sbb = true;
            } else {
                $chk_t = PTV_Supabase::select('ptv_surat_tugas', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
                if (!empty($chk_t)) {
                    $is_st = true;
                } else {
                    $chk_i = PTV_Supabase::select('ptv_surat_izin', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
                    if (!empty($chk_i)) {
                        $is_si = true;
                    }
                }
            }
        }
    }

    // WAJIB: Seluruh persetujuan (pengesahan) surat ST, SBB, dan SI wajib memvalidasi kode verifikasi
    if ($status === 'disetujui') {
        $vtoken   = sanitize_text_field($_POST['verification_token'] ?? '');
        $user_key = function_exists('ptv_get_current_surat_user_key') ? ptv_get_current_surat_user_key() : '';
        $doc_type = $is_st ? 'ST' : ($is_sbb ? 'SBB' : 'SI');
        $v_res    = function_exists('ptv_consume_surat_verification_token') ? ptv_consume_surat_verification_token($vtoken, $user_key, $doc_type, $id_raw) : ['valid' => false, 'message' => 'Engine verifikasi tidak tersedia.'];
        if (!$v_res['valid']) {
            wp_send_json_error('Pengesahan dan penerbitan nomor surat ditolak: ' . $v_res['message']);
            return;
        }
    }

    $nomor_surat_resmi = '';

    if ($is_st) {
        $c = null;
        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $res = PTV_Supabase::select('ptv_surat_tugas', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
            if (is_array($res) && !empty($res[0])) $c = $res[0];
        }
        $table = $wpdb->prefix . 'ptv_surat_tugas';
        $curr_wp = null;
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table && $num_id > 0) {
            $curr_wp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $num_id), ARRAY_A);
        }
        $c_data = $c ?: $curr_wp;

        $nomor_surat_resmi = trim((string)($c_data['nomor_surat'] ?? ''));
        if ($status === 'disetujui' && (empty($nomor_surat_resmi) || !preg_match('/^0*\d+\/ST-PTV\/[A-Z0-9-]+\/\d{4}$/i', $nomor_surat_resmi))) {
            $nomor_surat_resmi = ptv_generate_nomor_surat('ST', $c_data['tanggal_mulai'] ?? date('Y-m-d'), 'issue');
        }

        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $upd = [
                'status'         => $status,
                'disetujui_oleh' => $current_name,
                'catatan'        => $catatan ?: ($c_data['catatan'] ?? ''),
            ];
            if (!empty($nomor_surat_resmi)) $upd['nomor_surat'] = $nomor_surat_resmi;
            PTV_Supabase::update_by_id('ptv_surat_tugas', $clean_uuid, $upd);
        }

        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $upd_wp = [
                'status'         => $status,
                'catatan'        => $catatan ?: ($c_data['catatan'] ?? ''),
                'disetujui_oleh' => $current_name,
                'updated_at'     => current_time('mysql'),
            ];
            if (!empty($nomor_surat_resmi)) $upd_wp['nomor_surat'] = $nomor_surat_resmi;
            if ($num_id > 0) {
                $wpdb->update($table, $upd_wp, ['id' => $num_id]);
            }
        }
    } elseif ($is_sbb) {
        $c = null;
        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $res = PTV_Supabase::select('ptv_surat_barang', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
            if (is_array($res) && !empty($res[0])) $c = $res[0];
        }
        $table = $wpdb->prefix . 'ptv_surat_barang';
        $curr_wp = null;
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table && $num_id > 0) {
            $curr_wp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $num_id), ARRAY_A);
        }
        $c_data = $c ?: $curr_wp;

        $nomor_surat_resmi = trim((string)($c_data['nomor_surat'] ?? ''));
        if ($status === 'disetujui' && (empty($nomor_surat_resmi) || !preg_match('/^0*\d+\/SBB-PTV\/[A-Z0-9-]+\/\d{4}$/i', $nomor_surat_resmi))) {
            $nomor_surat_resmi = ptv_generate_nomor_surat('SBB', $c_data['tanggal_mulai'] ?? date('Y-m-d'), 'issue');
        }

        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $upd = [
                'status'         => $status,
                'disetujui_oleh' => $current_name,
                'catatan'        => $catatan ?: ($c_data['catatan'] ?? ''),
            ];
            if (!empty($nomor_surat_resmi)) $upd['nomor_surat'] = $nomor_surat_resmi;
            PTV_Supabase::update_by_id('ptv_surat_barang', $clean_uuid, $upd);
        }

        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $upd_wp = [
                'status'         => $status,
                'catatan'        => $catatan ?: ($c_data['catatan'] ?? ''),
                'disetujui_oleh' => $current_name,
                'updated_at'     => current_time('mysql'),
            ];
            if (!empty($nomor_surat_resmi)) $upd_wp['nomor_surat'] = $nomor_surat_resmi;
            if ($num_id > 0) {
                $wpdb->update($table, $upd_wp, ['id' => $num_id]);
            }
        }
    } else {
        // Surat Izin
        $c = null;
        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $res = PTV_Supabase::select('ptv_surat_izin', '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
            if (is_array($res) && !empty($res[0])) $c = $res[0];
        }
        $table = $wpdb->prefix . 'ptv_surat_izin';
        $curr_wp = null;
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table && $num_id > 0) {
            $curr_wp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $num_id), ARRAY_A);
        }
        $c_data = $c ?: $curr_wp;

        $nomor_surat_resmi = trim((string)($c_data['nomor_surat'] ?? ''));
        if ($status === 'disetujui' && (empty($nomor_surat_resmi) || !preg_match('/^0*\d+\/SI-PTV\/[A-Z0-9-]+\/\d{4}$/i', $nomor_surat_resmi))) {
            $nomor_surat_resmi = ptv_generate_nomor_surat('SI', $c_data['tanggal_mulai'] ?? date('Y-m-d'), 'issue');
        }

        if ($is_uuid && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $upd = [
                'status'         => $status,
                'disetujui_oleh' => $current_name,
            ];
            if (!empty($nomor_surat_resmi)) $upd['nomor_surat'] = $nomor_surat_resmi;
            PTV_Supabase::update_by_id('ptv_surat_izin', $clean_uuid, $upd);
        }

        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $upd_wp = [
                'status'         => $status,
                'disetujui_oleh' => $current_name,
                'updated_at'     => current_time('mysql'),
            ];
            if (!empty($nomor_surat_resmi)) $upd_wp['nomor_surat'] = $nomor_surat_resmi;
            if ($num_id > 0) {
                $wpdb->update($table, $upd_wp, ['id' => $num_id]);
            }
        }
    }

    // Kirim notifikasi hasil keputusan (Disetujui/Ditolak) kepada kru pengaju (Requirement #2B, #3, #4, #5)
    $applicant_crew_id = null;
    $notif_title = '';
    $notif_msg   = '';
    $doc_entity_type = '';
    $is_approved = ($status === 'disetujui');
    $notif_kind  = $is_approved ? 'approval' : 'rejection';

    if ($is_st) {
        $doc_entity_type = 'surat_tugas';
        $kegiatan = $c['nama_kegiatan'] ?? ($curr['nama_kegiatan'] ?? 'Kegiatan');
        $raw_target = $c['diajukan_oleh'] ?? ($curr['diajukan_oleh'] ?? ($c['penanggung_jawab'] ?? ($curr['penanggung_jawab'] ?? '')));
        $applicant_crew_id = ptv_resolve_crew_id($raw_target);
        $notif_title = $is_approved ? 'Surat Tugas Disetujui' : 'Surat Tugas Ditolak';
        $notif_msg   = $is_approved
            ? "Surat Tugas untuk {$kegiatan} telah disetujui."
            : "Pengajuan Surat Tugas untuk {$kegiatan} ditolak. Silakan cek detail pengajuan.";
    } elseif ($is_sbb) {
        $doc_entity_type = 'surat_barang';
        $keperluan = $c['keperluan'] ?? ($curr['keperluan'] ?? 'Barang');
        $raw_target = $c['diajukan_oleh'] ?? ($curr['diajukan_oleh'] ?? ($c['pembawa'] ?? ($curr['pembawa'] ?? '')));
        $applicant_crew_id = ptv_resolve_crew_id($raw_target);
        $notif_title = $is_approved ? 'Surat Bawa Barang Disetujui' : 'Surat Bawa Barang Ditolak';
        $notif_msg   = $is_approved
            ? "Surat Bawa Barang untuk {$keperluan} telah disetujui."
            : "Pengajuan Surat Bawa Barang untuk {$keperluan} ditolak. Silakan cek detail pengajuan.";
    } else {
        $doc_entity_type = 'surat_izin';
        $raw_target = $c['diajukan_oleh'] ?? ($curr['kru_post_id'] ?? ($curr['diajukan_oleh'] ?? ($c['nama_santri'] ?? ($curr['nama_santri'] ?? ''))));
        $applicant_crew_id = ptv_resolve_crew_id($raw_target);
        $notif_title = $is_approved ? 'Surat Izin Disetujui' : 'Surat Izin Ditolak';
        $notif_msg   = $is_approved
            ? 'Pengajuan Surat Izin kamu telah disetujui oleh Eksekutif.'
            : 'Pengajuan Surat Izin kamu ditolak. Silakan cek detail pengajuan.';
    }

    if (!empty($applicant_crew_id)) {
        ptv_create_notification(
            $applicant_crew_id,
            $notif_kind,
            $notif_title,
            $notif_msg,
            [
                'entity_type' => $doc_entity_type,
                'entity_id'   => $clean_uuid ?: (string)$num_id,
                'action_url'  => 'dasbor?tab=surat',
            ]
        );
    }

    $table_target = $is_st ? 'ptv_surat_tugas' : ($is_sbb ? 'ptv_surat_barang' : 'ptv_surat_izin');
    ptv_realtime_broadcast_change($table_target, 'docs', 'UPDATE', $clean_uuid ?: (string)$num_id, ['status' => ucfirst($status), 'nomor_surat' => $nomor_surat_resmi]);

    wp_send_json_success([
        'message'     => 'Status dokumen berhasil diperbarui.',
        'nomor_surat' => $nomor_surat_resmi,
        'status'      => ($status === 'disetujui' ? 'Disetujui' : ($status === 'revisi' ? 'Revisi' : 'Ditolak')),
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: MANAJEMEN AKUN & KRU
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_manage_crew', 'ptv_dashboard_action_manage_crew_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_manage_crew', 'ptv_dashboard_action_manage_crew_cb');
function ptv_dashboard_action_manage_crew_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif yang memiliki izin mengubah data kru.']);
        return;
    }

    $crew_id = sanitize_text_field($_POST['crew_id'] ?? '');
    $action_type = sanitize_text_field($_POST['type'] ?? '');
    $value   = sanitize_text_field($_POST['value'] ?? '');

    if (empty($crew_id)) {
        wp_send_json_error('ID Kru wajib diisi.');
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($crew_id) === 36) {
        if ($action_type === 'role') {
            PTV_Supabase::update_by_id('ptv_kru', $crew_id, ['role' => strtolower($value)]);
        } elseif ($action_type === 'status') {
            PTV_Supabase::update_by_id('ptv_kru', $crew_id, ['status' => strtolower($value)]);
        } elseif ($action_type === 'username') {
            PTV_Supabase::update_by_id('ptv_kru', $crew_id, ['username' => strtolower(trim($value))]);
        } elseif ($action_type === 'reset_password') {
            $default_hash = password_hash('ptv123', PASSWORD_BCRYPT);
            PTV_Supabase::update_by_id('ptv_kru', $crew_id, ['password_hash' => $default_hash]);
        }
    } else {
        $num_id = (int)$crew_id;
        if ($num_id > 0) {
            if ($action_type === 'role') {
                update_post_meta($num_id, 'ptv_kru_role', $value);
            } elseif ($action_type === 'status') {
                update_post_meta($num_id, 'ptv_kru_status', $value);
            } elseif ($action_type === 'reset_password') {
                update_post_meta($num_id, 'ptv_kru_password', password_hash('ptv123', PASSWORD_BCRYPT));
            }
        }
    }

    ptv_realtime_broadcast_change('ptv_kru', 'crew', 'UPDATE', $crew_id, ['type' => $action_type]);

    wp_send_json_success(['message' => 'Data kru berhasil diperbarui.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: GANTI PASSWORD
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_change_password', 'ptv_dashboard_action_change_password_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_change_password', 'ptv_dashboard_action_change_password_cb');
function ptv_dashboard_action_change_password_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $current_kru_id = $_SESSION['ptv_kru_post_id'] ?? ($_SESSION['ptv_crew_post_id'] ?? 0);
    $old_pass = $_POST['old_password'] ?? '';
    $new_pass = $_POST['new_password'] ?? '';

    if (empty($new_pass) || strlen($new_pass) < 4) {
        wp_send_json_error('Password baru minimal 4 karakter.');
    }

    $hash = password_hash($new_pass, PASSWORD_BCRYPT);
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && !empty($_SESSION['ptv_crew_supabase_id'])) {
        PTV_Supabase::update_by_id('ptv_kru', $_SESSION['ptv_crew_supabase_id'], ['password_hash' => $hash]);
    }

    if ($current_kru_id > 0) {
        update_post_meta((int)$current_kru_id, 'ptv_kru_password', $hash);
    }

    wp_send_json_success(['message' => 'Password berhasil diperbarui.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: FULL CRUD INVENTARIS ALAT (ptv_aset)
// ─────────────────────────────────────────────────────────────
if (!function_exists('ptv_get_used_inv_numbers')) {
    /**
     * Mengambil daftar seluruh nomor inventaris yang sudah terpakai di Supabase (ptv_inventaris).
     * 1. Ambil seluruh kode inventaris existing dari database.
     * 2. Extract bagian angka dari kode INV-XXX.
     * 3. Normalisasi menjadi angka.
     * 4. Urutkan secara numerik ascending.
     *
     * @return array{list: int[], lookup: array<int, bool>}
     */
    function ptv_get_used_inv_numbers() {
        $lookup = [];
        if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
            return ['list' => [], 'lookup' => []];
        }

        // 1. Ambil seluruh kode inventaris existing dari database Supabase (ptv_inventaris)
        $existing = PTV_Supabase::select('ptv_inventaris', '?select=kode&limit=10000');
        if (is_array($existing) && !is_wp_error($existing)) {
            foreach ($existing as $r) {
                $kd = trim((string)($r['kode'] ?? ''));
                // 2. Extract bagian angka dari kode INV-XXX
                if (preg_match('/^INV-(\d+)$/i', $kd, $m)) {
                    // 3. Normalisasi menjadi angka
                    $n = (int)$m[1];
                    if ($n > 0) {
                        $lookup[$n] = true;
                    }
                }
            }
        }

        // 4. Urutkan secara numerik ascending
        $list = array_keys($lookup);
        sort($list, SORT_NUMERIC);

        return [
            'list'   => $list,
            'lookup' => $lookup,
        ];
    }
}

if (!function_exists('ptv_get_max_inv_code_number')) {
    function ptv_get_max_inv_code_number() {
        $data = ptv_get_used_inv_numbers();
        return !empty($data['list']) ? max($data['list']) : 0;
    }
}

if (!function_exists('ptv_generate_unique_inv_code')) {
    /**
     * FIRST AVAILABLE INVENTORY NUMBER
     * Sistem mencari nomor inventaris terkecil yang belum digunakan (mengisi lubang gap paling awal).
     * 5. Cari nomor terkecil yang belum digunakan (mulai dari 1).
     * 6. Gunakan nomor tersebut untuk record baru.
     * 7. Format kembali menjadi INV-XXX dengan 3 digit (atau lebih jika > 999).
     *
     * @param array $exclude_codes Daftar kode atau nomor yang ingin dilewati (untuk retry saat collision)
     * @return string Kode inventaris INV-XXX
     */
    function ptv_generate_unique_inv_code($exclude_codes = []) {
        $used_data = ptv_get_used_inv_numbers();
        $lookup    = $used_data['lookup'];

        // Masukkan kode/nomor yang diexclude ke lookup (untuk retry collision)
        if (!empty($exclude_codes) && is_array($exclude_codes)) {
            foreach ($exclude_codes as $ex) {
                if (is_numeric($ex)) {
                    $lookup[(int)$ex] = true;
                } elseif (is_string($ex) && preg_match('/^INV-(\d+)$/i', trim($ex), $m)) {
                    $lookup[(int)$m[1]] = true;
                }
            }
        }

        // 5. Cari nomor terkecil >= 1 yang belum digunakan
        $candidate_num = 1;
        while (isset($lookup[$candidate_num])) {
            $candidate_num++;
        }

        // 6 & 7. Format kembali menjadi INV-XXX dengan 3 digit dan lakukan pengecekan ulang ke Supabase
        $max_safety_checks = 100;
        $checked_count = 0;

        while ($checked_count < $max_safety_checks) {
            $candidate_code = sprintf('INV-%03d', $candidate_num);
            if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
                // Real-time double check untuk mencegah race condition
                $check = PTV_Supabase::select('ptv_inventaris', '?kode=eq.' . urlencode($candidate_code) . '&select=id&limit=1');
                if (is_array($check) && empty($check)) {
                    return $candidate_code;
                }
                // Jika ternyata sudah terisi oleh user lain secara concurrent, tandai terpakai dan cari nomor kosong berikutnya
                $lookup[$candidate_num] = true;
                do {
                    $candidate_num++;
                } while (isset($lookup[$candidate_num]));
                $checked_count++;
            } else {
                return $candidate_code;
            }
        }

        return sprintf('INV-%03d', $candidate_num);
    }
}

if (!function_exists('ptv_get_first_available_inv_code')) {
    function ptv_get_first_available_inv_code($exclude_codes = []) {
        return ptv_generate_unique_inv_code($exclude_codes);
    }
}

if (!function_exists('ptv_get_next_available_inv_code')) {
    function ptv_get_next_available_inv_code($exclude_codes = []) {
        return ptv_generate_unique_inv_code($exclude_codes);
    }
}

add_action('wp_ajax_ptv_dashboard_action_get_next_inv_code', 'ptv_dashboard_action_get_next_inv_code_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_get_next_inv_code', 'ptv_dashboard_action_get_next_inv_code_cb');
function ptv_dashboard_action_get_next_inv_code_cb() {
    $code = ptv_generate_unique_inv_code();
    wp_send_json_success(['next_code' => $code]);
}
add_action('wp_ajax_ptv_dashboard_action_save_asset', 'ptv_dashboard_action_save_asset_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_asset', 'ptv_dashboard_action_save_asset_cb');
function ptv_dashboard_action_save_asset_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    // Validasi wewenang: Eksekutif dan Administrasi boleh; Kru / Pengarah / Pembina dilarang
    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_allowed = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin', 'administrator'], true)
               || strpos($raw_div, 'eksekutif') !== false
               || strpos($raw_div, 'administrasi') !== false
               || (function_exists('current_user_can') && current_user_can('manage_options'))
               || (function_exists('is_super_admin') && is_super_admin());
    if (!$is_allowed) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang memiliki akses mengelola data inventaris.']);
        return;
    }

    $id        = sanitize_text_field($_POST['id'] ?? '');
    $nama      = sanitize_text_field($_POST['name'] ?? ($_POST['nama'] ?? ''));
    $kategori  = sanitize_text_field($_POST['cat'] ?? ($_POST['kategori'] ?? 'Lainnya'));
    $kode      = sanitize_text_field($_POST['code'] ?? ($_POST['kode'] ?? ''));
    $merk      = sanitize_text_field($_POST['brand'] ?? ($_POST['merk'] ?? '—'));
    $model     = sanitize_text_field($_POST['model'] ?? ($_POST['tipe'] ?? '—'));
    $sn        = sanitize_text_field($_POST['sn'] ?? ($_POST['nomor_seri'] ?? ''));
    $lokasi    = sanitize_text_field($_POST['loc'] ?? ($_POST['lokasi'] ?? 'Studio PTV'));
    $jumlah    = max(1, intval($_POST['qty'] ?? ($_POST['jumlah'] ?? 1)));
    $satuan    = sanitize_text_field($_POST['unit'] ?? ($_POST['satuan'] ?? 'unit'));
    $specs     = sanitize_textarea_field($_POST['specs'] ?? ($_POST['spesifikasi'] ?? ($_POST['notes'] ?? '')));
    $kondisi   = sanitize_text_field($_POST['cond'] ?? ($_POST['kondisi'] ?? 'Baik'));
    $status    = sanitize_text_field($_POST['status'] ?? 'Tersedia');
    $foto_url  = esc_url_raw($_POST['photo'] ?? ($_POST['foto_url'] ?? ''));
    $sumber    = sanitize_text_field($_POST['sumber_perolehan'] ?? ($_POST['source'] ?? 'Yayasan'));
    if (empty($sumber)) $sumber = 'Yayasan';

    if (empty($nama)) {
        wp_send_json_error('Nama alat wajib diisi.');
        return;
    }

    $status_sb = 'available';
    $status_lower = strtolower(trim($status));
    if (in_array($status_lower, ['dipinjam', 'borrowed'], true)) {
        $status_sb = 'borrowed';
    } elseif (in_array($status_lower, ['rusak / servis', 'rusak', 'maintenance', 'servis'], true)) {
        $status_sb = 'maintenance';
    } elseif (in_array($status_lower, ['hilang', 'lost'], true)) {
        $status_sb = 'lost';
    }

    $kondisi_sb = 'good';
    $kondisi_lower = strtolower(trim($kondisi));
    if (in_array($kondisi_lower, ['rusak', 'major_damage', 'bad', 'rusak berat'], true)) {
        $kondisi_sb = 'major_damage';
    } elseif (in_array($kondisi_lower, ['butuh servis', 'minor_damage', 'servis', 'perlu perbaikan'], true)) {
        $kondisi_sb = 'minor_damage';
    } elseif (in_array($kondisi_lower, ['baik', 'good', 'bagus'], true)) {
        $kondisi_sb = 'good';
    } else {
        $kondisi_sb = 'good';
    }

    $res_id = $id;

    if (!empty($id) && strlen($id) === 36) {
        // Edit mode: Kode Inventaris terkunci dan TIDAK BOLEH BERUBAH
        $existing_item = PTV_Supabase::select('ptv_inventaris', '?id=eq.' . urlencode($id) . '&select=id,kode&limit=1');
        if (is_array($existing_item) && !empty($existing_item[0]['kode'])) {
            $kode = trim($existing_item[0]['kode']);
        }
    } else {
        // Tambah alat baru: Kode Inventaris dibuat OTOMATIS oleh sistem (FIRST AVAILABLE INVENTORY NUMBER)
        // Jika frontend sudah mengirim kode valid INV-XXX, cek apakah masih available di DB
        if (!empty($kode) && preg_match('/^INV-(\d+)$/i', $kode)) {
            $check_sent = PTV_Supabase::select('ptv_inventaris', '?kode=eq.' . urlencode($kode) . '&select=id&limit=1');
            if (!is_array($check_sent) || !empty($check_sent)) {
                // Kode sudah terpakai di database, cari nomor kosong pertama berikutnya
                $kode = ptv_generate_unique_inv_code();
            }
        } else {
            $kode = ptv_generate_unique_inv_code();
        }
    }

    $unit_conditions_raw = $_POST['unit_conditions'] ?? '';
    $unit_conditions = [];
    if (!empty($unit_conditions_raw)) {
        if (is_string($unit_conditions_raw)) {
            $unit_conditions = json_decode(stripslashes($unit_conditions_raw), true) ?: [];
        } elseif (is_array($unit_conditions_raw)) {
            $unit_conditions = $unit_conditions_raw;
        }
    }
    if (empty($unit_conditions)) {
        for ($u = 1; $u <= $jumlah; $u++) {
            $unit_conditions[] = [
                'unit'  => $u,
                'cond'  => $kondisi,
                'sn'    => ($jumlah > 1) ? ($sn . '-' . $u) : $sn,
                'notes' => '',
            ];
        }
    }

    $meta_payload = [
        'code'             => $kode,
        'brand'            => $merk,
        'model'            => $model,
        'serial'           => $sn,
        'location'         => $lokasi,
        'sumber_perolehan' => $sumber,
        'quantity'         => $jumlah,
        'unit'             => $satuan,
        'unit_conditions'  => $unit_conditions,
        'specs'            => $specs,
        'photo_url'        => $foto_url,
    ];
    $keterangan_full = (!empty($specs) ? $specs : $nama) . "\n<!-- PTV_META: " . wp_json_encode($meta_payload) . " -->";

    $saved_unit_conditions = [];

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $clean_brand = ptv_sanitize_utf8_text($merk, null);
        $clean_model = ptv_sanitize_utf8_text($model, null);
        $clean_specs = ptv_sanitize_utf8_text($specs, null);

        $inv_data = [
            'nama'             => ptv_sanitize_utf8_text($nama, 'Alat PTV'),
            'kategori'         => ptv_normalize_inventory_cat_name($kategori),
            'kode'             => $kode,
            'brand'            => $clean_brand,
            'model'            => $clean_model,
            'spesifikasi'      => $clean_specs,
            'keterangan'       => $clean_specs,
            'jumlah'           => $jumlah,
            'satuan'           => $satuan ?: 'unit',
            'lokasi'           => $lokasi ?: 'Studio PTV',
            'sumber_perolehan' => $sumber ?: 'Yayasan',
            'foto_url'         => $foto_url ?: null,
            'updated_at'       => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        if (!empty($id) && strlen($id) === 36) {
            // UPDATE inventaris induk
            $sb_res = PTV_Supabase::update_by_id('ptv_inventaris', $id, $inv_data);
            if (is_wp_error($sb_res)) {
                $err_msg = $sb_res->get_error_message();
                if (strpos($err_msg, 'kode_inventaris') !== false) {
                    $err_msg = 'Kode inventaris "' . $kode . '" sudah digunakan oleh alat lain.';
                }
                wp_send_json_error(['message' => 'Gagal memperbarui alat: ' . $err_msg]);
                return;
            }
            if (is_array($sb_res) && !empty($sb_res[0]['id'])) {
                $res_id = (string)$sb_res[0]['id'];
            }

            // Sync unit: upsert baris unit
            foreach ($unit_conditions as $uc) {
                $u_no    = intval($uc['unit'] ?? 1);
                $u_kode  = $kode . '-' . sprintf('%02d', $u_no);
                $u_name  = !empty($uc['name']) ? $uc['name'] : (!empty($uc['nama_unit']) ? $uc['nama_unit'] : ('Unit ' . sprintf('%02d', $u_no)));
                $u_cond  = $uc['cond'] ?? 'Baik';
                $u_sn    = !empty($uc['sn']) && $uc['sn'] !== '—' ? $uc['sn'] : null;
                $u_notes = $uc['notes'] ?? null;
                $u_id    = !empty($uc['unit_id']) ? $uc['unit_id'] : (!empty($uc['id']) ? $uc['id'] : null);

                $u_stat = 'Tersedia';
                if ($u_cond === 'Rusak') $u_stat = 'Rusak';
                elseif ($u_cond === 'Hilang') $u_stat = 'Hilang';
                elseif ($u_cond === 'Butuh Servis' || $u_cond === 'Servis') $u_stat = 'Sedang Dicek';

                $unit_payload = [
                    'inventaris_id' => $res_id ?: $id,
                    'nomor_unit'    => $u_no,
                    'kode_unit'     => $u_kode,
                    'nama_unit'     => $u_name,
                    'serial_number' => $u_sn,
                    'kondisi'       => $u_cond,
                    'status'        => $u_stat,
                    'lokasi'        => $lokasi ?: 'Studio PTV',
                    'keterangan'    => $u_notes,
                    'catatan'       => $u_notes,
                    'updated_at'    => gmdate('Y-m-d\TH:i:s\Z'),
                ];

                $updated = false;
                if ($u_id && strlen($u_id) === 36) {
                    $upd_res = PTV_Supabase::update_by_id('ptv_inventaris_unit', $u_id, $unit_payload);
                    if (!is_wp_error($upd_res)) {
                        $updated = true;
                    }
                }

                if (!$updated) {
                    $lookup_id = $res_id ?: $id;
                    $existing = PTV_Supabase::select('ptv_inventaris_unit', '?inventaris_id=eq.' . urlencode($lookup_id) . '&nomor_unit=eq.' . $u_no . '&limit=1');
                    if (is_array($existing) && !empty($existing[0]['id'])) {
                        $u_id = (string)$existing[0]['id'];
                        PTV_Supabase::update_by_id('ptv_inventaris_unit', $u_id, $unit_payload);
                        $updated = true;
                    } else {
                        $existing_by_kode = PTV_Supabase::select('ptv_inventaris_unit', '?kode_unit=eq.' . urlencode($u_kode) . '&limit=1');
                        if (is_array($existing_by_kode) && !empty($existing_by_kode[0]['id'])) {
                            $u_id = (string)$existing_by_kode[0]['id'];
                            PTV_Supabase::update_by_id('ptv_inventaris_unit', $u_id, $unit_payload);
                            $updated = true;
                        }
                    }
                }

                if (!$updated) {
                    $ins_u = PTV_Supabase::insert('ptv_inventaris_unit', $unit_payload);
                    if (is_array($ins_u) && !empty($ins_u[0]['id'])) {
                        $u_id = (string)$ins_u[0]['id'];
                    }
                }

                $saved_unit_conditions[] = [
                    'unit'              => $u_no,
                    'unit_id'           => $u_id ?: '',
                    'name'              => $u_name,
                    'nama_unit'         => $u_name,
                    'kode_unit'         => $u_kode,
                    'cond'              => $u_cond,
                    'status'            => $u_stat,
                    'sn'                => $u_sn ?: '',
                    'notes'             => $u_notes ?: '',
                    'has_active_damage' => ($u_cond === 'Rusak'),
                ];
            }

        } else {
            // INSERT inventaris induk baru dengan anti-duplikasi & auto-retry collision
            $max_retries = 10;
            $ins_success = false;
            $last_error = '';
            $attempted_codes = [];

            for ($attempt = 0; $attempt < $max_retries; $attempt++) {
                if (empty($kode) || in_array($kode, $attempted_codes, true)) {
                    $kode = ptv_generate_unique_inv_code($attempted_codes);
                }
                $attempted_codes[] = $kode;
                $inv_data['kode'] = $kode;

                $ins = PTV_Supabase::insert('ptv_inventaris', $inv_data);
                if (!is_wp_error($ins) && is_array($ins) && !empty($ins[0]['id'])) {
                    $res_id = (string)$ins[0]['id'];
                    $ins_success = true;
                    break;
                }

                $err_msg = is_wp_error($ins) ? $ins->get_error_message() : 'Unknown error';
                $last_error = $err_msg;

                // Jika error adalah constraint collision (ptv_inventaris_kode_key atau duplicate key), cari nomor kosong berikutnya
                if (strpos($err_msg, 'kode') !== false || strpos($err_msg, 'unique') !== false || strpos($err_msg, 'duplicate') !== false || strpos($err_msg, '23505') !== false) {
                    $kode = ptv_generate_unique_inv_code($attempted_codes);
                    continue;
                } else {
                    break;
                }
            }

            if (!$ins_success) {
                wp_send_json_error(['message' => 'Gagal menambahkan alat: ' . $last_error]);
                return;
            }

            // Generate unit fisik sesuai jumlah
            if (!empty($res_id)) {
                foreach ($unit_conditions as $uc) {
                    $u_no    = intval($uc['unit'] ?? 1);
                    $u_kode  = $kode . '-' . sprintf('%02d', $u_no);
                    $u_name  = !empty($uc['name']) ? $uc['name'] : (!empty($uc['nama_unit']) ? $uc['nama_unit'] : ('Unit ' . sprintf('%02d', $u_no)));
                    $u_cond  = $uc['cond'] ?? 'Baik';
                    $u_sn    = !empty($uc['sn']) && $uc['sn'] !== '—' ? $uc['sn'] : null;
                    $u_notes = $uc['notes'] ?? null;
                    $u_stat  = 'Tersedia';
                    if ($u_cond === 'Rusak') $u_stat = 'Rusak';
                    elseif ($u_cond === 'Hilang') $u_stat = 'Hilang';
                    elseif ($u_cond === 'Butuh Servis' || $u_cond === 'Servis') $u_stat = 'Sedang Dicek';

                    $ins_res = PTV_Supabase::insert('ptv_inventaris_unit', [
                        'inventaris_id' => $res_id,
                        'nomor_unit'    => $u_no,
                        'kode_unit'     => $u_kode,
                        'nama_unit'     => $u_name,
                        'serial_number' => $u_sn,
                        'kondisi'       => $u_cond,
                        'status'        => $u_stat,
                        'lokasi'        => $lokasi ?: 'Studio PTV',
                        'keterangan'    => $u_notes,
                        'catatan'       => $u_notes,
                    ]);

                    $u_new_id = (is_array($ins_res) && !empty($ins_res[0]['id'])) ? (string)$ins_res[0]['id'] : '';

                    $saved_unit_conditions[] = [
                        'unit'              => $u_no,
                        'unit_id'           => $u_new_id,
                        'name'              => $u_name,
                        'nama_unit'         => $u_name,
                        'kode_unit'         => $u_kode,
                        'cond'              => $u_cond,
                        'status'            => $u_stat,
                        'sn'                => $u_sn ?: '',
                        'notes'             => $u_notes ?: '',
                        'has_active_damage' => ($u_cond === 'Rusak'),
                    ];
                }
            }
        }

        // Hapus cache transient agar pembacaan setelah refresh selalu mutakhir dari Supabase
        delete_transient('ptv_inventaris_list_v1');
    }

    if (empty($saved_unit_conditions)) {
        $saved_unit_conditions = $unit_conditions;
    }

    // Hitung borrowed unit aktif untuk item ini jika edit
    $qty_borrowed_calc = 0;
    if (!empty($res_id) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $active_pjm = PTV_Supabase::select('ptv_peminjaman', '?status=in.(borrowed,dipinjam)&limit=100');
        if (is_array($active_pjm) && !is_wp_error($active_pjm)) {
            foreach ($active_pjm as $ap) {
                $ap_notes = $ap['catatan'] ?? '';
                if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $ap_notes, $apm)) {
                    $m_arr = json_decode($apm[1], true) ?: [];
                    $m_quantities = $m_arr['equipment_quantities'] ?? [];
                    if (isset($m_quantities[$res_id])) {
                        $qty_borrowed_calc += max(1, intval($m_quantities[$res_id]));
                        continue;
                    }
                    $m_eids = $m_arr['equipment_ids'] ?? [];
                    if (in_array($res_id, $m_eids, true)) {
                        $qty_borrowed_calc += 1;
                        continue;
                    }
                }
                if ((string)($ap['aset_id'] ?? '') === $res_id) {
                    $qty_borrowed_calc += max(1, intval($ap['jumlah'] ?? 1));
                }
            }
        }
    }

    $total_units_count = max(1, count($saved_unit_conditions));
    $qty_damaged  = count(array_filter($saved_unit_conditions, fn($u) => in_array($u['cond'] ?? '', ['Rusak', 'Bermasalah'], true)));
    $qty_lost     = count(array_filter($saved_unit_conditions, fn($u) => ($u['cond'] ?? '') === 'Hilang'));
    $qty_service  = count(array_filter($saved_unit_conditions, fn($u) => in_array($u['cond'] ?? '', ['Butuh Servis', 'Servis'], true)));
    $qty_available_calc = max(0, $total_units_count - $qty_borrowed_calc - $qty_damaged - $qty_lost);

    if ($qty_lost >= $total_units_count) {
        $norm_status_out = 'Hilang';
    } elseif ($qty_damaged >= $total_units_count) {
        $norm_status_out = 'Rusak / Servis';
    } elseif ($qty_available_calc === 0 && $qty_borrowed_calc > 0) {
        $norm_status_out = 'Dipinjam';
    } else {
        $norm_status_out = 'Tersedia';
    }

    if ($qty_damaged >= $total_units_count) {
        $norm_cond_out = 'Rusak';
    } elseif ($qty_damaged > 0 || $qty_service > 0) {
        $norm_cond_out = 'Butuh Servis';
    } else {
        $norm_cond_out = 'Baik';
    }

    $sn_out = !empty($saved_unit_conditions[0]['sn']) ? $saved_unit_conditions[0]['sn'] : $sn;

    ptv_realtime_broadcast_change('ptv_inventaris', 'inventory', !empty($id) ? 'UPDATE' : 'INSERT', $res_id ?: $kode);

    wp_send_json_success([
        'message' => 'Data alat berhasil disimpan.',
        'item'    => [
            'id'              => $res_id ?: uniqid('item_'),
            'code'            => $kode,
            'name'            => $nama,
            'cat'             => $kategori,
            'brand'           => $merk,
            'model'           => $model,
            'sn'              => $sn_out,
            'loc'             => $lokasi,
            'sumber'          => $sumber,
            'sumber_perolehan'=> $sumber,
            'qty'             => $jumlah,
            'qty_total'       => $total_units_count,
            'qty_borrowed'    => $qty_borrowed_calc,
            'qty_available'   => $qty_available_calc,
            'unit'            => $satuan,
            'unit_conditions' => $saved_unit_conditions,
            'specs'           => $specs ?: '—',
            'notes'           => $specs ?: '—',
            'cond'            => $norm_cond_out,
            'status'          => $norm_status_out,
            'photo'           => $foto_url,
            'holder'          => '',
            'due'             => '',
        ]
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: TAMBAH UNIT FISIK KE INVENTARIS (ptv_inventaris_unit)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_add_unit', 'ptv_dashboard_action_add_unit_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_add_unit', 'ptv_dashboard_action_add_unit_cb');
function ptv_dashboard_action_add_unit_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    if (empty($raw_role) && !empty($_COOKIE['ptv_role'])) {
        $raw_role = strtolower(trim((string)$_COOKIE['ptv_role']));
    }
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_allowed = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin', 'administrator'], true)
               || strpos($raw_div, 'eksekutif') !== false
               || strpos($raw_div, 'administrasi') !== false
               || (function_exists('current_user_can') && current_user_can('manage_options'))
               || (function_exists('is_super_admin') && is_super_admin());
    if (!$is_allowed) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang menambah unit inventaris.']);
        return;
    }

    $asset_id = sanitize_text_field($_POST['asset_id'] ?? ($_POST['id'] ?? ''));
    if (empty($asset_id)) {
        wp_send_json_error(['message' => 'ID inventaris wajib diisi.']);
        return;
    }

    $nama_unit_in = sanitize_text_field($_POST['nama_unit'] ?? ($_POST['name'] ?? ''));
    $kondisi_in   = sanitize_text_field($_POST['kondisi'] ?? ($_POST['cond'] ?? 'Baik'));
    $lokasi_in    = sanitize_text_field($_POST['lokasi'] ?? ($_POST['loc'] ?? ''));
    $sn_in        = sanitize_text_field($_POST['serial_number'] ?? ($_POST['sn'] ?? ''));
    $notes_in     = sanitize_textarea_field($_POST['notes'] ?? ($_POST['keterangan'] ?? ''));

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $parent = PTV_Supabase::find('ptv_inventaris', $asset_id);
        if (empty($parent) || is_wp_error($parent)) {
            wp_send_json_error(['message' => 'Alat inventaris tidak ditemukan di database Supabase.']);
            return;
        }

        $parent_code = trim((string)($parent['kode'] ?? 'INV'));
        $parent_loc  = trim((string)($parent['lokasi'] ?? 'Studio PTV'));

        // Query unit yang sudah ada untuk menentukan nomor unit berikutnya
        $existing_units = PTV_Supabase::select('ptv_inventaris_unit', '?inventaris_id=eq.' . urlencode($asset_id) . '&select=id,nomor_unit,kode_unit&limit=200');
        $max_unit_no = 0;
        if (is_array($existing_units)) {
            foreach ($existing_units as $eu) {
                $no = intval($eu['nomor_unit'] ?? 0);
                if ($no > $max_unit_no) $max_unit_no = $no;
            }
        }
        $next_unit_no = $max_unit_no + 1;
        $unit_code    = $parent_code . '-' . sprintf('%02d', $next_unit_no);
        $nama_unit    = !empty($nama_unit_in) ? $nama_unit_in : ('Unit ' . sprintf('%02d', $next_unit_no));

        $status = 'Tersedia';
        if ($kondisi_in === 'Rusak') $status = 'Rusak';
        elseif ($kondisi_in === 'Hilang') $status = 'Hilang';
        elseif ($kondisi_in === 'Butuh Servis' || $kondisi_in === 'Servis') $status = 'Sedang Dicek';

        $unit_payload = [
            'inventaris_id' => $asset_id,
            'nomor_unit'    => $next_unit_no,
            'kode_unit'     => $unit_code,
            'nama_unit'     => $nama_unit,
            'serial_number' => $sn_in ?: null,
            'kondisi'       => $kondisi_in,
            'status'        => $status,
            'lokasi'        => $lokasi_in ?: $parent_loc,
            'keterangan'    => $notes_in ?: null,
            'catatan'       => $notes_in ?: null,
            'updated_at'    => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        $ins = PTV_Supabase::insert('ptv_inventaris_unit', $unit_payload);
        if (is_wp_error($ins) || !is_array($ins) || empty($ins[0]['id'])) {
            $err_msg = is_wp_error($ins) ? $ins->get_error_message() : 'Gagal menyimpan unit ke Supabase.';
            wp_send_json_error(['message' => $err_msg]);
            return;
        }

        $new_unit_id = (string)$ins[0]['id'];

        // Update jumlah unit di ptv_inventaris
        $all_units_count = max(intval($parent['jumlah'] ?? 0) + 1, count(is_array($existing_units) ? $existing_units : []) + 1);
        PTV_Supabase::update_by_id('ptv_inventaris', $asset_id, [
            'jumlah'     => $all_units_count,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);

        delete_transient('ptv_inventaris_list_v1');
        delete_transient('ptv_dashboard_data_v1');

        ptv_realtime_broadcast_change('ptv_inventaris_unit', 'inventory', 'INSERT', $new_unit_id, ['asset_id' => $asset_id]);

        wp_send_json_success([
            'message'    => "Unit {$unit_code} ({$nama_unit}) berhasil ditambahkan ke inventaris.",
            'unit'       => [
                'unit'              => $next_unit_no,
                'unit_id'           => $new_unit_id,
                'id'                => $new_unit_id,
                'name'              => $nama_unit,
                'nama_unit'         => $nama_unit,
                'kode_unit'         => $unit_code,
                'code'              => $unit_code,
                'cond'              => $kondisi_in,
                'kondisi'           => $kondisi_in,
                'status'            => $status,
                'sn'                => $sn_in,
                'notes'             => $notes_in,
                'has_active_damage' => ($kondisi_in === 'Rusak'),
            ],
            'new_total'  => $all_units_count,
            'asset_id'   => $asset_id,
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Koneksi database Supabase tidak aktif.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: UPDATE DATA SATU UNIT FISIK (NAMA, KONDISI, CATATAN)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_update_single_unit', 'ptv_dashboard_action_update_single_unit_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_update_single_unit', 'ptv_dashboard_action_update_single_unit_cb');
function ptv_dashboard_action_update_single_unit_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_allowed = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin', 'administrator'], true)
               || strpos($raw_div, 'eksekutif') !== false
               || strpos($raw_div, 'administrasi') !== false
               || (function_exists('current_user_can') && current_user_can('manage_options'))
               || (function_exists('is_super_admin') && is_super_admin());
    if (!$is_allowed) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang memperbarui unit inventaris.']);
        return;
    }

    $asset_id = sanitize_text_field($_POST['asset_id'] ?? ($_POST['id'] ?? ''));
    $unit_no  = intval($_POST['unit_no'] ?? ($_POST['unit'] ?? 1));
    $name_in  = sanitize_text_field($_POST['nama_unit'] ?? ($_POST['name'] ?? ''));
    $cond_in  = sanitize_text_field($_POST['kondisi'] ?? ($_POST['cond'] ?? 'Baik'));
    $notes_in = sanitize_textarea_field($_POST['notes'] ?? ($_POST['keterangan'] ?? ''));
    $loc_in   = sanitize_text_field($_POST['lokasi'] ?? '');

    if (empty($asset_id)) {
        wp_send_json_error(['message' => 'ID inventaris wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $status = 'Tersedia';
        if ($cond_in === 'Rusak') $status = 'Rusak';
        elseif ($cond_in === 'Hilang') $status = 'Hilang';
        elseif ($cond_in === 'Butuh Servis' || $cond_in === 'Servis') $status = 'Sedang Dicek';

        $upd_data = [
            'nama_unit'  => $name_in,
            'kondisi'    => $cond_in,
            'status'     => $status,
            'keterangan' => $notes_in ?: null,
            'catatan'    => $notes_in ?: null,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        if (!empty($loc_in)) $upd_data['lokasi'] = $loc_in;

        $res = PTV_Supabase::update_where('ptv_inventaris_unit', [
            'inventaris_id' => $asset_id,
            'nomor_unit'    => $unit_no,
        ], $upd_data);

        delete_transient('ptv_inventaris_list_v1');

        wp_send_json_success([
            'message' => "Data Unit #{$unit_no} ({$name_in}) berhasil diperbarui.",
            'unit'    => array_merge($upd_data, ['unit' => $unit_no, 'name' => $name_in]),
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Supabase tidak terhubung.']);
}

add_action('wp_ajax_ptv_dashboard_action_delete_asset', 'ptv_dashboard_action_delete_asset_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_asset', 'ptv_dashboard_action_delete_asset_cb');
function ptv_dashboard_action_delete_asset_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    // Validasi wewenang: Khusus Eksekutif
    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? 'kru'))));
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true)
             || strpos($raw_div, 'eksekutif') !== false;
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya pimpinan Eksekutif yang berwenang menghapus alat dari inventaris.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID alat wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        // ptv_inventaris_unit dihapus otomatis via ON DELETE CASCADE
        $del = PTV_Supabase::delete_by_id('ptv_inventaris', $id);
        if (is_wp_error($del)) {
            wp_send_json_error(['message' => 'Gagal menghapus alat: ' . $del->get_error_message()]);
            return;
        }
    }

    ptv_realtime_broadcast_change('ptv_inventaris', 'inventory', 'DELETE', $id);

    wp_send_json_success(['message' => 'Alat berhasil dihapus.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: SIMPAN NILAI INVENTARIS (ptv_nilai_inventaris)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_nilai_inventaris', 'ptv_dashboard_action_save_nilai_inventaris_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_nilai_inventaris', 'ptv_dashboard_action_save_nilai_inventaris_cb');
function ptv_dashboard_action_save_nilai_inventaris_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_allowed = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin', 'administrator'], true)
               || strpos($raw_div, 'eksekutif') !== false
               || strpos($raw_div, 'administrasi') !== false
               || (function_exists('current_user_can') && current_user_can('manage_options'))
               || (function_exists('is_super_admin') && is_super_admin());
    if (!$is_allowed) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang mencatat/mengubah Nilai Inventaris.']);
        return;
    }

    $id             = sanitize_text_field($_POST['id'] ?? '');
    $inventaris_id  = sanitize_text_field($_POST['inventaris_id'] ?? '');
    if (empty($inventaris_id)) {
        wp_send_json_error(['message' => 'ID inventaris wajib disertakan.']);
        return;
    }

    // Clean numeric inputs
    $raw_nilai_perolehan = sanitize_text_field($_POST['nilai_perolehan'] ?? '0');
    $nilai_perolehan     = floatval(preg_replace('/[^0-9.]/', '', str_replace(',', '.', str_replace('.', '', $raw_nilai_perolehan))));
    
    $tanggal_perolehan   = sanitize_text_field($_POST['tanggal_perolehan'] ?? '');
    if (!empty($tanggal_perolehan)) {
        $tanggal_perolehan = substr($tanggal_perolehan, 0, 10);
    } else {
        $tanggal_perolehan = null;
    }

    $sumber_perolehan    = sanitize_text_field($_POST['sumber_perolehan'] ?? 'Yayasan');
    if (empty($sumber_perolehan)) $sumber_perolehan = 'Yayasan';

    $vendor              = sanitize_text_field($_POST['vendor'] ?? '');
    $nomor_invoice       = sanitize_text_field($_POST['nomor_invoice'] ?? '');
    
    $raw_nilai_residu    = sanitize_text_field($_POST['nilai_residu'] ?? '0');
    $nilai_residu        = !empty($raw_nilai_residu) ? floatval(preg_replace('/[^0-9.]/', '', str_replace(',', '.', str_replace('.', '', $raw_nilai_residu)))) : 0;
    
    $raw_nilai_tercatat  = isset($_POST['nilai_tercatat']) ? sanitize_text_field($_POST['nilai_tercatat']) : '';
    $nilai_tercatat      = ($raw_nilai_tercatat !== '' && $raw_nilai_tercatat !== null) ? floatval(preg_replace('/[^0-9.]/', '', str_replace(',', '.', str_replace('.', '', $raw_nilai_tercatat)))) : null;

    $status              = sanitize_text_field($_POST['status'] ?? 'Aktif');
    if (empty($status)) $status = 'Aktif';

    $catatan             = sanitize_textarea_field($_POST['catatan'] ?? '');
    $dokumen_url         = esc_url_raw($_POST['dokumen_url'] ?? '');
    $creator_name        = sanitize_text_field($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Staff PTV'));

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $existing = null;
        if (!empty($id)) {
            $existing = PTV_Supabase::find('ptv_nilai_inventaris', $id);
        }
        if (empty($existing) || is_wp_error($existing)) {
            $check_by_inv = PTV_Supabase::select('ptv_nilai_inventaris', '?inventaris_id=eq.' . urlencode($inventaris_id) . '&limit=1');
            if (is_array($check_by_inv) && !empty($check_by_inv[0]['id'])) {
                $existing = $check_by_inv[0];
                $id = (string)$existing['id'];
            }
        }

        $payload = [
            'inventaris_id'     => $inventaris_id,
            'nilai_perolehan'   => $nilai_perolehan,
            'tanggal_perolehan' => $tanggal_perolehan,
            'sumber_perolehan'  => $sumber_perolehan,
            'vendor'            => $vendor ?: null,
            'nomor_invoice'     => $nomor_invoice ?: null,
            'nilai_residu'      => $nilai_residu,
            'nilai_tercatat'    => $nilai_tercatat,
            'status'            => $status,
            'catatan'           => $catatan ?: null,
            'dokumen_url'       => $dokumen_url ?: null,
            'updated_at'        => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        if (!empty($existing) && !empty($id)) {
            $res = PTV_Supabase::update_by_id('ptv_nilai_inventaris', $id, $payload);
            if (is_wp_error($res)) {
                wp_send_json_error(['message' => 'Gagal memperbarui nilai inventaris: ' . $res->get_error_message()]);
                return;
            }
            $saved_id = $id;
            if (is_array($res) && !empty($res[0])) {
                $out_record = $res[0];
            } else {
                $out_record = array_merge($payload, ['id' => $saved_id]);
            }
        } else {
            $payload['created_by_name'] = $creator_name ?: null;
            $payload['created_at']      = gmdate('Y-m-d\TH:i:s\Z');
            $ins = PTV_Supabase::insert('ptv_nilai_inventaris', $payload);
            if (is_wp_error($ins) || !is_array($ins) || empty($ins[0]['id'])) {
                $err = is_wp_error($ins) ? $ins->get_error_message() : 'Gagal menyimpan nilai inventaris ke Supabase.';
                wp_send_json_error(['message' => $err]);
                return;
            }
            $saved_id = (string)$ins[0]['id'];
            $out_record = $ins[0];
        }

        delete_transient('ptv_inventaris_list_v1');

        wp_send_json_success([
            'message' => 'Data Nilai Inventaris berhasil disimpan.',
            'record'  => $out_record,
            'data'    => $out_record,
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Koneksi database Supabase tidak aktif.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: HAPUS NILAI INVENTARIS (ptv_nilai_inventaris SAJA)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_nilai_inventaris', 'ptv_dashboard_action_delete_nilai_inventaris_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_nilai_inventaris', 'ptv_dashboard_action_delete_nilai_inventaris_cb');
function ptv_dashboard_action_delete_nilai_inventaris_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    // Validasi wewenang: Eksekutif ONLY (Administrasi/Kru dilarang delete nilai)
    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
    $raw_div  = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif', 'administrator'], true)
             || strpos($raw_div, 'eksekutif') !== false
             || (function_exists('current_user_can') && current_user_can('manage_options'));
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya pimpinan Eksekutif yang berwenang menghapus data Nilai Inventaris.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    $inventaris_id = sanitize_text_field($_POST['inventaris_id'] ?? '');
    if (empty($id) && empty($inventaris_id)) {
        wp_send_json_error(['message' => 'ID data nilai atau ID inventaris wajib disertakan.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if (!empty($id)) {
            $del = PTV_Supabase::delete_by_id('ptv_nilai_inventaris', $id);
        } else {
            $del = PTV_Supabase::delete_where('ptv_nilai_inventaris', ['inventaris_id' => $inventaris_id]);
        }

        if (is_wp_error($del)) {
            wp_send_json_error(['message' => 'Gagal menghapus data nilai: ' . $del->get_error_message()]);
            return;
        }

        delete_transient('ptv_inventaris_list_v1');

        wp_send_json_success([
            'message' => 'Data Nilai Inventaris berhasil dihapus. Data fisik inventaris tetap aman.',
            'id'      => $id,
            'inventaris_id' => $inventaris_id,
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Koneksi database Supabase tidak aktif.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: FULL CRUD MANAJEMEN KRU (ptv_kru)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_crew', 'ptv_dashboard_action_save_crew_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_crew', 'ptv_dashboard_action_save_crew_cb');
function ptv_dashboard_action_save_crew_cb() {
    global $wpdb;
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif yang memiliki izin mengubah data kru.']);
        return;
    }

    $id        = sanitize_text_field($_POST['id'] ?? '');
    $nama      = sanitize_text_field($_POST['name'] ?? ($_POST['nama'] ?? ''));
    $username  = strtolower(sanitize_user(trim($_POST['username'] ?? ''), true));
    $role      = sanitize_text_field($_POST['role'] ?? 'kru');
    $divisi    = sanitize_text_field($_POST['div'] ?? ($_POST['divisi'] ?? 'Technical'));
    $jabatan   = sanitize_text_field($_POST['pos'] ?? ($_POST['jabatan'] ?? 'Kru'));
    $angkatan  = sanitize_text_field($_POST['angkatan'] ?? '');
    $nim       = sanitize_text_field($_POST['nim'] ?? '');
    $jurusan   = sanitize_text_field($_POST['jurusan'] ?? '');
    $phone       = sanitize_text_field($_POST['phone'] ?? ($_POST['telepon'] ?? ''));
    $status      = sanitize_text_field($_POST['status'] ?? 'Aktif');
    $status_akun = sanitize_text_field($_POST['status_akun'] ?? '');
    $foto_url    = esc_url_raw($_POST['photo'] ?? ($_POST['foto_url'] ?? ''));
    $password    = $_POST['password'] ?? '';
    $ptv_id      = strtoupper(trim(sanitize_text_field($_POST['ptvId'] ?? ($_POST['crew_id'] ?? ''))));

    if (empty($nama)) {
        wp_send_json_error(['message' => 'Nama lengkap kru wajib diisi.']);
        return;
    }

    $is_edit = (!empty($id) && $id !== 'undefined');
    $res_id  = $id;

// ─────────────────────────────────────────────────────────────
    // VALIDASI DUPLIKAT (USERNAME & CREW_ID) PADA SUPABASE ptv_kru
// ─────────────────────────────────────────────────────────────
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // 1. Cek duplikat Username
        if (!empty($username)) {
            $un_query = '?username=ilike.' . urlencode($username) . '&limit=2';
            $existing_un = PTV_Supabase::select('ptv_kru', $un_query);
            if (is_array($existing_un) && !empty($existing_un)) {
                foreach ($existing_un as $ex) {
                    $ex_id = (string)($ex['id'] ?? '');
                    if (!$is_edit || ($is_edit && $ex_id !== $id)) {
                        wp_send_json_error(['message' => 'Username "' . esc_html($username) . '" sudah digunakan oleh kru lain. Silakan pilih username lain.']);
                        return;
                    }
                }
            }
        } elseif (!$is_edit) {
            // Auto generate username dari nama
            $nama_p = explode(' ', trim($nama))[0];
            $gen_un = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $nama_p));
            if (strlen($gen_un) < 3) $gen_un = 'kru' . rand(100, 999);

            // Pastikan unik
            $un_check = PTV_Supabase::select('ptv_kru', '?username=ilike.' . urlencode($gen_un) . '&limit=1');
            if (is_array($un_check) && !empty($un_check)) {
                $gen_un .= rand(10, 99);
            }
            $username = $gen_un;
        }

        // 2. Generator atau Validasi duplikat crew_id
        if (empty($ptv_id)) {
            if (!$is_edit) {
                // Generator Otomatis ID PTV: cari angka berikutnya yang belum pernah terpakai
                $all_crew = PTV_Supabase::select('ptv_kru', '?select=crew_id&crew_id=not.is.null&limit=1000');
                $used_ids = [];
                if (is_array($all_crew)) {
                    foreach ($all_crew as $item) {
                        $cid = trim((string)($item['crew_id'] ?? ''));
                        if (!empty($cid)) $used_ids[strtoupper($cid)] = true;
                    }
                }
                $cand_num = 1;
                while (true) {
                    $cand_id = sprintf('PTV-%03d', $cand_num);
                    if (!isset($used_ids[$cand_id])) {
                        $ptv_id = $cand_id;
                        break;
                    }
                    $cand_num++;
                }
            }
        } else {
            // Jika crew_id diinput/diisi, pastikan unik!
            $id_query = '?crew_id=eq.' . urlencode($ptv_id) . '&limit=2';
            $existing_cid = PTV_Supabase::select('ptv_kru', $id_query);
            if (is_array($existing_cid) && !empty($existing_cid)) {
                foreach ($existing_cid as $ex) {
                    $ex_id = (string)($ex['id'] ?? '');
                    if (!$is_edit || ($is_edit && $ex_id !== $id)) {
                        wp_send_json_error(['message' => 'ID PTV "' . esc_html($ptv_id) . '" sudah digunakan oleh kru lain. Silakan masukkan nomor ID lain.']);
                        return;
                    }
                }
            }
        }
    }

    $sb_data = [
        'nama'     => $nama,
        'role'     => strtolower($role),
        'divisi'   => $divisi,
        'jabatan'  => $jabatan,
        'telepon'  => $phone,
        'status'   => strtolower($status),
        'foto_url' => $foto_url,
    ];

    if (!empty($username)) {
        $sb_data['username'] = $username;
    }
    if (!empty($ptv_id)) {
        $sb_data['crew_id'] = $ptv_id;
    }
    if (!empty($angkatan)) {
        $sb_data['angkatan'] = $angkatan;
    }
    if (!empty($nim)) {
        $sb_data['nim'] = $nim;
    }
    if (!empty($jurusan)) {
        $sb_data['jurusan'] = $jurusan;
    }

    // Password BCRYPT hashing
    if (!empty($password)) {
        $sb_data['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
    } elseif (!$is_edit) {
        $kata1 = strtolower(preg_replace('/[^a-zA-Z]/', '', explode(' ', trim($nama))[0]));
        $sb_data['password_hash'] = password_hash($kata1 ?: 'ptv123', PASSWORD_BCRYPT);
    }

    $oauth_email = null;
    $oauth_provider = null;
    if (isset($_POST['allowed_emails']) || isset($_POST['oauth_email'])) {
        $raw_email = strtolower(trim(sanitize_email($_POST['oauth_email'] ?? $_POST['allowed_emails'])));
        if (!empty($raw_email)) {
            if (!is_email($raw_email)) {
                wp_send_json_error(['message' => 'Format email Google tidak valid.']);
                return;
            }
            // Validasi duplikat email di ptv_kru
            if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
                $existing_oe = PTV_Supabase::select('ptv_kru', '?select=id,nama,oauth_email&oauth_email=not.is.null&limit=1000');
                if (is_array($existing_oe)) {
                    foreach ($existing_oe as $row) {
                        $row_id = (string)($row['id'] ?? '');
                        if ($is_edit && $row_id === $id) continue;
                        $em_list = array_filter(array_map('trim', explode(',', strtolower((string)($row['oauth_email'] ?? '')))));
                        if (in_array($raw_email, $em_list, true)) {
                            wp_send_json_error(['message' => 'Email Google sudah terhubung dengan akun kru lain.']);
                            return;
                        }
                    }
                }
            }
            $sb_data['oauth_email']    = $raw_email;
            $sb_data['oauth_provider'] = 'google';
            $oauth_email               = $raw_email;
            $oauth_provider            = 'google';
        } else {
            if ($is_edit) {
                $sb_data['oauth_email']    = null;
                $sb_data['oauth_provider'] = null;
                $sb_data['oauth_uid']      = null;
            }
        }
    }

    $sb_success = false;

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if ($is_edit) {
            // 1. Jika ID adalah UUID (36 karakter)
            if (strlen($id) === 36) {
                $upd = PTV_Supabase::update_by_id('ptv_kru', $id, $sb_data);
                if (!is_wp_error($upd) && !empty($upd)) {
                    $sb_success = true;
                    $res_id = $id;
                } elseif (is_wp_error($upd)) {
                    error_log('[PTV Kru Error] update_by_id failed: ' . $upd->get_error_message());
                }
            }

            // 2. Jika belum berhasil diupdate (misal ID bukan UUID), cari via ptv_id atau nama
            if (!$sb_success) {
                $q = !empty($ptv_id) ? ('?crew_id=eq.' . urlencode($ptv_id) . '&limit=1') : ('?nama=eq.' . urlencode($nama) . '&limit=1');
                $rows = PTV_Supabase::select('ptv_kru', $q);
                if (!is_wp_error($rows) && !empty($rows[0]['id'])) {
                    $sb_uuid = $rows[0]['id'];
                    $upd = PTV_Supabase::update_by_id('ptv_kru', $sb_uuid, $sb_data);
                    if (!is_wp_error($upd) && !empty($upd)) {
                        $sb_success = true;
                        $res_id = $sb_uuid;
                    }
                }
            }
        } else {
            // Tambah Kru Baru
            $ins = PTV_Supabase::insert('ptv_kru', $sb_data);
            if (is_array($ins) && !empty($ins[0]['id'])) {
                $res_id = (string)$ins[0]['id'];
                $sb_success = true;
            } elseif (is_wp_error($ins)) {
                wp_send_json_error(['message' => 'Gagal menyimpan ke basis data: ' . $ins->get_error_message()]);
                return;
            }
        }
    }

    // Sync ke CPT kru_ptv di WordPress
    if (!empty($id) && is_numeric($id)) {
        $pid = (int)$id;
        wp_update_post(['ID' => $pid, 'post_title' => $nama]);
        update_post_meta($pid, 'ptv_kru_role', $role);
        update_post_meta($pid, 'ptv_kru_divisi', $divisi);
        update_post_meta($pid, 'ptv_kru_jabatan', $jabatan);
        update_post_meta($pid, 'ptv_kru_whatsapp', $phone);
        update_post_meta($pid, 'ptv_kru_status', strtolower($status));
        update_post_meta($pid, 'ptv_kru_foto', $foto_url);
        if (!empty($ptv_id)) update_post_meta($pid, 'ptv_kru_crew_id', $ptv_id);
        if (!empty($username)) update_post_meta($pid, 'ptv_kru_username', $username);
        if (!empty($status_akun)) update_post_meta($pid, 'ptv_kru_status_akun', strtolower($status_akun));
        if (!empty($angkatan)) update_post_meta($pid, 'ptv_kru_angkatan', $angkatan);
        if (!empty($nim)) update_post_meta($pid, 'ptv_kru_nim', $nim);
        if (!empty($jurusan)) update_post_meta($pid, 'ptv_kru_jurusan', $jurusan);
        if ($oauth_email !== null) update_post_meta($pid, 'ptv_kru_allowed_emails', $oauth_email);
    } elseif (!$is_edit || (empty($res_id) || strlen($res_id) !== 36)) {
        $pid = wp_insert_post([
            'post_title'  => $nama,
            'post_type'   => 'kru_ptv',
            'post_status' => 'publish',
        ]);
        if ($pid && !is_wp_error($pid)) {
            if (!empty($username)) update_post_meta($pid, 'ptv_kru_username', $username);
            if (!empty($ptv_id)) update_post_meta($pid, 'ptv_kru_crew_id', $ptv_id);
            if (!empty($status_akun)) update_post_meta($pid, 'ptv_kru_status_akun', strtolower($status_akun));
            update_post_meta($pid, 'ptv_kru_role', $role);
            update_post_meta($pid, 'ptv_kru_divisi', $divisi);
            update_post_meta($pid, 'ptv_kru_jabatan', $jabatan);
            update_post_meta($pid, 'ptv_kru_whatsapp', $phone);
            update_post_meta($pid, 'ptv_kru_status', strtolower($status));
            update_post_meta($pid, 'ptv_kru_foto', $foto_url);
            if (!empty($angkatan)) update_post_meta($pid, 'ptv_kru_angkatan', $angkatan);
            if (!empty($nim)) update_post_meta($pid, 'ptv_kru_nim', $nim);
            if (!empty($jurusan)) update_post_meta($pid, 'ptv_kru_jurusan', $jurusan);
            if ($oauth_email !== null) update_post_meta($pid, 'ptv_kru_allowed_emails', $oauth_email);
            if (empty($res_id)) $res_id = (string)$pid;
        }
    }

    // Update map status akun lokal
    $resolved_acc = !empty($status_akun) ? ucfirst(strtolower($status_akun)) : (!empty($username) ? 'Aktif' : 'Nonaktif');
    $acc_map = get_option('ptv_kru_account_status_map', []);
    if (!empty($res_id)) {
        $acc_map[(string)$res_id] = strtolower($resolved_acc);
    }
    if (!empty($username)) {
        $acc_map[strtolower($username)] = strtolower($resolved_acc);
    }
    update_option('ptv_kru_account_status_map', $acc_map);

    delete_transient('ptv_crew_list_cache');

    wp_send_json_success([
        'message' => $is_edit ? 'Data kru berhasil diperbarui.' : 'Data kru berhasil dibuat.',
        'crew'    => [
            'id'             => $res_id ?: ($id ?: uniqid('crew_')),
            'name'           => $nama,
            'ptvId'          => $ptv_id ?: '', // Murni crew_id, tanpa dummy PTV-001
            'div'            => $divisi,
            'pos'            => $jabatan,
            'role'           => $role,
            'status'         => ucfirst($status),
            'accountStatus'  => $resolved_acc,
            'phone'          => $phone,
            'photo'          => $foto_url,
            'username'       => $username,
            'angkatan'       => $angkatan,
            'nim'            => $nim,
            'jurusan'        => $jurusan,
            'oauth_provider' => $oauth_provider ?: '',
            'oauth_email'    => $oauth_email ?: '',
        ]
    ]);
}

// ─────────────────────────────────────────────────────────────
// ENDPOINT KHUSUS EKSEKUTIF: SIMPAN / LINK EMAIL GOOGLE OAUTH KRU
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_crew_oauth_email', 'ptv_dashboard_action_save_crew_oauth_email_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_crew_oauth_email', 'ptv_dashboard_action_save_crew_oauth_email_cb');
function ptv_dashboard_action_save_crew_oauth_email_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Fitur ini khusus untuk Eksekutif. Anda tidak memiliki izin mengelola email OAuth kru.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID kru tidak valid.']);
        return;
    }

    $raw_input = trim((string)($_POST['oauth_email'] ?? ''));
    $unlink    = !empty($_POST['unlink']);

    if ($unlink || ($raw_input === '' && isset($_POST['oauth_email']))) {
        // Hapus tautan Google OAuth
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            if (strlen($id) === 36) {
                PTV_Supabase::update_by_id('ptv_kru', $id, [
                    'oauth_email'    => null,
                    'oauth_uid'      => null,
                    'oauth_provider' => null,
                ]);
            } else if (is_numeric($id)) {
                $cid = get_post_meta((int)$id, 'ptv_kru_crew_id', true);
                if ($cid) {
                    $sb_find = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($cid) . '&limit=1');
                    if (!empty($sb_find) && is_array($sb_find) && !empty($sb_find[0]['id'])) {
                        PTV_Supabase::update_by_id('ptv_kru', $sb_find[0]['id'], [
                            'oauth_email'    => null,
                            'oauth_uid'      => null,
                            'oauth_provider' => null,
                        ]);
                    }
                }
            }
        }
        if (is_numeric($id)) {
            delete_post_meta((int)$id, 'ptv_kru_allowed_emails');
            delete_post_meta((int)$id, 'ptv_oauth_uid');
            delete_post_meta((int)$id, 'ptv_oauth_provider');
        } else if (strlen($id) === 36) {
            // Temukan CPT yang bersesuaian jika ID adalah UUID
            if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
                $sb_row = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($id) . '&limit=1');
                if (!empty($sb_row) && is_array($sb_row) && !empty($sb_row[0]['crew_id'])) {
                    $cpt = get_posts(['post_type' => 'kru_ptv', 'meta_key' => 'ptv_kru_crew_id', 'meta_value' => $sb_row[0]['crew_id'], 'posts_per_page' => 1]);
                    if (!empty($cpt)) {
                        delete_post_meta($cpt[0]->ID, 'ptv_kru_allowed_emails');
                        delete_post_meta($cpt[0]->ID, 'ptv_oauth_uid');
                        delete_post_meta($cpt[0]->ID, 'ptv_oauth_provider');
                    }
                }
            }
        }
        delete_transient('ptv_crew_list_cache');
        wp_send_json_success([
            'message'        => 'Email Google berhasil dihapus dari data kru.',
            'oauth_email'    => '',
            'oauth_provider' => '',
            'oauth_uid'      => '',
        ]);
        return;
    }

    // Validasi format email
    if (!is_email($raw_input)) {
        wp_send_json_error(['message' => 'Format email Google tidak valid.']);
        return;
    }
    $raw_email = strtolower($raw_input);

    // Validasi duplikasi email di ptv_kru
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $existing_oe = PTV_Supabase::select('ptv_kru', '?select=id,nama,oauth_email&oauth_email=not.is.null&limit=1000');
        if (is_array($existing_oe)) {
            foreach ($existing_oe as $row) {
                $row_id = (string)($row['id'] ?? '');
                if ($row_id === $id) continue;
                $em_list = array_filter(array_map('trim', explode(',', strtolower((string)($row['oauth_email'] ?? '')))));
                if (in_array($raw_email, $em_list, true)) {
                    wp_send_json_error(['message' => 'Email Google sudah terhubung dengan akun kru lain (' . ($row['nama'] ?? 'Kru lain') . ').']);
                    return;
                }
            }
        }
    }

    // Simpan ke Supabase ptv_kru
    $target_crew_id = '';
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if (strlen($id) === 36) {
            PTV_Supabase::update_by_id('ptv_kru', $id, [
                'oauth_email'    => $raw_email,
                'oauth_provider' => 'google',
            ]);
            $sb_cur = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($id) . '&limit=1');
            if (!empty($sb_cur) && is_array($sb_cur) && !empty($sb_cur[0]['crew_id'])) {
                $target_crew_id = $sb_cur[0]['crew_id'];
            }
        } else if (is_numeric($id)) {
            $cid = get_post_meta((int)$id, 'ptv_kru_crew_id', true);
            $target_crew_id = $cid;
            if ($cid) {
                $sb_find = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($cid) . '&limit=1');
                if (!empty($sb_find) && is_array($sb_find) && !empty($sb_find[0]['id'])) {
                    PTV_Supabase::update_by_id('ptv_kru', $sb_find[0]['id'], [
                        'oauth_email'    => $raw_email,
                        'oauth_provider' => 'google',
                    ]);
                }
            }
        }
    }

    // Sinkronisasi ke CPT kru_ptv
    if (is_numeric($id)) {
        update_post_meta((int)$id, 'ptv_kru_allowed_emails', $raw_email);
        update_post_meta((int)$id, 'ptv_oauth_provider', 'google');
    } else if (!empty($target_crew_id)) {
        $cpt = get_posts(['post_type' => 'kru_ptv', 'meta_key' => 'ptv_kru_crew_id', 'meta_value' => $target_crew_id, 'posts_per_page' => 1]);
        if (!empty($cpt)) {
            update_post_meta($cpt[0]->ID, 'ptv_kru_allowed_emails', $raw_email);
            update_post_meta($cpt[0]->ID, 'ptv_oauth_provider', 'google');
        }
    }

    delete_transient('ptv_crew_list_cache');

    wp_send_json_success([
        'message'        => 'Email Google berhasil didaftarkan untuk kru ini.',
        'oauth_email'    => $raw_email,
        'oauth_provider' => 'google',
        'oauth_uid'      => '', // Kosong karena menunggu login Google pertama
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_delete_crew', 'ptv_dashboard_action_delete_crew_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_crew', 'ptv_dashboard_action_delete_crew_cb');
function ptv_dashboard_action_delete_crew_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif yang memiliki izin menghapus data kru.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID kru wajib diisi.']);
        return;
    }

    // 1. Hapus permanen dari Supabase ptv_kru (Single Source of Truth)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if (strlen($id) === 36) {
            PTV_Supabase::delete_by_id('ptv_kru', $id);
        } else {
            PTV_Supabase::delete('ptv_kru', '?id=eq.' . urlencode($id));
        }
    }

    // 2. Hapus juga dari database lokal WordPress jika ada CPT terkait
    if (is_numeric($id)) {
        wp_delete_post((int)$id, true);
    } else {
        $cpt = get_posts(['post_type' => 'kru_ptv', 'meta_key' => 'ptv_kru_sb_id', 'meta_value' => $id, 'posts_per_page' => 1]);
        if (!empty($cpt)) {
            wp_delete_post($cpt[0]->ID, true);
        }
    }

    ptv_realtime_broadcast_change('ptv_kru', 'crew', 'DELETE', $id);

    wp_send_json_success(['message' => 'Data kru berhasil dihapus permanen dari database.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: AKTIVASI AKUN KRU BARU (Auto-generate credentials)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_activate_crew_account', 'ptv_dashboard_action_activate_crew_account_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_activate_crew_account', 'ptv_dashboard_action_activate_crew_account_cb');
function ptv_dashboard_action_activate_crew_account_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif yang memiliki izin mengaktifkan akun kru.']);
        return;
    }

    $crew_id = sanitize_text_field($_POST['crew_id'] ?? '');
    if (empty($crew_id)) {
        wp_send_json_error(['message' => 'ID kru wajib diisi.']);
        return;
    }

    $existing_data = null;
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($crew_id) === 36) {
        $rows = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($crew_id) . '&limit=1');
        if (is_array($rows) && !empty($rows[0])) {
            $existing_data = $rows[0];
        }
    }

    if (!$existing_data) {
        wp_send_json_error(['message' => 'Data kru tidak ditemukan.']);
    }

    // Jika sudah punya username, tidak perlu diaktifkan lagi
    if (!empty($existing_data['username'])) {
        wp_send_json_error(['message' => 'Kru ini sudah memiliki akun portal (@' . $existing_data['username'] . ').']);
    }

    $nama = (string)($existing_data['nama'] ?? '');
    $nama_parts = preg_split('/\s+/', trim($nama));
    $kata1 = !empty($nama_parts[0]) ? strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $nama_parts[0])) : 'kru';
    $username = $kata1 ?: 'kru' . rand(100, 999);
    $password_default = $kata1 ?: 'ptv123';

    // Auto-generate PTV ID
    $ptv_id = '';
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $all_ids = PTV_Supabase::select('ptv_kru', '?select=crew_id&crew_id=not.is.null');
        $max_num = 0;
        if (is_array($all_ids)) {
            foreach ($all_ids as $item) {
                if (preg_match('/PTV-(\d+)/', $item['crew_id'] ?? '', $m)) {
                    $max_num = max($max_num, (int)$m[1]);
                }
            }
        }
        $ptv_id = 'PTV-' . str_pad($max_num + 1, 3, '0', STR_PAD_LEFT);
    }
    if (empty($ptv_id)) $ptv_id = 'PTV-' . rand(100, 999);

    $password_hash = password_hash($password_default, PASSWORD_BCRYPT);

    $update_data = [
        'username'      => $username,
        'password_hash' => $password_hash,
        'crew_id'       => $ptv_id,
        'status'        => 'aktif',
    ];

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::update_by_id('ptv_kru', $crew_id, $update_data);
    }

    ptv_realtime_broadcast_change('ptv_kru', 'crew', 'UPDATE', $crew_id, ['username' => $username, 'crew_id' => $ptv_id]);

    wp_send_json_success([
        'message'          => 'Akun kru berhasil diaktifkan.',
        'username'         => $username,
        'ptvId'            => $ptv_id,
        'password_default' => $password_default,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: DELETE ACARA & UPDATE STATUS ACARA (ptv_acara)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_event', 'ptv_dashboard_action_delete_event_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_event', 'ptv_dashboard_action_delete_event_cb');
function ptv_dashboard_action_delete_event_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error('ID acara wajib diisi.');
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        $del = PTV_Supabase::delete_by_id('ptv_acara', $id);
        if (is_wp_error($del)) {
            wp_send_json_error('Gagal menghapus acara dari Supabase: ' . $del->get_error_message());
        }
    } elseif (is_numeric($id)) {
        wp_delete_post((int)$id, true);
    }

    ptv_realtime_broadcast_change('ptv_acara', 'events', 'DELETE', $id);

    wp_send_json_success(['message' => 'Acara berhasil dihapus dari database.']);
}

add_action('wp_ajax_ptv_dashboard_action_update_event_status', 'ptv_dashboard_action_update_event_status_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_update_event_status', 'ptv_dashboard_action_update_event_status_cb');
function ptv_dashboard_action_update_event_status_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $id        = sanitize_text_field($_POST['id'] ?? '');
    $status_in = strtolower(trim(sanitize_text_field($_POST['status'] ?? 'terjadwal')));
    if (empty($id)) {
        wp_send_json_error('ID acara wajib diisi.');
        return;
    }

    // Map status to Supabase ptv_acara_status_check constraint ('draft', 'aktif', 'selesai', 'batal')
    $sb_status = 'aktif';
    if ($status_in === 'selesai' || $status_in === 'completed') {
        $sb_status = 'selesai';
    } elseif ($status_in === 'batal' || $status_in === 'cancelled') {
        $sb_status = 'batal';
    } elseif ($status_in === 'draft') {
        $sb_status = 'draft';
    } else {
        $sb_status = 'aktif';
    }

    $detail_status = ($status_in === 'berjalan' || $status_in === 'ongoing') ? 'Berjalan' : ($sb_status === 'selesai' ? 'Selesai' : ($sb_status === 'batal' ? 'Batal' : 'Terjadwal'));

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        $existing = PTV_Supabase::find('ptv_acara', $id);
        $desc = (is_array($existing) && isset($existing['deskripsi'])) ? $existing['deskripsi'] : '';
        $meta = [];
        if (preg_match('/<!-- PTV_META:\s*({.+?})\s*-->/s', $desc, $m)) {
            $meta = json_decode($m[1], true) ?: [];
            $desc = trim(str_replace($m[0], '', $desc));
        }
        $meta['status_detail'] = $detail_status;
        $new_desc = "<!-- PTV_META: " . wp_json_encode($meta) . " -->\n" . $desc;

        $upd = PTV_Supabase::update_by_id('ptv_acara', $id, [
            'status'     => $sb_status,
            'deskripsi'  => $new_desc,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
        if (is_wp_error($upd)) {
            wp_send_json_error('Gagal memperbarui status acara di Supabase: ' . $upd->get_error_message());
            return;
        }
    } elseif (is_numeric($id)) {
        update_post_meta((int)$id, 'ptv_acara_status', $detail_status);
    }

    ptv_realtime_broadcast_change('ptv_acara', 'events', 'UPDATE', $id, ['status' => $detail_status]);

    wp_send_json_success([
        'message' => 'Status acara berhasil diperbarui.',
        'status'  => $detail_status,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: FULL CRUD KEUANGAN (Supabase ptv_keuangan)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_finance', 'ptv_dashboard_action_save_finance_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_finance', 'ptv_dashboard_action_save_finance_cb');
function ptv_dashboard_action_save_finance_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    if (function_exists('ptv_can_access_keuangan') && !ptv_can_access_keuangan()) {
        wp_send_json_error('Hanya Eksekutif dan Bendahara yang berwenang memodifikasi data keuangan.');
        return;
    }
    $id_raw = sanitize_text_field($_POST['id'] ?? '');
    // ID Supabase adalah UUID (string), bukan integer
    $uuid   = (strlen($id_raw) === 36 && substr_count($id_raw, '-') === 4) ? $id_raw : '';
    $no     = sanitize_text_field($_POST['no'] ?? '');
    $type   = sanitize_text_field($_POST['type'] ?? 'Kuitansi');
    $client = sanitize_text_field($_POST['client'] ?? '');
    $amount = intval(preg_replace('/[^0-9]/', '', (string)($_POST['amount'] ?? '0')));
    $date   = sanitize_text_field($_POST['date'] ?? date('Y-m-d'));
    $status = sanitize_text_field($_POST['status'] ?? 'Menunggu');
    $notes  = sanitize_textarea_field($_POST['notes'] ?? '');

    if (empty($client)) {
        wp_send_json_error('Nama klien wajib diisi.');
        return;
    }
    if (empty($no)) {
        $prefix = ($type === 'Quotation') ? 'PTV/QT/' : (($type === 'Invoice') ? 'PTV/INV/' : 'PTV/KW/');
        $no = $prefix . rand(100, 999);
    }

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error('Supabase belum dikonfigurasi.');
        return;
    }

    $data = [
        'no'     => $no,
        'type'   => $type,
        'client' => $client,
        'amount' => $amount,
        'date'   => $date,
        'status' => $status,
        'notes'  => $notes,
    ];

    if (!empty($uuid)) {
        $res = PTV_Supabase::update_by_id('ptv_keuangan', $uuid, $data);
        $res_id = $uuid;
    } else {
        $res = PTV_Supabase::insert('ptv_keuangan', $data);
        $res_id = is_array($res) ? (string)($res[0]['id'] ?? ($res['id'] ?? '')) : '';
    }

    if (is_wp_error($res)) {
        wp_send_json_error($res->get_error_message());
        return;
    }

    ptv_realtime_broadcast_change('ptv_keuangan', 'finance', !empty($uuid) ? 'UPDATE' : 'INSERT', $res_id, ['client' => $client, 'amount' => $amount]);

    wp_send_json_success([
        'message' => 'Transaksi berhasil disimpan.',
        'finance' => [
            'id'     => $res_id,
            'no'     => $no,
            'type'   => $type,
            'client' => $client,
            'amount' => $amount,
            'date'   => $date,
            'status' => $status,
            'notes'  => $notes,
        ]
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_update_finance_status', 'ptv_dashboard_action_update_finance_status_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_update_finance_status', 'ptv_dashboard_action_update_finance_status_cb');
function ptv_dashboard_action_update_finance_status_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    if (function_exists('ptv_can_access_keuangan') && !ptv_can_access_keuangan()) {
        wp_send_json_error('Hanya Eksekutif dan Bendahara yang berwenang memodifikasi data keuangan.');
        return;
    }
    $uuid   = sanitize_text_field($_POST['id'] ?? '');
    $status = sanitize_text_field($_POST['status'] ?? 'Lunas');

    if (!empty($uuid) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::update_by_id('ptv_keuangan', $uuid, ['status' => $status]);
        ptv_realtime_broadcast_change('ptv_keuangan', 'finance', 'UPDATE', $uuid, ['status' => $status]);
    }
    wp_send_json_success(['message' => 'Status pembayaran berhasil diperbarui.']);
}

add_action('wp_ajax_ptv_dashboard_action_delete_finance', 'ptv_dashboard_action_delete_finance_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_finance', 'ptv_dashboard_action_delete_finance_cb');
function ptv_dashboard_action_delete_finance_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    if (function_exists('ptv_can_access_keuangan') && !ptv_can_access_keuangan()) {
        wp_send_json_error('Hanya Eksekutif dan Bendahara yang berwenang memodifikasi data keuangan.');
        return;
    }
    $uuid = sanitize_text_field($_POST['id'] ?? '');

    if (!empty($uuid) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::delete_by_id('ptv_keuangan', $uuid);
        ptv_realtime_broadcast_change('ptv_keuangan', 'finance', 'DELETE', $uuid);
    }
    wp_send_json_success(['message' => 'Catatan keuangan berhasil dihapus.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: FULL CRUD JADWAL KONTEN (Supabase ptv_konten)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_content', 'ptv_dashboard_action_save_content_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_content', 'ptv_dashboard_action_save_content_cb');
function ptv_dashboard_action_save_content_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $id_raw   = sanitize_text_field($_POST['id'] ?? '');
    // ID Supabase adalah UUID (string)
    $uuid     = (strlen($id_raw) === 36 && substr_count($id_raw, '-') === 4) ? $id_raw : '';
    $title    = sanitize_text_field($_POST['title'] ?? '');
    $platform = sanitize_text_field($_POST['platform'] ?? 'Instagram');
    $date     = sanitize_text_field($_POST['date'] ?? date('Y-m-d'));
    $status   = sanitize_text_field($_POST['status'] ?? 'Draft');
    $notes    = sanitize_textarea_field($_POST['notes'] ?? '');

    if (empty($title)) {
        wp_send_json_error('Judul konten wajib diisi.');
    }
    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error('Supabase belum dikonfigurasi.');
    }

    $data = [
        'title'    => $title,
        'platform' => $platform,
        'date'     => $date,
        'status'   => $status,
        'notes'    => $notes,
    ];

    if (!empty($uuid)) {
        $res = PTV_Supabase::update_by_id('ptv_konten', $uuid, $data);
        $res_id = $uuid;
    } else {
        $res = PTV_Supabase::insert('ptv_konten', $data);
        $res_id = is_array($res) ? (string)($res[0]['id'] ?? ($res['id'] ?? '')) : '';
    }

    if (is_wp_error($res)) {
        wp_send_json_error($res->get_error_message());
        return;
    }

    ptv_realtime_broadcast_change('ptv_konten', 'contents', !empty($uuid) ? 'UPDATE' : 'INSERT', $res_id, ['title' => $title, 'status' => $status]);

    wp_send_json_success([
        'message' => 'Jadwal konten berhasil disimpan.',
        'content' => [
            'id'       => $res_id,
            'title'    => $title,
            'platform' => $platform,
            'date'     => $date,
            'status'   => $status,
            'notes'    => $notes,
        ]
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_update_content_status', 'ptv_dashboard_action_update_content_status_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_update_content_status', 'ptv_dashboard_action_update_content_status_cb');
function ptv_dashboard_action_update_content_status_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $uuid   = sanitize_text_field($_POST['id'] ?? '');
    $status = sanitize_text_field($_POST['status'] ?? 'Terbit');

    if (!empty($uuid) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::update_by_id('ptv_konten', $uuid, ['status' => $status]);
        ptv_realtime_broadcast_change('ptv_konten', 'contents', 'UPDATE', $uuid, ['status' => $status]);
    }
    wp_send_json_success(['message' => 'Status konten berhasil diperbarui.']);
}

add_action('wp_ajax_ptv_dashboard_action_delete_content', 'ptv_dashboard_action_delete_content_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_content', 'ptv_dashboard_action_delete_content_cb');
function ptv_dashboard_action_delete_content_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }
    $uuid = sanitize_text_field($_POST['id'] ?? '');

    if (!empty($uuid) && class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        PTV_Supabase::delete_by_id('ptv_konten', $uuid);
        ptv_realtime_broadcast_change('ptv_konten', 'contents', 'DELETE', $uuid);
    }
    wp_send_json_success(['message' => 'Jadwal konten berhasil dihapus.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLERS: CONTENT PLANNER (SUPABASE ptv_content_planner)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_planner', 'ptv_dashboard_action_save_planner_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_planner', 'ptv_dashboard_action_save_planner_cb');
function ptv_dashboard_action_save_planner_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id             = sanitize_text_field($_POST['id'] ?? '');
    $judul          = sanitize_text_field($_POST['judul_momentum'] ?? '');
    $kategori       = sanitize_text_field($_POST['kategori'] ?? 'Event Masehi');
    $subkategori    = sanitize_text_field($_POST['subkategori'] ?? '');
    $tanggal_mulai  = sanitize_text_field($_POST['tanggal_mulai'] ?? '');
    $tanggal_selesai= sanitize_text_field($_POST['tanggal_selesai'] ?? '');
    $bulan_hijriah  = sanitize_text_field($_POST['bulan_hijriah'] ?? '');
    $tanggal_hijriah= !empty($_POST['tanggal_hijriah']) ? intval($_POST['tanggal_hijriah']) : null;
    $deskripsi      = sanitize_textarea_field($_POST['deskripsi'] ?? '');
    $referensi_url  = sanitize_textarea_field($_POST['referensi_url'] ?? '');
    $jenis_konten   = sanitize_text_field($_POST['jenis_konten'] ?? '');

    $daftar_konten_raw = $_POST['daftar_konten'] ?? [];
    $daftar_konten = [];
    if (is_string($daftar_konten_raw)) {
        $json_dec = json_decode(stripslashes($daftar_konten_raw), true);
        if (is_array($json_dec)) {
            $daftar_konten_raw = $json_dec;
        }
    }
    if (is_array($daftar_konten_raw)) {
        foreach ($daftar_konten_raw as $item) {
            $val = trim(sanitize_text_field((string)$item));
            if (!empty($val)) $daftar_konten[] = $val;
        }
    } elseif (is_string($daftar_konten_raw) && !empty(trim($daftar_konten_raw))) {
        $lines = preg_split('/[\r\n]+/', trim($daftar_konten_raw));
        foreach ($lines as $line) {
            $val = trim(sanitize_text_field($line));
            if (!empty($val)) $daftar_konten[] = $val;
        }
    }

    if (empty($judul)) {
        wp_send_json_error(['message' => 'Judul momentum konten wajib diisi.']);
        return;
    }

    // Dukungan Recurring Master Rule (9 Pola Waktu)
    $recurrence_type_in = sanitize_text_field($_POST['recurrence_type'] ?? '');
    $recurrence_rule_raw = $_POST['recurrence_rule'] ?? null;
    $recurrence_rule = null;
    if (!empty($recurrence_rule_raw)) {
        if (is_string($recurrence_rule_raw)) {
            $recurrence_rule = json_decode(stripslashes($recurrence_rule_raw), true) ?: null;
        } elseif (is_array($recurrence_rule_raw)) {
            $recurrence_rule = $recurrence_rule_raw;
        }
    }
    if (!empty($recurrence_rule) && is_array($recurrence_rule)) {
        if (empty($recurrence_type_in) && !empty($recurrence_rule['type'])) {
            $recurrence_type_in = sanitize_text_field($recurrence_rule['type']);
        }
        $rec_payload = [
            'type' => $recurrence_type_in,
            'rule' => $recurrence_rule
        ];
        $clean_desc = trim(preg_replace('/<!-- PTV_RECURRENCE:.*?-->/s', '', $deskripsi));
        $deskripsi = "<!-- PTV_RECURRENCE: " . wp_json_encode($rec_payload) . " -->" . ($clean_desc ? "\n" . $clean_desc : '');
    }

    $data = [
        'judul_momentum'  => $judul,
        'kategori'        => $kategori,
        'subkategori'     => $subkategori ?: null,
        'tanggal_mulai'   => !empty($tanggal_mulai) ? $tanggal_mulai : null,
        'tanggal_selesai' => !empty($tanggal_selesai) ? $tanggal_selesai : null,
        'bulan_hijriah'   => !empty($bulan_hijriah) ? $bulan_hijriah : null,
        'tanggal_hijriah' => $tanggal_hijriah,
        'tahun_masehi'    => !empty($tanggal_mulai) ? intval(substr($tanggal_mulai, 0, 4)) : null,
        'deskripsi'       => $deskripsi ?: null,
        'daftar_konten'   => $daftar_konten,
        'jenis_konten'    => $jenis_konten ?: null,
        'referensi_url'   => $referensi_url ?: null,
        'updated_at'      => current_time('mysql', 1),
    ];

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    if (!empty($id) && strlen($id) === 36) {
        $res = PTV_Supabase::update_by_id('ptv_content_planner', $id, $data);
        if (is_wp_error($res) || isset($res['code'])) {
            $err_msg = is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal memperbarui di Supabase.');
            wp_send_json_error(['message' => $err_msg]);
            return;
        }
        $saved_id = $id;
    } else {
        $res = PTV_Supabase::insert('ptv_content_planner', $data);
        if (is_wp_error($res) || isset($res['code'])) {
            $err_msg = is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal menyimpan ke Supabase.');
            wp_send_json_error(['message' => $err_msg]);
            return;
        }
        $saved_id = (is_array($res) && !empty($res[0]['id'])) ? $res[0]['id'] : uniqid();
    }

    $planner_item = [
        'id'              => (string)$saved_id,
        'judul_momentum'  => $judul,
        'kategori'        => $kategori,
        'subkategori'     => $subkategori,
        'tanggal_mulai'   => (string)$tanggal_mulai,
        'tanggal_selesai' => (string)$tanggal_selesai,
        'bulan_hijriah'   => (string)$bulan_hijriah,
        'tanggal_hijriah' => $tanggal_hijriah,
        'tahun_masehi'    => !empty($tanggal_mulai) ? intval(substr($tanggal_mulai, 0, 4)) : null,
        'deskripsi'       => trim(preg_replace('/<!-- PTV_RECURRENCE:.*?-->/s', '', $deskripsi)),
        'recurrence_type' => $recurrence_type_in,
        'recurrence_rule' => $recurrence_rule,
        'daftar_konten'   => $daftar_konten,
        'jenis_konten'    => $jenis_konten,
        'referensi_url'   => $referensi_url,
    ];

    ptv_realtime_broadcast_change('ptv_content_planner', 'planner', !empty($id) ? 'UPDATE' : 'INSERT', $saved_id, ['judul' => $judul]);

    wp_send_json_success([
        'message' => 'Data Content Planner berhasil disimpan ke Supabase.',
        'planner' => $planner_item
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_delete_planner', 'ptv_dashboard_action_delete_planner_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_planner', 'ptv_dashboard_action_delete_planner_cb');
function ptv_dashboard_action_delete_planner_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID planner wajib diisi.']);
        return;
    }

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    if (strlen($id) === 36) {
        $res = PTV_Supabase::delete_by_id('ptv_content_planner', $id);
    } else {
        $res = PTV_Supabase::delete('ptv_content_planner', '?id=eq.' . urlencode($id));
    }

    if (is_wp_error($res)) {
        wp_send_json_error(['message' => $res->get_error_message()]);
        return;
    }

    ptv_realtime_broadcast_change('ptv_content_planner', 'planner', 'DELETE', $id);

    wp_send_json_success(['message' => 'Data planner berhasil dihapus permanen dari Supabase.']);
}

add_action('wp_ajax_ptv_dashboard_action_seed_planner', 'ptv_dashboard_action_seed_planner_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_seed_planner', 'ptv_dashboard_action_seed_planner_cb');
function ptv_dashboard_action_seed_planner_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec  = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya admin/eksekutif yang dapat menjalankan seed data.']);
        return;
    }

    $seed_file = get_stylesheet_directory() . '/includes/seed_content_planner.php';
    if (!file_exists($seed_file)) {
        $seed_file = dirname(__DIR__, 4) . '/.gemini/antigravity-ide/brain/ce4a7519-794c-4c6e-8f65-2dd857236f41/scratch/seed_content_planner.php';
    }
    if (file_exists($seed_file)) {
        require_once $seed_file;
        if (function_exists('ptv_seed_content_planner_supabase')) {
            $res = ptv_seed_content_planner_supabase();
            if (!empty($res['success'])) {
                // Ambil data terbaru langsung dari Supabase
                $fresh_list = [];
                $sb_cp = PTV_Supabase::select('ptv_content_planner', '?order=tanggal_mulai.asc,created_at.asc&limit=500');
                if (is_array($sb_cp) && !is_wp_error($sb_cp) && !isset($sb_cp['code'])) {
                    foreach ($sb_cp as $cp) {
                        $raw_daftar = $cp['daftar_konten'] ?? [];
                        if (is_string($raw_daftar)) {
                            $raw_daftar = json_decode($raw_daftar, true) ?: [];
                        }
                        $fresh_list[] = [
                            'id'              => (string)($cp['id'] ?? uniqid()),
                            'judul_momentum'  => html_entity_decode((string)($cp['judul_momentum'] ?? ''), ENT_QUOTES, 'UTF-8'),
                            'kategori'        => (string)($cp['kategori'] ?? 'Event Masehi'),
                            'subkategori'     => (string)($cp['subkategori'] ?? ''),
                            'tanggal_mulai'   => (string)($cp['tanggal_mulai'] ?? ''),
                            'tanggal_selesai' => (string)($cp['tanggal_selesai'] ?? ''),
                            'bulan_hijriah'   => (string)($cp['bulan_hijriah'] ?? ''),
                            'tanggal_hijriah' => !empty($cp['tanggal_hijriah']) ? intval($cp['tanggal_hijriah']) : null,
                            'tahun_masehi'    => !empty($cp['tahun_masehi']) ? intval($cp['tahun_masehi']) : null,
                            'deskripsi'       => (string)($cp['deskripsi'] ?? ''),
                            'daftar_konten'   => is_array($raw_daftar) ? $raw_daftar : [],
                            'jenis_konten'    => (string)($cp['jenis_konten'] ?? ''),
                            'referensi_url'   => (string)($cp['referensi_url'] ?? ''),
                            'created_at'      => (string)($cp['created_at'] ?? ''),
                        ];
                    }
                }
                $res['planner_list'] = $fresh_list;
                wp_send_json_success($res);
            } else {
                wp_send_json_error([
                    'message' => $res['message'] ?? 'Gagal melakukan seed ke Supabase.',
                    'details' => $res
                ]);
            }
            return;
        }
    }

    wp_send_json_error(['message' => 'Fungsi seeder tidak ditemukan.']);
}

// ────────────────────────────────────────────────────────────
// AJAX HANDLERS: MODUL KEUANGAN PTV (SUPABASE SINGLE SOURCE OF TRUTH)
// ────────────────────────────────────────────────────────────

if (!function_exists('ptv_can_access_keuangan')) {
    function ptv_can_access_keuangan() {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['ptv_admin_logged_in']) && empty($_SESSION['ptv_crew_logged_in']) && empty($_SESSION['ptv_kru_sb_id']) && !is_user_logged_in()) {
            return false;
        }

        $sb_uuid  = $_SESSION['ptv_kru_sb_id'] ?? ($_SESSION['ptv_crew_supabase_id'] ?? '');
        $ptv_id   = trim((string)($_SESSION['ptv_crew_id'] ?? ($_SESSION['ptv_crew_ptv_id'] ?? '')));
        $username = strtolower(trim((string)($_SESSION['ptv_crew_username'] ?? '')));
        $name     = strtolower(trim((string)($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? ''))));
        $role     = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
        $status   = '';
        $pos      = '';
        $div      = strtolower(trim((string)($_SESSION['ptv_crew_divisi'] ?? '')));

        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_me = null;
            if (!empty($sb_uuid) && strlen($sb_uuid) === 36 && strpos($sb_uuid, 'cpt:') !== 0) {
                $r = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($sb_uuid) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if (!$sb_me && !empty($username)) {
                $r = PTV_Supabase::select('ptv_kru', '?username=ilike.' . urlencode($username) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if (!$sb_me && !empty($ptv_id)) {
                $r = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($ptv_id) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if ($sb_me) {
                $status   = strtolower(trim((string)($sb_me['status'] ?? '')));
                $pos      = strtolower(trim((string)($sb_me['jabatan'] ?? ($sb_me['posisi'] ?? ''))));
                $div      = strtolower(trim((string)($sb_me['divisi'] ?? $div)));
                $role     = strtolower(trim((string)($sb_me['role'] ?? $role)));
                $name     = strtolower(trim((string)($sb_me['nama'] ?? $name)));
                $ptv_id   = trim((string)($sb_me['crew_id'] ?? $ptv_id));
                $username = strtolower(trim((string)($sb_me['username'] ?? $username)));
            }
        }

        // FAIL-CLOSED: Jika status kru bukan aktif, tolak total
        if ($status !== 'aktif') {
            return false;
        }

        // Tolak jika Pengarah, Pembina, Penasihat, Dewan Pendiri & Pengasuh
        if (in_array($role, ['pembina', 'pengarah', 'penasihat', 'member', 'non-operasional', 'tamu'], true)) {
            return false;
        }
        if (in_array($div, ['pembina', 'pengarah', 'penasihat'], true)) {
            return false;
        }
        if (preg_match('/pembina|pengarah|penasihat|pendiri|pengasuh/i', $pos)) {
            return false;
        }

        // 1. Eksekutif Aktif murni dari ptv_kru.role
        if ($role === 'eksekutif' || $role === 'executive') {
            return true;
        }

        // 2. Farsya Aktif (PTV-023)
        if (strcasecmp($ptv_id, 'PTV-023') === 0 || $username === 'farsya') {
            return true;
        }

        // 3. Kru Operasional Aktif murni dari ptv_kru.role ('kru' atau 'administrasi')
        if ($role === 'kru' || $role === 'crew' || $role === 'administrasi') {
            return true;
        }

        // FAIL-CLOSED: Role lain yang tidak dikenal ditolak
        return false;
    }
}

if (!function_exists('ptv_fmt_periode_bulan')) {
    function ptv_fmt_periode_bulan($ym) {
        if (!$ym) return '';
        $parts = explode('-', $ym);
        if (count($parts) < 2) return $ym;
        $months = [
            '01' => 'Januari', '02' => 'Februari', '03' => 'Maret',
            '04' => 'April', '05' => 'Mei', '06' => 'Juni',
            '07' => 'Juli', '08' => 'Agustus', '09' => 'September',
            '10' => 'Oktober', '11' => 'November', '12' => 'Desember'
        ];
        $m = $months[$parts[1]] ?? $parts[1];
        return $m . ' ' . $parts[0];
    }
}

if (!function_exists('ptv_is_keuangan_admin')) {
    function ptv_is_keuangan_admin() {
        if (session_status() === PHP_SESSION_NONE) session_start();
        $sb_uuid  = $_SESSION['ptv_kru_sb_id'] ?? '';
        $role     = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? ($_SESSION['ptv_crew_role'] ?? ''))));
        $ptv_id   = trim((string)($_SESSION['ptv_crew_ptv_id'] ?? ($_SESSION['ptv_crew_id'] ?? '')));
        $username = strtolower(trim((string)($_SESSION['ptv_crew_username'] ?? '')));
        $name     = strtolower(trim((string)($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? ''))));

        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
            $sb_me = null;
            if (!empty($sb_uuid) && strlen($sb_uuid) === 36 && strpos($sb_uuid, 'cpt:') !== 0) {
                $r = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($sb_uuid) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if (!$sb_me && !empty($username)) {
                $r = PTV_Supabase::select('ptv_kru', '?username=ilike.' . urlencode($username) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if (!$sb_me && !empty($ptv_id)) {
                $r = PTV_Supabase::select('ptv_kru', '?crew_id=eq.' . urlencode($ptv_id) . '&limit=1');
                if (!empty($r) && is_array($r) && !empty($r[0]['id'])) $sb_me = $r[0];
            }
            if ($sb_me) {
                $role     = strtolower(trim((string)($sb_me['role'] ?? $role)));
                $ptv_id   = trim((string)($sb_me['crew_id'] ?? $ptv_id));
                $username = strtolower(trim((string)($sb_me['username'] ?? $username)));
                $name     = strtolower(trim((string)($sb_me['nama'] ?? $name)));
            }
        }

        // 1. Eksekutif Aktif murni dari ptv_kru.role
        if ($role === 'eksekutif' || $role === 'executive') return true;

        // Administrator WordPress
        if (function_exists('current_user_can') && current_user_can('manage_options')) return true;

        // 2. Farsya Aktif (PTV-023, username farsya, atau nama Farsya)
        if (strcasecmp($ptv_id, 'PTV-023') === 0 || $username === 'farsya' || strpos($name, 'farsya') !== false) return true;

        return false;
    }
}

// 1. Simpan Pemasukan
add_action('wp_ajax_ptv_dashboard_action_save_pemasukan', 'ptv_dashboard_action_save_pemasukan_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_pemasukan', 'ptv_dashboard_action_save_pemasukan_cb');
function ptv_dashboard_action_save_pemasukan_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang mengelola data pemasukan.']);
        return;
    }

    $id         = sanitize_text_field($_POST['id'] ?? '');
    $tanggal    = sanitize_text_field($_POST['tanggal'] ?? date('Y-m-d'));
    $sumber     = sanitize_text_field($_POST['sumber'] ?? 'Donasi');
    $kategori   = sanitize_text_field($_POST['kategori'] ?? 'Donasi');
    $nominal    = max(0, intval($_POST['nominal'] ?? 0));
    $keterangan = sanitize_textarea_field($_POST['keterangan'] ?? '');
    $kru_id     = sanitize_text_field($_POST['kru_id'] ?? '');
    $kru_nama   = sanitize_text_field($_POST['kru_nama'] ?? '');
    $bukti_url  = esc_url_raw($_POST['bukti_url'] ?? '');
    $status     = sanitize_text_field($_POST['status'] ?? 'verified');

    // Validasi: Iuran Kas Kru TIDAK boleh diinput manual
    if (strcasecmp($kategori, 'Iuran Kas') === 0 || strcasecmp($sumber, 'Kas Kru') === 0) {
        wp_send_json_error(['message' => 'Pemasukan dari iuran kas kru tidak boleh diinput manual. Gunakan tombol "Tandai Sudah Bayar" pada tabel iuran kas kru agar tercatat otomatis.']);
        return;
    }

    if ($nominal <= 0) {
        wp_send_json_error(['message' => 'Nominal pemasukan harus lebih besar dari 0.']);
        return;
    }

    $admin_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Admin Keuangan');
    $admin_id   = $_SESSION['ptv_crew_supabase_id'] ?? ($_SESSION['ptv_crew_id'] ?? null);

    $payload = [
        'tanggal'           => $tanggal,
        'sumber'            => $sumber,
        'kategori'          => $kategori,
        'nominal'           => $nominal,
        'keterangan'        => $keterangan ?: null,
        'kru_id'            => (!empty($kru_id) && strlen($kru_id) === 36) ? $kru_id : null,
        'kru_nama'          => $kru_nama ?: null,
        'dicatat_oleh_id'   => (!empty($admin_id) && strlen((string)$admin_id) === 36) ? $admin_id : null,
        'dicatat_oleh_nama' => $admin_name,
        'bukti_url'         => $bukti_url ?: null,
        'status'            => $status ?: 'verified',
        'updated_at'        => current_time('mysql', 1),
    ];

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    if (!empty($id)) {
        $res = PTV_Supabase::update_by_id('ptv_pemasukan', $id, $payload);
        if (is_wp_error($res) || isset($res['code'])) {
            wp_send_json_error(['message' => is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal memperbarui di Supabase.')]);
            return;
        }
        $saved_id = $id;
    } else {
        $res = PTV_Supabase::insert('ptv_pemasukan', $payload);
        if (is_wp_error($res) || isset($res['code'])) {
            wp_send_json_error(['message' => is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal menyimpan ke Supabase.')]);
            return;
        }
        $saved_id = (is_array($res) && !empty($res[0]['id'])) ? $res[0]['id'] : uniqid();
    }

    $out_item = array_merge(['id' => $saved_id], $payload);
    wp_send_json_success(['item' => $out_item, 'message' => (!empty($id) ? 'Data pemasukan berhasil diperbarui di Supabase.' : 'Pemasukan berhasil dicatat di Supabase.')]);
}

// 2. Simpan Pengeluaran
add_action('wp_ajax_ptv_dashboard_action_save_pengeluaran', 'ptv_dashboard_action_save_pengeluaran_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_pengeluaran', 'ptv_dashboard_action_save_pengeluaran_cb');
function ptv_dashboard_action_save_pengeluaran_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang mengelola data pengeluaran.']);
        return;
    }

    $id         = sanitize_text_field($_POST['id'] ?? '');
    $tanggal    = sanitize_text_field($_POST['tanggal'] ?? date('Y-m-d'));
    $keperluan  = sanitize_text_field($_POST['keperluan'] ?? '');
    $kategori   = sanitize_text_field($_POST['kategori'] ?? 'Operasional');
    $nominal    = max(0, intval($_POST['nominal'] ?? 0));
    $keterangan = sanitize_textarea_field($_POST['keterangan'] ?? '');
    $bukti_url  = esc_url_raw($_POST['bukti_url'] ?? '');
    $status     = sanitize_text_field($_POST['status'] ?? 'verified');

    if (empty($keperluan)) {
        wp_send_json_error(['message' => 'Keperluan pengeluaran wajib diisi.']);
        return;
    }
    if ($nominal <= 0) {
        wp_send_json_error(['message' => 'Nominal pengeluaran harus lebih besar dari 0.']);
        return;
    }

    $admin_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Admin Keuangan');
    $admin_id   = $_SESSION['ptv_crew_supabase_id'] ?? ($_SESSION['ptv_crew_id'] ?? null);

    $payload = [
        'tanggal'           => $tanggal,
        'keperluan'         => $keperluan,
        'kategori'          => $kategori,
        'nominal'           => $nominal,
        'keterangan'        => $keterangan ?: null,
        'dicatat_oleh_id'   => (!empty($admin_id) && strlen((string)$admin_id) === 36) ? $admin_id : null,
        'dicatat_oleh_nama' => $admin_name,
        'bukti_url'         => $bukti_url ?: null,
        'status'            => $status ?: 'verified',
        'updated_at'        => current_time('mysql', 1),
    ];

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    if (!empty($id)) {
        $res = PTV_Supabase::update_by_id('ptv_pengeluaran', $id, $payload);
        if (is_wp_error($res) || isset($res['code'])) {
            wp_send_json_error(['message' => is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal memperbarui di Supabase.')]);
            return;
        }
        $saved_id = $id;
    } else {
        $res = PTV_Supabase::insert('ptv_pengeluaran', $payload);
        if (is_wp_error($res) || isset($res['code'])) {
            wp_send_json_error(['message' => is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal menyimpan ke Supabase.')]);
            return;
        }
        $saved_id = (is_array($res) && !empty($res[0]['id'])) ? $res[0]['id'] : uniqid();
    }

    $out_item = array_merge(['id' => $saved_id], $payload);
    wp_send_json_success(['item' => $out_item, 'message' => (!empty($id) ? 'Data pengeluaran berhasil diperbarui di Supabase.' : 'Pengeluaran berhasil dicatat di Supabase.')]);
}

// 3. Catat Pembayaran Kas Kru (One-Click "Tandai Sudah Bayar" + Auto Transaksi Pemasukan)
add_action('wp_ajax_ptv_dashboard_action_bayar_kas_kru', 'ptv_dashboard_action_bayar_kas_kru_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_bayar_kas_kru', 'ptv_dashboard_action_bayar_kas_kru_cb');
function ptv_dashboard_action_bayar_kas_kru_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang menandai pembayaran kas.']);
        return;
    }

    $kru_id        = sanitize_text_field($_POST['kru_id'] ?? '');
    $kru_nama      = sanitize_text_field($_POST['kru_nama'] ?? '');
    $kru_ptv_id    = sanitize_text_field($_POST['kru_ptv_id'] ?? '');
    $periode_bulan = sanitize_text_field($_POST['periode_bulan'] ?? date('Y-m'));
    $nominal_input = intval($_POST['nominal'] ?? 0);
    $tanggal_bayar = current_time('mysql', 0); // Waktu persis saat tindakan dilakukan
    $admin_name    = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Admin Keuangan');
    $admin_id      = $_SESSION['ptv_crew_supabase_id'] ?? ($_SESSION['ptv_crew_id'] ?? null);

    if (empty($kru_id)) {
        wp_send_json_error(['message' => 'Data kru wajib disertakan.']);
        return;
    }
    if (!preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/', $periode_bulan)) {
        wp_send_json_error(['message' => 'Periode iuran tidak valid.']);
        return;
    }
    if ($periode_bulan < '2026-06') {
        wp_send_json_error(['message' => 'Sistem iuran dimulai paling awal dari Juni 2026.']);
        return;
    }

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    // Auto-resolve kru_ptv_id jika belum ada
    if (empty($kru_ptv_id)) {
        if (strlen($kru_id) === 36) {
            $c_row = PTV_Supabase::select('ptv_kru', '?id=eq.' . urlencode($kru_id) . '&limit=1');
            if (!empty($c_row[0]['crew_id'])) {
                $kru_ptv_id = (string)$c_row[0]['crew_id'];
            }
        }
        if (empty($kru_ptv_id) && !empty($kru_nama)) {
            $c_row = PTV_Supabase::select('ptv_kru', '?nama=ilike.' . urlencode($kru_nama) . '&limit=1');
            if (!empty($c_row[0]['crew_id'])) {
                $kru_ptv_id = (string)$c_row[0]['crew_id'];
            }
        }
    }

    // Ambil nominal resmi dari ptv_kas_periode
    $nominal = $nominal_input;
    if ($nominal <= 0) {
        $sb_rate = PTV_Supabase::select('ptv_kas_periode', '?periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
        if (is_array($sb_rate) && !empty($sb_rate[0]['nominal'])) {
            $nominal = intval($sb_rate[0]['nominal']);
        } else {
            // Fallback default per periode (dimulai dari Juli 2026)
            $nominal = ($periode_bulan === '2026-07') ? 20000 : 25000;
        }
    }
    $tagihan = $nominal;

    // 1. Cek apakah kru sudah pernah membayar sebagian / cek existing kas
    $check = PTV_Supabase::select('ptv_kas_kru', '?kru_id=eq.' . urlencode($kru_id) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    if ((!is_array($check) || empty($check[0])) && !empty($kru_ptv_id)) {
        $check = PTV_Supabase::select('ptv_kas_kru', '?kru_ptv_id=eq.' . urlencode($kru_ptv_id) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    }
    if ((!is_array($check) || empty($check[0])) && !empty($kru_nama)) {
        $check = PTV_Supabase::select('ptv_kas_kru', '?kru_nama=ilike.' . urlencode($kru_nama) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    }
    $existing = (is_array($check) && !empty($check[0])) ? $check[0] : null;

    if ($existing && ($existing['status'] === 'Lunas' || intval($existing['dibayar'] ?? 0) >= $tagihan)) {
        wp_send_json_error(['message' => 'Iuran ' . $kru_nama . ' periode ' . $periode_bulan . ' sudah berstatus LUNAS di Supabase.']);
        return;
    }

    $previously_paid = intval($existing['dibayar'] ?? 0);
    $bayar_sekarang  = max(0, $nominal - $previously_paid);
    if ($bayar_sekarang <= 0) {
        $bayar_sekarang = $nominal;
    }

    $periode_label = ptv_fmt_periode_bulan($periode_bulan);
    $nom_formatted = number_format($bayar_sekarang, 0, ',', '.');
    $keterangan_resmi = ($previously_paid > 0)
        ? ('Iuran Kas Kru (Pelunasan) — ' . $kru_nama . ' — ' . $periode_label . ' — Rp' . $nom_formatted)
        : ('Iuran Kas Kru — ' . $kru_nama . ' — ' . $periode_label . ' — Rp' . $nom_formatted);

    $pemasukan_id = null;
    $pemasukan_record = null;
    $is_new_pemasukan = false;

    // Selalu buat transaksi pemasukan baru yang berstatus verified untuk pembayaran periode ini
    $pem_payload = [
        'tanggal'           => substr($tanggal_bayar, 0, 10),
        'sumber'            => 'Kas Kru',
        'kategori'          => 'Iuran Kas',
        'nominal'           => $bayar_sekarang,
        'keterangan'        => $keterangan_resmi,
        'kru_id'            => strlen($kru_id) === 36 ? $kru_id : null,
        'kru_nama'          => $kru_nama ?: null,
        'dicatat_oleh_id'   => (!empty($admin_id) && strlen((string)$admin_id) === 36) ? $admin_id : null,
        'dicatat_oleh_nama' => $admin_name,
        'bukti_url'         => null,
        'status'            => 'verified',
        'created_at'        => current_time('mysql', 1),
        'updated_at'        => current_time('mysql', 1),
    ];
    $pem_res = PTV_Supabase::insert('ptv_pemasukan', $pem_payload);
    if (is_wp_error($pem_res) || !is_array($pem_res) || empty($pem_res[0]['id'])) {
        $err_msg = is_wp_error($pem_res) ? $pem_res->get_error_message() : ($pem_res['message'] ?? 'Gagal membuat transaksi pemasukan di Supabase.');
        wp_send_json_error(['message' => 'Gagal mencatat pemasukan kas: ' . $err_msg]);
        return;
    }
    $pemasukan_id = $pem_res[0]['id'];
    $pemasukan_record = $pem_res[0];
    $is_new_pemasukan = true;

    // 2. Simpan status Lunas pada ptv_kas_kru
    // PENTING: DILARANG MENGIRIM FIELD 'sisa' KARENA 'sisa' ADALAH GENERATED ALWAYS AS (tagihan - dibayar) STORED!
    $kas_payload = [
        'kru_id'            => $kru_id,
        'kru_nama'          => $kru_nama,
        'kru_ptv_id'        => $kru_ptv_id ?: null,
        'periode_bulan'     => $periode_bulan,
        'tagihan'           => $tagihan,
        'dibayar'           => $tagihan,
        'status'            => 'Lunas',
        'tanggal_bayar'     => substr($tanggal_bayar, 0, 10),
        'metode_bayar'      => 'Transfer',
        'pemasukan_id'      => $pemasukan_id,
        'dicatat_oleh_id'   => (!empty($admin_id) && strlen((string)$admin_id) === 36) ? $admin_id : null,
        'dicatat_oleh_nama' => $admin_name,
        'updated_at'        => current_time('mysql', 1),
    ];

    if ($existing && !empty($existing['id'])) {
        $kas_res = PTV_Supabase::update_by_id('ptv_kas_kru', $existing['id'], $kas_payload);
    } else {
        $kas_payload['created_at'] = current_time('mysql', 1);
        $kas_res = PTV_Supabase::insert('ptv_kas_kru', $kas_payload);
    }

    // Validasi ketat hasil simpan ptv_kas_kru
    if (is_wp_error($kas_res) || !is_array($kas_res) || empty($kas_res[0]['id'])) {
        // Rollback pemasukan baru agar tidak menjadi transaksi pemasukan yatim
        if ($is_new_pemasukan && !empty($pemasukan_id)) {
            PTV_Supabase::delete_by_id('ptv_pemasukan', $pemasukan_id);
        }
        $err_msg = is_wp_error($kas_res) ? $kas_res->get_error_message() : ($kas_res['message'] ?? 'Gagal menyimpan status iuran kru ke database Supabase.');
        wp_send_json_error(['message' => 'Gagal menyimpan status iuran: ' . $err_msg]);
        return;
    }

    $kas_record = $kas_res[0];

    // Ambil ulang status pembayaran terbaru secara real-time dari Supabase
    $sb_kk = PTV_Supabase::select('ptv_kas_kru', '?order=periode_bulan.desc,kru_nama.asc&limit=1000');
    $fresh_kas_kru = [];
    if (is_array($sb_kk) && !is_wp_error($sb_kk) && !isset($sb_kk['code'])) {
        foreach ($sb_kk as $kr) {
            $fresh_kas_kru[] = [
                'id'                => (string)($kr['id'] ?? ''),
                'kru_id'            => (string)($kr['kru_id'] ?? ''),
                'kru_nama'          => (string)($kr['kru_nama'] ?? ''),
                'kru_ptv_id'        => (string)($kr['kru_ptv_id'] ?? ''),
                'periode_bulan'     => (string)($kr['periode_bulan'] ?? ''),
                'tagihan'           => (int)($kr['tagihan'] ?? 20000),
                'dibayar'           => (int)($kr['dibayar'] ?? 0),
                'sisa'              => (int)($kr['sisa'] ?? 20000),
                'status'            => (string)($kr['status'] ?? 'Belum Bayar'),
                'tanggal_bayar'     => (string)($kr['tanggal_bayar'] ?? ''),
                'metode_bayar'      => (string)($kr['metode_bayar'] ?? 'Transfer'),
                'catatan'           => (string)($kr['catatan'] ?? ''),
                'bukti_url'         => (string)($kr['bukti_url'] ?? ''),
                'pemasukan_id'      => (string)($kr['pemasukan_id'] ?? ''),
                'dicatat_oleh_id'   => (string)($kr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($kr['dicatat_oleh_nama'] ?? ''),
            ];
        }
    }

    $sb_pem = PTV_Supabase::select('ptv_pemasukan', '?order=tanggal.desc,created_at.desc&limit=500');
    $fresh_pemasukan = [];
    if (is_array($sb_pem) && !is_wp_error($sb_pem) && !isset($sb_pem['code'])) {
        foreach ($sb_pem as $pr) {
            $fresh_pemasukan[] = [
                'id'                => (string)($pr['id'] ?? ''),
                'tanggal'           => substr((string)($pr['tanggal'] ?? date('Y-m-d')), 0, 10),
                'sumber'            => (string)($pr['sumber'] ?? 'Kas Kru'),
                'kategori'          => (string)($pr['kategori'] ?? 'Iuran Kas'),
                'nominal'           => (int)($pr['nominal'] ?? 0),
                'keterangan'        => (string)($pr['keterangan'] ?? ''),
                'kru_id'            => (string)($pr['kru_id'] ?? ''),
                'kru_nama'          => (string)($pr['kru_nama'] ?? ''),
                'dicatat_oleh_id'   => (string)($pr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($pr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                'bukti_url'         => (string)($pr['bukti_url'] ?? ''),
                'status'            => (string)($pr['status'] ?? 'verified'),
                'created_at'        => (string)($pr['created_at'] ?? ''),
            ];
        }
    }

    wp_send_json_success([
        'message'          => 'Iuran kas ' . $kru_nama . ' periode ' . $periode_bulan . ' berhasil ditandai LUNAS dan pemasukan kas otomatis dibukukan.',
        'kas_record'       => $kas_record,
        'pemasukan_record' => $pemasukan_record,
        'all_kas_kru'      => $fresh_kas_kru,
        'all_pemasukan'    => $fresh_pemasukan,
    ]);
}

// 3. Batalkan (UNDO) Pembayaran Kas Kru (Hanya Eksekutif & Farsya)
add_action('wp_ajax_ptv_dashboard_action_undo_kas_kru', 'ptv_dashboard_action_undo_kas_kru_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_undo_kas_kru', 'ptv_dashboard_action_undo_kas_kru_cb');
function ptv_dashboard_action_undo_kas_kru_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang membatalkan status kas.']);
        return;
    }

    $kru_id        = sanitize_text_field($_POST['kru_id'] ?? '');
    $kru_ptv_id    = sanitize_text_field($_POST['kru_ptv_id'] ?? '');
    $kru_nama      = sanitize_text_field($_POST['kru_nama'] ?? '');
    $periode_bulan = sanitize_text_field($_POST['periode_bulan'] ?? '');
    $admin_name    = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Admin Keuangan');
    $now_mysql     = current_time('mysql', 0);

    if (empty($kru_id) || empty($periode_bulan)) {
        wp_send_json_error(['message' => 'Parameter tidak lengkap.']);
        return;
    }

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    // Cari record di ptv_kas_kru dengan multi-matching (kru_id, kru_ptv_id, kru_nama)
    $check = PTV_Supabase::select('ptv_kas_kru', '?kru_id=eq.' . urlencode($kru_id) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    if ((!is_array($check) || empty($check[0])) && !empty($kru_ptv_id)) {
        $check = PTV_Supabase::select('ptv_kas_kru', '?kru_ptv_id=eq.' . urlencode($kru_ptv_id) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    }
    if ((!is_array($check) || empty($check[0])) && !empty($kru_nama)) {
        $check = PTV_Supabase::select('ptv_kas_kru', '?kru_nama=ilike.' . urlencode($kru_nama) . '&periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
    }

    $kas_row = (!empty($check) && is_array($check)) ? $check[0] : null;
    $kas_id = $kas_row ? $kas_row['id'] : null;
    $pemasukan_id = $kas_row['pemasukan_id'] ?? null;
    $existing_catatan = $kas_row ? (string)($kas_row['catatan'] ?? '') : '';
    $audit_note = '[BATAL/UNDO] oleh ' . $admin_name . ' pada ' . $now_mysql;
    $new_catatan = $existing_catatan ? ($existing_catatan . ' | ' . $audit_note) : $audit_note;

    // 1. Revert status di ptv_kas_kru menjadi Belum Bayar & reset pemasukan_id
    if ($kas_id) {
        $update_kas = [
            'status'            => 'Belum Bayar',
            'dibayar'           => 0,
            'tanggal_bayar'     => null,
            'pemasukan_id'      => null,
            'catatan'           => $new_catatan,
            'updated_at'        => current_time('mysql', 1),
        ];
        PTV_Supabase::update_by_id('ptv_kas_kru', $kas_id, $update_kas);
    }

    // 2. Void transaksi pemasukan kas terkait (jika ada)
    $voided_pem_id = null;
    if (!empty($pemasukan_id) && strlen($pemasukan_id) === 36) {
        $pem_check = PTV_Supabase::select('ptv_pemasukan', '?id=eq.' . urlencode($pemasukan_id) . '&limit=1');
        if (is_array($pem_check) && !empty($pem_check[0])) {
            $pem_catatan = (string)($pem_check[0]['keterangan'] ?? '');
            $pem_new_ket = $pem_catatan ? ($pem_catatan . ' | ' . $audit_note) : $audit_note;
            PTV_Supabase::update_by_id('ptv_pemasukan', $pemasukan_id, [
                'status'     => 'void',
                'keterangan' => $pem_new_ket,
                'updated_at' => current_time('mysql', 1),
            ]);
            $voided_pem_id = $pemasukan_id;
        }
    } else {
        // Fallback: cari pemasukan berdasarkan kru_id / nama dan periode
        $pem_cari = PTV_Supabase::select('ptv_pemasukan', '?kru_id=eq.' . urlencode($kru_id) . '&keterangan=like.*' . urlencode($periode_bulan) . '*&status=neq.void&limit=1');
        if (!is_array($pem_cari) || empty($pem_cari[0]['id'])) {
            $periode_label = ptv_fmt_periode_bulan($periode_bulan);
            $pem_cari = PTV_Supabase::select('ptv_pemasukan', '?kru_id=eq.' . urlencode($kru_id) . '&keterangan=like.*' . urlencode($periode_label) . '*&status=neq.void&limit=1');
        }
        if ((!is_array($pem_cari) || empty($pem_cari[0]['id'])) && !empty($kru_nama)) {
            $pem_cari = PTV_Supabase::select('ptv_pemasukan', '?kru_nama=ilike.' . urlencode($kru_nama) . '&keterangan=like.*' . urlencode($periode_bulan) . '*&status=neq.void&limit=1');
        }
        if (is_array($pem_cari) && !empty($pem_cari[0]['id'])) {
            $void_id = $pem_cari[0]['id'];
            $pem_catatan = (string)($pem_cari[0]['keterangan'] ?? '');
            $pem_new_ket = $pem_catatan ? ($pem_catatan . ' | ' . $audit_note) : $audit_note;
            PTV_Supabase::update_by_id('ptv_pemasukan', $void_id, [
                'status'     => 'void',
                'keterangan' => $pem_new_ket,
                'updated_at' => current_time('mysql', 1),
            ]);
            $voided_pem_id = $void_id;
        }
    }

    if (!$kas_id && !$voided_pem_id) {
        wp_send_json_error(['message' => 'Catatan iuran maupun transaksi pemasukan tidak ditemukan di Supabase.']);
        return;
    }

    $kas_record = $kas_row ? array_merge($kas_row, $update_kas) : null;

    // Ambil ulang status pembayaran terbaru dari Supabase
    $sb_kk = PTV_Supabase::select('ptv_kas_kru', '?order=periode_bulan.desc,kru_nama.asc&limit=1000');
    $fresh_kas_kru = [];
    if (is_array($sb_kk) && !is_wp_error($sb_kk) && !isset($sb_kk['code'])) {
        foreach ($sb_kk as $kr) {
            $fresh_kas_kru[] = [
                'id'                => (string)($kr['id'] ?? ''),
                'kru_id'            => (string)($kr['kru_id'] ?? ''),
                'kru_nama'          => (string)($kr['kru_nama'] ?? ''),
                'kru_ptv_id'        => (string)($kr['kru_ptv_id'] ?? ''),
                'periode_bulan'     => (string)($kr['periode_bulan'] ?? ''),
                'tagihan'           => (int)($kr['tagihan'] ?? 20000),
                'dibayar'           => (int)($kr['dibayar'] ?? 0),
                'sisa'              => (int)($kr['sisa'] ?? 20000),
                'status'            => (string)($kr['status'] ?? 'Belum Bayar'),
                'tanggal_bayar'     => (string)($kr['tanggal_bayar'] ?? ''),
                'metode_bayar'      => (string)($kr['metode_bayar'] ?? 'Transfer'),
                'catatan'           => (string)($kr['catatan'] ?? ''),
                'bukti_url'         => (string)($kr['bukti_url'] ?? ''),
                'pemasukan_id'      => (string)($kr['pemasukan_id'] ?? ''),
                'dicatat_oleh_id'   => (string)($kr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($kr['dicatat_oleh_nama'] ?? ''),
            ];
        }
    }

    $sb_pem = PTV_Supabase::select('ptv_pemasukan', '?order=tanggal.desc,created_at.desc&limit=500');
    $fresh_pemasukan = [];
    if (is_array($sb_pem) && !is_wp_error($sb_pem) && !isset($sb_pem['code'])) {
        foreach ($sb_pem as $pr) {
            $fresh_pemasukan[] = [
                'id'                => (string)($pr['id'] ?? ''),
                'tanggal'           => substr((string)($pr['tanggal'] ?? date('Y-m-d')), 0, 10),
                'sumber'            => (string)($pr['sumber'] ?? 'Kas Kru'),
                'kategori'          => (string)($pr['kategori'] ?? 'Iuran Kas'),
                'nominal'           => (int)($pr['nominal'] ?? 0),
                'keterangan'        => (string)($pr['keterangan'] ?? ''),
                'kru_id'            => (string)($pr['kru_id'] ?? ''),
                'kru_nama'          => (string)($pr['kru_nama'] ?? ''),
                'dicatat_oleh_id'   => (string)($pr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($pr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                'bukti_url'         => (string)($pr['bukti_url'] ?? ''),
                'status'            => (string)($pr['status'] ?? 'verified'),
                'created_at'        => (string)($pr['created_at'] ?? ''),
            ];
        }
    }

    wp_send_json_success([
        'message'       => 'Status iuran kas berhasil dibatalkan (Belum Bayar).',
        'kas_record'    => $kas_record,
        'voided_pem_id' => $voided_pem_id,
        'all_kas_kru'   => $fresh_kas_kru,
        'all_pemasukan' => $fresh_pemasukan,
    ]);
}

// 4. Pengaturan Periode & Nominal Kas Dinamis (Hanya Eksekutif & Farsya)
add_action('wp_ajax_ptv_dashboard_action_save_kas_periode', 'ptv_dashboard_action_save_kas_periode_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_kas_periode', 'ptv_dashboard_action_save_kas_periode_cb');
function ptv_dashboard_action_save_kas_periode_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang mengubah pengaturan iuran kas.']);
        return;
    }

    $periode_bulan = sanitize_text_field($_POST['periode_bulan'] ?? '');
    $nominal       = max(0, intval($_POST['nominal'] ?? 0));
    $keterangan    = sanitize_text_field($_POST['keterangan'] ?? '');
    $status        = sanitize_text_field($_POST['status'] ?? 'aktif');

    if (!preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/', $periode_bulan)) {
        wp_send_json_error(['message' => 'Format periode bulan tidak valid (harus YYYY-MM).']);
        return;
    }
    // PERIODE AWAL: Jangan pernah membuat atau menghitung periode sebelum Juli 2026
    if ($periode_bulan < '2026-07') {
        wp_send_json_error(['message' => 'Sistem iuran dimulai paling awal dari Juli 2026 (2026-07). Periode sebelum Juli 2026 tidak diizinkan.']);
        return;
    }
    if ($nominal <= 0) {
        wp_send_json_error(['message' => 'Nominal iuran harus lebih besar dari 0.']);
        return;
    }

    $is_active = ($status !== 'nonaktif');
    $clean_ket = $keterangan ?: ('Iuran Kas Kru ' . ptv_fmt_periode_bulan($periode_bulan));
    if (!$is_active && strpos($clean_ket, '[NONAKTIF]') === false) {
        $clean_ket = '[NONAKTIF] ' . $clean_ket;
    } elseif ($is_active) {
        $clean_ket = trim(str_replace('[NONAKTIF]', '', $clean_ket));
    }

    $payload = [
        'periode_bulan' => $periode_bulan,
        'nominal'       => $nominal,
        'keterangan'    => $clean_ket,
        'status'        => $is_active ? 'aktif' : 'nonaktif',
        'updated_at'    => current_time('mysql', 1),
    ];

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        $check = PTV_Supabase::select('ptv_kas_periode', '?periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
        if (is_array($check) && !empty($check[0])) {
            $upd = PTV_Supabase::update('ptv_kas_periode', $payload, '?periode_bulan=eq.' . urlencode($periode_bulan));
            if (is_wp_error($upd) && str_contains(strtolower($upd->get_error_message()), 'column')) {
                unset($payload['status']);
                PTV_Supabase::update('ptv_kas_periode', $payload, '?periode_bulan=eq.' . urlencode($periode_bulan));
            }
        } else {
            $payload['created_at'] = current_time('mysql', 1);
            $ins = PTV_Supabase::insert('ptv_kas_periode', $payload);
            if (is_wp_error($ins) && str_contains(strtolower($ins->get_error_message()), 'column')) {
                unset($payload['status']);
                PTV_Supabase::insert('ptv_kas_periode', $payload);
            }
        }

        // Audit & lindungi histori pembayaran: sinkronisasi tagihan & sisa di ptv_kas_kru
        if ($is_active) {
            $existing_kas = PTV_Supabase::select('ptv_kas_kru', '?periode_bulan=eq.' . urlencode($periode_bulan));
            if (is_array($existing_kas) && !empty($existing_kas) && !is_wp_error($existing_kas)) {
                foreach ($existing_kas as $kr) {
                    $kr_id = $kr['id'] ?? null;
                    if (!$kr_id) continue;
                    $dibayar = intval($kr['dibayar'] ?? 0);
                    $sisa = max(0, $nominal - $dibayar);
                    $status_str = ($sisa === 0 && $dibayar >= $nominal) ? 'Lunas' : 'Belum Bayar';

                    PTV_Supabase::update_by_id('ptv_kas_kru', $kr_id, [
                        'tagihan'    => $nominal,
                        'status'     => $status_str,
                        'updated_at' => current_time('mysql', 1),
                    ]);
                }
            }
        }
    }

    $out_item = [
        'periode_bulan' => $periode_bulan,
        'nominal'       => $nominal,
        'keterangan'    => $clean_ket,
        'status'        => $is_active ? 'aktif' : 'nonaktif',
        'is_active'     => $is_active,
    ];

    // Ambil fresh kas_kru dan periode terbaru
    $sb_kk = PTV_Supabase::select('ptv_kas_kru', '?order=periode_bulan.desc,kru_nama.asc&limit=1000');
    $fresh_kas_kru = [];
    if (is_array($sb_kk) && !is_wp_error($sb_kk) && !isset($sb_kk['code'])) {
        foreach ($sb_kk as $kr) {
            $fresh_kas_kru[] = [
                'id'                => (string)($kr['id'] ?? ''),
                'kru_id'            => (string)($kr['kru_id'] ?? ''),
                'kru_nama'          => (string)($kr['kru_nama'] ?? ''),
                'kru_ptv_id'        => (string)($kr['kru_ptv_id'] ?? ''),
                'periode_bulan'     => (string)($kr['periode_bulan'] ?? ''),
                'tagihan'           => (int)($kr['tagihan'] ?? 20000),
                'dibayar'           => (int)($kr['dibayar'] ?? 0),
                'sisa'              => (int)($kr['sisa'] ?? 20000),
                'status'            => (string)($kr['status'] ?? 'Belum Bayar'),
                'tanggal_bayar'     => (string)($kr['tanggal_bayar'] ?? ''),
                'metode_bayar'      => (string)($kr['metode_bayar'] ?? 'Transfer'),
                'catatan'           => (string)($kr['catatan'] ?? ''),
                'bukti_url'         => (string)($kr['bukti_url'] ?? ''),
                'pemasukan_id'      => (string)($kr['pemasukan_id'] ?? ''),
                'dicatat_oleh_id'   => (string)($kr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($kr['dicatat_oleh_nama'] ?? ''),
            ];
        }
    }

    $sb_kp = PTV_Supabase::select('ptv_kas_periode', '?order=periode_bulan.asc&limit=100');
    $fresh_periode = [];
    if (is_array($sb_kp) && !is_wp_error($sb_kp) && !isset($sb_kp['code'])) {
        foreach ($sb_kp as $pr) {
            $fresh_periode[] = [
                'periode_bulan' => (string)($pr['periode_bulan'] ?? ''),
                'nominal'       => (int)($pr['nominal'] ?? 25000),
                'keterangan'    => (string)($pr['keterangan'] ?? ''),
                'status'        => (string)($pr['status'] ?? 'aktif'),
                'is_active'     => (($pr['status'] ?? 'aktif') !== 'nonaktif'),
            ];
        }
    }

    wp_send_json_success([
        'message'     => 'Pengaturan iuran periode ' . ptv_fmt_periode_bulan($periode_bulan) . ' berhasil disimpan (Rp ' . number_format($nominal, 0, ',', '.') . ').',
        'periode'     => $out_item,
        'item'        => $out_item,
        'all_kas_kru' => $fresh_kas_kru,
        'all_periode' => $fresh_periode,
    ]);
}

// 4b. Hapus / Nonaktifkan Periode Iuran Kas dengan Safety Check
add_action('wp_ajax_ptv_dashboard_action_delete_kas_periode', 'ptv_dashboard_action_delete_kas_periode_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_kas_periode', 'ptv_dashboard_action_delete_kas_periode_cb');
function ptv_dashboard_action_delete_kas_periode_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang mengelola periode iuran kas.']);
        return;
    }

    $periode_bulan = sanitize_text_field($_POST['periode_bulan'] ?? '');
    $force_mode    = sanitize_text_field($_POST['force_mode'] ?? 'safe'); // 'safe' | 'deactivate' | 'hard_delete'

    if (!preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/', $periode_bulan)) {
        wp_send_json_error(['message' => 'Format periode bulan tidak valid.']);
        return;
    }

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    // 1. SAFETY: Cek apakah periode ini sudah memiliki pembayaran kru
    $paid_count = 0;
    $total_paid = 0;
    $existing_kas = PTV_Supabase::select('ptv_kas_kru', '?periode_bulan=eq.' . urlencode($periode_bulan));
    if (is_array($existing_kas) && !empty($existing_kas)) {
        foreach ($existing_kas as $k) {
            $dibayar = intval($k['dibayar'] ?? 0);
            if ($dibayar > 0 || ($k['status'] ?? '') === 'Lunas') {
                $paid_count++;
                $total_paid += $dibayar;
            }
        }
    }

    $existing_pem = PTV_Supabase::select('ptv_pemasukan', '?keterangan=like.*' . urlencode($periode_bulan) . '*&status=neq.void&limit=5');
    $pem_count = (is_array($existing_pem) && !empty($existing_pem)) ? count($existing_pem) : 0;
    $has_payments = ($paid_count > 0 || $total_paid > 0 || $pem_count > 0);

    // Jika sudah ada pembayaran dan dipanggil tanpa konfirmasi
    if ($has_payments && $force_mode === 'safe') {
        wp_send_json_error([
            'requires_confirmation' => true,
            'has_payments'          => true,
            'paid_count'            => $paid_count,
            'total_paid'            => $total_paid,
            'message'               => 'Periode ' . ptv_fmt_periode_bulan($periode_bulan) . ' sudah memiliki data pembayaran (' . $paid_count . ' kru / Rp ' . number_format($total_paid, 0, ',', '.') . '). Menghapus periode dapat memengaruhi riwayat keuangan. Apakah Anda ingin menonaktifkan periode ini?'
        ]);
        return;
    }

    // 2. Eksekusi Deaktivasi (Safety Soft-Delete) atau Hard Delete
    if ($has_payments || $force_mode === 'deactivate') {
        // NONAKTIFKAN periode: tandai status nonaktif & [NONAKTIF] di keterangan
        $check = PTV_Supabase::select('ptv_kas_periode', '?periode_bulan=eq.' . urlencode($periode_bulan) . '&limit=1');
        $old_ket = (is_array($check) && !empty($check[0]['keterangan'])) ? $check[0]['keterangan'] : ('Iuran Kas Kru ' . $periode_bulan);
        if (strpos($old_ket, '[NONAKTIF]') === false) {
            $old_ket = '[NONAKTIF] ' . $old_ket;
        }

        $upd_data = [
            'status'     => 'nonaktif',
            'keterangan' => $old_ket,
            'updated_at' => current_time('mysql', 1),
        ];

        $res = PTV_Supabase::update('ptv_kas_periode', $upd_data, '?periode_bulan=eq.' . urlencode($periode_bulan));
        if (is_wp_error($res) && str_contains(strtolower($res->get_error_message()), 'column')) {
            unset($upd_data['status']);
            PTV_Supabase::update('ptv_kas_periode', $upd_data, '?periode_bulan=eq.' . urlencode($periode_bulan));
        }

        wp_send_json_success([
            'mode'          => 'deactivated',
            'periode_bulan' => $periode_bulan,
            'message'       => 'Periode ' . ptv_fmt_periode_bulan($periode_bulan) . ' berhasil dinonaktifkan dari sistem iuran aktif.'
        ]);
    } else {
        // Belum ada transaksi pembayaran sama sekali: Hard delete dari tabel ptv_kas_periode
        PTV_Supabase::delete('ptv_kas_periode', '?periode_bulan=eq.' . urlencode($periode_bulan));
        // Bersihkan row ptv_kas_kru yang belum terbayar pada periode ini
        PTV_Supabase::delete('ptv_kas_kru', '?periode_bulan=eq.' . urlencode($periode_bulan) . '&dibayar=eq.0');

        wp_send_json_success([
            'mode'          => 'deleted',
            'periode_bulan' => $periode_bulan,
            'message'       => 'Periode ' . ptv_fmt_periode_bulan($periode_bulan) . ' berhasil dihapus dari sistem.'
        ]);
    }
}

// 4. Void / Cancel Transaksi
add_action('wp_ajax_ptv_dashboard_action_void_keuangan', 'ptv_dashboard_action_void_keuangan_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_void_keuangan', 'ptv_dashboard_action_void_keuangan_cb');
function ptv_dashboard_action_void_keuangan_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) ptv_require_dashboard_ajax_access();
    if (!ptv_is_keuangan_admin()) {
        wp_send_json_error(['message' => 'Hanya Admin Keuangan / Eksekutif yang berwenang membatalkan transaksi.']);
        return;
    }

    $table_type = sanitize_text_field($_POST['type'] ?? ''); // 'pemasukan' atau 'pengeluaran'
    $id         = sanitize_text_field($_POST['id'] ?? '');
    $alasan     = sanitize_text_field($_POST['alasan'] ?? 'Pembatalan transaksi');

    if (!in_array($table_type, ['pemasukan', 'pengeluaran'], true) || empty($id)) {
        wp_send_json_error(['message' => 'Parameter tidak valid.']);
        return;
    }

    $table = ($table_type === 'pemasukan') ? 'ptv_pemasukan' : 'ptv_pengeluaran';
    $payload = [
        'status'     => 'void',
        'updated_at' => current_time('mysql', 1)
    ];

    if (!class_exists('PTV_Supabase') || !PTV_Supabase::is_configured()) {
        wp_send_json_error(['message' => 'Supabase belum terhubung.']);
        return;
    }

    $res = PTV_Supabase::update_by_id($table, $id, $payload);
    if (is_wp_error($res) || isset($res['code'])) {
        wp_send_json_error(['message' => is_wp_error($res) ? $res->get_error_message() : ($res['message'] ?? 'Gagal membatalkan transaksi.')]);
        return;
    }

    // Jika pemasukan dibatalkan, cek apakah terhubung ke ptv_kas_kru dan revert status iurannya
    if ($table_type === 'pemasukan') {
        $linked_kas = PTV_Supabase::select('ptv_kas_kru', '?pemasukan_id=eq.' . urlencode($id) . '&limit=1');
        if (is_array($linked_kas) && !empty($linked_kas[0]['id'])) {
            $kas_id = $linked_kas[0]['id'];
            PTV_Supabase::update_by_id('ptv_kas_kru', $kas_id, [
                'status'        => 'Belum Bayar',
                'dibayar'       => 0,
                'tanggal_bayar' => null,
                'pemasukan_id'  => null,
                'updated_at'    => current_time('mysql', 1),
            ]);
        }
    }

    // Ambil fresh data
    $sb_kk = PTV_Supabase::select('ptv_kas_kru', '?order=periode_bulan.desc,kru_nama.asc&limit=1000');
    $fresh_kas_kru = [];
    if (is_array($sb_kk) && !is_wp_error($sb_kk) && !isset($sb_kk['code'])) {
        foreach ($sb_kk as $kr) {
            $fresh_kas_kru[] = [
                'id'                => (string)($kr['id'] ?? ''),
                'kru_id'            => (string)($kr['kru_id'] ?? ''),
                'kru_nama'          => (string)($kr['kru_nama'] ?? ''),
                'kru_ptv_id'        => (string)($kr['kru_ptv_id'] ?? ''),
                'periode_bulan'     => (string)($kr['periode_bulan'] ?? ''),
                'tagihan'           => (int)($kr['tagihan'] ?? 20000),
                'dibayar'           => (int)($kr['dibayar'] ?? 0),
                'sisa'              => (int)($kr['sisa'] ?? 20000),
                'status'            => (string)($kr['status'] ?? 'Belum Bayar'),
                'tanggal_bayar'     => (string)($kr['tanggal_bayar'] ?? ''),
                'metode_bayar'      => (string)($kr['metode_bayar'] ?? 'Transfer'),
                'catatan'           => (string)($kr['catatan'] ?? ''),
                'bukti_url'         => (string)($kr['bukti_url'] ?? ''),
                'pemasukan_id'      => (string)($kr['pemasukan_id'] ?? ''),
                'dicatat_oleh_id'   => (string)($kr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($kr['dicatat_oleh_nama'] ?? ''),
            ];
        }
    }

    $sb_pem = PTV_Supabase::select('ptv_pemasukan', '?order=tanggal.desc,created_at.desc&limit=500');
    $fresh_pemasukan = [];
    if (is_array($sb_pem) && !is_wp_error($sb_pem) && !isset($sb_pem['code'])) {
        foreach ($sb_pem as $pr) {
            $fresh_pemasukan[] = [
                'id'                => (string)($pr['id'] ?? ''),
                'tanggal'           => substr((string)($pr['tanggal'] ?? date('Y-m-d')), 0, 10),
                'sumber'            => (string)($pr['sumber'] ?? 'Kas Kru'),
                'kategori'          => (string)($pr['kategori'] ?? 'Iuran Kas'),
                'nominal'           => (int)($pr['nominal'] ?? 0),
                'keterangan'        => (string)($pr['keterangan'] ?? ''),
                'kru_id'            => (string)($pr['kru_id'] ?? ''),
                'kru_nama'          => (string)($pr['kru_nama'] ?? ''),
                'dicatat_oleh_id'   => (string)($pr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($pr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                'bukti_url'         => (string)($pr['bukti_url'] ?? ''),
                'status'            => (string)($pr['status'] ?? 'verified'),
                'created_at'        => (string)($pr['created_at'] ?? ''),
            ];
        }
    }

    $sb_pen = PTV_Supabase::select('ptv_pengeluaran', '?order=tanggal.desc,created_at.desc&limit=500');
    $fresh_pengeluaran = [];
    if (is_array($sb_pen) && !is_wp_error($sb_pen) && !isset($sb_pen['code'])) {
        foreach ($sb_pen as $xr) {
            $fresh_pengeluaran[] = [
                'id'                => (string)($xr['id'] ?? ''),
                'tanggal'           => substr((string)($xr['tanggal'] ?? date('Y-m-d')), 0, 10),
                'keperluan'         => (string)($xr['keperluan'] ?? ''),
                'kategori'          => (string)($xr['kategori'] ?? 'Operasional'),
                'nominal'           => (int)($xr['nominal'] ?? 0),
                'keterangan'        => (string)($xr['keterangan'] ?? ''),
                'dicatat_oleh_id'   => (string)($xr['dicatat_oleh_id'] ?? ''),
                'dicatat_oleh_nama' => (string)($xr['dicatat_oleh_nama'] ?? 'Admin Keuangan'),
                'bukti_url'         => (string)($xr['bukti_url'] ?? ''),
                'status'            => (string)($xr['status'] ?? 'verified'),
                'created_at'        => (string)($xr['created_at'] ?? ''),
            ];
        }
    }

    wp_send_json_success([
        'message'         => 'Transaksi berhasil di-VOID (dibatalkan).',
        'id'              => $id,
        'type'            => $table_type,
        'all_kas_kru'     => $fresh_kas_kru,
        'all_pemasukan'   => $fresh_pemasukan,
        'all_pengeluaran' => $fresh_pengeluaran,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: CATATAN BERSAMA (ptv_catatan)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_note', 'ptv_dashboard_action_save_note_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_note', 'ptv_dashboard_action_save_note_cb');
function ptv_dashboard_action_save_note_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');
    $current_uid  = $_SESSION['ptv_crew_id'] ?? ($_SESSION['ptv_admin_user'] ?? 'kru');
    $raw_role     = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec      = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');

    $id        = sanitize_text_field($_POST['id'] ?? '');
    $judul     = sanitize_text_field($_POST['judul'] ?? ($_POST['title'] ?? ''));
    $isi       = wp_kses_post($_POST['isi'] ?? ($_POST['body'] ?? ($_POST['content'] ?? '')));
    $warna     = sanitize_text_field($_POST['warna'] ?? ($_POST['color'] ?? 'default'));
    $tipe      = sanitize_text_field($_POST['tipe'] ?? ($_POST['type'] ?? ($_POST['note_type'] ?? 'shared')));
    if ($tipe !== 'meeting_minutes') {
        $tipe = 'shared';
    }
    $is_pinned = !empty($_POST['is_pinned']) && $_POST['is_pinned'] !== 'false' && $_POST['is_pinned'] !== '0';
    $tags_raw  = $_POST['tags'] ?? [];
    $tags      = [];

    if (is_string($tags_raw)) {
        $dec = json_decode(stripslashes($tags_raw), true);
        if (is_array($dec)) {
            $tags = $dec;
        } else {
            $tags = array_map('trim', explode(',', $tags_raw));
        }
    } elseif (is_array($tags_raw)) {
        $tags = $tags_raw;
    }
    $tags = array_values(array_unique(array_filter(array_map('sanitize_text_field', $tags))));

    // Synchronize tags with note type
    if ($tipe === 'meeting_minutes') {
        if (!in_array('notulensi', $tags, true) && !in_array('notulensi_rapat', $tags, true)) {
            $tags[] = 'notulensi';
        }
    } else {
        $tags = array_values(array_filter($tags, function($t) {
            return $t !== 'notulensi' && $t !== 'notulensi_rapat' && $t !== 'notulen';
        }));
    }

    if (empty($judul) && empty($isi)) {
        wp_send_json_error(['message' => 'Judul atau isi catatan wajib diisi.']);
        return;
    }
    if (empty($judul)) {
        $judul = ($tipe === 'meeting_minutes' ? 'Notulensi Rapat ' : 'Catatan ') . date('d M Y');
    }

    $allowed_colors = ['default', 'orange', 'yellow', 'green', 'purple', 'rose', 'cyan', 'emerald', 'blue', 'amber', 'slate'];
    if (!in_array($warna, $allowed_colors, true)) {
        $warna = 'default';
    }

    $now_iso = gmdate('Y-m-d\TH:i:s\Z');
    $note_data = [
        'judul'           => $judul,
        'isi'             => $isi,
        'warna'           => $warna,
        'is_pinned'       => $is_pinned,
        'tags'            => $tags,
        'updated_at'      => $now_iso,
    ];

    $is_edit = (!empty($id) && $id !== 'null');
    $saved_note = null;

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if ($is_edit && (strlen($id) === 36 || strpos($id, '-') !== false)) {
            // Check permission if editing
            $existing = PTV_Supabase::select('ptv_catatan', '?id=eq.' . urlencode($id) . '&limit=1');
            if (is_array($existing) && !empty($existing[0])) {
                $creator = $existing[0]['created_by_name'] ?? '';
                $creator_id = $existing[0]['created_by_id'] ?? '';
                if (!$is_exec && $creator !== $current_name && $creator_id !== $current_uid) {
                    wp_send_json_error(['message' => 'Anda hanya dapat mengedit catatan milik Anda sendiri.']);
                    return;
                }
            }

            // Try with 'tipe' field first; if Supabase returns column error, retry without 'tipe'
            $upd_data = array_merge($note_data, ['tipe' => $tipe]);
            $upd = PTV_Supabase::update_by_id('ptv_catatan', $id, $upd_data);
            if (is_wp_error($upd) && strpos($upd->get_error_message(), 'tipe') !== false) {
                $upd = PTV_Supabase::update_by_id('ptv_catatan', $id, $note_data);
            }

            if (is_wp_error($upd)) {
                wp_send_json_error(['message' => 'Gagal memperbarui catatan di Supabase: ' . $upd->get_error_message()]);
                return;
            }

            $upd_row = null;
            if (is_array($upd) && !empty($upd[0]['id'])) {
                $upd_row = $upd[0];
            } elseif (is_array($upd) && !empty($upd['id'])) {
                $upd_row = $upd;
            }
            $saved_note = array_merge($note_data, [
                'id'              => $id,
                'tipe'            => $tipe,
                'created_by_id'   => $existing[0]['created_by_id'] ?? $current_uid,
                'created_by_name' => $existing[0]['created_by_name'] ?? $current_name,
                'created_at'      => $existing[0]['created_at'] ?? $now_iso,
            ], is_array($upd_row) ? $upd_row : []);
        } else {
            // Proteksi Anti-Duplicate: Cek apakah catatan identik baru saja dibuat oleh user ini dalam 8 detik terakhir
            $recent_check = PTV_Supabase::select('ptv_catatan', '?created_by_id=eq.' . urlencode($current_uid) . '&order=created_at.desc&limit=1');
            if (is_array($recent_check) && !empty($recent_check[0]['id'])) {
                $last_note = $recent_check[0];
                $time_diff = time() - strtotime($last_note['created_at'] ?? '1970-01-01');
                if ($time_diff >= 0 && $time_diff <= 8) {
                    if (($last_note['judul'] ?? '') === $judul && ($last_note['isi'] ?? '') === $isi) {
                        $saved_note = array_merge($last_note, ['tipe' => $tipe]);
                        wp_send_json_success([
                            'message' => 'Catatan baru berhasil ditambahkan.',
                            'note'    => $saved_note,
                        ]);
                        return;
                    }
                }
            }

            $insert_payload = array_merge($note_data, [
                'tipe'            => $tipe,
                'created_by_id'   => $current_uid,
                'created_by_name' => $current_name,
                'created_at'      => $now_iso,
            ]);
            $ins = PTV_Supabase::insert('ptv_catatan', $insert_payload);
            if (is_wp_error($ins) && strpos($ins->get_error_message(), 'tipe') !== false) {
                $insert_payload_clean = array_merge($note_data, [
                    'created_by_id'   => $current_uid,
                    'created_by_name' => $current_name,
                    'created_at'      => $now_iso,
                ]);
                $ins = PTV_Supabase::insert('ptv_catatan', $insert_payload_clean);
            }

            if (is_wp_error($ins)) {
                wp_send_json_error(['message' => 'Gagal menyimpan catatan baru ke Supabase: ' . $ins->get_error_message()]);
                return;
            }

            if (is_array($ins)) {
                $ins_id = '';
                $ins_row = null;
                if (!empty($ins[0]['id'])) {
                    $ins_id = (string)$ins[0]['id'];
                    $ins_row = $ins[0];
                } elseif (!empty($ins['id'])) {
                    $ins_id = (string)$ins['id'];
                    $ins_row = $ins;
                }
                if ($ins_id) {
                    $saved_note = array_merge($insert_payload, is_array($ins_row) ? $ins_row : [], [
                        'id'   => $ins_id,
                        'tipe' => $tipe
                    ]);
                }
            }

            if (!$saved_note) {
                wp_send_json_error(['message' => 'Database tidak mengembalikan data catatan yang tersimpan.']);
                return;
            }
        }
    } else {
        // Fallback ONLY if Supabase is completely unconfigured
        $local_notes = get_option('ptv_shared_notes', []);
        if (!is_array($local_notes)) $local_notes = [];

        if ($is_edit) {
            $found_idx = -1;
            foreach ($local_notes as $idx => $n) {
                if ((string)($n['id'] ?? '') === (string)$id) {
                    $found_idx = $idx;
                    break;
                }
            }
            if ($found_idx !== -1) {
                $existing = $local_notes[$found_idx];
                if (!$is_exec && ($existing['created_by_name'] ?? '') !== $current_name && ($existing['created_by_id'] ?? '') !== $current_uid) {
                    wp_send_json_error(['message' => 'Anda hanya dapat mengedit catatan milik Anda sendiri.']);
                    return;
                }
                $saved_note = array_merge($existing, $note_data, ['tipe' => $tipe]);
                $local_notes[$found_idx] = $saved_note;
            } else {
                $saved_note = array_merge($note_data, [
                    'id'              => $id ?: uniqid('note_'),
                    'tipe'            => $tipe,
                    'created_by_id'   => $current_uid,
                    'created_by_name' => $current_name,
                    'created_at'      => $now_iso,
                ]);
                array_unshift($local_notes, $saved_note);
            }
        } else {
            $new_id = uniqid('note_');
            $saved_note = array_merge($note_data, [
                'id'              => $new_id,
                'tipe'            => $tipe,
                'created_by_id'   => $current_uid,
                'created_by_name' => $current_name,
                'created_at'      => $now_iso,
            ]);
            array_unshift($local_notes, $saved_note);
        }
        update_option('ptv_shared_notes', $local_notes, false);
    }

    ptv_realtime_broadcast_change(
        'ptv_catatan',
        'notes',
        $is_edit ? 'UPDATE' : 'INSERT',
        $saved_note['id'] ?? $id,
        is_array($saved_note) ? $saved_note : ['created_by_name' => $current_name, 'tipe' => $tipe]
    );

    wp_send_json_success([
        'message' => $is_edit ? 'Catatan berhasil diperbarui.' : 'Catatan baru berhasil ditambahkan.',
        'note'    => $saved_note,
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_delete_note', 'ptv_dashboard_action_delete_note_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_note', 'ptv_dashboard_action_delete_note_cb');
function ptv_dashboard_action_delete_note_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $current_name = $_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV');
    $current_uid  = $_SESSION['ptv_crew_id'] ?? ($_SESSION['ptv_admin_user'] ?? 'kru');
    $raw_role     = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec      = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');

    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya eksekutif yang dapat menghapus catatan.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID catatan wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && (strlen($id) === 36 || strpos($id, '-') !== false)) {
        $del = PTV_Supabase::delete_by_id('ptv_catatan', $id);
        if (is_wp_error($del)) {
            wp_send_json_error(['message' => 'Gagal menghapus catatan dari Supabase: ' . $del->get_error_message()]);
            return;
        }
    }

    // Also clean from local option if exists
    $local_notes = get_option('ptv_shared_notes', []);
    if (is_array($local_notes)) {
        $filtered = [];
        foreach ($local_notes as $n) {
            if ((string)($n['id'] ?? '') === (string)$id) {
                continue;
            }
            $filtered[] = $n;
        }
        update_option('ptv_shared_notes', $filtered, false);
    }

    ptv_realtime_broadcast_change('ptv_catatan', 'notes', 'DELETE', $id);

    wp_send_json_success(['message' => 'Catatan berhasil dihapus permanen.']);
}

add_action('wp_ajax_ptv_dashboard_action_toggle_pin_note', 'ptv_dashboard_action_toggle_pin_note_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_toggle_pin_note', 'ptv_dashboard_action_toggle_pin_note_cb');
function ptv_dashboard_action_toggle_pin_note_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role     = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_exec      = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_exec) {
        wp_send_json_error(['message' => 'Hanya eksekutif yang dapat menyematkan atau melepas sematan catatan.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    $is_pinned = !empty($_POST['is_pinned']) && $_POST['is_pinned'] !== 'false' && $_POST['is_pinned'] !== '0';
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID catatan wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && (strlen($id) === 36 || strpos($id, '-') !== false)) {
        $upd = PTV_Supabase::update_by_id('ptv_catatan', $id, [
            'is_pinned'  => $is_pinned,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
        if (is_wp_error($upd)) {
            wp_send_json_error(['message' => 'Gagal memperbarui status pin di Supabase: ' . $upd->get_error_message()]);
            return;
        }
    }

    $local_notes = get_option('ptv_shared_notes', []);
    if (is_array($local_notes)) {
        foreach ($local_notes as &$n) {
            if ((string)($n['id'] ?? '') === (string)$id) {
                $n['is_pinned'] = $is_pinned;
                $n['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
                break;
            }
        }
        update_option('ptv_shared_notes', $local_notes, false);
    }

    ptv_realtime_broadcast_change('ptv_catatan', 'notes', 'UPDATE', $id, ['is_pinned' => $is_pinned]);

    wp_send_json_success([
        'message'   => $is_pinned ? 'Catatan berhasil disematkan di atas.' : 'Sematan catatan dilepas.',
        'is_pinned' => $is_pinned
    ]);
}


// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: UPLOAD GAMBAR NYATA (Inventaris & Lost & Found)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_upload_image', 'ptv_dashboard_action_upload_image_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_upload_image', 'ptv_dashboard_action_upload_image_cb');
function ptv_dashboard_action_upload_image_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $file_field = '';
    foreach (['image', 'image_file', 'photo', 'foto', 'foto_file', 'file'] as $k) {
        if (!empty($_FILES[$k]) && !empty($_FILES[$k]['name'])) {
            $file_field = $k;
            break;
        }
    }
    if (empty($file_field)) {
        wp_send_json_error(['message' => 'File gambar tidak ditemukan dalam permintaan upload.']);
        return;
    }

    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');
    require_once(ABSPATH . 'wp-admin/includes/media.php');

    $file = $_FILES[$file_field];
    $allowed_mimes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg',
        'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'
    ];
    $file_info = wp_check_filetype(basename($file['name']), null);
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed_exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];

    if (!in_array($ext, $allowed_exts, true) && !in_array($file['type'], $allowed_mimes, true) && !in_array($file_info['type'], $allowed_mimes, true)) {
        wp_send_json_error(['message' => 'Format file tidak didukung. Harap upload gambar berformat JPG, PNG, WEBP, atau HEIC.']);
        return;
    }

    // Allow HEIC & WEBP in WordPress upload filters
    add_filter('upload_mimes', function($mimes) {
        $mimes['heic'] = 'image/heic';
        $mimes['heif'] = 'image/heif';
        $mimes['webp'] = 'image/webp';
        return $mimes;
    });

    // Max 15MB
    if ($file['size'] > 15 * 1024 * 1024) {
        wp_send_json_error(['message' => 'Ukuran file gambar terlalu besar (Maksimal 15MB).']);
        return;
    }

    $upload_overrides = ['test_form' => false, 'test_upload' => false];
    if (is_uploaded_file($file['tmp_name'])) {
        $movefile = wp_handle_upload($file, $upload_overrides);
    } else {
        $movefile = wp_handle_sideload($file, $upload_overrides);
    }

    if ($movefile && !isset($movefile['error'])) {
        $final_url = $movefile['url'];
        if (function_exists('ptv_clean_media_url')) {
            $final_url = ptv_clean_media_url($final_url);
        }
        wp_send_json_success([
            'message' => 'Foto berhasil diunggah.',
            'url'     => $final_url,
            'file'    => $movefile['file'],
            'type'    => $movefile['type'],
        ]);
    } else {
        wp_send_json_error(['message' => 'Gagal mengunggah foto: ' . ($movefile['error'] ?? 'Unknown upload error')]);
    }
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: CREATE / SAVE LOST & FOUND (SUPABASE ptv_lost_found)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_submit_lost_found', 'ptv_dashboard_action_save_lost_cb');
add_action('wp_ajax_nopriv_ptv_submit_lost_found', 'ptv_dashboard_action_save_lost_cb');
add_action('wp_ajax_ptv_dashboard_action_save_lost', 'ptv_dashboard_action_save_lost_cb');
function ptv_dashboard_action_save_lost_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id          = sanitize_text_field($_POST['id'] ?? '');
    $tipe_raw    = sanitize_text_field($_POST['tipe'] ?? 'kehilangan');
    $nama_barang = sanitize_text_field($_POST['nama_barang'] ?? ($_POST['name'] ?? ''));
    $lokasi      = sanitize_text_field($_POST['lokasi'] ?? ($_POST['loc'] ?? 'Studio PTV'));
    $tanggal     = sanitize_text_field($_POST['tanggal'] ?? ($_POST['date'] ?? date('Y-m-d')));
    $keterangan  = sanitize_textarea_field($_POST['keterangan'] ?? ($_POST['desc'] ?? ''));
    $foto_url    = esc_url_raw($_POST['foto_url'] ?? ($_POST['photo'] ?? ''));
    $kontak      = sanitize_text_field($_POST['pelapor_kontak'] ?? ($_POST['contact'] ?? ''));
    $pelapor     = sanitize_text_field($_POST['pelapor_nama'] ?? ($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV')));

    if (empty($nama_barang)) {
        wp_send_json_error(['message' => 'Nama barang wajib diisi.']);
        return;
    }

    $tipe_clean = ($tipe_raw === 'penemuan' || $tipe_raw === 'temuan') ? 'penemuan' : 'kehilangan';
    $init_status = ($tipe_clean === 'penemuan') ? 'ditemukan' : 'dicari';

    $data = [
        'tipe'           => $tipe_clean,
        'nama_barang'    => $nama_barang,
        'lokasi'         => $lokasi,
        'tanggal'        => $tanggal,
        'keterangan'     => $keterangan,
        'foto_url'       => $foto_url,
        'pelapor_nama'   => $pelapor,
        'pelapor_kontak' => $kontak,
        'status'         => $init_status,
        'updated_at'     => gmdate('Y-m-d\TH:i:s\Z'),
    ];

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if (!empty($id) && strlen($id) === 36) {
            $upd = PTV_Supabase::update_by_id('ptv_lost_found', $id, $data);
            if (is_wp_error($upd) || (is_array($upd) && isset($upd['code']))) {
                $err_msg = is_wp_error($upd) ? $upd->get_error_message() : ($upd['message'] ?? 'Error updating Supabase');
                wp_send_json_error(['message' => 'Gagal memperbarui Lost & Found di Supabase: ' . $err_msg]);
                return;
            }
            $record_id = $id;
        } else {
            $ins = PTV_Supabase::insert('ptv_lost_found', $data);
            if (is_wp_error($ins) || !is_array($ins) || empty($ins[0]['id'])) {
                $err_msg = is_wp_error($ins) ? $ins->get_error_message() : (is_array($ins) && isset($ins['message']) ? $ins['message'] : 'Gagal insert ke Supabase.');
                wp_send_json_error(['message' => 'Gagal mencatat Lost & Found di database Supabase: ' . $err_msg]);
                return;
            }
            $record_id = (string)$ins[0]['id'];
        }

        // Notifikasi ke seluruh Eksekutif aktif saat laporan Lost & Found baru dibuat
        if (empty($id)) {
            ptv_notify_all_exec_admin(
                'lost_found',
                'Laporan Lost & Found Baru',
                "{$pelapor} melaporkan " . ($tipe_clean === 'penemuan' ? 'barang temuan: ' : 'kehilangan: ') . $nama_barang . ".",
                [
                    'entity_type' => 'lost_found',
                    'entity_id'   => $record_id,
                    'action_url'  => 'dasbor?tab=lostfound',
                ]
            );
        }

        ptv_realtime_broadcast_change('ptv_lost_found', 'lost', empty($id) ? 'INSERT' : 'UPDATE', $record_id, ['nama_barang' => $nama_barang, 'status' => $init_status, 'tipe' => $tipe_clean]);

        wp_send_json_success([
            'message' => 'Laporan ' . ($tipe_clean === 'penemuan' ? 'barang temuan' : 'kehilangan barang') . ' berhasil disimpan ke Supabase.',
            'id'      => $record_id,
            'record'  => array_merge($data, ['id' => $record_id]),
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Database Supabase tidak terhubung.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: UPDATE STATUS LOST & FOUND (SUPABASE ptv_lost_found)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_update_lost_found_status', 'ptv_dashboard_action_update_lost_status_cb');
add_action('wp_ajax_nopriv_ptv_update_lost_found_status', 'ptv_dashboard_action_update_lost_status_cb');
add_action('wp_ajax_ptv_dashboard_action_update_lost_status', 'ptv_dashboard_action_update_lost_status_cb');
function ptv_dashboard_action_update_lost_status_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id     = sanitize_text_field($_POST['id'] ?? '');
    $status = strtolower(trim(sanitize_text_field($_POST['status'] ?? '')));

    $valid = ['dicari', 'ditemukan', 'dikembalikan'];
    if (empty($id) || !in_array($status, $valid, true)) {
        wp_send_json_error(['message' => 'Parameter status atau ID tidak valid.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        $upd = PTV_Supabase::update_by_id('ptv_lost_found', $id, [
            'status'     => $status,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
        if (is_wp_error($upd) || (is_array($upd) && isset($upd['code']))) {
            $err_msg = is_wp_error($upd) ? $upd->get_error_message() : ($upd['message'] ?? 'Error updating Supabase');
            wp_send_json_error(['message' => 'Gagal memperbarui status di Supabase: ' . $err_msg]);
            return;
        }

        // Notifikasi ke pelapor saat status laporan Lost & Found berubah
        $lf_item = PTV_Supabase::find('ptv_lost_found', $id);
        if (is_array($lf_item) && !empty($lf_item['pelapor_nama'])) {
            $reporter_id = ptv_resolve_crew_id($lf_item['pelapor_nama']);
            if (!empty($reporter_id)) {
                $status_label = ucfirst($status);
                ptv_create_notification(
                    $reporter_id,
                    'lost_found',
                    "Status Lost & Found: {$status_label}",
                    "Status laporan untuk barang {$lf_item['nama_barang']} diperbarui menjadi {$status_label}.",
                    [
                        'entity_type' => 'lost_found',
                        'entity_id'   => $id,
                        'action_url'  => 'dasbor?tab=lostfound',
                    ]
                );
            }
        }
    }

    ptv_realtime_broadcast_change('ptv_lost_found', 'lost', 'UPDATE', $id, ['status' => $status]);

    wp_send_json_success([
        'message' => 'Status Lost & Found berhasil diubah ke ' . $status,
        'status'  => $status,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: DELETE LOST & FOUND (SUPABASE ptv_lost_found)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_lost_found', 'ptv_dashboard_action_delete_lost_found_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_lost_found', 'ptv_dashboard_action_delete_lost_found_cb');
function ptv_dashboard_action_delete_lost_found_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID laporan Lost & Found wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        $del = PTV_Supabase::delete_by_id('ptv_lost_found', $id);
        if (is_wp_error($del)) {
            wp_send_json_error(['message' => 'Gagal menghapus dari Supabase: ' . $del->get_error_message()]);
            return;
        }
    }

    ptv_realtime_broadcast_change('ptv_lost_found', 'lost', 'DELETE', $id);

    wp_send_json_success(['message' => 'Laporan Lost & Found berhasil dihapus dari database.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: CREATE / SAVE LAPORAN KERUSAKAN (SUPABASE ptv_lapor_masalah)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_submit_lapor_masalah', 'ptv_dashboard_action_save_damage_cb');
add_action('wp_ajax_nopriv_ptv_submit_lapor_masalah', 'ptv_dashboard_action_save_damage_cb');
add_action('wp_ajax_ptv_dashboard_action_save_damage', 'ptv_dashboard_action_save_damage_cb');
function ptv_dashboard_action_save_damage_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id         = sanitize_text_field($_POST['id'] ?? '');
    $alat_id    = sanitize_text_field($_POST['alat_id'] ?? ($_POST['item_id'] ?? ''));
    $nama_alat  = sanitize_text_field($_POST['nama_alat'] ?? ($_POST['item_name'] ?? ''));
    $unit_no    = sanitize_text_field($_POST['unit_no'] ?? '');
    $unit_code  = sanitize_text_field($_POST['unit_code'] ?? '');
    $masalah    = sanitize_text_field($_POST['masalah'] ?? ($_POST['title'] ?? ''));
    $keterangan = sanitize_textarea_field($_POST['keterangan'] ?? ($_POST['desc'] ?? ''));
    $foto_url   = esc_url_raw($_POST['foto_url'] ?? ($_POST['photo'] ?? ''));
    $kontak     = sanitize_text_field($_POST['pelapor_kontak'] ?? ($_POST['contact'] ?? ''));
    $pelapor    = sanitize_text_field($_POST['pelapor_nama'] ?? ($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Kru PTV')));

    if (empty($masalah)) {
        wp_send_json_error(['message' => 'Kendala / masalah kerusakan wajib diisi.']);
        return;
    }

    if (!empty($unit_code) && !str_contains($nama_alat, $unit_code)) {
        $nama_alat = "{$nama_alat} — {$unit_code}";
    }

    $unit_name  = sanitize_text_field($_POST['unit_name'] ?? '');
    $unit_id_in = sanitize_text_field($_POST['unit_id'] ?? '');

    $data = [
        'alat_id'        => (string)$alat_id,
        'nama_alat'      => $nama_alat,
        'masalah'        => $masalah,
        'keterangan'     => $keterangan . "\n<!-- PTV_META: " . wp_json_encode(['unit_no' => $unit_no, 'unit_code' => $unit_code, 'unit_name' => $unit_name]) . " -->",
        'foto_url'       => $foto_url,
        'pelapor_nama'   => $pelapor,
        'pelapor_kontak' => $kontak,
        'status'         => 'Baru',
        'updated_at'     => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    if (!empty($unit_no)) $data['unit_no'] = $unit_no;
    if (!empty($unit_code)) $data['unit_code'] = $unit_code;
    if (!empty($alat_id) && strlen($alat_id) === 36) $data['inventaris_id'] = $alat_id;
    if (!empty($unit_id_in) && strlen($unit_id_in) === 36) $data['inventaris_unit_id'] = $unit_id_in;

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        // Cari inventaris_unit_id jika belum di-set
        if (empty($data['inventaris_unit_id']) && !empty($alat_id) && !empty($unit_no)) {
            $u_row = PTV_Supabase::select('ptv_inventaris_unit', '?inventaris_id=eq.' . urlencode($alat_id) . '&nomor_unit=eq.' . intval($unit_no) . '&limit=1');
            if (is_array($u_row) && !empty($u_row[0]['id'])) {
                $data['inventaris_unit_id'] = (string)$u_row[0]['id'];
            }
        }

        if (!empty($id) && strlen($id) === 36) {
            $upd = PTV_Supabase::update_by_id('ptv_lapor_masalah', $id, $data);
            if (is_wp_error($upd) && str_contains(strtolower($upd->get_error_message()), 'column')) {
                unset($data['unit_no'], $data['unit_code'], $data['inventaris_id'], $data['inventaris_unit_id']);
                $upd = PTV_Supabase::update_by_id('ptv_lapor_masalah', $id, $data);
            }
            if (is_wp_error($upd) || (is_array($upd) && isset($upd['code']))) {
                $err_msg = is_wp_error($upd) ? $upd->get_error_message() : ($upd['message'] ?? 'Error updating Supabase');
                wp_send_json_error(['message' => 'Gagal memperbarui laporan di Supabase: ' . $err_msg]);
                return;
            }
            $report_id = $id;
        } else {
            $ins = PTV_Supabase::insert('ptv_lapor_masalah', $data);
            if (is_wp_error($ins) && str_contains(strtolower($ins->get_error_message()), 'column')) {
                unset($data['unit_no'], $data['unit_code'], $data['inventaris_id'], $data['inventaris_unit_id']);
                $ins = PTV_Supabase::insert('ptv_lapor_masalah', $data);
            }
            if (is_wp_error($ins) || !is_array($ins) || empty($ins[0]['id'])) {
                $err_msg = is_wp_error($ins) ? $ins->get_error_message() : (is_array($ins) && isset($ins['message']) ? $ins['message'] : 'Gagal insert ke Supabase.');
                wp_send_json_error(['message' => 'Gagal mencatat laporan kerusakan ke database Supabase: ' . $err_msg]);
                return;
            }
            $report_id = (string)$ins[0]['id'];
        }

        // Sinkronisasi status kerusakan langsung ke Supabase ptv_inventaris_unit
        if (!empty($alat_id) && strlen($alat_id) === 36) {
            $target_u = intval($unit_no ?: 1);
            PTV_Supabase::update_where('ptv_inventaris_unit', [
                'inventaris_id' => $alat_id,
                'nomor_unit'    => $target_u,
            ], [
                'kondisi'    => 'Rusak',
                'status'     => 'Rusak',
                'updated_at' => gmdate('Y-m-d\TH:i:s\Z')
            ]);
        }

        // Notifikasi ke seluruh Eksekutif aktif saat laporan kerusakan baru dicatat
        if (empty($id)) {
            ptv_notify_all_exec_admin(
                'damage',
                'Laporan Kerusakan Baru',
                "{$pelapor} melaporkan masalah pada {$nama_alat}.",
                [
                    'entity_type' => 'lapor_masalah',
                    'entity_id'   => $report_id,
                    'action_url'  => 'dasbor?tab=lapor',
                ]
            );
        }

        // Sinkronisasi status kerusakan ke Supabase ptv_aset HANYA untuk unit terkait
        if (!empty($alat_id) && strlen($alat_id) === 36) {
            $aset_row = PTV_Supabase::find('ptv_aset', $alat_id);
            $total_units = max(1, intval($aset_row['jumlah'] ?? 1));
            if ($total_units <= 1) {
                PTV_Supabase::update_by_id('ptv_aset', $alat_id, [
                    'status'  => 'maintenance',
                    'kondisi' => 'rusak',
                ]);
            } else {
                // Update kondisi unit di PTV_META ptv_aset
                $raw_k = $aset_row['keterangan'] ?? '';
                $meta_a = [];
                if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $raw_k, $mam)) {
                    $meta_a = json_decode($mam[1], true) ?: [];
                }
                $u_conds = $meta_a['unit_conditions'] ?? [];
                if (!is_array($u_conds) || empty($u_conds)) {
                    for ($u = 1; $u <= $total_units; $u++) {
                        $u_conds[] = ['unit' => $u, 'cond' => 'Baik'];
                    }
                }
                $target_u = intval($unit_no ?: 1);
                foreach ($u_conds as &$uc) {
                    if (intval($uc['unit'] ?? 0) === $target_u) {
                        $uc['cond'] = 'Rusak';
                    }
                }
                unset($uc);
                $meta_a['unit_conditions'] = $u_conds;
                $clean_k = trim(preg_replace('/<!-- PTV_META:.*?-->/s', '', $raw_k));

                // Cek apakah seluruh unit sekarang rusak
                $all_damaged = true;
                foreach ($u_conds as $uc) {
                    if (($uc['cond'] ?? '') !== 'Rusak') { $all_damaged = false; break; }
                }

                $aset_upd = [
                    'keterangan' => $clean_k . "\n<!-- PTV_META: " . wp_json_encode($meta_a) . " -->",
                ];
                if ($all_damaged) {
                    $aset_upd['status'] = 'maintenance';
                    $aset_upd['kondisi'] = 'rusak';
                }
                PTV_Supabase::update_by_id('ptv_aset', $alat_id, $aset_upd);
            }
            delete_transient('ptv_inventaris_list_v1');
        }

        ptv_realtime_broadcast_change('ptv_lapor_masalah', 'damages', 'INSERT', $report_id);

        wp_send_json_success([
            'message'   => 'Laporan kerusakan berhasil disimpan ke Supabase.',
            'report_id' => $report_id,
            'id'        => $report_id,
            'record'    => array_merge($data, ['id' => $report_id]),
        ]);
        return;
    }

    wp_send_json_error(['message' => 'Database Supabase tidak terhubung.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: UPDATE STATUS & QUALITY CHECK (SUPABASE ptv_lapor_masalah)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_update_lapor_masalah_status', 'ptv_dashboard_action_update_damage_qc_cb');
add_action('wp_ajax_nopriv_ptv_update_lapor_masalah_status', 'ptv_dashboard_action_update_damage_qc_cb');
add_action('wp_ajax_ptv_dashboard_action_update_damage_qc', 'ptv_dashboard_action_update_damage_qc_cb');
function ptv_dashboard_action_update_damage_qc_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $report_id = sanitize_text_field($_POST['report_id'] ?? ($_POST['id'] ?? ''));
    $status_in = sanitize_text_field($_POST['status'] ?? 'dicek');
    $qc_by     = sanitize_text_field($_POST['qc_by'] ?? ($_SESSION['ptv_admin_name'] ?? ($_SESSION['ptv_crew_name'] ?? 'Eksekutif PTV')));
    $qc_notes  = sanitize_textarea_field($_POST['qc_notes'] ?? ($_POST['catatan_admin'] ?? ''));
    $qc_status = sanitize_text_field($_POST['qc_status'] ?? $status_in);

    // 1. HANYA ROLE EKSEKUTIF YANG BERWENANG MELAKUKAN QUALITY CHECK
    $is_exec = (!empty($_SESSION['ptv_admin_logged_in']) && ($_SESSION['ptv_admin_role'] ?? '') === 'executive') 
               || (!empty($_SESSION['ptv_crew_role']) && strtolower($_SESSION['ptv_crew_role']) === 'eksekutif')
               || (function_exists('ptv_is_eksekutif') && ptv_is_eksekutif())
               || current_user_can('manage_options');

    if (!$is_exec) {
        wp_send_json_error(['message' => 'Akses ditolak: Hanya peran Eksekutif yang berwenang melakukan Quality Check peralatan.']);
        return;
    }

    if (empty($report_id)) {
        wp_send_json_error(['message' => 'ID laporan tidak valid.']);
        return;
    }

    // 2. CEK APAKAH SUDAH DI-QC SEBELUMNYA DI SUPABASE (KUNCI AGAR TIDAK BISA DIISI KEMBALI)
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($report_id) === 36) {
        $existing = PTV_Supabase::find('ptv_lapor_masalah', $report_id);
        if (is_array($existing)) {
            $already_qced = !empty($existing['qc_by']) || !empty($existing['qc_date']) || strtolower($existing['status'] ?? '') === 'selesai';
            if ($already_qced) {
                wp_send_json_error(['message' => 'Peralatan ini sudah selesai di-Quality Check dan terkunci. Formulir tidak dapat diisi kembali.']);
                return;
            }
        }
    }

    $normalized_status = in_array(strtolower($status_in), ['selesai', 'siap pakai'], true) ? 'Selesai' : (in_array(strtolower($status_in), ['baru'], true) ? 'Baru' : 'Sedang Dicek');

    $update_fields = [
        'status'     => $normalized_status,
        'qc_by'      => $qc_by,
        'qc_date'    => date('Y-m-d'),
        'qc_notes'   => $qc_notes,
        'qc_status'  => $qc_status,
        'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    ];

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($report_id) === 36) {
        $upd = PTV_Supabase::update_by_id('ptv_lapor_masalah', $report_id, $update_fields);
        if (is_wp_error($upd) || (is_array($upd) && isset($upd['code']))) {
            $err_msg = is_wp_error($upd) ? $upd->get_error_message() : ($upd['message'] ?? 'Error updating Supabase');
            wp_send_json_error(['message' => 'Gagal memperbarui QC di Supabase: ' . $err_msg]);
            return;
        }

        // Ambil data laporan untuk sinkronisasi status alat & unit terkait
        $rep = PTV_Supabase::find('ptv_lapor_masalah', $report_id);
        if (is_array($rep) && !empty($rep['alat_id']) && strlen($rep['alat_id']) === 36) {
            $aid = $rep['alat_id'];
            $u_no = intval($rep['unit_no'] ?? 0);
            if (empty($u_no) && !empty($rep['keterangan']) && preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $rep['keterangan'], $rmm)) {
                $r_meta = json_decode($rmm[1], true) ?: [];
                $u_no = intval($r_meta['unit_no'] ?? 0);
            }

            $aset_row = PTV_Supabase::find('ptv_aset', $aid);
            $total_units = max(1, intval($aset_row['jumlah'] ?? 1));

            if ($normalized_status === 'Selesai') {
                if ($total_units <= 1) {
                    PTV_Supabase::update_by_id('ptv_aset', $aid, ['status' => 'available', 'kondisi' => 'baik']);
                } else {
                    $raw_k = $aset_row['keterangan'] ?? '';
                    $meta_a = [];
                    if (preg_match('/<!-- PTV_META:\s*({.*?})\s*-->/s', $raw_k, $mam)) {
                        $meta_a = json_decode($mam[1], true) ?: [];
                    }
                    $u_conds = $meta_a['unit_conditions'] ?? [];
                    if (is_array($u_conds)) {
                        foreach ($u_conds as &$uc) {
                            if (intval($uc['unit'] ?? 0) === $u_no || empty($u_no)) {
                                $uc['cond'] = 'Baik';
                            }
                        }
                        unset($uc);
                        $meta_a['unit_conditions'] = $u_conds;
                        $clean_k = trim(preg_replace('/<!-- PTV_META:.*?-->/s', '', $raw_k));
                        PTV_Supabase::update_by_id('ptv_aset', $aid, [
                            'status'     => 'available',
                            'keterangan' => $clean_k . "\n<!-- PTV_META: " . wp_json_encode($meta_a) . " -->",
                        ]);
                    }
                }

                // Sinkronisasi status dan kondisi unit pulih ke ptv_inventaris_unit
                if ($u_no > 0) {
                    PTV_Supabase::update_where('ptv_inventaris_unit', [
                        'inventaris_id' => $aid,
                        'nomor_unit'    => $u_no,
                    ], [
                        'kondisi'    => 'Baik',
                        'status'     => 'Tersedia',
                        'updated_at' => gmdate('Y-m-d\TH:i:s\Z')
                    ]);
                }
            } elseif ($normalized_status === 'Sedang Dicek') {
                if ($total_units <= 1) {
                    PTV_Supabase::update_by_id('ptv_aset', $aid, ['status' => 'maintenance']);
                }
                if ($u_no > 0) {
                    PTV_Supabase::update_where('ptv_inventaris_unit', [
                        'inventaris_id' => $aid,
                        'nomor_unit'    => $u_no,
                    ], [
                        'status'     => 'Sedang Dicek',
                        'updated_at' => gmdate('Y-m-d\TH:i:s\Z')
                    ]);
                }
            }
            delete_transient('ptv_inventaris_list_v1');
        }

        // Notifikasi ke pelapor saat status laporan kerusakan berubah (Requirement #7)
        if (is_array($rep) && !empty($rep['pelapor_nama'])) {
            $reporter_id = ptv_resolve_crew_id($rep['pelapor_nama']);
            if (!empty($reporter_id)) {
                ptv_create_notification(
                    $reporter_id,
                    'damage',
                    "Status Laporan Kerusakan: {$normalized_status}",
                    "Laporan kerusakan untuk {$rep['nama_alat']} telah diubah menjadi {$normalized_status}.",
                    [
                        'entity_type' => 'lapor_masalah',
                        'entity_id'   => $report_id,
                        'action_url'  => 'dasbor?tab=lapor',
                    ]
                );
            }
        }
    }

    ptv_realtime_broadcast_change('ptv_lapor_masalah', 'damages', 'UPDATE', $report_id, ['status' => $normalized_status]);

    wp_send_json_success([
        'message'   => 'Hasil Quality Check berhasil disimpan ke Supabase.',
        'qc_by'     => $qc_by,
        'status'    => $normalized_status,
        'qc_status' => $qc_status,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: DELETE LAPORAN KERUSAKAN (SUPABASE ptv_lapor_masalah)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_damage', 'ptv_dashboard_action_delete_damage_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_damage', 'ptv_dashboard_action_delete_damage_cb');
function ptv_dashboard_action_delete_damage_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID laporan kerusakan wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        $del = PTV_Supabase::delete_by_id('ptv_lapor_masalah', $id);
        if (is_wp_error($del)) {
            wp_send_json_error(['message' => 'Gagal menghapus dari Supabase: ' . $del->get_error_message()]);
            return;
        }
    }

    ptv_realtime_broadcast_change('ptv_lapor_masalah', 'damages', 'DELETE', $id);

    wp_send_json_success(['message' => 'Laporan kerusakan berhasil dihapus dari database.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: KONTAK EKSTERNAL (ptv_kontak_eksternal)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_save_kontak_eksternal', 'ptv_dashboard_action_save_kontak_eksternal_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_save_kontak_eksternal', 'ptv_dashboard_action_save_kontak_eksternal_cb');
function ptv_dashboard_action_save_kontak_eksternal_cb() {
    global $wpdb;
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_authorized = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_authorized) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang mengelola Kontak Eksternal.']);
        return;
    }

    $id             = sanitize_text_field($_POST['id'] ?? '');
    $nama           = sanitize_text_field($_POST['nama'] ?? ($_POST['name'] ?? ''));
    $kategori       = sanitize_text_field($_POST['kategori'] ?? ($_POST['cat'] ?? 'Lainnya'));
    $jabatan        = sanitize_text_field($_POST['jabatan'] ?? ($_POST['pos'] ?? ''));
    $organisasi     = sanitize_text_field($_POST['organisasi'] ?? ($_POST['org'] ?? ''));
    $nomor_telepon  = sanitize_text_field($_POST['nomor_telepon'] ?? ($_POST['telepon'] ?? ($_POST['phone'] ?? '')));
    $whatsapp       = sanitize_text_field($_POST['whatsapp'] ?? ($_POST['wa'] ?? ''));
    $email          = sanitize_email($_POST['email'] ?? '');
    $alamat         = sanitize_textarea_field($_POST['alamat'] ?? '');
    $catatan        = sanitize_textarea_field($_POST['catatan'] ?? ($_POST['notes'] ?? ''));
    $foto_url       = esc_url_raw($_POST['foto_url'] ?? ($_POST['photo'] ?? ''));
    $status         = sanitize_text_field($_POST['status'] ?? 'Aktif');

    if (empty($nama)) {
        wp_send_json_error(['message' => 'Nama kontak eksternal wajib diisi.']);
        return;
    }

    if (empty($whatsapp) && !empty($nomor_telepon)) {
        $whatsapp = $nomor_telepon;
    }

    $now_iso = gmdate('Y-m-d\TH:i:s\Z');
    $now_mysql = current_time('mysql');
    $is_edit = (!empty($id) && $id !== 'null');
    $item_id = $is_edit ? $id : (function_exists('wp_generate_uuid4') ? wp_generate_uuid4() : uniqid('ke_'));

    $payload = [
        'nama'          => $nama,
        'kategori'      => $kategori ?: 'Lainnya',
        'jabatan'       => $jabatan,
        'organisasi'    => $organisasi,
        'nomor_telepon' => $nomor_telepon,
        'whatsapp'      => $whatsapp,
        'email'         => $email,
        'alamat'        => $alamat,
        'catatan'       => $catatan,
        'foto_url'      => $foto_url,
        'status'        => ucfirst(strtolower($status)),
        'updated_at'    => $now_iso,
    ];

    $saved = false;

    // 1. Supabase Persistence
    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured()) {
        if ($is_edit && strlen($id) === 36) {
            $upd = PTV_Supabase::update_by_id('ptv_kontak_eksternal', $id, $payload);
            if (!is_wp_error($upd) && (!is_array($upd) || !isset($upd['code']))) {
                $saved = true;
            }
        } else {
            $ins_payload = array_merge($payload, [
                'created_at' => $now_iso,
            ]);
            $ins = PTV_Supabase::insert('ptv_kontak_eksternal', $ins_payload);
            if (is_array($ins) && !empty($ins[0]['id'])) {
                $item_id = (string)$ins[0]['id'];
                $saved = true;
            }
        }
    }

    // 2. Local WP DB Dual Persistence
    $tbl = $wpdb->prefix . 'ptv_kontak_eksternal';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl}'") === $tbl) {
        $local_data = [
            'id'            => $item_id,
            'nama'          => $nama,
            'kategori'      => $kategori ?: 'Lainnya',
            'jabatan'       => $jabatan,
            'organisasi'    => $organisasi,
            'nomor_telepon' => $nomor_telepon,
            'whatsapp'      => $whatsapp,
            'email'         => $email,
            'alamat'        => $alamat,
            'catatan'       => $catatan,
            'foto_url'      => $foto_url,
            'status'        => ucfirst(strtolower($status)),
            'updated_at'    => $now_mysql,
        ];
        $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$tbl} WHERE id = %s", $item_id));
        if ($exists) {
            $wpdb->update($tbl, $local_data, ['id' => $item_id]);
        } else {
            $local_data['created_at'] = $now_mysql;
            $wpdb->insert($tbl, $local_data);
        }
        $saved = true;
    }

    wp_send_json_success([
        'message' => $is_edit ? 'Kontak eksternal berhasil diperbarui.' : 'Kontak eksternal baru berhasil ditambahkan.',
        'item'    => array_merge($payload, [
            'id'         => $item_id,
            'created_at' => $now_iso,
        ]),
    ]);
}

add_action('wp_ajax_ptv_dashboard_action_delete_kontak_eksternal', 'ptv_dashboard_action_delete_kontak_eksternal_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_kontak_eksternal', 'ptv_dashboard_action_delete_kontak_eksternal_cb');
function ptv_dashboard_action_delete_kontak_eksternal_cb() {
    global $wpdb;
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_authorized = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_authorized) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang menghapus Kontak Eksternal.']);
        return;
    }

    $id = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id)) {
        wp_send_json_error(['message' => 'ID kontak wajib diisi.']);
        return;
    }

    if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($id) === 36) {
        PTV_Supabase::delete_by_id('ptv_kontak_eksternal', $id);
    }

    $tbl = $wpdb->prefix . 'ptv_kontak_eksternal';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl}'") === $tbl) {
        $wpdb->delete($tbl, ['id' => $id]);
    }

    wp_send_json_success(['message' => 'Kontak eksternal berhasil dihapus.']);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: SUMBER INVENTARIS (+ Tambah Sumber Baru)
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_add_inventory_source', 'ptv_dashboard_action_add_inventory_source_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_add_inventory_source', 'ptv_dashboard_action_add_inventory_source_cb');
// ── AJAX HANDLER: PROXY IMAGE TO BASE64 (Untuk ID Card & Canvas Render) ──
add_action('wp_ajax_ptv_dashboard_action_proxy_base64', 'ptv_dashboard_action_proxy_base64_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_proxy_base64', 'ptv_dashboard_action_proxy_base64_cb');
function ptv_dashboard_action_proxy_base64_cb() {
    $raw_url = trim((string)($_GET['url'] ?? ($_POST['url'] ?? '')));
    if (empty($raw_url)) {
        wp_send_json_error(['message' => 'URL gambar tidak boleh kosong.']);
        return;
    }
    
    if (str_starts_with($raw_url, '/')) {
        $raw_url = home_url($raw_url);
    }
    
    $response = wp_remote_get($raw_url, [
        'timeout'    => 20,
        'sslverify'  => false,
        'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProgresifTV/2.0'
    ]);
    
    if (is_wp_error($response)) {
        wp_send_json_error(['message' => $response->get_error_message()]);
        return;
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code < 200 || $status_code >= 300) {
        wp_send_json_error(['message' => "HTTP status code: $status_code"]);
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    if (empty($body)) {
        wp_send_json_error(['message' => 'Konten gambar kosong.']);
        return;
    }
    
    $content_type = wp_remote_retrieve_header($response, 'content-type');
    if (empty($content_type) || strpos($content_type, 'image') === false) {
        $ext = strtolower(pathinfo(parse_url($raw_url, PHP_URL_PATH), PATHINFO_EXTENSION));
        $mime_map = [
            'webp' => 'image/webp',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'svg'  => 'image/svg+xml',
            'gif'  => 'image/gif'
        ];
        $content_type = $mime_map[$ext] ?? 'image/jpeg';
    }
    
    $data_uri = 'data:' . $content_type . ';base64,' . base64_encode($body);
    wp_send_json_success(['data_uri' => $data_uri]);
}

function ptv_dashboard_action_add_inventory_source_cb() {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_authorized = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_authorized) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang menambah Sumber Perolehan Inventaris.']);
        return;
    }

    $new_source = sanitize_text_field($_POST['source'] ?? ($_POST['sumber'] ?? ''));
    if (empty($new_source)) {
        wp_send_json_error(['message' => 'Nama sumber perolehan tidak boleh kosong.']);
        return;
    }

    $default_sources = ['Yayasan', 'Hibah Kementerian', 'Dana Perusahaan', 'Kas Organisasi', 'Hibah Pribadi'];
    $stored = get_option('ptv_inventory_sources', []);
    if (!is_array($stored)) $stored = [];

    if (!in_array($new_source, $stored, true) && !in_array($new_source, $default_sources, true)) {
        $stored[] = $new_source;
        update_option('ptv_inventory_sources', $stored, false);
    }

    $all_sources = array_values(array_unique(array_filter(array_merge($default_sources, $stored))));

    wp_send_json_success([
        'message' => 'Sumber perolehan baru berhasil ditambahkan.',
        'source'  => $new_source,
        'sources' => $all_sources,
    ]);
}

// ─────────────────────────────────────────────────────────────
// AJAX HANDLER: DELETE DOKUMEN / SURAT (SUPABASE + LOCAL DB)
// Supported: ptv_surat_tugas (st_), ptv_surat_barang (sbb_), ptv_surat_izin (si_)
// Permission: Eksekutif & Administrasi only
// ─────────────────────────────────────────────────────────────
add_action('wp_ajax_ptv_dashboard_action_delete_doc', 'ptv_dashboard_action_delete_doc_cb');
add_action('wp_ajax_nopriv_ptv_dashboard_action_delete_doc', 'ptv_dashboard_action_delete_doc_cb');
function ptv_dashboard_action_delete_doc_cb() {
    global $wpdb;
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (function_exists('ptv_require_dashboard_ajax_access')) {
        ptv_require_dashboard_ajax_access();
    }

    $raw_role = strtolower(trim((string)($_SESSION['ptv_admin_role'] ?? 'kru')));
    $is_authorized = in_array($raw_role, ['executive', 'eksekutif', 'administrasi', 'admin'], true) || current_user_can('manage_options');
    if (!$is_authorized) {
        wp_send_json_error(['message' => 'Hanya peran Eksekutif dan Administrasi yang berwenang menghapus data surat.']);
        return;
    }

    $id_raw = sanitize_text_field($_POST['id'] ?? '');
    if (empty($id_raw)) {
        wp_send_json_error(['message' => 'ID surat wajib diisi.']);
        return;
    }

    $is_st  = str_starts_with($id_raw, 'st_');
    $is_sbb = str_starts_with($id_raw, 'sbb_') || str_starts_with($id_raw, 'sb_');
    $is_si  = str_starts_with($id_raw, 'si_');
    $clean_uuid = preg_replace('/^(st_|sbb_|sb_|si_)/', '', $id_raw);
    $num_id = (int)preg_replace('/[^0-9]/', '', $id_raw);

    $tables_to_try = [];
    if ($is_st) {
        $tables_to_try[] = ['sb' => 'ptv_surat_tugas', 'local' => $wpdb->prefix . 'ptv_surat_tugas'];
    } elseif ($is_sbb) {
        $tables_to_try[] = ['sb' => 'ptv_surat_barang', 'local' => $wpdb->prefix . 'ptv_surat_barang'];
    } elseif ($is_si) {
        $tables_to_try[] = ['sb' => 'ptv_surat_izin', 'local' => $wpdb->prefix . 'ptv_surat_izin'];
    } else {
        // Fallback: coba semua 3 tabel surat
        $tables_to_try = [
            ['sb' => 'ptv_surat_izin', 'local' => $wpdb->prefix . 'ptv_surat_izin'],
            ['sb' => 'ptv_surat_tugas', 'local' => $wpdb->prefix . 'ptv_surat_tugas'],
            ['sb' => 'ptv_surat_barang', 'local' => $wpdb->prefix . 'ptv_surat_barang']
        ];
    }

    $deleted_supabase = false;
    $deleted_local = false;

    foreach ($tables_to_try as $tbl_info) {
        $table_name = $tbl_info['sb'];
        $local_table = $tbl_info['local'];

        // Supabase DELETE
        if (class_exists('PTV_Supabase') && PTV_Supabase::is_configured() && strlen($clean_uuid) === 36) {
            $check = PTV_Supabase::select($table_name, '?id=eq.' . urlencode($clean_uuid) . '&limit=1');
            if (is_array($check) && !empty($check[0])) {
                $del = PTV_Supabase::delete_by_id($table_name, $clean_uuid);
                if (!is_wp_error($del)) {
                    $deleted_supabase = true;
                }
            }
        }

        // Local DB DELETE (if exists)
        if ($num_id > 0 && !empty($local_table)) {
            if ($wpdb->get_var("SHOW TABLES LIKE '{$local_table}'") === $local_table) {
                $exists = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$local_table} WHERE id = %d", $num_id));
                if ($exists) {
                    $wpdb->delete($local_table, ['id' => $num_id]);
                    $deleted_local = true;
                }
            }
        }

        if ($deleted_supabase || $deleted_local) {
            break;
        }
    }

    if (!$deleted_supabase && !$deleted_local) {
        wp_send_json_error(['message' => 'Data surat tidak ditemukan di database.']);
        return;
    }

    if (function_exists('ptv_sync_surat_sequence')) {
        $del_type = $is_st ? 'st' : ($is_sbb ? 'sbb' : 'si');
        ptv_sync_surat_sequence($del_type, date('Y'));
    }

    wp_send_json_success(['message' => 'Data surat berhasil dihapus permanen dari database.']);
}


