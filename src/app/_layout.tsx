// Must be imported directly here, not just transitively (via
// constants/theme.ts -> animated-icon.tsx) — on web, the sibling import
// below resolves to animated-icon.web.tsx instead, which doesn't pull in
// constants/theme.ts, so global.css never entered the web bundle graph and
// NativeWind's Tailwind compiler never ran for the web platform at all
// (every `className` was a no-op; only plain StyleSheet styles rendered).
import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { IntroSeenProvider, useIntroSeen } from '@/lib/first-launch';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <IntroSeenProvider>
        <AuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </IntroSeenProvider>
    </QueryClientProvider>
  );
}

// Gate tiers mirror the redirect logic in Inventra/lib/supabase/middleware.ts:
// first launch on this device -> (intro) (marketing carousel, ends in
// Sign In/Create Account); no session (intro already seen) -> (auth);
// session but profile/terms/country incomplete, or profile complete but no
// card on file yet (awaitingCard) -> (onboarding) (which itself picks the
// right screen, see (onboarding)/_layout.tsx); onboarded but the
// trial/subscription has lapsed (blocked) -> (billing); otherwise -> (app).
// Renders nothing while intro/session/gate state is still resolving so we
// don't flash the wrong group before redirecting.
function RootNavigator() {
  const { session, initializing, gateLoading, needsOnboarding, awaitingCard, blocked } = useAuth();
  const { seen: introSeen } = useIntroSeen();

  if (introSeen === null || initializing) return null;
  const authed = !!session;
  if (authed && gateLoading) return null;

  const needsOnboardingFlow = needsOnboarding || awaitingCard;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!authed && !introSeen}>
        <Stack.Screen name="(intro)" />
      </Stack.Protected>

      <Stack.Protected guard={!authed && introSeen}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && needsOnboardingFlow}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsOnboardingFlow && blocked}>
        <Stack.Screen name="(billing)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsOnboardingFlow && !blocked}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
