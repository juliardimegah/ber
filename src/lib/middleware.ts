import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken, type JwtPayload } from "@/lib/auth";
import { unauthorized } from "@/lib/response";

export type AuthContext = {
  userId: string;
  email: string;
};

/**
 * Guard function — verifikasi JWT dari Authorization header.
 * Jika valid, kembalikan { userId, email }.
 * Jika tidak valid, kembalikan Response 401 yang siap dikirim.
 *
 * Cara pakai:
 * ```ts
 * const auth = await requireAuth(request);
 * if (auth instanceof Response) return auth;
 * // auth.userId, auth.email tersedia di sini
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthContext | Response> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return unauthorized("Token tidak ditemukan");

  const payload = (await verifyToken(token)) as JwtPayload | null;
  if (!payload?.sub) return unauthorized("Token tidak valid atau sudah kedaluwarsa");

  // Pastikan user masih ada di database (belum dihapus)
  const result = await db.execute({
    sql: "SELECT id, email FROM users WHERE id = ?",
    args: [payload.sub],
  });

  if (result.rows.length === 0) {
    return unauthorized("Akun tidak ditemukan");
  }

  return {
    userId: payload.sub,
    email: payload.email,
  };
}
