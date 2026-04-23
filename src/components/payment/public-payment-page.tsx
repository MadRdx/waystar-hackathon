/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  clearRememberedPayer,
  clearStoredSession,
  getPublicPaymentPage,
  getRememberedPayer,
  getStoredSession,
  saveRememberedPayer,
  submitPayment,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { expiryIsValid, luhnIsValid, routingNumberIsValid } from "@/lib/validation";
import type { CustomerUser, PaymentMethod, PaymentPage } from "@/lib/types";

function detectWalletProvider() {
  if (typeof window === "undefined") {
    return { label: "Google Pay", provider: "google_pay" };
  }

  if ("ApplePaySession" in window) {
    return { label: "Apple Pay", provider: "apple_pay" };
  }

  if ("PaymentRequest" in window) {
    return { label: "Google Pay", provider: "google_pay" };
  }

  return { label: "PayPal", provider: "paypal" };
}

const walletOptions = [
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "paypal", label: "PayPal" },
  { value: "venmo", label: "Venmo" },
] as const;

type FormState = {
  payer_name: string;
  payer_email: string;
  amount_input: string;
  billing_zip: string;
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  wallet_provider: string;
  ach_routing_number: string;
  ach_account_number: string;
  ach_authorized: boolean;
  remember_payer: boolean;
  coupon_code: string;
  custom_field_values: Record<string, string | boolean>;
};

function createInitialFormState(): FormState {
  return {
    payer_name: "",
    payer_email: "",
    amount_input: "",
    billing_zip: "",
    card_number: "4242424242424242",
    expiry_month: "12",
    expiry_year: "30",
    cvv: "123",
    wallet_provider: "google_pay",
    ach_routing_number: "021000021",
    ach_account_number: "1234567890",
    ach_authorized: false,
    remember_payer: true,
    coupon_code: "",
    custom_field_values: {},
  };
}

