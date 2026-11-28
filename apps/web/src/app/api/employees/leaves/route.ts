import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isServerSupabaseConfigured } from '@/lib/server/supabase';
import { requireAuth } from '@/lib/server/auth';
import {
  listTenantLeaveSnapshot,
  saveTenantLeaveRecord,
  ServerLeaveRecord,
} from '@/lib/server/leave-notifications-store';

function isManagerOrAdmin(role: string): boolean {
  return role === 'tenant_admin' || role === 'branch_manager';
}

// GET /api/employees/leaves - Fetch leave requests & balances scoped to tenant/caller
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ data: [], error: 'Supabase not configured' });
  }

  try {
    const tenantId = auth.session.tenantId;
    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get('employeeId') || undefined;
    const targetEmployeeId = isManagerOrAdmin(auth.session.role)
      ? requestedEmployeeId
      : auth.session.user.id;

    const snapshot = await listTenantLeaveSnapshot(tenantId, targetEmployeeId);
    return NextResponse.json({
      success: true,
      data: snapshot.allRequests,
      balances: Object.fromEntries(snapshot.balancesByEmployee.entries()),
    });
  } catch (err: any) {
    console.error('[API/employees/leaves] GET error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load leave requests' }, { status: 500 });
  }
}

// POST /api/employees/leaves - Submit a new leave request (staff creates 'pending' + notifies admin; admin can record directly)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = auth.session.tenantId;
    const callerIsAdmin = isManagerOrAdmin(auth.session.role);

    const requestedEmpId = String(body.employeeId || '').trim();
    const targetEmployeeId = callerIsAdmin && requestedEmpId ? requestedEmpId : requestedEmpId || auth.session.user.id;

    // Non-admin staff can only submit leave requests for their own record
    if (!callerIsAdmin && requestedEmpId && requestedEmpId !== auth.session.user.id) {
      return NextResponse.json(
        { error: 'Employees may only submit leave requests for their own account.' },
        { status: 403 }
      );
    }

    const leaveType = String(body.leaveType || 'casual').toLowerCase();
    if (!['casual', 'sick', 'paid', 'emergency'].includes(leaveType)) {
      return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });
    }

    const startDate = String(body.startDate || '').trim();
    const endDate = String(body.endDate || '').trim();
    const reason = String(body.reason || '').trim();
    const days = Math.max(1, Number(body.days) || 1);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required.' }, { status: 400 });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: 'Leave start date cannot be later than end date.' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Please provide a reason for your leave request.' }, { status: 400 });
    }

    // Look up authoritative employee metadata in Supabase for this tenant
    let { data: empRow } = await supabaseAdmin
      .from('employees')
      .select('id, tenant_id, full_name, user_id, department')
      .eq('id', targetEmployeeId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Also try resolving by user_id/email for staff session if needed
    if (!empRow && auth.session.user.email) {
      const { data: empByEmail } = await supabaseAdmin
        .from('employees')
        .select('id, tenant_id, full_name, user_id, department')
        .eq('tenant_id', tenantId)
        .ilike('email', auth.session.user.email)
        .limit(1);
      if (empByEmail?.[0]) empRow = empByEmail[0];
    }

    if (!empRow) {
      return NextResponse.json(
        { error: 'Employee record not found in this dealership workspace.' },
        { status: 404 }
      );
    }

    const enforcedStatus: 'pending' | 'approved' =
      callerIsAdmin && body.status === 'approved' ? 'approved' : 'pending';

    const recordId =
      typeof body.id === 'string' && body.id.trim().length >= 4
        ? body.id.trim()
        : `lv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const record: ServerLeaveRecord = {
      id: recordId,
      employeeId: empRow.id,
      employeeName: empRow.full_name || body.employeeName || 'Staff Member',
      employeeUserId: empRow.user_id || body.employeeUserId || '',
      employeeDepartment: empRow.department || 'Sales',
      leaveType: leaveType as ServerLeaveRecord['leaveType'],
      startDate,
      endDate,
      days,
      reason,
      appliedOn: new Date().toISOString().split('T')[0],
      status: enforcedStatus,
      approvedBy: enforcedStatus === 'approved' ? auth.session.user.fullName || 'Administrator' : undefined,
      reviewedAt: enforcedStatus === 'approved' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };

    const result = await saveTenantLeaveRecord(tenantId, record, {
      createAdminNotification: enforcedStatus === 'pending',
    });

    return NextResponse.json({
      success: true,
      data: result.record,
      leaveHistory: result.employeeHistory,
      leaveBalance: result.employeeBalance,
      notification: result.notification || null,
    });
  } catch (err: any) {
    console.error('[API/employees/leaves] POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to submit leave request' }, { status: 500 });
  }
}

// PATCH /api/employees/leaves - Approve or reject an employee leave request (Admin / Manager only)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['tenant_admin', 'branch_manager']);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = auth.session.tenantId;
    const employeeId = String(body.employeeId || '').trim();
    const leaveRecordId = String(body.leaveRecordId || '').trim();
    const nextStatus = String(body.status || '').toLowerCase();

    if (!employeeId || !leaveRecordId) {
      return NextResponse.json({ error: 'employeeId and leaveRecordId are required.' }, { status: 400 });
    }
    if (!['approved', 'rejected', 'pending'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status. Expected approved, rejected, or pending.' }, { status: 400 });
    }

    const snapshot = await listTenantLeaveSnapshot(tenantId, employeeId);
    const existing = snapshot.allRequests.find((r) => r.id === leaveRecordId && r.employeeId === employeeId);
    if (!existing) {
      return NextResponse.json({ error: 'Leave request not found in database.' }, { status: 404 });
    }

    const approverName = String(body.approvedBy || auth.session.user.fullName || 'Administrator');
    const updatedRecord: ServerLeaveRecord = {
      ...existing,
      status: nextStatus as ServerLeaveRecord['status'],
      approvedBy: nextStatus === 'approved' ? approverName : nextStatus === 'rejected' ? approverName : undefined,
      reviewedAt: nextStatus === 'pending' ? undefined : new Date().toISOString(),
    };

    const result = await saveTenantLeaveRecord(tenantId, updatedRecord, {
      createEmployeeStatusNotification: nextStatus === 'approved' || nextStatus === 'rejected',
    });

    return NextResponse.json({
      success: true,
      data: result.record,
      leaveHistory: result.employeeHistory,
      leaveBalance: result.employeeBalance,
    });
  } catch (err: any) {
    console.error('[API/employees/leaves] PATCH error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update leave request' }, { status: 500 });
  }
}

