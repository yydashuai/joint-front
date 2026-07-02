<template>
  <div class="monitor">
    <el-card shadow="never" class="exec-card">
      <template #header>
        <div class="card-head">
          <div>
            <span class="card-title">实时监控</span>
            <span class="card-sub">计数器对齐 ActiveTestResult</span>
          </div>
          <el-tag :type="statusType" effect="dark">{{ statusText }}</el-tag>
        </div>
      </template>

      <el-progress :percentage="store.progress" :stroke-width="10" :status="progressStatus" />
      <div class="metrics">
        <div v-for="metric in metrics" :key="metric.label" class="metric" :class="metric.cls">
          <span class="metric__value">{{ metric.value }}</span>
          <span class="metric__label">{{ metric.label }}</span>
        </div>
      </div>

      <div class="current-row">
        <span v-if="current">正在执行：<strong>{{ current.task.name }}</strong> → {{ current.iface?.name || '未命名接口' }}（第 {{ current.index + 1 }}/{{ store.planItems.length }} 项）</span>
        <span v-else>等待执行计划。</span>
      </div>
    </el-card>

    <el-card shadow="never" class="exec-card console-card">
      <template #header>
        <div class="console-tools">
          <span class="card-title">收发数据流</span>
          <div class="console-tools__right">
            <el-button link size="small" @click="store.clearLog()">清屏</el-button>
            <el-switch v-model="autoScroll" size="small" active-text="自动滚动" />
            <el-select v-model="filter" size="small" class="filter-select">
              <el-option label="全部" value="all" />
              <el-option label="仅异常" value="abnormal" />
            </el-select>
          </div>
        </div>
      </template>

      <div ref="consoleRef" class="stream">
        <button
          v-for="line in visibleLines"
          :key="line.traceId + line.dir"
          class="stream-line"
          :class="[`stream-line--${line.status}`, `stream-line--${line.dir}`]"
          @click="activeTrace = line"
        >
          <span class="mono">{{ line.time }}</span>
          <span class="dir">{{ line.dir === 'tx' ? '↑发' : '↓收' }}</span>
          <span class="iface">{{ line.iface }}</span>
          <span class="hex mono">{{ line.hex }}</span>
          <span class="result">{{ resultText(line) }}</span>
          <span class="mono">{{ line.duration ? `${line.duration}ms` : '' }}</span>
        </button>
        <div v-if="!visibleLines.length" class="stream-empty">点击开始后显示实时帧。</div>
      </div>
    </el-card>

    <MqProbePanel v-if="store.hasMqTasks" />

    <el-card shadow="never" class="exec-card exception-feed">
      <template #header>
        <div class="card-head">
          <span class="card-title">现场异常</span>
          <el-button link type="primary" size="small" :disabled="!store.exceptions.length" @click="router.push('/exception')">查看本次异常</el-button>
        </div>
      </template>
      <div v-if="!store.exceptions.length" class="muted">本轮暂无异常。</div>
      <div v-else class="feed-list">
        <div v-for="ex in store.exceptions.slice(0, 5)" :key="ex.id" class="feed-item">
          <el-tag :type="ex.level === '高' ? 'danger' : 'warning'" size="small">{{ ex.level }}</el-tag>
          <span>{{ ex.type }}</span>
          <small>{{ ex.iface }} · {{ ex.capturedTime || ex.time }}</small>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="traceVisible" title="单请求 Trace 下钻" width="680px">
      <template v-if="activeTrace">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="Trace ID">{{ activeTrace.traceId }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ resultText(activeTrace) }}</el-descriptions-item>
          <el-descriptions-item label="接口">{{ activeTrace.iface }}</el-descriptions-item>
          <el-descriptions-item label="时延">{{ activeTrace.duration || 0 }}ms</el-descriptions-item>
        </el-descriptions>
        <div class="trace-hex">
          <strong>请求帧</strong>
          <pre>{{ activeTrace.detail?.reqHex || activeTrace.hex }}</pre>
          <strong>响应帧</strong>
          <pre>{{ activeTrace.detail?.respHex || '等待响应' }}</pre>
        </div>
        <div class="span-list">
          <div v-for="span in activeTrace.detail?.spans || []" :key="span.op" class="span-item">
            <span>{{ span.op }}</span>
            <div class="span-bar"><i :style="{ width: Math.min(100, span.dur * 2) + '%' }" :class="`span-bar--${span.status}`" /></div>
            <small>{{ span.dur }}ms</small>
          </div>
        </div>
        <pre class="trace-log">{{ (activeTrace.detail?.logs || []).join('\n') }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExecutionStore } from '@/stores/execution'
import MqProbePanel from '@/components/execution/MqProbePanel.vue'

