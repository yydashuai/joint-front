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

// 5 种接口参数数据类型（保留不变）
export const FIELD_TYPES = ['常量', '位组序流', '共识体', '流文件', '结构矩阵']
export const CONST_SUBTYPES = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float', 'double', 'string']
export const ENDIANS = [
  { label: '大端 (BE)', value: 'big' },
  { label: '小端 (LE)', value: 'little' }
]

// ─── 字节数据类型枚举 ───
export const BYTE_DATA_TYPES = [
  // 数值型
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
  // 字符型
  { value: 'ascii',   label: 'ASCII',   group: '字符', bytes: 0 },
  { value: 'gbk',     label: 'GBK',     group: '字符', bytes: 0 },
  { value: 'utf8',    label: 'UTF-8',   group: '字符', bytes: 0 },
  // 其他
  { value: 'bcd',     label: 'BCD8421', group: '其他', bytes: 0 },
  { value: 'raw',     label: '原始字节', group: '其他', bytes: 0 },
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

// ─── 接口参数节点（保留不变） ───
export const makeParam = (o = {}) => ({
  id: uid(),
  name: '',
  type: '常量',
  dataType: 'uint8',
  protocolRef: null,
  children: [],
  desc: '',
  ...o
})

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
  dataType: 'string',
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
  dataType: 'string',
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

// ─── MQ 消息体字段数据类型 ───
export const MQ_BODY_DATA_TYPES = [
  { value: 'string',  label: 'String',  group: '基础' },
  { value: 'integer', label: 'Integer', group: '基础' },
  { value: 'float',   label: 'Float',   group: '基础' },
  { value: 'double',  label: 'Double',  group: '基础' },
  { value: 'boolean', label: 'Boolean', group: '基础' },
  { value: 'object',  label: 'Object',  group: '复合' },
  { value: 'array',   label: 'Array',   group: '复合' },
  { value: 'timestamp', label: 'Timestamp', group: '特殊' },
  { value: 'uuid',    label: 'UUID',    group: '特殊' },
  { value: 'enum',    label: 'Enum',    group: '特殊' },
]

// ─── MQ Broker 类型枚举 ───
export const MQ_BROKER_TYPES = ['RabbitMQ', 'Kafka', 'RocketMQ', 'ActiveMQ']

// ─── MQ 接口操作类型 ───
export const MQ_OPERATION_TYPES = [
  { value: 'publish',      label: '发布消息',   desc: '向 Topic/Exchange 发布消息' },
  { value: 'subscribe',    label: '订阅消费',   desc: '从 Topic/Queue 消费消息' },
  { value: 'request-reply',label: '请求-响应', desc: '发布并等待 Reply-To 响应' },
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
        messageKey: { dataType: 'string', pattern: '', desc: '' },
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

export const useProtocolStore = defineStore('protocol', {
  state: () => ({
    protocols: JSON.parse(JSON.stringify(seedProtocols)),
    interfaces: JSON.parse(JSON.stringify(seedInterfaces)),
    selectedProtocolId: null,
    selectedInterfaceId: null
  }),

  getters: {
    protocolOptions: (s) => s.protocols.map((p) => ({ label: p.name, value: p.id })),
    selectedProtocol: (s) => s.protocols.find((p) => p.id === s.selectedProtocolId) || null,
    selectedInterface: (s) => s.interfaces.find((i) => i.id === s.selectedInterfaceId) || null,
    protocolName: (s) => (id) => s.protocols.find((p) => p.id === id)?.name || '—'
  },

  actions: {
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
