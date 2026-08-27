/**
 * 统计与可视化 —— 客观数据聚合层
 *
 * 发送与接收是两条独立通道：
 * - 发送侧只统计执行批次、任务执行项、已发送报文和涉及接口；
 * - 接收侧只统计当前监听会话收到的数据及解析/校验分类；
 * - 异常样本、接口使用和测试数据资产分别统计。
 *
 * 不计算请求/响应通过率、响应时延、待处理异常或处置效率。
 */
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { useProtocolStore } from '@/stores/protocol'
import { useReceptionStore } from '@/stores/reception'
import { useRunBatchStore } from '@/stores/runBatch'
import { useTestDataStore } from '@/stores/testData'

const SEND_COLOR = '#2f6bff'
const RECEIVE_COLOR = '#00a7b5'
const EXCEPTION_COLOR = '#d97706'
const UNPARSED_COLOR = '#dc2626'
const ASSET_COLOR = '#6d5bd0'

const sum = (arr, pick = (item) => item) => arr.reduce((total, item) => total + Number(pick(item) || 0), 0)
const uniqueCount = (arr) => new Set(arr.filter((item) => item !== '' && item != null).map(String)).size

function normalizeDate(text) {
  if (!text) return ''
  const head = String(text).trim().split(' ')[0]
  if (head.includes('-')) return head
  if (head.includes('/')) {
    const [year, month, day] = head.split('/')
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return head
}

function cutoffOf(range) {
  if (!range || range === 'all') return ''
  const days = range === '1d' ? 0 : range === '3d' ? 2 : 6
  const anchor = new Date('2026-06-25')
  anchor.setDate(anchor.getDate() - days)
  return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`
}

function groupBy(items, keyOf) {
  const groups = new Map()
  items.forEach((item) => {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  return groups
}

function countBars(items, keyOf, labelOf = (key) => key, color = SEND_COLOR, limit = 8) {
  return [...groupBy(items, keyOf).entries()]
    .map(([key, rows]) => ({ label: labelOf(key), value: rows.length, color }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function sumBars(items, keyOf, valueOf, labelOf = (key) => key, color = SEND_COLOR, limit = 8) {
  return [...groupBy(items, keyOf).entries()]
    .map(([key, rows]) => ({ label: labelOf(key), value: sum(rows, valueOf), color }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function trendOf(items, dateOf, valueOf = () => 1) {
  const groups = groupBy(items.filter((item) => normalizeDate(dateOf(item))), (item) => normalizeDate(dateOf(item)))
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({ x: date.slice(5), y: sum(rows, valueOf) }))
}

const moduleNameOf = (moduleId) => useConnectionStore().nodes.find((item) => item.id === moduleId)?.name || '未归属链路节点'
/** 接口名（按接口 id 解析；未匹配时用报文/接口名字段兜底） */
const interfaceNameOf = (id, fallback = '') => {
  if (id == null || id === '') return fallback
  const iface = useProtocolStore().testInterfaces.find((item) => String(item.id) === String(id))
  return iface?.name || fallback
}

export function getRuns(filters = {}) {
  const cutoff = cutoffOf(filters.timeRange)
  return useRunBatchStore().statRows.filter((row) => {
    if (filters.runId && String(row.runId || row.id) !== String(filters.runId)) return false
    if (filters.systemId && row.systemId !== filters.systemId) return false
    if (filters.moduleId && row.moduleId !== filters.moduleId) return false
    if (filters.interfaceId && String(row.interfaceId) !== String(filters.interfaceId)) return false
    if (cutoff && normalizeDate(row.dateKey || row.startedAt) < cutoff) return false
    return true
  })
}

export function getBatches(filters = {}) {
  const cutoff = cutoffOf(filters.timeRange)
  const batchType = filters.batchType || 'send'
  return useRunBatchStore().batches.filter((batch) => {
    if ((batch.batchType || 'send') !== batchType) return false
    if (filters.runId && String(batch.runId || batch.id) !== String(filters.runId)) return false
    if (filters.systemId && batch.systemId !== filters.systemId) return false
    if (filters.moduleId && !(batch.tasks || batch.stepResults || []).some((item) => item.moduleId === filters.moduleId)) return false
    if (filters.interfaceId && !(batch.tasks || batch.stepResults || []).some((item) => String(item.interfaceId) === String(filters.interfaceId))) return false
    if (cutoff && normalizeDate(batch.dateKey || batch.startedAt) < cutoff) return false
    return true
  })
}

export function getExceptions(filters = {}) {
  const cutoff = cutoffOf(filters.timeRange)
  const selectedInterface = filters.interfaceId
    ? useProtocolStore().testInterfaces.find((item) => String(item.id) === String(filters.interfaceId))
    : null
  return useExceptionStore().exceptions.filter((item) => {
    if (filters.runId && String(item.batchId || item.runId) !== String(filters.runId)) return false
    if (filters.systemId && item.systemId !== filters.systemId) return false
    if (filters.moduleId && item.moduleId !== filters.moduleId) return false
    if (
      filters.interfaceId
      && String(item.interfaceId) !== String(filters.interfaceId)
      && item.iface !== selectedInterface?.name
    ) return false
    if (cutoff && normalizeDate(item.capturedTime) < cutoff) return false
    return true
  })
}

export function getReceptionEntries(filters = {}) {
  return useReceptionStore().recvQueue.filter((item) => {
    if (item.kind !== 'recv') return false
    if (filters.systemId && item.systemId !== filters.systemId) return false
    if (filters.moduleId && item.moduleId !== filters.moduleId) return false
    if (filters.interfaceId && String(item.interfaceId) !== String(filters.interfaceId)) return false
    return true
  })
}

function getDatasets(filters = {}) {
  const moduleName = filters.moduleId ? moduleNameOf(filters.moduleId) : ''
  return useTestDataStore().datasets.filter((dataset) => {
    if (filters.systemId && dataset.systemId !== filters.systemId) return false
    if (moduleName && dataset.moduleName !== moduleName) return false
    if (filters.interfaceId && String(dataset.linkedInterface || '') !== String(filters.interfaceId)) {
      const iface = useProtocolStore().testInterfaces.find((item) => String(item.id) === String(filters.interfaceId))
      if (dataset.linkedInterface !== iface?.name) return false
    }
    return true
  })
}

function getFiles(filters = {}) {
  const moduleName = filters.moduleId ? moduleNameOf(filters.moduleId) : ''
  return useTestDataStore().files.filter((file) => {
    if (filters.systemId && file.systemId !== filters.systemId) return false
    if (filters.moduleId && file.moduleId && file.moduleId !== filters.moduleId) return false
    if (moduleName && !file.moduleId && file.moduleName !== moduleName) return false
    return true
  })
}

function receiveSnapshot(filters = {}) {
  const store = useReceptionStore()
  const entries = getReceptionEntries(filters)
  const parsed = entries.filter((item) => item.verdict?.status !== 'unparsed').length
  const normal = entries.filter((item) => item.verdict?.status === 'ok').length
  const abnormal = entries.filter((item) => item.verdict?.status === 'error').length
  const unparsed = entries.filter((item) => item.verdict?.status === 'unparsed').length
  return {
    entries,
    total: entries.length,
    parsed,
    normal,
    abnormal,
    unparsed,
    forwarded: store.recvQueue.filter((item) => item.kind === 'forward').length,
    monitoredInterfaces: uniqueCount(store.plan.map((item) => item.interfaceId)),
    rate: store.recvRate,
    status: store.status,
    elapsedSeconds: store.elapsedSeconds,
  }
}

function interfaceScope(filters = {}) {
  return useProtocolStore().testInterfaces.filter((item) => {
    if (filters.systemId && item.systemId !== filters.systemId) return false
    if (filters.moduleId && item.moduleId !== filters.moduleId) return false
    if (filters.interfaceId && String(item.id) !== String(filters.interfaceId)) return false
    return true
  })
}

function scopeBars(runs, exceptions, filters) {
  // 统一按接口维度分组（发送量/异常样本），不再按系统/模块分组
  return {
    sendByScope: sumBars(runs, (item) => interfaceNameOf(item.interfaceId, item.iface || '未命名接口'), (item) => item.total, (key) => key, SEND_COLOR),
    exceptionByScope: countBars(exceptions, (item) => interfaceNameOf(item.interfaceId, item.iface || '未命名报文'), (key) => key, EXCEPTION_COLOR),
    axisName: '接口',
  }
}

export function aggregateOverview(filters = {}) {
  const runs = getRuns(filters)
  const batches = getBatches(filters)
  const exceptions = getExceptions(filters)
  const reception = receiveSnapshot(filters)
  const datasets = getDatasets(filters)
  const files = getFiles(filters)
  const interfaces = interfaceScope(filters)
  const readyInterfaces = useProtocolStore().testInterfaces
    .filter((item) => (item.messageIds || []).length > 0).length
  const dataRows = sum(datasets, (item) => (item.rows?.length || 0) + (item.historyRows?.length || 0))

  return {
    send: {
      batches: batches.length,
      tasks: runs.length,
      messages: sum(runs, (item) => item.total),
      interfaces: uniqueCount(runs.map((item) => item.interfaceId || item.iface)),
    },
    receive: reception,
    assets: {
      exceptionSamples: exceptions.length,
      datasets: datasets.length,
      dataRows,
      files: files.length,
      definedInterfaces: interfaces.length,
      readyInterfaces,
    },
    sendTrend: trendOf(runs, (item) => item.dateKey || item.startedAt, (item) => item.total),
    exceptionTrend: trendOf(exceptions, (item) => item.capturedTime),
    ...scopeBars(runs, exceptions, filters),
  }
}

export function aggregateSend(filters = {}) {
  const runs = getRuns(filters)
  const batches = getBatches(filters)
  return {
    kpis: {
      batches: batches.length,
      tasks: runs.length,
      messages: sum(runs, (item) => item.total),
      interfaces: uniqueCount(runs.map((item) => item.interfaceId || item.iface)),
      durationSeconds: sum(batches, (item) => item.summary?.durationSeconds ?? item.summary?.executionTime),
    },
    messagesByDay: trendOf(runs, (item) => item.dateKey || item.startedAt, (item) => item.total),
    batchesByDay: trendOf(batches, (item) => item.dateKey || item.startedAt),
    byInterface: sumBars(runs, (item) => interfaceNameOf(item.interfaceId, item.iface || '未命名接口'), (item) => item.total, (key) => key),
    recentBatches: [...batches]
      .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
      .slice(0, 20)
      .map((batch) => ({
        id: batch.runId || batch.id,
        name: batch.name,
        startedAt: batch.startedAt,
        state: batch.state,
        taskCount: (batch.tasks || batch.stepResults || []).length,
        interfaceCount: uniqueCount((batch.tasks || batch.stepResults || []).map((item) => item.interfaceId || item.iface)),
        messages: batch.summary?.sentCount ?? batch.summary?.totalRequests ?? 0,
        duration: batch.summary?.durationSeconds ?? batch.summary?.executionTime ?? 0,
      })),
  }
}

export function aggregateReceive(filters = {}) {
  const snapshot = receiveSnapshot(filters)
  const byInterface = countBars(snapshot.entries, (item) => item.iface || '未命名报文', (key) => key, RECEIVE_COLOR)
  const composition = [
    { label: '解析正常', value: snapshot.normal, color: RECEIVE_COLOR },
    { label: '校验异常', value: snapshot.abnormal, color: EXCEPTION_COLOR },
    { label: '无法解析', value: snapshot.unparsed, color: UNPARSED_COLOR },
  ]
  return {
    ...snapshot,
    composition,
    byInterface,
    latest: [...snapshot.entries]
      .sort((a, b) => Number(b.seq || 0) - Number(a.seq || 0))
      .slice(0, 30)
      .map((item) => ({
        ...item,
        verdictLabel: item.verdict?.status === 'ok' ? '解析正常' : item.verdict?.tag || '校验异常',
        issue: item.verdict?.issues?.[0]?.message || '',
      })),
  }
}

export function aggregateException(filters = {}) {
  const exceptions = getExceptions(filters)
  const saved = exceptions.filter((item) => item.savedDatasetIds?.length).length
  return {
    kpis: {
      total: exceptions.length,
      unparsed: exceptions.filter((item) => item.type === '无法解析').length,
      saved,
      unsaved: exceptions.length - saved,
      variants: sum(exceptions, (item) => item.variantCount),
      interfaces: uniqueCount(exceptions.map((item) => item.interfaceId || item.iface)),
    },
    byType: countBars(exceptions, (item) => item.type, (key) => key, EXCEPTION_COLOR),
    bySaved: [
      { label: '已存入数据集', value: saved, color: '#16a34a' },
      { label: '尚未入库', value: exceptions.length - saved, color: EXCEPTION_COLOR },
    ],
    byInterface: countBars(exceptions, (item) => interfaceNameOf(item.interfaceId, item.iface || '未命名报文'), (key) => key, EXCEPTION_COLOR),
    trend: trendOf(exceptions, (item) => item.capturedTime),
    latest: [...exceptions]
      .sort((a, b) => String(b.capturedTime || '').localeCompare(String(a.capturedTime || '')))
      .slice(0, 30),
  }
}

export function aggregateAssets(filters = {}) {
  const interfaces = interfaceScope(filters)
  const runs = getRuns(filters)
  const exceptions = getExceptions(filters)
  const reception = getReceptionEntries(filters)
  const datasets = getDatasets(filters)
  const files = getFiles(filters)
  const historyRows = datasets.flatMap((dataset) => dataset.historyRows || [])
  const preparedRows = datasets.flatMap((dataset) => dataset.rows || [])
  const activeKeys = new Set([
    ...runs.map((item) => String(item.interfaceId || item.iface)),
    ...reception.map((item) => String(item.interfaceId || item.iface)),
    ...exceptions.map((item) => String(item.interfaceId || item.iface)),
  ])
  const interfaceRows = interfaces.map((iface) => {
    const ifaceRuns = runs.filter((item) => String(item.interfaceId || item.iface) === String(iface.id) || item.iface === iface.name)
    const ifaceReceive = reception.filter((item) => String(item.interfaceId || item.iface) === String(iface.id) || item.iface === iface.name)
    const ifaceExceptions = exceptions.filter((item) => String(item.interfaceId || item.iface) === String(iface.id) || item.iface === iface.name)
    const activityTimes = [
      ...ifaceRuns.map((item) => item.startedAt),
      ...ifaceExceptions.map((item) => item.capturedTime),
    ].filter(Boolean).sort()
    return {
      interfaceId: iface.id,
      iface: iface.name,
      module: moduleNameOf(iface.moduleId),
      messageCount: (iface.messageIds || []).length,
      executions: ifaceRuns.length,
      sent: sum(ifaceRuns, (item) => item.total),
      received: ifaceReceive.length,
      exceptionSamples: ifaceExceptions.length,
      lastActivity: activityTimes.at(-1) || '暂无记录',
    }
  })
  const activeCount = interfaces.filter((iface) => activeKeys.has(String(iface.id)) || activeKeys.has(iface.name)).length
  const sourceGroups = groupBy(historyRows, (item) => item.source || '未标注来源')

  return {
    kpis: {
      interfaces: interfaces.length,
      activeInterfaces: activeCount,
      datasets: datasets.length,
      preparedRows: preparedRows.length,
      historyRows: historyRows.length,
      files: files.length,
    },
    interfaceUsage: [
      { label: '已有观测记录', value: activeCount, color: SEND_COLOR },
      { label: '暂无观测记录', value: Math.max(0, interfaces.length - activeCount), color: '#cbd5e1' },
    ],
    datasetsByInterface: countBars(datasets, (item) => item.linkedInterface || '未关联报文', (key) => key, ASSET_COLOR),
    historyBySource: [...sourceGroups.entries()]
      .map(([label, rows], index) => ({
        label,
        value: rows.length,
        color: [ASSET_COLOR, RECEIVE_COLOR, EXCEPTION_COLOR, SEND_COLOR, '#16a34a'][index % 5],
      }))
      .sort((a, b) => b.value - a.value),
    interfaceRows: interfaceRows.sort((a, b) => b.sent - a.sent || b.exceptionSamples - a.exceptionSamples),
  }
}

export function exportRows(category, filters = {}) {
  if (category === 'reception') {
    return aggregateReceive(filters).latest.map((item) => ({
      序号: item.seq,
      时间: item.time,
      接口: interfaceNameOf(item.interfaceId, item.iface || ''),
      报文: item.iface,
      字节数: item.byteLength,
      解析结果: item.verdictLabel,
      异常说明: item.issue,
    }))
  }
  if (category === 'exception') {
    return aggregateException(filters).latest.map((item) => ({
      时间: item.capturedTime,
      接口: interfaceNameOf(item.interfaceId, item.iface || ''),
      报文: item.iface,
      类型: item.type,
      异常字段: item.issues?.[0]?.field || item.detail?.fieldPath || '',
      异常说明: item.issues?.[0]?.message || item.detail?.ruleMessage || item.remark,
      入库情况: item.savedDatasetIds?.length ? '已入库' : '未入库',
    }))
  }
  if (category === 'interface') {
    return aggregateAssets(filters).interfaceRows.map((item) => ({
      接口: item.iface,
      报文数: item.messageCount,
      任务执行项: item.executions,
      已发送报文: item.sent,
      本次接收: item.received,
      异常样本: item.exceptionSamples,
      最近记录: item.lastActivity,
    }))
  }
  if (category === 'asset') {
    return getDatasets(filters).map((dataset) => ({
      数据集: dataset.name,
      关联报文: dataset.linkedInterface || '',
      当前数据行: dataset.rows?.length || 0,
      历史数据行: dataset.historyRows?.length || 0,
      创建日期: dataset.createdAt,
    }))
  }
  return aggregateSend(filters).recentBatches.map((batch) => ({
    开始时间: batch.startedAt,
    执行批次: batch.name,
    任务执行项: batch.taskCount,
    涉及接口: batch.interfaceCount,
    已发送报文: batch.messages,
    执行时长秒: batch.duration,
    批次状态: batch.state,
  }))
}

export function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')
}
