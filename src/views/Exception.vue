<template>
  <div class="page exception-page">
    <div class="page__header">
      <div>
        <h2>异常数据管理</h2>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <MonitorTree
          v-model="selectedKey"
          title="接收数据范围"
          readonly
          :visible-groups="['system']"
          :iface-badge="ifaceBadge"
          :scheme-badge="() => ''"
          :custom-badge="() => ''"
          empty-text="暂无接口，请先在报文字段管理中定义"
          @select="onTreeSelect"
        />
      </div>

      <div class="main-panel">
        <div class="scope-row">
          <div>
            <strong>{{ scopeTitle }}</strong>
          </div>
          <el-button v-if="selectedKey" text type="primary" @click="clearScope">查看全部接口</el-button>
        </div>

        <div class="metrics">
          <div class="metric metric--total">
            <span>{{ metrics.total }}</span>
            <small>异常样本</small>
          </div>
          <div class="metric metric--danger">
            <span>{{ metrics.unparsed }}</span>
            <small>无法解析</small>
          </div>
          <div class="metric metric--warning">
            <span>{{ metrics.structure }}</span>
            <small>结构异常</small>
          </div>
          <div class="metric metric--warning">
            <span>{{ metrics.constraint }}</span>
            <small>字段约束异常</small>
          </div>
          <div class="metric">
            <span>{{ metrics.rule }}</span>
            <small>规则校验异常</small>
          </div>
          <div class="metric metric--success">
            <span>{{ metrics.saved }}</span>
            <small>已存入数据集</small>
          </div>
        </div>

        <el-card shadow="never" class="sample-card">
          <template #header>
            <div class="card-heading">
              <div>
                <strong>异常样本库</strong>
              </div>
              <el-tag effect="plain">{{ visibleExceptions.length }} 条</el-tag>
            </div>
          </template>
          <ExceptionTable
            :rows="visibleExceptions"
            :filters="tableFilters"
            @filters-change="tableFilters = $event"
            @view="openDetail"
            @save="openSaveDialog"
            @variant="openVariantDialog"
          />
        </el-card>
      </div>
    </div>

    <ExceptionDetailDrawer
      v-model="detailVisible"
      :exception="activeException"
      @save-dataset="openSaveDialog"
      @create-variant="openVariantDialog"
    />
    <ExceptionDatasetDialog
      v-model="datasetDialogVisible"
      :samples="datasetDialogSamples"
      :mode="datasetDialogMode"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import ExceptionTable from '@/components/exception/ExceptionTable.vue'
import ExceptionDetailDrawer from '@/components/exception/ExceptionDetailDrawer.vue'
import ExceptionDatasetDialog from '@/components/exception/ExceptionDatasetDialog.vue'
import { useExceptionStore } from '@/stores/exception'
import { useProtocolStore } from '@/stores/protocol'

const route = useRoute()
const exceptionStore = useExceptionStore()
const protocolStore = useProtocolStore()

const selectedKey = ref('')
const tableFilters = ref({ keyword: '', type: '', savedStatus: '', tag: '' })
const detailVisible = ref(false)
const activeException = ref(null)
const datasetDialogVisible = ref(false)
const datasetDialogSamples = ref([])
const datasetDialogMode = ref('save')

/* ---- 接口/报文筛选 ---- */
const selectedIface = computed(() => {
  const match = selectedKey.value.match(/^iface-(.+)$/)
  if (!match) return null
  return protocolStore.testInterfaces.find((i) => String(i.id) === String(match[1])) || null
})
const selectedMessage = computed(() => {
  const match = selectedKey.value.match(/^msg-(.+)$/)
  if (!match) return null
  return protocolStore.interfaces.find((m) => String(m.id) === String(match[1])) || null
})
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)
const ifaceBadge = (iface) => `${(iface?.messageIds || []).length} 报文`

