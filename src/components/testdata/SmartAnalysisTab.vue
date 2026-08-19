<template>
  <div class="smart-tab">
    <!-- S1：分析范围筛选 -->
    <div class="scope-bar">
      <span class="scope-bar__label">分析范围</span>
      <el-select v-model="systemId" clearable placeholder="全部系统" style="width: 150px" @change="onSystemChange">
        <el-option v-for="s in systemStore.systems" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="interfaceId" clearable filterable placeholder="全部接口" style="width: 200px">
        <el-option v-for="i in ifaceOptions" :key="i.id" :label="i.name" :value="i.id" />
      </el-select>
      <el-tag v-if="scopeTitle" size="small" effect="plain" closable @close="resetScope">{{ scopeTitle }}</el-tag>
      <div class="scope-bar__actions">
        <el-button text size="small" @click="resetScope">重置</el-button>
        <!-- S4：分析快照导出 -->
        <el-button type="primary" plain size="small" :icon="Download" @click="exportSnapshot">导出分析快照</el-button>
      </div>
    </div>

    <!-- S2：关键指标（点击下钻跳转） -->
    <div class="kpi-grid">
      <button v-for="kpi in kpiList" :key="kpi.label" type="button" class="kpi-card" :class="`kpi-card--${kpi.tone}`" @click="$emit('navigate', kpi.target)">
        <span class="kpi-card__label">{{ kpi.label }}</span>
        <b class="kpi-card__value">{{ kpi.value }}</b>
        <small class="kpi-card__hint">{{ kpi.hint }}</small>
      </button>
    </div>

    <el-card shadow="never" class="smart-card">
      <el-tabs v-model="activePanel">
        <!-- ======== 数据分布分析 ======== -->
        <el-tab-pane label="数据分布分析" name="analysis">
          <div class="chart-grid">
            <ChartCard title="历史数据来源构成">
              <DonutChart :data="sourceDonut" center-label="历史数据" />
            </ChartCard>
            <ChartCard title="优秀报文综合热度 Top">
              <BarChart :data="topUsage" horizontal />
            </ChartCard>
            <ChartCard title="历史数据量趋势（近 30 日）">
              <LineChart :series="[{ name: '数据量', color: '#2f6bff', points: volumeTrend }]" unit="条" />
            </ChartCard>
          </div>

          <ChartCard title="数据集资产明细" full>
            <el-table :data="datasetRows" size="small" max-height="230" empty-text="暂无数据集">
              <el-table-column prop="name" label="数据集" min-width="150" show-overflow-tooltip />
              <el-table-column prop="iface" label="关联报文" min-width="140" show-overflow-tooltip />
              <el-table-column prop="rows" label="数据行" width="80" align="right" />
              <el-table-column prop="hist" label="历史行" width="80" align="right" />
              <el-table-column label="优秀行" width="80" align="right">
                <template #default="{ row }">
                  <b v-if="row.excellent" class="exc-num">{{ row.excellent }}</b>
                  <span v-else class="muted">0</span>
                </template>
              </el-table-column>
              <el-table-column prop="fields" label="字段数" width="76" align="right" />
            </el-table>
          </ChartCard>

          <ChartCard title="最近智能生成记录" full>
            <el-table :data="genLogs" size="small" max-height="180" empty-text="暂无生成记录，使用「智能数据生成」面板后此处可见">
              <el-table-column prop="time" label="时间" width="150" />
              <el-table-column prop="target" label="目标数据集 / 报文" min-width="180" show-overflow-tooltip />
              <el-table-column prop="user" label="操作人" width="90" />
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <!-- ======== 智能数据生成 ======== -->
        <el-tab-pane label="智能数据生成" name="generate">
          <GenerateWorkbenchTab />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import BarChart from '@/components/stats/BarChart.vue'
