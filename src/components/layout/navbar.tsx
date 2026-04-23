"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { getStoredSession } from "@/lib/api";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [homeHref, setHomeHref] = useState("/");
  const pathname = usePathname();

  useEffect(() => {
    const portalSession = getStoredSession("portal");
    if (portalSession?.user) {
      setHomeHref(portalSession.user.role === "ADMIN" ? "/admin" : "/business");
      return;
    }
    
    const customerSession = getStoredSession("customer");
    if (customerSession?.user) {
      setHomeHref("/customer");
      return;
    }
    
    setHomeHref("/");
  }, [pathname]);

  const navLinks = [
    { href: homeHref, label: "Home" },
    { href: "/pay/yoga-class", label: "Demo Checkout" },
    { href: "/login", label: "Provider Login" },
    { href: "/business/login", label: "Business Login" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-card/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href={homeHref} className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
          <span className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-brand-foreground font-bold text-xs">
            Q
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-semibold hidden sm:inline-block">
            Quick Payment Pages
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "text-sm font-semibold transition-colors",
                pathname === link.href ? "text-brand" : "text-muted hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              const root = document.documentElement;
              if (root.classList.contains('dark')) {
                root.classList.remove('dark');
                root.classList.add('light');
              } else if (root.classList.contains('light')) {
                root.classList.remove('light');
                root.classList.add('dark');
              } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                  root.classList.add('light');
                } else {
                  root.classList.add('dark');
                }
              }
            }}
            className="p-2 text-muted hover:text-foreground rounded-full hover:bg-muted-surface transition-colors ml-2"
            aria-label="Toggle Dark Mode"
            title="Toggle Dark Mode"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <Link
            href="/login"
            className="ml-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition-all hover:bg-brand-strong"
          >
            Get Started
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen ? (
        <div className="md:hidden border-t border-line bg-card px-6 py-4">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  "block text-base font-semibold",
                  pathname === link.href ? "text-brand" : "text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => {
                const root = document.documentElement;
                if (root.classList.contains('dark')) {
                  root.classList.remove('dark');
                  root.classList.add('light');
                } else if (root.classList.contains('light')) {
                  root.classList.remove('light');
                  root.classList.add('dark');
                } else {
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark) {
                    root.classList.add('light');
                  } else {
                    root.classList.add('dark');
                  }
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card/50 px-4 py-3 text-sm font-semibold text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Toggle Theme
            </button>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="mt-2 block rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-brand-foreground shadow-sm"
            >
              Get Started
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
