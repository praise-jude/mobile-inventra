import { useEffect, useState } from 'react';

import { formatCurrentTime } from '@/lib/format';

// Ticks a re-render once a minute so the Dashboard's clock stays current
// without a manual refresh — a plain useState tick counter rather than
// storing the formatted string itself, so formatCurrentTime (which reads
// the device clock live) is always the single source of truth.
export function useLiveClock(timezone: string): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return formatCurrentTime(timezone);
}
