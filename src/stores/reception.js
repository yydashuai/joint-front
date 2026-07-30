import { defineStore } from 'pinia'
import { useProtocolStore, collectInterfaceFields } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useExceptionStore } from '@/stores/exception'
import { useRuleStore } from '@/stores/rule'
import { useTestDataStore } from '@/stores/testData'
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

const MAX_QUEUE = 400

/** 校验状态标签 → 异常等级 */
const LEVEL_OF_TAG = {
  '无法解析': '高',
  '语义不一致': '高',
  '字段越界': '中',
  '规则校验失败': '中',
}

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
    recvInterval: 700,        // 模拟接收间隔（毫秒）
    recvQueue: [],            // 接收数据流（含转发记录）
    exceptions: [],           // 本次监听会话捕获的异常（同时写入 exception store，共享台账）
    startedAt: null,
    startedAtMs: null,
    finishedAt: null,
    _seq: 0,
  }),

  getters: {
    planItems(state) {
      const protocolStore = useProtocolStore()
      const connStore = useConnectionStore()
      const systemStore = useSystemStore()
      const ruleStore = useRuleStore()

      return state.plan.map((planItem, index) => {
        const iface = protocolStore.interfaces.find((i) => String(i.id) === String(planItem.interfaceId))
        if (!iface) return null
        const module = connStore.nodes.find((n) => n.id === iface.moduleId) || null
        const system = systemStore.systems.find((s) => s.id === iface.systemId) || null
        const fields = collectInterfaceFields(iface, protocolStore.protocols)
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

    elapsedSeconds(state) {
      if (!state.startedAtMs) return 0
      const end = state.finishedAt ? new Date(state.finishedAt.replace(/\//g, '-')).getTime() : Date.now()
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
      if (!protocolStore.interfaces.some((i) => String(i.id) === String(interfaceId))) return false
      this.plan.push({ id: uid('rplan'), interfaceId })
      return true
    },

    removeFromPlan(id) {
      const idx = this.plan.findIndex((p) => p.id === id)
      if (idx >= 0) this.plan.splice(idx, 1)
      if (!this.plan.length && !['listening', 'paused'].includes(this.status)) this.reset()
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
      this._seq = 0
      recvTimer = window.setInterval(() => this._tick(), this.recvInterval)
      return true
    },

    pause() {
      if (this.status !== 'listening') return
      this.status = 'paused'
      this._clearTimers()
    },

    resume() {
      if (this.status !== 'paused') return
      this.status = 'listening'
      recvTimer = window.setInterval(() => this._tick(), this.recvInterval)
    },

    stop() {
      if (!['listening', 'paused'].includes(this.status)) return
      this.status = 'stopped'
      this.finishedAt = nowText()
      this._clearTimers()
    },

    reset() {
      this._clearTimers()
      this.status = 'idle'
      this.recvQueue = []
      this.exceptions = []
      this.startedAt = null
      this.startedAtMs = null
      this.finishedAt = null
      this._seq = 0
    },

    _clearTimers() {
      if (recvTimer) window.clearInterval(recvTimer)
      recvTimer = null
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
     * 构造一条模拟接收报文并完成两层校验。
     * 正常 ~68%；字段越界 ~15%；语义不一致 ~9%；无法解析 ~8%。
     */
    _fabricate(item) {
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

    /** 异常写入共享台账（故障异常管理页同步可见），并记入会话异常流 */
    _captureException(item, entry) {
      const exceptionStore = useExceptionStore()
      const firstIssue = entry.verdict.issues[0] || {}
      const ex = exceptionStore.capture({
        type: entry.verdict.tag,
        level: LEVEL_OF_TAG[entry.verdict.tag] || '中',
        systemId: entry.systemId,
        moduleId: entry.moduleId,
        interfaceId: entry.interfaceId,
        iface: entry.iface,
        source: 'reception',
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
        const iface = protocolStore.interfaces.find((i) => String(i.id) === String(target.interfaceId || entries[0].interfaceId))
        const module = connStore.nodes.find((n) => n.id === iface?.moduleId)
        ds = dataStore.addDataset({
          name: target.newName,
          systemId: iface?.systemId ?? entries[0].systemId ?? null,
          moduleName: module?.name || '',
          linkedInterface: iface?.name || entries[0].iface,
          desc: `由接收接口编排保存（${nowText()}）`,
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
     * 将用户构造或编辑后的报文作为「接收」条目注入数据流，复用两层校验与异常台账。
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
