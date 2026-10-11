"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { HeroSliderSettings } from "@/types/homepage-block";

/**
 * Hero slider, optionally with up to two promo tiles beside it.
 *
 * Layout follows the block's own width (container queries: `@xl`, `@3xl`),
 * not the browser window's, so it also lays out correctly inside the
 * builder's narrow canvas and its tablet/mobile preview. When narrow, the
 * text sits above the artwork; when wide, the artwork fills the slide behind
 * the text. A slide without an image falls back to the brand gradient so the
 * block never renders as plain text on white.
 */
export function HeroSliderBlock({ settings }: { settings: HeroSliderSettings }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!settings.autoplay || settings.slides.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % settings.slides.length);
    }, settings.interval_seconds * 1000);
    return () => clearInterval(id);
  }, [settings.autoplay, settings.interval_seconds, settings.slides.length]);

  if (settings.slides.length === 0) return null;

  const multiple = settings.slides.length > 1;
  const activeIndex = index % settings.slides.length;
  const slide = settings.slides[activeIndex];
  const sideBanners = (settings.side_banners ?? []).filter((banner) => banner.image_url);

  return (
    <div className="@container">
      <section className={cn("grid gap-4", sideBanners.length > 0 && "@3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <div
          className="relative overflow-hidden rounded-lg bg-shop-nav @xl:flex @xl:min-h-[340px] @xl:items-center"
          style={{ backgroundImage: "linear-gradient(120deg, var(--color-shop-nav), #1d5fd1)" }}
        >
          {/* Wide: the artwork fills the slide behind the text. */}
          {slide.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
            <img src={slide.image_url} alt="" className="absolute inset-0 hidden size-full object-cover @xl:block" />
          ) : null}

          <div className="relative max-w-md px-6 pb-4 pt-8 text-left @xl:max-w-[28rem] @xl:py-8 @xl:pl-16 @xl:pr-6 @3xl:max-w-xl">
            <p className="text-2xl font-bold leading-tight text-white @xl:text-4xl">{slide.heading}</p>
            {slide.subheading ? <p className="mt-3 text-sm text-white/90 @xl:text-base">{slide.subheading}</p> : null}
            {slide.cta_label && slide.cta_url ? (
              <Link
                href={slide.cta_url}
                className="mt-6 inline-block bg-shop-accent px-6 py-3 text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover"
              >
                {slide.cta_label}
              </Link>
            ) : null}
          </div>

          {/* Narrow: the artwork sits under the text, fading into the slide so there is no hard seam. */}
          {slide.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
            <img
              src={slide.image_url}
              alt=""
              className="block w-full @xl:hidden"
              style={{
                maskImage: "linear-gradient(to bottom, transparent, #000 40%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 40%)",
              }}
            />
          ) : null}

          {multiple ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setIndex((i) => (i - 1 + settings.slides.length) % settings.slides.length)}
                className="absolute bottom-2 left-3 flex size-9 items-center justify-center rounded-full bg-white/80 text-slate-900 transition-colors hover:bg-white @xl:bottom-auto @xl:top-1/2 @xl:-translate-y-1/2"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setIndex((i) => (i + 1) % settings.slides.length)}
                className="absolute bottom-2 right-3 flex size-9 items-center justify-center rounded-full bg-white/80 text-slate-900 transition-colors hover:bg-white @xl:bottom-auto @xl:top-1/2 @xl:-translate-y-1/2"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
                {settings.slides.map((_, dotIndex) => (
                  <button
                    key={dotIndex}
                    type="button"
                    aria-label={`Go to slide ${dotIndex + 1}`}
                    aria-current={dotIndex === activeIndex}
                    onClick={() => setIndex(dotIndex)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      dotIndex === activeIndex ? "w-6 bg-shop-accent" : "w-2 bg-white/70",
                    )}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {sideBanners.length > 0 ? (
          <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-1 @3xl:grid-rows-2">
            {sideBanners.map((banner, bannerIndex) => {
              const image = (
                // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                <img src={banner.image_url!} alt={banner.alt_text ?? ""} className="size-full object-cover" />
              );
              const className = "block aspect-[5/2] overflow-hidden rounded-lg @3xl:aspect-auto";
              return banner.link_url ? (
                <Link key={bannerIndex} href={banner.link_url} className={className}>
                  {image}
                </Link>
              ) : (
                <div key={bannerIndex} className={className}>
                  {image}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
