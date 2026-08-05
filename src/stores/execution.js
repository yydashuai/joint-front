import { defineStore } from 'pinia'
import { useTestTaskStore } from '@/stores/testTask'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useCustomIfaceStore } from '@/stores/customIface'
import { buildBatchScope, useRunBatchStore } from '@/stores/runBatch'
import { bus, EVENTS } from '@/utils/bus'

let runTimer = null

const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
const timeText = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const rnd = (min, max) => Math.round(min + Math.random() * (max - min))

const DEFAULT_REQUESTS = 8
const abnormalCountOf = (item = {}) => item.abnormal ?? ((item.failed || 0) + (item.error || 0))

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
  sendInterval: 500,            // 发送间隔（毫秒），编排计划与实时监控均可调整
})

const normalizeId = (value) => String(value ?? '')

const makeHex = (bytes = 12) => Array.from({ length: bytes }, () =>
  rnd(0, 255).toString(16).padStart(2, '0').toUpperCase()
).join(' ')

const taskInterface = (task, protocolStore) => {
  const boundId = task?.bindings?.interfaceId
  return protocolStore.testInterfaces.find((item) => normalizeId(item.id) === normalizeId(boundId)) ||
    protocolStore.testInterfaces.find((item) => item.moduleId === task?.moduleId) ||
    null
}

const taskDatasets = (task, dataStore) => {
  const ids = task?.bindings?.datasetIds || []
  return dataStore.datasets.filter((item) => ids.some((id) => normalizeId(id) === normalizeId(item.id)))
}

/** 接口名下报文（排他归属 1:N） */
const ifaceMessages = (iface, protocolStore) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)

