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
// 'rejected' and 'suspended' aren't values of this enum — mirrors
// Inventra's schema, where both are modeled as a nullable timestamp
// (rejected_at / suspended_at) on top of status, not a status value.
export type MemberStatus = 'active' | 'invited' | 'awaiting_approval';
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
  rejected_at: string | null;
  rejected_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export type InvoiceStatus = 'paid' | 'pending' | 'failed';

export type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type MovementType = 'received' | 'sale' | 'adjustment' | 'transfer' | 'return' | 'expired';
export type AdjustmentType = 'increase' | 'decrease' | 'damaged' | 'expired' | 'count_correction' | 'loss' | 'other';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'mobile_money';

// Mirrors Inventra/supabase/migrations/20260708120000_init.sql +
// 20260709121240_audit_log_and_product_status.sql (is_active).
export type Product = {
  id: string;
  org_id: string;
  category_id: string | null;
  warehouse_id: string | null;
  supplier_id: string | null;
  name: string;
  description: string | null;
  emoji: string | null;
  brand: string | null;
  sku: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  reorder_level: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_damaged: number;
  qty_returned: number;
  expiry_date: string | null;
  batch_number: string | null;
  status: ProductStatus;
  is_active: boolean;
  image_url: string | null;
  barcode: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  org_id: string;
  name: string;
  emoji: string | null;
};

export type Supplier = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type Warehouse = {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
};

