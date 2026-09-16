"use client";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { code: "invalid_response", message: text.slice(0, 200) } };
  }
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ClientApiError(res.status, e.code ?? "error", e.message ?? res.statusText);
  }
  return body;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "same-origin",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  get: (url: string) => fetch(url, { credentials: "same-origin" }).then(parse),
  post: (url: string, body: unknown) => fetch(url, jsonInit("POST", body)).then(parse),
  put: (url: string, body: unknown) => fetch(url, jsonInit("PUT", body)).then(parse),
  patch: (url: string, body: unknown) => fetch(url, jsonInit("PATCH", body)).then(parse),
  delete: (url: string) => fetch(url, { method: "DELETE", credentials: "same-origin" }).then(parse),
  raw: (method: string, url: string, body: BodyInit, contentType: string) =>
    fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": contentType },
      body,
    }).then(parse),
};

export const artifactUrl = (slug: string, rest = "") =>
  `/api/v1/artifacts/${encodeURIComponent(slug)}${rest}`;
