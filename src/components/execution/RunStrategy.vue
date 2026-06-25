<template>
  <el-card shadow="never" class="exec-card strategy-card">
    <template #header>
      <div class="card-head">
        <div>
          <span class="card-title">本次运行策略</span>
          <span class="card-sub">执行模式对齐 JMeter 冒烟 / 压测 / 耐久模型</span>
        </div>
        <el-tag type="info" effect="plain">{{ ruleSummary }}</el-tag>
      </div>
    </template>

    <el-form label-width="96px" :model="config" class="strategy-form">
      <el-form-item label="执行模式">
        <el-radio-group v-model="config.mode">
          <el-radio-button value="smoke">冒烟测试</el-radio-button>
          <el-radio-button value="stress">压力测试</el-radio-button>
          <el-radio-button value="endurance">耐久测试</el-radio-button>
        </el-radio-group>
        <div class="hint">{{ modeHint }}</div>
      </el-form-item>

      <div v-if="config.mode === 'stress'" class="param-grid">
        <el-form-item label="并发数">
          <el-input-number v-model="config.stress.threadCount" :min="1" :max="200" controls-position="right" />
          <span class="unit">线程</span>
        </el-form-item>
        <el-form-item label="迭代次数">
          <el-input-number v-model="config.stress.iterations" :min="1" :max="1000" controls-position="right" />
          <span class="unit">轮</span>
        </el-form-item>
        <el-form-item label="加压时长">
          <el-input-number v-model="config.stress.rampUpPeriod" :min="0" :max="3600" controls-position="right" />
          <span class="unit">秒</span>
        </el-form-item>
        <el-form-item label="思考间隔">
          <el-input-number v-model="config.stress.thinkTime" :min="0" :max="10000" controls-position="right" />
          <span class="unit">ms</span>
        </el-form-item>
      </div>

      <div v-if="config.mode === 'endurance'" class="param-grid">
        <el-form-item label="持续时长">
          <el-input-number v-model="config.endurance.durationMinutes" :min="1" :max="240" controls-position="right" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="并发数">
          <el-input-number v-model="config.endurance.concurrentUsers" :min="1" :max="200" controls-position="right" />
          <span class="unit">用户</span>
        </el-form-item>
        <el-form-item label="请求间隔">
          <el-input-number v-model="config.endurance.requestInterval" :min="100" :max="60000" :step="100" controls-position="right" />
          <span class="unit">ms</span>
        </el-form-item>
      </div>

      <el-collapse class="advanced">
        <el-collapse-item title="何时开始与通用项" name="trigger">
          <el-form-item label="触发方式">
            <el-radio-group v-model="config.trigger">
              <el-radio-button value="manual">手动</el-radio-button>
              <el-radio-button value="scheduled">定时</el-radio-button>
              <el-radio-button value="periodic">周期</el-radio-button>
            </el-radio-group>
            <div class="hint">周期表示重复执行整轮计划；耐久表示单次长时间持续施压。</div>
          </el-form-item>
          <el-form-item v-if="config.trigger === 'scheduled'" label="执行时间">
            <el-date-picker
              v-model="config.scheduleAt"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm:00"
              placeholder="选择执行时间"
            />
          </el-form-item>
          <template v-if="config.trigger === 'periodic'">
            <el-form-item label="周期间隔">
              <el-input-number v-model="config.periodicInterval" :min="1" :max="9999" controls-position="right" />
              <el-select v-model="config.periodicUnit" class="unit-select">
                <el-option label="秒" value="s" />
                <el-option label="分钟" value="m" />
                <el-option label="小时" value="h" />
                <el-option label="天" value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="执行次数">
              <el-input-number v-model="periodicCountProxy" :min="0" :max="99999" controls-position="right" />
              <span class="unit">0 表示不限次数</span>
            </el-form-item>
          </template>
          <div class="param-grid">
            <el-form-item label="超时时间">
              <el-input-number v-model="config.timeout" :min="1" :max="3600" controls-position="right" />
              <span class="unit">秒</span>
            </el-form-item>
            <el-form-item label="重试次数">
              <el-input-number v-model="config.retries" :min="0" :max="10" controls-position="right" />
              <span class="unit">次</span>
            </el-form-item>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-form>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useExecutionStore } from '@/stores/execution'
import { useRuleStore } from '@/stores/rule'

const store = useExecutionStore()
const ruleStore = useRuleStore()
const config = computed(() => store.config)

const modeHint = computed(() => ({
  smoke: '快速验证接口能不能跑通，适合联试前的第一轮确认。',
  stress: '高并发反复请求，观察吞吐、平均时延与失败率。',
  endurance: '长时间持续运行，观察链路和被测模块是否越跑越不稳定。',
}[config.value.mode]))

const ruleSummary = computed(() => {
  const ruleCount = store.planItems.reduce((sum, item) => {
    const set = ruleStore.ruleSets.find((rs) => rs.id === item.task?.strategy?.ruleSetId)
    return sum + (set?.rules?.filter((rule) => rule.enabled).length || 0)
  }, 0)
  const bound = store.planItems.filter((item) => item.task?.strategy?.ruleSetId).length
  return `规则集 ${bound}/${store.planItems.length || 0} · ${ruleCount}条`
})

const periodicCountProxy = computed({
  get: () => config.value.periodicCount ?? 0,
  set: (value) => { config.value.periodicCount = value > 0 ? value : null },
})
</script>

<style scoped lang="scss">
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.card-sub, .hint, .unit { color: var(--el-text-color-secondary); font-size: 12px; }
.hint { margin-top: 6px; line-height: 1.5; }
.strategy-form :deep(.el-form-item) { margin-bottom: 14px; }
.param-grid { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 0 18px; }
.unit { margin-left: 8px; }
.unit-select { width: 90px; margin-left: 8px; }
.advanced {
  margin-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 0;
  :deep(.el-collapse-item__header) { font-weight: 600; }
  :deep(.el-collapse-item__wrap) { border-bottom: 0; }
}
@media (max-width: 1100px) {
  .param-grid { grid-template-columns: 1fr; }
}
</style>
