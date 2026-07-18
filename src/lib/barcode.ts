// Direct port of Inventra/lib/barcode.ts — pure algorithm, no dependencies.
// Generates a random or SKU-derived EAN-13: 12 digits + a computed check
// digit, following the standard EAN-13 checksum algorithm (odd positions
// weighted 1, even positions weighted 3, from the left).
export function generateEan13(seed?: string): string {
  let digits: string;
  if (seed && seed.trim()) {
    const hash = Array.from(seed.trim()).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    digits = String(hash).padStart(12, '0').slice(0, 12);
  } else {
    digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  const sum = digits
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
}
