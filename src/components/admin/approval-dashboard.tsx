"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { decidePaymentPageApproval, getApprovalQueue } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ApprovalStatus, PaymentPage } from "@/lib/types";

const tabs: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export function ApprovalDashboard() {
  const [status, setStatus] = useState<ApprovalStatus>("PENDING");
  const [pages, setPages] = useState<PaymentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function loadQueue(nextStatus: ApprovalStatus) {
    setLoading(true);
    setError(null);
    try {
      const response = await getApprovalQueue(nextStatus);
      setPages(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load approvals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue(status);
  }, [status]);

  async function decide(pageId: string, action: "APPROVED" | "REJECTED") {
    const note =
      action === "APPROVED"
        ? "Approved by admin and ready to deploy."
        : window.prompt("Optional rejection note for business owner:") || undefined;
    setWorkingId(pageId);
    try {
      await decidePaymentPageApproval(pageId, action, note);
      await loadQueue(status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save decision.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">Admin Approval Queue</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Review business-submitted payment pages before deployment
        </h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatus(tab)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                status === tab
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-foreground hover:border-brand hover:text-brand"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.6rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[2rem] border border-line bg-card px-6 py-10 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">Loading approvals</p>
        </div>
      ) : pages.length ? (
        <section className="space-y-4">
          {pages.map((page) => (
            <article key={page.id} className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{page.title}</h3>
                  <p className="text-sm text-muted">{page.organization_name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Submitted {formatDateTime(page.submitted_at || page.updated_at || page.created_at || "")}
                  </p>
                  {page.approval_note ? (
                    <p className="text-sm text-muted">Note: {page.approval_note}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/pages/${page.id}`}
                    className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                  >
                    Review
                  </Link>
                  {status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        disabled={workingId === page.id}
                        onClick={() => void decide(page.id, "APPROVED")}
                        className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-70"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={workingId === page.id}
                        onClick={() => void decide(page.id, "REJECTED")}
                        className="inline-flex rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-70"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-[2rem] border border-line bg-card px-6 py-10 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="text-sm text-muted">No pages found for this status.</p>
        </div>
      )}
    </div>
  );
}
