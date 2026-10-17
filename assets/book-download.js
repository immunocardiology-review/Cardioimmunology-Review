// Download the unchanged original PDF while keeping the reader on the site.
// Archive landing pages are reserved for citation, never for this control.
const pending = new WeakSet(), statuses = new WeakMap();
document.addEventListener('click', async event => {
 const link=event.target.closest('a[data-pdf-download]');
 if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();if(pending.has(link))return;
 const english=document.documentElement.lang==='en';
 let status=statuses.get(link);
 if(!status?.classList.contains('download-status')){
  status=document.createElement('span');status.className='download-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='display:block;font:12px/1.6 Arial,sans-serif;color:#53625a;margin:8px 0;max-width:38ch';
  const actions=link.closest('.book-actions');if(actions)actions.after(status);else link.after(status);statuses.set(link,status);
 }
 pending.add(link);link.setAttribute('aria-disabled','true');
 const progress=bytes=>{
  const total=Number(link.dataset.pdfBytes);
  status.textContent=(english?'Downloading':'Téléchargement')+' · '+(total?Math.min(100,Math.floor(bytes/total*100))+' %':(bytes/1048576).toFixed(1)+' Mo');
 };
 progress(0);
 try{
  const response=await fetch(link.href,{credentials:'omit'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const chunks=[];let loaded=0;
  if(response.body){
   const reader=response.body.getReader();
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;progress(loaded);}
  }else{const bytes=new Uint8Array(await response.arrayBuffer());chunks.push(bytes);loaded=bytes.byteLength;}
  const expected=Number(link.dataset.pdfBytes);
  if(expected&&loaded!==expected)throw Error('Incomplete PDF');
  const blob=new Blob(chunks,{type:'application/pdf'});
  if(!(await blob.slice(0,5).text()).startsWith('%PDF-'))throw Error('Not a PDF');
  const url=URL.createObjectURL(blob),save=document.createElement('a');
  save.href=url;save.download=link.dataset.pdfDownload;save.hidden=true;document.body.append(save);save.click();save.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent=english?'PDF ready — check your downloads.':'PDF prêt — consultez vos téléchargements.';
 }catch(error){
  console.error('PDF download:',error);status.textContent=english?'Download interrupted. Please try again.':'Téléchargement interrompu. Cliquez à nouveau pour réessayer.';
 }finally{pending.delete(link);link.removeAttribute('aria-disabled');}
});
