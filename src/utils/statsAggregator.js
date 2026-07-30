/**
 * 统计与可视化 —— 数据聚合层（纯函数 + 只读 store 访问）
 *
 * 原则：所有指标都能在真实数据结构里找到来源，绝不杜撰。
 *   - 执行 / 发送 / 性能 / 接口：来自统一执行批次 store（种子批次 + 执行编排实时批次）
 *   - 异常：来自 exceptionStore（种子 alerts + 执行实时捕捉）
 *   - 接口覆盖：来自 protocolStore.testInterfaces（独立接口总数）
 * 禁列（无数据源）：被测系统 CPU/内存/带宽、业务正确率、真实并发用户、SLA、真实链路拓扑时延。
 */
import { useExceptionStore } from '@/stores/exception'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useRunBatchStore } from '@/stores/runBatch'
import { RULE_TYPES } from '@/utils/ruleEngine'

/* ========== 工具 ========== */
const sum = (arr, pick = (x) => x) => arr.reduce((a, b) => a + (pick(b) || 0), 0)
const round = (n) => Math.round(n)
const pct = (a, b) => (b ? round((a / b) * 100) : 0)
const abnormalOf = (row = {}) => row.abnormal ?? ((row.failed || 0) + (row.error || 0))
const rulePalette = ['var(--el-color-danger)', 'var(--el-color-warning)', '#9254de', '#36a2eb', '#13c2c2', '#ff9f40', '#73d13d', '#f759ab']

