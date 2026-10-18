import './book-download.js';
import { getDocument, GlobalWorkerOptions, TextLayer, PDFDataRangeTransport } from './book-pdf.mjs';
GlobalWorkerOptions.workerSrc = new URL('./book-pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
// Keep an already cached reader shell usable while the new shell deploys.
if(!$('pdf-spread')){
 const spread=document.createElement('div');spread.id='pdf-spread';spread.className='pdf-spread';$('pdf-page').replaceWith(spread);
 const controls=document.createElement('div');controls.className='view-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Affichage des pages');
 controls.innerHTML='<button id="single-page" type="button" aria-pressed="true" disabled>Une page</button><button id="double-page" type="button" aria-pressed="false" disabled>Double page</button><button id="open-contents" type="button" aria-controls="chapter-links">Sommaire</button>';
 document.querySelector('.zoom-controls').before(controls);
 const shortcuts=document.createElement('div');shortcuts.className='reading-shortcuts';shortcuts.innerHTML='<button id="resume-reading" type="button" hidden></button>';$('reader-status').before(shortcuts);
}
// Progressive controls also support a reader shell still cached by the browser.
const aside=document.querySelector('.reader-aside');aside.id='reader-contents';
if(!$('fullscreen-reading')){const button=document.createElement('button');button.id='fullscreen-reading';button.type='button';button.textContent='Plein écran';button.setAttribute('aria-pressed','false');document.querySelector('.view-controls').append(button);}
if(!$('toggle-sidebar')){const button=document.createElement('button');button.id='toggle-sidebar';button.type='button';button.textContent='Masquer le sommaire';button.setAttribute('aria-controls','reader-contents');button.setAttribute('aria-expanded','true');document.querySelector('.zoom-controls').before(button);}
if(!$('close-contents')){const button=document.createElement('button');button.id='close-contents';button.type='button';button.textContent='Fermer le sommaire';aside.prepend(button);}
const status = $('reader-status');
const startedAt=performance.now();let transferred=0;
function received(bytes){transferred+=bytes;status.dataset.transferredBytes=transferred;}
let pdf, book, bookKey, chapter, pageNumber, zoom=1, renderings=[], textLayers=[], generation=0, viewMode='single', savedPosition, resumePage;
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(max-width:800px)');
let focusedReading=false;
function syncScreenControls(){
 const collapsed=document.documentElement.classList.contains('contents-hidden');
 $('toggle-sidebar').setAttribute('aria-expanded',String(!collapsed));
 $('toggle-sidebar').textContent=english()?(collapsed?'Show contents':'Hide contents'):(collapsed?'Afficher le sommaire':'Masquer le sommaire');
 $('fullscreen-reading').setAttribute('aria-pressed',String(focusedReading));
 $('fullscreen-reading').textContent=english()?(focusedReading?'Exit full screen':'Full screen'):(focusedReading?'Quitter le plein écran':'Plein écran');
 $('open-contents').setAttribute('aria-expanded',String(focusedReading?document.documentElement.classList.contains('contents-visible'):!collapsed&&$('chapter-links').closest('details').open));
}
function screenLayout(){
 syncScreenControls();requestAnimationFrame(()=>showPage(pageNumber,{resetScroll:false}));
}
function setReadingFocus(value){
 focusedReading=value;document.documentElement.classList.toggle('reader-focus',value);document.documentElement.classList.remove('contents-visible');
 if(value)$('reading').scrollTop=0;
 screenLayout();
}
async function toggleFullScreen(){
 if(focusedReading){
  if(document.fullscreenElement){try{await document.exitFullscreen();}catch{setReadingFocus(false);}}
  else setReadingFocus(false);
  return;
 }
 // The same distraction-free layout works on phones without the Fullscreen API.
 setReadingFocus(true);
 if(document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen();}catch{/* Keep the full-window reading layout. */}}
}
document.addEventListener('fullscreenchange',()=>setReadingFocus(!!document.fullscreenElement));

