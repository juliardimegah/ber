import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/middleware";
import { ok, badRequest, serverError } from "@/lib/response";

export const runtime = "nodejs";

type SyncItem = {
  heart_rate: number;
  body_temperature: number;
  blood_oxygen?: number | null;
  blood_pressure_sys?: number | null;
  blood_pressure_dia?: number | null;
  step_count?: number | null;
  sleep_score?: number | null;
  timestamp: string; // ISO 8601
  device_source?: string | null;
};

// ── GET /api/health/sync
// Ambil riwayat data kesehatan user dengan pagination
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);
    const from = searchParams.get("from"); // tanggal mulai (ISO 8601)
    const to = searchParams.get("to");     // tanggal akhir (ISO 8601)

    let sql = `
      SELECT
        id, heart_rate, body_temperature, blood_oxygen,
        blood_pressure_sys, blood_pressure_dia,
        step_count, sleep_score, timestamp, device_source, synced_at
      FROM health_records
      WHERE user_id = ?
    `;
    const args: (string | number)[] = [userId];

    if (from) {
      sql += " AND timestamp >= ?";
      args.push(from);
    }
    if (to) {
      sql += " AND timestamp <= ?";
      args.push(to);
    }

    sql += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const result = await db.execute({ sql, args });

    // Hitung total untuk pagination
    let countSql = "SELECT COUNT(*) as total FROM health_records WHERE user_id = ?";
    const countArgs: (string | number)[] = [userId];
    if (from) { countSql += " AND timestamp >= ?"; countArgs.push(from); }
    if (to) { countSql += " AND timestamp <= ?"; countArgs.push(to); }

    const countResult = await db.execute({ sql: countSql, args: countArgs });
    const total = (countResult.rows[0] as unknown as { total: number }).total;

    return ok({
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[get_health]", error);
    return serverError();
  }
}

// ── POST /api/health/sync
// Sinkronisasi batch data kesehatan dari perangkat
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const body = await request.json();
    const { data } = body as { data: SyncItem[] };

    if (!Array.isArray(data)) {
      return badRequest("Format tidak valid: field 'data' harus berupa array");
    }

    if (data.length === 0) {
      return ok({ synced_count: 0 }, "Tidak ada data untuk disinkronisasi");
    }

    if (data.length > 500) {
      return badRequest("Maksimum 500 data per request");
    }

    // Validasi setiap item
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item.heart_rate !== "number" || item.heart_rate <= 0) {
        return badRequest(`Data ke-${i + 1}: heart_rate tidak valid`);
      }
      if (typeof item.body_temperature !== "number" || item.body_temperature <= 0) {
        return badRequest(`Data ke-${i + 1}: body_temperature tidak valid`);
      }
      if (!item.timestamp || isNaN(Date.parse(item.timestamp))) {
        return badRequest(`Data ke-${i + 1}: timestamp tidak valid (gunakan format ISO 8601)`);
      }
    }

    // Gunakan batch transaction untuk performa optimal
    const syncedAt = new Date().toISOString();
    const queries = data.map((item) => ({
      sql: `INSERT INTO health_records (
              id, user_id, heart_rate, body_temperature, blood_oxygen,
              blood_pressure_sys, blood_pressure_dia, step_count,
              sleep_score, timestamp, device_source, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, timestamp) DO UPDATE SET
              heart_rate          = excluded.heart_rate,
              body_temperature    = excluded.body_temperature,
              blood_oxygen        = excluded.blood_oxygen,
              blood_pressure_sys  = excluded.blood_pressure_sys,
              blood_pressure_dia  = excluded.blood_pressure_dia,
              step_count          = excluded.step_count,
              sleep_score         = excluded.sleep_score,
              device_source       = excluded.device_source,
              synced_at           = excluded.synced_at`,
      args: [
        uuidv4(),
        userId,
        item.heart_rate,
        item.body_temperature,
        item.blood_oxygen ?? null,
        item.blood_pressure_sys ?? null,
        item.blood_pressure_dia ?? null,
        item.step_count ?? null,
        item.sleep_score ?? null,
        item.timestamp,
        item.device_source ?? null,
        syncedAt,
      ],
    }));

    await db.batch(queries, "write");

    return ok({ synced_count: data.length }, "Sinkronisasi berhasil");
  } catch (error) {
    console.error("[post_health_sync]", error);
    return serverError();
  }
}
