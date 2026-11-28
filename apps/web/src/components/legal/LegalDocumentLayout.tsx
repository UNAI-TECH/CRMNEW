'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/client/auth-context';
import { PwaInstallButton } from '@/components/pwa/PwaInstallControl';

export interface LegalSection {
  id: string;
  number: string;
  title: string;
  summary?: string;
  content: React.ReactNode;
}

interface LegalDocumentLayoutProps {
  activeDoc: 'privacy' | 'terms';
  badgeLabel: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  lastUpdated: string;
  highlights: string[];
  sections: LegalSection[];
}

export function LegalDocumentLayout({
  activeDoc,
  badgeLabel,
  title,
  subtitle,
  effectiveDate,
  lastUpdated,
  highlights,
  sections,
}: LegalDocumentLayoutProps) {
  const { isLoggedIn, activeRole, isMounted } = useAuth();
  const [backHref, setBackHref] = useState('/');
  const [backLabel, setBackLabel] = useState('Back to Home');

  useEffect(() => {
    if (!isMounted) return;
    if (isLoggedIn) {
      const isStaffOnly =
        activeRole !== 'tenant_admin' && activeRole !== 'branch_manager';
      setBackHref(isStaffOnly ? '/empportal' : '/dashboard');
      setBackLabel('Back to Workspace');
    } else {
      setBackHref('/');
      setBackLabel('Back to Home');
    }
  }, [isLoggedIn, activeRole, isMounted]);

  return (
    <div
      className="legal-printable-doc"
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#FFFFFF',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(121, 87, 246, 0.06) 0px, transparent 52%),
          radial-gradient(at 100% 0%, rgba(64, 84, 245, 0.05) 0px, transparent 48%),
          linear-gradient(180deg, #FAFAFF 0%, #FFFFFF 36%, #F8FAFC 100%)
        `,
        color: '#17191A',
        fontFamily:
          "var(--font, 'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
      <style>{`
        .legal-header-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .legal-main-grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 20px 64px;
          display: grid;
          grid-template-columns: 270px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }
        .legal-toc-card {
          position: sticky;
          top: 84px;
          background: #FFFFFF;
          border: 1px solid rgba(98, 83, 248, 0.14);
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 12px 30px -18px rgba(98, 83, 248, 0.18);
        }
        .legal-toc-link {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .legal-toc-link:hover {
          background-color: #FAF8FF;
          color: #6253F8;
        }
        .legal-section-card {
          background: #FFFFFF;
          border: 1px solid rgba(98, 83, 248, 0.12);
          border-radius: 22px;
          padding: 26px 28px;
          box-shadow: 0 12px 32px -22px rgba(15, 23, 42, 0.14);
          scroll-margin-top: 90px;
        }
        .legal-section-body {
          color: #334155;
          font-size: 0.94rem;
          line-height: 1.72;
        }
        .legal-section-body p {
          margin: 0 0 12px 0;
        }
        .legal-section-body p:last-child {
          margin-bottom: 0;
        }
        .legal-section-body ul {
          margin: 8px 0 12px 0;
          padding-left: 20px;
        }
        .legal-section-body li {
          margin-bottom: 7px;
        }
        .legal-section-body strong {
          color: #0F172A;
          font-weight: 700;
        }
        .legal-highlight-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }
        @media (max-width: 920px) {
          .legal-main-grid {
            grid-template-columns: 1fr;
            gap: 20px;
            padding: 20px 16px 48px;
          }
          .legal-toc-card {
            position: static;
          }
          .legal-section-card {
            padding: 20px 18px;
            border-radius: 18px;
          }
          .legal-highlight-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Sticky Top Header */}
      <header
        className="legal-no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(98, 83, 248, 0.10)',
        }}
      >
        <div className="legal-header-inner">
          {/* Left: Brand & Back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href={backHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
                color: '#17191A',
              }}
            >
              <img
                src="/unai-logo.png"
                alt="UNAI CRM"
                width={94}
                height={32}
                style={{ height: '30px', width: 'auto', objectFit: 'contain', display: 'block' }}
              />
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  color: '#17191A',
                }}
              >
                UNAI CRM
              </span>
            </Link>
          </div>

          {/* Center Switcher Pill: Privacy Policy <-> Terms of Service */}
          <nav
            aria-label="Legal Documents"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px',
              borderRadius: '999px',
              backgroundColor: '#F5F3FF',
              border: '1px solid rgba(98, 83, 248, 0.14)',
            }}
          >
            <Link
              href="/privacy"
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                backgroundColor: activeDoc === 'privacy' ? '#6253F8' : 'transparent',
                color: activeDoc === 'privacy' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                backgroundColor: activeDoc === 'terms' ? '#6253F8' : 'transparent',
                color: activeDoc === 'terms' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              Terms of Service
            </Link>
          </nav>

          {/* Right: Print, Install Icon & Back Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PwaInstallButton variant="circle" />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="icon-circle-btn"
              title="Print or Save as PDF"
              aria-label="Print or Save Legal Document"
              style={{ cursor: 'pointer', color: '#475569' }}
            >
              <Printer size={15} />
            </button>
            <Link
              href={backHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(98, 83, 248, 0.18)',
                color: '#6253F8',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} />
              <span>{backLabel}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '32px 20px 4px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(98, 83, 248, 0.14)',
            borderRadius: '24px',
            padding: 'clamp(22px, 3vw, 34px)',
            boxShadow: '0 20px 45px -24px rgba(98, 83, 248, 0.18)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(98, 83, 248, 0.08)',
              color: '#6253F8',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            {activeDoc === 'privacy' ? (
              <ShieldCheck size={14} />
            ) : (
              <FileText size={14} />
            )}
            <span>{badgeLabel}</span>
          </div>

          <h1
            style={{
              margin: '0 0 10px 0',
              fontSize: 'clamp(1.75rem, 3.8vw, 2.5rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              color: '#0F172A',
            }}
          >
            {title}
          </h1>

          <p
            style={{
              margin: '0 0 16px 0',
              maxWidth: '780px',
              fontSize: '0.96rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '16px',
              fontSize: '0.8rem',
              color: '#64748B',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: '#6253F8' }} />
              Effective: <strong style={{ color: '#0F172A' }}>{effectiveDate}</strong>
            </span>
            <span>•</span>
            <span>
              Last Updated: <strong style={{ color: '#0F172A' }}>{lastUpdated}</strong>
            </span>
            <span>•</span>
            <span>Applies to: UNAI CRM Web App, Staff Portal &amp; Installable PWA</span>
          </div>

          {/* 3-Point Quick Highlights */}
          <div className="legal-highlight-grid">
            {highlights.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '11px 13px',
                  borderRadius: '14px',
                  backgroundColor: '#FAF8FF',
                  border: '1px solid rgba(98, 83, 248, 0.12)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#334155',
                  lineHeight: 1.4,
                }}
              >
                <CheckCircle2
                  size={15}
                  style={{ color: '#6253F8', flexShrink: 0, marginTop: '2px' }}
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area: Sticky TOC Sidebar + Sections */}
      <main className="legal-main-grid">
        <aside className="legal-toc-card legal-no-print" aria-label="Section Index">
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#6253F8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
              paddingLeft: '10px',
            }}
          >
            Contents ({sections.length} Sections)
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="legal-toc-link"
              >
                <span style={{ color: '#6253F8', fontWeight: 800, flexShrink: 0 }}>
                  {section.number}
                </span>
                <span>{section.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="legal-section-card"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid rgba(98, 83, 248, 0.08)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '30px',
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '9px',
                    backgroundColor: '#EEF2FF',
                    color: '#6253F8',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  {section.number}
                </span>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.14rem',
                      fontWeight: 800,
                      color: '#0F172A',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {section.title}
                  </h2>
                  {section.summary && (
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '0.78rem',
                        color: '#64748B',
                        fontWeight: 500,
                      }}
                    >
                      {section.summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="legal-section-body">{section.content}</div>
            </section>
          ))}
        </div>
      </main>

      {/* Bottom Legal Navigation Footer */}
      <footer
        className="legal-no-print"
        style={{
          borderTop: '1px solid rgba(98, 83, 248, 0.10)',
          backgroundColor: '#FFFFFF',
          padding: '22px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '0.8rem',
            color: '#64748B',
          }}
        >
          <span>
            &copy; 2026 <strong style={{ color: '#0F172A' }}>UNAI TECH (UNAI CRM)</strong>. All rights reserved.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <Link href="/privacy" style={{ color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
              Terms of Service
            </Link>
            <Link href="/login" style={{ color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
              Admin Login
            </Link>
            <Link href="/emplogin" style={{ color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
              Staff Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

