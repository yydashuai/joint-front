import { defineStore } from 'pinia'
import { tasks as seedTasks } from '@/mock/seed-data'

let _taskSeq = 100

/** 任务状态枚举 */
export const TASK_STATUS = [
  { value: 'draft',    label: '待配置', tag: 'info' },
  { value: 'ready',    label: '待执行', tag: 'warning' },
  { value: 'running',  label: '执行中', tag: '' },
  { value: 'completed',label: '已完成', tag: 'success' },
  { value: 'error',    label: '异常',   tag: 'danger' },
]

/** 优先级枚举 */
export const PRIORITY_OPTIONS = [
  { value: 'high',   label: '高', tag: 'danger' },
  { value: 'medium', label: '中', tag: 'warning' },
  { value: 'low',    label: '低', tag: 'info' },
]

/** 种子数据中中文状态 → 内部状态值映射 */
const STATUS_MAP = {
  '执行中': 'running',
  '已完成': 'completed',
  '异常':   'error',
  '待确认': 'ready',
}

/** 默认策略 */
const defaultStrategy = () => ({
  trigger: 'manual',      // manual | scheduled | periodic
  scheduleAt: null,       // ISO 字符串
  periodicInterval: 60,   // 周期间隔数值
  periodicUnit: 's',      // 周期间隔单位：s/m/h/d
  periodicCount: null,    // 周期触发次数：null=永久，正整数=自定义
  execution: 'serial',    // serial | parallel
  timeout: 30,            // 秒
  retries: 0,
  mqExecution: {
    mode: 'standard',           // standard | publish-verify | consume-verify | throughput
    listenTopic: '',            // publish-verify 时监听的 topic
    matchField: 'correlationId',// 关联发布/消费消息的字段
    waitTimeout: 5000,          // 等待响应消息超时(ms)
    throughputDuration: 60,     // 吞吐量测试持续时长(s)
    throughputRate: 100,        // 目标发送速率(msg/s)
  },
})

/** 默认 MQ 三维测试配置 */
export const defaultMqTest = () => ({
  enabled: false,
  dimensions: ['broker_health', 'producer_connect', 'consumer_connect'],
  brokerHealth: {
    enabled: true,
    timeout: 3000,
  },
  producer: {
    enabled: true,
    mode: 'active',
    triggerUrl: '',
    traceIdField: 'test_trace_id',
    listenQueue: '',
    waitTimeout: 10000,
    passiveWindow: 300,
    messageTag: 'connectivity_check',
  },
  consumer: {
    enabled: true,
    expectedConsumerCount: 1,
    backlogThreshold: 1000,
    checkInterval: 60,
  },
  schedule: {
    interval: 5,
    unit: 'm',
  },
  alertThreshold: {
    consecutiveFailures: 2,
  },
})

/** 默认绑定 */
const defaultBindings = () => ({
  interfaceId: null,
  datasetIds: [],
  fileIds: [],
  ruleSetId: null,
  mqTest: defaultMqTest(),
})

/** 扩展种子任务：映射状态 + 补充 bindings/strategy/runs */
const expandTask = (raw) => ({
  ...raw,
  status: STATUS_MAP[raw.status] || 'draft',
  priority: 'medium',
  bindings: { ...defaultBindings(), ruleSetId: raw.ruleSetId || null },
  createdAt: raw.time || new Date().toISOString().slice(0, 10),
  updatedAt: raw.time || '',
  runs: [],
  strategy: defaultStrategy(),
})

export const useTestTaskStore = defineStore('testTask', {
  state: () => ({
    tasks: JSON.parse(JSON.stringify(seedTasks)).map(expandTask),
    selectedTaskId: null,
  }),

  getters: {
    selectedTask: (s) => s.tasks.find(t => t.id === s.selectedTaskId) || null,

    tasksOfModule: (s) => (moduleId) =>
      s.tasks.filter(t => t.moduleId === moduleId),

    tasksOfSystem: (s) => (systemId) =>
      s.tasks.filter(t => t.systemId === systemId),

    /** 按关键字搜索 */
    searchTasks: (s) => (keyword) => {
      if (!keyword) return s.tasks
      const kw = keyword.toLowerCase()
      return s.tasks.filter(t =>
        t.name.toLowerCase().includes(kw) ||
        (t.remark && t.remark.toLowerCase().includes(kw))
      )
    },

    /** 检查任务是否配置完整（可提交执行） */
    isReady: (s) => (taskId) => {
      const t = s.tasks.find(t => t.id === taskId)
      if (!t) return false
      return t.bindings.interfaceId != null
    },
  },

  actions: {
    select(id) {
      this.selectedTaskId = id
    },

    /* ========== 任务 CRUD ========== */
    addTask(data) {
      const task = {
        id: `t${++_taskSeq}`,
        name: data.name || '新建测试任务',
        systemId: data.systemId,
        moduleId: data.moduleId,
        status: 'draft',
        priority: data.priority || 'medium',
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        remark: data.desc || '',
        bindings: defaultBindings(),
        strategy: defaultStrategy(),
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: '',
        runs: [],
      }
      this.tasks.unshift(task)
      this.selectedTaskId = task.id
      return task
    },

    removeTask(id) {
      const idx = this.tasks.findIndex(t => t.id === id)
      if (idx < 0) return
      this.tasks.splice(idx, 1)
      if (this.selectedTaskId === id) {
        this.selectedTaskId = null
      }
    },

    updateTask(id, patch) {
      const t = this.tasks.find(t => t.id === id)
      if (t) {
        Object.assign(t, patch)
        t.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      }
    },

    /** 复制任务（不复制 runs） */
    duplicateTask(id) {
      const src = this.tasks.find(t => t.id === id)
      if (!src) return null
      const dup = {
        ...JSON.parse(JSON.stringify(src)),
        id: `t${++_taskSeq}`,
        name: `${src.name} (副本)`,
        status: 'draft',
        runs: [],
        createdAt: new Date().toISOString().slice(0, 10),
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      const idx = this.tasks.findIndex(t => t.id === id)
      this.tasks.splice(idx + 1, 0, dup)
      this.selectedTaskId = dup.id
      return dup
    },

    /* ========== 资源绑定 ========== */
    updateBindings(taskId, patch) {
      const t = this.tasks.find(t => t.id === taskId)
      if (t) {
        Object.assign(t.bindings, patch)
        t.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
        // 绑定接口后若状态为 draft，自动切到 ready
        if (t.status === 'draft' && t.bindings.interfaceId != null) {
          t.status = 'ready'
        }
      }
    },

    /* ========== 策略配置 ========== */
    updateStrategy(taskId, patch) {
      const t = this.tasks.find(t => t.id === taskId)
      if (t) {
        Object.assign(t.strategy, patch)
        t.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      }
    },

    /* ========== 执行 ========== */
    submitForExecution(taskId) {
      const t = this.tasks.find(t => t.id === taskId)
      if (!t) return false
      if (t.bindings.interfaceId == null) {
        return false
      }
      t.status = 'running'
      t.time = new Date().toISOString().slice(0, 16).replace('T', ' ')
      // 添加执行记录
      t.runs.unshift({
        id: `r${Date.now()}`,
        startedAt: t.time,
        finishedAt: '',
        result: '',
        duration: '',
        log: '',
      })
      return true
    },
  },
})
