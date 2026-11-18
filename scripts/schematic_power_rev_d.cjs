'use strict';

// Review schematic only. All source-derived values are explicitly separated
// from unresolved battery protection, load, thermal, and layout selections.
module.exports = function drawPowerRevD(d) {
  const {panel, ic, conn, testpoint, noteLines, text, line, dot, net, component, put} = d;
  const pin=(name,n)=>({name,net:n});
  function ground(x,y) { line(x,y,x,y+9); line(x-13,y+9,x+13,y+9); line(x-8,y+15,x+8,y+15); line(x-3,y+21,x+3,y+21); }
  function pcap(x,y,ref,value,a,b='GND',fp='封装待选',note='候选电容，需核对有效电容量、耐压、纹波电流及温升') {
    component(ref,value,fp,{'1':pin('1',a),'2':pin('2',b)},note);
    net(x,y-12,a,'middle',16); line(x,y,x,y+28,a);
    line(x-14,y+28,x+14,y+28); line(x-14,y+39,x+14,y+39); line(x,y+39,x,y+70,b);
    if(b==='GND') ground(x,y+70); else net(x,y+92,b,'middle',16);
    text(x+22,y+28,ref,16,'ref'); text(x+22,y+53,value,16,'value');
  }
  function fuse(x,y,w,ref,value,a,b,note) {
    component(ref,value,'封装待选',{'1':pin('1',a),'2':pin('2',b)},note);
    net(x,y-15,a,'start',17); net(x+w,y-15,b,'end',17);
    line(x,y,x+w/2-42,y,a); line(x+w/2+42,y,x+w,y,b);
    put(`<rect x="${x+w/2-42}" y="${y-11}" width="84" height="22" class="symbol"/>`);
    line(x+w/2-34,y,x+w/2+34,y);
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

  panel('power-input-6s',40,160,3520,460,'01  3S / 4S / 6S 输入 · 共用保护','单路电池按配置选择，不能同时接入；6S 25.2V 仅是单节满充 4.2V 的示例，保护和负载额定值待核。');
  conn(75,295,'J901','单路电池输入',['BAT_IN','GND'],{width:200,step:34,note:'仅接一款3S、4S或6S电池；项目自定义2针，连接器电流、线径、防水和防反插结构待定'});
  fuse(650,355,470,'F901','保险 · 额定值待定','BAT_IN','BAT_FUSED','双路共用输入；需按三种电池的最大电压、稳态负载、上电浪涌、线材额定值、DC分断能力确定');
  diodeH(1330,355,680,'D901','反接肖特基 · 型号待定','BAT_FUSED','BAT_SENSE_PROTECTED','串联防反接候选；核对VRRM、IF、浪涌、漏电、I×VF损耗及温升，尚无锁定料号');
  diodeV(2330,325,'D902','TVS · 待选','BAT_SENSE_PROTECTED','GND',true,'单向TVS：K接保护后正极、A接GND；VRWM需高于最大持续输入，钳位需协调SCT2650和电容额定值及保险分断');
  pcap(2860,325,'C901','47µF / 63V 候选','BAT_SENSE_PROTECTED','GND','电解/聚合物，封装待定','输入储能候选，不是最终选值；耐压、ESR、纹波电流和上电浪涌需与线缆/TVS共同校核');
  testpoint(3280,350,'TP901','BAT_SENSE_PROTECTED');
  noteLines(650,455,[
    'F901 → D901 → TVS / 储能 → DC/DC；本输入包含逻辑和舵机电流；推进/LED/水泵功率不经过此处。',
    'TVS 不能按“24V 系统”随意选 24V；反接保护二极管的压降、热损耗和电池采样偏差均需计入。',
    'BAT_SENSE_PROTECTED 是D901后的电压；电池采样经分压和断电开关到PC0，6S/4S/3S须配置选择且实测校准。',
    '参考 GND 为逻辑回流；电机驱动独立供电支路的连接、保险与回流路径需在系统布线中另行闭合。'
  ],19);

  // Orthogonal wires are drawn only between pins of the same net. A dot marks a tap.
  const wire=(n,...pts)=>pts.slice(1).forEach(([x,y],i)=>line(...pts[i],x,y,n));
  const taps=(y,...xs)=>xs.forEach(x=>dot(x,y));
  const twoPin=(ref,value,fp,a,b,note)=>component(ref,value,fp,{'1':pin('1',a),'2':pin('2',b)},note);
  function values(x,y,ref,value,anchor='start',size=21){
    const align='text-anchor="'+anchor+'"';
    text(x,y,ref,size,'ref',align);
    text(x,y+27,value,size,'value',align);
  }
  function vpart(kind,x,top,y,bottom,ref,value,a,b,fp,note,side='start',size=21){
    twoPin(ref,value,fp,a,b,note);
    const cap=kind==='capacitor',half=cap?6:17;
    wire(a,[x,top],[x,y-half]); wire(b,[x,y+half],[x,bottom]);
    if(cap){
      line(x-16,y-6,x+16,y-6); line(x-16,y+6,x+16,y+6);
    }else{
      put('<rect x="'+(x-9)+'" y="'+(y-half)+'" width="18" height="34" class="symbol"/>');
    }
    values(x+(side==='start'?20:-20),y+1,ref,value,side,size);
  }
  const cv=(...args)=>vpart('capacitor',...args);
  const rr=(x,top,y,bottom,ref,value,a,b,note,...label)=>vpart('resistor',x,top,y,bottom,ref,value,a,b,'0603候选',note,...label);
  function inductor(x,y,ref,value,a,b,note){
    twoPin(ref,value,'封装待选',a,b,note);
    put('<path d="M '+x+' '+y+' q 10 -27 21 0 q 10 -27 21 0 q 10 -27 21 0 q 10 -27 21 0" class="symbol"/>');
    values(x+42,y-59,ref,value,'middle');
  }
  function bootCap(x,y,ref,a,b){
    twoPin(ref,'100nF','0603候选',a,b,'p2 BOOT直接至SW；禁止接GND');
    line(x-6,y-16,x-6,y+16); line(x+6,y-16,x+6,y+16);
    values(x,y-60,ref,'100nF','middle');
  }
  function schottky(x,top,y,bottom,ref,sw){
    component(ref,'B560C-13-F','封装及实际焊盘编号待选',{'A':pin('A','GND'),'K':pin('K',sw)},'p14参考续流肖特基，A=GND、K=SW；反压/峰值/平均电流及封舱温升需校核');
    wire(sw,[x,top],[x,y-18]); wire('GND',[x,y+18],[x,bottom]);
    put('<path d="M '+(x-19)+' '+(y+18)+' h 38 l -19 -36 Z" class="symbol"/>');
    put('<path d="M '+(x-26)+' '+(y-26)+' h 7 v 8 h 38 v 8 h 7" class="wire"/>');
    values(x+21,y+9,ref,'B560C-13-F','start',18);
    text(x-23,y-24,'K',16,'pin','text-anchor="end"');
    text(x-23,y+35,'A',16,'pin','text-anchor="end"');
  }
  function probe(x,y,busY,ref,n){
    component(ref,n+'测试点','测试点候选',{'1':pin('1',n)},'测试夹具入口；不加专用串口');
    put('<circle cx="'+x+'" cy="'+y+'" r="7" class="symbol"/>');
    wire(n,[x,y+7],[x,busY]); dot(x,busY);
    text(x-15,y+6,ref,18,'ref','text-anchor="end"');
  }
  function buckTitle(id,x,y,w,title,subtitle,draw){
    panel(id,x,y,w,1160,title,subtitle);
    put('<g transform="translate('+x+' '+y+')">');
    draw();
    put('</g>');
  }

  function sctBuck(x,servo=false){
    const U=servo?'U903':'U901',prefix=servo?'SERVO5':'BUCK5',out=servo?'+5V_SERVO':'+5V';
    const n=s=>prefix+'_'+s;
    const vin='BAT_SENSE_PROTECTED', sw=n('SW'), fb=n('FB'), boot=n('BOOT'), comp=n('COMP'), rc=n('COMP_RC'), rt=n('RT');
    const refs=servo?{L:'L903',D:'D904',cin:'C921',hf:'C922',boot:'C923',cout:['C924','C925','C926','C927'],rc:'C928',cp:'C929',rt:'R921',upper:'R922',lower:'R923',comp:'R924'}:{L:'L901',D:'D903',cin:'C902',hf:'C903',boot:'C904',cout:['C905','C906','C913','C914'],rc:'C907',cp:'C908',rt:'R903',upper:'R905',lower:'R906',comp:'R904'};
    buckTitle(servo?'power-servo5':'power-buck5',x,650,servo?1770:1730,
      servo?'03  U903 · 电池母线 → 舵机 +5V_SERVO':'02  U901 · 电池母线 → 逻辑 +5V',
      'SCT2650STER 候选 · 5 V / 500 kHz 原厂参考 · 导线交叉处有圆点才连通。',()=>{
      ic(480,280,350,356,U,'SCT2650STER',[
        ['2','VIN',vin],['3','EN',vin],['4','RT/CLK',rt],['7','GND','GND'],['9','EP','GND']
      ],[['1','BOOT',boot],['8','SW',sw],['5','FB',fb],['6','COMP',comp]],'ESOP-8L + EP','芯洲科技SCT2650 Rev1.3 p2–3；EP9必须焊接地平面。用户写STC2650，确切料号待确认。EN接VIN，6S低电保护由BMS/系统策略另行闭合。',{wired:true});

      wire(vin,[62,370],[454,370]); net(62,351,vin,'start',24);
      wire(vin,[352,370],[352,434],[454,434]); taps(370,95,222,352);
      cv(95,370,565,825,refs.cin,'10µF / 63V',vin,'GND','高压MLCC候选','工程候选值；按p14有效电容量、输入纹波/偏压/浪涌校核，不是已验证负载设计','start',18);
      cv(222,370,565,825,refs.hf,'100nF / 63V',vin,'GND','高压MLCC候选','p14高频旁路，紧靠VIN和GND；回路面积需最小','start',18);
      wire(rt,[454,498],[370,498],[370,674]); net(370,479,rt,'middle',17);
      rr(370,674,711,825,refs.rt,'200k',rt,'GND','p12表2：500kHz参考','end');
      wire('GND',[454,562],[438,562],[438,825]); wire('GND',[454,626],[438,626]); dot(438,626);

      wire(boot,[856,370],[908,370],[908,260],[984,260]); bootCap(990,260,refs.boot,boot,sw);
      net(893,254,boot,'end',18);
      wire(sw,[996,260],[1084,260],[1084,434]); net(1084,241,sw,'middle',18);
      wire(sw,[856,434],[1102,434]); inductor(1102,434,refs.L,'7.8µH',sw,out,'p17表3的5V/500kHz参考值；实际电感Isat须覆盖最坏峰值/限流，RMS和温升待算');
      wire(out,[1186,434],[1670,434]); net(1670,414,out,'end',24);
      dot(1084,434);
      schottky(1084,434,578,825,refs.D,sw);

      wire(fb,[856,498],[1210,498]); net(1010,480,fb,'end',18);
      rr(1210,434,458,498,refs.upper,'53.6k / 1%',out,fb,'p12表1：5V反馈分压上臂','end',17);
      rr(1210,498,666,825,refs.lower,'10.2k / 1%',fb,'GND','p12表1：下臂；0.8×(1+53.6/10.2)≈5.004V','end',18);
      dot(1210,498);
      wire(comp,[856,562],[976,562]); net(970,545,comp,'end',18);
      rr(907,562,642,703,refs.comp,'33.2k',comp,rc,'p17表3：补偿电阻，与3.3nF串联到GND','end',18);
      cv(907,703,752,825,refs.rc,'3.3nF',rc,'GND','0603候选','p17表3：补偿电容，串联33.2k到GND','end',18);
      net(888,707,rc,'end',16);
      cv(976,562,730,825,refs.cp,'22pF / DNP',comp,'GND','0603候选','p17表3可选高频补偿，默认不装，样机环路评估后决定','start',15);
      dot(907,562);

      const cx=[1325,1436,1547,1658];
      refs.cout.forEach((ref,i)=>cv(cx[i],434,612,825,ref,'47µF / 10V',out,'GND','MLCC候选','p17表3：5V组合4×47µF，核对直流偏压后的有效容量及环路，不保证舵机堵转不掉压','end',15));
      taps(434,1210,...cx); wire('GND',[95,825],[cx.at(-1),825]);
      taps(825,222,370,438,750,907,976,1084,1210,...cx.slice(0,-1)); ground(750,825); net(775,860,'GND','start',18);

      noteLines(40,944,[
        '来源：SCT2650 Rev1.3 p2–3 脚表、p12 分压/频率、p14 二极管、p17 表3。',
        '用户输入 STC2650；本图采用 SCT2650STER 候选。EN 接输入，低电截止由 BMS / 系统另行确定。',
        '两路 5 V 独立稳压、共输入和地；输出不得并联。DNP 默认不装。',
        servo?'舵机仅接 +5V_SERVO；运行/堵转电流、储能、线径和接口配额待验证。':'逻辑 +5V 同时给后级 U902 供电；主控使用 U902 的 +3V3。',
        '芯片、续流二极管和电感的温升，以及带载瞬态，均需实测。'
      ],20);
    });
  }
  sctBuck(40); sctBuck(1790,true);

  buckTitle('power-buck33',40,1830,1730,'04  U902 · 逻辑 +5V → 主控 +3V3',
    'TPS62132RGT · 同步降压 · 固定 3.3 V：VOS 接输出，FB 接地。',()=>{
    const vin='+5V', out='+3V3', ss='BUCK33_SS', sw='BUCK33_SW', pg='PGOOD_3V3';
    ic(470,240,370,484,'U902','TPS62132RGT',[
      ['11','PVIN',vin],['12','PVIN',vin],['10','AVIN',vin],['13','EN',vin],
      ['9','SS/TR',ss],['8','DEF','GND'],['5','FB','GND'],['6','AGND','GND']
    ],[
      ['1','SW',sw],['2','SW',sw],['3','SW',sw],['14','VOS',out],['7','FSW',out],
      ['4','PG',pg],['15','PGND','GND'],['16','PGND','GND'],['EP','Thermal Pad','GND']
    ],'RGT / VQFN16，3×3mm + EP','TI SLVSAG7F p3图6-1/表6-1；EP未在该表赋予数字脚号，保留EP并在选库时核对；p14固定版FB建议接AGND',{wired:true});

    wire(vin,[62,330],[444,330]); net(62,308,vin,'start',24);
    wire(vin,[379,330],[379,474],[444,474]);
    [378,426].forEach(y=>{wire(vin,[379,y],[444,y]); dot(379,y);}); taps(330,78,210,379);
    cv(78,330,580,840,'C909','10µF / 25V',vin,'GND','1210参考','TI p13表9-1、p15：PVIN-PGND就近输入电容','start',18);
    cv(210,330,580,840,'C910','100nF / 25V',vin,'GND','0603参考','TI p13表9-1/p16：AVIN-AGND就近去耦，AVIN和PVIN接同一输入','start',18);
    wire(ss,[444,522],[350,522],[350,675]); net(350,505,ss,'middle',17);
    cv(350,675,714,840,'C912','3.3nF / 25V',ss,'GND','0603参考','TI p13图9-1软启动电容参考值；SS/TR至AGND；启动带载需验证','end',18);
    wire('GND',[444,570],[425,570],[425,840]);
    [618,666].forEach(y=>{wire('GND',[444,y],[425,y]); dot(425,y);});

    wire(sw,[866,330],[1020,330]); wire(sw,[980,330],[980,426],[866,426]);
    wire(sw,[980,378],[866,378]); taps(330,980); dot(980,378);
    net(876,309,sw,'start',17);
    inductor(1020,330,'L902','2.2µH',sw,out,'TI p13表9-1：XFL4020-222MEB参考；p14表9-2推荐2.2µH/22µF；饱和/温升及动态电流需复核');
    wire(out,[1104,330],[1670,330]); net(1670,308,out,'end',24);
    wire(out,[1210,330],[1210,522],[866,522]); wire(out,[866,474],[1210,474]); dot(1210,474);
    cv(1610,330,630,840,'C911','22µF / 6.3V',out,'GND','0805参考','TI p13表9-1/p14表9-2；必须核对3.3V偏压下有效电容量，增加分布式电容后重新核验环路','end');
    wire(pg,[866,570],[1510,570]); net(1494,550,pg,'end',20);
    rr(1320,330,443,570,'R907','100k / 1%',out,pg,'TI p13图9-1 PG上拉参考值；PG为开漏，不是复位监督器');
    dot(1320,570); taps(330,1210,1320,1610);
    probe(1460,279,330,'TP902',out); probe(1510,507,570,'TP903',pg);

    wire('GND',[866,618],[980,618],[980,840]);
    [666,714].forEach(y=>{wire('GND',[866,y],[980,y]); dot(980,y);});
    wire('GND',[78,840],[1610,840]); taps(840,210,350,425,655,980);
    ground(655,840); net(680,875,'GND','start',18);

    noteLines(40,944,[
      '来源：TI SLVSAG7F p3 引脚、p13 图 9-1 可调版参考、p14 固定版接法及 LC 选值。',
      'FSW 接 +3V3：稳定后约 1.25 MHz；DEF 接地：保持标称输出。',
      'PGND、AGND、EP 共地；布板时分开开关电流回路与输出采样路径。',
      'U902 只接逻辑 +5V，不能接电池母线。带载启动、瞬态及温升待实测。'
    ],20);
  });

  panel('power-ports',1790,1830,1770,560,'05  供电连接与测量','逻辑 +5V 与舵机 +5V_SERVO 分开；同名网络互连，端口不代表额外实物插座。');
  conn(1830,1960,'P901','逻辑 5V 跨页',['+5V','GND'],{virtual:true,width:180,step:35,note:'逻辑5V及后级3.3V输入；禁止外部5V反灌'});
  conn(2390,1960,'P902','3V3 跨页',['+3V3','GND'],{virtual:true,width:180,step:35,note:'F4及P4C5的3.3V电源'});
  conn(2940,1960,'P903','电池采样',['BAT_SENSE_PROTECTED','GND'],{virtual:true,width:180,step:35,note:'保护后母线到电池采样区；R304候选装配，过压/断电瞬态仍待台架验证'});
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
    '待定：3S/4S/6S各电池体系、容量、工作范围、BMS截止、保护料号、峰值负载、线径与接口电流。',
    '待验证：温升、低电启停、环路/阶跃、短路、EMI及断电反灌。'
  ],19);
};
