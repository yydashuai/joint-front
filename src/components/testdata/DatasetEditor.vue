<template>
  <div class="dataset-editor" tabindex="0" @keydown="onKeydown">
    <!-- ======== 元信息条 (优化点 19: flex-wrap) ======== -->
    <div class="ds-header">
      <div class="ds-header__left">
        <el-input
          v-model="ds.name"
          class="ds-name-input"
          size="large"
          @change="(v) => tdStore.updateDataset(ds.id, { name: v })"
        />
        <el-input
          v-model="ds.desc"
          placeholder="描述..."
          class="ds-desc-input"
          size="small"
          @change="(v) => tdStore.updateDataset(ds.id, { desc: v })"
        />
      </div>
      <div class="ds-header__right">
        <el-tag v-if="ds.linkedProtocol" type="success" effect="plain" size="small">
          协议：{{ ds.linkedProtocol }}
        </el-tag>
        <el-tag v-if="ds.linkedInterface" type="warning" effect="plain" size="small">
          接口：{{ ds.linkedInterface }}
        </el-tag>
        <el-tooltip content="将数据集导出为 CSV 文件"><el-button size="small" :icon="Download" @click="onExportCsv">导出 CSV</el-button></el-tooltip>
        <el-tooltip content="将数据集导出为 JSON 文件"><el-button size="small" :icon="DocumentCopy" @click="onExportJson">导出 JSON</el-button></el-tooltip>
        <el-tooltip content="复制整个数据集及其所有数据行"><el-button size="small" :icon="CopyDocument" @click="onDuplicate">复制数据集</el-button></el-tooltip>
        <el-popconfirm title="确认删除此数据集？" @confirm="onDelete">
          <template #reference>
            <el-button size="small" type="danger" :icon="Delete">删除</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <!-- ======== 字段参考区 (优化点 20: 视觉区分) ======== -->
    <el-collapse v-if="linkedFields.length" v-model="fieldsRefOpen" class="fields-ref">
      <el-collapse-item name="ref">
        <template #title>
          <span class="fields-ref__title">
            关联{{ ds.linkedProtocol ? '协议' : '接口' }}字段定义
            <el-tag size="small" type="info" effect="plain">{{ linkedFields.length }} 个字段</el-tag>
          </span>
        </template>
        <el-table :data="linkedFields" size="small" max-height="200" border class="fields-ref-table">
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
                <span v-else-if="row.constraint.mode === 'enum'" class="text-enum">
                  {{ (row.constraint.entries || []).map(e => e.label || e).join(' / ') }}
                </span>
                <span v-else class="mono">{{ row.constraint.min }}~{{ row.constraint.max }}</span>
              </template>
              <span v-else class="text-ph">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" min-width="160" />
        </el-table>
      </el-collapse-item>
    </el-collapse>

    <!-- ======== 数据矩阵工具栏 ======== -->
    <div class="matrix-toolbar">
      <div class="matrix-toolbar__left">
        <span class="matrix-title">数据矩阵</span>
        <el-tag size="small" type="info" effect="plain">{{ ds.rows.length }} 行</el-tag>
      </div>
      <div class="matrix-toolbar__right">
        <!-- 批量操作 -->
        <template v-if="selectedRows.length > 0">
          <el-tag size="small" type="warning" effect="plain">已选 {{ selectedRows.length }} 行</el-tag>
          <el-button size="small" text :icon="CopyDocument" @click="onCopyRows" title="Ctrl+C">复制</el-button>
          <el-button size="small" text type="primary" @click="onDuplicateRows" title="Ctrl+D">复制行</el-button>
          <el-button size="small" text :icon="Top" @click="onMoveUp" :disabled="!canMoveUp">上移</el-button>
          <el-button size="small" text :icon="Bottom" @click="onMoveDown" :disabled="!canMoveDown">下移</el-button>
          <el-popconfirm :title="`确认删除 ${selectedRows.length} 行？`" @confirm="onBatchDelete">
            <template #reference>
              <el-button size="small" type="danger" text :icon="Delete">批量删除</el-button>
            </template>
          </el-popconfirm>
        </template>
        <el-button
          v-if="rowClipboard.length > 0"
          size="small" text type="success" @click="onPasteRows" title="Ctrl+V"
        >粘贴 {{ rowClipboard.length }} 行</el-button>
        <el-popconfirm v-if="ds.rows.length > 0" title="确认清空所有行？" @confirm="onClearRows">
          <template #reference>
            <el-button size="small" text type="warning">清空</el-button>
          </template>
        </el-popconfirm>
        <el-input
          v-model="rowSearch"
          placeholder="搜索行..."
          :prefix-icon="Search"
          size="small"
          clearable
          style="width: 180px;"
        />
      </div>
    </div>

    <!-- ======== 空数据集引导 (优化点 23) ======== -->
    <div v-if="dynamicFields.length === 0" class="empty-guide">
      <el-empty :image-size="60" description="此数据集尚未关联协议或接口，暂无数据列">
        <template #description>
          <p>请删除后重新创建并关联协议/接口，或手动添加列。</p>
        </template>
      </el-empty>
    </div>

    <!-- ======== 数据矩阵表格 (核心) ======== -->
    <div v-else class="ds-matrix">
      <el-table
        ref="tableRef"
        :data="displayRows"
        size="small"
        border
        row-key="id"
        :row-class-name="rowClassName"
        @selection-change="onSelectionChange"
        @row-contextmenu="onRowContextMenu"
        style="width: 100%;"
        :max-height="tableMaxHeight"
      >
        <!-- 选择列 (优化点 2) -->
        <el-table-column type="selection" width="40" fixed="left" align="center" />
        <!-- 拖拽手柄列 (优化点 3) -->
        <el-table-column width="36" align="center" fixed="left" class-name="drag-col">
          <template #default>
            <span class="drag-handle" title="拖拽排序">⠿</span>
          </template>
        </el-table-column>
        <!-- 序号列 (优化点 1: fixed) -->
        <el-table-column type="index" width="48" align="center" label="#" fixed="left" />
        <!-- 行标签列 (优化点 1: fixed) -->
        <el-table-column label="行标签" width="150" fixed="left">
          <template #default="{ row }">
            <div class="label-cell">
              <span v-if="dirtyRowIds.has(row.id)" class="dirty-dot" title="已修改"></span>
              <el-input
                v-model="row.label"
                size="small"
                @change="(v) => tdStore.updateRowLabel(ds.id, row.id, v)"
              />
            </div>
          </template>
        </el-table-column>

        <!-- 动态字段列 -->
        <el-table-column
          v-for="field in dynamicFields"
          :key="field.name"
          :min-width="fieldColWidth(field)"
          :class-name="isFieldFixed(field) ? 'fixed-col' : ''"
        >
          <template #header>
            <div class="field-col-header">
              <div class="field-col-header__name">
                <el-icon v-if="isFieldFixed(field)" class="lock-icon"><Lock /></el-icon>
                {{ field.name }}
              </div>
              <div class="field-col-header__type">{{ fieldHint(field) }}</div>
            </div>
          </template>
          <template #default="{ row }">
            <!-- 固定值 (优化点 4: 更紧凑) -->
            <template v-if="isFieldFixed(field)">
              <span class="fixed-value">{{ field.constraint.value }}</span>
            </template>
            <!-- 位字段 → Switch -->
            <template v-else-if="isFieldBit(field)">
              <el-switch
                :model-value="!!row.values[field.name]"
                @change="(v) => onValueChange(row, field.name, v ? 1 : 0)"
                size="small"
              />
            </template>
            <!-- 枚举字段 → Select (优化点 5) -->
            <template v-else-if="isFieldEnum(field)">
              <el-select
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                size="small"
                style="width: 100%;"
              >
                <el-option
                  v-for="entry in field.constraint.entries"
                  :key="entry.value ?? entry"
                  :label="entry.label || String(entry)"
                  :value="entry.value ?? entry"
                />
              </el-select>
            </template>
            <!-- 数值字段 → InputNumber (优化点 6: 校验) -->
            <template v-else-if="isFieldNumeric(field)">
              <el-input-number
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                :min="field.constraint?.min"
                :max="field.constraint?.max"
                size="small"
                controls-position="right"
                :class="{ 'cell-invalid': isCellInvalid(row, field) }"
                style="width: 100%;"
              />
            </template>
            <!-- 文本字段 → Input -->
            <template v-else>
              <el-input
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                size="small"
              />
            </template>
          </template>
        </el-table-column>

        <!-- 删除行 -->
        <el-table-column label="" width="50" align="center" fixed="right">
          <template #default="{ row }">
            <el-popconfirm title="确认删除该行？" @confirm="tdStore.removeRow(ds.id, row.id)">
              <template #reference><el-button type="danger" text size="small" :icon="Delete" /></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-tooltip content="添加一行新的测试数据 (Ctrl+N)"><el-button class="add-row-btn" text type="primary" :icon="Plus" @click="onAddRow">
        添加测试行
        <span class="shortcut-hint">Ctrl+N</span>
      </el-button></el-tooltip>
    </div>

    <!-- ======== 数据预览 (优化点 24: 复制按钮) ======== -->
    <el-collapse v-model="previewOpen" class="ds-preview">
      <el-collapse-item name="preview">
        <template #title>
          <span class="fields-ref__title">
            数据预览（JSON）
          </span>
        </template>
        <div class="preview-toolbar">
          <el-button size="small" text type="primary" @click="copyJson">复制到剪贴板</el-button>
        </div>
        <pre class="preview-json">{{ previewJson }}</pre>
      </el-collapse-item>
    </el-collapse>

    <!-- 行右键菜单 -->
    <teleport to="body">
      <div v-if="rowCtx.visible" class="row-ctx-mask" @click="closeRowCtx" @contextmenu.prevent="closeRowCtx">
        <ul class="row-ctx-menu" :style="{ left: rowCtx.x + 'px', top: rowCtx.y + 'px' }" @click.stop>
          <li @click="onCtxCopyRow">复制行</li>
          <li @click="onCtxDuplicateRow">复制并插入下方</li>
          <li v-if="rowClipboard.length > 0" @click="onCtxPasteRows">粘贴 {{ rowClipboard.length }} 行到下方</li>
          <li class="ctx-sep"></li>
          <li @click="onCtxMoveUp" :class="{ disabled: rowCtx.isFirst }">上移</li>
          <li @click="onCtxMoveDown" :class="{ disabled: rowCtx.isLast }">下移</li>
          <li class="ctx-sep"></li>
          <li class="danger" @click="confirmCtxDelete">删除此行</li>
        </ul>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Download, Delete, Plus, Lock, DocumentCopy, CopyDocument, Search, Top, Bottom
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore } from '@/stores/protocol'
import { exportCsvFile, exportJsonFile } from '@/services/testDataService'

