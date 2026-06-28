import { defineStore } from 'pinia'
import { useTestTaskStore } from '@/stores/testTask'
import { useProtocolStore } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useRuleStore } from '@/stores/rule'
import { useExceptionStore } from '@/stores/exception'
import { evaluate, makeSample } from '@/utils/ruleEngine'

let runTimer = null
let rxTimer = null

const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
const timeText = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const rnd = (min, max) => Math.round(min + Math.random() * (max - min))

const DEFAULT_REQUESTS = 8
const FALLBACK_RULE_TYPES = ['类型校验', '取值范围', '边界值检测', '字段越界', '格式错误']

const emptyCounters = () => ({
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  errorRequests: 0,
  avgResponseTime: 0,
  rps: 0,
  executionTime: 0,
})

const defaultConfig = () => ({
  mode: 'smoke',
  stress: { threadCount: 10, iterations: 8, rampUpPeriod: 5, thinkTime: 50 },
  endurance: { durationMinutes: 1, concurrentUsers: 5, requestInterval: 500 },
  trigger: 'manual',
  scheduleAt: null,
  periodicInterval: 60,
  periodicUnit: 's',
  periodicCount: null,
  timeout: 30,
  retries: 0,
})

const normalizeId = (value) => String(value ?? '')

const makeHex = (bytes = 12) => Array.from({ length: bytes }, () =>
  rnd(0, 255).toString(16).padStart(2, '0').toUpperCase()
).join(' ')

const taskInterface = (task, protocolStore) => {
  const boundId = task?.bindings?.interfaceId
  return protocolStore.interfaces.find((item) => normalizeId(item.id) === normalizeId(boundId)) ||
    protocolStore.interfaces.find((item) => item.moduleId === task?.moduleId) ||
    null
}

const taskDatasets = (task, dataStore, moduleName) => {
  const ids = task?.bindings?.datasetIds || []
  const byId = dataStore.datasets.filter((item) => ids.some((id) => normalizeId(id) === normalizeId(item.id)))
  if (byId.length) return byId
  return dataStore.datasets.filter((item) => item.systemId === task?.systemId && item.moduleName === moduleName)
}

