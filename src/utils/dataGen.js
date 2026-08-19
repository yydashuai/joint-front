/**
 * 智能数据生成 —— 策略与分布算法层（纯函数）
 *
 * D-1 约束驱动：策略字段覆盖 + 覆盖率统计（在 testData store 的 generateTestData 内落地）
 * D-2 分布学习：从历史/优秀样本提取字段分布并按分布采样生成
 */

/** 按频次加权随机取值 */
function weightedPick(freq = {}) {
  const entries = Object.entries(freq)
  const total = entries.reduce((t, [, v]) => t + v, 0)
  if (!total) return null
  let rand = Math.random() * total
  for (const [key, value] of entries) {
    rand -= value
    if (rand <= 0) return key
  }
  return entries[entries.length - 1][0]
}

/**
 * 字段分布画像：{ 字段名: { type:'numeric'|'string', min, max, isInteger, freq:{值:次数} } }
 * 同一字段混有数值与字符串时按数值为主，字符串值保留在 freq 中。
 */
export function analyzeDistribution(rows = []) {
  const fields = {}
  rows.forEach((row) => {
    Object.entries(row.values || {}).forEach(([name, value]) => {
      if (value === '' || value == null) return
      const info = fields[name] || (fields[name] = { type: 'string', min: Infinity, max: -Infinity, isInteger: true, freq: {} })
      const numeric = typeof value === 'number' && !Number.isNaN(value)
      const numericText = !numeric && typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())
      if (numeric || numericText) {
        const num = Number(value)
        info.type = 'numeric'
        if (!Number.isInteger(num)) info.isInteger = false
        info.min = Math.min(info.min, num)
        info.max = Math.max(info.max, num)
        const key = String(num)
        info.freq[key] = (info.freq[key] || 0) + 1
        return
      }
      const key = String(value)
      info.freq[key] = (info.freq[key] || 0) + 1
    })
  })
  Object.values(fields).forEach((f) => {
    if (f.min === Infinity) f.min = 0
    if (f.max === -Infinity) f.max = 0
  })
  return fields
}

/**
 * 分布学习采样：以样本整行为模板，对每字段做"分布内变异"。
 * 数值字段：在样本频次中心 ± 5% 波动；字符串字段：按频次加权取。
 */
export function sampleByDistribution(rows = [], count = 5, { jitter = 0.05 } = {}) {
  if (!rows.length) return []
  const fields = analyzeDistribution(rows)
  const out = []
  for (let i = 0; i < count; i += 1) {
    const base = rows[i % rows.length]
    const values = {}
    Object.entries(base.values || {}).forEach(([name, value]) => {
      const info = fields[name]
      if (!info) {
        values[name] = value
        return
      }
      if (info.type === 'numeric' && info.max > info.min) {
        const span = (info.max - info.min) * jitter
        let v = Number(weightedPick(info.freq) ?? value)
        v += (Math.random() - 0.5) * 2 * span
        values[name] = info.isInteger ? Math.round(v) : Math.round(v * 100) / 100
      } else if (info.type === 'numeric') {
        values[name] = Number(weightedPick(info.freq) ?? value)
      } else {
        values[name] = weightedPick(info.freq) ?? value
      }
    })
    out.push({
      label: `分布采样 #${i + 1}`,
      values,
      source: '智能生成',
      strategy: '分布学习',
      coverageTags: ['历史分布'],
    })
  }
  return out
}

/**
 * 覆盖率统计（仅统计有约束字段）：
 * - enum：已覆盖枚举值数 / 总枚举值数
 * - range：是否覆盖 min 与 max（boundary）
 * 返回 { enumPct, boundaryPct, byField }。
 */
export function coverageOf(defs = [], rows = []) {
  const valueSets = rows.map((r) => r.values || {})
  let enumCovered = 0
  let enumTotal = 0
  let boundaryCovered = 0
  let boundaryTotal = 0
  const byField = []
  defs.forEach((f) => {
    const c = f.constraint
    if (!c) return
    if (c.mode === 'enum') {
      const entries = c.entries || []
      const present = new Set(valueSets.map((v) => String(v[f.name])))
      const hit = entries.filter((e) => present.has(String(e.value ?? e))).length
      enumTotal += entries.length
      enumCovered += hit
      byField.push({ name: f.name, mode: '枚举', total: entries.length, covered: hit })
    } else if (c.mode === 'range') {
      let hitMin = false
      let hitMax = false
      valueSets.forEach((v) => {
        const val = Number(v[f.name])
        if (!Number.isNaN(val)) {
          if (val === Number(c.min)) hitMin = true
          if (val === Number(c.max)) hitMax = true
        }
      })
      boundaryTotal += 2
      boundaryCovered += (hitMin ? 1 : 0) + (hitMax ? 1 : 0)
      byField.push({ name: f.name, mode: '边界', total: 2, covered: (hitMin ? 1 : 0) + (hitMax ? 1 : 0) })
    }
  })
  return {
    enumPct: enumTotal ? Math.round((enumCovered / enumTotal) * 100) : null,
    boundaryPct: boundaryTotal ? Math.round((boundaryCovered / boundaryTotal) * 100) : null,
    enumCovered,
    enumTotal,
    boundaryCovered,
    boundaryTotal,
    byField,
  }
}
