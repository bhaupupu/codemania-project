import { User } from '../models/User.model';
import { ITaskDoc } from '../models/Game.model';
import { logger } from '../utils/logger';

export interface TaskVerdict {
  index: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

export interface PlayerLearningProfile {
  userId: string;
  skillAreas: {
    arrays: number;
    loops: number;
    recursion: number;
    edgeCases: number;
    stringManipulation: number;
    debugging: number;
  };
  averageSolveTimeSec: number;
  commonMistakes: string[];
  mistakeFrequencies: Record<string, number>;
  totalAttempts: number;
  totalCompletions: number;
  recentWeakness: 'recursion' | 'edge-cases' | 'arrays' | 'loops' | 'strings' | 'none';
  updatedAt: Date;
}

// In-memory cache of player profiles for instant access across rounds
const profileCache = new Map<string, PlayerLearningProfile>();
// Track task attempt counts per player per task to measure debugging & self-correction
const playerTaskAttempts = new Map<string, Map<string, number>>();

/**
 * Initialize a balanced default learning profile.
 */
function createDefaultProfile(userId: string): PlayerLearningProfile {
  return {
    userId,
    skillAreas: {
      arrays: 75,
      loops: 75,
      recursion: 60,
      edgeCases: 55,
      stringManipulation: 70,
      debugging: 65,
    },
    averageSolveTimeSec: 90,
    commonMistakes: [],
    mistakeFrequencies: {},
    totalAttempts: 0,
    totalCompletions: 0,
    recentWeakness: 'none',
    updatedAt: new Date(),
  };
}

export function getLearningProfileSync(userId: string): PlayerLearningProfile {
  const cached = profileCache.get(userId);
  if (cached) return cached;
  const def = createDefaultProfile(userId);
  profileCache.set(userId, def);
  return def;
}

/**
 * Retrieve a player's learning profile (from cache or Mongo).
 */
export async function getLearningProfile(userId: string): Promise<PlayerLearningProfile> {
  const cached = profileCache.get(userId);
  if (cached) return cached;

  try {
    const user = await User.findById(userId).lean();
    if (user && user.learningProfile) {
      const lp = user.learningProfile;
      const profile: PlayerLearningProfile = {
        userId,
        skillAreas: {
          arrays: lp.skillAreas?.arrays ?? 75,
          loops: lp.skillAreas?.loops ?? 75,
          recursion: lp.skillAreas?.recursion ?? 60,
          edgeCases: lp.skillAreas?.edgeCases ?? 55,
          stringManipulation: lp.skillAreas?.stringManipulation ?? 70,
          debugging: lp.skillAreas?.debugging ?? 65,
        },
        averageSolveTimeSec: lp.averageSolveTimeSec ?? 90,
        commonMistakes: lp.commonMistakes ?? [],
        mistakeFrequencies:
          lp.mistakeFrequencies instanceof Map
            ? Object.fromEntries(lp.mistakeFrequencies)
            : (lp.mistakeFrequencies as Record<string, number>) ?? {},
        totalAttempts: lp.totalAttempts ?? 0,
        totalCompletions: lp.totalCompletions ?? 0,
        recentWeakness: (lp.recentWeakness as any) ?? 'none',
        updatedAt: lp.updatedAt ?? new Date(),
      };
      profileCache.set(userId, profile);
      return profile;
    }
  } catch (err) {
    // Non-fatal if Mongo is unavailable or user is guest
  }

  const def = createDefaultProfile(userId);
  profileCache.set(userId, def);
  return def;
}

/**
 * Classify mistakes from submitted code and failed verdicts.
 */
function classifyMistakes(
  task: ITaskDoc,
  submittedCode: string,
  verdicts: TaskVerdict[]
): string[] {
  const mistakes: string[] = [];
  const failedVerdicts = verdicts.filter((v) => !v.passed);

  if (failedVerdicts.length === 0) return mistakes;

  const codeLower = submittedCode.toLowerCase();
  const titleLower = task.title.toLowerCase();

  // 1. Off-by-one errors
  const hasOffByOnePattern =
    /<=\s*\w+\.length\b/.test(submittedCode) ||
    /\[\s*\w+\.length\s*\]/.test(submittedCode) ||
    titleLower.includes('off-by-one');
  const hasUndefinedActual = failedVerdicts.some(
    (v) => v.actual === 'undefined' || v.actual.includes('undefined')
  );
  if (hasOffByOnePattern || hasUndefinedActual) {
    mistakes.push('off-by-one errors');
  }

  // 2. Empty input / boundary handling
  const failedEmptyInput = failedVerdicts.some((v) => {
    const inp = v.input.trim();
    return inp === '[]' || inp === '""' || inp === "''" || inp === '0' || inp === '{}';
  });
  const hasNullError = failedVerdicts.some(
    (v) =>
      v.error?.includes('Cannot read properties of undefined') ||
      v.error?.includes('Cannot read properties of null') ||
      v.error?.includes('null')
  );
  if (failedEmptyInput || hasNullError) {
    mistakes.push('empty-array / boundary handling');
  }

  // 3. Recursion base cases
  const hasRecursionOverflow = failedVerdicts.some(
    (v) =>
      v.error?.includes('Maximum call stack size exceeded') ||
      v.error?.includes('RecursionError')
  );
  const isRecursionTask =
    titleLower.includes('recursion') ||
    titleLower.includes('factorial') ||
    titleLower.includes('fibonacci');
  if (hasRecursionOverflow || (isRecursionTask && failedVerdicts.length > 0)) {
    mistakes.push('recursion base cases');
  }

  // 4. Logic / comparator mistakes
  const isBooleanInversion = failedVerdicts.some((v) => {
    const exp = v.expected.trim().toLowerCase();
    const act = v.actual.trim().toLowerCase();
    return (exp === 'true' && act === 'false') || (exp === 'false' && act === 'true');
  });
  if (isBooleanInversion) {
    mistakes.push('logic / boolean comparators');
  }

  // 5. Syntax mistakes
  const hasSyntaxError = failedVerdicts.some(
    (v) => v.error?.includes('SyntaxError') || v.error?.includes('Unexpected token')
  );
  if (hasSyntaxError) {
    mistakes.push('syntax mistakes');
  }

  return mistakes;
}

/**
 * Record a challenge attempt, analyze mistakes, and update the player's learning profile.
 */
export async function recordTaskAttempt(
  userId: string,
  task: ITaskDoc,
  submittedCode: string,
  verdicts: TaskVerdict[],
  allPassed: boolean,
  solveTimeSec?: number
): Promise<PlayerLearningProfile> {
  const profile = await getLearningProfile(userId);

  profile.totalAttempts += 1;
  profile.updatedAt = new Date();

  // Track attempts per task for debugging efficiency
  let userTaskMap = playerTaskAttempts.get(userId);
  if (!userTaskMap) {
    userTaskMap = new Map<string, number>();
    playerTaskAttempts.set(userId, userTaskMap);
  }
  const attemptNum = (userTaskMap.get(task._id) ?? 0) + 1;
  userTaskMap.set(task._id, attemptNum);

  if (allPassed) {
    profile.totalCompletions += 1;

    // Player corrected themselves after earlier failure
    if (attemptNum > 1) {
      profile.skillAreas.debugging = Math.min(100, profile.skillAreas.debugging + 4);
    }

    // Success in domain increases confidence
    const titleLower = task.title.toLowerCase();
    if (titleLower.includes('array') || titleLower.includes('flatten') || titleLower.includes('chunk')) {
      profile.skillAreas.arrays = Math.min(100, profile.skillAreas.arrays + 3);
    }
    if (titleLower.includes('loop') || titleLower.includes('sum') || titleLower.includes('for')) {
      profile.skillAreas.loops = Math.min(100, profile.skillAreas.loops + 3);
    }
    if (titleLower.includes('recursion') || titleLower.includes('factorial') || titleLower.includes('tree')) {
      profile.skillAreas.recursion = Math.min(100, profile.skillAreas.recursion + 4);
    }
    if (titleLower.includes('palindrome') || titleLower.includes('string') || titleLower.includes('reverse')) {
      profile.skillAreas.stringManipulation = Math.min(100, profile.skillAreas.stringManipulation + 3);
    }

    if (solveTimeSec && solveTimeSec > 0) {
      // Exponential moving average for solve time
      profile.averageSolveTimeSec = Math.round(
        profile.averageSolveTimeSec * 0.7 + solveTimeSec * 0.3
      );
    }
  } else {
    // Analyze failed attempt
    const identifiedMistakes = classifyMistakes(task, submittedCode, verdicts);

    for (const mistake of identifiedMistakes) {
      profile.mistakeFrequencies[mistake] = (profile.mistakeFrequencies[mistake] || 0) + 1;

      // Adjust targeted skill metrics
      if (mistake === 'off-by-one errors') {
        profile.skillAreas.loops = Math.max(20, profile.skillAreas.loops - 4);
        profile.skillAreas.arrays = Math.max(20, profile.skillAreas.arrays - 2);
      }
      if (mistake === 'empty-array / boundary handling') {
        profile.skillAreas.edgeCases = Math.max(20, profile.skillAreas.edgeCases - 5);
      }
      if (mistake === 'recursion base cases') {
        profile.skillAreas.recursion = Math.max(20, profile.skillAreas.recursion - 5);
      }
      if (mistake === 'syntax mistakes') {
        profile.skillAreas.debugging = Math.max(20, profile.skillAreas.debugging - 3);
      }
    }

    // Refresh common mistakes (top 3 by frequency)
    profile.commonMistakes = Object.entries(profile.mistakeFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Identify current dominant weakness
    const skills = profile.skillAreas;
    const minSkill = Math.min(
      skills.recursion,
      skills.edgeCases,
      skills.arrays,
      skills.loops,
      skills.stringManipulation
    );

    if (minSkill === skills.recursion) profile.recentWeakness = 'recursion';
    else if (minSkill === skills.edgeCases) profile.recentWeakness = 'edge-cases';
    else if (minSkill === skills.loops) profile.recentWeakness = 'loops';
    else if (minSkill === skills.arrays) profile.recentWeakness = 'arrays';
    else if (minSkill === skills.stringManipulation) profile.recentWeakness = 'strings';
  }

  // Update in-memory cache
  profileCache.set(userId, profile);

  // Asynchronously sync to MongoDB
  User.findByIdAndUpdate(userId, {
    $set: {
      learningProfile: {
        skillAreas: profile.skillAreas,
        averageSolveTimeSec: profile.averageSolveTimeSec,
        commonMistakes: profile.commonMistakes,
        mistakeFrequencies: profile.mistakeFrequencies,
        totalAttempts: profile.totalAttempts,
        totalCompletions: profile.totalCompletions,
        recentWeakness: profile.recentWeakness,
        updatedAt: profile.updatedAt,
      },
    },
  }).catch((err) => {
    logger.debug(`Could not update User.learningProfile in Mongo: ${err.message}`);
  });

  return profile;
}

/**
 * Aggregate weaknesses across players in a room to guide adaptive task generation.
 */
export async function getAggregatedWeaknesses(
  playerUserIds: string[]
): Promise<{
  weaknessAreas: Array<'recursion' | 'edge-cases' | 'arrays' | 'loops' | 'strings'>;
  averageSkillScore: number;
}> {
  const weaknesses: Record<string, number> = {
    recursion: 0,
    'edge-cases': 0,
    arrays: 0,
    loops: 0,
    strings: 0,
  };

  let totalSkillSum = 0;
  let count = 0;

  for (const uid of playerUserIds) {
    const profile = await getLearningProfile(uid);
    if (profile.recentWeakness !== 'none' && weaknesses[profile.recentWeakness] !== undefined) {
      weaknesses[profile.recentWeakness] += 2;
    }

    // Inspect low scores
    if (profile.skillAreas.recursion < 60) weaknesses.recursion += 1;
    if (profile.skillAreas.edgeCases < 60) weaknesses['edge-cases'] += 1;
    if (profile.skillAreas.loops < 65) weaknesses.loops += 1;
    if (profile.skillAreas.arrays < 65) weaknesses.arrays += 1;
    if (profile.skillAreas.stringManipulation < 65) weaknesses.strings += 1;

    const avg =
      (profile.skillAreas.arrays +
        profile.skillAreas.loops +
        profile.skillAreas.recursion +
        profile.skillAreas.edgeCases +
        profile.skillAreas.stringManipulation +
        profile.skillAreas.debugging) /
      6;
    totalSkillSum += avg;
    count++;
  }

  const sortedWeaknesses = Object.entries(weaknesses)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w as 'recursion' | 'edge-cases' | 'arrays' | 'loops' | 'strings');

  return {
    weaknessAreas: sortedWeaknesses,
    averageSkillScore: count > 0 ? Math.round(totalSkillSum / count) : 70,
  };
}
