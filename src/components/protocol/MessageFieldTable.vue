<template>
  <div class="msg-field-table">
    <div class="section-head">
      <span class="section-title">字段定义</span>
      <el-button size="small" type="primary" plain :icon="Plus" @click="createVisible = true">添加字段</el-button>
    </div>

    <el-table
      ref="tableRef"
      :data="rows"
      border
      size="small"
      row-key="key"
      class="field-table"
      :expand-row-keys="expandedKeys"
      @expand-change="onExpandChange"
      empty-text="暂无字段，点击「添加字段」开始定义"
    >
      <!-- 共识体子字段：直接在表格行内展开（不悬浮） -->
      <el-table-column type="expand" width="34">
        <template #default="{ row }">
          <div v-if="row.protocol.category === 'struct'" class="struct-expand-body">
            <StructNestedEditor :fields="row.protocol.fields" />
          </div>
        </template>
      </el-table-column>

      <el-table-column width="40" align="center" class-name="drag-col">
        <template #default><el-icon class="drag-handle"><Rank /></el-icon></template>
      </el-table-column>

      <!-- 1. 字段名 -->
      <el-table-column label="字段名" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.protocol.name" size="small" placeholder="字段名" />
        </template>
      </el-table-column>

      <!-- 2. 五大数据类型 -->
      <el-table-column label="数据类型" width="120" align="center">
        <template #default="{ row }">
          <el-select :model-value="row.protocol.category" size="small" @change="(v) => onChangeCategory(row, v)">
            <el-option v-for="c in CATEGORIES" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </template>
      </el-table-column>

      <!-- 3. 具体配置 -->
      <el-table-column label="具体配置" min-width="320">
        <template #default="{ row }">
          <!-- 标量 -->
          <template v-if="row.protocol.category === 'scalar'">
            <el-select v-model="primary(row).encoding" size="small" class="cfg-col" filterable>
              <el-option-group v-for="g in encodingGroups" :key="g.label" :label="g.label">
                <el-option v-for="o in g.items" :key="o.value" :label="o.label" :value="o.value" />
              </el-option-group>
            </el-select>
          </template>

          <!-- 位组序流（纯字节） -->
          <template v-else-if="row.protocol.category === 'bitstream'">
            <template v-if="isSimpleByte(row.protocol)">
              <el-select v-model="row.protocol.fields[0].dataType" size="small" class="cfg-col">
                <el-option v-for="o in BYTE_DATA_TYPES" :key="o.value" :label="`${o.label}（${o.bytes}字节）`" :value="o.value" />
              </el-select>
            </template>
            <el-tag v-else type="warning" effect="plain" size="small">
              {{ byteSummary(row.protocol) }}
            </el-tag>
          </template>

          <!-- 共识体（行内展开配置子字段，支持 2-N 层嵌套） -->
          <template v-else-if="row.protocol.category === 'struct'">
            <el-button size="small" link type="primary" class="cfg-struct-trigger" @click="toggleExpand(row)">
              {{ (row.protocol.fields || []).length }} 个子字段
              <el-icon class="cfg-arrow"><ArrowDown /></el-icon>
            </el-button>
          </template>

          <!-- 流文件 -->
          <template v-else-if="row.protocol.category === 'file'">
            <el-select v-model="row.protocol.fileConfig.fileType" size="small" class="cfg-col">
              <el-option label="BIN" value="bin" /><el-option label="TXT" value="txt" />
            </el-select>
            <el-input-number v-model="row.protocol.fileConfig.chunkSizeKb" :min="1" :max="102400" size="small" controls-position="right" class="cfg-num" />
            <span class="cfg-suffix">KB</span>
            <el-select v-model="row.protocol.fileConfig.checksum" size="small" class="cfg-col">
              <el-option label="无" value="none" />
              <el-option label="CRC32" value="crc32" />
              <el-option label="MD5" value="md5" />
              <el-option label="SHA-256" value="sha256" />
            </el-select>
          </template>

          <!-- 结构矩阵 -->
          <template v-else-if="row.protocol.category === 'matrix'">
            <el-select v-model="row.protocol.matrixConfig.fileType" size="small" class="cfg-col">
              <el-option label="CSV" value="csv" />
              <el-option label="XLSX" value="xlsx" />
              <el-option label="PNG" value="png" />
              <el-option label="JPEG" value="jpeg" />
            </el-select>
          </template>
        </template>
      </el-table-column>

      <!-- 4. 取值约束 -->
      <el-table-column label="取值约束" width="270">
        <template #default="{ row }">
          <template v-if="hasConstraint(row.protocol)">
            <el-select v-model="primary(row).constraint.mode" size="small" class="cfg-col" @change="onConstraintChange(row)">
              <el-option label="无" value="none" />
              <el-option label="范围" value="range" />
              <el-option label="固定值" value="fixed" />
              <el-option label="枚举" value="enum" />
              <el-option label="正则" value="regex" />
              <el-option label="长度" value="length" />
            </el-select>
            <el-input
              v-if="['range','fixed'].includes(primary(row).constraint.mode)"
              v-model="primary(row).constraint.value" size="small" class="cfg-val" placeholder="值"
            />
            <el-input
              v-else-if="primary(row).constraint.mode === 'regex'"
              v-model="primary(row).constraint.pattern" size="small" class="cfg-val" placeholder="正则"
            />
            <el-input
              v-else-if="primary(row).constraint.mode === 'enum'"
              v-model="row.enumText" size="small" class="cfg-val" placeholder="逗号分隔" @blur="applyEnum(row)"
            />
          </template>
          <el-tag v-else type="info" effect="plain" size="small">—</el-tag>
        </template>
      </el-table-column>

      <!-- 5. 备注说明 -->
      <el-table-column label="备注说明" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.protocol.desc" size="small" placeholder="可选" />
        </template>
      </el-table-column>

      <!-- 操作（固定右侧，横向滚动时始终可见） -->
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Top" size="small" :disabled="row.index === 0" @click="move(row, 'up')" />
          <el-button link type="primary" :icon="Bottom" size="small" :disabled="row.index === rows.length - 1" @click="move(row, 'down')" />
          <el-button
            v-if="row.protocol.category === 'bitstream' && !isSimpleByte(row.protocol)"
            link type="warning" size="small" @click="openByte(row)"
          >高级</el-button>
          <el-popconfirm title="确认删除该字段？" @confirm="remove(row)">
            <template #reference><el-button link type="danger" :icon="Delete" size="small" /></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 位组序流高级编辑（存量多字节/位段兼容） -->
    <el-dialog v-model="byteVisible" title="位组序流高级编辑" width="920px" append-to-body destroy-on-close>
      <div style="height: 460px; overflow: auto">
        <ByteFieldTree v-if="activeProtocol" :protocol="activeProtocol" />
      </div>
    </el-dialog>

    <FieldCreateDialog v-model="createVisible" @create="onCreate" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, Delete, Rank, Top, Bottom, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  useProtocolStore,
  DATA_RULE_CATEGORIES,
  BYTE_DATA_TYPES,
  SCALAR_NUMERIC_ENCODINGS,
  convertProtocolCategory,
} from '@/stores/protocol'
import StructNestedEditor from './StructNestedEditor.vue'
import ByteFieldTree from './ByteFieldTree.vue'
import FieldCreateDialog from './FieldCreateDialog.vue'

