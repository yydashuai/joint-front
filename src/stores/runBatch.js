import { defineStore } from 'pinia'
import { alerts, runHistory, testInterfaces } from '@/mock/seed-data'

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
const receiveBatchIdOf = (systemId, dateKey) => `receive-batch-${systemId}-${dateKey}`
const batchTypeLabel = (batchType) => batchType === 'receive' ? '接收批次' : '发送批次'

export const buildBatchScope = ({ scheme = null, interfaces = [] } = {}) => {
  const normalizedInterfaces = interfaces
    .filter(Boolean)
    .map((item) => ({
      id: item.id || item.interfaceId || '',
      name: item.name || item.iface || '未命名接口',
    }))
  const interfaceIds = [...new Set(normalizedInterfaces.map((item) => item.id).filter(Boolean))]
  const interfaceNames = [...new Set(normalizedInterfaces.map((item) => item.name).filter(Boolean))]
  const displayName = scheme?.name
    || (interfaceNames.length === 1
      ? interfaceNames[0]
      : interfaceNames.length > 1
        ? `${interfaceNames[0]}等${interfaceNames.length}个接口`
        : '未命名接口范围')
  return {
    schemeId: scheme?.id || '',
    schemeName: scheme?.name || '',
    interfaceIds,
    interfaceNames,
    displayName,
  }
}

const batchNameOf = (batchType, scope, startedAt) =>
  `${scope?.displayName || '未命名接口范围'} · ${batchTypeLabel(batchType)} · ${normalizeDateTime(startedAt).slice(0, 16)}`

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
  return map
})()

