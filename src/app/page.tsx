import { AppHeader } from "@/components/layout/app-header";
import { HeroSection } from "@/components/home/hero-section";
import { FeatureGrid } from "@/components/home/feature-grid";
import { ProductPreview } from "@/components/home/product-preview";
import { CtaSection } from "@/components/home/cta-section";
import { LandingFooter } from "@/components/home/landing-footer";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-col">
      <AppHeader />
      <main className="flex-1">
        <HeroSection />
        <ProductPreview />
        <FeatureGrid />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
