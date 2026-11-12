import { Anek_Bangla, Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";

/**
 * Brand typefaces, loaded only where the brand surface is used (marketing, sign-in, the merchant
 * dashboard). The storefront never imports this file, so a shop's pages download none of these.
 * See brand/guide.html for the rules.
 */
const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });
const text = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], display: "swap" });
const bangla = Anek_Bangla({ variable: "--font-anek", subsets: ["bengali", "latin"], display: "swap" });

export const brandFontClasses = [display, text, mono, bangla].map((font) => font.variable).join(" ");
