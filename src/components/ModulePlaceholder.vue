<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2>{{ title }}</h2>
        <div class="page__desc">{{ desc }}</div>
      </div>
      <el-tag type="warning" effect="plain">待设计</el-tag>
    </div>

    <el-alert
      title="本模块页面尚在设计中，以下为规划的子功能（来自需求草图）"
      type="info"
      :closable="false"
      show-icon
    />

    <div class="feat-grid">
      <el-card v-for="f in features" :key="f.name" shadow="hover" class="feat-card">
        <div class="feat-card__title">{{ f.name }}</div>
        <div class="feat-card__desc">{{ f.desc }}</div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  features: { type: Array, default: () => [] }
})
</script>

<style scoped lang="scss">
.feat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.feat-card {
  &__title { font-weight: 600; font-size: 15px; margin-bottom: 6px; }
  &__desc { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.5; }
}
</style>
