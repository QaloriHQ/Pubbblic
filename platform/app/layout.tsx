import type { Metadata } from "next";
import "./globals.css";
import "./cloud.css";
export const metadata: Metadata = {
  title: "Pubbblic Studio | Product Preview",
  description: "Explore the Pubbblic press release workspace. Interactive product preview with local-only draft storage.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
