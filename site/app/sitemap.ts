import type { MetadataRoute } from "next";
import { pages } from "@/lib/pages";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: base + "/llms.txt", changeFrequency: "monthly", priority: 0.4 },
    ...pages.map((p)=>({url:base+"/"+p.path,changeFrequency:"monthly" as const,priority:p.path.startsWith("guides/")?0.7:0.8}))
  ];
}
