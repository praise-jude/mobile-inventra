import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

// Sourced from NativeWind's own colorScheme (not React Native's
// useColorScheme) so every call site — the splash overlay, NativeTabs'
// bar/indicator colors, chart color sets — reflects the user's explicit
// Settings > Appearance choice (see theme-preference-context.tsx), not just
// the raw OS setting. NativeWind already resolves 'system' against
// Appearance internally, so this stays a plain 'light' | 'dark' | undefined
// return, same shape RN's hook had — no downstream call site needs to change
// beyond its import.
export function useColorScheme() {
  return useNativeWindColorScheme().colorScheme;
}
