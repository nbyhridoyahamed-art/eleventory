import type { ComponentType } from "react";

import { AnnouncementBarPanel } from "@/components/builder/panels/announcement-bar-panel";
import { BestSellersPanel } from "@/components/builder/panels/best-sellers-panel";
import { BlogPostsPanel } from "@/components/builder/panels/blog-posts-panel";
import { BrandCarouselPanel } from "@/components/builder/panels/brand-carousel-panel";
import { CategoryCarouselPanel } from "@/components/builder/panels/category-carousel-panel";
import { CategoryGridPanel } from "@/components/builder/panels/category-grid-panel";
import { CountdownPanel } from "@/components/builder/panels/countdown-panel";
import { CtaPanel } from "@/components/builder/panels/cta-panel";
import { CustomCssPanel } from "@/components/builder/panels/custom-css-panel";
import { CustomHtmlPanel } from "@/components/builder/panels/custom-html-panel";
import { FaqPanel } from "@/components/builder/panels/faq-panel";
import { FeaturedProductsPanel } from "@/components/builder/panels/featured-products-panel";
import { FlashSalePanel } from "@/components/builder/panels/flash-sale-panel";
import { GalleryPanel } from "@/components/builder/panels/gallery-panel";
import { HeroPanel } from "@/components/builder/panels/hero-panel";
import { HeroSliderPanel } from "@/components/builder/panels/hero-slider-panel";
import { ImageTextPanel } from "@/components/builder/panels/image-text-panel";
import { LatestProductsPanel } from "@/components/builder/panels/latest-products-panel";
import { MultiColumnBannerPanel } from "@/components/builder/panels/multi-column-banner-panel";
import { NewsletterPanel } from "@/components/builder/panels/newsletter-panel";
import { ProductCarouselPanel } from "@/components/builder/panels/product-carousel-panel";
import { PromoBannerPanel } from "@/components/builder/panels/promo-banner-panel";
import { RichTextPanel } from "@/components/builder/panels/rich-text-panel";
import { SpacerPanel } from "@/components/builder/panels/spacer-panel";
import { StatisticsPanel } from "@/components/builder/panels/statistics-panel";
import { TestimonialsPanel } from "@/components/builder/panels/testimonials-panel";
import { TrustBadgesPanel } from "@/components/builder/panels/trust-badges-panel";
import { ProductTabsPanel } from "@/components/builder/panels/product-tabs-panel";
import { VideoPanel } from "@/components/builder/panels/video-panel";
import type { ContentPanelProps } from "@/components/builder/panel-types";
import type { HomepageBlockType } from "@/types/homepage-block";

/**
 * The block registry's Content-tab half (spec section 60: "Create a block
 * registry. Do not build one giant conditional renderer."). Every block
 * type must have an entry here — BuilderPanel looks it up by `block.type`
 * and renders it with the block's current settings. `testimonials` and
 * `reviews` share one panel (identical settings shape, only the storefront
 * card treatment differs); `two_column_banner`/`three_column_banner`
 * likewise share one panel (same shape, fixed array length).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each entry's props are internally consistent for its own type; the map itself is necessarily heterogeneous
export const CONTENT_PANELS: Partial<Record<HomepageBlockType, ComponentType<ContentPanelProps<any>>>> = {
  hero: HeroPanel,
  hero_slider: HeroSliderPanel,
  announcement_bar: AnnouncementBarPanel,
  featured_products: FeaturedProductsPanel,
  latest_products: LatestProductsPanel,
  best_sellers: BestSellersPanel,
  category_grid: CategoryGridPanel,
  category_carousel: CategoryCarouselPanel,
  brand_carousel: BrandCarouselPanel,
  product_carousel: ProductCarouselPanel,
  product_tabs: ProductTabsPanel,
  flash_sale: FlashSalePanel,
  countdown: CountdownPanel,
  promo_banner: PromoBannerPanel,
  two_column_banner: MultiColumnBannerPanel,
  three_column_banner: MultiColumnBannerPanel,
  video: VideoPanel,
  image_text: ImageTextPanel,
  rich_text: RichTextPanel,
  testimonials: TestimonialsPanel,
  reviews: TestimonialsPanel,
  faq: FaqPanel,
  newsletter: NewsletterPanel,
  gallery: GalleryPanel,
  trust_badges: TrustBadgesPanel,
  statistics: StatisticsPanel,
  cta: CtaPanel,
  blog_posts: BlogPostsPanel,
  custom_html: CustomHtmlPanel,
  custom_css: CustomCssPanel,
  spacer: SpacerPanel,
};
