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
        <span v-else>等待编排计划。</span>
      </div>
    </el-card>

    <el-card shadow="never" class="exec-card console-card">
      <template #header>
        <div class="console-tools">
          <span class="card-title">发送数据流</span>
          <div class="console-tools__right">
            <el-tag size="small" type="success" effect="plain">已发送 {{ store.sentCount }}</el-tag>
            <el-tag size="small" type="info" effect="plain">待发送 {{ store.pendingCount }}</el-tag>
            <el-tooltip v-if="store.status === 'running'" content="运行中不可修改，暂停后点击任一条数据即可编辑字段" placement="top">
              <span class="lock-hint">运行中锁定</span>
            </el-tooltip>
            <span v-else-if="store.status === 'paused'" class="edit-hint">已暂停，点击任一条数据可修改（已发送数据修改后追加到队尾重发）</span>
            <el-switch v-model="autoScroll" size="small" active-text="自动滚动" />
          </div>
        </div>
      </template>

      <div class="stream-head">
        <span>#</span>
        <span>时间</span>
        <span>测试数据</span>
        <span>接口</span>
        <span>报文</span>
        <span class="stream-head__status">状态</span>
      </div>
      <div ref="consoleRef" class="stream">
        <button
          v-for="(entry, idx) in store.sendQueue"
          :key="entry.id"
          class="stream-line"
          :class="{
            'stream-line--sent': entry.status === 'sent',
            'stream-line--pending': entry.status === 'pending',
            'stream-line--current': entry.status === 'pending' && idx === firstPendingIndex,
            'stream-line--abnormal': entry.variant === 'abnormal',
            'stream-line--locked': store.status === 'running',
          }"
          @click="onRowClick(entry)"
        >
          <span class="mono col-idx">{{ idx + 1 }}</span>
          <span class="mono col-time">{{ entry.time || '—' }}</span>
          <span class="col-label">
            {{ entry.label }}
            <em v-if="entry.variant === 'abnormal'" class="abn-mark">异常</em>
          </span>
          <span class="col-iface">{{ entry.iface }}</span>
          <span class="hex mono">{{ entry.hex || previewValues(entry) }}</span>
          <span class="col-status" :class="entry.status === 'sent' ? 'col-status--sent' : 'col-status--pending'">
            {{ entry.status === 'sent' ? '已发送' : '待发送' }}
          </span>
        </button>
        <div v-if="!store.sendQueue.length" class="stream-empty">点击开始后加载全部测试数据，从上往下逐条发送。</div>
      </div>
    </el-card>

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

    <!-- 暂停后点击测试数据：矩阵形式编辑字段值 -->
    <el-dialog
      v-model="editVisible"
      :title="editTitle"
      width="760px"
      destroy-on-close
    >
      <template v-if="editEntry">
        <div class="edit-meta">
          <el-tag size="small" type="info" effect="plain">{{ editEntry.iface }}</el-tag>
          <el-tag v-if="editEntry.datasetName" size="small" type="success" effect="plain">数据集：{{ editEntry.datasetName }}</el-tag>
          <el-tag v-if="editEntry.status === 'sent'" size="small" type="warning" effect="plain">已发送 · 修改后将追加到队尾重发</el-tag>
          <span class="edit-meta__judge">
            数据性质（按字段定义自动判定）：
            <el-tag size="small" :type="liveJudge.abnormal ? 'danger' : 'success'" effect="dark">
              {{ liveJudge.abnormal ? '异常' : '正常' }}
            </el-tag>
          </span>
        </div>

        <div v-if="liveJudge.abnormal" class="judge-issues">
          <div v-for="issue in liveJudge.issues" :key="issue.name" class="judge-issues__item">
            <span class="judge-issues__field">{{ issue.name }}</span>{{ issue.message }}
          </div>
        </div>

        <div v-if="!editEntry.fields.length" class="edit-empty">
          <el-empty description="该接口未引用任何字段定义，暂无可编辑字段" :image-size="60" />
        </div>
        <el-table v-else :data="[editValues]" size="small" border class="edit-matrix" max-height="360">
          <el-table-column label="行标签" width="130" fixed="left">
            <template #default>
              <span class="mono">{{ editEntry.label }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-for="field in editEntry.fields"
            :key="field.id || field.name"
            :min-width="fieldColWidth(field)"
          >
            <template #header>
              <el-tooltip placement="top">
                <template #content>
                  <div v-if="field.remark">备注：{{ field.remark }}</div>
                  <div v-if="field.desc">说明：{{ field.desc }}</div>
                  <div v-if="!field.remark && !field.desc">暂无备注</div>
                </template>
                <div class="field-col-header">
                  <div class="field-col-header__name">{{ field.name }}</div>
                  <div class="field-col-header__type">{{ fieldHint(field) }}</div>
                </div>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <!-- 位字段 → Switch -->
              <el-switch
                v-if="isFieldBit(field)"
                :model-value="!!row[field.name]"
                size="small"
                @change="(v) => { row[field.name] = v ? 1 : 0 }"
              />
              <!-- 枚举 → Select（可输入枚举外的值以构造异常数据） -->
              <el-select
                v-else-if="isFieldEnum(field)"
                v-model="row[field.name]"
                size="small"
                filterable
                allow-create
                default-first-option
                style="width: 100%;"
                :class="{ 'cell--abnormal': isIssueField(field.name) }"
              >
                <el-option
                  v-for="entry in field.constraint.entries"
                  :key="entry.value ?? entry"
                  :label="entry.label || String(entry)"
                  :value="entry.value ?? entry"
                />
              </el-select>
              <!-- 数值 → InputNumber（不限制范围，越界值自动判定为异常） -->
              <el-input-number
                v-else-if="isFieldNumeric(field)"
                v-model="row[field.name]"
                size="small"
                controls-position="right"
                style="width: 100%;"
                :class="{ 'cell--abnormal': isIssueField(field.name) }"
              />
              <!-- 固定值/文本 → Input（改动固定值即自动判定为异常） -->
              <el-input
                v-else
                v-model="row[field.name]"
                size="small"
                :class="{ 'cell--abnormal': isIssueField(field.name) }"
              />
            </template>
          </el-table-column>
        </el-table>
      </template>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">
          {{ editEntry?.status === 'sent' ? '保存并追加到队尾' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useExecutionStore, judgeValues } from '@/stores/execution'

const store = useExecutionStore()
const router = useRouter()
const autoScroll = ref(true)
const consoleRef = ref()

const current = computed(() => store.currentItem)
const firstPendingIndex = computed(() => store.sendQueue.findIndex((e) => e.status === 'pending'))
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

/* ---- 待发送行的数据预览（未发送时报文列显示字段值摘要） ---- */
const previewValues = (entry) => {
  const pairs = Object.entries(entry.values || {}).filter(([, v]) => v !== '' && v != null)
  if (!pairs.length) return '待发送数据'
  return pairs.slice(0, 4).map(([k, v]) => `${k}=${v}`).join('  ') + (pairs.length > 4 ? ' …' : '')
}

/* ---- 点击测试数据：运行中锁定，暂停后可修改（已发送数据修改后追加到队尾重发） ---- */
const editVisible = ref(false)
const editEntry = ref(null)
const editValues = ref({})

const editTitle = computed(() => {
  if (!editEntry.value) return ''
  return editEntry.value.status === 'sent'
    ? `已发送数据 · ${editEntry.value.label}`
    : `修改测试数据 · ${editEntry.value.label}`
})

/* 弹窗内实时自动判定：按字段定义判断当前编辑值是正常还是异常 */
const liveJudge = computed(() => {
  if (!editEntry.value) return { abnormal: false, issues: [] }
  return judgeValues(editEntry.value.fields, editValues.value)
})
const isIssueField = (name) => liveJudge.value.issues.some((i) => i.name === name)

const onRowClick = (entry) => {
  if (store.status === 'running') return
  editEntry.value = entry
  // 回填该条数据当前的完整字段值；个别缺失字段按约束兜底，保证用户看到的是实际发送的数据
  const values = JSON.parse(JSON.stringify(entry.values || {}))
  for (const f of entry.fields || []) {
    if (values[f.name] !== undefined && values[f.name] !== null && values[f.name] !== '') continue
    const c = f.constraint
    if (c?.mode === 'fixed') values[f.name] = c.value
    else if (c?.mode === 'enum' && c.entries?.length) values[f.name] = c.entries[0]?.value ?? c.entries[0]
    else if (c?.mode === 'range') values[f.name] = Number.isFinite(c.min) ? c.min : 0
    else values[f.name] = values[f.name] ?? ''
  }
  editValues.value = values
  editVisible.value = true
}

const saveEdit = () => {
  if (!editEntry.value) { editVisible.value = false; return }
  const result = store.saveQueueEdit(editEntry.value.id, editValues.value)
  if (result === 'appended') {
    ElMessage.success('已修改，新数据已追加到队尾等待发送')
  } else if (result === 'updated') {
    ElMessage.success('已保存修改，继续发送时按新值发送')
  } else {
    ElMessage.info('数据未修改，保持不变')
  }
  editVisible.value = false
}

/* ---- 字段控件类型（参考数据集矩阵） ---- */
const isFieldFixed = (f) => f.constraint?.mode === 'fixed'
const isFieldBit = (f) => f.kind === 'bit' && f.constraint?.mode === 'range' && f.constraint.min === 0 && f.constraint.max === 1
const isFieldEnum = (f) => f.constraint?.mode === 'enum' && f.constraint.entries?.length
const isFieldNumeric = (f) => f.constraint?.mode === 'range' && !isFieldBit(f)

const fieldColWidth = (f) => {
  if (isFieldFixed(f)) return 90
  if (isFieldBit(f)) return 90
  if (isFieldEnum(f)) return 140
  return isFieldNumeric(f) ? 150 : 130
}

const fieldHint = (f) => {
  if (f.constraint?.mode === 'fixed') return `固定 ${f.constraint.value}`
  if (f.constraint?.mode === 'enum') return (f.constraint.entries || []).map((e) => e.label || e).join('/')
  if (f.constraint?.mode === 'range') return `${f.constraint.min}~${f.constraint.max}`
  return f.type || ''
}

/* ---- 自动滚动：跟随当前发送位置 ---- */
watch(() => store.sentCount, () => {
  if (!autoScroll.value) return
  nextTick(() => {
    const el = consoleRef.value
    if (!el) return
    const currentLine = el.querySelector('.stream-line--current') || el.querySelector('.stream-line--sent:last-of-type')
    if (currentLine) currentLine.scrollIntoView({ block: 'nearest' })
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
.lock-hint { font-size: 12px; color: var(--el-color-warning); cursor: help; }
.edit-hint { font-size: 12px; color: var(--el-color-primary); }
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
.current-row { margin-top: 10px; color: var(--el-text-color-secondary); font-size: 13px; }

/* ---- 发送数据流 ---- */
$stream-cols: 40px 76px 170px 150px minmax(160px, 1fr) 64px;
.stream-head {
  display: grid;
  grid-template-columns: $stream-cols;
  gap: 8px;
  padding: 6px 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.stream-head__status { text-align: center; }
.stream {
  height: 370px;
  overflow: auto;
  padding: 8px;
  border-radius: 0 0 8px 8px;
  background: #101923;
  color: #d7e1ea;
  font-size: 12px;
}
.stream-line {
  width: 100%;
  display: grid;
  grid-template-columns: $stream-cols;
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
.stream-line--locked { cursor: default; }
.stream-line--locked:hover { background: transparent; }
.stream-line--pending { color: rgba(215,225,234,.45); }
.stream-line--current { background: rgba(64,158,255,.14); color: #d7e1ea; }
.stream-line--abnormal .col-label { color: #ffb3b3; }
.abn-mark {
  font-style: normal;
  font-size: 11px;
  color: #ffb3b3;
  border: 1px solid rgba(245,108,108,.5);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.col-idx { color: rgba(215,225,234,.5); }
.col-label, .col-iface, .hex { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-status { text-align: center; font-weight: 600; }
.col-status--sent { color: #67c23a; }
.col-status--pending { color: rgba(215,225,234,.45); }
.mono { font-family: Consolas, Monaco, monospace; }
.stream-empty { padding: 80px 0; text-align: center; color: rgba(215,225,234,.55); }

/* ---- 现场异常 ---- */
.feed-list { display: flex; flex-direction: column; gap: 8px; }
.feed-item { display: flex; flex-direction: column; gap: 4px; padding: 9px; border-radius: 7px; background: var(--el-fill-color-extra-light); border: 1px solid var(--el-border-color-lighter); }
.feed-item small { color: var(--el-text-color-secondary); }

/* ---- 编辑弹窗 ---- */
.edit-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.edit-meta__judge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; margin-left: auto; color: var(--el-text-color-secondary); }
.judge-issues {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  font-size: 12px;
  color: var(--el-color-danger);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.judge-issues__field { font-weight: 600; margin-right: 6px; font-family: Consolas, Monaco, monospace; }
.cell--abnormal {
  :deep(.el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
}
.edit-empty { padding: 20px 0; }
.edit-matrix { width: 100%; }
.field-col-header {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  cursor: help;
  &__name { font-size: 13px; font-weight: 600; }
  &__type { font-size: 11px; color: var(--el-text-color-placeholder); font-family: Consolas, Monaco, monospace; }
}

@media (max-width: 1180px) {
  .monitor { grid-template-columns: 1fr; }
  .exception-feed { grid-column: 1; grid-row: auto; }
  .metrics { grid-template-columns: repeat(4, minmax(86px, 1fr)); }
}
</style>
