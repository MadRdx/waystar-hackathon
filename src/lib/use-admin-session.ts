"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredSession, getCurrentPortalUser, getStoredSession } from "@/lib/api";
import type { PortalRole, PortalUser } from "@/lib/types";

type SessionState = {
  loading: boolean;
  user: PortalUser | null;
};

export function usePortalSession({
  allowedRole,
  loginPath,
}: {
  allowedRole: PortalRole;
  loginPath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    const session = getStoredSession<PortalUser>("portal");
    if (!session) {
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;

    getCurrentPortalUser()
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.user.role !== allowedRole) {
          clearStoredSession("portal");
          router.replace(loginPath);
          setState({ loading: false, user: null });
          return;
        }

        setState({ loading: false, user: response.user });
      })
      .catch(() => {
        clearStoredSession("portal");
        router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
        if (!cancelled) {
          setState({ loading: false, user: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRole, loginPath, pathname, router]);

  return state;
}
