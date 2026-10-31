import React, { useRef, useEffect, useState, useCallback } from 'react';
import { normalizeContentForEditor } from '../utils/htmlSanitizer';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface NoteRichEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const NoteRichEditor: React.FC<NoteRichEditorProps> = ({
  initialHtml,
  onChange,
  placeholder = 'Tulis judul & isi catatan di sini... (Gunakan toolbar di atas untuk format)'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const isInternalTypingRef = useRef<boolean>(false);
  const isFirstMountRef = useRef<boolean>(true);

  const [activeFormats, setActiveFormats] = useState({
    h1: false,
    h2: false,
    p: false,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    ul: false,
    ol: false,
    quote: false
  });

  const [isSpacingOpen, setIsSpacingOpen] = useState(false);
  const [lineSpacing, setLineSpacing] = useState(0);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  // Auto-dismiss validation notice after 6 seconds
  useEffect(() => {
    if (!validationNotice) return;
    const timer = setTimeout(() => {
      setValidationNotice(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [validationNotice]);

  // Load initial content cleanly
  useEffect(() => {
    if (!editorRef.current) return;
    if (!isFirstMountRef.current && isInternalTypingRef.current) {
      isInternalTypingRef.current = false;
      return;
    }
    const normalized = normalizeContentForEditor(initialHtml);
    editorRef.current.innerHTML = normalized;
    isFirstMountRef.current = false;
  }, [initialHtml]);

  // Close spacing popover on click outside
  useEffect(() => {
    if (!isSpacingOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.note-spacing-dropdown')) {
        setIsSpacingOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSpacingOpen]);

  // Save selection before opening file picker or blur
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
  }, []);

  // Restore saved selection
  const restoreSelection = useCallback((): Range | null => {
    if (!editorRef.current) return null;
    editorRef.current.focus();

    if (savedRangeRef.current && editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
        return savedRangeRef.current;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return range;
  }, []);

  // Update toolbar active states based on current selection
  const updateToolbar = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !editorRef.current.contains(sel.anchorNode)) {
      return;
    }

    let isH1 = false;
    let isH2 = false;
    let isP = false;
    let isQuote = false;
    let isUl = false;
    let isOl = false;
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrike = false;

    try {
      isBold = document.queryCommandState('bold');
      isItalic = document.queryCommandState('italic');
      isUnderline = document.queryCommandState('underline');
      isStrike = document.queryCommandState('strikeThrough');
      isUl = document.queryCommandState('insertUnorderedList');
      isOl = document.queryCommandState('insertOrderedList');
    } catch {
      // Ignored
    }

    let curr: Node | null = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    while (curr && curr !== editorRef.current) {
      if (curr.nodeType === 1) {
        const tag = (curr as HTMLElement).tagName.toLowerCase();
        if (tag === 'h1') isH1 = true;
        if (tag === 'h2') isH2 = true;
        if (tag === 'p') isP = true;
        if (tag === 'blockquote') isQuote = true;
        if (tag === 'ul') isUl = true;
        if (tag === 'ol') isOl = true;
      }
      curr = curr.parentNode;
    }

    if (!isH1 && !isH2 && !isQuote && !isUl && !isOl) {
      isP = true;
    }

    setActiveFormats({
      h1: isH1,
      h2: isH2,
      p: isP,
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      strike: isStrike,
      ul: isUl,
      ol: isOl,
      quote: isQuote
    });
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    isInternalTypingRef.current = true;
    onChange(currentHtml);
    updateToolbar();
  };

  const execFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (command === 'formatBlock') {
      const targetTag = (value || '').toLowerCase();
      if (
        (targetTag === '<h1>' && activeFormats.h1) ||
        (targetTag === '<h2>' && activeFormats.h2) ||
        (targetTag === '<blockquote>' && activeFormats.quote)
      ) {
        document.execCommand('formatBlock', false, '<p>');
      } else {
        document.execCommand('formatBlock', false, targetTag);
      }
    } else {
      document.execCommand(command, false, value || undefined);
    }

    const updatedHtml = editorRef.current.innerHTML;
    isInternalTypingRef.current = true;
    onChange(updatedHtml);
    updateToolbar();
  };

  const handleToolbarAction = (
    e: React.MouseEvent | React.TouchEvent,
    command: string,
    value?: string
  ) => {
    e.preventDefault();
    execFormat(command, value);
  };

  // Line spacing slider
  const handleLineSpacing = (val: number) => {
    setLineSpacing(val);
    if (!editorRef.current) return;
    const computed = Math.max(0.85, 1.65 + val * 0.25).toFixed(2);
    editorRef.current.style.lineHeight = computed;
    editorRef.current.querySelectorAll('p, h1, h2, h3, li, blockquote, div').forEach(el => {
      (el as HTMLElement).style.lineHeight = computed;
    });
  };

  // Letter spacing slider
  const handleLetterSpacing = (val: number) => {
    setLetterSpacing(val);
    if (!editorRef.current) return;
    const str = `${val}px`;
    editorRef.current.style.letterSpacing = str;
    editorRef.current.querySelectorAll('p, h1, h2, h3, li, blockquote, div, span, b, i, u').forEach(el => {
      (el as HTMLElement).style.letterSpacing = str;
    });
  };

  const handleResetSpacing = () => {
    setLineSpacing(0);
    setLetterSpacing(0);
    if (!editorRef.current) return;
    editorRef.current.style.lineHeight = '1.65';
    editorRef.current.style.letterSpacing = '0px';
    editorRef.current.querySelectorAll('p, h1, h2, h3, li, blockquote, div, span, b, i, u').forEach(el => {
      (el as HTMLElement).style.lineHeight = '1.65';
      (el as HTMLElement).style.letterSpacing = '0px';
    });
  };

  // Insert image element
  const insertImageAtTargetRange = (dataUrl: string, altText?: string, targetRange?: Range | null) => {
    if (!editorRef.current) return;
    const range = targetRange || restoreSelection();
    if (!range) return;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = altText || 'Gambar catatan';
    img.className = 'catatan-editor-img';
    img.setAttribute('loading', 'lazy');

    const paraAfter = document.createElement('p');
    paraAfter.innerHTML = '<br>';

    range.deleteContents();
    range.insertNode(img);

    if (img.nextSibling) {
      img.parentNode?.insertBefore(paraAfter, img.nextSibling);
    } else {
      img.parentNode?.appendChild(paraAfter);
    }

    const newRange = document.createRange();
    newRange.setStart(paraAfter, 0);
    newRange.collapse(true);

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    handleInput();
  };

  const validateAndProcessFiles = (files: FileList | File[], targetRange?: Range | null) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    for (const file of fileArray) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setValidationNotice(`Format file "${file.name}" tidak didukung. Harap pilih gambar JPEG, PNG, WebP, atau GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setValidationNotice(`Ukuran file "${file.name}" (${sizeMb} MB) melebihi batas 5 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          insertImageAtTargetRange(dataUrl, file.name, targetRange);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="note-editor-wrapper">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* Rich Format Toolbar (Persis Screenshot 2 & PHP Legacy) */}
      <div className="note-editor-toolbar" role="toolbar" aria-label="Format Teks">
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.h1 ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'formatBlock', '<h1>')}
          title="Heading 1"
          aria-pressed={activeFormats.h1}
        >
          <b>H1</b>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.h2 ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'formatBlock', '<h2>')}
          title="Heading 2"
          aria-pressed={activeFormats.h2}
        >
          <b>H2</b>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.p ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'formatBlock', '<p>')}
          title="Teks Normal / Paragraf"
          aria-pressed={activeFormats.p}
        >
          <b>P</b>
        </button>

        <span className="note-editor-toolbar-separator" aria-hidden="true"></span>

        <button
          type="button"
          className={`note-editor-btn ${activeFormats.bold ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'bold')}
          title="Tebal (Bold)"
          aria-pressed={activeFormats.bold}
        >
          <i className="fa-solid fa-bold"></i>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.italic ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'italic')}
          title="Miring (Italic)"
          aria-pressed={activeFormats.italic}
        >
          <i className="fa-solid fa-italic"></i>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.underline ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'underline')}
          title="Garis Bawah (Underline)"
          aria-pressed={activeFormats.underline}
        >
          <i className="fa-solid fa-underline"></i>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.strike ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'strikeThrough')}
          title="Coret (Strikethrough)"
          aria-pressed={activeFormats.strike}
        >
          <i className="fa-solid fa-strikethrough"></i>
        </button>

        <span className="note-editor-toolbar-separator" aria-hidden="true"></span>

        {/* Spasi Dropdown Popover */}
        <div className="note-spacing-dropdown">
          <button
            type="button"
            className="note-editor-btn"
            title="Atur Spasi Baris & Jarak Huruf"
            onClick={(e) => {
              e.preventDefault();
              setIsSpacingOpen(!isSpacingOpen);
            }}
          >
            <i className="fa-solid fa-arrows-up-down"></i>
            <span style={{ fontSize: '11px', marginLeft: '3px', fontWeight: 700 }}>Spasi</span>
          </button>
          {isSpacingOpen && (
            <div className="note-spacing-popover" onClick={(e) => e.stopPropagation()}>
              <div className="note-slider-group">
                <div className="note-slider-header">
                  <span><i className="fa-solid fa-arrows-up-down" style={{ marginRight: '5px', color: '#2563eb' }}></i>Spasi Baris</span>
                  <span className="note-slider-val">{lineSpacing > 0 ? `+${lineSpacing}` : lineSpacing}</span>
                </div>
                <input
                  type="range"
                  className="note-range-input"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={lineSpacing}
                  onChange={(e) => handleLineSpacing(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div style={{ height: '1px', background: 'var(--line-2, #e2e8f0)', margin: '2px 0' }}></div>

              <div className="note-slider-group">
                <div className="note-slider-header">
                  <span><i className="fa-solid fa-arrows-left-right" style={{ marginRight: '5px', color: '#2563eb' }}></i>Jarak Huruf</span>
                  <span className="note-slider-val">{letterSpacing > 0 ? `+${letterSpacing}` : letterSpacing}</span>
                </div>
                <input
                  type="range"
                  className="note-range-input"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={letterSpacing}
                  onChange={(e) => handleLetterSpacing(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div style={{ height: '1px', background: 'var(--line-2, #e2e8f0)', margin: '2px 0' }}></div>

              <button
                type="button"
                className="btn sm"
                onClick={handleResetSpacing}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '5px',
                  border: '1px solid var(--line-2, #e2e8f0)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>Reset Normal</span>
              </button>
            </div>
          )}
        </div>

        <span className="note-editor-toolbar-separator" aria-hidden="true"></span>

        <button
          type="button"
          className={`note-editor-btn ${activeFormats.ul ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'insertUnorderedList')}
          title="Daftar Poin (Bullet List)"
          aria-pressed={activeFormats.ul}
        >
          <i className="fa-solid fa-list-ul"></i>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.ol ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'insertOrderedList')}
          title="Daftar Nomor (Numbered List)"
          aria-pressed={activeFormats.ol}
        >
          <i className="fa-solid fa-list-ol"></i>
        </button>
        <button
          type="button"
          className={`note-editor-btn ${activeFormats.quote ? 'is-active' : ''}`}
          onMouseDown={(e) => handleToolbarAction(e, 'formatBlock', '<blockquote>')}
          title="Kutipan (Quote)"
          aria-pressed={activeFormats.quote}
        >
          <i className="fa-solid fa-quote-left"></i>
        </button>
        <button
          type="button"
          className="note-editor-btn"
          onMouseDown={(e) => handleToolbarAction(e, 'removeFormat')}
          title="Hapus Format"
        >
          <i className="fa-solid fa-eraser"></i>
        </button>

        {/* Tombol Gambar */}
        <button
          type="button"
          className="note-editor-btn note-editor-btn-image"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
            fileInputRef.current?.click();
          }}
          title="Sisipkan Gambar"
          aria-label="Sisipkan Gambar"
        >
          <i className="fa-solid fa-image" style={{ color: '#2563eb' }}></i>
        </button>
      </div>

      {/* Validation Warning Alert */}
      {validationNotice && (
        <div className="note-editor-alert" role="alert" aria-live="assertive">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ color: '#dc2626', flexShrink: 0 }}></i>
            <span style={{ fontSize: '12px', color: '#991b1b', lineHeight: 1.4 }}>{validationNotice}</span>
          </div>
          <button
            type="button"
            className="note-editor-alert-close"
            onClick={() => setValidationNotice(null)}
            aria-label="Tutup pesan peringatan"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Contenteditable WYSIWYG Surface */}
      <div
        ref={editorRef}
        className={`note-editor-content ${isDragging ? 'is-dragging' : ''}`}
        contentEditable
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyUp={updateToolbar}
        onMouseUp={updateToolbar}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            let dropRange: Range | null = null;
            if (document.caretRangeFromPoint) {
              dropRange = document.caretRangeFromPoint(e.clientX, e.clientY);
            }
            validateAndProcessFiles(e.dataTransfer.files, dropRange);
          }
        }}
      />
    </div>
  );
};
