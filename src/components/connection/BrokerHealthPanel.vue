<template>
  <div class="broker-health">
    <el-card shadow="never" class="health-card">
      <template #header>
        <div class="health-head">
          <div class="health-head__info">
            <span class="health-head__icon">
              <el-icon :size="20"><Connection /></el-icon>
            </span>
            <div>
              <div class="health-head__title">{{ broker.name }}</div>
              <div class="health-head__sub">{{ broker.brokerType }} · {{ broker.ip }}:{{ broker.port }}</div>
            </div>
          </div>
          <div class="health-head__actions">
            <el-tag :type="overallTag" effect="dark" size="large">{{ overallText }}</el-tag>
            <el-button type="primary" :icon="Refresh" :loading="checking" @click="runCheck" :disabled="checking">
              {{ checking ? '检测中...' : '运行三级检测' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 三级检测卡片 -->
      <div class="level-cards">
        <div class="level-card" :class="`level-card--${hc.level1.status}`">
          <div class="level-card__head">
            <span class="level-card__num">1</span>
            <span class="level-card__title">端口可达性</span>
            <StatusDot :status="hc.level1.status" />
          </div>
          <div class="level-card__body">
            <div class="level-card__desc">TCP Socket 连接探测</div>
            <div class="level-card__detail">{{ hc.level1.detail || '待检测' }}</div>
            <div v-if="hc.level1.latency" class="level-card__metric">
              延迟 <strong>{{ hc.level1.latency }}ms</strong>
            </div>
          </div>
        </div>

        <div class="level-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>

        <div class="level-card" :class="`level-card--${hc.level2.status}`">
          <div class="level-card__head">
            <span class="level-card__num">2</span>
            <span class="level-card__title">客户端连接</span>
            <StatusDot :status="hc.level2.status" />
          </div>
          <div class="level-card__body">
            <div class="level-card__desc">原生客户端建立连接+认证</div>
            <div class="level-card__detail">{{ hc.level2.detail || '待检测' }}</div>
            <div v-if="hc.level2.latency" class="level-card__metric">
              延迟 <strong>{{ hc.level2.latency }}ms</strong>
            </div>
          </div>
        </div>

        <div class="level-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>

        <div class="level-card" :class="`level-card--${hc.level3.status}`">
          <div class="level-card__head">
            <span class="level-card__num">3</span>
            <span class="level-card__title">集群状态</span>
            <StatusDot :status="hc.level3.status" />
          </div>
          <div class="level-card__body">
            <div class="level-card__desc">管理/运维 API 查询节点状态</div>
            <div class="level-card__detail">{{ hc.level3.detail || '待检测' }}</div>
            <div v-if="hc.level3.metrics?.nodes" class="level-card__metrics">
              <span class="metric-chip"><b>{{ hc.level3.metrics.nodes }}</b>节点</span>
              <span class="metric-chip"><b>{{ hc.level3.metrics.queues }}</b>队列</span>
              <span class="metric-chip"><b>{{ hc.level3.metrics.consumers }}</b>消费者</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 综合判定 -->
      <div class="verdict">
        <span class="verdict__label">综合判定</span>
        <el-tag :type="overallTag" effect="plain">{{ overallText }}</el-tag>
        <span v-if="hc.lastCheck" class="verdict__time">最后检测: {{ hc.lastCheck }}</span>
      </div>
    </el-card>

    <!-- Broker 配置 -->
    <el-card shadow="never" class="config-card">
      <template #header>
        <div class="config-head">
          <span>Broker 配置</span>
          <el-button type="primary" size="small" @click="$emit('save')">保存配置</el-button>
        </div>
      </template>
      <el-form :model="broker" label-width="100px" class="config-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="中间件类型">
              <el-input :model-value="broker.brokerType" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="管理端口">
              <el-input-number v-model="broker.managementPort" :min="1" :max="65535" controls-position="right" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户端 IP">
              <el-input v-model="broker.ip" placeholder="192.168.x.x" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户端端口">
              <el-input-number v-model="broker.port" :min="1" :max="65535" controls-position="right" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="认证用户">
              <el-input v-model="broker.authInfo.username" placeholder="username" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="认证密码">
              <el-input v-model="broker.authInfo.password" type="password" show-password placeholder="password" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="说明">
              <el-input v-model="broker.desc" type="textarea" :rows="2" maxlength="120" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, h, ref } from 'vue'
import { Connection, Refresh, ArrowRight } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  broker: { type: Object, required: true },
})

