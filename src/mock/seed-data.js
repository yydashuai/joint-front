/**
 * 模拟数据种子文件 —— 便携式智能联试工具 Demo
 * 8 个系统 · 每系统 2-4 模块 · 每模块 1-3 协议/接口
 *
 * 数据结构与 stores 保持一致，各 store 直接 import 使用。
 */

/* ========== 辅助：自增 ID ========== */
let _nodeSeq = 100
let _protoSeq = 1000
const nid = () => ++_nodeSeq
const pid = () => ++_protoSeq

/* ========== 辅助：取值约束 ========== */
const range = (min, max) => ({ mode: 'range', min, max, value: 0 })
const fixed = (v) => ({ mode: 'fixed', min: 0, max: 0, value: v })

/* ========== 辅助：协议字段 ========== */
const field = (o) => ({
  id: pid(),
  name: '',
  startBit: 0,
  endBit: 7,
  constraint: range(0, 255),
  desc: '',
  ...o
})

/* ========== 辅助：接口参数 ========== */
const param = (o) => ({
  id: pid(),
  name: '',
  type: '常量',
  dataType: 'uint8',
  protocolRef: null,
  children: [],
  desc: '',
  ...o
})

/* ========== 辅助：模块节点 ========== */
const node = (o) => ({
  id: nid(),
  systemId: null,
  name: '',
  ip: '127.0.0.1',
  port: 8080,
  desc: '',
  reachable: true,
  status: 'offline',
  latency: 0,
  pingLog: [],
  ...o
})

// 预分配模块 ID（方便后续 protocol / interface 引用）
const M = {}
const sysModules = [
  // ── 1. 综合武器管理系统 ──
  ['sys-weapon', '武器管理模块',   '192.168.10.21', 9001, '武器装订与发射控制主链路',        true,  'online',  12],
  ['sys-weapon', '弹药状态模块',   '192.168.10.32', 9100, '弹药余量与装填状态上报链路',       true,  'online',  23],
  ['sys-weapon', '挂载检测模块',   '192.168.10.33', 9200, '挂点状态与载荷识别检测链路',       true,  'online',  8],
  // ── 2. 火控指挥联试系统 ──
  ['sys-fire',   '火控解算模块',   '192.168.20.45', 8080, '火控解算与目标分配数据链路',       true,  'offline', 0],
  ['sys-fire',   '指挥链路模块',   '192.168.20.46', 7070, '指挥所指令下行链路（当前不通）',    false, 'offline', 0],
  ['sys-fire',   '目标跟踪模块',   '192.168.20.47', 8090, '多目标跟踪与航迹融合链路',         true,  'online',  15],
  // ── 3. 雷达探测系统 ──
  ['sys-radar',  '信号处理模块',   '192.168.30.10', 6001, '雷达回波信号采集与预处理链路',      true,  'online',  5],
  ['sys-radar',  '天线控制模块',   '192.168.30.11', 6002, '天线方位/俯仰伺服控制链路',        true,  'online',  18],
  ['sys-radar',  '目标识别模块',   '192.168.30.12', 6003, '目标特征提取与分类识别链路',        true,  'offline', 0],
  // ── 4. 通信保障系统 ──
  ['sys-comm',   '数据链模块',     '192.168.40.20', 5001, '战术数据链收发与组网链路',         true,  'online',  7],
  ['sys-comm',   '卫星通信模块',   '192.168.40.21', 5002, '卫星中继通信与链路管理',           true,  'online',  35],
  // ── 5. 导航定位系统 ──
  ['sys-nav',    '惯性导航模块',   '192.168.50.30', 4001, '惯性测量单元与姿态解算链路',       true,  'online',  3],
  ['sys-nav',    '卫星定位模块',   '192.168.50.31', 4002, '北斗/GPS 双模定位数据链路',       true,  'online',  28],
  ['sys-nav',    '组合导航模块',   '192.168.50.32', 4003, 'INS/GNSS 紧组合滤波输出链路',     true,  'online',  11],
  // ── 6. 电子对抗系统 ──
  ['sys-ew',     '侦察分析模块',   '192.168.60.40', 3001, '电磁信号侦察与威胁分析链路',       true,  'online',  9],
  ['sys-ew',     '干扰执行模块',   '192.168.60.41', 3002, '有源/无源干扰指令下发链路',       true,  'online',  14],
  ['sys-ew',     '频谱监测模块',   '192.168.60.42', 3003, '战场电磁频谱实时监测链路',         true,  'offline', 0],
  // ── 7. 无人机管控系统 ──
  ['sys-uav',    '飞行控制模块',   '192.168.70.50', 2001, '无人机飞控指令与遥测数据链路',      true,  'online',  6],
  ['sys-uav',    '任务载荷模块',   '192.168.70.51', 2002, '光电/红外载荷控制链路',           true,  'online',  20],
  ['sys-uav',    '图像接收模块',   '192.168.70.52', 2003, '实时图像下传与存储链路',           true,  'online',  42],
  // ── 8. 指挥控制系统 ──
  ['sys-cmd',    '态势感知模块',   '192.168.80.60', 1001, '多源态势融合与显示链路',          true,  'online',  10],
  ['sys-cmd',    '作战筹划模块',   '192.168.80.61', 1002, '作战方案生成与评估链路',           true,  'online',  25],
  ['sys-cmd',    '指令下发模块',   '192.168.80.62', 1003, '作战指令编码与分发链路',           true,  'online',  4],
  ['sys-cmd',    '日志审计模块',   '192.168.80.63', 1004, '操作日志记录与合规审计链路',        true,  'online',  16],
]

/* ────────────────────────────────────────────
 *  一、系统 (Systems)
 * ──────────────────────────────────────────── */
export const systems = [
  { id: 'sys-weapon', name: '综合武器管理系统', desc: '覆盖武器挂载、状态监测与装控指令接口的被测系统', owner: '装备联试组' },
  { id: 'sys-fire',   name: '火控指挥联试系统', desc: '覆盖目标分配、火控解算与指挥链路接口的被测系统', owner: '火控联试组' },
  { id: 'sys-radar',  name: '雷达探测系统',     desc: '覆盖雷达信号处理、天线伺服与目标识别的联试系统', owner: '雷达联试组' },
  { id: 'sys-comm',   name: '通信保障系统',     desc: '覆盖战术数据链与卫星通信的联试保障系统',       owner: '通信联试组' },
  { id: 'sys-nav',    name: '导航定位系统',     desc: '覆盖惯导、卫导及组合导航的联试定位系统',       owner: '导航联试组' },
  { id: 'sys-ew',     name: '电子对抗系统',     desc: '覆盖电磁侦察、干扰执行与频谱监测的对抗系统',    owner: '电抗联试组' },
  { id: 'sys-uav',    name: '无人机管控系统',   desc: '覆盖飞控、载荷与图像接收的无人机管控联试系统',  owner: '无人机联试组' },
  { id: 'sys-cmd',    name: '指挥控制系统',     desc: '覆盖态势感知、作战筹划与指令分发的指控系统',    owner: '指控联试组' },
]

