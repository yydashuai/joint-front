import { defineStore } from 'pinia'

let seq = 9000
const uid = (p = 'r') => `${p}-${++seq}`
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

/* ============================================================
 * 联试报告 store（三步式向导）
 *  - 报告主体 = 测试执行编排的「一轮执行」(execution run)
 *  - 硬数据章节由所选批次的 summary / stepResults / 异常确定性组织
 *  - 描述性章节给多份变体，「重新生成」时轮换（体现生成灵活，不暴露 RAG）
 *  - 模板 = 上传的 DOCX 文件（全局复用），素材 = 生成时按需上传
 *  - 知识库 / 模型配置保留，供独立的「知识库管理」页使用，本向导不引用
 * ========================================================== */

// 章节 kind 仅为内部字段，决定描述段能否「重新生成」，UI 不暴露
const makeSection = (o = {}) => ({ key: uid('sec'), title: '', kind: 'gen', content: '', variants: [], vi: 0, ...o })

/* —— 由执行批次确定性组织硬数据章节 —— */
const metricsTable = (run) => {
  const s = run.summary
  const ifaceCount = new Set(run.stepResults.map((r) => r.iface)).size
  const severe = run.exceptions.filter((e) => e.level === '高').length
  return `| 指标 | 数值 | 指标 | 数值 |
| --- | --- | --- | --- |
| 请求总量 | ${s.totalRequests} | 成功率 | ${s.passRate}% |
| 平均延迟 | ${s.avgResponseTime} ms | P95 延迟 | ${s.p95} ms |
| 覆盖任务 | ${run.stepResults.length} 个 | 覆盖接口 | ${ifaceCount} 个 |
| 异常事件 | ${s.failedRequests + s.errorRequests} 条 | 严重异常 | ${severe} 条 |`
}

const resultsTable = (run) => {
  const head = `| 任务 | 接口 | 请求数 | 成功 | 平均延迟 | 结果 |
| --- | --- | --- | --- | --- | --- |`
  const rows = run.stepResults
    .map((r) => `| ${r.taskName} | ${r.iface} | ${r.total} | ${r.success} | ${r.avgMs} ms | ${r.result} |`)
    .join('\n')
  return `${head}\n${rows}`
}

/* —— 描述性章节变体（轮换） —— */
const overviewVariants = (run, sysName) => [
  `本次联试针对**${sysName}**开展全流程接口联试，共执行 ${run.stepResults.length} 个任务、${run.summary.totalRequests} 次请求，整体成功率 **${run.summary.passRate}%**，总体结论为 **${run.result}**。`,
  `本轮联试围绕**${sysName}**的关键接口与链路稳定性展开，累计发送 ${run.summary.totalRequests} 次请求，平均延迟 ${run.summary.avgResponseTime} ms，成功率 ${run.summary.passRate}%，未出现阻断性故障，评定为 **${run.result}**。`
]

const anomalyVariants = (run) => {
  const exs = run.exceptions
  if (!exs.length) {
    return [
      '本次联试全程未捕获异常事件，各接口响应均通过类型、取值范围与超时校验。',
      '本轮执行无异常记录，基础规则（类型 / 取值 / 边界 / 超时）判定全部通过。'
    ]
  }
  const lines = exs.map((e) => `- **[${e.level}] ${e.time}** — ${e.iface}：${e.message}`).join('\n')
  return [
    `本次联试共捕获 **${exs.length} 处异常**，明细如下：\n\n${lines}`,
    `异常集中在少数接口，共 **${exs.length} 处**：\n\n${lines}\n\n建议结合接口超时与取值规则进一步定位。`
  ]
}

const conclusionVariants = (run) => [
  `本次联试整体${run.result}。改进建议：\n\n1. 重点核查存在异常的接口，确认取值范围与超时阈值设置。\n2. 对平均延迟偏高的链路优化批量处理或引入结果缓存。\n3. 修复后重跑一轮全量联试以验证修复效果。`,
  `综合评定为 **${run.result}**。后续建议：优先治理异常接口、复核延迟偏高的链路，并以本轮成功率 ${run.summary.passRate}% 作为后续回归的基线指标。`
]

