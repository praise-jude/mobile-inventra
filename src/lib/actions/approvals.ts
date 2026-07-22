// Direct-Supabase equivalent of Inventra/lib/actions/approvals.ts.
import { logAudit } from '@/lib/actions/audit';
import { createNotification } from '@/lib/actions/notifications';
import { performRecordSale, performDeleteSale, type RecordSaleInput } from '@/lib/actions/sales';
import { performUpdateProduct, type UpdateProductInput } from '@/lib/actions/products';
import type { ApprovalRequestRow } from '@/lib/approval-service';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

async function requireApproverProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Only a manager or admin can decide approval requests.');
  }
  return profile;
}

async function loadRequesterCtx(requestedBy: string, orgId: string) {
  const { data: profile } = await supabase.from('profiles').select('role, first_name, last_name').eq('id', requestedBy).single();
  if (!profile) throw new Error("The original requester's profile could not be found.");
  return { orgId, userId: requestedBy, role: profile.role, actorName: `${profile.first_name} ${profile.last_name}` };
}

const ENTITY_LABEL: Record<string, string> = { discount: 'discount', void_sale: 'void', price_change: 'price change' };

async function notifyRequester(
  request: { org_id: string; requested_by: string; entity_type: string; id: string },
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<void> {
  const label = ENTITY_LABEL[request.entity_type] ?? request.entity_type;
  await createNotification({
    orgId: request.org_id,
    userId: request.requested_by,
    type: `approval.${decision}`,
    title: decision === 'approved' ? `Your ${label} request was approved` : `Your ${label} request was rejected`,
    body: decision === 'rejected' ? reason || undefined : undefined,
    entityType: 'approval_request',
    entityId: request.id,
  });
}

export interface PendingApprovalRow {
  id: string;
  entityType: string;
  entityId: string | null;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  payload: Record<string, unknown>;
  reason: string | null;
}

export async function listPendingApprovals(): Promise<PendingApprovalRow[]> {
  const profile = await requireApproverProfile();
  const { data, error } = await supabase
    .from('approval_requests')
    .select('id, entity_type, entity_id, requested_by, requested_at, payload, reason')
    .eq('org_id', profile.org_id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error || !data || data.length === 0) return [];

  const requesterIds = [...new Set(data.map((r) => r.requested_by))];
  const { data: requesters } = await supabase.from('profiles').select('id, first_name, last_name').in('id', requesterIds);
  const nameById = new Map((requesters ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

  return data.map((r) => ({
    id: r.id as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string | null,
    requestedBy: r.requested_by as string,
    requestedByName: nameById.get(r.requested_by as string) ?? 'Unknown',
    requestedAt: r.requested_at as string,
    payload: r.payload as Record<string, unknown>,
    reason: r.reason as string | null,
  }));
}

export async function cancelApprovalRequest(requestId: string): Promise<void> {
  const profile = await requireProfile();
  const { error } = await supabase.from('approval_requests').update({ status: 'cancelled' }).eq('id', requestId).eq('requested_by', profile.id);
  if (error) throw new Error('Could not cancel this request.');
}

export async function decideApprovalRequest(requestId: string, decision: 'approved' | 'rejected', rejectReason?: string): Promise<void> {
  const profile = await requireApproverProfile();

  const { data: requestRow, error: fetchError } = await supabase.from('approval_requests').select('*').eq('id', requestId).single();
  if (fetchError || !requestRow) throw new Error('Approval request not found.');
  const request = requestRow as ApprovalRequestRow;
  if (request.status !== 'pending') throw new Error('This request has already been decided.');

  const ctx = { orgId: profile.org_id, userId: profile.id, role: profile.role, actorName: `${profile.first_name} ${profile.last_name}` };

  if (decision === 'rejected') {
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: 'rejected', rejected_reason: rejectReason?.trim() || null })
      .eq('id', requestId);
    if (error) throw new Error('Could not reject this request.');
    await notifyRequester(request, 'rejected', rejectReason);
    void logAudit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorName: ctx.actorName,
      actorRole: ctx.role,
      action: 'approval.rejected',
      module: 'Approvals',
      entityType: 'approval_request',
      entityId: requestId,
      newValue: { rejectedReason: rejectReason ?? null },
    });
    return;
  }

  const requesterCtx = await loadRequesterCtx(request.requested_by, profile.org_id);
  let resultEntityId = request.entity_id;

  if (request.entity_type === 'discount') {
    const { input, computed } = request.payload as { input: RecordSaleInput; computed: Parameters<typeof performRecordSale>[2] };
    resultEntityId = await performRecordSale(requesterCtx, input, computed);
  } else if (request.entity_type === 'void_sale') {
    const { saleId, total } = request.payload as { saleId: string; total: number };
    await performDeleteSale(requesterCtx, { id: saleId, total });
  } else if (request.entity_type === 'price_change') {
    const { productId, input } = request.payload as { productId: string; input: UpdateProductInput };
    await performUpdateProduct(requesterCtx, productId, input);
  } else {
    throw new Error(`Unknown approval entity type: ${request.entity_type}`);
  }

  const { error: approveError } = await supabase.from('approval_requests').update({ status: 'approved', entity_id: resultEntityId }).eq('id', requestId);
  if (approveError) throw new Error("The change was applied, but the request couldn't be marked approved. Please refresh.");

  await notifyRequester(request, 'approved');
  void logAudit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    actorName: ctx.actorName,
    actorRole: ctx.role,
    action: 'approval.approved',
    module: 'Approvals',
    entityType: 'approval_request',
    entityId: requestId,
  });
}
