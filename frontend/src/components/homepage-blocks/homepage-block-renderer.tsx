import { BlockStyleScope } from "@/components/homepage-blocks/block-style-scope";
import { AnnouncementBarBlock } from "@/components/homepage-blocks/renderers/announcement-bar-block";
import { BestSellersBlock } from "@/components/homepage-blocks/renderers/best-sellers-block";
import { BlogPostsBlock } from "@/components/homepage-blocks/renderers/blog-posts-block";
import { BrandCarouselBlock } from "@/components/homepage-blocks/renderers/brand-carousel-block";
import { CategoryCarouselBlock } from "@/components/homepage-blocks/renderers/category-carousel-block";
import { CategoryGridBlock } from "@/components/homepage-blocks/renderers/category-grid-block";
import { CountdownBlock } from "@/components/homepage-blocks/renderers/countdown-block";
import { CtaBlock } from "@/components/homepage-blocks/renderers/cta-block";
import { CustomCssBlock } from "@/components/homepage-blocks/renderers/custom-css-block";
import { CustomHtmlBlock } from "@/components/homepage-blocks/renderers/custom-html-block";
import { FaqBlock } from "@/components/homepage-blocks/renderers/faq-block";
import { FeaturedProductsBlock } from "@/components/homepage-blocks/renderers/featured-products-block";
import { FlashSaleBlock } from "@/components/homepage-blocks/renderers/flash-sale-block";
import { GalleryBlock } from "@/components/homepage-blocks/renderers/gallery-block";
import { HeroBlock } from "@/components/homepage-blocks/renderers/hero-block";
import { HeroSliderBlock } from "@/components/homepage-blocks/renderers/hero-slider-block";
import { ImageTextBlock } from "@/components/homepage-blocks/renderers/image-text-block";
import { LatestProductsBlock } from "@/components/homepage-blocks/renderers/latest-products-block";
import { MultiColumnBannerBlock } from "@/components/homepage-blocks/renderers/multi-column-banner-block";
import { NewsletterBlock } from "@/components/homepage-blocks/renderers/newsletter-block";
import { ProductCarouselBlock } from "@/components/homepage-blocks/renderers/product-carousel-block";
import { ProductTabsBlock } from "@/components/homepage-blocks/renderers/product-tabs-block";
import { PromoBannerBlock } from "@/components/homepage-blocks/renderers/promo-banner-block";
import { ReviewsBlock } from "@/components/homepage-blocks/renderers/reviews-block";
import { RichTextBlock } from "@/components/homepage-blocks/renderers/rich-text-block";
import { SpacerBlock } from "@/components/homepage-blocks/renderers/spacer-block";
import { StatisticsBlock } from "@/components/homepage-blocks/renderers/statistics-block";
import { TestimonialsBlock } from "@/components/homepage-blocks/renderers/testimonials-block";
import { TrustBadgesBlock } from "@/components/homepage-blocks/renderers/trust-badges-block";
import { VideoBlock } from "@/components/homepage-blocks/renderers/video-block";
import type {
  AnnouncementBarSettings,
  AutoManualBrandSettings,
  AutoManualCategorySettings,
  AutoManualProductSettings,
  AutoManualTestimonialSettings,
  CountdownSettings,
  CtaSettings,
  CustomCssSettings,
  CustomHtmlSettings,
  FaqSettings,
  FlashSaleSettings,
  GallerySettings,
  HeroSettings,
  HeroSliderSettings,
  ImageTextSettings,
  LimitOnlySettings,
  MultiBannerSettings,
  NewsletterSettings,
  ProductCarouselSettings,
  ProductTabsSettings,
  PromoBannerSettings,
  RichTextSettings,
  SpacerSettings,
  StatisticsSettings,
  TrustBadgesSettings,
  VideoSettings,
} from "@/types/homepage-block";
import type { StorefrontHomepageBlock } from "@/types/storefront";

/**
 * The block registry's storefront-rendering half (spec section 60). One
 * switch, not "one giant conditional renderer" per block's markup — each
 * case delegates immediately to that type's own renderer component,
 * passing only the settings/resolved-data slice it needs. Every case is
 * wrapped in the same BlockStyleScope so design/responsive/visibility/
 * animation apply identically regardless of type. `two_column_banner`/
 * `three_column_banner` share one component (same shape, fixed array
 * length); `testimonials`/`reviews` read the same resolved data but render
 * through two visually distinct components.
 */
