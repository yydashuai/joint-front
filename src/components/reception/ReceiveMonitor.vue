<template>
  <div class="rmonitor">
    <!-- 接收数据流 -->
    <el-card shadow="never" class="exec-card stream-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">接收数据流</span>
          <div class="stream-summary">
            <el-tag :type="statusType" effect="dark">{{ statusText }}</el-tag>
            <span v-for="metric in streamMetrics" :key="metric.label" class="stream-stat" :class="metric.cls">
              <b>{{ metric.value }}</b>{{ metric.label }}
            </span>
          </div>
        </div>
      </template>
      <div class="stream-tools">
        <div class="stream-tools__filters">
          <el-check-tag
            v-for="f in statusFilters"
            :key="f.value"
            :checked="statusFilter === f.value"
            class="filter-tag"
            :class="`filter-tag--${f.value}`"
            @change="() => setStatusFilter(f.value)"
          >
            {{ f.label }}（{{ f.count }}）
          </el-check-tag>
          <el-select v-model="ifaceFilter" placeholder="按接口过滤" size="small" clearable style="width: 180px;">
            <el-option
              v-for="item in store.planItems"
              :key="item.iface.id"
              :label="item.iface.name"
              :value="item.iface.id"
            />
          </el-select>
        </div>
        <div class="stream-tools__right">
          <el-button
            type="success"
            plain
            size="small"
            :icon="FolderAdd"
            :disabled="!selectedIds.length"
            @click="openSaveDialog(selectedIds)"
          >
            保存选中为数据集（{{ selectedIds.length }}）
          </el-button>
          <el-button v-if="selectedIds.length" size="small" text @click="clearSelection">取消勾选</el-button>
          <el-switch v-model="autoScroll" size="small" active-text="自动滚动" />
        </div>
      </div>

      <div class="stream-head">
        <span class="stream-head__chk">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="indeterminate"
            :disabled="!allRecvFilteredIds.length"
            :title="allSelected ? '取消全选' : '全选当前接收数据'"
            @change="toggleSelectAll"
          />
        </span>
        <span>接口名</span>
        <span>IP</span>
        <span>协议</span>
        <span>消息号</span>
        <span>时间</span>
        <span>报文内容</span>
        <span class="stream-head__op">详情</span>
      </div>
      <div class="stream-wrap">
        <div ref="streamRef" class="stream" @scroll="onStreamScroll">
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="stream-line"
            :class="lineClass(entry)"
            @click="openDetail(entry)"
          >
            <span class="col-chk" @click.stop>
              <input
                v-if="entry.kind === 'recv'"
                type="checkbox"
                :checked="selectedIds.includes(entry.id)"
                @change="toggleSelect(entry.id)"
              />
            </span>
            <span class="col-iface">
              {{ entry.iface }}
              <em v-if="entry.kind === 'forward'" class="fw-mark">转发</em>
              <em v-if="entry.sentTest" class="tx-mark">发送</em>
            </span>
            <span class="mono col-ip">{{ entry.ip || '—' }}</span>
            <span class="mono col-protocol">{{ entry.transport || '—' }}</span>
            <span class="mono col-msgid">{{ entry.messageId || '—' }}</span>
            <span class="mono col-time">{{ entry.time }}</span>
            <span class="hex mono">{{ shortHex(entry) }}</span>
            <span class="col-op">
              <el-button link type="primary" size="small" @click.stop="openDetail(entry)">详情</el-button>
            </span>
          </div>
          <div v-if="!filteredEntries.length" class="stream-empty">
            {{ store.recvQueue.length ? '当前过滤条件下没有报文' : '开始监听后，接收数据流将在此实时滚动。' }}
          </div>
        </div>
        <button
          v-if="selectionAnchorId && selectionRangeVisible"
          class="select-to-here"
          :class="`select-to-here--${selectionDirection}`"
          type="button"
          @click="selectToViewportEdge"
        >
          {{ selectionDirection === 'up' ? '↓' : '↑' }} 选择到这里
        </button>
      </div>
    </el-card>

    <!-- ===== 详情抽屉 ===== -->
    <ReceiveDetailDrawer
      v-model="detailVisible"
      :entry-id="detailEntryId"
      @save-entry="(id) => openSaveDialog([id])"
    />

    <!-- ===== 保存为数据集 ===== -->
    <el-dialog v-model="saveVisible" title="保存接收报文为数据集" width="520px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        class="save-tip"
        :title="`将 ${saveIds.length} 条接收报文写入测试数据（历史数据），来源标注为「接收报文」`"
        description="无法解析的报文将以原始 hex 样本保存，仅供留档分析，不可用于发送编排。"
      />
      <el-form label-width="90px">
        <el-form-item label="保存方式">
          <el-radio-group v-model="saveMode">
            <el-radio value="exist">写入已有数据集</el-radio>
            <el-radio value="new">新建数据集</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="saveMode === 'exist'" label="目标数据集">
          <el-select v-model="saveDatasetId" placeholder="选择数据集" style="width: 100%;">
            <el-option v-for="ds in dataStore.datasets" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="数据集名称">
          <el-input v-model="saveNewName" placeholder="如：XX接口 接收样本 0730" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderAdd } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'
