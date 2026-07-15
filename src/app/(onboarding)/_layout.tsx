import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

export default function OnboardingLayout() {
  const { needsOnboarding, awaitingCard } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="complete" />
      </Stack.Protected>

      <Stack.Protected guard={!needsOnboarding && awaitingCard}>
        <Stack.Screen name="plan" />
      </Stack.Protected>
    </Stack>
  );
}
