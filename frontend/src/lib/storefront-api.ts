import { ApiError, type ApiResponse, type PaginationMeta } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Every server-rendered page calls the API from this one server's address, so
 * the per-IP rate limit would trip as soon as a few dozen visitors browse at
 * once. The shared secret tells the API the call comes from our own storefront
 * server (not a visitor's browser) and is exempt from that limit. Server-only:
 * never a NEXT_PUBLIC_ variable.
 */
export function serverHeaders(): Record<string, string> {
  const key = process.env.STOREFRONT_SSR_KEY;
  return key ? { Accept: "application/json", "X-Storefront-Key": key } : { Accept: "application/json" };
}

/**
 * A minimal, server-only fetch for the public (unauthenticated) storefront
 * API — used from Server Components, generateMetadata, and sitemap.ts/
 * robots.ts. These can't import src/lib/api.ts: it pulls in auth-token.ts,
 * a "use client" module, and the server can't call a function exported from
 * a Client Component module (only render it as a component).
 */
async function requestStorefront<T>(path: string): Promise<{ data: T; meta?: PaginationMeta }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: serverHeaders(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !json || json.success === false) {
    throw new ApiError(
      json?.message ?? "Something went wrong.",
      response.status,
      json && json.success === false ? json.errors : undefined,
    );
  }

  return { data: json.data, meta: json.meta };
}

export const storefrontApi = {
  /** Fire-and-forget POST for telemetry (e.g. 404 logging); failures are swallowed by callers. */
  post: async (path: string, body: unknown): Promise<void> => {
    await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { ...serverHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  },
  get: async <T>(path: string): Promise<T> => (await requestStorefront<T>(path)).data,
  getWithMeta: <T>(path: string) => requestStorefront<T>(path),
};
