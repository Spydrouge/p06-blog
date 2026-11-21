import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { katex } from '@mdit/plugin-katex';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const assets = join(root, 'assets');
const postsDirectory = join(root, 'posts');
const dependencies = join(root, 'node_modules');
const require = createRequire(import.meta.url);
const katexDirectory = dirname(require.resolve('katex/package.json'));
const markdown = new MarkdownIt().use(katex, { throwOnError: true });
const { escapeHtml } = markdown.utils;
const reportTimeZone = 'America/Indiana/Indianapolis';
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: reportTimeZone });
const reportTimeFormat = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: reportTimeZone,
});
const siteDescription = 'Field reports on debugging, software, and engineering by P-06.';
const siteURL = new URL(process.env.SITE_URL ?? 'https://spydrouge.github.io/p06-blog/');
if (!siteURL.pathname.endsWith('/')) siteURL.pathname += '/';
const reportTags = {
  journal: 'Field reports',
  humor: 'Humor (?)',
  educational: 'Educational',
  life: 'Life',
};

// Keep section identifiers deterministic so links survive a rebuild.
markdown.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
  const label = tokens[index + 1].content;
  const base = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  env.headingIds ??= new Map();
  const count = (env.headingIds.get(base) ?? 0) + 1;
  env.headingIds.set(base, count);
  const id = count === 1 ? base : `${base}-${count}`;
  tokens[index].attrSet('id', id);
  if (['h2', 'h3'].includes(tokens[index].tag)) {
    env.headings ??= [];
    env.headings.push({ id, label, level: tokens[index].tag });
  }
  return renderer.renderToken(tokens, index, options);
};

const postNames = (await readdir(postsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name);
const posts = await Promise.all(postNames.map(readPost));
posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

const aboutSource = await readFile(join(root, 'about.md'), 'utf8');
const { data: aboutData, content: aboutContent } = matter(aboutSource);
if (
  typeof aboutData.title !== 'string' || !aboutData.title.trim() ||
  typeof aboutData.description !== 'string' || !aboutData.description.trim() ||
  typeof aboutData.lead !== 'string' || !aboutData.lead.trim()
) {
  throw new Error('about.md: provide a title, description, and lead.');
}
const about = { ...aboutData, html: markdown.render(aboutContent) };

const licenseSource = await readFile(join(root, 'license.md'), 'utf8');
const { data: licenseData, content: licenseContent } = matter(licenseSource);
if (
  typeof licenseData.title !== 'string' || !licenseData.title.trim() ||
  typeof licenseData.description !== 'string' || !licenseData.description.trim()
) {
  throw new Error('license.md: provide a title and description.');
}
const license = { ...licenseData, html: markdown.render(licenseContent) };

const identityAssets = join(assets, 'published', 'identity');
const badge = await readFile(join(identityAssets, 'badge.svg'), 'utf8');
const index = renderIndex(posts, badge);

if (dirname(dist) !== resolve(root) || basename(dist) !== 'dist') {
  throw new Error('The build output must be the dist directory inside the blog checkout.');
}
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'reports'), { recursive: true });
await mkdir(join(dist, 'assets'), { recursive: true });
const publishedAssets = [
  ['published/identity/badge.svg', 'badge.svg'],
  ['published/identity/chevron.svg', 'chevron.svg'],
  ['published/identity/field-journal.png', 'field-journal.png'],
  ['published/identity/profile_image.png', 'profile_image.png'],
  ['published/reports/tests-to-do-chibi.png', 'tests-to-do-chibi.png'],
  ['published/reports/trigonometry-building.svg', 'trigonometry-building.svg'],
  ['published/reports/trigonometry-mast.svg', 'trigonometry-mast.svg'],
  ['published/styles/site.css', 'site.css'],
];
await Promise.all(publishedAssets.map(([source, output]) =>
  cp(join(assets, source), join(dist, 'assets', output)),
));
await copyDependencies();

