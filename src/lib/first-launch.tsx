import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const INTRO_SEEN_KEY = 'ri_intro_seen_v1';

interface IntroSeenContextValue {
  seen: boolean | null;
  markSeen: () => void;
}

// A Context, not a standalone hook with its own useState — the root
// navigator's Stack.Protected guard (src/app/_layout.tsx) and the carousel
// screen that calls markSeen() (src/app/(intro)/carousel.tsx) are different
// components. A plain `useState`-backed hook called in both places would
// give each its own disconnected copy: markSeen() in the carousel would
// never be seen by the navigator's guard, so router.replace() to (auth)
// would fire but the guard would immediately re-protect (intro) anyway
// since *its* local `seen` was still false. This must be one shared value.
const IntroSeenContext = createContext<IntroSeenContextValue | undefined>(undefined);

export function IntroSeenProvider({ children }: PropsWithChildren) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY).then((value) => {
      setSeen(value === '1');
    });
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    void AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  }, []);

  const value = useMemo(() => ({ seen, markSeen }), [seen, markSeen]);

  return <IntroSeenContext.Provider value={value}>{children}</IntroSeenContext.Provider>;
}

export function useIntroSeen(): IntroSeenContextValue {
  const ctx = useContext(IntroSeenContext);
  if (!ctx) throw new Error('useIntroSeen must be used within an IntroSeenProvider');
  return ctx;
}
