<template>
  <!-- 重复组标签（在主表格中使用） -->
  <div class="repeat-group-tag">
    <el-icon><FolderOpened /></el-icon>
    <span class="repeat-group-tag__name">{{ group.name || '重复组' }}</span>
    <el-tag size="small" type="info" effect="plain">
      {{ group.repeatMode === 'fixed' ? `×${group.repeatCount}` : '动态' }}
    </el-tag>
    <span class="repeat-group-tag__size">
      {{ group.groupByteSize || 0 }} 字节/次 · 共 {{ (group.groupByteSize || 0) * (group._effectiveCount || group.repeatCount || 1) }} 字节
    </span>
  </div>
</template>

<script setup>
import { FolderOpened } from '@element-plus/icons-vue'

defineProps({
  group: { type: Object, required: true }
})
</script>

<style scoped lang="scss">
.repeat-group-tag {
  display: flex; align-items: center; gap: 8px; font-size: 13px;
  padding: 4px 0;

  &__name { font-weight: 500; color: var(--el-text-color-primary); }
  &__size {
    font-size: 12px; color: var(--el-text-color-secondary);
    margin-left: 4px;
  }
}
</style>
