const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../design'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const results=[],opened=[];
fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});
function setup(name,query=''){
 const errors=[],downloads=[],objects=new Map(),scrolls=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read(name),{url:'https://local-validation.invalid/'+encodeURIComponent(name)+query,runScripts:'outside-only',virtualConsole:vc});opened.push(dom);
 const w=dom.window,d=w.document;w.addEventListener('error',e=>errors.push(e.message));
 w.Element.prototype.scrollTo=function(...args){scrolls.push(args);if(typeof args[0]==='object'){this.scrollLeft=args[0].left??this.scrollLeft;this.scrollTop=args[0].top??this.scrollTop;}else{this.scrollLeft=args[0];this.scrollTop=args[1];}};w.Element.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(value){if(value!==undefined)this.returnValue=value;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.ResizeObserver=class{observe(){} disconnect(){}};
 w.URL.createObjectURL=blob=>{const key='blob:local-qa-'+objects.size;objects.set(key,blob);return key;};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,blob:objects.get(this.href)});};
 let prints=0;w.print=()=>prints++;
 const view=d.getElementById('view');if(view){Object.defineProperty(view,'clientWidth',{value:1200});Object.defineProperty(view,'clientHeight',{value:800});}
 for(const script of d.scripts){if(script.type==='application/json')continue;if(script.src){assert.equal(script.getAttribute('src'),'硬件设计导航.js');w.eval(read('硬件设计导航.js'));}else w.eval(script.textContent);}
 return {dom,w,d,errors,downloads,scrolls,get prints(){return prints;}};
}
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
function csvParse(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}
 if(field||row.length){row.push(field);rows.push(row);}return rows;
}
const blobText=(w,blob)=>new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(blob);});
function event(c,node,type){assert.ok(node,'Event target exists');node.dispatchEvent(new c.w.Event(type,{bubbles:true}));}
const click=(c,node)=>event(c,node,'click');
const visible=c=>[...c.d.querySelectorAll('.drawing-page')].filter(e=>!e.hidden).map(e=>e.dataset.sheet);
function allDomainsVisible(c){
 assert.deepEqual(visible(c),['board']);
 const groups=[...c.d.querySelectorAll('#svg-board > [data-domain]')];assert.equal(groups.length,6);
 for(const g of groups){assert.equal(g.closest('[hidden]'),null);for(let el=g;el&&el.id!=='sheet';el=el.parentElement){assert.notEqual(el.style.display,'none');assert.notEqual(el.style.visibility,'hidden');}}
}

