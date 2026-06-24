<template>
  <div class="fnode" ref="rootEl">
    <div class="fnode__card" :class="[`type--${typeClass}`, { 'has-children': hasChildren }]" ref="cardEl">
      <div class="fnode__head">
        <span class="fnode__name">{{ node.name || '(未命名)' }}</span>
        <el-tag size="small" :type="tagType" effect="light" disable-transitions>{{ node.type }}</el-tag>
      </div>
      <el-tooltip v-if="node.desc" :content="node.desc" placement="top" :show-after="250">
        <div class="fnode__desc">{{ node.desc }}</div>
      </el-tooltip>
      <div class="fnode__meta">{{ meta }}</div>
      <div class="fnode__ops">
        <el-button text size="small" :icon="Edit" @click="actions.onEdit(node)" />
        <el-button v-if="node.type === '共识体'" text size="small" :icon="Plus" @click="actions.onAddChild(node)" />
        <el-button text size="small" :icon="Delete" @click="actions.onRemove(node)" />
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
import { useProtocolStore } from '@/stores/protocol'

const props = defineProps({ node: { type: Object, required: true } })
const actions = inject('treeActions')
const store = useProtocolStore()

const rootEl = ref(null)
const cardEl = ref(null)

const hasChildren = computed(() => props.node.type === '共识体' && props.node.children.length > 0)

const tagMap = { 常量: 'info', 位组序流: 'warning', 共识体: 'success', 流文件: 'primary', 结构矩阵: 'danger' }
const tagType = computed(() => tagMap[props.node.type] || 'info')
const typeClass = computed(() => ({ 常量: 'const', 位组序流: 'bits', 共识体: 'struct', 流文件: 'file', 结构矩阵: 'matrix' }[props.node.type] || 'const'))

const meta = computed(() => {
  const n = props.node
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
