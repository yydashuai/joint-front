<template>
  <div class="smart-tab">
    <el-card shadow="never" class="smart-card">
      <el-tabs v-model="activePanel">
        <!-- ======== 数据分析（智能分析核心） ======== -->
        <el-tab-pane label="数据分析" name="analysis">
          <div class="analysis-scroll">
            <!-- S1：分析范围筛选（仅「数据分析」视图展示） -->
            <div class="scope-bar">
              <span class="scope-bar__label">分析范围</span>
              <el-select v-show="false" v-model="systemId" clearable placeholder="全部联试对象" style="width: 150px" @change="onSystemChange">
                <el-option v-for="s in systemStore.systems" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
              <el-select v-model="interfaceId" clearable filterable placeholder="全部接口" style="width: 240px">
                <el-option v-for="i in ifaceOptions" :key="i.id" :label="i.name" :value="i.id" />
              </el-select>
              <el-tag v-if="scopeTitle" size="small" effect="plain" closable @close="resetScope">{{ scopeTitle }}</el-tag>
              <div class="scope-bar__actions">
                <el-button text size="small" @click="resetScope">重置</el-button>
                <!-- S4：分析快照导出 -->
                <el-button type="primary" plain size="small" :icon="Download" @click="exportSnapshot">导出分析快照</el-button>
              </div>
            </div>

            <!-- 关键指标（点击下钻跳转，仅「数据分析」视图展示） -->
            <div class="kpi-grid">
              <button v-for="kpi in kpiList" :key="kpi.label" type="button" class="kpi-card" :class="`kpi-card--${kpi.tone}`" @click="$emit('navigate', kpi.target)">
                <span class="kpi-card__label">{{ kpi.label }}</span>
                <b class="kpi-card__value">{{ kpi.value }}</b>
                <small class="kpi-card__hint">{{ kpi.hint }}</small>
              </button>
            </div>
            <!-- 第一行：三列（异常测试覆盖度 / 异常数据集 Top / 异常场景分类） -->
            <div class="row-3">
              <ChartCard title="异常测试覆盖度">
                <div class="b-left">
                  <DonutChart :data="abnormalDonut" center-label="历史数据" :size="130" />
                  <div class="b-ratio">
                    <div>异常 <b>{{ abnormalCount }}</b> 条（占 <b>{{ abnormalRatio }}%</b>）</div>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="异常数据集 Top">
                <BarChart :data="topAbnormalDatasets" horizontal />
              </ChartCard>

              <ChartCard title="异常场景分类">
                <div class="scene-cell">
                  <DonutChart :data="abnormalSceneDist" center-label="异常场景" :size="120" />
                </div>
              </ChartCard>
            </div>

            <!-- 第二行：两列（异常数据趋势 / 报文实测覆盖） -->
            <div class="row-2">
              <ChartCard title="异常数据趋势" class="fill-card">
                <LineChart :series="abnormalTrendSeries" unit="条" />
              </ChartCard>

              <ChartCard title="报文实测覆盖">
                <DonutChart :data="coverageDonut" center-label="已准备数据集" :size="130" />
                <div class="cov-note">
                  已准备 <b>{{ preparedCount }}</b> 个数据集，其中 <b>{{ testedCount }}</b> 个已在实测中真正发送过。
                </div>
                <div class="sub-title">准备了但从未实测（盲区）</div>
                <div class="blind-list">
                  <div v-for="d in blindSpot" :key="d.id" class="blind-item">
                    <span class="blind-name" :title="d.name">{{ d.name }}</span>
                    <el-tag size="small" :type="d.inPlan ? 'warning' : 'info'">{{ d.inPlan ? '已排计划未实发' : '未排计划' }}</el-tag>
                  </div>
                  <div v-if="!blindSpot.length" class="muted">无盲区，准备的测试数据均已实测覆盖。</div>
                </div>
              </ChartCard>
            </div>

            <!-- 第三行：两列（数据复用热力 / 待清理提醒） -->
            <div class="row-2">
              <ChartCard title="数据复用热力">
                <BarChart :data="reuseBars" horizontal />
                <div class="sub-title">数据来源构成</div>
                <BarChart :data="sourceBars" horizontal />
              </ChartCard>

              <ChartCard title="待清理提醒">
                <div class="e-bar">
                  <span class="sub-title">闲置阈值</span>
                  <el-radio-group v-model="staleDays" size="small">
                    <el-radio-button :value="7">7 天</el-radio-button>
                    <el-radio-button :value="30">30 天</el-radio-button>
                    <el-radio-button :value="90">90 天</el-radio-button>
                  </el-radio-group>
                  <span class="muted">仅提示，不自动删除。</span>
                </div>
                <el-table :data="cleanupList" size="small" max-height="260" empty-text="无待清理项">
                  <el-table-column prop="type" label="类型" width="80" />
                  <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
                  <el-table-column prop="lastActive" label="最近活动" width="120" />
                  <el-table-column prop="reason" label="说明" min-width="220" show-overflow-tooltip />
                </el-table>
              </ChartCard>
            </div>

            <!-- 第四行：两列（报文配套完整性 / 最近操作记录） -->
            <div class="row-2">
              <ChartCard title="报文配套完整性">
                <el-table :data="completenessList" size="small" max-height="260" empty-text="配置完整，无缺口">
                  <el-table-column prop="type" label="类型" width="80" />
                  <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="reason" label="说明" min-width="220" show-overflow-tooltip />
                </el-table>
              </ChartCard>

              <ChartCard title="最近操作记录">
                <el-table :data="recentOps" size="small" max-height="180" empty-text="暂无操作记录">
                  <el-table-column prop="time" label="时间" width="160" />
                  <el-table-column prop="type" label="类型" width="120" />
                  <el-table-column prop="target" label="目标" min-width="200" show-overflow-tooltip />
                </el-table>
              </ChartCard>
            </div>
          </div>
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
import { useProtocolStore } from '@/stores/protocol'
import { useExecutionStore } from '@/stores/execution'
import { useTestTaskStore } from '@/stores/testTask'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'
import { useAnalysisStore } from '@/stores/analysis'
import { useSystemStore } from '@/stores/system'

