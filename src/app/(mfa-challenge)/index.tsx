import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { signOut } from '@/lib/actions/auth';
import { disableMfaWithPassword } from '@/lib/actions/mfa';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';

// The root-level enforcement point for needsMfaStepUp (see _layout.tsx and
// auth-context.tsx's comment) — password auth alone sets a valid AAL1
// session, and Stack.Protected re-routes here regardless of how that
// session was created (password, or a future OAuth flow), so this is the
// single place a second factor is actually required, not just an inline
// step in the login form (which a root-navigator race would otherwise
// bypass entirely — this screen is what closes that gap).
export default function MfaChallengeScreen() {
  const { refetchAal } = useAuth();
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (useRecoveryCode) {
        // Supabase's AAL system only ever elevates to aal2 via a real
        // challenge/verify against an enrolled TOTP/phone factor — there is
        // no way to grant an aal2 session from a recovery code alone. So a
        // recovery code can't just "prove the second factor" for this one
        // login; the only thing that actually gets the user back in is
        // removing the step-up requirement entirely, i.e. disabling MFA
        // (which requires password + code together). They can re-enroll a
        // new authenticator from Settings once they're back in.
        await disableMfaWithPassword({ password, code: code.trim() });
        // The factor was deleted server-side via the Admin API, entirely
        // outside this client's own session — the session's JWT still
        // embeds the old aal2-required claim until refreshed, so
        // refetchAal() below would just re-read the same stale claim.
        await supabase.auth.refreshSession();
      } else {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const totpFactor = factors?.totp?.[0];
        if (!totpFactor) throw new Error('No authenticator found on this account.');

        const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (challenge.error) throw challenge.error;
        const verify = await supabase.auth.mfa.verify({
          factorId: totpFactor.id,
          challengeId: challenge.data.id,
          code: code.trim(),
        });
        if (verify.error) throw verify.error;
      }
      haptics.success();
      refetchAal();
      // Root navigator re-evaluates needsMfaStepUp once the aal query
      // resolves and routes to (app) (or whatever gate is next).
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Invalid authentication code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-2xl font-bold text-text dark:text-text-dark">Enter authentication code</Text>
        <Text className="mb-6 text-[14px] text-text-2 dark:text-text-2-dark">
          {useRecoveryCode
            ? 'Enter one of your recovery codes and your password. This will turn off two-factor authentication for your account — you can re-enable it anytime from Settings.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </Text>

        <View className="gap-3.5">
          {useRecoveryCode && (
            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
            />
          )}
          <TextField
            value={code}
            onChangeText={(v) => setCode(v.trim())}
            placeholder={useRecoveryCode ? 'HDT4-9XPA' : '123456'}
            keyboardType={useRecoveryCode ? 'default' : 'number-pad'}
            autoCapitalize="characters"
            autoFocus
          />
          {error && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{error}</Text>}
          <Button loading={busy} onPress={handleSubmit}>
            Verify
          </Button>
        </View>

        <Pressable
          className="mt-6"
          onPress={() => {
            setError(null);
            setCode('');
            setPassword('');
            setUseRecoveryCode((v) => !v);
          }}
        >
          <Text className="text-center text-[13.5px] font-semibold text-accent-text dark:text-accent-text-dark">
            {useRecoveryCode ? 'Use authenticator app instead' : "Lost your authenticator? Use a recovery code"}
          </Text>
        </Pressable>

        <Pressable
          className="mt-3"
          onPress={() => {
            haptics.tap();
            void signOut();
          }}
        >
          <Text className="text-center text-[13.5px] font-semibold text-text-2 dark:text-text-2-dark">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
