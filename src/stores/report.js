import { defineStore } from 'pinia'
import { useRunBatchStore } from '@/stores/runBatch'
import { useTestDataStore } from '@/stores/testData'

let seq = 9000
const uid = (p = 'r') => `${p}-${++seq}`
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

/* ============================================================
 * 联试报告 store（三步式向导）
 *  - 报告主体 = 测试执行编排的「一轮执行」(execution run)
 *  - 硬数据章节由所选批次的 summary / stepResults / 异常确定性组织
 *  - 描述性章节给多份变体，「重新生成」时轮换（体现生成灵活，不暴露 RAG）
 *  - 模板 = 上传的 DOCX 文件（全局复用），素材 = 生成时按需上传
 *  - 知识库 / 模型配置保留，供独立的「知识模型管理」页使用，本向导不引用
 * ========================================================== */

// 章节 kind 仅为内部字段，决定描述段能否「重新生成」，UI 不暴露
const makeSection = (o = {}) => ({ key: uid('sec'), title: '', kind: 'gen', content: '', variants: [], vi: 0, comments: [], ...o })

const scopeNameOf = (batch) => batch.scope?.displayName || '未命名接口范围'
const interfaceCountOf = (batch) => batch.scope?.interfaceIds?.length
  || new Set((batch.tasks || batch.stepResults || []).map((item) => item.interfaceId || item.iface).filter(Boolean)).size

const sendMetricsTable = (batch) => {
  const summary = batch.summary || {}
  const sent = summary.sentCount ?? summary.totalRequests ?? 0
  const planned = summary.plannedCount ?? sent
  const unsent = summary.unsentCount ?? Math.max(0, planned - sent)
  return `| 指标 | 数值 | 指标 | 数值 |
| --- | --- | --- | --- |
| 计划发送 | ${planned} 条 | 实际发送 | ${sent} 条 |
| 未发送 | ${unsent} 条 | 覆盖接口 | ${summary.interfaceCount ?? interfaceCountOf(batch)} 个 |
| 使用数据集 | ${summary.datasetCount || 0} 个 | 批次时长 | ${summary.durationSeconds ?? summary.executionTime ?? 0} 秒 |`
}

const sendResultsTable = (batch) => {
  const head = `| 任务 | 接口 | 实际发送 | 数据集 |
| --- | --- | --- | --- |`
  const rows = (batch.stepResults || []).map((row) => {
    const task = (batch.tasks || []).find((item) => item.taskId === row.taskId)
    return `| ${row.taskName || '—'} | ${row.iface || '—'} | ${row.total || 0} 条 | ${(task?.datasetNames || []).join('、') || '未关联'} |`
  }).join('\n')
  return `${head}\n${rows || '| — | — | 0 条 | — |'}`
}

const receiveMetricsTable = (batch) => {
  const summary = batch.summary || {}
  return `| 指标 | 数值 | 指标 | 数值 |
| --- | --- | --- | --- |
| 接收总量 | ${summary.totalReceived || 0} 条 | 正常解析 | ${summary.normalCount || 0} 条 |
| 校验异常 | ${summary.validationAbnormalCount || 0} 条 | 无法解析 | ${summary.unparsedCount || 0} 条 |
| 已转发 | ${summary.forwardedCount || 0} 条 | 已存入数据集 | ${summary.savedToDatasetCount || 0} 条 |
| 覆盖接口 | ${summary.interfaceCount ?? interfaceCountOf(batch)} 个 | 批次时长 | ${summary.durationSeconds || 0} 秒 |`
}

