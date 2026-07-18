import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaystackCheckoutModal, type PaystackMessage } from '@/components/paystack-checkout';
import { Button } from '@/components/ui/button';
import { initiateAddCard } from '@/lib/actions/billing';
import { useAuth } from '@/lib/auth-context';
import { PLANS, planByKey } from '@/lib/billing-plans';

function naira(n: number): string {
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OnboardingPlanScreen() {
  const [step, setStep] = useState<'plan' | 'card'>('plan');
  const [planKey, setPlanKey] = useState<'monthly' | 'yearly'>('monthly');

  return step === 'plan' ? (
    <PlanSelectStep selected={planKey} onSelect={setPlanKey} onContinue={() => setStep('card')} />
  ) : (
    <AddCardStep planKey={planKey} onBack={() => setStep('plan')} />
  );
}

function PlanSelectStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: 'monthly' | 'yearly';
  onSelect: (key: 'monthly' | 'yearly') => void;
  onContinue: () => void;
}) {
  const selectablePlans = PLANS.filter((p) => p.selectable);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-[22px] font-bold text-text dark:text-text-dark">Choose your plan</Text>
        <Text className="mb-4 text-[14px] text-text-2 dark:text-text-2-dark">
          Your 6-day free trial starts right after you add a card — you won&apos;t be charged until it ends.
        </Text>

        <View className="gap-3">
          {selectablePlans.map((plan) => {
            const active = selected === plan.key;
            return (
              <Pressable
                key={plan.key}
                onPress={() => onSelect(plan.key as 'monthly' | 'yearly')}
                className={`rounded-2xl border p-4 ${
                  active
                    ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-[15px] font-bold text-text dark:text-text-dark">{plan.name}</Text>
                  {plan.badge && (
                    <Text className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">
                      {plan.badge}
                    </Text>
                  )}
                </View>
                <Text className="mt-1 text-[20px] font-bold text-text dark:text-text-dark">
                  {naira(plan.price)}
                  <Text className="text-[13px] font-semibold text-text-2 dark:text-text-2-dark">
                    /{plan.interval === 'monthly' ? 'mo' : 'yr'}
                  </Text>
                </Text>
                <Text className="mt-1 text-[12.5px] text-text-2 dark:text-text-2-dark">{plan.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button onPress={onContinue} className="mt-6">
          Continue to secure payment
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function AddCardStep({ planKey, onBack }: { planKey: 'monthly' | 'yearly'; onBack: () => void }) {
  const plan = planByKey(planKey)!;
  const { refetchGate } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const { accessCode: code } = await initiateAddCard(planKey);
      setAccessCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start card setup. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // The webhook (Paystack's real source of truth for subscription state)
  // lands asynchronously — give it a moment before re-checking the gate,
  // mirroring Inventra's web CallbackRedirect.
  function verifyAndClose() {
    setAccessCode(null);
    setVerifying(true);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['access-gate'] });
      refetchGate();
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

  if (verifying) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-[14px] text-text-2 dark:text-text-2-dark">Confirming your card…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 px-6 py-10">
        <Text className="mb-1.5 text-[22px] font-bold text-text dark:text-text-dark">Add a card</Text>
        <Text className="mb-4 text-[14px] text-text-2 dark:text-text-2-dark">
          We verify your card with a small, fully refunded charge — your card is tokenized by Paystack and never
          touches our servers.
        </Text>

        <View className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[15px] font-bold text-text dark:text-text-dark">{plan.name}</Text>
          <Text className="mt-1 text-[20px] font-bold text-text dark:text-text-dark">
            {naira(plan.price)}
            <Text className="text-[13px] font-semibold text-text-2 dark:text-text-2-dark">
              /{plan.interval === 'monthly' ? 'mo' : 'yr'}
            </Text>
          </Text>
        </View>

        {error && <Text className="mt-4 text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}

        <View className="mt-6 flex-row gap-3">
          <Button variant="secondary" onPress={onBack} className="flex-1">
            Back
          </Button>
          <Button loading={loading} onPress={handleContinue} className="flex-1">
            Add card &amp; start trial
          </Button>
        </View>
      </View>

      <PaystackCheckoutModal
        accessCode={accessCode}
        onClose={() => setAccessCode(null)}
        onMessage={handleWebViewMessage}
        onCallbackUrlHit={verifyAndClose}
      />
    </SafeAreaView>
  );
}
