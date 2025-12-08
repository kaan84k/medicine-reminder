import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/http";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "session-token";

export type SessionPayload = {
  sub: string;
  email: string;
};

const getSecretKey = async () => {
  const env = getEnv({ requireAuthSecret: true });
  const secret = env.JWT_SECRET ?? env.AUTH_SECRET;
  if (!secret) {
    throw new ApiError(500, "Missing auth secret");
  }
  return new TextEncoder().encode(secret);
};

export const hashPassword = async (password: string) => {
  const rounds = 10;
  return bcrypt.hash(password, rounds);
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  return bcrypt.compare(password, passwordHash);
};

export const issueSessionToken = async (payload: SessionPayload, expiresInHours = 12) => {
  const secretKey = await getSecretKey();
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 60 * 60;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(secretKey);
};

export const verifySessionToken = async (token: string) => {
  const secretKey = await getSecretKey();
  const { payload } = await jwtVerify<SessionPayload>(token, secretKey);
  return payload;
};

export const setSessionCookie = (response: NextResponse, token: string) => {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
};

export const getSessionFromRequest = async (request: NextRequest) => {
  const headerToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const cookieStore = cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
  const token = headerToken || cookieToken;
  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch (error) {
    console.warn("Invalid session token", error);
    return null;
  }
};

export const requireSession = async (request: NextRequest) => {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
};
