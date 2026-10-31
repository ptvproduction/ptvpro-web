<?php
/*
Template Name: Halaman Aset Publik
*/

// ==============================================================================
// 1. MENGAMBIL DATA ASET DARI DATABASE WORDPRESS (CPT DINAMIS)
// ==============================================================================
$aset_query = new WP_Query(array(
    'post_type'           => 'aset_ptv', 
    'posts_per_page'      => -1,
    'post_status'         => 'publish', // HANYA ambil data yang sudah "Terbit"
    'ignore_sticky_posts' => true
));

$master_js_aset = array();

if ($aset_query->have_posts()) {
    while ($aset_query->have_posts()) {
        $aset_query->the_post();
        $id = 'aset-' . get_the_ID();
        $slug = get_post_field('post_name', get_the_ID()); // Ambil native slug WP
        
        $item = array(
            'id'          => $id,
            'slug'        => $slug,
            'judul'       => html_entity_decode(get_the_title(), ENT_QUOTES, 'UTF-8'),
            'desc'        => html_entity_decode(get_post_meta(get_the_ID(), 'ptv_aset_desc', true), ENT_QUOTES, 'UTF-8'),
            'kategori'    => html_entity_decode(get_post_meta(get_the_ID(), 'ptv_aset_kategori', true), ENT_QUOTES, 'UTF-8'),
            'subkategori' => html_entity_decode(get_post_meta(get_the_ID(), 'ptv_aset_subkategori', true), ENT_QUOTES, 'UTF-8'),
            'gambar'      => get_post_meta(get_the_ID(), 'ptv_aset_gambar', true),
            'url'         => get_post_meta(get_the_ID(), 'ptv_aset_url', true),
            'crop_pos'    => get_post_meta(get_the_ID(), 'ptv_aset_crop_pos', true),
            'crop_scale'  => get_post_meta(get_the_ID(), 'ptv_aset_crop_scale', true)
        );
        $master_js_aset[$id] = $item;
    }
    wp_reset_postdata();
}

// ==============================================================================
// 2. SEO DYNAMIC ROUTING MAGIC (JUDUL + KATEGORI + PREVIEW IMAGE)
// ==============================================================================
function ptv_get_direct_image_url($raw_url, $fallback_url) {
    if (empty($raw_url)) return $fallback_url;
    $clean_url = trim($raw_url);
    if (strpos($clean_url, 'drive.google.com') !== false) {
        preg_match('/drive\.google\.com\/(?:file\/d\/|open\?id=)([-\w]+)/', $clean_url, $matches);
        if (isset($matches[1])) {
            return "https://drive.google.com/uc?export=view&id=" . $matches[1];
        }
    }
    return $clean_url;
}

$seo_title = "Direktori Aset Bumi Shalawat | Progresif TV Bumi Shalawat";
$seo_desc  = "Pusat unduhan aset resmi Progresif TV dan Pesantren Bumi Shalawat. Download logo resolusi tinggi, foto tokoh, dokumen, dan footage eksklusif.";
$seo_img   = function_exists('ptv_smart_img') ? ptv_smart_img('DJI_0448-scaled.webp') : '/wp-content/uploads/DJI_0448-scaled.webp';
$seo_url   = home_url('/aset');

$req_id = isset($_GET['id']) ? sanitize_text_field($_GET['id']) : '';
$req_slug = get_query_var('aset_slug'); 

$target_aset = null;

if (!empty($req_id) && isset($master_js_aset[$req_id])) {
    $target_aset = $master_js_aset[$req_id];
} elseif (!empty($req_slug)) {
    foreach ($master_js_aset as $aset) {
        if ($aset['slug'] === $req_slug) {
            $target_aset = $aset;
            break;
        }
    }
}

