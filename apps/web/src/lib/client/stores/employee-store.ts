'use client';

export interface LeaveRecord {
  id: string;
  leaveType: 'casual' | 'sick' | 'paid' | 'emergency';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  appliedOn: string;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
}

export interface EmployeeAccessControl {
  pipeline: boolean;
  customers: boolean;
  inventory: boolean;
  procurement: boolean;
  deals: boolean;
  finance: boolean;
  testDrives: boolean;
  documents: boolean;
  reports: boolean;
  settings: boolean;
}

export interface Employee {
  id: string;
  userId?: string; // Manually assigned by admin e.g. kamal01 or EMP-101
  employeeCode: string; // Backward compatible alias for userId
  fullName: string;
  email: string;
  phone: string;
  designation: string;
  department: 'Sales' | 'Finance' | 'Operations' | 'Service' | 'Management' | 'Admin';
  branch: string;
  joiningDate: string;
  salary: string;
  salaryCategory?: string; // e.g. Monthly, Bi-weekly, Hourly, Fixed, etc.
  isAdmin?: boolean; // Admin Privileges toggle
  status: 'active' | 'on_leave' | 'inactive';
  password: string; // Permanent CRM password once created
  isPasswordSet?: boolean; // true once employee creates their permanent password
  avatarUrl?: string; // Dealership staff photo / avatar
  leaveBalance: {
    casual: { total: number; used: number };
    sick: { total: number; used: number };
    paid: { total: number; used: number };
  };
  leaveHistory: LeaveRecord[];
  accessControl: EmployeeAccessControl;
  tenantId?: string;
  isTemporaryPassword?: boolean;
  mustChangePassword?: boolean;
}

import { supabase, isSupabaseConfigured } from '@/lib/client/supabase';
import { getActiveTenantId, getScopedKey } from '@/lib/client/tenant-context';

const BASE_STORAGE_KEY = 'crm_employees_v2';

function getStorageKey(): string {
  return getScopedKey(BASE_STORAGE_KEY);
}

export const INITIAL_EMPLOYEES: Employee[] = [];

export function getRoleDefaultAccessControl(
  role: string = '',
  department: string = '',
  isAdmin: boolean = false
): EmployeeAccessControl {
  if (isAdmin) {
    return {
      pipeline: true,
      customers: true,
      inventory: true,
      procurement: true,
      deals: true,
      finance: true,
      testDrives: true,
      documents: true,
      reports: true,
      settings: true,
    };
  }

  const r = (role || '').toLowerCase();
  const d = (department || '').toLowerCase();

  if (r.includes('account') || r.includes('finance') || d.includes('finance')) {
    return {
      pipeline: false,
      customers: true,
      inventory: false,
      procurement: true,
      deals: true,
      finance: true,
      testDrives: false,
      documents: true,
      reports: true,
      settings: false,
    };
  }

  if (r.includes('technician') || r.includes('service') || d.includes('service')) {
    return {
      pipeline: false,
      customers: true,
      inventory: true,
      procurement: false,
      deals: false,
      finance: false,
      testDrives: false,
      documents: false,
      reports: false,
      settings: false,
    };
  }

  if (r.includes('manager') || d.includes('management')) {
    return {
      pipeline: true,
      customers: true,
      inventory: true,
      procurement: true,
      deals: true,
      finance: false,
      testDrives: true,
      documents: true,
      reports: true,
      settings: false,
    };
  }

  // Default sales executive / telecaller
  return {
    pipeline: true,
    customers: true,
    inventory: true,
    procurement: false,
    deals: true,
    finance: false,
    testDrives: true,
    documents: false,
    reports: false,
    settings: false,
  };
}

