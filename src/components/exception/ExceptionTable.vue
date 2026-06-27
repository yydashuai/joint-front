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
      <el-select v-model="local.tag" placeholder="标签" clearable filterable>
        <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
      </el-select>
      <el-segmented v-model="groupBy" :options="groupOptions" />
    </div>

    <div class="batch-row">
      <span class="muted">已选 {{ selected.length }} 条</span>
      <el-button size="small" type="success" plain :disabled="!selected.length" @click="markSelectedProcessed">标记已处理</el-button>
      <el-button size="small" :icon="Download" @click="exportCsv">导出 CSV</el-button>
    </div>

    <div v-for="group in groupedRows" :key="group.key" class="group-block">
      <div v-if="groupBy !== 'none'" class="group-title">
        <span>{{ group.label }}</span>
        <el-tag size="small" effect="plain">{{ group.items.length }}</el-tag>
      </div>
      <div class="table-scroll">
        <el-table
          :data="group.items"
          size="small"
          row-key="id"
          empty-text="暂无异常"
          class="ledger-table"
          @selection-change="onSelectionChange"
          @sort-change="onSortChange"
          @row-click="$emit('view', $event)"
        >
          <el-table-column type="selection" width="42" />
          <el-table-column label="系统 / 模块" prop="systemModule" sortable="custom" min-width="190">
            <template #default="{ row }">
              <div class="stack">
                <strong>{{ systemName(row.systemId) }}</strong>
                <span>{{ moduleName(row.moduleId) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="接口" prop="iface" sortable="custom" min-width="130" />
          <el-table-column label="类型" prop="type" sortable="custom" min-width="128">
            <template #default="{ row }"><el-tag effect="plain">{{ row.type }}</el-tag></template>
          </el-table-column>
          <el-table-column label="级别" prop="level" sortable="custom" width="80" align="center">
            <template #default="{ row }"><el-tag :type="levelMeta(row.level).tag" effect="dark" size="small">{{ row.level }}</el-tag></template>
          </el-table-column>
          <el-table-column label="状态" prop="state" sortable="custom" width="104" align="center">
            <template #default="{ row }"><el-tag :type="stateMeta(row.state).tag" size="small">{{ row.state }}</el-tag></template>
          </el-table-column>
          <el-table-column label="标签" prop="tags" sortable="custom" min-width="160">
            <template #default="{ row }">
              <span class="tag-text" :title="tagText(row.tags)">{{ tagText(row.tags) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" prop="remark" sortable="custom" min-width="220">
            <template #default="{ row }">
              <RemarkCell v-model="row.remark" @click.stop />
            </template>
          </el-table-column>
          <el-table-column label="时间" prop="capturedTime" sortable="custom" width="170" />
          <el-table-column label="操作" width="82" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="$emit('view', row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import { EXC_LEVELS, EXC_SOURCES, EXC_STATES, useExceptionStore } from '@/stores/exception'
import RemarkCell from '@/components/RemarkCell.vue'
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
const sortState = ref({ prop: '', order: null })
const local = reactive({ keyword: '', type: '', level: '', state: '', tag: '' })
const groupOptions = [
  { label: '不分组', value: 'none' },
  { label: '按类型', value: 'type' },
  { label: '按模块', value: 'moduleId' },
  { label: '按状态', value: 'state' },
  { label: '按标签', value: 'tag' },
]

watch(() => props.filters, (value) => Object.assign(local, value), { immediate: true, deep: true })
watch(local, () => emit('filters-change', { ...local }), { deep: true })

const typeOptions = computed(() => store.types)
const tagOptions = computed(() => store.tagOptions)
const levelMeta = (level) => store.levelMeta(level)
const stateMeta = (state) => store.stateMeta(state)
const sourceLabel = (source) => EXC_SOURCES.find((item) => item.value === source)?.label || source
const systemName = (id) => systemStore.systems.find((item) => item.id === id)?.name || '未归属系统'
const moduleName = (id) => connStore.nodes.find((item) => item.id === id)?.name || '未归属模块'
const tagText = (tags = []) => tags.length ? tags.join(', ') : '未打标签'
const levelRank = (level) => {
  const index = EXC_LEVELS.findIndex((item) => item.value === level)
  return index === -1 ? EXC_LEVELS.length : index
}
const stateRank = (state) => {
  const index = EXC_STATES.findIndex((item) => item.value === state)
  return index === -1 ? EXC_STATES.length : index
}
const sortValue = (row, prop) => {
  if (prop === 'systemModule') return `${systemName(row.systemId)} ${moduleName(row.moduleId)}`
  if (prop === 'level') return levelRank(row.level)
  if (prop === 'source') return sourceLabel(row.source)
  if (prop === 'state') return stateRank(row.state)
  if (prop === 'tags') return tagText(row.tags)
  if (prop === 'remark') return row.remark || row.detail?.ruleMessage || ''
  if (prop === 'capturedTime') return new Date(String(row.capturedTime || '').replace(/\//g, '-')).getTime() || 0
  return row[prop] ?? ''
}
const compareRows = (a, b, prop, order) => {
  const left = sortValue(a, prop)
  const right = sortValue(b, prop)
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), 'zh-CN', { numeric: true })
  return order === 'descending' ? -result : result
}

const sortedRows = computed(() => [...props.rows].sort((a, b) => {
  if (sortState.value.prop && sortState.value.order) {
    return compareRows(a, b, sortState.value.prop, sortState.value.order)
  }
  const pendingRank = (item) => item.state === '待处理' ? 0 : 1
  const rank = pendingRank(a) - pendingRank(b)
  if (rank) return rank
  return String(b.capturedTime || '').localeCompare(String(a.capturedTime || ''))
}))

const groupedRows = computed(() => {
  if (groupBy.value === 'none') return [{ key: 'all', label: '全部异常', items: sortedRows.value }]
  const map = new Map()
  sortedRows.value.forEach((item) => {
    const keys = groupBy.value === 'tag' ? (item.tags?.length ? item.tags : ['untagged']) : [item[groupBy.value] || 'unknown']
    keys.forEach((key) => {
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })
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
  if (groupBy.value === 'tag') return key === 'untagged' ? '未打标签' : key
  return key
}

const onSelectionChange = (items) => {
  selected.value = items
}
const onSortChange = ({ prop, order }) => {
  sortState.value = { prop: prop || '', order }
}
const markSelectedProcessed = () => {
  const rows = selected.value.filter((item) => item?.id && item.state !== '已处理')
  const ids = [...new Set(rows.map((item) => item.id))]
  rows.forEach((item) => {
    item.state = '已处理'
  })
  store.batchUpdate(ids, { state: '已处理' }, '批量标记已处理')
  ElMessage.success(`已标记 ${ids.length} 条异常为已处理`)
  selected.value = []
}
const exportCsv = () => {
  const header = '时间,系统,模块,接口,类型,级别,来源,状态,标签,备注'
  const lines = sortedRows.value.map((row) => [
    row.capturedTime,
    systemName(row.systemId),
    moduleName(row.moduleId),
    row.iface,
    row.type,
    row.level,
    sourceLabel(row.source),
    row.state,
    (row.tags || []).join(' / '),
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
  grid-template-columns: minmax(180px, 1fr) repeat(4, minmax(110px, 128px)) 260px;
  gap: 8px;
  align-items: center;
}
.kw { min-width: 180px; }
.batch-row { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; margin-right: auto; }
.group-block { display: flex; flex-direction: column; gap: 8px; }
.table-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.ledger-table {
  min-width: 1400px;
}
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
.tag-text {
  display: block;
  overflow: hidden;
  color: var(--el-text-color-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1220px) {
  .toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
