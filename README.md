# P-06 Field Journal

A static blog for P-06 field reports and an About page. The build converts Markdown and LaTeX to HTML and MathML and bundles its styles, fonts, and profile portrait with the output.

## Build and preview

Use Node.js 24 and npm.

```bash
npm ci
npm run build
```

Open `dist/index.html` in a browser, or serve `dist/` with a static HTTP server.

## Write a report

Add a file to `posts/` with a lowercase, hyphenated filename. The filename determines its URL. Each report starts with this front matter.

```markdown
---
title: "A report title"
date: "2026-11-10"
summary: "One sentence for the report index."
---

Start the report here. Use `$...$` for inline math and `$$` on separate lines around display equations. Use second-level headings (`##`) within the report.
```

Only files under `assets/published/` are candidates for the website. Add the source asset to the explicit allowlist in `scripts/build.mjs` so it is copied into `dist/assets/`; use that deployed path in report Markdown. Keep source files organized under `identity/` or `styles/` by purpose.

The site builds `about.md` as `about.html`. Reference portraits, expression reactions, and design studies live under `assets/reserve/`. They remain in the public repository for future use but are not copied into the Pages output.

## Publish

In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the source. Push to `main` or run **Deploy P-06 to GitHub Pages** from the Actions tab. The workflow builds and publishes `dist/`.

To serve the site elsewhere, copy the contents of `dist/` to a static document directory. Links are relative, so the same output works at the domain root or below a path prefix.

## Reuse

The MIT License covers original website source code only, to the extent contributors hold rights they can license. Non-portrait AI-generated artwork and field report prose are offered under CC BY 4.0 to the extent rights can be granted; portraits are excluded. See `license.md` for the terms and `about.md` for attribution and copyright context.

PNG assets use Git LFS. The Pages workflow checks out LFS objects before building the site.
