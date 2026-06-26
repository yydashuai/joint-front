<template>
  <div class="efficiency-dashboard">
    <!-- 核心指标卡 -->
    <div class="kpi-row">
      <div class="kpi">
        <span class="kpi__val">{{ avgResolutionHours }}<small>h</small></span>
        <span class="kpi__label">平均处置时长</span>
      </div>
      <div class="kpi">
        <span class="kpi__val">{{ slaRate }}<small>%</small></span>
        <span class="kpi__label">SLA 达标率</span>
      </div>
      <div class="kpi kpi--danger">
        <span class="kpi__val">{{ overdueCount }}</span>
        <span class="kpi__label">超期未处理</span>
      </div>
      <div class="kpi">
        <span class="kpi__val">{{ fastestMinutes }}<small>min</small></span>
        <span class="kpi__label">最快处置</span>
      </div>
    </div>

    <!-- SLA 标准说明 -->
    <div class="sla-note">
      SLA 标准：高级别 ≤ 4h、中级别 ≤ 8h、低级别 ≤ 24h（从捕捉到状态变更为非待处理）
    </div>

    <!-- 按类型分组效率 -->
    <div class="panel">
      <div class="panel-head"><strong>按类型处置效率</strong></div>
      <el-table :data="byTypeStats" size="small" empty-text="暂无已处置数据">
        <el-table-column label="异常类型" prop="type" min-width="120" />
        <el-table-column label="已处置数" width="90" align="center">
          <template #default="{ row }">{{ row.resolvedCount }}</template>
        </el-table-column>
        <el-table-column label="平均时长" width="110" align="center">
          <template #default="{ row }">
            <span class="mono">{{ row.avgDisplay }}</span>
          </template>
        </el-table-column>
        <el-table-column label="SLA 达标" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.slaPass >= 80 ? 'success' : row.slaPass >= 50 ? 'warning' : 'danger'" size="small">
              {{ row.slaPass }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SLA 标准" width="100" align="center">
          <template #default="{ row }">
            <span class="muted">≤ {{ row.slaHours }}h</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 超期预警列表 -->
    <div class="panel">
      <div class="panel-head">
        <strong>超期预警</strong>
        <el-tag type="danger" effect="plain" size="small">{{ overdueItems.length }} 项</el-tag>
      </div>
      <div v-if="!overdueItems.length" class="empty-state">
        <el-tag type="success" effect="plain">全部正常</el-tag>
        <span>当前无超期未处理异常</span>
      </div>
      <div v-else class="overdue-list">
        <div v-for="item in overdueItems" :key="item.id" class="overdue-item">
          <div class="overdue-main">
            <el-tag :type="levelTag(item.level)" size="small">{{ item.level }}</el-tag>
            <span class="overdue-type">{{ item.type }}</span>
            <span class="overdue-iface">{{ item.iface }}</span>
          </div>
          <div class="overdue-meta">
            <span class="overdue-time">已等待 {{ formatElapsed(item.elapsedHours) }}</span>
            <span class="overdue-sla">SLA {{ item.slaHours }}h</span>
            <span class="overdue-state">
              <el-tag size="small" :type="item.state === '待处理' ? 'danger' : 'warning'">{{ item.state }}</el-tag>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExceptionStore } from '@/stores/exception'

const store = useExceptionStore()
const resolvedStates = ['已处理', '已修复', '已忽略', '自动恢复', '已记录']
const slaHoursMap = { '高': 4, '中': 8, '低': 24 }

const parseTime = (s) => s ? new Date(s.replace(/\//g, '-')).getTime() : 0

/* 已处置项的处置时长(小时) */
const resolvedDurations = computed(() => {
  return store.exceptions
    .filter((item) => resolvedStates.includes(item.state) && item.resolvedTime && item.capturedTime)
    .map((item) => {
      const captured = parseTime(item.capturedTime)
      const resolved = parseTime(item.resolvedTime)
      const hours = Math.max(0, (resolved - captured) / 3600000)
      return { ...item, hours }
    })
})

/* 平均处置时长 */
const avgHours = computed(() => {
  if (!resolvedDurations.value.length) return 0
  const sum = resolvedDurations.value.reduce((a, b) => a + b.hours, 0)
  return sum / resolvedDurations.value.length
})
const avgResolutionHours = computed(() => {
  const h = avgHours.value
  if (h < 1) return Math.round(h * 60) + 'min'
  return Math.round(h)
})

/* 最快处置 */
const fastestMinutes = computed(() => {
  if (!resolvedDurations.value.length) return '-'
  const min = Math.min(...resolvedDurations.value.map((d) => d.hours))
  return Math.max(1, Math.round(min * 60))
})

/* SLA 达标率 */
const slaCompliant = computed(() => {
  return resolvedDurations.value.filter((d) => {
    const sla = slaHoursMap[d.level] || 8
    return d.hours <= sla
  }).length
})
const slaRate = computed(() => {
  if (!resolvedDurations.value.length) return 100
  return Math.round((slaCompliant.value / resolvedDurations.value.length) * 100)
})

/* 超期项 */
const overdueItems = computed(() => store.overdueItems)
const overdueCount = computed(() => overdueItems.value.length)

/* 按类型统计 */
const byTypeStats = computed(() => {
  const map = new Map()
  resolvedDurations.value.forEach((item) => {
    if (!map.has(item.type)) map.set(item.type, [])
    map.get(item.type).push(item)
  })
  return [...map.entries()].map(([type, items]) => {
    const avg = items.reduce((a, b) => a + b.hours, 0) / items.length
    const level = items[0]?.level || '中'
    const sla = slaHoursMap[level] || 8
    const pass = Math.round((items.filter((d) => d.hours <= sla).length / items.length) * 100)
    return {
      type,
      resolvedCount: items.length,
      avgHours: avg,
      avgDisplay: avg < 1 ? `${Math.round(avg * 60)}min` : `${Math.round(avg)}h`,
      slaPass: pass,
      slaHours: sla,
    }
  }).sort((a, b) => b.resolvedCount - a.resolvedCount)
})

const levelTag = (level) => {
  if (level === '高') return 'danger'
  if (level === '中') return 'warning'
  return 'info'
}
const formatElapsed = (hours) => {
  if (hours >= 48) return `${Math.round(hours / 24)}天`
  return `${hours}h`
}
</script>

<style scoped lang="scss">
.efficiency-dashboard {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* KPI 卡片 */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.kpi {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi__val {
  font: 750 24px Consolas, Monaco, monospace;
  color: var(--el-color-primary);
  line-height: 1.2;
}
.kpi__val small {
  font-size: 13px;
  font-weight: 500;
  margin-left: 2px;
  color: var(--el-text-color-secondary);
}
.kpi__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.kpi--danger .kpi__val { color: var(--el-color-danger); }

.sla-note {
  padding: 8px 14px;
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

/* 面板 */
.panel {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-head strong { font-size: 14px; }

.mono { font-family: Consolas, Monaco, monospace; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* 超期列表 */
.overdue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}
.overdue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  flex-wrap: wrap;
}
.overdue-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.overdue-type { font-size: 13px; font-weight: 500; }
.overdue-iface {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: Consolas, Monaco, monospace;
}
.overdue-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.overdue-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-danger);
  font-family: Consolas, Monaco, monospace;
}
.overdue-sla {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 900px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
