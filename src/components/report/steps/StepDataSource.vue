<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="step-head">
          <div>
            <div class="blk__title"><el-icon><Coin /></el-icon> 选择执行批次（报告数据来源）</div>
            <div class="blk__desc">报告会从所选执行批次读取硬数据，包含任务结果、接口指标和异常记录。</div>
          </div>
          <div class="step-actions">
            <el-button type="primary" :icon="ArrowRight" :disabled="!form.runId" @click="$emit('next')">下一步</el-button>
          </div>
        </div>
        <el-select
          v-model="form.runId"
          placeholder="选择一轮联试执行批次"
          class="w-full"
          popper-class="report-batch-select-popper"
          @change="onRunChange"
        >
          <el-option v-for="r in runs" :key="r.id" :label="batchSelectLabel(r)" :value="r.id">
            <div class="batch-option">
              <div class="batch-option__main">
                <strong>{{ batchTime(r) }}</strong>
                <el-tag size="small" :type="r.result === '成功' ? 'success' : r.state === 'running' ? 'primary' : 'warning'">
                  {{ r.result }}
                </el-tag>
              </div>
              <div class="batch-option__sub">
                {{ systemName(r) }} · {{ batchScope(r) }} · {{ batchMetrics(r) }}
              </div>
            </div>
          </el-option>
        </el-select>

        <el-card v-if="run" shadow="never" class="ov-card">
          <template #header>
            <div class="ov-card__head">
              <span class="ov-card__title">批次概览</span>
              <el-tag size="small" :type="run.result === '成功' ? 'success' : 'warning'" effect="dark">{{ run.result }}</el-tag>
            </div>
          </template>
          <div class="source-band">
            <div class="source-band__label">数据来源</div>
            <div class="source-band__main">{{ batchSourceTitle }}</div>
            <div class="source-band__sub">{{ batchTime(run) }} · {{ batchScope(run) }} · {{ run.startedAt }} — {{ run.finishedAt || '执行中' }} · {{ run.durationText || '未结束' }}</div>
          </div>
          <div class="stat-grid">
            <div class="stat-card stat-card--blue">
              <span class="stat-card__label">请求总量</span>
              <strong>{{ run.summary.totalRequests }}</strong>
              <span>成功 {{ run.summary.successRequests }} / 异常 {{ abnormalRequests }}</span>
            </div>
            <div class="stat-card stat-card--green">
              <span class="stat-card__label">通过率</span>
              <strong>{{ run.summary.passRate }}%</strong>
              <span>覆盖 {{ run.stepResults.length }} 个任务</span>
            </div>
            <div class="stat-card stat-card--orange">
              <span class="stat-card__label">响应延迟</span>
              <strong>{{ run.summary.avgResponseTime }} ms</strong>
              <span>P95 {{ run.summary.p95 }} ms</span>
            </div>
          </div>
          <div class="ov">
            <div class="ov__row"><span class="ov__k">任务创建者</span><span class="ov__v">{{ run.taskCreator || '—' }}</span></div>
            <div class="ov__row"><span class="ov__k">接口覆盖</span><span class="ov__v">{{ ifaceCount }} 个接口 · {{ run.stepResults.map(r => r.iface).join('、') }}</span></div>
          </div>
        </el-card>
        <div class="foot-hint">关键指标 / 接口结果表等硬数据将由系统从此批次自动组织</div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useRunBatchStore } from '@/stores/runBatch'
import { useSystemStore } from '@/stores/system'

const props = defineProps({ form: { type: Object, required: true } })
defineEmits(['next'])

const batchStore = useRunBatchStore()
const systemStore = useSystemStore()

const run = computed(() => batchStore.byId(props.form.runId))
const runs = computed(() => {
  const list = batchStore.ofSystem(systemStore.currentId)
  if (run.value && !list.some((item) => item.id === run.value.id)) return [run.value, ...list]
  return list
})
const sysName = computed(() => systemStore.systems.find((s) => s.id === run.value?.systemId)?.name || '—')
const ifaceCount = computed(() => new Set(run.value?.stepResults.map((r) => r.iface) || []).size)
const abnormalRequests = computed(() => run.value?.summary.abnormalRequests ?? ((run.value?.summary.failedRequests || 0) + (run.value?.summary.errorRequests || 0)))
const reportTitle = computed(() => run.value ? `${sysName.value} ${batchTime(run.value)} 联试报告` : '')
const batchSourceTitle = computed(() => run.value ? `${sysName.value} ${batchTime(run.value)} 执行批次` : '')

