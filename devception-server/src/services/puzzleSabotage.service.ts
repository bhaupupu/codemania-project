import { randomUUID } from 'crypto';

export type PuzzleType = 'matrix' | 'sequence' | 'anomaly';

export interface PuzzleOption {
  id: string;
  label: string;
  visual: string; // SVG icon identifier or ASCII glyph pattern
}

export interface ClientPuzzleData {
  puzzleId: string;
  targetUserId: string;
  type: PuzzleType;
  title: string;
  prompt: string;
  grid?: string[][];
  sequence?: string[];
  items?: string[];
  options: PuzzleOption[];
  durationMs: number;
  expiresAt: number;
}

interface InternalPuzzle extends ClientPuzzleData {
  correctOptionId: string;
  roomCode: string;
  imposterUserId: string;
}

// In-memory active puzzles: puzzleId -> InternalPuzzle
const activePuzzles = new Map<string, InternalPuzzle>();
// targetUserId -> puzzleId mapping
const userActivePuzzles = new Map<string, string>();

const PUZZLE_TEMPLATES: Array<{
  type: PuzzleType;
  title: string;
  prompt: string;
  generate: () => {
    grid?: string[][];
    sequence?: string[];
    items?: string[];
    options: PuzzleOption[];
    correctOptionId: string;
  };
}> = [
  // 1. Matrix Pattern: Binary Node Matrix
  {
    type: 'matrix',
    title: 'CRYPTOGRAPHIC NODE MATRIX',
    prompt: 'Identify the missing node in the 3x3 security matrix to decrypt buffer.',
    generate: () => {
      const sets = [
        {
          grid: [
            ['◆', '▲', '●'],
            ['▲', '●', '◆'],
            ['●', '◆', '?'],
          ],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '▲' },
            { id: 'opt_2', label: 'Option B', visual: '■' },
            { id: 'opt_3', label: 'Option C', visual: '★' },
            { id: 'opt_4', label: 'Option D', visual: '●' },
          ],
          correct: 'opt_1',
        },
        {
          grid: [
            ['10', '01', '11'],
            ['01', '11', '10'],
            ['11', '10', '?'],
          ],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '00' },
            { id: 'opt_2', label: 'Option B', visual: '01' },
            { id: 'opt_3', label: 'Option C', visual: '11' },
            { id: 'opt_4', label: 'Option D', visual: '10' },
          ],
          correct: 'opt_2',
        },
        {
          grid: [
            ['[ + ]', '[ ++ ]', '[ +++ ]'],
            ['[ - ]', '[ -- ]', '[ --- ]'],
            ['[ * ]', '[ ** ]', '?'],
          ],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '[ *** ]' },
            { id: 'opt_2', label: 'Option B', visual: '[ * ]' },
            { id: 'opt_3', label: 'Option C', visual: '[ **** ]' },
            { id: 'opt_4', label: 'Option D', visual: '[ / ]' },
          ],
          correct: 'opt_1',
        },
      ];
      const picked = sets[Math.floor(Math.random() * sets.length)];
      return {
        grid: picked.grid,
        options: picked.options,
        correctOptionId: picked.correct,
      };
    },
  },

  // 2. Sequence Progression: Signal Sequence
  {
    type: 'sequence',
    title: 'QUANTUM SIGNAL SEQUENCE',
    prompt: 'Determine the next glyph to align the decryption frequency.',
    generate: () => {
      const seqSets = [
        {
          sequence: ['◰', '◱', '◲', '◳', '?'],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '◰' },
            { id: 'opt_2', label: 'Option B', visual: '◱' },
            { id: 'opt_3', label: 'Option C', visual: '■' },
            { id: 'opt_4', label: 'Option D', visual: '◲' },
          ],
          correct: 'opt_1',
        },
        {
          sequence: ['0x1', '0x2', '0x4', '0x8', '?'],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '0x10' },
            { id: 'opt_2', label: 'Option B', visual: '0x16' },
            { id: 'opt_3', label: 'Option C', visual: '0x12' },
            { id: 'opt_4', label: 'Option D', visual: '0x9' },
          ],
          correct: 'opt_1',
        },
        {
          sequence: ['⟨ | ⟩', '⟨ || ⟩', '⟨ ||| ⟩', '?'],
          options: [
            { id: 'opt_1', label: 'Option A', visual: '⟨ |||| ⟩' },
            { id: 'opt_2', label: 'Option B', visual: '⟨ | ⟩' },
            { id: 'opt_3', label: 'Option C', visual: '⟨ - ⟩' },
            { id: 'opt_4', label: 'Option D', visual: '⟨ || ⟩' },
          ],
          correct: 'opt_1',
        },
      ];
      const picked = seqSets[Math.floor(Math.random() * seqSets.length)];
      return {
        sequence: picked.sequence,
        options: picked.options,
        correctOptionId: picked.correct,
      };
    },
  },

  // 3. Anomaly Detection: Corrupted Glyph
  {
    type: 'anomaly',
    title: 'CORRUPTED MEMORY SECTOR',
    prompt: 'Locate the single corrupt/inverted packet that does NOT match the parity.',
    generate: () => {
      const anomSets = [
        {
          items: ['0xF0', '0xF1', '0xF3', '0x0F', '0xF7'],
          options: [
            { id: 'opt_1', label: 'Packet 1', visual: '0xF0' },
            { id: 'opt_2', label: 'Packet 2', visual: '0xF1' },
            { id: 'opt_3', label: 'Packet 3', visual: '0xF3' },
            { id: 'opt_4', label: 'Packet 4', visual: '0x0F' },
          ],
          correct: 'opt_4',
        },
        {
          items: ['[ 0001 ]', '[ 0010 ]', '[ 0100 ]', '[ 1111 ]'],
          options: [
            { id: 'opt_1', label: 'Cell A', visual: '[ 0001 ]' },
            { id: 'opt_2', label: 'Cell B', visual: '[ 0010 ]' },
            { id: 'opt_3', label: 'Cell C', visual: '[ 0100 ]' },
            { id: 'opt_4', label: 'Cell D', visual: '[ 1111 ]' },
          ],
          correct: 'opt_4',
        },
      ];
      const picked = anomSets[Math.floor(Math.random() * anomSets.length)];
      return {
        items: picked.items,
        options: picked.options,
        correctOptionId: picked.correct,
      };
    },
  },
];

