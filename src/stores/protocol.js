import { defineStore } from 'pinia'
import { protocols as seedProtocols, interfaces as seedInterfaces } from '@/mock/seed-data'

let seq = 2000
const uid = () => ++seq

// 5 种字段数据类型
export const FIELD_TYPES = ['常量', '位组序流', '共识体', '流文件', '结构矩阵']
export const CONST_SUBTYPES = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float', 'double', 'string']
export const ENDIANS = [
  { label: '大端 (BE)', value: 'big' },
  { label: '小端 (LE)', value: 'little' }
]

// 取值约束：范围 [min,max] 或 固定值 value
export const range = (min, max) => ({ mode: 'range', min, max, value: 0 })
export const fixed = (value) => ({ mode: 'fixed', min: 0, max: 0, value })

// 协议字段矩阵的一行：最小粒度为「位(bit)」，位段用 [startBit, endBit] 闭区间表示，长度(位) = endBit - startBit + 1
// 取值约束代替原先的数据类型/子类型：范围(x~y) 或 固定值
export const makeField = (o = {}) => ({
  id: uid(),
  name: '',
  startBit: 0,
  endBit: 7,
  constraint: range(0, 255),
  desc: '',
  ...o
})

// 接口请求/响应结构里的一个参数节点（保留 5 种数据类型模型，位组序流可绑协议）
export const makeParam = (o = {}) => ({
  id: uid(),
  name: '',
  type: '常量',
  dataType: 'uint8',
  protocolRef: null, // 位组序流 → 绑定的协议 id
  children: [], // 共识体 → 子字段
  desc: '',
  ...o
})

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
      const np = { id: uid(), name: p.name || '新建协议', endian: 'big', systemId: null, moduleId: null, desc: '', fields: [], ...p }
      this.protocols.unshift(np)
      this.selectedProtocolId = np.id
      return np
    },
    removeProtocol(id) {
      const i = this.protocols.findIndex((p) => p.id === id)
      if (i >= 0) this.protocols.splice(i, 1)
      if (this.selectedProtocolId === id) this.selectedProtocolId = this.protocols[0]?.id ?? null
    },
    addField(protocol) {
      protocol.fields.push(makeField({ name: `字段${protocol.fields.length + 1}` }))
    },
    removeField(list, id) {
      const i = list.findIndex((f) => f.id === id)
      if (i >= 0) list.splice(i, 1)
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
