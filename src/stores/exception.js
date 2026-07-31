import { defineStore } from 'pinia'
import { alerts } from '@/mock/seed-data'
import { seedExceptionCapturedTime, seedRunIdForAlert } from '@/stores/runBatch'
import { bus, EVENTS } from '@/utils/bus'

const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
const clone = (value) => JSON.parse(JSON.stringify(value ?? null))

export const EXC_SOURCES = [
  { value: 'reception', label: '接收数据自动捕获' },
]

const defaultTypes = [
  {
    id: 'unparsed',
    name: '无法解析',
    layer: '解析',
    tone: 'danger',
    desc: '原始数据无法按任何已配置报文或协议完成解析。',
  },
  {
    id: 'structure',
    name: '结构异常',
    layer: '结构',
    tone: 'warning',
    desc: '报文长度、帧头、校验和或字段布局与结构定义不一致。',
  },
  {
    id: 'constraint',
    name: '字段约束异常',
    layer: '字段',
    tone: 'warning',
    desc: '字段缺失、类型不符、枚举无效或取值超出字段约束。',
  },
  {
    id: 'rule',
    name: '规则校验异常',
    layer: '规则',
    tone: 'info',
    desc: '解析结果违反接口绑定的黑盒校验规则。',
  },
].map((item) => ({ ...item, source: 'reception', captureEnabled: true }))

const TYPE_ALIASES = {
  无法解析: '无法解析',
  语义不一致: '结构异常',
  格式错误: '结构异常',
  结构异常: '结构异常',
  类型校验: '字段约束异常',
  取值范围: '字段约束异常',
  边界值检测: '字段约束异常',
  字段越界: '字段约束异常',
  字段约束异常: '字段约束异常',
  规则校验失败: '规则校验异常',
  规则校验异常: '规则校验异常',
}

const canonicalType = (name) => TYPE_ALIASES[name] || '规则校验异常'
const typeMetaOf = (name) => defaultTypes.find((item) => item.name === canonicalType(name)) || defaultTypes[3]
const cleanTags = (tags = []) => [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))]
const sampleStatusOf = (item) => item.savedDatasetIds?.length ? 'saved' : 'unsaved'

const seedHexOf = (index) => Array.from({ length: 18 }, (_, byteIndex) => (
  ((index + 3) * 29 + byteIndex * 17) % 256
).toString(16).padStart(2, '0').toUpperCase()).join(' ')

const seedFieldOf = (alert) => {
  if (canonicalType(alert.type) === '结构异常') return 'frame'
  const match = String(alert.remark || '').match(/^([^，。；\s]+?)(?:字段|值)/)
  return match?.[1] || 'payload'
}