export function getEmployees(): Employee[] {
  if (typeof window === 'undefined') return INITIAL_EMPLOYEES;
  try {
    // Purge legacy mock employees from previous sessions
    localStorage.removeItem('crm_employees_v1');
    const key = getStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      let modified = false;
      const sanitized = parsed.map((emp) => {
        if (!emp || typeof emp !== 'object') return emp;
        const e = { ...emp };
        // Ensure userId field is populated
        e.userId = e.userId || e.employeeCode || '';
        e.employeeCode = e.userId;
        e.isPasswordSet = Boolean(e.isPasswordSet ?? (e.password && !e.isTemporaryPassword && !e.mustChangePassword));

        // Purge mock phone number
        if (e.phone === '+91 98000 00000') {
          e.phone = '';
          modified = true;
        }
        // Purge mock branch names
        if (
          e.branch === 'Apex Downtown Flagship' ||
          e.branch === 'Main Showroom' ||
          e.branch === 'Service & Body Shop Hub' ||
          e.branch === 'West Valley Outlet'
        ) {
          e.branch = '';
          modified = true;
        }
        // Purge mock leave balances (12 casual, 7 sick, 18 paid) when no leave records exist
        if (
          e.leaveBalance &&
          e.leaveBalance.casual?.total === 12 &&
          e.leaveBalance.sick?.total === 7 &&
          e.leaveBalance.paid?.total === 18 &&
          (!e.leaveHistory || e.leaveHistory.length === 0)
        ) {
          e.leaveBalance = {
            casual: { total: 0, used: 0 },
            sick: { total: 0, used: 0 },
            paid: { total: 0, used: 0 },
          };
          modified = true;
        }
        // Correct access control for Accountant / Finance roles
        const isFin = (e.designation || '').toLowerCase().includes('account') ||
                      (e.designation || '').toLowerCase().includes('finance') ||
                      e.department === 'Finance';
        if (isFin && e.accessControl && !e.accessControl.finance) {
          e.accessControl = getRoleDefaultAccessControl(e.designation, e.department, e.isAdmin);
          modified = true;
        }
        return e;
      });

      if (modified) {
        localStorage.setItem(key, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return [];
  } catch (err) {
    console.error('Failed to read employees from storage:', err);
    return [];
  }
}

export async function fetchEmployees(): Promise<Employee[]> {
  if (typeof window === 'undefined') return INITIAL_EMPLOYEES;

  if (isSupabaseConfigured()) {
    try {
      let data: any[] | null = null;
      const tenantId = getActiveTenantId();
      
      // 1. Try fetching via /api/employees (uses admin role key on server, bypasses RLS)
      try {
        const apiRes = await fetch(`/api/employees?tenantId=${encodeURIComponent(tenantId)}`);
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (Array.isArray(json.data)) {
            data = json.data;
          }
        }
      } catch (err) {
        console.warn('[EmployeeStore] /api/employees fetch error, trying direct client:', err);
      }

      // 2. Direct Supabase client fallback
      if (!data) {
        const { data: directData, error } = await supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[EmployeeStore] Supabase direct fetch error:', error.message);
        } else if (directData && Array.isArray(directData)) {
          data = directData;
        }
      }

      if (data && Array.isArray(data)) {
        const localList = getEmployees();
        const localMapById = new Map<string, Employee>();
        const localMapByEmail = new Map<string, Employee>();
        const localMapByName = new Map<string, Employee>();

        localList.forEach((e) => {
          if (e.id) localMapById.set(e.id, e);
          if (e.email) localMapByEmail.set(e.email.toLowerCase().trim(), e);
          if (e.fullName) localMapByName.set(e.fullName.toLowerCase().trim(), e);
        });

        const remoteList: Employee[] = data.map((row: any) => {
          const rowEmail = (row.email || '').toLowerCase().trim();
          const rowName = (row.full_name || '').toLowerCase().trim();
          const existing =
            localMapById.get(row.id) ||
            (rowEmail ? localMapByEmail.get(rowEmail) : undefined) ||
            (rowName ? localMapByName.get(rowName) : undefined);

          const roleName = row.role || existing?.designation || 'Staff Member';
          const deptName = (row.department as any) || existing?.department || 'Sales';
          const isAdm = existing?.isAdmin ?? false;

          const resolvedUserId = row.user_id || existing?.userId || existing?.employeeCode || `EMP-${row.id.slice(-3).toUpperCase()}`;

          return {
            id: row.id,
            tenantId: row.tenant_id || tenantId,
            userId: resolvedUserId,
            employeeCode: resolvedUserId,
            fullName: row.full_name || existing?.fullName || 'Staff Member',
            email: row.email || existing?.email || '',
            phone: row.phone || existing?.phone || '',
            designation: roleName,
            department: deptName,
            branch: existing?.branch || row.branch || '',
            joiningDate: row.joined_at || existing?.joiningDate || new Date().toISOString().split('T')[0],
            salary: existing?.salary || row.salary || '',
            salaryCategory: existing?.salaryCategory || row.salary_category || 'Annual CTC',
            isAdmin: isAdm,
            status: row.is_active ? 'active' : 'inactive',
            password: existing?.password || '',
            isPasswordSet: Boolean(row.is_password_set ?? existing?.isPasswordSet ?? false),
            avatarUrl: row.avatar_url || row.avatarUrl || existing?.avatarUrl || '',
            leaveBalance: existing?.leaveBalance || {
              casual: { total: 0, used: 0 },
              sick: { total: 0, used: 0 },
              paid: { total: 0, used: 0 },
            },
            leaveHistory: existing?.leaveHistory || [],
            accessControl: existing?.accessControl || getRoleDefaultAccessControl(roleName, deptName, isAdm),
          };
        });

        // Supabase is the authoritative source of truth!
        // If an employee was deleted in Supabase, they are NOT in remoteList and will be removed from local storage and UI.
        saveEmployees(remoteList);
        return remoteList;
      }
    } catch (err) {
      console.error('[EmployeeStore] Failed to fetch employees from Supabase:', err);
    }
  }

  return getEmployees();
}

