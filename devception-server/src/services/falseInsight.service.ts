import { randomUUID } from 'crypto';

export interface ClientFalseInsightData {
  insightId: string;
  targetUserId: string;
  topic: string;
  title: string;
  statement: string;
  codeSnippet?: string;
  durationMs: number;
  expiresAt: number;
}

interface InternalFalseInsight extends ClientFalseInsightData {
  roomCode: string;
  imposterUserId: string;
  isCorrect: boolean;
  explanation: string;
  answered: boolean;
}

export interface FalseInsightResult {
  valid: boolean;
  choice?: 'accept' | 'reject';
  wasCorrect?: boolean;
  fellForTrick?: boolean;
  xpGained: number;
  debuffDurationMs?: number;
  imposterUserId?: string;
  message: string;
  explanation: string;
}

// Active insights: insightId -> InternalFalseInsight
const activeInsights = new Map<string, InternalFalseInsight>();
// targetUserId -> insightId
const userActiveInsights = new Map<string, string>();
// User immunity expiration timestamps: userId -> timestamp
const userImmunities = new Map<string, number>();

interface InsightTemplate {
  topic: string;
  title: string;
  statement: string;
  codeSnippet?: string;
  isCorrect: boolean;
  explanation: string;
}

const INSIGHT_TEMPLATES: InsightTemplate[] = [
  {
    topic: 'Graph Algorithms',
    title: 'GRAPH TRAVERSAL OPTIMIZATION',
    statement:
      'Since BFS explores nodes level by level, DFS cannot be used to find the shortest path in an unweighted graph under any circumstance.',
    codeSnippet: 'function findShortest(start, target) {\n  // BFS is mandatory\n}',
    isCorrect: false,
    explanation:
      'DFS can technically find the shortest path by exploring all paths and comparing their lengths, though BFS does it far more efficiently in O(V + E).',
  },
  {
    topic: 'JavaScript Engine Internals',
    title: 'DEFAULT ARRAY SORTING BEHAVIOR',
    statement:
      'Calling array.sort() without a comparator sorts numbers in ascending numeric order (e.g. [10, 2, 5] becomes [2, 5, 10]).',
    codeSnippet: 'const numbers = [10, 2, 5];\nnumbers.sort(); // evaluates to [2, 5, 10]?',
    isCorrect: false,
    explanation:
      'In JavaScript, array.sort() casts elements to strings and compares lexicographically, sorting [10, 2, 5] into [10, 2, 5]. A comparator (a, b) => a - b is required.',
  },
  {
    topic: 'Time & Space Complexity',
    title: 'IMMUTABLE REDUCE ACCUMULATOR',
    statement:
      'Using `arr.reduce((acc, x) => [...acc, x], [])` preserves immutability and runs in optimal O(N) linear time for an array of size N.',
    codeSnippet: 'const copy = arr.reduce((acc, x) => [...acc, x], []);',
    isCorrect: false,
    explanation:
      'Spreading `[...acc, x]` copies the entire accumulator on every iteration, leading to O(N^2) quadratic runtime and heavy memory allocation.',
  },
  {
    topic: 'Memory & Object References',
    title: 'OBJECT.ASSIGN CLONING',
    statement:
      'Object.assign({}, original) creates a deep clone of all nested objects and arrays so mutating properties in the copy never affects the original.',
    codeSnippet: 'const cloned = Object.assign({}, originalState);',
    isCorrect: false,
    explanation:
      'Object.assign() only creates a shallow clone. Nested objects still share the same memory references.',
  },
  {
    topic: 'Floating Point Precision',
    title: 'IEEE 754 ARITHMETIC',
    statement:
      'In JavaScript and Python, evaluating `0.1 + 0.2 === 0.3` returns false due to binary floating-point rounding precision.',
    codeSnippet: 'console.log(0.1 + 0.2 === 0.3); // false',
    isCorrect: true,
    explanation:
      '0.1 and 0.2 cannot be represented precisely in binary IEEE 754, resulting in 0.30000000000000004.',
  },
  {
    topic: 'Binary Search Edge Cases',
    title: 'MIDPOINT OVERFLOW PREVENTION',
    statement:
      'In 32-bit integer arithmetic, calculating `(low + high) / 2` can trigger integer overflow when low + high exceeds 2^31 - 1, so `low + (high - low) / 2` should be used instead.',
    codeSnippet: 'const mid = low + Math.floor((high - low) / 2);',
    isCorrect: true,
    explanation:
      'When low and high are large positive integers, low + high can overflow signed 32-bit range. The subtraction form prevents this classic bug.',
  },
  {
    topic: 'Recursion & Call Stacks',
    title: 'BASE CASE TERMINATION',
    statement:
      'Any recursive function that decrements its argument by 1 will always terminate without stack overflow as long as n starts positive.',
    codeSnippet: 'function recurse(n) {\n  if (n === 0) return 0;\n  return recurse(n - 1);\n}',
    isCorrect: false,
    explanation:
      'If n is passed as a float (e.g. 5.5) or a non-integer, `n === 0` is bypassed, causing infinite recursion and stack overflow.',
  },
  {
    topic: 'Asynchronous Event Loop',
    title: 'MICROTASKS VS MACROTASKS',
    statement:
      'Promise callbacks queued in `.then()` execute before `setTimeout(fn, 0)` callbacks in the same turn of the JavaScript event loop.',
    codeSnippet: 'Promise.resolve().then(() => console.log("A"));\nsetTimeout(() => console.log("B"), 0);',
    isCorrect: true,
    explanation:
      'Promises use the Microtask queue, which is processed before the Macrotask (timer) queue.',
  },
];

