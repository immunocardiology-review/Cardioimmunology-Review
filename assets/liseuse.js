// La liseuse de Cardioimmunology Review : lecture continue des PDF originaux, sans modification du texte.
import './book-download.js';
import { mountComfort } from './reader-comfort.js?v=20261027';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DATA = await (await fetch(new URL('./liseuse-data.json', import.meta.url))).json();
const BREAKS = await fetch(new URL('./reader-breaks.json', import.meta.url)).then(r=>r.ok?r.json():{}).catch(()=>({}));
const key = params.get('livre');
const book = DATA.books[key];
const EN = book ? book.lang === 'en' : document.documentElement.lang === 'en';
const L = EN ? {
  contents: 'Contents', search: 'Search', view: 'Display', full: 'Full screen', exitFull: 'Exit full screen', download: 'Download the PDF',
  single: 'One page', double: 'Two pages', fit: 'Fit', zoomIn: 'Zoom in', zoomOut: 'Zoom out', theme: 'Theme',
  day: 'Day', sepia: 'Sepia', night: 'Night', page: 'Page', of: 'of', chapter: 'Chapter', opening: 'Opening the book…',
  openingPart: 'Opening the chapter…', resume: 'Resume at page', searchPh: 'Search the book', searching: 'Searching',
  pages: 'pages', results: 'results', none: 'No result.', searchNote: 'The search reads the whole book; the first search of a long book takes a little time.',
  error: 'The book could not be opened. Try again, or download the original PDF.', back: 'Back to the book', shortcuts: 'Keyboard shortcuts',
  keys: [['← →', 'previous or next page'], ['+ −', 'zoom'], ['T', 'contents'], ['/', 'search'], ['F', 'full screen'], ['N', 'night mode'], ['Esc', 'close']],
  cite: 'Cite', close: 'Close', copied: 'Link copied', share: 'Copy the link to this page', choose: 'Choose a book', readerTitle: 'The reader'
} : {
  contents: 'Sommaire', search: 'Rechercher', view: 'Affichage', full: 'Plein écran', exitFull: 'Quitter le plein écran', download: 'Télécharger le PDF',
  single: 'Une page', double: 'Double page', fit: 'Ajuster', zoomIn: 'Agrandir', zoomOut: 'Réduire', theme: 'Thème',
  day: 'Jour', sepia: 'Sépia', night: 'Nuit', page: 'Page', of: 'sur', chapter: 'Chapitre', opening: 'Ouverture du livre…',
  openingPart: 'Ouverture du chapitre…', resume: 'Reprendre à la page', searchPh: 'Rechercher dans le livre', searching: 'Recherche',
  pages: 'pages', results: 'résultats', none: 'Aucun résultat.', searchNote: 'La recherche parcourt tout le livre ; la première recherche dans un long livre prend un peu de temps.',
  error: 'Le livre n’a pas pu être ouvert. Réessayez, ou téléchargez le PDF original.', back: 'Retour au livre', shortcuts: 'Raccourcis clavier',
  keys: [['← →', 'page précédente ou suivante'], ['+ −', 'zoom'], ['T', 'sommaire'], ['/', 'rechercher'], ['F', 'plein écran'], ['N', 'mode nuit'], ['Échap', 'fermer']],
  cite: 'Citer', close: 'Fermer', copied: 'Lien copié', share: 'Copier le lien vers cette page', choose: 'Choisir un livre', readerTitle: 'La liseuse'
};
const base = new URL('../', import.meta.url);
const href = p => new URL(p, base).href;
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const prefs = Object.assign({ theme: 'jour', mode: 'single', zoom: 1 }, store.get('cir-liseuse-prefs') || {});
const savePrefs = () => store.set('cir-liseuse-prefs', prefs);
document.documentElement.dataset.theme = prefs.theme;
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// ------------------------------------------------------------------ choix du livre
if (!book) {
  document.title = `${L.readerTitle} | Cardioimmunology Review`;
  $('#app').innerHTML = `<div class="shelf-pick"><p class="kicker"><a href="${href(EN ? './' : 'fr.html')}">← Cardioimmunology Review</a></p><h1>${L.readerTitle}</h1><p class="lede">${L.choose}</p><div class="pick">` +
    Object.entries(DATA.books).map(([k, b]) => `<a href="?livre=${k}"><img src="${href(b.cover)}" alt="" width="420" height="594"><span class="t" lang="${b.lang}">${b.title}</span><span class="s">${b.pages} ${L.pages}</span></a>`).join('') + '</div></div>';
} else await run();

