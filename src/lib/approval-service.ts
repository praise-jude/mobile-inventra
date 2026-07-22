// Direct-Supabase equivalent of Inventra/lib/approval-service.ts.
import { notifyApprovers } from '@/lib/actions/notifications';
import { supabase } from '@/lib/supabase';

export type ApprovalEntityType = 'discount' | 'void_sale' | 'price_change';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalSettings {
  org_id: string;
  discount_approval_enabled: boolean;
  discount_threshold_pct: number;
  void_approval_enabled: boolean;
  void_threshold_amount: number;
  price_change_approval_enabled: boolean;
  price_change_threshold_pct: number;
}

export async function getApprovalSettings(orgId: string): Promise<ApprovalSettings | null> {
  const { data, error } = await supabase.from('approval_settings').select('*').eq('org_id', orgId).single();
  if (error) return null;
  return data as ApprovalSettings;
}

export interface ApprovalRequestRow {
  id: string;
  org_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string | null;
  requested_by: string;
  requested_at: string;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  rejected_reason: string | null;
}

export async function createApprovalRequest(input: {
  orgId: string;
  entityType: ApprovalEntityType;
  entityId?: string | null;
  requestedBy: string;
  payload: Record<string, unknown>;
  reason?: string;
  notifyTitle: string;
  notifyBody: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      org_id: input.orgId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      requested_by: input.requestedBy,
      payload: input.payload,
      reason: input.reason?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('Could not submit this for approval.');

  await notifyApprovers({
    orgId: input.orgId,
    excludeUserId: input.requestedBy,
    type: 'approval.requested',
    title: input.notifyTitle,
    body: input.notifyBody,
    entityType: 'approval_request',
    entityId: data.id as string,
  });

  return data.id as string;
}
