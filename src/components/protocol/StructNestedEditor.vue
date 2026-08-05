<template>
  <div class="nested-editor">
    <!-- 顶部标题栏：添加子字段按钮放在这里，不放在末尾 -->
    <div class="nested-head">
      <span class="nested-title">子字段</span>
      <el-button size="small" type="primary" plain :icon="Plus" @click="addSibling(fields.length)">添加子字段</el-button>
    </div>

    <el-table
      :data="rows"
      border
      size="small"
      row-key="key"
      class="nested-table"
      :expand-row-keys="expandedKeys"
      @expand-change="onExpandChange"
      empty-text="暂无子字段"
    >
      <!-- 共识体子字段：同主表方式，行内展开（支持 2-N 层嵌套） -->
      <el-table-column type="expand" width="34">
        <template #default="{ row }">
          <div v-if="row.model.type === 'struct'" class="nested-expand-body">
            <StructNestedEditor :fields="row.model.children" />
          </div>
        </template>
      </el-table-column>

      <!-- 字段名 -->
      <el-table-column label="字段名" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.model.name" size="small" placeholder="字段名" />
        </template>
      </el-table-column>

      <!-- 数据类型（标量 / 共识体） -->
      <el-table-column label="数据类型" width="120" align="center">
        <template #default="{ row }">
          <el-select :model-value="row.model.type" size="small" @change="(v) => onChangeType(row, v)">
            <el-option label="标量" value="scalar" />
            <el-option label="共识体" value="struct" />
          </el-select>
        </template>
      </el-table-column>

      <!-- 具体配置 -->
      <el-table-column label="具体配置" min-width="320">
        <template #default="{ row }">
          <!-- 标量 -->
          <template v-if="row.model.type === 'scalar'">
            <el-select v-model="row.model.encoding" size="small" class="cfg-col" filterable>
              <el-option-group v-for="g in encodingGroups" :key="g.label" :label="g.label">
                <el-option v-for="o in g.items" :key="o.value" :label="o.label" :value="o.value" />
              </el-option-group>
            </el-select>
          </template>
          <!-- 共识体：展开触发器 -->
          <template v-else>
            <el-button size="small" link type="primary" class="cfg-struct-trigger" @click="toggleExpand(row)">
              {{ (row.model.children || []).length }} 个子字段
              <el-icon class="cfg-arrow"><ArrowDown /></el-icon>
            </el-button>
          </template>
        </template>
      </el-table-column>

      <!-- 取值约束 -->
      <el-table-column label="取值约束" width="270">
        <template #default="{ row }">
          <template v-if="row.model.type === 'scalar'">
            <el-select v-model="row.model.constraint.mode" size="small" class="cfg-col" @change="onConstraintChange(row.model)">
              <el-option label="无" value="none" />
              <el-option label="范围" value="range" />
              <el-option label="固定值" value="fixed" />
              <el-option label="枚举" value="enum" />
              <el-option label="正则" value="regex" />
              <el-option label="长度" value="length" />
            </el-select>
            <el-input
              v-if="['range','fixed'].includes(row.model.constraint.mode)"
              v-model="row.model.constraint.value" size="small" class="cfg-val" placeholder="值"
            />
            <el-input
              v-else-if="row.model.constraint.mode === 'regex'"
              v-model="row.model.constraint.pattern" size="small" class="cfg-val" placeholder="正则"
            />
            <el-input
              v-else-if="row.model.constraint.mode === 'enum'"
              v-model="row.enumText" size="small" class="cfg-val" placeholder="逗号分隔" @blur="applyEnum(row)"
            />
          </template>
          <el-tag v-else type="info" effect="plain" size="small">—</el-tag>
        </template>
      </el-table-column>

      <!-- 备注说明 -->
      <el-table-column label="备注说明" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.model.desc" size="small" placeholder="可选" />
        </template>
      </el-table-column>

      <!-- 操作（固定右侧，横向滚动时始终可见） -->
      <el-table-column label="操作" width="130" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Top" size="small" :disabled="row.index === 0" @click="move(row, 'up')" />
          <el-button link type="primary" :icon="Bottom" size="small" :disabled="row.index === rows.length - 1" @click="move(row, 'down')" />
          <el-popconfirm title="确认删除该子字段？" @confirm="removeAt(row.index)">
            <template #reference><el-button link type="danger" :icon="Delete" size="small" /></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, Delete, Top, Bottom, ArrowDown } from '@element-plus/icons-vue'
