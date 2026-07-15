// Direct port of Inventra/lib/billing-plans.ts — pure data, no Next.js
// dependency. Keep prices/copy in sync with that file.
//
// These are display-only on mobile — actual charge amounts are always
// decided server-side (Inventra's initiateAddCardForContext/webhook), so
// unlike the web app there's no risk of this drifting from what a user is
// actually charged, only from what they're shown before checkout.
import type { BillingInterval } from '@/types/database';

const MONTHLY_PRICE = Number(process.env.EXPO_PUBLIC_PLAN_PRICE_MONTHLY ?? 5000);
const YEARLY_PRICE = Number(process.env.EXPO_PUBLIC_PLAN_PRICE_YEARLY ?? 50000);

export interface PlanDef {
  key: 'trial' | 'monthly' | 'yearly';
  name: string;
  price: number; // naira; 0 for the trial
  interval: BillingInterval | null; // null for the trial (not a recurring interval itself)
  desc: string;
  features: string[];
  cta: string;
  badge?: string;
  highlight?: boolean;
  selectable: boolean; // the trial tile is informational only, not a checkout target
}

export const PLANS: PlanDef[] = [
  {
    key: 'trial',
    name: 'Free Trial',
    price: 0,
    interval: null,
    desc: '6 days, full access, no charge until it ends.',
    features: ['Full access to every feature', 'A card is required to activate it', 'Cancel anytime before it ends'],
    cta: 'Included with signup',
    selectable: false,
  },
  {
    key: 'monthly',
    name: 'Monthly',
    price: MONTHLY_PRICE,
    interval: 'monthly',
    desc: 'Billed every month, cancel anytime.',
    features: ['Everything in Inventra', 'Auto-renews monthly', 'Cancel or switch anytime'],
    cta: 'Choose Monthly',
    selectable: true,
  },
  {
    key: 'yearly',
    name: 'Yearly',
    price: YEARLY_PRICE,
    interval: 'yearly',
    desc: 'Billed once a year — best value.',
    features: ['Everything in Inventra', 'Two months free vs. monthly', 'Auto-renews yearly'],
    cta: 'Choose Yearly',
    badge: 'Best value',
    highlight: true,
    selectable: true,
  },
];

export function planByKey(key: string): PlanDef | undefined {
  return PLANS.find((p) => p.key === key);
}
