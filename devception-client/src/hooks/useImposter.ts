'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';

interface CooldownState {
  bug: number;
  blur: number;
  hint: number;
  lock: number;
  puzzle: number;
  falseInsight: number;
}

export function useImposter(socket: AppSocket | null, roomCode: string) {
  const [cooldowns, setCooldowns] = useState<CooldownState>({
    bug: 0,
    blur: 0,
    hint: 0,
    lock: 0,
    puzzle: 0,
    falseInsight: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setSabotageStatus, sabotageStatus } = useGameStore();

  useEffect(() => {
    if (!socket) return;

    socket.on('imposter:cooldown-update', ({ remainingMs, startCooldown, cooldownMs }) => {
      if (startCooldown && cooldownMs) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // All abilities share the same unified cooldown
        setCooldowns({
          bug: cooldownMs,
          blur: cooldownMs,
          hint: cooldownMs,
          lock: cooldownMs,
          puzzle: cooldownMs,
          falseInsight: cooldownMs,
        });
        intervalRef.current = setInterval(() => {
          setCooldowns((prev) => {
            const next = Math.max(0, prev.bug - 1000);
            if (next <= 0) {
              clearInterval(intervalRef.current!);
              intervalRef.current = null;
              return {
                bug: 0,
                blur: 0,
                hint: 0,
                lock: 0,
                puzzle: 0,
                falseInsight: 0,
              };
            }
            return {
              bug: next,
              blur: next,
              hint: next,
              lock: next,
              puzzle: next,
              falseInsight: next,
            };
          });
        }, 1000);
      } else {
        setCooldowns({
          bug: remainingMs,
          blur: remainingMs,
          hint: remainingMs,
          lock: remainingMs,
          puzzle: remainingMs,
          falseInsight: remainingMs,
        });
      }
    });

    socket.on('imposter:sabotage-status', (status) => {
      setSabotageStatus(status);
      if (status.status === 'solved' || status.status === 'expired') {
        setTimeout(() => {
          setSabotageStatus(null);
        }, 5000);
      }
    });

    return () => {
      socket.off('imposter:cooldown-update');
      socket.off('imposter:sabotage-status');
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [socket, setSabotageStatus]);

  const injectBug = useCallback(() => {
    socket?.emit('imposter:inject-bug', { roomCode });
  }, [socket, roomCode]);

  const blurScreen = useCallback(
    (targetUserId: string) => {
      socket?.emit('imposter:blur-screen', { roomCode, targetUserId });
    },
    [socket, roomCode]
  );

  const variableShadow = useCallback(() => {
    socket?.emit('imposter:variable-shadow', { roomCode });
  }, [socket, roomCode]);

  const lockKeyboard = useCallback(
    (targetUserId: string) => {
      socket?.emit('imposter:lock-keyboard', { roomCode, targetUserId });
    },
    [socket, roomCode]
  );

  const puzzleLock = useCallback(
    (targetUserId: string) => {
      socket?.emit('imposter:puzzle-lock', { roomCode, targetUserId });
    },
    [socket, roomCode]
  );

  const falseInsight = useCallback(
    (targetUserId: string) => {
      socket?.emit('imposter:false-insight', { roomCode, targetUserId });
    },
    [socket, roomCode]
  );

  return {
    cooldowns,
    injectBug,
    blurScreen,
    variableShadow,
    lockKeyboard,
    puzzleLock,
    falseInsight,
    sabotageStatus,
  };
}
