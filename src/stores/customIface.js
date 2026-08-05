import { defineStore } from 'pinia'
import { makeUniqueName } from '@/utils/entityName'
import { makeTransportConfig } from '@/stores/protocol'

let seq = 9001
const uid = (prefix) => `${prefix}-${++seq}`

/**
 * 按传输类型/协议预置报文头字段模板。
 * 报文头根据「协议 + 传输配置」定义，第二步弹窗中可编辑。
 */
export const makeHeaderConfig = (transportType = 'OSE') => {
  switch (transportType) {
    case 'OSE':
      return { headFlag: 'EB 90', messageId: '0x01', lengthField: 'auto', checksum: 'sum', remark: '' }
    case '4908A':
      return { headFlag: '68 00', messageId: '0x02', lengthField: 'auto', checksum: 'sum', remark: '' }
    default:
      return { headFlag: '', messageId: '', lengthField: 'auto', checksum: 'none', remark: '' }
  }
}

/** 监听配置默认值（接收侧使用） */
export const makeListenConfig = (protocol = 'OSE') => ({
  ip: '',
  protocol,
  messageId: '',
})

/**
 * 自定义接口 store。
 * 自定义接口只要求用户配置：传输配置 + 报文头（按协议/传输配置定义）+ 报文体（可为加密 hex，系统不解析不校验）。
 * 接收侧通过 listenConfig（监听 IP / 协议 / 消息号）匹配解析。
 */
export const useCustomIfaceStore = defineStore('customIface', {
  state: () => ({
    customIfaces: [
      {
        id: 'ci-9001',
        name: '密文接口A',
        remark: '外部密文链路，报文体为加密数据',
        transportType: 'OSE',
        transportConfig: { ...makeTransportConfig('OSE'), targetAddress: '192.168.1.101', messageType: '0x02' },
        headerConfig: makeHeaderConfig('OSE'),
        bodyHex: '9F 3A C1 0E 77 2B 58 D4',
        listenConfig: { ip: '192.168.1.101', protocol: 'OSE', messageId: '0x02' },
      },
      {
        id: 'ci-9002',
        name: '密文接口B',
        remark: '4908A 可靠通道，待配置',
        transportType: '4908A',
        transportConfig: makeTransportConfig('4908A'),
        headerConfig: makeHeaderConfig('4908A'),
        bodyHex: '',
        listenConfig: { ip: '0.0.0.0', protocol: '4908A', messageId: '' },
      },
    ],
  }),

  getters: {
    byId: (s) => (id) => s.customIfaces.find((i) => String(i.id) === String(id)) || null,
  },

  actions: {
    add(payload = {}) {
      const transportType = payload.transportType || 'OSE'
      const iface = {
        id: uid('ci'),
        name: makeUniqueName(this.customIfaces, payload.name || '自定义接口'),
        remark: payload.remark || '',
        transportType,
        transportConfig: payload.transportConfig || makeTransportConfig(transportType),
        headerConfig: payload.headerConfig || makeHeaderConfig(transportType),
        bodyHex: payload.bodyHex || '',
        listenConfig: payload.listenConfig || makeListenConfig(transportType),
      }
      this.customIfaces.push(iface)
      return iface
    },

    update(id, patch) {
      const iface = this.byId(id)
      if (!iface) return null
      const next = { ...patch }
      if (Object.prototype.hasOwnProperty.call(next, 'name')) {
        next.name = makeUniqueName(this.customIfaces, next.name, iface)
      }
      Object.assign(iface, next)
      return iface
    },

    remove(id) {
      const idx = this.customIfaces.findIndex((i) => String(i.id) === String(id))
      if (idx >= 0) this.customIfaces.splice(idx, 1)
    },
  },
})
