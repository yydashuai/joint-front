<template>
  <el-dialog v-model="visible" title="选择协议类别" width="560px" :close-on-click-modal="false" @close="onClose">
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
import { Connection, Grid } from '@element-plus/icons-vue'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])

const visible = ref(false)
const selected = ref('TCP')

watch(() => props.modelValue, (v) => { visible.value = v }, { immediate: true })
watch(visible, (v) => { if (!v) emit('update:modelValue', false) })

const PROTOCOL_CATEGORIES = [
  { value: 'TCP', label: '字节流协议', desc: '按字节/位定义字段，支持帧结构和校验和', icon: Connection, catLabel: '二进制', tagType: 'warning' },
  { value: 'STRUCT', label: '共识体协议', desc: '使用五类数据规则定义结构化字段，可被多个接口复用', icon: Grid, catLabel: '结构化', tagType: 'success' },
]

const onConfirm = () => {
  emit('select', selected.value)
  visible.value = false
}
const onClose = () => { selected.value = 'TCP' }
</script>

<style scoped lang="scss">
.type-grid { display: flex; flex-direction: column; gap: 10px; }
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
</style>
