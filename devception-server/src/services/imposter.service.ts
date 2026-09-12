import { getLiveGame } from './game.service';
import { env } from '../config/env';

export type ImposterAction = 'bug' | 'blur' | 'hint' | 'lock' | 'puzzle' | 'falseInsight';

// In-memory cooldown tracker for abilities that share or extend the cooldown
const abilityCooldowns = new Map<string, number>(); // roomCode -> lastUsedTimestamp

export function checkCooldown(
  roomCode: string,
  action: ImposterAction
): { allowed: boolean; remainingMs: number } {
  const game = getLiveGame(roomCode);
  // Use per-game cooldown setting, fallback to env defaults
  const gameCooldownMs = game?.settings?.impostorCooldownMs ?? env.IMPOSTER_BLUR_COOLDOWN_MS;

  if (action === 'lock' || action === 'puzzle' || action === 'falseInsight') {
    const lastAt = abilityCooldowns.get(roomCode);
    if (!lastAt) return { allowed: true, remainingMs: 0 };
    const remaining = gameCooldownMs - (Date.now() - lastAt);
    return { allowed: remaining <= 0, remainingMs: Math.max(0, remaining) };
  }

  if (!game) return { allowed: false, remainingMs: 0 };

  const { imposterActions } = game;
  const now = Date.now();
  let lastAt: Date | null;

  if (action === 'bug') {
    lastAt = imposterActions.lastBugInjectedAt;
  } else if (action === 'blur') {
    lastAt = imposterActions.lastBlurAt;
  } else {
    lastAt = imposterActions.lastHintAt;
  }

  if (!lastAt) return { allowed: true, remainingMs: 0 };

  const elapsed = now - lastAt.getTime();
  const remaining = gameCooldownMs - elapsed;
  return { allowed: remaining <= 0, remainingMs: Math.max(0, remaining) };
}

export function recordAction(roomCode: string, _action: ImposterAction): void {
  // Shared cooldown — any ability used locks ALL abilities
  const now = new Date();
  abilityCooldowns.set(roomCode, Date.now());

  const game = getLiveGame(roomCode);
  if (!game) return;

  game.imposterActions.lastBugInjectedAt = now;
  game.imposterActions.lastBlurAt = now;
  game.imposterActions.lastHintAt = now;
}

export function resetCooldownForTest(roomCode: string): void {
  abilityCooldowns.delete(roomCode);
  const game = getLiveGame(roomCode);
  if (game) {
    game.imposterActions.lastBugInjectedAt = null;
    game.imposterActions.lastBlurAt = null;
    game.imposterActions.lastHintAt = null;
  }
}
