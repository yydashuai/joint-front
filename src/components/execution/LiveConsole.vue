<template>
  <div class="monitor">
    <div v-if="store.directSendDraft" class="direct-source">
      <div class="direct-source__mark">历史选择</div>
      <div class="direct-source__copy">
        <strong>临时发送清单</strong>
        <span>{{ store.directSendDraft.total }} 条报文 · {{ store.directSendDraft.groups.length }} 个接口，不会生成正式数据集</span>
      </div>
      <el-tag size="small" :type="directDraftStatus.type" effect="plain">
        {{ directDraftStatus.text }}
      </el-tag>
    </div>
    <el-card shadow="never" class="exec-card console-card">
      <template #header>
        <div class="console-tools">
          <div class="console-tools__left">
            <span class="card-title">发送数据流</span>
            <StrategyBar
              v-if="!store.directSendDraft"
              class="header-strategy"
              :disabled="store.status === 'running'"
            />
          </div>
          <div class="console-tools__right">
            <el-tag :type="statusType" effect="dark">{{ statusText }}</el-tag>
            <span
              class="progress-compact"
              :title="`已发送 ${store.sentCount}，待发送 ${store.pendingCount}`"
            >
              <b>{{ store.sentCount }}</b>
              <span>/ {{ store.sentCount + store.pendingCount }}</span>
            </span>
            <el-tooltip v-if="store.status === 'running'" content="运行中不可修改，暂停后点击详情可修改报文" placement="top">
              <span class="lock-hint">运行中锁定</span>
            </el-tooltip>
            <el-switch v-model="autoScroll" size="small" active-text="自动滚动" />
          </div>
        </div>
      </template>

      <div class="stream-head">
        <span>时间</span>
        <span>接口名</span>
        <span>报文内容</span>
        <span class="stream-head__op">详情</span>
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
          }"
          @click="openDetail(entry)"
        >
          <span class="mono col-time">{{ entry.time || '—' }}</span>
          <span class="col-iface">
            {{ entry.iface }}
            <em v-if="entry.customId" class="custom-mark">自定义</em>
            <em v-if="entry.directDraftId" class="direct-mark">历史</em>
          </span>
          <span class="hex mono">{{ shortHex(entry) }}</span>
          <span class="col-op">
            <el-button link type="primary" size="small" @click.stop="openDetail(entry)">详情</el-button>
          </span>
        </button>
        <div v-if="!store.sendQueue.length" class="stream-empty">点击开始后加载全部测试数据，从上往下逐条发送。</div>
      </div>
    </el-card>

    <!-- 报文详情弹窗：查看完整报文，可修改或复制 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailTitle"
      width="640px"
      destroy-on-close
    >
      <template v-if="detailEntry">
        <div class="detail-meta">
          <el-tag size="small" type="info" effect="plain">{{ detailEntry.iface }}</el-tag>
          <el-tag v-if="detailEntry.datasetName" size="small" type="success" effect="plain">数据集：{{ detailEntry.datasetName }}</el-tag>
          <el-tag v-if="detailEntry.customId" size="small" type="primary" effect="plain">自定义接口</el-tag>
          <el-tag v-if="detailEntry.directDraftId" size="small" type="warning" effect="plain">来自历史选择</el-tag>
          <el-tag size="small" :type="detailEntry.variant === 'abnormal' ? 'danger' : 'success'" effect="dark">
            {{ detailEntry.variant === 'abnormal' ? '异常' : '正常' }}
          </el-tag>
          <span class="detail-meta__time">{{ detailEntry.time || '尚未发送' }}</span>
        </div>

        <div class="detail-block">
          <div class="detail-block__title">报文内容（完整）</div>
          <div class="hex-box mono">{{ detailHex }}</div>
        </div>

        <div v-if="detailPairs.length" class="detail-block">
          <div class="detail-block__title">报文数据</div>
          <div class="detail-kv">
            <div v-for="[k, v] in detailPairs" :key="k" class="detail-kv__row">
              <span class="detail-kv__key">{{ k }}</span>
              <span class="mono detail-kv__val">{{ v }}</span>
            </div>
          </div>
        </div>

        <div v-if="detailEntry.variant === 'abnormal' && detailEntry.issues?.length" class="judge-issues">
          <div v-for="issue in detailEntry.issues" :key="issue.name" class="judge-issues__item">
            <span class="judge-issues__field">{{ issue.name }}</span>{{ issue.message }}
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="copyDetailHex">复制报文</el-button>
        <el-button
          type="primary"
          :disabled="store.status === 'running' || ['done', 'stopped'].includes(store.status)"
          @click="openEditFromDetail"
        >修改报文</el-button>
      </template>
    </el-dialog>

    <!-- 修改报文：暂停后矩阵形式编辑字段值 -->
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
          <el-tag v-if="editEntry.directDraftId" size="small" type="warning" effect="plain">来自历史选择</el-tag>
          <span class="edit-meta__judge">
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

        <!-- 自定义接口：直接编辑报文体 hex -->
        <div v-if="editEntry.customId" class="hex-edit">
          <div class="detail-block__title">报文体（hex，可为加密数据）</div>
          <el-input v-model="editHex" type="textarea" :rows="5" class="mono" placeholder="如：EB 90 01 02 03 04 05 06" />
        </div>
        <div v-else-if="!editEntry.fields.length" class="edit-empty">
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
              <!-- 枚举 → Select（可输入枚举外的值以构造异常数据） -->
              <el-select
                v-if="isFieldEnum(field)"
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
        <el-button
          v-if="editEntry?.datasetId"
          type="warning"
          plain
          :icon="Star"
          @click="addToExcellent"
        >加入优秀历史数据库</el-button>
        <el-button type="primary" @click="saveEdit">
          {{ editEntry?.status === 'sent' ? '保存并追加到队尾' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Star } from '@element-plus/icons-vue'
import { useExecutionStore, judgeValues } from '@/stores/execution'
import { useTestDataStore } from '@/stores/testData'
import StrategyBar from '@/components/execution/StrategyBar.vue'

const store = useExecutionStore()
const tdStore = useTestDataStore()
const autoScroll = ref(true)
const consoleRef = ref()

const firstPendingIndex = computed(() => store.sendQueue.findIndex((e) => e.status === 'pending'))
const directDraftStatus = computed(() => ({
  prepared: { text: '待确认发送', type: 'warning' },
  running: { text: '发送中', type: 'primary' },
  sent: { text: '已发送', type: 'success' },
  stopped: { text: '已终止', type: 'info' },
}[store.directSendDraft?.status] || { text: '待确认发送', type: 'warning' }))

const statusText = computed(() => ({
  idle: '待执行',
  running: '执行中',
  paused: '已暂停',
  done: '已完成',
  stopped: '已完成',
}[store.status]))
const statusType = computed(() => ({
  running: 'primary',
  paused: 'warning',
  done: 'success',
  stopped: 'success',
  idle: 'info',
}[store.status]))

/* ---- 报文内容列：显示前 20 个 hex 字符，超出省略 ---- */
const shortHex = (entry) => {
  let text = entry.hex || previewValues(entry)
  if (text.length > 20) return `${text.slice(0, 20)}…`
  return text
}

/* ---- 待发送行的数据预览（未发送时报文列显示字段值摘要） ---- */
const previewValues = (entry) => {
  const pairs = Object.entries(entry.values || {}).filter(([, v]) => v !== '' && v != null)
  if (!pairs.length) return '待发送数据'
  return pairs.slice(0, 4).map(([k, v]) => `${k}=${v}`).join('  ') + (pairs.length > 4 ? ' …' : '')
}

/* ---- 报文详情弹窗 ---- */
const detailVisible = ref(false)
const detailEntry = ref(null)
const detailTitle = computed(() => (detailEntry.value ? `报文详情 · ${detailEntry.value.label}` : '报文详情'))
const detailHex = computed(() => detailEntry.value?.hex || previewValues(detailEntry.value || {}) || '—')
const detailPairs = computed(() => Object.entries(detailEntry.value?.values || {}).filter(([, v]) => v !== '' && v != null))

const openDetail = (entry) => {
  detailEntry.value = entry
  detailVisible.value = true
}

const copyDetailHex = async () => {
  const text = detailHex.value
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('报文已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

const openEditFromDetail = () => {
  if (store.status === 'running' || ['done', 'stopped'].includes(store.status)) return
  detailVisible.value = false
  editEntry.value = detailEntry.value
  if (editEntry.value?.customId) {
    editHex.value = editEntry.value.hex || ''
  } else {
    // 回填该条数据当前的完整字段值；个别缺失字段按约束兜底
    const values = JSON.parse(JSON.stringify(editEntry.value.values || {}))
    for (const f of editEntry.value.fields || []) {
      if (values[f.name] !== undefined && values[f.name] !== null && values[f.name] !== '') continue
      const c = f.constraint
      if (c?.mode === 'fixed') values[f.name] = c.value
      else if (c?.mode === 'enum' && c.entries?.length) values[f.name] = c.entries[0]?.value ?? c.entries[0]
      else if (c?.mode === 'range') values[f.name] = Number.isFinite(c.min) ? c.min : 0
      else values[f.name] = values[f.name] ?? ''
    }
    editValues.value = values
  }
  editVisible.value = true
}

/* ---- 修改测试数据：运行中锁定，暂停后可修改（已发送数据修改后追加到队尾重发） ---- */
const editVisible = ref(false)
const editEntry = ref(null)
const editValues = ref({})
const editHex = ref('')

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

const saveEdit = () => {
  if (!editEntry.value) { editVisible.value = false; return }
  if (editEntry.value.customId) {
    // 自定义接口：更新报文体 hex 后直接重发
    const clean = (editHex.value || '').trim()
    const result = store.saveQueueEdit(editEntry.value.id, { 报文体: clean })
    editEntry.value.hex = clean
    if (result === 'appended') ElMessage.success('已修改，新数据已追加到队尾等待发送')
    else if (result === 'updated') ElMessage.success('已保存修改，继续发送时按新值发送')
    else ElMessage.info('数据未修改，保持不变')
    editVisible.value = false
    return
  }
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

/* 执行暂停时：将当前测试数据加入对应数据集的「优秀历史数据库」 */
const addToExcellent = () => {
  const entry = editEntry.value
  if (!entry?.datasetId) {
    ElMessage.warning('该数据未关联到数据集，无法加入优秀历史')
    return
  }
  tdStore.addHistoryRows(entry.datasetId, [{
    label: entry.label,
    values: JSON.parse(JSON.stringify(editValues.value)),
    source: '执行采集',
    remark: `执行暂停时手动加入（${entry.iface}）`,
    abnormal: entry.variant === 'abnormal',
    excellent: true,
  }])
  ElMessage.success(`已将「${entry.label}」加入优秀历史数据库`)
}

/* ---- 字段控件类型（参考数据集矩阵） ---- */
const isFieldFixed = (f) => f.constraint?.mode === 'fixed'
const isFieldEnum = (f) => f.constraint?.mode === 'enum' && f.constraint.entries?.length
const isFieldNumeric = (f) => f.constraint?.mode === 'range'

const fieldColWidth = (f) => {
  if (isFieldFixed(f)) return 90
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
.monitor { display: flex; flex: 1 0 360px; min-height: 360px; overflow: hidden; flex-direction: column; gap: 14px; }
.direct-source {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: linear-gradient(90deg, var(--el-color-warning-light-9), var(--el-bg-color));
}
.direct-source__mark {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 5px;
  background: var(--el-color-warning);
  color: #fff;
  font-size: 12px;
  font-weight: 650;
}
.direct-source__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.direct-source__copy strong { color: var(--el-text-color-primary); font-size: 13px; }
.direct-source__copy span { overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head, .console-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.console-tools__left { display: flex; align-items: center; gap: 18px; min-width: 0; }
.console-tools__right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.header-strategy { min-width: 0; }
.console-card { display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
.console-card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
.card-sub, .muted { color: var(--el-text-color-secondary); font-size: 12px; }
.lock-hint { font-size: 12px; color: var(--el-color-warning); cursor: help; }
.edit-hint { font-size: 12px; color: var(--el-color-primary); }
.progress-compact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border-left: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.progress-compact b { color: var(--el-color-success); font: 700 13px Consolas, Monaco, monospace; }
.progress-compact span { color: var(--el-text-color-regular); font: 700 13px Consolas, Monaco, monospace; }

/* ---- 发送数据流：时间 / 接口名 / 报文 / 详情 ---- */
$stream-cols: 92px 150px minmax(160px, 1fr) 60px;
.stream-head {
  display: grid;
  grid-template-columns: $stream-cols;
  gap: 8px;
  padding: 6px 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.stream-head__op { text-align: center; }
.stream {
  flex: 1;
  min-height: 0;
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
.stream-line--pending { color: rgba(215,225,234,.45); }
.stream-line--current { background: rgba(64,158,255,.14); color: #d7e1ea; }
/* 异常行：整行红色背景 + 浅色文字 */
.stream-line--abnormal {
  background-color: rgba(245, 108, 108, 0.08) !important;
  border-left: 3px solid var(--el-color-danger);
  > span { color: var(--el-color-danger-light-3); }
}
.custom-mark {
  font-style: normal;
  font-size: 11px;
  color: #b37feb;
  border: 1px solid rgba(179, 127, 235, .5);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.direct-mark {
  margin-left: 4px;
  padding: 0 4px;
  border: 1px solid rgba(230, 162, 60, .55);
  border-radius: 3px;
  color: #e6a23c;
  font-size: 11px;
  font-style: normal;
}
.col-time, .col-iface, .hex { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-op { text-align: center; }
.mono { font-family: Consolas, Monaco, monospace; }
.stream-empty { padding: 80px 0; text-align: center; color: rgba(215,225,234,.55); }

/* ---- 报文详情弹窗 ---- */
.detail-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.detail-meta__time { font-size: 12px; color: var(--el-text-color-secondary); margin-left: auto; }
.detail-block { margin-bottom: 12px; }
.detail-block__title { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--el-text-color-regular); }
.hex-box {
  padding: 10px 12px;
  border-radius: 6px;
  background: #101923;
  color: #d7e1ea;
  font-size: 12px;
  line-height: 1.7;
  word-break: break-all;
  user-select: text;
}
.detail-kv { display: flex; flex-direction: column; gap: 4px; }
.detail-kv__row { display: flex; align-items: baseline; gap: 12px; font-size: 13px; }
.detail-kv__key { color: var(--el-text-color-secondary); min-width: 110px; flex-shrink: 0; }
.detail-kv__val { color: var(--el-text-color-primary); word-break: break-all; }

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
.hex-edit { padding: 4px 0; }
.hex-edit :deep(.el-textarea__inner) { font-family: Consolas, Monaco, monospace; }
.field-col-header {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  cursor: help;
  &__name { font-size: 13px; font-weight: 600; }
  &__type { font-size: 11px; color: var(--el-text-color-placeholder); font-family: Consolas, Monaco, monospace; }
}

@media (max-width: 1180px) {
  .console-tools { align-items: flex-start; }
}
</style>
