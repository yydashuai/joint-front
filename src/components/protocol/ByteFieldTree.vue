<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="protocol.name" class="proto-name" placeholder="协议名称" />
        <div class="proto-head__right">
          <span class="lbl">当前类型</span>
          <el-select :model-value="protocol.type" style="width: 100px" @change="(v) => $emit('switchType', v)">
            <el-option v-for="t in PROTOCOL_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <span class="lbl">字节序</span>
          <el-select v-model="protocol.config.endian" style="width: 120px">
            <el-option v-for="e in ENDIANS" :key="e.value" :label="e.label" :value="e.value" />
          </el-select>
          <el-button :icon="Upload" @click="$emit('import')">导入</el-button>
          <el-button :icon="Download" @click="$emit('export')">导出</el-button>
          <el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button>
          <el-popconfirm title="删除该协议？" @confirm="$emit('delete')">
            <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </template>

    <div class="field-label">备注说明</div>
    <el-input v-model="protocol.desc" placeholder="可选，描述该协议的用途" class="proto-desc" />

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

    <!-- 协议总报文摘要 -->
    <div class="summary-bar">
      <span class="summary-bar__item">总长度：<b>{{ totalBytes }}</b> 字节</span>
      <span class="summary-bar__item">字段数：<b>{{ protocol.config.fields.length }}</b></span>
      <span class="summary-bar__item">字节序：<b>{{ protocol.config.endian === 'big' ? '大端 BE' : '小端 LE' }}</b></span>
      <span class="summary-bar__item">类型：<b>{{ protocol.type }}</b></span>
    </div>

    <!-- 字节/位树形表格 -->
    <el-table
      ref="tableRef"
      :data="protocol.config.fields"
      row-key="id"
      border
      size="small"
      class="byte-tree"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      :default-expand-all="false"
      @row-contextmenu="onRowCtx"
    >
      <el-table-column label="偏移" width="120" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <code class="offset-hex">0x{{ row.byteOffset.toString(16).toUpperCase().padStart(2, '0') }}</code>
          </template>
          <template v-else>
            <span class="bit-pos">bit[{{ row.bitStart }}{{ row.bitEnd !== row.bitStart ? ':' + row.bitEnd : '' }}]</span>
          </template>
        </template>
      </el-table-column>

      <el-table-column label="单位" width="100" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <el-select
              :model-value="row.bitMode ? 'bit' : 'byte'"
              size="small"
              style="width: 64px"
              @change="(v) => toggleUnit(row, v)"
            >
              <el-option label="字节" value="byte" />
              <el-option label="比特" value="bit" />
            </el-select>
          </template>
          <el-tag v-else size="small" type="warning" effect="plain">位</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="长度" width="120" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <template v-if="row.bitMode">
              <span class="locked-len">1 字节</span>
            </template>
            <el-input-number v-else v-model="row.byteLength" :min="1" :max="1024" size="small" controls-position="right" style="width: 74px" @change="onFieldChange" />
          </template>
          <template v-else>
            <el-select
              :model-value="Math.abs(row.bitStart - row.bitEnd) + 1"
              size="small"
              style="width: 74px"
              :class="{ 'bit-len-over': isBitsOver(row) }"
              @change="(len) => onBitLenChange(row, len)"
            >
              <el-option
                v-for="n in getMaxFieldLen(row)"
                :key="n"
                :label="n + ' 位'"
                :value="n"
              />
            </el-select>
          </template>
        </template>
      </el-table-column>

      <el-table-column label="字段名（语义）" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" placeholder="字段名" />
        </template>
      </el-table-column>

      <el-table-column label="取值约束" width="260">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte' && row.bitMode">
            <span class="constraint-na">—</span>
          </template>
          <div v-else class="constraint">
            <el-select v-model="row.constraint.mode" size="small" class="c-mode">
              <el-option label="范围" value="range" />
              <el-option label="固定值" value="fixed" />
            </el-select>
            <template v-if="row.constraint.mode === 'range'">
              <el-input-number v-model="row.constraint.min" :controls="false" size="small" class="c-num" />
              <span class="c-sep">~</span>
              <el-input-number v-model="row.constraint.max" :controls="false" size="small" class="c-num" />
            </template>
            <el-input-number v-else v-model="row.constraint.value" :controls="false" size="small" class="c-num c-num--fixed" />
          </div>
        </template>
      </el-table-column>

      <el-table-column label="备注说明" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.desc" size="small" placeholder="如 1=加密，0=明文" />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <el-button v-if="!row.bitMode" text size="small" :icon="Plus" title="切换到位模式" @click="toggleUnit(row, 'bit')" />
            <el-button v-else text size="small" :icon="Plus" title="添加位子段" :disabled="getBitsUsedInField(row) >= row.byteLength * 8" @click="addBitChild(row)" />
            <el-popconfirm title="删除该字段？" @confirm="removeField(row.id)">
              <template #reference>
                <el-button text size="small" :icon="Delete" title="删除" />
              </template>
            </el-popconfirm>
          </template>
          <template v-else>
            <el-popconfirm title="删除该位段？" @confirm="removeBitChild(row)">
              <template #reference>
                <el-button text size="small" :icon="Delete" title="删除" />
              </template>
            </el-popconfirm>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-button class="add-row" :icon="Plus" @click="addByteRow">添加字节字段</el-button>

    <!-- 行右键菜单 -->
    <teleport to="body">
      <div v-if="rowCtx.visible" class="ctx-mask" @click="rowCtx.visible = false" @contextmenu.prevent="rowCtx.visible = false">
        <ul class="ctx-menu" :style="{ left: rowCtx.x + 'px', top: rowCtx.y + 'px' }" @click.stop>
          <li v-if="rowCtx.row?.kind === 'byte' && !rowCtx.row?.bitMode" @click="toggleUnit(rowCtx.row, 'bit'); rowCtx.visible = false">切换到位模式</li>
          <li v-if="rowCtx.row?.kind === 'byte' && rowCtx.row?.bitMode && getBitsUsedInField(rowCtx.row) < rowCtx.row.byteLength * 8" @click="addBitChild(rowCtx.row); rowCtx.visible = false">添加位子段</li>
          <li @click="duplicateField(rowCtx.row); rowCtx.visible = false">复制字段</li>
          <li class="danger" @click="removeField(rowCtx.row?.id); rowCtx.visible = false">删除</li>
        </ul>
      </div>
    </teleport>
  </el-card>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Upload, Download, Check } from '@element-plus/icons-vue'
