import { availableExercises } from './exercises';
import { goalFitScore } from './goals';
import { ladderStepAllowed } from './progression';
import type { Exercise, Profile, SessionLog } from './types';

/**
 * Alternatives for a planned exercise: same job in the session, different
 * implement or angle. Used when a machine is busy or something hurts.
 */
export function alternativesFor(
  exercise: Exercise,
  profile: Profile,
  logs: SessionLog[],
  alreadyInDay: string[],
  limit = 8,
): Exercise[] {
  const primary = new Set(exercise.primary);
  return availableExercises(profile.equipment)
    .filter((candidate) => {
      if (candidate.id === exercise.id) return false;
      if (alreadyInDay.includes(candidate.id)) return false;
      if (profile.excludedExercises.includes(candidate.id)) return false;
      if (candidate.primary.some((m) => profile.avoid.includes(m))) return false;
      if (!ladderStepAllowed(candidate, logs, profile)) return false;
      const sharesMuscle = candidate.primary.some((m) => primary.has(m));
      return sharesMuscle || candidate.pattern === exercise.pattern;
    })
    .map((candidate) => {
      const shared = candidate.primary.filter((m) => primary.has(m)).length;
      const patternMatch = candidate.pattern === exercise.pattern ? 1 : 0;
      const score =
        shared * 2 + patternMatch * 1.5 + goalFitScore(candidate.goalFit, profile.goals);
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.candidate);
}
