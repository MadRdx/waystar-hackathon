"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getPublicTransaction } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function PaymentSuccessView({
  slug,
  transactionId,
}: {
  slug: string;
  transactionId: string;
}) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;

    let cancelled = false;
    getPublicTransaction(transactionId)
      .then((response) => {
        if (!cancelled) {
          setTransaction(response.item);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load the receipt details.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (!transactionId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="rounded-[1.8rem] border border-red-200 bg-red-50 px-8 py-7 text-center text-sm text-red-700">
          A transaction reference was not provided.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="rounded-[1.8rem] border border-red-200 bg-red-50 px-8 py-7 text-center text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="rounded-[1.8rem] border border-line bg-card px-8 py-7 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Loading receipt
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[2rem] border border-line bg-card p-8 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
            Payment Receipt
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {transaction.status === "PENDING"
              ? "Your payment is on its way."
              : "Payment completed successfully."}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
            Reference {transaction.public_id}. Keep this page for your records or return to the payment page if you need to submit another payment.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ReceiptCard label="Page" value={transaction.page_title} />
            <ReceiptCard label="Amount" value={transaction.amount_display} />
            <ReceiptCard label="Method" value={titleCase(transaction.payment_method)} />
            <ReceiptCard label="Status" value={titleCase(transaction.status)} />
            <ReceiptCard label="Payer" value={transaction.payer_name} />
            <ReceiptCard label="Created" value={formatDateTime(transaction.created_at)} />
          </div>

          {transaction.discount_amount_cents > 0 ? (
            <div className="mt-8 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-900">Discount applied</p>
              <p className="mt-2 text-sm leading-7 text-emerald-800">
                {transaction.coupon_code || "Coupon"} reduced the payment from{" "}
                {transaction.original_amount_display} to {transaction.amount_display}.
              </p>
            </div>
          ) : null}

          <div className="mt-8 rounded-[1.6rem] border border-line bg-white/75 p-5">
            <p className="text-sm font-semibold text-foreground">Processor message</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {transaction.processor_message || "Sandbox transaction recorded."}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold text-foreground">Submitted details</h2>
            <div className="mt-4 space-y-3">
              {transaction.field_responses.map((field) => (
                <div key={field.field_id} className="rounded-3xl border border-line bg-white/75 p-4">
                  <p className="text-sm font-semibold text-foreground">{field.field_label}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{String(field.value ?? "")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/pay/${slug}`}
              className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Return to Payment Page
            </Link>
            <Link
              href="/"
              className="inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
            >
              Back to Overview
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReceiptCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.6rem] border border-line bg-white/75 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
