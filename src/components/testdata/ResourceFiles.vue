<template>
  <div class="resource-files">
    <div class="files-header">
      <h3>数据文件管理</h3>
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
          <el-option label="BIN" value="bin" />
          <el-option label="XML" value="xml" />
        </el-select>
        <el-cascader
          v-model="relationFilter"
          :options="relationOptions"
          :props="relationCascaderProps"
          placeholder="接口 / 报文"
          filterable
          clearable
          size="small"
          style="width: 230px;"
        />
        <el-button size="small" :icon="Upload" @click="$emit('upload')">上传文件</el-button>
      </div>
    </div>

    <div v-if="focusedFile" class="file-focus">
      <span>已定位来源文件</span>
      <strong>{{ focusedFile.name }}</strong>
      <span>包含 {{ focusedFile.messageNames?.length || 0 }} 个报文、{{ focusedFile.rowCount || 0 }} 行数据</span>
    </div>

    <!-- 空状态 (优化点 14) -->
    <el-empty v-if="filteredFiles.length === 0 && !searchText && !filterFormat && !relationFilter.length" description="暂无数据文件，点击上方按钮上传" :image-size="60" />
    <el-empty v-else-if="filteredFiles.length === 0" description="没有匹配的文件" :image-size="60" />

    <!-- 文件表格 (优化点 15: 排序) -->
    <el-table
      v-else
      :data="filteredFiles"
      size="small"
      border
      :default-sort="{ prop: 'uploadedAt', order: 'descending' }"
      :row-class-name="fileRowClass"
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
      <el-table-column label="关联报文" min-width="180" sortable="custom" prop="messageNames">
        <template #default="{ row }">
          <div class="message-cell" :title="(row.messageNames || []).join('、')">
            <el-tag v-for="name in (row.messageNames || []).slice(0, 2)" :key="name" size="small" effect="plain">{{ name }}</el-tag>
            <span v-if="(row.messageNames || []).length > 2" class="text-sub">+{{ row.messageNames.length - 2 }}</span>
            <span v-if="!row.messageNames?.length" class="text-ph">尚未关联</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="接口" min-width="150" sortable="custom" prop="interfaceNames">
        <template #default="{ row }">
          <div class="interface-cell" :title="interfaceNames(row).join('、')">
            <div class="message-cell">
              <el-tag v-for="name in interfaceNames(row).slice(0, 2)" :key="name" size="small" type="success" effect="plain">{{ name }}</el-tag>
              <span v-if="interfaceNames(row).length > 2" class="text-sub">+{{ interfaceNames(row).length - 2 }}</span>
              <span v-if="!interfaceNames(row).length" class="text-ph">尚未关联</span>
            </div>
            <el-button link type="primary" size="small" @click="openInterfaceConfig(row)">配置</el-button>
          </div>
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
      <el-table-column label="操作" width="240" align="center">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openFileDetail(row)">查看</el-button>
          <el-button size="small" text type="primary" @click="$emit('download', row)">下载</el-button>
          <el-tooltip :disabled="!!row.content" content="该文件未保留文本内容，无法解析" placement="top">
            <span>
              <el-button size="small" text type="success" :disabled="!row.content" @click="requestParse(row)">解析</el-button>
            </span>
          </el-tooltip>
          <el-popconfirm title="确认删除此文件？" @confirm="tdStore.removeFile(row.id)">
            <template #reference>
              <el-button size="small" text type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailVisible" :title="detailFile?.name || '文件数据详情'" size="72%">
      <template v-if="detailFile">
        <el-descriptions :column="4" border size="small" class="file-meta">
          <el-descriptions-item label="格式">{{ detailFile.format.toUpperCase() }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatSize(detailFile.size) }}</el-descriptions-item>
          <el-descriptions-item label="报文数">{{ detailBlocks.length || detailFile.messageNames?.length || 0 }}</el-descriptions-item>
          <el-descriptions-item label="数据行">{{ detailFile.rowCount || 0 }}</el-descriptions-item>
        </el-descriptions>

        <div v-for="block in detailBlocks" :key="block.datasetId" class="message-block">
          <div class="message-block__head">
            <span class="message-block__index">报文名</span>
            <strong>{{ block.messageName }}</strong>
            <el-tag size="small" effect="plain">{{ block.rows.length }} 行</el-tag>
          </div>
          <el-table :data="block.rows" border size="small" max-height="320">
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column v-for="header in block.headers" :key="header" :prop="header" :label="header" min-width="120" show-overflow-tooltip />
          </el-table>
        </div>

        <div v-if="!detailBlocks.length" class="raw-file">
          <div class="raw-file__title">文件原文</div>
          <pre>{{ detailFile.content || '该文件暂无可预览内容' }}</pre>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="interfaceDialogVisible" title="配置关联接口" width="520px" append-to-body>
      <div class="config-file">
        <el-icon><Document /></el-icon>
        <div><strong>{{ interfaceFile?.name }}</strong><span>选择该文件解析后报文的归属接口</span></div>
      </div>
      <el-form label-position="top">
        <el-form-item label="关联接口">
          <el-select
            v-model="interfaceDraftId"
            filterable
            clearable
            placeholder="选择文件归属接口；也可以保持为空"
            style="width: 100%;"
          >
            <el-option v-for="item in interfaceOptions" :key="item.id" :label="item.name" :value="item.id" />
            <template #footer>
              <button class="interface-add" type="button" @click="emit('add-interface')">＋ 添加接口</button>
            </template>
          </el-select>
        </el-form-item>
      </el-form>
      <div class="config-hint">配置接口只建立文件归属；文件解析后，关联报文会单独显示。</div>
      <template #footer>
        <el-button @click="interfaceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveInterfaceConfig">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Upload, Document, Search } from '@element-plus/icons-vue'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore } from '@/stores/protocol'
