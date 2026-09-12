'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';

interface Props {
  socket: AppSocket | null;
  roomCode: string;
}

export function PuzzleLockModal({ socket, roomCode }: Props) {
  const { activePuzzle, setActivePuzzle, setLocked } = useGameStore();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [penaltyLockout, setPenaltyLockout] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'error' | 'success' | 'info' | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(30);
  const penaltyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize timer with active puzzle expiration
  useEffect(() => {
    if (!activePuzzle) {
      setSelectedOptionId(null);
      setPenaltyLockout(false);
      setFeedbackMessage(null);
      setFeedbackType(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((activePuzzle.expiresAt - now) / 1000));
      setRemainingSecs(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [activePuzzle]);

  // Handle server responses to puzzle attempts and unlocks
  useEffect(() => {
    if (!socket) return;

    const handleUnlock = ({ success: _success, message }: { success: boolean; reason?: string; message: string }) => {
      setFeedbackType('success');
      setFeedbackMessage(message || 'Access granted. Workspace restored.');
      setTimeout(() => {
        setActivePuzzle(null);
        setLocked(false);
      }, 900);
    };

    const handleAttemptResult = ({ success, penaltyMs, message }: { success: boolean; penaltyMs?: number; message: string }) => {
      setIsSubmitting(false);
      if (!success) {
        setFeedbackType('error');
        setFeedbackMessage(message || 'Incorrect solution. Recalibrating security matrix...');
        setPenaltyLockout(true);
        if (penaltyTimerRef.current) clearTimeout(penaltyTimerRef.current);
        penaltyTimerRef.current = setTimeout(() => {
          setPenaltyLockout(false);
          setFeedbackMessage(null);
          setSelectedOptionId(null);
        }, penaltyMs || 2000);
      }
    };

    socket.on('sabotage:puzzle-unlocked', handleUnlock);
    socket.on('sabotage:puzzle-attempt-result', handleAttemptResult);

    return () => {
      socket.off('sabotage:puzzle-unlocked', handleUnlock);
      socket.off('sabotage:puzzle-attempt-result', handleAttemptResult);
      if (penaltyTimerRef.current) clearTimeout(penaltyTimerRef.current);
    };
  }, [socket, setActivePuzzle, setLocked]);

  const handleSubmit = useCallback(
    (optionId: string) => {
      if (!socket || !activePuzzle || penaltyLockout || isSubmitting) return;

      setSelectedOptionId(optionId);
      setIsSubmitting(true);
      setFeedbackMessage('Verifying cryptographic response...');
      setFeedbackType('info');

      socket.emit('sabotage:puzzle-solve', {
        roomCode,
        puzzleId: activePuzzle.puzzleId,
        selectedOptionId: optionId,
      });
    },
    [socket, activePuzzle, penaltyLockout, isSubmitting, roomCode]
  );

  if (!activePuzzle) return null;

  const totalDuration = (activePuzzle.durationMs || 30000) / 1000;
  const progressPct = Math.min(100, Math.max(0, (remainingSecs / totalDuration) * 100));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(10, 10, 15, 0.88)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.92, y: 15 }}
          animate={{
            scale: 1,
            y: 0,
            x: penaltyLockout ? [-8, 8, -6, 6, -3, 3, 0] : 0,
          }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: '#0d1117',
            border: penaltyLockout ? '2px solid #ef4444' : '2px solid #38bdf8',
            boxShadow: penaltyLockout
              ? '0 0 35px rgba(239, 68, 68, 0.4)'
              : '0 0 35px rgba(56, 189, 248, 0.25)',
          }}
        >
          {/* Header Banner */}
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{
              background: penaltyLockout
                ? 'linear-gradient(90deg, rgba(239,68,68,0.25), rgba(15,23,42,0.8))'
                : 'linear-gradient(90deg, rgba(56,189,248,0.15), rgba(15,23,42,0.8))',
              borderColor: penaltyLockout ? 'rgba(239,68,68,0.4)' : 'rgba(56,189,248,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">🧩</span>
              <div>
                <p
                  className="font-bold text-xs uppercase tracking-widest"
                  style={{
                    color: penaltyLockout ? '#ef4444' : '#38bdf8',
                    fontFamily: 'Press Start 2P, monospace',
                  }}
                >
                  SABOTAGE DETECTED
                </p>
                <h3 className="text-white font-bold text-sm tracking-wide">
                  {activePuzzle.title}
                </h3>
              </div>
            </div>

            {/* Countdown Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs"
              style={{
                background: remainingSecs <= 10 ? 'rgba(239,68,68,0.2)' : 'rgba(15,23,42,0.8)',
                borderColor: remainingSecs <= 10 ? '#ef4444' : 'rgba(255,255,255,0.1)',
                color: remainingSecs <= 10 ? '#ef4444' : '#94a3b8',
              }}
            >
              <span>⏱</span>
              <span>{remainingSecs}s</span>
            </div>
          </div>

          {/* Progress Countdown Bar */}
          <div className="w-full h-1.5 bg-slate-900 overflow-hidden">
            <motion.div
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
              style={{
                height: '100%',
                background:
                  remainingSecs <= 8
                    ? '#ef4444'
                    : 'linear-gradient(90deg, #38bdf8, #818cf8)',
              }}
            />
          </div>

          {/* Prompt & Instructions */}
          <div className="px-6 pt-5 pb-3">
            <p className="text-sm font-medium text-slate-300">
              {activePuzzle.prompt}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Your editor is locked. Select the correct element to bypass the security lock.
            </p>
          </div>

          {/* Visual Puzzle Area */}
          <div className="px-6 py-4 flex flex-col items-center justify-center">
            {/* 1. Matrix View */}
            {activePuzzle.type === 'matrix' && activePuzzle.grid && (
              <div
                className="grid grid-cols-3 gap-2.5 p-4 rounded-xl border border-slate-700/60"
                style={{ background: 'rgba(15, 23, 42, 0.75)' }}
              >
                {activePuzzle.grid.map((row, rowIdx) =>
                  row.map((cell, colIdx) => {
                    const isTarget = cell === '?';
                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center font-bold text-xl sm:text-2xl transition-all"
                        style={{
                          background: isTarget
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(30, 41, 59, 0.7)',
                          border: isTarget
                            ? '2px dashed #f59e0b'
                            : '1px solid rgba(148, 163, 184, 0.2)',
                          color: isTarget ? '#fbbf24' : '#f8fafc',
                          fontFamily: 'monospace',
                        }}
                      >
                        {isTarget ? (
                          <motion.span
                            animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                          >
                            ?
                          </motion.span>
                        ) : (
                          cell
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 2. Sequence View */}
            {activePuzzle.type === 'sequence' && activePuzzle.sequence && (
              <div
                className="flex items-center gap-2 sm:gap-3 p-4 rounded-xl border border-slate-700/60 overflow-x-auto max-w-full"
                style={{ background: 'rgba(15, 23, 42, 0.75)' }}
              >
                {activePuzzle.sequence.map((item, idx) => {
                  const isTarget = item === '?';
                  return (
                    <div key={`seq-${idx}`} className="flex items-center gap-2">
                      <div
                        className="min-w-14 h-16 px-3 rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl font-mono"
                        style={{
                          background: isTarget
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(30, 41, 59, 0.7)',
                          border: isTarget
                            ? '2px dashed #f59e0b'
                            : '1px solid rgba(148, 163, 184, 0.2)',
                          color: isTarget ? '#fbbf24' : '#f8fafc',
                        }}
                      >
                        {isTarget ? '?' : item}
                      </div>
                      {idx < activePuzzle.sequence!.length - 1 && (
                        <span className="text-slate-500 font-mono text-sm">→</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Anomaly View */}
            {activePuzzle.type === 'anomaly' && activePuzzle.items && (
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-700/60 w-full"
                style={{ background: 'rgba(15, 23, 42, 0.75)' }}
              >
                {activePuzzle.items.map((item, idx) => (
                  <div
                    key={`item-${idx}`}
                    className="h-20 rounded-lg flex flex-col items-center justify-center font-mono font-bold text-lg"
                    style={{
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      color: '#f8fafc',
                    }}
                  >
                    <span className="text-xs text-slate-500 mb-1">
                      [{String.fromCharCode(65 + idx)}]
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Answer Options Grid */}
          <div className="px-6 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Matching Pattern:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {activePuzzle.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    whileHover={!penaltyLockout && !isSubmitting ? { scale: 1.03 } : {}}
                    whileTap={!penaltyLockout && !isSubmitting ? { scale: 0.97 } : {}}
                    onClick={() => handleSubmit(opt.id)}
                    disabled={penaltyLockout || isSubmitting}
                    className="p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all"
                    style={{
                      background: isSelected
                        ? 'rgba(56, 189, 248, 0.2)'
                        : 'rgba(30, 41, 59, 0.6)',
                      borderColor: isSelected
                        ? '#38bdf8'
                        : 'rgba(148, 163, 184, 0.25)',
                      cursor: penaltyLockout || isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: penaltyLockout ? 0.6 : 1,
                    }}
                  >
                    <span className="text-xl sm:text-2xl font-mono text-white">
                      {opt.visual}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {opt.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Feedback & Alert Footer */}
          <div
            className="px-6 py-3 border-t flex items-center justify-between min-h-12"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(148, 163, 184, 0.15)',
            }}
          >
            <div className="flex-1 text-xs font-medium">
              {feedbackMessage && (
                <p
                  style={{
                    color:
                      feedbackType === 'error'
                        ? '#ef4444'
                        : feedbackType === 'success'
                        ? '#22c55e'
                        : '#38bdf8',
                  }}
                >
                  {feedbackType === 'error' && '⚠️ '}
                  {feedbackType === 'success' && '✅ '}
                  {feedbackType === 'info' && '⏳ '}
                  {feedbackMessage}
                </p>
              )}
              {!feedbackMessage && (
                <p className="text-slate-500">
                  Select one of the 4 candidate patterns to resolve the lockout.
                </p>
              )}
            </div>

            {penaltyLockout && (
              <span className="text-xs font-mono font-bold text-red-400 animate-pulse">
                LOCKOUT ACTIVE
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
