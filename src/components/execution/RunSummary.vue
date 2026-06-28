<template>
  <div class="summary-page">
    <el-card shadow="never" class="exec-card">
      <template #header>
        <div class="card-head">
          <div>
            <span class="card-title">本次执行摘要</span>
            <span class="card-sub">深度趋势分析可继续进入统计与可视化模块</span>
          </div>
          <el-tag :type="summary.failedRequests + summary.errorRequests > 0 ? 'danger' : 'success'" effect="dark">
            {{ summary.failedRequests + summary.errorRequests > 0 ? '存在异常' : '通过' }}
          </el-tag>
        </div>
      </template>
      <div class="summary-grid">
        <div v-for="item in summaryItems" :key="item.label" class="summary-item" :class="item.cls">
          <span class="summary-item__value">{{ item.value }}</span>
          <span class="summary-item__label">{{ item.label }}</span>
        </div>
        <div class="pass-rate">
          <el-progress type="circle" :percentage="summary.passRate" :width="92" />
          <span>通过率</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="exec-card">
      <template #header><span class="card-title">分步骤结果</span></template>
      <el-table :data="store.stepResults" size="small" empty-text="暂无结果">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="trace-mini">
              <div v-for="trace in row.traces.filter((item) => item.status !== 'pass').slice(0, 6)" :key="trace.traceId" class="trace-mini__item">
                <span class="mono">{{ trace.traceId }}</span>
                <span>{{ trace.note }}</span>
                <span class="mono">{{ trace.duration }}ms</span>
              </div>
              <span v-if="!row.traces.some((item) => item.status !== 'pass')" class="muted">该步骤无失败或异常 Trace。</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="任务" prop="taskName" min-width="180" />
        <el-table-column label="接口" prop="iface" min-width="150" />
        <el-table-column label="请求" prop="total" width="80" align="center" />
        <el-table-column label="成功" prop="success" width="80" align="center" />
        <el-table-column label="失败" prop="failed" width="80" align="center" />
        <el-table-column label="异常" prop="error" width="80" align="center" />
        <el-table-column label="平均时延" width="100" align="center">
          <template #default="{ row }">{{ row.avgMs }}ms</template>
        </el-table-column>
        <el-table-column label="结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === '通过' ? 'success' : 'danger'" size="small">{{ row.result }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- MQ 探测结果汇总 -->
    <el-card v-if="store.hasMqTasks" shadow="never" class="exec-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">MQ 探测结果</span>
          <el-tag v-if="mqOverallOk" type="success" size="small" effect="plain">全部通过</el-tag>
          <el-tag v-else type="warning" size="small" effect="plain">存在告警</el-tag>
        </div>
      </template>
      <el-table :data="mqSummaryRows" size="small" empty-text="暂无 MQ 探测结果">
        <el-table-column label="任务" prop="taskName" min-width="180" />
        <el-table-column label="Broker 健康" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.brokerStatus === 'healthy' ? 'success' : row.brokerStatus === 'warning' ? 'warning' : 'danger'" size="small">
              {{ { healthy: '健康', warning: '告警', error: '异常' }[row.brokerStatus] || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生产端" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.producerStatus === 'pass' ? 'success' : 'danger'" size="small">
              {{ row.producerStatus === 'pass' ? '通过' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消费端" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.consumerStatus === 'pass' ? 'success' : row.consumerStatus === 'warning' ? 'warning' : 'danger'" size="small">
              {{ { pass: '正常', warning: '告警', fail: '失败' }[row.consumerStatus] || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消息延迟" width="100" align="center">
          <template #default="{ row }">{{ row.producerLatency ? row.producerLatency + 'ms' : '—' }}</template>
        </el-table-column>
        <el-table-column label="综合" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.overall === 'pass' ? 'success' : row.overall === 'warning' ? 'warning' : 'danger'" effect="dark" size="small">
              {{ row.overall === 'pass' ? '全部通过' : row.overall === 'warning' ? '部分告警' : '存在异常' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="exec-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">本次异常清单</span>
          <el-button type="warning" plain size="small" :disabled="!store.exceptions.length" @click="router.push('/exception')">全部转入故障异常管理</el-button>
        </div>
      </template>
      <el-table :data="store.exceptions" size="small" empty-text="本次无异常">
        <el-table-column label="类型" prop="type" width="120" />
        <el-table-column label="接口" prop="iface" min-width="130" />
        <el-table-column label="级别" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.level === '高' ? 'danger' : 'warning'" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="详情" min-width="260">
          <template #default="{ row }">{{ detailText(row) }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ row.capturedTime || row.time }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="exec-card actions-card">
      <el-button type="primary" :icon="DocumentChecked" :disabled="store.savedRunToTasks" @click="saveRecord">
        {{ store.savedRunToTasks ? '已存为执行记录' : '存为执行记录' }}
      </el-button>
      <el-button :icon="TrendCharts" @click="router.push({ path: '/statistics', query: { runId: store.currentRunId } })">查看统计可视化</el-button>
      <el-button :icon="Tickets" @click="router.push({ path: '/report', query: { runId: store.currentRunId } })">生成联试报告</el-button>
      <el-button :icon="Download" @click="exportCsv">导出结果 CSV</el-button>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DocumentChecked, Download, Tickets, TrendCharts } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'

const store = useExecutionStore()
const router = useRouter()
const summary = computed(() => store.summary)
const summaryItems = computed(() => [
  { label: '总请求', value: summary.value.totalRequests },
  { label: '成功', value: summary.value.successRequests, cls: 'summary-item--ok' },
  { label: '失败', value: summary.value.failedRequests, cls: 'summary-item--bad' },
  { label: '异常', value: summary.value.errorRequests, cls: 'summary-item--warn' },
  { label: '总耗时', value: `${summary.value.executionTime}s` },
  { label: '平均时延', value: `${summary.value.avgResponseTime}ms` },
  { label: 'RPS', value: summary.value.rps },
])

const detailText = (row) => row.detail?.ruleMessage || row.detail || row.remark || ''

const mqSummaryRows = computed(() =>
  store.mqProbeItems.map((item) => {
    const probe = store.mqProbeResults[item.id] || {}
    const bh = probe.brokerHealth || {}
    const pc = probe.producerConnect || {}
    const cc = probe.consumerConnect || {}
    const statuses = [bh.overall === 'healthy' ? 'pass' : bh.overall === 'warning' ? 'warning' : 'fail', pc.status === 'pass' ? 'pass' : 'fail', cc.status === 'pass' ? 'pass' : cc.status === 'warning' ? 'warning' : 'fail']
    const hasFail = statuses.includes('fail')
    const hasWarn = statuses.includes('warning')
    return {
      taskName: item.task?.name || '未知任务',
      brokerStatus: bh.overall || 'unknown',
      producerStatus: pc.status || 'pending',
      consumerStatus: cc.status || 'pending',
      producerLatency: pc.latency || null,
      overall: hasFail ? 'fail' : hasWarn ? 'warning' : 'pass',
    }
  })
)

const mqOverallOk = computed(() => mqSummaryRows.value.every((r) => r.overall === 'pass'))

const saveRecord = () => {
  if (store.saveRunRecord()) ElMessage.success('执行记录已保存')
}

const exportCsv = () => {
  const header = '任务,接口,请求,成功,失败,异常,平均时延,结果'
  const rows = store.stepResults.map((row) =>
    [row.taskName, row.iface, row.total, row.success, row.failed, row.error, `${row.avgMs}ms`, row.result].join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `execution-${store.currentRunId || Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.summary-page { display: flex; flex-direction: column; gap: 14px; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.card-sub, .muted { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-grid { display: grid; grid-template-columns: repeat(7, minmax(90px, 1fr)) 120px; gap: 10px; align-items: center; }
.summary-item {
  min-height: 72px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-extra-light);
}
.summary-item__value { display: block; font: 700 22px Consolas, Monaco, monospace; }
.summary-item__label { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-item--ok .summary-item__value { color: var(--el-color-success); }
.summary-item--bad .summary-item__value { color: var(--el-color-danger); }
.summary-item--warn .summary-item__value { color: var(--el-color-warning); }
.pass-rate { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
.trace-mini { padding: 6px 24px; display: flex; flex-direction: column; gap: 6px; }
.trace-mini__item { display: grid; grid-template-columns: 180px 1fr 80px; gap: 10px; color: var(--el-text-color-secondary); }
.mono { font-family: Consolas, Monaco, monospace; }
.actions-card :deep(.el-card__body) { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 1180px) {
  .summary-grid { grid-template-columns: repeat(4, minmax(90px, 1fr)); }
}
</style>
