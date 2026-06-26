import { defineStore } from 'pinia'
import { ruleSets as seedRuleSets } from '@/mock/seed-data'
import { useProtocolStore } from '@/stores/protocol'
import { useTestTaskStore } from '@/stores/testTask'
import { flattenInterfaceFields, inferConstraint, inferRange, RULE_TYPES } from '@/utils/ruleEngine'

let ruleSetSeq = 100
let ruleSeq = 1000

const nowDate = () => new Date().toISOString().slice(0, 10)
const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
const nextRuleSetId = () => `rs-${++ruleSetSeq}`
const nextRuleId = () => `rule-${++ruleSeq}`

const clone = (value) => JSON.parse(JSON.stringify(value))
const norm = (value) => String(value ?? '').trim().toLowerCase()
const ruleUniqueKeys = (rule = {}) => {
  const target = rule.target || {}
  const interfaceKeys = [
    norm(target.interfaceId),
    norm(target.interfaceName),
  ].filter(Boolean)
  const identities = interfaceKeys.length ? interfaceKeys : ['__interface__']
  const fieldKey = norm(target.fieldPath || target.fieldName || '__interface__')
  return identities.map((identity) => [norm(rule.type), identity, fieldKey].join('|'))
}
const uniqueRules = (rules = []) => {
  const seen = new Set()
  const result = []
  let skipped = 0
  rules.forEach((rule) => {
    const keys = ruleUniqueKeys(rule)
    if (keys.some((key) => seen.has(key))) {
      skipped += 1
      return
    }
    keys.forEach((key) => seen.add(key))
    result.push(rule)
  })
  return { rules: result, skipped }
}

export { RULE_TYPES }

export const defaultRuleSet = (patch = {}) => ({
  id: nextRuleSetId(),
  name: '新建规则集',
  systemId: null,
  moduleId: null,
  status: 'draft',
  desc: '',
  rules: [],
  createdAt: nowDate(),
  updatedAt: nowText(),
  ...patch,
})

export const makeRule = (patch = {}) => ({
  id: nextRuleId(),
  type: 'type',
  enabled: true,
  level: 'error',
  source: 'manual',
  target: { interfaceId: null, interfaceName: '', fieldPath: '', fieldName: '' },
  params: {},
  desc: '',
  ...patch,
})

