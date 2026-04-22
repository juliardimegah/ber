import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { ok, badRequest, unauthorized, serverError } from "@/lib/response";

export const runtime = "nodejs"; // bcryptjs butuh Node runtime

// ── POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return badRequest("Email dan password wajib diisi");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Cari user berdasarkan email
    const result = await db.execute({
      sql: "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      args: [normalizedEmail],
    });

    if (result.rows.length === 0) {
      return unauthorized("Email atau password salah");
    }

    const user = result.rows[0] as unknown as {
      id: string;
      name: string;
      email: string;
      password_hash: string;
    };

    // Verifikasi password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return unauthorized("Email atau password salah");
    }

    // Buat token
    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });

    // Simpan refresh token ke DB
    const tokenId = uuidv4();
    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [tokenId, user.id, refreshHash, expiresAt],
    });

    return ok(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: user.id, name: user.name, email: user.email },
      },
      "Login berhasil"
    );
  } catch (error) {
    console.error("[login]", error);
    return serverError();
  }
}
