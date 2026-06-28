import { defineStore } from 'pinia'
import { useSystemStore } from '@/stores/system'
import { nodes as seedNodes } from '@/mock/seed-data'

let seq = 200
const rnd = (a, b) => Math.round(a + Math.random() * (b - a))
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// 内网链路：不建立长连接，统一用 ping 探测可达性。
// status：online(绿灯·链路通) | offline(灰灯·链路不通) | pinging(探测中)
// reachable：该链路在内网中是否真实可达（决定 ping 结果），仅用于静态演示
const defaultHealthCheck = () => ({
  level1: { status: 'pending', latency: null, detail: '' },
  level2: { status: 'pending', latency: null, detail: '' },
  level3: { status: 'pending', detail: '', metrics: {} },
  lastCheck: null,
  overall: 'unknown',
})

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
  nodeType: 'module',
  brokerType: '',
  managementPort: 0,
  connectedBrokerId: null,
  authInfo: { username: 'guest', password: '******' },
  healthCheck: defaultHealthCheck(),
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
    /** 所有 Broker 节点 */
    brokers: (s) => s.nodes.filter(n => n.nodeType === 'broker'),
    /** 查找某个模块关联的 Broker */
    brokerOf: (s) => (moduleId) => {
      const node = s.nodes.find(n => n.id === moduleId)
      if (!node?.connectedBrokerId) return null
      return s.nodes.find(n => n.id === node.connectedBrokerId) || null
    },
    /** 当前系统可见的 Broker 节点 */
    visibleBrokers: (s) => {
      const systemStore = useSystemStore()
      const brokers = s.nodes.filter(n => n.nodeType === 'broker')
      if (systemStore.currentId === null) return brokers
      return brokers.filter(n => n.systemId === systemStore.currentId)
    },
    /** 各 Broker 健康概览 */
    brokerHealthSummary: (s) => {
      const brokers = s.nodes.filter(n => n.nodeType === 'broker')
      return brokers.map(b => ({
        id: b.id,
        name: b.name,
        brokerType: b.brokerType,
        overall: b.healthCheck?.overall || 'unknown',
        level1: b.healthCheck?.level1?.status || 'pending',
        level2: b.healthCheck?.level2?.status || 'pending',
        level3: b.healthCheck?.level3?.status || 'pending',
      }))
    },
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

    /** 添加一个 Broker 节点 */
    addBroker(data = {}) {
      const n = makeNode({
        name: data.name || '新建 Broker',
        ip: data.ip || '127.0.0.1',
        port: data.port || 5672,
        nodeType: 'broker',
        brokerType: data.brokerType || 'RabbitMQ',
        managementPort: data.managementPort || 15672,
        desc: data.desc || '消息中间件 Broker',
        ...data,
      })
      this.nodes.unshift(n)
      this.selectedId = n.id
      return n
    },

    /** 将普通模块关联到 Broker 节点 */
    linkBroker(moduleId, brokerId) {
      const node = this.nodes.find(n => n.id === moduleId)
      if (node) node.connectedBrokerId = brokerId
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

    /** Broker 三级健康检查（模拟逐级探测） */
    async runBrokerHealthCheck(brokerId) {
      const n = this.nodes.find(x => x.id === brokerId)
      if (!n || n.nodeType !== 'broker') return null
      const hc = n.healthCheck
      const portLabel = n.brokerType === 'Kafka' ? 9092 : (n.brokerType === 'RocketMQ' ? 9876 : 5672)
      const protoLabel = n.brokerType === 'Kafka' ? 'AdminClient' : (n.brokerType === 'RocketMQ' ? 'NameServer' : 'AMQP')
      const mgmtLabel = n.brokerType === 'Kafka' ? 'AdminClient.describeCluster' : (n.brokerType === 'RocketMQ' ? 'Dashboard API' : 'GET /api/overview')

      // 重置
      hc.level1 = { status: 'checking', latency: null, detail: '' }
      hc.level2 = { status: 'pending', latency: null, detail: '' }
      hc.level3 = { status: 'pending', detail: '', metrics: {} }
      hc.overall = 'checking'
      hc.lastCheck = null

      // Level 1: 端口可达性
      await delay(rnd(400, 800))
      const l1Ok = n.reachable && Math.random() > 0.08
      const l1Ms = rnd(1, 8)
      hc.level1 = {
        status: l1Ok ? 'pass' : 'fail',
        latency: l1Ms,
        detail: l1Ok ? `TCP ${n.ip}:${portLabel} 连接成功 (${l1Ms}ms)` : `TCP ${n.ip}:${portLabel} 连接超时`,
      }
      if (!l1Ok) {
        hc.overall = 'error'
        hc.lastCheck = new Date().toLocaleString('zh-CN', { hour12: false })
        return hc
      }

      // Level 2: 客户端认证
      hc.level2.status = 'checking'
      await delay(rnd(500, 1000))
      const l2Ok = Math.random() > 0.06
      const l2Ms = rnd(20, 80)
      hc.level2 = {
        status: l2Ok ? 'pass' : 'fail',
        latency: l2Ms,
        detail: l2Ok ? `${protoLabel} 握手成功，认证通过 (${l2Ms}ms)` : `${protoLabel} 认证失败：用户名或密码错误`,
      }
      if (!l2Ok) {
        hc.overall = 'error'
        hc.lastCheck = new Date().toLocaleString('zh-CN', { hour12: false })
        return hc
      }

      // Level 3: 集群状态
      hc.level3.status = 'checking'
      await delay(rnd(600, 1200))
      const l3Ok = Math.random() > 0.12
      const l3Warn = !l3Ok && Math.random() > 0.5
      const nodeCount = n.brokerType === 'Kafka' ? rnd(3, 5) : rnd(1, 3)
      const queueCount = rnd(6, 24)
      const consumerCount = rnd(4, 16)
      hc.level3 = {
        status: l3Ok ? 'pass' : (l3Warn ? 'warning' : 'fail'),
        detail: l3Ok
          ? `${nodeCount} 节点在线，${queueCount} 队列正常，${consumerCount} 消费者活跃`
          : (l3Warn ? `${nodeCount} 节点在线（1 节点磁盘使用率 > 85%），${queueCount} 队列` : `集群异常：部分分区不可用`),
        metrics: { nodes: nodeCount, queues: queueCount, consumers: consumerCount },
      }

      hc.overall = l3Ok ? 'healthy' : (l3Warn ? 'warning' : 'error')
      hc.lastCheck = new Date().toLocaleString('zh-CN', { hour12: false })
      return hc
    },
  }
})