async function run() {
const { getDocument, GlobalWorkerOptions, TextLayer, PDFDataRangeTransport, OPS } = await import('./book-pdf.mjs');
GlobalWorkerOptions.workerSrc = new URL('./book-pdf.worker.mjs', import.meta.url).href;

// ------------------------------------------------------------------ interface
document.documentElement.lang = book.lang;
const chapters = book.chapters;
$('#app').innerHTML = `
<header class="rbar">
  <a class="rback" href="${href(book.path)}" title="${L.back}">${icon('back')}<span class="rbook" lang="${book.lang}">${book.title}</span></a>
  <div class="rwhere"><span class="rchap" id="rchap"></span></div>
  <div class="rtools">
    <button type="button" id="b-toc" aria-expanded="false" aria-controls="toc" title="${L.contents} (T)">${icon('toc')}<span>${L.contents}</span></button>
    <button type="button" id="b-search" aria-expanded="false" aria-controls="search" title="${L.search} (/)">${icon('search')}<span>${L.search}</span></button>
    <div class="rpage"><label class="sr" for="pg">${L.page}</label><input id="pg" type="text" inputmode="numeric" autocomplete="off" value="1"><span>/ ${book.pages}</span></div>
    <button type="button" id="b-reading" disabled aria-pressed="false" title="${EN ? 'Comfort reading' : 'Lecture confortable'}"><b aria-hidden="true">Aa</b><span>${EN ? 'Text' : 'Texte'}</span></button>
    <button type="button" id="b-view" aria-expanded="false" aria-controls="viewmenu" title="${L.view}">${icon('view')}<span>${L.view}</span></button>
    <button type="button" id="b-full" class="hide-s" title="${L.full} (F)">${icon('full')}</button>
    <a class="hide-s" id="b-dl" href="${href(book.pdf)}" download="${book.pdfName}" data-pdf-download="${book.pdfName}" data-pdf-bytes="${book.bytes}" title="${L.download}">${icon('dl')}</a>
  </div>
  <div class="rprogress" aria-hidden="true"><i id="prog"></i></div>
</header>
<div class="menu" id="viewmenu" hidden>
  <div class="seg" role="group" aria-label="${EN ? 'Reading mode' : 'Mode de lecture'}"><button type="button" id="read-text" disabled>${EN ? 'Comfort reading' : 'Lecture confortable'}</button><button type="button" id="read-original" disabled>${EN ? 'Original PDF' : 'PDF original'}</button></div>
  <div class="seg" role="group" aria-label="${L.view}"><button type="button" data-mode="single">${L.single}</button><button type="button" data-mode="double">${L.double}</button></div>
  <div class="seg" role="group" aria-label="Zoom"><button type="button" id="z-out" title="${L.zoomOut} (−)">−</button><button type="button" id="z-fit">${L.fit}</button><button type="button" id="z-in" title="${L.zoomIn} (+)">+</button></div>
  <div class="seg" role="group" aria-label="${L.theme}"><button type="button" data-theme="jour">${L.day}</button><button type="button" data-theme="sepia">${L.sepia}</button><button type="button" data-theme="nuit">${L.night}</button></div>
  <button type="button" class="menu-line" id="b-share">${L.share}</button>
  <a class="menu-line show-s" href="${href(book.pdf)}" download="${book.pdfName}" data-pdf-download="${book.pdfName}" data-pdf-bytes="${book.bytes}">${L.download}</a>
  <button type="button" class="menu-line" id="b-keys">${L.shortcuts}</button>
</div>
<aside class="drawer" id="toc" hidden aria-label="${L.contents}"><div class="dhead"><img src="${href(book.cover)}" alt="" width="84" height="119"><div><p class="kicker">${book.kind}</p><p class="dtitle" lang="${book.lang}">${book.title}</p><p class="dmeta">${book.pages} ${L.pages} · <a href="${href(book.citeUrl)}">${L.cite}</a></p></div><button type="button" class="x" data-close="toc" aria-label="${L.close}">×</button></div>
  <ol class="chapters">${chapters.map(c => `<li><a href="?livre=${key}&page=${c.readingPage}" data-page="${c.readingPage}" data-n="${c.number}"><span class="n">${String(c.number).padStart(2, '0')}</span><span class="t">${c.title}</span><span class="p">${c.readingPage}</span></a></li>`).join('')}</ol></aside>
<aside class="drawer" id="search" hidden aria-label="${L.search}"><div class="dhead search-head"><form id="sform" role="search"><input id="q" type="search" placeholder="${L.searchPh}" autocomplete="off" aria-label="${L.searchPh}"></form><button type="button" class="x" data-close="search" aria-label="${L.close}">×</button></div>
  <p class="snote">${L.searchNote}</p><p class="sstatus" id="sstatus" role="status" aria-live="polite"></p><ol class="hits" id="hits"></ol></aside>
<div class="keys" id="keys" hidden role="dialog" aria-modal="true" aria-label="${L.shortcuts}"><div><h2>${L.shortcuts}</h2><dl>${L.keys.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join('')}</dl><button type="button" data-close="keys">${L.close}</button></div></div>
<h1 class="sr" lang="${book.lang}">${book.title}</h1>
<main id="reader" class="reader" tabindex="0" aria-label="${book.title}"><div class="sheets" id="sheets"></div></main>
<main id="comfort" class="comfort-reader" tabindex="-1" aria-label="${book.title}" hidden></main>
<p class="toast" id="toast" role="status" aria-live="polite" hidden></p>
<button type="button" class="nav prev" id="b-prev" aria-label="${L.page} −1">${icon('left')}</button><button type="button" class="nav next" id="b-next" aria-label="${L.page} +1">${icon('right')}</button>`;

const reader = $('#reader'), sheets = $('#sheets'), comfortHost = $('#comfort');
let comfortable = false, textReader;
prefs.textSize = Math.max(17,Math.min(26,+prefs.textSize || 20));
const toast = (t, ms = 2600, action) => { const el = $('#toast'); el.innerHTML = t; el.hidden = false; clearTimeout(toast.t); if (ms) toast.t = setTimeout(() => el.hidden = true, ms); if (action) el.querySelector('button')?.addEventListener('click', action, { once: true }); };
const status = t => toast(t, 0);

// ------------------------------------------------------------------ chargement (lecture partielle des grands PDF archivés)
class ArchiveRanges extends PDFDataRangeTransport {
  constructor(url, length, initial) { super(length, initial, true); this.url = url; this.ctl = new Set(); }
  async requestDataRange(begin, end) {
    const c = new AbortController(); this.ctl.add(c);
    try {
      const r = await fetch(this.url, { headers: { Range: `bytes=${begin}-${end - 1}` }, credentials: 'omit', signal: c.signal });
      if (r.status !== 206) { await r.body?.cancel(); throw Error('range'); }
      const b = new Uint8Array(await r.arrayBuffer()); if (b.byteLength !== end - begin) throw Error('short');
      if (!c.signal.aborted) this.onDataRange(begin, b);
    } catch (e) { if (!c.signal.aborted) this.onError?.(e); } finally { this.ctl.delete(c); }
  }
  abort() { for (const c of this.ctl) c.abort(); this.ctl.clear(); }
}
let opened = false;
async function open() {
  const url = href(book.pdf); const chunk = 262144; let range;
  if (book.bytes > 4e6 && /^https:\/\/zenodo\.org\/api\//.test(url)) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=0-${chunk - 1}` }, credentials: 'omit' });
      if (r.status === 206) { const init = new Uint8Array(await r.arrayBuffer()); if (init.length === chunk) range = new ArchiveRanges(url, book.bytes, init); } else await r.body?.cancel();
    } catch {}
  }
  const opts = { url, isEvalSupported: false, withCredentials: false };
  if (range) Object.assign(opts, { range, rangeChunkSize: chunk, disableStream: true, disableAutoFetch: true });
  const task = getDocument(opts);
  task.onProgress = ({ loaded, total }) => !opened && status(range ? L.openingPart : `${L.opening} ${total ? Math.floor(loaded / total * 100) + ' %' : ''}`);
  if (!range) return task.promise;
  const failed = new Promise((_, rej) => { range.onError = e => { range.abort(); task.destroy().catch(() => {}); rej(e); }; });
  try { return await Promise.race([task.promise, failed]); }
  catch { const t = getDocument({ url, isEvalSupported: false, withCredentials: false }); t.onProgress = task.onProgress; return t.promise; }
}