import { PROTOCOL_TYPES, ENDIANS, makeByteField, makeBitField, range, fixed } from '@/stores/protocol'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['import', 'export', 'delete', 'save', 'systemChange', 'switchType'])

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

// ---- 脏数据追踪：保存按钮动态变色 ----
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

const totalBytes = computed(() => {
  return props.protocol.config.fields.reduce((sum, f) => sum + (f.byteLength || 0), 0)
})

// ---- 位字段辅助函数 ----

// 查找位子段的父字节字段
const findParentByteField = (bitRow) => {
  for (const f of props.protocol.config.fields) {
    if (f.children?.some(c => c.id === bitRow.id)) return f
  }
  return null
}

// 字节字段已使用的比特数（模板用于操作列按钮禁用判断）
const getBitsUsedInField = (byteField) => {
  if (!byteField.children?.length) return 0
  return byteField.children.reduce((sum, c) => sum + Math.abs(c.bitStart - c.bitEnd) + 1, 0)
}

// 位字段所在字节的已用比特数（模板用于长度列标红判断）
const getUsedBits = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (!parent) return 0
  return getBitsUsedInField(parent)
}

// 位字段可选的最大长度 = 最大比特数 - 兄弟已用比特数
const getMaxFieldLen = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (!parent) return 1
  const totalBits = parent.byteLength * 8
  const siblingBits = parent.children
    .filter(c => c.id !== bitRow.id)
    .reduce((sum, c) => sum + Math.abs(c.bitStart - c.bitEnd) + 1, 0)
  return Math.max(1, totalBits - siblingBits)
}

// 位字段是否超限（模板用于标红样式）
const isBitsOver = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (!parent) return false
  return getBitsUsedInField(parent) > parent.byteLength * 8
}

