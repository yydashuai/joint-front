import { defineStore } from 'pinia'
import { protocols as seedProtocols, interfaces as seedInterfaces } from '@/mock/seed-data'

let seq = 2000
export const uid = () => ++seq

export const makeProtocolRef = (protocolId, role = 'frame') => ({ protocolId, role })

// ─── 传输类型（接口使用） ───
export const TRANSPORT_TYPES = [
  { value: 'TCP', label: 'TCP', desc: '面向连接的字节流传输' },
  { value: 'HTTP', label: 'HTTP', desc: '超文本传输协议' },
  { value: 'gRPC', label: 'gRPC', desc: '高性能远程过程调用' },
  { value: 'MQ', label: '消息队列', desc: '异步消息中间件' },
]

// ─── 协议角色（接口引用协议时标注其在通信中的作用）───
// 统一两种角色，所有传输类型通用
export const PROTOCOL_ROLES = [
  { value: 'request', label: '请求', desc: '发送方向的数据结构' },
  { value: 'response', label: '响应', desc: '接收方向的数据结构' },
]
// 向后兼容
export const TRANSPORT_ROLES = {
  HTTP: PROTOCOL_ROLES, TCP: PROTOCOL_ROLES, gRPC: PROTOCOL_ROLES, MQ: PROTOCOL_ROLES,
}
export const ALL_TRANSPORT_ROLES = ['request', 'response']

// ─── 五类数据规则（便携式智能联试工具设计文档 V7.4 定义）───
// 用户定义协议字段时，必须先选择数据规则类别，再选择具体数据类型：
//   标量：单一数值，可表示整数或实数，不附带维度或结构信息。例如温度、压力、时间间隔。
//   位组序流：连续二进制位序列，强调顺序与位级解析，区别于传统的"字节流"。适用于底层通信协议、编码载荷。
//   共识体：由多个字段组成的结构化数据块，字段间存在语义或业务上的强关联。例如一条完整的指令或状态报告。
//   流文件：持久化的二进制或文本文件，以文件整体为操作单元，适用于日志、报文存储与回放。
//   结构矩阵：二维表格形式的数据，行列有明确语义，适用于批量参数、配置表或测试用例集。
export const DATA_RULE_CATEGORIES = [
  { value: 'scalar',  label: '标量',     icon: 'Number',   desc: '单一数值（整数/实数），不附带维度或结构信息', color: '#409EFF' },
  { value: 'bitstream', label: '位组序流', icon: 'Connection', desc: '连续二进制位序列，按字节/位级解析', color: '#E6A23C' },
  { value: 'struct',  label: '共识体',   icon: 'Grid',     desc: '多字段结构化数据块，字段间存在语义关联', color: '#67C23A' },
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

// ─── 接口参数节点（使用五类数据规则） ───
// 五类: scalar(标量) / bitstream(位组序流) / struct(共识体) / matrix(结构矩阵) / file(流文件)
export const makeParam = (o = {}) => ({
  id: uid(),
  name: '',
  type: 'scalar',                  // scalar | bitstream | struct | matrix | file
  encoding: 'uint8',               // 仅 scalar 用, 来自 SCALAR_ENCODINGS
  protocolRef: null,               // 仅 bitstream 用, 引用 protocol id
  fileName: '', fileSize: 0,       // 仅 file 用
  required: true,
  defaultValue: null,
  constraint: noneConstraint(),
  unit: '',                        // 字段单位, 如 "kg" / "m/s" / "Hz"
  align: 1,                        // 字节对齐, 仅 struct/matrix 用
  children: [],                    // struct/matrix 用
  desc: '',
  ...o
})

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
  ...o
})

// ─── HTTP 请求体字段（支持嵌套） ───
export const makeBodyField = (o = {}) => ({
  id: uid(),
  name: '',
  dataType: 'string',
  required: true,
  constraint: noneConstraint(),
  desc: '',
  children: [],
  ...o
})

// ─── HTTP 响应配置工厂 ───
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
  children: [],
  ...o
})

// ─── MQ 消息体字段工厂（支持嵌套，类似 HTTP bodyField） ───
export const makeMqBodyField = (o = {}) => ({
  id: uid(),
  name: '',
  dataType: 'uint8',
  required: true,
  constraint: noneConstraint(),
  desc: '',
  children: [],
  ...o
})

