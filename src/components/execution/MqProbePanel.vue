<template>
  <el-card v-if="hasResults" shadow="never" class="mq-probe">
    <template #header>
      <div class="probe-head">
        <span class="probe-title">MQ 三维探测</span>
        <el-tag size="small" type="info">{{ probeItems.length }} 个 MQ 任务</el-tag>
      </div>
    </template>

    <div class="probe-list">
      <div v-for="item in probeItems" :key="item.id" class="probe-item">
        <div class="probe-item__head">
          <span class="probe-item__name">{{ item.result.taskName }}</span>
          <span class="probe-item__broker">{{ item.result.brokerName }} ({{ item.result.brokerType }})</span>
        </div>

        <div class="probe-dimensions">
          <!-- 维度一：Broker 健康 -->
          <div class="probe-dim" :class="`probe-dim--${item.result.brokerHealth.overall}`">
            <div class="probe-dim__head">
              <span class="probe-dim__title">Broker 健康</span>
              <StatusBadge :status="item.result.brokerHealth.overall" :labels="{ healthy: '健康', warning: '警告', error: '异常' }" />
            </div>
            <div class="probe-dim__body">
              <div class="probe-level">
                <span class="probe-level__dot" :class="`dot--${item.result.brokerHealth.level1.status}`" />
                <span>端口可达</span>
                <span v-if="item.result.brokerHealth.level1.latency" class="probe-level__ms">{{ item.result.brokerHealth.level1.latency }}ms</span>
              </div>
              <div class="probe-level">
                <span class="probe-level__dot" :class="`dot--${item.result.brokerHealth.level2.status}`" />
                <span>认证连接</span>
                <span v-if="item.result.brokerHealth.level2.latency" class="probe-level__ms">{{ item.result.brokerHealth.level2.latency }}ms</span>
              </div>
              <div class="probe-level">
                <span class="probe-level__dot" :class="`dot--${item.result.brokerHealth.level3.status}`" />
                <span>集群状态</span>
                <span v-if="item.result.brokerHealth.level3.metrics?.nodes" class="probe-level__ms">{{ item.result.brokerHealth.level3.metrics.nodes }}节点</span>
              </div>
            </div>
          </div>

          <!-- 维度二：生产端 -->
          <div class="probe-dim" :class="`probe-dim--${item.result.producerConnect.status}`">
            <div class="probe-dim__head">
              <span class="probe-dim__title">生产端连通性</span>
              <StatusBadge :status="item.result.producerConnect.status" :labels="{ pass: '通过', fail: '失败' }" />
            </div>
            <div class="probe-dim__body">
              <div class="probe-detail-line">
                <span class="probe-detail-label">模式</span>
                <span>{{ item.result.producerConnect.mode === 'active' ? '主动触发' : '被动监控' }}</span>
              </div>
              <div class="probe-detail-line">
                <span class="probe-detail-label">Trace ID</span>
                <span class="mono">{{ item.result.producerConnect.traceId }}</span>
              </div>
              <div v-if="item.result.producerConnect.latency" class="probe-detail-line">
                <span class="probe-detail-label">延迟</span>
                <span>{{ item.result.producerConnect.latency }}ms</span>
              </div>
            </div>
          </div>

          <!-- 维度三：消费端 -->
          <div class="probe-dim" :class="`probe-dim--${item.result.consumerConnect.status}`">
            <div class="probe-dim__head">
              <span class="probe-dim__title">消费端连通性</span>
              <StatusBadge :status="item.result.consumerConnect.status" :labels="{ pass: '正常', fail: '异常', warning: '告警' }" />
            </div>
            <div class="probe-dim__body">
              <div class="probe-detail-line">
                <span class="probe-detail-label">消费者</span>
                <span>{{ item.result.consumerConnect.onlineConsumers }} / {{ item.result.consumerConnect.expectedConsumers }}</span>
              </div>
              <div class="probe-detail-line">
                <span class="probe-detail-label">堆积量</span>
                <span :class="{ 'text-warn': item.result.consumerConnect.backlog > 500 }">{{ item.result.consumerConnect.backlog }} 条</span>
              </div>
              <div class="probe-detail-line">
                <span class="probe-detail-label">偏移量</span>
                <span>{{ item.result.consumerConnect.offsetUpdated ? '持续更新' : '停止更新' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 探测日志 -->
        <el-collapse v-if="item.result.probeLog?.length" class="probe-log-collapse">
          <el-collapse-item title="展开详细日志">
            <div class="probe-log">
              <div v-for="(log, li) in item.result.probeLog" :key="li" class="probe-log__line" :class="`log--${log.level}`">
                <span class="probe-log__time">[{{ log.time }}]</span>
                <span class="probe-log__msg">{{ log.msg }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useExecutionStore } from '@/stores/execution'

const store = useExecutionStore()

const hasResults = computed(() => Object.keys(store.mqProbeResults).length > 0)

const probeItems = computed(() => {
  return store.mqProbeItems.map(item => ({
    id: item.id,
    result: store.mqProbeResults[item.id],
  })).filter(item => item.result)
})

// Inline StatusBadge component
const StatusBadge = {
  props: ['status', 'labels'],
  computed: {
    text() { return this.labels?.[this.status] || this.status },
    type() {
      const map = { pass: 'success', healthy: 'success', fail: 'danger', error: 'danger', warning: 'warning', pending: 'info' }
      return map[this.status] || 'info'
    }
  },
  template: '<el-tag :type="type" size="small" effect="plain">{{ text }}</el-tag>'
}
</script>

<style scoped lang="scss">
.mq-probe {
  margin-top: 14px;
  :deep(.el-card__body) { padding: 14px; }
}

.probe-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.probe-title { font-weight: 650; font-size: 14px; }

.probe-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.probe-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-extra-light);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  &__name { font-weight: 600; font-size: 13px; }
  &__broker { font-size: 12px; color: var(--el-text-color-secondary); }
}