import { formatFileSize } from '@/services/testDataService'
import { ElMessage } from 'element-plus'

const props = defineProps({
  focusFileId: { type: [String, Number], default: null },
  createdInterfaceId: { type: [String, Number], default: null }
})
const emit = defineEmits(['upload', 'download', 'parse', 'add-interface'])

const tdStore = useTestDataStore()
const protocolStore = useProtocolStore()

const searchText = ref('')
const filterFormat = ref('')
const relationFilter = ref([])
const sortProp = ref('uploadedAt')
const sortOrder = ref('descending')
const detailVisible = ref(false)
const detailFile = ref(null)
const interfaceDialogVisible = ref(false)
const interfaceFile = ref(null)
const interfaceDraftId = ref('')
const interfaceOptions = computed(() => [...protocolStore.testInterfaces].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))
const relationCascaderProps = { expandTrigger: 'hover' }
const relationOptions = computed(() => interfaceOptions.value.map((iface) => {
  const messages = (iface.messageIds || [])
    .map((id) => protocolStore.interfaces.find((message) => String(message.id) === String(id)))
    .filter(Boolean)
  return {
    value: String(iface.id),
    label: iface.name,
    children: [
      { value: `all:${iface.id}`, label: '全部报文' },
      ...messages.map((message) => ({ value: `message:${message.id}`, label: message.name })),
    ],
  }
}))
const focusedFile = computed(() => tdStore.allFiles.find((file) => String(file.id) === String(props.focusFileId)) || null)
const detailBlocks = computed(() => {
  if (!detailFile.value) return []
  return tdStore.datasets
    .filter((dataset) => String(dataset.sourceFileId) === String(detailFile.value.id))
    .map((dataset) => {
      const historyRows = (dataset.historyRows || []).filter((row) =>
        row.source === '文件导入' && String(row.fileId ?? dataset.sourceFileId) === String(detailFile.value.id)
      )
      const sourceRows = historyRows.length ? historyRows : (dataset.rows || [])
      const rows = sourceRows.map((row) => ({ ...(row.values || {}) }))
      return {
        datasetId: dataset.id,
        messageName: dataset.linkedInterface || dataset.name,
        headers: rows[0] ? Object.keys(rows[0]) : [],
        rows,
      }
    })
})

