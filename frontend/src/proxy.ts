import { NextResponse, type NextRequest } from "next/server";

/**
 * Multi-store mode only (MULTI_STORE=true; otherwise this does nothing).
 *
 * A request on a store's own address (custom domain or {slug}.<platform domain>)
 * is shown the "store unavailable" page, with a 503, when the API says no store
 * owns that host or the store is closed. That keeps every other page, and its
 * metadata calls, from ever running for a shop that is not open.
 *
 * A store that has a primary custom domain is served only there: its other
 * addresses get a permanent redirect to it (the API reports it as canonical_host).
 *
 * Platform hosts (the marketing site, sign-up and merchant admin) are listed in
 * PLATFORM_HOSTS and pass straight through.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const MULTI_STORE = process.env.MULTI_STORE === "true";
const PLATFORM_HOSTS = new Set(
  (process.env.PLATFORM_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

/** How long a host's answer is remembered, so a busy shop costs the API one check per interval, not one per request. */
const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
interface HostState {
  open: boolean;
  /** The store's primary custom domain; every other address of the store redirects to it. */
  canonical: string | null;
  at: number;
}

const known = new Map<string, HostState>();

async function lookup(host: string): Promise<HostState> {
  const hit = known.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;

  const state: HostState = { open: true, canonical: null, at: Date.now() }; // an API hiccup must not take every shop offline
  try {
    const key = process.env.STOREFRONT_SSR_KEY;
    const response = await fetch(`${API_BASE_URL}/storefront/store`, {
      headers: { Accept: "application/json", "X-Store-Host": host, ...(key ? { "X-Storefront-Key": key } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (response.status === 404 || response.status === 503) {
      state.open = false;
    } else if (response.ok) {
      const json = (await response.json()) as { data?: { canonical_host?: string | null } };
      state.canonical = json.data?.canonical_host?.toLowerCase() || null;
    }
  } catch {
    // keep the defaults
  }

  if (known.size >= MAX_ENTRIES) known.clear(); // hosts are attacker-chosen: bound the memory
  known.set(host, state);

  return state;
}

export async function proxy(request: NextRequest) {
  if (!MULTI_STORE) return NextResponse.next();

  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;

  if (!host || PLATFORM_HOSTS.has(host) || PLATFORM_HOSTS.has(host.split(":")[0]) || pathname === "/store-unavailable") {
    return NextResponse.next();
  }

  const state = await lookup(host);

  if (!state.open) {
    return NextResponse.rewrite(new URL("/store-unavailable", request.url), { status: 503 });
  }

  // A store with a primary custom domain has one public address; the free
  // address, www/bare variants and secondary domains all lead there.
  if (state.canonical && state.canonical !== host.split(":")[0]) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";

    return NextResponse.redirect(`${proto}://${state.canonical}${pathname}${request.nextUrl.search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: static files and Next internals have a dot or start with _next.
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
