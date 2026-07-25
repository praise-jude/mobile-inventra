// Direct-Supabase equivalent of Inventra/lib/actions/categories.ts.
// categories_insert/update/delete RLS already restricts writes to
// owner/admin/manager — this check exists for a clear error message
// instead of a silent RLS-denied no-op.
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';

async function requireManagerProfile() {
  const profile = await requireProfile();
  if (!['owner', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Only an owner, admin, or manager can manage categories.');
  }
  return profile;
}

export interface CategoryInput {
  name: string;
  emoji?: string;
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const profile = await requireManagerProfile();
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required.');

  const { error } = await supabase.from('categories').insert({ org_id: profile.org_id, name, emoji: input.emoji?.trim() || null });
  if (error) {
    if (error.code === '23505') throw new Error('A category with this name already exists.');
    throw new Error('Could not create the category.');
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  await requireManagerProfile();
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required.');

  const { error } = await supabase.from('categories').update({ name, emoji: input.emoji?.trim() || null }).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('A category with this name already exists.');
    throw new Error('Could not update the category.');
  }
}

export async function deleteCategory(id: string): Promise<void> {
  await requireManagerProfile();

  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? '' : 's'} still use this category — reassign them first.`);
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error('Could not delete the category.');
}
