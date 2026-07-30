<template>
  <div class="page test-data">
    <div class="page__header">
      <div>
        <h2>测试数据管理</h2>
        <div class="page__desc">构造基于字段/报文的测试报文数据集，管理数据文件</div>
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
      <!-- 左侧树 -->
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="dsSearch"
            placeholder="搜索数据集..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="测试数据集"
          :leaf-groups="leafGroups"
          :extra-system-children="extraSystemChildren"
          :leaf-context-actions="leafContextActions"
          :module-context-actions="moduleContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
          @module-action="onModuleAction"
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
        <DatasetEditor
          v-else-if="currentDs"
          :dataset="currentDs"
          @delete="onDeleteDataset"
          @duplicate="onDuplicateDataset"
        />
        <el-empty v-else description="请选择左侧的数据集或数据集方案" :image-size="80" />
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Upload, Search, FolderChecked } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import DatasetEditor from '@/components/testdata/DatasetEditor.vue'
import ResourceFiles from '@/components/testdata/ResourceFiles.vue'
import CreateDatasetDialog from '@/components/testdata/CreateDatasetDialog.vue'
import UploadFileDialog from '@/components/testdata/UploadFileDialog.vue'
import HistoryDataManager from '@/components/testdata/HistoryDataManager.vue'
import DataChainImportDialog from '@/components/testdata/DataChainImportDialog.vue'
import DatasetSchemeDialog from '@/components/testdata/DatasetSchemeDialog.vue'
import DatasetSchemeDetail from '@/components/testdata/DatasetSchemeDetail.vue'
import CombineExportDialog from '@/components/testdata/CombineExportDialog.vue'
import { useTestDataStore } from '@/stores/testData'
import { downloadBlob } from '@/services/testDataService'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const connStore = useConnectionStore()
const systemStore = useSystemStore()
const schemeStore = useDatasetSchemeStore()

/* ========== 视图切换 ========== */
const viewMode = ref('dataset') // 'dataset' | 'history' | 'files'

/* ========== 树选择 + 搜索 ========== */
const selectedKey = ref('')
const dsSearch = ref('')

const selectedSchemeId = ref(null)
const currentScheme = computed(() =>
  schemeStore.schemes.find((s) => s.id === selectedSchemeId.value) || null
)

/* ========== 数据集方案：与「测试数据集」同级的树节点 ========== */
const extraSystemChildren = (sys) => {
  const schemes = schemeStore.schemesOfSystem(sys.id)
  return [{
    key: `dsSchemes-${sys.id}`,
    kind: 'schemeGroup',
    icon: 'FolderOpened',
    label: '测试数据集方案',
    ref: { id: `dsSchemes-${sys.id}`, systemId: sys.id },
    addActions: [{ groupKind: 'datasetScheme', label: '+方案', type: 'warning' }],
    children: schemes.map((s) => ({
      key: `dsScheme-${s.id}`,
      kind: 'scheme',
      icon: 'Notebook',
      label: s.name,
      badge: `${s.datasetIds.length} 数据集`,
      ref: s,
    })),
  }]
}

const leafGroups = (module) => {
  let datasets = tdStore.datasets.filter(d => d.moduleName === module.name && d.systemId === module.systemId)

  if (dsSearch.value) {
    const kw = dsSearch.value.toLowerCase()
    datasets = datasets.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      (d.desc && d.desc.toLowerCase().includes(kw))
    )
  }

  return [{
    flat: true,
    kind: 'dataset',
    addLabel: '+数据集',
    addType: 'primary',
    items: datasets.map(ds => ({
      key: `ds-${ds.id}`,
      kind: 'dataset',
      icon: 'Document',
      label: ds.name,
      badge: ds.rows.length > 0 ? `${ds.rows.length}行` : undefined,
      ref: ds
    }))
  }]
}

const onTreeSelect = (data) => {
  if (data.kind === 'scheme' && data.ref) {
    selectedSchemeId.value = data.ref.id
    tdStore.select(null)
  } else if (data.kind === 'dataset' && data.ref) {
    selectedSchemeId.value = null
    tdStore.select(data.ref.id)
  } else {
    selectedSchemeId.value = null
    tdStore.select(null)
  }
}

const onDeleteLeaf = (data) => {
  if (data.kind === 'dataset' && data.ref) {
    tdStore.removeDataset(data.ref.id)
    ElMessage.success('数据集已删除')
  }
}

/* ========== 数据集剪贴板 ========== */
const dsClipboard = ref(null)

const leafContextActions = (nodeData) => {
  if (!nodeData?.ref || nodeData.kind !== 'dataset') return []
  return [
    { label: '复制数据集', action: 'copy-dataset' },
    { label: '复制并粘贴到当前模块', action: 'paste-dataset' }
  ]
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  const ds = data.ref

  if (action === 'copy-dataset') {
    dsClipboard.value = { data: JSON.parse(JSON.stringify(ds)) }
    ElMessage.success(`已复制「${ds.name}」`)
  }

  if (action === 'paste-dataset') {
    if (!dsClipboard.value) {
      ElMessage.warning('剪贴板为空，请先复制一个数据集')
      return
    }
    const src = dsClipboard.value.data
    const dup = tdStore.addDataset({
      name: `${src.name} (副本)`,
      desc: src.desc,
      systemId: ds.systemId,
      moduleName: ds.moduleName,
      linkedProtocol: src.linkedProtocol,
      linkedInterface: src.linkedInterface
    })
    dup.rows = JSON.parse(JSON.stringify(src.rows)).map(r => ({ ...r, id: Date.now() + Math.random() * 1000 }))
    selectedKey.value = `ds-${dup.id}`
    ElMessage.success(`已粘贴为「${dup.name}」`)
  }
}

