import { supabase } from '@/lib/supabase';
import type { OrgEntitlementsRpc } from '@/types/database';

// Centralized Free/Premium plan-tier permission service — mirrors
// Inventra/lib/entitlements.ts exactly (same shape, same named checks).
// Separate from src/lib/roles.ts's ADMIN_ROLES/MANAGER_ROLES (role-tier)
// and src/lib/permissions.ts's requirePermission (also role-tier, backed
// by has_permission()) — plan-tier and role-tier checks compose, they
// never merge. Keep both repos' copies in sync if this list changes.

export type PlanTier = 'free' | 'premium';

export interface Entitlements {
  orgId: string | null;
  tier: PlanTier;
  planKey: string | null;
  status: string | null;
  productCount: number;
  productLimit: number;
  salesCount: number;
  salesLimit: number;
  expenseCount: number;
  expenseLimit: number;
  invoiceCount: number;
  invoiceLimit: number;
}

const FAIL_SAFE_FREE: Entitlements = {
  orgId: null,
  tier: 'free',
  planKey: null,
  status: null,
  productCount: 0,
  productLimit: 20,
  salesCount: 0,
  salesLimit: 300,
  expenseCount: 0,
  expenseLimit: 10,
  invoiceCount: 0,
  invoiceLimit: 10,
};

// No React cache()/request-scoping on mobile (there's no "request" the way
// there is for a Next.js Server Component) — src/lib/hooks/use-entitlements.ts
// is where the actual caching lives (React Query), for UI reads. This plain
// async function is for one-shot checks inside src/lib/actions/*.ts.
export async function getEntitlements(): Promise<Entitlements> {
  let { data, error } = await supabase.rpc('get_org_entitlements');
  if (error || !data) {
    // A single failed call (dropped connection, brief token-refresh race)
    // used to silently fail the caller to free-tier limits with no
    // retry and no visibility — that's the right safe default for a
    // genuine failure, but too eager for a transient one. One retry
    // after a short delay before accepting the fail-safe.
    console.error('[Royal Inventra] get_org_entitlements failed, retrying once:', error);
    await new Promise((resolve) => setTimeout(resolve, 800));
    ({ data, error } = await supabase.rpc('get_org_entitlements'));
    if (error || !data) {
      console.error('[Royal Inventra] get_org_entitlements failed twice, falling back to free tier:', error);
      return FAIL_SAFE_FREE;
    }
  }

  const d = data as OrgEntitlementsRpc;
  return {
    orgId: d.org_id ?? null,
    tier: d.tier === 'premium' ? 'premium' : 'free',
    planKey: d.plan_key ?? null,
    status: d.status ?? null,
    productCount: Number(d.product_count ?? 0),
    productLimit: Number(d.product_limit ?? FAIL_SAFE_FREE.productLimit),
    salesCount: Number(d.sales_count ?? 0),
    salesLimit: Number(d.sales_limit ?? FAIL_SAFE_FREE.salesLimit),
    expenseCount: Number(d.expense_count ?? 0),
    expenseLimit: Number(d.expense_limit ?? FAIL_SAFE_FREE.expenseLimit),
    invoiceCount: Number(d.invoice_count ?? 0),
    invoiceLimit: Number(d.invoice_limit ?? FAIL_SAFE_FREE.invoiceLimit),
  };
}

// Boolean-locked features (not count-based) — Premium unlocks all of them,
// Free unlocks none. Matches Inventra/lib/entitlements.ts's PREMIUM_FEATURES.
// Exported for F7's lock/badge UI to enumerate.
export const PREMIUM_FEATURES = [
  'receiptPrinting',
  'inventoryEdit',
  'inventoryDelete',
  'barcodeGeneration',
  'productTransfer',
  'teamManagement',
  'staffRoles',
  'branchManagement',
  'reports',
  'exportReports',
  'aiAssistant',
  'businessAnalytics',
  'integrations',
  'apiAccess',
  'webhooks',
  'auditLog',
  'advancedSettings',
  'multiLocationInventory',
  'approvalWorkflows',
  'bulkImportExport',
  'salesEdit',
  'salesVoid',
  'customerManagement',
  'stockMovementHistory',
  'expenseAnalytics',
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export async function canUseFeature(feature: PremiumFeature): Promise<boolean> {
  void feature; // every locked feature has the same rule today: Premium-only
  const e = await getEntitlements();
  return e.tier === 'premium';
}

// Count-limited creates — RLS (Inventra's freemium_premium_plans
// migration) is the real enforcement; these exist so the action can show
// a friendly "Upgrade to Premium" message instead of surfacing a raw
// Postgres RLS error to the user.
export async function canAddProduct(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === 'premium' || e.productCount < e.productLimit;
}
export async function canCreateSale(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === 'premium' || e.salesCount < e.salesLimit;
}
export async function canAddExpense(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === 'premium' || e.expenseCount < e.expenseLimit;
}
export async function canAddInvoice(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === 'premium' || e.invoiceCount < e.invoiceLimit;
}

// Named per-feature checks — thin wrappers over canUseFeature().
export const canEditProduct = () => canUseFeature('inventoryEdit');
export const canDeleteProduct = () => canUseFeature('inventoryDelete');
export const canPrintReceipt = () => canUseFeature('receiptPrinting');
export const canGenerateBarcode = () => canUseFeature('barcodeGeneration');
export const canTransferProduct = () => canUseFeature('productTransfer');
export const canExportReports = () => canUseFeature('exportReports');
export const canViewReports = () => canUseFeature('reports');
export const canUseAI = () => canUseFeature('aiAssistant');
export const canManageTeam = () => canUseFeature('teamManagement');
export const canManageStaffRoles = () => canUseFeature('staffRoles');
export const canManageBranches = () => canUseFeature('branchManagement');
export const canViewBusinessAnalytics = () => canUseFeature('businessAnalytics');
export const canManageIntegrations = () => canUseFeature('integrations');
export const canUseApi = () => canUseFeature('apiAccess');
export const canManageWebhooks = () => canUseFeature('webhooks');
export const canViewAuditLog = () => canUseFeature('auditLog');
export const canUseAdvancedSettings = () => canUseFeature('advancedSettings');
export const canUseMultiLocationInventory = () => canUseFeature('multiLocationInventory');
export const canUseApprovalWorkflows = () => canUseFeature('approvalWorkflows');
export const canBulkImportExport = () => canUseFeature('bulkImportExport');
export const canEditSale = () => canUseFeature('salesEdit');
export const canVoidSale = () => canUseFeature('salesVoid');
export const canManageCustomers = () => canUseFeature('customerManagement');
export const canViewStockMovements = () => canUseFeature('stockMovementHistory');
export const canViewExpenseAnalytics = () => canUseFeature('expenseAnalytics');

// Thrown from actions when a can*() check fails, so screens can
// distinguish "needs upgrade" from any other error and show the Upgrade
// modal instead of a generic error toast.
export class UpgradeRequiredError extends Error {
  constructor(message = 'This feature requires a Premium subscription.') {
    super(message);
    this.name = 'UpgradeRequiredError';
  }
}
