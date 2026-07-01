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

/* ========== Broker 节点 ========== */
const brokerNodes = [
  node({ systemId: 'sys-weapon', name: 'RabbitMQ Broker', ip: '192.168.10.33', port: 5672, desc: '武器管理系统 RabbitMQ 消息中间件', reachable: true, status: 'online', latency: 3, nodeType: 'broker', brokerType: 'RabbitMQ', managementPort: 15672, authInfo: { username: 'admin', password: '******' }, healthCheck: { level1: { status: 'pass', latency: 2, detail: 'TCP 192.168.10.33:5672 连接成功 (2ms)' }, level2: { status: 'pass', latency: 45, detail: 'AMQP 握手成功，认证通过 (45ms)' }, level3: { status: 'pass', detail: '2 节点在线，12 队列正常，8 消费者活跃', metrics: { nodes: 2, queues: 12, consumers: 8 } }, lastCheck: '2026-06-28 14:23:05', overall: 'healthy' } }),
  node({ systemId: 'sys-fire', name: 'Kafka Broker', ip: '192.168.20.47', port: 9092, desc: '火控系统 Kafka 消息中间件', reachable: true, status: 'online', latency: 5, nodeType: 'broker', brokerType: 'Kafka', managementPort: 9090, authInfo: { username: 'kafka_admin', password: '******' }, healthCheck: { level1: { status: 'pass', latency: 3, detail: 'TCP 192.168.20.47:9092 连接成功 (3ms)' }, level2: { status: 'pass', latency: 67, detail: 'AdminClient 连接成功，SASL 认证通过 (67ms)' }, level3: { status: 'pass', detail: '3 节点在线，18 分区正常，6 消费者活跃', metrics: { nodes: 3, queues: 18, consumers: 6 } }, lastCheck: '2026-06-28 14:22:58', overall: 'healthy' } }),
  node({ systemId: 'sys-cmd', name: 'Kafka Broker', ip: '192.168.80.63', port: 9092, desc: '指控系统 Kafka 消息中间件', reachable: true, status: 'online', latency: 4, nodeType: 'broker', brokerType: 'Kafka', managementPort: 9090, authInfo: { username: 'kafka_admin', password: '******' }, healthCheck: { level1: { status: 'pass', latency: 4, detail: 'TCP 192.168.80.63:9092 连接成功 (4ms)' }, level2: { status: 'pass', latency: 52, detail: 'AdminClient 连接成功，SASL 认证通过 (52ms)' }, level3: { status: 'warning', detail: '3 节点在线（1 节点磁盘使用率 > 85%），24 分区', metrics: { nodes: 3, queues: 24, consumers: 12 } }, lastCheck: '2026-06-28 14:23:12', overall: 'warning' } }),
  node({ systemId: 'sys-cmd', name: 'RabbitMQ Broker', ip: '192.168.80.60', port: 5672, desc: '指控系统 RabbitMQ 消息中间件', reachable: true, status: 'online', latency: 2, nodeType: 'broker', brokerType: 'RabbitMQ', managementPort: 15672, authInfo: { username: 'guest', password: '******' }, healthCheck: { level1: { status: 'pass', latency: 2, detail: 'TCP 192.168.80.60:5672 连接成功 (2ms)' }, level2: { status: 'pass', latency: 38, detail: 'AMQP 握手成功，认证通过 (38ms)' }, level3: { status: 'pass', detail: '1 节点在线，8 队列正常，5 消费者活跃', metrics: { nodes: 1, queues: 8, consumers: 5 } }, lastCheck: '2026-06-28 14:23:08', overall: 'healthy' } }),
]
nodes.push(...brokerNodes)

// 关联 MQ 模块到 Broker
const linkBrokerByName = (sys, moduleName, brokerName) => {
  const mod = nodes.find(n => n.systemId === sys && n.name === moduleName && n.nodeType !== 'broker')
  const broker = nodes.find(n => n.systemId === sys && n.name === brokerName && n.nodeType === 'broker')
  if (mod && broker) mod.connectedBrokerId = broker.id
}
linkBrokerByName('sys-weapon', '挂载检测模块', 'RabbitMQ Broker')
linkBrokerByName('sys-fire', '目标跟踪模块', 'Kafka Broker')
linkBrokerByName('sys-cmd', '日志审计模块', 'Kafka Broker')
linkBrokerByName('sys-cmd', '态势感知模块', 'RabbitMQ Broker')

/* ────────────────────────────────────────────
 *  三、协议 (Protocols) —— 字节/位层级结构
 * ──────────────────────────────────────────── */