import ChartCard from '@/components/stats/ChartCard.vue'
import DonutChart from '@/components/stats/DonutChart.vue'
import LineChart from '@/components/stats/LineChart.vue'
import GenerateWorkbenchTab from '@/components/testdata/GenerateWorkbenchTab.vue'
import { useTestDataStore } from '@/stores/testData'
import { useAnalysisStore } from '@/stores/analysis'
import { useSystemStore } from '@/stores/system'
import { useProtocolStore } from '@/stores/protocol'
import { excellentHeatScore } from '@/utils/excellentHeat'

const emit = defineEmits(['navigate'])
const tdStore = useTestDataStore()
const analysisStore = useAnalysisStore()
const systemStore = useSystemStore()
const protoStore = useProtocolStore()
const activePanel = ref('analysis')

/* ---------- S1：范围筛选 ---------- */
const systemId = ref('')
const interfaceId = ref('')
const ifaceOptions = computed(() => protoStore.testInterfaces.filter((item) => !systemId.value || item.systemId === systemId.value))
const onSystemChange = () => { interfaceId.value = '' }
const resetScope = () => { systemId.value = ''; interfaceId.value = '' }
const scopeTitle = computed(() => {
  const parts = []
  if (systemId.value) parts.push(systemStore.systems.find((s) => s.id === systemId.value)?.name || '')
  if (interfaceId.value) parts.push(protoStore.testInterfaces.find((i) => String(i.id) === String(interfaceId.value))?.name || '')
  return parts.filter(Boolean).join(' · ')
})
/* ---------- 客观指标（随范围过滤） ---------- */
const scopeDatasets = computed(() => tdStore.datasets.filter((ds) => !systemId.value || ds.systemId === systemId.value))
const scopeFiles = computed(() => tdStore.files.filter((file) => !systemId.value || file.systemId === systemId.value))
const allHistory = computed(() => tdStore.allHistoryData.filter((row) => {
  if (systemId.value && String(row._systemId) !== String(systemId.value)) return false
  if (interfaceId.value && String(row.interfaceId) !== String(interfaceId.value)) return false
  return true
}))
const excellentRows = computed(() => allHistory.value.filter((row) => row.excellent))
const kpis = computed(() => ({
  datasets: scopeDatasets.value.length,
  rows: scopeDatasets.value.reduce((t, ds) => t + (ds.rows?.length || 0), 0),
  historyRows: allHistory.value.length,
  excellent: excellentRows.value.length,
  files: scopeFiles.value.length,
}))
const kpiList = computed(() => [
  { label: '测试数据集', value: kpis.value.datasets, suffix: '个', hint: '数据集资产', tone: 'primary', target: 'dataset' },
  { label: '数据集行数', value: kpis.value.rows, suffix: '条', hint: '当前数据集行', tone: 'primary', target: 'dataset' },
  { label: '历史数据行', value: kpis.value.historyRows, suffix: '条', hint: '历史数据库', tone: 'success', target: 'history' },
  { label: '优秀报文', value: kpis.value.excellent, suffix: '条', hint: '优秀数据库', tone: 'warning', target: 'excellent' },
  { label: '数据文件', value: kpis.value.files, suffix: '个', hint: '导入与演示资产', tone: 'default', target: 'files' },
])

/* ---------- 数据分布 ---------- */
const legacySources = { 手动录入: '手动创建', 历史优秀案例: '手动创建' }
const SOURCE_COLORS = { 手动创建: '#2f6bff', 文件导入: '#d97706', 智能生成: '#7c5cd6', 接收报文: '#0f8b8d' }
const sourceDonut = computed(() => {
  const map = new Map()
  allHistory.value.forEach((row) => {
    const src = legacySources[row.source] || row.source || '手动创建'
    map.set(src, (map.get(src) || 0) + 1)
  })
  return [...map.entries()]
    .map(([label, value]) => ({ label, value, color: SOURCE_COLORS[label] || '#94a3b8' }))
    .filter((item) => item.value > 0)
})