/**
 * Check if a player currently has false insight immunity.
 */
export function isUserImmuneToFalseInsight(userId: string): boolean {
  const expiresAt = userImmunities.get(userId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    userImmunities.delete(userId);
    return false;
  }
  return true;
}

/**
 * Create a new False Insight sabotage instance targeted at a specific player.
 */
export function createFalseInsightSabotage(
  roomCode: string,
  imposterUserId: string,
  targetUserId: string,
  durationMs: number = 25000
): { clientData: ClientFalseInsightData } {
  // Clear any existing active insight for this user
  const existingId = userActiveInsights.get(targetUserId);
  if (existingId) {
    activeInsights.delete(existingId);
    userActiveInsights.delete(targetUserId);
  }

  const template = INSIGHT_TEMPLATES[Math.floor(Math.random() * INSIGHT_TEMPLATES.length)];
  const insightId = `insight_${randomUUID()}`;
  const expiresAt = Date.now() + durationMs;

  const internal: InternalFalseInsight = {
    insightId,
    targetUserId,
    roomCode,
    imposterUserId,
    topic: template.topic,
    title: template.title,
    statement: template.statement,
    codeSnippet: template.codeSnippet,
    isCorrect: template.isCorrect,
    explanation: template.explanation,
    durationMs,
    expiresAt,
    answered: false,
  };

  activeInsights.set(insightId, internal);
  userActiveInsights.set(targetUserId, insightId);

  return {
    clientData: {
      insightId,
      targetUserId,
      topic: internal.topic,
      title: internal.title,
      statement: internal.statement,
      codeSnippet: internal.codeSnippet,
      durationMs,
      expiresAt,
    },
  };
}

/**
 * Verify a player's response to an AI False Insight.
 */
export function verifyInsightResponse(
  insightId: string,
  targetUserId: string,
  choice: 'accept' | 'reject'
): FalseInsightResult {
  const insight = activeInsights.get(insightId);
  if (!insight || insight.targetUserId !== targetUserId) {
    return {
      valid: false,
      xpGained: 0,
      message: 'Insight expired or already resolved.',
      explanation: '',
    };
  }

  if (Date.now() > insight.expiresAt) {
    activeInsights.delete(insightId);
    userActiveInsights.delete(targetUserId);
    return {
      valid: false,
      xpGained: 0,
      message: 'Insight deliberation period expired.',
      explanation: insight.explanation,
    };
  }

  insight.answered = true;
  activeInsights.delete(insightId);
  userActiveInsights.delete(targetUserId);

  const wasCorrect = insight.isCorrect;

  // Case 1: Target rejected false information (Critical thinking victory!)
  if (choice === 'reject' && !wasCorrect) {
    // Grant 45s immunity to future false insights
    userImmunities.set(targetUserId, Date.now() + 45000);
    return {
      valid: true,
      choice,
      wasCorrect,
      fellForTrick: false,
      xpGained: 50,
      imposterUserId: insight.imposterUserId,
      message: 'Critical Thinking Bonus! You correctly detected the flawed recommendation.',
      explanation: insight.explanation,
    };
  }

  // Case 2: Target accepted correct information (Recognized sound logic)
  if (choice === 'accept' && wasCorrect) {
    return {
      valid: true,
      choice,
      wasCorrect,
      fellForTrick: false,
      xpGained: 30,
      imposterUserId: insight.imposterUserId,
      message: 'Sound Logic! You correctly validated a genuine engineering principle.',
      explanation: insight.explanation,
    };
  }

  // Case 3: Target accepted false information (Fell for the Impostor's trick)
  if (choice === 'accept' && !wasCorrect) {
    return {
      valid: true,
      choice,
      wasCorrect,
      fellForTrick: true,
      xpGained: 0,
      debuffDurationMs: 15000, // 15s test runner debuff
      imposterUserId: insight.imposterUserId,
      message: 'Misinformation Accepted! The recommendation contained a subtle fallacy.',
      explanation: insight.explanation,
    };
  }

  // Case 4: Target rejected valid information
  return {
    valid: true,
    choice,
    wasCorrect,
    fellForTrick: false,
    xpGained: 0,
    imposterUserId: insight.imposterUserId,
    message: 'Valid advice was dismissed. The recommendation was actually correct.',
    explanation: insight.explanation,
  };
}

/**
 * Get active insight for a target user if any.
 */
export function getActiveInsightForUser(userId: string): ClientFalseInsightData | null {
  const insightId = userActiveInsights.get(userId);
  if (!insightId) return null;
  const item = activeInsights.get(insightId);
  if (!item || Date.now() > item.expiresAt) {
    if (item) activeInsights.delete(insightId);
    userActiveInsights.delete(userId);
    return null;
  }
  return {
    insightId: item.insightId,
    targetUserId: item.targetUserId,
    topic: item.topic,
    title: item.title,
    statement: item.statement,
    codeSnippet: item.codeSnippet,
    durationMs: item.durationMs,
    expiresAt: item.expiresAt,
  };
}