// ─── MQ 消息头属性工厂 ───
export const makeMqHeader = (o = {}) => ({
  id: uid(),
  key: '',
  dataType: 'utf8',
  required: false,
  defaultValue: '',
  desc: '',
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

// ─── MQ 消息体字段数据类型（与 BYTE_DATA_TYPES 统一 + 共识体复合类型） ───
export const MQ_BODY_DATA_TYPES = [
  { value: 'uint8',   label: 'uint8',   group: '数值' },
  { value: 'int8',    label: 'int8',    group: '数值' },
  { value: 'uint16',  label: 'uint16',  group: '数值' },
  { value: 'int16',   label: 'int16',   group: '数值' },
  { value: 'uint32',  label: 'uint32',  group: '数值' },
  { value: 'int32',   label: 'int32',   group: '数值' },
  { value: 'uint64',  label: 'uint64',  group: '数值' },
  { value: 'int64',   label: 'int64',   group: '数值' },
  { value: 'float32', label: 'float32', group: '数值' },
  { value: 'float64', label: 'float64', group: '数值' },
  { value: 'utf8',    label: 'UTF-8',   group: '字符' },
  { value: '共识体',  label: '共识体',  group: '复合' },
]

// ─── MQ Broker 类型枚举 ───
export const MQ_BROKER_TYPES = ['RabbitMQ', 'Kafka', 'RocketMQ', 'ActiveMQ']

// ─── MQ 接口操作类型 ───
export const MQ_OPERATION_TYPES = [
  { value: 'publish',      label: '发布消息',   desc: '向 Topic/Exchange 发布消息' },
  { value: 'subscribe',    label: '订阅消费',   desc: '从 Topic/Queue 消费消息' },
  { value: 'request-reply',label: '请求-响应', desc: '发布并等待 Reply-To 响应' },
]

// ─── MQ 消息头数据类型 ───
export const MQ_HEADER_DATA_TYPES = [
  { value: 'utf8',    label: 'UTF-8' },
  { value: 'uint8',   label: 'uint8' },
  { value: 'int32',   label: 'int32' },
  { value: 'uint32',  label: 'uint32' },
  { value: 'int64',   label: 'int64' },
]

// ─── MQ 消息键数据类型 ───
export const MQ_KEY_DATA_TYPES = [
  { value: 'utf8',    label: 'UTF-8' },
  { value: 'int32',   label: 'int32' },
  { value: 'uint32',  label: 'uint32' },
  { value: 'int64',   label: 'int64' },
]

// ── 接口传输配置工厂 ───
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
    case 'MQ':
      return {
        topic: '',
        brokerType: 'RabbitMQ',
        qos: 0,
        ackMode: 'auto',
        messageFormat: 'JSON',
      }
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
  // Do NOT strip request/response/path yet — migrateAllFromV1 uses them to generate inline protocols
  const migratedRefs = Array.isArray(iface.protocolRefs)
    ? iface.protocolRefs.map(id => typeof id === 'object' ? id : { protocolId: id, role: 'request' })
    : []
  return { ...iface, protocolRefs: migratedRefs }
}

export const useProtocolStore = defineStore('protocol', {
  state: () => ({
    protocols: JSON.parse(JSON.stringify(seedProtocols)),
    // 协议 = 纯数据结构定义（可复用字段模板）
    // 接口 = 传输类型 + 传输配置 + 协议引用组合
    interfaces: JSON.parse(JSON.stringify(seedInterfaces)).map(migrateV1Interface),
    selectedProtocolId: null,
    selectedInterfaceId: null
  }),

  getters: {
    protocolOptions: (s) => s.protocols.map((p) => ({ label: p.name, value: p.id })),
    selectedProtocol: (s) => s.protocols.find((p) => p.id === s.selectedProtocolId) || null,
    selectedInterface: (s) => s.interfaces.find((i) => i.id === s.selectedInterfaceId) || null,
    protocolName: (s) => (id) => s.protocols.find((p) => p.id === id)?.name || '—',

    /** 查询引用了某协议的接口列表 */
    interfacesByProtocol: (s) => (protocolId) => s.interfaces.filter((i) =>
      (i.protocolRefs || []).some(ref => (typeof ref === 'object' ? ref.protocolId : ref) === protocolId)
    ),

    /**
     * 协议摘要: 数据结构信息（用于 Protocol.vue 头部摘要）
     * 返回 { fieldCount, hasFraming, hasChecksum, endian }
     */
    protocolSummary: (s) => (id) => {
      const p = s.protocols.find((x) => x.id === id)
      if (!p) return null
      const fieldCount = (p.fields || []).length
      return {
        fieldCount,
        hasFraming: !!p.framing,
        hasChecksum: !!p.checksum,
        endian: p.endian || 'big',
        isStruct: !p.fields?.some?.(f => f.kind === 'byte' || f.kind === 'bit'),
      }
    },
  },

  actions: {
    /* ---- v1 → v2 数据迁移 ---- */
    migrateAllFromV1() {
      // ── 阶段1: 从接口的 request/response 生成内联协议 ──
      let inlineSeq = 3000
      const inlinePid = () => ++inlineSeq
      const inlineProtocols = []

      // 角色映射：统一使用 request/response
      const REQUEST_ROLES = { HTTP: 'request', TCP: 'request', gRPC: 'request', MQ: 'request' }
      const RESPONSE_ROLES = { HTTP: 'response', TCP: 'response', gRPC: 'response', MQ: 'response' }

      const migrateParamTree = (params) => {
        if (!Array.isArray(params)) return []
        return params.map(p => ({
          ...migrateV1Param(p),
          id: p.id || inlinePid(),
          children: Array.isArray(p.children) ? migrateParamTree(p.children) : [],
        }))
      }

      this.interfaces = this.interfaces.map((iface) => {
        const newRefs = [...(iface.protocolRefs || [])]
        const tc = { ...(iface.transportConfig || {}) }
        const tt = iface.transportType

        // ── 移动 path 到 transportConfig ──
        if (iface.path) {
          if (tt === 'HTTP') tc.path = iface.path
          else if (tt === 'gRPC') {
            const parts = iface.path.replace(/^\//, '').split('/')
            tc.serviceName = parts[0] || ''
            tc.methodName = parts.slice(1).join('/') || ''
          } else if (tt === 'MQ') tc.topic = iface.path
          else if (tt === 'TCP') tc.port = tc.port || 0  // TCP path was decorative
        }

        // ── 从 request 生成内联协议 ──
        if (Array.isArray(iface.request) && iface.request.length > 0) {
          const reqFields = migrateParamTree(iface.request)
          const reqProto = {
            id: inlinePid(),
            name: `${iface.name} — 请求`,
            systemId: iface.systemId,
            moduleId: iface.moduleId,
            desc: `${iface.name} 请求参数`,
            endian: 'big',
            fields: reqFields,
            framing: null,
            checksum: null,
            __inline: true,
          }
          inlineProtocols.push(reqProto)
          const role = REQUEST_ROLES[tt] || 'request'
          newRefs.push({ protocolId: reqProto.id, role })
        }

        // ── 从 response 生成内联协议 ──
        if (Array.isArray(iface.response) && iface.response.length > 0) {
          const resFields = migrateParamTree(iface.response)
          const resProto = {
            id: inlinePid(),
            name: `${iface.name} — 响应`,
            systemId: iface.systemId,
            moduleId: iface.moduleId,
            desc: `${iface.name} 响应参数`,
            endian: 'big',
            fields: resFields,
            framing: null,
            checksum: null,
            __inline: true,
          }
          inlineProtocols.push(resProto)
          const role = RESPONSE_ROLES[tt] || 'response'
          newRefs.push({ protocolId: resProto.id, role })
        }

        // ── 给已有的 protocolRefs 补角色（默认 request） ──
        const finalRefs = newRefs.map(ref => {
          if (typeof ref === 'object' && ref.protocolId) return ref
          return { protocolId: ref, role: 'request' }
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

      // ── 将内联协议追加到协议列表 ──
      if (inlineProtocols.length) {
        this.protocols.push(...inlineProtocols)
      }

      // ── 阶段2: 协议字段迁移 ──
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
      })
    },

    /* ---- 协议 ---- */
    addProtocol(p = {}) {
      const np = {
        id: uid(),
        name: p.name || '新建协议',
        systemId: p.systemId ?? null,
        moduleId: p.moduleId ?? null,
        desc: p.desc || '',
        endian: p.endian || 'big',
        fields: p.fields || [],
        framing: p.framing || null,
        checksum: p.checksum || null,
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

    /* ---- 接口 ---- */
    addInterface(it = {}) {
      const transportType = it.transportType || null
      const ni = {
        id: uid(),
        name: it.name || '新建接口',
        transportType,
        transportConfig: it.transportConfig || (transportType ? makeTransportConfig(transportType) : {}),
        protocolRefs: it.protocolRefs || [],
        systemId: it.systemId ?? null,
        moduleId: it.moduleId ?? null,
        desc: it.desc || '',
        operationType: it.operationType || '',
      }
      this.interfaces.unshift(ni)
      this.selectedInterfaceId = ni.id
      return ni
    },
    removeInterface(id) {
      const i = this.interfaces.findIndex((x) => x.id === id)
      if (i >= 0) this.interfaces.splice(i, 1)
      if (this.selectedInterfaceId === id) this.selectedInterfaceId = this.interfaces[0]?.id ?? null
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
