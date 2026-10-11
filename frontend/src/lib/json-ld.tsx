import { getPublicSeo } from "@/lib/seo-settings";
import type { SeoSettings } from "@/types/seo-settings";

type JsonLdNode = { "@type"?: string } & Record<string, unknown>;

/** Which SEO-section schema toggle governs a node, by its schema.org @type. */
function isEnabled(node: JsonLdNode, schema: SeoSettings["schema"]): boolean {
  switch (node["@type"]) {
    case "Product":
      return schema.product;
    case "BreadcrumbList":
      return schema.breadcrumb;
    case "Article":
    case "Blog":
    case "CollectionPage":
      return schema.blog;
    case "Organization":
    case "WebSite":
      return schema.organization;
    default:
      return true;
  }
}

/**
 * A `<script type="application/ld+json">` embed is a common XSS vector when
 * the payload includes user-generated text (a product description, a blog
 * title) that happens to contain "</script>" — escaping "<" defeats that
 * without affecting how any JSON-LD consumer parses the payload.
 *
 * It is an async Server Component so it can honour the SEO section's schema
 * switches (turn product / breadcrumb / blog / organization markup off) in one
 * place instead of at every call site.
 */
export function disabledSchemas(seo: { schema_json?: Record<string, unknown> | null } | null | undefined): string[] {
  const raw = seo?.schema_json?.disabled;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

export async function JsonLd({ data, disabled = [] }: { data: object | object[]; disabled?: string[] }) {
  const { settings } = await getPublicSeo();
  const nodes = (Array.isArray(data) ? data : [data]) as JsonLdNode[];
  const allowed = nodes.filter((node) => isEnabled(node, settings.schema) && !disabled.includes(String(node["@type"])));

  if (allowed.length === 0) return null;

  const payload = Array.isArray(data) ? allowed : allowed[0];

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, "\\u003c") }} />;
}

/**
 * FAQPage markup from the question/answer pairs saved in an item's SEO panel.
 * Renders nothing when the item has none, so call sites can include it freely.
 */
export async function FaqJsonLd({ seo }: { seo: { schema_json?: Record<string, unknown> | null } | null | undefined }) {
  const raw = seo?.schema_json?.faq;
  if (!Array.isArray(raw)) return null;

  const items = raw
    .filter((item): item is { question: string; answer: string } => Boolean(item) && typeof item === "object")
    .filter((item) => String(item.question ?? "").trim() && String(item.answer ?? "").trim());
  if (items.length === 0) return null;

  return (
    <JsonLd
      disabled={disabledSchemas(seo)}
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );
}

export function productJsonLd(product: {
  name: string;
  description?: string | null;
  images?: string[];
  sku: string;
  price: number;
  currencyCode: string;
  inStock: boolean;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images,
    sku: product.sku,
    offers: {
      "@type": "Offer",
      url: product.url,
      priceCurrency: product.currencyCode,
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleJsonLd(article: {
  headline: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  authorName?: string | null;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
    description: article.description ?? undefined,
    image: article.image ?? undefined,
    datePublished: article.datePublished ?? undefined,
    author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
    mainEntityOfPage: article.url,
  };
}

/** The blog landing page: a Blog node listing its most recent posts. */
export function blogJsonLd(blog: {
  name: string;
  description?: string | null;
  url: string;
  posts: { title: string; url: string; datePublished?: string | null }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: blog.name,
    description: blog.description ?? undefined,
    url: blog.url,
    blogPost: blog.posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: post.url,
      datePublished: post.datePublished ?? undefined,
    })),
  };
}

/**
 * Organization + WebSite markup. The SEO section's schema settings add the
 * logo, contact details, social profiles and the sitelinks search box.
 */
export function organizationAndWebsiteJsonLd(store: { name: string; url: string }, schema?: SeoSettings["schema"]) {
  const name = schema?.org_name || store.name;
  const sameAs = (schema?.social_profiles ?? []).filter(Boolean);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: store.url,
    logo: schema?.org_logo || undefined,
    telephone: schema?.org_phone || undefined,
    email: schema?.org_email || undefined,
    address: schema?.org_address
      ? { "@type": "PostalAddress", streetAddress: schema.org_address, addressCountry: "BD" }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: store.url,
    potentialAction:
      schema?.website_search === false
        ? undefined
        : {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${store.url}/products?search={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
  };

  return [organization, website];
}
