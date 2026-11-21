// Reading preferences stay in this browser. No accounts or remote storage.
const storageKey = 'p06-reading-desk-v1';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let storageAvailable = true;
let state = { saved: [], last: null };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && typeof stored === 'object') {
    state.saved = Array.isArray(stored.saved)
      ? [...new Set(stored.saved.filter((slug) => typeof slug === 'string' && slugPattern.test(slug)))].slice(0, 500)
      : [];
    const last = stored.last;
    if (last && typeof last.slug === 'string' && slugPattern.test(last.slug)
      && typeof last.position === 'number' && Number.isFinite(last.position)) {
      state.last = { slug: last.slug, position: Math.max(0, Math.min(1, last.position)) };
    }
  }
} catch {
  storageAvailable = false;
}

const saveState = () => {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
  document.querySelectorAll('.desk-privacy').forEach((note) => {
    note.textContent = storageAvailable
      ? 'Your reading list and place are saved in this browser.'
      : 'Browser storage is unavailable. Your reading list lasts for this visit.';
  });
};

let toastTimer;
function announce(message) {
  const toast = document.getElementById('desk-toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

const saveButtons = [...document.querySelectorAll('[data-save]')];
function updateSaveButtons() {
  saveButtons.forEach((button) => {
    const saved = state.saved.includes(button.dataset.save);
    button.textContent = saved ? 'Saved' : 'Save report';
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${button.dataset.title}${saved ? ' from reading list' : ' to reading list'}`);
  });
  const savedCount = document.getElementById('saved-count');
  if (savedCount) {
    const slugs = new Set([...document.querySelectorAll('#report-list > li')].map((item) => item.dataset.slug));
    savedCount.textContent = state.saved.filter((slug) => slugs.has(slug)).length;
  }
}

saveButtons.forEach((button) => button.addEventListener('click', () => {
  const slug = button.dataset.save;
  const wasSaved = state.saved.includes(slug);
  state.saved = wasSaved ? state.saved.filter((saved) => saved !== slug) : [...state.saved, slug];
  saveState();
  updateSaveButtons();
  updateReports?.();
  announce(wasSaved ? 'Removed from your reading list.' : storageAvailable ? 'Saved to your reading list.' : 'Saved for this visit. Browser storage is unavailable.');
}));

// Use text nodes for all messages and a validated slug for every stored link.
const continueCard = document.getElementById('continue-reading');
function updateContinueCard() {
  if (!continueCard) return;
  continueCard.replaceChildren();
  continueCard.hidden = true;
  if (!state.last || state.last.position <= 0.03 || state.last.position >= 0.95) return;
  const item = [...document.querySelectorAll('#report-list > li')].find((entry) => entry.dataset.slug === state.last.slug);
  if (item) {
    const label = document.createElement('p');
    label.className = 'desk-kicker';
    label.textContent = 'Where you left off';
    const link = document.createElement('a');
    link.href = `reports/${state.last.slug}.html?resume=1`;
    link.textContent = item.querySelector('h3 a').textContent.replace('↗', '').trim();
    const detail = document.createElement('span');
    detail.textContent = `${Math.round(state.last.position * 100)}% through · Continue reading`;
    continueCard.append(label, link, detail);
    continueCard.hidden = false;
  }
}
updateContinueCard();

const normalize = (text) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[’‘]/g, "'");
const list = document.getElementById('report-list');
let updateReports;
if (list) {
  const items = [...list.children];
  const search = document.getElementById('report-search');
  const sort = document.getElementById('report-sort');
  const savedFilter = document.getElementById('saved-filter');
  const status = document.getElementById('filter-status');
  const empty = document.getElementById('empty-reports');
  const filters = [...document.querySelectorAll('[data-report-filter]')];
  const allowedTags = new Set(filters.map((button) => button.dataset.reportFilter).filter((tag) => tag !== 'all'));
  const selectedTags = new Set();
  let onlySaved = false;
  let fullIndex = new Map(items.map((item) => [item.dataset.slug, item.textContent]));
  let indexReady = false;
  let indexFailed = false;

  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') ?? '';
    selectedTags.clear();
    (params.get('tags') ?? '').split(',').filter((tag) => allowedTags.has(tag)).forEach((tag) => selectedTags.add(tag));
    const order = params.get('sort');
    sort.value = ['oldest', 'shortest'].includes(order) ? order : 'newest';
    onlySaved = params.get('saved') === '1';
  }

  function writeURL() {
    const url = new URL(location.href);
    const query = search.value.trim();
    const values = { q: query, tags: [...selectedTags].join(','), sort: sort.value === 'newest' ? '' : sort.value, saved: onlySaved ? '1' : '' };
    Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    // Filtering should not add one browser-history entry for each keystroke.
    try { history.replaceState(null, '', url); } catch { /* The report list still works without URL updates. */ }
  }

  updateReports = (syncURL = true) => {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    const ordered = [...items].sort((a, b) => {
      if (sort.value === 'shortest') {
        const difference = Number(a.dataset.minutes) - Number(b.dataset.minutes);
        if (difference) return difference;
      }
      const difference = Date.parse(b.dataset.date) - Date.parse(a.dataset.date);
      return (sort.value === 'oldest' ? -difference : difference) || a.dataset.slug.localeCompare(b.dataset.slug);
    });
    let visible = 0;
    ordered.forEach((item) => {
      const matchesTags = !selectedTags.size || item.dataset.tags.split(' ').some((tag) => selectedTags.has(tag));
      const matchesSaved = !onlySaved || state.saved.includes(item.dataset.slug);
      const source = fullIndex.get(item.dataset.slug) ?? '';
      const text = normalize(source);
      const matchesSearch = terms.every((term) => text.includes(term));
      item.hidden = !(matchesTags && matchesSaved && matchesSearch);
      const excerpt = item.querySelector('.search-excerpt');
      excerpt.hidden = item.hidden || !terms.length || !indexReady;
      if (!excerpt.hidden) {
        const firstMatch = text.indexOf(terms[0]);
        const start = Math.max(0, firstMatch - 55);
        const snippet = source.slice(start, start + 210).replace(/\s+/gu, ' ');
        excerpt.textContent = `${start ? '…' : ''}${snippet}${start + 210 < source.length ? '…' : ''}`;
      }
      if (!item.hidden) visible += 1;
    });
    // Append only when order changed, preserving focused save buttons during filtering.
    if (ordered.some((item, index) => list.children[index] !== item)) list.append(...ordered);
    filters.forEach((button) => {
      const tag = button.dataset.reportFilter;
      button.setAttribute('aria-pressed', String(tag === 'all' ? !selectedTags.size : selectedTags.has(tag)));
    });
    savedFilter.setAttribute('aria-pressed', String(onlySaved));
    const loading = terms.length && !indexReady && !indexFailed;
    status.textContent = loading ? 'Searching the full reports…' : `${visible} of ${items.length} reports${onlySaved ? ' in your reading list' : ''}.${indexFailed ? ' Full-text search is unavailable; searching titles and summaries.' : ''}`;
    empty.hidden = visible !== 0 || loading;
    document.getElementById('empty-message').textContent = onlySaved && !state.saved.length
      ? 'Save a report using its “Save report” button, then find it here.'
      : 'Try a different search or clear the filters.';
    if (syncURL) writeURL();
  };

  const reset = () => {
    search.value = '';
    selectedTags.clear();
    onlySaved = false;
    sort.value = 'newest';
    updateReports();
  };
  document.querySelectorAll('#reset-desk, [data-reset-desk]').forEach((button) => button.addEventListener('click', reset));
  filters.forEach((button) => button.addEventListener('click', () => {
    const tag = button.dataset.reportFilter;
    if (tag === 'all') selectedTags.clear();
    else if (selectedTags.has(tag)) selectedTags.delete(tag);
    else selectedTags.add(tag);
    updateReports();
  }));
  search.addEventListener('input', () => updateReports());
  sort.addEventListener('change', () => updateReports());
  savedFilter.addEventListener('click', () => { onlySaved = !onlySaved; updateReports(); });
  window.addEventListener('popstate', () => { readURL(); updateReports(false); });
  readURL();
  updateReports(false);
  fetch(new URL('../search-index.json', import.meta.url))
    .then((response) => { if (!response.ok) throw new Error('Search index unavailable'); return response.json(); })
    .then((entries) => {
      if (!Array.isArray(entries)) throw new Error('Invalid search index');
      entries.filter((entry) => typeof entry?.slug === 'string' && typeof entry.text === 'string').forEach((entry) => fullIndex.set(entry.slug, entry.text));
      indexReady = true;
      updateReports(false);
    }).catch(() => { indexFailed = true; updateReports(false); });
}

async function copyLink(button, view = false) {
  const url = new URL(location.href);
  if (view) url.hash = 'reports';
  else url.searchParams.delete('resume');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(url.href);
    announce(view ? 'Link to this view copied.' : 'Report link copied.');
  } catch {
    // The URL remains selectable when clipboard permissions are unavailable.
    let field = button.parentElement.querySelector('.copy-fallback');
    if (!field) {
      field = document.createElement('input');
      field.className = 'copy-fallback';
      field.readOnly = true;
      field.setAttribute('aria-label', 'Link to copy');
      button.after(field);
    }
    field.value = url.href;
    field.focus();
    field.select();
    announce('Select and copy the link shown.');
  }
}
document.querySelectorAll('[data-copy-view]').forEach((button) => button.addEventListener('click', () => copyLink(button, true)));
document.querySelectorAll('[data-copy-link]').forEach((button) => button.addEventListener('click', () => copyLink(button)));

const article = document.querySelector('[data-reading-slug]');
if (article) {
  const slug = article.dataset.readingSlug;
  const previous = state.last?.slug === slug ? state.last.position : 0;
  let furthest = previous;
  const resume = document.getElementById('resume-report');
  let hasScrolled = false;
  const resumeReading = () => {
    const distance = Math.max(0, article.offsetHeight - innerHeight);
    scrollTo({ top: article.offsetTop + previous * distance, behavior: 'instant' });
    resume.hidden = true;
  };
  if (previous > 0.03 && previous < 0.95) {
    resume.hidden = false;
    resume.textContent = `Resume at ${Math.round(previous * 100)}%`;
    resume.addEventListener('click', resumeReading);
    if (new URLSearchParams(location.search).get('resume') === '1' && !location.hash) {
      if (document.readyState === 'complete') resumeReading();
      else window.addEventListener('load', resumeReading, { once: true });
    }
  }
  let progressTimer;
  const recordProgress = () => {
    if (!hasScrolled) return;
    const distance = article.offsetHeight - innerHeight;
    if (scrollY + innerHeight <= article.offsetTop) return;
    const position = distance <= 0 ? 1 : Math.max(0, Math.min(1, (scrollY - article.offsetTop) / distance));
    if (position <= 0.03) return;
    // Returning to the navigation at the top must not erase a reader's place.
    furthest = Math.max(furthest, position);
    state.last = { slug, position: furthest };
    saveState();
  };
  window.addEventListener('scroll', () => {
    hasScrolled = true;
    clearTimeout(progressTimer);
    progressTimer = setTimeout(recordProgress, 200);
  }, { passive: true });
  window.addEventListener('pagehide', recordProgress);
}

// A reading list changed in another tab should not be overwritten by this one.
window.addEventListener('storage', (event) => {
  if (event.key === 'p06-reading-theme') {
    document.documentElement.dataset.readingTheme = event.newValue === 'night' ? 'night' : 'day';
    updateThemeButtons();
    return;
  }
  if (event.key !== storageKey && event.key !== null) return;
  try {
    const next = JSON.parse(event.newValue);
    state.saved = Array.isArray(next?.saved)
      ? [...new Set(next.saved.filter((slug) => typeof slug === 'string' && slugPattern.test(slug)))].slice(0, 500) : [];
    const last = next?.last;
    state.last = last && typeof last.slug === 'string' && slugPattern.test(last.slug)
      && Number.isFinite(last.position) ? { slug: last.slug, position: Math.max(0, Math.min(1, last.position)) } : null;
    updateSaveButtons();
    updateReports?.(false);
    updateContinueCard();
  } catch { /* Ignore malformed data written outside the reading desk. */ }
});

const themeButtons = [...document.querySelectorAll('[data-night-reading]')];
function updateThemeButtons() {
  const night = document.documentElement.dataset.readingTheme === 'night';
  themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(night)));
}
themeButtons.forEach((button) => button.addEventListener('click', () => {
  const theme = document.documentElement.dataset.readingTheme === 'night' ? 'day' : 'night';
  document.documentElement.dataset.readingTheme = theme;
  updateThemeButtons();
  try { localStorage.setItem('p06-reading-theme', theme); }
  catch { announce('Reading appearance changed for this visit.'); }
}));
updateThemeButtons();

document.querySelectorAll('[data-enhanced]').forEach((element) => { element.hidden = false; });
updateSaveButtons();
saveState();
