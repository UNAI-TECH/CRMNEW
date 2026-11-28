'use client';

import React, { useEffect, useId, useState } from 'react';

export type MonsterExpression =
  | 'worried'
  | 'confused'
  | 'thinking'
  | 'surprised'
  | 'happy';

export interface ExpressionPose {
  armDeg: number;
  armY: number;
  browLeftY: number;
  browLeftDeg: number;
  browRightY: number;
  browRightDeg: number;
  lookX: number;
  lookY: number;
  pupilScale: number;
  happySquint: number;
}

export const EXPRESSION_SEQUENCE: MonsterExpression[] = [
  'worried',
  'confused',
  'thinking',
  'surprised',
  'happy',
];

export const EXPRESSION_POSES: Record<MonsterExpression, ExpressionPose> = {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface LostMonsterMascotProps {
  height?: string;
  ctaHovered?: boolean;
  bounced?: boolean;
  trackWindowPointer?: boolean;
  controlledExpression?: MonsterExpression;
  controlledGaze?: { x: number; y: number };
  controlledBlinking?: boolean;
  onTapCycle?: () => void;
}

export function LostMonsterMascot({
  height = 'clamp(155px, 30vw, 225px)',
  ctaHovered = false,
  bounced = false,
  trackWindowPointer = false,
  controlledExpression,
  controlledGaze,
  controlledBlinking,
  onTapCycle,
}: LostMonsterMascotProps) {
  const uid = useId().replace(/:/g, '');
  const [exprIndex, setExprIndex] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [localGaze, setLocalGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [localBounce, setLocalBounce] = useState(false);

  // Autonomous expression cycling when not externally controlled
  useEffect(() => {
    if (controlledExpression !== undefined || ctaHovered || typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setExprIndex((prev) => (prev + 1) % EXPRESSION_SEQUENCE.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [controlledExpression, ctaHovered]);

  // Autonomous eye blinking when not externally controlled
  useEffect(() => {
    if (controlledBlinking !== undefined || typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let endTimer = 0;
    const timer = window.setInterval(() => {
      setIsBlinking(true);
      endTimer = window.setTimeout(() => setIsBlinking(false), 150);
    }, 3400);

    return () => {
      window.clearInterval(timer);
      if (endTimer) window.clearTimeout(endTimer);
    };
  }, [controlledBlinking]);

  // Optional window pointer tracking when embedded directly on standalone pages like error.tsx
  useEffect(() => {
    if (!trackWindowPointer || controlledGaze !== undefined || typeof window === 'undefined') return;
    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = clamp((e.clientX / w - 0.5) * 2, -1, 1);
      const ny = clamp((e.clientY / h - 0.5) * 2, -1, 1);
      setLocalGaze({ x: nx * 5.5, y: ny * 4.5 });
    };
    const onLeave = () => setLocalGaze({ x: 0, y: 0 });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [trackWindowPointer, controlledGaze]);

  useEffect(() => {
    if (!localBounce) return;
    const t = window.setTimeout(() => setLocalBounce(false), 520);
    return () => window.clearTimeout(t);
  }, [localBounce]);

  const activeExpression: MonsterExpression =
    controlledExpression || (ctaHovered ? 'happy' : EXPRESSION_SEQUENCE[exprIndex]);
  const pose = EXPRESSION_POSES[activeExpression];
  const gaze = controlledGaze || localGaze;
  const blinking = controlledBlinking ?? isBlinking;

  const pupilDx = clamp(ctaHovered ? 0 : pose.lookX * 0.55 + gaze.x, -8.5, 8.5);
  const pupilDy = clamp(ctaHovered ? 6.5 : pose.lookY * 0.55 + gaze.y, -7.5, 7.5);

  const scleraLId = `crmEyeScleraL_${uid}`;
  const scleraRId = `crmEyeScleraR_${uid}`;
  const lidGradId = `crmLidGrad_${uid}`;
  const squintGradId = `crmSquintGrad_${uid}`;
  const lipGradId = `crmLipGrad_${uid}`;
  const clipEyeLId = `crmClipEyeL_${uid}`;
  const clipEyeRId = `crmClipEyeR_${uid}`;
  const softShadowId = `crmSoftShadow_${uid}`;

  const handleClick = () => {
    if (onTapCycle) {
      onTapCycle();
      return;
    }
    setLocalBounce(true);
    setExprIndex((prev) => (prev + 1) % EXPRESSION_SEQUENCE.length);
  };

  return (
    <div
      onClick={onTapCycle || controlledExpression ? undefined : handleClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onTapCycle || !controlledExpression ? 'pointer' : undefined,
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes crmMascotIdle {
          0% { transform: translate3d(0, 0px, 0) rotate(-1.1deg); }
          50% { transform: translate3d(0, -8px, 0) rotate(1.1deg); }
          100% { transform: translate3d(0, 0px, 0) rotate(-1.1deg); }
        }
        @keyframes crmMascotArmUpDown {
          0% { transform: rotate(-5deg) translate3d(0px, -0.5%, 0); }
          14% { transform: rotate(3deg) translate3d(2px, 0.4%, 0); }
          28% { transform: rotate(-4deg) translate3d(-1px, -0.4%, 0); }
          48% { transform: rotate(13deg) translate3d(3px, 1.3%, 0); }
          64% { transform: rotate(4deg) translate3d(1px, 0.5%, 0); }
          80% { transform: rotate(16deg) translate3d(4px, 1.6%, 0); }
          100% { transform: rotate(-5deg) translate3d(0px, -0.5%, 0); }
        }
        @keyframes crmMascotShadowIdle {
          0% { transform: translateX(-50%) scale(1); opacity: 0.92; }
          50% { transform: translateX(-50%) scale(0.9); opacity: 0.72; }
          100% { transform: translateX(-50%) scale(1); opacity: 0.92; }
        }
        @keyframes crmMascotPopBounce {
          0% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.08, 0.94) translateY(-10px) rotate(-2.5deg); }
          60% { transform: scale(0.97, 1.05) translateY(-16px) rotate(2.5deg); }
          82% { transform: scale(1.02, 0.98) translateY(-4px) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .crm-mascot-idle {
          animation: crmMascotIdle 4.8s ease-in-out infinite;
          transform-origin: 50% 84%;
          will-change: transform;
        }
        .crm-mascot-arm-updown {
          animation: crmMascotArmUpDown 3.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          transform-origin: 81.1% 38.2%;
          will-change: transform;
        }
        .crm-mascot-shadow-idle {
          animation: crmMascotShadowIdle 4.8s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .crm-mascot-pop-bounce {
          animation: crmMascotPopBounce 0.52s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .crm-mascot-idle,
          .crm-mascot-arm-updown,
          .crm-mascot-shadow-idle,
          .crm-mascot-pop-bounce {
            animation: none !important;
          }
        }
      `}</style>

      {/* Synchronized Ground Contact Shadow */}
      <div
        aria-hidden="true"
        className="crm-mascot-shadow-idle"
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

      <div className={bounced || localBounce ? 'crm-mascot-pop-bounce' : undefined}>
        <div
          className="crm-mascot-idle"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-block',
            filter: 'drop-shadow(0 12px 24px rgba(24, 54, 92, 0.16))',
          }}
        >
          {/* 1. Base Body Layer */}
          <img
            src="/images/lost-monster-body.png"
            alt="Animated fluffy blue CRM mascot moving its hand and changing expressions"
            draggable={false}
            style={{
              height,
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
              <radialGradient id={scleraLId} cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="68%" stopColor="#F1F5FA" />
                <stop offset="100%" stopColor="#C4D3E5" />
              </radialGradient>
              <radialGradient id={scleraRId} cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="68%" stopColor="#F1F5FA" />
                <stop offset="100%" stopColor="#C4D3E5" />
              </radialGradient>
              <linearGradient id={lidGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#65A8EB" />
                <stop offset="72%" stopColor="#4380C7" />
                <stop offset="100%" stopColor="#2A5894" />
              </linearGradient>
              <radialGradient id={squintGradId} cx="50%" cy="20%" r="80%">
                <stop offset="0%" stopColor="#5AA1E8" />
                <stop offset="65%" stopColor="#3B78BF" />
                <stop offset="100%" stopColor="#26508A" />
              </radialGradient>
              <linearGradient id={lipGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C1899B" />
                <stop offset="55%" stopColor="#9A6078" />
                <stop offset="100%" stopColor="#6D3F54" />
              </linearGradient>
              <clipPath id={clipEyeLId}>
                <ellipse cx="341.8" cy="136.8" rx="28" ry="26.4" />
              </clipPath>
              <clipPath id={clipEyeRId}>
                <ellipse cx="422.2" cy="152.2" rx="29.4" ry="27.2" />
              </clipPath>
              <filter id={softShadowId} x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="1" stdDeviation="2.2" floodColor="#10294B" floodOpacity="0.62" />
              </filter>
            </defs>

            {/* Left Eye */}
            <g clipPath={`url(#${clipEyeLId})`}>
              <ellipse cx="341.8" cy="136.8" rx="28.4" ry="26.8" fill={`url(#${scleraLId})`} />
              <ellipse
                cx="341.8"
                cy="136.8"
                rx="28"
                ry="26.4"
                fill="none"
                stroke="rgba(22, 48, 88, 0.28)"
                strokeWidth="3"
              />
              <g
                style={{
                  transform: `translate(${pupilDx}px, ${pupilDy}px) scale(${pose.pupilScale})`,
                  transformOrigin: '344px 137px',
                  transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle cx="344" cy="137" r="10.4" fill="#17202C" />
                <circle cx="344" cy="137" r="6.4" fill="#070B11" />
                <circle cx="340.5" cy="132.5" r="3.4" fill="#FFFFFF" />
                <circle cx="347.5" cy="140.5" r="1.4" fill="rgba(255,255,255,0.72)" />
              </g>
              <g
                style={{
                  transform: blinking
                    ? 'translateY(0px)'
                    : activeExpression === 'thinking'
                      ? 'translateY(-38px)'
                      : 'translateY(-60px)',
                  transition: blinking ? 'transform 0.08s ease-in' : 'transform 0.24s ease-out',
                }}
              >
                <rect x="308" y="108" width="68" height="58" rx="14" fill={`url(#${lidGradId})`} />
                <line x1="312" y1="164" x2="372" y2="164" stroke="#1E4478" strokeWidth="2.5" />
              </g>
              <ellipse
                cx="341.8"
                cy="171"
                rx="31"
                ry="11"
                fill={`url(#${squintGradId})`}
                stroke="#224A7E"
                strokeWidth="1.4"
                style={{
                  transform: `translateY(${pose.happySquint > 0 ? -pose.happySquint * 3.5 : 10}px)`,
                  transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </g>

            {/* Right Eye */}
            <g clipPath={`url(#${clipEyeRId})`}>
              <ellipse cx="422.2" cy="152.2" rx="29.8" ry="27.6" fill={`url(#${scleraRId})`} />
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
                  transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle cx="417" cy="152" r="10.7" fill="#17202C" />
                <circle cx="417" cy="152" r="6.6" fill="#070B11" />
                <circle cx="413.5" cy="147.5" r="3.5" fill="#FFFFFF" />
                <circle cx="420.5" cy="155.5" r="1.4" fill="rgba(255,255,255,0.72)" />
              </g>
              <g
                style={{
                  transform: blinking
                    ? 'translateY(0px)'
                    : activeExpression === 'thinking'
                      ? 'translateY(-40px)'
                      : 'translateY(-62px)',
                  transition: blinking ? 'transform 0.08s ease-in' : 'transform 0.24s ease-out',
                }}
              >
                <rect x="388" y="122" width="70" height="60" rx="14" fill={`url(#${lidGradId})`} />
                <line x1="392" y1="180" x2="454" y2="180" stroke="#1E4478" strokeWidth="2.5" />
              </g>
              <ellipse
                cx="422.2"
                cy="187"
                rx="32"
                ry="11"
                fill={`url(#${squintGradId})`}
                stroke="#224A7E"
                strokeWidth="1.4"
                style={{
                  transform: `translateY(${pose.happySquint > 0 ? -pose.happySquint * 3.5 : 10}px)`,
                  transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </g>

            {/* Dynamic Multi-Expression Mouth */}
            <g filter={`url(#${softShadowId})`}>
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
                  <path d="M 347 235 C 358 228, 381 228, 390 234 Z" fill="#944B61" />
                  <path
                    d="M 326 238 C 344 231, 389 229, 409 233 C 403 241, 390 239, 372 238 C 353 237, 336 243, 326 238 Z"
                    fill={`url(#${lipGradId})`}
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
                    fill={`url(#${lipGradId})`}
                  />
                  <ellipse cx="374" cy="233" rx="6.2" ry="3" fill="#944B61" />
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
                  <ellipse cx="369" cy="228" rx="16.5" ry="18.5" fill="#170A10" />
                  <path
                    d="M 358 214 C 365 213, 373 213, 380 214 L 378 219 C 371 220, 366 220, 360 219 Z"
                    fill="#F5F7FA"
                  />
                  <ellipse cx="369" cy="239" rx="9.5" ry="4.5" fill="#9A4E65" />
                  <path
                    d="M 353 232 C 357 248, 381 248, 385 232 C 380 242, 358 242, 353 232 Z"
                    fill={`url(#${lipGradId})`}
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
                  <path
                    d="M 332 219 C 345 246, 391 245, 404 218 C 394 240, 381 244, 368 244 C 355 244, 342 240, 332 219 Z"
                    fill={`url(#${lipGradId})`}
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
              transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
              transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
              transition: 'transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <img
              src="/images/lost-monster-arm.png"
              alt=""
              draggable={false}
              className="crm-mascot-arm-updown"
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
  );
}

