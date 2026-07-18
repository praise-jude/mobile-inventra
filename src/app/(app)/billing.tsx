import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BillingManagement } from '@/components/billing-management';
import { ComingSoon } from '@/components/coming-soon';
import { ErrorState } from '@/components/error-state';
import { PaystackCheckoutModal, type PaystackMessage } from '@/components/paystack-checkout';
import { changePlan, initiateAddCard, cancelSubscription, reactivateSubscription } from '@/lib/actions/billing';
import { haptics } from '@/lib/haptics';
import { useBillingData } from '@/lib/hooks/use-billing-data';

// Mirrors Inventra/app/(app)/billing/page.tsx — the same
// BillingManagement building block used for a blocked org (see
// (billing)/subscription-required.tsx) works here too, just under
// "Billing & subscription" copy instead of a status-blocked headline.
export default function BillingScreen() {
  const billing = useBillingData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  function verifyAndClose() {
    setAccessCode(null);
    setVerifying(true);
    setTimeout(() => {
      billing.invalidate();
      setVerifying(false);
    }, 2500);
  }

  function handleWebViewMessage(payload: PaystackMessage) {
    if (payload.type === 'success') {
      verifyAndClose();
    } else if (payload.type === 'cancel') {
      setAccessCode(null);
    } else {
      setAccessCode(null);
      setError(payload.message ?? 'Card setup failed. Please try again.');
    }
  }

  async function run(key: string, action: () => Promise<void>, fallback: string) {
    haptics.tap();
    setBusy(key);
    setError(null);
    try {
      await action();
      haptics.success();
      billing.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  async function handleAddOrUpdateCard(planKey: 'monthly' | 'yearly') {
    haptics.tap();
    setBusy('card');
    setError(null);
    try {
      const { accessCode: code } = await initiateAddCard(planKey);
      setAccessCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start card setup.');
    } finally {
      setBusy(null);
    }
  }

  if (billing.isLoading || verifying) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator size="large" />
        {verifying && (
          <Text className="mt-4 text-[14px] text-text-2 dark:text-text-2-dark">Confirming your card…</Text>
        )}
      </SafeAreaView>
    );
  }

  if (billing.isError || !billing.data) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <ErrorState onRetry={() => billing.refetch()} />
      </SafeAreaView>
    );
  }

  const { profile, subscription, invoices } = billing.data;
  const canManageBilling = profile.role === 'owner' || profile.role === 'admin';

  if (!canManageBilling) {
    return (
      <ComingSoon
        icon="💳"
        title="Billing"
        description="Only a workspace owner or admin can manage billing. Ask them to make changes to your plan or payment method."
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
        <Text className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
          Billing & subscription
        </Text>
        <Text className="mt-1 text-[13.5px] text-text-2 dark:text-text-2-dark">
          Manage your plan, payment method, and billing history.
        </Text>

        <View className="mt-6">
          <BillingManagement
            subscription={subscription}
            invoices={invoices}
            busy={busy}
            error={error}
            onChoosePlan={(planKey) => run('plan', () => changePlan(planKey), 'Could not change plan.')}
            onAddOrUpdateCard={() => handleAddOrUpdateCard(subscription.plan_key === 'yearly' ? 'yearly' : 'monthly')}
            onCancel={() => run('cancel', cancelSubscription, 'Could not cancel subscription.')}
            onReactivate={() => run('reactivate', reactivateSubscription, 'Could not reactivate subscription.')}
          />
        </View>
      </ScrollView>

      <PaystackCheckoutModal
        accessCode={accessCode}
        onClose={() => setAccessCode(null)}
        onMessage={handleWebViewMessage}
        onCallbackUrlHit={verifyAndClose}
      />
    </SafeAreaView>
  );
}
