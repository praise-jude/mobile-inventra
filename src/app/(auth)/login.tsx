import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { signIn } from '@/lib/actions/auth';
import { type LoginInput, loginSchema } from '@/lib/validation/auth';

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      // Session change flows through AuthProvider's onAuthStateChange
      // listener, which drives the root Stack.Protected redirect.
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-2xl font-bold text-text dark:text-text-dark">Welcome back</Text>
        <Text className="mb-6 text-[14px] text-text-2 dark:text-text-2-dark">
          Sign in to your workspace to continue.
        </Text>

        <View className="gap-3.5">
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="Email"
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

          <View>
            <Text className="mb-1.5 text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <View>
                  <TextField
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    className="pr-16"
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} className="absolute right-3 top-[13px]">
                    <Text className="text-[12.5px] font-semibold text-text-2 dark:text-text-2-dark">
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              )}
            />
          </View>

          {formError && <Text className="text-[13px] font-medium text-red dark:text-red-dark">{formError}</Text>}

          <Button loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
            Sign in →
          </Button>
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-[13.5px] text-text-2 dark:text-text-2-dark">No account? </Text>
          <Link href="/(auth)/signup" className="text-[13.5px] font-semibold text-accent-text dark:text-accent-text-dark">
            Create one
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
