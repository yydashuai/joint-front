<template>
  <div class="page test-data">
    <div class="page__header">
      <div>
        <h2>测试数据管理</h2>
      </div>
      <div class="header-actions">
        <!-- 各视图专属按钮：放在切换组左侧，避免切换组左右浮动 -->
        <el-button v-if="viewMode === 'dataset'" :icon="Upload" @click="openDataChainDialog()">导入数据链文件</el-button>
        <el-button v-if="viewMode === 'dataset'" :icon="FolderChecked" @click="showCombineDialog = true">组合导出/存为方案</el-button>
        <!-- 视图切换：固定靠右 -->
        <el-button-group class="view-switch">
          <el-button :type="viewMode === 'dataset' ? 'primary' : ''" @click="viewMode = 'dataset'">数据集管理</el-button>
          <el-button :type="viewMode === 'history' ? 'primary' : ''" @click="viewMode = 'history'">历史数据管理</el-button>
          <el-button :type="viewMode === 'files' ? 'primary' : ''" @click="viewMode = 'files'">数据文件管理</el-button>
        </el-button-group>
      </div>
    </div>

    <!-- ======== 数据集管理视图 ======== -->
    <div v-if="viewMode === 'dataset'" class="split">
      <!-- 左侧树：接口 → 报文 → 数据集 / 数据集方案 / 未关联报文 -->
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="dsSearch"
            placeholder="搜索接口 / 报文 / 数据集..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <DatasetTree
          v-model="selectedKey"
          title="测试数据集"
          :search="dsSearch"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <!-- 右侧内容区 -->
      <el-card class="main" shadow="never">
        <DatasetSchemeDetail
          v-if="currentScheme"
          :scheme="currentScheme"
          @edit="(scheme) => openSchemeDialog(scheme.systemId, scheme)"
          @remove="onRemoveScheme"
          @open-dataset="openDatasetFromScheme"
          @remove-dataset="onRemoveDatasetFromScheme"
        />

        <!-- 报文详情：选中报文时显示其数据集列表（1 报文 : N 数据集） -->
        <el-card v-else-if="currentMessage" shadow="never" class="msg-detail">
          <div class="msg-detail__head">
            <div class="msg-detail__title">
              <el-icon class="msg-detail__icon"><Document /></el-icon>
              <span class="msg-detail__name">{{ currentMessage.name }}</span>
              <el-tag size="small" type="info" effect="plain">{{ currentMessage.transportType || '—' }}</el-tag>
              <el-tag size="small" effect="plain">{{ messageFieldCount(currentMessage) }} 字段</el-tag>
            </div>
            <div class="msg-detail__ops">
              <el-button link type="primary" size="small" @click="goEditMessage(currentMessage)">配置报文</el-button>
            </div>
          </div>
          <div class="msg-detail__meta">
            所属接口：{{ ifaceOfMessage(currentMessage)?.name || '—' }}
            <span v-if="currentMessage.desc">· {{ currentMessage.desc }}</span>
          </div>
          <div class="msg-detail__list">
            <table class="msg-detail__table">
              <thead>
                <tr>
                  <th>数据集名称</th><th>行数</th><th class="ta-r">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in messageDatasets(currentMessage)" :key="d.id">
                  <td class="d-name">{{ d.name }}</td>
                  <td>{{ (d.rows || []).length }}</td>
                  <td class="ta-r d-ops">
                    <el-button link type="primary" size="small" @click="editDataset(d)">编辑</el-button>
                    <el-button link size="small" @click="copyDataset(d)">复制</el-button>
                    <el-button link type="danger" size="small" @click="removeDataset(d)">删除</el-button>
                  </td>
                </tr>
                <tr v-if="!messageDatasets(currentMessage).length">
                  <td colspan="3" class="d-empty">该报文暂无数据集，点击下方「新建数据集」创建</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="msg-detail__actions">
            <el-button type="primary" size="small" @click="openNewDataset(currentMessage)">+ 新建数据集</el-button>
            <el-button size="small" @click="openDataChainDialog()">导入数据链生成</el-button>
          </div>
        </el-card>

        <DatasetEditor
          v-else-if="currentDs"
          :dataset="currentDs"
          @delete="onDeleteDataset"
          @duplicate="onDuplicateDataset"
        />
        <el-empty v-else description="请选择左侧的数据集、报文或数据集方案" :image-size="80" />
      </el-card>
    </div>

    <!-- ======== 历史数据管理视图 ======== -->
    <el-card v-else-if="viewMode === 'history'" class="main history-main" shadow="never">
      <HistoryDataManager />
    </el-card>

    <!-- ======== 数据文件管理视图 ======== -->
    <el-card v-else class="main history-main" shadow="never">
      <ResourceFiles @upload="showUploadDialog = true" @download="onDownloadFile" @parse="onParseFile" />
    </el-card>

    <!-- ======== 对话框 ======== -->
    <CreateDatasetDialog
      v-model="showCreateDialog"
      :module="createModule"
      :message="createMessage"
      @created="onCreateDataset"
    />
    <UploadFileDialog
      v-model="showUploadDialog"
      @submitted="onUploadFile"
    />
    <DataChainImportDialog
      v-model="showDataChainDialog"
      :current-system-id="currentSystemId"
      :current-module-name="currentModuleName"
      :preset-file="dataChainPreset"
      @imported="onDataChainImported"
    />
    <DatasetSchemeDialog
      v-model="showSchemeDialog"
      :system-id="schemeDialogSystemId"
      :scheme="editingScheme"
      @confirm="onConfirmScheme"
    />
    <CombineExportDialog
      v-model="showCombineDialog"
      :system-id="currentSystemId"
      @saved="onCombineSaved"
    />
    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
      @saved="onIfaceSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Upload, Search, FolderChecked, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DatasetTree from '@/components/testdata/DatasetTree.vue'
