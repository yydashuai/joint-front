import { defineStore } from 'pinia'
import { alerts } from '@/mock/seed-data'

const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`

export const EXC_LEVELS = [
  { value: '高', label: '高', tag: 'danger' },
  { value: '中', label: '中', tag: 'warning' },
  { value: '低', label: '低', tag: 'info' },
]

export const EXC_STATES = [
  { value: '待处理', label: '待处理', tag: 'danger' },
  { value: '已处理', label: '已处理', tag: 'success' },
]

export const EXC_SOURCES = [
  { value: 'execution', label: '执行编排' },
  { value: 'rule', label: '规则判定' },
  { value: 'link', label: '链路连接' },
  { value: 'system', label: '系统事件' },
]

const defaultTypes = [
  { id: 'type', name: '类型校验', source: 'rule', defaultLevel: '高', suggestion: '核对协议字段类型与响应解析器配置。' },
  { id: 'range', name: '取值范围', source: 'rule', defaultLevel: '高', suggestion: '检查字段上下限、单位换算与现场传感器标定。' },
  { id: 'boundary', name: '边界值检测', source: 'rule', defaultLevel: '中', suggestion: '复核边界条件，确认被测系统在临界值附近的处理策略。' },
  { id: 'overflow', name: '字段越界', source: 'rule', defaultLevel: '高', suggestion: '确认报文字段长度、字节偏移与端序定义。' },
  { id: 'timeout', name: '响应超时', source: 'rule', defaultLevel: '中', suggestion: '排查链路时延、任务负载与被测模块响应能力。' },
  { id: 'format', name: '格式错误', source: 'rule', defaultLevel: '高', suggestion: '检查帧头、校验码、JSON/结构体格式与协议版本。' },
].map((item) => ({ ...item, captureEnabled: true, desc: item.suggestion }))

const typeIdOf = (typeName) => {
  const hit = defaultTypes.find((item) => item.name === typeName)
  return hit?.id || `custom-${typeName}`
}

const sourceOf = (typeName) => defaultTypes.find((item) => item.name === typeName)?.source || 'execution'

const activeStateOf = (state) => {
  if (['已处理', '已修复', '已忽略', '已转派', '自动恢复', '已记录'].includes(state)) return '已处理'
  return '待处理'
}
const seedTagsOf = (alert) => {
  const tags = []
  if (['响应超时'].includes(alert.type)) tags.push('链路问题')
  if (['类型校验', '取值范围', '边界值检测', '字段越界', '格式错误'].includes(alert.type)) tags.push('协议字段')
  if (alert.level === '高') tags.push('高优先级')
  if (activeStateOf(alert.state) === '待处理') tags.push('需跟进')
  return [...new Set(tags)]
}

const cleanTags = (tags = []) => [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))]

const normalizeSeed = (alert, index) => ({
  id: alert.id || uid('ex'),
  type: alert.type,
  typeId: typeIdOf(alert.type),
  level: alert.level || '中',
  state: activeStateOf(alert.state),
  systemId: alert.systemId,
  moduleId: alert.moduleId,
  interfaceId: '',
  iface: alert.iface || '未命名接口',
  source: sourceOf(alert.type),
  runId: '',
  taskId: '',
  detail: {
    reqHex: '',
    respHex: '',
    ruleMessage: alert.remark || '',
    fieldPath: '',
    recvMs: null,
  },
  capturedTime: alert.capturedTime || `2026-06-${19 + (index % 7)} ${String(8 + (index % 16)).padStart(2, '0')}:${String(10 + index).padStart(2, '0')}:00`,
  resolvedTime: alert.resolvedTime || '',
  handler: '',
  trace: [
    {
      time: alert.resolvedTime || `2026-06-24 ${String(9 + (index % 3)).padStart(2, '0')}:${String(10 + index).padStart(2, '0')}:00`,
      user: '系统',
      action: '捕捉异常',
      note: alert.remark || '由历史告警数据导入。',
    },
  ],
  remark: alert.remark || '',
  tags: seedTagsOf(alert),
})

const stateMeta = (state) => EXC_STATES.find((item) => item.value === state) || { value: state, label: state, tag: 'info' }
const levelMeta = (level) => EXC_LEVELS.find((item) => item.value === level) || { value: level, label: level, tag: 'info' }
const defaultExceptionSettings = {
  targetSlaRate: 95,
  highSlaHours: 4,
  mediumSlaHours: 8,
  lowSlaHours: 24,
  warningLeadHours: 1,
}

export const useExceptionStore = defineStore('exception', {
  state: () => {
    const exceptions = alerts.map(normalizeSeed)
    return {
      exceptions,
      types: defaultTypes,
      selectedId: null,
      tagHistory: cleanTags(exceptions.flatMap((item) => item.tags || [])),
      settings: { ...defaultExceptionSettings },
    }
  },

  getters: {
    selected(state) {
      return state.exceptions.find((item) => item.id === state.selectedId) || state.exceptions[0] || null
    },
    pendingCount: (state) => state.exceptions.filter((item) => item.state === '待处理').length,
    exceptionsOfModule: (state) => (moduleId) => state.exceptions.filter((item) => item.moduleId === moduleId),
    exceptionsOfSystem: (state) => (systemId) => state.exceptions.filter((item) => !systemId || item.systemId === systemId),
    typeByName: (state) => (name) => state.types.find((item) => item.name === name),
    typeMeta: (state) => (name) => state.types.find((item) => item.name === name) || defaultTypes.find((item) => item.name === name),
    tagOptions: (state) => cleanTags([...state.tagHistory, ...state.exceptions.flatMap((item) => item.tags || [])]).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    stateMeta: () => stateMeta,
    levelMeta: () => levelMeta,
    slaHours: (state) => (level) => {
      if (level === '高') return state.settings.highSlaHours
      if (level === '低') return state.settings.lowSlaHours
      return state.settings.mediumSlaHours
    },
    overdueItems: (state) => {
      const now = Date.now()
      return state.exceptions
        .filter((item) => item.state === '待处理')
        .map((item) => {
          const captured = new Date(item.capturedTime.replace(/\//g, '-')).getTime()
          const elapsed = now - captured
          const slaHours = levelMeta(item.level).value === '高'
            ? state.settings.highSlaHours
            : (levelMeta(item.level).value === '低' ? state.settings.lowSlaHours : state.settings.mediumSlaHours)
          const slaMs = slaHours * 3600000
          return { ...item, elapsedHours: Math.round(elapsed / 3600000), slaHours, overdue: elapsed > slaMs }
        })
        .filter((item) => item.overdue)
        .sort((a, b) => b.elapsedHours - a.elapsedHours)
    },
    stats: () => (items = []) => {
      const total = items.length
      const pending = items.filter((item) => item.state === '待处理').length
      const processed = total - pending
      const high = items.filter((item) => item.level === '高').length
      const middle = items.filter((item) => item.level === '中').length
      const low = items.filter((item) => item.level === '低').length
      return {
        total,
        pending,
        processed,
        high,
        middle,
        low,
      }
    },
    filtered: (state) => (filters = {}) => state.exceptions.filter((item) => {
      if (filters.systemId && item.systemId !== filters.systemId) return false
      if (filters.moduleId && item.moduleId !== filters.moduleId) return false
      if (filters.type && item.type !== filters.type) return false
      if (filters.level && item.level !== filters.level) return false
      if (filters.state && item.state !== filters.state) return false
      if (filters.source && item.source !== filters.source) return false
      if (filters.tag && !(item.tags || []).includes(filters.tag)) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        const hay = [item.type, item.iface, item.remark, item.detail?.ruleMessage, item.detail?.fieldPath, ...(item.tags || [])].join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    }),
  },

  actions: {
    select(id) {
      this.selectedId = id
    },
    capture(payload = {}) {
      const typeName = payload.type || payload.ruleLabel || '系统事件'
      const typeDef = this.types.find((item) => item.name === typeName || item.id === payload.typeId) || {
        id: typeIdOf(typeName),
        name: typeName,
        defaultLevel: payload.level || '中',
        captureEnabled: true,
      }
      if (typeDef.captureEnabled === false) return null

      const item = {
        id: payload.id || uid('ex'),
        type: typeDef.name,
        typeId: typeDef.id,
        level: payload.level || typeDef.defaultLevel || '中',
        state: activeStateOf(payload.state),
        systemId: payload.systemId || '',
        moduleId: payload.moduleId || '',
        interfaceId: payload.interfaceId || '',
        iface: payload.iface || payload.interfaceName || '未命名接口',
        source: payload.source || typeDef.source || 'execution',
        runId: payload.runId || '',
        taskId: payload.taskId || '',
        detail: {
          reqHex: payload.detail?.reqHex || '',
          respHex: payload.detail?.respHex || '',
          ruleMessage: payload.detail?.ruleMessage || payload.message || payload.remark || '',
          fieldPath: payload.detail?.fieldPath || '',
          recvMs: payload.detail?.recvMs ?? null,
        },
        capturedTime: payload.capturedTime || nowText(),
        resolvedTime: payload.resolvedTime || '',
        handler: payload.handler || '',
        tags: cleanTags(payload.tags),
        trace: [
          {
            time: payload.capturedTime || nowText(),
            user: payload.handler || '系统',
            action: '捕捉异常',
            note: payload.detail?.ruleMessage || payload.message || payload.remark || '执行过程中自动捕捉。',
          },
        ],
        remark: payload.remark || payload.detail?.ruleMessage || '',
      }
      this.tagHistory = cleanTags([...this.tagHistory, ...item.tags])
      this.exceptions.unshift(item)
      this.selectedId = item.id
      return item
    },
    updateState(id, state, note = '', handler = '测试员') {
      const item = this.exceptions.find((ex) => String(ex.id) === String(id))
      if (!item) return false
      item.state = activeStateOf(state)
      item.handler = handler
      if (item.state === '已处理') item.resolvedTime = nowText()
      item.trace.unshift({
        time: nowText(),
        user: handler,
        action: `状态变更为${item.state}`,
        note,
      })
      return true
    },
    addTrace(id, note, handler = '测试员') {
      const item = this.exceptions.find((ex) => String(ex.id) === String(id))
      if (!item || !note) return false
      item.trace.unshift({ time: nowText(), user: handler, action: '添加处理记录', note })
      item.remark = note
      return true
    },
    updateExceptionSettings(patch) {
      Object.assign(this.settings, patch)
    },
    setTags(id, tags = []) {
      const item = this.exceptions.find((ex) => String(ex.id) === String(id))
      if (!item) return false
      item.tags = cleanTags(tags)
      this.tagHistory = cleanTags([...this.tagHistory, ...item.tags])
      return true
    },
    deleteTag(tag) {
      const name = String(tag || '').trim()
      if (!name) return false
      this.tagHistory = this.tagHistory.filter((item) => item !== name)
      this.exceptions.forEach((item) => {
        item.tags = (item.tags || []).filter((tagName) => tagName !== name)
      })
      return true
    },
    batchUpdate(ids, patch, note = '') {
      ids.forEach((id) => {
        if (patch.state) this.updateState(id, patch.state, note)
        else {
          const item = this.exceptions.find((ex) => String(ex.id) === String(id))
          if (item) Object.assign(item, patch)
        }
      })
    },
    toggleType(id, enabled) {
      const item = this.types.find((type) => type.id === id)
      if (item) item.captureEnabled = enabled
    },
    updateType(id, patch) {
      const item = this.types.find((type) => type.id === id)
      if (item) Object.assign(item, patch)
    },
    addType(payload) {
      const name = payload.name?.trim()
      if (!name) return null
      const item = {
        id: payload.id || uid('etype'),
        name,
        source: payload.source || 'execution',
        defaultLevel: payload.defaultLevel || '中',
        captureEnabled: payload.captureEnabled ?? true,
        suggestion: payload.suggestion || '按现场处置经验补充建议。',
        desc: payload.desc || '',
      }
      this.types.push(item)
      return item
    },
  },
})
