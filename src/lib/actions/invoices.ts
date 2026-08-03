// Direct-Supabase equivalent of Inventra/lib/actions/invoices.ts. Create is
// open to any org member (matches Sales); status changes and delete require
// manager-tier+ (matches Debtors' pattern) — customer_invoices_update/delete
// RLS already enforces this, this just gives a clear error instead of a
// silent RLS-denied no-op.
import { logAudit } from '@/lib/actions/audit';
import { canAddInvoice, UpgradeRequiredError } from '@/lib/entitlements';
import { logError } from '@/lib/logger';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { CustomerInvoiceStatus } from '@/types/database';

function requireManagerRole(role: string) {
  if (!['owner', 'admin', 'manager'].includes(role)) {
    throw new Error('Only an owner, admin, or manager can manage this invoice.');
  }
}

// crypto.randomUUID() isn't reliably available in the Hermes runtime; the
// app already polyfills crypto.getRandomValues (src/lib/supabase.ts), so
// build the same 8-hex-char suffix web's randomUUID().slice(0,8) produces
// from that instead of adding a new uuid dependency.
function randomInvoiceSuffix(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  issueDate: string;
  dueDate?: string;
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  items: InvoiceItemInput[];
}

export async function createInvoice(input: InvoiceInput): Promise<string> {
  const profile = await requireProfile();
  if (!(await canAddInvoice())) {
    throw new UpgradeRequiredError("You've reached your Free Plan limit of 10 invoices. Upgrade to Premium for unlimited invoices.");
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error('Customer name is required.');
  if (input.items.length === 0) throw new Error('Add at least one line item.');

  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountAmount = input.discountAmount ?? 0;
  const taxAmount = input.taxAmount ?? 0;
  const total = subtotal - discountAmount + taxAmount;
  const invoiceNumber = `INV-${randomInvoiceSuffix()}`;

  const { data: invoice, error } = await supabase
    .from('customer_invoices')
    .insert({
      org_id: profile.org_id,
      invoice_number: invoiceNumber,
      customer_name: customerName,
      customer_email: input.customerEmail?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      issue_date: input.issueDate,
      due_date: input.dueDate || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !invoice) {
    logError({ feature: 'Invoices', action: 'createInvoice' }, 'invoice insert failed', error);
    throw new Error('Could not create the invoice.');
  }

  const itemRows = input.items.map((i) => ({
    org_id: profile.org_id,
    invoice_id: invoice.id as string,
    product_id: i.productId || null,
    description: i.description.trim(),
    quantity: i.quantity,
    unit_price: i.unitPrice,
    line_total: i.quantity * i.unitPrice,
  }));
  const { error: itemsError } = await supabase.from('customer_invoice_items').insert(itemRows);
  if (itemsError) throw new Error('The invoice was created, but its line items could not be saved.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'invoice.created',
    module: 'Invoices',
    entityType: 'customer_invoice',
    entityId: invoice.id as string,
    entityLabel: invoiceNumber,
    newValue: { customerName, total },
  });

  return invoice.id as string;
}

export async function updateInvoiceStatus(id: string, status: CustomerInvoiceStatus): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { data: invoice } = await supabase.from('customer_invoices').select('invoice_number').eq('id', id).maybeSingle();
  const { error } = await supabase.from('customer_invoices').update({ status }).eq('id', id);
  if (error) throw new Error('Could not update the invoice status.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'invoice.status_changed',
    module: 'Invoices',
    entityType: 'customer_invoice',
    entityId: id,
    entityLabel: invoice?.invoice_number ?? id,
    newValue: { status },
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { data: invoice } = await supabase.from('customer_invoices').select('invoice_number').eq('id', id).maybeSingle();
  const { error } = await supabase.from('customer_invoices').delete().eq('id', id);
  if (error) throw new Error('Could not delete the invoice.');

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'invoice.deleted',
    module: 'Invoices',
    entityType: 'customer_invoice',
    entityId: id,
    entityLabel: invoice?.invoice_number ?? id,
  });
}

// Cloud Storage archival needs a Google service-account key, which this
// bundle can never hold — same reason invite/resendInvite/removeMember in
// actions/team.ts go through app/api/mobile/team/* instead of talking to
// Supabase directly. These two hit the matching
// app/api/mobile/invoices/[id]/{archive-pdf,pdf-url} routes.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Best-effort: called after the existing local PDF share (Print +
// Sharing) already succeeded, never instead of it. Swallow failures at
// the call site — an unreachable API or unconfigured Cloud Storage on
// the backend should never block sharing the invoice.
export async function archiveInvoicePdf(id: string, localPdfUri: string): Promise<void> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Same fetch(localUri) -> arrayBuffer() -> raw-bytes-in-body pattern as
  // products.ts's uploadProductImage, sent straight through as the
  // request body rather than wrapped in FormData.
  const localResponse = await fetch(localPdfUri);
  const arrayBuffer = await localResponse.arrayBuffer();

  const response = await fetch(`${API_URL}/api/mobile/invoices/${id}/archive-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/pdf' },
    body: arrayBuffer,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not archive the invoice PDF.');
  }
}

// Returns null (never throws) when there's no archived copy yet or the
// request fails — this is a "bonus" retrieval path, callers should treat
// null as "nothing to show" rather than surfacing an error.
export async function getInvoicePdfArchiveUrl(id: string): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(`${API_URL}/api/mobile/invoices/${id}/pdf-url`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.url ?? null;
  } catch {
    return null;
  }
}
