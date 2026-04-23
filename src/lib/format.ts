import { format } from "date-fns";

export function formatCurrency(valueCents: number | null | undefined) {
  const safeValue = valueCents ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safeValue / 100);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  try {
    return format(new Date(value), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return value;
  }
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