/* ────────────────────────────────────────────
 *  二、模块 (Nodes)
 * ──────────────────────────────────────────── */
export const nodes = sysModules.map(
  ([systemId, name, ip, port, desc, reachable, status, latency]) =>
    node({ systemId, name, ip, port, desc, reachable, status, latency })
)

// 记录每个模块的 id，供协议/接口引用
nodes.forEach((n, i) => { M[i] = n.id })
// 便捷索引：按 [系统, 模块名] 查找
const byName = (sys, name) => nodes.find(n => n.systemId === sys && n.name === name)?.id

/* ────────────────────────────────────────────
 *  三、协议 (Protocols) —— 位级字段定义
 * ──────────────────────────────────────────── */
const _p = (o) => ({ id: pid(), endian: 'big', desc: '', fields: [], ...o })

export const protocols = [
  // ── 武器管理 ──
  _p({
    name: '帧控制字节协议', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: '1 字节帧控制位标志（bit7 → bit0），适用于压缩/加密等按位场景',
    fields: [
      field({ name: '加密标志', startBit: 7, endBit: 7, constraint: range(0, 1), desc: '1=加密，0=明文' }),
      field({ name: '压缩标志', startBit: 6, endBit: 6, constraint: range(0, 1), desc: '1=压缩，0=未压缩' }),
      field({ name: '分片标志', startBit: 5, endBit: 5, constraint: range(0, 1), desc: '1=分片包，0=完整包' }),
      field({ name: '应答标志', startBit: 4, endBit: 4, constraint: range(0, 1), desc: '1=应答包，0=业务包' }),
      field({ name: '保留位',   startBit: 2, endBit: 3, constraint: fixed(0),    desc: '固定填 0，预留扩展' }),
      field({ name: '数据类型', startBit: 0, endBit: 1, constraint: range(0, 3), desc: '00=JSON 01=二进制 10=字符串 11=XML' }),
    ]
  }),
  _p({
    name: '武器挂载识别协议', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    desc: '挂点载荷识别与状态上报帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xAA55), desc: '固定 0xAA55' }),
      field({ name: '挂点编号', startBit: 16, endBit: 23, constraint: range(1, 12),  desc: '挂点 1~12' }),
      field({ name: '载荷类型', startBit: 24, endBit: 31, constraint: range(0, 5),   desc: '0=空 1=导弹 2=火箭 3=吊舱 4=副油箱 5=其他' }),
      field({ name: '载荷重量', startBit: 32, endBit: 47, constraint: range(0, 9999), desc: '单位 kg' }),
      field({ name: '锁定状态', startBit: 48, endBit: 48, constraint: range(0, 1),   desc: '1=锁定 0=未锁定' }),
    ]
  }),
  _p({
    name: '弹药编目协议', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'),
    desc: '弹药类型与批次编目帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 7,  constraint: fixed(0xCC),   desc: '固定 0xCC' }),
      field({ name: '弹药类型', startBit: 8,  endBit: 15, constraint: range(0, 10),  desc: '弹药型号编码' }),
      field({ name: '批次号',   startBit: 16, endBit: 31, constraint: range(0, 65535), desc: '生产批次' }),
      field({ name: '有效期',   startBit: 32, endBit: 47, constraint: range(0, 9999), desc: '剩余有效天数' }),
    ]
  }),

  // ── 火控指挥 ──
  _p({
    name: '遥测帧协议', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'),
    desc: '遥测下行帧（按位定义，可跨字节）',
    fields: [
      field({ name: '帧头',   startBit: 0,  endBit: 15, constraint: fixed(0xEB90),    desc: '固定 0xEB90' }),
      field({ name: '设备ID', startBit: 16, endBit: 23, constraint: range(0, 255),    desc: '分系统编号' }),
      field({ name: '温度',   startBit: 24, endBit: 55, constraint: range(-5000, 15000), desc: '摄氏度 ×100' }),
    ]
  }),
  _p({
    name: '目标航迹帧协议', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    desc: '多目标航迹融合输出帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xF1F2),  desc: '固定 0xF1F2' }),
      field({ name: '目标编号', startBit: 16, endBit: 31, constraint: range(1, 256),  desc: '航迹编号' }),
      field({ name: '方位角',   startBit: 32, endBit: 47, constraint: range(0, 36000), desc: '0.01° 精度' }),
      field({ name: '俯仰角',   startBit: 48, endBit: 63, constraint: range(-9000, 9000), desc: '0.01° 精度' }),
      field({ name: '距离',     startBit: 64, endBit: 95, constraint: range(0, 500000), desc: '单位 m' }),
      field({ name: '速度',     startBit: 96, endBit: 111, constraint: range(0, 3000), desc: '单位 m/s' }),
      field({ name: '置信度',   startBit: 112, endBit: 119, constraint: range(0, 100), desc: '融合置信度百分比' }),
    ]
  }),

  // ── 雷达探测 ──
  _p({
    name: '雷达回波帧协议', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'),
    desc: '雷达基带回波 IQ 采样帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 31,  constraint: fixed(0xDEADBEEF), desc: '固定 0xDEADBEEF' }),
      field({ name: '脉冲编号', startBit: 32, endBit: 47,  constraint: range(0, 65535),   desc: 'PRI 序号' }),
      field({ name: '通道号',   startBit: 48, endBit: 55,  constraint: range(0, 15),      desc: '接收通道 0~15' }),
      field({ name: '采样点数', startBit: 56, endBit: 71,  constraint: range(64, 4096),   desc: '本帧 IQ 采样数' }),
    ]
  }),
  _p({
    name: '天线伺服控制协议', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'),
    desc: '天线方位/俯仰指令与反馈帧',
    fields: [
      field({ name: '帧头',       startBit: 0,  endBit: 7,  constraint: fixed(0x5A),    desc: '固定 0x5A' }),
      field({ name: '指令类型',   startBit: 8,  endBit: 15, constraint: range(0, 4),    desc: '0=停止 1=搜索 2=跟踪 3=标定 4=归零' }),
      field({ name: '目标方位',   startBit: 16, endBit: 31, constraint: range(0, 36000), desc: '0.01° 精度' }),
      field({ name: '目标俯仰',   startBit: 32, endBit: 47, constraint: range(-2000, 8000), desc: '0.01° 精度' }),
      field({ name: '扫描速率',   startBit: 48, endBit: 55, constraint: range(0, 60),   desc: '°/s' }),
    ]
  }),
  _p({
    name: '目标特征帧协议', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'),
    desc: '目标 RCS 特征与分类结果帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xBB01), desc: '固定 0xBB01' }),
      field({ name: '目标ID',   startBit: 16, endBit: 31, constraint: range(1, 512), desc: '识别目标编号' }),
      field({ name: 'RCS均值',  startBit: 32, endBit: 47, constraint: range(0, 10000), desc: '0.01 m²' }),
      field({ name: '目标类别', startBit: 48, endBit: 55, constraint: range(0, 6),   desc: '0=未知 1=战斗机 2=运输机 3=直升机 4=导弹 5=无人机 6=舰船' }),
      field({ name: '识别置信度', startBit: 56, endBit: 63, constraint: range(0, 100), desc: '百分比' }),
    ]
  }),

  // ── 通信保障 ──
  _p({
    name: '数据链帧协议', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'),
    desc: '战术数据链 TADIL 帧格式',
    fields: [
      field({ name: '帧同步头', startBit: 0,  endBit: 15, constraint: fixed(0x1ACF), desc: '帧同步码' }),
      field({ name: '消息类型', startBit: 16, endBit: 23, constraint: range(0, 15),  desc: 'J 系列消息编号' }),
      field({ name: '发送方ID', startBit: 24, endBit: 39, constraint: range(1, 512), desc: '网络参与方编号' }),
      field({ name: '优先级',   startBit: 40, endBit: 43, constraint: range(0, 7),   desc: '0=最低 7=最高' }),
      field({ name: 'CRC校验',  startBit: 44, endBit: 59, constraint: range(0, 65535), desc: 'CRC-16' }),
    ]
  }),
  _p({
    name: '卫通链路管理协议', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'),
    desc: '卫星通信建链/保链/断链控制帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 7,  constraint: fixed(0x7E),   desc: '固定 0x7E' }),
      field({ name: '操作码',   startBit: 8,  endBit: 15, constraint: range(0, 5),   desc: '0=建链 1=保链 2=断链 3=切星 4=功率调整 5=状态查询' }),
      field({ name: '卫星编号', startBit: 16, endBit: 23, constraint: range(1, 32),  desc: '在轨卫星编号' }),
      field({ name: '信号强度', startBit: 24, endBit: 31, constraint: range(0, 100), desc: 'dBm 归一化' }),
    ]
  }),

  // ── 导航定位 ──
  _p({
    name: '惯导数据帧协议', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'),
    desc: 'IMU 六轴原始数据与姿态角输出帧',
    fields: [
      field({ name: '帧头',       startBit: 0,   endBit: 15, constraint: fixed(0x4E41), desc: '固定 "NA"' }),
      field({ name: '陀螺X',     startBit: 16,  endBit: 47, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      field({ name: '陀螺Y',     startBit: 48,  endBit: 79, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      field({ name: '陀螺Z',     startBit: 80,  endBit: 111, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      field({ name: '加速度X',   startBit: 112, endBit: 127, constraint: range(-16384, 16383), desc: 'mg' }),
      field({ name: '加速度Y',   startBit: 128, endBit: 143, constraint: range(-16384, 16383), desc: 'mg' }),
      field({ name: '加速度Z',   startBit: 144, endBit: 159, constraint: range(-16384, 16383), desc: 'mg' }),
    ]
  }),
  _p({
    name: '卫通定位帧协议', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'),
    desc: '北斗/GPS 双模定位解算输出帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 7,  constraint: fixed(0x24),    desc: '固定 $' }),
      field({ name: '系统标识', startBit: 8,  endBit: 11, constraint: range(0, 3),    desc: '0=GPS 1=BDS 2=双模 3=GLONASS' }),
      field({ name: '定位状态', startBit: 12, endBit: 15, constraint: range(0, 5),    desc: '0=无效 1=单点 2=DGPS 3=RTK固定 4=RTK浮点 5=惯导辅助' }),
      field({ name: '可见星数', startBit: 16, endBit: 23, constraint: range(0, 40),   desc: '可见卫星数' }),
      field({ name: 'HDOP',    startBit: 24, endBit: 39, constraint: range(10, 9999), desc: '精度因子 ×100' }),
    ]
  }),

  // ── 电子对抗 ──
  _p({
    name: '电磁侦察帧协议', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'),
    desc: '电磁环境信号侦察与参数测量帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xE5E5), desc: '固定 0xE5E5' }),
      field({ name: '信号类型', startBit: 16, endBit: 23, constraint: range(0, 8),   desc: '0=脉冲 1=连续波 2=跳频 3=扩频 4=噪声' }),
      field({ name: '中心频率', startBit: 24, endBit: 55, constraint: range(100, 18000), desc: 'MHz' }),
      field({ name: '脉宽',     startBit: 56, endBit: 71, constraint: range(1, 10000), desc: 'μs' }),
      field({ name: '脉冲重复频率', startBit: 72, endBit: 87, constraint: range(1, 50000), desc: 'Hz' }),
    ]
  }),
  _p({
    name: '干扰指令帧协议', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'),
    desc: '有源/无源干扰参数下发帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 7,  constraint: fixed(0x4A),   desc: '固定 0x4A' }),
      field({ name: '干扰模式', startBit: 8,  endBit: 15, constraint: range(0, 5),   desc: '0=噪声压制 1=欺骗 2=瞄准 3=阻塞 4=箔条 5=红外诱饵' }),
      field({ name: '干扰频段', startBit: 16, endBit: 31, constraint: range(100, 18000), desc: 'MHz' }),
      field({ name: '功率等级', startBit: 32, endBit: 39, constraint: range(0, 10),  desc: '0~10 级' }),
      field({ name: '持续时间', startBit: 40, endBit: 55, constraint: range(1, 600), desc: '单位 0.1s' }),
    ]
  }),

  // ── 无人机管控 ──
  _p({
    name: '飞控遥测帧协议', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'),
    desc: '无人机飞行状态遥测下行帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0x55AA), desc: '固定 0x55AA' }),
      field({ name: '飞行模式', startBit: 16, endBit: 23, constraint: range(0, 5),   desc: '0=手动 1=半自主 2=全自主 3=返航 4=降落 5=紧急' }),
      field({ name: '高度',     startBit: 24, endBit: 39, constraint: range(0, 15000), desc: '单位 m' }),
      field({ name: '空速',     startBit: 40, endBit: 55, constraint: range(0, 500), desc: '单位 km/h' }),
      field({ name: '航向角',   startBit: 56, endBit: 71, constraint: range(0, 36000), desc: '0.01° 精度' }),
      field({ name: '电池电量', startBit: 72, endBit: 79, constraint: range(0, 100), desc: '百分比' }),
    ]
  }),
  _p({
    name: '载荷控制帧协议', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'),
    desc: '光电/红外载荷指令帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 7,  constraint: fixed(0x6C),   desc: '固定 0x6C' }),
      field({ name: '载荷类型', startBit: 8,  endBit: 15, constraint: range(0, 3),   desc: '0=可见光 1=红外 2=SAR 3=多光谱' }),
      field({ name: '工作模式', startBit: 16, endBit: 23, constraint: range(0, 4),   desc: '0=待机 1=搜索 2=跟踪 3=录像 4=拍照' }),
      field({ name: '云台俯仰', startBit: 24, endBit: 39, constraint: range(-9000, 3000), desc: '0.01° 精度' }),
      field({ name: '变焦倍率', startBit: 40, endBit: 47, constraint: range(1, 30),  desc: '光学变焦' }),
    ]
  }),

  // ── 指挥控制 ──
  _p({
    name: '态势标注帧协议', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    desc: '战场态势目标标注与更新帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xC0DE), desc: '固定 0xC0DE' }),
      field({ name: '标注类型', startBit: 16, endBit: 23, constraint: range(0, 5),   desc: '0=友军 1=敌方 2=中性 3=障碍 4=区域 5=路线' }),
      field({ name: '经度',     startBit: 24, endBit: 55, constraint: range(-18000000, 18000000), desc: '×100000' }),
      field({ name: '纬度',     startBit: 56, endBit: 87, constraint: range(-9000000, 9000000),  desc: '×100000' }),
      field({ name: '时间戳',   startBit: 88, endBit: 119, constraint: range(0, 4294967295), desc: 'Unix 秒' }),
    ]
  }),
  _p({
    name: '作战指令编码协议', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'),
    desc: '作战指令结构化编码帧',
    fields: [
      field({ name: '帧头',     startBit: 0,  endBit: 15, constraint: fixed(0xC0D0), desc: '固定标识' }),
      field({ name: '指令类型', startBit: 16, endBit: 23, constraint: range(0, 10),  desc: '0=机动 1=攻击 2=防御 3=侦察 4=撤退 5=集结' }),
      field({ name: '优先级',   startBit: 24, endBit: 27, constraint: range(0, 7),   desc: '0=常规 7=特急' }),
      field({ name: '执行单位', startBit: 28, endBit: 43, constraint: range(1, 256), desc: '单位编号' }),
      field({ name: '有效时段', startBit: 44, endBit: 59, constraint: range(1, 1440), desc: '分钟' }),
    ]
  }),
]