export function PublicPaymentPage({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embed") === "1";

  const [page, setPage] = useState<PaymentPage | null>(null);
  const [form, setForm] = useState<FormState>(createInitialFormState());
  const [customerAccount, setCustomerAccount] = useState<CustomerUser | null>(
    () => getStoredSession<CustomerUser>("customer")?.user ?? null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletDetails = detectWalletProvider();

  useEffect(() => {
    let cancelled = false;
    const storedCustomer = getStoredSession<CustomerUser>("customer")?.user ?? null;

    getPublicPaymentPage(slug)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextPage = response.item;
        const remembered = getRememberedPayer(slug);
        setPage(nextPage);
        setForm((current) => ({
          ...current,
          amount_input:
            nextPage.amount_mode === "FIXED"
              ? String((nextPage.fixed_amount_cents ?? 0) / 100)
              : nextPage.amount_mode === "RANGE"
                ? String((nextPage.min_amount_cents ?? 0) / 100)
                : current.amount_input,
          payer_name:
            storedCustomer?.saved_profile?.payer_name ??
            remembered?.payer_name ??
            current.payer_name,
          payer_email: storedCustomer?.email ?? remembered?.payer_email ?? current.payer_email,
          billing_zip:
            storedCustomer?.saved_profile?.billing_zip ??
            remembered?.billing_zip ??
            current.billing_zip,
          wallet_provider: walletDetails.provider,
          custom_field_values: remembered?.custom_field_values ?? current.custom_field_values,
        }));
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load the payment page.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, walletDetails.provider]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="rounded-[1.8rem] border border-line bg-card px-8 py-7 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Loading payment page
          </p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="rounded-[1.8rem] border border-red-200 bg-red-50 px-8 py-7 text-center text-sm text-red-700">
          {error ?? "This payment page could not be found."}
        </div>
      </div>
    );
  }

  const amountHint =
    page.amount_mode === "FIXED"
      ? formatCurrency(page.fixed_amount_cents ?? 0)
      : page.amount_mode === "RANGE"
        ? `${formatCurrency(page.min_amount_cents ?? 0)} to ${formatCurrency(
            page.max_amount_cents ?? 0,
          )}`
        : "Enter the amount you would like to pay.";

  const cardNumberLooksValid =
    form.card_number.replace(/\D/g, "").length < 13 || luhnIsValid(form.card_number);
  const achRoutingLooksValid =
    form.ach_routing_number.replace(/\D/g, "").length < 9 ||
    routingNumberIsValid(form.ach_routing_number);
  const expiryLooksValid =
    !form.expiry_month ||
    !form.expiry_year ||
    expiryIsValid(Number(form.expiry_month), Number(form.expiry_year));

  async function handleSubmit() {
    if (!page) {
      return;
    }

    const currentPage = page;
    setSubmitting(true);
    setError(null);

    try {
      const amountCents =
        currentPage.amount_mode === "FIXED"
          ? currentPage.fixed_amount_cents ?? 0
          : Math.round(Number(form.amount_input || "0") * 100);

      const response = await submitPayment(slug, {
        payer_name: form.payer_name,
        payer_email: form.payer_email,
        amount_cents: amountCents,
        payment_method: paymentMethod,
        billing_zip: paymentMethod === "CARD" ? form.billing_zip : undefined,
        card_number: paymentMethod === "CARD" ? form.card_number : undefined,
        expiry_month: paymentMethod === "CARD" ? Number(form.expiry_month) : undefined,
        expiry_year: paymentMethod === "CARD" ? Number(form.expiry_year) : undefined,
        cvv: paymentMethod === "CARD" ? form.cvv : undefined,
        wallet_provider: paymentMethod === "WALLET" ? form.wallet_provider : undefined,
        ach_routing_number:
          paymentMethod === "ACH" ? form.ach_routing_number : undefined,
        ach_account_number:
          paymentMethod === "ACH" ? form.ach_account_number : undefined,
        ach_authorized: paymentMethod === "ACH" ? form.ach_authorized : false,
        remember_payer: form.remember_payer,
        coupon_code: form.coupon_code || undefined,
        custom_field_values: form.custom_field_values,
      });

      if (form.remember_payer) {
        saveRememberedPayer(slug, {
          payer_name: form.payer_name,
          payer_email: form.payer_email,
          billing_zip: form.billing_zip,
          custom_field_values: form.custom_field_values,
        });
      } else {
        clearRememberedPayer(slug);
      }

      router.push(`/pay/${slug}/success?transaction=${response.item.public_id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t complete the sandbox payment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={clsx("min-h-screen px-4 py-4 lg:px-6", isEmbedded && "p-0")}>
      <div
        className={clsx(
          "mx-auto grid max-w-7xl gap-4",
          isEmbedded ? "max-w-none xl:grid-cols-[1.2fr_0.8fr]" : "xl:grid-cols-[1.15fr_0.85fr]",
        )}
      >
        <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)] lg:p-8">
          {!isEmbedded ? (
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="font-mono text-xs uppercase tracking-[0.28em] text-muted hover:text-brand"
              >
                Quick Payment Pages
              </Link>
              <span className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-muted">
                Sandbox mode
              </span>
            </div>
          ) : null}

          <div
            className="mt-6 h-2 w-full rounded-full"
            style={{ backgroundColor: page.brand_color }}
          />

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
            {page.logo_url ? (
              <img
                src={page.logo_url}
                alt={`${page.organization_name} logo`}
                className="h-16 w-16 rounded-[1.4rem] border border-line object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-background text-sm font-semibold text-muted">
                Logo
              </div>
            )}

            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                {page.organization_name}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {page.title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted">{page.subtitle}</p>
            </div>
          </div>

          {page.header_message ? (
            <div className="mt-6 rounded-[1.6rem] border border-line bg-white/75 px-5 py-4 text-sm leading-7 text-muted">
              {page.header_message}
            </div>
          ) : null}

          <div className="mt-6 rounded-[1.6rem] border border-line bg-white/75 px-5 py-4">
            {customerAccount ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Signed in as {customerAccount.name || customerAccount.email}
                  </p>
                  <p className="mt-1 text-sm leading-7 text-muted">
                    Your customer profile can prefill payer details and link this payment to your dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/customer"
                    className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                  >
                    Open Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      clearStoredSession("customer");
                      setCustomerAccount(null);
                    }}
                    className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Want faster repeat payments?
                  </p>
                  <p className="mt-1 text-sm leading-7 text-muted">
                    Customer accounts are optional. Guest checkout still works, but signing in lets you reuse saved payer details and track past receipts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/customer/login?next=${encodeURIComponent(`/pay/${slug}`)}`}
                    className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
                  >
                    Customer Login
                  </Link>
                  <Link
                    href={`/customer/register?next=${encodeURIComponent(`/pay/${slug}`)}`}
                    className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Payer Name</span>
              <input
                value={form.payer_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, payer_name: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Email Address</span>
              <input
                type="email"
                value={form.payer_email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, payer_email: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
              />
            </label>

            <label className={clsx("space-y-2", page.accepts_coupons ? "" : "lg:col-span-2")}>
              <span className="text-sm font-medium text-foreground">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={page.amount_mode === "FIXED"}
                value={form.amount_input}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount_input: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 disabled:bg-background/60"
                aria-describedby="amount-help"
              />
              <p id="amount-help" className="text-sm leading-7 text-muted">
                {amountHint}
              </p>
            </label>

            {page.accepts_coupons ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Coupon Code</span>
                <input
                  value={form.coupon_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      coupon_code: event.target.value.toUpperCase().replace(/\s+/g, ""),
                    }))
                  }
                  placeholder="SAVE10"
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
                <p className="text-sm leading-7 text-muted">
                  Enter a valid coupon for this business to apply your discount during checkout.
                </p>
              </label>
            ) : null}
          </div>

          <div className="mt-8 space-y-4">
            {page.custom_fields
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {field.label}
                    {field.is_required ? " *" : ""}
                  </label>
                  {field.type === "TEXT" || field.type === "NUMBER" || field.type === "DATE" ? (
                    <input
                      type={
                        field.type === "NUMBER"
                          ? "number"
                          : field.type === "DATE"
                            ? "date"
                            : "text"
                      }
                      value={String(form.custom_field_values[field.key] ?? "")}
                      placeholder={field.placeholder ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          custom_field_values: {
                            ...current.custom_field_values,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                    />
                  ) : null}

                  {field.type === "DROPDOWN" ? (
                    <select
                      value={String(form.custom_field_values[field.key] ?? "")}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          custom_field_values: {
                            ...current.custom_field_values,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                    >
                      <option value="">Select an option</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {field.type === "CHECKBOX" ? (
                    <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(form.custom_field_values[field.key])}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            custom_field_values: {
                              ...current.custom_field_values,
                              [field.key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span className="text-sm text-foreground">
                        {field.helper_text || field.label}
                      </span>
                    </label>
                  ) : null}

                  {field.helper_text && field.type !== "CHECKBOX" ? (
                    <p className="text-sm leading-7 text-muted">{field.helper_text}</p>
                  ) : null}
                </div>
              ))}
          </div>

          <div className="mt-10">
            <p className="text-sm font-medium text-foreground">Payment Method</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(["CARD", "WALLET", "ACH"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm font-semibold",
                    paymentMethod === method
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-white text-foreground hover:border-brand hover:text-brand",
                  )}
                >
                  {method === "ACH" ? "ACH / Bank" : method === "WALLET" ? "Wallet" : "Card"}
                </button>
              ))}
            </div>

            {paymentMethod === "CARD" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-foreground">Card Number</span>
                  <input
                    value={form.card_number}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, card_number: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                    aria-describedby="card-help"
                  />
                  <p
                    id="card-help"
                    className={clsx(
                      "text-sm leading-7",
                      cardNumberLooksValid ? "text-muted" : "text-red-600",
                    )}
                  >
                    {cardNumberLooksValid
                      ? "Use test card 4242 4242 4242 4242 for a success flow."
                      : "The card number does not pass Luhn validation."}
                  </p>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Expiration Month</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={form.expiry_month}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, expiry_month: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Expiration Year</span>
                  <input
                    type="number"
                    min="24"
                    value={form.expiry_year}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, expiry_year: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                  {!expiryLooksValid ? (
                    <p className="text-sm text-red-600">Expiration must be in the future.</p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">CVV</span>
                  <input
                    value={form.cvv}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cvv: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Billing ZIP</span>
                  <input
                    value={form.billing_zip}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, billing_zip: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
              </div>
            ) : null}

            {paymentMethod === "WALLET" ? (
              <div className="mt-5 rounded-[1.6rem] border border-line bg-white/75 p-5">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Wallet Provider</span>
                    <select
                      value={form.wallet_provider}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          wallet_provider: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                    >
                      {walletOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {walletDetails.label} was auto-detected for this browser.
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted">
                      The sandbox wallet flow can simulate Apple Pay, Google Pay, PayPal, or Venmo selection without collecting card details directly in this form.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {paymentMethod === "ACH" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Routing Number</span>
                  <input
                    value={form.ach_routing_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ach_routing_number: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                  {!achRoutingLooksValid ? (
                    <p className="text-sm text-red-600">
                      Routing number checksum is invalid.
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Account Number</span>
                  <input
                    value={form.ach_account_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ach_account_number: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
                <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-line bg-white px-4 py-4">
                  <input
                    type="checkbox"
                    checked={form.ach_authorized}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ach_authorized: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm leading-7 text-muted">
                    I authorize this organization to debit my bank account for the amount entered today. ACH payments may take 2-3 business days to settle under NACHA processing timelines.
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="mt-8 rounded-[1.6rem] border border-line bg-white/75 p-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.remember_payer}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    remember_payer: event.target.checked,
                  }))
                }
              />
              <span className="text-sm leading-7 text-muted">
                Remember my payer details on this device for faster repeat payments.
                This is the built-in Quick RePay differentiator for recurring or long-lived payment pages.
              </span>
            </label>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-4 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Processing sandbox payment..." : "Submit Payment"}
          </button>

          {page.footer_message ? (
            <p className="mt-5 text-sm leading-7 text-muted">{page.footer_message}</p>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              What Happens Next
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-line bg-white/75 p-4">
                <p className="text-sm font-semibold text-foreground">1. Payment confirmation</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Successful card and wallet payments generate an immediate confirmation message and receipt email.
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-white/75 p-4">
                <p className="text-sm font-semibold text-foreground">2. GL code tracking</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  This page records the following GL codes with each transaction:{" "}
                  {page.gl_codes.map((item) => item.code).join(", ")}.
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-white/75 p-4">
                <p className="text-sm font-semibold text-foreground">3. Support follow-up</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Need help? Contact {page.support_email || "the provider team"} after payment if anything looks off.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Accepted Methods
            </p>
            <div className="mt-5 space-y-3">
              <MethodRow title="Card" detail="Visa, Mastercard, and AmEx test cards supported." />
              <MethodRow
                title="Wallets"
                detail="Apple Pay, Google Pay, PayPal, and Venmo can be simulated in sandbox mode."
              />
              <MethodRow title="ACH" detail="Bank transfers settle in 2-3 business days." />
            </div>
          </section>

          {page.accepts_coupons ? (
            <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
                Discount Support
              </p>
              <div className="mt-5 rounded-3xl border border-line bg-white/75 p-4">
                <p className="text-sm font-semibold text-foreground">Coupons are enabled</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  If your business shared a coupon code with you, enter it before submitting payment to receive the page-specific discount.
                </p>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function MethodRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-7 text-muted">{detail}</p>
    </div>
  );
}
