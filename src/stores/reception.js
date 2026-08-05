import { defineStore } from 'pinia'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useCustomIfaceStore } from '@/stores/customIface'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useExceptionStore } from '@/stores/exception'
import { useRuleStore } from '@/stores/rule'
import { useTestDataStore } from '@/stores/testData'
import { buildBatchScope, useRunBatchStore } from '@/stores/runBatch'
import {
  buildMockFrame, bytesFromHex, hexFromBytes, rebuildFrame,
  tryParseHeaders, validateMessage,
} from '@/utils/receiveValidator'

let recvTimer = null

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
const timeText = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const rnd = (min, max) => Math.round(min + Math.random() * (max - min))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const makeHex = (bytes = 12) => Array.from({ length: bytes }, () =>
  rnd(0, 255).toString(16).padStart(2, '0').toUpperCase()
).join(' ')

const MAX_QUEUE = 400

/** 按字段约束生成一个正常值 */
const normalValueOf = (f) => {
  const c = f.constraint
  if (c?.mode === 'fixed') return c.value
  if (c?.mode === 'enum' && c.entries?.length) {
    const e = pick(c.entries)
    return e?.value ?? e
  }
  if (c?.mode === 'range') {
    const min = Number.isFinite(c.min) ? c.min : 0
    const max = Number.isFinite(c.max) ? c.max : min + 100
    return rnd(min, Math.min(max, min + 10000))
  }
  return ''
}

/** 构造一个违反约束的值（用于模拟异常报文） */
const abnormalValueOf = (f) => {
  const c = f.constraint
  if (c?.mode === 'fixed') return `${c.value}X`
  if (c?.mode === 'enum') return 255
  if (c?.mode === 'range') {
    const max = Number.isFinite(c.max) ? c.max : 100
    return max + rnd(1, 30)
  }
  return '??'
}

