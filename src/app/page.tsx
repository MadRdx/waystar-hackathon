import Link from "next/link";

const demoPages = [
  {
    href: "/pay/yoga-class",
    title: "Yoga Studio Checkout",
    description: "Fixed amount class registration with custom attendee fields and instant card receipts.",
  },
  {
    href: "/pay/city-utilities",
    title: "Utility Balance Payment",
    description: "Range-based billing flow with ACH support, GL tracking, and post-payment transparency.",
  },
];

const highlights = [
  "Python FastAPI backend with REST endpoints and MongoDB documents for users, businesses, pages, transactions, and reports.",
  "Role-based admin and business portals with live preview, QR/iframe sharing, configurable branding, coupon codes, and email templates.",
  "Public payment pages with guest checkout, optional customer accounts, wallet and ACH sandbox flows, and Quick RePay memory for returning payers.",
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="overflow-hidden rounded-[2rem] border border-line bg-card shadow-[0_30px_120px_rgba(16,35,28,0.08)]">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.3fr_0.7fr] lg:px-12 lg:py-14">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-line bg-white/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-muted">
                Quick Payment Pages
              </span>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Self-service payment pages that feel polished, transparent, and easy to trust.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted">
                  This build pairs a React frontend with a FastAPI REST backend and MongoDB so providers can configure branded payment pages, distribute them anywhere, and track every payment from one admin experience.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
                >
                  Open Admin Portal
                </Link>
                <Link
                  href="/business/login"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                >
                  Business Login
                </Link>
                <Link
                  href="/customer/login"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                >
                  Customer Login
                </Link>
                <Link
                  href="/pay/yoga-class"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                >
                  View Demo Payment Page
                </Link>
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-line bg-white/80 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
                Included Stack
              </p>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-muted">
                {highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-2xl border border-line bg-muted-surface px-4 py-4"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {demoPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group rounded-[1.8rem] border border-line bg-card px-7 py-7 shadow-[0_22px_80px_rgba(16,35,28,0.06)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.26em] text-muted">
                Demo Flow
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-foreground group-hover:text-brand">
                {page.title}
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted">{page.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-brand">
                Launch page
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
