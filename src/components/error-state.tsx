import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';

// Mirrors Inventra/components/app/ErrorState.tsx's copy/shape for a query
// (not render-crash) failure — used wherever a screen's primary data fetch
// fails and needs a retry affordance instead of the app-wide error boundary.
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8 py-14">
      <View className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-red-weak dark:bg-red-weak-dark">
        <Text className="text-[22px]">⚠️</Text>
      </View>
      <View>
        <Text className="text-center text-[17px] font-bold text-text dark:text-text-dark">Something went wrong</Text>
        <Text className="mt-1.5 max-w-[320px] text-center text-[13px] text-text-2 dark:text-text-2-dark">
          Check your connection and try again — if it keeps happening, let us know.
        </Text>
      </View>
      <Button onPress={onRetry}>Try again</Button>
    </View>
  );
}
