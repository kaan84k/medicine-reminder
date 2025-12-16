import { config } from "dotenv";

config({ path: ".env.test", override: true });
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

process.env.NODE_ENV = "test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("Set TEST_DATABASE_URL (or DATABASE_URL) before running tests.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET;
process.env.TZ = "UTC";
