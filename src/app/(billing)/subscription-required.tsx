import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BillingManagement } from '@/components/billing-management';
import { PaystackCheckoutModal, type PaystackMessage } from '@/components/paystack-checkout';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { changePlan, initiateAddCard, cancelSubscription, reactivateSubscription } from '@/lib/actions/billing';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useBillingData } from '@/lib/hooks/use-billing-data';

// Mirrors Inventra/app/subscription-required/page.tsx — reached only when
// auth-context's `blocked` is true (see src/app/_layout.tsx), so a lapsed
// org never gets past this screen into (app).
const HEADLINES: Record<string, string> = {
  expired: 'Your free trial has ended',
  cancelled: 'Your subscription was cancelled',
  past_due: "There's a problem with your payment",
  payment_failed: 'Your last payment failed',
  suspended: 'Your account is suspended',
};

export default function SubscriptionRequiredScreen() {
  const { refetchGate } = useAuth();
  const billing = useBillingData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  function refresh() {
    billing.invalidate();
    refetchGate();
  }

  function verifyAndClose() {
    setAccessCode(null);
    setVerifying(true);
    setTimeout(() => {
      refresh();
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
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  async function handleAddOrUpdateCard(planKey: 'monthly' | 'yearly' = 'monthly') {
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
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-6 dark:bg-bg-dark">
        <Text className="text-center text-[15px] text-text-2 dark:text-text-2-dark">
          Could not load your subscription. Check your connection and try again.
        </Text>
        <Button onPress={() => billing.refetch()}>Try again</Button>
        <Button variant="ghost" onPress={() => void signOut()}>
          Sign out
        </Button>
      </SafeAreaView>
    );
  }

  const { profile, subscription, invoices } = billing.data;
  const canManageBilling = profile.role === 'owner' || profile.role === 'admin';
  const headline = HEADLINES[subscription.status] ?? 'Your subscription needs attention';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <View className="items-center">
          <Image
            source={require('@/assets/images/brand-logo.png')}
            style={{ width: 52, height: 52 }}
            contentFit="contain"
          />
          <Text className="mt-4 text-center text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
            {headline}
          </Text>
          <Text className="mt-1.5 max-w-[320px] text-center text-[13.5px] text-text-2 dark:text-text-2-dark">
            {canManageBilling
              ? 'Renew your subscription below to restore full access to Royal Inventra.'
              : 'Access is restricted until an owner or admin renews the subscription.'}
          </Text>
        </View>

        {canManageBilling ? (
          <View className="mt-8">
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
        ) : (
          <View className="mt-8 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-center text-[13px] text-text-2 dark:text-text-2-dark">
              Please contact your workspace owner or admin to renew the subscription and restore access.
            </Text>
          </View>
        )}

        <Button
          variant="ghost"
          className="mt-8"
          onPress={() => {
            haptics.tap();
            void signOut();
          }}
        >
          Sign out
        </Button>
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