import DatasetEditor from '@/components/testdata/DatasetEditor.vue'
import ResourceFiles from '@/components/testdata/ResourceFiles.vue'
import CreateDatasetDialog from '@/components/testdata/CreateDatasetDialog.vue'
import UploadFileDialog from '@/components/testdata/UploadFileDialog.vue'
import HistoryDataManager from '@/components/testdata/HistoryDataManager.vue'
import DataChainImportDialog from '@/components/testdata/DataChainImportDialog.vue'
import DatasetSchemeDialog from '@/components/testdata/DatasetSchemeDialog.vue'
import DatasetSchemeDetail from '@/components/testdata/DatasetSchemeDetail.vue'
import CombineExportDialog from '@/components/testdata/CombineExportDialog.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import { useTestDataStore } from '@/stores/testData'
import { downloadBlob } from '@/services/testDataService'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const connStore = useConnectionStore()
const systemStore = useSystemStore()
const schemeStore = useDatasetSchemeStore()
const router = useRouter()

/* ========== 视图切换 ========== */
const viewMode = ref('dataset') // 'dataset' | 'history' | 'files'

/* ========== 树选择 + 搜索 ========== */
const selectedKey = ref('')
const dsSearch = ref('')

const selectedSchemeId = ref(null)
const currentScheme = computed(() =>
  schemeStore.schemes.find((s) => s.id === selectedSchemeId.value) || null
)

/* ========== 选中解析：数据集 / 报文 / 接口 ========== */
const currentDs = computed(() => tdStore.selectedDataset)
const currentMessage = computed(() => {
  const m = selectedKey.value.match(/^msg-(.+)$/)
  if (!m) return null
  return protoStore.interfaces.find((i) => String(i.id) === String(m[1])) || null
})
const messageDatasets = (message) => tdStore.datasets.filter((d) => String(d.messageId) === String(message.id))
const ifaceOfMessage = (message) =>
  protoStore.testInterfaces.find((i) => String(i.id) === String(message?.ownerIfaceId)) || null
const messageFieldCount = (message) => (message?.protocolRefs || []).length

/* ========== 树事件 ========== */
const onTreeSelect = (data) => {
  if (!data?.ref) return
  selectedKey.value = data.key
  if (data.kind === 'dataset') {
    selectedSchemeId.value = null
    tdStore.select(data.ref.id)
  } else if (data.kind === 'scheme') {
    selectedSchemeId.value = data.ref.id
    tdStore.select(null)
  } else if (data.kind === 'message') {
    // 报文详情（右侧展示其数据集列表）
    selectedSchemeId.value = null
    tdStore.select(null)
  }
}

const onAddLeaf = ({ groupKind }) => {
  if (groupKind === 'scheme') openSchemeDialog(null, null)
  else if (groupKind === 'iface') openIfaceConfig()
}