// ------------------------------------------------------------------ mise en page
let pdf, baseW = 595, baseH = 842, pageW = 600, pageH = 848, gap = 22, padTop = 28, current = 1, slots = [];
const N = book.pages;
const isMobile = () => matchMedia('(max-width:760px)').matches;
function mode() { return isMobile() ? 'single' : prefs.mode; }
function layout(keepPage = current) {
  if (comfortable) { textReader?.font(); return; }
  const drawer = matchMedia('(min-width:1300px)').matches && document.documentElement.classList.contains('drawer-open') ? 396 : 0;
  const W = reader.clientWidth - (isMobile() ? 16 : 64) - drawer;
  sheets.style.paddingLeft = drawer ? (drawer + 16) + 'px' : '';
  const dbl = mode() === 'double';
  const maxW = dbl ? Math.min((W - gap) / 2, 760) : Math.min(W, 900);
  pageW = Math.max(240, Math.round(maxW * (isMobile() ? Math.min(prefs.zoom, 2.5) : prefs.zoom)));
  if (isMobile() && prefs.zoom <= 1) pageW = Math.round(W);
  pageH = Math.round(pageW * baseH / baseW);
  gap = isMobile() ? 12 : 22;
  sheets.className = 'sheets ' + (dbl ? 'is-double' : 'is-single');
  sheets.style.setProperty('--pw', pageW + 'px'); sheets.style.setProperty('--ph', pageH + 'px'); sheets.style.setProperty('--gap', gap + 'px');
  for (const s of slots) if (s.done || s.task) release(s);
  goTo(keepPage, false);
  queueVisible();
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode()));
  $('[data-mode="double"]').disabled = isMobile();
}
function rowOf(n) { return mode() === 'double' ? Math.floor(n / 2) : n - 1; }
function topOf(n) { return padTop + rowOf(n) * (pageH + gap); }
function pageAt(y) {
  const row = Math.max(0, Math.floor((y - padTop + gap / 2) / (pageH + gap)));
  if (mode() === 'double') return Math.min(N, Math.max(1, row * 2));
  return Math.min(N, row + 1);
}
function goTo(n, smooth = true) {
  n = Math.min(N, Math.max(1, n | 0));
  if (comfortable && textReader) { textReader.go(n); return; }
  reader.scrollTo({ top: topOf(n) - 10, behavior: smooth && !matchMedia('(prefers-reduced-motion:reduce)').matches ? 'smooth' : 'instant' });
  setCurrent(n);
}

