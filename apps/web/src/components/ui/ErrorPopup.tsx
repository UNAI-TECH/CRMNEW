'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, X, Copy, Check, ShieldAlert } from 'lucide-react';

export interface ErrorPopupDetail {
  title?: string;
  message: string;
  details?: string;
  actionLabel?: string;
}

export interface ErrorPopupProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  details?: string;
  actionLabel?: string;
  listenGlobal?: boolean;
}

/**
 * Global utility to trigger an Error Pop-up from anywhere in the application
 */
export function triggerErrorPopup(message: string, title?: string, details?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('crm-error-popup', {
        detail: {
          message,
          title: title || 'Error Occurred',
          details,
        },
      })
    );
  }
}

export function ErrorPopup({
  isOpen: propIsOpen,
  onClose: propOnClose,
  title: propTitle,
  message: propMessage,
  details: propDetails,
  actionLabel = 'Understood',
  listenGlobal = true,
}: ErrorPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [globalError, setGlobalError] = useState<ErrorPopupDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (!listenGlobal) return;

    const handleCustomError = (e: Event) => {
      const customEvent = e as CustomEvent<ErrorPopupDetail>;
      if (customEvent.detail && customEvent.detail.message) {
        setGlobalError({
          title: customEvent.detail.title || 'Error Occurring',
          message: customEvent.detail.message,
          details: customEvent.detail.details,
          actionLabel: customEvent.detail.actionLabel || 'Understood',
        });
        setShowTechnicalDetails(false);
      }
    };

    window.addEventListener('crm-error-popup', handleCustomError);
    return () => {
      window.removeEventListener('crm-error-popup', handleCustomError);
    };
  }, [listenGlobal]);

  // Determine active display state
  const isControlled = typeof propIsOpen === 'boolean';
  const isVisible = isControlled ? propIsOpen : Boolean(globalError);
  const activeTitle = (isControlled ? propTitle : globalError?.title) || 'Error Occurred';
  const activeMessage = (isControlled ? propMessage : globalError?.message) || '';
  const activeDetails = isControlled ? propDetails : globalError?.details;

  const handleClose = () => {
    if (isControlled && propOnClose) {
      propOnClose();
    } else {
      setGlobalError(null);
    }
  };

  const handleCopyDetails = () => {
    const textToCopy = `${activeTitle}\n${activeMessage}\n\nTechnical Details:\n${activeDetails || 'None'}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted || !isVisible || !activeMessage) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 99999,
        animation: 'errorFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={handleClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-desc"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25), 0 0 0 1px rgba(239, 68, 68, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'errorScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            height: '6px',
            width: '100%',
            background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 50%, #F87171 100%)',
          }}
        />

        <div style={{ padding: '24px 26px 20px' }}>
          {/* Header row with Icon, Title, and Close Button */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FCA5A5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.12)',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#DC2626',
                    backgroundColor: '#FEE2E2',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'inline-block',
                    marginBottom: '4px',
                  }}
                >
                  Error Detected
                </span>
                <h3
                  id="error-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    lineHeight: '1.25',
                  }}
                >
                  {activeTitle}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Error Message Body */}
          <div
            id="error-dialog-desc"
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECDD3',
              color: '#991B1B',
              fontSize: '0.9rem',
              lineHeight: '1.5',
              fontWeight: 500,
              wordBreak: 'break-word',
            }}
          >
            {activeMessage}
          </div>

          {/* Optional Technical Details Toggle */}
          {activeDetails && (
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {showTechnicalDetails ? 'Hide Technical Details ▲' : 'View Technical Details ▼'}
                </button>

                {showTechnicalDetails && (
                  <button
                    type="button"
                    onClick={handleCopyDetails}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    {copied ? <Check size={12} style={{ color: '#10B981' }} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy Error'}</span>
                  </button>
                )}
              </div>

              {showTechnicalDetails && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    color: '#F87171',
                    fontSize: '0.74rem',
                    fontFamily: 'monospace',
                    maxHeight: '130px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: '1.4',
                  }}
                >
                  {activeDetails}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 26px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            autoFocus
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes errorFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes errorScaleIn {
          from {
            opacity: 0;
            transform: scale(0.94);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

