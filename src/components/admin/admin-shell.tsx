"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredSession } from "@/lib/api";
import { usePortalSession } from "@/lib/use-admin-session";
import type { PortalRole } from "@/lib/types";

export function AdminShell({
  children,
  role,
  basePath,
}: {
  children: ReactNode;
  role: PortalRole;
  basePath: "/admin" | "/business";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const loginPath = role === "BUSINESS" ? "/business/login" : "/login";
  const { loading, user } = usePortalSession({
    allowedRole: role,
    loginPath,
  });

  const navItems = [
    { href: "/", label: "Home" },
    { href: basePath, label: "Dashboard" },
    { href: `${basePath}/pages/new`, label: "Create Page" },
    { href: `${basePath}/reports`, label: "Reports" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-8">
        <div className="rounded-[1.8rem] border border-line bg-card px-8 py-7 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Checking session
          </p>
          <p className="mt-3 text-base text-muted">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const portalTitle = role === "BUSINESS" ? "Business Console" : "Provider Console";
  const portalSubtitle =
    role === "BUSINESS"
      ? "Manage only your business-owned payment pages, coupons, and receipts."
      : "Hosted payment pages with admin control, business access, and live reporting";

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <Link href="/" className="block">
            <span className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
              Quick Payment Pages
            </span>
            <h1 className="mt-4 text-2xl font-semibold text-foreground">{portalTitle}</h1>
          </Link>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex rounded-2xl border px-4 py-3 text-sm font-semibold",
                    isActive
                      ? "border-brand bg-brand text-white"
                      : "border-transparent bg-white/65 text-foreground hover:border-line",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-line bg-white/70 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Signed In
            </p>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {user.name || (role === "BUSINESS" ? "Business Owner" : "Platform Admin")}
            </p>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
            {user.business_name ? (
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">
                {user.business_name}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                clearStoredSession("portal");
                router.replace(loginPath);
              }}
              className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-h-full flex-col gap-4">
          <header className="rounded-[2rem] border border-line bg-card px-6 py-5 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
                  React + FastAPI + MongoDB
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                  {portalSubtitle}
                </h2>
              </div>
              <Link
                href="/pay/yoga-class"
                className="inline-flex rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
              >
                View Demo Checkout
              </Link>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
