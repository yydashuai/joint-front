import { defineStore } from 'pinia'
import { useSystemStore } from '@/stores/system'
import { nodes as seedNodes } from '@/mock/seed-data'
import { makeUniqueName } from '@/utils/entityName'

let seq = 200
const rnd = (a, b) => Math.round(a + Math.random() * (b - a))
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const makeNode = (o = {}) => ({
  id: ++seq,
  systemId: null,
  name: '',
  ip: '127.0.0.1',
  port: 8080,
  desc: '',
  reachable: true,
  status: 'offline',
  latency: 0,
  pingLog: [],
  ...o
})

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    nodes: JSON.parse(JSON.stringify(seedNodes)),
    selectedId: seedNodes[0]?.id ?? null
  }),

  getters: {
    selected: (s) => s.nodes.find((n) => n.id === s.selectedId) || null,
    modulesOf: (s) => (systemId) => (systemId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemId)),
    onlineCount: (s) => {
      const systemStore = useSystemStore()
      const modules = systemStore.currentId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemStore.currentId)
      return modules.filter((n) => n.status === 'online').length
    },
    /** 所有 Broker 节点（保留 getter 供首页兼容，实际不再有 broker 数据） */
    brokers: (s) => s.nodes.filter(n => n.nodeType === 'broker'),
  },

  actions: {
    select(id) {
      this.selectedId = id
    },
    add(node) {
      const n = makeNode({
        ...node,
        name: makeUniqueName(this.nodes, node.name || '新建模块'),
      })
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

    // 手动检测连通性：默认发 4 个探测包，逐行输出，据回包数刷新灯色/时延。
    async ping(id, count = 4) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n || n.status === 'pinging') return false
      n.status = 'pinging'
      n.pingLog = [`正在检测 ${n.ip}:${n.port} 的连通性（发送 ${count} 个探测包）:`]
      let received = 0
      let totalTime = 0
      for (let i = 0; i < count; i++) {
        await delay(rnd(180, 360))
        const ok = n.reachable && Math.random() > 0.05
        if (ok) {
          const t = rnd(1, 30)
          received += 1
          totalTime += t
          n.pingLog.push(`来自 ${n.ip} 的回复: 时间=${t}ms`)
        } else {
          n.pingLog.push('请求超时。')
        }
      }
      const lost = count - received
      n.pingLog.push('')
      n.pingLog.push(`${n.ip} 连通性统计: 已发送 = ${count}，已接收 = ${received}，丢失 = ${lost} (${Math.round((lost / count) * 100)}% 丢失)`)
      n.status = received > 0 ? 'online' : 'offline'
      n.latency = received > 0 ? Math.round(totalTime / received) : 0
      return received > 0
    },

    // 自动检测（系统每 5 秒一次）：静默探测单个包，仅刷新灯色/时延，不写输出。
    autoPing(id) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n || n.status === 'pinging') return
      const ok = n.reachable && Math.random() > 0.05
      n.status = ok ? 'online' : 'offline'
      n.latency = ok ? rnd(1, 30) : 0
    },
  }
})
