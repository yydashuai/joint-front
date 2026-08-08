<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="step-head">
          <div>
            <div class="blk__title"><el-icon><Coin /></el-icon> 选择联试批次（报告数据来源）</div>
          </div>
          <div class="step-actions">
            <el-button type="primary" :icon="ArrowRight" :disabled="!form.batchId" @click="$emit('next')">下一步</el-button>
          </div>
        </div>
        <el-select
          v-model="form.batchId"
          placeholder="选择已完成的发送或接收批次"
          class="w-full"
          popper-class="report-batch-select-popper"
          @change="onRunChange"
        >
          <el-option v-for="r in runs" :key="r.id" :label="batchSelectLabel(r)" :value="r.id">
            <div class="batch-option">
              <div class="batch-option__main">
                <strong>{{ r.scope?.displayName || '未命名接口范围' }}</strong>
                <el-tag size="small" :type="r.batchType === 'receive' ? 'success' : 'primary'">
                  {{ batchTypeLabel(r) }}
                </el-tag>
              </div>
              <div class="batch-option__sub">
                {{ batchTime(r) }} · {{ batchMetrics(r) }}
              </div>
            </div>
          </el-option>
        </el-select>

        <el-card v-if="run" shadow="never" class="ov-card">
          <template #header>
            <div class="ov-card__head">
              <span class="ov-card__title">批次概览</span>
              <el-tag size="small" type="success" effect="dark">已完成</el-tag>
            </div>
          </template>
          <div class="source-band" :class="`source-band--${run.batchType || 'send'}`">
            <div class="source-band__label">数据来源</div>
            <div class="source-band__main">{{ batchSourceTitle }}</div>
            <div class="source-band__sub">{{ run.startedAt }} — {{ run.finishedAt }}</div>
          </div>
          <div v-if="run.batchType !== 'receive'" class="stat-grid">
            <div class="stat-card">
              <span class="stat-card__label">已发送</span>
              <strong>{{ sendSummary.sentCount }}</strong>
              <span>计划 {{ sendSummary.plannedCount }} · 未发送 {{ sendSummary.unsentCount }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">覆盖接口</span>
              <strong>{{ sendSummary.interfaceCount }}</strong>
              <span>{{ interfaceText }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">使用数据集</span>
              <strong>{{ sendSummary.datasetCount }}</strong>
              <span>批次内发送数据来源</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">批次时长</span>
              <strong>{{ sendSummary.durationSeconds }}s</strong>
              <span>{{ batchTime(run) }} 开始</span>
            </div>
          </div>
          <div v-else class="stat-grid">
            <div class="stat-card">
              <span class="stat-card__label">接收总量</span>
              <strong>{{ receiveSummary.totalReceived }}</strong>
              <span>覆盖 {{ receiveSummary.interfaceCount }} 个接口</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">正常解析</span>
              <strong>{{ receiveSummary.normalCount }}</strong>
              <span>已解析 {{ receiveSummary.parsedCount }} 条</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">校验异常</span>
              <strong>{{ receiveSummary.validationAbnormalCount }}</strong>
              <span>无法解析 {{ receiveSummary.unparsedCount }} 条</span>
            </div>
            <div class="stat-card">
              <span class="stat-card__label">数据留存</span>
              <strong>{{ receiveSummary.savedToDatasetCount }}</strong>
              <span>已转发 {{ receiveSummary.forwardedCount }} 条</span>
            </div>
          </div>
        </el-card>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useRunBatchStore } from '@/stores/runBatch'

const props = defineProps({ form: { type: Object, required: true } })
defineEmits(['next'])

const batchStore = useRunBatchStore()

const run = computed(() => batchStore.byId(props.form.batchId))
const runs = computed(() => {
  const list = batchStore.reportable
  if (run.value && !list.some((item) => item.id === run.value.id)) return [run.value, ...list]
  return list
})
const interfaceNames = computed(() => run.value?.scope?.interfaceNames?.length
  ? run.value.scope.interfaceNames
  : [...new Set((run.value?.tasks || run.value?.stepResults || []).map((item) => item.iface).filter(Boolean))])
const interfaceText = computed(() => interfaceNames.value.length ? interfaceNames.value.join('、') : '未记录接口')
const reportTitle = computed(() => run.value
  ? `${run.value.scope?.displayName || '接口联试'} ${run.value.batchType === 'receive' ? '接收' : '发送'}联试报告`
  : '')
const batchSourceTitle = computed(() => run.value
  ? `${run.value.scope?.displayName || '未命名接口范围'} · ${batchTypeLabel(run.value)}`
  : '')
const sendSummary = computed(() => {
  const summary = run.value?.summary || {}
  const sentCount = summary.sentCount ?? summary.totalRequests ?? 0
  const plannedCount = summary.plannedCount ?? sentCount
  return {
    sentCount,
    plannedCount,
    unsentCount: summary.unsentCount ?? Math.max(0, plannedCount - sentCount),
    interfaceCount: summary.interfaceCount ?? interfaceNames.value.length,
    datasetCount: summary.datasetCount ?? new Set((run.value?.tasks || []).flatMap((item) => item.datasetIds || [])).size,
    durationSeconds: summary.durationSeconds ?? summary.executionTime ?? 0,
  }
})
const receiveSummary = computed(() => ({
  totalReceived: run.value?.summary?.totalReceived || 0,
  parsedCount: run.value?.summary?.parsedCount || 0,
  normalCount: run.value?.summary?.normalCount || 0,
  validationAbnormalCount: run.value?.summary?.validationAbnormalCount || 0,
  unparsedCount: run.value?.summary?.unparsedCount || 0,
  forwardedCount: run.value?.summary?.forwardedCount || 0,
  savedToDatasetCount: run.value?.summary?.savedToDatasetCount || 0,
  interfaceCount: run.value?.summary?.interfaceCount ?? interfaceNames.value.length,
}))

const pad = (value) => String(value || '').padStart(2, '0')
const formatDateTime = (text = '') => {
  const [rawDate = '', rawTime = ''] = String(text).trim().replace(/\//g, '-').split(' ')
  const [y = '', m = '', d = ''] = rawDate.split('-')
  const [hh = '', mm = ''] = rawTime.split(':')
  if (!y || !m || !d) return text || '未记录时间'
  return `${y}-${pad(m)}-${pad(d)} ${pad(hh || '00')}:${pad(mm || '00')}`
}
const batchTime = (batch) => formatDateTime(batch?.startedAt || batch?.time)
const batchTypeLabel = (batch) => batch?.batchType === 'receive' ? '接收批次' : '发送批次'
const batchMetrics = (batch) => batch?.batchType === 'receive'
  ? `${batch?.summary?.totalReceived || 0}条接收 / ${batch?.summary?.unparsedCount || 0}条无法解析`
  : `${batch?.summary?.sentCount ?? batch?.summary?.totalRequests ?? 0}次发送 / ${(batch?.scope?.interfaceIds || []).length}个接口`
const batchSelectLabel = (batch) => `${batch?.scope?.displayName || '未命名接口范围'} · ${batchTypeLabel(batch)} · ${batchTime(batch)}`

const onRunChange = () => {
  if (run.value) props.form.title = reportTitle.value
}
const ensureRun = () => {
  const list = runs.value
  if (!list.some((r) => r.id === props.form.batchId)) {
    props.form.batchId = list[0]?.id || null
    onRunChange()
  }
}
onMounted(() => {
  ensureRun()
  onRunChange()
})
watch(() => props.form.batchId, onRunChange)
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.step__scroll { flex: 1; min-height: 0; }
.step__inner { width: 100%; box-sizing: border-box; padding: 4px 4px 24px; }
.w-full { width: 100%; }
:global(.report-batch-select-popper .el-select-dropdown__item) {
  height: auto;
  min-height: 58px;
  padding: 8px 12px;
}
:global(.report-batch-select-popper .el-select-dropdown__item.is-selected) {
  background: var(--el-color-primary-light-9);
}
:global(.report-batch-select-popper .el-select-dropdown__item.is-hovering) {
  background: var(--el-fill-color-light);
}
:global(.report-batch-select-popper .batch-option) {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
:global(.report-batch-select-popper .batch-option__main) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
:global(.report-batch-select-popper .batch-option__main strong) {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:global(.report-batch-select-popper .batch-option__sub) {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px;
}
.step-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.blk__title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
  font-size: 14px; font-weight: 600; color: var(--el-text-color-primary);
  .el-icon { color: var(--el-color-primary); }
}

.ov-card { margin-top: 14px; }
.ov-card__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ov-card__title { font-weight: 600; }
.source-band {
  border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;
  background: linear-gradient(135deg, #eef6ff, #f7faff);
  border: 1px solid #dbeafe;
}
.source-band--receive { background: linear-gradient(135deg, #ecfdf5, #f7fffb); border-color: #bbf7d0; }
.source-band--receive .source-band__label { color: #047857; }
.source-band__label { font-size: 12px; color: #2563eb; font-weight: 700; margin-bottom: 4px; }
.source-band__main { font-size: 18px; font-weight: 700; color: #111827; }
.source-band__sub { margin-top: 4px; font-size: 12px; color: #64748b; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.stat-card {
  min-height: 98px; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;
  border: 1px solid var(--el-border-color-lighter); color: #0f172a; background: var(--el-fill-color-extra-light);
  strong { font-size: 22px; line-height: 1.1; }
  span:last-child { font-size: 12px; color: #64748b; }
}
.stat-card__label { font-size: 12px; font-weight: 700; color: var(--el-text-color-secondary); }
@media (max-width: 980px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .step-head { flex-direction: column; }
  .step-actions { width: 100%; justify-content: flex-end; }
  .stat-grid { grid-template-columns: 1fr; }
}
</style>
