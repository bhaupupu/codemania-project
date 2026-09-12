'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCinematic } from './CinematicProvider';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { triggerCinematic } = useCinematic();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#faf8f4',
        borderBottom: '3px solid #1c1917',
        boxShadow: scrolled ? '2px 2px 0 #1c1917' : 'none',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 72,
        }}
      >
        {/* BIG DEVCEPTION LOGO */}
        <Link
          href="/"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            fontWeight: 'bold',
            color: '#1c1917',
            textDecoration: 'none',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: '#2563eb' }}>&gt;</span>
          DEVCEPTION
        </Link>

        {/* RIGHT BUTTONS */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button
            onClick={() => triggerCinematic('/login')}
            className="nav-login-btn"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              color: '#1c1917',
              textDecoration: 'none',
              padding: '10px 18px',
              border: '2px solid #1c1917',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              boxShadow: '2px 2px 0 #1c1917',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#1c1917';
              el.style.color = '#faf8f4';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'transparent';
              el.style.color = '#1c1917';
            }}
          >
            LOGIN
          </button>

          <button
            onClick={() => triggerCinematic('/lobby')}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              padding: '10px 22px',
              background: '#2563eb',
              color: '#fff',
              border: '2px solid #1c1917',
              boxShadow: '3px 3px 0 #1c1917',
              textDecoration: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'transform 0.08s, box-shadow 0.08s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translate(-1px, -1px)';
              el.style.boxShadow = '4px 4px 0 #1c1917';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translate(0, 0)';
              el.style.boxShadow = '3px 3px 0 #1c1917';
            }}
          >
            ▶ PLAY NOW
          </button>
        </div>
      </div>
    </nav>
  );
}
