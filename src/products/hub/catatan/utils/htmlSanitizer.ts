/**
 * PTV PRO — Catatan Bersama HTML Sanitizer & Content Normalizer
 * Lightweight, zero-dependency browser-native HTML sanitization & spacing preservation.
 */

const ALLOWED_TAGS = new Set([
  'H1', 'H2', 'H3', 'P', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR', 'SPAN', 'DIV', 'IMG'
]);

/**
 * Validates if an image source is safe (data image URL, blob URL, https, or relative path)
 * and strictly rejects javascript:, vbscript:, or executable payloads.
 */
export function isSafeImageSrc(src: string): boolean {
  if (!src) return false;
  const trimmed = src.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) return false;
  return /^(?:data:image\/(?:jpeg|jpg|png|webp|gif|svg\+xml);base64,|blob:|https?:\/\/|\/)/i.test(trimmed);
}

/**
 * Sanitizes an HTML string to eliminate XSS vectors while preserving legitimate rich text formatting and safe images.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';

  // Fast pre-filter for dangerous markup & attributes across all environments (browser & Node.js vitest)
  let preCleaned = dirtyHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '') // strip quoted on* handlers: onerror="...", onclick='...'
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '') // strip unquoted on* handlers
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, '') // strip href="javascript:..."
    .replace(/href\s*=\s*javascript:[^\s>]+/gi, '') // strip unquoted href=javascript:...
    .replace(/src\s*=\s*(['"])javascript:.*?\1/gi, '') // strip src="javascript:..."
    .replace(/src\s*=\s*javascript:[^\s>]+/gi, ''); // strip unquoted src=javascript:...

  // Normalize and validate <img> tags across both browser and Node.js vitest environments
  preCleaned = preCleaned.replace(/<img\b([^>]*)>/gi, (_match, attrs) => {
    const srcMatch = attrs.match(/src\s*=\s*(['"])(.*?)\1/i) || attrs.match(/src\s*=\s*([^\s>]+)/i);
    const src = srcMatch ? (srcMatch[2] || srcMatch[1]) : '';
    if (!isSafeImageSrc(src)) {
      return '';
    }
    let newAttrs = attrs;
    if (!/class\s*=\s*['"][^'"]*catatan-editor-img/i.test(newAttrs)) {
      if (/class\s*=\s*(['"])(.*?)\1/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/class\s*=\s*(['"])(.*?)\1/i, 'class="$2 catatan-editor-img"');
      } else {
        newAttrs += ' class="catatan-editor-img"';
      }
    }
    if (!/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
    }
    return `<img ${newAttrs.trim()}>`;
  });

  if (typeof DOMParser === 'undefined') {
    return preCleaned;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(preCleaned, 'text/html');

    function cleanNode(node: Node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tag = el.tagName.toUpperCase();

          if (!ALLOWED_TAGS.has(tag)) {
            // Unwrap children instead of dropping content
            while (el.firstChild) {
              el.parentNode?.insertBefore(el.firstChild, el);
            }
            el.remove();
          } else if (tag === 'IMG') {
            const rawSrc = el.getAttribute('src') || '';
            if (!isSafeImageSrc(rawSrc)) {
              el.remove();
              continue;
            }

            // Clean image attributes strictly
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              if (!['src', 'alt', 'title', 'class', 'loading', 'width', 'height'].includes(attrName)) {
                el.removeAttribute(attr.name);
              }
            }

            // Ensure proper classes & lazy loading
            const currentClass = el.getAttribute('class') || '';
            if (!currentClass.includes('catatan-editor-img')) {
              el.setAttribute('class', (currentClass + ' catatan-editor-img').trim());
            }
            el.setAttribute('loading', 'lazy');
          } else {
            // Strip any malicious attributes (on*, javascript:, data:) on regular elements
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              const attrVal = attr.value.toLowerCase();
              if (
                attrName.startsWith('on') ||
                attrVal.includes('javascript:') ||
                attrVal.includes('data:text/html') ||
                attrName === 'src'
              ) {
                el.removeAttribute(attr.name);
              }
            }
            cleanNode(el);
          }
        } else if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.COMMENT_NODE) {
          child.remove();
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  } catch {
    return preCleaned;
  }
}

/**
 * Normalizes content for loading into the contenteditable editor.
 * - If the content already contains HTML tags, preserves its exact structure via sanitizeHtml.
 * - If the content is legacy plain text with newlines, safely wraps paragraphs and line breaks.
 */
export function normalizeContentForEditor(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();

  // Check if content already contains HTML tags
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeHtml(trimmed);
  }

  // Legacy plain text: convert double newlines to paragraphs, single newlines to <br>
  return trimmed
    .split(/\r?\n\s*\r?\n/)
    .map(para => `<p>${para.replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Strips HTML tags cleanly for card preview, title extraction, and full-text search.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