const store = useExecutionStore()
const router = useRouter()
const filter = ref('all')
const autoScroll = ref(true)
const consoleRef = ref()
const activeTrace = ref(null)
const traceVisible = computed({
  get: () => !!activeTrace.value,
  set: (value) => { if (!value) activeTrace.value = null },
})

const current = computed(() => store.currentItem)
const visibleLines = computed(() => store.logLines.filter((line) => {
  if (filter.value === 'abnormal') return line.status !== 'pass'
  if (filter.value === 'error') return line.status === 'error'
  return true
}))
const abnormalRequests = computed(() => store.counters.failedRequests + store.counters.errorRequests)

const metrics = computed(() => [
  { label: '进度', value: `${store.progress}%` },
  { label: '总请求', value: store.counters.totalRequests },
  { label: '成功', value: store.counters.successRequests, cls: 'metric--ok' },
  { label: '异常', value: abnormalRequests.value, cls: 'metric--bad' },
  { label: '平均时延', value: `${store.counters.avgResponseTime}ms` },
  { label: 'RPS', value: store.counters.rps },
  { label: '已用时', value: `${store.counters.executionTime}s` },
])

const statusText = computed(() => ({
  idle: '待执行',
  running: '执行中',
  paused: '已暂停',
  done: '已完成',
  stopped: '已停止',
}[store.status]))
const statusType = computed(() => ({
  running: 'primary',
  paused: 'warning',
  done: 'success',
  stopped: 'info',
  idle: 'info',
}[store.status]))
const progressStatus = computed(() => store.status === 'done' ? 'success' : undefined)

const resultText = (line) => ({
  pass: '✓成功',
  fail: '⚠异常',
  error: '⚠异常',
}[line.status] || line.note)

watch(() => store.logLines.length, () => {
  if (!autoScroll.value) return
  nextTick(() => {
    const el = consoleRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>

<style scoped lang="scss">
.monitor { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; }
.monitor > .exec-card:first-child, .console-card { grid-column: 1; }
.exception-feed { grid-column: 2; grid-row: 1 / -1; align-self: stretch; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head, .console-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.console-tools__right { display: flex; align-items: center; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.card-sub, .muted { color: var(--el-text-color-secondary); font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(7, minmax(86px, 1fr)); gap: 8px; margin-top: 12px; }
.metric {
  min-height: 62px;
  padding: 10px;
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
}
.metric__value { display: block; font: 700 20px Consolas, Monaco, monospace; }
.metric__label { color: var(--el-text-color-secondary); font-size: 12px; }
.metric--ok .metric__value { color: var(--el-color-success); }
.metric--bad .metric__value { color: var(--el-color-danger); }
.metric--warn .metric__value { color: var(--el-color-warning); }
.current-row { margin-top: 10px; color: var(--el-text-color-secondary); font-size: 13px; }
.filter-select { width: 108px; }
.stream {
  height: 390px;
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  background: #101923;
  color: #d7e1ea;
  font-size: 12px;
}
.stream-line {
  width: 100%;
  display: grid;
  grid-template-columns: 74px 38px 180px minmax(180px, 1fr) 62px 58px;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.stream-line:hover { background: rgba(255,255,255,.07); }
.stream-line--fail { color: #ffb3b3; background: rgba(245, 108, 108, .08); }
.stream-line--error { color: #ffd59a; background: rgba(230, 162, 60, .1); }
.dir { color: #8ed7ff; }
.iface, .hex { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result { font-weight: 600; }
.mono { font-family: Consolas, Monaco, monospace; }
.stream-empty { padding: 80px 0; text-align: center; color: rgba(215,225,234,.55); }
.feed-list { display: flex; flex-direction: column; gap: 8px; }
.feed-item { display: flex; flex-direction: column; gap: 4px; padding: 9px; border-radius: 7px; background: var(--el-fill-color-extra-light); border: 1px solid var(--el-border-color-lighter); }
.feed-item small { color: var(--el-text-color-secondary); }
.trace-hex { margin-top: 12px; display: grid; gap: 6px; }
.trace-hex pre, .trace-log {
  padding: 8px;
  border-radius: 6px;
  background: #101923;
  color: #d7e1ea;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.span-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.span-item { display: grid; grid-template-columns: 130px 1fr 54px; gap: 10px; align-items: center; }
.span-bar { height: 8px; border-radius: 999px; background: var(--el-fill-color); overflow: hidden; }
.span-bar i { display: block; height: 100%; background: var(--el-color-success); }
.span-bar--fail, .span-bar--error { background: var(--el-color-danger) !important; }
@media (max-width: 1180px) {
  .monitor { grid-template-columns: 1fr; }
  .exception-feed { grid-column: 1; grid-row: auto; }
  .metrics { grid-template-columns: repeat(4, minmax(86px, 1fr)); }
}
</style>
