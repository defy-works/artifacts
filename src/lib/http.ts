import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof TypeError) {
    return NextResponse.json(
      { error: { code: "invalid_argument", message: err.message } },
      { status: 400 },
    );
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: { code: "internal", message } }, { status: 500 });
}

/** Wrap a route handler so thrown ApiErrors become JSON responses. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "invalid_argument", "Body must be JSON");
  }
}