// ------------------------------------------------------------------ rendu à la demande
let gen = 0;
function release(s) { s.task?.cancel?.(); s.task = null; s.done = false; s.el.replaceChildren(); s.el.classList.remove('ready'); }
async function render(s) {
  if (s.done || s.task || !pdf) return;
  const g = gen;
  const page = await pdf.getPage(s.n); if (g !== gen) return;
  const v1 = page.getViewport({ scale: 1 });
  let scale = pageW / v1.width; if (v1.height * scale > pageH + 1) scale = pageH / v1.height;
  const vp = page.getViewport({ scale });
  const ratio = Math.min(devicePixelRatio || 1, 2.5, Math.sqrt(9e6 / (vp.width * vp.height)));
  const canvas = document.createElement('canvas'); canvas.width = Math.floor(vp.width * ratio); canvas.height = Math.floor(vp.height * ratio);
  canvas.style.width = vp.width + 'px'; canvas.style.height = vp.height + 'px'; canvas.setAttribute('aria-hidden', 'true');
  const box = document.createElement('div'); box.className = 'pagebox'; box.style.width = vp.width + 'px'; box.style.height = vp.height + 'px';
  box.style.setProperty('--scale-factor', scale); box.style.setProperty('--total-scale-factor', scale); box.style.setProperty('--user-unit', 1);
  const text = document.createElement('div'); text.className = 'textLayer';
  box.append(canvas, text);
  s.task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
  try { await s.task.promise; } catch (e) { s.task = null; return; }
  if (g !== gen) return;
  s.task = null; s.done = true; s.el.replaceChildren(box); s.el.classList.add('ready');
  page.getTextContent().then(async tc => { if (!s.done) return; const layer = new TextLayer({ textContentSource: tc, container: text, viewport: vp }); await layer.render(); mark(s); }).catch(() => {});
}
let io;
function queueVisible() {
  if (comfortable) return;
  const top = reader.scrollTop, h = reader.clientHeight;
  const first = pageAt(top - h), last = pageAt(top + 2 * h) + (mode() === 'double' ? 1 : 0);
  for (const s of slots) {
    if (s.n >= first && s.n <= last) render(s);
    else if ((s.done || s.task) && (s.n < first - 6 || s.n > last + 6)) release(s);
  }
}

