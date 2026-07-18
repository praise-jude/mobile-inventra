import type { ReactNode } from 'react';
import { Dimensions, Text, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface OnboardingPageProps {
  title: string;
  bullets: string[];
  panel: ReactNode;
}

// One page of the marketing carousel — a hero "brand panel" (code-drawn,
// see onboarding-panels.tsx) over a title + feature bullet list. Fixed to
// the screen width so the parent ScrollView pages cleanly.
export function OnboardingPage({ title, bullets, panel }: OnboardingPageProps) {
  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 px-6">
      <View className="flex-1 items-center justify-center">{panel}</View>
      <View className="mb-6">
        <Text className="text-center text-[26px] font-bold tracking-tight text-text dark:text-text-dark">
          {title}
        </Text>
        <View className="mt-4 gap-2.5">
          {bullets.map((b) => (
            <View
              key={b}
              className="flex-row items-center gap-2.5 rounded-[12px] border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
            >
              <View className="h-2 w-2 rounded-full bg-accent dark:bg-accent-dark" />
              <Text className="flex-1 text-[14px] font-medium text-text-2 dark:text-text-2-dark">{b}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
