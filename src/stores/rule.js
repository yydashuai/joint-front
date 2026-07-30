import { defineStore } from 'pinia'
import { ruleSets as seedRuleSets } from '@/mock/seed-data'
import { useProtocolStore } from '@/stores/protocol'
import { useTestTaskStore } from '@/stores/testTask'
import { flattenInterfaceFields, inferConstraint, RULE_TYPES } from '@/utils/ruleEngine'
import { makeUniqueName } from '@/utils/entityName'

let ruleSetSeq = 100
let ruleSeq = 1000

const nowDate = () => new Date().toISOString().slice(0, 10)
const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
const nextRuleSetId = () => `rs-${++ruleSetSeq}`
const nextRuleId = () => `rule-${++ruleSeq}`

const clone = (value) => JSON.parse(JSON.stringify(value))
const SUPPORTED_RULE_TYPES = new Set(['range', 'semantic'])
const normalizeRuleSets = (ruleSets = []) => clone(ruleSets).map((ruleSet) => ({
  ...ruleSet,
  rules: (ruleSet.rules || []).filter((rule) => SUPPORTED_RULE_TYPES.has(rule.type)),
}))
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
  type: 'range',
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
    ruleSets: normalizeRuleSets(seedRuleSets || []),
    selectedRuleSetId: seedRuleSets?.[0]?.id || null,
    _idsResolved: false,
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

    normalizeRuleScope() {
      const normalizedSeeds = normalizeRuleSets(seedRuleSets || [])
      this.ruleSets.forEach((ruleSet) => {
        ruleSet.rules = (ruleSet.rules || []).filter((rule) => SUPPORTED_RULE_TYPES.has(rule.type))
        const seedRuleSet = normalizedSeeds.find((item) => item.id === ruleSet.id)
        if (!seedRuleSet) return
        const existingIds = new Set(ruleSet.rules.map((rule) => rule.id))
        seedRuleSet.rules.forEach((rule) => {
          if (!existingIds.has(rule.id)) ruleSet.rules.push(clone(rule))
        })
      })
    },

    /** 一次性补全种子规则中缺失的 target.interfaceId（按 interfaceName 匹配） */
    resolveInterfaceIds() {
      if (this._idsResolved) return
      this._idsResolved = true
      const protoStore = useProtocolStore()
      this.ruleSets.forEach((rs) => {
        rs.rules.forEach((rule) => {
          if (!rule.target?.interfaceId && rule.target?.interfaceName) {
            const targetName = String(rule.target.interfaceName).replace(/报文$/, '')
            const iface = protoStore.interfaces.find((i) =>
              String(i.name).replace(/报文$/, '') === targetName
            )
            if (iface) rule.target.interfaceId = iface.id
          }
        })
      })
    },

    addRuleSet(data = {}) {
      const rs = defaultRuleSet({
        ...data,
        name: makeUniqueName(this.ruleSets, data.name || '新建规则集'),
      })
      this.ruleSets.unshift(rs)
      this.selectedRuleSetId = rs.id
      return rs
    },

    updateRuleSet(id, patch) {
      const rs = this.ruleSets.find((item) => item.id === id)
      if (!rs) return
      const next = { ...patch }
      if (Object.prototype.hasOwnProperty.call(next, 'name')) {
        next.name = makeUniqueName(this.ruleSets, next.name, rs)
      }
      Object.assign(rs, next)
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
      copy.name = makeUniqueName(this.ruleSets, `${src.name}（副本）`)
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

    generatePreview(interfaceId, selectedTypes = ['range', 'semantic']) {
      const protoStore = useProtocolStore()
      const iface = protoStore.interfaces.find((item) => item.id === interfaceId)
      if (!iface) return []
      const preview = []
      const fields = flattenInterfaceFields(iface, protoStore.protocols)
        .filter((field) => field.fieldPath.startsWith('response.'))

      fields.forEach((field) => {
        const constraint = inferConstraint(field)
        if (selectedTypes.includes('range') && constraint) {
          preview.push(makeGeneratedRule(iface, field, 'range', {
            dataType: field.dataType || field.type,
            min: constraint.min,
            max: constraint.max,
          }))
        }
      })

      if (selectedTypes.includes('semantic')) {
        fields.forEach((declaredField, index) => {
          if (!/(data)?length|len|长度/i.test(declaredField.fieldName || '')) return
          const actualField = fields.slice(index + 1).find((field) =>
            field.type === 'bitstream' ||
            field.type === '位组序流' ||
            field.type === 'file' ||
            field.type === '流文件' ||
            field.type === 'matrix' ||
            field.type === '结构矩阵'
          )
          if (!actualField) return
          preview.push(makeGeneratedRule(iface, actualField, 'semantic', {
            declaredPath: declaredField.fieldPath,
            actualPath: actualField.fieldPath,
            measure: 'byteLength',
          }))
        })
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
  if (type === 'range') return `${field.fieldPath} 必须位于 ${params.min} ~ ${params.max}`
  if (type === 'semantic') return `${params.declaredPath} 的长度声明必须与 ${params.actualPath} 的实际解析长度一致`
  return `${field.fieldPath} 校验`
}