// ------------------------------------------------------------------ position, chapitre, adresse
const chapterFor = n => [...chapters].reverse().find(c => c.readingPage <= n) || null;
let urlTimer;
function setCurrent(n) {
  current = n;
  const pg = $('#pg'); if (document.activeElement !== pg) pg.value = n;
  $('#prog').style.width = (n / N * 100).toFixed(2) + '%';
  const c = chapterFor(n);
  $('#rchap').textContent = c ? `${L.chapter} ${c.number} · ${c.title}` : book.title;
  for (const a of document.querySelectorAll('.chapters a')) a.toggleAttribute('aria-current', !!c && +a.dataset.n === c.number);
  clearTimeout(urlTimer); urlTimer = setTimeout(() => {
    const u = new URL(location.href); u.search = ''; u.searchParams.set('livre', key); u.searchParams.set('page', n); u.searchParams.set('lecture', comfortable ? 'texte' : 'original'); history.replaceState(null, '', u);
    document.title = `${c ? c.title + ' · ' : ''}${book.title} | Cardioimmunology Review`;
    store.set('cir-liseuse:' + key, { page: n, at: Date.now() });
  }, 350);
}
let ticking = false;
reader.addEventListener('scroll', () => { if (comfortable) return; if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; setCurrent(pageAt(reader.scrollTop + reader.clientHeight * 0.3)); queueVisible(); }); }, { passive: true });
addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(() => { gen++; layout(current); }, 150); });

// ------------------------------------------------------------------ modes de lecture
function readingMode(on, page = current) {
  comfortable = !!on; prefs.reading = comfortable ? 'text' : 'original'; savePrefs();
  reader.hidden = comfortable; reader.setAttribute('aria-hidden',String(comfortable)); comfortHost.hidden = !comfortable;
  $('#b-reading').setAttribute('aria-pressed', String(comfortable));
  $('#read-text').setAttribute('aria-pressed',String(comfortable)); $('#read-original').setAttribute('aria-pressed',String(!comfortable));
  document.documentElement.classList.toggle('comfort-on',comfortable);
  for(const b of document.querySelectorAll('[data-mode]'))b.disabled=comfortable||(isMobile()&&b.dataset.mode==='double');
  if (comfortable) { gen++; for (const slot of slots) release(slot); textReader.go(page); }
  else { textReader.stop(); gen++; layout(page); }
}
$('#b-reading').onclick = () => readingMode(!comfortable);
$('#read-text').onclick = () => { readingMode(true); toggle('viewmenu', false); };
$('#read-original').onclick = () => { readingMode(false); toggle('viewmenu', false); };