// 位字段长度变更处理：保持 bitStart 不变，调整 bitEnd
const onBitLenChange = (bitRow, newLen) => {
  bitRow.bitEnd = Math.max(0, bitRow.bitStart - newLen + 1)
}

// 自动重算偏移 + 校验
watch(() => props.protocol.config.fields, () => {
  let offset = 0
  for (const f of props.protocol.config.fields) {
    f.byteOffset = offset
    offset += f.byteLength
  }
  // 校验：位字段总数不能超过字节的比特数
  for (const f of props.protocol.config.fields) {
    if (f.children?.length) {
      const totalBits = f.byteLength * 8
      const usedBits = getBitsUsedInField(f)
      if (usedBits > totalBits) {
        ElMessage.warning(`字段「${f.name}」的位字段总长度（${usedBits}）超过字节长度（${totalBits} 位）`)
      }
    }
  }
}, { deep: true })

const onFieldChange = () => {
  // 偏移在 watch 中自动重算
}

const addByteRow = () => {
  const fields = props.protocol.config.fields
  // 防呆：上一个字节如有位子段，先补全空缺位
  if (fields.length > 0) {
    const prev = fields[fields.length - 1]
    if (prev.children?.length) {
      fillRemainingBits(prev)
    }
  }
  const offset = fields.length > 0 ? fields[fields.length - 1].byteOffset + fields[fields.length - 1].byteLength : 0
  fields.push(makeByteField({ name: `字段${fields.length + 1}`, byteOffset: offset }))
}

const addBitChild = (byteField) => {
  const totalBits = byteField.byteLength * 8
  const used = getBitsUsedInField(byteField)
  if (used >= totalBits) {
    ElMessage.warning('该字节所有位已分配完毕，无法添加更多位字段')
    return
  }
  const children = byteField.children
  // 找到当前最低已用位，新字段从该位下方开始
  const lowestBit = children.length > 0 ? Math.min(...children.map(c => c.bitEnd)) : totalBits
  const newStart = lowestBit > 0 ? lowestBit - 1 : 0
  // 默认长度 1 位，用户可通过下拉框自行调整
  children.push(makeBitField({
    name: `位段${children.length + 1}`,
    bitStart: newStart,
    bitEnd: newStart
  }))
}

