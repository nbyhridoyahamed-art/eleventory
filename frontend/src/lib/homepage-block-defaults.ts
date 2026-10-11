import type { HomepageBlockSettingsMap, HomepageBlockType } from "@/types/homepage-block";

/**
 * Mirrors the backend's `App\Support\HomepageBlockTypes::defaultSettings()`
 * exactly — what a freshly-added block of this type starts with, so the
 * create request is valid on the first save without an empty-fields error.
 */
export const HOMEPAGE_BLOCK_DEFAULTS: { [K in HomepageBlockType]: HomepageBlockSettingsMap[K] } = {
  hero: { heading: "Welcome to our store", subheading: null, image_url: null, cta_label: "Shop All Products", cta_url: "/products", secondary_cta_label: null, secondary_cta_url: null },
  hero_slider: { slides: [{ heading: "New Arrivals", subheading: null, image_url: null, cta_label: "Shop Now", cta_url: "/products" }], autoplay: true, interval_seconds: 5, side_banners: [] },
  announcement_bar: { text: "Free delivery on orders over ৳1,000", link_url: null, link_label: null, dismissible: true },
  featured_products: { heading: "Featured Products", mode: "auto", limit: 5, product_ids: [] },
  latest_products: { heading: "Latest Arrivals", limit: 8 },
  best_sellers: { heading: "Best Sellers", limit: 8 },
  category_grid: { heading: "Shop by Category", mode: "auto", limit: 6, category_ids: [] },
  category_carousel: { heading: "Browse Categories", mode: "auto", limit: 8, category_ids: [] },
  brand_carousel: { heading: "Shop by Brand", mode: "auto", limit: 8, brand_ids: [] },
  product_carousel: { heading: "You Might Also Like", mode: "auto", limit: 10, product_ids: [], category_id: null },
  product_tabs: { heading: "Featured Products", view_all_url: "/products", limit: 10, tabs: [{ label: "New Arrivals", source: "newest", category_slug: null, brand_slug: null }, { label: "On Sale", source: "sale", category_slug: null, brand_slug: null }] },
  flash_sale: { heading: "Flash Sale", ends_at: new Date(Date.now() + 86400000).toISOString(), items: [] },
  countdown: { heading: "Limited Time Offer", subheading: null, ends_at: new Date(Date.now() + 86400000).toISOString(), cta_label: null, cta_url: null },
  promo_banner: { image_url: null, link_url: "/products", alt_text: null },
  two_column_banner: { banners: [{ image_url: null, link_url: null, alt_text: null }, { image_url: null, link_url: null, alt_text: null }] },
  three_column_banner: { banners: [{ image_url: null, link_url: null, alt_text: null }, { image_url: null, link_url: null, alt_text: null }, { image_url: null, link_url: null, alt_text: null }] },
  video: { heading: null, video_url: null, poster_image_url: null, autoplay: false },
  image_text: { image_url: null, heading: "About Us", body: "Tell your story here.", cta_label: null, cta_url: null, image_position: "left" },
  rich_text: { heading: null, body: null },
  testimonials: { heading: "What Our Customers Say", mode: "auto", limit: 3, testimonial_ids: [] },
  reviews: { heading: "Customer Reviews", mode: "auto", limit: 3, testimonial_ids: [] },
  faq: {
    heading: "Frequently Asked Questions",
    items: [{ question: "What is your return policy?", answer: "Contact us within 7 days of delivery for a full refund or exchange." }],
  },
  newsletter: { heading: "Stay in the loop", subheading: "Subscribe for offers and updates.", cta_label: "Subscribe" },
  gallery: { heading: null, images: [] },
  trust_badges: { heading: null, items: [{ icon: "truck", label: "Cash on Delivery" }, { icon: "shield", label: "Easy Returns" }] },
  statistics: { heading: null, items: [{ value: "10,000+", label: "Happy Customers" }] },
  cta: { heading: "Ready to shop?", subheading: null, cta_label: "Shop Now", cta_url: "/products", background_image_url: null },
  blog_posts: { heading: "From the Blog", limit: 3 },
  custom_html: { html: null },
  custom_css: { css: null },
  spacer: { height_px: 40 },
};