const emit = defineEmits(['navigate'])
const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const execStore = useExecutionStore()
const taskStore = useTestTaskStore()
const dsSchemeStore = useDatasetSchemeStore()
const analysisStore = useAnalysisStore()
const systemStore = useSystemStore()
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

/* ---------- 范围数据 ---------- */
// 数据集 / 文件按接口过滤：数据集无 interfaceId 字段，需经 messageId 反查报文的 ownerIfaceId
const inScopeByIface = (ds) => !interfaceId.value || String(datasetIfaceId(ds)) === String(interfaceId.value)
const scopeDatasets = computed(() => tdStore.datasets.filter((ds) => (!systemId.value || ds.systemId === systemId.value) && inScopeByIface(ds)))
const scopeFiles = computed(() => tdStore.files.filter((file) => {
  if (systemId.value && file.systemId !== systemId.value) return false
  if (interfaceId.value && !(file.interfaceIds || []).some((id) => String(id) === String(interfaceId.value))) return false
  return true
}))
const scopeHistory = computed(() => tdStore.allHistoryData.filter((row) => {
  if (systemId.value && String(row._systemId) !== String(systemId.value)) return false
  if (interfaceId.value && String(row.interfaceId) !== String(interfaceId.value)) return false
  return true
}))

/* ---------- 客观指标（随范围过滤） ---------- */
const kpis = computed(() => ({
  datasets: scopeDatasets.value.length,
  rows: scopeHistory.value.length,
  abnormal: scopeHistory.value.filter((r) => r.abnormal).length,
  excellent: scopeHistory.value.filter((r) => r.excellent).length,
  files: scopeFiles.value.length,
}))
const kpiList = computed(() => [
  { label: '测试数据集', value: kpis.value.datasets, suffix: '个', hint: '数据集资产', tone: 'primary', target: 'dataset' },
  { label: '历史数据行', value: kpis.value.rows, suffix: '条', hint: '历史数据库', tone: 'success', target: 'history' },
  { label: '异常测试数据', value: kpis.value.abnormal, suffix: '条', hint: '刻意设计的压力资产', tone: 'warning', target: 'history' },
  { label: '优秀报文', value: kpis.value.excellent, suffix: '条', hint: '优秀数据库', tone: 'warning', target: 'excellent' },
  { label: '数据文件', value: kpis.value.files, suffix: '个', hint: '导入与演示资产', tone: 'default', target: 'files' },
])

/* ============================================================
 * B'：异常测试覆盖度（异常 = 刻意设计的压力测试资产，非质量错误）
 * ============================================================ */