export const seedRunIdForAlert = (alert = {}, index = 0) => {
  const dateKey = normalizeDate(alert.capturedTime || seedExceptionCapturedTime(index))
  return receiveBatchIdOf(alert.systemId, dateKey)
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
    batchId: runId,
    batchType: 'send',
    status: 'completed',
    finishReason: 'natural',
    scope: buildBatchScope({ interfaces: stepResults.map((item) => ({ id: item.interfaceId, name: item.iface })) }),
    name: '',
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

const seedInterfaceOfAlert = (alert) =>
  testInterfaces.find((item) => item.systemId === alert.systemId && item.moduleId === alert.moduleId)
  || testInterfaces.find((item) => item.systemId === alert.systemId)
  || null

const seedReceiveBatches = () => {
  const groups = new Map()
  alerts.forEach((alert, index) => {
    const dateKey = normalizeDate(alert.capturedTime || seedExceptionCapturedTime(index))
    const id = receiveBatchIdOf(alert.systemId, dateKey)
    if (!groups.has(id)) groups.set(id, { id, systemId: alert.systemId, dateKey, alerts: [] })
    groups.get(id).alerts.push({ alert, index })
  })

  return [...groups.values()].map((group) => {
    const sortedAlerts = [...group.alerts].sort((a, b) =>
      String(a.alert.capturedTime || '').localeCompare(String(b.alert.capturedTime || ''))
    )
    const interfaceMap = new Map()
    sortedAlerts.forEach(({ alert }) => {
      const iface = seedInterfaceOfAlert(alert)
      const id = iface?.id || `${group.systemId}-${alert.iface}`
      if (!interfaceMap.has(id)) {
        interfaceMap.set(id, {
          id,
          name: iface?.name || alert.iface || '未命名接口',
          moduleId: alert.moduleId || iface?.moduleId || '',
        })
      }
    })
    const interfaces = [...interfaceMap.values()]
    const scope = buildBatchScope({ interfaces })
    const records = []
    let seq = 0
    interfaces.forEach((iface, ifaceIndex) => {
      const normalCount = 6 + ifaceIndex * 2
      for (let index = 0; index < normalCount; index += 1) {
        seq += 1
        records.push({
          id: `${group.id}-normal-${seq}`,
          kind: 'recv',
          seq,
          time: `09:${String(12 + ifaceIndex * 8 + index).padStart(2, '0')}:00`,
          interfaceId: iface.id,
          iface: iface.name,
          moduleId: iface.moduleId,
          systemId: group.systemId,
          transport: 'bin',
          byteLength: 24 + (index % 4) * 4,
          hex: '',
          verdict: { status: 'ok', tag: '正常解析', issues: [] },
          exceptionId: '',
          savedToDataset: false,
          forwardTarget: null,
        })
      }
    })

    const exceptions = sortedAlerts.map(({ alert, index }, alertIndex) => {
      const iface = seedInterfaceOfAlert(alert)
      const interfaceId = iface?.id || `${group.systemId}-${alert.iface}`
      const interfaceName = iface?.name || alert.iface || '未命名接口'
      const exception = {
        ...normalizeExceptionForBatch(alert, index),
        batchId: group.id,
        runId: group.id,
        interfaceId,
        iface: interfaceName,
        detail: {
          ruleMessage: alert.remark || '',
          fieldPath: alert.field || '',
        },
      }
      seq += 1
      const unparsed = alert.type === '无法解析'
      records.push({
        id: `${group.id}-abnormal-${alert.id}`,
        kind: 'recv',
        seq,
        time: String(alert.capturedTime || '').split(' ')[1] || `10:${String(alertIndex).padStart(2, '0')}:00`,
        interfaceId,
        iface: interfaceName,
        moduleId: alert.moduleId || iface?.moduleId || '',
        systemId: group.systemId,
        transport: 'bin',
        byteLength: unparsed ? 18 : 32,
        hex: '',
        verdict: {
          status: unparsed ? 'unparsed' : 'error',
          tag: alert.type,
          issues: [{ field: alert.field || '', message: alert.remark || '' }],
        },
        exceptionId: alert.id,
        savedToDataset: alertIndex % 2 === 0,
        forwardTarget: null,
      })
      return exception
    })

    const receiveRecords = records.filter((item) => item.kind === 'recv')
    const start = `${group.dateKey} 09:10:00`
    const finish = `${group.dateKey} 10:35:00`
    const summary = {
      totalReceived: receiveRecords.length,
      parsedCount: receiveRecords.filter((item) => item.verdict.status !== 'unparsed').length,
      normalCount: receiveRecords.filter((item) => item.verdict.status === 'ok').length,
      validationAbnormalCount: receiveRecords.filter((item) => item.verdict.status === 'error').length,
      unparsedCount: receiveRecords.filter((item) => item.verdict.status === 'unparsed').length,
      forwardedCount: 0,
      savedToDatasetCount: receiveRecords.filter((item) => item.savedToDataset).length,
      interfaceCount: interfaces.length,
      durationSeconds: 85 * 60,
    }
    return {
      id: group.id,
      batchId: group.id,
      runId: group.id,
      batchType: 'receive',
      status: 'completed',
      finishReason: 'terminated',
      scope,
      name: batchNameOf('receive', scope, start),
      systemId: group.systemId,
      dateKey: group.dateKey,
      tasks: interfaces.map((item) => ({
        moduleId: item.moduleId,
        moduleName: '',
        interfaceId: item.id,
        iface: item.name,
      })),
      taskIds: [],
      time: start,
      startedAt: start,
      finishedAt: finish,
      durationText: `${summary.durationSeconds}s`,
      state: 'done',
      result: '已完成',
      taskCreator: '接收监控示例',
      summary,
      records,
      stepResults: [],
      exceptions,
    }
  })
}

export const seedRunBatches = () => [...seedGroups.values()]
  .map((group) => {
    const batch = buildBatch({ ...group, state: 'done' })
    batch.name = batchNameOf(batch.batchType, batch.scope, batch.startedAt)
    return batch
  })
  .concat(seedReceiveBatches())
  .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))