// Supabase Realtime Listener for Employees: deletes row in frontend immediately when deleted in Supabase
let isEmployeeRealtimeActive = false;

export function initEmployeesRealtime(): void {
  if (typeof window === 'undefined' || isEmployeeRealtimeActive || !isSupabaseConfigured()) return;
  isEmployeeRealtimeActive = true;

  try {
    supabase
      .channel('public-employees-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              const current = getEmployees();
              const updated = current.filter((e) => e.id !== deletedId);
              saveEmployees(updated);
            } else {
              fetchEmployees();
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchEmployees();
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[EmployeeStore] Realtime subscription error:', err);
  }
}

export function saveEmployees(employees: Employee[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(employees));
    window.dispatchEvent(new Event('crm-employees-changed'));
  } catch (err) {
    console.error('Failed to save employees to storage:', err);
  }
}

export function validateStrongPassword(password: string): { valid: boolean; errors: string[] } {
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
    errors.push('Password must contain at least one special character or symbol (!@#$%^&*)');
  }
  return { valid: errors.length === 0, errors };
}

export function addEmployee(employeeData: Partial<Employee>): Employee {
  const current = getEmployees();
  const rawId = (employeeData.userId || employeeData.employeeCode || '').trim();
  const userId = rawId || `EMP-${Date.now().toString().slice(-4)}`;
  const isAdmin = !!employeeData.isAdmin;
  const tenantId = employeeData.tenantId || getActiveTenantId();

  // Generate a valid UUID so Supabase and client agree on the same ID
  const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'emp-' + Date.now();
  const empId = (employeeData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeData.id))
    ? employeeData.id
    : uuid;

  const resolvedRole = employeeData.designation || 'Sales Executive';
  const resolvedDept = employeeData.department || (isAdmin ? 'Admin' : 'Sales');

  const rawEmail = (employeeData.email || '').trim().toLowerCase();
  const emailRegex = /^(?:[A-Za-z0-9_'+\-]+(?:\.[A-Za-z0-9_'+\-]+)*)@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
  const validEmail = emailRegex.test(rawEmail)
    ? rawEmail
    : `${userId.toLowerCase().replace(/[^a-z0-9]/g, '')}@dealership.com`;

  const newEmp: Employee = {
    id: empId,
    tenantId: tenantId,
    userId: userId,
    employeeCode: userId, // Backward compatibility alias
    fullName: employeeData.fullName || 'New Employee',
    email: validEmail,
    phone: employeeData.phone || '',
    designation: resolvedRole,
    department: resolvedDept,
    branch: employeeData.branch || '',
    joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
    salary: employeeData.salary || '',
    salaryCategory: employeeData.salaryCategory || 'Annual CTC',
    isAdmin: isAdmin,
    status: employeeData.status || 'active',
    password: employeeData.password || '',
    isPasswordSet: false, // Staff creates their permanent password on 1st login
    avatarUrl: employeeData.avatarUrl || '',
    leaveBalance: employeeData.leaveBalance || {
      casual: { total: 0, used: 0 },
      sick: { total: 0, used: 0 },
      paid: { total: 0, used: 0 },
    },
    leaveHistory: employeeData.leaveHistory || [],
    accessControl: employeeData.accessControl || getRoleDefaultAccessControl(resolvedRole, resolvedDept, isAdmin),
  };

  const updated = [newEmp, ...current];
  saveEmployees(updated);

  // Sync to Supabase employees table via /api/employees (which handles service role key & foreign keys)
  if (typeof window !== 'undefined') {
    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newEmp.id,
        tenantId: newEmp.tenantId,
        userId: newEmp.userId,
        employeeCode: newEmp.userId,
        fullName: newEmp.fullName,
        email: newEmp.email,
        phone: newEmp.phone,
        designation: newEmp.designation,
        department: newEmp.department,
        status: newEmp.status,
        joiningDate: newEmp.joiningDate,
        salary: newEmp.salary,
        salaryCategory: newEmp.salaryCategory,
        isAdmin: newEmp.isAdmin,
        isPasswordSet: false,
        avatarUrl: newEmp.avatarUrl,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('[EmployeeStore] API addEmployee error:', errData);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('crm-error-popup', {
                detail: {
                  title: 'Database Synchronization Failed',
                  message: errData.error || errData.message || 'Failed to save employee to Supabase database.',
                  details: JSON.stringify(errData, null, 2),
                },
              })
            );
          }
        } else {
          console.log('[EmployeeStore] Successfully saved employee to Supabase backend table:', newEmp.fullName);
        }
      })
      .catch((err) => {
        console.error('[EmployeeStore] Failed to post employee to /api/employees:', err);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('crm-error-popup', {
              detail: {
                title: 'Network / Connection Error',
                message: err?.message || 'Could not reach server to save employee.',
              },
            })
          );
        }
      });
  }

  return newEmp;
}