const title = $('chapter-title');
const english=()=>bookKey==='method-en';
const storageKey=()=>`cardioimmunology-reading:${bookKey}`;
function readPosition(){try{const value=JSON.parse(localStorage.getItem(storageKey()));return value?.pdf===book.pdf&&Number.isInteger(value.page)&&value.page>0?value:null;}catch{return null;}}
function rememberPosition(){try{localStorage.setItem(storageKey(),JSON.stringify({pdf:book.pdf,page:pageNumber,mode:viewMode}));}catch{/* Reading still works when browser storage is unavailable. */}}
function pageStep(){return viewMode==='double'?2:1;}
function updateView(){
 $('single-page').setAttribute('aria-pressed',String(viewMode==='single'));
 $('double-page').setAttribute('aria-pressed',String(viewMode==='double'));
 $('pdf-spread').classList.toggle('double-page',viewMode==='double');
 $('previous').setAttribute('aria-label',english()?(viewMode==='double'?'Previous two pages':'Previous page'):(viewMode==='double'?'Deux pages précédentes':'Page précédente'));
 $('next').setAttribute('aria-label',english()?(viewMode==='double'?'Next two pages':'Next page'):(viewMode==='double'?'Deux pages suivantes':'Page suivante'));
}
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
 $('previous').disabled=pageNumber<=1;$('next').disabled=pageNumber+pageStep()>pdf.numPages;
 $('page-number').value=pageNumber;
 updateLocation();
}
async function showPage(n,{resetScroll=true}={}){
 if(!pdf)return;
 const moved=pageNumber!==undefined&&Number(n)!==pageNumber;
 const request=++generation;
 pageNumber=Math.max(1,Math.min(pdf.numPages,Math.round(n)||1));
 const pending=renderings;for(const task of pending)task.cancel();for(const layer of textLayers)layer.cancel();
 renderings=[];textLayers=[];
 $('page-scroll').setAttribute('aria-busy','true');message(english()?'Opening the page…':'Ouverture de la page…');
 updateView();updateChapter();
 try{
  await Promise.all(pending.map(task=>task.promise.catch(()=>{})));
  if(request!==generation)return;
  const end=Math.min(pdf.numPages,pageNumber+pageStep()-1);
  const pages=await Promise.all(Array.from({length:end-pageNumber+1},(_,i)=>pdf.getPage(pageNumber+i)));
  if(request!==generation)return;
  const box=$('page-scroll'),spread=$('pdf-spread');
  const gap=pages.length>1?12:0;
  const width=Math.max(100,box.clientWidth-gap);
  const raw=pages.map(page=>page.getViewport({scale:1}));
  const scale=width/raw.reduce((sum,v)=>sum+v.width,0)*zoom;
  spread.replaceChildren();
  const slots=pages.map((page,i)=>{
   const viewport=page.getViewport({scale});
   const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(7500000/(viewport.width*viewport.height*pages.length)));
   const holder=document.createElement('div');holder.className='page';holder.setAttribute('role','group');holder.setAttribute('aria-label',(english()?'PDF page ':'Page PDF ')+(pageNumber+i));
   holder.style.width=viewport.width+'px';holder.style.height=viewport.height+'px';holder.style.setProperty('--scale-factor',scale);
   const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
   const text=document.createElement('div');text.className='textLayer';holder.append(canvas,text);spread.append(holder);
   const task=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});renderings.push(task);
   return {page,viewport,text,task};
  });
  await Promise.all(slots.map(slot=>slot.task.promise));if(request!==generation)return;
  $('page-scroll').setAttribute('aria-busy','false');
  message(`${end>pageNumber?(english()?'Pages ':'Pages '):(english()?'Page ':'Page ')}${pageNumber}${end>pageNumber?'–'+end:''} / ${pdf.numPages} · ${english()?'Original edition':'Édition originale'}`);
  rememberPosition();
  if(!status.dataset.firstPageMs)status.dataset.firstPageMs=Math.round(performance.now()-startedAt);
  // Each text layer overlays its own original PDF page without reflowing it.
  for(const slot of slots)slot.page.getTextContent().then(async text=>{
   if(request!==generation)return;
   const layer=new TextLayer({textContentSource:text,container:slot.text,viewport:slot.viewport});textLayers.push(layer);await layer.render();
  }).catch(error=>console.warn('Selectable text unavailable:',error));
  if(resetScroll){box.scrollTop=0;box.scrollLeft=0;if(moved)box.scrollIntoView({block:'start',behavior:'instant'});}
 }catch(error){
  if(error?.name==='RenderingCancelledException'||request!==generation)return;
  console.error('Book reader:',error);$('page-scroll').setAttribute('aria-busy','false');message(english()?'Page unavailable. Try again or download the original PDF.':'Page indisponible. Réessayez ou téléchargez le PDF original.');
 }
}
// Horizontal single-finger turns leave vertical scrolling, pinch zoom and
// panning an enlarged PDF to the browser. Avoid the OS back-gesture edges.
function installPageSwipes(){
 const area=$('page-scroll');let gesture=null;
 const canTurn=()=>pdf&&zoom<=1&&(window.visualViewport?.scale||1)<=1.02&&area.scrollWidth<=area.clientWidth+3&&area.getAttribute('aria-busy')!=='true'&&!window.getSelection()?.toString();
 area.addEventListener('touchstart',event=>{
  gesture=null;if(event.touches.length!==1||!canTurn())return;
  const touch=event.touches[0];if(touch.clientX<24||touch.clientX>innerWidth-24)return;
  gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,time:performance.now(),vertical:false};
 },{passive:true});
 area.addEventListener('touchmove',event=>{
  if(!gesture)return;if(event.touches.length!==1||!canTurn()){gesture=null;return;}
  const touch=event.touches[0],dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
  if(Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx))gesture.vertical=true;
  if(!gesture.vertical&&Math.abs(dx)>24&&Math.abs(dx)>Math.abs(dy)*1.7&&event.cancelable)event.preventDefault();
 },{passive:false});
 area.addEventListener('touchend',event=>{
  const start=gesture;gesture=null;if(!start||start.vertical||event.touches.length||!canTurn())return;
  const touch=[...event.changedTouches].find(t=>t.identifier===start.id);if(!touch)return;
  const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  const threshold=Math.max(60,Math.min(110,area.clientWidth*.18));
  if(performance.now()-start.time>1000||Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.7)return;
  if(dx<0){if(pageNumber+pageStep()<=pdf.numPages)showPage(pageNumber+pageStep());}
  else if(pageNumber>1)showPage(Math.max(1,pageNumber-pageStep()));
 },{passive:true});
 area.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
 // Mouse drags begin on page whitespace; original PDF text stays selectable.
 let mouseGesture=null;
 const endMouse=()=>{
  const start=mouseGesture;mouseGesture=null;area.classList.remove('is-page-dragging');
  if(start){try{if(area.hasPointerCapture(start.id))area.releasePointerCapture(start.id);}catch{}}
  return start;
 };
 area.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!canTurn())return;
  if(event.target.closest('a,button,input,select,textarea,.textLayer span'))return;
  mouseGesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),vertical:false};
  // Prevent text selection from whitespace, never from the PDF text itself.
  event.preventDefault();try{area.setPointerCapture(event.pointerId);}catch{}
 });
 area.addEventListener('pointermove',event=>{
  if(!mouseGesture||event.pointerId!==mouseGesture.id)return;
  if(!canTurn()||event.buttons!==1){endMouse();return;}
  const dx=event.clientX-mouseGesture.x,dy=event.clientY-mouseGesture.y;
  if(Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx))mouseGesture.vertical=true;
  if(!mouseGesture.vertical&&Math.abs(dx)>20&&Math.abs(dx)>Math.abs(dy)*1.7){area.classList.add('is-page-dragging');if(event.cancelable)event.preventDefault();}
 });
 area.addEventListener('pointerup',event=>{
  if(!mouseGesture||event.pointerId!==mouseGesture.id)return;
  const start=endMouse(),dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(!canTurn()||start.vertical||performance.now()-start.time>2000||Math.abs(dx)<Math.max(60,Math.min(110,area.clientWidth*.18))||Math.abs(dx)<Math.abs(dy)*1.7)return;
  if(dx<0){if(pageNumber+pageStep()<=pdf.numPages)showPage(pageNumber+pageStep());}
  else if(pageNumber>1)showPage(Math.max(1,pageNumber-pageStep()));
 });
 area.addEventListener('pointercancel',endMouse);
 area.addEventListener('lostpointercapture',()=>{if(mouseGesture)endMouse();});
 // One turn per horizontal trackpad burst, including its momentum tail.
 let wheelLast=-Infinity,wheelDistance=0,wheelTurned=false,wheelVertical=false;
 area.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  const now=performance.now();
  if(now-wheelLast>220){wheelDistance=0;wheelTurned=false;wheelVertical=false;}
  wheelLast=now;if(!canTurn())return;
  const unit=event.deltaMode===1?16:event.deltaMode===2?area.clientWidth:1;
  const dx=event.deltaX*unit,dy=event.deltaY*unit;
  if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)*1.3)wheelVertical=true;
  if(wheelVertical||Math.abs(dx)<2||Math.abs(dx)<Math.abs(dy)*1.7)return;
  if(event.cancelable)event.preventDefault();
  if(wheelTurned)return;
  if(wheelDistance&&Math.sign(dx)!==Math.sign(wheelDistance))wheelDistance=0;
  wheelDistance+=dx;
  if(Math.abs(wheelDistance)<Math.max(80,Math.min(180,area.clientWidth*.16)))return;
  wheelTurned=true;
  if(wheelDistance>0){if(pageNumber+pageStep()<=pdf.numPages)showPage(pageNumber+pageStep());}
  else if(pageNumber>1)showPage(Math.max(1,pageNumber-pageStep()));
 },{passive:false});
 area.setAttribute('aria-label',english()?'Book page. Swipe or drag horizontally to turn pages; scroll vertically to read.':'Page du livre. Glissez au doigt, à la souris ou au trackpad pour tourner les pages ; faites défiler verticalement pour lire.');
}
function changeChapter(c){
 if(!c)return;chapter=c;title.textContent=c.title;if(!pdf)return;zoom=1;showPage(c.page);if(mobile.matches)$('chapter-links').closest('details').open=false;document.documentElement.classList.remove('contents-visible');syncScreenControls();
 $('reading').focus({preventScroll:true});$('reading').scrollIntoView({block:'start',behavior:'instant'});
}
async function init(){
 const response=await fetch(new URL('./book-reader-data.json?v=20261017-original',import.meta.url));if(!response.ok)throw Error('Book catalogue');
 const books=await response.json();
 bookKey=params.get('livre')||'methode';book=books[bookKey];
 if(!book)throw Error('Unknown book');
 document.documentElement.lang=bookKey==='method-en'?'en':'fr';
 if(bookKey==='method-en'){
  for(const [id,text] of [['return-book','Back to the book'],['toc-label','Contents'],['download','Download the PDF'],['fit-width','Fit page'],['single-page','One page'],['double-page','Two pages'],['open-contents','Contents'],['fullscreen-reading','Full screen'],['toggle-sidebar','Hide contents'],['close-contents','Close contents'],['previous-chapter','← Previous chapter'],['next-chapter','Next chapter →']])$(id).textContent=text;
  for(const [id,text] of [['previous','Previous page'],['next','Next page'],['zoom-in','Zoom in'],['zoom-out','Zoom out'],['page-number','PDF page number']])$(id).setAttribute('aria-label',text);
  document.querySelector('label[for=page-number]').textContent='PDF page';
 }
 savedPosition=readPosition();resumePage=savedPosition?.page;viewMode=savedPosition?.mode==='double'?'double':'single';
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
 for(const id of ['page-number','zoom-in','zoom-out','fit-width','single-page','double-page'])$(id).disabled=false;
 $('page-number').max=pdf.numPages;
 for(const [id,mode] of [['single-page','single'],['double-page','double']])$(id).addEventListener('click',()=>{if(viewMode===mode)return;viewMode=mode;zoom=1;showPage(pageNumber,{resetScroll:false});});
 $('open-contents').addEventListener('click',()=>{
  const details=$('chapter-links').closest('details');
  if(focusedReading){document.documentElement.classList.toggle('contents-visible');details.open=true;syncScreenControls();if(document.documentElement.classList.contains('contents-visible'))$('close-contents').focus({preventScroll:true});}
  else{document.documentElement.classList.remove('contents-hidden');details.open=true;screenLayout();details.scrollIntoView({block:'start',behavior:'instant'});$('toc-label').focus({preventScroll:true});}
 });
 $('fullscreen-reading').addEventListener('click',toggleFullScreen);
 $('toggle-sidebar').addEventListener('click',()=>{document.documentElement.classList.toggle('contents-hidden');screenLayout();});
 $('close-contents').addEventListener('click',()=>{document.documentElement.classList.remove('contents-visible');syncScreenControls();$('open-contents').focus({preventScroll:true});});
 $('chapter-links').closest('details').addEventListener('toggle',syncScreenControls);
 syncScreenControls();
 if(resumePage&&resumePage<=pdf.numPages){
  $('resume-reading').hidden=false;$('resume-reading').textContent=english()?`Resume · page ${resumePage}`:`Reprendre · page ${resumePage}`;
  $('resume-reading').addEventListener('click',()=>showPage(resumePage));
 }

 $('previous').addEventListener('click',()=>showPage(pageNumber-pageStep()));$('next').addEventListener('click',()=>showPage(pageNumber+pageStep()));
 $('page-number').addEventListener('change',()=>showPage(Number($('page-number').value)));
 $('page-number').addEventListener('keydown',e=>{if(e.key==='Enter'){$('page-number').blur();showPage(Number($('page-number').value));}});
 $('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);showPage(pageNumber,{resetScroll:false});});
 $('zoom-out').addEventListener('click',()=>{zoom=Math.max(.75,zoom-.25);showPage(pageNumber,{resetScroll:false});});
 $('fit-width').addEventListener('click',()=>{zoom=1;showPage(pageNumber);});
 for(const id of ['previous-chapter','next-chapter'])$(id).addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const n=Number(new URL($(id).href).searchParams.get('chapitre'));changeChapter(book.chapters.find(c=>c.number===n));});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&focusedReading&&!document.fullscreenElement){setReadingFocus(false);return;}if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();showPage(pageNumber+pageStep());}if(e.key==='ArrowLeft'){e.preventDefault();showPage(pageNumber-pageStep());}});
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>showPage(pageNumber,{resetScroll:false}),200);});
 installPageSwipes();
 const explicit=Number(params.get('page'))||(params.has('chapitre')?chapter.page:0);
 await showPage(explicit||(resumePage<=pdf.numPages?resumePage:0)||chapter.page);
}
init().catch(error=>{console.error('Book reader:',error);message('La liseuse ne peut pas ouvrir le livre pour le moment. Retrouvez le PDF original depuis la présentation du livre.');});
