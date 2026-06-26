<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="blk__title"><el-icon><Coin /></el-icon> 选择执行批次（报告数据来源）</div>
        <el-select v-model="form.runId" placeholder="选择一轮联试执行批次" class="w-full" @change="onRunChange">
          <el-option v-for="r in runs" :key="r.id" :label="`${r.name} · ${r.startedAt}`" :value="r.id" />
        </el-select>

        <el-card v-if="run" shadow="never" class="ov-card">
          <template #header><span class="ov-card__title">批次概览</span></template>
          <div class="ov">
            <div class="ov__row"><span class="ov__k">批次名称</span><span class="ov__v">{{ run.name }}</span></div>
            <div class="ov__row"><span class="ov__k">被测系统</span><span class="ov__v">{{ sysName }}</span></div>
            <div class="ov__row"><span class="ov__k">执行时间</span><span class="ov__v">{{ run.startedAt }} — {{ run.finishedAt }}（{{ run.durationText }}）</span></div>
            <div class="ov__row"><span class="ov__k">请求总量</span><span class="ov__v">{{ run.summary.totalRequests }} （成功 {{ run.summary.successRequests }} · 失败 {{ run.summary.failedRequests }} · 错误 {{ run.summary.errorRequests }}）</span></div>
            <div class="ov__row"><span class="ov__k">响应延迟</span><span class="ov__v">平均 {{ run.summary.avgResponseTime }} ms · P95 {{ run.summary.p95 }} ms</span></div>
            <div class="ov__row"><span class="ov__k">通过率</span><span class="ov__v">{{ run.summary.passRate }}%</span></div>
            <div class="ov__row"><span class="ov__k">异常数</span><span class="ov__v">{{ run.exceptions.length }} 条</span></div>
            <div class="ov__row">
              <span class="ov__k">总体结论</span>
              <el-tag size="small" :type="run.result === '通过' ? 'success' : 'warning'" effect="light">{{ run.result }}</el-tag>
            </div>
          </div>
        </el-card>
        <div class="foot-hint">关键指标 / 接口结果表等硬数据将由系统从此批次自动组织</div>
      </div>
    </el-scrollbar>

    <div class="step__foot">
      <el-button type="primary" :icon="ArrowRight" :disabled="!form.runId" @click="$emit('next')">下一步</el-button>
    </div>
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
.step__inner { max-width: 720px; margin: 0 auto; padding: 4px 4px 48px; }
.w-full { width: 100%; }

.blk__title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
  font-size: 14px; font-weight: 600; color: var(--el-text-color-primary);
  .el-icon { color: var(--el-color-primary); }
}

.ov-card { margin-top: 14px; }
.ov-card__title { font-weight: 600; }
.ov { display: flex; flex-direction: column; }
.ov__row {
  display: flex; align-items: center; gap: 12px; font-size: 13px; padding: 7px 0;
  & + & { border-top: 1px solid var(--el-border-color-lighter); }
}
.ov__k { color: var(--el-text-color-secondary); width: 72px; flex-shrink: 0; }
.ov__v { color: var(--el-text-color-primary); }

.step__foot {
  position: absolute; right: 6px; bottom: 6px; z-index: 5;
  display: flex; align-items: center; gap: 12px;
}
.foot-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 12px; }
</style>
