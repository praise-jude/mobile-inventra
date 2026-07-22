// Direct-Supabase equivalents of Inventra/lib/actions/settings.ts's Server
// Actions. See lib/actions/products.ts's header comment for why this is a
// direct client write rather than a bearer-token API route.
import { logAudit } from '@/lib/actions/audit';
import { requireProfile } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { NotificationSettings, PaperSize, Profile } from '@/types/database';

// Settings mutations are Admin-tier only. `organizations_update`-style RLS
// already enforces this at the database layer, but checking here first
// gives a clear error instead of a silent no-op.
function requireAdminRole(profile: Profile) {
  if (!['owner', 'admin'].includes(profile.role)) {
    throw new Error('Only an owner or admin can update settings.');
  }
}

export interface GeneralSettingsInput {
  name: string;
  supportEmail: string;
  currency: string;
  country: string;
  state: string;
  timezone: string;
  taxRate: number;
}

export async function updateGeneralSettings(input: GeneralSettingsInput): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);

  const { error } = await supabase
    .from('organizations')
    .update({
      name: input.name,
      support_email: input.supportEmail || null,
      currency: input.currency,
      country: input.country || null,
      state: input.state || null,
      timezone: input.timezone,
      tax_rate: input.taxRate,
    })
    .eq('id', profile.org_id);
  if (error) throw error;

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'settings.updated',
    module: 'Settings',
    entityType: 'organization',
    entityId: profile.org_id,
    entityLabel: 'General settings',
    newValue: { name: input.name, currency: input.currency, timezone: input.timezone, taxRate: input.taxRate },
  });
}

export async function toggleNotification(field: keyof Omit<NotificationSettings, 'org_id'>, value: boolean): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);

  const patch: Partial<Omit<NotificationSettings, 'org_id'>> = { [field]: value };
  const { error } = await supabase.from('notification_settings').update(patch).eq('org_id', profile.org_id);
  if (error) throw error;

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'settings.updated',
    module: 'Settings',
    entityType: 'notification_settings',
    entityLabel: `Notification: ${field}`,
    newValue: { [field]: value },
  });
}

export interface PrintSettingsInput {
  paperSize: PaperSize;
  autoPrint: boolean;
  receiptFooter: string;
}

export async function updatePrintSettings(input: PrintSettingsInput): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);

  const { error } = await supabase
    .from('print_settings')
    .update({
      paper_size: input.paperSize,
      auto_print: input.autoPrint,
      receipt_footer: input.receiptFooter.trim() || null,
    })
    .eq('org_id', profile.org_id);
  if (error) throw error;

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'settings.updated',
    module: 'Settings',
    entityType: 'print_settings',
    entityLabel: 'Print settings',
    newValue: { paperSize: input.paperSize, autoPrint: input.autoPrint },
  });
}

export interface ApprovalSettingsInput {
  discountApprovalEnabled: boolean;
  discountThresholdPct: number;
  voidApprovalEnabled: boolean;
  voidThresholdAmount: number;
  priceChangeApprovalEnabled: boolean;
  priceChangeThresholdPct: number;
}

export async function updateApprovalSettings(input: ApprovalSettingsInput): Promise<void> {
  const profile = await requireProfile();
  requireAdminRole(profile);

  const { error } = await supabase
    .from('approval_settings')
    .update({
      discount_approval_enabled: input.discountApprovalEnabled,
      discount_threshold_pct: input.discountThresholdPct,
      void_approval_enabled: input.voidApprovalEnabled,
      void_threshold_amount: input.voidThresholdAmount,
      price_change_approval_enabled: input.priceChangeApprovalEnabled,
      price_change_threshold_pct: input.priceChangeThresholdPct,
    })
    .eq('org_id', profile.org_id);
  if (error) throw error;

  void logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: 'settings.updated',
    module: 'Settings',
    entityType: 'approval_settings',
    entityLabel: 'Approval thresholds',
    newValue: {
      discountApprovalEnabled: input.discountApprovalEnabled,
      discountThresholdPct: input.discountThresholdPct,
      voidApprovalEnabled: input.voidApprovalEnabled,
      voidThresholdAmount: input.voidThresholdAmount,
      priceChangeApprovalEnabled: input.priceChangeApprovalEnabled,
      priceChangeThresholdPct: input.priceChangeThresholdPct,
    },
  });
}