const abRows = computed(() => scopeHistory.value.filter((r) => r.abnormal))
const abnormalCount = computed(() => abRows.value.length)
const normalCount = computed(() => scopeHistory.value.filter((r) => !r.abnormal).length)
const totalRows = computed(() => scopeHistory.value.length)
const abnormalRatio = computed(() => (totalRows.value ? Math.round((abnormalCount.value / totalRows.value) * 100) : 0))

const abnormalDonut = computed(() => [
  { label: '异常', value: abnormalCount.value, color: '#d97706' },
  { label: '正常', value: normalCount.value, color: '#2f6bff' },
])

// 异常数据集 Top N（承载异常/边界测试最集中的资产）
const topAbnormalDatasets = computed(() => {
  const map = new Map()
  abRows.value.forEach((r) => {
    const id = r._datasetId
    if (!map.has(id)) map.set(id, { name: r._datasetName || '未命名数据集', count: 0 })
    map.get(id).count += 1
  })
  return [...map.values()].filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 8)
    .map((d) => ({ label: d.name, value: d.count, color: '#d97706' }))
})

// 异常场景分类：按测试员自定义标签（测试意图），不碰协议字段；无标签则归入“约束异常”
const SCENE_COLORS = { 边界值: '#d97706', 典型异常: '#dc2626', 回归样本: '#2f6bff', 稳定样本: '#0f8b8d', 约束异常: '#94a3b8' }
const abnormalSceneDist = computed(() => {
  const map = new Map()
  abRows.value.forEach((r) => {
    const tags = (r.customTags && r.customTags.length) ? r.customTags : ['约束异常']
    tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1))
  })
  return [...map.entries()].map(([label, value]) => ({ label, value, color: SCENE_COLORS[label] || '#94a3b8' }))
})

// 异常数据趋势（近 30 日，替代原“历史数据量趋势”）
const abnormalTrend = computed(() => {
  const map = new Map()
  scopeHistory.value.forEach((r) => {
    const head = String(r.createdAt || '').trim().split(' ')[0]
    if (!head) return
    if (!map.has(head)) map.set(head, { total: 0, ab: 0 })
    map.get(head).total += 1
    if (r.abnormal) map.get(head).ab += 1
  })
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30)
    .map(([x, o]) => ({ x: x.slice(5), total: o.total, ab: o.ab }))
})
const abnormalTrendSeries = computed(() => [
  { name: '异常数据', color: '#d97706', points: abnormalTrend.value.map((p) => ({ x: p.x, y: p.ab })) },
  { name: '全部数据', color: '#2f6bff', points: abnormalTrend.value.map((p) => ({ x: p.x, y: p.total })) },
])

/* ============================================================
 * 辅助：数据来源构成（手动/导入/生成等，按历史数据行 source 统计）
 * ============================================================ */
const SOURCE_COLORS = { 手动创建: '#2f6bff', 文件导入: '#0f8b8d', 智能生成: '#d97706', 接收: '#7c3aed', 未标注: '#cbd5e1' }
const sourceBars = computed(() => {
  const map = new Map()
  scopeHistory.value.forEach((r) => {
    const s = r.source || '未标注'
    map.set(s, (map.get(s) || 0) + 1)
  })
  return [...map.entries()].map(([label, value]) => ({ label, value, color: SOURCE_COLORS[label] || '#cbd5e1' }))
})

/* ============================================================
 * C'：报文实测覆盖（数据视角）—— 已准备的数据集中，真正在实测中发送过的占比
 * ============================================================ */
const planDatasetIds = computed(() => new Set(execStore.planItems.flatMap((p) => (p.datasets || []).map((d) => String(d.id)))))
const testedDatasetIds = computed(() => {
  const set = new Set()
  taskStore.tasks.forEach((t) => {
    if ((t.runs || []).length > 0) (t.bindings?.datasetIds || []).forEach((id) => set.add(String(id)))
  })
  return set
})
const datasetIfaceId = (ds) => {
  if (!ds.messageId) return null
  const m = protoStore.interfaces.find((i) => String(i.id) === String(ds.messageId))
  return m?.ownerIfaceId ?? null
}
const prepared = computed(() => scopeDatasets.value.filter((ds) => {
  if ((ds.rows?.length || 0) + (ds.historyRows?.length || 0) === 0) return false
  if (interfaceId.value && String(datasetIfaceId(ds)) !== String(interfaceId.value)) return false
  return true
}))
const preparedCount = computed(() => prepared.value.length)
const testedCount = computed(() => prepared.value.filter((ds) => testedDatasetIds.value.has(String(ds.id))).length)
const coverageDonut = computed(() => [
  { label: '已实测', value: testedCount.value, color: '#0f8b8d' },
  { label: '未实测', value: Math.max(0, preparedCount.value - testedCount.value), color: '#f59e0b' },
])
const blindSpot = computed(() => prepared.value
  .filter((ds) => !testedDatasetIds.value.has(String(ds.id)))
  .map((ds) => ({ id: ds.id, name: ds.name, inPlan: planDatasetIds.value.has(String(ds.id)) })))

