<template>
  <div class="history-data-manager">
    <!-- ======== 顶部工具栏 ======== -->
    <div class="hdm-toolbar">
      <div class="hdm-toolbar__left">
        <span class="hdm-title">历史测试数据管理</span>
        <el-tag size="small" type="info" effect="plain">{{ filteredHistory.length }} 条记录</el-tag>
        <el-tag size="small" type="success" effect="plain">跨 {{ datasetCount }} 个数据集</el-tag>
      </div>
      <div class="hdm-toolbar__right">
        <el-select
          v-model="filterDatasetId"
          placeholder="按数据集筛选"
          clearable
          size="default"
          style="width: 220px;"
        >
          <el-option
            v-for="ds in tdStore.datasets"
            :key="ds.id"
            :label="ds.name"
            :value="ds.id"
          />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索历史数据..."
          :prefix-icon="Search"
          clearable
          size="default"
          style="width: 200px;"
        />
        <el-button type="primary" size="default" :icon="Plus" @click="onAddNew">新增历史数据</el-button>
      </div>
    </div>

    <!-- ======== 主表格 ======== -->
    <div class="hdm-table-shell">
      <el-table
        :data="filteredHistory"
        size="small"
        border
        row-key="id"
        style="width: 100%;"
        height="100%"
        empty-text="暂无历史测试数据"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" align="center" />
        <el-table-column type="index" width="50" align="center" label="#" />
        <el-table-column label="所属数据集" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row._datasetName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属模块" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-secondary">{{ row._moduleName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="行标签" width="150" show-overflow-tooltip />
        <el-table-column label="数据内容" min-width="260">
          <template #default="{ row }">
            <span class="mono text-secondary">{{ formatValues(row.values) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.remark" class="remark-text">{{ row.remark }}</span>
            <span v-else class="text-ph">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="savedAt" label="保存日期" width="110" align="center" />
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="编辑">
              <el-button text type="primary" size="small" :icon="Edit" @click="onEditRow(row)" />
            </el-tooltip>
            <el-tooltip content="导入到当前数据集">
              <el-button text type="success" size="small" :icon="Right" @click="onImportToCurrent(row)" />
            </el-tooltip>
            <el-popconfirm title="确认删除此条历史数据？" @confirm="onDeleteRow(row)">
              <template #reference>
                <el-button text type="danger" size="small" :icon="Delete" />
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ======== 批量操作栏 ======== -->
    <div v-if="selectedRows.length > 0" class="hdm-batch-bar">
      <el-tag size="small" type="warning" effect="plain">已选 {{ selectedRows.length }} 条</el-tag>
      <el-button size="small" text type="primary" :icon="Right" @click="onBatchImport">批量导入</el-button>
      <el-button size="small" text type="danger" :icon="Delete" @click="onBatchDelete">批量删除</el-button>
    </div>

    <!-- ======== 新增/编辑对话框 ======== -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑历史数据' : '新增历史数据'"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="formData" label-width="100px" size="default">
        <el-form-item label="所属数据集" required>
          <el-select
            v-model="formData.datasetId"
            placeholder="选择数据集"
            style="width: 100%;"
            :disabled="isEditing"
          >
            <el-option
              v-for="ds in tdStore.datasets"
              :key="ds.id"
              :label="ds.name"
              :value="ds.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="行标签" required>
          <el-input v-model="formData.label" placeholder="输入行标签" />
        </el-form-item>
        <el-form-item label="数据内容">
          <div class="kv-editor">
            <div v-for="(item, idx) in formData.kvPairs" :key="idx" class="kv-row">
              <el-input v-model="item.key" placeholder="字段名" style="width: 40%;" />
              <el-input v-model="item.value" placeholder="值" style="width: 45%;" />
              <el-button text type="danger" :icon="Delete" @click="removeKvPair(idx)" />
            </div>
            <el-button text type="primary" :icon="Plus" @click="addKvPair">添加字段</el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="输入备注信息（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSubmitForm">{{ isEditing ? '保存修改' : '确认新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Search, Delete, Right, Plus, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTestDataStore } from '@/stores/testData'

const tdStore = useTestDataStore()

/* ========== 筛选 & 搜索 ========== */
const filterDatasetId = ref(null)
const searchKeyword = ref('')

const filteredHistory = computed(() => {
  let data = tdStore.allHistoryData
  if (filterDatasetId.value) {
    data = data.filter(h => h._datasetId === filterDatasetId.value)
  }
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    data = data.filter(h =>
      h.label?.toLowerCase().includes(kw) ||
      h._datasetName?.toLowerCase().includes(kw) ||
      h._moduleName?.toLowerCase().includes(kw) ||
      h.source?.toLowerCase().includes(kw) ||
      h.remark?.toLowerCase().includes(kw) ||
      Object.values(h.values || {}).some(v => String(v).toLowerCase().includes(kw))
    )
  }
  return data
})

const datasetCount = computed(() => {
  const ids = new Set(filteredHistory.value.map(h => h._datasetId))
  return ids.size
})

/* ========== 选择 & 批量操作 ========== */
const selectedRows = ref([])

const onSelectionChange = (rows) => { selectedRows.value = rows }

const onDeleteRow = (row) => {
  tdStore.removeHistoryRow(row._datasetId, row.id)
  ElMessage.success('历史数据已删除')
}

const onBatchDelete = () => {
  const count = selectedRows.value.length
  ElMessageBox.confirm(
    `确认删除选中的 ${count} 条历史数据？此操作不可恢复。`,
    '批量删除确认',
    { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    const grouped = {}
    selectedRows.value.forEach(r => {
      if (!grouped[r._datasetId]) grouped[r._datasetId] = []
      grouped[r._datasetId].push(r.id)
    })
    Object.entries(grouped).forEach(([dsId, ids]) => {
      tdStore.removeHistoryRowsBatch(Number(dsId), ids)
    })
    selectedRows.value = []
    ElMessage.success('批量删除完成')
  }).catch(() => {})
}

/* ========== 新增/编辑对话框 ========== */
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingRow = ref(null)

const formData = reactive({
  datasetId: null,
  label: '',
  source: '手动录入',
  remark: '',
  kvPairs: [{ key: '', value: '' }]
})

const resetForm = () => {
  formData.datasetId = filterDatasetId.value || tdStore.datasets[0]?.id || null
  formData.label = ''
  formData.source = '手动录入'
  formData.remark = ''
  formData.kvPairs = [{ key: '', value: '' }]
}

const onAddNew = () => {
  isEditing.value = false
  editingRow.value = null
  resetForm()
  dialogVisible.value = true
}

const onEditRow = (row) => {
  isEditing.value = true
  editingRow.value = row
  formData.datasetId = row._datasetId
  formData.label = row.label
  formData.source = row.source
  formData.remark = row.remark || ''
  const entries = Object.entries(row.values || {})
  formData.kvPairs = entries.length > 0
    ? entries.map(([key, value]) => ({ key, value: String(value) }))
    : [{ key: '', value: '' }]
  dialogVisible.value = true
}

const addKvPair = () => {
  formData.kvPairs.push({ key: '', value: '' })
}

const removeKvPair = (idx) => {
  formData.kvPairs.splice(idx, 1)
  if (formData.kvPairs.length === 0) formData.kvPairs.push({ key: '', value: '' })
}

const onSubmitForm = () => {
  if (!formData.datasetId) {
    ElMessage.warning('请选择所属数据集')
    return
  }
  if (!formData.label.trim()) {
    ElMessage.warning('请输入行标签')
    return
  }
  const values = {}
  formData.kvPairs.forEach(({ key, value }) => {
    if (key.trim()) values[key.trim()] = value
  })

  if (isEditing.value && editingRow.value) {
    tdStore.updateHistoryRow(formData.datasetId, editingRow.value.id, {
      label: formData.label.trim(),
      values,
      source: formData.source,
      remark: formData.remark
    })
    ElMessage.success('历史数据已更新')
  } else {
    tdStore.addHistoryRows(formData.datasetId, [{
      label: formData.label.trim(),
      values,
      source: formData.source,
      remark: formData.remark
    }])
    ElMessage.success('历史数据已新增')
  }
  dialogVisible.value = false
}

/* ========== 导入到当前数据集 ========== */
const getCurrentFieldKeys = (ds) => {
  if (ds.rows?.length) return Object.keys(ds.rows[0].values || {})
  if (ds.historyRows?.length) return Object.keys(ds.historyRows[0].values || {})
  return null
}

const mapValuesToFields = (sourceValues, fieldKeys) => {
  if (!fieldKeys) return { ...sourceValues }
  const mapped = {}
  fieldKeys.forEach(k => { mapped[k] = sourceValues[k] ?? '' })
  return mapped
}

const onImportToCurrent = (row) => {
  const currentDs = tdStore.selectedDataset
  if (!currentDs) {
    ElMessage.warning('请先在数据集管理中选择一个数据集')
    return
  }
  const fieldKeys = getCurrentFieldKeys(currentDs)
  if (fieldKeys) {
    const overlap = Object.keys(row.values || {}).some(k => fieldKeys.includes(k))
    if (!overlap) {
      ElMessage.warning(`「${row._datasetName}」的字段与当前数据集不匹配，无法导入`)
      return
    }
  }
  const values = mapValuesToFields(row.values || {}, fieldKeys)
  tdStore.insertRowsAfter(currentDs.id, null, [{ label: row.label, values }])
  ElMessage.success(`已导入「${row.label}」到「${currentDs.name}」`)
}

const onBatchImport = () => {
  const currentDs = tdStore.selectedDataset
  if (!currentDs) {
    ElMessage.warning('请先在数据集管理中选择一个数据集')
    return
  }
  const fieldKeys = getCurrentFieldKeys(currentDs)
  const compatible = selectedRows.value.filter(r => {
    if (!fieldKeys) return true
    return Object.keys(r.values || {}).some(k => fieldKeys.includes(k))
  })
  if (compatible.length === 0) {
    ElMessage.warning('选中的历史数据字段与当前数据集不匹配，无法导入')
    return
  }
  const rowsData = compatible.map(r => ({
    label: r.label,
    values: mapValuesToFields(r.values || {}, fieldKeys)
  }))
  tdStore.insertRowsAfter(currentDs.id, null, rowsData)
  const skipped = selectedRows.value.length - compatible.length
  if (skipped > 0) {
    ElMessage.warning(`已导入 ${compatible.length} 条，${skipped} 条因字段不匹配被跳过`)
  } else {
    ElMessage.success(`已批量导入 ${rowsData.length} 条数据到「${currentDs.name}」`)
  }
  selectedRows.value = []
}

/* ========== 辅助 ========== */
const formatValues = (values) => {
  if (!values) return ''
  const entries = Object.entries(values)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}
</script>

<style scoped lang="scss">
.history-data-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.hdm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;

  &__left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.hdm-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.hdm-table-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.hdm-batch-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.text-secondary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.text-ph {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.remark-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
}

/* 键值对编辑器 */
.kv-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
