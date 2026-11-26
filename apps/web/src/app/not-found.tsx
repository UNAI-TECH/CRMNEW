'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SESSION_KEY } from '@/lib/client/tenant-context';

type DragPiece = 'left4' | 'zero' | 'right4' | 'monster';
type MonsterExpression =
  | 'worried'
  | 'confused'
  | 'thinking'
  | 'surprised'
  | 'happy';

interface DragState {
  piece: DragPiece | null;
  x: number;
  y: number;
}

interface ExpressionPose {
  armDeg: number;
  armY: number;
  browLeftY: number;
  browLeftDeg: number;
  browRightY: number;
  browRightDeg: number;
  lookX: number;
  lookY: number;
  pupilScale: number;
  happySquint: number; // 0 = normal round eye, 1 = cheerful lower cheek curve
}

const EXPRESSION_SEQUENCE: MonsterExpression[] = [
  'worried',
  'confused',
  'thinking',
  'surprised',
  'happy',
];

const EXPRESSION_POSES: Record<MonsterExpression, ExpressionPose> = {
  worried: {
    armDeg: -3,
    armY: -0.4,
    browLeftY: 0,
    browLeftDeg: 0,
    browRightY: 0,
    browRightDeg: 0,
    lookX: -4,
    lookY: -3,
    pupilScale: 1,
    happySquint: 0,
  },
  confused: {
    armDeg: 6,
    armY: 0.8,
    browLeftY: -1.4,
    browLeftDeg: -10,
    browRightY: 0.5,
    browRightDeg: 7,
    lookX: 6,
    lookY: -5,
    pupilScale: 0.94,
    happySquint: 0,
  },
  thinking: {
    armDeg: 10,
    armY: 1.4,
    browLeftY: 0.7,
    browLeftDeg: 11,
    browRightY: -1.1,
    browRightDeg: -9,
    lookX: -7,
    lookY: -6,
    pupilScale: 0.9,
    happySquint: 0.25,
  },
  surprised: {
    armDeg: -6,
    armY: -0.7,
    browLeftY: -1.8,
    browLeftDeg: 12,
    browRightY: -1.8,
    browRightDeg: -12,
    lookX: 0,
    lookY: -2,
    pupilScale: 1.14,
    happySquint: 0,
  },
  happy: {
    armDeg: 4,
    armY: 0.5,
    browLeftY: -1.3,
    browLeftDeg: 10,
    browRightY: -1.3,
    browRightDeg: -10,
    lookX: 0,
    lookY: 5,
    pupilScale: 1.08,
    happySquint: 0.65,
  },
};

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
  const pose = EXPRESSION_POSES[activeExpression];

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

  // Combine expression gaze with real-time pointer tracking
  const pupilDx = clamp(
    ctaHovered ? 0 : pose.lookX * 0.55 + gazeOffset.x,
    -8.5,
    8.5
  );
  const pupilDy = clamp(
    ctaHovered ? 6.5 : pose.lookY * 0.55 + gazeOffset.y,
    -7.5,
    7.5
  );

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
            {/* Synchronized Ground Contact Shadow */}
            <div
              aria-hidden="true"
              className="crm404-shadow-idle"
              style={{
                position: 'absolute',
                bottom: '4px',
                left: '55%',
                width: '56%',
                height: '22px',
                borderRadius: '50%',
                background:
                  'radial-gradient(ellipse at center, rgba(22, 48, 84, 0.34) 0%, rgba(22, 48, 84, 0.12) 48%, rgba(22, 48, 84, 0) 75%)',
                filter: 'blur(4px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            <div
              className={
                bouncedPiece === 'monster' ? 'crm404-pop-bounce' : undefined
              }
            >
              <div
                className="crm404-monster-idle"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'inline-block',
                  filter: 'drop-shadow(0 12px 24px rgba(24, 54, 92, 0.16))',
                }}
              >
                {/* 1. Base Body Layer (establishes exact 676x760 proportion box) */}
                <img
                  src="/images/lost-monster-body.png"
                  alt="Animated lost fluffy blue monster moving its hand and changing expressions"
                  draggable={false}
                  style={{
                    height: 'clamp(160px, 28vw, 315px)',
                    width: 'auto',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />

                {/* 2. Articulated SVG Eyes, Pupils, Eyelids & Multi-Expression 3D Mouth */}
                <svg
                  viewBox="0 0 676 760"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  <defs>
                    <radialGradient id="crmEyeScleraL" cx="38%" cy="32%" r="68%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="68%" stopColor="#F1F5FA" />
                      <stop offset="100%" stopColor="#C4D3E5" />
                    </radialGradient>
                    <radialGradient id="crmEyeScleraR" cx="38%" cy="32%" r="68%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="68%" stopColor="#F1F5FA" />
                      <stop offset="100%" stopColor="#C4D3E5" />
                    </radialGradient>
                    <linearGradient id="crmLidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#65A8EB" />
                      <stop offset="72%" stopColor="#4380C7" />
                      <stop offset="100%" stopColor="#2A5894" />
                    </linearGradient>
                    <radialGradient id="crmSquintGrad" cx="50%" cy="20%" r="80%">
                      <stop offset="0%" stopColor="#5AA1E8" />
                      <stop offset="65%" stopColor="#3B78BF" />
                      <stop offset="100%" stopColor="#26508A" />
                    </radialGradient>
                    <linearGradient id="crmLipGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C1899B" />
                      <stop offset="55%" stopColor="#9A6078" />
                      <stop offset="100%" stopColor="#6D3F54" />
                    </linearGradient>
                    <clipPath id="crmClipEyeL">
                      <ellipse cx="341.8" cy="136.8" rx="28" ry="26.4" />
                    </clipPath>
                    <clipPath id="crmClipEyeR">
                      <ellipse cx="422.2" cy="152.2" rx="29.4" ry="27.2" />
                    </clipPath>
                    <filter
                      id="crmSoftShadow"
                      x="-25%"
                      y="-25%"
                      width="150%"
                      height="150%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="1"
                        stdDeviation="2.2"
                        floodColor="#10294B"
                        floodOpacity="0.62"
                      />
                    </filter>
                  </defs>

                  {/* Left Eye (Center 341.8, 136.8) */}
                  <g clipPath="url(#crmClipEyeL)">
                    <ellipse
                      cx="341.8"
                      cy="136.8"
                      rx="28.4"
                      ry="26.8"
                      fill="url(#crmEyeScleraL)"
                    />
                    {/* Recessed fur socket rim shadow */}
                    <ellipse
                      cx="341.8"
                      cy="136.8"
                      rx="28"
                      ry="26.4"
                      fill="none"
                      stroke="rgba(22, 48, 88, 0.28)"
                      strokeWidth="3"
                    />
                    {/* Tracking Iris & Pupil */}
                    <g
                      style={{
                        transform: `translate(${pupilDx}px, ${pupilDy}px) scale(${pose.pupilScale})`,
                        transformOrigin: '344px 137px',
                        transition:
                          'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <circle cx="344" cy="137" r="10.4" fill="#17202C" />
                      <circle cx="344" cy="137" r="6.4" fill="#070B11" />
                      <circle cx="340.5" cy="132.5" r="3.4" fill="#FFFFFF" />
                      <circle
                        cx="347.5"
                        cy="140.5"
                        r="1.4"
                        fill="rgba(255,255,255,0.72)"
                      />
                    </g>
                    {/* Upper Blink Eyelid */}
                    <g
                      style={{
                        transform: isBlinking
                          ? 'translateY(0px)'
                          : activeExpression === 'thinking'
                            ? 'translateY(-38px)'
                            : 'translateY(-60px)',
                        transition: isBlinking
                          ? 'transform 0.08s ease-in'
                          : 'transform 0.24s ease-out',
                      }}
                    >
                      <rect
                        x="308"
                        y="108"
                        width="68"
                        height="58"
                        rx="14"
                        fill="url(#crmLidGrad)"
                      />
                      <line
                        x1="312"
                        y1="164"
                        x2="372"
                        y2="164"
                        stroke="#1E4478"
                        strokeWidth="2.5"
                      />
                    </g>
                    {/* Gentle 3D Lower Cheek Lift */}
                    <ellipse
                      cx="341.8"
                      cy="171"
                      rx="31"
                      ry="11"
                      fill="url(#crmSquintGrad)"
                      stroke="#224A7E"
                      strokeWidth="1.4"
                      style={{
                        transform: `translateY(${pose.happySquint > 0 ? -pose.happySquint * 3.5 : 10}px)`,
                        transition:
                          'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </g>

                  {/* Right Eye (Center 422.2, 152.2) */}
                  <g clipPath="url(#crmClipEyeR)">
                    <ellipse
                      cx="422.2"
                      cy="152.2"
                      rx="29.8"
                      ry="27.6"
                      fill="url(#crmEyeScleraR)"
                    />
                    <ellipse
                      cx="422.2"
                      cy="152.2"
                      rx="29.4"
                      ry="27.2"
                      fill="none"
                      stroke="rgba(22, 48, 88, 0.28)"
                      strokeWidth="3"
                    />
                    <g
                      style={{
                        transform: `translate(${pupilDx}px, ${pupilDy}px) scale(${pose.pupilScale})`,
                        transformOrigin: '417px 152px',
                        transition:
                          'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <circle cx="417" cy="152" r="10.7" fill="#17202C" />
                      <circle cx="417" cy="152" r="6.6" fill="#070B11" />
                      <circle cx="413.5" cy="147.5" r="3.5" fill="#FFFFFF" />
                      <circle
                        cx="420.5"
                        cy="155.5"
                        r="1.4"
                        fill="rgba(255,255,255,0.72)"
                      />
                    </g>
                    <g
                      style={{
                        transform: isBlinking
                          ? 'translateY(0px)'
                          : activeExpression === 'thinking'
                            ? 'translateY(-40px)'
                            : 'translateY(-62px)',
                        transition: isBlinking
                          ? 'transform 0.08s ease-in'
                          : 'transform 0.24s ease-out',
                      }}
                    >
                      <rect
                        x="388"
                        y="122"
                        width="70"
                        height="60"
                        rx="14"
                        fill="url(#crmLidGrad)"
                      />
                      <line
                        x1="392"
                        y1="180"
                        x2="454"
                        y2="180"
                        stroke="#1E4478"
                        strokeWidth="2.5"
                      />
                    </g>
                    <ellipse
                      cx="422.2"
                      cy="187"
                      rx="32"
                      ry="11"
                      fill="url(#crmSquintGrad)"
                      stroke="#224A7E"
                      strokeWidth="1.4"
                      style={{
                        transform: `translateY(${pose.happySquint > 0 ? -pose.happySquint * 3.5 : 10}px)`,
                        transition:
                          'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </g>

                  {/* Dynamic Multi-Expression 3D Mouth (Centered at 368, 227) */}
                  <g filter="url(#crmSoftShadow)">
                    {activeExpression === 'worried' && (
                      <g>
                        <path
                          d="M 326 237 C 337 213, 393 209, 408 232 C 402 238, 391 236, 376 234 C 357 232, 340 237, 326 237 Z"
                          fill="#1B0E14"
                        />
                        <path
                          d="M 357 218 L 365 217 L 364 224 C 361 225, 358 225, 356 224 Z"
                          fill="#F6F7FA"
                        />
                        <path
                          d="M 368 217 L 377 217 L 377 224 C 374 225, 371 225, 368 224 Z"
                          fill="#F6F7FA"
                        />
                        <path
                          d="M 347 235 C 358 228, 381 228, 390 234 Z"
                          fill="#944B61"
                        />
                        <path
                          d="M 326 238 C 344 231, 389 229, 409 233 C 403 241, 390 239, 372 238 C 353 237, 336 243, 326 238 Z"
                          fill="url(#crmLipGrad)"
                        />
                      </g>
                    )}

                    {activeExpression === 'confused' && (
                      <g>
                        <ellipse
                          cx="374"
                          cy="228"
                          rx="13.5"
                          ry="10.5"
                          transform="rotate(-8 374 228)"
                          fill="#1B0E14"
                        />
                        <path
                          d="M 362 232 C 369 240, 382 239, 387 229 C 383 234, 369 235, 362 232 Z"
                          fill="url(#crmLipGrad)"
                        />
                        <ellipse
                          cx="374"
                          cy="233"
                          rx="6.2"
                          ry="3"
                          fill="#944B61"
                        />
                      </g>
                    )}

                    {activeExpression === 'thinking' && (
                      <g>
                        <path
                          d="M 343 227 Q 357 234 369 226 Q 382 220 393 226"
                          fill="none"
                          stroke="#18273E"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 353 233 Q 368 238 384 231"
                          fill="none"
                          stroke="rgba(169, 114, 136, 0.72)"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                        />
                      </g>
                    )}

                    {activeExpression === 'surprised' && (
                      <g>
                        <ellipse
                          cx="369"
                          cy="228"
                          rx="16.5"
                          ry="18.5"
                          fill="#170A10"
                        />
                        <path
                          d="M 358 214 C 365 213, 373 213, 380 214 L 378 219 C 371 220, 366 220, 360 219 Z"
                          fill="#F5F7FA"
                        />
                        <ellipse
                          cx="369"
                          cy="239"
                          rx="9.5"
                          ry="4.5"
                          fill="#9A4E65"
                        />
                        <path
                          d="M 353 232 C 357 248, 381 248, 385 232 C 380 242, 358 242, 353 232 Z"
                          fill="url(#crmLipGrad)"
                        />
                      </g>
                    )}

                    {activeExpression === 'happy' && (
                      <g>
                        <path
                          d="M 332 218 C 345 245, 391 244, 404 217 C 386 222, 350 223, 332 218 Z"
                          fill="#1B0E14"
                        />
                        <path
                          d="M 345 220 C 359 223, 377 223, 391 220 L 389 227 C 376 229, 360 229, 347 227 Z"
                          fill="#F6F8FB"
                        />
                        <path
                          d="M 352 233 C 362 228, 375 228, 384 233 C 377 238, 359 238, 352 233 Z"
                          fill="#A8576E"
                        />
                        {/* Sculpted bottom lip under smile matching 3D lighting */}
                        <path
                          d="M 332 219 C 345 246, 391 245, 404 218 C 394 240, 381 244, 368 244 C 355 244, 342 240, 332 219 Z"
                          fill="url(#crmLipGrad)"
                        />
                      </g>
                    )}
                  </g>
                </svg>

                {/* 3. Real 3D Furry Animated Eyebrows */}
                <img
                  src="/images/lost-monster-brow-l.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 3,
                    transformOrigin: '51.2% 12.4%',
                    transform: `translateY(${pose.browLeftY}%) rotate(${pose.browLeftDeg}deg)`,
                    transition:
                      'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
                <img
                  src="/images/lost-monster-brow-r.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 3,
                    transformOrigin: '62.4% 14.2%',
                    transform: `translateY(${pose.browRightY}%) rotate(${pose.browRightDeg}deg)`,
                    transition:
                      'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />

                {/* 4. Articulated Raised Hand Moving Up and Down */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 4,
                    transformOrigin: '81.1% 38.2%',
                    transform: `rotate(${pose.armDeg}deg) translateY(${pose.armY}%)`,
                    transition:
                      'transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <img
                    src="/images/lost-monster-arm.png"
                    alt=""
                    draggable={false}
                    className="crm404-arm-updown"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
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
