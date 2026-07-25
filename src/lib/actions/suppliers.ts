// Direct-Supabase equivalent of Inventra/lib/actions/suppliers.ts.
// suppliers_insert/update/delete RLS already restricts writes to
// owner/admin/manager — this check exists for a clear error message
// instead of a silent RLS-denied no-op.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

async function requireManagerProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Only an owner, admin, or manager can manage suppliers.');
  }
  return profile;
}

export interface SupplierInput {
  name: string;
  company?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

function normalize(input: SupplierInput) {
  return {
    name: input.name.trim(),
    company: input.company?.trim() || null,
    contact_person: input.contactPerson?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
  };
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  const profile = await requireManagerProfile();
  const values = normalize(input);
  if (!values.name) throw new Error('Supplier name is required.');

  const { error } = await supabase.from('suppliers').insert({ org_id: profile.org_id, ...values });
  if (error) throw new Error('Could not create the supplier.');
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<void> {
  await requireManagerProfile();
  const values = normalize(input);
  if (!values.name) throw new Error('Supplier name is required.');

  const { error } = await supabase.from('suppliers').update(values).eq('id', id);
  if (error) throw new Error('Could not update the supplier.');
}

export async function deleteSupplier(id: string): Promise<void> {
  await requireManagerProfile();

  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('supplier_id', id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? '' : 's'} still use this supplier — reassign them first.`);
  }

  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error('Could not delete the supplier.');
}
