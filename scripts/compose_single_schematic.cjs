const {JSDOM}=require('jsdom');
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Reposition complete circuit groups; never rebuild or reinterpret a component pin.
module.exports=function(sources,originalPanels,style){
 const width=7240,height=6720;
 const word=s=>String(s).replace(/后续分图/g,'待定项目').replace(/跨页/g,'跨区').replace(/逻辑页端口/g,'逻辑网络端口').replace(/电源页/g,'电源区').replace(/接口页/g,'接口区').replace(/F4页/g,'F4区').replace(/本页/g,'本区').replace(/此页/g,'此区').replace(/在电源区设计/g,'见上方电源区');
 const panels=[],domains=[];
 const destinations={
  'power-input-6s':[40,200],
  'power-buck5':[3640,200],
  'power-servo5':[5390,200],
  'power-buck33':[40,690],
  'power-ports':[1790,690],
  'power-boundaries':[1790,1270],
  'battery-sense':[3640,1390]
 };
 const offsets={f4:[0,1830],p4:[3600,1830],interfaces:[0,4230],camera:[3600,4230],battery:[0,0]};
 const groups=[];
 for(const source of sources){
  const xml=new JSDOM(source.svg,{contentType:'image/svg+xml'}),root=xml.window.document.documentElement;
  const children=[...root.children],local=originalPanels.filter(p=>p.sheet===source.id),parts=[];
  for(let i=0;i<local.length;i++){
   const p=local[i],start=children.findIndex(e=>e.id===p.id);
   if(start<0)throw Error('Missing circuit '+p.id);
   const next=i+1<local.length?children.findIndex(e=>e.id===local[i+1].id):children.findIndex((e,k)=>k>start&&e.tagName==='text'&&Number(e.getAttribute('y'))===(source.height||2546)-71);
   if(next<=start)throw Error('Cannot determine circuit boundary '+p.id);
   const [x,y]=destinations[p.id]||[p.x+offsets[source.id][0],p.y+offsets[source.id][1]];
   const translated={...p,x,y,title:word(p.title),sheet:'board',domain:source.id};panels.push(translated);
   const content=children.slice(start,next).map(e=>e.outerHTML).join('\n');
   parts.push(`<g data-panel="${E(p.id)}" transform="translate(${x-p.x} ${y-p.y})">${word(content)}</g>`);
  }
  const own=panels.filter(p=>p.domain===source.id),x=Math.min(...own.map(p=>p.x)),y=Math.min(...own.map(p=>p.y));
  domains.push({id:source.id,title:source.title.replace(/^\d+ · /,''),short:source.short,x,y,w:Math.max(...own.map(p=>p.x+p.w))-x,h:Math.max(...own.map(p=>p.y+p.h))-y});
  groups.push(`<g id="domain-${source.id}" data-domain="${source.id}">${parts.join('\n')}</g>`);xml.window.close();
 }
 const label=(x,y,t,size=34)=>`<text x="${x}" y="${y}" font-size="${size}" class="heading">${E(t)}</text>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" id="svg-board" class="circuit" viewBox="0 0 ${width} ${height}" role="img" aria-label="无人船统一主板整张原理图：电源、双MCU、通信、存储、摄像头和执行接口">
 <style>${style}</style><rect width="${width}" height="${height}" fill="#fff"/><rect x="18" y="18" width="${width-36}" height="${height-36}" rx="6" fill="none" stroke="#9db3c5" stroke-width="2"/>
 ${label(48,78,'无人船统一主板 · 整张原理图',48)}
 <text x="7192" y="78" font-size="30" class="heading" text-anchor="end">Rev F · 2026-11-18 · 01 / 01</text>
 <text x="48" y="124" font-size="23" class="muted">同名网络在整图内互连 · 点击高亮 / 双击追踪 · DNP 默认不装 · 候选电气评审稿</text>
 ${label(48,178,'3S / 4S / 6S 单路输入 · 逻辑与舵机双路 5V')}
 ${label(48,1978,'STM32F407 · 实时控制与传感器')}${label(3648,1978,'ESP32-P4C5 · 通信、存储与视频')}
 ${label(48,4358,'外部模块与执行接口')}${label(3648,4358,'SD / USB / CSI / DVP 外围')}
 ${groups.join('\n')}
 <text x="48" y="6670" font-size="23" class="heading">整板同图 · 100 个 F4 引脚 / 88 个 P4 模块焊盘 · 同名网络等效连接 · NC 未接</text>
 <text x="7192" y="6670" font-size="22" class="muted" text-anchor="end">${width} × ${height} · 电气评审稿 / 未完成 EDA ERC、DRC</text></svg>`;
 return {svg,panels,domains,width,height,word};
};
