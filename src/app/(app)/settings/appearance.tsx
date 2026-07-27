import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference-context';

const OPTIONS: { value: ThemePreference; icon: string; label: string; description: string }[] = [
  { value: 'light', icon: '☀️', label: 'Light', description: 'Always use the light theme' },
  { value: 'dark', icon: '🌙', label: 'Dark', description: 'Always use the dark theme' },
  { value: 'system', icon: '📱', label: 'Follow system', description: "Match this device's appearance setting" },
];

// Settings > Appearance — applies instantly (no Save button), matching how
// the OS's own appearance picker behaves. See lib/theme-preference-context.tsx
// for how the choice is persisted and propagated to every screen.
export default function AppearanceSettingsScreen() {
  const { preference, setPreference } = useThemePreference();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-accent-text dark:text-accent-text-dark">Back</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-text dark:text-text-dark">Appearance</Text>
        <View className="w-12" />
      </View>

      <View className="gap-2.5 p-5">
        {OPTIONS.map((opt) => {
          const selected = preference === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                haptics.select();
                setPreference(opt.value);
              }}
              className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
                selected
                  ? 'border-accent bg-accent-weak dark:border-accent-dark dark:bg-accent-weak-dark'
                  : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak dark:bg-accent-weak-dark">
                <Text className="text-[18px]">{opt.icon}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-semibold text-text dark:text-text-dark">{opt.label}</Text>
                <Text className="mt-0.5 text-[11.5px] text-muted dark:text-muted-dark">{opt.description}</Text>
              </View>
              {selected && <Text className="text-[16px] text-accent-text dark:text-accent-text-dark">✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
