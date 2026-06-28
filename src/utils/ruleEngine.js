export const RULE_TYPES = [
  { value: 'type', label: '类型校验', tag: 'primary', icon: 'DataAnalysis', level: 'error', desc: '收到的字段是不是声明的类型' },
  { value: 'range', label: '取值范围', tag: 'danger', icon: 'Aim', level: 'error', desc: '数值有没有超出协议规定的上下限' },
  { value: 'boundary', label: '边界值检测', tag: 'warning', icon: 'Crop', level: 'warning', desc: '卡在临界值时表现对不对' },
  { value: 'overflow', label: '字段越界', tag: 'danger', icon: 'FullScreen', level: 'error', desc: '帧长够不够、该有的字段在不在' },
  { value: 'timeout', label: '响应超时', tag: 'danger', icon: 'Timer', level: 'error', desc: '回得够不够快' },
  { value: 'format', label: '格式错误', tag: 'danger', icon: 'Tickets', level: 'error', desc: '帧格式、校验码、报文结构对不对' },
  { value: 'delivery', label: '投递校验', tag: 'success', icon: 'Promotion', level: 'error', desc: '消息是否在指定时间内被成功投递（MQ）' },
  { value: 'ordering', label: '顺序校验', tag: 'warning', icon: 'Sort', level: 'warning', desc: '消息是否按预期顺序到达（MQ）' },
]

export const RULE_TYPE_MAP = Object.fromEntries(RULE_TYPES.map((item) => [item.value, item]))

const NUMERIC_RANGES = {
  int8: [-128, 127],
  uint8: [0, 255],
  int16: [-32768, 32767],
  uint16: [0, 65535],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  int64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  uint64: [0, Number.MAX_SAFE_INTEGER],
  float: [-3.4e38, 3.4e38],
  double: [-1.8e308, 1.8e308],
  float32: [-3.4e38, 3.4e38],
  float64: [-1.8e308, 1.8e308],
  integer: [-2147483648, 2147483647],
}

const normalizeType = (type = '') => String(type).toLowerCase()
const isNumericType = (type) => Object.keys(NUMERIC_RANGES).includes(normalizeType(type))
const ok = (rule, path, message) => result('success', rule, path, message)
const fail = (rule, path, message) => result(rule.level === 'warning' ? 'warning' : 'error', rule, path, message)
const warn = (rule, path, message) => result('warning', rule, path, message)

const result = (level, rule, path, message) => ({
  level,
  path: path || rule.target?.fieldPath || rule.target?.interfaceName || '接口',
  message,
  ruleType: rule.type,
  ruleLabel: RULE_TYPE_MAP[rule.type]?.label || rule.type,
})

export function inferRange(dataType) {
  return NUMERIC_RANGES[normalizeType(dataType)] || null
}

export function inferConstraint(field = {}) {
  if (field.constraint?.mode === 'range') return { min: field.constraint.min, max: field.constraint.max }
  if (field.constraint?.mode === 'fixed') return { min: field.constraint.value, max: field.constraint.value }
  const range = inferRange(field.dataType || field.type)
  return range ? { min: range[0], max: range[1] } : null
}

export function flattenInterfaceFields(iface) {
  const out = []
  const walk = (list = [], prefix) => {
    list.forEach((field) => {
      const path = `${prefix}.${field.name || `field${field.id}`}`
      out.push({ ...field, fieldPath: path, fieldName: field.name })
      if (field.children?.length) walk(field.children, path)
    })
  }
  walk(iface?.request || [], 'request')
  walk(iface?.response || [], 'response')
  return out
}