export function HomepageBlockRenderer({ block }: { block: StorefrontHomepageBlock }) {
  const content = renderContent(block);
  if (content === null) return null;

  return (
    <BlockStyleScope blockId={block.id} styles={block.styles} responsive={block.responsive} visibility={block.visibility} animation={block.animation}>
      {content}
    </BlockStyleScope>
  );
}

function renderContent(block: StorefrontHomepageBlock) {
  switch (block.type) {
    case "hero":
      return <HeroBlock settings={block.settings as unknown as HeroSettings} />;
    case "hero_slider":
      return <HeroSliderBlock settings={block.settings as unknown as HeroSliderSettings} />;
    case "announcement_bar":
      return <AnnouncementBarBlock settings={block.settings as unknown as AnnouncementBarSettings} />;
    case "featured_products":
      return <FeaturedProductsBlock settings={block.settings as unknown as AutoManualProductSettings} products={block.data.products ?? []} />;
    case "latest_products":
      return <LatestProductsBlock settings={block.settings as unknown as LimitOnlySettings} products={block.data.products ?? []} />;
    case "best_sellers":
      return <BestSellersBlock settings={block.settings as unknown as LimitOnlySettings} products={block.data.products ?? []} />;
    case "category_grid":
      return <CategoryGridBlock settings={block.settings as unknown as AutoManualCategorySettings} categories={block.data.categories ?? []} />;
    case "category_carousel":
      return <CategoryCarouselBlock settings={block.settings as unknown as AutoManualCategorySettings} categories={block.data.categories ?? []} />;
    case "brand_carousel":
      return <BrandCarouselBlock settings={block.settings as unknown as AutoManualBrandSettings} brands={block.data.brands ?? []} />;
    case "product_carousel":
      return <ProductCarouselBlock settings={block.settings as unknown as ProductCarouselSettings} products={block.data.products ?? []} />;
    case "product_tabs":
      return <ProductTabsBlock settings={block.settings as unknown as ProductTabsSettings} />;
    case "flash_sale":
      return <FlashSaleBlock settings={block.settings as unknown as FlashSaleSettings} items={block.data.items ?? []} />;
    case "countdown":
      return <CountdownBlock settings={block.settings as unknown as CountdownSettings} />;
    case "promo_banner":
      return <PromoBannerBlock settings={block.settings as unknown as PromoBannerSettings} />;
    case "two_column_banner":
    case "three_column_banner":
      return <MultiColumnBannerBlock settings={block.settings as unknown as MultiBannerSettings} />;
    case "video":
      return <VideoBlock settings={block.settings as unknown as VideoSettings} />;
    case "image_text":
      return <ImageTextBlock settings={block.settings as unknown as ImageTextSettings} />;
    case "rich_text":
      return <RichTextBlock settings={block.settings as unknown as RichTextSettings} />;
    case "testimonials":
      return <TestimonialsBlock settings={block.settings as unknown as AutoManualTestimonialSettings} testimonials={block.data.testimonials ?? []} />;
    case "reviews":
      return <ReviewsBlock settings={block.settings as unknown as AutoManualTestimonialSettings} testimonials={block.data.testimonials ?? []} />;
    case "faq":
      return <FaqBlock settings={block.settings as unknown as FaqSettings} />;
    case "newsletter":
      return <NewsletterBlock settings={block.settings as unknown as NewsletterSettings} />;
    case "gallery":
      return <GalleryBlock settings={block.settings as unknown as GallerySettings} />;
    case "trust_badges":
      return <TrustBadgesBlock settings={block.settings as unknown as TrustBadgesSettings} />;
    case "statistics":
      return <StatisticsBlock settings={block.settings as unknown as StatisticsSettings} />;
    case "cta":
      return <CtaBlock settings={block.settings as unknown as CtaSettings} />;
    case "blog_posts":
      return <BlogPostsBlock settings={block.settings as unknown as LimitOnlySettings} posts={block.data.posts ?? []} />;
    case "custom_html":
      return <CustomHtmlBlock settings={block.settings as unknown as CustomHtmlSettings} />;
    case "custom_css":
      return <CustomCssBlock settings={block.settings as unknown as CustomCssSettings} />;
    case "spacer":
      return <SpacerBlock settings={block.settings as unknown as SpacerSettings} />;
    default:
      return null;
  }
}
