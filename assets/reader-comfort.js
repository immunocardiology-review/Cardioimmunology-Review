// Accessible reading from the original PDF text, with original-page fallback.
// Keep source order and every extracted character. Never infer a table's cells.
export function planTextPage(items, height, graphics = false, breaks = {}) {
  const lines = []; let line = null;
  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const x = item.transform[4], y = height - item.transform[5];
    const size = Math.abs(item.height || item.transform[3]) || 10;
    const inlineNote = line && size < line.size * .86 && Math.abs(y-line.y) < line.size * .8 && x >= line.end - 2 && x-line.end < line.size;
    if (!line || (!inlineNote && Math.abs(y - line.y) > Math.max(2, line.size * .6)) || x < line.end - 2) {
      line = { text: '', x, end: x, y, size, gaps: 0, fonts: [], runs: [] }; lines.push(line);
    }
    const gap = x - line.end;
    if (line.text && gap > size * 2.5) line.gaps++;
    const space = line.text && !/\s$/.test(line.text) && !/^\s/.test(item.str) && gap > size * .12 ? ' ' : '';
    line.text += space + item.str; line.runs.push({text:space+item.str,script:inlineNote?(y<line.y?'sup':'sub'):null});
    line.end = x + item.width; line.size = Math.max(line.size, size); line.fonts.push(item.fontName || '');
  }
  // Aligned cells, image/vector figures, formulae and multi-column layouts stay original.
  const body = lines.filter(l => l.y > 40 && l.y < height - 35);
  const denseRows = body.filter(l => l.gaps > 0).length;
  const resets = body.filter((l, i) => i && l.y < body[i - 1].y - 30).length;
  const math = body.some(l => /[∫∑√∂∏]/.test(l.text));
  const caption = body.some(l=>/^(?:Tableau|Table|Figure|Fig\.|Algorithme|Algorithm)\s+\d/i.test(l.text));
  const complex = graphics || caption || denseRows > 2 || resets > 3 || math || !body.length;
  const sizes = body.flatMap(l => Array(Math.min(150, l.text.length)).fill(l.size)).sort((a,b) => a-b);
  const normal = sizes[Math.floor(sizes.length / 2)] || 11;
  const blocks = [];
  for (const l of lines) {
    const marginal = l.y < 40 || l.y > height - 35;
    const heading = !marginal && l.size > normal * 1.13;
    const prev = blocks.at(-1);
    const newPara = !prev || heading || marginal || prev.heading || prev.marginal ||
      l.y < prev.lastY - 3 || l.y - prev.lastY > normal * 1.8 || Math.abs(l.size - prev.size) > 1 ||
      (l.x > prev.x + normal && l.x < prev.x + normal * 3);
    if (newPara) blocks.push({ text:l.text, heading, marginal, size:l.size, x:l.x, lastY:l.y, runs:l.runs.map(r=>({...r})) });
    else { const split=prev.text.match(/([\p{L}]+)[-‐‑]$/u), next=l.text.match(/^([\p{L}]+)/u);
      if(split&&next&&breaks[(split[1]+'-'+next[1]).toLowerCase()]){prev.text=prev.text.slice(0,-1);const tail=prev.runs.findLast(r=>r.text);if(tail)tail.text=tail.text.slice(0,-1);}
      const join=split?'':' '; prev.text+=join+l.text; prev.runs.push({text:join},...l.runs.map(r=>({...r}))); prev.lastY=l.y;prev.x=Math.min(prev.x,l.x); }
  }
  return { complex, blocks, lines };
}

