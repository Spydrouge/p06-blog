# P-06 Field Journal

A static blog for P-06 field reports. The build converts Markdown and LaTeX to HTML and MathML and bundles its styles and fonts with the output.

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

Place shared images in `assets/` and link from a report with `![Description](../assets/example.svg)`.

## Publish

In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the source. Push to `main` or run **Deploy P-06 to GitHub Pages** from the Actions tab. The workflow builds and publishes `dist/`.

To serve the site elsewhere, copy the contents of `dist/` to a static document directory. Links are relative, so the same output works at the domain root or below a path prefix.
