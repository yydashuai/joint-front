<template>
  <div class="remark-cell">
    <el-tooltip
      v-if="modelValue"
      :content="modelValue"
      placement="top"
      :show-after="400"
      :disabled="popoverVisible"
    >
      <span class="remark-cell__text">{{ modelValue }}</span>
    </el-tooltip>
    <span v-else class="remark-cell__empty">暂无</span>
    <el-popover
      v-model:visible="popoverVisible"
      trigger="click"
      width="280"
      @show="buf = modelValue || ''"
    >
      <template #reference>
        <el-button link type="primary" size="small" :icon="Edit" />
      </template>
      <el-input
        v-model="buf"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="输入备注信息…"
      />
      <div class="remark-cell__actions">
        <el-button size="small" @click="popoverVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirm">保存</el-button>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Edit } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const popoverVisible = ref(false)
const buf = ref('')

const confirm = () => {
  emit('update:modelValue', buf.value)
  popoverVisible.value = false
}
</script>

<style scoped lang="scss">
.remark-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;

  &__text {
    display: inline-block;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: default;
    vertical-align: middle;
  }

  &__empty {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
}
</style>
