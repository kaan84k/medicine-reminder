import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { clearSessionCookie, getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Server-side invalidation: bump the user's tokenVersion so every token
  // issued before this logout stops authenticating, not just the cookie we
  // clear on this response. Best-effort — an unauthenticated/expired caller
  // still gets a clean cookie clear.
  const session = await getSessionFromRequest(request);
  if (session) {
    await prisma.user.update({
      where: { id: session.sub },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  const response = json({ success: true });
  clearSessionCookie(response);
  return response;
});
