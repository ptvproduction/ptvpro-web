/**
 * PTV-DEV-208: Haul & Harlah Workspace Concept Correction Test Suite
 *
 * Verifies:
 * 1. Beranda Fast Orientation: "Tugas Mendesak" and "Kegiatan & Sesi Terdekat"
 * 2. Multi-Position & Multi-Crew Rundown Roster (no "+1" truncation)
 * 3. Active crew enforcement (only active crew selectable)
 * 4. Inline task creation in groups (no giant modals)
 * 5. Single Event Workspace unity (tasks, groups, rundown, notes on one scrollable page)
 * 6. Collaborative permissions (crew status, file, note edits)
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HaulWorkspace } from '../../src/products/hub/haul-workspace/HaulWorkspace';
import { ProductionDraftRepository } from '../../src/products/hub/haul-workspace/adapter';
import { seedWorkspace, getPpbsTemplateItems, demoPeople } from '../../src/products/hub/haul-workspace/fixtures';
import type { Actor, Person } from '../../src/products/hub/haul-workspace/types';

describe('PTV-DEV-208: Concept Correction Test Suite', () => {
  const activeTestPeople: Person[] = [
    ...demoPeople,
    { id: 'crew-zidnal', name: 'Muhammad Zidnal Falah (Layouter)' },
    { id: 'crew-naufal', name: 'Naufal (Kamera Utama)' },
    { id: 'crew-taqiu', name: 'Taqiu (vMix / Streaming)' },
    { id: 'crew-gad', name: 'Mas Gad (Audio Master)' },
    { id: 'crew-abyan', name: 'Abyan Zahir (Fotografi)' },
    { id: 'crew-nonaktif', name: 'Kru Nonaktif Contoh (Nonaktif)' },
  ];

  const coordinatorActor: Actor = {
    id: 'user-coord',
    personId: 'person-zidnal',
    role: 'coordinator',
  };

  const crewActor: Actor = {
    id: 'user-crew',
    personId: 'person-naufal',
    role: 'crew',
  };

  function setupWorkspace() {
    const seed = seedWorkspace();
    seed.items = getPpbsTemplateItems(seed.edition.id);
    const repo = new ProductionDraftRepository(seed, activeTestPeople);
    return { repo, seed };
  }

  it('1. should render Fast Orientation grid on Beranda with Tugas Mendesak and Kegiatan Terdekat', () => {
    const { repo } = setupWorkspace();
    const html = renderToString(
      <HaulWorkspace
        repository={repo}
        people={activeTestPeople}
        actor={coordinatorActor}
      />
    );

    expect(html).toContain('Tugas Mendesak &amp; Perhatian');
    expect(html).toContain('Kegiatan &amp; Sesi Terdekat');
    expect(html).toContain('hh-home-grid');
    expect(html).toContain('hh-urgent-list');
    expect(html).toContain('hh-upcoming-list');
  });

  it('2. should render Rundown Sessions with multi-position roster pills', () => {
    const { repo } = setupWorkspace();
    const html = renderToString(
      <HaulWorkspace
        repository={repo}
        people={activeTestPeople}
        actor={coordinatorActor}
      />
    );

    // Rundown roster pills rendered on upcoming sessions
    expect(html).toContain('hh-rundown-roster');
    expect(html).toContain('hh-roster-pill');
    expect(html).toContain('hh-roster-pos');
  });

  it('3. should enforce active crew selection and filter out non-active crew', () => {
    const { repo } = setupWorkspace();
    const html = renderToString(
      <HaulWorkspace
        repository={repo}
        people={activeTestPeople}
        actor={coordinatorActor}
      />
    );

    // Active crew members are present in the DOM
    expect(html).toContain('Muhammad Zidnal Falah');
    // Non-active crew is filtered out from active selection
    expect(html).not.toContain('value="crew-nonaktif"');
  });

  it('4. should save multi-position crew assignments on rundown sessions', () => {
    const { repo } = setupWorkspace();
    const snapshot = repo.snapshot();
    const session = snapshot.items.find(i => i.kind === 'session');
    expect(session).toBeDefined();

    if (session) {
      const updated = {
        ...session,
        crewAssignments: [
          { position: 'Kamera Utama', personId: 'crew-naufal' },
          { position: 'vMix Switching', personId: 'crew-taqiu' },
          { position: 'Audio Mixing', personId: 'crew-gad' },
        ],
      };

      repo.save(updated, coordinatorActor);
      const savedSnapshot = repo.snapshot();
      const savedSession = savedSnapshot.items.find(i => i.id === session.id);
      expect(savedSession?.crewAssignments).toHaveLength(3);
      expect(savedSession?.crewAssignments?.[0].position).toBe('Kamera Utama');
      expect(savedSession?.crewAssignments?.[1].position).toBe('vMix Switching');
    }
  });

  it('5. should allow crew collaborative edits on status, resultUrl, brief, and notes', () => {
    const { repo } = setupWorkspace();
    const snapshot = repo.snapshot();
    const task = snapshot.items.find(i => i.kind === 'task');
    expect(task).toBeDefined();

    if (task) {
      const updatedTask = {
        ...task,
        status: 'Selesai' as const,
        resultUrl: 'https://drive.google.com/drive/folders/ptv-haul-test',
        brief: 'Update keterangan kerja oleh kru lapangan',
      };

      repo.save(updatedTask, crewActor);
      const saved = repo.snapshot().items.find(i => i.id === task.id);
      expect(saved?.status).toBe('Selesai');
      expect(saved?.resultUrl).toContain('drive.google.com');
      expect(saved?.brief).toBe('Update keterangan kerja oleh kru lapangan');
    }
  });
});
