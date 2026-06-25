<template>
  <div class="chart-card" :class="{ 'chart-card--full': full }">
    <div class="chart-card__head">
      <span class="chart-card__title">{{ title }}</span>
      <slot name="extra" />
    </div>
    <div class="chart-card__body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  full: { type: Boolean, default: false },
})
</script>

<style scoped lang="scss">
.chart-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  min-width: 0;

  &--full { margin-bottom: 14px; }
}
.chart-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.chart-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.chart-card__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
