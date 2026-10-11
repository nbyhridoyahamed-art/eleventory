import Script from "next/script";

import type { SeoSettings } from "@/types/seo-settings";

/** Tracking IDs end up inside script source, so only characters real IDs use get through. */
const safe = (value: string | null | undefined, pattern: RegExp): string | null =>
  value && pattern.test(value) ? value : null;

/**
 * Analytics and tracking tags configured in the SEO section's Integrations
 * tab. Rendered only in the public storefront layout — never in the admin or
 * account areas, so staff and customers' own sessions don't pollute reports.
 *
 * Also emits the social meta that Next's Metadata API can't merge across a
 * layout and its pages (og:site_name, twitter:site); React hoists these
 * <meta> tags into <head>.
 */
export function SeoScripts({ settings, siteName }: { settings: SeoSettings; siteName: string }) {
  const ga4 = safe(settings.analytics.ga4_id, /^G-[A-Za-z0-9]+$/);
  const gtm = safe(settings.analytics.gtm_id, /^GTM-[A-Za-z0-9]+$/);
  const pixel = safe(settings.analytics.meta_pixel_id, /^\d+$/);
  const clarity = safe(settings.analytics.clarity_id, /^[A-Za-z0-9]+$/);
  const handle = settings.site.twitter_handle?.replace(/^@/, "");
  const ogSiteName = settings.site.site_name || siteName;

  return (
    <>
      <meta property="og:site_name" content={ogSiteName} />
      {handle ? <meta name="twitter:site" content={`@${handle}`} /> : null}

      {gtm ? (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      ) : null}

      {ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      ) : null}

      {pixel ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      ) : null}

      {clarity ? (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");`}
        </Script>
      ) : null}
    </>
  );
}
