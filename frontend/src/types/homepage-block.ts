export const HOMEPAGE_BLOCK_TYPES = [
  "hero",
  "hero_slider",
  "announcement_bar",
  "featured_products",
  "latest_products",
  "best_sellers",
  "category_grid",
  "category_carousel",
  "brand_carousel",
  "product_carousel",
  "product_tabs",
  "flash_sale",
  "countdown",
  "promo_banner",
  "two_column_banner",
  "three_column_banner",
  "video",
  "image_text",
  "rich_text",
  "testimonials",
  "reviews",
  "faq",
  "newsletter",
  "gallery",
  "trust_badges",
  "statistics",
  "cta",
  "blog_posts",
  "custom_html",
  "custom_css",
  "spacer",
] as const;

export type HomepageBlockType = (typeof HOMEPAGE_BLOCK_TYPES)[number];

export const HOMEPAGE_BLOCK_LABELS: Record<HomepageBlockType, string> = {
  hero: "Hero",
  hero_slider: "Hero Slider",
  announcement_bar: "Announcement Bar",
  featured_products: "Featured Products",
  latest_products: "Latest Products",
  best_sellers: "Best Sellers",
  category_grid: "Category Grid",
  category_carousel: "Category Carousel",
  brand_carousel: "Brand Carousel",
  product_carousel: "Product Carousel",
  product_tabs: "Product Tabs",
  flash_sale: "Flash Sale",
  countdown: "Countdown",
  promo_banner: "Promo Banner",
  two_column_banner: "Two-Column Banner",
  three_column_banner: "Three-Column Banner",
  video: "Video",
  image_text: "Image + Text",
  rich_text: "Rich Text",
  testimonials: "Testimonials",
  reviews: "Reviews",
  faq: "FAQ",
  newsletter: "Newsletter",
  gallery: "Gallery",
  trust_badges: "Trust Badges",
  statistics: "Statistics",
  cta: "Call to Action",
  blog_posts: "Blog Posts",
  custom_html: "Custom HTML",
  custom_css: "Custom CSS",
  spacer: "Spacer",
};

/** Groups the palette shown in the builder's block picker (spec section 58's LEFT panel). */
export const HOMEPAGE_BLOCK_CATEGORIES: { label: string; types: HomepageBlockType[] }[] = [
  { label: "Hero & Banners", types: ["hero", "hero_slider", "announcement_bar", "promo_banner", "two_column_banner", "three_column_banner", "cta", "countdown", "flash_sale"] },
  { label: "Catalog", types: ["featured_products", "latest_products", "best_sellers", "category_grid", "category_carousel", "brand_carousel", "product_carousel", "product_tabs"] },
  { label: "Content", types: ["image_text", "rich_text", "gallery", "video", "faq", "blog_posts"] },
  { label: "Trust & Social Proof", types: ["testimonials", "reviews", "trust_badges", "statistics"] },
  { label: "Engagement", types: ["newsletter"] },
  { label: "Advanced", types: ["custom_html", "custom_css", "spacer"] },
];

export interface BannerItem {
  image_url: string | null;
  link_url: string | null;
  alt_text: string | null;
}

export interface HeroSettings {
  heading: string;
  subheading: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  secondary_cta_label: string | null;
  secondary_cta_url: string | null;
}

export interface HeroSlide {
  heading: string;
  subheading: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
}

export interface HeroSliderSettings {
  slides: HeroSlide[];
  autoplay: boolean;
  interval_seconds: number;
  /** Up to two promo tiles shown stacked beside the slider. */
  side_banners?: BannerItem[];
}

export interface AnnouncementBarSettings {
  text: string;
  link_url: string | null;
  link_label: string | null;
  dismissible: boolean;
}

export interface AutoManualProductSettings {
  heading: string;
  mode: "auto" | "manual";
  limit: number;
  product_ids: number[];
}

export interface LimitOnlySettings {
  heading: string;
  limit: number;
}

export interface AutoManualCategorySettings {
  heading: string;
  mode: "auto" | "manual";
  limit: number;
  category_ids: number[];
}

export interface AutoManualBrandSettings {
  heading: string;
  mode: "auto" | "manual";
  limit: number;
  brand_ids: number[];
}

export interface ProductCarouselSettings {
  heading: string;
  mode: "auto" | "manual" | "category";
  limit: number;
  product_ids: number[];
  category_id: number | null;
}

export interface ProductTab {
  label: string;
  source: "newest" | "sale" | "featured" | "category" | "brand";
  category_slug: string | null;
  brand_slug: string | null;
}

/** A product row with filter tabs; each tab fetches the public product list with its own filter. */
export interface ProductTabsSettings {
  heading: string;
  view_all_url: string | null;
  limit: number;
  tabs: ProductTab[];
}

export interface FlashSaleItem {
  product_id: number;
  sale_price: number;
}

export interface FlashSaleSettings {
  heading: string;
  ends_at: string;
  items: FlashSaleItem[];
}

export interface CountdownSettings {
  heading: string;
  subheading: string | null;
  ends_at: string;
  cta_label: string | null;
  cta_url: string | null;
}

export interface PromoBannerSettings {
  image_url: string | null;
  link_url: string | null;
  alt_text: string | null;
}