const moduleContextActions = () => {
  const actions = []
  if (dsClipboard.value) {
    actions.push({ label: `粘贴数据集「${dsClipboard.value.data.name}」`, action: 'paste-dataset' })
  }
  return actions
}

const onModuleAction = ({ action, data }) => {
  if (action === 'paste-dataset') {
    if (!dsClipboard.value) {
      ElMessage.warning('剪贴板为空，请先复制一个数据集')
      return
    }
    const mod = data.ref
    const src = dsClipboard.value.data
    const dup = tdStore.addDataset({
      name: `${src.name} (副本)`,
      desc: src.desc,
      systemId: mod.systemId,
      moduleName: mod.name,
      linkedProtocol: src.linkedProtocol,
      linkedInterface: src.linkedInterface
    })
    dup.rows = JSON.parse(JSON.stringify(src.rows)).map(r => ({ ...r, id: Date.now() + Math.random() * 1000 }))
    selectedKey.value = `ds-${dup.id}`
    ElMessage.success(`已粘贴为「${dup.name}」`)
  }
}

/* ========== 新建数据集 ========== */
const showCreateDialog = ref(false)
const createModule = ref(null)

const onAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'datasetScheme') {
    openSchemeDialog(module.systemId || module.id, null)
    return
  }
  createModule.value = { systemId: module.systemId, name: module.name }
  showCreateDialog.value = true
}

const onCreateDataset = (data) => {
  const ds = tdStore.addDataset(data)

  const flattenProtoFields = (fields) => {
    const result = []
    fields.forEach(f => {
      if (f.kind === 'byte') {
        if (f.bitMode && f.children?.length) {
          f.children.forEach(bit => {
            if (bit.name) result.push({ name: bit.name, constraint: bit.constraint })
          })
        } else if (f.name) {
          result.push({ name: f.name, constraint: f.constraint })
        }
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
        if (f.constraint?.mode === 'fixed') {
          initValues[f.name] = f.constraint.value
        } else if (f.constraint?.mode === 'enum') {
          initValues[f.name] = f.constraint.entries?.[0]?.value ?? f.constraint.entries?.[0] ?? 0
        } else {
          initValues[f.name] = 0
        }
      })
      ds.rows.push({ id: Date.now(), label: '初始行', values: initValues })
    }
  } else if (ds.linkedInterface) {
    const iface = protoStore.interfaces.find(i => i.name === ds.linkedInterface)
    if (iface) {
      const initValues = {}
      const flatten = (params) => {
        params.forEach(p => {
          if (p.type === '常量') {
            initValues[p.name] = p.dataType === 'string' ? '' : 0
          } else if (p.children?.length) {
            flatten(p.children)
          }
        })
      }
      flatten(iface.request)
      ds.rows.push({ id: Date.now(), label: '初始行', values: initValues })
    }
  }

  selectedKey.value = `ds-${ds.id}`
  ElMessage.success('数据集已创建')
  if (!ds.linkedProtocol && !ds.linkedInterface) {
    ElMessage.warning('未关联字段或报文，数据集暂无数据列，建议重新创建并关联')
  }
}

/* ========== 当前数据集 ========== */
const currentDs = computed(() => tdStore.selectedDataset)

const onDeleteDataset = (id) => {
  tdStore.removeDataset(id)
  ElMessage.success('数据集已删除')
}

const onDuplicateDataset = (dup) => {
  selectedKey.value = `ds-${dup.id}`
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
  const file = tdStore.addFile(data)
  ElMessage.success('文件导入成功')
  // 文本类文件导入后默认弹出解析窗口，便于直接生成字段 / 报文 / 数据集
  if (data?.content) {
    openDataChainDialog({
      name: file.name,
      content: data.content,
      systemId: data.systemId || '',
      moduleName: data.moduleName || ''
    })
  }
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

/* ========== 初始化：自动选中第一个数据集 ========== */
const autoSelectFirst = () => {
  if (tdStore.datasets.length > 0 && !tdStore.selectedDatasetId) {
    tdStore.select(tdStore.datasets[0].id)
    selectedKey.value = `ds-${tdStore.datasets[0].id}`
  }
}
autoSelectFirst()

// 演示数据集方案：首次进入时填充 3 个武器管理数据集
onMounted(() => {
  const demoScheme = schemeStore.schemes.find(s => s.id === 'dsScheme-6002')
  if (demoScheme && !demoScheme.datasetIds.length) {
    const ds = tdStore.datasets.filter(d => d.systemId === 'sys-weapon').slice(0, 3)
    if (ds.length) schemeStore.update(demoScheme.id, { datasetIds: ds.map(d => d.id) })
  }
})

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

:deep(.smt > .el-card__body) {
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
</style>
