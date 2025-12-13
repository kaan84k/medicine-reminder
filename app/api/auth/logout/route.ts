import { json, withErrorHandling } from "@/lib/http";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = withErrorHandling(() => {
  const response = json({ success: true });
  clearSessionCookie(response);
  return response;
});
