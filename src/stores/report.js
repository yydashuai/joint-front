import { defineStore } from 'pinia'
import { nodes as seedNodes } from '@/mock/seed-data'

let seq = 9000
const uid = (p = 'r') => `${p}-${++seq}`
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
// 按 系统+模块名 取模块 id（知识库/模板/素材均按模块归类）
const modId = (sys, name) => seedNodes.find((n) => n.systemId === sys && n.name === name)?.id ?? null

const WM = modId('sys-weapon', '武器管理模块') // 主演示模块（资源较全）
const AM = modId('sys-weapon', '弹药状态模块') // 次演示模块

// 章节粒度（generation-flexible）：
//   kind: 'data' = 硬数据章节（由所选联试数据确定性生成，不走模型、可审计）
//         'gen'  = 描述性章节（RAG 检索知识库 + 数据 → 模型生成，可单章重生成）
const makeSection = (o = {}) => ({ key: uid('sec'), title: '', kind: 'gen', content: '', ...o })

/* ===================== 预置内容（静态设计：模拟生成结果） ===================== */
const DATA_SECTIONS = {
  metrics: `| 指标 | 数值 | 指标 | 数值 |
| --- | --- | --- | --- |
| 链路总量 | 18,432 | 成功率 | 96.87% |
| 平均延迟 | 124 ms | P95 延迟 | 287 ms |
| 覆盖服务 | 8 个 | 覆盖接口 | 23 个 |
| 异常事件 | 12 条 | 严重异常 | 3 条 |`,
  services: `| 服务 | 链路数 | 成功数 | 平均延迟 | 状态 |
| --- | --- | --- | --- | --- |
| 任务分配服务 | 4,821 | 4,810 | 98 ms | 正常 |
| 作战指令服务 | 3,654 | 3,598 | 143 ms | 正常 |
| 飞机状态服务 | 2,987 | 2,941 | 112 ms | 警告 |
| 武器载荷服务 | 2,341 | 2,198 | 187 ms | 异常 |
| 情报融合服务 | 1,543 | 1,540 | 203 ms | 正常 |`
}
// 描述性章节（RAG 生成）——每个 key 给多份变体，「重新生成」时轮换，体现"生成灵活"
const GEN_VARIANTS = {
  overview: [
    '本次联试针对**综合武器管理系统**核心业务链路开展全流程验证，覆盖任务分配、作战指令下发、飞机状态采集、武器载荷管理等关键服务。联试累计采集链路追踪数据 18,432 条，整体成功率 **96.87%**，结论为 **通过**。',
    '本轮联试围绕**综合武器管理系统**的关键接口与链路稳定性展开，重点验证高并发场景下任务分配与武器载荷链路的可用性。共执行 23 个接口、8 项服务，链路成功率 96.87%，未出现阻断性故障，总体评定为 **通过**。'
  ],
  anomaly: [
    '本次联试共发现 **3 处严重异常**，集中于武器载荷服务：\n\n- **[严重] 09:12:33** — POST:/weapons/loadout：连接超时，网关响应超过 2500ms\n- **[严重] 09:28:17** — POST:/weapons/loadout：SocketTimeoutException: Read timed out\n- **[严重] 09:51:44** — POST:/weapons/loadout：数据库连接池耗尽（max=100 已满）\n\n结合知识库《接口超时处置规范》，上述现象符合「下游网关瓶颈 + 连接资源不足」的典型特征。',
    '异常主要表现为武器载荷服务的 **3 次严重超时**，均发生在高峰时段（09:10–09:55）。参照知识库中历史案例，此类超时与连接池容量、网关并发上限强相关；另有 2 处 P95 延迟越阈告警，属性能波动、未影响结果正确性。'
  ],
  conclusion: [
    '本次联试整体通过，核心链路稳定。改进建议：\n\n1. **武器载荷服务超时**：优化连接池配置（max_connections 提升至 200），网关超时阈值提升至 3000ms。\n2. **飞机状态服务延迟**：关注高峰时段批量查询性能，必要时引入结果缓存。\n3. 建议完成上述优化后重跑一轮全量联试验证修复效果。',
    '综合评定为**通过**。后续建议：优先治理武器载荷服务的连接资源瓶颈；对飞机状态服务的批量接口做分页与缓存；并将本轮成功率（96.87%）作为后续回归的基线指标。'
  ]
}