export function updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
  const current = getEmployees();
  const idx = current.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const updatedEmp = { ...current[idx], ...updates };
  current[idx] = updatedEmp;
  saveEmployees(current);

  // Sync update to Supabase via /api/employees (uses service role admin)
  if (typeof window !== 'undefined') {
    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: updatedEmp.id,
        tenantId: updatedEmp.tenantId,
        userId: updatedEmp.userId,
        employeeCode: updatedEmp.userId,
        fullName: updatedEmp.fullName,
        email: updatedEmp.email,
        phone: updatedEmp.phone,
        designation: updatedEmp.designation,
        department: updatedEmp.department,
        status: updatedEmp.status,
        joiningDate: updatedEmp.joiningDate,
        salary: updatedEmp.salary,
        salaryCategory: updatedEmp.salaryCategory,
        isAdmin: updatedEmp.isAdmin,
        isPasswordSet: updatedEmp.isPasswordSet,
        avatarUrl: updatedEmp.avatarUrl,
      }),
    }).catch((err) => console.warn('[EmployeeStore] updateEmployee API sync warning:', err));
  }

  // Sync update to Supabase direct client fallback
  if (isSupabaseConfigured()) {
    const payload: Record<string, any> = {};
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.designation !== undefined) payload.role = updates.designation;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.status !== undefined) payload.is_active = updates.status === 'active';
    if (updates.joiningDate !== undefined) payload.joined_at = updates.joiningDate;
    if (updates.userId !== undefined) payload.user_id = updates.userId;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

    if (Object.keys(payload).length > 0) {
      supabase
        .from('employees')
        .update(payload)
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[EmployeeStore] Supabase updateEmployee error:', error.message);
          else console.log('[EmployeeStore] Successfully updated employee in Supabase backend');
        });
    }
  }

  return updatedEmp;
}

export function updateEmployeePassword(id: string, newPassword: string): boolean {
  const current = getEmployees();
  const emp = current.find((e) => e.id === id);
  if (!emp) return false;
  emp.password = newPassword;
  emp.isPasswordSet = true;
  saveEmployees(current);
  return true;
}

export async function setEmployeePermanentPassword(
  idOrUserId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const validation = validateStrongPassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] };
  }

  const current = getEmployees();
  const emp = current.find((e) => e.id === idOrUserId || (e.userId && e.userId.toLowerCase() === idOrUserId.toLowerCase()));

  if (emp) {
    emp.password = newPassword;
    emp.isPasswordSet = true;
    emp.mustChangePassword = false;
    emp.isTemporaryPassword = false;
    saveEmployees(current);
  }

  // Sync to database via /api/employees/auth
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/employees/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-password',
          userId: emp?.userId || idOrUserId,
          password: newPassword,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.error) return { success: false, error: json.error };
      }
    } catch (err) {
      console.warn('[EmployeeStore] Failed to sync password to Supabase:', err);
    }
  }

  return { success: true };
}

