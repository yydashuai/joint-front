import { defineStore } from 'pinia'
import {
  protocols as seedProtocols,
  interfaces as seedInterfaces,
  testInterfaces as seedTestInterfaces,
} from '@/mock/seed-data'
import { makeUniqueName } from '@/utils/entityName'
import { useTestDataStore } from '@/stores/testData'

let seq = 2000
export const uid = () => ++seq
const directionlessFieldName = (name, fallback = '新建字段') =>
  String(name || fallback).replace(/请求|响应|发送|接收/g, '').trim() || fallback

export const makeProtocolRef = (protocolId, role = 'send') => ({ protocolId, role })

const datasetFieldType = (field = {}) => {
  const category = {
    bitstream: '位组序流',
    '位组序流': '位组序流',
    struct: '共识体',
    '共识体': '共识体',
    matrix: '结构矩阵',
    '结构矩阵': '结构矩阵',
    file: '流文件',
    '流文件': '流文件',
  }[field.type]
  if (category) return category
  return field.dataType || field.encoding || field.type || ''
}

// ─── 接口级执行策略（配置于接口，供编排计划/实时监控复用）───
// trigger: manual 手动 / scheduled 定时 / periodic 周期
export const defaultIfaceStrategy = () => ({
  trigger: 'manual',
  scheduleAt: null,        // 定时模式：ISO 时间字符串
  periodicInterval: 60,    // 周期模式：间隔数值
  periodicUnit: 's',       // 周期模式：单位 s/m/h/d
  periodicCount: null,     // 周期模式：触发次数，null=永久
})

/**
 * 扁平化收集报文的全部引用字段（发送 + 接收），用于实时监控「编辑发送数据」面板。
 * @param {object} iface 接口对象（含 protocolRefs）
 * @param {Array}  protocols 协议列表（用于解析引用字段）
 * @param {string|null} role 可选，仅收集 send 或 receive 角色
 * @returns {Array} [{ id, name, remark, desc, type, kind }]
 */
export const collectInterfaceFields = (iface, protocols = [], role = null) => {
  const out = []
  const pushField = (f, kind) => {
    const type = f.type && f.type !== 'byte' && f.type !== 'bit'
      ? (f.encoding || f.type)
      : (f.dataType || f.kind || kind)
    out.push({
      id: f.id,
      name: f.name || (kind === 'bit' ? `位段` : '未命名字段'),
      remark: f.remark || '',
      desc: f.desc || '',
      type,
      kind: f.kind || kind,
      constraint: f.constraint || null,
    })
  }
  const walk = (fields, kind) => {
    if (!Array.isArray(fields)) return
    for (const f of fields) {
      if (f.kind === 'repeat') { walk(f.children, 'repeat') }
      else if (f.kind === 'byte') { pushField(f, 'byte'); walk(f.children, 'bit') }
      else if (f.kind === 'bit') { pushField(f, 'bit') }
      else if (f.children?.length) { walk(f.children, f.type || 'struct') }
      else { pushField(f, f.type || 'param') }
    }
  }
  for (const ref of iface.protocolRefs || []) {
    if (!ref) continue
    const refRole = typeof ref === 'object' ? ref.role : null
    // 报文管理界面不再区分收发：未标注 role 的引用对所有收发上下文均生效。
    // 显式标注 role 的引用（如迁移数据）仍按原角色过滤，保持向后兼容。
    if (role && refRole && refRole !== role) continue
    const protocolId = typeof ref === 'object' ? ref.protocolId : ref
    const proto = protocols.find(p => p.id === protocolId)
    if (proto) walk(proto.fields, ref.role)
  }
  return out
}

/**
 * 按“接口 → 报文 → 字段”链路收集接口最终使用的字段（报文排他归属模型）。
 * 优先走接口直挂报文（testInterface.messageIds → 报文实体），
 * 无 messageIds 时回退旧链路（接口 → 数据集 → 数据集关联报文），保证老数据兼容。
 */
