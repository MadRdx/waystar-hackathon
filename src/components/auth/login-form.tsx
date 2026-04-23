"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { loginPortal, setStoredSession } from "@/lib/api";
import type { PortalRole } from "@/lib/types";

export function LoginForm({
  role = "ADMIN",
  defaultNext,
}: {
  role?: PortalRole;
  defaultNext?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusiness = role === "BUSINESS";
  const portalLabel = isBusiness ? "Business Portal" : "Admin Portal";
  const nextPath = defaultNext ?? (isBusiness ? "/business" : "/admin");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await loginPortal(email, password, role);
      setStoredSession("portal", {
        token: response.token,
        user: response.user,
      });
      router.replace(searchParams.get("next") || nextPath);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign you in right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-line bg-card p-8 shadow-[0_26px_90px_rgba(16,35,28,0.08)] lg:p-10">
          <span className="inline-flex rounded-full border border-line bg-white/75 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-muted">
            {portalLabel}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
            {isBusiness
              ? "Log in to manage only your business-owned pages and coupon offers."
              : "Configure branded payment pages without touching code."}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-muted">
            {isBusiness
              ? "Business users can update their payment pages, share QR links, and review only their own receipts and reporting."
              : "Admins can oversee every business workspace, create pages, review reporting, and support the full payment platform."}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-white/75 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Stack
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                React frontend, FastAPI REST API, and MongoDB-backed page, user, and transaction documents.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-white/75 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Demo Access
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Seeded demo credentials are listed in <code>README.md</code> after you run the seed script.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/pay/yoga-class"
              className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand-strong"
            >
              Preview the public payer experience
            </Link>
            <Link
              href={isBusiness ? "/login" : "/business/login"}
              className="inline-flex items-center text-sm font-semibold text-muted hover:text-brand"
            >
              {isBusiness ? "Need the admin portal?" : "Need the business portal?"}
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-line bg-white/85 p-8 shadow-[0_26px_90px_rgba(16,35,28,0.08)] lg:p-10">
          <h2 className="text-2xl font-semibold text-foreground">Sign in</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Use the seeded {isBusiness ? "business" : "admin"} email and password from your local setup.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3 text-base text-foreground"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3 text-base text-foreground"
              />
            </label>

            {error ? (
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? "Signing you in..."
                : `Continue to ${isBusiness ? "Business" : "Admin"} Portal`}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
