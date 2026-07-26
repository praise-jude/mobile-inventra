import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

// Lands here for royalinventra://callback (a route *group* strips `(auth)`
// from the URL path — see plan notes) after the user taps a Supabase email
// link (signup confirmation today; magic link/password recovery would also
// land here if those are ever added on mobile, since exchangeCodeForSession
// is flow-agnostic). On success this renders nothing further: the same
// AuthProvider.onAuthStateChange listener every other sign-in already goes
// through (src/lib/auth-context.tsx) picks up the new session, `(auth)`'s
// `!authed` guard in src/app/_layout.tsx goes false, and Stack.Protected
// swaps in onboarding/pending-approval/billing/app automatically — same
// "root gate takes over" mechanism signup.tsx's hasSession branch relies on.
const MISSING_CODE_ERROR = 'This link is missing some information. Please request a new one and try again.';

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  // Lazy initializer, not a useEffect + setState — `code` is already known
  // synchronously from the route params on first render, so there's
  // nothing to "synchronize" here (see the same pattern/reasoning already
  // used in Inventra/components/auth/SignupForm.tsx's referral code field).
  const [error, setError] = useState<string | null>(() => (code ? null : MISSING_CODE_ERROR));
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !code) return;
    ran.current = true;

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError(
          exchangeError.message.toLowerCase().includes('expired') || exchangeError.message.toLowerCase().includes('invalid')
            ? 'This link has expired or has already been used. Please sign in, or request a new verification email.'
            : "We couldn't confirm your email. Check your connection and try the link again.",
        );
      }
      // Success: nothing else to do here — session change drives the redirect.
    });
  }, [code]);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-red-weak dark:bg-red-weak-dark">
            <Text className="text-[22px]">⚠️</Text>
          </View>
          <View>
            <Text className="text-center text-[17px] font-bold text-text dark:text-text-dark">Verification failed</Text>
            <Text className="mt-1.5 max-w-[320px] text-center text-[13px] text-text-2 dark:text-text-2-dark">{error}</Text>
          </View>
          <Link href="/(auth)/login" className="text-[13.5px] font-semibold text-accent-text dark:text-accent-text-dark">
            ← Back to sign in
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
      <ActivityIndicator />
      <Text className="mt-3 text-[13.5px] text-text-2 dark:text-text-2-dark">Confirming your email…</Text>
    </SafeAreaView>
  );
}
