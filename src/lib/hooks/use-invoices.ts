import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { CustomerInvoiceStatus } from '@/types/database';

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: CustomerInvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  total: number;
}

export interface InvoicesOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  invoiceCount: number;
  invoices: InvoiceRow[];
}

const OUTSTANDING_STATUSES: CustomerInvoiceStatus[] = ['sent', 'overdue'];

// Mirrors Inventra/lib/queries/invoices.ts's getInvoicesOverview.
export function useInvoicesOverview() {
  return useQuery({
    queryKey: ['invoices-overview'],
    queryFn: async (): Promise<InvoicesOverview> => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, customer_name, status, issue_date, due_date, total')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Could not load invoices.');

      const rows = data ?? [];
      const totalOutstanding = rows
        .filter((r) => OUTSTANDING_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + Number(r.total), 0);
      const totalPaid = rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + Number(r.total), 0);
      const overdueCount = rows.filter((r) => r.status === 'overdue').length;

      return {
        totalOutstanding,
        totalPaid,
        overdueCount,
        invoiceCount: rows.length,
        invoices: rows.map((r) => ({
          id: r.id,
          invoiceNumber: r.invoice_number,
          customerName: r.customer_name,
          status: r.status,
          issueDate: r.issue_date,
          dueDate: r.due_date,
          total: Number(r.total),
        })),
      };
    },
  });
}

export interface InvoiceItemRow {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetail extends InvoiceRow {
  customerEmail: string | null;
  customerPhone: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  notes: string | null;
  items: InvoiceItemRow[];
}

// Mirrors Inventra/lib/queries/invoices.ts's getInvoiceDetail.
export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: async (): Promise<InvoiceDetail> => {
      const { data: invoice, error } = await supabase
        .from('customer_invoices')
        .select(
          'id, invoice_number, customer_name, customer_email, customer_phone, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total, notes',
        )
        .eq('id', id!)
        .single();
      if (error || !invoice) throw new Error('Could not load this invoice.');

      const { data: items, error: itemsError } = await supabase
        .from('customer_invoice_items')
        .select('id, product_id, description, quantity, unit_price, line_total')
        .eq('invoice_id', id!)
        .order('id');
      if (itemsError) throw new Error("Could not load this invoice's line items.");

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerPhone: invoice.customer_phone,
        status: invoice.status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        discountAmount: Number(invoice.discount_amount),
        taxAmount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        notes: invoice.notes,
        items: (items ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
          lineTotal: Number(i.line_total),
        })),
      };
    },
    enabled: !!id,
  });
}
