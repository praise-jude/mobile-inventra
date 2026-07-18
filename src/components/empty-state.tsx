import { Text, View } from 'react-native';

// Mirrors Inventra/components/ui/EmptyState.tsx — same icon-chip + title +
// description shape, `compact` trims the vertical padding for use inside a
// card (e.g. an empty "Top sellers" list) vs. a full-screen empty state.
export function EmptyState({
  icon = '📭',
  title,
  description,
  compact = false,
}: {
  icon?: string;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <View className={`items-center justify-center ${compact ? 'py-6' : 'py-14'}`}>
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-[13px] bg-accent-weak dark:bg-accent-weak-dark">
        <Text className="text-[22px]">{icon}</Text>
      </View>
      <Text className="text-center text-[14px] font-bold text-text dark:text-text-dark">{title}</Text>
      {description && (
        <Text className="mt-1 max-w-[280px] text-center text-[12.5px] leading-snug text-muted dark:text-muted-dark">
          {description}
        </Text>
      )}
    </View>
  );
}