// ------------------------------------------------------------------ commandes
function step(d) { const s = mode() === 'double' ? 2 : 1; let n = current + d * s; if (mode() === 'double' && n > 1) n -= n % 2; goTo(n); }
$('#b-prev').onclick = () => step(-1); $('#b-next').onclick = () => step(1);
$('#pg').addEventListener('change', e => goTo(parseInt(e.target.value, 10) || current));
$('#pg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goTo(parseInt(e.target.value, 10) || current); reader.focus(); } });
let opener = null;
function toggle(id, force) {
  const el = document.getElementById(id); const on = force ?? el.hidden;
  if (on && el.hidden) opener = document.activeElement;
  if (!on && !el.hidden) setTimeout(() => (opener && document.contains(opener) ? opener : reader).focus({ preventScroll: true }), 0);
  for (const d of ['toc', 'search', 'viewmenu']) if (d !== id && on) { document.getElementById(d).hidden = true; document.querySelector(`[aria-controls="${d}"]`)?.setAttribute('aria-expanded', 'false'); }
  el.hidden = !on; document.querySelector(`[aria-controls="${id}"]`)?.setAttribute('aria-expanded', String(on));
  document.documentElement.classList.toggle('drawer-open', !$('#toc').hidden || !$('#search').hidden);
  if (matchMedia('(min-width:1300px)').matches) { gen++; layout(current); }
  if (on && id === 'search') setTimeout(() => $('#q').focus(), 30);
  if (on && id === 'toc') { $('.chapters [aria-current]')?.scrollIntoView({ block: 'center' }); setTimeout(() => ($('.chapters [aria-current]') || $('#toc [data-close="toc"]'))?.focus(), 30); }
}
$('#b-toc').onclick = () => toggle('toc'); $('#b-search').onclick = () => toggle('search'); $('#b-view').onclick = () => toggle('viewmenu');
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]'); if (c) { if (c.dataset.close === 'keys') $('#keys').hidden = true; else toggle(c.dataset.close, false); }
  const a = e.target.closest('.chapters a, .hits a'); if (a) { e.preventDefault(); goTo(+a.dataset.page); if (isMobile()) toggle(a.closest('aside').id, false); }
  if (!e.target.closest('#viewmenu, #b-view') && !$('#viewmenu').hidden) toggle('viewmenu', false);
});
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { prefs.mode = b.dataset.mode; savePrefs(); gen++; layout(current); };
for (const b of document.querySelectorAll('button[data-theme]')) b.onclick = () => setTheme(b.dataset.theme);
function setTheme(t) { prefs.theme = t; savePrefs(); document.documentElement.dataset.theme = t; for (const b of document.querySelectorAll('button[data-theme]')) b.setAttribute('aria-pressed', String(b.dataset.theme === t)); }
setTheme(prefs.theme);
const zoom = z => { if (comfortable) { prefs.textSize = Math.max(17,Math.min(26,prefs.textSize+(z>prefs.zoom?1:-1))); savePrefs(); textReader.font(); toast(prefs.textSize+' px',1000); return; } prefs.zoom = Math.round(Math.min(3, Math.max(.5, z)) * 100) / 100; savePrefs(); gen++; layout(current); toast(Math.round(prefs.zoom * 100) + ' %', 1000); };
$('#z-in').onclick = () => zoom(prefs.zoom * 1.15); $('#z-out').onclick = () => zoom(prefs.zoom / 1.15); $('#z-fit').onclick = () => { if (comfortable) { prefs.textSize=20; savePrefs(); textReader.font(); } else zoom(1); };
$('#b-full').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {} };
document.addEventListener('fullscreenchange', () => { $('#b-full').title = document.fullscreenElement ? L.exitFull : L.full; });
$('#b-share').onclick = async () => { const u = new URL(location.href); try { await navigator.clipboard.writeText(u.href); toast(L.copied); } catch { toast(u.href, 5000); } toggle('viewmenu', false); };
$('#b-keys').onclick = () => { toggle('viewmenu', false); $('#keys').hidden = false; $('#keys button').focus(); };
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) { if (e.key === 'Escape') { if (e.target.id === 'q') toggle('search', false); else e.target.blur(); } return; }
  const k = e.key;
  if (k === 'ArrowRight') { e.preventDefault(); step(1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (k === '+' || k === '=') zoom(prefs.zoom * 1.15);
  else if (k === '-' || k === '−') zoom(prefs.zoom / 1.15);
  else if (k === 't' || k === 'T') toggle('toc');
  else if (k === '/') { e.preventDefault(); toggle('search', true); }
  else if (k === 'f' || k === 'F') $('#b-full').click();
  else if (k === 'n' || k === 'N') setTheme(prefs.theme === 'nuit' ? 'jour' : 'nuit');
  else if (k === '?') $('#keys').hidden = false;
  else if (k === 'Home') goTo(1); else if (k === 'End') goTo(N);
  else if (k === 'Escape') { toggle('toc', false); toggle('search', false); toggle('viewmenu', false); $('#keys').hidden = true; }
});
// balayage horizontal sur écran tactile
let sx = null, sy = null;
reader.addEventListener('touchstart', e => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
reader.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && prefs.zoom <= 1) step(dx < 0 ? 1 : -1); }, { passive: true });

