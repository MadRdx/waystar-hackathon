"use client";

import { Suspense } from "react";

import { GoogleCallbackContent } from "@/components/auth/google-callback-content";

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