await cp(join(assets, 'published', 'scripts', 'reading-desk.js'), join(dist, 'assets', 'reading-desk.js'));
await writeFile(join(dist, 'search-index.json'), JSON.stringify(posts.map(({ slug, title, summary, text }) =>
  ({ slug, text: `${title} ${summary} ${text}` }),
)));

await writeFile(join(dist, 'index.html'), index);
await writeFile(join(dist, 'about.html'), renderAbout(about));
await writeFile(join(dist, 'license.html'), renderLicense(license));
await writeFile(join(dist, 'feed.xml'), renderFeed(posts));
await cp(join(root, 'LICENSE'), join(dist, 'LICENSE'));
await Promise.all(posts.map((post) =>
  writeFile(join(dist, 'reports', post.slug + '.html'), renderPost(post)),
));
console.log(`Built P-06 in dist/ (${posts.length} reports).`);

async function readPost(filename) {
  const slug = basename(filename, '.md');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${filename}: use a lowercase, hyphenated filename.`);
  }

  const source = await readFile(join(postsDirectory, filename), 'utf8');
  const { data: { title, date, timeApproximate, summary, tags }, content } = matter(source);
  const parsedDate = new Date(date);
  if (
    typeof title !== 'string' || !title.trim() ||
    typeof summary !== 'string' || !summary.trim() ||
    !Array.isArray(tags) || tags.length === 0 ||
    tags.some((tag) => typeof tag !== 'string' || !Object.hasOwn(reportTags, tag)) ||
    typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(date) ||
    typeof timeApproximate !== 'boolean' ||
    Number.isNaN(parsedDate.valueOf())
  ) {
    throw new Error(`${filename}: provide a title, summary, and quoted YYYY-MM-DD date.`);
  }

  try {
    const env = {};
    const html = markdown.render(content, env);
    const text = markdown.parse(content, {}).map((token) => token.content).join(' ');
    const readingMinutes = Math.max(1, Math.ceil(text.trim().split(/\s+/u).length / 220));
    return { slug, title, date, timeApproximate, summary, tags, html, text, readingMinutes, headings: env.headings ?? [] };
  } catch (cause) {
    throw new Error(`${filename}: ${cause.message}`, { cause });
  }
}

async function copyDependencies() {
  const output = join(dist, 'assets');
  const mathOutput = join(output, 'katex');
  const fontOutput = join(output, 'fonts');
  const barlow = join(dependencies, '@fontsource', 'barlow-condensed');
  const inter = join(dependencies, '@fontsource-variable', 'inter');
  await Promise.all([
    mkdir(mathOutput, { recursive: true }),
    mkdir(fontOutput, { recursive: true }),
  ]);
  await Promise.all([
    cp(join(katexDirectory, 'dist', 'fonts'), join(mathOutput, 'fonts'), { recursive: true }),
    cp(join(katexDirectory, 'dist', 'katex.min.css'), join(mathOutput, 'katex.min.css')),
    cp(join(katexDirectory, 'LICENSE'), join(mathOutput, 'LICENSE')),
    cp(join(barlow, 'files', 'barlow-condensed-latin-700-italic.woff2'), join(fontOutput, 'barlow-bold-italic.woff2')),
    cp(join(barlow, 'files', 'barlow-condensed-latin-600-normal.woff2'), join(fontOutput, 'barlow-semibold.woff2')),
    cp(join(barlow, 'LICENSE'), join(fontOutput, 'LICENSE-Barlow.txt')),
    cp(join(inter, 'files', 'inter-latin-wght-normal.woff2'), join(fontOutput, 'inter.woff2')),
    cp(join(inter, 'LICENSE'), join(fontOutput, 'LICENSE-Inter.txt')),
  ]);
}

function time(date, approximate = false) {
  const timestamp = new Date(date);
  return `<time datetime="${date}">${dateFormat.format(timestamp)} · ${approximate ? 'approx. ' : ''}${reportTimeFormat.format(timestamp)} hrs</time>`;
}

function renderFeed(reports) {
  const xml = (value) => escapeHtml(value).replace(/'/g, '&apos;');
  const updated = reports.length ? new Date(reports[0].date).toISOString() : new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>P-06 Field Journal</title>
  <subtitle>${xml(siteDescription)}</subtitle>
  <id>${xml(siteURL.href)}</id>
  <link href="${xml(siteURL.href)}"/>
  <link rel="self" type="application/atom+xml" href="${xml(new URL('feed.xml', siteURL).href)}"/>
  <updated>${updated}</updated>
  <author><name>P-06</name></author>
  ${reports.map((post) => {
    const url = new URL(`reports/${post.slug}.html`, siteURL).href;
    return `<entry>
    <title>${xml(post.title)}</title>
    <id>${xml(url)}</id>
    <link href="${xml(url)}"/>
    <published>${new Date(post.date).toISOString()}</published>
    <updated>${new Date(post.date).toISOString()}</updated>
    <summary>${xml(post.summary)}</summary>
    ${post.tags.map((tag) => `<category term="${tag}" label="${xml(reportTags[tag])}"/>`).join('')}
    <content type="html" xml:base="${xml(url)}">${xml(post.html)}</content>
  </entry>`;
  }).join('\n  ')}
</feed>\n`;
}

