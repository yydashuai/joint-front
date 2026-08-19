const DAY_MS = 24 * 60 * 60 * 1000
const REUSE_HALF_LIFE_DAYS = 30
const FRESHNESS_HALF_LIFE_DAYS = 180

const parseDate = (value) => {
  if (!value) return null
  const normalized = String(value)
    .trim()
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

const ageInDays = (value, now) => {
  const timestamp = parseDate(value)
  if (timestamp == null) return Number.POSITIVE_INFINITY
  return Math.max(0, (now - timestamp) / DAY_MS)
}

const halfLifeDecay = (days, halfLife) => {
  if (!Number.isFinite(days)) return 0
  return Math.pow(0.5, days / halfLife)
}

/**
 * 优秀历史数据综合热度（0~100）。
 * 只使用客观复用行为与时间，不使用人员、字段内容或测试结果：
 * - 50% 复用强度：log1p 压缩累计引用的头部效应
 * - 35% 复用时效：最近复用时间，30 天半衰期
 * - 15% 入库新鲜度：创建时间，180 天半衰期，为新数据提供冷启动曝光
 */
export const excellentHeatScore = (row, candidates = [], nowValue = Date.now()) => {
  const now = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue)
  const usage = Math.max(0, Number(row?.usageCount || 0))
  const maxUsage = Math.max(0, ...candidates.map((item) => Number(item?.usageCount || 0)))
  const reuseStrength = maxUsage > 0 ? Math.log1p(usage) / Math.log1p(maxUsage) : 0

  const activityAt = row?.lastUsedAt || row?.createdAt
  const reuseRecency = halfLifeDecay(ageInDays(activityAt, now), REUSE_HALF_LIFE_DAYS)
  const freshness = halfLifeDecay(ageInDays(row?.createdAt, now), FRESHNESS_HALF_LIFE_DAYS)

  return Math.max(0, Math.min(100, Math.round(100 * (
    0.5 * reuseStrength +
    0.35 * reuseRecency +
    0.15 * freshness
  ))))
}

export const excellentHeatHint = (row, candidates = []) => (
  `复用 ${Number(row?.usageCount || 0)} 次 · 最近复用 ${row?.lastUsedAt || '暂无'} · 入库 ${row?.createdAt || '未知'} · 综合热度 ${excellentHeatScore(row, candidates)}`
)
