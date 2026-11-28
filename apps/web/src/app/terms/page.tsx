import type { Metadata } from 'next';
import { TermsOfServiceContent } from '@/components/legal/TermsOfServiceContent';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service governing access to UNAI CRM workspaces, dealership onboarding, staff portals, financial document tools, and PWA usage.',
};

export default function TermsOfServicePage() {
  return <TermsOfServiceContent />;
}

