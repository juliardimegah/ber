import { NextResponse } from "next/server";

type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

type ApiError = {
  success: false;
  error: string;
};

export function ok<T>(data: T, message?: string, status = 200) {
  const body: ApiSuccess<T> = { success: true, data, ...(message ? { message } : {}) };
  return NextResponse.json(body, { status });
}

export function created<T>(data: T, message?: string) {
  return ok(data, message, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(error: string) {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 400 });
}

export function unauthorized(error = "Unauthorized") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 401 });
}

export function forbidden(error = "Forbidden") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 403 });
}

export function notFound(error = "Not found") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 404 });
}

export function conflict(error: string) {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 409 });
}

export function serverError(error = "Internal server error") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 500 });
}