const props = defineProps({
  dataset: { type: Object, required: true }
})

const emit = defineEmits(['delete', 'duplicate'])

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()

const ds = computed(() => props.dataset)

/* ========== 字段解析 ========== */
// 展平协议字段树（byte/bit/repeat 嵌套 → 平面列表）
const flattenProtoFields = (fields) => {
  const result = []
  fields.forEach(f => {
    if (f.kind === 'byte') {
      if (f.bitMode && f.children?.length) {
        f.children.forEach(bit => {
          if (bit.name) result.push({ name: bit.name, dataType: bit.dataType, constraint: bit.constraint, desc: bit.desc, startBit: bit.bitStart, endBit: bit.bitEnd })
        })
      } else if (f.name) {
        result.push({ name: f.name, dataType: f.dataType, constraint: f.constraint, desc: f.desc, byteLength: f.byteLength })
      }
    } else if (f.kind === 'bit' && f.name) {
      result.push({ name: f.name, dataType: f.dataType, constraint: f.constraint, desc: f.desc, startBit: f.bitStart, endBit: f.bitEnd })
    } else if (f.kind === 'repeat' && f.children?.length) {
      result.push(...flattenProtoFields(f.children))
    }
  })
  return result
}

const linkedFields = computed(() => {
  const d = ds.value
  if (!d) return []
  if (d.linkedProtocol) {
    const proto = protoStore.protocols.find(p => p.name === d.linkedProtocol)
    if (!proto?.config?.fields?.length) return []
    return flattenProtoFields(proto.config.fields)
  }
  if (d.linkedInterface) {
    const iface = protoStore.interfaces.find(i => i.name === d.linkedInterface)
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

const dynamicFields = computed(() => {
  if (linkedFields.value.length) return linkedFields.value
  const d = ds.value
  if (d.rows.length) {
    return Object.keys(d.rows[0].values).map(k => ({ name: k, constraint: null }))
  }
  return []
})

/* ========== 字段类型判断 ========== */
const isFieldFixed = (f) => f.constraint?.mode === 'fixed'
const isFieldBit = (f) => f.constraint?.mode === 'range' && f.constraint.min === 0 && f.constraint.max === 1 && f.startBit === f.endBit
const isFieldEnum = (f) => f.constraint?.mode === 'enum' && f.constraint.entries?.length
const isFieldNumeric = (f) => f.constraint?.mode === 'range' && !isFieldBit(f)

const fieldColWidth = (f) => {
  if (isFieldFixed(f)) return 80
  if (isFieldBit(f)) return 90
  if (isFieldEnum(f)) return 140
  return isFieldNumeric(f) ? 150 : 130
}

const fieldHint = (f) => {
  if (f.constraint?.mode === 'fixed') return `固定 ${f.constraint.value}`
  if (f.constraint?.mode === 'enum') return (f.constraint.entries || []).map(e => e.label || e).join('/')
  if (f.constraint?.mode === 'range') return `${f.constraint.min}~${f.constraint.max}`
  if (f.dataType) return f.dataType
  if (f.type) return f.type
  return ''
}

/* ========== 单元格校验 (优化点 6) ========== */
const isCellInvalid = (row, field) => {
  if (!field.constraint || field.constraint.mode !== 'range') return false
  const val = row.values[field.name]
  if (val == null || val === '') return false
  const num = Number(val)
  if (isNaN(num)) return true
  return num < field.constraint.min || num > field.constraint.max
}

/* ========== 脏数据标记 (优化点 7) ========== */
const originalSnapshot = ref(new Map()) // rowId → JSON string
const dirtyRowIds = ref(new Set())

const takeSnapshot = () => {
  const snap = new Map()
  ds.value.rows.forEach(r => snap.set(r.id, JSON.stringify(r)))
  originalSnapshot.value = snap
  dirtyRowIds.value = new Set()
}

const checkDirty = (row) => {
  const orig = originalSnapshot.value.get(row.id)
  if (!orig) { dirtyRowIds.value.add(row.id); return }
  if (JSON.stringify(row) !== orig) dirtyRowIds.value.add(row.id)
  else dirtyRowIds.value.delete(row.id)
}

const onValueChange = (row, fieldName, value) => {
  tdStore.updateRowValue(ds.value.id, row.id, fieldName, value)
  checkDirty(row)
}

/* ========== 行搜索 (优化点 12) ========== */
const rowSearch = ref('')
const displayRows = computed(() => {
  if (!rowSearch.value) return ds.value.rows
  const kw = rowSearch.value.toLowerCase()
  return ds.value.rows.filter(r => {
    if (r.label?.toLowerCase().includes(kw)) return true
    return Object.values(r.values).some(v => String(v).toLowerCase().includes(kw))
  })
})

/* ========== 批量选择 (优化点 2) ========== */
const selectedRows = ref([])
const onSelectionChange = (rows) => { selectedRows.value = rows }
const onBatchDelete = () => {
  tdStore.removeRowsBatch(ds.value.id, selectedRows.value.map(r => r.id))
  selectedRows.value = []
  ElMessage.success('已删除选中行')
}

/* ========== 行剪贴板 + 右键菜单 ========== */
const rowClipboard = ref([])  // Array of deep-cloned row objects

const rowCtx = reactive({ visible: false, x: 0, y: 0, row: null, isFirst: false, isLast: false })

const onRowContextMenu = (row, _column, event) => {
  event.preventDefault()
  const rows = ds.value.rows
  const idx = rows.findIndex(r => r.id === row.id)
  Object.assign(rowCtx, {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    row,
    isFirst: idx <= 0,
    isLast: idx >= rows.length - 1
  })
}
const closeRowCtx = () => { rowCtx.visible = false }

const onCtxCopyRow = () => {
  if (!rowCtx.row) return
  rowClipboard.value = [JSON.parse(JSON.stringify(rowCtx.row))]
  ElMessage.success('已复制 1 行')
  closeRowCtx()
}

const onCtxDuplicateRow = () => {
  if (!rowCtx.row) return
  tdStore.duplicateRow(ds.value.id, rowCtx.row.id)
  nextTick(() => takeSnapshot())
  ElMessage.success('已复制并插入')
  closeRowCtx()
}

const onCtxPasteRows = () => {
  if (!rowCtx.row || rowClipboard.value.length === 0) return
  tdStore.insertRowsAfter(ds.value.id, rowCtx.row.id, rowClipboard.value)
  nextTick(() => takeSnapshot())
  ElMessage.success(`已粘贴 ${rowClipboard.value.length} 行`)
  closeRowCtx()
}

const onCtxMoveUp = () => {
  if (rowCtx.isFirst) return
  tdStore.moveRowUp(ds.value.id, rowCtx.row.id)
  nextTick(() => takeSnapshot())
  closeRowCtx()
}

const onCtxMoveDown = () => {
  if (rowCtx.isLast) return
  tdStore.moveRowDown(ds.value.id, rowCtx.row.id)
  nextTick(() => takeSnapshot())
  closeRowCtx()
}

const onCtxDeleteRow = () => {
  if (!rowCtx.row) return
  tdStore.removeRow(ds.value.id, rowCtx.row.id)
  closeRowCtx()
}

const confirmCtxDelete = () => {
  if (!rowCtx.row) return
  const rowId = rowCtx.row.id
  closeRowCtx()
  ElMessageBox.confirm('确认删除该行？', '确认', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  }).then(() => {
    tdStore.removeRow(ds.value.id, rowId)
  }).catch(() => {})
}

/* ========== 工具栏行操作 ========== */
const onCopyRows = () => {
  if (selectedRows.value.length === 0) return
  rowClipboard.value = selectedRows.value.map(r => JSON.parse(JSON.stringify(r)))
  ElMessage.success(`已复制 ${rowClipboard.value.length} 行`)
}

const onPasteRows = () => {
  if (rowClipboard.value.length === 0) return
  // 粘贴到最后一个选中行之后，若无选中行则追加到末尾
  const lastSelected = selectedRows.value[selectedRows.value.length - 1]
  tdStore.insertRowsAfter(ds.value.id, lastSelected?.id ?? null, rowClipboard.value)
  nextTick(() => takeSnapshot())
  ElMessage.success(`已粘贴 ${rowClipboard.value.length} 行`)
}

const onDuplicateRows = () => {
  if (selectedRows.value.length === 0) return
  tdStore.duplicateRows(ds.value.id, selectedRows.value.map(r => r.id))
  nextTick(() => takeSnapshot())
  ElMessage.success(`已复制 ${selectedRows.value.length} 行`)
}

const canMoveUp = computed(() => {
  if (selectedRows.value.length === 0) return false
  const firstId = selectedRows.value[0].id
  return ds.value.rows.findIndex(r => r.id === firstId) > 0
})

const canMoveDown = computed(() => {
  if (selectedRows.value.length === 0) return false
  const lastId = selectedRows.value[selectedRows.value.length - 1].id
  return ds.value.rows.findIndex(r => r.id === lastId) < ds.value.rows.length - 1
})

const onMoveUp = () => {
  if (!canMoveUp.value) return
  // 逐个上移（从第一个选中行开始）
  selectedRows.value.forEach(r => tdStore.moveRowUp(ds.value.id, r.id))
  nextTick(() => takeSnapshot())
}

const onMoveDown = () => {
  if (!canMoveDown.value) return
  // 逐个下移（从最后一个选中行开始，逆序）
  [...selectedRows.value].reverse().forEach(r => tdStore.moveRowDown(ds.value.id, r.id))
  nextTick(() => takeSnapshot())
}

const onClearRows = () => {
  tdStore.clearRows(ds.value.id)
  nextTick(() => takeSnapshot())
  ElMessage.success('已清空所有行')
}

watch(() => ds.value.id, () => {
  nextTick(() => takeSnapshot())
  rowSearch.value = ''
  selectedRows.value = []
}, { immediate: true })

/* ========== 拖拽排序 (优化点 3) ========== */
const tableRef = ref(null)
let sortableInstance = null

const initSortable = () => {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null }
  const el = tableRef.value?.$el
  if (!el) return
  const tbody = el.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return
  // 搜索过滤时禁用拖拽，避免索引错位 (Bug fix)
  if (rowSearch.value) return
  sortableInstance = Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex) return
      const rows = [...ds.value.rows]
      const [moved] = rows.splice(oldIndex, 1)
      rows.splice(newIndex, 0, moved)
      tdStore.reorderRows(ds.value.id, rows)
      // 重排后重置脏标记快照
      nextTick(() => takeSnapshot())
    }
  })
}

