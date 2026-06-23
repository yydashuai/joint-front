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
    protocols: [
      {
        id: uid(),
        name: '帧控制字节协议',
        endian: 'big',
        systemId: 'sys-weapon',
        moduleId: 101,
        desc: '1 字节帧控制位标志（bit7 → bit0），适用于压缩/加密等按位场景',
        fields: [
          makeField({ name: '加密标志', startBit: 7, endBit: 7, constraint: range(0, 1), desc: '1=加密，0=明文' }),
          makeField({ name: '压缩标志', startBit: 6, endBit: 6, constraint: range(0, 1), desc: '1=压缩，0=未压缩' }),
          makeField({ name: '分片标志', startBit: 5, endBit: 5, constraint: range(0, 1), desc: '1=分片包，0=完整包' }),
          makeField({ name: '应答标志', startBit: 4, endBit: 4, constraint: range(0, 1), desc: '1=应答包，0=业务包' }),
          makeField({ name: '保留位1', startBit: 3, endBit: 3, constraint: fixed(0), desc: '固定填 0，预留协议扩展' }),
          makeField({ name: '保留位2', startBit: 2, endBit: 2, constraint: fixed(0), desc: '固定填 0，预留协议扩展' }),
          makeField({ name: '数据类型', startBit: 0, endBit: 1, constraint: range(0, 3), desc: '00=JSON 01=二进制 10=字符串 11=XML' })
        ]
      },
      {
        id: uid(),
        name: '遥测帧协议',
        endian: 'big',
        systemId: 'sys-fire-control',
        moduleId: 103,
        desc: '遥测下行帧（按位定义，可跨字节）',
        fields: [
          makeField({ name: '帧头', startBit: 0, endBit: 15, constraint: fixed(0xeb90), desc: '固定 0xEB90' }),
          makeField({ name: '设备ID', startBit: 16, endBit: 23, constraint: range(0, 255), desc: '分系统编号' }),
          makeField({ name: '温度', startBit: 24, endBit: 55, constraint: range(-5000, 15000), desc: '摄氏度 ×100' })
        ]
      }
    ],
    interfaces: [
      {
        id: uid(),
        name: '查询设备状态',
        path: '/device/status',
        systemId: 'sys-weapon',
        moduleId: 101,
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
      },
      {
        id: uid(),
        name: '上报弹药余量',
        path: '/ammo/report',
        systemId: 'sys-weapon',
        moduleId: 102,
        desc: '查询并上报各类弹药余量',
        request: [
          makeParam({ name: 'queryType', type: '常量', dataType: 'uint8', desc: '查询类型' })
        ],
        response: [
          makeParam({ name: 'total', type: '常量', dataType: 'uint16', desc: '弹药总量' }),
          makeParam({ name: 'available', type: '常量', dataType: 'uint16', desc: '可用量' }),
          makeParam({
            name: 'detail', type: '共识体', desc: '余量明细',
            children: [
              makeParam({ name: 'typeA', type: '常量', dataType: 'uint16', desc: 'A 型余量' }),
              makeParam({ name: 'typeB', type: '常量', dataType: 'uint16', desc: 'B 型余量' })
            ]
          })
        ]
      },
      {
        id: uid(),
        name: '目标分配解算',
        path: '/fire/solve',
        systemId: 'sys-fire-control',
        moduleId: 103,
        desc: '提交目标列表，返回火力分配方案',
        request: [
          makeParam({
            name: 'targets', type: '共识体', desc: '目标列表',
            children: [
              makeParam({ name: 'targetId', type: '常量', dataType: 'uint16', desc: '目标编号' }),
              makeParam({ name: 'priority', type: '常量', dataType: 'uint8', desc: '优先级' })
            ]
          }),
          makeParam({ name: 'unitCount', type: '常量', dataType: 'uint8', desc: '火力单元数' })
        ],
        response: [
          makeParam({ name: 'result', type: '常量', dataType: 'int32', desc: '解算结果码' }),
          makeParam({ name: 'plan', type: '流文件', desc: '分配方案文件' }),
          makeParam({ name: 'raw', type: '位组序流', desc: '原始解算帧' })
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
