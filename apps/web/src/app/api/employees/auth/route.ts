import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, isServerSupabaseConfigured } from '@/lib/server/supabase';
import { setSessionCookies } from '@/lib/server/session-cookies';

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

// POST /api/employees/auth
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'verify-id';
    const rawUserId = String(body.userId || body.user_id || body.username || '').trim();

    if (!rawUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!isServerSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        offlineMode: true,
        message: 'Supabase offline fallback',
      });
    }

    // 1. Look up employee in Supabase employees table
    const cleanId = rawUserId.toLowerCase();
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId);
    const filterQuery = isGuid
      ? `id.eq.${rawUserId},user_id.ilike.${cleanId},email.ilike.${cleanId}`
      : `user_id.ilike.${cleanId},email.ilike.${cleanId}`;

    let { data: empRows, error: empErr } = await supabaseAdmin
      .from('employees')
      .select('*')
      .or(filterQuery)
      .limit(10);

    if (empRows && body.tenantId) {
      empRows = empRows.filter((e: any) => e.tenant_id === body.tenantId);
    }

    // Check if multiple tenants match a generic User ID during verify-id
    if (empRows && empRows.length > 1 && !body.tenantId && action === 'verify-id') {
      const distinctTenants = Array.from(new Set(empRows.map((e: any) => e.tenant_id).filter(Boolean)));
      if (distinctTenants.length > 1) {
        const { data: profs } = await supabaseAdmin
          .from('company_profiles')
          .select('tenant_id, trade_name, legal_name, logo_url')
          .in('tenant_id', distinctTenants);

        const options = empRows.map((emp: any) => {
          const prof = profs?.find((p: any) => p.tenant_id === emp.tenant_id);
          const name = prof?.trade_name || prof?.legal_name || 'Dealership Workspace';
          return {
            employeeId: emp.id,
            tenantId: emp.tenant_id,
            dealershipName: name,
            logoUrl: prof?.logo_url || null,
            designation: emp.designation || emp.role || 'Staff Member',
            department: emp.department || 'General',
          };
        });

        return NextResponse.json({
          success: true,
          multipleTenants: true,
          options,
        });
      }
    }

    let employee = empRows && empRows[0] ? empRows[0] : null;

    // Check user_credentials as fallback if not in employees
    if (!employee) {
      const credQuery = isGuid
        ? `id.eq.${rawUserId},user_id.ilike.${cleanId},email.ilike.${cleanId}`
        : `user_id.ilike.${cleanId},email.ilike.${cleanId}`;

      const { data: credRows } = await supabaseAdmin
        .from('user_credentials')
        .select('*')
        .or(credQuery)
        .limit(1);

      if (credRows && credRows[0]) {
        const c = credRows[0];
        employee = {
          id: c.id,
          tenant_id: c.tenant_id,
          full_name: c.full_name,
          email: c.email,
          role: 'sales_executive',
          department: 'Sales',
          user_id: c.user_id,
          is_active: true,
          is_password_set: Boolean(c.password_hash),
          password_hash: c.password_hash,
        };
      }
    }

    // ACTION: verify-id
    if (action === 'verify-id') {
      if (!employee) {
        return NextResponse.json(
          { success: false, error: `User ID '${rawUserId}' was not found in the dealership database.` },
          { status: 404 }
        );
      }

      if (employee.is_active === false) {
        return NextResponse.json(
          { success: false, error: 'This employee account is deactivated. Please contact your administrator.' },
          { status: 403 }
        );
      }

      let companyProfile: any = null;
      if (employee.tenant_id) {
        const { data: profRows } = await supabaseAdmin
          .from('company_profiles')
          .select('trade_name, legal_name, logo_url, tenant_id')
          .eq('tenant_id', employee.tenant_id)
          .limit(1);
        if (profRows && profRows[0]) {
          companyProfile = profRows[0];
        }
      }

      const dealershipName = companyProfile?.trade_name || companyProfile?.legal_name || 'Dealership CRM Platform';
      const logoUrl = companyProfile?.logo_url || null;
      const isPasswordSet = Boolean(employee.is_password_set && employee.password_hash);

      return NextResponse.json({
        success: true,
        employee: {
          id: employee.id,
          tenantId: employee.tenant_id,
          fullName: employee.full_name,
          email: employee.email,
          role: employee.role,
          department: employee.department,
          userId: employee.user_id || rawUserId,
          avatarUrl: employee.avatar_url || '',
          isActive: employee.is_active !== false,
          isPasswordSet: isPasswordSet,
        },
        company: {
          name: dealershipName,
          dealershipName: dealershipName,
          tradeName: companyProfile?.trade_name || dealershipName,
          legalName: companyProfile?.legal_name || dealershipName,
          logoUrl: logoUrl,
          tenantId: employee.tenant_id,
        },
      });
    }

    // ACTION: reset-password
    if (action === 'reset-password') {
      if (!employee) {
        return NextResponse.json(
          { success: false, error: `Employee '${rawUserId}' was not found in database.` },
          { status: 404 }
        );
      }

      // 1. Reset in employees table
      const { error: resetErr } = await supabaseAdmin
        .from('employees')
        .update({
          password_hash: null,
          is_password_set: false,
        })
        .eq('id', employee.id);

      if (resetErr) {
        console.error('[API/employees/auth] reset-password error:', resetErr.message);
        return NextResponse.json({ success: false, error: resetErr.message }, { status: 500 });
      }

      // 2. Also clear in user_credentials fallback if present
      try {
        await supabaseAdmin
          .from('user_credentials')
          .update({
            password_hash: null,
            is_password_set: false,
          })
          .or(`user_id.ilike.${cleanId},email.ilike.${cleanId}`);
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Password for employee ${employee.full_name || rawUserId} has been reset successfully. Staff can now create a new permanent password at /emplogin.`,
        employee: {
          id: employee.id,
          userId: employee.user_id || rawUserId,
          isPasswordSet: false,
        },
      });
    }

    // ACTION: set-password
    if (action === 'set-password') {
      if (!employee) {
        return NextResponse.json(
          { success: false, error: `Employee with User ID '${rawUserId}' was not found.` },
          { status: 404 }
        );
      }

      const newPassword = String(body.password || '').trim();
      const validation = validateStrongPassword(newPassword);

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.errors[0], allErrors: validation.errors },
          { status: 400 }
        );
      }

      const hashed = hashPassword(newPassword);

      // Update in employees table
      const { error: updateErr } = await supabaseAdmin
        .from('employees')
        .update({
          password_hash: hashed,
          is_password_set: true,
          user_id: employee.user_id || rawUserId,
        })
        .eq('id', employee.id);

      if (updateErr) {
        console.warn('[API/employees/auth] update employee note:', updateErr.message);
      }

      const res = NextResponse.json({
        success: true,
        message: 'Permanent password created successfully.',
        employee: {
          id: employee.id,
          tenantId: employee.tenant_id,
          fullName: employee.full_name,
          email: employee.email,
          role: employee.role,
          department: employee.department,
          userId: employee.user_id || rawUserId,
          isPasswordSet: true,
        },
      });

      // Set authentic session cookies so employee is immediately logged in
      const roleMap: Record<string, string> = {
        sales_executive: 'sales_executive',
        finance_manager: 'finance_manager',
        inventory_manager: 'inventory_manager',
        service_advisor: 'service_advisor',
        branch_manager: 'branch_manager',
        tenant_admin: 'tenant_admin',
      };
      const userRole = roleMap[employee.role] || 'sales_executive';

      await setSessionCookies(res, {
        accessToken: `emp-session-${employee.id}`,
        userId: employee.id,
        tenantId: employee.tenant_id,
        role: userRole,
        isOnboarded: true,
      });

      const staffCookieData = {
        id: employee.id,
        userId: employee.user_id || rawUserId,
        employeeCode: employee.user_id || rawUserId,
        fullName: employee.full_name,
        email: employee.email,
        role: userRole,
        department: employee.department || 'Sales',
        designation: userRole === 'sales_executive' ? 'Sales Executive' : 'Staff Member',
        branch: 'Main Showroom',
        avatarUrl: employee.avatar_url || '',
        accessControl: employee.access_control || {
          pipeline: true,
          customers: true,
          inventory: true,
          deals: true,
          finance: true,
          testDrives: true,
          documents: true,
          reports: true,
        },
      };
      res.cookies.set('crm-employee-session', encodeURIComponent(JSON.stringify(staffCookieData)), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });

      if (employee.tenant_id) {
        try {
          const { data: comp } = await supabaseAdmin
            .from('company_profiles')
            .select('trade_name, legal_name')
            .eq('tenant_id', employee.tenant_id)
            .limit(1);
          const name = comp?.[0]?.trade_name || comp?.[0]?.legal_name;
          if (name) {
            res.cookies.set('crm-dealership-name', encodeURIComponent(name), {
              path: '/',
              maxAge: 60 * 60 * 24 * 7,
              sameSite: 'lax',
            });
          }
        } catch {}
      }

      return res;
    }

    // ACTION: login
    if (action === 'login') {
      if (!employee) {
        return NextResponse.json(
          { success: false, error: `User ID '${rawUserId}' was not found.` },
          { status: 404 }
        );
      }

      const inputPassword = String(body.password || '');
      if (!employee.password_hash) {
        return NextResponse.json(
          {
            success: false,
            requiresPasswordCreation: true,
            error: 'No permanent password has been created for this User ID yet. Please create one.',
          },
          { status: 400 }
        );
      }

      const isMatch = verifyPassword(inputPassword, employee.password_hash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'Incorrect password. Please verify your credentials.' },
          { status: 401 }
        );
      }

      const res = NextResponse.json({
        success: true,
        message: 'Employee authentication successful.',
        employee: {
          id: employee.id,
          tenantId: employee.tenant_id,
          fullName: employee.full_name,
          email: employee.email,
          role: employee.role,
          department: employee.department,
          userId: employee.user_id || rawUserId,
          isPasswordSet: true,
        },
      });

      const roleMap: Record<string, string> = {
        sales_executive: 'sales_executive',
        finance_manager: 'finance_manager',
        inventory_manager: 'inventory_manager',
        service_advisor: 'service_advisor',
        branch_manager: 'branch_manager',
        tenant_admin: 'tenant_admin',
      };
      const userRole = roleMap[employee.role] || 'sales_executive';

      await setSessionCookies(res, {
        accessToken: `emp-session-${employee.id}`,
        userId: employee.id,
        tenantId: employee.tenant_id,
        role: userRole,
        isOnboarded: true,
      });

      const staffLoginCookie = {
        id: employee.id,
        userId: employee.user_id || rawUserId,
        employeeCode: employee.user_id || rawUserId,
        fullName: employee.full_name,
        email: employee.email,
        role: userRole,
        department: employee.department || 'Sales',
        designation: userRole === 'sales_executive' ? 'Sales Executive' : 'Staff Member',
        branch: 'Main Showroom',
        avatarUrl: employee.avatar_url || '',
        accessControl: employee.access_control || {
          pipeline: true,
          customers: true,
          inventory: true,
          deals: true,
          finance: true,
          testDrives: true,
          documents: true,
          reports: true,
        },
      };

      res.cookies.set('crm-employee-session', encodeURIComponent(JSON.stringify(staffLoginCookie)), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });

      if (employee.tenant_id) {
        try {
          const { data: comp } = await supabaseAdmin
            .from('company_profiles')
            .select('trade_name, legal_name')
            .eq('tenant_id', employee.tenant_id)
            .limit(1);
          const name = comp?.[0]?.trade_name || comp?.[0]?.legal_name;
          if (name) {
            res.cookies.set('crm-dealership-name', encodeURIComponent(name), {
              path: '/',
              maxAge: 60 * 60 * 24 * 7,
              sameSite: 'lax',
            });
          }
        } catch {}
      }

      return res;
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[API/employees/auth] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

