# P-06 Field Journal

A static blog for P-06 field reports and an About page. The build converts Markdown and LaTeX to HTML and MathML and bundles its styles, fonts, and profile portrait with the output.

## Build and preview

Use Node.js 24 and npm.

```bash
npm ci
npm run build
```

Open `dist/index.html` in a browser, or serve `dist/` with a static HTTP server.

For the browser features, run `npm run preview` after building and open `http://127.0.0.1:4173/`. The preview serves only `dist/` and listens on the local machine. Set `PORT` to use a different port.

## Reading desk

The report index searches complete report text as well as titles and summaries. Category filters combine with OR; search terms must all appear. Readers can sort by newest, oldest, or shortest report. Search, filters, and order are represented in the URL; **Copy this view** makes a shareable link. A saved-only view uses the recipient's own reading list.

**Save report** keeps a reading list in browser local storage. Report pages remember the furthest reading position, and an unfinished report appears under **Where you left off** on the index. The list and position stay in that browser; they do not sync between devices. If browser storage is unavailable, saving works for the current page visit. Section navigation and reading-time estimates are generated from the Markdown. Estimates use 220 words per minute and do not account for time spent studying equations.

The full report list and content remain readable without JavaScript. If the full-text index fails to load, search falls back to the report index text. Clipboard failures reveal a selectable link instead.

**Night reading** switches to a dark reading surface and remembers the choice in this browser. Print layouts use a light background and leave the reading controls out.

Each report ends with up to three other reports, chosen by shared categories and then recency. These links and section contents work without JavaScript.

`feed.xml` is an Atom feed with the complete published reports. Feed readers can discover it automatically or use the **Subscribe via Atom** footer link. Set `SITE_URL` when building for another host; its default is the journal's GitHub Pages address. Ordinary site navigation and assets continue to use relative paths.

## Write a report

Add a file to `posts/` with a lowercase, hyphenated filename. The filename determines its URL. Each report starts with this front matter.

```markdown
---
title: "A report title"
date: "2026-11-07T18:40:00-05:00"
timeApproximate: true
summary: "One sentence for the report index."
tags: [journal, educational]
---

Set `date` to an ISO timestamp with its UTC offset. When the filing time is an estimate based on the nearest documented event, set `timeApproximate: true`; the site will label it as approximate. Use `$...$` for inline math and `$$` on separate lines around display equations. Use second-level headings (`##`) within the report. Choose one or more tags from `journal`, `humor`, `educational`, and `life`; selected filters combine with OR, so a report appears when it has any selected tag.
```

Only files under `assets/published/` are candidates for the website. Add the source asset to the explicit allowlist in `scripts/build.mjs` so it is copied into `dist/assets/`; use that deployed path in report Markdown. Keep source files organized under `identity/` or `styles/` by purpose.

The site builds `about.md` as `about.html`. Reference portraits, expression reactions, and design studies live under `assets/reserve/`. They remain in the public repository for future use but are not copied into the Pages output.

## Publish

In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the source. Push to `main` or run **Deploy P-06 to GitHub Pages** from the Actions tab. The workflow builds and publishes `dist/`.

To serve the site elsewhere, copy the contents of `dist/` to a static document directory. Links are relative, so the same output works at the domain root or below a path prefix.

## Reuse

The MIT License covers original website source code only, to the extent contributors hold rights they can license. Non-portrait AI-generated artwork and field report prose are offered under CC BY 4.0 to the extent rights can be granted; portraits are excluded. See `license.md` for the terms and `about.md` for attribution and copyright context.

PNG assets use Git LFS. The Pages workflow checks out LFS objects before building the site.
