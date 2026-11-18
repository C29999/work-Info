'use strict';

const draw=require('./schematic_draw.cjs');
const key=(ref,pin)=>ref+'.'+pin;

// The existing component records are the only source of pin numbers and nets.
module.exports=function makeModule(panel,subtitle,components){
 const d=draw(),byRef=new Map(components.map(c=>[c.ref,c])),pins=new Map();
 const wires=[],labels=[],dots=[],bodies=[];
 const {id,w,h,title}=panel;
 d.panel(id,0,0,w,h,title,subtitle);
 const headerLength=d.output().length;
 const p=(n,x,y)=>({n,x,y});
 const resolve=(ref,no)=>{const def=byRef.get(ref)?.pins[no];if(!def)throw Error(id+' missing '+key(ref,no));return def;};
 function mark(ref,no,x,y){
  const k=key(ref,no),def=resolve(ref,no);
  if(pins.has(k))throw Error(id+' double pin '+k);
  const t=p(def.net,x,y);pins.set(k,t);return t;
 }
 function wire(n,...xy){
  for(let i=1;i<xy.length;i++){
   const [x1,y1]=xy[i-1],[x2,y2]=xy[i];
   if(x1===x2&&y1===y2)continue;
   if(!n||(x1!==x2&&y1!==y2))throw Error(id+' invalid wire '+JSON.stringify({n,xy}));
   wires.push([n,Math.min(x1,x2),Math.min(y1,y2),Math.max(x1,x2),Math.max(y1,y2)]);
   d.line(x1,y1,x2,y2,n);
  }
 }
 function join(a,b,...corners){
  if(!a?.n||a.n!==b?.n)throw Error(id+' cannot join '+JSON.stringify({a,b}));
  wire(a.n,[a.x,a.y],...corners,[b.x,b.y]);
 }
 function dot(x,y){dots.push([x,y]);d.dot(x,y);}
 function label(t,anchor='start',size=17,dx=0,dy=-9){
  if(!t.n)throw Error(id+' cannot label NC');
  labels.push(t);d.net(t.x+dx,t.y+dy,t.n,anchor,size);
 }
 function end(t,dir,len=45){
  if(!t.n)return;
  const b=p(t.n,t.x+dir*len,t.y);join(t,b);label(b,dir===-1?'start':'end');return b;
 }
 function ground(t,x=t.x,y=t.y){
  const b=p('GND',x,y);join(t,b,[x,t.y]);labels.push(b);d.gnd(x,y);
 }
 function rail(n,y,...xs){
  const a=[...new Set(xs)].sort((a,b)=>a-b);
  wire(n,[a[0],y],[a.at(-1),y]);for(const x of a.slice(1,-1))dot(x,y);
  return x=>p(n,x,y);
 }
 function spine(n,x,pt){
  const a=[...pt].sort((a,b)=>a.y-b.y);
  wire(n,[x,a[0].y],[x,a.at(-1).y]);
  a.forEach((t,i)=>{join(p(n,x,t.y),t);if(i>0&&i<a.length-1)dot(x,t.y);});
  return y=>p(n,x,y);
 }
 function chip(ref,x,y,w,left,right,pitch=36){
  const c=byRef.get(ref),ps={};
  const defs=(order,side)=>order.map((no,i)=>{
   const pin=resolve(ref,no);
   ps[no]=mark(ref,no,side==='L'?x-26:x+w+26,y+90+pitch*i);
   return [String(no),pin.name,pin.net];
  });
  const h=100+pitch*(Math.max(left.length,right.length)-1);
  bodies.push([ref,x,y,x+w,y+h]);
  d.ic(x,y,w,h,ref,c.value,defs(left,'L'),defs(right,'R'),c.footprint,c.note,{wired:true});
  return ps;
 }
 function plug(ref,x,y,w,side,order,step=34){
  const c=byRef.get(ref),ps={},left=side==='L',first=52;
  order=order||Object.keys(c.pins);
  const h=first+step*(order.length-1)+15;
  bodies.push([ref,x,y,x+w,y+h]);
  d.put(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="${c.kind==='page-port'?'port':'connector'}"/>`);
  d.text(x+w/2,y+19,ref,17,'ref','text-anchor="middle"');
  d.text(x+w/2,y+37,c.value,14,'muted','text-anchor="middle"');
  order.forEach((no,i)=>{
   const q=resolve(ref,no),yy=y+first+i*step,edge=left?x:x+w,outer=edge+(left?-24:24);
   ps[no]=mark(ref,no,outer,yy);
   d.line(edge,yy,outer,yy,q.net);
   const name=c.kind==='page-port'?q.name:/^\d+\s|^CD\d|^SHIELD/.test(q.name)?q.name:(q.name===q.net?String(no):no+' '+q.name);
   d.text(edge+(left?8:-8),yy+4,name,15,'pin',`text-anchor="${left?'start':'end'}"`);
   if(!q.net){d.line(outer-5,yy-5,outer+5,yy+5);d.line(outer-5,yy+5,outer+5,yy-5);d.text(outer+(left?-10:10),yy+5,'NC',15,'nc',`text-anchor="${left?'end':'start'}"`);}
  });
  return ps;
 }
 function part(ref,x1,y1,x2,y2,{reverse=false,value=true,caption='end',size=16}={}){
  const c=byRef.get(ref),v=x1===x2,dir=Math.sign(v?y2-y1:x2-x1);
  if(dir!==1||(!v&&y1!==y2))throw Error(id+' bad part geometry '+ref);
  const xx=(x1+x2)/2,yy=(y1+y2)/2,span=v?y2-y1:x2-x1;
  const mode=ref.startsWith('SW')?'SW':ref.startsWith('JP')?'JP':ref[0],ids=mode==='D'?(reverse?['K','A']:['A','K']):(reverse?[2,1]:[1,2]);
  const a=mark(ref,ids[0],x1,y1),b=mark(ref,ids[1],x2,y2);
  const half=mode==='C'?6:span<66?12:19;
  if(span<=half*2)throw Error(id+' short body for '+ref);
  bodies.push(v?[ref,xx-7,yy-half,xx+7,yy+half]:[ref,xx-half,yy-7,xx+half,yy+7]);
  wire(a.n,[x1,y1],[v?xx:xx-half,v?yy-half:yy]);wire(b.n,[v?xx:xx+half,v?yy+half:yy],[x2,y2]);
  const inner=[];
  if(mode==='C'){
   for(const side of [-half,half])inner.push(`<line x1="${side}" y1="-13" x2="${side}" y2="13" class="wire"/>`);
  }else if(mode==='SW'||mode==='JP'){
   inner.push(`<circle cx="${-half}" cy="0" r="3.5" class="symbol"/><circle cx="${half}" cy="0" r="3.5" class="symbol"/><path d="M ${-half+2} -3 L ${half-4} -14" class="wire"/>`);
  }else if(mode==='D'){
   const right=reverse?-1:1;
   inner.push(`<path transform="scale(${right} 1)" d="M ${-half} -12 L ${half} 0 L ${-half} 12 Z" class="symbol"/>`);
   const bar=ref==='D902'?`M ${half-6} -18 l6 6 v24 l6 6`:`M ${half-5} -17 h5 v29 h5 v5`;
   inner.push(`<path transform="scale(${right} 1)" d="${bar}" class="wire"/>`);
  }else if(mode==='Y'){
   inner.push(`<path d="M ${-half} -13 v26 M ${half} -13 v26" class="wire"/><rect x="-11" y="-14" width="22" height="28" class="symbol"/>`);
  }else{
   inner.push(`<rect x="${-half}" y="-7" width="${half*2}" height="14" class="symbol"${/DNP/.test(c.value)?' stroke-dasharray="5 3"':''}/>`);
   if(mode==='F')inner.push(`<path d="M ${-half} 0 h${half*2}" class="wire"/>`);
  }
  d.put(`<g transform="translate(${xx} ${yy})${v?' rotate(90)':''}">${inner.join('')}</g>`);
  if(caption===false)return [a,b];
  if(v){
   const left=caption==='left',tx=xx+(left?-16:16),anchor=`text-anchor="${left?'end':'start'}"`;
   d.text(tx,yy+1,ref,size,'ref',anchor);
   if(value)d.text(tx,yy+20,c.value,size,'value',anchor);
  }else{
   d.text(xx,yy+(caption==='above'?-18:24),ref+(value?' · '+c.value:''),size,'value','text-anchor="middle"');
  }
  return [a,b];
 }
 function probe(ref,x,y,dir=1){
  const a=mark(ref,1,x,y+18*dir);
  d.put(`<circle cx="${x}" cy="${y}" r="6" class="symbol"/>`);
  d.line(x,y+6*dir,a.x,a.y,a.n);d.text(x-11,y+5,ref,16,'ref','text-anchor="end"');return a;
 }
 const contains=([n,x1,y1,x2,y2],x,y)=>x>=x1&&x<=x2&&y>=y1&&y<=y2;
 function finish(){
  for(const c of components)for(const [no,def] of Object.entries(c.pins)){
   const t=pins.get(key(c.ref,no));
   if(!t)throw Error(id+' omitted pin '+key(c.ref,no));
   if(def.net&&!wires.some(s=>s[0]===t.n&&contains(s,t.x,t.y))&&!labels.some(l=>l.n===t.n&&l.x===t.x&&l.y===t.y))throw Error(id+' open pin '+key(c.ref,no));
  }
  for(const [x,y] of dots)if(new Set(wires.filter(s=>contains(s,x,y)).map(s=>s[0])).size!==1)throw Error(id+' ambiguous junction '+x+','+y);
  const adjacency=wires.map(()=>[]);
  for(const [n,x1,y1,x2,y2] of wires){
   if(x1<0||y1<80||x2>w||y2>h)throw Error(id+' wire outside panel '+n);
   for(const [ref,a,b,c,e] of bodies)if(x1<c&&x2>a&&y1<e&&y2>b)throw Error(id+' '+n+' crosses '+ref);
  }
  for(let i=0;i<wires.length;i++)for(let j=i+1;j<wires.length;j++){
   const u=wires[i],v=wires[j];
   const x=Math.max(u[1],v[1]),y=Math.max(u[2],v[2]),rx=Math.min(u[3],v[3]),ry=Math.min(u[4],v[4]);
   if(x>rx||y>ry)continue;
   if(u[0]===v[0]){adjacency[i].push(j);adjacency[j].push(i);continue;}
   if(x!==rx||y!==ry||[u,v].some(s=>s[1]===x&&s[2]===y||s[3]===x&&s[4]===y))throw Error(id+' apparent short '+u[0]+' vs '+v[0]+' at '+x+','+y);
  }
  const clusters=new Map(),seen=new Set();
  for(let i=0;i<wires.length;i++){
   if(seen.has(i))continue;
   const queue=[i],net=wires[i][0];let labeled=false;seen.add(i);
   for(const k of queue){
    labeled ||= labels.some(t=>t.n===net&&contains(wires[k],t.x,t.y));
    for(const next of adjacency[k])if(!seen.has(next)){queue.push(next);seen.add(next);}
   }
   if(!clusters.has(net))clusters.set(net,[]);
   clusters.get(net).push(labeled);
  }
  for(const [n,groups] of clusters)if(groups.length>1&&groups.includes(false))throw Error(id+' unmarked break in '+n);
  return d.output().slice(headerLength+1);
 }
 return {d,p,wire,join,dot,label,end,ground,rail,spine,chip,plug,part,probe,finish,byRef};
};