import { SCALAR_NUMERIC_ENCODINGS, makeParam } from '@/stores/protocol'

const props = defineProps({
  fields: { type: Array, required: true },
})

const encodingGroups = computed(() => {
  const groups = new Map()
  SCALAR_NUMERIC_ENCODINGS.forEach((item) => {
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group).push(item)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

const rows = computed(() => (props.fields || []).map((model, index) => ({ key: model.id, model, index })))

const ensureRow = (row) => {
  if (!row.constraint) row.constraint = { mode: 'none' }
  if (!Array.isArray(row.children)) row.children = []
  return row
}

const onChangeType = (row, type) => {
  row.model.type = type
  if (type === 'struct') {
    row.model.encoding = ''
    if (!row.model.children.length) {
      row.model.children = [ensureRow(makeParam({ name: `子字段1`, type: 'scalar', encoding: 'uint8' }))]
    }
  } else {
    row.model.children = []
    if (!row.model.encoding) row.model.encoding = 'uint8'
  }
}
const onConstraintChange = (model) => {
  const m = model.constraint.mode
  if (m === 'range') model.constraint = { mode: 'range', min: 0, max: 255, value: 0 }
  else if (m === 'fixed') model.constraint = { mode: 'fixed', min: 0, max: 0, value: '' }
  else if (m === 'enum') { model.enumText = ''; model.constraint = { mode: 'enum', entries: [] } }
  else if (m === 'regex') model.constraint = { mode: 'regex', pattern: '' }
  else if (m === 'length') model.constraint = { mode: 'length', minLen: 0, maxLen: 256 }
  else model.constraint = { mode: 'none' }
}
const applyEnum = (row) => {
  const c = row.model.constraint
  if (c.mode !== 'enum') return
  c.entries = (row.enumText || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v }))
}

// 共识体行内展开（与主表一致）
const expandedKeys = ref([])
const onExpandChange = (row, expandedRows) => {
  const id = row?.key ?? row?.model?.id
  if (!id) return
  if (expandedRows.some((r) => r.key === id)) {
    if (!expandedKeys.value.includes(id)) expandedKeys.value.push(id)
  } else {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== id)
  }
}
const toggleExpand = (row) => {
  const id = row?.key ?? row?.model?.id
  if (!id) return
  if (expandedKeys.value.includes(id)) expandedKeys.value = expandedKeys.value.filter((k) => k !== id)
  else expandedKeys.value.push(id)
}

const addSibling = (idx) => {
  const row = ensureRow(makeParam({ name: `子字段${props.fields.length + 1}`, type: 'scalar', encoding: 'uint8' }))
  props.fields.splice(idx, 0, row)
}
const move = (row, dir) => {
  const idx = row.index
  const newIdx = dir === 'up' ? idx - 1 : idx + 1
  if (newIdx < 0 || newIdx >= props.fields.length) return
  const [m] = props.fields.splice(idx, 1)
  props.fields.splice(newIdx, 0, m)
}
const removeAt = (idx) => props.fields.splice(idx, 1)
</script>

<style scoped lang="scss">
.nested-editor { display: flex; flex-direction: column; gap: 8px; }
.nested-head { display: flex; align-items: center; justify-content: space-between; }
.nested-title { font-size: 13px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary-light-5); }
.nested-table {
  :deep(.el-table__cell) { vertical-align: middle; }
}
.nested-expand-body {
  padding: 10px 12px 12px 16px;
  background: var(--el-fill-color-extra-light);
  border-left: 3px solid var(--el-color-primary-light-5);
}
.cfg-col { width: 130px; margin-right: 4px; }
.cfg-val { width: 90px; }
.cfg-struct-trigger { font-size: 12px; }
.cfg-arrow { font-size: 12px; margin-left: 2px; }
</style>