export function createPuzzleSabotage(
  roomCode: string,
  imposterUserId: string,
  targetUserId: string,
  durationMs: number = 30000
): { clientPuzzle: ClientPuzzleData; internalPuzzle: InternalPuzzle } {
  // Clear any existing puzzle for target
  const existingId = userActivePuzzles.get(targetUserId);
  if (existingId) {
    activePuzzles.delete(existingId);
    userActivePuzzles.delete(targetUserId);
  }

  const template = PUZZLE_TEMPLATES[Math.floor(Math.random() * PUZZLE_TEMPLATES.length)];
  const generated = template.generate();
  const puzzleId = `puzzle_${randomUUID()}`;
  const now = Date.now();
  const expiresAt = now + durationMs;

  const clientPuzzle: ClientPuzzleData = {
    puzzleId,
    targetUserId,
    type: template.type,
    title: template.title,
    prompt: template.prompt,
    grid: generated.grid,
    sequence: generated.sequence,
    items: generated.items,
    options: generated.options,
    durationMs,
    expiresAt,
  };

  const internalPuzzle: InternalPuzzle = {
    ...clientPuzzle,
    correctOptionId: generated.correctOptionId,
    roomCode,
    imposterUserId,
  };

  activePuzzles.set(puzzleId, internalPuzzle);
  userActivePuzzles.set(targetUserId, puzzleId);

  return { clientPuzzle, internalPuzzle };
}

export function getActivePuzzleForUser(userId: string): ClientPuzzleData | null {
  const puzzleId = userActivePuzzles.get(userId);
  if (!puzzleId) return null;
  const internal = activePuzzles.get(puzzleId);
  if (!internal) {
    userActivePuzzles.delete(userId);
    return null;
  }
  if (Date.now() > internal.expiresAt) {
    activePuzzles.delete(puzzleId);
    userActivePuzzles.delete(userId);
    return null;
  }
  // Return client-safe copy
  const { correctOptionId, imposterUserId, roomCode, ...safe } = internal;
  return safe;
}

export function verifyPuzzleSolution(
  puzzleId: string,
  userId: string,
  selectedOptionId: string
): { valid: boolean; correct: boolean; imposterUserId?: string; roomCode?: string } {
  const puzzle = activePuzzles.get(puzzleId);
  if (!puzzle || puzzle.targetUserId !== userId) {
    return { valid: false, correct: false };
  }

  if (Date.now() > puzzle.expiresAt) {
    activePuzzles.delete(puzzleId);
    userActivePuzzles.delete(userId);
    return { valid: false, correct: false };
  }

  const isCorrect = puzzle.correctOptionId === selectedOptionId;
  if (isCorrect) {
    activePuzzles.delete(puzzleId);
    userActivePuzzles.delete(userId);
    return {
      valid: true,
      correct: true,
      imposterUserId: puzzle.imposterUserId,
      roomCode: puzzle.roomCode,
    };
  }

  return {
    valid: true,
    correct: false,
    imposterUserId: puzzle.imposterUserId,
    roomCode: puzzle.roomCode,
  };
}

export function clearPuzzle(puzzleId: string): void {
  const puzzle = activePuzzles.get(puzzleId);
  if (puzzle) {
    userActivePuzzles.delete(puzzle.targetUserId);
    activePuzzles.delete(puzzleId);
  }
}
