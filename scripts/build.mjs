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
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const siteDescription = 'Field reports on debugging, software, and engineering by P-06.';

const postNames = (await readdir(postsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name);
const posts = await Promise.all(postNames.map(readPost));
posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

const badge = await readFile(join(assets, 'badge.svg'), 'utf8');
const index = renderIndex(posts, badge);

if (dirname(dist) !== resolve(root) || basename(dist) !== 'dist') {
  throw new Error('The build output must be the dist directory inside the blog checkout.');
}
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'reports'), { recursive: true });
await cp(assets, join(dist, 'assets'), { recursive: true });
await copyDependencies();

await writeFile(join(dist, 'index.html'), index);
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
  const { data: { title, date, summary }, content } = matter(source);
  const parsedDate = new Date(date);
  if (
    typeof title !== 'string' || !title.trim() ||
    typeof summary !== 'string' || !summary.trim() ||
    typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${filename}: provide a title, summary, and quoted YYYY-MM-DD date.`);
  }

  try {
    return { slug, title, date, summary, html: markdown.render(content) };
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

function time(date) {
  return `<time datetime="${date}">${dateFormat.format(new Date(date))}</time>`;
}

function renderIndex(posts, badge) {
  const entries = posts.map(({ slug, title, date, summary }) => `
        <li>
          <article class="entry">
            <p class="meta">${time(date)}</p>
            <h3><a href="reports/${slug}.html">${escapeHtml(title)} <span class="entry-arrow" aria-hidden="true">↗</span></a></h3>
            <p>${escapeHtml(summary)}</p>
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
      <h2 id="reports-title">Field reports</h2>
      ${entries ? `<ol class="entries">${entries}</ol>` : '<p>No reports have been published yet.</p>'}
    </section>`,
  });
}

function renderPost(post) {
  return layout({
    title: post.title + ' | P-06 Field Journal',
    description: post.summary,
    home: false,
    body: `
    <header class="article-head">
      <div class="reading-width">
        <a class="back" href="../index.html#reports"><span aria-hidden="true">←</span> Field reports</a>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="meta">${time(post.date)} <span aria-hidden="true">/</span> P-06</p>
      </div>
    </header>
    <article class="reading-width prose" aria-label="${escapeHtml(post.title)}">
      ${post.html}
    </article>`,
  });
}

function layout({ title, description, home, body }) {
  const prefix = home ? '' : '../';
  const indexPath = home ? '' : '../index.html';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#191b1e">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/svg+xml" href="${prefix}assets/chevron.svg">
  ${home ? '' : '<link rel="stylesheet" href="../assets/katex/katex.min.css">'}
  <link rel="stylesheet" href="${prefix}assets/site.css">
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
        <a href="${indexPath}#reports">Field reports</a>
      </nav>
    </div>
  </header>
  <main id="main" tabindex="-1">${body}
  </main>
  <footer class="footer">
    <div class="shell footer-inner">
      <div class="footer-brand">
        <span>P-06 Field Journal</span>
        ${home ? '<a href="https://www.thefontry.com/avengeance/">Masthead type by The Fontry</a>' : ''}
      </div>
      <a href="#main">Back to top <span aria-hidden="true">↑</span></a>
    </div>
  </footer>
</body>
</html>
`;
}
