import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isCsrfSafe } from "@/lib/csrf";

const PUBLIC_PATHS = ["/api/health", "/api/auth/signup", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // CSRF gate on state-changing requests — runs before the public-path bypass so
  // login/signup POSTs are also protected against cross-origin submission.
  if (!isCsrfSafe(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const headerToken =
    request.headers.get("authorization")?.replace("Bearer ", "") ?? undefined;
  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  const token = headerToken ?? cookieToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifySessionToken(token);
    return NextResponse.next();
  } catch (error) {
    console.warn("Unauthorized request blocked", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: "/api/:path*",
};