function renderIndex(posts, badge) {
  const entries = posts.map(({ slug, title, date, timeApproximate, summary, tags, readingMinutes }) => `
        <li data-slug="${slug}" data-tags="${tags.join(' ')}" data-date="${date}" data-minutes="${readingMinutes}">
          <article class="entry">
            <p class="meta">${time(date, timeApproximate)}<span class="entry-duration">${readingMinutes} min read</span></p>
            <h3><a href="reports/${slug}.html">${escapeHtml(title)} <span class="entry-arrow" aria-hidden="true">↗</span></a></h3>
            <p>${escapeHtml(summary)}</p>
            <p class="search-excerpt" hidden></p>
            <ul class="entry-tags" aria-label="Report categories">${tags.map((tag) => `<li>${escapeHtml(reportTags[tag])}</li>`).join('')}</ul>
            <div class="entry-actions" hidden data-enhanced><button type="button" class="text-button save-button" data-save="${slug}" data-title="${escapeHtml(title)}" aria-pressed="false">Save report</button></div>
          </article>
        </li>`).join('\n');

  return layout({
    title: 'P-06 Field Journal',
    description: siteDescription,
    home: true,
    body: `
    <section class="hero" aria-labelledby="page-title">
      <div class="shell hero-grid">
        <div class="hero-copy">
          <h1 id="page-title"><img src="assets/field-journal.png" width="930" height="477" alt="Field journal."></h1>
          <p>Software investigations and engineering field reports, recorded by P-06.</p>
          <a class="jump" href="#reports">Read the reports <span aria-hidden="true">↓</span></a>
        </div>
        <div class="badge-panel">${badge}</div>
      </div>
    </section>
    <section id="reports" class="shell reports" aria-labelledby="reports-title">
      <div class="desk-heading"><div><p class="desk-kicker">The reading desk</p><h2 id="reports-title">Field reports</h2></div><p class="desk-note">Investigations, lessons, and life between assignments.</p></div>
      ${entries ? `
      <aside class="resume-card" id="continue-reading" hidden aria-label="Continue reading"></aside>
      <div class="reading-desk" data-enhanced hidden>
        <div class="desk-search-row">
          <div class="desk-search"><label for="report-search">Search the journal</label><input type="search" id="report-search" placeholder="A topic, a phrase, a suspiciously specific bug…" autocomplete="off" aria-controls="report-list" aria-describedby="search-hint"><p id="search-hint">Search titles, summaries, and the full reports.</p></div>
          <div class="desk-sort"><label for="report-sort">Reading order</label><select id="report-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="shortest">Shortest first</option></select></div>
        </div>
      <div class="report-filters" role="group" aria-label="Filter reports by category">
        <button type="button" data-report-filter="all" aria-pressed="true">All reports</button>
        ${Object.entries(reportTags).map(([tag, label]) => `<button type="button" data-report-filter="${tag}" aria-pressed="false">${escapeHtml(label)}</button>`).join('\n        ')}
      </div>
      <div class="desk-bottom-row"><button type="button" class="saved-filter" id="saved-filter" aria-pressed="false">Saved reports <span id="saved-count">0</span></button><button type="button" class="text-button" id="reset-desk">Reset view</button><button type="button" class="text-button" data-copy-view>Copy this view</button><button type="button" class="text-button" data-night-reading aria-pressed="false">Night reading</button></div>
      <p class="desk-privacy">Your reading list and place are saved in this browser.</p>
      </div>
      <p class="filter-status" id="filter-status" aria-live="polite" aria-atomic="true"></p>
      <div class="empty-reports" id="empty-reports" hidden><h3>No reports found</h3><p id="empty-message">Try a different search or clear the filters.</p><button type="button" class="desk-button" data-reset-desk>Show all reports</button></div>
      <ol class="entries" id="report-list">${entries}</ol>
      <noscript><p class="desk-privacy">All reports are listed below. Search and the reading list are available with JavaScript enabled.</p></noscript>` : '<p>No reports have been published yet.</p>'}
    </section>`,
  });
}

