const DAY_MS = 24 * 60 * 60 * 1000
const DECAY_HALF_LIFE_DAYS = 90
const PRIOR_QUALITY = 0.4
const CONFIDENCE_SAMPLE_SIZE = 10
const WILSON_Z = 1.281551565545

const parseTime = (value) => {
  if (!value) return null
  const timestamp = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(timestamp) ? timestamp : null
}

export const knowledgeUsageKey = (docId, version, idx) => `${docId}::v${version || 1}::${idx}`

export const decayedUsageCounts = (stat = {}, nowValue = Date.now()) => {
  const now = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue)
  const updatedAt = parseTime(stat.updatedAt)
  const ageDays = updatedAt == null ? 0 : Math.max(0, (now - updatedAt) / DAY_MS)
  const decay = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS)
  return {
    candidates: Math.max(0, Number(stat.weightedCandidateCount || 0) * decay),
    citations: Math.max(0, Number(stat.weightedCitationCount || 0) * decay),
  }
}

const wilsonLowerBound = (successes, trials) => {
  if (trials <= 0) return PRIOR_QUALITY
  const p = Math.max(0, Math.min(1, successes / trials))
  const z2 = WILSON_Z * WILSON_Z
  const center = p + z2 / (2 * trials)
  const margin = WILSON_Z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)
  return Math.max(0, (center - margin) / (1 + z2 / trials))
}

export const knowledgeQualityScore = (stat = {}, nowValue = Date.now()) => {
  const { candidates, citations } = decayedUsageCounts(stat, nowValue)
  if (candidates <= 0) return Math.round(PRIOR_QUALITY * 100)
  const lowerBound = wilsonLowerBound(Math.min(citations, candidates), candidates)
  const confidence = candidates / (candidates + CONFIDENCE_SAMPLE_SIZE)
  return Math.round(100 * (PRIOR_QUALITY * (1 - confidence) + lowerBound * confidence))
}

export const summarizeKnowledgeUsage = (stats = [], nowValue = Date.now()) => {
  const aggregate = stats.reduce((result, stat) => {
    const weighted = decayedUsageCounts(stat, nowValue)
    result.candidateCount += Number(stat.candidateCount || 0)
    result.usedCount += Number(stat.usedCount || 0)
    result.citationCount += Number(stat.citationCount || 0)
    result.weightedCandidateCount += weighted.candidates
    result.weightedCitationCount += weighted.citations
    if (stat.lastCitationAt && (!result.lastCitationAt || stat.lastCitationAt > result.lastCitationAt)) result.lastCitationAt = stat.lastCitationAt
    return result
  }, {
    candidateCount: 0,
    usedCount: 0,
    citationCount: 0,
    weightedCandidateCount: 0,
    weightedCitationCount: 0,
    lastCitationAt: '',
  })
  const qualityScore = knowledgeQualityScore({
    weightedCandidateCount: aggregate.weightedCandidateCount,
    weightedCitationCount: aggregate.weightedCitationCount,
  }, nowValue)
  const citationRate = aggregate.candidateCount
    ? Math.round((aggregate.citationCount / aggregate.candidateCount) * 100)
    : 0
  const status = aggregate.candidateCount < 10
    ? '学习中'
    : aggregate.candidateCount >= 20 && qualityScore < 30
      ? '低利用'
      : qualityScore >= 50
        ? '稳定'
        : '观察中'
  return { ...aggregate, qualityScore, citationRate, status }
}
