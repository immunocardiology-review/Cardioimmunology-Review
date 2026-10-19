/* Reading relationships are conceptual, never causal claims. */
(()=>{
'use strict';
const data=window.FIELD_ATLAS;
const byId=new Map(data.topics.map(t=>[t.id,t]));
const el=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frenchTerms={"innate": "immunité innée reconnaissance danger", "complement": "complément", "inflammasome": "inflammasome", "interleukins": "cytokines interleukines", "immunometabolism": "immunométabolisme", "microbiome": "microbiote axe intestin cœur", "macrophages": "macrophages cardiaques", "lymphocytes": "lymphocytes B T", "dendritic-cells": "cellules dendritiques", "neutrophils": "neutrophiles NETs", "adaptive": "présentation antigénique immunité adaptative", "tolerance": "tolérance immunitaire", "resolution": "résolution inflammation", "remodeling": "remodelage réparation", "fibrosis": "fibrose", "regeneration": "régénération", "atherosclerosis": "athérosclérose", "pericarditis": "péricardite", "myocarditis": "myocardite", "sarcoidosis": "sarcoïdose", "amyloidosis": "amylose amyloses", "systemic": "maladies systémiques auto-immunes", "vasculitis": "vascularite vascularites", "autoinflammation": "auto-inflammation maladies auto-inflammatoires", "pulmonary-hypertension": "hypertension pulmonaire HTAP", "heart-failure": "insuffisance cardiaque", "cardio-oncology": "cardio-oncologie cancer", "cardio-infectiology": "cardio-infectiologie infection", "transplantation": "transplantation greffe rejet", "eye": "œil oculaire uvéite", "kidney": "rein rénal", "neuro": "neuro-immunité cerveau", "pulmonary": "poumon pulmonaire", "rheumatology": "rhumatologie cardio-rhumatologie", "clonal-haematopoiesis": "hématopoïèse clonale CHIP"};
const normalise=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
let initialised=false,active=null,origin=null,route=null,positions=new Map();

function setMapZoom(enlarged){
 const viewport=el('constellation-viewport');
 viewport.classList.toggle('is-enlarged',enlarged);
 el('constellation-zoom').setAttribute('aria-pressed',String(enlarged));
 el('constellation-zoom').textContent=enlarged?'Show the whole map':'Enlarge the map';
 el('constellation-help').textContent=enlarged?'Pan to explore. Select a star to read.':'Enlarge for readable labels, or use the theme selector.';
}
function readingMarkup(topic){
 const p=data.papers[topic.reading];
 if(!p)return '';
 return `<section class="field-selected-reading"><h4>Read the source</h4><p class="field-paper-meta">${esc(p.journal)} · ${esc(p.year)}</p><a class="field-paper-title" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a><div class="field-paper-tags"><span>${esc(p.kind)}</span><span>${esc(p.access)}</span></div></section>`;
}
function drawConnections(){
 const group=el('field-connections');
 group.replaceChildren();
 if(!active)return;
 const start=positions.get(active),topic=byId.get(active),NS='http://www.w3.org/2000/svg';
 for(const id of topic.related){
  const end=positions.get(id);if(!end)continue;
  const line=document.createElementNS(NS,'path');
  const mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
  line.setAttribute('d',`M ${start.x} ${start.y} Q ${1400+(mx-1400)*.8} ${1260+(my-1260)*.8} ${end.x} ${end.y}`);
  group.appendChild(line);
 }
 document.querySelectorAll('.constellation-node').forEach(n=>n.classList.toggle('is-related',topic.related.includes(n.dataset.topic)));
}
function routeMarkup(id){
 if(!route)return '';
 const path=data.paths.find(p=>p.id===route),i=path.topics.indexOf(id);
 if(i<0){route=null;return '';}
 return `<nav class="field-route-nav" aria-label="Reading route"><span>${esc(path.title)} · ${i+1}/${path.topics.length}</span><div>${i>0?`<button type="button" data-route-topic="${path.topics[i-1]}">← Previous</button>`:''}${i<path.topics.length-1?`<button type="button" data-route-topic="${path.topics[i+1]}">Next →</button>`:''}<button type="button" data-end-route>Leave route</button></div></nav>`;
}
function openTopic(id,trigger){
 const topic=byId.get(id);if(!topic)return;
 const repeated=active===id&&trigger?.closest('.constellation-node');
 if(repeated){closeTopic();return;}
 setMapZoom(false);active=id;
 if(trigger?.closest('#field-map-area'))origin=trigger;
 el('field-topic-group').textContent=data.groups.find(g=>g.id===topic.group).title;
 el('field-topic-content').innerHTML=`${routeMarkup(id)}<h3 id="field-topic-title" tabindex="-1">${esc(topic.title)}</h3><p class="field-immune-context">${esc(topic.immune)}</p><p class="field-research-question">${esc(topic.question)}</p><section><h4>What it means</h4><p>${esc(topic.idea)}</p></section><section><h4>Why it matters for the heart</h4><p>${esc(topic.heart)}</p></section><section class="field-evidence"><h4>Evidence and limits</h4><p>${esc(topic.evidence)}</p></section>${readingMarkup(topic)}${topic.terms?`<details class="field-subtopics"><summary>Scope & search terms</summary><p>${esc(topic.terms)}</p></details>`:''}<section><h4>Connected themes</h4><div class="field-related">${topic.related.map(r=>`<button type="button" data-related="${esc(r)}">${esc(byId.get(r).title)} <span aria-hidden="true">↗</span></button>`).join('')}</div></section>${topic.book?`<a class="field-book-link" href="${esc(topic.book.url)}">${esc(topic.book.label)} →</a>`:''}`;
 el('field-panel').hidden=false;
 el('field-layout').classList.add('has-topic');el('p2').classList.add('field-topic-open');
 el('field-panel').scrollTop=0;
 document.querySelectorAll('[data-topic]').forEach(b=>{const selected=b.dataset.topic===id;b.setAttribute('aria-expanded',String(selected));b.classList.toggle('is-active',selected);});
 el('mobile-theme-select').value=id;
 drawConnections();
 el('field-topic-title').focus({preventScroll:true});
 if(matchMedia('(max-width:700px)').matches){el('p2').scrollTop=0;requestAnimationFrame(()=>{el('field-map-area').scrollTop=0;el('field-layout').scrollTop=0;});}
 const address=new URL(location.href);address.searchParams.set('theme',id);history.replaceState(null,'',address.pathname+address.search+address.hash);
}
function closeTopic(){
 const restore=origin||document.querySelector(`.constellation-node[data-topic="${active}"]`);
 active=null;route=null;
 el('field-panel').hidden=true;el('field-layout').classList.remove('has-topic');el('p2').classList.remove('field-topic-open');
 document.querySelectorAll('[data-topic]').forEach(b=>{b.setAttribute('aria-expanded','false');b.classList.remove('is-active','is-related');});
 el('field-connections').replaceChildren();
 el('mobile-theme-select').value='';restore?.focus({preventScroll:true});
 const address=new URL(location.href);address.searchParams.delete('theme');history.replaceState(null,'',address.pathname+address.search+address.hash);
}
function drawConstellation(){
 const svg=el('field-constellation'),NS='http://www.w3.org/2000/svg',cx=1400,cy=1260;
 svg.setAttribute('viewBox','0 0 2800 2520');
 const make=(name,attrs={},parent=svg)=>{const n=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.appendChild(n);return n;};
 make('title').textContent='The map of the field';
 make('desc').textContent='A circular reading map with the heart at its centre. Innate and adaptive immunity cross its six reading families. The geometry and connectors do not assert a causal mechanism. Select a theme to read its question, evidence and selected article.';
 const defs=make('defs');
 defs.innerHTML='<radialGradient id="field-core"><stop offset="0%" stop-color="#edf0d5"/><stop offset="72%" stop-color="#c8d9af"/><stop offset="100%" stop-color="#95b17e"/></radialGradient>';
 [260,450,650,860,1060].forEach(r=>make('circle',{cx,cy,r,fill:'none',stroke:'#d5e4bb',opacity:'.22','stroke-width':'1'}));
 const orbits=[
  {ids:data.topics.filter(t=>t.group==='signals').map(t=>t.id),r:260,phase:-90},
  {ids:data.topics.filter(t=>t.group==='cells').map(t=>t.id),r:450,phase:-72},
  {ids:data.topics.filter(t=>t.group==='tissue').map(t=>t.id),r:650,phase:-90},
  {ids:data.topics.filter(t=>t.group==='clinical').map(t=>t.id),r:860,phase:-82},
  {ids:data.topics.filter(t=>['connections','methods'].includes(t.group)).map(t=>t.id),r:1060,phase:-90}
 ];
 const rays=make('g',{'aria-hidden':'true',class:'field-rays'});
 const connections=make('g',{id:'field-connections','aria-hidden':'true'});
 const nodes=make('g',{class:'field-stars'});
 for(const orbit of orbits)orbit.ids.forEach((id,i)=>{
  const t=byId.get(id),g=data.groups.find(x=>x.id===t.group),a=(orbit.phase+i*360/orbit.ids.length)*Math.PI/180;
  const x=cx+orbit.r*Math.cos(a),y=cy+orbit.r*Math.sin(a);positions.set(id,{x,y});
  make('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:g.color,'stroke-width':'1',opacity:'.065'},rays);
  const n=make('g',{'data-topic':id,role:'button',tabindex:'0','aria-label':`${t.title} — ${t.immune}. Open evidence and selected reading`,'aria-controls':'field-panel','aria-expanded':'false',class:'constellation-node'},nodes);
  make('title',{},n).textContent=`${t.title} · ${t.immune}`;
  make('circle',{cx:x,cy:y,r:39,fill:'transparent',class:'constellation-hit'},n);
  make('circle',{cx:x,cy:y,r:12,fill:'#173e33',stroke:g.color,'stroke-width':'2.2',class:'constellation-star'},n);
  const cos=Math.cos(a),sin=Math.sin(a),vertical=Math.abs(cos)<.26;
  const tx=x+(vertical?0:Math.sign(cos)*28),anchor=vertical?'middle':cos>0?'start':'end';
  const lines=[];let line='';
  for(const word of t.title.split(' ')){if((line+' '+word).trim().length>19&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
  let ty=vertical?y+Math.sign(sin)*34:y+8;
  if(sin<-.35&&lines.length>1)ty-=(lines.length-1)*29;
  // Keep text clear of neighbouring stars without changing the scientific layout.
  const offset=0;
  ty+=offset;
  if(offset)make('line',{x1:x+16,y1:y,x2:tx-8,y2:ty-10,stroke:g.color,'stroke-width':'1.5',opacity:'.6','aria-hidden':'true'},n);
  const text=make('text',{x:tx,y:ty,fill:g.color,'text-anchor':anchor,'font-family':"'EB Garamond',Georgia,serif",'font-size':'31','font-weight':'500','paint-order':'stroke',stroke:'#102f28','stroke-width':'7','stroke-linejoin':'round',class:'field-label'},n);
  lines.forEach((l,j)=>make('tspan',{x:tx,y:ty+j*31},text).textContent=l);
 });
 const arrangeLabels=()=>{
  const accepted=[];
  const hitBoxes=[...positions.values()].map(p=>({x:p.x-19,y:p.y-19,width:38,height:38}));
  const overlaps=(a,b,p=9)=>a.x<b.x+b.width+p&&a.x+a.width+p>b.x&&a.y<b.y+b.height+p&&a.y+a.height+p>b.y;
  const labels=[...nodes.querySelectorAll('text')];
  for(const text of labels){
   text.removeAttribute('transform');
   const box=text.getBBox();let shift=0;
   const choices=[0,-38,38,-76,76,-114,114,-152,152];
   for(const dy of choices){
    const candidate={x:box.x,y:box.y+dy,width:box.width,height:box.height};
    if(candidate.x<25||candidate.x+candidate.width>2775||candidate.y<15||candidate.y+candidate.height>2500)continue;
    if(!accepted.some(b=>overlaps(candidate,b))&&!hitBoxes.some(b=>overlaps(candidate,b,6))){shift=dy;break;}
   }
   text.setAttribute('transform',`translate(0 ${shift})`);
   accepted.push({x:box.x,y:box.y+shift,width:box.width,height:box.height});
  }
 };
 arrangeLabels();document.fonts?.ready.then(arrangeLabels);
 const core=make('g',{'aria-hidden':'true',class:'field-centre'});
 make('circle',{cx,cy,r:118,fill:'#c8d9af',opacity:'.045'},core);
 make('circle',{cx,cy,r:94,fill:'url(#field-core)',stroke:'#e0e8c8','stroke-width':'1'},core);
 make('text',{x:cx,y:cy-10,'text-anchor':'middle',fill:'#173e33','font-family':"'Cormorant Garamond',Georgia,serif",'font-size':'35'},core).textContent='The heart';
 make('text',{x:cx,y:cy+24,'text-anchor':'middle',fill:'#173e33','font-family':"'EB Garamond',Georgia,serif",'font-size':'21','font-style':'italic'},core).textContent='an immune organ';
}
function filterMap(){
 const family=document.querySelector('[data-family][aria-pressed="true"]')?.dataset.family||'all';
 const query=normalise(el('field-search').value.trim());let count=0;
 for(const topic of data.topics){
  const match=(family==='all'||topic.group===family)&&(!query||normalise([topic.title,topic.immune,topic.question,topic.idea,topic.heart,topic.evidence,topic.terms||'',frenchTerms[topic.id]||''].join(' ')).includes(query));
  const star=document.querySelector(`.constellation-node[data-topic="${topic.id}"]`);
  star.classList.toggle('family-muted',!match);star.setAttribute('tabindex',match?'0':'-1');
  document.querySelectorAll(`.field-topic-list [data-topic="${topic.id}"]`).forEach(n=>n.hidden=!match);
  if(match)count++;
 }
 el('field-search-status').textContent=(query||family!=='all')?(count?`${count} theme${count===1?'':'s'} highlighted`:'No matching theme. Try a shorter term or clear the filters.'):'';
 if(el('field-search-clear'))el('field-search-clear').hidden=!query&&family==='all';
}
window.initFieldAtlas=function(){
 if(initialised)return;initialised=true;
 el('field-branches').innerHTML=data.groups.map((g,i)=>`<section class="field-branch" style="--branch-color:${g.color}" aria-labelledby="field-group-${g.id}"><div class="field-branch-heading"><span class="field-step">${String(i+1).padStart(2,'0')}</span><h3 id="field-group-${g.id}">${esc(g.title)}</h3><p>${esc(g.question)}</p></div><div class="field-topic-list">${data.topics.filter(t=>t.group===g.id).map(t=>`<button type="button" data-topic="${t.id}" aria-controls="field-panel" aria-expanded="false"><span class="field-node" aria-hidden="true"></span><span>${esc(t.title)}</span><span class="field-node-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></section>`).join('');
 drawConstellation();
 el('field-map-area').addEventListener('click',e=>{const b=e.target.closest('[data-topic]');if(b){route=null;openTopic(b.dataset.topic,b);}});
 el('constellation-zoom').addEventListener('click',()=>setMapZoom(el('constellation-zoom').getAttribute('aria-pressed')!=='true'));
 el('field-presentation').addEventListener('click',()=>{const on=el('p2').classList.toggle('is-presentation');el('field-presentation').setAttribute('aria-pressed',String(on));el('field-presentation').textContent=on?'Return to reading':'View the whole map';if(on){closeTopic();setMapZoom(false);}el('p2').scrollTop=0;});
 el('constellation-filters').innerHTML='<button type="button" data-family="all" aria-pressed="true">All themes</button>'+data.groups.map(g=>`<button type="button" data-family="${g.id}" aria-pressed="false"><span style="background:${g.color}" aria-hidden="true"></span>${esc(g.title)}</button>`).join('');
 el('constellation-filters').addEventListener('click',e=>{const b=e.target.closest('[data-family]');if(!b)return;document.querySelectorAll('[data-family]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filterMap();});
 el('field-search').addEventListener('input',filterMap);
 el('field-search-clear')?.addEventListener('click',()=>{el('field-search').value='';document.querySelectorAll('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family==='all')));filterMap();el('field-search').focus();});
 el('field-paths').innerHTML=data.paths.map(p=>`<button type="button" data-route="${p.id}">${esc(p.title)} <span aria-hidden="true">↗</span></button>`).join('');
 el('field-paths').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b){route=b.dataset.route;openTopic(data.paths.find(p=>p.id===route).topics[0],b);}});
 el('mobile-theme-select').innerHTML='<option value="">Choose a theme</option>'+data.groups.map(g=>`<optgroup label="${esc(g.title)}">${data.topics.filter(t=>t.group===g.id).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
 el('mobile-theme-select').addEventListener('change',e=>{route=null;if(e.target.value)openTopic(e.target.value,e.target);else if(active)closeTopic();});
 el('field-constellation').addEventListener('keydown',e=>{const n=e.target.closest('[data-topic]');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();route=null;openTopic(n.dataset.topic,n);}});
 el('field-panel').addEventListener('click',e=>{
  const related=e.target.closest('[data-related]'),step=e.target.closest('[data-route-topic]');
  if(related){route=null;openTopic(related.dataset.related,related);}
  if(step)openTopic(step.dataset.routeTopic,step);
  if(e.target.closest('[data-end-route]')){route=null;openTopic(active);}
 });
 el('field-close').addEventListener('click',closeTopic);
 const requested=new URLSearchParams(location.search).get('theme');
 if(byId.has(requested))openTopic(requested,document.querySelector(`.constellation-node[data-topic="${requested}"]`));
 el('p2').addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('field-panel').hidden){e.preventDefault();closeTopic();}});
};
})();
