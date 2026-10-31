import { describe, it, expect } from 'vitest';
import { sanitizeHtml, normalizeContentForEditor, stripHtml } from '../../src/products/hub/catatan/utils/htmlSanitizer';

describe('Catatan Bersama — Rich Text Editor & HTML Integrity Tests', () => {
  describe('1. HTML Sanitization & XSS Defense', () => {
    it('1.1 Should strip script tags and event handlers', () => {
      const malicious = '<p>Halo <script>alert("hack")</script><img src="x" onerror="alert(1)"> Dunia</p>';
      const cleaned = sanitizeHtml(malicious);
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).not.toContain('onerror');
      expect(cleaned).toContain('Halo');
      expect(cleaned).toContain('Dunia');
    });

    it('1.2 Should strip javascript: protocol in attributes', () => {
      const dangerous = '<p><a href="javascript:alert(1)">Klik Ini</a></p>';
      const cleaned = sanitizeHtml(dangerous);
      expect(cleaned).not.toContain('javascript:');
      expect(cleaned).toContain('Klik Ini');
    });

    it('1.3 Should preserve legitimate formatting tags: h1, h2, p, strong, br, ul, li, blockquote', () => {
      const safe = '<h1>Judul Utama</h1><h2>Subjudul</h2><p>Teks <strong>tebal</strong> dan <em>miring</em>.<br>Baris kedua.</p><ul><li>Poin 1</li><li>Poin 2</li></ul><blockquote>Kutipan</blockquote>';
      const cleaned = sanitizeHtml(safe);
      expect(cleaned).toContain('<h1>Judul Utama</h1>');
      expect(cleaned).toContain('<h2>Subjudul</h2>');
      expect(cleaned).toContain('<strong>tebal</strong>');
      expect(cleaned).toContain('<br>');
      expect(cleaned).toContain('<ul><li>Poin 1</li><li>Poin 2</li></ul>');
      expect(cleaned).toContain('<blockquote>Kutipan</blockquote>');
    });
  });

  describe('2. Legacy HTML & Structure Compatibility', () => {
    it('2.1 Should accurately handle legacy note with multiple line breaks (<br>)', () => {
      const legacyNote = '<h1>Rundown Acara</h1><p>• Cam 1: Sony FX3<br>• Cam 2: Sony A7 IV<br>• Cam 3: PTZ</p>';
      const cleaned = sanitizeHtml(legacyNote);
      expect(cleaned).toBe(legacyNote);
    });

    it('2.2 Should normalize plain text without HTML to structured paragraphs and line breaks', () => {
      const plainText = 'Baris 1\nBaris 2\n\nParagraf kedua';
      const normalized = normalizeContentForEditor(plainText);
      expect(normalized).toBe('<p>Baris 1<br>Baris 2</p><p>Paragraf kedua</p>');
    });

    it('2.3 Should preserve already formatted HTML when normalized for editor', () => {
      const richContent = '<h1>SOP Kamera</h1><p>Pastikan baterai penuh.<br>Simpan di dry box.</p>';
      const normalized = normalizeContentForEditor(richContent);
      expect(normalized).toBe(richContent);
    });

    it('2.4 Should preserve long paragraph content without truncation', () => {
      const longText = '<p>' + 'Evaluasi operasional siaran langsung '.repeat(50) + '</p>';
      const cleaned = sanitizeHtml(longText);
      expect(cleaned).toContain('Evaluasi operasional siaran langsung');
      expect(cleaned.length).toBeGreaterThan(1500);
    });
  });

  describe('3. Round-trip Content Integrity', () => {
    it('3.1 Opening note -> Editing -> Saving without change preserves original content', () => {
      const original = '<h1>Catatan Koordinasi</h1><p>Poin penting:</p><ul><li>Item A</li><li>Item B</li></ul>';
      const normalizedForEdit = normalizeContentForEditor(original);
      const saved = sanitizeHtml(normalizedForEdit);
      expect(saved).toBe(original);
    });

    it('3.2 Appending new section during edit maintains proper nesting', () => {
      const original = '<h1>Catatan</h1><p>Isi awal</p>';
      const edited = original + '<h2>Catatan Tambahan</h2><p>Isi baru</p>';
      const saved = sanitizeHtml(edited);
      expect(saved).toContain('<h1>Catatan</h1>');
      expect(saved).toContain('<h2>Catatan Tambahan</h2>');
    });
  });

  describe('4. Strip HTML Utility (Search & Card Previews)', () => {
    it('4.1 Should extract readable plain text without tags or comment leakage', () => {
      const html = '<h1>Judul</h1><!-- PTV_META: {"date":"2026-10-15"} --><p>Isi <b>tebal</b>.<br>Baris baru.</p>';
      const plain = stripHtml(html);
      expect(plain).not.toContain('<h1>');
      expect(plain).not.toContain('PTV_META');
      expect(plain).toBe('Judul\nIsi tebal.\nBaris baru.');
    });
  });

  describe('5. Image Support & Embedded Media Security', () => {
    it('5.1 Should preserve safe base64 data URL images with lazy loading and editor class', () => {
      const noteWithImg = '<p>Dokumentasi rapat:</p><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Bagan Alur"></p>';
      const cleaned = sanitizeHtml(noteWithImg);
      expect(cleaned).toContain('<img');
      expect(cleaned).toContain('data:image/png;base64,');
      expect(cleaned).toContain('alt="Bagan Alur"');
      expect(cleaned).toContain('catatan-editor-img');
      expect(cleaned).toContain('loading="lazy"');
    });

    it('5.2 Should allow safe blob URLs and external HTTPS image sources', () => {
      const noteWithBlob = '<p><img src="blob:http://localhost:5174/mock-blob-uuid" alt="Foto Studio"></p>';
      const cleanedBlob = sanitizeHtml(noteWithBlob);
      expect(cleanedBlob).toContain('src="blob:http://localhost:5174/mock-blob-uuid"');

      const noteWithHttps = '<p><img src="https://images.unsplash.com/photo-1" alt="Foto Kamera"></p>';
      const cleanedHttps = sanitizeHtml(noteWithHttps);
      expect(cleanedHttps).toContain('src="https://images.unsplash.com/photo-1"');
    });

    it('5.3 Should strip malicious javascript: src from img tag', () => {
      const maliciousImg = '<p><img src="javascript:alert(\'xss\')" alt="Hacked"></p>';
      const cleaned = sanitizeHtml(maliciousImg);
      expect(cleaned).not.toContain('javascript:');
    });

    it('5.4 Should eliminate onerror and onload event handlers on img tags', () => {
      const maliciousHandler = '<p><img src="data:image/jpeg;base64,/9j/4AAQSkZJRg==" onerror="alert(1)" onload="alert(2)"></p>';
      const cleaned = sanitizeHtml(maliciousHandler);
      expect(cleaned).not.toContain('onerror');
      expect(cleaned).not.toContain('onload');
      expect(cleaned).toContain('data:image/jpeg;base64,');
    });

    it('5.5 Should preserve round-trip integrity of multiple images situated between paragraphs and headings', () => {
      const mixedContent = '<h1>Notulensi</h1><p>Bagian 1</p><p><img src="data:image/png;base64,AAAA" alt="Gambar 1" class="catatan-editor-img" loading="lazy"></p><h2>Rincian</h2><ul><li>Poin A</li></ul><p><img src="data:image/png;base64,BBBB" alt="Gambar 2" class="catatan-editor-img" loading="lazy"></p>';
      const normalized = normalizeContentForEditor(mixedContent);
      const saved = sanitizeHtml(normalized);
      expect(saved).toContain('<h1>Notulensi</h1>');
      expect(saved).toContain('alt="Gambar 1"');
      expect(saved).toContain('<h2>Rincian</h2>');
      expect(saved).toContain('alt="Gambar 2"');
    });
  });
});