export function makeSample(iface, variant = 'valid') {
  const build = (fields = []) => {
    const obj = {}
    fields.forEach((field) => {
      if (field.children?.length && (field.type === '共识体' || field.dataType === 'object')) {
        obj[field.name] = build(field.children)
        return
      }
      if (field.children?.length && field.type === '结构矩阵') {
        obj[field.name] = [build(field.children)]
        return
      }
      const constraint = inferConstraint(field)
      let value = sampleValue(field, constraint)
      if (variant === 'bad' && field.name && /code|total|available|device|count|range|angle/i.test(field.name)) {
        value = typeof value === 'number' ? (constraint?.max ?? 99) + 1 : 999999
      }
      obj[field.name || `field${field.id}`] = value
    })
    return obj
  }
  return { request: build(iface?.request), response: build(iface?.response) }
}

function sampleValue(field, constraint) {
  const type = normalizeType(field.dataType || field.type)
  if (field.type === '位组序流') return 'AA55 01 00 FF'
  if (type.includes('string')) return `${field.name || 'value'}-sample`
  if (type.includes('bool')) return true
  if (field.constraint?.mode === 'enum') return field.constraint.entries?.[0]?.value ?? 0
  if (constraint) return clampNumber(Math.round(((constraint.min ?? 0) + (constraint.max ?? 10)) / 2), constraint.min, constraint.max)
  if (isNumericType(type)) return 1
  return 'sample'
}

export function evaluate(ruleSet, sample, iface, opts = { recvMs: null }) {
  if (!ruleSet) return []
  const parsed = parseSample(sample)
  const results = []
  const rules = (ruleSet.rules || []).filter((rule) => rule.enabled !== false)

  rules.forEach((rule) => {
    if (rule.type === 'timeout') {
      const threshold = Number(rule.params?.timeoutMs || 500)
      const recvMs = Number(opts.recvMs ?? 0)
      if (recvMs > threshold) results.push(fail(rule, rule.target?.interfaceName, `响应 ${recvMs}ms，超过阈值 ${threshold}ms`))
      else results.push(ok(rule, rule.target?.interfaceName, `响应 ${recvMs}ms，未超过 ${threshold}ms`))
      return
    }

    if (rule.type === 'delivery') {
      const deliveryMs = Number(opts.deliveryMs ?? rule.params?.deliveryMs ?? 0)
      const threshold = Number(rule.params?.timeoutMs || 3000)
      const delivered = opts.delivered !== false
      if (!delivered) results.push(fail(rule, rule.target?.interfaceName, `消息未在 ${threshold}ms 内投递`))
      else if (deliveryMs > threshold) results.push(fail(rule, rule.target?.interfaceName, `投递耗时 ${deliveryMs}ms，超过 ${threshold}ms`))
      else results.push(ok(rule, rule.target?.interfaceName, `消息已投递，耗时 ${deliveryMs}ms`))
      return
    }

    if (rule.type === 'ordering') {
      const received = opts.receivedOrder || []
      const expected = rule.params?.expectedOrder || []
      if (!expected.length) { results.push(ok(rule, rule.target?.interfaceName, '未定义期望顺序，跳过校验')); return }
      const actualStr = received.slice(0, expected.length).join(',')
      const expectedStr = expected.join(',')
      if (actualStr === expectedStr) results.push(ok(rule, rule.target?.interfaceName, `消息顺序正确：${actualStr}`))
      else results.push(fail(rule, rule.target?.interfaceName, `顺序不匹配，期望 ${expectedStr}，实际 ${actualStr || '(空)'}`))
      return
    }

    if (rule.type === 'format') {
      if (!parsed.valid) results.push(fail(rule, rule.target?.interfaceName, parsed.error))
      else results.push(ok(rule, rule.target?.interfaceName, '样本格式合法'))
      return
    }

    if (!parsed.valid) {
      results.push(fail(rule, rule.target?.fieldPath, parsed.error))
      return
    }

    const path = rule.target?.fieldPath
    const value = getPath(parsed.value, path)

    if (rule.type === 'overflow') {
      if (value === undefined || value === null || value === '') {
        results.push(fail(rule, path, `${path} 缺失或为空`))
        return
      }
      const maxLength = Number(rule.params?.maxLength || 0)
      if (maxLength && String(value).length > maxLength) {
        results.push(fail(rule, path, `${path} 长度 ${String(value).length} 超过 ${maxLength}`))
      } else {
        results.push(ok(rule, path, `${path} 存在且长度未越界`))
      }
      return
    }

    if (rule.type === 'type') {
      if (value === undefined) {
        results.push(fail(rule, path, `${path} 缺失，无法校验类型`))
        return
      }
      const dataType = rule.params?.dataType
      const pass = typeMatches(value, dataType, rule.params?.enumValues)
      results.push(pass ? ok(rule, path, `${path} 类型符合 ${dataType}`) : fail(rule, path, `${path} 类型不符合 ${dataType}`))
      return
    }

    if (rule.type === 'range') {
      const num = Number(value)
      const min = Number(rule.params?.min)
      const max = Number(rule.params?.max)
      if (!Number.isFinite(num)) {
        results.push(fail(rule, path, `${path} 不是可比较数值`))
      } else if (num < min || num > max) {
        results.push(fail(rule, path, `${path}=${num} 超出 ${min} ~ ${max}`))
      } else {
        results.push(ok(rule, path, `${path}=${num} 位于 ${min} ~ ${max}`))
      }
      return
    }

    if (rule.type === 'boundary') {
      const num = Number(value)
      const min = Number(rule.params?.min)
      const max = Number(rule.params?.max)
      if (!Number.isFinite(num)) {
        results.push(warn(rule, path, `${path} 不是数值，跳过边界提醒`))
      } else if (num === min || num === max) {
        results.push(warn(rule, path, `${path} 命中边界值 ${num}`))
      } else if (num < min || num > max) {
        results.push(fail(rule, path, `${path}=${num} 已越过边界 ${min} ~ ${max}`))
      } else {
        results.push(ok(rule, path, `${path} 未命中边界`))
      }
    }
  })

  if (!results.length && parsed.valid) {
    results.push({ level: 'success', path: iface?.name || '接口', message: '无启用规则需要判定', ruleType: 'none', ruleLabel: '无规则' })
  }
  return results
}

