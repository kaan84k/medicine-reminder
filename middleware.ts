import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/api/health", "/api/auth/signup", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
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
