"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type SessionGuardOptions = {
  requireAuth: boolean;
  redirectAuthenticatedTo?: string;
};

export const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error occurred.";
};

export const useSessionGuard = ({
  requireAuth,
  redirectAuthenticatedTo = "/",
}: SessionGuardOptions) => {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        if (res.ok && !requireAuth) {
          router.replace(redirectAuthenticatedTo);
        }
        if (!res.ok && requireAuth) {
          router.replace("/login");
        }
      } catch {
        if (requireAuth) {
          router.replace("/login");
        }
      }
    };
    check();
  }, [requireAuth, redirectAuthenticatedTo, router]);
};
