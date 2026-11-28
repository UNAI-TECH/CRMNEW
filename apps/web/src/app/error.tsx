'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Home } from 'lucide-react';
import { LostMonsterMascot } from '@/components/ui/LostMonsterMascot';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [ctaHovered, setCtaHovered] = useState(false);

  useEffect(() => {
    console.error('App Router Error Caught:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '80vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        textAlign: 'center',
        backgroundColor: '#FFFFFF',
        boxSizing: 'border-box',
      }}
    >
      {/* Animated Expressive Mascot (without 404 behind it) */}
      <div style={{ marginBottom: '1.15rem' }}>
        <LostMonsterMascot
          height="clamp(150px, 32vw, 210px)"
          ctaHovered={ctaHovered}
          trackWindowPointer
        />
      </div>

      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#17191A',
          margin: '0 0 0.5rem 0',
          letterSpacing: '-0.02em',
        }}
      >
        Something went wrong
      </h2>

      <p
        style={{
          fontSize: '0.92rem',
          color: '#5E6360',
          maxWidth: '440px',
          lineHeight: 1.5,
          margin: '0 0 1.75rem 0',
        }}
      >
        An unexpected error occurred while loading this view. You can retry or return to the main dashboard.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => reset()}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          onFocus={() => setCtaHovered(true)}
          onBlur={() => setCtaHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '999px',
            backgroundColor: '#6253F8',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={16} />
          <span>Try Again</span>
        </button>

        <Link
          href="/dashboard"
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          onFocus={() => setCtaHovered(true)}
          onBlur={() => setCtaHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '999px',
            backgroundColor: '#F8FAFC',
            color: '#17191A',
            border: '1px solid #E2E8F0',
            fontWeight: 600,
            fontSize: '0.88rem',
            textDecoration: 'none',
          }}
        >
          <Home size={16} />
          <span>Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
