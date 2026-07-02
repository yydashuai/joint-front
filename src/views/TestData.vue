<template>
  <div class="page test-data">
    <div class="page__header">
      <div>
        <h2>测试数据管理</h2>
        <div class="page__desc">构造基于协议/接口的测试报文数据集，管理测试资源文件</div>
      </div>
      <div class="header-actions">
        <el-button-group>
          <el-button :type="viewMode === 'dataset' ? 'primary' : ''" @click="viewMode = 'dataset'">数据集管理</el-button>
          <el-button :type="viewMode === 'history' ? 'primary' : ''" @click="viewMode = 'history'">历史数据管理</el-button>
          <el-button :type="viewMode === 'files' ? 'primary' : ''" @click="viewMode = 'files'">测试资源文件</el-button>
        </el-button-group>
        <el-button v-if="viewMode === 'files'" :icon="Upload" @click="showUploadDialog = true">导入文件</el-button>
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
        <DatasetEditor
          v-if="currentDs"
          :dataset="currentDs"
          @delete="onDeleteDataset"
          @duplicate="onDuplicateDataset"
        />
        <el-empty v-else description="暂无数据集，请从左侧创建" :image-size="80" />
      </el-card>
    </div>

    <!-- ======== 历史数据管理视图 ======== -->
    <el-card v-else-if="viewMode === 'history'" class="main history-main" shadow="never">
      <HistoryDataManager />
    </el-card>

    <!-- ======== 测试资源文件视图 ======== -->
    <el-card v-else class="main history-main" shadow="never">
      <ResourceFiles @upload="showUploadDialog = true" @download="onDownloadFile" />
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
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Upload, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import DatasetEditor from '@/components/testdata/DatasetEditor.vue'
import ResourceFiles from '@/components/testdata/ResourceFiles.vue'
import CreateDatasetDialog from '@/components/testdata/CreateDatasetDialog.vue'
import UploadFileDialog from '@/components/testdata/UploadFileDialog.vue'
import HistoryDataManager from '@/components/testdata/HistoryDataManager.vue'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const connStore = useConnectionStore()

/* ========== 视图切换 ========== */
const viewMode = ref('dataset') // 'dataset' | 'history' | 'files'

/* ========== 树选择 + 搜索 ========== */
const selectedKey = ref('')
const dsSearch = ref('')

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
  if (data.kind === 'dataset' && data.ref) {
    tdStore.select(data.ref.id)
  } else {
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

const onAddLeaf = ({ module }) => {
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
    ElMessage.warning('未关联协议或接口，数据集暂无数据列，建议重新创建并关联')
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

/* ========== 资源文件 ========== */
const onDownloadFile = (file) => {
  ElMessage.success(`模拟下载：${file.name}`)
}

const showUploadDialog = ref(false)

const onUploadFile = (data) => {
  tdStore.addFile(data)
  ElMessage.success('文件导入成功')
}

/* ========== 初始化：自动选中第一个数据集 ========== */
const autoSelectFirst = () => {
  if (tdStore.datasets.length > 0 && !tdStore.selectedDatasetId) {
    tdStore.select(tdStore.datasets[0].id)
    selectedKey.value = `ds-${tdStore.datasets[0].id}`
  }
}
autoSelectFirst()

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
