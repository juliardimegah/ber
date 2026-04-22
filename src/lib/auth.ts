import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  iat?: number;
  exp?: number;
}

/** Buat access token (default: 15 menit) */
export async function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRY ?? "15m")
    .sign(JWT_SECRET);
}

/** Buat refresh token (default: 30 hari) */
export async function signRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRY ?? "30d")
    .sign(JWT_SECRET);
}

/** Verifikasi token, return payload atau null jika invalid/expired */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Ekstrak Bearer token dari Authorization header */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
