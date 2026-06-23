import { defineStore } from 'pinia'
import { useSystemStore } from '@/stores/system'

let seq = 100
const rnd = (a, b) => Math.round(a + Math.random() * (b - a))

const makeNode = (o = {}) => ({
  id: ++seq,
  systemId: null,
  name: '',
  ip: '127.0.0.1',
  port: 8080,
  timeout: 3000,
  reconnect: { enabled: true, retries: 3, interval: 2000 },
  status: 'disconnected', // disconnected | connecting | connected | error
  latency: 0,
  ...o
})

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    nodes: [
      makeNode({ systemId: 'sys-weapon', name: '武器管理模块', ip: '192.168.10.21', port: 9001, status: 'connected', latency: 12 }),
      makeNode({ systemId: 'sys-weapon', name: '弹药状态模块', ip: '192.168.10.32', port: 9100, status: 'connected', latency: 23 }),
      makeNode({ systemId: 'sys-fire-control', name: '火控解算模块', ip: '192.168.20.45', port: 8080, status: 'disconnected' }),
      makeNode({ systemId: 'sys-fire-control', name: '指挥链路模块', ip: '192.168.20.46', port: 7070, status: 'disconnected' })
    ],
    selectedId: 101
  }),

  getters: {
    selected: (s) => s.nodes.find((n) => n.id === s.selectedId) || null,
    modulesOf: (s) => (systemId) => (systemId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemId)),
    connectedCount: (s) => {
      const systemStore = useSystemStore()
      const modules = systemStore.currentId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemStore.currentId)
      return modules.filter((n) => n.status === 'connected').length
    }
  },

  actions: {
    select(id) {
      this.selectedId = id
    },
    add(node) {
      const n = makeNode(node)
      this.nodes.unshift(n)
      this.selectedId = n.id
      return n
    },
    remove(id) {
      const i = this.nodes.findIndex((n) => n.id === id)
      if (i >= 0) this.nodes.splice(i, 1)
      if (this.selectedId === id) this.selectedId = this.nodes[0]?.id ?? null
    },
    unassignSystem(systemId) {
      this.nodes.forEach((module) => {
        if (module.systemId === systemId) module.systemId = null
      })
    },
    // 模拟建立连接：约 1 秒后返回结果，~85% 成功。返回 Promise<boolean> 供页面 toast。
    connect(id) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n) return Promise.resolve(false)
      n.status = 'connecting'
      return new Promise((resolve) => {
        setTimeout(() => {
          if (n.status !== 'connecting') return resolve(false)
          const ok = Math.random() > 0.15
          n.status = ok ? 'connected' : 'error'
          n.latency = ok ? rnd(8, 30) : 0
          resolve(ok)
        }, 900)
      })
    },
    disconnect(id) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n) return
      n.status = 'disconnected'
      n.latency = 0
    }
  }
})
