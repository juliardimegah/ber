import { createClient } from "@libsql/client";

function createDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // Saat next build, env vars mungkin belum tersedia — kembalikan null-safe proxy
  // agar build tidak crash. Error sesungguhnya akan muncul saat request runtime.
  if (!url || !authToken) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN tidak ditemukan");
    }
    return null;
  }

  return createClient({ url, authToken });
}

// Singleton pattern agar tidak membuat koneksi baru di setiap request (dev mode)
const globalForDb = globalThis as unknown as {
  tursoClient: ReturnType<typeof createClient> | null | undefined;
};

const client = globalForDb.tursoClient ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.tursoClient = client;
}

// Wrapper yang memastikan client tersedia saat digunakan (runtime)
export function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Database belum dikonfigurasi. Set TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN di environment variables."
    );
  }

  return client ?? createClient({ url, authToken });
}

// Shorthand untuk digunakan di route handlers
export const db = {
  execute: (...args: Parameters<ReturnType<typeof createClient>["execute"]>) =>
    getDb().execute(...args),
  batch: (...args: Parameters<ReturnType<typeof createClient>["batch"]>) =>
    getDb().batch(...args),
};
