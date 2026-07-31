import { defineStore } from 'pinia'
import { useRunBatchStore } from '@/stores/runBatch'

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
const finishTextOf = (batch) => batch.finishReason === 'terminated' ? '手动终止归档' : '自然完成归档'
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
| 使用数据集 | ${summary.datasetCount || 0} 个 | 批次时长 | ${summary.durationSeconds ?? summary.executionTime ?? 0} 秒 |
| 完成方式 | ${finishTextOf(batch)} | 批次状态 | 已完成 |`
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

const buildSendSections = (batch, sysName, seedIndex) => {
  const summary = batch.summary || {}
  const sent = summary.sentCount ?? summary.totalRequests ?? 0
  const planned = summary.plannedCount ?? sent
  const unsent = summary.unsentCount ?? Math.max(0, planned - sent)
  const overview = [
    `本报告记录**${scopeNameOf(batch)}**发送批次。计划发送 ${planned} 条，实际发送 ${sent} 条，覆盖 ${interfaceCountOf(batch)} 个接口。`,
    `本次发送批次归属**${sysName || '未归属系统'}**，执行范围为**${scopeNameOf(batch)}**，批次以${finishTextOf(batch)}方式完成。`,
    `本报告仅呈现发送侧客观记录，不将接收数据与本批次建立请求—响应关系。实际发送 ${sent} 条，未发送 ${unsent} 条。`,
    `**${scopeNameOf(batch)}**发送批次已完成归档，接口发送数量和数据来源详见后续表格。`
  ]
  const conclusion = [
    `本批次已完成发送归档。${unsent ? `仍有 ${unsent} 条计划数据未发送，后续可新建批次继续验证。` : '计划数据已全部发送。'}`,
    `发送记录已冻结，可作为后续接收观测或重复发送测试的数据依据。`,
    `本报告不对被测系统业务结果作正确性判定，仅确认本批次的发送范围和实际发送记录。`,
    `建议保留当前批次作为发送侧追溯依据；如需调整数据，应新建发送批次。`
  ]
  const index = Math.abs(seedIndex) % overview.length
  return [
    makeSection({ key: 'overview', title: '发送批次概述', kind: 'gen', content: overview[index], variants: overview, vi: index }),
    makeSection({ key: 'metrics', title: '发送规模', kind: 'data', content: sendMetricsTable(batch) }),
    makeSection({ key: 'results', title: '接口发送明细', kind: 'data', content: sendResultsTable(batch) }),
    makeSection({ key: 'conclusion', title: '归档说明', kind: 'gen', content: conclusion[index], variants: conclusion, vi: index })
  ]
}

const buildReceiveSections = (batch, sysName, seedIndex) => {
  const summary = batch.summary || {}
  const overview = [
    `本报告记录**${scopeNameOf(batch)}**接收批次，共接收 ${summary.totalReceived || 0} 条数据，覆盖 ${summary.interfaceCount ?? interfaceCountOf(batch)} 个接口。`,
    `本次接收批次归属**${sysName || '未归属系统'}**，监听范围为**${scopeNameOf(batch)}**，批次以${finishTextOf(batch)}方式完成。`,
    `本报告依据独立接收批次生成，仅呈现接收、解析、校验和样本留存情况。`,
    `**${scopeNameOf(batch)}**接收批次已完成归档，异常数据与数据集保存情况可在后续章节追溯。`
  ]
  const anomaly = exceptionVariants(batch)
  const conclusion = [
    `本批次接收数据已完成归档，其中校验异常 ${summary.validationAbnormalCount || 0} 条、无法解析 ${summary.unparsedCount || 0} 条。`,
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
    makeSection({ key: 'conclusion', title: '归档与复用建议', kind: 'gen', content: conclusion[index], variants: conclusion, vi: index })
  ]
}

const buildSections = (batch, sysName, seedIndex = 0) =>
  batch.batchType === 'receive'
    ? buildReceiveSections(batch, sysName, seedIndex)
    : buildSendSections(batch, sysName, seedIndex)

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
      { id: uid('tpl'), name: '交付归档报告模板', fileName: '交付归档报告模板.docx', size: '56 KB', uploadedAt: '2026-06-22 16:20' }
    ],

    /* —— 知识库（供「知识库管理」页使用，本向导不引用） —— */
    knowledgeDocs: [
      {
        id: uid('kb'), title: '接口超时处置规范.md', moduleId: null, source: '本地导入', type: 'md',
        importedAt: '2026-06-20 10:12', vectorized: 'done',
        chunks: [
          { idx: 1, text: '接口接收超过约定阈值（默认 2000ms）即判定为超时，应记录发送上下文、下游服务与连接池状态。' },
          { idx: 2, text: '连接池耗尽时优先排查 max_connections 配置与慢查询；网关层超时常由下游瓶颈引起。' },
          { idx: 3, text: '处置流程：定位下游服务 → 评估连接资源 → 调整阈值/扩容 → 回归验证。' }
        ]
      },
      {
        id: uid('kb'), title: '历史联试优秀案例汇编.md', moduleId: null, source: '本地导入', type: 'md',
        importedAt: '2026-06-21 09:30', vectorized: 'done',
        chunks: [
          { idx: 1, text: '某型武器管理系统联试：将接收侧字段越界样本保存为数据集，后续在独立发送批次中完成复现。' },
          { idx: 2, text: '批量状态接口联试中，将无法解析报文与接口配置快照共同归档，便于后续追溯。' }
        ]
      },
      {
        id: uid('kb'), title: '联试报告撰写规范.txt', moduleId: null, source: '本地导入', type: 'txt',
        importedAt: '2026-06-22 14:05', vectorized: 'pending',
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

    /* —— 已生成报告（归属 系统 + 批次） —— */
    reports: [],

    currentReportId: null,
    generating: false,
    genStage: -1
  }),

  getters: {
    currentReport: (s) => s.reports.find((r) => r.id === s.currentReportId) || null,
    // 已归档联试批次按系统过滤（null = 全部系统）
    runsOfSystem: () => (sysId) => useRunBatchStore().reportable.filter((batch) => sysId == null || batch.systemId === sysId),
    // 知识库统一管理，不按系统/模块过滤（保留 getter 名兼容旧调用）
    docsOfModule: (s) => () => s.knowledgeDocs,
    reportsOfSystem: (s) => (sysId) => (sysId == null ? s.reports : s.reports.filter((r) => r.systemId === sysId)),
    versionsOfReport: (s) => (report) => {
      if (!report) return []
      const lineageId = report.lineageId || report.id
      return s.reports
        .filter((r) => (r.lineageId || r.id) === lineageId)
        .sort((a, b) => (a.version || 1) - (b.version || 1))
    }
  },

  actions: {
    /* —— 知识库（供独立页使用，保持不变） —— */
    addKnowledgeDoc(doc) {
      const d = {
        id: uid('kb'), title: doc.title || '未命名文档', moduleId: null, source: '本地导入',
        type: doc.type || 'md', kind: doc.kind === 'image' ? 'image' : 'file',
        importedAt: now(), vectorized: 'pending',
        chunks: doc.chunks || [{ idx: 1, text: '（导入文档内容，将自动分块）' }]
      }
      this.knowledgeDocs.unshift(d)
      return d
    },
    removeKnowledgeDoc(id) {
      const i = this.knowledgeDocs.findIndex((d) => d.id === id)
      if (i >= 0) this.knowledgeDocs.splice(i, 1)
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
    searchKnowledge(query, moduleId = null, topK = 5) {
      const terms = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
      const hits = []
      this.knowledgeDocs.forEach((d) => {
        d.chunks.forEach((c) => {
          const lower = c.text.toLowerCase()
          const kw = terms.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0) / (terms.length || 1)
          const vec = d.vectorized === 'done' ? 0.55 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3
          const score = +(0.5 * kw + 0.5 * vec).toFixed(3)
          hits.push({ docId: d.id, docTitle: d.title, idx: c.idx, text: c.text, kw: +kw.toFixed(2), vec: +vec.toFixed(2), score })
        })
      })
      return hits.sort((a, b) => b.score - a.score).slice(0, topK)
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
    async generateReport({ systemId, batchId, runId, title, templateId, materials, sysName, generatorName, regenerateFromId } = {}) {
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
      const fallbackTitle = `${scopeNameOf(run)} ${run.batchType === 'receive' ? '接收' : '发送'}联试报告`
      this.generating = true
      this.genStage = 0
      for (let i = 0; i < REPORT_STAGES.length; i++) {
        this.genStage = i
        await new Promise((r) => setTimeout(r, 420 + Math.random() * 260))
      }
      const rep = {
        id: uid('rep'),
        lineageId,
        version,
        title: title || sourceReport?.title || fallbackTitle,
        systemId: systemId ?? run.systemId,
        batchId: run.id,
        batchType: run.batchType || 'send',
        runId: run.id,
        runName: run.name,
        taskCreator: run.taskCreator || '—',
        generatorName: generatorName || '—',
        templateId: templateId || null,
        materials: (materials || []).map((m) => ({ ...m })),
        createdAt: now(),
        status: 'done',
        sections: buildSections(run, sysName || '', seedIndex),
        sourceReportId: sourceReport?.id || null,
        seedIndex
      }
      this.reports.unshift(rep)
      this.currentReportId = rep.id
      this.generating = false
      this.genStage = -1
      return rep
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
          `- 批次来源：${report.taskCreator || '—'}`,
          `- 报告生成者：${report.generatorName || '—'}`,
          `- 联试批次：${report.runName || '—'}`,
          `- 生成时间：${report.createdAt || '—'}`
        ].join('\n'))
      }
      parts.push(report.sections.map((s) => `## ${s.title}\n\n${s.content}\n`).join('\n'))
      return `${parts.join('\n\n')}\n`
    }
  }
})
