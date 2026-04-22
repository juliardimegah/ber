import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/middleware";
import { verifyToken, type JwtPayload } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/response";

export const runtime = "nodejs"; // bcryptjs butuh Node runtime

// ── POST /api/auth/logout
// Menerima refresh_token untuk di-revoke dari database
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const body = await request.json();
    const { refresh_token } = body as { refresh_token?: string };

    if (!refresh_token) {
      return badRequest("Refresh token diperlukan");
    }

    // Verifikasi token terlebih dahulu agar tidak brute-force scan
    const payload = (await verifyToken(refresh_token)) as JwtPayload | null;
    if (!payload?.sub || payload.sub !== userId) {
      return badRequest("Refresh token tidak valid");
    }

    // Cari dan revoke token yang cocok
    const result = await db.execute({
      sql: "SELECT id, token_hash FROM refresh_tokens WHERE user_id = ?",
      args: [userId],
    });

    for (const row of result.rows) {
      const match = await bcrypt.compare(refresh_token, row.token_hash as string);
      if (match) {
        await db.execute({
          sql: "DELETE FROM refresh_tokens WHERE id = ?",
          args: [row.id],
        });
        break;
      }
    }

    return ok(null, "Logout berhasil");
  } catch (error) {
    console.error("[logout]", error);
    return serverError();
  }
}
