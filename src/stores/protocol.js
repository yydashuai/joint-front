import { defineStore } from 'pinia'
import { protocols as seedProtocols, interfaces as seedInterfaces } from '@/mock/seed-data'

let seq = 2000
const uid = () => ++seq

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

// 取值约束
export const range = (min, max) => ({ mode: 'range', min, max, value: 0 })
export const fixed = (value) => ({ mode: 'fixed', min: 0, max: 0, value })

// ─── 字节级字段（顶层行） ───
export const makeByteField = (o = {}) => ({
  id: uid(),
  kind: 'byte',
  name: '',
  byteOffset: 0,
  byteLength: 1,
  bitMode: false,
  constraint: range(0, 255),
  desc: '',
  children: [],
  ...o
})

// ─── 位级字段（嵌套在字节字段下） ───
export const makeBitField = (o = {}) => ({
  id: uid(),
  kind: 'bit',
  name: '',
  bitStart: 7,
  bitEnd: 7,
  constraint: range(0, 1),
  desc: '',
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

// ─── 类型专用 config 工厂 ───
export const makeConfig = (type) => {
  switch (type) {
    case 'TCP':
    case 'UDP':
      return { endian: 'big', fields: [] }
    case 'HTTP':
      return {
        method: 'GET', path: '', contentType: 'application/json',
        headers: [], auth: { type: 'none', token: '' }
      }
    case 'gRPC':
      return {
        serviceName: '', methodName: '', protoRef: '',
        serverAddress: '', tls: { enabled: false, certPath: '' },
        metadata: [], streamingMode: 'unary'
      }
    case 'MQ':
      return {
        brokerType: 'RabbitMQ', brokerAddress: '',
        topic: '', queueName: '', exchangeName: '', routingKey: '',
        consumerGroup: '', qos: 0, ackMode: 'auto', messageFormat: 'JSON'
      }
    default:
      return {}
  }
}

// ─── 自动计算字节偏移 ───
export const recomputeOffsets = (fields) => {
  let offset = 0
  for (const f of fields) {
    f.byteOffset = offset
    offset += f.byteLength
  }
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

    // 添加字节字段
    addByteField(protocol) {
      const fields = protocol.config.fields
      const lastField = fields[fields.length - 1]
      const offset = lastField ? lastField.byteOffset + lastField.byteLength : 0
      const f = makeByteField({ name: `字段${fields.length + 1}`, byteOffset: offset })
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

    // 递归删除字段
    removeFieldById(protocol, id) {
      const fields = protocol.config.fields
      const i = fields.findIndex((f) => f.id === id)
      if (i >= 0) {
        fields.splice(i, 1)
        recomputeOffsets(fields)
        return true
      }
      // 在 children 中查找
      for (const f of fields) {
        const ci = f.children?.findIndex((c) => c.id === id)
        if (ci >= 0) { f.children.splice(ci, 1); return true }
      }
      return false
    },

    /* ---- 接口 ---- */
    addInterface(it = {}) {
      const ni = { id: uid(), name: it.name || '新建接口', path: '', systemId: null, moduleId: null, desc: '', request: [], response: [], ...it }
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
