import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/middleware";
import { ok, notFound, serverError } from "@/lib/response";

export const runtime = "nodejs";

// ── GET /api/user/profile
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const result = await db.execute({
      sql: `SELECT
              id, name, email, avatar_url,
              blood_type, height_cm, weight_kg, date_of_birth,
              emergency_contact_name, emergency_contact_phone, primary_physician,
              created_at, updated_at
            FROM users
            WHERE id = ?`,
      args: [userId],
    });

    if (result.rows.length === 0) {
      return notFound("Profil tidak ditemukan");
    }

    return ok(result.rows[0]);
  } catch (error) {
    console.error("[get_profile]", error);
    return serverError();
  }
}

// ── PUT /api/user/profile
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const body = await request.json();
    const {
      name,
      avatar_url,
      blood_type,
      height_cm,
      weight_kg,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      primary_physician,
    } = body;

    // Validasi minimal
    if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
      return { error: "Nama tidak valid" }; // akan ditangani di bawah
    }

    const now = new Date().toISOString();

    await db.execute({
      sql: `UPDATE users SET
              name                    = COALESCE(?, name),
              avatar_url              = COALESCE(?, avatar_url),
              blood_type              = COALESCE(?, blood_type),
              height_cm               = COALESCE(?, height_cm),
              weight_kg               = COALESCE(?, weight_kg),
              date_of_birth           = COALESCE(?, date_of_birth),
              emergency_contact_name  = COALESCE(?, emergency_contact_name),
              emergency_contact_phone = COALESCE(?, emergency_contact_phone),
              primary_physician       = COALESCE(?, primary_physician),
              updated_at              = ?
            WHERE id = ?`,
      args: [
        name?.trim() ?? null,
        avatar_url ?? null,
        blood_type ?? null,
        height_cm ?? null,
        weight_kg ?? null,
        date_of_birth ?? null,
        emergency_contact_name ?? null,
        emergency_contact_phone ?? null,
        primary_physician ?? null,
        now,
        userId,
      ],
    });

    // Kembalikan data terbaru
    const updated = await db.execute({
      sql: `SELECT
              id, name, email, avatar_url,
              blood_type, height_cm, weight_kg, date_of_birth,
              emergency_contact_name, emergency_contact_phone, primary_physician,
              created_at, updated_at
            FROM users
            WHERE id = ?`,
      args: [userId],
    });

    return ok(updated.rows[0], "Profil berhasil diperbarui");
  } catch (error) {
    console.error("[put_profile]", error);
    return serverError();
  }
}