function parseSample(sample) {
  if (typeof sample === 'string') {
    const text = sample.trim()
    if (!text) return { valid: false, error: '样本为空' }
    if (/^[\da-fA-F\s]+$/.test(text)) {
      const compact = text.replace(/\s/g, '')
      if (compact.length % 2 !== 0) return { valid: false, error: '十六进制长度不是偶数' }
      return { valid: true, value: { hex: compact } }
    }
    try {
      return { valid: true, value: JSON.parse(text) }
    } catch (error) {
      return { valid: false, error: `JSON 解析失败：${error.message}` }
    }
  }
  if (sample && typeof sample === 'object') return { valid: true, value: sample }
  return { valid: false, error: '样本类型不支持' }
}

function getPath(obj, path = '') {
  if (!path) return obj
  return path.split('.').reduce((cur, key) => {
    if (cur == null) return undefined
    if (Array.isArray(cur)) return cur[0]?.[key]
    return cur[key]
  }, obj)
}

function typeMatches(value, dataType, enumValues = []) {
  const type = normalizeType(dataType)
  if (enumValues?.length) return enumValues.some((item) => String(item.value ?? item) === String(value))
  if (type.includes('string') || type.includes('ascii') || type.includes('utf')) return typeof value === 'string'
  if (type.includes('bool')) return typeof value === 'boolean'
  if (type.includes('array')) return Array.isArray(value)
  if (type.includes('object') || type.includes('message')) return value && typeof value === 'object' && !Array.isArray(value)
  if (dataType === '位组序流') return typeof value === 'string'
  if (isNumericType(type)) return typeof value === 'number' && Number.isFinite(value)
  return value !== undefined
}

function clampNumber(value, min, max) {
  if (Number.isFinite(min) && value < min) return min
  if (Number.isFinite(max) && value > max) return max
  return value
}
