import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession(request);
  return json({ session });
});
