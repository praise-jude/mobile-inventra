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

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppErrorBoundary } from '@/components/error-boundary';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { IntroSeenProvider, useIntroSeen } from '@/lib/first-launch';
import { ThemePreferenceProvider } from '@/lib/theme-preference-context';
import { UpgradeModalProvider } from '@/lib/upgrade-modal-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AppErrorBoundary>
      <ThemePreferenceProvider>
        <QueryClientProvider client={queryClient}>
          <IntroSeenProvider>
            <AuthProvider>
              <UpgradeModalProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <AnimatedSplashOverlay />
                  <RootNavigator />
                </ThemeProvider>
              </UpgradeModalProvider>
            </AuthProvider>
          </IntroSeenProvider>
        </QueryClientProvider>
      </ThemePreferenceProvider>
    </AppErrorBoundary>
  );
}

// Gate tiers mirror the redirect logic in Inventra/lib/supabase/middleware.ts
// (+ app/pending-approval/page.tsx for the approval tier): first launch on
// this device -> (intro) (marketing carousel, ends in Sign In/Create
// Account); no session (intro already seen) -> (auth); session but a second
// factor is still required (needsMfaStepUp) -> (mfa-challenge) — checked
// before every other authed gate, same top priority middleware.ts gives it
// server-side, since password auth alone already sets a valid session and
// nothing else here should be reachable until that's resolved; session but
// profile/terms/country incomplete -> (onboarding); onboarded but a
// Manager-invited member not yet approved -> (pending-approval); otherwise
// -> (app). Phase F retired the old subscription/billing hard-block tier
// here — every org has full app access on the Free plan the moment
// onboarding is complete; a lapsed Premium subscription falls back to Free
// limits inside (app), it no longer locks anyone out at the navigator
// level (see src/lib/auth-context.tsx). (billing) still exists as a
// manually-reachable screen (Settings > Subscription), just not a forced
// destination. Renders nothing while intro/session/gate state is still
// resolving so we don't flash the wrong group before redirecting.
function RootNavigator() {
  const { session, initializing, gateLoading, aalLoading, needsMfaStepUp, needsOnboarding, awaitingApproval } = useAuth();
  const { seen: introSeen } = useIntroSeen();

  if (introSeen === null || initializing) return null;
  const authed = !!session;
  if (authed && (gateLoading || aalLoading)) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!authed && !introSeen}>
        <Stack.Screen name="(intro)" />
      </Stack.Protected>

      <Stack.Protected guard={!authed && introSeen}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && needsMfaStepUp}>
        <Stack.Screen name="(mfa-challenge)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsMfaStepUp && needsOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsMfaStepUp && !needsOnboarding && awaitingApproval}>
        <Stack.Screen name="(pending-approval)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && !needsMfaStepUp && !needsOnboarding && !awaitingApproval}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
