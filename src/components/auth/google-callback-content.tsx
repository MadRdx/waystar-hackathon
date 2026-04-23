"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { loginWithGoogle, setStoredSession } from "@/lib/api";

export function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state") ?? "CUSTOMER";
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError("Google sign-in was cancelled or failed. Please try again.");
      return;
    }

    if (!code) {
      setError("No authorization code received from Google.");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback/google`;

    // Determine expected role and session kind from state
    const expectedRole = ["ADMIN", "BUSINESS", "CUSTOMER"].includes(state) ? state : undefined;
    const sessionKind = expectedRole === "CUSTOMER" ? "customer" : "portal";

    loginWithGoogle(code, redirectUri, expectedRole)
      .then((response) => {
        setStoredSession(sessionKind === "customer" ? "customer" : "portal", {
          token: response.token,
          user: response.user,
        });

        // Redirect based on role
        const role = response.user.role;
        if (role === "ADMIN") {
          router.replace("/admin");
        } else if (role === "BUSINESS") {
          router.replace("/business");
        } else {
          router.replace("/customer");
        }
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Google sign-in failed. Please try again.",
        );
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="max-w-md space-y-4 rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="text-sm font-semibold text-red-700">
            Sign-in failed
          </p>
          <p className="text-sm leading-7 text-red-600">{error}</p>
          <a
            href="/"
            className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="rounded-[2rem] border border-line bg-card p-8 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Completing Google sign-in
        </p>
        <p className="mt-3 text-base text-muted">
          Please wait while we verify your account...
        </p>
      </div>
    </div>
  );
}
