"use client";

import type {
  AdminSession,
  CustomerDashboard,
  CustomerSession,
  EmailLog,
  PaymentPage,
  PortalRole,
  ReportSummary,
  RememberedPayerDetails,
  Session,
  SessionUser,
  Transaction,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const SESSION_STORAGE_KEYS = {
  portal: "qpp-portal-session",
  customer: "qpp-customer-session",
} as const;
const REMEMBERED_PAYER_PREFIX = "qpp-payer-memory";

export type SessionKind = keyof typeof SESSION_STORAGE_KEYS;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  sessionKind?: SessionKind;
};

type CustomerRegistrationPayload = {
  name: string;
  email: string;
  password: string;
  billing_zip?: string;
};

type CustomerProfilePayload = {
  payer_name: string;
  billing_zip?: string;
};

function formatApiError(data: unknown) {
  if (!data || typeof data !== "object") {
    return "Request failed.";
  }

  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const typedItem = item as { loc?: unknown; msg?: unknown };
        const msg = typeof typedItem.msg === "string" ? typedItem.msg : null;
        const loc = Array.isArray(typedItem.loc)
          ? typedItem.loc
              .filter((part) => typeof part === "string" || typeof part === "number")
              .slice(1)
              .join(".")
          : "";

        if (!msg) {
          return null;
        }

        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length) {
      return messages.join("; ");
    }
  }

  return "Request failed.";
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(formatApiError(data));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getStoredSession<TUser extends SessionUser = SessionUser>(
  kind: SessionKind = "portal",
): Session<TUser> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEYS[kind]);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Session<TUser>;
  } catch {
    return null;
  }
}

export function setStoredSession(kind: SessionKind, session: Session) {
  window.localStorage.setItem(SESSION_STORAGE_KEYS[kind], JSON.stringify(session));
}

export function clearStoredSession(kind: SessionKind) {
  window.localStorage.removeItem(SESSION_STORAGE_KEYS[kind]);
}

export function getRememberedPayer(slug: string): RememberedPayerDetails | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(`${REMEMBERED_PAYER_PREFIX}:${slug}`);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as RememberedPayerDetails;
  } catch {
    return null;
  }
}

export function saveRememberedPayer(slug: string, details: RememberedPayerDetails) {
  window.localStorage.setItem(
    `${REMEMBERED_PAYER_PREFIX}:${slug}`,
    JSON.stringify(details),
  );
}

export function clearRememberedPayer(slug: string) {
  window.localStorage.removeItem(`${REMEMBERED_PAYER_PREFIX}:${slug}`);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const session =
    options.auth === false
      ? null
      : getStoredSession(options.sessionKind ?? "portal");
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return parseResponse<T>(response);
}

export async function loginPortal(email: string, password: string, expectedRole: PortalRole) {
  return apiRequest<{ token: string; user: AdminSession["user"] }>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password, expected_role: expectedRole },
  });
}

export async function getCurrentPortalUser() {
  return apiRequest<{ user: AdminSession["user"] }>("/auth/me", {
    sessionKind: "portal",
  });
}

export async function loginCustomer(email: string, password: string) {
  return apiRequest<{ token: string; user: CustomerSession["user"] }>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password, expected_role: "CUSTOMER" },
  });
}

export async function registerCustomer(payload: CustomerRegistrationPayload) {
  return apiRequest<{ token: string; user: CustomerSession["user"] }>("/auth/customer/register", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getCurrentCustomer() {
  return apiRequest<{ user: CustomerSession["user"] }>("/auth/me", {
    sessionKind: "customer",
  });
}

export async function loginWithGoogle(
  code: string,
  redirectUri: string,
  expectedRole?: string,
) {
  return apiRequest<{ token: string; user: AdminSession["user"] | CustomerSession["user"] }>(
    "/auth/oauth/google",
    {
      method: "POST",
      auth: false,
      body: { code, redirect_uri: redirectUri, expected_role: expectedRole },
    },
  );
}

export async function getCustomerDashboard() {
  return apiRequest<{ item: CustomerDashboard }>("/customers/me/dashboard", {
    sessionKind: "customer",
  });
}

export async function updateCustomerProfile(payload: CustomerProfilePayload) {
  return apiRequest<{ user: CustomerSession["user"] }>("/customers/me/profile", {
    method: "PUT",
    sessionKind: "customer",
    body: payload,
  });
}

export async function getPaymentPages() {
  return apiRequest<{ items: PaymentPage[] }>("/payment-pages", {
    sessionKind: "portal",
  });
}

export async function getPaymentPage(pageId: string) {
  return apiRequest<{ item: PaymentPage }>(`/payment-pages/${pageId}`, {
    sessionKind: "portal",
  });
}

export async function createPaymentPage(payload: Partial<PaymentPage>) {
  return apiRequest<{ item: PaymentPage }>("/payment-pages", {
    method: "POST",
    sessionKind: "portal",
    body: payload,
  });
}

export async function updatePaymentPage(pageId: string, payload: Partial<PaymentPage>) {
  return apiRequest<{ item: PaymentPage }>(`/payment-pages/${pageId}`, {
    method: "PUT",
    sessionKind: "portal",
    body: payload,
  });
}

export async function getPublicPaymentPage(slug: string) {
  return apiRequest<{ item: PaymentPage }>(`/public/payment-pages/${slug}`, {
    auth: false,
  });
}

export async function submitPayment(slug: string, payload: Record<string, unknown>) {
  return apiRequest<{ item: { public_id: string; status: string; message: string } }>(
    `/public/payment-pages/${slug}/payments`,
    {
      method: "POST",
      sessionKind: "customer",
      body: payload,
    },
  );
}

export async function getPublicTransaction(publicId: string) {
  return apiRequest<{ item: Transaction }>(`/public/transactions/${publicId}`, {
    auth: false,
  });
}

export async function getTransactions(queryString = "") {
  return apiRequest<{ items: Transaction[] }>(`/reports/transactions${queryString}`, {
    sessionKind: "portal",
  });
}

export async function getReportSummary(queryString = "") {
  return apiRequest<{ item: ReportSummary }>(`/reports/summary${queryString}`, {
    sessionKind: "portal",
  });
}

export async function getEmailLogs() {
  return apiRequest<{ items: EmailLog[] }>("/reports/email-logs", {
    sessionKind: "portal",
  });
}

export async function downloadTransactionsCsv(queryString = "") {
  const session = getStoredSession("portal");
  if (!session) {
    throw new Error("You need to sign in again.");
  }

  const response = await fetch(`${API_BASE_URL}/reports/export.csv${queryString}`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (!response.ok) {
    throw new Error("CSV export failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
}
