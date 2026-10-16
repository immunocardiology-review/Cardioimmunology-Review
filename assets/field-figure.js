/* Export the actual atlas geometry as a sharp, self-contained teaching figure. */
(()=>{
'use strict';
const button=document.getElementById('field-download');
if(!button)return;
button.addEventListener('click',async()=>{
 const status=document.getElementById('field-figure-status');
 button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='Preparing the complete map';
 try{
  const presentation=document.getElementById('field-presentation');
  if(presentation.getAttribute('aria-pressed')!=='true')presentation.click();
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=2200;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas unavailable');
  const text=(value,x,y,font,color='#edf0df',align='center')=>{ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(value,x,y);};
  ctx.fillStyle='#102f28';ctx.fillRect(0,0,2000,2200);
  ctx.strokeStyle='#7f9b8055';ctx.lineWidth=1;ctx.strokeRect(42,42,1916,2116);
  text('Cardioimmunology Review',1000,92,'500 44px "EB Garamond", Georgia, serif');
  text('THE MAP OF THE FIELD',1000,145,'22px Arial, sans-serif','#bcd0b5');
  text('Cardioimmunology',1000,233,'500 86px "Cormorant Garamond", Georgia, serif');
  text('Mechanisms, cells and clinical phenotypes — connected through evidence',1000,285,'32px "EB Garamond", Georgia, serif','#d4dfc8');
  const groups=window.FIELD_ATLAS.groups;
  const widths=groups.map(g=>{ctx.font='22px Arial';return ctx.measureText(g.title).width+60;});
  let gx=(2000-widths.reduce((a,b)=>a+b,0))/2;
  groups.forEach((g,i)=>{ctx.fillStyle=g.color;ctx.beginPath();ctx.arc(gx+9,328,5,0,Math.PI*2);ctx.fill();text(g.title,gx+25,335,'22px Arial, sans-serif',g.color,'left');gx+=widths[i];});
  ctx.save();ctx.translate(0,350);
  const svg=document.getElementById('field-constellation');
  for(const node of svg.querySelectorAll('circle,line,path,text')){
   if(node.classList.contains('constellation-hit'))continue;
   const css=getComputedStyle(node),num=name=>Number(node.getAttribute(name)||0);
   ctx.save();ctx.globalAlpha=Number(css.opacity||1);
   ctx.lineWidth=parseFloat(css.strokeWidth)||1;ctx.lineJoin='round';
   ctx.strokeStyle=css.stroke==='none'?'transparent':css.stroke;
   ctx.fillStyle=css.fill==='none'?'transparent':css.fill;
   if(css.fill.includes('field-core')){
    const gradient=ctx.createRadialGradient(1000,840,0,1000,840,94);
    gradient.addColorStop(0,'#edf0d5');gradient.addColorStop(.72,'#c8d9af');gradient.addColorStop(1,'#95b17e');ctx.fillStyle=gradient;
   }
   const tag=node.tagName.toLowerCase();
   if(tag==='circle'){
    ctx.beginPath();ctx.arc(num('cx'),num('cy'),num('r'),0,Math.PI*2);
    if(css.fill!=='none')ctx.fill();if(css.stroke!=='none')ctx.stroke();
   }else if(tag==='line'){
    ctx.beginPath();ctx.moveTo(num('x1'),num('y1'));ctx.lineTo(num('x2'),num('y2'));ctx.stroke();
   }else if(tag==='path'){
    ctx.setLineDash((css.strokeDasharray||'').split(/[ ,]+/).map(Number).filter(v=>Number.isFinite(v)&&v>0));ctx.stroke(new Path2D(node.getAttribute('d')));
   }else if(tag==='text'){
    ctx.font=`${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    ctx.textAlign=css.textAnchor==='middle'?'center':css.textAnchor==='end'?'right':'left';ctx.textBaseline='alphabetic';
    const spans=Array.from(node.querySelectorAll('tspan'));
    for(const part of spans.length?spans:[node]){
     const x=Number(part.getAttribute('x')||node.getAttribute('x')),y=Number(part.getAttribute('y')||node.getAttribute('y'));
     if(css.stroke!=='none')ctx.strokeText(part.textContent,x,y);
     ctx.fillText(part.textContent,x,y);
    }
   }
   ctx.restore();
  }
  ctx.restore();ctx.strokeStyle='#7f9b8066';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(130,2060);ctx.lineTo(1870,2060);ctx.stroke();
  text('Explore the interactive map · cardioimmunologyreview.org/#field',1000,2107,'30px "EB Garamond", Georgia, serif');
  text('Brahim Abdelouaeb · Author & editor',1000,2144,'22px Arial, sans-serif','#bcd0b5');
  text('Conceptual reading map · Connections do not establish causality',1000,2177,'18px Arial, sans-serif','#bcd0b5');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Image unavailable');
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='cardioimmunology-map-of-the-field.png';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='The complete map has been downloaded';
 }catch(error){
  status.textContent='The figure could not be downloaded. Please try again.';
 }finally{button.disabled=false;button.removeAttribute('aria-busy');}
});
})();
