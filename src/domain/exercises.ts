import type { Equipment, Exercise, Goal, LoadType, Muscle, Pattern } from './types';

/** goalFit shorthand: hypertrophy, strength, calisthenics, endurance, longevity. */
const g = (
  hypertrophy: number, strength: number, calisthenics: number, endurance: number, longevity: number,
): Partial<Record<Goal, number>> => ({ hypertrophy, strength, calisthenics, endurance, longevity });

interface Def {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary?: Muscle[];
  equipment: Equipment[];
  compound?: boolean;
  unilateral?: boolean;
  systemicCost?: number;
  kneeStress?: number;
  shoulderStress?: number;
  goalFit: Partial<Record<Goal, number>>;
  skill?: 1 | 2 | 3;
  needsSpace?: boolean;
  loadType?: LoadType;
  progression?: string;
  progressionStep?: number;
  notes?: string;
}

const NEVER_COMPOUND: Pattern[] = ['isolation', 'core', 'skill'];

function E(d: Def): Exercise {
  const compound =
    d.compound ?? (!NEVER_COMPOUND.includes(d.pattern) && d.primary.length + (d.secondary?.length ?? 0) > 2);
  return {
    id: d.id,
    name: d.name,
    pattern: d.pattern,
    primary: d.primary,
    secondary: d.secondary ?? [],
    equipment: d.equipment,
    compound,
    unilateral: d.unilateral ?? false,
    systemicCost: d.systemicCost ?? (compound ? 1.5 : 0.6),
    kneeStress: d.kneeStress ?? 0,
    shoulderStress: d.shoulderStress ?? 0,
    goalFit: d.goalFit,
    skill: d.skill ?? 1,
    ...(d.needsSpace ? { needsSpace: true } : {}),
    loadType: d.loadType ?? 'external',
    ...(d.progression ? { progression: d.progression, progressionStep: d.progressionStep ?? 1 } : {}),
    ...(d.notes ? { notes: d.notes } : {}),
  };
}

