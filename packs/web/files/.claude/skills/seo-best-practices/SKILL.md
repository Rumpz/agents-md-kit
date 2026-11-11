---
name: seo-best-practices
description: Technical and on-page SEO rules for web applications. Use when building or reviewing pages, routing, metadata, structured data, sitemaps, rendering strategy (SSR/SSG/CSR), performance (Core Web Vitals), international sites, or when a page must rank in search.
---

# SEO Implementation Best Practices

SEO is mostly good engineering: crawlable, fast, semantic pages with unique, useful content. Follow these rules when implementing pages. Verify current guidance against Google Search Central when in doubt, as recommendations change.

## 1. Rendering Strategy (Crawlability)

- Content that must rank must be in the initial HTML response. Prefer **SSG** (static) or **SSR** for public, indexable pages. Use client-side rendering (CSR) only for authenticated or non-indexable areas.
- With a client-side framework (React, Vue, Svelte, etc.), render public pages with SSR/SSG (for example Next.js, Nuxt, SvelteKit, Astro).
- Don't hide primary content behind clicks, tabs that require JS fetches, or infinite scroll without paginated URLs.
- Use real `<a href>` links for navigation, not `onClick` handlers. Crawlers follow `href`.
- Each distinct view has its own URL (no `#` fragment routing for indexable content). Use the History API / framework routing.
- Return correct HTTP status codes: `200` OK, `301`/`308` permanent redirect, `404` for missing pages, `410` for permanently removed, `5xx` only for real errors. Never return `200` for a "not found" page (soft 404).

## 2. URLs

- Short, lowercase, hyphen-separated, descriptive: `/guides/react-solid-principles`.
- No session IDs or unnecessary parameters in indexable URLs.
- Pick one canonical form (trailing slash or not, `www` or not, HTTPS) and 301 the others to it.
- Keep URLs stable. When they change, 301 redirect old to new (avoid redirect chains).

## 3. Title and Meta Tags

Per page, unique and written for humans:

```html
<title>Primary Keyword – Secondary | Brand</title>
<meta name="description" content="One or two sentences that summarise the page and encourage a click.">
<link rel="canonical" href="https://example.com/guides/react-solid-principles">
<meta name="robots" content="index,follow">
```

- **Title:** unique per page, roughly 50–60 characters, key topic first, brand last.
- **Meta description:** unique, roughly 120–160 characters. It doesn't directly affect ranking but influences click-through. Search engines may rewrite it.
- **Canonical:** every indexable page has a self-referencing absolute canonical URL. Use it to consolidate duplicates (filters, tracking parameters).
- **Robots:** `noindex` for thin, duplicate, internal-search, staging and account pages. Don't combine `noindex` with a `robots.txt` block, because the crawler must be able to fetch the page to see the tag.
- `meta keywords` is ignored. Don't bother.

## 4. Open Graph and Social Cards

```html
<meta property="og:type" content="article">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="https://example.com/...">
<meta property="og:image" content="https://example.com/og/page.png">
<meta name="twitter:card" content="summary_large_image">
```

- Absolute URLs, image about 1200×630.
- Not a ranking factor, but controls how links look when shared.

## 5. Content Structure

- One `<h1>` that matches the page's main topic. Logical `h2`/`h3` hierarchy (see `html-syntax-and-semantics`).
- Content must be original, useful and satisfy search intent. No keyword stuffing, hidden text or doorway pages.
- Descriptive link anchor text; link related pages together (internal linking). Every important page is reachable within a few clicks from the home page.
- Image `alt` text that describes the image, descriptive filenames (`react-hooks-diagram.png`).
- Use breadcrumbs (visible and in structured data) for hierarchical sites.

## 6. Structured Data (JSON-LD)

