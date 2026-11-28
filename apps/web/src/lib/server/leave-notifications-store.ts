import { supabaseAdmin } from '@/lib/server/supabase';
import { ensureTenantAndBranch } from '@/lib/server/tenant';

export interface LeaveBalanceAllocation {
  casual: { total: number; used: number };
  sick: { total: number; used: number };
  paid: { total: number; used: number };
}

export interface ServerLeaveRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeUserId?: string;
  employeeDepartment?: string;
  leaveType: 'casual' | 'sick' | 'paid' | 'emergency';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  appliedOn: string;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export interface ServerNotification {
  id: string;
  tenantId: string;
  recipientRole: 'admin' | 'employee' | 'all';
  recipientEmployeeId?: string | null;
  title: string;
  message: string;
  category: 'lead' | 'test_drive' | 'deal' | 'inventory' | 'customer' | 'leave_request' | 'leave_status';
  timestamp: string;
  createdAt: string;
  isRead: boolean;
  linkHref?: string;
  priority?: 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export const DEFAULT_ANNUAL_LEAVE_ALLOCATION: LeaveBalanceAllocation = {
  casual: { total: 12, used: 0 },
  sick: { total: 7, used: 0 },
  paid: { total: 18, used: 0 },
};

export function cloneDefaultLeaveAllocation(): LeaveBalanceAllocation {
  return {
    casual: { ...DEFAULT_ANNUAL_LEAVE_ALLOCATION.casual },
    sick: { ...DEFAULT_ANNUAL_LEAVE_ALLOCATION.sick },
    paid: { ...DEFAULT_ANNUAL_LEAVE_ALLOCATION.paid },
  };
}

export function normalizeLeaveAllocation(raw?: any): LeaveBalanceAllocation {
  if (!raw || typeof raw !== 'object') {
    return cloneDefaultLeaveAllocation();
  }
  const cTot = Number(raw.casual?.total || 0);
  const sTot = Number(raw.sick?.total || 0);
  const pTot = Number(raw.paid?.total || 0);

  // If all totals are unset or 0 (legacy initialized state), apply standard policy totals
  if (cTot <= 0 && sTot <= 0 && pTot <= 0) {
    return {
      casual: { total: 12, used: Math.max(0, Number(raw.casual?.used || 0)) },
      sick: { total: 7, used: Math.max(0, Number(raw.sick?.used || 0)) },
      paid: { total: 18, used: Math.max(0, Number(raw.paid?.used || 0)) },
    };
  }

  return {
    casual: { total: Math.max(0, cTot || 12), used: Math.max(0, Number(raw.casual?.used || 0)) },
    sick: { total: Math.max(0, sTot || 7), used: Math.max(0, Number(raw.sick?.used || 0)) },
    paid: { total: Math.max(0, pTot || 18), used: Math.max(0, Number(raw.paid?.used || 0)) },
  };
}

export function recomputeLeaveAllocation(
  records: ServerLeaveRecord[],
  baseBalance?: any
): LeaveBalanceAllocation {
  const normalized = normalizeLeaveAllocation(baseBalance);
  let casualUsed = 0;
  let sickUsed = 0;
  let paidUsed = 0;

  for (const r of records) {
    if (r.status !== 'approved') continue;
    const d = Math.max(0, Number(r.days) || 0);
    if (r.leaveType === 'casual') casualUsed += d;
    else if (r.leaveType === 'sick') sickUsed += d;
    else if (r.leaveType === 'paid') paidUsed += d;
  }

  return {
    casual: { total: normalized.casual.total, used: casualUsed },
    sick: { total: normalized.sick.total, used: sickUsed },
    paid: { total: normalized.paid.total, used: paidUsed },
  };
}

export function formatRelativeNotificationTime(isoOrText?: string): string {
  if (!isoOrText) return 'Just now';
  const parsed = Date.parse(isoOrText);
  if (Number.isNaN(parsed)) return isoOrText;
  const diffSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(parsed).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function isMissingRelationError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function mapTableLeaveRow(row: any): ServerLeaveRecord {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: row.employee_name || undefined,
    employeeUserId: row.employee_user_id || undefined,
    employeeDepartment: row.employee_department || undefined,
    leaveType: row.leave_type || 'casual',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    days: Number(row.days) || 1,
    reason: row.reason || '',
    appliedOn: row.applied_on || new Date().toISOString().split('T')[0],
    status: row.status || 'pending',
    approvedBy: row.approved_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    createdAt: row.created_at || undefined,
  };
}

function mapTableNotificationRow(row: any): ServerNotification {
  const createdAt = row.created_at || new Date().toISOString();
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    recipientRole: row.recipient_role || 'admin',
    recipientEmployeeId: row.recipient_employee_id || null,
    title: String(row.title || ''),
    message: String(row.message || ''),
    category: row.category || 'leave_request',
    timestamp: formatRelativeNotificationTime(createdAt),
    createdAt,
    isRead: Boolean(row.is_read),
    linkHref: row.link_href || undefined,
    priority: row.priority || 'normal',
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : undefined,
  };
}

