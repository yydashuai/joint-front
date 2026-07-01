import { defineStore } from 'pinia'
import { protocols as seedProtocols, interfaces as seedInterfaces } from '@/mock/seed-data'

let seq = 2000
export const uid = () => ++seq

// ─── 协议类型 ───
export const PROTOCOL_TYPES = [
  { value: 'TCP', label: 'TCP', category: 'byte-stream', desc: '面向连接的字节流协议' },
  { value: 'UDP', label: 'UDP', category: 'byte-stream', desc: '无连接的数据报协议' },
  { value: 'HTTP', label: 'HTTP', category: 'request-response', desc: '超文本传输协议' },
  { value: 'gRPC', label: 'gRPC', category: 'rpc', desc: '高性能远程过程调用框架' },
  { value: 'MQ', label: '消息队列', category: 'message-queue', desc: '异步消息中间件协议' },
]

export const isByteStream = (type) => type === 'TCP' || type === 'UDP'

// ─── v2 接口参数节点类型（标准概念，替换 v1 自创 5 分类）───
// v1 用了「常量 / 位组序流 / 共识体 / 流文件 / 结构矩阵」5 种自创
// 分类, 不符合任何 RFC/标准协议, 演示时常被问「位组序流是什么」。
// v2 改为 RFC/工业标准分类, 同时保留中文 label 方便过渡:
//
//   scalar: 单个标量值(整数/浮点/字符串/布尔), 长度 1/2/4/8 字节
//           或变长(UTF-8 字符串)
//   bytes:  原始字节流, 不解析(可用于「绑定具体协议」或二进制透传)
//   struct: 嵌套结构体, 用 children[] 表达
//   file:   文件流(图片/二进制/CSV 等), 上传后用 url 引用
//   array:  数组, 用 children[] 表达数组元素 schema
//
// v1 → v2 映射: 常量→scalar / 位组序流→bytes / 共识体→struct /
//                流文件→file / 结构矩阵→array
export const FIELD_TYPES = [
  { value: 'scalar', label: '基本类型',  desc: '单个标量值(整数/浮点/字符串/布尔)' },
  { value: 'bytes',  label: '原始字节',  desc: '二进制透传, 可绑定到具体协议解析' },
  { value: 'struct', label: '结构体',    desc: '嵌套字段集合, 用 children 表达' },
  { value: 'array',  label: '数组',      desc: '重复元素集合, 用 children 表达元素 schema' },
  { value: 'file',   label: '文件流',    desc: '上传文件(图片/CSV/二进制等)' },
]
export const FIELD_TYPE_VALUES = FIELD_TYPES.map(t => t.value)

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

// ─── v2 接口参数节点 ───
// 标准 5 种类型: scalar / bytes / struct / array / file
// v1 的「常量/位组序流/共识体/流文件/结构矩阵」会在
// migrateV1Interface() 中自动映射
export const makeParam = (o = {}) => ({
  id: uid(),
  name: '',
  type: 'scalar',                  // scalar | bytes | struct | array | file
  encoding: 'uint8',               // 仅 scalar 用, 来自 SCALAR_ENCODINGS
  protocolRef: null,               // 仅 bytes 用, 引用 protocol id
  fileName: '', fileSize: 0,       // 仅 file 用
  required: true,
  defaultValue: null,
  constraint: noneConstraint(),
  unit: '',                        // 字段单位, 如 "kg" / "m/s" / "Hz"
  align: 1,                        // 字节对齐, 仅 struct/array 用
  children: [],                    // struct/array 用
  desc: '',
  ...o
})

