<template>
  <div class="stat-card" :class="`stat-card--${tone}`">
    <div class="stat-card__label">{{ label }}</div>
    <div class="stat-card__value">
      <span class="num">{{ display }}</span>
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
    </div>
    <div v-if="hint" class="stat-card__hint">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  suffix: { type: String, default: '' },
  hint: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // default | success | warning | danger | primary
})

const display = computed(() => {
  if (typeof props.value === 'number') return props.value.toLocaleString('en-US')
  return props.value
})
</script>

<style scoped lang="scss">
.stat-card {
  padding: 14px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  border-left: 3px solid var(--el-border-color);
  min-width: 0;

  &--success { border-left-color: var(--el-color-success); }
  &--warning { border-left-color: var(--el-color-warning); }
  &--danger { border-left-color: var(--el-color-danger); }
  &--primary { border-left-color: var(--el-color-primary); }

  &__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }
  &__value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    .num {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .suffix {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
  &__hint {
    margin-top: 6px;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
  }
}
</style>