/* ============================================================
 * D：数据复用热力（被计划 / 数据集方案 / 任务绑定的次数）
 * ============================================================ */
const refCountOf = (dsId) => {
  const id = String(dsId)
  let n = 0
  execStore.planItems.forEach((p) => { if ((p.datasets || []).some((d) => String(d.id) === id)) n += 1 })
  dsSchemeStore.schemes.forEach((s) => { if ((s.datasetIds || []).some((d) => String(d) === id)) n += 1 })
  taskStore.tasks.forEach((t) => { if ((t.bindings?.datasetIds || []).some((d) => String(d) === id)) n += 1 })
  return n
}
const reuseTop = computed(() => scopeDatasets.value
  .map((ds) => ({
    id: ds.id,
    name: ds.name,
    refs: refCountOf(ds.id),
    abnormal: (ds.historyRows || []).some((r) => r.abnormal),
  }))
  .filter((x) => x.refs > 0)
  .sort((a, b) => b.refs - a.refs)
  .slice(0, 8))
const reuseBars = computed(() => reuseTop.value.map((d) => ({
  label: d.name,
  value: d.refs,
  color: d.abnormal ? '#d97706' : '#2f6bff',
})))

/* ============================================================
 * E：待清理提醒（零引用且长期未动；异常数据集是宝贵资产，不因异常被建议清理）
 * ============================================================ */
const staleDays = ref(30)
const lastActiveOf = (ds) => {
  const dates = (ds.historyRows || []).map((r) => r.updatedAt || r.createdAt).filter(Boolean)
  dates.push(ds.createdAt)
  return dates.length ? dates.sort().slice(-1)[0] : ds.createdAt
}
const referencedAnywhere = (dsId) => {
  const id = String(dsId)
  if (planDatasetIds.value.has(id)) return true
  if (dsSchemeStore.schemes.some((s) => (s.datasetIds || []).some((d) => String(d) === id))) return true
  if (taskStore.tasks.some((t) => (t.bindings?.datasetIds || []).some((d) => String(d) === id))) return true
  return false
}
const isAbnormalDataset = (ds) => (ds.historyRows || []).some((r) => r.abnormal)
const orphanDatasets = computed(() => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - staleDays.value)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return scopeDatasets.value
    .filter((ds) => !isAbnormalDataset(ds) && !referencedAnywhere(ds.id) && String(lastActiveOf(ds)) < cutoffStr)
    .map((ds) => ({ type: '数据集', name: ds.name, lastActive: lastActiveOf(ds), reason: `零引用且超过 ${staleDays.value} 天未变动` }))
})
const inPlanIfaceIds = computed(() => new Set(execStore.planItems.map((p) => p.iface?.id).filter(Boolean).map(String)))
const orphanMessages = computed(() => protoStore.interfaces
  .filter((m) => {
    if (interfaceId.value && String(m.ownerIfaceId) !== String(interfaceId.value)) return false
    if (tdStore.datasets.some((ds) => String(ds.messageId) === String(m.id))) return false
    if (inPlanIfaceIds.value.has(String(m.ownerIfaceId))) return false
    if (taskStore.tasks.some((t) => String(t.bindings?.interfaceId) === String(m.ownerIfaceId))) return false
    return true
  })
  .map((m) => ({ type: '报文', name: m.name, lastActive: '—', reason: '未关联数据集、未排入计划（建议确认是否保留）' })))
const cleanupList = computed(() => [...orphanDatasets.value, ...orphanMessages.value])

/* ============================================================
 * F：报文配套完整性（报文缺配套数据集 / 数据集游离无归属报文）
 * ============================================================ */
