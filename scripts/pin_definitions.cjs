// Build both definition drawings from the same physical-pin data as the MCU views.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles = {
  imu:'成品 IMU · I²C', depth:'深度 · I²C', ultrasonic:'五个超声波 · RS485',
  gps:'GPS / 北斗', ais:'AIS · UART5', debug:'SWD + 复位', motor:'五路 PWM · 外接驱动',
  servo:'两路舵机 · 独立 5V', light:'LED 调光', bms:'6S BMS · 独立 RS485', sonar:'声纳 · UART 候选',
  can:'CAN · 双主控 / 上位机', battery:'电池电压采样',
  lidar:'激光雷达 · UART', external:'4G / LoRa · UART', radio:'2.4GHz · SPI',
  camera:'MIPI CSI · 摄像头', uvc:'USB UVC · 摄像头', dvp:'DVP · 8bit 摄像头', pump:'水泵 · 外部驱动 EN',
  sd:'microSD · SDMMC slot0', tether:'水下线缆 · 独立 RS485', usb:'USB 下载 / 恢复',
  internal:'模块内部占用 · 保留', power:'电源 / 地', clock:'晶振 / 时钟',
  boot:'启动 / 复位 / 恢复', c5:'C5 射频 / 保留', dsi:'本地显示 · 专用脚预留', unassigned:'未分配 / NC · 不代表可直接使用'
};
const hints = {
  can:'两端各经收发器接 CAN_H / CAN_L', ultrasonic:'五模块分地址轮询；不与 BMS 共线',
  bms:'MCU TX/RX → RS485 收发器 → A/B', motor:'J401：5V / GND / PWM1–5；TIM1 + TIM9',
  servo:'PA6/7 · TIM3 CH1/2；J407/408 三针',
  imu:'PB6/7 → 模块 P1-7/6；5V 供电', camera:'6 专用脚 + 3 GPIO；复位/待机经扩展器',
  dvp:'12 个高速脚直连；控制依赖 I²C 扩展器', pump:'GPIO31 → 板外功率驱动，禁止直驱', ais:'PC12 / PD2 · AF8；AIS 电气层待确认',
  uvc:'受保护的 5V VBUS；三路性能待实测', sd:'VDDO4 / pad66 电源定义待核定',
  tether:'UART3 → 收发器 → A/B；视频链路另定', internal:'GPIO6/54 不可重复分配',
  debug:'运行日志走 CAN；SWD 用于下载 / 断点', power:'电源含义见选中详情；不可混接',
  unassigned:'点选任意脚可与上方 MCU 同步定位'
};

function normalize(cfg, key) {
  return cfg.pins.map(pin => {
    const route = cfg.routes.find(r => r.pin === pin.pin);
    const sys = cfg.systemRows?.find(s => s.pin === pin.pin);
    let group = route?.group || pin.group || 'unassigned';
    let label = route?.label || pin.label || sys?.short || '未分配';
    let signal = route?.signal || sys?.short || pin.name;
    let note = route?.note || sys?.note || pin.note || '未分配，使用前核对外设复用和电气约束。';
    if (route?.signal === 'NC') { group = 'unassigned'; label = 'NC · 未连接'; }
    if (key === 'f4' && !route && sys) {
      if (pin.pin === 14) group = 'debug';
      else if ([8,9,12,13].includes(pin.pin)) group = 'clock';
      else if ([37,94].includes(pin.pin)) group = 'boot';
      else group = 'power';
    }
    if (key === 'p4' && group === 'system') {
      if (pin.name === 'GND' || pin.name === 'ESP_3V3' || [66,84].includes(pin.pin)) group = 'power';
      else if (pin.name.startsWith('C5_') || pin.pin === 2) group = 'c5';
      else if (pin.name.startsWith('DSI_')) group = 'dsi';
      else if ([61,62,63,64,65,87].includes(pin.pin)) group = 'boot';
      else group = 'unassigned';
    }
    const color = cfg.groups.find(g => g.id === group)?.color || (group === 'unassigned' ? '#8493a6' : '#5e7188');
    return {pin:pin.pin, name:pin.name, group, color, label, signal, af:route?.af || '', note,
      allocated:!!route && route.signal !== 'NC',
      detail:'#'+pin.pin+' '+pin.name+' → '+label+(route ? ' · '+signal+(route.af ? ' / '+route.af : '') : '')};
  });
}

