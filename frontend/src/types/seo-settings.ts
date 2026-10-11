/** Mirrors backend App\Models\SeoSetting::defaults() — the technical, site-wide SEO configuration. */
export interface SeoSettings {
  site: {
    site_name: string | null;
    default_og_image: string | null;
    twitter_handle: string | null;
  };
  homepage: PageMeta;
  blog: PageMeta;
  robots: {
    mode: "default" | "custom" | "block_all";
    custom: string | null;
    extra_disallow: string[];
  };
  sitemap: {
    enabled: boolean;
    products: boolean;
    categories: boolean;
    brands: boolean;
    pages: boolean;
    blog: boolean;
  };
  schema: {
    organization: boolean;
    website_search: boolean;
    product: boolean;
    breadcrumb: boolean;
    blog: boolean;
    org_name: string | null;
    org_logo: string | null;
    org_phone: string | null;
    org_email: string | null;
    org_address: string | null;
    social_profiles: string[];
  };
  verification: {
    google: string | null;
    bing: string | null;
    yandex: string | null;
    pinterest: string | null;
    facebook: string | null;
    baidu: string | null;
  };
  indexnow: {
    key: string | null;
  };
  analytics: {
    ga4_id: string | null;
    gtm_id: string | null;
    meta_pixel_id: string | null;
    clarity_id: string | null;
  };
}

export interface PageMeta {
  title: string | null;
  description: string | null;
  focus_keyword: string | null;
  og_image: string | null;
}

/** Server-built starting points for the homepage and blog landing page meta. */
export interface SeoSuggestions {
  homepage: { title: string; description: string; focus_keyword: string };
  blog: { title: string; description: string; focus_keyword: string };
}

export interface SeoAuditEntity {
  key: string;
  label: string;
  total: number;
  with_title: number;
  with_description: number;
  with_focus_keyword: number;
  fully_optimized: number;
  good: number;
  ok: number;
  poor: number;
  average_score: number;
}

export interface SeoAuditCheck {
  id: string;
  group: string;
  label: string;
  passed: boolean;
  hint: string;
  fix: string;
}

export interface SeoAttentionItem {
  type: string;
  name: string;
  score: number;
  has_seo: boolean;
  edit: string;
}

export interface SeoAudit {
  overall_score: number;
  site_score: number;
  content_score: number;
  entities: SeoAuditEntity[];
  checks: SeoAuditCheck[];
  needs_attention: SeoAttentionItem[];
}

export interface SeoGenerateResult {
  key: string;
  label: string;
  processed: number;
  updated: number;
}
