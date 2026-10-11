import { getPublicSeo } from "@/lib/seo-settings";

/**
 * Serves the IndexNow ownership file. next.config rewrites /<32 hex>.txt here;
 * the key is only answered when it matches the one saved in the SEO section,
 * so a stale or guessed key is a plain 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { settings } = await getPublicSeo();
  const saved = settings.indexnow?.key;

  if (!saved || saved !== key) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(saved, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
