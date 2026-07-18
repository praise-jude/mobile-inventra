import { z } from 'zod';

function numericString(message: string, opts: { integer?: boolean } = {}) {
  return z.string().refine((v) => {
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return false;
    return opts.integer ? Number.isInteger(n) : true;
  }, message);
}

// Shared by (app)/inventory/new.tsx and [id].tsx's edit form — same field
// set as Inventra/components/products/ProductFormFields.tsx. Numeric fields
// stay strings here (react-hook-form/TextField both work in strings) and
// are only parsed to numbers at submit time — avoids the generic mismatch
// z.coerce.number() causes between a zodResolver's input/output types.
export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'),
  description: z.string().optional(),
  sku: z.string().trim().min(1, 'SKU is required.'),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().trim().min(1, 'Unit is required.'),
  brand: z.string().optional(),
  costPrice: numericString('Cost price must be 0 or more.'),
  sellPrice: numericString('Sell price must be 0 or more.'),
  reorderLevel: numericString('Reorder level must be 0 or more.', { integer: true }),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  openingQty: numericString('Opening quantity must be 0 or more.', { integer: true }),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
