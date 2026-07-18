// Hand-maintained, narrowed to the tables/RPCs the mobile app actually
// touches for auth/onboarding. Mirrors the relevant slice of
// Inventra/lib/supabase/database.types.ts (itself hand-maintained against
// the Supabase SQL migrations — there is no Prisma schema for this project).
// Extend this file as more features are ported, rather than duplicating a
// second source of truth for shapes already defined on the web side.
//
// NOTE: these must be `type` aliases, not `interface`s — supabase-js checks
// `Database['public']['Tables'][...] extends GenericTable` (which requires
// `Record<string, unknown>` compatibility) as a conditional type, and
// TypeScript interfaces don't structurally satisfy an index-signature type
// in that position the way an equivalent `type` does. Using `interface`
// here silently collapses every query's inferred Row type to `never`.

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'warehouse';
export type MemberStatus = 'active' | 'invited';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'payment_failed'
  | 'cancelled'
  | 'expired'
  | 'suspended';
export type BillingInterval = 'monthly' | 'yearly';

export type Organization = {
  id: string;
  name: string;
  business_email: string | null;
  country: string | null;
  state: string | null;
  currency: string;
  timezone: string;
  tax_rate: number;
  support_email: string | null;
  plan: string;
  trial_ends_at: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  theme_preference: string;
  terms_accepted: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  terms_accepted_ip: string | null;
  last_active_at: string | null;
  suspended_at: string | null;
  branch_id: string | null;
  created_at: string;
};

export type InvoiceStatus = 'paid' | 'pending' | 'failed';

// Narrowed to the fields the (billing) subscription-required screen
// actually displays — mirrors Inventra/lib/supabase/database.types.ts's
// Subscription/Invoice interfaces (same "hand-maintained slice" convention
// as the rest of this file).
export type Subscription = {
  org_id: string;
  status: SubscriptionStatus;
  plan_key: string;
  billing_interval: BillingInterval | null;
  amount: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  authorization_code: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: string | null;
  card_exp_year: string | null;
  grandfathered: boolean;
};

export type Invoice = {
  id: string;
  org_id: string;
  invoice_number: string;
  amount: number;
  status: InvoiceStatus;
  issued_at: string;
  plan_key: string | null;
};

// Return shape of the get_access_gate_state() RPC
// (supabase/migrations/20260711090000_access_gate_rpc.sql) — a single
// left-joined query the web middleware and this app both call to decide
// onboarding/subscription gating without chaining sequential requests.
export type AccessGateState = {
  profile_exists: boolean;
  terms_accepted: boolean;
  org_id: string | null;
  country: string | null;
  subscription_status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
};

// Dashboard RPC return shapes — mirror the matching interfaces in
// Inventra/lib/supabase/database.types.ts exactly (same RPCs, same org-scoped
// RLS, just called directly from the client here instead of through a
// server-only query helper).
export type DashboardKpis = {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  active_suppliers: number;
  today_revenue: number;
  yesterday_revenue: number;
  monthly_profit: number | null;
  prior_monthly_profit: number | null;
  total_inventory_cost: number;
  total_inventory_value: number;
  total_expected_profit: number;
  total_stock_qty: number;
};

export type TopSellerRow = {
  product_id: string;
  name: string;
  emoji: string | null;
  units: number;
  revenue: number;
  trend_pct: number | null;
};

export type StockHealthRow = {
  label: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring';
  count: number;
};

export type StockMovement = {
  id: string;
  type: string;
  qty_delta: number;
  reason: string | null;
  created_at: string;
  product_id: string;
  actor_id: string | null;
};

type TableDef<Row, Update> = {
  Row: Row;
  Insert: never;
  Update: Update;
  // Required by supabase-js's GenericTable constraint. The one embedded-
  // resource select this app does (stock_movements -> products/profiles on
  // the dashboard's recent-activity feed) is cast to a local row type by
  // hand at the call site instead of being modeled here — same "cast an
  // ad-hoc join shape" precedent as Inventra/lib/queries/dashboard.ts's
  // getRecentActivity.
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<
        Organization,
        Partial<Pick<Organization, 'name' | 'business_email' | 'country' | 'state' | 'currency' | 'timezone'>>
      >;
      profiles: TableDef<
        Profile,
        Partial<Pick<Profile, 'terms_accepted' | 'terms_version' | 'terms_accepted_at' | 'terms_accepted_ip'>>
      >;
      // Read-only from the mobile client — every write goes through the
      // bearer-token routes under Inventra's app/api/mobile/billing/, never
      // a direct table update, so `Update` is `never` here.
      subscriptions: TableDef<Subscription, never>;
      invoices: TableDef<Invoice, never>;
      stock_movements: TableDef<StockMovement, never>;
    };
    Views: Record<string, never>;
    Functions: {
      get_access_gate_state: {
        Args: Record<string, never>;
        Returns: AccessGateState;
      };
      get_kpis: {
        Args: Record<string, never>;
        Returns: DashboardKpis;
      };
      get_top_sellers: {
        Args: { p_limit: number };
        Returns: TopSellerRow[];
      };
      get_stock_health: {
        Args: Record<string, never>;
        Returns: StockHealthRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
