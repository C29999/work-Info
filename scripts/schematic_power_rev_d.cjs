'use strict';

// Review schematic only. All source-derived values are explicitly separated
// from unresolved battery protection, load, thermal, and layout selections.
module.exports = function drawPowerRevD(d) {
  const {panel, ic, cap, rv, rh, conn, testpoint, noteLines, text, line, net, component, put} = d;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pin=(name,n)=>({name,net:n});
  function ground(x,y) { line(x,y,x,y+9); line(x-13,y+9,x+13,y+9); line(x-8,y+15,x+8,y+15); line(x-3,y+21,x+3,y+21); }
  function pcap(x,y,ref,value,a,b='GND',fp='封装待选',note='候选电容，需核对有效电容量、耐压、纹波电流及温升') {
    component(ref,value,fp,{'1':pin('1',a),'2':pin('2',b)},note);
    net(x,y-12,a,'middle',16); line(x,y,x,y+28,a);
    line(x-14,y+28,x+14,y+28); line(x-14,y+39,x+14,y+39); line(x,y+39,x,y+70,b);
    if(b==='GND') ground(x,y+70); else net(x,y+92,b,'middle',16);
    text(x+22,y+28,ref,16,'ref'); text(x+22,y+53,value,16,'value');
  }
  function series(x,y,w,ref,value,a,b,kind,note) {
    component(ref,value,'封装待选',{'1':pin('1',a),'2':pin('2',b)},note);
    net(x,y-15,a,'start',17); net(x+w,y-15,b,'end',17);
    line(x,y,x+w/2-42,y,a); line(x+w/2+42,y,x+w,y,b);
    if(kind==='inductor') {
      const cx=x+w/2-42;
      put(`<path d="M ${cx} ${y} q 10 -26 21 0 q 10 -26 21 0 q 10 -26 21 0 q 10 -26 21 0" class="symbol"/>`);
    } else {
      put(`<rect x="${x+w/2-42}" y="${y-11}" width="84" height="22" class="symbol"/>`);
      line(x+w/2-34,y,x+w/2+34,y);
    }
    text(x+w/2,y+39,ref+' · '+value,17,'value','text-anchor="middle"');
  }
  function diodeH(x,y,w,ref,value,a,k,note) {
    component(ref,value,'封装及实际焊盘编号待选',{'A':pin('A',a),'K':pin('K',k)},note);
    const cx=x+w/2;
    net(x,y-15,a,'start',17); net(x+w,y-15,k,'end',17);
    line(x,y,cx-25,y,a); line(cx+25,y,x+w,y,k);
    put(`<path d="M ${cx-25} ${y-20} L ${cx-25} ${y+20} L ${cx+15} ${y} Z M ${cx+15} ${y-20} L ${cx+25} ${y-20} L ${cx+25} ${y+20} L ${cx+35} ${y+20}" class="symbol"/>`);
    text(cx-42,y+5,'A',15,'pin','text-anchor="end"'); text(cx+45,y+5,'K',15,'pin');
    text(cx,y+48,ref+' · '+value,17,'value','text-anchor="middle"');
  }
  function diodeV(x,y,ref,value,k,a='GND',tvs=false,note='候选保护器件，最终型号和封装待确认') {
    component(ref,value,'封装及实际焊盘编号待选',{'A':pin('A',a),'K':pin('K',k)},note);
    net(x,y-12,k,'middle',16); line(x,y,x,y+30,k);
    put(`<path d="M ${x-20} ${y+65} L ${x+20} ${y+65} L ${x} ${y+30} Z ${tvs?`M ${x-23} ${y+39} L ${x-20} ${y+30} L ${x+20} ${y+30} L ${x+23} ${y+21}`:`M ${x-20} ${y+21} L ${x-20} ${y+30} L ${x+20} ${y+30} L ${x+20} ${y+39}`}" class="symbol"/>`);
    line(x,y+65,x,y+98,a); if(a==='GND') ground(x,y+98); else net(x,y+120,a,'middle',16);
    text(x+30,y+32,ref,16,'ref'); text(x+30,y+56,value,16,'value');
    text(x-28,y+27,'K',14,'pin','text-anchor="end"'); text(x-28,y+72,'A',14,'pin','text-anchor="end"');
  }

  panel('power-input-6s',40,160,3520,460,'01  6S 输入 · 双路 5V 共用保护','6S 化学体系未锁；25.2V 仅对应单节满充 4.2V 的 6S 电池。保护型号、保险额定值和浪涌等级均待计算。');
  conn(75,295,'J901','双路电池输入',['BAT6S_IN','GND'],{width:200,step:34,note:'双路DC/DC的共用输入；项目自定义2针，连接器电流、线径、防水和防反插结构待定'});
  series(650,355,470,'F901','保险 · 额定值待定','BAT6S_IN','BAT_FUSED','fuse','双路共用输入；需按稳态负载、上电浪涌、线材额定值、DC分断能力确定');
  diodeH(1330,355,680,'D901','反接肖特基 · 型号待定','BAT_FUSED','BAT_SENSE_PROTECTED','串联防反接候选；核对VRRM、IF、浪涌、漏电、I×VF损耗及温升，尚无锁定料号');
  diodeV(2330,325,'D902','TVS · 待选','BAT_SENSE_PROTECTED','GND',true,'单向TVS：K接保护后正极、A接GND；VRWM需高于最大持续输入，钳位需协调SCT2650和电容额定值及保险分断');
  pcap(2860,325,'C901','47µF / 63V 候选','BAT_SENSE_PROTECTED','GND','电解/聚合物，封装待定','输入储能候选，不是最终选值；耐压、ESR、纹波电流和上电浪涌需与线缆/TVS共同校核');
  testpoint(3280,350,'TP901','BAT_SENSE_PROTECTED');
  noteLines(650,455,[
    'F901 → D901 → TVS / 储能 → DC/DC；本输入包含逻辑和舵机电流；推进/LED/水泵功率不经过此处。',
    'TVS 不能按“24V 系统”随意选 24V；反接保护二极管的压降、热损耗和电池采样偏差均需计入。',
    'BAT_SENSE_PROTECTED 是保护后的电压；F4 采样 R304 继续默认 DNP，钳位/断电反灌设计完成前不可接入 ADC。',
    '参考 GND 为逻辑回流；电机驱动独立供电支路的连接、保险与回流路径需在系统布线中另行闭合。'
  ],19);

  function sctBuck(x,servo=false){
    const U=servo?'U903':'U901',prefix=servo?'SERVO5':'BUCK5',out=servo?'+5V_SERVO':'+5V';
    const n=s=>prefix+'_'+s;
    const refs=servo?{L:'L903',D:'D904',cin:'C921',hf:'C922',boot:'C923',cout:['C924','C925','C926','C927'],rc:'C928',cp:'C929',rt:'R921',upper:'R922',lower:'R923',comp:'R924'}:{L:'L901',D:'D903',cin:'C902',hf:'C903',boot:'C904',cout:['C905','C906','C913','C914'],rc:'C907',cp:'C908',rt:'R903',upper:'R905',lower:'R906',comp:'R904'};
    panel(servo?'power-servo5':'power-buck5',x,650,servo?1770:1730,1160,servo?'03  U903 · 6S → 舵机专用 5V':'02  U901 · 6S → 逻辑 +5V','SCT2650STER 候选（用户型号待核对）· 5V / 500kHz 原厂参考，负载能力待验证。');
    const dx=x-40;
    ic(dx+650,785,360,450,U,'SCT2650STER',[
      ['2','VIN','BAT_SENSE_PROTECTED'],['3','EN','BAT_SENSE_PROTECTED'],['4','RT/CLK',n('RT')],['7','GND','GND'],['9','EP','GND']
    ],[['1','BOOT',n('BOOT')],['8','SW',n('SW')],['5','FB',n('FB')],['6','COMP',n('COMP')]],'ESOP-8L + EP','芯洲科技SCT2650 Rev1.3 p2–3；EP9必须焊接地平面。用户写STC2650，确切料号待确认。EN接VIN，6S低电保护由BMS/系统策略另行闭合。');
    pcap(dx+175,820,refs.cin,'10µF / 63V', 'BAT_SENSE_PROTECTED','GND','高压MLCC候选','工程候选值；按p14有效电容量、输入纹波/偏压/浪涌校核，不是已验证负载设计');
    pcap(dx+415,765,refs.hf,'100nF / 63V','BAT_SENSE_PROTECTED','GND','高压MLCC候选','p14高频旁路，紧靠VIN和GND；回路面积需最小');
    pcap(dx+1280,800,refs.boot,'100nF',n('BOOT'),n('SW'),'0603候选','p2 BOOT直接至SW；禁止接GND');
    series(dx+1190,965,450,refs.L,'7.8µH',n('SW'),out,'inductor','p17表3的5V/500kHz参考值；实际电感Isat须覆盖最坏峰值/限流，RMS和温升待算');
    diodeV(dx+1230,1025,refs.D,'B560C-13-F',n('SW'),'GND',false,'p14参考续流肖特基，A=GND、K=SW；反压/峰值/平均电流及封舱温升需校核');
    refs.cout.forEach((ref,i)=>pcap(dx+1050+i*170,1210,ref,'47µF / 10V',out,'GND','MLCC候选','p17表3：5V组合4×47µF，核对直流偏压后的有效容量及环路，不保证舵机堵转不掉压'));
    rv(dx+150,1355,refs.rt,'200k',n('RT'),'GND','p12表2：500kHz参考');
    rv(dx+410,1355,refs.upper,'53.6k / 1%',out,n('FB'),'p12表1：5V反馈分压上臂');
    rv(dx+670,1355,refs.lower,'10.2k / 1%',n('FB'),'GND','p12表1：下臂；0.8×(1+53.6/10.2)≈5.004V');
    rv(dx+925,1355,refs.comp,'33.2k',n('COMP'),n('COMP_RC'),'p17表3：补偿电阻，与3.3nF串联到GND');
    pcap(dx+1205,1355,refs.rc,'3.3nF',n('COMP_RC'),'GND','0603候选','p17表3：补偿电容，串联33.2k到GND');
    pcap(dx+1490,1355,refs.cp,'22pF / DNP',n('COMP'),'GND','0603候选','p17表3可选高频补偿，默认不装，样机环路评估后决定');
    noteLines(x+40,1545,[
      '来源：SCT2650 Rev1.3 p2–3脚表、p12分压/频率、p14二极管、p17表3。',
      '用户输入 STC2650；本图采用 SCT2650STER 候选，不代表采购型号已确认。',
      'EN 接保护后输入；未复制原厂低压例图UVLO，6S截止由BMS/系统另行确定。',
      '两路独立稳压、共输入/共地；输出不得并联，不是隔离电源。',
      servo?'舵机仅接 +5V_SERVO；两只运行/堵转电流、储能、线径及接口配额待算。':'逻辑 +5V 还要承担后级3.3V输入功率；主控不得直接接5V。',
      '器件5A等级不代表本板保证5A；芯片/二极管/电感温升及瞬态均需实测。'
    ],18);
  }
  sctBuck(40); sctBuck(1790,true);

  panel('power-buck33',40,1830,1730,1160,'04  U902 · +5V → +3V3 固定输出','TPS62132RGT · 同步降压 · 3A 器件等级；固定3.3V版本 FB 接GND，输出直接由VOS采样。');
  put('<g transform="translate(-1750 1180)">');
  ic(2280,800,480,600,'U902','TPS62132RGT',[
    ['11','PVIN','+5V'],['12','PVIN','+5V'],['10','AVIN','+5V'],['13','EN','+5V'],
    ['9','SS/TR','BUCK33_SS'],['8','DEF','GND'],['7','FSW','+3V3'],['5','FB','GND']
  ],[
    ['1','SW','BUCK33_SW'],['2','SW','BUCK33_SW'],['3','SW','BUCK33_SW'],['14','VOS','+3V3'],
    ['4','PG','PGOOD_3V3'],['6','AGND','GND'],['15','PGND','GND'],['16','PGND','GND'],['EP','Thermal Pad','GND']
  ],'RGT / VQFN16，3×3mm + EP','TI SLVSAG7F p3图6-1/表6-1；EP未在该表赋予数字脚号，保留EP并在选库时核对；p14固定版FB建议接AGND');
  pcap(1935,820,'C909','10µF / 25V','+5V','GND','1210参考','TI p13表9-1、p15：PVIN-PGND就近输入电容');
  pcap(2150,820,'C910','100nF / 25V','+5V','GND','0603参考','TI p13表9-1/p16：AVIN-AGND就近去耦，AVIN和PVIN接同一输入');
  pcap(1970,1080,'C912','3.3nF / 25V','BUCK33_SS','GND','0603参考','TI p13图9-1软启动电容参考值；SS/TR至AGND；启动带载需验证');
  rv(1970,1310,'R907','100k / 1%','+3V3','PGOOD_3V3','TI p13图9-1 PG上拉参考值；PG为开漏，不是复位监督器');
  series(3010,965,420,'L902','2.2µH','BUCK33_SW','+3V3','inductor','TI p13表9-1：XFL4020-222MEB参考；p14表9-2推荐2.2µH/22µF；饱和/温升及动态电流需复核');
  pcap(3100,1130,'C911','22µF / 6.3V','+3V3','GND','0805参考','TI p13表9-1/p14表9-2；必须核对3.3V偏压下有效电容量，增加分布式电容后重新核验环路');
  testpoint(3150,1340,'TP902','+3V3'); testpoint(3380,1430,'TP903','PGOOD_3V3');
  noteLines(1830,1545,[
    'SLVSAG7F：p3引脚及固定3.3V型号；p13图9-1为TPS62130可调参考。',
    '本图按p14固定版说明去除输出分压，将FB接AGND；VOS接电感后的+3V3。',
    'FSW接+3V3：稳定后约1.25MHz；DEF接GND：保持标称输出，无+5%提升。',
    'L=2.2µH / Cout=22µF为p14表9-2推荐组合；外围值是候选参考，须实测。',
    'PGND、AGND、EP接连续地平面；将高di/dt回路与反馈采样路径分开布线。',
    '本器件只从+5V取电；不能把6S直接接到AVIN/PVIN。负载总额定值未冻结。'
  ],18);

  put('</g>');

  panel('power-ports',1790,1830,1770,560,'05  供电连接与测量','逻辑 +5V 与舵机 +5V_SERVO 分开；同名网络互连，端口不代表额外实物插座。');
  conn(1830,1960,'P901','逻辑 5V 跨页',['+5V','GND'],{virtual:true,width:180,step:35,note:'逻辑5V及后级3.3V输入；禁止外部5V反灌'});
  conn(2390,1960,'P902','3V3 跨页',['+3V3','GND'],{virtual:true,width:180,step:35,note:'F4及P4C5的3.3V电源'});
  conn(2940,1960,'P903','电池采样',['BAT_SENSE_PROTECTED','GND'],{virtual:true,width:180,step:35,note:'F4 R304仍DNP，钳位/断电反灌完成前不可连接'});
  testpoint(1880,2175,'TP904','+5V'); testpoint(2430,2175,'TP905','GND'); testpoint(2960,2175,'TP906','+5V_SERVO');
  noteLines(1830,2250,[
    '逻辑 I5V ≈ I5V直供 + (3.3 × I3V3总) / (5 × η33)，还需启动/瞬态裕量。',
    '舵机回流避免穿过主控/ADC参考路径；两个5V输出不并联、禁止互相反灌。',
    'J401为5V/GND/五路PWM；J407/J408为舵机5V/GND/PWM，电流配额待定。'
  ],19);

  panel('power-boundaries',1790,2410,1770,580,'06  主控供电边界 / 待冻结项目','候选评审图；参考电路不能代替负载预算、保护计算和PCB审查。');
  noteLines(1830,2540,[
    'F4 与 P4C5 用 +3V3；P4C5 85/86输入、84 RTC_VBAT接3.3V。',
    '模块66 / ESP_LDO_VO4不并入+3V3；其电压域、输出能力和版次需核对。',
    'IMU模块使用逻辑5V；USB调试与主板双供电须防止反灌。',
    'USB主机VBUS经限流开关；设备/调试供电不能反灌主+5V。',
    '相机及SD的电源、电平与时序按型号确认；不按接口名字推定供电。',
    '电机、LED和水泵功率在外部驱动板；舵机使用独立+5V_SERVO。',
    '共用输入保护需按两路总输入/浪涌重算；不是仅逻辑支路的额定值。',
    '待定：电池体系、BMS截止、保护料号、峰值负载、线径与接口电流。',
    '待验证：温升、低电启停、环路/阶跃、短路、EMI及断电反灌。'
  ],19);
};
