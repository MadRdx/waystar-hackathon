"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredSession, getCurrentCustomer, getStoredSession } from "@/lib/api";
import type { CustomerUser } from "@/lib/types";

type SessionState = {
  loading: boolean;
  user: CustomerUser | null;
};

export function useCustomerSession(loginPath = "/customer/login") {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    const session = getStoredSession<CustomerUser>("customer");
    if (!session) {
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;

    getCurrentCustomer()
      .then((response) => {
        if (!cancelled) {
          setState({ loading: false, user: response.user });
        }
      })
      .catch(() => {
        clearStoredSession("customer");
        router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
        if (!cancelled) {
          setState({ loading: false, user: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loginPath, pathname, router]);

  return state;
}