export const useReceptionStore = defineStore('reception', {
  state: () => ({
    // 监听计划：直接绑定接口（接收侧不需要数据集，解析依据 = 字段定义，校验依据 = 规则集）
    plan: [],                 // [{ id, interfaceId }]
    status: 'idle',           // idle | listening | paused | stopped | done
    recvInterval: 0,        // 模拟接收间隔（毫秒）；0=无间隔，连续生成
    recvQueue: [],            // 接收数据流（含转发记录）
    exceptions: [],           // 本次监听会话捕获的异常（同时写入 exception store，共享台账）
    startedAt: null,
    startedAtMs: null,
    finishedAt: null,
    finishedAtMs: null,
    currentBatchId: null,
    sourceScheme: null,
    _seq: 0,
  }),

  getters: {
    planItems(state) {
      const protocolStore = useProtocolStore()
      const connStore = useConnectionStore()
      const systemStore = useSystemStore()
      const ruleStore = useRuleStore()
      const customStore = useCustomIfaceStore()

      return state.plan.map((planItem, index) => {
        // 自定义接口：系统不解析内部字段，按监听配置匹配
        if (planItem.customId) {
          const custom = customStore.byId(planItem.customId)
          if (!custom) return null
          return {
            ...planItem, index,
            iface: custom,
            module: null,
            system: null,
            fields: [],
            rules: [],
            fieldCount: 0,
            ruleCount: 0,
            isCustom: true,
          }
        }
        const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(planItem.interfaceId))
        if (!iface) return null
        const module = connStore.nodes.find((n) => n.id === iface.moduleId) || null
        const system = systemStore.systems.find((s) => s.id === iface.systemId) || null
        const fields = collectTestInterfaceFields(
          iface,
          useTestDataStore().datasets,
          protocolStore.interfaces,
          protocolStore.protocols,
          'receive',
        )
        const rules = ruleStore.ruleSets.flatMap((rs) => (rs.rules || []).filter(
          (r) => r.enabled !== false && String(r.target?.interfaceId ?? '') === String(iface.id)
        ))
        return { ...planItem, index, iface, module, system, fields, rules, fieldCount: fields.length, ruleCount: rules.length }
      }).filter(Boolean)
    },

    isListening: (state) => state.status === 'listening',

    totalCount: (state) => state.recvQueue.filter((e) => e.kind === 'recv').length,
    okCount: (state) => state.recvQueue.filter((e) => e.kind === 'recv' && e.verdict.status === 'ok').length,
    errorCount: (state) => state.recvQueue.filter((e) => e.kind === 'recv' && e.verdict.status === 'error').length,
    unparsedCount: (state) => state.recvQueue.filter((e) => e.kind === 'recv' && e.verdict.status === 'unparsed').length,
    forwardCount: (state) => state.recvQueue.filter((e) => e.kind === 'forward').length,
    savedToDatasetCount: (state) => state.recvQueue.filter((e) => e.kind === 'recv' && e.savedToDataset).length,

    elapsedSeconds(state) {
      if (!state.startedAtMs) return 0
      const end = state.finishedAtMs || Date.now()
      return Math.max(1, Math.round((end - state.startedAtMs) / 1000))
    },

    /** 本次会话接收速率（条/秒） */
    recvRate() {
      if (!this.startedAtMs || !this.totalCount) return 0
      return Number((this.totalCount / this.elapsedSeconds).toFixed(1))
    },
  },

  actions: {
    /* ---------- 监听计划 ---------- */
    addToPlan(interfaceId) {
      if (!interfaceId) return false
      if (this.plan.some((p) => String(p.interfaceId) === String(interfaceId))) return false
      const protocolStore = useProtocolStore()
      if (!protocolStore.testInterfaces.some((i) => String(i.id) === String(interfaceId))) return false
      this.plan.push({ id: uid('rplan'), interfaceId })
      this.sourceScheme = null
      this._syncActiveBatchScope()
      return true
    },

    /** 自定义接口加入接收计划（按监听配置匹配报文） */
    addCustomToPlan(customId) {
      if (!customId) return false
      if (this.plan.some((p) => String(p.customId) === String(customId))) return false
      const customStore = useCustomIfaceStore()
      if (!customStore.byId(customId)) return false
      this.plan.push({ id: uid('rplan'), customId })
      this.sourceScheme = null
      this._syncActiveBatchScope()
      return true
    },

    setPlanScheme(scheme) {
      if (!scheme) {
        this.sourceScheme = null
        return
      }
      const plannedIds = new Set(this.planItems.map((item) => String(item.iface?.id || '')))
      const schemeIds = new Set((scheme.interfaceIds || []).map(String))
      const exact = plannedIds.size === schemeIds.size && [...plannedIds].every((id) => schemeIds.has(id))
      this.sourceScheme = exact ? { id: scheme.id, name: scheme.name } : null
      this._syncActiveBatchScope()
    },

    removeFromPlan(id) {
      if (['listening', 'paused'].includes(this.status)) return false
      const idx = this.plan.findIndex((p) => p.id === id)
      if (idx >= 0) this.plan.splice(idx, 1)
      this.sourceScheme = null
      this._syncActiveBatchScope()
      if (!this.plan.length && !['listening', 'paused'].includes(this.status)) this.reset()
      return idx >= 0
    },

    reorder(from, to) {
      if (from === to || from < 0 || to < 0 || from >= this.plan.length || to >= this.plan.length) return
      const [item] = this.plan.splice(from, 1)
      this.plan.splice(to, 0, item)
    },

    /* ---------- 监听控制 ---------- */
    start() {
      if (!this.planItems.length) return false
      this._clearTimers()
      useRuleStore().resolveInterfaceIds()
      this.status = 'listening'
      this.recvQueue = []
      this.exceptions = []
      this.startedAt = nowText()
      this.startedAtMs = Date.now()
      this.finishedAt = null
      this.finishedAtMs = null
      this.currentBatchId = uid('receive-batch')
      this._seq = 0
      const scope = buildBatchScope({
        scheme: this.sourceScheme,
        interfaces: this.planItems.map((item) => ({ id: item.iface?.id, name: item.iface?.name })),
      })
      useRunBatchStore().startBatch({
        batchId: this.currentBatchId,
        batchType: 'receive',
        systemId: this.planItems[0]?.iface?.systemId || '',
        scope,
        startedAt: this.startedAt,
        tasks: this.planItems.map((item) => ({
          moduleId: item.module?.id || item.iface?.moduleId || '',
          moduleName: item.module?.name || '',
          interfaceId: item.iface?.id || '',
          iface: item.iface?.name || '',
        })),
      })
      recvTimer = window.setInterval(() => this._tick(), this.recvInterval)
      return true
    },

    pause() {
      if (this.status !== 'listening') return
      this.status = 'paused'
      this._clearTimers()
      useRunBatchStore().updateBatchStatus(this.currentBatchId, 'paused')
    },

    resume() {
      if (this.status !== 'paused') return
      this.status = 'listening'
      useRunBatchStore().updateBatchStatus(this.currentBatchId, 'running')
      recvTimer = window.setInterval(() => this._tick(), this.recvInterval)
    },

    stop() {
      if (!['listening', 'paused'].includes(this.status)) return
      this.status = 'stopped'
      this.finishedAt = nowText()
      this.finishedAtMs = Date.now()
      this._clearTimers()
      this._archiveBatch('terminated')
    },

    reset() {
      if (['listening', 'paused'].includes(this.status)) return false
      this._clearTimers()
      this.status = 'idle'
      this.recvQueue = []
      this.exceptions = []
      this.startedAt = null
      this.startedAtMs = null
      this.finishedAt = null
      this.finishedAtMs = null
      this.currentBatchId = null
      this._seq = 0
      return true
    },

    _clearTimers() {
      if (recvTimer) window.clearInterval(recvTimer)
      recvTimer = null
    },

    _syncActiveBatchScope() {
      if (!this.currentBatchId || !['listening', 'paused'].includes(this.status)) return
      useRunBatchStore().updateBatchScope(this.currentBatchId, buildBatchScope({
        scheme: this.sourceScheme,
        interfaces: this.planItems.map((item) => ({ id: item.iface?.id, name: item.iface?.name })),
      }))
    },

    _archiveBatch(finishReason = 'terminated') {
      if (!this.currentBatchId) return null
      const records = this.recvQueue.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        seq: entry.seq,
        time: entry.time,
        interfaceId: entry.interfaceId,
        iface: entry.iface,
        moduleId: entry.moduleId,
        systemId: entry.systemId,
        transport: entry.transport,
        byteLength: entry.byteLength,
        hex: entry.hex,
        verdict: entry.verdict,
        exceptionId: entry.exceptionId,
        savedToDataset: entry.savedToDataset,
        forwardTarget: entry.forwardTarget,
      }))
      const receiveRecords = records.filter((entry) => entry.kind === 'recv')
      const summary = {
        totalReceived: receiveRecords.length,
        parsedCount: receiveRecords.filter((entry) => entry.verdict?.status !== 'unparsed').length,
        normalCount: receiveRecords.filter((entry) => entry.verdict?.status === 'ok').length,
        validationAbnormalCount: receiveRecords.filter((entry) => entry.verdict?.status === 'error').length,
        unparsedCount: receiveRecords.filter((entry) => entry.verdict?.status === 'unparsed').length,
        forwardedCount: records.filter((entry) => entry.kind === 'forward').length,
        savedToDatasetCount: receiveRecords.filter((entry) => entry.savedToDataset).length,
        interfaceCount: new Set(this.planItems.map((item) => item.iface?.id).filter(Boolean)).size,
        durationSeconds: this.elapsedSeconds,
      }
      return useRunBatchStore().finishBatch(this.currentBatchId, {
        state: 'done',
        finishReason,
        startedAt: this.startedAt,
        finishedAt: this.finishedAt || nowText(),
        durationText: `${summary.durationSeconds}s`,
        summary,
        records,
        tasks: this.planItems.map((item) => ({
          moduleId: item.module?.id || item.iface?.moduleId || '',
          moduleName: item.module?.name || '',
          interfaceId: item.iface?.id || '',
          iface: item.iface?.name || '',
        })),
        exceptions: [...this.exceptions],
      })
    },

    /* ---------- 模拟接收 ---------- */
    _tick() {
      if (this.status !== 'listening') return
      const item = pick(this.planItems)
      if (!item) return
      const entry = this._fabricate(item)
      this.recvQueue.push(entry)
      if (this.recvQueue.length > MAX_QUEUE) this.recvQueue.splice(0, this.recvQueue.length - MAX_QUEUE)
      if (entry.verdict.status !== 'ok') this._captureException(item, entry)
    },

    /**
     * 构造一条模拟接收报文并完成结构、字段与规则校验。
     * 正常 ~68%；字段越界 ~15%；语义不一致 ~9%；无法解析 ~8%。
     */
    _fabricate(item) {
      // 自定义接口：系统不解析内部字段/数据，按监听配置标记来源（IP/协议/消息号）
      if (item.isCustom) {
        const iface = item.iface
        const lc = iface.listenConfig || {}
        const transport = iface.transportType || lc.protocol || 'OSE'
        const body = makeHex(rnd(8, 16))
        this._seq += 1
        return {
          id: uid('rx'),
          kind: 'recv',
          seq: this._seq,
          time: timeText(),
          interfaceId: iface.id,
          iface: iface.name,
          moduleId: '',
          systemId: '',
          transport,
          ip: lc.ip || iface.transportConfig?.targetAddress || '—',
          messageId: lc.messageId || iface.transportConfig?.messageType || '—',
          hex: body,
          byteLength: body.split(' ').filter(Boolean).length,
          fields: [],
          values: { 报文体: body },
          verdict: { status: 'ok', tag: '正常', issues: [] },
          parseAttempts: [],
          headerParse: null,
          exceptionId: null,
          forwardedFrom: null,
          forwardTarget: null,
          savedToDataset: false,
        }
      }

      const transport = item.iface.transportType || 'OSE'
      const r = Math.random()
      let variant = r < 0.68 ? 'ok' : r < 0.83 ? 'field' : r < 0.92 ? 'semantic' : 'unparsed'
      const constrained = item.fields.filter((f) => f.constraint && f.constraint.mode && f.constraint.mode !== 'none')
      if (variant === 'field' && !constrained.length) variant = 'ok'
      if (variant === 'semantic' && !['OSE', '4908A'].includes(transport)) variant = 'ok'

      // 字段值
      const values = {}
      item.fields.forEach((f) => { values[f.name] = normalValueOf(f) })
      if (variant === 'field') {
        const victim = pick(constrained)
        values[victim.name] = abnormalValueOf(victim)
      }

      // 帧字节
      const bodyLen = Math.max(4, item.fields.length * 2)
      let bytes
      if (variant === 'unparsed') {
        // 40% 概率带「另一协议」的合法头（自动轮询可解析出头）；60% 纯乱码（全部失败）
        if (Math.random() < 0.4) {
          const otherTransport = transport === 'OSE' ? '4908A' : 'OSE'
          bytes = buildMockFrame(otherTransport, bodyLen)
        } else {
          bytes = buildMockFrame(transport, bodyLen, { garbage: true })
        }
      } else {
        bytes = buildMockFrame(transport, bodyLen, {
          corruptLength: variant === 'semantic' && transport === 'OSE',
          corruptChecksum: variant === 'semantic' && transport === '4908A',
        })
      }

      const verdict = validateMessage({
        transport, bytes,
        fields: item.fields,
        values: variant === 'unparsed' ? {} : values,
        rules: item.rules,
        unparsed: variant === 'unparsed',
      })

      // 无法解析：自动轮询三协议尝试解析报文头，全部失败才标记「解析失败」交用户处置
      let parseAttempts = []
      let headerParse = null
      if (variant === 'unparsed') {
        parseAttempts = tryParseHeaders(bytes)
        headerParse = parseAttempts.find((a) => a.ok) || null
      }

      this._seq += 1
      return {
        id: uid('rx'),
        kind: 'recv',
        seq: this._seq,
        time: timeText(),
        interfaceId: item.iface.id,
        iface: item.iface.name,
        moduleId: item.module?.id || item.iface.moduleId || '',
        systemId: item.system?.id || item.iface.systemId || '',
        transport,
        ip: item.iface.transportConfig?.targetAddress || '—',
        messageId: item.iface.transportConfig?.messageType || '—',
        hex: hexFromBytes(bytes),
        byteLength: bytes.length,
        fields: item.fields,
        values: variant === 'unparsed' ? {} : values,
        verdict,
        parseAttempts,
        headerParse,
        exceptionId: null,
        forwardedFrom: null,
        forwardTarget: null,
        savedToDataset: false,
      }
    },

    /** 将接收侧解析/校验异常连同原始数据与字段快照写入异常样本库。 */
    _captureException(item, entry) {
      const exceptionStore = useExceptionStore()
      const firstIssue = entry.verdict.issues[0] || {}
      const ex = exceptionStore.capture({
        type: entry.verdict.tag,
        systemId: entry.systemId,
        moduleId: entry.moduleId,
        interfaceId: entry.interfaceId,
        iface: entry.iface,
        source: 'reception',
        batchId: this.currentBatchId || '',
        runId: this.currentBatchId || '',
        sourceEntryId: entry.id,
        transport: entry.transport,
        rawHex: entry.hex,
        fields: entry.fields,
        values: entry.values,
        issues: entry.verdict.issues,
        detail: {
          reqHex: entry.hex,
          ruleMessage: entry.verdict.issues.map((i) => (i.field ? `${i.field}：${i.message}` : i.message)).join('；'),
          fieldPath: firstIssue.field || '',
        },
        tags: ['接收校验', entry.verdict.tag],
        capturedTime: nowText(),
      })
      if (ex) {
        entry.exceptionId = ex.id
        this.exceptions.unshift(ex)
      }
    },

    /* ---------- 保存为数据集（历史数据，source=接收报文） ---------- */
    /**
     * @param entryIds 勾选的报文 id
     * @param target { datasetId } 或 { newName, interfaceId }
     * @returns { saved, dataset } | null
     */
    saveToDataset(entryIds = [], target = {}) {
      const dataStore = useTestDataStore()
      const protocolStore = useProtocolStore()
      const connStore = useConnectionStore()
      const entries = this.recvQueue.filter((e) => entryIds.includes(e.id) && e.kind === 'recv')
      if (!entries.length) return null

      let ds = null
      if (target.datasetId) {
        ds = dataStore.datasets.find((d) => d.id === target.datasetId)
      } else if (target.newName) {
        const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(target.interfaceId || entries[0].interfaceId))
        const module = connStore.nodes.find((n) => n.id === iface?.moduleId)
        const sourceDataset = dataStore.datasets.find((dataset) =>
          (iface?.datasetIds || []).some((id) => String(id) === String(dataset.id)))
        ds = dataStore.addDataset({
          name: target.newName,
          systemId: iface?.systemId ?? entries[0].systemId ?? null,
          moduleName: module?.name || '',
          linkedInterface: sourceDataset?.linkedInterface || '',
          desc: `由接口收发监测保存（${nowText()}）`,
        })
      }
      if (!ds) return null

      const rows = entries.map((e) => {
        const unparsed = e.verdict.status === 'unparsed'
        return {
          label: `接收 #${e.seq} · ${e.iface}`,
          values: unparsed ? { 原始报文: e.hex } : { ...e.values },
          source: '接收报文',
          abnormal: e.verdict.status !== 'ok',   // 异常标签：无法解析 / 字段/规则校验失败均属异常
          excellent: false,                        // 优秀历史标签：进入库后由用户按需标记
          remark: unparsed
            ? '原始 hex 样本（无法解析，不可用于发送编排）'
            : (e.verdict.status === 'error' ? `异常报文：${e.verdict.issues.map((i) => i.message).join('；')}` : `接收时间 ${e.time}，校验通过`),
        }
      })
      const saved = dataStore.addHistoryRows(ds.id, rows)
      entries.forEach((e) => { e.savedToDataset = true })
      if (this.currentBatchId && ['stopped', 'done'].includes(this.status)) this._archiveBatch('terminated')
      return { saved: saved.length, dataset: ds }
    },

    /* ---------- 无法解析报文：修改头字段后合并转发 ---------- */
    /**
     * @param entryId 原报文 id
     * @param payload { transport, headerValues, targetNodeId, recalc }
     */
    forward(entryId, { transport, headerValues = {}, targetNodeId = null, recalc = true } = {}) {
      const entry = this.recvQueue.find((e) => e.id === entryId)
      if (!entry) return null
      const bytes = rebuildFrame(transport, bytesFromHex(entry.hex), headerValues, recalc)
      if (!bytes) return null
      const connStore = useConnectionStore()
      const node = connStore.nodes.find((n) => n.id === targetNodeId) || null

      this._seq += 1
      const fwd = {
        id: uid('fw'),
        kind: 'forward',
        seq: this._seq,
        time: timeText(),
        interfaceId: entry.interfaceId,
        iface: entry.iface,
        moduleId: entry.moduleId,
        systemId: entry.systemId,
        transport,
        hex: hexFromBytes(bytes),
        byteLength: bytes.length,
        fields: [],
        values: {},
        verdict: { status: 'forwarded', tag: '已转发', issues: [] },
        parseAttempts: [],
        headerParse: null,
        exceptionId: null,
        forwardedFrom: entry.id,
        forwardTarget: node ? `${node.name}（${node.ip}:${node.port}）` : '未指定目标',
        savedToDataset: false,
      }
      this.recvQueue.push(fwd)
      return fwd
    },

    /* ---------- 报文构造 / 直接发送（发送测试闭环） ---------- */
    /**
     * 将用户构造或编辑后的报文作为「接收」条目注入数据流，复用结构、字段与规则校验。
     * 用于「直接发送」「作为异常数据发送测试」：用户手工改出异常 → 注入后由校验引擎判定并标红/入账。
     * @param payload { transport, bytes, fields=[], values={}, interfaceId, iface, moduleId, systemId, sentTest }
     */
    injectReceived({ transport, bytes = [], fields = [], values = {}, interfaceId = null, iface = '', moduleId = '', systemId = '', sentTest = false } = {}) {
      const ruleStore = useRuleStore()
      const rules = ruleStore.ruleSets.flatMap((rs) => (rs.rules || []).filter(
        (r) => r.enabled !== false && String(r.target?.interfaceId ?? '') === String(interfaceId)
      ))
      const verdict = validateMessage({
        transport, bytes,
        fields,
        values: { ...values },
        rules,
        unparsed: false,
      })

      this._seq += 1
      const entry = {
        id: uid('tx'),
        kind: 'recv',
        seq: this._seq,
        time: timeText(),
        interfaceId: interfaceId || null,
        iface: iface || (transport ? `${transport} 手工报文` : '手工报文'),
        moduleId: moduleId || '',
        systemId: systemId || '',
        transport,
        hex: hexFromBytes(bytes),
        byteLength: bytes.length,
        fields,
        values: { ...values },
        verdict,
        parseAttempts: [],
        headerParse: null,
        exceptionId: null,
        forwardedFrom: null,
        forwardTarget: null,
        savedToDataset: false,
        sentTest: !!sentTest,
      }
      this.recvQueue.push(entry)
      if (entry.verdict.status !== 'ok') {
        this._captureException({ iface: entry.iface, interfaceId, systemId, moduleId }, entry)
      }
      return entry
    },
  },
})
