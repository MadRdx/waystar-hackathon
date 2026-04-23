"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import type { PaymentPage } from "@/lib/types";

export function ShareTools({ page }: { page: PaymentPage }) {
  const [message, setMessage] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(page.public_url, {
      color: {
        dark: "#10231c",
        light: "#ffffff",
      },
      margin: 1,
      width: 320,
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setPreviewSrc(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page.public_url]);

  async function copyToClipboard(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied to clipboard.`);
    window.setTimeout(() => setMessage(null), 2000);
  }

  async function downloadPng() {
    const dataUrl = await QRCode.toDataURL(page.public_url, {
      color: {
        dark: "#10231c",
        light: "#ffffff",
      },
      margin: 1,
      width: 500,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${page.slug}-qr.png`;
    link.click();
  }

  async function downloadSvg() {
    const svgMarkup = await QRCode.toString(page.public_url, {
      type: "svg",
      margin: 1,
      color: {
        dark: "#10231c",
        light: "#ffffff",
      },
    });
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${page.slug}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-gradient-to-br from-white/95 to-white/60 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      {/* Decorative background element */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/5 blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand">
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse"></span>
            Distribution Ready
          </div>
          <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Share & Distribute
          </h3>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-500">
            Your payment page is live. Share it directly, embed it into an existing website, or print a QR code for in-person transactions.
          </p>
        </div>

        {message ? (
          <div className="animate-in fade-in slide-in-from-top-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {message}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-10 grid gap-6 lg:grid-cols-3">
        {/* URL Card */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/60 bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5">
          <div>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Direct Link</h4>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">Share this URL directly with your customers via email, SMS, or social media.</p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <p className="truncate text-sm font-medium text-slate-600" title={page.public_url}>{page.public_url}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(page.public_url, "URL")}
            className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-brand-foreground transition-all hover:bg-slate-800 active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            Copy Link
          </button>
        </div>

        {/* Iframe Card */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/60 bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5">
          <div>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-transform duration-300 group-hover:scale-110">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Website Embed</h4>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">Embed a responsive checkout directly into your own website using this HTML iframe.</p>
            <textarea
              value={page.iframe_snippet}
              readOnly
              rows={3}
              className="mt-5 w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 p-4 font-mono text-[11px] text-slate-600 focus:ring-0 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(page.iframe_snippet, "Iframe snippet")}
            className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-brand-foreground transition-all hover:bg-slate-800 active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            Copy Snippet
          </button>
        </div>

        {/* QR Card */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/60 bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5">
          <div>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
            </div>
            <h4 className="text-lg font-bold text-slate-900">QR Code</h4>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">Download a scannable QR code for physical signage or print materials.</p>
            {previewSrc ? (
              <div className="mt-5 flex justify-center rounded-2xl bg-slate-50 py-3 border border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt={`${page.title} QR code`}
                  className="h-28 w-28 rounded-xl bg-card p-2 shadow-sm mix-blend-multiply"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={downloadPng}
              className="flex-1 rounded-2xl bg-brand py-3.5 text-sm font-bold text-brand-foreground transition-all hover:bg-brand-strong active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="flex-1 rounded-2xl border-2 border-brand/20 bg-transparent py-3.5 text-sm font-bold text-brand transition-all hover:border-brand hover:bg-brand/5 active:scale-[0.98]"
            >
              SVG
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