/* ========== 数据集剪贴板 ========== */
const dsClipboard = ref(null)

const copyDataset = (ds) => {
  if (!ds) return
  dsClipboard.value = { data: JSON.parse(JSON.stringify(ds)) }
  ElMessage.success(`已复制「${ds.name}」`)
}

const pasteDatasetTo = (ds) => {
  if (!dsClipboard.value) {
    ElMessage.warning('剪贴板为空，请先复制一个数据集')
    return
  }
  const src = dsClipboard.value.data
  const message = ds?.messageId
    ? protoStore.interfaces.find((i) => String(i.id) === String(ds.messageId))
    : null
  const dup = tdStore.addDataset({
    name: `${src.name} (副本)`,
    desc: src.desc,
    systemId: message?.systemId || ds?.systemId || src.systemId,
    moduleName: message?.moduleId ? connStore.nodes.find((n) => String(n.id) === String(message.moduleId))?.name : ds?.moduleName || src.moduleName,
    linkedProtocol: src.linkedProtocol,
    linkedInterface: message?.name || src.linkedInterface,
    messageId: message?.id || src.messageId
  })
  dup.rows = JSON.parse(JSON.stringify(src.rows)).map(r => ({ ...r, id: Date.now() + Math.random() * 1000 }))
  selectedKey.value = `ds-${dup.id}`
  tdStore.select(dup.id)
  ElMessage.success(`已粘贴为「${dup.name}」`)
}

const removeDataset = (ds) => {
  if (!ds) return
  ElMessageBox.confirm(`确定删除数据集「${ds.name}」吗？删除后不可恢复。`, '删除数据集', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  }).then(() => {
    tdStore.removeDataset(ds.id)
    selectedKey.value = ''
    ElMessage.success('数据集已删除')
  }).catch(() => {})
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  if (action === 'edit-dataset') {
    selectedSchemeId.value = null
    tdStore.select(data.ref.id)
    selectedKey.value = `ds-${data.ref.id}`
  }
  if (action === 'copy-dataset') copyDataset(data.ref)
  if (action === 'paste-dataset') pasteDatasetTo(data.ref)
  if (action === 'delete-dataset') removeDataset(data.ref)
  if (action === 'new-dataset') openNewDataset(data.ref) // data.ref = 报文
  if (action === 'config-message') goEditMessage(data.ref)
  if (action === 'config-iface') openIfaceConfig(data.ref.id)
  if (action === 'add-message') openIfaceConfig(data.ref.id)
  if (action === 'edit-scheme') openSchemeDialog(data.ref.systemId, data.ref)
  if (action === 'delete-scheme') onRemoveScheme(data.ref)
}

/* ========== 新建数据集（支持从报文创建） ========== */
const showCreateDialog = ref(false)
const createModule = ref(null)
const createMessage = ref(null)

const openNewDataset = (message) => {
  createModule.value = null
  createMessage.value = message || null
  showCreateDialog.value = true
}

const onCreateDataset = (data) => {
  const ds = tdStore.addDataset(data)

  // 从报文创建：按报文字段约束生成初始行（fixed→固定值、enum→首项、range→最小值）
  if (ds.messageId) {
    const message = protoStore.interfaces.find((i) => String(i.id) === String(ds.messageId))
    if (message) {
      const fields = collectInterfaceDatasetFields(message, protoStore.protocols)
      const initValues = {}
      fields.forEach((f) => {
        const c = f.constraint
        if (c?.mode === 'fixed') initValues[f.name] = c.value
        else if (c?.mode === 'enum') initValues[f.name] = c.entries?.[0]?.value ?? c.entries?.[0] ?? 0
        else if (c?.mode === 'range') initValues[f.name] = Number.isFinite(c.min) ? c.min : 0
        else initValues[f.name] = ''
      })
      if (Object.keys(initValues).length) ds.rows.push({ id: Date.now(), label: '初始行', values: initValues })
    }
  } else {
    // 兼容旧链路：linkedProtocol（协议字段）初始化初始行
    const flattenProtoFields = (fields) => {
      const result = []
      fields.forEach(f => {
        if (f.kind === 'byte') {
          if (f.bitMode && f.children?.length) f.children.forEach(bit => { if (bit.name) result.push({ name: bit.name, constraint: bit.constraint }) })
          else if (f.name) result.push({ name: f.name, constraint: f.constraint })
        } else if (f.kind === 'bit' && f.name) {
          result.push({ name: f.name, constraint: f.constraint })
        } else if (f.kind === 'repeat' && f.children?.length) {
          result.push(...flattenProtoFields(f.children))
        }
      })
      return result
    }
    if (ds.linkedProtocol) {
      const proto = protoStore.protocols.find(p => p.name === ds.linkedProtocol)
      if (proto?.config?.fields?.length) {
        const flatFields = flattenProtoFields(proto.config.fields)
        const initValues = {}
        flatFields.forEach(f => {
          if (f.constraint?.mode === 'fixed') initValues[f.name] = f.constraint.value
          else if (f.constraint?.mode === 'enum') initValues[f.name] = f.constraint.entries?.[0]?.value ?? f.constraint.entries?.[0] ?? 0
          else initValues[f.name] = 0
        })
        ds.rows.push({ id: Date.now(), label: '初始行', values: initValues })
      }
    }
  }

  selectedKey.value = `ds-${ds.id}`
  ElMessage.success('数据集已创建')
  if (!ds.linkedInterface && !ds.linkedProtocol) {
    ElMessage.warning('未关联字段或报文，数据集暂无数据列，建议重新创建并关联')
  }
}

