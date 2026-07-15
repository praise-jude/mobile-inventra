import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { completeOnboarding } from '@/lib/actions/auth';
import { useAuth } from '@/lib/auth-context';
import { COUNTRIES, statesForCountry } from '@/lib/geo/countries';
import { supabase } from '@/lib/supabase';
import { buildCompleteOnboardingSchema, type CompleteOnboardingInput } from '@/lib/validation/auth';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

// Mirrors Inventra/app/(app)/onboarding/complete/page.tsx +
// CompleteProfileForm.tsx: business fields are only editable by owner/admin
// (canEditBusiness); everyone else just accepts terms for themselves.
export default function CompleteOnboardingScreen() {
  const { session, refetchGate } = useAuth();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['profile-org', session?.user.id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      if (profileError) throw profileError;

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();
      if (orgError) throw orgError;

      return { profile, org };
    },
    enabled: !!session,
  });

  const canEditBusiness = profileQuery.data
    ? profileQuery.data.profile.role === 'owner' || profileQuery.data.profile.role === 'admin'
    : false;
  const termsAlreadyAccepted = profileQuery.data?.profile.terms_accepted ?? false;

  const schema = useMemo(
    () => buildCompleteOnboardingSchema({ canEditBusiness, termsAlreadyAccepted }),
    [canEditBusiness, termsAlreadyAccepted],
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<CompleteOnboardingInput>({
    resolver: zodResolver(schema),
    defaultValues: { businessName: '', businessEmail: '', country: '', state: '', termsAccepted: false },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    reset({
      businessName: profileQuery.data.org.name ?? '',
      businessEmail: profileQuery.data.org.business_email ?? '',
      country: profileQuery.data.org.country ?? '',
      state: profileQuery.data.org.state ?? '',
      termsAccepted: profileQuery.data.profile.terms_accepted,
    });
  }, [profileQuery.data, reset]);

  const country = watch('country');
  const stateOptions = useMemo(() => statesForCountry(country ?? '').map((s) => ({ value: s, label: s })), [country]);

  async function onSubmit(values: CompleteOnboardingInput) {
    setFormError(null);
    try {
      await completeOnboarding({
        businessName: canEditBusiness ? values.businessName : undefined,
        businessEmail: canEditBusiness ? values.businessEmail : undefined,
        country: canEditBusiness ? values.country : undefined,
        state: canEditBusiness ? values.state : undefined,
        termsAccepted: values.termsAccepted,
      });
      await queryClient.invalidateQueries({ queryKey: ['access-gate'] });
      refetchGate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save your profile.');
    }
  }

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-[22px] font-bold text-text dark:text-text-dark">
          Finish setting up your workspace
        </Text>
        <Text className="mb-6 text-[14px] text-text-2 dark:text-text-2-dark">
          {canEditBusiness
            ? 'A couple of details are missing before you can continue.'
            : 'Please review and accept our Terms & Conditions to continue.'}
        </Text>

        <View className="gap-3.5 rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          {canEditBusiness && (
            <>
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
                    value={field.value ?? ''}
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
            </>
          )}

          {!termsAlreadyAccepted && (
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
          )}

          {formError && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{formError}</Text>}

          <Button loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
            Continue to dashboard
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