/* ────────────────────────────────────────────
 *  四、接口 (Interfaces) —— 请求/响应参数树
 * ──────────────────────────────────────────── */
const _i = (o) => ({ id: pid(), path: '', desc: '', request: [], response: [], ...o })

export const interfaces = [
  // ── 武器管理 ──
  _i({
    name: '查询设备状态', path: '/device/status', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: '请求设备状态，返回遥测帧',
    request: [
      param({ name: 'deviceId', type: '常量', dataType: 'uint8', desc: '目标设备' }),
      param({ name: 'options', type: '共识体', desc: '查询选项', children: [
        param({ name: 'verbose', type: '常量', dataType: 'uint8' }),
        param({ name: 'timeoutMs', type: '常量', dataType: 'uint16' }),
      ]}),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32', desc: '状态码' }),
      param({ name: 'payload', type: '位组序流', desc: '遥测帧载荷' }),
    ]
  }),
  _i({
    name: '武器装订指令', path: '/weapon/bind', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: '下发武器装订参数并确认',
    request: [
      param({ name: 'weaponId', type: '常量', dataType: 'uint16', desc: '武器编号' }),
      param({ name: 'params', type: '共识体', desc: '装订参数', children: [
        param({ name: 'fuseMode', type: '常量', dataType: 'uint8', desc: '引信模式' }),
        param({ name: 'range', type: '常量', dataType: 'uint16', desc: '射程设定 m' }),
        param({ name: 'angle', type: '常量', dataType: 'float', desc: '装订角度' }),
      ]}),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32', desc: '0=成功' }),
      param({ name: 'confirmId', type: '常量', dataType: 'uint32', desc: '装订确认流水号' }),
    ]
  }),
  _i({
    name: '上报弹药余量', path: '/ammo/report', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'),
    desc: '查询并上报各类弹药余量',
    request: [
      param({ name: 'queryType', type: '常量', dataType: 'uint8', desc: '查询类型' }),
    ],
    response: [
      param({ name: 'total', type: '常量', dataType: 'uint16', desc: '弹药总量' }),
      param({ name: 'available', type: '常量', dataType: 'uint16', desc: '可用量' }),
      param({ name: 'detail', type: '共识体', desc: '余量明细', children: [
        param({ name: 'typeA', type: '常量', dataType: 'uint16', desc: 'A 型余量' }),
        param({ name: 'typeB', type: '常量', dataType: 'uint16', desc: 'B 型余量' }),
        param({ name: 'typeC', type: '常量', dataType: 'uint16', desc: 'C 型余量' }),
      ]}),
    ]
  }),
  _i({
    name: '挂载状态查询', path: '/pylon/status', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    desc: '查询全部挂点挂载状态',
    request: [
      param({ name: 'aircraftId', type: '常量', dataType: 'uint16', desc: '飞机编号' }),
    ],
    response: [
      param({ name: 'pylonList', type: '结构矩阵', desc: '挂点列表', children: [
        param({ name: 'pylonNo', type: '常量', dataType: 'uint8', desc: '挂点号' }),
        param({ name: 'loadType', type: '常量', dataType: 'uint8', desc: '载荷类型' }),
        param({ name: 'locked', type: '常量', dataType: 'uint8', desc: '锁定状态' }),
      ]}),
      param({ name: 'rawFrame', type: '位组序流', desc: '原始识别帧' }),
    ]
  }),

  // ── 火控指挥 ──
  _i({
    name: '目标分配解算', path: '/fire/solve', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'),
    desc: '提交目标列表，返回火力分配方案',
    request: [
      param({ name: 'targets', type: '共识体', desc: '目标列表', children: [
        param({ name: 'targetId', type: '常量', dataType: 'uint16', desc: '目标编号' }),
        param({ name: 'priority', type: '常量', dataType: 'uint8', desc: '优先级' }),
      ]}),
      param({ name: 'unitCount', type: '常量', dataType: 'uint8', desc: '火力单元数' }),
    ],
    response: [
      param({ name: 'result', type: '常量', dataType: 'int32', desc: '解算结果码' }),
      param({ name: 'plan', type: '流文件', desc: '分配方案文件' }),
      param({ name: 'raw', type: '位组序流', desc: '原始解算帧' }),
    ]
  }),
  _i({
    name: '航迹订阅', path: '/track/subscribe', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    desc: '订阅指定目标的实时航迹数据',
    request: [
      param({ name: 'trackIds', type: '结构矩阵', desc: '目标ID列表', children: [
        param({ name: 'id', type: '常量', dataType: 'uint16' }),
      ]}),
      param({ name: 'interval', type: '常量', dataType: 'uint16', desc: '推送间隔 ms' }),
    ],
    response: [
      param({ name: 'subscribed', type: '常量', dataType: 'uint8', desc: '成功订阅数' }),
      param({ name: 'sessionId', type: '常量', dataType: 'uint32', desc: '会话标识' }),
    ]
  }),
  _i({
    name: '指挥指令下发', path: '/cmd/dispatch', systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'),
    desc: '从指挥所向下游下发作战指令',
    request: [
      param({ name: 'cmdType', type: '常量', dataType: 'uint8', desc: '指令类型' }),
      param({ name: 'content', type: '共识体', desc: '指令内容', children: [
        param({ name: 'targetId', type: '常量', dataType: 'uint16' }),
        param({ name: 'action', type: '常量', dataType: 'uint8' }),
        param({ name: 'deadline', type: '常量', dataType: 'uint32', desc: '截止时间戳' }),
      ]}),
    ],
    response: [
      param({ name: 'ack', type: '常量', dataType: 'uint8', desc: '1=已接收' }),
      param({ name: 'seq', type: '常量', dataType: 'uint32', desc: '指令流水号' }),
    ]
  }),

  // ── 雷达探测 ──
  _i({
    name: '启动雷达扫描', path: '/radar/scan/start', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'),
    desc: '配置雷达扫描参数并启动',
    request: [
      param({ name: 'mode', type: '常量', dataType: 'uint8', desc: '0=全向 1=扇扫 2=定向' }),
      param({ name: 'prf', type: '常量', dataType: 'uint16', desc: '脉冲重复频率 Hz' }),
      param({ name: 'duration', type: '常量', dataType: 'uint16', desc: '扫描时长 s' }),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32', desc: '0=成功' }),
      param({ name: 'scanId', type: '常量', dataType: 'uint32', desc: '扫描任务ID' }),
    ]
  }),
  _i({
    name: '天线指向控制', path: '/radar/antenna/point', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'),
    desc: '设置天线方位角和俯仰角',
    request: [
      param({ name: 'azimuth', type: '常量', dataType: 'float', desc: '方位角 °' }),
      param({ name: 'elevation', type: '常量', dataType: 'float', desc: '俯仰角 °' }),
      param({ name: 'speed', type: '常量', dataType: 'uint8', desc: '转动速率' }),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'actualAz', type: '常量', dataType: 'float', desc: '实际方位' }),
      param({ name: 'actualEl', type: '常量', dataType: 'float', desc: '实际俯仰' }),
    ]
  }),
  _i({
    name: '目标识别请求', path: '/radar/identify', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'),
    desc: '提交目标特征数据进行分类识别',
    request: [
      param({ name: 'trackId', type: '常量', dataType: 'uint16', desc: '目标航迹ID' }),
      param({ name: 'featureData', type: '位组序流', desc: 'RCS 特征向量' }),
    ],
    response: [
      param({ name: 'category', type: '常量', dataType: 'uint8', desc: '目标类别' }),
      param({ name: 'confidence', type: '常量', dataType: 'uint8', desc: '置信度 %' }),
      param({ name: 'rcsDb', type: '常量', dataType: 'float', desc: 'RCS dBsm' }),
    ]
  }),

  // ── 通信保障 ──
  _i({
    name: '数据链组网', path: '/comm/datalink/join', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'),
    desc: '加入战术数据链网络',
    request: [
      param({ name: 'netId', type: '常量', dataType: 'uint16', desc: '网络编号' }),
      param({ name: 'nodeId', type: '常量', dataType: 'uint16', desc: '本节点编号' }),
      param({ name: 'cryptoKey', type: '常量', dataType: 'string', desc: '加密密钥标识' }),
    ],
    response: [
      param({ name: 'joined', type: '常量', dataType: 'uint8', desc: '1=入网成功' }),
      param({ name: 'members', type: '结构矩阵', desc: '当前成员列表', children: [
        param({ name: 'id', type: '常量', dataType: 'uint16' }),
        param({ name: 'role', type: '常量', dataType: 'uint8', desc: '0=普通 1=主控' }),
      ]}),
    ]
  }),
  _i({
    name: '卫通建链', path: '/comm/sat/link', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'),
    desc: '建立卫星通信链路',
    request: [
      param({ name: 'satId', type: '常量', dataType: 'uint8', desc: '目标卫星编号' }),
      param({ name: 'bandwidth', type: '常量', dataType: 'uint16', desc: '申请带宽 KHz' }),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'signalStrength', type: '常量', dataType: 'int16', desc: '信号强度 dBm' }),
      param({ name: 'linkRate', type: '常量', dataType: 'uint32', desc: '链路速率 bps' }),
    ]
  }),

  // ── 导航定位 ──
  _i({
    name: '惯导校准', path: '/nav/ins/calibrate', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'),
    desc: '执行惯导系统初始校准',
    request: [
      param({ name: 'mode', type: '常量', dataType: 'uint8', desc: '0=冷启动 1=热启动 2=对准' }),
      param({ name: 'refPos', type: '共识体', desc: '参考位置', children: [
        param({ name: 'lat', type: '常量', dataType: 'double', desc: '纬度' }),
        param({ name: 'lon', type: '常量', dataType: 'double', desc: '经度' }),
        param({ name: 'alt', type: '常量', dataType: 'float', desc: '海拔 m' }),
      ]}),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'readyTime', type: '常量', dataType: 'uint16', desc: '预计就绪时间 s' }),
      param({ name: 'drift', type: '常量', dataType: 'float', desc: '零偏漂移' }),
    ]
  }),
  _i({
    name: '定位数据查询', path: '/nav/gnss/position', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'),
    desc: '查询当前定位解算结果',
    request: [
      param({ name: 'system', type: '常量', dataType: 'uint8', desc: '0=GPS 1=BDS 2=双模' }),
    ],
    response: [
      param({ name: 'lat', type: '常量', dataType: 'double', desc: '纬度' }),
      param({ name: 'lon', type: '常量', dataType: 'double', desc: '经度' }),
      param({ name: 'alt', type: '常量', dataType: 'float', desc: '海拔 m' }),
      param({ name: 'fixStatus', type: '常量', dataType: 'uint8', desc: '定位状态' }),
      param({ name: 'satCount', type: '常量', dataType: 'uint8', desc: '可见星数' }),
    ]
  }),
  _i({
    name: '组合导航输出', path: '/nav/fusion/output', systemId: 'sys-nav', moduleId: byName('sys-nav', '组合导航模块'),
    desc: '获取 INS/GNSS 紧组合滤波输出',
    request: [
      param({ name: 'rate', type: '常量', dataType: 'uint8', desc: '输出频率 Hz' }),
    ],
    response: [
      param({ name: 'position', type: '共识体', desc: '融合位置', children: [
        param({ name: 'lat', type: '常量', dataType: 'double' }),
        param({ name: 'lon', type: '常量', dataType: 'double' }),
        param({ name: 'alt', type: '常量', dataType: 'float' }),
      ]}),
      param({ name: 'velocity', type: '共识体', desc: '融合速度', children: [
        param({ name: 'vn', type: '常量', dataType: 'float', desc: '北向 m/s' }),
        param({ name: 've', type: '常量', dataType: 'float', desc: '东向 m/s' }),
        param({ name: 'vd', type: '常量', dataType: 'float', desc: '地向 m/s' }),
      ]}),
      param({ name: 'rawFrame', type: '位组序流', desc: '原始导航帧' }),
    ]
  }),

  // ── 电子对抗 ──
  _i({
    name: '威胁信号查询', path: '/ew/threat/query', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'),
    desc: '查询当前识别的威胁信号列表',
    request: [
      param({ name: 'freqRange', type: '共识体', desc: '频率范围', children: [
        param({ name: 'low', type: '常量', dataType: 'uint32', desc: 'MHz' }),
        param({ name: 'high', type: '常量', dataType: 'uint32', desc: 'MHz' }),
      ]}),
      param({ name: 'threatLevel', type: '常量', dataType: 'uint8', desc: '最低威胁等级' }),
    ],
    response: [
      param({ name: 'signals', type: '结构矩阵', desc: '威胁信号列表', children: [
        param({ name: 'id', type: '常量', dataType: 'uint16' }),
        param({ name: 'type', type: '常量', dataType: 'uint8' }),
        param({ name: 'freq', type: '常量', dataType: 'uint32', desc: 'MHz' }),
        param({ name: 'threat', type: '常量', dataType: 'uint8', desc: '威胁等级' }),
      ]}),
      param({ name: 'rawFrame', type: '位组序流', desc: '侦察原始帧' }),
    ]
  }),
  _i({
    name: '干扰任务下发', path: '/ew/jam/task', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'),
    desc: '下发干扰任务参数',
    request: [
      param({ name: 'targetId', type: '常量', dataType: 'uint16', desc: '目标信号ID' }),
      param({ name: 'jamMode', type: '常量', dataType: 'uint8', desc: '干扰模式' }),
      param({ name: 'power', type: '常量', dataType: 'uint8', desc: '功率等级' }),
      param({ name: 'duration', type: '常量', dataType: 'uint16', desc: '持续时间 0.1s' }),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'taskId', type: '常量', dataType: 'uint32', desc: '干扰任务编号' }),
    ]
  }),
  _i({
    name: '频谱快照获取', path: '/ew/spectrum/snapshot', systemId: 'sys-ew', moduleId: byName('sys-ew', '频谱监测模块'),
    desc: '获取当前电磁频谱快照数据',
    request: [
      param({ name: 'bandwidth', type: '常量', dataType: 'uint32', desc: '观测带宽 Hz' }),
      param({ name: 'resolution', type: '常量', dataType: 'uint16', desc: '频率分辨率' }),
    ],
    response: [
      param({ name: 'snapshot', type: '流文件', desc: '频谱数据文件' }),
      param({ name: 'timestamp', type: '常量', dataType: 'uint32', desc: '采集时间戳' }),
    ]
  }),

  // ── 无人机管控 ──
  _i({
    name: '飞行计划上传', path: '/uav/flightplan', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'),
    desc: '上传无人机飞行计划航点',
    request: [
      param({ name: 'uavId', type: '常量', dataType: 'uint16', desc: '无人机编号' }),
      param({ name: 'waypoints', type: '结构矩阵', desc: '航点列表', children: [
        param({ name: 'lat', type: '常量', dataType: 'double' }),
        param({ name: 'lon', type: '常量', dataType: 'double' }),
        param({ name: 'alt', type: '常量', dataType: 'float', desc: '高度 m' }),
        param({ name: 'speed', type: '常量', dataType: 'uint16', desc: '空速 km/h' }),
      ]}),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'planId', type: '常量', dataType: 'uint32', desc: '计划编号' }),
      param({ name: 'eta', type: '常量', dataType: 'uint16', desc: '预计飞行时间 min' }),
    ]
  }),
  _i({
    name: '载荷参数配置', path: '/uav/payload/config', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'),
    desc: '配置任务载荷工作参数',
    request: [
      param({ name: 'payloadType', type: '常量', dataType: 'uint8', desc: '载荷类型' }),
      param({ name: 'config', type: '共识体', desc: '配置项', children: [
        param({ name: 'mode', type: '常量', dataType: 'uint8', desc: '工作模式' }),
        param({ name: 'zoom', type: '常量', dataType: 'uint8', desc: '变焦倍率' }),
        param({ name: 'exposure', type: '常量', dataType: 'uint16', desc: '曝光 ms' }),
      ]}),
    ],
    response: [
      param({ name: 'code', type: '常量', dataType: 'int32' }),
      param({ name: 'rawFrame', type: '位组序流', desc: '载荷控制帧' }),
    ]
  }),
  _i({
    name: '实时图像流订阅', path: '/uav/video/stream', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'),
    desc: '订阅无人机下传实时图像流',
    request: [
      param({ name: 'uavId', type: '常量', dataType: 'uint16', desc: '无人机编号' }),
      param({ name: 'quality', type: '常量', dataType: 'uint8', desc: '0=标清 1=高清 2=原始' }),
    ],
    response: [
      param({ name: 'streamUrl', type: '常量', dataType: 'string', desc: '流地址' }),
      param({ name: 'bitrate', type: '常量', dataType: 'uint32', desc: '码率 bps' }),
      param({ name: 'codec', type: '常量', dataType: 'string', desc: '编码格式' }),
    ]
  }),

  // ── 指挥控制 ──
  _i({
    name: '态势数据推送', path: '/cmd/situation/push', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    desc: '推送融合后的战场态势数据',
    request: [
      param({ name: 'area', type: '共识体', desc: '关注区域', children: [
        param({ name: 'centerLat', type: '常量', dataType: 'double' }),
        param({ name: 'centerLon', type: '常量', dataType: 'double' }),
        param({ name: 'radius', type: '常量', dataType: 'uint32', desc: '半径 m' }),
      ]}),
      param({ name: 'filter', type: '常量', dataType: 'uint8', desc: '目标过滤类型' }),
    ],
    response: [
      param({ name: 'entities', type: '结构矩阵', desc: '态势实体列表', children: [
        param({ name: 'id', type: '常量', dataType: 'uint16' }),
        param({ name: 'type', type: '常量', dataType: 'uint8' }),
        param({ name: 'lat', type: '常量', dataType: 'double' }),
        param({ name: 'lon', type: '常量', dataType: 'double' }),
      ]}),
      param({ name: 'rawFrame', type: '位组序流', desc: '态势标注帧' }),
    ]
  }),
  _i({
    name: '作战方案生成', path: '/cmd/plan/generate', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'),
    desc: '基于态势数据生成作战方案',
    request: [
      param({ name: 'missionType', type: '常量', dataType: 'uint8', desc: '任务类型' }),
      param({ name: 'constraints', type: '共识体', desc: '约束条件', children: [
        param({ name: 'maxTime', type: '常量', dataType: 'uint16', desc: '最大时长 min' }),
        param({ name: 'resources', type: '常量', dataType: 'uint8', desc: '可用资源数' }),
        param({ name: 'riskLevel', type: '常量', dataType: 'uint8', desc: '风险容忍度' }),
      ]}),
    ],
    response: [
      param({ name: 'planDoc', type: '流文件', desc: '作战方案文档' }),
      param({ name: 'score', type: '常量', dataType: 'float', desc: '方案评分' }),
      param({ name: 'alternatives', type: '常量', dataType: 'uint8', desc: '备选方案数' }),
    ]
  }),
  _i({
    name: '指令分发确认', path: '/cmd/order/dispatch', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'),
    desc: '分发作战指令并获取回执',
    request: [
      param({ name: 'orderType', type: '常量', dataType: 'uint8', desc: '指令类型' }),
      param({ name: 'targets', type: '结构矩阵', desc: '接收单位列表', children: [
        param({ name: 'unitId', type: '常量', dataType: 'uint16' }),
        param({ name: 'role', type: '常量', dataType: 'uint8' }),
      ]}),
      param({ name: 'content', type: '位组序流', desc: '指令编码帧' }),
    ],
    response: [
      param({ name: 'orderId', type: '常量', dataType: 'uint32', desc: '指令流水号' }),
      param({ name: 'ackCount', type: '常量', dataType: 'uint8', desc: '已确认单位数' }),
      param({ name: 'status', type: '常量', dataType: 'uint8', desc: '0=待确认 1=全部确认' }),
    ]
  }),
  _i({
    name: '操作日志查询', path: '/cmd/audit/log', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'),
    desc: '查询指定时段的操作日志',
    request: [
      param({ name: 'timeRange', type: '共识体', desc: '时间范围', children: [
        param({ name: 'start', type: '常量', dataType: 'uint32', desc: '起始时间戳' }),
        param({ name: 'end', type: '常量', dataType: 'uint32', desc: '结束时间戳' }),
      ]}),
      param({ name: 'operator', type: '常量', dataType: 'string', desc: '操作员过滤' }),
      param({ name: 'level', type: '常量', dataType: 'uint8', desc: '最低日志级别' }),
    ],
    response: [
      param({ name: 'logs', type: '结构矩阵', desc: '日志条目', children: [
        param({ name: 'timestamp', type: '常量', dataType: 'uint32' }),
        param({ name: 'operator', type: '常量', dataType: 'string' }),
        param({ name: 'action', type: '常量', dataType: 'string' }),
        param({ name: 'level', type: '常量', dataType: 'uint8' }),
      ]}),
      param({ name: 'total', type: '常量', dataType: 'uint32', desc: '总条数' }),
    ]
  }),
]