// ------------------------------------------------------------------ recherche plein texte
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").toLowerCase();
const texts = new Map(); let query = '', searchGen = 0;
async function pageText(n) { if (texts.has(n)) return texts.get(n); const p = await pdf.getPage(n); const tc = await p.getTextContent(); const t = tc.items.map(i => i.str + (i.hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' '); texts.set(n, t); return t; }
$('#sform').addEventListener('submit', async e => {
  e.preventDefault(); const q = $('#q').value.trim(); if (q.length < 2) return;
  query = norm(q); const g = ++searchGen; const hits = $('#hits'); hits.replaceChildren(); let count = 0;
  for (const s of slots) if (s.done) mark(s);
  for (let n = 1; n <= N && g === searchGen; n++) {
    let t; try { t = await pageText(n); } catch { continue; }
    const nt = norm(t); let i = nt.indexOf(query), local = 0;
    while (i >= 0 && local < 3 && count < 400) {
      const a = Math.max(0, i - 60), b = Math.min(t.length, i + query.length + 80);
      const li = document.createElement('li');
      const snip = (a > 0 ? '…' : '') + esc(t.slice(a, i)) + '<mark>' + esc(t.slice(i, i + query.length)) + '</mark>' + esc(t.slice(i + query.length, b)) + (b < t.length ? '…' : '');
      const c = chapterFor(n);
      li.innerHTML = `<a href="?livre=${key}&page=${n}" data-page="${n}"><span class="hp">${L.page} ${n}${c ? ' · ' + L.chapter + ' ' + c.number : ''}</span><span class="hs">${snip}</span></a>`;
      hits.append(li); count++; local++; i = nt.indexOf(query, i + query.length);
    }
    if (n % 10 === 0 || n === N) $('#sstatus').textContent = `${L.searching} · ${n} / ${N} ${L.pages} · ${count} ${L.results}`;
  }
  if (g === searchGen) $('#sstatus').textContent = count ? `${count} ${L.results}` : L.none;
});
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function mark(s) {
  const spans = s.el.querySelectorAll('.textLayer span');
  for (const sp of spans) sp.classList.toggle('hit', !!query && norm(sp.textContent).includes(query));
}

// ------------------------------------------------------------------ démarrage
try {
  pdf = await open(); opened = true;
  const p1 = await pdf.getPage(Math.min(3, pdf.numPages)); const v = p1.getViewport({ scale: 1 }); baseW = v.width; baseH = v.height;
  sheets.replaceChildren(...Array.from({ length: N }, (_, i) => { const el = document.createElement('div'); el.className = 'sheet'; el.dataset.n = i + 1; el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${L.page} ${i + 1}`); if (i === 0) el.classList.add('first'); return el; }));
  slots = [...sheets.children].map((el, i) => ({ el, n: i + 1, done: false, task: null }));
  $('#toast').hidden = true;
  const saved = store.get('cir-liseuse:' + key);
  let start = parseInt(params.get('page'), 10);
  const ch = parseInt(params.get('chapitre'), 10);
  if (!start && ch) start = (chapters.find(c => c.number === ch) || {}).readingPage;
  textReader = mountComfort({ pdf, OPS, host:comfortHost, language:book.lang, bookTitle:book.title, total:N,
    chapterEnd:n=>(chapters.find(c=>c.readingPage>n)?.readingPage || N+1)-1,
    onPage:setCurrent, onOriginal:n=>{ readingMode(false,n); }, getFont:()=>prefs.textSize, breaks:BREAKS[key] || {} });
  for(const id of ['b-reading','read-text','read-original']) document.getElementById(id).disabled=false;
  $('#read-text').setAttribute('aria-pressed','false'); $('#read-original').setAttribute('aria-pressed','true');
  // 27/10/2026 (audit) : un seul mode initialisé au démarrage
  const requested = params.get('lecture');
  const comfortAtStart = requested === 'texte' || (requested !== 'original' && (prefs.reading === 'text' || (!prefs.reading && isMobile())));
  if (comfortAtStart) readingMode(true, start || 1); else layout(start || 1);
  if (!start && saved?.page > 1) toast(`<button type="button">${L.resume} ${saved.page}</button>`, 9000, () => goTo(saved.page));
  (comfortable?comfortHost:reader).focus({ preventScroll: true });
} catch (e) {
  console.error(e);
  toast(`${L.error} <a href="${href(book.pdf)}">${L.download}</a>`, 0);
}
}
