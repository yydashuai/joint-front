import { defineStore } from 'pinia'

let seq = 1000
const uid = () => ++seq

// 5 种字段数据类型
export const FIELD_TYPES = ['常量', '位组序流', '共识体', '流文件', '结构矩阵']
export const CONST_SUBTYPES = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float', 'double', 'string']
export const ENDIANS = [
  { label: '大端 (BE)', value: 'big' },
  { label: '小端 (LE)', value: 'little' }
]

// 协议字段矩阵的一行（字节范围用 [start, end] 闭区间表示，长度 = end - start + 1）
export const makeField = (o = {}) => ({
  id: uid(),
  name: '',
  type: '常量',
  dataType: 'uint8', // 常量子类型
  start: 0,
  end: 0,
  protocolRef: null, // 位组序流 → 绑定的协议 id
  children: [], // 共识体 → 子字段
  desc: '',
  ...o
})

// 接口请求/响应结构里的一个参数节点（与字段同构）
export const makeParam = (o = {}) => makeField(o)

export const useProtocolStore = defineStore('protocol', {
  state: () => ({
    protocols: [
      {
        id: uid(),
        name: '遥测帧协议',
        endian: 'big',
        desc: '分系统遥测下行帧，固定帧头 + 载荷',
        fields: [
          makeField({ name: '帧头', type: '常量', dataType: 'uint16', start: 0, end: 1, desc: '固定 0xEB90' }),
          makeField({ name: '设备ID', type: '常量', dataType: 'uint8', start: 2, end: 2, desc: '分系统编号' }),
          makeField({ name: '温度', type: '常量', dataType: 'float', start: 3, end: 6, desc: '摄氏度' }),
          makeField({
            name: '状态字', type: '共识体', start: 7, end: 8, desc: '按位状态',
            children: [
              makeField({ name: '上电', type: '常量', dataType: 'uint8', start: 7, end: 7 }),
              makeField({ name: '故障码', type: '常量', dataType: 'uint8', start: 8, end: 8 })
            ]
          })
        ]
      },
      {
        id: uid(),
        name: '指令协议',
        endian: 'little',
        desc: '上行控制指令',
        fields: [
          makeField({ name: '指令码', type: '常量', dataType: 'uint16', start: 0, end: 1 }),
          makeField({ name: '参数区', type: '位组序流', start: 2, end: 9, desc: '按指令码解析' })
        ]
      }
    ],
    interfaces: [
      {
        id: uid(),
        name: '查询设备状态',
        desc: '请求设备状态，返回遥测帧',
        request: [
          makeParam({ name: 'deviceId', type: '常量', dataType: 'uint8', desc: '目标设备' }),
          makeParam({
            name: 'options', type: '共识体', desc: '查询选项',
            children: [
              makeParam({ name: 'verbose', type: '常量', dataType: 'uint8' }),
              makeParam({ name: 'timeoutMs', type: '常量', dataType: 'uint16' })
            ]
          })
        ],
        response: [
          makeParam({ name: 'code', type: '常量', dataType: 'int32', desc: '状态码' }),
          makeParam({ name: 'payload', type: '位组序流', desc: '遥测帧载荷' })
        ]
      }
    ],
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
      const np = { id: uid(), name: p.name || '新建协议', endian: 'big', desc: '', fields: [], ...p }
      this.protocols.unshift(np)
      this.selectedProtocolId = np.id
      return np
    },
    removeProtocol(id) {
      const i = this.protocols.findIndex((p) => p.id === id)
      if (i >= 0) this.protocols.splice(i, 1)
      if (this.selectedProtocolId === id) this.selectedProtocolId = this.protocols[0]?.id ?? null
    },
    addField(protocol, parent = null) {
      const list = parent ? parent.children : protocol.fields
      list.push(makeField({ name: `字段${list.length + 1}` }))
    },
    removeField(list, id) {
      const i = list.findIndex((f) => f.id === id)
      if (i >= 0) list.splice(i, 1)
    },

    /* ---- 接口 ---- */
    addInterface(it = {}) {
      const ni = { id: uid(), name: it.name || '新建接口', desc: '', request: [], response: [], ...it }
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
