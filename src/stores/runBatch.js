import { defineStore } from 'pinia'
import { alerts, runHistory, systems } from '@/mock/seed-data'

const round = (n) => Math.round(n)
const sum = (arr, pick = (x) => x) => arr.reduce((total, item) => total + (pick(item) || 0), 0)
const pct = (a, b) => (b ? round((a / b) * 100) : 0)
const abnormalOf = (row) => row.abnormal ?? ((row.failed || 0) + (row.error || 0))
const mergeTypeCounts = (rows = []) => rows.reduce((acc, row) => {
  Object.entries(row.abnormalTypes || {}).forEach(([type, count]) => {
    acc[type] = (acc[type] || 0) + (count || 0)
  })
  return acc
}, {})

const normalizeDate = (text = '') => String(text).trim().split(' ')[0].replace(/\//g, '-')
const normalizeDateTime = (text = '') => String(text).trim().replace(/\//g, '-')
const batchIdOf = (systemId, dateKey) => `batch-${systemId}-${dateKey}`
const systemNameOf = (systemId) => systems.find((item) => item.id === systemId)?.name || systemId || '未知系统'

export const seedExceptionCapturedTime = (index) =>
  `2026-06-${19 + (index % 7)} ${String(8 + (index % 16)).padStart(2, '0')}:${String(10 + (index % 50)).padStart(2, '0')}:00`

const seedGroups = (() => {
  const map = new Map()
  runHistory.forEach((row) => {
    const dateKey = normalizeDate(row.dateKey || row.startedAt)
    const key = batchIdOf(row.systemId, dateKey)
    if (!map.has(key)) map.set(key, { runId: key, systemId: row.systemId, dateKey, rows: [] })
    map.get(key).rows.push(row)
  })
  const historySystems = new Set([...map.values()].map((group) => group.systemId))
  alerts.forEach((alert, index) => {
    if (historySystems.has(alert.systemId)) return
    const dateKey = normalizeDate(alert.capturedTime || seedExceptionCapturedTime(index))
    const key = batchIdOf(alert.systemId, dateKey)
    if (!map.has(key)) map.set(key, { runId: key, systemId: alert.systemId, dateKey, rows: [] })
    map.get(key).rows.push({
      id: `seedrun-alert-${alert.id}`,
      systemId: alert.systemId,
      moduleId: alert.moduleId || '',
      moduleName: '',
      taskId: '',
      taskName: `${alert.iface || '异常接口'} 联试`,
      interfaceId: '',
      iface: alert.iface || '异常接口',
      proto: '',
      startedAt: `${dateKey} 09:00:00`,
      finishedAt: `${dateKey} 09:00:30`,
      dateKey,
      total: 1,
      success: 1,
      abnormal: 0,
      abnormalTypes: {},
      failed: 0,
      error: 0,
      avgMs: 100,
      durations: [100],
      executionTime: 1,
      rps: 1,
    })
  })
  return map
})()

export const seedRunIdForAlert = (alert = {}, index = 0) => {
  const dateKey = normalizeDate(alert.capturedTime || seedExceptionCapturedTime(index))
  const exact = batchIdOf(alert.systemId, dateKey)
  if (seedGroups.has(exact)) return exact
  const firstSameSystem = [...seedGroups.values()].find((group) => group.systemId === alert.systemId)
  return firstSameSystem?.runId || exact
}

const buildSummary = (rows = []) => {
  const totalRequests = sum(rows, (row) => row.total)
  const successRequests = sum(rows, (row) => row.success)
  const abnormalRequests = sum(rows, abnormalOf)
  const durations = rows.flatMap((row) => row.durations || []).filter((item) => item > 0)
  const avgResponseTime = durations.length ? round(sum(durations) / durations.length) : 0
  const sorted = [...durations].sort((a, b) => a - b)
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : avgResponseTime
  const executionTime = Math.max(1, sum(rows, (row) => row.executionTime))
  return {
    totalRequests,
    successRequests,
    abnormalRequests,
    failedRequests: abnormalRequests,
    errorRequests: 0,
    abnormalTypes: mergeTypeCounts(rows),
    avgResponseTime,
    p95,
    passRate: pct(successRequests, totalRequests),
    executionTime,
  }
}

const normalizeStep = (row) => ({
  taskId: row.taskId || '',
  taskName: row.taskName || `${row.iface} 联试`,
  systemId: row.systemId || '',
  moduleId: row.moduleId || '',
  moduleName: row.moduleName || '',
  interfaceId: row.interfaceId || '',
  iface: row.iface || '',
  proto: row.proto || '',
  total: row.total || 0,
  success: row.success || 0,
  abnormal: abnormalOf(row),
  abnormalTypes: row.abnormalTypes || {},
  failed: abnormalOf(row),
  error: 0,
  avgMs: row.avgMs || 0,
  durations: row.durations || [],
  result: abnormalOf(row) > 0 ? '异常' : '成功',
  traces: row.traces || [],
})

const normalizeExceptionForBatch = (alert, index) => ({
  id: alert.id,
  type: alert.type,
  level: alert.level || '中',
  time: alert.capturedTime || seedExceptionCapturedTime(index),
  capturedTime: alert.capturedTime || seedExceptionCapturedTime(index),
  iface: alert.iface || '未命名接口',
  message: alert.remark || '',
  remark: alert.remark || '',
  systemId: alert.systemId || '',
  moduleId: alert.moduleId || '',
  runId: seedRunIdForAlert(alert, index),
  taskId: alert.taskId || '',
})

const applyExceptionsToSteps = (steps = [], exceptions = []) => {
  const next = steps.map((step) => ({
    ...step,
    abnormal: 0,
    abnormalTypes: {},
    failed: 0,
    error: 0,
    result: '成功',
  }))
  if (!next.length) return next
  exceptions.forEach((exception, index) => {
    const matchedIndex = next.findIndex((step) => step.moduleId && step.moduleId === exception.moduleId)
    const target = next[matchedIndex >= 0 ? matchedIndex : index % next.length]
    target.abnormal += 1
    target.failed = target.abnormal
    target.success = Math.max(0, (target.total || 0) - target.abnormal)
    target.abnormalTypes[exception.type] = (target.abnormalTypes[exception.type] || 0) + 1
    target.result = '异常'
  })
  return next
}

const buildBatch = ({ runId, systemId, dateKey, rows, state = 'done', startedAt, finishedAt }) => {
  const sortedRows = [...rows].sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
  const exceptions = alerts
    .map(normalizeExceptionForBatch)
    .filter((item) => item.runId === runId)
  const stepResults = applyExceptionsToSteps(sortedRows.map(normalizeStep), exceptions)
  const summary = buildSummary(stepResults)
  const start = startedAt || sortedRows[0]?.startedAt || `${dateKey} 09:00:00`
  const finish = finishedAt || sortedRows.at(-1)?.finishedAt || start
  const result = summary.abnormalRequests > 0 || exceptions.length ? '存在异常' : '成功'
  return {
    id: runId,
    runId,
    name: `${systemNameOf(systemId)} ${normalizeDateTime(start)} 联试批次`,
    systemId,
    dateKey,
    tasks: stepResults.map((item) => ({
      taskId: item.taskId,
      taskName: item.taskName,
      moduleId: item.moduleId,
      moduleName: item.moduleName,
      interfaceId: item.interfaceId,
      iface: item.iface,
    })),
    taskIds: stepResults.map((item) => item.taskId).filter(Boolean),
    time: start,
    startedAt: start,
    finishedAt: finish,
    durationText: `${summary.executionTime}s`,
    state,
    result,
    taskCreator: '系统种子数据',
    summary,
    stepResults,
    exceptions,
  }
}

export const seedRunBatches = () => [...seedGroups.values()]
  .map((group) => buildBatch({ ...group, state: 'done' }))
  .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))