const normalizeSeed = (alert, index) => {
  const type = canonicalType(alert.type)
  const typeMeta = typeMetaOf(type)
  const fieldName = alert.field || seedFieldOf(alert)
  const rawHex = alert.rawHex || seedHexOf(index)
  const issue = {
    layer: typeMeta.layer,
    tag: type,
    field: fieldName,
    message: alert.remark || typeMeta.desc,
  }
  return {
    id: alert.id || uid('ex'),
    type,
    typeId: typeMeta.id,
    systemId: alert.systemId,
    moduleId: alert.moduleId,
    interfaceId: '',
    iface: alert.iface || '未命名报文',
    source: 'reception',
    sourceEntryId: '',
    runId: seedRunIdForAlert(alert, index),
    taskId: '',
    transport: 'bin',
    rawHex,
    fields: [{ name: fieldName, label: fieldName }],
    values: canonicalType(alert.type) === '无法解析'
      ? {}
      : { [fieldName]: alert.value ?? String(alert.remark || '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? '异常值' },
    issues: [issue],
    detail: {
      reqHex: rawHex,
      ruleMessage: issue.message,
      fieldPath: fieldName,
    },
    capturedTime: alert.capturedTime || seedExceptionCapturedTime(index),
    remark: alert.remark || '',
    tags: cleanTags([typeMeta.layer, '演示样本']),
    savedDatasetIds: [],
    variantCount: 0,
  }
}

export const useExceptionStore = defineStore('exception', {
  state: () => {
    const exceptions = alerts.map(normalizeSeed)
    return {
      exceptions,
      types: defaultTypes,
      selectedId: null,
      tagHistory: cleanTags(exceptions.flatMap((item) => item.tags || [])),
    }
  },

  getters: {
    selected(state) {
      return state.exceptions.find((item) => item.id === state.selectedId) || state.exceptions[0] || null
    },
    exceptionsOfModule: (state) => (moduleId) => state.exceptions.filter((item) => item.moduleId === moduleId),
    exceptionsOfSystem: (state) => (systemId) => state.exceptions.filter((item) => !systemId || item.systemId === systemId),
    typeByName: (state) => (name) => state.types.find((item) => item.name === canonicalType(name)),
    typeMeta: (state) => (name) => state.types.find((item) => item.name === canonicalType(name)) || typeMetaOf(name),
    sampleStatus: () => sampleStatusOf,
    tagOptions: (state) => cleanTags([
      ...state.tagHistory,
      ...state.exceptions.flatMap((item) => item.tags || []),
    ]).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    stats: () => (items = []) => ({
      total: items.length,
      unparsed: items.filter((item) => item.type === '无法解析').length,
      structure: items.filter((item) => item.type === '结构异常').length,
      constraint: items.filter((item) => item.type === '字段约束异常').length,
      rule: items.filter((item) => item.type === '规则校验异常').length,
      saved: items.filter((item) => sampleStatusOf(item) === 'saved').length,
      unsaved: items.filter((item) => sampleStatusOf(item) === 'unsaved').length,
    }),
    filtered: (state) => (filters = {}) => state.exceptions.filter((item) => {
      if (filters.systemId && item.systemId !== filters.systemId) return false
      if (filters.moduleId && item.moduleId !== filters.moduleId) return false
      if (filters.type && item.type !== filters.type) return false
      if (filters.savedStatus && sampleStatusOf(item) !== filters.savedStatus) return false
      if (filters.tag && !(item.tags || []).includes(filters.tag)) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        const hay = [
          item.type,
          item.iface,
          item.remark,
          item.detail?.ruleMessage,
          item.detail?.fieldPath,
          item.rawHex,
          ...Object.keys(item.values || {}),
          ...Object.values(item.values || {}),
          ...(item.tags || []),
        ].join(' ').toLowerCase()
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
      const typeName = canonicalType(payload.type || payload.ruleLabel)
      const typeDef = this.types.find((item) => item.name === typeName) || typeMetaOf(typeName)
      if (typeDef.captureEnabled === false) return null

      const rawHex = payload.rawHex || payload.detail?.reqHex || ''
      const issues = clone(payload.issues || []) || []
      const item = {
        id: payload.id || uid('ex'),
        type: typeDef.name,
        typeId: typeDef.id,
        systemId: payload.systemId || '',
        moduleId: payload.moduleId || '',
        interfaceId: payload.interfaceId || '',
        iface: payload.iface || payload.interfaceName || '未命名报文',
        source: 'reception',
        sourceEntryId: payload.sourceEntryId || '',
        batchId: payload.batchId || payload.runId || '',
        runId: payload.runId || payload.batchId || '',
        taskId: payload.taskId || '',
        transport: payload.transport || 'bin',
        rawHex,
        fields: clone(payload.fields || []) || [],
        values: clone(payload.values || {}) || {},
        issues,
        detail: {
          reqHex: rawHex,
          ruleMessage: payload.detail?.ruleMessage || issues.map((issue) => issue.message).filter(Boolean).join('；') || payload.message || payload.remark || '',
          fieldPath: payload.detail?.fieldPath || issues[0]?.field || '',
        },
        capturedTime: payload.capturedTime || nowText(),
        remark: payload.remark || payload.detail?.ruleMessage || '',
        tags: cleanTags(payload.tags?.length ? payload.tags : [typeDef.layer]),
        savedDatasetIds: [],
        variantCount: 0,
      }
      this.tagHistory = cleanTags([...this.tagHistory, ...item.tags])
      this.exceptions.unshift(item)
      this.selectedId = item.id
      bus.emit(EVENTS.EXCEPTION_CREATED, item)
      return item
    },
    markSaved(ids = [], datasetId, { variant = false } = {}) {
      const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(String))
      this.exceptions.forEach((item) => {
        if (!idSet.has(String(item.id))) return
        item.savedDatasetIds = [...new Set([...(item.savedDatasetIds || []), datasetId])]
        if (variant) item.variantCount = (item.variantCount || 0) + 1
        bus.emit(EVENTS.EXCEPTION_UPDATED, item)
      })
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
    toggleType(id, enabled) {
      const item = this.types.find((type) => type.id === id)
      if (item) item.captureEnabled = enabled
    },
    updateType(id, patch) {
      const item = this.types.find((type) => type.id === id)
      if (item) Object.assign(item, patch)
    },
  },
})
