/**
 * 模拟数据种子文件 —— 便携式智能联试工具 Demo
 * 2 个系统 · 每系统 2-3 个模块 · 每模块若干报文
 * 字段不再独立成库：每个报文内联定义字段（底层 __inline 协议实体）。
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
const enumC = (entries) => ({ mode: 'enum', entries })

/* ========== 辅助：字节级字段 ========== */
const byteField = (o) => ({
  id: pid(),
  kind: 'byte',
  name: '',
  byteOffset: 0,
  byteLength: 1,
  bitMode: false,
  dataType: o.dataType || 'uint8',
  constraint: o.constraint || range(0, 255),
  desc: '',
  children: [],
  ...o
})

/* ========== 辅助：位级字段 ========== */
const bitField = (o) => ({
  id: pid(),
  kind: 'bit',
  name: '',
  bitStart: 7,
  bitEnd: 7,
  dataType: o.dataType || 'uint',
  constraint: o.constraint || range(0, 1),
  desc: '',
  ...o
})

/* ========== 辅助：重复字段组 ========== */
const repeatGroup = (o) => ({
  id: pid(),
  kind: 'repeat',
  name: '重复组',
  byteOffset: 0,
  repeatMode: 'fixed',
  repeatCount: 1,
  countFieldId: null,
  children: [],
  ...o
})

