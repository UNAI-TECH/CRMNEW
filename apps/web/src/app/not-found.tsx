'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SESSION_KEY } from '@/lib/client/tenant-context';
import {
  LostMonsterMascot,
  EXPRESSION_SEQUENCE,
  MonsterExpression,
} from '@/components/ui/LostMonsterMascot';

type DragPiece = 'left4' | 'zero' | 'right4' | 'monster';

interface DragState {
  piece: DragPiece | null;
  x: number;
  y: number;
}

const INITIAL_DRAG: DragState = { piece: null, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function NotFound() {
  const [homeHref, setHomeHref] = useState<string>('/');
  const [drag, setDrag] = useState<DragState>(INITIAL_DRAG);
  const [hoveredPiece, setHoveredPiece] = useState<DragPiece | null>(null);
  const [bouncedPiece, setBouncedPiece] = useState<DragPiece | null>(null);
  const [ctaHovered, setCtaHovered] = useState<boolean>(false);
  const [exprIndex, setExprIndex] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [gazeOffset, setGazeOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerCurrentRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOriginRef = useRef<{
    piece: DragPiece;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.isLoggedIn) {
          setHomeHref('/dashboard');
        }
      }
    } catch {
      // Keep default '/' home destination
    }
  }, []);

  // Smooth parallax CSS variable loop (--mx, --my)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reducedMotion) return;

    let frameId = 0;

    const tick = () => {
      const curr = pointerCurrentRef.current;
      const target = pointerTargetRef.current;
      curr.x += (target.x - curr.x) * 0.085;
      curr.y += (target.y - curr.y) * 0.085;

      if (stageRef.current) {
        stageRef.current.style.setProperty('--mx', curr.x.toFixed(4));
        stageRef.current.style.setProperty('--my', curr.y.toFixed(4));
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  // Automatic expression progression (cycles worried -> confused -> thinking -> surprised -> happy)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reducedMotion || ctaHovered) return;

    const interval = window.setInterval(() => {
      setExprIndex((prev) => (prev + 1) % EXPRESSION_SEQUENCE.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [ctaHovered]);

  // Natural periodic eye blink
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reducedMotion) return;

    let blinkEndTimer = 0;
    const interval = window.setInterval(() => {
      setIsBlinking(true);
      blinkEndTimer = window.setTimeout(() => setIsBlinking(false), 150);
    }, 3400);

    return () => {
      window.clearInterval(interval);
      if (blinkEndTimer) window.clearTimeout(blinkEndTimer);
    };
  }, []);

  useEffect(() => {
    if (!bouncedPiece) return;
    const timer = window.setTimeout(() => setBouncedPiece(null), 520);
    return () => window.clearTimeout(timer);
  }, [bouncedPiece]);

  const activeExpression: MonsterExpression = ctaHovered
    ? 'happy'
    : EXPRESSION_SEQUENCE[exprIndex];

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.clientWidth > 0 && e.currentTarget.clientHeight > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = clamp(((e.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      const ny = clamp(((e.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      pointerTargetRef.current = { x: nx, y: ny };
      setGazeOffset({ x: nx * 5.5, y: ny * 4.5 });
    }

    const origin = dragOriginRef.current;
    if (!origin) return;

    const dx = e.clientX - origin.startX;
    const dy = e.clientY - origin.startY;
    if (Math.hypot(dx, dy) > 4) {
      origin.moved = true;
    }

    setDrag({
      piece: origin.piece,
      x: clamp(dx * 0.65, -56, 56),
      y: clamp(dy * 0.65, -42, 42),
    });
  };

  const handleStagePointerUp = () => {
    const origin = dragOriginRef.current;
    if (!origin) return;

    if (!origin.moved) {
      setBouncedPiece(origin.piece);
      if (origin.piece === 'monster') {
        setExprIndex((prev) => (prev + 1) % EXPRESSION_SEQUENCE.length);
      }
    }

    dragOriginRef.current = null;
    setDrag(INITIAL_DRAG);
  };

  const handleStagePointerLeave = () => {
    pointerTargetRef.current = { x: 0, y: 0 };
    setGazeOffset({ x: 0, y: 0 });
    if (dragOriginRef.current) {
      dragOriginRef.current = null;
      setDrag(INITIAL_DRAG);
    }
    setHoveredPiece(null);
  };

  const startPieceDrag = (
    piece: DragPiece,
    e: React.PointerEvent<HTMLElement>
  ) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
    dragOriginRef.current = {
      piece,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setDrag({ piece, x: 0, y: 0 });
  };

  const getDragOffset = (piece: DragPiece) => {
    if (drag.piece === piece) {
      return { x: drag.x, y: drag.y, active: true };
    }
    return { x: 0, y: 0, active: false };
  };

  const left4Offset = getDragOffset('left4');
  const zeroOffset = getDragOffset('zero');
  const right4Offset = getDragOffset('right4');
  const monsterOffset = getDragOffset('monster');

  return (
    <div
      ref={stageRef}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      onPointerLeave={handleStagePointerLeave}
      className="crm404-root"
      style={
        {
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          minHeight: '100dvh',
          width: '100%',
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'linear-gradient(180deg, #6BA1D8 0%, #8BB8E6 28%, #BFD9F3 56%, #DCE8F9 78%, #E6EFFC 100%)',
          fontFamily:
            "var(--font, 'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          '--mx': '0',
          '--my': '0',
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes crm404CloudDriftA {
          0% { transform: translate3d(-1.5%, 0px, 0) scale(1); }
          50% { transform: translate3d(2.5%, -8px, 0) scale(1.04); }
          100% { transform: translate3d(-1.5%, 0px, 0) scale(1); }
        }
        @keyframes crm404CloudDriftB {
          0% { transform: translate3d(2%, 0px, 0) scale(1.02); }
          50% { transform: translate3d(-2.5%, 10px, 0) scale(0.98); }
          100% { transform: translate3d(2%, 0px, 0) scale(1.02); }
        }
        @keyframes crm404FloatLeft {
          0% { transform: translate3d(0, 0px, 0) rotate(-1.5deg); }
          50% { transform: translate3d(0, -13px, 0) rotate(1.5deg); }
          100% { transform: translate3d(0, 0px, 0) rotate(-1.5deg); }
        }
        @keyframes crm404FloatZero {
          0% { transform: translate3d(0, 0px, 0) scale(1); }
          50% { transform: translate3d(0, -8px, 0) scale(1.018); }
          100% { transform: translate3d(0, 0px, 0) scale(1); }
        }
        @keyframes crm404FloatRight {
          0% { transform: translate3d(0, -10px, 0) rotate(1.6deg); }
          50% { transform: translate3d(0, 4px, 0) rotate(-1.4deg); }
          100% { transform: translate3d(0, -10px, 0) rotate(1.6deg); }
        }
        @keyframes crm404MonsterIdle {
          0% { transform: translate3d(0, 0px, 0) rotate(-1.1deg); }
          50% { transform: translate3d(0, -8px, 0) rotate(1.1deg); }
          100% { transform: translate3d(0, 0px, 0) rotate(-1.1deg); }
        }
        @keyframes crm404ArmUpDown {
          0% { transform: rotate(-5deg) translate3d(0px, -0.5%, 0); }
          14% { transform: rotate(3deg) translate3d(2px, 0.4%, 0); }
          28% { transform: rotate(-4deg) translate3d(-1px, -0.4%, 0); }
          48% { transform: rotate(13deg) translate3d(3px, 1.3%, 0); }
          64% { transform: rotate(4deg) translate3d(1px, 0.5%, 0); }
          80% { transform: rotate(16deg) translate3d(4px, 1.6%, 0); }
          100% { transform: rotate(-5deg) translate3d(0px, -0.5%, 0); }
        }
        @keyframes crm404ShadowIdle {
          0% { transform: translateX(-50%) scale(1); opacity: 0.92; }
          50% { transform: translateX(-50%) scale(0.9); opacity: 0.72; }
          100% { transform: translateX(-50%) scale(1); opacity: 0.92; }
        }
        @keyframes crm404PopBounce {
          0% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.08, 0.94) translateY(-10px) rotate(-2.5deg); }
          60% { transform: scale(0.97, 1.05) translateY(-16px) rotate(2.5deg); }
          82% { transform: scale(1.02, 0.98) translateY(-4px) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .crm404-cloud-a {
          animation: crm404CloudDriftA 18s ease-in-out infinite;
          will-change: transform;
        }
        .crm404-cloud-b {
          animation: crm404CloudDriftB 22s ease-in-out infinite;
          will-change: transform;
        }
        .crm404-float-left {
          animation: crm404FloatLeft 5.6s ease-in-out infinite;
          will-change: transform;
        }
        .crm404-float-zero {
          animation: crm404FloatZero 6.4s ease-in-out infinite;
          will-change: transform;
        }
        .crm404-float-right {
          animation: crm404FloatRight 5.9s ease-in-out infinite;
          will-change: transform;
        }
        .crm404-monster-idle {
          animation: crm404MonsterIdle 4.8s ease-in-out infinite;
          transform-origin: 50% 84%;
          will-change: transform;
        }
        .crm404-arm-updown {
          animation: crm404ArmUpDown 3.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          transform-origin: 81.1% 38.2%;
          will-change: transform;
        }
        .crm404-shadow-idle {
          animation: crm404ShadowIdle 4.8s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .crm404-pop-bounce {
          animation: crm404PopBounce 0.52s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .crm404-cta {
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease;
        }
        .crm404-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06) !important;
        }
        .crm404-cta:hover svg {
          transform: translateX(-2px);
        }
        .crm404-cta svg {
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .crm404-cloud-a,
          .crm404-cloud-b,
          .crm404-float-left,
          .crm404-float-zero,
          .crm404-float-right,
          .crm404-monster-idle,
          .crm404-arm-updown,
          .crm404-shadow-idle,
          .crm404-pop-bounce {
            animation: none !important;
          }
        }
      `}</style>

      {/* Atmospheric soft drifting cloud layers matching sky backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '6%',
            left: '-8%',
            width: '46%',
            height: '38%',
            transform:
              'translate3d(calc(var(--mx) * -12px), calc(var(--my) * -8px), 0)',
          }}
        >
          <div
            className="crm404-cloud-a"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.28) 55%, rgba(255,255,255,0) 100%)',
              filter: 'blur(26px)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '6%',
            width: '40%',
            height: '40%',
            transform:
              'translate3d(calc(var(--mx) * -16px), calc(var(--my) * -10px), 0)',
          }}
        >
          <div
            className="crm404-cloud-b"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.24) 60%, rgba(255,255,255,0) 100%)',
              filter: 'blur(30px)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '16%',
            left: '50%',
            transform:
              'translate3d(calc(-50% + var(--mx) * -10px), calc(var(--my) * -6px), 0)',
            width: '72%',
            height: '52%',
          }}
        >
          <div
            className="crm404-cloud-a"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.34) 58%, rgba(255,255,255,0) 100%)',
              filter: 'blur(32px)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '18%',
            right: '-6%',
            width: '48%',
            height: '44%',
            transform:
              'translate3d(calc(var(--mx) * -14px), calc(var(--my) * -9px), 0)',
          }}
        >
          <div
            className="crm404-cloud-b"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.28) 58%, rgba(255,255,255,0) 100%)',
              filter: 'blur(28px)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '46%',
            background:
              'linear-gradient(180deg, rgba(230,239,252,0) 0%, rgba(230,239,252,0.78) 38%, rgba(230,239,252,1) 100%)',
          }}
        />
      </div>

      {/* Top Navigation Bar: UNAI CRM (Left) */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(16px, 2.8vw, 26px) clamp(18px, 4vw, 40px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        <Link
          href={homeHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#FFFFFF',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '1.08rem',
            letterSpacing: '-0.02em',
            textShadow: '0 1px 6px rgba(15, 23, 42, 0.14)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
          </svg>
          <span>UNAI CRM</span>
        </Link>
      </header>

      {/* Main Centered Hero */}
      <main
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 18px clamp(36px, 6vh, 64px)',
          textAlign: 'center',
          marginTop: '-14px',
        }}
      >
        {/* Layered Giant Interactive 4 [Monster] 4 Scene */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '820px',
            margin: '0 auto',
            userSelect: 'none',
            perspective: '1000px',
          }}
        >
          {/* Giant White-to-Mist Numerals 4 0 4 */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(10px, 2.5vw, 32px)',
              fontSize: 'clamp(150px, 29vw, 345px)',
              fontWeight: 800,
              lineHeight: 0.84,
              letterSpacing: '-0.04em',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {/* Moveable Left 4 */}
            <div
              onPointerDown={(e) => startPieceDrag('left4', e)}
              onPointerEnter={() => setHoveredPiece('left4')}
              onPointerLeave={() =>
                setHoveredPiece((prev) => (prev === 'left4' ? null : prev))
              }
              style={{
                cursor: left4Offset.active ? 'grabbing' : 'grab',
                touchAction: 'none',
                transform: `translate3d(calc(var(--mx) * 10px + ${left4Offset.x}px), calc(var(--my) * 7px + ${left4Offset.y}px), 0) scale(${
                  hoveredPiece === 'left4' && !left4Offset.active ? 1.04 : 1
                })`,
                transition: left4Offset.active
                  ? 'none'
                  : 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                className={
                  bouncedPiece === 'left4' ? 'crm404-pop-bounce' : undefined
                }
              >
                <span
                  className="crm404-float-left"
                  style={{
                    display: 'inline-block',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 55%, rgba(255,255,255,0.42) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter:
                      hoveredPiece === 'left4'
                        ? 'drop-shadow(0 14px 30px rgba(59, 109, 168, 0.24))'
                        : 'drop-shadow(0 8px 24px rgba(59, 109, 168, 0.12))',
                    transition: 'filter 0.25s ease',
                  }}
                >
                  4
                </span>
              </div>
            </div>

            {/* Center 0 Frame */}
            <div
              onPointerDown={(e) => startPieceDrag('zero', e)}
              style={{
                cursor: zeroOffset.active ? 'grabbing' : 'grab',
                touchAction: 'none',
                transform: `translate3d(calc(var(--mx) * 6px + ${zeroOffset.x}px), calc(var(--my) * 5px + ${zeroOffset.y}px), 0)`,
                transition: zeroOffset.active
                  ? 'none'
                  : 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                className={
                  bouncedPiece === 'zero' ? 'crm404-pop-bounce' : undefined
                }
              >
                <span
                  className="crm404-float-zero"
                  style={{
                    display: 'inline-block',
                    padding: '0 clamp(2px, 0.6vw, 8px)',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 55%, rgba(255,255,255,0.45) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 8px 24px rgba(59, 109, 168, 0.12))',
                  }}
                >
                  0
                </span>
              </div>
            </div>

            {/* Moveable Right 4 */}
            <div
              onPointerDown={(e) => startPieceDrag('right4', e)}
              onPointerEnter={() => setHoveredPiece('right4')}
              onPointerLeave={() =>
                setHoveredPiece((prev) => (prev === 'right4' ? null : prev))
              }
              style={{
                cursor: right4Offset.active ? 'grabbing' : 'grab',
                touchAction: 'none',
                transform: `translate3d(calc(var(--mx) * 10px + ${right4Offset.x}px), calc(var(--my) * 7px + ${right4Offset.y}px), 0) scale(${
                  hoveredPiece === 'right4' && !right4Offset.active ? 1.04 : 1
                })`,
                transition: right4Offset.active
                  ? 'none'
                  : 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                className={
                  bouncedPiece === 'right4' ? 'crm404-pop-bounce' : undefined
                }
              >
                <span
                  className="crm404-float-right"
                  style={{
                    display: 'inline-block',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 55%, rgba(255,255,255,0.42) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter:
                      hoveredPiece === 'right4'
                        ? 'drop-shadow(0 14px 30px rgba(59, 109, 168, 0.24))'
                        : 'drop-shadow(0 8px 24px rgba(59, 109, 168, 0.12))',
                    transition: 'filter 0.25s ease',
                  }}
                >
                  4
                </span>
              </div>
            </div>
          </div>

          {/* Fluffy Blue Animated Monster Rig (Torso + Animated Arm + Animated Face) */}
          <div
            onPointerDown={(e) => startPieceDrag('monster', e)}
            onPointerEnter={() => setHoveredPiece('monster')}
            onPointerLeave={() =>
              setHoveredPiece((prev) => (prev === 'monster' ? null : prev))
            }
            title="Drag or click to change expression"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 'clamp(-10px, -1vw, -4px)',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: monsterOffset.active ? 'grabbing' : 'grab',
              touchAction: 'none',
              transform: `translate3d(calc(-51% + var(--mx) * 26px + ${monsterOffset.x}px), calc(var(--my) * 14px + ${monsterOffset.y}px), 0) rotate(calc(var(--mx) * 3.5deg)) scale(${
                hoveredPiece === 'monster' && !monsterOffset.active ? 1.03 : 1
              })`,
              transition: monsterOffset.active
                ? 'none'
                : 'transform 0.58s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <LostMonsterMascot
              height="clamp(160px, 28vw, 315px)"
              ctaHovered={ctaHovered}
              bounced={bouncedPiece === 'monster'}
              controlledExpression={activeExpression}
              controlledGaze={gazeOffset}
              controlledBlinking={isBlinking}
            />
          </div>
        </div>

        {/* Heading & Subcopy */}
        <h1
          style={{
            margin: 'clamp(14px, 2.5vw, 24px) 0 0 0',
            fontSize: 'clamp(1.65rem, 4.2vw, 2.75rem)',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.03em',
            lineHeight: 1.14,
          }}
        >
          Oops, i think we&rsquo;re lost
        </h1>

        <p
          style={{
            margin: '10px 0 0 0',
            fontSize: 'clamp(0.88rem, 1.5vw, 1.02rem)',
            fontWeight: 500,
            color: '#64748B',
            lineHeight: 1.5,
          }}
        >
          Let&rsquo;s get you back somewhere familiar...
        </p>

        {/* Primary CTA Button */}
        <div style={{ marginTop: 'clamp(22px, 3.5vw, 32px)' }}>
          <Link
            href={homeHref}
            className="crm404-cta"
            onMouseEnter={() => setCtaHovered(true)}
            onMouseLeave={() => setCtaHovered(false)}
            onFocus={() => setCtaHovered(true)}
            onBlur={() => setCtaHovered(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '9px',
              padding: '11px 20px',
              borderRadius: '11px',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              fontSize: '0.88rem',
              fontWeight: 700,
              textDecoration: 'none',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              boxShadow:
                '0 4px 14px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.05)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M16 12H8" />
              <path d="m12 8-4 4 4 4" />
            </svg>
            <span>Back to home</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
