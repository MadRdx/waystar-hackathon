/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createPaymentPage,
  getPaymentPage,
  updatePaymentPage,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { glCodeIsValid } from "@/lib/validation";
import type { CouponCode, CustomField, GLCode, PaymentPage } from "@/lib/types";
import { ShareTools } from "@/components/admin/share-tools";

type BuilderPage = Omit<PaymentPage, "public_url" | "iframe_snippet"> & {
  public_url?: string;
  iframe_snippet?: string;
};

function createCustomField(type: CustomField["type"] = "TEXT", index = 0): CustomField {
  return {
    id: `field-${Date.now()}-${index}`,
    key: "",
    label: "",
    type,
    options: [],
    is_required: false,
    placeholder: "",
    helper_text: "",
    sort_order: index,
  };
}

function createGlCode(index = 0): GLCode {
  return {
    id: `gl-${Date.now()}-${index}`,
    code: "",
    label: "",
    sort_order: index,
  };
}

function createCoupon(index = 0): CouponCode {
  return {
    id: `coupon-${Date.now()}-${index}`,
    code: "",
    description: "",
    type: "PERCENT",
    percent_off: 10,
    amount_off_cents: 500,
    minimum_amount_cents: 2000,
    is_active: true,
  };
}

function createEmptyPage(): BuilderPage {
  return {
    id: "",
    slug: "",
    business_id: "",
    business_name: "",
    organization_name: "",
    title: "",
    subtitle: "",
    header_message: "",
    footer_message: "",
    logo_url: "",
    support_email: "",
    brand_color: "#0F766E",
    amount_mode: "FIXED",
    fixed_amount_cents: 2500,
    min_amount_cents: 1000,
    max_amount_cents: 50000,
    email_template:
      "<h1>Thanks, {{payerName}}</h1><p>We received {{amount}} for {{pageTitle}}.</p><p>Transaction ID: {{transactionId}} on {{date}}</p>",
    is_active: true,
    custom_fields: [],
    gl_codes: [],
    coupon_codes: [],
    accepts_coupons: false,
    created_at: null,
    updated_at: null,
  };
}

function moneyInputToCents(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return Math.round(numeric * 100);
}

