import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base=process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com";
  return { rules:[{userAgent:"*",allow:"/",disallow:["/api/","/unsubscribed"]}],sitemap:base+"/sitemap.xml" };
}
