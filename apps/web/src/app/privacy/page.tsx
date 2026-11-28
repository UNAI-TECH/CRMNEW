import type { Metadata } from 'next';
import { PrivacyPolicyContent } from '@/components/legal/PrivacyPolicyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for UNAI CRM explaining multi-tenant dealership data handling, Google OAuth authentication, security controls, and PWA storage.',
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}

