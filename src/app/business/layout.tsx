import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell role="BUSINESS" basePath="/business">
      {children}
    </AdminShell>
  );
}
