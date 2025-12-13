type EnvOptions = {
  /**
   * When true, enforce that an auth secret is present (JWT_SECRET or AUTH_SECRET).
   * Leave false for routes that do not require auth yet.
   */
  requireAuthSecret?: boolean;
};

export type AppEnv = {
  DATABASE_URL: string;
  JWT_SECRET?: string;
  AUTH_SECRET?: string;
  NODE_ENV: string;
};

export class EnvironmentError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(`Missing required environment variables: ${missing.join(", ")}`);
    this.name = "EnvironmentError";
    this.missing = missing;
  }
}

export const getEnv = (options: EnvOptions = {}): AppEnv => {
  const missing: string[] = [];

  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  const authSecret = process.env.AUTH_SECRET;

  if (!databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (options.requireAuthSecret && !jwtSecret && !authSecret) {
    missing.push("JWT_SECRET or AUTH_SECRET");
  }

  if (missing.length > 0) {
    throw new EnvironmentError(missing);
  }

  return {
    DATABASE_URL: databaseUrl ?? "",
    JWT_SECRET: jwtSecret,
    AUTH_SECRET: authSecret,
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
};
