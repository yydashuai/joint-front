<template>
  <div class="page test-data">
    <div class="page__header">
      <div>
        <h2>测试数据管理</h2>
        <div class="page__desc">构造基于协议/接口的测试报文数据集，管理测试资源文件</div>
      </div>
      <div class="header-actions">
        <el-button :icon="Upload" @click="showUploadDialog = true">导入文件</el-button>
      </div>
    </div>

    <div class="split">
      <!-- ======== 左侧树 ======== -->
      <SystemModuleTree
        v-model="selectedKey"
        title="测试数据集"
        :leaf-groups="leafGroups"
        @select="onTreeSelect"
        @add-leaf="onAddLeaf"
        @delete-leaf="onDeleteLeaf"
      />

      <!-- ======== 右侧内容区 ======== -->
      <el-card class="main" shadow="never">
        <!-- 视图 B：数据集编辑器 -->
        <template v-if="currentDs">
          <!-- 元信息条 -->
          <div class="ds-header">
            <div class="ds-header__left">
              <el-input
                v-model="currentDs.name"
                class="ds-name-input"
                size="large"
                @change="(v) => tdStore.updateDataset(currentDs.id, { name: v })"
              />
              <el-input
                v-model="currentDs.desc"
                placeholder="描述..."
                class="ds-desc-input"
                size="small"
                @change="(v) => tdStore.updateDataset(currentDs.id, { desc: v })"
              />
            </div>
            <div class="ds-header__right">
              <el-tag v-if="currentDs.linkedProtocol" type="success" effect="plain" size="small">
                协议：{{ currentDs.linkedProtocol }}
              </el-tag>
              <el-tag v-if="currentDs.linkedInterface" type="warning" effect="plain" size="small">
                接口：{{ currentDs.linkedInterface }}
              </el-tag>
              <el-button size="small" :icon="Download" @click="onExportCsv">导出 CSV</el-button>
              <el-popconfirm title="确认删除此数据集？" @confirm="tdStore.removeDataset(currentDs.id)">
                <template #reference>
                  <el-button size="small" type="danger" :icon="Delete">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <!-- 字段参考区（可折叠） -->
          <el-collapse v-if="linkedFields.length" v-model="fieldsRefOpen" class="fields-ref">
            <el-collapse-item name="ref">
              <template #title>
                <span class="fields-ref__title">
                  关联{{ currentDs.linkedProtocol ? '协议' : '接口' }}字段定义
                  <el-tag size="small" type="info" effect="plain">{{ linkedFields.length }} 个字段</el-tag>
                </span>
              </template>
              <el-table :data="linkedFields" size="small" max-height="200" border>
                <el-table-column prop="name" label="字段名" min-width="120" />
                <el-table-column label="位范围 / 类型" width="140" align="center">
                  <template #default="{ row }">
                    <span v-if="row.startBit !== undefined" class="mono">{{ row.startBit }}-{{ row.endBit }}</span>
                    <span v-else>{{ row.dataType || row.type }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="约束" width="140" align="center">
                  <template #default="{ row }">
                    <template v-if="row.constraint">
                      <span v-if="row.constraint.mode === 'fixed'" class="text-ph">固定 {{ row.constraint.value }}</span>
                      <span v-else class="mono">{{ row.constraint.min }}~{{ row.constraint.max }}</span>
                    </template>
                    <span v-else class="text-ph">—</span>
                  </template>
                </el-table-column>
                <el-table-column prop="desc" label="说明" min-width="160" />
              </el-table>
            </el-collapse-item>
          </el-collapse>

          <!-- 数据矩阵表格（核心编辑区） -->
          <div class="ds-matrix">
            <el-table :data="currentDs.rows" size="small" border style="width: 100%;">
              <el-table-column type="index" width="48" align="center" label="#" />
              <el-table-column label="行标签" width="150">
                <template #default="{ row }">
                  <el-input v-model="row.label" size="small" @change="(v) => tdStore.updateRowLabel(currentDs.id, row.id, v)" />
                </template>
              </el-table-column>
              <el-table-column
                v-for="field in dynamicFields"
                :key="field.name"
                :min-width="fieldColWidth(field)"
              >
                <template #header>
                  <div class="field-col-header">
                    <div class="field-col-header__name">{{ field.name }}</div>
                    <div class="field-col-header__type">{{ fieldHint(field) }}</div>
                  </div>
                </template>
                <template #default="{ row }">
                  <template v-if="isFieldFixed(field)">
                    <span class="fixed-value">{{ field.constraint.value }}</span>
                  </template>
                  <template v-else-if="isFieldBit(field)">
                    <el-switch
                      :model-value="!!row.values[field.name]"
                      @change="(v) => tdStore.updateRowValue(currentDs.id, row.id, field.name, v ? 1 : 0)"
                      size="small"
                    />
                  </template>
                  <template v-else-if="isFieldNumeric(field)">
                    <el-input-number
                      :model-value="row.values[field.name]"
                      @update:model-value="(v) => tdStore.updateRowValue(currentDs.id, row.id, field.name, v)"
                      :min="field.constraint?.min"
                      :max="field.constraint?.max"
                      size="small"
                      controls-position="right"
                      style="width: 100%;"
                    />
                  </template>
                  <template v-else>
                    <el-input
                      :model-value="row.values[field.name]"
                      @update:model-value="(v) => tdStore.updateRowValue(currentDs.id, row.id, field.name, v)"
                      size="small"
                    />
                  </template>
                </template>
              </el-table-column>
              <el-table-column label="" width="60" align="center">
                <template #default="{ row }">
                  <el-button type="danger" text size="small" :icon="Delete" @click="tdStore.removeRow(currentDs.id, row.id)" />
                </template>
              </el-table-column>
            </el-table>
            <el-button class="add-row-btn" text type="primary" :icon="Plus" @click="tdStore.addRow(currentDs.id)">
              添加测试行
            </el-button>
          </div>

          <!-- 数据预览（可折叠） -->
          <el-collapse v-model="previewOpen" class="ds-preview">
            <el-collapse-item name="preview">
              <template #title>
                <span class="fields-ref__title">数据预览（JSON）</span>
              </template>
              <pre class="preview-json">{{ previewJson }}</pre>
            </el-collapse-item>
          </el-collapse>
        </template>

        <!-- 视图 A：空状态 + 资源文件管理 -->
        <template v-else>
          <el-empty description="从左侧选择一个数据集进行编辑，或创建新数据集" :image-size="80" />

          <div class="files-section">
            <div class="files-header">
              <h3>测试资源文件</h3>
              <el-button size="small" :icon="Upload" @click="showUploadDialog = true">上传文件</el-button>
            </div>
            <el-table :data="tdStore.allFiles" size="small" border>
              <el-table-column label="文件名" min-width="220">
                <template #default="{ row }">
                  <div class="file-name">
                    <el-icon :color="formatColor(row.format)"><Document /></el-icon>
                    <span>{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="关联模块" width="180">
                <template #default="{ row }">
                  <span class="text-sub">{{ row.moduleName || '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="格式" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="formatTag(row.format)" size="small" effect="plain">{{ row.format.toUpperCase() }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="大小" width="90" align="right">
                <template #default="{ row }">
                  <span class="mono">{{ formatSize(row.size) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="行数" width="70" align="center">
                <template #default="{ row }">
                  <span v-if="row.rowCount" class="mono">{{ row.rowCount }}</span>
                  <span v-else class="text-ph">—</span>
                </template>
              </el-table-column>
              <el-table-column label="上传时间" width="150" prop="uploadedAt" />
              <el-table-column label="操作" width="120" align="center">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="onDownloadFile(row)">下载</el-button>
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
      </el-card>
    </div>

    <!-- ======== 新建数据集对话框 ======== -->
    <el-dialog v-model="showCreateDialog" title="新建测试数据集" width="520px" destroy-on-close>
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="数据集名称" required>
          <el-input v-model="createForm.name" placeholder="如：设备状态查询-正常场景" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.desc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="所属模块">
          <el-input :model-value="`${createForm.moduleName}（${createForm.systemId}）`" disabled />
        </el-form-item>
        <el-form-item label="关联协议">
          <el-select v-model="createForm.linkedProtocol" clearable placeholder="选择协议（可选）" style="width: 100%;">
            <el-option
              v-for="p in moduleProtocols"
              :key="p.id"
              :label="p.name"
              :value="p.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联接口">
          <el-select v-model="createForm.linkedInterface" clearable placeholder="选择接口（可选）" style="width: 100%;">
            <el-option
              v-for="i in moduleInterfaces"
              :key="i.id"
              :label="i.name"
              :value="i.name"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="onCreateDataset">创建</el-button>
      </template>
    </el-dialog>

    <!-- ======== 上传文件对话框 ======== -->
    <el-dialog v-model="showUploadDialog" title="导入测试资源文件" width="480px" destroy-on-close>
      <el-form :model="uploadForm" label-width="100px">
        <el-form-item label="文件名" required>
          <el-input v-model="uploadForm.name" placeholder="如：测试数据.csv" />
        </el-form-item>
        <el-form-item label="文件格式">
          <el-select v-model="uploadForm.format" style="width: 100%;">
            <el-option label="CSV" value="csv" />
            <el-option label="JSON" value="json" />
            <el-option label="二进制" value="bin" />
            <el-option label="XML" value="xml" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联系统">
          <el-select v-model="uploadForm.systemId" placeholder="选择系统" style="width: 100%;">
            <el-option
              v-for="sys in systemStore.systems"
              :key="sys.id"
              :label="sys.name"
              :value="sys.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联模块">
          <el-select v-model="uploadForm.moduleName" placeholder="选择模块" style="width: 100%;" :disabled="!uploadForm.systemId">
            <el-option
              v-for="mod in uploadModules"
              :key="mod.id"
              :label="mod.name"
              :value="mod.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.desc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="onUploadFile">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Upload, Download, Delete, Plus, Document, Coin } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()

/* ========== 树选择 ========== */
const selectedKey = ref('')

const leafGroups = (module) => {
  const datasets = tdStore.datasets.filter(d => d.moduleName === module.name && d.systemId === module.systemId)
  return [{
    key: `tdg-${module.id}`,
    kind: 'dataset',
    icon: 'Coin',
    label: '数据集',
    count: datasets.length,
    addLabel: '+数据集',
    addType: 'primary',
    items: datasets.map(ds => ({
      key: `ds-${ds.id}`,
      kind: 'dataset',
      icon: 'Document',
      label: ds.name,
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

/* ========== 新建数据集 ========== */
const showCreateDialog = ref(false)
const createForm = reactive({
  name: '',
  desc: '',
  systemId: '',
  moduleName: '',
  linkedProtocol: null,
  linkedInterface: null
})

const moduleProtocols = computed(() => {
  if (!createForm.systemId || !createForm.moduleName) return []
  const mod = connStore.nodes.find(n => n.name === createForm.moduleName && n.systemId === createForm.systemId)
  if (!mod) return []
  return protoStore.protocols.filter(p => p.moduleId === mod.id)
})

const moduleInterfaces = computed(() => {
  if (!createForm.systemId || !createForm.moduleName) return []
  const mod = connStore.nodes.find(n => n.name === createForm.moduleName && n.systemId === createForm.systemId)
  if (!mod) return []
  return protoStore.interfaces.filter(i => i.moduleId === mod.id)
})

const onAddLeaf = ({ groupKind, module }) => {
  createForm.name = ''
  createForm.desc = ''
  createForm.systemId = module.systemId
  createForm.moduleName = module.name
  createForm.linkedProtocol = null
  createForm.linkedInterface = null
  showCreateDialog.value = true
}

const onCreateDataset = () => {
  if (!createForm.name) {
    ElMessage.warning('请输入数据集名称')
    return
  }
  const ds = tdStore.addDataset({
    name: createForm.name,
    desc: createForm.desc,
    systemId: createForm.systemId,
    moduleName: createForm.moduleName,
    linkedProtocol: createForm.linkedProtocol,
    linkedInterface: createForm.linkedInterface
  })
  // 如果关联了协议，用协议字段初始化第一行
  if (ds.linkedProtocol) {
    const proto = protoStore.protocols.find(p => p.name === ds.linkedProtocol)
    if (proto) {
      const initValues = {}
      proto.fields.forEach(f => {
        initValues[f.name] = f.constraint.mode === 'fixed' ? f.constraint.value : 0
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
  showCreateDialog.value = false
  ElMessage.success('数据集已创建')
}

/* ========== 当前数据集 ========== */
const currentDs = computed(() => tdStore.selectedDataset)

/** 解析关联的字段定义 */
const linkedFields = computed(() => {
  const ds = currentDs.value
  if (!ds) return []
  if (ds.linkedProtocol) {
    const proto = protoStore.protocols.find(p => p.name === ds.linkedProtocol)
    return proto?.fields || []
  }
  if (ds.linkedInterface) {
    const iface = protoStore.interfaces.find(i => i.name === ds.linkedInterface)
    if (!iface) return []
    const flat = []
    const walk = (params) => {
      params.forEach(p => {
        if (p.type === '常量') flat.push(p)
        else if (p.children?.length) walk(p.children)
      })
    }
    walk(iface.request)
    return flat
  }
  return []
})

/** 动态列表格列（排除 fixed 约束以外的字段） */
const dynamicFields = computed(() => {
  const ds = currentDs.value
  if (!ds) return []
  // 如果有关联字段定义，用它
  if (linkedFields.value.length) return linkedFields.value
  // 否则从数据行的 values keys 推断
  if (ds.rows.length) {
    return Object.keys(ds.rows[0].values).map(k => ({ name: k, constraint: null }))
  }
  return []
})

/** 字段判断工具 */
const isFieldFixed = (field) => field.constraint?.mode === 'fixed'
const isFieldBit = (field) => field.constraint?.mode === 'range' && field.constraint.min === 0 && field.constraint.max === 1 && field.startBit === field.endBit
const isFieldNumeric = (field) => field.constraint?.mode === 'range' && !isFieldBit(field)

const fieldColWidth = (field) => isFieldBit(field) ? 90 : isFieldNumeric(field) ? 150 : 130

const fieldHint = (field) => {
  if (field.constraint?.mode === 'fixed') return `固定 ${field.constraint.value}`
  if (field.constraint?.mode === 'range') return `${field.constraint.min}~${field.constraint.max}`
  if (field.dataType) return field.dataType
  if (field.type) return field.type
  return ''
}

/** 字段参考区折叠 */
const fieldsRefOpen = ref(['ref'])
const previewOpen = ref([])

/** JSON 预览 */
const previewJson = computed(() => {
  const ds = currentDs.value
  if (!ds || !ds.rows.length) return '[]'
  return JSON.stringify(ds.rows.map(r => ({ label: r.label, ...r.values })), null, 2)
})

/** 导出 CSV */
const onExportCsv = () => {
  const ds = currentDs.value
  if (!ds || !ds.rows.length) {
    ElMessage.warning('数据集为空，无法导出')
    return
  }
  const keys = Object.keys(ds.rows[0].values)
  const header = ['label', ...keys].join(',')
  const rows = ds.rows.map(r => [r.label, ...keys.map(k => r.values[k])].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ds.name}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

/* ========== 资源文件 ========== */
const formatColor = (fmt) => ({ csv: '#52c41a', json: '#faad14', bin: '#8b9dc3', xml: '#2f6feb' }[fmt] || '#999')
const formatTag = (fmt) => ({ csv: 'success', json: 'warning', bin: 'info', xml: '' }[fmt] || 'info')
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const onDownloadFile = (file) => {
  ElMessage.success(`模拟下载：${file.name}`)
}

/* ========== 上传文件对话框 ========== */
const showUploadDialog = ref(false)
const uploadForm = reactive({
  name: '',
  format: 'csv',
  systemId: '',
  moduleName: '',
  desc: ''
})

const uploadModules = computed(() => {
  if (!uploadForm.systemId) return []
  return connStore.nodes.filter(n => n.systemId === uploadForm.systemId)
})

const onUploadFile = () => {
  if (!uploadForm.name) {
    ElMessage.warning('请输入文件名')
    return
  }
  tdStore.addFile({
    name: uploadForm.name,
    format: uploadForm.format,
    size: Math.floor(Math.random() * 50000) + 1000,
    systemId: uploadForm.systemId,
    moduleName: uploadForm.moduleName,
    desc: uploadForm.desc,
    rowCount: uploadForm.format === 'bin' ? 0 : Math.floor(Math.random() * 200) + 10
  })
  ElMessage.success('文件导入成功')
  showUploadDialog.value = false
  uploadForm.name = ''
  uploadForm.desc = ''
}
</script>

<style scoped lang="scss">
.test-data {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
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

/* 左侧树 */
:deep(.smt) {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

/* 右侧主区 */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: auto;
  }
}

/* ========== 数据集编辑器 ========== */
.ds-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;

  &__left {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}

.ds-name-input {
  :deep(.el-input__wrapper) {
    box-shadow: none;
    padding: 0;
  }
  :deep(.el-input__inner) {
    font-size: 17px;
    font-weight: 600;
  }
}

.ds-desc-input {
  :deep(.el-input__wrapper) {
    box-shadow: none;
    padding: 0;
  }
  :deep(.el-input__inner) {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

/* 字段参考区 */
.fields-ref {
  flex-shrink: 0;
  :deep(.el-collapse-item__header) {
    height: 36px;
    font-size: 13px;
  }
}

.fields-ref__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

/* 数据矩阵 */
.ds-matrix {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.field-col-header {
  display: flex;
  flex-direction: column;
  line-height: 1.3;

  &__name {
    font-size: 13px;
    font-weight: 600;
  }

  &__type {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

.fixed-value {
  color: var(--el-text-color-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.add-row-btn {
  margin-top: 8px;
  align-self: flex-start;
}

/* 数据预览 */
.ds-preview {
  flex-shrink: 0;
  :deep(.el-collapse-item__header) {
    height: 36px;
  }
}

.preview-json {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
  white-space: pre;
}

/* ========== 资源文件区 ========== */
.files-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  h3 { margin: 0; font-size: 15px; font-weight: 600; }
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
