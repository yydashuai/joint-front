<template>
  <div class="page exception-page">
    <div class="page__header">
      <div>
        <h2>异常管理</h2>
        <div class="page__desc">集中接收执行判定、链路事件与人工登记异常，完成归类、处置和记录</div>
      </div>
      <div class="header-actions">
        <el-select v-model="systemSelectValue" class="system-select">
          <el-option v-for="item in systemOptions" :key="item.selectValue" :label="item.label" :value="item.selectValue" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="showManual = true">手动录入</el-button>
        <el-badge :value="metrics.pending" :hidden="!metrics.pending" :max="99">
          <el-tag type="danger" effect="dark">待处理</el-tag>
        </el-badge>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <SystemModuleTree
          v-model="selectedKey"
          title="异常归属"
          @select="onTreeSelect"
        />
      </div>

      <div class="main-panel">
        <div class="scope-row">
          <div>
            <strong>{{ scopeTitle }}</strong>
            <span>{{ scopeSub }}</span>
          </div>
          <el-button v-if="selectedModuleId" text type="primary" @click="clearModule">查看全部模块</el-button>
        </div>

        <div class="metrics">
          <div class="metric metric--total">
            <span>{{ metrics.total }}</span>
            <small>异常总数</small>
          </div>
          <div class="metric metric--pending">
            <span>{{ metrics.pending }}</span>
            <small>待处理</small>
          </div>
          <div class="metric metric--high">
            <span>{{ metrics.high }}</span>
            <small>高级别</small>
          </div>
          <div class="metric">
            <span>{{ metrics.middle }}</span>
            <small>中级别</small>
          </div>
          <div class="metric">
            <span>{{ metrics.low }}</span>
            <small>低级别</small>
          </div>
          <div class="metric metric--resolved">
            <span>{{ metrics.resolvedRate }}%</span>
            <small>处置率</small>
          </div>
        </div>

        <el-card shadow="never" class="exception-tabs">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="异常台账" name="ledger">
              <ExceptionTable
                :rows="visibleExceptions"
                :filters="tableFilters"
                @filters-change="tableFilters = $event"
                @view="openDetail"
              />
            </el-tab-pane>
            <el-tab-pane label="处置效率" name="efficiency">
              <ExceptionEfficiency />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>

    <ExceptionDetailDrawer v-model="detailVisible" :exception="activeException" />
    <ManualExceptionDialog
      v-model="showManual"
      :system-id="systemStore.currentId || ''"
      :module-id="selectedModuleId"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ExceptionTable from '@/components/exception/ExceptionTable.vue'
import ExceptionEfficiency from '@/components/exception/ExceptionEfficiency.vue'
import ExceptionDetailDrawer from '@/components/exception/ExceptionDetailDrawer.vue'
import ManualExceptionDialog from '@/components/exception/ManualExceptionDialog.vue'
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { useSystemStore } from '@/stores/system'

const route = useRoute()
const exceptionStore = useExceptionStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()

const ALL_SYSTEM_VALUE = '__all__'
const selectedKey = ref('')
const selectedModuleId = ref('')
const activeTab = ref('ledger')
const tableFilters = ref({ keyword: '', type: '', level: '', state: '', source: '', tag: '' })
const detailVisible = ref(false)
const activeException = ref(null)
const showManual = ref(false)

const systemOptions = computed(() => systemStore.options.map((item) => ({
  ...item,
  selectValue: item.value == null ? ALL_SYSTEM_VALUE : item.value,
})))
const systemSelectValue = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_VALUE,
  set: (value) => {
    systemStore.setCurrent(value === ALL_SYSTEM_VALUE ? null : value)
    clearModule()
  },
})

const visibleExceptions = computed(() => exceptionStore.filtered({
  systemId: systemStore.currentId || '',
  moduleId: selectedModuleId.value,
  ...tableFilters.value,
}))
const metrics = computed(() => exceptionStore.stats(visibleExceptions.value))
const selectedModule = computed(() => connStore.nodes.find((item) => item.id === selectedModuleId.value))
const scopeTitle = computed(() => {
  if (selectedModule.value) return selectedModule.value.name
  if (systemStore.currentId) return `${systemStore.current?.name || '当前系统'} · 全部模块`
  return '全部系统 · 异常总览'
})
const scopeSub = computed(() => {
  if (selectedModule.value) return '仅显示该模块下的异常台账'
  return '按左侧模块可快速聚焦，异常台账按当前系统范围汇总'
})

watch(() => route.query.id, (id) => {
  if (!id) return
  const item = exceptionStore.exceptions.find((ex) => ex.id === id)
  if (item) openDetail(item)
}, { immediate: true })

const onTreeSelect = (data) => {
  if (data.kind !== 'module' || !data.ref) return
  selectedModuleId.value = data.ref.id
  selectedKey.value = data.key
  activeTab.value = 'ledger'
}
function clearModule() {
  selectedModuleId.value = ''
  selectedKey.value = ''
}
const openDetail = (row) => {
  exceptionStore.select(row.id)
  activeException.value = row
  detailVisible.value = true
}
</script>

<style scoped lang="scss">
.exception-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-right: 16px;
}
.system-select { width: 220px; }
.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.tree-panel {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.smt) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.scope-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(245, 108, 108, .08), transparent 42%),
    var(--el-bg-color);
}
.scope-row div { display: flex; flex-direction: column; gap: 2px; }
.scope-row span { color: var(--el-text-color-secondary); font-size: 12px; }
.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(110px, 1fr));
  gap: 10px;
}
.metric {
  min-height: 72px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.metric span {
  display: block;
  font: 750 24px Consolas, Monaco, monospace;
}
.metric small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.metric--pending span,
.metric--high span { color: var(--el-color-danger); }
.metric--resolved span { color: var(--el-color-success); }
.exception-tabs {
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  :deep(.el-card__body) {
    height: 100%;
    padding: 12px;
    overflow: auto;
  }
}
@media (max-width: 1180px) {
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 260px; }
  .metrics { grid-template-columns: repeat(3, minmax(110px, 1fr)); }
}
</style>
