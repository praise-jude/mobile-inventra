import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const noopSubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Uses useSyncExternalStore's server/client snapshot split (server snapshot
 * 'light', client snapshot 'hydrated') instead of an effect + setState flag —
 * same hydration-safe result, but as a single React-scheduled second pass
 * rather than a manual cascading render (react-hooks/set-state-in-effect).
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
