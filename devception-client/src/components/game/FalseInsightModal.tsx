'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';

interface Props {
  socket: AppSocket | null;
  roomCode: string;
}

interface ResultData {
  success: boolean;
  choice: 'accept' | 'reject';
  wasCorrect: boolean;
  xpGained: number;
  debuffDurationMs?: number;
  message: string;
  explanation: string;
}

export function FalseInsightModal({ socket, roomCode }: Props) {
  const { activeInsight, setActiveInsight } = useGameStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(25);

  useEffect(() => {
    if (!activeInsight) {
      setIsSubmitting(false);
      setResult(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((activeInsight.expiresAt - now) / 1000));
      setRemainingSecs(diff);
      if (diff <= 0 && !result) {
        setActiveInsight(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [activeInsight, result, setActiveInsight]);

  useEffect(() => {
    if (!socket) return;

    const handleResult = (res: ResultData) => {
      setIsSubmitting(false);
      setResult(res);
    };

    socket.on('sabotage:false-insight-result', handleResult);
    return () => {
      socket.off('sabotage:false-insight-result', handleResult);
    };
  }, [socket]);

  const handleChoice = useCallback(
    (choice: 'accept' | 'reject') => {
      if (!socket || !activeInsight || isSubmitting) return;

      setIsSubmitting(true);
      socket.emit('sabotage:insight-respond', {
        roomCode,
        insightId: activeInsight.insightId,
        choice,
      });
    },
    [socket, activeInsight, isSubmitting, roomCode]
  );

  const handleClose = () => {
    setActiveInsight(null);
    setResult(null);
  };

  if (!activeInsight) return null;

  const totalDuration = (activeInsight.durationMs || 25000) / 1000;
  const progressPct = Math.min(100, Math.max(0, (remainingSecs / totalDuration) * 100));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.94, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: '#0f172a',
            border: result
              ? result.choice === 'reject' && !result.wasCorrect
                ? '2px solid #22c55e'
                : result.choice === 'accept' && !result.wasCorrect
                ? '2px solid #ef4444'
                : '2px solid #38bdf8'
              : '2px solid #a855f7',
            boxShadow: '0 0 30px rgba(168, 85, 247, 0.2)',
          }}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{
              background: 'linear-gradient(90deg, rgba(168,85,247,0.2), rgba(15,23,42,0.9))',
              borderColor: 'rgba(168,85,247,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">🤖</span>
              <div>
                <p
                  className="font-bold text-xs uppercase tracking-widest text-purple-400"
                  style={{ fontFamily: 'Press Start 2P, monospace' }}
                >
                  DEVAI INSIGHT
                </p>
                <h3 className="text-white font-bold text-sm tracking-wide">
                  {activeInsight.topic}
                </h3>
              </div>
            </div>

            {!result && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-500/30 font-mono text-xs text-purple-300">
                <span>⏱</span>
                <span>{remainingSecs}s</span>
              </div>
            )}
          </div>

          {/* Countdown Bar */}
          {!result && (
            <div className="w-full h-1 bg-slate-900 overflow-hidden">
              <motion.div
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5 }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                }}
              />
            </div>
          )}

          {/* Content Area */}
          <div className="px-6 py-5 space-y-4">
            {!result ? (
              <>
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40">
                  <span className="text-xl">💡</span>
                  <div className="text-sm text-slate-200 leading-relaxed font-normal">
                    <p className="font-semibold text-purple-300 text-xs uppercase mb-1">
                      {activeInsight.title}
                    </p>
                    <p className="text-slate-200 italic">
                      &ldquo;{activeInsight.statement}&rdquo;
                    </p>
                  </div>
                </div>

                {activeInsight.codeSnippet && (
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-emerald-400">
                    <pre className="overflow-x-auto">{activeInsight.codeSnippet}</pre>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    CRITICAL ANALYSIS REQUIRED
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Do you trust this recommendation for your current implementation?
                  </p>
                </div>

                {/* Choices */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <motion.button
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                    onClick={() => handleChoice('reject')}
                    disabled={isSubmitting}
                    className="py-3 px-4 rounded-xl border border-red-500/50 flex flex-col items-center justify-center gap-1 font-semibold text-xs text-red-300 transition-all hover:bg-red-500/20"
                    style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <span className="text-base">🛡️ REJECT</span>
                    <span className="text-[10px] text-red-400/80 font-normal">
                      Flawed / Misleading
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                    onClick={() => handleChoice('accept')}
                    disabled={isSubmitting}
                    className="py-3 px-4 rounded-xl border border-emerald-500/50 flex flex-col items-center justify-center gap-1 font-semibold text-xs text-emerald-300 transition-all hover:bg-emerald-500/20"
                    style={{ background: 'rgba(16, 185, 129, 0.1)' }}
                  >
                    <span className="text-base">💡 ACCEPT</span>
                    <span className="text-[10px] text-emerald-400/80 font-normal">
                      Sound Advice
                    </span>
                  </motion.button>
                </div>
              </>
            ) : (
              /* Revelation & Result View */
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 text-center py-2"
              >
                <div className="text-4xl">
                  {result.choice === 'reject' && !result.wasCorrect
                    ? '🎯'
                    : result.choice === 'accept' && result.wasCorrect
                    ? '🌟'
                    : result.choice === 'accept' && !result.wasCorrect
                    ? '⚠️'
                    : 'ℹ️'}
                </div>

                <div>
                  <h4
                    className="text-base font-bold mb-1"
                    style={{
                      color:
                        result.choice === 'reject' && !result.wasCorrect
                          ? '#22c55e'
                          : result.choice === 'accept' && result.wasCorrect
                          ? '#38bdf8'
                          : result.choice === 'accept' && !result.wasCorrect
                          ? '#ef4444'
                          : '#cbd5e1',
                    }}
                  >
                    {result.message}
                  </h4>
                  {result.xpGained > 0 && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      +{result.xpGained} XP Bonus
                    </span>
                  )}
                  {result.debuffDurationMs && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                      ⏱ 15s Latency Debuff Applied
                    </span>
                  )}
                </div>

                <div className="text-left p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <p className="font-semibold text-slate-400 mb-1">
                    Technical Explanation:
                  </p>
                  <p>{result.explanation}</p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold tracking-wider transition-all border border-slate-600"
                >
                  CONTINUE CODING
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
