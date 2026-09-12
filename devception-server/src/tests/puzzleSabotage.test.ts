import test from 'node:test';
import assert from 'node:assert/strict';
import * as puzzle from '../services/puzzleSabotage.service';
import { getAllLiveGames } from '../services/game.service';
import { registerImposterHandlers } from '../socket/handlers/imposter.handler';
import { registerEditorHandlers, clearYDoc } from '../socket/handlers/editor.handler';
import * as Y from 'yjs';

test('opaque 16-tile puzzle validates ownership, permutations, expiry and reconnect state', () => {
  const { clientPuzzle: client, internalPuzzle: internal } = puzzle.createPuzzleSabotage('TEST', 'imp', 'dev', -1);
  assert.equal(client.tiles.length, 16);
  assert.equal(new Set(client.arrangement).size, 16);
  assert.ok(client.arrangement.every((id, i) => id !== internal.correctOrder[i]));
  assert.ok(!('correctOrder' in client));
  assert.ok(!('roomCode' in client));
  for (const attempt of [true, undefined, [], Array(16).fill(client.arrangement[0]), Array(16).fill('foreign')]) {
    assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'dev', 'TEST', attempt).valid, false);
  }
  assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'other', 'TEST', internal.correctOrder).valid, false);
  assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'dev', 'OTHER', internal.correctOrder).valid, false);
  const next = [...client.arrangement]; [next[0], next[1]] = [next[1], next[0]];
  assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'dev', 'TEST', next).correct, false);
  assert.deepEqual(puzzle.getActivePuzzleForUser('dev', 'TEST')?.arrangement, next);
  assert.equal(puzzle.createPuzzleSabotage('TEST', 'imp', 'dev').clientPuzzle.puzzleId, client.puzzleId);
  assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'dev', 'TEST', internal.correctOrder).correct, true);
  assert.equal(puzzle.getActivePuzzleForUser('dev', 'TEST'), null);
  assert.equal(puzzle.verifyPuzzleSolution(client.puzzleId, 'dev', 'TEST', internal.correctOrder).valid, false);
});

test('Socket handlers enforce living targets, shared cooldown, editor lock and solution notifications', async () => {
  const roomCode = 'SOCKETTEST';
  const emitted: { user: string; event: string; data: any }[] = [];
  function socket(userId: string) {
    const handlers = new Map<string, Function>();
    return { userId, id: userId, displayName: userId, handlers,
      on: (event: string, fn: Function) => handlers.set(event, fn),
      emit: (event: string, data: any) => emitted.push({ user: userId, event, data }),
      to: () => ({ emit: () => {} }) };
  }
  const imp = socket('imp'), dev = socket('dev');
  const game: any = { phase: 'in-progress', sharedCode: 'original', settings: { impostorCooldownMs: 45000 },
    imposterActions: {}, players: [
      { userId: 'imp', socketId: 'imp', role: 'imposter', isAlive: true },
      { userId: 'dev', socketId: 'dev', displayName: 'Alex', role: 'good-coder', isAlive: true },
      { userId: 'dead', role: 'good-coder', isAlive: false },
    ] };
  getAllLiveGames().set(roomCode, game);
  const io: any = { sockets: { sockets: new Map([['imp', imp], ['dev', dev]]) } };
  registerImposterHandlers(io, imp as any); registerImposterHandlers(io, dev as any); registerEditorHandlers(io, dev as any);
  imp.handlers.get('imposter:puzzle-lock')!({ roomCode, targetUserId: 'dead' });
  assert.equal(emitted.length, 0);
  imp.handlers.get('imposter:puzzle-lock')!({ roomCode, targetUserId: 'dev' });
  assert.ok(emitted.some(e => e.user === 'dev' && e.event === 'sabotage:puzzle-locked'));
  const status = emitted.find(e => e.event === 'imposter:sabotage-status')!.data;
  assert.equal(status.targetName, 'Alex'); assert.ok(!('arrangement' in status));
  imp.handlers.get('imposter:puzzle-lock')!({ roomCode, targetUserId: 'dev' });
  assert.ok(emitted[emitted.length - 1].data.remainingMs > 0);
  const doc = new Y.Doc(); doc.getText('monaco').insert(0, 'hacked');
  await dev.handlers.get('editor:ydoc-sync')!({ roomCode, update: Y.encodeStateAsUpdate(doc).buffer });
  assert.equal(game.sharedCode, 'original');
  const { internalPuzzle } = puzzle.createPuzzleSabotage(roomCode, 'imp', 'dev');
  dev.handlers.get('sabotage:puzzle-solve')!({ roomCode, puzzleId: internalPuzzle.puzzleId, solved: true });
  assert.ok(puzzle.getActivePuzzleForUser('dev', roomCode));
  dev.handlers.get('sabotage:puzzle-solve')!({ roomCode, puzzleId: internalPuzzle.puzzleId, arrangement: internalPuzzle.correctOrder });
  assert.ok(emitted.some(e => e.user === 'dev' && e.event === 'sabotage:puzzle-unlocked'));
  assert.ok(emitted.some(e => e.user === 'imp' && e.data.status === 'solved'));
  await clearYDoc(roomCode); getAllLiveGames().delete(roomCode); doc.destroy();
});