// 由 run + 系统名 组装一份报告的章节（硬数据确定性 + 描述段变体）
const buildSections = (run, sysName) => {
  const ov = overviewVariants(run, sysName)
  const an = anomalyVariants(run)
  const co = conclusionVariants(run)
  return [
    makeSection({ key: 'overview', title: '联试概述', kind: 'gen', content: ov[0], variants: ov }),
    makeSection({ key: 'metrics', title: '关键指标', kind: 'data', content: metricsTable(run) }),
    makeSection({ key: 'results', title: '接口测试结果', kind: 'data', content: resultsTable(run) }),
    makeSection({ key: 'anomaly', title: '异常分析', kind: 'gen', content: an[0], variants: an }),
    makeSection({ key: 'conclusion', title: '结论与建议', kind: 'gen', content: co[0], variants: co })
  ]
}

export const REPORT_STAGES = [
  '解析所选执行批次数据…',
  '组织关键指标与结果表…',
  '生成联试概述与分析段落…',
  '汇编结构化报告…'
]

/* ===================== 预置执行批次（静态演示数据源） ===================== */
const seedRuns = () => [
  {
    id: uid('run'), systemId: 'sys-weapon', name: '武器管理-高并发联试',
    startedAt: '2026-06-23 09:05', finishedAt: '2026-06-23 10:15', durationText: '70 min', result: '存在异常',
    summary: { totalRequests: 18432, successRequests: 17855, failedRequests: 432, errorRequests: 145, avgResponseTime: 124, p95: 287, passRate: 96.9 },
    stepResults: [
      { taskName: '任务分配冒烟', iface: 'POST:/missions/assign', total: 4821, success: 4810, failed: 8, error: 3, avgMs: 98, result: '通过' },
      { taskName: '飞机状态批量查询', iface: 'GET:/aircraft/status/batch', total: 3654, success: 3598, failed: 41, error: 15, avgMs: 143, result: '存在异常' },
      { taskName: '武器载荷压测', iface: 'POST:/weapons/loadout', total: 2341, success: 2198, failed: 98, error: 45, avgMs: 187, result: '存在异常' },
      { taskName: '情报融合联试', iface: 'POST:/intel/fuse', total: 1543, success: 1540, failed: 2, error: 1, avgMs: 203, result: '通过' }
    ],
    exceptions: [
      { level: '高', time: '09:12:33', iface: 'POST:/weapons/loadout', message: '连接超时，网关响应超过 2500ms' },
      { level: '高', time: '09:28:17', iface: 'POST:/weapons/loadout', message: 'SocketTimeoutException: Read timed out' },
      { level: '高', time: '09:51:44', iface: 'POST:/weapons/loadout', message: '数据库连接池耗尽（max=100 已满）' },
      { level: '中', time: '09:03:28', iface: 'GET:/aircraft/status/batch', message: 'P95 延迟超阈值，298ms > 280ms' }
    ]
  },
  {
    id: uid('run'), systemId: 'sys-weapon', name: '弹药状态回归联试',
    startedAt: '2026-06-24 14:00', finishedAt: '2026-06-24 14:26', durationText: '26 min', result: '通过',
    summary: { totalRequests: 5210, successRequests: 5190, failedRequests: 16, errorRequests: 4, avgResponseTime: 88, p95: 176, passRate: 99.6 },
    stepResults: [
      { taskName: '弹药状态查询', iface: 'GET:/ammo/status', total: 3120, success: 3112, failed: 6, error: 2, avgMs: 72, result: '通过' },
      { taskName: '装控指令下发', iface: 'POST:/ammo/command', total: 2090, success: 2078, failed: 10, error: 2, avgMs: 112, result: '通过' }
    ],
    exceptions: [
      { level: '中', time: '14:11:06', iface: 'POST:/ammo/command', message: '字段越界：装填数量超出取值范围' }
    ]
  },
  {
    id: uid('run'), systemId: 'sys-fire', name: '火控解算联试',
    startedAt: '2026-06-25 10:30', finishedAt: '2026-06-25 11:08', durationText: '38 min', result: '通过',
    summary: { totalRequests: 7640, successRequests: 7602, failedRequests: 30, errorRequests: 8, avgResponseTime: 96, p95: 198, passRate: 99.5 },
    stepResults: [
      { taskName: '目标分配联试', iface: 'POST:/targets/assign', total: 4100, success: 4086, failed: 11, error: 3, avgMs: 84, result: '通过' },
      { taskName: '火控解算冒烟', iface: 'POST:/fire/solve', total: 3540, success: 3516, failed: 19, error: 5, avgMs: 110, result: '通过' }
    ],
    exceptions: [
      { level: '中', time: '10:52:19', iface: 'POST:/fire/solve', message: '格式错误：解算结果字段类型不符' }
    ]
  }
]