defineEmits(['save'])

const store = useConnectionStore()
const checking = ref(false)

const hc = computed(() => props.broker.healthCheck || {
  level1: { status: 'pending', latency: null, detail: '' },
  level2: { status: 'pending', latency: null, detail: '' },
  level3: { status: 'pending', detail: '', metrics: {} },
  lastCheck: null,
  overall: 'unknown',
})

const overallText = computed(() => {
  const map = { healthy: '健康', warning: '警告', error: '异常', checking: '检测中', unknown: '未检测' }
  return map[hc.value.overall] || '未检测'
})

const overallTag = computed(() => {
  const map = { healthy: 'success', warning: 'warning', error: 'danger', checking: 'info', unknown: 'info' }
  return map[hc.value.overall] || 'info'
})

const runCheck = async () => {
  checking.value = true
  try {
    await store.runBrokerHealthCheck(props.broker.id)
  } finally {
    checking.value = false
  }
}

// Status dot sub-component (使用 render function 避免 Vite + ESM build 下
// 字符串模板无法被 runtime compiler 编译的问题; refs: docs/界面优化建议_v1.0.md Bug-3)
const StatusDot = {
  props: ['status'],
  setup(props) {
    return () => h('span', { class: ['status-dot', `status-dot--${props.status}`] })
  }
}
</script>

<style scoped lang="scss">
.broker-health {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: auto;
}

.health-card {
  flex-shrink: 0;
  :deep(.el-card__body) { padding: 16px; }
}

.health-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  &__info { display: flex; align-items: center; gap: 10px; }
  &__icon { color: var(--el-color-primary); }
  &__title { font-size: 15px; font-weight: 600; }
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
  &__actions { display: flex; align-items: center; gap: 10px; }
}

.level-cards {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin: 16px 0;
}

.level-card {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-extra-light);
  transition: border-color 0.3s, background 0.3s;

  &--pass { border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
  &--fail { border-color: var(--el-color-danger-light-5); background: var(--el-color-danger-light-9); }
  &--warning { border-color: var(--el-color-warning-light-5); background: var(--el-color-warning-light-9); }
  &--checking { border-color: var(--el-color-primary-light-5); background: var(--el-color-primary-light-9); }

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  &__num {
    width: 22px; height: 22px;
    display: inline-grid; place-items: center;
    border-radius: 50%;
    background: var(--el-color-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }
  &__title { font-size: 13px; font-weight: 600; flex: 1; }
  &__body { font-size: 12px; color: var(--el-text-color-regular); }
  &__desc { color: var(--el-text-color-secondary); margin-bottom: 6px; }
  &__detail { margin-bottom: 6px; line-height: 1.5; }
  &__metric { color: var(--el-text-color-secondary); }
  &__metrics { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
}

.level-arrow {
  display: flex;
  align-items: center;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.metric-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  font-size: 11px;
  b { font-weight: 600; }
}

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--el-text-color-placeholder);
  &--pass { background: var(--el-color-success); }
  &--fail { background: var(--el-color-danger); }
  &--warning { background: var(--el-color-warning); }
  &--checking { background: var(--el-color-primary); animation: pulse 1s infinite; }
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.verdict {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  &__label { font-size: 13px; font-weight: 600; }
  &__time { font-size: 12px; color: var(--el-text-color-secondary); margin-left: auto; }
}

.config-card {
  flex-shrink: 0;
  :deep(.el-card__body) { padding: 16px; }
}
.config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.config-form :deep(.el-form-item) { margin-bottom: 14px; }
.w-full { width: 100%; }
</style>