import { useTestDataStore } from '@/stores/testData'
import ReceiveDetailDrawer from '@/components/reception/ReceiveDetailDrawer.vue'

const store = useReceptionStore()
const dataStore = useTestDataStore()

const autoScroll = ref(true)
const streamRef = ref()

/* ===== 状态 ===== */
const statusText = computed(() => ({
  idle: '待监听',
  listening: '监听中',
  paused: '已暂停',
  stopped: '已完成',
  done: '已完成',
}[store.status]))
const statusType = computed(() => ({
  listening: 'primary',
  paused: 'warning',
  stopped: 'success',
  done: 'success',
  idle: 'info',
}[store.status]))
const streamMetrics = computed(() => [
  { label: '已接收', value: store.totalCount },
  { label: '正常', value: store.okCount, cls: 'metric--ok' },
  { label: '异常', value: store.errorCount, cls: 'metric--bad' },
  { label: '未解析', value: store.unparsedCount, cls: 'metric--warn' },
  { label: '条/秒', value: store.recvRate },
  { label: '已监听', value: `${store.elapsedSeconds}s` },
])

/* ===== 过滤 ===== */
const statusFilter = ref('all')
const tagFilter = ref('')
const ifaceFilter = ref(null)

const statusFilters = computed(() => [
  { value: 'all', label: '全部', count: store.recvQueue.length },
  { value: 'ok', label: '正常', count: store.okCount },
  { value: 'error', label: '异常', count: store.errorCount },
  { value: 'unparsed', label: '无法解析', count: store.unparsedCount },
  { value: 'forward', label: '已转发', count: store.forwardCount },
])

const setStatusFilter = (v) => {
  statusFilter.value = v
  if (v !== 'error') tagFilter.value = ''
}

const filteredEntries = computed(() => store.recvQueue.filter((e) => {
  if (statusFilter.value === 'forward') { if (e.kind !== 'forward') return false }
  else if (statusFilter.value !== 'all') {
    if (e.kind !== 'recv' || e.verdict.status !== statusFilter.value) return false
  }
  if (tagFilter.value && e.verdict.tag !== tagFilter.value) return false
  if (ifaceFilter.value && String(e.interfaceId) !== String(ifaceFilter.value)) return false
  return true
}))

const lineClass = (entry) => ({
  'stream-line--error': entry.verdict.status === 'error',
  'stream-line--unparsed': entry.verdict.status === 'unparsed',
  'stream-line--forward': entry.kind === 'forward',
})

/* ===== 报文内容列：显示前 20 个 hex 字符，超出省略（与发送数据流一致） ===== */
const shortHex = (entry) => {
  const text = entry.hex || '—'
  if (text.length > 20) return `${text.slice(0, 20)}…`
  return text
}

/* ===== 表头全选 ===== */
const allRecvFilteredIds = computed(() =>
  filteredEntries.value.filter((e) => e.kind === 'recv').map((e) => e.id)
)
const selectedRecvInView = computed(() =>
  allRecvFilteredIds.value.filter((id) => selectedIds.value.includes(id))
)
const allSelected = computed(() =>
  allRecvFilteredIds.value.length > 0 &&
  selectedRecvInView.value.length === allRecvFilteredIds.value.length
)
const indeterminate = computed(() =>
  selectedRecvInView.value.length > 0 && !allSelected.value
)
const toggleSelectAll = () => {
  if (allSelected.value) {
    const viewSet = new Set(allRecvFilteredIds.value)
    selectedIds.value = selectedIds.value.filter((id) => !viewSet.has(id))
  } else {
    selectedIds.value = [...new Set([...selectedIds.value, ...allRecvFilteredIds.value])]
  }
  resetRangeSelection()
}