export async function resetEmployeePassword(id: string): Promise<{ success: boolean; error?: string }> {
  const current = getEmployees();
  const emp = current.find((e) => e.id === id);
  if (!emp) return { success: false, error: 'Employee not found in registry.' };
  emp.password = '';
  emp.isPasswordSet = false;
  saveEmployees(current);

  // Sync to database
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/employees/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userId: emp.userId || emp.id,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: false, error: json.error || 'Failed to reset password in database.' };
      }
    } catch (err: any) {
      console.warn('[EmployeeStore] Failed to sync reset to Supabase:', err);
      return { success: false, error: err?.message || 'Database connection error during reset.' };
    }
  }

  return { success: true };
}

export async function verifyEmployeeUserId(
  idOrEmail: string,
  tenantId?: string
): Promise<{
  success: boolean;
  employee?: Employee;
  isPasswordSet?: boolean;
  company?: { name: string; dealershipName?: string; logoUrl?: string | null; tenantId?: string };
  multipleTenants?: boolean;
  options?: any[];
  error?: string;
}> {
  const q = idOrEmail.trim().toLowerCase();
  if (!q) return { success: false, error: 'Please enter your User ID.' };

  // 1. Try remote database verification via /api/employees/auth
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/employees/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-id', userId: q, tenantId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.multipleTenants && json.options) {
          return {
            success: true,
            multipleTenants: true,
            options: json.options,
          };
        }

        if (json.success && json.employee) {
          const localList = getEmployees();
          const match = localList.find(
            (e) => e.id === json.employee.id || (e.userId && e.userId.toLowerCase() === q) || e.email.toLowerCase() === q
          );
          if (match) {
            match.isPasswordSet = json.employee.isPasswordSet;
            if (json.employee.tenantId) match.tenantId = json.employee.tenantId;
            saveEmployees(localList);
            return {
              success: true,
              employee: match,
              isPasswordSet: match.isPasswordSet,
              company: json.company,
            };
          }

          const freshEmp: Employee = {
            id: json.employee.id,
            tenantId: json.employee.tenantId,
            userId: json.employee.userId,
            employeeCode: json.employee.userId,
            fullName: json.employee.fullName,
            email: json.employee.email,
            phone: '',
            designation: json.employee.role || 'Staff Member',
            department: json.employee.department || 'Sales',
            branch: '',
            joiningDate: new Date().toISOString().split('T')[0],
            salary: '',
            salaryCategory: 'Annual CTC',
            isAdmin: json.employee.role === 'tenant_admin',
            status: json.employee.isActive ? 'active' : 'inactive',
            password: '',
            isPasswordSet: json.employee.isPasswordSet,
            leaveBalance: { casual: { total: 0, used: 0 }, sick: { total: 0, used: 0 }, paid: { total: 0, used: 0 } },
            leaveHistory: [],
            accessControl: getRoleDefaultAccessControl(json.employee.role, json.employee.department, false),
          };
          saveEmployees([freshEmp, ...localList]);
          return {
            success: true,
            employee: freshEmp,
            isPasswordSet: freshEmp.isPasswordSet,
            company: json.company,
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          return { success: false, error: errJson.error };
        }
      }
    } catch (err) {
      console.warn('[EmployeeStore] Remote verify error, trying local cache:', err);
    }
  }

  // 2. Client-side local verification fallback
  const all = getEmployees();
  const emp = all.find(
    (e) =>
      (e.userId && e.userId.toLowerCase() === q) ||
      (e.employeeCode && e.employeeCode.toLowerCase() === q) ||
      (e.email && e.email.toLowerCase() === q)
  );

  if (!emp) {
    return { success: false, error: `User ID '${idOrEmail}' was not found in the dealership database.` };
  }

  if (emp.status === 'inactive') {
    return { success: false, error: 'This employee account is inactive. Please contact your administrator.' };
  }

  return { success: true, employee: emp, isPasswordSet: Boolean(emp.isPasswordSet) };
}

