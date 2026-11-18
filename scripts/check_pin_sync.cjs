// Exercise the owned page script in a DOM emulator; no browser or network.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname,'../design');
const virtualConsole = new VirtualConsole();
const errors = [];
virtualConsole.on('jsdomError',error => errors.push(error.message));
const dom = new JSDOM(fs.readFileSync(path.join(root,'无人船统一主板方案.html'),'utf8'), {
  runScripts:'outside-only', virtualConsole
});
const {window} = dom;
const {document} = window;
const data = JSON.parse(document.getElementById('mcu-data').textContent);
let lastScrolled = null;
window.Element.prototype.scrollIntoView = function () { lastScrolled = this; };
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
Object.defineProperty(document.getElementById('enlarged-view'),'clientWidth',{value:1100});
for (const script of document.querySelectorAll('script:not([src])')) {
  if (script.type !== 'application/json') window.eval(script.textContent);
}
const $ = selector => { const el = document.querySelector(selector); assert.ok(el,selector); return el; };
const view = key => $('[data-diagram="'+key+'"]');
const pin = (key,number) => view(key).querySelector('[data-pin="'+number+'"]');
const click = element => element.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
const keypress = (element,key) => element.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
const checkSelected = (key,number) => {
  for (const suffix of ['', '-def']) {
    const container = view(key+suffix);
    assert.deepEqual([...container.querySelectorAll('.selected')].map(p=>Number(p.dataset.pin)),[number]);
    assert.equal(pin(key+suffix,number).getAttribute('aria-pressed'),'true');
  }
  document.querySelectorAll('[data-readout="'+key+'"]').forEach(el=>assert.ok(el.textContent.includes('#'+number+' ')));
};
const checkIds = () => {
  const ids = [...document.querySelectorAll('[id]')].map(el=>el.id);
  assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
};
const filter = value => { const select = $('#pin-filter'); select.value=value; select.dispatchEvent(new window.Event('change')); };
const checkFilter = () => document.querySelectorAll('.pin-hit').forEach(el=>assert.equal(el.classList.contains('dimmed'),el.dataset.group!=='can'));
const results = [];
const test = (name,fn) => { fn(); results.push(name); };

