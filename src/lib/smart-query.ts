// Mirrors Inventra/lib/smart-query.ts. Rule-based (not ML) quick-filter
// parsing for the Inventory search box — recognizes a handful of common
// phrases and maps them straight to filter params search_products()
// already supports, instead of searching for them as literal text.
export interface SmartQueryFilters {
  status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  active?: 'active' | 'inactive';
  minPrice?: number;
  maxPrice?: number;
  expiryTo?: string;
}

export interface SmartQueryResult {
  filters: SmartQueryFilters;
  matched: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PATTERNS: { test: RegExp; filters: (m: RegExpMatchArray) => SmartQueryFilters }[] = [
  { test: /^expiring\s+(this\s+week|soon)$/i, filters: () => ({ expiryTo: isoDaysFromNow(7) }) },
  { test: /^expired(?:\s+(?:items|products))?$/i, filters: () => ({ expiryTo: todayIso() }) },
  { test: /^(low\s+stock|items?\s+running\s+low|running\s+low)$/i, filters: () => ({ status: 'low_stock' }) },
  { test: /^out\s+of\s+stock$/i, filters: () => ({ status: 'out_of_stock' }) },
  { test: /^in\s+stock$/i, filters: () => ({ status: 'in_stock' }) },
  { test: /^inactive$/i, filters: () => ({ active: 'inactive' }) },
  { test: /^active$/i, filters: () => ({ active: 'active' }) },
  {
    test: /^(above|over|more than|greater than)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)$/i,
    filters: (m) => ({ minPrice: Number(m[2].replace(/,/g, '')) }),
  },
  {
    test: /^(below|under|less than)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)$/i,
    filters: (m) => ({ maxPrice: Number(m[2].replace(/,/g, '')) }),
  },
];

export function parseSmartQuery(rawQuery: string): SmartQueryResult {
  const q = rawQuery.trim();
  if (!q) return { filters: {}, matched: false };

  for (const pattern of PATTERNS) {
    const m = q.match(pattern.test);
    if (m) return { filters: pattern.filters(m), matched: true };
  }
  return { filters: {}, matched: false };
}
