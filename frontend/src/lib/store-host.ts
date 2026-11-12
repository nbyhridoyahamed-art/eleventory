import { headers } from "next/headers";

/**
 * Multi-store mode (server-only; the counterpart of the API's SAAS_MODE). Off,
 * the storefront is one store at NEXT_PUBLIC_SITE_URL exactly as before. On,
 * every request is for whichever store owns the host the shopper is on, so the
 * host is forwarded to the API and used to build canonical URLs.
 */
export const MULTI_STORE = process.env.MULTI_STORE === "true";

const FALLBACK_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** The host of the current request (no port handling: the API strips it), or null outside multi-store mode. */
export async function getStoreHost(): Promise<string | null> {
  if (!MULTI_STORE) return null;

  const host = (await headers()).get("host");

  return host ? host.trim().toLowerCase() : null;
}

/** Public base URL of the store being served: this request's own origin in multi-store mode, the configured URL otherwise. */
export async function getSiteUrl(): Promise<string> {
  const host = await getStoreHost();
  if (!host) return FALLBACK_SITE_URL;

  const hostname = host.split(":")[0];
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost") || hostname.endsWith(".test");
  const forwarded = (await headers()).get("x-forwarded-proto")?.split(",")[0].trim();

  return `${forwarded || (local ? "http" : "https")}://${host}`;
}