const topUsage = computed(() => [...excellentRows.value]
  .sort((a, b) => excellentHeatScore(b, excellentRows.value) - excellentHeatScore(a, excellentRows.value))
  .slice(0, 6)
  .map((row) => ({ label: row.messageName, value: excellentHeatScore(row, excellentRows.value), color: '#c98212' })))

const volumeTrend = computed(() => {
  const map = new Map()
  allHistory.value.forEach((row) => {
    const head = String(row.createdAt || '').trim().split(' ')[0]
    if (!head) return
    map.set(head, (map.get(head) || 0) + 1)
  })
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([x, y]) => ({ x: x.slice(5), y }))
})

/* ---------- 数据集资产明细 ---------- */
const datasetRows = computed(() => scopeDatasets.value.map((ds) => {
  const hist = ds.historyRows || []
  return {
    id: ds.id,
    name: ds.name,
    iface: ds.linkedInterface || '—',
    rows: ds.rows?.length || 0,
    hist: hist.length,
    excellent: hist.filter((r) => r.excellent).length,
    fields: tdStore.fieldDefsOfDataset(ds.id).length,
  }
}))

/* ---------- 生成记录 ---------- */
const genLogs = computed(() => analysisStore.logsOfType('智能生成').slice(0, 6))

/* ---------- S4：分析快照导出 ---------- */
const toCsv = (headers, rows) => [
  headers.join(','),
  ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
].join('\n')
const exportSnapshot = () => {
  const parts = []
  parts.push(`智能分析快照（${scopeTitle.value || '全部范围'}），${new Date().toLocaleString('zh-CN', { hour12: false })}`)
  parts.push(toCsv(['指标', '数值'], kpiList.value.map((k) => ({ 指标: k.label, 数值: k.value }))))
  parts.push('数据来源构成：' + sourceDonut.value.map((d) => `${d.label}=${d.value}`).join('，'))
  parts.push('优秀综合热度 Top：' + topUsage.value.map((d) => `${d.label}=${d.value}`).join('，'))
  parts.push(toCsv(['数据集', '关联报文', '数据行', '历史行', '优秀行', '字段数'], datasetRows.value.map((r) => ({
    数据集: r.name, 关联报文: r.iface, 数据行: r.rows, 历史行: r.hist, 优秀行: r.excellent, 字段数: r.fields,
  }))))
  const blob = new Blob([`\uFEFF${parts.join('\n\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `智能分析快照_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.smart-tab {
  --stats-slate: #64748b;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}
.scope-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  background: linear-gradient(90deg, rgba(47, 107, 255, .06), transparent 38%), var(--el-bg-color);
}
.scope-bar__label { color: var(--stats-slate); font-size: 12px; font-weight: 600; }
.scope-bar__actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.kpi-grid {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(135px, 1fr));
  gap: 10px;
}
.kpi-card {
  padding: 13px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-border-color);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color .16s, background .16s, transform .12s;
  &--success { border-left-color: var(--el-color-success); }
  &--warning { border-left-color: var(--el-color-warning); }
  &--primary { border-left-color: var(--el-color-primary); }
  &:hover { border-color: var(--el-color-primary-light-5); background: var(--el-fill-color-extra-light); transform: translateY(-1px); }
  &__label { display: block; font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
  &__value { display: block; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  &__hint { display: block; margin-top: 6px; font-size: 11px; color: var(--el-text-color-placeholder); }
}
.smart-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 9px;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 3px 16px 16px;
    overflow: hidden;
  }
  :deep(.el-tabs) { display: flex; min-height: 0; flex: 1; flex-direction: column; }
  :deep(.el-tabs__content) { min-height: 0; flex: 1; padding-top: 10px; overflow: auto; }
  :deep(.el-tabs__item) { height: 44px; padding: 0 22px; font-weight: 650; }
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.exc-num { color: #c98212; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(130px, 1fr)); }
  .chart-grid { grid-template-columns: 1fr; }
}
</style>
