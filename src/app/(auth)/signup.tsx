import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { registerAccount } from '@/lib/actions/auth';
import { COUNTRIES, statesForCountry } from '@/lib/geo/countries';
import { haptics } from '@/lib/haptics';
import { PASSWORD_RULES, passwordStrength, type SignupInput, signupSchema } from '@/lib/validation/auth';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export default function SignupScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      businessName: '',
      businessEmail: '',
      country: '',
      state: '',
      role: 'admin',
      termsAccepted: false,
    },
  });

  // useWatch (not the form's watch() escape hatch) — watch() returns a new
  // function reference every render, which React Compiler can't safely
  // memoize around, so it bails out of compiling this whole component.
  // useWatch is a real hook (subscribes via context) and compiles fine.
  const password = useWatch({ control, name: 'password' });
  const country = useWatch({ control, name: 'country' });
  const strength = passwordStrength(password);
  const stateOptions = useMemo(
    () => statesForCountry(country).map((s) => ({ value: s, label: s })),
    [country],
  );

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const result = await registerAccount(values);
    if (!result.ok) {
      haptics.warning();
      setFormError(result.error);
      return;
    }
    haptics.success();
    if (result.hasSession) return; // root gate takes over
    setAwaitingConfirmation(values.email);
  }

  if (awaitingConfirmation) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-1 justify-center px-6">
          <View className="mb-4 h-[46px] w-[46px] items-center justify-center rounded-xl bg-accent-weak dark:bg-accent-weak-dark">
            <Text className="text-[22px]">📧</Text>
          </View>
          <Text className="mb-1.5 text-2xl font-bold text-text dark:text-text-dark">Check your email</Text>
          <Text className="text-[14px] text-text-2 dark:text-text-2-dark">
            We sent a confirmation link to{' '}
            <Text className="font-bold text-text dark:text-text-dark">{awaitingConfirmation}</Text>. Click it to
            activate your workspace, then come back and sign in.
          </Text>
          <Link href="/(auth)/login" className="mt-6 text-center text-[13.5px] font-semibold text-accent-text dark:text-accent-text-dark">
            ← Back to sign in
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-2xl font-bold text-text dark:text-text-dark">Create your workspace</Text>
        <Text className="mb-6 text-[14px] text-text-2 dark:text-text-2-dark">
          Start your 6-day free trial — a card is required to activate it.
        </Text>

        <View className="gap-3.5">
          <Controller
            control={control}
            name="fullName"
            render={({ field, fieldState }) => (
              <TextField
                label="Full name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="Email address"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <View>
                <View className="relative">
                  <TextField
                    label="Password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    className="pr-14"
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} className="absolute right-3 top-[30px]">
                    <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
                <View className="mt-2 flex-row gap-[5px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      className={`h-1 flex-1 rounded-[3px] ${
                        i < strength
                          ? strength >= 4
                            ? 'bg-green dark:bg-green-dark'
                            : 'bg-amber dark:bg-amber-dark'
                          : 'bg-border dark:bg-border-dark'
                      }`}
                    />
                  ))}
                </View>
                <View className="mt-2 gap-0.5">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(field.value);
                    return (
                      <Text
                        key={rule.key}
                        className={`text-[11.5px] ${met ? 'text-green dark:text-green-dark' : 'text-muted dark:text-muted-dark'}`}
                      >
                        {met ? '✓' : '○'} {rule.label}
                      </Text>
                    );
                  })}
                </View>
                {fieldState.error?.message && (
                  <Text className="mt-1 text-[12px] font-medium text-red dark:text-red-dark">
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />

          <View className="my-1 h-px bg-border dark:bg-border-dark" />

          <Controller
            control={control}
            name="businessName"
            render={({ field, fieldState }) => (
              <TextField
                label="Business name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="businessEmail"
            render={({ field, fieldState }) => (
              <TextField
                label="Business email (optional)"
                autoCapitalize="none"
                keyboardType="email-address"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="country"
            render={({ field, fieldState }) => (
              <SelectField
                label="Country"
                placeholder="Select country…"
                searchable
                value={field.value}
                options={COUNTRY_OPTIONS}
                onChange={(v) => {
                  field.onChange(v);
                  setValue('state', '');
                }}
                error={fieldState.error?.message}
              />
            )}
          />

          {stateOptions.length > 0 && (
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <SelectField
                  label="State/Province"
                  placeholder="Select state…"
                  searchable
                  value={field.value ?? ''}
                  options={stateOptions}
                  onChange={field.onChange}
                />
              )}
            />
          )}

          <View>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <SelectField label="Your role" value={field.value} options={ROLE_OPTIONS} onChange={field.onChange} />
              )}
            />
            <Text className="mt-1.5 text-[11.5px] text-muted dark:text-muted-dark">
              As the creator of a new business, you&apos;ll have full owner access — this just helps us tailor your
              setup.
            </Text>
          </View>

          <Controller
            control={control}
            name="termsAccepted"
            render={({ field, fieldState }) => (
              <View>
                <Pressable onPress={() => field.onChange(!field.value)} className="flex-row items-start gap-2">
                  <View
                    className={`mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${
                      field.value
                        ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
                        : 'border-border dark:border-border-dark'
                    }`}
                  >
                    {field.value && <Text className="text-[12px] font-bold text-white">✓</Text>}
                  </View>
                  <Text className="flex-1 text-[12.5px] text-text-2 dark:text-text-2-dark">
                    I agree to the Terms &amp; Conditions and Privacy Policy.
                  </Text>
                </Pressable>
                {fieldState.error?.message && (
                  <Text className="mt-1 text-[12px] font-medium text-red dark:text-red-dark">
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />

          {formError && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{formError}</Text>}

          <Button loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
            Create account
          </Button>
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-[13.5px] text-text-2 dark:text-text-2-dark">Already have an account? </Text>
          <Link href="/(auth)/login" className="text-[13.5px] font-semibold text-accent-text dark:text-accent-text-dark">
            Sign in
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
