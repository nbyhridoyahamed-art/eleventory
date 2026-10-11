/** SEO metadata for any SEO-bearing entity — see backend App\Models\SeoMetadata. */
export interface Seo {
  title: string | null;
  description: string | null;
  focus_keyword: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  canonical_url: string | null;
  robots: string | null;
  schema_json: Record<string, unknown> | null;
  /** Stored 0–100 on-page score from the backend analyzer; null until the item has been analysed. */
  score?: number | null;
}
