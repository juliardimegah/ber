import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/middleware";
import { ok, serverError } from "@/lib/response";

export const runtime = "nodejs";

// ── GET /api/health/summary
// Ringkasan statistik data kesehatan (rata-rata 7 hari terakhir)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "7"), 90);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString();

    // Statistik agregat
    const statsResult = await db.execute({
      sql: `SELECT
              COUNT(*)                    AS record_count,
              AVG(heart_rate)             AS avg_heart_rate,
              MIN(heart_rate)             AS min_heart_rate,
              MAX(heart_rate)             AS max_heart_rate,
              AVG(body_temperature)       AS avg_body_temperature,
              AVG(blood_oxygen)           AS avg_blood_oxygen,
              AVG(blood_pressure_sys)     AS avg_blood_pressure_sys,
              AVG(blood_pressure_dia)     AS avg_blood_pressure_dia,
              SUM(step_count)             AS total_steps,
              AVG(sleep_score)            AS avg_sleep_score
            FROM health_records
            WHERE user_id = ? AND timestamp >= ?`,
      args: [userId, since],
    });

    // Data terbaru (record paling akhir)
    const latestResult = await db.execute({
      sql: `SELECT
              heart_rate, body_temperature, blood_oxygen,
              blood_pressure_sys, blood_pressure_dia,
              step_count, sleep_score, timestamp, device_source
            FROM health_records
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 1`,
      args: [userId],
    });

    return ok({
      period_days: days,
      since,
      stats: statsResult.rows[0] ?? null,
      latest: latestResult.rows[0] ?? null,
    });
  } catch (error) {
    console.error("[get_health_summary]", error);
    return serverError();
  }
}
