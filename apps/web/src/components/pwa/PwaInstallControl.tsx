'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  CheckCircle2,
  Download,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextValue {
  hasMounted: boolean;
  canNativePrompt: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isInstalling: boolean;
  triggerInstall: () => Promise<void>;
  openGuide: () => void;
}

const PwaContext = createContext<PwaContextValue>({
  hasMounted: false,
  canNativePrompt: false,
  isInstalled: false,
  isIos: false,
  isInstalling: false,
  triggerInstall: async () => {},
  openGuide: () => {},
});

export function usePwaInstall() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalledBanner, setJustInstalledBanner] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window === 'undefined') return;

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const checkInstalled = () => {
      const iosStandalone =
        Boolean((window.navigator as { standalone?: boolean }).standalone);
      setIsInstalled(standaloneQuery.matches || iosStandalone);
    };

    checkInstalled();

    const ua = window.navigator.userAgent || '';
    const isiOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Mac') && 'ontouchend' in document);
    setIsIos(isiOSDevice);

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch(() => {
          // Non-fatal in private browsing or restricted origins
        });
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowGuideModal(false);
      setJustInstalledBanner(true);
      window.setTimeout(() => setJustInstalledBanner(false), 3800);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery.addEventListener?.('change', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener?.('change', checkInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) return;

    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch {
        setShowGuideModal(true);
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    setShowGuideModal(true);
  }, [deferredPrompt, isInstalled]);

  return (
    <PwaContext.Provider
      value={{
        hasMounted,
        canNativePrompt: Boolean(deferredPrompt),
        isInstalled,
        isIos,
        isInstalling,
        triggerInstall,
        openGuide: () => setShowGuideModal(true),
      }}
    >
      {children}

      {justInstalledBanner && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100001,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '999px',
            backgroundColor: '#18153B',
            color: '#FFFFFF',
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: '0 14px 30px rgba(24, 21, 59, 0.28)',
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#34D399' }} />
          <span>UNAI CRM installed as app</span>
        </div>
      )}

      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#FFFFFF',
              borderRadius: '22px',
              border: '1px solid rgba(98, 83, 248, 0.14)',
              boxShadow: '0 24px 60px -15px rgba(24, 21, 59, 0.28)',
              padding: '22px',
              color: '#17191A',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/icons/icon-192x192.png"
                  alt="UNAI CRM"
                  width={36}
                  height={36}
                  style={{ borderRadius: '10px', objectFit: 'contain' }}
                />
                <div>
                  <h2
                    id="pwa-install-title"
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Install UNAI CRM
                  </h2>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: '0.75rem',
                      color: '#64748B',
                      fontWeight: 500,
                    }}
                  >
                    Launch directly from your home screen or dock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install guide"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {isIos ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  backgroundColor: '#FAF8FF',
                  border: '1px solid rgba(98, 83, 248, 0.14)',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '0.84rem',
                  color: '#334155',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Share size={17} style={{ color: '#6253F8', flexShrink: 0 }} />
                  <span>
                    1. Tap the <strong>Share</strong> button in Safari&rsquo;s bar.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <PlusSquare size={17} style={{ color: '#6253F8', flexShrink: 0 }} />
                  <span>
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  backgroundColor: '#FAF8FF',
                  border: '1px solid rgba(98, 83, 248, 0.14)',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '0.84rem',
                  color: '#334155',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Download size={17} style={{ color: '#6253F8', flexShrink: 0 }} />
                  <span>
                    Click the <strong>Install app</strong> icon in your browser&rsquo;s address bar.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={17} style={{ color: '#6253F8', flexShrink: 0 }} />
                  <span>
                    Or open the browser menu and select{' '}
                    <strong>Install UNAI CRM</strong> / <strong>Add to Home Screen</strong>.
                  </span>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    'linear-gradient(135deg, #7957F6 0%, #6253F8 50%, #4054F5 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function PwaInstallButton({
  variant = 'circle',
  buttonStyle,
}: {
  variant?: 'circle' | 'floating';
  buttonStyle?: React.CSSProperties;
}) {
  const {
    hasMounted,
    canNativePrompt,
    isInstalled,
    isInstalling,
    triggerInstall,
  } = usePwaInstall();

  // Render only after client hydration so standalone display-mode checks and SSR HTML always match
  if (!hasMounted || isInstalled) {
    return null;
  }

  if (variant === 'floating') {
    return (
      <button
        type="button"
        onClick={triggerInstall}
        disabled={isInstalling}
        title={canNativePrompt ? 'Install UNAI CRM App' : 'Install App'}
        aria-label="Install UNAI CRM App"
        style={{
          position: 'fixed',
          top: '16px',
          right: '18px',
          zIndex: 60,
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)',
          border: canNativePrompt
            ? '1.5px solid rgba(98, 83, 248, 0.45)'
            : '1px solid rgba(98, 83, 248, 0.18)',
          color: '#6253F8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isInstalling ? 'wait' : 'pointer',
          boxShadow: '0 6px 18px rgba(98, 83, 248, 0.14)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <Download size={17} />
        {canNativePrompt && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#6253F8',
              border: '2px solid #FFFFFF',
            }}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={triggerInstall}
      disabled={isInstalling}
      className="icon-circle-btn"
      title={canNativePrompt ? 'Install UNAI CRM App' : 'Install App'}
      aria-label="Install UNAI CRM App"
      style={{
        position: 'relative',
        color: canNativePrompt ? 'var(--pearl-green)' : 'var(--muted)',
        borderColor: canNativePrompt ? 'var(--pearl-green-border)' : undefined,
        cursor: isInstalling ? 'wait' : 'pointer',
        ...buttonStyle,
      }}
    >
      <Download size={16} />
      {canNativePrompt && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: '#6253F8',
            border: '2px solid var(--solid)',
          }}
        />
      )}
    </button>
  );
}