// v1 → v2 类型映射常量
const V1_TO_V2_TYPE = {
  '常量': 'scalar',
  '位组序流': 'bytes',
  '共识体': 'struct',
  '流文件': 'file',
  '结构矩阵': 'array',
}
// v2 → v1 显示文本(只用于老 UI 兼容渲染, 不建议新代码使用)
export const V2_TO_V1_LABEL = {
  scalar: '基本类型',
  bytes: '原始字节',
  struct: '结构体',
  array: '数组',
  file: '文件流',
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

// ─── 类型专用 config 工厂 ───
export const makeConfig = (type) => {
  switch (type) {
    case 'TCP':
      return {
        endian: 'big',
        fields: [],
        framing: makeFraming(),
        checksum: makeChecksum(),
      }
    case 'UDP':
      return {
        endian: 'big',
        fields: [],
        framing: makeFraming({ mode: 'delimiter' }),
        checksum: makeChecksum(),
      }
    case 'HTTP':
      return {
        method: 'GET',
        path: '',
        contentType: 'application/json',
        pathParams: [],
        queryParams: [],
        requestBody: {
          fields: [],
          fileType: '',
          fieldName: '',
        },
        headers: [],
        auth: { type: 'none', username: '', password: '', token: '', keyName: '', keyLocation: 'header', keyValue: '' },
        responses: [makeHttpResponse({ statusCode: 200, desc: '成功响应' })],
      }
    case 'gRPC':
      return {
        serviceName: '',
        methodName: '',
        protoRef: '',
        streamingMode: 'unary',
        requestMessage: [],
        responseMessage: [],
        metadata: [],
        serverAddress: '',
        tls: { enabled: false, certPath: '' },
        timeout: 30,
        compression: 'none',
      }
    case 'MQ':
      return {
        brokerType: 'RabbitMQ', brokerAddress: '',
        topic: '', queueName: '', exchangeName: '', routingKey: '',
        consumerGroup: '', qos: 0, ackMode: 'auto', messageFormat: 'JSON',
        messageBody: [],
        messageHeaders: [],
        messageKey: { dataType: 'utf8', pattern: '', desc: '' },
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

// ─── v1 → v2 数据迁移 ───
// 把老 type='常量'/'位组序流'/'共识体'/'流文件'/'结构矩阵'
// 自动映射到 v2 5 种标准类型
// 幂等: 已经是 v2 type (scalar/bytes/struct/array/file) 时保留原样
const V2_TYPES = new Set(['scalar', 'bytes', 'struct', 'array', 'file'])
const migrateV1Param = (p) => {
  if (!p) return p
  const targetType = V2_TYPES.has(p.type) ? p.type : (V1_TO_V2_TYPE[p.type] || 'scalar')
  return {
    ...p,
    type: targetType,
    encoding: p.encoding || p.dataType || 'uint8',
    children: Array.isArray(p.children) ? p.children.map(migrateV1Param) : [],
  }
}

const migrateV1Interface = (iface) => ({
  ...iface,
  request: Array.isArray(iface.request) ? iface.request.map(migrateV1Param) : [],
  response: Array.isArray(iface.response) ? iface.response.map(migrateV1Param) : [],
})

export const useProtocolStore = defineStore('protocol', {
  state: () => ({
    protocols: JSON.parse(JSON.stringify(seedProtocols)),
    // v2: interfaces 的概念已合并到 protocol.messages,
    //     这里保留旧 interfaces 数组以兼容 v1 UI,
    //     但推荐用 protocol.messages 表达"操作"
    interfaces: JSON.parse(JSON.stringify(seedInterfaces)).map(migrateV1Interface),
    selectedProtocolId: null,
    selectedInterfaceId: null
  }),

  getters: {
    protocolOptions: (s) => s.protocols.map((p) => ({ label: p.name, value: p.id })),
    selectedProtocol: (s) => s.protocols.find((p) => p.id === s.selectedProtocolId) || null,
    selectedInterface: (s) => s.interfaces.find((i) => i.id === s.selectedInterfaceId) || null,
    protocolName: (s) => (id) => s.protocols.find((p) => p.id === id)?.name || '—',

    /**
     * v2: 提取协议下的所有消息(操作/命令/事件)
     * 优先返回 protocol.messages; 若为空, 从 v1 config 兜底提取:
     *   - HTTP: responses[] 里的每个 statusCode + bodyFields
     *   - gRPC: requestMessage + responseMessage
     *   - MQ:   messageBody (整体作为一个 message)
     *   - TCP/UDP binary: 不在 v1 范围, 空数组
     */
    protocolMessages: (s) => (id) => {
      const p = s.protocols.find((x) => x.id === id)
      if (!p) return []
      if (Array.isArray(p.messages) && p.messages.length) return p.messages
      // 兜底: 从 v1 config 提取
      const cfg = p.config || {}
      const fallback = []
      if (p.type === 'HTTP') {
        const method = cfg.method || 'GET'
        const path = cfg.path || '/'
        const req = { id: uid(), name: `${method} ${path}`, direction: 'request', desc: 'HTTP 请求', http: { method, path, contentType: cfg.contentType }, fields: cfg.pathParams?.concat(cfg.queryParams || []).concat(cfg.requestBody?.fields || []).map(migrateV1Param) || [] }
        fallback.push(req)
        if (Array.isArray(cfg.responses)) {
          for (const r of cfg.responses) {
            fallback.push({ id: uid(), name: `响应 ${r.statusCode}`, direction: 'response', desc: r.desc || `HTTP ${r.statusCode}`, http: { method, path, contentType: r.headers?.find(h => h.key === 'Content-Type')?.value || cfg.contentType }, fields: (r.bodyFields || []).map(migrateV1Param) })
          }
        }
      } else if (p.type === 'gRPC') {
        const svc = cfg.serviceName || 'Service'
        const mth = cfg.methodName || 'Method'
        fallback.push({ id: uid(), name: `${svc}.${mth} (请求)`, direction: 'request', desc: 'gRPC 请求消息', grpc: { serviceName: svc, methodName: mth, streaming: cfg.streamingMode }, fields: (cfg.requestMessage || []).map(migrateV1Param) })
        fallback.push({ id: uid(), name: `${svc}.${mth} (响应)`, direction: 'response', desc: 'gRPC 响应消息', grpc: { serviceName: svc, methodName: mth, streaming: cfg.streamingMode }, fields: (cfg.responseMessage || []).map(migrateV1Param) })
      } else if (p.type === 'MQ') {
        const topic = cfg.topic || cfg.queueName || ''
        const op = cfg.exchangeName ? 'publish' : (cfg.queueName ? 'subscribe' : 'publish')
        fallback.push({ id: uid(), name: topic || '消息', direction: op === 'publish' ? 'cmd' : 'event', desc: `${cfg.brokerType || 'MQ'} 消息`, mqtt: { qos: cfg.qos ?? 0, retain: false, topic }, fields: (cfg.messageBody || []).map(migrateV1Param) })
      } else if (p.type === 'TCP' || p.type === 'UDP') {
        // 二进制协议: v1 没有"操作"概念, v2 设计稿建议按 code 区分
        // 暂时从 framing.fixedLength 和 fields 推断一个默认 message
        const fixedLen = cfg.framing?.fixedLength || (cfg.fields?.length || 0)
        fallback.push({ id: uid(), name: '默认帧', direction: 'event', desc: '二进制协议帧 (v1 暂用单 message, 后续按 code 拆分)', code: 0, fields: (cfg.fields || []).map(migrateV1Param) })
      }
      return fallback
    },

    /**
     * v2: 协议头部"传输与编码"配置(用于 Protocol.vue 头部摘要)
     * 返回 { transport, encoding, framing, messageCount }
     */
    protocolSummary: (s) => (id) => {
      const p = s.protocols.find((x) => x.id === id)
      if (!p) return null
      const cfg = p.config || {}
      const transport = {
        host: cfg.host || cfg.brokerAddress || cfg.serverAddress || '',
        port: cfg.port || '',
        tls: cfg.tls?.enabled || false,
      }
      const encodingMap = { TCP: 'binary', UDP: 'binary', HTTP: 'json', gRPC: 'protobuf', MQ: 'json' }
      const messageCount = (p.messages?.length) ||
        (p.type === 'HTTP' ? 1 + (cfg.responses?.length || 0) :
         p.type === 'gRPC' ? 2 :
         p.type === 'MQ' ? 1 :
         p.type === 'TCP' || p.type === 'UDP' ? 1 : 0)
      return { transport, encoding: encodingMap[p.type] || 'unknown', framing: cfg.framing, messageCount }
    },
  },

  actions: {
    /* ---- v1 → v2 数据迁移 ---- */
    migrateAllFromV1() {
      this.interfaces = this.interfaces.map(migrateV1Interface)
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
      })
    },

    /* ---- 协议 ---- */
    addProtocol(p = {}) {
      const type = p.type || 'TCP'
      const np = {
        id: uid(),
        name: p.name || '新建协议',
        type,
        systemId: p.systemId ?? null,
        moduleId: p.moduleId ?? null,
        desc: p.desc || '',
        config: p.config || makeConfig(type),
        // v2: 协议下的消息集合。HTTP/gRPC/MQ 一个协议可有多个
        // message(每个对应一个 method+path / service.method / topic),
        // TCP/UDP 二进制协议用 message.code 区分命令码。
        // v1 模式下该字段可为空, 由 UI 从 interfaces/config 提取展示。
        messages: p.messages || [],
      }
      // 兼容旧种子数据：确保 TCP/UDP config 有 framing/checksum
      if (isByteStream(type)) {
        if (!np.config.framing) np.config.framing = makeFraming()
        if (!np.config.checksum) np.config.checksum = makeChecksum()
        if (!np.config.fields) np.config.fields = []
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

    // 切换协议类型（清空 config）
    switchProtocolType(protocol, newType) {
      protocol.type = newType
      protocol.config = makeConfig(newType)
    },

    // 添加字节字段（末尾追加或指定位置后插入）
    addByteField(protocol, afterId = null) {
      const fields = protocol.config.fields
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
      const fields = protocol.config.fields
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
      const fields = protocol.config.fields
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
      const fields = protocol.config.fields
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
      Object.assign(protocol.config.framing, patch)
    },

    // 更新校验配置
    updateChecksum(protocol, patch) {
      Object.assign(protocol.config.checksum, patch)
    },

    /* ---- MQ 消息体 ---- */
    addMqBodyField(protocol, parentId = null) {
      const config = protocol.config
      if (!config.messageBody) config.messageBody = []
      const f = makeMqBodyField({ name: `field${config.messageBody.length + 1}` })
      if (parentId) {
        const parent = this._findMqField(config.messageBody, parentId)
        if (parent && (parent.dataType === 'object' || parent.dataType === 'array')) {
          if (!parent.children) parent.children = []
          parent.children.push(f)
          return f
        }
      }
      config.messageBody.push(f)
      return f
    },

    removeMqBodyField(protocol, fieldId) {
      const fields = protocol.config.messageBody
      if (!fields) return false
      const i = fields.findIndex(f => f.id === fieldId)
      if (i >= 0) { fields.splice(i, 1); return true }
      for (const f of fields) {
        if (f.children?.length) {
          const ci = f.children.findIndex(c => c.id === fieldId)
          if (ci >= 0) { f.children.splice(ci, 1); return true }
        }
      }
      return false
    },

    addMqHeader(protocol) {
      const config = protocol.config
      if (!config.messageHeaders) config.messageHeaders = []
      const h = makeMqHeader({ key: `header${config.messageHeaders.length + 1}` })
      config.messageHeaders.push(h)
      return h
    },

    removeMqHeader(protocol, headerId) {
      const headers = protocol.config.messageHeaders
      if (!headers) return false
      const i = headers.findIndex(h => h.id === headerId)
      if (i >= 0) { headers.splice(i, 1); return true }
      return false
    },

    // 内部：在 MQ 消息体字段树中查找节点
    _findMqField(fields, id) {
      for (const f of (fields || [])) {
        if (f.id === id) return f
        if (f.children?.length) {
          const found = this._findMqField(f.children, id)
          if (found) return found
        }
      }
      return null
    },

    /* ---- 接口 ---- */
    addInterface(it = {}) {
      const ni = { id: uid(), name: it.name || '新建接口', path: '', systemId: null, moduleId: null, desc: '', operationType: '', request: [], response: [], ...it }
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
