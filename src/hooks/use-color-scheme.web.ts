import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Uses useSyncExternalStore's server/client snapshot split (server snapshot
 * 'light', client snapshot 'hydrated') instead of an effect + setState flag —
 * same hydration-safe result, but as a single React-scheduled second pass
 * rather than a manual cascading render (react-hooks/set-state-in-effect).
 *
 * Sourced from NativeWind's colorScheme (not React Native's useColorScheme)
 * so it reflects the user's Settings > Appearance choice — see
 * src/hooks/use-color-scheme.ts for the native-platform counterpart.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const colorScheme = useNativeWindColorScheme().colorScheme;

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
