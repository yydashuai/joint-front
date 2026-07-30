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
          v-model="filterSource"
          placeholder="按来源筛选"
          clearable
          size="default"
          style="width: 140px;"
        >
          <el-option v-for="s in DATA_SOURCES" :key="s.value" :label="s.value" :value="s.value" />
        </el-select>
        <el-select
          v-model="filterAbnormal"
          placeholder="异常状态"
          clearable
          size="default"
          style="width: 120px;"
        >
          <el-option label="全部状态" :value="''" />
          <el-option label="异常" value="abnormal" />
          <el-option label="正常" value="normal" />
        </el-select>
        <el-select
          v-model="filterExcellent"
          placeholder="优秀历史"
          clearable
          size="default"
          style="width: 130px;"
        >
          <el-option label="全部" :value="''" />
          <el-option label="优秀历史" value="excellent" />
          <el-option label="非优秀" value="normal" />
        </el-select>
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
        <el-button size="default" :icon="Promotion" @click="pedVisible = true">粘贴报文构造</el-button>
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
        <el-table-column label="来源" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="sourceTagType(row.source)" effect="plain">{{ normalizeSource(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常" width="76" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.abnormal" size="small" type="danger" effect="dark">异常</el-tag>
            <el-tag v-else size="small" type="success" effect="plain">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优秀" width="76" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.excellent" size="small" type="warning" effect="dark">优秀</el-tag>
            <span v-else class="text-ph">—</span>
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="270" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip :content="row.excellent ? '移出优秀历史' : '加入优秀历史'">
              <el-button text :type="row.excellent ? 'warning' : 'info'" size="small" :icon="Star" @click="onToggleExcellent(row)" />
            </el-tooltip>
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
      <el-button size="small" text type="success" :icon="FolderAdd" @click="onBatchSaveAsDataset">另存为数据集</el-button>
      <el-button size="small" text type="primary" :icon="Promotion" @click="openSendDialog">直接发送</el-button>
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
          <div class="field-form-scroll">
            <!-- 有字段定义：类型化控件（开关 / 下拉 / 数值 / 文本），固定字段隐藏 -->
            <template v-if="!keyEditable">
              <div v-for="(item, idx) in editablePairs" :key="idx" class="field-form-row">
                <el-tooltip placement="top-start" :show-after="150">
                  <template #content>
                    <div class="kv-tip">{{ fieldTooltipContent(item.key) }}</div>
                  </template>
                  <span class="field-form-label">{{ item.key }}</span>
                </el-tooltip>
                <div class="field-form-control">
                  <el-select v-if="isFieldEnum(item.def)" :model-value="item.value" @update:model-value="(v) => item.value = v" size="default" style="width: 100%;">
                    <el-option v-for="entry in item.def.constraint.entries" :key="entry.value ?? entry" :label="entry.label || String(entry)" :value="entry.value ?? entry" />
                  </el-select>
                  <el-input-number v-else-if="isFieldNumeric(item.def)" :model-value="item.value === '' ? undefined : Number(item.value)" @update:model-value="(v) => item.value = v" :min="item.def.constraint?.min" :max="item.def.constraint?.max" size="default" controls-position="right" style="width: 100%;" />
                  <el-input v-else :model-value="item.value" @update:model-value="(v) => item.value = v" placeholder="值" size="default" />
                </div>
              </div>
              <span v-if="editablePairs.length === 0" class="kv-readonly-hint">该数据集字段均为固定值，无需手动填写</span>
            </template>
            <!-- 无字段定义：手动键值对 -->
            <template v-else>
              <div v-for="(item, idx) in formData.kvPairs" :key="idx" class="field-form-row">
                <el-input v-model="item.key" placeholder="字段名" class="field-form-label-input" />
                <div class="field-form-control">
                  <el-input v-model="item.value" placeholder="值" size="default" />
                </div>
                <el-button text type="danger" :icon="Delete" @click="removeKvPair(idx)" />
              </div>
              <el-button text type="primary" :icon="Plus" @click="addKvPair">添加字段</el-button>
            </template>
          </div>
          <div class="kv-validation">
            <span class="kv-validation__label">实时校验：</span>
            <el-tag v-if="liveValidation === true" size="small" type="danger" effect="dark">异常</el-tag>
            <el-tag v-else-if="liveValidation === false" size="small" type="success" effect="plain">正常</el-tag>
            <span v-else class="text-ph">—</span>
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

    <!-- ======== 粘贴报文构造 / 发送测试 ======== -->
    <PacketEditor v-model="pedVisible" mode="construct" />

    <!-- ======== 直接发送（绑定接口，与其他流程一致） ======== -->
    <el-dialog v-model="sendVisible" title="直接发送选中数据" width="520px" append-to-body destroy-on-close>
      <el-alert type="info" :closable="false" class="send-alert">
        选中 {{ selectedRows.length }} 条数据，将按绑定接口的字段定义重建报文并发送（异常由校验引擎自动判定、标红并同步异常台账）。
      </el-alert>
      <el-form label-width="96px" class="send-form">
        <el-form-item label="绑定接口" required>
          <el-select v-model="sendInterfaceId" filterable placeholder="选择发送接口（需含字段定义）" style="width: 100%;">
            <el-option
              v-for="i in bindableInterfaces"
              :key="i.id"
              :label="`${i.name}（${i.transportType || 'OSE'}）`"
              :value="i.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSend">开始发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Search, Delete, Right, Plus, Edit, Promotion, Star, FolderAdd } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceFields } from '@/stores/protocol'
import { useReceptionStore } from '@/stores/reception'
import { buildFrame, valuesToBytes } from '@/utils/receiveValidator'
import PacketEditor from '@/components/reception/PacketEditor.vue'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const tdStore = useTestDataStore()
const protocolStore = useProtocolStore()
const { validateName } = useEntityNameGuard()
const recvStore = useReceptionStore()
const pedVisible = ref(false)

/* ========== 数据来源枚举（统一四类；旧值归一化显示） ========== */
const DATA_SOURCES = [
  { value: '手动创建', tag: 'info' },
  { value: '文件导入', tag: 'warning' },
  { value: '智能生成', tag: 'success' },
  { value: '接收报文', tag: 'primary' },
]
// 历史遗留来源值 → 统一枚举
const LEGACY_SOURCE_MAP = { '手动录入': '手动创建', '历史优秀案例': '手动创建' }
const normalizeSource = (s) => LEGACY_SOURCE_MAP[s] || s || '手动创建'
const sourceTagType = (s) => DATA_SOURCES.find(d => d.value === normalizeSource(s))?.tag || 'info'

/* ========== 筛选 & 搜索 ========== */
const filterDatasetId = ref(null)
const filterSource = ref(null)
const filterAbnormal = ref('')
const filterExcellent = ref('')
const searchKeyword = ref('')

const filteredHistory = computed(() => {
  let data = tdStore.allHistoryData
  if (filterDatasetId.value) {
    data = data.filter(h => h._datasetId === filterDatasetId.value)
  }
  if (filterSource.value) {
    data = data.filter(h => normalizeSource(h.source) === filterSource.value)
  }
  if (filterAbnormal.value === 'abnormal') {
    data = data.filter(h => h.abnormal)
  } else if (filterAbnormal.value === 'normal') {
    data = data.filter(h => !h.abnormal)
  }
  if (filterExcellent.value === 'excellent') {
    data = data.filter(h => h.excellent)
  } else if (filterExcellent.value === 'normal') {
    data = data.filter(h => !h.excellent)
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

const onToggleExcellent = (row) => {
  tdStore.toggleExcellent(row._datasetId, row.id)
  ElMessage.success(row.excellent ? '已移出优秀历史数据库' : '已加入优秀历史数据库')
}

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
  remark: '',
  kvPairs: [{ key: '', value: '', def: null }]
})

const resetForm = () => {
  formData.datasetId = filterDatasetId.value || tdStore.datasets[0]?.id || null
  formData.label = ''
  formData.remark = ''
  formData.kvPairs = [{ key: '', value: '', def: null }]
}

const onAddNew = () => {
  isEditing.value = false
  editingRow.value = null
  resetForm()
  // 按所选数据集的字段定义预填（仅取值可编辑）
  formData.kvPairs = buildPairsFromDefs(formData.datasetId, {})
  dialogVisible.value = true
}

const onEditRow = (row) => {
  isEditing.value = true
  editingRow.value = row
  formData.datasetId = row._datasetId
  formData.label = row.label
  formData.remark = row.remark || ''
  // 按字段定义预填：标签只读，值取自该行现有数据
  formData.kvPairs = buildPairsFromDefs(row._datasetId, row.values || {})
  dialogVisible.value = true
}

const addKvPair = () => {
  formData.kvPairs.push({ key: '', value: '', def: null })
}

const removeKvPair = (idx) => {
  formData.kvPairs.splice(idx, 1)
  if (formData.kvPairs.length === 0) formData.kvPairs.push({ key: '', value: '' })
}

/* ========== 字段定义查询（按数据集） ========== */
// 当前所选数据集的关联字段定义（含约束与说明），用于预填与悬浮提示
const currentFieldDefs = computed(() => {
  if (!formData.datasetId) return []
  return tdStore.fieldDefsOfDataset(formData.datasetId) || []
})
// 有字段定义 → 标签（字段名）只读，仅取值可编辑；无定义（未关联）才允许手动增删字段
const keyEditable = computed(() => currentFieldDefs.value.length === 0)
const fieldMetaMap = computed(() => {
  const m = {}
  currentFieldDefs.value.forEach((f) => { m[f.name] = f })
  return m
})

const constraintText = (c) => {
  if (!c) return '无（自由值）'
  if (c.mode === 'fixed') return `固定值 ${c.value}`
  if (c.mode === 'enum') return '枚举：' + (c.entries || []).map((e) => e.label || e).join(' / ')
  if (c.mode === 'range') return `范围 ${c.min} ~ ${c.max}`
  return ''
}

// 悬浮提示：说明 + 约束范围（字段名已在界面展示，无需重复）
const fieldTooltipContent = (name) => {
  const def = fieldMetaMap.value[name]
  const lines = []
  if (def?.desc) lines.push('说明：' + def.desc)
  else lines.push('说明：—')
  lines.push('约束：' + constraintText(def?.constraint))
  return lines.join('\n')
}

/* ========== 字段类型判定（与数据集矩阵一致） ========== */
const isFieldFixed = (def) => def?.constraint?.mode === 'fixed'
const isFieldEnum = (def) => def?.constraint?.mode === 'enum' && (def.constraint.entries?.length > 0)
const isFieldNumeric = (def) => def?.constraint?.mode === 'range'
// 可编辑键值对：过滤掉固定字段（不显示、不可编辑），保留行内额外字段
const editablePairs = computed(() => formData.kvPairs.filter(p => !(p.def && isFieldFixed(p.def))))

// 依据字段定义预填键值对：固定字段取约束固定值，其余取已有数据或留空；并保留行内额外字段
// 值保留原始类型（数值不转字符串），以便开关 / 数值输入框正确绑定
const buildPairsFromDefs = (datasetId, existing = {}) => {
  const defs = datasetId ? (tdStore.fieldDefsOfDataset(datasetId) || []) : []
  if (!defs.length) {
    const entries = Object.entries(existing || {})
    return entries.length
      ? entries.map(([k, v]) => ({ key: k, value: v, def: null }))
      : [{ key: '', value: '', def: null }]
  }
  const result = defs.map((d) => ({
    key: d.name,
    value: d.constraint?.mode === 'fixed' ? d.constraint.value
         : (existing[d.name] != null ? existing[d.name] : ''),
    def: d
  }))
  const names = new Set(defs.map((d) => d.name))
  Object.entries(existing || {}).forEach(([k, v]) => {
    if (!names.has(k)) result.push({ key: k, value: v, def: null })
  })
  return result.length ? result : [{ key: '', value: '', def: null }]
}

// 新增模式下切换数据集时，按新定义重新预填键集合
watch(() => formData.datasetId, (newId) => {
  if (!isEditing.value && dialogVisible.value) {
    formData.kvPairs = buildPairsFromDefs(newId, {})
  }
})

/* 实时校验：编辑过程中按字段定义即时重算正常/异常状态 */
const buildValuesFromForm = () => {
  const values = {}
  formData.kvPairs.forEach(({ key, value }) => {
    if (key && key.trim() && value !== undefined && value !== null) values[key.trim()] = value
  })
  return values
}

const liveValidation = computed(() => {
  if (!formData.datasetId) return null
  const values = buildValuesFromForm()
  if (Object.keys(values).length === 0) return null
  return tdStore.computeAbnormal(values, formData.datasetId)
})

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
    if (key.trim() && value !== undefined && value !== null) values[key.trim()] = value
  })

  const abnormal = tdStore.computeAbnormal(values, formData.datasetId)

  if (isEditing.value && editingRow.value) {
    // 来源为记录值，不可手动修改：编辑后若数据发生变化则记为「手动创建」，否则保留原来源
    const changed = JSON.stringify(values) !== JSON.stringify(editingRow.value.values || {})
    const source = changed ? '手动创建' : normalizeSource(editingRow.value.source)
    tdStore.updateHistoryRow(formData.datasetId, editingRow.value.id, {
      label: formData.label.trim(),
      values,
      source,
      remark: formData.remark,
      abnormal,
    })
    ElMessage.success('历史数据已更新')
  } else {
    tdStore.addHistoryRows(formData.datasetId, [{
      label: formData.label.trim(),
      values,
      source: '手动创建',
      remark: formData.remark,
      abnormal,
      excellent: false,
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

/* ========== 另存为数据集 / 直接发送 ========== */
/** 可绑定发送的接口（需含字段定义） */
const bindableInterfaces = computed(() =>
  protocolStore.interfaces.filter((i) => (i.protocolRefs?.length))
)

/* ----- 另存为数据集 ----- */
const onBatchSaveAsDataset = () => {
  if (!selectedRows.value.length) return
  ElMessageBox.prompt('请输入新数据集名称', '另存为数据集', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空',
  }).then(({ value }) => {
    const name = validateName(value, null, '数据集')
    if (!name) return
    const sample = selectedRows.value[0]
    const sampleDs = tdStore.datasets.find((d) => d.id === sample._datasetId)
    const ds = tdStore.addDataset({
      name,
      systemId: sample._systemId ?? null,
      moduleName: sample._moduleName || '',
      linkedInterface: sampleDs?.linkedInterface || null,
      desc: `由历史数据另存（${selectedRows.value.length} 条，${new Date().toLocaleString('zh-CN', { hour12: false })})`,
    })
    const rowsData = selectedRows.value.map((r) => ({
      label: r.label,
      values: { ...r.values },
      source: r.source || '手动创建',
      remark: r.remark || '',
      abnormal: !!r.abnormal,
      excellent: !!r.excellent,
    }))
    tdStore.addHistoryRows(ds.id, rowsData)
    ElMessage.success(`已创建数据集「${name}」并写入 ${rowsData.length} 条`)
    selectedRows.value = []
  }).catch(() => {})
}

/* ----- 直接发送（绑定接口 → 重建帧 → injectReceived） ----- */
const sendVisible = ref(false)
const sendInterfaceId = ref(null)

const openSendDialog = () => {
  if (!selectedRows.value.length) return
  // 默认接口：选中数据所属数据集的绑定接口（若一致）
  const linked = [...new Set(selectedRows.value.map((r) => {
    const ds = tdStore.datasets.find((d) => d.id === r._datasetId)
    return ds?.linkedInterface || ''
  }))].filter(Boolean)
  const matched = linked.length === 1
    ? protocolStore.interfaces.find((i) => i.name === linked[0])
    : null
  sendInterfaceId.value = matched?.id || bindableInterfaces.value[0]?.id || null
  sendVisible.value = true
}

const confirmSend = () => {
  if (!sendInterfaceId.value) { ElMessage.warning('请选择绑定接口'); return }
  const iface = protocolStore.interfaces.find((i) => String(i.id) === String(sendInterfaceId.value))
  if (!iface) { ElMessage.warning('接口不存在'); return }
  const fields = collectInterfaceFields(iface, protocolStore.protocols, 'send')
  if (!fields.length) { ElMessage.warning('该接口无字段定义，无法校验发送'); return }
  const transport = iface.transportType || 'OSE'
  let sent = 0
  let abnormal = 0
  let skipped = 0
  selectedRows.value.forEach((r) => {
    const overlap = fields.some((f) => f.name in (r.values || {}))
    if (!overlap) { skipped++; return }
    const body = valuesToBytes(fields, r.values || {})
    const bytes = transport === 'MDS' ? body : buildFrame(transport, body, {}, true)
    if (!bytes) { skipped++; return }
    const entry = recvStore.injectReceived({
      transport,
      bytes,
      fields,
      values: { ...r.values },
      interfaceId: iface.id,
      iface: iface.name,
      moduleId: iface.moduleId || '',
      systemId: iface.systemId || '',
      sentTest: true,
    })
    if (entry) {
      sent++
      if (entry.verdict.status !== 'ok') abnormal++
    } else {
      skipped++
    }
  })
  sendVisible.value = false
  selectedRows.value = []
  ElMessage.success(
    `发送完成：共 ${sent} 条` + (abnormal ? `，其中 ${abnormal} 条被判定为异常（已标红并同步异常台账）` : '') +
    (skipped ? `，${skipped} 条因无匹配字段被跳过` : '')
  )
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

.source-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

/* 键值对编辑器 */
.kv-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 实时校验徽标 */
.kv-validation {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  &__label { font-size: 13px; color: var(--el-text-color-regular); }
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 只读字段名（标签） */
.kv-key-text {
  flex: 0 0 40%;
  max-width: 40%;
  font-size: 13px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: help;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kv-key { flex: 0 0 40%; }

.kv-value { flex: 1 1 auto; }

/* 类型化字段表单：竖向排列、固定高度可滚动（应对几十个字段） */
.field-form-scroll {
  width: 100%;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
}

.field-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-form-label {
  flex: 0 0 140px;
  max-width: 140px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: help;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-form-label-input {
  flex: 0 0 140px;
  max-width: 140px;
}

.field-form-control {
  flex: 1 1 auto;
  min-width: 0;
}

.kv-readonly-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* 悬浮提示文本（支持多行） */
.kv-tip {
  white-space: pre-line;
  line-height: 1.6;
  font-size: 12px;
}

/* 直接发送对话框 */
.send-alert { margin-bottom: 14px; }
.send-form { margin-top: 4px; }
</style>
