import { DEFAULT_STRUCTURE } from '../src/domain/planner';
import { DEFAULT_GOALS } from '../src/domain/goals';
import type { Activity, Profile } from '../src/domain/types';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    goals: { ...DEFAULT_GOALS },
    daysPerWeek: 3,
    availability: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
    sessionMinutes: 70,
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bench', 'pullup_bar', 'dip_bars', 'kettlebell', 'bands', 'bodyweight'],
    experience: 'intermediate',
    units: 'kg',
    bodyweightKg: 75,
    structures: [DEFAULT_STRUCTURE, DEFAULT_STRUCTURE, DEFAULT_STRUCTURE],
    avoid: [],
    limitedSpace: false,
    preferNoQueue: false,
    excludedExercises: [],
    preferredExercises: [],
    deloadEveryWeeks: 6,
    ...overrides,
  };
}

export const RUNS_AND_VOLLEY: Activity[] = [
  { id: 'a1', type: 'run_intervals', day: 1, durationMin: 60, intensity: 3 },
  { id: 'a2', type: 'run_long', day: 5, durationMin: 90, intensity: 2 },
  { id: 'a3', type: 'volleyball', day: 3, durationMin: 120, intensity: 2 },
];