export const collectTestInterfaceFields = (
  testInterface,
  datasets = [],
  messages = [],
  protocols = [],
  role = null,
) => {
  if (!testInterface) return []
  const seen = new Set()
  const dedup = (list) => list.filter((field) => {
    const key = String(field.id ?? field.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // 新链路：接口直接持有报文（1:N）
  const ownedIds = new Set((testInterface.messageIds || []).map((id) => String(id)))
  const ownedMessages = messages.filter((message) => ownedIds.has(String(message.id)))
  if (ownedMessages.length) {
    return dedup(ownedMessages.flatMap((message) => collectInterfaceFields(message, protocols, role)))
  }
  // 旧链路（兼容）：接口 → 数据集 → 数据集关联报文
  const datasetIds = new Set((testInterface.datasetIds || []).map((id) => String(id)))
  const linkedDatasets = datasets.filter((dataset) => datasetIds.has(String(dataset.id)))
  const linkedMessageNames = new Set(linkedDatasets
    .map((dataset) => dataset.linkedInterface || dataset.linkedMessage)
    .filter(Boolean))
  const linkedMessages = messages.filter((message) => linkedMessageNames.has(message.name))
  return dedup(linkedMessages.flatMap((message) => collectInterfaceFields(message, protocols, role)))
}

/**
 * 按接口（报文）的 request 参数树收集字段定义。
 * 与 collectInterfaceFields（走 protocolRefs → 协议字段，用于报文构造 / 接收帧解析）不同：
 *   - 直接遍历 iface.request，使字段名与「数据集行 values 的键」一致；
 *   - 嵌套 struct（共识体）子字段拍平为顶层字段名（如 deviceId + options{verbose,timeoutMs}
 *     → [deviceId, verbose, timeoutMs]），与数据矩阵列键对应；
 *   - 携带每个参数的 constraint / desc / dataType。
 * 适用于「数据集关联报文」场景：数据矩阵的列与约束来源于报文 request，而非其引用的协议字段。
 */
export const collectInterfaceRequestFields = (iface) => {
  const out = []
  const pushField = (f) => {
    out.push({
      id: f.id,
      name: f.name,
      remark: f.remark || '',
      desc: f.desc || '',
      dataType: f.dataType || f.type || f.encoding || '',
      constraint: f.constraint || null,
    })
  }
  const walk = (fields) => {
    if (!Array.isArray(fields)) return
    for (const f of fields) {
      if (f.children?.length) walk(f.children) // 拍平：struct 子字段提升到顶层
      else pushField(f)
    }
  }
  walk(iface?.request)
  return out
}

/**
 * 收集报文的全部数据集字段：request 参数树（拍平）+ protocolRefs 引用字段（拍平，跳过 byte 容器）。
 * 兼容 migrateAllFromV1 前后：迁移前 request 可能存在；迁移后仅保留显式关联的 protocolRefs。
 * bit 字段携带 startBit / endBit（来自 bitStart / bitEnd），便于数据矩阵区分「单 bit 开关」与「多 bit 数值」。
 * 按字段名去重（保留首个）。用于数据集矩阵列、约束校验、智能生成。
 */
export const collectInterfaceDatasetFields = (iface, protocols = []) => {
  const out = []
  // 1) request 参数树（拍平 struct 子字段）
  const walkRequest = (fields) => {
    if (!Array.isArray(fields)) return
    for (const f of fields) {
      if (f.children?.length) walkRequest(f.children)
      else out.push({
        id: f.id, name: f.name,
        desc: f.desc || '', remark: f.remark || '',
        dataType: datasetFieldType(f),
        constraint: f.constraint || null,
      })
    }
  }
  walkRequest(iface?.request)
  // 2) protocolRefs 引用字段（拍平 byte/bit/repeat/struct；byte 容器取其位段子字段）
  const walkProto = (fields) => {
    if (!Array.isArray(fields)) return
    for (const f of fields) {
      if (f.kind === 'byte') {
        if (f.children?.length) walkProto(f.children)
        else out.push({ id: f.id, name: f.name, desc: f.desc || '', remark: f.remark || '', dataType: f.dataType || '', constraint: f.constraint || null })
      } else if (f.kind === 'bit') {
        out.push({ id: f.id, name: f.name, desc: f.desc || '', remark: f.remark || '', dataType: f.dataType || 'uint', constraint: f.constraint || null, startBit: f.bitStart, endBit: f.bitEnd })
      } else if (f.kind === 'repeat') {
        if (f.children?.length) walkProto(f.children)
      } else if (f.children?.length) {
        walkProto(f.children)
      } else {
        out.push({ id: f.id, name: f.name, desc: f.desc || '', remark: f.remark || '', dataType: datasetFieldType(f), constraint: f.constraint || null })
      }
    }
  }
  for (const ref of iface?.protocolRefs || []) {
    const pid = ref && typeof ref === 'object' ? ref.protocolId : ref
    const proto = protocols.find(p => p.id === pid)
    if (proto) walkProto(proto.fields)
  }
  // 按字段名去重（保留首个）
  const seen = new Set()
  return out.filter(f => { if (!f.name || seen.has(f.name)) return false; seen.add(f.name); return true })
}

// ─── 传输类型（报文使用） ───
// OSE:   基于 UDP 的报文传输（消息头 + 消息体）
// 4908A: 基于 TCP/IP 的实时 / 可靠传输（UDP + TCP）
// MDS:   传输类型待确认，配置暂留空，待确认后再完善
export const TRANSPORT_TYPES = [
  { value: 'OSE', label: 'OSE', desc: '基于 UDP 的报文传输（消息头 + 消息体）' },
  { value: '4908A', label: '4908A', desc: '基于 TCP/IP 的实时 / 可靠传输（UDP + TCP）' },
  { value: 'MDS', label: 'MDS', desc: '传输类型待确认，配置暂未开放', placeholder: true },
]

// ─── 字段角色（报文引用字段时标注其在通信中的作用）───
// 统一两种角色，所有传输类型通用
export const PROTOCOL_ROLES = [
  { value: 'send', label: '发送', desc: '在报文发送时使用该字段' },
  { value: 'receive', label: '接收', desc: '在报文接收时使用该字段' },
]
// 向后兼容
export const TRANSPORT_ROLES = {
  OSE: PROTOCOL_ROLES, '4908A': PROTOCOL_ROLES, MDS: PROTOCOL_ROLES,
}
export const ALL_TRANSPORT_ROLES = ['send', 'receive']

// ─── 五类数据规则（便携式智能联试工具设计文档 V7.4 定义）───
// 用户定义字段时，必须先选择数据规则类别，再选择具体数据类型：
//   标量：单一数值，可表示整数或实数，不附带维度或结构信息。例如温度、压力、时间间隔。
//   位组序流：连续二进制位序列，强调顺序与位级解析，区别于传统的"字节流"。适用于底层通信字段、编码载荷。
//   共识体：由多个字段组成的结构化数据块，字段间存在语义或业务上的强关联。例如一条完整的指令或状态报告。
//   流文件：持久化的二进制或文本文件，以文件整体为操作单元，适用于日志、报文存储与回放。
//   结构矩阵：二维表格形式的数据，行列有明确语义，适用于批量参数、配置表或测试用例集。
export const DATA_RULE_CATEGORIES = [
  { value: 'scalar',  label: '标量',     icon: 'Number',   desc: '单一数值（整数/实数），不附带维度或结构信息', color: '#409EFF' },
  { value: 'struct',  label: '共识体',   icon: 'Grid',     desc: '多字段结构化数据块，字段间存在语义关联', color: '#67C23A' },
  { value: 'bitstream', label: '位组序流', icon: 'Connection', desc: '连续二进制位序列，按字节/位级解析', color: '#E6A23C' },
  { value: 'file',    label: '流文件',   icon: 'Document', desc: '持久化二进制/文本文件，以整体为操作单元', color: '#909399' },
  { value: 'matrix',  label: '结构矩阵', icon: 'Table',    desc: '二维表格数据，行列有明确语义', color: '#F56C6C' },
]
export const DATA_RULE_CATEGORY_VALUES = DATA_RULE_CATEGORIES.map(t => t.value)
export const DATA_RULE_CATEGORY_MAP = Object.fromEntries(DATA_RULE_CATEGORIES.map(t => [t.value, t]))

// ─── 兼容旧名：v1→v2 映射 ───
const V1_TO_CATEGORY = {
  '常量': 'scalar',
  '位组序流': 'bitstream',
  '共识体': 'struct',
  '流文件': 'file',
  '结构矩阵': 'matrix',
}
// 旧 FIELD_TYPES 兼容（已废弃，新代码请使用 DATA_RULE_CATEGORIES）
export const FIELD_TYPES = DATA_RULE_CATEGORIES
export const FIELD_TYPE_VALUES = DATA_RULE_CATEGORY_VALUES

// scalar 类型的子类型(编码方式)
export const SCALAR_ENCODINGS = [
  { value: 'uint8',  label: 'uint8',  group: '整数', bytes: 1 },
  { value: 'int8',   label: 'int8',   group: '整数', bytes: 1 },
  { value: 'uint16', label: 'uint16', group: '整数', bytes: 2 },
  { value: 'int16',  label: 'int16',  group: '整数', bytes: 2 },
  { value: 'uint32', label: 'uint32', group: '整数', bytes: 4 },
  { value: 'int32',  label: 'int32',  group: '整数', bytes: 4 },
  { value: 'uint64', label: 'uint64', group: '整数', bytes: 8 },
  { value: 'int64',  label: 'int64',  group: '整数', bytes: 8 },
  { value: 'float32',label: 'float32',group: '浮点', bytes: 4 },
  { value: 'float64',label: 'float64',group: '浮点', bytes: 8 },
  { value: 'utf8',   label: 'UTF-8',  group: '字符', bytes: 0 },
  { value: 'gbk',    label: 'GBK',    group: '字符', bytes: 0 },
  { value: 'ascii',  label: 'ASCII',  group: '字符', bytes: 0 },
  { value: 'bcd',    label: 'BCD',    group: '编码', bytes: 0 },
  { value: 'bool',   label: '布尔',   group: '其他', bytes: 1 },
  { value: 'unix-sec',label: 'Unix秒',group: '时间', bytes: 4 },
  { value: 'unix-ms', label: 'Unix毫秒',group: '时间', bytes: 8 },
]

// 报文（字段）定义中可选用、且出现在协议字段里的数值/浮点编码（不含字符/编码/时间等不会出现在协议字段的类型）
export const SCALAR_NUMERIC_ENCODINGS = SCALAR_ENCODINGS.filter((e) =>
  ['整数', '浮点'].includes(e.group)
)

// v1 兼容常量(老代码可能直接 import)
export const CONST_SUBTYPES = SCALAR_ENCODINGS.map(s => s.value)
export const ENDIANS = [
  { label: '大端 (BE)', value: 'big' },
  { label: '小端 (LE)', value: 'little' }
]

// ─── 字节数据类型枚举 ───
export const BYTE_DATA_TYPES = [
  { value: 'uint8',   label: 'uint8',   group: '数值', bytes: 1, signed: false },
  { value: 'int8',    label: 'int8',    group: '数值', bytes: 1, signed: true },
  { value: 'uint16',  label: 'uint16',  group: '数值', bytes: 2, signed: false },
  { value: 'int16',   label: 'int16',   group: '数值', bytes: 2, signed: true },
  { value: 'uint32',  label: 'uint32',  group: '数值', bytes: 4, signed: false },
  { value: 'int32',   label: 'int32',   group: '数值', bytes: 4, signed: true },
  { value: 'uint64',  label: 'uint64',  group: '数值', bytes: 8, signed: false },
  { value: 'int64',   label: 'int64',   group: '数值', bytes: 8, signed: true },
  { value: 'float32', label: 'float32', group: '数值', bytes: 4, signed: true },
  { value: 'float64', label: 'float64', group: '数值', bytes: 8, signed: true },
]

export const isNumericType = (dt) =>
  ['uint8','int8','uint16','int16','uint32','int32','uint64','int64','float32','float64'].includes(dt)
export const isStringType = (dt) => ['ascii', 'gbk', 'utf8'].includes(dt)

// ─── 位数据类型 ───
export const BIT_DATA_TYPES = [
  { value: 'uint', label: '无符号数值' },
  { value: 'bool', label: '布尔值' },
]

// ─── 数据类型 → 默认约束 ───
export const defaultConstraint = (dataType) => {
  switch (dataType) {
    case 'uint8':   return range(0, 255)
    case 'int8':    return range(-128, 127)
    case 'uint16':  return range(0, 65535)
    case 'int16':   return range(-32768, 32767)
    case 'uint32':  return range(0, 4294967295)
    case 'int32':   return range(-2147483648, 2147483647)
    case 'uint64':  return range(0, Number.MAX_SAFE_INTEGER)
    case 'int64':   return range(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
    case 'float32': return range(-3.4e38, 3.4e38)
    case 'float64': return range(-1.8e308, 1.8e308)
    case 'ascii': case 'gbk': case 'utf8': return lengthConstraint(0, 256)
    case 'bcd':     return lengthConstraint(1, 32)
    case 'raw':     return noneConstraint()
    default:        return range(0, 255)
  }
}

// ─── 取值约束工厂 ───
export const range = (min, max) => ({ mode: 'range', min, max, value: 0 })
export const fixed = (value) => ({ mode: 'fixed', min: 0, max: 0, value })
export const enumConstraint = (entries = []) => ({ mode: 'enum', entries })
export const regexConstraint = (pattern = '') => ({ mode: 'regex', pattern })
export const lengthConstraint = (minLen = 0, maxLen = 256) => ({ mode: 'length', minLen, maxLen })
export const noneConstraint = () => ({ mode: 'none' })

// ─── 帧结构默认配置 ───
export const makeFraming = (o = {}) => ({
  mode: 'fixed',
  fixedLength: 0,
  lengthFieldId: null,
  lengthIncludesHeader: true,
  lengthIncludesSelf: true,
  headerBytes: '',
  footerBytes: '',
  ...o
})

// ─── 校验默认配置 ───
export const makeChecksum = (o = {}) => ({
  type: 'none',
  fieldId: null,
  rangeStart: 0,
  rangeEnd: 0,
  polynomial: '0x1021',
  initValue: '0xFFFF',
  reflectIn: false,
  reflectOut: false,
  xorOut: '0x0000',
  ...o
})

// ─── 字节级字段（顶层行） ───
export const makeByteField = (o = {}) => {
  const dataType = o.dataType || 'uint8'
  return {
    id: uid(),
    kind: 'byte',
    name: '',
    byteOffset: 0,
    byteLength: 1,
    bitMode: false,
    dataType,
    constraint: o.constraint || defaultConstraint(dataType),
    desc: '',
    remark: '',
    children: [],
    ...o
  }
}

// ─── 位级字段（嵌套在字节字段下） ───
export const makeBitField = (o = {}) => ({
  id: uid(),
  kind: 'bit',
  name: '',
  bitStart: 7,
  bitEnd: 7,
  dataType: 'uint',
  constraint: range(0, 1),
  desc: '',
  remark: '',
  ...o
})

// ─── 重复字段组 ───
export const makeRepeatGroup = (o = {}) => ({
  id: uid(),
  kind: 'repeat',
  name: '重复组',
  byteOffset: 0,
  repeatMode: 'fixed',
  repeatCount: 1,
  countFieldId: null,
  children: [],
  ...o
})

// ─── 报文参数节点（使用五类数据规则） ───
// 五类: scalar(标量) / bitstream(位组序流) / struct(共识体) / matrix(结构矩阵) / file(流文件)
export const makeParam = (o = {}) => ({
  id: uid(),
  name: '',
  type: 'scalar',                  // scalar | bitstream | struct | matrix | file
  encoding: 'uint8',               // 仅 scalar 用, 来自 SCALAR_ENCODINGS
  protocolRef: null,               // 仅共识体引用使用
  fileName: '', fileSize: 0,       // file / matrix 用
  required: true,
  defaultValue: null,
  constraint: noneConstraint(),
  unit: '',                        // 字段单位, 如 "kg" / "m/s" / "Hz"
  align: 1,                        // 字节对齐, 仅 struct/matrix 用
  children: [],                    // struct/matrix 用
  desc: '',
  remark: '',
  ...o
})

// ─── 报文（字段）定义辅助：构建单字段协议（message field）───
// 报文字段在底层仍是一个 protocol 实体（可被数据集/执行引擎复用），
// 但标记为 __inline 并在报文管理界面内联定义，不进入左侧「字段库」。
export const buildMessageField = (payload = {}) => {
  const {
    name = '新建字段',
    category = 'scalar',
    encoding = 'uint8',
    unit = '',
    dataType = 'uint8',
    fileType = 'bin',
    chunkSizeKb = 64,
    checksum = 'sha256',
    matrixFileType = 'csv',
    constraint,
    desc = '',
    children = [],
  } = payload
  const base = {
    id: uid(),
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
    base.fields = [makeParam({ name, type: 'scalar', encoding, unit, constraint: constraint || defaultConstraint(encoding), desc })]
  } else if (category === 'bitstream') {
    // 纯字节语义：一个字段 = 一个字节粒度单元，字节数由 dataType 决定，无位段/长度/偏移/单位
    base.fields = [makeByteField({ name, dataType, constraint: constraint || defaultConstraint(dataType), desc })]
    base.framing = makeFraming()
    base.checksum = makeChecksum()
  } else if (category === 'struct') {
    base.fields = (children || []).map((c) => makeParam({ ...c }))
  } else if (category === 'file') {
    base.fileConfig = { fileType, chunkSizeKb, checksum }
  } else if (category === 'matrix') {
    base.matrixConfig = { fileType: matrixFileType }
  }
  return base
}

// 切换报文内某字段的大类：原地改造协议实体，保留名称，重建结构
export const convertProtocolCategory = (protocol, category) => {
  if (!protocol) return
  const keepName = protocol.name
  protocol.category = category
  if (category === 'scalar') {
    const src = protocol.fields?.[0]
    protocol.fields = [makeParam({ name: keepName, type: 'scalar', encoding: src?.encoding || 'uint8', unit: src?.unit || '', desc: protocol.desc })]
    protocol.fileConfig = null; protocol.matrixConfig = null; protocol.framing = null; protocol.checksum = null
  } else if (category === 'bitstream') {
    protocol.fields = [makeByteField({ name: keepName, dataType: 'uint8' })]
    protocol.fileConfig = null; protocol.matrixConfig = null
    protocol.framing = makeFraming(); protocol.checksum = makeChecksum(); protocol.endian = 'big'
  } else if (category === 'struct') {
    if (!protocol.fields?.length) protocol.fields = [makeParam({ name: '子字段1', type: 'scalar', encoding: 'uint8' })]
    protocol.fileConfig = null; protocol.matrixConfig = null; protocol.framing = null; protocol.checksum = null
  } else if (category === 'file') {
    protocol.fileConfig = protocol.fileConfig || { fileType: 'bin', chunkSizeKb: 64, checksum: 'sha256' }
    protocol.fields = []; protocol.matrixConfig = null; protocol.framing = null; protocol.checksum = null
  } else if (category === 'matrix') {
    protocol.matrixConfig = protocol.matrixConfig || { fileType: 'csv' }
    protocol.fields = []; protocol.fileConfig = null; protocol.framing = null; protocol.checksum = null
  }
}

// v1 → 五类数据规则 映射
const V1_TO_V2_TYPE = {
  '常量': 'scalar',
  '位组序流': 'bitstream',
  '共识体': 'struct',
  '流文件': 'file',
  '结构矩阵': 'matrix',
}
// 旧类型名到新类型名的映射（用于数据迁移）
const LEGACY_TO_NEW_TYPE = {
  'bytes': 'bitstream',
  'array': 'matrix',
}
// ─── 兼容旧显示标签 ───
export const V2_TO_V1_LABEL = {
  scalar: '标量',
  bitstream: '位组序流',
  struct: '共识体',
  matrix: '结构矩阵',
  file: '流文件',
}

// ─── HTTP 参数工厂 ───
export const makeHttpParam = (o = {}) => ({
  id: uid(),
  name: '',
  dataType: 'string',
  required: true,
  defaultValue: '',
  constraint: noneConstraint(),
  desc: '',
  remark: '',
  ...o
})

// ─── HTTP 发送体字段（支持嵌套） ───
export const makeBodyField = (o = {}) => ({
  id: uid(),
  name: '',
  dataType: 'string',
  required: true,
  constraint: noneConstraint(),
  desc: '',
  remark: '',
  children: [],
  ...o
})

// ─── HTTP 接收配置工厂 ───
export const makeHttpResponse = (o = {}) => ({
  id: uid(),
  statusCode: 200,
  headers: [],
  bodyFields: [],
  desc: '',
  ...o
})

// ─── gRPC Proto 字段工厂 ───
export const makeProtoField = (o = {}) => ({
  id: uid(),
  fieldNumber: 1,
  name: '',
  type: 'string',
  modifier: 'optional',
  constraint: noneConstraint(),
  desc: '',
  remark: '',
  children: [],
  ...o
})

// ─── HTTP Content-Type 枚举 ───
export const HTTP_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
  'text/xml',
]

// ─── HTTP 方法枚举 ───
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

// ─── gRPC 字段类型枚举 ───
export const PROTO_FIELD_TYPES = [
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
  'sint32', 'sint64', 'fixed32', 'fixed64',
  'string', 'bool', 'bytes',
  'map', 'message',
]

// ─── HTTP 常用 Header 预设 ───
export const COMMON_HEADERS = [
  'Authorization', 'Accept', 'Content-Type', 'X-Request-Id',
  'Cache-Control', 'User-Agent', 'Accept-Language', 'X-Api-Version',
]

// ── 报文传输配置工厂 ───
export const makeTransportConfig = (transportType) => {
  switch (transportType) {
    case 'TCP':
      return { port: 0, timeout: 3000 }
    case 'HTTP':
      return {
        method: 'GET',
        path: '',
        contentType: 'application/json',
        headers: [],
        auth: { type: 'none', username: '', password: '', token: '', keyName: '', keyLocation: 'header', keyValue: '' },
      }
    case 'gRPC':
      return {
        serverAddress: '',
        serviceName: '',
        methodName: '',
        streamingMode: 'unary',
        tls: { enabled: false, certPath: '' },
        timeout: 30,
        compression: 'none',
      }
    // ── OSE：基于 UDP 的报文传输（消息头 + 消息体）──
    // OSE 消息头含嵌套结构体与常量；消息长度等由 OSE 自动生成，目标地址 / 消息类型等由用户填写。
    // OSE 消息体同样为嵌套结构体 + 常量，类似 UDP 协议，最终以 uint16 等基础类型组合（由下方发送/接收字段定义）。
    case 'OSE':
      return {
        baseTransport: 'UDP',           // 底层基于 UDP 传输
        srcPort: 50001,                 // 源端口 uint16  0xC331
        dstPort: 9999,                  // 目的端口 uint16 0x270F
        totalLength: 14,                // OSE 总长 uint16 0x000E（由 OSE 自动计算，用户只读）
        checksum: '0x2A71',             // 校验和 uint16
        targetAddress: '',              // 目标地址（用户填写）
        messageType: '',                // 消息类型（用户填写）
        bodyDesc: '',                   // 消息体结构说明（嵌套结构体 + 常量）
        autoGenerated: ['totalLength'], // OSE 自动生成的字段
      }
    // ── 4908A：基于 TCP/IP（UDP + TCP）──
    // UDP 承载实时数据传输 / 实时数据控制传输；TCP 承载可靠数据控制传输。
    // 实时数据传输根据数据长短决定是否分组及是否启用应答：有可靠需求时不分组并启用应答；
    // 无可靠需求时（分组或不分组）均不设置应答。首部字段按位 / 按字节定义后组装，形如 TCP 首部。
    case '4908A':
      return {
        baseTransport: 'TCP',           // 底层基于 TCP/IP（含 UDP 与 TCP）
        channelMode: 'UDP-REALTIME',     // UDP-REALTIME / UDP-CTRL / TCP-RELIABLE
        srcPort: 80,                     // 源端口 16bit    0x0050
        dstPort: 52013,                  // 目的端口 16bit  0xCAED
        seq: 12000,                      // 序号 SEQ 32bit  0x00002EE0
        ack: 35679,                      // 确认号 ACK 32bit 0x00008B1F
        dataOffset: 5,                   // 数据偏移 4bit
        reserved: 0,                     // 保留 6bit
        flags: { URG: false, ACK: true, PSH: false, RST: false, SYN: true, FIN: false },
        window: 65535,                   // 窗口 16bit     0xFFFF
        checksum: '0x482C',              // 检验和 16bit
        urgentPointer: 0,                // 紧急指针 16bit  0x0000
        options: '',                     // 选项（可变）
        padding: '',                     // 填充
        // 实时传输策略
        groupEnabled: false,             // 是否分组（长报文分组传输）
        ackEnabled: false,               // 是否启用应答机制（有可靠需求时开启）
      }
    // ── MDS：传输类型待确认，配置暂留空 ──
    case 'MDS':
      return {}
    default:
      return {}
  }
}

// ─── 兼容：简易偏移重算（完整版在 utils/offsetCalc.js） ───
export const recomputeOffsets = (fields) => {
  let offset = 0
  for (const f of fields) {
    f.byteOffset = offset
    if (f.kind === 'repeat') {
      const groupSize = computeGroupSize(f.children)
      f.groupByteSize = groupSize
      const count = f.repeatMode === 'fixed' ? f.repeatCount : 1
      offset += groupSize * count
    } else {
      offset += f.byteLength || 0
    }
  }
}

// 计算字段数组的总字节数（不含重复展开）
const computeGroupSize = (fields) => {
  let size = 0
  for (const f of fields) {
    if (f.kind === 'repeat') {
      const inner = computeGroupSize(f.children)
      const count = f.repeatMode === 'fixed' ? f.repeatCount : 1
      size += inner * count
    } else {
      size += f.byteLength || 0
    }
  }
  return size
}

// ─── 在 fields 数组中查找字段（含嵌套） ───
export const findFieldById = (fields, id) => {
  for (const f of fields) {
    if (f.id === id) return f
    if (f.children?.length) {
      for (const c of f.children) {
        if (c.id === id) return c
      }
    }
    if (f.kind === 'repeat' && f.children?.length) {
      const found = findFieldById(f.children, id)
      if (found) return found
    }
  }
  return null
}

// ─── 获取某字段之前的数值字段列表（供动态重复次数引用） ───
export const getNumericFieldsBefore = (fields, targetId) => {
  const result = []
  for (const f of fields) {
    if (f.id === targetId) break
    if (f.kind === 'byte' && isNumericType(f.dataType)) {
      result.push({ label: f.name || `字段#${f.id}`, value: f.id })
    }
    if (f.kind === 'repeat') {
      // 不深入 repeat 内部
    }
  }
  return result
}

// ─── v1 → 五类数据规则 数据迁移 ───
// 把老 type='常量'/'位组序流'/'共识体'/'流文件'/'结构矩阵'
// 以及中间版本 type='bytes'/'array' 自动映射到五类标准类型
// 幂等: 已经是标准类型时保留原样
const VALID_CATEGORIES = new Set(['scalar', 'bitstream', 'struct', 'matrix', 'file'])
const migrateV1Param = (p) => {
  if (!p) return p
  let targetType = p.type
  // 先尝试旧中文名映射
  if (V1_TO_V2_TYPE[targetType]) targetType = V1_TO_V2_TYPE[targetType]
  // 再尝试中间版本映射
  else if (LEGACY_TO_NEW_TYPE[targetType]) targetType = LEGACY_TO_NEW_TYPE[targetType]
  // 如果还是无效类型，默认为标量
  if (!VALID_CATEGORIES.has(targetType)) targetType = 'scalar'
  return {
    ...p,
    type: targetType,
    encoding: p.encoding || p.dataType || 'uint8',
    children: Array.isArray(p.children) ? p.children.map(migrateV1Param) : [],
  }
}

const migrateV1Interface = (iface) => {
  // Convert old flat protocolRefs (number[]) to ProtocolRef[] with default role
  // Do NOT strip request/response/path yet — migrateAllFromV1 still handles legacy transport fields
  const migratedRefs = Array.isArray(iface.protocolRefs)
    ? iface.protocolRefs
      .filter(Boolean)
      .map((id) => {
        if (typeof id !== 'object') return { protocolId: id, role: 'send' }
        // 报文管理界面不再区分收发：无 role 的引用保留未定义状态（对所有收发上下文生效）
        const role = id.role === 'request' ? 'send' : id.role === 'response' ? 'receive' : id.role
        return { ...id, role }
      })
    : []
  return { ...iface, protocolRefs: migratedRefs }
}

export const useProtocolStore = defineStore('protocol', {
  state: () => ({
    protocols: JSON.parse(JSON.stringify(seedProtocols)),
    // 字段 = 纯数据结构定义（可复用字段模板）
    // 报文 = 传输类型 + 传输配置 + 字段引用组合
    interfaces: JSON.parse(JSON.stringify(seedInterfaces))
      .map(migrateV1Interface)
      .map((i) => {
        i.transportConfig = makeTransportConfig(i.transportType)
        if (!Array.isArray(i.datasetIds)) i.datasetIds = []
        if (!i.strategy) i.strategy = defaultIfaceStrategy()
        if (!i.sendInterval) i.sendInterval = 500
        if (i.ownerIfaceId === undefined) i.ownerIfaceId = null // 排他归属：所属接口 id
        if (i.fileId === undefined) i.fileId = null // 文件数据源：文件直发测试
        return i
      }),
    // 接口独立于报文：接口持有报文（messageIds，排他归属），报文再引用字段。
    testInterfaces: JSON.parse(JSON.stringify(seedTestInterfaces)).map((i) => ({
      ...i,
      messageIds: Array.isArray(i.messageIds) ? i.messageIds : [],
    })),
    selectedProtocolId: null,
    selectedInterfaceId: null,
    selectedTestInterfaceId: null,
  }),

  getters: {
    protocolOptions: (s) => s.protocols.map((p) => ({ label: p.name, value: p.id })),
    selectedProtocol: (s) => s.protocols.find((p) => p.id === s.selectedProtocolId) || null,
    selectedInterface: (s) => s.interfaces.find((i) => i.id === s.selectedInterfaceId) || null,
    selectedTestInterface: (s) => s.testInterfaces.find((i) => i.id === s.selectedTestInterfaceId) || null,
    protocolName: (s) => (id) => s.protocols.find((p) => p.id === id)?.name || '—',

  },

  actions: {
    /* ---- v1 → v2 数据迁移 ---- */
    migrateAllFromV1() {
      // ── 阶段0: 报文排他归属迁移（接口直挂报文 messageIds / 报文 ownerIfaceId）──
      this.migrateMessageOwnership()

      // ── 阶段1: 迁移报文传输配置与显式字段引用 ──
      // 字段与报文是独立层级，不再把旧 request/response 自动生成顶层字段。
      this.interfaces = this.interfaces.map((iface) => {
        const tc = { ...(iface.transportConfig || {}) }
        const tt = iface.transportType

        // ── 移动 path 到 transportConfig ──
        if (iface.path) {
          if (tt === 'HTTP') tc.path = iface.path
          else if (tt === 'gRPC') {
            const parts = iface.path.replace(/^\//, '').split('/')
            tc.serviceName = parts[0] || ''
            tc.methodName = parts.slice(1).join('/') || ''
          }
          else if (tt === 'TCP') tc.port = tc.port || 0  // TCP path was decorative
        }

        // ── 给已有的 protocolRefs 补角色 ──
        const finalRefs = [...(iface.protocolRefs || [])].filter(Boolean).map(ref => {
          if (typeof ref === 'object' && ref.protocolId) {
            // 报文管理界面不再区分收发：无 role 的引用保留未定义状态
            const role = ref.role === 'request' ? 'send' : ref.role === 'response' ? 'receive' : ref.role
            return { ...ref, role }
          }
          return { protocolId: ref, role: 'send' }
        })

        return {
          ...iface,
          transportConfig: tc,
          protocolRefs: finalRefs,
          // 清除遗留字段
          request: undefined,
          response: undefined,
          path: undefined,
        }
      })

      // ── 阶段2: 字段迁移 ──
      this.protocols.forEach((p) => {
        if (Array.isArray(p.config?.requestBody?.fields)) {
          p.config.requestBody.fields = p.config.requestBody.fields.map(migrateV1Param)
        }
        if (Array.isArray(p.config?.responses)) {
          p.config.responses.forEach((r) => {
            if (Array.isArray(r.bodyFields)) r.bodyFields = r.bodyFields.map(migrateV1Param)
          })
        }
        if (Array.isArray(p.config?.requestMessage)) {
          p.config.requestMessage = p.config.requestMessage.map(migrateV1Param)
        }
        if (Array.isArray(p.config?.responseMessage)) {
          p.config.responseMessage = p.config.responseMessage.map(migrateV1Param)
        }
        if (Array.isArray(p.config?.messageBody)) {
          p.config.messageBody = p.config.messageBody.map(migrateV1Param)
        }
        if (p.config?.fields && !p.fields) {
          p.fields = p.config.fields.map(migrateV1Param)
        }
        if (p.config?.framing && !p.framing) p.framing = p.config.framing
        if (p.config?.checksum && !p.checksum) p.checksum = p.config.checksum
        if (p.config?.endian && !p.endian) p.endian = p.config.endian
        if (!p.category) {
          p.category = (p.fields || []).some((field) => ['byte', 'bit', 'repeat'].includes(field.kind))
            ? 'bitstream'
            : 'struct'
        }
      })
    },

    /* ---- 报文排他归属迁移：接口直挂报文 ----
     * 新模型：报文只属于一个接口（ownerIfaceId），接口持 messageIds 顺序索引。
     * 迁移：对没有 messageIds 的旧接口，从旧链路
     *   datasetIds → 数据集.linkedInterface/linkedMessage → 报文实体 反推归属回填。
     * 幂等：已有 messageIds 的接口跳过。
     */
    migrateMessageOwnership() {
      const dataStore = useTestDataStore()
      // 1) 接口缺 messageIds → 从旧数据集链路反推
      this.testInterfaces.forEach((iface) => {
        if (!iface || !Array.isArray(iface.messageIds) || !iface.messageIds.length) {
          const ids = new Set((iface?.datasetIds || []).map((id) => String(id)))
          const names = (dataStore.datasets || [])
            .filter((d) => ids.has(String(d.id)))
            .map((d) => d.linkedInterface || d.linkedMessage)
            .filter(Boolean)
          const owned = this.interfaces.filter((m) =>
            names.some((n) => m.name === n || String(m.id) === String(n))
          )
          iface.messageIds = owned.map((m) => m.id)
          owned.forEach((m) => { m.ownerIfaceId = iface.id })
        }
      })
      // 2) 反向：报文已标归属但接口未回填 → 补回
      this.interfaces.forEach((m) => {
        if (!m.ownerIfaceId) return
        const iface = this.testInterfaces.find((i) => String(i.id) === String(m.ownerIfaceId))
        if (iface && !(iface.messageIds || []).some((id) => String(id) === String(m.id))) {
          iface.messageIds = [...(iface.messageIds || []), m.id]
        }
      })
    },

    /* ---- 报文：接口下新增（排他归属） ----
     * 新建报文实体并归属到指定接口；transportType 在报文体上配置。
     */
    addMessageToInterface(ifaceId, payload = {}) {
      const iface = this.testInterfaces.find((i) => String(i.id) === String(ifaceId))
      if (!iface) return null
      const message = this.addInterface({
        name: payload.name || '新建报文',
        transportType: payload.transportType || 'OSE',
        ownerIfaceId: ifaceId,
        desc: payload.desc || '',
        systemId: payload.systemId ?? iface.systemId ?? null,
        moduleId: payload.moduleId ?? iface.moduleId ?? null,
      })
      iface.messageIds = [...(iface.messageIds || []), message.id]
      return message
    },

    /* ---- 报文：文件数据源（解析文件生成报文并挂到接口，fileId 标记直发） ---- */
    attachFileMessageToInterface(ifaceId, { name, fileId, transportType = 'OSE', desc = '' }) {
      const iface = this.testInterfaces.find((i) => String(i.id) === String(ifaceId))
      if (!iface) return null
      const message = this.addInterface({
        name: name || '文件导入报文',
        transportType,
        ownerIfaceId: ifaceId,
        fileId,
        desc: desc || '文件数据源报文（内容直发，不修改不校验）',
        systemId: iface.systemId ?? null,
        moduleId: iface.moduleId ?? null,
      })
      iface.messageIds = [...(iface.messageIds || []), message.id]
      return message
    },

    /* ---- 报文：移动到接口（排他归属：自动从原接口摘除） ---- */
    attachMessageToInterface(ifaceId, messageId) {      const iface = this.testInterfaces.find((i) => String(i.id) === String(ifaceId))
      const message = this.interfaces.find((m) => String(m.id) === String(messageId))
      if (!iface || !message) return false
      // 从原归属接口摘除
      this.testInterfaces.forEach((i) => {
        if (String(i.id) === String(ifaceId)) return
        const idx = (i.messageIds || []).findIndex((id) => String(id) === String(messageId))
        if (idx >= 0) i.messageIds.splice(idx, 1)
      })
      message.ownerIfaceId = ifaceId
      if (!(iface.messageIds || []).some((id) => String(id) === String(messageId))) {
        iface.messageIds = [...(iface.messageIds || []), messageId]
      }
      return true
    },

    /* ---- 报文：从接口移除（排他归属下删除即移除，报文实体一并删除） ---- */
    removeMessageFromInterface(ifaceId, messageId) {
      const iface = this.testInterfaces.find((i) => String(i.id) === String(ifaceId))
      if (iface) {
        iface.messageIds = (iface.messageIds || []).filter((id) => String(id) !== String(messageId))
      }
      this._removeInterfaceEntity(messageId)
      return true
    },

    // 删除报文实体（含 __inline 字段协议清理）
    _removeInterfaceEntity(id) {
      const target = this.interfaces.find((m) => String(m.id) === String(id))
      const idx = this.interfaces.findIndex((m) => String(m.id) === String(id))
      if (idx >= 0) this.interfaces.splice(idx, 1)
      // 内联字段协议一并清理
      if (target) {
        ;(target.protocolRefs || []).forEach((ref) => {
          const pid = ref && typeof ref === 'object' ? ref.protocolId : ref
          const proto = this.protocols.find((p) => p.id === pid)
          if (proto?.__inline) this.removeProtocol(pid)
        })
      }
      if (this.selectedInterfaceId === id) this.selectedInterfaceId = this.interfaces[0]?.id ?? null
    },

    /* ---- 字段 ---- */
    addProtocol(p = {}) {
      const fields = p.fields || p.config?.fields || []
      const framing = p.framing || p.config?.framing || null
      const isByteStream = p.category === 'bitstream' ||
        p.type === 'TCP' ||
        !!framing ||
        fields.some((field) => ['byte', 'bit', 'repeat'].includes(field.kind))
      const np = {
        id: uid(),
        name: makeUniqueName(
          [...this.protocols, ...this.interfaces, ...this.testInterfaces],
          directionlessFieldName(p.name),
        ),
        systemId: p.systemId ?? null,
        moduleId: p.moduleId ?? null,
        desc: p.desc || '',
        category: isByteStream ? 'bitstream' : (p.category || 'struct'),
        endian: p.endian || p.config?.endian || 'big',
        fields,
        framing,
        checksum: p.checksum || p.config?.checksum || null,
        fileConfig: p.fileConfig || null,
        matrixConfig: p.matrixConfig || null,
      }
      this.protocols.unshift(np)
      this.selectedProtocolId = np.id
      return np
    },
    removeProtocol(id) {
      const i = this.protocols.findIndex((p) => p.id === id)
      if (i >= 0) this.protocols.splice(i, 1)
      if (this.selectedProtocolId === id) this.selectedProtocolId = this.protocols[0]?.id ?? null
    },

    // ── 报文内联字段（message field）──
    // 在报文上下文中直接定义字段：创建 __inline 协议实体并加入报文引用；
    // role 不在此写入（收发由监控侧按需决定）。
    addMessageField(iface, payload) {
      const proto = buildMessageField(payload)
      this.protocols.unshift(proto)
      if (!Array.isArray(iface.protocolRefs)) iface.protocolRefs = []
      iface.protocolRefs.push({ protocolId: proto.id })
      this.selectedProtocolId = proto.id
      return proto
    },
    removeMessageField(iface, protocolId) {
      const idx = (iface.protocolRefs || []).findIndex((r) => (r.protocolId ?? r) === protocolId)
      if (idx >= 0) iface.protocolRefs.splice(idx, 1)
      // 内联字段移除后从字段库一并删除（不再被复用）
      const proto = this.protocols.find((p) => p.id === protocolId)
      if (proto?.__inline) this.removeProtocol(protocolId)
    },
    moveMessageField(iface, protocolId, direction) {
      const refs = iface.protocolRefs || []
      const idx = refs.findIndex((r) => (r.protocolId ?? r) === protocolId)
      if (idx < 0) return
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= refs.length) return
      const [m] = refs.splice(idx, 1)
      refs.splice(newIdx, 0, m)
    },

    // 添加字节字段（末尾追加或指定位置后插入）
    addByteField(protocol, afterId = null) {
      const fields = protocol.fields || (protocol.fields = [])
      const f = makeByteField({ name: `字段${fields.length + 1}` })
      if (afterId != null) {
        const idx = fields.findIndex(x => x.id === afterId)
        if (idx >= 0) { fields.splice(idx + 1, 0, f); return f }
      }
      fields.push(f)
      return f
    },

    // 添加位子字段
    addBitField(byteField) {
      const children = byteField.children
      const lastBit = children.length > 0 ? Math.max(...children.map(c => c.bitStart)) : 8
      const start = lastBit > 0 ? lastBit - 1 : 0
      const f = makeBitField({ name: `位段${children.length + 1}`, bitStart: start, bitEnd: start })
      children.push(f)
      return f
    },

    // 添加重复字段组
    addRepeatGroup(protocol, afterId = null) {
      const fields = protocol.fields || (protocol.fields = [])
      const g = makeRepeatGroup({ name: `重复组${fields.filter(f => f.kind === 'repeat').length + 1}` })
      if (afterId != null) {
        const idx = fields.findIndex(x => x.id === afterId)
        if (idx >= 0) { fields.splice(idx + 1, 0, g); return g }
      }
      fields.push(g)
      return g
    },

    // 上移/下移字段
    moveField(protocol, id, direction) {
      const fields = protocol.fields
      const idx = fields.findIndex(f => f.id === id)
      if (idx < 0) return
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= fields.length) return
      const tmp = fields[idx]
      fields[idx] = fields[newIdx]
      fields[newIdx] = tmp
    },

    // 递归删除字段（含 repeat 内部）
    removeFieldById(protocol, id) {
      const fields = protocol.fields
      const i = fields.findIndex((f) => f.id === id)
      if (i >= 0) {
        fields.splice(i, 1)
        return true
      }
      // 在 byte children 中查找
      for (const f of fields) {
        if (f.children?.length) {
          const ci = f.children.findIndex((c) => c.id === id)
          if (ci >= 0) { f.children.splice(ci, 1); return true }
        }
        // 在 repeat children 中递归
        if (f.kind === 'repeat' && f.children?.length) {
          if (this._removeFromRepeatChildren(f, id)) return true
        }
      }
      return false
    },

    // 内部：从 repeat 子树中删除
    _removeFromRepeatChildren(group, id) {
      const i = group.children.findIndex(f => f.id === id)
      if (i >= 0) { group.children.splice(i, 1); return true }
      for (const f of group.children) {
        if (f.children?.length) {
          const ci = f.children.findIndex(c => c.id === id)
          if (ci >= 0) { f.children.splice(ci, 1); return true }
        }
        if (f.kind === 'repeat') {
          if (this._removeFromRepeatChildren(f, id)) return true
        }
      }
      return false
    },

    // 更新帧结构配置
    updateFraming(protocol, patch) {
      if (!protocol.framing) protocol.framing = makeFraming()
      Object.assign(protocol.framing, patch)
    },

    // 更新校验配置
    updateChecksum(protocol, patch) {
      if (!protocol.checksum) protocol.checksum = makeChecksum()
      Object.assign(protocol.checksum, patch)
    },

    /* ---- 报文 ---- */
    addInterface(it = {}) {
      const transportType = it.transportType || null
      const ni = {
        id: uid(),
        name: makeUniqueName(
          [...this.protocols, ...this.interfaces, ...this.testInterfaces],
          it.name || '新建报文',
        ),
        transportType,
        transportConfig: it.transportConfig || (transportType ? makeTransportConfig(transportType) : {}),
        protocolRefs: it.protocolRefs || [],
        systemId: it.systemId ?? null,
        moduleId: it.moduleId ?? null,
        desc: it.desc || '',
        operationType: it.operationType || '',
        datasetIds: it.datasetIds || [],
        ownerIfaceId: it.ownerIfaceId ?? null, // 排他归属：所属接口 id
        fileId: it.fileId ?? null,             // 文件数据源：文件直发测试
        strategy: it.strategy || defaultIfaceStrategy(),
        sendInterval: it.sendInterval || 500,
      }
      this.interfaces.unshift(ni)
      this.selectedInterfaceId = ni.id
      return ni
    },
    removeInterface(id) {
      const i = this.interfaces.findIndex((x) => x.id === id)
      if (i >= 0) this.interfaces.splice(i, 1)
      // 排他归属：清理接口对已删报文的引用
      this.testInterfaces.forEach((iface) => {
        iface.messageIds = (iface.messageIds || []).filter((mid) => String(mid) !== String(id))
      })
      if (this.selectedInterfaceId === id) this.selectedInterfaceId = this.interfaces[0]?.id ?? null
    },
    /* ---- 接口（排他归属报文，1:N） ---- */
    addTestInterface(it = {}) {
      const ni = {
        id: `endpoint-${uid()}`,
        name: makeUniqueName(
          [...this.protocols, ...this.interfaces, ...this.testInterfaces],
          it.name || '新建接口',
        ),
        systemId: it.systemId ?? null,
        moduleId: it.moduleId ?? null,
        datasetIds: it.datasetIds || [],
        messageIds: it.messageIds || [], // 排他归属的报文 id 列表（顺序索引）
        desc: it.desc || '',
        strategy: it.strategy || defaultIfaceStrategy(),
        sendInterval: it.sendInterval || 500,
      }
      this.testInterfaces.unshift(ni)
      this.selectedTestInterfaceId = ni.id
      return ni
    },
    removeTestInterface(id) {
      const i = this.testInterfaces.findIndex((item) => item.id === id)
      if (i >= 0) {
        // 排他归属：删除接口时级联删除其名下报文（不产生孤儿报文）
        const iface = this.testInterfaces[i]
        ;[...(iface.messageIds || [])].forEach((messageId) => {
          this._removeInterfaceEntity(messageId)
        })
        this.testInterfaces.splice(i, 1)
      }
      if (this.selectedTestInterfaceId === id) {
        this.selectedTestInterfaceId = this.testInterfaces[0]?.id ?? null
      }
    },
    addParam(list) {
      list.push(makeParam({ name: `param${list.length + 1}` }))
    },
    removeParam(list, id) {
      const i = list.findIndex((p) => p.id === id)
      if (i >= 0) list.splice(i, 1)
    }
  }
})