export const EXERCISES: Exercise[] = [
  // ---------------------------------------------------------------- horizontal push
  E({ id: 'bb_bench', name: 'Barbell bench press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['barbell', 'bench'], compound: true, systemicCost: 2, shoulderStress: 1, goalFit: g(0.85, 0.95, 0.2, 0.35, 0.5), skill: 2 }),
  E({ id: 'bb_incline_bench', name: 'Incline barbell press', pattern: 'horizontal_push', primary: ['chest', 'front_delts'], secondary: ['triceps'], equipment: ['barbell', 'bench'], compound: true, systemicCost: 1.9, shoulderStress: 1.2, goalFit: g(0.85, 0.85, 0.2, 0.35, 0.5), skill: 2 }),
  E({ id: 'db_bench', name: 'Dumbbell bench press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['dumbbell', 'bench'], compound: true, systemicCost: 1.6, shoulderStress: 0.8, goalFit: g(0.9, 0.7, 0.25, 0.5, 0.7) }),
  E({ id: 'db_incline_bench', name: 'Incline dumbbell press', pattern: 'horizontal_push', primary: ['chest', 'front_delts'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], compound: true, systemicCost: 1.5, shoulderStress: 1, goalFit: g(0.9, 0.65, 0.25, 0.5, 0.7) }),
  E({ id: 'machine_chest_press', name: 'Machine chest press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['machine'], compound: true, systemicCost: 1, shoulderStress: 0.5, goalFit: g(0.8, 0.5, 0.15, 0.7, 0.8) }),
  E({ id: 'cable_press', name: 'Standing cable chest press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'abs'], equipment: ['cable'], compound: true, systemicCost: 1, shoulderStress: 0.4, goalFit: g(0.7, 0.45, 0.3, 0.7, 0.85) }),
  E({ id: 'cg_bench', name: 'Close-grip bench press', pattern: 'horizontal_push', primary: ['triceps', 'chest'], secondary: ['front_delts'], equipment: ['barbell', 'bench'], compound: true, systemicCost: 1.8, shoulderStress: 0.7, goalFit: g(0.8, 0.85, 0.4, 0.4, 0.5), skill: 2 }),
  E({ id: 'pushup', name: 'Push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs'], equipment: ['bodyweight'], compound: true, systemicCost: 1, shoulderStress: 0.4, loadType: 'bodyweight', goalFit: g(0.5, 0.3, 0.9, 0.85, 0.85), progression: 'pushup', progressionStep: 2 }),
  E({ id: 'incline_pushup', name: 'Incline push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['bodyweight', 'bench'], compound: true, systemicCost: 0.7, loadType: 'bodyweight', goalFit: g(0.35, 0.2, 0.7, 0.85, 0.85), progression: 'pushup', progressionStep: 1 }),
  E({ id: 'diamond_pushup', name: 'Diamond push-up', pattern: 'horizontal_push', primary: ['triceps', 'chest'], secondary: ['front_delts', 'abs'], equipment: ['bodyweight'], compound: true, systemicCost: 1.1, loadType: 'bodyweight', goalFit: g(0.55, 0.35, 0.9, 0.8, 0.7), progression: 'pushup', progressionStep: 3 }),
  E({ id: 'archer_pushup', name: 'Archer push-up', pattern: 'horizontal_push', primary: ['chest', 'triceps'], secondary: ['abs', 'front_delts'], equipment: ['bodyweight'], compound: true, unilateral: true, systemicCost: 1.4, shoulderStress: 0.8, loadType: 'bodyweight', skill: 2, goalFit: g(0.6, 0.5, 0.95, 0.6, 0.5), progression: 'pushup', progressionStep: 4 }),
  E({ id: 'oa_pushup_negative', name: 'One-arm push-up (assisted / negative)', pattern: 'horizontal_push', primary: ['chest', 'triceps'], secondary: ['abs', 'obliques', 'front_delts'], equipment: ['bodyweight'], compound: true, unilateral: true, systemicCost: 1.7, shoulderStress: 1, loadType: 'bodyweight', skill: 3, goalFit: g(0.5, 0.6, 1, 0.4, 0.35), progression: 'pushup', progressionStep: 5 }),
  E({ id: 'ring_pushup', name: 'Ring push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs', 'rotator_cuff'], equipment: ['rings'], compound: true, systemicCost: 1.3, shoulderStress: 0.7, loadType: 'bodyweight', skill: 2, goalFit: g(0.6, 0.35, 0.95, 0.7, 0.8) }),
  E({ id: 'weighted_pushup', name: 'Weighted push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs'], equipment: ['bodyweight'], compound: true, systemicCost: 1.3, loadType: 'bodyweight', goalFit: g(0.7, 0.55, 0.85, 0.6, 0.6) }),

  // ---------------------------------------------------------------- vertical push
  E({ id: 'bb_ohp', name: 'Standing overhead press', pattern: 'vertical_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts', 'abs', 'upper_back'], equipment: ['barbell'], compound: true, systemicCost: 2, shoulderStress: 1.8, goalFit: g(0.75, 0.9, 0.45, 0.35, 0.55), skill: 2 }),
  E({ id: 'db_shoulder_press', name: 'Seated dumbbell shoulder press', pattern: 'vertical_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: ['dumbbell', 'bench'], compound: true, systemicCost: 1.4, shoulderStress: 1.5, goalFit: g(0.85, 0.6, 0.35, 0.5, 0.6) }),
  E({ id: 'machine_shoulder_press', name: 'Machine shoulder press', pattern: 'vertical_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: ['machine'], compound: true, systemicCost: 1, shoulderStress: 1.2, goalFit: g(0.75, 0.5, 0.2, 0.65, 0.7) }),
  E({ id: 'landmine_press', name: 'Half-kneeling landmine press', pattern: 'vertical_push', primary: ['front_delts'], secondary: ['triceps', 'abs', 'upper_back'], equipment: ['barbell'], compound: true, unilateral: true, systemicCost: 1.2, shoulderStress: 0.6, goalFit: g(0.6, 0.6, 0.4, 0.55, 0.95), notes: 'Shoulder-friendly pressing angle — good when the volley load is high.' }),
  E({ id: 'arnold_press', name: 'Arnold press', pattern: 'vertical_push', primary: ['front_delts', 'side_delts'], secondary: ['triceps'], equipment: ['dumbbell'], compound: true, systemicCost: 1.3, shoulderStress: 1.4, goalFit: g(0.8, 0.45, 0.3, 0.55, 0.5) }),
  E({ id: 'dip', name: 'Parallel bar dip', pattern: 'vertical_push', primary: ['chest', 'triceps'], secondary: ['front_delts'], equipment: ['dip_bars'], compound: true, systemicCost: 1.5, shoulderStress: 1.3, loadType: 'bodyweight', skill: 2, goalFit: g(0.8, 0.6, 0.95, 0.6, 0.5), progression: 'dip', progressionStep: 3 }),
  E({ id: 'assisted_dip', name: 'Assisted dip', pattern: 'vertical_push', primary: ['chest', 'triceps'], secondary: ['front_delts'], equipment: ['machine', 'dip_bars'], compound: true, systemicCost: 1.1, shoulderStress: 1, loadType: 'assisted', goalFit: g(0.65, 0.4, 0.75, 0.65, 0.55), progression: 'dip', progressionStep: 2 }),
  E({ id: 'bench_dip', name: 'Bench dip', pattern: 'vertical_push', primary: ['triceps'], secondary: ['chest', 'front_delts'], equipment: ['bench'], systemicCost: 0.8, shoulderStress: 1.1, loadType: 'bodyweight', goalFit: g(0.5, 0.3, 0.6, 0.8, 0.45), progression: 'dip', progressionStep: 1 }),
  E({ id: 'weighted_dip', name: 'Weighted dip', pattern: 'vertical_push', primary: ['chest', 'triceps'], secondary: ['front_delts'], equipment: ['dip_bars'], compound: true, systemicCost: 1.9, shoulderStress: 1.5, loadType: 'bodyweight', skill: 2, goalFit: g(0.9, 0.85, 0.95, 0.35, 0.35), progression: 'dip', progressionStep: 4 }),
  E({ id: 'ring_dip', name: 'Ring dip', pattern: 'vertical_push', primary: ['chest', 'triceps'], secondary: ['front_delts', 'rotator_cuff', 'abs'], equipment: ['rings'], compound: true, systemicCost: 1.8, shoulderStress: 1.6, loadType: 'bodyweight', skill: 3, goalFit: g(0.75, 0.6, 1, 0.4, 0.4), progression: 'dip', progressionStep: 5 }),
  E({ id: 'pike_pushup', name: 'Pike push-up', pattern: 'vertical_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts', 'abs'], equipment: ['bodyweight'], compound: true, systemicCost: 1.2, shoulderStress: 1.4, loadType: 'bodyweight', skill: 2, goalFit: g(0.55, 0.4, 0.95, 0.6, 0.45), progression: 'handstand', progressionStep: 2 }),
  E({ id: 'wall_hspu', name: 'Wall handstand push-up', pattern: 'vertical_push', primary: ['front_delts', 'triceps'], secondary: ['side_delts', 'upper_back', 'abs'], equipment: ['bodyweight'], compound: true, systemicCost: 2, shoulderStress: 2, loadType: 'bodyweight', skill: 3, goalFit: g(0.6, 0.7, 1, 0.3, 0.3), progression: 'handstand', progressionStep: 4 }),

  // ---------------------------------------------------------------- horizontal pull
  E({ id: 'bb_row', name: 'Barbell row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'lower_back'], equipment: ['barbell'], compound: true, systemicCost: 2, goalFit: g(0.85, 0.9, 0.35, 0.4, 0.55), skill: 2 }),
  E({ id: 'pendlay_row', name: 'Pendlay row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'lower_back'], equipment: ['barbell'], compound: true, systemicCost: 2.1, goalFit: g(0.75, 0.95, 0.35, 0.3, 0.45), skill: 3 }),
  E({ id: 'db_row', name: 'One-arm dumbbell row', pattern: 'horizontal_pull', primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts', 'obliques'], equipment: ['dumbbell', 'bench'], compound: true, unilateral: true, systemicCost: 1.2, goalFit: g(0.9, 0.65, 0.35, 0.6, 0.85) }),
  E({ id: 'chest_supported_row', name: 'Chest-supported row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], equipment: ['dumbbell', 'bench'], compound: true, systemicCost: 1, goalFit: g(0.9, 0.6, 0.3, 0.65, 0.95), notes: 'No lower-back cost — ideal in a week with heavy running.' }),
  E({ id: 'seal_row', name: 'Seal row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], equipment: ['barbell', 'bench'], compound: true, systemicCost: 1, goalFit: g(0.9, 0.65, 0.3, 0.6, 0.9) }),
  E({ id: 'cable_row', name: 'Seated cable row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['cable'], compound: true, systemicCost: 1.1, goalFit: g(0.85, 0.6, 0.3, 0.75, 0.9) }),
  E({ id: 'machine_row', name: 'Machine row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['machine'], compound: true, systemicCost: 0.9, goalFit: g(0.8, 0.55, 0.2, 0.75, 0.9) }),
  E({ id: 't_bar_row', name: 'T-bar row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'lower_back'], equipment: ['barbell'], compound: true, systemicCost: 1.8, goalFit: g(0.85, 0.8, 0.3, 0.45, 0.5) }),
  E({ id: 'inverted_row', name: 'Inverted row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'abs'], equipment: ['barbell', 'bodyweight'], compound: true, systemicCost: 1, loadType: 'bodyweight', goalFit: g(0.6, 0.4, 0.9, 0.85, 0.9) }),
  E({ id: 'ring_row', name: 'Ring row', pattern: 'horizontal_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'abs', 'rotator_cuff'], equipment: ['rings'], compound: true, systemicCost: 1, loadType: 'bodyweight', goalFit: g(0.6, 0.4, 0.95, 0.85, 0.95) }),

  // ---------------------------------------------------------------- vertical pull
  E({ id: 'pullup', name: 'Pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back', 'forearms', 'abs'], equipment: ['pullup_bar'], compound: true, systemicCost: 1.5, loadType: 'bodyweight', skill: 2, goalFit: g(0.8, 0.7, 1, 0.6, 0.7), progression: 'pullup', progressionStep: 3 }),
  E({ id: 'chinup', name: 'Chin-up', pattern: 'vertical_pull', primary: ['lats', 'biceps'], secondary: ['upper_back', 'forearms'], equipment: ['pullup_bar'], compound: true, systemicCost: 1.5, loadType: 'bodyweight', skill: 2, goalFit: g(0.85, 0.7, 0.95, 0.6, 0.7), progression: 'pullup', progressionStep: 3 }),
  E({ id: 'scap_pullup', name: 'Scapular pull-up', pattern: 'vertical_pull', primary: ['upper_back', 'lats'], secondary: ['traps', 'forearms'], equipment: ['pullup_bar'], systemicCost: 0.5, loadType: 'bodyweight', goalFit: g(0.3, 0.25, 0.8, 0.6, 0.95), progression: 'pullup', progressionStep: 1 }),
  E({ id: 'assisted_pullup', name: 'Band-assisted pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['pullup_bar', 'bands'], compound: true, systemicCost: 1.1, loadType: 'assisted', goalFit: g(0.65, 0.45, 0.85, 0.7, 0.75), progression: 'pullup', progressionStep: 2 }),
  E({ id: 'weighted_pullup', name: 'Weighted pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back', 'forearms'], equipment: ['pullup_bar'], compound: true, systemicCost: 1.9, loadType: 'bodyweight', skill: 2, goalFit: g(0.85, 0.9, 1, 0.3, 0.45), progression: 'pullup', progressionStep: 4 }),
  E({ id: 'archer_pullup', name: 'Archer pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back', 'obliques'], equipment: ['pullup_bar'], compound: true, unilateral: true, systemicCost: 2, loadType: 'bodyweight', skill: 3, goalFit: g(0.7, 0.75, 1, 0.35, 0.35), progression: 'pullup', progressionStep: 5 }),
  E({ id: 'lat_pulldown', name: 'Lat pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['cable', 'machine'], compound: true, systemicCost: 1, goalFit: g(0.85, 0.55, 0.3, 0.8, 0.85) }),
  E({ id: 'neutral_pulldown', name: 'Neutral-grip pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['cable', 'machine'], compound: true, systemicCost: 1, shoulderStress: 0.3, goalFit: g(0.85, 0.55, 0.3, 0.8, 0.9) }),
  E({ id: 'muscleup_transition', name: 'Muscle-up transition drill', pattern: 'skill', primary: ['lats', 'upper_back'], secondary: ['triceps', 'chest', 'abs'], equipment: ['pullup_bar', 'rings'], compound: true, systemicCost: 2, shoulderStress: 1.5, loadType: 'bodyweight', skill: 3, goalFit: g(0.4, 0.6, 1, 0.3, 0.3) }),

  // ---------------------------------------------------------------- squat
  E({ id: 'back_squat', name: 'Back squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs', 'adductors'], equipment: ['barbell'], compound: true, systemicCost: 3, kneeStress: 1.5, goalFit: g(0.85, 1, 0.3, 0.35, 0.55), skill: 2 }),
  E({ id: 'front_squat', name: 'Front squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'abs', 'upper_back'], equipment: ['barbell'], compound: true, systemicCost: 2.7, kneeStress: 1.6, goalFit: g(0.8, 0.9, 0.35, 0.35, 0.6), skill: 3 }),
  E({ id: 'goblet_squat', name: 'Goblet squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['abs', 'adductors'], equipment: ['dumbbell', 'kettlebell'], compound: true, systemicCost: 1.5, kneeStress: 1, goalFit: g(0.6, 0.4, 0.4, 0.8, 0.95) }),
  E({ id: 'hack_squat', name: 'Hack squat machine', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['machine'], compound: true, systemicCost: 1.8, kneeStress: 1.4, goalFit: g(0.95, 0.6, 0.15, 0.6, 0.6) }),
  E({ id: 'leg_press', name: 'Leg press', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'], equipment: ['machine'], compound: true, systemicCost: 1.5, kneeStress: 1.1, goalFit: g(0.9, 0.6, 0.15, 0.75, 0.7), notes: 'Spares the spine when running volume is already high.' }),
  E({ id: 'belt_squat', name: 'Belt squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['adductors'], equipment: ['machine'], compound: true, systemicCost: 1.4, kneeStress: 1.1, goalFit: g(0.85, 0.6, 0.15, 0.7, 0.85) }),
  E({ id: 'pistol_squat', name: 'Pistol squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['abs', 'adductors', 'calves'], equipment: ['bodyweight'], compound: true, unilateral: true, systemicCost: 1.6, kneeStress: 1.6, loadType: 'bodyweight', skill: 3, goalFit: g(0.5, 0.5, 1, 0.5, 0.7), progression: 'pistol', progressionStep: 3 }),
  E({ id: 'assisted_pistol', name: 'Assisted pistol squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['abs', 'adductors'], equipment: ['bodyweight', 'rings'], compound: true, unilateral: true, systemicCost: 1.2, kneeStress: 1.2, loadType: 'assisted', skill: 2, goalFit: g(0.45, 0.35, 0.9, 0.6, 0.8), progression: 'pistol', progressionStep: 2 }),
  E({ id: 'box_squat_single', name: 'Single-leg box squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['abs'], equipment: ['bench', 'bodyweight'], unilateral: true, systemicCost: 1, kneeStress: 1, loadType: 'bodyweight', goalFit: g(0.45, 0.3, 0.8, 0.7, 0.9), progression: 'pistol', progressionStep: 1 }),

  // ---------------------------------------------------------------- hinge
  E({ id: 'deadlift', name: 'Conventional deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['upper_back', 'traps', 'forearms', 'quads'], equipment: ['barbell'], compound: true, systemicCost: 3, kneeStress: 0.6, goalFit: g(0.7, 1, 0.3, 0.25, 0.5), skill: 3 }),
  E({ id: 'trap_bar_dl', name: 'Trap-bar deadlift', pattern: 'hinge', primary: ['glutes', 'quads', 'hamstrings'], secondary: ['lower_back', 'traps', 'forearms'], equipment: ['barbell'], compound: true, systemicCost: 2.6, kneeStress: 0.9, goalFit: g(0.75, 0.9, 0.3, 0.4, 0.75), skill: 2 }),
  E({ id: 'rdl', name: 'Romanian deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'], equipment: ['barbell'], compound: true, systemicCost: 2.2, goalFit: g(0.9, 0.75, 0.3, 0.5, 0.8), skill: 2, notes: 'Hamstring insurance for runners.' }),
  E({ id: 'db_rdl', name: 'Dumbbell RDL', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['dumbbell'], compound: true, systemicCost: 1.6, goalFit: g(0.85, 0.55, 0.3, 0.65, 0.9) }),
  E({ id: 'sl_rdl', name: 'Single-leg RDL', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'obliques', 'calves'], equipment: ['dumbbell'], unilateral: true, systemicCost: 1.2, goalFit: g(0.6, 0.4, 0.6, 0.7, 1), notes: 'Balance and single-leg stability — transfers to running and volley landings.' }),
  E({ id: 'hip_thrust', name: 'Barbell hip thrust', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], compound: true, systemicCost: 1.5, goalFit: g(0.9, 0.75, 0.2, 0.6, 0.85) }),
  E({ id: 'glute_bridge', name: 'Dumbbell glute bridge', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['dumbbell'], systemicCost: 0.9, goalFit: g(0.7, 0.45, 0.35, 0.75, 0.9) }),
  E({ id: 'back_extension', name: '45° back extension', pattern: 'hinge', primary: ['lower_back', 'glutes'], secondary: ['hamstrings'], equipment: ['machine'], systemicCost: 1, goalFit: g(0.6, 0.5, 0.5, 0.8, 1) }),
  E({ id: 'good_morning', name: 'Good morning', pattern: 'hinge', primary: ['hamstrings', 'lower_back'], secondary: ['glutes'], equipment: ['barbell'], compound: true, systemicCost: 2.2, goalFit: g(0.6, 0.8, 0.25, 0.4, 0.5), skill: 3 }),
  E({ id: 'pull_through', name: 'Cable pull-through', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['lower_back'], equipment: ['cable'], systemicCost: 0.9, goalFit: g(0.65, 0.4, 0.3, 0.8, 0.95) }),
  E({ id: 'kb_swing', name: 'Kettlebell swing', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['lower_back', 'abs', 'traps'], equipment: ['kettlebell'], compound: true, systemicCost: 1.8, goalFit: g(0.5, 0.6, 0.5, 0.95, 0.85) }),
  E({ id: 'nordic_curl', name: 'Nordic hamstring curl', pattern: 'hinge', primary: ['hamstrings'], secondary: ['glutes', 'calves'], equipment: ['bodyweight'], systemicCost: 1.6, loadType: 'bodyweight', skill: 3, goalFit: g(0.7, 0.65, 0.9, 0.4, 1), notes: 'Strongest single protector against hamstring strains when you sprint.' }),

  // ---------------------------------------------------------------- lunge
  E({ id: 'bulgarian_split_squat', name: 'Bulgarian split squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors', 'abs'], equipment: ['dumbbell', 'bench'], compound: true, unilateral: true, systemicCost: 2, kneeStress: 1.3, goalFit: g(0.9, 0.65, 0.5, 0.7, 0.9) }),
  E({ id: 'walking_lunge', needsSpace: true, name: 'Walking lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves', 'adductors'], equipment: ['dumbbell'], compound: true, unilateral: true, systemicCost: 1.8, kneeStress: 1.2, goalFit: g(0.75, 0.5, 0.55, 0.9, 0.85) }),
  E({ id: 'reverse_lunge', name: 'Reverse lunge', pattern: 'lunge', primary: ['glutes', 'quads'], secondary: ['hamstrings', 'adductors'], equipment: ['dumbbell'], compound: true, unilateral: true, systemicCost: 1.5, kneeStress: 0.8, goalFit: g(0.75, 0.5, 0.55, 0.8, 0.95), notes: 'Knee-friendlier than forward lunges on tired running legs.' }),
  E({ id: 'step_up', name: 'Step-up', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings'], equipment: ['dumbbell', 'bench'], compound: true, unilateral: true, systemicCost: 1.4, kneeStress: 1, goalFit: g(0.7, 0.5, 0.6, 0.85, 0.95) }),
  E({ id: 'lateral_lunge', name: 'Lateral lunge', pattern: 'lunge', primary: ['adductors', 'glutes'], secondary: ['quads', 'hamstrings'], equipment: ['dumbbell'], compound: true, unilateral: true, systemicCost: 1.3, kneeStress: 0.9, goalFit: g(0.55, 0.4, 0.6, 0.8, 1), notes: 'Frontal-plane work — exactly the plane beach volley loads and running never does.' }),
  E({ id: 'split_squat', name: 'Static split squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['adductors', 'abs'], equipment: ['dumbbell'], compound: true, unilateral: true, systemicCost: 1.4, kneeStress: 1, goalFit: g(0.75, 0.55, 0.55, 0.75, 0.9) }),

  // ---------------------------------------------------------------- carry
  E({ id: 'farmers_carry', needsSpace: true, name: "Farmer's carry", pattern: 'carry', primary: ['forearms', 'traps'], secondary: ['abs', 'obliques', 'upper_back', 'glutes'], equipment: ['dumbbell', 'kettlebell'], compound: true, loadType: 'time', systemicCost: 1.6, goalFit: g(0.5, 0.75, 0.6, 0.9, 1) }),
  E({ id: 'suitcase_carry', needsSpace: true, name: 'Suitcase carry', pattern: 'carry', primary: ['obliques', 'forearms'], secondary: ['abs', 'traps', 'glutes'], equipment: ['dumbbell', 'kettlebell'], unilateral: true, loadType: 'time', systemicCost: 1.3, goalFit: g(0.45, 0.6, 0.6, 0.85, 1) }),
  E({ id: 'front_rack_carry', needsSpace: true, name: 'Front-rack carry', pattern: 'carry', primary: ['abs', 'upper_back'], secondary: ['obliques', 'forearms', 'traps'], equipment: ['kettlebell', 'dumbbell'], compound: true, loadType: 'time', systemicCost: 1.4, goalFit: g(0.4, 0.6, 0.6, 0.85, 0.95) }),
  E({ id: 'overhead_carry', needsSpace: true, name: 'Overhead carry', pattern: 'carry', primary: ['side_delts', 'abs'], secondary: ['front_delts', 'traps', 'rotator_cuff'], equipment: ['kettlebell', 'dumbbell'], compound: true, loadType: 'time', systemicCost: 1.3, shoulderStress: 1.2, goalFit: g(0.4, 0.6, 0.65, 0.8, 0.95) }),

  // ---------------------------------------------------------------- core
  E({ id: 'hanging_leg_raise', name: 'Hanging leg raise', pattern: 'core', primary: ['abs', 'hip_flexors'], secondary: ['obliques', 'forearms'], equipment: ['pullup_bar'], systemicCost: 1, loadType: 'bodyweight', skill: 2, goalFit: g(0.7, 0.5, 1, 0.7, 0.7) }),
  E({ id: 'hanging_knee_raise', name: 'Hanging knee raise', pattern: 'core', primary: ['abs', 'hip_flexors'], secondary: ['obliques', 'forearms'], equipment: ['pullup_bar'], systemicCost: 0.8, loadType: 'bodyweight', goalFit: g(0.6, 0.4, 0.9, 0.8, 0.8) }),
  E({ id: 'toes_to_bar', name: 'Toes to bar', pattern: 'core', primary: ['abs', 'hip_flexors'], secondary: ['lats', 'obliques', 'forearms'], equipment: ['pullup_bar'], systemicCost: 1.3, loadType: 'bodyweight', skill: 3, goalFit: g(0.6, 0.5, 1, 0.7, 0.5) }),
  E({ id: 'ab_wheel', name: 'Ab wheel rollout', pattern: 'core', primary: ['abs'], secondary: ['lats', 'obliques', 'lower_back'], equipment: ['bodyweight'], systemicCost: 1.2, loadType: 'bodyweight', skill: 2, goalFit: g(0.75, 0.65, 0.9, 0.6, 0.85) }),
  E({ id: 'cable_crunch', name: 'Cable crunch', pattern: 'core', primary: ['abs'], secondary: ['obliques'], equipment: ['cable'], systemicCost: 0.7, goalFit: g(0.9, 0.5, 0.35, 0.7, 0.6) }),
  E({ id: 'pallof_press', name: 'Pallof press', pattern: 'core', primary: ['obliques', 'abs'], secondary: ['glutes'], equipment: ['cable', 'bands'], systemicCost: 0.6, goalFit: g(0.4, 0.5, 0.6, 0.8, 1), notes: 'Anti-rotation — protects the trunk during spikes and dives.' }),
  E({ id: 'side_plank', name: 'Side plank', pattern: 'core', primary: ['obliques'], secondary: ['abs', 'glutes'], equipment: ['bodyweight'], systemicCost: 0.5, loadType: 'time', goalFit: g(0.3, 0.35, 0.7, 0.85, 1) }),
  E({ id: 'plank', name: 'Plank', pattern: 'core', primary: ['abs'], secondary: ['obliques'], equipment: ['bodyweight'], systemicCost: 0.4, loadType: 'time', goalFit: g(0.25, 0.3, 0.7, 0.85, 0.95) }),
  E({ id: 'copenhagen_plank', name: 'Copenhagen plank', pattern: 'core', primary: ['adductors', 'obliques'], secondary: ['abs'], equipment: ['bench'], systemicCost: 0.8, loadType: 'time', skill: 2, goalFit: g(0.35, 0.4, 0.7, 0.7, 1), notes: 'Groin resilience for lateral sand movement.' }),
  E({ id: 'dead_bug', name: 'Dead bug', pattern: 'core', primary: ['abs'], secondary: ['hip_flexors', 'obliques'], equipment: ['bodyweight'], systemicCost: 0.4, loadType: 'bodyweight', goalFit: g(0.3, 0.3, 0.6, 0.8, 1) }),
  E({ id: 'hollow_hold', name: 'Hollow body hold', pattern: 'core', primary: ['abs'], secondary: ['hip_flexors', 'obliques'], equipment: ['bodyweight'], systemicCost: 0.7, loadType: 'time', skill: 2, goalFit: g(0.4, 0.4, 1, 0.7, 0.7) }),
  E({ id: 'landmine_rotation', name: 'Landmine rotation', pattern: 'core', primary: ['obliques'], secondary: ['abs', 'front_delts'], equipment: ['barbell'], systemicCost: 0.9, goalFit: g(0.5, 0.5, 0.5, 0.75, 0.9) }),

  // ---------------------------------------------------------------- skill (calisthenics)
  E({ id: 'lsit_tuck', name: 'Tuck L-sit hold', pattern: 'skill', primary: ['abs', 'hip_flexors'], secondary: ['triceps', 'front_delts'], equipment: ['dip_bars', 'bodyweight'], systemicCost: 0.9, loadType: 'time', skill: 2, goalFit: g(0.35, 0.4, 1, 0.6, 0.6), progression: 'lsit', progressionStep: 2 }),
  E({ id: 'lsit', name: 'L-sit', pattern: 'skill', primary: ['abs', 'hip_flexors'], secondary: ['triceps', 'front_delts', 'quads'], equipment: ['dip_bars', 'rings'], systemicCost: 1.2, loadType: 'time', skill: 3, goalFit: g(0.35, 0.45, 1, 0.55, 0.6), progression: 'lsit', progressionStep: 4 }),
  E({ id: 'front_lever_tuck', name: 'Tuck front lever hold', pattern: 'skill', primary: ['lats', 'abs'], secondary: ['upper_back', 'rear_delts', 'obliques'], equipment: ['pullup_bar', 'rings'], compound: true, systemicCost: 1.6, loadType: 'time', skill: 3, goalFit: g(0.4, 0.6, 1, 0.4, 0.4), progression: 'frontlever', progressionStep: 1 }),
  E({ id: 'front_lever_raise', name: 'Tuck front lever raise', pattern: 'skill', primary: ['lats', 'abs'], secondary: ['upper_back', 'rear_delts'], equipment: ['pullup_bar'], compound: true, systemicCost: 1.8, loadType: 'bodyweight', skill: 3, goalFit: g(0.45, 0.6, 1, 0.4, 0.35), progression: 'frontlever', progressionStep: 2 }),
  E({ id: 'wall_handstand', name: 'Wall handstand hold', pattern: 'skill', primary: ['front_delts', 'side_delts'], secondary: ['abs', 'traps', 'forearms'], equipment: ['bodyweight'], systemicCost: 1.1, shoulderStress: 1.5, loadType: 'time', skill: 2, goalFit: g(0.25, 0.35, 1, 0.5, 0.7), progression: 'handstand', progressionStep: 1 }),
  E({ id: 'freestanding_handstand', name: 'Freestanding handstand practice', pattern: 'skill', primary: ['front_delts', 'side_delts'], secondary: ['abs', 'forearms', 'traps'], equipment: ['bodyweight'], systemicCost: 1, shoulderStress: 1.3, loadType: 'time', skill: 3, goalFit: g(0.2, 0.3, 1, 0.5, 0.75), progression: 'handstand', progressionStep: 5 }),
  E({ id: 'ring_support', name: 'Ring support hold', pattern: 'skill', primary: ['front_delts', 'rotator_cuff'], secondary: ['triceps', 'chest', 'abs'], equipment: ['rings'], systemicCost: 1, shoulderStress: 1.4, loadType: 'time', skill: 2, goalFit: g(0.25, 0.4, 1, 0.55, 0.75) }),
  E({ id: 'skin_the_cat', name: 'Skin the cat', pattern: 'skill', primary: ['lats', 'rotator_cuff'], secondary: ['abs', 'upper_back', 'chest'], equipment: ['rings'], systemicCost: 1.2, shoulderStress: 1.6, loadType: 'bodyweight', skill: 3, goalFit: g(0.3, 0.4, 1, 0.4, 0.7) }),
  E({ id: 'planche_lean', name: 'Planche lean', pattern: 'skill', primary: ['front_delts', 'chest'], secondary: ['abs', 'biceps', 'forearms'], equipment: ['bodyweight'], systemicCost: 1.3, shoulderStress: 1.5, loadType: 'time', skill: 3, goalFit: g(0.3, 0.5, 1, 0.4, 0.4) }),

  // ---------------------------------------------------------------- isolation: shoulders & upper back
  E({ id: 'lateral_raise', name: 'Dumbbell lateral raise', pattern: 'isolation', primary: ['side_delts'], secondary: [], equipment: ['dumbbell'], systemicCost: 0.5, shoulderStress: 0.6, goalFit: g(0.95, 0.35, 0.2, 0.75, 0.7) }),
  E({ id: 'cable_lateral_raise', name: 'Cable lateral raise', pattern: 'isolation', primary: ['side_delts'], secondary: [], equipment: ['cable'], systemicCost: 0.5, shoulderStress: 0.5, goalFit: g(0.95, 0.35, 0.2, 0.8, 0.75) }),
  E({ id: 'rear_delt_fly', name: 'Rear delt fly', pattern: 'isolation', primary: ['rear_delts'], secondary: ['upper_back'], equipment: ['dumbbell', 'machine'], systemicCost: 0.4, goalFit: g(0.85, 0.35, 0.3, 0.8, 1) }),
  E({ id: 'face_pull', name: 'Face pull', pattern: 'isolation', primary: ['rear_delts', 'rotator_cuff'], secondary: ['upper_back', 'traps'], equipment: ['cable'], systemicCost: 0.5, goalFit: g(0.7, 0.4, 0.4, 0.85, 1), notes: 'Direct counterweight to overhead spiking volume.' }),
  E({ id: 'band_pull_apart', name: 'Band pull-apart', pattern: 'isolation', primary: ['rear_delts'], secondary: ['upper_back', 'rotator_cuff'], equipment: ['bands'], systemicCost: 0.3, goalFit: g(0.4, 0.3, 0.4, 0.85, 1) }),
  E({ id: 'external_rotation', name: 'Cable external rotation', pattern: 'isolation', primary: ['rotator_cuff'], secondary: ['rear_delts'], equipment: ['cable', 'bands'], systemicCost: 0.3, goalFit: g(0.35, 0.35, 0.45, 0.7, 1), notes: 'Cuff health — cheap insurance for an overhead athlete.' }),
  E({ id: 'shrug', name: 'Dumbbell shrug', pattern: 'isolation', primary: ['traps'], secondary: ['forearms'], equipment: ['dumbbell'], systemicCost: 0.6, goalFit: g(0.85, 0.6, 0.2, 0.6, 0.6) }),
  E({ id: 'straight_arm_pulldown', name: 'Straight-arm pulldown', pattern: 'isolation', primary: ['lats'], secondary: ['triceps', 'abs'], equipment: ['cable'], systemicCost: 0.5, goalFit: g(0.85, 0.35, 0.4, 0.75, 0.7) }),
  E({ id: 'pullover', name: 'Dumbbell pullover', pattern: 'isolation', primary: ['lats', 'chest'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], systemicCost: 0.8, shoulderStress: 0.8, goalFit: g(0.8, 0.35, 0.35, 0.6, 0.6) }),

  // ---------------------------------------------------------------- isolation: arms
  E({ id: 'bb_curl', name: 'Barbell curl', pattern: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['barbell'], systemicCost: 0.7, goalFit: g(0.9, 0.5, 0.25, 0.6, 0.5) }),
  E({ id: 'incline_db_curl', name: 'Incline dumbbell curl', pattern: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['dumbbell', 'bench'], systemicCost: 0.6, goalFit: g(0.95, 0.4, 0.25, 0.65, 0.55) }),
  E({ id: 'hammer_curl', name: 'Hammer curl', pattern: 'isolation', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbell'], systemicCost: 0.6, goalFit: g(0.9, 0.45, 0.4, 0.7, 0.7) }),
  E({ id: 'cable_curl', name: 'Cable curl', pattern: 'isolation', primary: ['biceps'], secondary: ['forearms'], equipment: ['cable'], systemicCost: 0.5, goalFit: g(0.9, 0.4, 0.25, 0.8, 0.6) }),
  E({ id: 'preacher_curl', name: 'Preacher curl', pattern: 'isolation', primary: ['biceps'], secondary: [], equipment: ['machine', 'barbell'], systemicCost: 0.6, goalFit: g(0.9, 0.45, 0.2, 0.65, 0.5) }),
  E({ id: 'rope_pushdown', name: 'Rope triceps pushdown', pattern: 'isolation', primary: ['triceps'], secondary: [], equipment: ['cable'], systemicCost: 0.5, goalFit: g(0.9, 0.4, 0.3, 0.85, 0.65) }),
  E({ id: 'overhead_ext', name: 'Overhead cable triceps extension', pattern: 'isolation', primary: ['triceps'], secondary: [], equipment: ['cable'], systemicCost: 0.6, shoulderStress: 0.6, goalFit: g(0.95, 0.45, 0.35, 0.7, 0.6) }),
  E({ id: 'skullcrusher', name: 'Skullcrusher', pattern: 'isolation', primary: ['triceps'], secondary: [], equipment: ['barbell', 'bench'], systemicCost: 0.8, goalFit: g(0.9, 0.6, 0.35, 0.55, 0.45) }),
  E({ id: 'reverse_curl', name: 'Reverse curl', pattern: 'isolation', primary: ['forearms', 'biceps'], secondary: [], equipment: ['barbell', 'dumbbell'], systemicCost: 0.5, goalFit: g(0.7, 0.4, 0.55, 0.7, 0.85) }),
  E({ id: 'wrist_curl', name: 'Wrist curl', pattern: 'isolation', primary: ['forearms'], secondary: [], equipment: ['dumbbell'], systemicCost: 0.3, goalFit: g(0.6, 0.35, 0.6, 0.8, 0.8) }),

  // ---------------------------------------------------------------- isolation: chest & legs
  E({ id: 'pec_deck', name: 'Pec deck / machine fly', pattern: 'isolation', primary: ['chest'], secondary: [], equipment: ['machine'], systemicCost: 0.6, shoulderStress: 0.7, goalFit: g(0.9, 0.3, 0.15, 0.75, 0.55) }),
  E({ id: 'cable_fly', name: 'Cable fly', pattern: 'isolation', primary: ['chest'], secondary: ['front_delts'], equipment: ['cable'], systemicCost: 0.6, shoulderStress: 0.7, goalFit: g(0.9, 0.3, 0.2, 0.8, 0.6) }),
  E({ id: 'leg_extension', name: 'Leg extension', pattern: 'isolation', primary: ['quads'], secondary: [], equipment: ['machine'], systemicCost: 0.7, kneeStress: 0.9, goalFit: g(0.9, 0.4, 0.15, 0.75, 0.6) }),
  E({ id: 'lying_leg_curl', name: 'Lying leg curl', pattern: 'isolation', primary: ['hamstrings'], secondary: ['calves'], equipment: ['machine'], systemicCost: 0.7, goalFit: g(0.9, 0.45, 0.15, 0.75, 0.85) }),
  E({ id: 'seated_leg_curl', name: 'Seated leg curl', pattern: 'isolation', primary: ['hamstrings'], secondary: [], equipment: ['machine'], systemicCost: 0.7, goalFit: g(0.95, 0.45, 0.15, 0.75, 0.85) }),
  E({ id: 'standing_calf_raise', name: 'Standing calf raise', pattern: 'isolation', primary: ['calves'], secondary: [], equipment: ['machine'], systemicCost: 0.5, goalFit: g(0.85, 0.45, 0.3, 0.85, 0.9) }),
  E({ id: 'seated_calf_raise', name: 'Seated calf raise', pattern: 'isolation', primary: ['calves'], secondary: [], equipment: ['machine'], systemicCost: 0.4, goalFit: g(0.85, 0.4, 0.25, 0.85, 0.9), notes: 'Biases soleus — the muscle that eats most of the load when you run.' }),
  E({ id: 'hip_abduction', name: 'Hip abduction machine', pattern: 'isolation', primary: ['glutes'], secondary: ['adductors'], equipment: ['machine'], systemicCost: 0.5, goalFit: g(0.7, 0.35, 0.2, 0.8, 1) }),
  E({ id: 'hip_adduction', name: 'Hip adduction machine', pattern: 'isolation', primary: ['adductors'], secondary: [], equipment: ['machine'], systemicCost: 0.5, goalFit: g(0.7, 0.35, 0.2, 0.8, 1) }),
  E({ id: 'tibialis_raise', name: 'Tibialis raise', pattern: 'isolation', primary: ['calves'], secondary: [], equipment: ['bodyweight', 'bands'], systemicCost: 0.3, goalFit: g(0.4, 0.3, 0.4, 0.8, 1), notes: 'Shin resilience — cuts down shin splints from sand and road work.' }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_BY_ID[id];
}

/** Exercises whose equipment requirements are all met by the user's gym. */
export function availableExercises(equipment: Equipment[]): Exercise[] {
  const have = new Set<Equipment>(equipment);
  have.add('bodyweight');
  return EXERCISES.filter((e) => e.equipment.every((eq) => have.has(eq)));
}

/** Members of a calisthenics ladder, ordered easiest first. */
export function progressionFamily(family: string): Exercise[] {
  return EXERCISES.filter((e) => e.progression === family).sort(
    (a, b) => (a.progressionStep ?? 0) - (b.progressionStep ?? 0),
  );
}
