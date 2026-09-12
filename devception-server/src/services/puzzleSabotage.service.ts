import { randomInt, randomUUID } from 'crypto';
import images from '../assets/puzzle-images.json';

export interface ClientPuzzleData {
  puzzleId: string;
  targetUserId: string;
  tiles: { id: string; image: string }[];
  arrangement: string[];
  correctPositions: number[];
  durationMs: number;
  expiresAt: number;
}
interface InternalPuzzle extends ClientPuzzleData {
  correctOrder: string[];
  roomCode: string;
  imposterUserId: string;
}
const activePuzzles = new Map<string, InternalPuzzle>();
const key = (roomCode: string, userId: string) => JSON.stringify([roomCode, userId]);
function clientData(puzzle: InternalPuzzle): ClientPuzzleData {
  const { correctOrder, roomCode, imposterUserId, ...safe } = puzzle;
  return structuredClone(safe);
}
export function createPuzzleSabotage(roomCode: string, imposterUserId: string, targetUserId: string, durationMs = 20000) {
  const existing = activePuzzles.get(key(roomCode, targetUserId));
  if (existing) return { clientPuzzle: clientData(existing), internalPuzzle: existing };
  // Supplied photos are square-cropped and split offline. Only individual tiles
  // with fresh opaque IDs leave the server; no original image or coordinates.
  const tiles = images[randomInt(images.length)].map(image => ({ id: randomUUID(), image }));
  const correctOrder = tiles.map(tile => tile.id);
  do {
    for (let i = 15; i > 0; i--) {
      const j = randomInt(i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
  } while (tiles.some((tile, i) => tile.id === correctOrder[i]));
  const puzzle: InternalPuzzle = {
    puzzleId: randomUUID(), roomCode, imposterUserId, targetUserId,
    tiles, correctOrder, arrangement: tiles.map(tile => tile.id), correctPositions: [],
    durationMs, expiresAt: Date.now() + durationMs,
  };
  activePuzzles.set(key(roomCode, targetUserId), puzzle);
  return { clientPuzzle: clientData(puzzle), internalPuzzle: puzzle };
}
export function getActivePuzzleForUser(userId: string, roomCode: string): ClientPuzzleData | null {
  const puzzle = activePuzzles.get(key(roomCode, userId));
  return puzzle ? clientData(puzzle) : null;
}
export function getImposterPuzzles(userId: string, roomCode: string) {
  return [...activePuzzles.values()].filter(p => p.roomCode === roomCode && p.imposterUserId === userId)
    .map(p => ({ targetUserId: p.targetUserId, expiresAt: p.expiresAt }));
}
export function verifyPuzzleSolution(puzzleId: string, userId: string, roomCode: string, arrangement: unknown) {
  const puzzle = activePuzzles.get(key(roomCode, userId));
  if (!puzzle || puzzle.puzzleId !== puzzleId || !Array.isArray(arrangement) || arrangement.length !== 16 ||
      new Set(arrangement).size !== 16 || arrangement.some(id => typeof id !== 'string' || !puzzle.correctOrder.includes(id))) {
    return { valid: false, correct: false, correctPositions: [] as number[] };
  }
  puzzle.arrangement = [...arrangement];
  puzzle.correctPositions = arrangement.flatMap((id, i) => id === puzzle.correctOrder[i] ? [i] : []);
  const correct = puzzle.correctPositions.length === 16;
  if (correct) activePuzzles.delete(key(roomCode, userId));
  return { valid: true, correct, correctPositions: puzzle.correctPositions, imposterUserId: puzzle.imposterUserId, roomCode };
}
export function clearRoomPuzzles(roomCode: string) {
  for (const [id, puzzle] of activePuzzles) if (puzzle.roomCode === roomCode) activePuzzles.delete(id);
}
