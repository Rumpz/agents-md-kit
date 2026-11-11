---
name: html-syntax-and-semantics
description: Rules for writing valid, semantic, accessible HTML. Use when writing or reviewing any HTML, JSX markup, templates or email-less web pages, including document structure, element choice, forms, images, links, tables and accessibility basics.
---

# HTML Syntax, Semantics and Accessibility

Good HTML is the foundation for accessibility, SEO and maintainable CSS. In component frameworks (for example React/JSX, Vue or Svelte templates) the same rules apply to the rendered output.

## 1. Document Skeleton

Every page needs:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page Title | Brand</title>
  </head>
  <body>...</body>
</html>
```

- `<!doctype html>` first, to avoid quirks mode.
- `lang` on `<html>` (and on any inline foreign-language content).
- `charset` as UTF-8, within the first 1024 bytes of the document.
- A viewport meta tag. Never disable zoom (`user-scalable=no`, `maximum-scale=1`).
- One unique, descriptive `<title>` per page.

## 2. Syntax Rules

- Lowercase element and attribute names.
- Always quote attribute values with double quotes.
- Close all non-void elements. Void elements (`img`, `input`, `br`, `meta`, `link`, `hr`) take no closing tag.
- Nest correctly: no block elements inside `<p>`, no `<a>` inside `<a>`, no interactive elements inside `<button>` or `<a>`.
- `id` values are unique per page. Don't duplicate them.
- Use boolean attributes without values (`disabled`, `required`, `checked`).
- Don't use obsolete or presentational elements (`<center>`, `<font>`, `<b>` for emphasis). Style belongs in CSS.
- Validate with the W3C validator or an HTML linter in CI.

## 3. Semantic Elements

Pick the element for its meaning, not its looks.

| Need | Use | Not |
|---|---|---|
| Site/section header | `<header>` | `<div class="header">` |
| Primary navigation | `<nav>` | `<div class="nav">` |
| Unique main content (once per page) | `<main>` | `<div id="main">` |
| Self-contained content (post, card) | `<article>` | `<div>` |
| Thematic grouping with a heading | `<section>` | `<div>` |
| Tangential content | `<aside>` | `<div>` |
| Footer | `<footer>` | `<div>` |
| Figure with caption | `<figure>` + `<figcaption>` | `<div>` + `<p>` |
| Lists | `<ul>`, `<ol>`, `<dl>` | repeated `<div>`/`<br>` |
| Emphasis / importance | `<em>` / `<strong>` | `<i>` / `<b>` for meaning |
| Dates | `<time datetime="2026-11-11">` | plain text |
| Actions | `<button type="button">` | `<div onclick>` |
| Navigation to another URL | `<a href>` | `<button>` or `<span onclick>` |

Use `<div>` and `<span>` only when no semantic element fits.

## 4. Headings

- Exactly one `<h1>` per page, describing the page.
- Don't skip levels (`h1` → `h2` → `h3`).
- Choose heading level by document outline, never by font size. Size it with CSS.

## 5. Links and Buttons

- Link text must make sense out of context. Avoid "click here" and "read more" alone.
- External links opened in a new tab: `target="_blank" rel="noopener noreferrer"`. Prefer not to force new tabs.
- `<button>` triggers an action. Always set `type` (`button`, `submit`, `reset`) explicitly.
- Never remove the focus outline without a visible replacement (`:focus-visible`).

## 6. Images and Media

- Every `<img>` has an `alt`. Informative image: describe its purpose. Decorative image: `alt=""`.
- Always set `width` and `height` (or CSS `aspect-ratio`) to prevent layout shift.
- Below-the-fold images: `loading="lazy"`. The main above-the-fold (LCP) image: don't lazy-load, and consider `fetchpriority="high"`.
- Use `srcset` and `sizes` (or `<picture>`) for responsive images. Prefer modern formats (AVIF, WebP) with fallback.
- Video: provide captions (`<track kind="captions">`) and avoid autoplay with sound.
- Icons that carry meaning need accessible names. Decorative SVGs get `aria-hidden="true"`.

## 7. Forms

- Every control has a visible `<label for="id">` (or wraps the input). Placeholder is not a label.
- Use the right `type` (`email`, `tel`, `url`, `number`, `date`, `password`) and `autocomplete` tokens (`email`, `given-name`, `current-password`, `new-password`, `one-time-code`).
- Group related controls with `<fieldset>` and `<legend>`.
- Use `required`, `min`, `max`, `pattern` for client hints, but always validate on the server too.
- Show errors in text next to the field, linked via `aria-describedby`, and mark invalid fields with `aria-invalid="true"`. Don't rely on color alone.
- Submit with a real `<button type="submit">` inside a `<form>`.

## 8. Tables

- Use tables only for tabular data, never for layout.
- Include `<caption>`, `<thead>`, `<tbody>`, and `<th scope="col|row">`.

## 9. Accessibility Essentials

- Prefer native elements over ARIA. First rule of ARIA: don't use it if a native element does the job.
- All functionality works with keyboard only. Logical tab order, no positive `tabindex`.
- Skip link as the first focusable element: `<a href="#main" class="skip">Skip to content</a>`.
- Text contrast of at least 4.5:1 (3:1 for large text and UI components), per WCAG 2.2 AA.
- Don't convey information by color alone.
- Landmarks (`header`, `nav`, `main`, `footer`) give screen readers navigation points. Label duplicates (`<nav aria-label="Footer">`).
- Dynamic updates: use `aria-live` regions for status messages. Manage focus for modals and route changes.
- Respect `prefers-reduced-motion`.
- Target size for touch/click: at least 24x24 CSS px (aim for 44x44).

## 10. Component Framework Notes (JSX shown as an example)

- Use `className`, `htmlFor`, and self-close void elements (`<img />`).
- Lists need stable `key`s, never array indexes for reorderable data.
- Keep the rendered HTML semantic. A `<div onClick>` in JSX is still wrong.

## Review Checklist

- [ ] Valid doctype, `lang`, charset, viewport, unique `<title>`
- [ ] Semantic elements; one `<h1>`; heading levels don't skip
- [ ] All images have `alt` and dimensions
- [ ] All form controls have labels and correct `type`/`autocomplete`
- [ ] Buttons vs links used correctly; `type` set on buttons
- [ ] Keyboard-operable with visible focus
- [ ] No duplicate `id`s; passes an HTML validator and an accessibility check (axe/Lighthouse)
