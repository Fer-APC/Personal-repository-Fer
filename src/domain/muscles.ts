import type { Muscle } from './types';

export const ALL_MUSCLES: Muscle[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'rotator_cuff',
  'lats', 'upper_back', 'traps', 'lower_back',
  'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'adductors', 'calves',
  'abs', 'obliques', 'hip_flexors',
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  rotator_cuff: 'Rotator cuff',
  lats: 'Lats',
  upper_back: 'Upper back',
  traps: 'Traps',
  lower_back: 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
  abs: 'Abs',
  obliques: 'Obliques',
  hip_flexors: 'Hip flexors',
};

export type Region = 'push' | 'pull' | 'legs' | 'core';

export const MUSCLE_REGION: Record<Muscle, Region> = {
  chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push',
  rear_delts: 'pull', rotator_cuff: 'pull', lats: 'pull', upper_back: 'pull',
  traps: 'pull', biceps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', adductors: 'legs', calves: 'legs',
  abs: 'core', obliques: 'core', lower_back: 'core', hip_flexors: 'core',
};

export const UPPER: Muscle[] = ALL_MUSCLES.filter(
  (m) => MUSCLE_REGION[m] === 'push' || MUSCLE_REGION[m] === 'pull',
);
export const LOWER: Muscle[] = ALL_MUSCLES.filter((m) => MUSCLE_REGION[m] === 'legs');

/**
 * Hours a muscle wants before it is loaded hard again. Small muscles recover
 * fast; hips and spinal erectors do not.
 */
export const RECOVERY_HOURS: Record<Muscle, number> = {
  chest: 48, front_delts: 40, side_delts: 32, rear_delts: 24, rotator_cuff: 24,
  lats: 48, upper_back: 40, traps: 32, lower_back: 60,
  biceps: 36, triceps: 36, forearms: 24,
  quads: 56, hamstrings: 60, glutes: 48, adductors: 48, calves: 36,
  abs: 32, obliques: 32, hip_flexors: 36,
};