.probe-dimensions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.probe-dim {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;
  background: #fff;

  &--healthy, &--pass { border-color: var(--el-color-success-light-5); }
  &--warning { border-color: var(--el-color-warning-light-5); }
  &--error, &--fail { border-color: var(--el-color-danger-light-5); }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }
  &__title { font-size: 12px; font-weight: 600; }
  &__body { font-size: 12px; }
}

.probe-level {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  &__dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--el-text-color-placeholder);
    &.dot--pass { background: var(--el-color-success); }
    &.dot--fail { background: var(--el-color-danger); }
    &.dot--warning { background: var(--el-color-warning); }
  }
  &__ms { margin-left: auto; color: var(--el-text-color-secondary); font-family: Consolas, Monaco, monospace; }
}

.probe-detail-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.probe-detail-label {
  color: var(--el-text-color-secondary);
  min-width: 52px;
}

.mono { font-family: Consolas, Monaco, monospace; }
.text-warn { color: var(--el-color-warning); font-weight: 600; }

.probe-log-collapse {
  margin-top: 8px;
  :deep(.el-collapse-item__header) { font-size: 12px; color: var(--el-text-color-secondary); height: 28px; line-height: 28px; }
  :deep(.el-collapse-item__content) { padding-bottom: 0; }
}

.probe-log {
  background: var(--el-fill-color-dark);
  border-radius: 4px;
  padding: 8px 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 11.5px;
  line-height: 1.7;
  max-height: 200px;
  overflow-y: auto;

  &__line {
    display: flex;
    gap: 6px;
    &.log--success .probe-log__msg { color: var(--el-color-success); }
    &.log--error .probe-log__msg { color: var(--el-color-danger); }
    &.log--warning .probe-log__msg { color: var(--el-color-warning); }
    &.log--info .probe-log__msg { color: var(--el-text-color-regular); }
  }
  &__time { color: var(--el-text-color-secondary); white-space: nowrap; }
}

@media (max-width: 1180px) {
  .probe-dimensions { grid-template-columns: 1fr; }
}
</style>
