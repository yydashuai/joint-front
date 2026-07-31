<template>
  <div class="page statistics">
    <div class="page__header">
      <div>
        <h2>统计与可视化</h2>
      </div>
      <div class="header-actions">
        <el-dropdown trigger="click" @command="onExport">
          <el-button type="primary" :icon="Download">
            导出数据<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="run">执行批次（CSV）</el-dropdown-item>
              <el-dropdown-item command="reception">本次接收（CSV）</el-dropdown-item>
              <el-dropdown-item command="exception">异常样本（CSV）</el-dropdown-item>
              <el-dropdown-item command="interface">接口观测（CSV）</el-dropdown-item>
              <el-dropdown-item command="asset">数据资产（CSV）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="scope-console">
      <div class="scope-identity">
        <span>当前统计范围</span>
        <strong>{{ scopeTitle }}</strong>
      </div>
      <div class="scope-filter">
        <el-select v-model="moduleId" placeholder="全部模块" clearable @change="interfaceId = ''">
          <el-option v-for="module in moduleOptions" :key="module.id" :label="module.name" :value="module.id" />
        </el-select>
        <el-select v-model="interfaceId" placeholder="全部接口" clearable filterable>
          <el-option v-for="iface in interfaceOptions" :key="iface.id" :label="iface.name" :value="iface.id" />
        </el-select>
        <el-segmented v-if="activeTab !== 'receive'" v-model="timeRange" :options="timeOptions" />
        <el-tag v-if="runId" type="warning" closable @close="clearRunId">限定执行批次</el-tag>
        <el-button text :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>
    </div>

    <el-card shadow="never" class="stat-workbench">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="运行总览" name="overview">
          <section class="channel-observatory">
            <div class="observatory-head">
              <div>
                <h3>发送 / 接收双通道观测</h3>
              </div>
            </div>

            <div class="channel-grid">
              <article class="channel channel--send">
                <div class="channel__rail">
                  <span class="channel__pulse" />
                  <strong>发送通道</strong>
                  <small>执行历史</small>
                </div>
                <div class="channel__metrics">
                  <div><span>执行批次</span><b>{{ ov.send.batches }}</b></div>
                  <div><span>任务执行项</span><b>{{ ov.send.tasks }}</b></div>
                  <div><span>已发送报文</span><b>{{ formatNumber(ov.send.messages) }}</b></div>
                  <div><span>涉及接口</span><b>{{ ov.send.interfaces }}</b></div>
                </div>
              </article>

              <article class="channel channel--receive">
                <div class="channel__rail">
                  <span class="channel__pulse" />
                  <strong>接收通道</strong>
                  <el-tag :type="receiveStatus.type" size="small" effect="plain">{{ receiveStatus.label }}</el-tag>
                </div>
                <div class="channel__metrics">
                  <div><span>本次接收</span><b>{{ ov.receive.total }}</b></div>
                  <div><span>完成解析</span><b>{{ ov.receive.parsed }}</b></div>
                  <div><span>校验异常</span><b>{{ ov.receive.abnormal }}</b></div>
                  <div><span>无法解析</span><b>{{ ov.receive.unparsed }}</b></div>
                </div>
              </article>
            </div>
          </section>

          <section class="asset-ribbon">
            <div>
              <span>异常样本</span>
              <strong>{{ ov.assets.exceptionSamples }}</strong>
              <small>历史捕获库</small>
            </div>
            <div>
              <span>测试数据集</span>
              <strong>{{ ov.assets.datasets }}</strong>
              <small>{{ ov.assets.dataRows }} 行数据</small>
            </div>
            <div>
              <span>数据文件</span>
              <strong>{{ ov.assets.files }}</strong>
              <small>导入与演示资产</small>
            </div>
            <div>
              <span>接口定义</span>
              <strong>{{ ov.assets.definedInterfaces }}</strong>
              <small>当前范围</small>
            </div>
            <div>
              <span>在线模块</span>
              <strong>{{ ov.assets.onlineModules }}<em>/{{ ov.assets.moduleTotal }}</em></strong>
              <small>Ping 当前快照</small>
            </div>
          </section>

          <div class="chart-grid chart-grid--overview">
            <ChartCard title="已发送报文趋势">
              <LineChart :series="[{ name: '已发送报文', color: sendColor, points: ov.sendTrend }]" />
            </ChartCard>
            <ChartCard title="异常样本捕获趋势">
              <LineChart :series="[{ name: '异常样本', color: exceptionColor, points: ov.exceptionTrend }]" />
            </ChartCard>
            <ChartCard :title="`按${ov.axisName}发送量`">
              <BarChart :data="ov.sendByScope" horizontal />
            </ChartCard>
            <ChartCard :title="`按${ov.axisName}异常样本`">
              <BarChart :data="ov.exceptionByScope" horizontal />
            </ChartCard>
          </div>
        </el-tab-pane>

        <el-tab-pane label="发送执行" name="send">
          <div class="section-intro">
            <div>
              <h3>执行批次与发送规模</h3>
            </div>
          </div>
          <div class="kpi-grid kpi-grid--five">
            <StatCard label="执行批次" :value="send.kpis.batches" tone="primary" />
            <StatCard label="任务执行项" :value="send.kpis.tasks" />
            <StatCard label="已发送报文" :value="send.kpis.messages" tone="primary" />
            <StatCard label="涉及接口" :value="send.kpis.interfaces" />
            <StatCard label="累计执行时长" :value="send.kpis.durationSeconds" suffix="s" />
          </div>
          <div class="chart-grid">
            <ChartCard title="每日发送量">
              <LineChart :series="[{ name: '发送报文', color: sendColor, points: send.messagesByDay }]" />
            </ChartCard>
            <ChartCard title="每日执行批次">
              <BarChart :data="trendBars(send.batchesByDay, sendColor)" />
            </ChartCard>
            <ChartCard title="接口发送量 Top">
              <BarChart :data="send.byInterface" horizontal />
            </ChartCard>
            <ChartCard title="模块发送量">
              <BarChart :data="send.byModule" horizontal />
            </ChartCard>
          </div>
          <ChartCard title="最近执行批次" full>
            <el-table :data="send.recentBatches" size="small" max-height="300" empty-text="当前范围暂无执行批次">
              <el-table-column prop="startedAt" label="开始时间" width="168" />
              <el-table-column prop="name" label="执行批次" min-width="260" show-overflow-tooltip />
              <el-table-column prop="taskCount" label="任务执行项" width="104" align="right" />
              <el-table-column prop="interfaceCount" label="涉及接口" width="96" align="right" />
              <el-table-column prop="messages" label="已发送报文" width="110" align="right" />
              <el-table-column label="执行时长" width="92" align="right">
                <template #default="{ row }">{{ row.duration }}s</template>
              </el-table-column>
              <el-table-column label="批次状态" width="96" align="center">
                <template #default="{ row }"><el-tag :type="batchState(row.state).type" size="small">{{ batchState(row.state).label }}</el-tag></template>
              </el-table-column>
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <el-tab-pane label="接收监测" name="receive">
          <div class="section-intro">
            <div>
              <h3>本次监听会话</h3>
            </div>
          </div>
          <div class="session-strip">
            <span class="session-status" :class="`session-status--${receive.status}`">{{ receiveStatus.label }}</span>
            <span>监听接口 <b>{{ receive.monitoredInterfaces }}</b></span>
            <span>持续时间 <b>{{ receive.elapsedSeconds }}s</b></span>
            <span>接收速率 <b>{{ receive.rate }} 条/s</b></span>
            <span>已转发 <b>{{ receive.forwarded }}</b></span>
          </div>
          <div class="kpi-grid">
            <StatCard label="本次接收" :value="receive.total" tone="primary" />
            <StatCard label="完成解析" :value="receive.parsed" />
            <StatCard label="解析正常" :value="receive.normal" tone="success" />
            <StatCard label="校验异常" :value="receive.abnormal" tone="warning" />
            <StatCard label="无法解析" :value="receive.unparsed" tone="danger" />
          </div>
          <div class="chart-grid">
            <ChartCard title="接收数据分类">
              <DonutChart :data="receive.composition" center-label="本次接收" />
            </ChartCard>
            <ChartCard title="按报文接收数量">
              <BarChart :data="receive.byInterface" horizontal />
            </ChartCard>
          </div>
          <ChartCard title="最近接收数据" full>
            <el-table :data="receive.latest" size="small" max-height="310" empty-text="开始监听后显示本次接收数据">
              <el-table-column prop="seq" label="#" width="58" align="right" />
              <el-table-column prop="time" label="接收时间" width="110" />
              <el-table-column prop="iface" label="报文" min-width="160" show-overflow-tooltip />
              <el-table-column label="模块" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ moduleName(row.moduleId) }}</template>
              </el-table-column>
              <el-table-column prop="byteLength" label="字节数" width="82" align="right" />
              <el-table-column label="解析结果" width="112" align="center">
                <template #default="{ row }">
                  <el-tag :type="verdictType(row.verdict?.status)" size="small">{{ row.verdictLabel }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="issue" label="异常说明" min-width="260" show-overflow-tooltip />
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <el-tab-pane label="异常样本" name="exception">
          <div class="section-intro">
            <div>
              <h3>接收异常数据沉淀</h3>
            </div>
          </div>
          <div class="kpi-grid kpi-grid--six">
            <StatCard label="异常样本" :value="exception.kpis.total" tone="warning" />
            <StatCard label="无法解析" :value="exception.kpis.unparsed" tone="danger" />
            <StatCard label="已入库样本" :value="exception.kpis.saved" tone="success" />
            <StatCard label="尚未入库" :value="exception.kpis.unsaved" />
            <StatCard label="已创建变体" :value="exception.kpis.variants" />
            <StatCard label="涉及接口" :value="exception.kpis.interfaces" />
          </div>
          <div class="chart-grid">
            <ChartCard title="异常类型分布">
              <DonutChart :data="exception.byType" center-label="异常样本" />
            </ChartCard>
            <ChartCard title="数据集复用情况">
              <DonutChart :data="exception.bySaved" center-label="异常样本" />
            </ChartCard>
            <ChartCard title="模块异常样本 Top">
              <BarChart :data="exception.byModule" horizontal />
            </ChartCard>
            <ChartCard title="异常样本捕获趋势">
              <LineChart :series="[{ name: '异常样本', color: exceptionColor, points: exception.trend }]" />
            </ChartCard>
          </div>
          <ChartCard title="最近捕获样本" full>
            <el-table :data="exception.latest" size="small" max-height="300" empty-text="当前范围暂无异常样本">
              <el-table-column prop="capturedTime" label="捕获时间" width="168" />
              <el-table-column prop="iface" label="报文" min-width="145" show-overflow-tooltip />
              <el-table-column prop="type" label="异常类型" width="126">
                <template #default="{ row }"><el-tag :type="exceptionType(row.type)" size="small">{{ row.type }}</el-tag></template>
              </el-table-column>
              <el-table-column label="异常字段" min-width="130" show-overflow-tooltip>
                <template #default="{ row }">{{ row.issues?.[0]?.field || row.detail?.fieldPath || '报文整体' }}</template>
              </el-table-column>
              <el-table-column label="异常说明" min-width="260" show-overflow-tooltip>
                <template #default="{ row }">{{ row.issues?.[0]?.message || row.detail?.ruleMessage || row.remark }}</template>
              </el-table-column>
              <el-table-column label="入库情况" width="104" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.savedDatasetIds?.length" type="success" size="small">已入库</el-tag>
                  <span v-else class="muted">未入库</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="76" fixed="right" align="center">
                <template #default="{ row }"><el-button link type="primary" @click="openException(row)">查看</el-button></template>
              </el-table-column>
            </el-table>
          </ChartCard>
        </el-tab-pane>

        <el-tab-pane label="接口与数据" name="asset">
          <div class="section-intro">
            <div>
              <h3>接口观测与测试数据资产</h3>
            </div>
          </div>
          <div class="kpi-grid kpi-grid--six">
            <StatCard label="接口定义" :value="assets.kpis.interfaces" tone="primary" />
            <StatCard label="已有观测记录" :value="assets.kpis.activeInterfaces" />
            <StatCard label="测试数据集" :value="assets.kpis.datasets" tone="primary" />
            <StatCard label="当前数据行" :value="assets.kpis.preparedRows" />
            <StatCard label="历史数据行" :value="assets.kpis.historyRows" />
            <StatCard label="数据文件" :value="assets.kpis.files" />
          </div>
          <div class="chart-grid">
            <ChartCard title="接口观测覆盖">
              <DonutChart :data="assets.interfaceUsage" center-label="接口定义" />
            </ChartCard>
            <ChartCard title="历史数据来源">
              <DonutChart :data="assets.historyBySource" center-label="历史数据" />
            </ChartCard>
            <ChartCard title="模块数据集数量">
              <BarChart :data="assets.datasetsByModule" horizontal />
            </ChartCard>
          </div>
          <ChartCard title="接口观测明细" full>
            <el-table :data="assets.interfaceRows" size="small" max-height="330" empty-text="当前范围暂无接口定义">
              <el-table-column label="接口" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-link type="primary" :underline="false" @click="openInterface(row)">{{ row.iface }}</el-link>
                </template>
              </el-table-column>
              <el-table-column prop="module" label="所属模块" min-width="150" show-overflow-tooltip />
              <el-table-column prop="executions" label="任务执行项" width="104" align="right" sortable />
              <el-table-column prop="sent" label="已发送报文" width="104" align="right" sortable />
              <el-table-column prop="received" label="本次接收" width="94" align="right" sortable />
              <el-table-column prop="exceptionSamples" label="异常样本" width="94" align="right" sortable />
              <el-table-column prop="lastActivity" label="最近记录" width="168" />
            </el-table>
          </ChartCard>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Download, RefreshLeft } from '@element-plus/icons-vue'
