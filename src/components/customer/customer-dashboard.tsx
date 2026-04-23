"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  clearStoredSession,
  getCustomerDashboard,
  getStoredSession,
  setStoredSession,
  updateCustomerProfile,
} from "@/lib/api";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useCustomerSession } from "@/lib/use-customer-session";
import type { CustomerDashboard as CustomerDashboardData } from "@/lib/types";

export function CustomerDashboard() {
  const router = useRouter();
  const { loading, user } = useCustomerSession();
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [payerName, setPayerName] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    getCustomerDashboard()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setDashboard(response.item);
        setPayerName(response.item.profile.payer_name);
        setBillingZip(response.item.profile.billing_zip ?? "");
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your customer dashboard.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await updateCustomerProfile({
        payer_name: payerName,
        billing_zip: billingZip || undefined,
      });

      const session = getStoredSession("customer");
      if (session) {
        setStoredSession("customer", {
          token: session.token,
          user: response.user,
        });
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              profile: {
                payer_name: payerName,
                billing_zip: billingZip || undefined,
              },
            }
          : current,
      );
      setSuccess("Saved your customer profile.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update your customer profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || dashboardLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-8">
        <div className="rounded-[1.8rem] border border-line bg-card px-8 py-7 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Loading customer workspace
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-8">
        <div className="rounded-[1.8rem] border border-red-200 bg-red-50 px-8 py-7 text-center text-sm text-red-700">
          {error ?? "Unable to load your customer dashboard."}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-[2rem] border border-line bg-card p-8 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
                Customer Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                Welcome back, {dashboard.profile.payer_name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
                Your account keeps payer details ready for repeat checkout and links recent sandbox payments to a personal dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
              >
                Home
              </Link>
              <Link
                href="/pay/yoga-class"
                className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
              >
                Make a Payment
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearStoredSession("customer");
                  router.replace("/customer/login");
                }}
                className="inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.6rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[1.6rem] border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="Transactions"
            value={String(dashboard.summary.transaction_count)}
            note="Payments linked to your account"
          />
          <MetricCard
            label="Successful Payments"
            value={String(dashboard.summary.successful_payment_count)}
            note="Completed card, wallet, and ACH records"
          />
          <MetricCard
            label="Total Spend"
            value={formatCurrency(dashboard.summary.total_spend_cents)}
            note="Based on successful sandbox payments"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <h2 className="text-xl font-semibold text-foreground">Saved Profile</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              These values are used to prefill public payment pages when you are signed in.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSaveProfile}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Payer Name</span>
                <input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Billing ZIP</span>
                <input
                  value={billingZip}
                  onChange={(event) => setBillingZip(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <h2 className="text-xl font-semibold text-foreground">Recent Payments</h2>
            <div className="mt-5 space-y-4">
              {dashboard.transactions.length ? (
                dashboard.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-[1.6rem] border border-line bg-white/75 p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {transaction.page_title}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {transaction.public_id} • {formatDateTime(transaction.created_at)}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-muted">
                          {titleCase(transaction.payment_method)} • {titleCase(transaction.status)}
                        </p>
                        {transaction.coupon_code ? (
                          <p className="mt-2 text-sm text-brand">
                            Coupon {transaction.coupon_code} saved{" "}
                            {formatCurrency(transaction.discount_amount_cents)}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-xl font-semibold text-foreground">
                          {transaction.amount_display}
                        </p>
                        {transaction.discount_amount_cents > 0 ? (
                          <p className="mt-1 text-sm text-muted">
                            from {transaction.original_amount_display}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">
                  No customer-linked payments yet. Make your first payment from one of the public pages while signed in.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-3 text-sm leading-7 text-muted">{note}</p>
    </div>
  );
}