/* ========== 当前数据集操作 ========== */
const editDataset = (ds) => {
  if (!ds) return
  selectedSchemeId.value = null
  tdStore.select(ds.id)
  selectedKey.value = `ds-${ds.id}`
}
const onDeleteDataset = (id) => {
  tdStore.removeDataset(id)
  ElMessage.success('数据集已删除')
}
const onDuplicateDataset = (dup) => {
  selectedKey.value = `ds-${dup.id}`
}

/* ========== 报文 / 接口跳转与配置 ========== */
const goEditMessage = (message) => {
  if (!message) return
  protoStore.selectedInterfaceId = message.id
  if (message.systemId) systemStore.setCurrent(message.systemId)
  router.push({ path: '/protocol', query: { kind: 'interface', iface: String(message.id) } })
}

const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const openIfaceConfig = (id = null) => {
  ifaceConfigId.value = id
  ifaceConfigVisible.value = true
}
const onIfaceSaved = (id) => {
  if (!id) return
  selectedSchemeId.value = null
  tdStore.select(null)
  selectedKey.value = `iface-${id}`
}

/* ========== 数据文件 ========== */
const onDownloadFile = (file) => {
  if (file.content) {
    downloadBlob(new Blob([file.content], { type: 'text/plain;charset=utf-8' }), file.name)
    ElMessage.success(`已下载：${file.name}`)
  } else {
    ElMessage.success(`模拟下载：${file.name}`)
  }
}

const showUploadDialog = ref(false)

const onUploadFile = (data) => {
  // 上传仅登记到文件列表（不关联系统/模块），需要时在文件管理中手动「解析」
  const file = tdStore.addFile(data)
  ElMessage.success(`文件「${file.name}」已导入文件列表`)
}

/* ========== 数据链文件导入 ========== */
const showDataChainDialog = ref(false)
const dataChainPreset = ref(null)

// 默认归属：取连接树当前选中节点（系统 + 模块）
const currentSystemId = computed(() => connStore.selected?.systemId ?? systemStore.currentId ?? '')
const currentModuleName = computed(() => connStore.selected?.name ?? '')

const openDataChainDialog = (preset = null) => {
  dataChainPreset.value = preset
  showDataChainDialog.value = true
}

// 数据文件管理 →「解析」：预载文件内容打开导入对话框
const onParseFile = (file) => {
  if (!file?.content) {
    ElMessage.warning('该文件未保留文本内容，无法解析（仅通过数据链导入登记的文件支持解析）')
    return
  }
  openDataChainDialog({
    name: file.name,
    content: file.content,
    systemId: file.systemId || '',
    moduleName: file.moduleName || ''
  })
}

const onDataChainImported = (datasetIds) => {
  if (datasetIds?.length) {
    const firstId = datasetIds[0]
    tdStore.select(firstId)
    selectedKey.value = `ds-${firstId}`
    viewMode.value = 'dataset'
  }
}

/* ========== 组合导出 / 存为方案 ========== */
const showCombineDialog = ref(false)

