import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { signAccessToken, signRefreshToken, verifyToken, type JwtPayload } from "@/lib/auth";
import { ok, badRequest, unauthorized, serverError } from "@/lib/response";

export const runtime = "nodejs"; // bcryptjs butuh Node runtime

// ── POST /api/auth/refresh
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body as { refresh_token?: string };

    if (!refresh_token) {
      return badRequest("Refresh token diperlukan");
    }

    // Verifikasi JWT (pastikan belum expired dan valid secara struktur)
    const payload = (await verifyToken(refresh_token)) as JwtPayload | null;
    if (!payload?.sub) {
      return unauthorized("Refresh token tidak valid atau kedaluwarsa");
    }
    const userId = payload.sub;

    // Cari semua token aktif milik user ini
    const result = await db.execute({
      sql: "SELECT id, token_hash FROM refresh_tokens WHERE user_id = ? AND expires_at > datetime('now')",
      args: [userId],
    });

    let foundTokenId: string | null = null;
    for (const row of result.rows) {
      const match = await bcrypt.compare(refresh_token, row.token_hash as string);
      if (match) {
        foundTokenId = row.id as string;
        break;
      }
    }

    if (!foundTokenId) {
      return unauthorized("Refresh token tidak dikenali (mungkin sudah di-revoke)");
    }

    // Hapus token lama (token rotation untuk keamanan)
    await db.execute({
      sql: "DELETE FROM refresh_tokens WHERE id = ?",
      args: [foundTokenId],
    });

    // Buat pasangan token baru
    const email = payload.email;
    const newAccessToken = await signAccessToken({ sub: userId, email });
    const newRefreshToken = await signRefreshToken({ sub: userId, email });

    // Simpan refresh token baru
    const newTokenId = uuidv4();
    const newRefreshHash = await bcrypt.hash(newRefreshToken, 8);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [newTokenId, userId, newRefreshHash, expiresAt],
    });

    return ok({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    }, "Token berhasil diperbarui");
  } catch (error) {
    console.error("[refresh]", error);
    return serverError();
  }
}