test('188 physical pins match the JSON in both paired views',()=>{
  for (const [key,count] of [['f4',100],['p4',88]]) {
    const source=JSON.parse(fs.readFileSync(path.join(root,key==='f4'?'STM32F407引脚配置数据.json':'ESP32P4C5引脚配置数据.json'),'utf8'));
    assert.deepEqual(data[key].pins,source.pins);
    assert.deepEqual(data[key].routes,source.routes);
    for (const suffix of ['','-def']) {
      const pins=[...view(key+suffix).querySelectorAll('.pin-hit')];
      assert.equal(pins.length,count);
      assert.equal(new Set(pins.map(p=>p.dataset.pin)).size,count);
      for (const p of pins) {
        const expected=data[key].definitionPins.find(row=>row.pin===Number(p.dataset.pin));
        assert.equal(p.dataset.group,expected.group);
      }
    }
  }
  assert.equal(document.querySelectorAll('iframe').length,0);
  checkIds();
});
test('Locate works before a pin is selected',()=>{
  click($('[data-locate="f4-def"]'));
  assert.equal(lastScrolled,view('f4-def'));
});
test('Upper text click selects the lower counterpart and CAN peers',()=>{
  click(pin('f4',81).querySelector('text'));
  checkSelected('f4',81);
  assert.ok(pin('f4',82).classList.contains('peer'));
  assert.ok(pin('f4-def',82).classList.contains('peer'));
  assert.ok(!pin('f4',87).classList.contains('peer'));
});
test('Lower text click selects upper counterpart',()=>{
  click(pin('f4-def',40).querySelector('text'));
  checkSelected('f4',40);
  assert.ok(pin('f4',4).classList.contains('peer'));
});
test('Enter and Space work in both directions',()=>{
  keypress(pin('f4-def',92),'Enter'); checkSelected('f4',92);
  keypress(pin('p4',18),' '); checkSelected('p4',18);
  assert.equal(pin('p4',17).dataset.group,'uvc');
});
test('Same-number pins remain isolated by MCU',()=>{
  click(pin('f4-def',48)); checkSelected('f4',48);
  click(pin('p4-def',48)); checkSelected('p4',48); checkSelected('f4',48);
  click(pin('p4',49)); checkSelected('p4',49); checkSelected('f4',48);
});
test('USB camera, download and CSI are distinct groups',()=>{
  assert.ok(pin('p4-def',48).classList.contains('peer'));
  assert.ok(!pin('p4-def',50).classList.contains('peer'));
  assert.equal(pin('p4',50).dataset.group,'usb');
  click(pin('p4-def',41)); checkSelected('p4',41);
  for (const number of [42,43,44,45,46]) assert.ok(pin('p4',number).classList.contains('peer'));
  assert.ok(!pin('p4',49).classList.contains('peer'));
});
test('NC and supply selections retain their constraints',()=>{
  click(pin('f4-def',87)); checkSelected('f4',87);
  assert.equal(view('f4').querySelectorAll('.peer').length,0);
  assert.equal(view('f4-def').querySelectorAll('.peer').length,0);
  click(pin('f4-def',49)); checkSelected('f4',49);
  assert.match($('#f4-definition-note').textContent,/VCAP|输出|2.2/);
  click(pin('p4-def',66)); checkSelected('p4',66);
  assert.match($('#p4-definition-note').textContent,/确认|核对|冲突|差异/);
});
test('CAN filter and enlarged definition inherit all states',()=>{
  filter('can'); checkFilter();
  click($('[data-enlarge="f4-def"]'));
  assert.ok($('#diagram-dialog').open);
  assert.ok(document.body.classList.contains('diagram-open'));
  checkIds(); checkFilter();
  assert.equal($('#enlarged-view .selected').dataset.pin,'49');
  click($('#enlarged-view [data-pin="81"] text'));
  checkSelected('f4',81);
  assert.equal($('#enlarged-view .selected').dataset.pin,'81');
  assert.match($('#modal-readout').textContent,/#81 PD0/);
  filter('all');
  assert.equal(document.querySelectorAll('.dimmed').length,0);
  click($('#dialog-close'));
  assert.ok(!$('#diagram-dialog').open);
  assert.equal($('#enlarged-view').children.length,0);
  assert.ok(!document.body.classList.contains('diagram-open'));
});
test('All four MCU modal variants synchronize selection',()=>{
  for (const [source,number] of [['f4',82],['f4-def',81],['p4',29],['p4-def',30]]) {
    click($('[data-enlarge="'+source+'"]')); checkIds();
    keypress($('#enlarged-view [data-pin="'+number+'"]'),'Enter');
    checkSelected(source.startsWith('f4')?'f4':'p4',number);
    assert.equal($('#enlarged-view .selected').dataset.pin,String(number));
    filter('can'); checkFilter(); filter('all');
    click($('#zoom-in')); assert.ok(parseInt($('#zoom-value').textContent)>80);
    click($('#zoom-out')); click($('#zoom-fit'));
    click($('#dialog-close'));
  }
});
test('PCB enlargement has no duplicate SVG IDs',()=>{
  click($('[data-enlarge="board"]')); checkIds();
  assert.equal($('#enlarged-view').querySelectorAll('[data-mcu]').length,0);
  click($('#dialog-close'));
});
test('Locate scrolls to the selected counterpart in both directions',()=>{
  for (const target of ['f4','f4-def','p4','p4-def']) {
    click($('[data-locate="'+target+'"]'));
    const number=target.startsWith('f4')?81:30;
    assert.equal(lastScrolled,pin(target,number));
  }
});
test('New peripheral assignments preserve LED and allocate distinct pads',()=>{
  const routes=key=>data[key].routes;
  const group=(key,name)=>routes(key).filter(r=>r.group===name);
  assert.deepEqual(group('f4','ais').map(r=>[r.gpio,r.pin,r.signal,r.af]),[
    ['PC12',80,'UART5_TX','AF8'],['PD2',83,'UART5_RX','AF8']
  ]);
  assert.deepEqual(group('f4','light').map(r=>[r.gpio,r.pin,r.signal,r.af]),[['PB8',95,'TIM10_CH1','AF3']]);
  assert.deepEqual(group('p4','tether').map(r=>[r.gpio,r.pin]),[['GPIO28',55],['GPIO29',56],['GPIO30',57]]);
  assert.deepEqual(group('p4','pump').map(r=>[r.gpio,r.pin]),[['GPIO31',58]]);
  assert.equal(group('p4','sd').length,7);
  assert.deepEqual(group('p4','dvp').map(r=>r.gpio),[0,1,4,32,33,46,47,49,50,51,52,53].map(n=>'GPIO'+n));
  assert.deepEqual(group('p4','camera').map(r=>r.gpio),['GPIO22','GPIO23','GPIO48']);
  assert.deepEqual(group('p4','usb').map(r=>r.pin),[50,51]);
  assert.equal(routes('p4').length,42);
  assert.equal(new Set(routes('p4').map(r=>r.gpio)).size,42);
  assert.equal(new Set(routes('p4').map(r=>r.pin)).size,42);
  assert.ok(!routes('p4').some(r=>/RMII|ETH_/.test(r.signal)));
  const source=JSON.parse(fs.readFileSync(path.join(root,'ESP32P4C5引脚配置数据.json'),'utf8'));
  assert.deepEqual(source.budget,{exposedP4GPIO:49,assigned:42,internallyShared:2,bootRecoveryReserved:5,otherUnallocated:0});
  assert.deepEqual(source.cameraControlExpansion.outputs,['CSI_RESET','CSI_PWDN','DVP_RESET','DVP_PWDN']);
  for(const number of [61,62]) assert.equal(pin('p4-def',number).dataset.group,'boot');
});
test('AIS, DVP, pump, SD and tether synchronize through enlarged views',()=>{
  for(const [key,number,peer] of [['f4',80,83],['f4',95,null],['p4',88,81],['p4',58,null],['p4',67,73],['p4',55,57]]){
    click(pin(key+'-def',number)); checkSelected(key,number);
    if(peer) assert.ok(pin(key,peer).classList.contains('peer'));
    click($('[data-enlarge="'+key+'"]'));
    assert.equal($('#enlarged-view .selected').dataset.pin,String(number));
    keypress($('#enlarged-view [data-pin="'+(peer||number)+'"]'),'Enter');
    checkSelected(key,peer||number); checkIds();
    click($('#dialog-close'));
  }
});
test('Actual IMU module uses two I2C pins and releases PE0, PE1 and PE2 in both views',()=>{
  assert.equal(data.f4.routes.length,30);
  assert.equal(data.f4.routes.filter(r=>r.signal!=='NC').length,29);
  const imu=data.f4.routes.filter(r=>r.group==='imu');
  assert.deepEqual(imu.map(r=>[r.gpio,r.pin,r.signal,r.af]),[
    ['PB6',92,'I2C1_SCL','AF4'],['PB7',93,'I2C1_SDA','AF4']
  ]);
  assert.match(imu[0].note,/P1-7 SCL/);
  assert.match(imu[0].note,/P1-6 SDA/);
  assert.match(imu[0].note,/P1-4为5V/);
  for(const [gpio,number] of [['PE0',97],['PE1',98],['PE2',1]]){
    assert.ok(!data.f4.routes.some(r=>r.gpio===gpio),'Released '+gpio+' must not consume a route');
    const entry=data.f4.definitionPins.find(p=>p.pin===number);
    assert.equal(entry.name,gpio);
    assert.equal(entry.group,'unassigned');
    assert.equal(entry.allocated,false);
    for(const suffix of ['', '-def']) assert.equal(pin('f4'+suffix,number).dataset.group,'unassigned');
    click(pin('f4-def',number)); checkSelected('f4',number);
    assert.equal(view('f4').querySelectorAll('.peer').length,0);
    assert.equal(view('f4-def').querySelectorAll('.peer').length,0);
    assert.doesNotMatch($('#f4-definition-note').textContent,/MPU_INT|IST_DRDY|IST_RSTN/);
  }
  click(pin('f4',92)); checkSelected('f4',92);
  for(const suffix of ['', '-def']) {
    assert.ok(pin('f4'+suffix,93).classList.contains('peer'));
    for(const number of [97,98,1]) assert.ok(!pin('f4'+suffix,number).classList.contains('peer'));
  }
  const boardText=view('board').textContent;
  assert.match(boardText,/成品 IMU 模块/);
  assert.doesNotMatch(boardText,/MPU[- ]?6500|IST8310/);
  for(const key of ['f4','f4-def']) assert.doesNotMatch(view(key).textContent,/MPU[- ]?6500|IST8310|MPU_INT|IST_DRDY|IST_RSTN/);
});
test('Two servo channels use PA6/PA7 AF2 and synchronize both views',()=>{
  const routes=data.f4.routes.filter(r=>r.group==='servo');
  assert.deepEqual(routes.map(r=>[r.gpio,r.pin,r.signal,r.af]),[['PA6',31,'TIM3_CH1','AF2'],['PA7',32,'TIM3_CH2','AF2']]);
  for(const number of [31,32]) {
    click(pin('f4-def',number)); checkSelected('f4',number);
    assert.ok(pin('f4',number===31?32:31).classList.contains('peer'));
    assert.equal(pin('f4-def',number).dataset.group,'servo');
  }
});
assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(__dirname,'../reports/pin-sync-check.json'),JSON.stringify({method:'jsdom; owned inline script only; no browser or network',passed:results.length,results},null,2));
console.log(JSON.stringify({passed:results.length,results},null,2));
dom.window.close();
