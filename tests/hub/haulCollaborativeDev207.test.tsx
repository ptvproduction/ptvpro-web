import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HaulWorkspace } from '../../src/products/hub/haul-workspace/HaulWorkspace';
import { MockWorkspaceRepository } from '../../src/products/hub/haul-workspace/repository';
import { seedWorkspace, demoPeople, getPpbsTemplateItems } from '../../src/products/hub/haul-workspace/fixtures';
import type { Actor, WorkItem } from '../../src/products/hub/haul-workspace/types';

describe('PTV-DEV-207: Haul Workspace Simplification & Collaborative Editing', () => {
  const coordinatorActor: Actor = { id: 'coord-1', personId: 'p-1', role: 'coordinator' };
  const crewActor: Actor = { id: 'crew-1', personId: 'p-4', role: 'crew' }; // Regular crew member

  describe('1. Collaborative Editing Permissions for Crew', () => {
    it('1.1 should allow regular crew member to update task status directly', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const state = repo.snapshot();
      const task = state.items.find(i => i.kind === 'task' && !i.archived)!;

      expect(task).toBeDefined();
      const updated = { ...task, status: 'Dikerjakan' as const };
      
      // Crew updating status must succeed without error
      expect(() => {
        repo.save(updated, crewActor);
      }).not.toThrow();

      const after = repo.snapshot().items.find(i => i.id === task.id)!;
      expect(after.status).toBe('Dikerjakan');
    });

    it('1.2 should allow crew to fill and update Lokasi File (Google Drive URL or folder path)', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const state = repo.snapshot();
      const task = state.items.find(i => i.kind === 'task' && !i.archived)!;

      // Test with Google Drive URL
      const driveUrl = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP';
      const updatedWithDrive = { ...task, resultUrl: driveUrl };
      expect(() => {
        repo.save(updatedWithDrive, crewActor);
      }).not.toThrow();
      expect(repo.snapshot().items.find(i => i.id === task.id)?.resultUrl).toBe(driveUrl);

      // Test with network / folder path description
      const folderPath = '//storage/ptv/Haul2027/Desain/Poster_Final.ai';
      const current = repo.snapshot().items.find(i => i.id === task.id)!;
      const updatedWithPath = { ...current, resultUrl: folderPath };
      expect(() => {
        repo.save(updatedWithPath, crewActor);
      }).not.toThrow();
      expect(repo.snapshot().items.find(i => i.id === task.id)?.resultUrl).toBe(folderPath);
    });

    it('1.3 should allow crew to update keterangan (brief) and notes (references)', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const state = repo.snapshot();
      const task = state.items.find(i => i.kind === 'task' && !i.archived)!;

      const updated = {
        ...task,
        brief: 'Revisi warna background sesuai masukan panitia.',
        references: 'Catatan tim: font menggunakan Montserrat dan Trajan.',
      };

      expect(() => {
        repo.save(updated, crewActor);
      }).not.toThrow();

      const after = repo.snapshot().items.find(i => i.id === task.id)!;
      expect(after.brief).toBe('Revisi warna background sesuai masukan panitia.');
      expect(after.references).toBe('Catatan tim: font menggunakan Montserrat dan Trajan.');
    });

    it('1.4 should prevent regular crew from creating new tasks or archiving items', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const state = repo.snapshot();
      const task = state.items.find(i => i.kind === 'task' && !i.archived)!;

      // Crew attempting to archive
      expect(() => {
        repo.save({ ...task, archived: true }, crewActor);
      }).toThrow(/Kru hanya boleh/i);

      // Crew attempting to create new item
      const newItem: WorkItem = {
        ...task,
        id: crypto.randomUUID(),
        title: 'Task Baru Ilegal',
        revision: 0,
      };
      expect(() => {
        repo.save(newItem, crewActor);
      }).toThrow(/Hanya koordinator/i);
    });

    it('1.5 should allow coordinator to create new tasks and manage structure', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const state = repo.snapshot();
      const task = state.items.find(i => i.kind === 'task' && !i.archived)!;

      const newItem: WorkItem = {
        ...task,
        id: crypto.randomUUID(),
        title: 'Task Sah Dibuat Koordinator',
        revision: 0,
      };

      expect(() => {
        repo.save(newItem, coordinatorActor);
      }).not.toThrow();

      expect(repo.snapshot().items.some(i => i.title === 'Task Sah Dibuat Koordinator')).toBe(true);
    });
  });

  describe('2. UI Simplification & Visual Direction Rendering', () => {
    it('2.1 should render Quick Summary Orientation Bar with metrics and progress tracking', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const html = renderToString(
        <HaulWorkspace repository={repo} people={demoPeople} actor={coordinatorActor} />
      );

      expect(html).toContain('hh-summary-bar');
      expect(html).toContain('hh-summary-card');
      expect(html).toContain('Progres Total');
      expect(html).toContain('Sedang Dikerjakan Kru');
      expect(html).toContain('Menunggu Review Koordinator');
    });

    it('2.2 should render vibrant event cards with color themes and direct action button', () => {
      const seed = seedWorkspace();
      const templateItems = getPpbsTemplateItems(seed.edition.id);
      seed.items = seed.items.concat(templateItems);
      const repo = new MockWorkspaceRepository(seed, demoPeople);
      const html = renderToString(
        <HaulWorkspace repository={repo} people={demoPeople} actor={coordinatorActor} />
      );

      expect(html).toContain('theme-emerald');
      expect(html).toContain('theme-amber');
      expect(html).toContain('theme-indigo');
      expect(html).toContain('Buka Ruang Kerja Acara →');
      expect(html).toContain('hh-card-prog-wrap');
    });

    it('2.3 should render Lokasi File and StatusPicker in collaborative table', () => {
      const repo = new MockWorkspaceRepository(seedWorkspace(), demoPeople);
      const html = renderToString(
        <HaulWorkspace repository={repo} people={demoPeople} actor={coordinatorActor} />
      );

      expect(html).toContain('Lokasi File');
      expect(html).toContain('hh-status-picker-wrap');
      expect(html).toContain('hh-status-btn');
    });
  });
});