const props = defineProps({
  iface: { type: Object, required: true },
})
const store = useProtocolStore()

const CATEGORIES = DATA_RULE_CATEGORIES
const encodingGroups = computed(() => {
  const groups = new Map()
  SCALAR_NUMERIC_ENCODINGS.forEach((item) => {
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group).push(item)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

const rows = computed(() => (props.iface.protocolRefs || []).map((ref, index) => {
  const pid = ref?.protocolId ?? ref
  const protocol = store.protocols.find((p) => p.id === pid) || { id: pid, name: '未知字段', category: 'scalar', fields: [], fileConfig: null, matrixConfig: null, desc: '' }
  const r = { key: protocol.id, ref, protocol, index }
  if (hasConstraint(protocol) && primary(r).constraint?.mode === 'enum') {
    r.enumText = (primary(r).constraint.entries || []).map((e) => e.value).join(',')
  }
  return r
}))

// 共识体行内展开（子字段编辑器直接嵌在表格行下方）
const tableRef = ref(null)
const expandedKeys = ref([])
const onExpandChange = (row, expandedRows) => {
  const id = row?.key ?? row?.protocol?.id
  if (!id) return
  if (expandedRows.some((r) => r.key === id)) {
    if (!expandedKeys.value.includes(id)) expandedKeys.value.push(id)
  } else {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== id)
  }
}
const toggleExpand = (row) => {
  const id = row?.key ?? row?.protocol?.id
  if (!id) return
  if (expandedKeys.value.includes(id)) expandedKeys.value = expandedKeys.value.filter((k) => k !== id)
  else expandedKeys.value.push(id)
}

const primary = (row) => {
  const p = row.protocol
  if (p.category === 'scalar') return p.fields?.[0] || {}
  if (p.category === 'bitstream') return p.fields?.[0] || {}
  return {}
}
const hasConstraint = (protocol) => ['scalar', 'bitstream'].includes(protocol.category)

const isSimpleByte = (protocol) =>
  protocol.category === 'bitstream' &&
  Array.isArray(protocol.fields) &&
  protocol.fields.length === 1 &&
  protocol.fields[0]?.kind === 'byte' &&
  !protocol.fields[0]?.children?.length

const byteSummary = (protocol) => {
  const bytes = (protocol.fields || []).reduce((acc, f) => acc + (f.byteLength || (BYTE_DATA_TYPES.find(b => b.value === f.dataType)?.bytes) || 1), 0)
  return `字节流 · ${bytes} 字节`
}

const onChangeCategory = (row, cat) => {
  convertProtocolCategory(row.protocol, cat)
  if (cat === 'scalar' && !row.protocol.fields?.length) row.protocol.fields = [{}]
  ElMessage.success(`已切换为「${CATEGORIES.find(c => c.value === cat)?.label}」`)
}

const onConstraintChange = (row) => {
  const c = primary(row).constraint
  const m = c.mode
  if (m === 'range') Object.assign(c, { mode: 'range', min: 0, max: 255, value: 0 })
  else if (m === 'fixed') Object.assign(c, { mode: 'fixed', min: 0, max: 0, value: '' })
  else if (m === 'enum') { Object.assign(c, { mode: 'enum', entries: [] }); row.enumText = '' }
  else if (m === 'regex') Object.assign(c, { mode: 'regex', pattern: '' })
  else if (m === 'length') Object.assign(c, { mode: 'length', minLen: 0, maxLen: 256 })
  else Object.assign(c, { mode: 'none' })
}
const applyEnum = (row) => {
  const c = primary(row).constraint
  if (c.mode !== 'enum') return
  c.entries = (row.enumText || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v }))
}