const _p = (o) => {
  const type = o.type || 'TCP'
  const isByteStream = type === 'TCP' || type === 'UDP'
  return {
    id: pid(),
    type,
    desc: '',
    config: {
      endian: 'big',
      fields: [],
      ...(isByteStream ? {
        framing: { mode: 'fixed', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '', footerBytes: '' },
        checksum: { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' },
      } : {}),
    },
    ...o
  }
}

/* ========== calcOffsets 增强：处理 repeat ========== */
const calcOffsets = (fields) => {
  let offset = 0
  for (const f of fields) {
    f.byteOffset = offset
    if (f.kind === 'repeat') {
      const groupSize = f.children.reduce((s, c) => s + (c.byteLength || 0), 0)
      f.groupByteSize = groupSize
      offset += groupSize * (f.repeatCount || 1)
    } else {
      offset += f.byteLength
    }
  }
  return fields
}

export const protocols = [
  // ── 武器管理 ──
  _p({
    name: '帧控制字节协议', type: 'TCP', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: '1 字节帧控制位标志（bit7 → bit0），适用于压缩/加密等按位场景',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧控制位标志', byteLength: 1, bitMode: true, desc: '帧控制字节，拆分为7段位', children: [
        bitField({ name: '加密标志', bitStart: 7, bitEnd: 7, constraint: range(0, 1), desc: '1=加密，0=明文' }),
        bitField({ name: '压缩标志', bitStart: 6, bitEnd: 6, constraint: range(0, 1), desc: '1=压缩，0=未压缩' }),
        bitField({ name: '分片标志', bitStart: 5, bitEnd: 5, constraint: range(0, 1), desc: '1=分片包，0=完整包' }),
        bitField({ name: '应答标志', bitStart: 4, bitEnd: 4, constraint: range(0, 1), desc: '1=应答包，0=业务包' }),
        bitField({ name: '保留位', bitStart: 3, bitEnd: 3, constraint: fixed(0), desc: '预留协议扩展' }),
        bitField({ name: '保留位', bitStart: 2, bitEnd: 2, constraint: fixed(0), desc: '预留协议扩展' }),
        bitField({ name: '数据类型', bitStart: 1, bitEnd: 0, constraint: range(0, 3), desc: '00=JSON 01=二进制 10=字符串 11=XML' }),
      ]}),
    ])}
  }),
  _p({
    name: '武器挂载识别协议', type: 'TCP', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    desc: '挂点载荷识别与状态上报帧',
    config: { endian: 'big',
      framing: { mode: 'delimiter', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: 'AA55', footerBytes: '' },
      checksum: { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' },
      fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, dataType: 'raw', constraint: fixed(0xAA55), desc: '固定 0xAA55' }),
      byteField({ name: '挂点编号', byteLength: 1, dataType: 'uint8', constraint: range(1, 12), desc: '挂点 1~12' }),
      byteField({ name: '载荷类型', byteLength: 1, dataType: 'uint8', constraint: enumC([
        { value: 0, label: '空' }, { value: 1, label: '导弹' }, { value: 2, label: '火箭' },
        { value: 3, label: '吊舱' }, { value: 4, label: '副油箱' }, { value: 5, label: '其他' }
      ]), desc: '载荷类型枚举' }),
      byteField({ name: '载荷重量', byteLength: 2, dataType: 'uint16', constraint: range(0, 9999), desc: '单位 kg' }),
      byteField({ name: '锁定状态', byteLength: 1, dataType: 'uint8', constraint: enumC([{ value: 0, label: '未锁定' }, { value: 1, label: '锁定' }]), desc: '锁定状态' }),
    ])}
  }),
  _p({
    name: '弹药编目协议', type: 'TCP', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'),
    desc: '弹药类型与批次编目帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0xCC), desc: '固定 0xCC' }),
      byteField({ name: '弹药类型', byteLength: 1, constraint: range(0, 10), desc: '弹药型号编码' }),
      byteField({ name: '批次号', byteLength: 2, constraint: range(0, 65535), desc: '生产批次' }),
      byteField({ name: '有效期', byteLength: 2, constraint: range(0, 9999), desc: '剩余有效天数' }),
    ])}
  }),
  _p({
    name: '武器遥测广播协议', type: 'UDP', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: '武器状态 UDP 广播帧，周期性上报各挂点实时状态',
    config: { endian: 'big',
      framing: { mode: 'fixed', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '', footerBytes: '' },
      checksum: { type: 'sum8', fieldId: null, rangeStart: 0, rangeEnd: 6, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' },
      fields: calcOffsets([
        byteField({ name: '帧头', byteLength: 2, dataType: 'raw', constraint: fixed(0xDD55), desc: '固定 0xDD55' }),
        byteField({ name: '设备编号', byteLength: 1, dataType: 'uint8', constraint: range(1, 32), desc: '武器管理设备编号' }),
        byteField({ name: '遥测计数', byteLength: 1, dataType: 'uint8', constraint: range(0, 255), desc: '本轮广播序号' }),
        byteField({ name: '各挂点状态', byteLength: 2, dataType: 'uint16', constraint: range(0, 65535), desc: 'bit0~bit11 对应 12 挂点，1=已装填 0=空' }),
        byteField({ name: '校验和', byteLength: 1, dataType: 'uint8', constraint: range(0, 255), desc: 'Sum8 校验' }),
      ])
    }
  }),
  _p({
    name: '武器状态查询接口', type: 'HTTP', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'),
    desc: 'REST 接口查询武器挂载状态与弹药余量',
    config: {
      method: 'GET',
      path: '/api/v1/weapon/{deviceId}/status',
      contentType: 'application/json',
      pathParams: [
        { id: pid(), name: 'deviceId', dataType: 'string', required: true, defaultValue: '', constraint: { mode: 'none' }, desc: '设备编号' },
      ],
      queryParams: [
        { id: pid(), name: 'detail', dataType: 'boolean', required: false, defaultValue: 'false', constraint: { mode: 'none' }, desc: '是否返回详细信息' },
        { id: pid(), name: 'onlineOnly', dataType: 'boolean', required: false, defaultValue: 'true', constraint: { mode: 'none' }, desc: '仅返回在线设备' },
      ],
      requestBody: { fields: [], fileType: '', fieldName: '' },
      headers: [
        { key: 'Accept', value: 'application/json' },
        { key: 'X-System-Id', value: 'sys-weapon' },
      ],
      auth: { type: 'basic', username: 'admin', password: '', token: '', keyName: '', keyLocation: 'header', keyValue: '' },
      responses: [
        { id: pid(), statusCode: 200, headers: [{ key: 'Content-Type', value: 'application/json' }], bodyFields: [
          { id: pid(), name: 'code', dataType: 'integer', required: true, constraint: { mode: 'none' }, desc: '状态码', children: [] },
          { id: pid(), name: 'data', dataType: 'object', required: true, constraint: { mode: 'none' }, desc: '设备状态数据', children: [
            { id: pid(), name: 'deviceId', dataType: 'string', required: true, constraint: { mode: 'none' }, desc: '设备编号', children: [] },
            { id: pid(), name: 'online', dataType: 'boolean', required: true, constraint: { mode: 'none' }, desc: '是否在线', children: [] },
            { id: pid(), name: 'pylons', dataType: 'array', required: true, constraint: { mode: 'none' }, desc: '挂点列表', children: [] },
          ]},
        ], desc: '查询成功' },
        { id: pid(), statusCode: 404, headers: [], bodyFields: [
          { id: pid(), name: 'error', dataType: 'string', required: true, constraint: { mode: 'none' }, desc: '错误描述', children: [] },
        ], desc: '设备不存在' },
      ],
    }
  }),
  _p({
    name: '弹药库存查询服务', type: 'gRPC', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'),
    desc: 'gRPC Unary 调用查询弹药库存与有效期',
    config: {
      serviceName: 'AmmoInventoryService',
      methodName: 'QueryStock',
      protoRef: 'ammo_inventory.proto',
      streamingMode: 'unary',
      requestMessage: [
        { id: pid(), fieldNumber: 1, name: 'ammo_type', type: 'int32', modifier: 'optional', constraint: { mode: 'range', min: 0, max: 10, value: 0 }, desc: '弹药类型（0=全部）', children: [] },
        { id: pid(), fieldNumber: 2, name: 'include_expired', type: 'bool', modifier: 'optional', constraint: { mode: 'none' }, desc: '是否包含已过期', children: [] },
      ],
      responseMessage: [
        { id: pid(), fieldNumber: 1, name: 'total_count', type: 'int32', modifier: 'required', constraint: { mode: 'none' }, desc: '总库存数', children: [] },
        { id: pid(), fieldNumber: 2, name: 'items', type: 'message', modifier: 'repeated', constraint: { mode: 'none' }, desc: '库存条目列表', children: [
          { id: pid(), fieldNumber: 1, name: 'batch_id', type: 'string', modifier: 'required', constraint: { mode: 'none' }, desc: '批次号', children: [] },
          { id: pid(), fieldNumber: 2, name: 'ammo_type', type: 'int32', modifier: 'required', constraint: { mode: 'range', min: 0, max: 10, value: 0 }, desc: '弹药类型', children: [] },
          { id: pid(), fieldNumber: 3, name: 'quantity', type: 'int32', modifier: 'required', constraint: { mode: 'range', min: 0, max: 99999, value: 0 }, desc: '数量', children: [] },
          { id: pid(), fieldNumber: 4, name: 'expiry_days', type: 'int32', modifier: 'optional', constraint: { mode: 'range', min: 0, max: 9999, value: 0 }, desc: '剩余有效天数', children: [] },
        ]},
      ],
      metadata: [
        { key: 'system-id', value: 'sys-weapon', mode: 'static', desc: '系统标识' },
      ],
      serverAddress: '192.168.10.32:50051',
      tls: { enabled: false, certPath: '' },
      timeout: 10,
      compression: 'none',
    }
  }),
  _p({
    name: '挂载变更通知协议', type: 'MQ', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    desc: '挂载状态变更时通过 RabbitMQ 异步广播通知',
    config: {
      brokerType: 'RabbitMQ', brokerAddress: '192.168.10.33:5672',
      topic: '', queueName: 'mount-change-queue', exchangeName: 'weapon-exchange', routingKey: 'mount.change',
      consumerGroup: '', qos: 1, ackMode: 'auto', messageFormat: 'JSON',
      messageBody: [
        { id: pid(), name: 'eventId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '事件唯一标识', children: [] },
        { id: pid(), name: 'timestamp', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '变更发生时间', children: [] },
        { id: pid(), name: 'aircraftId', dataType: 'int32', required: true, constraint: { mode: 'range', min: 1, max: 9999, value: 0 }, desc: '飞机编号', children: [] },
        { id: pid(), name: 'pylonNo', dataType: 'int32', required: true, constraint: { mode: 'range', min: 1, max: 12, value: 0 }, desc: '挂点号', children: [] },
        { id: pid(), name: 'changeType', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'mount', label: '挂载' }, { value: 'unmount', label: '卸载' }, { value: 'replace', label: '更换' }] }, desc: '变更类型', children: [] },
        { id: pid(), name: 'payload', dataType: 'struct', required: true, constraint: { mode: 'none' }, desc: '载荷信息（共识体）', children: [
          { id: pid(), name: 'loadType', dataType: 'int32', required: true, constraint: { mode: 'range', min: 0, max: 5, value: 0 }, desc: '载荷类型', children: [] },
          { id: pid(), name: 'weight', dataType: 'int32', required: true, constraint: { mode: 'range', min: 0, max: 9999, value: 0 }, desc: '重量 kg', children: [] },
          { id: pid(), name: 'locked', dataType: 'uint8', required: true, constraint: { mode: 'none' }, desc: '是否锁定', children: [] },
        ]},
      ],
      messageHeaders: [
        { id: pid(), key: 'correlation_id', dataType: 'utf8', required: true, defaultValue: '', desc: '请求关联 ID' },
        { id: pid(), key: 'content_type', dataType: 'utf8', required: true, defaultValue: 'application/json', desc: '消息内容类型' },
        { id: pid(), key: 'priority', dataType: 'int32', required: false, defaultValue: '5', desc: '消息优先级 0~9' },
      ],
      messageKey: { dataType: 'utf8', pattern: '', desc: '' },
    }
  }),

  // ── 火控指挥 ──
  _p({
    name: '遥测帧协议', type: 'TCP', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'),
    desc: '遥测下行帧（按位定义，可跨字节）',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xEB90), desc: '固定 0xEB90' }),
      byteField({ name: '设备ID', byteLength: 1, constraint: range(0, 255), desc: '分系统编号' }),
      byteField({ name: '温度', byteLength: 4, constraint: range(-5000, 15000), desc: '摄氏度 ×100' }),
    ])}
  }),
  _p({
    name: '目标航迹帧协议', type: 'TCP', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    desc: '多目标航迹融合输出帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xF1F2), desc: '固定 0xF1F2' }),
      byteField({ name: '目标编号', byteLength: 2, constraint: range(1, 256), desc: '航迹编号' }),
      byteField({ name: '方位角', byteLength: 2, constraint: range(0, 36000), desc: '0.01° 精度' }),
      byteField({ name: '俯仰角', byteLength: 2, constraint: range(-9000, 9000), desc: '0.01° 精度' }),
      byteField({ name: '距离', byteLength: 4, constraint: range(0, 500000), desc: '单位 m' }),
      byteField({ name: '速度', byteLength: 2, constraint: range(0, 3000), desc: '单位 m/s' }),
      byteField({ name: '置信度', byteLength: 1, constraint: range(0, 100), desc: '融合置信度百分比' }),
    ])}
  }),

  // ── 雷达探测 ──
  _p({
    name: '雷达回波帧协议', type: 'TCP', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'),
    desc: '雷达基带回波 IQ 采样帧（含重复组示例）',
    config: { endian: 'big',
      framing: { mode: 'delimiter', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: 'DEADBEEF', footerBytes: '' },
      checksum: { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' },
      fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 4, dataType: 'raw', constraint: fixed(0xDEADBEEF), desc: '固定 0xDEADBEEF' }),
      byteField({ name: '脉冲编号', byteLength: 2, dataType: 'uint16', constraint: range(0, 65535), desc: 'PRI 序号' }),
      byteField({ name: '通道号', byteLength: 1, dataType: 'uint8', constraint: range(0, 15), desc: '接收通道 0~15' }),
      byteField({ name: '采样点数', byteLength: 2, dataType: 'uint16', constraint: range(64, 4096), desc: '本帧 IQ 采样数' }),
      repeatGroup({
        name: 'IQ采样数据', repeatMode: 'fixed', repeatCount: 2,
        children: [
          byteField({ name: 'I路数据', byteLength: 2, dataType: 'int16', constraint: range(-32768, 32767), desc: '同相分量' }),
          byteField({ name: 'Q路数据', byteLength: 2, dataType: 'int16', constraint: range(-32768, 32767), desc: '正交分量' }),
        ]
      }),
    ])}
  }),
  _p({
    name: '天线伺服控制协议', type: 'TCP', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'),
    desc: '天线方位/俯仰指令与反馈帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0x5A), desc: '固定 0x5A' }),
      byteField({ name: '指令类型', byteLength: 1, constraint: range(0, 4), desc: '0=停止 1=搜索 2=跟踪 3=标定 4=归零' }),
      byteField({ name: '目标方位', byteLength: 2, constraint: range(0, 36000), desc: '0.01° 精度' }),
      byteField({ name: '目标俯仰', byteLength: 2, constraint: range(-2000, 8000), desc: '0.01° 精度' }),
      byteField({ name: '扫描速率', byteLength: 1, constraint: range(0, 60), desc: '°/s' }),
    ])}
  }),
  _p({
    name: '目标特征帧协议', type: 'TCP', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'),
    desc: '目标 RCS 特征与分类结果帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xBB01), desc: '固定 0xBB01' }),
      byteField({ name: '目标ID', byteLength: 2, constraint: range(1, 512), desc: '识别目标编号' }),
      byteField({ name: 'RCS均值', byteLength: 2, constraint: range(0, 10000), desc: '0.01 m²' }),
      byteField({ name: '目标类别', byteLength: 1, constraint: range(0, 6), desc: '0=未知 1=战斗机 2=运输机 3=直升机 4=导弹 5=无人机 6=舰船' }),
      byteField({ name: '识别置信度', byteLength: 1, constraint: range(0, 100), desc: '百分比' }),
    ])}
  }),

  // ── 通信保障 ──
  _p({
    name: '数据链帧协议', type: 'UDP', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'),
    desc: '战术数据链 TADIL 帧格式',
    config: { endian: 'big',
      framing: { mode: 'delimiter', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '1ACF', footerBytes: '' },
      checksum: { type: 'crc16', fieldId: null, rangeStart: 0, rangeEnd: 6, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' },
      fields: calcOffsets([
      byteField({ name: '帧同步头', byteLength: 2, dataType: 'raw', constraint: fixed(0x1ACF), desc: '帧同步码' }),
      byteField({ name: '消息类型', byteLength: 1, dataType: 'uint8', constraint: range(0, 15), desc: 'J 系列消息编号' }),
      byteField({ name: '发送方ID', byteLength: 2, dataType: 'uint16', constraint: range(1, 512), desc: '网络参与方编号' }),
      byteField({ name: '优先级', byteLength: 1, dataType: 'uint8', bitMode: true, desc: '0=最低 7=最高', children: [
        bitField({ name: '优先级值', bitStart: 2, bitEnd: 0, dataType: 'uint', constraint: range(0, 7), desc: '3位优先级编码' }),
        bitField({ name: '保留', bitStart: 7, bitEnd: 3, dataType: 'uint', constraint: fixed(0), desc: '预留' }),
      ]}),
      byteField({ name: 'CRC校验', byteLength: 2, dataType: 'uint16', constraint: range(0, 65535), desc: 'CRC-16/CCITT' }),
    ])}
  }),
  _p({
    name: '卫通链路管理协议', type: 'TCP', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'),
    desc: '卫星通信建链/保链/断链控制帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0x7E), desc: '固定 0x7E' }),
      byteField({ name: '操作码', byteLength: 1, constraint: range(0, 5), desc: '0=建链 1=保链 2=断链 3=切星 4=功率调整 5=状态查询' }),
      byteField({ name: '卫星编号', byteLength: 1, constraint: range(1, 32), desc: '在轨卫星编号' }),
      byteField({ name: '信号强度', byteLength: 1, constraint: range(0, 100), desc: 'dBm 归一化' }),
    ])}
  }),

  // ── 导航定位 ──
  _p({
    name: '惯导数据帧协议', type: 'TCP', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'),
    desc: 'IMU 六轴原始数据与姿态角输出帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0x4E41), desc: '固定 "NA"' }),
      byteField({ name: '陀螺X', byteLength: 4, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      byteField({ name: '陀螺Y', byteLength: 4, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      byteField({ name: '陀螺Z', byteLength: 4, constraint: range(-32768, 32767), desc: '角速度 ×1000 °/s' }),
      byteField({ name: '加速度X', byteLength: 2, constraint: range(-16384, 16383), desc: 'mg' }),
      byteField({ name: '加速度Y', byteLength: 2, constraint: range(-16384, 16383), desc: 'mg' }),
      byteField({ name: '加速度Z', byteLength: 2, constraint: range(-16384, 16383), desc: 'mg' }),
    ])}
  }),
  _p({
    name: '卫通定位帧协议', type: 'TCP', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'),
    desc: '北斗/GPS 双模定位解算输出帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0x24), desc: '固定 $' }),
      byteField({ name: '定位标志', byteLength: 1, bitMode: true, desc: '系统标识与定位状态', children: [
        bitField({ name: '系统标识', bitStart: 7, bitEnd: 4, constraint: range(0, 3), desc: '0=GPS 1=BDS 2=双模 3=GLONASS' }),
        bitField({ name: '定位状态', bitStart: 3, bitEnd: 0, constraint: range(0, 5), desc: '0=无效 1=单点 2=DGPS 3=RTK固定 4=RTK浮点 5=惯导辅助' }),
      ]}),
      byteField({ name: '可见星数', byteLength: 1, constraint: range(0, 40), desc: '可见卫星数' }),
      byteField({ name: 'HDOP', byteLength: 2, constraint: range(10, 9999), desc: '精度因子 ×100' }),
    ])}
  }),

  // ── 电子对抗 ──
  _p({
    name: '电磁侦察帧协议', type: 'TCP', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'),
    desc: '电磁环境信号侦察与参数测量帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xE5E5), desc: '固定 0xE5E5' }),
      byteField({ name: '信号类型', byteLength: 1, constraint: range(0, 8), desc: '0=脉冲 1=连续波 2=跳频 3=扩频 4=噪声' }),
      byteField({ name: '中心频率', byteLength: 4, constraint: range(100, 18000), desc: 'MHz' }),
      byteField({ name: '脉宽', byteLength: 2, constraint: range(1, 10000), desc: 'μs' }),
      byteField({ name: '脉冲重复频率', byteLength: 2, constraint: range(1, 50000), desc: 'Hz' }),
    ])}
  }),
  _p({
    name: '干扰指令帧协议', type: 'TCP', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'),
    desc: '有源/无源干扰参数下发帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0x4A), desc: '固定 0x4A' }),
      byteField({ name: '干扰模式', byteLength: 1, constraint: range(0, 5), desc: '0=噪声压制 1=欺骗 2=瞄准 3=阻塞 4=箔条 5=红外诱饵' }),
      byteField({ name: '干扰频段', byteLength: 2, constraint: range(100, 18000), desc: 'MHz' }),
      byteField({ name: '功率等级', byteLength: 1, constraint: range(0, 10), desc: '0~10 级' }),
      byteField({ name: '持续时间', byteLength: 2, constraint: range(1, 600), desc: '单位 0.1s' }),
    ])}
  }),

  // ── 无人机管控 ──
  _p({
    name: '飞控遥测帧协议', type: 'UDP', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'),
    desc: '无人机飞行状态遥测下行帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0x55AA), desc: '固定 0x55AA' }),
      byteField({ name: '飞行模式', byteLength: 1, constraint: range(0, 5), desc: '0=手动 1=半自主 2=全自主 3=返航 4=降落 5=紧急' }),
      byteField({ name: '高度', byteLength: 2, constraint: range(0, 15000), desc: '单位 m' }),
      byteField({ name: '空速', byteLength: 2, constraint: range(0, 500), desc: '单位 km/h' }),
      byteField({ name: '航向角', byteLength: 2, constraint: range(0, 36000), desc: '0.01° 精度' }),
      byteField({ name: '电池电量', byteLength: 1, constraint: range(0, 100), desc: '百分比' }),
    ])}
  }),
  _p({
    name: '载荷控制帧协议', type: 'TCP', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'),
    desc: '光电/红外载荷指令帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 1, constraint: fixed(0x6C), desc: '固定 0x6C' }),
      byteField({ name: '载荷类型', byteLength: 1, constraint: range(0, 3), desc: '0=可见光 1=红外 2=SAR 3=多光谱' }),
      byteField({ name: '工作模式', byteLength: 1, constraint: range(0, 4), desc: '0=待机 1=搜索 2=跟踪 3=录像 4=拍照' }),
      byteField({ name: '云台俯仰', byteLength: 2, constraint: range(-9000, 3000), desc: '0.01° 精度' }),
      byteField({ name: '变焦倍率', byteLength: 1, constraint: range(1, 30), desc: '光学变焦' }),
    ])}
  }),

  // ── 指挥控制 ──
  _p({
    name: '态势标注帧协议', type: 'TCP', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    desc: '战场态势目标标注与更新帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xC0DE), desc: '固定 0xC0DE' }),
      byteField({ name: '标注类型', byteLength: 1, constraint: range(0, 5), desc: '0=友军 1=敌方 2=中性 3=障碍 4=区域 5=路线' }),
      byteField({ name: '经度', byteLength: 4, constraint: range(-18000000, 18000000), desc: '×100000' }),
      byteField({ name: '纬度', byteLength: 4, constraint: range(-9000000, 9000000), desc: '×100000' }),
      byteField({ name: '时间戳', byteLength: 4, constraint: range(0, 4294967295), desc: 'Unix 秒' }),
    ])}
  }),
  _p({
    name: '作战指令编码协议', type: 'TCP', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'),
    desc: '作战指令结构化编码帧',
    config: { endian: 'big', fields: calcOffsets([
      byteField({ name: '帧头', byteLength: 2, constraint: fixed(0xC0D0), desc: '固定标识' }),
      byteField({ name: '指令头', byteLength: 1, bitMode: true, desc: '指令类型与优先级', children: [
        bitField({ name: '指令类型', bitStart: 7, bitEnd: 4, constraint: range(0, 10), desc: '0=机动 1=攻击 2=防御 3=侦察 4=撤退 5=集结' }),
        bitField({ name: '优先级', bitStart: 3, bitEnd: 1, constraint: range(0, 7), desc: '0=常规 7=特急' }),
        bitField({ name: '保留', bitStart: 0, bitEnd: 0, constraint: fixed(0), desc: '预留' }),
      ]}),
      byteField({ name: '执行单位', byteLength: 2, constraint: range(1, 256), desc: '单位编号' }),
      byteField({ name: '有效时段', byteLength: 2, constraint: range(1, 1440), desc: '分钟' }),
    ])}
  }),

  // ── HTTP 协议示例 ──
  _p({
    name: 'REST态势查询协议', type: 'HTTP', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    desc: '基于 RESTful API 的态势数据查询与上报协议',
    config: {
      method: 'GET',
      path: '/api/v1/situation/{areaId}/targets',
      contentType: 'application/json',
      pathParams: [
        { id: pid(), name: 'areaId', dataType: 'string', required: true, defaultValue: '', constraint: { mode: 'none' }, desc: '区域编号' },
      ],
      queryParams: [
        { id: pid(), name: 'type', dataType: 'string', required: false, defaultValue: 'all', constraint: { mode: 'none' }, desc: '目标类型过滤（all/air/sea/land）' },
        { id: pid(), name: 'limit', dataType: 'integer', required: false, defaultValue: '50', constraint: { mode: 'range', min: 1, max: 500, value: 0 }, desc: '返回数量上限' },
        { id: pid(), name: 'since', dataType: 'string', required: false, defaultValue: '', constraint: { mode: 'none' }, desc: '时间戳过滤（ISO8601）' },
      ],
      requestBody: { fields: [], fileType: '', fieldName: '' },
      headers: [
        { key: 'Authorization', value: 'Bearer {token}' },
        { key: 'X-Request-Id', value: '{uuid}' },
        { key: 'Accept-Language', value: 'zh-CN' },
      ],
      auth: { type: 'bearer', username: '', password: '', token: '', keyName: '', keyLocation: 'header', keyValue: '' },
      responses: [
        { id: pid(), statusCode: 200, headers: [{ key: 'Content-Type', value: 'application/json' }], bodyFields: [
          { id: pid(), name: 'code', dataType: 'integer', required: true, constraint: { mode: 'none' }, desc: '业务状态码', children: [] },
          { id: pid(), name: 'data', dataType: 'object', required: true, constraint: { mode: 'none' }, desc: '态势数据', children: [
            { id: pid(), name: 'targets', dataType: 'array', required: true, constraint: { mode: 'none' }, desc: '目标列表', children: [] },
            { id: pid(), name: 'total', dataType: 'integer', required: true, constraint: { mode: 'none' }, desc: '目标总数', children: [] },
          ]},
          { id: pid(), name: 'message', dataType: 'string', required: false, constraint: { mode: 'none' }, desc: '提示信息', children: [] },
        ], desc: '成功响应' },
        { id: pid(), statusCode: 401, headers: [], bodyFields: [
          { id: pid(), name: 'error', dataType: 'string', required: true, constraint: { mode: 'none' }, desc: '错误描述', children: [] },
        ], desc: '认证失败' },
        { id: pid(), statusCode: 404, headers: [], bodyFields: [], desc: '区域不存在' },
      ],
    }
  }),
  _p({
    name: '作战方案上报接口', type: 'HTTP', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'),
    desc: '上报作战方案文档与参数',
    config: {
      method: 'POST',
      path: '/api/v1/plan/upload',
      contentType: 'multipart/form-data',
      pathParams: [],
      queryParams: [
        { id: pid(), name: 'async', dataType: 'boolean', required: false, defaultValue: 'true', constraint: { mode: 'none' }, desc: '是否异步处理' },
      ],
      requestBody: {
        fields: [
          { id: pid(), name: 'missionType', dataType: 'string', required: true, constraint: { mode: 'none' }, desc: '任务类型', children: [] },
          { id: pid(), name: 'planName', dataType: 'string', required: true, constraint: { mode: 'length', minLen: 1, maxLen: 64 }, desc: '方案名称', children: [] },
          { id: pid(), name: 'parameters', dataType: 'object', required: true, constraint: { mode: 'none' }, desc: '方案参数', children: [
            { id: pid(), name: 'maxDuration', dataType: 'integer', required: true, constraint: { mode: 'range', min: 1, max: 1440, value: 0 }, desc: '最大时长(分钟)', children: [] },
            { id: pid(), name: 'riskLevel', dataType: 'integer', required: true, constraint: { mode: 'range', min: 0, max: 5, value: 0 }, desc: '风险等级', children: [] },
          ]},
        ],
        fileType: '',
        fieldName: '',
      },
      headers: [
        { key: 'Authorization', value: 'Bearer {token}' },
        { key: 'X-Api-Version', value: '2.0' },
      ],
      auth: { type: 'bearer', username: '', password: '', token: '', keyName: '', keyLocation: 'header', keyValue: '' },
      responses: [
        { id: pid(), statusCode: 200, headers: [], bodyFields: [
          { id: pid(), name: 'planId', dataType: 'string', required: true, constraint: { mode: 'none' }, desc: '方案ID', children: [] },
          { id: pid(), name: 'status', dataType: 'string', required: true, constraint: { mode: 'enum', entries: [{ value: 'accepted', label: '已接收' }, { value: 'processing', label: '处理中' }] }, desc: '处理状态', children: [] },
        ], desc: '上报成功' },
        { id: pid(), statusCode: 400, headers: [], bodyFields: [
          { id: pid(), name: 'errors', dataType: 'array', required: true, constraint: { mode: 'none' }, desc: '参数错误列表', children: [] },
        ], desc: '参数校验失败' },
      ],
    }
  }),

  // ── gRPC 协议示例 ──
  _p({
    name: '航迹流式推送服务', type: 'gRPC', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    desc: '基于 gRPC Server-Streaming 的实时航迹推送',
    config: {
      serviceName: 'TrackService',
      methodName: 'SubscribeTrack',
      protoRef: 'track_service.proto',
      streamingMode: 'server-stream',
      requestMessage: [
        { id: pid(), fieldNumber: 1, name: 'target_ids', type: 'int32', modifier: 'repeated', constraint: { mode: 'none' }, desc: '订阅目标ID列表', children: [] },
        { id: pid(), fieldNumber: 2, name: 'interval_ms', type: 'int32', modifier: 'optional', constraint: { mode: 'range', min: 50, max: 5000, value: 0 }, desc: '推送间隔(毫秒)', children: [] },
        { id: pid(), fieldNumber: 3, name: 'filter', type: 'message', modifier: 'optional', constraint: { mode: 'none' }, desc: '过滤条件', children: [
          { id: pid(), fieldNumber: 1, name: 'min_speed', type: 'float', modifier: 'optional', constraint: { mode: 'none' }, desc: '最小速度', children: [] },
          { id: pid(), fieldNumber: 2, name: 'max_distance', type: 'float', modifier: 'optional', constraint: { mode: 'none' }, desc: '最大距离', children: [] },
        ]},
      ],
      responseMessage: [
        { id: pid(), fieldNumber: 1, name: 'track_id', type: 'int32', modifier: 'required', constraint: { mode: 'none' }, desc: '航迹编号', children: [] },
        { id: pid(), fieldNumber: 2, name: 'timestamp', type: 'int64', modifier: 'required', constraint: { mode: 'none' }, desc: '时间戳(μs)', children: [] },
        { id: pid(), fieldNumber: 3, name: 'position', type: 'message', modifier: 'required', constraint: { mode: 'none' }, desc: '位置信息', children: [
          { id: pid(), fieldNumber: 1, name: 'azimuth', type: 'float', modifier: 'required', constraint: { mode: 'range', min: 0, max: 360, value: 0 }, desc: '方位角(°)', children: [] },
          { id: pid(), fieldNumber: 2, name: 'elevation', type: 'float', modifier: 'required', constraint: { mode: 'range', min: -90, max: 90, value: 0 }, desc: '俯仰角(°)', children: [] },
          { id: pid(), fieldNumber: 3, name: 'distance', type: 'float', modifier: 'required', constraint: { mode: 'range', min: 0, max: 500000, value: 0 }, desc: '距离(m)', children: [] },
        ]},
        { id: pid(), fieldNumber: 4, name: 'velocity', type: 'float', modifier: 'optional', constraint: { mode: 'none' }, desc: '速度(m/s)', children: [] },
        { id: pid(), fieldNumber: 5, name: 'confidence', type: 'float', modifier: 'optional', constraint: { mode: 'range', min: 0, max: 1, value: 0 }, desc: '置信度', children: [] },
      ],
      metadata: [
        { key: 'auth-token', value: '{jwt}', mode: 'dynamic', desc: '认证令牌，运行时注入' },
        { key: 'client-id', value: 'joint-test-tool', mode: 'static', desc: '客户端标识' },
      ],
      serverAddress: '192.168.20.47:50051',
      tls: { enabled: false, certPath: '' },
      timeout: 30,
      compression: 'gzip',
    }
  }),
  _p({
    name: '目标识别双向流服务', type: 'gRPC', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'),
    desc: '基于 gRPC Bidirectional Streaming 的实时目标识别',
    config: {
      serviceName: 'TargetRecognition',
      methodName: 'RecognizeStream',
      protoRef: 'recognition_service.proto',
      streamingMode: 'bidirectional',
      requestMessage: [
        { id: pid(), fieldNumber: 1, name: 'track_id', type: 'int32', modifier: 'required', constraint: { mode: 'none' }, desc: '目标航迹ID', children: [] },
        { id: pid(), fieldNumber: 2, name: 'rcs_features', type: 'float', modifier: 'repeated', constraint: { mode: 'none' }, desc: 'RCS特征向量', children: [] },
        { id: pid(), fieldNumber: 3, name: 'radar_params', type: 'message', modifier: 'optional', constraint: { mode: 'none' }, desc: '雷达参数', children: [
          { id: pid(), fieldNumber: 1, name: 'frequency_mhz', type: 'float', modifier: 'optional', constraint: { mode: 'range', min: 100, max: 18000, value: 0 }, desc: '工作频率', children: [] },
          { id: pid(), fieldNumber: 2, name: 'prf_hz', type: 'int32', modifier: 'optional', constraint: { mode: 'none' }, desc: '脉冲重复频率', children: [] },
        ]},
      ],
      responseMessage: [
        { id: pid(), fieldNumber: 1, name: 'track_id', type: 'int32', modifier: 'required', constraint: { mode: 'none' }, desc: '对应航迹ID', children: [] },
        { id: pid(), fieldNumber: 2, name: 'category', type: 'int32', modifier: 'required', constraint: { mode: 'enum', entries: [{ value: 0, label: '未知' }, { value: 1, label: '战斗机' }, { value: 2, label: '运输机' }, { value: 3, label: '直升机' }, { value: 4, label: '导弹' }, { value: 5, label: '无人机' }] }, desc: '目标类别', children: [] },
        { id: pid(), fieldNumber: 3, name: 'confidence', type: 'float', modifier: 'required', constraint: { mode: 'range', min: 0, max: 1, value: 0 }, desc: '识别置信度', children: [] },
        { id: pid(), fieldNumber: 4, name: 'rcs_dbsm', type: 'float', modifier: 'optional', constraint: { mode: 'none' }, desc: 'RCS(dBsm)', children: [] },
      ],
      metadata: [
        { key: 'model-version', value: 'v2.1', mode: 'static', desc: '识别模型版本' },
        { key: 'session-id', value: '', mode: 'dynamic', desc: '会话标识，运行时生成' },
      ],
      serverAddress: '192.168.30.12:50052',
      tls: { enabled: false, certPath: '' },
      timeout: 60,
      compression: 'none',
    }
  }),

  // ── 消息队列协议示例 ──
  _p({
    name: '告警事件订阅协议', type: 'MQ', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'),
    desc: '基于 Kafka 的告警事件异步消息订阅',
    config: {
      brokerType: 'Kafka', brokerAddress: '192.168.80.63:9092',
      topic: 'alert-events', queueName: '', exchangeName: '', routingKey: '',
      consumerGroup: 'cmd-audit-group', qos: 1, ackMode: 'manual', messageFormat: 'JSON',
      messageBody: [
        { id: pid(), name: 'alertId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '告警唯一标识', children: [] },
        { id: pid(), name: 'timestamp', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '告警触发时间', children: [] },
        { id: pid(), name: 'systemId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '来源系统 ID', children: [] },
        { id: pid(), name: 'level', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }] }, desc: '告警等级', children: [] },
        { id: pid(), name: 'category', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'field_overflow', label: '字段越界' }, { value: 'timeout', label: '响应超时' }, { value: 'format_error', label: '格式错误' }, { value: 'link_down', label: '链路中断' }] }, desc: '告警类别', children: [] },
        { id: pid(), name: 'detail', dataType: 'struct', required: true, constraint: { mode: 'none' }, desc: '告警详情（共识体）', children: [
          { id: pid(), name: 'interfaceName', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '关联接口名称', children: [] },
          { id: pid(), name: 'fieldPath', dataType: 'utf8', required: false, constraint: { mode: 'none' }, desc: '异常字段路径', children: [] },
          { id: pid(), name: 'message', dataType: 'utf8', required: true, constraint: { mode: 'length', minLen: 1, maxLen: 1024 }, desc: '告警描述', children: [] },
        ]},
        { id: pid(), name: 'tags', dataType: 'struct', required: false, constraint: { mode: 'none' }, desc: '标签列表（共识体）', children: [] },
      ],
      messageHeaders: [
        { id: pid(), key: 'kafka_key', dataType: 'utf8', required: true, defaultValue: '', desc: 'Kafka 分区键' },
        { id: pid(), key: 'source_system', dataType: 'utf8', required: true, defaultValue: '', desc: '来源系统标识' },
        { id: pid(), key: 'trace_id', dataType: 'utf8', required: false, defaultValue: '', desc: '分布式追踪 ID' },
      ],
      messageKey: { dataType: 'utf8', pattern: '{systemId}-{level}', desc: '按系统+等级分区路由' },
    }
  }),

  // ── 新增 MQ 协议：航迹数据分发 ──
  _p({
    name: '航迹数据分发协议', type: 'MQ', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    desc: '基于 Kafka 的实时航迹数据分发给下游系统',
    config: {
      brokerType: 'Kafka', brokerAddress: '192.168.20.47:9092',
      topic: 'track-data', queueName: '', exchangeName: '', routingKey: '',
      consumerGroup: 'track-consumers', qos: 1, ackMode: 'auto', messageFormat: 'JSON',
      messageBody: [
        { id: pid(), name: 'trackId', dataType: 'int32', required: true, constraint: { mode: 'range', min: 1, max: 65535, value: 0 }, desc: '航迹编号', children: [] },
        { id: pid(), name: 'timestamp', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '采集时间', children: [] },
        { id: pid(), name: 'position', dataType: 'struct', required: true, constraint: { mode: 'none' }, desc: '位置信息（共识体）', children: [
          { id: pid(), name: 'azimuth', dataType: 'float32', required: true, constraint: { mode: 'range', min: 0, max: 360, value: 0 }, desc: '方位角 °', children: [] },
          { id: pid(), name: 'elevation', dataType: 'float32', required: true, constraint: { mode: 'range', min: -90, max: 90, value: 0 }, desc: '俯仰角 °', children: [] },
          { id: pid(), name: 'distance', dataType: 'float32', required: true, constraint: { mode: 'range', min: 0, max: 500000, value: 0 }, desc: '距离 m', children: [] },
        ]},
        { id: pid(), name: 'velocity', dataType: 'float32', required: false, constraint: { mode: 'range', min: 0, max: 3000, value: 0 }, desc: '速度 m/s', children: [] },
        { id: pid(), name: 'confidence', dataType: 'float32', required: false, constraint: { mode: 'range', min: 0, max: 1, value: 0 }, desc: '置信度', children: [] },
        { id: pid(), name: 'targetType', dataType: 'utf8', required: false, constraint: { mode: 'enum', entries: [{ value: 'unknown', label: '未知' }, { value: 'fighter', label: '战斗机' }, { value: 'transport', label: '运输机' }, { value: 'missile', label: '导弹' }, { value: 'uav', label: '无人机' }] }, desc: '目标类型', children: [] },
      ],
      messageHeaders: [
        { id: pid(), key: 'kafka_key', dataType: 'utf8', required: true, defaultValue: '', desc: '分区键(航迹ID)' },
        { id: pid(), key: 'content_type', dataType: 'utf8', required: true, defaultValue: 'application/json', desc: '内容类型' },
      ],
      messageKey: { dataType: 'int32', pattern: '{trackId}', desc: '按航迹ID分区，保证同一航迹有序' },
    }
  }),

  // ── 新增 MQ 协议：态势更新广播 ──
  _p({
    name: '态势更新广播协议', type: 'MQ', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    desc: '基于 RabbitMQ 的态势数据变更广播给各终端',
    config: {
      brokerType: 'RabbitMQ', brokerAddress: '192.168.80.60:5672',
      topic: '', queueName: 'situation-fanout', exchangeName: 'situation-exchange', routingKey: 'situation.update',
      consumerGroup: '', qos: 1, ackMode: 'auto', messageFormat: 'JSON',
      messageBody: [
        { id: pid(), name: 'updateId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '更新批次ID', children: [] },
        { id: pid(), name: 'timestamp', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '更新时间', children: [] },
        { id: pid(), name: 'areaId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '区域编号', children: [] },
        { id: pid(), name: 'changeType', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'add', label: '新增目标' }, { value: 'update', label: '更新目标' }, { value: 'remove', label: '移除目标' }] }, desc: '变更类型', children: [] },
        { id: pid(), name: 'entities', dataType: 'struct', required: true, constraint: { mode: 'none' }, desc: '变更实体列表（共识体）', children: [
          { id: pid(), name: 'entityId', dataType: 'int32', required: true, constraint: { mode: 'range', min: 1, max: 65535, value: 0 }, desc: '实体编号', children: [] },
          { id: pid(), name: 'type', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'friendly', label: '友军' }, { value: 'hostile', label: '敌方' }, { value: 'neutral', label: '中性' }] }, desc: '实体类型', children: [] },
          { id: pid(), name: 'lat', dataType: 'float64', required: true, constraint: { mode: 'range', min: -90, max: 90, value: 0 }, desc: '纬度', children: [] },
          { id: pid(), name: 'lon', dataType: 'float64', required: true, constraint: { mode: 'range', min: -180, max: 180, value: 0 }, desc: '经度', children: [] },
        ]},
      ],
      messageHeaders: [
        { id: pid(), key: 'correlation_id', dataType: 'utf8', required: true, defaultValue: '', desc: '关联ID' },
        { id: pid(), key: 'expiration', dataType: 'int32', required: false, defaultValue: '60000', desc: '消息TTL(ms)' },
      ],
      messageKey: { dataType: 'utf8', pattern: '', desc: '' },
    }
  }),

  // ── 新增 MQ 协议：挂载变更通知 ──
  _p({
    name: '挂载变更通知协议', type: 'MQ', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    desc: '基于 RabbitMQ 的挂载状态变更实时通知',
    config: {
      brokerType: 'RabbitMQ', brokerAddress: '192.168.10.33:5672',
      topic: '', queueName: 'mount-change-queue', exchangeName: 'weapon-exchange', routingKey: 'mount.change',
      consumerGroup: '', qos: 1, ackMode: 'manual', messageFormat: 'JSON',
      messageBody: [
        { id: pid(), name: 'changeId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '变更事件唯一标识', children: [] },
        { id: pid(), name: 'timestamp', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '变更触发时间', children: [] },
        { id: pid(), name: 'aircraftId', dataType: 'utf8', required: true, constraint: { mode: 'none' }, desc: '飞机编号', children: [] },
        { id: pid(), name: 'pylonNo', dataType: 'int32', required: true, constraint: { mode: 'range', min: 1, max: 12, value: 0 }, desc: '挂点编号', children: [] },
        { id: pid(), name: 'changeType', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'mount', label: '挂载' }, { value: 'unmount', label: '卸载' }, { value: 'swap', label: '更换' }] }, desc: '变更类型', children: [] },
        { id: pid(), name: 'loadType', dataType: 'utf8', required: true, constraint: { mode: 'enum', entries: [{ value: 'empty', label: '空' }, { value: 'missile', label: '导弹' }, { value: 'rocket', label: '火箭' }, { value: 'pod', label: '吊舱' }, { value: 'tank', label: '副油箱' }] }, desc: '载荷类型', children: [] },
        { id: pid(), name: 'weight', dataType: 'int32', required: true, constraint: { mode: 'range', min: 0, max: 9999, value: 0 }, desc: '载荷重量 kg', children: [] },
        { id: pid(), name: 'locked', dataType: 'uint8', required: true, constraint: { mode: 'none' }, desc: '是否锁定', children: [] },
        { id: pid(), name: 'operator', dataType: 'utf8', required: false, constraint: { mode: 'none' }, desc: '操作员', children: [] },
      ],
      messageHeaders: [
        { id: pid(), key: 'correlation_id', dataType: 'utf8', required: true, defaultValue: '', desc: '关联ID' },
        { id: pid(), key: 'source_module', dataType: 'utf8', required: true, defaultValue: 'mount-detect', desc: '来源模块' },
        { id: pid(), key: 'priority', dataType: 'utf8', required: false, defaultValue: 'normal', desc: '消息优先级' },
      ],
      messageKey: { dataType: 'utf8', pattern: '{aircraftId}-{pylonNo}', desc: '按飞机+挂点分区路由' },
    }
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
      param({ name: 'pylonList', type: '共识体', desc: '挂点列表', children: [
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

  // ── MQ 消息队列接口 ──
  _i({
    name: '挂载变更通知', path: 'mount.change', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),
    operationType: 'publish',
    desc: '向 RabbitMQ weapon-exchange 发布挂载状态变更消息',
    request: [
      param({ name: 'aircraftId', type: '常量', dataType: 'utf8', desc: '飞机编号' }),
      param({ name: 'pylonNo', type: '常量', dataType: 'uint8', desc: '挂点编号' }),
      param({ name: 'changeType', type: '常量', dataType: 'utf8', desc: '变更类型: mount/unmount/swap' }),
      param({ name: 'loadType', type: '常量', dataType: 'utf8', desc: '载荷类型' }),
      param({ name: 'weight', type: '常量', dataType: 'uint16', desc: '载荷重量 kg' }),
    ],
    response: [
      param({ name: 'aircraftId', type: '常量', dataType: 'utf8', desc: '飞机编号' }),
      param({ name: 'pylonNo', type: '常量', dataType: 'uint8', desc: '挂点编号' }),
      param({ name: 'changeType', type: '常量', dataType: 'utf8', desc: '变更类型' }),
      param({ name: 'loadType', type: '常量', dataType: 'utf8', desc: '载荷类型' }),
      param({ name: 'weight', type: '常量', dataType: 'uint16', desc: '载荷重量 kg' }),
      param({ name: 'messageId', type: '常量', dataType: 'utf8', desc: '消息ID' }),
      param({ name: 'published', type: '常量', dataType: 'uint8', desc: '1=已发布' }),
    ]
  }),
  _i({
    name: '告警事件订阅', path: 'alert-events', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'),
    operationType: 'subscribe',
    desc: '从 Kafka alert-events Topic 订阅消费告警事件消息',
    request: [
      param({ name: 'consumerGroup', type: '常量', dataType: 'utf8', desc: '消费组: cmd-audit-group' }),
      param({ name: 'autoOffsetReset', type: '常量', dataType: 'utf8', desc: '偏移重置策略: earliest' }),
    ],
    response: [
      param({ name: 'alertId', type: '常量', dataType: 'utf8', desc: '告警ID' }),
      param({ name: 'level', type: '常量', dataType: 'utf8', desc: '告警等级' }),
      param({ name: 'category', type: '常量', dataType: 'utf8', desc: '告警类别' }),
      param({ name: 'detail', type: '共识体', desc: '告警详情', children: [
        param({ name: 'interfaceName', type: '常量', dataType: 'utf8', desc: '关联接口' }),
        param({ name: 'message', type: '常量', dataType: 'utf8', desc: '告警描述' }),
      ]}),
    ]
  }),
  _i({
    name: '航迹数据分发', path: 'track-data', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'),
    operationType: 'publish',
    desc: '向 Kafka track-data Topic 发布实时航迹数据给下游系统',
    request: [
      param({ name: 'trackId', type: '常量', dataType: 'uint16', desc: '航迹编号' }),
      param({ name: 'position', type: '共识体', desc: '位置信息', children: [
        param({ name: 'azimuth', type: '常量', dataType: 'float32', desc: '方位角 °' }),
        param({ name: 'elevation', type: '常量', dataType: 'float32', desc: '俯仰角 °' }),
        param({ name: 'distance', type: '常量', dataType: 'float32', desc: '距离 m' }),
      ]}),
      param({ name: 'velocity', type: '常量', dataType: 'float32', desc: '速度 m/s' }),
      param({ name: 'confidence', type: '常量', dataType: 'float32', desc: '置信度' }),
    ],
    response: [
      param({ name: 'trackId', type: '常量', dataType: 'uint16', desc: '航迹编号' }),
      param({ name: 'position', type: '共识体', desc: '位置信息', children: [
        param({ name: 'azimuth', type: '常量', dataType: 'float32', desc: '方位角 °' }),
        param({ name: 'elevation', type: '常量', dataType: 'float32', desc: '俯仰角 °' }),
        param({ name: 'distance', type: '常量', dataType: 'float32', desc: '距离 m' }),
      ]}),
      param({ name: 'velocity', type: '常量', dataType: 'float32', desc: '速度 m/s' }),
      param({ name: 'confidence', type: '常量', dataType: 'float32', desc: '置信度' }),
      param({ name: 'partition', type: '常量', dataType: 'uint8', desc: '目标分区号' }),
      param({ name: 'offset', type: '常量', dataType: 'uint32', desc: '写入偏移量' }),
    ]
  }),
  _i({
    name: '态势更新广播', path: 'situation-exchange', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'),
    operationType: 'publish',
    desc: '通过 RabbitMQ situation-exchange Fanout 广播态势变更给各终端',
    request: [
      param({ name: 'areaId', type: '常量', dataType: 'utf8', desc: '区域编号' }),
      param({ name: 'changeType', type: '常量', dataType: 'utf8', desc: '变更类型: add/update/remove' }),
      param({ name: 'entities', type: '共识体', desc: '变更实体列表', children: [
        param({ name: 'entityId', type: '常量', dataType: 'uint16', desc: '实体编号' }),
        param({ name: 'type', type: '常量', dataType: 'utf8', desc: '实体类型' }),
        param({ name: 'lat', type: '常量', dataType: 'float64', desc: '纬度' }),
        param({ name: 'lon', type: '常量', dataType: 'float64', desc: '经度' }),
      ]}),
    ],
    response: [
      param({ name: 'fanoutCount', type: '常量', dataType: 'uint8', desc: '广播接收者数' }),
      param({ name: 'ttl', type: '常量', dataType: 'uint32', desc: '消息TTL ms' }),
    ]
  }),
]

/* ────────────────────────────────────────────
 *  五、联试任务 (Tasks)
 * ──────────────────────────────────────────── */
export const tasks = [
  // 武器管理
  { id: 't01', name: '武器状态接口连通性测试', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), ruleSetId: 'rs-weapon-status', status: '执行中', time: '2026-06-24 10:31:00', remark: '验证 WM-001 接口在标准帧格式下的握手与应答流程' },
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
  // ── MQ 相关测试任务 ──
  { id: 't27', name: '挂载变更消息投递测试', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), ruleSetId: 'rs-mount-change-mq', status: '执行中', time: '2026-06-25 09:00:00', remark: '验证 RabbitMQ 挂载变更通知的投递时效与消息完整性',
    mqTest: {
      enabled: true,
      dimensions: ['broker_health', 'producer_connect', 'consumer_connect'],
      brokerHealth: { enabled: true, timeout: 3000 },
      producer: { enabled: true, mode: 'active', triggerUrl: 'http://192.168.10.21:8081/api/mount/notify', traceIdField: 'test_trace_id', listenQueue: 'mount.change', waitTimeout: 8000, passiveWindow: 300, messageTag: 'connectivity_check' },
      consumer: { enabled: true, expectedConsumerCount: 3, backlogThreshold: 500, checkInterval: 30 },
      schedule: { interval: 5, unit: 'm' },
      alertThreshold: { consecutiveFailures: 2 },
    }
  },
  { id: 't28', name: '航迹数据分发有序性验证', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), ruleSetId: 'rs-track-data-mq', status: '待确认', time: '2026-06-25 10:30:00', remark: '验证 Kafka 同一分区内航迹消息按时间戳升序到达',
    mqTest: {
      enabled: true,
      dimensions: ['broker_health', 'producer_connect', 'consumer_connect'],
      brokerHealth: { enabled: true, timeout: 5000 },
      producer: { enabled: true, mode: 'passive', triggerUrl: '', traceIdField: 'track_id', listenQueue: 'track-data', waitTimeout: 12000, passiveWindow: 600, messageTag: 'track_update' },
      consumer: { enabled: true, expectedConsumerCount: 4, backlogThreshold: 2000, checkInterval: 60 },
      schedule: { interval: 10, unit: 'm' },
      alertThreshold: { consecutiveFailures: 3 },
    }
  },
  { id: 't29', name: '告警事件消费吞吐测试', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), status: '已完成', time: '2026-06-24 15:00:00', remark: 'Kafka alert-events 消费吞吐量 >500 msg/s，满足要求',
    mqTest: {
      enabled: true,
      dimensions: ['broker_health', 'producer_connect', 'consumer_connect'],
      brokerHealth: { enabled: true, timeout: 3000 },
      producer: { enabled: true, mode: 'active', triggerUrl: 'http://192.168.80.10:9090/api/alert/test', traceIdField: 'alert_id', listenQueue: 'alert-events', waitTimeout: 5000, passiveWindow: 300, messageTag: 'alert_test' },
      consumer: { enabled: true, expectedConsumerCount: 6, backlogThreshold: 1000, checkInterval: 30 },
      schedule: { interval: 15, unit: 'm' },
      alertThreshold: { consecutiveFailures: 2 },
    }
  },
  { id: 't30', name: '态势广播消息过期检测', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), status: '执行中', time: '2026-06-25 11:00:00', remark: '检测 RabbitMQ 态势更新广播中消息过期(TTL=60s)比例',
    mqTest: {
      enabled: true,
      dimensions: ['broker_health', 'producer_connect'],
      brokerHealth: { enabled: true, timeout: 3000 },
      producer: { enabled: true, mode: 'passive', triggerUrl: '', traceIdField: 'msg_id', listenQueue: 'situation-exchange', waitTimeout: 10000, passiveWindow: 120, messageTag: 'situation_update' },
      consumer: { enabled: false, expectedConsumerCount: 1, backlogThreshold: 1000, checkInterval: 60 },
      schedule: { interval: 5, unit: 'm' },
      alertThreshold: { consecutiveFailures: 2 },
    }
  },
]