export const useRuleStore = defineStore('rule', {
  state: () => ({
    ruleSets: clone(seedRuleSets || []),
    selectedRuleSetId: seedRuleSets?.[0]?.id || null,
  }),

  getters: {
    selectedRuleSet: (state) => state.ruleSets.find((item) => item.id === state.selectedRuleSetId) || null,
    ruleSetsOfModule: (state) => (moduleId) => state.ruleSets.filter((item) => item.moduleId === moduleId),
    ruleSetsOfSystem: (state) => (systemId) => state.ruleSets.filter((item) => item.systemId === systemId),
    enabledRuleSets: (state) => state.ruleSets.filter((item) => item.status === 'enabled'),
    refCountOf: () => (ruleSetId) => {
      const taskStore = useTestTaskStore()
      return taskStore.tasks.filter((task) => task.bindings?.ruleSetId === ruleSetId).length
    },
    statsByType: () => (ruleSet) => {
      const rules = ruleSet?.rules || []
      const byType = Object.fromEntries(RULE_TYPES.map((type) => [type.value, 0]))
      rules.forEach((rule) => { byType[rule.type] = (byType[rule.type] || 0) + 1 })
      return {
        total: rules.length,
        enabled: rules.filter((rule) => rule.enabled).length,
        byType,
      }
    },
  },

  actions: {
    select(id) {
      this.selectedRuleSetId = id
    },

    addRuleSet(data = {}) {
      const rs = defaultRuleSet(data)
      this.ruleSets.unshift(rs)
      this.selectedRuleSetId = rs.id
      return rs
    },

    updateRuleSet(id, patch) {
      const rs = this.ruleSets.find((item) => item.id === id)
      if (!rs) return
      Object.assign(rs, patch)
      rs.updatedAt = nowText()
    },

    removeRuleSet(id) {
      const idx = this.ruleSets.findIndex((item) => item.id === id)
      if (idx < 0) return
      this.ruleSets.splice(idx, 1)
      if (this.selectedRuleSetId === id) this.selectedRuleSetId = this.ruleSets[0]?.id || null
    },

    duplicateRuleSet(id) {
      const src = this.ruleSets.find((item) => item.id === id)
      if (!src) return null
      const copy = clone(src)
      copy.id = nextRuleSetId()
      copy.name = `${src.name}（副本）`
      copy.status = 'draft'
      copy.rules = copy.rules.map((rule) => ({ ...rule, id: nextRuleId() }))
      copy.createdAt = nowDate()
      copy.updatedAt = nowText()
      this.ruleSets.unshift(copy)
      this.selectedRuleSetId = copy.id
      return copy
    },

    addRule(ruleSetId, data = {}) {
      const rs = this.ruleSets.find((item) => item.id === ruleSetId)
      if (!rs) return null
      const rule = makeRule(data)
      rs.rules.unshift(rule)
      rs.updatedAt = nowText()
      return rule
    },

    updateRule(ruleSetId, ruleId, patch) {
      const rule = this.findRule(ruleSetId, ruleId)
      if (!rule) return
      Object.assign(rule, patch)
      this.touch(ruleSetId)
    },

    removeRule(ruleSetId, ruleId) {
      const rs = this.ruleSets.find((item) => item.id === ruleSetId)
      if (!rs) return
      const idx = rs.rules.findIndex((rule) => rule.id === ruleId)
      if (idx >= 0) rs.rules.splice(idx, 1)
      rs.updatedAt = nowText()
    },

    toggleRule(ruleSetId, ruleId, enabled) {
      this.updateRule(ruleSetId, ruleId, { enabled })
    },

    findRule(ruleSetId, ruleId) {
      return this.ruleSets.find((item) => item.id === ruleSetId)?.rules.find((rule) => rule.id === ruleId)
    },

    touch(ruleSetId) {
      const rs = this.ruleSets.find((item) => item.id === ruleSetId)
      if (rs) rs.updatedAt = nowText()
    },

    generatePreview(interfaceId, selectedTypes = ['type', 'range', 'overflow', 'boundary', 'timeout', 'format']) {
      const protoStore = useProtocolStore()
      const iface = protoStore.interfaces.find((item) => item.id === interfaceId)
      if (!iface) return []
      const preview = []
      const fields = flattenInterfaceFields(iface).filter((field) => field.fieldPath.startsWith('response.'))

      fields.forEach((field) => {
        const constraint = inferConstraint(field)
        if (selectedTypes.includes('type')) {
          preview.push(makeGeneratedRule(iface, field, 'type', {
            dataType: field.type === '常量' ? field.dataType : field.type,
            enumValues: field.constraint?.mode === 'enum' ? field.constraint.entries : [],
          }))
        }
        if (selectedTypes.includes('range') && constraint) {
          preview.push(makeGeneratedRule(iface, field, 'range', {
            dataType: field.dataType || field.type,
            min: constraint.min,
            max: constraint.max,
          }))
        }
        if (selectedTypes.includes('boundary') && constraint) {
          preview.push(makeGeneratedRule(iface, field, 'boundary', {
            dataType: field.dataType || field.type,
            min: constraint.min,
            max: constraint.max,
            boundaryMode: 'inclusive',
          }, 'warning'))
        }
        if (selectedTypes.includes('overflow')) {
          preview.push(makeGeneratedRule(iface, field, 'overflow', {
            required: true,
            maxLength: field.type === '位组序流' ? 256 : 64,
          }))
        }
      })

      if (selectedTypes.includes('timeout')) {
        preview.push(makeRule({
          type: 'timeout',
          level: 'error',
          source: 'auto',
          target: { interfaceId: iface.id, interfaceName: iface.name, fieldPath: '', fieldName: '' },
          params: { timeoutMs: 500 },
          desc: `${iface.name} 响应时延不得超过 500ms`,
        }))
      }
      if (selectedTypes.includes('format')) {
        preview.push(makeRule({
          type: 'format',
          level: 'error',
          source: 'auto',
          target: { interfaceId: iface.id, interfaceName: iface.name, fieldPath: '', fieldName: '' },
          params: { sampleType: iface.path?.startsWith('/') ? 'json' : 'hex' },
          desc: `${iface.name} 响应格式必须合法`,
        }))
      }
      return uniqueRules(preview).rules
    },

    mergeGeneratedRules(ruleSetId, rules = []) {
      const rs = this.ruleSets.find((item) => item.id === ruleSetId)
      if (!rs) return { added: 0, skipped: 0 }
      const current = uniqueRules(rs.rules || [])
      if (current.skipped) rs.rules = current.rules
      const existingKeys = new Set(rs.rules.flatMap((rule) => ruleUniqueKeys(rule)))
      const incoming = uniqueRules(rules)
      let added = 0
      let skipped = current.skipped + incoming.skipped
      incoming.rules.forEach((rule) => {
        const keys = ruleUniqueKeys(rule)
        if (keys.some((key) => existingKeys.has(key))) {
          skipped += 1
        } else {
          rs.rules.push({ ...clone(rule), id: nextRuleId() })
          keys.forEach((key) => existingKeys.add(key))
          added += 1
        }
      })
      rs.updatedAt = nowText()
      return { added, skipped }
    },
  },
})

function makeGeneratedRule(iface, field, type, params = {}, level = 'error') {
  return makeRule({
    type,
    enabled: true,
    level,
    source: 'auto',
    target: {
      interfaceId: iface.id,
      interfaceName: iface.name,
      fieldPath: field.fieldPath,
      fieldName: field.fieldName,
    },
    params,
    desc: describeGeneratedRule(type, field, params),
  })
}

function describeGeneratedRule(type, field, params) {
  if (type === 'type') return `${field.fieldPath} 必须符合 ${params.dataType}`
  if (type === 'range') return `${field.fieldPath} 必须位于 ${params.min} ~ ${params.max}`
  if (type === 'boundary') return `${field.fieldPath} 命中 ${params.min}/${params.max} 时提醒`
  if (type === 'overflow') return `${field.fieldPath} 必须存在且长度不超过 ${params.maxLength}`
  return `${field.fieldPath} 校验`
}
