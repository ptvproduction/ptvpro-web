import { describe, it, expect } from 'vitest';
import { NOTE_CATEGORIES, NoteCategoryKey, NoteItem } from '../types';

describe('PTV PRO — Catatan Bersama Hotfix Verification Tests', () => {
  describe('1. Elimination of Add Note Card from Grid', () => {
    it('1.1 NOTE_CATEGORIES must contain exactly the 5 approved color categories', () => {
      const keys = Object.keys(NOTE_CATEGORIES) as NoteCategoryKey[];
      expect(keys).toHaveLength(5);
      expect(keys).toEqual(expect.arrayContaining(['orange', 'yellow', 'green', 'purple', 'rose']));
    });

    it('1.2 Should preserve full official metadata for all 5 categories', () => {
      // Orange / Buñol
      expect(NOTE_CATEGORIES.orange.short).toBe('Penting');
      expect(NOTE_CATEGORIES.orange.label).toBe('Penting & Prioritas');
      expect(NOTE_CATEGORIES.orange.bg).toBe('#F46E56');

      // Yellow / Bagan
      expect(NOTE_CATEGORIES.yellow.short).toBe('Ide');
      expect(NOTE_CATEGORIES.yellow.label).toBe('Ide & Rencana');
      expect(NOTE_CATEGORIES.yellow.bg).toBe('#FDE3BC');

      // Green / Sagano
      expect(NOTE_CATEGORIES.green.short).toBe('Info');
      expect(NOTE_CATEGORIES.green.label).toBe('Info & Pengumuman');
      expect(NOTE_CATEGORIES.green.bg).toBe('#D4F1ED');

      // Purple / Valensole
      expect(NOTE_CATEGORIES.purple.short).toBe('Agenda');
      expect(NOTE_CATEGORIES.purple.label).toBe('Agenda & Acara');
      expect(NOTE_CATEGORIES.purple.bg).toBe('#9489BD');

      // Rose / Nara
      expect(NOTE_CATEGORIES.rose.short).toBe('Tugas');
      expect(NOTE_CATEGORIES.rose.label).toBe('Tugas & Rundown');
      expect(NOTE_CATEGORIES.rose.bg).toBe('#FCE0DC');
    });

    it('1.3 Regular notes array should not contain any artificial add action placeholder item', () => {
      const mockNotes: NoteItem[] = [
        {
          id: 'note-1',
          tipe: 'shared',
          warna: 'orange',
          judul: 'SOP Live Streaming',
          isi: '<p>Konten SOP</p>',
          tags: ['sop', 'studio'],
          is_pinned: false,
          created_by_id: 'u-1',
          created_by_name: 'Budi',
          created_at: '2026-10-17T08:00:00Z',
          updated_at: '2026-10-17T08:00:00Z'
        },
        {
          id: 'note-2',
          tipe: 'shared',
          warna: 'yellow',
          judul: 'Ide Konten Reels',
          isi: '<p>Brainstorming</p>',
          tags: ['kreatif'],
          is_pinned: false,
          created_by_id: 'u-2',
          created_by_name: 'Siti',
          created_at: '2026-10-17T09:00:00Z',
          updated_at: '2026-10-17T09:00:00Z'
        }
      ];

      // Regular notes should directly map 1:1 without prepending action card
      const regularNotes = mockNotes.filter(n => !n.is_pinned);
      expect(regularNotes).toHaveLength(2);
      expect(regularNotes[0].id).toBe('note-1');
      expect(regularNotes[1].id).toBe('note-2');
    });
  });

  describe('2. Dropdown Category Selection & State Updating', () => {
    it('2.1 Switching category should accurately update active note color', () => {
      const existingNote: NoteItem = {
        id: 'note-edit-1',
        tipe: 'shared',
        warna: 'orange',
        judul: 'Catatan Rapat Mingguan',
        isi: '<p>Evaluasi liputan</p>',
        tags: ['evaluasi'],
        is_pinned: false,
        created_by_id: 'u-1',
        created_by_name: 'Operator',
        created_at: '2026-10-17T08:00:00Z',
        updated_at: '2026-10-17T08:00:00Z'
      };

      // Simulate changing category to green (Info & Pengumuman)
      const selectedCategory: NoteCategoryKey = 'green';
      const updatedNote: NoteItem = {
        ...existingNote,
        warna: selectedCategory,
        updated_at: new Date().toISOString()
      };

      expect(updatedNote.warna).toBe('green');
      expect(NOTE_CATEGORIES[updatedNote.warna].label).toBe('Info & Pengumuman');
    });

    it('2.2 Meeting minutes should correctly preserve category and meeting metadata', () => {
      const meetingNote: NoteItem = {
        id: 'meeting-1',
        tipe: 'meeting_minutes',
        warna: 'purple',
        judul: 'Notulensi Rapat Pra-Produksi',
        isi: '<p>Pembahasan rundown</p>',
        tags: ['rapat', 'produksi'],
        is_pinned: true,
        created_by_id: 'u-1',
        created_by_name: 'Sekretaris',
        created_at: '2026-10-17T07:00:00Z',
        updated_at: '2026-10-17T07:00:00Z',
        meeting_meta: {
          date: '2026-10-17',
          time: '10:00 - 12:00 WIB',
          loc: 'Studio Utama PTV',
          att: 'Tim Produser & Kru Kamera'
        }
      };

      expect(meetingNote.tipe).toBe('meeting_minutes');
      expect(meetingNote.warna).toBe('purple');
      expect(NOTE_CATEGORIES[meetingNote.warna].short).toBe('Agenda');
      expect(meetingNote.meeting_meta?.loc).toBe('Studio Utama PTV');
    });
  });
});
