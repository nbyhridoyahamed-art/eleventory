import { ProductCarouselBlock } from "@/components/homepage-blocks/renderers/product-carousel-block";
import type { LimitOnlySettings } from "@/types/homepage-block";
import type { StorefrontProduct } from "@/types/storefront";

/** Same slider as the product carousel, so every product row on the homepage moves and looks alike. */
export function LatestProductsBlock({ settings, products }: { settings: LimitOnlySettings; products: StorefrontProduct[] }) {
  return <ProductCarouselBlock settings={settings} products={products} />;
}
