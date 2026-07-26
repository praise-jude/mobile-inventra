// Shared FlatList tuning props — reduces off-screen rendering/memory on
// low-end Android devices. Centralized so the numbers are tuned in one
// place rather than copy-pasted (and drifting) across 14 screens.
// getItemLayout is deliberately not included here: most of these rows have
// variable height (optional badges/subtext), and a wrong fixed height would
// misalign scroll position — a real regression, not a safe universal add.
export const FLATLIST_PERF_PROPS = {
  removeClippedSubviews: true,
  windowSize: 7,
  maxToRenderPerBatch: 10,
  initialNumToRender: 10,
} as const;
