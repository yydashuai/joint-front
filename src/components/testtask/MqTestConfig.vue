<template>
  <div class="mq-test-config">
    <div class="mq-test-config__header">
      <el-switch v-model="mqTest.enabled" active-text="启用 MQ 三维探测" inactive-text="" />
      <el-tag v-if="mqTest.enabled" type="info" size="small" effect="plain">
        已启用 {{ enabledDimensions.length }} 个维度
      </el-tag>
    </div>

    <template v-if="mqTest.enabled">
      <!-- 维度一：Broker 健康检查 -->
      <el-card shadow="never" class="dimension-card">
        <template #header>
          <div class="dimension-head">
            <el-checkbox v-model="mqTest.brokerHealth.enabled" />
            <span class="dimension-title">维度一：Broker 健康检查</span>
          </div>
        </template>
        <div v-if="mqTest.brokerHealth.enabled" class="dimension-body">
          <div class="dimension-desc">自动验证关联 Broker 的端口可达性、客户端认证、集群运行状态。</div>
          <el-form label-width="100px" size="small">
            <el-form-item label="单级超时">
              <el-input-number v-model="mqTest.brokerHealth.timeout" :min="1000" :max="30000" :step="1000" controls-position="right" />
              <span class="form-hint">ms</span>
            </el-form-item>
          </el-form>
        </div>
      </el-card>

      <!-- 维度二：生产端连通性 -->
      <el-card shadow="never" class="dimension-card">
        <template #header>
          <div class="dimension-head">
            <el-checkbox v-model="mqTest.producer.enabled" />
            <span class="dimension-title">维度二：生产端连通性</span>
          </div>
        </template>
        <div v-if="mqTest.producer.enabled" class="dimension-body">
          <div class="dimension-desc">验证被测业务系统作为生产者能否正常向 MQ 发送消息。</div>
          <el-form label-width="110px" size="small">
            <el-form-item label="测试模式">
              <el-radio-group v-model="mqTest.producer.mode">
                <el-radio-button value="active">主动触发式</el-radio-button>
                <el-radio-button value="passive">被动监控式</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <template v-if="mqTest.producer.mode === 'active'">
              <el-form-item label="触发入口 URL">
                <el-input v-model="mqTest.producer.triggerUrl" placeholder="http://order-system/test/send" />
              </el-form-item>
              <el-form-item label="追踪标识字段">
                <el-input v-model="mqTest.producer.traceIdField" placeholder="test_trace_id" />
              </el-form-item>
              <el-form-item label="监听队列/主题">
                <el-input v-model="mqTest.producer.listenQueue" placeholder="order_queue" />
              </el-form-item>
              <el-form-item label="等待超时">
                <el-input-number v-model="mqTest.producer.waitTimeout" :min="1000" :max="60000" :step="1000" controls-position="right" />
                <span class="form-hint">ms</span>
              </el-form-item>
              <el-form-item label="消息标记">
                <el-input v-model="mqTest.producer.messageTag" placeholder="connectivity_check" />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="统计周期">
                <el-input-number v-model="mqTest.producer.passiveWindow" :min="60" :max="3600" :step="60" controls-position="right" />
                <span class="form-hint">秒</span>
              </el-form-item>
              <div class="passive-hint">
                <el-icon><InfoFilled /></el-icon>
                被动模式通过 MQ 管理接口查询消息生产速率，无法区分业务低峰和生产端故障。
              </div>
            </template>
          </el-form>
        </div>
      </el-card>

      <!-- 维度三：消费端连通性 -->
      <el-card shadow="never" class="dimension-card">
        <template #header>
          <div class="dimension-head">
            <el-checkbox v-model="mqTest.consumer.enabled" />
            <span class="dimension-title">维度三：消费端连通性</span>
          </div>
        </template>
        <div v-if="mqTest.consumer.enabled" class="dimension-body">
          <div class="dimension-desc">验证被测业务系统作为消费者能否正常连接 MQ、拉取消息并完成消费确认。</div>
          <el-form label-width="110px" size="small">
            <el-form-item label="预期消费者数">
              <el-input-number v-model="mqTest.consumer.expectedConsumerCount" :min="1" :max="100" controls-position="right" />
            </el-form-item>
            <el-form-item label="堆积告警阈值">
              <el-input-number v-model="mqTest.consumer.backlogThreshold" :min="100" :max="100000" :step="100" controls-position="right" />
              <span class="form-hint">条</span>
            </el-form-item>
            <el-form-item label="检查间隔">
              <el-input-number v-model="mqTest.consumer.checkInterval" :min="10" :max="600" :step="10" controls-position="right" />
              <span class="form-hint">秒</span>
            </el-form-item>
          </el-form>
        </div>
      </el-card>

      <!-- 调度与告警 -->
      <el-card shadow="never" class="dimension-card">
        <template #header>
          <div class="dimension-head">
            <span class="dimension-title">调度与告警</span>
          </div>
        </template>
        <div class="dimension-body">
          <el-form label-width="100px" size="small">
            <el-form-item label="调度周期">
              <span class="schedule-row">
                每
                <el-input-number v-model="mqTest.schedule.interval" :min="1" :max="60" controls-position="right" />
                <el-select v-model="mqTest.schedule.unit" style="width: 80px">
                  <el-option label="秒" value="s" />
                  <el-option label="分钟" value="m" />
                  <el-option label="小时" value="h" />
                </el-select>
                执行一次
              </span>
            </el-form-item>
            <el-form-item label="告警阈值">
              <span class="schedule-row">
                连续
                <el-input-number v-model="mqTest.alertThreshold.consecutiveFailures" :min="1" :max="10" controls-position="right" />
                次失败触发告警
              </span>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  mqTest: { type: Object, required: true },
})

const enabledDimensions = computed(() => {
  const dims = []
  if (props.mqTest.brokerHealth?.enabled) dims.push('broker_health')
  if (props.mqTest.producer?.enabled) dims.push('producer_connect')
  if (props.mqTest.consumer?.enabled) dims.push('consumer_connect')
  return dims
})
</script>

<style scoped lang="scss">
.mq-test-config {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }
}

.dimension-card {
  :deep(.el-card__header) { padding: 10px 14px; background: var(--el-fill-color-extra-light); }
  :deep(.el-card__body) { padding: 12px 14px; }
}

.dimension-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimension-title {
  font-size: 13px;
  font-weight: 600;
}

.dimension-body {
  .dimension-desc {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }
}

.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.passive-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-color-info-light-9);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