const rowsOfBatch = (batch) => (batch.stepResults || []).map((step) => {
  const executionTime = batch.summary?.executionTime || 1
  return {
    id: `${batch.runId}-${step.taskId || step.interfaceId || step.iface}`,
    runId: batch.runId,
    batchName: batch.name,
    state: batch.state,
    systemId: batch.systemId,
    moduleId: step.moduleId,
    moduleName: step.moduleName,
    taskId: step.taskId,
    taskName: step.taskName,
    interfaceId: step.interfaceId,
    iface: step.iface,
    proto: step.proto,
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
    dateKey: batch.dateKey || normalizeDate(batch.startedAt),
    total: step.total,
    success: step.success,
    abnormal: step.abnormal ?? ((step.failed || 0) + (step.error || 0)),
    abnormalTypes: step.abnormalTypes || {},
    failed: step.failed,
    error: step.error,
    avgMs: step.avgMs,
    durations: step.durations?.length ? step.durations : [step.avgMs || 0],
    executionTime,
    rps: Number(((step.total || 0) / executionTime).toFixed(1)),
  }
})

export const useRunBatchStore = defineStore('runBatch', {
  state: () => ({
    batches: seedRunBatches(),
  }),

  getters: {
    byId: (state) => (runId) => state.batches.find((item) => String(item.runId) === String(runId) || String(item.id) === String(runId)) || null,
    ofSystem: (state) => (systemId) => (systemId == null ? state.batches : state.batches.filter((item) => item.systemId === systemId)),
    statRows: (state) => state.batches.flatMap(rowsOfBatch),
  },

  actions: {
    upsertBatch(batch) {
      const id = batch.runId || batch.id
      const next = { ...batch, id, runId: id }
      const index = this.batches.findIndex((item) => item.runId === id)
      if (index >= 0) this.batches.splice(index, 1, { ...this.batches[index], ...next })
      else this.batches.unshift(next)
      return next
    },

    startBatch({ runId, systemId, tasks = [], startedAt, config = {} }) {
      return this.upsertBatch({
        id: runId,
        runId,
        name: `${systemNameOf(systemId)} ${normalizeDateTime(startedAt)} 联试批次`,
        systemId,
        dateKey: normalizeDate(startedAt),
        tasks,
        taskIds: tasks.map((item) => item.taskId).filter(Boolean),
        time: startedAt,
        startedAt,
        finishedAt: '',
        durationText: '',
        state: 'running',
        result: '执行中',
        taskCreator: '执行编排',
        config: { ...config },
        summary: buildSummary([]),
        stepResults: [],
        exceptions: [],
      })
    },

    finishBatch(runId, patch = {}) {
      const existing = this.byId(runId)
      if (!existing) return null
      const stepResults = patch.stepResults || existing.stepResults || []
      const rows = stepResults.map((step) => ({
        ...step,
        executionTime: patch.summary?.executionTime || existing.summary?.executionTime || 1,
      }))
      const summary = patch.summary || buildSummary(rows)
      return this.upsertBatch({
        ...existing,
        ...patch,
        state: patch.state || 'done',
        result: patch.result || (summary.abnormalRequests > 0 ? '存在异常' : '成功'),
        summary,
        stepResults,
        tasks: (patch.tasks || existing.tasks || stepResults).map((item) => ({
          taskId: item.taskId,
          taskName: item.taskName,
          moduleId: item.moduleId,
          moduleName: item.moduleName,
          interfaceId: item.interfaceId,
          iface: item.iface,
        })),
      })
    },
  },
})
