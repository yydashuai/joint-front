<template>
  <div class="fnode" ref="rootEl">
    <div class="fnode__card" :class="[`type--${typeClass}`, { 'has-children': hasChildren }]" ref="cardEl">
      <div class="fnode__head">
        <span class="fnode__name">{{ node.name || '(未命名)' }}</span>
        <el-tag size="small" :type="tagType" effect="light" disable-transitions>{{ typeLabel }}</el-tag>
      </div>
      <el-tooltip v-if="node.desc" :content="node.desc" placement="top" :show-after="250">
        <div class="fnode__desc">{{ node.desc }}</div>
      </el-tooltip>
      <div class="fnode__meta">{{ meta }}</div>
      <div class="fnode__ops">
        <el-tooltip content="编辑该节点"><el-button text size="small" :icon="Edit" @click="actions.onEdit(node)" /></el-tooltip>
        <el-tooltip content="添加子节点"><el-button v-if="canAddChild" text size="small" :icon="Plus" @click="actions.onAddChild(node)" /></el-tooltip>
        <el-popconfirm title="确认删除该节点？" @confirm="actions.onRemove(node)">
          <template #reference><el-button text size="small" :icon="Delete" /></template>
        </el-popconfirm>
      </div>
    </div>

    <div v-if="hasChildren" class="fnode__children">
      <div v-for="c in node.children" :key="c.id" class="fnode__child">
        <FieldNode :node="c" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Edit, Plus, Delete } from '@element-plus/icons-vue'
import { useProtocolStore, DATA_RULE_CATEGORY_MAP } from '@/stores/protocol'

const props = defineProps({ node: { type: Object, required: true } })
const actions = inject('treeActions')
const store = useProtocolStore()

const rootEl = ref(null)
const cardEl = ref(null)

// 五类数据规则: scalar(标量) / bitstream(位组序流) / struct(共识体) / matrix(结构矩阵) / file(流文件)
// 也兼容旧类型名: bytes→bitstream, array→matrix
const VALID_TYPES = { scalar: true, bitstream: true, struct: true, matrix: true, file: true }
const isV2Type = computed(() => !!VALID_TYPES[props.node.type])
const isStructLike = computed(() => props.node.type === 'struct' || props.node.type === '共识体')
const isMatrixLike = computed(() => props.node.type === 'matrix' || props.node.type === '结构矩阵')

// 显示用 label: 优先显示五类标准中文名
const typeLabel = computed(() => {
  if (isV2Type.value) {
    return DATA_RULE_CATEGORY_MAP[props.node.type]?.label || props.node.type
  }
  // 兼容旧中文名
  const v1Map = { '常量': '标量', '位组序流': '位组序流', '共识体': '共识体', '流文件': '流文件', '结构矩阵': '结构矩阵' }
  return v1Map[props.node.type] || props.node.type
})

const hasChildren = computed(() =>
  (isStructLike.value || isMatrixLike.value) && props.node.children.length > 0
)
const canAddChild = computed(() => isStructLike.value || isMatrixLike.value)

// 五类数据规则配色
const tagMapV2 = { scalar: 'info', bitstream: 'warning', struct: 'success', matrix: 'danger', file: 'primary' }
// 旧类型兼容色
const tagMapV1 = { 常量: 'info', 位组序流: 'warning', 共识体: 'success', 流文件: 'primary', 结构矩阵: 'danger' }
const tagType = computed(() => isV2Type.value ? tagMapV2[props.node.type] : tagMapV1[props.node.type] || 'info')

const typeClassV2 = { scalar: 'const', bitstream: 'bits', struct: 'struct', matrix: 'matrix', file: 'file' }
const typeClassV1 = { 常量: 'const', 位组序流: 'bits', 共识体: 'struct', 流文件: 'file', 结构矩阵: 'matrix' }
const typeClass = computed(() => isV2Type.value ? typeClassV2[props.node.type] : typeClassV1[props.node.type] || 'const')

const meta = computed(() => {
  const n = props.node
  // 五类标准类型渲染
  if (isV2Type.value) {
    switch (n.type) {
      case 'scalar': return n.encoding || 'uint8'
      case 'bitstream': return n.protocolRef ? `协议：${store.protocolName(n.protocolRef)}` : '未绑定协议'
      case 'struct': return `${n.children.length} 个字段`
      case 'matrix': return `${n.children.length} 列 × 结构矩阵`
      case 'file': return n.fileName || '未上传'
      default: return ''
    }
  }
  // 旧类型兼容渲染
  switch (n.type) {
    case '常量': return n.dataType
    case '位组序流': return n.protocolRef ? `协议：${store.protocolName(n.protocolRef)}` : '未绑定协议'
    case '共识体': return `${n.children.length} 个字段`
    case '流文件': return '文本文件'
    case '结构矩阵': return '表格文件'
    default: return ''
  }
})
</script>

<style scoped lang="scss">
.fnode {
  display: flex;
  align-items: center;
}

.fnode__card {
  position: relative;
  flex-shrink: 0;
  width: 184px;
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-left: 3px solid var(--el-color-info);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &.type--const { border-left-color: var(--el-color-info); }
  &.type--bits { border-left-color: var(--el-color-warning); }
  &.type--struct { border-left-color: var(--el-color-success); }
  &.type--file { border-left-color: var(--el-color-primary); }
  &.type--matrix { border-left-color: var(--el-color-danger); }

  /* 连接到子节点的横向短线 */
  &.has-children::after {
    content: '';
    position: absolute;
    right: -16px;
    top: 50%;
    width: 16px;
    border-top: 1px solid var(--el-border-color-darker);
  }
}

.fnode__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 2px;
}
.fnode__name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fnode__desc {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}
.fnode__meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fnode__ops {
  display: flex;
  gap: 0;
  margin-top: 4px;
  :deep(.el-button + .el-button) { margin-left: 0; }
}

/* 子节点列 + 连接线 */
.fnode__children {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-left: 32px;
}
.fnode__child {
  position: relative;
  /* 横向短线（连到竖向脊线） */
  &::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 50%;
    width: 16px;
    border-top: 1px solid var(--el-border-color-darker);
  }
  /* 竖向脊线段 */
  &::after {
    content: '';
    position: absolute;
    left: -16px;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--el-border-color-darker);
  }
  &:first-child::after { top: 50%; }
  &:last-child::after { bottom: 50%; }
  &:only-child::after { display: none; }
}
</style>
