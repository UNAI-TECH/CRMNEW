import { cookies } from 'next/headers';
import EmployeePortalContent from './EmployeePortalContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'UNAI CRM' },
  description: 'Personal staff workflow & assigned dealership tasks',
};

export default async function EmployeePortalPage() {
  const cookieStore = await cookies();
  const rawSession = typeof cookieStore?.get === 'function' ? cookieStore.get('crm-employee-session')?.value : undefined;
  let initialEmployee = null;
  if (rawSession) {
    try {
      initialEmployee = JSON.parse(decodeURIComponent(rawSession));
    } catch (e) {
      initialEmployee = null;
    }
  }

  return <EmployeePortalContent initialEmployee={initialEmployee} />;
}
