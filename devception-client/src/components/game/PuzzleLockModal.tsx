'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';

export function PuzzleLockModal({ socket, roomCode }: { socket: AppSocket | null; roomCode: string }) {
  const { activePuzzle, setActivePuzzle } = useGameStore();
  const [arrangement, setArrangement] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [solved, setSolved] = useState(false);
  const [connected, setConnected] = useState(!!socket?.connected);
  const [remaining, setRemaining] = useState(20);
  const grid = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setArrangement(activePuzzle?.arrangement ?? []);
    setCorrect(activePuzzle?.correctPositions ?? []);
    setSelected(null); setPending(false); setSolved(false);
    if (!activePuzzle) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const tick = () => setRemaining(Math.max(0, Math.ceil((activePuzzle.expiresAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 250);
    return () => { clearInterval(timer); previous?.focus(); };
  }, [activePuzzle]);

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout>;
    const onDisconnect = () => { setConnected(false); setPending(false); };
    const onConnect = () => setConnected(true);
    const onResult = (data: { puzzleId: string; correctPositions: number[] }) => {
      if (data.puzzleId !== activePuzzle?.puzzleId) return;
      setPending(false); setCorrect(data.correctPositions);
    };
    const onUnlock = (data: { puzzleId: string; reason?: string }) => {
      if (data.puzzleId !== activePuzzle?.puzzleId || data.reason !== 'solved') return;
      setSolved(true); setPending(false); setCorrect(Array.from({ length: 16 }, (_, i) => i));
      timer = setTimeout(() => {
        if (useGameStore.getState().activePuzzle?.puzzleId === data.puzzleId) setActivePuzzle(null);
      }, 1100);
    };
    setConnected(socket.connected);
    socket.on('disconnect', onDisconnect); socket.on('connect', onConnect);
    socket.on('sabotage:puzzle-attempt-result', onResult); socket.on('sabotage:puzzle-unlocked', onUnlock);
    return () => {
      clearTimeout(timer);
      socket.off('disconnect', onDisconnect); socket.off('connect', onConnect);
      socket.off('sabotage:puzzle-attempt-result', onResult); socket.off('sabotage:puzzle-unlocked', onUnlock);
    };
  }, [socket, activePuzzle, setActivePuzzle]);

  function swap(from: number, to: number) {
    if (!activePuzzle || !socket?.connected || pending || solved || from === to || to < 0 || to > 15) return;
    const next = [...arrangement];
    [next[from], next[to]] = [next[to], next[from]];
    setArrangement(next); setSelected(null); setCorrect([]); setPending(true);
    socket.emit('sabotage:puzzle-solve', { roomCode, puzzleId: activePuzzle.puzzleId, arrangement: next });
  }

  return <AnimatePresence>{activePuzzle && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md">
      <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="puzzle-title"
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); setSelected(null); }
          if (e.key === 'Tab') {
            const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (!first) { e.preventDefault(); return; }
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl border border-red-500/60 bg-slate-950 p-5 text-white shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 text-xs font-bold tracking-wider">
          <span className={solved ? 'text-emerald-400' : 'text-red-400'}>{solved ? 'WORKSPACE RESTORED' : '🚨 WORKSPACE LOCKED'}</span>
          <span className="whitespace-nowrap font-mono text-amber-300">⏱ {remaining} seconds</span>
        </div>
        <h2 id="puzzle-title" className="mt-4 text-2xl font-bold">{solved ? '✓ PUZZLE SOLVED' : '🧩 PUZZLE LOCK'}</h2>
        <p className="mt-2 text-sm text-slate-300" aria-live="polite">{solved ? 'Workspace restored.' : 'Reconstruct the image to regain access to your workspace.'}</p>
        <div ref={grid} className="mx-auto my-5 grid aspect-square grid-cols-4 gap-1" style={{ maxWidth: 'min(100%, 52vh)' }}>
          {arrangement.map((id, index) => <motion.button key={id} layout transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            type="button" data-puzzle-slot={index} aria-label={`Tile at row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}${correct.includes(index) ? ', correctly placed' : ''}`}
            aria-pressed={selected === index} disabled={pending || solved || !connected}
            onPointerDown={e => { if (e.button !== 0) return; pointer.current = { x: e.clientX, y: e.clientY }; setSelected(index); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerUp={e => {
              const start = pointer.current; pointer.current = null;
              if (!start) return;
              const rect = grid.current?.getBoundingClientRect();
              if (!rect || e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) { setSelected(null); return; }
              if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) {
                const to = Math.floor((e.clientY - rect.top) / rect.height * 4) * 4 + Math.floor((e.clientX - rect.left) / rect.width * 4);
                swap(index, to);
              }
            }}
            onPointerCancel={() => { pointer.current = null; setSelected(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selected === null) setSelected(index); else swap(selected, index); }
              const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 } as Record<string, number>)[e.key];
              if (offset) { e.preventDefault(); grid.current?.querySelector<HTMLButtonElement>(`[data-puzzle-slot="${Math.max(0, Math.min(15, index + offset))}"]`)?.focus(); }
            }}
            animate={{ scale: selected === index ? 0.94 : 1 }}
            className="relative aspect-square touch-none select-none overflow-hidden rounded-sm bg-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            style={{ cursor: selected === index ? 'grabbing' : 'grab', boxShadow: selected === index ? '0 0 0 3px #38bdf8' : correct.includes(index) ? '0 0 0 1px #34d399' : 'none' }}>
            {/* Individual cropped tile: never download or display the original photo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activePuzzle.tiles.find(tile => tile.id === id)?.image} alt="" draggable={false} className="h-full w-full pointer-events-none" />
            {correct.includes(index) && <span className="absolute bottom-0 right-0 rounded-tl bg-emerald-950/70 px-1 text-xs text-emerald-300">✓</span>}
          </motion.button>)}
        </div>
        <p className="text-center text-xs text-slate-400" aria-live="polite">{!connected ? 'Reconnecting… Your puzzle progress is saved.' : solved ? 'Workspace restored.' : pending ? 'Checking arrangement…' : remaining === 0 ? 'Time elapsed — finish the image to unlock your workspace.' : 'Drag one tile onto another to swap their positions.'}</p>
        <p className="mt-2 text-center text-xs text-slate-500">Keyboard: arrows to move focus, Space to select and swap.</p>
      </motion.div>
    </motion.div>
  )}</AnimatePresence>;
}