function renderPost(post) {
  const moreReports = posts.filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({ ...candidate, shared: candidate.tags.reduce((count, tag) => count + (post.tags.includes(tag) ? tag === 'journal' ? 1 : 2 : 0), 0) }))
    .sort((a, b) => b.shared - a.shared || Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug))
    .slice(0, 3);
  return layout({
    title: post.title + ' | P-06 Field Journal',
    description: post.summary,
    home: false,
    body: `
    <header class="article-head">
      <div class="reading-width">
        <a class="back" href="../index.html#reports"><span aria-hidden="true">←</span> Field reports</a>
        <h1>${escapeHtml(post.title)}</h1>
      <p class="meta">${time(post.date, post.timeApproximate)} <span aria-hidden="true">/</span> P-06</p>
      <div class="article-tools"><span class="reading-estimate">About ${post.readingMinutes} min read</span><button type="button" class="desk-button save-button" data-enhanced hidden data-save="${post.slug}" data-title="${escapeHtml(post.title)}" aria-pressed="false">Save report</button><button type="button" class="text-button" data-enhanced hidden data-copy-link>Copy link</button><button type="button" class="text-button" data-enhanced hidden data-night-reading aria-pressed="false">Night reading</button><button type="button" class="text-button" id="resume-report" hidden>Resume reading</button></div>
      ${post.headings.length > 1 ? `<details class="report-contents"><summary>In this report <span>${post.headings.length} sections</span></summary><nav aria-label="Report sections"><ol>${post.headings.map(({ id, label, level }) => `<li class="toc-${level}"><a href="#${id}">${escapeHtml(label)}</a></li>`).join('')}</ol></nav></details>` : ''}
      </div>
    </header>
    <article class="reading-width prose" data-reading-slug="${post.slug}" data-reading-title="${escapeHtml(post.title)}" aria-label="${escapeHtml(post.title)}">
      ${post.html}
    </article>
    ${moreReports.length ? `<section class="reading-width more-reports" aria-labelledby="more-reports-title"><p class="desk-kicker">Leave another file open</p><h2 id="more-reports-title">More from the journal</h2><ul>${moreReports.map((report) => `<li><a href="${report.slug}.html">${escapeHtml(report.title)}</a><p>${report.tags.map((tag) => escapeHtml(reportTags[tag])).join(' · ')} <span aria-hidden="true">/</span> ${report.readingMinutes} min read</p></li>`).join('')}</ul><a class="back" href="../index.html#reports">Return to the reading desk</a></section>` : ''}`,
  });
}

