<template>
  <el-dialog v-model="visible" title="选择协议类型" width="560px" :close-on-click-modal="false" @close="onClose">
    <div class="type-grid">
      <div
        v-for="t in PROTOCOL_TYPES"
        :key="t.value"
        class="type-card"
        :class="{ 'is-active': selected === t.value }"
        @click="selected = t.value"
      >
        <div class="type-card__icon">
          <el-icon :size="24"><component :is="iconMap[t.value]" /></el-icon>
        </div>
        <div class="type-card__body">
          <div class="type-card__name">{{ t.label }}</div>
          <div class="type-card__desc">{{ t.desc }}</div>
        </div>
        <el-tag size="small" :type="catTagType[t.category]" effect="plain" class="type-card__cat">{{ catLabel[t.category] }}</el-tag>
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
import { PROTOCOL_TYPES } from '@/stores/protocol'
import { Connection, Position, Promotion, SetUp, MessageBox } from '@element-plus/icons-vue'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])

const visible = ref(false)
const selected = ref('TCP')

watch(() => props.modelValue, (v) => { visible.value = v }, { immediate: true })
watch(visible, (v) => { if (!v) emit('update:modelValue', false) })

const iconMap = { TCP: 'Connection', UDP: 'Position', HTTP: 'Promotion', gRPC: 'SetUp', MQ: 'MessageBox' }
const catLabel = { 'byte-stream': '字节流', 'request-response': '请求/响应', rpc: 'RPC', 'message-queue': '消息队列' }
const catTagType = { 'byte-stream': 'warning', 'request-response': 'success', rpc: 'primary', 'message-queue': 'danger' }

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
