import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/components/Shell";
const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com";
export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "Pubbblic | Press Release Distribution, Reimagined", template: "%s | Pubbblic" },
  description: "One approved announcement, publisher-specific editorial adaptations and transparent distribution reporting. Meet Pubbblic. Join the launch waitlist.",
  keywords: ["press release distribution", "press release writing", "publisher distribution", "AI press release rewriting"],
  openGraph: { type: "website", siteName: "Pubbblic", title: "Pubbblic — Make your news count", description: "Press release distribution designed for clear editorial workflows and verifiable results.", url: base, images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Pubbblic — press releases, reimagined" }] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  alternates: { canonical: "/" }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const org = { "@context": "https://schema.org", "@type": "Organization", name: "Pubbblic", url: base, description: "Pubbblic is building a press release distribution platform with publisher-specific editorial preparation and verifiable delivery reporting." };
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, "\\u003c") }} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