export function PageBuilder({
  pageId,
  portalBase = "/admin",
}: {
  pageId?: string;
  portalBase?: "/admin" | "/business";
}) {
  const router = useRouter();
  const [page, setPage] = useState<BuilderPage>(createEmptyPage());
  const [loading, setLoading] = useState(Boolean(pageId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) {
      return;
    }

    let cancelled = false;
    getPaymentPage(pageId)
      .then((response) => {
        if (!cancelled) {
          setPage(response.item);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load the payment page.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  function updateField<K extends keyof BuilderPage>(key: K, value: BuilderPage[K]) {
    setPage((current) => ({ ...current, [key]: value }));
  }

  function updateCustomField(index: number, updates: Partial<CustomField>) {
    setPage((current) => ({
      ...current,
      custom_fields: current.custom_fields.map((field, currentIndex) =>
        currentIndex === index ? { ...field, ...updates } : field,
      ),
    }));
  }

  function updateGlCode(index: number, updates: Partial<GLCode>) {
    setPage((current) => ({
      ...current,
      gl_codes: current.gl_codes.map((code, currentIndex) =>
        currentIndex === index ? { ...code, ...updates } : code,
      ),
    }));
  }

  function updateCoupon(index: number, updates: Partial<CouponCode>) {
    setPage((current) => ({
      ...current,
      coupon_codes: (current.coupon_codes ?? []).map((coupon, currentIndex) =>
        currentIndex === index ? { ...coupon, ...updates } : coupon,
      ),
      accepts_coupons: true,
    }));
  }

  function reorderCustomField(index: number, direction: -1 | 1) {
    setPage((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.custom_fields.length) {
        return current;
      }
      const customFields = [...current.custom_fields];
      [customFields[index], customFields[nextIndex]] = [
        customFields[nextIndex],
        customFields[index],
      ];
      return {
        ...current,
        custom_fields: customFields.map((field, sortOrder) => ({
          ...field,
          sort_order: sortOrder,
        })),
      };
    });
  }

  function reorderGlCode(index: number, direction: -1 | 1) {
    setPage((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.gl_codes.length) {
        return current;
      }
      const glCodes = [...current.gl_codes];
      [glCodes[index], glCodes[nextIndex]] = [glCodes[nextIndex], glCodes[index]];
      return {
        ...current,
        gl_codes: glCodes.map((code, sortOrder) => ({
          ...code,
          sort_order: sortOrder,
        })),
      };
    });
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("logo_url", String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (page.organization_name.trim().length < 2) {
      setSaving(false);
      setError("Organization name must be at least 2 characters.");
      return;
    }

    if (page.slug.trim().length < 2) {
      setSaving(false);
      setError("URL slug must be at least 2 characters.");
      return;
    }

    if (page.title.trim().length < 2) {
      setSaving(false);
      setError("Page title must be at least 2 characters.");
      return;
    }

    if (!page.gl_codes.length) {
      setSaving(false);
      setError("Add at least one GL code before saving.");
      return;
    }

    const invalidGlCode = page.gl_codes.find((glCode) => !glCodeIsValid(glCode.code));
    if (invalidGlCode) {
      setSaving(false);
      setError(`GL code "${invalidGlCode.code || "blank"}" is not in a valid format.`);
      return;
    }

    if (page.custom_fields.length > 10) {
      setSaving(false);
      setError("You can only configure up to 10 custom fields.");
      return;
    }

    const blankCustomField = page.custom_fields.find((field) => !field.label.trim());
    if (blankCustomField) {
      setSaving(false);
      setError("Every custom field needs a label, or remove the unfinished field.");
      return;
    }

    const invalidDropdown = page.custom_fields.find(
      (field) => field.type === "DROPDOWN" && !field.options.length,
    );
    if (invalidDropdown) {
      setSaving(false);
      setError(`Dropdown field "${invalidDropdown.label}" needs at least one option.`);
      return;
    }

    if (page.amount_mode === "FIXED" && !page.fixed_amount_cents) {
      setSaving(false);
      setError("Enter a fixed amount before saving this page.");
      return;
    }

    if (
      page.amount_mode === "RANGE" &&
      (page.min_amount_cents === null ||
        page.min_amount_cents === undefined ||
        page.max_amount_cents === null ||
        page.max_amount_cents === undefined)
    ) {
      setSaving(false);
      setError("Range pages need both minimum and maximum amounts.");
      return;
    }

    if (
      page.amount_mode === "RANGE" &&
      page.min_amount_cents !== null &&
      page.min_amount_cents !== undefined &&
      page.max_amount_cents !== null &&
      page.max_amount_cents !== undefined &&
      page.min_amount_cents >= page.max_amount_cents
    ) {
      setSaving(false);
      setError("Minimum amount must be lower than maximum amount.");
      return;
    }

    const invalidCoupon = (page.coupon_codes ?? []).find((coupon) => {
      if (!coupon.code.trim()) {
        return true;
      }

      if (coupon.type === "PERCENT") {
        return (
          coupon.percent_off === null ||
          coupon.percent_off === undefined ||
          coupon.percent_off <= 0 ||
          coupon.percent_off >= 100
        );
      }

      return (
        coupon.amount_off_cents === null ||
        coupon.amount_off_cents === undefined ||
        coupon.amount_off_cents <= 0
      );
    });
    if (invalidCoupon) {
      setSaving(false);
      setError(
        `Coupon "${invalidCoupon.code || "blank"}" is incomplete. Fill in the code and discount values before saving.`,
      );
      return;
    }

    const payload = {
      slug: page.slug,
      organization_name: page.organization_name,
      title: page.title,
      subtitle: page.subtitle,
      header_message: page.header_message,
      footer_message: page.footer_message,
      logo_url: page.logo_url,
      support_email: page.support_email,
      brand_color: page.brand_color,
      amount_mode: page.amount_mode,
      fixed_amount_cents: page.fixed_amount_cents,
      min_amount_cents: page.min_amount_cents,
      max_amount_cents: page.max_amount_cents,
      email_template: page.email_template,
      is_active: page.is_active,
      custom_fields: page.custom_fields,
      gl_codes: page.gl_codes,
      coupon_codes: page.coupon_codes ?? [],
    };

    try {
      const response = pageId
        ? await updatePaymentPage(pageId, payload)
        : await createPaymentPage(payload);

      setPage(response.item);
      setSuccess("Payment page saved.");
      if (!pageId) {
        router.replace(`${portalBase}/pages/${response.item.id}`);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the page right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-line bg-card px-6 py-10 text-center shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Loading page builder
        </p>
      </div>
    );
  }

  const fixedAmountValue = page.fixed_amount_cents
    ? String(page.fixed_amount_cents / 100)
    : "";
  const minAmountValue = page.min_amount_cents ? String(page.min_amount_cents / 100) : "";
  const maxAmountValue = page.max_amount_cents ? String(page.max_amount_cents / 100) : "";

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
                Payment Page Builder
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">
                {pageId ? "Edit page configuration" : "Create a new payment page"}
              </h3>
            </div>
            <div className="flex gap-3">
              <Link
                href={portalBase}
                className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
              >
                Back
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save Page"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          <div className="mt-6 space-y-8">
            <section className="grid gap-4 md:grid-cols-2">
              {page.business_name ? (
                <div className="md:col-span-2 rounded-[1.6rem] border border-line bg-background/50 px-4 py-4 text-sm text-muted">
                  This page belongs to <span className="font-semibold text-foreground">{page.business_name}</span>.
                </div>
              ) : null}
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Organization Name</span>
                <input
                  value={page.organization_name}
                  onChange={(event) => updateField("organization_name", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">URL Slug</span>
                <input
                  value={page.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Page Title</span>
                <input
                  value={page.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Subtitle / Description</span>
                <textarea
                  rows={3}
                  value={page.subtitle ?? ""}
                  onChange={(event) => updateField("subtitle", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Brand Color</span>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={page.brand_color}
                    onChange={(event) => updateField("brand_color", event.target.value)}
                    className="h-12 w-16 rounded-2xl border border-line bg-white p-2"
                  />
                  <input
                    value={page.brand_color}
                    onChange={(event) => updateField("brand_color", event.target.value)}
                    className="flex-1 rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Support Email</span>
                <input
                  type="email"
                  value={page.support_email ?? ""}
                  onChange={(event) => updateField("support_email", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Logo URL</span>
                <input
                  value={page.logo_url ?? ""}
                  onChange={(event) => updateField("logo_url", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Header Message</span>
                <textarea
                  rows={3}
                  value={page.header_message ?? ""}
                  onChange={(event) => updateField("header_message", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Footer Message</span>
                <textarea
                  rows={3}
                  value={page.footer_message ?? ""}
                  onChange={(event) => updateField("footer_message", event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                />
              </label>
            </section>

            <section className="rounded-[1.6rem] border border-line bg-white/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Payment Amount Rules</h4>
                  <p className="text-sm leading-7 text-muted">
                    Choose a fixed amount, payer-entered range, or open donation style payment.
                  </p>
                </div>
                <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={page.is_active}
                    onChange={(event) => updateField("is_active", event.target.checked)}
                  />
                  Page is active
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Mode</span>
                  <select
                    value={page.amount_mode}
                    onChange={(event) =>
                      updateField("amount_mode", event.target.value as BuilderPage["amount_mode"])
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  >
                    <option value="FIXED">Fixed Amount</option>
                    <option value="RANGE">Min / Max Range</option>
                    <option value="OPEN">User Entered</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Fixed Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fixedAmountValue}
                    onChange={(event) =>
                      updateField("fixed_amount_cents", moneyInputToCents(event.target.value))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Minimum</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minAmountValue}
                    onChange={(event) =>
                      updateField("min_amount_cents", moneyInputToCents(event.target.value))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Maximum</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxAmountValue}
                    onChange={(event) =>
                      updateField("max_amount_cents", moneyInputToCents(event.target.value))
                    }
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-line bg-white/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Custom Data Fields</h4>
                  <p className="text-sm leading-7 text-muted">
                    Configure up to 10 fields with order controls for the payer experience.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => ({
                      ...current,
                      custom_fields: [
                        ...current.custom_fields,
                        createCustomField("TEXT", current.custom_fields.length),
                      ],
                    }))
                  }
                  className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                >
                  Add Field
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {page.custom_fields.map((field, index) => (
                  <div key={field.id} className="rounded-3xl border border-line bg-white p-4">
                    <div className="grid gap-4 lg:grid-cols-12">
                      <label className="space-y-2 lg:col-span-4">
                        <span className="text-sm font-medium text-foreground">Label</span>
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateCustomField(index, { label: event.target.value })
                          }
                          className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                        />
                      </label>
                      <label className="space-y-2 lg:col-span-3">
                        <span className="text-sm font-medium text-foreground">Type</span>
                        <select
                          value={field.type}
                          onChange={(event) =>
                            updateCustomField(index, {
                              type: event.target.value as CustomField["type"],
                            })
                          }
                          className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                        >
                          <option value="TEXT">Text</option>
                          <option value="NUMBER">Number</option>
                          <option value="DROPDOWN">Dropdown</option>
                          <option value="DATE">Date</option>
                          <option value="CHECKBOX">Checkbox</option>
                        </select>
                      </label>
                      <label className="space-y-2 lg:col-span-3">
                        <span className="text-sm font-medium text-foreground">Placeholder</span>
                        <input
                          value={field.placeholder ?? ""}
                          onChange={(event) =>
                            updateCustomField(index, { placeholder: event.target.value })
                          }
                          className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                        />
                      </label>
                      <div className="flex items-end gap-2 lg:col-span-2">
                        <button
                          type="button"
                          onClick={() => reorderCustomField(index, -1)}
                          className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => reorderCustomField(index, 1)}
                          className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPage((current) => ({
                              ...current,
                              custom_fields: current.custom_fields.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            }))
                          }
                          className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Helper Text</span>
                        <input
                          value={field.helper_text ?? ""}
                          onChange={(event) =>
                            updateCustomField(index, { helper_text: event.target.value })
                          }
                          className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">
                          Dropdown Options
                        </span>
                        <input
                          value={field.options.join(", ")}
                          onChange={(event) =>
                            updateCustomField(index, {
                              options: event.target.value
                                .split(",")
                                .map((option) => option.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                        />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-line bg-background/70 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={field.is_required}
                          onChange={(event) =>
                            updateCustomField(index, { is_required: event.target.checked })
                          }
                        />
                        <span className="text-sm font-medium text-foreground">Required</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-line bg-white/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">GL Codes</h4>
                  <p className="text-sm leading-7 text-muted">
                    Add one or more validated ledger codes to stamp onto every transaction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => ({
                      ...current,
                      gl_codes: [...current.gl_codes, createGlCode(current.gl_codes.length)],
                    }))
                  }
                  className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                >
                  Add GL Code
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {page.gl_codes.map((glCode, index) => (
                  <div key={glCode.id} className="grid gap-4 rounded-3xl border border-line bg-white p-4 lg:grid-cols-[1fr_1fr_auto]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Code</span>
                      <input
                        value={glCode.code}
                        onChange={(event) =>
                          updateGlCode(index, { code: event.target.value.toUpperCase() })
                        }
                        className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Label</span>
                      <input
                        value={glCode.label ?? ""}
                        onChange={(event) =>
                          updateGlCode(index, { label: event.target.value })
                        }
                        className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => reorderGlCode(index, -1)}
                        className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-foreground"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderGlCode(index, 1)}
                        className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-foreground"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((current) => ({
                            ...current,
                            gl_codes: current.gl_codes.filter(
                              (_, currentIndex) => currentIndex !== index,
                            ),
                          }))
                        }
                        className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-line bg-white/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Coupons</h4>
                  <p className="text-sm leading-7 text-muted">
                    Create business-specific discount codes that can be applied on the public payment page.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={page.accepts_coupons}
                      onChange={(event) =>
                        setPage((current) => ({
                          ...current,
                          accepts_coupons: event.target.checked,
                          coupon_codes: event.target.checked ? current.coupon_codes ?? [] : [],
                        }))
                      }
                    />
                    Enable coupons
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => ({
                        ...current,
                        accepts_coupons: true,
                        coupon_codes: [
                          ...(current.coupon_codes ?? []),
                          createCoupon((current.coupon_codes ?? []).length),
                        ],
                      }))
                    }
                    className="inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground hover:border-brand hover:text-brand"
                  >
                    Add Coupon
                  </button>
                </div>
              </div>

              {page.accepts_coupons ? (
                <div className="mt-5 space-y-4">
                  {(page.coupon_codes ?? []).length ? (
                    (page.coupon_codes ?? []).map((coupon, index) => {
                      const percentValue =
                        coupon.percent_off === null || coupon.percent_off === undefined
                          ? ""
                          : String(coupon.percent_off);
                      const amountOffValue =
                        coupon.amount_off_cents === null || coupon.amount_off_cents === undefined
                          ? ""
                          : String(coupon.amount_off_cents / 100);
                      const minimumValue =
                        coupon.minimum_amount_cents === null ||
                        coupon.minimum_amount_cents === undefined
                          ? ""
                          : String(coupon.minimum_amount_cents / 100);

                      return (
                        <div
                          key={coupon.id}
                          className="rounded-3xl border border-line bg-white p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-12">
                            <label className="space-y-2 lg:col-span-3">
                              <span className="text-sm font-medium text-foreground">Code</span>
                              <input
                                value={coupon.code}
                                onChange={(event) =>
                                  updateCoupon(index, {
                                    code: event.target.value.toUpperCase().replace(/\s+/g, ""),
                                  })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              />
                            </label>
                            <label className="space-y-2 lg:col-span-4">
                              <span className="text-sm font-medium text-foreground">Description</span>
                              <input
                                value={coupon.description ?? ""}
                                onChange={(event) =>
                                  updateCoupon(index, { description: event.target.value })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              />
                            </label>
                            <label className="space-y-2 lg:col-span-2">
                              <span className="text-sm font-medium text-foreground">Type</span>
                              <select
                                value={coupon.type}
                                onChange={(event) =>
                                  updateCoupon(index, {
                                    type: event.target.value as CouponCode["type"],
                                  })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              >
                                <option value="PERCENT">Percent Off</option>
                                <option value="FIXED">Fixed Amount</option>
                              </select>
                            </label>
                            <div className="flex items-end gap-2 lg:col-span-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setPage((current) => ({
                                    ...current,
                                    coupon_codes: (current.coupon_codes ?? []).filter(
                                      (_, currentIndex) => currentIndex !== index,
                                    ),
                                  }))
                                }
                                className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-4">
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-foreground">
                                Percent Off
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="99"
                                value={percentValue}
                                onChange={(event) =>
                                  updateCoupon(index, {
                                    percent_off: event.target.value
                                      ? Number(event.target.value)
                                      : null,
                                  })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-foreground">
                                Amount Off
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amountOffValue}
                                onChange={(event) =>
                                  updateCoupon(index, {
                                    amount_off_cents: moneyInputToCents(event.target.value),
                                  })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-foreground">
                                Minimum Payment
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={minimumValue}
                                onChange={(event) =>
                                  updateCoupon(index, {
                                    minimum_amount_cents: moneyInputToCents(event.target.value),
                                  })
                                }
                                className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3"
                              />
                            </label>
                            <label className="flex items-center gap-3 rounded-2xl border border-line bg-background/70 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={coupon.is_active}
                                onChange={(event) =>
                                  updateCoupon(index, { is_active: event.target.checked })
                                }
                              />
                              <span className="text-sm font-medium text-foreground">
                                Coupon is active
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted">
                      Add your first coupon to let customers enter a discount code at checkout.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">
                  Coupons are disabled for this page right now.
                </p>
              )}
            </section>

            <section className="rounded-[1.6rem] border border-line bg-white/70 p-5">
              <h4 className="text-lg font-semibold text-foreground">
                Confirmation Email Template
              </h4>
              <p className="mt-2 text-sm leading-7 text-muted">
                Supported variables: <code>{`{{payerName}}`}</code>, <code>{`{{amount}}`}</code>,{" "}
                <code>{`{{transactionId}}`}</code>, <code>{`{{date}}`}</code>,{" "}
                <code>{`{{pageTitle}}`}</code>, and field keys like{" "}
                <code>{`{{field.student_name}}`}</code>.
              </p>
              <textarea
                rows={8}
                value={page.email_template ?? ""}
                onChange={(event) => updateField("email_template", event.target.value)}
                className="mt-4 w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-sm text-muted"
              />
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_80px_rgba(16,35,28,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Live Preview
            </p>
            <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-line bg-white">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: page.brand_color || "#0F766E" }}
              />
              <div className="space-y-5 px-6 py-6">
                <div className="flex items-center gap-4">
                  {page.logo_url ? (
                    <img
                      src={page.logo_url}
                      alt={`${page.organization_name || "Organization"} logo`}
                      className="h-14 w-14 rounded-2xl border border-line object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-sm font-semibold text-muted">
                      Logo
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                      {page.organization_name || "Organization Name"}
                    </p>
                    <h4 className="mt-2 text-2xl font-semibold text-foreground">
                      {page.title || "Payment Page Title"}
                    </h4>
                  </div>
                </div>

                <p className="text-sm leading-7 text-muted">
                  {page.subtitle || "Describe what the payer is covering with this page."}
                </p>

                <div className="rounded-3xl border border-line bg-background/60 p-4">
                  <p className="text-sm font-semibold text-foreground">Amount</p>
                  <p className="mt-2 text-2xl font-semibold text-brand">
                    {page.amount_mode === "FIXED"
                      ? formatCurrency(page.fixed_amount_cents ?? 0)
                      : page.amount_mode === "RANGE"
                        ? `${formatCurrency(page.min_amount_cents ?? 0)} - ${formatCurrency(
                            page.max_amount_cents ?? 0,
                          )}`
                      : "Open amount"}
                  </p>
                </div>

                {page.accepts_coupons && (page.coupon_codes ?? []).length ? (
                  <div className="rounded-3xl border border-line bg-background/60 p-4">
                    <p className="text-sm font-semibold text-foreground">Coupons</p>
                    <p className="mt-2 text-sm leading-7 text-muted">
                      Customers can apply codes like {(page.coupon_codes ?? [])
                        .slice(0, 2)
                        .map((coupon) => coupon.code || "NEWCODE")
                        .join(", ")} at checkout.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {page.custom_fields.map((field) => (
                    <div key={field.id} className="rounded-2xl border border-line bg-background/60 p-4">
                      <p className="text-sm font-semibold text-foreground">
                        {field.label || "Field label"}
                        {field.is_required ? " *" : ""}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted">
                        {field.helper_text || field.placeholder || field.type}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
                >
                  Submit Sandbox Payment
                </button>
              </div>
            </div>
          </section>

          {pageId && page.public_url && page.iframe_snippet ? (
            <ShareTools page={page as PaymentPage} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
