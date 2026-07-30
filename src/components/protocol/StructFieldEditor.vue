<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <div class="proto-head__identity">
          <el-input
            v-model="protocol.name"
            class="proto-name"
            placeholder="字段名称"
            @focus="beginNameEdit"
            @change="commitNameEdit"
          />
          <el-tag :type="categoryMeta.tag" effect="plain">{{ categoryMeta.label }}</el-tag>
        </div>
        <div class="proto-head__right">
          <el-tooltip content="保存当前字段配置">
            <el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button>
          </el-tooltip>
          <el-popconfirm title="删除该字段？" @confirm="$emit('delete')">
            <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </template>

    <div class="field-label">备注说明</div>
    <el-input v-model="protocol.desc" placeholder="可选，描述该字段的用途" class="proto-desc" />

    <el-table
      v-if="category === 'scalar' || category === 'struct'"
      :key="tableKey"
      ref="tableRef"
      :data="protocol.fields"
      row-key="id"
      border
      size="small"
      class="field-matrix"
      lazy
      :load="loadStructReference"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      :row-class-name="tableRowClass"
    >
      <el-table-column label="" width="36" align="center" class-name="drag-col">
        <template #default="{ row }">
          <el-icon v-if="!row.__readonly" class="drag-handle"><Rank /></el-icon>
        </template>
      </el-table-column>
      <el-table-column v-if="category === 'struct'" label="类别" width="116" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.__readonly" :type="row.type === 'struct' ? 'success' : 'primary'" effect="plain" size="small">
            {{ row.type === 'struct' ? '共识体' : '标量' }}
          </el-tag>
          <el-select v-else v-model="row.type" size="small" @change="onRowTypeChange(row)">
            <el-option label="标量" value="scalar" />
            <el-option label="共识体" value="struct" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="数据类型" min-width="180">
        <template #default="{ row }">
          <span v-if="row.__readonly" class="readonly-value">{{ dataTypeText(row) }}</span>
          <template v-else-if="row.type === 'struct'">
            <span v-if="row.children?.length" class="readonly-value">内嵌共识体</span>
            <el-select
              v-else
              v-model="row.protocolRef"
              filterable
              clearable
              placeholder="选择共识体字段"
              style="width: 100%"
              @change="syncReferenceState(row)"
            >
              <el-option v-for="option in structReferenceOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </template>
          <el-select v-else v-model="row.encoding" filterable style="width: 100%">
            <el-option-group v-for="group in scalarEncodingGroups" :key="group.label" :label="group.label">
              <el-option v-for="option in group.items" :key="option.value" :label="option.label" :value="option.value" />
            </el-option-group>
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="变量名" min-width="150">
        <template #default="{ row }">
          <span v-if="row.__readonly" class="readonly-value">{{ row.name }}</span>
          <el-input v-else v-model="row.name" placeholder="变量名称" />
        </template>
      </el-table-column>
      <el-table-column label="必填" width="72" align="center">
        <template #default="{ row }">
          <el-switch v-if="!row.__readonly" v-model="row.required" />
          <span v-else>{{ row.required === false ? '否' : '是' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="单位" width="120">
        <template #default="{ row }">
          <span v-if="row.__readonly" class="readonly-value">{{ row.unit || '—' }}</span>
          <el-input v-else v-model="row.unit" placeholder="可选" />
        </template>
      </el-table-column>
      <el-table-column label="默认值" min-width="120">
        <template #default="{ row }">
          <span v-if="row.__readonly" class="readonly-value">{{ row.defaultValue ?? '—' }}</span>
          <el-input v-else v-model="row.defaultValue" :disabled="row.type === 'struct'" placeholder="可选" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="180">
        <template #default="{ row }">
          <span v-if="row.__readonly" class="readonly-value">{{ row.desc || row.remark || '—' }}</span>
          <el-input v-else v-model="row.desc" placeholder="变量含义" />
        </template>
      </el-table-column>
      <el-table-column v-if="category === 'struct'" label="操作" width="76" align="center">
        <template #default="{ row }">
          <el-button v-if="!row.__readonly" link type="danger" @click="removeRow(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-table v-else-if="category === 'file'" :data="[fileConfig]" border size="small" class="field-matrix">
      <el-table-column label="数据形态" width="110" align="center">
        <template #default><el-tag effect="plain">二进制流</el-tag></template>
      </el-table-column>
      <el-table-column label="文件类型" min-width="190">
        <template #default="{ row }">
          <el-select v-model="row.mediaType" filterable allow-create style="width: 100%">
            <el-option label="application/octet-stream" value="application/octet-stream" />
            <el-option label="application/zip" value="application/zip" />
            <el-option label="image/png" value="image/png" />
            <el-option label="image/jpeg" value="image/jpeg" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="扩展名" width="110">
        <template #default="{ row }"><el-input v-model="row.extension" placeholder=".bin" /></template>
      </el-table-column>
      <el-table-column label="最大容量" width="150">
        <template #default="{ row }"><el-input-number v-model="row.maxSizeMb" :min="1" :max="10240" controls-position="right" /><span class="unit">MB</span></template>
      </el-table-column>
      <el-table-column label="分块大小" width="150">
        <template #default="{ row }"><el-input-number v-model="row.chunkSizeKb" :min="1" :max="102400" controls-position="right" /><span class="unit">KB</span></template>
      </el-table-column>
      <el-table-column label="完整性校验" min-width="140">
        <template #default="{ row }">
          <el-select v-model="row.checksum" style="width: 100%">
            <el-option label="无" value="none" />
            <el-option label="CRC32" value="crc32" />
            <el-option label="MD5" value="md5" />
            <el-option label="SHA-256" value="sha256" />
          </el-select>
        </template>
      </el-table-column>
    </el-table>

    <el-table v-else-if="category === 'matrix'" :data="[matrixConfig]" border size="small" class="field-matrix">
      <el-table-column label="数据形态" width="110" align="center">
        <template #default><el-tag type="danger" effect="plain">二维矩阵</el-tag></template>
      </el-table-column>
      <el-table-column label="文件类型" min-width="160">
        <template #default="{ row }">
          <el-select v-model="row.fileType" style="width: 100%">
            <el-option label="BIN 矩阵" value="binary-matrix" />
            <el-option label="CSV" value="csv" />
            <el-option label="XLSX" value="xlsx" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="元素类型" min-width="130">
        <template #default="{ row }">
          <el-select v-model="row.scalarType" filterable style="width: 100%">
            <el-option v-for="option in scalarEncodings" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="行数" width="125">
        <template #default="{ row }"><el-input-number v-model="row.rows" :min="0" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="列数" width="125">
        <template #default="{ row }"><el-input-number v-model="row.columns" :min="0" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="存储顺序" width="130">
        <template #default="{ row }">
          <el-select v-model="row.rowMajor">
            <el-option label="按行" :value="true" />
            <el-option label="按列" :value="false" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="文件头" width="140">
        <template #default="{ row }"><el-input-number v-model="row.headerBytes" :min="0" controls-position="right" /><span class="unit">B</span></template>
      </el-table-column>
    </el-table>

    <div v-if="category === 'struct'" class="bottom-actions">
      <el-button class="add-row" :icon="Plus" @click="addVariable">添加变量</el-button>
    </div>
  </el-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, Delete, Plus, Rank } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import {
  DATA_RULE_CATEGORY_MAP,
  SCALAR_ENCODINGS,
  makeParam,
  useProtocolStore,
} from '@/stores/protocol'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const props = defineProps({
  protocol: { type: Object, required: true },
})
defineEmits(['delete', 'save'])

const store = useProtocolStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto' }
const category = computed(() => props.protocol.category || 'struct')
const categoryTagMap = { scalar: 'primary', struct: 'success', file: 'info', matrix: 'danger' }
const categoryMeta = computed(() => {
  const meta = DATA_RULE_CATEGORY_MAP[category.value] || DATA_RULE_CATEGORY_MAP.struct
  return { ...meta, tag: categoryTagMap[category.value] || 'info' }
})

const scalarEncodings = SCALAR_ENCODINGS.filter((item) =>
  ['整数', '浮点', '其他'].includes(item.group) && item.value !== 'field-ref'
)
const scalarEncodingGroups = computed(() => {
  const groups = new Map()
  scalarEncodings.forEach((item) => {
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group).push(item)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

const isBitstreamProtocol = (protocol) =>
  protocol.category === 'bitstream' ||
  (protocol.fields || []).some((field) => ['byte', 'bit', 'repeat'].includes(field.kind))
const structReferenceOptions = computed(() => store.protocols
  .filter((protocol) =>
    protocol.id !== props.protocol.id &&
    !isBitstreamProtocol(protocol) &&
    (protocol.category || 'struct') === 'struct'
  )
  .map((protocol) => ({ label: protocol.name, value: protocol.id })))

const fileConfig = computed(() => {
  if (!props.protocol.fileConfig) {
    props.protocol.fileConfig = {
      mediaType: 'application/octet-stream',
      extension: '.bin',
      maxSizeMb: 100,
      checksum: 'sha256',
      chunkSizeKb: 64,
    }
  }
  return props.protocol.fileConfig
})
const matrixConfig = computed(() => {
  if (!props.protocol.matrixConfig) {
    props.protocol.matrixConfig = {
      fileType: 'binary-matrix',
      scalarType: 'float32',
      rows: 0,
      columns: 0,
      rowMajor: true,
      headerBytes: 0,
    }
  }
  return props.protocol.matrixConfig
})

const legacyType = (type) => ({
  常量: 'scalar',
  共识体: 'struct',
  位组序流: 'bitstream',
  流文件: 'file',
  结构矩阵: 'matrix',
}[type] || type || 'scalar')
const markNestedReadonly = (rows = [], depth = 0) => rows.forEach((row) => {
  row.type = legacyType(row.type)
  if (!row.encoding) row.encoding = row.dataType || 'uint8'
  if (depth > 0 && !Object.prototype.hasOwnProperty.call(row, '__readonly')) {
    Object.defineProperty(row, '__readonly', { value: true, writable: true, enumerable: false })
  }
  if (row.children?.length) markNestedReadonly(row.children, depth + 1)
})
const ensureShape = () => {
  if (!Array.isArray(props.protocol.fields)) props.protocol.fields = []
  markNestedReadonly(props.protocol.fields)
  if (category.value === 'scalar') {
    if (!props.protocol.fields.length) props.protocol.fields.push(makeParam({ name: '变量1', type: 'scalar', encoding: 'uint8' }))
    if (props.protocol.fields.length > 1) props.protocol.fields.splice(1)
    Object.assign(props.protocol.fields[0], { type: 'scalar', protocolRef: null, hasChildren: false })
  }
  if (category.value === 'struct') {
    props.protocol.fields.forEach(syncReferenceState)
  }
}
watch(() => props.protocol.id, ensureShape, { immediate: true })
watch(category, ensureShape)

const tableRef = ref(null)
const tableKey = ref(0)
let sortable = null

const tableRowClass = ({ row }) => row.__readonly ? 'structured-row--reference' : 'structured-row--top'

const initSortable = () => {
  sortable?.destroy()
  sortable = null
  if (!['scalar', 'struct'].includes(category.value)) return
  const tbody = tableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return
  sortable = Sortable.create(tbody, {
    handle: '.drag-handle',
    draggable: '.structured-row--top',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: ({ oldDraggableIndex, newDraggableIndex }) => {
      if (
        oldDraggableIndex == null ||
        newDraggableIndex == null ||
        oldDraggableIndex === newDraggableIndex
      ) return
      const rows = [...props.protocol.fields]
      const [moved] = rows.splice(oldDraggableIndex, 1)
      if (!moved) return
      rows.splice(newDraggableIndex, 0, moved)
      props.protocol.fields.splice(0, props.protocol.fields.length, ...rows)
      tableKey.value++
      nextTick(initSortable)
    },
  })
}

onMounted(() => nextTick(initSortable))
onBeforeUnmount(() => sortable?.destroy())
watch(() => props.protocol.id, () => nextTick(initSortable))
watch(category, () => nextTick(initSortable))

const nameBeforeEdit = ref('')
const beginNameEdit = () => { nameBeforeEdit.value = props.protocol.name }
const commitNameEdit = () => {
  const validName = validateName(props.protocol.name, props.protocol, '字段')
  props.protocol.name = validName || nameBeforeEdit.value || nextUniqueName('新建字段', props.protocol)
}

const dirty = ref(false)
const snapshot = ref(JSON.stringify(props.protocol))
watch(() => props.protocol, () => {
  dirty.value = JSON.stringify(props.protocol) !== snapshot.value
}, { deep: true })
watch(() => props.protocol.id, () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}, { immediate: true })
const markClean = () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}
defineExpose({ markClean })

const addVariable = () => {
  props.protocol.fields.push(makeParam({
    name: `变量${props.protocol.fields.length + 1}`,
    type: 'scalar',
    encoding: 'uint8',
  }))
}
const removeRow = (id) => {
  const index = props.protocol.fields.findIndex((row) => row.id === id)
  if (index >= 0) props.protocol.fields.splice(index, 1)
}
const onRowTypeChange = (row) => {
  row.type = legacyType(row.type)
  row.protocolRef = null
  row.children = []
  row.hasChildren = false
  if (row.type === 'scalar') {
    row.encoding = row.encoding || row.dataType || 'uint8'
  } else {
    row.defaultValue = ''
  }
  tableKey.value++
  nextTick(initSortable)
}
function syncReferenceState(row) {
  row.type = legacyType(row.type)
  row.hasChildren = row.type === 'struct' && (!!row.protocolRef || !!row.children?.length)
}

const cloneReferencedRows = (rows = [], parentKey = '', depth = 1) => rows.map((source) => {
  const row = {
    ...source,
    id: `ref-${parentKey}-${source.id}`,
    type: legacyType(source.type),
    encoding: source.encoding || source.dataType || 'uint8',
    __readonly: true,
    __depth: depth,
    children: undefined,
  }
  row.hasChildren = depth < 6 && row.type === 'struct' && (!!source.protocolRef || !!source.children?.length)
  if (source.children?.length) row.__inlineChildren = source.children
  return row
})
const loadStructReference = (row, treeNode, resolve) => {
  if (row.__depth >= 6) {
    resolve([])
    return
  }
  if (row.__inlineChildren?.length) {
    resolve(cloneReferencedRows(row.__inlineChildren, row.id, (row.__depth || 0) + 1))
    return
  }
  const referenced = store.protocols.find((protocol) => String(protocol.id) === String(row.protocolRef))
  resolve(referenced ? cloneReferencedRows(referenced.fields || [], row.id, (row.__depth || 0) + 1) : [])
}
const dataTypeText = (row) => {
  if (row.type === 'struct') {
    return store.protocols.find((protocol) => String(protocol.id) === String(row.protocolRef))?.name || '共识体'
  }
  return row.encoding || row.dataType || 'uint8'
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-head__identity, .proto-head__right { display: flex; align-items: center; gap: 8px; }
.proto-name { width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.field-matrix {
  flex: 1;
  width: 100%;
  :deep(.el-select) { .el-input__wrapper { padding: 0 8px; } }
  :deep(.el-input-number) { width: 108px; }
  :deep(.el-table__cell) { vertical-align: middle; }
  :deep(.drag-col .cell) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  :deep(.sortable-ghost) {
    opacity: 0.4;
    background: var(--el-color-primary-light-9) !important;
  }
}
.drag-handle {
  cursor: grab; color: var(--el-text-color-placeholder); font-size: 14px; flex-shrink: 0;
  &:hover { color: var(--el-text-color-regular); }
  &:active { cursor: grabbing; }
}
.bottom-actions { display: flex; gap: 8px; margin-top: 12px; }
.add-row { flex: 1; border-style: dashed; }
.readonly-value { color: var(--el-text-color-regular); }
.unit { margin-left: 5px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
