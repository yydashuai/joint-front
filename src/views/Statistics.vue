<template>
  <div class="page statistics">
    <!-- ======== 页面头部 ======== -->
    <div class="page__header">
      <div>
        <h2>统计与可视化</h2>
        <div class="page__desc">联试结果聚合分析 · 仅展示可客观度量的指标</div>
      </div>
      <div class="header-actions">
        <el-dropdown trigger="click" @command="onExport">
          <el-button type="primary" :icon="Download">导出结果<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="run">导出执行明细（CSV）</el-dropdown-item>
              <el-dropdown-item command="exception">导出异常清单（CSV）</el-dropdown-item>
              <el-dropdown-item command="interface">导出接口排行（CSV）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- ======== 筛选条 ======== -->
    <el-card shadow="never" class="filter-bar">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">系统</span>
          <el-select v-model="systemId" placeholder="全部系统" clearable size="default" style="width: 170px" @change="onSystemChange">
            <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">模块</span>
          <el-select v-model="moduleId" placeholder="全部模块" clearable size="default" style="width: 160px">
            <el-option v-for="m in moduleOptions" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">接口</span>
          <el-select v-model="interfaceId" placeholder="全部接口" clearable filterable size="default" style="width: 180px">
            <el-option v-for="i in interfaceOptions" :key="i.id" :label="i.name" :value="i.id" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">时间范围</span>
          <el-select v-model="timeRange" size="default" style="width: 130px">
            <el-option label="全部" value="all" />
            <el-option label="近 7 天" value="7d" />
            <el-option label="近 3 天" value="3d" />
            <el-option label="今天" value="1d" />
          </el-select>
        </div>
        <el-tag v-if="runId" type="warning" closable @close="clearRunId" class="run-tag">
          仅看本次执行
        </el-tag>
        <div class="filter-spacer" />
        <el-button text :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <!-- ======== 类别 Tab ======== -->
    <el-card shadow="never" class="stat-tabs">
      <el-tabs v-model="activeTab">
        <!-- ====== 总览 ====== -->
        <el-tab-pane label="总览" name="overview">
          <div class="kpi-grid">
            <StatCard label="累计执行次数" :value="ov.runCount" tone="primary" />
            <StatCard label="总请求数" :value="ov.totalRequests" />
            <StatCard label="整体通过率" :value="ov.passRate" suffix="%" :tone="ov.passRate >= 90 ? 'success' : 'warning'" />
            <StatCard label="平均响应时延" :value="ov.avgResponseTime" suffix="ms" />
            <StatCard label="异常总数" :value="ov.exceptionTotal" tone="warning" />
            <StatCard label="待处理异常" :value="ov.pending" :tone="ov.pending ? 'danger' : 'success'" />
          </div>
          <div class="chart-grid">
            <ChartCard title="执行结果构成">
              <DonutChart :data="ov.composition" center-label="请求" />
            </ChartCard>
            <ChartCard title="通过率趋势">
              <LineChart :series="[{ name: '通过率', color: 'var(--el-color-success)', points: ov.passRateTrend }]" unit="%" :y-max="100" />
            </ChartCard>
          </div>
        </el-tab-pane>

        <!-- ====== 执行指标 ====== -->
        <el-tab-pane label="执行指标" name="execution">
          <div class="kpi-grid">
            <StatCard label="执行次数" :value="ex.kpis.runCount" tone="primary" />
            <StatCard label="覆盖接口数" :value="ex.kpis.ifaceCount" />
            <StatCard label="整体通过率" :value="ex.kpis.passRate" suffix="%" :tone="ex.kpis.passRate >= 90 ? 'success' : 'warning'" />
            <StatCard label="平均单次耗时" :value="ex.kpis.avgRunTime" suffix="ms" />
          </div>
          <div class="chart-grid">
            <ChartCard title="执行结果构成"><DonutChart :data="ex.composition" center-label="请求" /></ChartCard>
            <ChartCard title="每日执行次数"><BarChart :data="ex.runsPerDay" /></ChartCard>
            <ChartCard title="通过率趋势"><LineChart :series="[{ name: '通过率', color: 'var(--el-color-success)', points: ex.passRateTrend }]" unit="%" :y-max="100" /></ChartCard>
            <ChartCard title="各接口执行次数 Top"><BarChart :data="ex.runsByIface" horizontal /></ChartCard>
          </div>
        </el-tab-pane>

        <!-- ====== 请求指标 ====== -->
        <el-tab-pane label="请求指标" name="request">
          <div class="kpi-grid">
            <StatCard label="总请求数" :value="rq.kpis.total" tone="primary" />
            <StatCard label="成功请求" :value="rq.kpis.success" tone="success" />
            <StatCard label="失败/超时请求" :value="rq.kpis.failed" tone="danger" />
            <StatCard label="请求成功率" :value="rq.kpis.successRate" suffix="%" :tone="rq.kpis.successRate >= 90 ? 'success' : 'warning'" />
          </div>
          <div class="chart-grid">
            <ChartCard title="请求量随时间"><LineChart :series="[{ name: '请求量', color: 'var(--el-color-primary)', points: rq.requestByDay }]" /></ChartCard>
            <ChartCard title="成功 / 失败（按天）"><BarChart :data="rq.resultStack" /></ChartCard>
            <ChartCard title="按接口请求量 Top"><BarChart :data="rq.requestByIface" horizontal /></ChartCard>
            <ChartCard title="失败原因构成（来自异常类型）"><DonutChart :data="rq.failReasons" center-label="异常" /></ChartCard>
          </div>
        </el-tab-pane>

        <!-- ====== 性能指标 ====== -->
        <el-tab-pane label="性能指标" name="performance">
          <div class="kpi-grid">
            <StatCard label="平均响应时延" :value="pf.kpis.avgMs" suffix="ms" tone="primary" />
            <StatCard label="P90 时延" :value="pf.kpis.p90" suffix="ms" />
            <StatCard label="P95 时延" :value="pf.kpis.p95" suffix="ms" tone="warning" />
            <StatCard label="最大时延" :value="pf.kpis.maxMs" suffix="ms" tone="danger" />
            <StatCard label="平均吞吐" :value="pf.kpis.avgRps" suffix="req/s" />
          </div>
          <div class="chart-grid">
            <ChartCard title="响应时延分布"><Histogram :values="pf.histogram" /></ChartCard>
            <ChartCard title="平均时延趋势"><LineChart :series="[{ name: '平均时延', color: 'var(--el-color-primary)', points: pf.latencyTrend }]" unit="ms" /></ChartCard>
            <ChartCard title="吞吐趋势"><LineChart :series="[{ name: '吞吐', color: '#13c2c2', points: pf.throughputTrend }]" unit="req/s" /></ChartCard>
            <ChartCard title="各接口平均时延 Top"><BarChart :data="pf.latencyByIface" horizontal unit="ms" color="var(--el-color-warning)" /></ChartCard>
          </div>
        </el-tab-pane>

        <!-- ====== 异常指标 ====== -->
        <el-tab-pane label="异常指标" name="exception">
          <div class="kpi-grid">
            <StatCard label="异常总数" :value="ec.kpis.total" tone="warning" />
            <StatCard label="待处理" :value="ec.kpis.pending" :tone="ec.kpis.pending ? 'danger' : 'success'" />
            <StatCard label="处理率" :value="ec.kpis.resolvedRate" suffix="%" tone="success" />
            <StatCard label="高危异常" :value="ec.kpis.high" tone="danger" />
          </div>
          <div class="chart-grid">
            <ChartCard title="按类型分布"><DonutChart :data="ec.byType" center-label="异常" /></ChartCard>
            <ChartCard title="按级别分布"><BarChart :data="ec.byLevel" horizontal /></ChartCard>
            <ChartCard title="按模块 Top"><BarChart :data="ec.byModule" horizontal color="var(--el-color-danger)" /></ChartCard>
            <ChartCard title="异常趋势"><LineChart :series="[{ name: '异常数', color: 'var(--el-color-danger)', points: ec.trend }]" /></ChartCard>
          </div>
        </el-tab-pane>

        <!-- ====== 接口指标 ====== -->
        <el-tab-pane label="接口指标" name="interface">
          <div class="kpi-grid">
            <StatCard label="已测接口" :value="itf.kpis.tested" tone="primary" />
            <StatCard label="接口总数" :value="itf.kpis.totalIfaces" />
            <StatCard label="接口覆盖率" :value="itf.kpis.coverage" suffix="%" :tone="itf.kpis.coverage >= 80 ? 'success' : 'warning'" />
            <StatCard label="问题接口数" :value="itf.kpis.problemIfaces" tone="danger" />
          </div>
          <div class="chart-grid">
            <ChartCard title="接口覆盖"><DonutChart :data="itf.coverageDonut" center-label="接口" /></ChartCard>
            <ChartCard title="异常最多接口 Top"><BarChart :data="itf.topErrorIfaces" horizontal color="var(--el-color-danger)" /></ChartCard>
          </div>
          <ChartCard title="接口排行明细" full>
            <el-table :data="itf.ranking" size="small" max-height="320" empty-text="暂无接口执行数据">
              <el-table-column label="接口" prop="iface" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-link
                    v-if="interfaceRouteId(row)"
                    type="primary"
                    :underline="false"
                    @click="openInterface(row)"
                  >
                    {{ row.iface }}
                  </el-link>
                  <span v-else>{{ row.iface }}</span>
                </template>
              </el-table-column>
              <el-table-column label="所属模块" prop="module" min-width="130" show-overflow-tooltip />
              <el-table-column label="请求数" prop="req" width="90" align="right" sortable />
              <el-table-column label="成功率" width="100" align="right" sortable :sort-by="(r) => r.successRate">
                <template #default="{ row }">
                  <span :class="row.successRate >= 90 ? 'ok' : 'warn'">{{ row.successRate }}%</span>
                </template>
              </el-table-column>
              <el-table-column label="平均时延" width="100" align="right" sortable :sort-by="(r) => r.avgMs">
                <template #default="{ row }">{{ row.avgMs }}ms</template>
              </el-table-column>
              <el-table-column label="异常数" prop="errors" width="90" align="right" sortable>
                <template #default="{ row }">
                  <span :class="{ danger: row.errors > 0 }">{{ row.errors }}</span>
                </template>
              </el-table-column>
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <!-- ====== MQ 中间件 ====== -->
        <el-tab-pane label="MQ 中间件" name="mq">
          <div class="kpi-grid">
            <StatCard label="Broker 总数" :value="mq.kpis.totalBrokers" tone="primary" />
            <StatCard label="健康率" :value="mq.kpis.healthRate" suffix="%" :tone="mq.kpis.healthRate >= 90 ? 'success' : 'warning'" />
            <StatCard label="生产端通过率" :value="mq.kpis.producerPassRate" suffix="%" :tone="mq.kpis.producerPassRate >= 90 ? 'success' : 'warning'" />
            <StatCard label="消费端在线率" :value="mq.kpis.consumerOnlineRate" suffix="%" :tone="mq.kpis.consumerOnlineRate >= 90 ? 'success' : 'warning'" />
            <StatCard label="平均探测延迟" :value="mq.kpis.avgLatency" suffix="ms" />
          </div>
          <div class="chart-grid">
            <ChartCard title="Broker 健康趋势（近7天）">
              <LineChart :series="[{ name: '健康率', color: 'var(--el-color-success)', points: mq.healthTrend }]" unit="%" :y-max="100" />
            </ChartCard>
            <ChartCard title="各 Broker 探测延迟">
              <BarChart :data="mq.latencyDistribution" horizontal unit="ms" color="var(--el-color-primary)" />
            </ChartCard>
          </div>
          <ChartCard title="各 Broker 探测明细" full>
            <el-table :data="mq.brokerDetails" size="small" max-height="320" empty-text="暂无 Broker 数据">
              <el-table-column label="Broker" prop="name" min-width="160" show-overflow-tooltip />
              <el-table-column label="类型" prop="brokerType" width="110" align="center" />
              <el-table-column label="地址" width="170" align="center">
                <template #default="{ row }">
                  <span class="mono">{{ row.ip }}:{{ row.port }}</span>
                </template>
              </el-table-column>
              <el-table-column label="L1 端口" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.l1Status === 'pass' ? 'success' : row.l1Status === 'fail' ? 'danger' : 'info'" size="small">
                    {{ row.l1Status === 'pass' ? '通过' : row.l1Status === 'fail' ? '失败' : '待检' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="L2 认证" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.l2Status === 'pass' ? 'success' : row.l2Status === 'fail' ? 'danger' : 'info'" size="small">
                    {{ row.l2Status === 'pass' ? '通过' : row.l2Status === 'fail' ? '失败' : '待检' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="L3 集群" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.l3Status === 'pass' ? 'success' : row.l3Status === 'warning' ? 'warning' : row.l3Status === 'fail' ? 'danger' : 'info'" size="small">
                    {{ row.l3Status === 'pass' ? '正常' : row.l3Status === 'warning' ? '告警' : row.l3Status === 'fail' ? '异常' : '待检' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="平均延迟" width="100" align="center">
                <template #default="{ row }">{{ row.avgLatency }}ms</template>
              </el-table-column>
              <el-table-column label="队列数" prop="queueCount" width="80" align="center" />
              <el-table-column label="消费者" prop="consumerCount" width="80" align="center" />
              <el-table-column label="探测次数" prop="checkCount" width="90" align="right" sortable />
              <el-table-column label="通过率" width="90" align="right" sortable :sort-by="(r) => r.passRate">
                <template #default="{ row }">
                  <span :class="row.passRate >= 95 ? 'ok' : 'warn'">{{ row.passRate }}%</span>
                </template>
              </el-table-column>
              <el-table-column label="综合" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.overall === 'healthy' ? 'success' : row.overall === 'warning' ? 'warning' : 'danger'" effect="dark" size="small">
                    {{ row.overall === 'healthy' ? '健康' : row.overall === 'warning' ? '告警' : row.overall === 'error' ? '异常' : '未知' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <!-- ====== 综合趋势 ====== -->
        <el-tab-pane label="综合趋势" name="trend">
          <div class="chart-grid">
            <ChartCard title="请求量趋势"><LineChart :series="[{ name: '请求量', color: 'var(--el-color-primary)', points: tr.reqTrend }]" /></ChartCard>
            <ChartCard title="通过率趋势"><LineChart :series="[{ name: '通过率', color: 'var(--el-color-success)', points: tr.passTrend }]" unit="%" :y-max="100" /></ChartCard>
            <ChartCard title="异常趋势"><LineChart :series="[{ name: '异常数', color: 'var(--el-color-danger)', points: tr.excTrend }]" /></ChartCard>
            <ChartCard title="各系统通过率对比"><BarChart :data="systemCompareBars" horizontal unit="%" /></ChartCard>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, ArrowDown, RefreshLeft } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore } from '@/stores/protocol'
import StatCard from '@/components/stats/StatCard.vue'
import DonutChart from '@/components/stats/DonutChart.vue'
import BarChart from '@/components/stats/BarChart.vue'
import LineChart from '@/components/stats/LineChart.vue'
import Histogram from '@/components/stats/Histogram.vue'
import ChartCard from '@/components/stats/ChartCard.vue'
import {
  aggregateOverview, aggregateExecution, aggregateRequest, aggregatePerformance,
  aggregateException, aggregateInterface, aggregateTrend, aggregateMq, exportRows, toCSV,
} from '@/utils/statsAggregator'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const protoStore = useProtocolStore()

/* ===== 筛选状态 ===== */
const systemId = ref(systemStore.currentId || '')
const moduleId = ref('')
const interfaceId = ref('')
const timeRange = ref('all')
const runId = ref(route.query.runId || '')
const activeTab = ref('overview')

watch(() => systemStore.currentId, (v) => { systemId.value = v || '' })

const onSystemChange = () => { moduleId.value = ''; interfaceId.value = '' }
const clearRunId = () => { runId.value = '' }
const resetFilters = () => {
  systemId.value = ''
  moduleId.value = ''
  interfaceId.value = ''
  timeRange.value = 'all'
  runId.value = ''
}

/* ===== 选项 ===== */
const systemOptions = computed(() => systemStore.visibleSystems.map((s) => ({ label: s.name, value: s.id })))
const moduleOptions = computed(() => connStore.modulesOf(systemId.value || null))
const interfaceOptions = computed(() => protoStore.interfaces.filter((i) => {
  if (systemId.value && i.systemId !== systemId.value) return false
  if (moduleId.value && i.moduleId !== moduleId.value) return false
  return true
}))

/* ===== 当前筛选条件 ===== */
const filters = computed(() => ({
  systemId: systemId.value || '',
  moduleId: moduleId.value || '',
  interfaceId: interfaceId.value || '',
  timeRange: timeRange.value,
  runId: runId.value || '',
}))

/* ===== 各维度聚合 ===== */
const ov = computed(() => aggregateOverview(filters.value))
const ex = computed(() => aggregateExecution(filters.value))
const rq = computed(() => aggregateRequest(filters.value))
const pf = computed(() => aggregatePerformance(filters.value))
const ec = computed(() => aggregateException(filters.value))
const itf = computed(() => aggregateInterface(filters.value))
const tr = computed(() => aggregateTrend(filters.value))
const mq = computed(() => aggregateMq(filters.value))

const systemCompareBars = computed(() => tr.value.systemCompare.map((s) => ({
  label: systemStore.systems.find((x) => x.id === s.systemId)?.name || s.systemId || '未知',
  value: s.passRate,
})))

const interfaceRouteId = (row) => {
  if (row.interfaceId) return row.interfaceId
  return protoStore.interfaces.find((i) => i.name === row.iface || i.path === row.iface)?.id || ''
}

const openInterface = (row) => {
  const id = interfaceRouteId(row)
  if (!id) return
  router.push({ path: '/protocol', query: { interfaceId: String(id) } })
}

/* ===== 导出 ===== */
const onExport = (cmd) => {
  const rows = exportRows(cmd, filters.value)
  const csv = '﻿' + toCSV(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `统计_${cmd}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.statistics {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions { display: flex; gap: 8px; }

.filter-bar {
  flex-shrink: 0;
  :deep(.el-card__body) { padding: 12px 16px; }
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.filter-spacer { flex: 1; }
.run-tag { margin-left: 4px; }

.stat-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 4px 16px 16px;
  }
  :deep(.el-tabs) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-top: 8px;
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}

.ok { color: var(--el-color-success); font-variant-numeric: tabular-nums; }
.warn { color: var(--el-color-warning); font-variant-numeric: tabular-nums; }
.danger { color: var(--el-color-danger); font-weight: 600; }
.mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
</style>