const buildSections = () => [
  makeSection({ key: 'overview', title: '联试概述', kind: 'gen', content: GEN_VARIANTS.overview[0] }),
  makeSection({ key: 'metrics', title: '关键指标', kind: 'data', content: DATA_SECTIONS.metrics }),
  makeSection({ key: 'services', title: '服务测试结果', kind: 'data', content: DATA_SECTIONS.services }),
  makeSection({ key: 'anomaly', title: '异常分析', kind: 'gen', content: GEN_VARIANTS.anomaly[0] }),
  makeSection({ key: 'conclusion', title: '结论与建议', kind: 'gen', content: GEN_VARIANTS.conclusion[0] })
]

export const REPORT_STAGES = [
  '解析所选联试数据…',
  '从该模块知识库检索相关片段…',
  '组织硬数据章节（指标 / 服务结果）…',
  '大模型生成描述性章节…',
  '汇编结构化报告…'
]

export const useReportStore = defineStore('report', {
  state: () => ({
    /* —— 报告模板（按模块归类，轻量章节骨架） —— */
    templates: [
      {
        id: uid('tpl'), name: '标准联试报告', moduleId: WM, desc: '概述 + 指标 + 服务结果 + 异常 + 结论，最常用',
        sections: [
          { key: 'overview', title: '联试概述', kind: 'gen', hint: '简述联试目标、范围、总体结论' },
          { key: 'metrics', title: '关键指标', kind: 'data', hint: '从执行结果取链路/成功率/延迟等' },
          { key: 'services', title: '服务测试结果', kind: 'data', hint: '各服务链路统计表' },
          { key: 'anomaly', title: '异常分析', kind: 'gen', hint: '结合知识库分析异常成因' },
          { key: 'conclusion', title: '结论与建议', kind: 'gen', hint: '给出结论与改进建议' }
        ]
      },
      {
        id: uid('tpl'), name: '异常专项报告', moduleId: AM, desc: '聚焦异常事件的精简模板',
        sections: [
          { key: 'overview', title: '背景概述', kind: 'gen', hint: '异常专项的背景' },
          { key: 'anomaly', title: '异常明细与分析', kind: 'gen', hint: '逐条异常 + 成因' },
          { key: 'conclusion', title: '处置建议', kind: 'gen', hint: '处置与预防建议' }
        ]
      }
    ],

    /* —— 知识库（RAG，按模块归类）：文档 + 分块 + 向量化状态 —— */
    knowledgeDocs: [
      {
        id: uid('kb'), title: '接口超时处置规范.md', moduleId: WM, source: '本地导入', type: 'md',
        importedAt: '2026-06-20 10:12', vectorized: 'done',
        chunks: [
          { idx: 1, text: '接口响应超过约定阈值（默认 2000ms）即判定为超时，应记录请求上下文、下游服务与连接池状态。' },
          { idx: 2, text: '连接池耗尽时优先排查 max_connections 配置与慢查询；网关层超时常由下游瓶颈引起。' },
          { idx: 3, text: '处置流程：定位下游服务 → 评估连接资源 → 调整阈值/扩容 → 回归验证。' }
        ]
      },
      {
        id: uid('kb'), title: '历史联试优秀案例汇编.md', moduleId: WM, source: '本地导入', type: 'md',
        importedAt: '2026-06-21 09:30', vectorized: 'done',
        chunks: [
          { idx: 1, text: '某型武器管理系统联试：高峰时段武器载荷链路超时，扩容连接池至 200 后成功率由 93.9% 升至 99.2%。' },
          { idx: 2, text: '批量状态查询接口引入结果缓存后，P95 延迟由 298ms 降至 160ms。' }
        ]
      },
      {
        id: uid('kb'), title: '联试报告撰写规范.txt', moduleId: AM, source: '本地导入', type: 'txt',
        importedAt: '2026-06-22 14:05', vectorized: 'pending',
        chunks: [
          { idx: 1, text: '报告应包含概述、关键指标、服务结果、异常分析与结论建议五部分，结论需可追溯到数据。' }
        ]
      }
    ],

    /* —— 素材库（按模块归类）：可插入报告的图表/表格/图片 —— */
    materials: [
      { id: uid('mat'), name: '系统拓扑图.png', moduleId: WM, type: 'image', size: '184 KB', addedAt: '2026-06-20 10:20' },
      { id: uid('mat'), name: '延迟分布图.png', moduleId: WM, type: 'image', size: '96 KB', addedAt: '2026-06-20 10:21' },
      { id: uid('mat'), name: '服务成功率统计表.xlsx', moduleId: AM, type: 'table', size: '23 KB', addedAt: '2026-06-21 11:02' }
    ],

    /* —— 模型配置（全局，与模块无关）：生成模型 + 嵌入模型 —— */
    modelConfig: {
      provider: 'api', // api(在线接口) | local(本地部署)
      apiKey: 'sk-xxxxxxxxxxxxxxxx',
      baseUrl: 'https://api.example.com/v1',
      modelName: 'your-chat-model',
      embeddingModel: 'your-embed-model',
      connection: null // null | 'ok' | 'fail'
    },

    /* —— 已生成报告（归属 系统 + 模块） —— */
    reports: [
      {
        id: uid('rep'), title: '武器管理模块-高并发联试报告', systemId: 'sys-weapon', moduleId: WM,
        taskId: null, templateId: null, createdAt: '2026-06-23 10:15', status: 'done',
        sections: buildSections()
      }
    ],

    currentReportId: null,
    generating: false,
    genStage: -1
  }),

  getters: {
    currentReport: (s) => s.reports.find((r) => r.id === s.currentReportId) || null,
    // 按模块归类的过滤（moduleId == null 时返回全部）
    docsOfModule: (s) => (mid) => (mid == null ? s.knowledgeDocs : s.knowledgeDocs.filter((d) => d.moduleId === mid)),
    templatesOfModule: (s) => (mid) => (mid == null ? s.templates : s.templates.filter((t) => t.moduleId === mid)),
    materialsOfModule: (s) => (mid) => (mid == null ? s.materials : s.materials.filter((m) => m.moduleId === mid)),
    reportsOfModule: (s) => (mid) => (mid == null ? s.reports : s.reports.filter((r) => r.moduleId === mid)),
    reportsOfSystem: (s) => (sysId) => (sysId == null ? s.reports : s.reports.filter((r) => r.systemId === sysId))
  },

  actions: {
    /* —— 知识库 —— */
    addKnowledgeDoc(doc) {
      const d = {
        id: uid('kb'), title: doc.title || '未命名文档', moduleId: doc.moduleId ?? null, source: '本地导入',
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
    // 混合检索：在「指定模块」的知识库内做 关键词 + 模拟向量相似度 融合排序
    searchKnowledge(query, moduleId = null, topK = 5) {
      const terms = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
      const docs = moduleId == null ? this.knowledgeDocs : this.knowledgeDocs.filter((d) => d.moduleId === moduleId)
      const hits = []
      docs.forEach((d) => {
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

    /* —— 模板 / 素材 CRUD —— */
    addTemplate(t = {}) {
      const np = { id: uid('tpl'), name: t.name || '新建模板', moduleId: t.moduleId ?? null, desc: t.desc || '', sections: t.sections || [] }
      this.templates.unshift(np)
      return np
    },
    removeTemplate(id) {
      const i = this.templates.findIndex((t) => t.id === id)
      if (i >= 0) this.templates.splice(i, 1)
    },
    addMaterial(m) {
      this.materials.unshift({ id: uid('mat'), name: m.name, moduleId: m.moduleId ?? null, type: m.type || 'image', size: m.size || '—', addedAt: now() })
    },
    removeMaterial(id) {
      const i = this.materials.findIndex((m) => m.id === id)
      if (i >= 0) this.materials.splice(i, 1)
    },

    /* —— 生成报告（静态：进度模拟 + 预置结构化章节） —— */
    async generateReport({ systemId, moduleId, taskName, title, templateId } = {}) {
      if (this.generating) return null
      this.generating = true
      this.genStage = 0
      for (let i = 0; i < REPORT_STAGES.length; i++) {
        this.genStage = i
        await new Promise((r) => setTimeout(r, 420 + Math.random() * 260))
      }
      const tpl = this.templates.find((t) => t.id === templateId)
      let sections
      if (tpl) {
        sections = tpl.sections.map((s) =>
          makeSection({
            key: s.key, title: s.title, kind: s.kind,
            content: s.kind === 'data' ? (DATA_SECTIONS[s.key] || '（按所选数据填充）') : (GEN_VARIANTS[s.key]?.[0] || '（待生成）')
          })
        )
      } else {
        sections = buildSections()
      }
      const rep = {
        id: uid('rep'), title: title || `${taskName || '联试'}报告`,
        systemId: systemId || null, moduleId: moduleId || null,
        taskId: null, templateId: templateId || null,
        createdAt: now(), status: 'done', sections
      }
      this.reports.unshift(rep)
      this.currentReportId = rep.id
      this.generating = false
      this.genStage = -1
      return rep
    },

    regenerateSection(report, sectionKey) {
      const sec = report?.sections.find((s) => s.key === sectionKey)
      if (!sec || sec.kind !== 'gen') return
      const variants = GEN_VARIANTS[sectionKey]
      if (!variants || variants.length < 2) return
      const cur = variants.indexOf(sec.content)
      sec.content = variants[(cur + 1) % variants.length]
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
