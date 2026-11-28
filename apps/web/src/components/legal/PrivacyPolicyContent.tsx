'use client';

import React from 'react';
import {
  LegalDocumentLayout,
  LegalSection,
} from '@/components/legal/LegalDocumentLayout';

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'overview-scope',
    number: '01',
    title: 'Overview & Multi-Tenant Scope',
    summary: 'How this policy applies across dealership workspaces, portals, and PWA installations.',
    content: (
      <>
        <p>
          This Privacy Policy explains how <strong>UNAI TECH</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;UNAI CRM&rdquo;) collects, processes, stores, and protects information when dealerships, dealership administrators, authorized employees, and visitors access or use the <strong>UNAI CRM</strong> web platform and Progressive Web App (&ldquo;PWA&rdquo;).
        </p>
        <p>
          <strong>Tenant Data Controller vs. Platform Processor Role:</strong> Each participating automotive dealership (&ldquo;Dealership Tenant&rdquo;) acts as the Data Controller for end-customer, prospect, sales, inventory, and employee records entered into its workspace. UNAI CRM operates as the multi-tenant software platform and Data Processor on the Dealership Tenant&rsquo;s behalf, and as Data Controller only for platform account authentication, onboarding, and security audit metadata.
        </p>
      </>
    ),
  },
  {
    id: 'information-collected',
    number: '02',
    title: 'Information We Collect Across UNAI CRM',
    summary: 'Onboarding records, staff authentication data, customer CRM logs, files, and device metadata.',
    content: (
      <>
        <p>Depending on your role and enabled dealership modules, UNAI CRM processes the following categories of data:</p>
        <ul>
          <li>
            <strong>Dealership Legal Entity &amp; Statutory Setup (/onboarding &amp; /settings):</strong> Registered legal name, trade display name, GSTIN, PAN, TAN, business email, business phone, showroom and multi-branch addresses, postal PIN code/locality data, invoice banking details, dealership module configurations, uploaded brand logos, and authorized signatory signature images.
          </li>
          <li>
            <strong>Administrator &amp; Staff Account Credentials (/login, /emplogin, /employees):</strong> Full name, email address, employee User ID / employee code, role assignments (such as Tenant Admin, Branch Manager, Finance Manager, Sales Executive, Inventory Manager, or Service Advisor), department, phone number, profile avatar, granular module permissions, and salted/hashed authentication secrets.
          </li>
          <li>
            <strong>Lead, Customer &amp; Showroom Operations (/crm/*, /test-drives, /sales/*, /finance):</strong> Prospect and customer contact information, vehicle inquiries, custom pipeline stages, follow-up notes, scheduled appointments, test-drive logs, stockyard/vehicle procurement records, quotations, finance calculations, GST tax invoices, and delivery clearance checklists.
          </li>
          <li>
            <strong>Uploaded Dealership &amp; Compliance Documents (/documents):</strong> Supporting PDFs, certificates, customer identity/RTO paperwork, insurance policy certificates, and delivery dossiers stored in private cloud storage buckets.
          </li>
          <li>
            <strong>Device, Session &amp; PWA Storage Data:</strong> Signed session tokens, role cookies, client workspace cache keys, and static PWA offline resources used to maintain responsive login and multi-branch performance.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'google-oauth-data',
    number: '03',
    title: 'Google OAuth & Identity Integration',
    summary: 'Strict limited use of Google Sign-In identity data during onboarding and sign-in.',
    content: (
      <>
        <p>
          Dealership administrators may authenticate or initiate onboarding using <strong>Continue with Google</strong> (/auth/google &amp; /auth/callback), powered by Supabase Authentication. When you use Google Sign-In, UNAI CRM receives only basic identity profile information permitted by the Google OAuth consent screen — typically your name, verified Google email address, profile photo URL, and authentication subject identifier.
        </p>
        <p>
          <strong>Limited Use Commitment:</strong> UNAI CRM does <strong>not</strong> access Gmail messages, Google Drive files, Google Calendar, Contacts, or unrelated Google account scopes unless an explicit optional integration is later authorized by your workspace administrator. Authentication identity information received from Google is used strictly to verify your session, prevent unauthorized workspace access, and associate your administrator profile with your Dealership Tenant.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-data',
    number: '04',
    title: 'How We Use Information',
    summary: 'Strictly operational use for dealership CRM workflows, invoicing, access control, and security.',
    content: (
      <>
        <p>We use collected information solely to provide, secure, and improve UNAI CRM:</p>
        <ul>
          <li>Provisioning isolated multi-tenant dealership workspaces, branding, and custom pipeline stages.</li>
          <li>Authenticating administrators and staff and enforcing role-based access control (RBAC) across sensitive routes such as Finance, Employees, and Settings.</li>
          <li>Generating downloadable/printable GST quotations, official tax invoices, payment schedules, and customer receipts cleanly formatted with your dealership logo and signatory details.</li>
          <li>Managing private document uploads and generating short-lived signed URLs for authorized viewing or download.</li>
          <li>Detecting unauthorized API requests (HTTP 401/403 enforcement), preventing abuse, and preserving system integrity.</li>
        </ul>
        <p>
          <strong>No Sale of Personal Data:</strong> We never sell, rent, or trade dealership business records, employee details, or end-customer CRM data to third-party data brokers or advertisers.
        </p>
      </>
    ),
  },
  {
    id: 'tenant-isolation-security',
    number: '05',
    title: 'Multi-Tenant Isolation & Security Controls',
    summary: 'Row-Level Security (RLS), cryptographic session cookies, signed URLs, and password protections.',
    content: (
      <>
        <p>
          UNAI CRM is engineered for strict data segregation across dealerships and organizational roles:
        </p>
        <ul>
          <li>
            <strong>Tenant Row-Level Security (RLS):</strong> Database tables and storage paths are partitioned by Dealership Tenant identifier with database-level RLS policies so one dealership cannot query or alter another dealership&rsquo;s records.
          </li>
          <li>
            <strong>Transport &amp; Session Integrity:</strong> Production traffic is encrypted over HTTPS/TLS, API endpoints reject unauthenticated requests, and session state utilizes HMAC-signed cookies and short-lived bearer tokens validated in Edge middleware and server handlers.
          </li>
          <li>
            <strong>Private File Storage:</strong> Uploaded dealership logos, signatures, and documents are stored in private Supabase Storage buckets accessed via expiring server-issued signed URLs rather than public unauthenticated bucket listings.
          </li>
          <li>
            <strong>Staff Credential Hardening:</strong> Employee logins enforce User ID matching, first-time permanent strong password setup, and cryptographic hashing.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies-pwa-storage',
    number: '06',
    title: 'Cookies, Local Storage & PWA Offline Behavior',
    summary: 'How essential cookies, browser storage, and Service Worker caches operate safely.',
    content: (
      <>
        <p>UNAI CRM uses essential browser storage mechanisms strictly to keep workspaces fast and authenticated:</p>
        <ul>
          <li>
            <strong>Session &amp; Routing Cookies:</strong> Essential cookies (including signed session tokens, role/onboarding indicators, and active dealership name cache) keep you signed in securely across page reloads and allow server components to render consistent dealership branding without flash.
          </li>
          <li>
            <strong>Browser Local Storage:</strong> Used for active UI preferences, pipeline stage caches, dealership logo thumbnails, and workspace session synchronization across tabs; cleared upon signing out.
          </li>
          <li>
            <strong>PWA Service Worker (/sw.js):</strong> When installed as a Progressive Web App, the Service Worker caches static application shell scripts, icons, and an offline fallback screen (/offline.html). Authenticated CRM and API responses under <code>/api/*</code> and <code>/auth/*</code> are strictly excluded from offline caches so sensitive financial or customer payloads are never served stale from device cache.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'retention-deletion',
    number: '07',
    title: 'Data Retention & Deletion',
    summary: 'Retention throughout active tenant usage, statutory invoicing needs, and deletion requests.',
    content: (
      <>
        <p>
          Dealership Tenant CRM data, leads, vehicle logs, and documents are retained for as long as the dealership maintains an active workspace or as required to satisfy applicable commercial, GST tax, and audit recordkeeping obligations.
        </p>
        <p>
          Tenant Administrators may update or remove leads, employees, inventory units, and documents directly within the platform at any time. Upon verified workspace termination or administrator deletion request, tenant records are scheduled for purge from active systems after any applicable legal retention or recovery grace window expires.
        </p>
      </>
    ),
  },
  {
    id: 'privacy-rights',
    number: '08',
    title: 'Privacy Rights & End-Customer Requests',
    summary: 'Access, correction, export, and how showroom customers should contact their dealership.',
    content: (
      <>
        <p>
          Depending on applicable data protection legislation (including India&rsquo;s Digital Personal Data Protection Act, GDPR, or similar regional frameworks), individuals may have the right to request access, correction, updating, or deletion of their personal data, or to withdraw consent for optional communications.
        </p>
        <p>
          <strong>Showroom Customers:</strong> If a dealership used UNAI CRM to record your test drive, vehicle inquiry, quotation, or invoice, please contact that Dealership directly as the Data Controller responsible for your relationship. UNAI TECH will support the Dealership Tenant in fulfilling verified privacy requests promptly.
        </p>
      </>
    ),
  },
  {
    id: 'updates-contact',
    number: '09',
    title: 'Children\u2019s Privacy, Updates & Contact',
    summary: 'B2B workforce restriction, change notifications, and privacy inquiries.',
    content: (
      <>
        <p>
          UNAI CRM is a business-to-business platform intended solely for authorized adult dealership personnel (18 years or older). We do not knowingly solicit accounts from children under 18.
        </p>
        <p>
          We may update this Privacy Policy periodically as platform modules or compliance laws evolve. The &ldquo;Last Updated&rdquo; date at the top of this page reflects the current revision.
        </p>
        <p>
          <strong>Privacy Inquiries:</strong> For privacy questions, security disclosures, or workspace data requests regarding UNAI CRM, please contact your Dealership Administrator or reach the platform operator <strong>UNAI TECH</strong> at{' '}
          <strong>privacy@unaitech.com</strong> (or through your designated UNAI CRM account representative).
        </p>
      </>
    ),
  },
];

export function PrivacyPolicyContent() {
  return (
    <LegalDocumentLayout
      activeDoc="privacy"
      badgeLabel="Privacy & Data Protection"
      title="Privacy Policy"
      subtitle="Transparent commitment to multi-tenant data isolation, Google OAuth limited-use compliance, encrypted document storage, and dealership customer privacy across UNAI CRM."
      effectiveDate="November 26, 2026"
      lastUpdated="November 26, 2026"
      highlights={[
        'Zero sale or third-party ad sharing of dealership or customer records',
        'Tenant-scoped Row-Level Security & signed document storage URLs',
        'PWA offline cache strictly excludes /api/* customer & finance payloads',
      ]}
      sections={PRIVACY_SECTIONS}
    />
  );
}