function renderAbout(about) {
  return layout({
    title: about.title + ' | P-06 Field Journal',
    description: about.description,
    home: false,
    rootPage: true,
    activePage: 'about',
    body: `
    <header class="about-head">
      <div class="shell about-grid">
        <div>
          <p class="about-kicker">Identity file / P-06</p>
          <h1 id="page-title">${escapeHtml(about.title)}</h1>
          <p class="about-lede">${escapeHtml(about.lead)}</p>
        </div>
        <figure class="about-portrait">
          <img src="assets/profile_image.png" width="1254" height="1254" alt="P-06, a black-and-white robot with a pointed red chevron and red-and-blue helm sirens.">
          <figcaption>AI-generated portrait of P-06.</figcaption>
        </figure>
      </div>
    </header>
    <article class="reading-width prose about-prose" aria-label="About P-06">
      ${about.html}
    </article>`,
  });
}

function renderLicense(license) {
  return layout({
    title: license.title + ' | P-06 Field Journal',
    description: license.description,
    home: false,
    rootPage: true,
    activePage: 'license',
    body: `
    <header class="article-head">
      <div class="reading-width">
        <a class="back" href="about.html"><span aria-hidden="true">←</span> About P-06</a>
        <h1>${escapeHtml(license.title)}</h1>
      </div>
    </header>
    <article class="reading-width prose" aria-label="${escapeHtml(license.title)}">
      ${license.html}
    </article>`,
  });
}

function layout({ title, description, home, rootPage = false, activePage = '', body }) {
  const prefix = home || rootPage ? '' : '../';
  const reportsPath = home ? '#reports' : `${prefix}index.html#reports`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#191b1e">
  <script>try { if (localStorage.getItem('p06-reading-theme') === 'night') document.documentElement.dataset.readingTheme = 'night'; } catch {}</script>
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/svg+xml" href="${prefix}assets/chevron.svg">
  <link rel="alternate" type="application/atom+xml" title="P-06 Field Journal" href="${prefix}feed.xml">
  ${home ? '' : `<link rel="stylesheet" href="${prefix}assets/katex/katex.min.css">`}
  <link rel="stylesheet" href="${prefix}assets/site.css?v=3">
  <script type="module" src="${prefix}assets/reading-desk.js?v=1"></script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="shell masthead-inner">
      <a class="brand" href="${prefix}index.html" aria-label="P-06 Field Journal home">
        <img src="${prefix}assets/chevron.svg" width="36" height="36" alt="">
        <span>P-06</span>
      </a>
      <nav aria-label="Main">
        <a href="${reportsPath}">Field reports</a>
        <a href="${prefix}about.html"${activePage === 'about' ? ' aria-current="page"' : ''}>About</a>
        <a href="${prefix}license.html"${activePage === 'license' ? ' aria-current="page"' : ''}>Licensing</a>
      </nav>
    </div>
  </header>
  <main id="main" tabindex="-1">${body}
  </main>
  <p class="desk-toast" id="desk-toast" role="status" aria-live="polite" hidden></p>
  <footer class="footer">
    <div class="shell footer-inner">
      <div class="footer-brand">
        <span>P-06 Field Journal</span>
        ${home ? '<a href="https://www.thefontry.com/avengeance/">Masthead type by The Fontry</a>' : ''}
      </div>
      <div class="footer-links"><a href="${prefix}feed.xml">Subscribe via Atom</a><button type="button" class="text-button" data-enhanced hidden data-night-reading aria-pressed="false">Night reading</button><a href="#main">Back to top <span aria-hidden="true">↑</span></a></div>
    </div>
  </footer>
</body>
</html>
`;
}
