export type AmountMode = "FIXED" | "RANGE" | "OPEN";
export type CustomFieldType = "TEXT" | "NUMBER" | "DROPDOWN" | "DATE" | "CHECKBOX";
export type PaymentMethod = "CARD" | "WALLET" | "ACH";
export type TransactionStatus = "SUCCESS" | "FAILED" | "PENDING";
export type AppRole = "ADMIN" | "BUSINESS" | "CUSTOMER";
export type PortalRole = "ADMIN" | "BUSINESS";
export type CouponType = "PERCENT" | "FIXED";

export interface SavedCustomerProfile {
  payer_name: string;
  billing_zip?: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: AppRole;
  business_id?: string | null;
  business_name?: string | null;
  saved_profile?: SavedCustomerProfile | null;
}

export type PortalUser = SessionUser & {
  role: PortalRole;
};

export type CustomerUser = SessionUser & {
  role: "CUSTOMER";
  saved_profile?: SavedCustomerProfile | null;
};

export type AdminUser = PortalUser;

export interface CouponCode {
  id: string;
  code: string;
  description?: string | null;
  type: CouponType;
  percent_off?: number | null;
  amount_off_cents?: number | null;
  minimum_amount_cents?: number | null;
  is_active: boolean;
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  is_required: boolean;
  placeholder?: string | null;
  helper_text?: string | null;
  sort_order: number;
}

export interface GLCode {
  id: string;
  code: string;
  label?: string | null;
  sort_order: number;
}

export interface PaymentPage {
  id: string;
  slug: string;
  business_id?: string | null;
  business_name?: string | null;
  organization_name: string;
  title: string;
  subtitle?: string | null;
  header_message?: string | null;
  footer_message?: string | null;
  logo_url?: string | null;
  support_email?: string | null;
  brand_color: string;
  amount_mode: AmountMode;
  fixed_amount_cents?: number | null;
  min_amount_cents?: number | null;
  max_amount_cents?: number | null;
  email_template?: string | null;
  is_active: boolean;
  custom_fields: CustomField[];
  gl_codes: GLCode[];
  coupon_codes?: CouponCode[];
  accepts_coupons: boolean;
  public_url: string;
  iframe_snippet: string;
  created_at?: string | null;
  updated_at?: string | null;
  transaction_count?: number;
  total_amount_cents?: number;
}

export interface TransactionFieldResponse {
  field_id: string;
  field_key: string;
  field_label: string;
  value: string | boolean | number | null;
}

export interface Transaction {
  id: string;
  public_id: string;
  page_id: string;
  page_slug: string;
  page_title: string;
  business_id?: string | null;
  business_name?: string | null;
  customer_id?: string | null;
  payer_name: string;
  payer_email: string;
  amount_cents: number;
  amount_display: string;
  original_amount_cents: number;
  original_amount_display: string;
  discount_amount_cents: number;
  discount_amount_display: string;
  coupon_code?: string | null;
  coupon_description?: string | null;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  billing_zip?: string | null;
  processor_reference?: string | null;
  processor_mode: string;
  processor_message?: string | null;
  failure_reason?: string | null;
  remember_payer: boolean;
  gl_codes_snapshot: string[];
  field_responses: TransactionFieldResponse[];
  created_at: string;
  updated_at?: string | null;
}

export interface ReportSummary {
  transaction_count: number;
  total_amount_cents: number;
  average_amount_cents: number;
  gl_breakdown: Record<string, number>;
  payment_method_breakdown: Record<string, number>;
}

export interface EmailLog {
  id: string;
  page_id: string;
  business_id?: string | null;
  business_name?: string | null;
  transaction_id?: string | null;
  to_email: string;
  subject: string;
  body_html: string;
  delivery_mode: string;
  status: string;
  created_at: string;
}

export interface Session<TUser extends SessionUser = SessionUser> {
  token: string;
  user: TUser;
}

export type AdminSession = Session<PortalUser>;

export type CustomerSession = Session<CustomerUser>;

export interface CustomerDashboardSummary {
  transaction_count: number;
  successful_payment_count: number;
  total_spend_cents: number;
}

export interface CustomerDashboard {
  profile: SavedCustomerProfile;
  summary: CustomerDashboardSummary;
  transactions: Transaction[];
}

export interface RememberedPayerDetails {
  payer_name: string;
  payer_email: string;
  billing_zip?: string;
  custom_field_values: Record<string, string | boolean>;
}