const move = (row, dir) => store.moveMessageField(props.iface, row.ref.protocolId ?? row.ref, dir)
const remove = (row) => store.removeMessageField(props.iface, row.ref.protocolId ?? row.ref)

// 位组序流高级编辑弹窗（存量多字节/位段兼容）
const byteVisible = ref(false)
const activeProtocol = ref(null)
const openByte = (row) => { activeProtocol.value = row.protocol; byteVisible.value = true }

// 新建字段
const createVisible = ref(false)
const onCreate = (payload) => {
  store.addMessageField(props.iface, payload)
  ElMessage.success('字段已添加到报文')
}
</script>

<style scoped lang="scss">
.msg-field-table { display: flex; flex-direction: column; gap: 8px; }
.section-head { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
.field-table {
  :deep(.el-table__cell) { vertical-align: middle; }
  :deep(.drag-col .cell) { display: flex; justify-content: center; }
}
.drag-handle { cursor: grab; color: var(--el-text-color-placeholder); }
.cfg-col { width: 130px; margin-right: 4px; }
.cfg-num { width: 110px; margin: 0 4px; }
.cfg-suffix { font-size: 12px; color: var(--el-text-color-secondary); margin: 0 4px; }
.cfg-val { width: 90px; }
.cfg-struct-trigger { font-size: 12px; }
.cfg-arrow { font-size: 12px; margin-left: 2px; }
.struct-expand-body {
  padding: 10px 12px 12px 16px;
  background: var(--el-fill-color-extra-light);
  border-left: 3px solid var(--el-color-primary-light-5);
}
</style>