Add JSON-LD matching the visible content. Never mark up content that isn't on the page.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "The SOLID Principles in React",
  "author": { "@type": "Person", "name": "Jane Doe" },
  "datePublished": "2026-11-11",
  "image": "https://example.com/og/solid.png"
}
</script>
```

- Common types: `Organization`, `WebSite`, `Article`/`BlogPosting`, `BreadcrumbList`, `Product` (+ `Offer`, `AggregateRating` only with real reviews), `FAQPage`, `LocalBusiness`, `Event`, `JobPosting`.
- Check eligibility for rich results in Google's docs, since some types are restricted.
- Validate with Google's Rich Results Test and the Schema Markup Validator.

## 7. Performance and Core Web Vitals

Page experience metrics influence ranking and conversions. Targets (at the 75th percentile of real users):

| Metric | Good |
|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5 s |
| INP (Interaction to Next Paint) | ≤ 200 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |

How to hit them:
- **LCP:** optimize and preload the hero image, use `fetchpriority="high"`, serve via CDN, use SSR/SSG, minimize render-blocking CSS/JS, compress (Brotli/gzip), cache aggressively.
- **INP:** break up long JS tasks, defer non-critical scripts, avoid heavy synchronous work in handlers, code-split.
- **CLS:** set image/video dimensions, reserve space for ads/embeds, avoid inserting content above existing content, use `font-display: swap` with size-adjusted fallback fonts.
- Use modern image formats, responsive `srcset`, lazy loading below the fold.
- Measure with real-user data (CrUX, `web-vitals` library) and Lighthouse/PageSpeed Insights. Lab results alone are not enough.

## 8. Mobile and Security

- Responsive design and the viewport meta tag. Google indexes the mobile version first, so mobile content must equal desktop content.
- HTTPS everywhere with HSTS. No mixed content.
- Fix intrusive interstitials.

## 9. Crawl Control

**robots.txt** (at the site root):
```
User-agent: *
Disallow: /admin/
Disallow: /api/
Sitemap: https://example.com/sitemap.xml
```
- `robots.txt` controls crawling, not indexing. Use `noindex` (meta or `X-Robots-Tag`) to keep pages out of results.
- Don't block CSS/JS/images that are needed to render pages.

**XML sitemap:**
- List only canonical, indexable, `200` URLs. Include accurate `<lastmod>`. Max 50,000 URLs or 50 MB per file; use a sitemap index beyond that.
- Generate it automatically at build or request time. Reference it in `robots.txt` and submit it in Google Search Console and Bing Webmaster Tools.

## 10. Pagination, Filters and Duplicates

- Paginated lists use crawlable links (`?page=2` or `/page/2`) with self-canonical URLs. Don't canonicalize page 2+ to page 1.
- Faceted/filter URLs that create near-infinite combinations: canonicalize to the main category, or `noindex`/disallow low-value combinations.
- Avoid duplicate content across `http/https`, `www`, trailing slash, and uppercase/lowercase variants.

## 11. International SEO

- Use `hreflang` annotations (HTML `<link>`, HTTP header or sitemap), bidirectional and including `x-default`:
```html
<link rel="alternate" hreflang="en" href="https://example.com/en/">
<link rel="alternate" hreflang="pt-PT" href="https://example.com/pt/">
<link rel="alternate" hreflang="x-default" href="https://example.com/">
```
- Distinct URLs per language (subdirectory, subdomain or ccTLD). Don't auto-redirect users based on IP without letting crawlers reach every version.
- Set `<html lang>` correctly.

## 12. Site Migrations and Maintenance

- Before changing URLs or domains: map every old URL to a new one with 301 redirects, keep the sitemap updated, and monitor Search Console for coverage errors.
- Regularly fix broken links, redirect chains, soft 404s and slow pages.
- Monitor indexing and queries in Google Search Console. Track Core Web Vitals field data.

## Review Checklist

- [ ] Indexable content is present in server-rendered/static HTML
- [ ] Unique `<title>`, meta description, self-referencing canonical on each page
- [ ] One `<h1>`, semantic headings, descriptive links, image `alt`
- [ ] Correct status codes and 301s; no soft 404s or redirect chains
- [ ] `robots.txt` and XML sitemap present, accurate and submitted
- [ ] JSON-LD that matches visible content and validates
- [ ] Core Web Vitals meet targets in field data
- [ ] `hreflang` set up (if multilingual); mobile parity; HTTPS only
- [ ] Non-public pages (admin, staging, search, cart) are `noindex` or protected
