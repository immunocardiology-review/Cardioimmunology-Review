/* A versioned export of the same source geometry; no selected theme is hidden. */
(()=>{
'use strict';
const pngButton=document.getElementById('field-download');
if(!pngButton)return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function figureSVG(){
 const source=document.getElementById('field-constellation');
 const clone=source.cloneNode(true);
 const properties=['fill','stroke','stroke-width','stroke-linejoin','stroke-dasharray','font-family','font-size','font-weight','font-style','text-anchor','paint-order'];
 const originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
 originals.forEach((node,i)=>{
  const css=getComputedStyle(node),copy=copies[i];
  for(const name of properties){let value=css.getPropertyValue(name);if(name==='fill'&&value.includes('field-core'))value='url(#field-core)';if(name==='font-family')value='Georgia, serif';if(value)copy.style.setProperty(name,value);}
  copy.style.opacity=node.classList?.contains('field-rays')?'1':node.getAttribute('opacity')||'1';
 });
 clone.querySelectorAll('.constellation-hit,#field-connections').forEach(n=>n.remove());
 clone.querySelectorAll('[tabindex],[role]').forEach(n=>{n.removeAttribute('tabindex');n.removeAttribute('role');n.removeAttribute('aria-expanded');n.removeAttribute('aria-controls');});
 clone.setAttribute('x','100');clone.setAttribute('y','405');clone.setAttribute('width','2800');clone.setAttribute('height','2520');
 const legend=window.FIELD_ATLAS.groups.map((g,i)=>{const x=310+(i%3)*850,y=286+Math.floor(i/3)*48;return `<circle cx="${x}" cy="${y-7}" r="6" fill="${g.color}"/><text x="${x+20}" y="${y}" fill="${g.color}" font-size="25" font-family="Arial,sans-serif">${esc(g.title)}</text>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="4800" height="4800" viewBox="0 0 3000 3000"><title>The Map of the Field, Cardioimmunology</title><desc>A curated educational atlas by Brahim Abdelouaeb. Six reading families, with the heart at the centre. Geometry and reading links are not causal evidence.</desc><rect width="3000" height="3000" fill="#102f28"/><rect x="50" y="50" width="2900" height="2900" fill="none" stroke="#79967d"/><text x="1500" y="125" text-anchor="middle" fill="#edf0df" font-size="48" font-family="Georgia,serif">Cardioimmunology Review</text><text x="1500" y="213" text-anchor="middle" fill="#edf0df" font-size="73" font-family="Georgia,serif">The Map of the Field</text>${legend}${new XMLSerializer().serializeToString(clone)}<rect x="55" y="2870" width="2890" height="75" fill="#102f28"/><text x="1500" y="2897" text-anchor="middle" fill="#edf0df" font-family="Arial,sans-serif" font-size="22">Brahim Abdelouaeb · v1.0.0 · 19 October 2026 · doi:10.5281/zenodo.23468276</text><text x="1500" y="2932" text-anchor="middle" fill="#c5d6bd" font-family="Arial,sans-serif" font-size="20">cardioimmunologyreview.org/#field · Conceptual reading map · CC BY 4.0</text></svg>`;
}
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function exportFigure(svgOnly){
 const status=document.getElementById('field-figure-status');pngButton.disabled=true;status.textContent='Preparing the versioned map';
 try{
  await document.fonts.ready;
  const text=figureSVG();
  if(svgOnly){save(new Blob([text],{type:'image/svg+xml;charset=utf-8'}),'cardioimmunology-field-atlas-v1.svg');}
  else{
   const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));
   try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas');c.width=4800;c.height=4800;const x=c.getContext('2d');x.drawImage(img,0,0,4800,4800);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw new Error('Export unavailable');save(blob,'cardioimmunology-field-atlas-v1-4800.png');}finally{URL.revokeObjectURL(url);}
  }
  status.textContent='Versioned figure downloaded';
 }catch(e){status.textContent='The export could not be prepared. Please try again.';}finally{pngButton.disabled=false;}
}
pngButton.addEventListener('click',()=>exportFigure(false));
const svgButton=document.createElement('button');svgButton.type='button';svgButton.id='field-download-svg';svgButton.textContent='Download SVG';svgButton.addEventListener('click',()=>exportFigure(true));pngButton.insertAdjacentElement('afterend',svgButton);
})();