if ($target_aset) {
    $cat_label = !empty($target_aset['kategori']) ? " (" . ucfirst($target_aset['kategori']) . ")" : "";
    $seo_title = esc_html($target_aset['judul']) . $cat_label . " | Direktori Aset Bumi Shalawat";
    
    if (!empty($target_aset['desc'])) {
        $seo_desc = wp_trim_words(strip_tags($target_aset['desc']), 25);
    } else {
        $seo_desc = "Unduh dan akses " . esc_html($target_aset['judul']) . " secara gratis di portal aset resmi Progresif TV.";
    }
    
    if (!empty($target_aset['gambar'])) $seo_img = ptv_get_direct_image_url($target_aset['gambar'], $seo_img);
    $seo_url = home_url('/aset/' . $target_aset['slug'] . '/');
}
?>
<!DOCTYPE html>
<html lang="id" <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  
  <title><?php echo $seo_title; ?></title>
  <meta name="description" content="<?php echo esc_attr($seo_desc); ?>">
  <meta name="robots" content="index, follow, max-image-preview:large">
  
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Progresif TV">
  <meta property="og:title" content="<?php echo esc_attr($seo_title); ?>">
  <meta property="og:description" content="<?php echo esc_attr($seo_desc); ?>">
  <meta property="og:image" content="<?php echo esc_url($seo_img); ?>">
  <meta property="og:url" content="<?php echo esc_url($seo_url); ?>">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <link rel="stylesheet" href="<?php echo get_stylesheet_uri(); ?>?v=<?php echo time(); ?>">
  <script src="<?php echo get_template_directory_uri(); ?>/js/main.js?v=<?php echo time(); ?>" defer></script>

  <script>
    window.healImage = function(img, fallbackUrl) {
      if (!img.dataset.healAttempts) img.dataset.healAttempts = "0";
      let attempts = parseInt(img.dataset.healAttempts);
      const currentSrc = img.src;
      if (attempts === 0) { img.dataset.healAttempts = "1"; const newSrc = currentSrc.replace(/(?:-scaled|-e\d+|_11zon)/gi, ''); if (newSrc !== currentSrc) { img.src = newSrc; return; } }
      if (attempts <= 1) { img.dataset.healAttempts = "2"; if (!currentSrc.includes('.webp')) { img.src = currentSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp'); return; } }
      if (img.dataset.healed !== "fallback" && img.src !== fallbackUrl) { img.dataset.healed = "fallback"; img.src = fallbackUrl; } else { img.onerror = null; }
    };
  </script>

  <style>
    /* ========================================================= */
    /* OS FINDER UI - SCOPED TO MAIN CONTENT (TIDAK MERUSAK HEADER) */
    /* ========================================================= */
    :root {
      --ptv-green: #0e4f40;
      --ptv-gold: #c5a35a;
      --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

  body { background-color: #111; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; }

    /* LINGKUNGAN OS */
    .os-environment {
        background: linear-gradient(135deg, #0f172a 0%, #0e4f40 100%);
        padding: 100px 20px 40px; 
        position: relative;
        z-index: 1;
        min-height: calc(100vh - 150px);
        overflow: hidden;
    }
    
    .os-bg-decor {
        position: absolute; top: -10%; left: -10%; width: 60%; height: 60%;
        background: radial-gradient(circle, rgba(197, 163, 90, 0.15) 0%, transparent 70%);
        z-index: 0; pointer-events: none;
    }
    .os-bg-decor::after {
        content: ''; position: absolute; bottom: -50%; right: -50%; width: 80%; height: 80%;
        background: radial-gradient(circle, rgba(22, 163, 74, 0.15) 0%, transparent 70%);
    }

    /* HERO TEXT */
    .os-hero { text-align: center; position: relative; z-index: 2; margin-bottom: 40px; }
    .os-hero-badge { display: inline-block; background: rgba(255,255,255,0.1); color: var(--ptv-gold); font-size: 11px; font-weight: 800; padding: 6px 16px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.2); }
    .os-hero h1 { font-size: clamp(32px, 5vw, 48px); color: #fff; font-weight: 900; margin: 0 0 10px; letter-spacing: -1px; }
    .os-hero p { color: rgba(255,255,255,0.7); font-size: 16px; max-width: 600px; margin: 0 auto; line-height: 1.6; }

    /* JENDELA OS (Diubah jadi Frosted Glass Smooth) */
    .os-window {
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        background-image: radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px);
        background-size: 24px 24px;
        border-radius: 36px;
        max-width: 1200px;
        margin: 0 auto;
        min-height: 65vh;
        box-shadow: 0 20px 50px rgba(0,0,0,0.15), inset 0 1px 3px rgba(255,255,255,0.8);
        border: 1px solid rgba(255,255,255,0.4);
        display: flex; flex-direction: column;
        position: relative; z-index: 2;
    }

    /* TOOLBAR JENDELA */
    .os-topbar {
        display: flex; justify-content: space-between; align-items: center;
        padding: 25px 40px;
        background: rgba(255, 255, 255, 0.45); 
        backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow: 0 10px 30px rgba(0,0,0,0.03);
        border-radius: 36px 36px 0 0;
        position: sticky; top: 0; z-index: 10;
    }
    
    .os-brand { display: flex; align-items: center; gap: 20px; }
    .os-brand-icon { width: 45px; height: 45px; background: linear-gradient(135deg, var(--ptv-green) 0%, #16a34a 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; box-shadow: 0 4px 15px rgba(14,79,64,0.3); }
    .os-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900; color: #111; margin: 0; letter-spacing: -0.5px; }
    .os-title span { color: var(--ptv-green); }
    
    .os-search { display: flex; align-items: center; background: rgba(0, 0, 0, 0.03); padding: 12px 24px; border-radius: 100px; width: 350px; gap: 12px; border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: inset 0 2px 5px rgba(0,0,0,0.02); transition: 0.4s var(--ease-spring); }
    .os-search:focus-within { border-color: rgba(14,79,64,0.3); background: rgba(255, 255, 255, 0.95); box-shadow: 0 10px 30px rgba(14,79,64, 0.15); transform: translateY(-2px); }
    .os-search input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; font-weight: 600; color: #111; font-family: inherit; }
    .os-search i { color: #94a3b8; transition: 0.3s; }
    .os-search:focus-within i { color: var(--ptv-green); }

    /* BREADCRUMB & CONTENT AREA */
    .os-content { padding: 40px; flex: 1; display: flex; flex-direction: column; }
    
    .os-breadcrumb { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; color: #333; margin-bottom: 30px; background: #fff; padding: 10px 20px; border-radius: 100px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
    .os-bc-home { cursor: pointer; color: var(--ptv-green); display: flex; align-items: center; gap: 8px; transition: 0.3s; }
    .os-bc-home:hover { color: var(--ptv-gold); }
    .os-bc-sep { color: #cbd5e1; font-size: 12px; }
    .os-bc-current { color: #111; }

    /* ========================================================= */
    /* 3D GLASSMORPHISM FOLDER                                   */
     /* ========================================================= */
    @keyframes folderPop { 0% { opacity: 0; transform: scale(0.9) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }

    .os-folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 40px; padding-top: 10px;}
    
    .os-folder-card {
        background: transparent; border: none; box-shadow: none; cursor: pointer; padding: 0; display: block; position: relative; opacity: 0; text-decoration: none; z-index: 1;
    }
    .os-folder-card:hover { z-index: 50; }
    
    .glass-folder-wrap {
        width: 100%; aspect-ratio: 1.15; position: relative; perspective: 1200px; transform-style: preserve-3d; transition: 0.5s var(--ease-spring);
    }
    .os-folder-card:hover .glass-folder-wrap { transform: translateY(-10px) scale(1.02); }
    
    /* BACK LAYER */
    .gf-back {
        position: absolute; bottom: 0; left: 0; right: 0; height: 85%; border-radius: 0 16px 16px 16px; background: #1e293b; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05), 0 15px 30px rgba(0,0,0,0.15);
    }
    .gf-back-tab {
        position: absolute; top: -16%; left: 0; width: 45%; height: 16.5%; background: #1e293b; border-radius: 12px 12px 0 0;
    }
    
    /* ITEMS (PEEKING OUT) */
    .gf-items {
        position: absolute; bottom: 25%; left: 5%; right: 5%; height: 75%; display: flex; justify-content: center; align-items: center; z-index: 5;
    }
    .gf-item {
        position: absolute; width: 55%; aspect-ratio: 1 / 1; height: auto; border-radius: 8px; background-color: #fff; padding: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transition: 0.6s var(--ease-spring); border: 1px solid rgba(0,0,0,0.05); object-fit: cover;
    }
    .gf-item.empty-item {
        padding: 0; background-color: #cbd5e1; border: 2px solid #fff;
    }
    .gf-item.item-1 { transform: rotate(-10deg) translateX(-25px) translateY(10px); z-index: 1; }
    .gf-item.item-2 { transform: rotate(10deg) translateX(25px) translateY(10px); z-index: 2; }
    .gf-item.item-3 { transform: rotate(0deg) translateY(-5px) scale(1.05); z-index: 3; }
    
    .os-folder-card:hover .gf-item.item-1 { transform: rotate(-22deg) translateX(-55px) translateY(-25px) scale(1.05); border-color: rgba(0,0,0,0.1); box-shadow: -5px 15px 25px rgba(0,0,0,0.2); }
    .os-folder-card:hover .gf-item.item-2 { transform: rotate(22deg) translateX(55px) translateY(-25px) scale(1.05); border-color: rgba(0,0,0,0.1); box-shadow: 5px 15px 25px rgba(0,0,0,0.2); }
    .os-folder-card:hover .gf-item.item-3 { transform: rotate(0deg) translateY(-50px) scale(1.2); border-color: rgba(0,0,0,0.1); box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
    
    /* FRONT GLASS LAYER */
    .gf-front {
        position: absolute; bottom: 0; left: 0; right: 0; height: 65%; z-index: 10; transition: transform 0.6s var(--ease-spring), background-color 0.4s; transform-origin: bottom; border-radius: 16px; border: 1px solid rgba(255,255,255,0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); display: flex; flex-direction: column; justify-content: space-between; padding: 20px; box-shadow: 0 -5px 25px rgba(0,0,0,0.1), inset 0 2px 5px rgba(255,255,255,0.3);
        transform: translateZ(10px); will-change: transform, background-color;
    }
    .os-folder-card:hover .gf-front { transform: rotateX(-12deg) translateZ(10px); }
    
    .gf-icon { width: 36px; height: 36px; border-radius: 50%; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .gf-labels { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; }
    .gf-title { color: #fff; font-weight: 800; font-size: 18px; text-shadow: 0 2px 5px rgba(0,0,0,0.3); line-height: 1.2; }
    .gf-badge { background: #111; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    
    /* THEME COLORS */
    .gf-color-green .gf-front { background-color: rgba(34, 197, 94, 0.4); } .os-folder-card:hover .gf-color-green .gf-front { background-color: rgba(34, 197, 94, 0.55); }
    .gf-color-gold .gf-front { background-color: rgba(197, 163, 90, 0.4); } .os-folder-card:hover .gf-color-gold .gf-front { background-color: rgba(197, 163, 90, 0.55); }
    .gf-color-purple .gf-front { background-color: rgba(147, 51, 234, 0.4); } .os-folder-card:hover .gf-color-purple .gf-front { background-color: rgba(147, 51, 234, 0.55); }
    .gf-color-red .gf-front { background-color: rgba(239, 68, 68, 0.4); } .os-folder-card:hover .gf-color-red .gf-front { background-color: rgba(239, 68, 68, 0.55); }
    .gf-color-blue .gf-front { background-color: rgba(14, 165, 233, 0.4); } .os-folder-card:hover .gf-color-blue .gf-front { background-color: rgba(14, 165, 233, 0.55); }

    .app-content-fade { transition: opacity 0.3s ease; }
 
    /* ========================================================= */
    /* TRUE MASONRY GRID (PINTEREST STYLE)                       */
    /* ========================================================= */
    .os-file-grid { 
        display: flex; flex-wrap: wrap; gap: 15px; padding-top: 20px; align-items: flex-start;
    }
    /* Elemen Hantu: Menyerap sisa ruang di baris terakhir agar gambar tidak melar over-size */
    .os-file-grid::after {
        content: ''; flex: 999 0 250px;
    }
    
    .os-file-card {
        --card-ratio: 1.5; --base-height: 160px;
        flex: var(--card-ratio) 1 calc(var(--base-height) * var(--card-ratio)); min-width: 0;
        margin-bottom: 10px; display: flex; flex-direction: column;
        cursor: pointer; transition: 0.4s var(--ease-spring); 
        background: transparent; border: none; padding: 0; border-radius: 0; opacity: 0;
        box-shadow: none; text-decoration: none; position: relative; overflow: visible;
    }
    .os-file-card:hover { transform: translateY(-8px); }
    
    .os-file-thumb {
        width: 100%; aspect-ratio: var(--card-ratio); height: auto; background: #f1f5f9; position: relative; overflow: hidden;
        border-radius: 12px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.04);
        transition: 0.3s ease;
    }
    .os-file-card:hover .os-file-thumb { box-shadow: 0 15px 35px rgba(14,79,64,0.2); border-color: rgba(14,79,64,0.1); }
    
    .os-file-thumb img { width: auto; height: 100%; display: block; object-fit: cover; transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.6s ease; transform: scale(var(--base-scale, 1)); pointer-events: none; }
    .os-file-card:hover .os-file-thumb img { transform: scale(calc(var(--base-scale, 1) + 0.08)); filter: brightness(1.05) contrast(1.05); }
    .os-file-thumb img.transparent-bg { padding: 15px; box-sizing: border-box; background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAHElEQVQYV2NkYGAwYcCBGCnAOKoQFxjHwMDABgA5/gX/gYf0qQAAAABJRU5ErkJggg==') repeat !important; }
    .os-file-thumb.empty-fallback { aspect-ratio: 4/3; background: linear-gradient(135deg, var(--ptv-green) 0%, #16a34a 100%); }
    .os-file-thumb .icon-fallback { font-size: 40px; color: #fff; opacity: 0.9; }
    
    .os-file-info { flex: 1; text-align: left; width: 0; min-width: 100%; padding: 0 5px; box-sizing: border-box; }
    .os-file-meta { font-size: 11.5px; font-weight: 700; color: var(--ptv-green); display: flex; align-items: center; gap: 6px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.5px;}
    .os-file-title { font-size: 14.5px; font-weight: 800; color: #111; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;}

    /* Subfilters */
    .os-subfilters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 25px; animation: folderPop 0.4s var(--ease-spring) forwards; }
    .os-sub-btn {
        background: rgba(0,0,0,0.03); color: #64748b; border: 1px solid rgba(0,0,0,0.06);
        padding: 8px 18px; border-radius: 50px; font-size: 13px; font-weight: 700;
        cursor: pointer; transition: 0.3s;
    }
    .os-sub-btn:hover { background: rgba(14, 79, 64, 0.05); color: var(--ptv-green); }
    .os-sub-btn.active { background: var(--ptv-green); color: #fff; box-shadow: 0 4px 12px rgba(14,79,64,0.2); border-color: var(--ptv-green); }

    .os-empty { display: none; text-align: center; padding: 60px 20px; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
    .os-empty i { font-size: 48px; color: #cbd5e1; margin-bottom: 15px; }
    .os-empty p { font-size: 14px; color: #64748b; font-weight: 600; }

    /* ========================================================= */
    /* CTA & COPYRIGHT                                           */
    /* ========================================================= */
    .os-cta-bar {
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        padding: 20px 30px; border-radius: 20px;
        max-width: 1200px; margin: 30px auto 0;
        color: #fff; text-decoration: none; transition: 0.4s var(--ease-spring);
        position: relative; z-index: 2;
    }
    .os-cta-bar:hover {
        background: rgba(255, 255, 255, 0.12); border-color: rgba(197, 163, 90, 0.5);
        transform: translateY(-4px); box-shadow: 0 15px 30px rgba(0,0,0,0.2);
    }
    .os-cta-content { display: flex; align-items: center; gap: 20px; }
    .os-cta-icon { width: 48px; height: 48px; background: rgba(197, 163, 90, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--ptv-gold); font-size: 20px; }
    .os-cta-text { display: flex; flex-direction: column; }
    .os-cta-title { font-weight: 800; font-size: 16px; letter-spacing: 0.5px; margin-bottom: 3px;}
    .os-cta-desc { font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 500; }
    
    .os-cta-arrow { color: rgba(255,255,255,0.5); font-size: 18px; transition: 0.3s; }
    .os-cta-bar:hover .os-cta-arrow { color: var(--ptv-gold); transform: translateX(5px); }
    .ofc-overlay-content { opacity: 1; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 60%); padding: 15px; }

    .os-footer-divider {
        max-width: 1200px; margin: 40px auto 20px; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        position: relative; z-index: 2;
    }
    .os-footer-copy {
        text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 500;
        position: relative; z-index: 2; letter-spacing: 0.5px;
    }

    /* ========================================================= */
    /* UNIVERSAL MODAL SPA (POP-UP ASET)                         */
    /* ========================================================= */
    .am-lightbox { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px; opacity: 0; visibility: hidden; transition: 0.3s; }
    .am-lightbox.active { opacity: 1; visibility: visible; }
    /* NEW OS-STYLE PREVIEW WINDOW */
    .am-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); width: 100%; max-width: 950px; border-radius: 24px; transform: scale(0.95) translateY(20px); transition: 0.4s var(--ease-spring); box-shadow: 0 40px 100px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.9); text-align: left; max-height: 90vh; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.4); display: flex; flex-direction: column;}
    .am-lightbox.active .am-card { transform: scale(1) translateY(0); }
    
    .am-close { position: absolute; top: 18px; right: 18px; color: #64748b; font-size: 20px; cursor: pointer; text-decoration: none; z-index: 100000; width: 38px; height: 38px; background: rgba(0,0,0,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
    .am-close:hover { background: #ef4444; color: #fff; transform: rotate(90deg); }
    
    .am-card-inner { display: flex; flex-direction: row; height: 100%; min-height: 350px; max-height: 90vh; }
    .am-visual-area { flex: 1.2; background: rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: center; position: relative; border-right: 1px solid rgba(0,0,0,0.05); padding: 30px; box-sizing: border-box; }
    .am-img-wrapper { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; user-select: none; }
    .am-img-wrapper img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); pointer-events: none; transition: transform 0.3s; }
    .am-img-wrapper img.transparent-bg { background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAHElEQVQYV2NkYGAwYcCBGCnAOKoQFxjHwMDABgA5/gX/gYf0qQAAAABJRU5ErkJggg==') repeat; padding: 25px; box-sizing: border-box; }
    
    .am-content-area { flex: 1; padding: 40px; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.4); overflow-y: auto; box-sizing: border-box; }
    
    @media (max-width: 768px) {
        .am-card-inner { flex-direction: column; }
        .am-visual-area { flex: none; height: 280px; padding: 20px; border-right: none; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .am-content-area { padding: 30px; overflow-y: visible; }
        .am-card { overflow-y: auto; } /* Scroll pindah ke card untuk HP */
    }

    .am-icon { width: 80px; height: 80px; font-size: 32px; margin: 0 auto; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .bg-green-soft { background: rgba(34,197,94,0.12); color: #16a34a; }
    .bg-purple-soft { background: rgba(168,85,247,0.12); color: #9333ea; }
    .bg-gold-soft { background: rgba(197,163,90,0.12); color: var(--ptv-gold); }
    .bg-red-soft { background: rgba(239,68,68,0.12); color: #ef4444; }

    .am-subtitle { font-size: 11px; color: var(--ptv-green); font-weight: 800; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; display: block; background: rgba(14,79,64,0.08); padding: 4px 12px; border-radius: 50px; display: inline-block;}
    .am-title { font-size: 26px; font-weight: 800; color: #111; margin: 0 0 10px; }
    .am-desc { font-size: 14.5px; color: #555; line-height: 1.6; margin: 0 0 25px; }
    
    /* Buttons stack nicely in the side panel */
    .am-btns { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .am-btn { width: 100%; justify-content: center; }
    
    .am-btn { padding: 14px 24px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: 0.3s; border: none; cursor: pointer; font-family: inherit; }
    .btn-disabled { opacity: 0.5; pointer-events: none; cursor: not-allowed !important; }
    .am-btn-open { background: var(--ptv-green); color: #fff; box-shadow: 0 6px 15px rgba(14,79,64,0.2); }
    .am-btn-open:hover { background: #062f25; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(14,79,64,0.3);}
    .am-btn-req { background: #111; color: #fff; }
    .am-btn-req:hover { background: #333; transform: translateY(-3px); }
    .am-btn-copy { background: rgba(0,0,0,0.05); color: #111; border: 1px solid rgba(0,0,0,0.1); }
    .am-btn-copy:hover { background: #fff; transform: translateY(-3px); }
    .am-btn-view { background: rgba(14, 165, 233, 0.1); color: #0284c7; border: 1px solid rgba(14,165,233,0.2); }
    .am-btn-view:hover { background: #0284c7; color: #fff; transform: translateY(-3px); }

    /* TOAST */
    .toast { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(100px); background: #111; color: #fff; padding: 14px 28px; border-radius: 50px; font-weight: 700; font-size: 13px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); opacity: 0; transition: 0.4s var(--ease-spring); z-index: 999999; display: flex; align-items: center; gap: 10px; }
    .toast.error { background: #dc2626; }
    .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

    /* RESPONSIVE FIXES */
    @media (max-width: 900px) {
        .os-environment { padding: 80px 15px 40px; }
        .os-topbar { padding: 25px 20px; flex-direction: column; align-items: flex-start; gap: 15px; }
        .os-search { width: 100%; }
        .os-content { padding: 20px; }
        .os-cta-bar { padding: 15px 20px; font-size: 14px; flex-direction: column; text-align: center; gap: 15px; }
        .os-cta-content { flex-direction: column; gap: 10px; }
        .os-cta-arrow { transform: rotate(90deg); }
        .os-cta-bar:hover .os-cta-arrow { transform: rotate(90deg) translateY(5px); }
    }
  </style>

  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

  <!-- PTV NATIVE HEADER -->
  <header class="ptv-head">
    <div class="ptv-head__inner">
      <a class="ptv-logo" href="<?php echo home_url('/'); ?>">
        <img src="<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('LOGO-NON-RESMI.webp') : '/wp-content/uploads/LOGO-NON-RESMI.webp'; ?>" alt="Logo Progresif TV" onerror="healImage(this, '<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('BENTOO.webp') : ''; ?>')">
      </a>
      <nav class="ptv-nav">
        <a href="<?php echo home_url('/'); ?>">Beranda</a>
        <a href="<?php echo home_url('/event'); ?>">Acara</a>
        <a href="<?php echo home_url('/aset'); ?>" class="is-active">Aset</a>
        <a href="<?php echo home_url('/karya'); ?>">Karya</a>
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

  <main id="main-content">
    
    <!-- LINGKUNGAN OS FINDER KHUSUS -->
    <div class="os-environment">
        <div class="os-bg-decor"></div>
        
        <!-- HERO TEXT -->
        <div class="os-hero">
            <span class="os-hero-badge">Direktori Aset Publik</span>
            <h1>Direktori Aset Bumi Shalawat</h1>
            <p>Jelajahi dan unduh dokumen resolusi tinggi, logo resmi, serta aset visual Bumi Shalawat dalam satu portal canggih.</p>
        </div>

        <!-- JENDELA KACA -->
        <div class="os-window">
            
            <div class="os-topbar">
                <div class="os-brand">
                    <div class="os-brand-icon"><i class="fa-solid fa-boxes-packing"></i></div>
                    <div>
                        <h2 class="os-title">Direktori <span>Aset</span></h2>
                    </div>
                </div>
                <div class="os-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="searchInput" placeholder="Cari aset atau dokumen...">
                </div>
            </div>

            <div class="os-content">
                <!-- BREADCRUMB -->
                <div id="breadcrumbWrapper" style="display: none;">
                     <div class="os-breadcrumb">
                         <span class="os-bc-home" onclick="openRoot()"><i class="fa-solid fa-folder-tree"></i>Direktori Aset</span>
                         <i class="fa-solid fa-chevron-right os-bc-sep"></i>
                         <span class="os-bc-current" id="bcCurrent"></span>
                     </div>
                </div>

                <!-- SUBFILTERS -->
                <div id="subfolderWrapper" class="os-subfilters" style="display:none;"></div>

                <!-- VIEW: FOLDERS -->
                <div class="os-folder-grid" id="folderView"></div>
                
                <!-- VIEW: FILES -->
                <div class="os-file-grid" id="fileView" style="display:none;"></div>
                
                <!-- EMPTY STATE -->
                <div id="emptyView" class="os-empty">
                    <i class="fa-regular fa-folder-open"></i>
                    <p id="emptyMsg">Belum ada aset yang tersedia di kategori ini.</p>
                </div>
            </div>
            
        </div>

        <!-- CTA BUTTON -->
        <a href="<?php echo home_url('/asetppbs'); ?>" class="os-cta-bar">
            <div class="os-cta-content">
                <div class="os-cta-icon"><i class="fa-solid fa-laptop-code"></i></div>
                <div class="os-cta-text">
                    <span class="os-cta-title">Akses Aset Internal</span>
                    <span class="os-cta-desc">Portal khusus untuk manajemen file kru & panitia internal.</span>
                </div>
            </div>
            <i class="fa-solid fa-arrow-right os-cta-arrow"></i>
        </a>

        <!-- DIVIDER & COPYRIGHT -->
        <div class="os-footer-divider"></div>
        <div class="os-footer-copy">
            &copy; <?php echo date('Y'); ?> Progresif TV. Mata Air Kearifan.
        </div>
        
    </div>

    <!-- UNIVERSAL MODAL SPA (POP-UP ASET) -->
    <div id="asetModal" class="am-lightbox">
        <div class="am-card" id="amCardMain">
            <a href="javascript:void(0);" class="am-close" onclick="closeAsetModal(event)"><i class="fa-solid fa-xmark"></i></a>
            <div class="am-card-inner">
                <div class="am-visual-area">
                    <div id="amImgWrapper" class="am-img-wrapper">
                        <img id="amImage" src="" alt="Preview Besar Aset PTV" onerror="healImage(this, '<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('BENTOO.webp') : ''; ?>')">
                    </div>
                    <div id="amIcon" class="am-icon bg-green-soft"><i class="fa-solid fa-folder"></i></div>
                </div>
                
                <div class="am-content-area">
                    <span id="amSubtitle" class="am-subtitle">KATEGORI</span>
                    <h3 id="amTitle" class="am-title">Judul Aset</h3>
                    <p id="amDesc" class="am-desc">Deskripsi lengkap aset.</p>
                    
                    <div class="am-btns" id="amBtnContainer">
                        <button id="amLink" class="am-btn am-btn-open" onclick="executeDownloadAction()"><i class="fa-solid fa-download"></i> Unduh / Kunjungi</button>
                        <button id="amReqHighRes" class="am-btn am-btn-req" onclick="showReqModal()"><i class="fa-brands fa-whatsapp"></i> Request High-Res</button>
                        <button id="amLogoDlBtn" class="am-btn am-btn-open" style="display:none;"><i class="fa-solid fa-cloud-arrow-down"></i> Unduh Logo HD</button>
                        <button id="amLogoPedomanBtn" class="am-btn am-btn-req" style="display:none;"><i class="fa-solid fa-book-open"></i> Pedoman Logo</button>
                        <button id="amFullPreview" class="am-btn am-btn-view" style="display:none;"><i class="fa-solid fa-expand"></i> Tampilkan Foto</button>
                        <button id="amCopy" class="am-btn am-btn-copy"><i class="fa-solid fa-link"></i> Salin URL</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- POP-UP SYARAT & KETENTUAN (T&C) GLOBAL -->
    <div id="tncModal" class="am-lightbox" style="z-index: 100005;">
        <div class="am-card" style="max-width: 450px; padding: 40px 30px; position: relative;">
            <a href="javascript:void(0);" class="am-close" onclick="closeTncModal()"><i class="fa-solid fa-xmark"></i></a>
            <div style="font-size: 40px; color: var(--ptv-gold); margin-bottom: 15px;"><i class="fa-solid fa-scale-balanced"></i></div>
            <h3 style="margin-bottom: 10px; font-size: 20px; font-weight: 800;">Syarat & Ketentuan</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6;">
                Aset ini disediakan semata-mata hanya untuk kepentingan syiar dan publikasi positif. <br><br>
                <strong>Penyalahgunaan untuk penipuan, hoax, atau kepentingan komersial pribadi akan ditindak secara hukum.</strong>
            </p>
            <div style="text-align: left; margin-bottom: 25px; background: #f9fafb; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.05);">
                <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #475569; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="tncDontShow" style="width: 18px; height: 18px; accent-color: var(--ptv-green);">
                    Jangan Tampilkan Lagi
                </label>
            </div>
            <button class="am-btn am-btn-open" style="width: 100%; justify-content: center;" onclick="closeTncModal()">Saya Mengerti</button>
        </div>
    </div>

    <!-- POP-UP PANDUAN LOGO SPESIFIK -->
    <div id="logoTncModal" class="am-lightbox" style="z-index: 100006;">
        <div class="am-card" style="max-width: 450px; padding: 40px 30px; position: relative;">
            <a href="javascript:void(0);" class="am-close" onclick="closeLogoTncModal()"><i class="fa-solid fa-xmark"></i></a>
            <div style="font-size: 40px; color: var(--ptv-gold); margin-bottom: 15px;"><i class="fa-solid fa-shield-halved"></i></div>
            <h3 style="margin-bottom: 10px; font-size: 20px; font-weight: 800;">Syarat Penggunaan Logo</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6;">
                Sebelum mengunduh logo beresolusi tinggi, sistem mewajibkan Anda untuk membuka dan mematuhi panduan/pedoman resmi untuk logo spesifik ini.
            </p>
            <div style="text-align: left; margin-bottom: 25px; background: #f9fafb; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.05);">
                <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #475569; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="logoTncCheck" style="width: 18px; height: 18px; accent-color: var(--ptv-green);">
                    Saya sudah membaca panduan logo
                </label>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="logoTncGuideBtn" class="am-btn am-btn-req" style="width: 100%; justify-content: center;"><i class="fa-solid fa-book-open"></i> Buka Panduan</button>
                <button id="logoTncContinueBtn" class="am-btn am-btn-open btn-disabled" style="width: 100%; justify-content: center;"><i class="fa-solid fa-check"></i> Lanjutkan</button>
            </div>
        </div>
    </div>

    <!-- POP-UP FORM REQUEST HIGH-RES -->
    <div id="reqModal" class="am-lightbox" style="z-index: 100005;">
        <div class="am-card" id="reqCardBox" style="max-width: 450px; padding: 40px; text-align: left;">
            <a href="javascript:void(0);" class="am-close" onclick="closeReqModal()"><i class="fa-solid fa-xmark"></i></a>
            
            <div id="reqFormContainer">
                <h3 style="margin-bottom: 25px; font-size: 22px; font-weight: 800; color: #111;">Request Aset High-Res</h3>
                <form id="reqForm" onsubmit="sendWaRequest(event)">
                    <div class="req-form-group" style="margin-bottom: 15px;">
                        <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px;">Nama Lengkap</label>
                        <input type="text" id="reqName" style="width:100%; padding:12px 15px; border-radius:12px; border:1px solid rgba(0,0,0,0.1); font-family:inherit; font-size:14px; background:#f9fafb; box-sizing:border-box;" required placeholder="Masukkan nama Anda">
                    </div>
                    <div class="req-form-group" style="margin-bottom: 15px;">
                        <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px;">Instansi / Organisasi</label>
                        <input type="text" id="reqInst" style="width:100%; padding:12px 15px; border-radius:12px; border:1px solid rgba(0,0,0,0.1); font-family:inherit; font-size:14px; background:#f9fafb; box-sizing:border-box;" required placeholder="Contoh: Panitia Pengajian">
                    </div>
                    <div class="req-form-group" style="margin-bottom: 15px;">
                        <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px;">Nomor WhatsApp <span style="font-size: 11px; color: #999;">(Opsional)</span></label>
                        <input type="tel" id="reqWa" style="width:100%; padding:12px 15px; border-radius:12px; border:1px solid rgba(0,0,0,0.1); font-family:inherit; font-size:14px; background:#f9fafb; box-sizing:border-box;" placeholder="Contoh: 081234567890">
                    </div>
                    <div class="req-form-group" style="margin-bottom: 15px;">
                        <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px;">Keperluan Penggunaan</label>
                        <textarea id="reqDesc" rows="3" style="width:100%; padding:12px 15px; border-radius:12px; border:1px solid rgba(0,0,0,0.1); font-family:inherit; font-size:14px; background:#f9fafb; box-sizing:border-box;" required placeholder="Jelaskan secara singkat untuk apa aset ini digunakan"></textarea>
                    </div>
                    <button type="submit" class="am-btn am-btn-open" id="reqSubmitBtn" style="width: 100%; justify-content: center; margin-top: 10px;">
                        <i class="fa-solid fa-unlock-keyhole" style="font-size: 18px;"></i> Request Akses HD
                    </button>
                    <!-- TEKS PERINGATAN 3 HARI -->
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 15px; text-align: center; line-height: 1.5;">
                        <i class="fa-solid fa-clock" style="color: var(--ptv-gold);"></i> 
                        Kredensial ini akan aktif otomatis di perangkat Anda selama <b>3 Hari</b>.
                    </p>
                </form>
            </div>
        </div>
    </div>

    <!-- POP-UP FULL PREVIEW -->
    <div id="fullPreviewModal" class="am-lightbox" style="z-index: 100010; background: rgba(0,0,0,0.9); cursor: zoom-out;" onclick="closeFullPreviewModal(event)">
        <div class="am-close" style="top: 20px; right: 30px; font-size: 40px; color: #fff;" onclick="closeFullPreviewModal(event)"><i class="fa-solid fa-xmark"></i></div>
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
            <img id="fullPreviewImg" src="" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); user-select: none; -webkit-user-drag: none;" onerror="healImage(this, '<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('BENTOO.webp') : ''; ?>')">
        </div>
    </div>

    <!-- PTV NATIVE FOOTER AREA -->
    <section class="ptv-social-footer">
      <div class="ptv-social-header">
        <h2 class="ptv-social-title">Dukung Kami Berkarya</h2>
        <p class="ptv-social-desc">Jangan lupa Subscribe channel YouTube Progresif TV dan nyalakan lonceng notifikasi agar tidak ketinggalan tayangan terbaru kami.</p>
      </div>

      <div class="ptv-social-links">
        <a href="https://www.instagram.com/progresiftv" target="_blank" class="ptv-social-link ig" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
        <a href="https://www.facebook.com/progresiftv" target="_blank" class="ptv-social-link fb" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="https://www.youtube.com/@ProgresifTV" target="_blank" class="ptv-social-link yt" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
        <a href="https://www.tiktok.com/@progresiftv" target="_blank" class="ptv-social-link tt" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
      </div>
    </section>

  </main>

  <nav class="ptv-bottomnav">
    <div class="ptv-bottomnav__inner">
      <a href="<?php echo home_url('/'); ?>" class="ptv-bitem"><i class="fa-solid fa-house"></i><span>Beranda</span></a>
      <a href="<?php echo home_url('/event'); ?>" class="ptv-bitem"><i class="fa-solid fa-calendar-days"></i><span>Acara</span></a>
      <a href="<?php echo home_url('/aset'); ?>" class="ptv-bitem is-active"><i class="fa-solid fa-download"></i><span>Aset</span></a>
      <a href="<?php echo home_url('/karya'); ?>" class="ptv-bitem"><i class="fa-solid fa-image"></i><span>Karya</span></a>
      <a href="<?php echo home_url('/tentang-kami'); ?>" class="ptv-bitem"><i class="fa-solid fa-circle-info"></i><span>Tentang</span></a>
    </div>
  </nav>

  <!-- TOAST COMPONENT -->
  <div class="toast" id="toastMsg"><i class="fa-solid fa-circle-check" id="toastIcon"></i> <span id="toastText">Disalin!</span></div>

  <script>
    // DATA INJECTION
    window.MASTER_ASET = <?php echo json_encode($master_js_aset); ?>;
    window.PTV_PORTAL_URL = "<?php echo home_url('/aset/'); ?>";
    window.executeDownloadAction = null;
    window.PTV_ACCESS_SESSION = undefined; 

    let ptvDeviceId = localStorage.getItem('ptv_device_id') || ('DEV_' + Math.random().toString(36).substr(2, 9) + Date.now());
    localStorage.setItem('ptv_device_id', ptvDeviceId);
    window.SLUG_TO_ID = Object.fromEntries(Object.values(window.MASTER_ASET).map(i => [i.slug, i.id]));

    const ALL_ASSETS = Object.values(window.MASTER_ASET).filter(a => !(a.kategori || '').toLowerCase().includes('logo'));
    const CATEGORIES = [...new Set(ALL_ASSETS.map(a => a.kategori ? a.kategori.trim() : 'Lainnya'))].sort();
    
    // UI ELEMENTS
    const folderView = document.getElementById('folderView');
    const fileView = document.getElementById('fileView');
    const emptyView = document.getElementById('emptyView');
    const breadcrumbWrapper = document.getElementById('breadcrumbWrapper');
    const bcCurr = document.getElementById('bcCurrent');
    const searchInput = document.getElementById('searchInput');

    let currentFolder = null; // null = root
    window.CURR_SUBFOLDER = 'Semua';

    // TOAST
    function showToast(msg, type = "success") {
      const t = document.getElementById('toastMsg');
      const icon = document.getElementById('toastIcon');
      t.className = `toast ${type}`;
      if(type === 'error') icon.className = "fa-solid fa-circle-exclamation";
      else icon.className = "fa-solid fa-circle-check";
      document.getElementById('toastText').innerText = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    async function writeClipboard(text) {
      if (!text) return false;
      if (navigator.clipboard && navigator.clipboard.writeText) { try { await navigator.clipboard.writeText(text); return true; } catch(e) {} }
      try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok; } catch(e) { return false; }
    }

    // PROCESS IMAGE URL
    function processImage(rawUrl) {
        const defaultFallback = "<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('BENTOO.webp') : ''; ?>";
        if (!rawUrl || rawUrl.trim() === '') return { original: defaultFallback, preview: defaultFallback };
        const cleanUrl = rawUrl.trim();
        let dlUrl = cleanUrl; let prevUrl = cleanUrl;
        if (cleanUrl.includes('drive.google.com')) {
          const match = cleanUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([-\w]+)/);
          dlUrl = match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : cleanUrl; prevUrl = dlUrl;
        } else if (/\.(jpg|jpeg|png)$/i.test(cleanUrl)) {
          prevUrl = cleanUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        }
        return { original: dlUrl, preview: prevUrl };
    }

    // HARDCORE WATERMARK & ANTI STEAL
    const PTV_WATERMARK_SRC = "<?php echo function_exists('ptv_smart_img') ? ptv_smart_img('LOGO-NON-RESMI.webp') : ''; ?>";
    const wmImage = new Image();
    if(PTV_WATERMARK_SRC) wmImage.src = PTV_WATERMARK_SRC;

    function applyHardWatermark(imgElement, srcUrl, title, cropRatio = null, cropPos = 'center', originalUrl = null) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            const targetUrl = originalUrl || srcUrl;
            let mimeType = 'image/jpeg'; let fileExt = 'jpg';
            const lowerSrc = targetUrl.toLowerCase();
            
            if (lowerSrc.includes('.png')) {
                mimeType = 'image/png'; fileExt = 'png';
                imgElement.classList.add('transparent-bg');
            } else if (lowerSrc.includes('.webp')) {
                mimeType = 'image/webp'; fileExt = 'webp';
                imgElement.classList.remove('transparent-bg');
            } else { imgElement.classList.remove('transparent-bg'); }

            const MAX_WIDTH = 1600;
            let width = img.width; let height = img.height;
            if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }

            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            canvas.width = width; canvas.height = height;
            
            if (mimeType === 'image/png') {
                if (wmImage.complete && wmImage.naturalWidth > 0) {
                    const wmWidth = width * 0.4; const wmHeight = (wmImage.height / wmImage.width) * wmWidth;
                    const wmX = (width - wmWidth) / 2; const wmY = (height - wmHeight) / 2;
                    ctx.globalAlpha = 0.15; ctx.drawImage(wmImage, wmX, wmY, wmWidth, wmHeight); ctx.globalAlpha = 1.0;
                }
                ctx.drawImage(img, 0, 0, width, height);
            } else {
                ctx.drawImage(img, 0, 0, width, height);
                if (wmImage.complete && wmImage.naturalWidth > 0) {
                    const wmWidth = width * 0.12; const wmHeight = (wmImage.height / wmImage.width) * wmWidth;
                    const wmX = (width - wmWidth) / 2; const wmY = height * 0.85; 
                    ctx.globalAlpha = 0.4; ctx.drawImage(wmImage, wmX, wmY, wmWidth, wmHeight); ctx.globalAlpha = 1.0;
                }
            }

            const fontSize = Math.max(12, width * 0.015); const footerHeight = fontSize * 2.5; 
            const dlCanvas = document.createElement('canvas'); const dlCtx = dlCanvas.getContext('2d');
            dlCanvas.width = width; dlCanvas.height = height + footerHeight;
            
            if (mimeType !== 'image/png') { dlCtx.fillStyle = '#ffffff'; dlCtx.fillRect(0, 0, width, dlCanvas.height); }
            dlCtx.drawImage(canvas, 0, 0);
            
            const copyrightText = `© ${new Date().getFullYear()} Progresif TV Copyrighted.`;
            dlCtx.fillStyle = '#0e4f40'; dlCtx.font = `bold ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
            dlCtx.textAlign = 'center'; dlCtx.textBaseline = 'middle';
            dlCtx.fillText(copyrightText, width / 2, height + (footerHeight / 2));
            
            try {
                const webPreviewUrl = canvas.toDataURL(mimeType, 0.85); 
                const finalDataUrl = dlCanvas.toDataURL(mimeType, 0.85); 
                
                imgElement.dataset.origRatio = `${width} / ${height}`;
                imgElement.src = webPreviewUrl; imgElement.dataset.finalSrc = finalDataUrl;
                imgElement.onload = () => { 
                /* Injeksi Rasio Matematis */
                let r = width / height; if(r > 3) r = 3; if(r < 0.5) r = 0.5;
                imgElement.closest('.os-file-card').style.setProperty('--card-ratio', r);
            };
                imgElement.removeAttribute('data-src');
                
                window.executeDownloadAction = function() {
                    const a = document.createElement('a'); a.href = finalDataUrl;
                    a.download = `PTV_${title.replace(/[^a-z0-9]/gi, '_')}.${fileExt}`;
                    a.click(); showToast('Mengunduh aset.', 'success');
                };
            } catch(e) {
                imgElement.src = originalUrl || srcUrl;
                window.executeDownloadAction = () => { window.open(targetUrl, '_blank'); };
            }
        };
        img.onerror = () => { 
            if (img.dataset.healed !== "true" && originalUrl && originalUrl !== srcUrl) {
                img.dataset.healed = "true"; img.src = originalUrl;
            } else {
                const card = imgElement.closest('.os-file-card');
                const thumb = card ? card.querySelector('.os-file-thumb') : null;
                if (thumb) {
                    thumb.classList.add('empty-fallback');
                    thumb.innerHTML = '<i class="fa-solid fa-file icon-fallback"></i>';
                } else {
                    imgElement.style.display = 'none';
                }
                window.executeDownloadAction = () => { window.open(originalUrl || srcUrl, '_blank'); };
            }
        };
        img.src = srcUrl;
    }

    document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG' || e.target.closest('.os-file-thumb') || e.target.closest('.am-img-wrapper')) {
            e.preventDefault();
            showToast("Aset dilindungi Hak Cipta Progresif TV.", "error");
        }
    });

    // FOLDER LOGIC
    const appContentContainer = document.querySelector('.os-content');
    if (appContentContainer && !appContentContainer.classList.contains('app-content-fade')) {
        appContentContainer.classList.add('app-content-fade');
    }
    window.openRoot = function() {
        currentFolder = null;
        window.CURR_SUBFOLDER = 'Semua';
        searchInput.value = '';
        breadcrumbWrapper.style.display = 'none';
        const subWrapper = document.getElementById('subfolderWrapper');
        if(subWrapper) subWrapper.style.display = 'none';
        
        if(appContentContainer) appContentContainer.style.opacity = '0';
        
        setTimeout(() => {
            fileView.style.display = 'none';
            emptyView.style.display = 'none';
            folderView.style.display = 'grid';

            let html = '';
            const randomizedCats = [...CATEGORIES].sort(() => 0.5 - Math.random());
            randomizedCats.forEach((cat, index) => {
                const catItems = ALL_ASSETS.filter(a => (a.kategori || 'Lainnya') === cat);
                const count = catItems.length;
                let colorClass = 'gf-color-blue'; 
                let icon = 'fa-folder';
                let displayCatName = cat; // Label default
                
                if(cat.toLowerCase().includes('tokoh')) { colorClass = 'gf-color-purple'; icon = 'fa-user-tie'; }
                else if(cat.toLowerCase().includes('pdf')) { colorClass = 'gf-color-red'; icon = 'fa-file-pdf'; }
                else if(cat.toLowerCase().includes('tempat')) { colorClass = 'gf-color-green'; icon = 'fa-map-location-dot'; displayCatName = 'Fasilitas'; }

                // Acak susunan item agar preview gambar selalu berbeda tiap dimuat
                const shuffledItems = [...catItems].sort(() => 0.5 - Math.random());

                let itemsHtml = '';
                for(let i = 0; i < 3; i++) {
                    const currentItem = shuffledItems[i];
                    if (currentItem && currentItem.gambar && currentItem.gambar.trim() !== '') {
                        const imgData = processImage(currentItem.gambar);
                        itemsHtml += `<img class="gf-item item-${i+1}" src="${imgData.preview}" alt="File" onerror="if(this.src !== '${imgData.original}') { this.src='${imgData.original}'; } else { this.style.display='none'; }">`;
                    }
                }

                html += `
                <div class="os-folder-card" onclick="openFolder('${cat}')" style="animation: folderPop 0.5s var(--ease-spring) forwards; opacity:0; animation-delay: ${index * 0.05}s;">
                    <div class="glass-folder-wrap ${colorClass}">
                        <div class="gf-back"><div class="gf-back-tab"></div></div>
                        <div class="gf-items">${itemsHtml}</div>
                        <div class="gf-front">
                            <div class="gf-icon"><i class="fa-solid ${icon}"></i></div>
                            <div class="gf-labels">
                                <div class="gf-title">${displayCatName}</div>
                                <div class="gf-badge"><i class="fa-regular fa-file"></i> ${count}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
            folderView.innerHTML = html;
            
            if(appContentContainer) appContentContainer.style.opacity = '1';
        }, 250);
    };

    window.openFolder = function(catName) {
        currentFolder = catName;
        searchInput.value = '';
        breadcrumbWrapper.style.display = 'inline-flex';
        bcCurr.innerText = catName.toLowerCase().includes('tempat') ? 'Fasilitas' : catName;
        
        const catItems = ALL_ASSETS.filter(a => (a.kategori || 'Lainnya') === catName);
        const subs = [...new Set(catItems.filter(a => a.subkategori && a.subkategori.trim() !== '').map(a => a.subkategori.trim()))].sort();
        
        const subWrapper = document.getElementById('subfolderWrapper');
        if(subs.length > 0) {
            let subHtml = `<button class="os-sub-btn active" onclick="filterSub('Semua')">Semua</button>`;
            subs.forEach(sub => {
                subHtml += `<button class="os-sub-btn" onclick="filterSub('${sub}')">${sub}</button>`;
            });
            subWrapper.innerHTML = subHtml;
            subWrapper.style.display = 'flex';
        } else {
            subWrapper.style.display = 'none';
        }

        window.CURR_SUBFOLDER = 'Semua';

        if(appContentContainer) appContentContainer.style.opacity = '0';
        setTimeout(() => {
            folderView.style.display = 'none';
            renderFiles(catItems);
            if(appContentContainer) appContentContainer.style.opacity = '1';
        }, 250);
    };

    window.filterSub = function(subName) {
        window.CURR_SUBFOLDER = subName;
        document.querySelectorAll('.os-sub-btn').forEach(b => {
            if(b.innerText === subName) b.classList.add('active');
            else b.classList.remove('active');
        });
        
        const catItems = ALL_ASSETS.filter(a => (a.kategori || 'Lainnya') === currentFolder);
        const filtered = subName === 'Semua' ? catItems : catItems.filter(a => (a.subkategori || '').trim() === subName);
        
        const q = searchInput.value.toLowerCase().trim();
        const finalResults = q === '' ? filtered : filtered.filter(a => (a.judul && a.judul.toLowerCase().includes(q)) || (a.desc && a.desc.toLowerCase().includes(q)));
        
        if(appContentContainer) appContentContainer.style.opacity = '0';
        setTimeout(() => { renderFiles(finalResults); if(appContentContainer) appContentContainer.style.opacity = '1'; }, 200);
    };

    function renderFiles(items) {
        // Penting: display 'flex' agar fitur layout bersyaf dari CSS berjalan!
        fileView.style.display = 'flex';
        emptyView.style.display = 'none';
        
        if(items.length === 0) {
            fileView.style.display = 'none';
            emptyView.style.display = 'flex';
            return;
        }

        let html = '';
        items.forEach((item, index) => {
            const catStr = (item.kategori || '').toLowerCase();
            const isProtected = !catStr.includes('logo') && !catStr.includes('pdf');
            const hasCover = item.gambar && item.gambar.trim() !== '';
            
            const cropPos = item.crop_pos || 'center';
            const cropScale = item.crop_scale || '1';
            const cropAttr = `data-crop-pos="${cropPos}" data-crop-scale="${cropScale}"`;
            
            let thumbHTML = '';
            let emptyClass = '';
            let metaIcon = '';
            
            if (catStr.includes('pdf')) { 
                metaIcon = '<i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>'; 
            } else if (catStr.includes('tokoh')) {
                metaIcon = '<i class="fa-solid fa-user" style="color: #8b5cf6;"></i>';
            } else if (catStr.includes('tempat') || catStr.includes('fasilitas')) { 
                metaIcon = '<i class="fa-solid fa-location-dot" style="color: var(--ptv-green);"></i>';
            } else { 
                metaIcon = '<i class="fa-regular fa-image" style="color: #10b981;"></i>'; 
            }
            
            if (hasCover) {
                const imgData = processImage(item.gambar);
                const imgClass = isProtected ? 'ptv-lazy-wm' : 'ptv-lazy-wm transparent-bg';
                thumbHTML = `<img class="${imgClass}" data-src="${imgData.preview}" data-original-src="${imgData.original}" data-title="${item.judul}" data-protected="${isProtected}" ${cropAttr} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3C/svg%3E" loading="lazy">`;
            } else {
                const iconTg = catStr.includes('pdf') ? 'fa-file-pdf' : 'fa-file';
                emptyClass = 'empty-fallback';
                thumbHTML = `<i class="fa-solid ${iconTg} icon-fallback"></i>`;
            }

            html += `
            <div class="os-file-card" onclick="openAsetModal('${item.id}', event)" style="animation: folderPop 0.5s var(--ease-spring) forwards; opacity:0; animation-delay: ${(index%10) * 0.05}s;">
                <div class="os-file-thumb ${emptyClass}">${thumbHTML}</div>
                <div class="os-file-info">
                    <div class="os-file-meta">${metaIcon} <span>${item.subkategori || 'File'}</span></div>
                    <div class="os-file-title" title="${item.judul}">${item.judul}</div>
                </div>
            </div>`;
        });
        
        fileView.innerHTML = html;
        triggerLazyLoad();
    }

    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if(q === '') {
            if(currentFolder) {
                const catItems = ALL_ASSETS.filter(a => (a.kategori || 'Lainnya') === currentFolder);
                const filtered = (!window.CURR_SUBFOLDER || window.CURR_SUBFOLDER === 'Semua') ? catItems : catItems.filter(a => (a.subkategori || '').trim() === window.CURR_SUBFOLDER);
                renderFiles(filtered);
            } else openRoot();
            return;
        }
        
        folderView.style.display = 'none';
        let sourceData = currentFolder ? ALL_ASSETS.filter(a => (a.kategori || 'Lainnya') === currentFolder) : ALL_ASSETS;
        
        if (currentFolder && window.CURR_SUBFOLDER && window.CURR_SUBFOLDER !== 'Semua') {
            sourceData = sourceData.filter(a => (a.subkategori || '').trim() === window.CURR_SUBFOLDER);
        }
        
        let results = sourceData.filter(a => (a.judul && a.judul.toLowerCase().includes(q)) || (a.desc && a.desc.toLowerCase().includes(q)));
        
        breadcrumbWrapper.style.display = 'inline-flex';
        bcCurr.innerText = `Pencarian: "${q}"`;
        renderFiles(results);
    });

    // LAZY LOAD & WATERMARK
    function triggerLazyLoad() {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src && !img.dataset.processed) {
                        img.dataset.processed = "true";
                        
                        if(img.dataset.protected === "true") {
                            applyHardWatermark(img, img.dataset.src, img.dataset.title, null, img.dataset.cropPos, img.dataset.originalSrc);
                            img.style.setProperty('--base-scale', img.dataset.cropScale || '1');
                        } else {
                            img.style.setProperty('--base-scale', img.dataset.cropScale || '1');
                            const tempImg = new Image();
                            tempImg.onload = () => { 
                                let r = tempImg.width / tempImg.height; if(r > 3) r = 3; if(r < 0.5) r = 0.5;
                                img.closest('.os-file-card').style.setProperty('--card-ratio', r);
                                img.src = img.dataset.src; 
                            };
                            tempImg.onerror = () => {
                                const card = img.closest('.os-file-card');
                                const thumb = card ? card.querySelector('.os-file-thumb') : null;
                                if (thumb) {
                                    thumb.classList.add('empty-fallback');
                                    thumb.innerHTML = '<i class="fa-solid fa-file icon-fallback"></i>';
                                } else {
                                    img.style.display = 'none';
                                }
                            };
                            tempImg.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                    }
                    obs.unobserve(img);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.ptv-lazy-wm').forEach(el => observer.observe(el));
    }

    // WA REQUEST FORM
    window.showReqModal = function() {
        document.getElementById('reqForm').reset();
        document.getElementById('reqModal').classList.add('active');
    };
    window.closeReqModal = function() { document.getElementById('reqModal').classList.remove('active'); };
    
    window.regenerateTempUrl = function(asetId) {
        const reqBtn = document.getElementById('amReqHighRes');
        const originalHtml = reqBtn.innerHTML;
        reqBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menyiapkan Link...';
        reqBtn.disabled = true;

        const formData = new FormData();
        formData.append('action', 'ptv_regenerate_hd_request');
        formData.append('aset_id', asetId);
        formData.append('device_id', ptvDeviceId);

        fetch('<?php echo admin_url("admin-ajax.php"); ?>', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast("Akses diverifikasi! Mengalihkan ke Halaman Resi...", "success");
                window.location.href = res.data.url + '&t=' + new Date().getTime();
            } else {
                showToast("Akses tidak ditemukan. Silakan request ulang.", "error");
                window.PTV_ACCESS_CACHE[asetId] = false;
                openAsetModal(asetId);
                setTimeout(() => showReqModal(), 500);
            }
        })
        .catch(err => {
            showToast("Terjadi kesalahan jaringan.", "error");
            reqBtn.innerHTML = originalHtml;
            reqBtn.disabled = false;
        });
    };

    window.sendWaRequest = function(e) {
        e.preventDefault();
        const btn = document.getElementById('reqSubmitBtn');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Membuat Kredensial...';
        btn.disabled = true;

        const form = e.target;
        const data = new FormData();
        data.append('action', 'ptv_process_hd_request');
        data.append('nama', form.querySelector('#reqName').value);
        data.append('instansi', form.querySelector('#reqInst').value);
        data.append('no_wa', form.querySelector('#reqWa').value);
        data.append('keperluan', form.querySelector('#reqDesc').value);
        
        const pathParts = window.location.pathname.split('/').filter(p=>p);
        let asetId = window.SLUG_TO_ID[pathParts[pathParts.length - 1]] || new URLSearchParams(window.location.search).get('id');
        
        data.append('aset_id', asetId);
        data.append('aset_title', document.getElementById('amTitle').innerText);
        data.append('device_id', ptvDeviceId);
        
        fetch('<?php echo admin_url("admin-ajax.php"); ?>', { method: 'POST', body: data })
        .then(r => r.json())
        .then(res => {
            if(res.success) { 
                window.PTV_ACCESS_SESSION = true;
                showToast("Berhasil! Kredensial aktif 3 Hari.", "success"); 
                window.location.href = res.data.url + '&t=' + new Date().getTime(); 
            }
            else { showToast(res.data || "Gagal memproses request.", "error"); btn.innerHTML = ogHtml; btn.disabled = false; }
        }).catch(() => { showToast("Kesalahan jaringan", "error"); btn.innerHTML = ogHtml; btn.disabled = false; });
    };

    // LOGO TNC DOWNLOAD LOGIC
    window.handleLogoDownloadGrid = function(id, dlUrl, guideUrl, title) {
        const isPedomanRead = localStorage.getItem('ptv_read_pedoman_' + id);
        if (isPedomanRead === 'true') {
            showToast('Memverifikasi Kredensial...', 'success');
            const formData = new FormData();
            formData.append('action', 'ptv_regenerate_hd_request');
            formData.append('aset_id', id);
            formData.append('device_id', ptvDeviceId);

            fetch('<?php echo admin_url("admin-ajax.php"); ?>', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    showToast('Akses diverifikasi! Mengalihkan ke Halaman Resi...', 'success');
                    window.location.href = res.data.url + '&t=' + new Date().getTime();
                } else {
                    showToast('Akses tidak ditemukan. Silakan request form.', 'error');
                    window.PTV_ACCESS_CACHE = window.PTV_ACCESS_CACHE || {};
                    window.PTV_ACCESS_CACHE[id] = false;
                    openAsetModal(id);
                    setTimeout(() => showReqModal(), 500);
                }
            })
            .catch(err => { showToast('Terjadi kesalahan jaringan/koneksi.', 'error'); });
        } else {
            showLogoTncModal(id, dlUrl, guideUrl, title);
        }
    };

    window.showLogoTncModal = function(id, dlUrl, guideUrl, title) {
        const modal = document.getElementById('logoTncModal');
        const check = document.getElementById('logoTncCheck');
        const btnContinue = document.getElementById('logoTncContinueBtn');
        const btnGuide = document.getElementById('logoTncGuideBtn');

        check.checked = false;
        btnContinue.classList.add('btn-disabled');

        btnGuide.onclick = function() {
            if(guideUrl && guideUrl.trim() !== '') window.open(guideUrl, '_blank');
            else showToast('Panduan belum tersedia.', 'error');
        };

        check.onchange = function() {
            if(this.checked) btnContinue.classList.remove('btn-disabled');
            else btnContinue.classList.add('btn-disabled');
        };

        btnContinue.onclick = function() {
            if(!check.checked) return;
            localStorage.setItem('ptv_read_pedoman_' + id, 'true');
            closeLogoTncModal();
            handleLogoDownloadGrid(id, dlUrl, guideUrl, title);
        };
        modal.classList.add('active');
    };
    window.closeLogoTncModal = function() { document.getElementById('logoTncModal').classList.remove('active'); };

    // TNC GLOBAL
    window.checkTncBanner = function() {
        if(localStorage.getItem('ptv_tnc_dismissed') !== 'true') {
            setTimeout(() => { document.getElementById('tncModal').classList.add('active'); }, 500);
        }
    };
    window.closeTncModal = function() {
        if(document.getElementById('tncDontShow').checked) localStorage.setItem('ptv_tnc_dismissed', 'true');
        document.getElementById('tncModal').classList.remove('active');
    };

    // MODAL LOGIC 
    window.openAsetModal = function(id, e) {
      if(e) e.preventDefault(); 
      const data = window.MASTER_ASET[id];
      if (!data) return;
      document.getElementById('amTitle').innerHTML = data.judul;
      document.getElementById('amDesc').innerHTML = data.desc || "Tidak ada rincian metadata.";
      
      let subText = '';
      if(data.kategori) subText += data.kategori.charAt(0).toUpperCase() + data.kategori.slice(1);
      if(data.subkategori) subText += (subText ? ' - ' : '') + data.subkategori;
      document.getElementById('amSubtitle').innerText = subText || 'ASET';
      
      const catStr = (data.kategori || '').toLowerCase();
      const isProtected = !catStr.includes('logo') && !catStr.includes('pdf');
      const isLogoMode = catStr.includes('logo');
      
      const amCardMain = document.getElementById('amCardMain');
      const imgWrapper = document.getElementById('amImgWrapper');
      const iconEl = document.getElementById('amIcon');
      
      const linkBtn = document.getElementById('amLink');
      const reqBtn = document.getElementById('amReqHighRes');
      const logoDlBtn = document.getElementById('amLogoDlBtn');
      const logoPedomanBtn = document.getElementById('amLogoPedomanBtn');
      const fullPreviewBtn = document.getElementById('amFullPreview');

      window.executeDownloadAction = null;
      if (isLogoMode) {
          amCardMain.classList.add('logo-mode');
          linkBtn.style.display = 'none'; reqBtn.style.display = 'none'; fullPreviewBtn.style.display = 'none';
          logoDlBtn.style.display = 'inline-flex'; logoPedomanBtn.style.display = 'inline-flex';
          
          const dlUrl = processImage(data.gambar).original;
          const guideUrl = data.url;

          logoDlBtn.onclick = function() { handleLogoDownloadGrid(id, dlUrl, guideUrl, data.judul); };
          logoPedomanBtn.onclick = function() {
              if (guideUrl && guideUrl.trim() !== '') window.open(guideUrl, '_blank');
              else showToast('Panduan belum tersedia.', 'error');
          };
      } else {
          amCardMain.classList.remove('logo-mode');
          logoDlBtn.style.display = 'none'; logoPedomanBtn.style.display = 'none';
          
          if (isProtected) {
              reqBtn.style.display = 'inline-flex'; linkBtn.style.display = 'none';
              window.PTV_ACCESS_CACHE = window.PTV_ACCESS_CACHE || {};

              const renderAccessBtn = (hasAccess) => {
                  if (hasAccess) {
                      reqBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Download HD`;
                      reqBtn.className = 'am-btn am-btn-open'; 
                      reqBtn.onclick = function() { regenerateTempUrl(id); };
                  } else {
                      reqBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Request High-Res`;
                      reqBtn.className = 'am-btn am-btn-req'; 
                      reqBtn.onclick = function() { showReqModal(); };
                  }
              };

              if (typeof window.PTV_ACCESS_CACHE[id] !== 'undefined') {
                  renderAccessBtn(window.PTV_ACCESS_CACHE[id]);
              } else {
                  reqBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memeriksa Akses...`;
                  reqBtn.className = 'am-btn am-btn-req';
                  reqBtn.onclick = null;

                  const checkData = new FormData();
                  checkData.append('action', 'ptv_check_hd_access');
                  checkData.append('aset_id', id);
                  checkData.append('device_id', ptvDeviceId);

                  fetch('<?php echo admin_url("admin-ajax.php"); ?>', { method: 'POST', body: checkData })
                  .then(res => res.json())
                  .then(res => {
                      const hasAccess = res.success && res.data.has_access;
                      window.PTV_ACCESS_CACHE[id] = hasAccess; 
                      renderAccessBtn(hasAccess);
                  }).catch(() => { renderAccessBtn(false); });
              }
          } else {
              reqBtn.style.display = 'none'; linkBtn.style.display = 'inline-flex';
              
              if (catStr.includes('pdf')) {
                  linkBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Buka Dokumen PDF';
                  window.executeDownloadAction = () => { 
                      if (data.url && data.url.trim() !== '') window.open(data.url, '_blank'); 
                      else showToast('URL Dokumen PDF belum ditambahkan oleh Admin.', 'error');
                  };
              } else {
                  linkBtn.innerHTML = '<i class="fa-solid fa-download"></i> Unduh / Kunjungi';
                  window.executeDownloadAction = () => { window.open(data.url || processImage(data.gambar).original, '_blank'); };
              }
          }
      }

      const amImageEl = document.getElementById('amImage');
      
      let instantSrc = null, instantFinalSrc = null;
      const gridCard = document.querySelector(`[onclick*="openAsetModal('${id}'"]`);
      if (gridCard) {
          const gridImg = gridCard.querySelector('.os-file-thumb img');
          if (gridImg && gridImg.src && !gridImg.src.includes('data:image/svg+xml')) {
              instantSrc = gridImg.src; instantFinalSrc = gridImg.dataset.finalSrc || gridImg.src;
          }
      }

      if (data.gambar && data.gambar.trim() !== '') {
          const imgData = processImage(data.gambar);
          amImageEl.className = isProtected ? '' : 'transparent-bg';
          
          if (instantSrc) { amImageEl.src = instantSrc; amImageEl.dataset.finalSrc = instantFinalSrc; } 
          else {
              amImageEl.src = imgData.preview;
              if (isProtected) {
                  amImageEl.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3C/svg%3E";
                  applyHardWatermark(amImageEl, imgData.preview, data.judul, null, data.crop_pos || 'center', imgData.original);
              }
          }
          
          if(!isLogoMode) {
              fullPreviewBtn.style.display = 'inline-flex';
              fullPreviewBtn.onclick = function() { openFullPreviewModal(amImageEl.dataset.finalSrc || amImageEl.src); };
          }
          imgWrapper.style.display = 'flex'; iconEl.style.display = 'none';
      } else {
          imgWrapper.style.display = 'none'; iconEl.style.display = 'flex';
          fullPreviewBtn.style.display = 'none';
          
          let modalIconStr = 'fa-file';
          if (catStr.includes('pdf')) modalIconStr = 'fa-file-pdf';
          else if (catStr.includes('tokoh')) modalIconStr = 'fa-user';
          else if (catStr.includes('tempat') || catStr.includes('fasilitas')) modalIconStr = 'fa-location-dot';
          
          iconEl.className = `am-icon ${catStr.includes('pdf') ? 'bg-red-soft' : (catStr.includes('tokoh') ? 'bg-purple-soft' : 'bg-green-soft')}`;
          iconEl.innerHTML = `<i class="fa-solid ${modalIconStr}"></i>`;
      }

      document.getElementById('amCopy').onclick = () => {
          writeClipboard(window.PTV_PORTAL_URL + data.slug + '/').then(ok => { if(ok) showToast(`Disalin!`); });
      };
      
      document.getElementById('asetModal').classList.add('active');
      const cleanUrl = window.PTV_PORTAL_URL + data.slug + '/';
      if (window.location.href !== cleanUrl) window.history.pushState({modalId: id}, data.judul, cleanUrl);
    };

    window.closeAsetModal = function(e) {
      if(e) e.preventDefault();
      document.getElementById('asetModal').classList.remove('active');
      window.history.pushState(null, '', window.PTV_PORTAL_URL);
    };

    window.openFullPreviewModal = function(src) {
        document.getElementById('fullPreviewImg').src = src;
        document.getElementById('fullPreviewModal').classList.add('active');
    };
    window.closeFullPreviewModal = function(e) {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        document.getElementById('fullPreviewModal').classList.remove('active');
    };

    // CLOSE MODALS ON OUTSIDE CLICK
    document.getElementById('asetModal').addEventListener('click', function(e) { if (e.target === this) closeAsetModal(); });
    document.getElementById('tncModal').addEventListener('click', function(e) { if (e.target === this) closeTncModal(); });
    document.getElementById('logoTncModal').addEventListener('click', function(e) { if (e.target === this) closeLogoTncModal(); });
    document.getElementById('reqModal').addEventListener('click', function(e) { if (e.target === this) closeReqModal(); });

    // BOOT
    checkTncBanner();
    let initId = new URLSearchParams(window.location.search).get('id');
    if (!initId) {
        const parts = window.location.pathname.split('/').filter(p => p);
        const slug = parts[parts.length - 1];
        if (slug && slug !== 'aset' && window.SLUG_TO_ID[slug]) initId = window.SLUG_TO_ID[slug];
    }
    
    if (initId && window.MASTER_ASET[initId]) {
        openRoot(); 
        openAsetModal(initId);
    } else {
        openRoot();
    }

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.modalId) openAsetModal(e.state.modalId);
        else closeAsetModal();
    });

  </script>
  
  <?php wp_footer(); ?>
</body>
</html>
