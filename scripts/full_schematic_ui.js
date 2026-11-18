(function(){
 'use strict';
 const $=id=>document.getElementById(id),data=JSON.parse($('schematic-data').textContent);
 const view=$('view'),section=$('section'),svg=$('svg-board'),overlay=$('locate-overlay'),board=data.sheets[0],ns='http://www.w3.org/2000/svg';
 const colors={power:'#dc7d21',f4:'#287de0',p4:'#9954df',camera:'#cf719b',interfaces:'#1b99a8'};
 let scale=.75,autoFit=false,current='',currentBox=null,drag=null;
 function zoom(value){
  if(!Number.isFinite(value))return;
  scale=Math.max(.025,Math.min(4,value));
  svg.style.width=board.width*scale+'px';
  overlay.style.width=board.width*scale+'px';overlay.style.height=board.height*scale+'px';
  $('zoom').textContent=Math.round(scale*100)+'%';$('zoom-input').value=String(Math.round(scale*100));
 }
 function centerBox(b){view.scrollTo({left:Math.max(0,(b.x+b.w/2)*scale-view.clientWidth/2+12),top:Math.max(0,(b.y+b.h/2)*scale-view.clientHeight/2+12),behavior:'auto'});}
 function fit(){autoFit=true;zoom(Math.min((view.clientWidth-32)/board.width,(view.clientHeight-32)/board.height));view.scrollTo(0,0);}
 function gotoBox(b,readable=false){autoFit=false;zoom(readable?.75:Math.min(1.4,(view.clientWidth-45)/b.w,(view.clientHeight-40)/b.h));centerBox(b);}
 function setURL(id){const u=new URL(location.href);if(id)u.searchParams.set('module',id);else u.searchParams.delete('module');u.hash='schematic';history.replaceState(null,'',u);}
 function markNav(id){document.querySelectorAll('.toc a').forEach(a=>{const on=a.dataset.module===id||(!id&&a.dataset.section==='schematic');a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
 function rect(b,cls='locate-ring'){
  const el=document.createElementNS(ns,'rect');
  for(const [k,v]of Object.entries({x:b.x-4,y:b.y-4,width:b.w+8,height:b.h+8,rx:8,fill:'none',class:cls}))el.setAttribute(k,String(v));
  overlay.append(el);return el;
 }
 function padBox(number){
  const pad=svg.querySelector('[data-component="U701"][data-pad="'+number+'"]'),line=pad?.querySelector('line.wire');if(!line)return null;
  const group=pad.closest('[data-panel]'),t=/translate\(([-.\d]+)[ ,]+([-.\d]+)\)/.exec(group?.getAttribute('transform')||'');
  const dx=t?+t[1]:0,dy=t?+t[2]:0,x1=+line.getAttribute('x1'),x2=+line.getAttribute('x2'),y1=+line.getAttribute('y1'),y2=+line.getAttribute('y2');
  return {x:Math.min(x1,x2)+dx-12,y:Math.min(y1,y2)+dy-12,w:Math.abs(x2-x1)+24,h:Math.abs(y2-y1)+24};
 }
 function replay(){
  if(!overlay.childElementCount)return;
  overlay.classList.remove('locate-flash');void overlay.getBoundingClientRect();overlay.classList.add('locate-flash');
 }
 overlay.addEventListener('animationend',()=>overlay.classList.remove('locate-flash'));
 function showRegion(id,b){
  overlay.replaceChildren();overlay.dataset.module=id;
  const c=id==='flash-c5'?'#e48625':colors[b.domain||id.replace(/^s-/,'')]||colors.p4;
  overlay.style.setProperty('--focus-color',c);$('focus-dot').style.background=c;
  if(id==='flash-c5'){
   for(const p of [4,5,6,7,82]){const r=padBox(p);if(r)rect(r,'locate-ring program-pad');}
  }else{
   rect(b);
   if(id==='flash-p4')for(const p of [50,51,62,63,64,65,87]){const r=padBox(p);if(r)rect(r,'locate-ring program-pad');}
  }
  $('focus-status').textContent=id==='flash-c5'?'C5 下载预留 · 当前 NC':id==='flash-p4'?'P4 烧录 / 恢复':b.title;
  $('focus-note').textContent=id==='flash-c5'?'4 / 5 / 6 / 7 / 82 脚尚未引出':id==='flash-p4'?'BOOT / RESET / UART；USB 口仍为逻辑口':'边框闪烁三次 · 不覆盖电路';
  $('replay-focus').disabled=false;replay();
 }
 function selectModule(id,{updateURL=true,readable=false}={}){
  if(/^p4-unit-[0-3]$/.test(id||''))id='p4-module';
  const target=id==='flash-p4'?'p4-recovery':id==='flash-c5'?'p4-module':id;
  const b=data.domains.find(s=>'s-'+s.id===target)||data.panels.find(p=>p.id===target);
  current=b?id:'';currentBox=b||null;section.value=current;markNav(current);if(updateURL)setURL(current);
  if(b){gotoBox(b,readable);showRegion(id,b);}else{overlay.replaceChildren();overlay.removeAttribute('data-module');$('focus-status').textContent='整张原理图';$('focus-note').textContent='选择模块后，边框闪烁三次';$('replay-focus').disabled=true;fit();}
 }
 section.onchange=()=>selectModule(section.value);
 $('fit').onclick=()=>selectModule('');
 $('readable').onclick=()=>{if(currentBox){gotoBox(currentBox,true);replay();}else selectModule('p4-module',{readable:true});};
 function stepZoom(f,px=view.clientWidth/2,py=view.clientHeight/2){autoFit=false;const x=(view.scrollLeft+px-12)/scale,y=(view.scrollTop+py-12)/scale;zoom(scale*f);view.scrollTo(x*scale-px+12,y*scale-py+12);}
 $('plus').onclick=()=>stepZoom(1.25);$('minus').onclick=()=>stepZoom(.8);
 $('zoom-input').addEventListener('change',()=>{const raw=$('zoom-input').value.trim(),v=Number(raw);if(!raw||!Number.isFinite(v)||v<=0){$('zoom-input').value=String(Math.round(scale*100));return;}stepZoom(v/100/scale);});
 $('zoom-input').addEventListener('keydown',e=>{if(e.key==='Enter'){$('zoom-input').dispatchEvent(new Event('change'));$('zoom-input').blur();}});
 view.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=view.getBoundingClientRect();stepZoom(Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 view.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-net]'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:view.scrollLeft,top:view.scrollTop};try{view.setPointerCapture?.(e.pointerId);}catch(_){}view.classList.add('panning');});
 view.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;view.scrollTo(drag.left+drag.x-e.clientX,drag.top+drag.y-e.clientY);});
 const stopDrag=()=>{drag=null;view.classList.remove('panning');};for(const type of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(type,stopDrag);
 function highlight(n){
  svg.querySelectorAll('[data-net]').forEach(e=>e.classList.toggle('selected',e.dataset.net===n));svg.querySelectorAll('[data-wire]').forEach(e=>e.classList.toggle('selected',e.dataset.wire===n));
  $('status').textContent=n&&data.nets[n]?n+' · '+data.nets[n].length+'端点 / '+new Set(data.nets[n].map(e=>e.domain)).size+'区域':'点击网络追踪';
 }
 function showDialog(id){const d=$(id);if(!d)return;if(typeof d.showModal==='function'){if(!d.open)d.showModal();}else d.setAttribute('open','');}
 function closeDialog(id){const d=$(id);if(!d)return;if(typeof d.close==='function')d.close();else d.removeAttribute('open');}
 function detail(n){
  if(!data.nets[n])return;highlight(n);$('net-name').textContent=n;
  $('endpoints').textContent=data.nets[n].map(e=>e.ref+'.'+e.pin+' '+e.name+' ['+(data.domains.find(s=>s.id===e.domain)?.short||e.domain)+']').join(' · ');
  const list=$('locations');list.replaceChildren();const seen=new Set();
  svg.querySelectorAll('[data-net]').forEach(e=>{if(e.dataset.net!==n)return;const id=e.closest('[data-panel]')?.dataset.panel;if(!id||seen.has(id))return;seen.add(id);const p=data.panels.find(p=>p.id===id);if(!p)return;const b=document.createElement('button');b.textContent=(data.domains.find(s=>s.id===p.domain)?.short||p.domain)+' / '+p.title;b.onclick=()=>{closeDialog('net-dialog');selectModule(p.id);};list.append(b);});
  showDialog('net-dialog');
 }
 $('sheet').addEventListener('click',e=>{const n=e.target.closest('[data-net]')?.dataset.net;if(n)highlight(n);});
 $('sheet').addEventListener('dblclick',e=>{const n=e.target.closest('[data-net]')?.dataset.net;if(n)detail(n);});
 $('sheet').addEventListener('keydown',e=>{const n=e.target.closest('[data-net]')?.dataset.net;if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();detail(n);}});
 $('clear').onclick=()=>{highlight('');overlay.replaceChildren();overlay.classList.remove('locate-flash');$('focus-status').textContent='已清除高亮';$('focus-note').textContent='再次选择模块即可闪烁定位';$('replay-focus').disabled=true;};
 $('replay-focus').onclick=()=>{if(currentBox)showRegion(current,currentBox);};
 for(const id of ['net','source','notes','flash']){const close=$('close-'+id);if(close)close.onclick=()=>closeDialog(id+'-dialog');}
 $('source-btn').onclick=()=>showDialog('source-dialog');
 $('flash-btn').onclick=()=>showDialog('flash-dialog');
 document.querySelectorAll('[data-program-route]').forEach(b=>b.onclick=()=>{closeDialog('flash-dialog');selectModule(b.dataset.programRoute);});
 document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>selectModule(b.dataset.focus));
 document.querySelectorAll('.toc a').forEach(a=>a.addEventListener('click',e=>{
  if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  if(a.dataset.module!==undefined){e.preventDefault();selectModule(a.dataset.module);}
  else if(a.dataset.notes){e.preventDefault();showDialog('notes-dialog');$(a.dataset.notes)?.scrollIntoView?.({block:'start'});}
  else if(a.dataset.section==='schematic'){e.preventDefault();selectModule('');}
 }));
 $('module-search').addEventListener('input',()=>{const q=$('module-search').value.trim().toLocaleLowerCase();let shown=0;document.querySelectorAll('.toc a').forEach(a=>{const hit=!q||a.textContent.toLocaleLowerCase().includes(q)||(a.dataset.module||'').includes(q);a.hidden=!hit;if(hit)shown++;});$('no-matches').hidden=shown>0;});
 function collapse(on){document.body.classList.toggle('sidebar-collapsed',on);$('sidebar-toggle').setAttribute('aria-expanded',String(!on));}
 if(window.innerWidth<=900)collapse(true);
 $('sidebar-toggle').onclick=()=>collapse(!document.body.classList.contains('sidebar-collapsed'));
 $('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement){if(typeof document.exitFullscreen==='function')await document.exitFullscreen();}else if(typeof document.documentElement.requestFullscreen==='function')await document.documentElement.requestFullscreen();else $('status').textContent='当前阅读环境不支持全屏；可收起目录扩大画布。';}
  catch(_){$('status').textContent='未能进入全屏；可收起目录扩大画布。';}
 };
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-pressed',String(!!document.fullscreenElement));$('fullscreen').textContent=document.fullscreenElement?'退出全屏':'⛶ 全屏';});
 $('print').onclick=()=>window.print();
 function download(name,body,type){const u=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();$('export-menu').open=false;setTimeout(()=>URL.revokeObjectURL(u),1500);}
 function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
 $('bom').onclick=()=>download('无人船_整板_RevE_BOM.csv',csv([['功能区域','位号','型号/数值','封装','装配状态','备注'],...data.components.filter(c=>c.kind==='physical').map(c=>[c.domain,c.ref,c.value,c.footprint,c.assembly,c.note])]),'text/csv;charset=utf-8');
 $('netlist').onclick=()=>download('无人船_整板_原理图连接表.json',JSON.stringify(data,null,2),'application/json');
 $('svg-download').onclick=()=>{const copy=svg.cloneNode(true);copy.removeAttribute('style');copy.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));download('无人船_整板_原理图.svg',new XMLSerializer().serializeToString(copy),'image/svg+xml');};
 const requested=new URLSearchParams(location.search).get('module');
 const initial=/^p4-unit-[0-3]$/.test(requested||'')?'p4-module':requested;
 if(initial&&[...section.options].some(o=>o.value===initial))selectModule(initial,{updateURL:initial!==requested});
 else selectModule('p4-module',{updateURL:false,readable:true});
 if('ResizeObserver'in window)new ResizeObserver(()=>{if(autoFit)fit();}).observe(view);
})();
