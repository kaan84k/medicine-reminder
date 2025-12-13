import { NextRequest, NextResponse } from "next/server";

import { EnvironmentError } from "@/lib/env";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type HandlerResult = NextResponse | Response | Promise<NextResponse | Response>;
type RouteHandler = (request: NextRequest, context?: unknown) => HandlerResult;

export const withErrorHandling = (handler: RouteHandler) => {
  return async (request: NextRequest, context?: unknown) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      if (error instanceof EnvironmentError) {
        return NextResponse.json(
          {
            error: "Server configuration error",
            missing: error.missing,
          },
          { status: 500 }
        );
      }

      console.error("Unhandled API error", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
};

export const json = <T>(data: T, init: ResponseInit = {}) => {
  return NextResponse.json(data, init);
};

export const readJson = async <T>(request: NextRequest): Promise<T> => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "Request must be application/json");
  }

  try {
    return await request.json();
  } catch (error) {
    console.error("Failed to parse JSON body", error);
    throw new ApiError(400, "Invalid JSON body");
  }
};