onMounted(() => { nextTick(initSortable) })
onBeforeUnmount(() => { sortableInstance?.destroy() })

watch(() => ds.value.rows.length, () => { nextTick(initSortable) })
watch(rowSearch, () => { nextTick(initSortable) })

/* ========== 行样式 (优化点 7) ========== */
const rowClassName = ({ row }) => {
  return dirtyRowIds.value.has(row.id) ? 'dirty-row' : ''
}

/* ========== 操作 ========== */
const onAddRow = () => {
  tdStore.addRow(ds.value.id)
  nextTick(() => takeSnapshot())
}

const onDelete = () => {
  emit('delete', ds.value.id)
}

const onDuplicate = () => {
  const dup = tdStore.duplicateDataset(ds.value.id)
  if (dup) {
    emit('duplicate', dup)
    ElMessage.success('数据集已复制')
  }
}

/* ========== 导出 (优化点 9, 10, 11) ========== */
const validateBeforeExport = () => {
  const d = ds.value
  if (!d.rows.length) {
    ElMessage.warning('数据集为空，无法导出')
    return false
  }
  // 检查是否有无效值
  let invalidCount = 0
  d.rows.forEach(row => {
    dynamicFields.value.forEach(field => {
      if (isCellInvalid(row, field)) invalidCount++
    })
  })
  if (invalidCount > 0) {
    ElMessage.warning(`有 ${invalidCount} 个单元格值超出约束范围，导出后可能不准确`)
  }
  return true
}