/* ────────────────────────────────────────────
 *  五、联试任务 (Tasks)
 * ──────────────────────────────────────────── */
export const tasks = [
  // 武器管理
  { id: 't01', name: '武器状态接口连通性测试', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), status: '执行中', time: '2026-06-24 10:31:00', remark: '验证 WM-001 接口在标准帧格式下的握手与应答流程' },
  { id: 't02', name: '弹药余量边界值检测', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'), status: '已完成', time: '2026-06-24 09:45:00', remark: '覆盖 0%/100% 边界值，已生成测试报告' },
  { id: 't03', name: '武器挂载自检流程验证', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), status: '已完成', time: '2026-06-24 09:10:00', remark: '' },
  { id: 't04', name: '挂载识别协议字段校验', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), status: '执行中', time: '2026-06-24 10:50:00', remark: '逐字段对比协议 v1.3 与实物载荷数据' },
  // 火控指挥
  { id: 't05', name: '火控解算异常回放', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), status: '异常', time: '2026-06-24 09:20:00', remark: '回放 08:55 采集的异常帧数据，解算结果偏差超限' },
  { id: 't06', name: '指挥链路报告生成任务', systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'), status: '待确认', time: '2026-06-24 08:50:00', remark: '链路当前不通，待恢复后自动执行' },
  { id: 't07', name: '目标分配协议一致性检测', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), status: '执行中', time: '2026-06-24 10:15:00', remark: '对比协议 v2.1 与 v2.2 的字段差异' },
  { id: 't08', name: '航迹融合精度验证', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), status: '已完成', time: '2026-06-24 08:30:00', remark: '多传感器融合误差 < 50m，满足指标' },
  // 雷达探测
  { id: 't09', name: '雷达回波帧格式验证', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'), status: '执行中', time: '2026-06-24 11:00:00', remark: '检查 IQ 采样帧头与通道编号的一致性' },
  { id: 't10', name: '天线伺服响应时延测试', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'), status: '已完成', time: '2026-06-24 10:05:00', remark: '方位阶跃响应 < 200ms，俯仰 < 150ms' },
  { id: 't11', name: '目标识别模型回归测试', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'), status: '待确认', time: '2026-06-24 09:40:00', remark: '使用标准目标库 200 条记录，待人工复核' },
  // 通信保障
  { id: 't12', name: '数据链组网入网测试', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'), status: '已完成', time: '2026-06-24 09:30:00', remark: '3 个节点同时入网，延迟 < 500ms' },
  { id: 't13', name: '卫通链路切换测试', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'), status: '执行中', time: '2026-06-24 10:40:00', remark: '主星→备星切换中断时间验证' },
  // 导航定位
  { id: 't14', name: '惯导冷启动对准测试', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'), status: '已完成', time: '2026-06-24 08:15:00', remark: '对准时间 180s，满足 ≤240s 指标' },
  { id: 't15', name: '双模定位精度验证', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'), status: '执行中', time: '2026-06-24 10:55:00', remark: '开阔环境 CEP 验证，目标 ≤ 3m' },
  { id: 't16', name: '组合导航隧道场景测试', systemId: 'sys-nav', moduleId: byName('sys-nav', '组合导航模块'), status: '待确认', time: '2026-06-24 09:50:00', remark: 'GNSS 中断 60s 纯惯导推算精度' },
  // 电子对抗
  { id: 't17', name: '电磁侦察灵敏度测试', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'), status: '执行中', time: '2026-06-24 11:05:00', remark: '弱信号检测能力验证，目标 -90dBm' },
  { id: 't18', name: '干扰效果评估', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'), status: '已完成', time: '2026-06-24 09:25:00', remark: '压制干扰有效压制比 > 20dB' },
  { id: 't19', name: '频谱监测数据完整性校验', systemId: 'sys-ew', moduleId: byName('sys-ew', '频谱监测模块'), status: '异常', time: '2026-06-24 10:20:00', remark: '频谱快照存在间歇性丢帧，需排查' },
  // 无人机管控
  { id: 't20', name: '飞控遥测数据帧校验', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'), status: '执行中', time: '2026-06-24 11:10:00', remark: '遥测帧各字段值域与实物传感器交叉验证' },
  { id: 't21', name: '载荷控制响应测试', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'), status: '已完成', time: '2026-06-24 10:00:00', remark: '模式切换延迟 < 100ms，变焦响应正常' },
  { id: 't22', name: '图像流质量评估', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'), status: '执行中', time: '2026-06-24 10:45:00', remark: '高清图传丢包率与延迟测试' },
  // 指挥控制
  { id: 't23', name: '态势融合实时性测试', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), status: '执行中', time: '2026-06-24 11:15:00', remark: '多源数据融合延迟 ≤ 1s 验证' },
  { id: 't24', name: '作战方案评估打分', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'), status: '待确认', time: '2026-06-24 10:30:00', remark: '3 套方案评分排序，待指挥员确认' },
  { id: 't25', name: '指令下发全链路测试', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'), status: '已完成', time: '2026-06-24 09:55:00', remark: '指令从生成到接收确认全链路 < 2s' },
  { id: 't26', name: '操作日志合规审计', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), status: '已完成', time: '2026-06-24 08:45:00', remark: '本周操作日志全量审计完成' },
]

/* ────────────────────────────────────────────
 *  六、异常告警 (Alerts)
 * ──────────────────────────────────────────── */
export const alerts = [
  // 武器管理
  { id: 'a01', type: '字段越界', iface: 'WM-003', level: '高', state: '已修复', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), resolvedTime: '2026-06-24 10:05:00', remark: '温度字段值 256 超出 uint8 范围，已修正传感器标定参数' },
  { id: 'a02', type: '格式错误', iface: 'WM-006', level: '高', state: '已转派', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'), resolvedTime: '2026-06-24 09:58:00', remark: '帧头校验码不匹配，已转派固件组排查版本一致性' },
  { id: 'a03', type: '帧头校验失败', iface: 'PY-012', level: '中', state: '已处理', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '2026-06-24 10:30:00', remark: '载荷类型字段偶发乱码，更换线缆后恢复' },
  // 火控指挥
  { id: 'a04', type: '响应超时', iface: 'FC-017', level: '中', state: '已记录', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), resolvedTime: '', remark: '连续 3 次超时 > 500ms，链路不稳定暂无法处理' },
  { id: 'a05', type: '心跳丢失', iface: '指挥链路模块', level: '中', state: '自动恢复', systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'), resolvedTime: '2026-06-24 08:47:00', remark: '心跳自动恢复，根因待排查' },
  { id: 'a06', type: '数据帧丢失', iface: 'FC-025', level: '中', state: '已处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), resolvedTime: '2026-06-24 10:22:00', remark: '重传机制触发后恢复正常' },
  { id: 'a07', type: '字段越界', iface: 'TK-031', level: '高', state: '待处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '', remark: '距离字段值 520000 超过协议上限 500000' },
  // 雷达探测
  { id: 'a08', type: '帧头校验失败', iface: 'RD-001', level: '高', state: '待处理', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'), resolvedTime: '', remark: '回波帧同步头 0xDEADBEEF 出现错位，疑似字节序问题' },
  { id: 'a09', type: '响应超时', iface: 'AN-008', level: '中', state: '已处理', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'), resolvedTime: '2026-06-24 10:45:00', remark: '伺服响应超时 350ms，调整 PID 参数后恢复' },
  { id: 'a10', type: '格式错误', iface: 'IR-015', level: '高', state: '已转派', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'), resolvedTime: '', remark: 'RCS 字段长度与协议定义不符，需固件升级' },
  // 通信保障
  { id: 'a11', type: '心跳丢失', iface: 'DL-003', level: '中', state: '自动恢复', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'), resolvedTime: '2026-06-24 09:35:00', remark: '数据链心跳中断 12s 后自动恢复' },
  { id: 'a12', type: '响应超时', iface: 'SAT-007', level: '高', state: '已记录', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'), resolvedTime: '', remark: '卫通建链超时 > 30s，信号强度不足' },
  // 导航定位
  { id: 'a13', type: '字段越界', iface: 'INS-002', level: '中', state: '已修复', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'), resolvedTime: '2026-06-24 09:15:00', remark: '陀螺 Z 轴零偏超限，重新校准后正常' },
  { id: 'a14', type: '数据帧丢失', iface: 'GNSS-005', level: '中', state: '已处理', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'), resolvedTime: '2026-06-24 10:50:00', remark: '遮挡环境丢星 3 颗，切换到 BDS 优先后恢复' },
  // 电子对抗
  { id: 'a15', type: '字段越界', iface: 'EW-009', level: '高', state: '待处理', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'), resolvedTime: '', remark: '中心频率字段值 19500MHz 超过协议上限 18000MHz' },
  { id: 'a16', type: '格式错误', iface: 'JAM-004', level: '高', state: '已修复', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'), resolvedTime: '2026-06-24 10:10:00', remark: '干扰模式字段编码与实际执行不一致，已同步' },
  { id: 'a17', type: '数据帧丢失', iface: 'SP-011', level: '中', state: '已处理', systemId: 'sys-ew', moduleId: byName('sys-ew', '频谱监测模块'), resolvedTime: '2026-06-24 10:25:00', remark: '频谱快照间歇丢帧，缓冲区溢出已扩容' },
  // 无人机管控
  { id: 'a18', type: '响应超时', iface: 'UAV-001', level: '高', state: '已处理', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'), resolvedTime: '2026-06-24 10:35:00', remark: '遥测帧下行延迟 800ms，优化编码后降至 50ms' },
  { id: 'a19', type: '心跳丢失', iface: 'PL-006', level: '中', state: '自动恢复', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'), resolvedTime: '2026-06-24 09:50:00', remark: '载荷控制心跳短暂中断后自动恢复' },
  { id: 'a20', type: '格式错误', iface: 'VID-003', level: '中', state: '已记录', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'), resolvedTime: '', remark: '图传码流偶发花屏，编码参数待优化' },
  // 指挥控制
  { id: 'a21', type: '字段越界', iface: 'SA-008', level: '中', state: '已修复', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), resolvedTime: '2026-06-24 10:55:00', remark: '经度字段精度溢出，已扩展为 64 位' },
  { id: 'a22', type: '响应超时', iface: 'PLN-002', level: '中', state: '已记录', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'), resolvedTime: '', remark: '方案生成超时 > 60s，算法优化中' },
  { id: 'a23', type: '帧头校验失败', iface: 'ORD-005', level: '高', state: '待处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'), resolvedTime: '', remark: '指令帧 CRC 校验失败率 5%，排查链路质量' },
  { id: 'a24', type: '数据帧丢失', iface: 'LOG-012', level: '中', state: '已处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '2026-06-24 11:00:00', remark: '日志写入高并发时偶发丢失，增加缓冲队列后恢复' },
]
