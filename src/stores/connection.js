import { defineStore } from 'pinia'

let seq = 100
const rnd = (a, b) => Math.round(a + Math.random() * (b - a))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const seedWave = (base) => Array.from({ length: 40 }, () => clamp(base + rnd(-5, 5), 5, 60))

const makeNode = (o = {}) => ({
  id: ++seq,
  name: '',
  protocol: 'TCP',
  ip: '127.0.0.1',
  port: 8080,
  timeout: 3000,
  reconnect: { enabled: true, retries: 3, interval: 2000 },
  status: 'disconnected', // disconnected | connecting | connected | error
  latency: 0,
  sendCount: 0,
  recvCount: 0,
  errorCount: 0,
  wave: [],
  ...o
})

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    nodes: [
      makeNode({ name: '分系统A-主控', protocol: 'TCP', ip: '192.168.1.21', port: 9001, status: 'connected', latency: 12, sendCount: 1280, recvCount: 1275, errorCount: 3, wave: seedWave(12) }),
      makeNode({ name: '分系统B-数据链', protocol: 'UDP', ip: '192.168.1.32', port: 9100, status: 'connected', latency: 23, sendCount: 860, recvCount: 845, errorCount: 1, wave: seedWave(23) }),
      makeNode({ name: '分系统C-遥测', protocol: 'HTTP', ip: '192.168.1.45', port: 8080, status: 'disconnected' })
    ],
    selectedId: 101
  }),

  getters: {
    selected: (s) => s.nodes.find((n) => n.id === s.selectedId) || null,
    connectedCount: (s) => s.nodes.filter((n) => n.status === 'connected').length
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
    connect(id) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n) return
      n.status = 'connecting'
      n.wave = []
      setTimeout(() => {
        if (n.status === 'connecting') {
          n.status = 'connected'
          n.latency = rnd(8, 30)
        }
      }, 800)
    },
    disconnect(id) {
      const n = this.nodes.find((x) => x.id === id)
      if (!n) return
      n.status = 'disconnected'
      n.latency = 0
      n.wave = []
    },
    // 由页面每 1s 调用：模拟心跳、收发与异常计数
    tick() {
      this.nodes.forEach((n) => {
        if (n.status !== 'connected') return
        n.latency = clamp(n.latency + rnd(-4, 4), 5, 60)
        n.sendCount += rnd(2, 8)
        n.recvCount += rnd(2, 8)
        if (Math.random() < 0.08) n.errorCount += 1
        n.wave.push(n.latency)
        if (n.wave.length > 40) n.wave.shift()
      })
    }
  }
})