// 切换单位：字节 ↔ 比特
const toggleUnit = async (byteField, newUnit) => {
  if (newUnit === 'bit') {
    // 切到位模式：锁定 1 字节，标记 bitMode，留空给用户手动配置
    byteField.byteLength = 1
    byteField.bitMode = true
  } else {
    // 切回字节模式：需确认清除位子段
    if (byteField.children.length) {
      try {
        await ElMessageBox.confirm('切换回字节模式将清除所有位子段，是否继续？', '确认', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
      } catch {
        return // 用户取消
      }
      byteField.children.splice(0)
    }
    byteField.bitMode = false
  }
}

// 自动填充未占用的位为「保留位 / fixed 0」
const fillRemainingBits = (byteField) => {
  const totalBits = byteField.byteLength * 8 // 通常为 8
  const children = byteField.children

  if (!children.length) {
    // 没有任何子段 → 创建一个覆盖所有位的保留位
    children.push(makeBitField({
      name: '保留位',
      bitStart: totalBits - 1,
      bitEnd: 0,
      constraint: fixed(0),
      desc: '未使用位，固定为 0'
    }))
    return
  }

  // 已有部分子段 → 填充空隙
  const sorted = [...children].sort((a, b) => b.bitStart - a.bitStart) // 高位在前
  const gaps = []

  // 顶部空隙：从 (totalBits-1) 到最高位子段的 bitStart+1
  if (sorted[0].bitStart < totalBits - 1) {
    gaps.push({ start: totalBits - 1, end: sorted[0].bitStart + 1 })
  }

  // 中间空隙
  for (let i = 0; i < sorted.length - 1; i++) {
    const upperEnd = sorted[i].bitEnd
    const lowerStart = sorted[i + 1].bitStart
    if (upperEnd - lowerStart > 1) {
      gaps.push({ start: upperEnd - 1, end: lowerStart + 1 })
    }
  }

  // 底部空隙：从最低位子段的 bitEnd-1 到 0
  const bottomEnd = sorted[sorted.length - 1].bitEnd
  if (bottomEnd > 0) {
    gaps.push({ start: bottomEnd - 1, end: 0 })
  }

  // 插入保留位
  for (const gap of gaps) {
    children.push(makeBitField({
      name: '保留位',
      bitStart: gap.start,
      bitEnd: gap.end,
      constraint: fixed(0),
      desc: '未使用位，固定为 0'
    }))
  }

  // 按 bitStart 降序排列（高位在前）
  children.sort((a, b) => b.bitStart - a.bitStart)
}

const removeField = (id) => {
  const fields = props.protocol.config.fields
  const i = fields.findIndex(f => f.id === id)
  if (i >= 0) fields.splice(i, 1)
}

const removeBitChild = (bitRow) => {
  for (const f of props.protocol.config.fields) {
    const ci = f.children?.findIndex(c => c.id === bitRow.id)
    if (ci >= 0) { f.children.splice(ci, 1); return }
  }
}

const duplicateField = (row) => {
  if (!row) return
  if (row.kind === 'byte') {
    const copy = makeByteField({ ...row, name: row.name + '(副本)', children: row.children.map(c => makeBitField({ ...c })) })
    props.protocol.config.fields.push(copy)
  }
}

// 暴露给父组件：导出前补全所有空缺位
const fillAllGaps = () => {
  for (const f of props.protocol.config.fields) {
    if (f.children?.length) {
      const totalBits = f.byteLength * 8
      const usedBits = getBitsUsedInField(f)
      if (usedBits < totalBits) {
        fillRemainingBits(f)
      }
    }
  }
}
defineExpose({ fillAllGaps, markClean })

// 行右键
const rowCtx = reactive({ visible: false, x: 0, y: 0, row: null })
const onRowCtx = (row, col, event) => {
  event.preventDefault()
  Object.assign(rowCtx, { visible: true, x: event.clientX, y: event.clientY, row })
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }

.summary-bar {
  display: flex; gap: 20px; padding: 8px 12px; margin-bottom: 12px;
  background: var(--el-fill-color-light); border-radius: 6px; font-size: 13px;
  &__item { color: var(--el-text-color-secondary); b { color: var(--el-text-color-primary); } }
}

.byte-tree {
  flex: 1;
  :deep(.el-select) { .el-input__wrapper { padding: 0 8px; } }
}

.offset-hex {
  font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 12px;
  color: var(--el-color-primary); background: var(--el-fill-color); padding: 1px 6px; border-radius: 3px;
}
.bit-pos {
  display: inline-block; min-width: 56px; text-align: center; box-sizing: border-box;
  font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 11px;
  color: var(--el-color-warning); background: var(--el-color-warning-light-9);
  padding: 2px 6px; border-radius: 3px; line-height: 1.4;
}
.bit-len { font-size: 12px; color: var(--el-text-color-secondary); }
.locked-len { font-size: 12px; color: var(--el-text-color-secondary); font-style: italic; }
.constraint-na { font-size: 13px; color: var(--el-text-color-placeholder); }

.bit-len-over {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
    background: var(--el-color-danger-light-9);
  }
}

.constraint { display: flex; align-items: center; gap: 4px; }
.c-mode { width: 78px; flex-shrink: 0; }
.c-num { width: 56px; }
.c-num--fixed { width: 130px; }
.c-sep { color: var(--el-text-color-secondary); flex-shrink: 0; }

.add-row { margin-top: 12px; width: 100%; border-style: dashed; }

/* 右键菜单 */
.ctx-mask { position: fixed; inset: 0; z-index: 3000; }
.ctx-menu {
  position: fixed; min-width: 150px; padding: 4px 0;
  background: var(--el-bg-color-overlay, #fff); border: 1px solid var(--el-border-color-light);
  border-radius: 6px; box-shadow: var(--el-box-shadow-light); font-size: 13px;
  li {
    list-style: none; padding: 7px 16px; cursor: pointer; color: var(--el-text-color-primary);
    &:hover { background: var(--el-fill-color-light); }
    &.danger { color: var(--el-color-danger); }
  }
}
</style>
