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

    <div class="meta-row">
      <span class="meta-row__label req">所属系统</span>
      <el-select v-model="protocol.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
        <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <span class="meta-row__label req">模块</span>
      <el-select v-model="protocol.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!protocol.systemId">
        <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
      </el-select>
    </div>

    <div class="matrix-head">
      <div>
        <strong>数据矩阵</strong>
        <span>{{ categoryMeta.desc }}</span>
      </div>
      <div v-if="category === 'struct'" class="matrix-actions">
        <el-button size="small" :icon="Plus" @click="addScalarVariable">添加基础变量</el-button>
        <el-button size="small" type="primary" plain :icon="Connection" @click="addStructReference">引用共识体</el-button>
      </div>
    </div>

    <el-table
      v-if="category === 'scalar' || category === 'struct'"
      :data="protocol.fields"
      row-key="id"
      border
      size="small"
      class="field-matrix"
      lazy
      :load="loadStructReference"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
    >
      <el-table-column label="类别" width="116" align="center">
        <template #default="{ row }">
          <el-tag :type="row.type === 'struct' ? 'success' : 'primary'" effect="plain" size="small">
            {{ row.type === 'struct' ? '共识体引用' : '标量' }}
          </el-tag>
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
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Check, Connection, Delete, Plus } from '@element-plus/icons-vue'
import {
  DATA_RULE_CATEGORY_MAP,
  SCALAR_ENCODINGS,
  makeParam,
  useProtocolStore,
} from '@/stores/protocol'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'save', 'systemChange'])

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

const addScalarVariable = () => {
  props.protocol.fields.push(makeParam({
    name: `变量${props.protocol.fields.length + 1}`,
    type: 'scalar',
    encoding: 'uint8',
  }))
}
const addStructReference = () => {
  const row = makeParam({
    name: `共识体引用${props.protocol.fields.filter((item) => item.type === 'struct').length + 1}`,
    type: 'struct',
    protocolRef: null,
  })
  row.hasChildren = false
  props.protocol.fields.push(row)
}
const removeRow = (id) => {
  const index = props.protocol.fields.findIndex((row) => row.id === id)
  if (index >= 0) props.protocol.fields.splice(index, 1)
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
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }
.matrix-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 9px 12px; border: 1px solid var(--el-border-color-lighter); border-bottom: 0;
  border-radius: 8px 8px 0 0; background: var(--el-fill-color-extra-light);
  > div:first-child { display: flex; align-items: baseline; gap: 10px; }
  strong { font-size: 14px; }
  span { color: var(--el-text-color-secondary); font-size: 12px; }
}
.matrix-actions { display: flex; align-items: center; gap: 8px; }
.field-matrix {
  width: 100%;
  border-radius: 0 0 8px 8px;
  :deep(.el-input-number) { width: 108px; }
  :deep(.el-table__cell) { vertical-align: middle; }
}
.readonly-value { color: var(--el-text-color-regular); }
.unit { margin-left: 5px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
