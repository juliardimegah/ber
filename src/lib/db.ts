import { createClient } from "@libsql/client";

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL environment variable is not set");
}
if (!process.env.TURSO_AUTH_TOKEN) {
  throw new Error("TURSO_AUTH_TOKEN environment variable is not set");
}

// Singleton pattern agar tidak membuat koneksi baru di setiap request (terutama di dev mode)
const globalForDb = globalThis as unknown as {
  tursoClient: ReturnType<typeof createClient> | undefined;
};

export const db =
  globalForDb.tursoClient ??
  createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.tursoClient = db;
}
