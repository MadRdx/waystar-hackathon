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
    <section className="rounded-[1.8rem] border border-line bg-white/85 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
            Distribution
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            Share this payment page anywhere
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            Copy the public URL, embed the checkout in an external site with the iframe snippet, or download a QR code for signage and print.
          </p>
        </div>

        {message ? (
          <p className="rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand">
            {message}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-line bg-background/60 p-4">
          <p className="text-sm font-semibold text-foreground">Direct URL</p>
          <p className="mt-3 break-all text-sm leading-7 text-muted">{page.public_url}</p>
          <button
            type="button"
            onClick={() => copyToClipboard(page.public_url, "URL")}
            className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
          >
            Copy URL
          </button>
        </div>

        <div className="rounded-3xl border border-line bg-background/60 p-4">
          <p className="text-sm font-semibold text-foreground">Embeddable iframe</p>
          <textarea
            value={page.iframe_snippet}
            readOnly
            rows={7}
            className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-xs text-muted"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(page.iframe_snippet, "Iframe snippet")}
            className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
          >
            Copy Snippet
          </button>
        </div>

        <div className="rounded-3xl border border-line bg-background/60 p-4">
          <p className="text-sm font-semibold text-foreground">QR code</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Generate a PNG or SVG that points directly to this page.
          </p>
          {previewSrc ? (
            <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt={`${page.title} QR code`}
                className="mx-auto h-48 w-48"
              />
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
            >
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
