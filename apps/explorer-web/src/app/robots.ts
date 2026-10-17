import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Walked tx and account pages with a new hash on every request and exhausted the
        // hosting quotas. Also denied at the firewall, since robots.txt is only advisory.
        userAgent: "Reflectionbot",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        // Transaction and ledger pages are an unbounded keyspace with no search value, and
        // each new URL costs a server render.
        disallow: ["/api/", "/watchlist", "/*/*/tx/", "/*/*/ledger/"],
      },
    ],
    sitemap: "https://stellar-explorer.acachete.xyz/sitemap.xml",
  };
}