export function mountComfort({ pdf, OPS, host, language, bookTitle, total, chapterEnd, onPage, onOriginal, getFont, breaks = {} }) {
  const en = language === 'en'; let generation = 0, loading = false, last = 0, end = total, observer, rasterObserver;
  const rasters = new Map();
  const clearRasters=()=>{rasterObserver?.disconnect();for(const [canvas,r] of rasters){r.task?.cancel();canvas.width=canvas.height=1;}rasters.clear();};
  const cache = new Map();
  const words = en ? { page:'PDF page', original:'View original page', more:'Continue reading', busy:'Opening the next pages…', end:'End of chapter', next:'Next chapter', previous:'Previous page', complex:'Original layout · table, figure or complex page', failed:'This page could not be read.', retry:'Try again', paper:'Open the original PDF page' } :
    { page:'Page PDF', original:'Voir la page originale', more:'Poursuivre la lecture', busy:'Ouverture des pages suivantes…', end:'Fin du chapitre', next:'Chapitre suivant', previous:'Page précédente', complex:'Mise en page originale · tableau, figure ou page complexe', failed:'Cette page n’a pas pu être lue.', retry:'Réessayer', paper:'Ouvrir la page PDF originale' };
  const imageOps = new Set(['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','shadingFill'].map(k => OPS[k]).filter(Number.isInteger));
  async function describe(page) {
    if (cache.has(page.pageNumber)) return cache.get(page.pageNumber);
    const [tc, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    const vectors = ops.fnArray.filter(x => x === OPS.constructPath).length;
    const plan = planTextPage(tc.items, page.getViewport({scale:1}).height, ops.fnArray.some(x => imageOps.has(x)) || vectors > 14, breaks);
    cache.set(page.pageNumber, plan); return plan;
  }
  const addRuns=(element,block)=>{for(const run of block.runs){if(run.script){const note=document.createElement(run.script);note.textContent=run.text;element.append(note);}else element.append(document.createTextNode(run.text));}};
  const button = (label, action, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = action; return b; };
  async function append(n, token) {
    const page = await pdf.getPage(n), plan = await describe(page);
    if (token !== generation) return;
    const article = document.createElement('article'); article.className = 'comfort-page'; article.dataset.page = n; article.setAttribute('aria-label', `${words.page} ${n}`);
    const bar = document.createElement('div'); bar.className = 'comfort-page-head';
    const label = document.createElement('span'); label.textContent = `${words.page} ${n}`;
    bar.append(label,button(words.original, () => onOriginal(n))); article.append(bar);
    if (plan.complex) {
      const note = document.createElement('p'); note.className = 'comfort-note'; note.textContent = words.complex; article.append(note);
      const view = page.getViewport({ scale:1 });
      const scale = Math.min(2, (host.clientWidth - 32) / view.width * Math.min(devicePixelRatio || 1, 2));
      const vp = page.getViewport({scale:Math.max(.4,scale)}), canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height); canvas.className = 'comfort-original';
      canvas.style.aspectRatio=view.width+'/'+view.height;
      canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', `${words.page} ${n} · ${bookTitle}`);
      article.append(canvas,button(words.paper,()=>onOriginal(n),'comfort-paper-link'));
      rasters.set(canvas,{page,vp,token,drawn:false,task:null});
      const description = document.createElement('details'); description.className = 'comfort-transcript';
      const summary = document.createElement('summary'); summary.textContent = en ? 'Text transcription' : 'Transcription du texte'; description.append(summary);
      for (const block of plan.blocks) { const p = document.createElement('p'); addRuns(p,block); description.append(p); } article.append(description);
    } else {
      for (const block of plan.blocks) {
        const p = document.createElement(block.heading ? 'h2' : 'p'); addRuns(p,block);
        if (block.marginal) p.className = 'comfort-running'; article.append(p);
      }
    }
    if (token !== generation) return;
    host.querySelector('.comfort-pages').append(article); observer.observe(article); const canvas=article.querySelector('canvas');if(canvas)rasterObserver.observe(canvas);last=n;
  }
  function footer() {
    const f = host.querySelector('.comfort-next'); f.replaceChildren();
    if (last < end) f.append(button(words.more, () => load(3)));
    else if (end < total) { const p = document.createElement('p'); p.textContent = words.end; f.append(p,button(words.next,()=>go(end + 1))); }
  }
  async function load(count) {
    if (loading || last >= end) return;
    loading = true; const token = generation, f = host.querySelector('.comfort-next'); f.textContent = words.busy;
    try { for (let i = 0; i < count && last < end && token === generation; i++) await append(last+1,token); }
    catch { if (token === generation) { f.replaceChildren(button(words.retry,()=>load(count)),button(words.original,()=>onOriginal(last+1))); loading=false; return; } }
    if (token === generation) { loading=false; footer(); }
  }
  async function go(n) {
    const token = ++generation; loading = false; observer?.disconnect(); clearRasters();
    host.replaceChildren(); host.style.setProperty('--reading-size', getFont()+'px');
    const title = document.createElement('h1'); title.className = 'comfort-title'; title.textContent = bookTitle;
    const pages = document.createElement('div'); pages.className = 'comfort-pages';
    const more = document.createElement('div'); more.className = 'comfort-next'; more.setAttribute('aria-live','polite');
    host.append(title,pages,more); host.scrollTop = 0; last = n - 1; end = chapterEnd(n);
    observer = new IntersectionObserver(entries=>{ const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top); if(visible[0] && token===generation) onPage(+visible[0].target.dataset.page); },{root:host,rootMargin:'-8% 0px -55% 0px',threshold:0});
    rasterObserver=new IntersectionObserver(entries=>{for(const e of entries){const canvas=e.target,r=rasters.get(canvas);if(!r||r.token!==generation)continue;if(e.isIntersecting&&!r.drawn&&!r.task){canvas.width=Math.round(r.vp.width);canvas.height=Math.round(r.vp.height);const task=r.page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:r.vp});r.task=task;task.promise.then(()=>{if(r.task===task){r.task=null;r.drawn=true;}}).catch(()=>{if(r.task===task)r.task=null;});}else if(!e.isIntersecting){r.task?.cancel();r.task=null;r.drawn=false;canvas.width=canvas.height=1;}}},{root:host,rootMargin:'1000px 0px'});
    onPage(n); await load(3);
  }
  return { go, stop(){generation++;loading=false;observer?.disconnect();clearRasters();}, font(){host.style.setProperty('--reading-size',getFont()+'px');} };
}
