<template>
  <el-card shadow="never" class="exec-card">
    <template #header>
      <div class="card-head">
        <div>
          <span class="card-title">执行时序预览</span>
          <span class="card-sub">按计划顺序展开，宽度反映本轮请求压力</span>
        </div>
        <el-tag effect="plain">{{ modeLabel }}</el-tag>
      </div>
    </template>

    <div v-if="!items.length" class="muted">加入任务后生成时序条。</div>
    <div v-else class="timeline">
      <div class="timeline__axis">
        <span>开始</span>
        <span>执行中</span>
        <span>结束</span>
      </div>
      <div class="timeline__track">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          class="timeline__block"
          :class="{ 'timeline__block--hot': store.config.mode !== 'smoke' }"
          :style="{ flexGrow: blockGrow(item) }"
        >
          <span class="timeline__idx">{{ idx + 1 }}</span>
          <strong>{{ item.task.name }}</strong>
          <small>{{ item.estimatedRequests }} 请求 · 约 {{ estimateSeconds(item) }}s</small>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useExecutionStore } from '@/stores/execution'

const store = useExecutionStore()
const items = computed(() => store.planItems)
const modeLabel = computed(() => ({
  smoke: '冒烟',
  stress: '压测',
  endurance: '耐久',
}[store.config.mode]))

const blockGrow = (item) => Math.max(1, Math.min(6, Math.round(item.estimatedRequests / 12)))
const estimateSeconds = (item) => {
  if (store.config.mode === 'stress') return Math.max(3, Math.round(item.estimatedRequests / Math.max(1, store.config.stress.threadCount)))
  if (store.config.mode === 'endurance') return store.config.endurance.durationMinutes * 60
  return Math.max(2, item.baseRequests)
}
</script>

<style scoped lang="scss">
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.card-sub, .muted { color: var(--el-text-color-secondary); font-size: 12px; }
.timeline { display: flex; flex-direction: column; gap: 8px; }
.timeline__axis { display: flex; justify-content: space-between; color: var(--el-text-color-placeholder); font-size: 12px; }
.timeline__track { display: flex; gap: 8px; min-height: 82px; padding: 8px; border-radius: 8px; background: linear-gradient(90deg, #f5f7fb, #eef5f3); overflow-x: auto; }
.timeline__block {
  min-width: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 7px;
  color: #163147;
  background: #d8e8ff;
  border: 1px solid #b8d5ff;
  box-shadow: inset 0 -2px 0 rgba(47, 111, 235, 0.16);
}
.timeline__block--hot { background: #dff2e7; border-color: #b9dfc8; color: #183a29; }
.timeline__idx {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255,255,255,.7);
  font: 700 12px Consolas, Monaco, monospace;
}
.timeline__block strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeline__block small { color: rgba(22, 49, 71, .74); }
</style>
