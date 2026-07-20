// Mirrors Inventra/lib/postgrest-filter.ts. PostgREST's `.or()` filter
// string uses `,` to separate conditions and `()` to group them, and SQL's
// ILIKE treats `%`/`_` as wildcards — a raw, unescaped user search term
// containing any of those corrupts the filter grammar or produces overly
// broad matches. Wrapping the value in double quotes is PostgREST's own
// escape hatch for filter metacharacters; within a quoted value only `\`
// and `"` need escaping, and `%`/`_` are escaped separately so they match
// literally under Postgres's default LIKE/ILIKE backslash-escape behavior.
export function escapeIlikeTerm(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"');
}
