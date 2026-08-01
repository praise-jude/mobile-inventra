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
  referral_code: string;
  referred_by_org_id: string | null;
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
  accepted_at: string | null;
  invited_by: string | null;
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

// Contact fields added by
// Inventra/supabase/migrations/20260708120400_categories_suppliers.sql.
export type Supplier = {
  id: string;
  org_id: string;
  name: string;
  company: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
};

export type WarehouseStatus = 'active' | 'inactive';

// country/state/phone/status added by
// Inventra/supabase/migrations/20260708210200_branches_extend_schema.sql —
// table stays named `warehouses` in Postgres, UI label is "Branches".
export type Warehouse = {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  manager_profile_id: string | null;
  capacity: number | null;
  country: string | null;
  state: string | null;
  phone: string | null;
  status: WarehouseStatus;
  created_at: string;
};

export type CashRegisterStatus = 'open' | 'closed';

export type DailyCashRegister = {
  id: string;
  org_id: string;
  warehouse_id: string;
  business_date: string;
  status: CashRegisterStatus;
  money_at_hand: number;
  money_in_purse: number;
  opening_balance: number;
  cash_sales: number | null;
  other_cash_income: number;
  cash_expenses: number;
  cash_withdrawals: number;
  expected_closing_balance: number | null;
  actual_cash_count: number | null;
  difference: number | null;
  notes: string | null;
  opened_by: string | null;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtorStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

// See Inventra/supabase/migrations/20260708120500_debtors_expenses.sql.
// amount_owed is maintained by the apply_debtor_payment() trigger whenever a
// debtor_payments row is inserted — never write it directly except at
// creation time.
export type Debtor = {
  id: string;
  org_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  amount_owed: number;
  due_date: string | null;
  status: DebtorStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtorPayment = {
  id: string;
  org_id: string;
  debtor_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_by: string | null;
};

export type Expense = {
  id: string;
  org_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  incurred_at: string;
  created_by: string | null;
  created_at: string;
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
  large_supply_threshold_amount: number | null;
};

export type SupplyStatus = 'pending' | 'received' | 'verified' | 'cancelled';

export type SupplyRecord = {
  id: string;
  org_id: string;
  reference_number: string;
  supplier_id: string | null;
  supplier_name: string;
  supplier_phone: string | null;
  supplier_email: string | null;
  invoice_number: string | null;
  warehouse_id: string;
  date_supplied: string;
  status: SupplyStatus;
  total_quantity: number;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplyRecordItem = {
  id: string;
  org_id: string;
  supply_record_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
};

// Platform-wide singleton config table, not org-scoped — mirrors
// Inventra/lib/queries/support-settings.ts's SupportSettings. Read via a
// plain authenticated-read RLS policy (support_settings_select_authenticated)
// rather than a service-role client the way web's root layout does it —
// mobile has no secure way to ship a service-role key in the app bundle.
export type SupportSettings = {
  id: string;
  whatsapp_number: string;
  whatsapp_message: string;
  business_hours: string;
  support_email: string;
  average_response: string;
  whatsapp_enabled: boolean;
  widget_enabled: boolean;
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

// Customer-facing invoices (customer_invoices table) — separate from
// Invoice/InvoiceStatus above, which is Paystack billing receipts. See
// Inventra/supabase/migrations/20260726114936_add_customer_invoices.sql.
export type CustomerInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export type CustomerInvoice = {
  id: string;
  org_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: CustomerInvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInvoiceItem = {
  id: string;
  org_id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
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
  member_status: MemberStatus | null;
};

// Return shape of the get_org_entitlements() RPC — see
// Inventra/supabase/migrations/20260726091940_freemium_premium_plans.sql.
// Mirrors Inventra/lib/entitlements.ts's Entitlements shape (snake_case
// here since this is the raw RPC row; src/lib/entitlements.ts maps it to
// camelCase, same split as every other RPC in this file).
export type OrgEntitlementsRpc = {
  org_id: string | null;
  tier: 'free' | 'premium';
  plan_key: string | null;
  status: string | null;
  product_count: number;
  sales_count: number;
  expense_count: number;
  invoice_count: number;
  product_limit: number;
  sales_limit: number;
  expense_limit: number;
  invoice_limit: number;
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

export type CategoryMixRow = {
  name: string;
  value: number;
  pct: number;
};

export type DailyProductProfitRow = {
  product_id: string;
  name: string;
  emoji: string | null;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type MonthlyRevenueProfitRow = {
  month: string;
  revenue: number;
  profit: number;
};

export type MonthlySalesVolumeRow = {
  month: string;
  count: number;
};

export type ExpenseCategory = 'rent' | 'salary' | 'transport' | 'utilities' | 'inventory_purchase' | 'logistics' | 'miscellaneous';

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
  supply_record_id: string | null;
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
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

// Read-only from mobile (src/lib/actions/mfa.ts's getRecoveryCodeCount) —
// RLS only allows a user to SELECT their own rows; generating/consuming
// codes needs the service-role key and goes through the bearer-token
// app/api/mobile/mfa/* routes instead, same split as Team's admin-API
// actions.
export type MfaRecoveryCode = {
  id: string;
  user_id: string;
  code_hash: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
};

// In-app notification feed — mirrors Inventra/lib/notifications-service.ts.
// Mobile both reads its own feed and inserts notifications for other org
// members directly (approve/reject in src/lib/actions/team.ts), same as
// audit_logs — RLS (notifications_insert_org) is the real gate, not a
// bearer-token route.
export type NotificationRow = {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

// Expo push token per device — src/lib/actions/notifications.ts registers
// this on launch (native only; see registerPushToken's Platform.OS guard).
export type PushToken = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: string;
};

// Admin-editable per-role permission overrides — see
// Inventra/supabase/migrations/20260719120000_role_permissions.sql.
export type RolePermissionRow = {
  id: string;
  org_id: string;
  role: 'manager' | 'cashier' | 'warehouse';
  module: string;
  action: string;
  allowed: boolean;
  updated_by: string | null;
  updated_at: string;
};

// See Inventra/supabase/migrations/20260722100000_approval_thresholds.sql.
export type ApprovalSettingsRow = {
  org_id: string;
  discount_approval_enabled: boolean;
  discount_threshold_pct: number;
  void_approval_enabled: boolean;
  void_threshold_amount: number;
  price_change_approval_enabled: boolean;
  price_change_threshold_pct: number;
  updated_at: string;
};

export type ApprovalRequestRow = {
  id: string;
  org_id: string;
  entity_type: 'discount' | 'void_sale' | 'price_change';
  entity_id: string | null;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: Record<string, unknown>;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  rejected_reason: string | null;
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
            | 'last_active_at'
          >
        >
      >;
      // Read-only from the mobile client — every write goes through the
      // bearer-token routes under Inventra's app/api/mobile/billing/, never
      // a direct table update, so `Update` is `never` here.
      subscriptions: TableDef<Subscription, never, never>;
      invoices: TableDef<Invoice, never, never>;
      // Read-only — see support_settings_select_authenticated RLS policy.
      support_settings: TableDef<SupportSettings, never, never>;

      products: TableDef<
        Product,
        Omit<Product, 'id' | 'status' | 'created_at' | 'updated_at'> & { id?: string },
        Partial<Omit<Product, 'id' | 'org_id' | 'status' | 'created_at' | 'updated_at'>>
      >;
      categories: TableDef<Category, Omit<Category, 'id'> & { id?: string }, Partial<Omit<Category, 'id' | 'org_id'>>>;
      suppliers: TableDef<
        Supplier,
        Omit<Supplier, 'id' | 'created_at' | 'company' | 'contact_person' | 'email' | 'phone' | 'address'> & {
          id?: string;
          company?: string | null;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
        },
        Partial<Omit<Supplier, 'id' | 'org_id' | 'created_at'>>
      >;
      warehouses: TableDef<
        Warehouse,
        Omit<Warehouse, 'id' | 'created_at' | 'status'> & { id?: string; status?: WarehouseStatus },
        Partial<Omit<Warehouse, 'id' | 'org_id' | 'created_at'>>
      >;
      daily_cash_registers: TableDef<
        DailyCashRegister,
        Pick<DailyCashRegister, 'org_id' | 'warehouse_id' | 'business_date' | 'money_at_hand' | 'money_in_purse' | 'opening_balance'> & {
          opened_by?: string | null;
        },
        Partial<Omit<DailyCashRegister, 'id' | 'org_id' | 'warehouse_id' | 'created_at'>>
      >;
      customers: TableDef<Customer, Omit<Customer, 'id' | 'created_at'> & { id?: string }, never>;
      debtors: TableDef<
        Debtor,
        Omit<Debtor, 'id' | 'created_at' | 'updated_at' | 'status' | 'created_by'> & {
          id?: string;
          status?: DebtorStatus;
          created_by?: string | null;
        },
        Partial<Pick<Debtor, 'customer_name' | 'phone' | 'email' | 'notes' | 'amount_owed' | 'due_date' | 'status'>>
      >;
      debtor_payments: TableDef<
        DebtorPayment,
        Omit<DebtorPayment, 'id' | 'paid_at' | 'created_by'> & { id?: string; paid_at?: string; created_by?: string | null },
        never
      >;
      customer_invoices: TableDef<
        CustomerInvoice,
        Omit<CustomerInvoice, 'id' | 'status' | 'created_at' | 'updated_at' | 'created_by'> & {
          id?: string;
          status?: CustomerInvoiceStatus;
          created_by?: string | null;
        },
        Partial<Pick<CustomerInvoice, 'status'>>
      >;
      customer_invoice_items: TableDef<
        CustomerInvoiceItem,
        Omit<CustomerInvoiceItem, 'id'> & { id?: string },
        never
      >;
      expenses: TableDef<
        Expense,
        Omit<Expense, 'id' | 'created_at' | 'created_by'> & { id?: string; created_by?: string | null },
        Partial<Omit<Expense, 'id' | 'org_id' | 'created_at' | 'created_by'>>
      >;
      // supply_record_id is optional on insert — every existing call site
      // (adjustments, product creation, warehouse open-stock, sales) never
      // sets it, since it's only ever written by the
      // apply_supply_record_status_change() DB trigger, not app code.
      stock_movements: TableDef<
        StockMovement,
        Omit<StockMovement, 'id' | 'created_at' | 'supply_record_id'> & { id?: string; supply_record_id?: string | null },
        never
      >;
      sales: TableDef<Sale, Omit<Sale, 'id' | 'created_at'> & { id?: string }, Partial<Pick<Sale, 'notes'>>>;
      sale_payments: TableDef<SalePayment, Omit<SalePayment, 'id'> & { id?: string }, Partial<Pick<SalePayment, 'method'>>>;
      // actor_id has no DB default (unlike created_by-style columns
      // elsewhere with a trigger) — the RLS insert policy requires it to be
      // explicitly set to auth.uid(), so it must stay in the Insert shape.
      audit_logs: TableDef<
        AuditLog,
        Omit<AuditLog, 'id' | 'created_at' | 'previous_value'> & { id?: string; previous_value?: Record<string, unknown> | null },
        never
      >;
      notification_settings: TableDef<NotificationSettings, never, Partial<Omit<NotificationSettings, 'org_id'>>>;
      print_settings: TableDef<PrintSettings, never, Partial<Omit<PrintSettings, 'org_id'>>>;
      mfa_recovery_codes: TableDef<MfaRecoveryCode, never, never>;
      notifications: TableDef<
        NotificationRow,
        Omit<NotificationRow, 'id' | 'created_at' | 'read_at'> & { id?: string },
        Partial<Pick<NotificationRow, 'read_at'>>
      >;
      push_tokens: TableDef<PushToken, Omit<PushToken, 'id' | 'created_at'> & { id?: string }, never>;
      role_permissions: TableDef<
        RolePermissionRow,
        Omit<RolePermissionRow, 'id' | 'updated_at'> & { id?: string; updated_at?: string },
        Partial<Pick<RolePermissionRow, 'allowed' | 'updated_by' | 'updated_at'>>
      >;
      approval_settings: TableDef<ApprovalSettingsRow, never, Partial<Omit<ApprovalSettingsRow, 'org_id'>>>;
      approval_requests: TableDef<
        ApprovalRequestRow,
        Omit<ApprovalRequestRow, 'id' | 'requested_at' | 'status' | 'decided_by' | 'decided_at' | 'rejected_reason'> & {
          id?: string;
        },
        Partial<Pick<ApprovalRequestRow, 'status' | 'entity_id' | 'decided_by' | 'decided_at' | 'rejected_reason'>>
      >;
      supply_records: TableDef<
        SupplyRecord,
        Omit<SupplyRecord, 'id' | 'status' | 'verified_by' | 'verified_at' | 'cancelled_by' | 'cancelled_at' | 'deleted_at' | 'created_at' | 'updated_at'> & {
          id?: string;
          status?: SupplyStatus;
        },
        Partial<
          Pick<
            SupplyRecord,
            | 'supplier_id'
            | 'supplier_name'
            | 'supplier_phone'
            | 'supplier_email'
            | 'invoice_number'
            | 'warehouse_id'
            | 'date_supplied'
            | 'total_quantity'
            | 'total_amount'
            | 'notes'
            | 'status'
            | 'verified_by'
            | 'verified_at'
            | 'cancelled_by'
            | 'cancelled_at'
            | 'deleted_at'
          >
        >
      >;
      supply_record_items: TableDef<SupplyRecordItem, Omit<SupplyRecordItem, 'id' | 'created_at'> & { id?: string }, never>;
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
      get_category_mix: {
        Args: Record<string, never>;
        Returns: CategoryMixRow[];
      };
      get_daily_product_profit: {
        Args: Record<string, never>;
        Returns: DailyProductProfitRow[];
      };
      get_monthly_revenue_profit: {
        Args: Record<string, never>;
        Returns: MonthlyRevenueProfitRow[];
      };
      get_monthly_sales_volume: {
        Args: Record<string, never>;
        Returns: MonthlySalesVolumeRow[];
      };
      get_category_product_counts: {
        Args: Record<string, never>;
        Returns: { category_id: string; count: number }[];
      };
      get_supplier_product_counts: {
        Args: Record<string, never>;
        Returns: { supplier_id: string; count: number }[];
      };
      get_warehouse_stock_summary: {
        Args: Record<string, never>;
        Returns: { warehouse_id: string; sku_count: number; stock_value: number; total_units: number }[];
      };
      get_debtor_payments_total: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_org_entitlements: {
        Args: Record<string, never>;
        Returns: OrgEntitlementsRpc;
      };
      org_is_premium: {
        Args: { p_org_id?: string };
        Returns: boolean;
      };
      free_plan_limit: {
        Args: { p_metric: string };
        Returns: number;
      };
      search_products: {
        Args: {
          p_search?: string | null;
          p_category_id?: string | null;
          p_warehouse_id?: string | null;
          p_supplier_id?: string | null;
          p_status?: string | null;
          p_active?: boolean | null;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_min_margin_pct?: number | null;
          p_max_margin_pct?: number | null;
          p_expiry_from?: string | null;
          p_expiry_to?: string | null;
          p_created_from?: string | null;
          p_created_to?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          sku: string;
          barcode: string | null;
          name: string;
          brand: string | null;
          emoji: string | null;
          image_url: string | null;
          sell_price: number;
          qty_on_hand: number;
          status: string;
          is_active: boolean;
          warehouse_id: string | null;
          category_name: string | null;
          total_count: number;
        }[];
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
      has_permission: {
        Args: { p_module: string; p_action: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