export async function verifyEmployeeLogin(
  idOrEmail: string,
  pass: string
): Promise<{ success: boolean; employee?: Employee; requiresPasswordCreation?: boolean; error?: string }> {
  const q = idOrEmail.trim().toLowerCase();

  // Try remote database authentication first
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/employees/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', userId: q, password: pass }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const localList = getEmployees();
        const match = localList.find(
          (e) => e.id === json.employee?.id || (e.userId && e.userId.toLowerCase() === q) || e.email.toLowerCase() === q
        );
        const resolved = match || json.employee;
        return { success: true, employee: resolved };
      }
      if (json.requiresPasswordCreation) {
        return { success: false, requiresPasswordCreation: true, error: json.error };
      }
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
    } catch (err) {
      console.warn('[EmployeeStore] Remote login error, checking local store:', err);
    }
  }

  // Client-side fallback
  const all = getEmployees();
  const emp = all.find(
    (e) =>
      (e.userId && e.userId.toLowerCase() === q) ||
      (e.employeeCode && e.employeeCode.toLowerCase() === q) ||
      (e.email && e.email.toLowerCase() === q)
  );

  if (!emp) {
    return { success: false, error: 'No employee record found matching this User ID.' };
  }

  if (emp.status === 'inactive') {
    return { success: false, error: 'This employee account is inactive. Please contact your administrator.' };
  }

  if (!emp.isPasswordSet) {
    return { success: false, requiresPasswordCreation: true, error: 'Please create your permanent password.' };
  }

  if (emp.password !== pass) {
    return { success: false, error: 'Incorrect permanent password. Please verify and try again.' };
  }

  return { success: true, employee: emp };
}

export function updateEmployeeAccessControl(id: string, access: EmployeeAccessControl): boolean {
  const current = getEmployees();
  const emp = current.find((e) => e.id === id);
  if (!emp) return false;
  emp.accessControl = access;
  saveEmployees(current);
  return true;
}

export function addLeaveRecord(employeeId: string, leave: Omit<LeaveRecord, 'id' | 'appliedOn'>): boolean {
  const current = getEmployees();
  const emp = current.find((e) => e.id === employeeId);
  if (!emp) return false;

  const newRecord: LeaveRecord = {
    ...leave,
    id: 'lv-' + Date.now(),
    appliedOn: new Date().toISOString().split('T')[0],
  };

  // Update used balance if approved
  if (leave.status === 'approved') {
    if (leave.leaveType === 'casual') emp.leaveBalance.casual.used += leave.days;
    if (leave.leaveType === 'sick') emp.leaveBalance.sick.used += leave.days;
    if (leave.leaveType === 'paid') emp.leaveBalance.paid.used += leave.days;
  }

  emp.leaveHistory.unshift(newRecord);
  saveEmployees(current);
  return true;
}

export function updateLeaveRecordStatus(
  employeeId: string,
  leaveRecordId: string,
  newStatus: 'approved' | 'rejected' | 'pending',
  approvedBy = 'Administrator'
): boolean {
  const current = getEmployees();
  const emp = current.find((e) => e.id === employeeId);
  if (!emp) return false;

  const record = emp.leaveHistory.find((r) => r.id === leaveRecordId);
  if (!record) return false;

  const oldStatus = record.status;
  record.status = newStatus;
  if (newStatus === 'approved') {
    record.approvedBy = approvedBy;
  }

  // Adjust leave balance if moving into or out of 'approved' status
  if (oldStatus !== 'approved' && newStatus === 'approved') {
    if (record.leaveType === 'casual') emp.leaveBalance.casual.used += record.days;
    if (record.leaveType === 'sick') emp.leaveBalance.sick.used += record.days;
    if (record.leaveType === 'paid') emp.leaveBalance.paid.used += record.days;
  } else if (oldStatus === 'approved' && newStatus !== 'approved') {
    if (record.leaveType === 'casual') emp.leaveBalance.casual.used = Math.max(0, emp.leaveBalance.casual.used - record.days);
    if (record.leaveType === 'sick') emp.leaveBalance.sick.used = Math.max(0, emp.leaveBalance.sick.used - record.days);
    if (record.leaveType === 'paid') emp.leaveBalance.paid.used = Math.max(0, emp.leaveBalance.paid.used - record.days);
  }

  saveEmployees(current);
  return true;
}

export function deleteEmployee(id: string): Employee[] {
  const current = getEmployees();
  const updated = current.filter((e) => e.id !== id);
  saveEmployees(updated);

  if (typeof window !== 'undefined') {
    fetch(`/api/employees?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch((err) => {
      console.warn('[EmployeeStore] API delete error:', err);
    });
  }

  if (isSupabaseConfigured()) {
    supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[EmployeeStore] Supabase deleteEmployee error:', error.message);
        else console.log('[EmployeeStore] Deleted employee from Supabase:', id);
      });
  }

  return updated;
}
