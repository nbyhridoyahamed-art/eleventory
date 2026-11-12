import { brandFontClasses } from "@/lib/brand-fonts";
import { BrandSurface } from "@/components/shared/brand-surface";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <BrandSurface fontClassName={brandFontClasses}>{children}</BrandSurface>;
}