const rowsOfBatch = (batch) => (batch.stepResults || []).map((step) => {
  const executionTime = batch.summary?.executionTime || 1
  return {
    id: `${batch.runId}-${step.taskId || step.interfaceId || step.iface}`,
    runId: batch.runId,
    batchId: batch.id,
    batchType: batch.batchType || 'send',
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
    byId: (state) => (batchId) => state.batches.find((item) =>
      String(item.batchId || item.runId || item.id) === String(batchId)
      || String(item.id) === String(batchId)
    ) || null,
    ofSystem: (state) => (systemId) => (systemId == null ? state.batches : state.batches.filter((item) => item.systemId === systemId)),
    reportable: (state) => state.batches.filter((item) =>
      (item.status === 'completed' || ['done', 'stopped'].includes(item.state))
      && item.finishedAt
    ),
    statRows: (state) => state.batches
      .filter((item) => (item.batchType || 'send') === 'send')
      .flatMap(rowsOfBatch),
  },

  actions: {
    upsertBatch(batch) {
      const id = batch.batchId || batch.runId || batch.id
      const next = {
        batchType: 'send',
        status: batch.state === 'running' ? 'running' : 'completed',
        finishReason: '',
        scope: buildBatchScope(),
        ...batch,
        id,
        batchId: id,
        runId: id,
      }
      const index = this.batches.findIndex((item) => String(item.batchId || item.runId || item.id) === String(id))
      if (index >= 0) this.batches.splice(index, 1, { ...this.batches[index], ...next })
      else this.batches.unshift(next)
      return next
    },

    startBatch({
      batchId,
      runId,
      batchType = 'send',
      systemId,
      scope,
      tasks = [],
      records = [],
      startedAt,
      config = {},
    }) {
      const id = batchId || runId
      const normalizedScope = scope?.displayName
        ? { ...scope }
        : buildBatchScope({ interfaces: tasks.map((item) => ({ id: item.interfaceId, name: item.iface })) })
      return this.upsertBatch({
        id,
        batchId: id,
        runId: id,
        batchType,
        status: 'running',
        finishReason: '',
        scope: normalizedScope,
        name: batchNameOf(batchType, normalizedScope, startedAt),
        systemId,
        dateKey: normalizeDate(startedAt),
        tasks,
        taskIds: tasks.map((item) => item.taskId).filter(Boolean),
        time: startedAt,
        startedAt,
        finishedAt: '',
        durationText: '',
        state: 'running',
        result: batchType === 'receive' ? '监听中' : '发送中',
        taskCreator: batchType === 'receive' ? '接收监控' : '发送监控',
        config: { ...config },
        summary: batchType === 'receive'
          ? {
              totalReceived: 0,
              parsedCount: 0,
              normalCount: 0,
              validationAbnormalCount: 0,
              unparsedCount: 0,
              forwardedCount: 0,
              savedToDatasetCount: 0,
              interfaceCount: normalizedScope.interfaceIds.length,
              durationSeconds: 0,
            }
          : {
              ...buildSummary([]),
              plannedCount: 0,
              sentCount: 0,
              unsentCount: 0,
              interfaceCount: normalizedScope.interfaceIds.length,
              datasetCount: 0,
              durationSeconds: 0,
            },
        records,
        stepResults: [],
        exceptions: [],
      })
    },

    updateBatchStatus(batchId, status) {
      const existing = this.byId(batchId)
      if (!existing || existing.status === 'completed') return existing
      const state = status === 'paused' ? 'paused' : 'running'
      return this.upsertBatch({
        ...existing,
        status,
        state,
        result: status === 'paused'
          ? '已暂停'
          : existing.batchType === 'receive' ? '监听中' : '发送中',
      })
    },

    updateBatchScope(batchId, scope) {
      const existing = this.byId(batchId)
      if (!existing || existing.status === 'completed' || !scope?.displayName) return existing
      return this.upsertBatch({
        ...existing,
        scope: { ...scope },
        name: batchNameOf(existing.batchType || 'send', scope, existing.startedAt),
      })
    },

    finishBatch(batchId, patch = {}) {
      const existing = this.byId(batchId)
      if (!existing) return null
      const stepResults = patch.stepResults || existing.stepResults || []
      const rows = stepResults.map((step) => ({
        ...step,
        executionTime: patch.summary?.executionTime || existing.summary?.executionTime || 1,
      }))
      const summary = patch.summary || buildSummary(rows)
      const tasks = (patch.tasks || existing.tasks || stepResults).map((item) => ({
        ...item,
        taskId: item.taskId,
        taskName: item.taskName,
        moduleId: item.moduleId,
        moduleName: item.moduleName,
        interfaceId: item.interfaceId,
        iface: item.iface,
      }))
      return this.upsertBatch({
        ...existing,
        ...patch,
        status: 'completed',
        state: patch.state || 'done',
        finishReason: patch.finishReason || existing.finishReason || 'natural',
        result: '已完成',
        summary,
        stepResults,
        tasks,
        taskIds: tasks.map((item) => item.taskId).filter(Boolean),
      })
    },
  },
})
