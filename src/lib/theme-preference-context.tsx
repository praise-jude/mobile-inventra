import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCE_KEY = 'ri_theme_preference_v1';

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

// A Context (not a standalone hook) for the same reason src/lib/first-launch.tsx
// is one — Settings > Appearance calls setPreference() from a different
// component than every screen reading the resolved scheme, so it must be one
// shared value, not per-component useState copies.
//
// NativeWind's own useColorScheme() already resolves 'system' against the OS
// appearance and updates every `dark:` className automatically — this
// Provider's only job is (a) persisting which of the three options the user
// picked, so Settings > Appearance can show the right selection and the
// choice survives an app restart, and (b) calling NativeWind's
// setColorScheme() once on load and again on every change.
export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const { setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((stored) => {
      const value: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
      setPreferenceState(value);
      setColorScheme(value);
    });
    // setColorScheme is stable across renders (NativeWind module-level store) —
    // only run once on mount to apply the persisted preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPreference(value: ThemePreference) {
    setPreferenceState(value);
    setColorScheme(value);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, value);
  }

  return <ThemePreferenceContext.Provider value={{ preference, setPreference }}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  return ctx;
}