/* ===== 勾选与保存 ===== */
const selectedIds = ref([])
const selectionAnchorId = ref('')
const selectionRangeVisible = ref(false)
const selectionViewportTarget = ref(-1)
const viewportStart = ref(0)
const viewportEnd = ref(-1)
const selectionAnchorIndex = computed(() => filteredEntries.value.findIndex((entry) => entry.id === selectionAnchorId.value))
const selectionDirection = computed(() => selectionAnchorIndex.value > viewportEnd.value && viewportEnd.value >= 0 ? 'up' : 'down')
const currentViewportTarget = computed(() => selectionDirection.value === 'up' ? viewportStart.value : viewportEnd.value)

const resetRangeSelection = () => {
  selectionAnchorId.value = ''
  selectionRangeVisible.value = false
  selectionViewportTarget.value = -1
}

const updateViewportRange = () => {
  const viewport = streamRef.value?.getBoundingClientRect?.()
  const lines = [...(streamRef.value?.querySelectorAll?.('.stream-line') || [])]
  if (!viewport || !lines.length) {
    viewportStart.value = 0
    viewportEnd.value = filteredEntries.value.length - 1
    return
  }
  let firstVisible = -1
  let lastVisible = -1
  lines.forEach((line, index) => {
    const rect = line.getBoundingClientRect()
    if (rect.top < viewport.bottom && rect.bottom > viewport.top) {
      if (firstVisible < 0) firstVisible = index
      lastVisible = index
    }
  })
  viewportStart.value = firstVisible >= 0 ? firstVisible : 0
  viewportEnd.value = lastVisible >= 0 ? lastVisible : filteredEntries.value.length - 1
}

const onStreamScroll = () => {
  updateViewportRange()
  if (selectionAnchorId.value && currentViewportTarget.value !== selectionViewportTarget.value) {
    selectionRangeVisible.value = true
  }
}

const toggleSelect = (id) => {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) {
    selectedIds.value.splice(i, 1)
    if (!selectedIds.value.length) resetRangeSelection()
    else if (selectionAnchorId.value === id) {
      selectionAnchorId.value = selectedIds.value[0]
      nextTick(() => {
        updateViewportRange()
        selectionRangeVisible.value = true
        selectionViewportTarget.value = currentViewportTarget.value
      })
    }
    return
  }

  selectedIds.value.push(id)
  if (!selectionAnchorId.value || !selectedIds.value.includes(selectionAnchorId.value)) {
    selectionAnchorId.value = id
    nextTick(() => {
      updateViewportRange()
      selectionRangeVisible.value = true
      selectionViewportTarget.value = currentViewportTarget.value
    })
  }
}

const selectToViewportEdge = () => {
  updateViewportRange()
  const anchorIndex = selectionAnchorIndex.value
  const targetIndex = currentViewportTarget.value
  if (anchorIndex < 0 || targetIndex < 0) return
  const from = Math.min(anchorIndex, targetIndex)
  const to = Math.max(anchorIndex, targetIndex)
  const rangeIds = filteredEntries.value
    .slice(from, to + 1)
    .filter((entry) => entry.kind === 'recv')
    .map((entry) => entry.id)
  selectedIds.value = [...new Set([...selectedIds.value, ...rangeIds])]
  selectionViewportTarget.value = targetIndex
  selectionRangeVisible.value = false
}

const clearSelection = () => {
  selectedIds.value = []
  resetRangeSelection()
}

const saveVisible = ref(false)
const saveIds = ref([])
const saveMode = ref('exist')
const saveDatasetId = ref(null)
const saveNewName = ref('')

const openSaveDialog = (ids) => {
  if (!ids.length) return
  saveIds.value = [...ids]
  saveMode.value = dataStore.datasets.length ? 'exist' : 'new'
  saveDatasetId.value = dataStore.datasets[0]?.id || null
  const first = store.recvQueue.find((e) => e.id === ids[0])
  saveNewName.value = first ? `${first.iface} 接收样本` : '接收样本'
  saveVisible.value = true
}

