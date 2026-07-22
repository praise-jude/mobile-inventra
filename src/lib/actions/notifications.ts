// Mirrors Inventra/lib/actions/notifications.ts +
// lib/notifications-service.ts. Mobile reads its own feed and creates
// notifications for other org members directly (called from
// src/lib/actions/team.ts's approveMember/rejectMember) — RLS
// (notifications_insert_org) is the real gate, no bearer-token route
// needed, same as audit_logs.
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/types/database';

export type { NotificationRow };

export async function getNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load notifications.');
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}

export interface CreateNotificationInput {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

// Fire-and-forget, same reasoning as logAudit — a failed notification
// insert must never break the mutation it's describing.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert({
      org_id: input.orgId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    });
    if (error) {
      console.error('[Royal Inventra] createNotification failed:', error);
      return;
    }
    await sendPushNotification(input.userId, input.title, input.body);
  } catch (err) {
    console.error('[Royal Inventra] createNotification threw:', err);
  }
}

// Expo's push endpoint needs no API key for this volume — just the
// recipient's push token(s). Never throws.
async function sendPushNotification(userId: string, title: string, body?: string): Promise<void> {
  try {
    const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    if (!tokens || tokens.length === 0) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title, body: body ?? '', sound: 'default' }))),
    });
  } catch (err) {
    console.error('[Royal Inventra] sendPushNotification failed:', err);
  }
}

// Fans out a notification to every manager/admin/owner in the org except
// the actor who triggered it — mirrors Inventra/lib/notifications-service.ts's
// notifyApprovers. createNotification has no broadcast concept (single
// recipient by design), so this just calls it once per approver.
export async function notifyApprovers(input: {
  orgId: string;
  excludeUserId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const { data: approvers } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', input.orgId)
    .in('role', ['owner', 'admin', 'manager'])
    .neq('id', input.excludeUserId);

  await Promise.all(
    (approvers ?? []).map((a) =>
      createNotification({
        orgId: input.orgId,
        userId: a.id,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      }),
    ),
  );
}

// Called once per session (see (app)/_layout.tsx) after a user is
// authenticated. Web has no meaningful equivalent (would need VAPID keys
// for browser push, a separate setup) so this is native-only; simulators
// also can't receive real pushes, only a physical device or Device.isDevice
// checks that off for us.
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = 'd6950080-af83-447e-acd1-fcd923c46a24';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('push_tokens').upsert({ user_id: session.user.id, token, platform: Platform.OS }, { onConflict: 'token' });
  } catch (err) {
    console.error('[Royal Inventra] registerPushToken failed:', err);
  }
}

// Called from signOut() before the session is actually torn down (RLS
// needs a valid auth.uid() to delete the row). Without this, a stale token
// keeps pointing at the logged-out user until someone else logs into this
// device and registerPushToken()'s upsert reassigns it — on a shared
// device, any notification generated for the logged-out user in that
// window still pushes to this device's lock screen. Deletes by exact token
// (globally unique), not by user_id, so other devices this user is still
// signed into are unaffected.
export async function deregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = 'd6950080-af83-447e-acd1-fcd923c46a24';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch (err) {
    console.error('[Royal Inventra] deregisterPushToken failed:', err);
  }
}