async function readTenantSettingsSafe(tenantId: string): Promise<Record<string, any>> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  if (data?.settings && typeof data.settings === 'object') {
    return { ...data.settings };
  }
  return {};
}

async function writeTenantSettingsSafe(tenantId: string, updater: (prev: Record<string, any>) => Record<string, any>): Promise<Record<string, any>> {
  await ensureTenantAndBranch(tenantId).catch(() => null);
  const current = await readTenantSettingsSafe(tenantId);
  const next = updater(current);
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({
      settings: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);
  if (error) {
    console.warn('[LeaveNotifStore] Failed writing tenants.settings:', error.message);
  }
  return next;
}

export function buildLeaveRequestNotificationId(leaveRecordId: string): string {
  return `notif-leave-req-${leaveRecordId}`;
}

export function buildLeaveRequestNotification(record: ServerLeaveRecord, tenantId: string): ServerNotification {
  const empLabel = record.employeeName || 'Employee';
  const idSuffix = record.employeeUserId ? ` (${record.employeeUserId})` : '';
  const typeLabel =
    record.leaveType === 'casual'
      ? 'Casual'
      : record.leaveType === 'sick'
      ? 'Sick'
      : record.leaveType === 'paid'
      ? 'Paid'
      : 'Emergency';
  const daysText = `${record.days} ${record.days === 1 ? 'day' : 'days'}`;
  const createdAt = record.createdAt || new Date().toISOString();

  return {
    id: buildLeaveRequestNotificationId(record.id),
    tenantId,
    recipientRole: 'admin',
    recipientEmployeeId: null,
    title: `Leave Request — ${empLabel}`,
    message: `${empLabel}${idSuffix} applied for ${daysText} ${typeLabel} leave (${record.startDate} to ${record.endDate}): "${record.reason}"`,
    category: 'leave_request',
    timestamp: formatRelativeNotificationTime(createdAt),
    createdAt,
    isRead: record.status !== 'pending',
    linkHref: `/employees?leaveEmployeeId=${encodeURIComponent(record.employeeId)}&leaveRequestId=${encodeURIComponent(record.id)}`,
    priority: record.status === 'pending' ? 'high' : 'normal',
    metadata: {
      employeeId: record.employeeId,
      employeeName: empLabel,
      employeeUserId: record.employeeUserId || '',
      employeeDepartment: record.employeeDepartment || '',
      leaveRecordId: record.id,
      leaveType: record.leaveType,
      startDate: record.startDate,
      endDate: record.endDate,
      days: record.days,
      reason: record.reason,
      status: record.status,
      approvedBy: record.approvedBy,
    },
  };
}

/**
 * Loads all leave requests and computed balances for a tenant across dedicated tables + tenants.settings fallback.
 */
export async function listTenantLeaveSnapshot(
  tenantId: string,
  employeeIdFilter?: string
): Promise<{
  requestsByEmployee: Map<string, ServerLeaveRecord[]>;
  balancesByEmployee: Map<string, LeaveBalanceAllocation>;
  allRequests: ServerLeaveRecord[];
}> {
  const settings = await readTenantSettingsSafe(tenantId);
  const settingsRecords: ServerLeaveRecord[] = Array.isArray(settings.employee_leave_requests)
    ? settings.employee_leave_requests
    : [];
  const storedBalances: Record<string, any> =
    settings.employee_leave_balances && typeof settings.employee_leave_balances === 'object'
      ? settings.employee_leave_balances
      : {};

  let tableRecords: ServerLeaveRecord[] = [];
  try {
    let q = supabaseAdmin
      .from('employee_leave_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (employeeIdFilter) {
      q = q.eq('employee_id', employeeIdFilter);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      tableRecords = data.map(mapTableLeaveRow);
    } else if (error && !isMissingRelationError(error)) {
      console.warn('[LeaveNotifStore] employee_leave_requests read warning:', error.message);
    }
  } catch {}

  const mergedMap = new Map<string, ServerLeaveRecord>();
  for (const r of settingsRecords) {
    if (!r?.id) continue;
    if (employeeIdFilter && r.employeeId !== employeeIdFilter) continue;
    mergedMap.set(r.id, r);
  }
  for (const r of tableRecords) {
    if (!r?.id) continue;
    const prev = mergedMap.get(r.id);
    if (!prev || (r.reviewedAt && !prev.reviewedAt) || (r.status !== 'pending' && prev.status === 'pending')) {
      mergedMap.set(r.id, r);
    }
  }

  const allRequests = Array.from(mergedMap.values()).sort((a, b) => {
    const tA = Date.parse(a.createdAt || a.appliedOn || '') || 0;
    const tB = Date.parse(b.createdAt || b.appliedOn || '') || 0;
    return tB - tA;
  });

  const requestsByEmployee = new Map<string, ServerLeaveRecord[]>();
  for (const r of allRequests) {
    const list = requestsByEmployee.get(r.employeeId) || [];
    list.push(r);
    requestsByEmployee.set(r.employeeId, list);
  }

  const balancesByEmployee = new Map<string, LeaveBalanceAllocation>();
  const allEmpIds = new Set<string>([...Object.keys(storedBalances), ...Array.from(requestsByEmployee.keys())]);
  for (const empId of Array.from(allEmpIds)) {
    if (employeeIdFilter && empId !== employeeIdFilter) continue;
    balancesByEmployee.set(empId, recomputeLeaveAllocation(requestsByEmployee.get(empId) || [], storedBalances[empId]));
  }

  return { requestsByEmployee, balancesByEmployee, allRequests };
}

/**
 * Persists or updates a single employee leave request and updates employee balance + notifications cleanly.
 */
export async function saveTenantLeaveRecord(
  tenantId: string,
  record: ServerLeaveRecord,
  options?: { createAdminNotification?: boolean; createEmployeeStatusNotification?: boolean }
): Promise<{
  record: ServerLeaveRecord;
  employeeHistory: ServerLeaveRecord[];
  employeeBalance: LeaveBalanceAllocation;
  notification?: ServerNotification;
}> {
  const nowIso = new Date().toISOString();
  const normalizedRecord: ServerLeaveRecord = {
    ...record,
    createdAt: record.createdAt || nowIso,
    appliedOn: record.appliedOn || nowIso.split('T')[0],
  };

  // 1. Best-effort write to normalized table if available
  try {
    const { error } = await supabaseAdmin.from('employee_leave_requests').upsert(
      {
        id: normalizedRecord.id,
        tenant_id: tenantId,
        employee_id: normalizedRecord.employeeId,
        employee_name: normalizedRecord.employeeName || '',
        employee_user_id: normalizedRecord.employeeUserId || '',
        employee_department: normalizedRecord.employeeDepartment || 'Sales',
        leave_type: normalizedRecord.leaveType,
        start_date: normalizedRecord.startDate,
        end_date: normalizedRecord.endDate,
        days: Math.max(1, Number(normalizedRecord.days) || 1),
        reason: normalizedRecord.reason,
        applied_on: normalizedRecord.appliedOn,
        status: normalizedRecord.status,
        approved_by: normalizedRecord.approvedBy || null,
        reviewed_at: normalizedRecord.reviewedAt || null,
        created_at: normalizedRecord.createdAt,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (error && !isMissingRelationError(error)) {
      console.warn('[LeaveNotifStore] employee_leave_requests upsert warning:', error.message);
    }
  } catch {}

  let generatedNotif: ServerNotification | undefined;
  if (options?.createAdminNotification && normalizedRecord.status === 'pending') {
    generatedNotif = buildLeaveRequestNotification(normalizedRecord, tenantId);
  }

  let statusNotif: ServerNotification | undefined;
  if (options?.createEmployeeStatusNotification && normalizedRecord.status !== 'pending') {
    const isApp = normalizedRecord.status === 'approved';
    statusNotif = {
      id: `notif-leave-status-${normalizedRecord.id}-${normalizedRecord.status}`,
      tenantId,
      recipientRole: 'employee',
      recipientEmployeeId: normalizedRecord.employeeId,
      title: isApp ? 'Leave Request Approved' : 'Leave Request Declined',
      message: `Your ${normalizedRecord.leaveType} leave request (${normalizedRecord.startDate} to ${normalizedRecord.endDate}, ${normalizedRecord.days} ${normalizedRecord.days === 1 ? 'day' : 'days'}) was ${normalizedRecord.status} by ${normalizedRecord.approvedBy || 'Administrator'}.`,
      category: 'leave_status',
      timestamp: 'Just now',
      createdAt: nowIso,
      isRead: false,
      linkHref: '/empportal',
      priority: isApp ? 'normal' : 'high',
      metadata: {
        employeeId: normalizedRecord.employeeId,
        leaveRecordId: normalizedRecord.id,
        status: normalizedRecord.status,
        approvedBy: normalizedRecord.approvedBy,
      },
    };
  }

  // 2. Always persist atomically into tenants.settings JSONB (works even without migration 011)
  const adminNotifId = buildLeaveRequestNotificationId(normalizedRecord.id);
  let employeeHistory: ServerLeaveRecord[] = [];
  let employeeBalance: LeaveBalanceAllocation = cloneDefaultLeaveAllocation();

  await writeTenantSettingsSafe(tenantId, (prev) => {
    const prevRequests: ServerLeaveRecord[] = Array.isArray(prev.employee_leave_requests)
      ? prev.employee_leave_requests
      : [];
    const filtered = prevRequests.filter((r) => r.id !== normalizedRecord.id);
    const nextRequests = [normalizedRecord, ...filtered];

    employeeHistory = nextRequests.filter((r) => r.employeeId === normalizedRecord.employeeId);
    const prevBalances =
      prev.employee_leave_balances && typeof prev.employee_leave_balances === 'object'
        ? { ...prev.employee_leave_balances }
        : {};
    employeeBalance = recomputeLeaveAllocation(employeeHistory, prevBalances[normalizedRecord.employeeId]);
    prevBalances[normalizedRecord.employeeId] = employeeBalance;

    let nextNotifications: ServerNotification[] = Array.isArray(prev.dealership_notifications)
      ? [...prev.dealership_notifications]
      : [];

    // Update any existing admin leave-request notification metadata & read status on approval/rejection
    nextNotifications = nextNotifications.map((n) => {
      if (n.id === adminNotifId || n.metadata?.leaveRecordId === normalizedRecord.id) {
        if (n.recipientRole !== 'employee') {
          return {
            ...n,
            isRead: normalizedRecord.status !== 'pending' ? true : n.isRead,
            priority: normalizedRecord.status === 'pending' ? 'high' : 'normal',
            metadata: {
              ...(n.metadata || {}),
              status: normalizedRecord.status,
              approvedBy: normalizedRecord.approvedBy,
            },
          };
        }
      }
      return n;
    });

    if (generatedNotif) {
      nextNotifications = [generatedNotif, ...nextNotifications.filter((n) => n.id !== generatedNotif!.id)];
    }
    if (statusNotif) {
      nextNotifications = [statusNotif, ...nextNotifications.filter((n) => n.id !== statusNotif!.id)];
    }

    // Keep latest 100 notifications in settings to stay compact
    nextNotifications = nextNotifications.slice(0, 100);

    return {
      ...prev,
      employee_leave_requests: nextRequests,
      employee_leave_balances: prevBalances,
      dealership_notifications: nextNotifications,
    };
  });

  // 3. Best-effort sync notifications & employee columns in dedicated SQL tables if present
  const notifsToUpsert = [generatedNotif, statusNotif].filter(Boolean) as ServerNotification[];
  for (const n of notifsToUpsert) {
    try {
      await supabaseAdmin.from('dealership_notifications').upsert(
        {
          id: n.id,
          tenant_id: tenantId,
          recipient_role: n.recipientRole,
          recipient_employee_id: n.recipientEmployeeId || null,
          title: n.title,
          message: n.message,
          category: n.category,
          link_href: n.linkHref || null,
          priority: n.priority || 'normal',
          is_read: n.isRead,
          metadata: n.metadata || {},
          created_at: n.createdAt,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
    } catch {}
  }

  if (normalizedRecord.status !== 'pending') {
    try {
      await supabaseAdmin
        .from('dealership_notifications')
        .update({
          is_read: true,
          priority: 'normal',
          metadata: {
            employeeId: normalizedRecord.employeeId,
            employeeName: normalizedRecord.employeeName || '',
            employeeUserId: normalizedRecord.employeeUserId || '',
            leaveRecordId: normalizedRecord.id,
            leaveType: normalizedRecord.leaveType,
            startDate: normalizedRecord.startDate,
            endDate: normalizedRecord.endDate,
            days: normalizedRecord.days,
            reason: normalizedRecord.reason,
            status: normalizedRecord.status,
            approvedBy: normalizedRecord.approvedBy,
          },
          updated_at: nowIso,
        })
        .eq('tenant_id', tenantId)
        .eq('id', adminNotifId);
    } catch {}
  }

  try {
    const { error } = await supabaseAdmin
      .from('employees')
      .update({
        leave_balance: employeeBalance,
        leave_history: employeeHistory,
      })
      .eq('id', normalizedRecord.employeeId)
      .eq('tenant_id', tenantId);
    if (error && !String(error.message || '').includes('column')) {
      console.warn('[LeaveNotifStore] employees column sync note:', error.message);
    }
  } catch {}

  return {
    record: normalizedRecord,
    employeeHistory,
    employeeBalance,
    notification: generatedNotif,
  };
}

/**
 * Lists notifications scoped appropriately for either Admin/Manager or Staff Employee.
 * For Admins, guarantees every pending leave request appears as a visible alert even if created offline/earlier.
 */
export async function listScopedNotifications(
  tenantId: string,
  caller: { role: string; userId: string }
): Promise<ServerNotification[]> {
  const isManagerOrAdmin = caller.role === 'tenant_admin' || caller.role === 'branch_manager';
  const settings = await readTenantSettingsSafe(tenantId);
  const settingsNotifs: ServerNotification[] = Array.isArray(settings.dealership_notifications)
    ? settings.dealership_notifications
    : [];

  let tableNotifs: ServerNotification[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('dealership_notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && Array.isArray(data)) {
      tableNotifs = data.map(mapTableNotificationRow);
    }
  } catch {}

  const merged = new Map<string, ServerNotification>();
  for (const n of settingsNotifs) {
    if (!n?.id) continue;
    merged.set(n.id, {
      ...n,
      timestamp: formatRelativeNotificationTime(n.createdAt || n.timestamp),
    });
  }
  for (const n of tableNotifs) {
    if (!n?.id) continue;
    merged.set(n.id, n);
  }

  if (isManagerOrAdmin) {
    const { allRequests } = await listTenantLeaveSnapshot(tenantId);
    const dismissedIds = new Set<string>(
      Array.isArray(settings.dismissed_notification_ids) ? settings.dismissed_notification_ids : []
    );

    // Ensure every pending leave request surfaces for Admin unless explicitly dismissed
    for (const req of allRequests) {
      const notifId = buildLeaveRequestNotificationId(req.id);
      const existing = merged.get(notifId);
      if (req.status === 'pending' && !existing && !dismissedIds.has(notifId)) {
        merged.set(notifId, buildLeaveRequestNotification(req, tenantId));
      } else if (existing) {
        merged.set(notifId, {
          ...existing,
          metadata: {
            ...(existing.metadata || {}),
            employeeId: req.employeeId,
            employeeName: req.employeeName || existing.metadata?.employeeName,
            leaveRecordId: req.id,
            leaveType: req.leaveType,
            startDate: req.startDate,
            endDate: req.endDate,
            days: req.days,
            reason: req.reason,
            status: req.status,
            approvedBy: req.approvedBy,
          },
        });
      }
    }

    return Array.from(merged.values())
      .filter((n) => n.recipientRole !== 'employee')
      .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
  }

  // Staff employee only sees notifications addressed to them
  return Array.from(merged.values())
    .filter((n) => n.recipientRole === 'employee' && n.recipientEmployeeId === caller.userId)
    .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
}

export async function mutateScopedNotifications(
  tenantId: string,
  caller: { role: string; userId: string },
  action: { type: 'mark_read'; id: string } | { type: 'mark_all_read' } | { type: 'delete'; id: string } | { type: 'clear_all' }
): Promise<ServerNotification[]> {
  const isManagerOrAdmin = caller.role === 'tenant_admin' || caller.role === 'branch_manager';
  const matchesScope = (n: ServerNotification) =>
    isManagerOrAdmin
      ? n.recipientRole !== 'employee'
      : n.recipientRole === 'employee' && n.recipientEmployeeId === caller.userId;

  await writeTenantSettingsSafe(tenantId, (prev) => {
    const existing: ServerNotification[] = Array.isArray(prev.dealership_notifications)
      ? prev.dealership_notifications
      : [];
    const dismissedIds = new Set<string>(
      Array.isArray(prev.dismissed_notification_ids) ? prev.dismissed_notification_ids : []
    );

    let next = existing;
    if (action.type === 'mark_read') {
      next = existing.map((n) => (n.id === action.id && matchesScope(n) ? { ...n, isRead: true } : n));
    } else if (action.type === 'mark_all_read') {
      next = existing.map((n) => (matchesScope(n) ? { ...n, isRead: true } : n));
    } else if (action.type === 'delete') {
      dismissedIds.add(action.id);
      next = existing.filter((n) => !(n.id === action.id && matchesScope(n)));
    } else if (action.type === 'clear_all') {
      for (const n of existing) {
        if (matchesScope(n)) dismissedIds.add(n.id);
      }
      next = existing.filter((n) => !matchesScope(n));
    }

    return {
      ...prev,
      dealership_notifications: next,
      dismissed_notification_ids: Array.from(dismissedIds).slice(-200),
    };
  });

  // Best-effort sync to dealership_notifications table
  try {
    if (action.type === 'mark_read') {
      await supabaseAdmin
        .from('dealership_notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', action.id);
    } else if (action.type === 'mark_all_read') {
      const q = supabaseAdmin
        .from('dealership_notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
      if (isManagerOrAdmin) {
        await q.neq('recipient_role', 'employee');
      } else {
        await q.eq('recipient_role', 'employee').eq('recipient_employee_id', caller.userId);
      }
    } else if (action.type === 'delete') {
      await supabaseAdmin
        .from('dealership_notifications')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', action.id);
    } else if (action.type === 'clear_all') {
      const q = supabaseAdmin.from('dealership_notifications').delete().eq('tenant_id', tenantId);
      if (isManagerOrAdmin) {
        await q.neq('recipient_role', 'employee');
      } else {
        await q.eq('recipient_role', 'employee').eq('recipient_employee_id', caller.userId);
      }
    }
  } catch {}

  return listScopedNotifications(tenantId, caller);
}

