// Direct-Supabase equivalent of Inventra/lib/actions/invoices.ts. Create is
// open to any org member (matches Sales); status changes and delete require
// manager-tier+ (matches Debtors' pattern) — customer_invoices_update/delete
// RLS already enforces this, this just gives a clear error instead of a
// silent RLS-denied no-op.
import { canAddInvoice, UpgradeRequiredError } from '@/lib/entitlements';
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
  if (error || !invoice) throw new Error('Could not create the invoice.');

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

  return invoice.id as string;
}

export async function updateInvoiceStatus(id: string, status: CustomerInvoiceStatus): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { error } = await supabase.from('customer_invoices').update({ status }).eq('id', id);
  if (error) throw new Error('Could not update the invoice status.');
}

export async function deleteInvoice(id: string): Promise<void> {
  const profile = await requireProfile();
  requireManagerRole(profile.role);

  const { error } = await supabase.from('customer_invoices').delete().eq('id', id);
  if (error) throw new Error('Could not delete the invoice.');
}
