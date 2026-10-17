import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  matcher: [
    // Only paths that still need a locale redirect. Skips:
    // - /api routes
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - Paths that already carry a locale (/es/..., /en/...). The [locale] layout calls
    //   setRequestLocale, so they render without the proxy and cost no extra invocation.
    // - Static files (e.g., /favicon.ico)
    "/((?!api|_next|_vercel|(?:en|es|pt|fr|de|zh|ja|ko|it)/|.*\\..*).*)",
  ],
};