export const useReportStore = defineStore('report', {
  state: () => ({
    /* —— 报告模板（全局，上传的 DOCX 文件） —— */
    templates: [
      { id: uid('tpl'), name: '标准联试报告模板', fileName: '标准联试报告模板.docx', size: '48 KB', uploadedAt: '2026-06-20 09:00' },
      { id: uid('tpl'), name: '异常专项报告模板', fileName: '异常专项报告模板.docx', size: '32 KB', uploadedAt: '2026-06-21 14:30' }
    ],

    /* —— 执行批次（报告数据源） —— */
    runs: seedRuns(),

    /* —— 知识库（供「知识库管理」页使用，本向导不引用） —— */
    knowledgeDocs: [
      {
        id: uid('kb'), title: '接口超时处置规范.md', moduleId: null, source: '本地导入', type: 'md',
        importedAt: '2026-06-20 10:12', vectorized: 'done',
        chunks: [
          { idx: 1, text: '接口响应超过约定阈值（默认 2000ms）即判定为超时，应记录请求上下文、下游服务与连接池状态。' },
          { idx: 2, text: '连接池耗尽时优先排查 max_connections 配置与慢查询；网关层超时常由下游瓶颈引起。' },
          { idx: 3, text: '处置流程：定位下游服务 → 评估连接资源 → 调整阈值/扩容 → 回归验证。' }
        ]
      },
      {
        id: uid('kb'), title: '历史联试优秀案例汇编.md', moduleId: null, source: '本地导入', type: 'md',
        importedAt: '2026-06-21 09:30', vectorized: 'done',
        chunks: [
          { idx: 1, text: '某型武器管理系统联试：高峰时段武器载荷链路超时，扩容连接池至 200 后成功率由 93.9% 升至 99.2%。' },
          { idx: 2, text: '批量状态查询接口引入结果缓存后，P95 延迟由 298ms 降至 160ms。' }
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
    // 执行批次按系统过滤（null = 全部系统）
    runsOfSystem: (s) => (sysId) => (sysId == null ? s.runs : s.runs.filter((r) => r.systemId === sysId)),
    // 知识库统一管理，不按系统/模块过滤（保留 getter 名兼容旧调用）
    docsOfModule: (s) => () => s.knowledgeDocs,
    reportsOfSystem: (s) => (sysId) => (sysId == null ? s.reports : s.reports.filter((r) => r.systemId === sysId))
  },

  actions: {
    /* —— 知识库（供独立页使用，保持不变） —— */
    addKnowledgeDoc(doc) {
      const d = {
        id: uid('kb'), title: doc.title || '未命名文档', moduleId: null, source: '本地导入',
        type: doc.type || 'md', importedAt: now(), vectorized: 'pending',
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
    async generateReport({ systemId, runId, title, templateId, materials, sysName } = {}) {
      if (this.generating) return null
      const run = this.runs.find((r) => r.id === runId)
      if (!run) return null
      this.generating = true
      this.genStage = 0
      for (let i = 0; i < REPORT_STAGES.length; i++) {
        this.genStage = i
        await new Promise((r) => setTimeout(r, 420 + Math.random() * 260))
      }
      const rep = {
        id: uid('rep'),
        title: title || `${run.name}报告`,
        systemId: systemId ?? run.systemId,
        runId: run.id,
        runName: run.name,
        templateId: templateId || null,
        materials: (materials || []).map((m) => ({ ...m })),
        createdAt: now(),
        status: 'done',
        sections: buildSections(run, sysName || '')
      }
      this.reports.unshift(rep)
      this.currentReportId = rep.id
      this.generating = false
      this.genStage = -1
      return rep
    },

    // 描述性章节轮换内容（不暴露 RAG，仅作为「重新生成」）
    regenerateSection(report, sectionKey) {
      const sec = report?.sections.find((s) => s.key === sectionKey)
      if (!sec || sec.kind !== 'gen' || !sec.variants || sec.variants.length < 2) return
      sec.vi = (sec.vi + 1) % sec.variants.length
      sec.content = sec.variants[sec.vi]
    },

    selectReport(id) { this.currentReportId = id },
    removeReport(id) {
      const i = this.reports.findIndex((r) => r.id === id)
      if (i >= 0) this.reports.splice(i, 1)
      if (this.currentReportId === id) this.currentReportId = null
    },

    reportMarkdown(report) {
      if (!report) return ''
      return `# ${report.title}\n\n` + report.sections.map((s) => `## ${s.title}\n\n${s.content}\n`).join('\n')
    }
  }
})