/** 把各种时间文本归一为 YYYY-MM-DD */
function normalizeDate(text) {
  if (!text) return ''
  const head = String(text).trim().split(' ')[0]
  if (head.includes('-')) return head
  if (head.includes('/')) {
    const [y, m, d] = head.split('/')
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return head
}

/** 时间范围预设 → 截止日期（含）*/
function cutoffOf(range) {
  if (!range || range === 'all') return ''
  const days = range === '1d' ? 0 : range === '3d' ? 2 : 6
  const d = new Date()
  d.setDate(d.getDate() - days)
  // 锚定到种子数据所在日期窗口（演示数据截止 2026-06-25）
  const anchor = new Date('2026-06-25')
  anchor.setDate(anchor.getDate() - days)
  return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`
}

/* ========== 归一化执行记录（种子 + 实时） ========== */
function allRuns() {
  return useRunBatchStore().statRows
}

/** 按筛选条件过滤执行记录 */
export function getRuns(filters = {}) {
  const cutoff = cutoffOf(filters.timeRange)
  return allRuns().filter((r) => {
    if (filters.runId && r.runId !== filters.runId && r.id !== filters.runId) return false
    if (filters.systemId && r.systemId !== filters.systemId) return false
    if (filters.moduleId && r.moduleId !== filters.moduleId) return false
    if (filters.interfaceId && r.interfaceId !== filters.interfaceId) return false
    if (cutoff && normalizeDate(r.dateKey) < cutoff) return false
    return true
  })
}

/** 异常筛选（注意：异常无 interfaceId，故不按接口过滤） */
export function getExceptions(filters = {}) {
  const exc = useExceptionStore()
  const cutoff = cutoffOf(filters.timeRange)
  return exc.exceptions.filter((e) => {
    if (filters.runId && e.runId !== filters.runId) return false
    if (filters.systemId && e.systemId !== filters.systemId) return false
    if (filters.moduleId && e.moduleId !== filters.moduleId) return false
    if (cutoff && normalizeDate(e.capturedTime) < cutoff) return false
    return true
  })
}

/* ========== 分组辅助 ========== */
function groupBy(arr, keyFn) {
  const map = new Map()
  arr.forEach((item) => {
    const k = keyFn(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  })
  return map
}

function dayBuckets(runs, valueFn) {
  const days = [...new Set(allRuns().map((r) => normalizeDate(r.dateKey)))].sort()
  const map = groupBy(runs, (r) => normalizeDate(r.dateKey))
  return days
    .filter((d) => map.has(d))
    .map((d) => ({ x: d.slice(5), y: valueFn(map.get(d)) }))
}

const moduleNameOf = (moduleId) => {
  const conn = useConnectionStore()
  return conn.nodes.find((n) => n.id === moduleId)?.name || '未知模块'
}

function abnormalTypeBars(runs) {
  const counts = {}
  runs.forEach((row) => {
    const typedTotal = sum(Object.values(row.abnormalTypes || {}))
    if (typedTotal) {
      Object.entries(row.abnormalTypes).forEach(([label, value]) => {
        counts[label] = (counts[label] || 0) + (value || 0)
      })
      return
    }
    const abnormal = abnormalOf(row)
    if (abnormal) counts['响应超时'] = (counts['响应超时'] || 0) + abnormal
  })
  return RULE_TYPES
    .map((type, i) => ({ label: type.label, value: counts[type.label] || 0, color: rulePalette[i % rulePalette.length] }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
}

/* ========== 维度聚合 ========== */
export function aggregateOverview(filters = {}) {
  const runs = getRuns(filters)
  const exc = getExceptions(filters)
  const total = sum(runs, (r) => r.total)
  const success = sum(runs, (r) => r.success)
  const abnormal = sum(runs, abnormalOf)
  const allDur = runs.flatMap((r) => r.durations || [])
  const pending = exc.filter((e) => e.state === '待处理' || e.state === '处理中').length
  return {
    runCount: runs.length,
    totalRequests: total,
    passRate: pct(success, total),
    avgResponseTime: allDur.length ? round(sum(allDur) / allDur.length) : 0,
    exceptionTotal: exc.length,
    pending,
    composition: [
      { label: '成功', value: success, color: 'var(--el-color-success)' },
      { label: '异常', value: abnormal, color: 'var(--el-color-danger)' },
    ],
    passRateTrend: dayBuckets(runs, (rs) => pct(sum(rs, (r) => r.success), sum(rs, (r) => r.total))),
  }
}

export function aggregateExecution(filters = {}) {
  const runs = getRuns(filters)
  const success = sum(runs, (r) => r.success)
  const abnormal = sum(runs, abnormalOf)
  const total = success + abnormal
  const durations = runs.flatMap((r) => r.durations || []).filter((d) => d > 0)
  const ifaceGroup = groupBy(runs, (r) => r.iface)
  return {
    kpis: {
      runCount: runs.length,
      ifaceCount: new Set(runs.map((r) => r.interfaceId)).size,
      passRate: pct(success, total),
      avgRunTime: durations.length ? round(sum(durations) / durations.length) : 0,
    },
    composition: [
      { label: '成功', value: success, color: 'var(--el-color-success)' },
      { label: '异常', value: abnormal, color: 'var(--el-color-danger)' },
    ],
    runsPerDay: dayBuckets(runs, (rs) => rs.length),
    passRateTrend: dayBuckets(runs, (rs) => pct(sum(rs, (r) => r.success), sum(rs, (r) => r.total))),
    runsByIface: [...ifaceGroup.entries()]
      .map(([label, rs]) => ({ label, value: rs.length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  }
}

export function aggregateRequest(filters = {}) {
  const runs = getRuns(filters)
  const total = sum(runs, (r) => r.total)
  const success = sum(runs, (r) => r.success)
  const abnormal = sum(runs, abnormalOf)
  const ifaceGroup = groupBy(runs, (r) => r.iface)
  return {
    kpis: {
      total,
      success,
      abnormal,
      successRate: pct(success, total),
    },
    requestByDay: dayBuckets(runs, (rs) => sum(rs, (r) => r.total)),
    resultStack: dayBucketsStack(runs),
    requestByIface: [...ifaceGroup.entries()]
      .map(([label, rs]) => ({ label, value: sum(rs, (r) => r.total) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    failReasons: abnormalTypeBars(runs),
  }
}

/** 成功/异常按天堆叠 */
function dayBucketsStack(runs) {
  const days = [...new Set(allRuns().map((r) => normalizeDate(r.dateKey)))].sort()
  const map = groupBy(runs, (r) => normalizeDate(r.dateKey))
  return days
    .filter((d) => map.has(d))
    .map((d) => {
      const rs = map.get(d)
      return {
        label: d.slice(5),
        parts: [
          { value: sum(rs, (r) => r.success), color: 'var(--el-color-success)', name: '成功' },
          { value: sum(rs, abnormalOf), color: 'var(--el-color-danger)', name: '异常' },
        ],
      }
    })
}

export function aggregatePerformance(filters = {}) {
  const runs = getRuns(filters)
  const durations = runs.flatMap((r) => r.durations || []).filter((d) => d > 0)
  const sorted = [...durations].sort((a, b) => a - b)
  const percentile = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0)
  const ifaceGroup = groupBy(runs, (r) => r.iface)
  const avgRps = runs.length ? Number((sum(runs, (r) => r.rps) / runs.length).toFixed(1)) : 0
  return {
    kpis: {
      avgMs: sorted.length ? round(sum(sorted) / sorted.length) : 0,
      p90: percentile(90),
      p95: percentile(95),
      maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
      avgRps,
    },
    histogram: sorted,
    latencyTrend: dayBuckets(runs, (rs) => {
      const ds = rs.flatMap((r) => r.durations || [])
      return ds.length ? round(sum(ds) / ds.length) : 0
    }),
    throughputTrend: dayBuckets(runs, (rs) => (rs.length ? Number((sum(rs, (r) => r.rps) / rs.length).toFixed(1)) : 0)),
    latencyByIface: [...ifaceGroup.entries()]
      .map(([label, rs]) => {
        const ds = rs.flatMap((r) => r.durations || [])
        return { label, value: ds.length ? round(sum(ds) / ds.length) : 0 }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  }
}

export function aggregateException(filters = {}) {
  const exc = getExceptions(filters)
  const total = exc.length
  const pending = exc.filter((e) => e.state === '待处理' || e.state === '处理中').length
  const high = exc.filter((e) => e.level === '高').length
  const byType = groupBy(exc, (e) => e.type)
  const byLevel = groupBy(exc, (e) => e.level)
  const byState = groupBy(exc, (e) => e.state)
  const byModule = groupBy(exc, (e) => e.moduleId)
  const typePalette = ['var(--el-color-danger)', 'var(--el-color-warning)', '#9254de', '#36a2eb', '#13c2c2', '#ff9f40', '#73d13d', '#f759ab']
  const levelColor = { 高: 'var(--el-color-danger)', 中: 'var(--el-color-warning)', 低: 'var(--el-color-info)' }
  return {
    kpis: {
      total,
      pending,
      resolvedRate: pct(total - pending, total),
      high,
    },
    byType: [...byType.entries()]
      .map(([label, items], i) => ({ label, value: items.length, color: typePalette[i % typePalette.length] }))
      .sort((a, b) => b.value - a.value),
    byLevel: ['高', '中', '低']
      .filter((l) => byLevel.has(l))
      .map((l) => ({ label: l, value: byLevel.get(l).length, color: levelColor[l] })),
    byState: [...byState.entries()].map(([label, items]) => ({ label, value: items.length })),
    byModule: [...byModule.entries()]
      .map(([moduleId, items]) => ({ label: moduleNameOf(moduleId), value: items.length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    trend: (() => {
      const days = [...new Set(exc.map((e) => normalizeDate(e.capturedTime)))].sort()
      const map = groupBy(exc, (e) => normalizeDate(e.capturedTime))
      return days.map((d) => ({ x: d.slice(5), y: map.get(d).length }))
    })(),
  }
}

export function aggregateInterface(filters = {}) {
  const proto = useProtocolStore()
  const runs = getRuns(filters)
  // 接口总数（受系统/模块过滤）
  const allIfaces = proto.testInterfaces.filter((i) => {
    if (filters.systemId && i.systemId !== filters.systemId) return false
    if (filters.moduleId && i.moduleId !== filters.moduleId) return false
    return true
  })
  const testedIds = new Set(runs.map((r) => r.interfaceId))
  const ifaceGroup = groupBy(runs, (r) => r.interfaceId)
  const ranking = [...ifaceGroup.entries()].map(([interfaceId, rs]) => {
    const total = sum(rs, (r) => r.total)
    const success = sum(rs, (r) => r.success)
    const abnormal = sum(rs, abnormalOf)
    const ds = rs.flatMap((r) => r.durations || [])
    return {
      interfaceId,
      iface: rs[0].iface,
      module: rs[0].moduleName,
      req: total,
      successRate: pct(success, total),
      avgMs: ds.length ? round(sum(ds) / ds.length) : 0,
      abnormal,
      errors: abnormal,
    }
  }).sort((a, b) => b.req - a.req)
  return {
    kpis: {
      tested: testedIds.size,
      totalIfaces: allIfaces.length,
      coverage: pct(testedIds.size, allIfaces.length),
      problemIfaces: ranking.filter((r) => r.abnormal > 0).length,
    },
    coverageDonut: [
      { label: '已测', value: testedIds.size, color: 'var(--el-color-primary)' },
      { label: '未测', value: Math.max(0, allIfaces.length - testedIds.size), color: 'var(--el-fill-color-darker)' },
    ],
    topErrorIfaces: [...ranking]
      .filter((r) => r.abnormal > 0)
      .sort((a, b) => b.abnormal - a.abnormal)
      .slice(0, 8)
      .map((r) => ({ label: r.iface, value: r.abnormal })),
    ranking,
  }
}

export function aggregateTrend(filters = {}) {
  const runs = getRuns(filters)
  const exc = getExceptions(filters)
  // 综合趋势：发送量 / 通过率 / 异常记录数 随时间
  const reqTrend = dayBuckets(runs, (rs) => sum(rs, (r) => r.total))
  const passTrend = dayBuckets(runs, (rs) => pct(sum(rs, (r) => r.success), sum(rs, (r) => r.total)))
  const excDays = [...new Set(exc.map((e) => normalizeDate(e.capturedTime)))].sort()
  const excMap = groupBy(exc, (e) => normalizeDate(e.capturedTime))
  const excTrend = excDays.map((d) => ({ x: d.slice(5), y: excMap.get(d).length }))
  // 各系统横向对比
  const sysGroup = groupBy(runs, (r) => r.systemId)
  const systemCompare = [...sysGroup.entries()].map(([systemId, rs]) => {
    const total = sum(rs, (r) => r.total)
    const success = sum(rs, (r) => r.success)
    return { systemId, passRate: pct(success, total), runs: rs.length, total }
  })
  return { reqTrend, passTrend, excTrend, systemCompare }
}

/* ========== 导出 ========== */
export function exportRows(category, filters = {}) {
  if (category === 'interface') {
    return aggregateInterface(filters).ranking.map((r) => ({
      接口: r.iface, 模块: r.module, 发送数: r.req, 成功率: `${r.successRate}%`, 平均时延ms: r.avgMs, 发送异常: r.abnormal,
    }))
  }
  if (category === 'exception') {
    return getExceptions(filters).map((e) => ({
      时间: e.capturedTime, 类型: e.type, 级别: e.level, 状态: e.state, 接口: e.iface, 来源: e.source, 备注: e.remark,
    }))
  }
  // 默认导出执行记录明细
  return getRuns(filters).map((r) => ({
    时间: r.startedAt, 系统: r.systemId, 模块: r.moduleName, 接口: r.iface,
    发送数: r.total, 成功: r.success, 异常: abnormalOf(r), 平均时延ms: r.avgMs, 吞吐rps: r.rps,
  }))
}

export function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}