/** 文本内容转 hex 字节串（UTF-16 code unit 逐字符，适用于文本/ASCII/中文 BMP） */
const textToHex = (text) => {
  const str = String(text ?? '')
  if (!str) return ''
  const bytes = []
  for (let i = 0; i < str.length; i += 1) {
    bytes.push(str.charCodeAt(i) & 0xFF)
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

/**
 * 按字段约束补齐一条待发送数据的完整字段值。
 * 数据集行已有的值优先保留；缺失的字段按约束生成默认发送值
 * （固定值→固定值，枚举→首个枚举项，范围→范围内随机，位→0/1，其余→空串），
 * 保证暂停后点击任一条数据时，弹窗展示的是「即将发送的完整数据」而非空表单。
 */
const fillFieldValues = (fields = [], baseValues) => {
  const values = baseValues ? JSON.parse(JSON.stringify(baseValues)) : {}
  for (const f of fields) {
    const existing = values[f.name]
    if (existing !== undefined && existing !== null && existing !== '') continue
    const c = f.constraint
    if (c?.mode === 'fixed') {
      values[f.name] = c.value
    } else if (c?.mode === 'enum' && c.entries?.length) {
      const entry = c.entries[0]
      values[f.name] = entry?.value ?? entry
    } else if (c?.mode === 'range') {
      const min = Number.isFinite(c.min) ? c.min : 0
      const max = Number.isFinite(c.max) ? c.max : min
      values[f.name] = (f.kind === 'bit' && min === 0 && max === 1) ? rnd(0, 1) : rnd(min, max)
    } else {
      values[f.name] = ''
    }
  }
  return values
}

/**
 * 根据字段定义自动判定一条数据是正常还是异常（无需人工标记）。
 * 逐字段对照约束：固定值不符 / 不在枚举内 / 超出数值范围 / 约束字段值缺失 → 记为异常项。
 * 返回 { abnormal, issues:[{name,message}] }。
 */
export const judgeValues = (fields = [], values = {}) => {
  const issues = []
  for (const f of fields) {
    const c = f.constraint
    if (!c || !c.mode || c.mode === 'none') continue
    const v = values[f.name]
    if (v === undefined || v === null || v === '') {
      issues.push({ name: f.name, message: '值缺失' })
      continue
    }
    if (c.mode === 'fixed') {
      if (String(v) !== String(c.value)) issues.push({ name: f.name, message: `应为固定值 ${c.value}，当前 ${v}` })
    } else if (c.mode === 'enum') {
      const ok = (c.entries || []).some((e) => String(e?.value ?? e) === String(v))
      if (!ok) issues.push({ name: f.name, message: `不在枚举范围内（${(c.entries || []).map((e) => e?.label ?? e?.value ?? e).join('/')}）` })
    } else if (c.mode === 'range') {
      const num = Number(v)
      if (!Number.isFinite(num)) {
        issues.push({ name: f.name, message: `应为 ${c.min}~${c.max} 内的数值，当前 ${v}` })
      } else if ((Number.isFinite(c.min) && num < c.min) || (Number.isFinite(c.max) && num > c.max)) {
        issues.push({ name: f.name, message: `超出范围 ${c.min}~${c.max}，当前 ${num}` })
      }
    }
  }
  return { abnormal: issues.length > 0, issues }
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
    sourceScheme: null,
    _stepStats: {},
    _requestCursor: 0,
    // 发送队列：本轮全部数据（待发送/已发送），实时监控窗口从上往下逐条发送
    sendQueue: [],
  }),

  getters: {
    planItems(state) {
      const taskStore = useTestTaskStore()
      const protocolStore = useProtocolStore()
      const dataStore = useTestDataStore()
      const connStore = useConnectionStore()
      const systemStore = useSystemStore()
      const customStore = useCustomIfaceStore()

      return state.plan.map((planItem, index) => {
        // 自定义接口条目：无 task/数据集，报文体透传，系统不解析
        if (planItem.customId) {
          const custom = customStore.byId(planItem.customId)
          if (!custom) return null
          return {
            ...planItem,
            index,
            task: null,
            module: null,
            system: null,
            iface: custom,
            datasets: [],
            rowCount: 0,
            baseRequests: 1,
            estimatedRequests: 1,
            isCustom: true,
            interval: planItem.interval ?? custom.sendInterval ?? 500,
          }
        }
        const task = taskStore.tasks.find((item) => item.id === planItem.taskId)
        const module = task ? connStore.nodes.find((item) => item.id === task.moduleId) : null
        const system = task ? systemStore.systems.find((item) => item.id === task.systemId) : null
        const iface = taskInterface(task, protocolStore)
        const datasets = taskDatasets(task, dataStore)
        const rowCount = datasets.reduce((sum, item) => sum + (item.rows?.length || item.rowCount || 0), 0)
        const baseRequests = rowCount || DEFAULT_REQUESTS
        const estimatedRequests = estimateRequests(baseRequests, state.config)

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
          interval: planItem.interval ?? iface?.sendInterval ?? 500,
        }
      }).filter((item) => !!item && (!!item.task || item.isCustom))
    },

    isRunning: (state) => state.status === 'running',
    summary(state) {
      const total = state.counters.totalRequests
      const passed = state.counters.successRequests
      const abnormalTypes = Object.values(state._stepStats || {}).reduce((acc, item) => {
        Object.entries(item.abnormalTypes || {}).forEach(([type, count]) => {
          acc[type] = (acc[type] || 0) + (count || 0)
        })
        return acc
      }, {})
      return {
        ...state.counters,
        abnormalRequests: state.counters.failedRequests + state.counters.errorRequests,
        abnormalTypes,
        passRate: total ? Math.round((passed / total) * 100) : 0,
        progress: state.progress,
        durationText: `${state.counters.executionTime}s`,
      }
    },
    currentItem() {
      return this.planItems[this.activePlanIndex] || this.planItems[0] || null
    },

    /** 队列中已发送 / 待发送条数 */
    sentCount: (state) => state.sendQueue.filter((e) => e.status === 'sent').length,
    pendingCount: (state) => state.sendQueue.filter((e) => e.status === 'pending').length,
  },

  actions: {
    addToPlan(taskId) {
      if (!taskId || this.plan.some((item) => item.taskId === taskId)) return false
      // 防御：只允许真实存在的任务进入计划（避免把方案 id 等误当任务 id 静默塞入）
      const taskStore = useTestTaskStore()
      if (!taskStore.tasks.some((task) => task.id === taskId)) return false
      this.plan.push({ id: uid('plan'), taskId })
      this.sourceScheme = null
      this.loadConfigFromTasks()
      this._syncActiveBatchScope()
      return true
    },

    /** 自定义接口直连加入发送计划（无 task，报文体透传） */
    addCustomToPlan(customId) {
      if (!customId) return false
      if (this.plan.some((item) => item.customId === customId)) return false
      const customStore = useCustomIfaceStore()
      if (!customStore.byId(customId)) return false
      this.plan.push({ id: uid('plan'), customId, interval: customStore.byId(customId)?.sendInterval || 500 })
      this.sourceScheme = null
      this._syncActiveBatchScope()
      return true
    },

    /** 设置单个计划项的发送间隔（毫秒） */
    setPlanInterval(planId, interval) {
      const item = this.plan.find((p) => p.id === planId)
      if (!item) return
      item.interval = Math.max(200, Number(interval) || 500)
    },

    /** 批量同步时间间隔到所有计划项（表头配置） */
    applyIntervalToAll(interval) {
      const val = Math.max(200, Number(interval) || 500)
      this.plan.forEach((item) => { item.interval = val })
      this.config.sendInterval = val
    },

    setPlanScheme(scheme) {
      if (!scheme) {
        this.sourceScheme = null
        return
      }
      const plannedIds = new Set(this.planItems.map((item) => String(item.iface?.id || '')))
      const schemeIds = new Set((scheme.interfaceIds || []).map(String))
      const exact = plannedIds.size === schemeIds.size && [...plannedIds].every((id) => schemeIds.has(id))
      this.sourceScheme = exact ? { id: scheme.id, name: scheme.name } : null
      this._syncActiveBatchScope()
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
      if (['running', 'paused'].includes(this.status)) return false
      const idx = this.plan.findIndex((item) => item.id === id)
      if (idx >= 0) this.plan.splice(idx, 1)
      this.sourceScheme = null
      this._syncActiveBatchScope()
      if (!this.plan.length) this.reset()
      return idx >= 0
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
      const iface = this.planItems[0]?.iface
      if (iface?.sendInterval) this.config.sendInterval = iface.sendInterval
    },

    setConfig(patch) {
      Object.assign(this.config, patch)
    },

    /** 构建发送队列：将计划内全部数据集行展开为待发送条目（从上往下逐条发送） */
    _buildSendQueue() {
      const protocolStore = useProtocolStore()
      const queue = []
      for (const item of this.planItems) {
        // 自定义接口：报文体透传（可为加密数据，系统不解析）
        if (item.isCustom) {
          const iface = item.iface
          const count = Math.max(1, item.estimatedRequests || 1)
          for (let i = 0; i < count; i += 1) {
            queue.push({
              id: uid('sq'),
              taskId: null,
              customId: iface.id,
              planIndex: item.index,
              iface: iface.name || '自定义接口',
              proto: iface.transportType || 'OSE',
              label: `自定义报文 ${i + 1}`,
              datasetName: '',
              datasetId: null,
              fields: [],
              values: { 报文体: iface.bodyHex || '' },
              variant: 'normal',
              issues: [],
              status: 'pending',            // pending | sent
              time: '',
              hex: iface.bodyHex || '',
              interval: item.interval ?? 500,
            })
          }
          continue
        }
        // 文件直发：接口名下存在带 fileId 的报文 → 文件内容原样直发（不修改不校验）
        const fileMessage = ifaceMessages(item.iface, protocolStore).find((m) => m.fileId)
        if (fileMessage) {
          const file = useTestDataStore().files.find((f) => String(f.id) === String(fileMessage.fileId))
          const content = file?.content || ''
          const fileHex = textToHex(content)
          queue.push({
            id: uid('sq'),
            taskId: item.taskId,
            planIndex: item.index,
            iface: item.iface?.name || '未命名接口',
            proto: item.iface?.path?.startsWith('/') ? 'HTTP' : 'TCP',
            label: `文件直发·${file?.name || '文件'}`,
            datasetName: '',
            datasetId: null,
            fields: [],
            values: { 文件内容: content },
            variant: 'normal',
            issues: [],
            status: 'pending',            // pending | sent
            time: '',
            hex: fileHex,
            fileHex,
            isFileDirect: true,
            interval: item.interval ?? 500,
          })
          continue
        }
        const fields = item.iface
          ? collectTestInterfaceFields(
            item.iface,
            useTestDataStore().datasets,
            protocolStore.interfaces,
            protocolStore.protocols,
            'send',
          )
          : []
        const rows = item.datasets.flatMap((ds) => (ds.rows || []).map((row) => ({ row, dsName: ds.name, dsId: ds.id })))
        const count = Math.max(1, item.estimatedRequests)
        for (let i = 0; i < count; i += 1) {
          const src = rows.length ? rows[i % rows.length] : null
          const values = fillFieldValues(fields, src?.row?.values)
          const judge = judgeValues(fields, values)
          queue.push({
            id: uid('sq'),
            taskId: item.taskId,
            planIndex: item.index,
            iface: item.iface?.name || '未命名接口',
            proto: item.iface?.path?.startsWith('/') ? 'HTTP' : 'TCP',
            label: src?.row?.label || `样例数据 ${i + 1}`,
            datasetName: src?.dsName || '',
            datasetId: src?.dsId || null,
            fields,
            values,
            variant: judge.abnormal ? 'abnormal' : 'normal', // 由字段定义自动判定
            issues: judge.issues,
            status: 'pending',            // pending | sent
            time: '',
            hex: '',
            interval: item.interval ?? 500,
          })
        }
      }
      return queue
    },

    /** 监控阶段新增接口时，把对应任务的数据追加到当前发送队列。 */
    appendTaskToActiveQueue(taskId) {
      if (!['running', 'paused'].includes(this.status)) return 0
      const appended = this._buildSendQueue().filter((entry) => entry.taskId === taskId)
      if (!appended.length) return 0
      this.sendQueue.push(...appended)
      this.targetTotal += appended.length
      if (!this._stepStats[taskId]) {
        this._stepStats[taskId] = {
          total: 0,
          success: 0,
          failed: 0,
          error: 0,
          abnormalTypes: {},
          durations: [],
          traces: [],
        }
      }
      this._updateCounters()
      return appended.length
    },

    /**
     * 保存编辑结果（统一入口）：
     * - 待发送数据：值有变化则就地更新，正常/异常由字段定义自动重判；
     * - 已发送数据：值有变化则复制一条追加到队尾等待发送（原记录不动），未修改则不产生任何变化。
     * 返回 'updated' | 'appended' | 'unchanged'。
     */
    saveQueueEdit(entryId, newValues) {
      const entry = this.sendQueue.find((e) => e.id === entryId)
      if (!entry) return 'unchanged'
      const changed = JSON.stringify(entry.values) !== JSON.stringify(newValues)
      if (!changed) return 'unchanged'

      if (entry.status === 'pending') {
        entry.values = JSON.parse(JSON.stringify(newValues))
        const judge = judgeValues(entry.fields, entry.values)
        entry.variant = judge.abnormal ? 'abnormal' : 'normal'
        entry.issues = judge.issues
        return 'updated'
      }

      // 已发送：复制一条到队尾待发送
      const values = JSON.parse(JSON.stringify(newValues))
      const judge = judgeValues(entry.fields, values)
      this.sendQueue.push({
        ...JSON.parse(JSON.stringify({ ...entry, fields: undefined })),
        fields: entry.fields,
        id: uid('sq'),
        label: `${entry.label}（重发修改）`,
        values,
        variant: judge.abnormal ? 'abnormal' : 'normal',
        issues: judge.issues,
        status: 'pending',
        time: '',
        hex: '',
      })
      this.targetTotal = Math.max(1, this.targetTotal + 1)
      this._updateCounters()
      return 'appended'
    },

    start() {
      if (!this.planItems.length) return false
      this._clearTimers()
      this.status = 'running'
      this.progress = 0
      this.counters = emptyCounters()
      this.logLines = []
      this.stepResults = []
      this.exceptions = []
      this.currentRunId = uid('send-batch')
      this.startedAtMs = Date.now()
      this.startedAt = nowText()
      this.finishedAt = null
      this.activePlanIndex = 0
      this.activeTaskId = this.planItems[0]?.taskId || null
      this.sendQueue = this._buildSendQueue()
      this.targetTotal = Math.max(1, this.sendQueue.length)
      this._stepStats = Object.fromEntries(this.planItems.map((item) => [item.taskId, {
        total: 0, success: 0, failed: 0, error: 0, abnormalTypes: {}, durations: [], traces: [],
      }]))
      this._requestCursor = 0
      this.savedRunToTasks = false
      const batchScope = buildBatchScope({
        scheme: this.sourceScheme,
        interfaces: this.planItems.map((item) => ({ id: item.iface?.id, name: item.iface?.name })),
      })
      useRunBatchStore().startBatch({
        batchId: this.currentRunId,
        batchType: 'send',
        systemId: this.planItems[0]?.task?.systemId || '',
        scope: batchScope,
        startedAt: this.startedAt,
        config: this.config,
        tasks: this.planItems.map((item) => ({
          taskId: item.taskId,
          taskName: item.task?.name || '',
          systemId: item.task?.systemId || '',
          moduleId: item.module?.id || item.task?.moduleId || '',
          moduleName: item.module?.name || '',
          interfaceId: item.iface?.id || item.task?.bindings?.interfaceId || '',
          iface: item.iface?.name || '',
          datasetIds: item.datasets.map((dataset) => dataset.id),
          datasetNames: item.datasets.map((dataset) => dataset.name),
        })),
      })
      this._markTasksRunning()
      this._tick()
      if (this.status === 'running') this._scheduleNext()
      bus.emit(EVENTS.TASK_RUN_STARTED, { runId: this.currentRunId, taskIds: this.plan.map((p) => p.taskId) })
      return true
    },

    pause() {
      if (this.status !== 'running') return
      this.status = 'paused'
      this._clearTimers()
      useRunBatchStore().updateBatchStatus(this.currentRunId, 'paused')
    },

    resume() {
      if (this.status !== 'paused') return
      this.status = 'running'
      useRunBatchStore().updateBatchStatus(this.currentRunId, 'running')
      this._tick()
      if (this.status === 'running') this._scheduleNext()
    },

    stop() {
      if (!['running', 'paused'].includes(this.status)) return
      this.status = 'stopped'
      this._clearTimers()
      this.finalize('stopped', 'terminated')
    },

    reset() {
      if (['running', 'paused'].includes(this.status)) return false
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
      this.sendQueue = []
      return true
    },

    loadBatchSnapshot(batch) {
      if (!batch?.runId) return false
      this._clearTimers()
      const taskStore = useTestTaskStore()
      this.plan = (batch.taskIds || batch.tasks?.map((item) => item.taskId) || [])
        .filter((taskId) => taskStore.tasks.some((task) => task.id === taskId))
        .map((taskId) => ({ id: uid('plan'), taskId }))
      this.status = batch.state === 'running' ? 'paused' : 'done'
      this.progress = 100
      this.counters = {
        ...emptyCounters(),
        ...(batch.summary || {}),
        rps: batch.summary?.executionTime
          ? Number(((batch.summary.totalRequests || 0) / batch.summary.executionTime).toFixed(1))
          : 0,
      }
      this.logLines = []
      this.stepResults = batch.stepResults || []
      this.exceptions = batch.exceptions || []
      this.currentRunId = batch.runId
      this.startedAt = batch.startedAt || batch.time || null
      this.finishedAt = batch.finishedAt || null
      this.startedAtMs = null
      this.activeTaskId = this.stepResults[0]?.taskId || null
      this.activePlanIndex = 0
      this.targetTotal = this.counters.totalRequests || 0
      this.savedRunToTasks = true
      this._stepStats = {}
      this._requestCursor = 0
      this.sendQueue = []
      return true
    },

    tickInterval() {
      if (this.config.mode === 'stress') return clamp(700 - this.config.stress.threadCount * 18, 180, 650)
      if (this.config.mode === 'endurance') return clamp(this.config.endurance.requestInterval, 220, 900)
      // 每接口独立时间间隔：取下一个待发送条目所属接口的 interval
      const next = this.sendQueue.find((e) => e.status === 'pending')
      if (next?.interval) return clamp(next.interval, 200, 2000)
      return clamp(this.config.sendInterval || 500, 200, 2000)
    },

    /** 链式调度：按下一条待发送数据的 interval 动态设定下次发送时间 */
    _scheduleNext() {
      this._clearTimers()
      if (this.status !== 'running') return
      if (!this.sendQueue.some((e) => e.status === 'pending')) return
      runTimer = window.setTimeout(() => {
        this._tick()
        if (this.status === 'running' && this.sendQueue.some((e) => e.status === 'pending')) this._scheduleNext()
      }, this.tickInterval())
    },

    _tick() {
      if (this.status !== 'running') return
      const entry = this.sendQueue.find((e) => e.status === 'pending')
      if (!entry) {
        this.finalize('done')
        return
      }

      this.activeTaskId = entry.taskId
      this.activePlanIndex = entry.planIndex
      // 文件直发/自定义直发：保留原始报文内容 hex；其余按随机 hex 模拟
      const reqHex = entry.fileHex || makeHex(rnd(10, 18))
      const isAbnormal = entry.variant === 'abnormal'

      entry.status = 'sent'
      entry.time = timeText()
      entry.hex = reqHex

      this.counters.totalRequests += 1
      this._requestCursor += 1
      const step = this._stepStats[entry.taskId]
      if (step) {
        step.total += 1
        step.traces.push({
          traceId: entry.id,
          time: entry.time,
          dir: 'tx',
          taskId: entry.taskId,
          iface: entry.iface,
          proto: entry.proto,
          hex: reqHex,
          status: isAbnormal ? 'fail' : 'pass',
          duration: 0,
          note: isAbnormal ? '发送异常数据' : '已发送',
        })
      }
      if (isAbnormal) {
        // 发送侧只统计「发送了异常构造数据」，不写入异常台账 ——
        // 异常样本库与异常数据管理页共享，异常仅由接收校验（reception store）产生。
        if (step) {
          step.failed += 1
          step.abnormalTypes['异常数据'] = (step.abnormalTypes['异常数据'] || 0) + 1
        }
        this.counters.failedRequests += 1
      } else {
        if (step) step.success += 1
        this.counters.successRequests += 1
      }
      this._updateCounters()
      if (!this.sendQueue.some((e) => e.status === 'pending')) this.finalize('done')
    },

    _updateCounters() {
      const durations = Object.values(this._stepStats).flatMap((item) => item.durations || [])
      const elapsed = this.startedAtMs ? Math.max(1, Math.round((Date.now() - this.startedAtMs) / 1000)) : 0
      this.counters.executionTime = elapsed
      this.counters.avgResponseTime = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
      this.counters.rps = elapsed ? Number((this.counters.totalRequests / elapsed).toFixed(1)) : 0
      this.progress = clamp(Math.round((this.counters.totalRequests / this.targetTotal) * 100), 0, 100)
    },

    finalize(finalStatus = 'done', finishReason = 'natural') {
      this._clearTimers()
      this.status = finalStatus
      this.finishedAt = nowText()
      this.progress = this.counters.totalRequests >= this.targetTotal ? 100 : this.progress
      this.stepResults = this.planItems.map((item) => {
        const stat = this._stepStats[item.taskId] || { total: 0, success: 0, failed: 0, error: 0, abnormalTypes: {}, durations: [], traces: [] }
        const avgMs = stat.durations.length ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length) : 0
        const abnormal = abnormalCountOf(stat)
        return {
          taskId: item.taskId,
          taskName: item.task.name,
          systemId: item.task?.systemId || '',
          moduleId: item.module?.id || item.task?.moduleId || '',
          moduleName: item.module?.name || '',
          interfaceId: item.iface?.id || item.task?.bindings?.interfaceId || '',
          iface: item.iface?.name || '未命名接口',
          proto: item.iface?.path?.startsWith('/') ? 'HTTP' : 'TCP',
          total: stat.total,
          success: stat.success,
          abnormal,
          abnormalTypes: stat.abnormalTypes || {},
          failed: abnormal,
          error: 0,
          avgMs,
          result: abnormal > 0 ? '含异常构造数据' : '已发送',
          traces: stat.traces,
        }
      })
      useRunBatchStore().finishBatch(this.currentRunId, {
        state: finalStatus === 'done' ? 'done' : 'stopped',
        finishReason,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt,
        durationText: `${this.counters.executionTime}s`,
        summary: {
          ...this.summary,
          plannedCount: this.targetTotal,
          sentCount: this.sentCount,
          unsentCount: this.pendingCount,
          interfaceCount: new Set(this.planItems.map((item) => item.iface?.id).filter(Boolean)).size,
          datasetCount: new Set(this.planItems.flatMap((item) => item.datasets.map((dataset) => dataset.id))).size,
          durationSeconds: this.counters.executionTime,
        },
        records: this.sendQueue.map((entry) => ({
          id: entry.id,
          taskId: entry.taskId,
          interfaceName: entry.iface,
          datasetName: entry.datasetName,
          label: entry.label,
          status: entry.status,
          time: entry.time,
        })),
        tasks: this.planItems.map((item) => ({
          taskId: item.taskId,
          taskName: item.task?.name || '',
          systemId: item.task?.systemId || '',
          moduleId: item.module?.id || item.task?.moduleId || '',
          moduleName: item.module?.name || '',
          interfaceId: item.iface?.id || item.task?.bindings?.interfaceId || '',
          iface: item.iface?.name || '',
          datasetIds: item.datasets.map((dataset) => dataset.id),
          datasetNames: item.datasets.map((dataset) => dataset.name),
        })),
        stepResults: this.stepResults,
        exceptions: this.exceptions,
      })
      this.saveRunRecord()
      this.history.unshift({
        id: this.currentRunId,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt,
        result: '已完成',
        ...this.summary,
      })
      bus.emit(EVENTS.TASK_RUN_FINISHED, {
        runId: this.currentRunId,
        result: '已完成',
        exceptions: this.exceptions.length,
        taskIds: this.plan.map((p) => p.taskId),
      })
    },

    saveRunRecord() {
      if (!this.currentRunId || this.savedRunToTasks) return false
      const taskStore = useTestTaskStore()
      const result = '已完成'
      this.planItems.forEach((item) => {
        const task = taskStore.tasks.find((t) => t.id === item.taskId)
        if (!task) return
        const step = this.stepResults.find((s) => s.taskId === item.taskId)
        const abnormal = abnormalCountOf(step)
        task.runs.unshift({
          id: `${this.currentRunId}-${item.taskId}`,
          startedAt: this.startedAt,
          finishedAt: this.finishedAt,
          result,
          duration: `${this.counters.executionTime}s`,
          log: `本次执行发送 ${step?.total || 0} 条，其中常规数据 ${step?.success || 0} 条、异常构造数据 ${abnormal} 条`,
        })
        task.status = 'completed'
        task.time = this.finishedAt
      })
      this.savedRunToTasks = true
      return true
    },

    clearLog() {
      this.logLines = []
    },

    _syncActiveBatchScope() {
      if (!this.currentRunId || !['running', 'paused'].includes(this.status)) return
      useRunBatchStore().updateBatchScope(this.currentRunId, buildBatchScope({
        scheme: this.sourceScheme,
        interfaces: this.planItems.map((item) => ({ id: item.iface?.id, name: item.iface?.name })),
      }))
    },

    _markTasksRunning() {
      const taskStore = useTestTaskStore()
      this.planItems.forEach((item) => {
        const task = taskStore.tasks.find((t) => t.id === item.taskId)
        if (task) task.status = 'running'
      })
    },

    _clearTimers() {
      if (runTimer) {
        window.clearTimeout(runTimer)
        window.clearInterval(runTimer)
      }
      runTimer = null
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
