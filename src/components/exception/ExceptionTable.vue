<template>
  <div class="exception-table">
    <div class="toolbar">
      <el-input
        v-model="local.keyword"
        placeholder="搜索报文、异常字段或数据内容"
        :prefix-icon="Search"
        clearable
        class="kw"
      />
      <el-select v-model="local.type" placeholder="异常类型" clearable>
        <el-option v-for="type in typeOptions" :key="type.name" :label="type.name" :value="type.name" />
      </el-select>
      <el-select v-model="local.savedStatus" placeholder="入库情况" clearable>
        <el-option label="尚未入库" value="unsaved" />
        <el-option label="已存入数据集" value="saved" />
      </el-select>
      <el-select v-model="local.tag" placeholder="样本标签" clearable filterable>
        <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
      </el-select>
      <el-segmented v-model="groupBy" :options="groupOptions" />
    </div>

    <div class="batch-row">
      <span class="muted">已选择 {{ selected.length }} 条异常样本</span>
      <el-button size="small" type="primary" :disabled="!selected.length" @click="$emit('save', selected)">
        存入数据集
      </el-button>
      <el-button size="small" :icon="Download" @click="exportCsv">导出 CSV</el-button>
    </div>

    <div v-for="group in groupedRows" :key="group.key" class="group-block">
      <div v-if="groupBy !== 'none'" class="group-title">
        <span>{{ group.label }}</span>
        <el-tag size="small" effect="plain">{{ group.items.length }}</el-tag>
      </div>
      <div class="table-scroll">
        <TableRangeSelection
          :key="`${groupBy}-${group.key}`"
          :rows="group.items"
          row-key="id"
          @selection-change="(items) => onGroupSelectionChange(group.key, items)"
        >
          <template #default="{ setTableRef, handleSelectionChange, handleScroll }">
        <el-table
          :ref="setTableRef"
          :data="group.items"
          size="small"
          row-key="id"
          empty-text="暂无接收异常数据"
          class="ledger-table"
          @selection-change="handleSelectionChange"
          @scroll="handleScroll"
          @sort-change="onSortChange"
          @row-click="$emit('view', $event)"
        >
          <el-table-column type="selection" width="42" />
          <el-table-column label="系统 / 模块" prop="systemModule" sortable="custom" min-width="180">
            <template #default="{ row }">
              <div class="stack">
                <strong>{{ systemName(row.systemId) }}</strong>
                <span>{{ moduleName(row.moduleId) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="报文" prop="iface" sortable="custom" min-width="130">
            <template #default="{ row }">
              <div class="stack">
                <strong>{{ row.iface }}</strong>
                <span>{{ row.transport || 'bin' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" prop="type" sortable="custom" min-width="126">
            <template #default="{ row }">
              <el-tag :type="typeMeta(row.type).tone" effect="light">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="异常定位" prop="issue" sortable="custom" min-width="250">
            <template #default="{ row }">
              <div class="issue-cell">
                <strong>{{ firstIssue(row).field || '报文整体' }}</strong>
                <span :title="firstIssue(row).message">{{ firstIssue(row).message || '未记录异常说明' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="数据摘要" prop="data" min-width="210">
            <template #default="{ row }">
              <code class="data-preview" :title="dataSummary(row)">{{ dataSummary(row) }}</code>
            </template>
          </el-table-column>
          <el-table-column label="入库情况" prop="savedStatus" sortable="custom" width="118" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.savedDatasetIds?.length" type="success" size="small">
                已入库 {{ row.savedDatasetIds.length }}
              </el-tag>
              <span v-else class="unsaved-dot">尚未入库</span>
            </template>
          </el-table-column>
          <el-table-column label="捕获时间" prop="capturedTime" sortable="custom" width="170" />
          <el-table-column label="操作" width="188" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="$emit('view', row)">详情</el-button>
              <el-button link type="primary" @click.stop="$emit('variant', row)">修改副本</el-button>
              <el-button link type="primary" @click.stop="$emit('save', [row])">保存</el-button>
            </template>
          </el-table-column>
        </el-table>
          </template>
        </TableRangeSelection>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Download, Search } from '@element-plus/icons-vue'
import { useExceptionStore } from '@/stores/exception'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import TableRangeSelection from '@/components/common/TableRangeSelection.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['view', 'save', 'variant', 'filters-change'])

const store = useExceptionStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const selected = ref([])
const groupSelections = new Map()
const groupBy = ref('none')
const sortState = ref({ prop: '', order: null })
const local = reactive({ keyword: '', type: '', savedStatus: '', tag: '' })
const groupOptions = [
  { label: '不分组', value: 'none' },
  { label: '按类型', value: 'type' },
  { label: '按模块', value: 'moduleId' },
  { label: '按入库', value: 'savedStatus' },
]

watch(() => props.filters, (value) => Object.assign(local, value), { immediate: true, deep: true })
watch(local, () => emit('filters-change', { ...local }), { deep: true })

const typeOptions = computed(() => store.types)
const tagOptions = computed(() => store.tagOptions)
const typeMeta = (type) => store.typeMeta(type)
const systemName = (id) => systemStore.systems.find((item) => item.id === id)?.name || '未归属系统'
const moduleName = (id) => connStore.nodes.find((item) => item.id === id)?.name || '未归属模块'
const firstIssue = (row) => row.issues?.[0] || {
  field: row.detail?.fieldPath || '',
  message: row.detail?.ruleMessage || row.remark || '',
}
const dataSummary = (row) => {
  const entries = Object.entries(row.values || {})
  if (entries.length) {
    return entries.slice(0, 2).map(([key, value]) => `${key}=${String(value)}`).join(' · ')
  }
  return row.rawHex || row.detail?.reqHex || '无可展示数据'
}
const savedStatus = (row) => row.savedDatasetIds?.length ? 'saved' : 'unsaved'
const sortValue = (row, prop) => {
  if (prop === 'systemModule') return `${systemName(row.systemId)} ${moduleName(row.moduleId)}`
  if (prop === 'issue') return `${firstIssue(row).field} ${firstIssue(row).message}`
  if (prop === 'savedStatus') return savedStatus(row)
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
  return String(b.capturedTime || '').localeCompare(String(a.capturedTime || ''))
}))

const groupedRows = computed(() => {
  if (groupBy.value === 'none') return [{ key: 'all', label: '全部异常样本', items: sortedRows.value }]
  const map = new Map()
  sortedRows.value.forEach((item) => {
    const key = groupBy.value === 'savedStatus' ? savedStatus(item) : (item[groupBy.value] || 'unknown')
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  })
  return [...map.entries()].map(([key, items]) => ({ key, label: groupLabel(key), items }))
})

const groupLabel = (key) => {
  if (groupBy.value === 'moduleId') return moduleName(key)
  if (groupBy.value === 'savedStatus') return key === 'saved' ? '已存入数据集' : '尚未入库'
  return key
}
const onGroupSelectionChange = (groupKey, items) => {
  groupSelections.set(groupKey, items)
  const unique = new Map()
  groupSelections.forEach((rows) => rows.forEach((row) => unique.set(row.id, row)))
  selected.value = [...unique.values()]
}
watch(groupBy, () => {
  groupSelections.clear()
  selected.value = []
})
watch(() => props.rows, () => {
  groupSelections.clear()
  selected.value = []
}, { deep: false })
const onSortChange = ({ prop, order }) => {
  sortState.value = { prop: prop || '', order }
}
const exportCsv = () => {
  const header = '捕获时间,系统,模块,报文,异常类型,异常字段,异常说明,数据摘要,入库情况'
  const lines = sortedRows.value.map((row) => [
    row.capturedTime,
    systemName(row.systemId),
    moduleName(row.moduleId),
    row.iface,
    row.type,
    firstIssue(row).field,
    firstIssue(row).message,
    dataSummary(row),
    savedStatus(row) === 'saved' ? '已存入数据集' : '尚未入库',
  ].map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(','))
  const blob = new Blob([`\uFEFF${[header, ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `异常数据-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.exception-table { display: flex; flex-direction: column; gap: 12px; }
.toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) repeat(3, minmax(120px, 150px)) 270px;
  gap: 8px;
  align-items: center;
}
.kw { min-width: 220px; }
.batch-row { display: flex; align-items: center; gap: 8px; }
.muted { margin-right: auto; color: var(--el-text-color-secondary); font-size: 12px; }
.group-block { display: flex; flex-direction: column; gap: 8px; }
.table-scroll { width: 100%; overflow-x: auto; overflow-y: hidden; }
.ledger-table { min-width: 1420px; }
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  font-weight: 650;
}
.stack,
.issue-cell { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.stack span,
.issue-cell span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-cell strong { color: var(--el-text-color-primary); font-size: 13px; }
.data-preview {
  display: block;
  overflow: hidden;
  color: var(--el-text-color-regular);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.unsaved-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.unsaved-dot::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
  content: '';
}
@media (max-width: 1280px) {
  .toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
