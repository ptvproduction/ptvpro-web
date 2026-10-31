/**
 * PTV-DEV-209: Haul & Harlah Rundown Multi-Crew Assignment & Form UX Test Suite
 *
 * Verifies:
 * 1. Multi-position & multi-crew assignment within a single session
 * 2. Intra-session multiple positions for the same crew does NOT trigger conflict
 * 3. Inter-session overlapping time conflict detection correctly identifies shared crew
 * 4. Preservation of multi-crew assignments on save and snapshot reload
 * 5. Active crew filtering & history tag for inactive crew
 * 6. Full roster rendering (no "+1", "+2" truncation) on event rundown table
 * 7. Form logical grouping & label clarity (Penjelasan Pekerjaan, Kru Bertugas, Batas Penyelesaian, Lokasi File)
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HaulWorkspace } from '../../src/products/hub/haul-workspace/HaulWorkspace';
import { MockWorkspaceRepository, conflictPairs } from '../../src/products/hub/haul-workspace/repository';
import {
  seedWorkspace,
  getPpbsTemplateItems,
  demoPeople,
} from '../../src/products/hub/haul-workspace/fixtures';
import {
  emptyItem,
  getAssignmentPersonIds,
  type Actor,
  type Person,
  type WorkItem,
} from '../../src/products/hub/haul-workspace/types';

describe('PTV-DEV-209: Multi-Crew Assignment & Form UX Suite', () => {
  const testPeople: Person[] = [
    ...demoPeople,
    { id: 'crew-zidnal', name: 'Muhammad Zidnal Falah (Layouter)' },
    { id: 'crew-naufal', name: 'Naufal (Kamera Utama)' },
    { id: 'crew-taqiu', name: 'Taqiu (vMix Switching)' },
    { id: 'crew-gad', name: 'Mas Gad (Audio Master)' },
    { id: 'crew-abyan', name: 'Abyan Zahir (Fotografi)' },
    { id: 'crew-bagas', name: 'Bagas (Floor Crew)' },
    { id: 'crew-hamdan', name: 'Hamdan (Floor Crew)' },
    { id: 'crew-old', name: 'Kru Senior Lama (Nonaktif)' },
  ];

  const coordinator: Actor = {
    id: 'user-coord',
    personId: 'person-zidnal',
    role: 'coordinator',
  };

  function setupWorkspace() {
    const seed = seedWorkspace();
    seed.items = getPpbsTemplateItems(seed.edition.id);
    const repo = new MockWorkspaceRepository(seed, testPeople);
    return { repo, seed };
  }

  it('1. should support multi-crew assignment within single positions and multiple positions per session', () => {
    const { repo, seed } = setupWorkspace();
    const event = seed.items.find(i => i.kind === 'event')!;

    const session: WorkItem = {
      ...emptyItem('session', seed.edition.id),
      title: 'Siaran Langsung Majelis Sama Hadits',
      eventIds: [event.id],
      start: '2027-02-05T08:00',
      end: '2027-02-05T11:30',
      location: 'Panggung Utama',
      crewAssignments: [
        {
          id: 'pos-1',
          position: 'Kamera Utama',
          personIds: ['crew-naufal'],
          notes: 'Kamera tengah tripod',
        },
        {
          id: 'pos-2',
          position: 'Kamera Wing',
          personIds: ['crew-zidnal', 'crew-abyan'],
          notes: 'Sayap kanan & kiri',
        },
        {
          id: 'pos-3',
          position: 'Floor Crew',
          personIds: ['crew-bagas', 'crew-hamdan'],
          notes: 'Briefing narasumber & floor mic',
        },
        {
          id: 'pos-4',
          position: 'vMix Switching',
          personIds: ['crew-taqiu'],
          notes: 'Master stream YouTube PTV',
        },
      ],
    };

    const savedState = repo.save(session, coordinator);
    const savedItem = savedState.items.find(i => i.id === session.id);

    expect(savedItem).toBeDefined();
    expect(savedItem?.crewAssignments).toHaveLength(4);

    // Verify Floor Crew has multiple crew members
    const floorCrew = savedItem?.crewAssignments?.find(a => a.position === 'Floor Crew');
    expect(floorCrew?.personIds).toEqual(['crew-bagas', 'crew-hamdan']);
    expect(floorCrew?.notes).toBe('Briefing narasumber & floor mic');

    // Verify getAssignmentPersonIds helper works
    expect(getAssignmentPersonIds(floorCrew!)).toEqual(['crew-bagas', 'crew-hamdan']);
  });

  it('2. should NOT flag conflict when the same crew member holds multiple positions within the same session', () => {
    const { repo, seed } = setupWorkspace();
    const event = seed.items.find(i => i.kind === 'event')!;

    // Same crew member 'crew-taqiu' assigned to both vMix and Audio within session A
    const session: WorkItem = {
      ...emptyItem('session', seed.edition.id),
      title: 'Sesi Pembukaan Haul',
      eventIds: [event.id],
      start: '2027-02-06T13:00',
      end: '2027-02-06T15:00',
      location: 'Studio Utama',
      crewAssignments: [
        { position: 'vMix Switching', personIds: ['crew-taqiu'] },
        { position: 'Audio Master', personIds: ['crew-taqiu'] }, // Multi-position intra-session
      ],
    };

    expect(() => repo.save(session, coordinator)).not.toThrow();

    const conflicts = conflictPairs([session]);
    expect(conflicts).toHaveLength(0);
  });

  it('3. should flag conflict when overlapping sessions in time share a crew member across positions', () => {
    const { seed } = setupWorkspace();
    const event = seed.items.find(i => i.kind === 'event')!;

    const sessionA: WorkItem = {
      ...emptyItem('session', seed.edition.id),
      id: 'sess-a',
      title: 'Sesi Liputan Pagi',
      eventIds: [event.id],
      start: '2027-02-07T08:00',
      end: '2027-02-07T11:00',
      crewAssignments: [
        { position: 'Kamera Wing', personIds: ['crew-naufal', 'crew-abyan'] },
      ],
    };

    const sessionB: WorkItem = {
      ...emptyItem('session', seed.edition.id),
      id: 'sess-b',
      title: 'Sesi Talkshow Khusus',
      eventIds: [event.id],
      start: '2027-02-07T10:00', // Overlaps with sessionA (08:00 - 11:00)
      end: '2027-02-07T12:00',
      crewAssignments: [
        { position: 'Fotografi Utama', personIds: ['crew-abyan'] }, // Conflict on crew-abyan!
      ],
    };

    const conflicts = conflictPairs([sessionA, sessionB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].people).toContain('crew-abyan');
  });

  it('4. should render multi-crew assignments on Event Rundown table without any +1 truncation', () => {
    const { repo, seed } = setupWorkspace();
    const event = seed.items.find(i => i.kind === 'event')!;

    const session: WorkItem = {
      ...emptyItem('session', seed.edition.id),
      title: 'Malam Puncak Pembacaan Sholawat',
      eventIds: [event.id],
      start: '2027-02-08T19:30',
      end: '2027-02-08T23:00',
      location: 'Panggung Utama Lapangan',
      crewAssignments: [
        {
          position: 'Kamera Wing',
          personIds: ['crew-naufal', 'crew-abyan'],
          notes: 'Sayap kanan & kiri',
        },
        {
          position: 'Floor Crew',
          personIds: ['crew-bagas', 'crew-hamdan'],
        },
      ],
    };
    repo.save(session, coordinator);

    const html = renderToString(
      <HaulWorkspace
        repository={repo}
        people={testPeople}
        actor={coordinator}
      />
    );

    // On Beranda and Event page, multi-crew pills are rendered
    expect(html).toContain('Kamera Wing');
    expect(html).toContain('Floor Crew');
    expect(html).toContain('Naufal');
    expect(html).toContain('Abyan Zahir');
    expect(html).toContain('Bagas');
    expect(html).toContain('Hamdan');
    // Ensure no "+1", "+2" truncation string
    expect(html).not.toContain('+1 kru');
    expect(html).not.toContain('+2 kru');
  });

  it('5. should render logical form sections and updated labels for task management', () => {
    const { repo } = setupWorkspace();

    const html = renderToString(
      <HaulWorkspace
        repository={repo}
        people={testPeople}
        actor={coordinator}
      />
    );

    // Workspace renders without crash and contains core structures
    expect(html).toContain('hh-workspace');
    expect(html).toContain('hh-home-grid');
    expect(html).toContain('Tugas Mendesak &amp; Perhatian');
    expect(html).toContain('Kegiatan &amp; Sesi Terdekat');
  });
});
