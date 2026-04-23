"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getEmailLogs, getPaymentPages, getReportSummary } from "@/lib/api";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import type { EmailLog, PaymentPage, ReportSummary } from "@/lib/types";

export function AdminDashboard() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/business") ? "/business" : "/admin";
  const [pages, setPages] = useState<PaymentPage[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getPaymentPages(), getReportSummary(), getEmailLogs()])
      .then(([pagesResponse, summaryResponse, logResponse]) => {
        if (cancelled) {
          return;
        }
        setPages(pagesResponse.items);
        setSummary(summaryResponse.item);
        setLogs(logResponse.items.slice(0, 5));
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load dashboard data.",
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
  }, []);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-line bg-card px-6 py-10 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Loading dashboard
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-[1.6rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard
          label="Configured Pages"
          value={String(pages.length)}
          note="Includes active and disabled URLs"
        />
        <StatCard
          label="Transactions"
          value={String(summary?.transaction_count ?? 0)}
          note="All visible transaction records"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(summary?.total_amount_cents ?? 0)}
          note="Successful payments only"
        />
        <StatCard
          label="Average Ticket"
          value={formatCurrency(summary?.average_amount_cents ?? 0)}
          note="Average successful payment amount"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
                Payment Pages
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">
                Configured URLs and status
              </h3>
            </div>
            <Link
              href={`${basePath}/pages/new`}
              className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Create a New Page
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="rounded-[1.6rem] border border-line bg-white/75 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-semibold text-foreground">{page.title}</h4>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          page.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {page.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-muted">{page.public_url}</p>
                    <p className="text-sm leading-7 text-muted">
                      {page.transaction_count ?? 0} transactions,{" "}
                      {formatCurrency(page.total_amount_cents ?? 0)} collected
                    </p>
                    {page.business_name ? (
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">
                        {page.business_name}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`${basePath}/pages/${page.id}`}
                      className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                    >
                      Edit
                    </Link>
                    <Link
                      href={page.public_url}
                      target="_blank"
                      className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                    >
                      Open
                    </Link>
                    {page.accepts_coupons ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        Coupons enabled
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Payment Mix
            </p>
            <div className="mt-5 space-y-4">
              {Object.entries(summary?.payment_method_breakdown ?? {}).length ? (
                Object.entries(summary?.payment_method_breakdown ?? {}).map(([method, count]) => (
                  <div key={method} className="rounded-3xl border border-line bg-white/70 p-4">
                    <p className="text-sm font-semibold text-foreground">{titleCase(method)}</p>
                    <p className="mt-2 text-2xl font-semibold text-brand">{count}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No transactions yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Confirmation Outbox
            </p>
            <div className="mt-5 space-y-4">
              {logs.length ? (
                logs.map((log) => (
                  <div key={log.id} className="rounded-3xl border border-line bg-white/70 p-4">
                    <p className="text-sm font-semibold text-foreground">{log.subject}</p>
                    <p className="mt-1 text-sm text-muted">{log.to_email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                      {log.delivery_mode} • {log.status} • {formatDateTime(log.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No email logs yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
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
