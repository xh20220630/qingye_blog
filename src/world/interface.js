import { locations } from './locations';

const ui=document.getElementById('world-ui');
if(ui){
  const root=document.documentElement;
  const sheet=document.getElementById('place-sheet');
  const settings=document.getElementById('world-settings');
  const settingsTrigger=document.getElementById('world-setting-trigger');
  const reader=document.getElementById('world-reader');
  const frame=document.getElementById('world-reader-frame');
  const readerTitle=document.getElementById('reader-title');
  const readerLoading=document.getElementById('reader-loading');
  const external=document.getElementById('reader-external');
  const status=document.getElementById('world-status');
  const still=document.getElementById('world-still');
  const inspection=document.getElementById('world-inspection');
  const visited=new Set();
  let selected=null,readerOrigin=null,readerTimeout=0;
  const emit=(type,detail)=>document.dispatchEvent(new CustomEvent(`realm:${type}`,{detail}));
  const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  try{
    const stored=JSON.parse(localStorage.getItem('qy_visited')||'[]');
    if(Array.isArray(stored))stored.filter(id=>locations.some(p=>p.id===id)).forEach(id=>visited.add(id));
  }catch{}
  function syncVisited(){
    document.getElementById('world-visited').textContent=String(visited.size).padStart(2,'0');
    ui.querySelectorAll('[data-destination]').forEach(button=>button.classList.toggle('was-visited',visited.has(button.dataset.destination)));
  }
  syncVisited();
  function closeSettings(){settings.hidden=true;settingsTrigger.setAttribute('aria-expanded','false');}
  function travel(id,focus=false){
    const place=locations.find(p=>p.id===id);
    if(!place)return;
    selected=id;
    inspection.hidden=true;delete ui.dataset.inspecting;
    ui.dataset.state='place';
    sheet.hidden=false;
    ui.querySelectorAll('[data-place]').forEach(content=>content.hidden=content.dataset.place!==id);
    ui.querySelectorAll('[data-destination]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.destination===id)));
    ui.querySelectorAll('[data-pin]').forEach(button=>button.classList.toggle('is-selected',button.dataset.pin===id));
    visited.add(id);save('qy_visited',JSON.stringify([...visited]));syncVisited();
    status.textContent=`已抵达 · ${place.coordinate}`;
    closeSettings();emit('travel',id);
    if(location.hash!==`#${id}`)history.pushState(null,'',`#${id}`);
    if(focus)document.getElementById(`place-title-${id}`)?.focus({preventScroll:true});
  }
  function overview(focus=false){
    const previous=selected;
    selected=null;ui.dataset.state='overview';sheet.hidden=true;
    inspection.hidden=true;delete ui.dataset.inspecting;
    ui.querySelectorAll('[data-destination]').forEach(button=>button.setAttribute('aria-pressed','false'));
    ui.querySelectorAll('[data-pin]').forEach(button=>button.classList.remove('is-selected'));
    status.textContent='山海无界，随心而行';
    emit('travel',null);
    if(location.hash)history.pushState(null,'',location.pathname+location.search);
    if(focus&&previous)ui.querySelector(`[data-destination="${previous}"]`)?.focus({preventScroll:true});
  }
  ui.querySelectorAll('[data-travel]').forEach(button=>button.addEventListener('click',()=>travel(button.dataset.travel,true)));
  ui.querySelectorAll('[data-inspect]').forEach(button=>button.addEventListener('click',()=>{
    const place=locations.find(p=>p.id===button.dataset.inspect);
    if(!place)return;
    sheet.hidden=true;inspection.hidden=false;ui.dataset.inspecting='true';
    document.getElementById('inspection-name').textContent=place.id==='ferry'?'鹤影相伴 · 飞鹤渡':`临境细观 · ${place.name}`;
    closeSettings();emit('inspect',place.id);
    document.getElementById('inspection-back').focus({preventScroll:true});
  }));
  document.getElementById('inspection-back').addEventListener('click',()=>travel(selected,true));
  document.addEventListener('realm:select',event=>travel(event.detail));
  document.getElementById('place-close').addEventListener('click',()=>overview(true));
  document.getElementById('world-overview').addEventListener('click',()=>overview(true));
  window.addEventListener('popstate',()=>{const id=location.hash.slice(1);if(locations.some(p=>p.id===id))travel(id);else overview();});
  settingsTrigger.addEventListener('click',()=>{settings.hidden=!settings.hidden;settingsTrigger.setAttribute('aria-expanded',String(!settings.hidden));});
  document.addEventListener('pointerdown',event=>{if(!settings.contains(event.target)&&!settingsTrigger.contains(event.target))closeSettings();});
  function setSky(value){
    if(!['dawn','sunset','night'].includes(value))return;
    root.dataset.sky=value;
    ui.querySelectorAll('[data-sky]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sky===value)));
    document.getElementById('world-weather-name').textContent={dawn:'辰时 · 云海初晴',sunset:'酉时 · 霞映千山',night:'子时 · 月照松间'}[value];
    save('qy_sky',value);emit('sky',value);
  }
  ui.querySelectorAll('[data-sky]').forEach(button=>button.addEventListener('click',()=>setSky(button.dataset.sky)));
  ui.querySelectorAll('[data-quality]').forEach(button=>button.addEventListener('click',()=>{
    ui.querySelectorAll('[data-quality]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    emit('quality',button.dataset.quality);
  }));
  function setWind(value){
    if(!['calm','breeze','strong'].includes(value))value='breeze';
    ui.querySelectorAll('[data-wind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.wind===value)));
    save('qy_wind',value);emit('wind',value);
  }
  ui.querySelectorAll('[data-wind]').forEach(button=>button.addEventListener('click',()=>setWind(button.dataset.wind)));
  try{setWind(localStorage.getItem('qy_wind')||'breeze');}catch{}
  function syncStill(){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    still.setAttribute('aria-pressed',String(root.dataset.motion==='off'||reduced));
    still.disabled=reduced;
    still.querySelector('span').textContent=reduced?'遵循系统 · 静态观景':'入定 · 暂停天地流转';
  }
  still.addEventListener('click',()=>{
    const off=root.dataset.motion!=='off';
    if(off)root.dataset.motion='off';else delete root.dataset.motion;
    save('qy_motion',off?'off':'on');syncStill();
  });
  syncStill();
  window.addEventListener('storage',event=>{
    if(event.key==='qy_motion'){
      if(event.newValue==='off')root.dataset.motion='off';else delete root.dataset.motion;
      syncStill();
    }
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',syncStill);
  try{setSky(localStorage.getItem('qy_sky')||'dawn');}catch{}

  function openReader(href,title,trigger){
    const url=new URL(href,location.origin);
    if(url.origin!==location.origin)return;
    readerOrigin=trigger||document.activeElement;
    readerTitle.textContent=title||'云上阅卷';external.href=url.href;
    readerLoading.hidden=false;readerLoading.textContent='玉简徐徐展开…';
    frame.src=url.href;frame.title=title||'云上阅卷内容';
    if(!reader.open)reader.showModal();
    emit('reader',true);
    clearTimeout(readerTimeout);
    readerTimeout=window.setTimeout(()=>{if(reader.open&&!readerLoading.hidden)readerLoading.textContent='书卷仍在路上，可稍候或选择右上角「独览」。';},12000);
  }
  document.querySelectorAll('[data-scroll-link]').forEach(link=>link.addEventListener('click',event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();openReader(link.href,link.querySelector('h3')?.textContent||link.textContent.trim().replace(/⟶|↗/g,''),link);
  }));
  frame.addEventListener('load',()=>{
    if(!reader.open)return;
    clearTimeout(readerTimeout);readerLoading.hidden=true;
    try{
      const doc=frame.contentDocument;
      if(doc?.title){readerTitle.textContent=doc.title.replace(/ · 青野山房$/,'');frame.title=readerTitle.textContent;}
      if(frame.contentWindow.location.origin===location.origin)external.href=frame.contentWindow.location.href;
    }catch{}
  });
  const closeReader=()=>reader.close();
  document.getElementById('reader-close').addEventListener('click',closeReader);
  reader.addEventListener('click',event=>{if(event.target===reader){const box=reader.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeReader();}});
  reader.addEventListener('close',()=>{
    clearTimeout(readerTimeout);frame.removeAttribute('src');emit('reader',false);
    if(readerOrigin?.isConnected)readerOrigin.focus({preventScroll:true});
  });
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='realm:close-reader')closeReader();
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||reader.open)return;
    if(!settings.hidden){closeSettings();settingsTrigger.focus();}
    else if(!inspection.hidden)travel(selected,true);
    else if(selected)overview(true);
  });
  document.addEventListener('realm:ready',()=>{if(!selected)status.textContent='点亮一座仙山，开启一段因缘';ui.classList.add('world-ready');});
  document.addEventListener('realm:fallback',()=>{
    status.textContent='静览云境 · 仍可循图录游历';ui.classList.add('world-fallback');
    ui.querySelectorAll('[data-pin]').forEach(pin=>{pin.classList.remove('is-offscreen');pin.tabIndex=0;});
  });
  const initial=location.hash.slice(1);
  if(locations.some(p=>p.id===initial))travel(initial);
}
