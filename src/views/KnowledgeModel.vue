<template>
  <div class="page knowledge-model">
    <div class="page__header">
      <div>
        <h2>知识模型管理</h2>
      </div>
    </div>

    <div class="km-body">
      <KnowledgeBase />
    </div>
  </div>
</template>

<script setup>
import KnowledgeBase from '@/components/report/KnowledgeBase.vue'
</script>

<style scoped lang="scss">
.knowledge-model {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.km-body {
  flex: 1;
  min-height: 0;
}
</style>