watch(focusedFile, (file) => {
  if (file) searchText.value = file.name
}, { immediate: true })
watch(() => props.createdInterfaceId, (id) => {
  if (id != null && interfaceDialogVisible.value) interfaceDraftId.value = id
})

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
  if (relationFilter.value?.length === 2) {
    const [ifaceId, target] = relationFilter.value
    if (String(target).startsWith('all:')) {
      list = list.filter((file) => interfaceIds(file).some((id) => String(id) === String(ifaceId)))
    } else if (String(target).startsWith('message:')) {
      const messageId = String(target).slice('message:'.length)
      const message = protocolStore.interfaces.find((item) => String(item.id) === messageId)
      list = list.filter((file) =>
        (file.messageIds || []).some((id) => String(id) === messageId) ||
        (!!message?.name && (file.messageNames || []).includes(message.name))
      )
    }
  }
  // 排序
  if (sortProp.value) {
    list.sort((a, b) => {
      const va = sortValue(a, sortProp.value)
      const vb = sortValue(b, sortProp.value)
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
const fileRowClass = ({ row }) => String(row.id) === String(props.focusFileId) ? 'is-source-file' : ''
const interfaceNames = (file) => {
  const names = [...(file.interfaceNames || [])]
  const messageIds = new Set((file.messageIds || []).map(String))
  const messageNames = new Set(file.messageNames || [])
  protocolStore.interfaces
    .filter((message) => messageIds.has(String(message.id)) || messageNames.has(message.name))
    .forEach((message) => {
      const iface = protocolStore.testInterfaces.find((item) => String(item.id) === String(message.ownerIfaceId))
      if (iface?.name && !names.includes(iface.name)) names.push(iface.name)
    })
  return names
}
const interfaceIds = (file) => {
  const ids = [...(file.interfaceIds || [])]
  const messageIds = new Set((file.messageIds || []).map(String))
  const messageNames = new Set(file.messageNames || [])
  protocolStore.interfaces
    .filter((message) => messageIds.has(String(message.id)) || messageNames.has(message.name))
    .forEach((message) => {
      if (message.ownerIfaceId != null && !ids.some((id) => String(id) === String(message.ownerIfaceId))) ids.push(message.ownerIfaceId)
    })
  return ids
}
const sortValue = (file, prop) => {
  if (prop === 'messageNames') return (file.messageNames || []).join('、')
  if (prop === 'interfaceNames') return interfaceNames(file).join('、')
  return file[prop]
}
const openInterfaceConfig = (file) => {
  interfaceFile.value = file
  interfaceDraftId.value = interfaceIds(file)[0] || ''
  interfaceDialogVisible.value = true
}
const saveInterfaceConfig = () => {
  if (!interfaceFile.value) return
  tdStore.setFileInterfaces(interfaceFile.value.id, interfaceDraftId.value ? [interfaceDraftId.value] : [])
  interfaceDialogVisible.value = false
  ElMessage.success('文件关联接口已更新')
}
const requestParse = (file) => {
  if (!interfaceIds(file).length) {
    ElMessage.warning('请先为文件配置关联接口，再进行解析')
    openInterfaceConfig(file)
    return
  }
  emit('parse', file)
}
const openFileDetail = (file) => {
  detailFile.value = file
  detailVisible.value = true
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

.file-focus { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #b8d2ff; border-radius: 6px; background: #f2f7ff; color: var(--el-text-color-secondary); font-size: 12px; }
.file-focus strong { color: var(--el-color-primary); }
.message-cell { display: flex; min-width: 0; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; }
.interface-cell { display: flex; min-width: 0; align-items: center; gap: 8px; }
.interface-cell .message-cell { flex: 1; }
:deep(.el-table .is-source-file > td.el-table__cell) { background: #edf5ff !important; }
.file-meta { margin-bottom: 18px; }
.message-block { margin-bottom: 20px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; overflow: hidden; }
.message-block__head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--el-fill-color-light); }
.message-block__head strong { color: var(--el-color-primary); }
.message-block__head .el-tag { margin-left: auto; }
.message-block__index { color: var(--el-text-color-secondary); font-size: 12px; }
.raw-file__title { margin-bottom: 8px; font-weight: 600; }
.raw-file pre { max-height: 520px; margin: 0; overflow: auto; padding: 14px; border-radius: 7px; background: #111827; color: #dbeafe; font: 12px/1.7 Consolas, monospace; white-space: pre-wrap; }
.config-file { margin-bottom: 18px; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid #cfe0ff; border-radius: 7px; background: #f5f8ff; }
.config-file .el-icon { color: var(--el-color-primary); font-size: 20px; }
.config-file div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.config-file strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.config-file span, .config-hint { color: var(--el-text-color-secondary); font-size: 12px; }
.config-hint { margin-top: -4px; line-height: 1.5; }
.interface-add { width: 100%; border: 0; padding: 7px 10px; background: transparent; color: var(--el-color-primary); cursor: pointer; font: inherit; text-align: left; }
.interface-add:hover { background: var(--el-fill-color-light); }

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
