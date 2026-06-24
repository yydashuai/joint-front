import { defineStore } from 'pinia'
import { useSystemStore } from '@/stores/system'

let seq = 100
const rnd = (a, b) => Math.round(a + Math.random() * (b - a))
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// 内网链路：不建立长连接，统一用 ping 探测可达性。
// status：online(绿灯·链路通) | offline(灰灯·链路不通) | pinging(探测中)
// reachable：该链路在内网中是否真实可达（决定 ping 结果），仅用于静态演示
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
    nodes: [
      makeNode({ systemId: 'sys-weapon', name: '武器管理模块', ip: '192.168.10.21', port: 9001, desc: '武器装订与发射控制主链路', reachable: true, status: 'online', latency: 12 }),
      makeNode({ systemId: 'sys-weapon', name: '弹药状态模块', ip: '192.168.10.32', port: 9100, desc: '弹药余量与装填状态上报链路', reachable: true, status: 'online', latency: 23 }),
      makeNode({ systemId: 'sys-fire-control', name: '火控解算模块', ip: '192.168.20.45', port: 8080, desc: '火控解算与目标分配数据链路', reachable: true, status: 'offline' }),
      makeNode({ systemId: 'sys-fire-control', name: '指挥链路模块', ip: '192.168.20.46', port: 7070, desc: '指挥所指令下行链路（当前不通）', reachable: false, status: 'offline' })
    ],
    selectedId: 101
  }),

  getters: {
    selected: (s) => s.nodes.find((n) => n.id === s.selectedId) || null,
    modulesOf: (s) => (systemId) => (systemId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemId)),
    onlineCount: (s) => {
      const systemStore = useSystemStore()
      const modules = systemStore.currentId === null ? s.nodes : s.nodes.filter((n) => n.systemId === systemStore.currentId)
      return modules.filter((n) => n.status === 'online').length
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
    }
  }
})