const onExportCsv = () => {
  if (!validateBeforeExport()) return
  const fieldNames = dynamicFields.value.map(f => f.name)
  exportCsvFile(ds.value.rows, fieldNames, `${ds.value.name}.csv`)
  ElMessage.success('CSV 导出成功')
}

const onExportJson = () => {
  if (!validateBeforeExport()) return
  const data = ds.value.rows.map(r => ({
    label: r.label,
    ...r.values
  }))
  exportJsonFile(data, `${ds.value.name}.json`)
  ElMessage.success('JSON 导出成功')
}

/* ========== JSON 预览 ========== */
const fieldsRefOpen = ref(['ref'])
const previewOpen = ref([])

const previewJson = computed(() => {
  const d = ds.value
  if (!d || !d.rows.length) return '[]'
  return JSON.stringify(d.rows.map(r => ({ label: r.label, ...r.values })), null, 2)
})

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(previewJson.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选中复制')
  }
}

/* ========== 表格高度 (优化点 17) ========== */
const tableMaxHeight = ref(400)

/* ========== 快捷键 (优化点 21) ========== */
const onKeydown = (e) => {
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    onAddRow()
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    onExportCsv()
  }
  if (e.ctrlKey && e.key === 'c') {
    if (selectedRows.value.length > 0) {
      e.preventDefault()
      onCopyRows()
    }
  }
  if (e.ctrlKey && e.key === 'v') {
    if (rowClipboard.value.length > 0) {
      e.preventDefault()
      onPasteRows()
    }
  }
  if (e.ctrlKey && e.key === 'd') {
    if (selectedRows.value.length > 0) {
      e.preventDefault()
      onDuplicateRows()
    }
  }
  if (e.key === 'Delete' && selectedRows.value.length > 0) {
    onBatchDelete()
  }
}
</script>