const pad = (value) => String(value || '').padStart(2, '0')
const formatDateTime = (text = '') => {
  const [rawDate = '', rawTime = ''] = String(text).trim().replace(/\//g, '-').split(' ')
  const [y = '', m = '', d = ''] = rawDate.split('-')
  const [hh = '', mm = ''] = rawTime.split(':')
  if (!y || !m || !d) return text || '未记录时间'
  return `${y}-${pad(m)}-${pad(d)} ${pad(hh || '00')}:${pad(mm || '00')}`
}
const batchTime = (batch) => formatDateTime(batch?.startedAt || batch?.time)
const systemName = (batch) => systemStore.systems.find((s) => s.id === batch?.systemId)?.name || '未知系统'
const moduleCount = (batch) => new Set((batch?.tasks || batch?.stepResults || []).map((item) => item.moduleId || item.moduleName).filter(Boolean)).size
const taskCount = (batch) => batch?.tasks?.length || batch?.stepResults?.length || 0
const batchScope = (batch) => `${moduleCount(batch)}模块/${taskCount(batch)}任务`
const batchAbnormal = (batch) => batch?.summary?.abnormalRequests ?? ((batch?.summary?.failedRequests || 0) + (batch?.summary?.errorRequests || 0))
const batchMetrics = (batch) => `${batch?.summary?.totalRequests || 0}请求 / ${batchAbnormal(batch)}异常`
const batchSelectLabel = (batch) => `${batchTime(batch)} · ${batch?.result || '未完成'} · ${batchScope(batch)}`

const onRunChange = () => {
  if (run.value) props.form.title = reportTitle.value
}
const ensureRun = () => {
  const list = runs.value
  if (!list.some((r) => r.id === props.form.runId)) {
    props.form.runId = list[0]?.id || null
    onRunChange()
  }
}
onMounted(ensureRun)
watch(() => systemStore.currentId, ensureRun)
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.step__scroll { flex: 1; min-height: 0; }
.step__inner { max-width: 820px; margin: 0 auto; padding: 4px 4px 48px; }
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
.blk__desc { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }

.ov-card { margin-top: 14px; }
.ov-card__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ov-card__title { font-weight: 600; }
.source-band {
  border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;
  background: linear-gradient(135deg, #eef6ff, #f5f8ff 48%, #fff7ed);
  border: 1px solid #dbeafe;
}
.source-band__label { font-size: 12px; color: #2563eb; font-weight: 700; margin-bottom: 4px; }
.source-band__main { font-size: 18px; font-weight: 700; color: #111827; }
.source-band__sub { margin-top: 4px; font-size: 12px; color: #64748b; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.stat-card {
  min-height: 98px; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;
  border: 1px solid transparent; color: #0f172a;
  strong { font-size: 22px; line-height: 1.1; }
  span:last-child { font-size: 12px; color: #64748b; }
}
.stat-card__label { font-size: 12px; font-weight: 700; }
.stat-card--blue { background: #eff6ff; border-color: #bfdbfe; .stat-card__label { color: #2563eb; } }
.stat-card--green { background: #ecfdf5; border-color: #bbf7d0; .stat-card__label { color: #059669; } }
.stat-card--orange { background: #fff7ed; border-color: #fed7aa; .stat-card__label { color: #ea580c; } }
.ov { display: flex; flex-direction: column; }
.ov__row {
  display: flex; align-items: center; gap: 12px; font-size: 13px; padding: 7px 0;
  & + & { border-top: 1px solid var(--el-border-color-lighter); }
}
.ov__k { color: var(--el-text-color-secondary); width: 72px; flex-shrink: 0; }
.ov__v { color: var(--el-text-color-primary); }

.foot-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 12px; }
@media (max-width: 980px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .step-head { flex-direction: column; }
  .step-actions { width: 100%; justify-content: flex-end; }
  .stat-grid { grid-template-columns: 1fr; }
}
</style>