const confirmSave = () => {
  if (saveMode.value === 'exist' && !saveDatasetId.value) {
    ElMessage.warning('请选择目标数据集')
    return
  }
  if (saveMode.value === 'new' && !saveNewName.value.trim()) {
    ElMessage.warning('请输入数据集名称')
    return
  }
  const result = store.saveToDataset(
    saveIds.value,
    saveMode.value === 'exist' ? { datasetId: saveDatasetId.value } : { newName: saveNewName.value.trim() }
  )
  if (result) {
    ElMessage.success(`已保存 ${result.saved} 条到数据集「${result.dataset.name}」（来源：接收报文）`)
    selectedIds.value = selectedIds.value.filter((id) => !saveIds.value.includes(id))
    if (!selectedIds.value.includes(selectionAnchorId.value)) resetRangeSelection()
    saveVisible.value = false
  } else {
    ElMessage.error('保存失败：目标数据集不存在')
  }
}

/* ===== 详情抽屉 ===== */
const detailVisible = ref(false)
const detailEntryId = ref('')
const openDetail = (entry) => {
  detailEntryId.value = entry.id
  detailVisible.value = true
}

/* ===== 自动滚动 ===== */
watch(() => store.recvQueue.length, () => {
  if (!autoScroll.value) return
  nextTick(() => {
    const el = streamRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>

<style scoped lang="scss">
.rmonitor { display: flex; flex-direction: column; gap: 14px; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.card-sub { color: var(--el-text-color-secondary); font-size: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }

.stream-summary { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.stream-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 3px 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  font-size: 11px;
  white-space: nowrap;
}
.stream-stat b { color: var(--el-text-color-primary); font: 700 12px Consolas, Monaco, monospace; }
.stream-stat.metric--ok b { color: var(--el-color-success); }
.stream-stat.metric--bad b { color: var(--el-color-danger); }
.stream-stat.metric--warn b { color: var(--el-color-warning); }

.stream-card { display: flex; flex-direction: column; height: 520px; }
.stream-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
}

/* ===== 数据流工具条 ===== */
.stream-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.stream-tools__filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.stream-tools__right { display: flex; align-items: center; gap: 12px; }
.filter-tag { font-size: 12px; }

/* ===== 数据流列表：接口名 / IP / 协议 / 消息号 / 时间 / 报文内容 / 详情 ===== */
$stream-cols: 30px 150px 130px 70px 90px 96px minmax(140px, 1fr) 52px;
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
.stream-head__chk { display: flex; align-items: center; cursor: pointer; }
.stream-wrap { position: relative; flex: 1; min-height: 0; display: flex; }
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
  display: grid;
  grid-template-columns: $stream-cols;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
}
.stream-line:hover { background: rgba(255, 255, 255, .07); }
.stream-line--error { background: rgba(245, 108, 108, .12); }
.stream-line--error .col-iface, .stream-line--error .col-ip { color: #ffb3b3; }
.stream-line--unparsed { background: rgba(230, 162, 60, .1); }
.stream-line--unparsed .col-iface, .stream-line--unparsed .col-ip { color: #f3d19e; }
.stream-line--forward .col-iface { color: #7ec8ff; }
.col-chk { display: flex; align-items: center; }
.col-chk input { cursor: pointer; }
.col-iface, .col-ip, .hex { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-ip { color: rgba(215, 225, 234, .65); }
.col-protocol { color: rgba(215, 225, 234, .65); }
.col-msgid { color: rgba(215, 225, 234, .65); }
.col-op { text-align: center; }
.fw-mark {
  font-style: normal;
  font-size: 11px;
  color: #7ec8ff;
  border: 1px solid rgba(126, 200, 255, .5);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.tx-mark {
  font-style: normal;
  font-size: 11px;
  color: #b37feb;
  border: 1px solid rgba(179, 127, 235, .5);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.stream-empty { padding: 80px 0; text-align: center; color: rgba(215, 225, 234, .55); }

.select-to-here {
  position: absolute;
  z-index: 12;
  left: 10px;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(126, 200, 255, .42);
  border-radius: 16px;
  background: rgba(16, 25, 35, .92);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .24);
  color: #a9c8df;
  cursor: pointer;
  font-size: 13px;
  backdrop-filter: blur(6px);
}
.select-to-here:hover { border-color: #7ec8ff; color: #d8efff; }
.select-to-here:focus-visible { outline: 2px solid #7ec8ff; outline-offset: 2px; }
.select-to-here--down { bottom: 10px; }
.select-to-here--up { top: 10px; }

.save-tip { margin-bottom: 14px; }

@media (max-width: 1180px) {
  .stream-card { height: 460px; }
}
</style>
