"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { loginCustomer, registerCustomer, setStoredSession } from "@/lib/api";

export function CustomerAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = isRegister
        ? await registerCustomer({
            name,
            email,
            password,
            billing_zip: billingZip || undefined,
          })
        : await loginCustomer(email, password);
      setStoredSession("customer", {
        token: response.token,
        user: response.user,
      });
      router.replace(searchParams.get("next") || "/customer");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t complete your request right now.",
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
            Customer Account
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
            {isRegister
              ? "Create a customer login for faster repeat payments."
              : "Sign in to reuse payer details and review your receipts."}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-muted">
            Customer accounts layer on top of the existing public payment pages. They do not replace guest checkout, but they let returning payers save their profile and see their payment history.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-white/75 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Keep It Fast
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Your account can prefill payer details on future payments while guest checkout remains available for everyone else.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-white/75 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Recent Activity
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Signed-in customers get a lightweight dashboard for payment history and saved profile updates.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/pay/yoga-class"
              className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand-strong"
            >
              Try the public payment page
            </Link>
            <Link
              href={isRegister ? "/customer/login" : "/customer/register"}
              className="inline-flex items-center text-sm font-semibold text-muted hover:text-brand"
            >
              {isRegister ? "Already have an account?" : "Need to create an account?"}
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-line bg-white/85 p-8 shadow-[0_26px_90px_rgba(16,35,28,0.08)] lg:p-10">
          <h2 className="text-2xl font-semibold text-foreground">
            {isRegister ? "Create your account" : "Sign in"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            {isRegister
              ? "Use this once, then sign in anywhere you pay through your saved customer account."
              : "Use the seeded demo customer account or your own registered credentials."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {isRegister ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Full Name</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3 text-base text-foreground"
                />
              </label>
            ) : null}

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

            {isRegister ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Billing ZIP</span>
                <input
                  value={billingZip}
                  onChange={(event) => setBillingZip(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3 text-base text-foreground"
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Password</span>
              <input
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
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
                ? isRegister
                  ? "Creating account..."
                  : "Signing you in..."
                : isRegister
                  ? "Create Customer Account"
                  : "Continue to Customer Dashboard"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
