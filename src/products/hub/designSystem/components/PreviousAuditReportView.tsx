/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * PreviousAuditReportView: Comprehensive forensic audit of previous True Corner Smoothing Lab V1.
 * Addresses all 9 evaluation points and explains mathematically and visually why previous results felt stiff.
 */

import React from 'react';

export const PreviousAuditReportView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Header ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Audit Forensik Laboratorium V1
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Dekonstruksi Matematis &amp; Identifikasi Kelemahan Implementasi Lama
          </span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Mengapa Hasil Sebelumnya Masih Terasa Kaku? (Audit 9 Aspek Kritis)
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
          Penggunaan superellipse tidak secara otomatis menghasilkan continuous curvature yang ideal.
          Berikut adalah investigasi mendalam terhadap 9 aspek algoritma lama yang menyebabkan sudut masih terlihat kaku, menggembung tidak wajar, atau terdistorsi pada nesting dalam.
        </p>
      </div>

      {/* ── The 9 Audit Findings Accordion / Cards Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
        }}
      >
        {/* 1. Algoritma A, B, C */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              1
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Algoritma Pembentukan Kurva A, B, dan C
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Temuan:</b> Komponen A menggunakan <code>border-radius</code> circular ($n=2$).
            Komponen B memanggil properti draft <code>corner-shape: squircle</code> yang belum didukung engine Chromium/Gecko/WebKit mana pun sehingga 100% jatuh ke fallback A.
            Komponen C menggunakan diskretisasi poligon Gabriel Lamé (1818) dengan 28 titik per kuadran.
          </div>
        </div>

        {/* 2. Penggunaan circular border-radius */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              2
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Penyebab Kekakuan Circular border-radius
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Masalah Matematis:</b> Busur lingkaran memiliki kelengkungan konstan $\kappa = 1/R$. Pada titik pertemuan dengan sisi lurus ($\kappa = 0$), terjadi lonjakan seketika (step discontinuity) $\Delta\kappa = 1/R$.
            Sistem penglihatan manusia mendeteksi diskontinuitas turunan kedua ini sebagai "patahan visual", layaknya seperempat lingkaran yang ditempelkan paksa pada kotak.
          </div>
        </div>

        {/* 3. Penggunaan CSS corner-shape */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              3
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Ilusi Native CSS corner-shape
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Temuan:</b> Pengujian laboratorium sebelumnya memberi label "Aktif" jika ada stub properti, padahal rasterizer nyata di Chrome/Edge saat ini belum mengeksekusi squircle CSS. Evaluasi visual Komponen B sebenarnya hanyalah duplikat 100% dari Komponen A.
          </div>
        </div>

        {/* 4. Implementasi persamaan Lamé */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              4
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Jebakan Bounding Box $R \times R$ pada Lamé
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Masalah Utama:</b> Implementasi lama membatasi superellipse strictly di dalam kotak $R \times R$.
            Akibatnya, saat exponent $n$ dinaikkan ($n=3.5$ s.d. $5.0$), kurva terdorong ke arah pojok diagonal luar, tetapi dipaksa membelok tajam di dalam ruang sempit tersebut. Kurva tidak mengulurkan transisinya ke tepi lurus (seperti yang dilakukan Apple dengan $L \approx 1.5R$), sehingga tampak menggembung dan kaku ("boxy").
          </div>
        </div>

        {/* 5. Exponent, radius, dan fullness */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              5
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Kekeliruan Asumsi "Fullness = Lebih Halus"
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Temuan:</b> Lab lama membanggakan &Delta;d &gt; 0 (+2.6px diagonal offset) sebagai bukti kehalusan.
            Padahal, fullness berlebih justru membuat komponen menyerupai "bantal gembung" atau persegi panjang tumpul. Prinsip Apple bukanlah memaksimalkan fullness, melainkan <b>memperpanjang zona transisi kelengkungan secara bertahap</b>.
          </div>
        </div>

        {/* 6. Perhitungan inner corners */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              6
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Kesalahan Skalar R_inner = R_outer - inset pada Non-Circle
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Masalah Matematis:</b> Mengurangi radius skalar lalu membuat superellipse baru menghasilkan jarak normal yang bervariasi: di sisi lurus jaraknya $d$, namun di sudut diagonal 45° jaraknya menyusut drastis. Akibatnya, padding sudut terasa "tercekik" (pinched) dan tidak konsentris sejati.
          </div>
        </div>

        {/* 7. SVG path atau clipping */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              7
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Diskretisasi Poligon vs Kurva Parametrik Sejati
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Temuan:</b> Penggunaan 28 garis lurus (<code>L x y</code>) per kuadran menghasilkan poligon 112 sisi. Pada layar resolusi tinggi (Retina/4K), sambungan segmen garis ini terlihat sebagai facet mikro (patah-patah halus) dibandingkan kurva Bézier kubik yang dirender mulus oleh GPU font/vector engine.
          </div>
        </div>

        {/* 8. Dampak border, shadow, overflow, focus ring */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              8
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Kerusakan Border, Box-Shadow, &amp; Popover
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Masalah Rendering:</b> SVG <code>clip-path</code> langsung memotong CSS <code>box-shadow</code> (bayangan terpotong kotak), memotong <code>outline</code> focus keyboard, dan memenggal dropdown menu yang terbuka. Border CSS standar juga terpotong setengah stroke-nya.
          </div>
        </div>

        {/* 9. Perbedaan konten antar-sampel */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
              9
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Pelanggaran Fair Comparison (Desain Kartu Berbeda)
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
            <b>Kelemahan Metodologi:</b> Kartu A menampilkan "Kamera FX3" tombol biru, Kartu B "Lensa GM" tombol kuning, dan Kartu C "Mic DJI" tombol hijau.
            Perbedaan warna, panjang judul, dan aksen visual mengacaukan persepsi pengamat, sehingga yang dinilai bukan lagi profil kurva melainkan estetika kartu.
          </div>
        </div>
      </div>
    </div>
  );
};
