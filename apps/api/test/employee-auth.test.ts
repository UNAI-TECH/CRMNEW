import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { validateLeadTransition } from '@crm/business-rules';
import type { LeadStatus } from '@crm/shared-types';

// Replicating the robust security functions from employee auth
function validateStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit (0-9)');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must contain at least one alphanumeric special character or symbol (!@#$%^&*)');
  }
  return { valid: errors.length === 0, errors };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) {
    return storedHash === password;
  }
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

describe('Staff User ID Authentication & Strong Password Workflow', () => {
  describe('Strong Password Complexity Rules', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const res = validateStrongPassword('Ab1@');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects passwords missing an uppercase letter', () => {
      const res = validateStrongPassword('strongpass123!');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Password must contain at least one uppercase letter (A-Z)');
    });

    it('rejects passwords missing a lowercase letter', () => {
      const res = validateStrongPassword('STRONGPASS123!');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Password must contain at least one lowercase letter (a-z)');
    });

    it('rejects passwords missing a numeric digit', () => {
      const res = validateStrongPassword('StrongPassword!');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Password must contain at least one numeric digit (0-9)');
    });

    it('rejects passwords missing an alphanumeric special symbol', () => {
      const res = validateStrongPassword('StrongPass1234');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Password must contain at least one alphanumeric special character or symbol (!@#$%^&*)');
    });

    it('accepts compliant strong passwords with uppercase, lowercase, numeric, and symbol', () => {
      expect(validateStrongPassword('StrongPass@2026').valid).toBe(true);
      expect(validateStrongPassword('Dealership#1234').valid).toBe(true);
      expect(validateStrongPassword('MySecurePass$99').valid).toBe(true);
    });
  });

  describe('Password Hashing & PBKDF2 Verification', () => {
    it('hashes passwords with salt and verifies matches correctly', () => {
      const plain = 'StrongPass@2026';
      const hashed = hashPassword(plain);

      expect(hashed).toContain(':');
      expect(verifyPassword(plain, hashed)).toBe(true);
      expect(verifyPassword('WrongPass@2026', hashed)).toBe(false);
    });
  });

  describe('User ID Normalization & First-Time Login Workflow', () => {
    it('normalizes User ID for case-insensitive and whitespace-trimmed lookup', () => {
      const rawInput = '  FsAfA  ';
      const cleanId = rawInput.trim().toLowerCase().replace(/\s+/g, '');
      expect(cleanId).toBe('fsafa');
    });

    it('detects first-time login when is_password_set is false', () => {
      const staffMember = {
        userId: 'fsafa',
        fullName: 'Fsafa Accountant',
        is_password_set: false,
        password_hash: null,
      };

      const requiresPasswordSetup = !staffMember.is_password_set || !staffMember.password_hash;
      expect(requiresPasswordSetup).toBe(true);
    });

    it('transitions to permanent active once staff sets their permanent password', () => {
      const staffMember = {
        userId: 'fsafa',
        fullName: 'Fsafa Accountant',
        is_password_set: false,
        password_hash: null as string | null,
      };

      const newPass = 'Fsafa@2026Dealership';
      expect(validateStrongPassword(newPass).valid).toBe(true);

      // Simulate first-time password creation
      staffMember.password_hash = hashPassword(newPass);
      staffMember.is_password_set = true;

      expect(staffMember.is_password_set).toBe(true);
      expect(verifyPassword(newPass, staffMember.password_hash)).toBe(true);
    });
  });

  describe('Error Detection and Pop-up Message Generation', () => {
    it('captures missing field errors and generates clear error descriptions', () => {
      const validateInput = (fullName: string, userId: string) => {
        if (!fullName.trim()) return { error: true, title: 'Missing Full Name', message: 'Please enter the employee full name before submitting.' };
        if (!userId.trim()) return { error: true, title: 'Missing User ID', message: 'Please enter a User ID for the employee.' };
        return { error: false };
      };

      expect(validateInput('', 'fsafa')).toEqual({
        error: true,
        title: 'Missing Full Name',
        message: 'Please enter the employee full name before submitting.',
      });

      expect(validateInput('Fsafa', '')).toEqual({
        error: true,
        title: 'Missing User ID',
        message: 'Please enter a User ID for the employee.',
      });
    });

    it('captures duplicate User ID errors with the specific conflicting identity', () => {
      const existing = [{ userId: 'fsafa', fullName: 'Fsafa Accountant' }];
      const checkDuplicate = (targetId: string) => {
        const found = existing.find((e) => e.userId.toLowerCase() === targetId.toLowerCase().trim());
        if (found) {
          return {
            error: true,
            title: 'Duplicate User ID Error',
            message: `User ID '${targetId}' is already assigned to ${found.fullName} in the database.`,
          };
        }
        return { error: false };
      };

      expect(checkDuplicate('FSAFA')).toEqual({
        error: true,
        title: 'Duplicate User ID Error',
        message: "User ID 'FSAFA' is already assigned to Fsafa Accountant in the database.",
      });
    });

    it('formats database error messages and technical details cleanly', () => {
      const formatDbError = (err: { message: string; code?: string; detail?: string }) => {
        return {
          title: 'Database Synchronization Failed',
          message: err.message,
          technicalDetails: JSON.stringify(err, null, 2),
        };
      };

      const result = formatDbError({
        message: 'column "user_id" of relation "employees" does not exist',
        code: '42703',
      });

      expect(result.title).toBe('Database Synchronization Failed');
      expect(result.message).toContain('column "user_id"');
      expect(result.technicalDetails).toContain('42703');
    });

    it('resolves valid corporate email when email is omitted or blank', () => {
      const resolveEmail = (rawEmail: string, userId: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmed = (rawEmail || '').trim().toLowerCase();
        return emailRegex.test(trimmed)
          ? trimmed
          : `${userId.toLowerCase().replace(/[^a-z0-9]/g, '')}@dealership.com`;
      };

      expect(resolveEmail('', 'fsafa')).toBe('fsafa@dealership.com');
      expect(resolveEmail('   ', 'rohit01')).toBe('rohit01@dealership.com');
      expect(resolveEmail('custom.email@gmail.com', 'rohit01')).toBe('custom.email@gmail.com');
    });

    it('handles admin reset-password action: clears password_hash and resets is_password_set to false', () => {
      const employeeRecord = {
        id: 'emp-001',
        userId: 'fsafa',
        tenantId: 'tenant-apex',
        password_hash: 'salt123:hash456',
        is_password_set: true,
      };

      // Execute reset action simulation
      const resetAction = (record: typeof employeeRecord) => {
        return {
          ...record,
          password_hash: null,
          is_password_set: false,
        };
      };

      const updated = resetAction(employeeRecord);
      expect(updated.is_password_set).toBe(false);
      expect(updated.password_hash).toBeNull();

      // Verify routing logic after reset
      const determineLoginRoute = (isPasswordSet: boolean) => {
        return isPasswordSet ? 'enter_password' : 'create_permanent_password';
      };

      expect(determineLoginRoute(updated.is_password_set)).toBe('create_permanent_password');
    });

    it('dynamically resolves tenant company profile on verify-id and enforces neutral Step 1', () => {
      const tenantProfiles: Record<string, { name: string; logoUrl: string }> = {
        'tenant-apex': { name: 'Apex Downtown Flagship', logoUrl: 'https://apex.com/logo.png' },
        'tenant-metro': { name: 'Metro Honda Motors', logoUrl: 'https://metro.com/logo.png' },
      };

      const employees = [
        { userId: 'fsafa', tenantId: 'tenant-apex' },
        { userId: 'rahul', tenantId: 'tenant-metro' },
      ];

      // Step 1: Initial neutral branding
      const step1Branding = {
        title: 'Staff & Team Member Portal',
        dealershipName: 'Dealership Staff Portal',
        logoUrl: null,
      };
      expect(step1Branding.title).toBe('Staff & Team Member Portal');
      expect(step1Branding.logoUrl).toBeNull();

      // Step 2: Dynamic resolution based on verified User ID
      const resolveTenant = (userId: string) => {
        const emp = employees.find((e) => e.userId === userId);
        if (!emp) return null;
        return tenantProfiles[emp.tenantId] || null;
      };

      expect(resolveTenant('fsafa')).toEqual({
        name: 'Apex Downtown Flagship',
        logoUrl: 'https://apex.com/logo.png',
      });

      expect(resolveTenant('rahul')).toEqual({
        name: 'Metro Honda Motors',
        logoUrl: 'https://metro.com/logo.png',
      });
    });
  });

  describe('Permanent Password Persistence & Overwrite Guard', () => {
    it('prevents overwriting an already active permanent password unless admin reset first', () => {
      const canSetPassword = (record: { is_password_set: boolean; password_hash: string | null }) => {
        return !(record.is_password_set && record.password_hash);
      };

      expect(canSetPassword({ is_password_set: false, password_hash: null })).toBe(true);
      expect(canSetPassword({ is_password_set: true, password_hash: 'salt:hash' })).toBe(false);
    });

    it('treats missing DB write confirmation as a save error instead of succeeding silently', () => {
      const resolvePersistenceOutcome = (persisted: boolean, dbError: string | null) => {
        if (!persisted) {
          return {
            status: 500,
            success: false,
            error: dbError ? `Database save failed: ${dbError}` : 'Database save failed: no matching employee record was updated.',
          };
        }
        return { status: 200, success: true };
      };

      expect(resolvePersistenceOutcome(false, 'column "password_hash" does not exist')).toEqual({
        status: 500,
        success: false,
        error: 'Database save failed: column "password_hash" does not exist',
      });
      expect(resolvePersistenceOutcome(true, null)).toEqual({
        status: 200,
        success: true,
      });
    });
  });

  describe('Customer Assignment Filtering & Inventory-Only Vehicle Options', () => {
    it('excludes Finance, Accountant, Technician, and inactive staff from assignment lists', () => {
      const excludedKeywords = ['finance', 'accountant', 'account', 'technician'];
      const isAssignable = (emp: { role?: string; department?: string; is_active?: boolean }) => {
        if (emp.is_active === false) return false;
        const text = `${emp.role || ''} ${emp.department || ''}`.toLowerCase();
        return !excludedKeywords.some((kw) => text.includes(kw));
      };

      const team = [
        { id: '1', full_name: 'kin', role: 'Finance Manager', department: 'Finance' },
        { id: '2', full_name: 'anjali', role: 'Accountant', department: 'Finance' },
        { id: '3', full_name: 'ravi', role: 'Technician', department: 'Service' },
        { id: '4', full_name: 'rohit', role: 'Sales Executive', department: 'Sales' },
        { id: '5', full_name: 'meera', role: 'Sales Manager', department: 'Sales' },
        { id: '6', full_name: 'old', role: 'Sales Executive', department: 'Sales', is_active: false },
      ];

      expect(team.filter(isAssignable).map((e) => e.full_name)).toEqual(['rohit', 'meera']);
    });

    it('builds car options exclusively from stored inventory vehicles without skipping standard brands', () => {
      const buildOptions = (vehicles: Array<{ make?: string; model?: string; variant?: string }>) => {
        const seen = new Set<string>();
        const list: string[] = [];
        for (const v of vehicles) {
          const label = [v.make, v.model, v.variant].filter(Boolean).join(' ').trim();
          const key = label.toLowerCase();
          if (label && !seen.has(key)) {
            seen.add(key);
            list.push(label);
          }
        }
        return list;
      };

      expect(buildOptions([])).toEqual([]);
      expect(
        buildOptions([
          { make: 'Hyundai', model: 'Creta', variant: '' },
          { make: 'Hyundai', model: 'Creta', variant: '' },
          { make: 'Tata Motors', model: 'Nexon', variant: 'XZ+' },
        ])
      ).toEqual(['Hyundai Creta', 'Tata Motors Nexon XZ+']);
    });
  });

  describe('Custom Pipeline Stages, Insertion Order & Transition Rules', () => {
    const CORE_STAGE_KEYS = new Set([
      'new',
      'assigned',
      'contacted',
      'qualified',
      'appointment_set',
      'test_drive',
      'negotiation',
      'converted',
      'lost',
      'nurture',
    ]);

    const slugifyStageKey = (label: string, existingKeys: ReadonlyArray<string>): string => {
      const base =
        label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'custom_stage';
      const rawKey = CORE_STAGE_KEYS.has(base) ? `custom_${base}` : base;
      const existingSet = new Set(existingKeys);
      if (!existingSet.has(rawKey)) return rawKey;
      let counter = 2;
      while (existingSet.has(`${rawKey}_${counter}`)) {
        counter++;
      }
      return `${rawKey}_${counter}`;
    };

    const canTransitionCustomPipeline = (
      stages: ReadonlyArray<{ key: string }>,
      fromKey: string,
      toKey: string
    ): boolean => {
      if (!fromKey || !toKey || fromKey === toKey) return false;
      if (fromKey === 'converted') return false;

      const fromIsCore = CORE_STAGE_KEYS.has(fromKey);
      const toIsCore = CORE_STAGE_KEYS.has(toKey);
      if (!fromIsCore || !toIsCore) {
        return !(fromKey === 'new' && toKey === 'converted');
      }

      const fromIdx = stages.findIndex((s) => s.key === fromKey);
      const toIdx = stages.findIndex((s) => s.key === toKey);
      if (fromIdx !== -1 && toIdx === fromIdx + 1 && !(fromKey === 'new' && toKey === 'converted')) {
        return true;
      }

      const hasCustomBetween =
        fromIdx !== -1 &&
        toIdx !== -1 &&
        stages.slice(Math.min(fromIdx, toIdx) + 1, Math.max(fromIdx, toIdx)).some((s) => !CORE_STAGE_KEYS.has(s.key));
      if (hasCustomBetween && !(fromKey === 'new' && toKey === 'converted')) {
        return true;
      }

      return validateLeadTransition(fromKey as LeadStatus, toKey as LeadStatus);
    };

    it('generates collision-safe keys and avoids colliding with core stage keys', () => {
      const defaults = ['new', 'contacted', 'qualified', 'appointment_set', 'test_drive', 'negotiation', 'converted'];

      expect(slugifyStageKey('Loan & Insurance Approval', defaults)).toBe('loan_insurance_approval');
      expect(slugifyStageKey('Negotiation', defaults)).toBe('custom_negotiation');
      expect(slugifyStageKey('Negotiation', [...defaults, 'custom_negotiation'])).toBe('custom_negotiation_2');
      expect(slugifyStageKey('   ', defaults)).toBe('custom_stage');
    });

    it('inserts custom stages before and after Negotiation and allows moving leads smoothly across them', () => {
      const stages = [
        { key: 'new', label: 'New Enquiries' },
        { key: 'contacted', label: 'Contacted' },
        { key: 'qualified', label: 'Qualified' },
        { key: 'appointment_set', label: 'Appointment Set' },
        { key: 'test_drive', label: 'Test Drive' },
        { key: 'negotiation', label: 'Negotiation' },
        { key: 'converted', label: 'Converted' },
      ];

      // Insert custom stage between Test Drive and Negotiation
      const negIdx = stages.findIndex((s) => s.key === 'negotiation');
      const beforeNegKey = slugifyStageKey('Pre-Approval & Trade-In', stages.map((s) => s.key));
      stages.splice(negIdx, 0, { key: beforeNegKey, label: 'Pre-Approval & Trade-In' });

      // Insert custom stage between Negotiation and Converted
      const updatedNegIdx = stages.findIndex((s) => s.key === 'negotiation');
      const afterNegKey = slugifyStageKey('Loan Sanction & RTO', stages.map((s) => s.key));
      stages.splice(updatedNegIdx + 1, 0, { key: afterNegKey, label: 'Loan Sanction & RTO' });

      expect(stages.map((s) => s.key)).toEqual([
        'new',
        'contacted',
        'qualified',
        'appointment_set',
        'test_drive',
        'pre_approval_trade_in',
        'negotiation',
        'loan_sanction_rto',
        'converted',
      ]);

      expect(canTransitionCustomPipeline(stages, 'test_drive', 'pre_approval_trade_in')).toBe(true);
      expect(canTransitionCustomPipeline(stages, 'pre_approval_trade_in', 'negotiation')).toBe(true);
      expect(canTransitionCustomPipeline(stages, 'negotiation', 'loan_sanction_rto')).toBe(true);
      expect(canTransitionCustomPipeline(stages, 'loan_sanction_rto', 'converted')).toBe(true);
      // Direct jump still blocked for new -> converted and terminal converted stays locked
      expect(canTransitionCustomPipeline(stages, 'new', 'converted')).toBe(false);
      expect(canTransitionCustomPipeline(stages, 'converted', 'negotiation')).toBe(false);
    });
  });

  describe('Unauthenticated Sync Guard & Public Route Rules', () => {
    const isPublicAuthOrLandingPath = (pathname?: string): boolean => {
      const path = (pathname || '/').trim() || '/';
      return (
        path === '/' ||
        path === '/login' ||
        path.startsWith('/login/') ||
        path === '/emplogin' ||
        path.startsWith('/emplogin/') ||
        path === '/auth' ||
        path.startsWith('/auth/')
      );
    };

    const shouldSkipSyncResponse = (status: number): boolean => {
      return status === 401 || status === 403;
    };

    it('identifies public landing and login routes so unauthenticated CRM fetches stay skipped', () => {
      expect(isPublicAuthOrLandingPath('/')).toBe(true);
      expect(isPublicAuthOrLandingPath('/login')).toBe(true);
      expect(isPublicAuthOrLandingPath('/emplogin')).toBe(true);
      expect(isPublicAuthOrLandingPath('/auth/google')).toBe(true);
      expect(isPublicAuthOrLandingPath('/auth/callback')).toBe(true);
      expect(isPublicAuthOrLandingPath('/dashboard')).toBe(false);
      expect(isPublicAuthOrLandingPath('/crm/leads')).toBe(false);
      expect(isPublicAuthOrLandingPath('/finance')).toBe(false);
    });

    it('short-circuits sync fallback immediately on 401/403 instead of cascading repeated API calls', () => {
      expect(shouldSkipSyncResponse(401)).toBe(true);
      expect(shouldSkipSyncResponse(403)).toBe(true);
      expect(shouldSkipSyncResponse(200)).toBe(false);
    });
  });
});