const messageHasDataset = computed(() => {
  const set = new Set()
  scopeDatasets.value.forEach((ds) => { if (ds.messageId) set.add(String(ds.messageId)) })
  return set
})
const messagesInScope = computed(() => protoStore.interfaces.filter((m) => {
  if (systemId.value && String(m.systemId) !== String(systemId.value)) return false
  if (interfaceId.value && String(m.ownerIfaceId) !== String(interfaceId.value)) return false
  return true
}))
const completenessList = computed(() => {
  const msgGaps = messagesInScope.value
    .filter((m) => !messageHasDataset.value.has(String(m.id)))
    .map((m) => ({ type: '报文', name: m.name, reason: '尚无配套测试数据集' }))
  const frees = scopeDatasets.value
    .filter((ds) => !ds.messageId || !protoStore.interfaces.some((mm) => String(mm.id) === String(ds.messageId)))
    .map((ds) => ({ type: '数据集', name: ds.name, reason: '游离，未关联任一报文' }))
  return [...msgGaps, ...frees]
})

/* ---------- 最近操作记录（去操作人，不作工作量分析） ---------- */
const recentOps = computed(() => analysisStore.logsOfType('智能生成').slice(0, 8)
  .map((log) => ({ time: log.time, type: log.type, target: log.target })))

/* ---------- S4：分析快照导出 ---------- */
const toCsv = (headers, rows) => [
  headers.join(','),
  ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
].join('\n')
const exportSnapshot = () => {
  const parts = []
  parts.push(`智能分析快照（${scopeTitle.value || '全部范围'}），${new Date().toLocaleString('zh-CN', { hour12: false })}`)
  parts.push(toCsv(['指标', '数值'], kpiList.value.map((k) => ({ 指标: k.label, 数值: k.value }))))
  parts.push('异常测试覆盖度：' + JSON.stringify({ 异常: abnormalCount.value, 正常: normalCount.value, 占比: abnormalRatio + '%' }))
  parts.push('异常场景分类：' + abnormalSceneDist.value.map((d) => `${d.label}=${d.value}`).join('，'))
  parts.push('报文实测覆盖：' + JSON.stringify({ 已准备: preparedCount.value, 已实测: testedCount.value, 盲区: blindSpot.value.length }))
  parts.push('数据复用 Top：' + reuseTop.value.map((d) => `${d.name}=${d.refs}`).join('，'))
  parts.push(toCsv(['类型', '名称', '最近活动', '说明'], cleanupList.value.map((r) => ({
    类型: r.type, 名称: r.name, 最近活动: r.lastActive, 说明: r.reason,
  }))))
  parts.push('报文配套完整性：' + JSON.stringify({
    报文缺数据集: completenessList.value.filter((r) => r.type === '报文').length,
    游离数据集: completenessList.value.filter((r) => r.type === '数据集').length,
  }))
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
  flex: 1;
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
  margin-bottom: 12px;
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
  margin-bottom: 12px;
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
  :deep(.el-tabs__content) { min-height: 0; flex: 1; padding-top: 10px; overflow: hidden; display: flex; flex-direction: column; }
  :deep(.el-tab-pane) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  :deep(.el-tabs__item) { height: 44px; padding: 0 22px; font-weight: 650; }
}
.analysis-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}
.row-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.row-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
/* 异常数据趋势：折线图撑满卡片，与同排"报文实测覆盖"等高 */
.fill-card :deep(.chart-card__body) { justify-content: stretch; }
.fill-card :deep(.linechart) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.fill-card :deep(.lc-svg) { flex: 1; min-height: 0; width: 100%; height: 100%; max-height: none; }
.fill-card :deep(.lc-legend) { flex-shrink: 0; }
/* 异常测试覆盖度主卡 */
.b-left { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.b-ratio { font-size: 12px; color: var(--el-text-color-regular); }
.scene-cell { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; overflow: hidden; }
.scene-cell :deep(.donut) { flex-direction: column; align-items: center; }
.scene-cell :deep(.donut__legend) { width: 100%; }
.sub-title { font-size: 12px; font-weight: 600; color: var(--el-text-color-primary); margin-bottom: 8px; }
.cov-note { font-size: 12px; color: var(--el-text-color-regular); margin: 8px 0 4px; }
/* C' 盲区列表 */
.blind-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow: auto; }
.blind-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.blind-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--el-text-color-regular); }
/* E 阈值栏 */
.e-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
@container (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(130px, 1fr)); }
  .row-3 { grid-template-columns: 1fr; }
  .row-2 { grid-template-columns: 1fr; }
}
</style>
