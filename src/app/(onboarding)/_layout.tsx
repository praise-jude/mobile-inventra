import { Stack } from 'expo-router';

// Phase F retired the mandatory card/trial step (src/lib/auth-context.tsx
// no longer has awaitingCard) — RootNavigator only ever enters this group
// for needsOnboarding (terms/country incomplete), so there's just one
// screen left. `plan.tsx` is no longer routed to from here; it's dead
// until Phase F7 decides whether the "Upgrade to Premium" flow reuses it.
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="complete" />
    </Stack>
  );
}
