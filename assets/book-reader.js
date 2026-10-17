import './book-download.js';
import { getDocument, GlobalWorkerOptions, TextLayer, PDFDataRangeTransport } from './book-pdf.mjs';
GlobalWorkerOptions.workerSrc = new URL('./book-pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
const status = $('reader-status');
const startedAt=performance.now();let transferred=0;
function received(bytes){transferred+=bytes;status.dataset.transferredBytes=transferred;}
let pdf, book, bookKey, chapter, pageNumber, zoom=1, rendering, textLayer, generation=0;
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(max-width:800px)');
const title = $('chapter-title');
mobile.addEventListener('change',()=>{$('chapter-links').closest('details').open=!mobile.matches;});
function message(text){if(pdf&&/^Ouverture du (?:livre|chapitre)/.test(text))return;status.textContent=text;}
// Zenodo accepts byte ranges, but its CORS policy does not expose the range
// headers used by PDF.js auto-detection. Supply the transport explicitly so
// a chapter opens without first transferring the complete Treatise.
class ArchiveRanges extends PDFDataRangeTransport {
 constructor(url,length,initial){super(length,initial,true);this.url=url;this.controllers=new Set();}
 async requestDataRange(begin,end){
  const controller=new AbortController();this.controllers.add(controller);
  try{
   const response=await fetch(this.url,{headers:{Range:`bytes=${begin}-${end-1}`},credentials:'omit',signal:controller.signal});
   if(response.status!==206){await response.body?.cancel();throw Error('Archive range unavailable');}
   const bytes=new Uint8Array(await response.arrayBuffer());received(bytes.length);
   if(bytes.byteLength!==end-begin)throw Error('Incomplete archive range');
   if(!controller.signal.aborted)this.onDataRange(begin,bytes);
  }catch(error){if(!controller.signal.aborted)this.onError?.(error);}
  finally{this.controllers.delete(controller);}
 }
 abort(){for(const controller of this.controllers)controller.abort();this.controllers.clear();}
}
async function openBookPdf(){
 const url=new URL(book.pdf,location.href).href;
 const chunk=262144;let range;
 if(book.bytes>1024*1024&&url.startsWith('https://zenodo.org/api/')){
  try{
   message('Ouverture du chapitre…');
   const response=await fetch(url,{headers:{Range:`bytes=0-${chunk-1}`},credentials:'omit'});
   if(response.status===206){
    const initial=new Uint8Array(await response.arrayBuffer());received(initial.length);
    if(initial.length===chunk)range=new ArchiveRanges(url,book.bytes,initial);
   }else await response.body?.cancel();
  }catch{ /* The ordinary original-PDF reader remains the fallback. */ }
 }
 const options={url,isEvalSupported:false,withCredentials:false};
 if(range)Object.assign(options,{range,rangeChunkSize:chunk,disableStream:true,disableAutoFetch:true});
 const task=getDocument(options);
 task.onProgress=({loaded,total})=>message(range?'Ouverture du chapitre…':total?`Ouverture du livre · ${Math.min(100,Math.round(loaded/total*100))} %`:'Ouverture du livre…');
 if(!range)return task.promise;
 const failed=new Promise((_,reject)=>{range.onError=error=>{range.abort();task.destroy().catch(()=>{});reject(error);};});
 try{return await Promise.race([task.promise,failed]);}
 catch{
  range.abort();task.destroy().catch(()=>{});
  const fallback=getDocument({url,isEvalSupported:false,withCredentials:false});
  fallback.onProgress=({loaded,total})=>message(total?`Ouverture du livre · ${Math.min(100,Math.round(loaded/total*100))} %`:'Ouverture du livre…');
  return fallback.promise;
 }
}
function chapterFor(page){ return [...book.chapters].reverse().find(c=>c.page<=page) || book.chapters[0]; }
function updateLocation(){
 const u=new URL(location.href); u.search='';u.searchParams.set('livre',bookKey);u.searchParams.set('chapitre',chapter.number);u.searchParams.set('page',pageNumber);u.searchParams.set('v','20261017-original');
 history.replaceState(null,'',u);document.title=`${chapter.title} | ${book.title} — Brahim Abdelouaeb`;
}
function chapterLink(c){return `lecture.html?livre=${encodeURIComponent(bookKey)}&chapitre=${c.number}&v=20261017-original`;}
function updateChapter(){
 chapter=chapterFor(pageNumber); title.textContent=chapter.title;
 $('chapter-label').textContent=(bookKey==='method-en'?'Chapter ':'Chapitre ')+String(chapter.number).padStart(2,'0');
 for(const a of $('chapter-links').querySelectorAll('a')){
  if(Number(a.dataset.chapter)===chapter.number)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
 }
 const i=book.chapters.findIndex(c=>c.number===chapter.number);
 for(const [id,c] of [['previous-chapter',book.chapters[i-1]],['next-chapter',book.chapters[i+1]]]){
  $(id).hidden=!c;if(c){$(id).href=chapterLink(c);$(id).title=c.title;}
 }
 $('previous').disabled=pageNumber<=1;$('next').disabled=pageNumber>=pdf.numPages;
 $('page-number').value=pageNumber;
 updateLocation();
}
async function showPage(n,{resetScroll=true}={}){
 if(!pdf)return;
 const moved=pageNumber!==undefined&&Number(n)!==pageNumber;
 const request=++generation;
 pageNumber=Math.max(1,Math.min(pdf.numPages,Math.round(n)||1));
 const previousRender=rendering;previousRender?.cancel();textLayer?.cancel();
 $('page-scroll').setAttribute('aria-busy','true');message('Ouverture de la page…');
 updateChapter();
 try{
  if(previousRender)await previousRender.promise.catch(()=>{});
  if(request!==generation)return;
  const page=await pdf.getPage(pageNumber);if(request!==generation)return;
  const box=$('page-scroll');const raw=page.getViewport({scale:1});
  const width=Math.max(200,box.clientWidth);
  const scale=width/raw.width*zoom;const viewport=page.getViewport({scale});
  const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(7500000/(viewport.width*viewport.height)));
  const canvas=$('pdf-canvas');canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
  canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  const holder=$('pdf-page');holder.style.width=viewport.width+'px';holder.style.height=viewport.height+'px';holder.style.setProperty('--scale-factor',scale);
  $('text-layer').replaceChildren();
  rendering=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
  await rendering.promise;if(request!==generation)return;
  $('page-scroll').setAttribute('aria-busy','false');
  message(`Page ${pageNumber} / ${pdf.numPages} · ${bookKey==='method-en'?'Original edition':'Édition originale'}`);
  if(!status.dataset.firstPageMs)status.dataset.firstPageMs=Math.round(performance.now()-startedAt);
  // Render the original page first. The selectable text layer never rearranges it.
  page.getTextContent().then(async text=>{
   if(request!==generation)return;
   textLayer=new TextLayer({textContentSource:text,container:$('text-layer'),viewport});
   await textLayer.render();
  }).catch(error=>console.warn('Selectable text unavailable:',error));
  if(resetScroll){box.scrollTop=0;box.scrollLeft=0;if(moved)box.scrollIntoView({block:'start',behavior:'instant'});}
 }catch(error){
  if(error?.name==='RenderingCancelledException'||request!==generation)return;
  console.error('Book reader:',error);$('page-scroll').setAttribute('aria-busy','false');message('Page indisponible. Réessayez ou téléchargez le PDF original.');
 }
}
function changeChapter(c){
 if(!c)return;chapter=c;title.textContent=c.title;if(!pdf)return;zoom=1;showPage(c.page);if(mobile.matches)$('chapter-links').closest('details').open=false;
 $('reading').focus({preventScroll:true});$('reading').scrollIntoView({block:'start',behavior:'instant'});
}
async function init(){
 const response=await fetch(new URL('./book-reader-data.json?v=20261017-original',import.meta.url));if(!response.ok)throw Error('Book catalogue');
 const books=await response.json();
 bookKey=params.get('livre')||'methode';book=books[bookKey];
 if(!book)throw Error('Unknown book');
 document.documentElement.lang=bookKey==='method-en'?'en':'fr';
 if(bookKey==='method-en'){
  for(const [id,text] of [['return-book','Back to the book'],['toc-label','Contents'],['download','Download the PDF'],['fit-width','Fit page'],['previous-chapter','← Previous chapter'],['next-chapter','Next chapter →']])$(id).textContent=text;
  for(const [id,text] of [['previous','Previous page'],['next','Next page'],['zoom-in','Zoom in'],['zoom-out','Zoom out'],['page-number','PDF page number']])$(id).setAttribute('aria-label',text);
  document.querySelector('label[for=page-number]').textContent='PDF page';
 }
 $('reader-book').textContent=book.title;$('reader-cover').src='assets/covers/'+book.cover;$('reader-cover').alt='Couverture de '+book.title;
 $('cover-link').href=book.path;$('return-book').href=book.path+'#sommaire';$('download').href=book.pdf;$('download').hidden=false;
 if(book.pdf.startsWith('https://zenodo.org/api/')){ $('download').dataset.pdfDownload=decodeURIComponent(book.pdf.split('/').at(-2));$('download').dataset.pdfBytes=book.bytes; }else $('download').download=book.pdf.split('/').at(-1);
 $('reader-doi').href='https://doi.org/'+book.doi;$('reader-doi').textContent='DOI '+book.doi;
 const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=new URL(book.path,'https://cardioimmunologyreview.org/').href;document.head.append(canonical);
 for(const c of book.chapters){
  const a=document.createElement('a');a.href=chapterLink(c);a.dataset.chapter=c.number;
  const number=document.createElement('span');number.textContent=String(c.number).padStart(2,'0');
  const label=document.createElement('span');label.textContent=c.title;a.append(number,label);
  a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();changeChapter(c);});$('chapter-links').append(a);
 }
 if(mobile.matches)$('chapter-links').closest('details').open=false;
 chapter=book.chapters.find(c=>c.number===Number(params.get('chapitre')))||book.chapters[0];title.textContent=chapter.title;
 $('chapter-label').textContent='Chapitre '+String(chapter.number).padStart(2,'0');
 pdf=await openBookPdf();
 for(const id of ['page-number','zoom-in','zoom-out','fit-width'])$(id).disabled=false;
 $('page-number').max=pdf.numPages;
 $('previous').addEventListener('click',()=>showPage(pageNumber-1));$('next').addEventListener('click',()=>showPage(pageNumber+1));
 $('page-number').addEventListener('change',()=>showPage(Number($('page-number').value)));
 $('page-number').addEventListener('keydown',e=>{if(e.key==='Enter'){$('page-number').blur();showPage(Number($('page-number').value));}});
 $('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);showPage(pageNumber,{resetScroll:false});});
 $('zoom-out').addEventListener('click',()=>{zoom=Math.max(.75,zoom-.25);showPage(pageNumber,{resetScroll:false});});
 $('fit-width').addEventListener('click',()=>{zoom=1;showPage(pageNumber);});
 for(const id of ['previous-chapter','next-chapter'])$(id).addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const n=Number(new URL($(id).href).searchParams.get('chapitre'));changeChapter(book.chapters.find(c=>c.number===n));});
 document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();showPage(pageNumber+1);}if(e.key==='ArrowLeft'){e.preventDefault();showPage(pageNumber-1);}});
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>showPage(pageNumber,{resetScroll:false}),200);});
 await showPage(Number(params.get('page'))||chapter.page);
}
init().catch(error=>{console.error('Book reader:',error);message('La liseuse ne peut pas ouvrir le livre pour le moment. Retrouvez le PDF original depuis la présentation du livre.');});
