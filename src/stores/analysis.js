/**
 * 行为记录 store —— 供智能数据生成等关键操作埋点（客观计数，无结果性指标）
 *
 * 精简版：仅保留操作日志与 recordAction 挂点（原独立"智能分析"页与异常分析 Tab 已移除，
 * 趋势/异常/推荐聚合随之删除）。
 */
import { defineStore } from 'pinia'

const BEHAVIOR_TYPES = [
  { type: '创建数据集', weight: 3, tone: '#2f6bff' },
  { type: '智能生成', weight: 4, tone: '#7c5cd6' },
  { type: '发送批次', weight: 4, tone: '#00a7b5' },
  { type: '接收监听', weight: 3, tone: '#0f8b8d' },
  { type: '异常入库', weight: 2, tone: '#d97706' },
  { type: '生成报告', weight: 2, tone: '#6d5ce7' },
  { type: '知识操作', weight: 2, tone: '#0f8b8d' },
  { type: '规则调整', weight: 1, tone: '#dc2626' },
]
const BEHAVIOR_TARGETS = ['状态上报报文', '控制指令报文', '参数配置报文', '遥测数据报文', '武器状态接口', '导航数据接口']

/** 近 14 天确定性操作日志（演示数据，避免每次刷新抖动） */
function seedUsageLogs() {
  const logs = []
  let seq = 1
  for (let d = 13; d >= 0; d -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const count = 8 + ((d * 37) % 9)
    const pool = []
    BEHAVIOR_TYPES.forEach((item, index) => {
      for (let w = 0; w < item.weight; w += 1) pool.push(item)
    })
    for (let i = 0; i < count; i += 1) {
      const entry = pool[(d + i * 3) % pool.length]
      const target = BEHAVIOR_TARGETS[(d + i * 7) % BEHAVIOR_TARGETS.length]
      const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      logs.push({
        id: `ul-${seq}`,
        time: `${ymd} ${String(9 + ((d + i) % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
        type: entry.type,
        tone: entry.tone,
        target,
        user: '张工',
      })
      seq += 1
    }
  }
  return logs
}

export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    usageLogs: seedUsageLogs(),
  }),

  getters: {
    /** 近 N 条操作记录（按时间倒序） */
    recentLogs: (state) => (limit = 10) => state.usageLogs.slice(0, limit),
    /** 按类型过滤（如 '智能生成'） */
    logsOfType: (state) => (type) => state.usageLogs.filter((log) => log.type === type),
  },

  actions: {
    /** 行为埋点挂点：后续在关键操作处调用（不阻塞现有流程） */
    recordAction({ type, target = '', user = '' }) {
      const now = new Date()
      const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const meta = BEHAVIOR_TYPES.find((item) => item.type === type)
      this.usageLogs.unshift({
        id: `ul-${Date.now()}`,
        time,
        type,
        tone: meta?.tone || '#7c5cd6',
        target,
        user: user || '张工',
      })
      if (this.usageLogs.length > 600) this.usageLogs = this.usageLogs.slice(0, 600)
    },
  },
})