import BarChart from '@/components/stats/BarChart.vue'
import ChartCard from '@/components/stats/ChartCard.vue'
import DonutChart from '@/components/stats/DonutChart.vue'
import LineChart from '@/components/stats/LineChart.vue'
import StatCard from '@/components/stats/StatCard.vue'
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import {
  aggregateAssets,
  aggregateException,
  aggregateOverview,
  aggregateReceive,
  aggregateSend,
  exportRows,
  toCSV,
} from '@/utils/statsAggregator'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const protocolStore = useProtocolStore()
const exceptionStore = useExceptionStore()

const sendColor = '#2f6bff'
const exceptionColor = '#d97706'
const moduleId = ref('')
const interfaceId = ref('')
const timeRange = ref('all')
const runId = ref(route.query.runId || '')
const activeTab = ref(route.query.tab || 'overview')
const timeOptions = [
  { label: '全部', value: 'all' },
  { label: '近 7 天', value: '7d' },
  { label: '近 3 天', value: '3d' },
  { label: '今天', value: '1d' },
]

watch(() => systemStore.currentId, () => {
  moduleId.value = ''
  interfaceId.value = ''
})

const moduleOptions = computed(() => connStore.modulesOf(systemStore.currentId))
const interfaceOptions = computed(() => protocolStore.testInterfaces.filter((item) => {
  if (systemStore.currentId && item.systemId !== systemStore.currentId) return false
  if (moduleId.value && item.moduleId !== moduleId.value) return false
  return true
}))
const scopeTitle = computed(() => {
  const systemName = systemStore.current?.name || '全部系统'
  const moduleName = moduleId.value ? moduleNameOf(moduleId.value) : '全部模块'
  const interfaceName = interfaceId.value
    ? protocolStore.testInterfaces.find((item) => String(item.id) === String(interfaceId.value))?.name
    : ''
  return [systemName, moduleName, interfaceName].filter(Boolean).join(' · ')
})
const filters = computed(() => ({
  systemId: systemStore.currentId || '',
  moduleId: moduleId.value || '',
  interfaceId: interfaceId.value || '',
  timeRange: timeRange.value,
  runId: runId.value || '',
}))

