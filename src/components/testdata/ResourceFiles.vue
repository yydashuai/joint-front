<template>
  <div class="resource-files">
    <div class="files-header">
      <h3>测试资源文件</h3>
      <div class="files-toolbar">
        <!-- 搜索 (优化点 15) -->
        <el-input
          v-model="searchText"
          placeholder="搜索文件名..."
          :prefix-icon="Search"
          size="small"
          clearable
          style="width: 200px;"
        />
        <!-- 格式过滤 -->
        <el-select v-model="filterFormat" placeholder="全部格式" clearable size="small" style="width: 110px;">
          <el-option label="CSV" value="csv" />
          <el-option label="JSON" value="json" />
          <el-option label="二进制" value="bin" />
          <el-option label="XML" value="xml" />
        </el-select>
        <el-button size="small" :icon="Upload" @click="$emit('upload')">上传文件</el-button>
      </div>
    </div>

    <!-- 空状态 (优化点 14) -->
    <el-empty v-if="filteredFiles.length === 0 && !searchText && !filterFormat" description="暂无资源文件，点击上方按钮上传" :image-size="60" />
    <el-empty v-else-if="filteredFiles.length === 0" description="没有匹配的文件" :image-size="60" />

    <!-- 文件表格 (优化点 15: 排序) -->
    <el-table
      v-else
      :data="filteredFiles"
      size="small"
      border
      :default-sort="{ prop: 'uploadedAt', order: 'descending' }"
      @sort-change="onSortChange"
    >
      <el-table-column label="文件名" min-width="220" sortable="custom" prop="name">
        <template #default="{ row }">
          <div class="file-name">
            <el-icon :color="formatColor(row.format)"><Document /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="关联模块" width="180" sortable="custom" prop="moduleName">
        <template #default="{ row }">
          <span class="text-sub">{{ row.moduleName || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="格式" width="80" align="center" sortable="custom" prop="format">
        <template #default="{ row }">
          <el-tag :type="formatTag(row.format)" size="small" effect="plain">{{ row.format.toUpperCase() }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="90" align="right" sortable="custom" prop="size">
        <template #default="{ row }">
          <span class="mono">{{ formatSize(row.size) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="行数" width="70" align="center" sortable="custom" prop="rowCount">
        <template #default="{ row }">
          <span v-if="row.rowCount" class="mono">{{ row.rowCount }}</span>
          <span v-else class="text-ph">—</span>
        </template>
      </el-table-column>
      <el-table-column label="上传时间" width="150" sortable="custom" prop="uploadedAt" />
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="$emit('download', row)">下载</el-button>
          <el-popconfirm title="确认删除此文件？" @confirm="tdStore.removeFile(row.id)">
            <template #reference>
              <el-button size="small" text type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Upload, Document, Search } from '@element-plus/icons-vue'
import { useTestDataStore } from '@/stores/testData'
import { formatFileSize } from '@/services/testDataService'

defineEmits(['upload', 'download'])

const tdStore = useTestDataStore()

const searchText = ref('')
const filterFormat = ref('')
const sortProp = ref('uploadedAt')
const sortOrder = ref('descending')

const filteredFiles = computed(() => {
  let list = [...tdStore.allFiles]

  // 搜索过滤
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(kw))
  }
  // 格式过滤
  if (filterFormat.value) {
    list = list.filter(f => f.format === filterFormat.value)
  }
  // 排序
  if (sortProp.value) {
    list.sort((a, b) => {
      const va = a[sortProp.value]
      const vb = b[sortProp.value]
      const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''))
      return sortOrder.value === 'ascending' ? cmp : -cmp
    })
  }
  return list
})

const onSortChange = ({ prop, order }) => {
  sortProp.value = prop
  sortOrder.value = order || 'ascending'
}

const formatColor = (fmt) => ({ csv: '#52c41a', json: '#faad14', bin: '#8b9dc3', xml: '#2f6feb' }[fmt] || '#999')
const formatTag = (fmt) => ({ csv: 'success', json: 'warning', bin: 'info', xml: '' }[fmt] || 'info')
const formatSize = (bytes) => formatFileSize(bytes)
</script>

<style scoped lang="scss">
.resource-files {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  h3 { margin: 0; font-size: 15px; font-weight: 600; }
}

.files-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.text-ph {
  color: var(--el-text-color-placeholder);
}
</style>
