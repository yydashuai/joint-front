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
        <el-select v-model="form.runId" placeholder="选择一轮联试执行批次" class="w-full" @change="onRunChange">
          <el-option v-for="r in runs" :key="r.id" :label="`${r.name} · ${r.startedAt}`" :value="r.id" />
        </el-select>

        <el-card v-if="run" shadow="never" class="ov-card">
          <template #header>
            <div class="ov-card__head">
              <span class="ov-card__title">批次概览</span>
              <el-tag size="small" :type="run.result === '通过' ? 'success' : 'warning'" effect="dark">{{ run.result }}</el-tag>
            </div>
          </template>
          <div class="source-band">
            <div class="source-band__label">数据来源</div>
            <div class="source-band__main">{{ run.name }}</div>
            <div class="source-band__sub">{{ sysName }} · {{ run.startedAt }} — {{ run.finishedAt }} · {{ run.durationText }}</div>
          </div>
          <div class="stat-grid">
            <div class="stat-card stat-card--blue">
              <span class="stat-card__label">请求总量</span>
              <strong>{{ run.summary.totalRequests }}</strong>
              <span>成功 {{ run.summary.successRequests }} / 失败 {{ run.summary.failedRequests }}</span>
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
            <div class="stat-card stat-card--red">
              <span class="stat-card__label">异常记录</span>
              <strong>{{ run.exceptions.length }} 条</strong>
              <span>错误 {{ run.summary.errorRequests }} 次</span>
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
import { useReportStore } from '@/stores/report'
import { useSystemStore } from '@/stores/system'

const props = defineProps({ form: { type: Object, required: true } })
defineEmits(['next'])

const store = useReportStore()
const systemStore = useSystemStore()

const runs = computed(() => store.runsOfSystem(systemStore.currentId))
const run = computed(() => store.runs.find((r) => r.id === props.form.runId) || null)
const sysName = computed(() => systemStore.systems.find((s) => s.id === run.value?.systemId)?.name || '—')
const ifaceCount = computed(() => new Set(run.value?.stepResults.map((r) => r.iface) || []).size)

const onRunChange = () => {
  if (run.value) props.form.title = `${run.value.name}报告`
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
.stat-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px;
}
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
.stat-card--red { background: #fef2f2; border-color: #fecaca; .stat-card__label { color: #dc2626; } }
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