const ov = computed(() => aggregateOverview(filters.value))
const send = computed(() => aggregateSend(filters.value))
const receive = computed(() => aggregateReceive(filters.value))
const exception = computed(() => aggregateException(filters.value))
const assets = computed(() => aggregateAssets(filters.value))
const receiveStatus = computed(() => ({
  idle: { label: '待监听', type: 'info' },
  listening: { label: '监听中', type: 'primary' },
  paused: { label: '已暂停', type: 'warning' },
  stopped: { label: '已停止', type: 'info' },
  done: { label: '已完成', type: 'success' },
}[receive.value.status] || { label: '待监听', type: 'info' }))

const moduleNameOf = (id) => connStore.nodes.find((item) => item.id === id)?.name || '未归属模块'
const moduleName = moduleNameOf
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const trendBars = (points, color) => points.map((point) => ({ label: point.x, value: point.y, color }))
const verdictType = (status) => ({ ok: 'success', error: 'warning', unparsed: 'danger' }[status] || 'info')
const exceptionType = (type) => exceptionStore.typeMeta(type).tone
const batchState = (state) => ({
  done: { label: '已完成', type: 'success' },
  running: { label: '执行中', type: 'primary' },
  paused: { label: '已暂停', type: 'warning' },
  stopped: { label: '已停止', type: 'info' },
}[state] || { label: state || '未记录', type: 'info' })

