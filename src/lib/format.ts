// Direct port of Inventra/lib/currency.ts + lib/format.ts + the
// dashboard-relevant slice of lib/datetime.ts — pure, framework-free
// functions, so copied verbatim rather than reimplemented to keep numbers
// and copy identical between web and mobile.

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', CAD: '$', AUD: '$', NZD: '$', SGD: '$', HKD: '$', MXN: '$', BZD: '$',
  GBP: '£', EUR: '€', NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', INR: '₹',
  JPY: '¥', CNY: '¥', CHF: 'CHF', AED: 'AED', SAR: 'SAR', EGP: 'E£', PKR: '₨',
  BDT: '৳', PHP: '₱', IDR: 'Rp', VND: '₫', THB: '฿', KRW: '₩', TRY: '₺',
  BRL: 'R$', NOK: 'kr', SEK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
  ILS: '₪', TZS: 'TSh', UGX: 'USh', RWF: 'FRw', XOF: 'CFA', XAF: 'FCFA',
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function formatMoney(n: number, currency: string = 'USD'): string {
  const symbol = currencySymbol(currency);
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString();
}

export function pctDelta(current: number, prior: number | null | undefined): number | null {
  if (prior === null || prior === undefined || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function formatPct(pct: number | null, decimals = 1): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function formatTodayHeader(timezone: string): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

export function greetingFor(timezone: string): { emoji: string; label: string } {
  const rawHour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date()),
  );
  const hour = rawHour % 24;
  if (hour < 12) return { emoji: '🌅', label: 'Good Morning' };
  if (hour < 17) return { emoji: '☀️', label: 'Good Afternoon' };
  return { emoji: '🌙', label: 'Good Evening' };
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
