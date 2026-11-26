import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import '@/styles/globals.css';
import { AuthProvider } from '@/lib/client/auth-context';
import { Shell } from '@/components/layout/Shell';
import { PwaProvider } from '@/components/pwa/PwaInstallControl';

export const viewport: Viewport = {
  themeColor: '#6253F8',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'UNAI CRM',
    template: '%s | UNAI CRM',
  },
  description: 'Complete multi-tenant car dealership CRM, vehicle inventory, sales desk, finance, delivery, and after-sales platform.',
  applicationName: 'UNAI CRM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UNAI CRM',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawSession = typeof cookieStore?.get === 'function' ? cookieStore.get('crm-employee-session')?.value : undefined;
  const rawDealershipName = typeof cookieStore?.get === 'function' ? cookieStore.get('crm-dealership-name')?.value : undefined;

  let initialSession = null;
  if (rawSession) {
    try {
      initialSession = JSON.parse(decodeURIComponent(rawSession));
    } catch (e) {
      initialSession = null;
    }
  }

  let initialDealershipName = '';
  if (rawDealershipName) {
    try {
      initialDealershipName = decodeURIComponent(rawDealershipName);
    } catch (e) {
      initialDealershipName = '';
    }
  }
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Font Origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap"
        />

        {/* Critical CSS fallback to guarantee immediate render without blocking */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --font: 'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                --bg: #FFFFFF;
                --solid: #FFFFFF;
                --float: #FAFBF9;
                --text: #17191A;
                --muted: #5E6360;
                --line: rgba(98, 83, 248, 0.10);
                --pearl-green: #6253F8;
                --dock: #18153B;
                --dock-gradient: linear-gradient(135deg, #7957F6 0%, #6253F8 50%, #4054F5 100%);
                --pill: #6253F8;
                --on-pill: #FFFFFF;
                --primary-gradient: linear-gradient(135deg, #7957F6 0%, #6253F8 50%, #4054F5 100%);
                --tomato: #C8431F;
                --butter: #F2C94C;
                --r-card: 26px;
                --r-tile: 20px;
                --r-ctl: 999px;
              }
              *, *::before, *::after {
                box-sizing: border-box;
              }
              html, body {
                font-family: var(--font);
                background-color: #FFFFFF;
                background-image: 
                  radial-gradient(at 0% 0%, #F4F7F5 0px, transparent 50%),
                  radial-gradient(at 100% 0%, #F7F5F2 0px, transparent 50%),
                  radial-gradient(at 50% 100%, #F2F5F8 0px, transparent 40%),
                  linear-gradient(180deg, #FFFFFF 0%, #F8FAF9 100%);
                background-attachment: fixed;
                color: #17191A;
                margin: 0;
                padding: 0;
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
                -webkit-font-smoothing: antialiased;
              }
              .app-shell {
                display: flex;
                flex-direction: column;
                min-height: 100vh;
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
                box-sizing: border-box;
              }
              .app-main {
                width: 100%;
                max-width: 1480px;
                margin: 0 auto;
                padding: 16px 24px 48px;
                box-sizing: border-box;
                overflow-x: hidden;
              }
              /* Top Bar Skeleton: Locks height and layout before external CSS loads to guarantee 0.000 CLS */
              .top-bar {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                height: 52px !important;
                min-height: 52px !important;
                margin-bottom: 22px !important;
                gap: 16px !important;
                width: 100% !important;
                box-sizing: border-box !important;
                flex-wrap: nowrap !important;
              }
              .brand-link {
                display: inline-flex !important;
                align-items: center !important;
                gap: 10px !important;
                text-decoration: none !important;
                flex-shrink: 0 !important;
              }
              .brand-logo-img {
                width: 34px !important;
                height: 34px !important;
                border-radius: 9px !important;
                object-fit: contain !important;
                display: block !important;
              }
              .brand-title {
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #17191A !important;
                letter-spacing: -0.02em !important;
                white-space: nowrap !important;
              }
              .nav-pills {
                display: flex !important;
                align-items: center !important;
                gap: 2px !important;
                flex: 1 1 auto !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                list-style: none !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 42px !important;
              }
              .nav-pill {
                display: inline-flex !important;
                align-items: center !important;
                white-space: nowrap !important;
                text-decoration: none !important;
                font-size: 0.82rem !important;
                padding: 6px 11px !important;
              }
              .top-bar__right {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-shrink: 0 !important;
              }
              /* Base Mobile-First Layout Rules (Eliminates CLS on mobile & desktop from initial paint) */
              .mobile-quick-access-wrap {
                display: block !important;
                padding: 0 0 14px 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
              .mobile-quick-access-card {
                border-radius: 20px !important;
                padding: 14px 10px !important;
                width: 100% !important;
                box-sizing: border-box !important;
                background: linear-gradient(180deg, #FFFFFF 0%, #FAFAFF 100%) !important;
                border: 1.2px solid rgba(98, 83, 248, 0.12) !important;
              }
              .mobile-quick-access-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                margin-bottom: 12px !important;
                padding-bottom: 10px !important;
                border-bottom: 1px solid rgba(98, 83, 248, 0.08) !important;
              }
              .mobile-qa-header-left {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
              }
              .mobile-qa-header-icon {
                width: 28px !important;
                height: 28px !important;
                border-radius: 8px !important;
                background: #EEF2FF !important;
                color: #6253F8 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .mobile-qa-title-group {
                display: flex !important;
                flex-direction: column !important;
                line-height: 1.2 !important;
              }
              .mobile-qa-title {
                font-size: 0.80rem !important;
                font-weight: 800 !important;
                color: #1E293B !important;
                letter-spacing: 0.03em !important;
                text-transform: uppercase !important;
              }
              .mobile-qa-subtitle {
                font-size: 0.64rem !important;
                color: #64748B !important;
                font-weight: 500 !important;
              }
              .mobile-qa-badge {
                font-size: 0.68rem !important;
                font-weight: 700 !important;
                color: #6253F8 !important;
                background: #EEF2FF !important;
                padding: 3px 9px !important;
                border-radius: 999px !important;
                border: 1px solid rgba(98, 83, 248, 0.15) !important;
                white-space: nowrap !important;
              }
              .mobile-quick-access-grid {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 12px 4px !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
              .mobile-qa-item {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                text-decoration: none !important;
              }
              .mobile-qa-icon-badge {
                width: 48px !important;
                height: 48px !important;
                border-radius: 16px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .mobile-qa-label {
                margin-top: 6px !important;
                font-size: 0.69rem !important;
                font-weight: 600 !important;
                color: #334155 !important;
                text-align: center !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                max-width: 72px !important;
                line-height: 1.25 !important;
              }
              .mobile-subpage-back-wrap {
                display: block !important;
              }
              .page-transition-wrap {
                width: 100% !important;
                box-sizing: border-box !important;
              }

              /* Desktop Screens (>768px): Hide mobile elements and restore full top bar nav pills */
              @media (min-width: 769px) {
                .mobile-quick-access-wrap,
                .mobile-subpage-back-wrap {
                  display: none !important;
                }
              }

              /* Mobile Screens (<=768px): Keep top bar & hero header flush and stable */
              @media (max-width: 768px) {
                .app-main {
                  padding: 12px 14px 40px 14px !important;
                }
                .top-bar {
                  height: auto !important;
                  min-height: auto !important;
                  padding: 4px 0 10px 0 !important;
                  gap: 12px !important;
                  margin-bottom: 8px !important;
                }
                .top-bar .nav-pills {
                  display: none !important;
                }
                .brand-logo-img {
                  width: 38px !important;
                  height: 38px !important;
                  border-radius: 10px !important;
                }
                .hero-header {
                  display: flex !important;
                  flex-direction: column !important;
                  margin-bottom: 16px !important;
                  gap: 12px !important;
                }
                .hero-title-wrap {
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 2px !important;
                  width: 100% !important;
                }
                .hero-title {
                  font-size: 1.35rem !important;
                  font-weight: 800 !important;
                  letter-spacing: -0.025em !important;
                  line-height: 1.15 !important;
                  margin: 0 !important;
                }
                .hero-subtitle {
                  font-size: 0.72rem !important;
                  color: #64748B !important;
                  line-height: 1.35 !important;
                  font-weight: 500 !important;
                  margin: 0 !important;
                }
                .hero-stats-row {
                  display: grid !important;
                  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                  gap: 8px !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                  margin-top: 4px !important;
                  padding: 0 !important;
                }
                .hero-stat-badge {
                  background: #FFFFFF !important;
                  border: 1px solid rgba(98, 83, 248, 0.12) !important;
                  border-radius: 16px !important;
                  padding: 10px 8px !important;
                  box-sizing: border-box !important;
                }
              }
            `,
          }}
        />

      </head>
      <body>
        <PwaProvider>
          <AuthProvider>
            <Shell
              initialSession={initialSession}
              initialDealershipName={initialDealershipName}
            >
              {children}
            </Shell>
          </AuthProvider>
        </PwaProvider>
        {/* Client-side Session & Branding Cookie Sync (afterInteractive avoids React script-tag warnings) */}
        <Script
          id="crm-sync-session-branding"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var s = localStorage.getItem('crm_active_user_session_v1');
                  if (s && !document.cookie.includes('crm-employee-session=')) {
                    var sess = JSON.parse(s);
                    var cookieData = {
                      id: sess.employeeId || sess.userId,
                      userId: sess.employeeCode || sess.userId,
                      employeeCode: sess.employeeCode || sess.userId,
                      fullName: sess.fullName,
                      email: sess.email,
                      role: sess.role,
                      department: sess.department || 'Sales',
                      designation: sess.role === 'sales_executive' ? 'Sales Executive' : (sess.designation || 'Staff Member'),
                      branch: sess.branch || '',
                      accessControl: sess.accessControl,
                      avatarUrl: sess.avatarUrl,
                      phone: sess.phone
                    };
                    document.cookie = 'crm-employee-session=' + encodeURIComponent(JSON.stringify(cookieData)) + '; path=/; max-age=604800; SameSite=Lax';
                  }
                  var c = localStorage.getItem('crm_dealership_company_profile_v1');
                  if (c) {
                    var cp = JSON.parse(c);
                    var name = cp.tradeName || cp.legalName || '';
                    if (name) {
                      if (!document.cookie.includes('crm-dealership-name=')) {
                        document.cookie = 'crm-dealership-name=' + encodeURIComponent(name) + '; path=/; max-age=604800; SameSite=Lax';
                      }
                      var applyBrandDom = function() {
                        var titleEl = document.getElementById('top-bar-brand-title');
                        if (titleEl && (!titleEl.textContent || !titleEl.textContent.trim())) {
                          titleEl.textContent = name;
                          titleEl.style.display = '';
                        }
                        var badgeEl = document.getElementById('top-bar-brand-badge');
                        if (badgeEl && (!badgeEl.textContent || !badgeEl.textContent.trim())) {
                          badgeEl.textContent = name.charAt(0).toUpperCase();
                          badgeEl.style.display = '';
                        }
                      };
                      if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', applyBrandDom);
                      } else {
                        applyBrandDom();
                      }
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
