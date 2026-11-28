'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/auth-context';
import {
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  KeyRound,
  ArrowLeft,
  Check,
  X,
  Shield,
} from 'lucide-react';
import {
  verifyEmployeeUserId,
  setEmployeePermanentPassword,
  verifyEmployeeLogin,
  validateStrongPassword,
  Employee,
} from '@/lib/client/stores/employee-store';
import {
  getCompanyProfile,
  saveCompanyProfile,
  DEFAULT_COMPANY_PROFILE,
  CompanyProfile,
} from '@/lib/client/stores/company-store';
import { ErrorPopup, triggerErrorPopup } from '@/components/ui/ErrorPopup';
import { PwaInstallButton } from '@/components/pwa/PwaInstallControl';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const { loginUser } = useAuth();

  const [company, setCompany] = useState<Partial<CompanyProfile> | null>(null);
  const [tenantOptions, setTenantOptions] = useState<any[] | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Workflow states:
  // 1. 'enter_user_id' -> User enters assigned User ID
  // 2. 'create_permanent_password' -> First time login or after admin reset: create permanent strong password
  // 3. 'enter_password' -> Returning employee: enter permanent password
  // 4. 'success' -> Logged in and redirecting
  const [workflowStep, setWorkflowStep] = useState<
    'enter_user_id' | 'create_permanent_password' | 'enter_password' | 'success'
  >('enter_user_id');

  // Input states
  const [userIdInput, setUserIdInput] = useState('');
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);

  // Password for returning employee
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-time password creation states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Neutral branding on Step 1: We intentionally DO NOT preload previous company from localStorage!

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const prefilledId = params.get('emp');
      if (prefilledId) {
        setUserIdInput(prefilledId);
      }
    }

    // Global client and network error listeners to guarantee a pop-up on any error
    const handleWindowError = (event: ErrorEvent) => {
      triggerErrorPopup(
        event.message || 'An unexpected client-side error occurred.',
        'Login System Error',
        event.error?.stack || `${event.filename}:${event.lineno}`
      );
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message || 'Authentication request failed.';
      triggerErrorPopup(msg, 'Server / Database Error', reason?.stack);
    };
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Helper to map employee designation to system UserRole
  const resolveRole = (emp: Employee) => {
    if (emp.isAdmin) return 'tenant_admin' as const;
    const d = emp.designation.toLowerCase();
    if (d.includes('sales')) return 'sales_executive' as const;
    if (d.includes('finance') || d.includes('account')) return 'finance_manager' as const;
    if (d.includes('inventory')) return 'inventory_manager' as const;
    if (d.includes('service')) return 'service_advisor' as const;
    return 'sales_executive' as const;
  };

  // Complete session & route to employee workspace
  const completeLogin = (emp: Employee) => {
    const role = resolveRole(emp);

    loginUser(emp.email || `${(emp.userId || emp.employeeCode).toLowerCase()}@dealership.com`, emp.fullName, role, {
      employeeId: emp.id,
      employeeCode: emp.userId || emp.employeeCode,
      isAdmin: emp.isAdmin,
      avatarUrl: emp.avatarUrl,
      phone: emp.phone,
      accessControl: emp.accessControl,
      tenantId: emp.tenantId,
    });

    // Save authentic dealership profile to localStorage for session persistence
    if (company && (company.tradeName || company.legalName)) {
      saveCompanyProfile({
        ...DEFAULT_COMPANY_PROFILE,
        ...company,
        id: emp.tenantId || DEFAULT_COMPANY_PROFILE.id,
      });
    }

    setWorkflowStep('success');
    setLoading(false);

    setTimeout(() => {
      router.push('/empportal');
    }, 1200);
  };

  // Select dealership when multiple companies match a generic User ID
  const handleSelectTenant = async (option: any) => {
    setLoading(true);
    setTenantOptions(null);
    const cleanId = userIdInput.trim().toLowerCase().replace(/\s+/g, '');

    const result = await verifyEmployeeUserId(cleanId, option.tenantId);
    if (!result.success || !result.employee) {
      setLoading(false);
      const errMsg = result.error || 'Failed to select dealership.';
      setError(errMsg);
      triggerErrorPopup(errMsg, 'Dealership Selection Failed');
      return;
    }

    const emp = result.employee;
    setActiveEmployee(emp);
    setCompany({
      ...DEFAULT_COMPANY_PROFILE,
      legalName: option.dealershipName || result.company?.name || 'Dealership Workspace',
      tradeName: option.dealershipName || result.company?.name || 'Dealership Workspace',
      logoUrl: option.logoUrl || result.company?.logoUrl || '',
    });
    setLoading(false);

    if (result.isPasswordSet) {
      setWorkflowStep('enter_password');
      setPasswordInput('');
    } else {
      setWorkflowStep('create_permanent_password');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
    }
  };

  // STEP 1: Verify User ID in database
  const handleVerifyUserIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTenantOptions(null);

    const cleanId = userIdInput.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanId) {
      const msg = 'Please enter your assigned User ID before proceeding.';
      setError(msg);
      triggerErrorPopup(msg, 'User ID Required');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyEmployeeUserId(cleanId);

      // Handle multiple matching dealerships across tenants
      if (result.multipleTenants && result.options) {
        setTenantOptions(result.options);
        setLoading(false);
        return;
      }

      if (!result.success || !result.employee) {
        setLoading(false);
        const errMsg = result.error || `User ID '${userIdInput.trim()}' was not found in the dealership database.`;
        setError(errMsg);
        triggerErrorPopup(errMsg, 'User ID Not Found');
        return;
      }

      const emp = result.employee;
      setActiveEmployee(emp);

      // Dynamically load that employee's authentic dealership profile
      if (result.company) {
        setCompany({
          ...DEFAULT_COMPANY_PROFILE,
          legalName: result.company.name || result.company.dealershipName || 'Dealership Workspace',
          tradeName: result.company.name || result.company.dealershipName || 'Dealership Workspace',
          logoUrl: result.company.logoUrl || '',
        });
      }

      setLoading(false);

      if (result.isPasswordSet) {
        // Staff already has a permanent password active
        setWorkflowStep('enter_password');
        setPasswordInput('');
      } else {
        // Staff needs to create their permanent password on 1st login or after reset
        setWorkflowStep('create_permanent_password');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError(null);
      }
    } catch (err: any) {
      setLoading(false);
      const errText = err?.message || 'Unable to connect to database. Please check your network connection.';
      setError(errText);
      triggerErrorPopup(errText, 'Database Connection Error');
    }
  };

  // STEP 2A: First-Time Login - Create Permanent Password
  const handleCreatePermanentPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!activeEmployee) return;

    // Validate strong password criteria
    const validation = validateStrongPassword(newPassword);
    if (!validation.valid) {
      setPasswordError(validation.errors[0]);
      triggerErrorPopup(
        validation.errors[0],
        'Strong Password Requirement Not Met',
        validation.errors.join('\n')
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      const mismatchMsg = 'The permanent password and confirm password do not match. Please re-enter your password to confirm.';
      setPasswordError(mismatchMsg);
      triggerErrorPopup(mismatchMsg, 'Password Confirmation Mismatch');
      return;
    }

    setLoading(true);

    try {
      const result = await setEmployeePermanentPassword(
        activeEmployee.userId || activeEmployee.id,
        newPassword,
        activeEmployee.tenantId,
        activeEmployee.id
      );

      if (result.success) {
        const updated = {
          ...activeEmployee,
          password: '',
          isPasswordSet: true,
          mustChangePassword: false,
          isTemporaryPassword: false,
        };
        setActiveEmployee(updated);
        completeLogin(updated);
      } else {
        setLoading(false);
        const failMsg = result.error || 'Failed to save permanent password in database. Please try again.';
        setPasswordError(failMsg);
        triggerErrorPopup(failMsg, 'Database Save Failed');
      }
    } catch (err: any) {
      setLoading(false);
      const errText = err?.message || 'Failed to save password due to an unexpected error.';
      setPasswordError(errText);
      triggerErrorPopup(errText, 'Password Save Error');
    }
  };

  // STEP 2B: Returning Staff - Enter Permanent Password
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeEmployee) return;
    if (!passwordInput) {
      const emptyMsg = 'Please enter your permanent password.';
      setError(emptyMsg);
      triggerErrorPopup(emptyMsg, 'Password Required');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyEmployeeLogin(
        activeEmployee.userId || activeEmployee.employeeCode,
        passwordInput,
        activeEmployee.tenantId
      );

      if (result.success && result.employee) {
        completeLogin(result.employee);
      } else if (result.requiresPasswordCreation) {
        setLoading(false);
        setWorkflowStep('create_permanent_password');
        const setupMsg = 'No permanent password found for this account. Please create your permanent password to proceed.';
        setPasswordError(setupMsg);
        triggerErrorPopup(setupMsg, 'Permanent Password Required');
      } else {
        setLoading(false);
        const incorrectMsg = result.error || 'Incorrect permanent password. Please verify and try again.';
        setError(incorrectMsg);
        triggerErrorPopup(incorrectMsg, 'Authentication Failed');
      }
    } catch (err: any) {
      setLoading(false);
      const errText = err?.message || 'Authentication error. Please check your connection and try again.';
      setError(errText);
      triggerErrorPopup(errText, 'Authentication Error');
    }
  };

  // Live password validation checklist
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const passwordsMatch = Boolean(confirmPassword && confirmPassword === newPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  const dealershipName =
    company && (company.tradeName || company.legalName)
      ? company.tradeName || company.legalName
      : 'Dealership Staff Portal';

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#FCFDFC',
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 10% 90%, rgba(79, 70, 229, 0.05) 0%, transparent 40%),
          linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.25rem',
        boxSizing: 'border-box',
        position: 'relative',
        fontFamily: 'var(--font, inherit)',
      }}
    >
      {/* Top Bar Navigation */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            fontWeight: 600,
            color: '#64748B',
            textDecoration: 'none',
            padding: '8px 14px',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              fontSize: '0.76rem',
              fontWeight: 700,
              border: '1px solid #C7D2FE',
            }}
          >
            <ShieldCheck size={14} /> Staff & Employee Portal
          </span>
          <PwaInstallButton variant="circle" />
        </div>
      </div>

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          marginTop: '2rem',
        }}
      >
        {/* Dealership Header Banner */}
        <div
          style={{
            padding: '24px 28px 20px',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
            borderBottom: '1px solid #F1F5F9',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.28)',
            }}
          >
            {workflowStep !== 'enter_user_id' && company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} />
            ) : workflowStep !== 'enter_user_id' ? (
              <Building2 size={28} />
            ) : (
              <ShieldCheck size={28} />
            )}
          </div>

          <h1 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
            {workflowStep === 'enter_user_id'
              ? 'Staff & Team Member Portal'
              : dealershipName}
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
            {workflowStep === 'create_permanent_password'
              ? 'First-Time Setup • Create Your Permanent Password'
              : workflowStep === 'enter_password'
              ? 'Welcome Back • Enter Your Permanent Password'
              : 'Universal Staff Login • Enter your assigned User ID'}
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '28px' }}>
          {/* ========================================================
              STEP 1: ENTER USER ID OR SELECT DEALERSHIP
              ======================================================== */}
          {workflowStep === 'enter_user_id' && tenantOptions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                Multiple dealerships found for <span style={{ fontFamily: 'monospace', color: '#4F46E5', fontWeight: 800 }}>{userIdInput}</span>. Select your dealership to continue:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tenantOptions.map((opt, i) => (
                  <button
                    key={opt.tenantId || i}
                    type="button"
                    onClick={() => handleSelectTenant(opt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#4F46E5';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: '#EEF2FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4F46E5',
                        flexShrink: 0,
                      }}
                    >
                      {opt.logoUrl ? (
                        <img src={opt.logoUrl} alt={opt.dealershipName} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }} />
                      ) : (
                        <Building2 size={18} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>{opt.dealershipName}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{opt.designation} • {opt.department}</div>
                    </div>
                    <ArrowRight size={15} style={{ color: '#94A3B8' }} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setTenantOptions(null);
                  setUserIdInput('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  marginTop: '4px',
                  textAlign: 'center',
                }}
              >
                ← Try a different User ID
              </button>
            </div>
          )}

          {workflowStep === 'enter_user_id' && !tenantOptions && (
            <form onSubmit={handleVerifyUserIdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '12px',
                    color: '#DC2626',
                    fontSize: '0.84rem',
                    lineHeight: '1.4',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{error}</div>
                </div>
              )}

              {/* User ID Input */}
              <div>
                <label
                  htmlFor="emp-login-userid"
                  style={{
                    display: 'block',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#1E293B',
                    marginBottom: '6px',
                  }}
                >
                  User ID <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94A3B8',
                    }}
                  />
                  <input
                    id="emp-login-userid"
                    type="text"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="Enter assigned User ID (e.g. fsafa, rohit01)"
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      height: '46px',
                      padding: '0 14px 0 42px',
                      borderRadius: '12px',
                      border: '1.5px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.92rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '6px' }}>
                  Enter the unique User ID assigned by your dealership administrator.
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.15s ease',
                  marginTop: '6px',
                }}
              >
                {loading ? (
                  <span>Verifying User ID in database...</span>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================
              STEP 2A: FIRST-TIME LOGIN - CREATE PERMANENT PASSWORD
              ======================================================== */}
          {workflowStep === 'create_permanent_password' && activeEmployee && (
            <form onSubmit={handleCreatePermanentPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Employee Verified Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: '#EEF2FF',
                  border: '1.5px solid #C7D2FE',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {activeEmployee.fullName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#1E1B4B' }}>
                    Welcome, {activeEmployee.fullName}!
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#4338CA', fontWeight: 600 }}>
                    User ID: <strong>{activeEmployee.userId || activeEmployee.employeeCode}</strong> • {activeEmployee.designation}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 700,
                  }}
                >
                  1st Time Setup
                </span>
              </div>

              {/* Requirement Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  fontSize: '0.78rem',
                  color: '#92400E',
                  lineHeight: '1.45',
                }}
              >
                <KeyRound size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} />
                <div>
                  <strong>User ID Verified in Database.</strong>
                  <br />
                  Please create your permanent password below. This password will be securely saved in the database for all your future logins.
                </div>
              </div>

              {passwordError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '10px',
                    color: '#DC2626',
                    fontSize: '0.82rem',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* New Password Input */}
              <div>
                <label htmlFor="emp-new-password" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                  Create Permanent Password <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94A3B8',
                    }}
                  />
                  <input
                    id="emp-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      padding: '0 42px 0 42px',
                      borderRadius: '12px',
                      border: '1.5px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="emp-confirm-password" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                  Confirm Permanent Password <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94A3B8',
                    }}
                  />
                  <input
                    id="emp-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter permanent password"
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      padding: '0 42px 0 42px',
                      borderRadius: '12px',
                      border:
                        confirmPassword && confirmPassword === newPassword
                          ? '1.5px solid #16A34A'
                          : confirmPassword && confirmPassword !== newPassword
                          ? '1.5px solid #DC2626'
                          : '1.5px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Password Strength Real-time Requirements Checklist */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                  Strong Password Requirements
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: hasMinLength ? '#16A34A' : '#64748B' }}>
                    {hasMinLength ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>8+ characters</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: hasUpper ? '#16A34A' : '#64748B' }}>
                    {hasUpper ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>Uppercase (A-Z)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: hasLower ? '#16A34A' : '#64748B' }}>
                    {hasLower ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>Lowercase (a-z)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: hasNumber ? '#16A34A' : '#64748B' }}>
                    {hasNumber ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>Numeric digit (0-9)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: hasSpecial ? '#16A34A' : '#64748B' }}>
                    {hasSpecial ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>Special character (!@#$)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: passwordsMatch ? '#16A34A' : '#64748B' }}>
                    {passwordsMatch ? <Check size={13} style={{ color: '#16A34A' }} /> : <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid #CBD5E1', display: 'inline-block' }} />}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowStep('enter_user_id');
                    setActiveEmployee(null);
                    setCompany(null);
                    setTenantOptions(null);
                    setError(null);
                    setPasswordError(null);
                  }}
                  style={{
                    flex: '1',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Change User ID
                </button>
                <button
                  type="submit"
                  disabled={loading || !isPasswordValid}
                  style={{
                    flex: '2',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: isPasswordValid ? '#16A34A' : '#94A3B8',
                    color: '#FFFFFF',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: loading || !isPasswordValid ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isPasswordValid ? '0 4px 14px rgba(22, 163, 74, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loading ? (
                    <span>Saving to Database...</span>
                  ) : (
                    <span>Save &amp; Sign In</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================
              STEP 2B: RETURNING STAFF - ENTER PERMANENT PASSWORD
              ======================================================== */}
          {workflowStep === 'enter_password' && activeEmployee && (
            <form onSubmit={handlePasswordLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Employee Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: '#F0FDF4',
                  border: '1.5px solid #BBF7D0',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {activeEmployee.fullName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#14532D' }}>
                    {activeEmployee.fullName}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 600 }}>
                    User ID: <strong>{activeEmployee.userId || activeEmployee.employeeCode}</strong> • {activeEmployee.designation}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    fontWeight: 700,
                  }}
                >
                  Permanent Active ✓
                </span>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '12px',
                    color: '#DC2626',
                    fontSize: '0.84rem',
                    lineHeight: '1.4',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{error}</div>
                </div>
              )}

              {/* Permanent Password Input */}
              <div>
                <label htmlFor="emp-returning-password" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                  Permanent Password <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94A3B8',
                    }}
                  />
                  <input
                    id="emp-returning-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your permanent password"
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      height: '46px',
                      padding: '0 42px 0 42px',
                      borderRadius: '12px',
                      border: '1.5px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowStep('enter_user_id');
                    setActiveEmployee(null);
                    setCompany(null);
                    setTenantOptions(null);
                    setError(null);
                  }}
                  style={{
                    flex: '1',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Different User ID
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: '2',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                  }}
                >
                  {loading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================
              STEP 3: SUCCESS SPLASH
              ======================================================== */}
          {workflowStep === 'success' && activeEmployee && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 6px 18px rgba(22, 163, 74, 0.25)',
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                Welcome to Dealership Workspace!
              </h2>
              <p style={{ fontSize: '0.86rem', color: '#64748B', margin: '0 0 16px 0' }}>
                Authentication successful. Opening employee portal...
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  color: '#4F46E5',
                  fontWeight: 700,
                }}
              >
                <span>Loading your staff modules...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '16px 28px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.76rem',
            color: '#64748B',
          }}
        >
          <span>UNAI CRM &middot; 256-bit Encrypted</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <Link href="/privacy" style={{ color: '#4F46E5', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link href="/terms" style={{ color: '#4F46E5', textDecoration: 'none' }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Global Error Pop-up Modal */}
      <ErrorPopup listenGlobal={true} />
    </div>
  );
}
