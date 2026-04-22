// Gunakan dotenv untuk membaca .env.local atau .env saat migrasi lokal
import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple dotenv parser
const loadEnv = () => {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  const fallbackEnvPath = path.resolve(__dirname, "..", ".env");

  let p = "";
  if (fs.existsSync(envPath)) p = envPath;
  else if (fs.existsSync(fallbackEnvPath)) p = fallbackEnvPath;

  if (p) {
    const content = fs.readFileSync(p, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#\s][^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
    console.log(`✔ Loaded env from: ${p}`);
  } else {
    console.warn("⚠  .env.local / .env tidak ditemukan, menggunakan environment variable yang ada");
  }
};

async function migrate() {
  loadEnv();

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("❌ TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN harus disediakan di .env.local");
    process.exit(1);
  }

  const db = createClient({ url, authToken });
  console.log("\n🚀 Menjalankan migrasi database Turso...\n");

  try {
    // ── 1. Tabel users ──────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,

        -- Profil tambahan
        avatar_url              TEXT,
        blood_type              TEXT,
        height_cm               REAL,
        weight_kg               REAL,
        date_of_birth           TEXT,
        emergency_contact_name  TEXT,
        emergency_contact_phone TEXT,
        primary_physician       TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    console.log("✔ Tabel 'users' siap");

    // ── 2. Tabel refresh_tokens ─────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✔ Tabel 'refresh_tokens' siap");

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
        ON refresh_tokens(user_id)
    `);
    console.log("✔ Index 'idx_refresh_tokens_user_id' siap");

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
        ON refresh_tokens(expires_at)
    `);
    console.log("✔ Index 'idx_refresh_tokens_expires_at' siap");

    // ── 3. Tabel health_records ─────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS health_records (
        id      TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,

        -- Data kesehatan (sesuai HealthData model di Flutter)
        heart_rate         REAL NOT NULL,
        body_temperature   REAL NOT NULL,
        blood_oxygen       REAL,
        blood_pressure_sys REAL,
        blood_pressure_dia REAL,
        step_count         INTEGER,
        sleep_score        REAL,

        timestamp     TEXT NOT NULL,
        device_source TEXT,
        synced_at     TEXT NOT NULL,

        -- UNIQUE per user+timestamp agar sinkronisasi tidak membuat duplikat
        UNIQUE(user_id, timestamp),

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✔ Tabel 'health_records' siap");

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_health_records_user_timestamp
        ON health_records(user_id, timestamp DESC)
    `);
    console.log("✔ Index 'idx_health_records_user_timestamp' siap");

    console.log("\n──────────────────────────────");
    console.log("✅ Migrasi selesai!");
    console.log("──────────────────────────────\n");
  } catch (error) {
    console.error("❌ Gagal melakukan migrasi:", error);
    process.exit(1);
  }
}

migrate();