async function main(){
 const source=JSON.parse(read('无人船_整板_原理图连接表.json')),f4Source=JSON.parse(read('无人船_STM32F4_原理图连接表.json')),p4Source=JSON.parse(read('ESP32P4C5引脚配置数据.json'));
 const s=setup('原理图设计.html'),d=s.d,byRef=new Map(source.components.map(c=>[c.ref,c]));
 const component=ref=>{assert.ok(byRef.has(ref),'Missing '+ref);return byRef.get(ref);};
 const pin=(ref,p)=>{assert.ok(component(ref).pins[p],`Missing ${ref}.${p}`);return component(ref).pins[p];};
 const net=(ref,p,n)=>assert.equal(pin(ref,p).net,n,`${ref}.${p}`);
 const pair=(ref,a,b)=>{net(ref,1,a);net(ref,2,b);};
 const dnp=ref=>{assert.match(component(ref).value,/DNP/);assert.equal(component(ref).assembly,'默认不装');};
 const svg=id=>id==='board'?d.getElementById('svg-board'):d.querySelector('#svg-board > [data-domain="'+id+'"]');
 const label=(n,id)=>d.querySelector((id?'#svg-board [data-domain="'+id+'"] ':'#svg-board ')+'[data-net="'+n+'"]');
 await check('One board SVG exposes all six functional domains without a sheet selector or hidden sections',()=>{
  assert.deepEqual(source.sheets.map(s=>s.id),['board']);assert.deepEqual(source.domains.map(s=>s.id),['power','battery','f4','p4','camera','interfaces']);assert.deepEqual(JSON.parse(d.getElementById('schematic-data').textContent),source);assert.match(source.revision,/Rev F.*2026-11-18/);
  assert.equal(d.querySelectorAll('#sheet svg.circuit').length,1);assert.equal(d.querySelectorAll('#sheet svg#locate-overlay').length,1);assert.equal(d.getElementById('page-select'),null);assert.equal(d.querySelectorAll('#sheet [hidden]').length,0);assert.equal(d.querySelectorAll('iframe').length,0);assert.equal(d.querySelectorAll('.drawing-page').length,1);allDomainsVisible(s);
 });
 await check('Embedded single SVG equals the standalone whole-board output, ignoring runtime zoom',()=>{
  const x=new JSDOM('<body>'+read('无人船_整板_原理图.svg')+'</body>');opened.push(x);const actual=svg('board').cloneNode(true);actual.removeAttribute('style');assert.equal(actual.outerHTML,x.window.document.querySelector('svg').outerHTML);assert.equal(actual.getAttribute('viewBox'),'0 0 7240 6720');assert.equal(source.sheets[0].width,7240);assert.equal(source.sheets[0].height,6720);
 });
 await check('IDs, panels and component references are unique and all panels are navigable',()=>{
  for(const values of [[...d.querySelectorAll('[id]')].map(e=>e.id),source.domains.map(s=>s.id),source.panels.map(p=>p.id),source.components.map(c=>c.ref)])assert.equal(values.length,new Set(values).size);
  assert.equal(source.panels.length,32);assert.equal(d.querySelectorAll('#svg-board [data-panel]').length,32);
  for(const p of source.panels){assert.equal(p.sheet,'board');assert.ok(svg(p.domain).querySelector('[id="'+p.id+'"]'));assert.ok(d.querySelector('.toc [data-module="'+p.id+'"]'));assert.ok(d.querySelector('#section option[value="'+p.id+'"]'));const group=svg(p.domain).querySelector('[data-panel="'+p.id+'"]');assert.ok(group);const t=/^translate\(([-.\d]+)[ ,]+([-.\d]+)\)$/.exec(group.getAttribute('transform'));assert.ok(t,p.id+' transform');const rect=group.querySelector('rect.panel');assert.equal(+rect.getAttribute('x')+Number(t[1]),p.x,p.id+' x');assert.equal(+rect.getAttribute('y')+Number(t[2]),p.y,p.id+' y');assert.equal(+rect.getAttribute('width'),p.w);assert.equal(+rect.getAttribute('height'),p.h);assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=7240&&p.y+p.h<=6720,p.id+' board bounds');}
  for(let i=0;i<source.panels.length;i++)for(const q of source.panels.slice(i+1)){const p=source.panels[i];assert.ok(Math.min(p.x+p.w,q.x+q.w)<=Math.max(p.x,q.x)||Math.min(p.y+p.h,q.y+q.h)<=Math.max(p.y,q.y),p.id+' overlaps '+q.id);}
  assert.equal(source.components.filter(c=>c.ref==='U701').length,1);assert.ok(!source.components.some(c=>/^U701[A-D]$/.test(c.ref)));
 });
 await check('F4 100 pins and P4 88 module pads preserve verified source numbering/names',()=>{
  assert.deepEqual(Object.keys(component('U1').pins).map(Number),Array.from({length:100},(_,i)=>i+1));assert.deepEqual(Object.keys(component('U701').pins).map(Number),Array.from({length:88},(_,i)=>i+1));
  assert.deepEqual(component('U1').pins,f4Source.components.find(c=>c.ref==='U1').pins);for(const p of p4Source.pins)assert.equal(pin('U701',p.pin).name,p.name);
  for(const p of [1,97,98])net('U1',p,null);net('U701',66,null);
 });
 await check('P4C5 is one four-sided symbol with all 88 visible pad names, numbers and unchanged networks',()=>{
  const module=svg('p4').querySelector('[data-panel="p4-module"]');assert.ok(module);assert.equal(module.querySelectorAll('rect.chip').length,1);assert.doesNotMatch(svg('p4').textContent,/U701[A-D]\b/);assert.equal(svg('p4').querySelectorAll('[id^="p4-unit-"]').length,0);
  const box=module.querySelector('rect.chip'),x=+box.getAttribute('x'),y=+box.getAttribute('y'),right=x+Number(box.getAttribute('width')),bottom=y+Number(box.getAttribute('height'));
  const groups=[...module.querySelectorAll('g[data-component="U701"][data-pad]')];assert.equal(groups.length,88);assert.deepEqual(groups.map(g=>+g.dataset.pad).sort((a,b)=>a-b),Array.from({length:88},(_,i)=>i+1));
  const sides={left:[],bottom:[],right:[],top:[]};
  for(const g of groups){
   const number=+g.dataset.pad,p=pin('U701',number),side=number<=22?'left':number<=44?'bottom':number<=66?'right':'top';assert.equal(g.dataset.side,side,number+' side');assert.equal(g.dataset.pinName,p.name,number+' name metadata');assert.ok([...g.querySelectorAll('text')].some(t=>t.textContent.trim()===p.name),number+' visible name');assert.ok([...g.querySelectorAll('text')].some(t=>t.textContent.trim()===String(number)),number+' visible number');
   const labels=[...g.querySelectorAll('[data-net]')];if(p.net===null){assert.equal(labels.length,0);assert.ok([...g.querySelectorAll('text')].some(t=>t.textContent.trim()==='NC'),number+' visible NC');}else{assert.equal(labels.length,1);assert.equal(labels[0].dataset.net,p.net);assert.equal(labels[0].textContent,p.net);assert.equal(labels[0].getAttribute('role'),'button');assert.equal(labels[0].getAttribute('tabindex'),'0');}
   const stem=g.querySelector('line.wire');assert.ok(stem,number+' pin stem');assert.ok(!g.hasAttribute('transform'),number+' uses absolute pin coordinates');const x1=+stem.getAttribute('x1'),x2=+stem.getAttribute('x2'),y1=+stem.getAttribute('y1'),y2=+stem.getAttribute('y2');for(const n of [x1,x2,y1,y2])assert.ok(Number.isFinite(n));
   if(side==='left'||side==='right'){assert.equal(y1,y2);assert.ok(y1>y&&y1<bottom);assert.equal(side==='left'?Math.max(x1,x2):Math.min(x1,x2),side==='left'?x:right);assert.ok(x1!==x2);sides[side].push({number,position:y1});}
   else{assert.equal(x1,x2);assert.ok(x1>x&&x1<right);assert.equal(side==='top'?Math.max(y1,y2):Math.min(y1,y2),side==='top'?y:bottom);assert.ok(y1!==y2);sides[side].push({number,position:x1});}
  }
  for(const [side,pads]of Object.entries(sides)){assert.equal(pads.length,22);pads.sort((a,b)=>a.number-b.number);const sign=['left','bottom'].includes(side)?1:-1;for(let i=1;i<pads.length;i++)assert.ok((pads[i].position-pads[i-1].position)*sign>0,side+' physical pad order');}
 });
 await check('Endpoint table exactly reconstructs from component pins and excludes every NC',()=>{
  const reconstructed={},ends=Object.values(source.nets).flat();
  for(const c of source.components){assert.equal(c.sheet,'board');assert.ok(source.domains.some(s=>s.id===c.domain));for(const [p,v]of Object.entries(c.pins)){assert.equal(typeof v.name,'string',`${c.ref}.${p}`);if(v.net===null){assert.ok(!ends.some(e=>e.ref===c.ref&&e.pin===p));continue;}assert.equal(typeof v.net,'string');assert.ok(v.net&&!['null','undefined','[object Object]','NC'].includes(v.net));(reconstructed[v.net]??=[]).push({ref:c.ref,pin:p,name:v.name,kind:c.kind,sheet:c.sheet,domain:c.domain});}}
  assert.deepEqual(reconstructed,source.nets);for(const [n,e]of Object.entries(source.nets))assert.equal(new Set(e.map(p=>p.ref+'.'+p.pin)).size,e.length,n);
 });
 await check('Rendered networks/wires resolve to their domains and NC counts match every pin',()=>{
  for(const domain of source.domains){const v=svg(domain.id),cs=source.components.filter(c=>c.domain===domain.id),expected=new Set(cs.flatMap(c=>Object.values(c.pins).map(p=>p.net)).filter(n=>n!==null)),actual=new Set([...v.querySelectorAll('[data-net]')].map(e=>e.dataset.net));for(const n of expected)assert.ok(actual.has(n),domain.id+' missing '+n);
   for(const e of v.querySelectorAll('[data-net],[data-wire]')){const n=e.dataset.net||e.dataset.wire;assert.ok(source.nets[n]?.some(p=>p.domain===domain.id),domain.id+' unknown '+n);if(e.dataset.net){assert.ok(source.panels.some(p=>p.domain===domain.id&&p.title===e.dataset.area));assert.ok(e.closest('[data-panel]'));}}
   assert.equal([...v.querySelectorAll('text')].filter(t=>t.textContent.trim()==='NC').length,cs.flatMap(c=>Object.values(c.pins)).filter(p=>p.net===null).length,domain.id+' NC count');}
 });
 await check('CAN uses separate MCU-side TX/RX and shared cross-region H/L with USB-CAN port',()=>{
  for(const [r,p,n]of [['U1',82,'CAN_TX'],['U1',81,'CAN_RX'],['U2',1,'CAN_TX'],['U2',4,'CAN_RX'],['U701',29,'P4_CAN_TX'],['U701',30,'P4_CAN_RX'],['U702',1,'P4_CAN_TX'],['U702',4,'P4_CAN_RX']])net(r,p,n);
  for(const r of ['U2','U702']){net(r,7,'CAN_H');net(r,6,'CAN_L');net(r,5,null);}net('J201',1,'CAN_H');net('J201',2,'CAN_L');net('J201',3,'GND');
  for(const n of ['CAN_H','CAN_L'])assert.deepEqual([...new Set(source.nets[n].map(e=>e.domain))].sort(),['f4','p4']);pair('R712','CAN_H','CAN_L');dnp('R712');assert.ok(!source.nets.CAN_TX.some(e=>e.ref==='U701'));assert.ok(!source.nets.P4_CAN_TX.some(e=>e.ref==='U1'));
 });
 await check('Three independent RS485 buses preserve BMS/ultrasonic/tether ownership and five sensor taps',()=>{
  const buses=[{ref:'U3',p:'BMS',de:'RS485_DE',mcu:'U1',pins:[25,26,85],ports:['J211']},{ref:'U4',p:'USONIC',de:'USONIC_DE',mcu:'U1',pins:[55,56,57],ports:['J510','J511','J512','J513','J514']},{ref:'U601',p:'TETHER',de:'TETHER_DE',mcu:'U701',pins:[55,56,57],ports:['J602']}];
  assert.equal(new Set(buses.flatMap(b=>[b.p+'_A',b.p+'_B'])).size,6);
  for(const b of buses){for(const [p,n]of [[1,b.p+'_RX'],[2,b.de],[3,b.de],[4,b.p+'_TX'],[5,'GND'],[6,b.p+'_A'],[7,b.p+'_B'],[8,'+3V3']])net(b.ref,p,n);net(b.mcu,b.pins[0],b.p+'_TX');net(b.mcu,b.pins[1],b.p+'_RX');net(b.mcu,b.pins[2],b.de);
   for(const r of b.ports){net(r,1,b.p+'_A');net(r,2,b.p+'_B');net(r,3,'GND');assert.equal(Object.keys(component(r).pins).length,3);}for(const other of buses.filter(o=>o!==b))for(const suffix of ['_A','_B'])assert.ok(!source.nets[b.p+suffix].some(e=>e.ref===other.ref));}
  pair('R601','TETHER_DE','GND');pair('R602','TETHER_A','TETHER_B');dnp('R602');
 });
 await check('Actual IMU P1 maps PB6/PB7 through removable power and bus-isolation jumpers',()=>{
  assert.equal(component('J601').domain,'interfaces');assert.equal(Object.keys(component('J601').pins).length,8);for(const [p,n]of [[1,null],[2,null],[3,'GND'],[4,'IMU_5V'],[5,'GND'],[6,'IMU_SDA_MOD'],[7,'IMU_SCL_MOD'],[8,null]])net('J601',p,n);
  net('U1',92,'IMU_SCL');net('U1',93,'IMU_SDA');pair('JP601','+5V','IMU_5V');pair('JP602','IMU_SCL','IMU_SCL_MOD');pair('JP603','IMU_SDA','IMU_SDA_MOD');for(const r of ['JP601','JP602','JP603'])assert.match(component(r).assembly,/可拔/);
  for(const n of ['IMU_SCL','IMU_SDA']){assert.ok(!source.nets[n].some(e=>e.ref==='J601'));assert.deepEqual([...new Set(source.nets[n].map(e=>e.domain))].sort(),['f4','interfaces']);}assert.ok(!Object.keys(source.nets).some(n=>/MPU_INT|IST_DRDY|IST_RSTN/.test(n)));assert.match(svg('interfaces').textContent,/断开三个跳帽/);
 });
 await check('SD supply, six signals and card-detect are DNP-separated; pad66 stays NC',()=>{
  ['SD_D0','SD_D1','SD_D2','SD_D3','SD_CLK','SD_CMD'].forEach((n,i)=>{pair('R'+(801+i),n,n+'_CARD');dnp('R'+(801+i));net('U701',67+i,n);assert.ok(!source.nets[n].some(e=>e.ref==='J801'));});
  pair('R807','+3V3','SD_3V3');dnp('R807');pair('R840','SD_CD_N','SD_CD_CARD');dnp('R840');net('U701',73,'SD_CD_N');net('J801',4,'SD_3V3');net('J801',6,'GND');net('J801','CD1','SD_CD_CARD');net('J801','CD2','GND');net('U701',66,null);assert.ok(!Object.keys(source.nets).includes('ESP_LDO_VO4'));
  for(const [r,a,b]of [['R837','CSI_XCLK','CSI_XCLK_CAM'],['R838','DVP_D5','DVP_D5_CAM'],['R839','DVP_D6','DVP_D6_CAM']]){pair(r,a,b);dnp(r);}
 });
 await check('Five PWM and LED are F4 outputs; pump is P4; connectors carry control not motor power',()=>{
  net('J401',1,'+5V');net('J401',2,'GND');assert.equal(Object.keys(component('J401').pins).length,7);
  for(let i=1;i<=5;i++){net('U1',[40,42,44,45,4][i-1],'PWM'+i);pair('R'+(400+i),'PWM'+i,'PWM'+i+'_OUT');net('J401',i+2,'PWM'+i+'_OUT');assert.match(component('R'+(400+i)).value,/100Ω/);}
  for(const r of ['J402','J403','J404','J405'])assert.ok(!byRef.has(r));
  for(let i=1;i<=2;i++){const n='SERVO'+i;net('U1',30+i,n);pair('R'+(406+i),n,n+'_OUT');pair('R'+(408+i),n+'_OUT','GND');pair('C'+(406+i),'+5V_SERVO','GND');const r='J'+(406+i);net(r,1,'+5V_SERVO');net(r,2,'GND');net(r,3,n+'_OUT');assert.equal(Object.keys(component(r).pins).length,3);assert.match(component('R'+(406+i)).value,/100Ω/);assert.match(component('R'+(408+i)).value,/100k/);}
  net('U1',95,'LED_PWM');pair('R406','LED_PWM','LED_PWM_OUT');net('J406',1,'LED_PWM_OUT');net('J406',2,'GND');net('U701',58,'PUMP_EN');pair('R621','PUMP_EN','PUMP_CTRL_OUT');pair('R622','PUMP_CTRL_OUT','GND');net('J603',1,'PUMP_CTRL_OUT');net('J603',2,'GND');
  assert.ok(!Object.values(component('U701').pins).some(p=>/^PWM\d|LED_PWM/.test(p.net||'')));assert.ok(!Object.values(component('U1').pins).some(p=>/^PUMP_/.test(p.net||'')));assert.ok(!source.components.some(c=>/L298N/i.test(c.value)));
 });
 await check('USB camera uses dedicated HS pads, controlled VBUS, 10uF bypass and virtual CSI/DVP ports',()=>{
  for(const [p,n]of [[48,'USB_HS_DM'],[49,'USB_HS_DP'],[17,'USB_OC_N'],[18,'USB_VBUS_EN']])net('U701',p,n);for(const [p,n]of [[1,'USB_VBUS'],[2,'GND'],[3,'USB_OC_N'],[4,'USB_VBUS_EN'],[5,'+5V']])net('U801',p,n);
  pair('R811','USB_VBUS_EN','GND');pair('R812','+3V3','USB_OC_N');pair('C813','USB_VBUS','GND');assert.match(component('C813').value,/10µF/);for(const r of ['P_CSI','P_DVP']){assert.equal(component(r).kind,'page-port');assert.match(component(r).note,/逻辑|不定义/);}assert.ok(!source.nets.USB_DBG_DM.some(e=>e.ref==='J802'));assert.ok(!source.nets.USB_DBG_DP.some(e=>e.ref==='J802'));
 });
 await check('Camera expander unused inputs have four 100k pulls and mux has reset/separate channels',()=>{
  for(const p of [1,2,3])net('U802',p,'GND');net('U802',14,'CAM_SCL');net('U802',15,'CAM_SDA');net('U802',13,null);for(let i=4;i<=7;i++){net('U802',i+5,'EXP_UNUSED'+i);pair('R'+(847+i),'EXP_UNUSED'+i,'GND');assert.match(component('R'+(847+i)).value,/100k/);}
  net('U803',1,'GND');net('U803',2,'GND');net('U803',3,'P4_EN');net('U803',4,'+3V3');net('U803',8,'+3V3');net('U803',11,null);assert.notEqual(pin('U803',5).net,pin('U803',9).net);assert.notEqual(pin('U803',6).net,pin('U803',10).net);
 });
 await check('One protected battery input feeds a switched, scaled ADC channel',()=>{
  pair('F901','BAT_IN','BAT_FUSED');net('J901',1,'BAT_IN');net('D901','A','BAT_FUSED');net('D901','K','BAT_SENSE_PROTECTED');net('U901',2,'BAT_SENSE_PROTECTED');for(const p of [10,11,12])net('U902',p,'+5V');net('U902',14,'+3V3');for(const p of [84,85,86])net('U701',p,'+3V3');
  for(const r of ['U1','U701'])assert.ok(!Object.values(component(r).pins).some(p=>['BAT_IN','BAT_SENSE_PROTECTED','+5V'].includes(p.net)));
  pair('R301','BAT_SENSE_PROTECTED','BAT_DIV_HI');pair('R307','BAT_DIV_HI','BAT_DIV');pair('R302','BAT_DIV','GND');pair('C301','BAT_DIV','GND');
  for(const [p,n] of [[14,'+3V3'],[7,'GND'],[1,'BAT_SENSE_EN'],[2,'BAT_DIV'],[3,'BAT_SW']])net('U301',p,n);
  for(const [p,n] of [[1,'GND'],[2,'BAT_SENSE_EN'],[3,'+3V3']])net('U303',p,n);
  pair('R303','BAT_SW','BAT_ADC_LINK');pair('R304','BAT_ADC_LINK','BAT_ADC');pair('R305','BAT_ADC','GND');pair('R306','BAT_SENSE_EN','GND');pair('C303','+3V3','GND');pair('C304','+3V3','GND');net('U1',15,'BAT_ADC');net('P_BAT_ADC',1,'BAT_ADC');net('TP301',1,'BAT_ADC');
  assert.equal(component('R304').value,'0Ω');assert.equal(component('R304').assembly,'候选，未冻结');assert.equal(component('U301').domain,'battery');assert.ok(!byRef.has('U302'));
  const upper=49.9e3+49.9e3,lower=1/(1/10e3+1/101e3),gain=(upper+lower)/lower*101/100;
  assert.ok(Math.abs(gain-12.0878)<1e-4);assert.ok(30/gain<3.3);assert.ok(30*10/(99.8+10)<3.6);
  assert.match(svg('battery').textContent,/串数\/容量\/曲线由配置选择/);assert.match(svg('battery').textContent,/0–30V/);
 });
 await check('Both independent SCT2650 candidate bucks match the verified pin table and reference networks',()=>{
  for(const b of [{u:'U901',pre:'BUCK5',out:'+5V',l:'L901',diode:'D903',rt:'R903',upper:'R905',lower:'R906',comp:'R904',cin:'C902',hf:'C903',boot:'C904',cout:['C905','C906','C913','C914'],rc:'C907',cp:'C908'},{u:'U903',pre:'SERVO5',out:'+5V_SERVO',l:'L903',diode:'D904',rt:'R921',upper:'R922',lower:'R923',comp:'R924',cin:'C921',hf:'C922',boot:'C923',cout:['C924','C925','C926','C927'],rc:'C928',cp:'C929'}]){
   const n=s=>b.pre+'_'+s;assert.match(component(b.u).value,/SCT2650STER/);assert.equal(Object.keys(component(b.u).pins).length,9);
   for(const [p,name,network]of [[1,'BOOT',n('BOOT')],[2,'VIN','BAT_SENSE_PROTECTED'],[3,'EN','BAT_SENSE_PROTECTED'],[4,'RT/CLK',n('RT')],[5,'FB',n('FB')],[6,'COMP',n('COMP')],[7,'GND','GND'],[8,'SW',n('SW')],[9,'EP','GND']]){net(b.u,p,network);assert.equal(pin(b.u,p).name,name);}
   for(const [r,a,z,value]of [[b.rt,n('RT'),'GND','200k'],[b.upper,b.out,n('FB'),'53.6k'],[b.lower,n('FB'),'GND','10.2k'],[b.comp,n('COMP'),n('COMP_RC'),'33.2k'],[b.l,n('SW'),b.out,'7.8µH'],[b.cin,'BAT_SENSE_PROTECTED','GND','10µF / 63V'],[b.hf,'BAT_SENSE_PROTECTED','GND','100nF / 63V'],[b.boot,n('BOOT'),n('SW'),'100nF'],[b.rc,n('COMP_RC'),'GND','3.3nF'],[b.cp,n('COMP'),'GND','22pF']]){pair(r,a,z);assert.ok(component(r).value.includes(value),r+' value');}
   for(const r of b.cout){pair(r,b.out,'GND');assert.equal(component(r).value,'47µF / 10V');}dnp(b.cp);net(b.diode,'A','GND');net(b.diode,'K',n('SW'));assert.equal(component(b.diode).value,'B560C-13-F');
  }
  net('TP906',1,'+5V_SERVO');assert.ok(!source.nets['+5V_SERVO'].some(e=>['U902','J401','U1','U701'].includes(e.ref)));assert.ok(!source.nets['+5V'].some(e=>['J407','J408'].includes(e.ref)));
 });
 await check('Domain navigation only zooms and pans the continuous board, preserving all six regions',()=>{
  for(const domain of source.domains){const id='s-'+domain.id,select=d.getElementById('section');select.value=id;event(s,select,'change');allDomainsVisible(s);assert.equal(select.value,id);assert.equal(new URL(s.w.location.href).searchParams.get('module'),id);assert.equal(d.querySelector('.toc [aria-current="location"]').dataset.module,id);const scale=Math.min(1.4,(1200-45)/domain.w,(800-40)/domain.h);assert.ok(Math.abs(parseFloat(svg('board').style.width)-7240*scale)<.01);const last=s.scrolls.at(-1)[0];assert.ok(Math.abs(last.left-Math.max(0,(domain.x+domain.w/2)*scale-1200/2+12))<.01);assert.ok(Math.abs(last.top-Math.max(0,(domain.y+domain.h/2)*scale-800/2+12))<.01);}
 });
 await check('Every sidebar module pans to its global coordinates and updates URL/dropdown/active state',()=>{
  for(const p of source.panels){click(s,d.querySelector('.toc [data-module="'+p.id+'"]'));allDomainsVisible(s);assert.equal(d.getElementById('section').value,p.id);assert.equal(new URL(s.w.location.href).searchParams.get('module'),p.id);assert.equal(d.querySelector('.toc [aria-current="location"]').dataset.module,p.id);const scale=Math.min(1.4,(1200-45)/p.w,(800-40)/p.h),last=s.scrolls.at(-1)[0];assert.ok(Math.abs(parseFloat(svg('board').style.width)-7240*scale)<.01,p.id+' zoom');assert.ok(Math.abs(last.left-Math.max(0,(p.x+p.w/2)*scale-600+12))<.01,p.id+' left');assert.ok(Math.abs(last.top-Math.max(0,(p.y+p.h/2)*scale-400+12))<.01,p.id+' top');}assert.ok(s.scrolls.some(a=>typeof a[0]==='object'&&Number.isFinite(a[0].left)&&Number.isFinite(a[0].top)));
 });
 await check('Location dropdown and zoom controls operate on one board with predictable limits and fit reset',()=>{
  for(const id of ['p4-can','imu-module','sd','bms']){d.getElementById('section').value=id;event(s,d.getElementById('section'),'change');allDomainsVisible(s);assert.equal(d.getElementById('page-select'),null);}
  const v=svg('board'),before=parseFloat(v.style.width);d.getElementById('plus').click();assert.ok(parseFloat(v.style.width)>before);d.getElementById('minus').click();assert.ok(Math.abs(parseFloat(v.style.width)-before)<.01);for(let i=0;i<30;i++)d.getElementById('minus').click();assert.equal(parseFloat(v.style.width),181);for(let i=0;i<30;i++)d.getElementById('plus').click();assert.equal(parseFloat(v.style.width),28960);d.getElementById('fit').click();assert.equal(d.getElementById('section').value,'');assert.equal(new URL(s.w.location.href).searchParams.has('module'),false);assert.ok(Math.abs(parseFloat(v.style.width)-7240*Math.min(1168/7240,768/6720))<.01);assert.deepEqual(s.scrolls.at(-1),[0,0]);allDomainsVisible(s);
 });
 await check('Ctrl/Meta wheel zooms around the cursor while ordinary wheel remains native',()=>{
  const view=d.getElementById('view'),v=svg('board');d.getElementById('fit').click();view.scrollLeft=120;view.scrollTop=80;
  for(const key of ['ctrlKey','metaKey']){const prior=parseFloat(v.style.width)/7240,left=view.scrollLeft,top=view.scrollTop,e=new s.w.WheelEvent('wheel',{bubbles:true,cancelable:true,[key]:true,deltaY:-75,clientX:325,clientY:245});view.dispatchEvent(e);assert.ok(e.defaultPrevented);const scale=parseFloat(v.style.width)/7240;assert.ok(Math.abs((scale-prior*Math.exp(.15))*7240)<.01);assert.ok(Math.abs(view.scrollLeft-((left+325-12)*Math.exp(.15)-325+12))<1e-7);assert.ok(Math.abs(view.scrollTop-((top+245-12)*Math.exp(.15)-245+12))<1e-7);allDomainsVisible(s);}
  const before=v.style.width,count=s.scrolls.length,e=new s.w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});view.dispatchEvent(e);assert.equal(e.defaultPrevented,false);assert.equal(v.style.width,before);assert.equal(s.scrolls.length,count);
 });
 await check('Blank-area pointer dragging pans only the active pointer and stops on release/cancel',()=>{
  const view=d.getElementById('view'),dispatch=(target,type,x,y,id=4,button=0)=>{const e=new s.w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button});Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);};view.scrollLeft=500;view.scrollTop=600;
  dispatch(view,'pointerdown',300,200);assert.ok(view.classList.contains('panning'));let count=s.scrolls.length;dispatch(view,'pointermove',280,170,5);assert.equal(s.scrolls.length,count);dispatch(view,'pointermove',280,170);assert.equal(view.scrollLeft,520);assert.equal(view.scrollTop,630);dispatch(view,'pointerup',280,170);assert.ok(!view.classList.contains('panning'));count=s.scrolls.length;dispatch(view,'pointermove',250,150);assert.equal(s.scrolls.length,count);
  dispatch(label('CAN_H','f4'),'pointerdown',300,200);assert.ok(!view.classList.contains('panning'));dispatch(view,'pointermove',280,170);assert.equal(s.scrolls.length,count);dispatch(view,'pointerdown',300,200,4,2);assert.ok(!view.classList.contains('panning'));
  for(const stop of ['pointercancel','lostpointercapture']){dispatch(view,'pointerdown',300,200);assert.ok(view.classList.contains('panning'));dispatch(view,stop,300,200);assert.ok(!view.classList.contains('panning'));count=s.scrolls.length;dispatch(view,'pointermove',280,170);assert.equal(s.scrolls.length,count);}allDomainsVisible(s);
 });
 await check('CAN highlight crosses functional regions and endpoint dialog pans to P4 transceiver',()=>{
  click(s,label('CAN_H','f4'));for(const e of d.querySelectorAll('[data-net],[data-wire]'))assert.equal(e.classList.contains('selected'),(e.dataset.net||e.dataset.wire)==='CAN_H');assert.match(d.getElementById('status').textContent,/2区域/);
  label('CAN_H','f4').dispatchEvent(new s.w.MouseEvent('dblclick',{bubbles:true}));assert.ok(d.getElementById('net-dialog').open);assert.equal(d.getElementById('net-name').textContent,'CAN_H');assert.match(d.getElementById('endpoints').textContent,/U2\.7/);assert.match(d.getElementById('endpoints').textContent,/U702\.7/);
  const target=[...d.querySelectorAll('#locations button')].find(e=>e.textContent.includes('03 ESP32')&&e.textContent.includes('TWAI'));assert.ok(target);target.click();assert.ok(!d.getElementById('net-dialog').open);allDomainsVisible(s);assert.equal(d.getElementById('section').value,'p4-can');assert.equal(new URL(s.w.location.href).searchParams.get('module'),'p4-can');assert.ok(label('CAN_H','p4').classList.contains('selected'));d.getElementById('clear').click();assert.equal(d.querySelectorAll('#sheet .selected').length,0);
 });
 await check('Enter/Space dialogs list exact AIS/LED/IMU endpoints and close correctly',()=>{
  for(const [n,key]of [['AIS_RX','Enter'],['LED_PWM',' '],['IMU_SDA','Enter']]){label(n,'f4').dispatchEvent(new s.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));assert.ok(d.getElementById('net-dialog').open);assert.equal(d.getElementById('net-name').textContent,n);for(const e of source.nets[n])assert.ok(d.getElementById('endpoints').textContent.includes(e.ref+'.'+e.pin+' '));d.getElementById('close-net').click();assert.ok(!d.getElementById('net-dialog').open);}
 });
 await check('Source dialog preserves boundaries and query deep-links pan to modules or regions',()=>{
  d.getElementById('source-btn').click();assert.ok(d.getElementById('source-dialog').open);for(const pattern of [/P4C5/,/V1\.4/,/纯\s*P4/,/待确认|待核/,/IMU/,/DNP/])assert.match(d.getElementById('source-dialog').textContent,pattern);assert.doesNotMatch(d.getElementById('source-dialog').textContent,/用户称P4C3/);d.getElementById('close-source').click();assert.ok(!d.getElementById('source-dialog').open);
  for(const query of ['imu-module','s-camera','not-a-panel']){const q=setup('原理图设计.html','?module='+query+'#schematic');allDomainsVisible(q);const expected=query==='not-a-panel'?'p4-module':query;assert.equal(q.d.getElementById('section').value,expected);assert.equal(q.d.querySelector('.toc [aria-current="location"]').dataset.module,expected);if(query==='not-a-panel')assert.equal(q.d.getElementById('zoom-input').value,'75');assert.deepEqual(q.errors,[]);}
 });
 await check('All four legacy P4-unit deep links resolve to the single P4C5 module and preserve the full board',()=>{
  for(let i=0;i<4;i++){const q=setup('原理图设计.html','?module=p4-unit-'+i+'#schematic');allDomainsVisible(q);assert.equal(q.d.getElementById('section').value,'p4-module');assert.equal(q.d.querySelector('.toc [aria-current="location"]').dataset.module,'p4-module');assert.equal(new URL(q.w.location.href).searchParams.get('module'),'p4-module');assert.deepEqual(q.errors,[]);}
 });
 await check('BOM download contains each physical part once, correct DNP state, and no virtual ports',async()=>{
  d.getElementById('bom').click();const file=s.downloads.at(-1);assert.equal(file.name,'无人船_整板_RevF_BOM.csv');assert.equal(file.blob.type,'text/csv;charset=utf-8');const rows=csvParse(await blobText(s.w,file.blob));assert.deepEqual(rows[0],['功能区域','位号','型号/数值','封装','装配状态','备注']);const body=rows.slice(1),physical=source.components.filter(c=>c.kind==='physical');assert.equal(body.length,physical.length);assert.equal(new Set(body.map(r=>r[1])).size,physical.length);for(const c of physical)assert.deepEqual(body.find(r=>r[1]===c.ref),[c.domain,c.ref,c.value,c.footprint,c.assembly,c.note]);assert.ok(!body.some(r=>['P_CSI','P_DVP','P_IMU','P_AIS'].includes(r[1])));assert.equal(body.find(r=>r[1]==='R807')[4],'默认不装');
 });
 await check('JSON export round-trips and whole-board SVG export keeps all regions without live zoom/highlight',async()=>{
  d.getElementById('netlist').click();let file=s.downloads.at(-1);assert.equal(file.name,'无人船_整板_原理图连接表.json');assert.deepEqual(JSON.parse(await blobText(s.w,file.blob)),source);
  d.getElementById('section').value='p4-can';event(s,d.getElementById('section'),'change');click(s,label('CAN_H','p4'));d.getElementById('svg-download').click();file=s.downloads.at(-1);assert.equal(file.name,'无人船_整板_原理图.svg');const xml=new JSDOM(await blobText(s.w,file.blob),{contentType:'image/svg+xml'});opened.push(xml);assert.equal(xml.window.document.documentElement.id,'svg-board');assert.equal(xml.window.document.documentElement.getAttribute('viewBox'),'0 0 7240 6720');assert.ok(!xml.window.document.documentElement.hasAttribute('style'));assert.equal(xml.window.document.querySelectorAll('.selected').length,0);assert.equal(xml.window.document.querySelectorAll('svg > [data-domain]').length,6);assert.equal(xml.window.document.querySelectorAll('[data-panel]').length,32);assert.ok(xml.window.document.querySelector('[data-net="CAN_H"]'));allDomainsVisible(s);
 });
 await check('Print action uses a single large sheet with no forced region page breaks',()=>{
  d.getElementById('print').click();assert.equal(s.prints,1);const css=d.getElementById('whole-board-styles').textContent;assert.match(css,/@media print/);assert.match(css,/@page\{size:1189mm 1104mm;margin:0\}/);assert.match(css,/\.drawing-page\{[^}]*width:1189mm[^}]*break-inside:avoid[^}]*page-break-inside:avoid/);assert.match(css,/\.schematic-page \.circuit\{width:1189mm!important/);assert.doesNotMatch(css,/break-after:page|size:A3/);allDomainsVisible(s);
 });
 await check('Editable PCB still matches SVG and AIS label save/cancel works only in memory',()=>{
  const b=setup('无人船统一控制板可编辑版.html'),x=new JSDOM(read('无人船统一控制板示意图.svg'),{contentType:'image/svg+xml'});opened.push(x);assert.equal(b.d.querySelector('svg').textContent.replace(/\s+/g,' ').trim(),x.window.document.documentElement.textContent.replace(/\s+/g,' ').trim());b.d.getElementById('edit').click();const l=[...b.d.querySelectorAll('[data-edit]')].find(e=>e.textContent.includes('AIS'));assert.ok(l);const original=l.textContent;
  click(b,l);assert.ok(b.d.getElementById('editor').open);b.d.getElementById('label-input').value='TEST AIS';b.d.getElementById('editor').close('save');assert.equal(l.textContent,'TEST AIS');click(b,l);b.d.getElementById('label-input').value='CANCELLED AIS';b.d.getElementById('editor').close('cancel');assert.equal(l.textContent,'TEST AIS');click(b,l);b.d.getElementById('label-input').value=original;b.d.getElementById('editor').close('save');assert.equal(l.textContent,original);assert.deepEqual(b.errors,[]);
 });
 await check('No runtime jsdom/window errors during all interactions',()=>assert.deepEqual(s.errors,[]));
 const report={method:'jsdom and standalone single SVG/connection consistency; no browser/network; not EDA ERC/DRC',generatedAt:new Date().toISOString(),counts:{sheets:source.sheets.length,domains:source.domains.length,panels:source.panels.length,components:source.components.length,physical:source.components.filter(c=>c.kind==='physical').length,nets:Object.keys(source.nets).length,f4Pins:Object.keys(component('U1').pins).length,p4Pads:Object.keys(component('U701').pins).length},passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(path.join(__dirname,'../reports/design-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{for(const dom of opened)dom.window.close();});
