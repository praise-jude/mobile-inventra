// Small preset date-range helper for Reports screens — mobile trades web's
// custom date-picker inputs for a handful of common presets, matching the
// "keep it lean" approach used throughout this app's report/filter UIs.
export type DateRangePreset = 'today' | 'week' | 'month' | 'year';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: DateRangePreset): { from: string; to: string; granularity: 'day' | 'week' | 'month' } {
  const now = new Date();
  const to = toDateString(now);

  if (preset === 'today') {
    return { from: to, to, granularity: 'day' };
  }
  if (preset === 'week') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toDateString(from), to, granularity: 'day' };
  }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateString(from), to, granularity: 'day' };
  }
  const from = new Date(now.getFullYear(), 0, 1);
  return { from: toDateString(from), to, granularity: 'month' };
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'This month',
  year: 'This year',
};
