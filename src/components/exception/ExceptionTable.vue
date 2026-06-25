<template>
  <div class="exception-table">
    <div class="toolbar">
      <el-input v-model="local.keyword" placeholder="搜索接口 / 备注 / 字段" :prefix-icon="Search" clearable class="kw" />
      <el-select v-model="local.type" placeholder="类型" clearable>
        <el-option v-for="type in typeOptions" :key="type.name" :label="type.name" :value="type.name" />
      </el-select>
      <el-select v-model="local.level" placeholder="级别" clearable>
        <el-option label="高" value="高" />
        <el-option label="中" value="中" />
        <el-option label="低" value="低" />
      </el-select>
      <el-select v-model="local.state" placeholder="状态" clearable>
        <el-option v-for="state in EXC_STATES" :key="state.value" :label="state.label" :value="state.value" />
      </el-select>
      <el-select v-model="local.source" placeholder="来源" clearable>
        <el-option v-for="source in EXC_SOURCES" :key="source.value" :label="source.label" :value="source.value" />
      </el-select>
      <el-segmented v-model="groupBy" :options="groupOptions" />
    </div>

    <div class="batch-row">
      <span class="muted">已选 {{ selected.length }} 条</span>
      <el-button size="small" :disabled="!selected.length" @click="batchState('处理中')">开始处理</el-button>
      <el-button size="small" type="success" plain :disabled="!selected.length" @click="batchState('已处理')">标记已处理</el-button>
      <el-button size="small" type="info" plain :disabled="!selected.length" @click="batchState('已忽略')">批量忽略</el-button>
      <el-button size="small" :icon="Download" @click="exportCsv">导出 CSV</el-button>
    </div>

    <div v-for="group in groupedRows" :key="group.key" class="group-block">
      <div v-if="groupBy !== 'none'" class="group-title">
        <span>{{ group.label }}</span>
        <el-tag size="small" effect="plain">{{ group.items.length }}</el-tag>
      </div>
      <el-table
        :data="group.items"
        size="small"
        row-key="id"
        empty-text="暂无异常"
        @selection-change="onSelectionChange"
        @row-click="$emit('view', $event)"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column label="时间" prop="capturedTime" width="170" />
        <el-table-column label="系统 / 模块" min-width="190">
          <template #default="{ row }">
            <div class="stack">
              <strong>{{ systemName(row.systemId) }}</strong>
              <span>{{ moduleName(row.moduleId) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="接口" prop="iface" min-width="130" />
        <el-table-column label="类型" min-width="128">
          <template #default="{ row }"><el-tag effect="plain">{{ row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column label="级别" width="80" align="center">
          <template #default="{ row }"><el-tag :type="levelMeta(row.level).tag" effect="dark" size="small">{{ row.level }}</el-tag></template>
        </el-table-column>
        <el-table-column label="来源" width="100" align="center">
          <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="104" align="center">
          <template #default="{ row }"><el-tag :type="stateMeta(row.state).tag" size="small">{{ row.state }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="$emit('view', row)">详情</el-button>
            <el-button link type="success" @click.stop="quickResolve(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import { EXC_SOURCES, EXC_STATES, useExceptionStore } from '@/stores/exception'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['view', 'filters-change'])

const store = useExceptionStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const selected = ref([])
const groupBy = ref('none')
const local = reactive({ keyword: '', type: '', level: '', state: '', source: '' })
const groupOptions = [
  { label: '不分组', value: 'none' },
  { label: '按类型', value: 'type' },
  { label: '按模块', value: 'moduleId' },
  { label: '按状态', value: 'state' },
]

watch(() => props.filters, (value) => Object.assign(local, value), { immediate: true, deep: true })
watch(local, () => emit('filters-change', { ...local }), { deep: true })

const typeOptions = computed(() => store.types)
const levelMeta = (level) => store.levelMeta(level)
const stateMeta = (state) => store.stateMeta(state)
const sourceLabel = (source) => EXC_SOURCES.find((item) => item.value === source)?.label || source
const systemName = (id) => systemStore.systems.find((item) => item.id === id)?.name || '未归属系统'
const moduleName = (id) => connStore.nodes.find((item) => item.id === id)?.name || '未归属模块'

const sortedRows = computed(() => [...props.rows].sort((a, b) => {
  const pendingRank = (item) => item.state === '待处理' ? 0 : (item.state === '处理中' ? 1 : 2)
  const rank = pendingRank(a) - pendingRank(b)
  if (rank) return rank
  return String(b.capturedTime || '').localeCompare(String(a.capturedTime || ''))
}))

const groupedRows = computed(() => {
  if (groupBy.value === 'none') return [{ key: 'all', label: '全部异常', items: sortedRows.value }]
  const map = new Map()
  sortedRows.value.forEach((item) => {
    const key = item[groupBy.value] || 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  })
  return [...map.entries()].map(([key, items]) => ({
    key,
    label: groupLabel(key),
    items,
  }))
})

const groupLabel = (key) => {
  if (groupBy.value === 'type') return key
  if (groupBy.value === 'state') return key
  if (groupBy.value === 'moduleId') return moduleName(key)
  return key
}

const onSelectionChange = (items) => {
  selected.value = items
}
const batchState = (state) => {
  store.batchUpdate(selected.value.map((item) => item.id), { state }, '批量处置')
  ElMessage.success(`已更新 ${selected.value.length} 条异常`)
  selected.value = []
}
const quickResolve = (row) => {
  store.updateState(row.id, row.state === '待处理' ? '处理中' : '已处理', '快捷处置')
}
const exportCsv = () => {
  const header = '时间,系统,模块,接口,类型,级别,来源,状态,备注'
  const lines = sortedRows.value.map((row) => [
    row.capturedTime,
    systemName(row.systemId),
    moduleName(row.moduleId),
    row.iface,
    row.type,
    row.level,
    sourceLabel(row.source),
    row.state,
    row.remark || row.detail?.ruleMessage || '',
  ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `exceptions-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.exception-table { display: flex; flex-direction: column; gap: 12px; }
.toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) repeat(4, 128px) 260px;
  gap: 8px;
  align-items: center;
}
.kw { min-width: 180px; }
.batch-row { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; margin-right: auto; }
.group-block { display: flex; flex-direction: column; gap: 8px; }
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.stack { display: flex; flex-direction: column; gap: 2px; }
.stack span { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1220px) {
  .toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