export type Customer = {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type NotificationSettings = {
  org_id: string;
  low_stock: boolean;
  out_of_stock: boolean;
  expiring_products: boolean;
  new_purchase_orders: boolean;
  weekly_digest: boolean;
};

export type PaperSize = '58mm' | '80mm' | 'a4';

export type PrintSettings = {
  org_id: string;
  paper_size: PaperSize;
  auto_print: boolean;
  receipt_footer: string | null;
};

export type Sale = {
  id: string;
  org_id: string;
  customer_id: string | null;
  walk_in_name: string | null;
  warehouse_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type SalePayment = {
  id: string;
  org_id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
};

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

// Reports RPCs — mirror Inventra/supabase/migrations/20260709121312_reports_rpcs.sql
// exactly (raw snake_case as Postgres returns them; camelCase mapping
// happens in src/lib/hooks/use-reports.ts, same split as web's
// lib/queries/reports.ts).
export type Granularity = 'day' | 'week' | 'month' | 'year';

export type SalesSummaryRpc = {
  revenue: number;
  discount: number;
  tax: number;
  sales_count: number;
  profit: number;
};

export type SalesPeriodRpcRow = {
  period: string;
  revenue: number;
  sales_count: number;
  profit: number;
};

export type SalesByBranchRpcRow = {
  warehouse_id: string;
  warehouse_name: string;
  revenue: number;
  sales_count: number;
};

export type SalesByProductRpcRow = {
  product_id: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
  profit: number;
};

export type SalesByStaffRpcRow = {
  staff_id: string | null;
  staff_name: string;
  revenue: number;
  sales_count: number;
};

export type InventoryValuationRpcRow = {
  product_id: string;
  name: string;
  sku: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  qty_on_hand: number;
  cost_price: number;
  sell_price: number;
  inventory_value: number;
  expected_profit: number;
};

export type ProfitLossRpc = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  margin_pct: number;
};

// Mirrors the stock_movements table exactly (init.sql + the sale_id/
// adjustment_type/notes columns added later) — previously had a wrong
// `actor_id` field name (the real column is `created_by`) that happened to
// be harmless because nothing selected it by name yet; fixed now that the
// movements/adjustments screens actually need it.
export type StockMovement = {
  id: string;
  org_id: string;
  product_id: string;
  warehouse_id: string | null;
  type: MovementType;
  qty_delta: number;
  unit_price: number | null;
  reason: string | null;
  adjustment_type: AdjustmentType | null;
  notes: string | null;
  sale_id: string | null;
  created_by: string | null;
  created_at: string;
};

// Mirrors Inventra/lib/actions/audit.ts's logAudit — writing directly from
// mobile (insert-only RLS, scoped to the caller's own org/identity, per
// 20260709121240_audit_log_and_product_status.sql) rather than through a
// server helper, since there's no secret-key dependency here the way
// billing's Paystack calls had one.
export type AuditLog = {
  id: string;
  org_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  // Required by supabase-js's GenericTable constraint. Embedded-resource
  // selects this app does (e.g. stock_movements -> products/profiles on the
  // dashboard's recent-activity feed) are cast to a local row type by hand
  // at the call site instead of being modeled here — same "cast an ad-hoc
  // join shape" precedent as Inventra/lib/queries/dashboard.ts's
  // getRecentActivity.
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<
        Organization,
        never,
        Partial<
          Pick<
            Organization,
            'name' | 'business_email' | 'support_email' | 'country' | 'state' | 'currency' | 'timezone' | 'tax_rate'
          >
        >
      >;
      profiles: TableDef<
        Profile,
        never,
        Partial<
          Pick<
            Profile,
            | 'terms_accepted'
            | 'terms_version'
            | 'terms_accepted_at'
            | 'terms_accepted_ip'
            | 'role'
            | 'status'
            | 'suspended_at'
            | 'rejected_at'
            | 'rejected_reason'
            | 'approved_by'
            | 'approved_at'
          >
        >
      >;
      // Read-only from the mobile client — every write goes through the
      // bearer-token routes under Inventra's app/api/mobile/billing/, never
      // a direct table update, so `Update` is `never` here.
      subscriptions: TableDef<Subscription, never, never>;
      invoices: TableDef<Invoice, never, never>;

      products: TableDef<
        Product,
        Omit<Product, 'id' | 'status' | 'created_at' | 'updated_at'> & { id?: string },
        Partial<Omit<Product, 'id' | 'org_id' | 'status' | 'created_at' | 'updated_at'>>
      >;
      categories: TableDef<Category, Omit<Category, 'id'> & { id?: string }, never>;
      suppliers: TableDef<Supplier, Omit<Supplier, 'id' | 'created_at'> & { id?: string }, never>;
      warehouses: TableDef<Warehouse, never, never>;
      customers: TableDef<Customer, Omit<Customer, 'id' | 'created_at'> & { id?: string }, never>;
      stock_movements: TableDef<StockMovement, Omit<StockMovement, 'id' | 'created_at'> & { id?: string }, never>;
      sales: TableDef<Sale, Omit<Sale, 'id' | 'created_at'> & { id?: string }, Partial<Pick<Sale, 'notes'>>>;
      sale_payments: TableDef<SalePayment, Omit<SalePayment, 'id'> & { id?: string }, Partial<Pick<SalePayment, 'method'>>>;
      // actor_id has no DB default (unlike created_by-style columns
      // elsewhere with a trigger) — the RLS insert policy requires it to be
      // explicitly set to auth.uid(), so it must stay in the Insert shape.
      audit_logs: TableDef<AuditLog, Omit<AuditLog, 'id' | 'created_at'> & { id?: string }, never>;
      notification_settings: TableDef<NotificationSettings, never, Partial<Omit<NotificationSettings, 'org_id'>>>;
      print_settings: TableDef<PrintSettings, never, Partial<Omit<PrintSettings, 'org_id'>>>;
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
      get_sales_summary: {
        Args: { p_from: string; p_to: string; p_warehouse_id?: string | null };
        Returns: SalesSummaryRpc;
      };
      get_sales_by_period: {
        Args: { p_from: string; p_to: string; p_granularity: Granularity; p_warehouse_id?: string | null };
        Returns: SalesPeriodRpcRow[];
      };
      get_sales_by_branch: {
        Args: { p_from: string; p_to: string };
        Returns: SalesByBranchRpcRow[];
      };
      get_sales_by_product: {
        Args: { p_from: string; p_to: string; p_warehouse_id?: string | null };
        Returns: SalesByProductRpcRow[];
      };
      get_sales_by_staff: {
        Args: { p_from: string; p_to: string; p_warehouse_id?: string | null };
        Returns: SalesByStaffRpcRow[];
      };
      get_inventory_valuation: {
        Args: { p_warehouse_id?: string | null };
        Returns: InventoryValuationRpcRow[];
      };
      get_profit_loss: {
        Args: { p_from: string; p_to: string; p_warehouse_id?: string | null; p_product_id?: string | null };
        Returns: ProfitLossRpc;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