const onCombineSaved = (scheme) => {
  // 保存为方案后直接定位到该方案详情
  selectedSchemeId.value = scheme.id
  selectedKey.value = `dsScheme-${scheme.id}`
  tdStore.select(null)
}

/* ========== 数据集方案 弹窗与操作 ========== */
const showSchemeDialog = ref(false)
const editingScheme = ref(null)
const schemeDialogSystemId = ref(null)

const openSchemeDialog = (systemId, scheme) => {
  schemeDialogSystemId.value = systemId
  editingScheme.value = scheme
  showSchemeDialog.value = true
}

const onConfirmScheme = (payload) => {
  if (editingScheme.value) {
    schemeStore.update(editingScheme.value.id, payload)
    ElMessage.success('数据集方案已更新')
  } else {
    schemeStore.add(payload)
    ElMessage.success('数据集方案已创建')
  }
}

const onRemoveScheme = (scheme) => {
  schemeStore.remove(scheme.id)
  if (selectedSchemeId.value === scheme.id) selectedSchemeId.value = null
  ElMessage.success('数据集方案已删除')
}

const openDatasetFromScheme = (datasetId) => {
  selectedSchemeId.value = null
  tdStore.select(datasetId)
  selectedKey.value = `ds-${datasetId}`
}

const onRemoveDatasetFromScheme = (datasetId) => {
  if (selectedSchemeId.value) schemeStore.removeDataset(selectedSchemeId.value, datasetId)
}

/* ========== 初始化 ========== */
// 报文归属迁移（linkedInterface 报文名 → messageId）
onMounted(() => {
  tdStore.migrateMessageLink()
  const demoScheme = schemeStore.schemes.find(s => s.id === 'dsScheme-6002')
  if (demoScheme && !demoScheme.datasetIds.length) {
    const ds = tdStore.datasets.filter(d => d.systemId === 'sys-weapon').slice(0, 3)
    if (ds.length) schemeStore.update(demoScheme.id, { datasetIds: ds.map(d => d.id) })
  }
})

// 自动选中第一个数据集
if (tdStore.datasets.length > 0 && !tdStore.selectedDatasetId) {
  tdStore.select(tdStore.datasets[0].id)
  selectedKey.value = `ds-${tdStore.datasets[0].id}`
}

// 数据集列表变化时（删除后），保持选中有效
watch(() => tdStore.datasets.length, () => {
  if (tdStore.selectedDatasetId && !tdStore.datasets.find(d => d.id === tdStore.selectedDatasetId)) {
    if (tdStore.datasets.length > 0) {
      tdStore.select(tdStore.datasets[0].id)
      selectedKey.value = `ds-${tdStore.datasets[0].id}`
    } else {
      tdStore.select(null)
      selectedKey.value = ''
    }
  }
})
</script>

<style scoped lang="scss">
.test-data {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* 左侧树面板 */
.tree-panel {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.tree-search {
  width: 100%;
  min-width: 0;
  flex-shrink: 0;
  :deep(.el-input) { width: 100%; }
}

:deep(.dtree) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.dtree > .el-card__body) {
  min-height: 0;
  overflow: hidden;
}

/* 右侧主区 */
.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: auto;
  }
}

/* 历史/资源文件视图占满 */
.history-main {
  :deep(.el-card__body) {
    overflow: hidden;
  }
}

/* 报文详情卡片 */
.msg-detail {
  flex-shrink: 0;
  border-radius: 8px;
  :deep(.el-card__body) { padding: 12px 16px; }
  &__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  &__title { display: flex; align-items: center; gap: 8px; min-width: 0; }
  &__icon { color: var(--el-color-success); font-size: 15px; }
  &__name { font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__meta { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__list { margin-top: 10px; max-height: 260px; overflow: auto; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; }
  &__table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 12px;
    th, td { padding: 6px 10px; text-align: left; }
    thead th { color: var(--el-text-color-secondary); background: var(--el-fill-color-light); font-weight: 500; position: sticky; top: 0; }
    tbody tr { border-top: 1px solid var(--el-border-color-lighter); }
    tbody tr:hover { background: var(--el-fill-color-extra-light); }
    .d-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .d-empty { color: var(--el-text-color-placeholder); text-align: center; padding: 12px 0; }
    .d-ops { white-space: nowrap; }
  }
  &__actions { margin-top: 10px; display: flex; gap: 8px; }
}
.ta-r { text-align: right !important; }
</style>
