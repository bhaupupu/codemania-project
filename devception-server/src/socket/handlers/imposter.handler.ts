import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import * as gameService from '../../services/game.service';
import * as imposterService from '../../services/imposter.service';
import { pickBugMutation, pickShadowMutation } from '../../utils/bugMutator';
import * as puzzleSabotageService from '../../services/puzzleSabotage.service';
import * as falseInsightService from '../../services/falseInsight.service';
import { logger } from '../../utils/logger';

export function registerImposterHandlers(io: Server, socket: AuthenticatedSocket): void {
  // Inject Bug — server picks a believable mutation against the live shared
  // code (comparator flip, off-by-one, missing await, wrong-return, …) and
  // applies it as a normal editor op. The client used to supply the bug text
  // directly which (a) was easy to spot and (b) couldn't sit in the right
  // language. The client payload is now ignored entirely.
  socket.on(
    'imposter:inject-bug',
    ({ roomCode }: { roomCode: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player || player.role !== 'imposter') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'bug');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'bug', remainingMs });
        return;
      }

      let applied = false;
      if (game) {
        const mutation = pickBugMutation(game.language, game.sharedCode);
        if (mutation) {
          const op = {
            rangeOffset: mutation.rangeOffset,
            rangeLength: mutation.rangeLength,
            text: mutation.text,
          };
          const result = gameService.updateSharedCode(roomCode, [op], game.editorVersion, socket.userId);
          if (result.accepted) {
            io.to(roomCode).emit('editor:op-apply', {
              userId: 'imposter',
              ops: [op],
              version: result.currentVersion,
            });
            io.to(roomCode).emit('imposter:bug-injected', { affectedLine: mutation.affectedLine });
            logger.debug(`[imposter ${roomCode}] inject-bug ${mutation.description} @line=${mutation.affectedLine}`);
            applied = true;
          }
        }
      }

      // Whether or not we found a site to mutate, charging the cooldown is the
      // right behavior — otherwise an imposter could probe for "no eligible
      // sites" and effectively get a free check on the codebase shape.
      imposterService.recordAction(roomCode, 'bug');
      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'bug', remainingMs: 0, startCooldown: true, cooldownMs: sharedCooldownMs,
        applied,
      });
    }
  );

  socket.on(
    'imposter:blur-screen',
    ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player || player.role !== 'imposter') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'blur');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'blur', remainingMs });
        return;
      }

      imposterService.recordAction(roomCode, 'blur');

      const targetPlayer = game?.players.find((p) => p.userId === targetUserId);
      // Never blur another imposter's screen
      if (targetPlayer && targetPlayer.role !== 'imposter') {
        const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
        targetSocket?.emit('imposter:screen-blurred', { durationMs: 8000 });
      }

      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'blur', remainingMs: 0, startCooldown: true, cooldownMs: sharedCooldownMs,
      });
    }
  );

  // Variable Shadow — replaces the old "False Hint" sabotage. Inserts a single
  // line that re-binds an existing variable to None/null right after its
  // original assignment. Reads downstream of the assignment now see the wiped
  // value, producing a quiet, subtle failure that's easy to miss in a diff.
  socket.on(
    'imposter:variable-shadow',
    ({ roomCode }: { roomCode: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player || player.role !== 'imposter') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'hint');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'hint', remainingMs });
        return;
      }

      let applied = false;
      if (game) {
        const mutation = pickShadowMutation(game.language, game.sharedCode);
        if (mutation) {
          const op = {
            rangeOffset: mutation.rangeOffset,
            rangeLength: mutation.rangeLength,
            text: mutation.text,
          };
          const result = gameService.updateSharedCode(roomCode, [op], game.editorVersion, socket.userId);
          if (result.accepted) {
            io.to(roomCode).emit('editor:op-apply', {
              userId: 'imposter',
              ops: [op],
              version: result.currentVersion,
            });
            io.to(roomCode).emit('imposter:bug-injected', { affectedLine: mutation.affectedLine });
            logger.debug(`[imposter ${roomCode}] variable-shadow ${mutation.description} @line=${mutation.affectedLine}`);
            applied = true;
          }
        }
      }

      imposterService.recordAction(roomCode, 'hint');
      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'hint', remainingMs: 0, startCooldown: true, cooldownMs: sharedCooldownMs,
        applied,
      });
    }
  );

  // Lock a player's keyboard for 15 seconds
  socket.on(
    'imposter:lock-keyboard',
    ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player || player.role !== 'imposter') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'lock');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'lock', remainingMs });
        return;
      }

      imposterService.recordAction(roomCode, 'lock');

      const targetPlayer = game?.players.find((p) => p.userId === targetUserId);
      // Never lock another imposter
      if (targetPlayer && targetPlayer.role !== 'imposter') {
        const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
        targetSocket?.emit('imposter:keyboard-locked', { durationMs: 15000 });
      }

      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'lock', remainingMs: 0, startCooldown: true, cooldownMs: sharedCooldownMs,
      });
    }
  );

  // ─── Sabotage: Puzzle Lock ──────────────────────────────────────────────────
  // Imposter locks a target developer with a 4×4 image unscrambling puzzle.
  // The target must solve the server-authoritative puzzle before resuming editing.
  socket.on(
    'imposter:puzzle-lock',
    ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player?.isAlive || player.role !== 'imposter' || game?.phase !== 'in-progress') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'puzzle');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'puzzle', remainingMs });
        return;
      }

      const targetPlayer = game?.players.find((p) => p.userId === targetUserId);
      if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.role === 'imposter') {
        return;
      }

      if (puzzleSabotageService.getActivePuzzleForUser(targetUserId, roomCode)) return;
      imposterService.recordAction(roomCode, 'puzzle');

      const durationMs = 20000; // Countdown target; only a verified solution unlocks.
      const { clientPuzzle } = puzzleSabotageService.createPuzzleSabotage(
        roomCode,
        socket.userId,
        targetUserId,
        durationMs
      );

      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      if (targetSocket) {
        targetSocket.emit('sabotage:puzzle-locked', clientPuzzle);
      }

      // Feedback to the imposter about the active sabotage
      socket.emit('imposter:sabotage-status', {
        targetUserId,
        targetName: targetPlayer.displayName,
        ability: 'puzzle-lock',
        status: 'active',
        expiresAt: clientPuzzle.expiresAt,
      });

      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'puzzle',
        remainingMs: 0,
        startCooldown: true,
        cooldownMs: sharedCooldownMs,
      });
      logger.info(`[sabotage ${roomCode}] Puzzle Lock activated on ${targetPlayer.displayName} (${targetUserId})`);
    }
  );

  // Target player submits solution for visual puzzle
  socket.on(
    'sabotage:puzzle-solve',
    ({ roomCode, puzzleId, arrangement }: { roomCode: string; puzzleId: string; arrangement: unknown }) => {
      const game = gameService.getLiveGame(roomCode);
      if (!game?.players.some(p => p.userId === socket.userId && p.isAlive)) return;
      const result = puzzleSabotageService.verifyPuzzleSolution(puzzleId, socket.userId, roomCode, arrangement);
      if (!result.valid) {
        socket.emit('sabotage:puzzle-attempt-result', {
          success: false,
          puzzleId, correctPositions: [], message: 'Invalid tile arrangement.',
        });
        return;
      }

      if (result.correct) {
        socket.emit('sabotage:puzzle-unlocked', {
          success: true,
          reason: 'solved', puzzleId,
          message: 'Puzzle solved! Workspace restored.',
        });

        // Notify imposter that target solved it
        if (result.imposterUserId) {
          const game = gameService.getLiveGame(roomCode);
          const imposterPlayer = game?.players.find((p) => p.userId === result.imposterUserId);
          if (imposterPlayer) {
            const imposterSocket = io.sockets.sockets.get(imposterPlayer.socketId);
            imposterSocket?.emit('imposter:sabotage-status', {
              targetUserId: socket.userId,
              targetName: socket.displayName,
              ability: 'puzzle-lock',
              status: 'solved',
            });
          }
        }
        logger.info(`[sabotage ${roomCode}] ${socket.displayName} correctly solved puzzle ${puzzleId}`);
      } else {
        socket.emit('sabotage:puzzle-attempt-result', {
          success: false,
          puzzleId, correctPositions: result.correctPositions,
          message: 'Keep rearranging the image.',
        });
      }
    }
  );

  // ─── Sabotage: False Insight ────────────────────────────────────────────────
  // Imposter sends plausible-looking advice with a subtle fallacy to deceive target
  socket.on(
    'imposter:false-insight',
    ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      const game = gameService.getLiveGame(roomCode);
      const player = game?.players.find((p) => p.userId === socket.userId);
      if (!player || player.role !== 'imposter') return;

      const { allowed, remainingMs } = imposterService.checkCooldown(roomCode, 'falseInsight');
      if (!allowed) {
        socket.emit('imposter:cooldown-update', { action: 'falseInsight', remainingMs });
        return;
      }

      const targetPlayer = game?.players.find((p) => p.userId === targetUserId);
      if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.role === 'imposter') {
        return;
      }

      // Check if target is currently immune
      if (falseInsightService.isUserImmuneToFalseInsight(targetUserId)) {
        socket.emit('imposter:cooldown-update', {
          action: 'falseInsight',
          remainingMs: 5000,
          applied: false,
        });
        return;
      }

      imposterService.recordAction(roomCode, 'falseInsight');

      const durationMs = 25000;
      const { clientData } = falseInsightService.createFalseInsightSabotage(
        roomCode,
        socket.userId,
        targetUserId,
        durationMs
      );

      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      if (targetSocket) {
        targetSocket.emit('sabotage:false-insight-received', clientData);
      }

      socket.emit('imposter:sabotage-status', {
        targetUserId,
        targetName: targetPlayer.displayName,
        ability: 'false-insight',
        status: 'active',
        expiresAt: clientData.expiresAt,
      });

      const sharedCooldownMs = game?.settings?.impostorCooldownMs ?? 45000;
      socket.emit('imposter:cooldown-update', {
        action: 'falseInsight',
        remainingMs: 0,
        startCooldown: true,
        cooldownMs: sharedCooldownMs,
      });
      logger.info(`[sabotage ${roomCode}] False Insight activated on ${targetPlayer.displayName} (${targetUserId})`);
    }
  );

  // Target responds to AI False Insight recommendation
  socket.on(
    'sabotage:insight-respond',
    ({ roomCode, insightId, choice }: { roomCode: string; insightId: string; choice: 'accept' | 'reject' }) => {
      const result = falseInsightService.verifyInsightResponse(insightId, socket.userId, choice);
      if (!result.valid) return;

      socket.emit('sabotage:false-insight-result', {
        success: result.valid,
        choice: result.choice ?? choice,
        wasCorrect: result.wasCorrect ?? false,
        xpGained: result.xpGained,
        debuffDurationMs: result.debuffDurationMs,
        message: result.message,
        explanation: result.explanation,
      });

      // Feedback to the imposter
      if (result.imposterUserId) {
        const game = gameService.getLiveGame(roomCode);
        const imposterPlayer = game?.players.find((p) => p.userId === result.imposterUserId);
        if (imposterPlayer) {
          const imposterSocket = io.sockets.sockets.get(imposterPlayer.socketId);
          imposterSocket?.emit('imposter:sabotage-status', {
            targetUserId: socket.userId,
            targetName: socket.displayName,
            ability: 'false-insight',
            status: result.fellForTrick ? 'active' : 'solved',
          });
        }
      }

      logger.info(
        `[sabotage ${roomCode}] ${socket.displayName} responded '${choice}' to insight (wasCorrect=${result.wasCorrect}, fellForTrick=${result.fellForTrick})`
      );
    }
  );
}
