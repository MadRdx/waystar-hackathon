"use client";

import { useEffect, useState } from "react";

import {
  downloadTransactionsCsv,
  getEmailLogs,
  getPaymentPages,
  getReportSummary,
  getTransactions,
} from "@/lib/api";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import type { EmailLog, PaymentPage, ReportSummary, Transaction } from "@/lib/types";

function buildQueryString(filters: {
  page_id: string;
  status: string;
  date_from: string;
  date_to: string;
}) {
  const params = new URLSearchParams();
  if (filters.page_id) params.set("page_id", filters.page_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ReportingDashboard() {
  const [pages, setPages] = useState<PaymentPage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [filters, setFilters] = useState({
    page_id: "",
    status: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function updateFilters(
    patch: Partial<{
      page_id: string;
      status: string;
      date_from: string;
      date_to: string;
    }>,
  ) {
    setLoading(true);
    setError(null);
    setFilters((current) => ({ ...current, ...patch }));
  }

  useEffect(() => {
    getPaymentPages()
      .then((response) => setPages(response.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const queryString = buildQueryString(filters);

    Promise.all([getTransactions(queryString), getReportSummary(queryString), getEmailLogs()])
      .then(([transactionResponse, summaryResponse, logResponse]) => {
        if (cancelled) {
          return;
        }
        setTransactions(transactionResponse.items);
        setSummary(summaryResponse.item);
        setLogs(logResponse.items.slice(0, 8));
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load reporting data.",
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
  }, [filters]);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Reporting
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">
              Filter, summarize, and export payment activity
            </h3>
          </div>
          <button
            type="button"
            onClick={() => downloadTransactionsCsv(buildQueryString(filters))}
            className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            Export Current View
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Payment Page</span>
            <select
              value={filters.page_id}
              onChange={(event) => updateFilters({ page_id: event.target.value })}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            >
              <option value="">All pages</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value })}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Date From</span>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => updateFilters({ date_from: event.target.value })}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Date To</span>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => updateFilters({ date_to: event.target.value })}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.6rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Transactions"
          value={String(summary?.transaction_count ?? 0)}
          note="Matches the active filters"
        />
        <MetricCard
          label="Collected"
          value={formatCurrency(summary?.total_amount_cents ?? 0)}
          note="Successful payments only"
        />
        <MetricCard
          label="Average Payment"
          value={formatCurrency(summary?.average_amount_cents ?? 0)}
          note="Successful payment average"
        />
        <MetricCard
          label="Email Logs"
          value={String(logs.length)}
          note="Recent confirmation activity"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-semibold text-foreground">Transactions</h4>
            {loading ? <span className="text-sm text-muted">Refreshing...</span> : null}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">Transaction</th>
                  <th className="px-3 py-3 font-medium">Business</th>
                  <th className="px-3 py-3 font-medium">Page</th>
                  <th className="px-3 py-3 font-medium">Payer</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Coupon</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-line/70">
                    <td className="px-3 py-4 font-mono text-xs text-foreground">
                      {transaction.public_id}
                    </td>
                    <td className="px-3 py-4 text-muted">
                      {transaction.business_name ?? "Direct"}
                    </td>
                    <td className="px-3 py-4 text-muted">{transaction.page_title}</td>
                    <td className="px-3 py-4 text-muted">
                      <div>{transaction.payer_name}</div>
                      <div className="text-xs">{transaction.payer_email}</div>
                    </td>
                    <td className="px-3 py-4 text-muted">
                      {titleCase(transaction.payment_method)}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground">
                        {titleCase(transaction.status)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-muted">
                      {transaction.coupon_code ? (
                        <div>
                          <div className="font-medium text-foreground">
                            {transaction.coupon_code}
                          </div>
                          <div className="text-xs text-muted">
                            -{transaction.discount_amount_display}
                          </div>
                        </div>
                      ) : (
                        "None"
                      )}
                    </td>
                    <td className="px-3 py-4 text-muted">
                      <div>{transaction.amount_display}</div>
                      {transaction.discount_amount_cents > 0 ? (
                        <div className="text-xs text-muted">
                          from {transaction.original_amount_display}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-muted">
                      {formatDateTime(transaction.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!transactions.length && !loading ? (
              <p className="px-3 py-8 text-sm text-muted">No transactions match the current filters.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <h4 className="text-xl font-semibold text-foreground">GL Breakdown</h4>
            <div className="mt-5 space-y-3">
              {Object.entries(summary?.gl_breakdown ?? {}).length ? (
                Object.entries(summary?.gl_breakdown ?? {}).map(([code, value]) => (
                  <div key={code} className="rounded-3xl border border-line bg-white/75 p-4">
                    <p className="text-sm font-semibold text-foreground">{code}</p>
                    <p className="mt-2 text-lg font-semibold text-brand">
                      {formatCurrency(value)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No GL activity yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <h4 className="text-xl font-semibold text-foreground">Recent Email Logs</h4>
            <div className="mt-5 space-y-3">
              {logs.length ? (
                logs.map((log) => (
                  <div key={log.id} className="rounded-3xl border border-line bg-white/75 p-4">
                    <p className="text-sm font-semibold text-foreground">{log.subject}</p>
                    <p className="mt-1 text-sm text-muted">{log.to_email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                      {log.delivery_mode} • {log.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No confirmation logs yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
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
