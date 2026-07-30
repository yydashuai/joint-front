<template>
  <el-dialog v-model="visible" title="选择字段类别" width="760px" :close-on-click-modal="false" @close="onClose">
    <div class="type-grid">
      <div
        v-for="t in PROTOCOL_CATEGORIES"
        :key="t.value"
        class="type-card"
        :class="{ 'is-active': selected === t.value }"
        @click="selected = t.value"
      >
        <div class="type-card__icon">
          <el-icon :size="24"><component :is="t.icon" /></el-icon>
        </div>
        <div class="type-card__body">
          <div class="type-card__name">{{ t.label }}</div>
          <div class="type-card__desc">{{ t.desc }}</div>
        </div>
        <el-tag size="small" :type="t.tagType" effect="plain" class="type-card__cat">{{ t.catLabel }}</el-tag>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!selected" @click="onConfirm">确定创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Connection, DataAnalysis, Document, Grid, Operation } from '@element-plus/icons-vue'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])

const visible = ref(false)
const selected = ref('scalar')

watch(() => props.modelValue, (v) => { visible.value = v }, { immediate: true })
watch(visible, (v) => { if (!v) emit('update:modelValue', false) })

const PROTOCOL_CATEGORIES = [
  { value: 'scalar', label: '标量', desc: '定义一个基础类型变量，如 uint8、uint16、float32', icon: DataAnalysis, catLabel: '单变量', tagType: 'primary' },
  { value: 'struct', label: '共识体', desc: '配置多个基础变量，或引用并展开其他共识体字段', icon: Grid, catLabel: '树结构', tagType: 'success' },
  { value: 'bitstream', label: '位组序流', desc: '使用数据矩阵按字节或比特混合定义连续位序列', icon: Connection, catLabel: '二进制', tagType: 'warning' },
  { value: 'file', label: '流文件', desc: '配置作为报文数据体的二进制流文件及其格式信息', icon: Document, catLabel: '一维数据', tagType: 'info' },
  { value: 'matrix', label: '结构矩阵', desc: '配置二维数据矩阵文件、行列结构与存储格式', icon: Operation, catLabel: '二维数据', tagType: 'danger' },
]

const onConfirm = () => {
  emit('select', selected.value)
  visible.value = false
}
const onClose = () => { selected.value = 'scalar' }
</script>

<style scoped lang="scss">
.type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.type-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border: 1px solid var(--el-border-color); border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
  &:hover { border-color: var(--el-color-primary-light-3); background: var(--el-fill-color-light); }
  &.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
  &__icon { color: var(--el-text-color-secondary); flex-shrink: 0; }
  &.is-active &__icon { color: var(--el-color-primary); }
  &__body { flex: 1; min-width: 0; }
  &__name { font-size: 14px; font-weight: 600; }
  &__desc { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
  &__cat { flex-shrink: 0; }
}
.type-card:last-child { grid-column: 1 / -1; }
@media (max-width: 720px) {
  .type-grid { grid-template-columns: 1fr; }
  .type-card:last-child { grid-column: auto; }
}
</style>
