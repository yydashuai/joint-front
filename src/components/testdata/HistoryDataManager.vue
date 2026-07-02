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
        <el-table-column label="所属数据集" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row._datasetName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属模块" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-secondary">{{ row._moduleName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="行标签" width="180" show-overflow-tooltip />
        <el-table-column label="数据内容" min-width="300">
          <template #default="{ row }">
            <span class="mono text-secondary">{{ formatValues(row.values) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.source === '智能生成' ? 'warning' : 'success'"
              effect="plain"
            >{{ row.source }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="savedAt" label="保存日期" width="110" align="center" />
        <el-table-column label="" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="导入到当前数据集">
              <el-button text type="primary" size="small" :icon="Right" @click="onImportToCurrent(row)" />
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
      <el-button size="small" text type="danger" :icon="Delete" @click="onBatchDelete">批量删除</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, Delete, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
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
}

/* ========== 导入到当前数据集 ========== */
const onImportToCurrent = (row) => {
  const currentDs = tdStore.selectedDataset
  if (!currentDs) {
    ElMessage.warning('请先在数据集管理中选择一个数据集')
    return
  }
  tdStore.insertRowsAfter(currentDs.id, null, [{ label: row.label, values: { ...row.values } }])
  ElMessage.success(`已导入「${row.label}」到「${currentDs.name}」`)
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

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>
