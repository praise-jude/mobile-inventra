import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  cancelEnroll,
  confirmEnroll,
  disableMfaWithPassword,
  generateAndStoreRecoveryCodes,
  getMfaStatus,
  getRecoveryCodeCount,
  startEnroll,
} from '@/lib/actions/mfa';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';

type ScreenView = 'loading' | 'status' | 'enroll-qr' | 'enroll-verify' | 'recovery-codes' | 'disable';

// Mirrors Inventra/components/account/SecurityClient.tsx's view-state
// machine. Deliberately NOT under an admin/manager gate — MFA secures an
// individual's own login, every role needs to reach it (see settings/
// index.tsx, where this row is unconditional, unlike Team/General/etc).
export default function SecurityScreen() {
  const { session } = useAuth();
  const [view, setView] = useState<ScreenView>('loading');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [recoveryCodeCount, setRecoveryCodeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [factorId, setFactorId] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    (async () => {
      const status = await getMfaStatus().catch(() => ({ enabled: false, factorId: null }));
      const count = status.enabled ? await getRecoveryCodeCount().catch(() => 0) : 0;
      setMfaEnabled(status.enabled);
      setRecoveryCodeCount(count);
      setView('status');
    })();
  }, []);

  async function handleStartEnroll() {
    setError(null);
    setBusy(true);
    try {
      const result = await startEnroll(session!.user.email!);
      setFactorId(result.factorId);
      setOtpauthUrl(result.otpauthUrl);
      setManualSecret(result.secret);
      setView('enroll-qr');
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not start setup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEnroll() {
    if (factorId) await cancelEnroll(factorId);
    setFactorId('');
    setOtpauthUrl('');
    setManualSecret('');
    setVerifyCode('');
    setError(null);
    setView('status');
  }

  async function handleConfirmEnroll() {
    setError(null);
    setBusy(true);
    try {
      await confirmEnroll(factorId, verifyCode.trim());
      const codes = await generateAndStoreRecoveryCodes();
      setRecoveryCodes(codes);
      setRecoveryCodeCount(codes.length);
      setMfaEnabled(true);
      haptics.success();
      setView('recovery-codes');
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function finishRecoveryCodes() {
    setRecoveryCodes([]);
    setVerifyCode('');
    setView('status');
  }

  async function copyRecoveryCodes() {
    await Clipboard.setStringAsync(recoveryCodes.join('\n'));
    haptics.tap();
  }

  async function shareRecoveryCodes() {
    await Share.share({ message: recoveryCodes.join('\n') }).catch(() => {});
  }

  async function handleDisable() {
    setError(null);
    setBusy(true);
    try {
      await disableMfaWithPassword({ password: disablePassword, code: disableCode });
      setMfaEnabled(false);
      setRecoveryCodeCount(0);
      setDisablePassword('');
      setDisableCode('');
      haptics.success();
      setView('status');
    } catch (err) {
      haptics.warning();
      setError(err instanceof Error ? err.message : 'Could not disable two-factor authentication.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable
          onPress={() => (view === 'status' ? router.back() : handleCancelEnroll())}
          hitSlop={10}
        >
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">
            {view === 'status' ? 'Back' : 'Cancel'}
          </Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Security</Text>
        <View className="w-14" />
      </View>

      {view === 'loading' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-3.5 p-5" keyboardShouldPersistTaps="handled">
          {view === 'status' && (
            <View className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[14px] font-bold text-text dark:text-text-dark">Two-factor authentication</Text>
                  <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
                    Adds a second step at sign-in using a code from an authenticator app (Google Authenticator, Authy,
                    Microsoft Authenticator, etc.) — so a stolen password alone isn&apos;t enough to get into your
                    account.
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2.5 py-1 ${mfaEnabled ? 'bg-green-weak dark:bg-green-weak-dark' : 'bg-hover dark:bg-hover-dark'}`}
                >
                  <Text
                    className={`text-[10.5px] font-bold uppercase ${mfaEnabled ? 'text-green dark:text-green-dark' : 'text-muted dark:text-muted-dark'}`}
                  >
                    {mfaEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>

              {mfaEnabled && (
                <View className="mt-3.5 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 dark:border-border-dark dark:bg-surface-2-dark">
                  <Text className="text-[12.5px] text-text-2 dark:text-text-2-dark">
                    {recoveryCodeCount} recovery code{recoveryCodeCount === 1 ? '' : 's'} remaining. Recovery codes
                    let you sign in if you lose access to your authenticator app.
                  </Text>
                </View>
              )}

              {error && <Text className="mt-3.5 text-[12.5px] font-medium text-red dark:text-red-dark">{error}</Text>}

              <View className="mt-4">
                {mfaEnabled ? (
                  <Button variant="secondary" onPress={() => setView('disable')}>
                    Disable two-factor authentication
                  </Button>
                ) : (
                  <Button loading={busy} onPress={handleStartEnroll}>
                    Enable two-factor authentication
                  </Button>
                )}
              </View>
            </View>
          )}

          {view === 'enroll-qr' && (
            <View className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">Scan this QR code</Text>
              <Text className="mt-2 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
                1. Open your authenticator app{'\n'}2. Tap the + button to add a new account{'\n'}3. Scan the QR code
                below, or enter the key manually
              </Text>
              <View className="my-4 items-center">
                <View className="rounded-[10px] border border-border bg-white p-3 dark:border-border-dark">
                  <QRCode value={otpauthUrl} size={180} />
                </View>
              </View>
              <View className="mb-4 rounded-[9px] border border-border bg-surface-2 px-3.5 py-2.5 dark:border-border-dark dark:bg-surface-2-dark">
                <Text className="text-center font-mono text-[13px] text-text dark:text-text-dark">{manualSecret}</Text>
              </View>
              <Button onPress={() => setView('enroll-verify')}>Continue</Button>
            </View>
          )}

          {view === 'enroll-verify' && (
            <View className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">Enter the 6-digit code</Text>
              <Text className="mt-1 text-[12.5px] text-text-2 dark:text-text-2-dark">
                From your authenticator app, to confirm setup.
              </Text>
              <View className="mt-3.5">
                <TextField
                  value={verifyCode}
                  onChangeText={(v) => setVerifyCode(v.trim())}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>
              {error && <Text className="mt-2 text-[12.5px] font-medium text-red dark:text-red-dark">{error}</Text>}
              <Button loading={busy} disabled={verifyCode.length !== 6} onPress={handleConfirmEnroll} className="mt-3.5">
                Verify &amp; enable
              </Button>
            </View>
          )}

          {view === 'recovery-codes' && (
            <View className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">Save your recovery codes</Text>
              <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
                Each code can be used once to sign in if you lose access to your authenticator app. Store them
                somewhere safe — this is the only time they&apos;ll be shown.
              </Text>
              <View className="mt-3.5 flex-row flex-wrap gap-x-4 gap-y-2 rounded-[10px] border border-border bg-surface-2 p-3.5 dark:border-border-dark dark:bg-surface-2-dark">
                {recoveryCodes.map((code) => (
                  <Text key={code} className="w-[45%] font-mono text-[13px] text-text dark:text-text-dark">
                    {code}
                  </Text>
                ))}
              </View>
              <View className="mt-3.5 flex-row gap-2">
                <Button variant="secondary" onPress={copyRecoveryCodes} className="flex-1">
                  Copy
                </Button>
                <Button variant="secondary" onPress={shareRecoveryCodes} className="flex-1">
                  Share
                </Button>
              </View>
              <Button onPress={finishRecoveryCodes} className="mt-3.5">
                I&apos;ve saved these codes
              </Button>
            </View>
          )}

          {view === 'disable' && (
            <View className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <Text className="text-[14px] font-bold text-text dark:text-text-dark">Disable two-factor authentication</Text>
              <Text className="mt-1 text-[12.5px] leading-snug text-text-2 dark:text-text-2-dark">
                Confirm your password and a current code (from your authenticator app, or a recovery code) to turn
                this off.
              </Text>
              <View className="mt-3.5 gap-3">
                <TextField label="Password" secureTextEntry value={disablePassword} onChangeText={setDisablePassword} />
                <TextField
                  label="Authentication code or recovery code"
                  value={disableCode}
                  onChangeText={(v) => setDisableCode(v.trim())}
                  placeholder="123456 or HDT4-9XPA"
                  autoCapitalize="characters"
                />
              </View>
              {error && <Text className="mt-2 text-[12.5px] font-medium text-red dark:text-red-dark">{error}</Text>}
              <Button loading={busy} onPress={handleDisable} className="mt-3.5">
                Disable two-factor authentication
              </Button>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