<style scoped lang="scss">
.dataset-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  outline: none;
}

/* ======== 元信息条 ======== */
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
    max-width: 50%;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
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

/* ======== 字段参考区 (优化点 20: 背景区分) ======== */
.fields-ref {
  flex-shrink: 0;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 0 4px;

  :deep(.el-collapse-item__header) {
    height: 36px;
    font-size: 13px;
    background: transparent;
  }
  :deep(.el-collapse-item__wrap) {
    background: transparent;
  }
}

.fields-ref__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.fields-ref-table {
  background: transparent;
}

.text-enum {
  font-size: 12px;
  color: var(--el-color-primary);
}

/* ======== 矩阵工具栏 ======== */
.matrix-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.matrix-title {
  font-size: 14px;
  font-weight: 600;
}

/* ======== 空引导 (优化点 23) ======== */
.empty-guide {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ======== 数据矩阵 ======== */
.ds-matrix {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 拖拽手柄 */
.drag-handle {
  cursor: grab;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  user-select: none;
  &:active { cursor: grabbing; }
}

.drag-col {
  cursor: default;
}

/* 标签单元格 */
.label-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 脏数据标记 (优化点 7) */
.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
  flex-shrink: 0;
}

:deep(.dirty-row) {
  background-color: rgba(230, 162, 60, 0.06) !important;
}

/* 固定值列 (优化点 4) */
.fixed-col {
  background: var(--el-fill-color-lighter) !important;
}

.lock-icon {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-right: 2px;
  vertical-align: middle;
}

/* 字段列头 */
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

/* 单元格无效 (优化点 6) */
.cell-invalid {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset;
  }
}

/* 添加行按钮 */
.add-row-btn {
  margin-top: 8px;
  align-self: flex-start;
}

.shortcut-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: 6px;
}

/* 拖拽 ghost */
:deep(.sortable-ghost) {
  opacity: 0.4;
  background: var(--el-color-primary-light-9) !important;
}

/* ======== 数据预览 ======== */
.ds-preview {
  flex-shrink: 0;
  :deep(.el-collapse-item__header) {
    height: 36px;
  }
}

.preview-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
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

/* 行右键菜单 */
.row-ctx-mask { position: fixed; inset: 0; z-index: 3000; }
.row-ctx-menu {
  position: fixed;
  min-width: 180px;
  padding: 4px 0;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
  font-size: 13px;
  li {
    list-style: none;
    padding: 7px 16px;
    cursor: pointer;
    color: var(--el-text-color-primary);
    &:hover { background: var(--el-fill-color-light); }
    &.danger { color: var(--el-color-danger); }
    &.disabled { color: var(--el-text-color-placeholder); pointer-events: none; }
    &.ctx-sep { height: 1px; padding: 0; margin: 4px 8px; background: var(--el-border-color-lighter); cursor: default; pointer-events: none; }
  }
}
</style>
