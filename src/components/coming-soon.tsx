import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Honest placeholder for a nav section that isn't built yet on mobile —
// deliberately not a demo/fake screen. Every section in the tab bar is
// reachable; this just says plainly what's live today and points back to
// the one section that is.
export function ComingSoon({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent-weak dark:bg-accent-weak-dark">
          <Text className="text-[26px]">{icon}</Text>
        </View>
        <Text className="text-center text-[18px] font-bold text-text dark:text-text-dark">{title}</Text>
        <Text className="max-w-[280px] text-center text-[13.5px] leading-snug text-text-2 dark:text-text-2-dark">
          {description}
        </Text>
      </View>
    </SafeAreaView>
  );
}