export interface MultiBannerSettings {
  banners: BannerItem[];
}

export interface VideoSettings {
  heading: string | null;
  video_url: string | null;
  poster_image_url: string | null;
  autoplay: boolean;
}

export interface ImageTextSettings {
  image_url: string | null;
  heading: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  image_position: "left" | "right";
}

export interface RichTextSettings {
  heading: string | null;
  body: string | null;
}

export interface AutoManualTestimonialSettings {
  heading: string;
  mode: "auto" | "manual";
  limit: number;
  testimonial_ids: number[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSettings {
  heading: string | null;
  items: FaqItem[];
}

export interface NewsletterSettings {
  heading: string;
  subheading: string | null;
  cta_label: string;
}

export interface GalleryImage {
  image_url: string;
  alt_text: string | null;
}

export interface GallerySettings {
  heading: string | null;
  images: GalleryImage[];
}

export interface IconLabelItem {
  icon: string;
  label: string;
}

export interface TrustBadgesSettings {
  heading: string | null;
  items: IconLabelItem[];
}

export interface ValueLabelItem {
  value: string;
  label: string;
}

export interface StatisticsSettings {
  heading: string | null;
  items: ValueLabelItem[];
}

export interface CtaSettings {
  heading: string;
  subheading: string | null;
  cta_label: string;
  cta_url: string;
  background_image_url: string | null;
}

export interface CustomHtmlSettings {
  html: string | null;
}

export interface CustomCssSettings {
  css: string | null;
}

export interface SpacerSettings {
  height_px: number;
}

export interface HomepageBlockSettingsMap {
  hero: HeroSettings;
  hero_slider: HeroSliderSettings;
  announcement_bar: AnnouncementBarSettings;
  featured_products: AutoManualProductSettings;
  latest_products: LimitOnlySettings;
  best_sellers: LimitOnlySettings;
  category_grid: AutoManualCategorySettings;
  category_carousel: AutoManualCategorySettings;
  brand_carousel: AutoManualBrandSettings;
  product_carousel: ProductCarouselSettings;
  product_tabs: ProductTabsSettings;
  flash_sale: FlashSaleSettings;
  countdown: CountdownSettings;
  promo_banner: PromoBannerSettings;
  two_column_banner: MultiBannerSettings;
  three_column_banner: MultiBannerSettings;
  video: VideoSettings;
  image_text: ImageTextSettings;
  rich_text: RichTextSettings;
  testimonials: AutoManualTestimonialSettings;
  reviews: AutoManualTestimonialSettings;
  faq: FaqSettings;
  newsletter: NewsletterSettings;
  gallery: GallerySettings;
  trust_badges: TrustBadgesSettings;
  statistics: StatisticsSettings;
  cta: CtaSettings;
  blog_posts: LimitOnlySettings;
  custom_html: CustomHtmlSettings;
  custom_css: CustomCssSettings;
  spacer: SpacerSettings;
}

export interface BreakpointStyle {
  width?: string | null;
  height?: string | null;
  padding?: string | null;
  margin?: string | null;
  font_size?: string | null;
  columns?: number | null;
  gap?: string | null;
  alignment?: "left" | "center" | "right" | "stretch" | null;
  display?: "block" | "flex" | "grid" | "none" | null;
}

export interface HomepageBlockResponsive {
  desktop?: BreakpointStyle;
  tablet?: BreakpointStyle;
  mobile?: BreakpointStyle;
}

export interface HomepageBlockVisibility {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
}

export interface HomepageBlockStyles {
  background_color?: string | null;
  text_color?: string | null;
  border_radius?: string | null;
  box_shadow?: string | null;
  /** Advanced tab escape hatch — an extra class name applied to the block's wrapper. */
  custom_class?: string | null;
}

export type HomepageBlockAnimation = "none" | "fade" | "slide" | "scale" | "reveal" | null;

export interface HomepageBlock<T extends HomepageBlockType = HomepageBlockType> {
  id: number;
  uuid: string;
  store_id: number;
  type: T;
  settings: HomepageBlockSettingsMap[T];
  styles: HomepageBlockStyles;
  responsive: HomepageBlockResponsive;
  visibility: HomepageBlockVisibility;
  animation: HomepageBlockAnimation;
  sort_order: number;
  is_active: boolean;
  scheduled_at: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomepageBlockRevision {
  id: number;
  snapshot: {
    type: HomepageBlockType;
    settings: Record<string, unknown>;
    styles: HomepageBlockStyles;
    responsive: HomepageBlockResponsive;
    visibility: HomepageBlockVisibility;
    animation: HomepageBlockAnimation;
    is_active: boolean;
  };
  created_by: string | null;
  created_at: string;
}

export interface SavedSection {
  id: number;
  uuid: string;
  store_id: number;
  name: string;
  type: HomepageBlockType;
  settings: Record<string, unknown>;
  styles: HomepageBlockStyles;
  responsive: HomepageBlockResponsive;
  visibility: HomepageBlockVisibility;
  animation: HomepageBlockAnimation;
  created_at: string;
  updated_at: string;
}

export type Breakpoint = "desktop" | "tablet" | "mobile";
