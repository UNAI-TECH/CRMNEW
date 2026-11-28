import { NextRequest, NextResponse } from 'next/server';
import { isServerSupabaseConfigured } from '@/lib/server/supabase';
import { requireAuth } from '@/lib/server/auth';
import {
  listScopedNotifications,
  mutateScopedNotifications,
} from '@/lib/server/leave-notifications-store';

// GET /api/notifications - Fetch role-scoped dealership notifications
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ data: [] });
  }

  try {
    const notifications = await listScopedNotifications(auth.session.tenantId, {
      role: auth.session.role,
      userId: auth.session.user.id,
    });
    return NextResponse.json({ success: true, data: notifications });
  } catch (err: any) {
    console.error('[API/notifications] GET error:', err);
    return NextResponse.json({ data: [], error: err?.message || 'Failed to load notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark single or all notifications read
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ data: [] });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const caller = { role: auth.session.role, userId: auth.session.user.id };

    const updated = body.markAllRead
      ? await mutateScopedNotifications(auth.session.tenantId, caller, { type: 'mark_all_read' })
      : body.id
      ? await mutateScopedNotifications(auth.session.tenantId, caller, { type: 'mark_read', id: String(body.id) })
      : await listScopedNotifications(auth.session.tenantId, caller);

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[API/notifications] PATCH error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update notifications' }, { status: 500 });
  }
}

// DELETE /api/notifications - Dismiss one or clear all notifications in caller scope
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ data: [] });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';
    const caller = { role: auth.session.role, userId: auth.session.user.id };

    const updated = clearAll
      ? await mutateScopedNotifications(auth.session.tenantId, caller, { type: 'clear_all' })
      : id
      ? await mutateScopedNotifications(auth.session.tenantId, caller, { type: 'delete', id })
      : await listScopedNotifications(auth.session.tenantId, caller);

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[API/notifications] DELETE error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete notification' }, { status: 500 });
  }
}