/* ========== 辅助：报文参数 ========== */
// 标量 / 共识体子字段使用；encoding 为数值/浮点编码（SCALAR_NUMERIC_ENCODINGS）
const param = (o) => ({
  id: pid(),
  name: '',
  type: 'scalar',
  encoding: 'uint8',
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
  ['sys-weapon', '挂载检测模块',   '192.168.10.45', 9200, '挂点载荷识别与状态上报链路',       true,  'online',  15],
  // ── 2. 火控指挥联试系统 ──
  ['sys-fire',   '火控解算模块',   '192.168.20.45', 8080, '火控解算与目标分配数据链路',       true,  'online',  18],
  ['sys-fire',   '指挥链路模块',   '192.168.20.46', 7070, '指挥所指令下行链路（当前不通）',    false, 'offline', 0],
]

/* ────────────────────────────────────────────
 *  一、系统 (Systems)
 * ──────────────────────────────────────────── */
export const systems = [
  { id: 'sys-weapon', name: '综合武器管理系统', desc: '覆盖武器挂载、状态监测与装控指令报文的被测系统', owner: '装备联试组' },
  { id: 'sys-fire',   name: '火控指挥联试系统', desc: '覆盖目标分配、火控解算与指挥链路报文的被测系统', owner: '火控联试组' },
]

/* ────────────────────────────────────────────
 *  二、模块 (Nodes)
 * ──────────────────────────────────────────── */
export const nodes = sysModules.map(
  ([systemId, name, ip, port, desc, reachable, status, latency]) =>
    node({ systemId, name, ip, port, desc, reachable, status, latency })
)

// 记录每个模块的 id，供字段/报文引用
nodes.forEach((n, i) => { M[i] = n.id })
// 便捷索引：按 [系统, 模块名] 查找
const byName = (sys, name) => nodes.find(n => n.systemId === sys && n.name === name)?.id
const inSeedScope = (item) =>
  systems.some((system) => system.id === item.systemId) &&
  nodes.some((module) => module.id === item.moduleId)

/* ────────────────────────────────────────────
 *  三、报文字段 (Message Fields) —— 报文内联定义
 *  报文不再引用独立「字段库」；每个字段在报文中内联定义，
 *  底层为 __inline 协议实体（与报文管理界面的统一字段表一一对应）。
 * ──────────────────────────────────────────── */

// 报文内联字段：一个字段 = 一个 __inline 协议实体
// category 五类：scalar / struct / bitstream / file / matrix
const field = (o = {}) => {
  const category = o.category || 'scalar'
  const name = o.name || '新建字段'
  const desc = o.desc || ''
  const constraint = o.constraint || null
  const f = {
    id: pid(),
    name,
    desc,
    systemId: null,
    moduleId: null,
    category,
    __inline: true,
    endian: 'big',
    framing: null,
    checksum: null,
    fileConfig: null,
    matrixConfig: null,
    fields: [],
  }
  if (category === 'scalar') {
    f.fields = [param({ name, type: 'scalar', encoding: o.encoding || 'uint8', constraint: constraint || range(0, 255), desc })]
  } else if (category === 'bitstream') {
    // 纯字节语义：一个字段 = 一个字节粒度单元（无位段/长度/偏移/单位）
    f.fields = [byteField({ name, dataType: o.dataType || 'uint8', constraint: constraint || range(0, 255), desc })]
    f.framing = { mode: 'fixed', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '', footerBytes: '' }
    f.checksum = { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' }
  } else if (category === 'struct') {
    f.fields = (o.children || []).map((c) => param({ ...c }))
  } else if (category === 'file') {
    f.fileConfig = { fileType: o.fileType || 'bin', chunkSizeKb: o.chunkSizeKb ?? 64, checksum: o.checksum || 'sha256' }
  } else if (category === 'matrix') {
    f.matrixConfig = { fileType: o.matrixFileType || 'csv' }
  }
  return f
}


/* ────────────────────────────────────────────
 *  四、报文 (Interfaces) 参数树
 * ──────────────────────────────────────────── */
const _i = (o) => ({ id: pid(), desc: '', datasetIds: [], fields: [], ...o })

// ── 报文（Interfaces）──
// 报文定义携带 fields（内联字段）；导出时生成 __inline 字段协议与 protocolRefs。
// 传输类型不再在报文中定义（仅在收发监控侧配置）。
const allInterfaces = [
  // ── 武器管理 ──
  _i({
    name: '查询设备状态',
    systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    datasetIds: [2],
    desc: '查询设备状态，返回遥测帧与状态附件',
    fields: [
      field({ category: 'scalar', name: '设备编号', encoding: 'uint8', constraint: range(1, 32), desc: '武器管理设备编号' }),
      field({ category: 'scalar', name: '设备类型', encoding: 'uint8', constraint: enumC([{ value: 0, label: '指挥所' }, { value: 1, label: '雷达' }, { value: 2, label: '干扰机' }, { value: 3, label: '无人机' }]), desc: '设备类型枚举' }),
      field({ category: 'bitstream', name: '状态字', dataType: 'uint16', constraint: range(0, 65535), desc: 'bit 位状态标志（1=在线 2=故障 4=自检中）' }),
      field({ category: 'scalar', name: '设备温度', encoding: 'float32', constraint: range(-40, 85), desc: '核心温度' }),
      field({ category: 'struct', name: '挂载明细', desc: '各挂点状态', children: [
        { type: 'scalar', name: '挂点号', encoding: 'uint8', constraint: range(1, 12), desc: '挂点编号 1~12' },
        { type: 'scalar', name: '载荷类型', encoding: 'uint8', constraint: enumC([{ value: 0, label: '空' }, { value: 1, label: '导弹' }, { value: 2, label: '火箭' }, { value: 3, label: '吊舱' }, { value: 4, label: '副油箱' }]), desc: '载荷类型枚举' },
        { type: 'scalar', name: '锁定状态', encoding: 'uint8', constraint: enumC([{ value: 0, label: '未锁定' }, { value: 1, label: '锁定' }]), desc: '锁定状态' },
      ]}),
      field({ category: 'file', name: '状态附件', fileType: 'bin', chunkSizeKb: 64, checksum: 'sha256', desc: '状态上报附件文件' }),
      field({ category: 'matrix', name: '挂载参数矩阵', matrixFileType: 'csv', desc: '挂载参数二维表' }),
    ],
  }),
  _i({
    name: '武器装订指令',
    systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    datasetIds: [4],
    desc: '下发武器装订参数并确认',
    fields: [
      field({ category: 'scalar', name: '指令序号', encoding: 'uint32', constraint: range(0, 4294967295), desc: '装订指令流水号' }),
      field({ category: 'struct', name: '装订参数', desc: '装订参数共识体', children: [
        { type: 'scalar', name: '目标编号', encoding: 'uint16', constraint: range(1, 512), desc: '目标航迹编号' },
        { type: 'scalar', name: '引信方式', encoding: 'uint8', constraint: enumC([{ value: 0, label: '触发' }, { value: 1, label: '近炸' }, { value: 2, label: '定时' }]), desc: '引信方式枚举' },
        { type: 'scalar', name: '弹道类型', encoding: 'uint8', constraint: enumC([{ value: 0, label: '平射' }, { value: 1, label: '高抛' }, { value: 2, label: '俯冲' }]), desc: '弹道类型枚举' },
        { type: 'scalar', name: '射程', encoding: 'uint16', constraint: range(100, 20000), desc: '装订射程' },
        { type: 'scalar', name: '射角', encoding: 'float32', constraint: range(-15, 60), desc: '装订射角' },
      ]}),
      field({ category: 'bitstream', name: '控制字', dataType: 'uint8', constraint: range(0, 255), desc: '装订控制标志（bit0 同步 / bit1 校验）' }),
      field({ category: 'matrix', name: '装订矩阵', matrixFileType: 'csv', desc: '批量装订参数二维表' }),
    ],
  }),
  _i({
    name: '帧控制指令',
    systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    datasetIds: [1],
    desc: '帧控制字（纯字节）发送控制指令',
    fields: [
      field({ category: 'bitstream', name: '帧头', dataType: 'uint16', constraint: fixed(0xAA55), desc: '固定帧头 0xAA55' }),
      field({ category: 'bitstream', name: '控制字', dataType: 'uint8', constraint: range(0, 255), desc: '帧控制字（1=加密 2=压缩 4=分片 8=应答）' }),
      field({ category: 'scalar', name: '数据长度', encoding: 'uint16', constraint: range(0, 4096), desc: '后续载荷字节数' }),
    ],
  }),

  // ── 弹药状态 ──
  _i({
    name: '上报弹药余量',
    systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'),
    datasetIds: [],
    desc: '查询并上报各类弹药余量',
    fields: [
      field({ category: 'scalar', name: '弹药总量', encoding: 'uint16', constraint: range(0, 65535), desc: '当前弹药总量' }),
      field({ category: 'struct', name: '余量明细', desc: '各型弹药余量明细', children: [
        { type: 'scalar', name: 'A型余量', encoding: 'uint16', constraint: range(0, 9999), desc: 'A 型余量' },
        { type: 'scalar', name: 'B型余量', encoding: 'uint16', constraint: range(0, 9999), desc: 'B 型余量' },
        { type: 'scalar', name: 'C型余量', encoding: 'uint16', constraint: range(0, 9999), desc: 'C 型余量' },
      ]}),
      field({ category: 'scalar', name: '上报时间', encoding: 'uint32', constraint: range(0, 4294967295), desc: '上报时间戳' }),
    ],
  }),

  // ── 挂载检测 ──
  _i({
    name: '挂载状态查询',
    systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    datasetIds: [5],
    desc: '查询全部挂点挂载状态',
    fields: [
      field({ category: 'scalar', name: '飞机编号', encoding: 'uint16', constraint: range(1, 65535), desc: '飞机编号' }),
      field({ category: 'struct', name: '挂点列表', desc: '挂点状态共识体', children: [
        { type: 'scalar', name: '挂点号', encoding: 'uint8', constraint: range(1, 12), desc: '挂点编号 1~12' },
        { type: 'scalar', name: '载荷类型', encoding: 'uint8', constraint: enumC([{ value: 0, label: '空' }, { value: 1, label: '导弹' }, { value: 2, label: '火箭' }, { value: 3, label: '吊舱' }, { value: 4, label: '副油箱' }]), desc: '载荷类型枚举' },
        { type: 'scalar', name: '载荷重量', encoding: 'uint16', constraint: range(0, 9999), desc: '载荷重量' },
        { type: 'scalar', name: '锁定状态', encoding: 'uint8', constraint: enumC([{ value: 0, label: '未锁定' }, { value: 1, label: '锁定' }]), desc: '锁定状态' },
      ]}),
      field({ category: 'bitstream', name: '识别帧', dataType: 'uint8', constraint: range(0, 255), desc: '原始识别帧字节' }),
    ],
  }),

  // ── 火控指挥 ──
  _i({
    name: '目标分配解算',
    systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'),
    datasetIds: [],
    desc: '提交目标列表，返回火力分配方案',
    fields: [
      field({ category: 'scalar', name: '目标编号', encoding: 'uint16', constraint: range(1, 256), desc: '目标航迹编号' }),
      field({ category: 'scalar', name: '优先级', encoding: 'uint8', constraint: range(1, 10), desc: '目标优先级' }),
      field({ category: 'scalar', name: '火力单元数', encoding: 'uint8', constraint: range(1, 16), desc: '参与解算的火力单元数' }),
      field({ category: 'scalar', name: '解算结果码', encoding: 'int32', constraint: range(0, 255), desc: '0=成功 1=降级 32=无解' }),
      field({ category: 'file', name: '分配方案', fileType: 'txt', chunkSizeKb: 32, checksum: 'md5', desc: '火力分配方案文件' }),
    ],
  }),
  _i({
    name: '遥测帧上报',
    systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'),
    datasetIds: [3],
    desc: '上报火控解算遥测帧（温度/航向/电量）',
    fields: [
      field({ category: 'bitstream', name: '遥测帧头', dataType: 'uint16', constraint: fixed(0xEB90), desc: '固定帧头 0xEB90' }),
      field({ category: 'scalar', name: '解算结果码', encoding: 'int32', constraint: range(0, 255), desc: '解算结果码' }),
      field({ category: 'scalar', name: '温度值', encoding: 'float32', constraint: range(-40, 85), desc: '设备温度' }),
      field({ category: 'scalar', name: '航向角', encoding: 'float32', constraint: range(0, 360), desc: '航向角' }),
      field({ category: 'scalar', name: '电池电量', encoding: 'uint8', constraint: range(0, 100), desc: '电池电量百分比' }),
    ],
  }),

  // ── 指挥链路 ──
  _i({
    name: '指挥指令下发',
    systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'),
    datasetIds: [6],
    desc: '从指挥所向下游下发作战指令',
    fields: [
      field({ category: 'scalar', name: '指令类型', encoding: 'uint8', constraint: enumC([{ value: 1, label: '目标跟踪' }, { value: 2, label: '火力分配' }, { value: 9, label: '任务撤销' }]), desc: '指令类型枚举' }),
      field({ category: 'struct', name: '指令内容', desc: '指令内容共识体', children: [
        { type: 'scalar', name: '目标编号', encoding: 'uint16', constraint: range(1, 512), desc: '目标航迹编号' },
        { type: 'scalar', name: '动作', encoding: 'uint8', constraint: enumC([{ value: 0, label: '取消' }, { value: 1, label: '跟踪' }, { value: 4, label: '打击' }]), desc: '动作枚举' },
        { type: 'scalar', name: '截止时间', encoding: 'uint32', constraint: range(0, 4294967295), desc: '指令截止时间戳' },
      ]}),
      field({ category: 'scalar', name: '指令序号', encoding: 'uint32', constraint: range(0, 4294967295), desc: '指令流水号' }),
      field({ category: 'bitstream', name: '应答码', dataType: 'uint8', constraint: range(0, 255), desc: '应答状态码' }),
    ],
  }),
]

// 报文导出：把内联字段提升为 __inline 字段协议，并生成 protocolRefs
const inlineFieldPool = []
const messageWithRefs = (message) => {
  const fields = message.fields || []
  const refs = fields.map((f) => {
    inlineFieldPool.push(f)
    return { protocolId: f.id }
  })
  const { fields: _fields, ...rest } = message
  return { ...rest, protocolRefs: refs }
}

const scopedMessages = allInterfaces.filter(inSeedScope).map(messageWithRefs)
const withSuffix = (name, suffix) => name.endsWith(suffix) ? name : `${name}${suffix}`

// 报文字段池：全部为报文中内联定义的字段（__inline）
export const protocols = inlineFieldPool

// ── 接口分组：报文排他归属（一个报文只属于一个接口；一个接口可挂多个报文）──
// 演示 1:N：查询设备状态接口挂 2 报文（查询设备状态 + 帧控制指令），
// 目标分配解算接口挂 2 报文（目标分配解算 + 遥测帧上报），其余 1:1。
const IFACE_GROUPS = [
  ['查询设备状态', '帧控制指令'],
  ['武器装订指令'],
  ['上报弹药余量'],
  ['挂载状态查询'],
  ['目标分配解算', '遥测帧上报'],
  ['指挥指令下发'],
]
const ownerOfMessage = new Map() // 报文名 → 接口 id
IFACE_GROUPS.forEach((names) => {
  const first = scopedMessages.find((m) => m.name === names[0])
  if (!first) return
  const ifaceId = `endpoint-${first.id}`
  names.forEach((n) => ownerOfMessage.set(n, ifaceId))
})

// 报文实体：携带传输配置与字段引用；ownerIfaceId 标注排他归属
export const interfaces = scopedMessages.map((message) => ({
  ...message,
  name: withSuffix(message.name, '报文'),
  ownerIfaceId: ownerOfMessage.get(message.name) || null,
}))

// 测试接口：直挂报文（messageIds）
export const testInterfaces = IFACE_GROUPS.map((names) => {
  const msgs = names.map((n) => scopedMessages.find((m) => m.name === n)).filter(Boolean)
  const first = msgs[0]
  return {
    id: ownerOfMessage.get(first.name),
    name: withSuffix(first.name, '接口'),
    systemId: first.systemId,
    moduleId: first.moduleId,
    datasetIds: [...new Set(msgs.flatMap((m) => m.datasetIds || []))],
    desc: `${first.name}联试接口`,
    strategy: {
      trigger: 'manual',
      scheduleAt: null,
      periodicInterval: 60,
      periodicUnit: 's',
      periodicCount: null,
    },
    sendInterval: 500,
    messageIds: msgs.map((m) => m.id),
  }
})

/* ────────────────────────────────────────────
 *  五、联试任务 (Tasks)
 * ──────────────────────────────────────────── */
const allTasks = [
  // 武器管理
  { id: 't01', name: '武器状态报文连通性测试', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), ruleSetId: 'rs-weapon-status', status: '执行中', time: '2026-06-24 10:31:00', remark: '验证 WM-001 报文在标准帧格式下的握手与应答流程' },
  { id: 't02', name: '弹药余量边界值检测', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'), status: '已完成', time: '2026-06-24 09:45:00', remark: '覆盖 0%/100% 边界值，已生成测试报告' },
  { id: 't03', name: '武器挂载自检流程验证', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), status: '已完成', time: '2026-06-24 09:10:00', remark: '' },
  { id: 't04', name: '挂载识别字段字段校验', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), status: '执行中', time: '2026-06-24 10:50:00', remark: '逐字段对比字段 v1.3 与实物载荷数据' },
  // 火控指挥
  { id: 't05', name: '火控解算异常回放', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), status: '异常', time: '2026-06-24 09:20:00', remark: '回放 08:55 采集的异常帧数据，解算结果偏差超限' },
  { id: 't06', name: '指挥链路报告生成任务', systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'), status: '待确认', time: '2026-06-24 08:50:00', remark: '链路当前不通，待恢复后自动执行' },
  { id: 't07', name: '目标分配字段一致性检测', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), status: '执行中', time: '2026-06-24 10:15:00', remark: '对比字段 v2.1 与 v2.2 的字段差异' },
  { id: 't08', name: '航迹融合精度验证', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), status: '已完成', time: '2026-06-24 08:30:00', remark: '多传感器融合误差 < 50m，满足指标' },
  // 雷达探测
  { id: 't09', name: '雷达回波帧格式验证', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'), status: '执行中', time: '2026-06-24 11:00:00', remark: '检查 IQ 采样帧头与通道编号的一致性' },
  { id: 't10', name: '天线伺服接收时延测试', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'), status: '已完成', time: '2026-06-24 10:05:00', remark: '方位阶跃接收 < 200ms，俯仰 < 150ms' },
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
  { id: 't21', name: '载荷控制接收测试', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'), status: '已完成', time: '2026-06-24 10:00:00', remark: '模式切换延迟 < 100ms，变焦接收正常' },
  { id: 't22', name: '图像流质量评估', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'), status: '执行中', time: '2026-06-24 10:45:00', remark: '高清图传丢包率与延迟测试' },
  // 指挥控制
  { id: 't23', name: '态势融合实时性测试', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), status: '执行中', time: '2026-06-24 11:15:00', remark: '多源数据融合延迟 ≤ 1s 验证' },
  { id: 't24', name: '作战方案评估打分', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'), status: '待确认', time: '2026-06-24 10:30:00', remark: '3 套方案评分排序，待指挥员确认' },
  { id: 't25', name: '指令下发全链路测试', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'), status: '已完成', time: '2026-06-24 09:55:00', remark: '指令从生成到接收确认全链路 < 2s' },
  { id: 't26', name: '操作日志合规审计', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), status: '已完成', time: '2026-06-24 08:45:00', remark: '本周操作日志全量审计完成' },
]
export const tasks = allTasks.filter(inSeedScope)

/* ────────────────────────────────────────────
 *  六、规则集 (Rule Sets)
 * ──────────────────────────────────────────── */
const allRuleSets = [
  // ── 1. 武器管理 · 查询设备状态 ──
  {
    id: 'rs-weapon-status',
    name: '设备状态接收基础规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '武器管理模块'),
    status: 'enabled',
    desc: '校验字段取值范围，以及长度声明与后续载荷解析结果的语义一致性。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 10:30',
    rules: [
      { id: 'r-range-code', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32', min: -2147483648, max: 2147483647 }, desc: '状态码取值不得超出 int32 范围' },
      { id: 'r-range-data-length', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.dataLength', fieldName: 'dataLength' }, params: { dataType: 'uint16', min: 0, max: 4096 }, desc: '载荷声明长度必须位于 0~4096 字节' },
      { id: 'r-semantic-payload-length', type: 'semantic', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.payload', fieldName: 'payload' }, params: { declaredPath: 'response.dataLength', actualPath: 'response.payload', measure: 'byteLength' }, desc: '声明长度必须与后续载荷实际解析字节数一致' },
    ]
  },

  // ── 2. 弹药状态 · 上报弹药余量 ──
  {
    id: 'rs-ammo-report',
    name: '弹药余量上报校验规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '弹药状态模块'),
    status: 'enabled',
    desc: '覆盖弹药余量接收各字段的类型、范围、一致性与超时校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 11:00',
    rules: [
      { id: 'r-ammo-type-total', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.total', fieldName: 'total' }, params: { dataType: 'uint16' }, desc: '弹药总量字段必须为 uint16' },
      { id: 'r-ammo-range-total', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.total', fieldName: 'total' }, params: { dataType: 'uint16', min: 0, max: 65535 }, desc: '弹药总量不得超出 uint16 范围' },
      { id: 'r-ammo-range-avail', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.available', fieldName: 'available' }, params: { dataType: 'uint16', min: 0, max: 65535 }, desc: '可用量不得超出 uint16 范围' },
      { id: 'r-ammo-range-typeA', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '上报弹药余量', fieldPath: 'response.detail.typeA', fieldName: 'typeA' }, params: { dataType: 'uint16', min: 0, max: 9999 }, desc: 'A 型弹药余量合理范围 0~9999' },
      { id: 'r-ammo-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '上报弹药余量', fieldPath: '', fieldName: '' }, params: { timeoutMs: 800 }, desc: '弹药余量上报接收时延不得超过 800ms' },
    ]
  },

  // ── 3. 挂载检测 · 挂载状态查询 ──
  {
    id: 'rs-pylon-status',
    name: '挂载状态查询校验规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '挂载检测模块'),
    status: 'enabled',
    desc: '校验挂载状态接收中挂点编号、载荷类型、锁定状态等字段。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 09:15',
    rules: [
      { id: 'r-pylon-type-pylonNo', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.pylonNo', fieldName: 'pylonNo' }, params: { dataType: 'uint8' }, desc: '挂点号必须为 uint8' },
      { id: 'r-pylon-range-loadType', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.loadType', fieldName: 'loadType' }, params: { dataType: 'uint8', min: 0, max: 15 }, desc: '载荷类型编码范围 0~15' },
      { id: 'r-pylon-range-locked', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.locked', fieldName: 'locked' }, params: { dataType: 'uint8', min: 0, max: 1 }, desc: '锁定状态仅允许 0（未锁定）或 1（已锁定）' },
      { id: 'r-pylon-overflow-raw', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.rawFrame', fieldName: 'rawFrame' }, params: { required: true, maxLength: 512 }, desc: '原始识别帧必须存在且长度不超过 512 字节' },
      { id: 'r-pylon-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载状态查询', fieldPath: '', fieldName: '' }, params: { timeoutMs: 600 }, desc: '挂载状态查询接收时延不得超过 600ms' },
    ]
  },

  // ── 4. 火控解算 · 目标分配解算 ──
  {
    id: 'rs-fire-solve',
    name: '目标分配解算校验规则集',
    systemId: 'sys-fire',
    moduleId: byName('sys-fire', '火控解算模块'),
    status: 'enabled',
    desc: '覆盖火控解算接收结果码、方案文件与原始帧的完整性校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 14:20',
    rules: [
      { id: 'r-fire-type-result', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32' }, desc: '解算结果码必须为 int32' },
      { id: 'r-fire-range-result', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32', min: 0, max: 255 }, desc: '解算结果码合法取值 0~255' },
      { id: 'r-fire-boundary-result', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32', min: 0, max: 255, boundaryMode: 'inclusive' }, desc: '解算结果码命中边界值时提醒' },
      { id: 'r-fire-overflow-plan', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.plan', fieldName: 'plan' }, params: { required: true, maxLength: 4096 }, desc: '分配方案文件必须存在且不超过 4096 字节' },
      { id: 'r-fire-overflow-raw', type: 'overflow', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.raw', fieldName: 'raw' }, params: { required: false, maxLength: 1024 }, desc: '原始解算帧长度不超过 1024 字节' },
      { id: 'r-fire-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标分配解算', fieldPath: '', fieldName: '' }, params: { timeoutMs: 300 }, desc: '火控解算接收时延不得超过 300ms（实时性要求高）' },
    ]
  },

  // ── 5. 目标跟踪 · 航迹订阅 ──
  {
    id: 'rs-track-sub',
    name: '航迹订阅接收校验规则集',
    systemId: 'sys-fire',
    moduleId: byName('sys-fire', '目标跟踪模块'),
    status: 'enabled',
    desc: '校验航迹订阅成功数与会话标识字段的类型和范围。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 08:30',
    rules: [
      { id: 'r-track-type-sub', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '航迹订阅', fieldPath: 'response.subscribed', fieldName: 'subscribed' }, params: { dataType: 'uint8' }, desc: '成功订阅数必须为 uint8' },
      { id: 'r-track-range-sub', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹订阅', fieldPath: 'response.subscribed', fieldName: 'subscribed' }, params: { dataType: 'uint8', min: 0, max: 64 }, desc: '单次最多订阅 64 条航迹' },
      { id: 'r-track-type-sid', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '航迹订阅', fieldPath: 'response.sessionId', fieldName: 'sessionId' }, params: { dataType: 'uint32' }, desc: '会话标识必须为 uint32' },
      { id: 'r-track-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹订阅', fieldPath: '', fieldName: '' }, params: { timeoutMs: 400 }, desc: '航迹订阅接收时延不得超过 400ms' },
    ]
  },

  // ── 6. 天线控制 · 天线指向控制 ──
  {
    id: 'rs-antenna-point',
    name: '天线指向控制校验规则集',
    systemId: 'sys-radar',
    moduleId: byName('sys-radar', '天线控制模块'),
    status: 'enabled',
    desc: '覆盖天线方位角、俯仰角范围约束及接收完整性校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-25 10:00',
    rules: [
      { id: 'r-ant-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '接收状态码必须为 int32' },
      { id: 'r-ant-range-az', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualAz', fieldName: 'actualAz' }, params: { dataType: 'float', min: 0, max: 360 }, desc: '实际方位角范围 0°~360°' },
      { id: 'r-ant-range-el', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualEl', fieldName: 'actualEl' }, params: { dataType: 'float', min: -90, max: 90 }, desc: '实际俯仰角范围 -90°~90°' },
      { id: 'r-ant-boundary-az', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualAz', fieldName: 'actualAz' }, params: { dataType: 'float', min: 0, max: 360, boundaryMode: 'inclusive' }, desc: '方位角到达 0°/360° 边界时提醒' },
      { id: 'r-ant-overflow-code', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.code', fieldName: 'code' }, params: { required: true, maxLength: 4 }, desc: '状态码字段必须存在' },
      { id: 'r-ant-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: '', fieldName: '' }, params: { timeoutMs: 200 }, desc: '天线伺服接收时延不得超过 200ms（阶跃接收要求）' },
    ]
  },

  // ── 7. 目标识别 · 目标识别发送 ──
  {
    id: 'rs-target-identify',
    name: '目标识别接收校验规则集',
    systemId: 'sys-radar',
    moduleId: byName('sys-radar', '目标识别模块'),
    status: 'draft',
    desc: '覆盖目标类别、置信度、RCS 等字段的完整校验。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 14:30',
    rules: [
      { id: 'r-tgt-type-cat', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标识别发送', fieldPath: 'response.category', fieldName: 'category' }, params: { dataType: 'uint8' }, desc: '目标类别必须为 uint8' },
      { id: 'r-tgt-range-cat', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别发送', fieldPath: 'response.category', fieldName: 'category' }, params: { dataType: 'uint8', min: 0, max: 10 }, desc: '目标类别编码 0~10（含未知/战斗机/运输机等）' },
      { id: 'r-tgt-range-conf', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别发送', fieldPath: 'response.confidence', fieldName: 'confidence' }, params: { dataType: 'uint8', min: 0, max: 100 }, desc: '置信度百分比范围 0~100' },
      { id: 'r-tgt-boundary-conf', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标识别发送', fieldPath: 'response.confidence', fieldName: 'confidence' }, params: { dataType: 'uint8', min: 0, max: 100, boundaryMode: 'inclusive' }, desc: '置信度为 0 或 100 时提醒' },
      { id: 'r-tgt-range-rcs', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '目标识别发送', fieldPath: 'response.rcsDb', fieldName: 'rcsDb' }, params: { dataType: 'float', min: -50, max: 50 }, desc: 'RCS dBsm 合理范围 -50~50' },
      { id: 'r-tgt-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别发送', fieldPath: '', fieldName: '' }, params: { timeoutMs: 1000 }, desc: '目标识别接收时延不得超过 1000ms' },
      { id: 'r-tgt-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标识别发送', fieldPath: '', fieldName: '' }, params: { sampleType: 'json' }, desc: '接收结构必须是合法 JSON' },
    ]
  },

  // ── 8. 卫星通信 · 卫通建链 ──
  {
    id: 'rs-sat-link',
    name: '卫通建链接收校验规则集',
    systemId: 'sys-comm',
    moduleId: byName('sys-comm', '卫星通信模块'),
    status: 'enabled',
    desc: '校验卫通建链接收的状态码、信号强度与链路速率。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 16:00',
    rules: [
      { id: 'r-sat-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '卫通建链', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-sat-range-signal', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: 'response.signalStrength', fieldName: 'signalStrength' }, params: { dataType: 'int16', min: -120, max: 0 }, desc: '信号强度范围 -120~0 dBm' },
      { id: 'r-sat-range-rate', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: 'response.linkRate', fieldName: 'linkRate' }, params: { dataType: 'uint32', min: 0, max: 100000000 }, desc: '链路速率 0~100Mbps' },
      { id: 'r-sat-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: '', fieldName: '' }, params: { timeoutMs: 5000 }, desc: '卫通建链接收时延不得超过 5000ms（卫星链路延迟容忍度高）' },
      { id: 'r-sat-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '卫通建链', fieldPath: '', fieldName: '' }, params: { sampleType: 'hex' }, desc: '卫通接收帧格式必须合法' },
    ]
  },

  // ── 9. 惯性导航 · 惯导校准 ──
  {
    id: 'rs-ins-calibrate',
    name: '惯导校准接收校验规则集',
    systemId: 'sys-nav',
    moduleId: byName('sys-nav', '惯性导航模块'),
    status: 'enabled',
    desc: '校验惯导校准接收的状态码、预计就绪时间与零偏漂移。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 16:45',
    rules: [
      { id: 'r-ins-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-ins-range-ready', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: 'response.readyTime', fieldName: 'readyTime' }, params: { dataType: 'uint16', min: 0, max: 600 }, desc: '预计就绪时间 0~600s（10分钟内）' },
      { id: 'r-ins-range-drift', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: 'response.drift', fieldName: 'drift' }, params: { dataType: 'float', min: -10, max: 10 }, desc: '零偏漂移合理范围 -10~10' },
      { id: 'r-ins-boundary-drift', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: 'response.drift', fieldName: 'drift' }, params: { dataType: 'float', min: -10, max: 10, boundaryMode: 'inclusive' }, desc: '零偏漂移接近边界时提醒' },
      { id: 'r-ins-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: '', fieldName: '' }, params: { timeoutMs: 2000 }, desc: '惯导校准接收时延不得超过 2000ms' },
      { id: 'r-ins-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: '', fieldName: '' }, params: { sampleType: 'json' }, desc: '接收结构必须是合法 JSON' },
    ]
  },

  // ── 10. 卫星定位 · 定位数据查询 ──
  {
    id: 'rs-position-query',
    name: '定位数据查询校验规则集',
    systemId: 'sys-nav',
    moduleId: byName('sys-nav', '卫星定位模块'),
    status: 'enabled',
    desc: '校验定位接收中经纬度、海拔、定位状态等字段的合理性。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 11:20',
    rules: [
      { id: 'r-pos-range-lat', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.lat', fieldName: 'lat' }, params: { dataType: 'double', min: -90, max: 90 }, desc: '纬度范围 -90°~90°' },
      { id: 'r-pos-range-lon', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.lon', fieldName: 'lon' }, params: { dataType: 'double', min: -180, max: 180 }, desc: '经度范围 -180°~180°' },
      { id: 'r-pos-range-alt', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.alt', fieldName: 'alt' }, params: { dataType: 'float', min: -500, max: 50000 }, desc: '海拔范围 -500m~50000m' },
      { id: 'r-pos-range-fix', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '定位数据查询', fieldPath: 'response.fixStatus', fieldName: 'fixStatus' }, params: { dataType: 'uint8', min: 0, max: 5 }, desc: '定位状态枚举值 0~5' },
      { id: 'r-pos-range-sat', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.satCount', fieldName: 'satCount' }, params: { dataType: 'uint8', min: 0, max: 64 }, desc: '可见星数 0~64（GPS+BDS）' },
      { id: 'r-pos-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: '', fieldName: '' }, params: { timeoutMs: 1000 }, desc: '定位数据查询接收时延不得超过 1000ms' },
    ]
  },

  // ── 11. 干扰执行 · 干扰任务下发 ──
  {
    id: 'rs-jam-task',
    name: '干扰任务下发校验规则集',
    systemId: 'sys-ew',
    moduleId: byName('sys-ew', '干扰执行模块'),
    status: 'draft',
    desc: '校验干扰任务下发接收的状态码与任务编号。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 15:00',
    rules: [
      { id: 'r-jam-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-jam-overflow-taskId', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: 'response.taskId', fieldName: 'taskId' }, params: { required: true, maxLength: 4 }, desc: '干扰任务编号必须存在' },
      { id: 'r-jam-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '干扰任务下发', fieldPath: '', fieldName: '' }, params: { timeoutMs: 500 }, desc: '干扰任务下发接收时延不得超过 500ms' },
      { id: 'r-jam-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: '', fieldName: '' }, params: { sampleType: 'hex' }, desc: '干扰指令接收帧格式必须合法' },
    ]
  },

]
export const ruleSets = allRuleSets.filter(inSeedScope)

/* ────────────────────────────────────────────
 *  七、接收异常数据 (Exception Samples)
 *  只描述已经收到的数据本身，不包含超时、级别或处置状态。
 * ──────────────────────────────────────────── */
const allAlerts = [
  { id: 'a01', type: '字段约束异常', iface: 'WM-003', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), capturedTime: '2026-06-24 10:05:00', field: 'temperature', value: 256, remark: 'temperature=256，超出 uint8 允许范围 0~255' },
  { id: 'a02', type: '结构异常', iface: 'WM-006', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'), capturedTime: '2026-06-24 09:58:00', field: 'checksum', value: '0x37', remark: '帧头声明校验码 0x37，重新计算结果为 0x3A' },
  { id: 'a03', type: '规则校验异常', iface: 'PY-012', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), capturedTime: '2026-06-24 10:30:00', field: 'loadType', value: 18, remark: 'loadType=18，不在接口规则允许的载荷类型集合内' },
  { id: 'a04', type: '字段约束异常', iface: 'FC-025', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), capturedTime: '2026-06-24 10:22:00', field: 'resultCode', value: 511, remark: 'resultCode=511，超出字段上限 255' },
  { id: 'a05', type: '字段约束异常', iface: 'TK-031', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), capturedTime: '2026-06-24 11:02:00', field: 'distance', value: 520000, remark: 'distance=520000，超出字段上限 500000' },
  { id: 'a06', type: '结构异常', iface: 'RD-001', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'), capturedTime: '2026-06-24 11:08:00', field: 'syncHeader', value: '0xDEADBEEF', remark: '同步头相对协议定义偏移 2 字节，后续字段无法按矩阵对齐' },
  { id: 'a07', type: '无法解析', iface: 'IR-015', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'), capturedTime: '2026-06-24 11:14:00', field: 'frame', value: '', remark: '接收数据无法匹配当前接口绑定的任何报文结构' },
  { id: 'a08', type: '规则校验异常', iface: 'DL-003', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'), capturedTime: '2026-06-24 11:20:00', field: 'sequence', value: 104, remark: 'sequence=104，与上一帧序号 102 不连续' },
  { id: 'a09', type: '结构异常', iface: 'SAT-007', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'), capturedTime: '2026-06-24 11:26:00', field: 'totalLength', value: 84, remark: '报文头声明长度 84 字节，实际接收 80 字节' },
  { id: 'a10', type: '字段约束异常', iface: 'INS-002', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'), capturedTime: '2026-06-24 11:32:00', field: 'gyroBiasZ', value: 12.8, remark: 'gyroBiasZ=12.8，超出标定字段范围 -10~10' },
  { id: 'a11', type: '规则校验异常', iface: 'GNSS-005', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'), capturedTime: '2026-06-24 11:38:00', field: 'fixStatus', value: 1, remark: 'fixStatus=1 时 satCount 必须大于等于 4，实际为 2' },
  { id: 'a12', type: '字段约束异常', iface: 'EW-009', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'), capturedTime: '2026-06-24 11:44:00', field: 'centerFrequency', value: 19500, remark: 'centerFrequency=19500MHz，超出字段上限 18000MHz' },
  { id: 'a13', type: '结构异常', iface: 'JAM-004', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'), capturedTime: '2026-06-24 11:50:00', field: 'payloadLength', value: 64, remark: '载荷声明长度 64 字节，实际解析得到 60 字节' },
  { id: 'a14', type: '无法解析', iface: 'VID-003', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'), capturedTime: '2026-06-24 11:56:00', field: 'frame', value: '', remark: '原始码流缺少已配置的帧同步标识，无法建立字段边界' },
  { id: 'a15', type: '规则校验异常', iface: 'SA-008', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), capturedTime: '2026-06-24 12:02:00', field: 'longitude', value: 181.2, remark: 'longitude=181.2，不满足经度范围规则 -180~180' },
  { id: 'a16', type: '结构异常', iface: 'ORD-005', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'), capturedTime: '2026-06-24 12:08:00', field: 'crc', value: '0xA18C', remark: '帧尾 CRC 声明值 0xA18C，与重算值 0xA19F 不一致' },
]
export const alerts = allAlerts.filter(inSeedScope)

/* ────────────────────────────────────────────
 *  六、执行历史 (Run History) —— 统计与可视化数据底座
 *  说明：执行编排的 store.history 为会话级且字段薄；此处提供一份数值化、
 *  可复算的历史执行记录，供【统计与可视化】聚合（发送量/时延/通过率/报文覆盖等）。
 *  全部为可客观度量的字段，不含被测系统内部资源等无法获取的指标。
 * ──────────────────────────────────────────── */
const _stClamp = (n, min, max) => Math.max(min, Math.min(max, n))
// 确定性伪随机（固定种子，保证每次加载数据一致）
const _stRng = (() => {
  let s = 20260625
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
})()
const _sr = (a, b) => Math.round(a + _stRng() * (b - a))
const _pad2 = (n) => String(n).padStart(2, '0')
const _stDays = ['2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25']

export const runHistory = []
let _runSeq = 0
testInterfaces.forEach((iface) => {
  // 留出部分接口“未测”，让接口覆盖率有意义（非 100%）
  if (_stRng() < 0.22) return
  const mod = nodes.find((n) => n.id === iface.moduleId)
  const runCount = 2 + (iface.systemId === 'sys-weapon' ? 2 : (_stRng() < 0.4 ? 1 : 0))
  for (let k = 0; k < runCount; k++) {
    const day = _stDays[_sr(0, _stDays.length - 1)]
    const hh = _pad2(_sr(8, 18))
    const mm = _pad2(_sr(0, 59))
    const total = _sr(12, 140)
    const abnormal = 0
    const success = Math.max(0, total - abnormal)
    const baseLat = _sr(20, 180)
    const durations = Array.from({ length: 12 }, () =>
      _stClamp(Math.round(baseLat + (_stRng() - 0.5) * baseLat * 1.2 + (_stRng() < 0.1 ? _sr(150, 420) : 0)), 4, 820)
    )
    const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    const executionTime = _sr(6, 90)
    runHistory.push({
      id: `seedrun-${++_runSeq}`,
      systemId: iface.systemId,
      moduleId: iface.moduleId,
      moduleName: mod?.name || '',
      taskId: '',
      taskName: `${iface.name} 联试`,
      interfaceId: iface.id,
      iface: iface.name,
      proto: iface.transportType || 'OSE',
      startedAt: `${day} ${hh}:${mm}:00`,
      finishedAt: `${day} ${hh}:${_pad2(_sr(0, 59))}:30`,
      dateKey: day,
      total,
      success,
      abnormal,
      abnormalTypes: {},
      failed: abnormal,
      error: 0,
      avgMs,
      durations,
      executionTime,
      rps: Number((total / executionTime).toFixed(1)),
    })
  }
})

