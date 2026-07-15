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

type TableDef<Row, Update> = {
  Row: Row;
  Insert: never;
  Update: Update;
  // Required by supabase-js's GenericTable constraint even though this app
  // never touches embedded-resource (foreign table) selects.
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
    };
    Views: Record<string, never>;
    Functions: {
      get_access_gate_state: {
        Args: Record<string, never>;
        Returns: AccessGateState;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