function buildDefinition(cfg, key) {
  const pins = normalize(cfg, key);
  cfg.definitionPins = pins;
  const order = key === 'f4'
    ? ['can','imu','motor','servo','depth','ultrasonic','bms','gps','ais','sonar','light','battery','debug','clock','boot','power','unassigned']
    : ['can','uvc','camera','dvp','sd','tether','pump','radio','lidar','external','usb','internal','boot','power','dsi','c5','unassigned'];
  let content = '';
  const heights = [78,78], cardWidth = 466;
  const routeOrder = new Map(cfg.routes.map((route,index) => [route.pin,index]));
  const text = (x,y,s,size=21,color='#354c67',extra='') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(s)}</text>`;
  for (const group of order) {
    const list = pins.filter(p => p.group === group);
    if (!list.length) continue;
    const compact = ['power','unassigned','c5','dsi'].includes(group);
    if (!compact) list.sort((a,b) => (routeOrder.get(a.pin) ?? 999) - (routeOrder.get(b.pin) ?? 999));
    const wide = group === 'unassigned';
    const columns = wide ? 6 : 3;
    const groupWidth = wide ? 952 : cardWidth;
    const column = heights[0] <= heights[1] ? 0 : 1;
    const x = wide ? 24 : 24 + column*486, y = wide ? Math.max(...heights) : heights[column];
    const header = hints[group] ? 82 : 58;
    const height = header + (compact ? Math.ceil(list.length/columns)*64 : list.length*64) + 12;
    const color = list[0].color;
    content += `<g class="definition-group" data-group="${group}"><rect x="${x}" y="${y}" width="${groupWidth}" height="${height}" rx="12" fill="#fff" stroke="#dce5ef"/>`;
    content += `<rect x="${x}" y="${y+16}" width="5" height="24" rx="2" fill="${color}"/>`;
    content += text(x+17,y+35,titles[group],22,color,'font-weight="700"');
    if (hints[group]) content += text(x+17,y+61,hints[group],17,'#78899c');
    list.forEach((pin,index) => {
      const px = compact ? x+12+(index%columns)*(wide ? 155 : 148) : x+12;
      const py = y+header+(compact ? Math.floor(index/columns)*64 : index*64);
      const width = compact ? 142 : cardWidth-24;
      const title = pin.detail+'。'+pin.note;
      content += `<g class="pin-hit definition-pin" data-pin="${pin.pin}" data-group="${pin.group}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(title)}"><title>${esc(title)}</title><rect class="hit-area" x="${px}" y="${py}" width="${width}" height="58" rx="7" fill="${compact?'#f4f7fb':'#f8fafd'}"/>`;
      if (compact) {
        content += text(px+8,py+23,pin.name,Math.min(19,205/Math.max(pin.name.length,1)),pin.color);
        content += text(px+8,py+46,'#'+pin.pin+(pin.pin===66 && key==='p4'?' · 待确认':pin.signal==='NC'?' · NC':''),18,'#697e95');
      } else {
        const label = pin.label.replace('超声波 ','').replace('声纳 ','').replace('（候选）','').replace('摄像头专用差分',pin.name);
        const signal = pin.signal.replace('Clock output / LEDC candidate','LEDC 时钟 · 候选').replace('MDC / GPIO Matrix','MDC · GPIO Matrix').replace('MDIO / GPIO Matrix','MDIO · GPIO Matrix');
        const detail = signal + (pin.af ? ' / '+pin.af.replace('系统 ','') : '');
        content += text(px+10,py+23,label,20,pin.color,'font-weight="600"');
        content += text(px+10,py+46,detail,Math.min(17,390/Math.max(detail.length,1)),'#7b8a9e');
        content += `<path d="M${px+260} ${py+27}h20" stroke="${pin.color}" stroke-width="1.5"/><circle cx="${px+280}" cy="${py+27}" r="3" fill="${pin.color}"/>`;
        const name = key === 'f4' ? pin.name.replace(/^(P[A-Z]\d+)-.*$/, '$1') : pin.name;
        content += text(px+width-12,py+24,name,Math.min(21,240/Math.max(name.length,1)),'#243f61','text-anchor="end" font-weight="700"');
        content += text(px+width-12,py+47,(key==='f4'?'脚 #':'焊盘 #')+pin.pin,18,'#7b8a9e','text-anchor="end"');
      }
      content += '</g>';
    });
    content += '</g>';
    if (wide) heights.fill(y+height+18);
    else heights[column] += height+18;
  }
  if (key === 'p4' && cfg.cameraControlExpansion) {
    const y = Math.max(...heights);
    content += '<g class="camera-expansion"><rect x="24" y="'+y+'" width="952" height="168" rx="12" fill="#fff6e7" stroke="#e2bc79"/>';
    content += text(42,y+34,'摄像头控制扩展器 · 必须补齐（不占新的 P4 GPIO）',22,'#966328','font-weight="700"');
    content += text(42,y+65,'GPIO22 SDA / GPIO23 SCL → 至少4路输出：CSI与DVP各 RESET / PWDN',19,'#765b36');
    content += text(42,y+95,'SCCB 同地址时需隔离 / 多路复用；扩展器端口号不等于 P4 GPIO。',19,'#765b36');
    content += text(42,y+125,'型号、电压、默认状态、复位时序与驱动初始化待核定；高速信号直接接 P4。',19,'#765b36');
    content += text(42,y+151,'42 分配 + 2 内部共享 + 5 启动恢复 = 49 外露 GPIO；无空闲通用脚。',18,'#966328')+'</g>';
    heights.fill(y+186);
  }
  const height = Math.max(...heights)+24;
  const label = key==='f4'?'STM32F407VET6 · 外设 / 芯片脚号':'ESP32-P4C5 · 外设 / 模块焊盘号';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" role="group" aria-labelledby="${key}-definition-title"><title id="${key}-definition-title">${esc(label)}引脚定义图</title><rect width="1000" height="${height}" fill="#f7f9fc"/>${text(24,43,'功能 / 信号   ──   GPIO · '+(key==='f4'?'芯片脚号':'核心板焊盘号'),23,'#385472')}${content}</svg>`;
  return {svg,height,pins};
}

module.exports = {buildDefinition};
