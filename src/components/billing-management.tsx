import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/lib/format';
import { PLANS } from '@/lib/billing-plans';
import type { Subscription, Invoice } from '@/types/database';

const INVOICE_BADGE_CLASS: Record<string, string> = {
  paid: 'bg-green-weak dark:bg-green-weak-dark',
  pending: 'bg-amber-weak dark:bg-amber-weak-dark',
  failed: 'bg-red-weak dark:bg-red-weak-dark',
};
const INVOICE_TEXT_CLASS: Record<string, string> = {
  paid: 'text-green dark:text-green-dark',
  pending: 'text-amber dark:text-amber-dark',
  failed: 'text-red dark:text-red-dark',
};

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

// Mirrors Inventra/components/billing/BillingClient.tsx's plan
// card/payment-method/plan-picker/invoice-history sections — shared by
// (billing)/subscription-required.tsx (blocked orgs) and (app)/billing.tsx
// (active self-service tab) so the full cancel/reactivate/change-plan
// status matrix only lives in one place.
export function BillingManagement({
  subscription,
  invoices,
  busy,
  error,
  onChoosePlan,
  onAddOrUpdateCard,
  onCancel,
  onReactivate,
}: {
  subscription: Subscription;
  invoices: Invoice[];
  busy: string | null;
  error: string | null;
  onChoosePlan: (planKey: 'monthly' | 'yearly') => void;
  onAddOrUpdateCard: () => void;
  onCancel: () => void;
  onReactivate: () => void;
}) {
  const plan = PLANS.find((p) => p.key === subscription.plan_key) ?? PLANS.find((p) => p.key === 'monthly')!;
  const isTrialing = subscription.status === 'trialing';
  const isCancellable =
    ['trialing', 'active', 'past_due'].includes(subscription.status) && !subscription.cancel_at_period_end;
  const isReactivatable =
    ['cancelled', 'expired', 'suspended', 'past_due'].includes(subscription.status) ||
    subscription.cancel_at_period_end;

  return (
    <View>
      <LinearGradient
        colors={['#2563eb', '#6366f1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.planCard}
      >
        <Text className="text-[12px] font-bold uppercase tracking-wide text-white/85">{plan.name} plan</Text>
        <Text className="mt-1 text-[24px] font-bold text-white">
          {formatMoney(plan.price, 'NGN')}
          {plan.interval && (
            <Text className="text-[14px] font-semibold text-white/85">
              /{plan.interval === 'monthly' ? 'mo' : 'yr'}
            </Text>
          )}
        </Text>
        <Text className="mt-1 text-[12.5px] text-white/90">
          {isTrialing && subscription.trial_ends_at
            ? `Trial ends in ${daysUntil(subscription.trial_ends_at)} day(s)`
            : subscription.current_period_end
              ? `Next billing date: ${new Date(subscription.current_period_end).toLocaleDateString()}`
              : 'No active billing period'}
          {subscription.cancel_at_period_end ? ' · Cancels at period end' : ''}
        </Text>

        {(isCancellable || isReactivatable) && (
          <View className="mt-4 flex-row gap-2.5">
            {isCancellable && (
              <Pressable
                onPress={onCancel}
                disabled={busy !== null}
                className="h-11 flex-1 items-center justify-center rounded-[9px] bg-white/15"
              >
                <Text className="text-[12.5px] font-semibold text-white">
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
                </Text>
              </Pressable>
            )}
            {isReactivatable && (
              <Pressable
                onPress={onReactivate}
                disabled={busy !== null}
                className="h-11 flex-1 items-center justify-center rounded-[9px] bg-white"
              >
                <Text className="text-[12.5px] font-bold text-accent-2">
                  {subscription.status === 'past_due'
                    ? busy === 'reactivate'
                      ? 'Retrying…'
                      : 'Retry payment'
                    : busy === 'reactivate'
                      ? 'Reactivating…'
                      : 'Reactivate'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </LinearGradient>

      {error && <Text className="mt-4 text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

      <View className="mt-5">
        <Text className="mb-2.5 text-[13px] font-bold text-text-2 dark:text-text-2-dark">Payment method</Text>
        <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <View className="h-9 w-9 items-center justify-center rounded-[9px] bg-accent-weak dark:bg-accent-weak-dark">
            <Text className="text-[16px]">💳</Text>
          </View>
          <View className="flex-1">
            {subscription.card_brand && subscription.card_last4 ? (
              <>
                <Text className="text-[13px] font-semibold capitalize text-text dark:text-text-dark">
                  {subscription.card_brand} •••• {subscription.card_last4}
                </Text>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <Text className="text-[11.5px] text-muted dark:text-muted-dark">
                    Expires {subscription.card_exp_month}/{subscription.card_exp_year}
                  </Text>
                )}
              </>
            ) : (
              <Text className="text-[13px] font-semibold text-text dark:text-text-dark">No card on file</Text>
            )}
          </View>
          <Pressable onPress={onAddOrUpdateCard} disabled={busy === 'card'} hitSlop={10}>
            <Text className="text-[12.5px] font-semibold text-accent-text dark:text-accent-text-dark">
              {subscription.card_brand ? 'Update' : 'Add card'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-6">
        <Text className="mb-2.5 text-[13px] font-bold text-text-2 dark:text-text-2-dark">Choose a plan</Text>
        <View className="gap-3">
          {PLANS.filter((p) => p.selectable).map((p) => {
            const active = subscription.plan_key === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => onChoosePlan(p.key as 'monthly' | 'yearly')}
                className={`rounded-2xl border p-4 ${
                  active
                    ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-[14px] font-bold text-text dark:text-text-dark">{p.name}</Text>
                  {p.badge && (
                    <Text className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                      {p.badge}
                    </Text>
                  )}
                </View>
                <Text className="mt-1 text-[18px] font-bold text-text dark:text-text-dark">
                  {formatMoney(p.price, 'NGN')}
                  <Text className="text-[12px] font-semibold text-text-2 dark:text-text-2-dark">
                    /{p.interval === 'monthly' ? 'mo' : 'yr'}
                  </Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {invoices.length > 0 && (
        <View className="mt-6">
          <Text className="mb-2.5 text-[13px] font-bold text-text-2 dark:text-text-2-dark">Billing history</Text>
          <View className="overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
            {invoices.map((inv, i) => (
              <View
                key={inv.id}
                className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border-2 dark:border-border-2-dark' : ''}`}
              >
                <View className="flex-1">
                  <Text className="font-mono text-[12.5px] font-semibold text-text dark:text-text-dark">
                    {inv.invoice_number}
                  </Text>
                  <Text className="text-[11px] text-muted dark:text-muted-dark">
                    {new Date(inv.issued_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text className="font-mono text-[12.5px] font-bold text-text dark:text-text-dark">
                  {formatMoney(inv.amount, 'NGN')}
                </Text>
                <Text
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize ${INVOICE_BADGE_CLASS[inv.status] ?? INVOICE_BADGE_CLASS.pending} ${INVOICE_TEXT_CLASS[inv.status] ?? INVOICE_TEXT_CLASS.pending}`}
                >
                  {inv.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Plain StyleSheet rather than className — expo-linear-gradient's
  // LinearGradient isn't registered with NativeWind's cssInterop in this
  // project, so className wouldn't reliably apply on native.
  planCard: {
    borderRadius: 16,
    padding: 20,
  },
});