const visibleExceptions = computed(() => {
  const base = { ...tableFilters.value }
  if (selectedMessage.value) {
    base.interfaceId = selectedMessage.value.id
    base.interfaceName = selectedMessage.value.name
  } else if (selectedIface.value) {
    base.interfaceNames = ifaceMessages(selectedIface.value).map((m) => m.name)
  }
  return exceptionStore.filtered(base)
})
const metrics = computed(() => exceptionStore.stats(visibleExceptions.value))
const scopeTitle = computed(() => {
  if (selectedMessage.value) return `${selectedMessage.value.name}`
  if (selectedIface.value) return `${selectedIface.value.name} · 全部报文`
  return '全部接口 · 接收异常数据'
})

const onTreeSelect = (data) => {
  if (['iface', 'message'].includes(data.kind) && data.ref) {
    selectedKey.value = data.key
  }
}
function clearScope() {
  selectedKey.value = ''
}

const queryValue = (value) => Array.isArray(value) ? value[0] : value
const resetTableFilters = () => {
  tableFilters.value = { keyword: '', type: '', savedStatus: '', tag: '' }
}
function openDetail(row) {
  exceptionStore.select(row.id)
  activeException.value = row
  detailVisible.value = true
}
function openSaveDialog(rows) {
  const samples = Array.isArray(rows) ? rows : [rows]
  datasetDialogSamples.value = samples.filter(Boolean)
  datasetDialogMode.value = 'save'
  detailVisible.value = false
  datasetDialogVisible.value = datasetDialogSamples.value.length > 0
}
function openVariantDialog(row) {
  datasetDialogSamples.value = row ? [row] : []
  datasetDialogMode.value = 'variant'
  detailVisible.value = false
  datasetDialogVisible.value = Boolean(row)
}
function locateException(item, { open = false } = {}) {
  if (!item) return
  resetTableFilters()
  // 按异常所属报文名定位接口/报文
  const message = protocolStore.interfaces.find((m) => String(m.name) === String(item.iface))
  if (message) selectedKey.value = `msg-${message.id}`
  else {
    const iface = protocolStore.testInterfaces.find((i) => String(i.name) === String(item.iface))
    if (iface) selectedKey.value = `iface-${iface.id}`
  }
  if (open) openDetail(item)
}

watch(() => route.query.id, (id) => {
  const targetId = queryValue(id)
  if (!targetId) return
  const item = exceptionStore.exceptions.find((ex) => String(ex.id) === String(targetId))
  locateException(item, { open: true })
}, { immediate: true })

watch(() => route.query.interfaceId, (interfaceId) => {
  const targetId = queryValue(interfaceId)
  if (!targetId) return
  const message = protocolStore.interfaces.find((m) => String(m.id) === String(targetId))
  if (message) {
    resetTableFilters()
    selectedKey.value = `msg-${message.id}`
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.exception-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.page__header p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.split {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}
.tree-panel {
  display: flex;
  width: 300px;
  min-height: 0;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
:deep(.mtree) {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
:deep(.mtree > .el-card__body) {
  min-height: 0;
  overflow: hidden;
}
.main-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}
.scope-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(245, 108, 108, .08), transparent 46%),
    var(--el-bg-color);
}
.scope-row > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.scope-row span { color: var(--el-text-color-secondary); font-size: 12px; }
.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(110px, 1fr));
  gap: 10px;
}
.metric {
  min-height: 76px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.metric span { display: block; font: 750 24px Consolas, Monaco, monospace; }
.metric small { color: var(--el-text-color-secondary); font-size: 12px; }
.metric--danger span { color: var(--el-color-danger); }
.metric--warning span { color: var(--el-color-warning); }
.metric--success span { color: var(--el-color-success); }
.sample-card {
  min-height: 0;
  flex: 1;
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { height: calc(100% - 60px); padding: 12px; overflow: auto; }
}
.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-heading > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.card-heading span { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1180px) {
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 260px; }
  .metrics { grid-template-columns: repeat(3, minmax(110px, 1fr)); }
}
</style>
