import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Gate tiers mirror the redirect logic in Inventra/lib/supabase/middleware.ts
// (minus the "blocked" tier for returning users with a lapsed subscription —
// that's a separate follow-up, not needed to unblock first-time onboarding):
// no session -> (auth); session but profile/terms/country incomplete, or
// profile complete but no card on file yet (awaitingCard) -> (onboarding)
// (which itself picks the right screen, see (onboarding)/_layout.tsx);
// otherwise -> (app). Renders nothing while session/gate state is still
// resolving so we don't flash the wrong group before redirecting.
function RootNavigator() {
  const { session, initializing, gateLoading, needsOnboarding, awaitingCard } = useAuth();

  if (initializing) return null;
  const authed = !!session;
  if (authed && gateLoading) return null;

  const needsOnboardingFlow = needsOnboarding || awaitingCard;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && needsOnboardingFlow}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsOnboardingFlow}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
