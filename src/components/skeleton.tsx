import { useEffect } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Mirrors Inventra/components/ui/Skeleton.tsx's shimmer — CSS `animate-pulse`
// has no RN equivalent, so this drives the same opacity pulse via reanimated.
export function Skeleton({ className, style, ...props }: ViewProps & { className?: string }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`rounded-[9px] bg-border-2 dark:bg-border-2-dark ${className ?? ''}`}
      style={[animatedStyle, style]}
      {...props}
    />
  );
}