const clearRunId = () => { runId.value = '' }
const resetFilters = () => {
  moduleId.value = ''
  interfaceId.value = ''
  timeRange.value = 'all'
  runId.value = ''
}
const openException = (row) => router.push({ path: '/exception', query: { id: row.id } })
const openInterface = (row) => router.push({ path: '/execution', query: { interfaceId: String(row.interfaceId) } })

const onExport = (category) => {
  const rows = exportRows(category, filters.value)
  const csv = `\uFEFF${toCSV(rows)}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `统计_${category}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.statistics {
  --stats-send: #2f6bff;
  --stats-receive: #00a7b5;
  --stats-exception: #d97706;
  --stats-ink: #1d3557;
  --stats-slate: #64748b;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.page__header p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.header-actions { display: flex; gap: 8px; }
.scope-console {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  background:
    linear-gradient(90deg, rgba(47, 107, 255, .07), transparent 38%),
    var(--el-bg-color);
}
.scope-identity { display: flex; min-width: 210px; flex-direction: column; gap: 2px; }
.scope-identity span {
  color: var(--stats-slate);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.scope-identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scope-filter { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.scope-filter > .el-select { width: 154px; }
.stat-workbench {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 9px;
  :deep(.el-card__body) {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    padding: 3px 16px 16px;
    overflow: hidden;
  }
  :deep(.el-tabs) { display: flex; min-height: 0; flex: 1; flex-direction: column; }
  :deep(.el-tabs__content) { min-height: 0; flex: 1; padding-top: 10px; overflow: auto; }
  :deep(.el-tabs__item) { height: 46px; padding: 0 22px; font-weight: 650; }
}
.channel-observatory {
  padding: 16px;
  border: 1px solid #dbe4f2;
  border-radius: 12px;
  background:
    linear-gradient(145deg, rgba(29, 53, 87, .035), transparent 55%),
    var(--el-bg-color);
}
.observatory-head,
.section-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}
.observatory-head h3,
.section-intro h3 { margin: 2px 0 0; color: var(--stats-ink); font-size: 19px; }
.observatory-head p,
.section-intro p { max-width: 520px; margin: 0; color: var(--stats-slate); font-size: 12px; line-height: 1.6; text-align: right; }
.eyebrow {
  color: var(--stats-slate);
  font: 700 10px/1.2 Consolas, Monaco, monospace;
  letter-spacing: .12em;
}
.channel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.channel {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.channel::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--channel-color);
  content: '';
}
.channel--send { --channel-color: var(--stats-send); }
.channel--receive { --channel-color: var(--stats-receive); }
.channel__rail {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px 9px 17px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}
.channel__rail small { margin-left: auto; color: var(--stats-slate); }
.channel__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--channel-color);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--channel-color) 15%, transparent);
}
.channel__metrics { display: grid; grid-template-columns: repeat(4, 1fr); }
.channel__metrics > div {
  min-width: 0;
  padding: 14px 14px 15px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.channel__metrics > div:last-child { border-right: 0; }
.channel__metrics span { display: block; color: var(--stats-slate); font-size: 11px; white-space: nowrap; }
.channel__metrics b {
  display: block;
  margin-top: 4px;
  color: var(--stats-ink);
  font: 750 23px/1.1 Consolas, Monaco, monospace;
}
.asset-ribbon {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin: 12px 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  background: var(--el-fill-color-extra-light);
}
.asset-ribbon > div { padding: 12px 14px; border-right: 1px solid var(--el-border-color-lighter); }
.asset-ribbon > div:last-child { border-right: 0; }
.asset-ribbon span,
.asset-ribbon small { display: block; color: var(--stats-slate); font-size: 11px; }
.asset-ribbon strong { display: block; margin: 3px 0 1px; color: var(--stats-ink); font: 700 19px Consolas, monospace; }
.asset-ribbon em { color: var(--stats-slate); font-size: 12px; font-style: normal; font-weight: 500; }
.section-intro {
  padding: 4px 2px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(135px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.kpi-grid--six { grid-template-columns: repeat(6, minmax(125px, 1fr)); }
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.chart-grid--overview { margin-bottom: 0; }
.session-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(0, 167, 181, .07);
  color: var(--stats-slate);
  font-size: 12px;
}
.session-strip b { color: var(--stats-ink); font-family: Consolas, monospace; }
.session-status { padding: 3px 9px; border-radius: 999px; background: var(--el-fill-color); color: var(--stats-slate); font-weight: 650; }
.session-status--listening { background: rgba(0, 167, 181, .14); color: #007985; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1280px) {
  .scope-console { align-items: flex-start; flex-direction: column; }
  .scope-filter { width: 100%; flex-wrap: wrap; justify-content: flex-start; }
  .channel-grid { grid-template-columns: 1fr; }
  .kpi-grid,
  .kpi-grid--six { grid-template-columns: repeat(3, minmax(130px, 1fr)); }
}
@media (max-width: 980px) {
  .chart-grid { grid-template-columns: 1fr; }
  .asset-ribbon { grid-template-columns: repeat(2, 1fr); }
  .asset-ribbon > div { border-bottom: 1px solid var(--el-border-color-lighter); }
}
@media (prefers-reduced-motion: reduce) {
  .channel__pulse { box-shadow: none; }
}
</style>
