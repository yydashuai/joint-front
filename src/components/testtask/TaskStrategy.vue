<template>
  <div class="strategy">
    <!-- 触发方式 -->
    <el-card shadow="never" class="strat-card">
      <template #header>
        <span class="strat-card__title">触发方式</span>
      </template>
      <el-form label-width="90px" :model="localStrategy">
        <el-form-item label="触发模式">
          <el-radio-group v-model="localStrategy.trigger" @change="onTriggerChange">
            <el-radio-button value="manual">手动触发</el-radio-button>
            <el-radio-button value="scheduled">定时触发</el-radio-button>
            <el-radio-button value="periodic">周期触发</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="localStrategy.trigger === 'scheduled'" label="执行时间">
          <el-date-picker
            v-model="localStrategy.scheduleAt"
            type="datetime"
            placeholder="选择执行时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:00"
            style="width: 100%;"
            @change="emitChange"
          />
        </el-form-item>
        <template v-if="localStrategy.trigger === 'periodic'">
          <el-form-item label="周期间隔">
            <el-input-number
              v-model="localStrategy.periodicInterval"
              :min="1"
              :max="9999"
              :step="1"
              controls-position="right"
              @change="emitChange"
            />
            <el-select
              v-model="localStrategy.periodicUnit"
              style="width: 90px; margin-left: 8px;"
              @change="emitChange"
            >
              <el-option label="秒" value="s" />
              <el-option label="分钟" value="m" />
              <el-option label="小时" value="h" />
              <el-option label="天" value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="执行次数">
            <el-radio-group v-model="periodicMode" @change="onPeriodicModeChange">
              <el-radio-button value="permanent">永久执行</el-radio-button>
              <el-radio-button value="custom">自定义次数</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="periodicMode === 'custom'" label="次数">
            <el-input-number
              v-model="localStrategy.periodicCount"
              :min="1"
              :max="99999"
              :step="1"
              controls-position="right"
              @change="emitChange"
            />
            <span class="strat-unit">次</span>
          </el-form-item>
        </template>
      </el-form>
    </el-card>

    <!-- 执行参数 -->
    <el-card shadow="never" class="strat-card">
      <template #header>
        <span class="strat-card__title">执行参数</span>
      </template>
      <el-form label-width="90px" :model="localStrategy">
        <el-form-item label="执行顺序">
          <el-radio-group v-model="localStrategy.execution" @change="emitChange">
            <el-radio-button value="serial">串行</el-radio-button>
            <el-radio-button value="parallel">并行</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="超时时间">
          <el-input-number
            v-model="localStrategy.timeout"
            :min="1"
            :max="3600"
            :step="5"
            controls-position="right"
            @change="emitChange"
          />
          <span class="strat-unit">秒</span>
        </el-form-item>
        <el-form-item label="重试次数">
          <el-input-number
            v-model="localStrategy.retries"
            :min="0"
            :max="10"
            :step="1"
            controls-position="right"
            @change="emitChange"
          />
          <span class="strat-unit">次</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 规则集 -->
    <el-card shadow="never" class="strat-card">
      <template #header>
        <div class="strat-card__head">
          <span class="strat-card__title">规则集</span>
          <el-tag :type="moduleRuleSets.length ? 'success' : 'info'" size="small" effect="plain">
            {{ moduleRuleSets.length }} 个可选
          </el-tag>
        </div>
      </template>
      <el-form label-width="90px">
        <el-form-item label="关联规则">
          <el-select
            v-model="localStrategy.ruleSetId"
            clearable
            filterable
            placeholder="选择当前模块下的规则集"
            style="width: 100%;"
            @change="emitChange"
          >
            <el-option
              v-for="ruleSet in moduleRuleSets"
              :key="ruleSet.id"
              :label="`${ruleSet.name}（${ruleSet.rules.filter(r => r.enabled).length}条启用）`"
              :value="ruleSet.id"
            />
          </el-select>
          <div v-if="!moduleRuleSets.length" class="strat-hint">
            当前模块暂无规则集，可先到规则管理中从接口自动生成。
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRuleStore } from '@/stores/rule'

const props = defineProps({
  task: { type: Object, required: true },
})
const emit = defineEmits(['change'])
const ruleStore = useRuleStore()

const localStrategy = reactive({
  trigger: 'manual',
  scheduleAt: null,
  periodicInterval: 60,
  periodicUnit: 's',
  periodicCount: null,    // null=永久, 正整数=自定义
  execution: 'serial',
  timeout: 30,
  retries: 0,
  ruleSetId: null,
})

/** 周期触发次数模式：permanent / custom */
const periodicMode = ref('permanent')
const moduleRuleSets = computed(() => ruleStore.ruleSetsOfModule(props.task.moduleId))

watch(() => props.task, (t) => {
  if (t?.strategy) {
    Object.assign(localStrategy, t.strategy)
    periodicMode.value = t.strategy.periodicCount == null ? 'permanent' : 'custom'
  }
}, { immediate: true })

const onTriggerChange = () => {
  // 切换触发模式时重置相关字段
  if (localStrategy.trigger !== 'scheduled') localStrategy.scheduleAt = null
  if (localStrategy.trigger !== 'periodic') {
    localStrategy.periodicInterval = 60
    localStrategy.periodicUnit = 's'
    localStrategy.periodicCount = null
    periodicMode.value = 'permanent'
  }
  emitChange()
}

const onPeriodicModeChange = (mode) => {
  localStrategy.periodicCount = mode === 'custom' ? 10 : null
  emitChange()
}

const emitChange = () => {
  emit('change', { ...localStrategy })
}
</script>

<style scoped lang="scss">
.strategy {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.strat-card {
  :deep(.el-card__header) { padding: 8px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.strat-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.strat-card__title {
  font-weight: 600;
  font-size: 14px;
}
.strat-unit {
  margin-left: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.strat-hint {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
