import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { created, badRequest, conflict, serverError } from "@/lib/response";

export const runtime = "nodejs"; // bcryptjs butuh Node runtime

// ── POST /api/auth/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    // Validasi input
    if (!name || !email || !password) {
      return badRequest("Nama, email, dan password wajib diisi");
    }
    if (name.trim().length < 2) {
      return badRequest("Nama minimal 2 karakter");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("Format email tidak valid");
    }
    if (password.length < 8) {
      return badRequest("Password minimal 8 karakter");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Cek apakah email sudah terdaftar
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [normalizedEmail],
    });

    if (existing.rows.length > 0) {
      return conflict("Email sudah terdaftar");
    }

    // Hash password & buat user baru
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, name.trim(), normalizedEmail, passwordHash, now, now],
    });

    // Buat token
    const accessToken = await signAccessToken({ sub: userId, email: normalizedEmail });
    const refreshToken = await signRefreshToken({ sub: userId, email: normalizedEmail });

    // Simpan refresh token ke DB
    const tokenId = uuidv4();
    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [tokenId, userId, refreshHash, expiresAt],
    });

    return created(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: userId, name: name.trim(), email: normalizedEmail },
      },
      "Registrasi berhasil"
    );
  } catch (error) {
    console.error("[register]", error);
    return serverError();
  }
}
