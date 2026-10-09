<?php
/*
Template Name: Halaman Aset PPBS
*/

// ==========================================
// 1. ENGINE & SECURITY INIT (PIN AUTH)
// ==========================================
ob_start(); 
if (!defined('DONOTCACHEPAGE')) { define('DONOTCACHEPAGE', true); }
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

// Boot session untuk mendeteksi login dashboard PTV
if (function_exists('ptv_dashboard_session_boot')) {
    ptv_dashboard_session_boot();
} elseif (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Konfigurasi PIN Akses (Ubah 4 digit ini jika ingin mengganti sandi)
$correct_pin = '1818'; 
$cookie_name = 'ptv_asset_auth_pin';
$cookie_duration = time() + (3 * 24 * 60 * 60); // 3 Hari (Tersimpan terus)

// Verifikasi Token Kredensial Rahasia dari Dashboard PTV (Bypass PIN hanya jika token valid)
$passed_token   = sanitize_text_field($_GET['auth_token'] ?? '');
$admin_nonce    = $_SESSION['ptv_admin_nonce'] ?? '';
$expected_token = !empty($admin_nonce) ? md5($admin_nonce . 'ptv_asset_secure_salt') : '';

$is_valid_dashboard_token = !empty($_SESSION['ptv_admin_logged_in']) 
    && !empty($passed_token) 
    && !empty($expected_token) 
    && hash_equals($expected_token, $passed_token);

if ($is_valid_dashboard_token) {
    if (!isset($_COOKIE[$cookie_name]) || $_COOKIE[$cookie_name] !== md5($correct_pin)) {
        setcookie($cookie_name, md5($correct_pin), $cookie_duration, '/');
        $_COOKIE[$cookie_name] = md5($correct_pin);
    }
}

// Proses Logout (Manual via tombol Kunci)
if (isset($_GET['logout'])) {
    setcookie($cookie_name, '', time() - 3600, '/');
    wp_redirect(strtok($_SERVER["REQUEST_URI"], '?'));
    exit;
}

// Proses Submit PIN
$login_error = '';
if (isset($_POST['ptv_pin_submit'])) {
    $input_pin = trim($_POST['ptv_pin']);
    if ($input_pin === $correct_pin) {
        // Enkripsi PIN ke dalam cookie agar aman
        setcookie($cookie_name, md5($correct_pin), $cookie_duration, '/');
        wp_redirect(strtok($_SERVER["REQUEST_URI"], '?'));
        exit;
    } else {
        $login_error = 'PIN rahasia salah!';
    }
}

// Pengecekan Cookie / Auth State
$is_logged_in = (isset($_COOKIE[$cookie_name]) && $_COOKIE[$cookie_name] === md5($correct_pin)) || $is_valid_dashboard_token;

if (!$is_logged_in) {
    // TAMPILAN LOGIN PIN KHUSUS ASET
    ?>
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <title>Akses Terkunci | Aset PTV</title>
        <meta name="robots" content="noindex, nofollow">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; background-image: radial-gradient(rgba(148, 163, 184, 0.4) 1.5px, transparent 1.5px); background-size: 30px 30px; }
            .login-container { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); padding: 50px 40px; border-radius: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); max-width: 400px; width: 90%; box-sizing: border-box; border: 1px solid rgba(255,255,255,0.5); text-align: center; }
            .login-logo { width: 70px; margin-bottom: 25px; filter: invert(1); opacity: 0.8;}
            .login-title { font-weight: 800; color: #093329; margin: 0 0 10px; font-size: 26px; letter-spacing: -0.5px;}
            .login-desc { color: #64748b; margin: 0 0 30px; font-size: 14px; line-height: 1.6;}
            .error-box { background: #fee2e2; color: #ef4444; padding: 12px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px;}
            .input-group { margin-bottom: 20px; position: relative; }
            .input-group input { width: 100%; padding: 18px 20px; border: 1.5px solid #e2e8f0; border-radius: 16px; font-size: 24px; font-family: inherit; box-sizing: border-box; outline: none; transition: 0.3s; background: #f8fafc; color: #0f172a; font-weight: 800; text-align: center; letter-spacing: 15px;}
            .input-group input:focus { border-color: #0e4f40; background: #fff; box-shadow: 0 0 0 4px rgba(14, 79, 64, 0.1); }
            
            .btn-login { width: 100%; background: #0e4f40; color: #fff; border: none; padding: 16px; border-radius: 14px; font-weight: 800; font-family: inherit; cursor: pointer; transition: 0.3s; font-size: 15px; letter-spacing: 0.5px; margin-bottom: 15px; }
            .btn-login:hover { background: #093329; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(14, 79, 64, 0.25); }
            
            .btn-wa { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; text-decoration: none; background: rgba(37, 211, 102, 0.1); color: #16a34a; padding: 14px; border-radius: 14px; font-weight: 700; font-size: 13px; transition: 0.3s; box-sizing: border-box; margin-bottom: 10px; border: 1px solid rgba(37, 211, 102, 0.2); }
            .btn-wa:hover { background: #25D366; color: #fff; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(37, 211, 102, 0.2); }
            
            .btn-back { display: inline-block; width: 100%; text-decoration: none; background: #f1f5f9; color: #334155; padding: 14px; border-radius: 14px; font-weight: 700; font-size: 14px; transition: 0.2s; box-sizing: border-box;}
            .btn-back:hover { background: #e2e8f0; color: #0f172a; }

            /* UX MOBILE OPTIMIZATION */
            @media (max-width: 480px) {
                .login-container { padding: 40px 25px; width: 92%; }
                .login-title { font-size: 22px; }
                .login-desc { font-size: 13px; margin-bottom: 25px; }
                .input-group input { font-size: 20px; letter-spacing: 10px; padding: 16px; }
                .btn-wa { font-size: 12px; }
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <img src="<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('LOGO-NON-RESMI.webp') : '/wp-content/uploads/LOGO-NON-RESMI.webp'; ?>" alt="Logo PTV" class="login-logo" onerror="this.onerror=null; this.src='/wp-content/uploads/LOGO-NON-RESMI.webp'">
            <h2 class="login-title">Akses Terkunci</h2>
            <p class="login-desc">Masukkan 4 digit PIN rahasia untuk membuka direktori Aset PPBS.</p>
            <?php if ($login_error): ?><div class="error-box"><i class="fa-solid fa-triangle-exclamation"></i> <?php echo $login_error; ?></div><?php endif; ?>
            <form method="POST" action="">
                <div class="input-group">
                    <input type="password" id="ptv_pin" name="ptv_pin" placeholder="••••" maxlength="4" pattern="\d{4}" inputmode="numeric" required autofocus autocomplete="off">
                </div>
                <button type="submit" name="ptv_pin_submit" class="btn-login">BUKA ASET</button>
            </form>
            
            <a href="https://wa.me/6285334340616?text=Halo%20Admin%20Zidnal%2C%20saya%20butuh%20akses%20ke%20direktori%20Aset%20PTV.%20Boleh%20minta%20PIN-nya%3F" target="_blank" class="btn-wa">
                <i class="fa-brands fa-whatsapp"></i> Belum tau PIN-nya? WA Admin PTV
            </a>
            
            <a href="<?php echo home_url('/'); ?>" class="btn-back"><i class="fa-solid fa-arrow-left"></i> Kembali ke Beranda</a>
        </div>
        <script>
            // Paksa input hanya bisa diketik angka
            document.getElementById('ptv_pin').addEventListener('input', function (e) {
                this.value = this.value.replace(/[^0-9]/g, '');
            });
        </script>
    </body>
    </html>
    <?php
    exit;
}
?>
<!DOCTYPE html>
<html lang="id" <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Aset Resmi Yayasan Bumi Shalawat | Progresif TV</title>
  
  <meta name="description" content="Direktori aset visual resmi Yayasan Bumi Shalawat Progresif. Download logo, foto Keluarga Ndalem, dan panduan desain.">
  <meta name="robots" content="index, follow">

  <!-- ================= OG IMAGE SEO ================= -->
  <meta property="og:title" content="Aset Resmi Yayasan Bumi Shalawat Progresif">
  <meta property="og:description" content="Akses cepat seluruh file aset multimedia resmi.">
  <meta property="og:image" content="<?php echo ptv_smart_img('LOGO-NON-RESMI.webp'); ?>">
  <meta property="og:type" content="website">

  <!-- Font & Icons -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  
  <!-- Main Theme Stylesheet & JS -->
  <link rel="stylesheet" href="<?php echo get_stylesheet_uri(); ?>?v=<?php echo time(); ?>">
  <script src="<?php echo get_template_directory_uri(); ?>/js/main.js?v=<?php echo time(); ?>" defer></script>

  <style>
    /* ========================================================= */
    /* TEMA BENTO-GLASSMORPHISM MASTERPIECE PTV                  */
    /* ========================================================= */
    :root {
      --ptv-bg: #f4f7f6;
      --ptv-green: #0e4f40;
      --ptv-green-light: #16a34a;
      --ptv-gold: #c5a35a;
      --ptv-gold-light: #fcd34d;
      --ptv-dark: #0f172a;
      --ptv-text: #475569;
      --ptv-border: rgba(14, 79, 64, 0.08);
      --ptv-glass: rgba(255, 255, 255, 0.7);
      --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* GLOBAL RESET: Pengecualian pada ikon agar Font Awesome tetap muncul */
    html, body {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .asset-wrapper *:not([class*="fa-"]):not(i), .ptv-mega-footer *:not([class*="fa-"]):not(i) {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .asset-wrapper a, .ptv-mega-footer a {
      text-decoration: none;
      color: inherit;
    }

    body {
      background-color: var(--ptv-bg);
      color: var(--ptv-text);
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
      margin: 0;
    }

    /* 1. ANIMATED BACKGROUND ELEMENTS */
    .bg-aurora {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -2;
      background: radial-gradient(circle at 10% 30%, rgba(14,79,64,0.06), transparent 40%),
                  radial-gradient(circle at 90% 80%, rgba(197,163,90,0.08), transparent 50%);
      animation: float-bg 20s infinite alternate ease-in-out;
    }
    @keyframes float-bg { 0% { transform: scale(1) translate(0, 0); } 100% { transform: scale(1.1) translate(20px, 10px); } }
    
    .bg-grain {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
      opacity: 0.3; pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    /* 2. MAIN CONTAINER */
    .asset-wrapper { padding: 160px 20px 0; max-width: 1240px; margin: 0 auto; position: relative; z-index: 2; }

    /* 3. HERO DESIGN */
    .hero-section { text-align: center; max-width: 850px; margin: 0 auto 80px; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--ptv-border);
      color: var(--ptv-green); font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
      padding: 8px 20px; border-radius: 100px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);
    }
    .hero-badge i { color: var(--ptv-gold); font-size: 14px; }
    .hero-title {
      font-size: clamp(34px, 6vw, 64px); font-weight: 800; color: var(--ptv-dark); margin: 0 0 20px;
      letter-spacing: -2px; line-height: 1;
    }
    .hero-title span { background: linear-gradient(135deg, var(--ptv-green) 0%, var(--ptv-gold) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-desc { font-size: 17px; font-weight: 600; color: var(--ptv-dark); line-height: 1.6; }

    /* 4. BENTO GRID CORE */
    .bento-grid {
      display: grid; grid-template-columns: repeat(1, 1fr); gap: 24px;
      grid-auto-rows: minmax(180px, auto); margin-bottom: 60px;
    }
    @media (min-width: 768px) { .bento-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1024px) { .bento-grid { grid-template-columns: repeat(4, 1fr); } }

    .bento-card {
      background: var(--ptv-glass); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.9); border-radius: 36px;
      padding: 28px; position: relative; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 10px 30px rgba(0,0,0,0.03), inset 0 2px 4px rgba(255,255,255,1);
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bento-card:hover {
      transform: translateY(-8px) scale(1.01);
      box-shadow: 0 30px 60px rgba(14,79,64,0.12);
      border-color: rgba(14,79,64,0.2);
    }

    /* UX Tombol CTA (Tampil sangat jelas) */
    .card-cta-btn {
      display: inline-flex; align-items: center; gap: 8px; margin-top: 5px; padding: 12px 20px;
      background: var(--ptv-green); color: #fff; border-radius: 100px; font-size: 13px; font-weight: 800;
      width: fit-content; transition: 0.3s; box-shadow: 0 4px 15px rgba(14, 79, 64, 0.3);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card-cta-btn i { font-size: 16px; transition: transform 0.3s; }
    .bento-card:hover .card-cta-btn { background: var(--ptv-gold); color: var(--ptv-dark); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(197, 163, 90, 0.4); border-color: #fff;}
    .bento-card:hover .card-cta-btn i { transform: scale(1.1); }

    /* BENTO SPLIT (GAMBAR ATAS, TEKS BAWAH) */
    .bento-split { padding: 0; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.9); }
    .bento-split .img-box { width: 100%; min-height: 240px; flex-grow: 1; position: relative; overflow: hidden; border-bottom: 1px solid var(--ptv-border); }
    .bento-split .img-box img { width: 100%; height: 100%; object-fit: cover; transition: 0.8s var(--ease-spring); }
    .bento-split:hover .img-box img { transform: scale(1.05); }
    .bento-split .tag { position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); color: var(--ptv-green-dark); padding: 8px 16px; border-radius: 50px; font-size: 11px; font-weight: 800; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,0,0,0.1); z-index: 2;}
    .bento-split .text-box { padding: 30px; display: flex; flex-direction: column; flex-grow: 0; background: var(--ptv-glass); justify-content: center; }
    .bento-split .text-box h3 { font-size: 24px; font-weight: 800; color: var(--ptv-dark); margin: 0 0 10px; letter-spacing: -0.5px;}
    .bento-split .text-box p { font-size: 15px; color: var(--ptv-dark); margin: 0 0 15px; line-height: 1.6; font-weight: 500; } /* Kontras ditingkatkan */

    /* STANDAR BENTO ICON */
    .icon-box { width: 56px; height: 56px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 25px; transition: 0.4s var(--ease-spring);}
    .bento-card:hover .icon-box { transform: scale(1.2) rotate(-10deg); }
    
    .bg-green-soft { background: rgba(34,197,94,0.12); color: #16a34a; }
    .bg-blue-soft { background: rgba(14,165,233,0.12); color: #0284c7; }
    .bg-gold-soft { background: rgba(197,163,90,0.12); color: var(--ptv-gold); }
    .bg-purple-soft { background: rgba(168,85,247,0.12); color: #9333ea; }

    .bento-text h3 { font-size: 20px; font-weight: 800; color: var(--ptv-dark); margin: 0 0 8px; line-height: 1.1; }
    .bento-text p { font-size: 14px; color: var(--ptv-dark); margin: 0 0 15px; line-height: 1.5; font-weight: 500; } /* Kontras ditingkatkan */

    .bento-list { padding: 35px; }
    .bento-list h3 { font-size: 18px; font-weight: 800; color: var(--ptv-dark); margin: 0 0 25px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--ptv-border); padding-bottom: 15px;}
    .bento-list h3 i { color: var(--ptv-gold); }
    .list-wrap { display: flex; flex-direction: column; gap: 14px; }
    .list-item { 
      display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; 
      background: rgba(255,255,255,0.4); border: 1px solid rgba(0,0,0,0.03); border-radius: 24px; 
      text-decoration: none; transition: 0.3s;
    }
    .list-item:hover { background: #fff; border-color: var(--ptv-green); transform: translateX(8px); box-shadow: 0 8px 25px rgba(14,79,64,0.06);}
    .list-item-text { font-size: 14px; font-weight: 800; color: var(--ptv-dark); display: flex; align-items: center; gap: 8px;}
    .list-item-sub { font-size: 12px; color: var(--ptv-muted); margin-top: 3px;}

    /* COPY & LINK INTERACTION - SEKARANG SELALU TAMPIL */
    .copy-btn {
      position: absolute; top: 20px; right: 20px; z-index: 10;
      width: 46px; height: 46px; border-radius: 50px; background: #fff;
      border: 1px solid rgba(0,0,0,0.1); /* Border agak tebal biar kentara */
      display: flex; align-items: center; justify-content: center; color: var(--ptv-text);
      cursor: pointer; transition: 0.3s var(--ease-spring);
      box-shadow: 0 4px 10px rgba(0,0,0,0.05); /* Shadow halus standby */
    }
    .copy-btn:hover { background: var(--ptv-green); color: #fff; border-color: var(--ptv-green); transform: scale(1.1); box-shadow: 0 8px 20px rgba(14, 79, 64, 0.2); }
    
    .list-copy-btn {
      width: 36px; height: 36px; border-radius: 12px; background: var(--ptv-green); color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 13px; transition: 0.2s; cursor: pointer; box-shadow: 0 4px 10px rgba(14,79,64,0.2);
    }
    .list-item:hover .list-copy-btn { background: var(--ptv-gold); color: #111; transform: scale(1.1);}

    /* ========================================================= */
    /* NEW: BENTO MEGA FOOTER (Integrated & Clean)               */
    /* ========================================================= */
    .ptv-mega-footer {
      margin-top: 100px;
      position: relative;
      background: var(--ptv-dark);
      border-top-left-radius: 60px;
      border-top-right-radius: 60px;
      color: #fff;
      padding: 80px 20px 40px;
      overflow: hidden;
    }
    .ptv-mega-footer::after {
      content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      opacity: 0.05; pointer-events: none; z-index: 1;
    }
    
    .footer-inner { max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
    
    .footer-grid {
      display: grid; grid-template-columns: 1fr; gap: 40px;
    }
    @media (min-width: 1024px) { .footer-grid { grid-template-columns: 1.2fr 1fr; align-items: center; } }
    
    .footer-cta-box h2 { font-size: clamp(24px, 4vw, 36px); font-weight: 800; margin-bottom: 15px; letter-spacing: -1px; }
    .footer-cta-box p { font-size: 16px; color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 30px; }

    .footer-social-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (min-width: 480px) { .footer-social-grid { grid-template-columns: repeat(4, 1fr); } }
    
    .social-pill {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); text-decoration: none; color: #fff;
      font-size: 13px; font-weight: 700; transition: 0.3s;
    }
    .social-pill:hover { background: #fff; color: var(--ptv-dark); transform: translateY(-5px); border-color: #fff; }

    /* HELP SECTION */
    .footer-help-box {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 32px; padding: 30px; text-align: center;
    }
    .footer-help-box h4 { font-size: 15px; font-weight: 800; margin-bottom: 10px; color: rgba(255,255,255,0.9); }
    .footer-help-box p { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 20px; }
    
    .btn-help-link {
      display: inline-flex; align-items: center; gap: 10px; background: var(--ptv-green-light);
      color: #fff; padding: 12px 28px; border-radius: 100px; text-decoration: none;
      font-size: 14px; font-weight: 800; transition: 0.3s;
    }
    .btn-help-link:hover { background: #fff; color: var(--ptv-dark); transform: scale(1.05); }

    .footer-bottom-line {
      margin-top: 60px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05);
      display: flex; flex-direction: column; gap: 15px; align-items: center; justify-content: space-between;
      color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 600;
    }
    @media (min-width: 768px) { .footer-bottom-line { flex-direction: row; } }

    /* Toast */
    .toast {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: var(--ptv-green); color: #fff; padding: 14px 28px; border-radius: 16px;
      font-weight: 700; font-size: 14px; box-shadow: 0 20px 40px rgba(14, 79, 64, 0.3);
      opacity: 0; transition: 0.5s var(--ease-spring); z-index: 99999;
      display: flex; align-items: center; gap: 10px;
    }
    .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

    /* TOMBOL FLOATING KUNCI AKSES */
    .btn-lock-float {
      position: fixed; bottom: 40px; right: 40px; z-index: 999;
      background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      padding: 12px 24px; border-radius: 100px; font-size: 13px; font-weight: 800;
      display: flex; align-items: center; gap: 8px; text-decoration: none;
      transition: 0.3s var(--ease-spring); box-shadow: 0 10px 30px rgba(239, 68, 68, 0.15);
    }
    .btn-lock-float:hover { background: #ef4444; color: #fff; transform: translateY(-5px); box-shadow: 0 15px 35px rgba(239, 68, 68, 0.3); }
    @media (max-width: 768px) { .btn-lock-float { bottom: 100px; right: 20px; padding: 10px 18px; font-size: 12px; } }

    @media (min-width: 1024px) {
      .lg-col-2 { grid-column: span 2; }
      .lg-row-2 { grid-row: span 2; }
    }
  </style>

  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
  
  <div class="bg-aurora"></div>
  <div class="bg-grain"></div>

  <!-- HEADER UTAMA PTV -->
  <header class="ptv-head">
    <div class="ptv-head__inner">
      <a class="ptv-logo" href="<?php echo home_url('/'); ?>">
        <img src="<?php echo ptv_smart_img('LOGO-NON-RESMI.webp'); ?>" alt="Logo Progresif TV" onerror="this.onerror=null; this.src='<?php echo ptv_smart_img('BENTOO.webp'); ?>';">
      </a>
      <nav class="ptv-nav">
        <a href="<?php echo home_url('/'); ?>">Beranda</a>
        <a href="<?php echo home_url('/event'); ?>">Acara</a>
        <a href="<?php echo home_url('/aset'); ?>">Aset</a>
        <a href="<?php echo home_url('/karya'); ?>">Galeri</a>
        <a href="<?php echo home_url('/tentang-kami'); ?>">Tentang Kami</a>
      </nav>
      <div class="ptv-soc">
        <a href="https://www.facebook.com/progresiftv" target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="https://www.instagram.com/progresiftv" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
        <a href="https://www.tiktok.com/@progresiftv" target="_blank" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
        <a href="https://www.youtube.com/@ProgresifTV" target="_blank" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
      </div>
    </div>
  </header>

  <main id="main-content" class="asset-wrapper">

    <!-- HERO SECTION -->
    <section class="hero-section reveal-up">
      <div class="hero-badge"><i class="fa-solid fa-folder-open"></i> PUSAT ARSIP RESMI</div>
      <h1 class="hero-title">Aset & <span>Identitas Visual</span></h1>
      <p class="hero-desc">Satu pintu untuk akses file master logo, dokumentasi resmi Keluarga Ndalem, dan panduan desain Yayasan Bumi Shalawat Progresif.</p>
    </section>

    <!-- BENTO GRID -->
    <div class="bento-grid">
      
      <!-- 1: Foto Abah Yai (Besar) -->
      <a href="https://drive.google.com/drive/folders/105btWwyVVoXNmNygSjw4MdCjV2c2aZJL?usp=sharing" target="_blank" class="bento-card bento-split lg-col-2 lg-row-2 reveal-up">
        <div class="copy-btn" data-url="https://drive.google.com/drive/folders/105btWwyVVoXNmNygSjw4MdCjV2c2aZJL?usp=sharing" data-title="Foto Abah Yai" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="img-box">
          <div class="tag">Penting</div>
          <img src="<?php echo ptv_smart_img('abah02.webp'); ?>" alt="Abah Yai">
        </div>
        <div class="text-box">
          <h3>Bank Foto Abah Yai</h3>
          <p>Koleksi potret resolusi tinggi Abuya KH. Agoes Ali Masyhuri. Silakan klik tombol di bawah untuk melihat dan mengunduh file foto master.</p>
          <div class="card-cta-btn"><i class="fa-brands fa-google-drive"></i> Buka Folder Drive</div>
        </div>
      </a>

      <!-- 2: Logo Yayasan -->
      <a href="https://drive.google.com/drive/folders/1fIu8Fr2YkDWf4hwzVixfO69ZcpuznfQU?usp=drive_link" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.1s;">
        <div class="copy-btn" data-url="https://drive.google.com/drive/folders/1fIu8Fr2YkDWf4hwzVixfO69ZcpuznfQU?usp=drive_link" data-title="Logo Yayasan" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-green-soft"><i class="fa-solid fa-shield-halved"></i></div>
        <div class="bento-text">
          <h3>Logo & Identitas</h3>
          <p>Master file unit pesantren format AI, PSD, dan gambar transparan.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-solid fa-download"></i> Download Master</div>
      </a>

      <!-- 3: Aset PTV -->
      <a href="https://drive.google.com/drive/folders/1VuedNuCWDwWdKIjwooDGs7pqPo94_L3z?usp=drive_link" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.2s;">
        <div class="copy-btn" data-url="https://drive.google.com/drive/folders/1VuedNuCWDwWdKIjwooDGs7pqPo94_L3z?usp=drive_link" data-title="Aset PTV" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-blue-soft"><i class="fa-solid fa-tv"></i></div>
        <div class="bento-text">
          <h3>Media PTV</h3>
          <p>Kumpulan video pembuka (bumper), teks nama, dan bingkai siaran langsung.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-brands fa-google-drive"></i> Buka Folder Drive</div>
      </a>

      <!-- 4: Foto Keluarga Ndalem -->
      <a href="https://drive.google.com/drive/folders/1XiP6ulYc2-0MPCMe1XXXcps_ynlwUjYv?usp=sharing" target="_blank" class="bento-card bento-split lg-col-2 reveal-up" style="transition-delay: 0.3s;">
        <div class="copy-btn" data-url="https://drive.google.com/drive/folders/1XiP6ulYc2-0MPCMe1XXXcps_ynlwUjYv?usp=sharing" data-title="Foto Keluarga Ndalem" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="img-box">
          <div class="tag">Dokumen Resmi</div>
          <img src="<?php echo ptv_smart_img('FOTO-KELUARGA-NDALEM-02_11zon.webp'); ?>" alt="Keluarga Ndalem">
        </div>
        <div class="text-box">
          <h3>Keluarga Ndalem</h3>
          <p>Dokumentasi foto resmi Keluarga Ndalem Yayasan Bumi Shalawat. Klik tombol di bawah untuk melihat arsip ukuran penuh.</p>
          <div class="card-cta-btn"><i class="fa-brands fa-google-drive"></i> Buka Folder Drive</div>
        </div>
      </a>

      <!-- 5: Dokumen PDF (List) -->
      <div class="bento-card bento-list lg-col-2 lg-row-2 reveal-up">
        <h3><i class="fa-solid fa-file-pdf"></i> Kumpulan Dokumen</h3>
        <div class="list-wrap">
          <a href="/wp-content/uploads/2025/01/PD_Kebijakan.pdf" target="_blank" class="list-item">
            <div>
              <div class="list-item-text"><i class="fa-regular fa-file-lines" style="color:var(--ptv-green)"></i> Kebijakan Yayasan</div>
              <div class="list-item-sub">Download file aturan internal terbaru</div>
            </div>
            <div class="list-copy-btn" data-url="/wp-content/uploads/2025/01/PD_Kebijakan.pdf" data-title="Kebijakan Yayasan" title="Salin Link URL"><i class="fa-solid fa-download"></i></div>
          </a>
          <a href="/wp-content/uploads/2025/02/Template_Undangan.pdf" target="_blank" class="list-item">
            <div>
              <div class="list-item-text"><i class="fa-regular fa-file-word" style="color:var(--ptv-gold)"></i> Template Undangan</div>
              <div class="list-item-sub">Download format standar surat resmi</div>
            </div>
            <div class="list-copy-btn" data-url="/wp-content/uploads/2025/02/Template_Undangan.pdf" data-title="Template Undangan" title="Salin Link URL"><i class="fa-solid fa-download"></i></div>
          </a>
          <a href="/wp-content/uploads/2025/03/Laporan_Tahunan.pdf" target="_blank" class="list-item">
            <div>
              <div class="list-item-text"><i class="fa-solid fa-chart-pie" style="color:var(--ptv-green-dark)"></i> Laporan Tahunan</div>
              <div class="list-item-sub">Buku kinerja yayasan (PDF)</div>
            </div>
            <div class="list-copy-btn" data-url="/wp-content/uploads/2025/03/Laporan_Tahunan.pdf" data-title="Laporan Tahunan" title="Salin Link URL"><i class="fa-solid fa-download"></i></div>
          </a>
          <a href="/wp-content/uploads/BENTOO.webp" target="_blank" class="list-item">
            <div>
              <div class="list-item-text"><i class="fa-regular fa-image" style="color:var(--ptv-green)"></i> Gambar Link Web</div>
              <div class="list-item-sub">Foto pratinjau saat link dibagikan</div>
            </div>
            <div class="list-copy-btn" data-url="https://progresiftv.id/wp-content/uploads/BENTOO.webp" data-title="Gambar Link Web" title="Salin Link URL"><i class="fa-solid fa-download"></i></div>
          </a>
        </div>
      </div>

      <!-- 6: Profil Ndalem (Notion) -->
      <a href="https://tvprogresif.notion.site/database-ndalem" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.1s;">
        <div class="copy-btn" data-url="https://tvprogresif.notion.site/database-ndalem" data-title="Profil Ndalem" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-gold-soft"><i class="fa-regular fa-address-card"></i></div>
        <div class="bento-text">
          <h3>Data Profil Ndalem</h3>
          <p>Detail nama lengkap & tanggal lahir Keluarga Ndalem.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka Daftar Lengkap</div>
      </a>

      <!-- 7: Foto Aerial -->
      <a href="https://drive.google.com/drive/folders/1zJm-ZXxjtSu-hwTRGpHenPl3HksTBm5s?usp=drive_link" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.2s;">
        <div class="copy-btn" data-url="https://drive.google.com/drive/folders/1zJm-ZXxjtSu-hwTRGpHenPl3HksTBm5s?usp=drive_link" data-title="Foto Udara Pondok" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-purple-soft"><i class="fa-solid fa-helicopter"></i></div>
        <div class="bento-text">
          <h3>Foto Udara Pondok</h3>
          <p>Arsip pemandangan pesantren difoto dari atas langit.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-brands fa-google-drive"></i> Buka Folder Drive</div>
      </a>

      <!-- 8: Sekretariat -->
      <a href="https://1drv.ms/f/c/365f088a257f31ac/EqwxfyWKCF8ggDaZAAMAAAABj9e71E9TgWbetUEb_JNPwQ?e=az1aDz" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.1s;">
        <div class="copy-btn" data-url="https://1drv.ms/f/c/365f088a257f31ac/EqwxfyWKCF8ggDaZAAMAAAABj9e71E9TgWbetUEb_JNPwQ?e=az1aDz" data-title="Sekretariat" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-green-soft"><i class="fa-solid fa-building-circle-check"></i></div>
        <div class="bento-text">
          <h3>Sekretariat & Surat</h3>
          <p>Kumpulan kop surat & pedoman tata naskah internal.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-brands fa-windows"></i> Buka Folder Arsip</div>
      </a>

      <!-- 9: Wirid -->
      <a href="https://drive.google.com/file/d/1rz7u9pE009rKtj1-4fCb45mDdKIxuC4-/view?usp=sharing" target="_blank" class="bento-card bento-icon reveal-up" style="transition-delay: 0.2s;">
        <div class="copy-btn" data-url="https://drive.google.com/file/d/1rz7u9pE009rKtj1-4fCb45mDdKIxuC4-/view?usp=sharing" data-title="PDF Wirid" title="Salin Link URL"><i class="fa-solid fa-link"></i></div>
        <div class="icon-box bg-gold-soft"><i class="fa-solid fa-book-open-reader"></i></div>
        <div class="bento-text">
          <h3>Kitab Wirid (PDF)</h3>
          <p>Buku saku elektronik kumpulan Wirid Mengetuk Pintu Langit.</p>
        </div>
        <div class="card-cta-btn"><i class="fa-solid fa-file-pdf"></i> Download PDF</div>
      </a>

    </div>
  </main>

  <!-- INTEGRATED BENTO MEGA FOOTER (Updated: Logo & Slogan Removed) -->
  <footer class="ptv-mega-footer">
    <div class="footer-inner">
      <div class="footer-grid">
        <!-- Social & CTA -->
        <div class="footer-cta-box reveal-up">
          <h2>Dukung Kami Berkarya</h2>
          <p>Mari menyebarkan kearifan bersama Progresif TV. Ikuti media sosial kami untuk update konten dakwah dan kreativitas santri terbaru.</p>
          <div class="footer-social-grid">
            <a href="https://www.instagram.com/progresiftv" target="_blank" class="social-pill"><i class="fab fa-instagram"></i> Instagram</a>
            <a href="https://www.facebook.com/progresiftv" target="_blank" class="social-pill"><i class="fab fa-facebook-f"></i> Facebook</a>
            <a href="https://www.youtube.com/@ProgresifTV" target="_blank" class="social-pill"><i class="fab fa-youtube"></i> YouTube</a>
            <a href="https://www.tiktok.com/@progresiftv" target="_blank" class="social-pill"><i class="fab fa-tiktok"></i> TikTok</a>
          </div>
        </div>
        
        <!-- Support/Help Box -->
        <div class="footer-help-box reveal-up" style="transition-delay: 0.2s;">
          <div class="icon-box bg-green-soft" style="margin: 0 auto 20px;"><i class="fa-solid fa-circle-question"></i></div>
          <h4>Butuh Bantuan Aset?</h4>
          <p>Jika Anda menemukan link yang rusak atau membutuhkan file aset khusus lainnya, silakan hubungi tim Admin Multimedia kami.</p>
          <a href="https://wa.me/6285334340616" target="_blank" class="btn-help-link">
            <i class="fa-brands fa-whatsapp"></i> Hubungi Admin PTV
          </a>
        </div>
      </div>
      
      <!-- Final Bottom Line -->
      <div class="footer-bottom-line reveal-up">
        <span>&copy; <?php echo date('Y'); ?> Progresif TV. Mata Air Kearifan.</span>
        <span style="letter-spacing: 1px; text-transform: uppercase;">Sidoarjo &bull; East Java &bull; Indonesia</span>
      </div>
    </div>
  </footer>

  <!-- NAVIGASI BAWAH (MOBILE) -->
  <nav class="ptv-bottomnav">
    <div class="ptv-bottomnav__inner">
      <a href="<?php echo home_url('/'); ?>" class="ptv-bitem"><i class="fa-solid fa-house"></i><span>Beranda</span></a>
      <a href="<?php echo home_url('/event'); ?>" class="ptv-bitem"><i class="fa-solid fa-calendar-days"></i><span>Acara</span></a>
      <a href="<?php echo home_url('/aset'); ?>" class="ptv-bitem"><i class="fa-solid fa-download"></i><span>Aset</span></a>
      <a href="<?php echo home_url('/karya'); ?>" class="ptv-bitem"><i class="fa-solid fa-image"></i><span>Karya</span></a>
      <a href="<?php echo home_url('/tentang-kami'); ?>" class="ptv-bitem"><i class="fa-solid fa-circle-info"></i><span>Tentang</span></a>
    </div>
  </nav>

  <!-- TOAST COMPONENT -->
  <div class="toast" id="toastMsg">
    <i class="fa-solid fa-circle-check"></i> <span id="toastText">Disalin!</span>
  </div>

  <!-- TOMBOL KUNCI AKSES (FLOATING) -->
  <a href="?logout=true" class="btn-lock-float" aria-label="Kunci Akses">
    <i class="fa-solid fa-lock"></i> Kunci Akses
  </a>

  <script>
    document.addEventListener("DOMContentLoaded", function() {
      // 1. Logic Copy to Clipboard
      async function writeClipboard(text) {
        if (!text) return false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try { await navigator.clipboard.writeText(text); return true; } catch(e) {}
        }
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed'; ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        } catch(e) { return false; }
      }

      function showToast(msg, type = "success") {
        const t = document.getElementById('toastMsg');
        t.className = `toast ${type}`;
        document.getElementById('toastText').innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
      }

      function handleCopyClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        const url = el.getAttribute('data-url');
        const title = el.getAttribute('data-title') || 'Link';
        
        if(!url || url === '#') {
          showToast(`Gagal! URL belum tersedia.`, "error");
          return;
        }
        
        writeClipboard(url).then(ok => {
          if(ok) showToast(`Link "${title}" berhasil disalin!`);
          else showToast('Gagal menyalin link.', "error");
        });
      }

      document.querySelectorAll('.copy-btn, .list-copy-btn').forEach(btn => {
        btn.addEventListener('click', handleCopyClick);
      });

      // 2. Scroll Animation Observer
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

      document.querySelectorAll('.reveal-up').forEach(el => observer.observe(el));
    });
  </script>
  
  <?php wp_footer(); ?>
</body>
</html>