/* ────────────────────────────────────────────
 *  六、规则集 (Rule Sets)
 * ──────────────────────────────────────────── */
export const ruleSets = [
  // ── 1. 武器管理 · 查询设备状态 ──
  {
    id: 'rs-weapon-status',
    name: '设备状态响应基础规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '武器管理模块'),
    status: 'enabled',
    desc: '由查询设备状态接口自动生成，覆盖类型、范围、边界、越界、超时与格式判定。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 10:30',
    rules: [
      { id: 'r-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-range-code', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32', min: -2147483648, max: 2147483647 }, desc: '状态码取值不得超出 int32 范围' },
      { id: 'r-boundary-code', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32', min: -2147483648, max: 2147483647, boundaryMode: 'inclusive' }, desc: '命中上下边界时给出提醒' },
      { id: 'r-overflow-payload', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: 'response.payload', fieldName: 'payload' }, params: { required: true, maxLength: 256 }, desc: '响应载荷字段必须存在且长度受控' },
      { id: 'r-timeout-status', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '查询设备状态', fieldPath: '', fieldName: '' }, params: { timeoutMs: 500 }, desc: '接口响应时延不得超过 500ms' },
      { id: 'r-format-status', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '查询设备状态', fieldPath: '', fieldName: '' }, params: { sampleType: 'json' }, desc: '响应结构必须是合法 JSON / 结构体对象' },
    ]
  },

  // ── 2. 弹药状态 · 上报弹药余量 ──
  {
    id: 'rs-ammo-report',
    name: '弹药余量上报校验规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '弹药状态模块'),
    status: 'enabled',
    desc: '覆盖弹药余量响应各字段的类型、范围、一致性与超时校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 11:00',
    rules: [
      { id: 'r-ammo-type-total', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.total', fieldName: 'total' }, params: { dataType: 'uint16' }, desc: '弹药总量字段必须为 uint16' },
      { id: 'r-ammo-range-total', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.total', fieldName: 'total' }, params: { dataType: 'uint16', min: 0, max: 65535 }, desc: '弹药总量不得超出 uint16 范围' },
      { id: 'r-ammo-range-avail', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '上报弹药余量', fieldPath: 'response.available', fieldName: 'available' }, params: { dataType: 'uint16', min: 0, max: 65535 }, desc: '可用量不得超出 uint16 范围' },
      { id: 'r-ammo-range-typeA', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '上报弹药余量', fieldPath: 'response.detail.typeA', fieldName: 'typeA' }, params: { dataType: 'uint16', min: 0, max: 9999 }, desc: 'A 型弹药余量合理范围 0~9999' },
      { id: 'r-ammo-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '上报弹药余量', fieldPath: '', fieldName: '' }, params: { timeoutMs: 800 }, desc: '弹药余量上报响应时延不得超过 800ms' },
    ]
  },

  // ── 3. 挂载检测 · 挂载状态查询 ──
  {
    id: 'rs-pylon-status',
    name: '挂载状态查询校验规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '挂载检测模块'),
    status: 'enabled',
    desc: '校验挂载状态响应中挂点编号、载荷类型、锁定状态等字段。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 09:15',
    rules: [
      { id: 'r-pylon-type-pylonNo', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.pylonNo', fieldName: 'pylonNo' }, params: { dataType: 'uint8' }, desc: '挂点号必须为 uint8' },
      { id: 'r-pylon-range-loadType', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.loadType', fieldName: 'loadType' }, params: { dataType: 'uint8', min: 0, max: 15 }, desc: '载荷类型编码范围 0~15' },
      { id: 'r-pylon-range-locked', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.pylonList.locked', fieldName: 'locked' }, params: { dataType: 'uint8', min: 0, max: 1 }, desc: '锁定状态仅允许 0（未锁定）或 1（已锁定）' },
      { id: 'r-pylon-overflow-raw', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载状态查询', fieldPath: 'response.rawFrame', fieldName: 'rawFrame' }, params: { required: true, maxLength: 512 }, desc: '原始识别帧必须存在且长度不超过 512 字节' },
      { id: 'r-pylon-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载状态查询', fieldPath: '', fieldName: '' }, params: { timeoutMs: 600 }, desc: '挂载状态查询响应时延不得超过 600ms' },
    ]
  },

  // ── 4. 火控解算 · 目标分配解算 ──
  {
    id: 'rs-fire-solve',
    name: '目标分配解算校验规则集',
    systemId: 'sys-fire',
    moduleId: byName('sys-fire', '火控解算模块'),
    status: 'enabled',
    desc: '覆盖火控解算响应结果码、方案文件与原始帧的完整性校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 14:20',
    rules: [
      { id: 'r-fire-type-result', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32' }, desc: '解算结果码必须为 int32' },
      { id: 'r-fire-range-result', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32', min: 0, max: 255 }, desc: '解算结果码合法取值 0~255' },
      { id: 'r-fire-boundary-result', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.result', fieldName: 'result' }, params: { dataType: 'int32', min: 0, max: 255, boundaryMode: 'inclusive' }, desc: '解算结果码命中边界值时提醒' },
      { id: 'r-fire-overflow-plan', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.plan', fieldName: 'plan' }, params: { required: true, maxLength: 4096 }, desc: '分配方案文件必须存在且不超过 4096 字节' },
      { id: 'r-fire-overflow-raw', type: 'overflow', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标分配解算', fieldPath: 'response.raw', fieldName: 'raw' }, params: { required: false, maxLength: 1024 }, desc: '原始解算帧长度不超过 1024 字节' },
      { id: 'r-fire-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标分配解算', fieldPath: '', fieldName: '' }, params: { timeoutMs: 300 }, desc: '火控解算响应时延不得超过 300ms（实时性要求高）' },
    ]
  },

  // ── 5. 目标跟踪 · 航迹订阅 ──
  {
    id: 'rs-track-sub',
    name: '航迹订阅响应校验规则集',
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
      { id: 'r-track-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹订阅', fieldPath: '', fieldName: '' }, params: { timeoutMs: 400 }, desc: '航迹订阅响应时延不得超过 400ms' },
    ]
  },

  // ── 6. 天线控制 · 天线指向控制 ──
  {
    id: 'rs-antenna-point',
    name: '天线指向控制校验规则集',
    systemId: 'sys-radar',
    moduleId: byName('sys-radar', '天线控制模块'),
    status: 'enabled',
    desc: '覆盖天线方位角、俯仰角范围约束及响应完整性校验。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-25 10:00',
    rules: [
      { id: 'r-ant-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '响应状态码必须为 int32' },
      { id: 'r-ant-range-az', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualAz', fieldName: 'actualAz' }, params: { dataType: 'float', min: 0, max: 360 }, desc: '实际方位角范围 0°~360°' },
      { id: 'r-ant-range-el', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualEl', fieldName: 'actualEl' }, params: { dataType: 'float', min: -90, max: 90 }, desc: '实际俯仰角范围 -90°~90°' },
      { id: 'r-ant-boundary-az', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.actualAz', fieldName: 'actualAz' }, params: { dataType: 'float', min: 0, max: 360, boundaryMode: 'inclusive' }, desc: '方位角到达 0°/360° 边界时提醒' },
      { id: 'r-ant-overflow-code', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '天线指向控制', fieldPath: 'response.code', fieldName: 'code' }, params: { required: true, maxLength: 4 }, desc: '状态码字段必须存在' },
      { id: 'r-ant-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '天线指向控制', fieldPath: '', fieldName: '' }, params: { timeoutMs: 200 }, desc: '天线伺服响应时延不得超过 200ms（阶跃响应要求）' },
    ]
  },

  // ── 7. 目标识别 · 目标识别请求 ──
  {
    id: 'rs-target-identify',
    name: '目标识别响应校验规则集',
    systemId: 'sys-radar',
    moduleId: byName('sys-radar', '目标识别模块'),
    status: 'draft',
    desc: '覆盖目标类别、置信度、RCS 等字段的完整校验。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 14:30',
    rules: [
      { id: 'r-tgt-type-cat', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标识别请求', fieldPath: 'response.category', fieldName: 'category' }, params: { dataType: 'uint8' }, desc: '目标类别必须为 uint8' },
      { id: 'r-tgt-range-cat', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别请求', fieldPath: 'response.category', fieldName: 'category' }, params: { dataType: 'uint8', min: 0, max: 10 }, desc: '目标类别编码 0~10（含未知/战斗机/运输机等）' },
      { id: 'r-tgt-range-conf', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别请求', fieldPath: 'response.confidence', fieldName: 'confidence' }, params: { dataType: 'uint8', min: 0, max: 100 }, desc: '置信度百分比范围 0~100' },
      { id: 'r-tgt-boundary-conf', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '目标识别请求', fieldPath: 'response.confidence', fieldName: 'confidence' }, params: { dataType: 'uint8', min: 0, max: 100, boundaryMode: 'inclusive' }, desc: '置信度为 0 或 100 时提醒' },
      { id: 'r-tgt-range-rcs', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '目标识别请求', fieldPath: 'response.rcsDb', fieldName: 'rcsDb' }, params: { dataType: 'float', min: -50, max: 50 }, desc: 'RCS dBsm 合理范围 -50~50' },
      { id: 'r-tgt-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '目标识别请求', fieldPath: '', fieldName: '' }, params: { timeoutMs: 1000 }, desc: '目标识别响应时延不得超过 1000ms' },
      { id: 'r-tgt-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '目标识别请求', fieldPath: '', fieldName: '' }, params: { sampleType: 'json' }, desc: '响应结构必须是合法 JSON' },
    ]
  },

  // ── 8. 卫星通信 · 卫通建链 ──
  {
    id: 'rs-sat-link',
    name: '卫通建链响应校验规则集',
    systemId: 'sys-comm',
    moduleId: byName('sys-comm', '卫星通信模块'),
    status: 'enabled',
    desc: '校验卫通建链响应的状态码、信号强度与链路速率。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 16:00',
    rules: [
      { id: 'r-sat-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '卫通建链', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-sat-range-signal', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: 'response.signalStrength', fieldName: 'signalStrength' }, params: { dataType: 'int16', min: -120, max: 0 }, desc: '信号强度范围 -120~0 dBm' },
      { id: 'r-sat-range-rate', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: 'response.linkRate', fieldName: 'linkRate' }, params: { dataType: 'uint32', min: 0, max: 100000000 }, desc: '链路速率 0~100Mbps' },
      { id: 'r-sat-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '卫通建链', fieldPath: '', fieldName: '' }, params: { timeoutMs: 5000 }, desc: '卫通建链响应时延不得超过 5000ms（卫星链路延迟容忍度高）' },
      { id: 'r-sat-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '卫通建链', fieldPath: '', fieldName: '' }, params: { sampleType: 'hex' }, desc: '卫通响应帧格式必须合法' },
    ]
  },

  // ── 9. 惯性导航 · 惯导校准 ──
  {
    id: 'rs-ins-calibrate',
    name: '惯导校准响应校验规则集',
    systemId: 'sys-nav',
    moduleId: byName('sys-nav', '惯性导航模块'),
    status: 'enabled',
    desc: '校验惯导校准响应的状态码、预计就绪时间与零偏漂移。',
    createdAt: '2026-06-24',
    updatedAt: '2026-06-24 16:45',
    rules: [
      { id: 'r-ins-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-ins-range-ready', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: 'response.readyTime', fieldName: 'readyTime' }, params: { dataType: 'uint16', min: 0, max: 600 }, desc: '预计就绪时间 0~600s（10分钟内）' },
      { id: 'r-ins-range-drift', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: 'response.drift', fieldName: 'drift' }, params: { dataType: 'float', min: -10, max: 10 }, desc: '零偏漂移合理范围 -10~10' },
      { id: 'r-ins-boundary-drift', type: 'boundary', enabled: true, level: 'warning', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: 'response.drift', fieldName: 'drift' }, params: { dataType: 'float', min: -10, max: 10, boundaryMode: 'inclusive' }, desc: '零偏漂移接近边界时提醒' },
      { id: 'r-ins-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '惯导校准', fieldPath: '', fieldName: '' }, params: { timeoutMs: 2000 }, desc: '惯导校准响应时延不得超过 2000ms' },
      { id: 'r-ins-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '惯导校准', fieldPath: '', fieldName: '' }, params: { sampleType: 'json' }, desc: '响应结构必须是合法 JSON' },
    ]
  },

  // ── 10. 卫星定位 · 定位数据查询 ──
  {
    id: 'rs-position-query',
    name: '定位数据查询校验规则集',
    systemId: 'sys-nav',
    moduleId: byName('sys-nav', '卫星定位模块'),
    status: 'enabled',
    desc: '校验定位响应中经纬度、海拔、定位状态等字段的合理性。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 11:20',
    rules: [
      { id: 'r-pos-range-lat', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.lat', fieldName: 'lat' }, params: { dataType: 'double', min: -90, max: 90 }, desc: '纬度范围 -90°~90°' },
      { id: 'r-pos-range-lon', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.lon', fieldName: 'lon' }, params: { dataType: 'double', min: -180, max: 180 }, desc: '经度范围 -180°~180°' },
      { id: 'r-pos-range-alt', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.alt', fieldName: 'alt' }, params: { dataType: 'float', min: -500, max: 50000 }, desc: '海拔范围 -500m~50000m' },
      { id: 'r-pos-range-fix', type: 'range', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '定位数据查询', fieldPath: 'response.fixStatus', fieldName: 'fixStatus' }, params: { dataType: 'uint8', min: 0, max: 5 }, desc: '定位状态枚举值 0~5' },
      { id: 'r-pos-range-sat', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: 'response.satCount', fieldName: 'satCount' }, params: { dataType: 'uint8', min: 0, max: 64 }, desc: '可见星数 0~64（GPS+BDS）' },
      { id: 'r-pos-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '定位数据查询', fieldPath: '', fieldName: '' }, params: { timeoutMs: 1000 }, desc: '定位数据查询响应时延不得超过 1000ms' },
    ]
  },

  // ── 11. 干扰执行 · 干扰任务下发 ──
  {
    id: 'rs-jam-task',
    name: '干扰任务下发校验规则集',
    systemId: 'sys-ew',
    moduleId: byName('sys-ew', '干扰执行模块'),
    status: 'draft',
    desc: '校验干扰任务下发响应的状态码与任务编号。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 15:00',
    rules: [
      { id: 'r-jam-type-code', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: 'response.code', fieldName: 'code' }, params: { dataType: 'int32' }, desc: '状态码必须为 int32' },
      { id: 'r-jam-overflow-taskId', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: 'response.taskId', fieldName: 'taskId' }, params: { required: true, maxLength: 4 }, desc: '干扰任务编号必须存在' },
      { id: 'r-jam-timeout', type: 'timeout', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '干扰任务下发', fieldPath: '', fieldName: '' }, params: { timeoutMs: 500 }, desc: '干扰任务下发响应时延不得超过 500ms' },
      { id: 'r-jam-format', type: 'format', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '干扰任务下发', fieldPath: '', fieldName: '' }, params: { sampleType: 'hex' }, desc: '干扰指令响应帧格式必须合法' },
    ]
  },

  // ── 12. 挂载检测 · 挂载变更通知（MQ） ──
  {
    id: 'rs-mount-change-mq',
    name: '挂载变更通知消息校验规则集',
    systemId: 'sys-weapon',
    moduleId: byName('sys-weapon', '挂载检测模块'),
    status: 'enabled',
    desc: '校验 RabbitMQ 挂载变更通知消息的字段完整性、值域与投递时效。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 14:00',
    rules: [
      { id: 'r-mq-mount-type-evt', type: 'type', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载变更通知', fieldPath: 'response.messageId', fieldName: 'messageId' }, params: { dataType: 'utf8' }, desc: 'messageId 必须为字符串' },
      { id: 'r-mq-mount-range-pylon', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载变更通知', fieldPath: 'response.pylonNo', fieldName: 'pylonNo' }, params: { dataType: 'uint8', min: 1, max: 12 }, desc: '挂点号范围 1~12' },
      { id: 'r-mq-mount-range-aircraft', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载变更通知', fieldPath: 'response.aircraftId', fieldName: 'aircraftId' }, params: { dataType: 'utf8', min: 1, max: 9999 }, desc: '飞机编号' },
      { id: 'r-mq-mount-range-weight', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '挂载变更通知', fieldPath: 'response.weight', fieldName: 'weight' }, params: { dataType: 'uint16', min: 0, max: 9999 }, desc: '载荷重量 0~9999 kg' },
      { id: 'r-mq-mount-overflow-evt', type: 'overflow', enabled: true, level: 'error', source: 'auto', target: { interfaceName: '挂载变更通知', fieldPath: 'response.messageId', fieldName: 'messageId' }, params: { required: true, maxLength: 36 }, desc: 'messageId 必须存在且长度不超过 36' },
      { id: 'r-mq-mount-delivery', type: 'delivery', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '挂载变更通知', fieldPath: '', fieldName: '' }, params: { timeoutMs: 3000 }, desc: '挂载变更消息必须在 3s 内投递' },
      { id: 'r-mq-mount-ordering', type: 'ordering', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '挂载变更通知', fieldPath: '', fieldName: '' }, params: { expectedOrder: ['mount', 'unmount', 'replace'] }, desc: '变更事件应按挂载→卸载→更换顺序到达' },
    ]
  },

  // ── 13. 目标跟踪 · 航迹数据分发（MQ） ──
  {
    id: 'rs-track-data-mq',
    name: '航迹数据分发消息校验规则集',
    systemId: 'sys-fire',
    moduleId: byName('sys-fire', '目标跟踪模块'),
    status: 'enabled',
    desc: '校验 Kafka 航迹数据分发消息的字段值域与投递时效。',
    createdAt: '2026-06-25',
    updatedAt: '2026-06-25 15:30',
    rules: [
      { id: 'r-mq-track-range-id', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: 'response.trackId', fieldName: 'trackId' }, params: { dataType: 'uint16', min: 1, max: 65535 }, desc: '航迹编号范围 1~65535' },
      { id: 'r-mq-track-range-az', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: 'response.position.azimuth', fieldName: 'azimuth' }, params: { dataType: 'float32', min: 0, max: 360 }, desc: '方位角 0°~360°' },
      { id: 'r-mq-track-range-dist', type: 'range', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: 'response.position.distance', fieldName: 'distance' }, params: { dataType: 'float32', min: 0, max: 500000 }, desc: '距离 0~500000m' },
      { id: 'r-mq-track-range-conf', type: 'range', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: 'response.confidence', fieldName: 'confidence' }, params: { dataType: 'float32', min: 0, max: 1 }, desc: '置信度 0~1' },
      { id: 'r-mq-track-delivery', type: 'delivery', enabled: true, level: 'error', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: '', fieldName: '' }, params: { timeoutMs: 2000 }, desc: '航迹数据必须在 2s 内投递' },
      { id: 'r-mq-track-ordering', type: 'ordering', enabled: true, level: 'warning', source: 'manual', target: { interfaceName: '航迹数据分发', fieldPath: '', fieldName: '' }, params: { expectedOrder: [] }, desc: '同一航迹的消息应按时间戳升序到达' },
    ]
  },
]

/* ────────────────────────────────────────────
 *  七、异常告警 (Alerts)
 * ──────────────────────────────────────────── */
export const alerts = [
  // 武器管理
  { id: 'a01', type: '字段越界', iface: 'WM-003', level: '高', state: '已修复', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '武器管理模块'), resolvedTime: '2026-06-24 10:05:00', remark: '温度字段值 256 超出 uint8 范围，已修正传感器标定参数' },
  { id: 'a02', type: '格式错误', iface: 'WM-006', level: '高', state: '已转派', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '弹药状态模块'), resolvedTime: '2026-06-24 09:58:00', remark: '帧头校验码不匹配，已转派固件组排查版本一致性' },
  { id: 'a03', type: '格式错误', iface: 'PY-012', level: '中', state: '已处理', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '2026-06-24 10:30:00', remark: '载荷类型字段偶发乱码，更换线缆后恢复' },
  // 火控指挥
  { id: 'a04', type: '响应超时', iface: 'FC-017', level: '中', state: '已记录', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), resolvedTime: '', remark: '连续 3 次超时 > 500ms，链路不稳定暂无法处理' },
  { id: 'a05', type: '响应超时', iface: '指挥链路模块', level: '中', state: '自动恢复', systemId: 'sys-fire', moduleId: byName('sys-fire', '指挥链路模块'), resolvedTime: '2026-06-24 08:47:00', remark: '心跳自动恢复，根因待排查' },
  { id: 'a06', type: '字段越界', iface: 'FC-025', level: '中', state: '已处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '火控解算模块'), resolvedTime: '2026-06-24 10:22:00', remark: '重传机制触发后恢复正常' },
  { id: 'a07', type: '字段越界', iface: 'TK-031', level: '高', state: '待处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '', remark: '距离字段值 520000 超过协议上限 500000' },
  // 雷达探测
  { id: 'a08', type: '格式错误', iface: 'RD-001', level: '高', state: '待处理', systemId: 'sys-radar', moduleId: byName('sys-radar', '信号处理模块'), resolvedTime: '', remark: '回波帧同步头 0xDEADBEEF 出现错位，疑似字节序问题' },
  { id: 'a09', type: '响应超时', iface: 'AN-008', level: '中', state: '已处理', systemId: 'sys-radar', moduleId: byName('sys-radar', '天线控制模块'), resolvedTime: '2026-06-24 10:45:00', remark: '伺服响应超时 350ms，调整 PID 参数后恢复' },
  { id: 'a10', type: '格式错误', iface: 'IR-015', level: '高', state: '已转派', systemId: 'sys-radar', moduleId: byName('sys-radar', '目标识别模块'), resolvedTime: '', remark: 'RCS 字段长度与协议定义不符，需固件升级' },
  // 通信保障
  { id: 'a11', type: '响应超时', iface: 'DL-003', level: '中', state: '自动恢复', systemId: 'sys-comm', moduleId: byName('sys-comm', '数据链模块'), resolvedTime: '2026-06-24 09:35:00', remark: '数据链心跳中断 12s 后自动恢复' },
  { id: 'a12', type: '响应超时', iface: 'SAT-007', level: '高', state: '已记录', systemId: 'sys-comm', moduleId: byName('sys-comm', '卫星通信模块'), resolvedTime: '', remark: '卫通建链超时 > 30s，信号强度不足' },
  // 导航定位
  { id: 'a13', type: '字段越界', iface: 'INS-002', level: '中', state: '已修复', systemId: 'sys-nav', moduleId: byName('sys-nav', '惯性导航模块'), resolvedTime: '2026-06-24 09:15:00', remark: '陀螺 Z 轴零偏超限，重新校准后正常' },
  { id: 'a14', type: '字段越界', iface: 'GNSS-005', level: '中', state: '已处理', systemId: 'sys-nav', moduleId: byName('sys-nav', '卫星定位模块'), resolvedTime: '2026-06-24 10:50:00', remark: '遮挡环境丢星 3 颗，切换到 BDS 优先后恢复' },
  // 电子对抗
  { id: 'a15', type: '字段越界', iface: 'EW-009', level: '高', state: '待处理', systemId: 'sys-ew', moduleId: byName('sys-ew', '侦察分析模块'), resolvedTime: '', remark: '中心频率字段值 19500MHz 超过协议上限 18000MHz' },
  { id: 'a16', type: '格式错误', iface: 'JAM-004', level: '高', state: '已修复', systemId: 'sys-ew', moduleId: byName('sys-ew', '干扰执行模块'), resolvedTime: '2026-06-24 10:10:00', remark: '干扰模式字段编码与实际执行不一致，已同步' },
  { id: 'a17', type: '字段越界', iface: 'SP-011', level: '中', state: '已处理', systemId: 'sys-ew', moduleId: byName('sys-ew', '频谱监测模块'), resolvedTime: '2026-06-24 10:25:00', remark: '频谱快照间歇丢帧，缓冲区溢出已扩容' },
  // 无人机管控
  { id: 'a18', type: '响应超时', iface: 'UAV-001', level: '高', state: '已处理', systemId: 'sys-uav', moduleId: byName('sys-uav', '飞行控制模块'), resolvedTime: '2026-06-24 10:35:00', remark: '遥测帧下行延迟 800ms，优化编码后降至 50ms' },
  { id: 'a19', type: '响应超时', iface: 'PL-006', level: '中', state: '自动恢复', systemId: 'sys-uav', moduleId: byName('sys-uav', '任务载荷模块'), resolvedTime: '2026-06-24 09:50:00', remark: '载荷控制心跳短暂中断后自动恢复' },
  { id: 'a20', type: '格式错误', iface: 'VID-003', level: '中', state: '已记录', systemId: 'sys-uav', moduleId: byName('sys-uav', '图像接收模块'), resolvedTime: '', remark: '图传码流偶发花屏，编码参数待优化' },
  // 指挥控制
  { id: 'a21', type: '字段越界', iface: 'SA-008', level: '中', state: '已修复', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), resolvedTime: '2026-06-24 10:55:00', remark: '经度字段精度溢出，已扩展为 64 位' },
  { id: 'a22', type: '响应超时', iface: 'PLN-002', level: '中', state: '已记录', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '作战筹划模块'), resolvedTime: '', remark: '方案生成超时 > 60s，算法优化中' },
  { id: 'a23', type: '格式错误', iface: 'ORD-005', level: '高', state: '待处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '指令下发模块'), resolvedTime: '', remark: '指令帧 CRC 校验失败率 5%，排查链路质量' },
  { id: 'a24', type: '字段越界', iface: 'LOG-012', level: '中', state: '已处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '2026-06-24 11:00:00', remark: '日志写入高并发时偶发丢失，增加缓冲队列后恢复' },
  // ── MQ 相关异常 ──
  { id: 'a25', type: 'Broker 断连', iface: 'weapon-exchange', level: '高', state: '已修复', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '2026-06-22 14:30:00', remark: 'RabbitMQ Broker 进程 OOM 重启，心跳超时 30s 后自动恢复' },
  { id: 'a26', type: '消息堆积', iface: 'alert-events', level: '中', state: '待处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '', remark: 'Kafka alert-events 分区 2 消费 lag 超过 5000 条，消费者吞吐量不足' },
  { id: 'a27', type: '消费者掉线', iface: 'track-data', level: '高', state: '已处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '2026-06-23 16:20:00', remark: 'Kafka consumer group rebalance 导致短暂掉线，调整 session.timeout.ms 后稳定' },
  { id: 'a28', type: '消息过期', iface: 'situation-exchange', level: '中', state: '已记录', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), resolvedTime: '', remark: 'RabbitMQ 队列 TTL=60s，部分终端离线导致消息过期未消费' },
  { id: 'a29', type: '投递校验', iface: 'mount.change', level: '高', state: '已处理', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '2026-06-24 10:15:00', remark: '挂载变更消息投递延迟 >3s，调整 prefetch_count 后恢复' },
  { id: 'a30', type: 'Broker 断连', iface: 'alert-events', level: '高', state: '已修复', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '2026-06-23 08:45:00', remark: 'Kafka Broker 磁盘满导致 partition leader 切换，扩容磁盘后恢复' },
  { id: 'a31', type: '消息堆积', iface: 'track-data', level: '高', state: '待处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '', remark: 'Kafka track-data 分区 0~2 消费 lag 累计超过 12000 条，消费者 GC 频繁' },
  { id: 'a32', type: '顺序校验', iface: 'track-data', level: '中', state: '已处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '2026-06-24 15:30:00', remark: '同一航迹 T-1042 的 3 条消息到达顺序乱序，partition key 配置错误已修正' },
  { id: 'a33', type: '消费者掉线', iface: 'situation-exchange', level: '中', state: '已处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), resolvedTime: '2026-06-23 11:20:00', remark: 'RabbitMQ 消费者连接超时 60s 后被 Broker 主动断开，心跳间隔从 60s 调为 30s' },
  { id: 'a34', type: '消息过期', iface: 'mount.change', level: '中', state: '已记录', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '', remark: 'RabbitMQ mount.change 队列 TTL=30s，挂载检测模块离线期间 47 条消息过期丢弃' },
  { id: 'a35', type: '投递校验', iface: 'alert-events', level: '高', state: '已处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '2026-06-25 09:10:00', remark: '告警事件消息投递到 Kafka 后 ACK 超时，acks=all 改为 acks=1 后吞吐恢复' },
  { id: 'a36', type: 'Broker 断连', iface: 'track-data', level: '高', state: '待处理', systemId: 'sys-fire', moduleId: byName('sys-fire', '目标跟踪模块'), resolvedTime: '', remark: 'Kafka Broker 192.168.20.47 节点 2 网络分区，ISR 缩减至 1，数据丢失风险' },
  { id: 'a37', type: '消息堆积', iface: 'situation-exchange', level: '低', state: '已处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '态势感知模块'), resolvedTime: '2026-06-24 16:40:00', remark: 'RabbitMQ situation-fanout 队列短暂堆积 230 条，消费端扩容后 5min 内消化完毕' },
  { id: 'a38', type: '顺序校验', iface: 'mount.change', level: '中', state: '已修复', systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'), resolvedTime: '2026-06-25 10:00:00', remark: 'RabbitMQ 单队列多消费者导致挂载变更消息乱序，改为单消费者 + 并发确认模式' },
  { id: 'a39', type: '消费者掉线', iface: 'alert-events', level: '高', state: '待处理', systemId: 'sys-cmd', moduleId: byName('sys-cmd', '日志审计模块'), resolvedTime: '', remark: 'Kafka consumer group cmd-audit-group 中 2/6 消费者因 OOM 退出，pending 堆积 3800 条' },
]

/* ────────────────────────────────────────────
 *  六、执行历史 (Run History) —— 统计与可视化数据底座
 *  说明：执行编排的 store.history 为会话级且字段薄；此处提供一份数值化、
 *  可复算的历史执行记录，供【统计与可视化】聚合（请求量/时延/通过率/接口覆盖等）。
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
interfaces.forEach((iface) => {
  // 留出部分接口"未测"，让接口覆盖率有意义（非 100%）
  if (_stRng() < 0.22) return
  const mod = nodes.find((n) => n.id === iface.moduleId)
  const runCount = 2 + (iface.systemId === 'sys-weapon' ? 2 : (_stRng() < 0.4 ? 1 : 0))
  for (let k = 0; k < runCount; k++) {
    const day = _stDays[_sr(0, _stDays.length - 1)]
    const hh = _pad2(_sr(8, 18))
    const mm = _pad2(_sr(0, 59))
    const total = _sr(12, 140)
    const error = Math.round(total * (_stRng() * 0.06))
    const failed = Math.round(total * (_stRng() * 0.1))
    const success = Math.max(0, total - error - failed)
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
      proto: (iface.path || '').startsWith('/') ? 'HTTP' : 'TCP',
      startedAt: `${day} ${hh}:${mm}:00`,
      finishedAt: `${day} ${hh}:${_pad2(_sr(0, 59))}:30`,
      dateKey: day,
      total,
      success,
      failed,
      error,
      avgMs,
      durations,
      executionTime,
      rps: Number((total / executionTime).toFixed(1)),
    })
  }
})

/* ── MQ 接口专属执行历史 ── */
const _mqIfaces = [
  { name: 'mount.change',         systemId: 'sys-weapon', moduleId: byName('sys-weapon', '挂载检测模块'),  taskId: 't27', taskName: '挂载变更消息投递测试',     brokerType: 'RabbitMQ' },
  { name: 'track-data',           systemId: 'sys-fire',   moduleId: byName('sys-fire', '目标跟踪模块'),    taskId: 't28', taskName: '航迹数据分发有序性验证',   brokerType: 'Kafka' },
  { name: 'alert-events',         systemId: 'sys-cmd',    moduleId: byName('sys-cmd', '日志审计模块'),     taskId: 't29', taskName: '告警事件消费吞吐测试',     brokerType: 'Kafka' },
  { name: 'situation-exchange',   systemId: 'sys-cmd',    moduleId: byName('sys-cmd', '态势感知模块'),     taskId: 't30', taskName: '态势广播消息过期检测',     brokerType: 'RabbitMQ' },
]
_mqIfaces.forEach((mq) => {
  const mod = nodes.find((n) => n.id === mq.moduleId)
  const runCount = _sr(3, 6)
  for (let k = 0; k < runCount; k++) {
    const day = _stDays[_sr(0, _stDays.length - 1)]
    const hh = _pad2(_sr(8, 18))
    const mm = _pad2(_sr(0, 59))
    const total = _sr(50, 300)
    const error = Math.round(total * (_stRng() * 0.04))
    const failed = Math.round(total * (_stRng() * 0.08))
    const success = Math.max(0, total - error - failed)
    const baseLat = _sr(8, 65)
    const durations = Array.from({ length: 12 }, () =>
      _stClamp(Math.round(baseLat + (_stRng() - 0.5) * baseLat * 0.8 + (_stRng() < 0.08 ? _sr(80, 250) : 0)), 2, 500)
    )
    const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    const executionTime = _sr(10, 120)
    runHistory.push({
      id: `seedrun-mq-${++_runSeq}`,
      systemId: mq.systemId,
      moduleId: mq.moduleId,
      moduleName: mod?.name || '',
      taskId: mq.taskId,
      taskName: mq.taskName,
      interfaceId: '',
      iface: mq.name,
      proto: 'MQ',
      startedAt: `${day} ${hh}:${mm}:00`,
      finishedAt: `${day} ${hh}:${_pad2(_sr(0, 59))}:30`,
      dateKey: day,
      total,
      success,
      failed,
      error,
      avgMs,
      durations,
      executionTime,
      rps: Number((total / executionTime).toFixed(1)),
    })
  }
})

/* ── MQ 探测历史种子（供统计与可视化 MQ Tab 展示） ── */
const _mqProbeDays = ['2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25']
const _brokerNames = ['RabbitMQ Broker', 'Kafka Broker']
const _brokerSystems = ['sys-weapon', 'sys-fire', 'sys-cmd', 'sys-cmd']
const _brokerTypes = ['RabbitMQ', 'Kafka', 'Kafka', 'RabbitMQ']

export const mqProbeHistory = []
let _mqProbeSeq = 0
_brokerSystems.forEach((sysId, bi) => {
  const bType = _brokerTypes[bi]
  const bName = bType === 'Kafka' ? `Kafka Broker (${sysId === 'sys-fire' ? '火控' : '指控'})` : `RabbitMQ Broker (${sysId === 'sys-weapon' ? '武器' : '指控'})`
  _mqProbeDays.forEach((day) => {
    // 每天每个 Broker 做 48 次探测（每 30 分钟一次）
    for (let h = 0; h < 48; h++) {
      const hh = _pad2(Math.floor(h / 2))
      const mm = (h % 2) * 30
      const l1Ms = _sr(1, 6)
      const l2Ms = _sr(18, 85)
      const l1Ok = _stRng() > 0.02
      const l2Ok = l1Ok && _stRng() > 0.03
      const l3Ok = l2Ok && _stRng() > 0.06
      const l1Status = l1Ok ? 'pass' : 'fail'
      const l2Status = l2Ok ? 'pass' : (l1Ok ? 'fail' : 'pending')
      const l3Status = l3Ok ? 'pass' : (_stRng() > 0.4 ? 'warning' : 'fail')
      const overall = l3Ok ? 'healthy' : (l3Status === 'warning' ? 'warning' : 'error')
      const prodLatency = _sr(8, 72)
      const prodOk = l1Ok && _stRng() > 0.05
      const consumerOnline = l3Ok ? _sr(3, 8) : (l3Status === 'warning' ? _sr(1, 3) : 0)
      const backlog = l3Ok ? _sr(0, 20) : (l3Status === 'warning' ? _sr(50, 500) : _sr(500, 5000))
      mqProbeHistory.push({
        id: `mqprobe-${++_mqProbeSeq}`,
        brokerName: bName,
        brokerType: bType,
        systemId: sysId,
        dateKey: day,
        time: `${day} ${hh}:${_pad2(mm)}:00`,
        level1: { status: l1Status, latency: l1Ms },
        level2: { status: l2Status, latency: l2Ms },
        level3: { status: l3Status },
        overall,
        producerLatency: prodOk ? prodLatency : null,
        producerPass: prodOk,
        consumerOnline,
        backlog,
      })
    }
  })
})