export const useExecutionStore = defineStore('execution', {
  state: () => ({
    plan: [],
    config: defaultConfig(),
    status: 'idle',
    progress: 0,
    counters: emptyCounters(),
    logLines: [],
    stepResults: [],
    exceptions: [],
    currentRunId: null,
    history: [],
    activeTaskId: null,
    activePlanIndex: 0,
    targetTotal: 0,
    startedAtMs: null,
    startedAt: null,
    finishedAt: null,
    savedRunToTasks: false,
    _stepStats: {},
    _requestCursor: 0,
    mqProbeResults: {},
  }),

  getters: {
    planItems(state) {
      const taskStore = useTestTaskStore()
      const protocolStore = useProtocolStore()
      const dataStore = useTestDataStore()
      const connStore = useConnectionStore()
      const systemStore = useSystemStore()

      return state.plan.map((planItem, index) => {
        const task = taskStore.tasks.find((item) => item.id === planItem.taskId)
        const module = task ? connStore.nodes.find((item) => item.id === task.moduleId) : null
        const system = task ? systemStore.systems.find((item) => item.id === task.systemId) : null
        const iface = taskInterface(task, protocolStore)
        const datasets = taskDatasets(task, dataStore, module?.name)
        const rowCount = datasets.reduce((sum, item) => sum + (item.rows?.length || item.rowCount || 0), 0)
        const baseRequests = rowCount || DEFAULT_REQUESTS
        const estimatedRequests = estimateRequests(baseRequests, state.config)
        const checks = [
          {
            key: 'module',
            label: '目标模块在线',
            ok: module?.status === 'online',
            blocking: true,
            route: '/connection',
            detail: module ? `${module.name} 当前${module.status === 'online' ? '链路通' : '链路不通'}` : '未找到目标模块',
          },
          {
            key: 'interface',
            label: '接口已就绪',
            ok: !!iface,
            blocking: true,
            route: `/task?id=${task?.id || ''}`,
            detail: iface
              ? (task?.bindings?.interfaceId ? `已绑定 ${iface.name}` : `自动匹配 ${iface.name}`)
              : '未绑定接口，且该模块暂无可匹配接口',
          },
          {
            key: 'dataset',
            label: '数据集有数据',
            ok: rowCount > 0,
            blocking: false,
            route: '/test-data',
            detail: rowCount > 0 ? `${datasets.length} 个数据集，共 ${rowCount} 行` : `未绑定数据集，将按默认 ${DEFAULT_REQUESTS} 次请求执行`,
          },
          {
            key: 'rules',
            label: '规则集已绑定',
            ok: !!task?.strategy?.ruleSetId,
            blocking: false,
            route: '/rule',
            detail: task?.strategy?.ruleSetId ? '已绑定规则集' : '未绑定规则集，仅执行基础类型 / 取值校验',
          },
        ]
        const ready = checks.filter((item) => item.blocking).every((item) => item.ok)

        return {
          ...planItem,
          index,
          task,
          module,
          system,
          iface,
          datasets,
          rowCount,
          baseRequests,
          estimatedRequests,
          checks,
          ready,
        }
      }).filter((item) => !!item.task)
    },

    isRunning: (state) => state.status === 'running',
    canStart() {
      const items = this.planItems
      return items.length > 0 && items.every((item) => item.ready)
    },
    blockingReasons() {
      return this.planItems.flatMap((item) =>
        item.checks
          .filter((check) => check.blocking && !check.ok)
          .map((check) => `${item.task.name}：${check.label}`)
      )
    },
    summary(state) {
      const total = state.counters.totalRequests
      const passed = state.counters.successRequests
      return {
        ...state.counters,
        passRate: total ? Math.round((passed / total) * 100) : 0,
        progress: state.progress,
        durationText: `${state.counters.executionTime}s`,
      }
    },
    currentItem() {
      return this.planItems[this.activePlanIndex] || this.planItems[0] || null
    },
    /** 执行计划中是否有 MQ 任务 */
    hasMqTasks() {
      const protocolStore = useProtocolStore()
      return this.planItems.some((item) => {
        if (!item.task?.bindings?.mqTest?.enabled) return false
        const iface = item.iface
        if (!iface) return false
        return protocolStore.protocols.some(p =>
          p.type === 'MQ' && p.moduleId === item.task?.moduleId
        )
      })
    },
    /** 有 MQ 探测的计划项列表 */
    mqProbeItems() {
      return this.planItems.filter(item => item.task?.bindings?.mqTest?.enabled)
    },
  },

  actions: {
    addToPlan(taskId) {
      if (!taskId || this.plan.some((item) => item.taskId === taskId)) return false
      this.plan.push({ id: uid('plan'), taskId })
      this.loadConfigFromTasks()
      return true
    },

    addModuleTasks(moduleId) {
      const taskStore = useTestTaskStore()
      let added = 0
      taskStore.tasks
        .filter((task) => task.moduleId === moduleId)
        .forEach((task) => { if (this.addToPlan(task.id)) added += 1 })
      return added
    },

    removeFromPlan(id) {
      const idx = this.plan.findIndex((item) => item.id === id)
      if (idx >= 0) this.plan.splice(idx, 1)
      if (!this.plan.length) this.reset()
    },

    reorder(from, to) {
      if (from === to || from < 0 || to < 0 || from >= this.plan.length || to >= this.plan.length) return
      const [item] = this.plan.splice(from, 1)
      this.plan.splice(to, 0, item)
    },

    loadConfigFromTasks() {
      const taskStore = useTestTaskStore()
      const firstTask = this.planItems[0]?.task || taskStore.tasks.find((task) => task.id === this.plan[0]?.taskId)
      if (!firstTask?.strategy) return
      this.config.trigger = firstTask.strategy.trigger || 'manual'
      this.config.scheduleAt = firstTask.strategy.scheduleAt || null
      this.config.periodicInterval = firstTask.strategy.periodicInterval || 60
      this.config.periodicUnit = firstTask.strategy.periodicUnit || 's'
      this.config.periodicCount = firstTask.strategy.periodicCount ?? null
      this.config.timeout = firstTask.strategy.timeout || 30
      this.config.retries = firstTask.strategy.retries || 0
    },

    setConfig(patch) {
      Object.assign(this.config, patch)
    },

    start() {
      if (!this.canStart) return false
      this._clearTimers()
      this.status = 'running'
      this.progress = 0
      this.counters = emptyCounters()
      this.logLines = []
      this.stepResults = []
      this.exceptions = []
      this.currentRunId = uid('run')
      this.startedAtMs = Date.now()
      this.startedAt = nowText()
      this.finishedAt = null
      this.activePlanIndex = 0
      this.activeTaskId = this.planItems[0]?.taskId || null
      this.targetTotal = Math.max(1, this.planItems.reduce((sum, item) => sum + item.estimatedRequests, 0))
      this._stepStats = Object.fromEntries(this.planItems.map((item) => [item.taskId, {
        total: 0, success: 0, failed: 0, error: 0, durations: [], traces: [],
      }]))
      this._requestCursor = 0
      this.savedRunToTasks = false
      this.mqProbeResults = {}
      this._markTasksRunning()
      this._simulateMqProbes()
      this._tick()
      runTimer = window.setInterval(() => this._tick(), this.tickInterval())
      return true
    },

    pause() {
      if (this.status !== 'running') return
      this.status = 'paused'
      this._clearTimers()
    },

    resume() {
      if (this.status !== 'paused') return
      this.status = 'running'
      this._tick()
      runTimer = window.setInterval(() => this._tick(), this.tickInterval())
    },

    stop() {
      if (!['running', 'paused'].includes(this.status)) return
      this.status = 'stopped'
      this._clearTimers()
      this.finalize('stopped')
    },

    reset() {
      this._clearTimers()
      this.status = 'idle'
      this.progress = 0
      this.counters = emptyCounters()
      this.logLines = []
      this.stepResults = []
      this.exceptions = []
      this.currentRunId = null
      this.activeTaskId = null
      this.activePlanIndex = 0
      this.targetTotal = 0
      this.startedAtMs = null
      this.startedAt = null
      this.finishedAt = null
      this.savedRunToTasks = false
      this._stepStats = {}
      this._requestCursor = 0
      this.mqProbeResults = {}
    },

    tickInterval() {
      if (this.config.mode === 'stress') return clamp(700 - this.config.stress.threadCount * 18, 180, 650)
      if (this.config.mode === 'endurance') return clamp(this.config.endurance.requestInterval, 220, 900)
      return 520
    },

    _tick() {
      if (this.status !== 'running') return
      if (this.counters.totalRequests >= this.targetTotal) {
        this.finalize('done')
        return
      }

      const item = this._itemForCursor()
      if (!item) {
        this.finalize('done')
        return
      }

      this.activeTaskId = item.taskId
      this.activePlanIndex = item.index
      const traceId = uid('tr')
      const reqHex = makeHex(rnd(10, 18))
      const respHex = makeHex(rnd(12, 22))
      const txLine = {
        traceId,
        time: timeText(),
        dir: 'tx',
        taskId: item.taskId,
        iface: item.iface?.name || '未命名接口',
        proto: item.iface?.path?.startsWith('/') ? 'HTTP' : 'TCP',
        hex: reqHex,
        status: 'pass',
        duration: 0,
        note: '发送请求帧',
        detail: { reqHex, respHex: '', spans: [], logs: [`${timeText()} 已发送请求帧`] },
      }
      this.logLines.push(txLine)

      const duration = rnd(18, 260) + (this.config.mode === 'stress' ? rnd(10, 90) : 0)
      rxTimer = window.setTimeout(() => {
        if (this.status !== 'running') return
        this._commitResponse(item, traceId, reqHex, respHex, duration)
      }, clamp(duration, 80, 420))
    },

    _commitResponse(item, traceId, reqHex, respHex, duration) {
      const exceptionStore = useExceptionStore()
      const judged = this._judgeResponse(item, duration)
      const status = judged.status
      const note = judged.note
      const issueType = judged.issueType
      const step = this._stepStats[item.taskId]
      const line = {
        traceId,
        time: timeText(),
        dir: 'rx',
        taskId: item.taskId,
        iface: item.iface?.name || '未命名接口',
        proto: item.iface?.path?.startsWith('/') ? 'HTTP' : 'TCP',
        hex: respHex,
        status,
        duration,
        note,
        detail: {
          reqHex,
          respHex,
          spans: [
            { op: 'build sampler', start: 0, dur: rnd(4, 12), status: 'pass' },
            { op: 'send request', start: 12, dur: rnd(10, 40), status: 'pass' },
            { op: 'assert response', start: 52, dur: rnd(8, 26), status },
          ],
          logs: [
            `${timeText()} 接收响应帧`,
            ...judged.logs,
          ],
        },
      }

      this.logLines.push(line)
      this.counters.totalRequests += 1
      this._requestCursor += 1
      step.total += 1
      step.durations.push(duration)
      step.traces.push(line)

      if (status === 'pass') {
        this.counters.successRequests += 1
        step.success += 1
      } else {
        const captured = exceptionStore.capture({
          type: issueType,
          level: status === 'error' ? '高' : (Math.random() > 0.5 ? '中' : '高'),
          systemId: item.system?.id || item.task?.systemId,
          moduleId: item.module?.id || item.task?.moduleId,
          interfaceId: item.iface?.id || item.task?.bindings?.interfaceId || '',
          iface: line.iface,
          source: 'execution',
          runId: this.currentRunId,
          taskId: item.taskId,
          detail: {
            reqHex,
            respHex,
            ruleMessage: `${item.task.name} / ${line.iface}：${judged.ruleMessage || note}，trace=${traceId}`,
            fieldPath: judged.fieldPath || '',
            recvMs: duration,
          },
          capturedTime: nowText(),
        })
        const ex = captured || {
          id: uid('ex'),
          taskId: item.taskId,
          moduleId: item.module?.id,
          type: issueType,
          iface: line.iface,
          level: status === 'error' ? '高' : '中',
          detail: `${item.task.name} / ${line.iface}：${judged.ruleMessage || note}，trace=${traceId}`,
          time: nowText(),
        }
        this.exceptions.unshift(ex)
        if (status === 'fail') {
          this.counters.failedRequests += 1
          step.failed += 1
        } else {
          this.counters.errorRequests += 1
          step.error += 1
        }
      }

      this._updateCounters()
      if (this.counters.totalRequests >= this.targetTotal) this.finalize('done')
    },

    _judgeResponse(item, duration) {
      const ruleStore = useRuleStore()
      const ruleSetId = item.task?.strategy?.ruleSetId
      const ruleSet = ruleStore.ruleSets.find((set) => set.id === ruleSetId)
      if (ruleSet) {
        const variant = Math.random() < 0.14 ? 'bad' : 'valid'
        const sample = makeSample(item.iface, variant)
        const results = evaluate(ruleSet, sample, item.iface, { recvMs: duration })
        const firstError = results.find((result) => result.level === 'error')
        const firstWarning = results.find((result) => result.level === 'warning')
        if (firstError) {
          return {
            status: firstError.ruleType === 'timeout' ? 'error' : 'fail',
            note: firstError.ruleType === 'timeout' ? '响应超时' : '规则判定失败',
            issueType: firstError.ruleLabel,
            fieldPath: firstError.path,
            ruleMessage: firstError.message,
            logs: results.slice(0, 5).map((result) => `${result.ruleLabel}: ${result.message}`),
          }
        }
        return {
          status: 'pass',
          note: firstWarning ? '通过有提醒' : '通过',
          issueType: firstWarning?.ruleLabel || '通过',
          logs: results.slice(0, 5).map((result) => `${result.ruleLabel}: ${result.message}`),
        }
      }

      const roll = Math.random()
      const status = roll < 0.85 ? 'pass' : (roll < 0.95 ? 'fail' : 'error')
      return {
        status,
        note: status === 'pass' ? '通过' : (status === 'fail' ? '规则判定失败' : '响应超时'),
        issueType: status === 'error' ? '响应超时' : FALLBACK_RULE_TYPES[Math.floor(Math.random() * FALLBACK_RULE_TYPES.length)],
        logs: [status === 'pass' ? '断言通过：类型、范围、格式均符合基础规则' : '未绑定规则集，使用静态兜底判定'],
      }
    },

    _itemForCursor() {
      let cursor = this._requestCursor
      for (const item of this.planItems) {
        if (cursor < item.estimatedRequests) return item
        cursor -= item.estimatedRequests
      }
      return this.planItems.at(-1)
    },

    _updateCounters() {
      const durations = Object.values(this._stepStats).flatMap((item) => item.durations || [])
      const elapsed = this.startedAtMs ? Math.max(1, Math.round((Date.now() - this.startedAtMs) / 1000)) : 0
      this.counters.executionTime = elapsed
      this.counters.avgResponseTime = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
      this.counters.rps = elapsed ? Number((this.counters.totalRequests / elapsed).toFixed(1)) : 0
      this.progress = clamp(Math.round((this.counters.totalRequests / this.targetTotal) * 100), 0, 100)
    },

    finalize(finalStatus = 'done') {
      this._clearTimers()
      this.status = finalStatus
      this.finishedAt = nowText()
      this.progress = this.counters.totalRequests >= this.targetTotal ? 100 : this.progress
      this.stepResults = this.planItems.map((item) => {
        const stat = this._stepStats[item.taskId] || { total: 0, success: 0, failed: 0, error: 0, durations: [], traces: [] }
        const avgMs = stat.durations.length ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length) : 0
        return {
          taskId: item.taskId,
          taskName: item.task.name,
          iface: item.iface?.name || '未命名接口',
          total: stat.total,
          success: stat.success,
          failed: stat.failed,
          error: stat.error,
          avgMs,
          result: stat.failed + stat.error > 0 ? '存在异常' : '通过',
          traces: stat.traces,
        }
      })
      this.saveRunRecord()
      this.history.unshift({
        id: this.currentRunId,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt,
        result: this.counters.failedRequests + this.counters.errorRequests > 0 ? '存在异常' : '通过',
        ...this.summary,
      })
    },

    saveRunRecord() {
      if (!this.currentRunId || this.savedRunToTasks) return false
      const taskStore = useTestTaskStore()
      const result = this.counters.failedRequests + this.counters.errorRequests > 0 ? '存在异常' : '通过'
      this.planItems.forEach((item) => {
        const task = taskStore.tasks.find((t) => t.id === item.taskId)
        if (!task) return
        const step = this.stepResults.find((s) => s.taskId === item.taskId)
        task.runs.unshift({
          id: `${this.currentRunId}-${item.taskId}`,
          startedAt: this.startedAt,
          finishedAt: this.finishedAt,
          result: step?.result || result,
          duration: `${this.counters.executionTime}s`,
          log: `本次执行 ${step?.total || 0} 次请求，异常 ${step?.error || 0} 次，失败 ${step?.failed || 0} 次`,
        })
        task.status = result === '通过' ? 'completed' : 'error'
        task.time = this.finishedAt
      })
      this.savedRunToTasks = true
      return true
    },

    clearLog() {
      this.logLines = []
    },

    _markTasksRunning() {
      const taskStore = useTestTaskStore()
      this.planItems.forEach((item) => {
        const task = taskStore.tasks.find((t) => t.id === item.taskId)
        if (task) task.status = 'running'
      })
    },

    /** 模拟 MQ 三维探测（执行开始时运行） */
    _simulateMqProbes() {
      const connStore = useConnectionStore()
      this.mqProbeResults = {}
      this.mqProbeItems.forEach((item) => {
        const mqCfg = item.task.bindings.mqTest
        const broker = connStore.brokerOf(item.task.moduleId)
        const brokerName = broker?.name || '未知 Broker'
        const brokerType = broker?.brokerType || 'RabbitMQ'
        const port = brokerType === 'Kafka' ? 9092 : (brokerType === 'RocketMQ' ? 9876 : 5672)
        const proto = brokerType === 'Kafka' ? 'AdminClient' : (brokerType === 'RocketMQ' ? 'NameServer' : 'AMQP')
        const ip = broker?.ip || '0.0.0.0'

        // 维度一：Broker 健康
        const l1Ms = rnd(1, 8)
        const l2Ms = rnd(20, 80)
        const l1Pass = Math.random() > 0.05
        const l2Pass = l1Pass && Math.random() > 0.04
        const l3Pass = l2Pass && Math.random() > 0.1
        const l3Warn = !l3Pass && Math.random() > 0.5
        const nodeCount = brokerType === 'Kafka' ? rnd(3, 5) : rnd(1, 3)
        const queueCount = rnd(6, 24)
        const consumerTotal = rnd(4, 16)

        // 维度二：生产端
        const prodPass = l1Pass && Math.random() > 0.08
        const prodMs = rnd(12, 65)
        const traceId = `trace-${rnd(100000, 999999).toString(16)}`

        // 维度三：消费端
        const onlineConsumers = l3Pass ? consumerTotal : (l3Warn ? consumerTotal - 1 : 0)
        const backlog = l3Pass ? rnd(0, 10) : (l3Warn ? rnd(100, 500) : rnd(1000, 5000))
        const consumerPass = onlineConsumers >= (mqCfg.consumer?.expectedConsumerCount || 1)

        // 生成探测日志
        const baseTime = new Date()
        const ts = (offsetSec) => {
          const t = new Date(baseTime.getTime() + offsetSec * 1000)
          return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
        }
        const probeLog = []
        probeLog.push({ time: ts(0), level: 'info', msg: `开始 MQ 三维探测: ${item.task.name}` })
        probeLog.push({ time: ts(1), level: l1Pass ? 'success' : 'error', msg: `Level 1: TCP ${ip}:${port} ${l1Pass ? `连接成功 (${l1Ms}ms)` : '连接超时'}` })
        if (l1Pass) {
          probeLog.push({ time: ts(2), level: l2Pass ? 'success' : 'error', msg: `Level 2: ${proto} 握手 ${l2Pass ? `认证通过 (${l2Ms}ms)` : '认证失败'}` })
        }
        if (l2Pass) {
          probeLog.push({ time: ts(3), level: l3Pass ? 'success' : (l3Warn ? 'warning' : 'error'), msg: `Level 3: ${l3Pass ? `${nodeCount} 节点在线，${queueCount} 队列正常` : (l3Warn ? `${nodeCount} 节点（1 节点磁盘 > 85%）` : '集群异常')}` })
        }
        probeLog.push({ time: ts(4), level: 'info', msg: `Broker Health: ${l3Pass ? 'HEALTHY' : (l3Warn ? 'WARNING' : 'ERROR')}` })
        if (mqCfg.producer?.enabled) {
          probeLog.push({ time: ts(5), level: 'info', msg: `Producer [${mqCfg.producer.mode}]: 发送测试消息 trace_id=${traceId}` })
          probeLog.push({ time: ts(6), level: prodPass ? 'success' : 'error', msg: prodPass ? `Producer: 消息已投递到 ${mqCfg.producer.listenQueue || mqCfg.producer.triggerUrl}，延迟 ${prodMs}ms` : 'Producer: 消息投递超时或失败' })
        }
        if (mqCfg.consumer?.enabled) {
          probeLog.push({ time: ts(7), level: consumerPass ? 'success' : 'warning', msg: `Consumer: ${onlineConsumers}/${mqCfg.consumer.expectedConsumerCount || 1} 在线，堆积 ${backlog} 条，偏移量${consumerPass ? '持续更新' : '停滞'}` })
        }
        probeLog.push({ time: ts(8), level: (l3Pass && prodPass && consumerPass) ? 'success' : 'warning', msg: `探测完成: ${(l3Pass && prodPass && consumerPass) ? '全部通过' : '存在异常项'}` })

        this.mqProbeResults[item.id] = {
          taskName: item.task.name,
          brokerName,
          brokerType,
          brokerHealth: {
            level1: { status: l1Pass ? 'pass' : 'fail', latency: l1Ms, detail: l1Pass ? `TCP ${ip}:${port} 连接成功 (${l1Ms}ms)` : `TCP 连接超时` },
            level2: { status: l2Pass ? 'pass' : (l1Pass ? 'fail' : 'pending'), latency: l2Ms, detail: l2Pass ? `${proto} 认证通过 (${l2Ms}ms)` : (l1Pass ? `${proto} 认证失败` : '跳过') },
            level3: { status: l3Pass ? 'pass' : (l3Warn ? 'warning' : 'fail'), detail: l3Pass ? `${nodeCount} 节点在线，${queueCount} 队列正常` : (l3Warn ? `${nodeCount} 节点（1 节点磁盘 > 85%）` : '集群异常'), metrics: { nodes: nodeCount, queues: queueCount, consumers: consumerTotal } },
            overall: l3Pass ? 'healthy' : (l3Warn ? 'warning' : 'error'),
            checkedAt: timeText(),
          },
          producerConnect: {
            status: prodPass ? 'pass' : 'fail',
            mode: mqCfg.producer?.mode || 'active',
            traceId,
            sentAt: timeText(),
            receivedAt: prodPass ? timeText() : null,
            latency: prodPass ? prodMs : null,
            messageValid: prodPass,
            detail: prodPass ? `消息已投递并确认，trace_id=${traceId}，延迟 ${prodMs}ms` : `消息投递超时或失败`,
          },
          consumerConnect: {
            status: consumerPass ? 'pass' : (backlog > (mqCfg.consumer?.backlogThreshold || 1000) ? 'warning' : 'fail'),
            onlineConsumers,
            expectedConsumers: mqCfg.consumer?.expectedConsumerCount || 1,
            backlog,
            offsetUpdated: consumerPass,
            detail: consumerPass ? `${onlineConsumers} 消费者在线，偏移量持续更新，堆积 ${backlog} 条` : `消费者不足或堆积异常`,
          },
          probeLog,
        }
      })
    },

    _clearTimers() {
      if (runTimer) window.clearInterval(runTimer)
      if (rxTimer) window.clearTimeout(rxTimer)
      runTimer = null
      rxTimer = null
    },
  },
})

function estimateRequests(baseRequests, config) {
  if (config.mode === 'stress') {
    return Math.min(260, Math.max(baseRequests, baseRequests * (config.stress.iterations || 1)))
  }
  if (config.mode === 'endurance') {
    const raw = Math.round(((config.endurance.durationMinutes || 1) * 60 * 1000) / (config.endurance.requestInterval || 500)) *
      (config.endurance.concurrentUsers || 1)
    return Math.min(240, Math.max(baseRequests, raw))
  }
  return baseRequests
}