const receiveResultsTable = (batch) => {
  const groups = new Map()
  ;(batch.records || []).filter((item) => item.kind === 'recv').forEach((item) => {
    const key = item.iface || '未命名接口'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  const head = `| 接口 | 接收总量 | 正常解析 | 校验异常 | 无法解析 | 已存入数据集 |
| --- | --- | --- | --- | --- | --- |`
  const rows = [...groups.entries()].map(([iface, records]) =>
    `| ${iface} | ${records.length} | ${records.filter((item) => item.verdict?.status === 'ok').length} | ${records.filter((item) => item.verdict?.status === 'error').length} | ${records.filter((item) => item.verdict?.status === 'unparsed').length} | ${records.filter((item) => item.savedToDataset).length} |`
  ).join('\n')
  return `${head}\n${rows || '| — | 0 | 0 | 0 | 0 | 0 |'}`
}

const exceptionVariants = (batch) => {
  const exceptions = batch.exceptions || []
  if (!exceptions.length) {
    return [
      '本批次未捕获解析或校验异常数据。',
      '本次接收记录中没有形成异常样本，可将该批次作为后续对照记录。',
      '当前接收批次未产生异常数据，报告仅保留接收规模和接口分布。',
      '异常样本为空，无需补充异常数据说明。'
    ]
  }
  const lines = exceptions.map((item) =>
    `- **[${item.type}] ${item.capturedTime || item.time || '未记录时间'}** — ${item.iface}：${item.detail?.ruleMessage || item.message || item.remark || '未记录说明'}`
  ).join('\n')
  return [
    `本批次共保留 **${exceptions.length} 条异常数据**：\n\n${lines}`,
    `接收过程中形成 ${exceptions.length} 条可追溯异常样本：\n\n${lines}\n\n可按需保存为数据集用于复现。`,
    `异常数据主要来自结构解析和字段规则判定，明细如下：\n\n${lines}`,
    `本批次异常数据已与接收批次关联：\n\n${lines}`
  ]
}

const buildSendSections = (batch, seedIndex) => {
  const summary = batch.summary || {}
  const sent = summary.sentCount ?? summary.totalRequests ?? 0
  const planned = summary.plannedCount ?? sent
  const unsent = summary.unsentCount ?? Math.max(0, planned - sent)
  const overview = [
    `本报告记录**${scopeNameOf(batch)}**发送批次。计划发送 ${planned} 条，实际发送 ${sent} 条，覆盖 ${interfaceCountOf(batch)} 个接口。`,
    `本次发送批次执行范围为**${scopeNameOf(batch)}**，共发送 ${sent} 条数据，未发送 ${unsent} 条。`,
    `本报告仅呈现发送侧客观记录，不将接收数据与本批次建立请求—响应关系。实际发送 ${sent} 条，未发送 ${unsent} 条。`,
    `**${scopeNameOf(batch)}**发送批次已完成，接口发送数量和数据来源详见后续表格。`
  ]
  const conclusion = [
    `本批次发送已完成。${unsent ? `仍有 ${unsent} 条计划数据未发送，后续可新建批次继续验证。` : '计划数据已全部发送。'}`,
    `发送记录已冻结，可作为后续接收观测或重复发送测试的数据依据。`,
    `本报告仅确认本批次的发送范围和实际发送记录，不扩展判断接口内部业务结果。`,
    `建议保留当前批次作为发送侧追溯依据；如需调整数据，应新建发送批次。`
  ]
  const index = Math.abs(seedIndex) % overview.length
  return [
    makeSection({ key: 'overview', title: '发送批次概述', kind: 'gen', content: overview[index], variants: overview, vi: index }),
    makeSection({ key: 'metrics', title: '发送规模', kind: 'data', content: sendMetricsTable(batch) }),
    makeSection({ key: 'results', title: '接口发送明细', kind: 'data', content: sendResultsTable(batch) }),
    makeSection({ key: 'conclusion', title: '结论与建议', kind: 'gen', content: conclusion[index], variants: conclusion, vi: index })
  ]
}

const buildReceiveSections = (batch, seedIndex) => {
  const summary = batch.summary || {}
  const overview = [
    `本报告记录**${scopeNameOf(batch)}**接收批次，共接收 ${summary.totalReceived || 0} 条数据，覆盖 ${summary.interfaceCount ?? interfaceCountOf(batch)} 个接口。`,
    `本次接收批次监听范围为**${scopeNameOf(batch)}**，共接收 ${summary.totalReceived || 0} 条数据。`,
    `本报告依据独立接收批次生成，仅呈现接收、解析、校验和样本留存情况。`,
    `**${scopeNameOf(batch)}**接收批次已完成，异常数据与数据集保存情况可在后续章节查看。`
  ]
  const anomaly = exceptionVariants(batch)
  const conclusion = [
    `本批次共发现校验异常 ${summary.validationAbnormalCount || 0} 条、无法解析 ${summary.unparsedCount || 0} 条。`,
    `建议将有代表性的异常数据保存为测试数据集，并在后续独立发送批次中复现。`,
    `接收批次不需要处置闭环；用户可按需修改、保存或复用其中的数据样本。`,
    `本报告不推断发送来源，仅记录当前监听范围内实际收到的数据。`
  ]
  const index = Math.abs(seedIndex) % overview.length
  return [
    makeSection({ key: 'overview', title: '接收批次概述', kind: 'gen', content: overview[index], variants: overview, vi: index }),
    makeSection({ key: 'metrics', title: '接收规模', kind: 'data', content: receiveMetricsTable(batch) }),
    makeSection({ key: 'results', title: '接口接收分布', kind: 'data', content: receiveResultsTable(batch) }),
    makeSection({ key: 'anomaly', title: '异常数据样本', kind: 'gen', content: anomaly[index], variants: anomaly, vi: index }),
    makeSection({ key: 'conclusion', title: '结论与建议', kind: 'gen', content: conclusion[index], variants: conclusion, vi: index })
  ]
}

const buildSections = (batch, seedIndex = 0) =>
  batch.batchType === 'receive'
    ? buildReceiveSections(batch, seedIndex)
    : buildSendSections(batch, seedIndex)

export const REPORT_STAGES = [
  '解析所选联试批次数据…',
  '组织批次规模与接口明细…',
  '生成联试概述与分析段落…',
  '汇编结构化报告…'
]

export const useReportStore = defineStore('report', {
  state: () => ({
    /* —— 报告模板（全局，上传的 DOCX 文件） —— */
    templates: [
      { id: uid('tpl'), name: '标准联试报告模板', fileName: '标准联试报告模板.docx', size: '48 KB', uploadedAt: '2026-06-20 09:00' },
      { id: uid('tpl'), name: '异常专项报告模板', fileName: '异常专项报告模板.docx', size: '32 KB', uploadedAt: '2026-06-21 14:30' },
      { id: uid('tpl'), name: '交付报告模板', fileName: '交付报告模板.docx', size: '56 KB', uploadedAt: '2026-06-22 16:20' }
    ],

    /* —— C-1：章节方案（章节模板库：控制报告的章节构成与顺序） —— */
    chapterPresets: [
      { id: 'cp-standard', name: '标准结构', desc: '概述 / 规模 / 明细 / 结论', chapters: ['overview', 'metrics', 'results', 'anomaly', 'conclusion'] },
      { id: 'cp-concise', name: '精简结构', desc: '概述 / 明细 / 结论', chapters: ['overview', 'results', 'conclusion'] },
      { id: 'cp-data', name: '数据优先', desc: '概述 / 规模 / 明细（突出客观数据）', chapters: ['overview', 'metrics', 'results'] },
    ],

    /* —— 知识库：集合 → 文档 → 分块 —— */
    knowledgeCollections: [
      { id: 'kc-standard', name: '实验规范', color: '#0f8b8d', desc: '实验流程、判定口径与交付规范' },
      { id: 'kc-method', name: '测试方法', color: '#2f6feb', desc: '接口测试方法、异常定位和复现步骤' },
      { id: 'kc-report', name: '历史报告', color: '#6d5ce7', desc: '既往联试报告与问题处置记录' },
      { id: 'kc-case', name: '优秀案例', color: '#c98212', desc: '可复用的优秀联试案例与结论表达' },
    ],
    selectedKnowledgeCollectionIds: ['kc-standard', 'kc-method', 'kc-report', 'kc-case'],
    knowledgeDocs: [
      {
        id: uid('kb'), title: '接口超时处置规范.md', moduleId: null, source: '本地导入', type: 'md',
        collectionId: 'kc-method', version: 2, active: true, parseStatus: 'done', importedAt: '2026-06-20 10:12', vectorized: 'done',
        summary: '接口超时判定阈值、连接池耗尽排查思路与超时处置流程，适用于发送侧超时类异常定位。',
        chunks: [
          { idx: 1, text: '接口接收超过约定阈值（默认 2000ms）即判定为超时，应记录发送上下文、下游服务与连接池状态。' },
          { idx: 2, text: '连接池耗尽时优先排查 max_connections 配置与慢查询；网关层超时常由下游瓶颈引起。' },
          { idx: 3, text: '处置流程：定位下游服务 → 评估连接资源 → 调整阈值/扩容 → 回归验证。' }
        ]
      },
      {
        id: uid('kb'), title: '历史联试优秀案例汇编.md', moduleId: null, source: '本地导入', type: 'md',
        collectionId: 'kc-case', version: 1, active: true, parseStatus: 'done', importedAt: '2026-06-21 09:30', vectorized: 'done',
        summary: '优秀联试案例汇编：异常样本存库复现、报文与配置快照共同保存等可复用做法。',
        chunks: [
          { idx: 1, text: '某次接口联试中，将接收侧字段越界样本保存为数据集，后续在独立发送批次中完成复现。' },
          { idx: 2, text: '批量状态接口联试中，将无法解析报文与接口配置快照共同保存，便于后续追溯。' }
        ]
      },
      {
        id: uid('kb'), title: '联试报告撰写规范.txt', moduleId: null, source: '本地导入', type: 'txt',
        collectionId: 'kc-standard', version: 1, active: true, parseStatus: 'done', importedAt: '2026-06-22 14:05', vectorized: 'pending',
        summary: '联试报告撰写规范：报告应包含概述、关键指标、服务结果、异常分析与结论建议五部分。',
        chunks: [
          { idx: 1, text: '报告应包含概述、关键指标、服务结果、异常分析与结论建议五部分，结论需可追溯到数据。' }
        ]
      }
    ],

    /* —— 模型配置（全局，供「知识库管理」页 / 系统设置使用） —— */
    modelConfig: {
      provider: 'api',
      apiKey: 'sk-xxxxxxxxxxxxxxxx',
      baseUrl: 'https://api.example.com/v1',
      modelName: 'your-chat-model',
      embeddingModel: 'your-embed-model',
      temperature: 0.2,
      maxTokens: 4096,
      timeoutSec: 60,
      retryTimes: 2,
      retrievalTopK: 6,
      keywordWeight: 0.5,
      vectorWeight: 0.5,
      embeddingBatchSize: 16,
      enableFallback: true,
      auditLog: true,
      connection: null
    },

    /* —— 已生成报告 —— */
    reports: [],

    /* K1：检索反馈记录（key = `${docId}-${idx}`，值 ∈ [-0.6, 0.6]） */
    searchFeedback: {},

    currentReportId: null,
    generating: false,
    genStage: -1
  }),

  getters: {
    currentReport: (s) => s.reports.find((r) => r.id === s.currentReportId) || null,
    // 知识库统一管理，不按系统/模块过滤（保留 getter 名兼容旧调用）
    docsOfModule: (s) => () => s.knowledgeDocs,
    docsOfCollection: (s) => (collectionId) => s.knowledgeDocs.filter((doc) => !collectionId || doc.collectionId === collectionId),
    versionsOfReport: (s) => (report) => {
      if (!report) return []
      const lineageId = report.lineageId || report.id
      return s.reports
        .filter((r) => (r.lineageId || r.id) === lineageId)
        .sort((a, b) => (a.version || 1) - (b.version || 1))
    },
    /** K2：知识引用统计——遍历报告的知识引用，统计各文档被引用次数（Top 排序） */
    knowledgeRefStats: (s) => {
      const map = new Map()
      s.reports.forEach((report) => {
        (report.knowledgeCitations || []).forEach((citation) => {
          map.set(citation.docId, (map.get(citation.docId) || 0) + 1)
        })
      })
      return [...map.entries()]
        .map(([docId, count]) => ({
          docId,
          docTitle: s.knowledgeDocs.find((doc) => doc.id === docId)?.title || '未知文档',
          count,
        }))
        .sort((a, b) => b.count - a.count)
    }
  },

  actions: {
    /* —— 知识库（供独立页使用，保持不变） —— */
    addKnowledgeDoc(doc) {
      const d = {
        id: uid('kb'), title: doc.title || '未命名文档', moduleId: null, source: '本地导入',
        collectionId: doc.collectionId || this.knowledgeCollections[0]?.id || null,
        type: doc.type || 'md', kind: doc.kind === 'image' ? 'image' : doc.kind === 'case' ? 'case' : 'file', version: 1, active: true,
        importedAt: now(), parseStatus: doc.kind === 'image' ? 'ocr' : 'done', vectorized: 'pending',
        // B4：内容摘要（文本类导入时自动生成；非文本为占位说明）
        summary: doc.summary || '',
        chunks: doc.chunks || [{ idx: 1, text: '（导入文档内容，将自动分块）' }]
      }
      this.knowledgeDocs.unshift(d)
      return d
    },
    removeKnowledgeDoc(id) {
      const i = this.knowledgeDocs.findIndex((d) => d.id === id)
      if (i >= 0) this.knowledgeDocs.splice(i, 1)
    },

    /**
     * A-2：优秀案例知识化沉淀——认证优秀时生成「案例卡」入知识库（优秀案例集合）。
     * 幂等：同一优秀行（rowKey）已存在案例卡时更新而非新建。
     */
    addExcellentCase(data = {}) {
      const existing = this.knowledgeDocs.find((doc) => doc.kind === 'case' && doc.rowKey === data.rowKey)
      if (existing) {
        Object.assign(existing, {
          title: `${data.messageName} · 优秀案例`,
          summary: data.criteria || `由 ${data.certifier || '—'} 认证的优秀报文案例`,
          chunks: [
            { idx: 1, text: `认证人：${data.certifier || '—'}；达标指标：${data.criteria || '—'}` },
            { idx: 2, text: `适用场景：${data.scenario || '—'}；备注：${data.remark || '—'}` },
            ...(data.tags?.length ? [{ idx: 3, text: `标签：${data.tags.join('、')}` }] : []),
          ],
        })
        return existing
      }
      const d = {
        id: uid('kb'), title: `${data.messageName} · 优秀案例`, moduleId: null, source: '优秀库沉淀', type: 'case',
        kind: 'case', collectionId: 'kc-case', version: 1, active: true,
        importedAt: now(), parseStatus: 'done', vectorized: 'pending',
        summary: data.criteria || `由 ${data.certifier || '—'} 认证的优秀报文案例`,
        rowKey: data.rowKey, interfaceId: data.interfaceId, messageId: data.messageId,
        chunks: [
          { idx: 1, text: `认证人：${data.certifier || '—'}；达标指标：${data.criteria || '—'}` },
          { idx: 2, text: `适用场景：${data.scenario || '—'}；备注：${data.remark || '—'}` },
          ...(data.tags?.length ? [{ idx: 3, text: `标签：${data.tags.join('、')}` }] : []),
        ],
      }
      this.knowledgeDocs.unshift(d)
      return d
    },
    vectorize(id) {
      const d = this.knowledgeDocs.find((x) => x.id === id)
      if (!d) return Promise.resolve(false)
      d.vectorized = 'processing'
      return new Promise((resolve) => {
        setTimeout(() => {
          const ok = Math.random() > 0.15
          d.vectorized = ok ? 'done' : 'failed'
          resolve(ok)
        }, 900)
      })
    },
    retryKnowledgeProcessing(id) {
      const doc = this.knowledgeDocs.find((item) => item.id === id)
      if (!doc) return Promise.resolve(false)
      doc.parseStatus = doc.kind === 'image' ? 'ocr' : 'processing'
      return new Promise((resolve) => setTimeout(() => { doc.parseStatus = 'done'; resolve(true) }, 700))
    },
    toggleKnowledgeDoc(id) {
      const doc = this.knowledgeDocs.find((item) => item.id === id)
      if (doc) doc.active = !doc.active
    },
    replaceKnowledgeDoc(id) {
      const doc = this.knowledgeDocs.find((item) => item.id === id)
      if (!doc) return
      doc.version = Number(doc.version || 1) + 1
      doc.importedAt = now()
      doc.vectorized = 'pending'
      doc.parseStatus = 'done'
    },
    searchKnowledge(query, collectionIds = null, topK = 5, weights = {}) {
      const terms = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
      const hits = []
      this.knowledgeDocs.forEach((d) => {
        if (!d.active) return
        if (Array.isArray(collectionIds) && collectionIds.length && !collectionIds.includes(d.collectionId)) return
        d.chunks.forEach((c) => {
          const lower = c.text.toLowerCase()
          const kw = terms.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0) / (terms.length || 1)
          const vec = d.vectorized === 'done' ? 0.55 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3
          const keywordWeight = Number(weights.keyword ?? 0.5)
          const vectorWeight = Number(weights.vector ?? (1 - keywordWeight))
          // K1：检索反馈加权（有用 +0.15 / 无用 -0.2）
          const feedback = this.searchFeedback?.[`${d.id}-${c.idx}`] || 0
          const score = +(keywordWeight * kw + vectorWeight * vec + feedback).toFixed(3)
          hits.push({ docId: d.id, docTitle: d.title, idx: c.idx, text: c.text, kw: +kw.toFixed(2), vec: +vec.toFixed(2), feedback, score })
        })
      })
      return hits.sort((a, b) => b.score - a.score).slice(0, topK)
    },

    /** K1：记录检索反馈（有用 +1 / 无用 -1），影响后续排序 */
    recordFeedback(docId, idx, useful) {
      const key = `${docId}-${idx}`
      if (!this.searchFeedback) this.searchFeedback = {}
      const base = this.searchFeedback[key] || 0
      const delta = useful ? 0.15 : -0.2
      // 同向累计上限 ±0.6，避免单条反馈过度支配
      this.searchFeedback[key] = Math.max(-0.6, Math.min(0.6, base + delta))
    },

    /* —— 模型配置 —— */
    testConnection() {
      this.modelConfig.connection = 'testing'
      return new Promise((resolve) => {
        setTimeout(() => {
          const ok = !!this.modelConfig.modelName
          this.modelConfig.connection = ok ? 'ok' : 'fail'
          resolve(ok)
        }, 700)
      })
    },

    /* —— 模板（全局 DOCX） —— */
    addTemplate(file = {}) {
      const fileName = file.name || file.fileName || '新模板.docx'
      const name = fileName.replace(/\.docx$/i, '')
      const tpl = { id: uid('tpl'), name, fileName, size: file.size || '—', uploadedAt: now() }
      this.templates.unshift(tpl)
      return tpl
    },
    removeTemplate(id) {
      const i = this.templates.findIndex((t) => t.id === id)
      if (i >= 0) this.templates.splice(i, 1)
    },

    /* —— 生成报告（静态：进度模拟 + 按批次确定性组织 + 描述段变体） —— */
    async generateReport({ batchId, runId, title, templateId, materials, generatorName, knowledgeCollectionIds, regenerateFromId, chapterPresetId, titlePrefix } = {}) {
      if (this.generating) return null
      const run = useRunBatchStore().byId(batchId || runId)
      if (!run) return null
      const sourceReport = regenerateFromId ? this.reports.find((r) => r.id === regenerateFromId) : null
      const lineageId = sourceReport?.lineageId || sourceReport?.id || uid('line')
      const version = sourceReport
        ? Math.max(1, ...this.reports
          .filter((r) => (r.lineageId || r.id) === lineageId)
          .map((r) => r.version || 1)) + 1
        : 1
      const seedIndex = (version - 1) % 4
      // C1：优秀案例溯源——按批次接口范围收敛优秀历史报文（无接口范围时取全部）
      const testDataStore = useTestDataStore()
      const scopeIds = (run.scope?.interfaceIds || []).map(String)
      const excellentCaseCitations = testDataStore.allHistoryData
        .filter((h) => h.excellent)
        .filter((h) => !scopeIds.length || scopeIds.includes(String(h.interfaceId)))
        .slice(0, 5)
        .map((h) => ({
          rowKey: h._rowKey,
          messageName: h.messageName,
          interfaceId: h.interfaceId,
          usageCount: Number(h.usageCount || 0),
          certifier: h.certification?.certifier || '—'
        }))
      const fallbackTitle = `${scopeNameOf(run)} ${run.batchType === 'receive' ? '接收' : '发送'}联试报告`
      this.generating = true
      this.genStage = 0
      for (let i = 0; i < REPORT_STAGES.length; i++) {
        this.genStage = i
        await new Promise((r) => setTimeout(r, 420 + Math.random() * 260))
      }
      // C-1：占位符变量渲染（标题支持 {{batchName}} {{scopeName}} {{batchType}} 等）
      const vars = this.templateVars(run, { generatorName, titlePrefix })
      const renderedTitle = title
        ? this.renderVars(title, vars)
        : titlePrefix
          ? `${this.renderVars(titlePrefix, vars)} ${fallbackTitle}`
          : sourceReport?.title || fallbackTitle
      // C-1：章节方案（过滤并排序章节构成）
      let sections = buildSections(run, seedIndex)
      const preset = chapterPresetId ? this.chapterPresets.find((p) => p.id === chapterPresetId) : null
      if (preset) {
        const order = preset.chapters
        sections = sections
          .filter((s) => order.includes(s.key))
          .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      }
      const rep = {
        id: uid('rep'),
        lineageId,
        version,
        title: renderedTitle,
        batchId: run.id,
        batchType: run.batchType || 'send',
        runId: run.id,
        runName: run.name,
        taskCreator: run.taskCreator || '—',
        generatorName: generatorName || '—',
        templateId: templateId || null,
        chapterPresetId: preset?.id || null,
        materials: (materials || []).map((m) => ({ ...m })),
        knowledgeCollectionIds: [...(knowledgeCollectionIds || this.selectedKnowledgeCollectionIds || [])],
        knowledgeCitations: this.searchKnowledge(scopeNameOf(run), knowledgeCollectionIds || this.selectedKnowledgeCollectionIds, 3),
        excellentCaseCitations,
        createdAt: now(),
        status: 'done',
        sections,
        sourceReportId: sourceReport?.id || null,
        seedIndex
      }
      this.reports.unshift(rep)
      this.currentReportId = rep.id
      this.generating = false
      this.genStage = -1
      return rep
    },

    /**
     * C-1：占位符变量上下文（全部来自批次客观数据）。
     * 可用变量：batchName / scopeName / batchType / interfaceCount / sentCount / receivedCount / taskCreator / generator / createdAt
     */
    templateVars(run = {}, meta = {}) {
      const summary = run.summary || {}
      return {
        batchName: run.name || '',
        scopeName: run.scope?.displayName || '未命名接口范围',
        batchType: run.batchType === 'receive' ? '接收' : '发送',
        interfaceCount: run.scope?.interfaceIds?.length || 0,
        sentCount: summary.sentCount ?? summary.totalRequests ?? 0,
        receivedCount: summary.totalReceived ?? 0,
        taskCreator: run.taskCreator || '—',
        generator: meta.generatorName || '—',
        titlePrefix: meta.titlePrefix || '',
        createdAt: now(),
      }
    },
    /** C-1：替换 {{变量}} 占位符（未识别变量原样保留） */
    renderVars(text = '', vars = {}) {
      return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in vars ? vars[key] : match))
    },

    /**
     * C-3：批量生成报告（按批次依次执行，复用生成管线）。
     * @returns {Array<object>} 生成的报告列表
     */
    async generateBatch({ batchIds = [], chapterPresetId, generatorName, knowledgeCollectionIds, titlePrefix = '' }) {
      const runStore = useRunBatchStore()
      const ids = (batchIds || []).filter(Boolean)
      const results = []
      this.generating = true
      for (let i = 0; i < ids.length; i += 1) {
        const run = runStore.byId(ids[i])
        if (!run) continue
        this.genStage = Math.round((i / Math.max(ids.length, 1)) * (REPORT_STAGES.length - 1))
        const rep = await this.generateReport({
          batchId: run.id,
          titlePrefix,
          generatorName,
          knowledgeCollectionIds: knowledgeCollectionIds || this.selectedKnowledgeCollectionIds,
          chapterPresetId,
        })
        if (rep) results.push(rep)
      }
      this.generating = false
      this.genStage = -1
      return results
    },

    // 描述性章节轮换内容（不暴露 RAG，仅作为「重新生成」）
    regenerateSection(report, sectionKey, comment = '') {
      const sec = report?.sections.find((s) => s.key === sectionKey)
      if (!sec || sec.kind !== 'gen' || !sec.variants || sec.variants.length < 2) return
      const text = String(comment || '').trim()
      if (text) {
        if (!Array.isArray(sec.comments)) sec.comments = []
        sec.comments.push({ id: uid('cmt'), text, createdAt: now() })
      }
      sec.vi = (sec.vi + 1) % sec.variants.length
      sec.content = sec.variants[sec.vi]
    },

    selectReport(id) { this.currentReportId = id },
    removeReport(id) {
      const i = this.reports.findIndex((r) => r.id === id)
      if (i >= 0) this.reports.splice(i, 1)
      if (this.currentReportId === id) this.currentReportId = null
    },

    reportMarkdown(report, options = {}) {
      if (!report) return ''
      const { includeTitle = true, includeMeta = true } = options
      const parts = []
      if (includeTitle) parts.push(`# ${report.title}`)
      if (includeMeta) {
        parts.push([
          `- 批次创建者：${report.taskCreator || '—'}`,
          `- 报告生成者：${report.generatorName || '—'}`,
          `- 联试批次：${report.runName || '—'}`,
          `- 生成时间：${report.createdAt || '—'}`
        ].join('\n'))
      }
      parts.push(report.sections.map((s) => `## ${s.title}\n\n${s.content}\n`).join('\n'))
      // C1：导出附溯源引用，使 DOCX/PDF 等导出物携带知识引用与优秀案例来源
      const cites = []
      if (report.knowledgeCitations?.length) {
        cites.push(`## 知识引用\n` + report.knowledgeCitations.map((c) => `- ${c.docTitle} #${c.idx}`).join('\n'))
      }
      if (report.excellentCaseCitations?.length) {
        cites.push(`## 优秀案例溯源\n` + report.excellentCaseCitations.map((c) => `- ${c.messageName}（认证人：${c.certifier}，引用 ${c.usageCount} 次）`).join('\n'))
      }
      if (cites.length) parts.push(cites.join('\n\n'))
      return `${parts.join('\n\n')}\n`
    }
  }
})
