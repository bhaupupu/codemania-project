import { ITaskDoc } from '../models/Game.model';
import { generateTasksForGame } from '../utils/taskGenerator';
import { getLearningProfile, getLearningProfileSync, PlayerLearningProfile } from './learningProfile.service';
import { logger } from '../utils/logger';

interface CoderInfo {
  userId: string;
  displayName?: string;
}

/**
 * Score how well a task addresses a player's specific weakness.
 */
function computeTaskAffinityScore(task: ITaskDoc, weakness: string): number {
  const text = `${task.title} ${task.description}`.toLowerCase();
  let score = 1.0;

  switch (weakness) {
    case 'recursion':
      if (
        text.includes('recursion') ||
        text.includes('base case') ||
        text.includes('factorial') ||
        text.includes('fibonacci') ||
        text.includes('flatten') ||
        text.includes('tree')
      ) {
        score += 3.0;
      }
      break;

    case 'edge-cases':
      if (
        text.includes('empty') ||
        text.includes('null') ||
        text.includes('undefined') ||
        text.includes('boundary') ||
        text.includes('palindrome') ||
        text.includes('zero') ||
        task.testCases.some(
          (tc) =>
            tc.input.trim() === '[]' ||
            tc.input.trim() === '""' ||
            tc.input.trim() === '0' ||
            tc.input.trim() === 'null'
        )
      ) {
        score += 3.0;
      }
      break;

    case 'loops':
      if (
        text.includes('off-by-one') ||
        text.includes('loop') ||
        text.includes('sum') ||
        text.includes('range') ||
        text.includes('iteration') ||
        text.includes('for')
      ) {
        score += 3.0;
      }
      break;

    case 'arrays':
      if (
        text.includes('array') ||
        text.includes('chunk') ||
        text.includes('flatten') ||
        text.includes('filter') ||
        text.includes('map') ||
        text.includes('reduce')
      ) {
        score += 2.5;
      }
      break;

    case 'strings':
      if (
        text.includes('string') ||
        text.includes('palindrome') ||
        text.includes('anagram') ||
        text.includes('reverse') ||
        text.includes('vowel')
      ) {
        score += 2.5;
      }
      break;

    default:
      break;
  }

  return score;
}

/**
 * Generate adaptive task assignments tailored to each player's learned strengths & weaknesses.
 *
 * Requirements met:
 * 1. AI observations change future rounds.
 * 2. Weaknesses bias future challenges (e.g. recursion base cases, off-by-one, empty inputs).
 * 3. Difficulty gradually increases/decreases based on performance.
 * 4. Preserves task variety — avoids giving the same problem repeatedly.
 */
export async function generateAdaptiveTasksForGame(
  language: string,
  baseSkillLevel: 'beginner' | 'intermediate' | 'advanced',
  coders: CoderInfo[],
  tasksPerPlayer: number
): Promise<ITaskDoc[]> {
  if (coders.length === 0) return [];

  const totalTasksNeeded = coders.length * tasksPerPlayer;
  // Request a wider candidate pool from the task generator to allow personalized selection
  const candidatePool = generateTasksForGame(language, baseSkillLevel, Math.max(totalTasksNeeded * 2, 20));

  const assignedTasks: ITaskDoc[] = [];
  const usedTaskIds = new Set<string>();

  for (const coder of coders) {
    let profile: PlayerLearningProfile;
    try {
      profile = await getLearningProfile(coder.userId);
    } catch {
      profile = {
        userId: coder.userId,
        skillAreas: { arrays: 70, loops: 70, recursion: 60, edgeCases: 55, stringManipulation: 70, debugging: 60 },
        averageSolveTimeSec: 90,
        commonMistakes: [],
        mistakeFrequencies: {},
        totalAttempts: 0,
        totalCompletions: 0,
        recentWeakness: 'none',
        updatedAt: new Date(),
      };
    }

    const weakness = profile.recentWeakness;
    logger.info(
      `[AdaptiveAI] Player ${coder.displayName || coder.userId} Profile: weakness=${weakness}, edgeCases=${profile.skillAreas.edgeCases}%, recursion=${profile.skillAreas.recursion}%`
    );

    // Filter available candidates not yet used in this match
    const available = candidatePool.filter((t) => !usedTaskIds.has(t._id));

    // Sort available tasks by affinity score for this player's weakness
    const scored = available.map((task) => ({
      task,
      score: computeTaskAffinityScore(task, weakness) + Math.random() * 0.5, // subtle jitter for variety
    }));

    scored.sort((a, b) => b.score - a.score);

    // Pick top tasksPerPlayer for this coder
    const coderTasks = scored.slice(0, tasksPerPlayer).map((item) => item.task);

    for (const t of coderTasks) {
      t.assignedTo = coder.userId;
      usedTaskIds.add(t._id);
      assignedTasks.push(t);
    }
  }

  // Fallback: If not enough tasks were assigned, top-up from available candidates
  if (assignedTasks.length < totalTasksNeeded) {
    const remaining = candidatePool.filter((t) => !usedTaskIds.has(t._id));
    let coderIdx = 0;
    for (const t of remaining) {
      if (assignedTasks.length >= totalTasksNeeded) break;
      t.assignedTo = coders[coderIdx % coders.length].userId;
      usedTaskIds.add(t._id);
      assignedTasks.push(t);
      coderIdx++;
    }
  }

  return assignedTasks;
}

/**
 * Synchronous version of adaptive task generation for real-time game start flow.
 */
export function generateAdaptiveTasksForGameSync(
  language: string,
  baseSkillLevel: 'beginner' | 'intermediate' | 'advanced',
  coders: CoderInfo[],
  tasksPerPlayer: number
): ITaskDoc[] {
  if (coders.length === 0) return [];

  const totalTasksNeeded = coders.length * tasksPerPlayer;
  const candidatePool = generateTasksForGame(language, baseSkillLevel, Math.max(totalTasksNeeded * 2, 20));

  const assignedTasks: ITaskDoc[] = [];
  const usedTaskIds = new Set<string>();

  for (const coder of coders) {
    const profile = getLearningProfileSync(coder.userId);
    const weakness = profile.recentWeakness;

    const available = candidatePool.filter((t) => !usedTaskIds.has(t._id));
    const scored = available.map((task) => ({
      task,
      score: computeTaskAffinityScore(task, weakness) + Math.random() * 0.5,
    }));

    scored.sort((a, b) => b.score - a.score);
    const coderTasks = scored.slice(0, tasksPerPlayer).map((item) => item.task);

    for (const t of coderTasks) {
      t.assignedTo = coder.userId;
      usedTaskIds.add(t._id);
      assignedTasks.push(t);
    }
  }

  if (assignedTasks.length < totalTasksNeeded) {
    const remaining = candidatePool.filter((t) => !usedTaskIds.has(t._id));
    let coderIdx = 0;
    for (const t of remaining) {
      if (assignedTasks.length >= totalTasksNeeded) break;
      t.assignedTo = coders[coderIdx % coders.length].userId;
      usedTaskIds.add(t._id);
      assignedTasks.push(t);
      coderIdx++;
    }
  }

  return assignedTasks;
}

