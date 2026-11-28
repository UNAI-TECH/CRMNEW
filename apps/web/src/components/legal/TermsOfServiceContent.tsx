'use client';

import React from 'react';
import {
  LegalDocumentLayout,
  LegalSection,
} from '@/components/legal/LegalDocumentLayout';

const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'acceptance-eligibility',
    number: '01',
    title: 'Acceptance of Terms & Eligibility',
    summary: 'Binding agreement for dealership organizations, administrators, and staff users.',
    content: (
      <>
        <p>
          By accessing, onboarding into, installing as a Progressive Web App (&ldquo;PWA&rdquo;), or using any module of <strong>UNAI CRM</strong> operated by <strong>UNAI TECH</strong> (&ldquo;UNAI CRM&rdquo;, &ldquo;Platform&rdquo;, &ldquo;we&rdquo;, or &ldquo;us&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;) and our Privacy Policy.
        </p>
        <p>
          If you access the Platform on behalf of an automotive dealership, franchise group, or corporate entity (&ldquo;Dealership Tenant&rdquo;), you represent that you are at least 18 years old and possess full legal authority to bind that entity to these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'accounts-onboarding',
    number: '02',
    title: 'Accounts, Dealership Onboarding & Access Control',
    summary: 'Tenant onboarding accuracy, role permissions, and administrator & staff security duties.',
    content: (
      <>
        <p>
          During sequential onboarding (/onboarding), Dealership Tenants provide business identity, GSTIN/PAN/TAN tax registration details, branch configuration, module selection, and administrator credentials. You agree to supply accurate, complete, and up-to-date corporate records and promptly update changes inside Platform Settings (/settings).
        </p>
        <ul>
          <li>
            <strong>Administrator Responsibilities:</strong> Tenant Administrators control employee onboarding (/employees), role assignments, financial module access, and immediate revocation/deprovisioning of departing staff credentials.
          </li>
          <li>
            <strong>Credential Confidentiality:</strong> Administrators and staff users accessing /login, /auth/google, or /emplogin must safeguard passwords and session devices and notify us immediately upon suspecting unauthorized account activity.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'permitted-use',
    number: '03',
    title: 'Permitted Business Use & Acceptable Conduct',
    summary: 'Authorized dealership CRM operations and prohibited technical or abusive conduct.',
    content: (
      <>
        <p>
          Subject to these Terms, UNAI TECH grants your Dealership Tenant a non-exclusive, non-transferable, revocable right to use UNAI CRM for internal automotive dealership sales, CRM pipeline management, inventory/procurement tracking, test-drive scheduling, invoicing, document vaulting, and reporting.
        </p>
        <p>You agree <strong>not</strong> to:</p>
        <ul>
          <li>Attempt to bypass authentication, signed-session checks, Row-Level Security boundaries, or multi-tenant isolation controls, or probe another tenant&rsquo;s data.</li>
          <li>Reverse-engineer, decompile, scrape via automated bots, or interfere with platform infrastructure, APIs (/api/*), or rate limits.</li>
          <li>Upload malicious code, deceptive executables, infringing media, or unlawful content into document storage or branding fields.</li>
          <li>Use CRM contact data to send unsolicited spam or violate regional telecommunication, DND, or privacy laws.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'tenant-data-ownership',
    number: '04',
    title: 'Dealership Data Ownership & Legal Compliance',
    summary: 'Tenants own all CRM data; tenants warrant lawful collection of end-customer records.',
    content: (
      <>
        <p>
          As between UNAI TECH and the Dealership Tenant, <strong>the Dealership Tenant retains 100% ownership</strong> of all customer profiles, pipeline leads, vehicle stockyard inventory, quotations, financial sheets, uploaded documents, brand logos, and digital signatures stored in its workspace (&ldquo;Tenant Data&rdquo;).
        </p>
        <p>
          Dealership Tenants grant UNAI TECH a limited, worldwide license strictly necessary to host, back up, render, format PDFs/invoices, and transmit Tenant Data across your authorized workspace sessions. Each Dealership Tenant is solely responsible for ensuring it holds lawful consent and statutory notices before recording customer phone numbers, emails, KYC documents, or marketing outreach preferences.
        </p>
      </>
    ),
  },
  {
    id: 'financial-gst-disclaimer',
    number: '05',
    title: 'Financial Calculations, GST Invoices & Statutory Filings',
    summary: 'Dealership responsibility to verify tax rates, vehicle pricing, and official invoices.',
    content: (
      <>
        <p>
          UNAI CRM includes workflow calculators and document generation tools across Sales Deals, Finance, Quotations, and Tax Invoices (including ex-showroom pricing, discounts, GST/CGST/SGST components, insurance, RTO charges, and totals).
        </p>
        <p>
          <strong>Professional Verification Required:</strong> While UNAI CRM applies deterministic business rules to assist dealership teams, tax laws, RTO slabs, HSN codes, banking disclosures, and dealer agreements change periodically. UNAI TECH does not provide legal, tax, or accounting advice. Your finance team remains solely responsible for verifying every invoice amount, GSTIN, statutory tax rate, signature, and compliance file prior to issuing official documents or filing tax returns.
        </p>
      </>
    ),
  },
  {
    id: 'pwa-availability',
    number: '06',
    title: 'Progressive Web App (PWA) & Service Availability',
    summary: 'Browser installation behavior, online connectivity requirements, and platform updates.',
    content: (
      <>
        <p>
          UNAI CRM may be installed onto supported desktop or mobile devices as a standalone PWA using the top-bar Install control or browser menu. Installed shortcuts launch the live workspace securely within your system app frame.
        </p>
        <p>
          Because CRM leads, vehicle allocations, staff permissions, and invoice numbers require authoritative server synchronization, active internet connectivity is required for live reads and writes. The offline screen (/offline.html) serves strictly as a connectivity fallback and does not authorize offline financial or inventory mutations. We strive for high uptime while reserving the right to perform scheduled maintenance, security patches, and continuous feature upgrades.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    number: '07',
    title: 'Intellectual Property Rights',
    summary: 'Protection of UNAI CRM software, UI assets, and respect for dealership branding.',
    content: (
      <>
        <p>
          All platform source code, database schemas, user interface designs, graphics, trademarks, service marks (&ldquo;UNAI&rdquo;, &ldquo;UNAI CRM&rdquo;, and the UNAI logo mark), and documentation are the exclusive intellectual property of <strong>UNAI TECH</strong> or its licensors.
        </p>
        <p>
          Dealership brand emblems, trade names, and signatory stamps uploaded during onboarding remain the property of the respective Dealership Tenant.
        </p>
      </>
    ),
  },
  {
    id: 'suspension-termination',
    number: '08',
    title: 'Suspension, Account Closure & Data Export',
    summary: 'Grounds for access suspension and post-termination data handling.',
    content: (
      <>
        <p>
          You may discontinue using UNAI CRM at any time. UNAI TECH may temporarily suspend or restrict access immediately if an account poses a security hazard, violates Section 03 (Acceptable Conduct), uses unauthorized credentials, or remains in uncured material breach of subscription/service agreements.
        </p>
        <p>
          Except in urgent security or legal-compliance incidents, we aim to provide reasonable notice before permanent workspace deactivation so Dealership Tenants can export operational records and uploaded documents.
        </p>
      </>
    ),
  },
  {
    id: 'warranties-liability',
    number: '09',
    title: 'Disclaimer of Warranties & Limitation of Liability',
    summary: 'Commercial SaaS AS-IS disclaimer and standard liability allocation.',
    content: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, UNAI CRM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
        </p>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, UNAI TECH SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOST PROFITS, VEHICLE DEAL DELAYS, OR THIRD-PARTY CLOUD/OAUTH OUTAGES. IN ALL EVENTS, OUR AGGREGATE LIABILITY ARISING OUT OF THESE TERMS SHALL NOT EXCEED THE GREATER OF THE SERVICE FEES PAID BY THE DEALERSHIP TENANT TO UNAI TECH IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM OR ONE HUNDRED U.S. DOLLARS (OR EQUIVALENT LOCAL CURRENCY).
        </p>
      </>
    ),
  },
  {
    id: 'governing-law-contact',
    number: '10',
    title: 'Changes to Terms, Governing Law & Contact',
    summary: 'Revision notices, severability, jurisdiction, and official contact details.',
    content: (
      <>
        <p>
          We may revise these Terms from time to time to reflect platform capabilities or legal obligations. Continued use of UNAI CRM after revised Terms are posted constitutes acceptance of the updated Terms. If any clause is held unenforceable, remaining provisions remain in full force.
        </p>
        <p>
          These Terms are governed by applicable commercial contract laws in the jurisdiction where UNAI TECH operates and delivers the service, without regard to conflict-of-law principles.
        </p>
        <p>
          <strong>Legal &amp; Support Contact:</strong> Questions regarding these Terms of Service may be sent to <strong>UNAI TECH</strong> at <strong>legal@unaitech.com</strong> or <strong>support@unaitech.com</strong>.
        </p>
      </>
    ),
  },
];

export function TermsOfServiceContent() {
  return (
    <LegalDocumentLayout
      activeDoc="terms"
      badgeLabel="Platform Agreement"
      title="Terms of Service"
      subtitle="Commercial terms governing access to UNAI CRM multi-tenant workspaces, dealership onboarding, employee portals, invoicing tools, and Progressive Web App usage."
      effectiveDate="November 26, 2026"
      lastUpdated="November 26, 2026"
      highlights={[
        'Dealerships retain 100% ownership of all customer & stockyard data',
        'Tenants verify statutory GST, RTO, and pricing rules on invoices',
        'Strict multi-tenant security & acceptable B2B dealership usage',
      ]}
      sections={TERMS_SECTIONS}
    />
  );
}

