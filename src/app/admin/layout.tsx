import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell role="ADMIN" basePath="/admin">
      {children}
    </AdminShell>
  );
}
