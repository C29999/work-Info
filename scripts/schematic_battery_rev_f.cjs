'use strict';

// One shared-ground voltage channel. This is a review schematic, not an EDA netlist.
module.exports = function drawBatterySense(d) {
  // Keep component coordinates local to the battery sheet; the board composer
  // moves the complete panel without reinterpreting its electrical networks.
  const shift=2850;
  const wrap=(name)=>(x,y,...rest)=>d[name](x,y-shift,...rest);
  const {panel}=d;
  const rh=wrap('rh'),rv=wrap('rv'),cap=wrap('cap');
  const ic=wrap('ic'),testpoint=wrap('testpoint'),noteLines=wrap('noteLines');
  panel('battery-sense',40,160,3520,550,'07  3S / 4S / 6S 电压采样 · 粗略 SOC',
    '单路电池、与 MCU 共地；保护后母线 0–30V 候选测量范围。电流不采样；串数/容量/曲线由配置选择。');
  rh(75,3150,'R301','49.9k / 0.1%','BAT_SENSE_PROTECTED','BAT_DIV_HI',630,
    '与R307串联组成99.8k上臂；0603，单颗工作电压≥50V、功率≥0.1W，具体料号待冻结');
  rh(75,3240,'R307','49.9k / 0.1%','BAT_DIV_HI','BAT_DIV',630,
    '与R301串联；分担电压及功耗；禁止省略后仍沿用换算系数');
  rv(135,3325,'R302','10k / 0.1%','BAT_DIV','GND');
  cap(420,3325,'C301','100nF / 16V','BAT_DIV','GND','分压低通；靠近U301 S1及模拟参考地，不能放在高di/dt回流路径');
  noteLines(1030,3200,[
    'D902 / F901 承担输入侧浪涌保护候选；本通道无独立精密钳位。',
    '超出30V、TVS钳位瞬态及开关断电输入上限须台架验证。'
  ],18);
  ic(1050,3320,400,170,'U303','TLV809EA29DBZR',[
    ['3','VDD','+3V3'],['1','GND','GND']
  ],[['2','/RESET','BAT_SENSE_EN']],'DBZ / SOT-23-3，标准脚序',
    'TI SLVSES2J p4–5/p8–9；2.93V监控、推挽低有效复位，A延时130–270ms。只控制采样开关，不接MCU NRST；不是R/V换脚版本。');
  cap(820,3360,'C304','100nF / 16V','+3V3','GND','靠近U303 pin3/1');
  cap(1660,3150,'C303','100nF / 16V','+3V3','GND','靠近U301 pin14/7');
  rv(1660,3340,'R306','100k','BAT_SENSE_EN','GND','使能默认下拉；U303为推挽，不增加PGOOD上拉负载');
  ic(1980,3140,360,350,'U301','TMUX1511PWR',[
    ['14','VDD','+3V3'],['1','SEL1','BAT_SENSE_EN'],['2','S1','BAT_DIV'],
    ['4','SEL2','GND'],['10','SEL3','GND'],['13','SEL4','GND'],['7','GND','GND']
  ],[
    ['3','D1','BAT_SW'],['5','S2','GND'],['6','D2','GND'],['8','D3','GND'],
    ['9','S3','GND'],['11','D4','GND'],['12','S4','GND']
  ],'PW / TSSOP-14',
    'TI SCDS390B p3–7/p20–22；SEL1高导通，供电不足时断开。仅通道1用于电池采样，其余信号与SEL接地。断电信号≤3.6V；不属于电气隔离器。');
  rh(2720,3150,'R303','1k / 0.1%','BAT_SW','BAT_ADC_LINK',730,'ADC串联限流；不能单独承担输入过压/断电保护');
  rh(2720,3240,'R304','0Ω','BAT_ADC_LINK','BAT_ADC',730,'Rev F候选装配；调试可拆断。启用前完成电压/时序/浪涌台架检查，不可绕过U301。');
  rv(2810,3325,'R305','100k / 0.1%','BAT_ADC','GND','断电输出泄放；必须计入分压比。断电漏电/残压、输入钳位和瞬态须实测');
  testpoint(3160,3350,'TP301','BAT_ADC');
  noteLines(75,3525,[
    'V保护后母线 ≈ 12.0878 × VADC（含R305负载，忽略开关导通电阻）；25.2V → 约2.085V。PC0 / pin15 / ADC1_IN10；上电等待至少500ms，曲线未标定前仅显示电压。'
  ],18);
};
